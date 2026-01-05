/**
 * useWatchStats
 * Hook for fetching watch statistics and streak information
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface StreakInfo {
  current: number;
  longest: number;
  last_watch_date: string | null;
  streak_started_at: string | null;
  total_watch_days: number;
}

export interface PeriodStats {
  days: number;
  total_minutes: number;
  total_episodes: number;
  total_shorts: number;
  avg_daily_minutes: number;
}

export interface CalendarDay {
  date: string;
  day_name: string;
  watched: boolean;
  minutes: number;
}

export interface DailyStats {
  stat_date: string;
  minutes_watched: number;
  episodes_watched: number;
  shorts_watched: number;
  worlds_started: number;
}

export interface WatchStatsResponse {
  streak: StreakInfo;
  period_stats: PeriodStats;
  calendar: CalendarDay[];
  daily_stats: DailyStats[];
}

export function useWatchStats(days: number = 14) {
  const { user, profile } = useAuth();
  const userId = profile?.id;

  return useQuery<WatchStatsResponse>({
    queryKey: ['watch-stats', userId, days],
    queryFn: async () => {
      const params = new URLSearchParams({
        user_id: userId!,
        days: days.toString(),
      });
      const response = await api.get(`/api/v1/engagement/watch-stats?${params}`);
      return response;
    },
    enabled: !!user && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export default useWatchStats;
