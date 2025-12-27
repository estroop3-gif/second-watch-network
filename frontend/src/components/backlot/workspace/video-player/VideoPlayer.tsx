/**
 * VideoPlayer - Main video player wrapper component
 * Supports all aspect ratios including horizontal (16:9), vertical (9:16), square (1:1), etc.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VideoPlayerProvider, useVideoPlayer } from './VideoPlayerContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import VideoControls from './VideoControls';
import ShortcutOverlay from './ShortcutOverlay';
import AspectRatioGuide, { AspectRatioGuideType } from './AspectRatioGuide';
import { cn } from '@/lib/utils';
import { Loader2, Play } from 'lucide-react';
import { BacklotDailiesClip, BacklotDailiesClipNote } from '@/types/backlot';

type QualityValue = 'auto' | '1080p' | '720p' | '480p' | 'original';

interface VideoPlayerProps {
  streamUrl: string | null;
  clip: BacklotDailiesClip;
  notes?: BacklotDailiesClipNote[];
  onTimeUpdate?: (time: number) => void;
  onNoteClick?: (note: BacklotDailiesClipNote) => void;
  onAddNote?: () => void;
  onQualityChange?: (quality: QualityValue) => void;
  quality?: QualityValue;
  actualQuality?: string;
  availableRenditions?: string[];
  canEdit?: boolean;
  className?: string;
  /** Enable auto-sizing based on video aspect ratio */
  autoSize?: boolean;
  /** Maximum height constraint (default: 80vh) */
  maxHeight?: string;
}

