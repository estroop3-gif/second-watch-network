/**
 * World Card Component
 * Displays a world (series/film) in a card format
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Play, Users } from 'lucide-react';
import type { WorldSummary, World } from '@/types/watch';

interface WorldCardProps {
  world: WorldSummary | World;
  size?: 'sm' | 'md' | 'lg';
  showFollowers?: boolean;
  showEpisodeCount?: boolean;
  className?: string;
}

export function WorldCard({
  world,
  size = 'md',
  showFollowers = true,
  showEpisodeCount = true,
  className,
}: WorldCardProps) {
  const sizeClasses = {
    sm: 'w-40',
    md: 'w-52',
    lg: 'w-72',
  };

  const aspectClasses = {
    sm: 'aspect-[2/3]',
    md: 'aspect-[2/3]',
    lg: 'aspect-video',
  };

  const formatType = world.content_format === 'series' ? 'Series' :
                     world.content_format === 'film' ? 'Film' :
                     world.content_format;

  return (
    <Link
      to={`/watch/worlds/${world.slug}`}
      className={cn(
        'group block flex-shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'relative rounded-lg overflow-hidden bg-charcoal-black/50',
          aspectClasses[size]
        )}
      >
        {world.thumbnail_url ? (
          <img
            src={world.thumbnail_url}
            alt={world.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted-gray/20">
            <Play className="w-12 h-12 text-muted-gray/50" />
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-5 h-5 text-charcoal-black ml-0.5" />
              </div>
              <span className="text-white text-sm font-medium">Watch Now</span>
            </div>
          </div>
        </div>

        {/* Format Badge */}
        <Badge
          variant="secondary"
          className="absolute top-2 left-2 bg-black/60 text-white text-xs"
        >
          {formatType}
        </Badge>
      </div>

      {/* Info */}
      <div className="mt-2 space-y-1">
        <h3 className="font-medium text-bone-white line-clamp-1 group-hover:text-accent-yellow transition-colors">
          {world.title}
        </h3>

        <div className="flex items-center gap-3 text-xs text-muted-gray">
          {showFollowers && world.follower_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {world.follower_count.toLocaleString()}
            </span>
          )}
          {showEpisodeCount && world.episode_count > 0 && (
            <span>
              {world.episode_count} {world.episode_count === 1 ? 'episode' : 'episodes'}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default WorldCard;
