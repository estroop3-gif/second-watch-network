/**
 * useEmbeddedPlayer - Unified hook for YouTube and Vimeo embedded player APIs
 * Provides the same interface as useReviewPlayer for embedded videos.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import VimeoPlayer from '@vimeo/player';

// =====================================================
// YouTube IFrame API Loader
// =====================================================

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }

    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };

    // Only inject script if not already present
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

// =====================================================
// Hook Interface
// =====================================================

interface UseEmbeddedPlayerOptions {
  provider: 'youtube' | 'vimeo';
  videoId: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onTimeUpdate?: (time: number) => void;
}

export interface EmbeddedPlayerState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
}

// =====================================================
// Hook Implementation
// =====================================================

export function useEmbeddedPlayer(options: UseEmbeddedPlayerOptions): EmbeddedPlayerState {
  const { provider, videoId, iframeRef, onTimeUpdate } = options;

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const ytPlayerRef = useRef<any>(null);
  const vimeoPlayerRef = useRef<VimeoPlayer | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;

  // --- YouTube ---
  useEffect(() => {
    if (provider !== 'youtube') return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let destroyed = false;

    loadYouTubeApi().then(() => {
      if (destroyed || !iframeRef.current) return;

      const YT = (window as any).YT;
      const player = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            if (destroyed) return;
            ytPlayerRef.current = player;
            try {
              setDuration(player.getDuration() || 0);
            } catch { /* ignore */ }
          },
          onStateChange: (event: any) => {
            if (destroyed) return;
            const state = event.data;
            const playing = state === YT.PlayerState.PLAYING;
            setIsPlaying(playing);

            // Start/stop polling
            if (playing) {
              startYtPoll();
            } else {
              stopYtPoll();
              // Capture final time on pause/end
              try {
                const t = player.getCurrentTime() || 0;
                setCurrentTime(t);
                onTimeUpdateRef.current?.(t);
              } catch { /* ignore */ }
            }

            // Update duration when video starts
            if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.PAUSED) {
              try {
                setDuration(player.getDuration() || 0);
              } catch { /* ignore */ }
            }
          },
        },
      });
    });

    function startYtPoll() {
      stopYtPoll();
      pollIntervalRef.current = setInterval(() => {
        if (!ytPlayerRef.current) return;
        try {
          const t = ytPlayerRef.current.getCurrentTime() || 0;
          setCurrentTime(t);
          onTimeUpdateRef.current?.(t);
        } catch { /* player may be destroyed */ }
      }, 250);
    }

    function stopYtPoll() {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    return () => {
      destroyed = true;
      stopYtPoll();
      try {
        ytPlayerRef.current?.destroy();
      } catch { /* ignore */ }
      ytPlayerRef.current = null;
    };
  }, [provider, videoId, iframeRef]);

  // --- Vimeo ---
  useEffect(() => {
    if (provider !== 'vimeo') return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let destroyed = false;
    const player = new VimeoPlayer(iframe);
    vimeoPlayerRef.current = player;

    player.getDuration().then((d) => {
      if (!destroyed) setDuration(d);
    }).catch(() => {});

    player.on('timeupdate', (data: { seconds: number; duration: number }) => {
      if (destroyed) return;
      setCurrentTime(data.seconds);
      setDuration(data.duration);
      onTimeUpdateRef.current?.(data.seconds);
    });

    player.on('play', () => {
      if (!destroyed) setIsPlaying(true);
    });

    player.on('pause', () => {
      if (!destroyed) setIsPlaying(false);
    });

    player.on('ended', () => {
      if (!destroyed) setIsPlaying(false);
    });

    return () => {
      destroyed = true;
      player.off('timeupdate');
      player.off('play');
      player.off('pause');
      player.off('ended');
      vimeoPlayerRef.current = null;
    };
  }, [provider, videoId, iframeRef]);

  // --- Controls ---
  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(seconds, duration));
    if (provider === 'youtube' && ytPlayerRef.current) {
      try {
        ytPlayerRef.current.seekTo(clamped, true);
        setCurrentTime(clamped);
      } catch { /* ignore */ }
    } else if (provider === 'vimeo' && vimeoPlayerRef.current) {
      vimeoPlayerRef.current.setCurrentTime(clamped).then(() => {
        setCurrentTime(clamped);
      }).catch(() => {});
    }
  }, [provider, duration]);

  const play = useCallback(() => {
    if (provider === 'youtube' && ytPlayerRef.current) {
      try { ytPlayerRef.current.playVideo(); } catch { /* ignore */ }
    } else if (provider === 'vimeo' && vimeoPlayerRef.current) {
      vimeoPlayerRef.current.play().catch(() => {});
    }
  }, [provider]);

  const pause = useCallback(() => {
    if (provider === 'youtube' && ytPlayerRef.current) {
      try { ytPlayerRef.current.pauseVideo(); } catch { /* ignore */ }
    } else if (provider === 'vimeo' && vimeoPlayerRef.current) {
      vimeoPlayerRef.current.pause().catch(() => {});
    }
  }, [provider]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  return {
    currentTime,
    duration,
    isPlaying,
    seekTo,
    play,
    pause,
    togglePlay,
  };
}
