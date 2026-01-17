"""
Admin Community Management API Routes

Provides admin endpoints for managing:
- Community topics (CRUD + reorder)
- Community threads (list, delete, pin, bulk actions)
- Collabs (feature, deactivate, bulk actions)
- User moderation (warnings, mutes, bans)
- Content reports (review queue)
- Platform broadcasts (announcements)
"""
from fastapi import APIRouter, HTTPException, Header, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from app.core.database import execute_query, execute_single, execute_insert, execute_update, execute_delete
import uuid


router = APIRouter()


# =====================================================
# AUTH HELPERS
# =====================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def require_admin(authorization: str = Header(None)) -> Dict[str, Any]:
    """Require admin access for endpoint"""
    user = await get_current_user_from_token(authorization)

    profile = execute_single(
        "SELECT is_admin, is_superadmin, is_moderator FROM profiles WHERE id = :id",
        {"id": user["id"]}
    )

    if not profile:
        raise HTTPException(status_code=403, detail="Profile not found")

    if not (profile.get("is_admin") or profile.get("is_superadmin") or profile.get("is_moderator")):
        raise HTTPException(status_code=403, detail="Admin access required")

    return {**user, **profile}


# =====================================================
# SCHEMAS
# =====================================================

class TopicCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True


class TopicUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None


class TopicReorder(BaseModel):
    topic_ids: List[str]


class ThreadPin(BaseModel):
    is_pinned: bool


class BulkDeleteRequest(BaseModel):
    ids: List[str]


class FeatureCollabRequest(BaseModel):
    is_featured: bool
    featured_until: Optional[str] = None


class BulkDeactivateRequest(BaseModel):
    collab_ids: List[str]


class ApproveCollabRequest(BaseModel):
    notes: Optional[str] = None


class RejectCollabRequest(BaseModel):
    reason: str


class WarnUserRequest(BaseModel):
    reason: str
    details: Optional[str] = None
    related_content_type: Optional[str] = None
    related_content_id: Optional[str] = None


class MuteUserRequest(BaseModel):
    reason: str
    duration_hours: int = 0  # 0 = permanent
    related_content_type: Optional[str] = None
    related_content_id: Optional[str] = None


class ForumBanRequest(BaseModel):
    restriction_type: str  # 'read_only', 'full_block', 'shadow_restrict'
    reason: str
    details: Optional[str] = None
    duration_hours: int = 0  # 0 = permanent


class ResolveReportRequest(BaseModel):
    resolution_notes: Optional[str] = None
    action_taken: Optional[str] = None


class BroadcastCreate(BaseModel):
    title: str
    message: str
    broadcast_type: str = "info"  # info, warning, urgent, maintenance
    target_audience: str = "all"  # all, filmmakers, partners, order_members, premium
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None


class BroadcastUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    broadcast_type: Optional[str] = None
    target_audience: Optional[str] = None
    is_active: Optional[bool] = None
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None


# =====================================================
# TOPICS ADMIN
# =====================================================

@router.get("/topics")
async def list_topics_admin(authorization: str = Header(None)):
    """List all community topics with thread counts"""
    await require_admin(authorization)

    topics = execute_query("""
        SELECT t.*,
               COALESCE((SELECT COUNT(*) FROM community_topic_threads WHERE topic_id = t.id), 0) as thread_count
        FROM community_topics t
        ORDER BY t.sort_order
    """)

    return topics


@router.post("/topics")
async def create_topic(topic: TopicCreate, authorization: str = Header(None)):
    """Create a new community topic"""
    admin = await require_admin(authorization)

    # Get max sort_order
    max_order_result = execute_single(
        "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM community_topics"
    )
    next_order = (max_order_result["max_order"] + 1) if max_order_result else 0

    result = execute_insert("""
        INSERT INTO community_topics (id, name, slug, description, icon, is_active, sort_order, created_at, updated_at)
        VALUES (:id, :name, :slug, :description, :icon, :is_active, :sort_order, NOW(), NOW())
        RETURNING *
    """, {
        "id": str(uuid.uuid4()),
        "name": topic.name,
        "slug": topic.slug,
        "description": topic.description,
        "icon": topic.icon,
        "is_active": topic.is_active,
        "sort_order": next_order
    })

    # Log action
    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "create_topic",
        "target_type": "topic",
        "target_id": result["id"] if result else None,
        "details": f'{{"name": "{topic.name}"}}'
    })

    return result


@router.put("/topics/{topic_id}")
async def update_topic(topic_id: str, topic: TopicUpdate, authorization: str = Header(None)):
    """Update a community topic"""
    admin = await require_admin(authorization)

    update_fields = []
    params = {"topic_id": topic_id}

    if topic.name is not None:
        update_fields.append("name = :name")
        params["name"] = topic.name
    if topic.slug is not None:
        update_fields.append("slug = :slug")
        params["slug"] = topic.slug
    if topic.description is not None:
        update_fields.append("description = :description")
        params["description"] = topic.description
    if topic.icon is not None:
        update_fields.append("icon = :icon")
        params["icon"] = topic.icon
    if topic.is_active is not None:
        update_fields.append("is_active = :is_active")
        params["is_active"] = topic.is_active

    update_fields.append("updated_at = NOW()")

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = execute_single(f"""
        UPDATE community_topics
        SET {', '.join(update_fields)}
        WHERE id = :topic_id
        RETURNING *
    """, params)

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "update_topic",
        "target_type": "topic",
        "target_id": topic_id,
        "details": "{}"
    })

    return result


