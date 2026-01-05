/**
 * ShortsWidget
 * TikTok-style vertical video preview widget
 */

import { Link } from 'react-router-dom';
import { useShortsTrending } from '@/hooks/watch';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { Play, Eye, Heart, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';
import type { Short } from '@/types/watch';

// Format large numbers
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function ShortsWidget({ className = '' }: SectionProps) {
  const { data, isLoading, error } = useShortsTrending(6);
  const shorts = data?.shorts || [];

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error || shorts.length === 0) {
    return null;
  }

  return (
    <div className={`p-4 bg-charcoal-black border border-primary-red/30 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-primary-red" />
          <h3 className="font-heading text-bone-white">Shorts</h3>
          <span className="px-2 py-0.5 bg-accent-yellow/20 rounded-full text-xs text-accent-yellow">
            Trending
          </span>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/watch/shorts">
            Watch All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Shorts Grid - Vertical video format */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {shorts.slice(0, 6).map((short: Short, index: number) => (
          <Link
            key={short.id}
            to={`/watch/shorts?start=${short.id}`}
            className="group relative aspect-[9/16] rounded-lg overflow-hidden bg-muted-gray/20"
          >
            {/* Thumbnail */}
            {short.thumbnail_url ? (
              <img
                src={short.thumbnail_url}
                alt={short.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-red/20 to-accent-yellow/20">
                <Play className="w-8 h-8 text-bone-white/50" />
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {/* Play button on hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            </div>

            {/* Stats */}
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <div className="flex items-center gap-2 text-white text-xs">
                <span className="flex items-center gap-0.5">
                  <Eye className="w-3 h-3" />
                  {formatCount(short.view_count)}
                </span>
                {short.like_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Heart className="w-3 h-3" />
                    {formatCount(short.like_count)}
                  </span>
                )}
              </div>
            </div>

            {/* Rank badge for top 3 */}
            {index < 3 && (
              <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-accent-yellow flex items-center justify-center">
                <span className="text-xs font-bold text-charcoal-black">{index + 1}</span>
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Creator attribution for first short */}
      {shorts[0]?.creator && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-gray">
          {shorts[0].creator.avatar_url && (
            <img
              src={shorts[0].creator.avatar_url}
              alt={shorts[0].creator.display_name}
              className="w-5 h-5 rounded-full"
            />
          )}
          <span>Trending from</span>
          <span className="text-bone-white">{shorts[0].creator.display_name}</span>
          {shorts[0].creator.is_verified && (
            <span className="text-accent-yellow text-xs">✓</span>
          )}
        </div>
      )}
    </div>
  );
}

export default ShortsWidget;
