/**
 * useMessagesSocket - Real-time DM messaging via WebSocket
 * Handles subscription, message updates, typing indicators, and read receipts
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { useAuth } from '@/context/AuthContext';
import type { SocketEvents } from '@/context/socketContextDef';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_read: boolean;
  sender?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface UseMessagesSocketOptions {
  conversationId: string;
  enabled?: boolean;
}

interface UseMessagesSocketReturn {
  isSubscribed: boolean;
  typingUsers: Map<string, string>; // user_id -> username
  startTyping: () => void;
  stopTyping: () => void;
}

export function useMessagesSocket({
  conversationId,
  enabled = true,
}: UseMessagesSocketOptions): UseMessagesSocketReturn {
  const { user } = useAuth();
  const { isConnected, on, off, emit } = useSocket();
  const queryClient = useQueryClient();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Subscribe to conversation on mount
  useEffect(() => {
    if (!enabled || !isConnected || !conversationId || !emit) {
      setIsSubscribed(false);
      return;
    }

    console.log('[useMessagesSocket] Subscribing to DM:', conversationId);
    emit('join_dm', { conversation_id: conversationId });
    setIsSubscribed(true);

    return () => {
      console.log('[useMessagesSocket] Unsubscribing from DM:', conversationId);
      emit('leave_dm', { conversation_id: conversationId });
      setIsSubscribed(false);
    };
  }, [conversationId, isConnected, enabled, emit]);

  // Handle new message
  useEffect(() => {
    if (!enabled || !conversationId) return;

    const handleNewMessage: SocketEvents['dm_new_message'] = (data) => {
      if (data.conversation_id !== conversationId) return;

      console.log('[useMessagesSocket] New message received:', data.message.id);

      // Add to React Query cache
      queryClient.setQueryData<Message[]>(
        ['messages', conversationId],
        (oldMessages) => {
          if (!oldMessages) return [data.message];
          // Avoid duplicates
          if (oldMessages.some((m) => m.id === data.message.id)) {
            return oldMessages;
          }
          return [...oldMessages, data.message];
        }
      );

      // Invalidate conversations list to update last_message
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    on('dm_new_message', handleNewMessage);
    return () => off('dm_new_message', handleNewMessage);
  }, [conversationId, enabled, on, off, queryClient]);

  // Handle typing indicators
  useEffect(() => {
    if (!enabled || !conversationId) return;

    const handleTyping: SocketEvents['dm_typing'] = (data) => {
      if (data.conversation_id !== conversationId) return;
      if (data.user_id === user?.id) return; // Ignore self

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.is_typing) {
          next.set(data.user_id, data.username);
        } else {
          next.delete(data.user_id);
        }
        return next;
      });
    };

    on('dm_typing', handleTyping);
    return () => off('dm_typing', handleTyping);
  }, [conversationId, enabled, on, off, user?.id]);

  // Handle read receipts
  useEffect(() => {
    if (!enabled || !conversationId) return;

    const handleRead: SocketEvents['dm_read'] = (data) => {
      if (data.conversation_id !== conversationId) return;
      if (data.user_id === user?.id) return; // Ignore self

      console.log('[useMessagesSocket] Read receipt from:', data.user_id);

      // Update message read status in cache
      queryClient.setQueryData<Message[]>(
        ['messages', conversationId],
        (oldMessages) => {
          if (!oldMessages) return oldMessages;
          return oldMessages.map((m) => {
            // Mark messages sent by current user as read
            if (m.sender_id === user?.id && !m.is_read) {
              return { ...m, is_read: true };
            }
            return m;
          });
        }
      );
    };

    on('dm_read', handleRead);
    return () => off('dm_read', handleRead);
  }, [conversationId, enabled, on, off, queryClient, user?.id]);

  // Start typing indicator
  const startTyping = useCallback(() => {
    if (!isConnected || !emit || !conversationId || isTypingRef.current) return;

    isTypingRef.current = true;
    emit('dm_typing_start', { conversation_id: conversationId });

    // Auto-stop typing after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emit('dm_typing_stop', { conversation_id: conversationId });
      }
    }, 3000);
  }, [isConnected, emit, conversationId]);

  // Stop typing indicator
  const stopTyping = useCallback(() => {
    if (!isConnected || !emit || !conversationId || !isTypingRef.current) return;

    isTypingRef.current = false;
    emit('dm_typing_stop', { conversation_id: conversationId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isConnected, emit, conversationId]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSubscribed,
    typingUsers,
    startTyping,
    stopTyping,
  };
}
