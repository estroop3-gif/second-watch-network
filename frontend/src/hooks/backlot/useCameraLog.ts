/**
 * useCameraLog - Hook for quick camera take logging
 * Provides fast, painless camera notes for 1st AC / 2nd AC
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

// =============================================================================
// TYPES
// =============================================================================

export interface CameraLogItem {
  id: string;
  project_id: string;
  production_day_id?: string;
  scene_number: string;
  shot_type: string;
  take_number: number;
  camera_id: string;
  lens?: string;
  iris?: string;
  filter?: string;
  focus_distance?: string;
  is_circle_take: boolean;
  notes?: string;
  dailies_clip_id?: string;
  logged_at: string;
  logged_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCameraLogInput {
  production_day_id?: string;
  scene_number: string;
  shot_type: string;
  take_number?: number; // Auto-calculated if not provided
  camera_id?: string;
  lens?: string;
  iris?: string;
  filter?: string;
  focus_distance?: string;
  is_circle_take?: boolean;
  notes?: string;
}

export interface UpdateCameraLogInput {
  scene_number?: string;
  shot_type?: string;
  take_number?: number;
  camera_id?: string;
  lens?: string;
  iris?: string;
  filter?: string;
  focus_distance?: string;
  is_circle_take?: boolean;
  notes?: string;
  dailies_clip_id?: string;
}

export interface CameraSettings {
  project_id: string;
  lens_presets: string[];
  filter_presets: string[];
  iris_presets: string[];
  camera_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export interface UpdateCameraSettingsInput {
  lens_presets?: string[];
  filter_presets?: string[];
  iris_presets?: string[];
  camera_ids?: string[];
}

export interface NextTakeInfo {
  next_take_number: number;
  scene_number: string;
  shot_type: string;
  camera_id: string;
}

// Query keys
export const CAMERA_LOG_KEYS = {
  logs: (projectId: string, dayId?: string) => ['camera-logs', projectId, dayId],
  settings: (projectId: string) => ['camera-settings', projectId],
  nextTake: (projectId: string, scene: string, shot: string, camera: string) =>
    ['camera-next-take', projectId, scene, shot, camera],
};

// =============================================================================
// CAMERA LOGS HOOKS
// =============================================================================

/**
 * Get camera logs for a project
 */
