/**
 * useCollabs - Hook for fetching and managing community collabs
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CommunityCollab, CollabType, CompensationType } from '@/types/community';

interface UseCollabsOptions {
  type?: CollabType | 'all';
  isRemote?: boolean | null;
  compensationType?: CompensationType | 'all';
  orderOnly?: boolean;
  userId?: string;
  limit?: number;
}

interface CollabInput {
  title: string;
  type: CollabType;
  description: string;
  location?: string;
  is_remote?: boolean;
  compensation_type?: CompensationType;
  start_date?: string;
  end_date?: string;
  tags?: string[];
  is_order_only?: boolean;
}

export function useCollabs(options: UseCollabsOptions = {}) {
  const {
    type = 'all',
    isRemote = null,
    compensationType = 'all',
    orderOnly = false,
    userId,
    limit = 50,
  } = options;

  const queryClient = useQueryClient();

  const queryKey = ['community-collabs', { type, isRemote, compensationType, orderOnly, userId, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const collabsData = await api.listCollabs({
        type: type !== 'all' ? type : undefined,
        isRemote: isRemote !== null ? isRemote : undefined,
        compensationType: compensationType !== 'all' ? compensationType : undefined,
        orderOnly,
        userId,
        limit,
      });

      return (collabsData || []) as CommunityCollab[];
    },
  });

  const createCollab = useMutation({
    mutationFn: async (input: CollabInput) => {
      const data = await api.createCollab({
        title: input.title,
        type: input.type,
        description: input.description,
        location: input.location || undefined,
        is_remote: input.is_remote || false,
        compensation_type: input.compensation_type || undefined,
        start_date: input.start_date || undefined,
        end_date: input.end_date || undefined,
        tags: input.tags || [],
        is_order_only: input.is_order_only || false,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const updateCollab = useMutation({
    mutationFn: async ({ id, ...input }: CollabInput & { id: string }) => {
      const data = await api.updateCollab(id, {
        title: input.title,
        type: input.type,
        description: input.description,
        location: input.location || undefined,
        is_remote: input.is_remote || false,
        compensation_type: input.compensation_type || undefined,
        start_date: input.start_date || undefined,
        end_date: input.end_date || undefined,
        tags: input.tags || [],
        is_order_only: input.is_order_only || false,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const deleteCollab = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteCollab(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const deactivateCollab = useMutation({
    mutationFn: async (id: string) => {
      await api.deactivateCollab(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  return {
    collabs: data || [],
    isLoading,
    error,
    refetch,
    createCollab,
    updateCollab,
    deleteCollab,
    deactivateCollab,
  };
}

export function useCollab(id: string | null) {
  return useQuery({
    queryKey: ['community-collab', id],
    queryFn: async () => {
      if (!id) return null;
      const collab = await api.getCollab(id);
      return collab as CommunityCollab;
    },
    enabled: !!id,
  });
}
