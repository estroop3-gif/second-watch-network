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
  GearClientCompany,
  GearClientContact,
  CreateOrganizationInput,
  CreateAssetInput,
  CreateTransactionInput,
  CreateIncidentInput,
  CreateRepairTicketInput,
  CreateStrikeInput,
  CreateClientCompanyInput,
  CreateClientContactInput,
  LinkedProject,
  UserSearchResult,
  AssetStatus,
  AssetCondition,
  TransactionType,
  TransactionStatus,
  IncidentType,
  IncidentStatus,
  RepairStatus,
  IDType,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Gear API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[Gear API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[Gear API] Response:`, data);
  return data;
}

// ============================================================================
// ORGANIZATION HOOKS
// ============================================================================

export interface UseGearOrganizationsOptions {
  enabled?: boolean;
}

export function useGearOrganizations(options?: UseGearOrganizationsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-organizations'],
    queryFn: () => fetchWithAuth('/api/v1/gear/organizations/', token!),
    enabled: !!token && (options?.enabled ?? true),
    select: (data) => data.organizations as GearOrganization[],
  });

  const createOrganization = useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      fetchWithAuth('/api/v1/gear/organizations/', token!, {
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
    onMutate: async (input) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['gear-org-settings', orgId] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['gear-org-settings', orgId]);

      // Optimistically update cache immediately
      queryClient.setQueryData(['gear-org-settings', orgId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          settings: { ...old.settings, ...input }
        };
      });

      return { previousData };
    },
    onError: (_err, _input, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['gear-org-settings', orgId], context.previousData);
      }
    },
    // No onSuccess invalidation - the optimistic update already has the correct data
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
// CONTACT HOOKS (External custodians)
// ============================================================================

export interface GearContact {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Client management fields
  client_company_id?: string;
  client_company_name?: string;
  linked_user_id?: string;
  linked_user_name?: string;
  // Document fields
  id_photo_url?: string;
  id_photo_file_name?: string;
  id_type?: string;
  id_expiry?: string;
}

export interface CreateContactInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
}

export function useGearContacts(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-contacts', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.contacts as GearContact[],
  });

  const createContact = useMutation({
    mutationFn: (input: CreateContactInput) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  const updateContact = useMutation({
    mutationFn: ({ contactId, ...input }: Partial<CreateContactInput> & { contactId: string }) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts/${contactId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: (contactId: string) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts/${contactId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createContact,
    updateContact,
    deleteContact,
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-asset-history', assetId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/assets/item/${assetId}/history`, token!),
    enabled: !!token && !!assetId,
    select: (data) => data.history as GearAssetHistory[],
  });
}

export function useGearAssetStats(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-asset-stats', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/assets/${orgId}/stats`, token!),
    enabled: !!token && !!orgId,
  });
}

export function useGearScanLookup(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

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
  const { session } = useAuth();
  const token = session?.access_token;
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

export function useGearKitTemplate(templateId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-kit-template', templateId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/kits/templates/item/${templateId}`, token!),
    enabled: !!token && !!templateId,
    select: (data) => data.template as GearKitTemplate,
  });

  const updateTemplate = useMutation({
    mutationFn: (input: Partial<GearKitTemplate>) =>
      fetchWithAuth(`/api/v1/gear/kits/templates/item/${templateId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-template', templateId] });
      queryClient.invalidateQueries({ queryKey: ['gear-kit-templates'] });
    },
  });

  return {
    template: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateTemplate,
  };
}

export function useGearKitInstances(orgId: string | null, options?: { status?: AssetStatus }) {
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-kit-instance', kitId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/kits/instances/item/${kitId}`, token!),
    enabled: !!token && !!kitId,
    select: (data) => data.kit as GearKitInstance,
  });

  const updateInstance = useMutation({
    mutationFn: (input: Partial<GearKitInstance>) =>
      fetchWithAuth(`/api/v1/gear/kits/instances/item/${kitId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-instance', kitId] });
      queryClient.invalidateQueries({ queryKey: ['gear-kit-instances'] });
    },
  });

  const addAsset = useMutation({
    mutationFn: (assetId: string) =>
      fetchWithAuth(`/api/v1/gear/kits/instances/item/${kitId}/assets`, token!, {
        method: 'POST',
        body: JSON.stringify({ asset_id: assetId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-instance', kitId] });
    },
  });

  const removeAsset = useMutation({
    mutationFn: (assetId: string) =>
      fetchWithAuth(`/api/v1/gear/kits/instances/item/${kitId}/assets/${assetId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-kit-instance', kitId] });
    },
  });

  const verifyContents = useMutation({
    mutationFn: (scannedAssetIds: string[]) =>
      fetchWithAuth(`/api/v1/gear/kits/instances/item/${kitId}/verify`, token!, {
        method: 'POST',
        body: JSON.stringify({ scanned_assets: scannedAssetIds }),
      }),
  });

  return {
    kit: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateInstance,
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
  const { session } = useAuth();
  const token = session?.access_token;
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
      custodian_user_id?: string;
      custodian_contact_id?: string;
      project_id?: string;
      checkout_at?: string;
      expected_return_at?: string;
      destination_location_id?: string;
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
      queryClient.invalidateQueries({ queryKey: ['gear-contacts'] });
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-my-checkouts', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/transactions/${orgId}/my-checkouts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.assets as GearAsset[],
  });
}

