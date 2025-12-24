/**
 * Casting & Crew Hiring Pipeline Hooks
 * Handles project roles, applications, and availability
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  BacklotProjectRole,
  BacklotRoleApplication,
  BacklotUserAvailability,
  BacklotBookedPerson,
  ProjectRoleInput,
  RoleApplicationInput,
  ApplicationStatusUpdateInput,
  UserAvailabilityInput,
  BulkAvailabilityInput,
  BacklotProjectRoleType,
  BacklotProjectRoleStatus,
  BacklotApplicationStatus,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// PROJECT ROLES HOOKS
// =============================================================================

/**
 * Get all roles for a project
 */
export function useProjectRoles(
  projectId: string | undefined,
  options?: {
    type?: BacklotProjectRoleType;
    status?: BacklotProjectRoleStatus;
    includeApplications?: boolean;
  }
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-project-roles', projectId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.type) params.append('type', options.type);
      if (options?.status) params.append('status', options.status);
      if (options?.includeApplications) params.append('include_applications', 'true');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/roles?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch project roles');
      const result = await response.json();
      return result.roles as BacklotProjectRole[];
    },
    enabled: !!projectId && !!session?.access_token,
  });
}

/**
 * Get a single role by ID
 */
export function useRole(
  roleId: string | undefined,
  options?: { includeApplications?: boolean }
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-role', roleId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.includeApplications) params.append('include_applications', 'true');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch role');
      const result = await response.json();
      return result.role as BacklotProjectRole;
    },
    enabled: !!roleId && !!session?.access_token,
  });
}

/**
 * Create, update, delete project roles
 */
export function useProjectRoleMutations(projectId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const createRole = useMutation({
    mutationFn: async (input: ProjectRoleInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/roles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles', projectId] });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ roleId, input }: { roleId: string; input: ProjectRoleInput }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update role');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-role', variables.roleId] });
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (roleId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete role');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles', projectId] });
    },
  });

  const bookRole = useMutation({
    mutationFn: async ({ roleId, userId }: { roleId: string; userId: string }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}/book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ user_id_to_book: userId }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to book role');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-role', variables.roleId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-role-applications', variables.roleId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-booked-people', projectId] });
    },
  });

  return { createRole, updateRole, deleteRole, bookRole };
}

// =============================================================================
// OPEN ROLES (PUBLIC JOB BOARD)
// =============================================================================

/**
 * Get all open roles (public job board listing)
 */
export function useOpenRoles(options?: {
  type?: BacklotProjectRoleType;
  location?: string;
  paidOnly?: boolean;
  orderOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-open-roles', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.type) params.append('type', options.type);
      if (options?.location) params.append('location', options.location);
      if (options?.paidOnly) params.append('paid_only', 'true');
      if (options?.orderOnly) params.append('order_only', 'true');
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/open-roles?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch open roles');
      const result = await response.json();
      return {
        roles: result.roles as BacklotProjectRole[],
        count: result.count as number,
        isOrderMember: result.is_order_member as boolean,
      };
    },
    enabled: !!session?.access_token,
  });
}

// =============================================================================
// ROLE APPLICATIONS HOOKS
// =============================================================================

/**
 * Get all applications for a role
 */
export function useRoleApplications(
  roleId: string | undefined,
  status?: BacklotApplicationStatus
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-role-applications', roleId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}/applications?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch applications');
      const result = await response.json();
      return {
        applications: result.applications as BacklotRoleApplication[],
        applicationsByStatus: result.applications_by_status as Record<string, BacklotRoleApplication[]>,
        count: result.count as number,
      };
    },
    enabled: !!roleId && !!session?.access_token,
  });
}

/**
 * Get current user's applications
 */
export function useMyApplications(status?: BacklotApplicationStatus) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-my-applications', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/my-applications?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch my applications');
      const result = await response.json();
      return result.applications as BacklotRoleApplication[];
    },
    enabled: !!session?.access_token,
  });
}

/**
 * Apply to a role
 */
export function useApplyToRole() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ roleId, input }: { roleId: string; input: RoleApplicationInput }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}/apply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to submit application');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-open-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-role', variables.roleId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-my-applications'] });
    },
  });
}

/**
 * Update application status
 */
export function useUpdateApplicationStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      input,
    }: {
      applicationId: string;
      input: ApplicationStatusUpdateInput;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/applications/${applicationId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update application');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-role-applications'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-booked-people'] });
    },
  });
}

// =============================================================================
// USER AVAILABILITY HOOKS
// =============================================================================

/**
 * Get current user's availability
 */
export function useMyAvailability(options?: { startDate?: string; endDate?: string }) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-my-availability', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.startDate) params.append('start_date', options.startDate);
      if (options?.endDate) params.append('end_date', options.endDate);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/my-availability?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch availability');
      const result = await response.json();
      return result.availability as BacklotUserAvailability[];
    },
    enabled: !!session?.access_token,
  });
}

/**
 * Get a user's availability (for viewing others)
 */
export function useUserAvailability(
  userId: string | undefined,
  options?: { startDate?: string; endDate?: string }
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-user-availability', userId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.startDate) params.append('start_date', options.startDate);
      if (options?.endDate) params.append('end_date', options.endDate);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/users/${userId}/availability?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch user availability');
      const result = await response.json();
      return result.availability as BacklotUserAvailability[];
    },
    enabled: !!userId && !!session?.access_token,
  });
}

/**
 * Set user availability
 */
