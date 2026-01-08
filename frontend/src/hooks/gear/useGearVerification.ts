/**
 * Gear House Verification Hooks
 * Data fetching and mutations for checkout/check-in verification
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  VerificationSession,
  VerificationItem,
  VerificationType,
  VerificationStatus,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Gear Verification API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[Gear Verification API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[Gear Verification API] Response:`, data);
  return data;
}

async function fetchPublic(url: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Gear Verification API Public] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[Gear Verification API Public] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[Gear Verification API Public] Response:`, data);
  return data;
}

// ============================================================================
// TYPES
// ============================================================================

export interface CreateSessionInput {
  transaction_id: string;
  verification_type: VerificationType;
  items: VerificationItem[];
}

export interface VerifyItemInput {
  item_id: string;
  method?: 'scan' | 'checkoff';
  notes?: string;
}

export interface DiscrepancyInput {
  item_id: string;
  issue_type: 'missing' | 'damaged' | 'wrong_item' | 'extra_item';
  notes?: string;
}

export interface SendAsyncLinkInput {
  email: string;
  expires_hours?: number;
}

export interface VerificationProgress {
  total: number;
  verified: number;
  remaining: number;
  percentage: number;
}

// ============================================================================
// AUTHENTICATED SESSION HOOKS
// ============================================================================

export interface UseVerificationSessionsOptions {
  orgId: string | null;
  transactionId?: string;
  status?: VerificationStatus;
  verificationType?: VerificationType;
  limit?: number;
  offset?: number;
}

export function useVerificationSessions(options: UseVerificationSessionsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { orgId, transactionId, status, verificationType, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-verification-sessions', { orgId, transactionId, status, verificationType, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (transactionId) params.set('transaction_id', transactionId);
      if (status) params.set('status', status);
      if (verificationType) params.set('verification_type', verificationType);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  const createSession = useMutation({
    mutationFn: (input: CreateSessionInput) =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-sessions'] });
    },
  });

  return {
    sessions: (query.data?.sessions ?? []) as VerificationSession[],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createSession,
  };
}

export function useVerificationSession(orgId: string | null, sessionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-verification-session', orgId, sessionId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}`, token!),
    enabled: !!token && !!orgId && !!sessionId,
    select: (data) => data.session as VerificationSession,
  });

  const startVerification = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/start`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
    },
  });

  const verifyItem = useMutation({
    mutationFn: (input: VerifyItemInput) =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/verify-item`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
    },
  });

  const reportDiscrepancy = useMutation({
    mutationFn: (input: DiscrepancyInput) =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/report-discrepancy`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
    },
  });

  const acknowledgeDiscrepancies = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/acknowledge-discrepancies`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
    },
  });

  const captureSignature = useMutation({
    mutationFn: (signatureData: string) =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/signature`, token!, {
        method: 'POST',
        body: JSON.stringify({ signature_data: signatureData }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
    },
  });

  const completeVerification = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/complete`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['gear-verification-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['gear-transactions'] });
    },
  });

  const sendAsyncLink = useMutation({
    mutationFn: (input: SendAsyncLinkInput) =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/send-async-link`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
    },
  });

  const cancelSession = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/verification/${orgId}/sessions/${sessionId}/cancel`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-verification-session', orgId, sessionId] });
      queryClient.invalidateQueries({ queryKey: ['gear-verification-sessions'] });
    },
  });

  // Calculate progress from session data
  const getProgress = (): VerificationProgress | null => {
    if (!query.data) return null;
    const itemsToVerify = query.data.items_to_verify || [];
    const itemsVerified = query.data.items_verified || [];
    const total = itemsToVerify.length;
    const verified = itemsVerified.length;
    return {
      total,
      verified,
      remaining: total - verified,
      percentage: total > 0 ? Math.round((verified / total) * 100) : 100,
    };
  };

  return {
    session: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    progress: getProgress(),
    startVerification,
    verifyItem,
    reportDiscrepancy,
    acknowledgeDiscrepancies,
    captureSignature,
    completeVerification,
    sendAsyncLink,
    cancelSession,
  };
}

// ============================================================================
// PUBLIC TOKEN-BASED HOOKS (No auth required)
// ============================================================================

export function usePublicVerificationSession(token: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-public-verification', token],
    queryFn: () => fetchPublic(`/api/v1/gear/verification/public/${token}`),
    enabled: !!token,
    select: (data) => data.session as VerificationSession,
    retry: false, // Don't retry on 404 or expired
  });

  const verifyItem = useMutation({
    mutationFn: (input: VerifyItemInput) =>
      fetchPublic(`/api/v1/gear/verification/public/${token}/verify-item`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-public-verification', token] });
    },
  });

  const captureSignature = useMutation({
    mutationFn: (signatureData: string) =>
      fetchPublic(`/api/v1/gear/verification/public/${token}/signature`, {
        method: 'POST',
        body: JSON.stringify({ signature_data: signatureData }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-public-verification', token] });
    },
  });

  const completeVerification = useMutation({
    mutationFn: () =>
      fetchPublic(`/api/v1/gear/verification/public/${token}/complete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-public-verification', token] });
    },
  });

  // Calculate progress from session data
  const getProgress = (): VerificationProgress | null => {
    if (!query.data) return null;
    const itemsToVerify = query.data.items_to_verify || [];
    const itemsVerified = query.data.items_verified || [];
    const total = itemsToVerify.length;
    const verified = itemsVerified.length;
    return {
      total,
      verified,
      remaining: total - verified,
      percentage: total > 0 ? Math.round((verified / total) * 100) : 100,
    };
  };

  return {
    session: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    progress: getProgress(),
    verifyItem,
    captureSignature,
    completeVerification,
  };
}

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to check if verification is required for a given transaction type
 * based on organization settings
 */