const VideoPlayerInner: React.FC<VideoPlayerProps> = ({
  streamUrl,
  clip,
  notes = [],
  onTimeUpdate,
  onNoteClick,
  onAddNote,
  onQualityChange,
  quality = 'auto',
  actualQuality = 'original',
  availableRenditions = ['original'],
  canEdit = false,
  className,
  autoSize = true,
  maxHeight = '80vh',
}) => {
  const { state, actions, videoRef, containerRef } = useVideoPlayer();
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [aspectGuide, setAspectGuide] = useState<AspectRatioGuideType>('none');

  // Derived state
  const isVertical = aspectRatio !== null && aspectRatio < 1;
  const isSquare = aspectRatio !== null && Math.abs(aspectRatio - 1) < 0.05;

  // Detect video aspect ratio when metadata loads
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      const ratio = video.videoWidth / video.videoHeight;
      setAspectRatio(ratio);
      setVideoWidth(video.videoWidth);
      setVideoHeight(video.videoHeight);
      console.log(`Video loaded: ${video.videoWidth}x${video.videoHeight}, aspect: ${ratio.toFixed(3)}`);
    }
  }, [videoRef]);

  // Cycle through aspect ratio guides with 'G' key
  const aspectGuides: AspectRatioGuideType[] = [
    'none', '16:9', '2.39:1', '2.35:1', '1.85:1', '4:3', '1:1', '9:16', '4:5', 'title-safe', 'action-safe'
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setAspectGuide(current => {
          const currentIndex = aspectGuides.indexOf(current);
          const nextIndex = (currentIndex + 1) % aspectGuides.length;
          return aspectGuides[nextIndex];
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({ enabled: true, onAddNote });

  // Auto-hide controls
  const handleMouseMove = () => {
    actions.setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (state.isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        actions.setShowControls(false);
      }, 3000);
    }
  };

  const handleMouseLeave = () => {
    if (state.isPlaying) {
      actions.setShowControls(false);
    }
  };

  // Show controls when paused
  useEffect(() => {
    if (!state.isPlaying) {
      actions.setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }
  }, [state.isPlaying, actions]);

  // Handle play overlay click
  const handlePlayClick = () => {
    actions.play();
    setShowPlayOverlay(false);
  };

  // Hide play overlay when video starts playing
  useEffect(() => {
    if (state.isPlaying) {
      setShowPlayOverlay(false);
    }
  }, [state.isPlaying]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!streamUrl) {
    return (
      <div className="aspect-video bg-charcoal-black rounded-lg flex items-center justify-center">
        <p className="text-muted-gray">No video available</p>
      </div>
    );
  }

  // Calculate container styles based on aspect ratio
  const getContainerStyles = (): React.CSSProperties => {
    if (state.isFullscreen) {
      return {};
    }

    if (!autoSize || !aspectRatio) {
      // Fallback to 16:9 while loading
      return { aspectRatio: '16/9' };
    }

    if (isVertical) {
      // For vertical videos, constrain by height and let width be calculated
      return {
        maxHeight,
        aspectRatio: aspectRatio.toString(),
        width: 'auto',
        margin: '0 auto',
      };
    }

    // For horizontal/square videos, use aspect ratio
    return {
      aspectRatio: aspectRatio.toString(),
      width: '100%',
    };
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black rounded-lg overflow-hidden group flex items-center justify-center',
        state.isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      style={getContainerStyles()}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={streamUrl}
        className={cn(
          'max-w-full max-h-full',
          state.isFullscreen ? 'w-full h-full object-contain' : 'w-full h-full object-contain'
        )}
        crossOrigin="anonymous"
        playsInline
        onClick={actions.togglePlayPause}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Loading Spinner */}
      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="w-12 h-12 text-accent-yellow animate-spin" />
        </div>
      )}

      {/* Play Button Overlay (initial state) */}
      {showPlayOverlay && !state.isPlaying && !state.isLoading && (
        <button
          onClick={handlePlayClick}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          <div className="w-20 h-20 rounded-full bg-accent-yellow/90 flex items-center justify-center hover:scale-110 transition-transform">
            <Play className="w-10 h-10 text-charcoal-black ml-1" />
          </div>
        </button>
      )}

      {/* Aspect Ratio Guide Overlay */}
      <AspectRatioGuide
        guide={aspectGuide}
        videoWidth={videoWidth}
        videoHeight={videoHeight}
      />

      {/* Aspect Guide Label */}
      {aspectGuide !== 'none' && (
        <div className="absolute top-4 right-4 bg-black/80 px-3 py-1.5 rounded-lg z-10">
          <span className="text-accent-yellow font-mono text-sm">
            {aspectGuide}
          </span>
        </div>
      )}

      {/* Video Info Badge (for debugging/info) */}
      {aspectRatio && (
        <div className="absolute top-4 left-4 bg-black/60 px-2 py-1 rounded text-xs text-white/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
          {videoWidth}×{videoHeight} • {aspectRatio.toFixed(2)}:1
        </div>
      )}

      {/* Shuttle Speed Indicator */}
      {state.shuttleSpeed !== 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg z-10">
          <span className="text-bone-white font-mono text-lg">
            {state.shuttleSpeed > 0 ? '▶▶' : '◀◀'} {Math.abs(state.shuttleSpeed)}x
          </span>
        </div>
      )}

      {/* Video Controls - optimized for all aspect ratios */}
      <VideoControls
        visible={state.showControls}
        notes={notes}
        onNoteClick={onNoteClick}
        clip={clip}
        onQualityChange={onQualityChange}
        quality={quality}
        actualQuality={actualQuality}
        availableRenditions={availableRenditions}
        isVertical={isVertical}
      />

      {/* Keyboard Shortcut Overlay */}
      <ShortcutOverlay
        visible={state.showShortcutOverlay}
        onClose={() => actions.setShowShortcutOverlay(false)}
      />
    </div>
  );
};

// Wrapper component that provides context
const VideoPlayer: React.FC<VideoPlayerProps> = (props) => {
  return (
    <VideoPlayerProvider
      frameRate={props.clip.frame_rate || 24}
      onTimeUpdate={props.onTimeUpdate}
    >
      <VideoPlayerInner {...props} />
    </VideoPlayerProvider>
  );
};

export default VideoPlayer;
