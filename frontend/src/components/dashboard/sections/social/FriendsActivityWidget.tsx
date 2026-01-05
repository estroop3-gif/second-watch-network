/**
 * FriendsActivityWidget
 * Shows what friends are watching, rating, and adding to their watchlists
 */

import { Link } from 'react-router-dom';
import { useFriendsActivity, type FriendActivity } from '@/hooks/useFriendsActivity';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Bookmark, Star, Play, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

// Activity type icons and labels
const ACTIVITY_CONFIG = {
  watchlist_add: {
    icon: Bookmark,
    label: 'added to watchlist',
    color: 'text-accent-yellow',
  },
  rating: {
    icon: Star,
    label: 'rated',
    color: 'text-accent-yellow',
  },
  watched: {
    icon: Play,
    label: 'watched',
    color: 'text-green-400',
  },
};

// Format relative time
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Render star rating
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          className={`w-3 h-3 ${star <= rating ? 'text-accent-yellow fill-accent-yellow' : 'text-muted-gray'}`}
        />
      ))}
    </div>
  );
}

export function FriendsActivityWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useFriendsActivity(8);

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  // If no friends or no activity, don't show
  if (error || !data || data.activities.length === 0) {
    return null;
  }

  const { activities } = data;

  return (
    <div className={`p-4 bg-charcoal-black border border-cyan-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          <h3 className="font-heading text-bone-white">Friends Activity</h3>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/connections">
            Connections
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Activity Feed */}
      <div className="space-y-3">
        {activities.map((activity: FriendActivity, index: number) => {
          const config = ACTIVITY_CONFIG[activity.type];
          const ActivityIcon = config.icon;

          return (
            <div
              key={`${activity.user_id}-${activity.world_id}-${activity.timestamp}-${index}`}
              className="flex items-start gap-3"
            >
              {/* User Avatar */}
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={activity.user_avatar || undefined} />
                <AvatarFallback className="bg-cyan-500/20 text-cyan-400 text-xs">
                  {getInitials(activity.user_name)}
                </AvatarFallback>
              </Avatar>

              {/* Activity Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap text-sm">
                  <span className="font-medium text-bone-white truncate max-w-[120px]">
                    {activity.user_name}
                  </span>
                  <ActivityIcon className={`w-3.5 h-3.5 ${config.color}`} />
                  <span className="text-muted-gray">{config.label}</span>
                </div>

                {/* World Link */}
                <Link
                  to={`/watch/${activity.world_slug}`}
                  className="flex items-center gap-2 mt-1.5 p-1.5 -ml-1.5 rounded hover:bg-muted-gray/10 transition-colors"
                >
                  {/* World Poster */}
                  {activity.world_poster ? (
                    <img
                      src={activity.world_poster}
                      alt={activity.world_title}
                      className="w-8 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-8 h-12 bg-muted-gray/20 rounded flex items-center justify-center">
                      <Play className="w-3 h-3 text-muted-gray" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-bone-white truncate">
                      {activity.world_title}
                    </p>
                    {activity.type === 'rating' && activity.rating && (
                      <StarRating rating={activity.rating} />
                    )}
                  </div>
                </Link>

                {/* Timestamp */}
                <p className="text-xs text-muted-gray mt-1">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* View More */}
      {activities.length >= 8 && (
        <Button variant="ghost" className="w-full mt-3 text-muted-gray hover:text-bone-white" asChild>
          <Link to="/connections/activity">
            View All Activity
          </Link>
        </Button>
      )}
    </div>
  );
}

export default FriendsActivityWidget;
