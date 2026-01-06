"""
Linear Channels API
Phase 2A: Endpoints for linear channel discovery and playback.

This module provides:
- Channel discovery and listing
- Schedule viewing for a channel
- "Now playing" endpoint for client-side linear playback
- Viewer session management

PLAYBACK ARCHITECTURE:
For Phase 2A, we use client-side VOD simulation:
1. Client calls GET /linear/channels/{slug}/now to get current item
2. Response includes HLS manifest URL and seek position
3. Client seeks into VOD asset to simulate live playback
4. Client polls /now periodically to detect item transitions

Future server-side assembly would provide a continuous HLS playlist
that the client consumes like a traditional live stream.
"""

import logging
from datetime import datetime, date
from typing import Optional, List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user_optional, get_user_profile, require_admin, require_order_member
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.services.linear_schedule import LinearScheduleService

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class ChannelSummary(BaseModel):
    id: str
    slug: str
    name: str
    description: Optional[str] = None
    tagline: Optional[str] = None
    category: str
    visibility: str
    is_24_7: bool
    logo_url: Optional[str] = None
    accent_color: Optional[str] = None
    status: str
    current_viewers: int = 0
    stream_type: str = "vod_simulation"
    # FAST/Ad-supported fields
    is_free: bool = True
    has_ads: bool = True
    midroll_interval_seconds: Optional[int] = None


class ChannelDetail(ChannelSummary):
    background_url: Optional[str] = None
    timezone: str = "America/Los_Angeles"
    default_block_name: Optional[str] = None
    offline_slate_url: Optional[str] = None


class BlockSummary(BaseModel):
    id: str
    slug: str
    name: str
    theme: Optional[str] = None
    duration_seconds: int


class ScheduleEntry(BaseModel):
    entry_id: Optional[str] = None
    block_id: str
    block_slug: Optional[str] = None
    block_name: str
    block_theme: Optional[str] = None
    block_duration: int
    block_thumbnail: Optional[str] = None
    start_time_utc: datetime
    end_time_utc: datetime
    recurrence_type: str = "none"
    override_reason: Optional[str] = None


class ScheduleResponse(BaseModel):
    channel: ChannelSummary
    date: str
    timezone: str
    schedule: List[ScheduleEntry]


class NowPlayingItem(BaseModel):
    id: str
    type: str
    title: Optional[str] = None
    world_id: Optional[str] = None
    world_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: int


class PlaybackAsset(BaseModel):
    type: str  # "hls", "slate", "ad_break"
    manifest_url: Optional[str] = None
    cloudfront_url: Optional[str] = None
    seek_seconds: float = 0
    duration_seconds: Optional[int] = None
    video_asset_id: Optional[str] = None
    is_looping: bool = False
    placement_type: Optional[str] = None  # For ad breaks


class NowPlayingResponse(BaseModel):
    channel: dict
    status: str  # "playing", "offline", "no_schedule", "gap", "empty_block"
    message: Optional[str] = None
    block: Optional[dict] = None
    item: Optional[NowPlayingItem] = None
    position_seconds: int = 0
    remaining_seconds: int = 0
    next_item: Optional[dict] = None
    playback_asset: Optional[PlaybackAsset] = None
    offline_slate_url: Optional[str] = None
    # Ad break indicators for FAST channels
    ad_break_due: bool = False
    next_ad_break_in_seconds: Optional[int] = None


class ViewerSessionStart(BaseModel):
    device_type: Optional[str] = None
    device_id: Optional[str] = None


class ViewerSessionResponse(BaseModel):
    session_id: str
    channel_id: str


class HeartbeatRequest(BaseModel):
    session_id: str
    current_block_id: Optional[str] = None
    watch_seconds: int = 0
    # Per-episode tracking for creator earnings
    episode_id: Optional[str] = None
    world_id: Optional[str] = None


# =============================================================================
# CHANNEL DISCOVERY
# =============================================================================

