/**
 * Set House Checkin Hook
 * Booking end (check-in) flow with condition assessment
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseTransaction,
  BookingEndConditionReport,
  BookingEndSettings,
  BookingEndStartResponse,
  BookingEndReceipt,
  LateInfo,
  MyBookingTransaction,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Set House Checkin API] ${options?.method || 'GET'} ${fullUrl}`);

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

/**
 * Hook to get the current user's active bookings that can be ended
 */
export function useMySetHouseBookings(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-my-bookings', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/transactions/${orgId}/my-active-bookings`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.bookings as MyBookingTransaction[],
  });
}

/**
 * Hook to start the booking end process for a transaction
 */
export function useSetHouseBookingEndStart(orgId: string | null, transactionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-booking-end-start', orgId, transactionId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/transactions/${orgId}/${transactionId}/end-booking/start`, token!),
    enabled: !!token && !!orgId && !!transactionId,
    select: (data) => data as BookingEndStartResponse,
  });
}

/**
 * Hook to complete a booking end
 */
export function useSetHouseBookingEndComplete(orgId: string | null, transactionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const completeBookingEnd = useMutation({
    mutationFn: (input: {
      spaces_to_return: string[];
      condition_reports: BookingEndConditionReport[];
      notes?: string;
    }) =>
      fetchWithAuth(`/api/v1/set-house/transactions/${orgId}/${transactionId}/end-booking/complete`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-my-bookings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-transaction', orgId, transactionId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  return {
    completeBookingEnd,
  };
}

/**
 * Hook for quick booking end (simplified flow)
 */
export function useSetHouseQuickBookingEnd(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const quickBookingEnd = useMutation({
    mutationFn: (input: {
      space_ids: string[];
      condition_reports?: BookingEndConditionReport[];
      notes?: string;
    }) =>
      fetchWithAuth(`/api/v1/set-house/transactions/${orgId}/quick-checkin`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-my-bookings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  return {
    quickBookingEnd,
  };
}

/**
 * Hook to report damage during booking end
 */
export function useSetHouseReportDamage(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const reportDamage = useMutation({
    mutationFn: (input: {
      space_id: string;
      transaction_id?: string;
      damage_tier: string;
      damage_description: string;
      photos?: string[];
      create_repair_ticket?: boolean;
    }) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify({
          incident_type: 'damage',
          ...input,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incidents', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  return {
    reportDamage,
  };
}

/**
 * Hook to get booking end receipt after completion
 */
export function useSetHouseBookingEndReceipt(orgId: string | null, transactionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-booking-end-receipt', orgId, transactionId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/transactions/${orgId}/${transactionId}/end-booking/receipt`, token!),
    enabled: !!token && !!orgId && !!transactionId,
    select: (data) => data.receipt as BookingEndReceipt,
  });
}
