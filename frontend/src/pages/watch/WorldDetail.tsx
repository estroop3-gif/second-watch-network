/**
 * World Detail Page
 * Shows world info, seasons, episodes
 */

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useWorld,
  useFollowWorld,
  useWatchlist,
  useUpcomingEvents,
} from '@/hooks/watch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Play,
  Plus,
  Check,
  Bell,
  BellOff,
  Share2,
  Calendar,
  Clock,
  Users,
  Star,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Season, Episode } from '@/types/watch';

export function WorldDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { session } = useAuth();

  const { data: world, isLoading } = useWorld(slug);
  const { data: upcomingEvents } = useUpcomingEvents({
    worldId: world?.id,
    limit: 5,
  });

  const { follow, unfollow, isFollowing, isUnfollowing } = useFollowWorld();
  const { add: addToWatchlist, remove: removeFromWatchlist, isAdding, isRemoving } = useWatchlist();

  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black">
        <Skeleton className="h-[50vh] w-full" />
        <div className="px-4 md:px-8 lg:px-16 py-8 space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-6 w-full max-w-2xl" />
          <Skeleton className="h-6 w-3/4 max-w-2xl" />
        </div>
      </div>
    );
  }

  if (!world) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading text-bone-white mb-2">
            World Not Found
          </h1>
          <p className="text-muted-gray mb-4">
            This world doesn't exist or isn't available.
          </p>
          <Button asChild>
            <Link to="/watch">Back to Watch</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleFollow = () => {
    if (world.is_following) {
      unfollow(world.id);
    } else {
      follow(world.id);
    }
  };

  const handleWatchlist = () => {
    if (world.is_in_watchlist) {
      removeFromWatchlist(world.id);
    } else {
      addToWatchlist(world.id);
    }
  };

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Hero */}
      <div className="relative h-[50vh] md:h-[60vh]">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: world.cover_art_wide_url || world.cover_art_url
              ? `url(${world.cover_art_wide_url || world.cover_art_url})`
              : undefined,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal-black via-charcoal-black/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black via-transparent to-charcoal-black/30" />
        </div>

        {/* Content */}
        <div className="relative h-full flex items-end px-4 md:px-8 lg:px-16 pb-8">
          <div className="flex-1 max-w-3xl">
            {/* Logo or Title */}
            {world.logo_url ? (
              <img
                src={world.logo_url}
                alt={world.title}
                className="h-24 md:h-32 object-contain mb-4"
              />
            ) : (
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading text-bone-white mb-4">
                {world.title}
              </h1>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-bone-white/80 mb-4">
              {world.maturity_rating && (
                <Badge variant="outline" className="border-bone-white/50">
                  {world.maturity_rating}
                </Badge>
              )}
              {world.release_year && <span>{world.release_year}</span>}
              {world.content_format && (
                <span className="capitalize">{world.content_format}</span>
              )}
              {world.runtime_minutes && (
                <span>{formatDuration(world.runtime_minutes * 60)}</span>
              )}
              {world.season_count > 0 && (
                <span>{world.season_count} {world.season_count === 1 ? 'Season' : 'Seasons'}</span>
              )}
            </div>

            {/* Genres */}
            {world.genres && world.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {world.genres.map((genre) => (
                  <Badge
                    key={genre.id}
                    variant="secondary"
                    className="bg-white/10 text-bone-white"
                  >
                    {genre.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Logline */}
            {world.logline && (
              <p className="text-lg text-bone-white/90 mb-6 line-clamp-2">
                {world.logline}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {world.episode_count > 0 && (
                <Button
                  asChild
                  size="lg"
                  className="bg-bone-white text-charcoal-black hover:bg-bone-white/90"
                >
                  <Link to={`/watch/episode/${world.seasons?.[0]?.episodes?.[0]?.id}`}>
                    <Play className="w-5 h-5 mr-2" />
                    Watch
                  </Link>
                </Button>
              )}

              {session && (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    className={cn(
                      "border-bone-white/50 hover:bg-bone-white/10",
                      world.is_in_watchlist ? "bg-bone-white/10 text-bone-white" : "text-bone-white"
                    )}
                    onClick={handleWatchlist}
                    disabled={isAdding || isRemoving}
                  >
                    {world.is_in_watchlist ? (
                      <Check className="w-5 h-5 mr-2" />
                    ) : (
                      <Plus className="w-5 h-5 mr-2" />
                    )}
                    My List
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "border-bone-white/50 hover:bg-bone-white/10",
                      world.is_following ? "bg-bone-white/10 text-accent-yellow" : "text-bone-white"
                    )}
                    onClick={handleFollow}
                    disabled={isFollowing || isUnfollowing}
                  >
                    {world.is_following ? (
                      <Bell className="w-5 h-5" />
                    ) : (
                      <BellOff className="w-5 h-5" />
                    )}
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="text-bone-white hover:bg-bone-white/10"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden lg:flex flex-col gap-4 ml-8">
            <div className="text-center">
              <div className="text-3xl font-heading text-accent-yellow">
                {world.follower_count.toLocaleString()}
              </div>
              <div className="text-sm text-muted-gray">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-heading text-bone-white">
                {world.total_view_count.toLocaleString()}
              </div>
              <div className="text-sm text-muted-gray">Views</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 lg:px-16 py-8">
        <Tabs defaultValue="episodes" className="space-y-8">
          <TabsList className="bg-charcoal-black/50 border border-bone-white/10">
            <TabsTrigger value="episodes">Episodes</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            {upcomingEvents?.events && upcomingEvents.events.length > 0 && (
              <TabsTrigger value="events">Events</TabsTrigger>
            )}
          </TabsList>

          {/* Episodes Tab */}
          <TabsContent value="episodes" className="space-y-6">
            {world.seasons && world.seasons.length > 0 ? (
              world.seasons.map((season) => (
                <SeasonSection
                  key={season.id}
                  season={season}
                  isExpanded={expandedSeason === season.id || world.seasons!.length === 1}
                  onToggle={() =>
                    setExpandedSeason(
                      expandedSeason === season.id ? null : season.id
                    )
                  }
                />
              ))
            ) : (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-muted-gray mx-auto mb-4" />
                <h3 className="text-xl font-heading text-bone-white mb-2">
                  Coming Soon
                </h3>
                <p className="text-muted-gray">
                  Episodes are being prepared. Follow to get notified.
                </p>
              </div>
            )}
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="space-y-8">
            {/* Synopsis */}
            {world.synopsis && (
              <div>
                <h3 className="text-lg font-heading text-bone-white mb-3">
                  Synopsis
                </h3>
                <p className="text-bone-white/80 whitespace-pre-line max-w-3xl">
                  {world.synopsis}
                </p>
              </div>
            )}

            {/* Creator */}
            {world.creator && (
              <div>
                <h3 className="text-lg font-heading text-bone-white mb-3">
                  Created By
                </h3>
                <Link
                  to={`/profile/${world.creator.id}`}
                  className="flex items-center gap-3 group"
                >
                  {world.creator.avatar_url ? (
                    <img
                      src={world.creator.avatar_url}
                      alt={world.creator.display_name}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted-gray/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-muted-gray" />
                    </div>
                  )}
                  <span className="text-bone-white group-hover:text-accent-yellow transition-colors">
                    {world.creator.display_name}
                  </span>
                </Link>
              </div>
            )}
          </TabsContent>

          {/* Events Tab */}
          {upcomingEvents?.events && upcomingEvents.events.length > 0 && (
            <TabsContent value="events" className="space-y-4">
              {upcomingEvents.events.map((event) => (
                <Link
                  key={event.id}
                  to={`/watch/events/${event.id}`}
                  className="block p-4 rounded-lg bg-charcoal-black/50 border border-bone-white/10 hover:border-accent-yellow/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-bone-white">
                        {event.title}
                      </h4>
                      <p className="text-sm text-muted-gray mt-1">
                        {new Date(event.scheduled_start).toLocaleDateString(undefined, {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {event.event_type.replace('_', ' ')}
                    </Badge>
                  </div>
                </Link>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

// Season Section Component
function SeasonSection({
  season,
  isExpanded,
  onToggle,
}: {
  season: Season;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-bone-white/10 rounded-lg overflow-hidden">
      {/* Season Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-charcoal-black/50 hover:bg-charcoal-black/70 transition-colors"
      >
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-heading text-bone-white">
            Season {season.season_number}
            {season.title && `: ${season.title}`}
          </h3>
          <span className="text-sm text-muted-gray">
            {season.episode_count} episodes
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-gray" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-gray" />
        )}
      </button>

      {/* Episodes */}
      {isExpanded && season.episodes && (
        <div className="divide-y divide-bone-white/10">
          {season.episodes.map((episode) => (
            <EpisodeRow key={episode.id} episode={episode} />
          ))}
        </div>
      )}
    </div>
  );
}

// Episode Row Component
function EpisodeRow({ episode }: { episode: Episode }) {
  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  };

  return (
    <Link
      to={`/watch/episode/${episode.id}`}
      className="flex gap-4 p-4 hover:bg-charcoal-black/50 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="relative w-40 aspect-video rounded overflow-hidden flex-shrink-0">
        {episode.thumbnail_url ? (
          <img
            src={episode.thumbnail_url}
            alt={episode.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted-gray/20 flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-gray/50" />
          </div>
        )}
        {/* Progress */}
        {episode.watch_progress && !episode.watch_progress.completed && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
            <div
              className="h-full bg-primary-red"
              style={{
                width: `${(episode.watch_progress.position / (episode.duration_seconds || 1)) * 100}%`,
              }}
            />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors">
              {episode.episode_number}. {episode.title}
            </h4>
            {episode.duration_seconds && (
              <span className="text-sm text-muted-gray">
                {formatDuration(episode.duration_seconds)}
              </span>
            )}
          </div>
          {episode.watch_progress?.completed && (
            <Check className="w-5 h-5 text-accent-yellow flex-shrink-0" />
          )}
        </div>
        {episode.description && (
          <p className="text-sm text-bone-white/70 mt-2 line-clamp-2">
            {episode.description}
          </p>
        )}
      </div>
    </Link>
  );
}

export default WorldDetail;
