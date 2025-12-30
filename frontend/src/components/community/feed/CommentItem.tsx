/**
 * CommentItem - Individual comment display
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Shield, MoreVertical, Pencil, Trash2, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { PostComment } from '@/types/community';

interface CommentItemProps {
  comment: PostComment;
  currentUserId?: string;
  onEdit?: (id: string, content: string) => void;
  onDelete?: (id: string) => void;
  onReply?: (parentId: string) => void;
  isNested?: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onEdit,
  onDelete,
  onReply,
  isNested = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const authorName =
    comment.author?.display_name ||
    comment.author?.full_name ||
    comment.author?.username ||
    'Member';
  const authorInitials = authorName.slice(0, 1).toUpperCase();
  const authorUsername = comment.author?.username || 'member';
  const isOwner = currentUserId === comment.user_id;

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onEdit?.(comment.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  return (
    <div className={cn('flex gap-3', isNested && 'ml-8 mt-3')}>
      <Link to={`/profile/${authorUsername}`} className="flex-shrink-0">
        <Avatar className="w-8 h-8">
          <AvatarImage src={comment.author?.avatar_url || ''} alt={authorName} />
          <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
        </Avatar>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="bg-charcoal-black/50 rounded-lg p-3">
          {/* Author info */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <Link
                to={`/profile/${authorUsername}`}
                className="text-sm font-medium text-bone-white hover:text-accent-yellow transition-colors"
              >
                {authorName}
              </Link>
              {comment.author?.is_order_member && (
                <Shield className="w-3 h-3 text-emerald-400" />
              )}
              <span className="text-xs text-muted-gray">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>

            {isOwner && !isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-gray/50 hover:text-white h-6 w-6 p-0"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete?.(comment.id)}
                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] bg-charcoal-black border-muted-gray/30"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-bone-white whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>

        {/* Reply button */}
        {!isEditing && onReply && !isNested && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-gray hover:text-accent-yellow mt-1 h-6 px-2"
            onClick={() => onReply(comment.id)}
          >
            <Reply className="w-3 h-3 mr-1" />
            Reply
          </Button>
        )}
      </div>
    </div>
  );
};

export default CommentItem;
