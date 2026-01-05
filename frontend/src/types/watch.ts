/**
 * Watch/Streaming Platform Types
 * Consumer Streaming Platform - Second Watch Network
 */

// =============================================================================
// Enums
// =============================================================================

export type ContentFormat = 'series' | 'film' | 'special' | 'anthology';
export type WorldStatus = 'draft' | 'coming_soon' | 'active' | 'complete' | 'archived';
export type WorldVisibility = 'public' | 'unlisted' | 'private';
export type MaturityRating = 'G' | 'PG' | 'PG-13' | 'R' | 'TV-Y' | 'TV-Y7' | 'TV-G' | 'TV-PG' | 'TV-14' | 'TV-MA';

export type EpisodeStatus = 'draft' | 'processing' | 'qc_pending' | 'qc_approved' | 'qc_rejected' | 'scheduled' | 'published' | 'unlisted' | 'archived';
export type EpisodeVisibility = 'public' | 'unlisted' | 'private' | 'premium';

export type SeasonStatus = 'unreleased' | 'releasing' | 'complete';

export type ProcessingStatus = 'pending' | 'validating' | 'transcoding' | 'packaging' | 'qc' | 'completed' | 'failed' | 'cancelled';

export type EventType = 'premiere' | 'watch_party' | 'qa' | 'behind_scenes' | 'announcement' | 'live_stream' | 'table_read' | 'commentary' | 'other';
export type EventStatus = 'draft' | 'scheduled' | 'starting' | 'live' | 'ended' | 'cancelled' | 'archived';
export type EventVisibility = 'public' | 'followers_only' | 'unlisted' | 'private';
export type RSVPStatus = 'interested' | 'going' | 'declined';

// =============================================================================
// Genre
// =============================================================================

export interface Genre {
  id: string;
  name: string;
  slug: string;
  category: string;
  is_primary?: boolean;
}

// =============================================================================
// World Types
// =============================================================================

export interface WorldSummary {
  id: string;
  title: string;
  slug: string;
  thumbnail_url?: string;
  content_format: string;
  follower_count: number;
  episode_count: number;
  status?: WorldStatus;
  is_featured?: boolean;
}

export interface World {
  id: string;
  slug: string;
  creator_id: string;
  submission_id?: string;
  title: string;
  logline?: string;
  synopsis?: string;
  content_format: ContentFormat;
  maturity_rating?: MaturityRating;
  runtime_minutes?: number;
  release_year?: number;
  visibility: WorldVisibility;
  status: WorldStatus;
  cover_art_url?: string;
  cover_art_wide_url?: string;
  thumbnail_url?: string;
  logo_url?: string;
  trailer_video_id?: string;
  announced_at?: string;
  premiere_date?: string;
  last_content_date?: string;
  follower_count: number;
  total_view_count: number;
  episode_count: number;
  season_count: number;
  external_links?: Record<string, string>;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
  published_at?: string;
  // Enriched
  genres?: Genre[];
  creator?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
  is_following?: boolean;
  is_in_watchlist?: boolean;
}

export interface WorldWithSeasons extends World {
  seasons?: Season[];
}

// =============================================================================
// Season Types
// =============================================================================

export interface Season {
  id: string;
  world_id: string;
  season_number: number;
  title?: string;
  description?: string;
  status: SeasonStatus;
  cover_art_url?: string;
  thumbnail_url?: string;
  premiere_date?: string;
  finale_date?: string;
  episode_count: number;
  total_runtime_minutes: number;
  sort_order: number;
  created_at: string;
  updated_at?: string;
  // Enriched
  episodes?: Episode[];
}

// =============================================================================
// Episode Types
// =============================================================================

