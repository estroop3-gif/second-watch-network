/**
 * Gear House Marketplace Hooks
 * Data fetching and mutations for rental marketplace
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  GearMarketplaceSettings,
  GearMarketplaceListing,
  GearMarketplaceSearchFilters,
  GearRentalRequest,
  GearRentalQuote,
  GearRentalOrder,
  GearRentalExtension,
  GearRenterReputation,
  CreateRentalRequestInput,
  CreateQuoteInput,
  CreateListingInput,
  RequestExtensionInput,
  ExtensionResponseInput,
  MarketplaceSearchResponse,
  MarketplaceOrganizationsResponse,
  TransactionRequestsResponse,
  OutgoingTransaction,
  IncomingTransaction,
  HistoryTransaction,
  TransactionTab,
  // Shipping types
  DeliveryOptions,
  ShippingAddress,
  ShippingRate,
  ShippingCarrier,
  GearShipment,
  TrackingInfo,
  AddressVerification,
  GearShippingSettings,
  GetShippingRatesRequest,
  GetShippingRatesResponse,
  BuyLabelRequest,
  BuyLabelResponse,
  UpdateShippingSettingsInput,
  // Sale types
  GearSale,
  MakeOfferInput,
  CounterOfferInput,
  AcceptOfferInput,
  SaleStatus,
  // Location-based search types
  MarketplaceSearchPreferences,
  MarketplacePreferencesUpdate,
  GearHouseFavorite,
  MarketplaceOrganizationEnriched,
  MarketplaceNearbySearchParams,
  MarketplaceGearHousesResponse,
  MarketplaceListingsNearbyResponse,
  UserLocation,
  LocationSource,
  RadiusMiles,
  ViewMode,
  ResultMode,
  // Community search preferences
  CommunitySearchPreferences,
  CommunityPreferencesUpdate,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Marketplace API] ${options?.method || 'GET'} ${fullUrl}`);

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
    let errorData: any = null;
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      errorData = JSON.parse(errorText);

      // Handle different error formats
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (typeof errorData.detail === 'object' && errorData.detail !== null) {
        // Detail is an object (e.g., validation errors with unavailable_items)
        errorMessage = errorData.detail.message || JSON.stringify(errorData.detail);
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      if (errorText) errorMessage += ` - ${errorText}`;
    }

    console.error(`[Marketplace API] Error: ${errorMessage}`);
    console.error(`[Marketplace API] Full error data:`, errorData);

    // Throw the parsed error data so the caller can access structured info
    const error: any = new Error(errorMessage);
    error.detail = errorData?.detail;
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  console.log(`[Marketplace API] Response:`, data);
  return data;
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================================
// MARKETPLACE BROWSING HOOKS
// ============================================================================

export interface UseMarketplaceSearchOptions {
  enabled?: boolean;
}

export function useMarketplaceSearch(
  filters: GearMarketplaceSearchFilters,
  options?: UseMarketplaceSearchOptions
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString(filters);

  const query = useQuery({
    queryKey: ['marketplace-search', filters],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/search${queryString}`, token!),
    enabled: !!token && (options?.enabled ?? true),
    select: (data) => data as MarketplaceSearchResponse,
  });

  return {
    listings: query.data?.listings ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Marketplace search with results grouped by organization/rental house.
 * Prioritizes organizations that have items in the quote/cart.
 */
export function useMarketplaceSearchGrouped(
  filters: GearMarketplaceSearchFilters,
  cartOrgIds?: string[],
  options?: UseMarketplaceSearchOptions
) {
  const { session } = useAuth();
  const token = session?.access_token;

  // Build filters with grouping enabled
  const groupedFilters = {
    ...filters,
    group_by_org: true,
    priority_org_ids: cartOrgIds?.join(',') || undefined,
  };

  const queryString = buildQueryString(groupedFilters);

  const query = useQuery({
    queryKey: ['marketplace-search-grouped', groupedFilters],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/search${queryString}`, token!),
    enabled: !!token && (options?.enabled ?? true),
  });

  return {
    organizations: query.data?.organizations ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useMarketplaceListing(listingId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['marketplace-listing', listingId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/listings/${listingId}`, token!),
    enabled: !!token && !!listingId,
    select: (data) => data.listing as GearMarketplaceListing,
  });

  return {
    listing: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useMarketplaceOrganizations(filters?: {
  lister_type?: string;
  verified_only?: boolean;
  location?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString(filters || {});

  const query = useQuery({
    queryKey: ['marketplace-organizations', filters],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/organizations${queryString}`, token!),
    enabled: !!token,
    select: (data) => data as MarketplaceOrganizationsResponse,
  });

  return {
    organizations: query.data?.organizations ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useRentalHouseProfile(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['rental-house-profile', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/organizations/${orgId}`, token!),
    enabled: !!token && !!orgId,
  });

  return {
    profile: query.data?.organization,
    listings: query.data?.listings ?? [],
    reputation: query.data?.reputation,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// MARKETPLACE SETTINGS HOOKS
// ============================================================================

export function useMarketplaceSettings(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketplace-settings', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/settings`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.settings as GearMarketplaceSettings,
  });

  const updateSettings = useMutation({
    mutationFn: (input: Partial<GearMarketplaceSettings>) =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/settings`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['marketplace-settings', orgId] });

      // Snapshot previous value
      const previousData = queryClient.getQueryData(['marketplace-settings', orgId]);

      // Optimistically update cache immediately
      queryClient.setQueryData(['marketplace-settings', orgId], (old: any) => {
        // If no existing data, create a new settings object
        if (!old) {
          return {
            settings: {
              organization_id: orgId,
              is_marketplace_enabled: false,
              lister_type: 'production_company',
              extension_policy: 'request_approve',
              accepts_stripe: true,
              accepts_invoice: true,
              ...input,
            }
          };
        }
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
        queryClient.setQueryData(['marketplace-settings', orgId], context.previousData);
      }
    },
    onSuccess: (data) => {
      // Update cache with server response to ensure consistency
      queryClient.setQueryData(['marketplace-settings', orgId], data);
    },
  });

  const enableMarketplace = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/enable`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-settings', orgId] });
    },
  });

  const disableMarketplace = useMutation({
    mutationFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/disable`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-settings', orgId] });
    },
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    updateSettings,
    enableMarketplace,
    disableMarketplace,
  };
}

// ============================================================================
// LISTING MANAGEMENT HOOKS
// ============================================================================

export function useMyListings(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-listings', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/listings`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.listings as GearMarketplaceListing[],
  });

  const createListing = useMutation({
    mutationFn: (input: CreateListingInput) =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/listings`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });

  const updateListing = useMutation({
    mutationFn: ({ listingId, input }: { listingId: string; input: Partial<CreateListingInput> }) =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/listings/${listingId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });

  const deleteListing = useMutation({
    mutationFn: (listingId: string) =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/listings/${listingId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });

  // Bulk create supports two formats:
  // 1. Per-asset rates: { listings: CreateListingInput[] }
  // 2. Default settings: { asset_ids: string[], default_settings: Partial<CreateListingInput> }
  const bulkCreateListings = useMutation({
    mutationFn: (input:
      | { listings: CreateListingInput[] }
      | { asset_ids: string[]; default_settings: Partial<CreateListingInput> }
    ) =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/listings/bulk`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-listings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });

  return {
    listings: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createListing,
    updateListing,
    deleteListing,
    bulkCreateListings,
  };
}