@router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str, authorization: str = Header(None)):
    """Delete a community topic"""
    admin = await require_admin(authorization)

    # Check for threads
    thread_count = execute_single(
        "SELECT COUNT(*) as count FROM community_topic_threads WHERE topic_id = :topic_id",
        {"topic_id": topic_id}
    )
    if thread_count and thread_count["count"] > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete topic with {thread_count['count']} threads. Delete threads first.")

    execute_delete(
        "DELETE FROM community_topics WHERE id = :topic_id",
        {"topic_id": topic_id}
    )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "delete_topic",
        "target_type": "topic",
        "target_id": topic_id
    })

    return {"success": True}


@router.post("/topics/reorder")
async def reorder_topics(request: TopicReorder, authorization: str = Header(None)):
    """Reorder community topics"""
    admin = await require_admin(authorization)

    for index, topic_id in enumerate(request.topic_ids):
        execute_update(
            "UPDATE community_topics SET sort_order = :sort_order WHERE id = :topic_id",
            {"sort_order": index, "topic_id": topic_id}
        )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "reorder_topics",
        "target_type": "topic",
        "details": "{}"
    })

    return {"success": True}


# =====================================================
# THREADS ADMIN
# =====================================================

@router.get("/threads")
async def list_threads_admin(
    authorization: str = Header(None),
    skip: int = 0,
    limit: int = 50,
    topic_id: Optional[str] = None,
    search: Optional[str] = None,
    is_pinned: Optional[bool] = None
):
    """List community threads with filters"""
    await require_admin(authorization)

    # Build WHERE clause
    where_clauses = ["1=1"]
    params = {"skip": skip, "limit": limit}

    if topic_id:
        where_clauses.append("t.topic_id = :topic_id")
        params["topic_id"] = topic_id
    if search:
        where_clauses.append("t.title ILIKE :search")
        params["search"] = f"%{search}%"
    if is_pinned is not None:
        where_clauses.append("t.is_pinned = :is_pinned")
        params["is_pinned"] = is_pinned

    where_sql = " AND ".join(where_clauses)

    # Get total count
    count_result = execute_single(f"""
        SELECT COUNT(*) as total FROM community_topic_threads t WHERE {where_sql}
    """, params)
    total = count_result["total"] if count_result else 0

    # Get threads with related data
    threads = execute_query(f"""
        SELECT t.*,
               ct.name as topic_name, ct.slug as topic_slug,
               p.full_name as author_full_name, p.username as author_username, p.avatar_url as author_avatar_url
        FROM community_topic_threads t
        LEFT JOIN community_topics ct ON t.topic_id = ct.id
        LEFT JOIN profiles p ON t.user_id = p.id
        WHERE {where_sql}
        ORDER BY t.created_at DESC
        LIMIT :limit OFFSET :skip
    """, params)

    # Transform to match expected format
    result = []
    for thread in threads:
        result.append({
            "id": thread["id"],
            "title": thread["title"],
            "content": thread.get("content"),
            "topic_id": thread["topic_id"],
            "user_id": thread["user_id"],
            "is_pinned": thread.get("is_pinned", False),
            "is_locked": thread.get("is_locked", False),
            "reply_count": thread.get("reply_count", 0),
            "view_count": thread.get("view_count", 0),
            "created_at": thread["created_at"],
            "updated_at": thread.get("updated_at"),
            "topic": {
                "name": thread["topic_name"],
                "slug": thread["topic_slug"]
            } if thread.get("topic_name") else None,
            "author": {
                "full_name": thread["author_full_name"],
                "username": thread["author_username"],
                "avatar_url": thread["author_avatar_url"]
            } if thread.get("author_username") else None
        })

    return {
        "threads": result,
        "total": total
    }


@router.delete("/threads/{thread_id}")
async def delete_thread_admin(thread_id: str, authorization: str = Header(None)):
    """Delete a community thread"""
    admin = await require_admin(authorization)

    # Get thread info for audit log
    thread = execute_single(
        "SELECT title, user_id FROM community_topic_threads WHERE id = :thread_id",
        {"thread_id": thread_id}
    )

    # Delete replies first
    execute_delete(
        "DELETE FROM community_topic_replies WHERE thread_id = :thread_id",
        {"thread_id": thread_id}
    )

    # Delete thread
    execute_delete(
        "DELETE FROM community_topic_threads WHERE id = :thread_id",
        {"thread_id": thread_id}
    )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "delete_thread",
        "target_type": "thread",
        "target_id": thread_id,
        "details": f'{{"title": "{thread.get("title") if thread else ""}"}}'
    })

    return {"success": True}


@router.put("/threads/{thread_id}/pin")
async def pin_thread_admin(thread_id: str, request: ThreadPin, authorization: str = Header(None)):
    """Pin or unpin a community thread"""
    admin = await require_admin(authorization)

    execute_update(
        "UPDATE community_topic_threads SET is_pinned = :is_pinned WHERE id = :thread_id",
        {"is_pinned": request.is_pinned, "thread_id": thread_id}
    )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "pin_thread" if request.is_pinned else "unpin_thread",
        "target_type": "thread",
        "target_id": thread_id
    })

    return {"success": True}


@router.post("/threads/bulk-delete")
async def bulk_delete_threads(request: BulkDeleteRequest, authorization: str = Header(None)):
    """Bulk delete community threads"""
    admin = await require_admin(authorization)

    for thread_id in request.ids:
        # Delete replies first
        execute_delete(
            "DELETE FROM community_topic_replies WHERE thread_id = :thread_id",
            {"thread_id": thread_id}
        )
        # Delete thread
        execute_delete(
            "DELETE FROM community_topic_threads WHERE id = :thread_id",
            {"thread_id": thread_id}
        )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "bulk_delete_threads",
        "target_type": "thread",
        "details": f'{{"count": {len(request.ids)}}}'
    })

    return {"success": True, "deleted_count": len(request.ids)}


