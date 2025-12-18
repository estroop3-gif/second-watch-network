"""
Community/Search API Routes
"""
from fastapi import APIRouter, HTTPException, Header, Body, Query
from typing import List, Optional, Dict, Any
from app.core.database import get_client
from datetime import datetime
import os

router = APIRouter()


# =====================================================
# AUTH HELPER
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        USE_AWS = os.getenv('USE_AWS', 'false').lower() == 'true'

        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


@router.get("/filmmakers")
async def search_filmmakers(
    query: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    sort_by: str = "updated_at"
):
    """Search and list filmmakers with pagination"""
    try:
        client = get_client()
        
        # Join profiles and filmmaker_profiles
        db_query = client.table("filmmaker_profiles").select(
            "*, profiles(*)"
        )
        
        # Search by name or username if query provided
        if query:
            db_query = db_query.or_(
                f"profiles.full_name.ilike.%{query}%,profiles.username.ilike.%{query}%"
            )
        
        # Sorting
        response = db_query.range(skip, skip + limit - 1).order(
            sort_by, desc=True
        ).execute()
        
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search")
async def global_search(query: str, type: Optional[str] = None):
    """Global search across multiple entities"""
    try:
        client = get_client()
        results = {
            "filmmakers": [],
            "threads": [],
            "content": []
        }

        if not type or type == "filmmakers":
            filmmakers = client.table("profiles").select("*").ilike(
                "full_name", f"%{query}%"
            ).limit(10).execute()
            results["filmmakers"] = filmmakers.data

        if not type or type == "threads":
            threads = client.table("forum_threads").select("*").ilike(
                "title", f"%{query}%"
            ).limit(10).execute()
            results["threads"] = threads.data

        if not type or type == "content":
            content = client.table("content").select("*").ilike(
                "title", f"%{query}%"
            ).limit(10).execute()
            results["content"] = content.data

        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================
# COMMUNITY PROFILES (for main community page)
# =====================================================

