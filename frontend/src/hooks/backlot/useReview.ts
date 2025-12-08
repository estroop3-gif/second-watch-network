/**
 * useReview - Hooks for managing Frame.io-style video review
 * For reviewing cuts, versions, and time-coded notes
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ReviewAsset,
  ReviewVersion,
  ReviewNote,
  ReviewNoteReply,
  ReviewAssetInput,
  ReviewAssetUpdateInput,
  ReviewVersionInput,
  ReviewNoteInput,
  ReviewNoteUpdateInput,
  CreateTaskFromNoteInput,
  BacklotTask,
} from '@/types/backlot';

// =====================================================
// REVIEW ASSETS HOOKS
// =====================================================

interface UseReviewAssetsOptions {
  projectId: string | null;
}

/**
 * Get all review assets for a project
 */
export function useReviewAssets(options: UseReviewAssetsOptions) {
  const { projectId } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-review-assets', { projectId }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const result = await api.listReviewAssets(projectId);
      return result.assets || [];
    },
    enabled: !!projectId,
  });

  const createAsset = useMutation({
    mutationFn: async (input: ReviewAssetInput) => {
      if (!projectId) throw new Error('No project ID');
      const result = await api.createReviewAsset(projectId, input);
      return result.asset as ReviewAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
    },
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...input }: ReviewAssetUpdateInput & { id: string }) => {
      const result = await api.updateReviewAsset(id, input);
      return result.asset as ReviewAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-asset'] });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteReviewAsset(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
    },
  });

  return {
    assets: (data || []) as ReviewAsset[],
    isLoading,
    error,
    refetch,
    createAsset,
    updateAsset,
    deleteAsset,
  };
}

// =====================================================
// SINGLE REVIEW ASSET HOOK
// =====================================================

interface UseReviewAssetOptions {
  assetId: string | null;
}

/**
 * Get a single review asset with all versions
 */
