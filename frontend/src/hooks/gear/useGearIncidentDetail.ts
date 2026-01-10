/**
 * Gear Incident Detail Hook
 * Data fetching and mutations for incident workflow management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  GearIncident,
  GearRepairTicket,
  GearStrike,
  GearPurchaseRequest,
  AssetCustodianHistory,
  IncidentDetailResponse,
  IncidentCustodiansResponse,
  IncidentAssetInfo,
  IncidentStatus,
  IncidentResolutionType,
  StrikeSeverity,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Gear Incident API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[Gear Incident API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[Gear Incident API] Response:`, data);
  return data;
}

// ============================================================================
// TYPES
// ============================================================================

export interface IncidentStatusUpdateInput {
  status: IncidentStatus;
  resolution_type?: IncidentResolutionType;
}

export interface WriteOffInput {
  write_off_value: number;
  write_off_reason: string;
  create_purchase_request?: boolean;
  purchase_request_title?: string;
  estimated_replacement_cost?: number;
}

export interface StrikeAssignmentInput {
  user_id: string;
  severity: StrikeSeverity;
  reason: string;
  notes?: string;
}

// ============================================================================
// INCIDENT DETAIL HOOK
// ============================================================================

export interface UseGearIncidentDetailOptions {
  enabled?: boolean;
}

export function useGearIncidentDetail(
  incidentId: string | null,
  options?: UseGearIncidentDetailOptions
) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Fetch comprehensive incident details
  const query = useQuery({
    queryKey: ['gear-incident-detail', incidentId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/incidents/item/${incidentId}/detail`, token!),
    enabled: !!token && !!incidentId && (options?.enabled ?? true),
    select: (data): IncidentDetailResponse => ({
      incident: data.incident as GearIncident,
      asset: data.asset as IncidentAssetInfo | null,
      transactions: data.transactions as AssetCustodianHistory[],
      repairs: data.repairs as GearRepairTicket[],
      strikes: data.strikes as GearStrike[],
      purchase_requests: data.purchase_requests as GearPurchaseRequest[],
      recommended_custodian: data.recommended_custodian as AssetCustodianHistory | null,
    }),
  });

  // Update incident status
  const updateStatus = useMutation({
    mutationFn: (input: IncidentStatusUpdateInput) =>
      fetchWithAuth(`/api/v1/gear/incidents/item/${incidentId}/status`, token!, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-incident-detail', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['gear-incidents'] });
    },
  });

  // Write off asset
  const writeOff = useMutation({
    mutationFn: (input: WriteOffInput) =>
      fetchWithAuth(`/api/v1/gear/incidents/item/${incidentId}/write-off`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-incident-detail', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['gear-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
      queryClient.invalidateQueries({ queryKey: ['gear-purchase-requests'] });
    },
  });

  // Assign strike
  const assignStrike = useMutation({
    mutationFn: (input: StrikeAssignmentInput) =>
      fetchWithAuth(`/api/v1/gear/incidents/item/${incidentId}/strike`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-incident-detail', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['gear-strikes'] });
    },
  });

  return {
    // Data
    incident: query.data?.incident ?? null,
    asset: query.data?.asset ?? null,
    transactions: query.data?.transactions ?? [],
    repairs: query.data?.repairs ?? [],
    strikes: query.data?.strikes ?? [],
    purchaseRequests: query.data?.purchase_requests ?? [],
    recommendedCustodian: query.data?.recommended_custodian ?? null,
    // Query state
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    // Mutations
    updateStatus,
    writeOff,
    assignStrike,
  };
}

// ============================================================================
// CUSTODIANS HOOK
// ============================================================================

export interface UseAssetCustodiansOptions {
  days?: number;
  enabled?: boolean;
}

export function useAssetCustodians(
  incidentId: string | null,
  options?: UseAssetCustodiansOptions
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const days = options?.days ?? 30;

  const query = useQuery({
    queryKey: ['gear-incident-custodians', incidentId, days],
    queryFn: () =>
      fetchWithAuth(
        `/api/v1/gear/incidents/item/${incidentId}/custodians?days=${days}`,
        token!
      ),
    enabled: !!token && !!incidentId && (options?.enabled ?? true),
    select: (data): IncidentCustodiansResponse => ({
      custodians: data.custodians as AssetCustodianHistory[],
      recommended: data.recommended as AssetCustodianHistory | null,
    }),
  });

  return {
    custodians: query.data?.custodians ?? [],
    recommended: query.data?.recommended ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// PERMISSION CHECK HOOK
// ============================================================================

export function useIncidentManagementPermission(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['gear-incident-permission', orgId],
    queryFn: async () => {
      // This would ideally be a dedicated endpoint, but we can infer from org settings
      // For now, return true and handle permission checks on the server
      return { canManage: true };
    },
    enabled: !!token && !!orgId,
  });

  return {
    canManageIncidents: query.data?.canManage ?? false,
    isLoading: query.isLoading,
  };
}

export default useGearIncidentDetail;