@router.get("/profiles")
async def list_community_profiles(
    q: str = "",
    page: int = 1,
    page_size: int = Query(24, alias="pageSize"),
    sort_by: str = Query("updated_at", alias="sortBy"),
    sort_dir: str = Query("desc", alias="sortDir"),
):
    """
    List community profiles with pagination.
    This replicates the supabase edge function 'community'.
    """
    try:
        client = get_client()

        # Query filmmaker profiles with profile data
        query = client.table("filmmaker_profiles").select(
            "*, profile:profiles(id, username, full_name, display_name, avatar_url, email, role, "
            "is_filmmaker, is_partner, is_premium, is_order_member, is_lodge_officer, is_admin, "
            "is_superadmin, is_moderator, updated_at)"
        )

        # Apply search filter
        if q:
            # Search in related profile fields
            query = query.or_(f"profile.full_name.ilike.%{q}%,profile.username.ilike.%{q}%,department.ilike.%{q}%")

        # Apply sorting
        desc = sort_dir == "desc"
        query = query.order(sort_by, desc=desc)

        # Get total count first (approximate)
        count_result = client.table("filmmaker_profiles").select("id", count="exact").execute()
        total = count_result.count if hasattr(count_result, 'count') else len(count_result.data or [])

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = query.execute()
        items = result.data or []

        # Transform to expected format
        transformed = []
        for item in items:
            profile = item.get("profile") or {}
            transformed.append({
                "profile_id": profile.get("id"),
                "user_id": item.get("user_id"),
                "username": profile.get("username"),
                "full_name": profile.get("full_name"),
                "display_name": profile.get("display_name"),
                "avatar_url": profile.get("avatar_url") or item.get("profile_image_url"),
                "role": profile.get("role"),
                "department": item.get("department"),
                "bio": item.get("bio"),
                "location": item.get("location"),
                "skills": item.get("skills"),
                "experience_level": item.get("experience_level"),
                "accepting_work": item.get("accepting_work"),
                "is_filmmaker": profile.get("is_filmmaker", True),
                "is_partner": profile.get("is_partner", False),
                "is_premium": profile.get("is_premium", False),
                "is_order_member": profile.get("is_order_member", False),
                "is_lodge_officer": profile.get("is_lodge_officer", False),
                "is_admin": profile.get("is_admin", False),
                "is_superadmin": profile.get("is_superadmin", False),
                "updated_at": profile.get("updated_at") or item.get("updated_at"),
            })

        return {
            "items": transformed,
            "total": total,
            "page": page,
            "pageSize": page_size,
            "nextCursor": None if len(items) < page_size else {
                "sortBy": sort_by,
                "sortDir": sort_dir,
                "page": page + 1,
            },
        }

    except Exception as e:
        print(f"Error listing community profiles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# TOPICS
# =====================================================

@router.get("/topics")
async def list_topics():
    """List all community topics"""
    try:
        client = get_client()
        result = client.table("community_topics").select("*").order("sort_order").execute()
        return result.data or []
    except Exception as e:
        print(f"Error listing topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# THREADS
# =====================================================

@router.get("/threads")
async def list_community_threads(
    topic_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
):
    """List community threads with author profiles"""
    try:
        client = get_client()

        query = client.table("community_topic_threads").select(
            "*, topic:community_topics(id, name, slug, icon)"
        ).order("is_pinned", desc=True).order("created_at", desc=True).limit(limit)

        if topic_id:
            query = query.eq("topic_id", topic_id)
        if user_id:
            query = query.eq("user_id", user_id)

        result = query.execute()
        threads = result.data or []

        if not threads:
            return []

        # Fetch profiles
        user_ids = list(set(t["user_id"] for t in threads if t.get("user_id")))
        if user_ids:
            profiles_result = client.table("profiles").select(
                "id, username, full_name, display_name, avatar_url, role, is_order_member"
            ).in_("id", user_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}
        else:
            profile_map = {}

        for t in threads:
            t["author"] = profile_map.get(t.get("user_id"))

        return threads

    except Exception as e:
        print(f"Error listing threads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/threads/{thread_id}")
async def get_community_thread(thread_id: str):
    """Get a single community thread"""
    try:
        client = get_client()

        result = client.table("community_topic_threads").select(
            "*, topic:community_topics(id, name, slug, icon)"
        ).eq("id", thread_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Thread not found")

        thread = result.data[0]

        # Fetch author profile
        if thread.get("user_id"):
            profile_result = client.table("profiles").select(
                "id, username, full_name, display_name, avatar_url, role, is_order_member"
            ).eq("id", thread["user_id"]).execute()
            thread["author"] = profile_result.data[0] if profile_result.data else None

        return thread

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/threads")
async def create_community_thread(
    thread: dict = Body(...),
    authorization: str = Header(None)
):
    """Create a community thread"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        thread_data = {
            "user_id": user["id"],
            "topic_id": thread.get("topic_id"),
            "title": thread.get("title"),
            "content": thread.get("content"),
            "is_pinned": thread.get("is_pinned", False),
        }

        result = client.table("community_topic_threads").insert(thread_data).execute()
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error creating thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/threads/{thread_id}")
async def update_community_thread(
    thread_id: str,
    thread: dict = Body(...),
    authorization: str = Header(None)
):
    """Update a community thread"""
    await get_current_user_from_token(authorization)
    client = get_client()

    try:
        update_data = {}
        for field in ["title", "content", "is_pinned"]:
            if field in thread:
                update_data[field] = thread[field]

        result = client.table("community_topic_threads").update(update_data).eq("id", thread_id).execute()
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error updating thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/threads/{thread_id}")
async def delete_community_thread(
    thread_id: str,
    authorization: str = Header(None)
):
    """Delete a community thread"""
    await get_current_user_from_token(authorization)
    client = get_client()

    try:
        client.table("community_topic_threads").delete().eq("id", thread_id).execute()
        return {"success": True}

    except Exception as e:
        print(f"Error deleting thread: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# REPLIES
# =====================================================

@router.get("/threads/{thread_id}/replies")
async def list_thread_replies(thread_id: str):
    """List replies for a thread"""
    try:
        client = get_client()

        result = client.table("community_topic_replies").select("*").eq(
            "thread_id", thread_id
        ).order("created_at").execute()

        replies = result.data or []

        if not replies:
            return []

        # Fetch profiles
        user_ids = list(set(r["user_id"] for r in replies if r.get("user_id")))
        if user_ids:
            profiles_result = client.table("profiles").select(
                "id, username, full_name, display_name, avatar_url, role, is_order_member"
            ).in_("id", user_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}
        else:
            profile_map = {}

        for r in replies:
            r["author"] = profile_map.get(r.get("user_id"))

        return replies

    except Exception as e:
        print(f"Error listing replies: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/threads/{thread_id}/replies")
async def create_thread_reply(
    thread_id: str,
    reply: dict = Body(...),
    authorization: str = Header(None)
):
    """Create a reply to a thread"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        reply_data = {
            "user_id": user["id"],
            "thread_id": thread_id,
            "content": reply.get("content"),
            "parent_reply_id": reply.get("parent_reply_id"),
        }

        result = client.table("community_topic_replies").insert(reply_data).execute()
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error creating reply: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/replies/{reply_id}")
async def update_thread_reply(
    reply_id: str,
    reply: dict = Body(...),
    authorization: str = Header(None)
):
    """Update a reply"""
    await get_current_user_from_token(authorization)
    client = get_client()

    try:
        result = client.table("community_topic_replies").update({
            "content": reply.get("content")
        }).eq("id", reply_id).execute()
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error updating reply: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/replies/{reply_id}")
async def delete_thread_reply(
    reply_id: str,
    authorization: str = Header(None)
):
    """Delete a reply"""
    await get_current_user_from_token(authorization)
    client = get_client()

    try:
        client.table("community_topic_replies").delete().eq("id", reply_id).execute()
        return {"success": True}

    except Exception as e:
        print(f"Error deleting reply: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COLLABS
# =====================================================

@router.get("/collabs")
async def list_collabs(
    type: Optional[str] = None,
    is_remote: Optional[bool] = None,
    compensation_type: Optional[str] = None,
    order_only: bool = False,
    user_id: Optional[str] = None,
    limit: int = 50,
):
    """List community collabs"""
    try:
        client = get_client()

        query = client.table("community_collabs").select("*").eq(
            "is_active", True
        ).order("created_at", desc=True).limit(limit)

        if type and type != "all":
            query = query.eq("type", type)
        if is_remote is not None:
            query = query.eq("is_remote", is_remote)
        if compensation_type and compensation_type != "all":
            query = query.eq("compensation_type", compensation_type)
        if order_only:
            query = query.eq("is_order_only", True)
        if user_id:
            query = query.eq("user_id", user_id)

        result = query.execute()
        collabs = result.data or []

        if not collabs:
            return []

        # Fetch profiles
        user_ids = list(set(c["user_id"] for c in collabs if c.get("user_id")))
        if user_ids:
            profiles_result = client.table("profiles").select(
                "id, username, full_name, display_name, avatar_url, role, is_order_member"
            ).in_("id", user_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}
        else:
            profile_map = {}

        for c in collabs:
            c["profile"] = profile_map.get(c.get("user_id"))

        return collabs

    except Exception as e:
        print(f"Error listing collabs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collabs/{collab_id}")
async def get_collab(collab_id: str):
    """Get a single collab"""
    try:
        client = get_client()

        result = client.table("community_collabs").select("*").eq("id", collab_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Collab not found")

        collab = result.data[0]

        # Fetch profile
        if collab.get("user_id"):
            profile_result = client.table("profiles").select(
                "id, username, full_name, display_name, avatar_url, role, is_order_member"
            ).eq("id", collab["user_id"]).execute()
            collab["profile"] = profile_result.data[0] if profile_result.data else None

        return collab

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting collab: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collabs")
async def create_collab(
    collab: dict = Body(...),
    authorization: str = Header(None)
):
    """Create a collab"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        collab_data = {
            "user_id": user["id"],
            "title": collab.get("title"),
            "type": collab.get("type"),
            "description": collab.get("description"),
            "location": collab.get("location"),
            "is_remote": collab.get("is_remote", False),
            "compensation_type": collab.get("compensation_type"),
            "start_date": collab.get("start_date"),
            "end_date": collab.get("end_date"),
            "tags": collab.get("tags", []),
            "is_order_only": collab.get("is_order_only", False),
        }

        result = client.table("community_collabs").insert(collab_data).execute()
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error creating collab: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/collabs/{collab_id}")
async def update_collab(
    collab_id: str,
    collab: dict = Body(...),
    authorization: str = Header(None)
):
    """Update a collab"""
    await get_current_user_from_token(authorization)
    client = get_client()

    try:
        update_data = {}
        for field in ["title", "type", "description", "location", "is_remote",
                      "compensation_type", "start_date", "end_date", "tags", "is_order_only"]:
            if field in collab:
                update_data[field] = collab[field]

        result = client.table("community_collabs").update(update_data).eq("id", collab_id).execute()
        return result.data[0] if result.data else None

    except Exception as e:
        print(f"Error updating collab: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/collabs/{collab_id}")
async def delete_collab(
    collab_id: str,
    authorization: str = Header(None)
):
    """Delete a collab"""
    await get_current_user_from_token(authorization)
    client = get_client()

    try:
        client.table("community_collabs").delete().eq("id", collab_id).execute()
        return {"success": True}

    except Exception as e:
        print(f"Error deleting collab: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/collabs/{collab_id}/deactivate")
async def deactivate_collab(
    collab_id: str,
    authorization: str = Header(None)
):
    """Deactivate a collab"""
    await get_current_user_from_token(authorization)
    client = get_client()

    try:
        client.table("community_collabs").update({"is_active": False}).eq("id", collab_id).execute()
        return {"success": True}

    except Exception as e:
        print(f"Error deactivating collab: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COMMUNITY ACTIVITY
# =====================================================

@router.get("/activity")
async def get_community_activity(limit: int = 20):
    """Get recent community activity (collabs and threads)"""
    try:
        client = get_client()
        half_limit = limit // 2

        # Fetch recent collabs
        collabs_result = client.table("community_collabs").select(
            "id, title, type, created_at, user_id"
        ).eq("is_active", True).order("created_at", desc=True).limit(half_limit).execute()
        collabs = collabs_result.data or []

        # Fetch recent threads
        threads_result = client.table("community_topic_threads").select(
            "id, title, created_at, user_id, topic:community_topics(name, slug)"
        ).order("created_at", desc=True).limit(half_limit).execute()
        threads = threads_result.data or []

        # Collect user IDs and fetch profiles
        all_user_ids = list(set(
            [c["user_id"] for c in collabs if c.get("user_id")] +
            [t["user_id"] for t in threads if t.get("user_id")]
        ))

        profile_map = {}
        if all_user_ids:
            profiles_result = client.table("profiles").select(
                "id, username, display_name, full_name, avatar_url"
            ).in_("id", all_user_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}

        # Build activity list
        activity = []

        for collab in collabs:
            activity.append({
                "id": collab["id"],
                "type": "collab",
                "action": "created",
                "title": collab["title"],
                "user_id": collab["user_id"],
                "created_at": collab["created_at"],
                "profile": profile_map.get(collab["user_id"]),
                "metadata": {"collab_type": collab.get("type")},
            })

        for thread in threads:
            topic = thread.get("topic") or {}
            activity.append({
                "id": thread["id"],
                "type": "thread",
                "action": "created",
                "title": thread["title"],
                "user_id": thread["user_id"],
                "created_at": thread["created_at"],
                "profile": profile_map.get(thread["user_id"]),
                "metadata": {"topic_name": topic.get("name")},
            })

        # Sort by created_at descending
        activity.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        return activity[:limit]

    except Exception as e:
        print(f"Error getting community activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))
