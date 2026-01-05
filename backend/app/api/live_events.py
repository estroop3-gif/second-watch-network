"""
Live Events API - Premieres, Watch Parties, Q&A Sessions
Part of: Consumer Streaming Platform
"""
from datetime import datetime, timedelta
from typing import Optional, List
from enum import Enum
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from app.core.database import get_client, execute_single, execute_query
from app.core.auth import get_current_user, get_current_user_optional

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id_from_cognito_id(cognito_user_id: str) -> Optional[str]:
    """Look up the profile ID from a Cognito user ID."""
    if not cognito_user_id:
        return None
    uid_str = str(cognito_user_id)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    return None


# =============================================================================
# Enums
# =============================================================================

class EventType(str, Enum):
    premiere = "premiere"
    watch_party = "watch_party"
    qa = "qa"
    behind_scenes = "behind_scenes"
    announcement = "announcement"
    live_stream = "live_stream"
    table_read = "table_read"
    commentary = "commentary"
    other = "other"


class EventStatus(str, Enum):
    draft = "draft"
    scheduled = "scheduled"
    starting = "starting"
    live = "live"
    ended = "ended"
    cancelled = "cancelled"
    archived = "archived"


class EventVisibility(str, Enum):
    public = "public"
    followers_only = "followers_only"
    unlisted = "unlisted"
    private = "private"


class RSVPStatus(str, Enum):
    interested = "interested"
    going = "going"
    declined = "declined"


class StreamType(str, Enum):
    vod_premiere = "vod_premiere"
    live_input = "live_input"
    watch_party = "watch_party"
    external = "external"


# =============================================================================
# Schemas
# =============================================================================

class EventWorld(BaseModel):
    """World info for an event"""
    id: str
    title: str
    slug: str
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class EventHost(BaseModel):
    """Host info"""
    id: str
    display_name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class LiveEvent(BaseModel):
    """A live event"""
    id: str
    world_id: str
    title: str
    description: Optional[str] = None
    event_type: EventType
    status: EventStatus = EventStatus.scheduled

    # Visual
    cover_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    # Linked content
    linked_episode_id: Optional[str] = None
    linked_content_id: Optional[str] = None

    # Scheduling
    scheduled_start: datetime
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    timezone: str = "America/New_York"

    # Streaming
    stream_type: Optional[StreamType] = None
    stream_url: Optional[str] = None
    stream_provider: str = "internal"

    # Features
    chat_enabled: bool = True
    reactions_enabled: bool = True
    qa_enabled: bool = False
    comments_enabled: bool = True

    # Watch Party Sync
    sync_enabled: bool = False
    sync_position_seconds: Optional[float] = None
    sync_is_playing: bool = False

    # Metrics
    rsvp_count: int = 0
    peak_concurrent_viewers: int = 0
    total_viewers: int = 0

    # Visibility
    visibility: EventVisibility = EventVisibility.public
    requires_premium: bool = False

    # Recording
    is_recording_available: bool = False
    recording_video_id: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None

    # Related
    world: Optional[EventWorld] = None
    hosts: Optional[List[EventHost]] = None

    # User state
    user_rsvp: Optional[RSVPStatus] = None

    class Config:
        from_attributes = True


class EventSummary(BaseModel):
    """Minimal event info for lists"""
    id: str
    world_id: str
    title: str
    event_type: EventType
    status: EventStatus
    scheduled_start: datetime
    thumbnail_url: Optional[str] = None
    rsvp_count: int = 0

    world: Optional[EventWorld] = None
    user_rsvp: Optional[RSVPStatus] = None

    class Config:
        from_attributes = True