export function useGearOverdue(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;

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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-repair-stats', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/repairs/${orgId}/stats`, token!),
    enabled: !!token && !!orgId,
  });
}

export function useGearVendors(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-user-strikes', orgId, userId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/strikes/user/${orgId}/${userId}`, token!),
    enabled: !!token && !!orgId && !!userId,
    select: (data) => data.strikes as GearStrike[],
  });
}

export function useGearVoidStrike() {
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-escalation-status', orgId, userId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/strikes/escalation/${orgId}/${userId}`, token!),
    enabled: !!token && !!orgId && !!userId,
    select: (data) => data.status as GearUserEscalationStatus,
  });
}

export function useGearPendingReviews(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;
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
  const { session } = useAuth();
  const token = session?.access_token;

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
      kit_ids?: string[];
      label_type?: 'barcode' | 'qr' | 'both';
      label_size?: string;
      print_mode?: 'sheet' | 'roll';
      printer_type?: string;
      sheet_rows?: number;
      sheet_columns?: number;
      custom_width_mm?: number;
      custom_height_mm?: number;
      include_name?: boolean;
      include_category?: boolean;
      include_internal_id?: boolean;
      include_serial_number?: boolean;
      include_manufacturer?: boolean;
      include_model?: boolean;
      include_purchase_date?: boolean;
      include_logo?: boolean;
      color_coding_enabled?: boolean;
    }) => {
      const response = await fetch(`${API_BASE}/api/v1/gear/labels/${orgId}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          asset_ids: input.asset_ids,
          kit_ids: input.kit_ids,
          label_type: input.label_type ?? 'both',
          label_size: input.label_size ?? '2x1',
          print_mode: input.print_mode ?? 'sheet',
          printer_type: input.printer_type ?? 'generic',
          sheet_rows: input.sheet_rows,
          sheet_columns: input.sheet_columns,
          custom_width_mm: input.custom_width_mm,
          custom_height_mm: input.custom_height_mm,
          include_name: input.include_name ?? true,
          include_category: input.include_category ?? true,
          include_internal_id: input.include_internal_id ?? true,
          include_serial_number: input.include_serial_number ?? false,
          include_manufacturer: input.include_manufacturer ?? false,
          include_model: input.include_model ?? false,
          include_purchase_date: input.include_purchase_date ?? false,
          include_logo: input.include_logo ?? false,
          color_coding_enabled: input.color_coding_enabled ?? false,
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

// ============================================================================
// RENTAL HOOKS (POS)
// ============================================================================

export interface RentalItemPricing {
  asset_id: string;
  rate_type: 'daily' | 'weekly' | 'flat';
  quoted_rate: number;
  quantity: number;
  line_total: number;
}

export interface QuickRentalInput {
  items: RentalItemPricing[];
  contact_id?: string;
  client_org_id?: string;
  project_id?: string;
  rental_start_date: string; // ISO date
  rental_end_date: string; // ISO date
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_option: 'invoice_later' | 'pay_now';
  payment_method?: string;
  payment_reference?: string;
  destination_location_id?: string;
  notes?: string;
}

export interface GearRentalQuote {
  id: string;
  rental_house_org_id: string;
  contact_id?: string;
  quote_number: string;
  rental_start_date: string;
  rental_end_date: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  status: string;
  prepared_by_user_id: string;
  prepared_by_name?: string;
  contact_name?: string;
  contact_company?: string;
  created_at: string;
  items?: GearRentalQuoteItem[];
}

export interface GearRentalQuoteItem {
  id: string;
  quote_id: string;
  asset_id?: string;
  asset_name?: string;
  asset_internal_id?: string;
  quantity: number;
  quoted_rate?: number;
  rate_type: string;
  line_total?: number;
}

export interface GearRentalOrder {
  id: string;
  quote_id?: string;
  rental_house_org_id: string;
  client_org_id?: string;
  contact_id?: string;
  backlot_project_id?: string;
  order_number: string;
  rental_start_date: string;
  rental_end_date: string;
  status: string;
  total_amount?: number;
  tax_amount?: number;
  notes?: string;
  contact_name?: string;
  contact_company?: string;
  item_count?: number;
  amount_paid?: number;
  balance_due?: number;
  created_at: string;
  items?: GearRentalOrderItem[];
  payments?: GearRentalPayment[];
}

export interface GearRentalOrderItem {
  id: string;
  order_id: string;
  asset_id?: string;
  asset_name?: string;
  asset_internal_id?: string;
  quantity: number;
  quoted_rate?: number;
  line_total?: number;
}

export interface GearRentalPayment {
  id: string;
  order_id: string;
  invoice_id?: string;
  amount: number;
  payment_method?: string;
  payment_reference?: string;
  payment_date: string;
  recorded_by?: string;
  recorded_by_name?: string;
  notes?: string;
  created_at: string;
}

export function useGearRentals(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Create a quick rental at POS
  const createQuickRental = useMutation({
    mutationFn: (input: QuickRentalInput) =>
      fetchWithAuth(`/api/v1/gear/rentals/${orgId}/quick-rental`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-rental-quotes', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-rental-orders', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  return {
    createQuickRental,
  };
}

export interface UseGearRentalQuotesOptions {
  orgId: string | null;
  status?: string;
  contactId?: string;
  limit?: number;
  offset?: number;
}

export function useGearRentalQuotes(options: UseGearRentalQuotesOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { orgId, status, contactId, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-rental-quotes', { orgId, status, contactId, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (contactId) params.set('contact_id', contactId);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/rentals/${orgId}/quotes?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  return {
    quotes: (query.data?.quotes ?? []) as GearRentalQuote[],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useGearRentalQuote(quoteId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-rental-quote', quoteId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/rentals/quotes/${quoteId}`, token!),
    enabled: !!token && !!quoteId,
    select: (data) => data.quote as GearRentalQuote,
  });
}