# =====================================================
# REPLIES ADMIN
# =====================================================

@router.get("/replies")
async def list_replies_admin(
    authorization: str = Header(None),
    skip: int = 0,
    limit: int = 50,
    thread_id: Optional[str] = None,
    search: Optional[str] = None
):
    """List community thread replies with filters"""
    await require_admin(authorization)

    # Build WHERE clause
    where_clauses = ["1=1"]
    params = {"skip": skip, "limit": limit}

    if thread_id:
        where_clauses.append("r.thread_id = :thread_id")
        params["thread_id"] = thread_id
    if search:
        where_clauses.append("r.content ILIKE :search")
        params["search"] = f"%{search}%"

    where_sql = " AND ".join(where_clauses)

    # Get total count
    count_result = execute_single(f"""
        SELECT COUNT(*) as total FROM community_topic_replies r WHERE {where_sql}
    """, params)
    total = count_result["total"] if count_result else 0

    # Get replies with related data
    replies = execute_query(f"""
        SELECT r.*,
               p.full_name as author_full_name, p.username as author_username, p.avatar_url as author_avatar_url,
               t.title as thread_title
        FROM community_topic_replies r
        LEFT JOIN profiles p ON r.user_id = p.id
        LEFT JOIN community_topic_threads t ON r.thread_id = t.id
        WHERE {where_sql}
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :skip
    """, params)

    # Transform to match expected format
    result = []
    for reply in replies:
        result.append({
            "id": reply["id"],
            "content": reply["content"],
            "thread_id": reply["thread_id"],
            "user_id": reply["user_id"],
            "created_at": reply["created_at"],
            "updated_at": reply.get("updated_at"),
            "author": {
                "full_name": reply["author_full_name"],
                "username": reply["author_username"],
                "avatar_url": reply["author_avatar_url"]
            } if reply.get("author_username") else None,
            "thread": {
                "title": reply["thread_title"]
            } if reply.get("thread_title") else None
        })

    return {
        "replies": result,
        "total": total
    }


@router.delete("/replies/{reply_id}")
async def delete_reply_admin(reply_id: str, authorization: str = Header(None)):
    """Delete a community thread reply"""
    admin = await require_admin(authorization)

    # Get reply info for audit log
    reply = execute_single(
        "SELECT thread_id, user_id FROM community_topic_replies WHERE id = :reply_id",
        {"reply_id": reply_id}
    )

    # Delete reply
    execute_delete(
        "DELETE FROM community_topic_replies WHERE id = :reply_id",
        {"reply_id": reply_id}
    )

    # Update reply count on thread
    if reply:
        execute_update(
            "UPDATE community_topic_threads SET reply_count = GREATEST(0, reply_count - 1) WHERE id = :thread_id",
            {"thread_id": reply["thread_id"]}
        )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "delete_reply",
        "target_type": "reply",
        "target_id": reply_id,
        "details": f'{{"thread_id": "{reply.get("thread_id") if reply else ""}"}}'
    })

    return {"success": True}


# =====================================================
# COLLABS ADMIN
# =====================================================

@router.get("/collabs")
async def list_collabs_admin(
    authorization: str = Header(None),
    skip: int = 0,
    limit: int = 50,
    is_active: Optional[bool] = None,
    is_featured: Optional[bool] = None,
    collab_type: Optional[str] = None,
    search: Optional[str] = None,
    approval_status: Optional[str] = None
):
    """List collabs with admin filters"""
    await require_admin(authorization)

    # Build WHERE clause
    where_clauses = ["1=1"]
    params = {"skip": skip, "limit": limit}

    if is_active is not None:
        where_clauses.append("c.is_active = :is_active")
        params["is_active"] = is_active
    if is_featured is not None:
        where_clauses.append("c.is_featured = :is_featured")
        params["is_featured"] = is_featured
    if collab_type:
        where_clauses.append("c.type = :collab_type")
        params["collab_type"] = collab_type
    if search:
        where_clauses.append("c.title ILIKE :search")
        params["search"] = f"%{search}%"
    if approval_status:
        where_clauses.append("c.approval_status = :approval_status")
        params["approval_status"] = approval_status

    where_sql = " AND ".join(where_clauses)

    # Get total count
    count_result = execute_single(f"""
        SELECT COUNT(*) as total FROM community_collabs c WHERE {where_sql}
    """, params)
    total = count_result["total"] if count_result else 0

    # Get collabs with creator info
    collabs = execute_query(f"""
        SELECT c.*,
               p.full_name as creator_full_name, p.username as creator_username, p.avatar_url as creator_avatar_url
        FROM community_collabs c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE {where_sql}
        ORDER BY c.created_at DESC
        LIMIT :limit OFFSET :skip
    """, params)

    # Transform to match expected format
    result = []
    for collab in collabs:
        result.append({
            **{k: v for k, v in collab.items() if not k.startswith("creator_")},
            "profiles": {
                "full_name": collab["creator_full_name"],
                "username": collab["creator_username"],
                "avatar_url": collab["creator_avatar_url"]
            } if collab.get("creator_username") else None
        })

    return {
        "collabs": result,
        "total": total
    }


