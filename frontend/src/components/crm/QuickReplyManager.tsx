import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Loader2, Check, X } from 'lucide-react';
import {
  useQuickReplies, useCreateQuickReply, useUpdateQuickReply, useDeleteQuickReply,
} from '@/hooks/crm/useEmail';
import { useToast } from '@/hooks/use-toast';

interface QuickReplyManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuickReplyManager = ({ open, onOpenChange }: QuickReplyManagerProps) => {
  const { data: repliesData, isLoading } = useQuickReplies();
  const createReply = useCreateQuickReply();
  const updateReply = useUpdateQuickReply();
  const deleteReply = useDeleteQuickReply();
  const { toast } = useToast();

  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  const replies = Array.isArray(repliesData?.quick_replies) ? repliesData.quick_replies : Array.isArray(repliesData) ? repliesData : [];
  const userReplies = replies.filter((r: any) => !r.is_system);
  const systemReplies = replies.filter((r: any) => r.is_system);

  const handleCreate = () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    createReply.mutate(
      { title: newTitle.trim(), body_text: newBody.trim() },
      {
        onSuccess: () => {
          setNewTitle('');
          setNewBody('');
          toast({ title: 'Created', description: 'Quick reply added.' });
        },
        onError: () => toast({ title: 'Error', description: 'Failed to create quick reply.', variant: 'destructive' }),
      },
    );
  };

  const handleUpdate = (id: string) => {
    if (!editTitle.trim() || !editBody.trim()) return;
    updateReply.mutate(
      { id, data: { title: editTitle.trim(), body_text: editBody.trim() } },
      {
        onSuccess: () => {
          setEditingId(null);
          toast({ title: 'Updated', description: 'Quick reply updated.' });
        },
        onError: () => toast({ title: 'Error', description: 'Failed to update quick reply.', variant: 'destructive' }),
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteReply.mutate(id, {
      onSuccess: () => toast({ title: 'Deleted', description: 'Quick reply removed.' }),
      onError: () => toast({ title: 'Error', description: 'Failed to delete quick reply.', variant: 'destructive' }),
    });
  };

  const startEdit = (reply: any) => {
    setEditingId(reply.id);
    setEditTitle(reply.title);
    setEditBody(reply.body_text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Manage Quick Replies</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Create and edit your custom quick reply templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add New */}
          <div className="space-y-2 p-3 rounded-lg border border-muted-gray/30 bg-muted-gray/5">
            <Input
              placeholder="Title (e.g. 'Thanks!')"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="bg-charcoal-black border-muted-gray text-sm"
            />
            <Input
              placeholder="Reply text..."
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              className="bg-charcoal-black border-muted-gray text-sm"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={createReply.isPending || !newTitle.trim() || !newBody.trim()}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {createReply.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Quick Reply
            </Button>
          </div>

          {/* User Replies */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-gray" />
              </div>
            )}

            {userReplies.map((r: any) => (
              <div key={r.id} className="p-3 rounded-lg border border-muted-gray/20">
                {editingId === r.id ? (
                  <div className="space-y-2">
                    <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="bg-charcoal-black border-muted-gray text-sm" />
                    <Input value={editBody} onChange={e => setEditBody(e.target.value)} className="bg-charcoal-black border-muted-gray text-sm" />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleUpdate(r.id)} disabled={updateReply.isPending} className="text-accent-yellow">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-muted-gray">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-bone-white">{r.title}</div>
                      <p className="text-xs text-muted-gray mt-0.5 line-clamp-2">{r.body_text}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(r)} className="text-muted-gray hover:text-bone-white h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)} disabled={deleteReply.isPending} className="text-muted-gray hover:text-primary-red h-7 w-7 p-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {userReplies.length === 0 && !isLoading && (
              <p className="text-center text-sm text-muted-gray py-4">No custom quick replies yet</p>
            )}
          </div>

          {/* System Replies (read-only) */}
          {systemReplies.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-gray uppercase tracking-wider px-1">System Defaults</div>
              {systemReplies.map((r: any) => (
                <div key={r.id} className="p-3 rounded-lg border border-muted-gray/10 bg-muted-gray/5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-bone-white/70">{r.title}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-gray/40 text-muted-gray">System</Badge>
                  </div>
                  <p className="text-xs text-muted-gray mt-0.5">{r.body_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickReplyManager;
