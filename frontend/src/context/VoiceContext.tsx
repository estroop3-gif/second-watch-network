/**
 * VoiceContext - Persistent voice channel state across tab navigation
 * Voice connection persists when switching tabs within a project
 * Only disconnects when: explicitly leaving, closing browser, or leaving project
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'simple-peer';
import { useSocket } from '@/hooks/useSocket';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface VoicePeer {
  peerId: string;
  odaUserId: string;
  username: string;
  peer: Peer.Instance;
  stream?: MediaStream;
  isTransmitting: boolean;
}

interface VoiceContextValue {
  // Current state
  activeChannelId: string | null;
  isInVoice: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isPTTActive: boolean;
  isVoiceActive: boolean; // Voice activity detection - true when user is speaking
  usePTTMode: boolean; // PTT mode vs open mic mode
  error: string | null;
  peers: Map<string, VoicePeer>;
  // Live transmitting states from socket events (user_id -> is_transmitting)
  transmittingUsers: Map<string, boolean>;

  // Actions
  joinVoice: (channelId: string) => Promise<void>;
  leaveVoice: () => void;
  setMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  startPTT: () => void;
  stopPTT: () => void;
  setUsePTTMode: (usePTT: boolean) => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoiceContext() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoiceContext must be used within a VoiceProvider');
  }
  return context;
}

// Optional hook that returns null if not in provider
export function useVoiceContextOptional() {
  return useContext(VoiceContext);
}

interface VoiceProviderProps {
  projectId: string;
  children: React.ReactNode;
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ projectId, children }) => {
  const { user } = useAuth();
  const socket = useSocket();

  // State
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isInVoice, setIsInVoice] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false); // VAD - speaking detection
  const [usePTTMode, setUsePTTMode] = useState(true); // Default to PTT mode
  const [error, setError] = useState<string | null>(null);
  const [peers, setPeers] = useState<Map<string, VoicePeer>>(new Map());
  // Track live transmitting states from socket events
  const [transmittingUsers, setTransmittingUsers] = useState<Map<string, boolean>>(new Map());

  // Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, VoicePeer>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const myPeerIdRef = useRef<string>(crypto.randomUUID());
  const activeChannelIdRef = useRef<string | null>(null);

  // Voice Activity Detection refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const lastVoiceActiveRef = useRef<boolean>(false);
  const voiceActiveTimeoutRef = useRef<number | null>(null);

  // Voice Activity Detection refs
  const openMicInactivityRef = useRef<number | null>(null);

  // VAD configuration
  const VAD_THRESHOLD = 15; // Audio level threshold (0-255)
  const VAD_DEBOUNCE_MS = 200; // Keep "speaking" for 200ms after audio drops
  const OPEN_MIC_INACTIVITY_MS = 3 * 60 * 1000; // 3 minutes - auto-switch to PTT if no voice detected

  // Keep ref in sync with state
  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  const updatePeersState = useCallback(() => {
    setPeers(new Map(peersRef.current));
  }, []);

  // Setup Voice Activity Detection
  const setupVAD = useCallback((stream: MediaStream) => {
    try {
      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      analyserRef.current = analyser;

      // Connect stream to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Data array for frequency analysis
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Start monitoring audio levels
      const checkAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        const isCurrentlySpeaking = average > VAD_THRESHOLD;

        if (isCurrentlySpeaking) {
          // User is speaking
          if (voiceActiveTimeoutRef.current) {
            clearTimeout(voiceActiveTimeoutRef.current);
            voiceActiveTimeoutRef.current = null;
          }

          // Reset open mic inactivity timer when speaking
          if (openMicInactivityRef.current) {
            clearTimeout(openMicInactivityRef.current);
            openMicInactivityRef.current = null;
          }

          if (!lastVoiceActiveRef.current) {
            lastVoiceActiveRef.current = true;
            setIsVoiceActive(true);

            // Broadcast voice activity if in open mic mode and not muted
            const channelId = activeChannelIdRef.current;
            if (channelId && !usePTTMode && !isMuted) {
              socket.setPTTActive(channelId, true);
              // Also update database
              const token = api.getToken();
              if (token) {
                fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/ptt`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ is_transmitting: true })
                }).catch(() => {});
              }
            }
          }
        } else if (lastVoiceActiveRef.current && !voiceActiveTimeoutRef.current) {
          // Start debounce timer - keep "speaking" for a bit after audio drops
          voiceActiveTimeoutRef.current = window.setTimeout(() => {
            lastVoiceActiveRef.current = false;
            setIsVoiceActive(false);
            voiceActiveTimeoutRef.current = null;

            // Broadcast voice activity stopped
            const channelId = activeChannelIdRef.current;
            if (channelId && !usePTTMode) {
              socket.setPTTActive(channelId, false);
              // Also update database
              const token = api.getToken();
              if (token) {
                fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/ptt`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ is_transmitting: false })
                }).catch(() => {});
              }

              // Start 3-minute inactivity timer in open mic mode
              if (!openMicInactivityRef.current) {
                openMicInactivityRef.current = window.setTimeout(() => {
                  console.log('[VoiceContext] Open mic inactivity timeout - switching to PTT mode');
                  // Switch to PTT mode after 3 minutes of no voice activity
                  setUsePTTMode(true);
                  // Mute the mic
                  if (localStreamRef.current) {
                    localStreamRef.current.getAudioTracks().forEach((track) => {
                      track.enabled = false;
                    });
                  }
                  setIsMuted(true);
                  openMicInactivityRef.current = null;
                }, OPEN_MIC_INACTIVITY_MS);
              }
            }
          }, VAD_DEBOUNCE_MS);
        }
      };

      // Check audio levels every 50ms
      vadIntervalRef.current = window.setInterval(checkAudioLevel, 50);

      console.log('[VoiceContext] VAD setup complete');
    } catch (err) {
      console.error('[VoiceContext] Failed to setup VAD:', err);
    }
  }, [socket, usePTTMode, isMuted]);

  // Cleanup VAD
  const cleanupVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (voiceActiveTimeoutRef.current) {
      clearTimeout(voiceActiveTimeoutRef.current);
      voiceActiveTimeoutRef.current = null;
    }
    if (openMicInactivityRef.current) {
      clearTimeout(openMicInactivityRef.current);
      openMicInactivityRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    lastVoiceActiveRef.current = false;
    setIsVoiceActive(false);
  }, []);

  // Create peer connection
  const createPeer = useCallback(
    (targetUserId: string, targetPeerId: string, targetUsername: string, initiator: boolean) => {
      console.log(`[VoiceContext] Creating peer for ${targetUsername} (initiator: ${initiator})`);

      const peer = new Peer({
        initiator,
        trickle: true,
        stream: localStreamRef.current || undefined,
        config: { iceServers: DEFAULT_ICE_SERVERS },
      });

      peer.on('signal', (signal) => {
        if (signal.type === 'offer') {
          socket.sendVoiceOffer(targetUserId, signal);
        } else if (signal.type === 'answer') {
          socket.sendVoiceAnswer(targetUserId, signal);
        } else if ('candidate' in signal) {
          socket.sendIceCandidate(targetUserId, signal);
        }
      });

      peer.on('stream', (stream) => {
        console.log(`[VoiceContext] Received stream from ${targetUsername}`);
        const voicePeer = peersRef.current.get(targetUserId);
        if (voicePeer) {
          voicePeer.stream = stream;
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
        console.error(`[VoiceContext] Peer error for ${targetUsername}:`, err);
      });

      peer.on('close', () => {
        console.log(`[VoiceContext] Peer closed for ${targetUsername}`);
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
    [socket, isDeafened, updatePeersState]
  );

  // Join voice channel
  const joinVoice = useCallback(async (channelId: string) => {
    console.log('[VoiceContext] joinVoice called', { channelId, isConnected: socket.isConnected });

    if (!socket.isConnected) {
      setError('Not connected to server');
      return;
    }

    // If already in a voice channel, leave it first
    if (isInVoice && activeChannelIdRef.current) {
      await leaveVoiceInternal();
    }

    setIsConnecting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });

      localStreamRef.current = stream;
      // In PTT mode, start muted. In open mic mode, start with audio enabled
      stream.getAudioTracks().forEach((track) => { track.enabled = !usePTTMode; });
      setIsMuted(usePTTMode); // Muted in PTT mode, unmuted in open mic mode

      // Setup voice activity detection
      setupVAD(stream);

      // Register in database
      const token = api.getToken();
      if (token) {
        try {
          const response = await fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/join`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            console.error('[VoiceContext] Join failed:', await response.text());
          }
        } catch (err) {
          console.warn('[VoiceContext] Failed to register in database:', err);
        }
      }

      socket.joinVoice(channelId, myPeerIdRef.current);
      setActiveChannelId(channelId);
      setIsInVoice(true);
      setIsConnecting(false);
      console.log('[VoiceContext] Joined voice channel successfully');
    } catch (err) {
      console.error('[VoiceContext] Failed to get microphone:', err);
      setError('Failed to access microphone. Please check permissions.');
      setIsConnecting(false);
    }
  }, [socket, isInVoice]);

  // Internal leave function (doesn't reset connecting state)
  const leaveVoiceInternal = useCallback(async () => {
    const channelId = activeChannelIdRef.current;
    if (!channelId) return;

    console.log('[VoiceContext] Leaving voice channel');

    // Cleanup VAD
    cleanupVAD();

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

    // Unregister from database
    const token = api.getToken();
    if (token) {
      fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch((err) => console.warn('[VoiceContext] Failed to unregister from database:', err));
    }

    setActiveChannelId(null);
    setIsInVoice(false);
    setIsPTTActive(false);
    updatePeersState();
  }, [socket, updatePeersState]);

  // Public leave function
  const leaveVoice = useCallback(() => {
    leaveVoiceInternal();
  }, [leaveVoiceInternal]);

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
    if (!activeChannelIdRef.current || !isInVoice || isDeafened) return;
    const channelId = activeChannelIdRef.current;
    setIsPTTActive(true);
    setMutedState(false);
    socket.setPTTActive(channelId, true);

    // Update database so participant list shows transmitting state
    const token = api.getToken();
    if (token) {
      fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/ptt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_transmitting: true })
      }).catch(err => console.warn('[VoiceContext] Failed to update PTT state:', err));
    }
  }, [isInVoice, isDeafened, setMutedState, socket]);

  // PTT stop
  const stopPTT = useCallback(() => {
    if (!activeChannelIdRef.current) return;
    const channelId = activeChannelIdRef.current;
    setIsPTTActive(false);
    setMutedState(true);
    socket.setPTTActive(channelId, false);

    // Update database so participant list shows transmitting state
    const token = api.getToken();
    if (token) {
      fetch(`${API_BASE}/api/v1/coms/channels/${channelId}/voice/ptt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_transmitting: false })
      }).catch(err => console.warn('[VoiceContext] Failed to update PTT state:', err));
    }
  }, [setMutedState, socket]);

  // Toggle between PTT mode and open mic mode
  const setUsePTTModeCallback = useCallback((usePTT: boolean) => {
    setUsePTTMode(usePTT);

    // Update mic state based on mode
    if (localStreamRef.current) {
      if (usePTT) {
        // Switching to PTT mode - mute unless PTT is active
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = isPTTActive;
        });
        setIsMuted(!isPTTActive);
      } else {
        // Switching to open mic mode - unmute
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        setIsMuted(false);
      }
    }
  }, [isPTTActive]);

  // Socket event handlers
  useEffect(() => {
    if (!socket.socket || !isInVoice) return;

    const handleUserJoined = (data: { channel_id: string; user_id: string; username: string; peer_id: string }) => {
      if (data.channel_id !== activeChannelIdRef.current) return;
      if (data.user_id === user?.id) return;
      console.log(`[VoiceContext] User joined: ${data.username || data.user_id}`);
      createPeer(data.user_id, data.peer_id, data.username || 'Unknown', true);
    };

    const handleUserLeft = (data: { channel_id: string; user_id: string }) => {
      if (data.channel_id !== activeChannelIdRef.current) return;
      console.log(`[VoiceContext] User left: ${data.user_id}`);
      const voicePeer = peersRef.current.get(data.user_id);
      if (voicePeer) {
        voicePeer.peer.destroy();
        peersRef.current.delete(data.user_id);
        audioRefs.current.get(data.user_id)?.pause();
        audioRefs.current.delete(data.user_id);
        updatePeersState();
      }
    };

    const handleOffer = (data: { from_user_id: string; offer: RTCSessionDescriptionInit }) => {
      console.log(`[VoiceContext] Received offer from ${data.from_user_id}`);
      let voicePeer = peersRef.current.get(data.from_user_id);
      if (!voicePeer) {
        voicePeer = createPeer(data.from_user_id, '', 'Unknown', false);
      }
      voicePeer.peer.signal(data.offer);
    };

    const handleAnswer = (data: { from_user_id: string; answer: RTCSessionDescriptionInit }) => {
      const voicePeer = peersRef.current.get(data.from_user_id);
      if (voicePeer && !voicePeer.peer.destroyed) {
        try {
          voicePeer.peer.signal(data.answer);
        } catch (err) {
          console.warn('[VoiceContext] Error signaling answer:', err);
        }
      }
    };

    const handleIceCandidate = (data: { from_user_id: string; candidate: RTCIceCandidateInit }) => {
      const voicePeer = peersRef.current.get(data.from_user_id);
      if (voicePeer && !voicePeer.peer.destroyed) {
        try {
          voicePeer.peer.signal(data.candidate);
        } catch (err) {
          console.warn('[VoiceContext] Error signaling ICE candidate:', err);
        }
      }
    };

    const handlePTT = (data: { channel_id: string; user_id: string; is_transmitting: boolean }) => {
      if (data.channel_id !== activeChannelIdRef.current) return;

      // Update transmittingUsers map for instant UI feedback
      setTransmittingUsers(prev => {
        const next = new Map(prev);
        if (data.is_transmitting) {
          next.set(data.user_id, true);
        } else {
          next.delete(data.user_id);
        }
        return next;
      });

      // Also update peer state for audio handling
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
  }, [socket, user?.id, createPeer, updatePeersState, isInVoice]);

  // Cleanup on page unload or navigation away from project
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInVoice && activeChannelIdRef.current) {
        // Synchronous cleanup - send leave request
        const token = api.getToken();
        if (token && activeChannelIdRef.current) {
          navigator.sendBeacon(
            `${API_BASE}/api/v1/coms/channels/${activeChannelIdRef.current}/voice/leave`,
            JSON.stringify({})
          );
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInVoice]);

  // Cleanup when projectId changes (leaving the project)
  useEffect(() => {
    return () => {
      if (isInVoice) {
        leaveVoiceInternal();
      }
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: VoiceContextValue = {
    activeChannelId,
    isInVoice,
    isConnecting,
    isMuted,
    isDeafened,
    isPTTActive,
    isVoiceActive,
    usePTTMode,
    error,
    peers,
    transmittingUsers,
    joinVoice,
    leaveVoice,
    setMuted: setMutedState,
    setDeafened: setDeafenedState,
    startPTT,
    stopPTT,
    setUsePTTMode: setUsePTTModeCallback,
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};
