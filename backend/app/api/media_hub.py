"""
Media/Marketing Hub API — Phase 1 & 2
Content request pipeline, content calendar, platform management, dashboard,
events/meetups, and creative discussions.
"""
import logging
import json
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.database import get_client, execute_query, execute_single, execute_insert
from app.core.deps import get_user_profile
from app.core.permissions import Permission, require_permissions, require_any_permission, has_permission
from app.core.roles import RoleType, has_any_role

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================================
# Valid status transitions
# ============================================================================
VALID_TRANSITIONS = {
    "submitted": ["in_review", "cancelled"],
    "in_review": ["approved", "cancelled"],
    "approved": ["in_production", "cancelled"],
    "in_production": ["ready_for_review"],
    "ready_for_review": ["approved_final", "revision"],
    "revision": ["in_production"],
    "approved_final": ["scheduled"],
    "scheduled": ["posted", "cancelled"],
}

CONTENT_TYPES = [
    "social_media_video", "marketing_video", "graphic",
    "social_post", "blog_post", "photo_shoot", "animation", "other",
]

PRIORITIES = ["low", "normal", "high", "urgent"]

CALENDAR_STATUSES = ["draft", "scheduled", "posted", "cancelled"]


def is_media_team(profile: dict) -> bool:
    """Check if user has media team management access."""
    return has_any_role(profile, [RoleType.MEDIA_TEAM, RoleType.ADMIN, RoleType.SUPERADMIN])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class ContentRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content_type: str
    priority: str = "normal"
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    platform_ids: Optional[List[str]] = None
    reference_links: Optional[list] = None
    metadata: Optional[dict] = None

class ContentRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    platform_ids: Optional[List[str]] = None
    reference_links: Optional[list] = None
    revision_notes: Optional[str] = None
    internal_notes: Optional[str] = None
    metadata: Optional[dict] = None

class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

class AssignUpdate(BaseModel):
    assigned_to: Optional[str] = None

class CommentCreate(BaseModel):
    body: str
    is_internal: bool = False

class CalendarEntryCreate(BaseModel):
    title: str
    description: Optional[str] = None
    content_type: Optional[str] = None
    scheduled_date: str
    end_date: Optional[str] = None
    request_id: Optional[str] = None
    platform_id: Optional[str] = None
    status: str = "scheduled"
    color: Optional[str] = None
    metadata: Optional[dict] = None

class CalendarEntryUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[str] = None
    scheduled_date: Optional[str] = None
    end_date: Optional[str] = None
    request_id: Optional[str] = None
    platform_id: Optional[str] = None
    status: Optional[str] = None
    color: Optional[str] = None
    metadata: Optional[dict] = None

class PlatformCreate(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = None
    color: Optional[str] = None
    url_pattern: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0

class PlatformUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    url_pattern: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

class PlatformReorder(BaseModel):
    platform_ids: List[str]


# --- Phase 2 schemas ---

EVENT_TYPES = [
    "content_shoot", "meetup", "premiere", "watch_party",
    "interview", "photoshoot", "livestream", "other",
]
EVENT_STATUSES = ["draft", "confirmed", "in_progress", "completed", "cancelled"]
EVENT_TRANSITIONS = {
    "draft": ["confirmed", "cancelled"],
    "confirmed": ["in_progress", "cancelled"],
    "in_progress": ["completed", "cancelled"],
}
RSVP_STATUSES = ["invited", "accepted", "declined", "maybe", "attended"]

class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: str
    status: str = "draft"
    start_date: str
    end_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    venue_name: Optional[str] = None
    address: Optional[str] = None
    virtual_link: Optional[str] = None
    is_virtual: bool = False
    request_id: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict] = None

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    venue_name: Optional[str] = None
    address: Optional[str] = None
    virtual_link: Optional[str] = None
    is_virtual: Optional[bool] = None
    request_id: Optional[str] = None
    color: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[dict] = None

class EventStatusUpdate(BaseModel):
    status: str

class AttendeeAdd(BaseModel):
    profile_id: str
    rsvp_status: str = "invited"
    role: Optional[str] = None
    notes: Optional[str] = None

class AttendeeUpdate(BaseModel):
    rsvp_status: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None

class RSVPUpdate(BaseModel):
    rsvp_status: str

class ChecklistItemCreate(BaseModel):
    label: str
    assigned_to: Optional[str] = None
    sort_order: int = 0

class ChecklistItemUpdate(BaseModel):
    label: Optional[str] = None
    is_completed: Optional[bool] = None
    assigned_to: Optional[str] = None
    sort_order: Optional[int] = None

class AgendaItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    sort_order: int = 0

class AgendaItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    sort_order: Optional[int] = None

class DiscussionCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    slug: str
    icon: Optional[str] = None
    sort_order: int = 0

class DiscussionCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    slug: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None

class DiscussionThreadCreate(BaseModel):
    category_id: str
    title: str
    content: str

class DiscussionThreadUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class DiscussionReplyCreate(BaseModel):
    thread_id: str
    content: str
    parent_reply_id: Optional[str] = None

class DiscussionReplyUpdate(BaseModel):
    content: str


# ============================================================================
# CONTENT REQUESTS
# ============================================================================

@router.post("/requests")
async def create_request(
    data: ContentRequestCreate,
    profile=Depends(require_permissions(Permission.MEDIA_CREATE)),
):
    """Submit a new content request. Any authenticated user can submit."""
    if data.content_type not in CONTENT_TYPES:
        raise HTTPException(400, f"Invalid content_type. Must be one of: {CONTENT_TYPES}")
    if data.priority not in PRIORITIES:
        raise HTTPException(400, f"Invalid priority. Must be one of: {PRIORITIES}")

    request_row = execute_insert("""
        INSERT INTO media_content_requests
            (title, description, content_type, priority, due_date, scheduled_date,
             requested_by, reference_links, metadata)
        VALUES (:title, :description, :content_type, :priority, :due_date, :scheduled_date,
                :requested_by, :reference_links, :metadata)
        RETURNING *
    """, {
        "title": data.title,
        "description": data.description,
        "content_type": data.content_type,
        "priority": data.priority,
        "due_date": data.due_date,
        "scheduled_date": data.scheduled_date,
        "requested_by": profile["id"],
        "reference_links": json.dumps(data.reference_links or []),
        "metadata": json.dumps(data.metadata or {}),
    })

    # Add platform associations
    if data.platform_ids:
        for pid in data.platform_ids:
            try:
                execute_insert("""
                    INSERT INTO media_request_platforms (request_id, platform_id)
                    VALUES (:request_id, :platform_id)
                    ON CONFLICT (request_id, platform_id) DO NOTHING
                """, {"request_id": request_row["id"], "platform_id": pid})
            except Exception:
                pass  # Skip invalid platform IDs

    # Create initial status history
    execute_insert("""
        INSERT INTO media_request_status_history (request_id, new_status, changed_by, notes)
        VALUES (:request_id, 'submitted', :changed_by, 'Request submitted')
    """, {"request_id": request_row["id"], "changed_by": profile["id"]})

    return {"request": request_row}


