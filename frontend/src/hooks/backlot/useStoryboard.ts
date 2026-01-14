/**
 * useStoryboard - Hook for Storyboard management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Types
export interface StoryboardPanel {
  id: string;
  storyboard_id: string;
  section_id: string;
  sort_order: number;
  title: string | null;
  shot_size: string | null;
  camera_move: string | null;
  lens: string | null;
  framing: string | null;
  action: string | null;
  dialogue: string | null;
  audio: string | null;
  notes: string | null;
  duration_seconds: number | null;
  reference_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryboardSection {
  id: string;
  storyboard_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  panels?: StoryboardPanel[];
  // Entity connections
  scene_id?: string | null;
  shot_list_id?: string | null;
  // Joined entity data
  scene?: { id: string; scene_number: string; set_name?: string };
  shot_list?: { id: string; title: string };
}

export interface Storyboard {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  aspect_ratio: string;
  status: 'DRAFT' | 'LOCKED';
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  sections?: StoryboardSection[];
  panel_count?: number;
  section_count?: number;
  // Entity connections
  episode_id?: string | null;
  scene_id?: string | null;
  shot_list_id?: string | null;
  moodboard_id?: string | null;
  // Joined entity data
  episode?: { id: string; title: string; episode_code: string };
  scene?: { id: string; scene_number: string; set_name?: string };
  shot_list?: { id: string; title: string };
  moodboard?: { id: string; title: string };
}

// View mode type for storyboard display
export type StoryboardViewMode = 'list' | 'card' | 'grid';

export interface StoryboardPrintData {
  storyboard: Storyboard;
  sections: (StoryboardSection & { panels: StoryboardPanel[] })[];
  generated_at: string;
}

// Constants
export const SHOT_SIZES = [
  { value: 'EWS', label: 'Extreme Wide Shot' },
  { value: 'WS', label: 'Wide Shot' },
  { value: 'FS', label: 'Full Shot' },
  { value: 'MFS', label: 'Medium Full Shot' },
  { value: 'MS', label: 'Medium Shot' },
  { value: 'MCU', label: 'Medium Close-Up' },
  { value: 'CU', label: 'Close-Up' },
  { value: 'ECU', label: 'Extreme Close-Up' },
  { value: 'OTS', label: 'Over the Shoulder' },
  { value: 'POV', label: 'Point of View' },
  { value: 'Insert', label: 'Insert' },
] as const;

export const CAMERA_MOVES = [
  { value: 'Static', label: 'Static' },
  { value: 'Pan', label: 'Pan' },
  { value: 'Tilt', label: 'Tilt' },
  { value: 'Dolly', label: 'Dolly' },
  { value: 'Truck', label: 'Truck' },
  { value: 'Crane', label: 'Crane' },
  { value: 'Handheld', label: 'Handheld' },
  { value: 'Steadicam', label: 'Steadicam' },
  { value: 'Zoom', label: 'Zoom' },
  { value: 'Push In', label: 'Push In' },
  { value: 'Pull Out', label: 'Pull Out' },
  { value: 'Track', label: 'Track' },
  { value: 'Arc', label: 'Arc' },
] as const;

export const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (HD)' },
  { value: '2.39:1', label: '2.39:1 (Anamorphic)' },
  { value: '1.85:1', label: '1.85:1 (Flat)' },
  { value: '4:3', label: '4:3 (Academy)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '9:16', label: '9:16 (Vertical)' },
] as const;

// Query key factory
const storyboardKeys = {
  all: ['storyboard'] as const,
  list: (projectId: string) => [...storyboardKeys.all, 'list', projectId] as const,
  detail: (projectId: string, storyboardId: string) =>
    [...storyboardKeys.all, 'detail', projectId, storyboardId] as const,
  print: (projectId: string, storyboardId: string) =>
    [...storyboardKeys.all, 'print', projectId, storyboardId] as const,
};

/**
 * Fetch all storyboards for a project
 */
