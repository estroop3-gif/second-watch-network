/**
 * useShots - Hook for managing shot lists and coverage tracking
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotSceneShot,
  BacklotShotImage,
  BacklotShotType,
  BacklotCoverageStatus,
  BacklotShotPriority,
  SceneShotInput,
  ShotImageInput,
  CoverageUpdateInput,
  SceneCoverageSummary,
  ProjectCoverageSummary,
  CoverageByScene,
} from '@/types/backlot';

interface UseShotsOptions {
  projectId: string | null;
  sceneId?: string | null;
  shotType?: BacklotShotType | 'all';
  coverageStatus?: BacklotCoverageStatus | 'all';
  priority?: BacklotShotPriority | 'all';
  limit?: number;
}

export function useShots(options: UseShotsOptions) {
  const {
    projectId,
    sceneId,
    shotType = 'all',
    coverageStatus = 'all',
    priority = 'all',
    limit = 500,
  } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-shots', { projectId, sceneId, shotType, coverageStatus, priority, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from('backlot_scene_shots')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .order('shot_number', { ascending: true })
        .limit(limit);

      if (sceneId) {
        query = query.eq('scene_id', sceneId);
      }

      if (shotType !== 'all') {
        query = query.eq('shot_type', shotType);
      }

      if (coverageStatus !== 'all') {
        query = query.eq('coverage_status', coverageStatus);
      }

      if (priority !== 'all') {
        query = query.eq('priority', priority);
      }

      const { data: shotsData, error } = await query;
      if (error) throw error;
      if (!shotsData || shotsData.length === 0) return [];

      // Fetch scene info
      const sceneIds = new Set<string>();
      shotsData.forEach(s => {
        if (s.scene_id) sceneIds.add(s.scene_id);
      });

      let sceneMap = new Map<string, any>();
      if (sceneIds.size > 0) {
        const { data: scenes } = await supabase
          .from('backlot_scenes')
          .select('id, scene_number, scene_heading, int_ext, time_of_day')
          .in('id', Array.from(sceneIds));
        sceneMap = new Map(scenes?.map(s => [s.id, s]) || []);
      }

      // Fetch images for all shots
      const shotIds = shotsData.map(s => s.id);
      let imageMap = new Map<string, BacklotShotImage[]>();
      if (shotIds.length > 0) {
        const { data: images } = await supabase
          .from('backlot_scene_shot_images')
          .select('*')
          .in('scene_shot_id', shotIds)
          .order('sort_order', { ascending: true });

        if (images) {
          images.forEach(img => {
            if (!imageMap.has(img.scene_shot_id)) {
              imageMap.set(img.scene_shot_id, []);
            }
            imageMap.get(img.scene_shot_id)!.push(img as BacklotShotImage);
          });
        }
      }

      // Fetch covered_by profiles
      const coveredByIds = new Set<string>();
      shotsData.forEach(s => {
        if (s.covered_by_user_id) coveredByIds.add(s.covered_by_user_id);
      });

      let profileMap = new Map<string, any>();
      if (coveredByIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name')
          .in('id', Array.from(coveredByIds));
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return shotsData.map(shot => ({
        ...shot,
        scene: shot.scene_id ? sceneMap.get(shot.scene_id) : null,
        images: imageMap.get(shot.id) || [],
        covered_by_name: shot.covered_by_user_id
          ? profileMap.get(shot.covered_by_user_id)?.display_name ||
            profileMap.get(shot.covered_by_user_id)?.full_name ||
            profileMap.get(shot.covered_by_user_id)?.username
          : null,
      })) as BacklotSceneShot[];
    },
    enabled: !!projectId,
  });

  const createShot = useMutation({
    mutationFn: async ({
      projectId,
      sceneId,
      ...input
    }: SceneShotInput & { projectId: string; sceneId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Get next shot number if not provided
      let shotNumber = input.shot_number;
      if (!shotNumber) {
        const { data: existingShots } = await supabase
          .from('backlot_scene_shots')
          .select('shot_number')
          .eq('scene_id', sceneId);

        const maxNum = existingShots?.reduce((max, s) => {
          const num = parseInt(s.shot_number, 10);
          return !isNaN(num) && num > max ? num : max;
        }, 0) || 0;

        shotNumber = String(maxNum + 1);
      }

      // Get next sort order
      const { data: lastShot } = await supabase
        .from('backlot_scene_shots')
        .select('sort_order')
        .eq('scene_id', sceneId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const sortOrder = input.sort_order ?? (lastShot?.sort_order ?? 0) + 1;

      const { data, error } = await supabase
        .from('backlot_scene_shots')
        .insert({
          project_id: projectId,
          scene_id: sceneId,
          shot_number: shotNumber,
          shot_type: input.shot_type,
          lens: input.lens || null,
          camera_movement: input.camera_movement || null,
          description: input.description || null,
          est_time_minutes: input.est_time_minutes || null,
          priority: input.priority || null,
          notes: input.notes || null,
          sort_order: sortOrder,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotSceneShot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const updateShot = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SceneShotInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.shot_number !== undefined) updateData.shot_number = input.shot_number;
      if (input.shot_type !== undefined) updateData.shot_type = input.shot_type;
      if (input.lens !== undefined) updateData.lens = input.lens;
      if (input.camera_movement !== undefined) updateData.camera_movement = input.camera_movement;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.est_time_minutes !== undefined) updateData.est_time_minutes = input.est_time_minutes;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;

      const { data, error } = await supabase
        .from('backlot_scene_shots')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotSceneShot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
  });

  const updateCoverage = useMutation({
    mutationFn: async ({ id, coverage_status, notes }: CoverageUpdateInput & { id: string }) => {
      const { data: userData } = await supabase.auth.getUser();

      const updateData: Record<string, any> = { coverage_status };
      if (notes !== undefined) updateData.notes = notes;

      // Set covered_at and covered_by_user_id when marking as shot
      if (coverage_status === 'shot' && userData.user) {
        updateData.covered_at = new Date().toISOString();
        updateData.covered_by_user_id = userData.user.id;
      } else if (coverage_status === 'not_shot') {
        updateData.covered_at = null;
        updateData.covered_by_user_id = null;
      }

      const { data, error } = await supabase
        .from('backlot_scene_shots')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotSceneShot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const bulkUpdateCoverage = useMutation({
    mutationFn: async ({
      shotIds,
      coverage_status,
    }: {
      shotIds: string[];
      coverage_status: BacklotCoverageStatus;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      const updateData: Record<string, any> = { coverage_status };

      if (coverage_status === 'shot' && userData.user) {
        updateData.covered_at = new Date().toISOString();
        updateData.covered_by_user_id = userData.user.id;
      } else if (coverage_status === 'not_shot') {
        updateData.covered_at = null;
        updateData.covered_by_user_id = null;
      }

      const { error } = await supabase
        .from('backlot_scene_shots')
        .update(updateData)
        .in('id', shotIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const deleteShot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backlot_scene_shots').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const reorderShots = useMutation({
    mutationFn: async ({ sceneId, shotIds }: { sceneId: string; shotIds: string[] }) => {
      // Update sort_order for each shot based on new order
      const updates = shotIds.map((id, index) =>
        supabase
          .from('backlot_scene_shots')
          .update({ sort_order: index })
          .eq('id', id)
          .eq('scene_id', sceneId)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
    },
  });

  return {
    shots: data || [],
    isLoading,
    error,
    refetch,
    createShot,
    updateShot,
    updateCoverage,
    bulkUpdateCoverage,
    deleteShot,
    reorderShots,
  };
}

// Fetch single shot
export function useShot(id: string | null) {
  return useQuery({
    queryKey: ['backlot-shot', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('backlot_scene_shots')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch scene
      let scene = null;
      if (data.scene_id) {
        const { data: sceneData } = await supabase
          .from('backlot_scenes')
          .select('id, scene_number, scene_heading, int_ext, time_of_day')
          .eq('id', data.scene_id)
          .single();
        scene = sceneData;
      }

      // Fetch images
      const { data: images } = await supabase
        .from('backlot_scene_shot_images')
        .select('*')
        .eq('scene_shot_id', id)
        .order('sort_order', { ascending: true });

      // Fetch covered_by profile
      let covered_by_name = null;
      if (data.covered_by_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, full_name, display_name')
          .eq('id', data.covered_by_user_id)
          .single();
        covered_by_name = profile?.display_name || profile?.full_name || profile?.username;
      }

      return {
        ...data,
        scene,
        images: images as BacklotShotImage[],
        covered_by_name,
      } as BacklotSceneShot;
    },
    enabled: !!id,
  });
}

// Shot images management
export function useShotImages(shotId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-shot-images', shotId],
    queryFn: async () => {
      if (!shotId) return [];

      const { data, error } = await supabase
        .from('backlot_scene_shot_images')
        .select('*')
        .eq('scene_shot_id', shotId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as BacklotShotImage[];
    },
    enabled: !!shotId,
  });

  const addImage = useMutation({
    mutationFn: async ({ shotId, ...input }: ShotImageInput & { shotId: string }) => {
      // Get next sort order
      const { data: lastImage } = await supabase
        .from('backlot_scene_shot_images')
        .select('sort_order')
        .eq('scene_shot_id', shotId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const sortOrder = input.sort_order ?? (lastImage?.sort_order ?? 0) + 1;

      const { data, error } = await supabase
        .from('backlot_scene_shot_images')
        .insert({
          scene_shot_id: shotId,
          image_url: input.image_url,
          thumbnail_url: input.thumbnail_url || null,
          description: input.description || null,
          sort_order: sortOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotShotImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-images'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
    },
  });

  const updateImage = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ShotImageInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.image_url !== undefined) updateData.image_url = input.image_url;
      if (input.thumbnail_url !== undefined) updateData.thumbnail_url = input.thumbnail_url;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;

      const { data, error } = await supabase
        .from('backlot_scene_shot_images')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotShotImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-images'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
    },
  });

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backlot_scene_shot_images').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-images'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
    },
  });

  return {
    images: data || [],
    isLoading,
    error,
    refetch,
    addImage,
    updateImage,
    deleteImage,
  };
}

// Coverage summary for entire project
export function useCoverageSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-coverage-summary', projectId],
    queryFn: async (): Promise<ProjectCoverageSummary | null> => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from('backlot_scene_shots')
        .select('shot_type, coverage_status, priority, est_time_minutes')
        .eq('project_id', projectId);

      if (error) throw error;

      // Count unique scenes
      const { data: sceneData } = await supabase
        .from('backlot_scene_shots')
        .select('scene_id')
        .eq('project_id', projectId);

      const uniqueScenes = new Set(sceneData?.map(s => s.scene_id) || []);

      // Build summary
      const summary: ProjectCoverageSummary = {
        total_scenes: uniqueScenes.size,
        total_shots: data?.length || 0,
        shot: 0,
        not_shot: 0,
        alt_needed: 0,
        dropped: 0,
        coverage_percentage: 0,
        must_have_coverage: 100,
        est_total_minutes: 0,
        est_remaining_minutes: 0,
        by_type: {} as Record<BacklotShotType, number>,
      };

      let mustHaveTotal = 0;
      let mustHaveShot = 0;

      data?.forEach(shot => {
        // Count by status
        if (shot.coverage_status === 'shot') summary.shot++;
        else if (shot.coverage_status === 'not_shot') summary.not_shot++;
        else if (shot.coverage_status === 'alt_needed') summary.alt_needed++;
        else if (shot.coverage_status === 'dropped') summary.dropped++;

        // Count by type
        const type = shot.shot_type as BacklotShotType;
        summary.by_type[type] = (summary.by_type[type] || 0) + 1;

        // Must-have tracking
        if (shot.priority === 'must_have') {
          mustHaveTotal++;
          if (shot.coverage_status === 'shot') mustHaveShot++;
        }

        // Time tracking
        if (shot.est_time_minutes) {
          summary.est_total_minutes += shot.est_time_minutes;
          if (shot.coverage_status === 'not_shot') {
            summary.est_remaining_minutes += shot.est_time_minutes;
          }
        }
      });

      // Calculate percentages
      if (summary.total_shots > 0) {
        summary.coverage_percentage = Math.round((100 * summary.shot) / summary.total_shots);
      }
      if (mustHaveTotal > 0) {
        summary.must_have_coverage = Math.round((100 * mustHaveShot) / mustHaveTotal);
      }

      return summary;
    },
    enabled: !!projectId,
  });
}

// Coverage by scene
export function useCoverageByScene(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-coverage-by-scene', projectId],
    queryFn: async (): Promise<CoverageByScene[]> => {
      if (!projectId) return [];

      // Fetch all shots for project
      const { data: shots, error } = await supabase
        .from('backlot_scene_shots')
        .select('scene_id, coverage_status')
        .eq('project_id', projectId);

      if (error) throw error;
      if (!shots || shots.length === 0) return [];

      // Get unique scene IDs
      const sceneIds = [...new Set(shots.map(s => s.scene_id))];

      // Fetch scene info
      const { data: scenes } = await supabase
        .from('backlot_scenes')
        .select('id, scene_number, scene_heading')
        .in('id', sceneIds)
        .order('sort_order', { ascending: true });

      // Group shots by scene
      const sceneStatsMap = new Map<
        string,
        {
          total: number;
          shot: number;
          not_shot: number;
          alt_needed: number;
          dropped: number;
        }
      >();

      shots.forEach(shot => {
        if (!sceneStatsMap.has(shot.scene_id)) {
          sceneStatsMap.set(shot.scene_id, {
            total: 0,
            shot: 0,
            not_shot: 0,
            alt_needed: 0,
            dropped: 0,
          });
        }
        const stats = sceneStatsMap.get(shot.scene_id)!;
        stats.total++;
        if (shot.coverage_status === 'shot') stats.shot++;
        else if (shot.coverage_status === 'not_shot') stats.not_shot++;
        else if (shot.coverage_status === 'alt_needed') stats.alt_needed++;
        else if (shot.coverage_status === 'dropped') stats.dropped++;
      });

      // Build result
      return (scenes || []).map(scene => {
        const stats = sceneStatsMap.get(scene.id) || {
          total: 0,
          shot: 0,
          not_shot: 0,
          alt_needed: 0,
          dropped: 0,
        };
        return {
          scene_id: scene.id,
          scene_number: scene.scene_number,
          scene_heading: scene.scene_heading,
          total_shots: stats.total,
          shot: stats.shot,
          not_shot: stats.not_shot,
          alt_needed: stats.alt_needed,
          dropped: stats.dropped,
          coverage_percentage:
            stats.total > 0 ? Math.round((100 * stats.shot) / stats.total) : 0,
        };
      });
    },
    enabled: !!projectId,
  });
}

// Scene-level coverage summary
export function useSceneCoverageSummary(sceneId: string | null) {
  return useQuery({
    queryKey: ['backlot-scene-coverage', sceneId],
    queryFn: async (): Promise<SceneCoverageSummary | null> => {
      if (!sceneId) return null;

      const { data, error } = await supabase
        .from('backlot_scene_shots')
        .select('coverage_status, priority, est_time_minutes')
        .eq('scene_id', sceneId);

      if (error) throw error;

      const summary: SceneCoverageSummary = {
        total_shots: data?.length || 0,
        shot: 0,
        not_shot: 0,
        alt_needed: 0,
        dropped: 0,
        must_have_total: 0,
        must_have_shot: 0,
        est_time_minutes: 0,
        shot_time_minutes: 0,
      };

      data?.forEach(shot => {
        if (shot.coverage_status === 'shot') summary.shot++;
        else if (shot.coverage_status === 'not_shot') summary.not_shot++;
        else if (shot.coverage_status === 'alt_needed') summary.alt_needed++;
        else if (shot.coverage_status === 'dropped') summary.dropped++;

        if (shot.priority === 'must_have') {
          summary.must_have_total++;
          if (shot.coverage_status === 'shot') summary.must_have_shot++;
        }

        if (shot.est_time_minutes) {
          summary.est_time_minutes += shot.est_time_minutes;
          if (shot.coverage_status === 'shot') {
            summary.shot_time_minutes += shot.est_time_minutes;
          }
        }
      });

      return summary;
    },
    enabled: !!sceneId,
  });
}

// Get shots for scenes on a call sheet
export function useCallSheetShots(callSheetId: string | null) {
  return useQuery({
    queryKey: ['backlot-call-sheet-shots', callSheetId],
    queryFn: async () => {
      if (!callSheetId) return [];

      // First get the call sheet to find production_day_id
      const { data: callSheet, error: callSheetError } = await supabase
        .from('backlot_call_sheets')
        .select('production_day_id, project_id')
        .eq('id', callSheetId)
        .single();

      if (callSheetError) throw callSheetError;
      if (!callSheet?.production_day_id) return [];

      // Get scenes scheduled for this production day
      const { data: scheduledScenes, error: scenesError } = await supabase
        .from('backlot_production_day_scenes')
        .select('scene_id')
        .eq('production_day_id', callSheet.production_day_id);

      if (scenesError) throw scenesError;
      if (!scheduledScenes || scheduledScenes.length === 0) return [];

      const sceneIds = scheduledScenes.map(s => s.scene_id);

      // Fetch scene info
      const { data: scenes } = await supabase
        .from('backlot_scenes')
        .select('id, scene_number, scene_heading')
        .in('id', sceneIds)
        .order('sort_order', { ascending: true });

      // Fetch shots for these scenes
      const { data: shots, error: shotsError } = await supabase
        .from('backlot_scene_shots')
        .select('*')
        .in('scene_id', sceneIds)
        .order('sort_order', { ascending: true });

      if (shotsError) throw shotsError;

      // Group shots by scene
      const shotsByScene = new Map<string, BacklotSceneShot[]>();
      shots?.forEach(shot => {
        if (!shotsByScene.has(shot.scene_id)) {
          shotsByScene.set(shot.scene_id, []);
        }
        shotsByScene.get(shot.scene_id)!.push(shot as BacklotSceneShot);
      });

      // Build result
      return (scenes || []).map(scene => {
        const sceneShots = shotsByScene.get(scene.id) || [];

        // Calculate coverage for this scene
        const coverage: SceneCoverageSummary = {
          total_shots: sceneShots.length,
          shot: sceneShots.filter(s => s.coverage_status === 'shot').length,
          not_shot: sceneShots.filter(s => s.coverage_status === 'not_shot').length,
          alt_needed: sceneShots.filter(s => s.coverage_status === 'alt_needed').length,
          dropped: sceneShots.filter(s => s.coverage_status === 'dropped').length,
          must_have_total: sceneShots.filter(s => s.priority === 'must_have').length,
          must_have_shot: sceneShots.filter(
            s => s.priority === 'must_have' && s.coverage_status === 'shot'
          ).length,
          est_time_minutes: sceneShots.reduce((sum, s) => sum + (s.est_time_minutes || 0), 0),
          shot_time_minutes: sceneShots
            .filter(s => s.coverage_status === 'shot')
            .reduce((sum, s) => sum + (s.est_time_minutes || 0), 0),
        };

        return {
          scene_id: scene.id,
          scene_number: scene.scene_number,
          scene_heading: scene.scene_heading,
          shots: sceneShots,
          coverage,
        };
      });
    },
    enabled: !!callSheetId,
  });
}
