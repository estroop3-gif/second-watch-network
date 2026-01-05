"""
Community/Search API Routes
"""
from fastapi import APIRouter, HTTPException, Header, Body, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.core.database import get_client
from datetime import datetime
import os


# =====================================================
# SCHEMAS
# =====================================================

class CollabApplicationInput(BaseModel):
    elevator_pitch: Optional[str] = Field(None, max_length=100)
    cover_note: Optional[str] = None
    availability_notes: Optional[str] = None
    rate_expectation: Optional[str] = None
    reel_url: Optional[str] = None
    headshot_url: Optional[str] = None
    resume_url: Optional[str] = None
    selected_credit_ids: Optional[List[str]] = None
    template_id: Optional[str] = None
    local_hire_confirmed: Optional[bool] = None
    is_promoted: bool = False
    save_as_template: bool = False
    template_name: Optional[str] = None
    custom_question_responses: Optional[Dict[str, str]] = None


class ApplicationStatusUpdate(BaseModel):
    status: str  # applied, viewed, shortlisted, interview, offered, booked, rejected
    internal_notes: Optional[str] = None
    rating: Optional[int] = Field(None, ge=1, le=5)

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


async def check_user_permission(user_id: str, permission: str) -> bool:
    """Check if user has a specific permission via their roles"""
    try:
        client = get_client()

        # Get user's role IDs first
        roles_result = client.table("user_roles").select("role_id").eq("user_id", user_id).execute()

        if not roles_result.data:
            # No roles assigned - allow by default for now
            return True

        role_ids = [r["role_id"] for r in roles_result.data]

        # Get the actual roles with permissions
        custom_roles = client.table("custom_roles").select("*").in_("id", role_ids).execute()

        if not custom_roles.data:
            return True  # No role data found, allow by default

        # Check if any role has the permission
        for role in custom_roles.data:
            if role.get(permission, False):
                return True

        # If the permission column doesn't exist yet, allow by default
        # This handles the case where migration hasn't been run
        first_role = custom_roles.data[0] if custom_roles.data else {}
        if permission not in first_role:
            print(f"Warning: Permission '{permission}' not found in custom_roles table")
            return True

        return False

    except Exception as e:
        print(f"Error checking permission '{permission}' for user {user_id}: {e}")
        # Allow by default on error to not break existing functionality
        return True


async def require_permission(user_id: str, permission: str) -> None:
    """Require user to have a specific permission, raise 403 if not"""
    has_permission = await check_user_permission(user_id, permission)
    if not has_permission:
        raise HTTPException(
            status_code=403,
            detail=f"You don't have permission to perform this action"
        )


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
        
        # Join profiles via user_id
        db_query = client.table("filmmaker_profiles").select(
            "*, profile:user_id(id, full_name, username, avatar_url, location, bio)"
        )
        
        # Note: Searching nested fields requires raw SQL or separate query
        # For now, skip the search filter and fetch all, then filter in the results
        # TODO: Implement proper search with JOINs if needed
        
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


async def check_forum_ban(user_id: str, client) -> Optional[dict]:
    """Check if user has an active forum ban that prevents posting"""
    from datetime import timezone

    profile = client.table("profiles").select(
        "forum_ban_type, forum_ban_until, forum_ban_reason"
    ).eq("id", user_id).single().execute()

    if not profile.data or not profile.data.get("forum_ban_type"):
        return None

    ban_type = profile.data.get("forum_ban_type")
    ban_until = profile.data.get("forum_ban_until")

    # Check if expired
    if ban_until:
        expires = datetime.fromisoformat(str(ban_until).replace("Z", "+00:00"))
        if expires < datetime.now(timezone.utc):
            # Ban has expired - clear it
            client.table("profiles").update({
                "forum_ban_type": None,
                "forum_ban_until": None,
                "forum_ban_reason": None
            }).eq("id", user_id).execute()
            client.table("forum_bans").update({
                "is_active": False
            }).eq("user_id", user_id).eq("is_active", True).execute()
            return None

    # read_only and full_block prevent posting
    # shadow_restrict allows posting (but content is hidden from others)
    if ban_type in ['read_only', 'full_block']:
        return {
            "restriction_type": ban_type,
            "reason": profile.data.get("forum_ban_reason"),
            "expires_at": ban_until
        }

    return None  # shadow_restrict can still post


