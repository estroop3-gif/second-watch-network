/**
 * useDirectorySearch - Hook for searching the site-wide user directory
 * Used by the Backlot "Add from Network" modal to find users to add to projects
 */
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { CommunityProfile } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface DirectoryUser {
  profile_id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

export interface DirectorySearchResponse {
  users: DirectoryUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface DirectorySearchOptions {
  q?: string;
  limit?: number;
  excludeProjectId?: string;
}

export interface ProjectMembershipResponse {
  is_member: boolean;
  role: string | null;
  production_role?: string | null;
  message: string;
}

/**
 * Convert DirectoryUser to CommunityProfile format for PersonCard compatibility
 */
export function toProfileFormat(user: DirectoryUser): CommunityProfile {
  return {
    profile_id: user.profile_id,
    username: user.username,
    full_name: user.full_name,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: user.created_at || '',
    updated_at: '',
  };
}

/**
 * Hook for infinite scroll directory search
 */
export function useDirectorySearch(options: DirectorySearchOptions = {}) {
  const { session } = useAuth();
  const limit = options.limit || 20;

  return useInfiniteQuery({
    queryKey: ['directory', 'users', options.q, options.excludeProjectId],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams();
      if (options.q) params.set('q', options.q);
      params.set('limit', String(limit));
      params.set('offset', String(pageParam));
      if (options.excludeProjectId) {
        params.set('exclude_project', options.excludeProjectId);
      }

      const response = await fetch(
        `${API_BASE}/api/v1/directory/users?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Search failed' }));
        throw new Error(error.detail || 'Search failed');
      }

      return response.json() as Promise<DirectorySearchResponse>;
    },
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      if (nextOffset < lastPage.total) {
        return nextOffset;
      }
      return undefined;
    },
    initialPageParam: 0,
    enabled: !!session?.access_token,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook for checking if a user is a member of a project
 */
export function useProjectMembershipCheck() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      userId,
      projectId,
    }: {
      userId: string;
      projectId: string;
    }): Promise<ProjectMembershipResponse> => {
      const params = new URLSearchParams({ project_id: projectId });
      const response = await fetch(
        `${API_BASE}/api/v1/directory/users/${userId}/project-membership?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Check failed' }));
        throw new Error(error.detail || 'Membership check failed');
      }

      return response.json();
    },
  });
}

/**
 * Simple search hook for quick lookups without infinite scroll
 */
export function useDirectorySearchSimple(
  query: string,
  options: { excludeProjectId?: string; enabled?: boolean } = {}
) {
  const { session } = useAuth();

  return useInfiniteQuery({
    queryKey: ['directory', 'users-simple', query, options.excludeProjectId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('limit', '50');
      params.set('offset', '0');
      if (options.excludeProjectId) {
        params.set('exclude_project', options.excludeProjectId);
      }

      const response = await fetch(
        `${API_BASE}/api/v1/directory/users?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Search failed' }));
        throw new Error(error.detail || 'Search failed');
      }

      return response.json() as Promise<DirectorySearchResponse>;
    },
    getNextPageParam: () => undefined,
    initialPageParam: 0,
    enabled: (options.enabled ?? true) && !!session?.access_token && query.length >= 2,
    staleTime: 30000,
  });
}
