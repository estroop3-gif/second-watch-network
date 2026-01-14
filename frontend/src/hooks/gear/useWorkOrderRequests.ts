/**
 * Work Order Requests Hooks
 * Data fetching and mutations for work order request system
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  GearWorkOrderRequest,
  WorkOrderRequestsResponse,
  WorkOrderRequestCounts,
  WorkOrderRequestStatus,
  RejectRequestInput,
  ApproveRequestResponse,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[WorkOrderRequests API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[WorkOrderRequests API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[WorkOrderRequests API] Response:`, data);
  return data;
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================================
// INCOMING REQUESTS HOOKS (FOR GEAR HOUSE OWNERS)
// ============================================================================

export interface UseIncomingRequestsOptions {
  status?: WorkOrderRequestStatus;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

/**
 * Fetch incoming work order requests for a gear house.
 * Used by gear house owners to see requests from renters.
 */
export function useIncomingWorkOrderRequests(
  orgId: string,
  options?: UseIncomingRequestsOptions
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString({
    status: options?.status,
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
  });

  const query = useQuery({
    queryKey: ['work-order-requests', 'incoming', orgId, options],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/work-order-requests/incoming/${orgId}${queryString}`, token!),
    enabled: !!token && !!orgId && (options?.enabled ?? true),
    select: (data) => data as WorkOrderRequestsResponse,
  });

  return {
    requests: query.data?.requests ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Fetch counts of incoming requests by status for badge display.
 */
export function useIncomingRequestCounts(orgId: string) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['work-order-requests', 'counts', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/work-order-requests/incoming/${orgId}/counts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data as WorkOrderRequestCounts,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    counts: query.data ?? { pending: 0, approved: 0, rejected: 0, total: 0 },
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// OUTGOING REQUESTS HOOKS (FOR RENTERS)
// ============================================================================

export interface UseOutgoingRequestsOptions {
  status?: WorkOrderRequestStatus;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

/**
 * Fetch outgoing work order requests for the current user.
 * Used by renters to see their submitted requests.
 */
export function useOutgoingWorkOrderRequests(options?: UseOutgoingRequestsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString({
    status: options?.status,
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
  });

  const query = useQuery({
    queryKey: ['work-order-requests', 'outgoing', options],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/work-order-requests/outgoing${queryString}`, token!),
    enabled: !!token && (options?.enabled ?? true),
    select: (data) => data as { requests: GearWorkOrderRequest[] },
  });

  return {
    requests: query.data?.requests ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// SINGLE REQUEST HOOK
// ============================================================================

/**
 * Fetch a single work order request with full details.
 */
export function useWorkOrderRequest(requestId: string) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['work-order-requests', requestId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/work-order-requests/${requestId}`, token!),
    enabled: !!token && !!requestId,
    select: (data) => data as GearWorkOrderRequest,
  });

  return {
    request: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Approve a work order request.
 * Creates a draft work order and notifies the requester.
 */
export function useApproveWorkOrderRequest() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string): Promise<ApproveRequestResponse> => {
      return fetchWithAuth(`/api/v1/gear/work-order-requests/${requestId}/approve`, token!, {
        method: 'POST',
      });
    },
    onSuccess: (_, requestId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['work-order-requests'] });
      queryClient.invalidateQueries({ queryKey: ['gear-work-orders'] });
    },
  });
}

/**
 * Reject a work order request.
 * Notifies the requester with the rejection reason.
 */
export function useRejectWorkOrderRequest() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      data,
    }: {
      requestId: string;
      data: RejectRequestInput;
    }) => {
      return fetchWithAuth(`/api/v1/gear/work-order-requests/${requestId}/reject`, token!, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order-requests'] });
    },
  });
}

// ============================================================================
// COMBINED MUTATIONS HOOK
// ============================================================================

/**
 * Combined hook for work order request mutations.
 */
export function useWorkOrderRequestMutations() {
  const approve = useApproveWorkOrderRequest();
  const reject = useRejectWorkOrderRequest();

  return {
    approve,
    reject,
    isMutating: approve.isPending || reject.isPending,
  };
}