class EventCreateRequest(BaseModel):
    """Request to create an event"""
    world_id: str
    title: str
    description: Optional[str] = None
    event_type: EventType
    scheduled_start: datetime
    scheduled_end: Optional[datetime] = None
    timezone: str = "America/New_York"
    cover_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    linked_episode_id: Optional[str] = None
    linked_content_id: Optional[str] = None
    stream_type: Optional[StreamType] = None
    visibility: EventVisibility = EventVisibility.public
    requires_premium: bool = False
    chat_enabled: bool = True
    reactions_enabled: bool = True
    qa_enabled: bool = False


class EventUpdateRequest(BaseModel):
    """Request to update an event"""
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    cover_image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    status: Optional[EventStatus] = None
    visibility: Optional[EventVisibility] = None
    chat_enabled: Optional[bool] = None
    reactions_enabled: Optional[bool] = None
    qa_enabled: Optional[bool] = None


class RSVPRequest(BaseModel):
    """RSVP to an event"""
    status: RSVPStatus = RSVPStatus.going
    notify_before_24h: bool = True
    notify_before_1h: bool = True
    notify_when_live: bool = True


class EventRSVP(BaseModel):
    """User's RSVP for an event"""
    id: str
    event_id: str
    user_id: str
    rsvp_status: RSVPStatus
    notify_before_24h: bool = True
    notify_before_1h: bool = True
    notify_when_live: bool = True
    attended: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ChatMessage(BaseModel):
    """A chat message in an event"""
    id: str
    event_id: str
    user_id: str
    message: str
    message_type: str = "chat"
    is_answered: bool = False
    is_pinned: bool = False
    is_hidden: bool = False
    created_at: datetime

    # User info
    user_display_name: Optional[str] = None
    user_avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class ChatMessageCreate(BaseModel):
    """Create a chat message"""
    message: str
    message_type: str = "chat"  # 'chat', 'question'


class EventListResponse(BaseModel):
    """Paginated event list"""
    events: List[EventSummary]
    total: int
    limit: int
    offset: int


# =============================================================================
# Event Endpoints
# =============================================================================

