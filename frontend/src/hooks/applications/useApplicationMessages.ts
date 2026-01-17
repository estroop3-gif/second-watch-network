/**
 * useApplicationMessages - Hook for managing application messages
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!applicationId) return { messages: [], total: 0, limit: 50, offset: 0 };
      const response = await api.get(`/community/collab-applications/${applicationId}/messages`);
      return response as MessagesResponse;
    },
    enabled: !!applicationId,
    refetchInterval: 30000, // Poll every 30 seconds for new messages
  });

  const sendMessage = useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!applicationId) throw new Error('No application ID');
      const response = await api.post(`/community/collab-applications/${applicationId}/messages`, input);
      return response as ApplicationMessage;
    },
    onSuccess: (newMessage) => {
      // Optimistically add the new message to the cache
      queryClient.setQueryData<MessagesResponse>(queryKey, (old) => {
        if (!old) return { messages: [newMessage], total: 1, limit: 50, offset: 0 };
        return {
          ...old,
          messages: [...old.messages, newMessage],
          total: old.total + 1,
        };
      });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async () => {
      if (!applicationId) throw new Error('No application ID');
      await api.put(`/community/collab-applications/${applicationId}/messages/mark-read`);
    },
    onSuccess: () => {
      // Update the cache to mark all messages as read
      queryClient.setQueryData<MessagesResponse>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((msg) => ({ ...msg, is_read: true })),
        };
      });
      // Also invalidate unread count
      queryClient.invalidateQueries({ queryKey: ['application-unread-count', applicationId] });
    },
  });

  return {
    messages: data?.messages || [],
    total: data?.total || 0,
    isLoading,
    error,
    refetch,
    sendMessage,
    markAsRead,
  };
}

export function useApplicationUnreadCount(applicationId: string | null) {
  return useQuery({
    queryKey: ['application-unread-count', applicationId],
    queryFn: async () => {
      if (!applicationId) return { unread_count: 0 };
      const response = await api.get(`/community/collab-applications/${applicationId}/messages/unread-count`);
      return response as { unread_count: number };
    },
    enabled: !!applicationId,
    refetchInterval: 60000, // Poll every minute
  });
}
