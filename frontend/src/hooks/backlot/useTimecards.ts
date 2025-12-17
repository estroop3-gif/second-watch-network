/**
 * useTimecards - Hook for Timecards system
 * Provides timecard CRUD, submission, and approval workflows
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Types
export interface TimecardEntry {
  id: string;
  timecard_id: string;
  project_id: string;
  shoot_date: string;
  production_day_id: string | null;
  call_time: string | null;
  wrap_time: string | null;
  break_start: string | null;
  break_end: string | null;
  meal_break_minutes: number;
  hours_worked: number | null;
  overtime_hours: number | null;
  double_time_hours: number | null;
  department: string | null;
  position: string | null;
  rate_type: string | null;
  rate_amount: number | null;
  location_name: string | null;
  is_holiday: boolean;
  is_travel_day: boolean;
  is_prep_day: boolean;
  is_wrap_day: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Timecard {
  id: string;
  project_id: string;
  user_id: string;
  week_start_date: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  submitted_by_user_id: string | null;
  approved_at: string | null;
  approved_by_user_id: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  total_hours: number;
  total_overtime: number;
  entry_count: number;
}

export interface TimecardWithEntries extends Timecard {
  entries: TimecardEntry[];
  user_name: string | null;
  user_avatar: string | null;
}

export interface TimecardListItem {
  id: string;
  week_start_date: string;
  status: string;
  total_hours: number;
  total_overtime: number;
  entry_count: number;
  user_id?: string;
  user_name?: string;
}

export interface TimecardSummary {
  total_timecards: number;
  draft_count: number;
  submitted_count: number;
  approved_count: number;
  rejected_count: number;
  total_hours: number;
  total_overtime_hours: number;
}

export interface CreateEntryData {
  shoot_date: string;
  call_time?: string | null;
  wrap_time?: string | null;
  break_start?: string | null;
  break_end?: string | null;
  meal_break_minutes?: number | null;
  hours_worked?: number | null;
  overtime_hours?: number | null;
  double_time_hours?: number | null;
  department?: string | null;
  position?: string | null;
  rate_type?: string | null;
  rate_amount?: number | null;
  location_name?: string | null;
  is_holiday?: boolean;
  is_travel_day?: boolean;
  is_prep_day?: boolean;
  is_wrap_day?: boolean;
  notes?: string | null;
}

// Queries

/**
 * Get current user's timecards for a project
 */
export function useMyTimecards(projectId: string | null, status?: string) {
  return useQuery({
    queryKey: ['backlot', 'timecards', projectId, 'me', status],
    queryFn: async () => {
      if (!projectId) return [];
      const params = status ? `?status=${status}` : '';
      return apiClient.get<TimecardListItem[]>(`/api/v1/backlot/projects/${projectId}/timecards/me${params}`);
    },
    enabled: !!projectId,
  });
}

/**
 * Get timecards for review (managers only)
 */
export function useTimecardsForReview(projectId: string | null, status?: string, department?: string) {
  return useQuery({
    queryKey: ['backlot', 'timecards', projectId, 'review', status, department],
    queryFn: async () => {
      if (!projectId) return [];
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (department) params.append('department', department);
      const queryString = params.toString();
      return apiClient.get<TimecardListItem[]>(
        `/api/v1/backlot/projects/${projectId}/timecards/review${queryString ? `?${queryString}` : ''}`
      );
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single timecard with entries
 */
export function useTimecard(projectId: string | null, timecardId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'timecards', projectId, timecardId],
    queryFn: async () => {
      if (!projectId || !timecardId) return null;
      return apiClient.get<TimecardWithEntries>(`/api/v1/backlot/projects/${projectId}/timecards/${timecardId}`);
    },
    enabled: !!projectId && !!timecardId,
  });
}

/**
 * Get timecard summary statistics
 */
export function useTimecardSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'timecards', projectId, 'summary'],
    queryFn: async () => {
      if (!projectId) return null;
      return apiClient.get<TimecardSummary>(`/api/v1/backlot/projects/${projectId}/timecards/summary`);
    },
    enabled: !!projectId,
  });
}

// Mutations

/**
 * Create or get a timecard for a week
 */
export function useCreateTimecard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (weekStartDate: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<Timecard>(`/api/v1/backlot/projects/${projectId}/timecards`, {
        week_start_date: weekStartDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId] });
    },
  });
}

/**
 * Create or update a timecard entry
 */
export function useUpsertTimecardEntry(projectId: string | null, timecardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateEntryData) => {
      if (!projectId || !timecardId) throw new Error('Project and timecard ID required');
      return apiClient.post<TimecardEntry>(
        `/api/v1/backlot/projects/${projectId}/timecards/${timecardId}/entries`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, timecardId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'me'] });
    },
  });
}

/**
 * Delete a timecard entry
 */
export function useDeleteTimecardEntry(projectId: string | null, timecardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!projectId || !timecardId) throw new Error('Project and timecard ID required');
      return apiClient.delete(`/api/v1/backlot/projects/${projectId}/timecards/${timecardId}/entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, timecardId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'me'] });
    },
  });
}

/**
 * Submit a timecard for approval
 */
export function useSubmitTimecard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timecardId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/timecards/${timecardId}/submit`);
    },
    onSuccess: (_, timecardId) => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, timecardId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'me'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'review'] });
    },
  });
}

/**
 * Approve a timecard
 */
export function useApproveTimecard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timecardId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/timecards/${timecardId}/approve`);
    },
    onSuccess: (_, timecardId) => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, timecardId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'review'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'summary'] });
    },
  });
}

/**
 * Reject a timecard
 */
export function useRejectTimecard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ timecardId, reason }: { timecardId: string; reason?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/timecards/${timecardId}/reject`, { reason });
    },
    onSuccess: (_, { timecardId }) => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, timecardId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'review'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId, 'summary'] });
    },
  });
}

// Helpers

export function getWeekStartDate(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function getWeekDates(weekStartDate: string): string[] {
  const start = new Date(weekStartDate + 'T00:00:00');
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function formatWeekRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + 'T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

export function calculateHoursFromTimes(
  callTime: string | null,
  wrapTime: string | null,
  mealBreakMinutes: number = 0
): number | null {
  if (!callTime || !wrapTime) return null;

  try {
    const call = new Date(callTime);
    const wrap = new Date(wrapTime);
    const totalMinutes = (wrap.getTime() - call.getTime()) / (1000 * 60) - mealBreakMinutes;
    return Math.round(totalMinutes / 60 * 100) / 100;
  } catch {
    return null;
  }
}

export const TIMECARD_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
  submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
} as const;

export const RATE_TYPES = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'flat', label: 'Flat Rate' },
] as const;
