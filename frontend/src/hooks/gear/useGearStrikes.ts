/**
 * Gear House Strike Hooks
 * Data fetching and mutations for user strikes management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  GearStrike,
  GearUserEscalationStatus,
  UserStrikeSummary,
  CreateStrikeInput,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Gear Strikes API] ${options?.method || 'GET'} ${fullUrl}`);

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(errorData.detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// USER LIST HOOKS
// ============================================================================

export interface UseUsersWithStrikesOptions {
  orgId: string | null;
  includeClear?: boolean;
  escalatedOnly?: boolean;
}

/**
 * Fetch users with their strike summaries
 */
export function useUsersWithStrikes(options: UseUsersWithStrikesOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { orgId, includeClear = false, escalatedOnly = false } = options;

  return useQuery({
    queryKey: ['gear-users-with-strikes', { orgId, includeClear, escalatedOnly }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('include_clear', includeClear.toString());
      params.set('escalated_only', escalatedOnly.toString());

      return fetchWithAuth(`/api/v1/gear/strikes/${orgId}/users?${params}`, token!);
    },
    enabled: !!token && !!orgId,
    select: (data) => data.users as UserStrikeSummary[],
  });
}

// ============================================================================
// USER DETAIL HOOKS
// ============================================================================

/**
 * Fetch strikes for a specific user
 */
export function useUserStrikes(orgId: string | null, userId: string | null, activeOnly = false) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-user-strikes', orgId, userId, activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('active_only', activeOnly.toString());
      return fetchWithAuth(`/api/v1/gear/strikes/user/${orgId}/${userId}?${params}`, token!);
    },
    enabled: !!token && !!orgId && !!userId,
    select: (data) => data.strikes as GearStrike[],
  });
}

/**
 * Fetch user's escalation status
 */
export function useUserEscalationStatus(orgId: string | null, userId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-escalation-status', orgId, userId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/strikes/escalation/${orgId}/${userId}`, token!),
    enabled: !!token && !!orgId && !!userId,
    select: (data) => data.status as GearUserEscalationStatus,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Create a new strike
 */
export function useCreateStrike(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStrikeInput) =>
      fetchWithAuth(`/api/v1/gear/strikes/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-user-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-users-with-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-escalation-status'] });
      queryClient.invalidateQueries({ queryKey: ['gear-pending-reviews'] });
    },
  });
}

/**
 * Void a strike
 */
export function useVoidStrike() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ strikeId, reason }: { strikeId: string; reason: string }) =>
      fetchWithAuth(`/api/v1/gear/strikes/item/${strikeId}/void`, token!, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-user-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-users-with-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-escalation-status'] });
      queryClient.invalidateQueries({ queryKey: ['gear-pending-reviews'] });
    },
  });
}

/**
 * Review an escalation (approve, probation, suspend)
 */
export function useReviewEscalation(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      decision,
      notes,
    }: {
      userId: string;
      decision: 'approved' | 'probation' | 'suspended';
      notes?: string;
    }) =>
      fetchWithAuth(`/api/v1/gear/strikes/escalation/${orgId}/${userId}/review`, token!, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-users-with-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-escalation-status'] });
      queryClient.invalidateQueries({ queryKey: ['gear-pending-reviews'] });
    },
  });
}
