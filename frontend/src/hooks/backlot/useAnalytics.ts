/**
 * Producer Analytics Hooks (READ-ONLY)
 * React Query hooks for fetching analytics data - no mutations
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CostByDepartmentAnalytics,
  TimeScheduleAnalytics,
  UtilizationAnalytics,
  AnalyticsOverview,
} from '@/types/backlot';

// =====================================================
// ANALYTICS HOOKS (READ-ONLY)
// =====================================================

/**
 * Get cost by department analytics
 * READ-ONLY: Reads from budget categories and line items
 */
export function useCostByDepartmentAnalytics(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'analytics', 'cost-by-department', projectId],
    queryFn: async (): Promise<CostByDepartmentAnalytics | null> => {
      if (!projectId) return null;
      return api.get<CostByDepartmentAnalytics>(`/api/backlot/projects/${projectId}/analytics/cost-by-department`);
    },
    enabled: !!projectId,
    staleTime: 60000, // 1 minute - analytics can be slightly stale
  });
}

/**
 * Get time and schedule analytics
 * READ-ONLY: Reads from scenes, call sheets, and production days
 */
export function useTimeScheduleAnalytics(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'analytics', 'time-schedule', projectId],
    queryFn: async (): Promise<TimeScheduleAnalytics | null> => {
      if (!projectId) return null;
      return api.get<TimeScheduleAnalytics>(`/api/backlot/projects/${projectId}/analytics/time-and-schedule`);
    },
    enabled: !!projectId,
    staleTime: 60000,
  });
}

/**
 * Get utilization analytics
 * READ-ONLY: Reads from production days, call sheets, locations, and bookings
 */
export function useUtilizationAnalytics(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'analytics', 'utilization', projectId],
    queryFn: async (): Promise<UtilizationAnalytics | null> => {
      if (!projectId) return null;
      return api.get<UtilizationAnalytics>(`/api/backlot/projects/${projectId}/analytics/utilization`);
    },
    enabled: !!projectId,
    staleTime: 60000,
  });
}

/**
 * Get analytics overview (combined summary)
 * READ-ONLY: Aggregates key metrics from cost, schedule, and utilization
 */
export function useAnalyticsOverview(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'analytics', 'overview', projectId],
    queryFn: async (): Promise<AnalyticsOverview | null> => {
      if (!projectId) return null;
      return api.get<AnalyticsOverview>(`/api/backlot/projects/${projectId}/analytics/overview`);
    },
    enabled: !!projectId,
    staleTime: 60000,
  });
}
