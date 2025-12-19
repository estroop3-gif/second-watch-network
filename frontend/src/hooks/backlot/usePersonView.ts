/**
 * usePersonView - Hook for Person View aggregation
 * Provides crew member list and person overview data from the Person View API
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Types
export interface PersonListItem {
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  primary_role: string | null;
  department: string | null;
  days_scheduled: number;
  task_count: number;
  has_pending_timecard: boolean;
}

export interface PersonIdentity {
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone: string | null;
}

export interface PersonRole {
  id: string;
  backlot_role: string;
  is_primary: boolean;
  department: string | null;
  production_role: string | null;
}

export interface ScheduledDay {
  day_id: string;
  date: string;
  day_number: number;
  call_time: string | null;
  location_name: string | null;
  is_completed: boolean;
}

export interface TimecardSummary {
  id: string;
  week_start_date: string;
  status: string;
  total_hours: number;
  total_overtime: number;
  entry_count: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  task_list_name: string | null;
}

export interface CreditInfo {
  role: string;
  department: string | null;
  credit_order: number | null;
}

export interface PersonStats {
  days_scheduled: number;
  days_completed: number;
  total_hours_logged: number;
  total_overtime_hours: number;
  pending_tasks: number;
  completed_tasks: number;
  timecards_pending: number;
}

export interface PersonOverview {
  identity: PersonIdentity;
  roles: PersonRole[];
  schedule: ScheduledDay[];
  timecards: TimecardSummary[];
  tasks: TaskSummary[];
  credit: CreditInfo | null;
  stats: PersonStats;
}

interface PeopleListParams {
  department?: string;
  role?: string;
  search?: string;
}

/**
 * Get list of people on a project
 */
export function usePeopleList(projectId: string | null, params?: PeopleListParams) {
  return useQuery({
    queryKey: ['backlot', 'people', projectId, params],
    queryFn: async () => {
      if (!projectId) return [];
      const queryParams = new URLSearchParams();
      if (params?.department) queryParams.append('department', params.department);
      if (params?.role) queryParams.append('role', params.role);
      if (params?.search) queryParams.append('search', params.search);
      const queryString = queryParams.toString();
      const url = `/api/v1/backlot/projects/${projectId}/people/team-list${queryString ? `?${queryString}` : ''}`;
      return apiClient.get<PersonListItem[]>(url);
    },
    enabled: !!projectId,
  });
}

/**
 * Get comprehensive overview of a person within a project
 */
export function usePersonOverview(projectId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'people', projectId, userId, 'overview'],
    queryFn: async () => {
      if (!projectId || !userId) return null;
      return apiClient.get<PersonOverview>(`/api/v1/backlot/projects/${projectId}/people/${userId}/overview`);
    },
    enabled: !!projectId && !!userId,
  });
}

/**
 * Get current user's person overview for a project
 */
export function useMyPersonOverview(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'people', projectId, 'me', 'overview'],
    queryFn: async () => {
      if (!projectId) return null;
      return apiClient.get<PersonOverview>(`/api/v1/backlot/projects/${projectId}/people/me/overview`);
    },
    enabled: !!projectId,
  });
}

// Role label mapping
export const BACKLOT_ROLE_LABELS: Record<string, string> = {
  showrunner: 'Showrunner',
  producer: 'Producer',
  director: 'Director',
  first_ad: '1st AD',
  dp: 'DP',
  editor: 'Editor',
  department_head: 'Dept Head',
  crew: 'Crew',
};

export function getRoleLabel(role: string | null): string {
  if (!role) return 'Crew';
  return BACKLOT_ROLE_LABELS[role] || role;
}

// Timecard status helpers
export function getTimecardStatusColor(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-muted-gray/20 text-muted-gray';
    case 'submitted':
      return 'bg-blue-500/20 text-blue-400';
    case 'approved':
      return 'bg-green-500/20 text-green-400';
    case 'rejected':
      return 'bg-red-500/20 text-red-400';
    default:
      return 'bg-muted-gray/20 text-muted-gray';
  }
}

export function getTimecardStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return 'Submitted';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}
