import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  useDiscussionCategories,
  useCreateDiscussionCategory,
  useUpdateDiscussionCategory,
  useDeleteDiscussionCategory,
  useDiscussionThreads,
  useCreateDiscussionThread,
  useUpdateDiscussionThread,
  useDeleteDiscussionThread,
  usePinDiscussionThread,
  useDiscussionThread,
  useDiscussionReplies,
  useCreateDiscussionReply,
  useUpdateDiscussionReply,
  useDeleteDiscussionReply,
} from '@/hooks/crm/useTraining';
import { usePermissions } from '@/hooks/usePermissions';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useToast } from '@/hooks/use-toast';
import {
  saveDraft as saveDraftStorage,
  loadDraft,
  clearDraft as clearDraftStorage,
  buildDraftKey,
} from '@/lib/formDraftStorage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  Plus,
  Search,
  Pin,
  Lock,
  Pencil,
  Trash2,
  ArrowLeft,
  Send,
  Loader2,
  User,
  Clock,
  FolderPlus,
  MessageCircle,
  CornerDownRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) !== 1 ? 's' : ''} ago`;
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '...';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Discussions = () => {
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);
  const { profile } = useEnrichedProfile();
  const { toast } = useToast();

  // ---- Navigation state ----
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // ---- Dialog state ----
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);

  // ---- New category form ----
  const [newCatName, setNewCatName] = useState('');
  const [newCatDescription, setNewCatDescription] = useState('');

  // ---- New thread form ----
  const [newThreadCategoryId, setNewThreadCategoryId] = useState('');
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');

  // ---- Draft persistence for new thread form ----
  const threadDraftKey = buildDraftKey('crm', 'discussion', 'new');
  const threadDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getThreadFormSnapshot = useCallback(() => ({
    newThreadCategoryId, newThreadTitle, newThreadContent,
  }), [newThreadCategoryId, newThreadTitle, newThreadContent]);

  // Persist new thread form changes when dialog is open
  useEffect(() => {
    if (!showNewThread) return;
    if (threadDraftTimerRef.current) clearTimeout(threadDraftTimerRef.current);
    threadDraftTimerRef.current = setTimeout(() => {
      saveDraftStorage(threadDraftKey, getThreadFormSnapshot());
    }, 500);
    return () => { if (threadDraftTimerRef.current) clearTimeout(threadDraftTimerRef.current); };
  }, [showNewThread, threadDraftKey, getThreadFormSnapshot]);

  // ---- Reply form ----
  const [replyContent, setReplyContent] = useState('');

  // ---- Edit thread state ----
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editThreadTitle, setEditThreadTitle] = useState('');
  const [editThreadContent, setEditThreadContent] = useState('');

  // ---- Edit reply state ----
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState('');

  // ---- Edit category state ----
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDescription, setEditCatDescription] = useState('');

  // ---- Queries ----
  const { data: categoriesData, isLoading: loadingCategories } = useDiscussionCategories();
  const categories: any[] = categoriesData?.categories || categoriesData || [];

  const threadParams = useMemo(() => {
    const p: { category_slug?: string; search?: string; sort?: string } = {};
    if (selectedCategorySlug !== 'all') p.category_slug = selectedCategorySlug;
    if (searchQuery.trim()) p.search = searchQuery.trim();
    p.sort = sortBy;
    return p;
  }, [selectedCategorySlug, searchQuery, sortBy]);

  const { data: threadsData, isLoading: loadingThreads } = useDiscussionThreads(threadParams);
  const threads: any[] = threadsData?.threads || threadsData || [];

  const { data: threadDetail, isLoading: loadingDetail } = useDiscussionThread(selectedThreadId || '');
  const thread: any = threadDetail?.thread || threadDetail;

  const { data: repliesData, isLoading: loadingReplies } = useDiscussionReplies(selectedThreadId || '');
  const replies: any[] = repliesData?.replies || repliesData || [];

  // ---- Mutations ----
  const createCategory = useCreateDiscussionCategory();
  const updateCategory = useUpdateDiscussionCategory();
  const deleteCategory = useDeleteDiscussionCategory();
  const createThread = useCreateDiscussionThread();
  const updateThread = useUpdateDiscussionThread();
  const deleteThread = useDeleteDiscussionThread();
  const pinThread = usePinDiscussionThread();
  const createReply = useCreateDiscussionReply();
  const updateReply = useUpdateDiscussionReply();
  const deleteReply = useDeleteDiscussionReply();

  // ---- Author checks ----
  const isThreadAuthor = (t: any) => {
    if (!profile?.id || !t) return false;
    return t.author_id === profile.id || t.profile_id === profile.id;
  };

  const isReplyAuthor = (r: any) => {
    if (!profile?.id || !r) return false;
    return r.author_id === profile.id || r.profile_id === profile.id;
  };

  // ---- Helpers ----

  const openNewThreadDialog = () => {
    // Restore draft for new thread
    const draft = loadDraft<any>(threadDraftKey);
    if (draft?.data) {
      if (draft.data.newThreadCategoryId) setNewThreadCategoryId(draft.data.newThreadCategoryId);
      if (draft.data.newThreadTitle) setNewThreadTitle(draft.data.newThreadTitle);
      if (draft.data.newThreadContent) setNewThreadContent(draft.data.newThreadContent);
    }
    setShowNewThread(true);
  };

  // ---- Handlers ----

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await createCategory.mutateAsync({
        name: newCatName.trim(),
        description: newCatDescription.trim() || undefined,
      });
      toast({ title: 'Category created' });
      setShowNewCategory(false);
      setNewCatName('');
      setNewCatDescription('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !editCatName.trim()) return;
    try {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        name: editCatName.trim(),
        description: editCatDescription.trim() || undefined,
      });
      toast({ title: 'Category updated' });
      setEditingCategory(null);
      setEditCatName('');
      setEditCatDescription('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"? It must have no threads.`)) return;
    try {
      await deleteCategory.mutateAsync(cat.id);
      toast({ title: 'Category deleted' });
      if (selectedCategorySlug === cat.slug) setSelectedCategorySlug('all');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const startEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setEditCatName(cat.name || '');
    setEditCatDescription(cat.description || '');
  };

  const handleCreateThread = async () => {
    if (!newThreadCategoryId || !newThreadTitle.trim() || !newThreadContent.trim()) return;
    try {
      await createThread.mutateAsync({
        category_id: newThreadCategoryId,
        title: newThreadTitle.trim(),
        content: newThreadContent.trim(),
      });
      clearDraftStorage(threadDraftKey);
      toast({ title: 'Thread created' });
      setShowNewThread(false);
      setNewThreadCategoryId('');
      setNewThreadTitle('');
      setNewThreadContent('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateThread = async () => {
    if (!editingThreadId || !editThreadTitle.trim() || !editThreadContent.trim()) return;
    try {
      await updateThread.mutateAsync({
        id: editingThreadId,
        title: editThreadTitle.trim(),
        content: editThreadContent.trim(),
      });
      toast({ title: 'Thread updated' });
      setEditingThreadId(null);
      setEditThreadTitle('');
      setEditThreadContent('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteThread = async (threadId: string) => {
    if (!confirm('Delete this thread and all its replies?')) return;
    try {
      await deleteThread.mutateAsync(threadId);
      toast({ title: 'Thread deleted' });
      if (selectedThreadId === threadId) setSelectedThreadId(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handlePinThread = async (threadId: string, currentlyPinned: boolean) => {
    try {
      await pinThread.mutateAsync({ id: threadId, is_pinned: !currentlyPinned });
      toast({ title: currentlyPinned ? 'Thread unpinned' : 'Thread pinned' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreateReply = async () => {
    if (!selectedThreadId || !replyContent.trim()) return;
    try {
      await createReply.mutateAsync({
        thread_id: selectedThreadId,
        content: replyContent.trim(),
      });
      toast({ title: 'Reply posted' });
      setReplyContent('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdateReply = async () => {
    if (!editingReplyId || !editReplyContent.trim()) return;
    try {
      await updateReply.mutateAsync({
        id: editingReplyId,
        content: editReplyContent.trim(),
      });
      toast({ title: 'Reply updated' });
      setEditingReplyId(null);
      setEditReplyContent('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Delete this reply?')) return;
    try {
      await deleteReply.mutateAsync(replyId);
      toast({ title: 'Reply deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const startEditThread = (t: any) => {
    setEditingThreadId(t.id);
    setEditThreadTitle(t.title || '');
    setEditThreadContent(t.content || '');
  };

  const startEditReply = (r: any) => {
    setEditingReplyId(r.id);
    setEditReplyContent(r.content || '');
  };

  // ---- Sort threads: pinned first, then by chosen sort ----
  const sortedThreads = useMemo(() => {
    const pinned = threads.filter((t: any) => t.is_pinned);
    const unpinned = threads.filter((t: any) => !t.is_pinned);
    return [...pinned, ...unpinned];
  }, [threads]);

  // ---- Avatar component ----
  const AuthorAvatar = ({ name, avatarUrl, size = 'md' }: { name?: string; avatarUrl?: string; size?: 'sm' | 'md' }) => {
    const sizeClasses = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
    return (
      <div className={`${sizeClasses} rounded-full bg-muted-gray/30 flex items-center justify-center shrink-0 overflow-hidden`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name || ''} className="h-full w-full object-cover" />
        ) : (
          <span className="text-bone-white font-medium">{getInitials(name)}</span>
        )}
      </div>
    );
  };

  // ====================================================================
  // Thread Detail View
  // ====================================================================
  if (selectedThreadId) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedThreadId(null);
            setReplyContent('');
            setEditingThreadId(null);
            setEditingReplyId(null);
          }}
          className="text-muted-gray hover:text-bone-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to threads
        </Button>

        {loadingDetail ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-accent-yellow animate-spin" />
            <span className="ml-3 text-muted-gray">Loading thread...</span>
          </div>
        ) : thread ? (
          <div className="space-y-6">
            {/* Thread header card */}
            <div className="bg-[#1a1a1a] border border-muted-gray/30 rounded-lg p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <AuthorAvatar
                    name={thread.author_name || thread.author?.display_name}
                    avatarUrl={thread.author_avatar || thread.author?.avatar_url}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {thread.is_pinned && (
                        <Pin className="h-4 w-4 text-accent-yellow shrink-0" />
                      )}
                      {thread.is_locked && (
                        <Lock className="h-4 w-4 text-muted-gray shrink-0" />
                      )}
                      <h1 className="text-2xl font-heading text-bone-white break-words">
                        {thread.title}
                      </h1>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-gray">
                      <span className="font-medium text-bone-white/80">
                        {thread.author_name || thread.author?.display_name || 'Unknown'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {relativeTime(thread.created_at)}
                      </span>
                      {(thread.category?.name || thread.category_name) && (
                        <Badge className="bg-muted-gray/20 text-bone-white text-xs border-0">
                          {thread.category?.name || thread.category_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Thread actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {(isThreadAuthor(thread) || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditThread(thread)}
                      className="text-muted-gray hover:text-bone-white h-8 w-8 p-0"
                      title="Edit thread"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePinThread(thread.id, !!thread.is_pinned)}
                      className="text-muted-gray hover:text-accent-yellow h-8 w-8 p-0"
                      title={thread.is_pinned ? 'Unpin thread' : 'Pin thread'}
                    >
                      <Pin className="h-4 w-4" />
                    </Button>
                  )}
                  {(isThreadAuthor(thread) || isAdmin) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteThread(thread.id)}
                      className="text-muted-gray hover:text-red-400 h-8 w-8 p-0"
                      title="Delete thread"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Thread body or edit form */}
              {editingThreadId === thread.id ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <Label className="text-sm text-muted-gray mb-1 block">Title</Label>
                    <Input
                      value={editThreadTitle}
                      onChange={(e) => setEditThreadTitle(e.target.value)}
                      className="bg-charcoal-black border-muted-gray/30 text-bone-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-gray mb-1 block">Content</Label>
                    <Textarea
                      value={editThreadContent}
                      onChange={(e) => setEditThreadContent(e.target.value)}
                      className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[150px] resize-y"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingThreadId(null);
                        setEditThreadTitle('');
                        setEditThreadContent('');
                      }}
                      className="text-muted-gray hover:text-bone-white"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdateThread}
                      disabled={!editThreadTitle.trim() || !editThreadContent.trim() || updateThread.isPending}
                      className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                    >
                      {updateThread.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-bone-white/90 whitespace-pre-wrap leading-relaxed">
                  {thread.content}
                </div>
              )}
            </div>

            {/* Replies section */}
            <div className="space-y-1">
              <h2 className="text-lg font-heading text-bone-white flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-accent-yellow" />
                Replies ({replies.length})
              </h2>

              {loadingReplies ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 text-accent-yellow animate-spin" />
                  <span className="ml-2 text-muted-gray">Loading replies...</span>
                </div>
              ) : replies.length === 0 ? (
                <div className="text-center py-8 text-muted-gray">
                  No replies yet. Be the first to respond.
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {replies.map((reply: any) => (
                    <div
                      key={reply.id}
                      className="bg-[#1a1a1a] border border-muted-gray/30 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <CornerDownRight className="h-4 w-4 text-muted-gray/40 mt-1 shrink-0" />
                        <AuthorAvatar
                          name={reply.author_name || reply.author?.display_name}
                          avatarUrl={reply.author_avatar || reply.author?.avatar_url}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-bone-white/80">
                                {reply.author_name || reply.author?.display_name || 'Unknown'}
                              </span>
                              <span className="text-muted-gray flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {relativeTime(reply.created_at)}
                              </span>
                              {reply.updated_at && reply.updated_at !== reply.created_at && (
                                <span className="text-muted-gray/60 text-xs">(edited)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {(isReplyAuthor(reply) || isAdmin) && editingReplyId !== reply.id && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startEditReply(reply)}
                                    className="text-muted-gray hover:text-bone-white h-7 w-7 p-0"
                                    title="Edit reply"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteReply(reply.id)}
                                    className="text-muted-gray hover:text-red-400 h-7 w-7 p-0"
                                    title="Delete reply"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Reply content or edit form */}
                          {editingReplyId === reply.id ? (
                            <div className="mt-2 space-y-2">
                              <Textarea
                                value={editReplyContent}
                                onChange={(e) => setEditReplyContent(e.target.value)}
                                className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[80px] resize-y text-sm"
                              />
                              <div className="flex items-center gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingReplyId(null);
                                    setEditReplyContent('');
                                  }}
                                  className="text-muted-gray hover:text-bone-white text-xs"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleUpdateReply}
                                  disabled={!editReplyContent.trim() || updateReply.isPending}
                                  className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 text-xs"
                                >
                                  {updateReply.isPending ? (
                                    <>
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    'Save'
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-bone-white/90 whitespace-pre-wrap text-sm leading-relaxed">
                              {reply.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reply form */}
            {!thread.is_locked ? (
              <div className="bg-[#1a1a1a] border border-muted-gray/30 rounded-lg p-4">
                <h3 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4 text-accent-yellow" />
                  Post a Reply
                </h3>
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write your reply..."
                  className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[100px] resize-y"
                />
                <div className="flex justify-end mt-3">
                  <Button
                    onClick={handleCreateReply}
                    disabled={!replyContent.trim() || createReply.isPending}
                    className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                  >
                    {createReply.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Post Reply
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] border border-muted-gray/30 rounded-lg p-4 text-center">
                <Lock className="h-5 w-5 text-muted-gray mx-auto mb-2" />
                <p className="text-muted-gray text-sm">This thread is locked. No new replies can be posted.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-gray">Thread not found.</div>
        )}
      </div>
    );
  }

  // ====================================================================
  // Thread List View
  // ====================================================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
            <MessageSquare className="h-8 w-8" />
            Discussion Board
          </h1>
          <p className="text-muted-gray mt-1">Share ideas, ask questions, and connect with the team</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowNewCategory(true)}
              className="border-muted-gray/30 text-bone-white hover:border-accent-yellow hover:text-accent-yellow"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Category
            </Button>
          )}
          <Button
            onClick={openNewThreadDialog}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </Button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Button
          variant={selectedCategorySlug === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedCategorySlug('all')}
          className={
            selectedCategorySlug === 'all'
              ? 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 rounded-full'
              : 'text-muted-gray hover:text-bone-white rounded-full'
          }
        >
          All
        </Button>
        {loadingCategories ? (
          <span className="text-muted-gray text-sm flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </span>
        ) : (
          categories.map((cat: any) => (
            <div key={cat.id} className="flex items-center gap-0.5 shrink-0 group/cat">
              <Button
                variant={selectedCategorySlug === cat.slug ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCategorySlug(cat.slug)}
                className={
                  selectedCategorySlug === cat.slug
                    ? 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 rounded-full'
                    : 'text-muted-gray hover:text-bone-white rounded-full'
                }
              >
                {cat.name}
              </Button>
              {isAdmin && (
                <div className="flex items-center opacity-0 group-hover/cat:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEditCategory(cat)}
                    className="p-1 text-muted-gray hover:text-accent-yellow transition-colors"
                    title="Edit category"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1 text-muted-gray hover:text-red-400 transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Search bar + Sort dropdown */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search threads..."
            className="bg-charcoal-black border-muted-gray/30 text-bone-white pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48 bg-charcoal-black border-muted-gray/30 text-bone-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most_replies">Most Replies</SelectItem>
            <SelectItem value="recently_active">Recently Active</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Thread list */}
      {loadingThreads ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 text-accent-yellow animate-spin" />
          <span className="ml-3 text-muted-gray">Loading threads...</span>
        </div>
      ) : sortedThreads.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="h-12 w-12 text-muted-gray/30 mx-auto mb-3" />
          <p className="text-muted-gray">
            {searchQuery ? 'No threads match your search.' : 'No threads yet. Start a discussion!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedThreads.map((t: any) => (
            <div
              key={t.id}
              className={`bg-[#1a1a1a] border border-muted-gray/30 rounded-lg hover:border-accent-yellow/40 transition-colors cursor-pointer ${
                t.is_pinned ? 'border-l-2 border-l-accent-yellow' : ''
              }`}
              onClick={() => setSelectedThreadId(t.id)}
            >
              <div className="flex items-center gap-4 p-4">
                {/* Author avatar */}
                <AuthorAvatar
                  name={t.author_name || t.author?.display_name}
                  avatarUrl={t.author_avatar || t.author?.avatar_url}
                />

                {/* Thread info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.is_pinned && (
                      <Pin className="h-3.5 w-3.5 text-accent-yellow shrink-0" />
                    )}
                    {t.is_locked && (
                      <Lock className="h-3.5 w-3.5 text-muted-gray shrink-0" />
                    )}
                    <span className="font-medium text-bone-white truncate">
                      {t.title}
                    </span>
                    {(t.category?.name || t.category_name) && (
                      <Badge className="bg-muted-gray/20 text-bone-white text-xs border-0 shrink-0">
                        {t.category?.name || t.category_name}
                      </Badge>
                    )}
                  </div>
                  {/* Content preview */}
                  <p className="text-sm text-muted-gray mt-0.5 truncate">
                    {truncate(t.content || '', 100)}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {t.author_name || t.author?.display_name || 'Unknown'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {relativeTime(t.last_reply_at || t.last_activity_at || t.updated_at || t.created_at)}
                    </span>
                  </div>
                </div>

                {/* Reply count + admin actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-muted-gray text-sm" title={`${t.reply_count ?? 0} replies`}>
                    <MessageCircle className="h-4 w-4" />
                    <span>{t.reply_count ?? 0}</span>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePinThread(t.id, !!t.is_pinned)}
                        className="text-muted-gray hover:text-accent-yellow h-7 w-7 p-0"
                        title={t.is_pinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteThread(t.id)}
                        className="text-muted-gray hover:text-red-400 h-7 w-7 p-0"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- New Category Dialog (admin only) ---- */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent className="bg-[#1a1a1a] border-muted-gray/30 text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              New Category
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              Create a new discussion category to organize threads.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-gray block mb-2">Name</Label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Sales Tips"
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-gray block mb-2">Description (optional)</Label>
              <Textarea
                value={newCatDescription}
                onChange={(e) => setNewCatDescription(e.target.value)}
                placeholder="Brief description of this category..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowNewCategory(false)}
                className="border-muted-gray/30 text-bone-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCategory}
                disabled={!newCatName.trim() || createCategory.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createCategory.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Category'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Edit Category Dialog (admin only) ---- */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => { if (!open) setEditingCategory(null); }}>
        <DialogContent className="bg-[#1a1a1a] border-muted-gray/30 text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-gray block mb-2">Name</Label>
              <Input
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-gray block mb-2">Description (optional)</Label>
              <Textarea
                value={editCatDescription}
                onChange={(e) => setEditCatDescription(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[80px]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingCategory(null)}
                className="border-muted-gray/30 text-bone-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateCategory}
                disabled={!editCatName.trim() || updateCategory.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {updateCategory.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- New Thread Dialog ---- */}
      <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
        <DialogContent className="bg-[#1a1a1a] border-muted-gray/30 text-bone-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              New Thread
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              Start a new discussion thread for the team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-gray block mb-2">Category</Label>
              <Select value={newThreadCategoryId} onValueChange={setNewThreadCategoryId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30 text-bone-white">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-muted-gray block mb-2">Title</Label>
              <Input
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
                placeholder="Thread title..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <div>
              <Label className="text-sm text-muted-gray block mb-2">Content</Label>
              <Textarea
                value={newThreadContent}
                onChange={(e) => setNewThreadContent(e.target.value)}
                placeholder="Write your post..."
                className="bg-charcoal-black border-muted-gray/30 text-bone-white min-h-[150px] resize-y"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowNewThread(false)}
                className="border-muted-gray/30 text-bone-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateThread}
                disabled={
                  !newThreadCategoryId ||
                  !newThreadTitle.trim() ||
                  !newThreadContent.trim() ||
                  createThread.isPending
                }
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createThread.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Thread'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Discussions;