export interface UseGearRentalOrdersOptions {
  orgId: string | null;
  status?: string;
  contactId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export function useGearRentalOrders(options: UseGearRentalOrdersOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { orgId, status, contactId, projectId, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-rental-orders', { orgId, status, contactId, projectId, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (contactId) params.set('contact_id', contactId);
      if (projectId) params.set('project_id', projectId);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/rentals/${orgId}/orders?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  const updateOrderStatus = useMutation({
    mutationFn: ({ orderId, status, notes }: { orderId: string; status: string; notes?: string }) =>
      fetchWithAuth(`/api/v1/gear/rentals/orders/${orderId}/status`, token!, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-rental-orders'] });
    },
  });

  return {
    orders: (query.data?.orders ?? []) as GearRentalOrder[],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateOrderStatus,
  };
}

export function useGearRentalOrder(orderId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-rental-order', orderId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/rentals/orders/${orderId}`, token!),
    enabled: !!token && !!orderId,
    select: (data) => data.order as GearRentalOrder,
  });

  const recordPayment = useMutation({
    mutationFn: (input: { amount: number; payment_method: string; payment_reference?: string; notes?: string }) =>
      fetchWithAuth(`/api/v1/gear/rentals/orders/${orderId}/record-payment`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-rental-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['gear-rental-orders'] });
    },
  });

  const generateInvoice = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/rentals/orders/${orderId}/generate-invoice`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-rental-order', orderId] });
    },
  });

  return {
    order: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    recordPayment,
    generateInvoice,
  };
}

// ============================================================================
// CLIENT COMPANY HOOKS
// ============================================================================

export function useGearClientCompanies(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-client-companies', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/client-companies`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.companies as GearClientCompany[],
  });

  const createCompany = useMutation({
    mutationFn: (input: CreateClientCompanyInput) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/client-companies`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-companies', orgId] });
    },
  });

  const updateCompany = useMutation({
    mutationFn: ({ companyId, ...input }: Partial<CreateClientCompanyInput> & { companyId: string }) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/client-companies/${companyId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-companies', orgId] });
    },
  });

  const deleteCompany = useMutation({
    mutationFn: (companyId: string) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/client-companies/${companyId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-companies', orgId] });
    },
  });

  const getUploadUrl = useMutation({
    mutationFn: ({ companyId, docType, fileName }: { companyId: string; docType: 'insurance' | 'coi'; fileName: string }) =>
      fetchWithAuth(
        `/api/v1/gear/organizations/${orgId}/client-companies/${companyId}/upload-url?doc_type=${docType}&file_name=${encodeURIComponent(fileName)}`,
        token!,
        { method: 'POST' }
      ),
  });

  return {
    companies: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createCompany,
    updateCompany,
    deleteCompany,
    getUploadUrl,
  };
}

export function useGearClientCompany(orgId: string | null, companyId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-client-company', orgId, companyId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/client-companies/${companyId}`, token!),
    enabled: !!token && !!orgId && !!companyId,
    select: (data) => data.company as GearClientCompany,
  });
}

