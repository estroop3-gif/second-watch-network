/**
 * External Seats Hook
 * Manages project-level seats for freelancers and clients
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ExternalSeat {
  id: string;
  project_id: string;
  user_id: string;
  seat_type: 'project' | 'view_only';
  can_invoice: boolean;
  can_expense: boolean;
  can_timecard: boolean;
  tab_permissions: Record<string, { view: boolean; edit: boolean }>;
  status: string;
  invited_by: string | null;
  invited_at: string | null;
  created_at: string;
  // Joined user info
  user_name: string | null;
  user_email: string | null;
  user_avatar: string | null;
}

export interface CreateExternalSeatParams {
  userId: string;
  seatType: 'project' | 'view_only';
  canInvoice?: boolean;
  canExpense?: boolean;
  canTimecard?: boolean;
  tabPermissions?: Record<string, { view: boolean; edit: boolean }>;
}

export interface UpdateExternalSeatParams {
  seatId: string;
  canInvoice?: boolean;
  canExpense?: boolean;
  canTimecard?: boolean;
  tabPermissions?: Record<string, { view: boolean; edit: boolean }>;
}

/**
 * Get all external seats for a project
 */
export function useExternalSeats(projectId: string) {
  return useQuery({
    queryKey: ['project-external-seats', projectId],
    queryFn: async (): Promise<ExternalSeat[]> => {
      const response = await api.get(`/projects/${projectId}/external-seats`);
      return response;
    },
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

/**
 * Add an external seat to a project
 */
export function useAddExternalSeat(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateExternalSeatParams) => {
      return api.post(`/projects/${projectId}/external-seats`, {
        user_id: params.userId,
        seat_type: params.seatType,
        can_invoice: params.canInvoice ?? true,
        can_expense: params.canExpense ?? true,
        can_timecard: params.canTimecard ?? true,
        tab_permissions: params.tabPermissions ?? {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-external-seats', projectId] });
    },
  });
}

/**
 * Update an external seat
 */
export function useUpdateExternalSeat(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateExternalSeatParams) => {
      return api.patch(`/projects/${projectId}/external-seats/${params.seatId}`, {
        can_invoice: params.canInvoice,
        can_expense: params.canExpense,
        can_timecard: params.canTimecard,
        tab_permissions: params.tabPermissions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-external-seats', projectId] });
    },
  });
}

/**
 * Remove an external seat
 */
export function useRemoveExternalSeat(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (seatId: string) => {
      return api.delete(`/projects/${projectId}/external-seats/${seatId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-external-seats', projectId] });
    },
  });
}