export function useVerificationRequirements(orgId: string | null, transactionType: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-verification-requirements', orgId, transactionType],
    queryFn: async () => {
      // Fetch org settings
      const data = await fetchWithAuth(`/api/v1/gear/organizations/${orgId}/settings`, token!);
      const settings = data.settings;

      // Determine if this is a team or client transaction
      const isRental = transactionType?.includes('rental');

      return {
        senderVerificationRequired: isRental
          ? settings.client_checkout_verification_required
          : settings.team_checkout_verification_required,
        verifyMethod: isRental
          ? settings.client_checkout_verify_method
          : settings.team_checkout_verify_method,
        discrepancyAction: isRental
          ? settings.client_checkout_discrepancy_action
          : settings.team_checkout_discrepancy_action,
        kitVerification: isRental
          ? settings.client_checkout_kit_verification
          : settings.team_checkout_kit_verification,
        receiverVerificationMode: settings.receiver_verification_mode,
        receiverVerificationTiming: settings.receiver_verification_timing,
        checkinVerificationRequired: settings.checkin_verification_required,
        checkinVerifyMethod: settings.checkin_verify_method,
        checkinKitVerification: settings.checkin_kit_verification,
      };
    },
    enabled: !!token && !!orgId && !!transactionType,
  });
}

/**
 * Hook to create verification items from transaction items
 */
export function useCreateVerificationItems() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: async ({
      orgId,
      items,
      kitVerification,
    }: {
      orgId: string;
      items: Array<{ asset_id?: string; kit_instance_id?: string }>;
      kitVerification: 'kit_only' | 'verify_contents';
    }) => {
      const verificationItems: VerificationItem[] = [];

      for (const item of items) {
        if (item.asset_id) {
          // Fetch asset details
          const assetData = await fetchWithAuth(`/api/v1/gear/assets/item/${item.asset_id}`, token!);
          const asset = assetData.asset;
          verificationItems.push({
            id: asset.id,
            type: 'asset',
            name: asset.name,
            internal_id: asset.internal_id,
            status: 'pending',
          });
        } else if (item.kit_instance_id) {
          // Fetch kit details
          const kitData = await fetchWithAuth(`/api/v1/gear/kits/instances/item/${item.kit_instance_id}`, token!);
          const kit = kitData.kit;

          // Add kit itself
          verificationItems.push({
            id: kit.id,
            type: 'kit',
            name: kit.name,
            internal_id: kit.internal_id,
            status: 'pending',
          });

          // If verify_contents, add individual items
          if (kitVerification === 'verify_contents' && kit.assets) {
            for (const asset of kit.assets) {
              verificationItems.push({
                id: asset.id,
                type: 'asset',
                name: asset.name,
                internal_id: asset.internal_id,
                parent_kit_id: kit.id,
                status: 'pending',
              });
            }
          }
        }
      }

      return verificationItems;
    },
  });
}
