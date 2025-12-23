/**
 * Socket context definition - separated for Fast Refresh compatibility
 */
import { createContext } from 'react';
import type { Socket } from 'socket.io-client';

// Socket events types
export interface SocketEvents {
  // Connection
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;

  // Messages
  new_message: (data: {
    channel_id: string;
    message: {
      id: string;
      channel_id: string;
      sender_id: string;
      content: string;
      message_type: string;
      created_at: string;
      sender?: {
        id: string;
        username: string | null;
        full_name: string | null;
        avatar_url: string | null;
        production_role: string | null;
      };
    };
  }) => void;
  message_edited: (data: { channel_id: string; message_id: string; content: string; edited_at: string }) => void;
  message_deleted: (data: { channel_id: string; message_id: string }) => void;

  // Typing
  user_typing: (data: { channel_id: string; user_id: string; username: string }) => void;
  user_stopped_typing: (data: { channel_id: string; user_id: string }) => void;

  // Voice
  voice_user_joined: (data: { channel_id: string; user_id: string; username: string; peer_id: string }) => void;
  voice_user_left: (data: { channel_id: string; user_id: string }) => void;
  voice_offer: (data: { from_user_id: string; offer: RTCSessionDescriptionInit }) => void;
  voice_answer: (data: { from_user_id: string; answer: RTCSessionDescriptionInit }) => void;
  voice_ice_candidate: (data: { from_user_id: string; candidate: RTCIceCandidateInit }) => void;
  ptt_active: (data: { channel_id: string; user_id: string; username: string; is_transmitting: boolean }) => void;

  // Presence
  user_presence_changed: (data: {
    user_id: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    current_channel_id?: string;
  }) => void;

  // Channel updates
  channel_updated: (data: { channel_id: string }) => void;
  channel_deleted: (data: { channel_id: string }) => void;
  member_added: (data: { channel_id: string; user_id: string }) => void;
  member_removed: (data: { channel_id: string; user_id: string }) => void;
}

export interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;

  // Channel management
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  joinedChannels: Set<string>;

  // Messaging
  sendMessage: (channelId: string, content: string, messageType?: string) => void;
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;

  // Voice
  joinVoice: (channelId: string, peerId: string) => void;
  leaveVoice: (channelId: string) => void;
  sendVoiceOffer: (toUserId: string, offer: RTCSessionDescriptionInit) => void;
  sendVoiceAnswer: (toUserId: string, answer: RTCSessionDescriptionInit) => void;
  sendIceCandidate: (toUserId: string, candidate: RTCIceCandidateInit) => void;
  setPTTActive: (channelId: string, isTransmitting: boolean) => void;

  // Event subscription
  on: <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => void;
  off: <K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]) => void;
}

export const SocketContext = createContext<SocketContextValue | null>(null);
