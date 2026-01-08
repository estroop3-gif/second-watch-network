/**
 * Gear Work Orders Hooks
 * Data fetching and mutations for work order management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  GearWorkOrder,
  GearWorkOrderItem,
  GearWorkOrderCounts,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
  WorkOrderCheckoutResponse,
  WorkOrderStatus,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[WorkOrders API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[WorkOrders API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[WorkOrders API] Response:`, data);
  return data;
}

// ============================================================================
// WORK ORDER HOOKS
// ============================================================================

export interface UseWorkOrdersOptions {
  status?: WorkOrderStatus;
  assigned_to?: string;
  custodian_user_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

/**
 * List work orders for an organization with optional filters
 */
export function useWorkOrders(orgId: string | null, options?: UseWorkOrdersOptions) {
  const { session } = useAuth();
  const token = session?.access_token;

  // Build query string
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.assigned_to) params.append('assigned_to', options.assigned_to);
  if (options?.custodian_user_id) params.append('custodian_user_id', options.custodian_user_id);
  if (options?.search) params.append('search', options.search);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const queryString = params.toString();
  const url = `/api/v1/gear/work-orders/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['gear-work-orders', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId && (options?.enabled ?? true),
    select: (data) => ({
      workOrders: data.work_orders as GearWorkOrder[],
      total: data.total as number,
    }),
  });

  return {
    workOrders: query.data?.workOrders ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get work order counts by status (for tab badges)
 */
export function useWorkOrderCounts(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['gear-work-order-counts', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/counts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data as GearWorkOrderCounts,
  });

  return {
    counts: query.data ?? { draft: 0, in_progress: 0, ready: 0, checked_out: 0, total: 0 },
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get a single work order with its items
 */
export function useWorkOrder(orgId: string | null, workOrderId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['gear-work-order', orgId, workOrderId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}`, token!),
    enabled: !!token && !!orgId && !!workOrderId,
    select: (data) => ({
      ...data.work_order,
      items: data.items || [],
    } as GearWorkOrder),
  });

  return {
    workOrder: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * All work order mutations
 */
export function useWorkOrderMutations(orgId: string) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const invalidateWorkOrders = () => {
    queryClient.invalidateQueries({ queryKey: ['gear-work-orders', orgId] });
    queryClient.invalidateQueries({ queryKey: ['gear-work-order-counts', orgId] });
  };

  // Create work order
  const createWorkOrder = useMutation({
    mutationFn: (input: CreateWorkOrderInput) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidateWorkOrders();
    },
  });

  // Update work order
  const updateWorkOrder = useMutation({
    mutationFn: ({ workOrderId, input }: { workOrderId: string; input: UpdateWorkOrderInput }) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, { workOrderId }) => {
      invalidateWorkOrders();
      queryClient.invalidateQueries({ queryKey: ['gear-work-order', orgId, workOrderId] });
    },
  });

  // Delete work order (only draft/cancelled)
  const deleteWorkOrder = useMutation({
    mutationFn: (workOrderId: string) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      invalidateWorkOrders();
    },
  });

  // Assign work order to a user
  const assignWorkOrder = useMutation({
    mutationFn: ({ workOrderId, assignedTo }: { workOrderId: string; assignedTo: string | null }) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}/assign`, token!, {
        method: 'POST',
        body: JSON.stringify({ assigned_to: assignedTo }),
      }),
    onSuccess: (_, { workOrderId }) => {
      invalidateWorkOrders();
      queryClient.invalidateQueries({ queryKey: ['gear-work-order', orgId, workOrderId] });
    },
  });

  // Add items to work order
  const addItems = useMutation({
    mutationFn: ({
      workOrderId,
      items,
    }: {
      workOrderId: string;
      items: Array<{ asset_id?: string; kit_instance_id?: string; quantity?: number; notes?: string }>;
    }) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}/items`, token!, {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),
    onSuccess: (_, { workOrderId }) => {
      invalidateWorkOrders();
      queryClient.invalidateQueries({ queryKey: ['gear-work-order', orgId, workOrderId] });
    },
  });

  // Remove item from work order
  const removeItem = useMutation({
    mutationFn: ({ workOrderId, itemId }: { workOrderId: string; itemId: string }) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}/items/${itemId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: (_, { workOrderId }) => {
      invalidateWorkOrders();
      queryClient.invalidateQueries({ queryKey: ['gear-work-order', orgId, workOrderId] });
    },
  });

  // Mark item as staged
  const stageItem = useMutation({
    mutationFn: ({ workOrderId, itemId, staged, scannedValue }: {
      workOrderId: string;
      itemId: string;
      staged: boolean;
      scannedValue?: string;
    }) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}/items/${itemId}/stage`, token!, {
        method: 'POST',
        body: JSON.stringify({ scanned_value: scannedValue }),
      }),
    onSuccess: (_, { workOrderId }) => {
      invalidateWorkOrders();
      queryClient.invalidateQueries({ queryKey: ['gear-work-order', orgId, workOrderId] });
    },
  });

  // Stage item by scanning (finds item by scanned value)
  const stageByScan = useMutation({
    mutationFn: ({ workOrderId, scannedValue }: { workOrderId: string; scannedValue: string }) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}/stage-by-scan`, token!, {
        method: 'POST',
        body: JSON.stringify({ scanned_value: scannedValue }),
      }),
    onSuccess: (_, { workOrderId }) => {
      invalidateWorkOrders();
      queryClient.invalidateQueries({ queryKey: ['gear-work-order', orgId, workOrderId] });
    },
  });

  // Checkout from work order (creates transaction)
  const checkoutFromWorkOrder = useMutation<WorkOrderCheckoutResponse, Error, { workOrderId: string; notes?: string }>({
    mutationFn: ({ workOrderId, notes }) =>
      fetchWithAuth(`/api/v1/gear/work-orders/${orgId}/${workOrderId}/checkout`, token!, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: (_, { workOrderId }) => {
      invalidateWorkOrders();
      queryClient.invalidateQueries({ queryKey: ['gear-work-order', orgId, workOrderId] });
      // Also invalidate transactions since we created a new one
      queryClient.invalidateQueries({ queryKey: ['gear-transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-outgoing-transactions', orgId] });
    },
  });

  return {
    createWorkOrder,
    updateWorkOrder,
    deleteWorkOrder,
    assignWorkOrder,
    addItems,
    removeItem,
    stageItem,
    stageByScan,
    checkoutFromWorkOrder,
  };
}

// ============================================================================
// COMBINED HOOK
// ============================================================================

/**
 * Combined hook for work order management
 */
export function useGearWorkOrders(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const { workOrders, total, isLoading, error, refetch } = useWorkOrders(orgId);
  const { counts, isLoading: countsLoading, refetch: refetchCounts } = useWorkOrderCounts(orgId);
  const mutations = useWorkOrderMutations(orgId || '');

  return {
    // Data
    workOrders,
    total,
    counts,
    // Loading states
    isLoading,
    countsLoading,
    // Error
    error,
    // Refetch
    refetch,
    refetchCounts,
    // All mutations
    ...mutations,
  };
}
