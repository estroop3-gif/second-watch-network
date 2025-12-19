/**
 * CallSheetCommentsPanel - Comments/notes panel for call sheets
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Send,
  Reply,
  Trash2,
  Check,
  CheckCircle,
  MoreVertical,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCallSheetComments, CallSheetComment } from '@/hooks/backlot/useSchedule';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface CallSheetCommentsPanelProps {
  callSheetId: string;
  canEdit: boolean;
}

const CommentItem: React.FC<{
  comment: CallSheetComment;
  onReply: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  canEdit: boolean;
  isResolving: boolean;
  isDeleting: boolean;
  depth?: number;
}> = ({ comment, onReply, onResolve, onDelete, canEdit, isResolving, isDeleting, depth = 0 }) => {
  const initials = comment.user_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`${depth > 0 ? 'ml-8 border-l border-muted-gray/20 pl-4' : ''}`}>
      <div
        className={`p-3 rounded-lg ${
          comment.is_resolved
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-charcoal-black/50 border border-muted-gray/20'
        }`}
      >
        <div className="flex items-start gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={comment.user_avatar_url || undefined} />
            <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-bone-white text-sm">{comment.user_name}</span>
              <span className="text-xs text-muted-gray">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
              {comment.is_resolved && (
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Resolved
                </Badge>
              )}
            </div>

            <p className="text-sm text-bone-white/90 whitespace-pre-wrap">{comment.content}</p>

            {comment.field_reference && (
              <div className="mt-1">
                <Badge variant="outline" className="text-xs text-muted-gray">
                  Re: {comment.field_reference}
                </Badge>
              </div>
            )}

            <div className="flex items-center gap-2 mt-2">
              {depth === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-gray hover:text-bone-white"
                  onClick={() => onReply(comment.id)}
                >
                  <Reply className="w-3 h-3 mr-1" />
                  Reply
                </Button>
              )}

              {canEdit && depth === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs ${
                    comment.is_resolved
                      ? 'text-green-400 hover:text-green-300'
                      : 'text-muted-gray hover:text-bone-white'
                  }`}
                  onClick={() => onResolve(comment.id)}
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3 mr-1" />
                  )}
                  {comment.is_resolved ? 'Unresolve' : 'Resolve'}
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-gray">
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-deep-black border-muted-gray/30">
                  <DropdownMenuItem
                    className="text-red-400 focus:text-red-400"
                    onClick={() => onDelete(comment.id)}
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onResolve={onResolve}
              onDelete={onDelete}
              canEdit={canEdit}
              isResolving={false}
              isDeleting={false}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CallSheetCommentsPanel: React.FC<CallSheetCommentsPanelProps> = ({ callSheetId, canEdit }) => {
  const { toast } = useToast();
  const {
    comments,
    total,
    unresolvedCount,
    isLoading,
    createComment,
    resolveComment,
    deleteComment,
  } = useCallSheetComments(callSheetId);

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync({ content: newComment.trim() });
      setNewComment('');
      toast({
        title: 'Comment Added',
        description: 'Your comment has been posted.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add comment',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;

    try {
      await createComment.mutateAsync({
        content: replyContent.trim(),
        parent_comment_id: parentId,
      });
      setReplyingTo(null);
      setReplyContent('');
      toast({
        title: 'Reply Added',
        description: 'Your reply has been posted.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add reply',
        variant: 'destructive',
      });
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await resolveComment.mutateAsync(commentId);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resolve comment',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await deleteComment.mutateAsync(commentId);
      toast({
        title: 'Comment Deleted',
        description: 'The comment has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete comment',
        variant: 'destructive',
      });
    }
  };

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyContent('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-accent-yellow" />
          <h3 className="font-medium text-bone-white">Comments</h3>
          <Badge variant="outline" className="text-xs">
            {total}
          </Badge>
          {unresolvedCount > 0 && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              {unresolvedCount} unresolved
            </Badge>
          )}
        </div>
      </div>

      {/* New Comment Input */}
      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment or note..."
          className="bg-charcoal-black border-muted-gray/30 min-h-[80px] resize-none"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || createComment.isPending}
            className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90"
          >
            {createComment.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Post Comment
          </Button>
        </div>
      </div>

      {/* Comments List */}
      {comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                onReply={handleReply}
                onResolve={handleResolve}
                onDelete={handleDelete}
                canEdit={canEdit}
                isResolving={resolveComment.isPending}
                isDeleting={deleteComment.isPending}
              />

              {/* Reply Input */}
              {replyingTo === comment.id && (
                <div className="ml-8 mt-2 space-y-2">
                  <Textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a reply..."
                    className="bg-charcoal-black border-muted-gray/30 min-h-[60px] resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyingTo(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSubmitReply(comment.id)}
                      disabled={!replyContent.trim() || createComment.isPending}
                      className="bg-accent-yellow text-deep-black hover:bg-accent-yellow/90"
                    >
                      {createComment.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Reply className="w-4 h-4 mr-1" />
                      )}
                      Reply
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-gray">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No comments yet</p>
          <p className="text-sm">Be the first to add a comment or note.</p>
        </div>
      )}
    </div>
  );
};

export default CallSheetCommentsPanel;