export function useListingAvailability(orgId: string, listingId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['listing-availability', orgId, listingId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/${orgId}/listings/${listingId}/availability`, token!),
    enabled: !!token && !!listingId,
  });

  return {
    availability: query.data?.availability,
    bookedDates: query.data?.booked_dates ?? [],
    blackoutDates: query.data?.blackout_dates ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ============================================================================
// RENTAL REQUEST HOOKS (Renter Side)
// ============================================================================

export function useCreateRentalRequest() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRentalRequestInput) =>
      fetchWithAuth(`/api/v1/gear/quotes/request`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-rental-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
    },
  });
}

export function useMyRentalRequests(filters?: { status?: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryString = buildQueryString(filters || {});

  const query = useQuery({
    queryKey: ['my-rental-requests', filters],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/quotes/my-requests${queryString}`, token!),
    enabled: !!token,
    select: (data) => ({
      requests: data.requests as GearRentalRequest[],
      total: data.total as number,
    }),
  });

  const cancelRequest = useMutation({
    mutationFn: (requestId: string) =>
      fetchWithAuth(`/api/v1/gear/quotes/request/${requestId}/cancel`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-rental-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
    },
  });

  return {
    requests: query.data?.requests ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    cancelRequest,
  };
}

export function useRentalRequest(requestId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['rental-request', requestId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/quotes/request/${requestId}`, token!),
    enabled: !!token && !!requestId,
    select: (data) => data.request as GearRentalRequest,
  });

  return {
    request: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useApproveRentalRequest(orgId: string) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      // First, fetch the full request with items
      const requestData = await fetchWithAuth(`/api/v1/gear/quotes/request/${requestId}`, token!);
      const request = requestData.request as GearRentalRequest;

      if (!request.items || request.items.length === 0) {
        throw new Error('Request has no items');
      }

      // Create or find a contact for the requesting user
      // This is REQUIRED - we cannot create a work order without a custodian
      let custodianContactId: string;
      let custodianUserId: string;

      // First, try to find existing contact by user_id
      const contactsData = await fetchWithAuth(
        `/api/v1/gear/organizations/${orgId}/contacts?user_id=${request.requested_by_user_id}`,
        token!
      );

      if (contactsData.contacts && contactsData.contacts.length > 0) {
        custodianContactId = contactsData.contacts[0].id;
        custodianUserId = contactsData.contacts[0].user_id;
      } else {
        // Create a new contact for the requester
        // Use the requester's user_id as custodian even if contact creation fails
        custodianUserId = request.requested_by_user_id;

        try {
          const newContactData = {
            name: request.requested_by_name || 'External Customer',
            email: request.requested_by_email || undefined,
            user_id: request.requested_by_user_id,
            organization_name: request.requesting_org_name || undefined,
          };

          const createContactResponse = await fetchWithAuth(
            `/api/v1/gear/organizations/${orgId}/contacts`,
            token!,
            {
              method: 'POST',
              body: JSON.stringify(newContactData),
            }
          );

          custodianContactId = createContactResponse.contact.id;
        } catch (error) {
          console.warn('Could not create contact for requester, but will use user_id:', error);
          // We still have custodianUserId, so we can proceed without custodianContactId
        }
      }

      // Create work order from request
      const workOrderData = {
        title: request.title || `Rental for ${request.requesting_org_name || 'Customer'}`,
        notes: `Rental for ${request.requesting_org_name || 'External Customer'}\n${request.notes || request.description || ''}`.trim(),
        custodian_contact_id: custodianContactId,
        custodian_user_id: custodianUserId,  // Required for checkout
        backlot_project_id: request.backlot_project_id || undefined,
        pickup_date: request.rental_start_date,
        expected_return_date: request.rental_end_date,
        rental_request_id: requestId,  // Link to rental request for status update
        items: request.items.map(item => ({
          asset_id: item.asset_id || undefined,
          quantity: item.quantity,
          notes: item.notes || undefined,
        })),
      };

      const response = await fetchWithAuth(`/api/v1/gear/work-orders/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(workOrderData),
      });

      return response.work_order;
    },
    onSuccess: () => {
      // Invalidate all variations of these query keys
      queryClient.invalidateQueries({ queryKey: ['incoming-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useRejectRentalRequest() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) => {
      console.log('[useRejectRentalRequest] Rejecting request:', requestId, 'queryClient exists:', !!queryClient);
      return fetchWithAuth(`/api/v1/gear/quotes/request/${requestId}/reject`, token!, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      console.log('[useRejectRentalRequest] Success, invalidating queries. queryClient exists:', !!queryClient);
      try {
        queryClient.invalidateQueries({ queryKey: ['incoming-requests'] });
        queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
        queryClient.invalidateQueries({ queryKey: ['rental-request'] });
      } catch (error) {
        console.error('[useRejectRentalRequest] Error invalidating queries:', error);
      }
    },
    onError: (error) => {
      console.error('[useRejectRentalRequest] Mutation error:', error);
    },
  });
}

// ============================================================================
// QUOTE MANAGEMENT HOOKS (Rental House Side)
// ============================================================================

export function useIncomingRequests(orgId: string | null, filters?: { status?: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryString = buildQueryString(filters || {});

  const query = useQuery({
    queryKey: ['incoming-requests', orgId, filters],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/quotes/${orgId}/incoming${queryString}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.requests as GearRentalRequest[],
  });

  const createQuote = useMutation({
    mutationFn: ({ requestId, input }: { requestId: string; input: CreateQuoteInput }) =>
      fetchWithAuth(`/api/v1/gear/quotes/${orgId}/quote/${requestId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-requests', orgId] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
    },
  });

  return {
    requests: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createQuote,
  };
}

export function useRentalQuote(quoteId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rental-quote', quoteId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/quotes/quote/${quoteId}`, token!),
    enabled: !!token && !!quoteId,
    select: (data) => data.quote as GearRentalQuote,
  });

  const approveQuote = useMutation({
    mutationFn: ({ paymentMethod }: { paymentMethod?: 'stripe' | 'invoice' }) => {
      const queryString = paymentMethod ? `?payment_method=${paymentMethod}` : '';
      return fetchWithAuth(`/api/v1/gear/quotes/quote/${quoteId}/approve${queryString}`, token!, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['my-rental-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const rejectQuote = useMutation({
    mutationFn: (reason?: string) =>
      fetchWithAuth(`/api/v1/gear/quotes/quote/${quoteId}/reject`, token!, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rental-quote', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['my-rental-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
    },
  });

  return {
    quote: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    approveQuote,
    rejectQuote,
  };
}

// ============================================================================
// EXTENSION HOOKS
// ============================================================================

export function useRequestExtension() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transactionId, input }: { transactionId: string; input: RequestExtensionInput }) =>
      fetchWithAuth(`/api/v1/gear/quotes/extension/${transactionId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-extensions'] });
    },
  });
}

export function usePendingExtensions(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pending-extensions', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/quotes/${orgId}/extensions/pending`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.extensions as GearRentalExtension[],
  });

  const approveExtension = useMutation({
    mutationFn: ({ extensionId, input }: { extensionId: string; input: ExtensionResponseInput }) =>
      fetchWithAuth(`/api/v1/gear/quotes/${orgId}/extensions/${extensionId}/approve`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-extensions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const denyExtension = useMutation({
    mutationFn: ({ extensionId, reason }: { extensionId: string; reason?: string }) =>
      fetchWithAuth(`/api/v1/gear/quotes/${orgId}/extensions/${extensionId}/deny?reason=${reason || ''}`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-extensions', orgId] });
      queryClient.invalidateQueries({ queryKey: ['transaction-requests'] });
    },
  });

  return {
    extensions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    approveExtension,
    denyExtension,
  };
}

// ============================================================================
// REPUTATION HOOKS
// ============================================================================

export function useRenterReputation(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['renter-reputation', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/reputation/${orgId}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.reputation as GearRenterReputation,
  });

  return {
    reputation: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// 5-TAB TRANSACTION HOOKS
// ============================================================================

export function useOutgoingTransactions(orgId: string | null, options?: { limit?: number; offset?: number }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString(options || {});

  const query = useQuery({
    queryKey: ['transactions-outgoing', orgId, options],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}/outgoing${queryString}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      transactions: data.transactions as OutgoingTransaction[],
      total: data.total as number,
    }),
  });

  return {
    transactions: query.data?.transactions ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useIncomingTransactions(orgId: string | null, options?: { limit?: number; offset?: number }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString(options || {});

  const query = useQuery({
    queryKey: ['transactions-incoming', orgId, options],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}/incoming${queryString}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      transactions: data.transactions as IncomingTransaction[],
      total: data.total as number,
    }),
  });

  return {
    transactions: query.data?.transactions ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTransactionRequests(orgId: string | null, direction?: 'incoming' | 'outgoing') {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = direction ? `?direction=${direction}` : '';

  const query = useQuery({
    queryKey: ['transaction-requests', orgId, direction],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}/requests${queryString}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data as TransactionRequestsResponse,
  });

  return {
    incomingQuotes: query.data?.incoming_quotes ?? [],
    outgoingQuotes: query.data?.outgoing_quotes ?? [],
    extensions: query.data?.extensions ?? [],
    totals: query.data?.totals ?? { incoming_quotes: 0, outgoing_quotes: 0, extensions: 0 },
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useTransactionHistory(
  orgId: string | null,
  options?: {
    transaction_type?: string;
    as_renter?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString(options || {});

  const query = useQuery({
    queryKey: ['transactions-history', orgId, options],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}/history${queryString}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      transactions: data.transactions as HistoryTransaction[],
      total: data.total as number,
    }),
  });

  return {
    transactions: query.data?.transactions ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useOverdueTransactions(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['transactions-overdue', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/transactions/${orgId}/overdue`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.overdue as OutgoingTransaction[],
  });

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// COMBINED TAB HOOK
// ============================================================================

export function useTransactionsTab(orgId: string | null, activeTab: TransactionTab) {
  const outgoing = useOutgoingTransactions(orgId, { limit: 50 });
  const incoming = useIncomingTransactions(orgId, { limit: 50 });
  const requests = useTransactionRequests(orgId);
  const history = useTransactionHistory(orgId, { limit: 50 });
  const overdue = useOverdueTransactions(orgId);

  const isLoading =
    activeTab === 'outgoing' ? outgoing.isLoading :
    activeTab === 'incoming' ? incoming.isLoading :
    activeTab === 'requests' ? requests.isLoading :
    activeTab === 'history' ? history.isLoading :
    activeTab === 'overdue' ? overdue.isLoading : false;

  const error =
    activeTab === 'outgoing' ? outgoing.error :
    activeTab === 'incoming' ? incoming.error :
    activeTab === 'requests' ? requests.error :
    activeTab === 'history' ? history.error :
    activeTab === 'overdue' ? overdue.error : null;

  return {
    outgoing,
    incoming,
    requests,
    history,
    overdue,
    isLoading,
    error,
    refetchAll: () => {
      outgoing.refetch();
      incoming.refetch();
      requests.refetch();
      history.refetch();
      overdue.refetch();
    },
  };
}

// ============================================================================
// PAYMENTS
// ============================================================================

interface CreatePaymentIntentInput {
  quote_id: string;
  payment_type: 'deposit' | 'full' | 'balance';
  return_url?: string;
}

interface PaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
}

interface PaymentStatusResponse {
  quote_id: string;
  deposit_required: boolean;
  deposit_amount: number | null;
  deposit_paid: boolean;
  deposit_paid_at: string | null;
  total_amount: number | null;
  payment_completed: boolean;
  payment_completed_at: string | null;
  payment_method: string | null;
  backlot_invoice_id: string | null;
  payments: Array<{
    id: string;
    payment_type: string;
    amount: number;
    status: string;
    paid_at: string;
  }>;
}

interface GenerateInvoiceInput {
  quote_id: string;
  budget_line_item_id?: string;
  notes?: string;
}

interface InvoiceResponse {
  success: boolean;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  message: string;
}

/**
 * Hook for rental payment operations
 */
export function useRentalPayments(quoteId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Get payment status
  const statusQuery = useQuery({
    queryKey: ['payment-status', quoteId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/payments/quote/${quoteId}/status`, token!),
    enabled: !!token && !!quoteId,
    select: (data) => data as PaymentStatusResponse,
  });

  // Create payment intent
  const createPaymentIntent = useMutation({
    mutationFn: (input: Omit<CreatePaymentIntentInput, 'quote_id'>) =>
      fetchWithAuth(`/api/v1/gear/payments/create-intent`, token!, {
        method: 'POST',
        body: JSON.stringify({ ...input, quote_id: quoteId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', quoteId] });
    },
  });

  // Confirm payment
  const confirmPayment = useMutation({
    mutationFn: (paymentIntentId: string) =>
      fetchWithAuth(`/api/v1/gear/payments/confirm`, token!, {
        method: 'POST',
        body: JSON.stringify({ payment_intent_id: paymentIntentId, quote_id: quoteId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['rental-quote', quoteId] });
    },
  });

  // Generate Backlot invoice
  const generateInvoice = useMutation({
    mutationFn: (input: Omit<GenerateInvoiceInput, 'quote_id'>) =>
      fetchWithAuth(`/api/v1/gear/payments/generate-invoice`, token!, {
        method: 'POST',
        body: JSON.stringify({ ...input, quote_id: quoteId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-status', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['rental-quote', quoteId] });
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,
    refetch: statusQuery.refetch,
    createPaymentIntent,
    confirmPayment,
    generateInvoice,
  };
}

/**
 * Hook for refunding deposits (rental house side)
 */
export function useDepositRefund() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { order_id: string; amount?: number; reason?: string }) =>
      fetchWithAuth(`/api/v1/gear/payments/refund-deposit`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rental-order', variables.order_id] });
    },
  });
}

// ============================================================================
// REPUTATION
// ============================================================================

export interface ReputationStats {
  organization_id: string;
  organization_name?: string;
  total_rentals: number;
  successful_rentals: number;
  late_returns: number;
  damage_incidents: number;
  total_rental_value: number;
  is_verified: boolean;
  verified_at?: string;
  verification_threshold: number;
  average_rating?: number;
  rating_count: number;
  success_rate: number;
  rentals_until_verified: number;
}

/**
 * Hook for getting organization reputation
 */
export function useOrganizationReputation(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['reputation', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/reputation/org/${orgId}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.reputation as ReputationStats,
  });
}

/**
 * Hook for getting current organization's reputation
 */
export function useMyReputation(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['my-reputation', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/reputation/my?org_id=${orgId}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data.reputation as ReputationStats,
  });
}

/**
 * Hook for reputation leaderboard
 */
export function useReputationLeaderboard(options?: {
  limit?: number;
  offset?: number;
  verifiedOnly?: boolean;
}) {
  const { session } = useAuth();
  const token = session?.access_token;

  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  if (options?.verifiedOnly) params.append('verified_only', 'true');

  return useQuery({
    queryKey: ['reputation-leaderboard', options],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/reputation/leaderboard?${params}`, token!),
    enabled: !!token,
    select: (data) => ({
      leaderboard: data.leaderboard as ReputationStats[],
      total: data.total as number,
    }),
  });
}

// ============================================================================
// SHIPPING & DELIVERY HOOKS
// ============================================================================

/**
 * Hook for getting delivery options for a rental house
 */
export function useDeliveryOptions(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['delivery-options', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/organizations/${orgId}/delivery-options`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data as DeliveryOptions,
  });
}

/**
 * Hook for getting shipping rates
 */
export function useShippingRates() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: (input: GetShippingRatesRequest) =>
      fetchWithAuth('/api/v1/gear/shipping/rates', token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

/**
 * Hook for purchasing a shipping label
 */
export function useCreateShippingLabel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BuyLabelRequest) =>
      fetchWithAuth('/api/v1/gear/shipping/labels', token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      if (variables.quote_id) {
        queryClient.invalidateQueries({ queryKey: ['quote', variables.quote_id] });
      }
      if (variables.order_id) {
        queryClient.invalidateQueries({ queryKey: ['rental-order', variables.order_id] });
      }
    },
  });
}

/**
 * Hook for getting shipment details
 */
export function useShipment(shipmentId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/shipping/labels/${shipmentId}`, token!),
    enabled: !!token && !!shipmentId,
    select: (data) => data as GearShipment,
  });
}

/**
 * Hook for getting tracking information
 */
export function useShipmentTracking(trackingNumber: string | null, carrier?: ShippingCarrier) {
  const { session } = useAuth();
  const token = session?.access_token;

  const params = new URLSearchParams();
  if (carrier) params.append('carrier', carrier);

  return useQuery({
    queryKey: ['shipment-tracking', trackingNumber],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/shipping/tracking/${trackingNumber}?${params}`, token!),
    enabled: !!token && !!trackingNumber,
    select: (data) => data as TrackingInfo,
    // Refetch tracking every minute
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

/**
 * Hook for creating a return label
 */
export function useCreateReturnLabel() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) =>
      fetchWithAuth(`/api/v1/gear/shipping/return-label/${orderId}`, token!, {
        method: 'POST',
      }),
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ['rental-order', orderId] });
    },
  });
}

