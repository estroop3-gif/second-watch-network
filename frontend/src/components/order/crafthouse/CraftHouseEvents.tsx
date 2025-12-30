/**
 * CraftHouseEvents - Events listing and management for a craft house
 * Uses existing events API with craft_house_id filter
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { orderAPI, OrderEvent, OrderEventCreateRequest, EVENT_TYPES } from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Video,
  Plus,
  Loader2,
  Check,
  HelpCircle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast, isFuture, isToday } from 'date-fns';

interface CraftHouseEventsProps {
  craftHouseId: number;
  craftHouseName: string;
  isSteward: boolean;
  isMember: boolean;
}

export default function CraftHouseEvents({
  craftHouseId,
  craftHouseName,
  isSteward,
  isMember,
}: CraftHouseEventsProps) {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch events for this craft house
  const { data, isLoading } = useQuery({
    queryKey: ['craft-house-events', craftHouseId],
    queryFn: () =>
      orderAPI.listEvents({
        craft_house_id: craftHouseId,
        upcoming_only: false,
        limit: 50,
      }),
  });

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: number;
      status: 'attending' | 'maybe' | 'declined';
    }) => {
      return orderAPI.rsvpToEvent(eventId, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-events', craftHouseId] });
      toast.success('RSVP updated');
    },
    onError: () => {
      toast.error('Failed to update RSVP');
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: (event: OrderEventCreateRequest) => orderAPI.createEvent(event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-events', craftHouseId] });
      toast.success('Event created');
      setShowCreateDialog(false);
    },
    onError: () => {
      toast.error('Failed to create event');
    },
  });

  const events = data?.events || [];
  const upcomingEvents = events.filter((e) => isFuture(new Date(e.start_date)) || isToday(new Date(e.start_date)));
  const pastEvents = events.filter((e) => isPast(new Date(e.start_date)) && !isToday(new Date(e.start_date)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading text-xl text-bone-white">Events</h3>
          <p className="text-sm text-muted-gray">Gatherings and workshops for {craftHouseName}</p>
        </div>
        {isSteward && (
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
        </div>
      ) : events.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-dashed border-muted-gray">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-gray opacity-50" />
            <p className="text-muted-gray">No events scheduled yet.</p>
            {isSteward && (
              <p className="text-sm text-muted-gray mt-2">
                Create the first event for your craft house!
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div>
              <h4 className="font-heading text-bone-white mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent-yellow" />
                Upcoming Events
              </h4>
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isMember={isMember}
                    onRSVP={(status) => rsvpMutation.mutate({ eventId: event.id, status })}
                    isRSVPing={rsvpMutation.isPending}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <div>
              <h4 className="font-heading text-muted-gray mb-4">Past Events</h4>
              <div className="space-y-4 opacity-75">
                {pastEvents.slice(0, 5).map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isMember={isMember}
                    isPast
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        craftHouseId={craftHouseId}
        onSubmit={(data) => createEventMutation.mutate(data)}
        isSubmitting={createEventMutation.isPending}
      />
    </div>
  );
}

// Event Card Component
function EventCard({
  event,
  isMember,
  onRSVP,
  isRSVPing,
  isPast,
}: {
  event: OrderEvent;
  isMember: boolean;
  onRSVP?: (status: 'attending' | 'maybe' | 'declined') => void;
  isRSVPing?: boolean;
  isPast?: boolean;
}) {
  const eventDate = new Date(event.start_date);
  const eventType = EVENT_TYPES.find((t) => t.value === event.event_type)?.label || event.event_type;

  return (
    <motion.div whileHover={{ scale: isPast ? 1 : 1.01 }}>
      <Card className={`bg-charcoal-black/50 border-muted-gray ${isPast ? 'border-dashed' : 'hover:border-accent-yellow/50'}`}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {/* Date Box */}
            <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-accent-yellow/10 flex flex-col items-center justify-center">
              <span className="text-xs font-medium text-accent-yellow uppercase">
                {format(eventDate, 'MMM')}
              </span>
              <span className="text-2xl font-bold text-accent-yellow">
                {format(eventDate, 'd')}
              </span>
            </div>

            {/* Event Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-heading text-bone-white truncate">{event.title}</h4>
                <Badge variant="outline" className="border-muted-gray text-muted-gray text-xs">
                  {eventType}
                </Badge>
                {event.is_online && (
                  <Badge variant="outline" className="border-accent-yellow text-accent-yellow text-xs">
                    <Video className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                )}
              </div>

              {event.description && (
                <p className="text-sm text-muted-gray mb-2 line-clamp-2">
                  {event.description}
                </p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-gray">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(eventDate, 'h:mm a')}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {event.rsvp_count} attending
                  {event.max_attendees && ` / ${event.max_attendees} max`}
                </span>
              </div>
            </div>

            {/* RSVP Buttons */}
            {!isPast && isMember && onRSVP && (
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant={event.user_rsvp_status === 'attending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onRSVP('attending')}
                  disabled={isRSVPing}
                  className={
                    event.user_rsvp_status === 'attending'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'border-muted-gray text-bone-white'
                  }
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant={event.user_rsvp_status === 'maybe' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onRSVP('maybe')}
                  disabled={isRSVPing}
                  className={
                    event.user_rsvp_status === 'maybe'
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'border-muted-gray text-bone-white'
                  }
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant={event.user_rsvp_status === 'declined' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onRSVP('declined')}
                  disabled={isRSVPing}
                  className={
                    event.user_rsvp_status === 'declined'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'border-muted-gray text-bone-white'
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Non-member message */}
            {!isPast && !isMember && (
              <Badge variant="outline" className="border-muted-gray text-muted-gray">
                Join to RSVP
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Create Event Dialog
function CreateEventDialog({
  open,
  onOpenChange,
  craftHouseId,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  craftHouseId: number;
  onSubmit: (data: OrderEventCreateRequest) => void;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<'meetup' | 'workshop' | 'online' | 'screening'>('meetup');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineLink, setOnlineLink] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');

  const handleSubmit = () => {
    if (!title.trim() || !startDate || !startTime) return;

    const startDateTime = `${startDate}T${startTime}:00`;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      event_type: eventType,
      start_date: startDateTime,
      location: location.trim() || undefined,
      is_online: isOnline,
      online_link: isOnline ? onlineLink.trim() : undefined,
      craft_house_id: craftHouseId,
      max_attendees: maxAttendees ? parseInt(maxAttendees) : undefined,
    });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType('meetup');
    setStartDate('');
    setStartTime('');
    setLocation('');
    setIsOnline(false);
    setOnlineLink('');
    setMaxAttendees('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-spray text-accent-yellow">Create Event</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Schedule a new event for your craft house members.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <Label className="text-bone-white">Event Title*</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Lighting Workshop"
              className="bg-charcoal-black border-muted-gray text-bone-white"
            />
          </div>

          <div>
            <Label className="text-bone-white">Event Type</Label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="w-full mt-1 p-2 rounded-md bg-charcoal-black border border-muted-gray text-bone-white"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-bone-white">Date*</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-charcoal-black border-muted-gray text-bone-white"
              />
            </div>
            <div>
              <Label className="text-bone-white">Time*</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-charcoal-black border-muted-gray text-bone-white"
              />
            </div>
          </div>

          <div>
            <Label className="text-bone-white">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will happen at this event?"
              className="bg-charcoal-black border-muted-gray text-bone-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
            <Label className="text-bone-white">Online event</Label>
          </div>

          {isOnline ? (
            <div>
              <Label className="text-bone-white">Online Link</Label>
              <Input
                value={onlineLink}
                onChange={(e) => setOnlineLink(e.target.value)}
                placeholder="https://zoom.us/..."
                className="bg-charcoal-black border-muted-gray text-bone-white"
              />
            </div>
          ) : (
            <div>
              <Label className="text-bone-white">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Address or venue name"
                className="bg-charcoal-black border-muted-gray text-bone-white"
              />
            </div>
          )}

          <div>
            <Label className="text-bone-white">Max Attendees (optional)</Label>
            <Input
              type="number"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              placeholder="Leave empty for unlimited"
              className="bg-charcoal-black border-muted-gray text-bone-white"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-gray text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !startDate || !startTime || isSubmitting}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
