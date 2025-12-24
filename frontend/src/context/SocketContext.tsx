/**
 * SocketProvider - Real-time communications
 * Uses Socket.IO for local development, AWS API Gateway WebSocket for production
 * Handles: messages, voice, presence for the Coms system
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SocketContext, type SocketEvents } from './socketContextDef';

// Re-export types for consumers
export type { SocketEvents, SocketContextValue } from './socketContextDef';
export { SocketContext } from './socketContextDef';

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || '';
const IS_DEV = import.meta.env.DEV;
const LOCAL_SOCKET_URL = 'http://localhost:8000';

// Debug: Log the connection mode
console.log('[Socket] Mode:', IS_DEV ? 'Development (Socket.IO)' : 'Production (AWS WebSocket)');

// Reconnection configuration
const RECONNECT_INITIAL_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_MAX_ATTEMPTS = 10;

// ============================================================================
// SOCKET.IO PROVIDER (Development)
// ============================================================================
const SocketIOProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const token = session?.access_token;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const joinedChannelsRef = useRef<Set<string>>(new Set());
  const [joinedChannels, setJoinedChannels] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  // Event handlers map
  const eventHandlersRef = useRef<Map<string, Set<(...args: unknown[]) => void>>>(new Map());

  // Dispatch event to handlers
  const dispatchEvent = useCallback((event: string, data: unknown) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[Socket.IO] Error in handler for ${event}:`, err);
        }
      });
    }
  }, []);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      return;
    }

    setIsConnecting(true);
    console.log('[Socket.IO] Connecting to:', LOCAL_SOCKET_URL);

    const sio = io(LOCAL_SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: RECONNECT_MAX_ATTEMPTS,
      reconnectionDelay: RECONNECT_INITIAL_DELAY,
      reconnectionDelayMax: RECONNECT_MAX_DELAY,
    });

    socketRef.current = sio;

    sio.on('connect', () => {
      console.log('[Socket.IO] Connected');
      setSocket(sio);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);

      // Rejoin channels
      joinedChannelsRef.current.forEach((channelId) => {
        sio.emit('join_channel', { channel_id: channelId });
      });
    });

    sio.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
      setIsConnected(false);
    });

    sio.on('connect_error', (err) => {
      console.error('[Socket.IO] Connection error:', err);
      setError(new Error(err.message));
      setIsConnecting(false);
    });

    // Forward all events to handlers
    const events = [
      'new_message', 'message_edited', 'message_deleted',
      'user_typing', 'user_stopped_typing',
      'voice_user_joined', 'voice_user_left',
      'voice_offer', 'voice_answer', 'voice_ice_candidate',
      'ptt_active', 'user_presence_changed'
    ];
    events.forEach((event) => {
      sio.on(event, (data) => {
        console.log('[Socket.IO] Received:', event);
        dispatchEvent(event, data);
      });
    });

    return () => {
      sio.disconnect();
    };
  }, [user?.id, token, dispatchEvent]);

  // Channel management
  const joinChannel = useCallback((channelId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('join_channel', { channel_id: channelId });
    joinedChannelsRef.current.add(channelId);
    setJoinedChannels(new Set(joinedChannelsRef.current));
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('leave_channel', { channel_id: channelId });
    joinedChannelsRef.current.delete(channelId);
    setJoinedChannels(new Set(joinedChannelsRef.current));
  }, []);

  // Messaging
  const sendMessage = useCallback((channelId: string, content: string, messageType = 'text') => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('send_message', { channel_id: channelId, content, message_type: messageType });
  }, []);

  const startTyping = useCallback((channelId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('typing_start', { channel_id: channelId });
  }, []);

  const stopTyping = useCallback((channelId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('typing_stop', { channel_id: channelId });
  }, []);

  // Voice
  const joinVoice = useCallback((channelId: string, peerId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('voice_join', { channel_id: channelId, peer_id: peerId });
  }, []);

  const leaveVoice = useCallback((channelId: string) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('voice_leave', { channel_id: channelId });
  }, []);

  const sendVoiceOffer = useCallback((toUserId: string, offer: RTCSessionDescriptionInit) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('voice_offer', { to_user_id: toUserId, offer });
  }, []);

  const sendVoiceAnswer = useCallback((toUserId: string, answer: RTCSessionDescriptionInit) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('voice_answer', { to_user_id: toUserId, answer });
  }, []);

  const sendIceCandidate = useCallback((toUserId: string, candidate: RTCIceCandidateInit) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('voice_ice_candidate', { to_user_id: toUserId, candidate });
  }, []);

  const setPTTActive = useCallback((channelId: string, isTransmitting: boolean) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(isTransmitting ? 'ptt_start' : 'ptt_stop', { channel_id: channelId });
  }, []);

  // Event subscription
  const on = useCallback(<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
    if (!eventHandlersRef.current.has(event)) {
      eventHandlersRef.current.set(event, new Set());
    }
    eventHandlersRef.current.get(event)!.add(handler as (...args: unknown[]) => void);
  }, []);

  const off = useCallback(<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.delete(handler as (...args: unknown[]) => void);
    }
  }, []);

  // Add emit method for direct socket access
  const emit = useCallback((event: string, data: Record<string, unknown>) => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit(event, data);
  }, []);

  const value = {
    socket: socketRef.current as unknown as WebSocket,
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
    emit,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// ============================================================================
// AWS WEBSOCKET PROVIDER (Production)
// ============================================================================
const AWSWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const token = session?.access_token;
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const joinedChannelsRef = useRef<Set<string>>(new Set());
  const [joinedChannels, setJoinedChannels] = useState<Set<string>>(new Set());

  // Event handlers map
  const eventHandlersRef = useRef<Map<string, Set<(...args: unknown[]) => void>>>(new Map());

  // Reconnection state
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const shouldReconnectRef = useRef(true);

  // Send message helper
  const send = useCallback((action: string, data: Record<string, unknown>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...data }));
    }
  }, []);

  // Dispatch event to handlers
  const dispatchEvent = useCallback((event: string, data: unknown) => {
    const handlers = eventHandlersRef.current.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[WebSocket] Error in handler for ${event}:`, err);
        }
      });
    }
  }, []);

  // Connect function
  const connect = useCallback(() => {
    if (!user || !token || !WEBSOCKET_URL) {
      console.log('[WebSocket] Cannot connect: missing user, token, or URL');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    if (socketRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Connection already in progress');
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Build WebSocket URL with token
    const wsUrl = `${WEBSOCKET_URL}?token=${encodeURIComponent(token)}`;
    console.log('[WebSocket] Connecting to:', WEBSOCKET_URL);

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setSocket(ws);
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Rejoin any channels we were in
        joinedChannelsRef.current.forEach((channelId) => {
          send('join_channel', { channel_id: channelId });
        });
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setSocket(null);
        setIsConnected(false);
        setIsConnecting(false);
        socketRef.current = null;

        // Attempt reconnection if appropriate
        if (shouldReconnectRef.current && event.code !== 1000) {
          const attempts = reconnectAttemptsRef.current;
          if (attempts < RECONNECT_MAX_ATTEMPTS) {
            const delay = Math.min(
              RECONNECT_INITIAL_DELAY * Math.pow(2, attempts),
              RECONNECT_MAX_DELAY
            );
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${attempts + 1})`);
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              connect();
            }, delay);
          } else {
            console.error('[WebSocket] Max reconnection attempts reached');
            setError(new Error('Failed to connect after multiple attempts'));
          }
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        setError(new Error('WebSocket connection error'));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventType = data.event;

          if (eventType) {
            console.log('[WebSocket] Received event:', eventType);
            dispatchEvent(eventType, data);
          } else {
            console.log('[WebSocket] Received message without event type:', data);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };
    } catch (err) {
      console.error('[WebSocket] Failed to create connection:', err);
      setError(err instanceof Error ? err : new Error('Failed to connect'));
      setIsConnecting(false);
    }
  }, [user, token, send, dispatchEvent]);

  // Connect/disconnect based on auth state
  useEffect(() => {
    console.log('[WebSocket] Auth state changed:', {
      hasUser: !!user,
      hasToken: !!token,
      hasUrl: !!WEBSOCKET_URL
    });

    if (!user || !token) {
      // Cleanup on logout
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close(1000, 'User logged out');
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      return;
    }

    // Connect when user is authenticated
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [user?.id, token, connect]);

  // Channel management
  const joinChannel = useCallback(
    (channelId: string) => {
      if (!isConnected) return;
      if (joinedChannelsRef.current.has(channelId)) return;

      send('join_channel', { channel_id: channelId });
      joinedChannelsRef.current.add(channelId);
      setJoinedChannels(new Set(joinedChannelsRef.current));
    },
    [isConnected, send]
  );

  const leaveChannel = useCallback(
    (channelId: string) => {
      if (!isConnected) return;

      send('leave_channel', { channel_id: channelId });
      joinedChannelsRef.current.delete(channelId);
      setJoinedChannels(new Set(joinedChannelsRef.current));
    },
    [isConnected, send]
  );

  // Messaging
  const sendMessage = useCallback(
    (channelId: string, content: string, messageType = 'text') => {
      if (!isConnected) return;

      send('send_message', {
        channel_id: channelId,
        content,
        message_type: messageType,
      });
    },
    [isConnected, send]
  );

  const startTyping = useCallback(
    (channelId: string) => {
      if (!isConnected) return;
      send('typing_start', { channel_id: channelId });
    },
    [isConnected, send]
  );

  const stopTyping = useCallback(
    (channelId: string) => {
      if (!isConnected) return;
      send('typing_stop', { channel_id: channelId });
    },
    [isConnected, send]
  );

  // Voice
  const joinVoice = useCallback(
    (channelId: string, peerId: string) => {
      if (!isConnected) return;
      send('voice_join', { channel_id: channelId, peer_id: peerId });
    },
    [isConnected, send]
  );

  const leaveVoice = useCallback(
    (channelId: string) => {
      if (!isConnected) return;
      send('voice_leave', { channel_id: channelId });
    },
    [isConnected, send]
  );

  const sendVoiceOffer = useCallback(
    (toUserId: string, offer: RTCSessionDescriptionInit) => {
      if (!isConnected) return;
      send('voice_offer', { to_user_id: toUserId, offer });
    },
    [isConnected, send]
  );

  const sendVoiceAnswer = useCallback(
    (toUserId: string, answer: RTCSessionDescriptionInit) => {
      if (!isConnected) return;
      send('voice_answer', { to_user_id: toUserId, answer });
    },
    [isConnected, send]
  );

  const sendIceCandidate = useCallback(
    (toUserId: string, candidate: RTCIceCandidateInit) => {
      if (!isConnected) return;
      send('voice_ice_candidate', { to_user_id: toUserId, candidate });
    },
    [isConnected, send]
  );

  const setPTTActive = useCallback(
    (channelId: string, isTransmitting: boolean) => {
      if (!isConnected) return;
      send(isTransmitting ? 'ptt_start' : 'ptt_stop', { channel_id: channelId });
    },
    [isConnected, send]
  );

  // Event subscription helpers
  const on = useCallback(
    <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
      if (!eventHandlersRef.current.has(event)) {
        eventHandlersRef.current.set(event, new Set());
      }
      eventHandlersRef.current.get(event)!.add(handler as (...args: unknown[]) => void);
    },
    []
  );

  const off = useCallback(
    <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => {
      const handlers = eventHandlersRef.current.get(event);
      if (handlers) {
        handlers.delete(handler as (...args: unknown[]) => void);
      }
    },
    []
  );

  // Add emit method for direct socket access
  const emit = useCallback((event: string, data: Record<string, unknown>) => {
    send(event, data);
  }, [send]);

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
    emit,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// ============================================================================
// MAIN PROVIDER - Uses Socket.IO in dev, AWS WebSocket in prod
// ============================================================================
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (IS_DEV) {
    return <SocketIOProvider>{children}</SocketIOProvider>;
  }
  return <AWSWebSocketProvider>{children}</AWSWebSocketProvider>;
};
