import { useState } from 'react';
import { Trash2, Reply, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactNotes, useCreateContactNote, useDeleteContactNote } from '@/hooks/crm';

interface ContactNotesProps {
  contactId: string;
  currentProfileId: string;
}

const ContactNotes = ({ contactId, currentProfileId }: ContactNotesProps) => {
  const { data, isLoading } = useContactNotes(contactId);
  const createNote = useCreateContactNote();
  const deleteNote = useDeleteContactNote();

  const [noteText, setNoteText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const allNotes = data?.notes || [];

  // Build threaded structure: top-level notes + their replies
  const topLevel = allNotes.filter((n: any) => !n.parent_id);
  const replies = allNotes.filter((n: any) => n.parent_id);
  const replyMap: Record<string, any[]> = {};
  replies.forEach((r: any) => {
    if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
    replyMap[r.parent_id].push(r);
  });

  const handleAdd = () => {
    const content = noteText.trim();
    if (!content) return;
    createNote.mutate(
      { contactId, content },
      { onSuccess: () => setNoteText('') }
    );
  };

  const handleReply = (parentId: string) => {
    const content = replyText.trim();
    if (!content) return;
    createNote.mutate(
      { contactId, content, parentId },
      {
        onSuccess: () => {
          setReplyText('');
          setReplyTo(null);
        },
      }
    );
  };

  const handleDelete = (noteId: string) => {
    deleteNote.mutate({ contactId, noteId });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add new note */}
      <div className="space-y-2">
        <Textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a note..."
          rows={2}
          className="bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-gray">Ctrl+Enter to submit</span>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!noteText.trim() || createNote.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {createNote.isPending ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </div>

      {/* Notes list */}
      {topLevel.length === 0 ? (
        <p className="text-sm text-muted-gray text-center py-4">No notes yet. Add the first one above.</p>
      ) : (
        <div className="space-y-3">
          {topLevel.map((note: any) => (
            <div key={note.id} className="border border-muted-gray/20 rounded-lg overflow-hidden">
              {/* Main note */}
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-bone-white">
                        {note.author_name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-gray">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-bone-white/80 whitespace-pre-wrap">{note.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setReplyTo(replyTo === note.id ? null : note.id)}
                      className="p-1 text-muted-gray hover:text-accent-yellow rounded transition-colors"
                      title="Reply"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                    {(note.author_id === currentProfileId) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="p-1 text-muted-gray hover:text-red-400 rounded transition-colors"
                        disabled={deleteNote.isPending}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Replies */}
              {replyMap[note.id]?.length > 0 && (
                <div className="border-t border-muted-gray/15 bg-muted-gray/5">
                  {replyMap[note.id].map((reply: any) => (
                    <div key={reply.id} className="px-3 py-2 ml-4 border-l-2 border-muted-gray/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-medium text-bone-white">
                              {reply.author_name || 'Unknown'}
                            </span>
                            <span className="text-xs text-muted-gray">
                              {formatDate(reply.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-bone-white/70 whitespace-pre-wrap">{reply.content}</p>
                        </div>
                        {(reply.author_id === currentProfileId) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(reply.id)}
                            className="p-1 text-muted-gray hover:text-red-400 rounded transition-colors shrink-0"
                            disabled={deleteNote.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply input */}
              {replyTo === note.id && (
                <div className="border-t border-muted-gray/15 p-2 bg-muted-gray/5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleReply(note.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 h-8 px-3 text-sm bg-charcoal-black border border-muted-gray/30 rounded text-bone-white placeholder:text-muted-gray focus:outline-none focus:border-accent-yellow/50"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!replyText.trim() || createNote.isPending}
                      className="h-8 px-3 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80 text-xs"
                    >
                      Reply
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setReplyTo(null); setReplyText(''); }}
                      className="h-8 px-2 text-xs text-muted-gray"
                    >
                      Cancel
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactNotes;
