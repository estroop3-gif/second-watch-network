/**
 * Live Events Page
 * Shows live streams and upcoming events
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useLiveEvents,
  useUpcomingEvents,
  useMyUpcomingEvents,
  useEventRsvp,
} from '@/hooks/watch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Radio,
  Calendar,
  Clock,
  Users,
  Bell,
  BellOff,
  ChevronLeft,
  Play,
  CalendarCheck,
} from 'lucide-react';
import type { LiveEvent } from '@/types/watch';

export function LiveEventsPage() {
  const { session } = useAuth();

  const { data: liveEvents, isLoading: loadingLive } = useLiveEvents();
  const { data: upcomingData, isLoading: loadingUpcoming } = useUpcomingEvents({ limit: 20 });
  const { data: myEvents, isLoading: loadingMy } = useMyUpcomingEvents(10);

  const upcomingEvents = upcomingData?.events || [];

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="px-4 md:px-8 py-6 border-b border-bone-white/10">
        <div className="flex items-center gap-4">
          <Link
            to="/watch"
            className="text-muted-gray hover:text-bone-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-heading text-bone-white">Events</h1>
        </div>
      </div>

      {/* Live Now Banner */}
      {liveEvents && liveEvents.length > 0 && (
        <div className="px-4 md:px-8 py-6 bg-primary-red/10 border-b border-primary-red/30">
          <div className="flex items-center gap-3 mb-4">
            <Radio className="w-6 h-6 text-primary-red animate-pulse" />
            <h2 className="text-xl font-heading text-bone-white">Live Now</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {liveEvents.map((event) => (
              <LiveEventCard key={event.id} event={event} isLive />
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 md:px-8 py-8">
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="bg-charcoal-black/50 border border-bone-white/10">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            {session && <TabsTrigger value="my-events">My Events</TabsTrigger>}
          </TabsList>

          {/* Upcoming Events */}
          <TabsContent value="upcoming" className="space-y-4">
            {loadingUpcoming ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-lg" />
                ))}
              </div>
            ) : upcomingEvents.length > 0 ? (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Calendar className="w-16 h-16 text-muted-gray mx-auto mb-4" />
                <h2 className="text-xl font-heading text-bone-white mb-2">
                  No Upcoming Events
                </h2>
                <p className="text-muted-gray">
                  Check back later for premieres, watch parties, and more.
                </p>
              </div>
            )}
          </TabsContent>

          {/* My Events */}
          {session && (
            <TabsContent value="my-events" className="space-y-4">
              {loadingMy ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-lg" />
                  ))}
                </div>
              ) : myEvents && myEvents.length > 0 ? (
                <div className="space-y-4">
                  {myEvents.map((event) => (
                    <EventCard key={event.id} event={event} showRsvpStatus />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <CalendarCheck className="w-16 h-16 text-muted-gray mx-auto mb-4" />
                  <h2 className="text-xl font-heading text-bone-white mb-2">
                    No RSVPs Yet
                  </h2>
                  <p className="text-muted-gray mb-4">
                    RSVP to events to see them here.
                  </p>
                  <Button asChild variant="outline">
                    <Link to="/watch/events?tab=upcoming">Browse Events</Link>
                  </Button>
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// Live Event Card (compact, for banner)
function LiveEventCard({ event, isLive }: { event: LiveEvent; isLive?: boolean }) {
  return (
    <Link
      to={`/watch/events/${event.id}`}
      className="block p-4 rounded-lg bg-charcoal-black/80 border border-primary-red/50 hover:border-primary-red transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isLive && (
              <Badge className="bg-primary-red text-white">
                <Radio className="w-3 h-3 mr-1 animate-pulse" />
                LIVE
              </Badge>
            )}
            <Badge variant="outline" className="capitalize text-bone-white/70">
              {event.event_type.replace('_', ' ')}
            </Badge>
          </div>
          <h3 className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors line-clamp-1">
            {event.title}
          </h3>
          {event.world && (
            <p className="text-sm text-muted-gray mt-1">{event.world.title}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-gray">
          <Users className="w-4 h-4" />
          <span>{event.viewer_count?.toLocaleString() || 0}</span>
        </div>
      </div>
      <Button
        className="w-full mt-3 bg-primary-red hover:bg-primary-red/90 text-white"
        size="sm"
      >
        <Play className="w-4 h-4 mr-2" />
        Watch Now
      </Button>
    </Link>
  );
}

// Regular Event Card
function EventCard({
  event,
  showRsvpStatus,
}: {
  event: LiveEvent;
  showRsvpStatus?: boolean;
}) {
  const { session } = useAuth();
  const { rsvp, cancelRsvp, isRsvping, isCanceling } = useEventRsvp();

  const startDate = new Date(event.scheduled_start);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === startDate.toDateString();

  const formatDate = () => {
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return startDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleRsvp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!session) return;

    if (event.has_rsvp) {
      cancelRsvp(event.id);
    } else {
      rsvp({ eventId: event.id, status: 'going' });
    }
  };

  return (
    <Link
      to={`/watch/events/${event.id}`}
      className="block p-4 rounded-lg bg-bone-white/5 hover:bg-bone-white/10 transition-colors group"
    >
      <div className="flex gap-4">
        {/* Date Block */}
        <div className="flex-shrink-0 w-16 text-center">
          <div className="text-xs text-accent-yellow uppercase font-medium">
            {formatDate()}
          </div>
          <div className="text-2xl font-heading text-bone-white">
            {startDate.getDate()}
          </div>
          <div className="text-xs text-muted-gray">
            {startDate.toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
        </div>

        {/* Event Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="capitalize text-bone-white/70">
              {event.event_type.replace('_', ' ')}
            </Badge>
            {showRsvpStatus && event.has_rsvp && (
              <Badge className="bg-green-600/20 text-green-400">
                <CalendarCheck className="w-3 h-3 mr-1" />
                Going
              </Badge>
            )}
          </div>
          <h3 className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors">
            {event.title}
          </h3>
          {event.world && (
            <p className="text-sm text-muted-gray mt-1">{event.world.title}</p>
          )}
          {event.description && (
            <p className="text-sm text-bone-white/70 mt-2 line-clamp-2">
              {event.description}
            </p>
          )}

          {/* Stats & RSVP */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4 text-sm text-muted-gray">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {event.rsvp_count || 0} going
              </span>
              {event.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {event.duration_minutes} min
                </span>
              )}
            </div>

            {session && (
              <Button
                variant={event.has_rsvp ? 'outline' : 'default'}
                size="sm"
                onClick={handleRsvp}
                disabled={isRsvping || isCanceling}
                className={cn(
                  event.has_rsvp
                    ? 'border-accent-yellow text-accent-yellow hover:bg-accent-yellow/10'
                    : 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
                )}
              >
                {event.has_rsvp ? (
                  <>
                    <BellOff className="w-4 h-4 mr-1" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-1" />
                    RSVP
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        {event.thumbnail_url && (
          <div className="hidden md:block flex-shrink-0 w-40 aspect-video rounded overflow-hidden">
            <img
              src={event.thumbnail_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </Link>
  );
}

export default LiveEventsPage;
