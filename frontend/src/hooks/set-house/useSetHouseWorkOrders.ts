/**
 * Set House Work Orders Hook
 * Pre-booking staging and fulfillment
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseWorkOrder,
  SetHouseWorkOrderItem,
  SetHouseWorkOrderCounts,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrderStatus,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Set House Work Orders API] ${options?.method || 'GET'} ${fullUrl}`);

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

export interface UseSetHouseWorkOrdersOptions {
  status?: WorkOrderStatus;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

export function useSetHouseWorkOrders(orgId: string | null, options?: UseSetHouseWorkOrdersOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.assignedTo) queryParams.append('assigned_to', options.assignedTo);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/work-orders/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-work-orders', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      workOrders: data.work_orders as SetHouseWorkOrder[],
      total: data.total as number,
    }),
  });

  const createWorkOrder = useMutation({
    mutationFn: (input: CreateWorkOrderInput) =>
      fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-orders', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-counts', orgId] });
    },
  });

  return {
    workOrders: query.data?.workOrders ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createWorkOrder,
  };
}

export function useSetHouseWorkOrder(orgId: string | null, workOrderId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-work-order', orgId, workOrderId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/${workOrderId}`, token!),
    enabled: !!token && !!orgId && !!workOrderId,
    select: (data) => data.work_order as SetHouseWorkOrder,
  });

  const updateWorkOrder = useMutation({
    mutationFn: (input: UpdateWorkOrderInput) =>
      fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/${workOrderId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order', orgId, workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-orders', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-counts', orgId] });
    },
  });

  const deleteWorkOrder = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/${workOrderId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-orders', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-counts', orgId] });
    },
  });

  // Add item to work order
  const addItem = useMutation({
    mutationFn: (input: { space_id?: string; package_instance_id?: string; notes?: string }) =>
      fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/${workOrderId}/items`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order', orgId, workOrderId] });
    },
  });

  // Confirm item in work order
  const confirmItem = useMutation({
    mutationFn: (itemId: string) =>
      fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/${workOrderId}/items/${itemId}/confirm`, token!, {
        method: 'PUT',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order', orgId, workOrderId] });
    },
  });

  // Remove item from work order
  const removeItem = useMutation({
    mutationFn: (itemId: string) =>
      fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/${workOrderId}/items/${itemId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order', orgId, workOrderId] });
    },
  });

  // Convert work order to booking transaction
  const convertToBooking = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/${workOrderId}/convert-to-booking`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order', orgId, workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-orders', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-counts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  return {
    workOrder: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateWorkOrder,
    deleteWorkOrder,
    addItem,
    confirmItem,
    removeItem,
    convertToBooking,
  };
}

export function useSetHouseWorkOrderCounts(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-work-order-counts', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/work-orders/${orgId}/counts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.counts as SetHouseWorkOrderCounts,
  });
}