export function useReviewAsset(options: UseReviewAssetOptions) {
  const { assetId } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-review-asset', { assetId }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!assetId) return null;
      const result = await api.getReviewAsset(assetId);
      return result.asset as ReviewAsset;
    },
    enabled: !!assetId,
  });

  // Version mutations
  const createVersion = useMutation({
    mutationFn: async (input: ReviewVersionInput) => {
      if (!assetId) throw new Error('No asset ID');
      const result = await api.createReviewVersion(assetId, input);
      return result.version as ReviewVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-asset'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
    },
  });

  const makeVersionActive = useMutation({
    mutationFn: async (versionId: string) => {
      await api.makeVersionActive(versionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-asset'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
    },
  });

  const deleteVersion = useMutation({
    mutationFn: async (versionId: string) => {
      await api.deleteReviewVersion(versionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-asset'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
    },
  });

  return {
    asset: data,
    versions: data?.versions || [],
    activeVersion: data?.active_version,
    isLoading,
    error,
    refetch,
    createVersion,
    makeVersionActive,
    deleteVersion,
  };
}

// =====================================================
// REVIEW NOTES HOOKS
// =====================================================

interface UseReviewNotesOptions {
  versionId: string | null;
}

/**
 * Get all notes for a version
 */
export function useReviewNotes(options: UseReviewNotesOptions) {
  const { versionId } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-review-notes', { versionId }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!versionId) return [];
      const result = await api.listReviewNotes(versionId);
      return result.notes || [];
    },
    enabled: !!versionId,
  });

  const createNote = useMutation({
    mutationFn: async (input: ReviewNoteInput) => {
      if (!versionId) throw new Error('No version ID');
      const result = await api.createReviewNote(versionId, input);
      return result.note as ReviewNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-notes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-asset'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, ...input }: ReviewNoteUpdateInput & { id: string }) => {
      const result = await api.updateReviewNote(id, input);
      return result.note as ReviewNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-notes'] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteReviewNote(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-notes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-asset'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-review-assets'] });
    },
  });

  const resolveNote = useMutation({
    mutationFn: async ({ id, is_resolved }: { id: string; is_resolved: boolean }) => {
      const result = await api.updateReviewNote(id, { is_resolved });
      return result.note as ReviewNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-notes'] });
    },
  });

  // Reply mutations
  const createReply = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const result = await api.createNoteReply(noteId, content);
      return result.reply as ReviewNoteReply;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-notes'] });
    },
  });

  const deleteReply = useMutation({
    mutationFn: async (replyId: string) => {
      await api.deleteNoteReply(replyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-notes'] });
    },
  });

  // Task integration
  const createTaskFromNote = useMutation({
    mutationFn: async ({ noteId, ...input }: CreateTaskFromNoteInput & { noteId: string }) => {
      const result = await api.createTaskFromNote(noteId, input);
      return result.task as BacklotTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-review-notes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
  });

  // Helper to get notes at a specific timecode (for timeline markers)
  const getNotesAtTimecode = (seconds: number, tolerance: number = 0.5): ReviewNote[] => {
    if (!data) return [];
    return data.filter((note: ReviewNote) => {
      if (note.timecode_seconds === null) return false;
      const diff = Math.abs(note.timecode_seconds - seconds);
      return diff <= tolerance;
    });
  };

  // Get notes sorted by timecode (for sidebar list)
  const sortedNotes = [...(data || [])].sort((a: ReviewNote, b: ReviewNote) => {
    // General notes (no timecode) go at the end
    if (a.timecode_seconds === null && b.timecode_seconds === null) return 0;
    if (a.timecode_seconds === null) return 1;
    if (b.timecode_seconds === null) return -1;
    return a.timecode_seconds - b.timecode_seconds;
  });

  // Get general notes (no timecode)
  const generalNotes = (data || []).filter((note: ReviewNote) => note.timecode_seconds === null);

  // Get timecoded notes
  const timecodedNotes = (data || []).filter((note: ReviewNote) => note.timecode_seconds !== null);

  return {
    notes: (data || []) as ReviewNote[],
    sortedNotes: sortedNotes as ReviewNote[],
    generalNotes: generalNotes as ReviewNote[],
    timecodedNotes: timecodedNotes as ReviewNote[],
    isLoading,
    error,
    refetch,
    createNote,
    updateNote,
    deleteNote,
    resolveNote,
    createReply,
    deleteReply,
    createTaskFromNote,
    getNotesAtTimecode,
  };
}

// =====================================================
// REVIEW PLAYER STATE HOOK
// =====================================================

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseReviewPlayerOptions {
  initialTime?: number;
  onTimeUpdate?: (time: number) => void;
}

/**
 * Hook for managing review player state
 */
export function useReviewPlayer(options: UseReviewPlayerOptions = {}) {
  const { initialTime = 0, onTimeUpdate } = options;

  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Bind video element
  const bindVideoElement = useCallback((video: HTMLVideoElement | null) => {
    if (videoRef.current) {
      // Clean up old listeners
      videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      videoRef.current.removeEventListener('play', handlePlay);
      videoRef.current.removeEventListener('pause', handlePause);
      videoRef.current.removeEventListener('durationchange', handleDurationChange);
      videoRef.current.removeEventListener('seeking', handleSeeking);
      videoRef.current.removeEventListener('seeked', handleSeeked);
    }

    videoRef.current = video;

    if (video) {
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('durationchange', handleDurationChange);
      video.addEventListener('seeking', handleSeeking);
      video.addEventListener('seeked', handleSeeked);

      // Initialize state
      setDuration(video.duration || 0);
      setIsPlaying(!video.paused);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current && !isSeeking) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  }, [isSeeking, onTimeUpdate]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleDurationChange = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  }, []);

  const handleSeeking = useCallback(() => {
    setIsSeeking(true);
  }, []);

  const handleSeeked = useCallback(() => {
    setIsSeeking(false);
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Playback controls
  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(seconds, duration));
    }
  }, [duration]);

  const seekRelative = useCallback((delta: number) => {
    seekTo(currentTime + delta);
  }, [currentTime, seekTo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        videoRef.current.removeEventListener('play', handlePlay);
        videoRef.current.removeEventListener('pause', handlePause);
        videoRef.current.removeEventListener('durationchange', handleDurationChange);
        videoRef.current.removeEventListener('seeking', handleSeeking);
        videoRef.current.removeEventListener('seeked', handleSeeked);
      }
    };
  }, []);

  return {
    // State
    currentTime,
    duration,
    isPlaying,
    isSeeking,

    // Refs
    videoRef,
    bindVideoElement,

    // Controls
    play,
    pause,
    togglePlay,
    seekTo,
    seekRelative,

    // Computed
    progress: duration > 0 ? (currentTime / duration) * 100 : 0,
  };
}