export function useCameraLogs(
  projectId: string | null,
  options?: {
    productionDayId?: string;
    cameraId?: string;
    sceneNumber?: string;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: CAMERA_LOG_KEYS.logs(projectId || '', options?.productionDayId),
    queryFn: async (): Promise<CameraLogItem[]> => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (options?.productionDayId) params.append('production_day_id', options.productionDayId);
      if (options?.cameraId) params.append('camera_id', options.cameraId);
      if (options?.sceneNumber) params.append('scene_number', options.sceneNumber);
      if (options?.limit) params.append('limit', options.limit.toString());

      const queryString = params.toString();
      const url = `${API_BASE}/backlot/projects/${projectId}/camera-logs${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch camera logs' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Create a new camera log entry
 */
export function useCreateCameraLog(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCameraLogInput): Promise<CameraLogItem> => {
      if (!projectId) throw new Error('Project ID required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create log' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: CAMERA_LOG_KEYS.logs(projectId || '', input.production_day_id) });
      // Also invalidate next take query
      queryClient.invalidateQueries({ queryKey: ['camera-next-take', projectId] });
    },
  });
}

/**
 * Update a camera log entry
 */
export function useUpdateCameraLog(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, input }: { logId: string; input: UpdateCameraLogInput }): Promise<CameraLogItem> => {
      if (!projectId) throw new Error('Project ID required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-logs/${logId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update log' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera-logs', projectId] });
    },
  });
}

/**
 * Delete a camera log entry
 */
export function useDeleteCameraLog(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string): Promise<void> => {
      if (!projectId) throw new Error('Project ID required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-logs/${logId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete log' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera-logs', projectId] });
    },
  });
}

/**
 * Toggle circle take status
 */
export function useToggleCircleTake(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, isCircle }: { logId: string; isCircle: boolean }): Promise<CameraLogItem> => {
      if (!projectId) throw new Error('Project ID required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-logs/${logId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_circle_take: isCircle }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera-logs', projectId] });
    },
  });
}

/**
 * Get next take number for a scene/shot/camera combo
 */
export function useNextTakeNumber(
  projectId: string | null,
  sceneNumber: string,
  shotType: string,
  cameraId: string = 'A'
) {
  return useQuery({
    queryKey: CAMERA_LOG_KEYS.nextTake(projectId || '', sceneNumber, shotType, cameraId),
    queryFn: async (): Promise<NextTakeInfo> => {
      if (!projectId || !sceneNumber || !shotType) {
        return { next_take_number: 1, scene_number: sceneNumber, shot_type: shotType, camera_id: cameraId };
      }

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams({
        scene_number: sceneNumber,
        shot_type: shotType,
        camera_id: cameraId,
      });

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/camera-logs/next-take?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        return { next_take_number: 1, scene_number: sceneNumber, shot_type: shotType, camera_id: cameraId };
      }

      return response.json();
    },
    enabled: !!projectId && !!sceneNumber && !!shotType,
  });
}

// =============================================================================
// CAMERA SETTINGS HOOKS
// =============================================================================

/**
 * Get camera settings/presets for a project
 */
export function useCameraSettings(projectId: string | null) {
  return useQuery({
    queryKey: CAMERA_LOG_KEYS.settings(projectId || ''),
    queryFn: async (): Promise<CameraSettings> => {
      if (!projectId) {
        return {
          project_id: '',
          lens_presets: ['24mm', '35mm', '50mm', '85mm', '100mm'],
          filter_presets: ['Clear', 'ND.3', 'ND.6', 'ND.9', 'ND1.2', 'Pola'],
          iris_presets: ['1.4', '2', '2.8', '4', '5.6', '8', '11'],
          camera_ids: ['A', 'B'],
        };
      }

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // Return defaults on error
        return {
          project_id: projectId,
          lens_presets: ['24mm', '35mm', '50mm', '85mm', '100mm'],
          filter_presets: ['Clear', 'ND.3', 'ND.6', 'ND.9', 'ND1.2', 'Pola'],
          iris_presets: ['1.4', '2', '2.8', '4', '5.6', '8', '11'],
          camera_ids: ['A', 'B'],
        };
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Update camera settings/presets
 */
export function useUpdateCameraSettings(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateCameraSettingsInput): Promise<CameraSettings> => {
      if (!projectId) throw new Error('Project ID required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-settings`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update settings' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CAMERA_LOG_KEYS.settings(projectId || '') });
    },
  });
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SHOT_TYPES = [
  { value: 'WS', label: 'Wide Shot' },
  { value: 'MWS', label: 'Medium Wide' },
  { value: 'MS', label: 'Medium Shot' },
  { value: 'MCU', label: 'Medium Close-Up' },
  { value: 'CU', label: 'Close-Up' },
  { value: 'ECU', label: 'Extreme Close-Up' },
  { value: 'OTS', label: 'Over the Shoulder' },
  { value: '2-SHOT', label: '2-Shot' },
  { value: 'INSERT', label: 'Insert' },
  { value: 'POV', label: 'POV' },
] as const;

export const DEFAULT_LENS_PRESETS = ['24mm', '35mm', '50mm', '85mm', '100mm'];
export const DEFAULT_FILTER_PRESETS = ['Clear', 'ND.3', 'ND.6', 'ND.9', 'ND1.2', 'Pola'];
export const DEFAULT_IRIS_PRESETS = ['1.4', '2', '2.8', '4', '5.6', '8', '11'];
export const DEFAULT_CAMERA_IDS = ['A', 'B'];

// Local storage keys for remembering last used values
export const CAMERA_LOG_STORAGE_KEYS = {
  lastLens: 'camera_log_last_lens',
  lastIris: 'camera_log_last_iris',
  lastFilter: 'camera_log_last_filter',
  lastCamera: 'camera_log_last_camera',
};

/**
 * Get last used camera settings from localStorage
 */
export function getLastUsedSettings(): {
  lens?: string;
  iris?: string;
  filter?: string;
  camera?: string;
} {
  if (typeof window === 'undefined') return {};

  return {
    lens: localStorage.getItem(CAMERA_LOG_STORAGE_KEYS.lastLens) || undefined,
    iris: localStorage.getItem(CAMERA_LOG_STORAGE_KEYS.lastIris) || undefined,
    filter: localStorage.getItem(CAMERA_LOG_STORAGE_KEYS.lastFilter) || undefined,
    camera: localStorage.getItem(CAMERA_LOG_STORAGE_KEYS.lastCamera) || undefined,
  };
}

/**
 * Save last used camera settings to localStorage
 */
export function saveLastUsedSettings(settings: {
  lens?: string;
  iris?: string;
  filter?: string;
  camera?: string;
}) {
  if (typeof window === 'undefined') return;

  if (settings.lens) localStorage.setItem(CAMERA_LOG_STORAGE_KEYS.lastLens, settings.lens);
  if (settings.iris) localStorage.setItem(CAMERA_LOG_STORAGE_KEYS.lastIris, settings.iris);
  if (settings.filter) localStorage.setItem(CAMERA_LOG_STORAGE_KEYS.lastFilter, settings.filter);
  if (settings.camera) localStorage.setItem(CAMERA_LOG_STORAGE_KEYS.lastCamera, settings.camera);
}
