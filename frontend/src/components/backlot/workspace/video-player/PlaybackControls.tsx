/**
 * PlaybackControls - Play/pause button and shuttle indicators
 * Supports compact mode for vertical videos
 */
import React from 'react';
import { useVideoPlayer } from './VideoPlayerContext';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
} from 'lucide-react';

interface PlaybackControlsProps {
  compact?: boolean;
}

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ compact = false }) => {
  const { state, actions } = useVideoPlayer();

  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const playIconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const buttonPadding = compact ? 'p-1.5' : 'p-2';

  return (
    <div className={cn('flex items-center', compact ? 'gap-0.5' : 'gap-1')}>
      {/* Shuttle Rewind Indicator */}
      <button
        onClick={() => actions.jklShuttle('j')}
        className={cn(
          buttonPadding,
          'rounded hover:bg-white/10 transition-colors',
          state.shuttleSpeed < 0 ? 'text-accent-yellow' : 'text-bone-white/70'
        )}
        title="Shuttle rewind (J)"
      >
        <Rewind className={iconSize} />
      </button>

      {/* Step Back */}
      <button
        onClick={() => {
          if (!state.isPlaying) {
            actions.stepFrame(-1);
          } else {
            actions.seekRelative(-5);
          }
        }}
        className={cn(
          buttonPadding,
          'rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white'
        )}
        title={state.isPlaying ? 'Seek back 5s' : 'Step back 1 frame (←)'}
      >
        <SkipBack className={iconSize} />
      </button>

      {/* Play/Pause */}
      <button
        onClick={actions.togglePlayPause}
        className={cn(
          'rounded-full bg-accent-yellow hover:bg-accent-yellow/90 transition-colors text-charcoal-black',
          compact ? 'p-1.5' : 'p-2'
        )}
        title={state.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {state.isPlaying ? (
          <Pause className={playIconSize} />
        ) : (
          <Play className={cn(playIconSize, 'ml-0.5')} />
        )}
      </button>

      {/* Step Forward */}
      <button
        onClick={() => {
          if (!state.isPlaying) {
            actions.stepFrame(1);
          } else {
            actions.seekRelative(5);
          }
        }}
        className={cn(
          buttonPadding,
          'rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white'
        )}
        title={state.isPlaying ? 'Seek forward 5s' : 'Step forward 1 frame (→)'}
      >
        <SkipForward className={iconSize} />
      </button>

      {/* Shuttle Forward Indicator */}
      <button
        onClick={() => actions.jklShuttle('l')}
        className={cn(
          buttonPadding,
          'rounded hover:bg-white/10 transition-colors',
          state.shuttleSpeed > 0 ? 'text-accent-yellow' : 'text-bone-white/70'
        )}
        title="Shuttle forward (L)"
      >
        <FastForward className={iconSize} />
      </button>
    </div>
  );
};

export default PlaybackControls;
