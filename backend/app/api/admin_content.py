"""
Admin Content API Routes - Fast Channel, Playlists, Schedule Management
Note: Auth is handled by frontend admin routing. Backend auth can be added later.
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_client

router = APIRouter()


# === Schemas ===

class FastChannelContentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: str
    duration_seconds: int
    content_type: str  # film, short, episode, trailer, promo, interstitial
    genre: Optional[List[str]] = None
    rating: Optional[str] = None
    year: Optional[int] = None
    director: Optional[str] = None
    is_active: bool = True
    metadata: Optional[dict] = None


class FastChannelContentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    content_type: Optional[str] = None
    genre: Optional[List[str]] = None
    rating: Optional[str] = None
    year: Optional[int] = None
    director: Optional[str] = None
    is_active: Optional[bool] = None
    metadata: Optional[dict] = None


class ChannelCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None


class ChannelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    is_live: Optional[bool] = None
    stream_url: Optional[str] = None


class ScheduleItemCreate(BaseModel):
    content_id: str
    scheduled_start: datetime
    scheduled_end: datetime
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None


class PlaylistCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_featured: bool = False


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_featured: Optional[bool] = None
    sort_order: Optional[int] = None


class PlaylistItemAdd(BaseModel):
    content_id: str
    sort_order: int = 0


# === Fast Channel Content Endpoints ===

@router.get("/fast-channel")
async def list_fast_channel_content(
    skip: int = 0,
    limit: int = 50,
    content_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None
):
    """List all fast channel content with filters"""
    try:
        client = get_client()
        query = client.table("fast_channel_content").select("*", count="exact")

        if content_type:
            query = query.eq("content_type", content_type)
        if is_active is not None:
            query = query.eq("is_active", is_active)
        if search:
            query = query.or_(f"title.ilike.%{search}%,director.ilike.%{search}%")

        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        return {
            "content": response.data,
            "total": response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/fast-channel")
async def create_fast_channel_content(data: FastChannelContentCreate):
    """Create new fast channel content"""
    try:
        client = get_client()
        content_data = data.model_dump(exclude_none=True)
        response = client.table("fast_channel_content").insert(content_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/fast-channel/{content_id}")
async def get_fast_channel_content(content_id: str):
    """Get single fast channel content item"""
    try:
        client = get_client()
        response = client.table("fast_channel_content").select("*").eq("id", content_id).single().execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/fast-channel/{content_id}")
async def update_fast_channel_content(content_id: str, data: FastChannelContentUpdate):
    """Update fast channel content"""
    try:
        client = get_client()
        update_data = data.model_dump(exclude_none=True)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        response = client.table("fast_channel_content").update(update_data).eq("id", content_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/fast-channel/{content_id}")
async def delete_fast_channel_content(content_id: str):
    """Delete fast channel content"""
    try:
        client = get_client()
        client.table("fast_channel_content").delete().eq("id", content_id).execute()
        return {"message": "Content deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/fast-channel/bulk-update")
async def bulk_update_content(content_ids: List[str], is_active: bool):
    """Bulk activate/deactivate content"""
    try:
        client = get_client()
        for content_id in content_ids:
            client.table("fast_channel_content").update({
                "is_active": is_active,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", content_id).execute()
        return {"message": f"Updated {len(content_ids)} items"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Channel Endpoints ===

@router.get("/channels")
async def list_channels():
    """List all linear channels"""
    try:
        client = get_client()
        response = client.table("fast_channels").select("*").order("created_at").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/channels")
async def create_channel(data: ChannelCreate):
    """Create a new linear channel"""
    try:
        client = get_client()
        response = client.table("fast_channels").insert(data.model_dump()).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/channels/{channel_id}")
async def update_channel(channel_id: str, data: ChannelUpdate):
    """Update channel settings"""
    try:
        client = get_client()
        update_data = data.model_dump(exclude_none=True)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        response = client.table("fast_channels").update(update_data).eq("id", channel_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/channels/{channel_id}/schedule")
async def get_channel_schedule(
    channel_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Get channel programming schedule"""
    try:
        client = get_client()
        query = client.table("fast_channel_schedule").select(
            "*, content:fast_channel_content(*)"
        ).eq("channel_id", channel_id)

        if start_date:
            query = query.gte("scheduled_start", start_date)
        if end_date:
            query = query.lte("scheduled_end", end_date)

        response = query.order("scheduled_start").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/channels/{channel_id}/schedule")
