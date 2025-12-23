/**
 * SocketProvider - Provides Socket.IO connection for real-time communications
 * Used by the Coms system for messages, voice, and presence
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SocketContext, type SocketEvents } from './socketContextDef';

// Re-export types for consumers
export type { SocketEvents, SocketContextValue } from './socketContextDef';
export { SocketContext } from './socketContextDef';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const joinedChannelsRef = useRef<Set<string>>(new Set());
  const [joinedChannels, setJoinedChannels] = useState<Set<string>>(new Set());

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Don't reconnect if already connected
    if (socket?.connected) return;

    setIsConnecting(true);
    setError(null);

    const newSocket = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Rejoin any channels we were in
      joinedChannelsRef.current.forEach((channelId) => {
        newSocket.emit('join_channel', { channel_id: channelId });
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err);
      setError(err);
      setIsConnecting(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
    // Only reconnect when user ID or token changes (socket is created here, so can't be a dependency)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, token]);

  // Channel management
  const joinChannel = useCallback(
    (channelId: string) => {
      if (!socket?.connected) return;
      if (joinedChannelsRef.current.has(channelId)) return;

      socket.emit('join_channel', { channel_id: channelId });
      joinedChannelsRef.current.add(channelId);
      setJoinedChannels(new Set(joinedChannelsRef.current));
    },
    [socket]
  );

  const leaveChannel = useCallback(
    (channelId: string) => {
      if (!socket?.connected) return;

      socket.emit('leave_channel', { channel_id: channelId });
      joinedChannelsRef.current.delete(channelId);
      setJoinedChannels(new Set(joinedChannelsRef.current));
    },
    [socket]
  );

  // Messaging
  const sendMessage = useCallback(
    (channelId: string, content: string, messageType = 'text') => {
      if (!socket?.connected) return;

      socket.emit('send_message', {
        channel_id: channelId,
        content,
        message_type: messageType,
      });
    },
    [socket]
  );

  const startTyping = useCallback(
    (channelId: string) => {
      if (!socket?.connected) return;
      socket.emit('typing_start', { channel_id: channelId });
    },
    [socket]
  );

  const stopTyping = useCallback(
    (channelId: string) => {
      if (!socket?.connected) return;
      socket.emit('typing_stop', { channel_id: channelId });
    },
    [socket]
  );

  // Voice
  const joinVoice = useCallback(
    (channelId: string, peerId: string) => {
      if (!socket?.connected) return;
      socket.emit('voice_join', { channel_id: channelId, peer_id: peerId });
    },
    [socket]
  );

  const leaveVoice = useCallback(
    (channelId: string) => {
      if (!socket?.connected) return;
      socket.emit('voice_leave', { channel_id: channelId });
    },
    [socket]
  );

  const sendVoiceOffer = useCallback(
    (toUserId: string, offer: RTCSessionDescriptionInit) => {
      if (!socket?.connected) return;
      socket.emit('voice_offer', { to_user_id: toUserId, offer });
    },
    [socket]
  );

  const sendVoiceAnswer = useCallback(
    (toUserId: string, answer: RTCSessionDescriptionInit) => {
      if (!socket?.connected) return;
      socket.emit('voice_answer', { to_user_id: toUserId, answer });
    },
    [socket]
  );

  const sendIceCandidate = useCallback(
    (toUserId: string, candidate: RTCIceCandidateInit) => {
      if (!socket?.connected) return;
      socket.emit('voice_ice_candidate', { to_user_id: toUserId, candidate });
    },
    [socket]
  );

  const setPTTActive = useCallback(
    (channelId: string, isTransmitting: boolean) => {
      if (!socket?.connected) return;
      socket.emit(isTransmitting ? 'ptt_start' : 'ptt_stop', { channel_id: channelId });
    },
    [socket]
  );

  // Event subscription helpers
  const on = useCallback(
    <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
      if (!socket) return;
      socket.on(event as string, handler as (...args: unknown[]) => void);
    },
    [socket]
  );

  const off = useCallback(
    <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
      if (!socket) return;
      socket.off(event as string, handler as (...args: unknown[]) => void);
    },
    [socket]
  );

  const value = {
    socket,
    isConnected,
    isConnecting,
    error,
    joinChannel,
    leaveChannel,
    joinedChannels,
    sendMessage,
    startTyping,
    stopTyping,
    joinVoice,
    leaveVoice,
    sendVoiceOffer,
    sendVoiceAnswer,
    sendIceCandidate,
    setPTTActive,
    on,
    off,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
