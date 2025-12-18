/**
 * useShots - Hook for managing shot lists and coverage tracking
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (sceneId) params.append('scene_id', sceneId);
      if (shotType !== 'all') params.append('shot_type', shotType);
      if (coverageStatus !== 'all') params.append('coverage_status', coverageStatus);
      if (priority !== 'all') params.append('priority', priority);
      params.append('limit', String(limit));

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/shots?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch shots' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.shots || result || []) as BacklotSceneShot[];
    },
    enabled: !!projectId,
  });

  const createShot = useMutation({
    mutationFn: async ({
      projectId,
      sceneId,
      ...input
    }: SceneShotInput & { projectId: string; sceneId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/scenes/${sceneId}/shots`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create shot' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.shot || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const updateShot = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SceneShotInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shots/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update shot' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.shot || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
  });

  const updateCoverage = useMutation({
    mutationFn: async ({ id, coverage_status, notes }: CoverageUpdateInput & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shots/${id}/coverage`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ coverage_status, notes }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update coverage' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.shot || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const bulkUpdateCoverage = useMutation({
    mutationFn: async ({
      projectId,
      shotIds,
      coverage_status,
    }: {
      projectId: string;
      shotIds: string[];
      coverage_status: BacklotCoverageStatus;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/shots/bulk-coverage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shot_ids: shotIds, coverage_status }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update coverage' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const deleteShot = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shots/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete shot' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
    },
  });

  const reorderShots = useMutation({
    mutationFn: async ({ sceneId, shotIds }: { sceneId: string; shotIds: string[] }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Send reorder requests for each shot
      const updates = shotIds.map((id, index) =>
        fetch(`${API_BASE}/api/v1/backlot/shots/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sort_order: index }),
        })
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

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shots/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch shot' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.shot || result) as BacklotSceneShot;
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

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shots/${shotId}/images`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch images' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.images || result || []) as BacklotShotImage[];
    },
    enabled: !!shotId,
  });

  const addImage = useMutation({
    mutationFn: async ({ shotId, ...input }: ShotImageInput & { shotId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shots/${shotId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add image' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.image || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-images'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
    },
  });

  const updateImage = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ShotImageInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shot-images/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update image' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.image || result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-images'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shots'] });
    },
  });

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shot-images/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete image' }));
        throw new Error(error.detail);
      }
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

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/coverage/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch coverage summary' }));
        throw new Error(error.detail);
      }

      return await response.json();
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

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/coverage/by-scene`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch coverage by scene' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.scenes || [];
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

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Get shots for this scene and calculate summary
      const response = await fetch(`${API_BASE}/api/v1/backlot/shots?scene_id=${sceneId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      const shots = result.shots || result || [];

      const summary: SceneCoverageSummary = {
        total_shots: shots.length,
        shot: 0,
        not_shot: 0,
        alt_needed: 0,
        dropped: 0,
        must_have_total: 0,
        must_have_shot: 0,
        est_time_minutes: 0,
        shot_time_minutes: 0,
      };

      shots.forEach((shot: any) => {
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

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/shots`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch call sheet shots' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.scenes || result || [];
    },
    enabled: !!callSheetId,
  });
}
