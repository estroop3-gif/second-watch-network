import { useState } from 'react';
import { Pencil, Trash2, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  useEmailLabels,
  useCreateEmailLabel,
  useUpdateEmailLabel,
  useDeleteEmailLabel,
} from '@/hooks/crm/useEmail';

const LabelManager = () => {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const { data: labels } = useEmailLabels();
  const createLabel = useCreateEmailLabel();
  const updateLabel = useUpdateEmailLabel();
  const deleteLabel = useDeleteEmailLabel();

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createLabel.mutate(
      { name, color: newColor },
      {
        onSuccess: () => {
          setNewName('');
          setNewColor('#6b7280');
        },
      }
    );
  };

  const handleStartEdit = (label: any) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color || '#6b7280');
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    updateLabel.mutate(
      { id: editingId, data: { name: editName.trim(), color: editColor } },
      { onSuccess: () => setEditingId(null) }
    );
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
  };

  const handleDelete = (id: string) => {
    deleteLabel.mutate(id);
  };

  const allLabels = labels || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-gray hover:text-bone-white gap-1.5">
          <Tag className="h-3.5 w-3.5" />
          Manage Labels
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Manage Email Labels</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-64 mt-2">
          <div className="space-y-1">
            {allLabels.length === 0 && (
              <p className="text-sm text-muted-gray py-4 text-center">No labels created yet</p>
            )}
            {allLabels.map((label: any) => (
              <div key={label.id}>
                {editingId === label.id ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted-gray/10">
                    <Input
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      placeholder="#hex"
                      className="h-7 w-20 text-xs bg-muted-gray/10 border-muted-gray/30 text-bone-white font-mono"
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-7 flex-1 text-xs bg-muted-gray/10 border-muted-gray/30 text-bone-white"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={!editName.trim() || updateLabel.isPending}
                      className="h-7 px-2 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80 text-xs"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-7 px-2 text-muted-gray hover:text-bone-white text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted-gray/10 group">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: label.color || '#6b7280' }}
                    />
                    <span className="flex-1 text-sm text-bone-white truncate">{label.name}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(label)}
                        className="p-1 text-muted-gray hover:text-bone-white rounded transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(label.id)}
                        className="p-1 text-muted-gray hover:text-red-400 rounded transition-colors"
                        disabled={deleteLabel.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="border-t border-muted-gray/30 pt-3 mt-2">
          <p className="text-xs text-muted-gray mb-2">Create new label</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreate();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              placeholder="#hex"
              className="h-8 w-20 text-xs bg-muted-gray/10 border-muted-gray/30 text-bone-white font-mono"
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Label name..."
              className="h-8 flex-1 text-xs bg-muted-gray/10 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newName.trim() || createLabel.isPending}
              className="h-8 px-3 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LabelManager;
