import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  status: 'unread' | 'read';
  related_id: string | null;
  created_at: string;
  payload?: any | null;
};

type NotificationCounts = {
  unread_total: number;
  unread_messages: number;
  unread_requests: number;
  unread_submissions: number;
  updated_at?: string;
};

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notesQuery = useQuery<NotificationRow[]>({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const countsQuery = useQuery<NotificationCounts>({
    queryKey: ['notificationCounts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notifications-counts');
      if (error) throw new Error(error.message);
      return data as NotificationCounts;
    },
    // keep counts relatively fresh
    staleTime: 15_000,
  });

  const unreadCount = useMemo(
    () => countsQuery.data?.unread_total ?? (notesQuery.data || []).filter(n => n.status === 'unread').length,
    [countsQuery.data, notesQuery.data]
  );

  // Realtime invalidate for both list and counts
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:user:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        queryClient.invalidateQueries({ queryKey: ['notificationCounts', user.id] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        queryClient.invalidateQueries({ queryKey: ['notificationCounts', user.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    const { error } = await supabase.functions.invoke('notifications-read', { body: { ids: [id] } });
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    queryClient.invalidateQueries({ queryKey: ['notificationCounts', user.id] });
  };

  const markAllAsRead = async (tab: 'all' | 'unread' | 'messages' | 'requests' | 'submissions' = 'all') => {
    if (!user?.id) return;
    const { error } = await supabase.functions.invoke('notifications-read', { body: { tab } });
    if (error) throw new Error(error.message);
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    queryClient.invalidateQueries({ queryKey: ['notificationCounts', user.id] });
  };

  return {
    notifications: notesQuery.data || [],
    unreadCount,
    isLoading: notesQuery.isLoading || countsQuery.isLoading,
    markAsRead,
    markAllAsRead,
    refresh: () => {
      notesQuery.refetch();
      countsQuery.refetch();
    },
    counts: countsQuery.data,
  };
}