/**
 * Hook for getting shipping settings for an organization
 */
export function useShippingSettings(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['shipping-settings', orgId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/shipping/${orgId}/settings`, token!),
    enabled: !!token && !!orgId,
    select: (data) => data as GearShippingSettings,
  });

  const updateSettings = useMutation({
    mutationFn: (input: UpdateShippingSettingsInput) =>
      fetchWithAuth(`/api/v1/gear/shipping/${orgId}/settings`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['shipping-settings', orgId] });
      const previousData = queryClient.getQueryData(['shipping-settings', orgId]);
      queryClient.setQueryData(['shipping-settings', orgId], (old: GearShippingSettings | undefined) => {
        if (!old) return old;
        return { ...old, ...input };
      });
      return { previousData };
    },
    onError: (_err, _input, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['shipping-settings', orgId], context.previousData);
      }
    },
  });

  const verifyAddress = useMutation({
    mutationFn: (address: ShippingAddress) =>
      fetchWithAuth(`/api/v1/gear/shipping/${orgId}/verify-address`, token!, {
        method: 'POST',
        body: JSON.stringify({ address }),
      }),
  });

  const testRates = useMutation({
    mutationFn: (address: ShippingAddress) =>
      fetchWithAuth(`/api/v1/gear/shipping/${orgId}/test-rates`, token!, {
        method: 'POST',
        body: JSON.stringify({ address }),
      }),
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateSettings,
    verifyAddress,
    testRates,
  };
}

// ============================================================================
// SALE HOOKS
// ============================================================================

/**
 * Hook for making an offer on a sale listing
 */
export function useMakeOffer() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MakeOfferInput) =>
      fetchWithAuth('/api/v1/gear/sales/offer', token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sale-offers'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listing'] });
    },
  });
}

/**
 * Hook for getting offers I've made as a buyer
 */
export function useMyOffers(filters?: { status?: SaleStatus }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = buildQueryString(filters || {});

  return useQuery({
    queryKey: ['my-sale-offers', filters],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/sales/my-offers${queryString}`, token!),
    enabled: !!token,
    select: (data) => ({
      sales: data.sales as GearSale[],
      total: data.total as number,
    }),
  });
}

