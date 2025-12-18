/**
 * useContinuity - Hooks for Script Supervisor's Continuity Workspace
 * Lining Marks, Take Notes, Continuity Photos, and enhanced Take logging
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const RAW_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

// =============================================================================
// TYPES
// =============================================================================

export interface LiningMark {
  id: string;
  project_id: string;
  script_id?: string;
  scene_id?: string;
  page_number: number;
  start_y: number;
  end_y: number;
  x_position: number;
  coverage_type: string;
  camera_label?: string;
  setup_label?: string;
  line_style: string;
  line_color: string;
  take_ids?: string[];
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLiningMarkInput {
  project_id: string;
  script_id?: string;
  scene_id?: string;
  page_number: number;
  start_y: number;
  end_y: number;
  x_position?: number;
  coverage_type: string;
  camera_label?: string;
  setup_label?: string;
  line_style?: string;
  line_color?: string;
  take_ids?: string[];
  notes?: string;
}

export interface TakeNote {
  id: string;
  project_id: string;
  take_id: string;
  note_text: string;
  note_category: string;
  timecode?: string;
  page_number?: number;
  anchor_x?: number;
  anchor_y?: number;
  is_critical: boolean;
  is_dialogue_related: boolean;
  created_by?: string;
  created_at: string;
}

export interface CreateTakeNoteInput {
  project_id: string;
  take_id: string;
  note_text: string;
  note_category?: string;
  timecode?: string;
  page_number?: number;
  anchor_x?: number;
  anchor_y?: number;
  is_critical?: boolean;
  is_dialogue_related?: boolean;
}

export interface ContinuityPhoto {
  id: string;
  project_id: string;
  scene_id?: string;
  take_id?: string;
  s3_key: string;
  s3_bucket: string;
  original_filename?: string;
  file_size_bytes?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  thumbnail_s3_key?: string;
  scene_number?: string;
  description?: string;
  category: string;
  is_reference: boolean;
  is_favorite: boolean;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
  // Computed URLs
  thumbnail_url?: string;
  full_url?: string;
  tags?: { id: string; tag: string }[];
}

export interface ContinuityPhotoTag {
  id: string;
  photo_id: string;
  tag: string;
  x_position?: number;
  y_position?: number;
  created_at: string;
}

// Enhanced Take type for script supervisor use
export interface Take {
  id: string;
  project_id: string;
  scene_id?: string;
  production_day_id?: string;
  scene_number: string;
  take_number: number;
  status: string;
  timecode_in?: string;
  timecode_out?: string;
  camera_label?: string;
  setup_label?: string;
  camera_roll?: string;
  time_of_day?: string;
  duration_seconds?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTakeInput {
  project_id: string;
  scene_id?: string;
  production_day_id?: string;
  scene_number: string;
  take_number?: number;
  status?: string;
  timecode_in?: string;
  timecode_out?: string;
  camera_label?: string;
  setup_label?: string;
  camera_roll?: string;
  time_of_day?: string;
  duration_seconds?: number;
  notes?: string;
}

// Continuity Notes (scene-level notes, different from take notes)
export interface ContinuityNote {
  id: string;
  project_id: string;
  scene_id: string;
  category: string;
  content: string;
  is_critical: boolean;
  created_by?: {
    id: string;
    display_name?: string;
    full_name?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateContinuityNoteInput {
  project_id: string;
  scene_id: string;
  category: string;
  content: string;
  is_critical?: boolean;
}

// =============================================================================
// LINING MARKS HOOKS
// =============================================================================

interface LiningMarksParams {
  projectId: string;
  scriptId?: string;
  sceneId?: string;
  pageNumber?: number;
}

export function useLiningMarks(params: LiningMarksParams) {
  return useQuery({
    queryKey: ['continuity', 'lining-marks', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.scriptId) searchParams.set('script_id', params.scriptId);
      if (params.sceneId) searchParams.set('scene_id', params.sceneId);
      if (params.pageNumber) searchParams.set('page_number', params.pageNumber.toString());

      const response = await api.get(
        `${API_BASE}/backlot/projects/${params.projectId}/continuity/lining-marks?${searchParams}`
      );
      return response.data as LiningMark[];
    },
    enabled: !!params.projectId,
  });
}

export function useCreateLiningMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLiningMarkInput) => {
      const response = await api.post(
        `${API_BASE}/backlot/projects/${input.project_id}/continuity/lining-marks`,
        input
      );
      return response.data as LiningMark;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'lining-marks'] });
    },
  });
}

export function useUpdateLiningMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateLiningMarkInput> & { id: string }) => {
      const projectId = input.project_id;
      const response = await api.patch(
        `${API_BASE}/backlot/projects/${projectId}/continuity/lining-marks/${id}`,
        input
      );
      return response.data as LiningMark;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'lining-marks'] });
    },
  });
}

export function useDeleteLiningMark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId?: string }) => {
      // We need projectId for the URL, but it might be derived from context
      await api.delete(`${API_BASE}/backlot/continuity/lining-marks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'lining-marks'] });
    },
  });
}

// =============================================================================
// TAKES HOOKS (Enhanced for Script Supervisor)
// =============================================================================

interface TakesParams {
  projectId: string;
  sceneId?: string;
  productionDayId?: string;
}

export function useTakes(params: TakesParams) {
  return useQuery({
    queryKey: ['continuity', 'takes', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.sceneId) searchParams.set('scene_id', params.sceneId);
      if (params.productionDayId) searchParams.set('production_day_id', params.productionDayId);

      const response = await api.get(
        `${API_BASE}/backlot/projects/${params.projectId}/continuity/takes?${searchParams}`
      );
      return response.data as Take[];
    },
    enabled: !!params.projectId,
  });
}

export function useCreateTake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTakeInput) => {
      const response = await api.post(
        `${API_BASE}/backlot/projects/${input.project_id}/continuity/takes`,
        input
      );
      return response.data as Take;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'takes'] });
    },
  });
}

export function useUpdateTake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateTakeInput> & { id: string }) => {
      const response = await api.patch(
        `${API_BASE}/backlot/continuity/takes/${id}`,
        input
      );
      return response.data as Take;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'takes'] });
    },
  });
}

export function useDeleteTake() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.delete(`${API_BASE}/backlot/continuity/takes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'takes'] });
    },
  });
}

// =============================================================================
// TAKE NOTES HOOKS
// =============================================================================

interface TakeNotesParams {
  projectId: string;
  takeId?: string;
}

export function useTakeNotes(params: TakeNotesParams) {
  return useQuery({
    queryKey: ['continuity', 'take-notes', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.takeId) searchParams.set('take_id', params.takeId);

      const response = await api.get(
        `${API_BASE}/backlot/projects/${params.projectId}/continuity/take-notes?${searchParams}`
      );
      return response.data as TakeNote[];
    },
    enabled: !!params.projectId && !!params.takeId,
  });
}

export function useCreateTakeNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTakeNoteInput) => {
      const response = await api.post(
        `${API_BASE}/backlot/projects/${input.project_id}/continuity/take-notes`,
        input
      );
      return response.data as TakeNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'take-notes'] });
      queryClient.invalidateQueries({ queryKey: ['continuity', 'takes'] });
    },
  });
}

// =============================================================================
// CONTINUITY PHOTOS HOOKS
// =============================================================================

interface ContinuityPhotosParams {
  projectId: string;
  sceneId?: string;
  takeId?: string;
  category?: string;
}

export function useContinuityPhotos(params: ContinuityPhotosParams) {
  return useQuery({
    queryKey: ['continuity', 'photos', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.sceneId) searchParams.set('scene_id', params.sceneId);
      if (params.takeId) searchParams.set('take_id', params.takeId);
      if (params.category) searchParams.set('category', params.category);

      const response = await api.get(
        `${API_BASE}/backlot/projects/${params.projectId}/continuity/photos?${searchParams}`
      );
      return response.data as ContinuityPhoto[];
    },
    enabled: !!params.projectId,
  });
}

export function useUploadContinuityPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      project_id,
      scene_id,
      file,
      category,
      description,
    }: {
      project_id: string;
      scene_id?: string;
      file: File;
      category?: string;
      description?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (scene_id) formData.append('scene_id', scene_id);
      if (category) formData.append('category', category);
      if (description) formData.append('description', description);

      const response = await api.post(
        `${API_BASE}/backlot/projects/${project_id}/continuity/photos`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data as ContinuityPhoto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'photos'] });
    },
  });
}

export function useUpdateContinuityPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      category?: string;
      description?: string;
      is_favorite?: boolean;
      is_reference?: boolean;
    }) => {
      const response = await api.patch(
        `${API_BASE}/backlot/continuity/photos/${id}`,
        input
      );
      return response.data as ContinuityPhoto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'photos'] });
    },
  });
}

export function useDeleteContinuityPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.delete(`${API_BASE}/backlot/continuity/photos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'photos'] });
    },
  });
}

// =============================================================================
// CONTINUITY NOTES HOOKS (Scene-level notes)
// =============================================================================

interface ContinuityNotesParams {
  projectId: string;
  sceneId?: string;
  category?: string;
}

export function useContinuityNotes(params: ContinuityNotesParams) {
  return useQuery({
    queryKey: ['continuity', 'notes', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.sceneId) searchParams.set('scene_id', params.sceneId);
      if (params.category) searchParams.set('category', params.category);

      const response = await api.get(
        `${API_BASE}/backlot/projects/${params.projectId}/continuity/notes?${searchParams}`
      );
      return response.data as ContinuityNote[];
    },
    enabled: !!params.projectId,
  });
}

export function useCreateContinuityNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContinuityNoteInput) => {
      const response = await api.post(
        `${API_BASE}/backlot/projects/${input.project_id}/continuity/notes`,
        input
      );
      return response.data as ContinuityNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'notes'] });
    },
  });
}

export function useUpdateContinuityNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      category?: string;
      content?: string;
      is_critical?: boolean;
    }) => {
      const response = await api.patch(
        `${API_BASE}/backlot/continuity/notes/${id}`,
        input
      );
      return response.data as ContinuityNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'notes'] });
    },
  });
}

export function useDeleteContinuityNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      await api.delete(`${API_BASE}/backlot/continuity/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity', 'notes'] });
    },
  });
}
