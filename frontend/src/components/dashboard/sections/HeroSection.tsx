/**
 * HeroSection
 * Featured world hero banner for the dashboard
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Info, Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorlds, useWatchlist, useWatchlistItems } from '@/hooks/watch';
import { HeroSkeleton } from '../widgets/SectionSkeleton';
import type { SectionProps } from '../config/sectionRegistry';

export function HeroSection({ className = '' }: SectionProps) {
  const { data: worldsData, isLoading } = useWorlds({ limit: 5, featured: true });
  const { add: addToWatchlist, remove: removeFromWatchlist, isAdding, isRemoving } = useWatchlist();
  const { data: watchlistItems } = useWatchlistItems();

  // Get the first featured world
  const featuredWorld = worldsData?.worlds?.[0];

  if (isLoading) {
    return <HeroSkeleton className={className} />;
  }

  if (!featuredWorld) {
    return null;
  }

  // Check if world is in watchlist
  const inWatchlist = watchlistItems?.some(item => item.world_id === featuredWorld.id) ?? false;
  const isWatchlistLoading = isAdding || isRemoving;

  const handleWatchlistToggle = () => {
    if (isWatchlistLoading) return;
    if (inWatchlist) {
      removeFromWatchlist(featuredWorld.id);
    } else {
      addToWatchlist(featuredWorld.id);
    }
  };

  return (
    <motion.div
      className={`relative aspect-[21/9] w-full rounded-xl overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: featuredWorld.thumbnail_url
            ? `url(${featuredWorld.thumbnail_url})`
            : undefined,
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black via-charcoal-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal-black/80 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-12">
        <div className="max-w-2xl">
          <Badge
            variant="outline"
            className="mb-4 border-accent-yellow text-accent-yellow bg-accent-yellow/10"
          >
            Featured
          </Badge>

          <motion.h1
            className="text-3xl md:text-4xl lg:text-5xl font-heading text-bone-white mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {featuredWorld.title}
          </motion.h1>

          {featuredWorld.logline && (
            <motion.p
              className="text-base md:text-lg text-bone-white/80 mb-6 line-clamp-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {featuredWorld.logline}
            </motion.p>
          )}

          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button
              size="lg"
              className="bg-bone-white text-charcoal-black hover:bg-bone-white/90"
              asChild
            >
              <Link to={`/watch/worlds/${featuredWorld.slug}`}>
                <Play className="w-5 h-5 mr-2" />
                Watch Now
              </Link>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="border-bone-white/50 text-bone-white hover:bg-bone-white/10"
              asChild
            >
              <Link to={`/watch/worlds/${featuredWorld.slug}`}>
                <Info className="w-5 h-5 mr-2" />
                More Info
              </Link>
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="text-bone-white hover:bg-bone-white/10"
              onClick={handleWatchlistToggle}
              disabled={isWatchlistLoading}
              title={inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
            >
              {inWatchlist ? (
                <BookmarkCheck className="w-5 h-5" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Decorative corner accent */}
      <div className="absolute top-4 right-4">
        <span className="text-xs uppercase tracking-widest text-accent-yellow/60 font-mono">
          Second Watch Originals
        </span>
      </div>
    </motion.div>
  );
}

export default HeroSection;
