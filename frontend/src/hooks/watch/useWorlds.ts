/**
 * React Query hooks for Worlds
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { worldsApi } from '@/lib/api/watch';
import type { WorldSearchParams, WorldWithSeasons } from '@/types/watch';

/**
 * Get all genres
 */
export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: () => worldsApi.getGenres(),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - genres rarely change
  });
}

/**
 * Search/list worlds
 */
export function useWorlds(params?: WorldSearchParams) {
  return useQuery({
    queryKey: ['worlds', params],
    queryFn: () => worldsApi.listWorlds(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single world by slug
 */
export function useWorld(slug: string | undefined) {
  return useQuery({
    queryKey: ['world', slug],
    queryFn: () => worldsApi.getWorld(slug!),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get seasons for a world
 */
export function useSeasons(worldId: string | undefined) {
  return useQuery({
    queryKey: ['seasons', worldId],
    queryFn: () => worldsApi.getSeasons(worldId!),
    enabled: !!worldId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get episodes for a season
 */
export function useEpisodes(seasonId: string | undefined) {
  return useQuery({
    queryKey: ['episodes', seasonId],
    queryFn: () => worldsApi.getEpisodes(seasonId!),
    enabled: !!seasonId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get a single episode
 */
export function useEpisode(episodeId: string | undefined) {
  return useQuery({
    queryKey: ['episode', episodeId],
    queryFn: () => worldsApi.getEpisode(episodeId!),
    enabled: !!episodeId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Follow/unfollow world mutation
 */
export function useFollowWorld() {
  const queryClient = useQueryClient();

  const followMutation = useMutation({
    mutationFn: (worldId: string) => worldsApi.followWorld(worldId),
    onSuccess: (_, worldId) => {
      queryClient.invalidateQueries({ queryKey: ['world'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
      // Optimistically update the world cache
      queryClient.setQueriesData<WorldWithSeasons>(
        { queryKey: ['world'] },
        (old) => old ? { ...old, is_following: true } : old
      );
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: (worldId: string) => worldsApi.unfollowWorld(worldId),
    onSuccess: (_, worldId) => {
      queryClient.invalidateQueries({ queryKey: ['world'] });
      queryClient.invalidateQueries({ queryKey: ['following'] });
    },
  });

  return {
    follow: followMutation.mutate,
    unfollow: unfollowMutation.mutate,
    isFollowing: followMutation.isPending,
    isUnfollowing: unfollowMutation.isPending,
  };
}

/**
 * Get followed worlds
 */
export function useFollowing(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['following', { limit, offset }],
    queryFn: () => worldsApi.getFollowing(limit, offset),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Watchlist mutations
 */
export function useWatchlist() {
  const queryClient = useQueryClient();

  const addMutation = useMutation({
    mutationFn: (worldId: string) => worldsApi.addToWatchlist(worldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['world'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (worldId: string) => worldsApi.removeFromWatchlist(worldId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['world'] });
    },
  });

  return {
    add: addMutation.mutate,
    remove: removeMutation.mutate,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

/**
 * Get watchlist
 */
export function useWatchlistItems(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ['watchlist', { limit, offset }],
    queryFn: () => worldsApi.getWatchlist(limit, offset),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get watch history
 */
export function useWatchHistory(limit = 20) {
  return useQuery({
    queryKey: ['watch-history', { limit }],
    queryFn: () => worldsApi.getWatchHistory(limit),
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Get continue watching list
 */
export function useContinueWatching(limit = 10) {
  return useQuery({
    queryKey: ['continue-watching', { limit }],
    queryFn: () => worldsApi.getContinueWatching(limit),
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * Update watch progress
 */
export function useUpdateWatchProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      episodeId,
      position,
      duration,
    }: {
      episodeId: string;
      position: number;
      duration?: number;
    }) => worldsApi.updateWatchProgress(episodeId, position, duration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
      queryClient.invalidateQueries({ queryKey: ['watch-history'] });
    },
  });
}

/**
 * Update episode
 */
export function useUpdateEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      episodeId,
      update,
    }: {
      episodeId: string;
      update: {
        title?: string;
        description?: string;
        video_asset_id?: string;
        thumbnail_url?: string;
        status?: string;
        visibility?: string;
        intro_start_seconds?: number;
        intro_end_seconds?: number;
        credits_start_seconds?: number;
      };
    }) => worldsApi.updateEpisode(episodeId, update),
    onSuccess: (_, { episodeId }) => {
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
    },
  });
}

/**
 * Attach video to episode
 */
export function useAttachVideoToEpisode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      episodeId,
      videoAssetId,
    }: {
      episodeId: string;
      videoAssetId: string;
    }) => worldsApi.attachVideoToEpisode(episodeId, videoAssetId),
    onSuccess: (_, { episodeId }) => {
      queryClient.invalidateQueries({ queryKey: ['episode', episodeId] });
      queryClient.invalidateQueries({ queryKey: ['episodes'] });
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
      queryClient.invalidateQueries({ queryKey: ['video-assets'] });
    },
  });
}
