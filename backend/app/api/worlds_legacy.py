"""
Worlds API Routes - Consumer Streaming Platform

Endpoints for managing Worlds, Seasons, Episodes, Follows, and Watchlist.
Separate from Backlot (production), Community (social), and Green Room (voting).
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from app.core.database import get_client
from app.core.auth import get_current_user, get_current_user_optional
from app.schemas.worlds import (
    World, WorldCreate, WorldUpdate, WorldSummary, WorldSearchParams,
    Season, SeasonCreate, SeasonUpdate,
    Episode, EpisodeCreate, EpisodeUpdate,
    WorldFollow, WorldFollowCreate, WorldFollowUpdate,
    WorldWatchlistItem, WatchProgressUpdate, WatchHistoryItem,
    Genre
)

router = APIRouter()


# =============================================================================
# GENRES
# =============================================================================

@router.get("/genres", response_model=List[Genre])
async def list_genres(category: Optional[str] = None):
    """List all active genres"""
    try:
        client = get_client()
        query = client.table("genre_tags").select("*").eq("is_active", True)

        if category:
            query = query.eq("category", category)

        response = query.order("sort_order").execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# WORLDS - Public Discovery
# =============================================================================

@router.get("/")
async def list_worlds(
    query: Optional[str] = None,
    genre_slug: Optional[str] = None,
    content_format: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """List public worlds with optional filtering"""
    try:
        client = get_client()

        # Base query for public worlds
        db_query = client.table("worlds").select(
            "id, title, slug, logline, thumbnail_url, cover_art_url, content_format, "
            "maturity_rating, follower_count, episode_count, status, premiere_date, is_featured"
        ).eq("visibility", "public")

        # Apply filters
        if status:
            db_query = db_query.eq("status", status)
        else:
            db_query = db_query.in_("status", ["active", "complete", "coming_soon"])

        if content_format:
            db_query = db_query.eq("content_format", content_format)

        if query:
            db_query = db_query.or_(f"title.ilike.%{query}%,logline.ilike.%{query}%")

        # Execute main query
        response = db_query.order("follower_count", desc=True).range(offset, offset + limit - 1).execute()
        worlds = response.data or []

        # Filter by genre if specified (requires join)
        if genre_slug and worlds:
            world_ids = [w["id"] for w in worlds]
            genre_response = client.table("world_genres").select(
                "world_id, genre_tags!inner(slug)"
            ).in_("world_id", world_ids).eq("genre_tags.slug", genre_slug).execute()

            matching_world_ids = {g["world_id"] for g in (genre_response.data or [])}
            worlds = [w for w in worlds if w["id"] in matching_world_ids]

        # Return in expected format with pagination info
        return {
            "worlds": worlds,
            "total": len(worlds),
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{world_slug}", response_model=World)
async def get_world(
    world_slug: str,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get world by slug with full details"""
    try:
        client = get_client()
        user_id = user.get("id") if user else None

        # Get world
        response = client.table("worlds").select("*").eq("slug", world_slug).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="World not found")

        world = response.data[0]

        # Check visibility
        if world["visibility"] != "public" and world["creator_id"] != user_id:
            raise HTTPException(status_code=404, detail="World not found")

        # Get genres
        genres_response = client.table("world_genres").select(
            "is_primary, genre_tags(id, name, slug, category)"
        ).eq("world_id", world["id"]).execute()

        world["genres"] = [
            {**g["genre_tags"], "is_primary": g["is_primary"]}
            for g in (genres_response.data or [])
        ]

        # Get creator info
        creator_response = client.table("profiles").select(
            "id, username, full_name, avatar_url"
        ).eq("id", world["creator_id"]).execute()

        if creator_response.data:
            world["creator"] = creator_response.data[0]

        # Check if user is following/has in watchlist
        if user_id:
            follow_response = client.table("world_follows").select("id").eq(
                "world_id", world["id"]
            ).eq("user_id", user_id).execute()
            world["is_following"] = bool(follow_response.data)

            watchlist_response = client.table("world_watchlist").select("id").eq(
                "world_id", world["id"]
            ).eq("user_id", user_id).execute()
            world["is_in_watchlist"] = bool(watchlist_response.data)

        return world
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# WORLDS - Creator Management
# =============================================================================

