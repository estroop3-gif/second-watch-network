import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCreateMediaEvent } from '@/hooks/media';
import EventForm from '@/components/media/EventForm';

const NewEvent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const createEvent = useCreateMediaEvent();

  const handleSubmit = async (data: any) => {
    try {
      const result = await createEvent.mutateAsync(data);
      toast({ title: 'Event created' });
      navigate(`/media/events/${result.event.id}`);
    } catch {
      toast({ title: 'Failed to create event', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/media/events')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-heading text-accent-yellow">New Event</h1>
      </div>

      <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-6">
        <EventForm
          onSubmit={handleSubmit}
          isPending={createEvent.isPending}
          submitLabel="Create Event"
        />
      </div>
    </div>
  );
};

export default NewEvent;