export function useSetAvailability() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const setAvailability = useMutation({
    mutationFn: async (input: UserAvailabilityInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/my-availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to set availability');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-availability'] });
    },
  });

  const setBulkAvailability = useMutation({
    mutationFn: async (input: BulkAvailabilityInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/my-availability/bulk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to set bulk availability');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-availability'] });
    },
  });

  const deleteAvailability = useMutation({
    mutationFn: async (date: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/my-availability/${date}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete availability');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-availability'] });
    },
  });

  return { setAvailability, setBulkAvailability, deleteAvailability };
}

// =============================================================================
// BOOKED PEOPLE (CALL SHEET INTEGRATION)
// =============================================================================

/**
 * Get all booked people for a project
 */
export function useBookedPeople(
  projectId: string | undefined,
  type?: BacklotProjectRoleType
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-booked-people', projectId, type],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.append('type', type);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/booked-people?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch booked people');
      const result = await response.json();
      return result.booked_people as BacklotBookedPerson[];
    },
    enabled: !!projectId && !!session?.access_token,
  });
}

/**
 * Check availability conflicts for multiple users
 */
export function useCheckAvailabilityConflicts() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      userIds,
      startDate,
      endDate,
    }: {
      userIds: string[];
      startDate: string;
      endDate: string;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/check-availability-conflicts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            user_ids: userIds,
            start_date: startDate,
            end_date: endDate,
          }),
        }
      );
      if (!response.ok) throw new Error('Failed to check conflicts');
      return response.json();
    },
  });
}

// =============================================================================
// DEAL MEMO HOOKS
// =============================================================================

import type { DealMemo, DealMemoInput } from '@/types/backlot';

/**
 * Get all deal memos for a project
 */
export function useDealMemos(
  projectId: string | undefined,
  options?: {
    status?: string;
    userId?: string;
  }
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-deal-memos', projectId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.userId) params.append('user_id', options.userId);

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/deal-memos${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch deal memos');
      const data = await response.json();
      return data.deal_memos as DealMemo[];
    },
    enabled: !!projectId && !!session?.access_token,
  });
}

/**
 * Get a single deal memo
 */
export function useDealMemo(dealMemoId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-deal-memo', dealMemoId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch deal memo');
      const data = await response.json();
      return data.deal_memo as DealMemo;
    },
    enabled: !!dealMemoId && !!session?.access_token,
  });
}

/**
 * Status history entry for a deal memo
 */
export interface DealMemoStatusHistory {
  id: string;
  deal_memo_id: string;
  status: string;
  changed_by: string;
  changed_by_name?: string;
  notes?: string;
  created_at: string;
}

/**
 * Get status history for a deal memo
 */
export function useDealMemoHistory(dealMemoId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-deal-memo-history', dealMemoId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/history`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch deal memo history');
      const data = await response.json();
      return data.history as DealMemoStatusHistory[];
    },
    enabled: !!dealMemoId && !!session?.access_token,
  });
}

/**
 * Deal memo mutations (create, update, delete)
 */
export function useDealMemoMutations(projectId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const createDealMemo = useMutation({
    mutationFn: async (input: DealMemoInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/deal-memos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to create deal memo');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
    },
  });

  const updateDealMemo = useMutation({
    mutationFn: async ({ id, ...input }: DealMemoInput & { id: string }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to update deal memo');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memo', variables.id] });
    },
  });

  const deleteDealMemo = useMutation({
    mutationFn: async (dealMemoId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to delete deal memo');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
    },
  });

  const createRateFromDealMemo = useMutation({
    mutationFn: async (dealMemoId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/create-rate`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to create rate from deal memo');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-rates', projectId] });
    },
  });

  const sendDealMemo = useMutation({
    mutationFn: async (dealMemoId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/send`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to send deal memo');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
    },
  });

  const voidDealMemo = useMutation({
    mutationFn: async (dealMemoId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/void`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to void deal memo');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
    },
  });

  const resendDealMemo = useMutation({
    mutationFn: async (dealMemoId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/resend`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to resend deal memo');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
    },
  });

  // Paperwork tracking mutations
  const updateDealMemoStatus = useMutation({
    mutationFn: async ({
      dealMemoId,
      status,
      notes,
      signedDocumentUrl,
    }: {
      dealMemoId: string;
      status: 'sent' | 'viewed' | 'signed' | 'declined';
      notes?: string;
      signedDocumentUrl?: string;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            status,
            notes,
            signed_document_url: signedDocumentUrl,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to update deal memo status');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memo', variables.dealMemoId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memo-history', variables.dealMemoId] });
      // If signed, also invalidate crew rates since one might have been auto-created
      if (variables.status === 'signed') {
        queryClient.invalidateQueries({ queryKey: ['backlot-crew-rates', projectId] });
      }
    },
  });

  const uploadSignedDocument = useMutation({
    mutationFn: async ({
      dealMemoId,
      signedDocumentUrl,
    }: {
      dealMemoId: string;
      signedDocumentUrl: string;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/upload-signed`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ signed_document_url: signedDocumentUrl }),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to upload signed document');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memo', variables.dealMemoId] });
    },
  });

  return {
    createDealMemo,
    updateDealMemo,
    deleteDealMemo,
    createRateFromDealMemo,
    sendDealMemo,
    voidDealMemo,
    resendDealMemo,
    updateDealMemoStatus,
    uploadSignedDocument,
  };
}

// =============================================================================
// POST ROLE TO COMMUNITY HOOKS
// =============================================================================

/**
 * Post a role to the community job board
 */
export function usePostRoleToCommunity() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}/post-to-community`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to post role to community');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
    },
  });
}

/**
 * Remove a role from the community job board
 */
export function useRemoveRoleFromCommunity() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/roles/${roleId}/remove-from-community`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Failed to remove role from community');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
    },
  });
}
