/**
 * useUserSearch - Hook for searching users/profiles
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface UserSearchResult {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface UseUserSearchOptions {
  minLength?: number;
  limit?: number;
}

export function useUserSearch(
  query: string,
  options: UseUserSearchOptions = {}
) {
  const { minLength = 2, limit = 10 } = options;

  return useQuery({
    queryKey: ['user-search', query],
    queryFn: async (): Promise<UserSearchResult[]> => {
      if (!query || query.length < minLength) return [];

      try {
        const data = await api.searchUsers(query, limit);
        return data || [];
      } catch (error) {
        console.error('User search error:', error);
        return [];
      }
    },
    enabled: query.length >= minLength,
    staleTime: 30000, // Cache for 30 seconds
  });
}
