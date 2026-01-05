/**
 * Watch/Streaming API Client
 * Consumer Streaming Platform - Second Watch Network
 */

import type {
  World,
  WorldWithSeasons,
  WorldSummary,
  WorldSearchParams,
  WorldSearchResult,
  Season,
  Episode,
  Genre,
  WorldFollow,
  WorldWatchlistItem,
  WatchHistoryItem,
  Short,
  ShortsFeedResponse,
  LiveEvent,
  EventSummary,
  EventListResponse,
  EventRSVP,
  ChatMessage,
  PlaybackSession,
  VideoAsset,
  VideoAssetSummary,
  VideoListResponse,
  UploadInitiateResponse,
  UploadStatusResponse,
} from '@/types/watch';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Get the auth token from localStorage
 */
function getToken(): string | null {
  try {
    return localStorage.getItem('access_token');
  } catch {
    return null;
  }
}

/**
 * Make an authenticated API request
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Worlds API
// =============================================================================

export const worldsApi = {
  /**
   * List all genres
   */
  async getGenres(): Promise<Genre[]> {
    return request('/api/v1/worlds/genres');
  },

  /**
   * List public worlds with optional filters
   */
  async listWorlds(params?: WorldSearchParams): Promise<WorldSearchResult> {
    const query = new URLSearchParams();
    if (params?.query) query.append('query', params.query);
    if (params?.genre_slug) query.append('genre_slug', params.genre_slug);
    if (params?.content_format) query.append('content_format', params.content_format);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const qs = query.toString();
    return request(`/api/v1/worlds${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get world by slug
   */
  async getWorld(slug: string): Promise<WorldWithSeasons> {
    return request(`/api/v1/worlds/${slug}`);
  },

  /**
   * Get seasons for a world
   */
  async getSeasons(worldId: string): Promise<Season[]> {
    return request(`/api/v1/worlds/${worldId}/seasons`);
  },

  /**
   * Get episodes for a season
   */
  async getEpisodes(seasonId: string): Promise<Episode[]> {
    return request(`/api/v1/worlds/seasons/${seasonId}/episodes`);
  },

  /**
   * Get episode details
   */
  async getEpisode(episodeId: string): Promise<Episode> {
    return request(`/api/v1/worlds/episodes/${episodeId}`);
  },

  /**
   * Update an episode
   */
  async updateEpisode(
    episodeId: string,
    update: {
      title?: string;
      description?: string;
      video_asset_id?: string;
      thumbnail_url?: string;
      status?: string;
      visibility?: string;
      intro_start_seconds?: number;
      intro_end_seconds?: number;
      credits_start_seconds?: number;
    }
  ): Promise<Episode> {
    return request(`/api/v1/worlds/episodes/${episodeId}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  },

  /**
   * Attach a video to an episode
   */
  async attachVideoToEpisode(episodeId: string, videoAssetId: string): Promise<Episode> {
    return request(`/api/v1/worlds/episodes/${episodeId}`, {
      method: 'PUT',
      body: JSON.stringify({ video_asset_id: videoAssetId }),
    });
  },

  /**
   * Follow a world
   */
  async followWorld(worldId: string): Promise<WorldFollow> {
    return request(`/api/v1/worlds/${worldId}/follow`, {
      method: 'POST',
    });
  },

  /**
   * Unfollow a world
   */
  async unfollowWorld(worldId: string): Promise<void> {
    return request(`/api/v1/worlds/${worldId}/follow`, {
      method: 'DELETE',
    });
  },

  /**
   * Get followed worlds
   */
  async getFollowing(limit = 50, offset = 0): Promise<WorldSummary[]> {
    return request(`/api/v1/worlds/my/following?limit=${limit}&offset=${offset}`);
  },

  /**
   * Add world to watchlist
   */
  async addToWatchlist(worldId: string): Promise<WorldWatchlistItem> {
    return request(`/api/v1/worlds/${worldId}/watchlist`, {
      method: 'POST',
    });
  },

  /**
   * Remove world from watchlist
   */
  async removeFromWatchlist(worldId: string): Promise<void> {
    return request(`/api/v1/worlds/${worldId}/watchlist`, {
      method: 'DELETE',
    });
  },

  /**
   * Get watchlist
   */
  async getWatchlist(limit = 50, offset = 0): Promise<WorldWatchlistItem[]> {
    return request(`/api/v1/worlds/my/watchlist?limit=${limit}&offset=${offset}`);
  },

  /**
   * Update watch progress
   */
  async updateWatchProgress(
    episodeId: string,
    position: number,
    duration?: number
  ): Promise<void> {
    return request(`/api/v1/worlds/episodes/${episodeId}/progress`, {
      method: 'POST',
      body: JSON.stringify({
        position_seconds: position,
        duration_seconds: duration,
      }),
    });
  },

  /**
   * Get watch history
   */
  async getWatchHistory(limit = 20): Promise<WatchHistoryItem[]> {
    return request(`/api/v1/worlds/my/history?limit=${limit}`);
  },

  /**
   * Get continue watching list
   */
  async getContinueWatching(limit = 10): Promise<WatchHistoryItem[]> {
    return request(`/api/v1/worlds/my/continue-watching?limit=${limit}`);
  },
};