/**
 * Hook for getting a single sale/offer
 */
export function useSale(saleId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['sale', saleId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/sales/${saleId}`, token!),
    enabled: !!token && !!saleId,
    select: (data) => data.sale as GearSale,
  });
}

/**
 * Hook for getting incoming sale offers (seller side)
 */
export function useIncomingSaleOffers(orgId: string | null, filters?: { status?: SaleStatus }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const queryString = buildQueryString(filters || {});

  const query = useQuery({
    queryKey: ['incoming-sale-offers', orgId, filters],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/${orgId}/sales/incoming${queryString}`, token!),
    enabled: !!token && !!orgId,
    select: (data) => ({
      sales: data.sales as GearSale[],
      total: data.total as number,
    }),
  });

  // Accept offer
  const acceptOffer = useMutation({
    mutationFn: ({ saleId, input }: { saleId: string; input?: AcceptOfferInput }) =>
      fetchWithAuth(`/api/v1/gear/${orgId}/sales/${saleId}/accept`, token!, {
        method: 'POST',
        body: JSON.stringify(input || {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-sale-offers', orgId] });
      queryClient.invalidateQueries({ queryKey: ['my-listings', orgId] });
    },
  });

  // Counter offer
  const counterOffer = useMutation({
    mutationFn: ({ saleId, input }: { saleId: string; input: CounterOfferInput }) =>
      fetchWithAuth(`/api/v1/gear/${orgId}/sales/${saleId}/counter`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-sale-offers', orgId] });
    },
  });

  // Reject offer
  const rejectOffer = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason?: string }) =>
      fetchWithAuth(`/api/v1/gear/${orgId}/sales/${saleId}/reject`, token!, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-sale-offers', orgId] });
    },
  });

  return {
    sales: query.data?.sales ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    acceptOffer,
    counterOffer,
    rejectOffer,
  };
}

