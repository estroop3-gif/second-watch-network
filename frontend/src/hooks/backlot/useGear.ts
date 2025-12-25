/**
 * useGear - Hook for managing production gear/equipment
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BacklotGearItem, GearItemInput, BacklotGearStatus } from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

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


// Types for gear costs
export interface GearCostItem {
  id: string;
  name: string;
  category: string | null;
  is_owned: boolean;
  rental_house: string | null;
  rental_cost_per_day: number | null;
  pickup_date: string | null;
  return_date: string | null;
  purchase_cost: number | null;
  budget_line_item_id: string | null;
  status: string;
  calculated_rental_cost: number;
  rental_days: number;
  daily_rate: number;
}

export interface GearCostsByCategory {
  [category: string]: {
    rental_cost: number;
    purchase_cost: number;
    count: number;
  };
}

export interface GearCostsByDay {
  [date: string]: {
    total: number;
    items: { id: string; name: string; daily_rate: number }[];
  };
}

export interface GearCostsResponse {
  total_rental_cost: number;
  total_purchase_cost: number;
  total_cost: number;
  by_category: GearCostsByCategory;
  by_day: GearCostsByDay;
  items: GearCostItem[];
}

// Fetch gear costs summary for a project
export function useGearCosts(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-gear-costs', projectId],
    queryFn: async (): Promise<GearCostsResponse | null> => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/gear/costs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch gear costs' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    enabled: !!projectId,
  });
}

// Sync gear costs to budget
export interface SyncGearToBudgetOptions {
  projectId: string;
  createLineItems?: boolean;
  updateActuals?: boolean;
  categoryName?: string;
}

export interface SyncGearToBudgetResponse {
  success: boolean;
  created: number;
  updated: number;
  linked: number;
  category_id: string;
}

export function useSyncGearToBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: SyncGearToBudgetOptions): Promise<SyncGearToBudgetResponse> => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (options.createLineItems !== undefined) {
        params.append('create_line_items', String(options.createLineItems));
      }
      if (options.updateActuals !== undefined) {
        params.append('update_actuals', String(options.updateActuals));
      }
      if (options.categoryName) {
        params.append('category_name', options.categoryName);
      }

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${options.projectId}/budget/sync-gear?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to sync gear to budget' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    onSuccess: (_data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-gear-costs'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-categories'] });
    },
  });
}

// Get daily gear costs for a specific daily budget
export interface DailyGearItem {
  id: string;
  name: string;
  category: string | null;
  rental_cost_per_day: number | null;
  rental_house: string | null;
  pickup_date: string | null;
  return_date: string | null;
  is_owned: boolean;
  purchase_cost: number | null;
  status: string;
  source: 'date_range' | 'manual_assignment';
  daily_cost: number;
}

export interface DailyGearCostsResponse {
  daily_budget_id: string;
  shoot_date: string | null;
  gear_total: number;
  items: DailyGearItem[];
}

export function useDailyGearCosts(dailyBudgetId: string | null) {
  return useQuery({
    queryKey: ['backlot-daily-gear-costs', dailyBudgetId],
    queryFn: async (): Promise<DailyGearCostsResponse | null> => {
      if (!dailyBudgetId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/daily-budgets/${dailyBudgetId}/gear-costs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch daily gear costs' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    enabled: !!dailyBudgetId,
  });
}