export function useStoryboards(projectId: string | null) {
  return useQuery({
    queryKey: storyboardKeys.list(projectId || ''),
    queryFn: async (): Promise<Storyboard[]> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(`/api/v1/backlot/projects/${projectId}/storyboards`);
      return response.storyboards;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

/**
 * Fetch a single storyboard with sections and panels
 */
export function useStoryboard(projectId: string | null, storyboardId: string | null) {
  return useQuery({
    queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
    queryFn: async (): Promise<Storyboard> => {
      if (!projectId || !storyboardId) throw new Error('Project ID and Storyboard ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}`);
    },
    enabled: !!projectId && !!storyboardId,
    staleTime: 30000,
  });
}

/**
 * Create a new storyboard
 */
export function useCreateStoryboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      aspect_ratio?: string;
      // Entity connections
      episode_id?: string;
      scene_id?: string;
      shot_list_id?: string;
      moodboard_id?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/storyboards`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyboardKeys.list(projectId || '') });
    },
  });
}

/**
 * Update a storyboard
 */
export function useUpdateStoryboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      storyboardId,
      data,
    }: {
      storyboardId: string;
      data: Partial<{
        title: string;
        description: string;
        aspect_ratio: string;
        status: 'DRAFT' | 'LOCKED';
        // Entity connections
        episode_id: string | null;
        scene_id: string | null;
        shot_list_id: string | null;
        moodboard_id: string | null;
      }>;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.patch(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}`,
        data
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: storyboardKeys.list(projectId || '') });
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', variables.storyboardId),
      });
    },
  });
}

/**
 * Delete a storyboard
 */
export function useDeleteStoryboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyboardId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyboardKeys.list(projectId || '') });
    },
  });
}

/**
 * Create a new section
 */
export function useCreateSection(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      // Entity connections
      scene_id?: string;
      shot_list_id?: string;
    }) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/sections`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Update a section
 */
export function useUpdateSection(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sectionId,
      data,
    }: {
      sectionId: string;
      data: Partial<{
        title: string;
        // Entity connections
        scene_id: string | null;
        shot_list_id: string | null;
      }>;
    }) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.patch(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/sections/${sectionId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Delete a section
 */
export function useDeleteSection(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sectionId: string) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.delete(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/sections/${sectionId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Create a new panel
 */
export function useCreatePanel(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      section_id: string;
      title?: string;
      shot_size?: string;
      camera_move?: string;
      lens?: string;
      framing?: string;
      action?: string;
      dialogue?: string;
      audio?: string;
      notes?: string;
      duration_seconds?: number;
      reference_image_url?: string;
    }) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/panels`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Update a panel
 */
