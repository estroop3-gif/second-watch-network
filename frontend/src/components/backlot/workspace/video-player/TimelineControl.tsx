/**
 * TimelineControl - Video scrubber with in/out point markers and note markers
 */
import React, { useRef, useState, useCallback } from 'react';
import { useVideoPlayer } from './VideoPlayerContext';
import { cn } from '@/lib/utils';
import { BacklotDailiesClipNote } from '@/types/backlot';
import { getDefaultColorForUser } from '../TimelineMarkers';

interface TimelineControlProps {
  notes?: BacklotDailiesClipNote[];
  onNoteClick?: (note: BacklotDailiesClipNote) => void;
  duration?: number;
  compact?: boolean;
}

const TimelineControl: React.FC<TimelineControlProps> = ({
  notes = [],
  onNoteClick,
  duration: propDuration,
  compact = false,
}) => {
  const { state, actions } = useVideoPlayer();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  const duration = propDuration || state.duration;
  const progress = duration > 0 ? (state.currentTime / duration) * 100 : 0;

  const handleSeek = useCallback((clientX: number) => {
    const timeline = timelineRef.current;
    if (!timeline || duration <= 0) return;

    const rect = timeline.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    const clampedPosition = Math.max(0, Math.min(1, position));
    const time = clampedPosition * duration;
    actions.seek(time);
  }, [duration, actions]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const rect = timeline.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const clampedPosition = Math.max(0, Math.min(1, position));

    setHoverPosition(clampedPosition * 100);
    setHoverTime(clampedPosition * duration);

    if (isDragging) {
      handleSeek(e.clientX);
    }
  }, [isDragging, duration, handleSeek]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverTime(null);
    setIsHovering(false);
  };

  // Format time for hover tooltip
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate in/out point positions
  const inPointPosition = state.inPoint !== null && duration > 0
    ? (state.inPoint / duration) * 100
    : null;
  const outPointPosition = state.outPoint !== null && duration > 0
    ? (state.outPoint / duration) * 100
    : null;

  return (
    <div className="relative w-full">
      {/* Timeline Track */}
      <div
        ref={timelineRef}
        className="relative h-2 bg-white/20 rounded-full cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* In/Out Range Background */}
        {inPointPosition !== null && outPointPosition !== null && (
          <div
            className="absolute top-0 bottom-0 bg-accent-yellow/20"
            style={{
              left: `${inPointPosition}%`,
              width: `${outPointPosition - inPointPosition}%`,
            }}
          />
        )}

        {/* Progress Bar */}
        <div
          className="absolute top-0 left-0 h-full bg-accent-yellow rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />

        {/* Buffered Progress (could be added later) */}

        {/* Hover Preview Line */}
        {hoverTime !== null && !isDragging && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/50 pointer-events-none"
            style={{ left: `${hoverPosition}%` }}
          />
        )}

        {/* Playhead */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-accent-yellow rounded-full shadow-lg transform -translate-x-1/2 transition-opacity",
            isHovering ? "opacity-100" : "opacity-0"
          )}
          style={{ left: `${progress}%` }}
        />

        {/* In Point Marker */}
        {inPointPosition !== null && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-green-400 rounded-full"
            style={{ left: `${inPointPosition}%` }}
            title={`In: ${formatTime(state.inPoint!)}`}
          />
        )}

        {/* Out Point Marker */}
        {outPointPosition !== null && (
          <div
            className="absolute top-0 bottom-0 w-1 bg-red-400 rounded-full"
            style={{ left: `${outPointPosition}%` }}
            title={`Out: ${formatTime(state.outPoint!)}`}
          />
        )}

        {/* Note Markers */}
        {notes.map((note) => {
          if (duration <= 0 || note.time_seconds === null || note.time_seconds === undefined) return null;
          const position = (note.time_seconds / duration) * 100;
          const markerColor = note.author?.marker_color || getDefaultColorForUser(note.author_user_id);
          return (
            <button
              key={note.id}
              onClick={(e) => {
                e.stopPropagation();
                onNoteClick?.(note);
                actions.seek(note.time_seconds!);
              }}
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transform -translate-x-1/2 hover:scale-150 transition-transform z-10"
              style={{
                left: `${position}%`,
                backgroundColor: markerColor,
              }}
              title={note.note_text?.substring(0, 50) || 'Note'}
            />
          );
        })}
      </div>

      {/* Hover Time Tooltip */}
      {hoverTime !== null && (
        <div
          className="absolute -top-8 transform -translate-x-1/2 px-2 py-1 bg-charcoal-black/90 rounded text-xs text-bone-white whitespace-nowrap pointer-events-none"
          style={{ left: `${hoverPosition}%` }}
        >
          {formatTime(hoverTime)}
        </div>
      )}
    </div>
  );
};

export default TimelineControl;