@router.post("/threads")
async def create_community_thread(
    thread: dict = Body(...),
    authorization: str = Header(None)
):
    """Create a community thread"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Check for forum ban
    ban = await check_forum_ban(user["id"], client)
    if ban:
        raise HTTPException(
            status_code=403,
            detail=f"You are currently restricted from posting in the forum. Reason: {ban.get('reason', 'Policy violation')}"
        )

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

    # Check for forum ban
    ban = await check_forum_ban(user["id"], client)
    if ban:
        raise HTTPException(
            status_code=403,
            detail=f"You are currently restricted from posting in the forum. Reason: {ban.get('reason', 'Policy violation')}"
        )

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
            # Job type (freelance/full_time)
            "job_type": collab.get("job_type", "freelance"),
            # Production info
            "production_id": collab.get("production_id"),
            "production_title": collab.get("production_title"),
            "production_type": collab.get("production_type"),
            "company": collab.get("company"),
            "company_id": collab.get("company_id"),
            "network_id": collab.get("network_id"),
            "hide_production_info": collab.get("hide_production_info", False),
            # Freelance compensation
            "day_rate_min": collab.get("day_rate_min"),
            "day_rate_max": collab.get("day_rate_max"),
            # Full-time compensation
            "salary_min": collab.get("salary_min"),
            "salary_max": collab.get("salary_max"),
            "benefits_info": collab.get("benefits_info"),
            # Application requirements
            "requires_local_hire": collab.get("requires_local_hire", False),
            "requires_order_member": collab.get("requires_order_member", False),
            "requires_reel": collab.get("requires_reel", False),
            "requires_headshot": collab.get("requires_headshot", False),
            "requires_resume": collab.get("requires_resume", False),
            "application_deadline": collab.get("application_deadline"),
            "max_applications": collab.get("max_applications"),
            # Union and Order requirements
            "union_requirements": collab.get("union_requirements", []),
            "requires_order_membership": collab.get("requires_order_membership", False),
            # Custom questions
            "custom_questions": collab.get("custom_questions", []),
            # Featured post
            "is_featured": collab.get("is_featured", False),
            "featured_until": collab.get("featured_until"),
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
        allowed_fields = [
            "title", "type", "description", "location", "is_remote",
            "compensation_type", "start_date", "end_date", "tags", "is_order_only",
            "requires_local_hire", "requires_order_member", "requires_reel",
            "requires_headshot", "requires_resume", "application_deadline", "max_applications",
            "production_id", "production_title", "production_type", "company", "company_id", "network_id",
            "hide_production_info", "job_type",
            "day_rate_min", "day_rate_max", "salary_min", "salary_max", "benefits_info",
            "union_requirements", "requires_order_membership", "custom_questions",
            "is_featured", "featured_until"
        ]
        for field in allowed_fields:
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


@router.get("/trending")
async def get_trending_discussions(timeframe: str = "7d", limit: int = 5):
    """
    Get trending community discussions based on engagement.
    Timeframe: 24h, 7d, 30d
    """
    try:
        client = get_client()

        # Calculate date threshold
        from datetime import datetime, timedelta
        now = datetime.utcnow()
        if timeframe == "24h":
            threshold = now - timedelta(hours=24)
        elif timeframe == "30d":
            threshold = now - timedelta(days=30)
        else:  # default 7d
            threshold = now - timedelta(days=7)

        threshold_str = threshold.isoformat()

        # Fetch threads with activity in the timeframe, sorted by reply count
        threads_result = client.table("community_topic_threads").select(
            "id, title, created_at, user_id, reply_count, view_count, "
            "topic:community_topics(id, name, slug)"
        ).gte("created_at", threshold_str).order(
            "reply_count", desc=True
        ).limit(limit).execute()

        threads = threads_result.data or []

        # Collect user IDs and fetch profiles
        user_ids = list(set(t["user_id"] for t in threads if t.get("user_id")))
        profile_map = {}
        if user_ids:
            profiles_result = client.table("profiles").select(
                "id, username, display_name, full_name, avatar_url"
            ).in_("id", user_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}

        # Build response
        trending = []
        for thread in threads:
            topic = thread.get("topic") or {}
            profile = profile_map.get(thread.get("user_id"), {})
            trending.append({
                "id": thread["id"],
                "title": thread["title"],
                "topic_name": topic.get("name"),
                "topic_slug": topic.get("slug"),
                "reply_count": thread.get("reply_count", 0),
                "view_count": thread.get("view_count", 0),
                "created_at": thread["created_at"],
                "user_id": thread.get("user_id"),
                "user_name": profile.get("display_name") or profile.get("full_name") or profile.get("username"),
                "user_avatar": profile.get("avatar_url"),
                "is_hot": thread.get("reply_count", 0) > 5,
            })

        return {"threads": trending, "total": len(trending), "timeframe": timeframe}

    except Exception as e:
        print(f"Error getting trending discussions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COLLAB APPLICATIONS
# =====================================================

@router.post("/collabs/{collab_id}/apply")
async def apply_to_collab(
    collab_id: str,
    application: CollabApplicationInput,
    authorization: str = Header(None)
):
    """Apply to a community collab"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Check if collab exists and is active
        collab_result = client.table("community_collabs").select("*").eq(
            "id", collab_id
        ).eq("is_active", True).single().execute()

        if not collab_result.data:
            raise HTTPException(status_code=404, detail="Collab not found or is closed")

        collab = collab_result.data

        # Check if user already applied
        existing = client.table("community_collab_applications").select("id").eq(
            "collab_id", collab_id
        ).eq("applicant_user_id", user_id).execute()

        if existing.data:
            raise HTTPException(status_code=400, detail="You have already applied to this collab")

        # Check requirements
        if collab.get("requires_order_member"):
            profile = client.table("profiles").select("is_order_member").eq(
                "id", user_id
            ).single().execute()
            if not profile.data or not profile.data.get("is_order_member"):
                raise HTTPException(status_code=403, detail="This opportunity is only for Order members")

        if collab.get("requires_local_hire") and application.local_hire_confirmed is None:
            raise HTTPException(status_code=400, detail="Please confirm if you can work as a local hire")

        if collab.get("requires_reel") and not application.reel_url:
            raise HTTPException(status_code=400, detail="A reel URL is required for this opportunity")

        if collab.get("requires_headshot") and not application.headshot_url:
            raise HTTPException(status_code=400, detail="A headshot is required for this opportunity")

        if collab.get("requires_resume") and not application.resume_url:
            raise HTTPException(status_code=400, detail="A resume is required for this opportunity")

        # Get applicant profile snapshot
        profile_result = client.table("profiles").select(
            "id, username, full_name, display_name, avatar_url, role, is_order_member"
        ).eq("id", user_id).single().execute()
        profile_snapshot = profile_result.data if profile_result.data else {}

        # Create application
        application_data = {
            "collab_id": collab_id,
            "applicant_user_id": user_id,
            "applicant_profile_snapshot": profile_snapshot,
            "elevator_pitch": application.elevator_pitch,
            "cover_note": application.cover_note,
            "availability_notes": application.availability_notes,
            "rate_expectation": application.rate_expectation,
            "reel_url": application.reel_url,
            "headshot_url": application.headshot_url,
            "resume_url": application.resume_url,
            "selected_credit_ids": application.selected_credit_ids or [],
            "template_id": application.template_id,
            "local_hire_confirmed": application.local_hire_confirmed,
            "is_promoted": application.is_promoted,
            "custom_question_responses": application.custom_question_responses or {},
            "status": "applied",
        }

        result = client.table("community_collab_applications").insert(application_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to submit application")

        # If save_as_template is True, create a template
        if application.save_as_template and application.template_name:
            template_data = {
                "user_id": user_id,
                "name": application.template_name,
                "cover_letter": application.cover_note,
                "elevator_pitch": application.elevator_pitch,
                "rate_expectation": application.rate_expectation,
                "availability_notes": application.availability_notes,
                "default_reel_url": application.reel_url,
                "default_headshot_url": application.headshot_url,
                "default_resume_url": application.resume_url,
                "default_credit_ids": application.selected_credit_ids or [],
            }
            client.table("application_templates").insert(template_data).execute()

        # If template_id was provided, record usage
        if application.template_id:
            existing_template = client.table("application_templates").select("use_count").eq(
                "id", application.template_id
            ).eq("user_id", user_id).single().execute()

            if existing_template.data:
                new_count = (existing_template.data.get("use_count") or 0) + 1
                client.table("application_templates").update({
                    "use_count": new_count,
                    "last_used_at": datetime.utcnow().isoformat()
                }).eq("id", application.template_id).execute()

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error applying to collab: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collabs/{collab_id}/applications")
async def list_collab_applications(
    collab_id: str,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """List applications for a collab (owner only)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Verify user owns this collab
        collab = client.table("community_collabs").select("id, user_id").eq(
            "id", collab_id
        ).single().execute()

        if not collab.data:
            raise HTTPException(status_code=404, detail="Collab not found")

        if collab.data.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="You can only view applications for your own collabs")

        # Get applications
        query = client.table("community_collab_applications").select("*").eq(
            "collab_id", collab_id
        ).order("is_promoted", desc=True).order("created_at", desc=True)

        if status:
            query = query.eq("status", status)

        result = query.execute()
        applications = result.data or []

        # Fetch current profile info for each applicant
        if applications:
            applicant_ids = list(set(app["applicant_user_id"] for app in applications if app.get("applicant_user_id")))
            profiles_result = client.table("profiles").select(
                "id, username, full_name, display_name, avatar_url, role, is_order_member"
            ).in_("id", applicant_ids).execute()
            profile_map = {p["id"]: p for p in (profiles_result.data or [])}

            for app in applications:
                app["current_profile"] = profile_map.get(app.get("applicant_user_id"))

                # Fetch selected credits if any
                if app.get("selected_credit_ids"):
                    credits_result = client.table("credits").select(
                        "id, project_title, role, year"
                    ).in_("id", app["selected_credit_ids"]).execute()
                    app["selected_credits"] = credits_result.data or []

        return applications

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error listing collab applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/my-collab-applications")
async def list_my_collab_applications(
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """List current user's collab applications"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        query = client.table("community_collab_applications").select(
            "*, collab:community_collabs(id, title, type, location, is_remote, user_id)"
        ).eq("applicant_user_id", user_id).order("created_at", desc=True)

        if status:
            query = query.eq("status", status)

        result = query.execute()
        applications = result.data or []

        # Fetch collab owner profiles
        if applications:
            owner_ids = list(set(
                app.get("collab", {}).get("user_id")
                for app in applications
                if app.get("collab") and app["collab"].get("user_id")
            ))
            if owner_ids:
                profiles_result = client.table("profiles").select(
                    "id, username, full_name, display_name, avatar_url"
                ).in_("id", owner_ids).execute()
                profile_map = {p["id"]: p for p in (profiles_result.data or [])}

                for app in applications:
                    if app.get("collab") and app["collab"].get("user_id"):
                        app["collab"]["owner_profile"] = profile_map.get(app["collab"]["user_id"])

        return applications

    except Exception as e:
        print(f"Error listing my collab applications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collab-applications-received")
async def list_collab_applications_received(
    status: Optional[str] = None,
    collab_id: Optional[str] = None,
    authorization: str = Header(None)
):
    """List all applications received for collabs posted by the current user"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Get all collabs posted by this user
        collabs_query = client.table("community_collabs").select("id, title, type").eq("user_id", user_id)

        if collab_id:
            collabs_query = collabs_query.eq("id", collab_id)

        collabs_result = collabs_query.execute()
        user_collabs = collabs_result.data or []
        collab_ids = [c["id"] for c in user_collabs]

        if not collab_ids:
            return {"applications": [], "by_collab": {}, "count": 0}

        # Get all applications for these collabs
        query = client.table("community_collab_applications").select(
            "*, collab:community_collabs(id, title, type, location, is_remote)"
        ).in_("collab_id", collab_ids).order("created_at", desc=True)

        if status:
            query = query.eq("status", status)

        result = query.execute()
        applications = result.data or []

        # Fetch applicant profiles
        if applications:
            applicant_ids = list(set(
                app.get("applicant_user_id")
                for app in applications
                if app.get("applicant_user_id")
            ))
            if applicant_ids:
                profiles_result = client.table("profiles").select(
                    "id, username, full_name, display_name, avatar_url"
                ).in_("id", applicant_ids).execute()
                profile_map = {p["id"]: p for p in (profiles_result.data or [])}

                for app in applications:
                    if app.get("applicant_user_id"):
                        app["applicant_profile"] = profile_map.get(app["applicant_user_id"])

        # Group by collab for easier frontend display
        by_collab = {}
        for app in applications:
            cid = app.get("collab_id")
            if cid:
                if cid not in by_collab:
                    collab_info = next((c for c in user_collabs if c["id"] == cid), {})
                    by_collab[cid] = {
                        "collab": collab_info,
                        "applications": []
                    }
                by_collab[cid]["applications"].append(app)

        return {
            "applications": applications,
            "by_collab": by_collab,
            "count": len(applications)
        }

    except Exception as e:
        print(f"Error listing collab applications received: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/collab-applications/{application_id}/status")
async def update_application_status(
    application_id: str,
    update: ApplicationStatusUpdate,
    authorization: str = Header(None)
):
    """Update application status (collab owner only)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Get application and verify ownership of the collab
        app_result = client.table("community_collab_applications").select(
            "*, collab:community_collabs(id, user_id)"
        ).eq("id", application_id).single().execute()

        if not app_result.data:
            raise HTTPException(status_code=404, detail="Application not found")

        collab = app_result.data.get("collab")
        if not collab or collab.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="You can only update applications for your own collabs")

        # Valid status transitions
        valid_statuses = ["applied", "viewed", "shortlisted", "interview", "offered", "booked", "rejected"]
        if update.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

        update_data = {
            "status": update.status,
            "status_changed_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        if update.internal_notes is not None:
            update_data["internal_notes"] = update.internal_notes

        if update.rating is not None:
            update_data["rating"] = update.rating

        result = client.table("community_collab_applications").update(update_data).eq(
            "id", application_id
        ).execute()

        return result.data[0] if result.data else {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating application status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collab-applications/{application_id}/promote")
async def promote_application(
    application_id: str,
    authorization: str = Header(None)
):
    """Promote an application (boost visibility)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Get application and verify ownership
        app_result = client.table("community_collab_applications").select("*").eq(
            "id", application_id
        ).eq("applicant_user_id", user_id).single().execute()

        if not app_result.data:
            raise HTTPException(status_code=404, detail="Application not found")

        if app_result.data.get("is_promoted"):
            raise HTTPException(status_code=400, detail="Application is already promoted")

        # Check if user is Order member (free promotion)
        profile = client.table("profiles").select("is_order_member").eq(
            "id", user_id
        ).single().execute()

        is_order_member = profile.data.get("is_order_member", False) if profile.data else False

        # TODO: If not order member, process payment here
        # For now, we'll allow the promotion

        result = client.table("community_collab_applications").update({
            "is_promoted": True,
            "promoted_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", application_id).execute()

        return {
            "success": True,
            "is_free": is_order_member,
            "message": "Application promoted successfully" + (" (free for Order members)" if is_order_member else ""),
            "application": result.data[0] if result.data else None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error promoting application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collab-applications/{application_id}")
async def get_collab_application(
    application_id: str,
    authorization: str = Header(None)
):
    """Get a single collab application"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        result = client.table("community_collab_applications").select(
            "*, collab:community_collabs(id, title, type, user_id)"
        ).eq("id", application_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Application not found")

        application = result.data
        collab = application.get("collab")

        # User can view if they're the applicant or the collab owner
        is_applicant = application.get("applicant_user_id") == user_id
        is_owner = collab and collab.get("user_id") == user_id

        if not is_applicant and not is_owner:
            raise HTTPException(status_code=403, detail="You don't have access to this application")

        # Fetch selected credits if any
        if application.get("selected_credit_ids"):
            credits_result = client.table("credits").select(
                "id, project_title, role, role_type, year, department"
            ).in_("id", application["selected_credit_ids"]).execute()
            application["selected_credits"] = credits_result.data or []

        # Fetch current profile
        if application.get("applicant_user_id"):
            profile_result = client.table("profiles").select(
                "id, username, full_name, display_name, avatar_url, role, is_order_member"
            ).eq("id", application["applicant_user_id"]).single().execute()
            application["current_profile"] = profile_result.data

        return application

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting collab application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/collab-applications/{application_id}")
async def withdraw_application(
    application_id: str,
    authorization: str = Header(None)
):
    """Withdraw/delete a collab application (applicant only)"""
    user = await get_current_user_from_token(authorization)
    user_id = user["id"]
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("community_collab_applications").select("id").eq(
            "id", application_id
        ).eq("applicant_user_id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Application not found")

        client.table("community_collab_applications").delete().eq("id", application_id).execute()

        return {"success": True, "message": "Application withdrawn"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error withdrawing application: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# CONTENT REPORTS (PUBLIC)
# =====================================================

class ContentReportRequest(BaseModel):
    content_type: str  # 'thread', 'reply'
    content_id: str
    reason: str  # 'spam', 'harassment', 'inappropriate', 'copyright', 'other'
    details: Optional[str] = None


@router.post("/reports")
async def submit_content_report(
    report: ContentReportRequest,
    authorization: str = Header(None)
):
    """Submit a content report (authenticated users only)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Validate content type
    valid_content_types = ['thread', 'reply']
    if report.content_type not in valid_content_types:
        raise HTTPException(status_code=400, detail=f"Invalid content_type. Must be one of: {valid_content_types}")

    # Validate reason
    valid_reasons = ['spam', 'harassment', 'inappropriate', 'copyright', 'other']
    if report.reason not in valid_reasons:
        raise HTTPException(status_code=400, detail=f"Invalid reason. Must be one of: {valid_reasons}")

    try:
        # Validate content exists
        if report.content_type == 'thread':
            content = client.table("community_topic_threads").select("id, user_id").eq("id", report.content_id).execute()
        else:
            content = client.table("community_topic_replies").select("id, user_id").eq("id", report.content_id).execute()

        if not content.data:
            raise HTTPException(status_code=404, detail="Content not found")

        # Prevent self-reporting
        content_author = content.data[0].get("user_id")
        if content_author == user["id"]:
            raise HTTPException(status_code=400, detail="You cannot report your own content")

        # Check for duplicate reports from same user
        existing = client.table("content_reports").select("id").eq(
            "reporter_id", user["id"]
        ).eq("content_type", report.content_type).eq(
            "content_id", report.content_id
        ).eq("status", "pending").execute()

        if existing.data:
            raise HTTPException(status_code=400, detail="You have already reported this content")

        # Create report
        result = client.table("content_reports").insert({
            "reporter_id": user["id"],
            "content_type": report.content_type,
            "content_id": report.content_id,
            "reason": report.reason,
            "details": report.details,
            "status": "pending"
        }).execute()

        return {
            "success": True,
            "message": "Report submitted. Thank you for helping keep our community safe.",
            "report_id": result.data[0]["id"] if result.data else None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting content report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# FORUM BAN STATUS (PUBLIC)
# =====================================================

@router.get("/user-forum-status")
async def get_user_forum_status(authorization: str = Header(None)):
    """Get current user's forum ban status"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Check profile for cached ban status (faster)
        profile = client.table("profiles").select(
            "forum_ban_type, forum_ban_until, forum_ban_reason"
        ).eq("id", user["id"]).single().execute()

        if not profile.data or not profile.data.get("forum_ban_type"):
            return {
                "banned": False,
                "restriction_type": None,
                "reason": None,
                "expires_at": None
            }

        # Check if expired
        ban_until = profile.data.get("forum_ban_until")
        if ban_until:
            from datetime import timezone
            expires = datetime.fromisoformat(str(ban_until).replace("Z", "+00:00"))
            if expires < datetime.now(timezone.utc):
                # Ban has expired - clear the cache
                client.table("profiles").update({
                    "forum_ban_type": None,
                    "forum_ban_until": None,
                    "forum_ban_reason": None
                }).eq("id", user["id"]).execute()

                # Also mark the ban as inactive
                client.table("forum_bans").update({
                    "is_active": False
                }).eq("user_id", user["id"]).eq("is_active", True).execute()

                return {
                    "banned": False,
                    "restriction_type": None,
                    "reason": None,
                    "expires_at": None
                }

        return {
            "banned": True,
            "restriction_type": profile.data.get("forum_ban_type"),
            "reason": profile.data.get("forum_ban_reason"),
            "expires_at": profile.data.get("forum_ban_until")
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error checking forum ban status: {e}")
        # Don't block access on error - fail open
        return {
            "banned": False,
            "restriction_type": None,
            "reason": None,
            "expires_at": None
        }


# =====================================================
# COMMUNITY FEED - SCHEMAS
# =====================================================

class PostImageInput(BaseModel):
    url: str
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class PostCreateInput(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    images: Optional[List[PostImageInput]] = None
    link_url: Optional[str] = None
    link_title: Optional[str] = None
    link_description: Optional[str] = None
    link_image: Optional[str] = None
    link_site_name: Optional[str] = None
    visibility: str = Field(default="public", pattern="^(public|connections)$")


class PostUpdateInput(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=5000)
    visibility: Optional[str] = Field(None, pattern="^(public|connections)$")


class CommentCreateInput(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_comment_id: Optional[str] = None


class CommentUpdateInput(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class LinkPreviewInput(BaseModel):
    url: str


# =====================================================
# COMMUNITY FEED - HELPER FUNCTIONS
# =====================================================

async def get_user_connections(user_id: str) -> List[str]:
    """Get list of user IDs that the given user is connected with"""
    client = get_client()

    # Get accepted connections where user is either requester or recipient
    result = client.table("connections").select(
        "requester_id, recipient_id"
    ).eq("status", "accepted").or_(
        f"requester_id.eq.{user_id},recipient_id.eq.{user_id}"
    ).execute()

    connection_ids = set()
    for conn in (result.data or []):
        if conn["requester_id"] == user_id:
            connection_ids.add(conn["recipient_id"])
        else:
            connection_ids.add(conn["requester_id"])

    return list(connection_ids)


async def enrich_posts_with_profiles(posts: List[Dict], current_user_id: Optional[str] = None) -> List[Dict]:
    """Add author profiles and like status to posts"""
    if not posts:
        return []

    client = get_client()

    # Get unique user IDs
    user_ids = list(set(p["user_id"] for p in posts))

    # Fetch profiles
    profiles_result = client.table("profiles").select(
        "id, username, full_name, display_name, avatar_url, role, is_order_member"
    ).in_("id", user_ids).execute()

    profiles_map = {p["id"]: p for p in (profiles_result.data or [])}

    # Check which posts current user has liked
    liked_post_ids = set()
    if current_user_id:
        post_ids = [p["id"] for p in posts]
        likes_result = client.table("community_post_likes").select(
            "post_id"
        ).eq("user_id", current_user_id).in_("post_id", post_ids).execute()
        liked_post_ids = set(l["post_id"] for l in (likes_result.data or []))

    # Enrich posts
    for post in posts:
        post["author"] = profiles_map.get(post["user_id"])
        post["is_liked"] = post["id"] in liked_post_ids

    return posts


async def enrich_comments_with_profiles(comments: List[Dict]) -> List[Dict]:
    """Add author profiles to comments"""
    if not comments:
        return []

    client = get_client()

    # Get unique user IDs
    user_ids = list(set(c["user_id"] for c in comments))

    # Fetch profiles
    profiles_result = client.table("profiles").select(
        "id, username, full_name, display_name, avatar_url, is_order_member"
    ).in_("id", user_ids).execute()

    profiles_map = {p["id"]: p for p in (profiles_result.data or [])}

    # Enrich comments
    for comment in comments:
        comment["author"] = profiles_map.get(comment["user_id"])

    return comments


# =====================================================
# COMMUNITY FEED - PUBLIC FEED
# =====================================================

@router.get("/feed/public")
async def list_public_feed(
    limit: int = Query(20, le=50),
    before: Optional[str] = None,
    authorization: str = Header(None)
):
    """List public posts with cursor pagination"""
    client = get_client()

    # Get current user if authenticated (for like status)
    current_user_id = None
    if authorization:
        try:
            user = await get_current_user_from_token(authorization)
            current_user_id = user["id"]
        except:
            pass

    try:
        query = client.table("community_posts").select("*").eq(
            "visibility", "public"
        ).eq("is_hidden", False).order("created_at", desc=True).limit(limit)

        if before:
            query = query.lt("created_at", before)

        result = query.execute()
        posts = result.data or []

        # Enrich with profiles and like status
        posts = await enrich_posts_with_profiles(posts, current_user_id)

        return {
            "posts": posts,
            "next_cursor": posts[-1]["created_at"] if posts else None
        }

    except Exception as e:
        print(f"Error fetching public feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COMMUNITY FEED - CONNECTIONS FEED
# =====================================================

@router.get("/feed/connections")
async def list_connections_feed(
    limit: int = Query(20, le=50),
    before: Optional[str] = None,
    authorization: str = Header(None)
):
    """List posts from user's connections"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Get connection IDs
        connection_ids = await get_user_connections(user["id"])

        if not connection_ids:
            return {"posts": [], "next_cursor": None}

        # Query posts from connections (both public and connections-only visibility)
        query = client.table("community_posts").select("*").in_(
            "user_id", connection_ids
        ).eq("is_hidden", False).order("created_at", desc=True).limit(limit)

        if before:
            query = query.lt("created_at", before)

        result = query.execute()
        posts = result.data or []

        # Enrich with profiles and like status
        posts = await enrich_posts_with_profiles(posts, user["id"])

        return {
            "posts": posts,
            "next_cursor": posts[-1]["created_at"] if posts else None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching connections feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COMMUNITY FEED - POST CRUD
# =====================================================

@router.post("/posts")
async def create_post(
    data: PostCreateInput,
    authorization: str = Header(None)
):
    """Create a new community post"""
    user = await get_current_user_from_token(authorization)

    # Check permission
    await require_permission(user["id"], "community_feed_post")

    client = get_client()

    try:
        post_data = {
            "user_id": user["id"],
            "content": data.content,
            "images": [img.dict() for img in data.images] if data.images else [],
            "visibility": data.visibility,
        }

        # Add link preview if provided
        if data.link_url:
            post_data["link_url"] = data.link_url
            post_data["link_title"] = data.link_title
            post_data["link_description"] = data.link_description
            post_data["link_image"] = data.link_image
            post_data["link_site_name"] = data.link_site_name

        result = client.table("community_posts").insert(post_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create post")

        post = result.data[0]

        # Fetch author profile
        posts = await enrich_posts_with_profiles([post], user["id"])

        return posts[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/posts/{post_id}")
async def get_post(
    post_id: str,
    authorization: str = Header(None)
):
    """Get a single post by ID"""
    client = get_client()

    # Get current user if authenticated
    current_user_id = None
    if authorization:
        try:
            user = await get_current_user_from_token(authorization)
            current_user_id = user["id"]
        except:
            pass

    try:
        result = client.table("community_posts").select("*").eq(
            "id", post_id
        ).eq("is_hidden", False).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Post not found")

        post = result.data

        # Check visibility permissions
        if post["visibility"] == "connections" and current_user_id:
            # Check if viewer is connected to author
            if current_user_id != post["user_id"]:
                connection_ids = await get_user_connections(current_user_id)
                if post["user_id"] not in connection_ids:
                    raise HTTPException(status_code=403, detail="Post not accessible")
        elif post["visibility"] == "connections" and not current_user_id:
            raise HTTPException(status_code=403, detail="Post not accessible")

        # Enrich with profile and like status
        posts = await enrich_posts_with_profiles([post], current_user_id)

        return posts[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/posts/{post_id}")
async def update_post(
    post_id: str,
    data: PostUpdateInput,
    authorization: str = Header(None)
):
    """Update a post (owner only)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("community_posts").select("user_id").eq(
            "id", post_id
        ).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Post not found")

        if existing.data["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to update this post")

        # Build update data
        update_data = {}
        if data.content is not None:
            update_data["content"] = data.content
        if data.visibility is not None:
            update_data["visibility"] = data.visibility

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = client.table("community_posts").update(update_data).eq(
            "id", post_id
        ).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update post")

        # Return updated post with profile
        posts = await enrich_posts_with_profiles(result.data, user["id"])

        return posts[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    authorization: str = Header(None)
):
    """Delete a post (owner only)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("community_posts").select("user_id").eq(
            "id", post_id
        ).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Post not found")

        if existing.data["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this post")

        # Delete post (cascade will handle likes and comments)
        client.table("community_posts").delete().eq("id", post_id).execute()

        return {"success": True, "message": "Post deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COMMUNITY FEED - LIKES
# =====================================================

@router.post("/posts/{post_id}/like")
async def like_post(
    post_id: str,
    authorization: str = Header(None)
):
    """Like a post"""
    user = await get_current_user_from_token(authorization)

    # Check permission
    await require_permission(user["id"], "community_feed_like")

    client = get_client()

    try:
        # Check post exists and is accessible
        post = client.table("community_posts").select("id, visibility, user_id").eq(
            "id", post_id
        ).eq("is_hidden", False).single().execute()

        if not post.data:
            raise HTTPException(status_code=404, detail="Post not found")

        # Check visibility permissions for connections-only posts
        if post.data["visibility"] == "connections" and post.data["user_id"] != user["id"]:
            connection_ids = await get_user_connections(user["id"])
            if post.data["user_id"] not in connection_ids:
                raise HTTPException(status_code=403, detail="Post not accessible")

        # Create like (unique constraint will prevent duplicates)
        client.table("community_post_likes").insert({
            "post_id": post_id,
            "user_id": user["id"]
        }).execute()

        return {"success": True, "message": "Post liked"}

    except HTTPException:
        raise
    except Exception as e:
        # Handle duplicate like gracefully
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return {"success": True, "message": "Already liked"}
        print(f"Error liking post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/posts/{post_id}/unlike")
async def unlike_post(
    post_id: str,
    authorization: str = Header(None)
):
    """Unlike a post"""
    user = await get_current_user_from_token(authorization)

    # Check permission
    await require_permission(user["id"], "community_feed_like")

    client = get_client()

    try:
        client.table("community_post_likes").delete().eq(
            "post_id", post_id
        ).eq("user_id", user["id"]).execute()

        return {"success": True, "message": "Post unliked"}

    except Exception as e:
        print(f"Error unliking post: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COMMUNITY FEED - COMMENTS
# =====================================================

@router.get("/posts/{post_id}/comments")
async def list_post_comments(
    post_id: str,
    authorization: str = Header(None)
):
    """List comments on a post"""
    client = get_client()

    # Get current user if authenticated
    current_user_id = None
    if authorization:
        try:
            user = await get_current_user_from_token(authorization)
            current_user_id = user["id"]
        except:
            pass

    try:
        # Verify post exists and check visibility
        post = client.table("community_posts").select("visibility, user_id").eq(
            "id", post_id
        ).eq("is_hidden", False).single().execute()

        if not post.data:
            raise HTTPException(status_code=404, detail="Post not found")

        # Check visibility permissions
        if post.data["visibility"] == "connections":
            if not current_user_id:
                raise HTTPException(status_code=403, detail="Post not accessible")
            if current_user_id != post.data["user_id"]:
                connection_ids = await get_user_connections(current_user_id)
                if post.data["user_id"] not in connection_ids:
                    raise HTTPException(status_code=403, detail="Post not accessible")

        # Fetch comments
        result = client.table("community_post_comments").select("*").eq(
            "post_id", post_id
        ).eq("is_hidden", False).order("created_at", desc=False).execute()

        comments = result.data or []

        # Enrich with profiles
        comments = await enrich_comments_with_profiles(comments)

        return comments

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching comments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/posts/{post_id}/comments")
async def create_post_comment(
    post_id: str,
    data: CommentCreateInput,
    authorization: str = Header(None)
):
    """Add a comment to a post"""
    user = await get_current_user_from_token(authorization)

    # Check permission
    await require_permission(user["id"], "community_feed_comment")

    client = get_client()

    try:
        # Verify post exists and check visibility
        post = client.table("community_posts").select("visibility, user_id").eq(
            "id", post_id
        ).eq("is_hidden", False).single().execute()

        if not post.data:
            raise HTTPException(status_code=404, detail="Post not found")

        # Check visibility permissions
        if post.data["visibility"] == "connections" and post.data["user_id"] != user["id"]:
            connection_ids = await get_user_connections(user["id"])
            if post.data["user_id"] not in connection_ids:
                raise HTTPException(status_code=403, detail="Post not accessible")

        # Validate parent comment if provided
        if data.parent_comment_id:
            parent = client.table("community_post_comments").select("id").eq(
                "id", data.parent_comment_id
            ).eq("post_id", post_id).single().execute()

            if not parent.data:
                raise HTTPException(status_code=400, detail="Parent comment not found")

        # Create comment
        comment_data = {
            "post_id": post_id,
            "user_id": user["id"],
            "content": data.content,
        }

        if data.parent_comment_id:
            comment_data["parent_comment_id"] = data.parent_comment_id

        result = client.table("community_post_comments").insert(comment_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create comment")

        # Enrich with profile
        comments = await enrich_comments_with_profiles(result.data)

        return comments[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/comments/{comment_id}")
async def update_comment(
    comment_id: str,
    data: CommentUpdateInput,
    authorization: str = Header(None)
):
    """Update a comment (owner only)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("community_post_comments").select("user_id").eq(
            "id", comment_id
        ).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Comment not found")

        if existing.data["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to update this comment")

        result = client.table("community_post_comments").update({
            "content": data.content
        }).eq("id", comment_id).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update comment")

        # Enrich with profile
        comments = await enrich_comments_with_profiles(result.data)

        return comments[0]

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    authorization: str = Header(None)
):
    """Delete a comment (owner only)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    try:
        # Verify ownership
        existing = client.table("community_post_comments").select("user_id").eq(
            "id", comment_id
        ).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Comment not found")

        if existing.data["user_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

        client.table("community_post_comments").delete().eq("id", comment_id).execute()

        return {"success": True, "message": "Comment deleted"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting comment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# COMMUNITY FEED - LINK PREVIEW
# =====================================================

@router.post("/posts/link-preview")
async def fetch_link_preview(
    data: LinkPreviewInput,
    authorization: str = Header(None)
):
    """Fetch Open Graph metadata for a URL"""
    await get_current_user_from_token(authorization)

    try:
        import httpx
        from bs4 import BeautifulSoup

        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(data.url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; SecondWatchNetwork/1.0)"
            })

            if response.status_code != 200:
                return {"error": "Failed to fetch URL"}

            soup = BeautifulSoup(response.text, "html.parser")

            # Extract Open Graph metadata
            def get_meta(property_name: str) -> Optional[str]:
                tag = soup.find("meta", property=property_name) or soup.find("meta", attrs={"name": property_name})
                return tag.get("content") if tag else None

            title = get_meta("og:title") or soup.title.string if soup.title else None
            description = get_meta("og:description") or get_meta("description")
            image = get_meta("og:image")
            site_name = get_meta("og:site_name")

            return {
                "url": data.url,
                "title": title,
                "description": description,
                "image": image,
                "site_name": site_name
            }

    except Exception as e:
        print(f"Error fetching link preview: {e}")
        return {"error": "Failed to fetch link preview"}


# =====================================================
# USER DIRECTORY - THE NETWORK TAB
# =====================================================

class DirectoryUserResponse(BaseModel):
    """User data for directory listing"""
    id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    is_order_member: bool = False
    is_partner: bool = False
    connection_status: str = "none"  # none, pending_sent, pending_received, connected


class DirectoryResponse(BaseModel):
    """Paginated directory response"""
    users: List[DirectoryUserResponse]
    total: int
    page: int
    pages: int


@router.get("/users/directory", response_model=DirectoryResponse)
async def get_user_directory(
    search: Optional[str] = Query(None, description="Search by name or username"),
    role: Optional[str] = Query(None, description="Filter by role (filmmaker, editor, actor, etc.)"),
    is_order_member: Optional[bool] = Query(None, description="Filter by Order membership"),
    is_partner: Optional[bool] = Query(None, description="Filter by partner status"),
    location: Optional[str] = Query(None, description="Filter by location"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    authorization: str = Header(None)
):
    """
    Get paginated list of all users on the platform for The Network tab.

    Returns users with their connection status relative to the current user:
    - 'none': No connection
    - 'pending_sent': Current user sent a request
    - 'pending_received': Current user received a request
    - 'connected': Already connected
    """
    user = await get_current_user_from_token(authorization)
    current_user_id = user["id"]
    client = get_client()

    try:
        # Build base query for profiles with filmmaker_profiles join for location
        query = client.table("profiles").select(
            "id, username, full_name, display_name, avatar_url, role, "
            "is_order_member, is_partner, filmmaker_profile:filmmaker_profiles(location)"
        ).neq("id", current_user_id)  # Exclude current user

        # Apply search filter
        if search and search.strip():
            search_term = search.strip()
            query = query.or_(
                f"full_name.ilike.%{search_term}%,username.ilike.%{search_term}%,display_name.ilike.%{search_term}%"
            )

        # Apply role filter
        if role:
            query = query.eq("role", role)

        # Apply Order member filter
        if is_order_member is not None:
            query = query.eq("is_order_member", is_order_member)

        # Apply partner filter
        if is_partner is not None:
            query = query.eq("is_partner", is_partner)

        # Note: Location filter requires post-query filtering since it's in filmmaker_profiles
        # We'll handle this after fetching the data

        # Get total count first (without location filter for now)
        count_query = client.table("profiles").select("id", count="exact").neq("id", current_user_id)
        if search and search.strip():
            search_term = search.strip()
            count_query = count_query.or_(
                f"full_name.ilike.%{search_term}%,username.ilike.%{search_term}%,display_name.ilike.%{search_term}%"
            )
        if role:
            count_query = count_query.eq("role", role)
        if is_order_member is not None:
            count_query = count_query.eq("is_order_member", is_order_member)
        if is_partner is not None:
            count_query = count_query.eq("is_partner", is_partner)

        count_result = count_query.execute()
        total = count_result.count if hasattr(count_result, 'count') and count_result.count else len(count_result.data or [])

        # Apply pagination and ordering
        offset = (page - 1) * limit
        query = query.order("full_name", desc=False).range(offset, offset + limit - 1)

        result = query.execute()
        profiles = result.data or []

        if not profiles:
            return DirectoryResponse(
                users=[],
                total=total,
                page=page,
                pages=max(1, (total + limit - 1) // limit)
            )

        # Get connection statuses for all returned profiles
        profile_ids = [p["id"] for p in profiles]

        # Query connections where current user is requester
        sent_connections = client.table("connections").select(
            "recipient_id, status"
        ).eq("requester_id", current_user_id).in_("recipient_id", profile_ids).execute()

        # Query connections where current user is recipient
        received_connections = client.table("connections").select(
            "requester_id, status"
        ).eq("recipient_id", current_user_id).in_("requester_id", profile_ids).execute()

        # Build connection status map
        connection_map: Dict[str, str] = {}

        for conn in (sent_connections.data or []):
            user_id = conn["recipient_id"]
            if conn["status"] == "accepted":
                connection_map[user_id] = "connected"
            elif conn["status"] == "pending":
                connection_map[user_id] = "pending_sent"

        for conn in (received_connections.data or []):
            user_id = conn["requester_id"]
            if conn["status"] == "accepted":
                connection_map[user_id] = "connected"
            elif conn["status"] == "pending":
                # Only set to pending_received if not already connected
                if user_id not in connection_map or connection_map[user_id] != "connected":
                    connection_map[user_id] = "pending_received"

        # Build response - extract location from filmmaker_profile join
        users = []
        for profile in profiles:
            # Extract location from filmmaker_profile join
            filmmaker_profile = profile.get("filmmaker_profile")
            profile_location = None
            if filmmaker_profile:
                # Could be a dict or list depending on the join
                if isinstance(filmmaker_profile, dict):
                    profile_location = filmmaker_profile.get("location")
                elif isinstance(filmmaker_profile, list) and len(filmmaker_profile) > 0:
                    profile_location = filmmaker_profile[0].get("location")

            # Apply location filter (post-query filtering)
            if location and location.strip():
                if not profile_location or location.strip().lower() not in profile_location.lower():
                    continue

            users.append(DirectoryUserResponse(
                id=profile["id"],
                username=profile.get("username"),
                full_name=profile.get("full_name"),
                display_name=profile.get("display_name"),
                avatar_url=profile.get("avatar_url"),
                role=profile.get("role"),
                location=profile_location,
                is_order_member=profile.get("is_order_member", False),
                is_partner=profile.get("is_partner", False),
                connection_status=connection_map.get(profile["id"], "none")
            ))

        # Adjust total if location filter was applied
        if location and location.strip():
            total = len(users)

        pages = max(1, (total + limit - 1) // limit)

        return DirectoryResponse(
            users=users,
            total=total,
            page=page,
            pages=pages
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching user directory: {e}")
        raise HTTPException(status_code=500, detail=str(e))
