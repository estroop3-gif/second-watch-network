/**
 * Set House Marketplace Hook
 * Marketplace listings and search functionality
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseMarketplaceListing,
  SetHouseMarketplaceSettings,
  SetHouseMarketplaceSearchFilters,
  MarketplaceSearchResponse,
  MarketplaceOrganizationEnriched,
  MarketplaceSetHousesResponse,
  MarketplaceListingsNearbyResponse,
  MarketplaceNearbySearchParams,
  CreateListingInput,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Set House Marketplace API] ${options?.method || 'GET'} ${fullUrl}`);

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

// ============================================================================
// PUBLIC MARKETPLACE SEARCH
// ============================================================================

export function useSetHouseMarketplaceSearch(filters: SetHouseMarketplaceSearchFilters) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryParams = new URLSearchParams();
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.space_type) queryParams.append('space_type', filters.space_type);
  if (filters.min_price) queryParams.append('min_daily_rate', filters.min_price.toString());
  if (filters.max_price) queryParams.append('max_daily_rate', filters.max_price.toString());
  if (filters.city) queryParams.append('city', filters.city);
  if (filters.state) queryParams.append('state', filters.state);
  if (filters.limit) queryParams.append('limit', filters.limit.toString());
  if (filters.offset) queryParams.append('offset', filters.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/marketplace/search${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['set-house-marketplace-search', filters],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token,
    select: (data) => ({
      listings: data.listings as SetHouseMarketplaceListing[],
      total: data.total as number,
    }),
  });
}

export function useSetHouseMarketplaceNearbySearch(params: MarketplaceNearbySearchParams) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryParams = new URLSearchParams();
  queryParams.append('latitude', params.lat.toString());
  queryParams.append('longitude', params.lng.toString());
  if (params.radius_miles) queryParams.append('radius_miles', params.radius_miles.toString());
  if (params.space_type) queryParams.append('space_type', params.space_type);
  if (params.limit) queryParams.append('limit', params.limit.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/marketplace/nearby?${queryString}`;

  return useQuery({
    queryKey: ['set-house-marketplace-nearby', params],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!params.lat && !!params.lng,
    select: (data) => ({
      listings: data.listings as SetHouseMarketplaceListing[],
    }),
  });
}

export function useSetHouseMarketplaceListing(listingId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-marketplace-listing', listingId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/marketplace/listing/${listingId}`, token!),
    enabled: !!token && !!listingId,
    select: (data) => data.listing as SetHouseMarketplaceListing,
  });
}

// ============================================================================
// SET HOUSES LIST (for community page)
// ============================================================================

export interface UseSetHousesOptions {
  search?: string;
  city?: string;
  state?: string;
  isVerified?: boolean;
  limit?: number;
  offset?: number;
}

export function useSetHouses(options?: UseSetHousesOptions) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryParams = new URLSearchParams();
  if (options?.search) queryParams.append('search', options.search);
  if (options?.city) queryParams.append('city', options.city);
  if (options?.state) queryParams.append('state', options.state);
  if (options?.isVerified !== undefined) queryParams.append('is_verified', options.isVerified.toString());
  if (options?.limit) queryParams.append('limit', options.limit.toString());
  if (options?.offset) queryParams.append('offset', options.offset.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/marketplace/set-houses${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['set-houses', options],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token,
    select: (data) => ({
      setHouses: data.set_houses as MarketplaceOrganizationEnriched[],
      total: data.total as number,
    }),
  });
}

// ============================================================================
// ORGANIZATION LISTING MANAGEMENT
// ============================================================================

export function useSetHouseOrgListings(orgId: string | null, isListed?: boolean) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (isListed !== undefined) queryParams.append('is_listed', isListed.toString());

  const queryString = queryParams.toString();
  const url = `/api/v1/set-house/marketplace/listings/${orgId}${queryString ? `?${queryString}` : ''}`;

  const query = useQuery({
    queryKey: ['set-house-org-listings', orgId, isListed],
    queryFn: () => fetchWithAuth(url, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      listings: data.listings as SetHouseMarketplaceListing[],
      total: data.total as number,
    }),
  });

  const createListing = useMutation({
    mutationFn: (input: CreateListingInput) =>
      fetchWithAuth(`/api/v1/set-house/marketplace/listings/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-org-listings', orgId] });
    },
  });

  const updateListing = useMutation({
    mutationFn: ({ listingId, ...input }: Partial<SetHouseMarketplaceListing> & { listingId: string }) =>
      fetchWithAuth(`/api/v1/set-house/marketplace/listings/${orgId}/${listingId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-org-listings', orgId] });
    },
  });

  const deleteListing = useMutation({
    mutationFn: (listingId: string) =>
      fetchWithAuth(`/api/v1/set-house/marketplace/listings/${orgId}/${listingId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-org-listings', orgId] });
    },
  });

  return {
    listings: query.data?.listings ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createListing,
    updateListing,
    deleteListing,
  };
}

// ============================================================================
// MARKETPLACE SETTINGS
// ============================================================================

export function useSetHouseMarketplaceSettings(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-marketplace-settings', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/marketplace/settings/${orgId}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.settings as SetHouseMarketplaceSettings,
  });

  const updateSettings = useMutation({
    mutationFn: (input: Partial<SetHouseMarketplaceSettings>) =>
      fetchWithAuth(`/api/v1/set-house/marketplace/settings/${orgId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-marketplace-settings', orgId] });
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
