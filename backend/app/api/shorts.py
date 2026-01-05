"""
Shorts API - TikTok-style Vertical Video Feed
Part of: Consumer Streaming Platform
"""
from datetime import datetime
from typing import Optional, List
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
# Schemas
# =============================================================================

class ShortCreator(BaseModel):
    """Creator info for a short"""
    id: str
    display_name: str
    avatar_url: Optional[str] = None
    is_verified: bool = False

    class Config:
        from_attributes = True


class ShortWorld(BaseModel):
    """World info for a short"""
    id: str
    title: str
    slug: str
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class Short(BaseModel):
    """A single short video"""
    id: str
    world_id: str
    title: str
    description: Optional[str] = None
    video_asset_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    aspect_ratio: str = "9:16"

    # Playback
    playback_url: Optional[str] = None

    # Metrics
    view_count: int = 0
    like_count: int = 0
    share_count: int = 0
    bookmark_count: int = 0

    # User interaction state
    is_liked: Optional[bool] = None
    is_bookmarked: Optional[bool] = None

    # Timestamps
    published_at: Optional[datetime] = None
    created_at: datetime

    # Related entities
    creator: Optional[ShortCreator] = None
    world: Optional[ShortWorld] = None

    class Config:
        from_attributes = True


class ShortsFeedResponse(BaseModel):
    """Paginated shorts feed"""
    shorts: List[Short]
    next_cursor: Optional[str] = None
    has_more: bool = False


class ShortCreateRequest(BaseModel):
    """Request to create a new short"""
    world_id: str
    title: str
    description: Optional[str] = None
    video_asset_id: str
    thumbnail_url: Optional[str] = None


class ShortUpdateRequest(BaseModel):
    """Request to update a short"""
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None


# =============================================================================
# Feed Endpoints
# =============================================================================

