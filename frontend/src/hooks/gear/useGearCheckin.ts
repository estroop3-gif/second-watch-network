/**
 * Gear House Check-in Hooks
 * Data fetching and mutations for check-in workflow
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  MyCheckoutItem,
  MyCheckoutTransaction,
  CheckinSettings,
  LateInfo,
  CheckinStartResponse,
  CheckinConditionReport,
  DamageReportResult,
  CheckinReceipt,
  CheckinCompleteResponse,
  CheckinDamageTier,
  GearTransaction,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Gear Checkin API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[Gear Checkin API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[Gear Checkin API] Response:`, data);
  return data;
}

// ============================================================================
// MY CHECKOUTS HOOKS
// ============================================================================

export interface UseMyCheckoutsDetailedOptions {
  enabled?: boolean;
}

/**
 * Get the current user's active checkouts with full details
 */
export function useMyCheckoutsDetailed(
  orgId: string | null,
  options?: UseMyCheckoutsDetailedOptions
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['gear-my-checkouts-detailed', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/checkin/${orgId}/my-checkouts/detailed`, token!),
    enabled: !!token && !!orgId && (options?.enabled ?? true),
    select: (data) => data.checkouts as MyCheckoutTransaction[],
    refetchInterval: 60000, // Refetch every minute to catch overdue changes
  });

  return {
    checkouts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// CHECK-IN FLOW HOOKS
// ============================================================================

/**
 * Start a check-in from an existing transaction
 */
export function useStartCheckinFromTransaction(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (transactionId: string) =>
      fetchWithAuth(`/api/v1/gear/checkin/${orgId}/start/${transactionId}`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-my-checkouts-detailed', orgId] });
    },
  });

  return {
    startCheckin: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data as CheckinStartResponse | undefined,
    reset: mutation.reset,
  };
}

/**
 * Start a check-in by scanning an asset barcode
 */
export function useScanToCheckin(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (barcode: string) =>
      fetchWithAuth(`/api/v1/gear/checkin/${orgId}/scan-start`, token!, {
        method: 'POST',
        body: JSON.stringify({ barcode }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-my-checkouts-detailed', orgId] });
    },
  });

  return {
    scanToCheckin: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data as CheckinStartResponse | undefined,
    reset: mutation.reset,
  };
}

// ============================================================================
// PHOTO UPLOAD HOOKS
// ============================================================================

export interface IncidentPhotoUploadResult {
  s3_key: string;
  url: string;
  filename: string;
  size: number;
  content_type: string;
}

/**
 * Upload a photo for an incident/damage report
 * Returns the S3 key to include in the incident creation
 */
export function useUploadIncidentPhoto(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const mutation = useMutation({
    mutationFn: async ({
      assetId,
      file,
    }: {
      assetId: string;
      file: File;
    }): Promise<IncidentPhotoUploadResult> => {
      if (!token || !orgId) {
        throw new Error('Not authenticated or missing organization');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('asset_id', assetId);

      const fullUrl = `${API_BASE}/api/v1/gear/incidents/${orgId}/upload-photo`;
      console.log(`[Gear Checkin API] POST ${fullUrl} (photo upload)`);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: Don't set Content-Type - browser will set it with boundary for FormData
        },
        body: formData,
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
    },
  });

  return {
    uploadPhoto: mutation.mutateAsync,
    isUploading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

// ============================================================================
// DAMAGE REPORTING HOOKS
// ============================================================================

export interface DamageReportInput {
  asset_id: string;
  damage_tier: CheckinDamageTier;
  description: string;
  photos?: string[];
}

/**
 * Report damage found during check-in
 */
export function useReportDamage(orgId: string | null, transactionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: DamageReportInput) =>
      fetchWithAuth(`/api/v1/gear/checkin/${orgId}/${transactionId}/damage`, token!, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-assets', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-incidents', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-repairs', orgId] });
    },
  });

  return {
    reportDamage: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data as DamageReportResult | undefined,
    reset: mutation.reset,
  };
}

// ============================================================================
// COMPLETE CHECK-IN HOOKS
// ============================================================================

export interface CompleteCheckinInput {
  items_to_return: string[];
  condition_reports?: CheckinConditionReport[];
  checkin_location_id?: string;
  notes?: string;
}

/**
 * Complete the check-in process
 */
export function useCompleteCheckin(orgId: string | null, transactionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: CompleteCheckinInput) =>
      fetchWithAuth(`/api/v1/gear/checkin/${orgId}/${transactionId}/complete`, token!, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['gear-my-checkouts-detailed', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-incidents', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-repairs', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-transaction', transactionId] });
    },
  });

  return {
    completeCheckin: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    data: mutation.data as CheckinCompleteResponse | undefined,
    reset: mutation.reset,
  };
}

// ============================================================================
// RECEIPT HOOKS
// ============================================================================

/**
 * Get receipt data for a completed check-in
 */
export function useCheckinReceipt(orgId: string | null, transactionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['gear-checkin-receipt', orgId, transactionId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/checkin/${orgId}/${transactionId}/receipt`, token!),
    enabled: !!token && !!orgId && !!transactionId,
    select: (data) => data.receipt as CheckinReceipt,
  });

  return {
    receipt: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// SETTINGS HOOKS
// ============================================================================

/**
 * Get the organization's check-in settings
 */
export function useCheckinSettings(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['gear-checkin-settings', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/checkin/${orgId}/settings`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.settings as CheckinSettings,
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// COMBINED HOOK FOR FULL CHECK-IN WORKFLOW
// ============================================================================

/**
 * Combined hook for managing a complete check-in session
 */
export function useCheckinSession(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // State for the current transaction being checked in
  const startFromTransaction = useStartCheckinFromTransaction(orgId);
  const scanStart = useScanToCheckin(orgId);

  // Get combined data
  const currentCheckin = startFromTransaction.data || scanStart.data;

  // Damage reporting - uses current transaction if available
  const damageReport = useReportDamage(
    orgId,
    currentCheckin?.transaction?.id ?? null
  );

  // Complete check-in
  const complete = useCompleteCheckin(
    orgId,
    currentCheckin?.transaction?.id ?? null
  );

  // Reset all state
  const reset = () => {
    startFromTransaction.reset();
    scanStart.reset();
    damageReport.reset();
    complete.reset();
  };

  return {
    // Start check-in
    startFromTransaction: startFromTransaction.startCheckin,
    scanStart: scanStart.scanToCheckin,

    // Current check-in data
    transaction: currentCheckin?.transaction,
    lateInfo: currentCheckin?.late_info,
    settings: currentCheckin?.settings,
    canCheckin: currentCheckin?.can_checkin ?? false,

    // Damage reporting
    reportDamage: damageReport.reportDamage,
    damageResult: damageReport.data,

    // Complete
    complete: complete.completeCheckin,
    result: complete.data,

    // Loading states
    isStarting: startFromTransaction.isLoading || scanStart.isLoading,
    isReportingDamage: damageReport.isLoading,
    isCompleting: complete.isLoading,

    // Errors
    startError: startFromTransaction.error || scanStart.error,
    damageError: damageReport.error,
    completeError: complete.error,

    // Reset
    reset,
  };
}
