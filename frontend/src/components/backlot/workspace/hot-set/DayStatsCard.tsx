/**
 * DayStatsCard - Consolidated day statistics for the right panel
 *
 * Shows:
 * - Elapsed time since call
 * - Scene progress (X/Y completed)
 * - Schedule status (ahead/behind/on-time)
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Film, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatElapsedTime, getScheduleStatusColor } from '@/hooks/backlot';

interface DayStatsCardProps {
  elapsedMinutes: number;
  scenesCompleted: number;
  scenesTotal: number;
  scheduleStatus: 'ahead' | 'on_time' | 'behind';
  varianceMinutes: number;
  className?: string;
}

export const DayStatsCard: React.FC<DayStatsCardProps> = ({
  elapsedMinutes,
  scenesCompleted,
  scenesTotal,
  scheduleStatus,
  varianceMinutes,
  className,
}) => {
  const StatusIcon = scheduleStatus === 'ahead'
    ? TrendingUp
    : scheduleStatus === 'behind'
      ? TrendingDown
      : Minus;

  const statusLabels = {
    ahead: 'Ahead',
    on_time: 'On Time',
    behind: 'Behind',
  };

  const statusBgColors = {
    ahead: 'bg-green-500/10 border-green-500/30',
    on_time: 'bg-yellow-500/10 border-yellow-500/30',
    behind: 'bg-red-500/10 border-red-500/30',
  };

  const percentComplete = scenesTotal > 0 ? Math.round((scenesCompleted / scenesTotal) * 100) : 0;

  return (
    <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
          Day Stats
        </h3>

        {/* Elapsed Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-gray">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Elapsed</span>
          </div>
          <span className="text-lg font-bold text-bone-white">
            {formatElapsedTime(elapsedMinutes)}
          </span>
        </div>

        {/* Scene Progress */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-gray">
            <Film className="w-4 h-4" />
            <span className="text-sm">Scenes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-bone-white">
              {scenesCompleted}/{scenesTotal}
            </span>
            <span className="text-sm text-muted-gray">
              ({percentComplete}%)
            </span>
          </div>
        </div>

        {/* Schedule Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-gray">
            <StatusIcon className={cn('w-4 h-4', getScheduleStatusColor(scheduleStatus))} />
            <span className="text-sm">Status</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'font-medium',
              statusBgColors[scheduleStatus],
              getScheduleStatusColor(scheduleStatus)
            )}
          >
            {statusLabels[scheduleStatus]}
            {varianceMinutes !== 0 && (
              <span className="ml-1">
                ({varianceMinutes > 0 ? '+' : ''}{varianceMinutes}m)
              </span>
            )}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mt-2">
          <div className="h-2 bg-charcoal-black rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                scheduleStatus === 'ahead' && 'bg-green-500',
                scheduleStatus === 'on_time' && 'bg-yellow-500',
                scheduleStatus === 'behind' && 'bg-red-500'
              )}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
