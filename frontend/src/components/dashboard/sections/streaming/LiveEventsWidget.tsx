/**
 * LiveEventsWidget
 * Shows live and upcoming events/watch parties
 */

import { Link } from 'react-router-dom';
import { useLiveEvents, useUpcomingEvents } from '@/hooks/watch';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Radio, Calendar, Clock, Users, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';
import type { LiveEvent, EventSummary } from '@/types/watch';

// Format time until event
function formatTimeUntil(dateStr: string): string {
  const now = new Date();
  const eventDate = new Date(dateStr);
  const diffMs = eventDate.getTime() - now.getTime();

  if (diffMs < 0) return 'Started';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Format event time
function formatEventTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Event type labels
const EVENT_TYPE_LABELS: Record<string, string> = {
  premiere: 'Premiere',
  watch_party: 'Watch Party',
  qa: 'Q&A',
  behind_scenes: 'Behind the Scenes',
  announcement: 'Announcement',
  live_stream: 'Live Stream',
  table_read: 'Table Read',
  commentary: 'Commentary',
  other: 'Event',
};

export function LiveEventsWidget({ className = '' }: SectionProps) {
  const { data: liveEvents, isLoading: liveLoading } = useLiveEvents();
  const { data: upcomingEvents, isLoading: upcomingLoading } = useUpcomingEvents({ limit: 4 });

  const isLoading = liveLoading || upcomingLoading;

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  const live = liveEvents || [];
  const upcoming = (upcomingEvents?.events || []).slice(0, 3);
  const hasContent = live.length > 0 || upcoming.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-primary-red/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-red" />
          <h3 className="font-heading text-bone-white">Live & Upcoming</h3>
          {live.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 rounded-full text-xs text-red-400">
              <Radio className="w-3 h-3 animate-pulse" />
              {live.length} Live
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/watch/events">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Live Events */}
      {live.length > 0 && (
        <div className="space-y-2 mb-4">
          {live.map((event: LiveEvent) => (
            <Link
              key={event.id}
              to={`/watch/events/${event.id}`}
              className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-muted-gray/20">
                {event.thumbnail_url ? (
                  <img
                    src={event.thumbnail_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Radio className="w-6 h-6 text-red-500" />
                  </div>
                )}
                <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 bg-red-500 rounded text-[10px] text-white font-medium">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  LIVE
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-bone-white truncate">{event.title}</p>
                <p className="text-xs text-muted-gray truncate">
                  {event.world?.title || EVENT_TYPE_LABELS[event.event_type]}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-red-400">
                  <Users className="w-3 h-3" />
                  <span>{event.peak_concurrent_viewers || 0} watching</span>
                </div>
              </div>

              {/* Watch Button */}
              <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                Watch
              </Button>
            </Link>
          ))}
        </div>
      )}

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          {live.length > 0 && (
            <p className="text-xs text-muted-gray uppercase tracking-wider mb-2">Coming Up</p>
          )}
          {upcoming.map((event: EventSummary) => (
            <Link
              key={event.id}
              to={`/watch/events/${event.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted-gray/10 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-muted-gray/20">
                {event.thumbnail_url ? (
                  <img
                    src={event.thumbnail_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-muted-gray" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-bone-white text-sm truncate">{event.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-gray">
                  <Clock className="w-3 h-3" />
                  <span>{formatEventTime(event.scheduled_start)}</span>
                </div>
              </div>

              {/* Countdown */}
              <div className="text-right">
                <span className="text-sm font-medium text-accent-yellow">
                  {formatTimeUntil(event.scheduled_start)}
                </span>
                {event.rsvp_count > 0 && (
                  <p className="text-xs text-muted-gray">{event.rsvp_count} interested</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default LiveEventsWidget;
