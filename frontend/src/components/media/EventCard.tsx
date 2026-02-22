import { Link } from 'react-router-dom';
import { MapPin, Monitor, Users, Clock } from 'lucide-react';
import EventStatusBadge from './EventStatusBadge';
import EventTypeBadge from './EventTypeBadge';

interface EventCardProps {
  event: any;
}

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const EventCard = ({ event }: EventCardProps) => {
  return (
    <Link to={`/media/events/${event.id}`}>
      <div className="p-4 rounded-lg border border-muted-gray/30 bg-charcoal-black hover:bg-muted-gray/10 transition-colors space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-bone-white line-clamp-2">{event.title}</h3>
          <EventStatusBadge status={event.status} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EventTypeBadge type={event.event_type} />
          <span className="text-xs text-muted-gray flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatEventDate(event.start_date)}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-gray">
          <div className="flex items-center gap-3">
            {event.venue_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {event.venue_name}
              </span>
            )}
            {event.is_virtual && (
              <span className="flex items-center gap-1">
                <Monitor className="h-3 w-3" />
                Virtual
              </span>
            )}
          </div>
          {event.attendee_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {event.attendee_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default EventCard;
