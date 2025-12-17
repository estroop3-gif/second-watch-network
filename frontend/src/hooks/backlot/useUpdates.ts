/**
 * useUpdates - Hook for managing project updates/announcements
 * Enhanced with visible_to_roles filtering and read tracking
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BacklotProjectUpdate, ProjectUpdateInput, BacklotUpdateType } from '@/types/backlot';

interface UseUpdatesOptions {
  projectId: string | null;
  type?: BacklotUpdateType | 'all';
  publicOnly?: boolean;
  limit?: number;
}

// Extended update type with read status
export interface BacklotProjectUpdateWithRead extends BacklotProjectUpdate {
  visible_to_roles?: string[];
  has_read?: boolean;
}

export function useUpdates(options: UseUpdatesOptions) {
  const { projectId, type = 'all', publicOnly = false, limit = 50 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-updates', { projectId, type, publicOnly, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;

      let query = supabase
        .from('backlot_project_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (type !== 'all') {
        query = query.eq('type', type);
      }

      if (publicOnly) {
        query = query.eq('is_public', true);
      }

      const { data: updatesData, error } = await query;
      if (error) throw error;
      if (!updatesData || updatesData.length === 0) return [];

      // Fetch author profiles
      const authorIds = [...new Set(updatesData.map(u => u.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', authorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch read status for current user
      let readMap = new Map<string, boolean>();
      if (currentUserId) {
        const updateIds = updatesData.map(u => u.id);
        const { data: reads } = await supabase
          .from('backlot_project_update_reads')
          .select('update_id')
          .eq('user_id', currentUserId)
          .in('update_id', updateIds);

        reads?.forEach(r => readMap.set(r.update_id, true));
      }

      return updatesData.map(update => ({
        ...update,
        author: profileMap.get(update.created_by) || null,
        has_read: readMap.get(update.id) || false,
      })) as BacklotProjectUpdateWithRead[];
    },
    enabled: !!projectId,
  });

  const createUpdate = useMutation({
    mutationFn: async ({ projectId, ...input }: ProjectUpdateInput & { projectId: string; visible_to_roles?: string[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_project_updates')
        .insert({
          project_id: projectId,
          title: input.title,
          content: input.content,
          type: input.type || 'general',
          is_public: input.is_public ?? false,
          attachments: input.attachments || [],
          visible_to_roles: (input as any).visible_to_roles || [],
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectUpdate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (updateId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('backlot_project_update_reads')
        .upsert({
          update_id: updateId,
          user_id: userData.user.id,
        }, {
          onConflict: 'update_id,user_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const updateUpdate = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProjectUpdateInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.type !== undefined) updateData.type = input.type;
      if (input.is_public !== undefined) updateData.is_public = input.is_public;
      if (input.attachments !== undefined) updateData.attachments = input.attachments;

      const { data, error } = await supabase
        .from('backlot_project_updates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectUpdate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const deleteUpdate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_project_updates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const togglePublic = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const { data, error } = await supabase
        .from('backlot_project_updates')
        .update({ is_public: isPublic })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectUpdate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  return {
    updates: data || [],
    isLoading,
    error,
    refetch,
    createUpdate,
    updateUpdate,
    deleteUpdate,
    togglePublic,
    markAsRead,
  };
}

// Fetch single update
export function useUpdate(id: string | null) {
  return useQuery({
    queryKey: ['backlot-update', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: update, error } = await supabase
        .from('backlot_project_updates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch author profile
      const { data: author } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .eq('id', update.created_by)
        .single();

      return { ...update, author } as BacklotProjectUpdate;
    },
    enabled: !!id,
  });
}

// Fetch public updates for a project (for public project page)
export function usePublicUpdates(projectId: string | null, limit: number = 10) {
  return useQuery({
    queryKey: ['backlot-public-updates', projectId, limit],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: updatesData, error } = await supabase
        .from('backlot_project_updates')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!updatesData || updatesData.length === 0) return [];

      // Fetch author profiles
      const authorIds = [...new Set(updatesData.map(u => u.created_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', authorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return updatesData.map(update => ({
        ...update,
        author: profileMap.get(update.created_by) || null,
      })) as BacklotProjectUpdate[];
    },
    enabled: !!projectId,
  });
}
