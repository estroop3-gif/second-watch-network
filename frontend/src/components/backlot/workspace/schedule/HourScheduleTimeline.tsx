/**
 * HourScheduleTimeline - Visual timeline component
 *
 * Reusable timeline visualization for hour schedules.
 * Used in both the wizard preview and the editor.
 * Supports both scene blocks and non-scripted segment blocks.
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Film,
  Utensils,
  Play,
  Truck,
  Flag,
  Timer,
  GripVertical,
  MessageSquare,
  Video,
  Wrench,
  User,
  Presentation,
  Music,
  MapPin,
  Layers,
  RefreshCw,
  Sun,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { HourScheduleBlock, HourScheduleBlockType, NonScriptedSegmentCategory } from '@/types/backlot';
import { formatTimeDisplay } from '@/lib/backlot/hourScheduleUtils';
import { getSegmentCategoryColor } from '@/lib/backlot/segmentPresets';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get icon for segment category
 */
function getSegmentCategoryIcon(category: NonScriptedSegmentCategory) {
  switch (category) {
    case 'interview': return <MessageSquare className="w-4 h-4" />;
    case 'broll': return <Video className="w-4 h-4" />;
    case 'technical': return <Wrench className="w-4 h-4" />;
    case 'talent': return <User className="w-4 h-4" />;
    case 'presentation': return <Presentation className="w-4 h-4" />;
    case 'performance': return <Music className="w-4 h-4" />;
    case 'location': return <MapPin className="w-4 h-4" />;
    case 'custom':
    default: return <Layers className="w-4 h-4" />;
  }
}

