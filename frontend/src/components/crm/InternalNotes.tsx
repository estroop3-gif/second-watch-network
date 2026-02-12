import { useState } from 'react';
import { ChevronDown, ChevronRight, StickyNote, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useThreadNotes,
  useCreateThreadNote,
  useDeleteThreadNote,
} from '@/hooks/crm/useEmail';

interface InternalNotesProps {
  threadId: string;
  currentProfileId: string;
}

const InternalNotes = ({ threadId, currentProfileId }: InternalNotesProps) => {
  const [expanded, setExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');

  const { data: notes } = useThreadNotes(threadId);
  const createNote = useCreateThreadNote();
  const deleteNote = useDeleteThreadNote();

  const allNotes = notes || [];

  const handleAdd = () => {
    const content = noteText.trim();
    if (!content) return;
    createNote.mutate(
      { threadId, content },
      { onSuccess: () => setNoteText('') }
    );
  };

  const handleDelete = (noteId: string) => {
    deleteNote.mutate({ threadId, noteId });
  };

  return (
    <div className="border border-muted-gray/30 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-bone-white hover:bg-muted-gray/10 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-gray" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-gray" />
        )}
        <StickyNote className="h-3.5 w-3.5 text-accent-yellow" />
        <span className="font-medium">Internal Notes</span>
        {allNotes.length > 0 && (
          <span className="text-xs text-muted-gray ml-auto">{allNotes.length}</span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-muted-gray/30">
          {allNotes.length === 0 ? (
            <p className="text-xs text-muted-gray px-3 py-3 text-center">No notes yet</p>
          ) : (
            <div className="divide-y divide-muted-gray/20 max-h-64 overflow-y-auto">
              {allNotes.map((note: any) => (
                <div key={note.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-bone-white truncate">
                          {note.author_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-gray shrink-0">
                          {formatDateTime(note.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-gray whitespace-pre-wrap">{note.content}</p>
                    </div>
                    {note.profile_id === currentProfileId && (
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="p-1 text-muted-gray hover:text-red-400 rounded shrink-0 transition-colors"
                        disabled={deleteNote.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-muted-gray/30 p-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdd();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="h-8 flex-1 text-xs bg-muted-gray/10 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!noteText.trim() || createNote.isPending}
                className="h-8 px-3 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80 text-xs"
              >
                Add
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalNotes;
