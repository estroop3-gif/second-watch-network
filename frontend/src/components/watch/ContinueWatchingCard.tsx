/**
 * Continue Watching Card Component
 * Shows episode with progress bar
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import type { WatchHistoryItem } from '@/types/watch';

interface ContinueWatchingCardProps {
  item: WatchHistoryItem;
  className?: string;
}

export function ContinueWatchingCard({
  item,
  className,
}: ContinueWatchingCardProps) {
  const progress = item.duration_seconds
    ? (item.position_seconds / item.duration_seconds) * 100
    : 0;

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const remainingSeconds = (item.duration_seconds || 0) - item.position_seconds;

  return (
    <Link
      to={`/watch/episode/${item.episode_id}?t=${Math.floor(item.position_seconds)}`}
      className={cn(
        'group block flex-shrink-0 w-72',
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video rounded-lg overflow-hidden bg-charcoal-black/50">
        {item.episode?.thumbnail_url || item.world?.thumbnail_url ? (
          <img
            src={item.episode?.thumbnail_url || item.world?.thumbnail_url}
            alt={item.episode?.title || item.world?.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted-gray/20">
            <Play className="w-12 h-12 text-muted-gray/50" />
          </div>
        )}

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
          <div
            className="h-full bg-primary-red"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-7 h-7 text-charcoal-black ml-1" />
          </div>
        </div>

        {/* Remaining Time Badge */}
        <div className="absolute bottom-3 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
          {remainingSeconds > 0
            ? `${formatTime(remainingSeconds)} left`
            : 'Almost done'}
        </div>
      </div>

      {/* Info */}
      <div className="mt-2 space-y-1">
        <h3 className="font-medium text-bone-white line-clamp-1 group-hover:text-accent-yellow transition-colors">
          {item.episode?.title || 'Untitled Episode'}
        </h3>
        <p className="text-sm text-muted-gray line-clamp-1">
          {item.world?.title}
          {item.episode && ` - E${item.episode.episode_number}`}
        </p>
      </div>
    </Link>
  );
}

export default ContinueWatchingCard;
