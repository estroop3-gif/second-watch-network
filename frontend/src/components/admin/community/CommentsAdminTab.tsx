import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trash2, Loader2, Search, ChevronLeft, ChevronRight, Ban
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import ForumBanDialog from './ForumBanDialog';

const PAGE_SIZE = 25;

const CommentsAdminTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [threadFilter, setThreadFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [banDialogUser, setBanDialogUser] = useState<{ id: string; name: string } | null>(null);

  const { data: threads } = useQuery({
    queryKey: ['admin-community-threads-list'],
    queryFn: () => api.listThreadsAdmin({ limit: 100 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-community-replies', page, search, threadFilter],
    queryFn: () => api.listRepliesAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      thread_id: threadFilter !== 'all' ? threadFilter : undefined,
    }),
  });

  const replies = data?.replies || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (replyId: string) => api.deleteReplyAdmin(replyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-replies'] });
      toast.success('Reply deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete reply');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => api.deleteReplyAdmin(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-replies'] });
      toast.success(`Deleted ${selectedIds.length} replies`);
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete replies');
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === replies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(replies.map(r => r.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-xl font-semibold text-white">Community Comments</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search comments..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 w-64 bg-zinc-800 border-zinc-700"
            />
          </div>
          <Select value={threadFilter} onValueChange={(v) => {
            setThreadFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-64 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="All Threads" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Threads</SelectItem>
              {threads?.threads?.map((thread) => (
                <SelectItem key={thread.id} value={thread.id}>
                  {thread.title?.substring(0, 40)}...
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-zinc-800 rounded-lg">
          <span className="text-sm text-zinc-400">
            {selectedIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Delete ${selectedIds.length} comments?`)) {
                bulkDeleteMutation.mutate(selectedIds);
              }
            }}
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Delete Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear Selection
          </Button>
        </div>
      )}

      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.length === replies.length && replies.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-zinc-400">Content</TableHead>
              <TableHead className="text-zinc-400">Thread</TableHead>
              <TableHead className="text-zinc-400">Author</TableHead>
              <TableHead className="text-zinc-400">Created</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {replies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                  No comments found
                </TableCell>
              </TableRow>
            ) : replies.map((reply) => (
              <TableRow key={reply.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(reply.id)}
                    onCheckedChange={() => toggleSelect(reply.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-white max-w-md">
                  <p className="truncate">{reply.content}</p>
                </TableCell>
                <TableCell className="text-zinc-400 max-w-xs truncate">
                  {reply.thread?.title || 'Unknown thread'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {reply.author?.full_name || reply.author?.username || 'Unknown'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBanDialogUser({
                        id: reply.user_id,
                        name: reply.author?.full_name || reply.author?.username || 'Unknown User'
                      })}
                      title="Ban User from Forum"
                    >
                      <Ban className="h-4 w-4 text-orange-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this comment?')) {
                          deleteMutation.mutate(reply.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">
          Showing {total > 0 ? ((page - 1) * PAGE_SIZE) + 1 : 0} - {Math.min(page * PAGE_SIZE, total)} of {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-zinc-400">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Forum Ban Dialog */}
      {banDialogUser && (
        <ForumBanDialog
          open={!!banDialogUser}
          onOpenChange={(open) => !open && setBanDialogUser(null)}
          userId={banDialogUser.id}
          userName={banDialogUser.name}
          onSuccess={() => {
            setBanDialogUser(null);
            queryClient.invalidateQueries({ queryKey: ['admin-community-replies'] });
          }}
        />
      )}
    </div>
  );
};

export default CommentsAdminTab;
