/**
 * ThreadView - Full thread view with replies
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useThread, useReplies } from '@/hooks/useTopics';
import { CommunityThread, CommunityReply } from '@/types/community';
import {
  ArrowLeft,
  Pin,
  Shield,
  MessageSquare,
  Send,
  Loader2,
  MoreVertical,
  Edit,
  Trash2,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ThreadViewProps {
  threadId: string;
  onBack: () => void;
  onEdit?: (thread: CommunityThread) => void;
}

const ThreadView: React.FC<ThreadViewProps> = ({ threadId, onBack, onEdit }) => {
  const { data: thread, isLoading: threadLoading, error: threadError } = useThread(threadId);
  const { replies, isLoading: repliesLoading, createReply, deleteReply } = useReplies(threadId);

  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) {
      toast.error('Please enter a reply');
      return;
    }

    setIsSubmitting(true);
    try {
      await createReply.mutateAsync({
        thread_id: threadId,
        content: replyContent.trim(),
        parent_reply_id: replyingTo || undefined,
      });
      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply posted!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to post reply');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!confirm('Are you sure you want to delete this reply?')) return;

    try {
      await deleteReply.mutateAsync(replyId);
      toast.success('Reply deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete reply');
    }
  };

  if (threadLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  if (threadError || !thread) {
    return (
      <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-6 text-center">
        <p className="text-red-400 mb-4">Failed to load thread</p>
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const authorName = thread.author?.display_name || thread.author?.full_name || thread.author?.username || 'Member';
  const authorInitials = authorName.slice(0, 1).toUpperCase();
  const authorUsername = thread.author?.username || 'member';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-muted-gray hover:text-bone-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Topics
      </button>

      {/* Thread Content */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
        {/* Header */}
        <div className="p-6 border-b border-muted-gray/20">
          <div className="flex items-start gap-4">
            <Link to={`/profile/${authorUsername}`}>
              <Avatar className="w-12 h-12">
                <AvatarImage src={thread.author?.avatar_url || ''} alt={authorName} />
                <AvatarFallback>{authorInitials}</AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {thread.is_pinned && (
                  <Pin className="w-4 h-4 text-accent-yellow" />
                )}
                <h1 className="text-xl font-heading text-bone-white">
                  {thread.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-gray">
                <Link
                  to={`/profile/${authorUsername}`}
                  className="flex items-center gap-1 hover:text-accent-yellow transition-colors"
                >
                  {authorName}
                  {thread.author?.is_order_member && (
                    <Shield className="w-3 h-3 text-emerald-400" />
                  )}
                </Link>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
                {thread.topic && (
                  <>
                    <span>•</span>
                    <Badge variant="outline" className="text-xs border-muted-gray/30">
                      {thread.topic.name}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="prose prose-invert max-w-none text-bone-white/90 whitespace-pre-wrap">
            {thread.content}
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-4 text-sm text-muted-gray">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </div>
      </div>

      {/* Reply Form */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
        <h3 className="font-medium text-bone-white mb-3">Post a Reply</h3>

        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-gray">
            <span>Replying to a comment</span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-accent-yellow hover:text-bone-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <Textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Share your thoughts..."
          className="bg-charcoal-black/50 border-muted-gray/30 min-h-[100px] mb-3"
        />

        <div className="flex justify-end">
          <Button
            onClick={handleSubmitReply}
            disabled={isSubmitting || !replyContent.trim()}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Post Reply
          </Button>
        </div>
      </div>

      {/* Replies */}
      {repliesLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
        </div>
      ) : replies.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-medium text-bone-white">
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </h3>

          {replies.map((reply) => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              onReply={(id) => setReplyingTo(id)}
              onDelete={handleDeleteReply}
            />
          ))}
        </div>
      ) : (
        <div className="bg-charcoal-black/30 border border-muted-gray/10 rounded-lg p-8 text-center">
          <MessageSquare className="w-10 h-10 text-muted-gray/50 mx-auto mb-3" />
          <p className="text-muted-gray">No replies yet. Be the first to respond!</p>
        </div>
      )}
    </div>
  );
};

interface ReplyCardProps {
  reply: CommunityReply;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  depth?: number;
}

const ReplyCard: React.FC<ReplyCardProps> = ({ reply, onReply, onDelete, depth = 0 }) => {
  const authorName = reply.author?.display_name || reply.author?.full_name || reply.author?.username || 'Member';
  const authorInitials = authorName.slice(0, 1).toUpperCase();
  const authorUsername = reply.author?.username || 'member';

  return (
    <div className={cn('bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4', depth > 0 && 'ml-8')}>
      <div className="flex gap-3">
        <Link to={`/profile/${authorUsername}`} className="flex-shrink-0">
          <Avatar className="w-8 h-8">
            <AvatarImage src={reply.author?.avatar_url || ''} alt={authorName} />
            <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 text-sm">
            <Link
              to={`/profile/${authorUsername}`}
              className="font-medium text-bone-white hover:text-accent-yellow transition-colors"
            >
              {authorName}
            </Link>
            {reply.author?.is_order_member && (
              <Shield className="w-3 h-3 text-emerald-400" />
            )}
            <span className="text-muted-gray">
              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
            </span>
          </div>

          <div className="text-sm text-bone-white/90 whitespace-pre-wrap mb-2">
            {reply.content}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-gray">
            <button
              onClick={() => onReply(reply.id)}
              className="hover:text-accent-yellow transition-colors"
            >
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreadView;
