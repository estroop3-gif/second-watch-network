/**
 * Friends Activity Hook
 * Fetches activity feed from connected users (friends)
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export type FriendActivityType = 'watchlist_add' | 'rating' | 'watched';

export interface FriendActivity {
  type: FriendActivityType;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  world_id: string;
  world_title: string;
  world_slug: string;
  world_poster: string | null;
  timestamp: string;
  // Rating specific
  rating?: number;
  review?: string;
  // Watched specific
  episode_id?: string;
  progress_percent?: number;
}

export interface FriendsActivityResponse {
  activities: FriendActivity[];
  total: number;
}

/**
 * Fetch friends activity feed
 */
export function useFriendsActivity(limit: number = 10) {
  const { profile } = useAuth();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['friends-activity', userId, limit],
    queryFn: async (): Promise<FriendsActivityResponse> => {
      if (!userId) return { activities: [], total: 0 };
      return api.request<FriendsActivityResponse>(`/api/v1/connections/activity?user_id=${userId}&limit=${limit}`);
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