// ============================================================================
// ENHANCED CONTACT HOOKS
// ============================================================================

export function useGearClientContacts(orgId: string | null, options?: { companyId?: string; search?: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-client-contacts', orgId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.companyId) params.set('company_id', options.companyId);
      if (options?.search) params.set('search', options.search);
      return fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts?${params}`, token!);
    },
    enabled: !!token && !!orgId,
    select: (data) => data.contacts as GearClientContact[],
  });

  const createContact = useMutation({
    mutationFn: (input: CreateClientContactInput) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-contacts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  const updateContact = useMutation({
    mutationFn: ({ contactId, ...input }: Partial<CreateClientContactInput> & { contactId: string }) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts/${contactId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-contacts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: (contactId: string) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts/${contactId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-contacts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  const getUploadUrl = useMutation({
    mutationFn: ({
      contactId,
      docType,
      fileName,
    }: {
      contactId: string;
      docType: 'id_photo' | 'personal_insurance';
      fileName: string;
    }) =>
      fetchWithAuth(
        `/api/v1/gear/organizations/${orgId}/contacts/${contactId}/upload-url?doc_type=${docType}&file_name=${encodeURIComponent(fileName)}`,
        token!,
        { method: 'POST' }
      ),
  });

  const linkUser = useMutation({
    mutationFn: ({ contactId, userId }: { contactId: string; userId: string }) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts/${contactId}/link-user`, token!, {
        method: 'PUT',
        body: JSON.stringify({ user_id: userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-contacts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  const unlinkUser = useMutation({
    mutationFn: (contactId: string) =>
      fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts/${contactId}/link-user`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-client-contacts', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-contacts', orgId] });
    },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createContact,
    updateContact,
    deleteContact,
    getUploadUrl,
    linkUser,
    unlinkUser,
  };
}

export function useGearContactProjects(orgId: string | null, contactId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-contact-projects', orgId, contactId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/contacts/${contactId}/projects`, token!),
    enabled: !!token && !!orgId && !!contactId,
    select: (data) => data.projects as LinkedProject[],
  });
}

export function useGearMemberProjects(orgId: string | null, userId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-member-projects', orgId, userId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/organizations/${orgId}/members/${userId}/projects`, token!),
    enabled: !!token && !!orgId && !!userId,
    select: (data) => data.projects as LinkedProject[],
  });
}

export function useGearUserSearch(orgId: string | null, searchTerm: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-user-search', orgId, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Determine if it's an email search or general search
      if (searchTerm?.includes('@')) {
        params.set('email', searchTerm);
      } else if (searchTerm) {
        params.set('query', searchTerm);
      }
      return fetchWithAuth(`/api/v1/gear/organizations/${orgId}/search-users?${params}`, token!);
    },
    enabled: !!token && !!orgId && !!searchTerm && searchTerm.length >= 2,
    select: (data) => data.users as UserSearchResult[],
  });
}

// ============================================================================
// LABEL TEMPLATE HOOKS
// ============================================================================

import type {
  GearLabelTemplate,
  CreateLabelTemplateInput,
  GearPrintQueueItem,
  AddToPrintQueueInput,
  GearPrintHistoryEntry,
  GearPrintHistoryStats,
} from '@/types/gear';

