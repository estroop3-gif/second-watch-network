/**
 * LiveScheduleView - Full schedule list with live projections
 *
 * Shows:
 * - All schedule items (scenes + activities) in chronological order
 * - Live projections updated as items complete
 * - Auto-scrolls to current item
 * - Color coding by status
 */
import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectedScheduleItem } from '@/types/backlot';
import { ScheduleItemRow } from './ScheduleItemRow';
import { formatScheduleTime } from '@/hooks/backlot';

interface LiveScheduleViewProps {
  items: ProjectedScheduleItem[];
  canEdit: boolean;
  onStartActivity?: (blockId: string) => void;
  onCompleteActivity?: (blockId: string) => void;
  onSkipActivity?: (blockId: string) => void;
  onStartScene?: (sceneId: string) => void;
  onClickScene?: (sceneId: string) => void;
  onImportSchedule?: () => void;
  onImportFromScheduleTab?: () => void;
  isLoading?: boolean;
  isImporting?: boolean;
  className?: string;
  timezone?: string | null;
}

export const LiveScheduleView: React.FC<LiveScheduleViewProps> = ({
  items,
  canEdit,
  onStartActivity,
  onCompleteActivity,
  onSkipActivity,
  onStartScene,
  onClickScene,
  onImportSchedule,
  onImportFromScheduleTab,
  isLoading,
  isImporting,
  className,
  timezone,
}) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current item on mount and when current changes
  useEffect(() => {
    if (currentItemRef.current) {
      currentItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [items]);

  // Calculate summary stats
  const completedCount = items.filter(i => i.status === 'completed').length;
  const totalCount = items.length;
  const currentItem = items.find(i => i.is_current || i.status === 'in_progress');

  // Find projected wrap time (last item's end time)
  const lastItem = items[items.length - 1];
  const projectedWrap = lastItem?.projected_end_time || lastItem?.planned_end_time;

  // Calculate overall variance
  const overallVariance = currentItem?.variance_from_plan ?? 0;
  const isAhead = overallVariance > 0;
  const isBehind = overallVariance < 0;

  if (items.length === 0) {
    return (
      <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
        <CardHeader className="border-b border-muted-gray/20 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="w-4 h-4 text-muted-gray" />
            Full Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          <Calendar className="w-12 h-12 mx-auto text-muted-gray mb-4" />
          <p className="text-muted-gray mb-2">No schedule imported</p>
          <p className="text-sm text-muted-gray/70 mb-4">
            Import a schedule to see the live timeline with projected times
          </p>
          {canEdit && (onImportSchedule || onImportFromScheduleTab) && (
            <div className="flex flex-col gap-2 max-w-xs mx-auto">
              {onImportSchedule && (
                <Button
                  variant="outline"
                  onClick={onImportSchedule}
                  disabled={isImporting}
                  className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isImporting ? 'Importing...' : 'Import Hour Schedule'}
                </Button>
              )}
              {onImportFromScheduleTab && (
                <Button
                  variant="outline"
                  onClick={onImportFromScheduleTab}
                  disabled={isImporting}
                  className="border-muted-gray/50 text-bone-white hover:bg-muted-gray/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isImporting ? 'Importing...' : 'Import from Schedule Tab'}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
      <CardHeader className="border-b border-muted-gray/20 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="w-4 h-4 text-muted-gray" />
            Full Schedule
          </CardTitle>
          <div className="flex items-center gap-3 text-sm">
            {/* Progress */}
            <span className="text-muted-gray">
              {completedCount}/{totalCount}
            </span>

            {/* Variance badge */}
            {overallVariance !== 0 && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  isAhead && 'text-green-400 border-green-500/30',
                  isBehind && 'text-red-400 border-red-500/30'
                )}
              >
                {isAhead ? '-' : '+'}{Math.abs(overallVariance)}m
              </Badge>
            )}

            {/* Projected wrap */}
            {projectedWrap && (
              <div className="flex items-center gap-1 text-muted-gray">
                <Clock className="w-3 h-3" />
                <span className="text-xs">
                  Wrap: {formatScheduleTime(projectedWrap, timezone)}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={scrollAreaRef}
          className="p-3"
        >
          <div className="space-y-1">
            {items.map((item, index) => {
              const isCurrent = item.is_current || item.status === 'in_progress';

              return (
                <div
                  key={item.id || index}
                  ref={isCurrent ? currentItemRef : undefined}
                >
                  <ScheduleItemRow
                    item={item}
                    canEdit={canEdit}
                    onStartActivity={onStartActivity}
                    onCompleteActivity={onCompleteActivity}
                    onSkipActivity={onSkipActivity}
                    onStartScene={onStartScene}
                    onClickScene={onClickScene}
                    isLoading={isLoading}
                    timezone={timezone}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-muted-gray/20 flex items-center gap-4 text-xs text-muted-gray">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-accent-yellow" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-muted-gray/30" />
          <span>Pending</span>
        </div>
      </div>
    </Card>
  );
};
