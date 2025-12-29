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
import { Badge } from '@/components/ui/badge';
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
  Pin, PinOff, Trash2, Loader2, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 25;

const ThreadsAdminTab = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: topics } = useQuery({
    queryKey: ['admin-community-topics'],
    queryFn: () => api.listCommunityTopicsAdmin(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-community-threads', page, search, topicFilter],
    queryFn: () => api.listThreadsAdmin({
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      search: search || undefined,
      topic_id: topicFilter !== 'all' ? topicFilter : undefined,
    }),
  });

  const threads = data?.threads || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (threadId: string) => api.deleteThreadAdmin(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-threads'] });
      toast.success('Thread deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete thread');
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ threadId, isPinned }: { threadId: string; isPinned: boolean }) =>
      api.pinThreadAdmin(threadId, isPinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-threads'] });
      toast.success('Thread updated');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteThreadsAdmin(ids),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-community-threads'] });
      toast.success(`Deleted ${data.deleted_count} threads`);
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete threads');
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === threads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(threads.map(t => t.id));
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
        <h2 className="text-xl font-semibold text-white">Community Threads</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search threads..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 w-64 bg-zinc-800 border-zinc-700"
            />
          </div>
          <Select value={topicFilter} onValueChange={(v) => {
            setTopicFilter(v);
            setPage(1);
          }}>
            <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700">
              <SelectValue placeholder="All Topics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              {topics?.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.icon} {topic.name}
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
              if (confirm(`Delete ${selectedIds.length} threads?`)) {
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
                  checked={selectedIds.length === threads.length && threads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-zinc-400">Title</TableHead>
              <TableHead className="text-zinc-400">Topic</TableHead>
              <TableHead className="text-zinc-400">Author</TableHead>
              <TableHead className="text-zinc-400">Created</TableHead>
              <TableHead className="text-zinc-400 text-center">Pinned</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {threads.map((thread) => (
              <TableRow key={thread.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(thread.id)}
                    onCheckedChange={() => toggleSelect(thread.id)}
                  />
                </TableCell>
                <TableCell className="font-medium text-white max-w-xs truncate">
                  {thread.title}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {thread.community_topics?.icon} {thread.community_topics?.name}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">
                  {thread.profiles?.full_name || thread.profiles?.username || 'Unknown'}
                </TableCell>
                <TableCell className="text-zinc-400">
                  {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-center">
                  {thread.is_pinned && <Pin className="h-4 w-4 text-yellow-500 mx-auto" />}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => pinMutation.mutate({
                        threadId: thread.id,
                        isPinned: !thread.is_pinned
                      })}
                      title={thread.is_pinned ? 'Unpin' : 'Pin'}
                    >
                      {thread.is_pinned ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this thread?')) {
                          deleteMutation.mutate(thread.id);
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
          Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
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
            Page {page} of {totalPages}
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
    </div>
  );
};

export default ThreadsAdminTab;
