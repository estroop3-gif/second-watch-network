/**
 * Set House Hooks
 * Data fetching and mutations for space/location management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseOrganization,
  SetHouseOrganizationMember,
  SetHouseOrganizationSettings,
  SetHouseCategory,
  SetHouseLocation,
  SetHouseSpace,
  SetHouseSpaceHistory,
  SetHousePackageTemplate,
  SetHousePackageInstance,
  SetHouseTransaction,
  SetHouseIncident,
  SetHouseRepairTicket,
  SetHouseVendor,
  SetHouseStrike,
  SetHouseClientCompany,
  SetHouseClientContact,
  CreateOrganizationInput,
  CreateSpaceInput,
  CreateTransactionInput,
  CreateIncidentInput,
  CreateRepairTicketInput,
  CreateStrikeInput,
  CreateClientCompanyInput,
  CreateClientContactInput,
  LinkedProject,
  UserSearchResult,
  SpaceStatus,
  SpaceCondition,
  TransactionType,
  TransactionStatus,
  IncidentType,
  IncidentStatus,
  RepairStatus,
  IDType,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Set House API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[Set House API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[Set House API] Response:`, data);
  return data;
}

// ============================================================================
// ORGANIZATION HOOKS
// ============================================================================

export interface UseSetHouseOrganizationsOptions {
  enabled?: boolean;
}

export function useSetHouseOrganizations(options?: UseSetHouseOrganizationsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-organizations'],
    queryFn: () => fetchWithAuth('/api/v1/set-house/organizations/', token!),
    enabled: !!token && (options?.enabled ?? true),
    select: (data) => data.organizations as SetHouseOrganization[],
  });

  const createOrganization = useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      fetchWithAuth('/api/v1/set-house/organizations/', token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-organizations'] });
    },
  });

  const updateOrganization = useMutation({
    mutationFn: ({ orgId, ...input }: Partial<SetHouseOrganization> & { orgId: string }) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['set-house-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['set-house-organization', variables.orgId] });
    },
  });

  return {
    organizations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createOrganization,
    updateOrganization,
  };
}

export function useSetHouseOrganization(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-organization', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.organization as SetHouseOrganization,
  });

  const updateOrganization = useMutation({
    mutationFn: (input: Partial<SetHouseOrganization>) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-organization', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-organizations'] });
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

export function useSetHouseOrgMembers(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-org-members', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/members`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.members as SetHouseOrganizationMember[],
  });

  const addMember = useMutation({
    mutationFn: (input: { user_id: string; role: string }) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/members`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-org-members', orgId] });
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/members/${memberId}`, token!, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-org-members', orgId] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/members/${memberId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-org-members', orgId] });
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

export function useSetHouseOrgSettings(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-org-settings', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/settings`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.settings as SetHouseOrganizationSettings,
  });

  const updateSettings = useMutation({
    mutationFn: (input: Partial<SetHouseOrganizationSettings>) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/settings`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-org-settings', orgId] });
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

// ============================================================================
// CATEGORY HOOKS
// ============================================================================

export function useSetHouseCategories(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-categories', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/categories`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.categories as SetHouseCategory[],
  });

  const createCategory = useMutation({
    mutationFn: (input: Partial<SetHouseCategory>) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/categories`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-categories', orgId] });
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ categoryId, ...input }: Partial<SetHouseCategory> & { categoryId: string }) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/categories/${categoryId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-categories', orgId] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: (categoryId: string) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/categories/${categoryId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-categories', orgId] });
    },
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}

// ============================================================================
// LOCATION HOOKS
// ============================================================================

export function useSetHouseLocations(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-locations', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/locations`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.locations as SetHouseLocation[],
  });

  const createLocation = useMutation({
    mutationFn: (input: Partial<SetHouseLocation>) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/locations`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-locations', orgId] });
    },
  });

  const updateLocation = useMutation({
    mutationFn: ({ locationId, ...input }: Partial<SetHouseLocation> & { locationId: string }) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/locations/${locationId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-locations', orgId] });
    },
  });

  const deleteLocation = useMutation({
    mutationFn: (locationId: string) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/locations/${locationId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-locations', orgId] });
    },
  });

  return {
    locations: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createLocation,
    updateLocation,
    deleteLocation,
  };
}

// ============================================================================
// SPACE HOOKS
// ============================================================================

export interface UseSetHouseSpacesOptions {
  status?: SpaceStatus;
  categoryId?: string;
  locationId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export function useSetHouseSpaces(orgId: string | null, options?: UseSetHouseSpacesOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.categoryId) queryParams.append('category_id', options.categoryId);
  if (options?.locationId) queryParams.append('location_id', options.locationId);
  if (options?.search) queryParams.append('search', options.search);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/spaces/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-spaces', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      spaces: data.spaces as SetHouseSpace[],
      total: data.total as number,
    }),
  });

  const createSpace = useMutation({
    mutationFn: (input: CreateSpaceInput) =>
      fetchWithAuth(`/api/v1/set-house/spaces/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  const createBulkSpaces = useMutation({
    mutationFn: (spaces: CreateSpaceInput[]) =>
      fetchWithAuth(`/api/v1/set-house/spaces/${orgId}/bulk`, token!, {
        method: 'POST',
        body: JSON.stringify({ spaces }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  return {
    spaces: query.data?.spaces ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createSpace,
    createBulkSpaces,
  };
}

export function useSetHouseSpace(spaceId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-space', spaceId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/spaces/item/${spaceId}`, token!),
    enabled: !!token && !!spaceId,
    select: (data) => data.space as SetHouseSpace,
  });

  const updateSpace = useMutation({
    mutationFn: (input: Partial<SetHouseSpace>) =>
      fetchWithAuth(`/api/v1/set-house/spaces/item/${spaceId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces'] });
    },
  });

  const deleteSpace = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/set-house/spaces/item/${spaceId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ status, notes }: { status: SpaceStatus; notes?: string }) =>
      fetchWithAuth(`/api/v1/set-house/spaces/item/${spaceId}/status`, token!, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-space', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces'] });
    },
  });

  return {
    space: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateSpace,
    deleteSpace,
    updateStatus,
  };
}

export function useSetHouseSpaceHistory(spaceId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-space-history', spaceId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/spaces/item/${spaceId}/history`, token!),
    enabled: !!token && !!spaceId,
    select: (data) => data.history as SetHouseSpaceHistory[],
  });
}

// ============================================================================
// PACKAGE HOOKS
// ============================================================================

export function useSetHousePackageTemplates(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-package-templates', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/packages/${orgId}/templates`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.templates as SetHousePackageTemplate[],
  });

  const createTemplate = useMutation({
    mutationFn: (input: Partial<SetHousePackageTemplate>) =>
      fetchWithAuth(`/api/v1/set-house/packages/${orgId}/templates`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-package-templates', orgId] });
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

export function useSetHousePackageTemplate(orgId: string | null, templateId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-package-template', orgId, templateId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/packages/${orgId}/templates/${templateId}`, token!),
    enabled: !!token && !!orgId && !!templateId,
    select: (data) => data.template as SetHousePackageTemplate,
  });

  const updateTemplate = useMutation({
    mutationFn: (input: Partial<SetHousePackageTemplate>) =>
      fetchWithAuth(`/api/v1/set-house/packages/${orgId}/templates/${templateId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-package-template', orgId, templateId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-package-templates', orgId] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/set-house/packages/${orgId}/templates/${templateId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-package-templates', orgId] });
    },
  });

  return {
    template: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateTemplate,
    deleteTemplate,
  };
}

export function useSetHousePackageInstance(orgId: string | null, instanceId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['set-house-package-instance', orgId, instanceId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/packages/${orgId}/instances/${instanceId}`, token!),
    enabled: !!token && !!orgId && !!instanceId,
    select: (data) => data.instance as SetHousePackageInstance,
  });

  return {
    instance: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useSetHousePackageInstances(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-package-instances', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/packages/${orgId}/instances`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.instances as SetHousePackageInstance[],
  });

  const createInstance = useMutation({
    mutationFn: (input: { template_id?: string; name: string; space_ids?: string[] }) =>
      fetchWithAuth(`/api/v1/set-house/packages/${orgId}/instances`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-package-instances', orgId] });
    },
  });

  const addSpaceToInstance = useMutation({
    mutationFn: ({ instanceId, spaceId, slotName }: { instanceId: string; spaceId: string; slotName?: string }) =>
      fetchWithAuth(`/api/v1/set-house/packages/${orgId}/instances/${instanceId}/spaces/${spaceId}${slotName ? `?slot_name=${encodeURIComponent(slotName)}` : ''}`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-package-instances', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-package-instance'] });
    },
  });

  const removeSpaceFromInstance = useMutation({
    mutationFn: ({ instanceId, spaceId }: { instanceId: string; spaceId: string }) =>
      fetchWithAuth(`/api/v1/set-house/packages/${orgId}/instances/${instanceId}/spaces/${spaceId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-package-instances', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-package-instance'] });
    },
  });

  const updateInstance = useMutation({
    mutationFn: ({ instanceId, data }: { instanceId: string; data: {
      name?: string;
      notes?: string;
      hourly_rate?: number | null;
      half_day_rate?: number | null;
      daily_rate?: number | null;
      weekly_rate?: number | null;
      monthly_rate?: number | null;
      discount_percent?: number | null;
    } }) =>
      fetchWithAuth(`/api/v1/set-house/packages/${orgId}/instances/${instanceId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-package-instances', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-package-instance'] });
    },
  });

  return {
    instances: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createInstance,
    addSpaceToInstance,
    removeSpaceFromInstance,
    updateInstance,
  };
}

// ============================================================================
// TRANSACTION HOOKS
// ============================================================================

export interface UseSetHouseTransactionsOptions {
  status?: TransactionStatus;
  transactionType?: TransactionType;
  custodianUserId?: string;
  limit?: number;
  offset?: number;
}

export function useSetHouseTransactions(orgId: string | null, options?: UseSetHouseTransactionsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.transactionType) queryParams.append('transaction_type', options.transactionType);
  if (options?.custodianUserId) queryParams.append('custodian_user_id', options.custodianUserId);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/transactions/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-transactions', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      transactions: data.transactions as SetHouseTransaction[],
      total: data.total as number,
    }),
  });

  const createTransaction = useMutation({
    mutationFn: (input: CreateTransactionInput) =>
      fetchWithAuth(`/api/v1/set-house/transactions/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-transactions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  return {
    transactions: query.data?.transactions ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createTransaction,
  };
}

export function useSetHouseTransaction(orgId: string | null, transactionId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-transaction', orgId, transactionId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/transactions/${orgId}/${transactionId}`, token!),
    enabled: !!token && !!orgId && !!transactionId,
    select: (data) => data.transaction as SetHouseTransaction,
  });

  const updateTransaction = useMutation({
    mutationFn: (input: Partial<SetHouseTransaction>) =>
      fetchWithAuth(`/api/v1/set-house/transactions/${orgId}/${transactionId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-transaction', orgId, transactionId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-transactions', orgId] });
    },
  });

  return {
    transaction: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateTransaction,
  };
}

// ============================================================================
// INCIDENT HOOKS
// ============================================================================

export interface UseSetHouseIncidentsOptions {
  status?: IncidentStatus;
  incidentType?: IncidentType;
  spaceId?: string;
  limit?: number;
  offset?: number;
}

export function useSetHouseIncidents(orgId: string | null, options?: UseSetHouseIncidentsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.incidentType) queryParams.append('incident_type', options.incidentType);
  if (options?.spaceId) queryParams.append('space_id', options.spaceId);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/incidents/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-incidents', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      incidents: data.incidents as SetHouseIncident[],
      total: data.total as number,
    }),
  });

  const createIncident = useMutation({
    mutationFn: (input: CreateIncidentInput) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incidents', orgId] });
    },
  });

  return {
    incidents: query.data?.incidents ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createIncident,
  };
}

export function useSetHouseIncident(orgId: string | null, incidentId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-incident', orgId, incidentId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}`, token!),
    enabled: !!token && !!orgId && !!incidentId,
    select: (data) => data.incident as SetHouseIncident,
  });

  const updateIncident = useMutation({
    mutationFn: (input: Partial<SetHouseIncident>) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incident', orgId, incidentId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-incidents', orgId] });
    },
  });

  const resolveIncident = useMutation({
    mutationFn: (input: { resolution_type: string; resolution_notes?: string; actual_cost?: number }) =>
      fetchWithAuth(`/api/v1/set-house/incidents/${orgId}/${incidentId}/resolve`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-incident', orgId, incidentId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-incidents', orgId] });
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

// ============================================================================
// REPAIR HOOKS
// ============================================================================

export interface UseSetHouseRepairsOptions {
  status?: RepairStatus;
  spaceId?: string;
  limit?: number;
  offset?: number;
}

export function useSetHouseRepairs(orgId: string | null, options?: UseSetHouseRepairsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (options?.status) queryParams.append('status', options.status);
  if (options?.spaceId) queryParams.append('space_id', options.spaceId);
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/repairs/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-repairs', orgId, options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      tickets: data.tickets as SetHouseRepairTicket[],
      total: data.total as number,
    }),
  });

  const createRepair = useMutation({
    mutationFn: (input: CreateRepairTicketInput) =>
      fetchWithAuth(`/api/v1/set-house/repairs/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-repairs', orgId] });
    },
  });

  return {
    tickets: query.data?.tickets ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createRepair,
  };
}

export function useSetHouseRepair(orgId: string | null, repairId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-repair', orgId, repairId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/repairs/${orgId}/${repairId}`, token!),
    enabled: !!token && !!orgId && !!repairId,
    select: (data) => data.ticket as SetHouseRepairTicket,
  });

  const updateRepair = useMutation({
    mutationFn: (input: Partial<SetHouseRepairTicket>) =>
      fetchWithAuth(`/api/v1/set-house/repairs/${orgId}/${repairId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-repair', orgId, repairId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-repairs', orgId] });
    },
  });

  const approveQuote = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/set-house/repairs/${orgId}/${repairId}/approve-quote`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-repair', orgId, repairId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-repairs', orgId] });
    },
  });

  const completeRepair = useMutation({
    mutationFn: (input: { qc_passed: boolean; qc_notes?: string; total_cost?: number }) =>
      fetchWithAuth(`/api/v1/set-house/repairs/${orgId}/${repairId}/complete`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-repair', orgId, repairId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-repairs', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-spaces', orgId] });
    },
  });

  return {
    ticket: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateRepair,
    approveQuote,
    completeRepair,
  };
}

// ============================================================================
// VENDOR HOOKS
// ============================================================================

export function useSetHouseVendors(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-vendors', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/repairs/${orgId}/vendors`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.vendors as SetHouseVendor[],
  });

  const createVendor = useMutation({
    mutationFn: (input: Partial<SetHouseVendor>) =>
      fetchWithAuth(`/api/v1/set-house/repairs/${orgId}/vendors`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-vendors', orgId] });
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
// CLIENT HOOKS
// ============================================================================

export function useSetHouseClientCompanies(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-client-companies', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/client-companies`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.companies as SetHouseClientCompany[],
  });

  const createCompany = useMutation({
    mutationFn: (input: CreateClientCompanyInput) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/client-companies`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-client-companies', orgId] });
    },
  });

  return {
    companies: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createCompany,
  };
}

export function useSetHouseClientContacts(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-client-contacts', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/client-contacts`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.contacts as SetHouseClientContact[],
  });

  const createContact = useMutation({
    mutationFn: (input: CreateClientContactInput) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/client-contacts`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-client-contacts', orgId] });
    },
  });

  const updateContact = useMutation({
    mutationFn: ({ contactId, ...input }: Partial<SetHouseClientContact> & { contactId: string }) =>
      fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/client-contacts/${contactId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-client-contacts', orgId] });
    },
  });

  return {
    contacts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createContact,
    updateContact,
  };
}

// ============================================================================
// USER SEARCH HOOK
// ============================================================================

export function useSetHouseUserSearch(orgId: string | null, search: string) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-user-search', orgId, search],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/search-users?q=${encodeURIComponent(search)}`, token!),
    enabled: !!token && !!orgId && search.length >= 2,
    select: (data) => data.users as UserSearchResult[],
  });
}

// ============================================================================
// LINKED PROJECTS HOOK
// ============================================================================

export function useSetHouseLinkedProjects(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-linked-projects', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/organizations/${orgId}/linked-projects`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.projects as LinkedProject[],
  });
}
