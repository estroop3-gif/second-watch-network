"""
CRM API — Sales Rep Endpoints
Contacts, activities, interaction counts, and follow-ups.
"""
import json
from psycopg2.extras import Json as PgJson
from fastapi import APIRouter, HTTPException, Depends, Query, Response, UploadFile, File
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime

from app.core.database import get_client, execute_query, execute_single, execute_insert, execute_update, execute_delete
from app.core.deps import get_user_profile
from app.core.permissions import Permission, require_permissions, has_permission

router = APIRouter()


# ============================================================================
# Pydantic Schemas
# ============================================================================

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = "US"
    temperature: Optional[str] = "cold"
    source: Optional[str] = "outbound"
    source_detail: Optional[str] = None
    tags: Optional[List[str]] = []
    custom_fields: Optional[Dict[str, Any]] = {}
    notes: Optional[str] = None
    visibility: Optional[str] = "team"


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip: Optional[str] = None
    country: Optional[str] = None
    temperature: Optional[str] = None
    source: Optional[str] = None
    source_detail: Optional[str] = None
    status: Optional[str] = None
    do_not_email: Optional[bool] = None
    do_not_call: Optional[bool] = None
    do_not_text: Optional[bool] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    visibility: Optional[str] = None


class ActivityCreate(BaseModel):
    contact_id: str
    deal_id: Optional[str] = None
    activity_type: str
    subject: Optional[str] = None
    description: Optional[str] = None
    outcome: Optional[str] = None
    activity_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    follow_up_date: Optional[str] = None
    follow_up_notes: Optional[str] = None


class ActivityUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    outcome: Optional[str] = None
    activity_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    follow_up_date: Optional[str] = None
    follow_up_notes: Optional[str] = None


class InteractionIncrement(BaseModel):
    interaction_type: str  # calls, emails, texts, meetings, demos, other_interactions


class LinkProfileRequest(BaseModel):
    profile_id: str


class DealCreate(BaseModel):
    contact_id: str
    title: str
    description: Optional[str] = None
    product_type: Optional[str] = "backlot_membership"
    product_detail: Optional[Dict[str, Any]] = {}
    stage: Optional[str] = "lead"
    amount_cents: Optional[int] = 0
    currency: Optional[str] = "USD"
    probability: Optional[int] = None  # Auto-set from stage if None
    expected_close_date: Optional[str] = None
    competitor: Optional[str] = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    product_type: Optional[str] = None
    product_detail: Optional[Dict[str, Any]] = None
    amount_cents: Optional[int] = None
    currency: Optional[str] = None
    probability: Optional[int] = None
    expected_close_date: Optional[str] = None
    close_reason: Optional[str] = None
    competitor: Optional[str] = None


class StageChangeRequest(BaseModel):
    stage: str
    notes: Optional[str] = None
    close_reason: Optional[str] = None


# ============================================================================
# Sidebar Badge Counts
# ============================================================================

