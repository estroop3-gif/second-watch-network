/**
 * FullscreenButton - Toggle fullscreen mode
 * Supports compact mode for vertical videos
 */
import React from 'react';
import { useVideoPlayer } from './VideoPlayerContext';
import { Maximize, Minimize } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FullscreenButtonProps {
  compact?: boolean;
}

const FullscreenButton: React.FC<FullscreenButtonProps> = ({ compact = false }) => {
  const { state, actions } = useVideoPlayer();

  return (
    <button
      onClick={actions.toggleFullscreen}
      className={cn(
        'rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white',
        compact ? 'p-1.5' : 'p-2'
      )}
      title={state.isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
    >
      {state.isFullscreen ? (
        <Minimize className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      ) : (
        <Maximize className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      )}
    </button>
  );
};

export default FullscreenButton;
