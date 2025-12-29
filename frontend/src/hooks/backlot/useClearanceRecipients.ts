/**
 * useClearanceRecipients - Hook for managing clearance recipients
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ClearanceRecipient,
  ClearanceRecipientInput,
  ClearanceSendRequest,
  ClearanceSendResult,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useClearanceRecipients(clearanceId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['backlot-clearance-recipients', clearanceId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ClearanceRecipient[]> => {
      if (!clearanceId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/recipients`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch recipients' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.recipients || [];
    },
    enabled: !!clearanceId,
  });

  const addRecipient = useMutation({
    mutationFn: async (input: ClearanceRecipientInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/recipients`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to add recipient' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeRecipient = useMutation({
    mutationFn: async (recipientId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/recipients/${recipientId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove recipient' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateRecipient = useMutation({
    mutationFn: async ({ recipientId, ...updates }: { recipientId: string; requires_signature?: boolean }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/recipients/${recipientId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update recipient' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    recipients: data || [],
    isLoading,
    error,
    refetch,
    addRecipient,
    removeRecipient,
    updateRecipient,
  };
}

export function useSendClearance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clearanceId,
      request,
    }: {
      clearanceId: string;
      request: ClearanceSendRequest;
    }): Promise<ClearanceSendResult> => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to send clearance' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: (_, { clearanceId }) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-recipients', clearanceId] });
    },
  });
}
