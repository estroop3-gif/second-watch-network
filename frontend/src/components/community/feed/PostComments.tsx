/**
 * PostComments - Comments section for a post
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { usePostComments } from '@/hooks/useFeed';
import { useAuth } from '@/context/AuthContext';
import CommentItem from './CommentItem';
import type { PostComment } from '@/types/community';

interface PostCommentsProps {
  postId: string;
  commentCount: number;
}

const PostComments: React.FC<PostCommentsProps> = ({ postId, commentCount }) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const {
    comments,
    isLoading,
    createComment,
    updateComment,
    deleteComment,
  } = usePostComments(postId);

  // Group comments by parent
  const topLevelComments = comments.filter((c: PostComment) => !c.parent_comment_id);
  const repliesMap = comments.reduce((acc: Record<string, PostComment[]>, c: PostComment) => {
    if (c.parent_comment_id) {
      if (!acc[c.parent_comment_id]) acc[c.parent_comment_id] = [];
      acc[c.parent_comment_id].push(c);
    }
    return acc;
  }, {} as Record<string, PostComment[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await createComment.mutateAsync({
        content: newComment.trim(),
        parent_comment_id: replyingTo || undefined,
      });
      setNewComment('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to create comment:', error);
    }
  };

  const handleEdit = async (id: string, content: string) => {
    try {
      await updateComment.mutateAsync({ id, content });
    } catch (error) {
      console.error('Failed to update comment:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteComment.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  return (
    <div className="border-t border-muted-gray/20 pt-4 mt-4">
      {/* Comment form */}
      {isAuthenticated && (
        <form onSubmit={handleSubmit} className="mb-4">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-gray">
              <span>Replying to comment</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyingTo ? 'Write a reply...' : 'Write a comment...'}
              className="min-h-[60px] bg-charcoal-black/50 border-muted-gray/30 resize-none"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newComment.trim() || createComment.isPending}
              className="self-end"
            >
              {createComment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-gray text-center py-4">
          No comments yet. {isAuthenticated ? 'Be the first to comment!' : 'Sign in to comment.'}
        </p>
      ) : (
        <div className="space-y-4">
          {topLevelComments.map((comment: PostComment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                currentUserId={user?.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReply={(parentId) => setReplyingTo(parentId)}
              />
              {/* Nested replies */}
              {repliesMap[comment.id]?.map((reply: PostComment) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={user?.id}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  isNested
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostComments;
