/**
 * ScheduleDeviationCard - Prominent display of dual variance metrics
 *
 * Shows TWO types of variance:
 * 1. Cumulative Variance - Total time over/under from all completed items
 * 2. Real-Time Deviation - Comparison of current time to where schedule says we should be
 *
 * Also shows:
 * - What should be happening now vs what is happening
 * - Quick action to view suggestions
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { HourScheduleBlock, HotSetSceneLog, ProjectedScheduleItem } from '@/types/backlot';
import { formatDeviation, formatScheduleTime } from '@/hooks/backlot/useHotSet';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingDown,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Timer,
  Activity,
} from 'lucide-react';

interface ScheduleDeviationCardProps {
  // Legacy prop (schedule_deviation_minutes from old system)
  deviationMinutes?: number;
  // NEW: Dual variance metrics
  cumulativeVariance?: number;  // Total variance accumulated (positive = ahead, negative = behind)
  realtimeDeviation?: number;   // Current position vs schedule (negative = behind, positive = ahead)
  // Context
  currentExpectedBlock?: HourScheduleBlock | null;
  currentItem?: ProjectedScheduleItem | null;  // NEW: From projected schedule
  currentScene?: HotSetSceneLog | null;
  onViewSuggestions?: () => void;
  hasSuggestions?: boolean;
  timezone?: string | null;
}

export const ScheduleDeviationCard: React.FC<ScheduleDeviationCardProps> = ({
  deviationMinutes,
  cumulativeVariance,
  realtimeDeviation,
  currentExpectedBlock,
  currentItem,
  currentScene,
  onViewSuggestions,
  hasSuggestions,
  timezone,
}) => {
  // Use new metrics if available, fall back to legacy
  const cumulative = cumulativeVariance ?? deviationMinutes ?? 0;
  const realtime = realtimeDeviation;

  // For cumulative: negative = behind (spent more time than planned)
  // For realtime: negative = behind schedule position
  const isBehind = cumulative < 0 || (realtime !== undefined && realtime < 0);
  const isAhead = cumulative > 0 || (realtime !== undefined && realtime > 0);
  const isOnTime = Math.abs(cumulative) <= 5 && (realtime === undefined || Math.abs(realtime) <= 5);

  // Get status colors and icons
  const getStatusConfig = () => {
    if (isOnTime) {
      return {
        bgColor: 'bg-green-500/10 border-green-500/30',
        textColor: 'text-green-400',
        icon: <CheckCircle2 className="w-8 h-8 text-green-400" />,
        label: 'ON SCHEDULE',
      };
    }
    if (isAhead) {
      return {
        bgColor: 'bg-green-500/10 border-green-500/30',
        textColor: 'text-green-400',
        icon: <TrendingUp className="w-8 h-8 text-green-400" />,
        label: 'AHEAD OF SCHEDULE',
      };
    }
    if (Math.abs(cumulative) > 30 || (realtime && Math.abs(realtime) > 30)) {
      return {
        bgColor: 'bg-red-500/10 border-red-500/30',
        textColor: 'text-red-400',
        icon: <AlertTriangle className="w-8 h-8 text-red-400" />,
        label: 'SIGNIFICANTLY BEHIND',
      };
    }
    return {
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
      textColor: 'text-yellow-400',
      icon: <TrendingDown className="w-8 h-8 text-yellow-400" />,
      label: 'BEHIND SCHEDULE',
    };
  };

  const config = getStatusConfig();

  // Format expected block info from new or old system
  const expectedInfo = currentItem
    ? currentItem.name + (currentItem.description ? ` (${currentItem.description})` : '')
    : currentExpectedBlock
    ? currentExpectedBlock.type === 'scene'
      ? `Scene ${currentExpectedBlock.scene_number || ''} (${currentExpectedBlock.scene_slugline || ''})`
      : currentExpectedBlock.activity_name ||
        currentExpectedBlock.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    : null;

  // Format actual block info
  const actualInfo = currentItem && currentItem.status === 'in_progress'
    ? currentItem.name + (currentItem.description ? ` (${currentItem.description})` : '')
    : currentScene
    ? `Scene ${currentScene.scene_number || ''} (${currentScene.set_name || currentScene.description || ''})`
    : 'No activity in progress';

  // Check if we have dual variance metrics
  const hasDualMetrics = cumulativeVariance !== undefined && realtimeDeviation !== undefined;

  return (
    <Card className={cn('border transition-colors', config.bgColor)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className="flex-shrink-0">{config.icon}</div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Status Label */}
            <div className="flex items-center gap-2 mb-3">
              <span className={cn('text-sm font-semibold uppercase', config.textColor)}>
                {config.label}
              </span>
            </div>

            {/* Dual Variance Metrics (NEW) */}
            {hasDualMetrics ? (
              <div className="grid grid-cols-2 gap-4 mb-3">
                {/* Cumulative Variance */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5 text-muted-gray" />
                    <span className="text-xs text-muted-gray uppercase font-medium">
                      Cumulative Variance
                    </span>
                  </div>
                  <div className={cn('text-xl font-bold', config.textColor)}>
                    {cumulative === 0 ? (
                      'On Pace'
                    ) : (
                      <>
                        {cumulative > 0 ? '+' : ''}{cumulative}m
                        <span className="text-sm font-normal ml-1">
                          {cumulative > 0 ? 'saved' : 'over'}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-gray">
                    Total time vs planned
                  </p>
                </div>

                {/* Real-Time Deviation */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-muted-gray" />
                    <span className="text-xs text-muted-gray uppercase font-medium">
                      Schedule Position
                    </span>
                  </div>
                  <div className={cn('text-xl font-bold',
                    realtime === undefined || realtime === 0 ? 'text-bone-white' :
                    realtime > 0 ? 'text-green-400' : 'text-red-400'
                  )}>
                    {realtime === undefined || realtime === 0 ? (
                      'On Track'
                    ) : (
                      <>
                        {Math.abs(realtime)}m
                        <span className="text-sm font-normal ml-1">
                          {realtime > 0 ? 'ahead' : 'behind'}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-gray">
                    Current vs expected position
                  </p>
                </div>
              </div>
            ) : (
              /* Legacy single metric display */
              !isOnTime && (
                <div className="mb-3">
                  <span className={cn('text-2xl font-bold', config.textColor)}>
                    {Math.abs(cumulative)}m {isBehind ? 'behind' : 'ahead'}
                  </span>
                </div>
              )
            )}

            {/* Expected vs Actual (only show if different) */}
            {realtime !== undefined && realtime !== 0 && expectedInfo && actualInfo && expectedInfo !== actualInfo && (
              <div className="space-y-1 text-sm pt-2 border-t border-muted-gray/20">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-gray flex-shrink-0" />
                  <span className="text-muted-gray text-xs">Should be on:</span>
                  <span className="text-bone-white text-xs truncate">{expectedInfo}</span>
                  {currentExpectedBlock && (
                    <span className="text-muted-gray text-xs">
                      ({formatScheduleTime(currentExpectedBlock.start_time, timezone)})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-muted-gray flex-shrink-0" />
                  <span className="text-muted-gray text-xs">Currently on:</span>
                  <span className={cn('text-xs truncate',
                    currentItem?.status === 'in_progress' || currentScene ? 'text-accent-yellow' : 'text-muted-gray italic'
                  )}>
                    {actualInfo}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions Button (when behind) */}
          {isBehind && hasSuggestions && onViewSuggestions && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewSuggestions}
              className={cn('flex-shrink-0 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10')}
            >
              <Lightbulb className="w-4 h-4 mr-1" />
              Suggestions
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleDeviationCard;
