/**
 * VideoPlayer - Main video player wrapper component
 */
import React, { useEffect, useRef, useState } from 'react';
import { VideoPlayerProvider, useVideoPlayer } from './VideoPlayerContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import VideoControls from './VideoControls';
import ShortcutOverlay from './ShortcutOverlay';
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
}) => {
  const { state, actions, videoRef, containerRef } = useVideoPlayer();
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState(true);

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

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black rounded-lg overflow-hidden group',
        state.isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={streamUrl}
        className="w-full h-full object-contain"
        crossOrigin="anonymous"
        playsInline
        onClick={actions.togglePlayPause}
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

      {/* Shuttle Speed Indicator */}
      {state.shuttleSpeed !== 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg">
          <span className="text-bone-white font-mono text-lg">
            {state.shuttleSpeed > 0 ? '▶▶' : '◀◀'} {Math.abs(state.shuttleSpeed)}x
          </span>
        </div>
      )}

      {/* Video Controls */}
      <VideoControls
        visible={state.showControls}
        notes={notes}
        onNoteClick={onNoteClick}
        clip={clip}
        onQualityChange={onQualityChange}
        quality={quality}
        actualQuality={actualQuality}
        availableRenditions={availableRenditions}
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
