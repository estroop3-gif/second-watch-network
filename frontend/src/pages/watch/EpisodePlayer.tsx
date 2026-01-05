/**
 * Episode Player Page
 * Full video player experience for episodes
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useEpisode,
  usePlaybackSession,
  useSeasons,
} from '@/hooks/watch';
import { VideoPlayer } from '@/components/watch';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ListVideo,
  X,
} from 'lucide-react';
import type { Episode } from '@/types/watch';

export function EpisodePlayer() {
  const { episodeId } = useParams<{ episodeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();

  const initialTime = Number(searchParams.get('t')) || 0;

  const { data: episode, isLoading: loadingEpisode } = useEpisode(episodeId);

  // Use the video_asset_id from the episode to create a playback session
  const { data: playbackSession, isLoading: loadingPlayback, error: playbackError } = usePlaybackSession(
    episode?.video_asset_id,
    session?.access_token
  );

  // Get all seasons for episode list
  const { data: seasons } = useSeasons(episode?.world_id);

  const [showEpisodeList, setShowEpisodeList] = useState(false);

  // Determine start time (from URL or saved progress)
  const startTime = initialTime || playbackSession?.position || 0;

  // Find next episode
  const findNextEpisode = (): Episode | null => {
    if (!seasons || !episode) return null;

    const currentSeason = seasons.find((s) =>
      s.episodes?.some((e) => e.id === episode.id)
    );
    if (!currentSeason?.episodes) return null;

    const currentIndex = currentSeason.episodes.findIndex((e) => e.id === episode.id);

    // Check for next episode in same season
    if (currentIndex < currentSeason.episodes.length - 1) {
      return currentSeason.episodes[currentIndex + 1];
    }

    // Check for first episode of next season
    const currentSeasonIndex = seasons.findIndex((s) => s.id === currentSeason.id);
    if (currentSeasonIndex < seasons.length - 1) {
      const nextSeason = seasons[currentSeasonIndex + 1];
      if (nextSeason.episodes?.length) {
        return nextSeason.episodes[0];
      }
    }

    return null;
  };

  const nextEpisode = findNextEpisode();

  const handleBack = () => {
    if (episode?.world) {
      navigate(`/watch/worlds/${episode.world.slug}`);
    } else {
      navigate(-1);
    }
  };

  const handleNextEpisode = () => {
    if (nextEpisode) {
      navigate(`/watch/episode/${nextEpisode.id}`);
    }
  };

  // Show loading while fetching episode data
  if (loadingEpisode) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
          <Skeleton className="w-48 h-4 mx-auto" />
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading text-bone-white mb-2">
            Episode Not Found
          </h1>
          <p className="text-muted-gray mb-4">
            This episode doesn't exist or isn't available.
          </p>
          <Button asChild>
            <Link to="/watch">Back to Watch</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Check if video is available
  const hasVideo = episode.video_asset_id || episode.video_url;
  const videoSource = playbackSession?.playback_url || episode.video_url;

  // Show error if no video is available
  if (!hasVideo) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading text-bone-white mb-2">
            Video Not Available
          </h1>
          <p className="text-muted-gray mb-4">
            This episode's video is still being processed or isn't available yet.
          </p>
          <Button asChild>
            <Link to={episode.world ? `/watch/worlds/${episode.world.slug}` : '/watch'}>
              Back to World
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Show loading while creating playback session (only if we have a video_asset_id)
  if (episode.video_asset_id && loadingPlayback) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
          <p className="text-bone-white/60">Preparing video...</p>
        </div>
      </div>
    );
  }

  // Handle playback session error
  if (playbackError && !episode.video_url) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading text-bone-white mb-2">
            Playback Error
          </h1>
          <p className="text-muted-gray mb-4">
            {playbackError.message || 'Unable to start video playback.'}
          </p>
          <Button asChild>
            <Link to={episode.world ? `/watch/worlds/${episode.world.slug}` : '/watch'}>
              Back to World
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Video Player */}
      <div className="relative aspect-video w-full max-h-[80vh]">
        <VideoPlayer
          src={videoSource || ''}
          title={episode.title}
          poster={episode.thumbnail_url}
          startPosition={startTime}
          introStart={episode.intro_start_seconds}
          introEnd={episode.intro_end_seconds}
          creditsStart={episode.credits_start_seconds}
          onEnded={nextEpisode ? handleNextEpisode : undefined}
          onNext={nextEpisode ? handleNextEpisode : undefined}
          showNextButton={!!nextEpisode}
          autoPlay
        />

        {/* Top Controls Overlay */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex items-center justify-between pointer-events-auto">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={handleBack}
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Back
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => setShowEpisodeList(!showEpisodeList)}
            >
              <ListVideo className="w-5 h-5 mr-1" />
              Episodes
            </Button>
          </div>
        </div>
      </div>

      {/* Episode Info */}
      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
        {/* World Title */}
        {episode.world && (
          <Link
            to={`/watch/worlds/${episode.world.slug}`}
            className="text-accent-yellow hover:text-bone-white transition-colors text-sm mb-2 inline-block"
          >
            {episode.world.title}
          </Link>
        )}

        {/* Episode Title */}
        <h1 className="text-2xl md:text-3xl font-heading text-bone-white mb-2">
          {episode.season_number && `S${episode.season_number} `}
          E{episode.episode_number}: {episode.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-gray mb-4">
          {episode.duration_seconds && (
            <span>{Math.floor(episode.duration_seconds / 60)} min</span>
          )}
          {episode.release_date && (
            <span>{new Date(episode.release_date).getFullYear()}</span>
          )}
        </div>

        {/* Description */}
        {episode.description && (
          <p className="text-bone-white/80 max-w-3xl">
            {episode.description}
          </p>
        )}

        {/* Next Episode Card */}
        {nextEpisode && (
          <div className="mt-8 p-4 rounded-lg bg-charcoal-black/50 border border-bone-white/10">
            <h3 className="text-sm text-muted-gray mb-2">Up Next</h3>
            <Link
              to={`/watch/episode/${nextEpisode.id}`}
              className="flex items-center gap-4 group"
            >
              {/* Thumbnail */}
              <div className="relative w-32 aspect-video rounded overflow-hidden flex-shrink-0">
                {nextEpisode.thumbnail_url ? (
                  <img
                    src={nextEpisode.thumbnail_url}
                    alt={nextEpisode.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted-gray/20" />
                )}
              </div>
              <div>
                <h4 className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors">
                  E{nextEpisode.episode_number}: {nextEpisode.title}
                </h4>
                {nextEpisode.duration_seconds && (
                  <p className="text-sm text-muted-gray">
                    {Math.floor(nextEpisode.duration_seconds / 60)} min
                  </p>
                )}
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Episode List Drawer */}
      {showEpisodeList && (
        <div className="fixed inset-0 z-50 bg-black/80" onClick={() => setShowEpisodeList(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-charcoal-black overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-charcoal-black/95 backdrop-blur p-4 flex items-center justify-between border-b border-bone-white/10">
              <h2 className="text-lg font-heading text-bone-white">Episodes</h2>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-gray hover:text-bone-white"
                onClick={() => setShowEpisodeList(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-6">
              {seasons?.map((season) => (
                <div key={season.id}>
                  <h3 className="text-sm font-medium text-muted-gray mb-3">
                    Season {season.season_number}
                    {season.title && `: ${season.title}`}
                  </h3>
                  <div className="space-y-2">
                    {season.episodes?.map((ep) => (
                      <Link
                        key={ep.id}
                        to={`/watch/episode/${ep.id}`}
                        className={`block p-3 rounded-lg transition-colors ${
                          ep.id === episode.id
                            ? 'bg-accent-yellow/20 border border-accent-yellow/50'
                            : 'bg-bone-white/5 hover:bg-bone-white/10'
                        }`}
                        onClick={() => setShowEpisodeList(false)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-gray w-6">
                            {ep.episode_number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <h4 className={`font-medium truncate ${
                              ep.id === episode.id
                                ? 'text-accent-yellow'
                                : 'text-bone-white'
                            }`}>
                              {ep.title}
                            </h4>
                            {ep.duration_seconds && (
                              <p className="text-xs text-muted-gray">
                                {Math.floor(ep.duration_seconds / 60)} min
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EpisodePlayer;
