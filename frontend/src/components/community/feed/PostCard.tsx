/**
 * PostCard - Individual post display in the feed
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Heart,
  MessageCircle,
  MoreVertical,
  Globe,
  Users,
  Pencil,
  Trash2,
  Flag,
  Shield,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import ImageGallery from './ImageGallery';
import LinkPreview from './LinkPreview';
import PostComments from './PostComments';
import type { CommunityPost } from '@/types/community';

interface PostCardProps {
  post: CommunityPost;
  onLike: (postId: string) => void;
  onUnlike: (postId: string) => void;
  onEdit?: (post: CommunityPost) => void;
  onDelete?: (postId: string) => void;
  isLiking?: boolean;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  onLike,
  onUnlike,
  onEdit,
  onDelete,
  isLiking = false,
}) => {
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [showComments, setShowComments] = useState(false);

  const authorName =
    post.author?.display_name ||
    post.author?.full_name ||
    post.author?.username ||
    'Member';
  const authorInitials = authorName.slice(0, 1).toUpperCase();
  const authorUsername = post.author?.username || 'member';
  const isOwner = user?.id === post.user_id;

  const handleLikeClick = () => {
    if (!isAuthenticated) return;
    if (post.is_liked) {
      onUnlike(post.id);
    } else {
      onLike(post.id);
    }
  };

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <Link to={`/profile/${authorUsername}`} className="flex-shrink-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={post.author?.avatar_url || ''} alt={authorName} />
            <AvatarFallback className="text-sm">{authorInitials}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/profile/${authorUsername}`}
              className="font-medium text-bone-white hover:text-accent-yellow transition-colors"
            >
              {authorName}
            </Link>
            {post.author?.is_order_member && (
              <Shield className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-gray">
            <span>
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </span>
            <span>•</span>
            {post.visibility === 'public' ? (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Public
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                Connections
              </span>
            )}
          </div>
        </div>

        {/* Actions dropdown */}
        {isAuthenticated && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-gray/50 hover:text-white h-8 w-8 p-0"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwner && (
                <>
                  <DropdownMenuItem onClick={() => onEdit?.(post)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Post
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete?.(post.id)}
                    className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Post
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem className="text-muted-gray">
                <Flag className="h-4 w-4 mr-2" />
                Report Post
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      <div className="mb-3">
        <p className="text-bone-white whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Images */}
      {post.images && post.images.length > 0 && (
        <ImageGallery images={post.images} />
      )}

      {/* Link Preview */}
      {post.link_url && (
        <LinkPreview
          url={post.link_url}
          title={post.link_title}
          description={post.link_description}
          image={post.link_image}
          siteName={post.link_site_name}
        />
      )}

      {/* Engagement stats */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-muted-gray/20">
        {/* Like button */}
        <button
          onClick={handleLikeClick}
          disabled={!isAuthenticated || isLiking}
          className={cn(
            'flex items-center gap-2 text-sm transition-colors',
            post.is_liked
              ? 'text-primary-red'
              : 'text-muted-gray hover:text-primary-red',
            !isAuthenticated && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLiking ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Heart
              className={cn('w-5 h-5', post.is_liked && 'fill-current')}
            />
          )}
          <span>{post.like_count}</span>
        </button>

        {/* Comments button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm text-muted-gray hover:text-accent-yellow transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{post.comment_count}</span>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <PostComments postId={post.id} commentCount={post.comment_count} />
      )}
    </div>
  );
};

export default PostCard;
