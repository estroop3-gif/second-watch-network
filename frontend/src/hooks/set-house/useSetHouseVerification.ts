/**
 * Set House Verification Hook
 * Booking start/end verification sessions
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  VerificationSession,
  VerificationItem,
  VerificationDiscrepancy,
  VerificationStatus,
  VerificationType,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;

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

// Fetch without auth for public verification endpoints
async function fetchPublic(url: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

// ============================================================================
// AUTHENTICATED VERIFICATION HOOKS
// ============================================================================

export interface UseSetHouseVerificationSessionsOptions {
  status?: VerificationStatus;
  verificationType?: VerificationType;
  limit?: number;
  offset?: number;
}

export function useSetHouseVerificationSessions(orgId: string | null, options?: UseSetHouseVerificationSessionsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.verificationType) queryParams.append('verification_type', options.verificationType);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/verification/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-verification-sessions', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      sessions: data.sessions as VerificationSession[],
      total: data.total as number,
    }),
  });

  const createSession = useMutation({
    mutationFn: (input: {
      transaction_id: string;
      verification_type: VerificationType;
      items_to_verify?: Array<{ space_id?: string; package_instance_id?: string }>;
    }) =>
      fetchWithAuth(`/api/v1/set-house/verification/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-verification-sessions', orgId] });
    },
  });

  return {
    sessions: query.data?.sessions ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createSession,
  };
}

export function useSetHouseVerificationSession(orgId: string | null, sessionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-verification-session', orgId, sessionId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/verification/${orgId}/${sessionId}`, token!),
    enabled: !!token && !!orgId && !!sessionId,
    select: (data) => data.session as VerificationSession,
  });

  const startVerification = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/set-house/verification/${orgId}/${sessionId}/start`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-verification-session', orgId, sessionId] });
    },
  });

  const verifyItem = useMutation({
    mutationFn: (input: {
      space_id?: string;
      package_instance_id?: string;
      condition_grade?: string;
      condition_notes?: string;
      photos?: string[];
    }) =>
      fetchWithAuth(`/api/v1/set-house/verification/${orgId}/${sessionId}/verify-item`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-verification-session', orgId, sessionId] });
    },
  });

  const captureSignature = useMutation({
    mutationFn: (signatureUrl: string) =>
      fetchWithAuth(`/api/v1/set-house/verification/${orgId}/${sessionId}/signature`, token!, {
        method: 'POST',
        body: JSON.stringify({ signature_url: signatureUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-verification-session', orgId, sessionId] });
    },
  });

  const completeVerification = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/set-house/verification/${orgId}/${sessionId}/complete`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-verification-session', orgId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-verification-sessions', orgId] });
    },
  });

  return {
    session: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    startVerification,
    verifyItem,
    captureSignature,
    completeVerification,
  };
}

// ============================================================================
// PUBLIC VERIFICATION HOOKS (for async links)
// ============================================================================

export function useSetHousePublicVerification(token: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-public-verification', token],
    queryFn: () => fetchPublic(`/api/v1/set-house/verification/public/${token}`),
    enabled: !!token,
    select: (data) => data.session as VerificationSession & {
      organization_name?: string;
      transaction_reference?: string;
      items_to_verify: Array<{
        space_id: string;
        space_name: string;
        space_internal_id: string;
        package_name?: string;
      }>;
    },
  });

  const verifyItem = useMutation({
    mutationFn: (input: {
      space_id?: string;
      package_instance_id?: string;
      condition_grade?: string;
      condition_notes?: string;
      photos?: string[];
    }) =>
      fetchPublic(`/api/v1/set-house/verification/public/${token}/verify-item`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-public-verification', token] });
    },
  });

  const captureSignature = useMutation({
    mutationFn: (signatureUrl: string) =>
      fetchPublic(`/api/v1/set-house/verification/public/${token}/signature`, {
        method: 'POST',
        body: JSON.stringify({ signature_url: signatureUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-public-verification', token] });
    },
  });

  const completeVerification = useMutation({
    mutationFn: () =>
      fetchPublic(`/api/v1/set-house/verification/public/${token}/complete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-public-verification', token] });
    },
  });

  return {
    session: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    verifyItem,
    captureSignature,
    completeVerification,
  };
}
