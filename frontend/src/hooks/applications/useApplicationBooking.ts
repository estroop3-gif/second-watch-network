/**
 * useApplicationBooking - Hook for managing application booking workflow
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ApplicationScheduleInput {
  interview_scheduled_at?: string | null;
  interview_notes?: string | null;
  callback_scheduled_at?: string | null;
  callback_notes?: string | null;
}

export interface ApplicationBookingInput {
  booking_rate?: string;
  booking_start_date?: string;
  booking_end_date?: string;
  booking_notes?: string;
  booking_schedule_notes?: string;
  // Cast-specific
  character_id?: string;
  billing_position?: number;
  contract_type?: string;
  // Document request
  request_documents?: boolean;
  document_types?: string[];
  // Role assignment
  role_title?: string;
  department?: string;
  // Notification
  send_notification?: boolean;
  notification_message?: string;
}

export interface ApplicationUnbookInput {
  reason: string;
}

export interface StatusHistoryEntry {
  id: string;
  application_id: string;
  old_status?: string;
  new_status: string;
  changed_by_user_id?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  changed_by?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export function useApplicationSchedule(applicationId: string | null) {
  const queryClient = useQueryClient();

  const updateSchedule = useMutation({
    mutationFn: async (input: ApplicationScheduleInput) => {
      if (!applicationId) throw new Error('No application ID');
      const response = await api.put(`/community/collab-applications/${applicationId}/schedule`, input);
      return response;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['collab-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-history', applicationId] });
    },
  });

  return { updateSchedule };
}

export function useApplicationBooking(applicationId: string | null) {
  const queryClient = useQueryClient();

  const bookApplicant = useMutation({
    mutationFn: async (input: ApplicationBookingInput) => {
      if (!applicationId) throw new Error('No application ID');
      const response = await api.post(`/community/collab-applications/${applicationId}/book`, input);
      return response as { success: boolean; application: unknown; project_role_id?: string; message: string };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['collab-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-history', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['project-collabs'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
    },
  });

  const unbookApplicant = useMutation({
    mutationFn: async (input: ApplicationUnbookInput) => {
      if (!applicationId) throw new Error('No application ID');
      const response = await api.post(`/community/collab-applications/${applicationId}/unbook`, input);
      return response as { success: boolean; application: unknown; message: string };
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['collab-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-history', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['project-collabs'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
    },
  });

  return { bookApplicant, unbookApplicant };
}

export function useApplicationHistory(applicationId: string | null) {
  return useQuery({
    queryKey: ['application-history', applicationId],
    queryFn: async () => {
      if (!applicationId) return { history: [], total: 0 };
      const response = await api.get(`/community/collab-applications/${applicationId}/history`);
      return response as { history: StatusHistoryEntry[]; total: number };
    },
    enabled: !!applicationId,
  });
}
