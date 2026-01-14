/**
 * useInvoices - Hooks for Invoice management
 * Provides invoice CRUD, line items, imports, status actions, and PDF generation
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotInvoice,
  BacklotInvoiceLineItem,
  InvoiceInput,
  InvoiceLineItemInput,
  InvoiceListItem,
  InvoiceSummary,
  ImportableInvoiceData,
  InvoicePrefillData,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Helper to handle API errors with detailed messages
async function handleApiError(response: Response, defaultMessage: string): Promise<never> {
  let errorDetail = defaultMessage;
  try {
    const errorBody = await response.json();
    errorDetail = errorBody.detail || errorBody.message || defaultMessage;
  } catch {
    // If we can't parse JSON, use status text
    errorDetail = response.statusText || defaultMessage;
  }
  console.error(`[Invoices API] ${response.status}: ${errorDetail}`);
  throw new Error(errorDetail);
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

/**
 * Get current user's invoices for a project
 */
export function useMyInvoices(projectId: string | null, status?: string) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, 'me', status],
    queryFn: async (): Promise<InvoiceListItem[]> => {
      if (!projectId) return [];
      const token = api.getToken();
      const params = status ? `?status=${status}` : '';
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/me${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Failed to fetch your invoices');
      return response.json();
    },
    enabled: !!projectId,
    retry: 1,
  });
}

/**
 * Get all invoices for review (managers only)
 */
export function useInvoicesForReview(projectId: string | null, status?: string) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, 'review', status],
    queryFn: async (): Promise<InvoiceListItem[]> => {
      if (!projectId) return [];
      const token = api.getToken();
      const params = status ? `?status=${status}` : '';
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/review${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Failed to fetch invoices for review');
      return response.json();
    },
    enabled: !!projectId,
    retry: 1,
  });
}

/**
 * Get single invoice with line items
 */
export function useInvoice(projectId: string | null, invoiceId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, invoiceId],
    queryFn: async (): Promise<BacklotInvoice | null> => {
      if (!projectId || !invoiceId) return null;
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Invoice not found');
      return response.json();
    },
    enabled: !!projectId && !!invoiceId,
    retry: 1,
  });
}

/**
 * Get invoice summary statistics
 */
export function useInvoiceSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, 'summary'],
    queryFn: async (): Promise<InvoiceSummary | null> => {
      if (!projectId) return null;
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/summary`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Failed to fetch invoice summary');
      return response.json();
    },
    enabled: !!projectId,
    retry: 1,
  });
}

/**
 * Get next auto-generated invoice number
 */
export function useNextInvoiceNumber(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, 'next-number'],
    queryFn: async (): Promise<{ invoice_number: string } | null> => {
      if (!projectId) return null;
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/next-number`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Failed to generate invoice number');
      return response.json();
    },
    enabled: !!projectId,
    retry: 1,
  });
}

/**
 * Get data available to import into invoices
 */
export function useImportableInvoiceData(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, 'importable'],
    queryFn: async (): Promise<ImportableInvoiceData | null> => {
      if (!projectId) return null;
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/importable-data`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Failed to fetch importable data');
      return response.json();
    },
    enabled: !!projectId,
    retry: 1,
  });
}

/**
 * Get prefill data for new invoice
 */
export function useInvoicePrefillData(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, 'prefill'],
    queryFn: async (): Promise<InvoicePrefillData | null> => {
      if (!projectId) return null;
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/prefill-data`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Failed to load invoice form data');
      return response.json();
    },
    enabled: !!projectId,
    retry: 1,
  });
}

// =============================================================================
// MUTATION HOOKS - INVOICE CRUD
// =============================================================================

/**
 * Create a new invoice
 */
export function useCreateInvoice(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InvoiceInput): Promise<BacklotInvoice> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to create invoice' }));
        throw new Error(error.detail || 'Failed to create invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

/**
 * Update an invoice
 */
export function useUpdateInvoice(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<InvoiceInput>): Promise<BacklotInvoice> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to update invoice' }));
        throw new Error(error.detail || 'Failed to update invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

/**
 * Delete a draft invoice
 */
export function useDeleteInvoice(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string): Promise<void> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete invoice' }));
        throw new Error(error.detail || 'Failed to delete invoice');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

// =============================================================================
// MUTATION HOOKS - LINE ITEMS
// =============================================================================

/**
 * Add a line item to an invoice
 */
export function useAddLineItem(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InvoiceLineItemInput): Promise<BacklotInvoiceLineItem> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/line-items`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to add line item' }));
        throw new Error(error.detail || 'Failed to add line item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'me'] });
    },
  });
}

/**
 * Update a line item
 */
export function useUpdateLineItem(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: Partial<InvoiceLineItemInput>;
    }): Promise<BacklotInvoiceLineItem> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/line-items/${itemId}`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to update line item' }));
        throw new Error(error.detail || 'Failed to update line item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'me'] });
    },
  });
}

/**
 * Delete a line item
 */
export function useDeleteLineItem(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string): Promise<void> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/line-items/${itemId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete line item' }));
        throw new Error(error.detail || 'Failed to delete line item');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'me'] });
    },
  });
}

/**
 * Reorder a line item (move up or down)
 */
