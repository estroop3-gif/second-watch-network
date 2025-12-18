/**
 * ContinuityNotesPanel - Categorized continuity notes for scenes
 *
 * Categories:
 * - Blocking, Props, Wardrobe, Hair/Makeup, Eyelines
 * - Dialogue, Timing, Set Dressing, Other
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  StickyNote,
  Trash2,
  Edit,
  Save,
  X,
  AlertTriangle,
  MessageSquare,
  Shirt,
  Brush,
  Eye,
  Clock,
  Sofa,
  Users,
  Mic,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useContinuityNotes, useCreateContinuityNote, useUpdateContinuityNote, useDeleteContinuityNote } from '@/hooks/backlot/useContinuity';

interface ContinuityNotesPanelProps {
  projectId: string;
  sceneId: string | null;
  canEdit: boolean;
}

// Note categories with icons
const NOTE_CATEGORIES = [
  { value: 'general', label: 'General', icon: StickyNote, color: 'text-muted-gray' },
  { value: 'blocking', label: 'Blocking', icon: Users, color: 'text-blue-400' },
  { value: 'props', label: 'Props', icon: Sofa, color: 'text-purple-400' },
  { value: 'wardrobe', label: 'Wardrobe', icon: Shirt, color: 'text-pink-400' },
  { value: 'hair_makeup', label: 'Hair/Makeup', icon: Brush, color: 'text-rose-400' },
  { value: 'eyelines', label: 'Eyelines', icon: Eye, color: 'text-cyan-400' },
  { value: 'dialogue', label: 'Dialogue', icon: MessageSquare, color: 'text-green-400' },
  { value: 'timing', label: 'Timing', icon: Clock, color: 'text-amber-400' },
  { value: 'set_dressing', label: 'Set Dressing', icon: Sofa, color: 'text-orange-400' },
  { value: 'sound', label: 'Sound', icon: Mic, color: 'text-indigo-400' },
  { value: 'other', label: 'Other', icon: MoreHorizontal, color: 'text-muted-gray' },
];

interface ContinuityNote {
  id: string;
  scene_id: string;
  category: string;
  content: string;
  is_critical: boolean;
  created_at: string;
  created_by?: {
    display_name?: string;
    full_name?: string;
  };
}

const ContinuityNotesPanel: React.FC<ContinuityNotesPanelProps> = ({
  projectId,
  sceneId,
  canEdit,
}) => {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [editingNote, setEditingNote] = useState<ContinuityNote | null>(null);
  const [newNoteData, setNewNoteData] = useState({
    category: 'general',
    content: '',
    is_critical: false,
  });

  // Data hooks
  const { data: notes = [], isLoading: notesLoading, refetch } = useContinuityNotes({
    projectId,
    sceneId: sceneId || undefined,
    category: filterCategory !== 'all' ? filterCategory : undefined,
  });

  const createNote = useCreateContinuityNote();
  const updateNote = useUpdateContinuityNote();
  const deleteNote = useDeleteContinuityNote();

  // Create note
  const handleCreateNote = async () => {
    if (!sceneId) {
      toast({
        title: 'No scene selected',
        description: 'Please select a scene first',
        variant: 'destructive',
      });
      return;
    }

    if (!newNoteData.content.trim()) {
      toast({
        title: 'Empty note',
        description: 'Please enter note content',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createNote.mutateAsync({
        project_id: projectId,
        scene_id: sceneId,
        category: newNoteData.category,
        content: newNoteData.content,
        is_critical: newNoteData.is_critical,
      });
      toast({ title: 'Note added' });
      setShowAddForm(false);
      setNewNoteData({ category: 'general', content: '', is_critical: false });
      refetch();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to add note',
        variant: 'destructive',
      });
    }
  };

  // Update note
  const handleUpdateNote = async () => {
    if (!editingNote) return;

    try {
      await updateNote.mutateAsync({
        id: editingNote.id,
        category: editingNote.category,
        content: editingNote.content,
        is_critical: editingNote.is_critical,
      });
      toast({ title: 'Note updated' });
      setEditingNote(null);
      refetch();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update note',
        variant: 'destructive',
      });
    }
  };

  // Delete note
  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      await deleteNote.mutateAsync({ id: noteId });
      toast({ title: 'Note deleted' });
      refetch();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  // Get category config
  const getCategoryConfig = (category: string) => {
    return NOTE_CATEGORIES.find(c => c.value === category) || NOTE_CATEGORIES[0];
  };

  // No scene selected
  if (!sceneId) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-muted-gray">
        <StickyNote className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm text-center">Select a scene to view notes</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-muted-gray/20 shrink-0">
        <Select
          value={filterCategory}
          onValueChange={setFilterCategory}
        >
          <SelectTrigger className="w-28 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Notes</SelectItem>
            {NOTE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                <div className="flex items-center gap-1">
                  <cat.icon className={cn('w-3 h-3', cat.color)} />
                  {cat.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <Button
            size="sm"
            variant={showAddForm ? 'secondary' : 'default'}
            className={cn(
              'h-7 text-xs',
              !showAddForm && 'bg-accent-yellow text-charcoal-black hover:bg-bone-white'
            )}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? (
              <>
                <X className="w-3 h-3 mr-1" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-3 h-3 mr-1" />
                Add
              </>
            )}
          </Button>
        )}
      </div>

      {/* Add Note Form */}
      {showAddForm && canEdit && (
        <div className="p-3 border-b border-muted-gray/20 space-y-2 shrink-0">
          <Select
            value={newNoteData.category}
            onValueChange={(v) => setNewNoteData(d => ({ ...d, category: v }))}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-center gap-2">
                    <cat.icon className={cn('w-3 h-3', cat.color)} />
                    {cat.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Note content..."
            value={newNoteData.content}
            onChange={(e) => setNewNoteData(d => ({ ...d, content: e.target.value }))}
            className="h-20 text-sm resize-none"
          />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={newNoteData.is_critical}
                onChange={(e) => setNewNoteData(d => ({ ...d, is_critical: e.target.checked }))}
                className="rounded border-muted-gray/30"
              />
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-muted-gray">Critical</span>
            </label>
            <Button
              size="sm"
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              onClick={handleCreateNote}
              disabled={createNote.isPending}
            >
              {createNote.isPending ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </div>
      )}

      {/* Notes List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {notesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-muted-gray/10" />
            ))
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-gray text-center py-4">
              No notes yet
            </p>
          ) : (
            notes.map((note: ContinuityNote) => {
              const catConfig = getCategoryConfig(note.category);
              const isEditing = editingNote?.id === note.id;

              return (
                <div
                  key={note.id}
                  className={cn(
                    'bg-soft-black border rounded-lg p-3',
                    note.is_critical ? 'border-red-500/30' : 'border-muted-gray/20',
                    isEditing && 'ring-2 ring-accent-yellow'
                  )}
                >
                  {isEditing ? (
                    // Edit Mode
                    <div className="space-y-2">
                      <Select
                        value={editingNote.category}
                        onValueChange={(v) => setEditingNote({ ...editingNote, category: v })}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOTE_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div className="flex items-center gap-1">
                                <cat.icon className={cn('w-3 h-3', cat.color)} />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        value={editingNote.content}
                        onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                        className="h-16 text-sm resize-none"
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingNote.is_critical}
                            onChange={(e) => setEditingNote({ ...editingNote, is_critical: e.target.checked })}
                            className="rounded border-muted-gray/30"
                          />
                          <span className="text-muted-gray">Critical</span>
                        </label>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setEditingNote(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-xs bg-accent-yellow text-charcoal-black"
                            onClick={handleUpdateNote}
                            disabled={updateNote.isPending}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] gap-1', catConfig.color)}
                          >
                            <catConfig.icon className="w-3 h-3" />
                            {catConfig.label}
                          </Badge>
                          {note.is_critical && (
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-gray hover:text-bone-white"
                              onClick={() => setEditingNote(note)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-muted-gray hover:text-red-400"
                              onClick={() => handleDeleteNote(note.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-bone-white">{note.content}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-gray">
                        <span>
                          {new Date(note.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {note.created_by && (
                          <span>by {note.created_by.display_name || note.created_by.full_name}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ContinuityNotesPanel;
