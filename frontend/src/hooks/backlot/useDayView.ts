/**
 * useDayView - Hook for Day View aggregation
 * Provides production day list and day overview data from the Day View API
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Types
export interface DayListItem {
  id: string;
  day_number: number;
  date: string;
  title: string | null;
  location_name: string | null;
  general_call_time: string | null;
  is_completed: boolean;
  has_call_sheet: boolean;
  has_dailies: boolean;
  task_count: number;
  crew_scheduled_count: number;
}

export interface DayMetadata {
  id: string;
  project_id: string;
  day_number: number;
  date: string;
  title: string | null;
  description: string | null;
  general_call_time: string | null;
  wrap_time: string | null;
  location_id: string | null;
  location_name: string | null;
  location_address: string | null;
  is_completed: boolean;
  notes: string | null;
  weather_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CallSheetSummary {
  id: string;
  title: string;
  date: string;
  general_call_time: string | null;
  location_name: string | null;
  is_published: boolean;
  crew_count: number;
  cast_count: number;
  scene_count: number;
}

export interface DailyBudgetSummary {
  id: string;
  total_planned: number;
  total_actual: number;
  variance: number;
  item_count: number;
}

export interface DailiesDaySummary {
  id: string;
  shoot_date: string;
  label: string | null;
  card_count: number;
  clip_count: number;
  circle_take_count: number;
  total_duration_minutes: number;
}

export interface TravelItemSummary {
  id: string;
  person_name: string;
  travel_type: string;
  details: string | null;
  status: string | null;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  assigned_to_name: string | null;
  task_list_name: string | null;
}

export interface UpdateSummary {
  id: string;
  title: string | null;
  content: string;
  update_type: string;
  author_name: string | null;
  created_at: string;
}

export interface TimecardEntrySummary {
  id: string;
  user_id: string;
  user_name: string | null;
  call_time: string | null;
  wrap_time: string | null;
  hours_worked: number | null;
  status: string;
}

export interface SceneScheduled {
  id: string;
  scene_number: string | null;
  slugline: string | null;
  page_length: number | null;
}

export interface CrewSummary {
  total_crew: number;
  total_cast: number;
  departments: Record<string, number>;
}

export interface DayOverview {
  day: DayMetadata;
  call_sheets: CallSheetSummary[];
  daily_budget: DailyBudgetSummary | null;
  dailies: DailiesDaySummary | null;
  travel_items: TravelItemSummary[];
  tasks: TaskSummary[];
  updates: UpdateSummary[];
  timecard_entries: TimecardEntrySummary[];
  scenes_scheduled: SceneScheduled[];
  crew_summary: CrewSummary;
}

interface DaysListParams {
  startDate?: string;
  endDate?: string;
}

/**
 * Get list of production days for a project
 */
export function useDaysList(projectId: string | null, params?: DaysListParams) {
  return useQuery({
    queryKey: ['backlot', 'days', projectId, params],
    queryFn: async () => {
      if (!projectId) return [];
      const queryParams = new URLSearchParams();
      if (params?.startDate) queryParams.append('start_date', params.startDate);
      if (params?.endDate) queryParams.append('end_date', params.endDate);
      const queryString = queryParams.toString();
      const url = `/api/v1/backlot/projects/${projectId}/days${queryString ? `?${queryString}` : ''}`;
      return apiClient.get<DayListItem[]>(url);
    },
    enabled: !!projectId,
  });
}

/**
 * Get comprehensive overview of a single production day
 */
export function useDayOverview(projectId: string | null, dayId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'days', projectId, dayId, 'overview'],
    queryFn: async () => {
      if (!projectId || !dayId) return null;
      return apiClient.get<DayOverview>(`/api/v1/backlot/projects/${projectId}/days/${dayId}/overview`);
    },
    enabled: !!projectId && !!dayId,
  });
}

// Helpers
export function formatCallTime(time: string | null): string {
  if (!time) return '--';
  try {
    const date = new Date(time);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return time;
  }
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function getDayStatus(day: DayListItem): { label: string; color: string } {
  if (day.is_completed) {
    return { label: 'Wrapped', color: 'bg-green-500/20 text-green-400' };
  }
  if (day.has_call_sheet) {
    return { label: 'Scheduled', color: 'bg-blue-500/20 text-blue-400' };
  }
  return { label: 'Planning', color: 'bg-muted-gray/20 text-muted-gray' };
}
