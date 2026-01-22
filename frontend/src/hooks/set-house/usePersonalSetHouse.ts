/**
 * Personal Set House Hook
 * For individual space owners (Set House Lite)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseSpace,
  SetHouseMarketplaceListing,
  SpaceType,
  SpaceCondition,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Personal Set House API] ${options?.method || 'GET'} ${fullUrl}`);

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

export interface PersonalSetHouseSpace {
  id: string;
  name: string;
  space_type?: SpaceType;
  square_footage?: number;
  description?: string;
  status?: string;
  current_condition?: SpaceCondition;
  photos?: string[];
  category_id?: string;
  category_name?: string;
  created_at?: string;
  // Listing info (joined)
  listing_id?: string;
  is_listed?: boolean;
  daily_rate?: number;
  hourly_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  deposit_amount?: number;
  deposit_percent?: number;
  insurance_required?: boolean;
  min_booking_hours?: number;
}

export interface PersonalSetHouseResponse {
  org_id: string | null;
  spaces: PersonalSetHouseSpace[];
}

export interface QuickAddSpaceInput {
  name: string;
  space_type?: SpaceType;
  square_footage?: number;
  description?: string;
  photos?: string[];
  daily_rate?: number;
  hourly_rate?: number;
  weekly_rate?: number;
  create_listing?: boolean;
}

/**
 * Hook to get or create a personal Set House organization for the current user
 */
export function useEnsurePersonalSetHouseOrg() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const ensureOrg = useMutation({
    mutationFn: () =>
      fetchWithAuth('/api/v1/set-house/personal/ensure-org', token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-set-house'] });
      queryClient.invalidateQueries({ queryKey: ['set-house-organizations'] });
    },
  });

  return ensureOrg;
}

/**
 * Hook to get the user's personal spaces and their listings
 */
export function usePersonalSetHouse() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['personal-set-house'],
    queryFn: () => fetchWithAuth('/api/v1/set-house/personal/spaces', token!),
    enabled: !!token,
    select: (data) => data as PersonalSetHouseResponse,
  });

  const quickAddSpace = useMutation({
    mutationFn: (input: QuickAddSpaceInput) =>
      fetchWithAuth('/api/v1/set-house/personal/quick-add', token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-set-house'] });
    },
  });

  const updateSpace = useMutation({
    mutationFn: ({ spaceId, ...input }: Partial<PersonalSetHouseSpace> & { spaceId: string }) =>
      fetchWithAuth(`/api/v1/set-house/personal/spaces/${spaceId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-set-house'] });
    },
  });

  const deleteSpace = useMutation({
    mutationFn: (spaceId: string) =>
      fetchWithAuth(`/api/v1/set-house/personal/spaces/${spaceId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-set-house'] });
    },
  });

  const updateListing = useMutation({
    mutationFn: ({ spaceId, ...input }: {
      spaceId: string;
      is_listed?: boolean;
      daily_rate?: number;
      hourly_rate?: number;
      weekly_rate?: number;
      monthly_rate?: number;
      deposit_amount?: number;
      deposit_percent?: number;
      insurance_required?: boolean;
      min_booking_hours?: number;
      max_booking_days?: number;
      booking_notes?: string;
      access_instructions?: string;
    }) =>
      fetchWithAuth(`/api/v1/set-house/personal/spaces/${spaceId}/listing`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-set-house'] });
    },
  });

  const createListing = useMutation({
    mutationFn: ({ spaceId, ...input }: {
      spaceId: string;
      daily_rate: number;
      hourly_rate?: number;
      weekly_rate?: number;
      monthly_rate?: number;
      deposit_amount?: number;
      deposit_percent?: number;
      insurance_required?: boolean;
      min_booking_hours?: number;
    }) =>
      fetchWithAuth(`/api/v1/set-house/personal/spaces/${spaceId}/listing`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-set-house'] });
    },
  });

  const deleteListing = useMutation({
    mutationFn: (spaceId: string) =>
      fetchWithAuth(`/api/v1/set-house/personal/spaces/${spaceId}/listing`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-set-house'] });
    },
  });

  return {
    orgId: query.data?.org_id ?? null,
    spaces: query.data?.spaces ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    quickAddSpace,
    updateSpace,
    deleteSpace,
    updateListing,
    createListing,
    deleteListing,
  };
}
