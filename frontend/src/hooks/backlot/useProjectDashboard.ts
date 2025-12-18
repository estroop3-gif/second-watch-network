/**
 * useProjectDashboard - Optimized hook for fetching all project dashboard data in a single request
 * This replaces multiple separate hooks (useTaskStats, useProductionDays, useLocations, etc.)
 * for better performance on the ProjectOverview component.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  review: number;
  completed: number;
}

interface ProductionDay {
  id: string;
  day_number: number;
  date: string;
  title: string | null;
  general_call_time: string | null;
  is_completed: boolean;
}

interface MemberProfile {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  production_role: string | null;
  profile?: MemberProfile;
}

interface UpdateAuthor {
  id: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface ProjectUpdate {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id: string;
  author?: UpdateAuthor;
}

interface ProjectDashboardData {
  success: boolean;
  task_stats: TaskStats;
  days: ProductionDay[];
  days_count: number;
  locations_count: number;
  members: ProjectMember[];
  members_count: number;
  updates: ProjectUpdate[];
  gear_count: number;
}

export function useProjectDashboard(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-project-dashboard', projectId],
    queryFn: async (): Promise<ProjectDashboardData | null> => {
      if (!projectId) return null;

      const response = await api.request<ProjectDashboardData>(
        `/api/v1/backlot/projects/${projectId}/dashboard`
      );

      return response;
    },
    enabled: !!projectId,
    staleTime: 10000, // Data is fresh for 10 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when tab is focused
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });
}

export type { TaskStats, ProductionDay, ProjectMember, ProjectUpdate, ProjectDashboardData };