export interface Episode {
  id: string;
  season_id: string;
  world_id: string;
  episode_number: number;
  season_number?: number;
  title: string;
  description?: string;
  video_asset_id?: string;
  thumbnail_url?: string;
  still_images?: string[];
  duration_seconds?: number;
  runtime_display?: string;
  status: EpisodeStatus;
  visibility: EpisodeVisibility;
  qc_status?: string;
  qc_notes?: string;
  scheduled_release?: string;
  published_at?: string;
  release_date?: string;
  intro_start_seconds?: number;
  intro_end_seconds?: number;
  credits_start_seconds?: number;
  recap_end_seconds?: number;
  view_count: number;
  created_at: string;
  updated_at?: string;
  // Enriched fields from API
  watch_progress?: {
    position: number;
    completed: boolean;
  };
  world?: {
    id: string;
    title: string;
    slug: string;
    thumbnail_url?: string;
  };
  video_url?: string; // Direct playback URL if available
}

// =============================================================================
// Video Asset Types
// =============================================================================

export interface VideoRendition {
  id: string;
  quality_label: string;
  resolution_width?: number;
  resolution_height?: number;
  bitrate_kbps?: number;
  video_codec?: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
}

export interface HLSManifest {
  id: string;
  status: string;
  playback_url?: string;
  cdn_base_url?: string;
  included_qualities: string[];
  drm_enabled: boolean;
}

export interface VideoThumbnail {
  id: string;
  timecode_seconds: number;
  image_url?: string;
  width?: number;
  height?: number;
  is_primary: boolean;
}

export interface VideoSubtitle {
  id: string;
  language_code: string;
  language_name: string;
  subtitle_type: 'subtitles' | 'captions' | 'sdh' | 'forced';
  subtitle_url?: string;
  is_default: boolean;
  is_auto_generated: boolean;
}

export interface VideoSpriteSheet {
  id: string;
  sprite_url?: string;
  vtt_url?: string;
  columns: number;
  rows: number;
  thumbnail_width?: number;
  thumbnail_height?: number;
  interval_seconds: number;
}

export interface VideoAsset {
  id: string;
  owner_id: string;
  world_id?: string;
  version_id: string;
  is_current_version: boolean;
  title?: string;
  description?: string;
  original_filename?: string;
  master_file_size_bytes?: number;
  duration_seconds?: number;
  frame_rate?: number;
  resolution_width?: number;
  resolution_height?: number;
  aspect_ratio?: string;
  codec?: string;
  audio_channels?: number;
  bitrate_kbps?: number;
  processing_status: ProcessingStatus;
  processing_progress: number;
  processing_error?: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  validation_passed?: boolean;
  validation_errors: string[];
  loudness_lufs?: number;
  created_at: string;
  updated_at?: string;
  // Enriched
  renditions?: VideoRendition[];
  manifest?: HLSManifest;
  thumbnails?: VideoThumbnail[];
  subtitles?: VideoSubtitle[];
  sprite_sheet?: VideoSpriteSheet;
}

export interface VideoAssetSummary {
  id: string;
  title?: string;
  duration_seconds?: number;
  resolution_width?: number;
  resolution_height?: number;
  processing_status: ProcessingStatus;
  processing_progress: number;
  thumbnail_url?: string;
  created_at: string;
}

// =============================================================================
// Playback Types
// =============================================================================

export interface PlaybackSession {
  session_id: string;
  video_asset_id: string;
  playback_url: string;
  cdn_base_url: string;
  available_qualities: string[];
  subtitles: VideoSubtitle[];
  sprite_sheet?: VideoSpriteSheet;
  expires_at: string;
  resume_position_seconds?: number;
}

// =============================================================================
// Shorts Types
// =============================================================================

export interface ShortCreator {
  id: string;
  display_name: string;
  avatar_url?: string;
  is_verified: boolean;
}

export interface ShortWorld {
  id: string;
  title: string;
  slug: string;
  thumbnail_url?: string;
}

export interface Short {
  id: string;
  world_id: string;
  title: string;
  description?: string;
  video_asset_id?: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  aspect_ratio: string;
  playback_url?: string;
  view_count: number;
  like_count: number;
  share_count: number;
  bookmark_count: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  published_at?: string;
  created_at: string;
  creator?: ShortCreator;
  world?: ShortWorld;
}

export interface ShortsFeedResponse {
  shorts: Short[];
  next_cursor?: string;
  has_more: boolean;
}

// =============================================================================
// Live Event Types
// =============================================================================

