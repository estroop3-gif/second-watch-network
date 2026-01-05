/**
 * React Query hooks for Recommendations
 * Provides personalized content for "For You" widget
 */

import { useQuery } from '@tanstack/react-query';
import { recommendationsApi } from '@/lib/api/watch';
import { useAuth } from '@/context/AuthContext';

/**
 * Get personalized "For You" recommendations
 * Falls back to watch-free content for unauthenticated users
 */
export function useForYou(limit = 12) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['recommendations', 'for-you', limit, isAuthenticated],
    queryFn: async () => {
      if (isAuthenticated) {
        return recommendationsApi.getForYou(limit);
      }
      // Guest users get free content
      return null;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Get free content for guests (livestreams, FAST channels)
 */
export function useWatchFree(limit = 12) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['recommendations', 'watch-free', limit],
    queryFn: () => recommendationsApi.getWatchFree(limit),
    enabled: !isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes - live content changes frequently
    refetchOnWindowFocus: true,
  });
}

/**
 * Get trending content (works for both auth and unauth)
 */
export function useTrending(limit = 12, contentFormat?: string) {
  return useQuery({
    queryKey: ['recommendations', 'trending', limit, contentFormat],
    queryFn: () => recommendationsApi.getTrending(limit, contentFormat),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Combined hook that returns appropriate content based on auth state
 * For authenticated users: personalized recommendations
 * For guests: free content (livestreams, FAST channels)
 */
export function useForYouContent(limit = 12) {
  const { isAuthenticated } = useAuth();
  const forYou = useForYou(limit);
  const watchFree = useWatchFree(limit);

  if (isAuthenticated) {
    return {
      data: forYou.data,
      isLoading: forYou.isLoading,
      error: forYou.error,
      isAuthenticated: true,
      contentType: 'for-you' as const,
    };
  }

  return {
    data: watchFree.data,
    isLoading: watchFree.isLoading,
    error: watchFree.error,
    isAuthenticated: false,
    contentType: 'watch-free' as const,
  };
}
