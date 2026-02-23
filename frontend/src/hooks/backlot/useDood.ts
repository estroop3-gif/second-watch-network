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
  source_type: string | null;
  source_id: string | null;
  rate_type: 'hourly' | 'daily' | 'weekly' | 'flat' | null;
  rate_amount: number | null;
  created_at?: string;
}

// Types for available subjects from Cast/Crew/Contacts/Team
export interface AvailableCastMember {
  id: string;
  character_name: string | null;
  actor_name: string | null;
  profile_id: string | null;
  already_added: boolean;
}

export interface AvailableCrewMember {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  profile_id: string | null;
  already_added: boolean;
}

export interface AvailableContact {
  id: string;
  name: string;
  role_interest: string | null;
  contact_type: string | null;
  company: string | null;
  already_added: boolean;
}

export interface AvailableTeamMember {
  id: string;
  user_id: string;
  production_role: string | null;
  department: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    display_name: string | null;
  } | null;
  already_added: boolean;
}

export interface AvailableSubjectsData {
  cast: AvailableCastMember[];
  crew: AvailableCrewMember[];
  contacts: AvailableContact[];
  team: AvailableTeamMember[];
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
  availableSubjects: (projectId: string) =>
    [...doodKeys.all, 'available-subjects', projectId] as const,
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
 * Sync days from the Schedule tab (fetches existing production days)
 */
export function useSyncDoodDaysFromSchedule(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/dood/days/generate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
    },
  });
}

// Legacy alias for backwards compatibility
export const useGenerateDoodDays = useSyncDoodDaysFromSchedule;

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
      source_type?: string;  // cast_member, crew_member, contact, team_member
      source_id?: string;    // ID from source table
      rate_type?: 'hourly' | 'daily' | 'weekly' | 'flat';
      rate_amount?: number;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/dood/subjects`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: doodKeys.all });
      // Also invalidate available subjects since the added person will be marked
      queryClient.invalidateQueries({ queryKey: doodKeys.availableSubjects(projectId || '') });
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
        rate_type: 'hourly' | 'daily' | 'weekly' | 'flat' | '';
        rate_amount: number | null;
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
 * Fetch available subjects from Cast, Crew, Contacts, and Team
 * for adding to the DOOD
 */
export function useAvailableDoodSubjects(projectId: string | null) {
  return useQuery({
    queryKey: doodKeys.availableSubjects(projectId || ''),
    queryFn: async (): Promise<AvailableSubjectsData> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(
        `/api/v1/backlot/projects/${projectId}/dood/available-subjects`
      );
      return response as AvailableSubjectsData;
    },
    enabled: !!projectId,
    staleTime: 30000,
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
 * Build export PDF URL
 */
export function getDoodPdfExportUrl(projectId: string, start: string, end: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}/api/v1/backlot/projects/${projectId}/dood/export.pdf?start=${start}&end=${end}`;
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


// =====================================================
// DOOD → BUDGET INTEGRATION
// =====================================================

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

function getAuthToken(): string {
  const token = api.getToken();
  if (!token) throw new Error('Not authenticated');
  return token;
}

/**
 * Get DOOD cost summary (per-subject cost projection)
 */
export function useDoodCostSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['dood-cost-summary', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/dood/cost-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch DOOD cost summary');
      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Sync all DOOD subjects to the Active Estimate budget
 */
export function useSyncDoodToBudget(projectId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/dood/sync-to-budget`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to sync DOOD to budget');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dood-cost-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-typed-budgets', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-summary', projectId] });
    },
  });
}
