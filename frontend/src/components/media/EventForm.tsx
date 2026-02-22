import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const EVENT_TYPES = [
  { value: 'content_shoot', label: 'Content Shoot' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'premiere', label: 'Premiere' },
  { value: 'watch_party', label: 'Watch Party' },
  { value: 'interview', label: 'Interview' },
  { value: 'photoshoot', label: 'Photoshoot' },
  { value: 'livestream', label: 'Livestream' },
  { value: 'other', label: 'Other' },
];

interface EventFormProps {
  initial?: any;
  onSubmit: (data: any) => Promise<void>;
  isPending?: boolean;
  submitLabel?: string;
}

const EventForm = ({ initial, onSubmit, isPending, submitLabel = 'Create Event' }: EventFormProps) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    event_type: 'meetup',
    start_date: '',
    end_date: '',
    duration_minutes: '',
    venue_name: '',
    address: '',
    virtual_link: '',
    is_virtual: false,
    color: '',
    notes: '',
  });

  useEffect(() => {
    if (initial) {
      setForm({
        title: initial.title || '',
        description: initial.description || '',
        event_type: initial.event_type || 'meetup',
        start_date: initial.start_date ? initial.start_date.slice(0, 16) : '',
        end_date: initial.end_date ? initial.end_date.slice(0, 16) : '',
        duration_minutes: initial.duration_minutes?.toString() || '',
        venue_name: initial.venue_name || '',
        address: initial.address || '',
        virtual_link: initial.virtual_link || '',
        is_virtual: initial.is_virtual || false,
        color: initial.color || '',
        notes: initial.notes || '',
      });
    }
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.start_date || !form.event_type) return;
    await onSubmit({
      ...form,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      end_date: form.end_date || null,
      venue_name: form.venue_name || null,
      address: form.address || null,
      virtual_link: form.virtual_link || null,
      color: form.color || null,
      notes: form.notes || null,
    });
  };

  const inputClass = 'w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm focus:border-accent-yellow focus:outline-none';
  const labelClass = 'text-sm text-muted-gray';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Title *</label>
        <input
          type="text" value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className={inputClass} required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Event Type *</label>
          <select
            value={form.event_type}
            onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
            className={inputClass}
          >
            {EVENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Duration (minutes)</label>
          <input
            type="number" value={form.duration_minutes}
            onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
            className={inputClass} min={0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start Date/Time *</label>
          <input
            type="datetime-local" value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            className={inputClass} required
          />
        </div>
        <div>
          <label className={labelClass}>End Date/Time</label>
          <input
            type="datetime-local" value={form.end_date}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className={inputClass} rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-bone-white cursor-pointer">
          <input
            type="checkbox" checked={form.is_virtual}
            onChange={e => setForm(f => ({ ...f, is_virtual: e.target.checked }))}
            className="rounded border-muted-gray"
          />
          Virtual Event
        </label>
      </div>

      {form.is_virtual && (
        <div>
          <label className={labelClass}>Virtual Link</label>
          <input
            type="url" value={form.virtual_link}
            onChange={e => setForm(f => ({ ...f, virtual_link: e.target.value }))}
            placeholder="https://zoom.us/..." className={inputClass}
          />
        </div>
      )}

      {!form.is_virtual && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Venue Name</label>
            <input
              type="text" value={form.venue_name}
              onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Address</label>
            <input
              type="text" value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          className={inputClass} rows={2}
        />
      </div>

      <div>
        <label className={labelClass}>Color (hex)</label>
        <input
          type="text" value={form.color}
          onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
          placeholder="#22c55e" className={inputClass}
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80"
        disabled={isPending}
      >
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </form>
  );
};

export default EventForm;
