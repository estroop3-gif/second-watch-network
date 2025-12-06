/**
 * useCollabs - Hook for fetching and managing community collabs
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      let query = supabase
        .from('community_collabs')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (type !== 'all') {
        query = query.eq('type', type);
      }

      if (isRemote !== null) {
        query = query.eq('is_remote', isRemote);
      }

      if (compensationType !== 'all') {
        query = query.eq('compensation_type', compensationType);
      }

      if (orderOnly) {
        query = query.eq('is_order_only', true);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: collabsData, error } = await query;

      if (error) throw error;
      if (!collabsData || collabsData.length === 0) return [];

      // Fetch profiles for all user_ids
      const userIds = [...new Set(collabsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', userIds);

      // Map profiles to collabs
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return collabsData.map(collab => ({
        ...collab,
        profile: profileMap.get(collab.user_id) || null,
      })) as CommunityCollab[];
    },
  });

  const createCollab = useMutation({
    mutationFn: async (input: CollabInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('community_collabs')
        .insert({
          user_id: userData.user.id,
          title: input.title,
          type: input.type,
          description: input.description,
          location: input.location || null,
          is_remote: input.is_remote || false,
          compensation_type: input.compensation_type || null,
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          tags: input.tags || [],
          is_order_only: input.is_order_only || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const updateCollab = useMutation({
    mutationFn: async ({ id, ...input }: CollabInput & { id: string }) => {
      const { data, error } = await supabase
        .from('community_collabs')
        .update({
          title: input.title,
          type: input.type,
          description: input.description,
          location: input.location || null,
          is_remote: input.is_remote || false,
          compensation_type: input.compensation_type || null,
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          tags: input.tags || [],
          is_order_only: input.is_order_only || false,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const deleteCollab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('community_collabs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const deactivateCollab = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('community_collabs')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
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

      const { data: collab, error } = await supabase
        .from('community_collabs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .eq('id', collab.user_id)
        .single();

      return { ...collab, profile } as CommunityCollab;
    },
    enabled: !!id,
  });
}
