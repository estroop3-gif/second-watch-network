/**
 * useShotLists - Hook for managing professional shot lists
 * For producers, DPs, and 1st ADs to create and manage shot lists
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotShotList,
  BacklotShot,
  ShotListInput,
  ShotInput,
} from '@/types/backlot';

// =====================================================
// SHOT LIST HOOKS
// =====================================================

interface UseShotListsOptions {
  projectId: string | null;
  includeArchived?: boolean;
}

/**
 * Get all shot lists for a project
 */
export function useShotLists(options: UseShotListsOptions) {
  const { projectId, includeArchived = false } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-shot-lists', { projectId, includeArchived }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const params = new URLSearchParams();
      if (includeArchived) params.set('include_archived', 'true');
      const result = await api.get<{ success: boolean; shot_lists: BacklotShotList[] }>(
        `/api/v1/backlot/projects/${projectId}/shot-lists?${params.toString()}`
      );
      return result.shot_lists || [];
    },
    enabled: !!projectId,
  });

  const createShotList = useMutation({
    mutationFn: async (input: ShotListInput) => {
      if (!projectId) throw new Error('No project ID');
      const result = await api.post<{ success: boolean; shot_list: BacklotShotList }>(
        `/api/v1/backlot/projects/${projectId}/shot-lists`,
        input
      );
      return result.shot_list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
    },
  });

  const archiveShotList = useMutation({
    mutationFn: async ({ shotListId, isArchived }: { shotListId: string; isArchived: boolean }) => {
      const result = await api.put<{ success: boolean; shot_list: BacklotShotList }>(
        `/api/v1/backlot/shot-lists/${shotListId}`,
        { is_archived: isArchived }
      );
      return result.shot_list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
    },
  });

  return {
    shotLists: data || [],
    isLoading,
    error,
    refetch,
    createShotList,
    archiveShotList,
  };
}

/**
 * Get a single shot list with all its shots
 */
export function useShotList(shotListId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-shot-list', shotListId],
    queryFn: async () => {
      if (!shotListId) return null;
      const result = await api.get<{ success: boolean; shot_list: BacklotShotList }>(
        `/api/v1/backlot/shot-lists/${shotListId}`
      );
      return result.shot_list || null;
    },
    enabled: !!shotListId,
  });

  const updateShotList = useMutation({
    mutationFn: async (input: Partial<ShotListInput> & { is_archived?: boolean }) => {
      if (!shotListId) throw new Error('No shot list ID');
      const result = await api.put<{ success: boolean; shot_list: BacklotShotList }>(
        `/api/v1/backlot/shot-lists/${shotListId}`,
        input
      );
      return result.shot_list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
    },
  });

  const deleteShotList = useMutation({
    mutationFn: async (hardDelete: boolean = false) => {
      if (!shotListId) throw new Error('No shot list ID');
      await api.delete<{ success: boolean }>(
        `/api/v1/backlot/shot-lists/${shotListId}?hard_delete=${hardDelete}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
    },
  });

  const archiveShotList = useMutation({
    mutationFn: async () => {
      if (!shotListId) throw new Error('No shot list ID');
      const result = await api.put<{ success: boolean; shot_list: BacklotShotList }>(
        `/api/v1/backlot/shot-lists/${shotListId}`,
        { is_archived: true }
      );
      return result.shot_list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
    },
  });

  return {
    shotList: data,
    shots: data?.shots || [],
    isLoading,
    error,
    refetch,
    updateShotList,
    deleteShotList,
    archiveShotList,
  };
}

// =====================================================
// SHOT HOOKS
// =====================================================

interface UseShotListShotsOptions {
  shotListId: string | null;
}

/**
 * Manage shots within a shot list
 */
export function useShotListShots(options: UseShotListShotsOptions) {
  const { shotListId } = options;
  const queryClient = useQueryClient();

  const createShot = useMutation({
    mutationFn: async (input: ShotInput) => {
      if (!shotListId) throw new Error('No shot list ID');
      const result = await api.post<{ success: boolean; shot: BacklotShot }>(
        `/api/v1/backlot/shot-lists/${shotListId}/shots`,
        input
      );
      return result.shot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
      // Also invalidate scenes list and coverage data so Coverage tab updates
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
  });

  const bulkCreateShots = useMutation({
    mutationFn: async (inputs: ShotInput[]) => {
      if (!shotListId) throw new Error('No shot list ID');
      const result = await api.post<{ success: boolean; shots: BacklotShot[]; count: number }>(
        `/api/v1/backlot/shot-lists/${shotListId}/shots/bulk`,
        inputs
      );
      return result.shots;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
  });

  const updateShot = useMutation({
    mutationFn: async ({ id, ...input }: ShotInput & { id: string }) => {
      const result = await api.put<{ success: boolean; shot: BacklotShot }>(
        `/api/v1/backlot/shots/${id}`,
        input
      );
      return result.shot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
  });

  const deleteShot = useMutation({
    mutationFn: async (id: string) => {
      await api.delete<{ success: boolean }>(`/api/v1/backlot/shots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
  });

  const toggleShotCompleted = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const result = await api.put<{ success: boolean; shot: BacklotShot }>(
        `/api/v1/backlot/shots/${id}`,
        { is_completed }
      );
      return result.shot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
    },
  });

  const reorderShots = useMutation({
    mutationFn: async (shots: { id: string; sort_order: number }[]) => {
      if (!shotListId) throw new Error('No shot list ID');
      await api.post<{ success: boolean }>(
        `/api/v1/backlot/shot-lists/${shotListId}/shots/reorder`,
        { shots }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
    },
  });

  const cloneShot = useMutation({
    mutationFn: async ({ shotId, destinationShotListId }: { shotId: string; destinationShotListId?: string }) => {
      const result = await api.post<{ success: boolean; shot: BacklotShot }>(
        `/api/v1/backlot/shots/${shotId}/clone`,
        { destination_shot_list_id: destinationShotListId }
      );
      return result.shot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-list', shotListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-shot-lists'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
  });

  return {
    createShot,
    bulkCreateShots,
    updateShot,
    deleteShot,
    toggleShotCompleted,
    reorderShots,
    cloneShot,
  };
}
