import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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
  total: number;
  messages: number;
  connection_requests: number;
  submission_updates: number;
};

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notesQuery = useQuery<NotificationRow[]>({
    queryKey: ['notifications', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user) return [];
      const data = await api.listNotifications(user.id, { limit: 200 });
      return data || [];
    },
  });

  const countsQuery = useQuery<NotificationCounts>({
    queryKey: ['notificationCounts', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user) return { total: 0, messages: 0, connection_requests: 0, submission_updates: 0 };
      const data = await api.getNotificationCounts(user.id);
      return data as NotificationCounts;
    },
    // keep counts relatively fresh
    staleTime: 15_000,
  });

  const unreadCount = useMemo(
    () => countsQuery.data?.total ?? (notesQuery.data || []).filter(n => n.status === 'unread').length,
    [countsQuery.data, notesQuery.data]
  );

  // Polling fallback for realtime updates (since we no longer have Supabase realtime)
  useEffect(() => {
    if (!user?.id) return;

    // Poll every 60 seconds for new notifications
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      queryClient.invalidateQueries({ queryKey: ['notificationCounts', user.id] });
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id, queryClient]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    await api.markNotificationsRead([id]);
    queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
    queryClient.invalidateQueries({ queryKey: ['notificationCounts', user.id] });
  };

  const markAllAsRead = async (tab: 'all' | 'unread' | 'messages' | 'requests' | 'submissions' = 'all') => {
    if (!user?.id) return;
    await api.markAllNotificationsRead(user.id, tab);
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
