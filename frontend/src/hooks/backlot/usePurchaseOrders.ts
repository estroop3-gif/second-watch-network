/**
 * usePurchaseOrders - Hooks for managing Purchase Orders in Backlot projects
 *
 * Purchase Orders are budget requests that need approval before spending.
 * They go through a workflow: pending -> approved -> completed (or rejected/cancelled)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Purchase Order status type
export type PurchaseOrderStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'denied';

// Purchase Order interface
export interface PurchaseOrder {
  id: string;
  project_id: string;
  requested_by: string;
  department: string | null;
  vendor_name: string | null;
  description: string;
  estimated_amount: number;
  status: PurchaseOrderStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  budget_category_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  requester_name?: string;
  requester_avatar?: string;
  approver_name?: string;
  budget_category_name?: string;
}

export interface CreatePurchaseOrderData {
  department?: string;
  vendor_name?: string;
  description: string;
  estimated_amount: number;
  budget_category_id?: string;
  notes?: string;
}

export interface UpdatePurchaseOrderData {
  department?: string;
  vendor_name?: string;
  description?: string;
  estimated_amount?: number;
  budget_category_id?: string;
  notes?: string;
}

export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus | 'all';
  department?: string;
  requested_by?: string;
}

export interface PurchaseOrderSummary {
  total_count: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  completed_count: number;
  pending_total: number;
  approved_total: number;
}

// Status configuration for UI
export const PO_STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending Approval', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/10' },
  rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/10' },
  completed: { label: 'Completed', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  cancelled: { label: 'Cancelled', color: 'text-muted-gray', bgColor: 'bg-muted-gray/10' },
  denied: { label: 'Denied', color: 'text-red-600', bgColor: 'bg-red-600/10' },
};

// Query keys
const QUERY_KEYS = {
  purchaseOrders: (projectId: string) => ['backlot-purchase-orders', projectId],
  purchaseOrder: (poId: string) => ['backlot-purchase-order', poId],
  purchaseOrderSummary: (projectId: string) => ['backlot-purchase-order-summary', projectId],
  myPurchaseOrders: (projectId: string) => ['backlot-my-purchase-orders', projectId],
};

// Get all purchase orders for a project
export function usePurchaseOrders(projectId: string | null, filters?: PurchaseOrderFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.purchaseOrders(projectId || ''), filters],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters?.department) params.append('department', filters.department);
      if (filters?.requested_by) params.append('requested_by', filters.requested_by);

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/purchase-orders${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch purchase orders' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder[];
    },
    enabled: !!projectId,
  });
}

// Get my purchase orders
export function useMyPurchaseOrders(projectId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.myPurchaseOrders(projectId || ''),
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/purchase-orders/my`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch my purchase orders' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder[];
    },
    enabled: !!projectId,
  });
}

// Get a single purchase order
export function usePurchaseOrder(poId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.purchaseOrder(poId || ''),
    queryFn: async () => {
      if (!poId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    enabled: !!poId,
  });
}

// Get purchase order summary for a project
export function usePurchaseOrderSummary(projectId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.purchaseOrderSummary(projectId || ''),
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/purchase-orders/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        // Return default summary if endpoint doesn't exist yet
        return {
          total_count: 0,
          pending_count: 0,
          approved_count: 0,
          rejected_count: 0,
          completed_count: 0,
          pending_total: 0,
          approved_total: 0,
        } as PurchaseOrderSummary;
      }

      return (await response.json()) as PurchaseOrderSummary;
    },
    enabled: !!projectId,
  });
}

// Create a new purchase order
export function useCreatePurchaseOrder(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePurchaseOrderData) => {
      if (!projectId) throw new Error('Project ID required');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/purchase-orders`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(projectId || '') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(projectId || '') });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(projectId || '') });
    },
  });
}

// Update a purchase order
export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, data }: { poId: string; data: UpdatePurchaseOrderData }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrder(data.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(data.project_id) });
    },
  });
}

// Delete a purchase order
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, projectId }: { poId: string; projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete purchase order' }));
        throw new Error(error.detail);
      }

      return { poId, projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(projectId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(projectId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(projectId) });
    },
  });
}

// Approve a purchase order (with optional notes)
export function useApprovePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, notes }: { poId: string; notes?: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(notes ? { notes } : {}),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to approve purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrder(data.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(data.project_id) });
    },
  });
}

// Reject a purchase order (can be resubmitted)
export function useRejectPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, reason }: { poId: string; reason: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reject purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrder(data.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(data.project_id) });
    },
  });
}

// Deny a purchase order permanently (cannot be resubmitted)
export function useDenyPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ poId, reason }: { poId: string; reason: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}/deny`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to deny purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrder(data.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(data.project_id) });
    },
  });
}

// Resubmit a rejected or denied purchase order
export function useResubmitPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}/resubmit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to resubmit purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrder(data.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(data.project_id) });
    },
  });
}

// Mark a purchase order as completed
export function useCompletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}/complete`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to complete purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrder(data.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(data.project_id) });
    },
  });
}

// Cancel a purchase order
export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (poId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/purchase-orders/${poId}/cancel`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to cancel purchase order' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as PurchaseOrder;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrder(data.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myPurchaseOrders(data.project_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.purchaseOrderSummary(data.project_id) });
    },
  });
}

// Helper to format currency
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}