@router.put("/collabs/{collab_id}/feature")
async def feature_collab(collab_id: str, request: FeatureCollabRequest, authorization: str = Header(None)):
    """Feature or unfeature a collab"""
    admin = await require_admin(authorization)

    update_parts = ["is_featured = :is_featured"]
    params = {"collab_id": collab_id, "is_featured": request.is_featured}

    if request.featured_until:
        update_parts.append("featured_until = :featured_until")
        params["featured_until"] = request.featured_until
    elif not request.is_featured:
        update_parts.append("featured_until = NULL")

    execute_update(f"""
        UPDATE community_collabs SET {', '.join(update_parts)} WHERE id = :collab_id
    """, params)

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "feature_collab" if request.is_featured else "unfeature_collab",
        "target_type": "collab",
        "target_id": collab_id
    })

    return {"success": True}


@router.put("/collabs/{collab_id}/deactivate")
async def deactivate_collab(collab_id: str, authorization: str = Header(None)):
    """Deactivate a collab"""
    admin = await require_admin(authorization)

    execute_update(
        "UPDATE community_collabs SET is_active = false WHERE id = :collab_id",
        {"collab_id": collab_id}
    )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "deactivate_collab",
        "target_type": "collab",
        "target_id": collab_id
    })

    return {"success": True}


@router.post("/collabs/bulk-deactivate")
async def bulk_deactivate_collabs(request: BulkDeactivateRequest, authorization: str = Header(None)):
    """Bulk deactivate collabs"""
    admin = await require_admin(authorization)

    for collab_id in request.collab_ids:
        execute_update(
            "UPDATE community_collabs SET is_active = false WHERE id = :collab_id",
            {"collab_id": collab_id}
        )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "bulk_deactivate_collabs",
        "target_type": "collab",
        "details": f'{{"count": {len(request.collab_ids)}}}'
    })

    return {"success": True, "deactivated_count": len(request.collab_ids)}


@router.get("/collabs/pending")
async def list_pending_collabs(
    authorization: str = Header(None),
    skip: int = 0,
    limit: int = 50
):
    """List collabs pending approval"""
    await require_admin(authorization)

    # Get total count
    count_result = execute_single("""
        SELECT COUNT(*) as total FROM community_collabs WHERE approval_status = 'pending'
    """)
    total = count_result["total"] if count_result else 0

    # Get pending collabs with creator info
    collabs = execute_query("""
        SELECT c.*,
               p.full_name as creator_full_name, p.username as creator_username, p.avatar_url as creator_avatar_url
        FROM community_collabs c
        LEFT JOIN profiles p ON c.user_id = p.id
        WHERE c.approval_status = 'pending'
        ORDER BY c.created_at DESC
        LIMIT :limit OFFSET :skip
    """, {"skip": skip, "limit": limit})

    result = []
    for collab in collabs:
        result.append({
            **{k: v for k, v in collab.items() if not k.startswith("creator_")},
            "profiles": {
                "full_name": collab["creator_full_name"],
                "username": collab["creator_username"],
                "avatar_url": collab["creator_avatar_url"]
            } if collab.get("creator_username") else None
        })

    return {
        "collabs": result,
        "total": total
    }


@router.post("/collabs/{collab_id}/approve")
async def approve_collab(
    collab_id: str,
    request: ApproveCollabRequest = None,
    authorization: str = Header(None)
):
    """Approve a pending collab"""
    admin = await require_admin(authorization)

    # Update collab approval status
    execute_update("""
        UPDATE community_collabs
        SET approval_status = 'approved',
            approved_by = :approved_by,
            approved_at = NOW()
        WHERE id = :collab_id
    """, {
        "collab_id": collab_id,
        "approved_by": admin["id"]
    })

    # Log action
    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "approve_collab",
        "target_type": "collab",
        "target_id": collab_id,
        "details": f'{{"notes": "{request.notes if request and request.notes else ""}"}}'
    })

    return {"success": True, "message": "Collab approved"}


@router.post("/collabs/{collab_id}/reject")
async def reject_collab(
    collab_id: str,
    request: RejectCollabRequest,
    authorization: str = Header(None)
):
    """Reject a pending collab"""
    admin = await require_admin(authorization)

    # Update collab approval status
    execute_update("""
        UPDATE community_collabs
        SET approval_status = 'rejected',
            rejection_reason = :rejection_reason
        WHERE id = :collab_id
    """, {
        "collab_id": collab_id,
        "rejection_reason": request.reason
    })

    # Log action
    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "reject_collab",
        "target_type": "collab",
        "target_id": collab_id,
        "details": f'{{"reason": "{request.reason}"}}'
    })

    return {"success": True, "message": "Collab rejected"}


@router.get("/settings/require_collab_approval")
async def get_collab_approval_setting(authorization: str = Header(None)):
    """Get the require_collab_approval setting"""
    await require_admin(authorization)

    setting = execute_single("""
        SELECT value FROM settings WHERE key = 'require_collab_approval'
    """)

    # Value is stored as JSONB, could be "true" string or true boolean
    enabled = False
    if setting:
        value = setting.get("value")
        enabled = value == "true" or value is True

    return {"enabled": enabled}


@router.put("/settings/require_collab_approval")
async def update_collab_approval_setting(
    enabled: bool = Query(...),
    authorization: str = Header(None)
):
    """Toggle the require_collab_approval setting"""
    admin = await require_admin(authorization)

    # Upsert the setting (value is JSONB, so we store it as a JSON boolean)
    import json
    json_value = json.dumps(enabled)
    execute_query("""
        INSERT INTO settings (key, value)
        VALUES ('require_collab_approval', :value::jsonb)
        ON CONFLICT (key) DO UPDATE SET value = :value::jsonb, updated_at = NOW()
    """, {"value": json_value})

    # Log action
    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "update_collab_approval_setting",
        "target_type": "setting",
        "details": f'{{"enabled": {str(enabled).lower()}}}'
    })

    return {"success": True, "enabled": enabled}


