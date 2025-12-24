/**
 * useVoice - WebRTC voice chat hook using simple-peer
 * Manages peer connections, audio streams, and PTT functionality
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

// Use relative path for Vite proxy in dev, or full URL in production
const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

// ICE servers for WebRTC
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface VoicePeer {
  peerId: string;
  odaUserId: string;
  username: string;
  peer: Peer.Instance;
  stream?: MediaStream;
  isTransmitting: boolean;
}

interface UseVoiceOptions {
  channelId: string | null;
  iceServers?: RTCIceServer[];
}

interface UseVoiceReturn {
  // State
  isInVoice: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isPTTActive: boolean;
  error: string | null;
  peers: Map<string, VoicePeer>;

  // Actions
  joinVoice: () => Promise<void>;
  leaveVoice: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  startPTT: () => void;
  stopPTT: () => void;

  // Audio elements for rendering
  audioRefs: React.MutableRefObject<Map<string, HTMLAudioElement>>;
}

export function useVoice({ channelId, iceServers = DEFAULT_ICE_SERVERS }: UseVoiceOptions): UseVoiceReturn {
  const { user } = useAuth();
  const socket = useSocket();

  // State
  const [isInVoice, setIsInVoice] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Start muted for PTT
  const [isDeafened, setIsDeafened] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Map<string, VoicePeer>>(new Map());

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, VoicePeer>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const myPeerIdRef = useRef<string>(crypto.randomUUID());

  // Update peers state when ref changes
  const updatePeersState = useCallback(() => {
    setPeers(new Map(peersRef.current));
  }, []);

  // Create peer connection
  const createPeer = useCallback(
    (targetUserId: string, targetPeerId: string, targetUsername: string, initiator: boolean) => {
      console.log(`[Voice] Creating peer for ${targetUsername} (initiator: ${initiator})`);

      const peer = new Peer({
        initiator,
        trickle: true,
        stream: localStreamRef.current || undefined,
        config: { iceServers },
      });

      peer.on('signal', (signal) => {
        console.log(`[Voice] Sending signal to ${targetUsername}:`, signal.type || 'candidate');
        if (signal.type === 'offer') {
          socket.sendVoiceOffer(targetUserId, signal);
        } else if (signal.type === 'answer') {
          socket.sendVoiceAnswer(targetUserId, signal);
        } else if ('candidate' in signal) {
          // Send the full signal object for ICE candidates
          socket.sendIceCandidate(targetUserId, signal);
        }
      });

      peer.on('stream', (stream) => {
        console.log(`[Voice] Received stream from ${targetUsername}`);
        const voicePeer = peersRef.current.get(targetUserId);
        if (voicePeer) {
          voicePeer.stream = stream;

          // Create or update audio element
          let audio = audioRefs.current.get(targetUserId);
          if (!audio) {
            audio = new Audio();
            audio.autoplay = true;
            audioRefs.current.set(targetUserId, audio);
          }
          audio.srcObject = stream;
          audio.muted = isDeafened;
        }
        updatePeersState();
      });

      peer.on('error', (err) => {
        console.error(`[Voice] Peer error for ${targetUsername}:`, err);
      });

      peer.on('close', () => {
        console.log(`[Voice] Peer closed for ${targetUsername}`);
        peersRef.current.delete(targetUserId);
        audioRefs.current.get(targetUserId)?.pause();
        audioRefs.current.delete(targetUserId);
        updatePeersState();
      });

      const voicePeer: VoicePeer = {
        peerId: targetPeerId,
        odaUserId: targetUserId,
        username: targetUsername,
        peer,
        isTransmitting: false,
      };

      peersRef.current.set(targetUserId, voicePeer);
      updatePeersState();

      return voicePeer;
    },
    [socket, iceServers, isDeafened, updatePeersState]
  );

  // Join voice channel
  const joinVoice = useCallback(async () => {
    console.log('[Voice] joinVoice called', { channelId, isConnected: socket.isConnected });

    if (!channelId || !socket.isConnected) {
      setError('Not connected to server');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      console.log('[Voice] Requesting microphone access...');
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      console.log('[Voice] Microphone access granted');

      // Start muted
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      // Register in database via REST API (for participant tracking)
      const token = api.getToken();
      console.log('[Voice] Registering in database, token:', !!token, 'API_BASE:', API_BASE || '(empty/proxy)');
      if (token) {
        try {
          const url = `${API_BASE}/api/v1/coms/channels/${channelId}/voice/join`;
          console.log('[Voice] POST to:', url);
          const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log('[Voice] Join response:', response.status, response.ok);
          if (!response.ok) {
            const text = await response.text();
            console.error('[Voice] Join failed:', text);
          } else {
            console.log('[Voice] Successfully registered in database');
          }
        } catch (err) {
          console.warn('[Voice] Failed to register in database:', err);
        }
      }

      // Join via socket (for WebRTC signaling)
      socket.joinVoice(channelId, myPeerIdRef.current);
      setIsInVoice(true);
      setIsConnecting(false);
      console.log('[Voice] Joined voice channel successfully');
    } catch (err) {
      console.error('[Voice] Failed to get microphone:', err);
      setError('Failed to access microphone. Please check permissions.');
      setIsConnecting(false);
    }
  }, [channelId, socket]);

  // Leave voice channel
  const leaveVoice = useCallback(() => {
    if (!channelId) return;

    console.log('[Voice] Leaving voice channel');

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all peers
    peersRef.current.forEach((voicePeer) => {
      voicePeer.peer.destroy();
    });
    peersRef.current.clear();
    audioRefs.current.forEach((audio) => audio.pause());
    audioRefs.current.clear();

    // Leave via socket (for WebRTC signaling)
    socket.leaveVoice(channelId);

    // Unregister from database via REST API (for participant tracking)
    const token = api.getToken();
    if (token) {
      fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => console.warn('[Voice] Failed to unregister from database:', err));
    }

    setIsInVoice(false);
    setIsPTTActive(false);
    updatePeersState();
  }, [channelId, socket, updatePeersState]);

  // Mute/unmute
  const setMutedState = useCallback((muted: boolean) => {
    setIsMuted(muted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }, []);

  // Deafen/undeafen
  const setDeafenedState = useCallback((deafened: boolean) => {
    setIsDeafened(deafened);
    audioRefs.current.forEach((audio) => {
      audio.muted = deafened;
    });
  }, []);

  // PTT start
  const startPTT = useCallback(() => {
    if (!channelId || !isInVoice || isDeafened) return;

    setIsPTTActive(true);
    setMutedState(false);
    socket.setPTTActive(channelId, true);
  }, [channelId, isInVoice, isDeafened, setMutedState, socket]);

  // PTT stop
  const stopPTT = useCallback(() => {
    if (!channelId) return;

    setIsPTTActive(false);
    setMutedState(true);
    socket.setPTTActive(channelId, false);
  }, [channelId, setMutedState, socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket.socket || !channelId || !isInVoice) return;

    // Handle new user joining voice
    const handleUserJoined = (data: { channel_id: string; user_id: string; username: string; peer_id: string }) => {
      if (data.channel_id !== channelId) return;
      if (data.user_id === user?.id) return;

      console.log(`[Voice] User joined: ${data.username || data.user_id}`);

      // Create peer as initiator (we were here first)
      createPeer(data.user_id, data.peer_id, data.username || 'Unknown', true);
    };

    // Handle user leaving
    const handleUserLeft = (data: { channel_id: string; user_id: string }) => {
      if (data.channel_id !== channelId) return;

      console.log(`[Voice] User left: ${data.user_id}`);
      const voicePeer = peersRef.current.get(data.user_id);
      if (voicePeer) {
        voicePeer.peer.destroy();
        peersRef.current.delete(data.user_id);
        audioRefs.current.get(data.user_id)?.pause();
        audioRefs.current.delete(data.user_id);
        updatePeersState();
      }
    };

    // Handle incoming offer
    const handleOffer = (data: { from_user_id: string; offer: RTCSessionDescriptionInit }) => {
      console.log(`[Voice] Received offer from ${data.from_user_id}`);

      let voicePeer = peersRef.current.get(data.from_user_id);
      if (!voicePeer) {
        // Create peer as non-initiator
        voicePeer = createPeer(data.from_user_id, '', 'Unknown', false);
      }
      voicePeer.peer.signal(data.offer);
    };

    // Handle incoming answer
    const handleAnswer = (data: { from_user_id: string; answer: RTCSessionDescriptionInit }) => {
      console.log(`[Voice] Received answer from ${data.from_user_id}`);

      const voicePeer = peersRef.current.get(data.from_user_id);
      if (voicePeer && !voicePeer.peer.destroyed) {
        try {
          voicePeer.peer.signal(data.answer);
        } catch (err) {
          console.warn('[Voice] Error signaling answer:', err);
        }
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = (data: { from_user_id: string; candidate: RTCIceCandidateInit }) => {
      const voicePeer = peersRef.current.get(data.from_user_id);
      if (voicePeer && !voicePeer.peer.destroyed) {
        try {
          // Pass the candidate directly - simple-peer expects the full signal object
          voicePeer.peer.signal(data.candidate);
        } catch (err) {
          console.warn('[Voice] Error signaling ICE candidate:', err);
        }
      }
    };

    // Handle PTT state
    const handlePTT = (data: { channel_id: string; user_id: string; is_transmitting: boolean }) => {
      if (data.channel_id !== channelId) return;

      const voicePeer = peersRef.current.get(data.user_id);
      if (voicePeer) {
        voicePeer.isTransmitting = data.is_transmitting;
        updatePeersState();
      }
    };

    socket.on('voice_user_joined', handleUserJoined);
    socket.on('voice_user_left', handleUserLeft);
    socket.on('voice_offer', handleOffer);
    socket.on('voice_answer', handleAnswer);
    socket.on('voice_ice_candidate', handleIceCandidate);
    socket.on('ptt_active', handlePTT);

    return () => {
      socket.off('voice_user_joined', handleUserJoined);
      socket.off('voice_user_left', handleUserLeft);
      socket.off('voice_offer', handleOffer);
      socket.off('voice_answer', handleAnswer);
      socket.off('voice_ice_candidate', handleIceCandidate);
      socket.off('ptt_active', handlePTT);
    };
  }, [socket, channelId, user?.id, createPeer, updatePeersState, isInVoice]);

  // Cleanup on unmount or channel change
  useEffect(() => {
    return () => {
      if (isInVoice) {
        leaveVoice();
      }
    };
    // Cleanup should use current values, not captured values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return {
    isInVoice,
    isConnecting,
    isMuted,
    isDeafened,
    isPTTActive,
    error,
    peers,
    joinVoice,
    leaveVoice,
    setMuted: setMutedState,
    setDeafened: setDeafenedState,
    startPTT,
    stopPTT,
    audioRefs,
  };
}

export default useVoice;
