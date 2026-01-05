/**
 * React Query hooks for Video playback
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videoApi } from '@/lib/api/watch';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Create a playback session for a video or episode
 */
export function usePlaybackSession(
  videoAssetId: string | undefined,
  authToken?: string | null
) {
  return useQuery({
    queryKey: ['playback-session', videoAssetId],
    queryFn: async () => {
      // If we have an auth token, use it; otherwise use the stored token
      const token = authToken || localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Authentication required for playback');
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/v1/video/playback/session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            video_asset_id: videoAssetId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create playback session' }));
        throw new Error(error.detail || 'Failed to create playback session');
      }

      return response.json();
    },
    enabled: !!videoAssetId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: false,
  });
}

/**
 * Get video asset details
 */
export function useVideoAsset(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-asset', videoId],
    queryFn: () => videoApi.getVideo(videoId!),
    enabled: !!videoId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * List video assets
 */
export function useVideoAssets(params?: {
  worldId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['video-assets', params],
    queryFn: () => videoApi.listVideos(params),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Get transcoding status with polling
 */
export function useTranscodeStatus(videoId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['transcode-status', videoId],
    queryFn: () => videoApi.getTranscodeStatus(videoId!),
    enabled: !!videoId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 5 seconds while processing
      if (status && !['completed', 'failed', 'cancelled'].includes(status)) {
        return 5000;
      }
      return false;
    },
  });
}

/**
 * Hook for video player state and controls
 */
export function useVideoPlayer(options?: {
  onProgress?: (position: number, duration: number) => void;
  onEnded?: () => void;
  saveProgressInterval?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [quality, setQuality] = useState<string>('auto');

  const saveProgressInterval = options?.saveProgressInterval || 10000; // 10 seconds

  // Play/pause
  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  // Seek
  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const seekForward = useCallback((seconds = 10) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(
        videoRef.current.currentTime + seconds,
        duration
      );
    }
  }, [duration]);

  const seekBackward = useCallback((seconds = 10) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(
        videoRef.current.currentTime - seconds,
        0
      );
    }
  }, []);

  // Volume
  const setVideoVolume = useCallback((v: number) => {
    if (videoRef.current) {
      videoRef.current.volume = v;
      setVolume(v);
      if (v > 0) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  // Fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await videoRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Playback rate
  const setVideoPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  // Event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      options?.onProgress?.(video.currentTime, video.duration);
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      options?.onEnded?.();
    };
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [options]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return {
    videoRef,
    // State
    isPlaying,
    currentTime,
    duration,
    buffered,
    volume,
    isMuted,
    isFullscreen,
    playbackRate,
    quality,
    // Controls
    play,
    pause,
    togglePlay,
    seek,
    seekForward,
    seekBackward,
    setVolume: setVideoVolume,
    toggleMute,
    toggleFullscreen,
    setPlaybackRate: setVideoPlaybackRate,
    setQuality,
  };
}

/**
 * Hook to auto-save watch progress
 */
export function useAutoSaveProgress(
  episodeId: string | undefined,
  currentTime: number,
  duration: number,
  enabled = true,
  interval = 15000 // 15 seconds
) {
  const queryClient = useQueryClient();
  const lastSavedRef = useRef(0);

  const saveMutation = useMutation({
    mutationFn: ({ position, dur }: { position: number; dur: number }) =>
      fetch(`/api/v1/worlds/episodes/${episodeId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          position_seconds: position,
          duration_seconds: dur,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continue-watching'] });
    },
  });

  useEffect(() => {
    if (!enabled || !episodeId || !duration) return;

    const saveProgress = () => {
      // Only save if position changed significantly (more than 5 seconds)
      if (Math.abs(currentTime - lastSavedRef.current) > 5) {
        saveMutation.mutate({ position: currentTime, dur: duration });
        lastSavedRef.current = currentTime;
      }
    };

    const intervalId = setInterval(saveProgress, interval);

    // Save on unmount
    return () => {
      clearInterval(intervalId);
      if (currentTime > 0 && Math.abs(currentTime - lastSavedRef.current) > 5) {
        saveMutation.mutate({ position: currentTime, dur: duration });
      }
    };
  }, [enabled, episodeId, currentTime, duration, interval, saveMutation]);

  return {
    isSaving: saveMutation.isPending,
    saveNow: () => saveMutation.mutate({ position: currentTime, dur: duration }),
  };
}
