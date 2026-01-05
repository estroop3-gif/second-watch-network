/**
 * useUnifiedConversations - Fetch and manage unified DM conversations
 * Works with both legacy DM system and Coms DM channels
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface UnifiedConversation {
  id: string;
  source: 'legacy' | 'coms';
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  coms_channel_id: string | null;
  unread_count: number;
  other_participant: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface UnifiedMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  source: 'legacy' | 'coms';
  sender?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Hook to fetch unified conversations list
 */
export function useUnifiedConversations() {
  const { user } = useAuth();

  return useQuery<UnifiedConversation[]>({
    queryKey: ['unified-conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await api.get(`/api/v1/dm/unified/conversations?user_id=${user.id}`);
      return response.data || [];
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch messages for a unified conversation
 */
export function useUnifiedMessages(conversationId: string | null) {
  return useQuery<UnifiedMessage[]>({
    queryKey: ['unified-messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const response = await api.get(`/api/v1/dm/unified/conversations/${conversationId}/messages`);
      return response.data || [];
    },
    enabled: !!conversationId,
  });
}

/**
 * Hook to send a message in a unified conversation
 */
export function useSendUnifiedMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      recipientId,
      content,
    }: {
      conversationId?: string;
      recipientId?: string;
      content: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await api.post(`/api/v1/dm/unified/messages?sender_id=${user.id}`, {
        conversation_id: conversationId,
        recipient_id: recipientId,
        content,
      });

      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['unified-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unified-messages', data.conversation_id] });
    },
  });
}

/**
 * Hook to mark a conversation as read
 */
export function useMarkUnifiedConversationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await api.post(
        `/api/v1/dm/unified/conversations/${conversationId}/mark-read?user_id=${user.id}`
      );

      return response.data;
    },
    onSuccess: (_, conversationId) => {
      // Invalidate queries to refresh unread counts
      queryClient.invalidateQueries({ queryKey: ['unified-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unified-messages', conversationId] });
    },
  });
}

/**
 * Hook to create or get a conversation with a user
 */
export function useCreateUnifiedConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const response = await api.post(
        `/api/v1/dm/unified/conversations/create?user_id=${user.id}&other_user_id=${otherUserId}`
      );

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-conversations'] });
    },
  });
}