async def add_to_schedule(channel_id: str, data: ScheduleItemCreate):
    """Add content to channel schedule"""
    try:
        client = get_client()
        schedule_data = data.model_dump()
        schedule_data["channel_id"] = channel_id
        schedule_data["scheduled_start"] = schedule_data["scheduled_start"].isoformat()
        schedule_data["scheduled_end"] = schedule_data["scheduled_end"].isoformat()
        response = client.table("fast_channel_schedule").insert(schedule_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/channels/{channel_id}/schedule/{schedule_id}")
async def remove_from_schedule(channel_id: str, schedule_id: str):
    """Remove item from channel schedule"""
    try:
        client = get_client()
        client.table("fast_channel_schedule").delete().eq("id", schedule_id).eq("channel_id", channel_id).execute()
        return {"message": "Schedule item removed"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# === Playlist Endpoints ===

@router.get("/playlists")
async def list_playlists():
    """List all VOD playlists"""
    try:
        client = get_client()
        response = client.table("fast_channel_playlists").select("*").order("sort_order").execute()
        playlists = response.data

        # Get item counts
        for playlist in playlists:
            items_count = client.table("fast_channel_playlist_items").select("id", count="exact").eq("playlist_id", playlist["id"]).execute()
            playlist["item_count"] = items_count.count or 0

        return playlists
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/playlists")
async def create_playlist(data: PlaylistCreate):
    """Create a new VOD playlist"""
    try:
        client = get_client()
        response = client.table("fast_channel_playlists").insert(data.model_dump()).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: str):
    """Get playlist with items"""
    try:
        client = get_client()
        playlist_response = client.table("fast_channel_playlists").select("*").eq("id", playlist_id).single().execute()
        playlist = playlist_response.data

        items_response = client.table("fast_channel_playlist_items").select(
            "*, content:fast_channel_content(*)"
        ).eq("playlist_id", playlist_id).order("sort_order").execute()
        playlist["items"] = items_response.data

        return playlist
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/playlists/{playlist_id}")
async def update_playlist(playlist_id: str, data: PlaylistUpdate):
    """Update playlist"""
    try:
        client = get_client()
        update_data = data.model_dump(exclude_none=True)
        update_data["updated_at"] = datetime.utcnow().isoformat()
        response = client.table("fast_channel_playlists").update(update_data).eq("id", playlist_id).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str):
    """Delete playlist"""
    try:
        client = get_client()
        client.table("fast_channel_playlists").delete().eq("id", playlist_id).execute()
        return {"message": "Playlist deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/playlists/{playlist_id}/items")
async def add_to_playlist(playlist_id: str, data: PlaylistItemAdd):
    """Add content to playlist"""
    try:
        client = get_client()
        item_data = {
            "playlist_id": playlist_id,
            "content_id": data.content_id,
            "sort_order": data.sort_order
        }
        response = client.table("fast_channel_playlist_items").insert(item_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/playlists/{playlist_id}/items/{item_id}")
async def remove_from_playlist(playlist_id: str, item_id: str):
    """Remove content from playlist"""
    try:
        client = get_client()
        client.table("fast_channel_playlist_items").delete().eq("id", item_id).eq("playlist_id", playlist_id).execute()
        return {"message": "Item removed from playlist"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/playlists/{playlist_id}/items/reorder")
async def reorder_playlist_items(playlist_id: str, item_orders: List[dict]):
    """Reorder playlist items"""
    try:
        client = get_client()
        for item in item_orders:
            client.table("fast_channel_playlist_items").update({
                "sort_order": item["sort_order"]
            }).eq("id", item["item_id"]).eq("playlist_id", playlist_id).execute()
        return {"message": "Playlist reordered"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
