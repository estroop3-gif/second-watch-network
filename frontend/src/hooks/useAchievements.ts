/**
 * useAchievements
 * Hook for fetching user achievements and progress
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  category: 'watching' | 'streak' | 'community' | 'voting' | 'creator' | 'general';
  points: number;
  requirements: {
    type: string;
    threshold: number;
  } | null;
  is_secret: boolean;
  sort_order: number;
  progress: number | null;
  earned_at: string | null;
  is_displayed: boolean | null;
}

export interface AchievementsResponse {
  achievements: Achievement[];
  by_category: Record<string, Achievement[]>;
  total_points: number;
  earned_count: number;
  total_count: number;
}

export interface RecentAchievementsResponse {
  achievements: Pick<Achievement, 'id' | 'name' | 'description' | 'icon_url' | 'category' | 'points' | 'earned_at'>[];
}

export function useAchievements() {
  const { user, profile } = useAuth();
  const userId = profile?.id;

  return useQuery<AchievementsResponse>({
    queryKey: ['achievements', userId],
    queryFn: async () => {
      const params = new URLSearchParams({
        user_id: userId!,
      });
      const response = await api.get(`/api/v1/engagement/achievements?${params}`);
      return response;
    },
    enabled: !!user && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useRecentAchievements(limit: number = 5) {
  const { user, profile } = useAuth();
  const userId = profile?.id;

  return useQuery<RecentAchievementsResponse>({
    queryKey: ['achievements-recent', userId, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        user_id: userId!,
        limit: limit.toString(),
      });
      const response = await api.get(`/api/v1/engagement/achievements/recent?${params}`);
      return response;
    },
    enabled: !!user && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export default useAchievements;