@router.post("/", response_model=World)
async def create_world(world: WorldCreate, user=Depends(get_current_user)):
    """Create a new world (creator only)"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Prepare world data
        data = world.model_dump(exclude={"genre_ids"})
        data["creator_id"] = user_id
        data["status"] = "draft"
        data["visibility"] = "private"

        # Insert world
        response = client.table("worlds").insert(data).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create world")

        new_world = response.data[0]

        # Add genres if provided
        if world.genre_ids:
            genre_links = [
                {"world_id": new_world["id"], "genre_id": gid, "is_primary": i == 0}
                for i, gid in enumerate(world.genre_ids)
            ]
            client.table("world_genres").insert(genre_links).execute()

        return new_world
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my/worlds", response_model=List[World])
async def get_my_worlds(user=Depends(get_current_user)):
    """Get current user's worlds"""
    try:
        client = get_client()
        user_id = user.get("id")

        response = client.table("worlds").select("*").eq(
            "creator_id", user_id
        ).order("created_at", desc=True).execute()

        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{world_id}", response_model=World)
async def update_world(world_id: str, world: WorldUpdate, user=Depends(get_current_user)):
    """Update a world (creator only)"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Check ownership
        existing = client.table("worlds").select("creator_id").eq("id", world_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="World not found")
        if existing.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized to update this world")

        # Update world
        update_data = world.model_dump(exclude_unset=True, exclude={"genre_ids"})
        if update_data:
            response = client.table("worlds").update(update_data).eq("id", world_id).execute()
            if not response.data:
                raise HTTPException(status_code=400, detail="Failed to update world")

        # Update genres if provided
        if world.genre_ids is not None:
            # Remove existing genres
            client.table("world_genres").delete().eq("world_id", world_id).execute()
            # Add new genres
            if world.genre_ids:
                genre_links = [
                    {"world_id": world_id, "genre_id": gid, "is_primary": i == 0}
                    for i, gid in enumerate(world.genre_ids)
                ]
                client.table("world_genres").insert(genre_links).execute()

        # Return updated world
        return await get_world(existing.data[0].get("slug", world_id), user)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{world_id}")
async def delete_world(world_id: str, user=Depends(get_current_user)):
    """Delete a world (creator only, draft worlds only)"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Check ownership and status
        existing = client.table("worlds").select("creator_id, status").eq("id", world_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="World not found")
        if existing.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized to delete this world")
        if existing.data[0]["status"] not in ["draft", "archived"]:
            raise HTTPException(status_code=400, detail="Can only delete draft or archived worlds")

        client.table("worlds").delete().eq("id", world_id).execute()
        return {"message": "World deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# SEASONS
# =============================================================================

@router.get("/{world_id}/seasons", response_model=List[Season])
async def list_seasons(world_id: str, user: Optional[dict] = Depends(get_current_user_optional)):
    """List seasons for a world"""
    try:
        client = get_client()

        response = client.table("seasons").select("*").eq(
            "world_id", world_id
        ).order("season_number").execute()

        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{world_id}/seasons", response_model=Season)
async def create_season(world_id: str, season: SeasonCreate, user=Depends(get_current_user)):
    """Create a new season"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Verify ownership
        world = client.table("worlds").select("creator_id").eq("id", world_id).execute()
        if not world.data:
            raise HTTPException(status_code=404, detail="World not found")
        if world.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized")

        data = season.model_dump()
        data["world_id"] = world_id

        response = client.table("seasons").insert(data).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/seasons/{season_id}", response_model=Season)
async def update_season(season_id: str, season: SeasonUpdate, user=Depends(get_current_user)):
    """Update a season"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Get season and verify ownership
        existing = client.table("seasons").select("world_id").eq("id", season_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Season not found")

        world = client.table("worlds").select("creator_id").eq("id", existing.data[0]["world_id"]).execute()
        if world.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized")

        update_data = season.model_dump(exclude_unset=True)
        response = client.table("seasons").update(update_data).eq("id", season_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/seasons/{season_id}")
async def delete_season(season_id: str, user=Depends(get_current_user)):
    """Delete a season (only if no episodes)"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Get season and verify ownership
        existing = client.table("seasons").select("world_id, episode_count").eq("id", season_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Season not found")

        if existing.data[0].get("episode_count", 0) > 0:
            raise HTTPException(status_code=400, detail="Cannot delete season with episodes")

        world = client.table("worlds").select("creator_id").eq("id", existing.data[0]["world_id"]).execute()
        if world.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized")

        client.table("seasons").delete().eq("id", season_id).execute()
        return {"message": "Season deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# EPISODES
# =============================================================================

@router.get("/seasons/{season_id}/episodes", response_model=List[Episode])
async def list_episodes(
    season_id: str,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """List episodes for a season"""
    try:
        client = get_client()
        user_id = user.get("id") if user else None

        response = client.table("episodes").select("*").eq(
            "season_id", season_id
        ).order("episode_number").execute()

        episodes = response.data or []

        # Add watch progress if user is authenticated
        if user_id and episodes:
            episode_ids = [e["id"] for e in episodes]
            progress_response = client.table("watch_history").select(
                "episode_id, position_seconds, completed"
            ).eq("user_id", user_id).in_("episode_id", episode_ids).execute()

            progress_map = {p["episode_id"]: p for p in (progress_response.data or [])}
            for ep in episodes:
                if ep["id"] in progress_map:
                    ep["watch_progress"] = {
                        "position": progress_map[ep["id"]]["position_seconds"],
                        "completed": progress_map[ep["id"]]["completed"]
                    }

        return episodes
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/episodes/{episode_id}", response_model=Episode)
async def get_episode(
    episode_id: str,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get episode by ID"""
    try:
        client = get_client()
        user_id = user.get("id") if user else None

        response = client.table("episodes").select("*").eq("id", episode_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Episode not found")

        episode = response.data[0]

        # Add watch progress
        if user_id:
            progress = client.table("watch_history").select(
                "position_seconds, completed"
            ).eq("user_id", user_id).eq("episode_id", episode_id).execute()

            if progress.data:
                episode["watch_progress"] = {
                    "position": progress.data[0]["position_seconds"],
                    "completed": progress.data[0]["completed"]
                }

        return episode
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/seasons/{season_id}/episodes", response_model=Episode)
async def create_episode(season_id: str, episode: EpisodeCreate, user=Depends(get_current_user)):
    """Create a new episode"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Get season and verify ownership
        season = client.table("seasons").select("world_id").eq("id", season_id).execute()
        if not season.data:
            raise HTTPException(status_code=404, detail="Season not found")

        world = client.table("worlds").select("creator_id").eq("id", season.data[0]["world_id"]).execute()
        if world.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized")

        data = episode.model_dump()
        data["season_id"] = season_id
        data["world_id"] = season.data[0]["world_id"]
        data["created_by"] = user_id

        response = client.table("episodes").insert(data).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/episodes/{episode_id}", response_model=Episode)
async def update_episode(episode_id: str, episode: EpisodeUpdate, user=Depends(get_current_user)):
    """Update an episode"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Get episode and verify ownership
        existing = client.table("episodes").select("world_id").eq("id", episode_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Episode not found")

        world = client.table("worlds").select("creator_id").eq("id", existing.data[0]["world_id"]).execute()
        if world.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized")

        update_data = episode.model_dump(exclude_unset=True)
        response = client.table("episodes").update(update_data).eq("id", episode_id).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/episodes/{episode_id}")
async def delete_episode(episode_id: str, user=Depends(get_current_user)):
    """Delete an episode (draft only)"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Get episode and verify ownership
        existing = client.table("episodes").select("world_id, status").eq("id", episode_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Episode not found")

        if existing.data[0]["status"] not in ["draft", "archived"]:
            raise HTTPException(status_code=400, detail="Can only delete draft or archived episodes")

        world = client.table("worlds").select("creator_id").eq("id", existing.data[0]["world_id"]).execute()
        if world.data[0]["creator_id"] != user_id and not user.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not authorized")

        client.table("episodes").delete().eq("id", episode_id).execute()
        return {"message": "Episode deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# FOLLOWS
# =============================================================================

@router.post("/{world_id}/follow", response_model=WorldFollow)
async def follow_world(world_id: str, user=Depends(get_current_user)):
    """Follow a world"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Check if already following
        existing = client.table("world_follows").select("id").eq(
            "world_id", world_id
        ).eq("user_id", user_id).execute()

        if existing.data:
            raise HTTPException(status_code=400, detail="Already following this world")

        response = client.table("world_follows").insert({
            "world_id": world_id,
            "user_id": user_id
        }).execute()

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{world_id}/follow")
async def unfollow_world(world_id: str, user=Depends(get_current_user)):
    """Unfollow a world"""
    try:
        client = get_client()
        user_id = user.get("id")

        client.table("world_follows").delete().eq(
            "world_id", world_id
        ).eq("user_id", user_id).execute()

        return {"message": "Unfollowed successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{world_id}/follow", response_model=WorldFollow)
async def update_follow_preferences(
    world_id: str,
    prefs: WorldFollowUpdate,
    user=Depends(get_current_user)
):
    """Update follow notification preferences"""
    try:
        client = get_client()
        user_id = user.get("id")

        update_data = prefs.model_dump(exclude_unset=True)
        response = client.table("world_follows").update(update_data).eq(
            "world_id", world_id
        ).eq("user_id", user_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Not following this world")

        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my/following", response_model=List[WorldSummary])
async def get_following(user=Depends(get_current_user)):
    """Get worlds the current user is following"""
    try:
        client = get_client()
        user_id = user.get("id")

        response = client.table("world_follows").select(
            "followed_at, worlds(id, title, slug, thumbnail_url, content_format, follower_count, episode_count)"
        ).eq("user_id", user_id).order("followed_at", desc=True).execute()

        return [f["worlds"] for f in (response.data or []) if f.get("worlds")]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# WATCHLIST
# =============================================================================

@router.post("/{world_id}/watchlist")
async def add_to_watchlist(world_id: str, user=Depends(get_current_user)):
    """Add a world to watchlist"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Check if already in watchlist
        existing = client.table("world_watchlist").select("id").eq(
            "world_id", world_id
        ).eq("user_id", user_id).execute()

        if existing.data:
            raise HTTPException(status_code=400, detail="Already in watchlist")

        response = client.table("world_watchlist").insert({
            "world_id": world_id,
            "user_id": user_id
        }).execute()

        return {"message": "Added to watchlist", "id": response.data[0]["id"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{world_id}/watchlist")
async def remove_from_watchlist(world_id: str, user=Depends(get_current_user)):
    """Remove a world from watchlist"""
    try:
        client = get_client()
        user_id = user.get("id")

        client.table("world_watchlist").delete().eq(
            "world_id", world_id
        ).eq("user_id", user_id).execute()

        return {"message": "Removed from watchlist"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my/watchlist", response_model=List[WorldSummary])
async def get_watchlist(
    limit: int = Query(default=20, le=100),
    offset: int = 0,
    user=Depends(get_current_user)
):
    """Get current user's watchlist"""
    from app.core.database import execute_query
    try:
        user_id = user.get("id")

        query = """
            SELECT w.id, w.title, w.slug, w.thumbnail_url, w.content_format,
                   w.follower_count, w.episode_count, w.status, w.is_featured
            FROM world_watchlist ww
            JOIN worlds w ON w.id = ww.world_id
            WHERE ww.user_id = :user_id
            ORDER BY ww.added_at DESC
            LIMIT :limit OFFSET :offset
        """
        results = execute_query(query, {"user_id": user_id, "limit": limit, "offset": offset})
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# WATCH HISTORY
# =============================================================================

@router.post("/episodes/{episode_id}/progress")
async def update_watch_progress(
    episode_id: str,
    progress: WatchProgressUpdate,
    user=Depends(get_current_user)
):
    """Update watch progress for an episode"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Get episode to find world_id
        episode = client.table("episodes").select("world_id, duration_seconds").eq("id", episode_id).execute()
        if not episode.data:
            raise HTTPException(status_code=404, detail="Episode not found")

        world_id = episode.data[0]["world_id"]
        duration = progress.duration_seconds or episode.data[0].get("duration_seconds")

        # Check if completed (>90% watched)
        completed = False
        if duration and progress.position_seconds >= duration * 0.9:
            completed = True

        # Upsert watch history
        data = {
            "user_id": user_id,
            "episode_id": episode_id,
            "world_id": world_id,
            "position_seconds": progress.position_seconds,
            "duration_seconds": duration,
            "completed": completed,
            "device_type": progress.device_type,
            "last_watched_at": "now()"
        }

        if completed:
            data["completed_at"] = "now()"

        # Try update first
        response = client.table("watch_history").update(data).eq(
            "user_id", user_id
        ).eq("episode_id", episode_id).execute()

        if not response.data:
            # Insert if doesn't exist
            response = client.table("watch_history").insert(data).execute()

        return {"message": "Progress updated", "completed": completed}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my/history", response_model=List[WatchHistoryItem])
async def get_watch_history(
    limit: int = Query(default=20, le=100),
    user=Depends(get_current_user)
):
    """Get watch history"""
    from app.core.database import execute_query
    try:
        user_id = user.get("id")

        query = """
            SELECT
                wh.id, wh.user_id, wh.episode_id, wh.world_id,
                wh.position_seconds, wh.duration_seconds, wh.completed,
                wh.last_watched_at, wh.completed_at, wh.device_type,
                jsonb_build_object(
                    'id', e.id,
                    'title', e.title,
                    'episode_number', e.episode_number,
                    'thumbnail_url', e.thumbnail_url,
                    'duration_seconds', e.duration_seconds
                ) as episode,
                jsonb_build_object(
                    'id', w.id,
                    'title', w.title,
                    'slug', w.slug,
                    'thumbnail_url', w.thumbnail_url
                ) as world
            FROM watch_history wh
            LEFT JOIN episodes e ON e.id = wh.episode_id
            LEFT JOIN worlds w ON w.id = wh.world_id
            WHERE wh.user_id = :user_id
            ORDER BY wh.last_watched_at DESC
            LIMIT :limit
        """
        results = execute_query(query, {"user_id": user_id, "limit": limit})
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my/continue-watching", response_model=List[WatchHistoryItem])
async def get_continue_watching(
    limit: int = Query(default=10, le=50),
    user=Depends(get_current_user)
):
    """Get continue watching list (incomplete episodes)"""
    from app.core.database import execute_query
    try:
        user_id = user.get("id")

        query = """
            SELECT
                wh.id, wh.user_id, wh.episode_id, wh.world_id,
                wh.position_seconds, wh.duration_seconds, wh.completed,
                wh.last_watched_at, wh.completed_at, wh.device_type,
                jsonb_build_object(
                    'id', e.id,
                    'title', e.title,
                    'episode_number', e.episode_number,
                    'thumbnail_url', e.thumbnail_url,
                    'duration_seconds', e.duration_seconds,
                    'season_id', e.season_id,
                    'world_id', e.world_id,
                    'created_at', e.created_at
                ) as episode,
                jsonb_build_object(
                    'id', w.id,
                    'title', w.title,
                    'slug', w.slug,
                    'thumbnail_url', w.thumbnail_url,
                    'content_format', w.content_format
                ) as world
            FROM watch_history wh
            JOIN episodes e ON e.id = wh.episode_id
            JOIN worlds w ON w.id = wh.world_id
            WHERE wh.user_id = :user_id
              AND wh.completed = FALSE
              AND e.status = 'published'
            ORDER BY wh.last_watched_at DESC
            LIMIT :limit
        """
        results = execute_query(query, {"user_id": user_id, "limit": limit})
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
