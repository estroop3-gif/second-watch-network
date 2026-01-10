/**
 * useStripboard - Hook for Stripboard schedule planning
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =====================================================
// Types
// =====================================================

export interface Stripboard {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Strip {
  id: string;
  project_id: string;
  stripboard_id: string;
  script_scene_id: string | null;
  custom_title: string | null;
  unit: 'A' | 'B' | 'OTHER';
  assigned_day_id: string | null;
  sort_order: number;
  status: 'PLANNED' | 'SCHEDULED' | 'SHOT' | 'DROPPED';
  notes: string | null;
  estimated_duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  // Joined from ScriptScene
  scene_number?: number;
  slugline?: string;
  location?: string;
  time_of_day?: string;
  raw_scene_text?: string;
  characters?: string[];
}

export interface ProductionDay {
  id: string;
  project_id: string;
  day_number: number;
  date: string;
  title: string | null;
  day_type: string;
  general_call_time: string | null;
}

export interface CastMismatch {
  has_mismatch: boolean;
  needed_but_not_working: string[];
  working_but_not_needed: string[];
}

export interface DayColumn {
  day: ProductionDay;
  strips: Strip[];
  strip_count: number;
  derived_cast: string[];
  dood_work_cast: string[];
  cast_mismatch: CastMismatch;
}

export interface StripboardViewData {
  stripboard: Stripboard;
  bank_strips: Strip[];
  day_columns: DayColumn[];
}

export interface StripboardSummary {
  stripboard: Stripboard | null;
  counts: {
    total: number;
    bank: number;
    scheduled: number;
  };
}

export interface StripboardPrintData {
  project_title: string;
  stripboard: Stripboard;
  bank_strips: Strip[];
  day_columns: DayColumn[];
  generated_at: string;
}

// =====================================================
// Query Key Factory
// =====================================================

const stripboardKeys = {
  all: ['stripboard'] as const,
  active: (projectId: string) => [...stripboardKeys.all, 'active', projectId] as const,
  view: (projectId: string, stripboardId: string, start?: string, end?: string) =>
    [...stripboardKeys.all, 'view', projectId, stripboardId, start, end] as const,
  print: (projectId: string, stripboardId: string, start?: string, end?: string) =>
    [...stripboardKeys.all, 'print', projectId, stripboardId, start, end] as const,
};

// =====================================================
// Hooks: Stripboard CRUD
// =====================================================

/**
 * Get active stripboard for a project
 */
export function useActiveStripboard(projectId: string | null) {
  return useQuery({
    queryKey: stripboardKeys.active(projectId || ''),
    queryFn: async (): Promise<StripboardSummary> => {
      if (!projectId) throw new Error('Project ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/stripboard`);
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

/**
 * Create a new stripboard
 */
export function useCreateStripboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; description?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/stripboard`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripboardKeys.all });
    },
  });
}

/**
 * Update a stripboard
 */
export function useUpdateStripboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stripboardId,
      data,
    }: {
      stripboardId: string;
      data: { title?: string; description?: string; is_active?: boolean };
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripboardKeys.all });
    },
  });
}

// =====================================================
// Hooks: Stripboard View
// =====================================================

/**
 * Get stripboard view with days and strips
 */
export function useStripboardView(
  projectId: string | null,
  stripboardId: string | null,
  start?: string,
  end?: string
) {
  return useQuery({
    queryKey: stripboardKeys.view(projectId || '', stripboardId || '', start, end),
    queryFn: async (): Promise<StripboardViewData> => {
      if (!projectId || !stripboardId) throw new Error('IDs required');
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      const query = params.toString();
      return api.get(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/view${query ? `?${query}` : ''}`
      );
    },
    enabled: !!projectId && !!stripboardId,
    staleTime: 30000,
  });
}

/**
 * Get stripboard print data
 */
export function useStripboardPrintData(
  projectId: string | null,
  stripboardId: string | null,
  start?: string,
  end?: string
) {
  return useQuery({
    queryKey: stripboardKeys.print(projectId || '', stripboardId || '', start, end),
    queryFn: async (): Promise<StripboardPrintData> => {
      if (!projectId || !stripboardId) throw new Error('IDs required');
      const params = new URLSearchParams();
      if (start) params.append('start', start);
      if (end) params.append('end', end);
      const query = params.toString();
      return api.get(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/print${query ? `?${query}` : ''}`
      );
    },
    enabled: !!projectId && !!stripboardId,
  });
}

// =====================================================
// Hooks: Generate Strips from Script
// =====================================================

/**
 * Generate strips from active script document
 */
export function useGenerateStripsFromScript(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stripboardId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/generate-from-script`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripboardKeys.all });
    },
  });
}

// =====================================================
// Hooks: Strip CRUD
// =====================================================

/**
 * Create a new strip (in bank)
 */
export function useCreateStrip(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stripboardId,
      data,
    }: {
      stripboardId: string;
      data: {
        script_scene_id?: string;
        custom_title?: string;
        unit?: string;
        notes?: string;
        estimated_duration_minutes?: number;
      };
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/strips`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripboardKeys.all });
    },
  });
}

/**
 * Update a strip
 */
export function useUpdateStrip(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stripboardId,
      stripId,
      data,
    }: {
      stripboardId: string;
      stripId: string;
      data: {
        assigned_day_id?: string;
        custom_title?: string;
        unit?: string;
        status?: string;
        notes?: string;
        estimated_duration_minutes?: number;
      };
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/strips/${stripId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripboardKeys.all });
    },
  });
}

/**
 * Delete a strip
 */
export function useDeleteStrip(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stripboardId,
      stripId,
    }: {
      stripboardId: string;
      stripId: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/strips/${stripId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripboardKeys.all });
    },
  });
}

/**
 * Reorder a strip (up/down)
 */
export function useReorderStrip(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      stripboardId,
      stripId,
      direction,
    }: {
      stripboardId: string;
      stripId: string;
      direction: 'UP' | 'DOWN';
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/strips/reorder`,
        { strip_id: stripId, direction }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripboardKeys.all });
    },
  });
}

// =====================================================
// Helper: Build Export URL
// =====================================================

/**
 * Build CSV export URL for stripboard
 */
export function getStripboardExportUrl(
  projectId: string,
  stripboardId: string,
  start?: string,
  end?: string
): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  const query = params.toString();
  return `${baseUrl}/api/v1/backlot/projects/${projectId}/stripboard/${stripboardId}/export.csv${query ? `?${query}` : ''}`;
}

// =====================================================
// Constants
// =====================================================

export const STRIP_UNITS = [
  { value: 'A', label: 'A Unit' },
  { value: 'B', label: 'B Unit' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const STRIP_STATUSES = [
  { value: 'PLANNED', label: 'Planned', color: 'bg-gray-500' },
  { value: 'SCHEDULED', label: 'Scheduled', color: 'bg-blue-500' },
  { value: 'SHOT', label: 'Shot', color: 'bg-green-500' },
  { value: 'DROPPED', label: 'Dropped', color: 'bg-red-500' },
] as const;