# =====================================================
# USER MODERATION
# =====================================================

@router.post("/users/{user_id}/warn")
async def warn_user(user_id: str, request: WarnUserRequest, authorization: str = Header(None)):
    """Issue a warning to a user"""
    admin = await require_admin(authorization)

    # Create moderation action record
    import json
    details_json = json.dumps({"admin_notes": request.details}) if request.details else "{}"

    execute_insert("""
        INSERT INTO user_moderation_actions (id, user_id, admin_id, action_type, reason, details, is_active, related_content_type, related_content_id, created_at)
        VALUES (:id, :user_id, :admin_id, :action_type, :reason, :details::jsonb, :is_active, :related_content_type, :related_content_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "admin_id": admin["id"],
        "action_type": "warning",
        "reason": request.reason,
        "details": details_json,
        "is_active": True,
        "related_content_type": request.related_content_type,
        "related_content_id": request.related_content_id
    })

    # Update warning count
    execute_update("""
        UPDATE profiles SET
            warning_count = COALESCE(warning_count, 0) + 1,
            last_warning_at = NOW()
        WHERE id = :user_id
    """, {"user_id": user_id})

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "warn_user",
        "target_type": "user",
        "target_id": user_id,
        "details": f'{{"reason": "{request.reason}"}}'
    })

    return {"success": True, "message": "Warning issued"}


@router.post("/users/{user_id}/mute")
async def mute_user(user_id: str, request: MuteUserRequest, authorization: str = Header(None)):
    """Mute a user (prevent posting)"""
    admin = await require_admin(authorization)

    expires_at = None
    if request.duration_hours > 0:
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=request.duration_hours)).isoformat()

    # Create moderation action record
    execute_insert("""
        INSERT INTO user_moderation_actions (id, user_id, admin_id, action_type, reason, expires_at, is_active, related_content_type, related_content_id, created_at)
        VALUES (:id, :user_id, :admin_id, :action_type, :reason, :expires_at, :is_active, :related_content_type, :related_content_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "admin_id": admin["id"],
        "action_type": "mute",
        "reason": request.reason,
        "expires_at": expires_at,
        "is_active": True,
        "related_content_type": request.related_content_type,
        "related_content_id": request.related_content_id
    })

    # Update user profile
    execute_update("""
        UPDATE profiles SET
            is_muted = true,
            muted_until = :muted_until,
            mute_reason = :mute_reason
        WHERE id = :user_id
    """, {
        "user_id": user_id,
        "muted_until": expires_at,
        "mute_reason": request.reason
    })

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "mute_user",
        "target_type": "user",
        "target_id": user_id,
        "details": f'{{"reason": "{request.reason}", "duration_hours": {request.duration_hours}}}'
    })

    duration_msg = f" for {request.duration_hours} hours" if request.duration_hours > 0 else " permanently"
    return {"success": True, "message": f"User muted{duration_msg}"}


@router.post("/users/{user_id}/unmute")
async def unmute_user(user_id: str, authorization: str = Header(None)):
    """Unmute a user"""
    admin = await require_admin(authorization)

    # Mark previous mute as inactive
    execute_update("""
        UPDATE user_moderation_actions SET is_active = false
        WHERE user_id = :user_id AND action_type = 'mute' AND is_active = true
    """, {"user_id": user_id})

    # Create unmute action
    execute_insert("""
        INSERT INTO user_moderation_actions (id, user_id, admin_id, action_type, reason, is_active, created_at)
        VALUES (:id, :user_id, :admin_id, :action_type, :reason, :is_active, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "admin_id": admin["id"],
        "action_type": "unmute",
        "reason": "Unmuted by admin",
        "is_active": True
    })

    # Update user profile
    execute_update("""
        UPDATE profiles SET
            is_muted = false,
            muted_until = NULL,
            mute_reason = NULL
        WHERE id = :user_id
    """, {"user_id": user_id})

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "unmute_user",
        "target_type": "user",
        "target_id": user_id
    })

    return {"success": True, "message": "User unmuted"}


@router.get("/users/{user_id}/moderation-history")
async def get_user_moderation_history(user_id: str, authorization: str = Header(None)):
    """Get moderation history for a user"""
    await require_admin(authorization)

    actions = execute_query("""
        SELECT a.*, p.full_name as admin_full_name, p.username as admin_username
        FROM user_moderation_actions a
        LEFT JOIN profiles p ON a.admin_id = p.id
        WHERE a.user_id = :user_id
        ORDER BY a.created_at DESC
    """, {"user_id": user_id})

    # Transform to match expected format
    result = []
    for action in actions:
        result.append({
            **{k: v for k, v in action.items() if not k.startswith("admin_")},
            "profiles": {
                "full_name": action.get("admin_full_name"),
                "username": action.get("admin_username")
            }
        })

    return result


@router.get("/moderation/active-mutes")
async def list_active_mutes(authorization: str = Header(None)):
    """List all currently muted users"""
    await require_admin(authorization)

    muted_users = execute_query("""
        SELECT id, full_name, username, avatar_url, is_muted, muted_until, mute_reason
        FROM profiles
        WHERE is_muted = true
    """)

    return muted_users


# =====================================================
# CONTENT REPORTS
# =====================================================

@router.get("/reports")
async def list_content_reports(
    authorization: str = Header(None),
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    content_type: Optional[str] = None
):
    """List content reports"""
    await require_admin(authorization)

    # Build WHERE clause
    where_clauses = ["1=1"]
    params = {"skip": skip, "limit": limit}

    if status:
        where_clauses.append("r.status = :status")
        params["status"] = status
    if content_type:
        where_clauses.append("r.content_type = :content_type")
        params["content_type"] = content_type

    where_sql = " AND ".join(where_clauses)

    # Get total count
    count_result = execute_single(f"""
        SELECT COUNT(*) as total FROM content_reports r WHERE {where_sql}
    """, params)
    total = count_result["total"] if count_result else 0

    # Get reports with reporter info
    reports = execute_query(f"""
        SELECT r.*, p.full_name as reporter_full_name, p.username as reporter_username
        FROM content_reports r
        LEFT JOIN profiles p ON r.reporter_id = p.id
        WHERE {where_sql}
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :skip
    """, params)

    # Transform to match expected format
    result = []
    for report in reports:
        result.append({
            **{k: v for k, v in report.items() if not k.startswith("reporter_")},
            "profiles": {
                "full_name": report.get("reporter_full_name"),
                "username": report.get("reporter_username")
            }
        })

    return {
        "reports": result,
        "total": total
    }


@router.get("/reports/stats")
async def get_report_stats(authorization: str = Header(None)):
    """Get content report statistics"""
    await require_admin(authorization)

    stats = execute_single("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
            COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed,
            COUNT(*) as total
        FROM content_reports
    """)

    return stats or {"pending": 0, "reviewing": 0, "resolved": 0, "dismissed": 0, "total": 0}