@router.get("/sidebar-badges")
async def get_sidebar_badges(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Return badge counts for all CRM sidebar tabs.

    Badges show activity *since the user last viewed each tab*. First-time
    users (no row in crm_tab_views) see the old time-window behaviour so badges
    look normal on first visit, then clear after first click.
    """
    is_admin = has_permission(profile, Permission.CRM_MANAGE)
    rep_id = profile["id"]

    # Fetch last-viewed timestamps (max ~10 rows)
    view_rows = execute_query(
        "SELECT tab_key, last_viewed_at FROM crm_tab_views WHERE profile_id = :pid",
        {"pid": rep_id},
    )
    views = {r["tab_key"]: r["last_viewed_at"] for r in (view_rows or [])}

    # Build rep-scoping conditions
    contact_scope = "" if is_admin else "AND (c.assigned_rep_id = :rep_id OR c.visibility = 'team')"
    deal_scope = "" if is_admin else "AND d.assigned_rep_id = :rep_id"
    activity_scope = "" if is_admin else "AND a.rep_id = :rep_id"
    log_scope = "" if is_admin else "AND cl.rep_id = :rep_id"
    review_scope = "" if is_admin else "AND r.rep_id = :rep_id"

    params: Dict[str, Any] = {
        "rep_id": rep_id,
        "contacts_viewed": views.get("contacts"),
        "dnc_viewed": views.get("dnc"),
        "pipeline_viewed": views.get("pipeline"),
        "calendar_viewed": views.get("calendar"),
        "interactions_viewed": views.get("interactions"),
        "goals_viewed": views.get("goals"),
        "log_viewed": views.get("log"),
        "reviews_viewed": views.get("reviews"),
        "training_viewed": views.get("training"),
        "discussions_viewed": views.get("discussions"),
        "bc_viewed": views.get("business_card"),
    }

    row = execute_single(
        f"""
        SELECT
            -- Contacts: new since last view (fallback: last 24h)
            (SELECT COUNT(*) FROM crm_contacts c
             WHERE c.status != 'inactive'
             AND c.created_at > COALESCE(:contacts_viewed, NOW() - INTERVAL '24 hours')
             {contact_scope}) as new_contacts,

            -- DNC: newly flagged since last view (fallback: last 24h)
            (SELECT COUNT(*) FROM crm_contacts c
             WHERE (c.do_not_email = true OR c.do_not_call = true OR c.do_not_text = true OR c.status = 'do_not_contact')
             AND c.updated_at > COALESCE(:dnc_viewed, NOW() - INTERVAL '24 hours')
             {contact_scope}) as dnc_count,

            -- Pipeline: deals updated since last view (fallback: last 24h)
            (SELECT COUNT(*) FROM crm_deals d
             WHERE d.updated_at > COALESCE(:pipeline_viewed, NOW() - INTERVAL '24 hours')
             AND d.stage NOT IN ('won', 'lost')
             {deal_scope}) as active_deals,

            -- Calendar: follow-ups that became due since last view (fallback: last 24h)
            (SELECT COUNT(*) FROM crm_activities a
             WHERE a.follow_up_date IS NOT NULL
             AND a.follow_up_date <= CURRENT_DATE
             AND a.follow_up_completed = false
             AND GREATEST(a.created_at, a.follow_up_date::timestamptz) > COALESCE(:calendar_viewed, NOW() - INTERVAL '24 hours')
             {activity_scope}) as due_followups,

            -- Interactions: today's logged count, clears on tab view (fallback: today)
            (CASE
              WHEN :interactions_viewed IS NOT NULL AND CAST(:interactions_viewed AS date) >= CURRENT_DATE
              THEN 0
              ELSE (SELECT COALESCE(SUM(ic.calls + ic.emails + ic.texts + ic.meetings + ic.demos), 0)
                    FROM crm_interaction_counts ic
                    WHERE ic.count_date = CURRENT_DATE
                    AND ic.rep_id = :rep_id)
            END) as todays_interactions,

            -- Goals: new goals since last view (fallback: last 7d)
            (SELECT COUNT(*) FROM crm_sales_goals g
             WHERE g.created_at > COALESCE(:goals_viewed, NOW() - INTERVAL '7 days')
             AND (g.rep_id = :rep_id OR g.rep_id IS NULL)) as active_goals,

            -- Log: new entries since last view (fallback: last 24h)
            (SELECT COUNT(*) FROM crm_customer_log cl
             WHERE cl.created_at > COALESCE(:log_viewed, NOW() - INTERVAL '24 hours')
             {log_scope}) as open_logs,

            -- Reviews: new since last view (fallback: last 30d)
            (SELECT COUNT(*) FROM crm_rep_reviews r
             WHERE r.created_at > COALESCE(:reviews_viewed, NOW() - INTERVAL '30 days')
             {review_scope}) as recent_reviews,

            -- Training: new resources since last view (fallback: last 7d)
            (SELECT COUNT(*) FROM crm_training_resources tr
             WHERE tr.created_at > COALESCE(:training_viewed, NOW() - INTERVAL '7 days')) as new_training,

            -- Discussions: new threads since last view (fallback: last 7d)
            (SELECT COUNT(*) FROM crm_discussion_threads dt
             WHERE dt.created_at > COALESCE(:discussions_viewed, NOW() - INTERVAL '7 days')) as new_discussions,

            -- Business Card: updates since last view (fallback: last 7d)
            (SELECT COUNT(*) FROM crm_business_cards bc
             WHERE bc.profile_id = :rep_id
             AND bc.status IN ('approved', 'rejected', 'printed')
             AND bc.updated_at > COALESCE(:bc_viewed, NOW() - INTERVAL '7 days')) as card_updates,

            -- My Contacts: contacts assigned to this rep (unchanged — not badge-clearable)
            (SELECT COUNT(*) FROM crm_contacts c
             WHERE c.assigned_rep_id = :rep_id AND c.status = 'active') as my_contacts,

            -- New Leads: unviewed assignments for this rep (unchanged — per-item tracking)
            (SELECT COUNT(DISTINCT cal.contact_id) FROM crm_contact_assignment_log cal
             JOIN crm_contacts c2 ON c2.id = cal.contact_id AND c2.status != 'inactive'
             WHERE cal.to_rep_id = :rep_id AND cal.viewed_at IS NULL) as new_leads
        """,
        params,
    )

    return {
        "contacts": row["new_contacts"] if row else 0,
        "dnc": row["dnc_count"] if row else 0,
        "pipeline": row["active_deals"] if row else 0,
        "calendar": row["due_followups"] if row else 0,
        "interactions": row["todays_interactions"] if row else 0,
        "goals": row["active_goals"] if row else 0,
        "log": row["open_logs"] if row else 0,
        "reviews": row["recent_reviews"] if row else 0,
        "training": row["new_training"] if row else 0,
        "discussions": row["new_discussions"] if row else 0,
        "business_card": row["card_updates"] if row else 0,
        "my_contacts": row["my_contacts"] if row else 0,
        "new_leads": row["new_leads"] if row else 0,
    }


# ============================================================================
# New Leads (recently assigned, not yet viewed by rep)
# ============================================================================

@router.get("/new-leads")
async def get_new_leads(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get contacts recently assigned to this rep that haven't been viewed yet."""
    rep_id = profile["id"]
    rows = execute_query(
        """
        SELECT DISTINCT ON (c.id) c.*,
               p.full_name as assigned_rep_name,
               cal.assigned_at as assignment_date,
               cal.assignment_type,
               cal.notes as assignment_notes,
               ap.full_name as assigned_by_name,
               (SELECT COUNT(*) FROM crm_activities a WHERE a.contact_id = c.id) as activity_count,
               (SELECT MAX(a.activity_date) FROM crm_activities a WHERE a.contact_id = c.id) as last_activity_date,
               (SELECT COUNT(*) FROM crm_email_threads et WHERE et.contact_id = c.id) as email_thread_count
        FROM crm_contact_assignment_log cal
        JOIN crm_contacts c ON c.id = cal.contact_id
        LEFT JOIN profiles p ON p.id = c.assigned_rep_id
        LEFT JOIN profiles ap ON ap.id = cal.assigned_by
        WHERE cal.to_rep_id = :rep_id
          AND cal.viewed_at IS NULL
          AND c.status != 'inactive'
        ORDER BY c.id, cal.assigned_at DESC
        """,
        {"rep_id": rep_id},
    )
    return {"contacts": rows, "total": len(rows)}


@router.post("/new-leads/mark-viewed")
async def mark_new_leads_viewed(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Mark all unviewed lead assignments as viewed for this rep."""
    rep_id = profile["id"]
    execute_query(
        """
        UPDATE crm_contact_assignment_log
        SET viewed_at = NOW()
        WHERE to_rep_id = :rep_id AND viewed_at IS NULL
        RETURNING id
        """,
        {"rep_id": rep_id},
    )
    return {"success": True}


# ============================================================================
# Tab View Tracking (for sidebar badge clearing)
# ============================================================================

ALLOWED_TAB_KEYS = {
    "contacts", "dnc", "pipeline", "calendar", "interactions", "goals",
    "log", "reviews", "training", "discussions", "business_card",
}

class TabViewedRequest(BaseModel):
    tab_key: str

@router.post("/tab-viewed")
async def mark_tab_viewed(
    data: TabViewedRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Record that the user viewed a CRM sidebar tab (clears the badge)."""
    if data.tab_key not in ALLOWED_TAB_KEYS:
        raise HTTPException(400, f"Invalid tab_key: {data.tab_key}")

    execute_single(
        """
        INSERT INTO crm_tab_views (profile_id, tab_key, last_viewed_at)
        VALUES (:pid, :key, NOW())
        ON CONFLICT (profile_id, tab_key)
        DO UPDATE SET last_viewed_at = NOW()
        RETURNING profile_id
        """,
        {"pid": profile["id"], "key": data.tab_key},
    )

    # Viewing the Contacts tab also clears unviewed lead assignments
    if data.tab_key == "contacts":
        execute_query(
            """
            UPDATE crm_contact_assignment_log
            SET viewed_at = NOW()
            WHERE to_rep_id = :pid AND viewed_at IS NULL
            """,
            {"pid": profile["id"]},
        )

    return {"success": True}


# ============================================================================
# Contacts
# ============================================================================

@router.get("/contacts")
async def list_contacts(
    search: Optional[str] = Query(None),
    temperature: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    assigned_rep_id: Optional[str] = Query(None),
    unassigned: Optional[bool] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List contacts. Reps see their own + team-visible contacts, admins see all."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    conditions = ["c.status != 'inactive'"]
    params = {}

    if not is_admin:
        conditions.append("(c.assigned_rep_id = :rep_id OR c.visibility = 'team')")
        params["rep_id"] = profile["id"]

    if unassigned and is_admin:
        conditions.append("c.assigned_rep_id IS NULL")

    if search:
        conditions.append(
            "(c.first_name ILIKE :search OR c.last_name ILIKE :search "
            "OR c.email ILIKE :search OR c.company ILIKE :search "
            "OR c.phone ILIKE :search)"
        )
        params["search"] = f"%{search}%"

    if temperature:
        conditions.append("c.temperature = :temperature")
        params["temperature"] = temperature

    if status:
        conditions.append("c.status = :status")
        params["status"] = status

    if tag:
        conditions.append(":tag = ANY(c.tags)")
        params["tag"] = tag

    if assigned_rep_id and is_admin:
        conditions.append("c.assigned_rep_id = :assigned_rep_id")
        params["assigned_rep_id"] = assigned_rep_id

    where = " AND ".join(conditions) if conditions else "1=1"

    # Validate sort column
    allowed_sorts = {"created_at", "updated_at", "last_name", "first_name", "temperature", "company"}
    if sort_by not in allowed_sorts:
        sort_by = "created_at"
    order_dir = "DESC" if sort_order == "desc" else "ASC"

    # Get total count
    count_row = execute_single(
        f"SELECT COUNT(*) as total FROM crm_contacts c WHERE {where}",
        params,
    )
    total = count_row["total"] if count_row else 0

    # Get contacts with rep name — use CTE to paginate first, then compute counts
    rows = execute_query(
        f"""
        WITH paged AS (
            SELECT c.*, p.full_name as assigned_rep_name
            FROM crm_contacts c
            LEFT JOIN profiles p ON p.id = c.assigned_rep_id
            WHERE {where}
            ORDER BY c.{sort_by} {order_dir}
            LIMIT :limit OFFSET :offset
        )
        SELECT paged.*,
               COALESCE(ac.activity_count, 0) as activity_count,
               ac.last_activity_date,
               COALESCE(ec.email_thread_count, 0) as email_thread_count
        FROM paged
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as activity_count, MAX(a.activity_date) as last_activity_date
            FROM crm_activities a WHERE a.contact_id = paged.id
        ) ac ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as email_thread_count
            FROM crm_email_threads et WHERE et.contact_id = paged.id
        ) ec ON true
        """,
        {**params, "limit": limit, "offset": offset},
    )

    return {"contacts": rows, "total": total, "limit": limit, "offset": offset}


@router.get("/contacts/{contact_id}")
async def get_contact(
    contact_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get a single contact with recent activity history."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    contact = execute_single(
        """
        SELECT c.*, p.full_name as assigned_rep_name,
               lp.full_name as linked_profile_name,
               lp.email as linked_profile_email
        FROM crm_contacts c
        LEFT JOIN profiles p ON p.id = c.assigned_rep_id
        LEFT JOIN profiles lp ON lp.id = c.profile_id
        WHERE c.id = :id
        """,
        {"id": contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")

    if not is_admin and contact["assigned_rep_id"] != profile["id"] and contact.get("visibility") != "team":
        raise HTTPException(403, "Not authorized to view this contact")

    # Get recent activities
    activities = execute_query(
        """
        SELECT a.*, p.full_name as rep_name
        FROM crm_activities a
        LEFT JOIN profiles p ON p.id = a.rep_id
        WHERE a.contact_id = :contact_id
        ORDER BY a.activity_date DESC
        LIMIT 50
        """,
        {"contact_id": contact_id},
    )

    contact["activities"] = activities
    return contact


@router.post("/contacts")
async def create_contact(
    data: ContactCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Create a new contact, auto-assigned to current rep."""
    contact_data = data.dict(exclude_none=True)
    contact_data["assigned_rep_id"] = profile["id"]
    contact_data["created_by"] = profile["id"]

    # Wrap JSONB fields for psycopg2
    if "custom_fields" in contact_data:
        contact_data["custom_fields"] = PgJson(contact_data["custom_fields"])

    # Build insert
    columns = ", ".join(contact_data.keys())
    placeholders = ", ".join(f":{k}" for k in contact_data.keys())

    result = execute_insert(
        f"INSERT INTO crm_contacts ({columns}) VALUES ({placeholders}) RETURNING *",
        contact_data,
    )
    return result


@router.put("/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    data: ContactUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Update a contact."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Check ownership
    existing = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not existing:
        raise HTTPException(404, "Contact not found")
    if not is_admin and existing["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to edit this contact")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    # Wrap JSONB fields for psycopg2
    if "custom_fields" in update_data:
        update_data["custom_fields"] = PgJson(update_data["custom_fields"])

    update_data["updated_at"] = "NOW()"
    set_clauses = []
    params = {"id": contact_id}

    for key, value in update_data.items():
        if value == "NOW()":
            set_clauses.append(f"{key} = NOW()")
        else:
            set_clauses.append(f"{key} = :{key}")
            params[key] = value

    result = execute_single(
        f"UPDATE crm_contacts SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


@router.delete("/contacts/{contact_id}")
async def delete_contact(
    contact_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Soft-delete a contact (set status=inactive)."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not existing:
        raise HTTPException(404, "Contact not found")
    if not is_admin and existing["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to delete this contact")

    execute_single(
        "UPDATE crm_contacts SET status = 'inactive', updated_at = NOW() WHERE id = :id RETURNING id",
        {"id": contact_id},
    )
    return {"message": "Contact deactivated"}


@router.post("/contacts/{contact_id}/link-profile")
async def link_contact_to_profile(
    contact_id: str,
    data: LinkProfileRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Link a CRM contact to an existing SWN user profile."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not existing:
        raise HTTPException(404, "Contact not found")
    if not is_admin and existing["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized")

    # Verify the target profile exists
    target = execute_single(
        "SELECT id, full_name, email FROM profiles WHERE id = :pid",
        {"pid": data.profile_id},
    )
    if not target:
        raise HTTPException(404, "Profile not found")

    result = execute_single(
        "UPDATE crm_contacts SET profile_id = :profile_id, updated_at = NOW() WHERE id = :id RETURNING *",
        {"profile_id": data.profile_id, "id": contact_id},
    )
    return result


# ============================================================================
# Activities
# ============================================================================

# Map activity types to interaction count columns
ACTIVITY_TO_COUNTER = {
    "call": "calls",
    "email": "emails",
    "email_received": "emails_received",
    "email_campaign": "campaign_emails",
    "email_sequence": "emails",
    "text": "texts",
    "meeting": "meetings",
    "demo": "demos",
    "follow_up": "other_interactions",
    "proposal_sent": "other_interactions",
    "note": None,  # Notes don't count as interactions
    "sequence_enrolled": None,
    "sequence_unenrolled": None,
    "other": "other_interactions",
}


@router.get("/activities")
async def list_activities(
    contact_id: Optional[str] = Query(None),
    rep_id: Optional[str] = Query(None),
    activity_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List activities. Filter by contact, rep, date range, type."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Validate timezone
    user_tz = "UTC"
    if tz:
        import pytz
        if tz in pytz.all_timezones:
            user_tz = tz

    conditions = []
    params = {"tz": user_tz}

    if not is_admin:
        conditions.append("a.rep_id = :my_rep_id")
        params["my_rep_id"] = profile["id"]

    if contact_id:
        conditions.append("a.contact_id = :contact_id")
        params["contact_id"] = contact_id

    if rep_id and is_admin:
        conditions.append("a.rep_id = :rep_id")
        params["rep_id"] = rep_id

    if activity_type:
        conditions.append("a.activity_type = :activity_type")
        params["activity_type"] = activity_type

    if date_from:
        conditions.append("(a.activity_date AT TIME ZONE :tz)::date >= :date_from::date")
        params["date_from"] = date_from

    if date_to:
        conditions.append("(a.activity_date AT TIME ZONE :tz)::date <= :date_to::date")
        params["date_to"] = date_to

    where = " AND ".join(conditions) if conditions else "1=1"

    rows = execute_query(
        f"""
        SELECT a.*,
               p.full_name as rep_name,
               c.first_name as contact_first_name,
               c.last_name as contact_last_name
        FROM crm_activities a
        LEFT JOIN profiles p ON p.id = a.rep_id
        LEFT JOIN crm_contacts c ON c.id = a.contact_id
        WHERE {where}
        ORDER BY a.activity_date DESC
        LIMIT :limit OFFSET :offset
        """,
        {**params, "limit": limit, "offset": offset},
    )
    return {"activities": rows}


@router.post("/activities")
async def create_activity(
    data: ActivityCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Log a new activity and auto-increment interaction counts."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Verify contact exists and rep has access
    contact = execute_single(
        "SELECT id, assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": data.contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")
    if not is_admin and contact["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to log activity for this contact")

    activity_data = {
        "contact_id": data.contact_id,
        "rep_id": profile["id"],
        "activity_type": data.activity_type,
        "subject": data.subject,
        "description": data.description,
        "outcome": data.outcome,
        "duration_minutes": data.duration_minutes,
        "follow_up_date": data.follow_up_date,
        "follow_up_notes": data.follow_up_notes,
    }

    if data.activity_date:
        activity_data["activity_date"] = data.activity_date

    if data.deal_id:
        activity_data["deal_id"] = data.deal_id

    # Remove None values
    activity_data = {k: v for k, v in activity_data.items() if v is not None}

    columns = ", ".join(activity_data.keys())
    placeholders = ", ".join(f":{k}" for k in activity_data.keys())

    result = execute_insert(
        f"INSERT INTO crm_activities ({columns}) VALUES ({placeholders}) RETURNING *",
        activity_data,
    )

    # Auto-increment interaction count
    counter_col = ACTIVITY_TO_COUNTER.get(data.activity_type)
    if counter_col:
        _increment_interaction(profile["id"], counter_col)

    return result


@router.put("/activities/{activity_id}")
async def update_activity(
    activity_id: str,
    data: ActivityUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Update an activity."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT rep_id FROM crm_activities WHERE id = :id",
        {"id": activity_id},
    )
    if not existing:
        raise HTTPException(404, "Activity not found")
    if not is_admin and existing["rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to edit this activity")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    set_clauses = []
    params = {"id": activity_id}
    for key, value in update_data.items():
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    set_clauses.append("updated_at = NOW()")

    result = execute_single(
        f"UPDATE crm_activities SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


@router.delete("/activities/{activity_id}")
async def delete_activity(
    activity_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Delete an activity."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT rep_id FROM crm_activities WHERE id = :id",
        {"id": activity_id},
    )
    if not existing:
        raise HTTPException(404, "Activity not found")
    if not is_admin and existing["rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to delete this activity")

    execute_single(
        "DELETE FROM crm_activities WHERE id = :id RETURNING id",
        {"id": activity_id},
    )
    return {"message": "Activity deleted"}


@router.get("/activities/calendar")
async def get_activity_calendar(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    tz: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get activities grouped by date for calendar view."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Validate timezone
    user_tz = "UTC"
    if tz:
        import pytz
        if tz in pytz.all_timezones:
            user_tz = tz

    now = datetime.utcnow()
    target_month = month or now.month
    target_year = year or now.year

    conditions = [
        "EXTRACT(MONTH FROM a.activity_date AT TIME ZONE :tz) = :month",
        "EXTRACT(YEAR FROM a.activity_date AT TIME ZONE :tz) = :year",
    ]
    params = {"month": target_month, "year": target_year, "tz": user_tz}

    if not is_admin:
        conditions.append("a.rep_id = :rep_id")
        params["rep_id"] = profile["id"]

    where = " AND ".join(conditions)

    rows = execute_query(
        f"""
        SELECT (a.activity_date AT TIME ZONE :tz)::date as date,
               a.activity_type,
               a.subject,
               a.id,
               a.contact_id,
               c.first_name as contact_first_name,
               c.last_name as contact_last_name
        FROM crm_activities a
        LEFT JOIN crm_contacts c ON c.id = a.contact_id
        WHERE {where}
        ORDER BY a.activity_date ASC
        """,
        params,
    )

    # Group by date
    calendar = {}
    for row in rows:
        d = str(row["date"])
        if d not in calendar:
            calendar[d] = []
        calendar[d].append(row)

    # Also fetch follow-ups scheduled in this month
    fu_conditions = [
        "EXTRACT(MONTH FROM a.follow_up_date AT TIME ZONE :tz) = :month",
        "EXTRACT(YEAR FROM a.follow_up_date AT TIME ZONE :tz) = :year",
        "a.follow_up_date IS NOT NULL",
    ]
    fu_params = {"month": target_month, "year": target_year, "tz": user_tz}

    if not is_admin:
        fu_conditions.append("a.rep_id = :rep_id")
        fu_params["rep_id"] = profile["id"]

    fu_where = " AND ".join(fu_conditions)

    fu_rows = execute_query(
        f"""
        SELECT (a.follow_up_date AT TIME ZONE :tz)::date as date,
               a.follow_up_notes,
               a.subject,
               a.id,
               a.activity_type,
               a.contact_id,
               c.first_name as contact_first_name,
               c.last_name as contact_last_name
        FROM crm_activities a
        LEFT JOIN crm_contacts c ON c.id = a.contact_id
        WHERE {fu_where}
        ORDER BY a.follow_up_date ASC
        """,
        fu_params,
    )

    follow_ups = {}
    for row in fu_rows:
        d = str(row["date"])
        if d not in follow_ups:
            follow_ups[d] = []
        follow_ups[d].append(row)

    return {"calendar": calendar, "follow_ups": follow_ups, "month": target_month, "year": target_year}


@router.get("/activities/follow-ups")
async def get_follow_ups(
    tz: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get upcoming follow-ups for the current rep."""
    user_tz = "UTC"
    if tz:
        import pytz
        if tz in pytz.all_timezones:
            user_tz = tz

    rows = execute_query(
        """
        SELECT a.*, c.first_name as contact_first_name, c.last_name as contact_last_name,
               c.company, c.temperature
        FROM crm_activities a
        LEFT JOIN crm_contacts c ON c.id = a.contact_id
        WHERE a.rep_id = :rep_id
          AND a.follow_up_date IS NOT NULL
          AND (a.follow_up_date AT TIME ZONE :tz)::date >= CURRENT_DATE
        ORDER BY a.follow_up_date ASC
        LIMIT 50
        """,
        {"rep_id": profile["id"], "tz": user_tz},
    )
    return {"follow_ups": rows}


# ============================================================================
# Interaction Counts
# ============================================================================

def _increment_interaction(rep_id: str, column: str):
    """Increment a specific interaction counter for today."""
    allowed = {"calls", "emails", "texts", "meetings", "demos", "other_interactions", "campaign_emails", "emails_received"}
    if column not in allowed:
        return

    execute_insert(
        f"""
        INSERT INTO crm_interaction_counts (rep_id, count_date, {column})
        VALUES (:rep_id, CURRENT_DATE, 1)
        ON CONFLICT (rep_id, count_date)
        DO UPDATE SET {column} = crm_interaction_counts.{column} + 1,
                      updated_at = NOW()
        RETURNING *
        """,
        {"rep_id": rep_id},
    )


@router.get("/interactions/my-today")
async def get_my_interactions_today(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get today's interaction counts for the current rep."""
    row = execute_single(
        """
        SELECT * FROM crm_interaction_counts
        WHERE rep_id = :rep_id AND count_date = CURRENT_DATE
        """,
        {"rep_id": profile["id"]},
    )

    if not row:
        return {
            "rep_id": profile["id"],
            "count_date": str(date.today()),
            "calls": 0,
            "emails": 0,
            "texts": 0,
            "meetings": 0,
            "demos": 0,
            "other_interactions": 0,
        }

    return row


@router.post("/interactions/increment")
async def increment_interaction(
    data: InteractionIncrement,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Manually increment a specific interaction type for today."""
    allowed = {"calls", "emails", "texts", "meetings", "demos", "other_interactions"}
    if data.interaction_type not in allowed:
        raise HTTPException(400, f"Invalid interaction type. Must be one of: {', '.join(allowed)}")

    _increment_interaction(profile["id"], data.interaction_type)

    # Return updated counts
    row = execute_single(
        """
        SELECT * FROM crm_interaction_counts
        WHERE rep_id = :rep_id AND count_date = CURRENT_DATE
        """,
        {"rep_id": profile["id"]},
    )
    return row


@router.post("/interactions/decrement")
async def decrement_interaction(
    data: InteractionIncrement,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Manually decrement a specific interaction type for today (floor at 0)."""
    allowed = {"calls", "emails", "texts", "meetings", "demos", "other_interactions"}
    if data.interaction_type not in allowed:
        raise HTTPException(400, f"Invalid interaction type. Must be one of: {', '.join(allowed)}")

    col = data.interaction_type
    execute_single(
        f"""
        UPDATE crm_interaction_counts
        SET {col} = GREATEST({col} - 1, 0),
            updated_at = NOW()
        WHERE rep_id = :rep_id AND count_date = CURRENT_DATE
        RETURNING *
        """,
        {"rep_id": profile["id"]},
    )

    row = execute_single(
        """
        SELECT * FROM crm_interaction_counts
        WHERE rep_id = :rep_id AND count_date = CURRENT_DATE
        """,
        {"rep_id": profile["id"]},
    )
    return row


# ============================================================================
# Deals
# ============================================================================

# Auto-probability by stage
STAGE_PROBABILITY = {
    "lead": 10,
    "contacted": 20,
    "qualified": 40,
    "proposal": 60,
    "negotiation": 80,
    "closed_won": 100,
    "closed_lost": 0,
}

VALID_STAGES = set(STAGE_PROBABILITY.keys())


@router.get("/deals")
async def list_deals(
    contact_id: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    assigned_rep_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("created_at"),
    sort_order: Optional[str] = Query("desc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List deals. Reps see only their own, admins see all."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    conditions = []
    params = {}

    if not is_admin:
        conditions.append("d.assigned_rep_id = :rep_id")
        params["rep_id"] = profile["id"]

    if contact_id:
        conditions.append("d.contact_id = :contact_id")
        params["contact_id"] = contact_id

    if stage:
        conditions.append("d.stage = :stage")
        params["stage"] = stage

    if product_type:
        conditions.append("d.product_type = :product_type")
        params["product_type"] = product_type

    if assigned_rep_id and is_admin:
        conditions.append("d.assigned_rep_id = :assigned_rep_id")
        params["assigned_rep_id"] = assigned_rep_id

    if search:
        conditions.append("(d.title ILIKE :search OR d.description ILIKE :search)")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions) if conditions else "1=1"

    allowed_sorts = {"created_at", "updated_at", "amount_cents", "expected_close_date", "stage", "title"}
    if sort_by not in allowed_sorts:
        sort_by = "created_at"
    order_dir = "DESC" if sort_order == "desc" else "ASC"

    count_row = execute_single(
        f"SELECT COUNT(*) as total FROM crm_deals d WHERE {where}",
        params,
    )
    total = count_row["total"] if count_row else 0

    rows = execute_query(
        f"""
        SELECT d.*,
               c.first_name as contact_first_name,
               c.last_name as contact_last_name,
               c.company as contact_company,
               p.full_name as assigned_rep_name
        FROM crm_deals d
        LEFT JOIN crm_contacts c ON c.id = d.contact_id
        LEFT JOIN profiles p ON p.id = d.assigned_rep_id
        WHERE {where}
        ORDER BY d.{sort_by} {order_dir}
        LIMIT :limit OFFSET :offset
        """,
        {**params, "limit": limit, "offset": offset},
    )

    return {"deals": rows, "total": total, "limit": limit, "offset": offset}


@router.get("/deals/pipeline")
async def get_pipeline(
    assigned_rep_id: Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get deals grouped by stage for Kanban view."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    conditions = []
    params = {}

    if not is_admin:
        conditions.append("d.assigned_rep_id = :rep_id")
        params["rep_id"] = profile["id"]

    if assigned_rep_id and is_admin:
        conditions.append("d.assigned_rep_id = :assigned_rep_id")
        params["assigned_rep_id"] = assigned_rep_id

    if product_type:
        conditions.append("d.product_type = :product_type")
        params["product_type"] = product_type

    where = " AND ".join(conditions) if conditions else "1=1"

    rows = execute_query(
        f"""
        SELECT d.*,
               c.first_name as contact_first_name,
               c.last_name as contact_last_name,
               c.company as contact_company,
               c.temperature as contact_temperature,
               p.full_name as assigned_rep_name
        FROM crm_deals d
        LEFT JOIN crm_contacts c ON c.id = d.contact_id
        LEFT JOIN profiles p ON p.id = d.assigned_rep_id
        WHERE {where}
        ORDER BY d.updated_at DESC
        """,
        params,
    )

    # Group by stage
    pipeline = {stage: [] for stage in STAGE_PROBABILITY.keys()}
    for row in rows:
        stage = row.get("stage", "lead")
        if stage in pipeline:
            pipeline[stage].append(row)

    return {"pipeline": pipeline}


@router.get("/deals/pipeline/stats")
async def get_pipeline_stats(
    assigned_rep_id: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get pipeline value by stage."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    conditions = []
    params = {}

    if not is_admin:
        conditions.append("d.assigned_rep_id = :rep_id")
        params["rep_id"] = profile["id"]

    if assigned_rep_id and is_admin:
        conditions.append("d.assigned_rep_id = :assigned_rep_id")
        params["assigned_rep_id"] = assigned_rep_id

    where = " AND ".join(conditions) if conditions else "1=1"

    rows = execute_query(
        f"""
        SELECT d.stage,
               COUNT(*) as deal_count,
               COALESCE(SUM(d.amount_cents), 0) as total_value,
               COALESCE(SUM(d.amount_cents * d.probability / 100), 0) as weighted_value,
               COALESCE(AVG(d.amount_cents), 0) as avg_deal_size
        FROM crm_deals d
        WHERE {where}
        GROUP BY d.stage
        ORDER BY CASE d.stage
            WHEN 'lead' THEN 1
            WHEN 'contacted' THEN 2
            WHEN 'qualified' THEN 3
            WHEN 'proposal' THEN 4
            WHEN 'negotiation' THEN 5
            WHEN 'closed_won' THEN 6
            WHEN 'closed_lost' THEN 7
        END
        """,
        params,
    )

    return {"stages": rows}


@router.get("/deals/{deal_id}")
async def get_deal(
    deal_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get a single deal with stage history and activities."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    deal = execute_single(
        """
        SELECT d.*,
               c.first_name as contact_first_name,
               c.last_name as contact_last_name,
               c.company as contact_company,
               c.email as contact_email,
               c.phone as contact_phone,
               c.temperature as contact_temperature,
               p.full_name as assigned_rep_name,
               cp.full_name as created_by_name
        FROM crm_deals d
        LEFT JOIN crm_contacts c ON c.id = d.contact_id
        LEFT JOIN profiles p ON p.id = d.assigned_rep_id
        LEFT JOIN profiles cp ON cp.id = d.created_by
        WHERE d.id = :id
        """,
        {"id": deal_id},
    )
    if not deal:
        raise HTTPException(404, "Deal not found")

    if not is_admin and deal["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to view this deal")

    # Get stage history
    history = execute_query(
        """
        SELECT h.*, p.full_name as changed_by_name
        FROM crm_deal_stage_history h
        LEFT JOIN profiles p ON p.id = h.changed_by
        WHERE h.deal_id = :deal_id
        ORDER BY h.changed_at DESC
        """,
        {"deal_id": deal_id},
    )

    # Get activities linked to this deal
    activities = execute_query(
        """
        SELECT a.*, p.full_name as rep_name
        FROM crm_activities a
        LEFT JOIN profiles p ON p.id = a.rep_id
        WHERE a.deal_id = :deal_id
        ORDER BY a.activity_date DESC
        LIMIT 50
        """,
        {"deal_id": deal_id},
    )

    deal["stage_history"] = history
    deal["activities"] = activities
    return deal


@router.post("/deals")
async def create_deal(
    data: DealCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Create a new deal."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Verify contact exists and rep has access
    contact = execute_single(
        "SELECT id, assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": data.contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")
    if not is_admin and contact["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to create deals for this contact")

    # Auto-set probability from stage if not provided
    probability = data.probability if data.probability is not None else STAGE_PROBABILITY.get(data.stage or "lead", 10)

    deal_data = {
        "contact_id": data.contact_id,
        "assigned_rep_id": profile["id"],
        "title": data.title,
        "description": data.description,
        "product_type": data.product_type or "backlot_membership",
        "product_detail": "{}",
        "stage": data.stage or "lead",
        "amount_cents": data.amount_cents or 0,
        "currency": data.currency or "USD",
        "probability": probability,
        "expected_close_date": data.expected_close_date,
        "competitor": data.competitor,
        "created_by": profile["id"],
    }

    # Remove None values
    deal_data = {k: v for k, v in deal_data.items() if v is not None}

    columns = ", ".join(deal_data.keys())
    placeholders = ", ".join(f":{k}" for k in deal_data.keys())

    result = execute_insert(
        f"INSERT INTO crm_deals ({columns}) VALUES ({placeholders}) RETURNING *",
        deal_data,
    )

    # Record initial stage in history
    execute_insert(
        """
        INSERT INTO crm_deal_stage_history (deal_id, from_stage, to_stage, changed_by, notes)
        VALUES (:deal_id, NULL, :to_stage, :changed_by, 'Deal created')
        RETURNING id
        """,
        {"deal_id": result["id"], "to_stage": deal_data.get("stage", "lead"), "changed_by": profile["id"]},
    )

    return result


@router.put("/deals/{deal_id}")
async def update_deal(
    deal_id: str,
    data: DealUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Update a deal (not stage — use PATCH /deals/{id}/stage for that)."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT assigned_rep_id FROM crm_deals WHERE id = :id",
        {"id": deal_id},
    )
    if not existing:
        raise HTTPException(404, "Deal not found")
    if not is_admin and existing["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to edit this deal")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    set_clauses = []
    params = {"id": deal_id}

    for key, value in update_data.items():
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    set_clauses.append("updated_at = NOW()")

    result = execute_single(
        f"UPDATE crm_deals SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


@router.patch("/deals/{deal_id}/stage")
async def change_deal_stage(
    deal_id: str,
    data: StageChangeRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Move a deal to a new stage. Records history and auto-updates probability."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    if data.stage not in VALID_STAGES:
        raise HTTPException(400, f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}")

    existing = execute_single(
        "SELECT id, stage, assigned_rep_id FROM crm_deals WHERE id = :id",
        {"id": deal_id},
    )
    if not existing:
        raise HTTPException(404, "Deal not found")
    if not is_admin and existing["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to update this deal")

    old_stage = existing["stage"]
    if old_stage == data.stage:
        raise HTTPException(400, "Deal is already in this stage")

    # Build update
    update_params = {
        "id": deal_id,
        "stage": data.stage,
        "probability": STAGE_PROBABILITY[data.stage],
    }

    extra_sets = ""
    if data.stage in ("closed_won", "closed_lost"):
        extra_sets = ", actual_close_date = CURRENT_DATE"
        if data.close_reason:
            extra_sets += ", close_reason = :close_reason"
            update_params["close_reason"] = data.close_reason

    result = execute_single(
        f"""
        UPDATE crm_deals
        SET stage = :stage, probability = :probability, updated_at = NOW(){extra_sets}
        WHERE id = :id RETURNING *
        """,
        update_params,
    )

    # Record stage history
    execute_insert(
        """
        INSERT INTO crm_deal_stage_history (deal_id, from_stage, to_stage, changed_by, notes)
        VALUES (:deal_id, :from_stage, :to_stage, :changed_by, :notes)
        RETURNING id
        """,
        {
            "deal_id": deal_id,
            "from_stage": old_stage,
            "to_stage": data.stage,
            "changed_by": profile["id"],
            "notes": data.notes,
        },
    )

    return result


@router.delete("/deals/{deal_id}")
async def delete_deal(
    deal_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Delete a deal."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT assigned_rep_id FROM crm_deals WHERE id = :id",
        {"id": deal_id},
    )
    if not existing:
        raise HTTPException(404, "Deal not found")
    if not is_admin and existing["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized to delete this deal")

    execute_single(
        "DELETE FROM crm_deals WHERE id = :id RETURNING id",
        {"id": deal_id},
    )
    return {"message": "Deal deleted"}


# ============================================================================
# Goals
# ============================================================================

class GoalOverrideRequest(BaseModel):
    manual_override: Optional[int] = None


@router.get("/goals/my")
async def get_my_goals(
    period_type: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get the current rep's goals with auto-computed progress."""
    conditions = [
        "(g.rep_id = :rep_id OR g.rep_id IS NULL)",
        "g.period_end >= CURRENT_DATE",
    ]
    params = {"rep_id": profile["id"]}

    if period_type:
        conditions.append("g.period_type = :period_type")
        params["period_type"] = period_type

    where = " AND ".join(conditions)

    rows = execute_query(
        f"""
        SELECT g.*, p.full_name as set_by_name,
               CASE WHEN g.rep_id IS NULL THEN true ELSE false END as is_team_goal,
               CASE g.goal_type
                 WHEN 'revenue' THEN COALESCE((
                   SELECT SUM(d.amount_cents)
                   FROM crm_deals d
                   WHERE d.stage = 'closed_won'
                     AND d.actual_close_date >= g.period_start
                     AND d.actual_close_date <= g.period_end
                     AND (g.rep_id IS NULL OR d.assigned_rep_id = g.rep_id)
                 ), 0)
                 WHEN 'deals_closed' THEN COALESCE((
                   SELECT COUNT(*)
                   FROM crm_deals d
                   WHERE d.stage = 'closed_won'
                     AND d.actual_close_date >= g.period_start
                     AND d.actual_close_date <= g.period_end
                     AND (g.rep_id IS NULL OR d.assigned_rep_id = g.rep_id)
                 ), 0)
                 WHEN 'calls_made' THEN COALESCE((
                   SELECT SUM(ic.calls)
                   FROM crm_interaction_counts ic
                   WHERE ic.count_date >= g.period_start
                     AND ic.count_date <= g.period_end
                     AND (g.rep_id IS NULL OR ic.rep_id = g.rep_id)
                 ), 0)
                 WHEN 'emails_sent' THEN COALESCE((
                   SELECT SUM(ic.emails)
                   FROM crm_interaction_counts ic
                   WHERE ic.count_date >= g.period_start
                     AND ic.count_date <= g.period_end
                     AND (g.rep_id IS NULL OR ic.rep_id = g.rep_id)
                 ), 0)
                 WHEN 'meetings_held' THEN COALESCE((
                   SELECT SUM(ic.meetings)
                   FROM crm_interaction_counts ic
                   WHERE ic.count_date >= g.period_start
                     AND ic.count_date <= g.period_end
                     AND (g.rep_id IS NULL OR ic.rep_id = g.rep_id)
                 ), 0)
                 WHEN 'demos_given' THEN COALESCE((
                   SELECT SUM(ic.demos)
                   FROM crm_interaction_counts ic
                   WHERE ic.count_date >= g.period_start
                     AND ic.count_date <= g.period_end
                     AND (g.rep_id IS NULL OR ic.rep_id = g.rep_id)
                 ), 0)
                 WHEN 'new_contacts' THEN COALESCE((
                   SELECT COUNT(*)
                   FROM crm_contacts c
                   WHERE c.created_at::date >= g.period_start
                     AND c.created_at::date <= g.period_end
                     AND (g.rep_id IS NULL OR c.assigned_rep_id = g.rep_id)
                 ), 0)
                 ELSE 0
               END as computed_value
        FROM crm_sales_goals g
        LEFT JOIN profiles p ON p.id = g.set_by
        WHERE {where}
        ORDER BY g.period_start DESC, g.goal_type ASC
        """,
        params,
    )

    # Set actual_value from manual_override or computed_value
    for row in rows:
        computed = int(row.get("computed_value", 0))
        override = row.get("manual_override")
        if override is not None:
            row["actual_value"] = override
            row["is_overridden"] = True
        else:
            row["actual_value"] = computed
            row["is_overridden"] = False
        row["computed_value"] = computed

    return {"goals": rows}


@router.put("/goals/{goal_id}/override")
async def set_goal_override(
    goal_id: str,
    data: GoalOverrideRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Set or clear a manual override on a goal's actual_value. Admin-only."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)
    if not is_admin:
        raise HTTPException(403, "Only admins can override goal values")

    existing = execute_single(
        "SELECT id, rep_id FROM crm_sales_goals WHERE id = :id",
        {"id": goal_id},
    )
    if not existing:
        raise HTTPException(404, "Goal not found")

    result = execute_single(
        """
        UPDATE crm_sales_goals
        SET manual_override = :manual_override, updated_at = NOW()
        WHERE id = :id
        RETURNING *
        """,
        {"id": goal_id, "manual_override": data.manual_override},
    )
    return result


# ============================================================================
# Customer Log
# ============================================================================

class LogCreate(BaseModel):
    contact_id: str
    log_type: str = "general"
    subject: str
    description: Optional[str] = None
    priority: Optional[str] = "normal"


class LogUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    resolution: Optional[str] = None


@router.get("/contacts/{contact_id}/log")
async def get_contact_log(
    contact_id: str,
    status: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get customer log entries for a contact."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Verify access
    contact = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")
    if not is_admin and contact["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized")

    conditions = ["l.contact_id = :contact_id"]
    params = {"contact_id": contact_id}

    if status:
        conditions.append("l.status = :status")
        params["status"] = status

    where = " AND ".join(conditions)

    rows = execute_query(
        f"""
        SELECT l.*, p.full_name as rep_name, rp.full_name as resolved_by_name
        FROM crm_customer_log l
        LEFT JOIN profiles p ON p.id = l.rep_id
        LEFT JOIN profiles rp ON rp.id = l.resolved_by
        WHERE {where}
        ORDER BY l.created_at DESC
        """,
        params,
    )
    return {"log_entries": rows}


@router.post("/contacts/{contact_id}/log")
async def create_log_entry(
    contact_id: str,
    data: LogCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Create a customer log entry."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    contact = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")
    if not is_admin and contact["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized")

    log_data = {
        "contact_id": contact_id,
        "rep_id": profile["id"],
        "log_type": data.log_type,
        "subject": data.subject,
        "description": data.description,
        "priority": data.priority or "normal",
    }
    log_data = {k: v for k, v in log_data.items() if v is not None}

    columns = ", ".join(log_data.keys())
    placeholders = ", ".join(f":{k}" for k in log_data.keys())

    result = execute_insert(
        f"INSERT INTO crm_customer_log ({columns}) VALUES ({placeholders}) RETURNING *",
        log_data,
    )
    return result


@router.put("/log/{log_id}")
async def update_log_entry(
    log_id: str,
    data: LogUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Update a log entry status/resolution."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT rep_id FROM crm_customer_log WHERE id = :id",
        {"id": log_id},
    )
    if not existing:
        raise HTTPException(404, "Log entry not found")
    if not is_admin and existing["rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    set_clauses = []
    params = {"id": log_id}

    for key, value in update_data.items():
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    # Auto-set resolved_at and resolved_by when marking as resolved
    if update_data.get("status") == "resolved":
        set_clauses.append("resolved_at = NOW()")
        set_clauses.append("resolved_by = :resolved_by")
        params["resolved_by"] = profile["id"]

    set_clauses.append("updated_at = NOW()")

    result = execute_single(
        f"UPDATE crm_customer_log SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


@router.get("/log/open")
async def get_open_log_entries(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get all open/in-progress log entries for the current rep."""
    rows = execute_query(
        """
        SELECT l.*, c.first_name as contact_first_name, c.last_name as contact_last_name,
               c.company, c.temperature
        FROM crm_customer_log l
        LEFT JOIN crm_contacts c ON c.id = l.contact_id
        WHERE l.rep_id = :rep_id AND l.status IN ('open', 'in_progress')
        ORDER BY CASE l.priority
            WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4
        END, l.created_at ASC
        """,
        {"rep_id": profile["id"]},
    )
    return {"log_entries": rows}


# ============================================================================
# Rep Reviews
# ============================================================================

@router.get("/reviews/my")
async def get_my_reviews(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get the current rep's visible reviews."""
    rows = execute_query(
        """
        SELECT r.*, c.first_name as contact_first_name, c.last_name as contact_last_name,
               rv.full_name as reviewer_name
        FROM crm_rep_reviews r
        LEFT JOIN crm_contacts c ON c.id = r.contact_id
        LEFT JOIN profiles rv ON rv.id = r.reviewer_id
        WHERE r.rep_id = :rep_id AND r.is_visible_to_rep = true
        ORDER BY r.created_at DESC
        """,
        {"rep_id": profile["id"]},
    )
    return {"reviews": rows}


# ============================================================================
# Do Not Contact
# ============================================================================

@router.get("/dnc-list")
async def get_rep_dnc_list(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get the DNC list. Reps see their own + team-visible contacts, admins see all."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    conditions = ["(c.status = 'do_not_contact' OR c.do_not_email = true OR c.do_not_call = true OR c.do_not_text = true)"]
    params: Dict[str, Any] = {}

    if not is_admin:
        conditions.append("(c.assigned_rep_id = :rep_id OR c.visibility = 'team')")
        params["rep_id"] = profile["id"]

    where = " AND ".join(conditions)

    count_row = execute_single(
        f"SELECT COUNT(*) as total FROM crm_contacts c WHERE {where}",
        params,
    )

    rows = execute_query(
        f"""
        SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.company,
               c.status, c.do_not_email, c.do_not_call, c.do_not_text,
               p.full_name as assigned_rep_name
        FROM crm_contacts c
        LEFT JOIN profiles p ON p.id = c.assigned_rep_id
        WHERE {where}
        ORDER BY c.last_name ASC, c.first_name ASC
        LIMIT :limit OFFSET :offset
        """,
        {**params, "limit": limit, "offset": offset},
    )

    return {"contacts": rows, "total": count_row["total"] if count_row else 0}

class DNCUpdate(BaseModel):
    do_not_email: Optional[bool] = None
    do_not_call: Optional[bool] = None
    do_not_text: Optional[bool] = None
    status: Optional[str] = None  # Can set to 'do_not_contact'


@router.patch("/contacts/{contact_id}/dnc")
async def update_dnc_flags(
    contact_id: str,
    data: DNCUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Update Do Not Contact flags on a contact."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    existing = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not existing:
        raise HTTPException(404, "Contact not found")
    if not is_admin and existing["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    set_clauses = []
    params = {"id": contact_id}
    for key, value in update_data.items():
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    set_clauses.append("updated_at = NOW()")

    result = execute_single(
        f"UPDATE crm_contacts SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


# ============================================================================
# Contact Notes (threaded)
# ============================================================================

class ContactNoteCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None


@router.get("/contacts/{contact_id}/notes")
async def list_contact_notes(
    contact_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get all notes for a contact, ordered by creation date."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Verify access
    contact = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")
    if not is_admin and contact["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized")

    rows = execute_query(
        """
        SELECT n.id, n.contact_id, n.author_id, n.content, n.parent_id,
               n.created_at, n.updated_at,
               p.full_name as author_name
        FROM crm_contact_notes n
        LEFT JOIN profiles p ON p.id = n.author_id
        WHERE n.contact_id = :contact_id
        ORDER BY n.created_at ASC
        """,
        {"contact_id": contact_id},
    )
    return {"notes": rows}


@router.post("/contacts/{contact_id}/notes")
async def create_contact_note(
    contact_id: str,
    data: ContactNoteCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Add a note to a contact."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    contact = execute_single(
        "SELECT assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")
    if not is_admin and contact["assigned_rep_id"] != profile["id"]:
        raise HTTPException(403, "Not authorized")

    params: Dict[str, Any] = {
        "contact_id": contact_id,
        "author_id": profile["id"],
        "content": data.content.strip(),
    }

    if data.parent_id:
        parent = execute_single(
            "SELECT id FROM crm_contact_notes WHERE id = :pid AND contact_id = :cid",
            {"pid": data.parent_id, "cid": contact_id},
        )
        if not parent:
            raise HTTPException(400, "Parent note not found")
        params["parent_id"] = data.parent_id

    cols = list(params.keys())
    placeholders = ", ".join(f":{c}" for c in cols)
    col_names = ", ".join(cols)

    result = execute_single(
        f"""
        INSERT INTO crm_contact_notes ({col_names})
        VALUES ({placeholders})
        RETURNING *
        """,
        params,
    )

    # Get author name for immediate return
    result["author_name"] = profile.get("full_name", "Unknown")
    return result


@router.delete("/contacts/{contact_id}/notes/{note_id}")
async def delete_contact_note(
    contact_id: str,
    note_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Delete a note. Author can delete their own, admins can delete any."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    if is_admin:
        result = execute_single(
            "DELETE FROM crm_contact_notes WHERE id = :nid AND contact_id = :cid RETURNING id",
            {"nid": note_id, "cid": contact_id},
        )
    else:
        result = execute_single(
            "DELETE FROM crm_contact_notes WHERE id = :nid AND contact_id = :cid AND author_id = :aid RETURNING id",
            {"nid": note_id, "cid": contact_id, "aid": profile["id"]},
        )

    if not result:
        raise HTTPException(404, "Note not found or not authorized")
    return {"deleted": True}


# ============================================================================
# CRM Email — Templates (Rep-facing)
# ============================================================================

@router.get("/email/templates")
async def list_email_templates(
    category: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List active email templates for the template picker."""
    conditions = ["t.is_active = true"]
    params = {}

    if category:
        conditions.append("t.category = :category")
        params["category"] = category

    where = " AND ".join(conditions)

    rows = execute_query(
        f"""
        SELECT t.id, t.name, t.subject, t.body_html, t.body_text,
               t.category, t.placeholders
        FROM crm_email_templates t
        WHERE {where}
        ORDER BY t.category ASC, t.name ASC
        """,
        params,
    )
    return {"templates": rows}


# ============================================================================
# CRM Email — Schemas
# ============================================================================

class SendEmailRequest(BaseModel):
    contact_id: Optional[str] = None
    to_emails: Optional[List[str]] = None
    to_email: Optional[str] = None  # DEPRECATED: backward compat, use to_emails
    subject: str
    body_html: str
    body_text: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    thread_id: Optional[str] = None  # Reply to existing thread
    scheduled_at: Optional[str] = None  # ISO datetime for scheduled sends
    attachment_ids: Optional[List[str]] = None  # IDs of uploaded attachments
    template_id: Optional[str] = None  # Track which template was used

    @validator('to_emails', always=True, pre=True)
    def resolve_to_emails(cls, v, values):
        if v and len(v) > 0:
            return v
        to_email = values.get('to_email')
        if to_email:
            return [to_email]
        return None

    @validator('to_emails')
    def require_to_emails(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Either to_emails or to_email must be provided')
        return v


class UpdateSignatureRequest(BaseModel):
    signature_html: str


# ============================================================================
# CRM Email — Account
# ============================================================================

@router.get("/email/account")
async def get_email_account(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get the current rep's email account."""
    account = execute_single(
        "SELECT * FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account configured. Contact admin.")

    # Generate signed URL for avatar if stored as an S3 key
    avatar_val = account.get("avatar_url") or ""
    if avatar_val and not avatar_val.startswith("http"):
        from app.core.storage import storage_client
        signed = storage_client.from_("avatars").create_signed_url(avatar_val, 3600)
        account = dict(account)
        account["avatar_url"] = signed.get("signedUrl", "")
    elif avatar_val and avatar_val.startswith("https://") and ".s3." in avatar_val:
        # Legacy full URL — extract key and sign it
        from app.core.storage import storage_client, AVATARS_BUCKET
        import re
        key_match = re.search(r'amazonaws\.com/(.+)$', avatar_val)
        if key_match:
            key = key_match.group(1)
            signed = storage_client.from_("avatars").create_signed_url(key, 3600)
            account = dict(account)
            account["avatar_url"] = signed.get("signedUrl", "")

    return account


@router.put("/email/account/signature")
async def update_email_signature(
    data: UpdateSignatureRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Update the rep's email signature."""
    result = execute_single(
        """
        UPDATE crm_email_accounts SET signature_html = :sig
        WHERE profile_id = :pid AND is_active = true RETURNING *
        """,
        {"sig": data.signature_html, "pid": profile["id"]},
    )
    if not result:
        raise HTTPException(404, "No email account found")
    return result


class UpdateAvatarRequest(BaseModel):
    avatar_url: str


@router.put("/email/account/avatar")
async def update_email_avatar(
    data: UpdateAvatarRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Update the rep's email account avatar."""
    result = execute_single(
        """
        UPDATE crm_email_accounts SET avatar_url = :url
        WHERE profile_id = :pid AND is_active = true RETURNING *
        """,
        {"url": data.avatar_url, "pid": profile["id"]},
    )
    if not result:
        raise HTTPException(404, "No email account found")
    return result


# ============================================================================
# CRM Email — Inbox & Threads
# ============================================================================

@router.get("/email/inbox")
async def get_email_inbox(
    unread_only: bool = Query(False),
    archived: bool = Query(False),
    starred_only: bool = Query(False),
    snoozed: bool = Query(False),
    deleted: bool = Query(False),
    label_id: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("last_message_at_desc"),
    all_threads: bool = Query(False),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List email threads for the current rep's inbox."""
    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    # Admin can see all threads
    if all_threads and is_admin:
        conditions = []
        params: Dict[str, Any] = {}
    else:
        account = execute_single(
            "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
            {"pid": profile["id"]},
        )
        if not account:
            return {"threads": [], "total": 0}
        conditions = ["t.account_id = :account_id"]
        params = {"account_id": account["id"]}

    # Filter modes
    if deleted:
        conditions.append("t.is_deleted = true")
    else:
        conditions.append("COALESCE(t.is_deleted, false) = false")
        if snoozed:
            conditions.append("t.snoozed_until IS NOT NULL AND t.snoozed_until > NOW()")
        else:
            conditions.append("(t.snoozed_until IS NULL OR t.snoozed_until <= NOW())")
            conditions.append("t.is_archived = :archived")
            params["archived"] = archived

    if starred_only:
        conditions.append("t.is_starred = true")

    if unread_only:
        conditions.append("t.unread_count > 0")

    if search:
        conditions.append("(t.subject ILIKE :search OR t.contact_email ILIKE :search)")
        params["search"] = f"%{search}%"

    if label_id:
        conditions.append(
            "EXISTS (SELECT 1 FROM crm_email_thread_labels tl WHERE tl.thread_id = t.id AND tl.label_id = :label_id)"
        )
        params["label_id"] = label_id

    where = " AND ".join(conditions) if conditions else "1=1"

    # Sort options
    order_clause = "t.last_message_at DESC"
    if sort_by == "last_message_at_asc":
        order_clause = "t.last_message_at ASC"
    elif sort_by == "unread_first":
        order_clause = "CASE WHEN t.unread_count > 0 THEN 0 ELSE 1 END ASC, t.last_message_at DESC"

    # Single query with COUNT(*) OVER() window function to avoid separate count round-trip
    rows = execute_query(
        f"""
        SELECT t.*, c.first_name as contact_first_name, c.last_name as contact_last_name,
               c.company as contact_company,
               ap.full_name as assigned_to_name,
               COUNT(*) OVER() as _total_count,
               (SELECT COALESCE(json_agg(json_build_object('id', el.id, 'name', el.name, 'color', el.color)), '[]'::json)
                FROM crm_email_thread_labels etl
                JOIN crm_email_labels el ON el.id = etl.label_id
                WHERE etl.thread_id = t.id) as labels
        FROM crm_email_threads t
        LEFT JOIN crm_contacts c ON c.id = t.contact_id
        LEFT JOIN profiles ap ON ap.id = t.assigned_to
        WHERE {where}
        ORDER BY {order_clause}
        LIMIT :limit OFFSET :offset
        """,
        {**params, "limit": limit, "offset": offset},
    )
    total = rows[0]["_total_count"] if rows else 0
    # Strip the internal count field from response
    for row in rows:
        row.pop("_total_count", None)
    return {"threads": rows, "total": total}


@router.get("/email/threads/{thread_id}")
async def get_email_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get a thread with all its messages."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")

    is_admin = has_permission(profile, Permission.CRM_MANAGE)

    thread = execute_single(
        """
        SELECT t.*, c.first_name as contact_first_name, c.last_name as contact_last_name,
               ap.full_name as assigned_to_name,
               (SELECT COALESCE(json_agg(json_build_object('id', el.id, 'name', el.name, 'color', el.color)), '[]'::json)
                FROM crm_email_thread_labels etl
                JOIN crm_email_labels el ON el.id = etl.label_id
                WHERE etl.thread_id = t.id) as labels
        FROM crm_email_threads t
        LEFT JOIN crm_contacts c ON c.id = t.contact_id
        LEFT JOIN profiles ap ON ap.id = t.assigned_to
        WHERE t.id = :tid AND (t.account_id = :aid OR :is_admin = true)
        """,
        {"tid": thread_id, "aid": account["id"], "is_admin": is_admin},
    )
    if not thread:
        raise HTTPException(404, "Thread not found")

    messages = execute_query(
        """
        SELECT m.*,
               COALESCE(opens.cnt, 0) as open_count,
               opens.first_opened_at,
               opens.last_opened_at,
               COALESCE(sender_acct.avatar_url, sender_prof.avatar_url) as sender_avatar_key,
               (SELECT COALESCE(json_agg(json_build_object(
                   'id', a.id, 'filename', a.filename, 'content_type', a.content_type,
                   'size_bytes', a.size_bytes
               )), '[]'::json) FROM crm_email_attachments a WHERE a.message_id = m.id) as attachments,
               cal_event.ce_id, cal_event.ce_title, cal_event.ce_starts_at, cal_event.ce_ends_at,
               cal_event.ce_location, cal_event.ce_meet_link, cal_event.ce_organizer_email,
               cal_event.ce_status, cal_event.ce_all_day
        FROM crm_email_messages m
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as cnt, MIN(o.opened_at) as first_opened_at, MAX(o.opened_at) as last_opened_at
            FROM crm_email_opens o WHERE o.message_id = m.id
        ) opens ON true
        LEFT JOIN crm_email_accounts sender_acct
            ON LOWER(sender_acct.email_address) = LOWER(m.from_address) AND sender_acct.is_active = true
        LEFT JOIN profiles sender_prof
            ON sender_prof.id = sender_acct.profile_id
        LEFT JOIN LATERAL (
            SELECT ce.id as ce_id, ce.title as ce_title, ce.starts_at as ce_starts_at,
                   ce.ends_at as ce_ends_at, ce.location as ce_location, ce.meet_link as ce_meet_link,
                   ce.organizer_email as ce_organizer_email, ce.status as ce_status, ce.all_day as ce_all_day
            FROM crm_calendar_events ce WHERE ce.message_id = m.id LIMIT 1
        ) cal_event ON true
        WHERE m.thread_id = :tid
        ORDER BY m.created_at ASC
        """,
        {"tid": thread_id},
    )

    # Resolve sender avatars + nest calendar events
    import hashlib
    from app.core.storage import storage_client
    resolved_messages = []
    for msg in messages:
        msg = dict(msg)
        avatar_key = msg.pop("sender_avatar_key", None) or ""
        if avatar_key and not avatar_key.startswith("http"):
            signed = storage_client.from_("avatars").create_signed_url(avatar_key, 3600)
            msg["sender_avatar_url"] = signed.get("signedUrl", "")
        elif avatar_key and avatar_key.startswith("http"):
            msg["sender_avatar_url"] = avatar_key
        else:
            # External sender — Gravatar fallback
            email_hash = hashlib.md5(msg["from_address"].strip().lower().encode()).hexdigest()
            msg["sender_avatar_url"] = f"https://www.gravatar.com/avatar/{email_hash}?d=mp&s=64"

        # Nest calendar event if present
        ce_id = msg.pop("ce_id", None)
        ce_title = msg.pop("ce_title", None)
        ce_starts_at = msg.pop("ce_starts_at", None)
        ce_ends_at = msg.pop("ce_ends_at", None)
        ce_location = msg.pop("ce_location", None)
        ce_meet_link = msg.pop("ce_meet_link", None)
        ce_organizer_email = msg.pop("ce_organizer_email", None)
        ce_status = msg.pop("ce_status", None)
        ce_all_day = msg.pop("ce_all_day", None)
        if ce_id:
            msg["calendar_event"] = {
                "id": ce_id,
                "title": ce_title,
                "starts_at": ce_starts_at,
                "ends_at": ce_ends_at,
                "location": ce_location,
                "meet_link": ce_meet_link,
                "organizer_email": ce_organizer_email,
                "status": ce_status,
                "all_day": ce_all_day,
            }
        else:
            msg["calendar_event"] = None
        resolved_messages.append(msg)

    return {"thread": thread, "messages": resolved_messages}


@router.patch("/email/threads/{thread_id}/read")
async def mark_thread_read(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Mark a thread as read (reset unread count)."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")

    execute_single(
        """
        UPDATE crm_email_threads SET unread_count = 0
        WHERE id = :tid AND account_id = :aid RETURNING id
        """,
        {"tid": thread_id, "aid": account["id"]},
    )
    # Also mark individual messages as read
    execute_query(
        """
        UPDATE crm_email_messages SET read_at = NOW()
        WHERE thread_id = :tid AND read_at IS NULL AND direction = 'inbound'
        RETURNING id
        """,
        {"tid": thread_id},
    )
    return {"success": True}


@router.patch("/email/threads/{thread_id}/archive")
async def archive_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Toggle archive status on a thread."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")

    result = execute_single(
        """
        UPDATE crm_email_threads SET is_archived = NOT is_archived
        WHERE id = :tid AND account_id = :aid RETURNING *
        """,
        {"tid": thread_id, "aid": account["id"]},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result


@router.patch("/email/threads/{thread_id}/delete")
async def delete_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Toggle delete (trash) status on a thread."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")

    result = execute_single(
        """
        UPDATE crm_email_threads SET is_deleted = NOT COALESCE(is_deleted, false)
        WHERE id = :tid AND account_id = :aid RETURNING *
        """,
        {"tid": thread_id, "aid": account["id"]},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result


@router.get("/email/contacts/{contact_id}/threads")
async def get_contact_threads(
    contact_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get all email threads with a specific contact."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        return {"threads": []}

    rows = execute_query(
        """
        SELECT t.* FROM crm_email_threads t
        WHERE t.account_id = :aid AND t.contact_id = :cid
        ORDER BY t.last_message_at DESC
        """,
        {"aid": account["id"], "cid": contact_id},
    )
    return {"threads": rows}


@router.get("/email/unread-count")
async def get_unread_count(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get total unread email count for the rep's inbox."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        return {"count": 0}

    row = execute_single(
        """
        SELECT COALESCE(SUM(unread_count), 0) as count
        FROM crm_email_threads WHERE account_id = :aid AND is_archived = false
        AND COALESCE(is_deleted, false) = false
        """,
        {"aid": account["id"]},
    )
    return {"count": row["count"] if row else 0}


# ============================================================================
# CRM Email — Suggestions (autocomplete for To field)
# ============================================================================

@router.get("/email/suggestions")
async def get_email_suggestions(
    q: str = Query(..., min_length=2, max_length=100),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Return email suggestions from contacts, recent emails, and org team members."""
    account = execute_single(
        "SELECT id, email_address FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    account_id = account["id"] if account else None
    self_email = account["email_address"] if account else None
    like_q = f"%{q}%"

    suggestions = execute_query(
        """
        SELECT DISTINCT ON (email) email, display_name, company, source, contact_id
        FROM (
            -- CRM contacts
            SELECT c.email, CONCAT(c.first_name, ' ', c.last_name) as display_name,
                   c.company, 'contact' as source, c.id::text as contact_id, 1 as priority
            FROM crm_contacts c
            WHERE c.email IS NOT NULL
                AND c.do_not_email IS NOT TRUE
                AND c.status != 'inactive'
                AND (c.email ILIKE :q OR c.first_name ILIKE :q OR c.last_name ILIKE :q OR c.company ILIKE :q)
            UNION ALL
            -- Recent email threads
            SELECT t.contact_email as email,
                   COALESCE(CONCAT(c2.first_name, ' ', c2.last_name), t.contact_email) as display_name,
                   c2.company, 'recent' as source, c2.id::text as contact_id, 2 as priority
            FROM crm_email_threads t
            LEFT JOIN crm_contacts c2 ON c2.id = t.contact_id
            WHERE t.account_id = :aid
                AND t.contact_email IS NOT NULL
                AND t.contact_email ILIKE :q
            UNION ALL
            -- Org team members (other active email accounts)
            SELECT a.email_address as email, a.display_name,
                   NULL as company, 'team' as source, NULL as contact_id, 3 as priority
            FROM crm_email_accounts a
            WHERE a.is_active = true
                AND a.email_address != :self_email
                AND (a.email_address ILIKE :q OR a.display_name ILIKE :q)
        ) combined
        ORDER BY email, priority ASC
        LIMIT 10
        """,
        {"q": like_q, "aid": account_id, "self_email": self_email or ""},
    )

    return {"suggestions": suggestions}


# ============================================================================
# CRM Email — Internal Routing Helper
# ============================================================================

def _route_email_internally(
    sender_account: Dict[str, Any],
    recipient_account: Dict[str, Any],
    subject: str,
    body_html: str,
    body_text: str,
    to_addresses: List[str],
    cc_addresses: List[str],
):
    """Route an email internally between org members. Skips Resend API."""
    # Find or create thread on recipient's account (sender is the "contact")
    existing_thread = execute_single(
        """
        SELECT id FROM crm_email_threads
        WHERE account_id = :aid AND contact_email = :sender_email AND subject = :subj
        ORDER BY created_at DESC LIMIT 1
        """,
        {
            "aid": recipient_account["id"],
            "sender_email": sender_account["email_address"],
            "subj": subject,
        },
    )

    if existing_thread:
        recipient_thread_id = existing_thread["id"]
    else:
        new_thread = execute_single(
            """
            INSERT INTO crm_email_threads (account_id, contact_email, subject)
            VALUES (:aid, :sender_email, :subj) RETURNING *
            """,
            {
                "aid": recipient_account["id"],
                "sender_email": sender_account["email_address"],
                "subj": subject,
            },
        )
        recipient_thread_id = new_thread["id"]

    # Insert inbound message on recipient's thread (tagged internal for reporting exclusion)
    execute_single(
        """
        INSERT INTO crm_email_messages
            (thread_id, direction, from_address, to_addresses, cc_addresses,
             subject, body_html, body_text, status, source_type)
        VALUES (:tid, 'inbound', :from_addr, :to_addrs, :cc_addrs,
                :subj, :html, :text, 'received', 'internal')
        RETURNING id
        """,
        {
            "tid": recipient_thread_id,
            "from_addr": sender_account["email_address"],
            "to_addrs": to_addresses,
            "cc_addrs": cc_addresses,
            "subj": subject,
            "html": body_html,
            "text": body_text,
        },
    )

    # Bump recipient thread unread count and last_message_at
    execute_single(
        """
        UPDATE crm_email_threads
        SET last_message_at = NOW(), unread_count = unread_count + 1,
            snoozed_until = NULL, is_archived = false
        WHERE id = :tid RETURNING id
        """,
        {"tid": recipient_thread_id},
    )

    # WebSocket notification to recipient (best-effort)
    try:
        import boto3
        import json as json_mod
        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
        table = dynamodb.Table("second-watch-websocket-connections")

        resp = table.query(
            IndexName="GSI1",
            KeyConditionExpression="GSI1PK = :pk",
            ExpressionAttributeValues={":pk": f"PROFILE#{recipient_account['profile_id']}"},
        )
        if resp.get("Items"):
            apigw = boto3.client("apigatewaymanagementapi",
                endpoint_url="https://df3xkisme7.execute-api.us-east-1.amazonaws.com/prod")
            notification = json_mod.dumps({
                "event": "crm:email:new",
                "thread_id": recipient_thread_id,
                "from": sender_account["email_address"],
                "subject": subject,
                "preview": (body_text or "")[:100],
            })
            for item in resp["Items"]:
                conn_id = item.get("SK", "").replace("CONN#", "")
                if conn_id:
                    try:
                        apigw.post_to_connection(
                            ConnectionId=conn_id,
                            Data=notification.encode("utf-8"),
                        )
                    except Exception:
                        pass
    except Exception:
        pass


def _resolve_inline_images_for_send(html: str) -> str:
    """Replace inline-image API URLs with 7-day presigned S3 URLs for outbound email delivery."""
    import re
    import boto3
    from app.core.config import settings

    # Match both absolute (https://api.example.com/api/v1/...) and relative (/api/v1/...) URLs
    pattern = r'(?:https?://[^/]+)?/api/v1/crm/email/inline-image/([0-9a-f\-]{36})'
    matches = re.findall(pattern, html)
    if not matches:
        return html

    s3 = boto3.client("s3", region_name="us-east-1")
    for att_id in set(matches):
        att = execute_single(
            "SELECT s3_key, s3_bucket, content_type FROM crm_email_attachments WHERE id = :id",
            {"id": att_id},
        )
        if att and att.get("s3_key"):
            bucket = att.get("s3_bucket") or settings.AWS_S3_BACKLOT_FILES_BUCKET
            presigned = s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": bucket,
                    "Key": att["s3_key"],
                    "ResponseContentType": att.get("content_type", "image/png"),
                },
                ExpiresIn=604800,  # 7 days
            )
            # Replace all forms of the URL (absolute and relative)
            html = re.sub(
                r'(?:https?://[^/]+)?/api/v1/crm/email/inline-image/' + re.escape(att_id),
                presigned,
                html,
            )
    return html


def add_email_inline_styles(html: str) -> str:
    """Add inline styles to HTML tags for email client compatibility."""
    import re
    html = re.sub(r'<p(?![^>]*style=)', '<p style="margin: 0 0 1em 0; line-height: 1.5;"', html)
    html = re.sub(r'<br\s*/?>', '<br style="display: block; margin: 0.5em 0;" />', html)
    html = re.sub(r'<ul(?![^>]*style=)', '<ul style="margin: 0 0 1em 0; padding-left: 1.5em;"', html)
    html = re.sub(r'<ol(?![^>]*style=)', '<ol style="margin: 0 0 1em 0; padding-left: 1.5em;"', html)
    html = re.sub(r'<li(?![^>]*style=)', '<li style="margin: 0 0 0.5em 0;"', html)
    return html


# ============================================================================
# CRM Email — Send
# ============================================================================

@router.post("/email/send")
async def send_crm_email(
    data: SendEmailRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Compose and send an email. Creates/reuses thread as needed."""
    import resend as resend_sdk
    from app.core.config import settings

    # Get the rep's email account
    account = execute_single(
        "SELECT * FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(400, "No email account configured. Contact admin.")

    # Check DNC if contact provided
    if data.contact_id:
        contact = execute_single(
            "SELECT id, do_not_email, email FROM crm_contacts WHERE id = :cid",
            {"cid": data.contact_id},
        )
        if contact and contact.get("do_not_email"):
            raise HTTPException(400, "Contact is flagged as Do Not Email")

    # Determine or create thread
    thread_id = data.thread_id
    if thread_id:
        thread = execute_single(
            "SELECT id FROM crm_email_threads WHERE id = :tid AND account_id = :aid",
            {"tid": thread_id, "aid": account["id"]},
        )
        if not thread:
            raise HTTPException(404, "Thread not found")
    else:
        thread = execute_single(
            """
            INSERT INTO crm_email_threads (account_id, contact_id, contact_email, subject)
            VALUES (:aid, :cid, :email, :subj) RETURNING *
            """,
            {
                "aid": account["id"],
                "cid": data.contact_id,
                "email": data.to_emails[0],
                "subj": data.subject,
            },
        )
        thread_id = thread["id"]

    # Build reply-to: sender's real address first, routing address for inbound webhook second
    reply_to = [account["email_address"], f"reply+{thread_id}@theswn.com"]

    # Append signature if exists
    body_html = data.body_html
    if account.get("signature_html"):
        body_html += f'<div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd;">{account["signature_html"]}</div>'

    # If scheduled, store without sending
    if data.scheduled_at:
        message = execute_single(
            """
            INSERT INTO crm_email_messages
                (thread_id, direction, from_address, to_addresses, cc_addresses, bcc_addresses,
                 subject, body_html, body_text, status, scheduled_at, template_id)
            VALUES (:tid, 'outbound', :from_addr, :to_addrs, :cc_addrs, :bcc_addrs,
                    :subj, :html, :text, 'scheduled', :scheduled_at, :template_id)
            RETURNING *
            """,
            {
                "tid": thread_id,
                "from_addr": account["email_address"],
                "to_addrs": data.to_emails,
                "cc_addrs": data.cc or [],
                "bcc_addrs": data.bcc or [],
                "subj": data.subject,
                "html": body_html,
                "text": data.body_text,
                "scheduled_at": data.scheduled_at,
                "template_id": data.template_id,
            },
        )
        # Link attachments
        if data.attachment_ids:
            for att_id in data.attachment_ids:
                try:
                    execute_insert(
                        "UPDATE crm_email_attachments SET message_id = :mid WHERE id = :aid AND message_id IS NULL RETURNING id",
                        {"mid": message["id"], "aid": att_id},
                    )
                except Exception:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to link attachment {att_id} to scheduled message {message['id']}")
        return {"message": message, "thread_id": thread_id, "scheduled": True}

    # Insert message first to get ID for tracking pixel
    message = execute_single(
        """
        INSERT INTO crm_email_messages
            (thread_id, direction, from_address, to_addresses, cc_addresses, bcc_addresses,
             subject, body_html, body_text, status, template_id)
        VALUES (:tid, 'outbound', :from_addr, :to_addrs, :cc_addrs, :bcc_addrs,
                :subj, :html, :text, 'sending', :template_id)
        RETURNING *
        """,
        {
            "tid": thread_id,
            "from_addr": account["email_address"],
            "to_addrs": data.to_emails,
            "cc_addrs": data.cc or [],
            "bcc_addrs": data.bcc or [],
            "subj": data.subject,
            "html": body_html,
            "text": data.body_text,
            "template_id": data.template_id,
        },
    )

    # Skip tracking pixel for 1:1 sends to improve deliverability (Gmail Primary tab)
    # Tracking pixels are only used for campaign/bulk sends in email_scheduler.py

    # Split recipients into internal vs external
    internal_recipients = []
    external_recipients = []
    for email in data.to_emails:
        acct = execute_single(
            "SELECT * FROM crm_email_accounts WHERE email_address = :email AND is_active = true",
            {"email": email},
        )
        if acct:
            internal_recipients.append((email, acct))
        else:
            external_recipients.append(email)

    # Generate plain text fallback if not provided
    plain_text = data.body_text
    if not plain_text:
        import re
        plain_text = re.sub(r'</p>\s*<p[^>]*>', '\n\n', body_html)
        plain_text = re.sub(r'<br\s*/?>', '\n', plain_text)
        plain_text = re.sub(r'</(div|h[1-6]|li|tr)>', '\n', plain_text)
        plain_text = re.sub(r'<[^>]+>', '', plain_text)
        plain_text = plain_text.strip()

    # Route to internal recipients
    for email, recipient_account in internal_recipients:
        _route_email_internally(
            sender_account=account,
            recipient_account=recipient_account,
            subject=data.subject,
            body_html=body_html,
            body_text=plain_text or "",
            to_addresses=data.to_emails,
            cc_addresses=data.cc or [],
        )

    if not external_recipients:
        # All recipients are internal — mark sent + tag, skip Resend
        message = execute_single(
            "UPDATE crm_email_messages SET status = 'sent', source_type = 'internal' WHERE id = :mid RETURNING *",
            {"mid": message["id"]},
        )

        # Link attachments
        if data.attachment_ids:
            for att_id in data.attachment_ids:
                try:
                    execute_insert(
                        "UPDATE crm_email_attachments SET message_id = :mid WHERE id = :aid AND message_id IS NULL RETURNING id",
                        {"mid": message["id"], "aid": att_id},
                    )
                except Exception:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to link attachment {att_id} to internal message {message['id']}")

        # Update sender thread last_message_at
        execute_single(
            "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
            {"tid": thread_id},
        )

        # Internal emails do NOT increment interaction counter — only external sends count
        # toward KPIs, sales goals, leaderboards, and rep performance metrics

        # Auto-create CRM activity (for audit trail, but not counted in metrics)
        if data.contact_id:
            execute_insert(
                """
                INSERT INTO crm_activities
                    (contact_id, rep_id, activity_type, subject, description, activity_date)
                VALUES (:cid, :rid, 'email', :subj, :desc, NOW())
                RETURNING id
                """,
                {
                    "cid": data.contact_id,
                    "rid": profile["id"],
                    "subj": f"Email: {data.subject}",
                    "desc": f"Sent email to {', '.join(data.to_emails)} (internal)",
                },
            )

        return {"message": message, "thread_id": thread_id, "internal": True}

    # Link attachments and build Resend attachment list
    resend_attachments = []
    if data.attachment_ids:
        import boto3
        import logging
        logger = logging.getLogger(__name__)
        s3 = boto3.client("s3", region_name="us-east-1")
        for att_id in data.attachment_ids:
            try:
                att = execute_insert(
                    "UPDATE crm_email_attachments SET message_id = :mid WHERE id = :aid AND message_id IS NULL RETURNING *",
                    {"mid": message["id"], "aid": att_id},
                )
                if att and att.get("s3_key"):
                    bucket = att.get("s3_bucket", settings.AWS_S3_BACKLOT_FILES_BUCKET)
                    s3_obj = s3.get_object(Bucket=bucket, Key=att["s3_key"])
                    file_bytes = s3_obj["Body"].read()
                    resend_attachments.append({
                        "filename": att["filename"],
                        "content": file_bytes,
                    })
                else:
                    logger.warning(f"Attachment {att_id} not found or already linked, skipping")
            except Exception as e:
                logger.warning(f"Failed to link attachment {att_id} to message {message['id']}: {e}")

    # Send via Resend
    resend_sdk.api_key = settings.RESEND_API_KEY

    # Replace inline-image API URLs with long-lived presigned URLs for outbound delivery
    outbound_html = _resolve_inline_images_for_send(body_html)

    send_params = {
        "from": f"{account['display_name']} <{account['email_address']}>",
        "to": external_recipients,
        "subject": data.subject,
        "html": add_email_inline_styles(outbound_html),
        "text": plain_text,
        "reply_to": reply_to,
    }
    if data.cc:
        send_params["cc"] = data.cc
    if data.bcc:
        send_params["bcc"] = data.bcc
    if resend_attachments:
        send_params["attachments"] = resend_attachments

    try:
        result = resend_sdk.Emails.send(send_params)
    except Exception as e:
        execute_single(
            "UPDATE crm_email_messages SET status = 'failed' WHERE id = :mid RETURNING id",
            {"mid": message["id"]},
        )
        detail = f"Failed to send email: {str(e)}"
        if resend_attachments:
            detail += f" (with {len(resend_attachments)} attachment(s))"
        raise HTTPException(502, detail)

    resend_id = result.get("id")

    # Update message with resend ID and sent status
    message = execute_single(
        "UPDATE crm_email_messages SET resend_message_id = :rid, status = 'sent' WHERE id = :mid RETURNING *",
        {"rid": resend_id, "mid": message["id"]},
    )

    # Update thread last_message_at
    execute_single(
        "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
        {"tid": thread_id},
    )

    # Auto-increment interaction counter (always, not gated by contact_id)
    _increment_interaction(profile["id"], "emails")

    # Set source_type on message
    execute_single(
        "UPDATE crm_email_messages SET source_type = 'manual' WHERE id = :mid RETURNING id",
        {"mid": message["id"]},
    )

    # Auto-create CRM activity
    if data.contact_id:
        execute_insert(
            """
            INSERT INTO crm_activities
                (contact_id, rep_id, activity_type, subject, description, activity_date)
            VALUES (:cid, :rid, 'email', :subj, :desc, NOW())
            RETURNING id
            """,
            {
                "cid": data.contact_id,
                "rid": profile["id"],
                "subj": f"Email: {data.subject}",
                "desc": f"Sent email to {', '.join(data.to_emails)}",
            },
        )

    return {"message": message, "thread_id": thread_id}


# ============================================================================
# CRM Email — Inbound Webhook (public, verified via Resend signature)
# ============================================================================

from fastapi import Request


def _clean_email_address(addr: str) -> str:
    """Normalize email: strip whitespace, lowercase, extract from angle brackets."""
    clean = addr.strip().lower()
    if "<" in clean:
        clean = clean.split("<")[-1].rstrip(">")
    return clean


def _deliver_inbound_to_account(
    account: dict,
    from_address: str,
    subject: str,
    html_body: str,
    text_body: str,
    to_addresses: list,
    cc_addresses: list,
    thread_id_override: str | None = None,
    attachments: list | None = None,
    resend_received_id: str | None = None,
) -> dict | None:
    """
    Deliver an inbound email to a single CRM email account.
    Creates/finds a thread, stores the message, sends notifications.
    Returns the stored message dict, or None on failure.
    Deduplicates using resend_received_id + account_id to prevent
    duplicate messages when multiple per-recipient webhooks fire.
    """
    import logging
    _log = logging.getLogger(__name__)

    # --- Loopback check: skip if from_address is the account's own email ---
    # When a CRM user sends a reply, Resend echoes it back as an inbound message.
    account_email = account.get("email_address", "")
    if from_address and account_email and from_address.lower() == account_email.lower():
        _log.info(f"Loopback: skipping inbound from own account {account_email}")
        return None

    # --- Dedup check: skip if this email was already delivered to this account ---
    if resend_received_id:
        existing = execute_single(
            """SELECT m.id FROM crm_email_messages m
               JOIN crm_email_threads t ON t.id = m.thread_id
               WHERE m.resend_received_id = :rid AND t.account_id = :aid LIMIT 1""",
            {"rid": resend_received_id, "aid": account["id"]},
        )
        if existing:
            _log.info(f"Dedup: email {resend_received_id} already delivered to account {account['email_address']}, skipping")
            return None

    thread_id = thread_id_override

    if not thread_id:
        # No reply+ thread — try subject-based threading first (like Gmail).
        # Strip "Re:", "RE:", "Fwd:", "FW:" prefixes and match against existing
        # threads for this account from the same sender.
        import re as _re
        normalized_subject = _re.sub(
            r'^(Re:\s*|RE:\s*|Fwd:\s*|FW:\s*|Fw:\s*)+', '', subject or ''
        ).strip()

        existing_thread = None
        if normalized_subject:
            # Find the most recent thread for this account with the same
            # base subject — match by subject only (like Gmail), regardless
            # of sender. This handles: replies from different people in a
            # group conversation, CRM-to-CRM emails, and Reply All chains.
            existing_thread = execute_single(
                """
                SELECT * FROM crm_email_threads
                WHERE account_id = :aid
                  AND (
                    LOWER(subject) = LOWER(:subj)
                    OR LOWER(subject) = LOWER(:norm_subj)
                  )
                ORDER BY last_message_at DESC NULLS LAST
                LIMIT 1
                """,
                {
                    "aid": account["id"],
                    "subj": subject,
                    "norm_subj": normalized_subject,
                },
            )

        if existing_thread:
            thread_id = str(existing_thread["id"])
            _log.info(f"Subject-match: threading into existing thread {thread_id} for '{normalized_subject}'")
        else:
            # Truly new conversation — create a fresh thread
            linked_contact = execute_single(
                "SELECT id FROM crm_contacts WHERE LOWER(email) = LOWER(:email) LIMIT 1",
                {"email": from_address},
            )
            contact_id = linked_contact["id"] if linked_contact else None

            new_thread = execute_single(
                """
                INSERT INTO crm_email_threads (account_id, contact_id, contact_email, subject)
                VALUES (:aid, :cid, :email, :subj) RETURNING *
                """,
                {
                    "aid": account["id"],
                    "cid": contact_id,
                    "email": from_address,
                    "subj": normalized_subject or subject,
                },
            )
            thread_id = str(new_thread["id"])

    # Verify thread exists
    thread = execute_single(
        "SELECT * FROM crm_email_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        _log.warning(f"Thread {thread_id} not found for account {account['id']}")
        return None

    # Auto-link contact if thread has no contact_id
    if not thread.get("contact_id"):
        linked_contact = execute_single(
            "SELECT id FROM crm_contacts WHERE LOWER(email) = LOWER(:email) LIMIT 1",
            {"email": from_address},
        )
        if linked_contact:
            execute_single(
                "UPDATE crm_email_threads SET contact_id = :cid WHERE id = :tid RETURNING id",
                {"cid": linked_contact["id"], "tid": thread_id},
            )
            thread["contact_id"] = linked_contact["id"]

    # Time-based dedup: Resend splits multi-recipient emails into separate
    # records with DIFFERENT resend_received_ids. So the same email arriving
    # via reply+{uuid} and via the rep's direct address creates 2 records.
    # Check if this thread already has a recent inbound message from the same
    # sender within the last 2 minutes — if so, it's a per-recipient duplicate.
    recent_dup = execute_single(
        """SELECT m.id FROM crm_email_messages m
           WHERE m.thread_id = :tid
             AND LOWER(m.from_address) = LOWER(:from_addr)
             AND m.direction = 'inbound'
             AND m.created_at > NOW() - INTERVAL '2 minutes'
           LIMIT 1""",
        {"tid": thread_id, "from_addr": from_address},
    )
    if recent_dup:
        _log.info(f"Dedup (time-based): message from {from_address} already in thread {thread_id} within last 2min, skipping")
        return None

    # Store inbound message (ON CONFLICT prevents race condition duplicates)
    message = execute_single(
        """
        INSERT INTO crm_email_messages
            (thread_id, direction, from_address, to_addresses, cc_addresses, subject,
             body_html, body_text, status, resend_received_id)
        VALUES (:tid, 'inbound', :from_addr, :to_addrs, :cc_addrs, :subj,
                :html, :text, 'received', :rrid)
        ON CONFLICT (resend_received_id, thread_id)
            WHERE resend_received_id IS NOT NULL
        DO NOTHING
        RETURNING *
        """,
        {
            "tid": thread_id,
            "from_addr": from_address,
            "to_addrs": to_addresses,
            "cc_addrs": cc_addresses if cc_addresses else [],
            "subj": subject,
            "html": html_body,
            "text": text_body,
            "rrid": resend_received_id,
        },
    )
    if not message and resend_received_id:
        _log.info(f"Dedup (ON CONFLICT): email {resend_received_id} already exists in thread {thread_id}")
        return None

    # Store inbound attachments (download from Resend CDN → S3)
    if attachments and message:
        import uuid
        import boto3
        import httpx as _httpx
        from app.core.config import settings as _settings
        s3 = boto3.client("s3", region_name="us-east-1")
        bucket = _settings.AWS_S3_BACKLOT_FILES_BUCKET
        for att in attachments:
            try:
                att_resp = _httpx.get(att["download_url"], timeout=30)
                if att_resp.status_code != 200:
                    continue
                file_bytes = att_resp.content

                att_id = str(uuid.uuid4())
                filename = att.get("filename", "attachment")
                ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
                s3_key = f"email-attachments/{account['id']}/{att_id}.{ext}"
                s3.put_object(
                    Bucket=bucket, Key=s3_key, Body=file_bytes,
                    ContentType=att.get("content_type", "application/octet-stream"),
                )

                execute_insert(
                    """INSERT INTO crm_email_attachments (id, message_id, filename, content_type, size_bytes, s3_key, s3_bucket)
                       VALUES (:id, :mid, :filename, :ct, :size, :key, :bucket) RETURNING id""",
                    {"id": att_id, "mid": message["id"], "filename": filename,
                     "ct": att.get("content_type"), "size": att.get("size", len(file_bytes)),
                     "key": s3_key, "bucket": bucket},
                )
            except Exception as e:
                _log.warning(f"Failed to store inbound attachment {att.get('filename')}: {e}")

    # Parse ICS calendar invites from attachments
    if attachments and message:
        for att in attachments:
            ct = (att.get("content_type") or "").lower()
            fn = (att.get("filename") or "").lower()
            if "calendar" in ct or fn.endswith(".ics"):
                try:
                    _parse_and_store_calendar_event(att, message, account, _log)
                except Exception as e:
                    _log.warning(f"Failed to parse ICS from {fn}: {e}")

    # Update thread: bump last_message_at, increment unread, clear snooze
    execute_single(
        """
        UPDATE crm_email_threads
        SET last_message_at = NOW(), unread_count = unread_count + 1,
            snoozed_until = NULL, is_archived = false
        WHERE id = :tid RETURNING id
        """,
        {"tid": thread_id},
    )

    # Auto-stop active sequence enrollments when contact replies
    if thread.get("contact_id"):
        execute_query(
            """
            UPDATE crm_email_sequence_enrollments
            SET status = 'replied', completed_at = NOW()
            WHERE contact_id = :cid AND status = 'active'
            RETURNING id
            """,
            {"cid": thread["contact_id"]},
        )

    # Auto-increment interaction counter + create activity
    from app.api.crm_email_helpers import increment_email_interaction, create_email_activity
    increment_email_interaction(account["profile_id"], "emails_received")
    contact_id = thread.get("contact_id")
    if contact_id:
        create_email_activity(
            contact_id=contact_id,
            rep_id=account["profile_id"],
            activity_type="email_received",
            subject=f"Received: {subject}",
            description=f"Inbound email from {from_address}",
            deal_id=thread.get("deal_id"),
        )

    # Skip all notifications for loopback messages (own CRM reply echoed back by Resend)
    account_email = account.get("email_address", "")
    is_loopback = from_address and account_email and from_address.lower() == account_email.lower()

    # WebSocket notification (best-effort)
    if not is_loopback:
        try:
            import boto3
            import json as json_mod
            dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
            ws_table = dynamodb.Table("second-watch-websocket-connections")

            resp = ws_table.query(
                IndexName="GSI1",
                KeyConditionExpression="GSI1PK = :pk",
                ExpressionAttributeValues={":pk": f"PROFILE#{account['profile_id']}"},
            )
            if resp.get("Items"):
                apigw = boto3.client("apigatewaymanagementapi",
                    endpoint_url="https://df3xkisme7.execute-api.us-east-1.amazonaws.com/prod")
                notification = json_mod.dumps({
                    "event": "crm:email:new",
                    "thread_id": thread_id,
                    "from": from_address,
                    "subject": subject,
                    "preview": (text_body or "")[:100],
                })
                for item in resp["Items"]:
                    conn_id = item.get("SK", "").replace("CONN#", "")
                    if conn_id:
                        try:
                            apigw.post_to_connection(
                                ConnectionId=conn_id,
                                Data=notification.encode("utf-8"),
                            )
                        except Exception:
                            pass
        except Exception:
            pass

    # Email notification (best-effort)
    if message and not is_loopback:
        try:
            notif_mode = account.get("notification_mode", "off")
            notif_email = account.get("notification_email")
            if notif_mode != "off" and notif_email:
                if notif_email.lower() != account_email.lower():
                    if notif_mode == "instant":
                        import resend as resend_sdk
                        from app.core.config import settings as _settings
                        from app.services.email_templates import build_instant_notification_email
                        thread_url = f"https://www.secondwatchnetwork.com/crm/email?thread={thread_id}"
                        html = build_instant_notification_email(
                            account_email=account_email,
                            from_address=from_address or "Unknown",
                            subject=subject or "(no subject)",
                            preview=(text_body or "")[:300],
                            thread_url=thread_url,
                        )
                        resend_sdk.api_key = _settings.RESEND_API_KEY
                        resend_sdk.Emails.send({
                            "from": "Second Watch Network <notifications@theswn.com>",
                            "to": [notif_email],
                            "subject": f"New email from {from_address or 'Unknown'}: {subject or '(no subject)'}",
                            "html": html,
                        })
                        _log.info(f"Instant notification sent to {notif_email} for thread {thread_id}")
                    elif notif_mode == "digest":
                        execute_insert(
                            """
                            INSERT INTO crm_email_notification_queue
                            (account_id, thread_id, message_id, from_address, subject, preview_text)
                            VALUES (:account_id, :thread_id, :message_id, :from_addr, :subject, :preview)
                            RETURNING id
                            """,
                            {
                                "account_id": account["id"],
                                "thread_id": thread_id,
                                "message_id": message["id"],
                                "from_addr": from_address or "Unknown",
                                "subject": subject or "(no subject)",
                                "preview": (text_body or "")[:300],
                            },
                        )
        except Exception as e:
            _log.error(f"Failed to send inbound email notification for thread {thread_id}: {e}")

    return message


@router.post("/email/webhook/inbound")
async def email_inbound_webhook_handler(request: Request):
    """
    Resend inbound email webhook with signature verification.
    Supports group/multi-recipient emails: delivers to ALL matching CRM
    accounts found in TO and CC, not just the first match.
    """
    import re
    import hmac
    import hashlib
    import base64
    import logging as _logging
    import httpx
    from app.core.config import settings

    _log = _logging.getLogger(__name__)

    # --- Verify Resend webhook signature ---
    raw_body = await request.body()
    signature = request.headers.get("svix-signature", "")
    if settings.RESEND_WEBHOOK_SIGNING_SECRET and signature:
        msg_id = request.headers.get("svix-id", "")
        timestamp = request.headers.get("svix-timestamp", "")
        to_sign = f"{msg_id}.{timestamp}.{raw_body.decode()}"
        secret = settings.RESEND_WEBHOOK_SIGNING_SECRET
        if secret.startswith("whsec_"):
            secret_bytes = base64.b64decode(secret[6:])
        else:
            secret_bytes = secret.encode()
        expected = base64.b64encode(
            hmac.new(secret_bytes, to_sign.encode(), hashlib.sha256).digest()
        ).decode()
        valid = any(
            hmac.compare_digest(expected, sig.replace("v1,", ""))
            for sig in signature.split(" ")
        )
        if not valid:
            raise HTTPException(401, "Invalid webhook signature")

    body = json.loads(raw_body)
    event_type = body.get("type", "")

    if event_type != "email.received":
        return {"status": "ignored", "type": event_type}

    # Wrap entire processing in try/except — always return 200 to prevent
    # Resend from retrying (retries cause duplicate deliveries).
    try:
        return await _process_inbound_email(body, _log, settings, httpx)
    except Exception as e:
        _log.error(f"CRITICAL: Inbound email webhook failed: {e}", exc_info=True)
        return {"status": "error", "detail": str(e)}


async def _process_inbound_email(body: dict, _log, settings, httpx):
    """Inner handler for inbound email processing — separated for error isolation."""
    import re

    # --- Phase A: Parse payload (with CC extraction) ---
    payload = body.get("data", {})
    to_addresses = payload.get("to", [])
    cc_addresses_raw = payload.get("cc", [])
    from_address = payload.get("from", "")
    subject = payload.get("subject", "")
    email_id = payload.get("email_id", "")

    # --- Phase B: Fetch full email body + merge headers BEFORE reply+ scan ---
    html_body = ""
    text_body = ""
    cc_from_api = []
    if email_id and settings.RESEND_API_KEY:
        try:
            resp = httpx.get(
                f"https://api.resend.com/emails/receiving/{email_id}",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                timeout=10,
            )
            if resp.status_code == 200:
                email_data = resp.json()
                html_body = email_data.get("html") or ""
                text_body = email_data.get("text") or ""
                cc_from_api = email_data.get("cc") or []
                # Resend splits multi-recipient emails into per-recipient records,
                # so the top-level "to" only has 1 address. But the raw email headers
                # contain the full To: list. Parse it to deliver to ALL recipients.
                email_headers = email_data.get("headers") or {}
                header_to = email_headers.get("to", "")
                if header_to:
                    # Parse comma-separated "addr1, addr2, addr3" from header
                    parsed_addrs = [a.strip() for a in header_to.split(",") if a.strip()]
                    existing = {_clean_email_address(a) for a in to_addresses}
                    for addr in parsed_addrs:
                        clean = _clean_email_address(addr)
                        if clean and clean not in existing:
                            to_addresses.append(addr)
                            existing.add(clean)
                    _log.info(f"Merged TO from headers: {len(to_addresses)} addresses total")
                header_cc = email_headers.get("cc", "")
                if header_cc and not cc_from_api:
                    parsed_cc = [a.strip() for a in header_cc.split(",") if a.strip()]
                    cc_from_api = parsed_cc
                if not from_address:
                    from_address = email_data.get("from", "")
                if not subject:
                    subject = email_data.get("subject", "")
            else:
                _log.warning(f"Resend API returned {resp.status_code} for email {email_id}")
        except Exception as e:
            _log.error(f"Failed to fetch inbound email content: {e}")

    # --- Fetch inbound attachments from Resend API ---
    attachments_list = []
    if email_id and settings.RESEND_API_KEY:
        try:
            att_resp = httpx.get(
                f"https://api.resend.com/emails/receiving/{email_id}/attachments",
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                timeout=10,
            )
            if att_resp.status_code == 200:
                att_data = att_resp.json()
                attachments_list = att_data.get("data", [])
        except Exception as e:
            _log.error(f"Failed to fetch inbound attachments: {e}")

    # Merge and deduplicate CC addresses from webhook payload + API response
    all_cc_raw = cc_addresses_raw + cc_from_api
    seen_cc = set()
    all_cc = []
    for addr in all_cc_raw:
        normalized = _clean_email_address(addr)
        if normalized and normalized not in seen_cc:
            seen_cc.add(normalized)
            all_cc.append(addr)

    # --- Phase C: Scan for reply+ thread ID in merged TO + CC ---
    # MUST run after header merge so we see the full recipient list.
    # When someone replies to a CRM email, Gmail sends to both the rep's
    # address AND reply+{uuid}@theswn.com. Resend splits per-recipient,
    # so the webhook payload may only have 1 TO address, but the merged
    # headers contain ALL recipients including the reply+ routing address.
    reply_thread_id = None
    for addr in to_addresses + all_cc:
        match = re.search(r"reply\+([a-f0-9-]+)@", addr)
        if match:
            reply_thread_id = match.group(1)
            _log.info(f"Found reply+ thread routing: {reply_thread_id}")
            break

    # --- Phase D: Find ALL matching CRM accounts in TO + CC ---
    matched_accounts = []
    seen_account_ids = set()
    for addr in to_addresses + all_cc_raw:
        clean = _clean_email_address(addr)
        if not clean or "reply+" in clean:
            continue
        acct = execute_single(
            "SELECT * FROM crm_email_accounts WHERE LOWER(email_address) = :email AND is_active = true LIMIT 1",
            {"email": clean},
        )
        if acct and acct["id"] not in seen_account_ids:
            matched_accounts.append(acct)
            seen_account_ids.add(acct["id"])

    _log.info(f"Inbound email from {from_address}: found {len(matched_accounts)} CRM accounts out of {len(to_addresses + all_cc_raw)} addresses scanned")

    # --- Phase E: Deliver to reply+ thread first (if applicable) ---
    delivered_account_ids = set()
    message_ids = []
    errors = []

    if reply_thread_id:
        try:
            reply_thread = execute_single(
                "SELECT * FROM crm_email_threads WHERE id = :tid",
                {"tid": reply_thread_id},
            )
            if reply_thread:
                reply_account = execute_single(
                    "SELECT * FROM crm_email_accounts WHERE id = :aid",
                    {"aid": reply_thread["account_id"]},
                )
                if reply_account:
                    msg = _deliver_inbound_to_account(
                        account=reply_account,
                        from_address=from_address,
                        subject=subject,
                        html_body=html_body,
                        text_body=text_body,
                        to_addresses=to_addresses,
                        cc_addresses=all_cc,
                        thread_id_override=reply_thread_id,
                        attachments=attachments_list,
                        resend_received_id=email_id,
                    )
                    if msg:
                        message_ids.append(msg["id"])
                    delivered_account_ids.add(reply_account["id"])
            else:
                _log.warning(f"Reply+ thread {reply_thread_id} not found")
        except Exception as e:
            _log.error(f"Error delivering to reply+ thread {reply_thread_id}: {e}")
            errors.append(f"reply+:{reply_thread_id}:{e}")

    # --- Phase F: Deliver to all other matched CRM accounts ---
    for acct in matched_accounts:
        if acct["id"] in delivered_account_ids:
            continue
        try:
            msg = _deliver_inbound_to_account(
                account=acct,
                from_address=from_address,
                subject=subject,
                html_body=html_body,
                text_body=text_body,
                to_addresses=to_addresses,
                cc_addresses=all_cc,
                attachments=attachments_list,
                resend_received_id=email_id,
            )
            if msg:
                message_ids.append(msg["id"])
            delivered_account_ids.add(acct["id"])
        except Exception as e:
            _log.error(f"Error delivering inbound to {acct['email_address']}: {e}")
            errors.append(f"{acct['email_address']}:{e}")

    # --- Phase G: Return ---
    _log.info(
        f"Inbound email {email_id} from {from_address}: "
        f"delivered={len(message_ids)}, accounts={len(delivered_account_ids)}, "
        f"errors={len(errors)}, reply_thread={reply_thread_id}"
    )

    if not message_ids and not reply_thread_id:
        return {"status": "no_thread_match", "from": from_address}

    result = {
        "status": "stored",
        "message_ids": message_ids,
        "delivered_to": len(delivered_account_ids),
    }
    if errors:
        result["errors"] = errors
    return result


# ============================================================================
# CRM Email — Deal-Email Linking
# ============================================================================

class LinkDealRequest(BaseModel):
    deal_id: Optional[str] = None

@router.patch("/email/threads/{thread_id}/deal")
async def link_thread_to_deal(
    thread_id: str,
    data: LinkDealRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Link or unlink an email thread to a deal."""
    result = execute_single(
        "UPDATE crm_email_threads SET deal_id = :did WHERE id = :tid RETURNING *",
        {"did": data.deal_id, "tid": thread_id},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result

@router.get("/email/deals/{deal_id}/threads")
async def get_deal_email_threads(
    deal_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get all email threads linked to a deal."""
    threads = execute_query(
        """
        SELECT t.*, a.display_name as account_name,
               (SELECT COUNT(*) FROM crm_email_messages m WHERE m.thread_id = t.id) as message_count
        FROM crm_email_threads t
        LEFT JOIN crm_email_accounts a ON a.id = t.account_id
        WHERE t.deal_id = :did
        ORDER BY t.last_message_at DESC
        """,
        {"did": deal_id},
    )
    return {"threads": threads}


# ============================================================================
# CRM Email — Star / Snooze / Bulk / Link / Assign
# ============================================================================

@router.patch("/email/threads/{thread_id}/star")
async def toggle_star_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Toggle starred status on a thread."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")
    result = execute_single(
        "UPDATE crm_email_threads SET is_starred = NOT COALESCE(is_starred, false) WHERE id = :tid AND account_id = :aid RETURNING *",
        {"tid": thread_id, "aid": account["id"]},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result


class SnoozeRequest(BaseModel):
    snoozed_until: str  # ISO datetime


@router.patch("/email/threads/{thread_id}/snooze")
async def snooze_thread(
    thread_id: str,
    data: SnoozeRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Snooze a thread until a specific time."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")
    result = execute_single(
        "UPDATE crm_email_threads SET snoozed_until = :until WHERE id = :tid AND account_id = :aid RETURNING *",
        {"tid": thread_id, "aid": account["id"], "until": data.snoozed_until},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result


class BulkActionRequest(BaseModel):
    thread_ids: List[str]
    action: str  # archive, read, unread, star, delete, restore


@router.post("/email/threads/bulk")
async def bulk_thread_action(
    data: BulkActionRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Perform bulk actions on threads. Max 50 threads per request."""
    if len(data.thread_ids) > 50:
        raise HTTPException(400, "Maximum 50 threads per bulk action")

    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")

    if data.action == "archive":
        execute_query(
            "UPDATE crm_email_threads SET is_archived = true WHERE id = ANY(:ids) AND account_id = :aid RETURNING id",
            {"ids": data.thread_ids, "aid": account["id"]},
        )
    elif data.action == "read":
        execute_query(
            "UPDATE crm_email_threads SET unread_count = 0 WHERE id = ANY(:ids) AND account_id = :aid RETURNING id",
            {"ids": data.thread_ids, "aid": account["id"]},
        )
    elif data.action == "unread":
        execute_query(
            "UPDATE crm_email_threads SET unread_count = GREATEST(unread_count, 1) WHERE id = ANY(:ids) AND account_id = :aid RETURNING id",
            {"ids": data.thread_ids, "aid": account["id"]},
        )
    elif data.action == "star":
        execute_query(
            "UPDATE crm_email_threads SET is_starred = true WHERE id = ANY(:ids) AND account_id = :aid RETURNING id",
            {"ids": data.thread_ids, "aid": account["id"]},
        )
    elif data.action == "delete":
        execute_query(
            "UPDATE crm_email_threads SET is_deleted = true WHERE id = ANY(:ids) AND account_id = :aid RETURNING id",
            {"ids": data.thread_ids, "aid": account["id"]},
        )
    elif data.action == "restore":
        execute_query(
            "UPDATE crm_email_threads SET is_deleted = false WHERE id = ANY(:ids) AND account_id = :aid RETURNING id",
            {"ids": data.thread_ids, "aid": account["id"]},
        )
    else:
        raise HTTPException(400, f"Unknown action: {data.action}")

    return {"success": True, "count": len(data.thread_ids)}


class LinkContactRequest(BaseModel):
    contact_id: str


@router.patch("/email/threads/{thread_id}/link-contact")
async def link_thread_contact(
    thread_id: str,
    data: LinkContactRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Link a thread to a CRM contact."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")
    result = execute_single(
        "UPDATE crm_email_threads SET contact_id = :cid WHERE id = :tid AND account_id = :aid RETURNING *",
        {"tid": thread_id, "aid": account["id"], "cid": data.contact_id},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result


@router.patch("/email/threads/{thread_id}/unlink-contact")
async def unlink_thread_contact(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Unlink a thread from its CRM contact."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")
    result = execute_single(
        "UPDATE crm_email_threads SET contact_id = NULL WHERE id = :tid AND account_id = :aid RETURNING *",
        {"tid": thread_id, "aid": account["id"]},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result


class AssignThreadRequest(BaseModel):
    assigned_to: Optional[str] = None  # profile ID or None to unassign


@router.patch("/email/threads/{thread_id}/assign")
async def assign_thread(
    thread_id: str,
    data: AssignThreadRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Assign a thread to a rep (admin only)."""
    result = execute_single(
        "UPDATE crm_email_threads SET assigned_to = :assigned WHERE id = :tid RETURNING *",
        {"tid": thread_id, "assigned": data.assigned_to},
    )
    if not result:
        raise HTTPException(404, "Thread not found")
    return result


# ============================================================================
# CRM Email — Internal Notes
# ============================================================================

@router.get("/email/threads/{thread_id}/notes")
async def get_thread_notes(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get internal notes for a thread."""
    rows = execute_query(
        """
        SELECT n.*, p.full_name as author_name, p.avatar_url as author_avatar
        FROM crm_email_internal_notes n
        JOIN profiles p ON p.id = n.author_id
        WHERE n.thread_id = :tid
        ORDER BY n.created_at ASC
        """,
        {"tid": thread_id},
    )
    return {"notes": rows}


class CreateNoteRequest(BaseModel):
    content: str


@router.post("/email/threads/{thread_id}/notes")
async def create_thread_note(
    thread_id: str,
    data: CreateNoteRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Add an internal note to a thread."""
    result = execute_single(
        """
        INSERT INTO crm_email_internal_notes (thread_id, author_id, content)
        VALUES (:tid, :aid, :content) RETURNING *
        """,
        {"tid": thread_id, "aid": profile["id"], "content": data.content},
    )
    return result


@router.delete("/email/threads/{thread_id}/notes/{note_id}")
async def delete_thread_note(
    thread_id: str,
    note_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Delete an internal note."""
    result = execute_single(
        "DELETE FROM crm_email_internal_notes WHERE id = :nid AND thread_id = :tid AND author_id = :aid RETURNING id",
        {"nid": note_id, "tid": thread_id, "aid": profile["id"]},
    )
    if not result:
        raise HTTPException(404, "Note not found or not yours")
    return {"success": True}


# ============================================================================
# CRM Email — Labels
# ============================================================================

@router.get("/email/labels")
async def list_email_labels(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List labels for the current user's email account."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        return {"labels": []}
    rows = execute_query(
        "SELECT * FROM crm_email_labels WHERE account_id = :aid ORDER BY name ASC",
        {"aid": account["id"]},
    )
    return {"labels": rows}


class CreateLabelRequest(BaseModel):
    name: str
    color: Optional[str] = "#6B7280"


@router.post("/email/labels")
async def create_email_label(
    data: CreateLabelRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Create a label."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")
    result = execute_single(
        "INSERT INTO crm_email_labels (account_id, name, color) VALUES (:aid, :name, :color) RETURNING *",
        {"aid": account["id"], "name": data.name, "color": data.color},
    )
    return result


class UpdateLabelRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


@router.put("/email/labels/{label_id}")
async def update_email_label(
    label_id: str,
    data: UpdateLabelRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Update a label."""
    updates = data.dict(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    set_clauses = [f"{k} = :{k}" for k in updates]
    params = {"id": label_id, **updates}
    result = execute_single(
        f"UPDATE crm_email_labels SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    if not result:
        raise HTTPException(404, "Label not found")
    return result


@router.delete("/email/labels/{label_id}")
async def delete_email_label(
    label_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Delete a label."""
    result = execute_single(
        "DELETE FROM crm_email_labels WHERE id = :id RETURNING id",
        {"id": label_id},
    )
    if not result:
        raise HTTPException(404, "Label not found")
    return {"success": True}


@router.post("/email/threads/{thread_id}/labels/{label_id}")
async def add_thread_label(
    thread_id: str,
    label_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Add a label to a thread."""
    result = execute_single(
        "INSERT INTO crm_email_thread_labels (thread_id, label_id) VALUES (:tid, :lid) ON CONFLICT DO NOTHING RETURNING *",
        {"tid": thread_id, "lid": label_id},
    )
    return {"success": True}


@router.delete("/email/threads/{thread_id}/labels/{label_id}")
async def remove_thread_label(
    thread_id: str,
    label_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Remove a label from a thread."""
    execute_single(
        "DELETE FROM crm_email_thread_labels WHERE thread_id = :tid AND label_id = :lid RETURNING thread_id",
        {"tid": thread_id, "lid": label_id},
    )
    return {"success": True}


# ============================================================================
# CRM Email — Quick Replies
# ============================================================================

@router.get("/email/quick-replies")
async def list_quick_replies(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get system default quick replies + user's custom replies."""
    rows = execute_query(
        """
        SELECT * FROM crm_email_quick_replies
        WHERE profile_id IS NULL OR profile_id = :pid
        ORDER BY is_system DESC, sort_order ASC, title ASC
        """,
        {"pid": profile["id"]},
    )
    return {"quick_replies": rows}


class QuickReplyCreate(BaseModel):
    title: str
    body_text: str
    body_html: Optional[str] = None
    sort_order: Optional[int] = 0


@router.post("/email/quick-replies")
async def create_quick_reply(
    data: QuickReplyCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Create a custom quick reply."""
    result = execute_single(
        """
        INSERT INTO crm_email_quick_replies (profile_id, title, body_text, body_html, sort_order)
        VALUES (:pid, :title, :body_text, :body_html, :sort_order) RETURNING *
        """,
        {"pid": profile["id"], "title": data.title, "body_text": data.body_text,
         "body_html": data.body_html, "sort_order": data.sort_order},
    )
    return result


class QuickReplyUpdate(BaseModel):
    title: Optional[str] = None
    body_text: Optional[str] = None
    body_html: Optional[str] = None
    sort_order: Optional[int] = None


@router.put("/email/quick-replies/{reply_id}")
async def update_quick_reply(
    reply_id: str,
    data: QuickReplyUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Update a custom quick reply (only your own)."""
    updates = data.dict(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    set_clauses = [f"{k} = :{k}" for k in updates]
    params = {"id": reply_id, "pid": profile["id"], **updates}
    result = execute_single(
        f"UPDATE crm_email_quick_replies SET {', '.join(set_clauses)} WHERE id = :id AND profile_id = :pid RETURNING *",
        params,
    )
    if not result:
        raise HTTPException(404, "Quick reply not found or not yours")
    return result


@router.delete("/email/quick-replies/{reply_id}")
async def delete_quick_reply(
    reply_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Delete a custom quick reply."""
    result = execute_single(
        "DELETE FROM crm_email_quick_replies WHERE id = :id AND profile_id = :pid AND is_system = false RETURNING id",
        {"id": reply_id, "pid": profile["id"]},
    )
    if not result:
        raise HTTPException(404, "Quick reply not found or is a system default")
    return {"success": True}


# ============================================================================
# CRM Email — Attachments
# ============================================================================

class AttachmentUploadRequest(BaseModel):
    filename: str
    content_type: str
    size_bytes: int


@router.post("/email/attachments/upload-url")
async def get_attachment_upload_url(
    data: AttachmentUploadRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Get a presigned S3 PUT URL for uploading an email attachment."""
    import boto3
    import uuid as uuid_mod
    import logging
    from app.core.config import settings

    logger = logging.getLogger(__name__)

    if data.size_bytes > 10 * 1024 * 1024:
        raise HTTPException(400, "Maximum attachment size is 10MB")

    # Block dangerous file extensions
    BLOCKED_EXTENSIONS = {"exe", "bat", "cmd", "scr", "pif", "msi", "js", "vbs", "wsf", "ps1", "sh"}
    ext = data.filename.rsplit(".", 1)[-1].lower() if "." in data.filename else "bin"
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(400, f"File type .{ext} is not allowed")

    # Use email account ID for S3 path if available, otherwise fall back to profile ID
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    folder_id = account["id"] if account else profile["id"]

    attachment_id = str(uuid_mod.uuid4())
    s3_key = f"email-attachments/{folder_id}/{attachment_id}.{ext}"
    bucket = settings.AWS_S3_BACKLOT_FILES_BUCKET

    try:
        s3 = boto3.client("s3", region_name="us-east-1")
        presigned_url = s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": s3_key, "ContentType": data.content_type},
            ExpiresIn=300,
        )
    except Exception as e:
        logger.error(f"Failed to generate presigned URL for attachment: {e}")
        raise HTTPException(500, "Failed to generate upload URL")

    # Create attachment record (not yet linked to a message — message_id is NULL)
    att = execute_insert(
        """
        INSERT INTO crm_email_attachments (id, message_id, filename, content_type, size_bytes, s3_key, s3_bucket)
        VALUES (:id, NULL, :filename, :content_type, :size_bytes, :s3_key, :bucket) RETURNING *
        """,
        {"id": attachment_id, "filename": data.filename, "content_type": data.content_type,
         "size_bytes": data.size_bytes, "s3_key": s3_key, "bucket": bucket},
    )

    return {"attachment": att, "upload_url": presigned_url}


@router.get("/email/attachments/{attachment_id}/download")
async def get_attachment_download_url(
    attachment_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get a presigned S3 GET URL for downloading an attachment."""
    import boto3
    from app.core.config import settings

    att = execute_single(
        "SELECT * FROM crm_email_attachments WHERE id = :id",
        {"id": attachment_id},
    )
    if not att or not att.get("s3_key"):
        raise HTTPException(404, "Attachment not found")

    bucket = att.get("s3_bucket") or settings.AWS_S3_BACKLOT_FILES_BUCKET
    s3 = boto3.client("s3", region_name="us-east-1")
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": att["s3_key"], "ResponseContentDisposition": f'attachment; filename="{att["filename"]}"'},
        ExpiresIn=300,
    )
    return {"download_url": url, "filename": att["filename"]}


@router.get("/email/inline-image/{attachment_id}")
async def serve_inline_image(
    attachment_id: str,
):
    """Serve an inline image via redirect to a fresh presigned S3 URL.
    No auth required — attachment UUIDs are unguessable and this enables <img> tags."""
    import boto3
    from app.core.config import settings
    from starlette.responses import RedirectResponse

    att = execute_single(
        "SELECT * FROM crm_email_attachments WHERE id = :id",
        {"id": attachment_id},
    )
    if not att or not att.get("s3_key"):
        raise HTTPException(404, "Image not found")

    bucket = att.get("s3_bucket") or settings.AWS_S3_BACKLOT_FILES_BUCKET
    s3 = boto3.client("s3", region_name="us-east-1")
    url = s3.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket,
            "Key": att["s3_key"],
            "ResponseContentType": att.get("content_type", "image/png"),
        },
        ExpiresIn=3600,
    )
    return RedirectResponse(url=url, status_code=302)


# ============================================================================
# CRM Email — Scheduled Sends
# ============================================================================

@router.get("/email/scheduled")
async def list_scheduled_emails(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List pending scheduled messages."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        return {"messages": []}

    rows = execute_query(
        """
        SELECT m.*, t.subject as thread_subject, t.contact_email
        FROM crm_email_messages m
        JOIN crm_email_threads t ON t.id = m.thread_id
        WHERE t.account_id = :aid AND m.status = 'scheduled' AND m.scheduled_at IS NOT NULL
        ORDER BY m.scheduled_at ASC
        """,
        {"aid": account["id"]},
    )
    return {"messages": rows}


@router.post("/email/messages/{message_id}/cancel-schedule")
async def cancel_scheduled_email(
    message_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Cancel a scheduled email."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(404, "No email account")

    result = execute_single(
        """
        UPDATE crm_email_messages SET status = 'cancelled', scheduled_at = NULL
        WHERE id = :mid AND status = 'scheduled'
        AND thread_id IN (SELECT id FROM crm_email_threads WHERE account_id = :aid)
        RETURNING *
        """,
        {"mid": message_id, "aid": account["id"]},
    )
    if not result:
        raise HTTPException(404, "Scheduled message not found")
    return result


# ============================================================================
# CRM Email — Open Tracking (Public endpoint)
# ============================================================================

@router.get("/email/track/{message_id}/open.png")
async def track_email_open(
    message_id: str,
    request: Request,
):
    """Public tracking pixel endpoint. Returns 1x1 transparent PNG."""
    import base64

    # Record the open
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    try:
        execute_insert(
            "INSERT INTO crm_email_opens (message_id, ip_address, user_agent) VALUES (:mid, :ip, :ua) RETURNING id",
            {"mid": message_id, "ip": ip, "ua": ua},
        )
    except Exception:
        pass

    # 1x1 transparent PNG
    pixel = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    return Response(content=pixel, media_type="image/png", headers={"Cache-Control": "no-store, no-cache"})


# ============================================================================
# CRM Email — AI Assistant
# ============================================================================

class AIComposeRequest(BaseModel):
    context: Optional[str] = None
    tone: Optional[str] = "professional"  # professional, friendly, formal, casual
    recipient_name: Optional[str] = None
    topic: Optional[str] = None


class AISummarizeRequest(BaseModel):
    thread_id: str


class AISentimentRequest(BaseModel):
    thread_id: str


async def _check_ai_rate_limit(profile_id: str):
    """Check if user is within daily AI usage limit (50/day)."""
    row = execute_single(
        "SELECT COUNT(*) as cnt FROM crm_ai_usage WHERE profile_id = :pid AND used_at >= NOW() - INTERVAL '24 hours'",
        {"pid": profile_id},
    )
    if row and row["cnt"] >= 50:
        raise HTTPException(429, "Daily AI usage limit reached (50 per day)")


async def _record_ai_usage(profile_id: str, feature: str):
    execute_insert(
        "INSERT INTO crm_ai_usage (profile_id, feature) VALUES (:pid, :feature) RETURNING id",
        {"pid": profile_id, "feature": feature},
    )


@router.post("/email/ai/compose")
async def ai_compose_email(
    data: AIComposeRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Generate an email draft using AI."""
    import anthropic
    from app.core.config import settings

    await _check_ai_rate_limit(profile["id"])

    prompt = f"""Write a professional email{f' to {data.recipient_name}' if data.recipient_name else ''}.
Tone: {data.tone}
{f'Topic: {data.topic}' if data.topic else ''}
{f'Context: {data.context}' if data.context else ''}

Return ONLY the email body in HTML format (no subject, no salutation prefix if not appropriate).
Keep it concise (2-4 paragraphs max). Use <p> tags for paragraphs."""

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    await _record_ai_usage(profile["id"], "compose")

    body_html = response.content[0].text if response.content else ""
    return {"body_html": body_html}


@router.post("/email/ai/summarize")
async def ai_summarize_thread(
    data: AISummarizeRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Summarize a thread's conversation using AI."""
    import anthropic
    from app.core.config import settings

    await _check_ai_rate_limit(profile["id"])

    messages = execute_query(
        "SELECT direction, from_address, body_text, created_at FROM crm_email_messages WHERE thread_id = :tid ORDER BY created_at ASC",
        {"tid": data.thread_id},
    )
    if not messages:
        raise HTTPException(404, "No messages in thread")

    conversation = "\n\n".join([
        f"[{m['direction'].upper()} from {m['from_address']} at {m['created_at']}]\n{m['body_text'] or '(no text)'}"
        for m in messages
    ])

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=512,
        messages=[{"role": "user", "content": f"Summarize this email thread in 2-3 bullet points:\n\n{conversation}"}],
    )

    await _record_ai_usage(profile["id"], "summarize")

    summary = response.content[0].text if response.content else ""
    return {"summary": summary}


@router.post("/email/ai/sentiment")
async def ai_analyze_sentiment(
    data: AISentimentRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Analyze sentiment of inbound messages in a thread."""
    import anthropic
    from app.core.config import settings

    await _check_ai_rate_limit(profile["id"])

    messages = execute_query(
        "SELECT body_text FROM crm_email_messages WHERE thread_id = :tid AND direction = 'inbound' ORDER BY created_at DESC LIMIT 5",
        {"tid": data.thread_id},
    )
    if not messages:
        return {"sentiment": "neutral", "confidence": 0}

    text = "\n\n".join([m["body_text"] or "" for m in messages])

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=100,
        messages=[{"role": "user", "content": f'Analyze the sentiment of these inbound emails. Reply with ONLY a JSON object: {{"sentiment": "positive"|"neutral"|"negative", "confidence": 0.0-1.0}}\n\n{text}'}],
    )

    await _record_ai_usage(profile["id"], "sentiment")

    import json as json_mod
    try:
        result = json_mod.loads(response.content[0].text)
    except Exception:
        result = {"sentiment": "neutral", "confidence": 0.5}

    return result


# ============================================================================
# CRM Email — Sequences (Rep endpoints)
# ============================================================================

@router.get("/email/sequences")
async def list_active_sequences(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List active sequences available for reps to enroll contacts."""
    rows = execute_query(
        """
        SELECT s.*, p.full_name as created_by_name,
               (SELECT COUNT(*) FROM crm_email_sequence_steps st WHERE st.sequence_id = s.id) as step_count,
               (SELECT COUNT(*) FROM crm_email_sequence_enrollments e WHERE e.sequence_id = s.id AND e.status = 'active') as active_enrollments
        FROM crm_email_sequences s
        JOIN profiles p ON p.id = s.created_by
        WHERE s.is_active = true
        ORDER BY s.name ASC
        """,
        {},
    )
    return {"sequences": rows}


class EnrollRequest(BaseModel):
    contact_id: str


@router.post("/email/sequences/{sequence_id}/enroll")
async def enroll_contact_in_sequence(
    sequence_id: str,
    data: EnrollRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Enroll a contact in a sequence."""
    # Check DNC
    contact = execute_single(
        "SELECT id, do_not_email, email FROM crm_contacts WHERE id = :cid",
        {"cid": data.contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")
    if contact.get("do_not_email"):
        raise HTTPException(400, "Contact is flagged as Do Not Email")

    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(400, "No email account configured")

    # Get first step delay
    first_step = execute_single(
        "SELECT delay_days FROM crm_email_sequence_steps WHERE sequence_id = :sid AND step_number = 1",
        {"sid": sequence_id},
    )
    if not first_step:
        raise HTTPException(400, "Sequence has no steps")

    from datetime import timedelta
    next_send = datetime.utcnow() + timedelta(days=first_step["delay_days"])

    result = execute_single(
        """
        INSERT INTO crm_email_sequence_enrollments
            (sequence_id, contact_id, account_id, current_step, status, next_send_at, enrolled_by)
        VALUES (:sid, :cid, :aid, 1, 'active', :next_send, :enrolled_by)
        ON CONFLICT (sequence_id, contact_id) DO NOTHING
        RETURNING *
        """,
        {"sid": sequence_id, "cid": data.contact_id, "aid": account["id"],
         "next_send": next_send, "enrolled_by": profile["id"]},
    )
    if not result:
        raise HTTPException(409, "Contact is already enrolled in this sequence")

    # Create activity for sequence enrollment
    from app.api.crm_email_helpers import create_email_activity
    seq = execute_single("SELECT name FROM crm_email_sequences WHERE id = :sid", {"sid": sequence_id})
    seq_name = seq["name"] if seq else "Unknown Sequence"
    create_email_activity(
        contact_id=data.contact_id,
        rep_id=profile["id"],
        activity_type="sequence_enrolled",
        subject=f"Enrolled in: {seq_name}",
        description=f"Contact enrolled in email sequence '{seq_name}'",
    )

    return result


@router.post("/email/sequences/{sequence_id}/unenroll")
async def unenroll_contact_from_sequence(
    sequence_id: str,
    data: EnrollRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Unenroll a contact from a sequence."""
    result = execute_single(
        """
        UPDATE crm_email_sequence_enrollments
        SET status = 'unsubscribed', completed_at = NOW()
        WHERE sequence_id = :sid AND contact_id = :cid AND status = 'active'
        RETURNING *
        """,
        {"sid": sequence_id, "cid": data.contact_id},
    )
    if not result:
        raise HTTPException(404, "Active enrollment not found")

    # Create activity for sequence unenrollment
    from app.api.crm_email_helpers import create_email_activity
    seq = execute_single("SELECT name FROM crm_email_sequences WHERE id = :sid", {"sid": sequence_id})
    seq_name = seq["name"] if seq else "Unknown Sequence"
    create_email_activity(
        contact_id=data.contact_id,
        rep_id=profile["id"],
        activity_type="sequence_unenrolled",
        subject=f"Unenrolled from: {seq_name}",
        description=f"Contact unenrolled from email sequence '{seq_name}'",
    )

    return result


@router.get("/email/contacts/{contact_id}/sequences")
async def get_contact_sequences(
    contact_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get all sequence enrollments for a contact."""
    rows = execute_query(
        """
        SELECT e.*, s.name as sequence_name, s.description as sequence_description,
               p.full_name as enrolled_by_name
        FROM crm_email_sequence_enrollments e
        JOIN crm_email_sequences s ON s.id = e.sequence_id
        JOIN profiles p ON p.id = e.enrolled_by
        WHERE e.contact_id = :cid
        ORDER BY e.enrolled_at DESC
        """,
        {"cid": contact_id},
    )
    return {"enrollments": rows}


# ============================================================================
# CRM Email — Notification Settings
# ============================================================================

@router.get("/email/account/notifications")
async def get_email_notification_settings(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get notification settings for current user's email account."""
    row = execute_single(
        """
        SELECT id, email_address, notification_email, notification_mode,
               notification_digest_interval, last_digest_sent_at
        FROM crm_email_accounts
        WHERE profile_id = :pid AND is_active = true
        LIMIT 1
        """,
        {"pid": profile["id"]},
    )
    if not row:
        return {"settings": None}
    return {"settings": row}


@router.put("/email/account/notifications")
async def update_email_notification_settings(
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """
    Update notification settings for the current user's email account.
    """
    account_id = payload.get("account_id")
    notification_email = payload.get("notification_email", "").strip()
    notification_mode = payload.get("notification_mode", "off")
    digest_interval = payload.get("notification_digest_interval", "hourly")

    if notification_mode not in ("off", "instant", "digest"):
        raise HTTPException(status_code=400, detail="Invalid notification_mode")
    if digest_interval not in ("hourly", "daily"):
        raise HTTPException(status_code=400, detail="Invalid digest interval")

    # Verify the account belongs to the current user
    account = execute_single(
        "SELECT id, email_address FROM crm_email_accounts WHERE id = :aid AND profile_id = :pid AND is_active = true",
        {"aid": account_id, "pid": profile["id"]},
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Prevent loops: notification email must NOT be a CRM work email
    if notification_email and notification_mode != "off":
        existing = execute_single(
            "SELECT id FROM crm_email_accounts WHERE LOWER(email_address) = LOWER(:email) AND is_active = true",
            {"email": notification_email},
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Notification email cannot be a CRM work email (would cause loops)"
            )

    execute_update(
        """
        UPDATE crm_email_accounts
        SET notification_email = :email,
            notification_mode = :mode,
            notification_digest_interval = :interval
        WHERE id = :aid
        """,
        {
            "email": notification_email or None,
            "mode": notification_mode,
            "interval": digest_interval,
            "aid": account_id,
        },
    )

    # Send confirmation email to personal address when notifications are enabled
    if notification_mode != "off" and notification_email:
        try:
            import resend as resend_sdk
            import logging
            from app.core.config import settings
            from app.services.email_templates import build_notification_confirmation_email

            crm_url = f"{settings.FRONTEND_URL}/crm/email"
            html = build_notification_confirmation_email(
                account_email=account["email_address"],
                notification_email=notification_email,
                mode=notification_mode,
                crm_url=crm_url,
            )
            resend_sdk.api_key = settings.RESEND_API_KEY
            resend_sdk.Emails.send({
                "from": "Second Watch Network <notifications@theswn.com>",
                "to": [notification_email],
                "subject": "CRM Email Notifications Enabled",
                "html": html,
            })
            logging.getLogger(__name__).info(f"Sent notification confirmation to {notification_email} for account {account['email_address']}")
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to send notification confirmation email: {e}")

    return {"status": "updated"}


# ============================================================================
# CRM Email — Avatar Upload
# ============================================================================

@router.post("/email/account/avatar/upload")
async def upload_email_avatar(
    file: UploadFile = File(...),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Upload an avatar for the CRM email account."""
    import io
    import uuid
    from app.core.storage import storage_client

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Find user's email account
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true LIMIT 1",
        {"pid": profile["id"]},
    )
    if not account:
        raise HTTPException(status_code=404, detail="No active email account found")

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    unique_filename = f"avatars/email/{account['id']}/{uuid.uuid4()}.{ext}"

    file_content = await file.read()
    file_obj = io.BytesIO(file_content)

    storage_client.from_("avatars").upload(
        unique_filename,
        file_obj,
        {"content_type": file.content_type},
    )

    # Store the S3 key (not full URL) so we can generate fresh signed URLs
    execute_update(
        "UPDATE crm_email_accounts SET avatar_url = :url WHERE id = :aid",
        {"url": unique_filename, "aid": account["id"]},
    )

    # Return a signed URL for immediate preview
    signed = storage_client.from_("avatars").create_signed_url(unique_filename, 3600)
    avatar_url = signed.get("signedUrl", "")

    return {"success": True, "avatar_url": avatar_url}


# ============================================================================
# CRM — Business Cards
# ============================================================================

@router.get("/business-card")
async def get_my_business_card(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get the current user's business card."""
    from app.core.storage import storage_client

    row = execute_single(
        "SELECT * FROM crm_business_cards WHERE profile_id = :pid ORDER BY created_at DESC LIMIT 1",
        {"pid": profile["id"]},
    )
    if row and row.get("personal_logo_url"):
        logo_val = row["personal_logo_url"]
        row = dict(row)
        # Resolve to presigned URL — handle both S3 keys and old full URLs
        if logo_val.startswith("http"):
            # Old format: extract S3 key from full URL
            # e.g. https://bucket.s3.region.amazonaws.com/business-cards/logos/...
            parts = logo_val.split(".amazonaws.com/", 1)
            logo_key = parts[1] if len(parts) > 1 else logo_val
        else:
            logo_key = logo_val
        signed = storage_client.from_("avatars").create_signed_url(logo_key, 3600)
        row["personal_logo_url"] = signed.get("signedUrl", "")
    return {"card": row}


@router.post("/business-card")
async def create_or_update_business_card(
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Create or update the current user's business card."""
    existing = execute_single(
        "SELECT id, status FROM crm_business_cards WHERE profile_id = :pid ORDER BY created_at DESC LIMIT 1",
        {"pid": profile["id"]},
    )

    fields = {
        "swn_name": payload.get("swn_name", profile.get("full_name", "")),
        "swn_title": payload.get("swn_title"),
        "swn_email": payload.get("swn_email"),
        "swn_phone": payload.get("swn_phone"),
        "personal_name": payload.get("personal_name"),
        "personal_title": payload.get("personal_title"),
        "personal_email": payload.get("personal_email"),
        "personal_phone": payload.get("personal_phone"),
        "personal_website": payload.get("personal_website"),
        "personal_social_links": json.dumps({
            "instagram": payload.get("instagram", ""),
            "linkedin": payload.get("linkedin", ""),
            "twitter": payload.get("twitter", ""),
        }),
    }

    if existing:
        # Can only edit in draft or rejected status
        if existing["status"] not in ("draft", "rejected"):
            raise HTTPException(status_code=400, detail="Card can only be edited in draft or rejected status")
        set_clauses = ", ".join(
            f"{k} = CAST(:{k} AS jsonb)" if k == "personal_social_links" else f"{k} = :{k}"
            for k in fields
        )
        execute_update(
            f"UPDATE crm_business_cards SET {set_clauses}, status = 'draft', updated_at = NOW() WHERE id = :card_id",
            {**fields, "card_id": existing["id"]},
        )
        card_id = existing["id"]
    else:
        result = execute_insert(
            """
            INSERT INTO crm_business_cards (profile_id, swn_name, swn_title, swn_email, swn_phone,
                personal_name, personal_title, personal_email, personal_phone, personal_website,
                personal_social_links)
            VALUES (:pid, :swn_name, :swn_title, :swn_email, :swn_phone,
                :personal_name, :personal_title, :personal_email, :personal_phone, :personal_website,
                CAST(:personal_social_links AS jsonb))
            RETURNING id
            """,
            {**fields, "pid": profile["id"]},
        )
        card_id = result["id"]

    card = execute_single("SELECT * FROM crm_business_cards WHERE id = :cid", {"cid": card_id})
    return {"card": card}


@router.post("/business-card/logo")
async def upload_business_card_logo(
    file: UploadFile = File(...),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Upload a personal logo for the business card."""
    import io
    import uuid
    from app.core.storage import storage_client

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "png"
    unique_filename = f"business-cards/logos/{profile['id']}/{uuid.uuid4()}.{ext}"

    file_content = await file.read()
    file_obj = io.BytesIO(file_content)

    storage_client.from_("avatars").upload(
        unique_filename,
        file_obj,
        {"content_type": file.content_type},
    )

    # Store the S3 key (not a public URL — bucket is private)
    execute_update(
        """
        UPDATE crm_business_cards SET personal_logo_url = :key, updated_at = NOW()
        WHERE profile_id = :pid AND status IN ('draft', 'rejected')
        """,
        {"key": unique_filename, "pid": profile["id"]},
    )

    # Return a presigned URL for immediate display
    signed = storage_client.from_("avatars").create_signed_url(unique_filename, 3600)
    return {"success": True, "logo_url": signed.get("signedUrl", "")}


@router.put("/business-card/submit")
async def submit_business_card(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Submit business card for approval."""
    card = execute_single(
        "SELECT id, status FROM crm_business_cards WHERE profile_id = :pid ORDER BY created_at DESC LIMIT 1",
        {"pid": profile["id"]},
    )
    if not card:
        raise HTTPException(status_code=404, detail="No business card found")
    if card["status"] not in ("draft", "rejected"):
        raise HTTPException(status_code=400, detail="Card can only be submitted from draft or rejected status")

    execute_update(
        "UPDATE crm_business_cards SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = :cid",
        {"cid": card["id"]},
    )
    return {"status": "submitted"}


# Business Card Admin Endpoints

@router.get("/business-cards")
async def list_business_cards(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """List all business cards (admin)."""
    conditions = []
    params: Dict[str, Any] = {}

    if status_filter:
        conditions.append("bc.status = :status")
        params["status"] = status_filter
    if search:
        conditions.append("(bc.swn_name ILIKE :search OR bc.personal_name ILIKE :search)")
        params["search"] = f"%{search}%"

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = execute_query(
        f"""
        SELECT bc.*, p.full_name as profile_name, p.avatar_url as profile_avatar
        FROM crm_business_cards bc
        JOIN profiles p ON p.id = bc.profile_id
        {where}
        ORDER BY bc.submitted_at DESC NULLS LAST, bc.created_at DESC
        """,
        params,
    )
    return {"cards": rows}


@router.get("/business-cards/{card_id}")
async def get_business_card(
    card_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Get a specific business card (admin)."""
    from app.core.storage import storage_client

    row = execute_single(
        """
        SELECT bc.*, p.full_name as profile_name, p.avatar_url as profile_avatar
        FROM crm_business_cards bc
        JOIN profiles p ON p.id = bc.profile_id
        WHERE bc.id = :cid
        """,
        {"cid": card_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Card not found")
    # Resolve logo to presigned URL
    if row.get("personal_logo_url"):
        row = dict(row)
        logo_val = row["personal_logo_url"]
        if logo_val.startswith("http"):
            parts = logo_val.split(".amazonaws.com/", 1)
            logo_key = parts[1] if len(parts) > 1 else logo_val
        else:
            logo_key = logo_val
        signed = storage_client.from_("avatars").create_signed_url(logo_key, 3600)
        row["personal_logo_url"] = signed.get("signedUrl", "")
    return {"card": row}


@router.put("/business-cards/{card_id}/status")
async def update_business_card_status(
    card_id: str,
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Approve or reject a business card (admin)."""
    new_status = payload.get("status")
    admin_notes = payload.get("admin_notes", "")

    if new_status not in ("approved", "rejected", "printed"):
        raise HTTPException(status_code=400, detail="Invalid status")

    card = execute_single(
        "SELECT id, status FROM crm_business_cards WHERE id = :cid",
        {"cid": card_id},
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    update_fields = "status = :status, admin_notes = :notes, updated_at = NOW()"
    if new_status == "approved":
        update_fields += ", approved_at = NOW()"

    execute_query(
        f"UPDATE crm_business_cards SET {update_fields} WHERE id = :cid",
        {"status": new_status, "notes": admin_notes, "cid": card_id},
    )
    return {"status": new_status}


@router.get("/business-cards/export")
async def export_business_cards(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Export approved business cards data for printing."""
    rows = execute_query(
        """
        SELECT bc.*, p.full_name as profile_name, p.avatar_url as profile_avatar
        FROM crm_business_cards bc
        JOIN profiles p ON p.id = bc.profile_id
        WHERE bc.status = 'approved'
        ORDER BY bc.approved_at DESC
        """,
        {},
    )
    return {"cards": rows}


# ============================================================================
# CRM — Training Resources
# ============================================================================

@router.get("/training/resources")
async def list_training_resources(
    resource_type: Optional[str] = Query(None, alias="type"),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List training resources with optional filters."""
    conditions = []
    params: Dict[str, Any] = {}

    if resource_type:
        conditions.append("resource_type = :rtype")
        params["rtype"] = resource_type
    if category:
        conditions.append("category = :cat")
        params["cat"] = category
    if search:
        conditions.append("(title ILIKE :search OR description ILIKE :search)")
        params["search"] = f"%{search}%"

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = execute_query(
        f"""
        SELECT tr.*, p.full_name as author_name, p.avatar_url as author_avatar
        FROM crm_training_resources tr
        JOIN profiles p ON p.id = tr.author_id
        {where}
        ORDER BY tr.is_pinned DESC, tr.created_at DESC
        """,
        params,
    )
    return {"resources": rows}


@router.get("/training/resources/{resource_id}")
async def get_training_resource(
    resource_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get a single training resource and increment view count."""
    row = execute_single(
        """
        SELECT tr.*, p.full_name as author_name, p.avatar_url as author_avatar
        FROM crm_training_resources tr
        JOIN profiles p ON p.id = tr.author_id
        WHERE tr.id = :rid
        """,
        {"rid": resource_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Resource not found")

    execute_update(
        "UPDATE crm_training_resources SET view_count = view_count + 1 WHERE id = :rid",
        {"rid": resource_id},
    )
    return {"resource": row}


@router.post("/training/resources")
async def create_training_resource(
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Create a new training resource (admin/sales_admin only)."""
    resource_type = payload.get("resource_type")
    if resource_type not in ("video", "presentation"):
        raise HTTPException(status_code=400, detail="resource_type must be 'video' or 'presentation'")

    result = execute_insert(
        """
        INSERT INTO crm_training_resources
        (author_id, title, description, resource_type, url, thumbnail_url,
         file_size_bytes, duration_seconds, category, is_pinned)
        VALUES (:author_id, :title, :description, :rtype, :url, :thumbnail,
                :file_size, :duration, :category, :pinned)
        RETURNING *
        """,
        {
            "author_id": profile["id"],
            "title": payload.get("title", ""),
            "description": payload.get("description"),
            "rtype": resource_type,
            "url": payload.get("url", ""),
            "thumbnail": payload.get("thumbnail_url"),
            "file_size": payload.get("file_size_bytes"),
            "duration": payload.get("duration_seconds"),
            "category": payload.get("category", "general"),
            "pinned": payload.get("is_pinned", False),
        },
    )

    try:
        from app.services.crm_notifications import notify_crm_users
        res_title = payload.get("title", "Untitled")
        await notify_crm_users(
            event_type="crm_training",
            title=f"New training: {res_title}",
            body=payload.get("description", "")[:200] if payload.get("description") else None,
            related_id=result.get("id") if result else None,
            exclude_profile_id=profile["id"],
        )
    except Exception:
        pass

    return {"resource": result}


@router.put("/training/resources/{resource_id}")
async def update_training_resource(
    resource_id: str,
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Update a training resource."""
    fields = {}
    for key in ["title", "description", "url", "thumbnail_url", "file_size_bytes",
                 "duration_seconds", "category", "is_pinned"]:
        if key in payload:
            fields[key] = payload[key]

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = ", ".join(f"{k} = :{k}" for k in fields)
    execute_query(
        f"UPDATE crm_training_resources SET {set_clauses}, updated_at = NOW() WHERE id = :rid",
        {**fields, "rid": resource_id},
    )
    return {"status": "updated"}


@router.delete("/training/resources/{resource_id}")
async def delete_training_resource(
    resource_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Delete a training resource."""
    execute_delete("DELETE FROM crm_training_resources WHERE id = :rid", {"rid": resource_id})
    return {"status": "deleted"}


@router.post("/training/resources/upload")
async def upload_training_file(
    file: UploadFile = File(...),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Upload a training video or presentation file to S3."""
    import io
    import uuid
    from app.core.storage import storage_client

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "bin"
    unique_filename = f"training/{profile['id']}/{uuid.uuid4()}.{ext}"

    file_content = await file.read()
    file_obj = io.BytesIO(file_content)

    storage_client.from_("avatars").upload(
        unique_filename,
        file_obj,
        {"content_type": file.content_type or "application/octet-stream"},
    )
    file_url = storage_client.from_("avatars").get_public_url(unique_filename)

    return {"success": True, "url": file_url, "file_size_bytes": len(file_content), "filename": file.filename}


# ============================================================================
# CRM — Discussion Board
# ============================================================================

@router.get("/discussions/categories")
async def list_discussion_categories(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List all discussion categories."""
    rows = execute_query(
        """
        SELECT dc.*, p.full_name as created_by_name,
               (SELECT COUNT(*) FROM crm_discussion_threads WHERE category_id = dc.id) as thread_count
        FROM crm_discussion_categories dc
        LEFT JOIN profiles p ON p.id = dc.created_by
        ORDER BY dc.sort_order, dc.created_at
        """,
        {},
    )
    return {"categories": rows}


@router.post("/discussions/categories")
async def create_discussion_category(
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Create a new discussion category (any CRM user can create)."""
    import re
    name = payload.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

    result = execute_insert(
        """
        INSERT INTO crm_discussion_categories (name, description, slug, created_by, sort_order)
        VALUES (:name, :description, :slug, :created_by,
                COALESCE((SELECT MAX(sort_order) + 1 FROM crm_discussion_categories), 1))
        RETURNING *
        """,
        {
            "name": name,
            "description": payload.get("description"),
            "slug": slug,
            "created_by": profile["id"],
        },
    )
    return {"category": result}


@router.put("/discussions/categories/{category_id}")
async def update_discussion_category(
    category_id: str,
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Edit a discussion category (author or admin)."""
    cat = execute_single(
        "SELECT id, created_by FROM crm_discussion_categories WHERE id = :cid",
        {"cid": category_id},
    )
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat["created_by"] != profile["id"] and not has_permission(profile, Permission.CRM_ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized")

    fields = {}
    for key in ["name", "description"]:
        if key in payload:
            fields[key] = payload[key]
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = ", ".join(f"{k} = :{k}" for k in fields)
    execute_single(
        f"UPDATE crm_discussion_categories SET {set_clauses} WHERE id = :cid RETURNING id",
        {**fields, "cid": category_id},
    )
    return {"status": "updated"}


@router.delete("/discussions/categories/{category_id}")
async def delete_discussion_category(
    category_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Delete a discussion category (admin only, must be empty)."""
    count = execute_single(
        "SELECT COUNT(*) as cnt FROM crm_discussion_threads WHERE category_id = :cid",
        {"cid": category_id},
    )
    if count and count["cnt"] > 0:
        raise HTTPException(status_code=400, detail="Category must be empty before deletion")

    execute_delete("DELETE FROM crm_discussion_categories WHERE id = :cid", {"cid": category_id})
    return {"status": "deleted"}


@router.get("/discussions/threads")
async def list_discussion_threads(
    category_slug: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort: Optional[str] = Query("recent"),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List discussion threads with filters."""
    conditions = []
    params: Dict[str, Any] = {}

    if category_slug:
        conditions.append("dc.slug = :slug")
        params["slug"] = category_slug
    if search:
        conditions.append("(dt.title ILIKE :search OR dt.content ILIKE :search)")
        params["search"] = f"%{search}%"

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    order = "dt.is_pinned DESC, dt.last_reply_at DESC NULLS LAST, dt.created_at DESC"
    if sort == "popular":
        order = "dt.is_pinned DESC, dt.reply_count DESC, dt.created_at DESC"

    rows = execute_query(
        f"""
        SELECT dt.*, dc.name as category_name, dc.slug as category_slug,
               p.full_name as author_name, p.avatar_url as author_avatar
        FROM crm_discussion_threads dt
        JOIN crm_discussion_categories dc ON dc.id = dt.category_id
        JOIN profiles p ON p.id = dt.author_id
        {where}
        ORDER BY {order}
        """,
        params,
    )
    return {"threads": rows}


@router.get("/discussions/threads/{thread_id}")
async def get_discussion_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get a single discussion thread with author details."""
    row = execute_single(
        """
        SELECT dt.*, dc.name as category_name, dc.slug as category_slug,
               p.full_name as author_name, p.avatar_url as author_avatar
        FROM crm_discussion_threads dt
        JOIN crm_discussion_categories dc ON dc.id = dt.category_id
        JOIN profiles p ON p.id = dt.author_id
        WHERE dt.id = :tid
        """,
        {"tid": thread_id},
    )
    if not row:
        raise HTTPException(status_code=404, detail="Thread not found")
    return {"thread": row}


@router.post("/discussions/threads")
async def create_discussion_thread(
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Create a new discussion thread."""
    category_id = payload.get("category_id")
    title = payload.get("title", "").strip()
    content = payload.get("content", "").strip()

    if not title or not content:
        raise HTTPException(status_code=400, detail="Title and content are required")
    if not category_id:
        raise HTTPException(status_code=400, detail="category_id is required")

    result = execute_insert(
        """
        INSERT INTO crm_discussion_threads (category_id, author_id, title, content, resource_id)
        VALUES (:cat_id, :author_id, :title, :content, :resource_id)
        RETURNING *
        """,
        {
            "cat_id": category_id,
            "author_id": profile["id"],
            "title": title,
            "content": content,
            "resource_id": payload.get("resource_id"),
        },
    )

    try:
        from app.services.crm_notifications import notify_crm_users
        await notify_crm_users(
            event_type="crm_discussion",
            title=f"New thread: {title}",
            body=content[:200] if content else None,
            related_id=result.get("id") if result else None,
            exclude_profile_id=profile["id"],
        )
    except Exception:
        pass

    return {"thread": result}


@router.put("/discussions/threads/{thread_id}")
async def update_discussion_thread(
    thread_id: str,
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Edit a discussion thread (author or admin)."""
    thread = execute_single(
        "SELECT id, author_id FROM crm_discussion_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread["author_id"] != profile["id"] and not has_permission(profile, Permission.CRM_ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized")

    fields = {}
    for key in ["title", "content"]:
        if key in payload:
            fields[key] = payload[key]
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = ", ".join(f"{k} = :{k}" for k in fields)
    execute_single(
        f"UPDATE crm_discussion_threads SET {set_clauses}, updated_at = NOW() WHERE id = :tid RETURNING id",
        {**fields, "tid": thread_id},
    )
    return {"status": "updated"}


@router.delete("/discussions/threads/{thread_id}")
async def delete_discussion_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Delete a discussion thread (author or admin)."""
    thread = execute_single(
        "SELECT id, author_id FROM crm_discussion_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread["author_id"] != profile["id"] and not has_permission(profile, Permission.CRM_ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized")

    execute_delete("DELETE FROM crm_discussion_threads WHERE id = :tid", {"tid": thread_id})
    return {"status": "deleted"}


@router.post("/discussions/threads/{thread_id}/pin")
async def pin_discussion_thread(
    thread_id: str,
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_ADMIN)),
):
    """Pin or unpin a discussion thread (admin only)."""
    pinned = payload.get("is_pinned", True)
    execute_update(
        "UPDATE crm_discussion_threads SET is_pinned = :pinned WHERE id = :tid",
        {"pinned": pinned, "tid": thread_id},
    )
    return {"status": "pinned" if pinned else "unpinned"}


@router.get("/discussions/threads/{thread_id}/replies")
async def list_discussion_replies(
    thread_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """List replies for a discussion thread."""
    rows = execute_query(
        """
        SELECT dr.*, p.full_name as author_name, p.avatar_url as author_avatar
        FROM crm_discussion_replies dr
        JOIN profiles p ON p.id = dr.author_id
        WHERE dr.thread_id = :tid
        ORDER BY dr.created_at
        """,
        {"tid": thread_id},
    )
    return {"replies": rows}


@router.post("/discussions/replies")
async def create_discussion_reply(
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Create a reply to a discussion thread."""
    thread_id = payload.get("thread_id")
    content = payload.get("content", "").strip()

    if not thread_id or not content:
        raise HTTPException(status_code=400, detail="thread_id and content are required")

    # Check thread exists and isn't locked
    thread = execute_single(
        "SELECT id, is_locked FROM crm_discussion_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    if thread.get("is_locked"):
        raise HTTPException(status_code=400, detail="Thread is locked")

    result = execute_insert(
        """
        INSERT INTO crm_discussion_replies (thread_id, author_id, content)
        VALUES (:tid, :author_id, :content)
        RETURNING *
        """,
        {
            "tid": thread_id,
            "author_id": profile["id"],
            "content": content,
        },
    )

    try:
        from app.services.crm_notifications import notify_crm_users
        thread_detail = execute_single(
            "SELECT title FROM crm_discussion_threads WHERE id = :tid",
            {"tid": thread_id},
        )
        thread_title = thread_detail["title"] if thread_detail else "a thread"
        author_name = profile.get("full_name", "Someone")
        await notify_crm_users(
            event_type="crm_discussion",
            title=f"{author_name} replied to: {thread_title}",
            body=content[:200] if content else None,
            related_id=thread_id,
            exclude_profile_id=profile["id"],
        )
    except Exception:
        pass

    return {"reply": result}


@router.put("/discussions/replies/{reply_id}")
async def update_discussion_reply(
    reply_id: str,
    payload: dict,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Edit a discussion reply (author or admin)."""
    reply = execute_single(
        "SELECT id, author_id FROM crm_discussion_replies WHERE id = :rid",
        {"rid": reply_id},
    )
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply["author_id"] != profile["id"] and not has_permission(profile, Permission.CRM_ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized")

    content = payload.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")

    execute_update(
        "UPDATE crm_discussion_replies SET content = :content, updated_at = NOW() WHERE id = :rid",
        {"content": content, "rid": reply_id},
    )
    return {"status": "updated"}


@router.delete("/discussions/replies/{reply_id}")
async def delete_discussion_reply(
    reply_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Delete a discussion reply (author or admin)."""
    reply = execute_single(
        "SELECT id, author_id FROM crm_discussion_replies WHERE id = :rid",
        {"rid": reply_id},
    )
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply["author_id"] != profile["id"] and not has_permission(profile, Permission.CRM_ADMIN):
        raise HTTPException(status_code=403, detail="Not authorized")

    execute_delete("DELETE FROM crm_discussion_replies WHERE id = :rid", {"rid": reply_id})
    return {"status": "deleted"}


# ── Team Directory ──────────────────────────────────────────────────────

@router.get("/team-directory")
async def get_team_directory(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Return all staff/sales team members with their @theswn.com email accounts."""
    rows = execute_query(
        """
        SELECT
            p.id, p.full_name, p.avatar_url, p.email,
            p.phone, p.department, p.job_title,
            p.is_admin, p.is_superadmin, p.is_moderator,
            p.is_sales_admin, p.is_sales_agent, p.is_sales_rep,
            ea.email_address AS theswn_email
        FROM profiles p
        LEFT JOIN crm_email_accounts ea
            ON ea.profile_id = p.id AND ea.is_active = true
        WHERE p.is_admin = true
           OR p.is_superadmin = true
           OR p.is_moderator = true
           OR p.is_sales_admin = true
           OR p.is_sales_agent = true
           OR p.is_sales_rep = true
        ORDER BY p.full_name
        """,
        {},
    )
    return rows


# ============================================================================
# ICS Calendar Invite Parsing
# ============================================================================

def _parse_and_store_calendar_event(att: dict, message: dict, account: dict, _log):
    """Parse an ICS attachment and store as a calendar event."""
    import httpx as _httpx
    import re

    # Download the ICS content
    ics_bytes = None
    download_url = att.get("download_url")
    if download_url:
        resp = _httpx.get(download_url, timeout=30)
        if resp.status_code == 200:
            ics_bytes = resp.content
    if not ics_bytes:
        return

    ics_text = ics_bytes.decode("utf-8", errors="replace")

    # Parse with icalendar
    try:
        from icalendar import Calendar
    except ImportError:
        _log.warning("icalendar package not installed, skipping ICS parse")
        return

    cal = Calendar.from_ical(ics_text)
    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        title = str(component.get("SUMMARY", "")) or "Untitled Event"
        description = str(component.get("DESCRIPTION", "")) or None
        location = str(component.get("LOCATION", "")) or None
        organizer = component.get("ORGANIZER")
        organizer_email = None
        organizer_name = None
        if organizer:
            org_str = str(organizer)
            if org_str.lower().startswith("mailto:"):
                organizer_email = org_str[7:]
            org_params = getattr(organizer, "params", {})
            organizer_name = str(org_params.get("CN", "")) or None

        uid = str(component.get("UID", "")) or None

        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")

        starts_at = dtstart.dt if dtstart else None
        ends_at = dtend.dt if dtend else None
        if not starts_at:
            continue

        # Detect all-day events (date vs datetime)
        all_day = not hasattr(starts_at, "hour")
        if all_day:
            from datetime import datetime as _dt, timezone as _tz
            starts_at = _dt.combine(starts_at, _dt.min.time(), tzinfo=_tz.utc)
            if ends_at:
                ends_at = _dt.combine(ends_at, _dt.min.time(), tzinfo=_tz.utc)

        # Make timezone-aware if naive
        if hasattr(starts_at, "tzinfo") and starts_at.tzinfo is None:
            from datetime import timezone as _tz
            starts_at = starts_at.replace(tzinfo=_tz.utc)
        if ends_at and hasattr(ends_at, "tzinfo") and ends_at.tzinfo is None:
            from datetime import timezone as _tz
            ends_at = ends_at.replace(tzinfo=_tz.utc)

        # Detect Google Meet link
        meet_link = None
        x_conf = component.get("X-GOOGLE-CONFERENCE")
        if x_conf:
            meet_link = str(x_conf)
        if not meet_link and description:
            meet_match = re.search(r'https://meet\.google\.com/[a-z\-]+', description)
            if meet_match:
                meet_link = meet_match.group(0)
        if not meet_link and location:
            meet_match = re.search(r'https://meet\.google\.com/[a-z\-]+', location)
            if meet_match:
                meet_link = meet_match.group(0)

        # Upsert: use uid + account_id for dedup
        execute_insert(
            """
            INSERT INTO crm_calendar_events
                (message_id, account_id, rep_id, title, description, location, meet_link,
                 starts_at, ends_at, all_day, organizer_email, organizer_name, uid, status, raw_ics)
            VALUES (:mid, :aid, :rid, :title, :desc, :loc, :meet,
                    :starts, :ends, :all_day, :org_email, :org_name, :uid, 'pending', :raw)
            ON CONFLICT (uid, account_id) WHERE uid IS NOT NULL
            DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
                          location = EXCLUDED.location, meet_link = EXCLUDED.meet_link,
                          starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
                          organizer_email = EXCLUDED.organizer_email, organizer_name = EXCLUDED.organizer_name,
                          raw_ics = EXCLUDED.raw_ics
            RETURNING id
            """,
            {
                "mid": message["id"],
                "aid": account["id"],
                "rid": account["profile_id"],
                "title": title,
                "desc": description,
                "loc": location,
                "meet": meet_link,
                "starts": starts_at.isoformat(),
                "ends": ends_at.isoformat() if ends_at else None,
                "all_day": all_day,
                "org_email": organizer_email,
                "org_name": organizer_name,
                "uid": uid,
                "raw": ics_text,
            },
        )
        _log.info(f"Stored calendar event '{title}' from ICS (uid={uid})")
        break  # Only handle the first VEVENT


# ============================================================================
# CRM Calendar Events
# ============================================================================

@router.get("/calendar/events")
async def list_calendar_events(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get calendar events (parsed from ICS invites) for a month."""
    user_tz = "UTC"
    if tz:
        import pytz
        if tz in pytz.all_timezones:
            user_tz = tz

    now = datetime.utcnow()
    target_month = month or now.month
    target_year = year or now.year

    conditions = [
        "ce.rep_id = :rep_id",
        "EXTRACT(MONTH FROM ce.starts_at AT TIME ZONE :tz) = :month",
        "EXTRACT(YEAR FROM ce.starts_at AT TIME ZONE :tz) = :year",
    ]
    params = {"rep_id": profile["id"], "month": target_month, "year": target_year, "tz": user_tz}

    if status:
        conditions.append("ce.status = :status")
        params["status"] = status

    where = " AND ".join(conditions)

    rows = execute_query(
        f"""
        SELECT ce.*,
               (ce.starts_at AT TIME ZONE :tz)::date as date,
               t.subject as thread_subject,
               t.id as thread_id
        FROM crm_calendar_events ce
        LEFT JOIN crm_email_messages m ON m.id = ce.message_id
        LEFT JOIN crm_email_threads t ON t.id = m.thread_id
        WHERE {where}
        ORDER BY ce.starts_at ASC
        """,
        params,
    )

    # Group by date for calendar view
    events_by_date = {}
    for row in rows:
        d = str(row["date"])
        if d not in events_by_date:
            events_by_date[d] = []
        events_by_date[d].append(row)

    return {"events": events_by_date, "month": target_month, "year": target_year}


@router.get("/calendar/events/pending/count")
async def pending_invite_count(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_VIEW)),
):
    """Get count of pending calendar invites for sidebar badge."""
    row = execute_single(
        "SELECT COUNT(*) as count FROM crm_calendar_events WHERE rep_id = :rid AND status = 'pending'",
        {"rid": profile["id"]},
    )
    return {"count": row["count"] if row else 0}


@router.post("/calendar/events/{event_id}/accept")
async def accept_calendar_event(
    event_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Accept a calendar invite: create a CRM activity and send RSVP."""
    event = execute_single(
        "SELECT * FROM crm_calendar_events WHERE id = :eid AND rep_id = :rid",
        {"eid": event_id, "rid": profile["id"]},
    )
    if not event:
        raise HTTPException(404, "Calendar event not found")
    if event["status"] == "accepted":
        return {"message": "Already accepted", "event": event}

    # Create a CRM activity from the event
    activity = execute_single(
        """
        INSERT INTO crm_activities
            (rep_id, activity_type, subject, description, activity_date, duration_minutes)
        VALUES (:rid, 'meeting', :subj, :desc, :date, :dur)
        RETURNING *
        """,
        {
            "rid": profile["id"],
            "subj": event["title"],
            "desc": "\n".join(filter(None, [
                event.get("description"),
                f"Location: {event['location']}" if event.get("location") else None,
                f"Google Meet: {event['meet_link']}" if event.get("meet_link") else None,
                f"Organizer: {event.get('organizer_name', '')} <{event.get('organizer_email', '')}>",
            ])),
            "date": event["starts_at"],
            "dur": int((event["ends_at"] - event["starts_at"]).total_seconds() / 60) if event.get("ends_at") else None,
        },
    )

    # Link activity to calendar event and update status
    execute_single(
        """
        UPDATE crm_calendar_events SET status = 'accepted', activity_id = :aid
        WHERE id = :eid RETURNING id
        """,
        {"aid": activity["id"], "eid": event_id},
    )

    # Send RSVP reply if we have the organizer email and an email account
    if event.get("organizer_email") and event.get("raw_ics"):
        try:
            _send_rsvp_reply(event, account_id=event["account_id"], accepted=True)
        except Exception:
            pass  # Best-effort RSVP

    updated = execute_single(
        "SELECT * FROM crm_calendar_events WHERE id = :eid",
        {"eid": event_id},
    )
    return {"message": "Event accepted and added to calendar", "event": updated, "activity": activity}


@router.post("/calendar/events/{event_id}/decline")
async def decline_calendar_event(
    event_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_CREATE)),
):
    """Decline a calendar invite."""
    event = execute_single(
        "SELECT * FROM crm_calendar_events WHERE id = :eid AND rep_id = :rid",
        {"eid": event_id, "rid": profile["id"]},
    )
    if not event:
        raise HTTPException(404, "Calendar event not found")

    execute_single(
        "UPDATE crm_calendar_events SET status = 'declined' WHERE id = :eid RETURNING id",
        {"eid": event_id},
    )

    # Send decline RSVP (best-effort)
    if event.get("organizer_email") and event.get("raw_ics"):
        try:
            _send_rsvp_reply(event, account_id=event["account_id"], accepted=False)
        except Exception:
            pass

    return {"message": "Event declined"}


def _send_rsvp_reply(event: dict, account_id: str, accepted: bool):
    """Send an RSVP reply email with an ICS attachment."""
    import resend as resend_sdk
    from app.core.config import settings
    from icalendar import Calendar, Event, vCalAddress, vText
    from datetime import timezone as _tz

    account = execute_single(
        "SELECT * FROM crm_email_accounts WHERE id = :aid",
        {"aid": account_id},
    )
    if not account:
        return

    # Build RSVP ICS
    cal = Calendar()
    cal.add("prodid", "-//SWN CRM//EN")
    cal.add("version", "2.0")
    cal.add("method", "REPLY")

    evt = Event()
    evt.add("uid", event["uid"])
    evt.add("dtstart", event["starts_at"])
    if event.get("ends_at"):
        evt.add("dtend", event["ends_at"])
    evt.add("summary", event["title"])

    attendee = vCalAddress(f"mailto:{account['email_address']}")
    attendee.params["PARTSTAT"] = vText("ACCEPTED" if accepted else "DECLINED")
    attendee.params["CN"] = vText(account.get("display_name", ""))
    evt.add("attendee", attendee)

    if event.get("organizer_email"):
        organizer = vCalAddress(f"mailto:{event['organizer_email']}")
        if event.get("organizer_name"):
            organizer.params["CN"] = vText(event["organizer_name"])
        evt.add("organizer", organizer)

    cal.add_component(evt)

    ics_bytes = cal.to_ical()
    status_text = "Accepted" if accepted else "Declined"

    resend_sdk.api_key = settings.RESEND_API_KEY
    resend_sdk.Emails.send({
        "from": f"{account['display_name']} <{account['email_address']}>",
        "to": [event["organizer_email"]],
        "subject": f"{status_text}: {event['title']}",
        "text": f"{account.get('display_name', '')} has {status_text.lower()} the invitation: {event['title']}",
        "attachments": [{"filename": "invite.ics", "content": ics_bytes}],
    })
