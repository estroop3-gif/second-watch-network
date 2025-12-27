/**
 * FullscreenButton - Toggle fullscreen mode
 */
import React from 'react';
import { useVideoPlayer } from './VideoPlayerContext';
import { Maximize, Minimize } from 'lucide-react';

const FullscreenButton: React.FC = () => {
  const { state, actions } = useVideoPlayer();

  return (
    <button
      onClick={actions.toggleFullscreen}
      className="p-2 rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white"
      title={state.isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
    >
      {state.isFullscreen ? (
        <Minimize className="w-4 h-4" />
      ) : (
        <Maximize className="w-4 h-4" />
      )}
    </button>
  );
};

export default FullscreenButton;
