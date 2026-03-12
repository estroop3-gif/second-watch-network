/**
 * useApplicationMessages - Hook for managing application messages
 * Fix #1: Replaced polling with Socket.IO real-time events.
 */
import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';

export interface ApplicationMessage {
  id: string;
  application_id: string;
  sender_id: string;
  content: string;
  attachments?: Array<{ name: string; url: string; type: string; size: number }>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
}

interface MessagesResponse {
  messages: ApplicationMessage[];
  total: number;
  limit: number;
  offset: number;
}

interface SendMessageInput {
  content: string;
  attachments?: Array<{ name: string; url: string; type: string; size: number }>;
}

export function useApplicationMessages(applicationId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['application-messages', applicationId];
  const { socket } = useSocket();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!applicationId) return { messages: [], total: 0, limit: 50, offset: 0 };
      const response = await api.get(`/community/collab-applications/${applicationId}/messages`);
      return response as MessagesResponse;
    },
    enabled: !!applicationId,
    // No refetchInterval — Socket.IO handles live delivery
  });

  // Real-time: inject incoming message from Socket.IO directly into the cache
  const handleNewMessage = useCallback(
    (payload: { application_id: string; message: ApplicationMessage }) => {
      if (payload.application_id !== applicationId) return;
      queryClient.setQueryData<MessagesResponse>(queryKey, (old) => {
        if (!old) return { messages: [payload.message], total: 1, limit: 50, offset: 0 };
        // Guard against duplicates (the sender gets it via optimistic update already)
        if (old.messages.some((m) => m.id === payload.message.id)) return old;
        return { ...old, messages: [...old.messages, payload.message], total: old.total + 1 };
      });
      queryClient.invalidateQueries({ queryKey: ['application-unread-count', applicationId] });
    },
    [applicationId, queryClient, queryKey],
  );

  useEffect(() => {
    if (!socket || !applicationId) return;
    socket.on('new_application_message', handleNewMessage);
    return () => { socket.off('new_application_message', handleNewMessage); };
  }, [socket, applicationId, handleNewMessage]);

  const sendMessage = useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!applicationId) throw new Error('No application ID');
      const response = await api.post(`/community/collab-applications/${applicationId}/messages`, input);
      return response as ApplicationMessage;
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData<MessagesResponse>(queryKey, (old) => {
        if (!old) return { messages: [newMessage], total: 1, limit: 50, offset: 0 };
        if (old.messages.some((m) => m.id === newMessage.id)) return old;
        return { ...old, messages: [...old.messages, newMessage], total: old.total + 1 };
      });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error('No application ID');
      await api.put(`/community/collab-applications/${applicationId}/messages/mark-read`);
    },
    onSuccess: () => {
      queryClient.setQueryData<MessagesResponse>(queryKey, (old) => {
        if (!old) return old;
        return { ...old, messages: old.messages.map((msg) => ({ ...msg, is_read: true })) };
      });
      queryClient.invalidateQueries({ queryKey: ['application-unread-count', applicationId] });
    },
  });

  return { messages: data?.messages || [], total: data?.total || 0, isLoading, error, refetch, sendMessage, markAsRead };
}

export function useApplicationUnreadCount(applicationId: string | null) {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const queryKey = ['application-unread-count', applicationId];

  // Invalidate unread count whenever a socket message arrives for this application
  useEffect(() => {
    if (!socket || !applicationId) return;
    const handler = (payload: { application_id: string }) => {
      if (payload.application_id === applicationId) {
        queryClient.invalidateQueries({ queryKey });
      }
    };
    socket.on('new_application_message', handler);
    return () => { socket.off('new_application_message', handler); };
  }, [socket, applicationId, queryClient, queryKey]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!applicationId) return { unread_count: 0 };
      const response = await api.get(`/community/collab-applications/${applicationId}/messages/unread-count`);
      return response as { unread_count: number };
    },
    enabled: !!applicationId,
    // No refetchInterval — socket triggers invalidation instead
  });
}
