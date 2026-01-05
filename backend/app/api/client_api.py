"""
Client API - Mobile/TV Optimized Endpoints
Phase 4A: Unified home feed and mobile-friendly session APIs.

This module provides optimized endpoints for mobile and TV clients:
- Unified /home endpoint with all sections in one call
- Mobile/TV-friendly playback session creation
- Device-aware content delivery
- Efficient caching for constrained devices
"""

from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from pydantic import BaseModel, Field
import json
import hashlib

from app.core.database import execute_query, execute_single, execute_insert
from app.core.auth import get_current_user, get_current_user_optional
from app.services.recommendation_service import RecommendationService

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class DeviceInfo(BaseModel):
    """Device information from client."""
    device_type: str = Field(default="unknown")
    device_id: Optional[str] = None
    client_version: Optional[str] = None
    client_platform: Optional[str] = None


class HomeFeedSection(BaseModel):
    """A section in the home feed."""
    type: str
    title: str
    items: List[dict]
    reason: Optional[str] = None
    see_all_url: Optional[str] = None


class HomeFeedResponse(BaseModel):
    """Response from the home feed endpoint."""
    sections: List[HomeFeedSection]
    generated_at: str
    cache_ttl_seconds: int
    personalized: bool
    user_id: Optional[str] = None


class PlaybackSessionRequest(BaseModel):
    """Request to create a playback session."""
    episode_id: str
    device_type: str = "unknown"
    device_id: Optional[str] = None
    client_version: Optional[str] = None
    resume_position: Optional[int] = None  # Seconds


class PlaybackAccess(BaseModel):
    """Access information for playback."""
    allowed: bool
    reason: Optional[str] = None
    requires_premium: bool = False
    requires_order: bool = False


class AdBreak(BaseModel):
    """Ad break marker for free content."""
    position_seconds: int
    duration_seconds: int
    ad_type: str  # 'preroll', 'midroll', 'postroll'


class PlaybackSessionResponse(BaseModel):
    """Response with playback session details."""
    session_id: str
    episode_id: str
    world_id: str
    world_title: str
    episode_title: str
    hls_url: str
    hls_url_backup: Optional[str] = None
    access: PlaybackAccess
    resume_position_seconds: int = 0
    total_duration_seconds: Optional[int] = None
    ad_breaks: List[AdBreak] = []
    allow_download: bool = False
    download_expires_hours: Optional[int] = None
    next_episode: Optional[dict] = None


# =============================================================================
# Home Feed Endpoint
# =============================================================================

