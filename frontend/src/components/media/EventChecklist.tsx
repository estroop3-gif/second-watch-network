import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EventChecklistProps {
  items: any[];
  isTeam: boolean;
  onAdd?: (label: string) => void;
  onToggle?: (itemId: string, isCompleted: boolean) => void;
  onDelete?: (itemId: string) => void;
}

const EventChecklist = ({ items, isTeam, onAdd, onToggle, onDelete }: EventChecklistProps) => {
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    onAdd?.(newLabel.trim());
    setNewLabel('');
  };

  const completedCount = items.filter((i: any) => i.is_completed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-bone-white">
          Checklist ({completedCount}/{items.length})
        </h3>
      </div>

      {items.length > 0 && (
        <div className="w-full bg-muted-gray/30 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: items.length > 0 ? `${(completedCount / items.length) * 100}%` : '0%' }}
          />
        </div>
      )}

      <div className="space-y-1">
        {items.map((item: any) => (
          <div
            key={item.id}
            className="flex items-center gap-2 p-2 rounded hover:bg-muted-gray/10 group"
          >
            <input
              type="checkbox"
              checked={item.is_completed}
              onChange={() => onToggle?.(item.id, !item.is_completed)}
              className="rounded border-muted-gray cursor-pointer"
            />
            <span className={`flex-1 text-sm ${item.is_completed ? 'text-muted-gray line-through' : 'text-bone-white'}`}>
              {item.label}
            </span>
            {item.assigned_to_name && (
              <span className="text-xs text-muted-gray">{item.assigned_to_name}</span>
            )}
            {isTeam && onDelete && (
              <button
                onClick={() => onDelete(item.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-gray hover:text-red-400 transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {(isTeam || items.length === 0) && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add item..."
            className="flex-1 px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-xs"
          />
          <Button size="sm" onClick={handleAdd} className="bg-accent-yellow text-charcoal-black text-xs h-8">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default EventChecklist;