export function useReorderLineItem(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { line_item_id: string; direction: 'UP' | 'DOWN' }): Promise<void> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/line-items/reorder`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reorder line item' }));
        throw new Error(error.detail || 'Failed to reorder line item');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, invoiceId] });
    },
  });
}

// =============================================================================
// MUTATION HOOKS - STATUS ACTIONS
// =============================================================================

/**
 * Mark invoice as sent
 */
export function useSendInvoice(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/send`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to send invoice' }));
        throw new Error(error.detail || 'Failed to send invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

/**
 * Mark invoice as paid (managers only)
 */
export function useMarkInvoicePaid(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      paidAmount,
    }: {
      invoiceId: string;
      paidAmount?: number;
    }): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/mark-paid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ paid_amount: paidAmount }),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to mark as paid' }));
        throw new Error(error.detail || 'Failed to mark as paid');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

/**
 * Cancel an invoice
 */
export function useCancelInvoice(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/cancel`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to cancel invoice' }));
        throw new Error(error.detail || 'Failed to cancel invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

// =============================================================================
// MUTATION HOOKS - APPROVAL WORKFLOW
// =============================================================================

/**
 * Submit invoice for manager approval
 */
export function useSubmitForApproval(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/submit-for-approval`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        await handleApiError(response, 'Failed to submit for approval');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

/**
 * Approve an invoice (managers only) with optional notes
 */
export function useApproveInvoice(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      notes,
    }: {
      invoiceId: string;
      notes?: string;
    }): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/approve`,
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
        await handleApiError(response, 'Failed to approve invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all invoice-related queries
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'summary'] });
      // Invalidate budget queries - invoice approval records line items to budget actuals
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-comparison', projectId] });
    },
  });
}

/**
 * Request changes to an invoice (managers only)
 */
export function useRequestChanges(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      reason,
    }: {
      invoiceId: string;
      reason: string;
    }): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/request-changes`,
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
        await handleApiError(response, 'Failed to request changes');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

/**
 * Deny an invoice permanently (managers only)
 */
export function useDenyInvoice(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      reason,
    }: {
      invoiceId: string;
      reason: string;
    }): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/deny`,
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
        await handleApiError(response, 'Failed to deny invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

/**
 * Mark invoice as sent externally (after approval)
 */
export function useMarkInvoiceSent(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string): Promise<{ success: boolean; status: string }> => {
      if (!projectId) throw new Error('Project ID required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/mark-sent`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        await handleApiError(response, 'Failed to mark as sent');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId] });
    },
  });
}

// =============================================================================
// MUTATION HOOKS - DATA IMPORTS
// =============================================================================

/**
 * Import approved timecards as line items
 */
export function useImportTimecards(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (timecardIds: string[]): Promise<{ success: boolean; imported_count: number }> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/import-timecards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ timecard_ids: timecardIds }),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to import timecards' }));
        throw new Error(error.detail || 'Failed to import timecards');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
    },
  });
}

/**
 * Import approved expenses as line items
 */
export function useImportExpenses(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      kit_rental_ids?: string[];
      mileage_ids?: string[];
      per_diem_ids?: string[];
      receipt_ids?: string[];
    }): Promise<{ success: boolean; imported_count: number }> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/import-expenses`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to import expenses' }));
        throw new Error(error.detail || 'Failed to import expenses');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
    },
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format date for display
 * Parses YYYY-MM-DD as local date to avoid timezone shift issues
 */
export function formatInvoiceDate(dateStr: string): string {
  // Parse as local date to avoid UTC timezone shifting the day
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculate due date based on payment terms
 */
export function calculateDueDate(invoiceDate: string, terms: string): string {
  const date = new Date(invoiceDate);
  const daysMap: Record<string, number> = {
    due_on_receipt: 0,
    net_15: 15,
    net_30: 30,
    net_45: 45,
    net_60: 60,
  };
  const days = daysMap[terms] ?? 30;
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Get default unit label for rate type
 */
export function getDefaultUnit(rateType: string): string {
  const unitMap: Record<string, string> = {
    hourly: 'hrs',
    daily: 'days',
    weekly: 'wks',
    flat: '',
  };
  return unitMap[rateType] || '';
}

/**
 * Check if invoice is overdue
 */
export function isInvoiceOverdue(invoice: BacklotInvoice): boolean {
  if (!invoice.due_date || invoice.status === 'paid' || invoice.status === 'cancelled') {
    return false;
  }
  return new Date(invoice.due_date) < new Date();
}

// =============================================================================
// AUTO-SYNC HOOKS
// =============================================================================

/**
 * Pending import count interface
 */
export interface PendingImportCount {
  mileage: number;
  kit_rentals: number;
  per_diem: number;
  receipts: number;
  timecards: number;
  total: number;
}

/**
 * Get count of approved items pending invoice import
 */
export function usePendingImportCount(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'invoices', projectId, 'pending-import-count'],
    queryFn: async (): Promise<PendingImportCount | null> => {
      if (!projectId) return null;
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/pending-import-count`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) await handleApiError(response, 'Failed to fetch pending import count');
      return response.json();
    },
    enabled: !!projectId,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 1,
  });
}

/**
 * Unlink a line item from an invoice (makes it available for re-import)
 */
export function useUnlinkLineItem(projectId: string | null, invoiceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string): Promise<{ success: boolean }> => {
      if (!projectId || !invoiceId) throw new Error('IDs required');
      const token = api.getToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/invoices/${invoiceId}/line-items/${itemId}/unlink`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to unlink line item' }));
        throw new Error(error.detail || 'Failed to unlink line item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'me'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'pending-import-count'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
    },
  });
}
