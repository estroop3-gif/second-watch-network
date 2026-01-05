/**
 * Watch History Page
 * Shows user's watch history and continue watching
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useWatchHistory,
  useContinueWatching,
  useWatchlistItems,
} from '@/hooks/watch';
import { ContinueWatchingCard } from '@/components/watch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  Clock,
  Play,
  Bookmark,
  History,
  Trash2,
} from 'lucide-react';
import type { WatchHistoryItem, World } from '@/types/watch';

export function HistoryPage() {
  const { session } = useAuth();

  const { data: continueWatching, isLoading: loadingContinue } = useContinueWatching(20);
  const { data: watchHistory, isLoading: loadingHistory } = useWatchHistory(50);
  const { data: watchlist, isLoading: loadingWatchlist } = useWatchlistItems(50);

  if (!session) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <History className="w-16 h-16 text-muted-gray mx-auto mb-4" />
          <h1 className="text-2xl font-heading text-bone-white mb-2">
            Sign in to View History
          </h1>
          <p className="text-muted-gray mb-6">
            Track what you've watched and pick up where you left off.
          </p>
          <Button asChild>
            <Link to="/login">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="px-4 md:px-8 py-6 border-b border-bone-white/10">
        <div className="flex items-center gap-4">
          <Link
            to="/watch"
            className="text-muted-gray hover:text-bone-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-heading text-bone-white">My Activity</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 py-8">
        <Tabs defaultValue="continue" className="space-y-6">
          <TabsList className="bg-charcoal-black/50 border border-bone-white/10">
            <TabsTrigger value="continue" className="gap-2">
              <Play className="w-4 h-4" />
              Continue
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-2">
              <Bookmark className="w-4 h-4" />
              My List
            </TabsTrigger>
          </TabsList>

          {/* Continue Watching */}
          <TabsContent value="continue" className="space-y-4">
            {loadingContinue ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : continueWatching && continueWatching.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {continueWatching.map((item) => (
                  <ContinueWatchingCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Play className="w-16 h-16" />}
                title="Nothing to Continue"
                description="Start watching something to see it here."
                actionLink="/watch/browse"
                actionLabel="Browse Content"
              />
            )}
          </TabsContent>

          {/* Watch History */}
          <TabsContent value="history" className="space-y-4">
            {loadingHistory ? (
              <div className="space-y-4">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : watchHistory && watchHistory.length > 0 ? (
              <div className="space-y-2">
                {watchHistory.map((item) => (
                  <HistoryItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<History className="w-16 h-16" />}
                title="No Watch History"
                description="Your watch history will appear here."
                actionLink="/watch/browse"
                actionLabel="Start Watching"
              />
            )}
          </TabsContent>

          {/* Watchlist */}
          <TabsContent value="watchlist" className="space-y-4">
            {loadingWatchlist ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
                ))}
              </div>
            ) : watchlist && watchlist.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {watchlist.map((world) => (
                  <WatchlistItem key={world.id} world={world} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Bookmark className="w-16 h-16" />}
                title="Your List is Empty"
                description="Add worlds to your list to watch later."
                actionLink="/watch/browse"
                actionLabel="Browse Worlds"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// History Item Component
function HistoryItem({ item }: { item: WatchHistoryItem }) {
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const progress = item.duration_seconds
    ? Math.round((item.position_seconds / item.duration_seconds) * 100)
    : 0;

  const watchedAt = new Date(item.watched_at);
  const isToday = new Date().toDateString() === watchedAt.toDateString();
  const isYesterday = new Date(Date.now() - 86400000).toDateString() === watchedAt.toDateString();

  const formatDate = () => {
    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return watchedAt.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Link
      to={`/watch/episode/${item.episode_id}?t=${Math.floor(item.position_seconds)}`}
      className="flex gap-4 p-3 rounded-lg hover:bg-bone-white/5 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="relative w-32 aspect-video rounded overflow-hidden flex-shrink-0">
        {item.episode?.thumbnail_url || item.world?.thumbnail_url ? (
          <img
            src={item.episode?.thumbnail_url || item.world?.thumbnail_url}
            alt={item.episode?.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted-gray/20 flex items-center justify-center">
            <Play className="w-6 h-6 text-muted-gray/50" />
          </div>
        )}
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
          <div
            className="h-full bg-primary-red"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-1">
        <h3 className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors line-clamp-1">
          {item.episode?.title || 'Untitled'}
        </h3>
        <p className="text-sm text-muted-gray line-clamp-1">
          {item.world?.title}
          {item.episode && ` • E${item.episode.episode_number}`}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray">
          <span>{formatDate()}</span>
          <span>{progress}% watched</span>
          {item.duration_seconds && (
            <span>{formatTime(item.duration_seconds - item.position_seconds)} left</span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Watchlist Item Component
function WatchlistItem({ world }: { world: World }) {
  return (
    <Link
      to={`/watch/worlds/${world.slug}`}
      className="block group"
    >
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-charcoal-black/50">
        {world.thumbnail_url ? (
          <img
            src={world.thumbnail_url}
            alt={world.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-muted-gray/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-medium text-bone-white text-sm line-clamp-2 group-hover:text-accent-yellow transition-colors">
            {world.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}

// Empty State Component
function EmptyState({
  icon,
  title,
  description,
  actionLink,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLink: string;
  actionLabel: string;
}) {
  return (
    <div className="text-center py-16">
      <div className="text-muted-gray mx-auto mb-4">{icon}</div>
      <h2 className="text-xl font-heading text-bone-white mb-2">{title}</h2>
      <p className="text-muted-gray mb-6">{description}</p>
      <Button asChild variant="outline">
        <Link to={actionLink}>{actionLabel}</Link>
      </Button>
    </div>
  );
}

export default HistoryPage;
