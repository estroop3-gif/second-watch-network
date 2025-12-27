/**
 * PlaybackControls - Play/pause button and shuttle indicators
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

const PlaybackControls: React.FC = () => {
  const { state, actions } = useVideoPlayer();

  return (
    <div className="flex items-center gap-1">
      {/* Shuttle Rewind Indicator */}
      <button
        onClick={() => actions.jklShuttle('j')}
        className={cn(
          'p-2 rounded hover:bg-white/10 transition-colors',
          state.shuttleSpeed < 0 ? 'text-accent-yellow' : 'text-bone-white/70'
        )}
        title="Shuttle rewind (J)"
      >
        <Rewind className="w-4 h-4" />
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
        className="p-2 rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white"
        title={state.isPlaying ? 'Seek back 5s' : 'Step back 1 frame (←)'}
      >
        <SkipBack className="w-4 h-4" />
      </button>

      {/* Play/Pause */}
      <button
        onClick={actions.togglePlayPause}
        className="p-2 rounded-full bg-accent-yellow hover:bg-accent-yellow/90 transition-colors text-charcoal-black"
        title={state.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {state.isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
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
        className="p-2 rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white"
        title={state.isPlaying ? 'Seek forward 5s' : 'Step forward 1 frame (→)'}
      >
        <SkipForward className="w-4 h-4" />
      </button>

      {/* Shuttle Forward Indicator */}
      <button
        onClick={() => actions.jklShuttle('l')}
        className={cn(
          'p-2 rounded hover:bg-white/10 transition-colors',
          state.shuttleSpeed > 0 ? 'text-accent-yellow' : 'text-bone-white/70'
        )}
        title="Shuttle forward (L)"
      >
        <FastForward className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PlaybackControls;