@router.get("/requests")
async def list_requests(
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
    status_filter: Optional[str] = Query(None, alias="status"),
    content_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    scope: Optional[str] = Query(None),  # "mine" or "all"
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List content requests. Non-team users only see their own by default."""
    team = is_media_team(profile)
    conditions = []
    params = {"limit": limit, "offset": offset}

    # Scope: non-team users always see only their own
    if not team or scope == "mine":
        conditions.append("r.requested_by = :profile_id")
        params["profile_id"] = profile["id"]

    if status_filter:
        conditions.append("r.status = :status")
        params["status"] = status_filter

    if content_type:
        conditions.append("r.content_type = :content_type")
        params["content_type"] = content_type

    if priority:
        conditions.append("r.priority = :priority")
        params["priority"] = priority

    if assigned_to:
        conditions.append("r.assigned_to = :assigned_to")
        params["assigned_to"] = assigned_to

    if search:
        conditions.append("(r.title ILIKE :search OR r.description ILIKE :search)")
        params["search"] = f"%{search}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = execute_query(f"""
        SELECT r.*,
               p_req.full_name AS requested_by_name,
               p_asn.full_name AS assigned_to_name
        FROM media_content_requests r
        LEFT JOIN profiles p_req ON p_req.id = r.requested_by
        LEFT JOIN profiles p_asn ON p_asn.id = r.assigned_to
        {where}
        ORDER BY
            CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
            r.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    count_row = execute_single(f"""
        SELECT COUNT(*) as total FROM media_content_requests r {where}
    """, params)

    # Attach platforms to each request
    if rows:
        req_ids = [r["id"] for r in rows]
        placeholders = ", ".join(f":id_{i}" for i in range(len(req_ids)))
        id_params = {f"id_{i}": rid for i, rid in enumerate(req_ids)}
        platforms = execute_query(f"""
            SELECT rp.request_id, rp.platform_url, mp.id as platform_id, mp.name, mp.slug, mp.icon, mp.color
            FROM media_request_platforms rp
            JOIN media_platforms mp ON mp.id = rp.platform_id
            WHERE rp.request_id IN ({placeholders})
        """, id_params)

        platform_map = {}
        for p in platforms:
            platform_map.setdefault(p["request_id"], []).append(p)

        for r in rows:
            r["platforms"] = platform_map.get(r["id"], [])

    return {"requests": rows, "total": count_row["total"] if count_row else 0}


@router.get("/requests/{request_id}")
async def get_request(
    request_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Get a single content request. Owner or media team can view."""
    row = execute_single("""
        SELECT r.*,
               p_req.full_name AS requested_by_name,
               p_asn.full_name AS assigned_to_name
        FROM media_content_requests r
        LEFT JOIN profiles p_req ON p_req.id = r.requested_by
        LEFT JOIN profiles p_asn ON p_asn.id = r.assigned_to
        WHERE r.id = :id
    """, {"id": request_id})

    if not row:
        raise HTTPException(404, "Request not found")

    # Non-team users can only see their own
    if not is_media_team(profile) and row["requested_by"] != profile["id"]:
        raise HTTPException(403, "Access denied")

    # Attach platforms
    platforms = execute_query("""
        SELECT rp.platform_url, mp.id as platform_id, mp.name, mp.slug, mp.icon, mp.color
        FROM media_request_platforms rp
        JOIN media_platforms mp ON mp.id = rp.platform_id
        WHERE rp.request_id = :request_id
    """, {"request_id": request_id})
    row["platforms"] = platforms

    return {"request": row}


@router.put("/requests/{request_id}")
async def update_request(
    request_id: str,
    data: ContentRequestUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Update request details. Owner can update their own; media team can update any."""
    existing = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    if not existing:
        raise HTTPException(404, "Request not found")

    is_owner = existing["requested_by"] == profile["id"]
    team = is_media_team(profile)
    if not is_owner and not team:
        raise HTTPException(403, "Access denied")

    fields = {}
    if data.title is not None:
        fields["title"] = data.title
    if data.description is not None:
        fields["description"] = data.description
    if data.content_type is not None:
        if data.content_type not in CONTENT_TYPES:
            raise HTTPException(400, f"Invalid content_type")
        fields["content_type"] = data.content_type
    if data.priority is not None:
        if data.priority not in PRIORITIES:
            raise HTTPException(400, f"Invalid priority")
        fields["priority"] = data.priority
    if data.due_date is not None:
        fields["due_date"] = data.due_date
    if data.scheduled_date is not None:
        fields["scheduled_date"] = data.scheduled_date
    if data.reference_links is not None:
        fields["reference_links"] = json.dumps(data.reference_links)
    if data.revision_notes is not None:
        fields["revision_notes"] = data.revision_notes
    if data.metadata is not None:
        fields["metadata"] = json.dumps(data.metadata)
    # internal_notes only editable by media team
    if data.internal_notes is not None and team:
        fields["internal_notes"] = data.internal_notes

    if fields:
        fields["updated_at"] = "NOW()"
        set_clauses = []
        params = {"id": request_id}
        for k, v in fields.items():
            if v == "NOW()":
                set_clauses.append(f"{k} = NOW()")
            else:
                set_clauses.append(f"{k} = :{k}")
                params[k] = v

        execute_query(f"""
            UPDATE media_content_requests SET {', '.join(set_clauses)} WHERE id = :id
        """, params)

    # Update platform associations
    if data.platform_ids is not None:
        execute_query("DELETE FROM media_request_platforms WHERE request_id = :id", {"id": request_id})
        for pid in data.platform_ids:
            try:
                execute_insert("""
                    INSERT INTO media_request_platforms (request_id, platform_id)
                    VALUES (:request_id, :platform_id)
                    ON CONFLICT DO NOTHING
                """, {"request_id": request_id, "platform_id": pid})
            except Exception:
                pass

    updated = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    return {"request": updated}


@router.delete("/requests/{request_id}")
async def delete_request(
    request_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Cancel/delete a request. Owner or media team."""
    existing = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    if not existing:
        raise HTTPException(404, "Request not found")

    is_owner = existing["requested_by"] == profile["id"]
    if not is_owner and not is_media_team(profile):
        raise HTTPException(403, "Access denied")

    # Soft-cancel instead of hard delete
    execute_query("""
        UPDATE media_content_requests SET status = 'cancelled', updated_at = NOW() WHERE id = :id
    """, {"id": request_id})

    execute_insert("""
        INSERT INTO media_request_status_history (request_id, old_status, new_status, changed_by, notes)
        VALUES (:request_id, :old_status, 'cancelled', :changed_by, 'Request cancelled')
    """, {
        "request_id": request_id,
        "old_status": existing["status"],
        "changed_by": profile["id"],
    })

    return {"success": True}


@router.put("/requests/{request_id}/status")
async def update_request_status(
    request_id: str,
    data: StatusUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Update request status with transition validation."""
    existing = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    if not existing:
        raise HTTPException(404, "Request not found")

    team = is_media_team(profile)
    is_owner = existing["requested_by"] == profile["id"]

    # Check valid transition
    allowed = VALID_TRANSITIONS.get(existing["status"], [])
    if data.status not in allowed:
        raise HTTPException(400, f"Invalid transition from '{existing['status']}' to '{data.status}'. Allowed: {allowed}")

    # Permission checks:
    # Requestor can: ready_for_review → approved_final or revision
    # Media team can: everything else
    requestor_allowed = {"approved_final", "revision"}
    if not team:
        if data.status not in requestor_allowed:
            raise HTTPException(403, "Only media team can perform this status change")
        if not is_owner:
            raise HTTPException(403, "Only the requestor or media team can change status")

    update_fields = {"status": data.status, "id": request_id}
    extra_set = ""
    if data.status == "posted":
        extra_set = ", posted_at = NOW()"

    execute_query(f"""
        UPDATE media_content_requests SET status = :status, updated_at = NOW(){extra_set} WHERE id = :id
    """, update_fields)

    execute_insert("""
        INSERT INTO media_request_status_history (request_id, old_status, new_status, changed_by, notes)
        VALUES (:request_id, :old_status, :new_status, :changed_by, :notes)
    """, {
        "request_id": request_id,
        "old_status": existing["status"],
        "new_status": data.status,
        "changed_by": profile["id"],
        "notes": data.notes,
    })

    updated = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    return {"request": updated}


@router.put("/requests/{request_id}/assign")
async def assign_request(
    request_id: str,
    data: AssignUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Assign a request to a media team member."""
    existing = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    if not existing:
        raise HTTPException(404, "Request not found")

    if data.assigned_to:
        execute_query("""
            UPDATE media_content_requests
            SET assigned_to = :assigned_to, assigned_at = NOW(), updated_at = NOW()
            WHERE id = :id
        """, {"id": request_id, "assigned_to": data.assigned_to})
    else:
        execute_query("""
            UPDATE media_content_requests
            SET assigned_to = NULL, assigned_at = NULL, updated_at = NOW()
            WHERE id = :id
        """, {"id": request_id})

    updated = execute_single("""
        SELECT r.*, p.full_name AS assigned_to_name
        FROM media_content_requests r
        LEFT JOIN profiles p ON p.id = r.assigned_to
        WHERE r.id = :id
    """, {"id": request_id})
    return {"request": updated}


# ============================================================================
# COMMENTS
# ============================================================================

@router.post("/requests/{request_id}/comments")
async def create_comment(
    request_id: str,
    data: CommentCreate,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Add a comment to a request. Internal comments require MEDIA_MANAGE."""
    existing = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    if not existing:
        raise HTTPException(404, "Request not found")

    team = is_media_team(profile)
    is_owner = existing["requested_by"] == profile["id"]

    if not team and not is_owner:
        raise HTTPException(403, "Access denied")

    # Internal comments require media team
    if data.is_internal and not team:
        raise HTTPException(403, "Only media team can post internal comments")

    comment = execute_insert("""
        INSERT INTO media_request_comments (request_id, author_id, body, is_internal)
        VALUES (:request_id, :author_id, :body, :is_internal)
        RETURNING *
    """, {
        "request_id": request_id,
        "author_id": profile["id"],
        "body": data.body,
        "is_internal": data.is_internal,
    })

    # Attach author name
    comment["author_name"] = profile.get("full_name", "Unknown")
    return {"comment": comment}


@router.get("/requests/{request_id}/comments")
async def list_comments(
    request_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """List comments on a request. Internal comments hidden from non-team."""
    existing = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    if not existing:
        raise HTTPException(404, "Request not found")

    team = is_media_team(profile)
    is_owner = existing["requested_by"] == profile["id"]

    if not team and not is_owner:
        raise HTTPException(403, "Access denied")

    internal_filter = "" if team else "AND c.is_internal = FALSE"

    comments = execute_query(f"""
        SELECT c.*, p.full_name AS author_name
        FROM media_request_comments c
        JOIN profiles p ON p.id = c.author_id
        WHERE c.request_id = :request_id {internal_filter}
        ORDER BY c.created_at ASC
    """, {"request_id": request_id})

    return {"comments": comments}


@router.get("/requests/{request_id}/history")
async def get_request_history(
    request_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Get status change history for a request."""
    existing = execute_single("SELECT * FROM media_content_requests WHERE id = :id", {"id": request_id})
    if not existing:
        raise HTTPException(404, "Request not found")

    team = is_media_team(profile)
    is_owner = existing["requested_by"] == profile["id"]

    if not team and not is_owner:
        raise HTTPException(403, "Access denied")

    history = execute_query("""
        SELECT h.*, p.full_name AS changed_by_name
        FROM media_request_status_history h
        JOIN profiles p ON p.id = h.changed_by
        WHERE h.request_id = :request_id
        ORDER BY h.created_at ASC
    """, {"request_id": request_id})

    return {"history": history}


# ============================================================================
# CALENDAR
# ============================================================================

@router.get("/calendar")
async def list_calendar_entries(
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    platform_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
):
    """List calendar entries. Media team only for full calendar."""
    if not is_media_team(profile):
        raise HTTPException(403, "Media team access required for calendar")

    conditions = []
    params = {}

    if start:
        conditions.append("e.scheduled_date >= :start")
        params["start"] = start
    if end:
        conditions.append("e.scheduled_date <= :end")
        params["end"] = end
    if platform_id:
        conditions.append("e.platform_id = :platform_id")
        params["platform_id"] = platform_id
    if status_filter:
        conditions.append("e.status = :status")
        params["status"] = status_filter

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    entries = execute_query(f"""
        SELECT e.*,
               mp.name AS platform_name, mp.slug AS platform_slug,
               mp.icon AS platform_icon, mp.color AS platform_color,
               r.title AS request_title, r.status AS request_status,
               p.full_name AS created_by_name
        FROM media_calendar_entries e
        LEFT JOIN media_platforms mp ON mp.id = e.platform_id
        LEFT JOIN media_content_requests r ON r.id = e.request_id
        LEFT JOIN profiles p ON p.id = e.created_by
        {where}
        ORDER BY e.scheduled_date ASC
    """, params)

    # Also include scheduled requests as implicit calendar items
    req_conditions = ["r.scheduled_date IS NOT NULL", "r.status IN ('scheduled', 'posted')"]
    req_params = {}
    if start:
        req_conditions.append("r.scheduled_date >= :start")
        req_params["start"] = start
    if end:
        req_conditions.append("r.scheduled_date <= :end")
        req_params["end"] = end

    req_where = "WHERE " + " AND ".join(req_conditions)

    scheduled_requests = execute_query(f"""
        SELECT r.id, r.title, r.scheduled_date, r.status, r.content_type,
               r.posted_at, p.full_name AS requested_by_name
        FROM media_content_requests r
        LEFT JOIN profiles p ON p.id = r.requested_by
        {req_where}
        ORDER BY r.scheduled_date ASC
    """, req_params)

    # Also include events for calendar display
    ev_conditions = ["ev.status != 'cancelled'"]
    ev_params = {}
    if start:
        ev_conditions.append("ev.start_date >= :ev_start")
        ev_params["ev_start"] = start
    if end:
        ev_conditions.append("ev.start_date <= :ev_end")
        ev_params["ev_end"] = end

    ev_where = "WHERE " + " AND ".join(ev_conditions)
    calendar_events = execute_query(f"""
        SELECT ev.id, ev.title, ev.start_date, ev.end_date, ev.event_type, ev.status,
               ev.color, ev.venue_name, ev.is_virtual,
               (SELECT COUNT(*) FROM media_event_attendees a WHERE a.event_id = ev.id) AS attendee_count
        FROM media_events ev
        {ev_where}
        ORDER BY ev.start_date ASC
    """, ev_params)

    return {"entries": entries, "scheduled_requests": scheduled_requests, "events": calendar_events}


@router.post("/calendar")
async def create_calendar_entry(
    data: CalendarEntryCreate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Create a calendar entry. Media team only."""
    entry = execute_insert("""
        INSERT INTO media_calendar_entries
            (title, description, content_type, scheduled_date, end_date,
             request_id, platform_id, status, created_by, color, metadata)
        VALUES (:title, :description, :content_type, :scheduled_date, :end_date,
                :request_id, :platform_id, :status, :created_by, :color, :metadata)
        RETURNING *
    """, {
        "title": data.title,
        "description": data.description,
        "content_type": data.content_type,
        "scheduled_date": data.scheduled_date,
        "end_date": data.end_date,
        "request_id": data.request_id,
        "platform_id": data.platform_id,
        "status": data.status,
        "created_by": profile["id"],
        "color": data.color,
        "metadata": json.dumps(data.metadata or {}),
    })

    return {"entry": entry}


@router.put("/calendar/{entry_id}")
async def update_calendar_entry(
    entry_id: str,
    data: CalendarEntryUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Update a calendar entry. Media team only."""
    existing = execute_single("SELECT * FROM media_calendar_entries WHERE id = :id", {"id": entry_id})
    if not existing:
        raise HTTPException(404, "Calendar entry not found")

    fields = {}
    for field in ["title", "description", "content_type", "scheduled_date", "end_date",
                  "request_id", "platform_id", "status", "color"]:
        val = getattr(data, field, None)
        if val is not None:
            fields[field] = val
    if data.metadata is not None:
        fields["metadata"] = json.dumps(data.metadata)

    if fields:
        set_clauses = [f"{k} = :{k}" for k in fields]
        set_clauses.append("updated_at = NOW()")
        fields["id"] = entry_id
        execute_query(f"""
            UPDATE media_calendar_entries SET {', '.join(set_clauses)} WHERE id = :id
        """, fields)

    updated = execute_single("SELECT * FROM media_calendar_entries WHERE id = :id", {"id": entry_id})
    return {"entry": updated}


@router.delete("/calendar/{entry_id}")
async def delete_calendar_entry(
    entry_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Delete a calendar entry. Media team only."""
    existing = execute_single("SELECT * FROM media_calendar_entries WHERE id = :id", {"id": entry_id})
    if not existing:
        raise HTTPException(404, "Calendar entry not found")

    execute_query("DELETE FROM media_calendar_entries WHERE id = :id", {"id": entry_id})
    return {"success": True}


# ============================================================================
# DASHBOARD
# ============================================================================

@router.get("/dashboard")
async def get_dashboard(
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Dashboard stats for media team."""
    if not is_media_team(profile):
        raise HTTPException(403, "Media team access required")

    # Request counts by status
    status_counts = execute_query("""
        SELECT status, COUNT(*) as count
        FROM media_content_requests
        WHERE status NOT IN ('posted', 'cancelled')
        GROUP BY status
    """, {})

    # Requests needing attention (submitted, ready_for_review)
    pending = execute_query("""
        SELECT r.*, p.full_name AS requested_by_name
        FROM media_content_requests r
        JOIN profiles p ON p.id = r.requested_by
        WHERE r.status IN ('submitted', 'ready_for_review')
        ORDER BY
            CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
            r.created_at ASC
        LIMIT 10
    """, {})

    # Upcoming scheduled posts (next 7 days)
    upcoming = execute_query("""
        SELECT r.*, p.full_name AS requested_by_name
        FROM media_content_requests r
        JOIN profiles p ON p.id = r.requested_by
        WHERE r.status = 'scheduled' AND r.scheduled_date <= NOW() + INTERVAL '7 days'
        ORDER BY r.scheduled_date ASC
        LIMIT 10
    """, {})

    # My assigned requests (for current user)
    my_assigned = execute_query("""
        SELECT r.*, p.full_name AS requested_by_name
        FROM media_content_requests r
        JOIN profiles p ON p.id = r.requested_by
        WHERE r.assigned_to = :profile_id AND r.status NOT IN ('posted', 'cancelled')
        ORDER BY
            CASE r.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
            r.created_at ASC
        LIMIT 10
    """, {"profile_id": profile["id"]})

    # Total counts
    total_row = execute_single("""
        SELECT
            COUNT(*) FILTER (WHERE status NOT IN ('posted', 'cancelled')) AS active,
            COUNT(*) FILTER (WHERE status = 'posted') AS completed,
            COUNT(*) FILTER (WHERE status = 'submitted') AS new_submissions,
            COUNT(*) FILTER (WHERE assigned_to = :profile_id AND status NOT IN ('posted', 'cancelled')) AS my_assigned
        FROM media_content_requests
    """, {"profile_id": profile["id"]})

    # Upcoming events (next 5 confirmed/draft)
    upcoming_events = execute_query("""
        SELECT ev.*, p.full_name AS created_by_name,
               (SELECT COUNT(*) FROM media_event_attendees a WHERE a.event_id = ev.id) AS attendee_count
        FROM media_events ev
        LEFT JOIN profiles p ON p.id = ev.created_by
        WHERE ev.status IN ('draft', 'confirmed') AND ev.start_date >= NOW()
        ORDER BY ev.start_date ASC
        LIMIT 5
    """, {})

    return {
        "status_counts": {r["status"]: r["count"] for r in status_counts},
        "pending_requests": pending,
        "upcoming_posts": upcoming,
        "my_assigned": my_assigned,
        "totals": total_row or {},
        "upcoming_events": upcoming_events,
    }


# ============================================================================
# ANALYTICS
# ============================================================================

@router.get("/analytics")
async def get_analytics(
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Analytics & reporting for media team."""
    # Build date filter clause for requests
    req_date_clause = ""
    evt_date_clause = ""
    params: dict = {}
    if date_from:
        req_date_clause += " AND r.created_at >= :date_from"
        evt_date_clause += " AND e.created_at >= :date_from"
        params["date_from"] = date_from
    if date_to:
        req_date_clause += " AND r.created_at <= :date_to::timestamp + INTERVAL '1 day'"
        evt_date_clause += " AND e.created_at <= :date_to::timestamp + INTERVAL '1 day'"
        params["date_to"] = date_to

    # --- Summary ---
    summary = execute_single(f"""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE r.status = 'posted') AS completed,
            COUNT(*) FILTER (WHERE r.status NOT IN ('posted', 'cancelled')) AS active,
            COUNT(*) FILTER (WHERE r.status = 'cancelled') AS cancelled,
            ROUND(
                100.0 * COUNT(*) FILTER (WHERE r.revision_count > 0)
                / NULLIF(COUNT(*), 0), 1
            ) AS revision_rate,
            ROUND(
                100.0 * COUNT(*) FILTER (WHERE r.status = 'posted')
                / NULLIF(COUNT(*), 0), 1
            ) AS completion_rate,
            ROUND(
                AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 86400)
                FILTER (WHERE r.status = 'posted'), 1
            ) AS avg_turnaround_days,
            ROUND(
                AVG(EXTRACT(EPOCH FROM (
                    (SELECT MIN(h.created_at) FROM media_request_status_history h
                     WHERE h.request_id = r.id AND h.new_status = 'in_review')
                    - r.created_at
                )) / 3600)
                FILTER (WHERE r.status != 'cancelled'), 1
            ) AS avg_response_hours
        FROM media_content_requests r
        WHERE 1=1 {req_date_clause}
    """, params)

    # --- Status funnel (active statuses) ---
    status_funnel = execute_query(f"""
        SELECT r.status, COUNT(*) AS count
        FROM media_content_requests r
        WHERE r.status NOT IN ('posted', 'cancelled') {req_date_clause}
        GROUP BY r.status
        ORDER BY CASE r.status
            WHEN 'submitted' THEN 1 WHEN 'in_review' THEN 2
            WHEN 'approved' THEN 3 WHEN 'in_production' THEN 4
            WHEN 'ready_for_review' THEN 5 WHEN 'approved_final' THEN 6
            WHEN 'scheduled' THEN 7 ELSE 8 END
    """, params)

    # --- Stage durations (avg days in each status) ---
    stage_durations = execute_query(f"""
        SELECT
            h.new_status AS status,
            ROUND(AVG(EXTRACT(EPOCH FROM (
                COALESCE(next_h.created_at, NOW()) - h.created_at
            )) / 86400), 1) AS avg_days
        FROM media_request_status_history h
        JOIN media_content_requests r ON r.id = h.request_id
        LEFT JOIN LATERAL (
            SELECT h2.created_at FROM media_request_status_history h2
            WHERE h2.request_id = h.request_id AND h2.created_at > h.created_at
            ORDER BY h2.created_at ASC LIMIT 1
        ) next_h ON true
        WHERE 1=1 {req_date_clause}
        GROUP BY h.new_status
        ORDER BY CASE h.new_status
            WHEN 'submitted' THEN 1 WHEN 'in_review' THEN 2
            WHEN 'approved' THEN 3 WHEN 'in_production' THEN 4
            WHEN 'ready_for_review' THEN 5 WHEN 'approved_final' THEN 6
            WHEN 'scheduled' THEN 7 ELSE 8 END
    """, params)

    # --- Content type distribution ---
    content_type_dist = execute_query(f"""
        SELECT r.content_type, COUNT(*) AS count
        FROM media_content_requests r
        WHERE 1=1 {req_date_clause}
        GROUP BY r.content_type
        ORDER BY count DESC
    """, params)

    # --- Platform distribution ---
    platform_dist = execute_query(f"""
        SELECT mp.name, mp.color, COUNT(*) AS count
        FROM media_request_platforms rp
        JOIN media_platforms mp ON mp.id = rp.platform_id
        JOIN media_content_requests r ON r.id = rp.request_id
        WHERE 1=1 {req_date_clause}
        GROUP BY mp.name, mp.color
        ORDER BY count DESC
    """, params)

    # --- Priority breakdown ---
    priority_breakdown = execute_query(f"""
        SELECT r.priority, COUNT(*) AS count
        FROM media_content_requests r
        WHERE 1=1 {req_date_clause}
        GROUP BY r.priority
        ORDER BY CASE r.priority
            WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
            WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END
    """, params)

    # --- Requests over time (weekly) ---
    requests_over_time = execute_query(f"""
        SELECT
            DATE_TRUNC('week', r.created_at)::date AS week,
            COUNT(*) AS submitted,
            COUNT(*) FILTER (WHERE r.status = 'posted') AS completed
        FROM media_content_requests r
        WHERE 1=1 {req_date_clause}
        GROUP BY week
        ORDER BY week
    """, params)

    # --- Turnaround trend (weekly avg days submitted→posted) ---
    turnaround_trend = execute_query(f"""
        SELECT
            DATE_TRUNC('week', r.created_at)::date AS week,
            ROUND(AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 86400), 1) AS avg_days
        FROM media_content_requests r
        WHERE r.status = 'posted' {req_date_clause}
        GROUP BY week
        ORDER BY week
    """, params)

    # --- Team performance (per assignee) ---
    team_performance = execute_query(f"""
        SELECT
            p.full_name AS assignee,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE r.status = 'posted') AS completed,
            COUNT(*) FILTER (WHERE r.status NOT IN ('posted', 'cancelled')) AS active
        FROM media_content_requests r
        JOIN profiles p ON p.id = r.assigned_to
        WHERE r.assigned_to IS NOT NULL {req_date_clause}
        GROUP BY p.full_name
        ORDER BY completed DESC
    """, params)

    # --- Events by type ---
    events_by_type = execute_query(f"""
        SELECT e.event_type AS type, COUNT(*) AS count
        FROM media_events e
        WHERE 1=1 {evt_date_clause}
        GROUP BY e.event_type
        ORDER BY count DESC
    """, params)

    # --- Events by status ---
    events_by_status = execute_query(f"""
        SELECT e.status, COUNT(*) AS count
        FROM media_events e
        WHERE 1=1 {evt_date_clause}
        GROUP BY e.status
        ORDER BY CASE e.status
            WHEN 'draft' THEN 1 WHEN 'confirmed' THEN 2
            WHEN 'in_progress' THEN 3 WHEN 'completed' THEN 4
            WHEN 'cancelled' THEN 5 END
    """, params)

    # --- Events attendance ---
    events_attendance = execute_single(f"""
        SELECT
            COUNT(*) AS total_rsvps,
            COUNT(*) FILTER (WHERE a.rsvp_status = 'accepted') AS accepted,
            COUNT(*) FILTER (WHERE a.rsvp_status = 'declined') AS declined,
            COUNT(*) FILTER (WHERE a.rsvp_status = 'tentative') AS tentative,
            ROUND(
                100.0 * COUNT(*) FILTER (WHERE a.rsvp_status = 'accepted')
                / NULLIF(COUNT(*), 0), 1
            ) AS acceptance_rate
        FROM media_event_attendees a
        JOIN media_events e ON e.id = a.event_id
        WHERE 1=1 {evt_date_clause}
    """, params)

    # --- Events over time (weekly) ---
    events_over_time = execute_query(f"""
        SELECT
            DATE_TRUNC('week', e.created_at)::date AS week,
            COUNT(*) AS count
        FROM media_events e
        WHERE 1=1 {evt_date_clause}
        GROUP BY week
        ORDER BY week
    """, params)

    # --- Discussions (all-time, no date filter) ---
    discussions = execute_single("""
        SELECT
            (SELECT COUNT(*) FROM media_discussion_threads) AS threads,
            (SELECT COUNT(*) FROM media_discussion_replies) AS replies,
            ROUND(
                (SELECT COUNT(*) FROM media_discussion_replies)::numeric
                / NULLIF((SELECT COUNT(*) FROM media_discussion_threads), 0), 1
            ) AS avg_replies_per_thread,
            ROUND(
                100.0 * (SELECT COUNT(*) FROM media_discussion_threads WHERE is_resolved = true)
                / NULLIF((SELECT COUNT(*) FROM media_discussion_threads), 0), 1
            ) AS resolution_rate
    """, {})

    discussions_by_category = execute_query("""
        SELECT c.name AS category, COUNT(t.id) AS threads,
               COALESCE(SUM((SELECT COUNT(*) FROM media_discussion_replies r2 WHERE r2.thread_id = t.id)), 0) AS replies
        FROM media_discussion_categories c
        LEFT JOIN media_discussion_threads t ON t.category_id = c.id
        GROUP BY c.name
        ORDER BY threads DESC
    """, {})

    return {
        "summary": summary or {},
        "status_funnel": status_funnel,
        "stage_durations": stage_durations,
        "content_type_distribution": content_type_dist,
        "platform_distribution": platform_dist,
        "priority_breakdown": priority_breakdown,
        "requests_over_time": [
            {"week": str(r["week"]), "submitted": r["submitted"], "completed": r["completed"]}
            for r in requests_over_time
        ],
        "turnaround_trend": [
            {"week": str(r["week"]), "avg_days": float(r["avg_days"] or 0)}
            for r in turnaround_trend
        ],
        "team_performance": team_performance,
        "events": {
            "by_type": events_by_type,
            "by_status": events_by_status,
            "attendance": events_attendance or {},
            "over_time": [
                {"week": str(r["week"]), "count": r["count"]}
                for r in events_over_time
            ],
        },
        "discussions": {
            **(discussions or {}),
            "by_category": discussions_by_category,
        },
    }


# ============================================================================
# PLATFORMS
# ============================================================================

@router.get("/platforms")
async def list_platforms(
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
    include_inactive: bool = Query(False),
):
    """List all platforms. Active only by default."""
    condition = "" if include_inactive else "WHERE is_active = TRUE"
    platforms = execute_query(f"""
        SELECT * FROM media_platforms {condition} ORDER BY sort_order ASC, name ASC
    """, {})
    return {"platforms": platforms}


@router.post("/platforms")
async def create_platform(
    data: PlatformCreate,
    profile=Depends(require_permissions(Permission.MEDIA_ADMIN)),
):
    """Create a new platform. Admin only."""
    platform = execute_insert("""
        INSERT INTO media_platforms (name, slug, icon, color, url_pattern, is_active, sort_order)
        VALUES (:name, :slug, :icon, :color, :url_pattern, :is_active, :sort_order)
        RETURNING *
    """, {
        "name": data.name,
        "slug": data.slug,
        "icon": data.icon,
        "color": data.color,
        "url_pattern": data.url_pattern,
        "is_active": data.is_active,
        "sort_order": data.sort_order,
    })
    return {"platform": platform}


@router.put("/platforms/{platform_id}")
async def update_platform(
    platform_id: str,
    data: PlatformUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_ADMIN)),
):
    """Update a platform. Admin only."""
    existing = execute_single("SELECT * FROM media_platforms WHERE id = :id", {"id": platform_id})
    if not existing:
        raise HTTPException(404, "Platform not found")

    fields = {}
    for field in ["name", "slug", "icon", "color", "url_pattern", "is_active", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            fields[field] = val

    if fields:
        set_clauses = [f"{k} = :{k}" for k in fields]
        set_clauses.append("updated_at = NOW()")
        fields["id"] = platform_id
        execute_query(f"""
            UPDATE media_platforms SET {', '.join(set_clauses)} WHERE id = :id
        """, fields)

    updated = execute_single("SELECT * FROM media_platforms WHERE id = :id", {"id": platform_id})
    return {"platform": updated}


@router.delete("/platforms/{platform_id}")
async def delete_platform(
    platform_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_ADMIN)),
):
    """Delete (deactivate) a platform. Admin only."""
    existing = execute_single("SELECT * FROM media_platforms WHERE id = :id", {"id": platform_id})
    if not existing:
        raise HTTPException(404, "Platform not found")

    execute_query("""
        UPDATE media_platforms SET is_active = FALSE, updated_at = NOW() WHERE id = :id
    """, {"id": platform_id})
    return {"success": True}


@router.put("/platforms/reorder")
async def reorder_platforms(
    data: PlatformReorder,
    profile=Depends(require_permissions(Permission.MEDIA_ADMIN)),
):
    """Reorder platforms. Admin only."""
    for i, pid in enumerate(data.platform_ids):
        execute_query("""
            UPDATE media_platforms SET sort_order = :order, updated_at = NOW() WHERE id = :id
        """, {"id": pid, "order": i})

    platforms = execute_query("SELECT * FROM media_platforms ORDER BY sort_order ASC, name ASC", {})
    return {"platforms": platforms}


# ============================================================================
# EVENTS
# ============================================================================

@router.post("/events")
async def create_event(
    data: EventCreate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Create an event. Media team only."""
    if data.event_type not in EVENT_TYPES:
        raise HTTPException(400, f"Invalid event_type. Must be one of: {EVENT_TYPES}")
    if data.status not in EVENT_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {EVENT_STATUSES}")

    row = execute_insert("""
        INSERT INTO media_events
            (title, description, event_type, status, start_date, end_date, duration_minutes,
             venue_name, address, virtual_link, is_virtual, created_by, request_id, color, notes, metadata)
        VALUES (:title, :description, :event_type, :status, :start_date, :end_date, :duration_minutes,
                :venue_name, :address, :virtual_link, :is_virtual, :created_by, :request_id, :color, :notes, :metadata)
        RETURNING *
    """, {
        "title": data.title,
        "description": data.description,
        "event_type": data.event_type,
        "status": data.status,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "duration_minutes": data.duration_minutes,
        "venue_name": data.venue_name,
        "address": data.address,
        "virtual_link": data.virtual_link,
        "is_virtual": data.is_virtual,
        "created_by": profile["id"],
        "request_id": data.request_id,
        "color": data.color,
        "notes": data.notes,
        "metadata": json.dumps(data.metadata or {}),
    })

    return {"event": row}


@router.get("/events")
async def list_events(
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
    event_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List events with filters. All users can view."""
    conditions = []
    params = {"limit": limit, "offset": offset}

    if event_type:
        conditions.append("e.event_type = :event_type")
        params["event_type"] = event_type
    if status_filter:
        conditions.append("e.status = :status")
        params["status"] = status_filter
    if start:
        conditions.append("e.start_date >= :start")
        params["start"] = start
    if end:
        conditions.append("e.start_date <= :end")
        params["end"] = end
    if search:
        conditions.append("(e.title ILIKE :search OR e.description ILIKE :search)")
        params["search"] = f"%{search}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    rows = execute_query(f"""
        SELECT e.*, p.full_name AS created_by_name,
               (SELECT COUNT(*) FROM media_event_attendees a WHERE a.event_id = e.id) AS attendee_count
        FROM media_events e
        LEFT JOIN profiles p ON p.id = e.created_by
        {where}
        ORDER BY e.start_date ASC
        LIMIT :limit OFFSET :offset
    """, params)

    count_row = execute_single(f"""
        SELECT COUNT(*) as total FROM media_events e {where}
    """, params)

    return {"events": rows, "total": count_row["total"] if count_row else 0}


@router.get("/events/{event_id}")
async def get_event(
    event_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Get event detail with attendees, checklist, agenda."""
    row = execute_single("""
        SELECT e.*, p.full_name AS created_by_name
        FROM media_events e
        LEFT JOIN profiles p ON p.id = e.created_by
        WHERE e.id = :id
    """, {"id": event_id})
    if not row:
        raise HTTPException(404, "Event not found")

    # Attendees
    attendees = execute_query("""
        SELECT a.*, p.full_name AS profile_name
        FROM media_event_attendees a
        JOIN profiles p ON p.id = a.profile_id
        WHERE a.event_id = :event_id
        ORDER BY a.created_at ASC
    """, {"event_id": event_id})

    # Checklist
    checklist = execute_query("""
        SELECT c.*, p.full_name AS assigned_to_name
        FROM media_event_checklist c
        LEFT JOIN profiles p ON p.id = c.assigned_to
        WHERE c.event_id = :event_id
        ORDER BY c.sort_order ASC, c.created_at ASC
    """, {"event_id": event_id})

    # Agenda
    agenda = execute_query("""
        SELECT * FROM media_event_agenda
        WHERE event_id = :event_id
        ORDER BY sort_order ASC, start_time ASC NULLS LAST
    """, {"event_id": event_id})

    # Linked request
    linked_request = None
    if row.get("request_id"):
        linked_request = execute_single("""
            SELECT id, title, status, content_type FROM media_content_requests WHERE id = :id
        """, {"id": row["request_id"]})

    row["attendees"] = attendees
    row["checklist"] = checklist
    row["agenda"] = agenda
    row["linked_request"] = linked_request

    return {"event": row}


@router.put("/events/{event_id}")
async def update_event(
    event_id: str,
    data: EventUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Update an event. Media team only."""
    existing = execute_single("SELECT * FROM media_events WHERE id = :id", {"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")

    fields = {}
    for field in ["title", "description", "event_type", "start_date", "end_date",
                  "duration_minutes", "venue_name", "address", "virtual_link",
                  "is_virtual", "request_id", "color", "notes"]:
        val = getattr(data, field, None)
        if val is not None:
            if field == "event_type" and val not in EVENT_TYPES:
                raise HTTPException(400, f"Invalid event_type")
            fields[field] = val
    if data.metadata is not None:
        fields["metadata"] = json.dumps(data.metadata)

    if fields:
        set_clauses = [f"{k} = :{k}" for k in fields]
        set_clauses.append("updated_at = NOW()")
        fields["id"] = event_id
        execute_query(f"""
            UPDATE media_events SET {', '.join(set_clauses)} WHERE id = :id
        """, fields)

    updated = execute_single("SELECT * FROM media_events WHERE id = :id", {"id": event_id})
    return {"event": updated}


@router.delete("/events/{event_id}")
async def cancel_event(
    event_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Cancel an event (set status=cancelled)."""
    existing = execute_single("SELECT * FROM media_events WHERE id = :id", {"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")

    execute_query("""
        UPDATE media_events SET status = 'cancelled', updated_at = NOW() WHERE id = :id
    """, {"id": event_id})

    return {"success": True}


@router.put("/events/{event_id}/status")
async def update_event_status(
    event_id: str,
    data: EventStatusUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Update event status with transition validation."""
    existing = execute_single("SELECT * FROM media_events WHERE id = :id", {"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")

    if data.status not in EVENT_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of: {EVENT_STATUSES}")

    # Validate transition
    allowed = EVENT_TRANSITIONS.get(existing["status"], [])
    if data.status not in allowed:
        raise HTTPException(400, f"Invalid transition from '{existing['status']}' to '{data.status}'. Allowed: {allowed}")

    execute_query("""
        UPDATE media_events SET status = :status, updated_at = NOW() WHERE id = :id
    """, {"id": event_id, "status": data.status})

    updated = execute_single("SELECT * FROM media_events WHERE id = :id", {"id": event_id})
    return {"event": updated}


# --- Event Attendees ---

@router.post("/events/{event_id}/attendees")
async def add_event_attendee(
    event_id: str,
    data: AttendeeAdd,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Add/invite an attendee to an event."""
    existing = execute_single("SELECT id FROM media_events WHERE id = :id", {"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")

    try:
        row = execute_insert("""
            INSERT INTO media_event_attendees (event_id, profile_id, rsvp_status, role, notes)
            VALUES (:event_id, :profile_id, :rsvp_status, :role, :notes)
            RETURNING *
        """, {
            "event_id": event_id,
            "profile_id": data.profile_id,
            "rsvp_status": data.rsvp_status,
            "role": data.role,
            "notes": data.notes,
        })
    except Exception:
        raise HTTPException(409, "Attendee already added to this event")

    return {"attendee": row}


@router.put("/events/{event_id}/attendees/{profile_id}")
async def update_event_attendee(
    event_id: str,
    profile_id: str,
    data: AttendeeUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Update attendee role/status. Media team only."""
    existing = execute_single("""
        SELECT * FROM media_event_attendees WHERE event_id = :event_id AND profile_id = :profile_id
    """, {"event_id": event_id, "profile_id": profile_id})
    if not existing:
        raise HTTPException(404, "Attendee not found")

    fields = {}
    if data.rsvp_status is not None:
        if data.rsvp_status not in RSVP_STATUSES:
            raise HTTPException(400, f"Invalid rsvp_status")
        fields["rsvp_status"] = data.rsvp_status
        fields["responded_at"] = "NOW()"
    if data.role is not None:
        fields["role"] = data.role
    if data.notes is not None:
        fields["notes"] = data.notes

    if fields:
        set_clauses = []
        params = {"event_id": event_id, "profile_id": profile_id}
        for k, v in fields.items():
            if v == "NOW()":
                set_clauses.append(f"{k} = NOW()")
            else:
                set_clauses.append(f"{k} = :{k}")
                params[k] = v
        execute_query(f"""
            UPDATE media_event_attendees SET {', '.join(set_clauses)}
            WHERE event_id = :event_id AND profile_id = :profile_id
        """, params)

    updated = execute_single("""
        SELECT a.*, p.full_name AS profile_name
        FROM media_event_attendees a
        JOIN profiles p ON p.id = a.profile_id
        WHERE a.event_id = :event_id AND a.profile_id = :profile_id
    """, {"event_id": event_id, "profile_id": profile_id})
    return {"attendee": updated}


@router.delete("/events/{event_id}/attendees/{profile_id}")
async def remove_event_attendee(
    event_id: str,
    profile_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Remove an attendee from an event."""
    execute_query("""
        DELETE FROM media_event_attendees WHERE event_id = :event_id AND profile_id = :profile_id
    """, {"event_id": event_id, "profile_id": profile_id})
    return {"success": True}


@router.put("/events/{event_id}/rsvp")
async def rsvp_event(
    event_id: str,
    data: RSVPUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Self-RSVP for the current user."""
    if data.rsvp_status not in RSVP_STATUSES:
        raise HTTPException(400, f"Invalid rsvp_status")

    existing = execute_single("SELECT id FROM media_events WHERE id = :id", {"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")

    # Upsert: create attendee row if not exists, or update
    execute_query("""
        INSERT INTO media_event_attendees (event_id, profile_id, rsvp_status, responded_at)
        VALUES (:event_id, :profile_id, :rsvp_status, NOW())
        ON CONFLICT (event_id, profile_id)
        DO UPDATE SET rsvp_status = :rsvp_status, responded_at = NOW()
    """, {
        "event_id": event_id,
        "profile_id": profile["id"],
        "rsvp_status": data.rsvp_status,
    })

    return {"success": True, "rsvp_status": data.rsvp_status}


# --- Event Checklist ---

@router.post("/events/{event_id}/checklist")
async def add_checklist_item(
    event_id: str,
    data: ChecklistItemCreate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Add a checklist item to an event."""
    existing = execute_single("SELECT id FROM media_events WHERE id = :id", {"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")

    row = execute_insert("""
        INSERT INTO media_event_checklist (event_id, label, assigned_to, sort_order)
        VALUES (:event_id, :label, :assigned_to, :sort_order)
        RETURNING *
    """, {
        "event_id": event_id,
        "label": data.label,
        "assigned_to": data.assigned_to,
        "sort_order": data.sort_order,
    })
    return {"item": row}


@router.put("/events/{event_id}/checklist/{item_id}")
async def update_checklist_item(
    event_id: str,
    item_id: str,
    data: ChecklistItemUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Toggle/update a checklist item. Any user can toggle completion."""
    existing = execute_single("""
        SELECT * FROM media_event_checklist WHERE id = :id AND event_id = :event_id
    """, {"id": item_id, "event_id": event_id})
    if not existing:
        raise HTTPException(404, "Checklist item not found")

    fields = {}
    for field in ["label", "is_completed", "assigned_to", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            fields[field] = val

    if fields:
        set_clauses = [f"{k} = :{k}" for k in fields]
        fields["id"] = item_id
        execute_query(f"""
            UPDATE media_event_checklist SET {', '.join(set_clauses)} WHERE id = :id
        """, fields)

    updated = execute_single("SELECT * FROM media_event_checklist WHERE id = :id", {"id": item_id})
    return {"item": updated}


@router.delete("/events/{event_id}/checklist/{item_id}")
async def delete_checklist_item(
    event_id: str,
    item_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Remove a checklist item."""
    execute_query("""
        DELETE FROM media_event_checklist WHERE id = :id AND event_id = :event_id
    """, {"id": item_id, "event_id": event_id})
    return {"success": True}


# --- Event Agenda ---

@router.post("/events/{event_id}/agenda")
async def add_agenda_item(
    event_id: str,
    data: AgendaItemCreate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Add an agenda item to an event."""
    existing = execute_single("SELECT id FROM media_events WHERE id = :id", {"id": event_id})
    if not existing:
        raise HTTPException(404, "Event not found")

    row = execute_insert("""
        INSERT INTO media_event_agenda (event_id, title, description, start_time, duration_minutes, sort_order)
        VALUES (:event_id, :title, :description, :start_time, :duration_minutes, :sort_order)
        RETURNING *
    """, {
        "event_id": event_id,
        "title": data.title,
        "description": data.description,
        "start_time": data.start_time,
        "duration_minutes": data.duration_minutes,
        "sort_order": data.sort_order,
    })
    return {"item": row}


@router.put("/events/{event_id}/agenda/{item_id}")
async def update_agenda_item(
    event_id: str,
    item_id: str,
    data: AgendaItemUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Update an agenda item."""
    existing = execute_single("""
        SELECT * FROM media_event_agenda WHERE id = :id AND event_id = :event_id
    """, {"id": item_id, "event_id": event_id})
    if not existing:
        raise HTTPException(404, "Agenda item not found")

    fields = {}
    for field in ["title", "description", "start_time", "duration_minutes", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            fields[field] = val

    if fields:
        set_clauses = [f"{k} = :{k}" for k in fields]
        fields["id"] = item_id
        execute_query(f"""
            UPDATE media_event_agenda SET {', '.join(set_clauses)} WHERE id = :id
        """, fields)

    updated = execute_single("SELECT * FROM media_event_agenda WHERE id = :id", {"id": item_id})
    return {"item": updated}


@router.delete("/events/{event_id}/agenda/{item_id}")
async def delete_agenda_item(
    event_id: str,
    item_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Remove an agenda item."""
    execute_query("""
        DELETE FROM media_event_agenda WHERE id = :id AND event_id = :event_id
    """, {"id": item_id, "event_id": event_id})
    return {"success": True}


# ============================================================================
# DISCUSSIONS
# ============================================================================

@router.get("/discussions/categories")
async def list_discussion_categories(
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """List discussion categories with thread counts."""
    rows = execute_query("""
        SELECT * FROM media_discussion_categories ORDER BY sort_order ASC, name ASC
    """, {})
    return {"categories": rows}


@router.post("/discussions/categories")
async def create_discussion_category(
    data: DiscussionCategoryCreate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Create a discussion category. Media team only."""
    row = execute_insert("""
        INSERT INTO media_discussion_categories (name, description, slug, icon, created_by, sort_order)
        VALUES (:name, :description, :slug, :icon, :created_by, :sort_order)
        RETURNING *
    """, {
        "name": data.name,
        "description": data.description,
        "slug": data.slug,
        "icon": data.icon,
        "created_by": profile["id"],
        "sort_order": data.sort_order,
    })
    return {"category": row}


@router.put("/discussions/categories/{category_id}")
async def update_discussion_category(
    category_id: str,
    data: DiscussionCategoryUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Update a discussion category."""
    existing = execute_single("SELECT * FROM media_discussion_categories WHERE id = :id", {"id": category_id})
    if not existing:
        raise HTTPException(404, "Category not found")

    fields = {}
    for field in ["name", "description", "slug", "icon", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            fields[field] = val

    if fields:
        set_clauses = [f"{k} = :{k}" for k in fields]
        set_clauses.append("updated_at = NOW()")
        fields["id"] = category_id
        execute_query(f"""
            UPDATE media_discussion_categories SET {', '.join(set_clauses)} WHERE id = :id
        """, fields)

    updated = execute_single("SELECT * FROM media_discussion_categories WHERE id = :id", {"id": category_id})
    return {"category": updated}


@router.delete("/discussions/categories/{category_id}")
async def delete_discussion_category(
    category_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_ADMIN)),
):
    """Delete an empty discussion category. Admin only."""
    existing = execute_single("SELECT * FROM media_discussion_categories WHERE id = :id", {"id": category_id})
    if not existing:
        raise HTTPException(404, "Category not found")

    if existing["thread_count"] > 0:
        raise HTTPException(400, "Cannot delete a category that has threads. Move or delete threads first.")

    execute_query("DELETE FROM media_discussion_categories WHERE id = :id", {"id": category_id})
    return {"success": True}


# --- Discussion Threads ---

@router.get("/discussions/threads")
async def list_discussion_threads(
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
    category_slug: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query("recent"),  # recent, popular, oldest
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List discussion threads with filters."""
    conditions = []
    params = {"limit": limit, "offset": offset}

    if category_slug:
        conditions.append("c.slug = :category_slug")
        params["category_slug"] = category_slug
    if search:
        conditions.append("(t.title ILIKE :search OR t.content ILIKE :search)")
        params["search"] = f"%{search}%"

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    order = "t.last_activity_at DESC"
    if sort == "popular":
        order = "t.reply_count DESC, t.last_activity_at DESC"
    elif sort == "oldest":
        order = "t.created_at ASC"

    rows = execute_query(f"""
        SELECT t.*, p.full_name AS author_name, c.name AS category_name, c.slug AS category_slug,
               p_last.full_name AS last_reply_by_name
        FROM media_discussion_threads t
        JOIN media_discussion_categories c ON c.id = t.category_id
        JOIN profiles p ON p.id = t.author_id
        LEFT JOIN profiles p_last ON p_last.id = t.last_reply_by
        {where}
        ORDER BY t.is_pinned DESC, {order}
        LIMIT :limit OFFSET :offset
    """, params)

    count_row = execute_single(f"""
        SELECT COUNT(*) as total
        FROM media_discussion_threads t
        JOIN media_discussion_categories c ON c.id = t.category_id
        {where}
    """, params)

    return {"threads": rows, "total": count_row["total"] if count_row else 0}


@router.get("/discussions/threads/{thread_id}")
async def get_discussion_thread(
    thread_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Get thread detail. Increments view count."""
    row = execute_single("""
        SELECT t.*, p.full_name AS author_name, c.name AS category_name, c.slug AS category_slug
        FROM media_discussion_threads t
        JOIN media_discussion_categories c ON c.id = t.category_id
        JOIN profiles p ON p.id = t.author_id
        WHERE t.id = :id
    """, {"id": thread_id})
    if not row:
        raise HTTPException(404, "Thread not found")

    # Increment view count
    execute_query("""
        UPDATE media_discussion_threads SET view_count = view_count + 1 WHERE id = :id
    """, {"id": thread_id})

    return {"thread": row}


@router.post("/discussions/threads")
async def create_discussion_thread(
    data: DiscussionThreadCreate,
    profile=Depends(require_permissions(Permission.MEDIA_CREATE)),
):
    """Create a new discussion thread. Any user."""
    # Verify category exists
    cat = execute_single("SELECT id FROM media_discussion_categories WHERE id = :id", {"id": data.category_id})
    if not cat:
        raise HTTPException(404, "Category not found")

    row = execute_insert("""
        INSERT INTO media_discussion_threads (category_id, author_id, title, content)
        VALUES (:category_id, :author_id, :title, :content)
        RETURNING *
    """, {
        "category_id": data.category_id,
        "author_id": profile["id"],
        "title": data.title,
        "content": data.content,
    })

    row["author_name"] = profile.get("full_name", "Unknown")
    return {"thread": row}


@router.put("/discussions/threads/{thread_id}")
async def update_discussion_thread(
    thread_id: str,
    data: DiscussionThreadUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Edit thread. Author or media team."""
    existing = execute_single("SELECT * FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    if not existing:
        raise HTTPException(404, "Thread not found")

    is_author = existing["author_id"] == profile["id"]
    if not is_author and not is_media_team(profile):
        raise HTTPException(403, "Access denied")

    fields = {}
    if data.title is not None:
        fields["title"] = data.title
    if data.content is not None:
        fields["content"] = data.content

    if fields:
        set_clauses = [f"{k} = :{k}" for k in fields]
        set_clauses.append("updated_at = NOW()")
        fields["id"] = thread_id
        execute_query(f"""
            UPDATE media_discussion_threads SET {', '.join(set_clauses)} WHERE id = :id
        """, fields)

    updated = execute_single("SELECT * FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    return {"thread": updated}


@router.delete("/discussions/threads/{thread_id}")
async def delete_discussion_thread(
    thread_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Delete a thread. Author or media team."""
    existing = execute_single("SELECT * FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    if not existing:
        raise HTTPException(404, "Thread not found")

    is_author = existing["author_id"] == profile["id"]
    if not is_author and not is_media_team(profile):
        raise HTTPException(403, "Access denied")

    execute_query("DELETE FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    return {"success": True}


@router.post("/discussions/threads/{thread_id}/pin")
async def pin_discussion_thread(
    thread_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Pin/unpin a thread. Media team only."""
    existing = execute_single("SELECT * FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    if not existing:
        raise HTTPException(404, "Thread not found")

    new_val = not existing["is_pinned"]
    execute_query("""
        UPDATE media_discussion_threads SET is_pinned = :val, updated_at = NOW() WHERE id = :id
    """, {"id": thread_id, "val": new_val})

    return {"success": True, "is_pinned": new_val}


@router.post("/discussions/threads/{thread_id}/resolve")
async def resolve_discussion_thread(
    thread_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Resolve/unresolve a thread. Author or media team."""
    existing = execute_single("SELECT * FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    if not existing:
        raise HTTPException(404, "Thread not found")

    is_author = existing["author_id"] == profile["id"]
    if not is_author and not is_media_team(profile):
        raise HTTPException(403, "Access denied")

    new_val = not existing["is_resolved"]
    execute_query("""
        UPDATE media_discussion_threads SET is_resolved = :val, updated_at = NOW() WHERE id = :id
    """, {"id": thread_id, "val": new_val})

    return {"success": True, "is_resolved": new_val}


@router.post("/discussions/threads/{thread_id}/lock")
async def lock_discussion_thread(
    thread_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_MANAGE)),
):
    """Lock/unlock a thread. Media team only."""
    existing = execute_single("SELECT * FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    if not existing:
        raise HTTPException(404, "Thread not found")

    new_val = not existing["is_locked"]
    execute_query("""
        UPDATE media_discussion_threads SET is_locked = :val, updated_at = NOW() WHERE id = :id
    """, {"id": thread_id, "val": new_val})

    return {"success": True, "is_locked": new_val}


# --- Discussion Replies ---

@router.get("/discussions/threads/{thread_id}/replies")
async def list_discussion_replies(
    thread_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """List all replies for a thread (flat, frontend builds tree)."""
    existing = execute_single("SELECT id FROM media_discussion_threads WHERE id = :id", {"id": thread_id})
    if not existing:
        raise HTTPException(404, "Thread not found")

    rows = execute_query("""
        SELECT r.*, p.full_name AS author_name
        FROM media_discussion_replies r
        JOIN profiles p ON p.id = r.author_id
        WHERE r.thread_id = :thread_id
        ORDER BY r.created_at ASC
    """, {"thread_id": thread_id})

    return {"replies": rows}


@router.post("/discussions/replies")
async def create_discussion_reply(
    data: DiscussionReplyCreate,
    profile=Depends(require_permissions(Permission.MEDIA_CREATE)),
):
    """Create a reply. Any user. Supports nested via parent_reply_id."""
    thread = execute_single("SELECT * FROM media_discussion_threads WHERE id = :id", {"id": data.thread_id})
    if not thread:
        raise HTTPException(404, "Thread not found")

    if thread["is_locked"]:
        raise HTTPException(403, "Thread is locked. No new replies allowed.")

    params = {
        "thread_id": data.thread_id,
        "author_id": profile["id"],
        "content": data.content,
        "parent_reply_id": data.parent_reply_id,
    }

    row = execute_insert("""
        INSERT INTO media_discussion_replies (thread_id, author_id, content, parent_reply_id)
        VALUES (:thread_id, :author_id, :content, :parent_reply_id)
        RETURNING *
    """, params)

    row["author_name"] = profile.get("full_name", "Unknown")
    return {"reply": row}


@router.put("/discussions/replies/{reply_id}")
async def update_discussion_reply(
    reply_id: str,
    data: DiscussionReplyUpdate,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Edit a reply. Author or media team."""
    existing = execute_single("SELECT * FROM media_discussion_replies WHERE id = :id", {"id": reply_id})
    if not existing:
        raise HTTPException(404, "Reply not found")

    is_author = existing["author_id"] == profile["id"]
    if not is_author and not is_media_team(profile):
        raise HTTPException(403, "Access denied")

    execute_query("""
        UPDATE media_discussion_replies SET content = :content, is_edited = TRUE, updated_at = NOW()
        WHERE id = :id
    """, {"id": reply_id, "content": data.content})

    updated = execute_single("""
        SELECT r.*, p.full_name AS author_name
        FROM media_discussion_replies r
        JOIN profiles p ON p.id = r.author_id
        WHERE r.id = :id
    """, {"id": reply_id})
    return {"reply": updated}


@router.delete("/discussions/replies/{reply_id}")
async def delete_discussion_reply(
    reply_id: str,
    profile=Depends(require_permissions(Permission.MEDIA_VIEW)),
):
    """Delete a reply. Author or media team."""
    existing = execute_single("SELECT * FROM media_discussion_replies WHERE id = :id", {"id": reply_id})
    if not existing:
        raise HTTPException(404, "Reply not found")

    is_author = existing["author_id"] == profile["id"]
    if not is_author and not is_media_team(profile):
        raise HTTPException(403, "Access denied")

    execute_query("DELETE FROM media_discussion_replies WHERE id = :id", {"id": reply_id})
    return {"success": True}