@router.get("/channels", response_model=List[ChannelSummary], tags=["Linear - Discovery"])
async def list_channels(
    category: Optional[str] = Query(None, description="Filter by category"),
    include_internal: bool = Query(False, description="Include internal channels (admin only)"),
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    List all linear channels visible to the current user.

    Returns channels ordered by category (main first) then by current viewers.
    Anonymous users only see public channels.
    Order members see public + order_only channels.
    Admins can optionally include internal channels.
    """
    # Determine viewer role
    viewer_role = None
    if user:
        profile = execute_single(
            "SELECT is_order_member, is_premium, is_admin, is_superadmin FROM profiles WHERE cognito_id = :cid",
            {"cid": user.get("sub")}
        )
        if profile:
            if profile.get('is_superadmin') or profile.get('is_admin'):
                viewer_role = 'admin'
            elif profile.get('is_order_member'):
                viewer_role = 'order_member'
            elif profile.get('is_premium'):
                viewer_role = 'premium'

    # Only allow include_internal for admins
    if include_internal and viewer_role != 'admin':
        include_internal = False

    channels = await LinearScheduleService.list_visible_channels(
        viewer_role=viewer_role,
        include_internal=include_internal
    )

    # Filter by category if specified
    if category:
        channels = [c for c in channels if c.get('category') == category]

    return channels


@router.get("/channels/{slug}", tags=["Linear - Discovery"])
async def get_channel(
    slug: str,
    target_date: Optional[str] = Query(None, description="Date for schedule (YYYY-MM-DD), defaults to today"),
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get channel details and schedule for a specific day.

    Returns full channel metadata plus the day's programming schedule.
    """
    channel = await LinearScheduleService.get_channel_by_slug(slug)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check visibility access
    if not await _can_access_channel(channel, user):
        raise HTTPException(status_code=403, detail="You don't have access to this channel")

    # Parse target date or use today
    channel_tz = channel.get('timezone', 'America/Los_Angeles')
    if target_date:
        try:
            schedule_date = date.fromisoformat(target_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        schedule_date = datetime.now(ZoneInfo(channel_tz)).date()

    # Get schedule for the day
    schedule = await LinearScheduleService.get_schedule_for_day(
        channel['id'],
        schedule_date,
        channel_tz
    )

    return {
        "channel": channel,
        "date": schedule_date.isoformat(),
        "timezone": channel_tz,
        "schedule": schedule
    }


# =============================================================================
# NOW PLAYING / LIVE PLAYBACK
# =============================================================================

@router.get("/channels/{slug}/now", response_model=NowPlayingResponse, tags=["Linear - Playback"])
async def get_now_playing(
    slug: str,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get what's currently playing on a channel.

    This is the primary endpoint for linear playback. Returns:
    - Current block and item information
    - Position within the current item (for seeking)
    - Playback asset details (HLS URL and seek position)
    - Next item preview

    CLIENT PLAYBACK FLOW:
    1. Call this endpoint to get current item and seek position
    2. Load the HLS manifest from playback_asset.manifest_url
    3. Seek to playback_asset.seek_seconds
    4. When item changes (position_seconds > duration), call again
    5. For ad_placeholder items, call /ads/break to get ad creatives

    The response is deterministic - same timestamp always yields same result.
    """
    channel = await LinearScheduleService.get_channel_by_slug(slug)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if not await _can_access_channel(channel, user):
        raise HTTPException(status_code=403, detail="You don't have access to this channel")

    now_playing = await LinearScheduleService.get_now_playing(channel['id'])

    if not now_playing:
        raise HTTPException(status_code=500, detail="Unable to compute now playing")

    return now_playing


@router.get("/channels/{slug}/schedule", tags=["Linear - Discovery"])
async def get_channel_schedule(
    slug: str,
    days: int = Query(1, ge=1, le=7, description="Number of days to fetch"),
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get the schedule for multiple days.

    Returns up to 7 days of programming schedule.
    """
    channel = await LinearScheduleService.get_channel_by_slug(slug)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if not await _can_access_channel(channel, user):
        raise HTTPException(status_code=403, detail="You don't have access to this channel")

    channel_tz = channel.get('timezone', 'America/Los_Angeles')
    today = datetime.now(ZoneInfo(channel_tz)).date()

    schedules = []
    for i in range(days):
        target_date = today + timedelta(days=i)
        day_schedule = await LinearScheduleService.get_schedule_for_day(
            channel['id'],
            target_date,
            channel_tz
        )
        schedules.append({
            "date": target_date.isoformat(),
            "schedule": day_schedule
        })

    return {
        "channel": {
            "id": channel['id'],
            "slug": channel['slug'],
            "name": channel['name']
        },
        "timezone": channel_tz,
        "days": schedules
    }


# =============================================================================
# VIEWER SESSIONS
# =============================================================================

@router.post("/channels/{slug}/session", response_model=ViewerSessionResponse, tags=["Linear - Playback"])
async def start_viewer_session(
    slug: str,
    body: ViewerSessionStart,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Start a viewer session for analytics and concurrent viewer tracking.

    Called when a user starts watching a channel.
    Returns a session_id to use for heartbeats and session end.
    """
    channel = await LinearScheduleService.get_channel_by_slug(slug)
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if not await _can_access_channel(channel, user):
        raise HTTPException(status_code=403, detail="You don't have access to this channel")

    # Get viewer profile ID if authenticated
    viewer_id = None
    if user:
        profile = execute_single(
            "SELECT id FROM profiles WHERE cognito_id = :cid",
            {"cid": user.get("sub")}
        )
        if profile:
            viewer_id = str(profile['id'])

    session_id = await LinearScheduleService.start_viewer_session(
        channel_id=channel['id'],
        viewer_id=viewer_id,
        device_type=body.device_type,
        device_id=body.device_id
    )

    logger.info(
        "viewer_session_started",
        channel_slug=slug,
        session_id=session_id,
        viewer_id=viewer_id
    )

    return ViewerSessionResponse(
        session_id=session_id,
        channel_id=channel['id']
    )


@router.post("/channels/{slug}/heartbeat", tags=["Linear - Playback"])
async def heartbeat(
    slug: str,
    body: HeartbeatRequest
):
    """
    Send heartbeat to keep session alive and track watch time.

    Should be called every 30-60 seconds while actively watching.
    Updates last_heartbeat_at, tracks which blocks were viewed,
    and records per-episode watch time for creator earnings.

    Include episode_id, world_id, and watch_seconds to track
    watch time that flows into the creator earnings pipeline.
    """
    # Get viewer_id from the session for playback_sessions linking
    viewer_id = None
    session_info = execute_single(
        "SELECT viewer_id FROM channel_viewer_sessions WHERE id = :session_id",
        {"session_id": body.session_id}
    )
    if session_info:
        viewer_id = str(session_info['viewer_id']) if session_info.get('viewer_id') else None

    await LinearScheduleService.heartbeat_viewer_session(
        session_id=body.session_id,
        current_block_id=body.current_block_id,
        episode_id=body.episode_id,
        world_id=body.world_id,
        watch_seconds=body.watch_seconds,
        viewer_id=viewer_id
    )

    return {"status": "ok"}


@router.post("/channels/{slug}/session/{session_id}/end", tags=["Linear - Playback"])
async def end_viewer_session(
    slug: str,
    session_id: str,
    watch_seconds: int = Query(0, description="Total seconds watched in session")
):
    """
    End a viewer session.

    Called when user stops watching (navigates away, closes player).
    Decrements the concurrent viewer count.
    """
    await LinearScheduleService.end_viewer_session(
        session_id=session_id,
        total_watch_seconds=watch_seconds
    )

    logger.info(
        "viewer_session_ended",
        channel_slug=slug,
        session_id=session_id,
        watch_seconds=watch_seconds
    )

    return {"status": "ended"}


# =============================================================================
# ADMIN ENDPOINTS - CHANNEL MANAGEMENT
# =============================================================================

@router.post("/admin/channels", tags=["Linear - Admin"])
async def create_channel(
    name: str,
    slug: str,
    description: Optional[str] = None,
    tagline: Optional[str] = None,
    category: str = "genre",
    visibility: str = "public",
    is_24_7: bool = True,
    timezone: str = "America/Los_Angeles",
    profile: dict = Depends(require_admin)
):
    """Create a new linear channel (admin only)."""
    # Check slug uniqueness
    existing = execute_single(
        "SELECT id FROM linear_channels WHERE slug = :slug",
        {"slug": slug}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Channel slug already exists")

    channel = execute_insert("""
        INSERT INTO linear_channels (name, slug, description, tagline, category, visibility, is_24_7, timezone, created_by)
        VALUES (:name, :slug, :description, :tagline, :category, :visibility, :is_24_7, :timezone, :created_by)
        RETURNING *
    """, {
        "name": name,
        "slug": slug,
        "description": description,
        "tagline": tagline,
        "category": category,
        "visibility": visibility,
        "is_24_7": is_24_7,
        "timezone": timezone,
        "created_by": profile['id']
    })

    logger.info("linear_channel_created", channel_id=channel['id'], slug=slug, created_by=profile['id'])

    return dict(channel)


@router.put("/admin/channels/{channel_id}", tags=["Linear - Admin"])
async def update_channel(
    channel_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tagline: Optional[str] = None,
    category: Optional[str] = None,
    visibility: Optional[str] = None,
    status: Optional[str] = None,
    default_block_id: Optional[str] = None,
    logo_url: Optional[str] = None,
    offline_slate_url: Optional[str] = None,
    profile: dict = Depends(require_admin)
):
    """Update a linear channel (admin only)."""
    # Build update dynamically
    updates = []
    params = {"channel_id": channel_id}

    if name is not None:
        updates.append("name = :name")
        params["name"] = name
    if description is not None:
        updates.append("description = :description")
        params["description"] = description
    if tagline is not None:
        updates.append("tagline = :tagline")
        params["tagline"] = tagline
    if category is not None:
        updates.append("category = :category")
        params["category"] = category
    if visibility is not None:
        updates.append("visibility = :visibility")
        params["visibility"] = visibility
    if status is not None:
        updates.append("status = :status")
        params["status"] = status
    if default_block_id is not None:
        updates.append("default_block_id = :default_block_id")
        params["default_block_id"] = default_block_id
    if logo_url is not None:
        updates.append("logo_url = :logo_url")
        params["logo_url"] = logo_url
    if offline_slate_url is not None:
        updates.append("offline_slate_url = :offline_slate_url")
        params["offline_slate_url"] = offline_slate_url

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    updates.append("updated_at = NOW()")

    channel = execute_single(f"""
        UPDATE linear_channels
        SET {', '.join(updates)}
        WHERE id = :channel_id
        RETURNING *
    """, params)

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    logger.info("linear_channel_updated", channel_id=channel_id, updated_by=profile['id'])

    return dict(channel)


@router.post("/admin/channels/{channel_id}/go-live", tags=["Linear - Admin"])
async def set_channel_live(
    channel_id: str,
    profile: dict = Depends(require_admin)
):
    """Set a channel to live status (admin only)."""
    channel = execute_single("""
        UPDATE linear_channels
        SET status = 'live', updated_at = NOW()
        WHERE id = :channel_id
        RETURNING *
    """, {"channel_id": channel_id})

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    logger.info("linear_channel_went_live", channel_id=channel_id, set_by=profile['id'])

    return {"status": "live", "channel": dict(channel)}


# =============================================================================
# ADMIN ENDPOINTS - BLOCK MANAGEMENT
# =============================================================================

@router.get("/admin/blocks", tags=["Linear - Admin"])
async def list_blocks(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    theme: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    profile: dict = Depends(require_admin)
):
    """List all blocks with optional filters (admin only)."""
    conditions = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if status:
        conditions.append("status = :status")
        params["status"] = status
    if category:
        conditions.append("category = :category")
        params["category"] = category
    if theme:
        conditions.append("theme = :theme")
        params["theme"] = theme

    blocks = execute_query(f"""
        SELECT
            b.*,
            (SELECT COUNT(*) FROM block_items WHERE block_id = b.id) as item_count,
            p.display_name as created_by_name
        FROM blocks b
        LEFT JOIN profiles p ON b.created_by = p.id
        WHERE {' AND '.join(conditions)}
        ORDER BY b.updated_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(b) for b in blocks]


@router.post("/admin/blocks", tags=["Linear - Admin"])
async def create_block(
    name: str,
    slug: str,
    description: Optional[str] = None,
    theme: Optional[str] = None,
    category: str = "programming",
    target_duration_seconds: int = 3600,
    profile: dict = Depends(require_admin)
):
    """Create a new programming block (admin only)."""
    existing = execute_single(
        "SELECT id FROM blocks WHERE slug = :slug",
        {"slug": slug}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Block slug already exists")

    block = execute_insert("""
        INSERT INTO blocks (name, slug, description, theme, category, target_duration_seconds, created_by)
        VALUES (:name, :slug, :description, :theme, :category, :target_duration_seconds, :created_by)
        RETURNING *
    """, {
        "name": name,
        "slug": slug,
        "description": description,
        "theme": theme,
        "category": category,
        "target_duration_seconds": target_duration_seconds,
        "created_by": profile['id']
    })

    logger.info("block_created", block_id=block['id'], slug=slug, created_by=profile['id'])

    return dict(block)


@router.get("/admin/blocks/{block_id}", tags=["Linear - Admin"])
async def get_block(
    block_id: str,
    profile: dict = Depends(require_admin)
):
    """Get block details with all items (admin only)."""
    block = execute_single("""
        SELECT b.*, p.display_name as created_by_name
        FROM blocks b
        LEFT JOIN profiles p ON b.created_by = p.id
        WHERE b.id = :block_id
    """, {"block_id": block_id})

    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    items = await LinearScheduleService.get_block_items(block_id)

    return {
        "block": dict(block),
        "items": items
    }


@router.post("/admin/blocks/{block_id}/items", tags=["Linear - Admin"])
async def add_block_item(
    block_id: str,
    item_type: str,
    item_id: Optional[str] = None,
    sort_order: int = 0,
    slate_asset_url: Optional[str] = None,
    slate_duration_seconds: Optional[int] = None,
    explicit_duration_seconds: Optional[int] = None,
    start_offset_seconds: int = 0,
    transition_type: str = "cut",
    profile: dict = Depends(require_admin)
):
    """Add an item to a block (admin only)."""
    # Validate item_id exists for episode/companion types
    if item_type == 'world_episode' and item_id:
        episode = execute_single("SELECT id FROM episodes WHERE id = :id", {"id": item_id})
        if not episode:
            raise HTTPException(status_code=400, detail="Episode not found")
    elif item_type == 'world_companion' and item_id:
        content = execute_single("SELECT id FROM world_content WHERE id = :id", {"id": item_id})
        if not content:
            raise HTTPException(status_code=400, detail="World content not found")

    item = execute_insert("""
        INSERT INTO block_items (
            block_id, item_type, item_id, sort_order,
            slate_asset_url, slate_duration_seconds,
            explicit_duration_seconds, start_offset_seconds, transition_type
        )
        VALUES (
            :block_id, :item_type, :item_id, :sort_order,
            :slate_asset_url, :slate_duration_seconds,
            :explicit_duration_seconds, :start_offset_seconds, :transition_type
        )
        RETURNING *
    """, {
        "block_id": block_id,
        "item_type": item_type,
        "item_id": item_id,
        "sort_order": sort_order,
        "slate_asset_url": slate_asset_url,
        "slate_duration_seconds": slate_duration_seconds,
        "explicit_duration_seconds": explicit_duration_seconds,
        "start_offset_seconds": start_offset_seconds,
        "transition_type": transition_type
    })

    logger.info("block_item_added", block_id=block_id, item_id=item['id'], item_type=item_type)

    return dict(item)


@router.delete("/admin/blocks/{block_id}/items/{item_id}", tags=["Linear - Admin"])
async def remove_block_item(
    block_id: str,
    item_id: str,
    profile: dict = Depends(require_admin)
):
    """Remove an item from a block (admin only)."""
    result = execute_single("""
        DELETE FROM block_items
        WHERE id = :item_id AND block_id = :block_id
        RETURNING id
    """, {"item_id": item_id, "block_id": block_id})

    if not result:
        raise HTTPException(status_code=404, detail="Block item not found")

    logger.info("block_item_removed", block_id=block_id, item_id=item_id)

    return {"status": "deleted"}


@router.put("/admin/blocks/{block_id}/items/reorder", tags=["Linear - Admin"])
async def reorder_block_items(
    block_id: str,
    item_ids: List[str],
    profile: dict = Depends(require_admin)
):
    """Reorder items in a block (admin only)."""
    for i, item_id in enumerate(item_ids):
        execute_update("""
            UPDATE block_items
            SET sort_order = :sort_order
            WHERE id = :item_id AND block_id = :block_id
        """, {"item_id": item_id, "block_id": block_id, "sort_order": i})

    logger.info("block_items_reordered", block_id=block_id)

    return {"status": "reordered", "count": len(item_ids)}


@router.get("/admin/blocks/{block_id}/validate", tags=["Linear - Admin"])
async def validate_block(
    block_id: str,
    target_duration: Optional[int] = Query(None, description="Override target duration for validation"),
    profile: dict = Depends(require_admin)
):
    """Validate block duration against target (admin only)."""
    result = await LinearScheduleService.validate_block_duration(block_id, target_duration)
    return result


# =============================================================================
# ADMIN ENDPOINTS - SCHEDULE MANAGEMENT
# =============================================================================

@router.post("/admin/channels/{channel_id}/schedule", tags=["Linear - Admin"])
async def add_schedule_entry(
    channel_id: str,
    block_id: str,
    start_time_utc: datetime,
    recurrence_type: str = "none",
    recurrence_end_date: Optional[str] = None,
    priority: int = 0,
    override_reason: Optional[str] = None,
    profile: dict = Depends(require_admin)
):
    """Add a schedule entry to a channel (admin only)."""
    # Validate block exists
    block = execute_single("SELECT id, computed_duration_seconds FROM blocks WHERE id = :id", {"id": block_id})
    if not block:
        raise HTTPException(status_code=400, detail="Block not found")

    # Compute end time
    end_time_utc = start_time_utc + timedelta(seconds=block['computed_duration_seconds'])

    entry = execute_insert("""
        INSERT INTO channel_schedule_entries (
            channel_id, block_id, start_time_utc, end_time_utc,
            recurrence_type, recurrence_end_date, priority, override_reason, created_by
        )
        VALUES (
            :channel_id, :block_id, :start_time_utc, :end_time_utc,
            :recurrence_type, :recurrence_end_date, :priority, :override_reason, :created_by
        )
        RETURNING *
    """, {
        "channel_id": channel_id,
        "block_id": block_id,
        "start_time_utc": start_time_utc,
        "end_time_utc": end_time_utc,
        "recurrence_type": recurrence_type,
        "recurrence_end_date": recurrence_end_date,
        "priority": priority,
        "override_reason": override_reason,
        "created_by": profile['id']
    })

    logger.info("schedule_entry_added", channel_id=channel_id, entry_id=entry['id'])

    return dict(entry)


@router.delete("/admin/schedule/{entry_id}", tags=["Linear - Admin"])
async def remove_schedule_entry(
    entry_id: str,
    profile: dict = Depends(require_admin)
):
    """Remove a schedule entry (admin only)."""
    result = execute_single("""
        DELETE FROM channel_schedule_entries
        WHERE id = :entry_id
        RETURNING id
    """, {"entry_id": entry_id})

    if not result:
        raise HTTPException(status_code=404, detail="Schedule entry not found")

    logger.info("schedule_entry_removed", entry_id=entry_id)

    return {"status": "deleted"}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def _can_access_channel(channel: dict, user: Optional[dict]) -> bool:
    """Check if a user can access a channel based on visibility."""
    visibility = channel.get('visibility', 'public')

    if visibility == 'public':
        return True

    if not user:
        return False

    profile = execute_single(
        "SELECT is_order_member, is_premium, is_admin, is_superadmin FROM profiles WHERE cognito_id = :cid",
        {"cid": user.get("sub")}
    )

    if not profile:
        return False

    if profile.get('is_superadmin') or profile.get('is_admin'):
        return True

    if visibility == 'order_only' and profile.get('is_order_member'):
        return True

    if visibility == 'premium' and (profile.get('is_premium') or profile.get('is_order_member')):
        return True

    if visibility == 'internal':
        return profile.get('is_admin') or profile.get('is_superadmin')

    return False


# Import timedelta at the top
from datetime import timedelta
