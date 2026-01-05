/**
 * ScheduleWidget
 * Shows upcoming shoot days across all user's projects
 */

import { Link } from 'react-router-dom';
import { useScheduleSummary } from '@/hooks/backlot';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, AlertTriangle, ChevronRight, Film } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Format date to readable string
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Format call time
function formatCallTime(time: string | null): string {
  if (!time) return 'TBD';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function ScheduleWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useScheduleSummary();

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`p-4 bg-charcoal-black border border-red-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-5 h-5" />
          <span>Error loading schedule: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`p-4 bg-charcoal-black border border-muted-gray/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-muted-gray">
          <Calendar className="w-5 h-5" />
          <span>No schedule data</span>
        </div>
      </div>
    );
  }

  const { upcoming_shoot_days, today_shoot, conflicts, next_7_days_count } = data;

  // If no upcoming shoots, show empty state
  if (!today_shoot && upcoming_shoot_days.length === 0) {
    return (
      <div className={`p-4 bg-charcoal-black border border-blue-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="font-heading text-bone-white">Production Schedule</h3>
        </div>
        <p className="text-sm text-muted-gray">No upcoming shoot days scheduled.</p>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link to="/backlot">View Projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-blue-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="font-heading text-bone-white">Production Schedule</h3>
          {next_7_days_count > 0 && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {next_7_days_count} this week
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/backlot">
            All Projects
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <div className="mb-4 p-3 bg-primary-red/10 border border-primary-red/30 rounded-lg">
          <div className="flex items-center gap-2 text-primary-red">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Schedule Conflict</span>
          </div>
          <p className="text-sm text-muted-gray mt-1">
            {conflicts[0].project_names.join(' & ')} on {formatDate(conflicts[0].date)}
          </p>
        </div>
      )}

      {/* Today's Shoot - Featured */}
      {today_shoot && (
        <Link
          to={`/backlot/${today_shoot.project_slug}/schedule`}
          className="block mb-4 p-4 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg hover:border-accent-yellow/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-accent-yellow text-charcoal-black">
                  SHOOTING TODAY
                </Badge>
                <span className="text-sm text-muted-gray">Day {today_shoot.day_number}</span>
              </div>
              <h4 className="font-medium text-bone-white">
                {today_shoot.project_name}
              </h4>
              {today_shoot.title && (
                <p className="text-sm text-muted-gray">{today_shoot.title}</p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-accent-yellow">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {formatCallTime(today_shoot.general_call_time)}
                </span>
              </div>
              {today_shoot.scene_count > 0 && (
                <span className="text-xs text-muted-gray">
                  {today_shoot.scene_count} scenes
                </span>
              )}
            </div>
          </div>
          {today_shoot.location && (
            <div className="flex items-center gap-1 mt-2 text-sm text-muted-gray">
              <MapPin className="w-3 h-3" />
              <span>{today_shoot.location}</span>
            </div>
          )}
        </Link>
      )}

      {/* Upcoming Shoot Days */}
      {upcoming_shoot_days.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-gray uppercase tracking-wider">Upcoming</p>
          {upcoming_shoot_days.slice(0, 3).map(day => (
            <Link
              key={day.id}
              to={`/backlot/${day.project_slug}/schedule`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted-gray/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted-gray/20 flex items-center justify-center">
                  <Film className="w-5 h-5 text-muted-gray" />
                </div>
                <div>
                  <p className="font-medium text-bone-white text-sm">
                    {day.project_name} - Day {day.day_number}
                  </p>
                  <p className="text-xs text-muted-gray">
                    {day.title || `${day.scene_count} scenes`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-bone-white">{formatDate(day.date)}</p>
                <p className="text-xs text-muted-gray">
                  {formatCallTime(day.general_call_time)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScheduleWidget;