export function useGearLabelTemplates(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-label-templates', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/labels/${orgId}/templates`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.templates as GearLabelTemplate[],
  });

  const createTemplate = useMutation({
    mutationFn: (input: CreateLabelTemplateInput) =>
      fetchWithAuth(`/api/v1/gear/labels/${orgId}/templates`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-label-templates', orgId] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: ({ templateId, ...input }: Partial<CreateLabelTemplateInput> & { templateId: string }) =>
      fetchWithAuth(`/api/v1/gear/labels/templates/${templateId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-label-templates', orgId] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (templateId: string) =>
      fetchWithAuth(`/api/v1/gear/labels/templates/${templateId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-label-templates', orgId] });
    },
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

// ============================================================================
// PRINT QUEUE HOOKS
// ============================================================================

export function useGearPrintQueue(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-print-queue', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/labels/${orgId}/queue`, token!),
    enabled: !!token && !!orgId,
  });

  const addToQueue = useMutation({
    mutationFn: (input: AddToPrintQueueInput) =>
      fetchWithAuth(`/api/v1/gear/labels/${orgId}/queue`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-print-queue', orgId] });
    },
  });

  const updateQueueItem = useMutation({
    mutationFn: ({
      itemId,
      ...input
    }: {
      itemId: string;
      quantity?: number;
      template_id?: string;
      include_kit_contents?: boolean;
    }) =>
      fetchWithAuth(`/api/v1/gear/labels/${orgId}/queue/${itemId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-print-queue', orgId] });
    },
  });

  const removeFromQueue = useMutation({
    mutationFn: (itemId: string) =>
      fetchWithAuth(`/api/v1/gear/labels/${orgId}/queue/${itemId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-print-queue', orgId] });
    },
  });

  const clearQueue = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/labels/${orgId}/queue`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-print-queue', orgId] });
    },
  });

  const printQueue = useMutation({
    mutationFn: async ({
      templateId,
      outputFormat = 'html',
      autoGenerateCodes = true,
      labelSettings,
    }: {
      templateId?: string;
      outputFormat?: 'html' | 'zpl';
      autoGenerateCodes?: boolean;
      labelSettings?: {
        label_type?: 'barcode' | 'qr' | 'both';
        label_size?: string;
        print_mode?: 'sheet' | 'roll';
        printer_type?: string;
        sheet_rows?: number;
        sheet_columns?: number;
        custom_width_mm?: number;
        custom_height_mm?: number;
        include_name?: boolean;
        include_category?: boolean;
        include_internal_id?: boolean;
        include_serial_number?: boolean;
        include_manufacturer?: boolean;
        include_model?: boolean;
        include_purchase_date?: boolean;
        include_logo?: boolean;
        color_coding_enabled?: boolean;
      };
    }) => {
      const params = new URLSearchParams();
      if (templateId) params.set('template_id', templateId);
      params.set('output_format', outputFormat);
      params.set('auto_generate_codes', autoGenerateCodes.toString());

      const response = await fetch(`${API_BASE}/api/v1/gear/labels/${orgId}/queue/print?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: labelSettings ? JSON.stringify(labelSettings) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to print queue');
      }

      return response.text();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-print-queue', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-print-history', orgId] });
      queryClient.invalidateQueries({ queryKey: ['gear-assets'] });
    },
  });

  return {
    queue: (query.data?.queue ?? []) as GearPrintQueueItem[],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    clearQueue,
    printQueue,
  };
}

// ============================================================================
// PRINT HISTORY HOOKS
// ============================================================================

export interface UseGearPrintHistoryOptions {
  orgId: string | null;
  itemType?: 'asset' | 'kit';
  userId?: string;
  limit?: number;
  offset?: number;
}

export function useGearPrintHistory(options: UseGearPrintHistoryOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const { orgId, itemType, userId, limit = 50, offset = 0 } = options;

  const query = useQuery({
    queryKey: ['gear-print-history', { orgId, itemType, userId, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (itemType) params.set('item_type', itemType);
      if (userId) params.set('user_id', userId);
      params.set('limit', limit.toString());
      params.set('offset', offset.toString());

      return fetchWithAuth(`/api/v1/gear/labels/${orgId}/history?${params}`, token!);
    },
    enabled: !!token && !!orgId,
  });

  return {
    history: (query.data?.history ?? []) as GearPrintHistoryEntry[],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useGearPrintHistoryStats(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['gear-print-history-stats', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/labels/${orgId}/history/stats`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data as GearPrintHistoryStats,
  });
}

export function useGearReprint(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ historyId, outputFormat = 'html' }: { historyId: string; outputFormat?: 'html' | 'zpl' }) => {
      const params = new URLSearchParams();
      params.set('output_format', outputFormat);

      const response = await fetch(`${API_BASE}/api/v1/gear/labels/${orgId}/history/${historyId}/reprint?${params}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to reprint');
      }

      return response.text();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-print-history'] });
    },
  });
}