/**
 * Hook for buyer actions on their offers
 */
export function useBuyerSaleActions() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Accept counter offer (as buyer)
  const acceptCounter = useMutation({
    mutationFn: ({ saleId }: { saleId: string }) =>
      fetchWithAuth(`/api/v1/gear/sales/${saleId}/accept-counter`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sale-offers'] });
    },
  });

  // Cancel offer (as buyer)
  const cancelOffer = useMutation({
    mutationFn: ({ saleId, reason }: { saleId: string; reason?: string }) =>
      fetchWithAuth(`/api/v1/gear/sales/${saleId}/cancel`, token!, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sale-offers'] });
    },
  });

  return {
    acceptCounter,
    cancelOffer,
  };
}

/**
 * Hook for managing sale completion (both parties)
 */
export function useSaleCompletion(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Mark as shipped (seller)
  const markShipped = useMutation({
    mutationFn: ({ saleId, trackingNumber, carrier }: { saleId: string; trackingNumber?: string; carrier?: string }) =>
      fetchWithAuth(`/api/v1/gear/${orgId}/sales/${saleId}/shipped`, token!, {
        method: 'POST',
        body: JSON.stringify({ tracking_number: trackingNumber, carrier }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-sale-offers', orgId] });
    },
  });

  // Mark as delivered (buyer confirms)
  const markDelivered = useMutation({
    mutationFn: ({ saleId }: { saleId: string }) =>
      fetchWithAuth(`/api/v1/gear/sales/${saleId}/delivered`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sale-offers'] });
    },
  });

  // Complete sale (finalize transfer)
  const completeSale = useMutation({
    mutationFn: ({ saleId }: { saleId: string }) =>
      fetchWithAuth(`/api/v1/gear/${orgId}/sales/${saleId}/complete`, token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incoming-sale-offers', orgId] });
      queryClient.invalidateQueries({ queryKey: ['my-listings', orgId] });
      // Asset is now transferred, refresh assets list
      queryClient.invalidateQueries({ queryKey: ['assets', orgId] });
    },
  });

  return {
    markShipped,
    markDelivered,
    completeSale,
  };
}

/**
 * Hook for sale payment
 */
export function useSalePayment(saleId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Create payment intent for sale
  const createPaymentIntent = useMutation({
    mutationFn: (input: { return_url?: string }) =>
      fetchWithAuth(`/api/v1/gear/sales/${saleId}/payment/create-intent`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
    },
  });

  // Confirm payment
  const confirmPayment = useMutation({
    mutationFn: (paymentIntentId: string) =>
      fetchWithAuth(`/api/v1/gear/sales/${saleId}/payment/confirm`, token!, {
        method: 'POST',
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });
      queryClient.invalidateQueries({ queryKey: ['my-sale-offers'] });
    },
  });

  return {
    createPaymentIntent,
    confirmPayment,
  };
}


// ============================================================================
// LOCATION-BASED MARKETPLACE SEARCH HOOKS
// ============================================================================

/**
 * Hook for marketplace search preferences per project
 */
export function useMarketplacePreferences(projectId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data, isLoading, error } = useQuery({
    queryKey: ['marketplace-preferences', projectId],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/preferences/${projectId}`, token!),
    enabled: !!token && !!projectId,
  });

  // Update preferences
  const updatePreferences = useMutation({
    mutationFn: (updates: MarketplacePreferencesUpdate) =>
      fetchWithAuth(`/api/v1/gear/marketplace/preferences/${projectId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-preferences', projectId] });
    },
  });

  return {
    preferences: data?.preferences as MarketplaceSearchPreferences | undefined,
    isLoading,
    error,
    updatePreferences,
  };
}

