/**
 * useCreatorUpdates
 * Hook for fetching announcements from followed worlds
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface CreatorUpdate {
  id: string;
  title: string;
  content: string | null;
  announcement_type: 'bts' | 'announcement' | 'milestone' | 'poll';
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  world_id: string;
  world_title: string;
  world_slug: string;
  world_thumbnail: string | null;
  creator_id: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
}

export interface CreatorUpdatesResponse {
  updates: CreatorUpdate[];
  count: number;
}

export function useCreatorUpdates(limit: number = 10, includeTypes?: string) {
  const { user, profile } = useAuth();
  const userId = profile?.id;

  return useQuery<CreatorUpdatesResponse>({
    queryKey: ['creator-updates', userId, limit, includeTypes],
    queryFn: async () => {
      const params = new URLSearchParams({
        user_id: userId!,
        limit: limit.toString(),
      });
      if (includeTypes) {
        params.append('include_types', includeTypes);
      }
      const response = await api.get(`/api/v1/engagement/followed-updates?${params}`);
      return response;
    },
    enabled: !!user && !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

export default useCreatorUpdates;
