/**
 * Set House Incident Detail Hook
 * Detailed incident view with related data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseIncident,
  SetHouseRepairTicket,
  SetHouseStrike,
  IncidentDetailResponse,
  IncidentCustodiansResponse,
  SpaceCustodianHistory,
  CreateRepairTicketInput,
  CreateStrikeInput,
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

/**
 * Hook to get full incident details with related repairs, strikes, and custodian history
 */
export function useSetHouseIncidentDetail(orgId: string | null, incidentId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-incident-detail', orgId, incidentId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}/detail`, token!),
    enabled: !!token && !!orgId && !!incidentId,
    select: (data) => data as IncidentDetailResponse,
  });

  // Create repair ticket from incident
  const createRepairFromIncident = useMutation({
    mutationFn: (input: Omit<CreateRepairTicketInput, 'incident_id'>) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}/create-repair`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incident-detail', orgId, incidentId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-repairs', orgId] });
    },
  });

  // Create strike from incident
  const createStrikeFromIncident = useMutation({
    mutationFn: (input: Omit<CreateStrikeInput, 'incident_id'>) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}/create-strike`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incident-detail', orgId, incidentId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-strikes', orgId] });
    },
  });

  // Update incident
  const updateIncident = useMutation({
    mutationFn: (input: Partial<SetHouseIncident>) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incident-detail', orgId, incidentId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-incidents', orgId] });
    },
  });

  // Resolve incident
  const resolveIncident = useMutation({
    mutationFn: (input: { resolution_type: string; resolution_notes?: string; actual_cost?: number }) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}/resolve`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incident-detail', orgId, incidentId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-incidents', orgId] });
    },
  });

  return {
    incident: query.data?.incident,
    space: query.data?.space,
    transactions: query.data?.transactions ?? [],
    repairs: query.data?.repairs ?? [],
    strikes: query.data?.strikes ?? [],
    recommendedCustodian: query.data?.recommended_custodian,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createRepairFromIncident,
    createStrikeFromIncident,
    updateIncident,
    resolveIncident,
  };
}

/**
 * Hook to get custodian history for a space (for incident investigation)
 */
export function useSetHouseSpaceCustodians(orgId: string | null, spaceId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-space-custodians', orgId, spaceId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/space/${spaceId}/custodians`, token!),
    enabled: !!token && !!orgId && !!spaceId,
    select: (data) => ({
      custodians: data.custodians as SpaceCustodianHistory[],
      recommended: data.recommended as SpaceCustodianHistory | null,
    }),
  });
}