@router.put("/reports/{report_id}/resolve")
async def resolve_report(report_id: str, request: ResolveReportRequest, authorization: str = Header(None)):
    """Resolve a content report"""
    admin = await require_admin(authorization)

    execute_update("""
        UPDATE content_reports SET
            status = 'resolved',
            reviewed_by = :reviewed_by,
            reviewed_at = NOW(),
            resolution_notes = :resolution_notes
        WHERE id = :report_id
    """, {
        "report_id": report_id,
        "reviewed_by": admin["id"],
        "resolution_notes": request.resolution_notes
    })

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "resolve_report",
        "target_type": "report",
        "target_id": report_id,
        "details": f'{{"action_taken": "{request.action_taken or ""}"}}'
    })

    return {"success": True}


@router.put("/reports/{report_id}/dismiss")
async def dismiss_report(report_id: str, request: ResolveReportRequest, authorization: str = Header(None)):
    """Dismiss a content report"""
    admin = await require_admin(authorization)

    execute_update("""
        UPDATE content_reports SET
            status = 'dismissed',
            reviewed_by = :reviewed_by,
            reviewed_at = NOW(),
            resolution_notes = :resolution_notes
        WHERE id = :report_id
    """, {
        "report_id": report_id,
        "reviewed_by": admin["id"],
        "resolution_notes": request.resolution_notes
    })

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "dismiss_report",
        "target_type": "report",
        "target_id": report_id
    })

    return {"success": True}


# =====================================================
# FLAGGED CONTENT
# =====================================================

@router.get("/flagged")
async def list_flagged_content(
    authorization: str = Header(None),
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    severity: Optional[str] = None
):
    """List auto-flagged content"""
    await require_admin(authorization)

    # Build WHERE clause
    where_clauses = ["1=1"]
    params = {"skip": skip, "limit": limit}

    if status:
        where_clauses.append("status = :status")
        params["status"] = status
    if severity:
        where_clauses.append("severity = :severity")
        params["severity"] = severity

    where_sql = " AND ".join(where_clauses)

    # Get total count
    count_result = execute_single(f"""
        SELECT COUNT(*) as total FROM flagged_content WHERE {where_sql}
    """, params)
    total = count_result["total"] if count_result else 0

    # Get flagged content
    flagged = execute_query(f"""
        SELECT * FROM flagged_content
        WHERE {where_sql}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :skip
    """, params)

    return {
        "flagged": flagged,
        "total": total
    }


@router.put("/flagged/{flagged_id}/approve")
async def approve_flagged_content(flagged_id: str, authorization: str = Header(None)):
    """Approve flagged content (false positive)"""
    admin = await require_admin(authorization)

    execute_update("""
        UPDATE flagged_content SET
            status = 'false_positive',
            reviewed_by = :reviewed_by,
            reviewed_at = NOW()
        WHERE id = :flagged_id
    """, {
        "flagged_id": flagged_id,
        "reviewed_by": admin["id"]
    })

    return {"success": True}


@router.put("/flagged/{flagged_id}/remove")
async def remove_flagged_content(flagged_id: str, authorization: str = Header(None)):
    """Remove flagged content"""
    admin = await require_admin(authorization)

    # Get the flagged content details
    flagged = execute_single(
        "SELECT * FROM flagged_content WHERE id = :flagged_id",
        {"flagged_id": flagged_id}
    )

    if flagged:
        # Mark as removed
        execute_update("""
            UPDATE flagged_content SET
                status = 'removed',
                reviewed_by = :reviewed_by,
                reviewed_at = NOW()
            WHERE id = :flagged_id
        """, {
            "flagged_id": flagged_id,
            "reviewed_by": admin["id"]
        })

        # Actually delete the content if possible
        content_type = flagged.get("content_type")
        content_id = flagged.get("content_id")

        if content_type == "thread":
            execute_delete(
                "DELETE FROM community_topic_replies WHERE thread_id = :content_id",
                {"content_id": content_id}
            )
            execute_delete(
                "DELETE FROM community_topic_threads WHERE id = :content_id",
                {"content_id": content_id}
            )
        elif content_type == "reply":
            execute_delete(
                "DELETE FROM community_topic_replies WHERE id = :content_id",
                {"content_id": content_id}
            )
        elif content_type == "collab":
            execute_update(
                "UPDATE community_collabs SET is_active = false WHERE id = :content_id",
                {"content_id": content_id}
            )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "remove_flagged_content",
        "target_type": "flagged",
        "target_id": flagged_id
    })

    return {"success": True}


