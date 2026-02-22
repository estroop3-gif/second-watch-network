import { useState } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EventAgendaProps {
  items: any[];
  isTeam: boolean;
  onAdd?: (data: { title: string; description?: string; start_time?: string; duration_minutes?: number }) => void;
  onUpdate?: (itemId: string, data: any) => void;
  onDelete?: (itemId: string) => void;
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const EventAgenda = ({ items, isTeam, onAdd, onDelete }: EventAgendaProps) => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', start_time: '', duration_minutes: '' });

  const handleAdd = () => {
    if (!form.title.trim()) return;
    onAdd?.({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      start_time: form.start_time || undefined,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : undefined,
    });
    setForm({ title: '', description: '', start_time: '', duration_minutes: '' });
    setShowForm(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-bone-white">
          Agenda ({items.length} items)
        </h3>
        {isTeam && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="text-accent-yellow hover:text-accent-yellow/80 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        )}
      </div>

      {items.length === 0 && !showForm ? (
        <p className="text-xs text-muted-gray py-2">No agenda items yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any, idx: number) => (
            <div
              key={item.id}
              className="flex gap-3 p-3 rounded bg-muted-gray/10 border border-muted-gray/20 group"
            >
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-accent-yellow/20 text-accent-yellow flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                {idx < items.length - 1 && (
                  <div className="w-px flex-1 bg-muted-gray/30 mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-bone-white">{item.title}</span>
                  {isTeam && onDelete && (
                    <button
                      onClick={() => onDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-gray hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-gray mt-0.5">{item.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  {item.start_time && (
                    <span className="text-xs text-muted-gray flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(item.start_time)}
                    </span>
                  )}
                  {item.duration_minutes && (
                    <span className="text-xs text-muted-gray">
                      {item.duration_minutes}min
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-2 p-3 rounded border border-muted-gray/30 bg-muted-gray/5">
          <input
            type="text" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Agenda item title *"
            className="w-full px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-xs"
          />
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-xs"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="datetime-local" value={form.start_time}
              onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
              className="px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-xs"
            />
            <input
              type="number" value={form.duration_minutes}
              onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
              placeholder="Duration (min)"
              className="px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="bg-accent-yellow text-charcoal-black text-xs h-7">
              Add Item
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-xs h-7">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventAgenda;
