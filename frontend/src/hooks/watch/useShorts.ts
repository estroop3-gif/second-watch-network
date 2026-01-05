/**
 * React Query hooks for Shorts
 */

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { shortsApi } from '@/lib/api/watch';

/**
 * Infinite scroll shorts feed
 */
export function useShortsFeed(worldId?: string) {
  return useInfiniteQuery({
    queryKey: ['shorts-feed', worldId],
    queryFn: ({ pageParam }) =>
      shortsApi.getFeed({
        cursor: pageParam,
        limit: 10,
        worldId,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Shorts from followed worlds
 */
export function useShortsFollowingFeed() {
  return useInfiniteQuery({
    queryKey: ['shorts-following'],
    queryFn: ({ pageParam }) =>
      shortsApi.getFollowingFeed(pageParam, 10),
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Trending shorts
 */
export function useShortsTrending(limit = 20) {
  return useQuery({
    queryKey: ['shorts-trending', limit],
    queryFn: () => shortsApi.getTrending(limit),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get a single short
 */
export function useShort(shortId: string | undefined) {
  return useQuery({
    queryKey: ['short', shortId],
    queryFn: () => shortsApi.getShort(shortId!),
    enabled: !!shortId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Like/unlike short
 */
export function useLikeShort() {
  const queryClient = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: (shortId: string) => shortsApi.likeShort(shortId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shorts-feed'] });
      queryClient.invalidateQueries({ queryKey: ['short'] });
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: (shortId: string) => shortsApi.unlikeShort(shortId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shorts-feed'] });
      queryClient.invalidateQueries({ queryKey: ['short'] });
    },
  });

  return {
    like: likeMutation.mutate,
    unlike: unlikeMutation.mutate,
    isLiking: likeMutation.isPending,
    isUnliking: unlikeMutation.isPending,
  };
}

/**
 * Bookmark/unbookmark short
 */
export function useBookmarkShort() {
  const queryClient = useQueryClient();

  const bookmarkMutation = useMutation({
    mutationFn: (shortId: string) => shortsApi.bookmarkShort(shortId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shorts-feed'] });
      queryClient.invalidateQueries({ queryKey: ['shorts-bookmarks'] });
    },
  });

  const unbookmarkMutation = useMutation({
    mutationFn: (shortId: string) => shortsApi.unbookmarkShort(shortId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shorts-feed'] });
      queryClient.invalidateQueries({ queryKey: ['shorts-bookmarks'] });
    },
  });

  return {
    bookmark: bookmarkMutation.mutate,
    unbookmark: unbookmarkMutation.mutate,
    isBookmarking: bookmarkMutation.isPending,
    isUnbookmarking: unbookmarkMutation.isPending,
  };
}

/**
 * Record view
 */
export function useRecordShortView() {
  return useMutation({
    mutationFn: (shortId: string) => shortsApi.recordView(shortId),
  });
}

/**
 * Get bookmarked shorts
 */
export function useShortsBookmarks() {
  return useInfiniteQuery({
    queryKey: ['shorts-bookmarks'],
    queryFn: ({ pageParam }) => shortsApi.getBookmarks(pageParam, 20),
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get liked shorts
 */
export function useShortsLiked() {
  return useInfiniteQuery({
    queryKey: ['shorts-liked'],
    queryFn: ({ pageParam }) => shortsApi.getLiked(pageParam, 20),
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 2 * 60 * 1000,
  });
}
