/**
 * Personal Gear Hooks
 * Data fetching and mutations for Gear House Lite functionality
 * Allows ALL users (including FREE role) to manage personal gear listings
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  PersonalGearResponse,
  PersonalGearAsset,
  QuickAddAssetInput,
  QuickAddAssetResponse,
  EnsurePersonalOrgResponse,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Personal Gear API] ${options?.method || 'GET'} ${fullUrl}`);

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
    console.error(`[Personal Gear API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text);
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Ensure user has a personal gear organization.
 * Creates one if it doesn't exist.
 */
export function useEnsurePersonalOrg() {
  const { token } = useAuth();

  return useMutation<EnsurePersonalOrgResponse, Error>({
    mutationFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth('/api/v1/gear/personal/ensure-org', token, {
        method: 'POST',
      });
    },
  });
}

/**
 * Get all assets and listings for user's personal gear org.
 */
export function usePersonalGear() {
  const { token } = useAuth();

  return useQuery<PersonalGearResponse>({
    queryKey: ['personal-gear'],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth('/api/v1/gear/personal/my-gear', token);
    },
    enabled: !!token,
  });
}

/**
 * Quick add asset with optional listing creation.
 * Simplified flow for lite users.
 */
export function useQuickAddAsset() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<QuickAddAssetResponse, Error, QuickAddAssetInput>({
    mutationFn: async (input) => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth('/api/v1/gear/personal/quick-add-asset', token, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      // Invalidate personal gear list
      queryClient.invalidateQueries({ queryKey: ['personal-gear'] });
      // Also invalidate marketplace listings so new items show up
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });
}

/**
 * Delete an asset from user's personal gear.
 */
export function useDeletePersonalAsset() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; deleted_asset_id: string }, Error, string>({
    mutationFn: async (assetId) => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth(`/api/v1/gear/personal/assets/${assetId}`, token, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-gear'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });
}

/**
 * Update an asset and its listing in user's personal gear.
 */
export function useUpdatePersonalAsset() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<QuickAddAssetResponse, Error, { assetId: string; input: QuickAddAssetInput }>({
    mutationFn: async ({ assetId, input }) => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth(`/api/v1/gear/personal/assets/${assetId}/listing`, token, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-gear'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });
}

/**
 * Toggle an asset's marketplace listing status (listed/unlisted).
 */
export function useTogglePersonalAssetListing() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ asset_id: string; is_listed: boolean }, Error, string>({
    mutationFn: async (assetId) => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth(`/api/v1/gear/personal/assets/${assetId}/toggle-listing`, token, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-gear'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-listings'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-search'] });
    },
  });
}
