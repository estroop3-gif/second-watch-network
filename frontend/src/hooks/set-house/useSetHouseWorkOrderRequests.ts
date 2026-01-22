/**
 * Set House Work Order Requests Hook
 * Incoming booking requests from cart checkout
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseWorkOrderRequest,
  WorkOrderRequestsResponse,
  WorkOrderRequestCounts,
  WorkOrderRequestStatus,
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

export interface UseSetHouseWorkOrderRequestsOptions {
  status?: WorkOrderRequestStatus;
  limit?: number;
  offset?: number;
}

/**
 * Hook to get incoming work order requests for a Set House org
 */
export function useSetHouseWorkOrderRequests(orgId: string | null, options?: UseSetHouseWorkOrderRequestsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/work-order-requests/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-work-order-requests', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      requests: data.requests as SetHouseWorkOrderRequest[],
      total: data.total as number,
    }),
  });

  const approveRequest = useMutation({
    mutationFn: (requestId: string) =>
      fetchWithAuth(`/api/v1/set-house/work-order-requests/${orgId}/${requestId}/approve`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-requests', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-request-counts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-orders', orgId] });
    },
  });

  const rejectRequest = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      fetchWithAuth(`/api/v1/set-house/work-order-requests/${orgId}/${requestId}/reject`, token!, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-requests', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-request-counts', orgId] });
    },
  });

  return {
    requests: query.data?.requests ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    approveRequest,
    rejectRequest,
  };
}

/**
 * Hook to get a single work order request with items
 */
export function useSetHouseWorkOrderRequest(orgId: string | null, requestId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-work-order-request', orgId, requestId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/work-order-requests/${orgId}/${requestId}`, token!),
    enabled: !!token && !!orgId && !!requestId,
    select: (data) => data.request as SetHouseWorkOrderRequest,
  });
}

/**
 * Hook to get work order request counts by status
 */
export function useSetHouseWorkOrderRequestCounts(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-work-order-request-counts', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/work-order-requests/${orgId}/counts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.counts as WorkOrderRequestCounts,
  });
}

/**
 * Hook to get the user's own outgoing requests (across all Set Houses)
 */
export function useMySetHouseRequests(options?: { status?: WorkOrderRequestStatus; limit?: number; offset?: number }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/work-order-requests/my-requests${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['set-house-my-requests', options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token,
    select: (data) => ({
      requests: data.requests as SetHouseWorkOrderRequest[],
      total: data.total as number,
    }),
  });
}
