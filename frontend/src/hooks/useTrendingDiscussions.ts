/**
 * Trending Discussions Hook
 * Fetches trending community threads based on engagement
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface TrendingThread {
  id: string;
  title: string;
  topic_name: string | null;
  topic_slug: string | null;
  reply_count: number;
  view_count: number;
  created_at: string;
  user_id: string;
  user_name: string | null;
  user_avatar: string | null;
  is_hot: boolean;
}

export interface TrendingDiscussionsResponse {
  threads: TrendingThread[];
  total: number;
  timeframe: string;
}

/**
 * Fetch trending community discussions
 * @param timeframe - "24h", "7d", or "30d"
 * @param limit - Number of threads to fetch
 */
export function useTrendingDiscussions(timeframe: string = "7d", limit: number = 5) {
  return useQuery({
    queryKey: ['community-trending', timeframe, limit],
    queryFn: async (): Promise<TrendingDiscussionsResponse> => {
      return api.request<TrendingDiscussionsResponse>(
        `/api/v1/community/trending?timeframe=${timeframe}&limit=${limit}`
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
  });
}
