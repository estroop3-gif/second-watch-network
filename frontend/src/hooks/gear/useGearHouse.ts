/**
 * Gear House Hooks
 * Data fetching and mutations for equipment management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  GearOrganization,
  GearOrganizationMember,
  GearOrganizationSettings,
  GearCategory,
  GearLocation,
  GearAsset,
  GearAssetHistory,
  GearKitTemplate,
  GearKitInstance,
  GearTransaction,
  GearIncident,
  GearRepairTicket,
  GearVendor,
  GearStrike,
  GearUserEscalationStatus,
  GearStrikeRule,
  CreateOrganizationInput,
  CreateAssetInput,
  CreateTransactionInput,
  CreateIncidentInput,
  CreateRepairTicketInput,
  CreateStrikeInput,
  AssetStatus,
  AssetCondition,
  TransactionType,
  TransactionStatus,
  IncidentType,
  IncidentStatus,
  RepairStatus,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================================
// ORGANIZATION HOOKS
// ============================================================================

export interface UseGearOrganizationsOptions {
  enabled?: boolean;
}

export function useGearOrganizations(options?: UseGearOrganizationsOptions) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-organizations'],
    queryFn: () => fetchWithAuth('/api/v1/gear/organizations', token!),
    enabled: !!token && (options?.enabled ?? true),
    select: (data) => data.organizations as GearOrganization[],
  });

  const createOrganization = useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      fetchWithAuth('/api/v1/gear/organizations', token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-organizations'] });
    },
  });

  return {
    organizations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createOrganization,
  };
}

export function useGearOrganization(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-organization', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.organization as GearOrganization,
  });

  const updateOrganization = useMutation({
    mutationFn: (input: Partial<GearOrganization>) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-organization', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-organizations'] });
    },
  });

  return {
    organization: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateOrganization,
  };
}

export function useGearOrgMembers(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-org-members', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/members`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.members as GearOrganizationMember[],
  });

  const addMember = useMutation({
    mutationFn: (input: { user_id: string; role: string }) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/members`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-org-members', orgId] });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/members/${memberId}`, token!, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-org-members', orgId] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/members/${memberId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-org-members', orgId] });
    },
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addMember,
    updateMemberRole,
    removeMember,
  };
}

export function useGearOrgSettings(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-org-settings', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/settings`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.settings as GearOrganizationSettings,
  });

  const updateSettings = useMutation({
    mutationFn: (input: Partial<GearOrganizationSettings>) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/settings`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-org-settings', orgId] });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateSettings,
  };
}

export function useGearCategories(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-categories', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/categories`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.categories as GearCategory[],
  });

  const createCategory = useMutation({
    mutationFn: (input: Partial<GearCategory>) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/categories`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-categories', orgId] });
    },
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createCategory,
  };
}

export function useGearLocations(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-locations', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/locations`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.locations as GearLocation[],
  });

  const createLocation = useMutation({
    mutationFn: (input: Partial<GearLocation>) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/locations`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-locations', orgId] });
    },
  });

  return {
    locations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createLocation,
  };
}

// ============================================================================
// ASSET HOOKS
// ============================================================================

export interface UseGearAssetsOptions {
  orgId: string | null;
  categoryId?: string;
  status?: AssetStatus;
  condition?: AssetCondition;
  search?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useGearAssets(options: UseGearAssetsOptions) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { orgId, categoryId, status, condition, search, limit = 50, offset = 0, enabled = true } = options;

  const queryKey = ['gear-assets', { orgId, categoryId, status, condition, search, limit, offset }];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryId) params.set('category_id', categoryId);
      if (status) params.set('status', status);
      if (condition) params.set('condition', condition);
      if (search) params.set('search', search);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/assets/${orgId}?${params}`, token!);
    },
    enabled: !!token && !!orgId && enabled,
  });

  const createAsset = useMutation({
    mutationFn: (input: CreateAssetInput) =>
      fetchWithAuth(`/api/v1/gear/assets/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  const bulkCreateAssets = useMutation({
    mutationFn: (assets: CreateAssetInput[]) =>
      fetchWithAuth(`/api/v1/gear/assets/${orgId}/bulk`, token!, {
        method: 'POST',
        body: JSON.stringify({ assets }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  return {
    assets: (query.data?.assets ?? []) as GearAsset[],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createAsset,
    bulkCreateAssets,
  };
}

export function useGearAsset(assetId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-asset', assetId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/assets/item/${assetId}`, token!),
    enabled: !!token && !!assetId,
    select: (data) => data.asset as GearAsset,
  });

  const updateAsset = useMutation({
    mutationFn: (input: Partial<GearAsset>) =>
      fetchWithAuth(`/api/v1/gear/assets/item/${assetId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-asset', assetId] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ status, notes }: { status: AssetStatus; notes?: string }) =>
      fetchWithAuth(`/api/v1/gear/assets/item/${assetId}/status`, token!, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-asset', assetId] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  return {
    asset: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateAsset,
    updateStatus,
  };
}

export function useGearAssetHistory(assetId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-asset-history', assetId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/assets/item/${assetId}/history`, token!),
    enabled: !!token && !!assetId,
    select: (data) => data.history as GearAssetHistory[],
  });
}

export function useGearAssetStats(orgId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-asset-stats', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/assets/${orgId}/stats`, token!),
    enabled: !!token && !!orgId,
  });
}

export function useGearScanLookup(orgId: string | null) {
  const { token } = useAuth();

  const lookupAsset = useMutation({
    mutationFn: (scanCode: string) =>
      fetchWithAuth(`/api/v1/gear/assets/scan/${orgId}/${encodeURIComponent(scanCode)}`, token!),
  });

  return { lookupAsset };
}

// ============================================================================
// KIT HOOKS
// ============================================================================

export function useGearKitTemplates(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-kit-templates', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/kits/${orgId}/templates`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.templates as GearKitTemplate[],
  });

  const createTemplate = useMutation({
    mutationFn: (input: Partial<GearKitTemplate> & { items?: Array<{ category_id?: string; specific_asset_id?: string; quantity: number; is_required: boolean }> }) =>
      fetchWithAuth(`/api/v1/gear/kits/${orgId}/templates`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-templates', orgId] });
    },
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createTemplate,
  };
}

export function useGearKitInstances(orgId: string | null, options?: { status?: AssetStatus }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-kit-instances', orgId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.status) params.set('status', options.status);
      return fetchWithAuth(`/api/v1/gear/kits/${orgId}/instances?${params}`, token!);
    },
    enabled: !!token && !!orgId,
    select: (data) => data.instances as GearKitInstance[],
  });

  const createInstance = useMutation({
    mutationFn: (input: { template_id?: string; name: string; asset_ids?: string[] }) =>
      fetchWithAuth(`/api/v1/gear/kits/${orgId}/instances`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-instances', orgId] });
    },
  });

  return {
    instances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createInstance,
  };
}

export function useGearKitInstance(kitId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-kit-instance', kitId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/kits/instance/${kitId}`, token!),
    enabled: !!token && !!kitId,
    select: (data) => data.kit as GearKitInstance,
  });

  const addAsset = useMutation({
    mutationFn: (assetId: string) =>
      fetchWithAuth(`/api/v1/gear/kits/instance/${kitId}/add-asset`, token!, {
        method: 'POST',
        body: JSON.stringify({ asset_id: assetId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-instance', kitId] });
    },
  });

  const removeAsset = useMutation({
    mutationFn: (assetId: string) =>
      fetchWithAuth(`/api/v1/gear/kits/instance/${kitId}/remove-asset`, token!, {
        method: 'POST',
        body: JSON.stringify({ asset_id: assetId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-instance', kitId] });
    },
  });

  const verifyContents = useMutation({
    mutationFn: (scannedAssetIds: string[]) =>
      fetchWithAuth(`/api/v1/gear/kits/instance/${kitId}/verify`, token!, {
        method: 'POST',
        body: JSON.stringify({ scanned_asset_ids: scannedAssetIds }),
      }),
  });

  return {
    kit: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addAsset,
    removeAsset,
    verifyContents,
  };
}

// ============================================================================
// TRANSACTION HOOKS
// ============================================================================

export interface UseGearTransactionsOptions {
  orgId: string | null;
  transactionType?: TransactionType;
  status?: TransactionStatus;
  custodianId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export function useGearTransactions(options: UseGearTransactionsOptions) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { orgId, transactionType, status, custodianId, projectId, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-transactions', { orgId, transactionType, status, custodianId, projectId, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (transactionType) params.set('transaction_type', transactionType);
      if (status) params.set('status', status);
      if (custodianId) params.set('custodian_id', custodianId);
      if (projectId) params.set('project_id', projectId);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/transactions/${orgId}?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  const createTransaction = useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  const quickCheckout = useMutation({
    mutationFn: (input: {
      asset_ids: string[];
      custodian_user_id: string;
      project_id?: string;
      expected_return_at?: string;
      notes?: string;
    }) =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}/quick-checkout`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
      queryClient.invalidateQueries({ queryKey: ['gear-my-checkouts'] });
    },
  });

  const quickCheckin = useMutation({
    mutationFn: (input: { asset_ids: string[]; location_id?: string; notes?: string }) =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}/quick-checkin`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
      queryClient.invalidateQueries({ queryKey: ['gear-my-checkouts'] });
    },
  });

  return {
    transactions: (query.data?.transactions ?? []) as GearTransaction[],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createTransaction,
    quickCheckout,
    quickCheckin,
  };
}

export function useGearTransaction(transactionId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-transaction', transactionId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/transactions/item/${transactionId}`, token!),
    enabled: !!token && !!transactionId,
    select: (data) => data.transaction as GearTransaction,
  });

  const recordScan = useMutation({
    mutationFn: (input: { asset_id: string; scan_type: 'out' | 'in'; condition?: AssetCondition }) =>
      fetchWithAuth(`/api/v1/gear/transactions/item/${transactionId}/scan`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-transaction', transactionId] });
    },
  });

  const completeCheckout = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/transactions/item/${transactionId}/complete-checkout`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-transaction', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['gear-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  const completeCheckin = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/transactions/item/${transactionId}/complete-checkin`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-transaction', transactionId] });
      queryClient.invalidateQueries({ queryKey: ['gear-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  return {
    transaction: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    recordScan,
    completeCheckout,
    completeCheckin,
  };
}

export function useGearMyCheckouts(orgId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-my-checkouts', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/transactions/${orgId}/my-checkouts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.assets as GearAsset[],
  });
}

export function useGearOverdue(orgId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-overdue', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/transactions/${orgId}/overdue`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.overdue as GearTransaction[],
  });
}

// ============================================================================
// INCIDENT HOOKS
// ============================================================================

export interface UseGearIncidentsOptions {
  orgId: string | null;
  incidentType?: IncidentType;
  status?: IncidentStatus;
  assetId?: string;
  limit?: number;
  offset?: number;
}

export function useGearIncidents(options: UseGearIncidentsOptions) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { orgId, incidentType, status, assetId, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-incidents', { orgId, incidentType, status, assetId, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (incidentType) params.set('incident_type', incidentType);
      if (status) params.set('status', status);
      if (assetId) params.set('asset_id', assetId);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/incidents/${orgId}?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  const createIncident = useMutation({
    mutationFn: (input: CreateIncidentInput) =>
      fetchWithAuth(`/api/v1/gear/incidents/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-incidents'] });
    },
  });

  return {
    incidents: (query.data?.incidents ?? []) as GearIncident[],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createIncident,
  };
}

export function useGearIncident(incidentId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-incident', incidentId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/incidents/item/${incidentId}`, token!),
    enabled: !!token && !!incidentId,
    select: (data) => data.incident as GearIncident,
  });

  const updateIncident = useMutation({
    mutationFn: (input: Partial<GearIncident>) =>
      fetchWithAuth(`/api/v1/gear/incidents/item/${incidentId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['gear-incidents'] });
    },
  });

  const resolveIncident = useMutation({
    mutationFn: (resolutionNotes: string) =>
      fetchWithAuth(`/api/v1/gear/incidents/item/${incidentId}/resolve`, token!, {
        method: 'POST',
        body: JSON.stringify({ resolution_notes: resolutionNotes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['gear-incidents'] });
    },
  });

  return {
    incident: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateIncident,
    resolveIncident,
  };
}

export function useGearIncidentStats(orgId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-incident-stats', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/incidents/${orgId}/stats`, token!),
    enabled: !!token && !!orgId,
  });
}

// ============================================================================
// REPAIR HOOKS
// ============================================================================

export interface UseGearRepairsOptions {
  orgId: string | null;
  status?: RepairStatus;
  assetId?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

export function useGearRepairs(options: UseGearRepairsOptions) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { orgId, status, assetId, assignedTo, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-repairs', { orgId, status, assetId, assignedTo, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (assetId) params.set('asset_id', assetId);
      if (assignedTo) params.set('assigned_to', assignedTo);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/repairs/${orgId}?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  const createTicket = useMutation({
    mutationFn: (input: CreateRepairTicketInput) =>
      fetchWithAuth(`/api/v1/gear/repairs/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-repairs'] });
    },
  });

  return {
    tickets: (query.data?.tickets ?? []) as GearRepairTicket[],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createTicket,
  };
}

export function useGearRepairTicket(ticketId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-repair-ticket', ticketId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/repairs/item/${ticketId}`, token!),
    enabled: !!token && !!ticketId,
    select: (data) => data.ticket as GearRepairTicket,
  });

  const updateTicket = useMutation({
    mutationFn: (input: Partial<GearRepairTicket>) =>
      fetchWithAuth(`/api/v1/gear/repairs/item/${ticketId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-repair-ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['gear-repairs'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (input: {
      status: RepairStatus;
      notes?: string;
      diagnosis?: string;
      quote_amount?: number;
      quote_approved?: boolean;
      total_cost?: number;
      qc_passed?: boolean;
      qc_notes?: string;
    }) =>
      fetchWithAuth(`/api/v1/gear/repairs/item/${ticketId}/status`, token!, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-repair-ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['gear-repairs'] });
    },
  });

  return {
    ticket: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateTicket,
    updateStatus,
  };
}

export function useGearRepairStats(orgId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-repair-stats', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/repairs/${orgId}/stats`, token!),
    enabled: !!token && !!orgId,
  });
}

export function useGearVendors(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-vendors', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/repairs/${orgId}/vendors`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.vendors as GearVendor[],
  });

  const createVendor = useMutation({
    mutationFn: (input: Partial<GearVendor>) =>
      fetchWithAuth(`/api/v1/gear/repairs/${orgId}/vendors`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-vendors', orgId] });
    },
  });

  return {
    vendors: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createVendor,
  };
}

// ============================================================================
// STRIKE HOOKS
// ============================================================================

export interface UseGearStrikesOptions {
  orgId: string | null;
  userId?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export function useGearStrikes(options: UseGearStrikesOptions) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { orgId, userId, activeOnly = true, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-strikes', { orgId, userId, activeOnly, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);
      params.set('active_only', activeOnly.toString());
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/strikes/${orgId}?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  const createStrike = useMutation({
    mutationFn: (input: CreateStrikeInput) =>
      fetchWithAuth(`/api/v1/gear/strikes/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-escalation-status'] });
    },
  });

  return {
    strikes: (query.data?.strikes ?? []) as GearStrike[],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createStrike,
  };
}

export function useGearUserStrikes(orgId: string | null, userId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-user-strikes', orgId, userId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/strikes/user/${orgId}/${userId}`, token!),
    enabled: !!token && !!orgId && !!userId,
    select: (data) => data.strikes as GearStrike[],
  });
}

export function useGearVoidStrike() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ strikeId, reason }: { strikeId: string; reason: string }) =>
      fetchWithAuth(`/api/v1/gear/strikes/item/${strikeId}/void`, token!, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-strikes'] });
      queryClient.invalidateQueries({ queryKey: ['gear-escalation-status'] });
    },
  });
}

export function useGearEscalationStatus(orgId: string | null, userId: string | null) {
  const { token } = useAuth();

  return useQuery({
    queryKey: ['gear-escalation-status', orgId, userId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/strikes/escalation/${orgId}/${userId}`, token!),
    enabled: !!token && !!orgId && !!userId,
    select: (data) => data.status as GearUserEscalationStatus,
  });
}

export function useGearPendingReviews(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-pending-reviews', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/strikes/escalation/${orgId}/pending-review`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.pending_reviews as GearUserEscalationStatus[],
  });

  const reviewEscalation = useMutation({
    mutationFn: ({ userId, decision, notes }: { userId: string; decision: string; notes?: string }) =>
      fetchWithAuth(`/api/v1/gear/strikes/escalation/${orgId}/${userId}/review`, token!, {
        method: 'POST',
        body: JSON.stringify({ decision, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-pending-reviews', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-escalation-status'] });
    },
  });

  return {
    pendingReviews: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    reviewEscalation,
  };
}

export function useGearStrikeRules(orgId: string | null) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-strike-rules', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/strikes/rules/${orgId}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.rules as GearStrikeRule[],
  });

  const updateRule = useMutation({
    mutationFn: ({ ruleId, ...input }: { ruleId: string } & Partial<GearStrikeRule>) =>
      fetchWithAuth(`/api/v1/gear/strikes/rules/${ruleId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-strike-rules', orgId] });
    },
  });

  return {
    rules: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateRule,
  };
}

// ============================================================================
// LABEL HOOKS
// ============================================================================

export function useGearLabels(orgId: string | null) {
  const { token } = useAuth();

  const getAssetBarcode = (assetId: string, format: 'svg' | 'png' = 'svg') =>
    `${API_BASE}/api/v1/gear/labels/asset/${assetId}/barcode?format=${format}`;

  const getAssetQR = (assetId: string, format: 'svg' | 'png' = 'svg') =>
    `${API_BASE}/api/v1/gear/labels/asset/${assetId}/qr?format=${format}`;

  const getAssetLabel = (assetId: string, labelType: 'barcode' | 'qr' | 'both' = 'both') =>
    `${API_BASE}/api/v1/gear/labels/asset/${assetId}/label?label_type=${labelType}`;

  const getKitLabel = (kitId: string, includeContents = false) =>
    `${API_BASE}/api/v1/gear/labels/kit/${kitId}/label?include_contents=${includeContents}`;

  const generateBatch = useMutation({
    mutationFn: async (input: {
      asset_ids: string[];
      label_type?: 'barcode' | 'qr' | 'both';
      include_name?: boolean;
      include_category?: boolean;
    }) => {
      const response = await fetch(`${API_BASE}/api/v1/gear/labels/${orgId}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset_ids: input.asset_ids,
          label_type: input.label_type ?? 'both',
          include_name: input.include_name ?? true,
          include_category: input.include_category ?? true,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate labels');
      return response.text();
    },
  });

  const generateCodes = useMutation({
    mutationFn: (assetIds: string[]) =>
      fetchWithAuth(`/api/v1/gear/labels/${orgId}/generate-codes`, token!, {
        method: 'POST',
        body: JSON.stringify(assetIds),
      }),
  });

  return {
    getAssetBarcode,
    getAssetQR,
    getAssetLabel,
    getKitLabel,
    generateBatch,
    generateCodes,
  };
}
