/**
 * OTProjectionCard - Real-time overtime projection display
 *
 * Shows:
 * - Projected wrap time
 * - OT hours breakdown (regular/OT1/OT2)
 * - Projected OT cost
 * - Visual indicator of OT status
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OTProjectionData } from '@/types/backlot';
import { formatScheduleTime, formatCurrency } from '@/hooks/backlot';

interface OTProjectionCardProps {
  projection: OTProjectionData | null | undefined;
  dayType: string;
  className?: string;
  timezone?: string | null;
}

export const OTProjectionCard: React.FC<OTProjectionCardProps> = ({
  projection,
  dayType,
  className,
  timezone,
}) => {
  if (!projection) {
    return (
      <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
        <CardContent className="p-4">
          <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide mb-3">
            OT Projection
          </h3>
          <p className="text-sm text-muted-gray">
            Import a schedule to see OT projections
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasOT = projection.ot1_hours > 0 || projection.ot2_hours > 0;
  const hasSignificantOT = projection.ot1_hours > 0.5 || projection.ot2_hours > 0;

  // Status colors based on OT level
  const getStatusColor = () => {
    if (projection.ot2_hours > 0) return 'text-red-400';
    if (projection.ot1_hours > 0.5) return 'text-yellow-400';
    if (projection.ot1_hours > 0) return 'text-yellow-300';
    return 'text-green-400';
  };

  const getStatusBg = () => {
    if (projection.ot2_hours > 0) return 'bg-red-500/10 border-red-500/30';
    if (projection.ot1_hours > 0.5) return 'bg-yellow-500/10 border-yellow-500/30';
    if (projection.ot1_hours > 0) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-green-500/10 border-green-500/30';
  };

  const StatusIcon = hasSignificantOT ? AlertTriangle : CheckCircle;

  const dayTypeLabels: Record<string, string> = {
    '4hr': '4hr Day',
    '8hr': '8hr Day',
    '10hr': '10hr Day',
    '12hr': '12hr Day',
    '6th_day': '6th Day',
    '7th_day': '7th Day',
  };

  return (
    <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
            OT Projection
          </h3>
          <Badge variant="outline" className="text-xs text-muted-gray border-muted-gray/30">
            {dayTypeLabels[dayType] || dayType}
          </Badge>
        </div>

        {/* Projected Wrap Time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-gray">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Proj. Wrap</span>
          </div>
          <span className={cn('text-lg font-bold', getStatusColor())}>
            {formatScheduleTime(projection.projected_wrap_time, timezone)}
          </span>
        </div>

        {/* Total Hours */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-gray">Total Hours</span>
          <span className="text-bone-white font-medium">
            {projection.total_hours.toFixed(1)}h
          </span>
        </div>

        {/* Hours Breakdown */}
        <div className="bg-charcoal-black rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-gray">Regular</span>
            <span className="text-green-400 font-medium">
              {projection.regular_hours.toFixed(1)}h
            </span>
          </div>
          {(projection.ot1_hours > 0 || hasOT) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-gray">OT (1.5x)</span>
              <span className={cn(
                'font-medium',
                projection.ot1_hours > 0 ? 'text-yellow-400' : 'text-muted-gray'
              )}>
                {projection.ot1_hours.toFixed(1)}h
              </span>
            </div>
          )}
          {(projection.ot2_hours > 0 || projection.ot1_hours > 0) && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-gray">DT (2x)</span>
              <span className={cn(
                'font-medium',
                projection.ot2_hours > 0 ? 'text-red-400' : 'text-muted-gray'
              )}>
                {projection.ot2_hours.toFixed(1)}h
              </span>
            </div>
          )}
        </div>

        {/* OT Cost */}
        <div className="flex items-center justify-between pt-2 border-t border-muted-gray/20">
          <div className="flex items-center gap-2 text-muted-gray">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">OT Cost</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('w-4 h-4', getStatusColor())} />
            <span className={cn('text-lg font-bold', getStatusColor())}>
              {formatCurrency(projection.projected_ot_cost)}
            </span>
          </div>
        </div>

        {/* Crew info */}
        {projection.crew_count > 0 && (
          <div className="text-xs text-muted-gray text-right">
            {projection.crew_with_rates} of {projection.crew_count} crew with rates
          </div>
        )}

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge
            variant="outline"
            className={cn('font-medium', getStatusBg(), getStatusColor())}
          >
            {projection.ot2_hours > 0
              ? 'Double Time Projected'
              : projection.ot1_hours > 0
                ? 'Overtime Projected'
                : 'No OT Projected'
            }
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
