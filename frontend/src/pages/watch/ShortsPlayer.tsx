/**
 * Shorts Player Page
 * TikTok-style vertical video feed with swipe navigation
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  useShortsFeed,
  useLikeShort,
  useBookmarkShort,
  useRecordShortView,
} from '@/hooks/watch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Heart,
  Bookmark,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  X,
  Globe,
} from 'lucide-react';
import type { Short } from '@/types/watch';

export function ShortsPlayer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialShortId = searchParams.get('id');

  const { session } = useAuth();

  // Fetch shorts feed
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useShortsFeed(20);

  // Flatten pages into single array
  const shorts = data?.pages.flatMap((page) => page.shorts) ?? [];

  // Current short index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  // Find initial short if provided
  useEffect(() => {
    if (initialShortId && shorts.length > 0) {
      const index = shorts.findIndex((s) => s.id === initialShortId);
      if (index >= 0) {
        setCurrentIndex(index);
      }
    }
  }, [initialShortId, shorts.length]);

  // Prefetch next page when near end
  useEffect(() => {
    if (currentIndex >= shorts.length - 3 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [currentIndex, shorts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const currentShort = shorts[currentIndex];

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, shorts.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'k') {
        handlePrevious();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        handleNext();
      } else if (e.key === 'Escape') {
        navigate(-1);
      } else if (e.key === 'm') {
        setIsMuted(!isMuted);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext, navigate, isMuted]);

  // Touch/swipe handling
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;

    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const threshold = 50;

    if (deltaY > threshold) {
      handleNext();
    } else if (deltaY < -threshold) {
      handlePrevious();
    }

    touchStartY.current = null;
  };

  if (shorts.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white/70">Loading shorts...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-50 text-white hover:bg-white/10"
        onClick={() => navigate(-1)}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Navigation Buttons (Desktop) */}
      <div className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-50 flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-white hover:bg-white/10",
            currentIndex === 0 && "opacity-30 cursor-not-allowed"
          )}
          onClick={handlePrevious}
          disabled={currentIndex === 0}
        >
          <ChevronUp className="w-8 h-8" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "text-white hover:bg-white/10",
            currentIndex >= shorts.length - 1 && "opacity-30 cursor-not-allowed"
          )}
          onClick={handleNext}
          disabled={currentIndex >= shorts.length - 1}
        >
          <ChevronDown className="w-8 h-8" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="h-full flex items-center justify-center">
        {currentShort && (
          <ShortCard
            short={currentShort}
            isActive={true}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
          />
        )}
      </div>

      {/* Progress Indicator */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-50 hidden md:flex flex-col gap-1">
        {shorts.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((short, idx) => {
          const actualIndex = Math.max(0, currentIndex - 2) + idx;
          return (
            <div
              key={short.id}
              className={cn(
                "w-1 rounded-full transition-all",
                actualIndex === currentIndex
                  ? "h-6 bg-white"
                  : "h-2 bg-white/40"
              )}
            />
          );
        })}
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </div>
  );
}

// Individual Short Card Component
function ShortCard({
  short,
  isActive,
  isMuted,
  onToggleMute,
}: {
  short: Short;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}) {
  const { session } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);

  const { mutate: likeShort } = useLikeShort();
  const { mutate: bookmarkShort } = useBookmarkShort();
  const { mutate: recordView } = useRecordShortView();

  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      const timer = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls]);

  // Play/pause based on active state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.play().catch(() => {});
      recordView(short.id);
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isActive, short.id, recordView]);

  // Update muted state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowControls(true);
  };

  const handleLike = () => {
    if (!session) return;
    likeShort({ shortId: short.id, liked: !short.is_liked });
  };

  const handleBookmark = () => {
    if (!session) return;
    bookmarkShort({ shortId: short.id, bookmarked: !short.is_bookmarked });
  };

  return (
    <div
      className="relative h-full max-h-screen aspect-[9/16] max-w-[100vw] bg-black"
      onClick={togglePlay}
      onMouseMove={() => setShowControls(true)}
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={short.video_url}
        className="w-full h-full object-contain"
        loop
        playsInline
        muted={isMuted}
        poster={short.thumbnail_url}
      />

      {/* Play/Pause Overlay */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" />
          </div>
        </div>
      )}

      {/* Right Side Actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-10">
        {/* Like */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleLike();
          }}
          className="flex flex-col items-center gap-1"
          disabled={!session}
        >
          <div
            className={cn(
              "w-12 h-12 rounded-full bg-black/30 flex items-center justify-center transition-colors",
              short.is_liked && "text-primary-red"
            )}
          >
            <Heart
              className={cn("w-6 h-6", short.is_liked && "fill-current")}
            />
          </div>
          <span className="text-white text-xs">{formatCount(short.like_count)}</span>
        </button>

        {/* Comments */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open comments
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs">{formatCount(short.comment_count)}</span>
        </button>

        {/* Bookmark */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleBookmark();
          }}
          className="flex flex-col items-center gap-1"
          disabled={!session}
        >
          <div
            className={cn(
              "w-12 h-12 rounded-full bg-black/30 flex items-center justify-center",
              short.is_bookmarked && "text-accent-yellow"
            )}
          >
            <Bookmark
              className={cn("w-6 h-6", short.is_bookmarked && "fill-current")}
            />
          </div>
        </button>

        {/* Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (navigator.share) {
              navigator.share({
                title: short.title,
                url: window.location.href,
              });
            }
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
        </button>

        {/* Mute/Unmute */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center">
            {isMuted ? (
              <VolumeX className="w-6 h-6 text-white" />
            ) : (
              <Volume2 className="w-6 h-6 text-white" />
            )}
          </div>
        </button>
      </div>

      {/* Bottom Info */}
      <div className="absolute left-3 right-20 bottom-8 z-10">
        {/* Creator */}
        {short.creator && (
          <Link
            to={`/profile/${short.creator.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mb-3"
          >
            {short.creator.avatar_url ? (
              <img
                src={short.creator.avatar_url}
                alt={short.creator.display_name}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted-gray/50 flex items-center justify-center">
                <span className="text-white text-sm">
                  {short.creator.display_name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-white font-medium">
              {short.creator.display_name}
            </span>
          </Link>
        )}

        {/* Title & Description */}
        <h3 className="text-white font-medium mb-1 line-clamp-1">
          {short.title}
        </h3>
        {short.description && (
          <p className="text-white/80 text-sm line-clamp-2">
            {short.description}
          </p>
        )}

        {/* World Link */}
        {short.world && (
          <Link
            to={`/watch/worlds/${short.world.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 mt-2 text-sm text-accent-yellow hover:text-white transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>{short.world.title}</span>
          </Link>
        )}
      </div>

      {/* Progress Bar */}
      <VideoProgress videoRef={videoRef} />
    </div>
  );
}

// Video Progress Component
function VideoProgress({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [videoRef]);

  return (
    <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
      <div
        className="h-full bg-white transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// Format count helper
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export default ShortsPlayer;
