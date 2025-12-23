/**
 * useVoice - WebRTC voice chat hook using simple-peer
 * Manages peer connections, audio streams, and PTT functionality
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/context/AuthContext';

// ICE servers for WebRTC
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

interface VoicePeer {
  peerId: string;
  userId: string;
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
        console.log(`[Voice] Sending signal to ${targetUsername}:`, signal.type);
        if (signal.type === 'offer') {
          socket.sendVoiceOffer(targetUserId, signal);
        } else if (signal.type === 'answer') {
          socket.sendVoiceAnswer(targetUserId, signal);
        } else if (signal.candidate) {
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
        userId: targetUserId,
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
    if (!channelId || !socket.isConnected) {
      setError('Not connected to server');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
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

      // Start muted
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });

      // Join via socket
      socket.joinVoice(channelId, myPeerIdRef.current);
      setIsInVoice(true);
      setIsConnecting(false);
    } catch (err) {
      console.error('[Voice] Failed to get microphone:', err);
      setError('Failed to access microphone. Please check permissions.');
      setIsConnecting(false);
    }
  }, [channelId, socket]);

  // Leave voice channel
  const leaveVoice = useCallback(() => {
    if (!channelId) return;

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

    // Leave via socket
    socket.leaveVoice(channelId);

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
    if (!socket.socket || !channelId) return;

    // Handle new user joining voice
    const handleUserJoined = (data: { channel_id: string; user_id: string; username: string; peer_id: string }) => {
      if (data.channel_id !== channelId) return;
      if (data.user_id === user?.id) return;

      console.log(`[Voice] User joined: ${data.username}`);

      // Create peer as initiator (we were here first)
      createPeer(data.user_id, data.peer_id, data.username, true);
    };

    // Handle user leaving
    const handleUserLeft = (data: { channel_id: string; user_id: string }) => {
      if (data.channel_id !== channelId) return;

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
      if (voicePeer) {
        voicePeer.peer.signal(data.answer);
      }
    };

    // Handle ICE candidate
    const handleIceCandidate = (data: { from_user_id: string; candidate: RTCIceCandidateInit }) => {
      const voicePeer = peersRef.current.get(data.from_user_id);
      if (voicePeer) {
        voicePeer.peer.signal({ candidate: data.candidate } as Peer.SignalData);
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
  }, [socket, channelId, user?.id, createPeer, updatePeersState]);

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
