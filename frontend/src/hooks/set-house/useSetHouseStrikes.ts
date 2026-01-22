/**
 * Set House Strikes Hook
 * User accountability and strike management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseStrike,
  UserStrikeSummary,
  CreateStrikeInput,
  StrikeSeverity,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      if (errorText) errorDetail += ` - ${errorText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export interface UseSetHouseStrikesOptions {
  userId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

export function useSetHouseStrikes(orgId: string | null, options?: UseSetHouseStrikesOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.userId) queryParams.append('user_id', options.userId);
  if (options?.isActive !== undefined) queryParams.append('is_active', options.isActive.toString());
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/strikes/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-strikes', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      strikes: data.strikes as SetHouseStrike[],
      total: data.total as number,
    }),
  });

  const createStrike = useMutation({
    mutationFn: (input: CreateStrikeInput) =>
      fetchWithAuth(`/api/v1/set-house/strikes/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-strikes', orgId] });
    },
  });

  return {
    strikes: query.data?.strikes ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createStrike,
  };
}

export function useSetHouseStrike(orgId: string | null, strikeId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-strike', orgId, strikeId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/strikes/${orgId}/${strikeId}`, token!),
    enabled: !!token && !!orgId && !!strikeId,
    select: (data) => data.strike as SetHouseStrike,
  });

  const reviewStrike = useMutation({
    mutationFn: (input: { review_notes?: string; void?: boolean; void_reason?: string }) =>
      fetchWithAuth(`/api/v1/set-house/strikes/${orgId}/${strikeId}/review`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-strike', orgId, strikeId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-strikes', orgId] });
    },
  });

  return {
    strike: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    reviewStrike,
  };
}

export function useSetHouseUserStrikes(orgId: string | null, userId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-user-strikes', orgId, userId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/strikes/${orgId}/user/${userId}`, token!),
    enabled: !!token && !!orgId && !!userId,
    select: (data) => ({
      user: data.user as { display_name: string; avatar_url?: string; email?: string },
      strikes: data.strikes as SetHouseStrike[],
      summary: data.summary as {
        total_strikes: number;
        active_strikes: number;
        total_points: number;
      },
    }),
  });
}

export function useSetHouseUsersWithStrikes(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-users-with-strikes', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/strikes/${orgId}/users-with-strikes`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.users as UserStrikeSummary[],
  });
}
