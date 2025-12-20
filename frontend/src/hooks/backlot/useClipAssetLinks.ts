/**
 * useClipAssetLinks - Hooks for linking dailies clips to assets
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =====================================================
// Types
// =====================================================

export interface ClipAssetLink {
  link_id: string;
  link_type: 'source' | 'reference' | 'alternate';
  link_notes: string | null;
  linked_at: string;
}

export interface LinkedClip extends ClipAssetLink {
  clip: {
    id: string;
    file_name: string | null;
    scene_number: string | null;
    take_number: number | null;
    duration_seconds: number | null;
    proxy_url: string | null;
    cloud_url: string | null;
    thumbnail_url: string | null;
    is_circle_take: boolean;
    rating: number | null;
  };
}

export interface LinkedAsset extends ClipAssetLink {
  asset: {
    id: string;
    title: string;
    asset_type: string;
    status: string;
    version_label: string | null;
  };
}

// =====================================================
// Get Linked Assets for a Clip
// =====================================================

export function useClipLinkedAssets(clipId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'clip-linked-assets', clipId],
    queryFn: async () => {
      if (!clipId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clips/${clipId}/linked-assets`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch linked assets' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      const data = await response.json();
      return (data.assets || []) as LinkedAsset[];
    },
    enabled: !!clipId,
  });
}

// =====================================================
// Get Source Clips for an Asset
// =====================================================

export function useAssetSourceClips(assetId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'asset-source-clips', assetId],
    queryFn: async () => {
      if (!assetId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/assets/${assetId}/source-clips`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch source clips' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      const data = await response.json();
      return (data.clips || []) as LinkedClip[];
    },
    enabled: !!assetId,
  });
}

// =====================================================
// Link Clip to Asset
// =====================================================

export function useLinkClipToAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clipId: string;
      assetId: string;
      linkType?: 'source' | 'reference' | 'alternate';
      notes?: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clips/${input.clipId}/link-asset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            asset_id: input.assetId,
            link_type: input.linkType || 'source',
            notes: input.notes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to link clip to asset' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate both clip and asset queries
      queryClient.invalidateQueries({ queryKey: ['backlot', 'clip-linked-assets', variables.clipId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'asset-source-clips', variables.assetId] });
      // Also invalidate the dailies clips list to update any badges
      queryClient.invalidateQueries({ queryKey: ['backlot', 'dailies'] });
    },
  });
}

// =====================================================
// Bulk Link Clips to Asset
// =====================================================

export function useBulkLinkClipsToAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      clipIds: string[];
      assetId: string;
      linkType?: 'source' | 'reference' | 'alternate';
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/bulk-link-assets?asset_id=${input.assetId}&link_type=${input.linkType || 'source'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input.clipIds),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to bulk link clips' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate asset and all clip queries
      queryClient.invalidateQueries({ queryKey: ['backlot', 'asset-source-clips', variables.assetId] });
      variables.clipIds.forEach(clipId => {
        queryClient.invalidateQueries({ queryKey: ['backlot', 'clip-linked-assets', clipId] });
      });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'dailies'] });
    },
  });
}

// =====================================================
// Remove Clip-Asset Link
// =====================================================

export function useRemoveClipAssetLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { linkId: string; clipId?: string; assetId?: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clip-asset-links/${input.linkId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove link' }));
        throw new Error(typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail));
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      if (variables.clipId) {
        queryClient.invalidateQueries({ queryKey: ['backlot', 'clip-linked-assets', variables.clipId] });
      }
      if (variables.assetId) {
        queryClient.invalidateQueries({ queryKey: ['backlot', 'asset-source-clips', variables.assetId] });
      }
      queryClient.invalidateQueries({ queryKey: ['backlot', 'dailies'] });
    },
  });
}
