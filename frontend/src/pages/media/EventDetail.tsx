import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Monitor, Clock, Users, Calendar, Edit2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useMediaEvent, useUpdateMediaEvent, useDeleteMediaEvent, useUpdateMediaEventStatus,
  useRSVPEvent, useAddEventAttendee, useRemoveEventAttendee,
  useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  useAddAgendaItem, useDeleteAgendaItem,
} from '@/hooks/media';
import EventStatusBadge from '@/components/media/EventStatusBadge';
import EventTypeBadge from '@/components/media/EventTypeBadge';
import AttendeeList from '@/components/media/AttendeeList';
import EventChecklist from '@/components/media/EventChecklist';
import EventAgenda from '@/components/media/EventAgenda';
import EventForm from '@/components/media/EventForm';

const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string }[]> = {
  draft: [{ label: 'Confirm', next: 'confirmed', color: 'bg-blue-600 hover:bg-blue-700' }],
  confirmed: [{ label: 'Start', next: 'in_progress', color: 'bg-amber-600 hover:bg-amber-700' }],
  in_progress: [{ label: 'Complete', next: 'completed', color: 'bg-green-600 hover:bg-green-700' }],
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const TABS = ['Overview', 'Attendees', 'Checklist', 'Agenda'];

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAnyRole } = usePermissions();
  const isTeam = hasAnyRole(['media_team', 'admin', 'superadmin']);

  const [activeTab, setActiveTab] = useState('Overview');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState('');

  const { data, isLoading } = useMediaEvent(id);
  const updateEvent = useUpdateMediaEvent();
  const deleteEvent = useDeleteMediaEvent();
  const updateStatus = useUpdateMediaEventStatus();
  const rsvpEvent = useRSVPEvent();
  const addAttendee = useAddEventAttendee();
  const removeAttendee = useRemoveEventAttendee();
  const addChecklist = useAddChecklistItem();
  const updateChecklist = useUpdateChecklistItem();
  const deleteChecklist = useDeleteChecklistItem();
  const addAgenda = useAddAgendaItem();
  const deleteAgenda = useDeleteAgendaItem();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  const event = data?.event;
  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-gray">Event not found</p>
        <Link to="/media/events" className="text-accent-yellow text-sm hover:underline mt-2 inline-block">
          Back to Events
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (nextStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id: event.id, status: nextStatus });
      toast({ title: `Event ${nextStatus}` });
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await deleteEvent.mutateAsync(event.id);
      toast({ title: 'Event cancelled' });
      navigate('/media/events');
    } catch {
      toast({ title: 'Failed to cancel event', variant: 'destructive' });
    }
  };

  const handleEdit = async (data: any) => {
    try {
      await updateEvent.mutateAsync({ id: event.id, data });
      toast({ title: 'Event updated' });
      setShowEditDialog(false);
    } catch {
      toast({ title: 'Failed to update event', variant: 'destructive' });
    }
  };

  const handleRSVP = async (status: string) => {
    try {
      await rsvpEvent.mutateAsync({ eventId: event.id, rsvp_status: status });
      setRsvpStatus(status);
      toast({ title: `RSVP: ${status}` });
    } catch {
      toast({ title: 'Failed to RSVP', variant: 'destructive' });
    }
  };

  const statusActions = STATUS_ACTIONS[event.status] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/media/events')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-bone-white">{event.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <EventTypeBadge type={event.event_type} />
              <EventStatusBadge status={event.status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isTeam && event.status !== 'cancelled' && event.status !== 'completed' && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowEditDialog(true)}>
                <Edit2 className="h-4 w-4 mr-1" /> Edit
              </Button>
              {statusActions.map(action => (
                <Button
                  key={action.next}
                  size="sm"
                  className={`${action.color} text-white`}
                  onClick={() => handleStatusChange(action.next)}
                  disabled={updateStatus.isPending}
                >
                  {action.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Event info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3 text-sm text-bone-white">
            <Calendar className="h-4 w-4 text-accent-yellow" />
            {formatDate(event.start_date)}
            {event.end_date && <span className="text-muted-gray">to {formatDate(event.end_date)}</span>}
          </div>
          {event.duration_minutes && (
            <div className="flex items-center gap-3 text-sm text-muted-gray">
              <Clock className="h-4 w-4" />
              {event.duration_minutes} minutes
            </div>
          )}
          {event.venue_name && (
            <div className="flex items-center gap-3 text-sm text-muted-gray">
              <MapPin className="h-4 w-4" />
              {event.venue_name}{event.address ? ` — ${event.address}` : ''}
            </div>
          )}
          {event.is_virtual && event.virtual_link && (
            <div className="flex items-center gap-3 text-sm">
              <Monitor className="h-4 w-4 text-muted-gray" />
              <a href={event.virtual_link} target="_blank" rel="noopener noreferrer" className="text-accent-yellow hover:underline truncate">
                {event.virtual_link}
              </a>
            </div>
          )}
          {event.description && (
            <p className="text-sm text-bone-white/80 mt-3 whitespace-pre-wrap">{event.description}</p>
          )}
          {event.notes && (
            <div className="mt-3 p-3 rounded bg-muted-gray/10 border border-muted-gray/20">
              <p className="text-xs text-muted-gray mb-1">Notes</p>
              <p className="text-sm text-bone-white/80 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
          {event.linked_request && (
            <div className="mt-3 p-3 rounded bg-blue-900/10 border border-blue-900/30">
              <p className="text-xs text-muted-gray mb-1">Linked Content Request</p>
              <Link to={`/media/requests/${event.linked_request.id}`} className="text-sm text-accent-yellow hover:underline">
                {event.linked_request.title}
              </Link>
            </div>
          )}
        </div>

        {/* RSVP Card */}
        <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-bone-white flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-yellow" />
            RSVP
          </h3>
          {event.status !== 'cancelled' && event.status !== 'completed' && (
            <div className="flex flex-wrap gap-2">
              {['accepted', 'maybe', 'declined'].map(status => (
                <Button
                  key={status}
                  size="sm"
                  variant={rsvpStatus === status ? 'default' : 'outline'}
                  className={rsvpStatus === status ? 'bg-accent-yellow text-charcoal-black' : 'text-bone-white border-muted-gray/50'}
                  onClick={() => handleRSVP(status)}
                  disabled={rsvpEvent.isPending}
                >
                  {status === 'accepted' ? 'Going' : status === 'maybe' ? 'Maybe' : 'Can\'t Go'}
                </Button>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-gray">
            {(event.attendees || []).filter((a: any) => a.rsvp_status === 'accepted').length} going
            {' / '}
            {(event.attendees || []).filter((a: any) => a.rsvp_status === 'maybe').length} maybe
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-muted-gray/30">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-accent-yellow text-accent-yellow'
                : 'border-transparent text-muted-gray hover:text-bone-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4">
        {activeTab === 'Overview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-gray">Created by {event.created_by_name}</p>
            {event.description ? (
              <p className="text-sm text-bone-white whitespace-pre-wrap">{event.description}</p>
            ) : (
              <p className="text-sm text-muted-gray">No description provided</p>
            )}
          </div>
        )}

        {activeTab === 'Attendees' && (
          <AttendeeList
            attendees={event.attendees || []}
            isTeam={isTeam}
            onAdd={(profileId, role) =>
              addAttendee.mutateAsync({ eventId: event.id, data: { profile_id: profileId, role } })
            }
            onRemove={(profileId) =>
              removeAttendee.mutateAsync({ eventId: event.id, profileId })
            }
          />
        )}

        {activeTab === 'Checklist' && (
          <EventChecklist
            items={event.checklist || []}
            isTeam={isTeam}
            onAdd={(label) =>
              addChecklist.mutateAsync({ eventId: event.id, data: { label } })
            }
            onToggle={(itemId, isCompleted) =>
              updateChecklist.mutateAsync({ eventId: event.id, itemId, data: { is_completed: isCompleted } })
            }
            onDelete={(itemId) =>
              deleteChecklist.mutateAsync({ eventId: event.id, itemId })
            }
          />
        )}

        {activeTab === 'Agenda' && (
          <EventAgenda
            items={event.agenda || []}
            isTeam={isTeam}
            onAdd={(data) =>
              addAgenda.mutateAsync({ eventId: event.id, data })
            }
            onDelete={(itemId) =>
              deleteAgenda.mutateAsync({ eventId: event.id, itemId })
            }
          />
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-charcoal-black border-muted-gray/50 text-bone-white max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <EventForm
            initial={event}
            onSubmit={handleEdit}
            isPending={updateEvent.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventDetail;