@router.get("/home", response_model=HomeFeedResponse)
async def get_home_feed(
    request: Request,
    limit_per_section: int = Query(12, ge=1, le=30),
    include_continue_watching: bool = Query(True),
    include_lodges: bool = Query(True),
    x_device_type: Optional[str] = Header(None),
    x_client_version: Optional[str] = Header(None),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get unified home feed for mobile/TV clients.

    This endpoint returns all home screen sections in a single efficient call,
    optimized for constrained devices.

    Headers:
    - X-Device-Type: Device type (mobile_ios, tv_roku, etc.)
    - X-Client-Version: Client app version

    Returns structured sections:
    - continue_watching: Incomplete episodes with progress
    - followed_worlds: Recent from followed Worlds
    - because_you_watched: Similar to recently watched
    - from_your_lodges: Lodge-featured content (Order members)
    - trending_now: High recent watch time
    - new_releases: Recent premieres
    - sports_highlights: Live/upcoming sports
    """
    user_id = None
    profile = None

    if current_user:
        profile = execute_single(
            "SELECT id, is_order_member FROM profiles WHERE cognito_sub = :sub",
            {"sub": current_user.get("sub")}
        )
        if profile:
            user_id = str(profile["id"])

    # Check cache first
    cache_key = _generate_cache_key(user_id, limit_per_section, include_lodges)
    cached = _get_cached_home_feed(user_id, cache_key)
    if cached:
        return cached

    sections = []
    cache_ttl = 300  # 5 minutes default

    # Section 1: Continue Watching (logged-in users)
    if user_id and include_continue_watching:
        continue_watching = await _get_continue_watching(user_id, limit_per_section)
        if continue_watching:
            sections.append(HomeFeedSection(
                type="continue_watching",
                title="Continue Watching",
                items=continue_watching,
                reason="Resume where you left off"
            ))

    # Section 2: Followed Worlds (new content)
    if user_id:
        followed = await _get_followed_worlds_new_content(user_id, limit_per_section)
        if followed:
            sections.append(HomeFeedSection(
                type="followed_worlds",
                title="New From Followed",
                items=followed,
                reason="From Worlds you follow"
            ))

    # Section 3: Because You Watched (personalized)
    if user_id:
        recent_world = await RecommendationService._get_most_recent_watched_world(user_id)
        if recent_world:
            related = await RecommendationService.get_related_worlds(
                recent_world["world_id"],
                exclude_user_watched=True,
                user_id=user_id,
                limit=limit_per_section
            )
            if related:
                sections.append(HomeFeedSection(
                    type="because_you_watched",
                    title=f"Because You Watched {recent_world['title']}",
                    items=related,
                    reason=f"Similar to {recent_world['title']}"
                ))

    # Section 4: From Your Lodges (Order members)
    if user_id and include_lodges and profile and profile.get("is_order_member"):
        lodge_content = await RecommendationService._get_lodge_recommendations(
            user_id, limit=limit_per_section
        )
        if lodge_content:
            sections.append(HomeFeedSection(
                type="from_your_lodges",
                title="From Your Lodges",
                items=lodge_content,
                reason="Featured by your lodge community"
            ))

    # Section 5: Trending Now
    trending = await RecommendationService._get_trending_worlds(limit=limit_per_section)
    if trending:
        sections.append(HomeFeedSection(
            type="trending_now",
            title="Trending Now",
            items=trending,
            reason="Popular this week",
            see_all_url="/browse/trending"
        ))

    # Section 6: New Releases
    new_releases = await RecommendationService._get_new_releases(limit=limit_per_section)
    if new_releases:
        sections.append(HomeFeedSection(
            type="new_releases",
            title="New Releases",
            items=new_releases,
            reason="Recently premiered",
            see_all_url="/browse/new"
        ))

    # Section 7: Sports Highlights (if content exists)
    sports = await RecommendationService._get_sports_highlights(limit=limit_per_section)
    if sports:
        sections.append(HomeFeedSection(
            type="sports_highlights",
            title="Sports & Action",
            items=sports,
            reason="Live events and athletic content",
            see_all_url="/browse/sports"
        ))

    # Section 8: Top Narrative (default category for non-personalized)
    if not user_id:
        top_narrative = await RecommendationService._get_top_in_category(
            "narrative", limit=limit_per_section
        )
        if top_narrative:
            sections.append(HomeFeedSection(
                type="top_narrative",
                title="Top Films & Series",
                items=top_narrative,
                reason="Highest rated narrative content"
            ))

    response = HomeFeedResponse(
        sections=sections,
        generated_at=datetime.utcnow().isoformat(),
        cache_ttl_seconds=cache_ttl,
        personalized=user_id is not None,
        user_id=user_id
    )

    # Cache the response
    _cache_home_feed(user_id, cache_key, response, cache_ttl)

    # Track device usage
    if x_device_type:
        _track_client_usage(x_device_type, x_client_version, "home_feed")

    return response


# =============================================================================
# Playback Session Endpoints
# =============================================================================

@router.post("/playback/sessions", response_model=PlaybackSessionResponse)
async def create_playback_session(
    request: PlaybackSessionRequest,
    http_request: Request,
    x_device_type: Optional[str] = Header(None),
    x_client_version: Optional[str] = Header(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Create a playback session for mobile/TV clients.

    Returns everything needed to start playback:
    - HLS stream URLs (primary + backup)
    - Access information (allowed, reason if denied)
    - Resume position from watch history
    - Ad break markers (for free content)
    - Download permissions (if applicable)
    - Next episode info
    """
    # Get user profile
    profile = execute_single(
        "SELECT id, is_order_member, is_premium FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    user_id = str(profile["id"])

    # Get episode and world info
    episode = execute_single("""
        SELECT
            e.id,
            e.title as episode_title,
            e.episode_number,
            e.duration_seconds,
            e.visibility,
            e.status,
            w.id as world_id,
            w.title as world_title,
            w.slug as world_slug,
            w.visibility as world_visibility,
            w.status as world_status,
            s.id as season_id,
            s.season_number,
            va.hls_manifest_url,
            va.hls_manifest_url_backup
        FROM episodes e
        JOIN worlds w ON e.world_id = w.id
        LEFT JOIN seasons s ON e.season_id = s.id
        LEFT JOIN video_assets va ON e.video_asset_id = va.id
        WHERE e.id = :episode_id
    """, {"episode_id": request.episode_id})

    if not episode:
        raise HTTPException(404, "Episode not found")

    # Check access
    access = _check_playback_access(profile, episode)

    if not access.allowed:
        # Still create session for tracking, but don't provide stream URL
        session_id = await _create_session_record(
            user_id=user_id,
            episode=episode,
            device_type=x_device_type or request.device_type,
            device_id=request.device_id,
            client_version=x_client_version or request.client_version,
            ip_address=http_request.client.host if http_request.client else None,
            access_denied=True
        )

        return PlaybackSessionResponse(
            session_id=session_id,
            episode_id=request.episode_id,
            world_id=str(episode["world_id"]),
            world_title=episode["world_title"],
            episode_title=episode["episode_title"],
            hls_url="",  # Empty when access denied
            access=access
        )

    # Get resume position from watch history
    watch_record = execute_single("""
        SELECT position_seconds, completed
        FROM watch_history
        WHERE user_id = :user_id AND episode_id = :episode_id
    """, {"user_id": user_id, "episode_id": request.episode_id})

    resume_position = 0
    if watch_record and not watch_record.get("completed"):
        resume_position = watch_record.get("position_seconds", 0)

    # Override with request if provided
    if request.resume_position is not None:
        resume_position = request.resume_position

    # Get ad breaks for free content
    ad_breaks = []
    if not profile.get("is_order_member") and not profile.get("is_premium"):
        ad_breaks = _get_ad_breaks(episode.get("duration_seconds", 0))

    # Create session
    session_id = await _create_session_record(
        user_id=user_id,
        episode=episode,
        device_type=x_device_type or request.device_type,
        device_id=request.device_id,
        client_version=x_client_version or request.client_version,
        ip_address=http_request.client.host if http_request.client else None,
        access_denied=False
    )

    # Get next episode
    next_episode = await _get_next_episode(episode)

    # Determine download permissions
    allow_download = _check_download_permission(profile, episode)

    return PlaybackSessionResponse(
        session_id=session_id,
        episode_id=request.episode_id,
        world_id=str(episode["world_id"]),
        world_title=episode["world_title"],
        episode_title=episode["episode_title"],
        hls_url=episode.get("hls_manifest_url", ""),
        hls_url_backup=episode.get("hls_manifest_url_backup"),
        access=access,
        resume_position_seconds=resume_position,
        total_duration_seconds=episode.get("duration_seconds"),
        ad_breaks=ad_breaks,
        allow_download=allow_download,
        download_expires_hours=48 if allow_download else None,
        next_episode=next_episode
    )


@router.post("/playback/sessions/{session_id}/heartbeat")
async def send_heartbeat(
    session_id: str,
    position_seconds: int = Query(..., ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    Send playback heartbeat to keep session alive and track progress.

    Should be called every 15-30 seconds during playback.
    """
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Update session
    session = execute_single("""
        UPDATE playback_sessions
        SET last_heartbeat_at = NOW(),
            heartbeat_count = heartbeat_count + 1,
            updated_at = NOW()
        WHERE id = :session_id AND user_id = :user_id
        RETURNING id, episode_id
    """, {"session_id": session_id, "user_id": str(profile["id"])})

    if not session:
        raise HTTPException(404, "Session not found")

    # Update watch history
    execute_single("""
        INSERT INTO watch_history (user_id, episode_id, position_seconds, updated_at)
        VALUES (:user_id, :episode_id, :position, NOW())
        ON CONFLICT (user_id, episode_id) DO UPDATE SET
            position_seconds = GREATEST(watch_history.position_seconds, :position),
            updated_at = NOW()
    """, {
        "user_id": str(profile["id"]),
        "episode_id": session["episode_id"],
        "position": position_seconds
    })

    return {"success": True, "position_seconds": position_seconds}


@router.post("/playback/sessions/{session_id}/complete")
async def mark_playback_complete(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark episode as completed."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Update session
    session = execute_single("""
        UPDATE playback_sessions
        SET status = 'completed', ended_at = NOW(), updated_at = NOW()
        WHERE id = :session_id AND user_id = :user_id
        RETURNING id, episode_id
    """, {"session_id": session_id, "user_id": str(profile["id"])})

    if not session:
        raise HTTPException(404, "Session not found")

    # Update watch history
    execute_single("""
        INSERT INTO watch_history (user_id, episode_id, completed, completed_at, updated_at)
        VALUES (:user_id, :episode_id, true, NOW(), NOW())
        ON CONFLICT (user_id, episode_id) DO UPDATE SET
            completed = true,
            completed_at = NOW(),
            updated_at = NOW()
    """, {
        "user_id": str(profile["id"]),
        "episode_id": session["episode_id"]
    })

    return {"success": True, "completed": True}


# =============================================================================
# Device Settings
# =============================================================================

@router.get("/device/settings")
async def get_device_settings(
    device_type: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get device-specific settings for the current user."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    settings = execute_single("""
        SELECT * FROM user_device_settings
        WHERE user_id = :user_id AND device_type = :device_type::device_type
    """, {"user_id": str(profile["id"]), "device_type": device_type})

    if not settings:
        # Return defaults
        return {
            "device_type": device_type,
            "preferred_quality": "auto",
            "autoplay_enabled": True,
            "subtitles_enabled": False,
            "subtitle_language": "en",
            "audio_language": "en",
            "push_notifications_enabled": True,
            "dark_mode": True
        }

    return dict(settings)


@router.put("/device/settings")
async def update_device_settings(
    device_type: str,
    preferred_quality: Optional[str] = None,
    autoplay_enabled: Optional[bool] = None,
    subtitles_enabled: Optional[bool] = None,
    subtitle_language: Optional[str] = None,
    push_notifications_enabled: Optional[bool] = None,
    dark_mode: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update device-specific settings."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    # Build update fields
    updates = []
    params = {"user_id": str(profile["id"]), "device_type": device_type}

    if preferred_quality is not None:
        updates.append("preferred_quality = :preferred_quality")
        params["preferred_quality"] = preferred_quality

    if autoplay_enabled is not None:
        updates.append("autoplay_enabled = :autoplay_enabled")
        params["autoplay_enabled"] = autoplay_enabled

    if subtitles_enabled is not None:
        updates.append("subtitles_enabled = :subtitles_enabled")
        params["subtitles_enabled"] = subtitles_enabled

    if subtitle_language is not None:
        updates.append("subtitle_language = :subtitle_language")
        params["subtitle_language"] = subtitle_language

    if push_notifications_enabled is not None:
        updates.append("push_notifications_enabled = :push_notifications_enabled")
        params["push_notifications_enabled"] = push_notifications_enabled

    if dark_mode is not None:
        updates.append("dark_mode = :dark_mode")
        params["dark_mode"] = dark_mode

    if not updates:
        raise HTTPException(400, "No settings to update")

    updates.append("last_used_at = NOW()")
    updates.append("updated_at = NOW()")

    result = execute_single(f"""
        INSERT INTO user_device_settings (user_id, device_type, {', '.join(k.split(' = ')[0] for k in updates if '=' in k)})
        VALUES (:user_id, :device_type::device_type, {', '.join(':' + k.split(' = ')[0] for k in updates if '=' in k and k.split(' = ')[0] in params)})
        ON CONFLICT (user_id, device_type) DO UPDATE SET
            {', '.join(updates)}
        RETURNING *
    """, params)

    return {"success": True, "settings": dict(result) if result else None}


# =============================================================================
# Helper Functions
# =============================================================================

def _generate_cache_key(user_id: Optional[str], limit: int, include_lodges: bool) -> str:
    """Generate cache key for home feed."""
    key_parts = [
        user_id or "anonymous",
        str(limit),
        str(include_lodges)
    ]
    return hashlib.md5(":".join(key_parts).encode()).hexdigest()


def _get_cached_home_feed(user_id: Optional[str], cache_key: str) -> Optional[HomeFeedResponse]:
    """Get cached home feed if valid."""
    cached = execute_single("""
        SELECT sections, generated_at, cache_ttl_seconds, is_personalized
        FROM home_feed_cache
        WHERE (user_id = :user_id OR (user_id IS NULL AND :user_id IS NULL))
          AND cache_key = :cache_key
          AND expires_at > NOW()
    """, {"user_id": user_id, "cache_key": cache_key})

    if not cached:
        return None

    sections_data = cached.get("sections", [])
    if isinstance(sections_data, str):
        sections_data = json.loads(sections_data)

    return HomeFeedResponse(
        sections=[HomeFeedSection(**s) for s in sections_data],
        generated_at=cached["generated_at"].isoformat() if cached.get("generated_at") else datetime.utcnow().isoformat(),
        cache_ttl_seconds=cached.get("cache_ttl_seconds", 300),
        personalized=cached.get("is_personalized", False),
        user_id=user_id
    )


def _cache_home_feed(user_id: Optional[str], cache_key: str, response: HomeFeedResponse, ttl_seconds: int):
    """Cache home feed response."""
    try:
        sections_json = json.dumps([s.dict() for s in response.sections])
        execute_insert("""
            INSERT INTO home_feed_cache (user_id, cache_key, sections, expires_at, cache_ttl_seconds, is_personalized)
            VALUES (:user_id, :cache_key, :sections::jsonb, NOW() + :ttl * INTERVAL '1 second', :ttl, :personalized)
            ON CONFLICT (user_id, cache_key) DO UPDATE SET
                sections = EXCLUDED.sections,
                expires_at = EXCLUDED.expires_at,
                cache_ttl_seconds = EXCLUDED.cache_ttl_seconds,
                generated_at = NOW()
        """, {
            "user_id": user_id,
            "cache_key": cache_key,
            "sections": sections_json,
            "ttl": ttl_seconds,
            "personalized": response.personalized
        })
    except Exception:
        pass  # Cache failures shouldn't break the response


def _track_client_usage(device_type: str, client_version: Optional[str], endpoint: str):
    """Track API client usage."""
    try:
        execute_insert("""
            INSERT INTO api_client_usage (client_id, client_version, usage_date, total_requests)
            VALUES (:client_id, :version, CURRENT_DATE, 1)
            ON CONFLICT (client_id, client_version, usage_date) DO UPDATE SET
                total_requests = api_client_usage.total_requests + 1
        """, {
            "client_id": f"swn-{device_type}",
            "version": client_version or "unknown"
        })
    except Exception:
        pass


async def _get_continue_watching(user_id: str, limit: int) -> List[dict]:
    """Get episodes in progress for continue watching."""
    episodes = execute_query("""
        SELECT DISTINCT ON (w.id)
            w.id as world_id,
            w.title as world_title,
            w.slug as world_slug,
            w.cover_art_url,
            e.id as episode_id,
            e.title as episode_title,
            e.episode_number,
            e.thumbnail_url,
            e.duration_seconds,
            s.season_number,
            wh.position_seconds,
            ROUND(wh.position_seconds::numeric / NULLIF(e.duration_seconds, 0) * 100, 1) as progress_percent,
            wh.updated_at as last_watched
        FROM watch_history wh
        JOIN episodes e ON wh.episode_id = e.id
        JOIN worlds w ON e.world_id = w.id
        LEFT JOIN seasons s ON e.season_id = s.id
        WHERE wh.user_id = :user_id
          AND wh.completed = false
          AND wh.position_seconds > 30
          AND w.status = 'active'
          AND e.status = 'published'
        ORDER BY w.id, wh.updated_at DESC
        LIMIT :limit
    """, {"user_id": user_id, "limit": limit})

    return [dict(e) for e in episodes]


async def _get_followed_worlds_new_content(user_id: str, limit: int) -> List[dict]:
    """Get new content from followed Worlds."""
    content = execute_query("""
        SELECT
            w.id as world_id,
            w.title as world_title,
            w.slug as world_slug,
            w.cover_art_url,
            e.id as episode_id,
            e.title as episode_title,
            e.episode_number,
            e.thumbnail_url,
            e.published_at,
            s.season_number
        FROM world_follows wf
        JOIN worlds w ON wf.world_id = w.id
        JOIN episodes e ON e.world_id = w.id
        LEFT JOIN seasons s ON e.season_id = s.id
        WHERE wf.user_id = :user_id
          AND w.status = 'active'
          AND e.status = 'published'
          AND e.published_at >= NOW() - INTERVAL '14 days'
          AND NOT EXISTS (
              SELECT 1 FROM watch_history wh
              WHERE wh.user_id = :user_id
                AND wh.episode_id = e.id
                AND wh.completed = true
          )
        ORDER BY e.published_at DESC
        LIMIT :limit
    """, {"user_id": user_id, "limit": limit})

    return [dict(c) for c in content]


def _check_playback_access(profile: dict, episode: dict) -> PlaybackAccess:
    """Check if user can access the episode."""
    # Check World status
    if episode.get("world_status") != "active":
        return PlaybackAccess(
            allowed=False,
            reason="This World is not currently available"
        )

    # Check episode status
    if episode.get("status") != "published":
        return PlaybackAccess(
            allowed=False,
            reason="This episode is not yet published"
        )

    # Check visibility
    visibility = episode.get("visibility", "public")

    if visibility == "premium":
        if profile.get("is_order_member") or profile.get("is_premium"):
            return PlaybackAccess(allowed=True)
        return PlaybackAccess(
            allowed=False,
            reason="This content requires Order membership or premium access",
            requires_premium=True,
            requires_order=True
        )

    if visibility == "private":
        return PlaybackAccess(
            allowed=False,
            reason="This content is private"
        )

    # Public content
    return PlaybackAccess(allowed=True)


def _get_ad_breaks(duration_seconds: Optional[int]) -> List[AdBreak]:
    """Generate ad break markers for free content."""
    if not duration_seconds:
        return []

    breaks = []

    # Pre-roll ad
    breaks.append(AdBreak(
        position_seconds=0,
        duration_seconds=15,
        ad_type="preroll"
    ))

    # Mid-roll ads every 10 minutes for content > 20 minutes
    if duration_seconds > 1200:
        midroll_interval = 600  # 10 minutes
        position = midroll_interval
        while position < duration_seconds - 300:  # Stop 5 min before end
            breaks.append(AdBreak(
                position_seconds=position,
                duration_seconds=30,
                ad_type="midroll"
            ))
            position += midroll_interval

    return breaks


async def _create_session_record(
    user_id: str,
    episode: dict,
    device_type: str,
    device_id: Optional[str],
    client_version: Optional[str],
    ip_address: Optional[str],
    access_denied: bool
) -> str:
    """Create playback session record."""
    result = execute_insert("""
        INSERT INTO playback_sessions (
            user_id, episode_id, world_id,
            device_type, device_id, client_version, ip_address,
            is_mobile, is_tv,
            hls_url, hls_url_backup,
            status, started_at
        ) VALUES (
            :user_id, :episode_id, :world_id,
            :device_type::device_type, :device_id, :client_version, :ip_address::inet,
            :is_mobile, :is_tv,
            :hls_url, :hls_url_backup,
            :status, NOW()
        )
        RETURNING id
    """, {
        "user_id": user_id,
        "episode_id": str(episode["id"]),
        "world_id": str(episode["world_id"]),
        "device_type": device_type if device_type in [
            'web', 'mobile_ios', 'mobile_android', 'tv_android', 'tv_roku',
            'tv_firetv', 'tv_appletv', 'tv_samsung', 'tv_lg',
            'desktop_macos', 'desktop_windows', 'desktop_linux'
        ] else 'unknown',
        "device_id": device_id,
        "client_version": client_version,
        "ip_address": ip_address,
        "is_mobile": device_type in ['mobile_ios', 'mobile_android'],
        "is_tv": device_type in ['tv_android', 'tv_roku', 'tv_firetv', 'tv_appletv', 'tv_samsung', 'tv_lg'],
        "hls_url": episode.get("hls_manifest_url") if not access_denied else None,
        "hls_url_backup": episode.get("hls_manifest_url_backup") if not access_denied else None,
        "status": "denied" if access_denied else "active"
    })

    return str(result["id"])


async def _get_next_episode(current_episode: dict) -> Optional[dict]:
    """Get the next episode in the series."""
    if not current_episode.get("season_id"):
        return None

    next_ep = execute_single("""
        SELECT
            e.id as episode_id,
            e.title,
            e.episode_number,
            e.thumbnail_url,
            e.duration_seconds,
            s.season_number
        FROM episodes e
        JOIN seasons s ON e.season_id = s.id
        WHERE e.world_id = :world_id
          AND e.status = 'published'
          AND (
              (s.season_number = :season AND e.episode_number > :episode)
              OR s.season_number > :season
          )
        ORDER BY s.season_number, e.episode_number
        LIMIT 1
    """, {
        "world_id": str(current_episode["world_id"]),
        "season": current_episode.get("season_number", 1),
        "episode": current_episode.get("episode_number", 0)
    })

    return dict(next_ep) if next_ep else None


def _check_download_permission(profile: dict, episode: dict) -> bool:
    """Check if user can download the episode."""
    # Only Order members or premium can download
    if not profile.get("is_order_member") and not profile.get("is_premium"):
        return False

    # Check World allows downloads (could be a field on the World)
    # For now, default to True for premium users
    return True
