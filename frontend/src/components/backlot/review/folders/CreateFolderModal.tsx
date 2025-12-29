/**
 * CreateFolderModal - Modal for creating and editing review folders
 */
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ReviewFolder, ReviewFolderInput } from '@/types/backlot';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Folder, Check } from 'lucide-react';

const FOLDER_COLORS = [
  { value: null, label: 'Default' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
];

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewFolderInput) => Promise<void>;
  folder?: ReviewFolder | null;
  parentFolderId?: string | null;
  isLoading?: boolean;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  folder,
  parentFolderId,
  isLoading,
}) => {
  const isEditing = !!folder;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or folder changes
  useEffect(() => {
    if (isOpen) {
      if (folder) {
        setName(folder.name);
        setDescription(folder.description || '');
        setColor(folder.color);
      } else {
        setName('');
        setDescription('');
        setColor(null);
      }
      setError(null);
    }
  }, [isOpen, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        color,
        parent_folder_id: folder?.parent_folder_id ?? parentFolderId ?? null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-accent-yellow" />
            {isEditing ? 'Edit Folder' : 'Create Folder'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Folder Name */}
          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter folder name..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="folder-description">Description (optional)</Label>
            <Textarea
              id="folder-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={2}
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value ?? 'default'}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    c.value === null
                      ? 'bg-charcoal-dark border border-white/20'
                      : '',
                    color === c.value
                      ? 'ring-2 ring-accent-yellow ring-offset-2 ring-offset-charcoal-black'
                      : 'hover:scale-110'
                  )}
                  style={c.value ? { backgroundColor: c.value } : undefined}
                  title={c.label}
                >
                  {color === c.value && (
                    <Check className={cn(
                      'w-4 h-4',
                      c.value === null ? 'text-bone-white' : 'text-white'
                    )} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFolderModal;
