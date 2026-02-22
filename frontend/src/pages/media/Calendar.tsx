import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import ContentCalendarGrid from '@/components/media/ContentCalendarGrid';
import { useMediaCalendar, useCreateCalendarEntry } from '@/hooks/media';
import { useMediaPlatforms } from '@/hooks/media';

const CONTENT_TYPES = [
  { value: 'social_media_video', label: 'Social Media Video' },
  { value: 'marketing_video', label: 'Marketing Video' },
  { value: 'graphic', label: 'Graphic' },
  { value: 'social_post', label: 'Social Post' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'photo_shoot', label: 'Photo Shoot' },
  { value: 'animation', label: 'Animation' },
  { value: 'other', label: 'Other' },
];

const Calendar = () => {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', content_type: '', scheduled_date: '',
    platform_id: '', status: 'scheduled', color: '',
  });

  const monthStart = useMemo(() => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    return d.toISOString();
  }, [currentMonth]);

  const monthEnd = useMemo(() => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
    return d.toISOString();
  }, [currentMonth]);

  const { data, isLoading } = useMediaCalendar({ start: monthStart, end: monthEnd });
  const { data: platformsData } = useMediaPlatforms();
  const createEntry = useCreateCalendarEntry();

  const entries = data?.entries || [];
  const scheduledRequests = data?.scheduled_requests || [];
  const calendarEvents = (data?.events || []).map((ev: any) => ({
    id: ev.id,
    title: `[Event] ${ev.title}`,
    scheduled_date: ev.start_date,
    color: ev.color || '#22c55e',
    status: ev.status,
    event_type: ev.event_type,
  }));

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const handleDayClick = (date: string) => {
    setSelectedDay(date);
  };

  const handleEntryClick = (entry: any) => {
    // Could open a detail modal — for now just show day panel
    setSelectedDay(entry.scheduled_date?.substring(0, 10));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.scheduled_date) return;
    try {
      await createEntry.mutateAsync(form);
      toast({ title: 'Calendar entry created' });
      setShowCreateDialog(false);
      setForm({ title: '', description: '', content_type: '', scheduled_date: '', platform_id: '', status: 'scheduled', color: '' });
    } catch {
      toast({ title: 'Failed to create entry', variant: 'destructive' });
    }
  };

  const dayEntries = useMemo(() => {
    if (!selectedDay) return [];
    return [
      ...entries.filter((e: any) => e.scheduled_date?.startsWith(selectedDay)),
      ...scheduledRequests.filter((r: any) => r.scheduled_date?.startsWith(selectedDay)),
      ...calendarEvents.filter((e: any) => e.scheduled_date?.startsWith(selectedDay)),
    ];
  }, [selectedDay, entries, scheduledRequests, calendarEvents]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading text-accent-yellow">Content Calendar</h1>
        <Button onClick={() => setShowCreateDialog(true)} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80">
          <Plus className="h-4 w-4 mr-2" /> Add Entry
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
        <h2 className="text-lg font-medium text-bone-white">{monthLabel}</h2>
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1">
            <ContentCalendarGrid
              entries={[...entries, ...calendarEvents]}
              scheduledRequests={scheduledRequests}
              onDayClick={handleDayClick}
              onEntryClick={handleEntryClick}
              currentMonth={currentMonth}
            />
          </div>

          {selectedDay && (
            <div className="w-72 bg-muted-gray/10 border border-muted-gray/30 rounded-lg p-4 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-bone-white">
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedDay(null)} className="text-muted-gray hover:text-bone-white text-xs">Close</button>
              </div>
              {dayEntries.length === 0 ? (
                <p className="text-xs text-muted-gray">No entries for this day</p>
              ) : (
                <div className="space-y-2">
                  {dayEntries.map((entry: any, i: number) => (
                    <div key={entry.id || i} className="p-2 rounded bg-charcoal-black border border-muted-gray/30">
                      <div className="flex items-center gap-2">
                        {(entry.platform_color || entry.color) && (
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.platform_color || entry.color }} />
                        )}
                        <span className="text-xs font-medium text-bone-white truncate">{entry.title}</span>
                      </div>
                      {entry.platform_name && <span className="text-[10px] text-muted-gray">{entry.platform_name}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-charcoal-black border-muted-gray/50 text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle>New Calendar Entry</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray">Title *</label>
              <input
                type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm" required
              />
            </div>
            <div>
              <label className="text-sm text-muted-gray">Scheduled Date *</label>
              <input
                type="datetime-local" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm" required
              />
            </div>
            <div>
              <label className="text-sm text-muted-gray">Platform</label>
              <select
                value={form.platform_id} onChange={e => setForm(f => ({ ...f, platform_id: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
              >
                <option value="">None</option>
                {(platformsData?.platforms || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-gray">Content Type</label>
              <select
                value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
              >
                <option value="">None</option>
                {CONTENT_TYPES.map(ct => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-gray">Description</label>
              <textarea
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm" rows={2}
              />
            </div>
            <div>
              <label className="text-sm text-muted-gray">Color (hex)</label>
              <input
                type="text" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="#6366f1" className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
              />
            </div>
            <Button type="submit" className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80" disabled={createEntry.isPending}>
              {createEntry.isPending ? 'Creating...' : 'Create Entry'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