export function useUpdatePanel(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      panelId,
      data,
    }: {
      panelId: string;
      data: Partial<{
        title: string;
        shot_size: string;
        camera_move: string;
        lens: string;
        framing: string;
        action: string;
        dialogue: string;
        audio: string;
        notes: string;
        duration_seconds: number;
        reference_image_url: string;
        section_id: string;
      }>;
    }) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.patch(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/panels/${panelId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Delete a panel
 */
export function useDeletePanel(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (panelId: string) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.delete(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/panels/${panelId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Reorder sections
 */
export function useReorderSections(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sectionId,
      newSortOrder,
    }: {
      sectionId: string;
      newSortOrder: number;
    }) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/sections/reorder`,
        { section_id: sectionId, new_sort_order: newSortOrder }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Reorder panels
 */
export function useReorderPanels(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      panelId,
      targetSectionId,
      newSortOrder,
    }: {
      panelId: string;
      targetSectionId: string;
      newSortOrder: number;
    }) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/panels/reorder`,
        {
          panel_id: panelId,
          target_section_id: targetSectionId,
          new_sort_order: newSortOrder,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

/**
 * Fetch print data
 */
export function useStoryboardPrint(
  projectId: string | null,
  storyboardId: string | null,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: storyboardKeys.print(projectId || '', storyboardId || ''),
    queryFn: async (): Promise<StoryboardPrintData> => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');
      return api.get(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/print`
      );
    },
    enabled: !!projectId && !!storyboardId && enabled,
  });
}

/**
 * Build export CSV URL
 */
export function getStoryboardExportUrl(projectId: string, storyboardId: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/export.csv`;
}

/**
 * Calculate total duration for a storyboard
 */
export function calculateTotalDuration(sections: StoryboardSection[]): number {
  return sections.reduce((total, section) => {
    const sectionDuration = (section.panels || []).reduce((sum, panel) => {
      return sum + (panel.duration_seconds || 0);
    }, 0);
    return total + sectionDuration;
  }, 0);
}

/**
 * Format duration in seconds to mm:ss
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get shot size info
 */
export function getShotSizeInfo(value: string) {
  return SHOT_SIZES.find((s) => s.value === value);
}

/**
 * Get camera move info
 */
export function getCameraMoveInfo(value: string) {
  return CAMERA_MOVES.find((m) => m.value === value);
}

// =====================================================
// Panel Image Upload
// =====================================================

/**
 * Upload an image to a storyboard panel using presigned URL pattern
 */
export function usePanelImageUpload(projectId: string | null, storyboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ panelId, file }: { panelId: string; file: File }) => {
      if (!projectId || !storyboardId) throw new Error('Project and Storyboard IDs required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');
      const baseUrl = import.meta.env.VITE_API_URL || '';

      // Step 1: Get presigned upload URL
      const urlResponse = await fetch(
        `${baseUrl}/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/panels/${panelId}/upload-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type,
            file_size: file.size,
          }),
        }
      );

      if (!urlResponse.ok) {
        const error = await urlResponse.json().catch(() => ({ detail: 'Failed to get upload URL' }));
        throw new Error(error.detail);
      }

      const { upload_url, file_url } = await urlResponse.json();

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Step 3: Update panel with file URL
      await api.put(
        `/api/v1/backlot/projects/${projectId}/storyboards/${storyboardId}/panels/${panelId}`,
        { reference_image_url: file_url }
      );

      return { file_url };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: storyboardKeys.detail(projectId || '', storyboardId || ''),
      });
    },
  });
}

// =====================================================
// Call Sheet Storyboard Links
// =====================================================

/**
 * Fetch storyboards linked to a call sheet
 */
export function useCallSheetStoryboards(callSheetId: string | null) {
  return useQuery({
    queryKey: ['call-sheet-storyboards', callSheetId],
    queryFn: async (): Promise<Storyboard[]> => {
      if (!callSheetId) throw new Error('Call Sheet ID required');
      const response = await api.get(`/api/v1/backlot/call-sheets/${callSheetId}/storyboards`);
      return response.storyboards || [];
    },
    enabled: !!callSheetId,
    staleTime: 30000,
  });
}

/**
 * Link/unlink storyboards to call sheets
 */
export function useCallSheetStoryboardLink() {
  const queryClient = useQueryClient();

  const link = useMutation({
    mutationFn: async ({
      callSheetId,
      storyboardId,
    }: {
      callSheetId: string;
      storyboardId: string;
    }) => {
      return api.post(
        `/api/v1/backlot/call-sheets/${callSheetId}/storyboards/${storyboardId}/link`
      );
    },
    onSuccess: (_, { callSheetId }) => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet-storyboards', callSheetId] });
    },
  });

  const unlink = useMutation({
    mutationFn: async ({
      callSheetId,
      storyboardId,
    }: {
      callSheetId: string;
      storyboardId: string;
    }) => {
      return api.delete(
        `/api/v1/backlot/call-sheets/${callSheetId}/storyboards/${storyboardId}/link`
      );
    },
    onSuccess: (_, { callSheetId }) => {
      queryClient.invalidateQueries({ queryKey: ['call-sheet-storyboards', callSheetId] });
    },
  });

  return { link, unlink };
}

// =====================================================
// Query by Entity
// =====================================================

/**
 * Fetch storyboards linked to a specific scene
 */
export function useStoryboardsByScene(projectId: string | null, sceneId: string | null) {
  return useQuery({
    queryKey: ['storyboards-by-scene', projectId, sceneId],
    queryFn: async (): Promise<Storyboard[]> => {
      if (!projectId || !sceneId) throw new Error('Project and Scene IDs required');
      const response = await api.get(
        `/api/v1/backlot/projects/${projectId}/storyboards/by-scene/${sceneId}`
      );
      return response.storyboards || [];
    },
    enabled: !!projectId && !!sceneId,
    staleTime: 30000,
  });
}

/**
 * Fetch storyboards linked to a specific episode
 */
export function useStoryboardsByEpisode(projectId: string | null, episodeId: string | null) {
  return useQuery({
    queryKey: ['storyboards-by-episode', projectId, episodeId],
    queryFn: async (): Promise<Storyboard[]> => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      const response = await api.get(
        `/api/v1/backlot/projects/${projectId}/storyboards/by-episode/${episodeId}`
      );
      return response.storyboards || [];
    },
    enabled: !!projectId && !!episodeId,
    staleTime: 30000,
  });
}

/**
 * Fetch storyboards linked to a specific shot list
 */
export function useStoryboardsByShotList(projectId: string | null, shotListId: string | null) {
  return useQuery({
    queryKey: ['storyboards-by-shot-list', projectId, shotListId],
    queryFn: async (): Promise<Storyboard[]> => {
      if (!projectId || !shotListId) throw new Error('Project and Shot List IDs required');
      const response = await api.get(
        `/api/v1/backlot/projects/${projectId}/storyboards/by-shot-list/${shotListId}`
      );
      return response.storyboards || [];
    },
    enabled: !!projectId && !!shotListId,
    staleTime: 30000,
  });
}
