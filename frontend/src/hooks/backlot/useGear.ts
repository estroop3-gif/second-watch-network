/**
 * useGear - Hook for managing production gear/equipment
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BacklotGearItem, GearItemInput, BacklotGearStatus } from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UseGearOptions {
  projectId: string | null;
  category?: string;
  status?: BacklotGearStatus | 'all';
  limit?: number;
}

export function useGear(options: UseGearOptions) {
  const { projectId, category, status = 'all', limit = 100 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-gear', { projectId, category, status, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('limit', String(limit));
      if (category) params.append('category', category);
      if (status !== 'all') params.append('status', status);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/gear?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch gear' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.gear || []) as BacklotGearItem[];
    },
    enabled: !!projectId,
  });

  const createGear = useMutation({
    mutationFn: async ({ projectId, ...input }: GearItemInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/gear`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create gear' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.gear || result) as BacklotGearItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  const updateGear = useMutation({
    mutationFn: async ({ id, ...input }: Partial<GearItemInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/gear/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update gear' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.gear || result) as BacklotGearItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BacklotGearStatus }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/gear/${id}/status?status=${status}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update status' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.gear || result) as BacklotGearItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  const deleteGear = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/gear/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete gear' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  return {
    gear: data || [],
    isLoading,
    error,
    refetch,
    createGear,
    updateGear,
    updateStatus,
    deleteGear,
  };
}

// Fetch single gear item
export function useGearItem(id: string | null) {
  return useQuery({
    queryKey: ['backlot-gear-item', id],
    queryFn: async () => {
      if (!id) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/gear/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch gear' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.gear || result) as BacklotGearItem;
    },
    enabled: !!id,
  });
}

// Get gear categories for a project
export function useGearCategories(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-gear-categories', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/gear/categories`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch categories' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.categories || []) as string[];
    },
    enabled: !!projectId,
  });
}

// Common gear categories constant
export const GEAR_CATEGORIES = [
  'Camera',
  'Lenses',
  'Lighting',
  'Grip',
  'Audio',
  'Monitors',
  'Power/Batteries',
  'Storage/Media',
  'Tripods/Stabilizers',
  'Accessories',
  'Other',
] as const;