// =============================================================================
// Video API
// =============================================================================

export const videoApi = {
  /**
   * Create a playback session for an episode or video
   */
  async createPlaybackSession(videoAssetId: string, deviceType?: string): Promise<PlaybackSession> {
    return request('/api/v1/video/playback/session', {
      method: 'POST',
      body: JSON.stringify({
        video_asset_id: videoAssetId,
        device_type: deviceType,
      }),
    });
  },

  /**
   * List user's video assets
   */
  async listVideos(params?: {
    worldId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<VideoListResponse> {
    const query = new URLSearchParams();
    if (params?.worldId) query.append('world_id', params.worldId);
    if (params?.status) query.append('status', params.status);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const qs = query.toString();
    return request(`/api/v1/video/assets${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get video asset details
   */
  async getVideo(videoId: string): Promise<VideoAsset> {
    return request(`/api/v1/video/assets/${videoId}`);
  },

  /**
   * Initiate video upload
   */
  async initiateUpload(
    filename: string,
    fileSize: number,
    options?: {
      contentType?: string;
      worldId?: string;
      title?: string;
      description?: string;
    }
  ): Promise<UploadInitiateResponse> {
    return request('/api/v1/video/upload/initiate', {
      method: 'POST',
      body: JSON.stringify({
        filename,
        file_size_bytes: fileSize,
        content_type: options?.contentType || 'video/mp4',
        world_id: options?.worldId,
        title: options?.title,
        description: options?.description,
      }),
    });
  },

  /**
   * Complete upload
   */
  async completeUpload(
    sessionId: string,
    parts: { part_number: number; etag: string; size: number }[]
  ): Promise<{ status: string; video_asset_id: string }> {
    return request('/api/v1/video/upload/complete', {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        parts,
      }),
    });
  },

  /**
   * Get upload status
   */
  async getUploadStatus(sessionId: string): Promise<UploadStatusResponse> {
    return request(`/api/v1/video/upload/${sessionId}/status`);
  },

  /**
   * Abort upload
   */
  async abortUpload(sessionId: string): Promise<void> {
    return request('/api/v1/video/upload/abort', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  /**
   * Get transcoding status
   */
  async getTranscodeStatus(videoId: string): Promise<{
    video_asset_id: string;
    status: string;
    progress: number;
  }> {
    return request(`/api/v1/video/transcode/${videoId}/status`);
  },
};

// =============================================================================
// Shorts API
// =============================================================================

export const shortsApi = {
  /**
   * Get main shorts feed
   */
  async getFeed(params?: {
    cursor?: string;
    limit?: number;
    worldId?: string;
  }): Promise<ShortsFeedResponse> {
    const query = new URLSearchParams();
    if (params?.cursor) query.append('cursor', params.cursor);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.worldId) query.append('world_id', params.worldId);

    const qs = query.toString();
    return request(`/api/v1/shorts/feed${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get shorts from followed worlds
   */
  async getFollowingFeed(cursor?: string, limit = 10): Promise<ShortsFeedResponse> {
    const query = new URLSearchParams();
    if (cursor) query.append('cursor', cursor);
    query.append('limit', limit.toString());

    return request(`/api/v1/shorts/following?${query}`);
  },

  /**
   * Get trending shorts
   */
  async getTrending(limit = 20): Promise<ShortsFeedResponse> {
    return request(`/api/v1/shorts/trending?limit=${limit}`);
  },

  /**
   * Get a single short
   */
  async getShort(shortId: string): Promise<Short> {
    return request(`/api/v1/shorts/${shortId}`);
  },

  /**
   * Like a short
   */
  async likeShort(shortId: string): Promise<void> {
    return request(`/api/v1/shorts/${shortId}/like`, { method: 'POST' });
  },

  /**
   * Unlike a short
   */
  async unlikeShort(shortId: string): Promise<void> {
    return request(`/api/v1/shorts/${shortId}/like`, { method: 'DELETE' });
  },

  /**
   * Bookmark a short
   */
  async bookmarkShort(shortId: string): Promise<void> {
    return request(`/api/v1/shorts/${shortId}/bookmark`, { method: 'POST' });
  },

  /**
   * Remove bookmark
   */
  async unbookmarkShort(shortId: string): Promise<void> {
    return request(`/api/v1/shorts/${shortId}/bookmark`, { method: 'DELETE' });
  },

  /**
   * Record view
   */
  async recordView(shortId: string): Promise<void> {
    return request(`/api/v1/shorts/${shortId}/view`, { method: 'POST' });
  },

  /**
   * Get bookmarked shorts
   */
  async getBookmarks(cursor?: string, limit = 20): Promise<ShortsFeedResponse> {
    const query = new URLSearchParams();
    if (cursor) query.append('cursor', cursor);
    query.append('limit', limit.toString());

    return request(`/api/v1/shorts/my/bookmarks?${query}`);
  },

  /**
   * Get liked shorts
   */
  async getLiked(cursor?: string, limit = 20): Promise<ShortsFeedResponse> {
    const query = new URLSearchParams();
    if (cursor) query.append('cursor', cursor);
    query.append('limit', limit.toString());

    return request(`/api/v1/shorts/my/liked?${query}`);
  },
};

// =============================================================================
// Live Events API
// =============================================================================

export const eventsApi = {
  /**
   * Get upcoming events
   */
  async getUpcoming(params?: {
    worldId?: string;
    limit?: number;
    offset?: number;
  }): Promise<EventListResponse> {
    const query = new URLSearchParams();
    if (params?.worldId) query.append('world_id', params.worldId);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());

    const qs = query.toString();
    return request(`/api/v1/events/upcoming${qs ? `?${qs}` : ''}`);
  },

  /**
   * Get live events
   */
  async getLive(): Promise<EventSummary[]> {
    return request('/api/v1/events/live');
  },

  /**
   * Get user's upcoming events
   */
  async getMyUpcoming(limit = 10): Promise<EventSummary[]> {
    return request(`/api/v1/events/my/upcoming?limit=${limit}`);
  },

  /**
   * Get event details
   */
  async getEvent(eventId: string): Promise<LiveEvent> {
    return request(`/api/v1/events/${eventId}`);
  },

  /**
   * RSVP to event
   */
  async rsvp(
    eventId: string,
    status: 'interested' | 'going' | 'declined' = 'going'
  ): Promise<EventRSVP> {
    return request(`/api/v1/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Cancel RSVP
   */
  async cancelRsvp(eventId: string): Promise<void> {
    return request(`/api/v1/events/${eventId}/rsvp`, { method: 'DELETE' });
  },

  /**
   * Get chat messages
   */
  async getChatMessages(
    eventId: string,
    limit = 50,
    before?: string
  ): Promise<ChatMessage[]> {
    const query = new URLSearchParams();
    query.append('limit', limit.toString());
    if (before) query.append('before', before);

    return request(`/api/v1/events/${eventId}/chat?${query}`);
  },

  /**
   * Send chat message
   */
  async sendChatMessage(
    eventId: string,
    message: string,
    type: 'chat' | 'question' = 'chat'
  ): Promise<ChatMessage> {
    return request(`/api/v1/events/${eventId}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        message_type: type,
      }),
    });
  },

  /**
   * Join event (for viewer tracking)
   */
  async joinEvent(eventId: string, sessionId: string, deviceType?: string): Promise<void> {
    const query = new URLSearchParams();
    query.append('session_id', sessionId);
    if (deviceType) query.append('device_type', deviceType);

    return request(`/api/v1/events/${eventId}/join?${query}`, { method: 'POST' });
  },

  /**
   * Send heartbeat
   */
  async heartbeat(eventId: string, sessionId: string): Promise<void> {
    return request(`/api/v1/events/${eventId}/heartbeat?session_id=${sessionId}`, {
      method: 'POST',
    });
  },

  /**
   * Leave event
   */
  async leaveEvent(eventId: string, sessionId: string): Promise<void> {
    return request(`/api/v1/events/${eventId}/leave?session_id=${sessionId}`, {
      method: 'POST',
    });
  },
};

// =============================================================================
// Recommendations API
// =============================================================================

export interface RecommendedItem {
  id: string;
  type: 'world' | 'episode';
  title: string;
  slug?: string;
  thumbnail_url?: string;
  cover_art_url?: string;
  logline?: string;
  content_format?: string;
  maturity_rating?: string;
  duration_seconds?: number;
  episode_number?: number;
  season_number?: number;
  world_id?: string;
  world_title?: string;
  world_slug?: string;
  reason?: string;
}

export interface FreeContentItem {
  id: string;
  type: 'live_event' | 'fast_channel' | 'free_world';
  title: string;
  thumbnail_url?: string;
  description?: string;
  status?: string;
  scheduled_start?: string;
  viewer_count?: number;
}

export const recommendationsApi = {
  /**
   * Get personalized "For You" recommendations (authenticated)
   */
  async getForYou(limit = 12): Promise<RecommendedItem[]> {
    return request(`/api/v1/recommendations/for-you?limit=${limit}`);
  },

  /**
   * Get free content for guests (unauthenticated)
   */
  async getWatchFree(limit = 12): Promise<FreeContentItem[]> {
    return request(`/api/v1/recommendations/watch-free?limit=${limit}`);
  },

  /**
   * Get trending content
   */
  async getTrending(limit = 12, contentFormat?: string): Promise<RecommendedItem[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (contentFormat) params.append('content_format', contentFormat);
    return request(`/api/v1/recommendations/trending?${params}`);
  },
};

// =============================================================================
// Combined Export
// =============================================================================

export const watchApi = {
  worlds: worldsApi,
  video: videoApi,
  shorts: shortsApi,
  events: eventsApi,
  recommendations: recommendationsApi,
};

export default watchApi;
