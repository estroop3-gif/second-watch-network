/**
 * CommunityBuzzWidget
 * Shows trending community discussions and hot topics
 */

import { Link } from 'react-router-dom';
import { useTrendingDiscussions } from '@/hooks/useTrendingDiscussions';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, TrendingUp, Flame, Eye, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get initials from name
function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function CommunityBuzzWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useTrendingDiscussions('7d', 5);

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error || !data || data.threads.length === 0) {
    return null;
  }

  const { threads } = data;

  return (
    <div className={`p-4 bg-charcoal-black border border-orange-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          <h3 className="font-heading text-bone-white">Community Buzz</h3>
          <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
            This Week
          </Badge>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/community">
            Community
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Trending Threads */}
      <div className="space-y-3">
        {threads.map((thread, index) => (
          <Link
            key={thread.id}
            to={`/community/thread/${thread.id}`}
            className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted-gray/10 transition-colors"
          >
            {/* Rank/Hot indicator */}
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
              {thread.is_hot ? (
                <Flame className="w-5 h-5 text-orange-400" />
              ) : (
                <span className="text-sm font-bold text-muted-gray">#{index + 1}</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-bone-white text-sm line-clamp-2">
                  {thread.title}
                </h4>
                {thread.is_hot && (
                  <Badge className="flex-shrink-0 bg-orange-500 text-white text-xs px-1.5 py-0">
                    HOT
                  </Badge>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-gray">
                {/* Topic */}
                {thread.topic_name && (
                  <span className="px-1.5 py-0.5 bg-muted-gray/20 rounded text-muted-gray">
                    {thread.topic_name}
                  </span>
                )}

                {/* Stats */}
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {thread.reply_count}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  {thread.view_count}
                </span>
              </div>

              {/* Author & Time */}
              <div className="flex items-center gap-2 mt-1.5">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={thread.user_avatar || undefined} />
                  <AvatarFallback className="text-[8px] bg-muted-gray/20">
                    {getInitials(thread.user_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-gray">
                  {thread.user_name || 'Anonymous'} · {formatRelativeTime(thread.created_at)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* View All */}
      <Button variant="ghost" className="w-full mt-3 text-muted-gray hover:text-bone-white" asChild>
        <Link to="/community">
          Browse All Discussions
        </Link>
      </Button>
    </div>
  );
}

export default CommunityBuzzWidget;
