/**
 * AdNoteDetailModal - Full note view with comments
 *
 * Features:
 * - Full note content display
 * - Edit mode (creator only)
 * - Comments section below
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Edit2, Save, X, Clock, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdNoteEntry, useUpdateAdNoteEntry } from '@/hooks/backlot/useAdNotes';
import { AdNoteComments } from './AdNoteComments';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface AdNoteDetailModalProps {
  entry: AdNoteEntry | null;
  dayId: string;
  canEdit: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const AdNoteDetailModal: React.FC<AdNoteDetailModalProps> = ({
  entry,
  dayId,
  canEdit,
  isOpen,
  onClose,
}) => {
  const { profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const updateEntry = useUpdateAdNoteEntry();

  if (!entry) return null;

  const isCreator = profile?.id === entry.created_by;
  const canEditEntry = canEdit && isCreator;
  const createdAt = new Date(entry.created_at);
  const formattedDate = format(createdAt, 'MMM d, yyyy');
  const formattedTime = format(createdAt, 'h:mm a');

  const initials = entry.creator?.display_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const handleStartEdit = () => {
    setEditContent(entry.content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await updateEntry.mutateAsync({
        entryId: entry.id,
        content: editContent,
        dayId,
      });
      setIsEditing(false);
      toast.success('Note updated');
    } catch (error) {
      toast.error('Failed to update note');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-soft-black border-muted-gray/30">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="text-sm bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow"
              >
                v{entry.version_number}
              </Badge>
              <DialogTitle className="text-lg">AD Note</DialogTitle>
            </div>
            {canEditEntry && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            )}
          </div>
          <DialogDescription className="sr-only">
            View and manage AD note version {entry.version_number}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-gray">
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={entry.creator?.avatar_url} />
                <AvatarFallback className="text-[10px] bg-muted-gray/20">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span>{entry.creator?.display_name || 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                {formattedDate} at {formattedTime}
              </span>
            </div>
          </div>

          {/* Note Content */}
          <div className="bg-charcoal-black rounded-lg p-4 border border-muted-gray/20">
            {isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[200px] bg-soft-black border-muted-gray/30 resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelEdit}
                    disabled={updateEntry.isPending}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={updateEntry.isPending || !editContent.trim()}
                  >
                    {updateEntry.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Save className="w-4 h-4 mr-1" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-bone-white whitespace-pre-wrap">{entry.content}</p>
            )}
          </div>

          <Separator className="bg-muted-gray/20" />

          {/* Comments Section */}
          <AdNoteComments entryId={entry.id} canComment={canEdit} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