export interface EventWorld {
  id: string;
  title: string;
  slug: string;
  thumbnail_url?: string;
}

export interface EventHost {
  id: string;
  display_name: string;
  avatar_url?: string;
}

export interface LiveEvent {
  id: string;
  world_id: string;
  title: string;
  description?: string;
  event_type: EventType;
  status: EventStatus;
  cover_image_url?: string;
  thumbnail_url?: string;
  linked_episode_id?: string;
  linked_content_id?: string;
  scheduled_start: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  timezone: string;
  stream_type?: string;
  stream_url?: string;
  stream_provider: string;
  chat_enabled: boolean;
  reactions_enabled: boolean;
  qa_enabled: boolean;
  comments_enabled: boolean;
  sync_enabled: boolean;
  sync_position_seconds?: number;
  sync_is_playing: boolean;
  rsvp_count: number;
  peak_concurrent_viewers: number;
  total_viewers: number;
  visibility: EventVisibility;
  requires_premium: boolean;
  is_recording_available: boolean;
  recording_video_id?: string;
  created_at: string;
  updated_at?: string;
  world?: EventWorld;
  hosts?: EventHost[];
  user_rsvp?: RSVPStatus;
}

export interface EventSummary {
  id: string;
  world_id: string;
  title: string;
  event_type: EventType;
  status: EventStatus;
  scheduled_start: string;
  thumbnail_url?: string;
  rsvp_count: number;
  world?: EventWorld;
  user_rsvp?: RSVPStatus;
}

export interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  rsvp_status: RSVPStatus;
  notify_before_24h: boolean;
  notify_before_1h: boolean;
  notify_when_live: boolean;
  attended: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  message: string;
  message_type: 'chat' | 'question' | 'reaction' | 'system' | 'pinned';
  is_answered: boolean;
  is_pinned: boolean;
  is_hidden: boolean;
  created_at: string;
  user_display_name?: string;
  user_avatar_url?: string;
}

// =============================================================================
// Follow/Watchlist Types
// =============================================================================

export interface WorldFollow {
  id: string;
  world_id: string;
  user_id: string;
  notify_new_episodes: boolean;
  notify_companion_drops: boolean;
  notify_live_events: boolean;
  notify_announcements: boolean;
  notify_shorts: boolean;
  notifications_enabled: boolean;
  followed_at: string;
}

export interface WorldWatchlistItem {
  id: string;
  world_id: string;
  user_id: string;
  notes?: string;
  added_at: string;
  world?: WorldSummary;
}

// =============================================================================
// Watch History Types
// =============================================================================

export interface WatchHistoryItem {
  id: string;
  user_id: string;
  episode_id?: string;
  world_content_id?: string;
  world_id: string;
  position_seconds: number;
  duration_seconds?: number;
  completed: boolean;
  completed_at?: string;
  device_type?: string;
  last_watched_at: string;
  episode?: Episode;
  world?: WorldSummary;
}

// =============================================================================
// Search Types
// =============================================================================

export interface WorldSearchParams {
  query?: string;
  genre_slug?: string;
  content_format?: ContentFormat;
  status?: WorldStatus;
  limit?: number;
  offset?: number;
}

export interface WorldSearchResult {
  worlds: WorldSummary[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// Upload Types
// =============================================================================

export interface UploadPartUrl {
  part_number: number;
  upload_url: string;
  expires_at: string;
}

export interface UploadInitiateResponse {
  session_id: string;
  video_asset_id: string;
  upload_id: string;
  bucket: string;
  key: string;
  part_urls: UploadPartUrl[];
  expires_at: string;
}

export interface UploadStatusResponse {
  session_id: string;
  video_asset_id?: string;
  status: 'initiated' | 'uploading' | 'completing' | 'completed' | 'failed' | 'cancelled' | 'expired';
  parts_expected?: number;
  parts_uploaded: number;
  created_at: string;
  expires_at: string;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface EventListResponse {
  events: EventSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface VideoListResponse {
  videos: VideoAssetSummary[];
  total: number;
  limit: number;
  offset: number;
}
