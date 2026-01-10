/**
 * useDood - Hook for Day Out of Days management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Types
export interface DoodDay {
  id: string;
  date: string;
  day_number: number;
  title: string | null;
  day_type: string;
  notes: string | null;
}

export interface DoodSubject {
  id: string;
  display_name: string;
  subject_type: 'CAST' | 'BACKGROUND' | 'CREW' | 'OTHER';
  department: string | null;
  notes: string | null;
  sort_order: number;
  created_at?: string;
}

export interface DoodAssignment {
  id: string;
  subject_id: string;
  day_id: string;
  code: string;
  notes: string | null;
}

export interface DoodVersion {
  id: string;
  version_number: number;
  range_start: string;
  range_end: string;
  created_at: string;
  created_by_user_id: string;
}

export interface DoodRangeData {
  days: DoodDay[];
  subjects: DoodSubject[];
  assignments: DoodAssignment[];
  latest_published_version: DoodVersion | null;
}

export const DOOD_CODES = [
  { code: 'W', label: 'Work', color: 'bg-green-500' },
  { code: 'H', label: 'Hold', color: 'bg-yellow-500' },
  { code: 'T', label: 'Travel', color: 'bg-blue-500' },
  { code: 'R', label: 'Rehearsal', color: 'bg-purple-500' },
  { code: 'F', label: 'Fitting', color: 'bg-pink-500' },
  { code: 'S', label: 'Tech Scout', color: 'bg-orange-500' },
  { code: 'P', label: 'Pickup', color: 'bg-teal-500' },
  { code: 'O', label: 'Off', color: 'bg-gray-400' },
  { code: 'D', label: 'Drop', color: 'bg-red-500' },
] as const;

export const SUBJECT_TYPES = [
  { value: 'CAST', label: 'Cast' },
  { value: 'BACKGROUND', label: 'Background' },
  { value: 'CREW', label: 'Crew' },
  { value: 'OTHER', label: 'Other' },
] as const;

// Query key factory
const doodKeys = {
  all: ['dood'] as const,
  range: (projectId: string, start: string, end: string) =>
    [...doodKeys.all, 'range', projectId, start, end] as const,
  subjects: (projectId: string) =>
    [...doodKeys.all, 'subjects', projectId] as const,
  versions: (projectId: string) =>
    [...doodKeys.all, 'versions', projectId] as const,
};

/**
 * Fetch DOOD range data
 */
export function useDoodRange(projectId: string | null, start: string, end: string) {
  return useQuery({
    queryKey: doodKeys.range(projectId || '', start, end),
    queryFn: async (): Promise<DoodRangeData> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(
        `/api/v1/backlot/projects/${projectId}/dood/range?start=${start}&end=${end}`
      );
      return response;
    },
    enabled: !!projectId && !!start && !!end,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Generate days for a date range
 */
export function useGenerateDoodDays(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/dood/days/generate`, {
        start,
        end,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
    },
  });
}

/**
 * Create a new subject
 */
export function useCreateDoodSubject(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      display_name: string;
      subject_type: string;
      department?: string;
      notes?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/dood/subjects`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
    },
  });
}

/**
 * Update a subject
 */
export function useUpdateDoodSubject(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      subjectId,
      data,
    }: {
      subjectId: string;
      data: Partial<{
        display_name: string;
        subject_type: string;
        department: string;
        notes: string;
        sort_order: number;
      }>;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.patch(
        `/api/v1/backlot/projects/${projectId}/dood/subjects/${subjectId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
    },
  });
}

/**
 * Delete a subject
 */
export function useDeleteDoodSubject(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subjectId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(
        `/api/v1/backlot/projects/${projectId}/dood/subjects/${subjectId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
    },
  });
}

/**
 * Upsert an assignment (cell value)
 */
export function useUpsertDoodAssignment(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      subject_id: string;
      day_id: string;
      code: string | null;
      notes?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(`/api/v1/backlot/projects/${projectId}/dood/assignments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
    },
  });
}

/**
 * Publish DOOD for a date range
 */
export function usePublishDood(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ start, end }: { start: string; end: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/dood/publish`, {
        start,
        end,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
    },
  });
}

/**
 * Get list of published versions
 */
export function useDoodVersions(projectId: string | null) {
  return useQuery({
    queryKey: doodKeys.versions(projectId || ''),
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(
        `/api/v1/backlot/projects/${projectId}/dood/versions`
      );
      return response.versions as DoodVersion[];
    },
    enabled: !!projectId,
  });
}

/**
 * Build export CSV URL
 */
export function getDoodExportUrl(projectId: string, start: string, end: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}/api/v1/backlot/projects/${projectId}/dood/export.csv?start=${start}&end=${end}`;
}

/**
 * Calculate totals for a subject
 */
export function calculateSubjectTotals(
  subjectId: string,
  assignments: DoodAssignment[]
): { work: number; hold: number; travel: number; total: number } {
  const subjectAssignments = assignments.filter((a) => a.subject_id === subjectId);
  return {
    work: subjectAssignments.filter((a) => a.code === 'W').length,
    hold: subjectAssignments.filter((a) => a.code === 'H').length,
    travel: subjectAssignments.filter((a) => a.code === 'T').length,
    total: subjectAssignments.length,
  };
}

/**
 * Get code info by code letter
 */
export function getCodeInfo(code: string) {
  return DOOD_CODES.find((c) => c.code === code);
}
