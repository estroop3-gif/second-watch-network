/**
 * AdNoteComments - Threaded comments for AD note entries
 *
 * Features:
 * - Nested comment tree display
 * - Reply button on each comment
 * - Edit/delete own comments
 * - Add new comment form
 * - Collapse/expand threads
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MessageSquare,
  Reply,
  Edit2,
  Trash2,
  Send,
  X,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAdNoteComments,
  useAddAdNoteComment,
  useUpdateAdNoteComment,
  useDeleteAdNoteComment,
  AdNoteComment,
} from '@/hooks/backlot/useAdNotes';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface AdNoteCommentsProps {
  entryId: string;
  canComment: boolean;
  className?: string;
}

interface CommentItemProps {
  comment: AdNoteComment;
  entryId: string;
  currentUserId: string | null;
  canComment: boolean;
  depth?: number;
  onReply: (parentId: string) => void;
  replyingTo: string | null;
  onCancelReply: () => void;
  onSubmitReply: (content: string, parentId: string) => Promise<void>;
  isSubmitting: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  entryId,
  currentUserId,
  canComment,
  depth = 0,
  onReply,
  replyingTo,
  onCancelReply,
  onSubmitReply,
  isSubmitting,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [replyContent, setReplyContent] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const updateComment = useUpdateAdNoteComment();
  const deleteComment = useDeleteAdNoteComment();

  const isOwner = currentUserId === comment.created_by;
  const hasReplies = comment.replies && comment.replies.length > 0;
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

  const initials = comment.creator?.display_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??';

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await updateComment.mutateAsync({
        commentId: comment.id,
        content: editContent,
        entryId,
      });
      setIsEditing(false);
      toast.success('Comment updated');
    } catch (error) {
      toast.error('Failed to update comment');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment.mutateAsync({ commentId: comment.id, entryId });
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) return;
    await onSubmitReply(replyContent, comment.id);
    setReplyContent('');
  };

  const maxDepth = 3;
  const isShowingReplyForm = replyingTo === comment.id;

  return (
    <div className={cn('relative', depth > 0 && 'ml-4 pl-3 border-l border-muted-gray/20')}>
      <div className="py-2">
        {/* Comment Header */}
        <div className="flex items-start gap-2">
          <Avatar className="w-6 h-6 flex-shrink-0">
            <AvatarImage src={comment.creator?.avatar_url} />
            <AvatarFallback className="text-[10px] bg-muted-gray/20">{initials}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-bone-white">
                {comment.creator?.display_name || 'Unknown'}
              </span>
              <span className="text-xs text-muted-gray">{timeAgo}</span>
              {comment.is_edited && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  edited
                </Badge>
              )}
            </div>

            {/* Content or Edit Form */}
            {isEditing ? (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] bg-charcoal-black border-muted-gray/30 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleEdit}
                    disabled={updateComment.isPending}
                    className="h-7"
                  >
                    {updateComment.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Save'
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(comment.content);
                    }}
                    className="h-7"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-bone-white/90 mt-1 whitespace-pre-wrap">
                {comment.content}
              </p>
            )}

            {/* Actions */}
            {!isEditing && (
              <div className="flex items-center gap-2 mt-2">
                {canComment && depth < maxDepth && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-gray hover:text-bone-white"
                    onClick={() => onReply(comment.id)}
                  >
                    <Reply className="w-3 h-3 mr-1" />
                    Reply
                  </Button>
                )}
                {isOwner && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-gray hover:text-bone-white"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-gray hover:text-red-400"
                      onClick={handleDelete}
                      disabled={deleteComment.isPending}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Reply Form */}
            {isShowingReplyForm && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="min-h-[60px] bg-charcoal-black border-muted-gray/30 text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleReplySubmit}
                    disabled={isSubmitting || !replyContent.trim()}
                    className="h-7"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <Send className="w-3 h-3 mr-1" />
                    )}
                    Reply
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onCancelReply} className="h-7">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapse/Expand Replies Toggle */}
        {hasReplies && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-8 mt-1 h-6 px-2 text-xs text-muted-gray"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <>
                <ChevronRight className="w-3 h-3 mr-1" />
                Show {comment.replies?.length} {comment.replies?.length === 1 ? 'reply' : 'replies'}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Hide replies
              </>
            )}
          </Button>
        )}
      </div>

      {/* Nested Replies */}
      {hasReplies && !isCollapsed && (
        <div className="mt-1">
          {comment.replies?.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              entryId={entryId}
              currentUserId={currentUserId}
              canComment={canComment}
              depth={depth + 1}
              onReply={onReply}
              replyingTo={replyingTo}
              onCancelReply={onCancelReply}
              onSubmitReply={onSubmitReply}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const AdNoteComments: React.FC<AdNoteCommentsProps> = ({
  entryId,
  canComment,
  className,
}) => {
  const { profile } = useAuth();
  const { data: comments, isLoading } = useAdNoteComments(entryId);
  const addComment = useAddAdNoteComment();

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const currentUserId = profile?.id || null;

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      await addComment.mutateAsync({
        entryId,
        content: newComment,
      });
      setNewComment('');
      toast.success('Comment added');
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleSubmitReply = async (content: string, parentId: string) => {
    try {
      await addComment.mutateAsync({
        entryId,
        content,
        parentCommentId: parentId,
      });
      setReplyingTo(null);
      toast.success('Reply added');
    } catch (error) {
      toast.error('Failed to add reply');
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const commentCount = comments?.length || 0;

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-muted-gray" />
        <span className="text-sm font-medium text-bone-white">
          Comments {commentCount > 0 && `(${commentCount})`}
        </span>
      </div>

      {/* New Comment Form */}
      {canComment && (
        <div className="mb-4 space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="min-h-[60px] bg-charcoal-black border-muted-gray/30 text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmitComment}
              disabled={addComment.isPending || !newComment.trim()}
            >
              {addComment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Comment
            </Button>
          </div>
        </div>
      )}

      {/* Comments List */}
      {commentCount === 0 ? (
        <div className="text-center py-6">
          <MessageSquare className="w-8 h-8 mx-auto text-muted-gray/50 mb-2" />
          <p className="text-sm text-muted-gray">No comments yet</p>
          {canComment && (
            <p className="text-xs text-muted-gray/70 mt-1">Be the first to comment</p>
          )}
        </div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {comments?.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              entryId={entryId}
              currentUserId={currentUserId}
              canComment={canComment}
              onReply={(parentId) => setReplyingTo(parentId)}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              onSubmitReply={handleSubmitReply}
              isSubmitting={addComment.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};
