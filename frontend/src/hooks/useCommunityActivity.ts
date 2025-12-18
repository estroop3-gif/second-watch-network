/**
 * useCommunityActivity - Hook for fetching recent community activity
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CommunityActivity } from '@/types/community';

interface UseCommunityActivityOptions {
  limit?: number;
}

export function useCommunityActivity(options: UseCommunityActivityOptions = {}) {
  const { limit = 20 } = options;

  return useQuery({
    queryKey: ['community-activity', { limit }],
    queryFn: async () => {
      const activity = await api.getCommunityActivity(limit);
      return (activity || []) as CommunityActivity[];
    },
  });
}
