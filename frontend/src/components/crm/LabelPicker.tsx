import { useState } from 'react';
import { Tag, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useEmailLabels,
  useAddThreadLabel,
  useRemoveThreadLabel,
  useCreateEmailLabel,
} from '@/hooks/crm/useEmail';

interface LabelPickerProps {
  threadId: string;
  currentLabels: any[];
}

const LabelPicker = ({ threadId, currentLabels }: LabelPickerProps) => {
  const [open, setOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');

  const { data: allLabels } = useEmailLabels();
  const addLabel = useAddThreadLabel();
  const removeLabel = useRemoveThreadLabel();
  const createLabel = useCreateEmailLabel();

  const currentLabelIds = new Set((currentLabels || []).map((l: any) => l.id));

  const handleToggleLabel = (labelId: string) => {
    if (currentLabelIds.has(labelId)) {
      removeLabel.mutate({ threadId, labelId });
    } else {
      addLabel.mutate({ threadId, labelId });
    }
  };

  const handleCreateLabel = () => {
    const name = newLabelName.trim();
    if (!name) return;
    createLabel.mutate(
      { name },
      {
        onSuccess: (newLabel: any) => {
          setNewLabelName('');
          if (newLabel?.id) {
            addLabel.mutate({ threadId, labelId: newLabel.id });
          }
        },
      }
    );
  };

  const labels = Array.isArray(allLabels?.labels) ? allLabels.labels : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-gray hover:text-bone-white gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Labels
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 bg-charcoal-black border-muted-gray/30 p-0"
        align="start"
      >
        <div className="px-3 py-2 border-b border-muted-gray/30">
          <p className="text-xs font-medium text-bone-white">Assign Labels</p>
        </div>
        <ScrollArea className="max-h-48">
          <div className="py-1">
            {labels.length === 0 && (
              <p className="text-xs text-muted-gray px-3 py-2">No labels yet</p>
            )}
            {labels.map((label: any) => {
              const isAssigned = currentLabelIds.has(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => handleToggleLabel(label.id)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-bone-white hover:bg-muted-gray/20 transition-colors"
                >
                  <span className="w-4 h-4 flex items-center justify-center">
                    {isAssigned && <Check className="h-3.5 w-3.5 text-accent-yellow" />}
                  </span>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: label.color || '#6b7280' }}
                  />
                  <span className="truncate">{label.name}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
        <div className="border-t border-muted-gray/30 p-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateLabel();
            }}
            className="flex items-center gap-1.5"
          >
            <Input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="New label..."
              className="h-7 text-xs bg-muted-gray/10 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              disabled={!newLabelName.trim() || createLabel.isPending}
              className="h-7 px-2 text-accent-yellow hover:text-accent-yellow/80"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LabelPicker;
