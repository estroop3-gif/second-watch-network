/**
 * HourSchedulePreview - Compact timeline/list view for day cards
 *
 * Shows a condensed view of the hour schedule that can be embedded
 * in day cards on the schedule view.
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HourScheduleBlock } from '@/types/backlot';
import { formatTimeDisplay, getScheduleSummary } from '@/lib/backlot/hourScheduleUtils';

interface HourSchedulePreviewProps {
  schedule: HourScheduleBlock[];
  compact?: boolean;
  maxItems?: number;
  showSummary?: boolean;
  className?: string;
}

// Block type icon mapping (smaller for compact view)
function getBlockIcon(type: string, size: 'sm' | 'xs' = 'sm') {
  const className = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  switch (type) {
    case 'scene': return <Film className={className} />;
    case 'meal': return <Utensils className={className} />;
    case 'crew_call': return <Flag className={className} />;
    case 'first_shot': return <Play className={className} />;
    case 'company_move': return <Truck className={className} />;
    case 'wrap': return <Flag className={className} />;
    case 'activity': return <Timer className={className} />;
    default: return <Clock className={className} />;
  }
}

// Block type color mapping
function getBlockColor(type: string): string {
  switch (type) {
    case 'scene': return 'text-blue-400';
    case 'meal': return 'text-orange-400';
    case 'crew_call': return 'text-green-400';
    case 'first_shot': return 'text-accent-yellow';
    case 'company_move': return 'text-purple-400';
    case 'wrap': return 'text-red-400';
    default: return 'text-muted-gray';
  }
}

export const HourSchedulePreview: React.FC<HourSchedulePreviewProps> = ({
  schedule,
  compact = false,
  maxItems = 6,
  showSummary = true,
  className,
}) => {
  const summary = getScheduleSummary(schedule);
  const displayItems = schedule.slice(0, maxItems);
  const hiddenCount = schedule.length - maxItems;

  if (schedule.length === 0) {
    return (
      <div className={cn('text-xs text-muted-gray italic', className)}>
        No hour schedule generated
      </div>
    );
  }

  if (compact) {
    // Ultra-compact inline view
    return (
      <div className={cn('flex flex-wrap gap-1 items-center', className)}>
        {displayItems.map((block) => (
          <div
            key={block.id}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
              'bg-charcoal-black/50 border border-muted-gray/10',
              getBlockColor(block.type)
            )}
            title={`${formatTimeDisplay(block.start_time)} - ${block.activity_name || block.scene_number}`}
          >
            {getBlockIcon(block.type, 'xs')}
            <span className="truncate max-w-[60px]">
              {block.scene_number || block.activity_name?.slice(0, 8)}
            </span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <span className="text-xs text-muted-gray">+{hiddenCount} more</span>
        )}
      </div>
    );
  }

  // Standard preview view
  return (
    <div className={cn('space-y-2', className)}>
      {/* Summary badges */}
      {showSummary && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Badge variant="outline" className="text-xs gap-1">
            <Clock className="w-3 h-3" />
            {summary.totalDurationFormatted}
          </Badge>
          <Badge variant="outline" className="text-xs gap-1">
            <Film className="w-3 h-3" />
            {summary.sceneCount} scenes
          </Badge>
          {summary.mealCount > 0 && (
            <Badge variant="outline" className="text-xs gap-1 text-orange-400">
              <Utensils className="w-3 h-3" />
              {summary.mealCount}
            </Badge>
          )}
        </div>
      )}

      {/* Timeline items */}
      <div className="space-y-1">
        {displayItems.map((block, index) => (
          <div
            key={block.id}
            className="flex items-center gap-2 text-xs"
          >
            <span className="w-14 text-muted-gray shrink-0">
              {formatTimeDisplay(block.start_time)}
            </span>
            <div className={cn('shrink-0', getBlockColor(block.type))}>
              {getBlockIcon(block.type, 'xs')}
            </div>
            <span className="truncate text-bone-white/80">
              {block.scene_number
                ? `Sc. ${block.scene_number}`
                : block.activity_name}
            </span>
            {block.duration_minutes > 0 && (
              <span className="text-muted-gray ml-auto shrink-0">
                {block.duration_minutes}m
              </span>
            )}
          </div>
        ))}

        {hiddenCount > 0 && (
          <div className="text-xs text-muted-gray pl-16">
            +{hiddenCount} more items
          </div>
        )}
      </div>
    </div>
  );
};

export default HourSchedulePreview;
