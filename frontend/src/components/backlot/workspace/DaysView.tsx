/**
 * DaysView - Production days list view
 * Shows all shoot days with call sheet, dailies, and task status
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  MapPin,
  Clock,
  FileText,
  Play,
  CheckSquare,
  Users,
  ChevronRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useDaysList, DayListItem, formatDate, formatCallTime, getDayStatus } from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { format, isToday, parseISO } from 'date-fns';

interface DaysViewProps {
  projectId: string;
  canEdit: boolean;
  onSelectDay: (day: DayListItem) => void;
}

export default function DaysView({ projectId, canEdit, onSelectDay }: DaysViewProps) {
  const { data: days, isLoading } = useDaysList(projectId);

  // Calculate summary stats
  const totalDays = days?.length || 0;
  const completedDays = days?.filter(d => d.is_completed).length || 0;
  const upcomingDays = days?.filter(d => !d.is_completed && d.has_call_sheet).length || 0;
  const planningDays = days?.filter(d => !d.is_completed && !d.has_call_sheet).length || 0;

  // Find today's shoot day
  const todayShoot = days?.find(d => isToday(parseISO(d.date)));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading text-bone-white">Shoot Days</h2>
        <p className="text-sm text-muted-gray">
          {totalDays} days &middot; {completedDays} wrapped
        </p>
      </div>

      {/* Today's Shoot Banner */}
      {todayShoot && (
        <Card
          className="bg-gradient-to-r from-green-500/20 to-green-600/10 border-green-500/30 cursor-pointer hover:border-green-400/50 transition-colors"
          onClick={() => onSelectDay(todayShoot)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-green-500/30">
                  <span className="text-[10px] font-bold text-green-300 uppercase">Today</span>
                  <span className="text-2xl font-bold text-green-300">{todayShoot.day_number}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-300 text-lg">Shooting Today</span>
                    {todayShoot.title && (
                      <span className="text-green-400/70">— {todayShoot.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-green-400/80">
                    {todayShoot.general_call_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Call: {formatCallTime(todayShoot.general_call_time)}
                      </span>
                    )}
                    {todayShoot.location_name && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {todayShoot.location_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-green-400">View Details</span>
                <ChevronRight className="w-5 h-5 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{totalDays}</p>
                <p className="text-xs text-muted-gray">Total Days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{completedDays}</p>
                <p className="text-xs text-muted-gray">Wrapped</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-yellow/10">
                <FileText className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{upcomingDays}</p>
                <p className="text-xs text-muted-gray">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted-gray/10">
                <Circle className="w-5 h-5 text-muted-gray" />
              </div>
              <div>
                <p className="text-2xl font-bold text-bone-white">{planningDays}</p>
                <p className="text-xs text-muted-gray">Planning</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Days List */}
      <div className="space-y-3">
        {days?.map((day) => {
          const status = getDayStatus(day);
          const dayIsToday = isToday(parseISO(day.date));
          return (
            <Card
              key={day.id}
              className={cn(
                'bg-charcoal-black cursor-pointer hover:border-muted-gray/40 transition-colors',
                dayIsToday
                  ? 'border-green-500/50 ring-1 ring-green-500/20'
                  : 'border-muted-gray/20'
              )}
              onClick={() => onSelectDay(day)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Day Number */}
                    <div className={cn(
                      'flex flex-col items-center justify-center w-16 h-16 rounded-lg',
                      dayIsToday ? 'bg-green-500/20' : 'bg-muted-gray/10'
                    )}>
                      {dayIsToday && (
                        <span className="text-[10px] font-bold text-green-400 uppercase">Today</span>
                      )}
                      {!dayIsToday && (
                        <span className="text-xs text-muted-gray uppercase">Day</span>
                      )}
                      <span className={cn(
                        'text-2xl font-bold',
                        dayIsToday ? 'text-green-400' : 'text-bone-white'
                      )}>{day.day_number}</span>
                    </div>

                    {/* Day Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-bone-white">
                          {formatDate(day.date)}
                        </span>
                        {dayIsToday && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            Shooting Today
                          </Badge>
                        )}
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                      {day.title && (
                        <p className="text-sm text-muted-gray mt-0.5">{day.title}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-gray">
                        {day.general_call_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatCallTime(day.general_call_time)}
                          </span>
                        )}
                        {day.location_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {day.location_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats & Arrow */}
                  <div className="flex items-center gap-6">
                    {/* Indicators */}
                    <div className="flex items-center gap-3">
                      {day.has_call_sheet && (
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                          <FileText className="w-3 h-3 mr-1" />
                          Call Sheet
                        </Badge>
                      )}
                      {day.has_dailies && (
                        <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                          <Play className="w-3 h-3 mr-1" />
                          Dailies
                        </Badge>
                      )}
                      {day.task_count > 0 && (
                        <Badge variant="outline" className="border-green-500/30 text-green-400">
                          <CheckSquare className="w-3 h-3 mr-1" />
                          {day.task_count}
                        </Badge>
                      )}
                      {day.crew_scheduled_count > 0 && (
                        <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                          <Users className="w-3 h-3 mr-1" />
                          {day.crew_scheduled_count}
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-gray" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!days || days.length === 0) && (
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="py-12 text-center text-muted-gray">
              No production days scheduled. Create a schedule to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