/**
 * Hook for gear house favorites
 */
export function useGearHouseFavorites(projectId?: string) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Fetch favorites
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['gear-house-favorites', projectId],
    queryFn: () => {
      const params = projectId ? `?project_id=${projectId}` : '';
      return fetchWithAuth(`/api/v1/gear/marketplace/favorites${params}`, token!);
    },
    enabled: !!token,
  });

  // Add favorite
  const addFavorite = useMutation({
    mutationFn: ({ orgId, notes }: { orgId: string; notes?: string }) => {
      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);
      if (notes) params.append('notes', notes);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      return fetchWithAuth(`/api/v1/gear/marketplace/favorites/${orgId}${queryString}`, token!, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-house-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-nearby'] });
    },
  });

  // Remove favorite
  const removeFavorite = useMutation({
    mutationFn: (orgId: string) =>
      fetchWithAuth(`/api/v1/gear/marketplace/favorites/${orgId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-house-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-nearby'] });
    },
  });

  return {
    favorites: (data?.favorites || []) as GearHouseFavorite[],
    isLoading,
    error,
    refetch,
    addFavorite,
    removeFavorite,
  };
}

/**
 * Hook for proximity-based marketplace search
 */
export function useMarketplaceNearbySearch(params: MarketplaceNearbySearchParams | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const queryString = params ? buildQueryString({
    lat: params.lat,
    lng: params.lng,
    radius_miles: params.radius_miles || 50,
    result_mode: params.result_mode || 'gear_houses',
    delivery_to_me_only: params.delivery_to_me_only,
    q: params.q,
    category_id: params.category_id,
    lister_type: params.lister_type,
    verified_only: params.verified_only,
    available_from: params.available_from,  // Date filter
    available_to: params.available_to,      // Date filter
    timezone: params.timezone,              // User's timezone
    limit: params.limit || 50,
    offset: params.offset || 0,
  }) : '';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['marketplace-nearby', params],
    queryFn: () =>
      fetchWithAuth(`/api/v1/gear/marketplace/search/nearby${queryString}`, token!),
    enabled: !!token && !!params && !!params.lat && !!params.lng,
  });

  // Determine response type based on result_mode
  const isGearHousesMode = !params?.result_mode || params.result_mode === 'gear_houses';

  return {
    gearHouses: isGearHousesMode ? (data?.gear_houses || []) as MarketplaceOrganizationEnriched[] : [],
    listings: !isGearHousesMode ? (data?.listings || []) : [],
    total: data?.total || 0,
    userLocation: data?.user_location,
    radiusMiles: data?.radius_miles,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for user location with browser geolocation and profile fallback
 */
export function useMarketplaceLocation(projectId: string | null) {
  const { profile, session } = useAuth();
  const token = session?.access_token;
  const { preferences, updatePreferences } = useMarketplacePreferences(projectId);

  // Current location state
  const currentLocation: UserLocation | null = preferences?.search_latitude && preferences?.search_longitude
    ? {
        latitude: preferences.search_latitude,
        longitude: preferences.search_longitude,
        name: preferences.search_location_name || undefined,
        source: preferences.location_source || 'profile',
      }
    : null;

  // Get profile location as fallback (from auth context)
  const profileLocation: UserLocation | null = profile?.location_latitude && profile?.location_longitude
    ? {
        latitude: profile.location_latitude,
        longitude: profile.location_longitude,
        name: profile.location_city && profile.location_state_code
          ? `${profile.location_city}, ${profile.location_state_code}`
          : undefined,
        source: 'profile' as LocationSource,
      }
    : null;

  // Request browser geolocation
  const requestBrowserLocation = async (): Promise<UserLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            source: 'browser',
          };

          // Try to get a friendly name via reverse geocoding using AWS
          try {
            const response = await fetchWithAuth('/api/v1/gear/marketplace/reverse-geocode', token!, {
              method: 'POST',
              body: JSON.stringify({
                latitude: location.latitude,
                longitude: location.longitude,
              }),
            });
            if (response.city && response.state) {
              location.name = `${response.city}, ${response.state}`;
            } else if (response.display_name) {
              location.name = response.display_name.split(',').slice(0, 2).join(',');
            }
          } catch (e) {
            console.warn('Reverse geocoding failed:', e);
          }

          // Save to preferences
          if (projectId) {
            updatePreferences.mutate({
              search_latitude: location.latitude,
              search_longitude: location.longitude,
              search_location_name: location.name,
              location_source: 'browser',
            });
          }

          resolve(location);
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
  };

  // Set manual location
  const setManualLocation = (location: { latitude: number; longitude: number; name?: string }) => {
    if (!projectId) return;

    updatePreferences.mutate({
      search_latitude: location.latitude,
      search_longitude: location.longitude,
      search_location_name: location.name,
      location_source: 'manual',
    });
  };

  // Initialize location from profile if not set
  const initializeLocation = async () => {
    // If we already have a location, don't override
    if (currentLocation) return currentLocation;

    // Try browser geolocation first
    try {
      const browserLocation = await requestBrowserLocation();
      return browserLocation;
    } catch (e) {
      console.log('Browser geolocation unavailable, using profile location');
    }

    // Fall back to profile location
    if (profileLocation && projectId) {
      updatePreferences.mutate({
        search_latitude: profileLocation.latitude,
        search_longitude: profileLocation.longitude,
        search_location_name: profileLocation.name,
        location_source: 'profile',
      });
      return profileLocation;
    }

    return null;
  };

  return {
    currentLocation,
    profileLocation,
    requestBrowserLocation,
    setManualLocation,
    initializeLocation,
    isUpdating: updatePreferences.isPending,
  };
}

/**
 * Hook for geocoding an organization's location
 */
export function useGeocodeOrganization() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const geocode = useMutation({
    mutationFn: (orgId: string) =>
      fetchWithAuth(`/api/v1/gear/marketplace/organizations/${orgId}/geocode`, token!, {
        method: 'POST',
      }),
    onSuccess: (_, orgId) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-settings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-nearby'] });
    },
  });

  return { geocode };
}

/**
 * Hook for updating organization location privacy
 */
export function useUpdateLocationPrivacy() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const updatePrivacy = useMutation({
    mutationFn: ({ orgId, hideExactAddress, publicDisplay }: {
      orgId: string;
      hideExactAddress: boolean;
      publicDisplay?: string;
    }) => {
      const params = new URLSearchParams();
      params.append('hide_exact_address', String(hideExactAddress));
      if (publicDisplay) params.append('public_location_display', publicDisplay);
      return fetchWithAuth(`/api/v1/gear/marketplace/organizations/${orgId}/location-privacy?${params.toString()}`, token!, {
        method: 'PUT',
      });
    },
    onSuccess: (_, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-settings', orgId] });
    },
  });

  return { updatePrivacy };
}

// ============================================================================
// COMMUNITY MARKETPLACE PREFERENCES (PROFILE-LEVEL)
// ============================================================================

/**
 * Hook for community marketplace search preferences (profile-level, no project_id)
 * Used for Community For Sale and Rentals tabs
 */
export function useCommunityPreferences() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  // Fetch preferences
  const { data, isLoading, error } = useQuery({
    queryKey: ['community-preferences'],
    queryFn: () =>
      fetchWithAuth('/api/v1/gear/marketplace/community/preferences', token!),
    enabled: !!token,
  });

  // Update preferences
  const updatePreferences = useMutation({
    mutationFn: (updates: CommunityPreferencesUpdate) =>
      fetchWithAuth('/api/v1/gear/marketplace/community/preferences', token!, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-preferences'] });
    },
  });

  return {
    preferences: data?.preferences as CommunitySearchPreferences | undefined,
    isLoading,
    error,
    updatePreferences,
  };
}

/**
 * Hook for user location in Community marketplace tabs
 * Similar to useMarketplaceLocation but uses community preferences (profile-level)
 */
export function useCommunityMarketplaceLocation() {
  const { profile, session } = useAuth();
  const token = session?.access_token;
  const { preferences, updatePreferences } = useCommunityPreferences();

  // Current location state from preferences
  const currentLocation: UserLocation | null = preferences?.search_latitude && preferences?.search_longitude
    ? {
        latitude: preferences.search_latitude,
        longitude: preferences.search_longitude,
        name: preferences.search_location_name || undefined,
        source: preferences.location_source || 'profile',
      }
    : null;

  // Get profile location as fallback
  const profileLocation: UserLocation | null = profile?.location_latitude && profile?.location_longitude
    ? {
        latitude: profile.location_latitude,
        longitude: profile.location_longitude,
        name: profile.location_city && profile.location_state_code
          ? `${profile.location_city}, ${profile.location_state_code}`
          : undefined,
        source: 'profile' as LocationSource,
      }
    : null;

  // Request browser geolocation
  const requestBrowserLocation = async (): Promise<UserLocation> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location: UserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            source: 'browser',
          };

          // Try to get a friendly name via reverse geocoding using AWS
          try {
            const response = await fetchWithAuth('/api/v1/gear/marketplace/reverse-geocode', token!, {
              method: 'POST',
              body: JSON.stringify({
                latitude: location.latitude,
                longitude: location.longitude,
              }),
            });
            if (response.city && response.state) {
              location.name = `${response.city}, ${response.state}`;
            } else if (response.display_name) {
              location.name = response.display_name.split(',').slice(0, 2).join(',');
            }
          } catch (e) {
            console.warn('Reverse geocoding failed:', e);
          }

          // Save to community preferences
          updatePreferences.mutate({
            search_latitude: location.latitude,
            search_longitude: location.longitude,
            search_location_name: location.name,
            location_source: 'browser',
          });

          resolve(location);
        },
        (error) => {
          reject(error);
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
  };

  // Set manual location
  const setManualLocation = (location: { latitude: number; longitude: number; name?: string }) => {
    updatePreferences.mutate({
      search_latitude: location.latitude,
      search_longitude: location.longitude,
      search_location_name: location.name,
      location_source: 'manual',
    });
  };

  // Initialize location from profile if not set
  const initializeLocation = async () => {
    // If we already have a location, don't override
    if (currentLocation) return currentLocation;

    // Try browser geolocation first
    try {
      const browserLocation = await requestBrowserLocation();
      return browserLocation;
    } catch (e) {
      console.log('Browser geolocation unavailable, using profile location');
    }

    // Fall back to profile location
    if (profileLocation) {
      updatePreferences.mutate({
        search_latitude: profileLocation.latitude,
        search_longitude: profileLocation.longitude,
        search_location_name: profileLocation.name,
        location_source: 'profile',
      });
      return profileLocation;
    }

    return null;
  };

  return {
    currentLocation,
    profileLocation,
    preferences,
    requestBrowserLocation,
    setManualLocation,
    initializeLocation,
    isUpdating: updatePreferences.isPending,
    updatePreferences,
  };
}
