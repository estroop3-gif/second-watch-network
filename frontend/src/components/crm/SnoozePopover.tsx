import { useState } from 'react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Clock, Loader2 } from 'lucide-react';
import { useSnoozeThread } from '@/hooks/crm/useEmail';
import { useToast } from '@/hooks/use-toast';

interface SnoozePopoverProps {
  threadId: string;
  children?: React.ReactNode;
}

function getSnoozeDate(preset: string): Date {
  const now = new Date();
  switch (preset) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '3h':
      return new Date(now.getTime() + 3 * 60 * 60 * 1000);
    case 'tomorrow': {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    case 'monday': {
      const d = new Date(now);
      const daysUntilMonday = ((8 - d.getDay()) % 7) || 7;
      d.setDate(d.getDate() + daysUntilMonday);
      d.setHours(9, 0, 0, 0);
      return d;
    }
    default:
      return now;
  }
}

const PRESETS = [
  { key: '1h', label: '1 hour' },
  { key: '3h', label: '3 hours' },
  { key: 'tomorrow', label: 'Tomorrow 9 AM' },
  { key: 'monday', label: 'Next Monday 9 AM' },
] as const;

const SnoozePopover = ({ threadId, children }: SnoozePopoverProps) => {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const snooze = useSnoozeThread();
  const { toast } = useToast();

  const handleSnooze = (snoozedUntil: string, label: string) => {
    snooze.mutate(
      { threadId, snoozedUntil },
      {
        onSuccess: () => {
          toast({ title: 'Snoozed', description: `Thread snoozed until ${label}.` });
          setOpen(false);
          setShowCustom(false);
          setCustomDate('');
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to snooze thread.', variant: 'destructive' });
        },
      },
    );
  };

  const handlePreset = (preset: string, label: string) => {
    const date = getSnoozeDate(preset);
    handleSnooze(date.toISOString(), label);
  };

  const handleCustomSubmit = () => {
    if (!customDate) return;
    const date = new Date(customDate);
    if (date <= new Date()) {
      toast({ title: 'Invalid date', description: 'Snooze date must be in the future.', variant: 'destructive' });
      return;
    }
    handleSnooze(date.toISOString(), date.toLocaleString());
  };

  // Minimum datetime for custom picker (now)
  const minDatetime = new Date().toISOString().slice(0, 16);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="text-muted-gray hover:text-accent-yellow" title="Snooze">
            <Clock className="h-4 w-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-2 bg-charcoal-black border-muted-gray"
        align="end"
      >
        <div className="px-2 py-1 mb-1">
          <span className="text-xs font-medium text-muted-gray uppercase tracking-wider">Snooze Until</span>
        </div>

        <div className="space-y-0.5">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handlePreset(key, label)}
              disabled={snooze.isPending}
              className="w-full text-left px-3 py-2 text-sm text-bone-white rounded-md hover:bg-muted-gray/20 transition-colors disabled:opacity-50"
            >
              {label}
            </button>
          ))}

          <div className="border-t border-muted-gray/20 my-1" />

          {showCustom ? (
            <div className="px-2 py-1 space-y-2">
              <input
                type="datetime-local"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                min={minDatetime}
                className="w-full bg-charcoal-black border border-muted-gray/50 rounded-md px-2 py-1.5 text-sm text-bone-white focus:outline-none focus:border-accent-yellow/50 [color-scheme:dark]"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={handleCustomSubmit}
                  disabled={snooze.isPending || !customDate}
                  className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 flex-1 text-xs"
                >
                  {snooze.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Set'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowCustom(false); setCustomDate(''); }}
                  className="text-muted-gray text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCustom(true)}
              className="w-full text-left px-3 py-2 text-sm text-muted-gray hover:text-bone-white rounded-md hover:bg-muted-gray/20 transition-colors"
            >
              Custom date & time...
            </button>
          )}
        </div>

        {snooze.isPending && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-gray" />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SnoozePopover;