@router.get("/feed", response_model=ShortsFeedResponse)
async def get_shorts_feed(
    cursor: Optional[str] = None,
    limit: int = Query(default=10, le=50),
    world_id: Optional[str] = None,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get the main shorts feed (TikTok-style infinite scroll).
    Returns shorts ordered by algorithm (recency, engagement, follows).
    """
    profile_id = None
    if current_user:
        profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    client = get_client()

    # Build base query
    query = client.table("world_content").select(
        "id, world_id, title, description, video_asset_id, thumbnail_url, "
        "duration_seconds, aspect_ratio, view_count, like_count, share_count, "
        "bookmark_count, published_at, created_at, created_by, "
        "worlds!inner(id, title, slug, thumbnail_url), "
        "profiles!world_content_created_by_fkey(id, display_name, avatar_url, is_verified)"
    ).eq("content_type", "short").eq("status", "published").eq(
        "visibility", "public"
    )

    if world_id:
        query = query.eq("world_id", world_id)

    # Handle cursor-based pagination
    if cursor:
        # Cursor is the published_at timestamp of the last item
        query = query.lt("published_at", cursor)

    query = query.order("published_at", desc=True).limit(limit + 1)
    result = query.execute()

    shorts_data = result.data or []
    has_more = len(shorts_data) > limit
    if has_more:
        shorts_data = shorts_data[:limit]

    next_cursor = None
    if has_more and shorts_data:
        next_cursor = shorts_data[-1]["published_at"]

    # Get user interaction state if logged in
    liked_ids = set()
    bookmarked_ids = set()
    if profile_id and shorts_data:
        short_ids = [s["id"] for s in shorts_data]

        likes = client.table("world_content_likes").select("content_id").eq(
            "user_id", profile_id
        ).in_("content_id", short_ids).execute()
        liked_ids = {l["content_id"] for l in (likes.data or [])}

        bookmarks = client.table("world_content_bookmarks").select("content_id").eq(
            "user_id", profile_id
        ).in_("content_id", short_ids).execute()
        bookmarked_ids = {b["content_id"] for b in (bookmarks.data or [])}

    # Build response
    shorts = []
    for s in shorts_data:
        creator_data = s.get("profiles")
        world_data = s.get("worlds")

        shorts.append(Short(
            id=s["id"],
            world_id=s["world_id"],
            title=s["title"],
            description=s.get("description"),
            video_asset_id=s.get("video_asset_id"),
            thumbnail_url=s.get("thumbnail_url"),
            duration_seconds=s.get("duration_seconds"),
            aspect_ratio=s.get("aspect_ratio") or "9:16",
            view_count=s.get("view_count") or 0,
            like_count=s.get("like_count") or 0,
            share_count=s.get("share_count") or 0,
            bookmark_count=s.get("bookmark_count") or 0,
            is_liked=s["id"] in liked_ids if profile_id else None,
            is_bookmarked=s["id"] in bookmarked_ids if profile_id else None,
            published_at=s.get("published_at"),
            created_at=s["created_at"],
            creator=ShortCreator(**creator_data) if creator_data else None,
            world=ShortWorld(**world_data) if world_data else None
        ))

    return ShortsFeedResponse(
        shorts=shorts,
        next_cursor=next_cursor,
        has_more=has_more
    )


@router.get("/following", response_model=ShortsFeedResponse)
async def get_following_shorts_feed(
    cursor: Optional[str] = None,
    limit: int = Query(default=10, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get shorts only from worlds the user follows.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get followed world IDs
    follows = client.table("world_follows").select("world_id").eq(
        "user_id", profile_id
    ).execute()

    followed_world_ids = [f["world_id"] for f in (follows.data or [])]

    if not followed_world_ids:
        return ShortsFeedResponse(shorts=[], has_more=False)

    # Query shorts from followed worlds
    query = client.table("world_content").select(
        "id, world_id, title, description, video_asset_id, thumbnail_url, "
        "duration_seconds, aspect_ratio, view_count, like_count, share_count, "
        "bookmark_count, published_at, created_at, created_by, "
        "worlds!inner(id, title, slug, thumbnail_url), "
        "profiles!world_content_created_by_fkey(id, display_name, avatar_url, is_verified)"
    ).eq("content_type", "short").eq("status", "published").in_(
        "world_id", followed_world_ids
    )

    if cursor:
        query = query.lt("published_at", cursor)

    query = query.order("published_at", desc=True).limit(limit + 1)
    result = query.execute()

    shorts_data = result.data or []
    has_more = len(shorts_data) > limit
    if has_more:
        shorts_data = shorts_data[:limit]

    next_cursor = shorts_data[-1]["published_at"] if has_more and shorts_data else None

    # Get interaction state
    short_ids = [s["id"] for s in shorts_data]
    liked_ids = set()
    bookmarked_ids = set()

    if short_ids:
        likes = client.table("world_content_likes").select("content_id").eq(
            "user_id", profile_id
        ).in_("content_id", short_ids).execute()
        liked_ids = {l["content_id"] for l in (likes.data or [])}

        bookmarks = client.table("world_content_bookmarks").select("content_id").eq(
            "user_id", profile_id
        ).in_("content_id", short_ids).execute()
        bookmarked_ids = {b["content_id"] for b in (bookmarks.data or [])}

    shorts = []
    for s in shorts_data:
        creator_data = s.get("profiles")
        world_data = s.get("worlds")

        shorts.append(Short(
            id=s["id"],
            world_id=s["world_id"],
            title=s["title"],
            description=s.get("description"),
            video_asset_id=s.get("video_asset_id"),
            thumbnail_url=s.get("thumbnail_url"),
            duration_seconds=s.get("duration_seconds"),
            aspect_ratio=s.get("aspect_ratio") or "9:16",
            view_count=s.get("view_count") or 0,
            like_count=s.get("like_count") or 0,
            share_count=s.get("share_count") or 0,
            bookmark_count=s.get("bookmark_count") or 0,
            is_liked=s["id"] in liked_ids,
            is_bookmarked=s["id"] in bookmarked_ids,
            published_at=s.get("published_at"),
            created_at=s["created_at"],
            creator=ShortCreator(**creator_data) if creator_data else None,
            world=ShortWorld(**world_data) if world_data else None
        ))

    return ShortsFeedResponse(
        shorts=shorts,
        next_cursor=next_cursor,
        has_more=has_more
    )


@router.get("/trending", response_model=ShortsFeedResponse)
async def get_trending_shorts(
    limit: int = Query(default=20, le=50),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get trending shorts (highest engagement in recent period).
    """
    profile_id = None
    if current_user and current_user.get("sub"):
        profile_id = await get_profile_id_from_cognito_id(current_user.get("sub"))

    # Use raw SQL for trending algorithm
    # Score = views + (likes * 3) + (shares * 5) with recency boost
    query = """
        SELECT
            wc.id, wc.world_id, wc.title, wc.description, wc.video_asset_id,
            wc.thumbnail_url, wc.duration_seconds, wc.aspect_ratio,
            wc.view_count, wc.like_count, wc.share_count, wc.bookmark_count,
            wc.published_at, wc.created_at, wc.created_by,
            w.id as world_db_id, w.title as world_title, w.slug as world_slug, w.thumbnail_url as world_thumbnail,
            p.id as creator_id, p.display_name, p.avatar_url,
            COALESCE(p.is_staff, false) as is_verified,
            (wc.view_count + (wc.like_count * 3) + (wc.share_count * 5)) *
            (1.0 / (EXTRACT(EPOCH FROM (NOW() - wc.published_at)) / 86400 + 1)) as score
        FROM world_content wc
        JOIN worlds w ON wc.world_id = w.id
        LEFT JOIN profiles p ON wc.created_by = p.id
        WHERE wc.content_type = 'short'
        AND wc.status = 'published'
        AND wc.visibility = 'public'
        AND wc.published_at > NOW() - INTERVAL '7 days'
        ORDER BY score DESC
        LIMIT :limit
    """

    results = execute_query(query, {"limit": limit})

    # Get interaction state
    short_ids = [r["id"] for r in results]
    liked_ids = set()
    bookmarked_ids = set()

    if profile_id and short_ids:
        client = get_client()
        likes = client.table("world_content_likes").select("content_id").eq(
            "user_id", profile_id
        ).in_("content_id", short_ids).execute()
        liked_ids = {l["content_id"] for l in (likes.data or [])}

        bookmarks = client.table("world_content_bookmarks").select("content_id").eq(
            "user_id", profile_id
        ).in_("content_id", short_ids).execute()
        bookmarked_ids = {b["content_id"] for b in (bookmarks.data or [])}

    shorts = []
    for r in results:
        shorts.append(Short(
            id=r["id"],
            world_id=r["world_id"],
            title=r["title"],
            description=r.get("description"),
            video_asset_id=r.get("video_asset_id"),
            thumbnail_url=r.get("thumbnail_url"),
            duration_seconds=r.get("duration_seconds"),
            aspect_ratio=r.get("aspect_ratio") or "9:16",
            view_count=r.get("view_count") or 0,
            like_count=r.get("like_count") or 0,
            share_count=r.get("share_count") or 0,
            bookmark_count=r.get("bookmark_count") or 0,
            is_liked=r["id"] in liked_ids if profile_id else None,
            is_bookmarked=r["id"] in bookmarked_ids if profile_id else None,
            published_at=r.get("published_at"),
            created_at=r["created_at"],
            creator=ShortCreator(
                id=r["creator_id"],
                display_name=r["display_name"],
                avatar_url=r.get("avatar_url"),
                is_verified=r.get("is_verified") or False
            ),
            world=ShortWorld(
                id=r["world_db_id"],
                title=r["world_title"],
                slug=r["world_slug"],
                thumbnail_url=r.get("world_thumbnail")
            )
        ))

    return ShortsFeedResponse(shorts=shorts, has_more=False)


# =============================================================================
# Single Short Endpoints
# =============================================================================

@router.get("/{short_id}", response_model=Short)
async def get_short(
    short_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get a single short by ID.
    """
    profile_id = None
    if current_user:
        profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    client = get_client()

    result = client.table("world_content").select(
        "id, world_id, title, description, video_asset_id, thumbnail_url, "
        "duration_seconds, aspect_ratio, view_count, like_count, share_count, "
        "bookmark_count, published_at, created_at, created_by, "
        "worlds!inner(id, title, slug, thumbnail_url), "
        "profiles!world_content_created_by_fkey(id, display_name, avatar_url, is_verified)"
    ).eq("id", short_id).eq("content_type", "short").single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Short not found")

    s = result.data

    # Check visibility
    if s.get("status") != "published" or s.get("visibility") == "private":
        # Only creator can see unpublished/private shorts
        if not profile_id or s.get("created_by") != profile_id:
            raise HTTPException(status_code=404, detail="Short not found")

    # Get interaction state
    is_liked = None
    is_bookmarked = None
    if profile_id:
        like = client.table("world_content_likes").select("id").eq(
            "content_id", short_id
        ).eq("user_id", profile_id).limit(1).execute()
        is_liked = bool(like.data)

        bookmark = client.table("world_content_bookmarks").select("id").eq(
            "content_id", short_id
        ).eq("user_id", profile_id).limit(1).execute()
        is_bookmarked = bool(bookmark.data)

    creator_data = s.get("profiles")
    world_data = s.get("worlds")

    return Short(
        id=s["id"],
        world_id=s["world_id"],
        title=s["title"],
        description=s.get("description"),
        video_asset_id=s.get("video_asset_id"),
        thumbnail_url=s.get("thumbnail_url"),
        duration_seconds=s.get("duration_seconds"),
        aspect_ratio=s.get("aspect_ratio") or "9:16",
        view_count=s.get("view_count") or 0,
        like_count=s.get("like_count") or 0,
        share_count=s.get("share_count") or 0,
        bookmark_count=s.get("bookmark_count") or 0,
        is_liked=is_liked,
        is_bookmarked=is_bookmarked,
        published_at=s.get("published_at"),
        created_at=s["created_at"],
        creator=ShortCreator(**creator_data) if creator_data else None,
        world=ShortWorld(**world_data) if world_data else None
    )


# =============================================================================
# Interaction Endpoints
# =============================================================================

@router.post("/{short_id}/like")
async def like_short(
    short_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Like a short.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify short exists
    short = client.table("world_content").select("id").eq(
        "id", short_id
    ).eq("content_type", "short").single().execute()

    if not short.data:
        raise HTTPException(status_code=404, detail="Short not found")

    # Add like (upsert)
    try:
        client.table("world_content_likes").upsert({
            "content_id": short_id,
            "user_id": profile_id
        }, on_conflict="content_id,user_id").execute()
    except Exception:
        pass  # Already liked

    return {"status": "liked", "short_id": short_id}


@router.delete("/{short_id}/like")
async def unlike_short(
    short_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Unlike a short.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()
    client.table("world_content_likes").delete().eq(
        "content_id", short_id
    ).eq("user_id", profile_id).execute()

    return {"status": "unliked", "short_id": short_id}


@router.post("/{short_id}/bookmark")
async def bookmark_short(
    short_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Bookmark a short.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Verify short exists
    short = client.table("world_content").select("id").eq(
        "id", short_id
    ).eq("content_type", "short").single().execute()

    if not short.data:
        raise HTTPException(status_code=404, detail="Short not found")

    # Add bookmark (upsert)
    try:
        client.table("world_content_bookmarks").upsert({
            "content_id": short_id,
            "user_id": profile_id
        }, on_conflict="content_id,user_id").execute()
    except Exception:
        pass  # Already bookmarked

    return {"status": "bookmarked", "short_id": short_id}


@router.delete("/{short_id}/bookmark")
async def unbookmark_short(
    short_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove bookmark from a short.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()
    client.table("world_content_bookmarks").delete().eq(
        "content_id", short_id
    ).eq("user_id", profile_id).execute()

    return {"status": "unbookmarked", "short_id": short_id}


@router.post("/{short_id}/view")
async def record_view(
    short_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Record a view of a short.
    Called when user watches the short for a threshold duration.
    """
    # Increment view count
    execute_single(
        "UPDATE world_content SET view_count = view_count + 1 WHERE id = :id",
        {"id": short_id}
    )

    return {"status": "recorded"}


@router.post("/{short_id}/share")
async def record_share(
    short_id: str,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Record a share of a short.
    """
    execute_single(
        "UPDATE world_content SET share_count = share_count + 1 WHERE id = :id",
        {"id": short_id}
    )

    return {"status": "recorded"}


# =============================================================================
# User Content Endpoints
# =============================================================================

@router.get("/my/bookmarks", response_model=ShortsFeedResponse)
async def get_my_bookmarked_shorts(
    cursor: Optional[str] = None,
    limit: int = Query(default=20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get shorts the current user has bookmarked.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get bookmarked content IDs with pagination
    query = client.table("world_content_bookmarks").select(
        "content_id, created_at"
    ).eq("user_id", profile_id)

    if cursor:
        query = query.lt("created_at", cursor)

    query = query.order("created_at", desc=True).limit(limit + 1)
    bookmarks = query.execute()

    bookmark_data = bookmarks.data or []
    has_more = len(bookmark_data) > limit
    if has_more:
        bookmark_data = bookmark_data[:limit]

    next_cursor = bookmark_data[-1]["created_at"] if has_more and bookmark_data else None

    if not bookmark_data:
        return ShortsFeedResponse(shorts=[], has_more=False)

    # Get the actual shorts
    content_ids = [b["content_id"] for b in bookmark_data]

    shorts_result = client.table("world_content").select(
        "id, world_id, title, description, video_asset_id, thumbnail_url, "
        "duration_seconds, aspect_ratio, view_count, like_count, share_count, "
        "bookmark_count, published_at, created_at, created_by, "
        "worlds!inner(id, title, slug, thumbnail_url), "
        "profiles!world_content_created_by_fkey(id, display_name, avatar_url, is_verified)"
    ).in_("id", content_ids).eq("content_type", "short").execute()

    # Get liked status
    likes = client.table("world_content_likes").select("content_id").eq(
        "user_id", profile_id
    ).in_("content_id", content_ids).execute()
    liked_ids = {l["content_id"] for l in (likes.data or [])}

    # Build response maintaining bookmark order
    shorts_map = {s["id"]: s for s in (shorts_result.data or [])}
    shorts = []

    for b in bookmark_data:
        s = shorts_map.get(b["content_id"])
        if not s:
            continue

        creator_data = s.get("profiles")
        world_data = s.get("worlds")

        shorts.append(Short(
            id=s["id"],
            world_id=s["world_id"],
            title=s["title"],
            description=s.get("description"),
            video_asset_id=s.get("video_asset_id"),
            thumbnail_url=s.get("thumbnail_url"),
            duration_seconds=s.get("duration_seconds"),
            aspect_ratio=s.get("aspect_ratio") or "9:16",
            view_count=s.get("view_count") or 0,
            like_count=s.get("like_count") or 0,
            share_count=s.get("share_count") or 0,
            bookmark_count=s.get("bookmark_count") or 0,
            is_liked=s["id"] in liked_ids,
            is_bookmarked=True,
            published_at=s.get("published_at"),
            created_at=s["created_at"],
            creator=ShortCreator(**creator_data) if creator_data else None,
            world=ShortWorld(**world_data) if world_data else None
        ))

    return ShortsFeedResponse(
        shorts=shorts,
        next_cursor=next_cursor,
        has_more=has_more
    )


@router.get("/my/liked", response_model=ShortsFeedResponse)
async def get_my_liked_shorts(
    cursor: Optional[str] = None,
    limit: int = Query(default=20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get shorts the current user has liked.
    """
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    client = get_client()

    # Get liked content IDs with pagination
    query = client.table("world_content_likes").select(
        "content_id, created_at"
    ).eq("user_id", profile_id)

    if cursor:
        query = query.lt("created_at", cursor)

    query = query.order("created_at", desc=True).limit(limit + 1)
    likes = query.execute()

    likes_data = likes.data or []
    has_more = len(likes_data) > limit
    if has_more:
        likes_data = likes_data[:limit]

    next_cursor = likes_data[-1]["created_at"] if has_more and likes_data else None

    if not likes_data:
        return ShortsFeedResponse(shorts=[], has_more=False)

    # Get the actual shorts
    content_ids = [l["content_id"] for l in likes_data]

    shorts_result = client.table("world_content").select(
        "id, world_id, title, description, video_asset_id, thumbnail_url, "
        "duration_seconds, aspect_ratio, view_count, like_count, share_count, "
        "bookmark_count, published_at, created_at, created_by, "
        "worlds!inner(id, title, slug, thumbnail_url), "
        "profiles!world_content_created_by_fkey(id, display_name, avatar_url, is_verified)"
    ).in_("id", content_ids).eq("content_type", "short").execute()

    # Get bookmark status
    bookmarks = client.table("world_content_bookmarks").select("content_id").eq(
        "user_id", profile_id
    ).in_("content_id", content_ids).execute()
    bookmarked_ids = {b["content_id"] for b in (bookmarks.data or [])}

    # Build response maintaining like order
    shorts_map = {s["id"]: s for s in (shorts_result.data or [])}
    shorts = []

    for l in likes_data:
        s = shorts_map.get(l["content_id"])
        if not s:
            continue

        creator_data = s.get("profiles")
        world_data = s.get("worlds")

        shorts.append(Short(
            id=s["id"],
            world_id=s["world_id"],
            title=s["title"],
            description=s.get("description"),
            video_asset_id=s.get("video_asset_id"),
            thumbnail_url=s.get("thumbnail_url"),
            duration_seconds=s.get("duration_seconds"),
            aspect_ratio=s.get("aspect_ratio") or "9:16",
            view_count=s.get("view_count") or 0,
            like_count=s.get("like_count") or 0,
            share_count=s.get("share_count") or 0,
            bookmark_count=s.get("bookmark_count") or 0,
            is_liked=True,
            is_bookmarked=s["id"] in bookmarked_ids,
            published_at=s.get("published_at"),
            created_at=s["created_at"],
            creator=ShortCreator(**creator_data) if creator_data else None,
            world=ShortWorld(**world_data) if world_data else None
        ))

    return ShortsFeedResponse(
        shorts=shorts,
        next_cursor=next_cursor,
        has_more=has_more
    )
