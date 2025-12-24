/**
 * TimecardDetailContent - Read-only timecard detail view for approval dialog
 */
import React from 'react';
import { format, parseISO } from 'date-fns';
import { Clock, User, Calendar, Timer, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTimecard, formatWeekRange } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface TimecardDetailContentProps {
  projectId: string;
  timecardId: string;
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', className: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
  submitted: { label: 'Submitted', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  denied: { label: 'Denied', className: 'bg-red-600/20 text-red-500 border-red-600/30' },
} as const;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimecardDetailContent({ projectId, timecardId }: TimecardDetailContentProps) {
  const { data: timecard, isLoading } = useTimecard(projectId, timecardId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!timecard) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Timecard not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[timecard.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const entries = timecard.entries || [];
  const hasOvertime = timecard.total_overtime > 0;

  // Group entries by date
  const entriesByDate = entries.reduce((acc, entry) => {
    const date = entry.shoot_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, typeof entries>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Clock className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bone-white">
              Timecard - {formatWeekRange(timecard.week_start_date)}
            </h3>
            <p className="text-sm text-muted-gray">
              Submitted by {timecard.user_name || 'Unknown'}
            </p>
          </div>
        </div>
        <Badge className={cn('border', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Hours Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Regular Hours</p>
          <p className="text-xl font-semibold text-bone-white flex items-center gap-1">
            <Timer className="w-5 h-5" />
            {timecard.total_hours.toFixed(1)}
          </p>
        </div>

        <div className={cn(
          "rounded-lg p-4 border",
          hasOvertime
            ? "bg-amber-500/10 border-amber-500/20"
            : "bg-charcoal-black/50 border-muted-gray/10"
        )}>
          <p className="text-xs text-muted-gray mb-1">Overtime</p>
          <p className={cn(
            "text-xl font-semibold flex items-center gap-1",
            hasOvertime ? "text-amber-400" : "text-bone-white"
          )}>
            {hasOvertime && <AlertTriangle className="w-4 h-4" />}
            {timecard.total_overtime.toFixed(1)}
          </p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Days Worked</p>
          <p className="text-xl font-semibold text-bone-white flex items-center gap-1">
            <Calendar className="w-5 h-5" />
            {timecard.entry_count}
          </p>
        </div>
      </div>

      {/* Week Period */}
      <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
        <h4 className="text-sm font-medium text-muted-gray mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Week Period
        </h4>
        <p className="text-sm text-bone-white">
          Week starting {format(parseISO(timecard.week_start_date), 'MMMM d, yyyy')}
        </p>
      </div>

      {/* Daily Entries */}
      {entries.length > 0 && (
        <div className="bg-charcoal-black/50 rounded-lg border border-muted-gray/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-muted-gray/10">
            <h4 className="text-sm font-medium text-bone-white">Daily Entries</h4>
          </div>
          <div className="divide-y divide-muted-gray/10">
            {Object.entries(entriesByDate)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, dayEntries]) => {
                const entry = dayEntries[0]; // Take first entry for the day
                const dayOfWeek = new Date(date + 'T00:00:00').getDay();
                const dayName = DAY_NAMES[(dayOfWeek + 6) % 7]; // Adjust for Monday start

                return (
                  <div key={date} className="px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-bone-white">{dayName}</p>
                          <p className="text-xs text-muted-gray">
                            {format(parseISO(date), 'MMM d')}
                          </p>
                          {entry.is_travel_day && (
                            <Badge variant="outline" className="text-xs py-0 px-1 border-blue-500/30 text-blue-400">
                              Travel
                            </Badge>
                          )}
                          {entry.is_prep_day && (
                            <Badge variant="outline" className="text-xs py-0 px-1 border-purple-500/30 text-purple-400">
                              Prep
                            </Badge>
                          )}
                          {entry.is_wrap_day && (
                            <Badge variant="outline" className="text-xs py-0 px-1 border-orange-500/30 text-orange-400">
                              Wrap
                            </Badge>
                          )}
                          {entry.is_holiday && (
                            <Badge variant="outline" className="text-xs py-0 px-1 border-red-500/30 text-red-400">
                              Holiday
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-gray">
                          {entry.call_time && (
                            <span>Call: {format(parseISO(entry.call_time), 'h:mm a')}</span>
                          )}
                          {entry.wrap_time && (
                            <span>Wrap: {format(parseISO(entry.wrap_time), 'h:mm a')}</span>
                          )}
                          {entry.location_name && (
                            <span>@ {entry.location_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-bone-white">
                          {entry.hours_worked?.toFixed(1) || '0'} hrs
                        </p>
                        {entry.overtime_hours && entry.overtime_hours > 0 && (
                          <p className="text-xs text-amber-400">
                            +{entry.overtime_hours.toFixed(1)} OT
                          </p>
                        )}
                        {entry.double_time_hours && entry.double_time_hours > 0 && (
                          <p className="text-xs text-red-400">
                            +{entry.double_time_hours.toFixed(1)} DT
                          </p>
                        )}
                      </div>
                    </div>
                    {entry.notes && (
                      <p className="text-xs text-muted-gray mt-2 pl-2 border-l-2 border-muted-gray/20">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Notes */}
      {timecard.notes && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{timecard.notes}</p>
        </div>
      )}

      {/* Rejection Reason */}
      {timecard.rejection_reason && timecard.status === 'rejected' && (
        <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20">
          <h4 className="text-sm font-medium text-red-400 mb-2">Rejection Reason</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{timecard.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
