/**
 * useCameraContinuity - Hooks for Camera & Continuity tools
 * Shot Lists, Slate Logs, Camera Media, and Continuity Notes
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

// =============================================================================
// TYPES
// =============================================================================

export interface ShotListItem {
  id: string;
  project_id: string;
  scene_number: string;
  shot_label: string;
  description?: string;
  camera?: string;
  lens?: string;
  framing?: string;
  status: 'planned' | 'shooting' | 'completed' | 'cut';
  is_circle_take: boolean;
  sort_order: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShotInput {
  scene_number: string;
  shot_label: string;
  description?: string;
  camera?: string;
  lens?: string;
  framing?: string;
  status?: string;
  is_circle_take?: boolean;
  sort_order?: number;
  notes?: string;
}

export interface SlateLogItem {
  id: string;
  project_id: string;
  scene_number: string;
  shot_label?: string;
  take_number: number;
  camera?: string;
  sound_roll?: string;
  file_name?: string;
  is_circle_take: boolean;
  notes?: string;
  recorded_at: string;
  logged_by?: string;
  created_at: string;
}

export interface CreateSlateLogInput {
  scene_number: string;
  shot_label?: string;
  take_number?: number;
  camera?: string;
  sound_roll?: string;
  file_name?: string;
  is_circle_take?: boolean;
  notes?: string;
  recorded_at?: string;
}

export interface CameraMediaItem {
  id: string;
  project_id: string;
  media_label: string;
  media_type: 'CFexpress' | 'SSD' | 'SD' | 'XQD' | 'CFAST' | 'HDD' | 'LTO' | 'other';
  camera?: string;
  capacity_gb?: number;
  status: 'in_camera' | 'with_DIT' | 'backed_up' | 'ready_to_format' | 'archived' | 'failed';
  current_holder?: string;
  first_backup_done: boolean;
  second_backup_done: boolean;
  backup_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCameraMediaInput {
  media_label: string;
  media_type?: string;
  camera?: string;
  capacity_gb?: number;
  status?: string;
  current_holder?: string;
  notes?: string;
}

export interface ContinuityNoteItem {
  id: string;
  project_id: string;
  scene_number: string;
  take_ref?: string;
  department: 'script' | 'wardrobe' | 'makeup' | 'hair' | 'props' | 'art' | 'general';
  note: string;
  image_url?: string;
  image_urls?: string[];
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContinuityNoteInput {
  scene_number: string;
  take_ref?: string;
  department?: string;
  note: string;
  image_url?: string;
  image_urls?: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function getAuthToken(): string {
  const token = api.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
}

// =============================================================================
// SHOT LIST HOOKS
// =============================================================================

export function useShotList(
  projectId: string | null,
  filters?: { scene_number?: string; status?: string }
) {
  return useQuery({
    queryKey: ['backlot-shot-list', projectId, filters],
    queryFn: async (): Promise<ShotListItem[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const params = new URLSearchParams();
      if (filters?.scene_number) params.set('scene_number', filters.scene_number);
      if (filters?.status) params.set('status', filters.status);

      const url = `${API_BASE}/backlot/projects/${projectId}/shots${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch shot list');
      const data = await response.json();
      return data.shots || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateShot(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateShotInput): Promise<ShotListItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/shots`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error('Failed to create shot');
      const data = await response.json();
      return data.shot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', projectId] });
    },
  });
}

export function useUpdateShot(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shotId, updates }: { shotId: string; updates: Partial<CreateShotInput> }): Promise<ShotListItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/shots/${shotId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update shot');
      const data = await response.json();
      return data.shot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', projectId] });
    },
  });
}

export function useDeleteShot(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shotId: string): Promise<void> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/shots/${shotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete shot');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', projectId] });
    },
  });
}

// =============================================================================
// SLATE LOG HOOKS
// =============================================================================

export function useSlateLogs(
  projectId: string | null,
  filters?: { scene_number?: string; shoot_date?: string }
) {
  return useQuery({
    queryKey: ['backlot-slate-logs', projectId, filters],
    queryFn: async (): Promise<SlateLogItem[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const params = new URLSearchParams();
      if (filters?.scene_number) params.set('scene_number', filters.scene_number);
      if (filters?.shoot_date) params.set('shoot_date', filters.shoot_date);

      const url = `${API_BASE}/backlot/projects/${projectId}/slate-logs${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch slate logs');
      const data = await response.json();
      return data.logs || [];
    },
    enabled: !!projectId,
  });
}

export function useNextTakeNumber(
  projectId: string | null,
  sceneNumber: string | null,
  shotLabel?: string
) {
  return useQuery({
    queryKey: ['backlot-next-take', projectId, sceneNumber, shotLabel],
    queryFn: async (): Promise<number> => {
      if (!projectId || !sceneNumber) return 1;

      const token = getAuthToken();
      const params = new URLSearchParams({ scene_number: sceneNumber });
      if (shotLabel) params.set('shot_label', shotLabel);

      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/slate-logs/next-take?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) return 1;
      const data = await response.json();
      return data.next_take || 1;
    },
    enabled: !!projectId && !!sceneNumber,
  });
}

export function useCreateSlateLog(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSlateLogInput): Promise<SlateLogItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/slate-logs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error('Failed to create slate log');
      const data = await response.json();
      return data.log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-slate-logs', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-next-take', projectId] });
    },
  });
}

export function useUpdateSlateLog(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ logId, updates }: { logId: string; updates: Partial<CreateSlateLogInput> }): Promise<SlateLogItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/slate-logs/${logId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update slate log');
      const data = await response.json();
      return data.log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-slate-logs', projectId] });
    },
  });
}

export function useDeleteSlateLog(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (logId: string): Promise<void> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/slate-logs/${logId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete slate log');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-slate-logs', projectId] });
    },
  });
}

// =============================================================================
// CAMERA MEDIA HOOKS
// =============================================================================

export function useCameraMedia(
  projectId: string | null,
  filters?: { status?: string; camera?: string }
) {
  return useQuery({
    queryKey: ['backlot-camera-media', projectId, filters],
    queryFn: async (): Promise<CameraMediaItem[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.camera) params.set('camera', filters.camera);

      const url = `${API_BASE}/backlot/projects/${projectId}/camera-media${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch camera media');
      const data = await response.json();
      return data.media || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateCameraMedia(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCameraMediaInput): Promise<CameraMediaItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-media`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create camera media');
      }
      const data = await response.json();
      return data.media;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-camera-media', projectId] });
    },
  });
}

export function useUpdateCameraMedia(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mediaId, updates }: { mediaId: string; updates: Partial<CreateCameraMediaInput & { first_backup_done?: boolean; second_backup_done?: boolean; backup_notes?: string }> }): Promise<CameraMediaItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-media/${mediaId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update camera media');
      }
      const data = await response.json();
      return data.media;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-camera-media', projectId] });
    },
  });
}

export function useDeleteCameraMedia(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mediaId: string): Promise<void> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/camera-media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete camera media');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-camera-media', projectId] });
    },
  });
}

// =============================================================================
// CONTINUITY NOTES HOOKS
// =============================================================================

export function useContinuityNotes(
  projectId: string | null,
  filters?: { scene_number?: string; department?: string; search?: string }
) {
  return useQuery({
    queryKey: ['backlot-continuity-notes', projectId, filters],
    queryFn: async (): Promise<ContinuityNoteItem[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const params = new URLSearchParams();
      if (filters?.scene_number) params.set('scene_number', filters.scene_number);
      if (filters?.department) params.set('department', filters.department);
      if (filters?.search) params.set('search', filters.search);

      const url = `${API_BASE}/backlot/projects/${projectId}/continuity-notes${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch continuity notes');
      const data = await response.json();
      return data.notes || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateContinuityNote(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateContinuityNoteInput): Promise<ContinuityNoteItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/continuity-notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error('Failed to create continuity note');
      const data = await response.json();
      return data.note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-continuity-notes', projectId] });
    },
  });
}

export function useUpdateContinuityNote(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, updates }: { noteId: string; updates: Partial<CreateContinuityNoteInput> }): Promise<ContinuityNoteItem> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/continuity-notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update continuity note');
      const data = await response.json();
      return data.note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-continuity-notes', projectId] });
    },
  });
}

export function useDeleteContinuityNote(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string): Promise<void> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/continuity-notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete continuity note');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-continuity-notes', projectId] });
    },
  });
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const SHOT_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'completed', label: 'Completed' },
  { value: 'cut', label: 'Cut' },
] as const;

export const FRAMING_OPTIONS = [
  { value: 'ECU', label: 'Extreme Close-up' },
  { value: 'CU', label: 'Close-up' },
  { value: 'MCU', label: 'Medium Close-up' },
  { value: 'MS', label: 'Medium Shot' },
  { value: 'MWS', label: 'Medium Wide Shot' },
  { value: 'WS', label: 'Wide Shot' },
  { value: 'EWS', label: 'Extreme Wide Shot' },
  { value: 'OTS', label: 'Over the Shoulder' },
  { value: 'POV', label: 'Point of View' },
  { value: '2-SHOT', label: 'Two Shot' },
  { value: 'GROUP', label: 'Group Shot' },
] as const;

export const MEDIA_TYPES = [
  { value: 'CFexpress', label: 'CFexpress' },
  { value: 'SSD', label: 'SSD' },
  { value: 'SD', label: 'SD Card' },
  { value: 'XQD', label: 'XQD' },
  { value: 'CFAST', label: 'CFast' },
  { value: 'HDD', label: 'Hard Drive' },
  { value: 'LTO', label: 'LTO Tape' },
  { value: 'other', label: 'Other' },
] as const;

export const MEDIA_STATUSES = [
  { value: 'in_camera', label: 'In Camera' },
  { value: 'with_DIT', label: 'With DIT' },
  { value: 'backed_up', label: 'Backed Up' },
  { value: 'ready_to_format', label: 'Ready to Format' },
  { value: 'archived', label: 'Archived' },
  { value: 'failed', label: 'Failed' },
] as const;

export const CONTINUITY_DEPARTMENTS = [
  { value: 'script', label: 'Script Supervisor' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'makeup', label: 'Makeup' },
  { value: 'hair', label: 'Hair' },
  { value: 'props', label: 'Props' },
  { value: 'art', label: 'Art Department' },
  { value: 'general', label: 'General' },
] as const;
