/**
 * FolderManagementModal
 * Dialog for creating and editing custom message folders
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useCreateFolder, useUpdateFolder, useDeleteFolder, CustomFolder } from '@/hooks/useCustomFolders';
import { FOLDER_ICON_OPTIONS, FOLDER_COLOR_OPTIONS } from './CustomFolderList';
import {
  Star,
  Heart,
  Briefcase,
  Home,
  Users,
  Tag,
  Flag,
  Bookmark,
  Bell,
  Zap,
  Coffee,
  Gift,
  Music,
  Camera,
  Folder,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Icon component map
const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  heart: Heart,
  briefcase: Briefcase,
  home: Home,
  users: Users,
  tag: Tag,
  flag: Flag,
  bookmark: Bookmark,
  bell: Bell,
  zap: Zap,
  coffee: Coffee,
  gift: Gift,
  music: Music,
  camera: Camera,
  folder: Folder,
};

interface FolderManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: CustomFolder | null; // If provided, we're editing
}

export function FolderManagementModal({
  isOpen,
  onClose,
  folder,
}: FolderManagementModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState('folder');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  const isEditing = !!folder;
  const isLoading = createFolder.isPending || updateFolder.isPending || deleteFolder.isPending;

  // Reset form when modal opens/closes or folder changes
  useEffect(() => {
    if (isOpen) {
      if (folder) {
        setName(folder.name);
        setColor(folder.color || FOLDER_COLOR_OPTIONS[0]);
        setIcon(folder.icon || 'folder');
      } else {
        setName('');
        setColor(FOLDER_COLOR_OPTIONS[0]);
        setIcon('folder');
      }
    }
  }, [isOpen, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      if (isEditing && folder) {
        await updateFolder.mutateAsync({
          folderId: folder.id,
          name: name.trim(),
          color,
          icon,
        });
      } else {
        await createFolder.mutateAsync({
          name: name.trim(),
          color,
          icon,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save folder:', error);
    }
  };

  const handleDelete = async () => {
    if (!folder) return;

    try {
      await deleteFolder.mutateAsync(folder.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] bg-charcoal-black border-muted-gray text-bone-white">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Folder' : 'Create Folder'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            {/* Name input */}
            <div className="space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Folder name..."
                className="bg-muted-gray/20 border-muted-gray"
                maxLength={100}
                autoFocus
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      color === c ? 'border-bone-white scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_ICON_OPTIONS.map((iconName) => {
                  const IconComponent = ICON_COMPONENTS[iconName] || Folder;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setIcon(iconName)}
                      className={cn(
                        'w-10 h-10 rounded-md flex items-center justify-center transition-all border',
                        icon === iconName
                          ? 'border-accent-yellow bg-accent-yellow/20'
                          : 'border-muted-gray/30 hover:border-muted-gray'
                      )}
                      title={iconName}
                    >
                      <IconComponent
                        className="h-5 w-5"
                        style={{ color: icon === iconName ? color : undefined }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted-gray/20 border border-muted-gray/30">
                {(() => {
                  const PreviewIcon = ICON_COMPONENTS[icon] || Folder;
                  return (
                    <PreviewIcon
                      className="h-5 w-5"
                      style={{ color }}
                    />
                  );
                })()}
                <span className="text-bone-white">
                  {name || 'Folder Name'}
                </span>
              </div>
            </div>
          </form>

          <DialogFooter className="flex justify-between">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Folder'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete "{folder?.name}"? Conversations in this folder will be moved back to the main inbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted-gray/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteFolder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
