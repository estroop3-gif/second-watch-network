/**
 * ThreadCard - Individual thread preview in the topics list
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CommunityThread } from '@/types/community';
import { MessageSquare, Pin, Shield, Eye, Flag, MoreVertical } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ReportDialog from './ReportDialog';
import { useAuth } from '@/context/AuthContext';

interface ThreadCardProps {
  thread: CommunityThread;
  onClick?: (thread: CommunityThread) => void;
}

const ThreadCard: React.FC<ThreadCardProps> = ({ thread, onClick }) => {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const authorName = thread.author?.display_name || thread.author?.full_name || thread.author?.username || 'Member';
  const authorInitials = authorName.slice(0, 1).toUpperCase();
  const authorUsername = thread.author?.username || 'member';

  return (
    <>
    <div
      onClick={() => onClick?.(thread)}
      className={cn(
        'bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors cursor-pointer',
        thread.is_pinned && 'border-accent-yellow/30 bg-accent-yellow/5'
      )}
    >
      <div className="flex gap-4">
        {/* Author Avatar */}
        <Link
          to={`/profile/${authorUsername}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={thread.author?.avatar_url || ''} alt={authorName} />
            <AvatarFallback className="text-sm">{authorInitials}</AvatarFallback>
          </Avatar>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title Row */}
          <div className="flex items-start gap-2 mb-1">
            {thread.is_pinned && (
              <Pin className="w-4 h-4 text-accent-yellow flex-shrink-0 mt-0.5" />
            )}
            <h3 className="font-medium text-bone-white line-clamp-1">
              {thread.title}
            </h3>
          </div>

          {/* Content Preview */}
          <p className="text-sm text-muted-gray line-clamp-2 mb-2">
            {thread.content}
          </p>

          {/* Meta Row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-gray">
            {/* Author */}
            <Link
              to={`/profile/${authorUsername}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 hover:text-accent-yellow transition-colors"
            >
              <span>{authorName}</span>
              {thread.author?.is_order_member && (
                <Shield className="w-3 h-3 text-emerald-400" />
              )}
            </Link>

            <span className="text-muted-gray/50">•</span>

            {/* Time */}
            <span>
              {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
            </span>

            <span className="text-muted-gray/50">•</span>

            {/* Reply Count */}
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {thread.reply_count || 0} {thread.reply_count === 1 ? 'reply' : 'replies'}
            </span>

            {/* Topic Badge (when showing mixed threads) */}
            {thread.topic && (
              <>
                <span className="text-muted-gray/50">•</span>
                <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
                  {thread.topic.name}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 self-center flex items-center gap-1">
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-gray/50 hover:text-white h-8 w-8 p-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() => setReportDialogOpen(true)}
                  className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Report Thread
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Eye className="w-4 h-4 text-muted-gray/50" />
        </div>
      </div>
    </div>

    <ReportDialog
      open={reportDialogOpen}
      onOpenChange={setReportDialogOpen}
      contentType="thread"
      contentId={thread.id}
      contentPreview={thread.title}
    />
    </>
  );
};

export default ThreadCard;
