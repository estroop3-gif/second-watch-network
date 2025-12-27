/**
 * VideoPlayerContext - Centralized state management for the video player
 */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';

// Playback speed options
const DEFAULT_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const SAFARI_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Detect Safari
const isSafari = typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export interface VideoPlayerState {
  // Core playback
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isLoading: boolean;

  // Frame-accurate
  frameRate: number;
  currentFrame: number;
  timecode: string;

  // In/Out points
  inPoint: number | null;
  outPoint: number | null;
  isLooping: boolean;

  // JKL Shuttle
  shuttleSpeed: number;

  // UI state
  showControls: boolean;
  showShortcutOverlay: boolean;

  // Available speeds based on browser
  availableSpeeds: number[];
}

export interface VideoPlayerActions {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  stepFrame: (direction: 1 | -1) => void;
  stepFrames: (count: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  setInPoint: () => void;
  setOutPoint: () => void;
  clearInOutPoints: () => void;
  toggleLoop: () => void;
  jklShuttle: (direction: 'j' | 'k' | 'l') => void;
  setShowControls: (show: boolean) => void;
  setShowShortcutOverlay: (show: boolean) => void;
}

interface VideoPlayerContextValue {
  state: VideoPlayerState;
  actions: VideoPlayerActions;
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

interface VideoPlayerProviderProps {
  children: ReactNode;
  frameRate?: number;
  onTimeUpdate?: (time: number) => void;
}

export const VideoPlayerProvider: React.FC<VideoPlayerProviderProps> = ({
  children,
  frameRate = 24,
  onTimeUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shuttleAnimationRef = useRef<number | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [inPoint, setInPointState] = useState<number | null>(null);
  const [outPoint, setOutPointState] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [shuttleSpeed, setShuttleSpeed] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);

  const availableSpeeds = isSafari ? SAFARI_SPEEDS : DEFAULT_SPEEDS;

  // Calculate current frame and timecode
  const currentFrame = Math.floor(currentTime * frameRate);
  const timecode = formatTimecode(currentTime, frameRate);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);

      // Handle loop between in/out points
      if (isLooping && outPoint !== null && time >= outPoint) {
        video.currentTime = inPoint ?? 0;
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    // Handle video ended - loop if enabled
    const handleEnded = () => {
      if (isLooping) {
        video.currentTime = inPoint ?? 0;
        video.play();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
    };
  }, [frameRate, isLooping, inPoint, outPoint, onTimeUpdate]);

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

  // Actions
  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    // Stop shuttle animation if running
    if (shuttleAnimationRef.current) {
      cancelAnimationFrame(shuttleAnimationRef.current);
      shuttleAnimationRef.current = null;
    }
    setShuttleSpeed(0);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, duration));
  }, [duration]);

  const seekRelative = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + delta, duration));
  }, [duration]);

  const stepFrame = useCallback((direction: 1 | -1) => {
    const video = videoRef.current;
    if (!video || isPlaying) return;
    const frameDuration = 1 / frameRate;
    video.currentTime = Math.max(0, Math.min(video.currentTime + (direction * frameDuration), duration));
  }, [isPlaying, frameRate, duration]);

  const stepFrames = useCallback((count: number) => {
    const video = videoRef.current;
    if (!video || isPlaying) return;
    const frameDuration = 1 / frameRate;
    video.currentTime = Math.max(0, Math.min(video.currentTime + (count * frameDuration), duration));
  }, [isPlaying, frameRate, duration]);

  const setPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  const setVolume = useCallback((vol: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = vol;
    setVolumeState(vol);
    if (vol > 0 && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  const setInPoint = useCallback(() => {
    setInPointState(currentTime);
  }, [currentTime]);

  const setOutPoint = useCallback(() => {
    setOutPointState(currentTime);
  }, [currentTime]);

  const clearInOutPoints = useCallback(() => {
    setInPointState(null);
    setOutPointState(null);
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping(prev => !prev);
  }, []);

  const jklShuttle = useCallback((direction: 'j' | 'k' | 'l') => {
    const video = videoRef.current;
    if (!video) return;

    if (direction === 'k') {
      // K = Pause and reset shuttle
      pause();
      return;
    }

    // Stop any existing animation
    if (shuttleAnimationRef.current) {
      cancelAnimationFrame(shuttleAnimationRef.current);
      shuttleAnimationRef.current = null;
    }

    let newSpeed = shuttleSpeed;

    if (direction === 'l') {
      // Forward: increase speed 0 -> 2 -> 4 -> 8
      if (shuttleSpeed < 0) {
        newSpeed = 0;
      } else if (shuttleSpeed === 0) {
        newSpeed = 2;
      } else {
        newSpeed = Math.min(8, shuttleSpeed * 2);
      }
    } else if (direction === 'j') {
      // Backward: decrease speed 0 -> -2 -> -4 -> -8
      if (shuttleSpeed > 0) {
        newSpeed = 0;
      } else if (shuttleSpeed === 0) {
        newSpeed = -2;
      } else {
        newSpeed = Math.max(-8, shuttleSpeed * 2);
      }
    }

    setShuttleSpeed(newSpeed);

    if (newSpeed === 0) {
      pause();
      return;
    }

    if (newSpeed > 0) {
      // Forward playback at speed
      video.playbackRate = newSpeed;
      video.play();
    } else {
      // Reverse playback using RAF
      video.pause();
      const targetFrameDuration = 1 / (frameRate * Math.abs(newSpeed));

      let lastTime = performance.now();
      const step = () => {
        const now = performance.now();
        const elapsed = (now - lastTime) / 1000;

        if (elapsed >= targetFrameDuration) {
          const newTime = video.currentTime - (1 / frameRate);
          if (newTime <= 0) {
            video.currentTime = 0;
            setShuttleSpeed(0);
            return;
          }
          video.currentTime = newTime;
          lastTime = now;
        }

        shuttleAnimationRef.current = requestAnimationFrame(step);
      };
      shuttleAnimationRef.current = requestAnimationFrame(step);
    }
  }, [shuttleSpeed, frameRate, pause]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (shuttleAnimationRef.current) {
        cancelAnimationFrame(shuttleAnimationRef.current);
      }
    };
  }, []);

  const state: VideoPlayerState = {
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    isFullscreen,
    isLoading,
    frameRate,
    currentFrame,
    timecode,
    inPoint,
    outPoint,
    isLooping,
    shuttleSpeed,
    showControls,
    showShortcutOverlay,
    availableSpeeds,
  };

  const actions: VideoPlayerActions = {
    play,
    pause,
    togglePlayPause,
    seek,
    seekRelative,
    stepFrame,
    stepFrames,
    setPlaybackRate,
    setVolume,
    toggleMute,
    toggleFullscreen,
    setInPoint,
    setOutPoint,
    clearInOutPoints,
    toggleLoop,
    jklShuttle,
    setShowControls,
    setShowShortcutOverlay,
  };

  return (
    <VideoPlayerContext.Provider value={{ state, actions, videoRef, containerRef }}>
      {children}
    </VideoPlayerContext.Provider>
  );
};

export const useVideoPlayer = (): VideoPlayerContextValue => {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error('useVideoPlayer must be used within a VideoPlayerProvider');
  }
  return context;
};

// Helper function to format timecode as HH:MM:SS:FF
function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(seconds);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

export default VideoPlayerContext;
