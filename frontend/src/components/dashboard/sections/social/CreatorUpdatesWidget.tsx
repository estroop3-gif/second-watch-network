/**
 * CreatorUpdatesWidget
 * Shows announcements and updates from worlds the user follows
 */

import { Link } from 'react-router-dom';
import { useCreatorUpdates, CreatorUpdate } from '@/hooks/useCreatorUpdates';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Megaphone,
  Film,
  Trophy,
  BarChart3,
  ChevronRight,
  Pin,
} from 'lucide-react';
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

// Get type icon and color
function getTypeConfig(type: CreatorUpdate['announcement_type']) {
  switch (type) {
    case 'bts':
      return { icon: Film, color: 'text-purple-400', label: 'BTS' };
    case 'milestone':
      return { icon: Trophy, color: 'text-accent-yellow', label: 'Milestone' };
    case 'poll':
      return { icon: BarChart3, color: 'text-blue-400', label: 'Poll' };
    case 'announcement':
    default:
      return { icon: Megaphone, color: 'text-orange-400', label: 'Update' };
  }
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

export function CreatorUpdatesWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useCreatorUpdates(6);

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error || !data || data.updates.length === 0) {
    return null;
  }

  const { updates } = data;

  return (
    <div className={`p-4 bg-charcoal-black border border-purple-500/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-purple-400" />
          <h3 className="font-heading text-bone-white">Creator Updates</h3>
          <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
            Following
          </Badge>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/watch/library?tab=following">
            All Updates
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Updates List */}
      <div className="space-y-3">
        {updates.map(update => {
          const typeConfig = getTypeConfig(update.announcement_type);
          const TypeIcon = typeConfig.icon;

          return (
            <Link
              key={update.id}
              to={`/watch/${update.world_slug}`}
              className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-muted-gray/10 transition-colors"
            >
              {/* World Thumbnail */}
              <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden">
                {update.world_thumbnail ? (
                  <img
                    src={update.world_thumbnail}
                    alt={update.world_title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted-gray/20 flex items-center justify-center">
                    <Film className="w-6 h-6 text-muted-gray" />
                  </div>
                )}
                {update.is_pinned && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-accent-yellow rounded-full flex items-center justify-center">
                    <Pin className="w-2.5 h-2.5 text-charcoal-black" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-bone-white text-sm line-clamp-1">
                    {update.title}
                  </h4>
                  <Badge
                    variant="outline"
                    className={`flex-shrink-0 text-xs ${typeConfig.color} border-current/30 bg-current/10 px-1.5 py-0`}
                  >
                    <TypeIcon className="w-3 h-3 mr-1" />
                    {typeConfig.label}
                  </Badge>
                </div>

                {update.content && (
                  <p className="text-xs text-muted-gray line-clamp-2 mt-0.5">
                    {update.content}
                  </p>
                )}

                {/* World & Creator */}
                <div className="flex items-center gap-2 mt-1.5">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src={update.creator_avatar || undefined} />
                    <AvatarFallback className="text-[8px] bg-muted-gray/20">
                      {getInitials(update.creator_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-muted-gray truncate">
                    {update.world_title}
                  </span>
                  <span className="text-xs text-muted-gray">
                    {formatRelativeTime(update.created_at)}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* View All */}
      <Button variant="ghost" className="w-full mt-3 text-muted-gray hover:text-bone-white" asChild>
        <Link to="/watch/library?tab=following">
          View All Creator Updates
        </Link>
      </Button>
    </div>
  );
}

export default CreatorUpdatesWidget;
