/**
 * Watch/Streaming Platform Hooks
 * Barrel export for all watch-related hooks
 */

// Worlds
export {
  useGenres,
  useWorlds,
  useWorld,
  useSeasons,
  useEpisodes,
  useEpisode,
  useFollowWorld,
  useFollowing,
  useWatchlist,
  useWatchlistItems,
  useWatchHistory,
  useContinueWatching,
  useUpdateWatchProgress,
  useUpdateEpisode,
  useAttachVideoToEpisode,
} from './useWorlds';

// Shorts
export {
  useShortsFeed,
  useShortsFollowingFeed,
  useShortsTrending,
  useShort,
  useLikeShort,
  useBookmarkShort,
  useRecordShortView,
  useShortsBookmarks,
  useShortsLiked,
} from './useShorts';

// Events
export {
  useUpcomingEvents,
  useLiveEvents,
  useMyUpcomingEvents,
  useEvent,
  useEventRsvp,
  useEventChat,
  useSendChatMessage,
  useViewerSession,
} from './useEvents';

// Video
export {
  usePlaybackSession,
  useVideoAsset,
  useVideoAssets,
  useTranscodeStatus,
  useVideoPlayer,
  useAutoSaveProgress,
} from './useVideo';

// Recommendations
export {
  useForYou,
  useWatchFree,
  useTrending,
  useForYouContent,
} from './useRecommendations';
