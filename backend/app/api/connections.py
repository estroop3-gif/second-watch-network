"""
Connections API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
from app.schemas.connections import Connection, ConnectionCreate, ConnectionUpdate

router = APIRouter()


@router.post("/", response_model=Connection)
async def create_connection_request(connection: ConnectionCreate, requester_id: str):
    """Send connection request"""
    try:
        client = get_client()
        data = connection.model_dump()
        data["requester_id"] = requester_id
        data["status"] = "pending"
        
        response = client.table("connections").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[Connection])
async def list_connections(
    user_id: str,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """List user's connections"""
    try:
        client = get_client()
        query = client.table("connections").select("*").or_(
            f"requester_id.eq.{user_id},recipient_id.eq.{user_id}"
        )
        
        if status:
            query = query.eq("status", status)
        
        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{connection_id}", response_model=Connection)
async def update_connection(connection_id: str, update: ConnectionUpdate):
    """Update connection status (accept/deny)"""
    try:
        client = get_client()
        response = client.table("connections").update(
            update.model_dump()
        ).eq("id", connection_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{connection_id}")
async def delete_connection(connection_id: str):
    """Delete/cancel a connection request"""
    try:
        client = get_client()
        client.table("connections").delete().eq("id", connection_id).execute()
        return {"message": "Connection deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/relationship/{peer_id}")
async def get_connection_relationship(peer_id: str, user_id: str):
    """Get connection relationship between current user and a peer"""
    try:
        client = get_client()
        response = client.table("connections").select("*").or_(
            f"and(requester_id.eq.{user_id},recipient_id.eq.{peer_id}),and(requester_id.eq.{peer_id},recipient_id.eq.{user_id})"
        ).order("created_at", desc=True).limit(1).execute()

        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/activity")
async def get_friends_activity(user_id: str, limit: int = 10):
    """
    Get activity from connected users (friends).
    Returns recent watchlist additions, ratings, and watch history.
    """
    try:
        client = get_client()

        # Get list of connected user IDs (accepted connections)
        connections_response = client.table("connections").select("requester_id, recipient_id").eq(
            "status", "accepted"
        ).or_(
            f"requester_id.eq.{user_id},recipient_id.eq.{user_id}"
        ).execute()

        # Extract friend IDs
        friend_ids = set()
        for conn in connections_response.data:
            if conn["requester_id"] == user_id:
                friend_ids.add(conn["recipient_id"])
            else:
                friend_ids.add(conn["requester_id"])

        if not friend_ids:
            return {"activities": [], "total": 0}

        friend_ids_list = list(friend_ids)
        activities = []

        # Get recent watchlist additions from friends
        try:
            watchlist_response = client.table("world_watchlist").select(
                "user_id, world_id, created_at, worlds(id, title, slug, thumbnail_url)"
            ).in_("user_id", friend_ids_list).order(
                "created_at", desc=True
            ).limit(limit).execute()

            for item in watchlist_response.data:
                if item.get("worlds"):
                    activities.append({
                        "type": "watchlist_add",
                        "user_id": item["user_id"],
                        "world_id": item["world_id"],
                        "world_title": item["worlds"].get("title"),
                        "world_slug": item["worlds"].get("slug"),
                        "world_poster": item["worlds"].get("thumbnail_url"),
                        "timestamp": item["created_at"],
                    })
        except Exception:
            pass  # Watchlist table may not exist

        # Get recent ratings from friends
        try:
            ratings_response = client.table("world_ratings").select(
                "user_id, world_id, rating, review, created_at, worlds(id, title, slug, thumbnail_url)"
            ).in_("user_id", friend_ids_list).order(
                "created_at", desc=True
            ).limit(limit).execute()

            for item in ratings_response.data:
                if item.get("worlds"):
                    activities.append({
                        "type": "rating",
                        "user_id": item["user_id"],
                        "world_id": item["world_id"],
                        "world_title": item["worlds"].get("title"),
                        "world_slug": item["worlds"].get("slug"),
                        "world_poster": item["worlds"].get("thumbnail_url"),
                        "rating": item["rating"],
                        "review": item.get("review"),
                        "timestamp": item["created_at"],
                    })
        except Exception:
            pass  # Ratings table may not exist

        # Get recent watch history from friends
        try:
            watch_response = client.table("watch_history").select(
                "user_id, world_id, episode_id, progress_percent, updated_at, worlds(id, title, slug, thumbnail_url)"
            ).in_("user_id", friend_ids_list).gte(
                "progress_percent", 80  # Only show if mostly watched
            ).order(
                "updated_at", desc=True
            ).limit(limit).execute()

            for item in watch_response.data:
                if item.get("worlds"):
                    activities.append({
                        "type": "watched",
                        "user_id": item["user_id"],
                        "world_id": item["world_id"],
                        "world_title": item["worlds"].get("title"),
                        "world_slug": item["worlds"].get("slug"),
                        "world_poster": item["worlds"].get("thumbnail_url"),
                        "episode_id": item.get("episode_id"),
                        "progress_percent": item.get("progress_percent"),
                        "timestamp": item["updated_at"],
                    })
        except Exception:
            pass  # Watch history table may not exist

        # Sort all activities by timestamp, most recent first
        activities.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        activities = activities[:limit]

        # Get user profiles for the friend IDs in the activities
        activity_user_ids = list(set(a["user_id"] for a in activities))
        if activity_user_ids:
            profiles_response = client.table("profiles").select(
                "id, full_name, display_name, avatar_url"
            ).in_("id", activity_user_ids).execute()

            profiles_by_id = {p["id"]: p for p in profiles_response.data}

            for activity in activities:
                profile = profiles_by_id.get(activity["user_id"], {})
                activity["user_name"] = profile.get("display_name") or profile.get("full_name") or "Friend"
                activity["user_avatar"] = profile.get("avatar_url")

        return {"activities": activities, "total": len(activities)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
