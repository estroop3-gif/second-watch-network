/**
 * ActivityCard - Renders a single friend activity item (watchlist add, rating, watched)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Eye, BookmarkPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { FriendActivity } from '@/hooks/useFriendsActivity';

interface ActivityCardProps {
  activity: FriendActivity;
}

function getActivityIcon(type: FriendActivity['type']) {
  switch (type) {
    case 'watchlist_add':
      return <BookmarkPlus className="w-4 h-4 text-accent-yellow" />;
    case 'rating':
      return <Star className="w-4 h-4 text-accent-yellow" />;
    case 'watched':
      return <Eye className="w-4 h-4 text-emerald-400" />;
  }
}

function getActivityText(activity: FriendActivity) {
  switch (activity.type) {
    case 'watchlist_add':
      return (
        <>
          added <strong className="text-bone-white">{activity.world_title}</strong> to their watchlist
        </>
      );
    case 'rating':
      return (
        <>
          rated <strong className="text-bone-white">{activity.world_title}</strong>
          {activity.rating != null && (
            <span className="ml-1 text-accent-yellow">
              {'★'.repeat(Math.round(activity.rating))}
            </span>
          )}
        </>
      );
    case 'watched':
      return (
        <>
          watched <strong className="text-bone-white">{activity.world_title}</strong>
        </>
      );
  }
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity }) => {
  const initials = (activity.user_name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const worldLink = activity.world_slug
    ? `/watch/${activity.world_slug}`
    : `/watch/${activity.world_id}`;

  return (
    <div className="flex gap-3 p-3 bg-charcoal-black/30 border border-muted-gray/10 rounded-lg hover:border-muted-gray/20 transition-colors">
      {/* User Avatar */}
      <Link to={`/profile/${activity.user_id}`} className="flex-shrink-0">
        <Avatar className="w-9 h-9">
          <AvatarImage src={activity.user_avatar || undefined} alt={activity.user_name} />
          <AvatarFallback className="bg-muted-gray/30 text-bone-white text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </Link>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-400">
          <Link
            to={`/profile/${activity.user_id}`}
            className="font-medium text-bone-white hover:text-accent-yellow transition-colors"
          >
            {activity.user_name}
          </Link>{' '}
          {getActivityText(activity)}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {getActivityIcon(activity.type)}
          <span>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span>
        </div>
      </div>

      {/* World Poster Thumbnail */}
      {activity.world_poster && (
        <Link to={worldLink} className="flex-shrink-0">
          <img
            src={activity.world_poster}
            alt={activity.world_title}
            className="w-12 h-16 object-cover rounded"
          />
        </Link>
      )}
    </div>
  );
};

export default ActivityCard;
