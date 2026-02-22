import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useMediaEvents } from '@/hooks/media';
import EventCard from '@/components/media/EventCard';

const EVENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'content_shoot', label: 'Content Shoot' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'premiere', label: 'Premiere' },
  { value: 'watch_party', label: 'Watch Party' },
  { value: 'interview', label: 'Interview' },
  { value: 'photoshoot', label: 'Photoshoot' },
  { value: 'livestream', label: 'Livestream' },
  { value: 'other', label: 'Other' },
];

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const Events = () => {
  const { hasAnyRole } = usePermissions();
  const isTeam = hasAnyRole(['media_team', 'admin', 'superadmin']);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useMediaEvents({
    status: statusFilter || undefined,
    event_type: typeFilter || undefined,
    search: search || undefined,
    limit: 50,
  });

  const events = data?.events || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading text-accent-yellow">Events</h1>
        {isTeam && (
          <Link to="/media/events/new">
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80">
              <Plus className="h-4 w-4 mr-2" /> New Event
            </Button>
          </Link>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === tab.value
                ? 'bg-accent-yellow text-charcoal-black'
                : 'text-muted-gray hover:bg-muted-gray/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-9 pr-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
        >
          {EVENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-gray">No events found</p>
          {isTeam && (
            <Link to="/media/events/new" className="text-accent-yellow text-sm hover:underline mt-2 inline-block">
              Create your first event
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event: any) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Events;
