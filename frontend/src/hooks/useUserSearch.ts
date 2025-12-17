/**
 * useUserSearch - Hook for searching users/profiles
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url')
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit);

      if (error) {
        console.error('User search error:', error);
        return [];
      }

      return data || [];
    },
    enabled: query.length >= minLength,
    staleTime: 30000, // Cache for 30 seconds
  });
}
