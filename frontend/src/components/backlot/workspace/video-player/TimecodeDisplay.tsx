/**
 * TimecodeDisplay - Shows current timecode in HH:MM:SS:FF format
 */
import React from 'react';
import { useVideoPlayer } from './VideoPlayerContext';
import { cn } from '@/lib/utils';

interface TimecodeDisplayProps {
  className?: string;
  showDuration?: boolean;
  quality?: string;
}

const TimecodeDisplay: React.FC<TimecodeDisplayProps> = ({
  className,
  showDuration = true,
  quality = 'auto',
}) => {
  const { state } = useVideoPlayer();

  // Format duration as timecode
  const formatDurationTimecode = (seconds: number, fps: number): string => {
    const totalFrames = Math.floor(seconds * fps);
    const frames = totalFrames % fps;
    const totalSeconds = Math.floor(seconds);
    const secs = totalSeconds % 60;
    const mins = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  };

  const durationTimecode = formatDurationTimecode(state.duration, state.frameRate);

  return (
    <div className={cn('flex items-center gap-1 font-mono text-sm', className)}>
      {/* In Point Indicator */}
      {state.inPoint !== null && (
        <span className="text-green-400 text-xs mr-1" title="In point">
          [I]
        </span>
      )}

      {/* Current Timecode */}
      <span className="text-bone-white tabular-nums">
        {state.timecode}
      </span>

      {/* Duration */}
      {showDuration && (
        <>
          <span className="text-muted-gray">/</span>
          <span className="text-muted-gray tabular-nums">
            {durationTimecode}
          </span>
        </>
      )}

      {/* Out Point Indicator */}
      {state.outPoint !== null && (
        <span className="text-red-400 text-xs ml-1" title="Out point">
          [O]
        </span>
      )}

      {/* Frame Rate Badge */}
      <span className="ml-2 px-1.5 py-0.5 rounded bg-white/10 text-xs text-muted-gray">
        {state.frameRate}fps
      </span>

      {/* Quality Badge */}
      <span className="ml-1 px-1.5 py-0.5 rounded bg-white/10 text-xs text-muted-gray uppercase">
        {quality === 'auto' ? 'Auto' : quality}
      </span>

      {/* Playback Rate Badge (if not 1x) */}
      {state.playbackRate !== 1 && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-accent-yellow/20 text-xs text-accent-yellow">
          {state.playbackRate}x
        </span>
      )}
    </div>
  );
};

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

export default TimecodeDisplay;
