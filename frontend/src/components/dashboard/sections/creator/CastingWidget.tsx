/**
 * CastingWidget
 * Shows casting pipeline status across all user's projects
 */

import { Link } from 'react-router-dom';
import { useCastingSummary } from '@/hooks/backlot';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Briefcase, Clock, Calendar, ChevronRight, UserCheck, AlertCircle } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Format date to relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format date for auditions
function formatAuditionDate(dateStr: string, timeStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let dayPart: string;
  if (date.toDateString() === today.toDateString()) {
    dayPart = 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    dayPart = 'Tomorrow';
  } else {
    dayPart = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  return `${dayPart} at ${timeStr}`;
}

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CastingWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useCastingSummary();

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error) {
    return (
      <div className={`p-4 bg-charcoal-black border border-red-500/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-5 h-5" />
          <span>Error loading casting: {error.message}</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`p-4 bg-charcoal-black border border-muted-gray/30 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-muted-gray">
          <Users className="w-5 h-5" />
          <span>No casting data</span>
        </div>
      </div>
    );
  }

  const { open_roles_count, pending_applications, recent_applications, auditions_scheduled } = data;

  // If nothing to show, don't render
  if (open_roles_count === 0 && pending_applications === 0 && auditions_scheduled.length === 0) {
    return null;
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-green-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-green-400" />
          <h3 className="font-heading text-bone-white">Casting Pipeline</h3>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/backlot">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="p-3 bg-muted-gray/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-green-400" />
            <span className="text-2xl font-bold text-bone-white">{open_roles_count}</span>
          </div>
          <p className="text-xs text-muted-gray mt-1">Open Roles</p>
        </div>
        <div className="p-3 bg-muted-gray/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-yellow" />
            <span className="text-2xl font-bold text-bone-white">{pending_applications}</span>
          </div>
          <p className="text-xs text-muted-gray mt-1">Pending Review</p>
        </div>
      </div>

      {/* Upcoming Auditions */}
      {auditions_scheduled.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-gray uppercase tracking-wider mb-2">Upcoming Auditions</p>
          <div className="space-y-2">
            {auditions_scheduled.slice(0, 2).map(audition => (
              <div
                key={audition.id}
                className="flex items-center justify-between p-2 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg"
              >
                <div>
                  <p className="font-medium text-bone-white text-sm">{audition.role_name}</p>
                  <p className="text-xs text-muted-gray">{audition.project_name}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-accent-yellow text-sm">
                    <Calendar className="w-3 h-3" />
                    {formatAuditionDate(audition.date, audition.time)}
                  </div>
                  <p className="text-xs text-muted-gray">
                    {audition.applicant_count} applicant{audition.applicant_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Applications */}
      {recent_applications.length > 0 && (
        <div>
          <p className="text-xs text-muted-gray uppercase tracking-wider mb-2">Recent Applications</p>
          <div className="space-y-2">
            {recent_applications.slice(0, 4).map(app => (
              <Link
                key={app.id}
                to={`/backlot/${app.project_slug}/casting`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted-gray/10 transition-colors"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={app.applicant_avatar || undefined} />
                  <AvatarFallback className="bg-green-500/20 text-green-400 text-xs">
                    {getInitials(app.applicant_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-bone-white text-sm truncate">
                    {app.applicant_name}
                  </p>
                  <p className="text-xs text-muted-gray truncate">
                    Applied for {app.role_name}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant="outline"
                    className={
                      app.status === 'pending'
                        ? 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30'
                        : app.status === 'approved'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-muted-gray/20 text-muted-gray border-muted-gray/30'
                    }
                  >
                    {app.status === 'pending' ? 'Review' : app.status}
                  </Badge>
                  <p className="text-xs text-muted-gray mt-0.5">
                    {formatRelativeTime(app.applied_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for pending */}
      {pending_applications > 0 && recent_applications.length === 0 && (
        <Button className="w-full bg-green-500 text-white hover:bg-green-600" asChild>
          <Link to="/backlot">
            <UserCheck className="w-4 h-4 mr-2" />
            Review {pending_applications} Application{pending_applications !== 1 ? 's' : ''}
          </Link>
        </Button>
      )}
    </div>
  );
}

export default CastingWidget;
