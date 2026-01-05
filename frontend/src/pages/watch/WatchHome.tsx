/**
 * Watch Home Page
 * Netflix-style home with content lanes
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useContinueWatching,
  useWorlds,
  useLiveEvents,
  useFollowing,
  useShortsTrending,
} from '@/hooks/watch';
import {
  ContentLane,
  WorldCard,
  ContinueWatchingCard,
} from '@/components/watch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Play,
  Radio,
  Flame,
  Heart,
  Clock,
  Film,
  Tv,
  Sparkles,
} from 'lucide-react';

export function WatchHome() {
  const { session } = useAuth();

  // Data fetching
  const { data: continueWatching, isLoading: loadingContinue } = useContinueWatching(10);
  const { data: liveEvents, isLoading: loadingLive } = useLiveEvents();
  const { data: following, isLoading: loadingFollowing } = useFollowing(20);
  const { data: allWorlds, isLoading: loadingWorlds } = useWorlds({ limit: 20 });
  const { data: seriesWorlds } = useWorlds({ content_format: 'series', limit: 10 });
  const { data: filmWorlds } = useWorlds({ content_format: 'film', limit: 10 });
  const { data: trendingShorts } = useShortsTrending(10);

  // Hero section - feature a random world or live event
  const featuredWorld = allWorlds?.worlds?.[0];

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Hero Section */}
      {featuredWorld && (
        <div className="relative h-[60vh] md:h-[70vh]">
          {/* Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: featuredWorld.thumbnail_url
                ? `url(${featuredWorld.thumbnail_url})`
                : undefined,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-charcoal-black via-charcoal-black/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black via-transparent to-charcoal-black/30" />
          </div>

          {/* Content */}
          <div className="relative h-full flex items-center px-4 md:px-8 lg:px-16">
            <div className="max-w-2xl">
              <Badge className="mb-4 bg-accent-yellow text-charcoal-black">
                Featured
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading text-bone-white mb-4">
                {featuredWorld.title}
              </h1>
              {'logline' in featuredWorld && featuredWorld.logline && (
                <p className="text-lg text-bone-white/80 mb-6 line-clamp-3">
                  {featuredWorld.logline}
                </p>
              )}
              <div className="flex items-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="bg-bone-white text-charcoal-black hover:bg-bone-white/90"
                >
                  <Link to={`/watch/worlds/${featuredWorld.slug}`}>
                    <Play className="w-5 h-5 mr-2" />
                    Watch Now
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-bone-white/50 text-bone-white hover:bg-bone-white/10"
                >
                  <Link to={`/watch/worlds/${featuredWorld.slug}`}>
                    More Info
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content Lanes */}
      <div className="relative z-10 -mt-20 space-y-8 pb-12">
        {/* Live Events Banner */}
        {liveEvents && liveEvents.length > 0 && (
          <div className="mx-4 md:mx-8 p-4 rounded-lg bg-primary-red/20 border border-primary-red/50">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-primary-red animate-pulse" />
              <span className="text-bone-white font-medium">
                {liveEvents.length} Live {liveEvents.length === 1 ? 'Event' : 'Events'} Now
              </span>
              <Link
                to="/watch/live"
                className="ml-auto text-sm text-accent-yellow hover:text-bone-white"
              >
                Watch Live
              </Link>
            </div>
          </div>
        )}

        {/* Continue Watching */}
        {session && continueWatching && continueWatching.length > 0 && (
          <ContentLane
            title="Continue Watching"
            seeAllLink="/watch/history"
          >
            {continueWatching.map((item) => (
              <ContinueWatchingCard key={item.id} item={item} />
            ))}
          </ContentLane>
        )}

        {/* Followed Worlds */}
        {session && following && following.length > 0 && (
          <ContentLane
            title="From Worlds You Follow"
            seeAllLink="/watch/following"
          >
            {following.map((world) => (
              <WorldCard key={world.id} world={world} />
            ))}
          </ContentLane>
        )}

        {/* Trending Shorts */}
        {trendingShorts?.shorts && trendingShorts.shorts.length > 0 && (
          <ContentLane
            title="Trending Shorts"
            seeAllLink="/watch/shorts"
          >
            {trendingShorts.shorts.slice(0, 8).map((short) => (
              <Link
                key={short.id}
                to={`/watch/shorts/${short.id}`}
                className="flex-shrink-0 w-32 group"
              >
                <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-charcoal-black/50">
                  {short.thumbnail_url ? (
                    <img
                      src={short.thumbnail_url}
                      alt={short.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted-gray/20">
                      <Play className="w-8 h-8 text-muted-gray/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-xs text-white font-medium line-clamp-2">
                      {short.title}
                    </p>
                    <p className="text-xs text-white/70 mt-0.5">
                      {short.view_count.toLocaleString()} views
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </ContentLane>
        )}

        {/* All Worlds */}
        {loadingWorlds ? (
          <div className="px-4 md:px-8">
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="flex gap-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="w-52 h-80 rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          allWorlds?.worlds && allWorlds.worlds.length > 0 && (
            <ContentLane
              title="Discover Worlds"
              seeAllLink="/watch/browse"
            >
              {allWorlds.worlds.map((world) => (
                <WorldCard key={world.id} world={world} />
              ))}
            </ContentLane>
          )
        )}

        {/* Series */}
        {seriesWorlds?.worlds && seriesWorlds.worlds.length > 0 && (
          <ContentLane
            title="Series"
            seeAllLink="/watch/browse?format=series"
          >
            {seriesWorlds.worlds.map((world) => (
              <WorldCard key={world.id} world={world} />
            ))}
          </ContentLane>
        )}

        {/* Films */}
        {filmWorlds?.worlds && filmWorlds.worlds.length > 0 && (
          <ContentLane
            title="Films"
            seeAllLink="/watch/browse?format=film"
          >
            {filmWorlds.worlds.map((world) => (
              <WorldCard key={world.id} world={world} />
            ))}
          </ContentLane>
        )}

        {/* Empty State */}
        {!loadingWorlds && (!allWorlds?.worlds || allWorlds.worlds.length === 0) && (
          <div className="text-center py-20 px-4">
            <Sparkles className="w-16 h-16 text-muted-gray mx-auto mb-4" />
            <h2 className="text-2xl font-heading text-bone-white mb-2">
              Coming Soon
            </h2>
            <p className="text-muted-gray max-w-md mx-auto">
              We're preparing amazing content for you. Check back soon to discover incredible stories.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Navigation Hint */}
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-charcoal-black to-transparent pointer-events-none" />
    </div>
  );
}

export default WatchHome;
