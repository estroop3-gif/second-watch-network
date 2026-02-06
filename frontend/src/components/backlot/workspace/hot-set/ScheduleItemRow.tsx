/**
 * ScheduleItemRow - Individual row for scene/activity with status indicator
 *
 * Shows:
 * - Status indicator (checkmark for completed, arrow for current, pending)
 * - Planned time vs projected time
 * - Variance display (+5m / -5m)
 * - Color coding based on status
 * - Click actions for activities
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  ChevronRight,
  Play,
  SkipForward,
  Clapperboard,
  Coffee,
  Truck,
  Activity,
  Clock,
  Flag,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectedScheduleItem } from '@/types/backlot';
import { formatScheduleTime } from '@/hooks/backlot';

interface ScheduleItemRowProps {
  item: ProjectedScheduleItem;
  canEdit: boolean;
  onStartActivity?: (blockId: string) => void;
  onCompleteActivity?: (blockId: string) => void;
  onSkipActivity?: (blockId: string) => void;
  onStartScene?: (sceneId: string) => void;
  onClickScene?: (sceneId: string) => void;
  isLoading?: boolean;
  showProjectedTime?: boolean;  // Legacy prop name
  showProjectedTimes?: boolean;  // Show projected times for pending items
  showActualTimes?: boolean;  // Show actual times for completed items (detailed view)
  timezone?: string | null;  // For proper time formatting
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'scene':
      return Clapperboard;
    case 'meal':
      return Coffee;
    case 'company_move':
      return Truck;
    case 'crew_call':
      return Sun;
    case 'first_shot':
      return Play;
    case 'wrap':
      return Flag;
    default:
      return Activity;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'scene':
      return 'text-blue-400';
    case 'meal':
      return 'text-green-400';
    case 'company_move':
      return 'text-orange-400';
    case 'activity':
      return 'text-purple-400';
    case 'crew_call':
      return 'text-yellow-400';
    case 'first_shot':
      return 'text-red-400';
    case 'wrap':
      return 'text-muted-gray';
    default:
      return 'text-muted-gray';
  }
};

const getStatusBgColor = (status: string, isCurrent: boolean) => {
  if (isCurrent) return 'bg-accent-yellow/10 border-accent-yellow/30';
  switch (status) {
    case 'completed':
      return 'bg-green-500/5 border-green-500/20';
    case 'in_progress':
      return 'bg-accent-yellow/10 border-accent-yellow/30';
    case 'skipped':
      return 'bg-muted-gray/10 border-muted-gray/20';
    default:
      return 'bg-transparent border-muted-gray/10';
  }
};

export const ScheduleItemRow: React.FC<ScheduleItemRowProps> = ({
  item,
  canEdit,
  onStartActivity,
  onCompleteActivity,
  onSkipActivity,
  onStartScene,
  onClickScene,
  isLoading,
  showProjectedTime = true,
  showProjectedTimes,
  showActualTimes = false,
  timezone,
}) => {
  // Normalize prop names
  const showProjected = showProjectedTimes ?? showProjectedTime;
  const TypeIcon = getTypeIcon(item.type);
  const typeColor = getTypeColor(item.type);
  const isCurrent = item.is_current || item.status === 'in_progress';
  const isCompleted = item.status === 'completed';
  const isSkipped = item.status === 'skipped';
  const isPending = item.status === 'pending';

  // Calculate variance display
  const variance = item.variance_from_plan ?? 0;
  const hasVariance = variance !== 0;
  const isAhead = variance > 0;
  const varianceText = hasVariance
    ? `${isAhead ? '-' : '+'}${Math.abs(variance)}m`
    : null;

  // Determine if projected time differs from planned
  const hasProjectedTime = showProjected && item.projected_start_time;
  const projectedDiffers = hasProjectedTime &&
    item.projected_start_time !== item.planned_start_time;

  // Can this item be started?
  const canStartItem = isPending && canEdit && item.source_type !== 'imported';
  const isScene = item.type === 'scene';
  const isActivity = !isScene && item.source_type === 'schedule_block';

  return (
    <div
      className={cn(
        'flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg border transition-colors',
        getStatusBgColor(item.status, isCurrent),
        isScene && onClickScene && 'cursor-pointer hover:bg-soft-black/50',
        isSkipped && 'opacity-50'
      )}
      onClick={isScene && onClickScene && item.source_id ? () => onClickScene(item.source_id!) : undefined}
    >
      {/* Status indicator */}
      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
        {isCompleted ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : isCurrent ? (
          <ChevronRight className="w-4 h-4 text-accent-yellow animate-pulse" />
        ) : isSkipped ? (
          <SkipForward className="w-4 h-4 text-muted-gray" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-muted-gray/30" />
        )}
      </div>

      {/* Time */}
      <div className="flex-shrink-0 w-14 sm:w-20 text-right">
        {showActualTimes && isCompleted && item.actual_start_time ? (
          <div className="space-y-0.5">
            <div className="text-xs sm:text-sm text-green-400">
              {formatScheduleTime(item.actual_start_time, timezone)}
            </div>
            <div className="text-xs text-muted-gray line-through hidden sm:block">
              {formatScheduleTime(item.planned_start_time, timezone)}
            </div>
          </div>
        ) : isCompleted && item.projected_start_time ? (
          <span className="text-xs sm:text-sm text-muted-gray">
            {formatScheduleTime(item.projected_start_time, timezone)}
          </span>
        ) : hasProjectedTime ? (
          <div className="space-y-0.5">
            <div className={cn(
              'text-xs sm:text-sm',
              isCurrent ? 'text-accent-yellow font-medium'
                : projectedDiffers ? 'text-bone-white'
                : 'text-muted-gray'
            )}>
              {formatScheduleTime(item.projected_start_time!, timezone)}
            </div>
            {projectedDiffers && (
              <div className="text-xs text-muted-gray line-through hidden sm:block">
                {formatScheduleTime(item.planned_start_time, timezone)}
              </div>
            )}
          </div>
        ) : (
          <span className={cn('text-xs sm:text-sm', isCurrent ? 'text-accent-yellow font-medium' : 'text-muted-gray')}>
            {formatScheduleTime(item.planned_start_time, timezone)}
          </span>
        )}
      </div>

      {/* Type icon */}
      <TypeIcon className={cn('w-4 h-4 flex-shrink-0', typeColor)} />

      {/* Name and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium truncate',
            isCompleted && 'text-muted-gray',
            isCurrent && 'text-accent-yellow',
            isSkipped && 'line-through',
            !isCompleted && !isCurrent && !isSkipped && 'text-bone-white'
          )}>
            {item.name}
          </span>
          {item.description && (
            <span className="text-sm text-muted-gray truncate hidden sm:inline">
              - {item.description}
            </span>
          )}
        </div>
      </div>

      {/* Duration/Time Info */}
      <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
        {isCompleted && item.actual_duration_minutes !== undefined ? (
          <>
            <span className="text-muted-gray">
              {item.actual_duration_minutes}m
            </span>
            {varianceText && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs hidden sm:inline-flex',
                  isAhead ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'
                )}
              >
                {varianceText}
              </Badge>
            )}
          </>
        ) : isCurrent ? (
          <Badge variant="outline" className="text-accent-yellow border-accent-yellow/30 text-xs">
            <span className="hidden sm:inline">IN PROGRESS</span>
            <span className="sm:hidden">LIVE</span>
          </Badge>
        ) : isPending && hasProjectedTime ? (
          <div className="flex items-center gap-1">
            <span className="text-muted-gray">
              {item.planned_duration_minutes}m
            </span>
            {hasVariance && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs hidden sm:inline-flex',
                  isAhead ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'
                )}
              >
                {varianceText}
              </Badge>
            )}
            {!hasVariance && (
              <span className="text-xs text-muted-gray/50 hidden sm:inline">on time</span>
            )}
          </div>
        ) : (
          <span className="text-muted-gray">
            {item.planned_duration_minutes}m
          </span>
        )}
      </div>

      {/* Actions */}
      {canStartItem && !isLoading && (
        <div className="flex-shrink-0 flex items-center gap-1">
          {isScene && item.source_id && onStartScene && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onStartScene(item.source_id!);
              }}
              className="h-7 w-7 p-0 hover:bg-accent-yellow/20"
            >
              <Play className="w-3 h-3 text-accent-yellow" />
            </Button>
          )}
          {isActivity && item.source_id && onStartActivity && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onStartActivity(item.source_id!);
              }}
              className={cn('h-7 w-7 p-0', `hover:${typeColor.replace('text-', 'bg-')}/20`)}
            >
              <Play className={cn('w-3 h-3', typeColor)} />
            </Button>
          )}
        </div>
      )}

      {/* In-progress actions */}
      {isCurrent && canEdit && !isLoading && (
        <div className="flex-shrink-0 flex items-center gap-1">
          {isActivity && item.source_id && onCompleteActivity && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onCompleteActivity(item.source_id!);
                }}
                className="h-7 w-7 p-0 hover:bg-green-500/20"
              >
                <Check className="w-3 h-3 text-green-400" />
              </Button>
              {onSkipActivity && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkipActivity(item.source_id!);
                  }}
                  className="h-7 w-7 p-0 hover:bg-red-500/20"
                >
                  <SkipForward className="w-3 h-3 text-red-400" />
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
