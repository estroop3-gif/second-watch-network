/**
 * useClearanceApproval - Hook for post-sign approval workflow
 * Handles approval configuration and approval actions
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ClearanceApproval,
  ClearanceApprovalStatus,
  ConfigureApprovalInput,
  ApprovalActionInput,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// Clearance Approval Query
// =============================================================================

/**
 * Fetch approval status for a specific clearance
 */
export function useClearanceApproval(clearanceId: string | null) {
  return useQuery({
    queryKey: ['clearance-approval', clearanceId],
    queryFn: async () => {
      if (!clearanceId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/approval`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        // 404 means no approval configured, return null
        if (response.status === 404) return null;
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch approval status' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.approval || result) as ClearanceApproval;
    },
    enabled: !!clearanceId,
  });
}

// =============================================================================
// Pending Approvals Query
// =============================================================================

/**
 * Fetch all pending approvals for a project (for approvers/managers)
 */
export function usePendingApprovals(projectId: string | null) {
  return useQuery({
    queryKey: ['pending-approvals', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/approvals/pending`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch pending approvals' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.approvals || result || []) as Array<{
        clearance_id: string;
        clearance_title: string;
        clearance_type: string;
        signer_name: string;
        signed_at: string;
        approval: ClearanceApproval;
      }>;
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch all my pending approvals across projects
 */
export function useMyPendingApprovals() {
  return useQuery({
    queryKey: ['pending-approvals', 'me'],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/users/me/approvals/pending`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch pending approvals' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.approvals || result || []) as Array<{
        clearance_id: string;
        clearance_title: string;
        clearance_type: string;
        project_id: string;
        project_title: string;
        signer_name: string;
        signed_at: string;
        approval: ClearanceApproval;
      }>;
    },
  });
}

// =============================================================================
// Configure Approval Mutation
// =============================================================================

/**
 * Configure approval requirements for a clearance
 */
export function useConfigureApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clearanceId,
      ...input
    }: ConfigureApprovalInput & { clearanceId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/approval/configure`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to configure approval' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.approval || result) as ClearanceApproval;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clearance-approval', variables.clearanceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
    },
  });
}

// =============================================================================
// Approval Action Mutations
// =============================================================================

/**
 * Approve a signed clearance
 */
export function useApproveClearance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clearanceId,
      notes,
    }: ApprovalActionInput & { clearanceId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/approval/approve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to approve clearance' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clearance-approval', variables.clearanceId] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['crew-document-summary'] });
    },
  });
}

/**
 * Request changes on a signed clearance
 */
export function useRequestClearanceChanges() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clearanceId,
      notes,
    }: ApprovalActionInput & { clearanceId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/approval/request-changes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to request changes' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clearance-approval', variables.clearanceId] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
    },
  });
}

/**
 * Reject a signed clearance
 */
export function useRejectClearance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clearanceId,
      notes,
    }: ApprovalActionInput & { clearanceId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/approval/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notes }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reject clearance' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clearance-approval', variables.clearanceId] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
    },
  });
}

// =============================================================================
// Approval Status Helpers
// =============================================================================

export const APPROVAL_STATUS_CONFIG: Record<
  ClearanceApprovalStatus,
  { label: string; color: string; bgColor: string }
> = {
  not_required: {
    label: 'No Approval Required',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted-gray/20',
  },
  pending_approval: {
    label: 'Pending Approval',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  approved: {
    label: 'Approved',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
  changes_requested: {
    label: 'Changes Requested',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
  },
};

export function getApprovalStatusConfig(status: ClearanceApprovalStatus) {
  return APPROVAL_STATUS_CONFIG[status] || APPROVAL_STATUS_CONFIG.not_required;
}
