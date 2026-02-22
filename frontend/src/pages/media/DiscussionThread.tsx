import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Pin, Lock, CheckCircle, Loader2, Eye, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import {
  useMediaDiscussionThread,
  useMediaDiscussionReplies,
  useCreateMediaDiscussionReply,
  useUpdateMediaDiscussionReply,
  useDeleteMediaDiscussionReply,
  usePinMediaDiscussionThread,
  useResolveMediaDiscussionThread,
  useLockMediaDiscussionThread,
  useDeleteMediaDiscussionThread,
} from '@/hooks/media';
import NestedReplyTree from '@/components/media/NestedReplyTree';
import ReplyInput from '@/components/media/ReplyInput';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const DiscussionThread = () => {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAnyRole } = usePermissions();
  const { enrichedProfile } = useEnrichedProfile();
  const isTeam = hasAnyRole(['media_team', 'admin', 'superadmin']);
  const currentUserId = enrichedProfile?.id || '';

  const { data: threadData, isLoading: threadLoading } = useMediaDiscussionThread(threadId);
  const { data: repliesData, isLoading: repliesLoading } = useMediaDiscussionReplies(threadId);

  const createReply = useCreateMediaDiscussionReply();
  const updateReply = useUpdateMediaDiscussionReply();
  const deleteReply = useDeleteMediaDiscussionReply();
  const pinThread = usePinMediaDiscussionThread();
  const resolveThread = useResolveMediaDiscussionThread();
  const lockThread = useLockMediaDiscussionThread();
  const deleteThread = useDeleteMediaDiscussionThread();

  if (threadLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  const thread = threadData?.thread;
  if (!thread) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-gray">Thread not found</p>
        <Link to="/media/discussions" className="text-accent-yellow text-sm hover:underline mt-2 inline-block">
          Back to Discussions
        </Link>
      </div>
    );
  }

  const replies = repliesData?.replies || [];
  const isAuthor = thread.author_id === currentUserId;

  const handleReply = async (content: string, parentReplyId?: string) => {
    try {
      await createReply.mutateAsync({
        thread_id: thread.id,
        content,
        parent_reply_id: parentReplyId,
      });
    } catch {
      toast({ title: 'Failed to post reply', variant: 'destructive' });
    }
  };

  const handleEditReply = async (replyId: string, content: string) => {
    try {
      await updateReply.mutateAsync({ id: replyId, content, threadId: thread.id });
    } catch {
      toast({ title: 'Failed to edit reply', variant: 'destructive' });
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    try {
      await deleteReply.mutateAsync({ id: replyId, threadId: thread.id });
    } catch {
      toast({ title: 'Failed to delete reply', variant: 'destructive' });
    }
  };

  const handlePin = async () => {
    try {
      await pinThread.mutateAsync(thread.id);
      toast({ title: thread.is_pinned ? 'Thread unpinned' : 'Thread pinned' });
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleResolve = async () => {
    try {
      await resolveThread.mutateAsync(thread.id);
      toast({ title: thread.is_resolved ? 'Thread unresolved' : 'Thread resolved' });
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleLock = async () => {
    try {
      await lockThread.mutateAsync(thread.id);
      toast({ title: thread.is_locked ? 'Thread unlocked' : 'Thread locked' });
    } catch {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteThread.mutateAsync(thread.id);
      toast({ title: 'Thread deleted' });
      navigate('/media/discussions');
    } catch {
      toast({ title: 'Failed to delete thread', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/media/discussions')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {thread.is_pinned && <Pin className="h-4 w-4 text-accent-yellow" />}
            <h1 className="text-xl font-heading text-bone-white">{thread.title}</h1>
            {thread.is_locked && <Lock className="h-4 w-4 text-red-400" />}
            {thread.is_resolved && <CheckCircle className="h-4 w-4 text-green-400" />}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray">
            <span>{thread.author_name}</span>
            <span>{formatDate(thread.created_at)}</span>
            <span className="text-accent-yellow/70">{thread.category_name}</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {thread.view_count}</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {thread.reply_count}</span>
          </div>
        </div>
      </div>

      {/* Thread actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isTeam && (
          <>
            <Button size="sm" variant="outline" onClick={handlePin} className="text-xs border-muted-gray/50">
              <Pin className="h-3 w-3 mr-1" /> {thread.is_pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleLock} className="text-xs border-muted-gray/50">
              <Lock className="h-3 w-3 mr-1" /> {thread.is_locked ? 'Unlock' : 'Lock'}
            </Button>
          </>
        )}
        {(isAuthor || isTeam) && (
          <>
            <Button size="sm" variant="outline" onClick={handleResolve} className="text-xs border-muted-gray/50">
              <CheckCircle className="h-3 w-3 mr-1" /> {thread.is_resolved ? 'Unresolve' : 'Resolve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              className="text-xs border-red-900/50 text-red-400 hover:text-red-300"
            >
              Delete Thread
            </Button>
          </>
        )}
      </div>

      {/* Thread content */}
      <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-5">
        <p className="text-sm text-bone-white whitespace-pre-wrap">{thread.content}</p>
      </div>

      {/* Replies */}
      <div>
        <h2 className="text-sm font-medium text-bone-white mb-3">
          Replies ({thread.reply_count})
        </h2>

        {repliesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-accent-yellow" />
          </div>
        ) : (
          <NestedReplyTree
            replies={replies}
            currentUserId={currentUserId}
            isTeam={isTeam}
            isLocked={thread.is_locked}
            onReply={handleReply}
            onEdit={handleEditReply}
            onDelete={handleDeleteReply}
          />
        )}
      </div>

      {/* New reply */}
      {!thread.is_locked ? (
        <div>
          <h3 className="text-xs text-muted-gray mb-2">Reply to thread</h3>
          <ReplyInput
            onSubmit={(content) => handleReply(content)}
            placeholder="Write your reply..."
          />
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-gray flex items-center justify-center gap-2">
            <Lock className="h-4 w-4" />
            This thread is locked. No new replies are allowed.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiscussionThread;