# =====================================================
# BROADCASTS
# =====================================================

@router.get("/broadcasts")
async def list_broadcasts(authorization: str = Header(None)):
    """List all platform broadcasts"""
    await require_admin(authorization)

    broadcasts = execute_query("""
        SELECT b.*, p.full_name as admin_full_name, p.username as admin_username
        FROM platform_broadcasts b
        LEFT JOIN profiles p ON b.admin_id = p.id
        ORDER BY b.created_at DESC
    """)

    # Transform to match expected format
    result = []
    for broadcast in broadcasts:
        result.append({
            **{k: v for k, v in broadcast.items() if not k.startswith("admin_")},
            "profiles": {
                "full_name": broadcast.get("admin_full_name"),
                "username": broadcast.get("admin_username")
            }
        })

    return result


@router.post("/broadcasts")
async def create_broadcast(broadcast: BroadcastCreate, authorization: str = Header(None)):
    """Create a platform broadcast"""
    admin = await require_admin(authorization)

    result = execute_insert("""
        INSERT INTO platform_broadcasts (id, admin_id, title, message, broadcast_type, target_audience, is_active, starts_at, expires_at, created_at)
        VALUES (:id, :admin_id, :title, :message, :broadcast_type, :target_audience, :is_active, :starts_at, :expires_at, NOW())
        RETURNING *
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "title": broadcast.title,
        "message": broadcast.message,
        "broadcast_type": broadcast.broadcast_type,
        "target_audience": broadcast.target_audience,
        "is_active": True,
        "starts_at": broadcast.starts_at or datetime.now(timezone.utc).isoformat(),
        "expires_at": broadcast.expires_at
    })

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "create_broadcast",
        "target_type": "broadcast",
        "target_id": result["id"] if result else None,
        "details": f'{{"title": "{broadcast.title}"}}'
    })

    return result


@router.put("/broadcasts/{broadcast_id}")
async def update_broadcast(broadcast_id: str, broadcast: BroadcastUpdate, authorization: str = Header(None)):
    """Update a platform broadcast"""
    admin = await require_admin(authorization)

    update_fields = ["updated_at = NOW()"]
    params = {"broadcast_id": broadcast_id}

    if broadcast.title is not None:
        update_fields.append("title = :title")
        params["title"] = broadcast.title
    if broadcast.message is not None:
        update_fields.append("message = :message")
        params["message"] = broadcast.message
    if broadcast.broadcast_type is not None:
        update_fields.append("broadcast_type = :broadcast_type")
        params["broadcast_type"] = broadcast.broadcast_type
    if broadcast.target_audience is not None:
        update_fields.append("target_audience = :target_audience")
        params["target_audience"] = broadcast.target_audience
    if broadcast.is_active is not None:
        update_fields.append("is_active = :is_active")
        params["is_active"] = broadcast.is_active
    if broadcast.starts_at is not None:
        update_fields.append("starts_at = :starts_at")
        params["starts_at"] = broadcast.starts_at
    if broadcast.expires_at is not None:
        update_fields.append("expires_at = :expires_at")
        params["expires_at"] = broadcast.expires_at

    result = execute_single(f"""
        UPDATE platform_broadcasts SET {', '.join(update_fields)}
        WHERE id = :broadcast_id
        RETURNING *
    """, params)

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "update_broadcast",
        "target_type": "broadcast",
        "target_id": broadcast_id
    })

    return result


@router.delete("/broadcasts/{broadcast_id}")
async def delete_broadcast(broadcast_id: str, authorization: str = Header(None)):
    """Delete a platform broadcast"""
    admin = await require_admin(authorization)

    execute_delete(
        "DELETE FROM platform_broadcasts WHERE id = :broadcast_id",
        {"broadcast_id": broadcast_id}
    )

    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "delete_broadcast",
        "target_type": "broadcast",
        "target_id": broadcast_id
    })

    return {"success": True}


# =====================================================
# FORUM BANS
# =====================================================

@router.post("/users/{user_id}/forum-ban")
async def create_forum_ban(user_id: str, request: ForumBanRequest, authorization: str = Header(None)):
    """Create a forum-specific ban for a user"""
    admin = await require_admin(authorization)

    # Validate restriction type
    valid_types = ['read_only', 'full_block', 'shadow_restrict']
    if request.restriction_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid restriction_type. Must be one of: {valid_types}")

    # Check if user exists
    user = execute_single(
        "SELECT id, full_name, username FROM profiles WHERE id = :user_id",
        {"user_id": user_id}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Deactivate any existing active bans for this user
    execute_update(
        "UPDATE forum_bans SET is_active = false WHERE user_id = :user_id AND is_active = true",
        {"user_id": user_id}
    )

    # Calculate expiration
    expires_at = None
    if request.duration_hours > 0:
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=request.duration_hours)).isoformat()

    # Create the ban
    import json
    details_json = json.dumps({"admin_notes": request.details}) if request.details else "{}"

    result = execute_insert("""
        INSERT INTO forum_bans (id, user_id, admin_id, restriction_type, reason, details, expires_at, is_active, created_at)
        VALUES (:id, :user_id, :admin_id, :restriction_type, :reason, :details::jsonb, :expires_at, true, NOW())
        RETURNING *
    """, {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "admin_id": admin["id"],
        "restriction_type": request.restriction_type,
        "reason": request.reason,
        "details": details_json,
        "expires_at": expires_at
    })

    # Update profile cache
    execute_update("""
        UPDATE profiles SET
            forum_ban_type = :ban_type,
            forum_ban_until = :ban_until,
            forum_ban_reason = :ban_reason
        WHERE id = :user_id
    """, {
        "user_id": user_id,
        "ban_type": request.restriction_type,
        "ban_until": expires_at,
        "ban_reason": request.reason
    })

    # Log action
    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, details, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, :details, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "forum_ban",
        "target_type": "user",
        "target_id": user_id,
        "details": f'{{"restriction_type": "{request.restriction_type}", "reason": "{request.reason}"}}'
    })

    duration_msg = f" for {request.duration_hours} hours" if request.duration_hours > 0 else " permanently"
    return {
        "success": True,
        "message": f"User banned from forum ({request.restriction_type}){duration_msg}",
        "ban": result
    }


@router.delete("/users/{user_id}/forum-ban")
async def remove_forum_ban(user_id: str, authorization: str = Header(None)):
    """Remove a forum ban from a user"""
    admin = await require_admin(authorization)

    # Deactivate all active bans for this user
    rows_updated = execute_update(
        "UPDATE forum_bans SET is_active = false WHERE user_id = :user_id AND is_active = true",
        {"user_id": user_id}
    )

    # Clear profile cache
    execute_update("""
        UPDATE profiles SET
            forum_ban_type = NULL,
            forum_ban_until = NULL,
            forum_ban_reason = NULL
        WHERE id = :user_id
    """, {"user_id": user_id})

    # Log action
    execute_insert("""
        INSERT INTO admin_audit_log (id, admin_id, action, target_type, target_id, created_at)
        VALUES (:id, :admin_id, :action, :target_type, :target_id, NOW())
        RETURNING id
    """, {
        "id": str(uuid.uuid4()),
        "admin_id": admin["id"],
        "action": "forum_unban",
        "target_type": "user",
        "target_id": user_id
    })

    return {"success": True, "message": "Forum ban removed"}


@router.get("/users/{user_id}/forum-ban")
async def get_user_forum_ban(user_id: str, authorization: str = Header(None)):
    """Get a user's current forum ban status"""
    await require_admin(authorization)

    ban = execute_single("""
        SELECT fb.*, p.full_name as admin_full_name, p.username as admin_username
        FROM forum_bans fb
        LEFT JOIN profiles p ON fb.admin_id = p.id
        WHERE fb.user_id = :user_id AND fb.is_active = true
        ORDER BY fb.created_at DESC
        LIMIT 1
    """, {"user_id": user_id})

    if not ban:
        return {"banned": False, "ban": None}

    # Check if expired
    if ban.get("expires_at"):
        expires = datetime.fromisoformat(str(ban["expires_at"]).replace("Z", "+00:00"))
        if expires < datetime.now(timezone.utc):
            # Mark as inactive
            execute_update(
                "UPDATE forum_bans SET is_active = false WHERE id = :ban_id",
                {"ban_id": ban["id"]}
            )
            execute_update("""
                UPDATE profiles SET forum_ban_type = NULL, forum_ban_until = NULL, forum_ban_reason = NULL
                WHERE id = :user_id
            """, {"user_id": user_id})
            return {"banned": False, "ban": None}

    return {
        "banned": True,
        "ban": {
            **{k: v for k, v in ban.items() if not k.startswith("admin_")},
            "admin": {
                "full_name": ban.get("admin_full_name"),
                "username": ban.get("admin_username")
            }
        }
    }


@router.get("/forum-bans")
async def list_forum_bans(
    authorization: str = Header(None),
    skip: int = 0,
    limit: int = 50,
    is_active: Optional[bool] = None,
    restriction_type: Optional[str] = None
):
    """List all forum bans"""
    await require_admin(authorization)

    # Build WHERE clause
    where_clauses = ["1=1"]
    params = {"skip": skip, "limit": limit}

    if is_active is not None:
        where_clauses.append("fb.is_active = :is_active")
        params["is_active"] = is_active
    if restriction_type:
        where_clauses.append("fb.restriction_type = :restriction_type")
        params["restriction_type"] = restriction_type

    where_sql = " AND ".join(where_clauses)

    # Get total count
    count_result = execute_single(f"""
        SELECT COUNT(*) as total FROM forum_bans fb WHERE {where_sql}
    """, params)
    total = count_result["total"] if count_result else 0

    # Get bans with user and admin info
    bans = execute_query(f"""
        SELECT fb.*,
               u.full_name as user_full_name, u.username as user_username, u.avatar_url as user_avatar_url,
               a.full_name as admin_full_name, a.username as admin_username
        FROM forum_bans fb
        LEFT JOIN profiles u ON fb.user_id = u.id
        LEFT JOIN profiles a ON fb.admin_id = a.id
        WHERE {where_sql}
        ORDER BY fb.created_at DESC
        LIMIT :limit OFFSET :skip
    """, params)

    # Transform to match expected format
    result = []
    for ban in bans:
        result.append({
            "id": ban["id"],
            "user_id": ban["user_id"],
            "admin_id": ban["admin_id"],
            "restriction_type": ban["restriction_type"],
            "reason": ban["reason"],
            "details": ban.get("details"),
            "expires_at": ban.get("expires_at"),
            "is_active": ban["is_active"],
            "created_at": ban["created_at"],
            "updated_at": ban.get("updated_at"),
            "user": {
                "full_name": ban.get("user_full_name"),
                "username": ban.get("user_username"),
                "avatar_url": ban.get("user_avatar_url")
            },
            "admin": {
                "full_name": ban.get("admin_full_name"),
                "username": ban.get("admin_username")
            }
        })

    return {
        "bans": result,
        "total": total
    }
