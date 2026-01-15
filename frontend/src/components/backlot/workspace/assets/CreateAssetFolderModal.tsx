/**
 * CreateAssetFolderModal - Dialog for creating/editing asset folders
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AssetFolder, AssetFolderType, AssetFolderInput } from '@/types/backlot';
import { Folder, Music, Box, Image, FileText, Layers } from 'lucide-react';

interface CreateAssetFolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AssetFolderInput) => Promise<void>;
  parentFolderId?: string | null;
  editFolder?: AssetFolder | null;
  isSubmitting?: boolean;
}

const FOLDER_TYPES: { value: AssetFolderType; label: string; icon: React.ReactNode }[] = [
  { value: 'audio', label: 'Audio', icon: <Music className="w-4 h-4" /> },
  { value: '3d', label: '3D Models', icon: <Box className="w-4 h-4" /> },
  { value: 'graphics', label: 'Graphics', icon: <Image className="w-4 h-4" /> },
  { value: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
  { value: 'mixed', label: 'Mixed', icon: <Layers className="w-4 h-4" /> },
];

const CreateAssetFolderModal: React.FC<CreateAssetFolderModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  parentFolderId,
  editFolder,
  isSubmitting,
}) => {
  const [name, setName] = useState('');
  const [folderType, setFolderType] = useState<AssetFolderType | 'none'>('none');

  const isEditing = !!editFolder;

  useEffect(() => {
    if (editFolder) {
      setName(editFolder.name);
      setFolderType(editFolder.folder_type || 'none');
    } else {
      setName('');
      setFolderType('none');
    }
  }, [editFolder, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      folder_type: folderType === 'none' ? null : folderType,
      parent_folder_id: isEditing ? editFolder.parent_folder_id : parentFolderId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-accent-yellow" />
              {isEditing ? 'Edit Folder' : 'Create Folder'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the folder name and type.'
                : parentFolderId
                  ? 'Create a new subfolder.'
                  : 'Create a new folder to organize your assets.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Folder Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter folder name..."
                className="bg-charcoal-black border-muted-gray/30"
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Folder Type (Optional)</Label>
              <Select
                value={folderType}
                onValueChange={(v) => setFolderType(v as AssetFolderType | 'none')}
              >
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      No specific type
                    </span>
                  </SelectItem>
                  {FOLDER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        {type.icon}
                        {type.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray">
                Helps organize assets by category
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateAssetFolderModal;
