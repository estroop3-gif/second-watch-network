"""
Connections API Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.core.database import get_client, execute_query, execute_single
from app.core.deps import get_user_profile
from app.schemas.connections import Connection, ConnectionCreate, ConnectionUpdate

router = APIRouter()


@router.post("/", response_model=Connection)
async def create_connection_request(
    connection: ConnectionCreate,
    profile=Depends(get_user_profile),
):
    """Send connection request. Requester is extracted from auth token."""
    try:
        client = get_client()
        requester_id = str(profile["id"])
        recipient_id = connection.recipient_id

        if requester_id == recipient_id:
            raise HTTPException(status_code=400, detail="Cannot connect with yourself")

        # Check if a connection already exists between the two users (either direction)
        existing_rows = execute_query(
            """SELECT * FROM connections
               WHERE (requester_id = :a AND recipient_id = :b)
                  OR (requester_id = :b AND recipient_id = :a)
               ORDER BY created_at DESC LIMIT 1""",
            {"a": requester_id, "b": recipient_id}
        )

        if existing_rows:
            conn = existing_rows[0]
            current_status = conn.get("status")

            # If pending or accepted, return existing connection (idempotent)
            if current_status in ("pending", "accepted"):
                return conn

            # If denied or blocked, update status back to pending (re-request)
            if current_status in ("denied", "blocked"):
                updated = client.table("connections").update({
                    "status": "pending",
                    "requester_id": requester_id,
                    "recipient_id": recipient_id,
                }).eq("id", conn["id"]).execute()
                return updated.data[0]

        # No existing connection — create new
        data = connection.model_dump(exclude_none=True)
        data["requester_id"] = requester_id
        data["status"] = "pending"

        response = client.table("connections").insert(data).execute()
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[Connection])
async def list_connections(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    profile=Depends(get_user_profile),
):
    """List authenticated user's connections."""
    try:
        user_id = str(profile["id"])
        params = {"user_id": user_id}
        where_clauses = ["(requester_id = :user_id OR recipient_id = :user_id)"]

        if status:
            where_clauses.append("status = :status")
            params["status"] = status

        where_sql = " AND ".join(where_clauses)
        rows = execute_query(
            f"""SELECT * FROM connections
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :skip""",
            {**params, "limit": limit, "skip": skip}
        )
        return rows
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
async def get_connection_relationship(
    peer_id: str,
    profile=Depends(get_user_profile),
):
    """Get connection relationship between authenticated user and a peer."""
    try:
        user_id = str(profile["id"])
        rows = execute_query(
            """SELECT * FROM connections
               WHERE (requester_id = :a AND recipient_id = :b)
                  OR (requester_id = :b AND recipient_id = :a)
               ORDER BY created_at DESC LIMIT 1""",
            {"a": user_id, "b": peer_id}
        )
        return rows[0] if rows else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/activity")
async def get_friends_activity(
    limit: int = 10,
    profile=Depends(get_user_profile),
):
    """
    Get activity from connected users (friends).
    Returns recent watchlist additions, ratings, and watch history.
    """
    try:
        user_id = str(profile["id"])

        # Get list of accepted connected user IDs
        conn_rows = execute_query(
            """SELECT requester_id, recipient_id FROM connections
               WHERE (requester_id = :uid OR recipient_id = :uid)
                 AND status = 'accepted'""",
            {"uid": user_id}
        )

        friend_ids = set()
        for conn in conn_rows:
            if str(conn["requester_id"]) == user_id:
                friend_ids.add(str(conn["recipient_id"]))
            else:
                friend_ids.add(str(conn["requester_id"]))

        if not friend_ids:
            return {"activities": [], "total": 0}

        # Build a parameterised IN list
        id_params = {f"fid{i}": fid for i, fid in enumerate(friend_ids)}
        in_clause = ", ".join(f":{k}" for k in id_params)

        activities = []

        # Watchlist additions
        try:
            rows = execute_query(
                f"""SELECT ww.user_id, ww.world_id, ww.created_at,
                           w.title, w.slug, w.thumbnail_url
                    FROM world_watchlist ww
                    JOIN worlds w ON w.id = ww.world_id
                    WHERE ww.user_id IN ({in_clause})
                    ORDER BY ww.created_at DESC LIMIT :lim""",
                {**id_params, "lim": limit}
            )
            for item in rows:
                activities.append({
                    "type": "watchlist_add",
                    "user_id": item["user_id"],
                    "world_id": item["world_id"],
                    "world_title": item.get("title"),
                    "world_slug": item.get("slug"),
                    "world_poster": item.get("thumbnail_url"),
                    "timestamp": item["created_at"],
                })
        except Exception:
            pass

        # Ratings
        try:
            rows = execute_query(
                f"""SELECT wr.user_id, wr.world_id, wr.rating, wr.review, wr.created_at,
                           w.title, w.slug, w.thumbnail_url
                    FROM world_ratings wr
                    JOIN worlds w ON w.id = wr.world_id
                    WHERE wr.user_id IN ({in_clause})
                    ORDER BY wr.created_at DESC LIMIT :lim""",
                {**id_params, "lim": limit}
            )
            for item in rows:
                activities.append({
                    "type": "rating",
                    "user_id": item["user_id"],
                    "world_id": item["world_id"],
                    "world_title": item.get("title"),
                    "world_slug": item.get("slug"),
                    "world_poster": item.get("thumbnail_url"),
                    "rating": item["rating"],
                    "review": item.get("review"),
                    "timestamp": item["created_at"],
                })
        except Exception:
            pass

        # Watch history (≥80% watched)
        try:
            rows = execute_query(
                f"""SELECT wh.user_id, wh.world_id, wh.episode_id,
                           wh.progress_percent, wh.updated_at,
                           w.title, w.slug, w.thumbnail_url
                    FROM watch_history wh
                    JOIN worlds w ON w.id = wh.world_id
                    WHERE wh.user_id IN ({in_clause})
                      AND wh.progress_percent >= 80
                    ORDER BY wh.updated_at DESC LIMIT :lim""",
                {**id_params, "lim": limit}
            )
            for item in rows:
                activities.append({
                    "type": "watched",
                    "user_id": item["user_id"],
                    "world_id": item["world_id"],
                    "world_title": item.get("title"),
                    "world_slug": item.get("slug"),
                    "world_poster": item.get("thumbnail_url"),
                    "episode_id": item.get("episode_id"),
                    "progress_percent": item.get("progress_percent"),
                    "timestamp": item["updated_at"],
                })
        except Exception:
            pass

        # Sort all activities by timestamp DESC and cap at limit
        activities.sort(key=lambda x: x.get("timestamp") or "", reverse=True)
        activities = activities[:limit]

        # Attach profile info for each unique user in results
        activity_user_ids = list({a["user_id"] for a in activities})
        if activity_user_ids:
            uid_params = {f"uid{i}": uid for i, uid in enumerate(activity_user_ids)}
            uid_in = ", ".join(f":{k}" for k in uid_params)
            profile_rows = execute_query(
                f"""SELECT id, full_name, display_name, avatar_url
                    FROM profiles WHERE id IN ({uid_in})""",
                uid_params
            )
            profiles_by_id = {str(p["id"]): p for p in profile_rows}
            for activity in activities:
                p = profiles_by_id.get(str(activity["user_id"]), {})
                activity["user_name"] = p.get("full_name") or p.get("display_name") or "Friend"
                activity["user_avatar"] = p.get("avatar_url")

        return {"activities": activities, "total": len(activities)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
