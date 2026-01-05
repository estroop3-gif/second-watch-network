"""
Community Threads API
Phase 3A: Scoped threaded discussions for Worlds, Lodges, and Craft Houses.

Provides endpoints for:
- Creating and managing discussion threads scoped to Worlds, Lodges, or Craft Houses
- Thread replies and engagement
- Moderation (pin, lock, hide)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class ThreadCreate(BaseModel):
    """Create thread request."""
    title: str = Field(..., min_length=3, max_length=200)
    body: Optional[str] = None
    thread_type: str = Field(default="discussion")
    # Scope - one of these required
    world_id: Optional[str] = None
    lodge_id: Optional[str] = None
    craft_house_id: Optional[str] = None
    # Optional context for world threads
    episode_id: Optional[str] = None
    season_id: Optional[str] = None


class ThreadUpdate(BaseModel):
    """Update thread request."""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    body: Optional[str] = None
    thread_type: Optional[str] = None


class ReplyCreate(BaseModel):
    """Create reply request."""
    body: str = Field(..., min_length=1, max_length=10000)
    parent_reply_id: Optional[str] = None


class ReplyUpdate(BaseModel):
    """Update reply request."""
    body: str = Field(..., min_length=1, max_length=10000)


class ThreadResponse(BaseModel):
    """Thread response."""
    id: str
    scope_type: str
    world_id: Optional[str]
    lodge_id: Optional[str]
    craft_house_id: Optional[str]
    episode_id: Optional[str]
    season_id: Optional[str]
    title: str
    body: Optional[str]
    author_id: str
    thread_type: str
    is_locked: bool
    is_pinned: bool
    is_hidden: bool
    reply_count: int
    view_count: int
    last_reply_at: Optional[str]
    created_at: str
    updated_at: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None


class ReplyResponse(BaseModel):
    """Reply response."""
    id: str
    thread_id: str
    author_id: str
    body: str
    parent_reply_id: Optional[str]
    is_hidden: bool
    like_count: int
    created_at: str
    updated_at: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(current_user: dict) -> str:
    """Resolve profile ID from Cognito user."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_id = :cognito_id",
        {"cognito_id": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile["id"]


async def check_thread_access(
    scope_type: str,
    scope_id: str,
    profile_id: str,
    action: str = "read"
) -> bool:
    """
    Check if user has access to a thread scope.

    Args:
        scope_type: 'world', 'lodge', or 'craft_house'
        scope_id: The ID of the scope entity
        profile_id: User's profile ID
        action: 'read', 'write', or 'moderate'
    """
    if scope_type == "world":
        # World threads: check if World is accessible
        world = execute_single("""
            SELECT w.id, w.visibility, w.creator_id,
                   COALESCE(wf.user_id IS NOT NULL, false) as is_follower
            FROM worlds w
            LEFT JOIN world_follows wf ON w.id = wf.world_id AND wf.user_id = :profile_id
            WHERE w.id = :scope_id
        """, {"scope_id": scope_id, "profile_id": profile_id})

        if not world:
            return False

        if action == "read":
            # Public worlds readable by all; private only by creator/followers
            if world["visibility"] == "public":
                return True
            return str(world["creator_id"]) == profile_id or world["is_follower"]

        if action == "write":
            # Anyone who can read can write (post threads/replies)
            return await check_thread_access(scope_type, scope_id, profile_id, "read")

        if action == "moderate":
            # Only World creator can moderate
            return str(world["creator_id"]) == profile_id

    elif scope_type == "lodge":
        # Lodge threads: check lodge membership
        membership = execute_single("""
            SELECT olm.id, olm.status, olm.is_officer
            FROM order_lodge_memberships olm
            WHERE olm.lodge_id = :scope_id
              AND olm.user_id = :profile_id
              AND olm.status = 'active'
        """, {"scope_id": scope_id, "profile_id": profile_id})

        if action == "read":
            # Lodge members can read
            return membership is not None

        if action == "write":
            # Lodge members can write
            return membership is not None

        if action == "moderate":
            # Only lodge officers can moderate
            return membership is not None and membership.get("is_officer")

    elif scope_type == "craft_house":
        # Craft house threads: check Order membership (all Order members can access)
        order_member = execute_single("""
            SELECT omp.user_id, ochm.craft_house_id, ochm.role
            FROM order_member_profiles omp
            LEFT JOIN order_craft_house_memberships ochm ON omp.user_id = ochm.user_id
            WHERE omp.user_id = :profile_id
              AND omp.status IN ('active', 'probationary')
        """, {"profile_id": profile_id})

        if not order_member:
            return False

        if action in ("read", "write"):
            # All Order members can read/write craft house threads
            return True

        if action == "moderate":
            # Only craft house stewards/members can moderate
            if order_member.get("craft_house_id") == scope_id:
                return order_member.get("role") in ("steward", "member")
            return False

    return False


def determine_scope(data: ThreadCreate) -> tuple:
    """Determine scope_type and scope_id from request data."""
    if data.world_id:
        return ("world", data.world_id)
    elif data.lodge_id:
        return ("lodge", data.lodge_id)
    elif data.craft_house_id:
        return ("craft_house", data.craft_house_id)
    else:
        raise HTTPException(
            status_code=400,
            detail="Thread must be scoped to a world_id, lodge_id, or craft_house_id"
        )


# =============================================================================
# Thread Endpoints
# =============================================================================

@router.get("/threads", response_model=List[ThreadResponse])
async def list_threads(
    scope_type: str = Query(..., pattern="^(world|lodge|craft_house)$"),
    scope_id: str = Query(...),
    thread_type: Optional[str] = Query(None),
    pinned_only: bool = Query(False),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List threads for a given scope (World, Lodge, or Craft House)."""
    profile_id = await get_profile_id(current_user)

    # Check access
    has_access = await check_thread_access(scope_type, scope_id, profile_id, "read")
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied to this discussion area")

    # Build query
    conditions = ["t.scope_type = :scope_type", "t.is_hidden = false"]
    params = {
        "scope_type": scope_type,
        "limit": limit,
        "offset": offset
    }

    if scope_type == "world":
        conditions.append("t.world_id = :scope_id")
    elif scope_type == "lodge":
        conditions.append("t.lodge_id = :scope_id")
    elif scope_type == "craft_house":
        conditions.append("t.craft_house_id = :scope_id")
    params["scope_id"] = scope_id

    if thread_type:
        conditions.append("t.thread_type = :thread_type")
        params["thread_type"] = thread_type

    if pinned_only:
        conditions.append("t.is_pinned = true")

    threads = execute_query(f"""
        SELECT
            t.*,
            p.display_name as author_name,
            p.avatar_url as author_avatar
        FROM community_threads t
        JOIN profiles p ON t.author_id = p.id
        WHERE {' AND '.join(conditions)}
        ORDER BY t.is_pinned DESC, t.last_reply_at DESC NULLS LAST, t.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(t) for t in threads]


@router.get("/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific thread with author info."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single("""
        SELECT
            t.*,
            p.display_name as author_name,
            p.avatar_url as author_avatar
        FROM community_threads t
        JOIN profiles p ON t.author_id = p.id
        WHERE t.id = :thread_id
    """, {"thread_id": thread_id})

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if thread["is_hidden"]:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Check access
    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    has_access = await check_thread_access(thread["scope_type"], scope_id, profile_id, "read")
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    # Increment view count
    execute_update(
        "UPDATE community_threads SET view_count = view_count + 1 WHERE id = :id",
        {"id": thread_id}
    )

    return dict(thread)


@router.post("/threads", response_model=ThreadResponse, status_code=201)
async def create_thread(
    data: ThreadCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new discussion thread."""
    profile_id = await get_profile_id(current_user)

    scope_type, scope_id = determine_scope(data)

    # Check write access
    has_access = await check_thread_access(scope_type, scope_id, profile_id, "write")
    if not has_access:
        raise HTTPException(status_code=403, detail="Cannot create threads in this area")

    thread = execute_insert("""
        INSERT INTO community_threads (
            scope_type, world_id, lodge_id, craft_house_id,
            episode_id, season_id, title, body, author_id, thread_type
        ) VALUES (
            :scope_type, :world_id, :lodge_id, :craft_house_id,
            :episode_id, :season_id, :title, :body, :author_id, :thread_type
        )
        RETURNING *
    """, {
        "scope_type": scope_type,
        "world_id": data.world_id,
        "lodge_id": data.lodge_id,
        "craft_house_id": data.craft_house_id,
        "episode_id": data.episode_id,
        "season_id": data.season_id,
        "title": data.title,
        "body": data.body,
        "author_id": profile_id,
        "thread_type": data.thread_type
    })

    logger.info("thread_created", thread_id=thread["id"], scope_type=scope_type)

    # Get author info for response
    author = execute_single(
        "SELECT display_name, avatar_url FROM profiles WHERE id = :id",
        {"id": profile_id}
    )

    result = dict(thread)
    result["author_name"] = author["display_name"] if author else None
    result["author_avatar"] = author["avatar_url"] if author else None

    return result


@router.put("/threads/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: str,
    data: ThreadUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a thread (author only)."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Only author can update
    if str(thread["author_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Only the author can update this thread")

    if thread["is_locked"]:
        raise HTTPException(status_code=400, detail="Thread is locked")

    updates = data.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    set_clauses = [f"{k} = :{k}" for k in updates.keys()]
    set_clauses.append("updated_at = NOW()")
    updates["id"] = thread_id

    result = execute_single(f"""
        UPDATE community_threads
        SET {', '.join(set_clauses)}
        WHERE id = :id
        RETURNING *
    """, updates)

    return dict(result)


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a thread (author or moderator)."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    is_author = str(thread["author_id"]) == profile_id
    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    is_moderator = await check_thread_access(thread["scope_type"], scope_id, profile_id, "moderate")

    if not is_author and not is_moderator:
        raise HTTPException(status_code=403, detail="Permission denied")

    execute_single(
        "DELETE FROM community_threads WHERE id = :id RETURNING id",
        {"id": thread_id}
    )


# =============================================================================
# Thread Moderation
# =============================================================================

@router.post("/threads/{thread_id}/pin")
async def pin_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pin a thread (moderator only)."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    is_moderator = await check_thread_access(thread["scope_type"], scope_id, profile_id, "moderate")

    if not is_moderator:
        raise HTTPException(status_code=403, detail="Only moderators can pin threads")

    execute_update("""
        UPDATE community_threads
        SET is_pinned = true, pinned_by = :by, pinned_at = NOW()
        WHERE id = :id
    """, {"id": thread_id, "by": profile_id})

    return {"status": "pinned"}


@router.post("/threads/{thread_id}/unpin")
async def unpin_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unpin a thread (moderator only)."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    is_moderator = await check_thread_access(thread["scope_type"], scope_id, profile_id, "moderate")

    if not is_moderator:
        raise HTTPException(status_code=403, detail="Only moderators can unpin threads")

    execute_update("""
        UPDATE community_threads
        SET is_pinned = false, pinned_by = NULL, pinned_at = NULL
        WHERE id = :id
    """, {"id": thread_id})

    return {"status": "unpinned"}


@router.post("/threads/{thread_id}/lock")
async def lock_thread(
    thread_id: str,
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Lock a thread (moderator only)."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    is_moderator = await check_thread_access(thread["scope_type"], scope_id, profile_id, "moderate")

    if not is_moderator:
        raise HTTPException(status_code=403, detail="Only moderators can lock threads")

    execute_update("""
        UPDATE community_threads
        SET is_locked = true, locked_by = :by, locked_at = NOW(), lock_reason = :reason
        WHERE id = :id
    """, {"id": thread_id, "by": profile_id, "reason": reason})

    return {"status": "locked"}


@router.post("/threads/{thread_id}/unlock")
async def unlock_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unlock a thread (moderator only)."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    is_moderator = await check_thread_access(thread["scope_type"], scope_id, profile_id, "moderate")

    if not is_moderator:
        raise HTTPException(status_code=403, detail="Only moderators can unlock threads")

    execute_update("""
        UPDATE community_threads
        SET is_locked = false, locked_by = NULL, locked_at = NULL, lock_reason = NULL
        WHERE id = :id
    """, {"id": thread_id})

    return {"status": "unlocked"}


# =============================================================================
# Reply Endpoints
# =============================================================================

@router.get("/threads/{thread_id}/replies", response_model=List[ReplyResponse])
async def list_replies(
    thread_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List replies for a thread."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread or thread["is_hidden"]:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Check access
    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    has_access = await check_thread_access(thread["scope_type"], scope_id, profile_id, "read")
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")

    replies = execute_query("""
        SELECT
            r.*,
            p.display_name as author_name,
            p.avatar_url as author_avatar
        FROM community_thread_replies r
        JOIN profiles p ON r.author_id = p.id
        WHERE r.thread_id = :thread_id AND r.is_hidden = false
        ORDER BY r.created_at ASC
        LIMIT :limit OFFSET :offset
    """, {"thread_id": thread_id, "limit": limit, "offset": offset})

    return [dict(r) for r in replies]


@router.post("/threads/{thread_id}/replies", response_model=ReplyResponse, status_code=201)
async def create_reply(
    thread_id: str,
    data: ReplyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a reply to a thread."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT * FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread or thread["is_hidden"]:
        raise HTTPException(status_code=404, detail="Thread not found")

    if thread["is_locked"]:
        raise HTTPException(status_code=400, detail="Thread is locked")

    # Check write access
    scope_id = thread.get("world_id") or thread.get("lodge_id") or thread.get("craft_house_id")
    has_access = await check_thread_access(thread["scope_type"], scope_id, profile_id, "write")
    if not has_access:
        raise HTTPException(status_code=403, detail="Cannot reply in this area")

    # Validate parent reply if provided
    if data.parent_reply_id:
        parent = execute_single(
            "SELECT id FROM community_thread_replies WHERE id = :id AND thread_id = :thread_id",
            {"id": data.parent_reply_id, "thread_id": thread_id}
        )
        if not parent:
            raise HTTPException(status_code=400, detail="Parent reply not found")

    reply = execute_insert("""
        INSERT INTO community_thread_replies (thread_id, author_id, body, parent_reply_id)
        VALUES (:thread_id, :author_id, :body, :parent_reply_id)
        RETURNING *
    """, {
        "thread_id": thread_id,
        "author_id": profile_id,
        "body": data.body,
        "parent_reply_id": data.parent_reply_id
    })

    logger.info("reply_created", reply_id=reply["id"], thread_id=thread_id)

    # Get author info
    author = execute_single(
        "SELECT display_name, avatar_url FROM profiles WHERE id = :id",
        {"id": profile_id}
    )

    result = dict(reply)
    result["author_name"] = author["display_name"] if author else None
    result["author_avatar"] = author["avatar_url"] if author else None

    return result


@router.put("/replies/{reply_id}", response_model=ReplyResponse)
async def update_reply(
    reply_id: str,
    data: ReplyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a reply (author only)."""
    profile_id = await get_profile_id(current_user)

    reply = execute_single(
        "SELECT * FROM community_thread_replies WHERE id = :id",
        {"id": reply_id}
    )

    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    if str(reply["author_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Only the author can update this reply")

    result = execute_single("""
        UPDATE community_thread_replies
        SET body = :body, updated_at = NOW()
        WHERE id = :id
        RETURNING *
    """, {"id": reply_id, "body": data.body})

    return dict(result)


@router.delete("/replies/{reply_id}", status_code=204)
async def delete_reply(
    reply_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a reply (author or moderator)."""
    profile_id = await get_profile_id(current_user)

    reply = execute_single("""
        SELECT r.*, t.scope_type, t.world_id, t.lodge_id, t.craft_house_id
        FROM community_thread_replies r
        JOIN community_threads t ON r.thread_id = t.id
        WHERE r.id = :id
    """, {"id": reply_id})

    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    is_author = str(reply["author_id"]) == profile_id
    scope_id = reply.get("world_id") or reply.get("lodge_id") or reply.get("craft_house_id")
    is_moderator = await check_thread_access(reply["scope_type"], scope_id, profile_id, "moderate")

    if not is_author and not is_moderator:
        raise HTTPException(status_code=403, detail="Permission denied")

    execute_single(
        "DELETE FROM community_thread_replies WHERE id = :id RETURNING id",
        {"id": reply_id}
    )


@router.post("/replies/{reply_id}/like")
async def like_reply(
    reply_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Like a reply."""
    profile_id = await get_profile_id(current_user)

    reply = execute_single(
        "SELECT thread_id FROM community_thread_replies WHERE id = :id",
        {"id": reply_id}
    )

    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")

    # Check if already liked
    existing = execute_single(
        "SELECT id FROM community_thread_reply_likes WHERE reply_id = :reply_id AND user_id = :user_id",
        {"reply_id": reply_id, "user_id": profile_id}
    )

    if existing:
        return {"status": "already_liked"}

    execute_insert("""
        INSERT INTO community_thread_reply_likes (reply_id, user_id)
        VALUES (:reply_id, :user_id)
    """, {"reply_id": reply_id, "user_id": profile_id})

    return {"status": "liked"}


@router.delete("/replies/{reply_id}/like")
async def unlike_reply(
    reply_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unlike a reply."""
    profile_id = await get_profile_id(current_user)

    execute_single(
        "DELETE FROM community_thread_reply_likes WHERE reply_id = :reply_id AND user_id = :user_id RETURNING id",
        {"reply_id": reply_id, "user_id": profile_id}
    )

    return {"status": "unliked"}


# =============================================================================
# Thread Follow Endpoints
# =============================================================================

@router.post("/threads/{thread_id}/follow")
async def follow_thread(
    thread_id: str,
    notify_replies: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Follow a thread to receive notifications."""
    profile_id = await get_profile_id(current_user)

    thread = execute_single(
        "SELECT id FROM community_threads WHERE id = :id",
        {"id": thread_id}
    )

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    # Check if already following
    existing = execute_single(
        "SELECT id FROM community_thread_follows WHERE thread_id = :thread_id AND user_id = :user_id",
        {"thread_id": thread_id, "user_id": profile_id}
    )

    if existing:
        # Update preferences
        execute_update(
            "UPDATE community_thread_follows SET notify_replies = :notify WHERE id = :id",
            {"id": existing["id"], "notify": notify_replies}
        )
        return {"status": "updated"}

    execute_insert("""
        INSERT INTO community_thread_follows (thread_id, user_id, notify_replies)
        VALUES (:thread_id, :user_id, :notify_replies)
    """, {"thread_id": thread_id, "user_id": profile_id, "notify_replies": notify_replies})

    return {"status": "following"}


@router.delete("/threads/{thread_id}/follow")
async def unfollow_thread(
    thread_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unfollow a thread."""
    profile_id = await get_profile_id(current_user)

    execute_single(
        "DELETE FROM community_thread_follows WHERE thread_id = :thread_id AND user_id = :user_id RETURNING id",
        {"thread_id": thread_id, "user_id": profile_id}
    )

    return {"status": "unfollowed"}