export function getBlockIcon(type: HourScheduleBlockType, segmentCategory?: NonScriptedSegmentCategory) {
  // Handle segment blocks with category-specific icons
  if (type === 'segment' && segmentCategory) {
    return getSegmentCategoryIcon(segmentCategory);
  }

  switch (type) {
    case 'scene': return <Film className="w-4 h-4" />;
    case 'meal': return <Utensils className="w-4 h-4" />;
    case 'crew_call': return <Flag className="w-4 h-4" />;
    case 'first_shot': return <Play className="w-4 h-4" />;
    case 'company_move': return <Truck className="w-4 h-4" />;
    case 'wrap': return <Flag className="w-4 h-4" />;
    case 'activity': return <Timer className="w-4 h-4" />;
    case 'segment': return <Layers className="w-4 h-4" />; // fallback for segment without category
    case 'camera_reset': return <RefreshCw className="w-4 h-4" />;
    case 'lighting_reset': return <Sun className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
}

export function getBlockColor(type: HourScheduleBlockType, segmentCategory?: NonScriptedSegmentCategory): string {
  // Handle segment blocks with category-specific colors
  if (type === 'segment' && segmentCategory) {
    return getSegmentCategoryColor(segmentCategory);
  }

  switch (type) {
    case 'scene': return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
    case 'meal': return 'bg-orange-500/20 border-orange-500/40 text-orange-400';
    case 'crew_call': return 'bg-green-500/20 border-green-500/40 text-green-400';
    case 'first_shot': return 'bg-accent-yellow/20 border-accent-yellow/40 text-accent-yellow';
    case 'company_move': return 'bg-purple-500/20 border-purple-500/40 text-purple-400';
    case 'wrap': return 'bg-red-500/20 border-red-500/40 text-red-400';
    case 'activity': return 'bg-muted-gray/20 border-muted-gray/40 text-muted-gray';
    case 'segment': return 'bg-green-500/20 border-green-500/40 text-green-400'; // fallback
    case 'camera_reset': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
    case 'lighting_reset': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
    default: return 'bg-muted-gray/20 border-muted-gray/40 text-muted-gray';
  }
}

export function getBlockLabel(block: HourScheduleBlock): string {
  if (block.type === 'scene' && block.scene_number) {
    return `Scene ${block.scene_number}`;
  }
  if (block.type === 'segment') {
    return block.activity_name || 'Segment';
  }
  return block.activity_name || 'Activity';
}

// ============================================================================
// TIMELINE BLOCK COMPONENT
// ============================================================================

interface TimelineBlockProps {
  block: HourScheduleBlock;
  isLast?: boolean;
  isDraggable?: boolean;
  onClick?: (block: HourScheduleBlock) => void;
}

export const TimelineBlock: React.FC<TimelineBlockProps> = ({
  block,
  isLast,
  isDraggable = false,
  onClick,
}) => {
  const blockColor = getBlockColor(block.type, block.segment_category);
  const blockIcon = getBlockIcon(block.type, block.segment_category);

  return (
    <div className="flex items-start gap-3">
      {/* Time column */}
      <div className="w-20 text-right shrink-0">
        <span className="text-sm font-medium text-bone-white">
          {formatTimeDisplay(block.start_time)}
        </span>
        {block.duration_minutes > 0 && (
          <p className="text-xs text-muted-gray">
            {formatTimeDisplay(block.end_time)}
          </p>
        )}
      </div>

      {/* Timeline dot and line */}
      <div className="flex flex-col items-center">
        <div className={cn('w-3 h-3 rounded-full border-2', blockColor)} />
        {!isLast && <div className="w-0.5 flex-1 bg-muted-gray/20 min-h-[2.5rem]" />}
      </div>

      {/* Block content */}
      <div
        className={cn(
          'flex-1 p-3 rounded-lg border mb-2 transition-colors',
          blockColor,
          onClick && 'cursor-pointer hover:border-opacity-80'
        )}
        onClick={onClick ? () => onClick(block) : undefined}
      >
        <div className="flex items-center gap-2">
          {isDraggable && (
            <GripVertical className="w-4 h-4 opacity-50 cursor-grab" />
          )}
          {blockIcon}
          <span className="font-medium">
            {getBlockLabel(block)}
          </span>
          {block.duration_minutes > 0 && (
            <Badge variant="outline" className="ml-auto text-xs">
              {block.duration_minutes} min
            </Badge>
          )}
        </div>

        {block.type === 'scene' && block.scene_slugline && (
          <div className="mt-1 text-sm opacity-80">
            {block.scene_slugline}
            {block.page_count != null && (
              <span className="ml-2 text-xs">({block.page_count % 1 === 0 ? block.page_count : block.page_count.toFixed(1)} pgs)</span>
            )}
          </div>
        )}

        {/* Segment description */}
        {block.type === 'segment' && block.segment_description && (
          <div className="mt-1 text-sm opacity-80">
            {block.segment_description}
          </div>
        )}

        {/* Segment location */}
        {block.type === 'segment' && block.location_name && (
          <p className="mt-1 text-xs opacity-70 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {block.location_name}
          </p>
        )}

        {block.activity_notes && (
          <p className="mt-1 text-xs opacity-70">{block.activity_notes}</p>
        )}

        {block.type === 'company_move' && block.location_name && (
          <p className="mt-1 text-xs opacity-80">
            Moving to: {block.location_name}
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SORTABLE TIMELINE BLOCK
// ============================================================================

interface SortableTimelineBlockProps extends TimelineBlockProps {
  id: string;
}

export const SortableTimelineBlock: React.FC<SortableTimelineBlockProps> = ({
  id,
  block,
  isLast,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const blockColor = getBlockColor(block.type, block.segment_category);
  const blockIcon = getBlockIcon(block.type, block.segment_category);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50')}
    >
      <div className="flex items-start gap-3">
        {/* Time column */}
        <div className="w-20 text-right shrink-0">
          <span className="text-sm font-medium text-bone-white">
            {formatTimeDisplay(block.start_time)}
          </span>
        </div>

        {/* Timeline dot and line */}
        <div className="flex flex-col items-center">
          <div className={cn('w-3 h-3 rounded-full border-2', blockColor)} />
          {!isLast && <div className="w-0.5 flex-1 bg-muted-gray/20 min-h-[2.5rem]" />}
        </div>

        {/* Block content */}
        <div
          className={cn(
            'flex-1 p-3 rounded-lg border mb-2 transition-colors',
            blockColor,
            isDragging && 'border-accent-yellow',
            onClick && 'cursor-pointer hover:border-opacity-80'
          )}
          onClick={onClick ? () => onClick(block) : undefined}
        >
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab touch-none text-inherit opacity-50 hover:opacity-100"
            >
              <GripVertical className="w-4 h-4" />
            </div>
            {blockIcon}
            <span className="font-medium">
              {getBlockLabel(block)}
            </span>
            {block.duration_minutes > 0 && (
              <Badge variant="outline" className="ml-auto text-xs">
                {block.duration_minutes} min
              </Badge>
            )}
          </div>

          {block.type === 'scene' && block.scene_slugline && (
            <div className="mt-1 text-sm opacity-80 pl-6">
              {block.scene_slugline}
              {block.page_count != null && (
                <span className="ml-2 text-xs">({block.page_count % 1 === 0 ? block.page_count : block.page_count.toFixed(1)} pgs)</span>
              )}
            </div>
          )}

          {/* Segment description */}
          {block.type === 'segment' && block.segment_description && (
            <div className="mt-1 text-sm opacity-80 pl-6">
              {block.segment_description}
            </div>
          )}

          {/* Segment location */}
          {block.type === 'segment' && block.location_name && (
            <p className="mt-1 text-xs opacity-70 pl-6 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {block.location_name}
            </p>
          )}

          {block.activity_notes && (
            <p className="mt-1 text-xs opacity-70 pl-6">{block.activity_notes}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN TIMELINE COMPONENT
// ============================================================================

interface HourScheduleTimelineProps {
  schedule: HourScheduleBlock[];
  onBlockClick?: (block: HourScheduleBlock) => void;
  className?: string;
  emptyMessage?: string;
}

export const HourScheduleTimeline: React.FC<HourScheduleTimelineProps> = ({
  schedule,
  onBlockClick,
  className,
  emptyMessage = 'No schedule blocks',
}) => {
  if (schedule.length === 0) {
    return (
      <div className={cn('text-center py-8 text-muted-gray', className)}>
        <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {schedule.map((block, index) => (
        <TimelineBlock
          key={block.id}
          block={block}
          isLast={index === schedule.length - 1}
          onClick={onBlockClick}
        />
      ))}
    </div>
  );
};

export default HourScheduleTimeline;