@router.get("/upcoming", response_model=EventListResponse)
async def get_upcoming_events(
    world_id: Optional[str] = None,
    limit: int = Query(default=20, le=50),
    offset: int = 0,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get upcoming live events.
    """
    profile_id = None
    if current_user:
        profile_id = await get_profile_id_from_cognito_id(current_user.get("sub"))

    # Build query with proper JOIN
    params = {
        "status": "scheduled",
        "now": datetime.utcnow().isoformat(),
        "limit": limit,
        "offset": offset
    }

    world_filter = ""
    if world_id:
        world_filter = "AND le.world_id = :world_id"
        params["world_id"] = world_id

    query = f"""
        SELECT le.id, le.world_id, le.title, le.event_type, le.status,
               le.scheduled_start, le.thumbnail_url, le.rsvp_count,
               w.id as world_id_ref, w.title as world_title, w.slug as world_slug,
               w.thumbnail_url as world_thumbnail
        FROM live_events le
        JOIN worlds w ON w.id = le.world_id
        WHERE le.status = :status
        AND le.scheduled_start >= :now
        AND le.visibility IN ('public', 'followers_only')
        {world_filter}
        ORDER BY le.scheduled_start ASC
        LIMIT :limit OFFSET :offset
    """

    # Get count
    count_query = f"""
        SELECT COUNT(*) as cnt FROM live_events le
        WHERE le.status = :status
        AND le.scheduled_start >= :now
        AND le.visibility IN ('public', 'followers_only')
        {world_filter}
    """

    results = execute_query(query, params)
    count_result = execute_single(count_query, params)
    total = count_result.get("cnt", 0) if count_result else 0

    # Get user RSVPs if logged in
    client = get_client()
    rsvp_map = {}
    if profile_id and results:
        event_ids = [e["id"] for e in results]
        rsvps = client.table("live_event_rsvps").select(
            "event_id, rsvp_status"
        ).eq("user_id", profile_id).in_("event_id", event_ids).execute()
        rsvp_map = {r["event_id"]: r["rsvp_status"] for r in (rsvps.data or [])}

    events = []
    for e in results:
        world_data = {
            "id": e.get("world_id_ref"),
            "title": e.get("world_title"),
            "slug": e.get("world_slug"),
            "thumbnail_url": e.get("world_thumbnail")
        } if e.get("world_id_ref") else None

        events.append(EventSummary(
            id=e["id"],
            world_id=e["world_id"],
            title=e["title"],
            event_type=e["event_type"],
            status=e["status"],
            scheduled_start=e["scheduled_start"],
            thumbnail_url=e.get("thumbnail_url") or (world_data.get("thumbnail_url") if world_data else None),
            rsvp_count=e.get("rsvp_count") or 0,
            world=EventWorld(**world_data) if world_data else None,
            user_rsvp=rsvp_map.get(e["id"])
        ))

    return EventListResponse(
        events=events,
        total=total,
        limit=limit,
        offset=offset
    )


@router.get("/live", response_model=List[EventSummary])
async def get_live_events(
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get currently live events.
    """
    profile_id = None
    if current_user:
        profile_id = await get_profile_id_from_cognito_id(current_user.get("sub"))

    # Query with proper JOIN
    query = """
        SELECT le.id, le.world_id, le.title, le.event_type, le.status,
               le.scheduled_start, le.thumbnail_url, le.rsvp_count,
               le.peak_concurrent_viewers,
               w.id as world_id_ref, w.title as world_title, w.slug as world_slug,
               w.thumbnail_url as world_thumbnail
        FROM live_events le
        JOIN worlds w ON w.id = le.world_id
        WHERE le.status IN ('live', 'starting')
        AND le.visibility IN ('public', 'followers_only')
    """

    results = execute_query(query, {})

    # Get user RSVPs
    client = get_client()
    rsvp_map = {}
    if profile_id and results:
        event_ids = [e["id"] for e in results]
        rsvps = client.table("live_event_rsvps").select(
            "event_id, rsvp_status"
        ).eq("user_id", profile_id).in_("event_id", event_ids).execute()
        rsvp_map = {r["event_id"]: r["rsvp_status"] for r in (rsvps.data or [])}

    events = []
    for e in results:
        world_data = {
            "id": e.get("world_id_ref"),
            "title": e.get("world_title"),
            "slug": e.get("world_slug"),
            "thumbnail_url": e.get("world_thumbnail")
        } if e.get("world_id_ref") else None

        events.append(EventSummary(
            id=e["id"],
            world_id=e["world_id"],
            title=e["title"],
            event_type=e["event_type"],
            status=e["status"],
            scheduled_start=e["scheduled_start"],
            thumbnail_url=e.get("thumbnail_url") or (world_data.get("thumbnail_url") if world_data else None),
            rsvp_count=e.get("rsvp_count") or 0,
            world=EventWorld(**world_data) if world_data else None,
            user_rsvp=rsvp_map.get(e["id"])
        ))

    return events


@router.get("/my/upcoming", response_model=List[EventSummary])
async def get_my_upcoming_events(
    limit: int = Query(default=10, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get upcoming events from worlds the user follows, plus events they've RSVP'd to.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Use the database function
    query = """
        SELECT * FROM get_upcoming_events_for_user(:user_id, :limit)
    """
    results = execute_query(query, {"user_id": profile_id, "limit": limit})

    events = []
    for r in results:
        events.append(EventSummary(
            id=r["event_id"],
            world_id=r["world_id"],
            title=r["event_title"],
            event_type=r["event_type"],
            status="scheduled",
            scheduled_start=r["scheduled_start"],
            thumbnail_url=r.get("thumbnail_url"),
            rsvp_count=r.get("rsvp_count") or 0,
            world=EventWorld(
                id=r["world_id"],
                title=r["world_title"],
                slug=r["world_slug"],
                thumbnail_url=r.get("thumbnail_url")
            ),
            user_rsvp=r.get("rsvp_status")
        ))

    return events


@router.get("/{event_id}", response_model=LiveEvent)
async def get_event(
    event_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get full event details.
    """
    profile_id = None
    if current_user:
        profile_id = await get_profile_id_from_cognito_id(current_user.get("sub"))

    client = get_client()

    # Query with proper JOIN
    query = """
        SELECT le.*,
               w.id as world_id_ref, w.title as world_title, w.slug as world_slug,
               w.thumbnail_url as world_thumbnail
        FROM live_events le
        JOIN worlds w ON w.id = le.world_id
        WHERE le.id = :event_id
    """
    e = execute_single(query, {"event_id": event_id})

    if not e:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check visibility
    if e["visibility"] == "private":
        if not profile_id or profile_id not in (e.get("host_ids") or []):
            raise HTTPException(status_code=404, detail="Event not found")

    # Get user RSVP
    user_rsvp = None
    if profile_id:
        rsvp = client.table("live_event_rsvps").select("rsvp_status").eq(
            "event_id", event_id
        ).eq("user_id", profile_id).limit(1).execute()
        if rsvp.data:
            user_rsvp = rsvp.data[0]["rsvp_status"]

    # Get hosts
    hosts = []
    if e.get("host_ids"):
        hosts_result = client.table("profiles").select(
            "id, display_name, avatar_url"
        ).in_("id", e["host_ids"]).execute()
        hosts = [EventHost(**h) for h in (hosts_result.data or [])]

    world_data = {
        "id": e.get("world_id_ref"),
        "title": e.get("world_title"),
        "slug": e.get("world_slug"),
        "thumbnail_url": e.get("world_thumbnail")
    } if e.get("world_id_ref") else None

    return LiveEvent(
        id=e["id"],
        world_id=e["world_id"],
        title=e["title"],
        description=e.get("description"),
        event_type=e["event_type"],
        status=e["status"],
        cover_image_url=e.get("cover_image_url"),
        thumbnail_url=e.get("thumbnail_url"),
        linked_episode_id=e.get("linked_episode_id"),
        linked_content_id=e.get("linked_content_id"),
        scheduled_start=e["scheduled_start"],
        scheduled_end=e.get("scheduled_end"),
        actual_start=e.get("actual_start"),
        actual_end=e.get("actual_end"),
        timezone=e.get("timezone") or "America/New_York",
        stream_type=e.get("stream_type"),
        stream_url=e.get("stream_url") if e["status"] in ["live", "starting"] else None,
        stream_provider=e.get("stream_provider") or "internal",
        chat_enabled=e.get("chat_enabled", True),
        reactions_enabled=e.get("reactions_enabled", True),
        qa_enabled=e.get("qa_enabled", False),
        comments_enabled=e.get("comments_enabled", True),
        sync_enabled=e.get("sync_enabled", False),
        sync_position_seconds=e.get("sync_position_seconds"),
        sync_is_playing=e.get("sync_is_playing", False),
        rsvp_count=e.get("rsvp_count") or 0,
        peak_concurrent_viewers=e.get("peak_concurrent_viewers") or 0,
        total_viewers=e.get("total_viewers") or 0,
        visibility=e["visibility"],
        requires_premium=e.get("requires_premium", False),
        is_recording_available=e.get("is_recording_available", False),
        recording_video_id=e.get("recording_video_id"),
        created_at=e["created_at"],
        updated_at=e.get("updated_at"),
        world=EventWorld(**world_data) if world_data else None,
        hosts=hosts if hosts else None,
        user_rsvp=user_rsvp
    )


@router.post("", response_model=LiveEvent)
async def create_event(
    request: EventCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new live event.
    Only world creators/admins can create events.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify user owns/manages the world
    world = client.table("worlds").select("id, creator_id").eq(
        "id", request.world_id
    ).single().execute()

    if not world.data:
        raise HTTPException(status_code=404, detail="World not found")

    if world.data["creator_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized to create events for this world")

    # Create event
    event_data = {
        "world_id": request.world_id,
        "title": request.title,
        "description": request.description,
        "event_type": request.event_type.value,
        "scheduled_start": request.scheduled_start.isoformat(),
        "scheduled_end": request.scheduled_end.isoformat() if request.scheduled_end else None,
        "timezone": request.timezone,
        "cover_image_url": request.cover_image_url,
        "thumbnail_url": request.thumbnail_url,
        "linked_episode_id": request.linked_episode_id,
        "linked_content_id": request.linked_content_id,
        "stream_type": request.stream_type.value if request.stream_type else None,
        "visibility": request.visibility.value,
        "requires_premium": request.requires_premium,
        "chat_enabled": request.chat_enabled,
        "reactions_enabled": request.reactions_enabled,
        "qa_enabled": request.qa_enabled,
        "status": "scheduled",
        "host_ids": [profile_id],
        "created_by": profile_id
    }

    result = client.table("live_events").insert(event_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create event")

    return await get_event(result.data[0]["id"], current_user)


@router.put("/{event_id}", response_model=LiveEvent)
async def update_event(
    event_id: str,
    request: EventUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update an event.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify ownership
    event = client.table("live_events").select("id, host_ids").eq(
        "id", event_id
    ).single().execute()

    if not event.data:
        raise HTTPException(status_code=404, detail="Event not found")

    if profile_id not in (event.data.get("host_ids") or []):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update
    update_data = {}
    if request.title is not None:
        update_data["title"] = request.title
    if request.description is not None:
        update_data["description"] = request.description
    if request.scheduled_start is not None:
        update_data["scheduled_start"] = request.scheduled_start.isoformat()
    if request.scheduled_end is not None:
        update_data["scheduled_end"] = request.scheduled_end.isoformat()
    if request.cover_image_url is not None:
        update_data["cover_image_url"] = request.cover_image_url
    if request.thumbnail_url is not None:
        update_data["thumbnail_url"] = request.thumbnail_url
    if request.status is not None:
        update_data["status"] = request.status.value
    if request.visibility is not None:
        update_data["visibility"] = request.visibility.value
    if request.chat_enabled is not None:
        update_data["chat_enabled"] = request.chat_enabled
    if request.reactions_enabled is not None:
        update_data["reactions_enabled"] = request.reactions_enabled
    if request.qa_enabled is not None:
        update_data["qa_enabled"] = request.qa_enabled

    if update_data:
        client.table("live_events").update(update_data).eq("id", event_id).execute()

    return await get_event(event_id, current_user)


@router.delete("/{event_id}")
async def delete_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete/cancel an event.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify ownership
    event = client.table("live_events").select("id, host_ids, status").eq(
        "id", event_id
    ).single().execute()

    if not event.data:
        raise HTTPException(status_code=404, detail="Event not found")

    if profile_id not in (event.data.get("host_ids") or []):
        raise HTTPException(status_code=403, detail="Not authorized")

    # If event is in progress, just cancel it
    if event.data["status"] in ["live", "starting"]:
        client.table("live_events").update({
            "status": "cancelled"
        }).eq("id", event_id).execute()
        return {"status": "cancelled"}

    # Otherwise delete
    client.table("live_events").delete().eq("id", event_id).execute()
    return {"status": "deleted"}


# =============================================================================
# RSVP Endpoints
# =============================================================================

@router.post("/{event_id}/rsvp", response_model=EventRSVP)
async def rsvp_to_event(
    event_id: str,
    request: RSVPRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    RSVP to an event.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify event exists
    event = client.table("live_events").select("id").eq("id", event_id).single().execute()
    if not event.data:
        raise HTTPException(status_code=404, detail="Event not found")

    # Upsert RSVP
    rsvp_data = {
        "event_id": event_id,
        "user_id": profile_id,
        "rsvp_status": request.status.value,
        "notify_before_24h": request.notify_before_24h,
        "notify_before_1h": request.notify_before_1h,
        "notify_when_live": request.notify_when_live
    }

    result = client.table("live_event_rsvps").upsert(
        rsvp_data, on_conflict="event_id,user_id"
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save RSVP")

    r = result.data[0]
    return EventRSVP(
        id=r["id"],
        event_id=r["event_id"],
        user_id=r["user_id"],
        rsvp_status=r["rsvp_status"],
        notify_before_24h=r.get("notify_before_24h", True),
        notify_before_1h=r.get("notify_before_1h", True),
        notify_when_live=r.get("notify_when_live", True),
        attended=r.get("attended", False),
        created_at=r["created_at"]
    )


@router.delete("/{event_id}/rsvp")
async def cancel_rsvp(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Cancel RSVP to an event.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()
    client.table("live_event_rsvps").delete().eq(
        "event_id", event_id
    ).eq("user_id", profile_id).execute()

    return {"status": "cancelled"}


@router.get("/{event_id}/rsvps", response_model=List[EventRSVP])
async def get_event_rsvps(
    event_id: str,
    status: Optional[RSVPStatus] = None,
    limit: int = Query(default=50, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Get RSVPs for an event (hosts only).
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify host
    event = client.table("live_events").select("host_ids").eq(
        "id", event_id
    ).single().execute()

    if not event.data:
        raise HTTPException(status_code=404, detail="Event not found")

    if profile_id not in (event.data.get("host_ids") or []):
        raise HTTPException(status_code=403, detail="Not authorized")

    query = client.table("live_event_rsvps").select("*").eq("event_id", event_id)

    if status:
        query = query.eq("rsvp_status", status.value)

    query = query.order("created_at", desc=True).limit(limit)
    result = query.execute()

    return [EventRSVP(**r) for r in (result.data or [])]


# =============================================================================
# Chat Endpoints
# =============================================================================

@router.get("/{event_id}/chat", response_model=List[ChatMessage])
async def get_chat_messages(
    event_id: str,
    limit: int = Query(default=50, le=200),
    before: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get chat messages for an event.
    """
    client = get_client()

    query = client.table("live_event_chat").select(
        "id, event_id, user_id, message, message_type, is_answered, is_pinned, "
        "is_hidden, created_at, profiles!live_event_chat_user_id_fkey(display_name, avatar_url)"
    ).eq("event_id", event_id).eq("is_hidden", False)

    if before:
        query = query.lt("created_at", before)

    query = query.order("created_at", desc=True).limit(limit)
    result = query.execute()

    messages = []
    for m in reversed(result.data or []):
        profile_data = m.get("profiles")
        messages.append(ChatMessage(
            id=m["id"],
            event_id=m["event_id"],
            user_id=m["user_id"],
            message=m["message"],
            message_type=m.get("message_type") or "chat",
            is_answered=m.get("is_answered", False),
            is_pinned=m.get("is_pinned", False),
            is_hidden=m.get("is_hidden", False),
            created_at=m["created_at"],
            user_display_name=profile_data.get("display_name") if profile_data else None,
            user_avatar_url=profile_data.get("avatar_url") if profile_data else None
        ))

    return messages


@router.post("/{event_id}/chat", response_model=ChatMessage)
async def send_chat_message(
    event_id: str,
    request: ChatMessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Send a chat message to an event.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify event exists and chat is enabled
    event = client.table("live_events").select(
        "id, status, chat_enabled"
    ).eq("id", event_id).single().execute()

    if not event.data:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.data.get("chat_enabled", True):
        raise HTTPException(status_code=400, detail="Chat is disabled for this event")

    if event.data["status"] not in ["live", "starting"]:
        raise HTTPException(status_code=400, detail="Event is not live")

    # Create message
    result = client.table("live_event_chat").insert({
        "event_id": event_id,
        "user_id": profile_id,
        "message": request.message,
        "message_type": request.message_type
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to send message")

    m = result.data[0]

    # Get user info
    profile = client.table("profiles").select(
        "display_name, avatar_url"
    ).eq("id", profile_id).single().execute()

    return ChatMessage(
        id=m["id"],
        event_id=m["event_id"],
        user_id=m["user_id"],
        message=m["message"],
        message_type=m.get("message_type") or "chat",
        is_answered=False,
        is_pinned=False,
        is_hidden=False,
        created_at=m["created_at"],
        user_display_name=profile.data.get("display_name") if profile.data else None,
        user_avatar_url=profile.data.get("avatar_url") if profile.data else None
    )


@router.post("/{event_id}/chat/{message_id}/pin")
async def pin_message(
    event_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Pin a chat message (hosts only).
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify host
    event = client.table("live_events").select("host_ids").eq(
        "id", event_id
    ).single().execute()

    if not event.data or profile_id not in (event.data.get("host_ids") or []):
        raise HTTPException(status_code=403, detail="Not authorized")

    client.table("live_event_chat").update({
        "is_pinned": True,
        "pinned_by": profile_id,
        "pinned_at": datetime.utcnow().isoformat()
    }).eq("id", message_id).eq("event_id", event_id).execute()

    return {"status": "pinned"}


@router.delete("/{event_id}/chat/{message_id}")
async def delete_message(
    event_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Hide/delete a chat message (hosts only or own message).
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get message
    message = client.table("live_event_chat").select(
        "user_id"
    ).eq("id", message_id).eq("event_id", event_id).single().execute()

    if not message.data:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check if user owns message or is host
    is_owner = message.data["user_id"] == profile_id

    if not is_owner:
        event = client.table("live_events").select("host_ids").eq(
            "id", event_id
        ).single().execute()

        if not event.data or profile_id not in (event.data.get("host_ids") or []):
            raise HTTPException(status_code=403, detail="Not authorized")

    # Hide message
    client.table("live_event_chat").update({
        "is_hidden": True,
        "hidden_by": profile_id,
        "hidden_at": datetime.utcnow().isoformat()
    }).eq("id", message_id).execute()

    return {"status": "deleted"}


# =============================================================================
# Viewer Session Endpoints (for analytics)
# =============================================================================

@router.post("/{event_id}/join")
async def join_event(
    event_id: str,
    session_id: str,
    device_type: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Record joining a live event (for viewer count).
    """
    profile_id = None
    if current_user:
        profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    client = get_client()

    # Create viewer session
    client.table("live_event_viewer_sessions").upsert({
        "event_id": event_id,
        "user_id": profile_id,
        "session_id": session_id,
        "device_type": device_type,
        "is_active": True,
        "last_heartbeat": datetime.utcnow().isoformat()
    }, on_conflict="session_id").execute()

    # Update viewer count
    execute_single(
        "SELECT update_live_event_viewer_count(:event_id)",
        {"event_id": event_id}
    )

    return {"status": "joined"}


@router.post("/{event_id}/heartbeat")
async def event_heartbeat(
    event_id: str,
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Send heartbeat to keep viewer session active.
    """
    client = get_client()

    client.table("live_event_viewer_sessions").update({
        "last_heartbeat": datetime.utcnow().isoformat(),
        "is_active": True
    }).eq("session_id", session_id).eq("event_id", event_id).execute()

    return {"status": "ok"}


@router.post("/{event_id}/leave")
async def leave_event(
    event_id: str,
    session_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Record leaving a live event.
    """
    client = get_client()

    client.table("live_event_viewer_sessions").update({
        "is_active": False,
        "left_at": datetime.utcnow().isoformat()
    }).eq("session_id", session_id).eq("event_id", event_id).execute()

    return {"status": "left"}
