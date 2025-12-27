import React, { useState } from 'react';
import { BacklotDailiesClipNote } from '@/types/backlot';
import { cn } from '@/lib/utils';

// Default colors for auto-assignment
export const DEFAULT_MARKER_COLORS = [
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#EF4444', // Red
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
];

// Get a color based on user ID hash (for consistent colors when not set)
export const getDefaultColorForUser = (userId: string, index?: number): string => {
  if (typeof index === 'number') {
    return DEFAULT_MARKER_COLORS[index % DEFAULT_MARKER_COLORS.length];
  }
  // Hash the user ID to get a consistent color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return DEFAULT_MARKER_COLORS[Math.abs(hash) % DEFAULT_MARKER_COLORS.length];
};

interface TimelineMarkersProps {
  notes: BacklotDailiesClipNote[];
  duration: number;
  currentTime?: number;
  onMarkerClick: (note: BacklotDailiesClipNote) => void;
  highlightedNoteId?: string;
}

interface MarkerTooltipProps {
  note: BacklotDailiesClipNote;
  position: { left: string };
  color: string;
}

const MarkerTooltip: React.FC<MarkerTooltipProps> = ({ note, color }) => {
  const authorName = note.author?.display_name || note.author?.full_name || 'Unknown';
  const preview = note.note_text?.slice(0, 50) + (note.note_text?.length > 50 ? '...' : '');

  return (
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
      <div
        className="border border-muted-gray/50 rounded-lg shadow-xl px-3 py-2 min-w-[150px] max-w-[250px]"
        style={{ backgroundColor: '#1a1a1a' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs font-medium text-bone-white truncate">
            {authorName}
          </span>
        </div>
        <p className="text-xs text-muted-gray line-clamp-2">
          {preview}
        </p>
      </div>
      {/* Arrow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent"
        style={{ borderTopColor: '#1a1a1a' }}
      />
    </div>
  );
};

export const TimelineMarkers: React.FC<TimelineMarkersProps> = ({
  notes,
  duration,
  onMarkerClick,
  highlightedNoteId,
}) => {
  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);

  // Only show notes with timestamps
  const timedNotes = notes.filter(note => note.time_seconds != null && note.time_seconds >= 0);

  if (!timedNotes.length || !duration) return null;

  // Group notes by similar positions to handle collisions
  const groupedNotes: { position: number; notes: BacklotDailiesClipNote[] }[] = [];
  const COLLISION_THRESHOLD = 2; // percentage points

  timedNotes.forEach(note => {
    const position = ((note.time_seconds || 0) / duration) * 100;
    const existingGroup = groupedNotes.find(
      g => Math.abs(g.position - position) < COLLISION_THRESHOLD
    );
    if (existingGroup) {
      existingGroup.notes.push(note);
    } else {
      groupedNotes.push({ position, notes: [note] });
    }
  });

  return (
    <div className="absolute inset-0 pointer-events-none">
      {groupedNotes.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.notes.map((note, noteIndex) => {
            const color = note.author?.marker_color || getDefaultColorForUser(note.author_user_id);
            const isHighlighted = note.id === highlightedNoteId;
            const isHovered = note.id === hoveredNoteId;

            // Offset vertically for stacked markers
            const verticalOffset = noteIndex * -6;

            return (
              <div
                key={note.id}
                className="absolute pointer-events-auto"
                style={{
                  left: `${group.position}%`,
                  top: `${-8 + verticalOffset}px`,
                  transform: 'translateX(-50%)',
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkerClick(note);
                  }}
                  onMouseEnter={() => setHoveredNoteId(note.id)}
                  onMouseLeave={() => setHoveredNoteId(null)}
                  className={cn(
                    'w-0 h-0 transition-all duration-150',
                    'border-l-[5px] border-r-[5px] border-t-[8px]',
                    'border-l-transparent border-r-transparent',
                    isHighlighted && 'scale-125',
                    'hover:scale-125 focus:outline-none'
                  )}
                  style={{
                    borderTopColor: color,
                    filter: isHighlighted ? 'brightness(1.2)' : undefined,
                  }}
                  title={`${note.author?.display_name || note.author?.full_name || 'Note'}: ${note.note_text?.slice(0, 30)}...`}
                />
                {isHovered && (
                  <MarkerTooltip
                    note={note}
                    position={{ left: `${group.position}%` }}
                    color={color}
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default TimelineMarkers;
