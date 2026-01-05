/**
 * Dashboard Summary Hooks
 * Aggregated data for dashboard widgets showing cross-project summaries
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// SCHEDULE SUMMARY
// ============================================================================

export interface ScheduleConflict {
  date: string;
  project_ids: string[];
  project_names: string[];
}

export interface ScheduleShootDay {
  id: string;
  project_id: string;
  project_name: string;
  project_slug: string;
  day_number: number;
  date: string;
  title: string | null;
  general_call_time: string | null;
  location: string | null;
  scene_count: number;
}

export interface ScheduleSummary {
  upcoming_shoot_days: ScheduleShootDay[];
  today_shoot: ScheduleShootDay | null;
  conflicts: ScheduleConflict[];
  next_7_days_count: number;
}

/**
 * Fetch schedule summary across all user's projects
 */
export function useScheduleSummary() {
  return useQuery({
    queryKey: ['backlot-schedule-summary'],
    queryFn: async (): Promise<ScheduleSummary> => {
      return api.request<ScheduleSummary>('/api/v1/backlot/my-schedule-summary');
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

// ============================================================================
// DAILIES SUMMARY (Widget)
// ============================================================================

export interface DailiesRecentUpload {
  id: string;
  project_id: string;
  project_slug: string;
  project_name: string;
  clip_name: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  scene_id: string | null;
  scene_number: string | null;
  created_at: string;
}

export interface DailiesSummaryWidget {
  recent_uploads: DailiesRecentUpload[];
  processing_count: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  circle_takes_count: number;
}

/**
 * Fetch dailies summary across all user's projects
 */
export function useDailiesSummaryWidget() {
  return useQuery({
    queryKey: ['backlot-dailies-summary-widget'],
    queryFn: async (): Promise<DailiesSummaryWidget> => {
      return api.request<DailiesSummaryWidget>('/api/v1/backlot/my-dailies-summary');
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

// ============================================================================
// CASTING SUMMARY
// ============================================================================

export interface CastingApplication {
  id: string;
  role_id: string;
  role_name: string;
  project_id: string;
  project_slug: string;
  project_name: string;
  applicant_name: string;
  applicant_avatar: string | null;
  status: string;
  applied_at: string;
}

export interface ScheduledAudition {
  id: string;
  role_name: string;
  project_name: string;
  date: string;
  time: string;
  applicant_count: number;
}

export interface CastingSummary {
  open_roles_count: number;
  pending_applications: number;
  recent_applications: CastingApplication[];
  auditions_scheduled: ScheduledAudition[];
}

/**
 * Fetch casting summary across all user's projects
 */
export function useCastingSummary() {
  return useQuery({
    queryKey: ['backlot-casting-summary'],
    queryFn: async (): Promise<CastingSummary> => {
      return api.request<CastingSummary>('/api/v1/backlot/my-casting-summary');
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

// ============================================================================
// BUDGET SUMMARY (Widget)
// ============================================================================

export interface BudgetAlert {
  project_id: string;
  project_name: string;
  type: 'over_budget' | 'invoice_overdue' | 'expense_pending';
  message: string;
  severity: 'warning' | 'error';
}

export interface BudgetSummaryWidget {
  total_budget: number;
  total_spent: number;
  pending_invoices: number;
  pending_expenses: number;
  alerts: BudgetAlert[];
}

/**
 * Fetch budget summary across all user's projects
 */
export function useBudgetSummaryWidget() {
  return useQuery({
    queryKey: ['backlot-budget-summary-widget'],
    queryFn: async (): Promise<BudgetSummaryWidget> => {
      return api.request<BudgetSummaryWidget>('/api/v1/backlot/my-budget-summary');
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}
