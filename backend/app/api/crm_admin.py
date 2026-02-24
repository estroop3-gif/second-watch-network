"""
CRM Admin API — Management Endpoints
Rep oversight, bulk operations, and aggregate stats.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.database import execute_query, execute_single, execute_insert, execute_update, execute_delete
from app.core.permissions import Permission, require_permissions

router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class TeamAddRequest(BaseModel):
    user_id: str
    role: str  # sales_rep, sales_agent, or sales_admin


class TeamRoleUpdateRequest(BaseModel):
    role: str  # sales_rep, sales_agent, or sales_admin


class TeamRemoveRequest(BaseModel):
    user_id: str


class AssignContactRequest(BaseModel):
    rep_id: str
    notes: Optional[str] = None


class BulkAssignRequest(BaseModel):
    contact_ids: List[str]
    rep_id: str
    notes: Optional[str] = None


class AssignDealRequest(BaseModel):
    rep_id: str


class GoalCreate(BaseModel):
    rep_id: Optional[str] = None  # NULL = team-wide
    goal_type: str
    period_type: str = "monthly"
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    target_value: int
    is_recurring: Optional[bool] = False


class GoalUpdate(BaseModel):
    target_value: Optional[int] = None
    actual_value: Optional[int] = None
    period_end: Optional[str] = None
    manual_override: Optional[int] = None
    is_recurring: Optional[bool] = None
    goal_type: Optional[str] = None
    period_type: Optional[str] = None


# ============================================================================
# Rep Management
# ============================================================================

@router.get("/reps")
async def list_sales_reps(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get all sales reps with their stats."""
    reps = execute_query(
        """
        SELECT p.id, p.full_name, p.email, p.avatar_url,
               p.is_sales_agent, p.is_sales_rep, p.is_sales_admin,
               p.is_admin, p.is_superadmin,
               (SELECT COUNT(*) FROM crm_contacts c WHERE c.assigned_rep_id = p.id AND c.status = 'active') as contact_count,
               (SELECT COUNT(*) FROM crm_activities a WHERE a.rep_id = p.id AND a.activity_date >= CURRENT_DATE - INTERVAL '30 days') as activities_30d,
               (SELECT COUNT(*) FROM crm_activities a WHERE a.rep_id = p.id AND a.activity_date::date = CURRENT_DATE) as activities_today,
               ic.calls as today_calls,
               ic.emails as today_emails,
               ic.texts as today_texts,
               ic.meetings as today_meetings,
               ic.demos as today_demos,
               ic.other_interactions as today_other
        FROM profiles p
        LEFT JOIN crm_interaction_counts ic ON ic.rep_id = p.id AND ic.count_date = CURRENT_DATE
        WHERE p.is_sales_agent = true OR p.is_sales_rep = true OR p.is_sales_admin = true
        ORDER BY p.full_name ASC
        """,
        {},
    )
    return {"reps": reps}


@router.get("/reps/{rep_id}/summary")
async def get_rep_summary(
    rep_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get a consolidated summary of a rep's CRM data for admin drill-down."""
    # Profile info
    rep = execute_single(
        """
        SELECT id, full_name, email, avatar_url, display_name, phone, department, job_title,
               is_sales_agent, is_sales_rep, is_sales_admin, is_admin, is_superadmin
        FROM profiles WHERE id = :rid
        """,
        {"rid": rep_id},
    )
    if not rep:
        raise HTTPException(404, "Rep not found")

    # Contact stats
    contact_stats = execute_single(
        """
        SELECT
            COUNT(*) FILTER (WHERE status = 'active') as active_contacts,
            COUNT(*) as total_contacts,
            COUNT(*) FILTER (WHERE do_not_email = true OR do_not_call = true OR do_not_text = true) as dnc_count
        FROM crm_contacts WHERE assigned_rep_id = :rid
        """,
        {"rid": rep_id},
    )

    # Deal stats
    deal_stats = execute_single(
        """
        SELECT
            COUNT(*) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost')) as open_deals,
            COUNT(*) FILTER (WHERE stage = 'closed_won') as won_deals,
            COUNT(*) FILTER (WHERE stage = 'closed_lost') as lost_deals,
            COALESCE(SUM(amount_cents) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost')), 0) / 100.0 as pipeline_value
        FROM crm_deals WHERE assigned_rep_id = :rid
        """,
        {"rid": rep_id},
    )

    # Activity stats
    activity_stats = execute_single(
        """
        SELECT
            COUNT(*) FILTER (WHERE activity_date::date = CURRENT_DATE) as today,
            COUNT(*) FILTER (WHERE activity_date >= CURRENT_DATE - INTERVAL '7 days') as last_7d,
            COUNT(*) FILTER (WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days') as last_30d
        FROM crm_activities WHERE rep_id = :rid
        """,
        {"rid": rep_id},
    )

    # Interaction totals (today)
    interactions = execute_single(
        """
        SELECT COALESCE(calls, 0) as calls, COALESCE(emails, 0) as emails,
               COALESCE(texts, 0) as texts, COALESCE(meetings, 0) as meetings,
               COALESCE(demos, 0) as demos, COALESCE(other_interactions, 0) as other
        FROM crm_interaction_counts WHERE rep_id = :rid AND count_date = CURRENT_DATE
        """,
        {"rid": rep_id},
    )

    # Email stats (last 30d) — exclude internal + warmup
    email_stats = execute_single(
        """
        SELECT
            COUNT(*) FILTER (WHERE m.direction = 'outbound') as sent_30d,
            COUNT(*) FILTER (WHERE m.direction = 'inbound') as received_30d
        FROM crm_email_messages m
        JOIN crm_email_threads t ON t.id = m.thread_id
        JOIN crm_email_accounts a ON a.id = t.account_id
        WHERE a.profile_id = :rid AND m.created_at >= CURRENT_DATE - INTERVAL '30 days'
              AND COALESCE(m.source_type, 'manual') NOT IN ('internal', 'warmup')
        """,
        {"rid": rep_id},
    )

    # Goal count
    goal_count = execute_single(
        """
        SELECT COUNT(*) as active_goals
        FROM crm_sales_goals WHERE rep_id = :rid AND period_end >= CURRENT_DATE
        """,
        {"rid": rep_id},
    )

    # Review count (last 90d)
    review_count = execute_single(
        """
        SELECT COUNT(*) as recent_reviews
        FROM crm_rep_reviews WHERE rep_id = :rid AND created_at >= CURRENT_DATE - INTERVAL '90 days'
        """,
        {"rid": rep_id},
    )

    return {
        "profile": rep,
        "contacts": contact_stats or {"active_contacts": 0, "total_contacts": 0, "dnc_count": 0},
        "deals": deal_stats or {"open_deals": 0, "won_deals": 0, "lost_deals": 0, "pipeline_value": 0},
        "activities": activity_stats or {"today": 0, "last_7d": 0, "last_30d": 0},
        "interactions": interactions or {"calls": 0, "emails": 0, "texts": 0, "meetings": 0, "demos": 0, "other": 0},
        "email": email_stats or {"sent_30d": 0, "received_30d": 0},
        "goals": {"active_goals": (goal_count or {}).get("active_goals", 0)},
        "reviews": {"recent_reviews": (review_count or {}).get("recent_reviews", 0)},
    }


VALID_CRM_ROLES = {"sales_rep", "sales_agent", "sales_admin"}
CRM_ROLE_FLAGS = ["is_sales_rep", "is_sales_agent", "is_sales_admin"]


@router.post("/team/add")
async def add_team_member(
    data: TeamAddRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Add a user to the CRM sales team with a specific role."""
    if data.role not in VALID_CRM_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(VALID_CRM_ROLES)}")

    user = execute_single(
        "SELECT id, full_name FROM profiles WHERE id = :id",
        {"id": data.user_id},
    )
    if not user:
        raise HTTPException(404, "User not found")

    flag = f"is_{data.role}"
    result = execute_single(
        f"UPDATE profiles SET {flag} = true, updated_at = NOW() WHERE id = :id RETURNING id, full_name",
        {"id": data.user_id},
    )
    return result


@router.post("/team/remove")
async def remove_team_member(
    data: TeamRemoveRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Remove a user from the CRM sales team (clears all CRM role flags)."""
    user = execute_single(
        "SELECT id, full_name FROM profiles WHERE id = :id",
        {"id": data.user_id},
    )
    if not user:
        raise HTTPException(404, "User not found")

    result = execute_single(
        """
        UPDATE profiles
        SET is_sales_rep = false, is_sales_agent = false, is_sales_admin = false, updated_at = NOW()
        WHERE id = :id RETURNING id, full_name
        """,
        {"id": data.user_id},
    )
    return result


@router.put("/team/{user_id}/role")
async def update_team_member_role(
    user_id: str,
    data: TeamRoleUpdateRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Change a team member's CRM role (clears old flags, sets new one)."""
    if data.role not in VALID_CRM_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(VALID_CRM_ROLES)}")

    user = execute_single(
        "SELECT id, full_name FROM profiles WHERE id = :id",
        {"id": user_id},
    )
    if not user:
        raise HTTPException(404, "User not found")

    flag = f"is_{data.role}"
    result = execute_single(
        f"""
        UPDATE profiles
        SET is_sales_rep = false, is_sales_agent = false, is_sales_admin = false,
            {flag} = true, updated_at = NOW()
        WHERE id = :id RETURNING id, full_name
        """,
        {"id": user_id},
    )
    return result


# ============================================================================
# Interaction Aggregates
# ============================================================================

@router.get("/interactions")
async def get_aggregate_interactions(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    rep_id: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get aggregate interaction counts across reps."""
    conditions = []
    params = {}

    if date_from:
        conditions.append("ic.count_date >= :date_from")
        params["date_from"] = date_from

    if date_to:
        conditions.append("ic.count_date <= :date_to")
        params["date_to"] = date_to

    if rep_id:
        conditions.append("ic.rep_id = :rep_id")
        params["rep_id"] = rep_id

    where = " AND ".join(conditions) if conditions else "1=1"

    # Per-rep totals
    rows = execute_query(
        f"""
        SELECT ic.rep_id, p.full_name as rep_name,
               SUM(ic.calls) as total_calls,
               SUM(ic.emails) as total_emails,
               SUM(ic.texts) as total_texts,
               SUM(ic.meetings) as total_meetings,
               SUM(ic.demos) as total_demos,
               SUM(ic.other_interactions) as total_other,
               SUM(ic.calls + ic.emails + ic.texts + ic.meetings + ic.demos + ic.other_interactions) as grand_total
        FROM crm_interaction_counts ic
        LEFT JOIN profiles p ON p.id = ic.rep_id
        WHERE {where}
        GROUP BY ic.rep_id, p.full_name
        ORDER BY grand_total DESC
        """,
        params,
    )

    # Team totals
    team = execute_single(
        f"""
        SELECT
            COALESCE(SUM(ic.calls), 0) as total_calls,
            COALESCE(SUM(ic.emails), 0) as total_emails,
            COALESCE(SUM(ic.texts), 0) as total_texts,
            COALESCE(SUM(ic.meetings), 0) as total_meetings,
            COALESCE(SUM(ic.demos), 0) as total_demos,
            COALESCE(SUM(ic.other_interactions), 0) as total_other,
            COALESCE(SUM(ic.calls + ic.emails + ic.texts + ic.meetings + ic.demos + ic.other_interactions), 0) as grand_total
        FROM crm_interaction_counts ic
        WHERE {where}
        """,
        params,
    )

    return {"by_rep": rows, "team_totals": team}


# ============================================================================
# Contact Assignment
# ============================================================================

@router.post("/contacts/{contact_id}/assign")
async def assign_contact(
    contact_id: str,
    data: AssignContactRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Assign a contact to a specific rep."""
    # Verify contact exists and get current assignment
    contact = execute_single(
        "SELECT id, first_name, last_name, assigned_rep_id FROM crm_contacts WHERE id = :id",
        {"id": contact_id},
    )
    if not contact:
        raise HTTPException(404, "Contact not found")

    # Verify rep exists and is a sales team member
    rep = execute_single(
        "SELECT id, full_name FROM profiles WHERE id = :id AND (is_sales_agent = true OR is_sales_rep = true OR is_sales_admin = true OR is_admin = true OR is_superadmin = true)",
        {"id": data.rep_id},
    )
    if not rep:
        raise HTTPException(404, "Sales rep not found")

    from_rep_id = contact.get("assigned_rep_id")
    assignment_type = "transfer" if from_rep_id else "assign"

    result = execute_single(
        "UPDATE crm_contacts SET assigned_rep_id = :rep_id, updated_at = NOW() WHERE id = :id RETURNING *",
        {"rep_id": data.rep_id, "id": contact_id},
    )

    # Log assignment
    log_params = {
        "contact_id": contact_id,
        "to_rep_id": data.rep_id,
        "assigned_by": profile["id"],
        "assignment_type": assignment_type,
        "notes": data.notes,
    }
    if from_rep_id:
        log_params["from_rep_id"] = from_rep_id
        execute_insert(
            """INSERT INTO crm_contact_assignment_log
               (contact_id, from_rep_id, to_rep_id, assigned_by, assignment_type, notes)
               VALUES (:contact_id, :from_rep_id, :to_rep_id, :assigned_by, :assignment_type, :notes)
               RETURNING id""",
            log_params,
        )
    else:
        execute_insert(
            """INSERT INTO crm_contact_assignment_log
               (contact_id, to_rep_id, assigned_by, assignment_type, notes)
               VALUES (:contact_id, :to_rep_id, :assigned_by, :assignment_type, :notes)
               RETURNING id""",
            log_params,
        )

    try:
        from app.services.crm_notifications import notify_crm_users
        contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "Unknown"
        rep_name = rep.get("full_name", "a rep")
        await notify_crm_users(
            event_type="crm_contact",
            title=f"Contact {contact_name} assigned to {rep_name}",
            related_id=contact_id,
            exclude_profile_id=profile["id"],
        )
    except Exception:
        pass

    return result


@router.post("/contacts/bulk-assign")
async def bulk_assign_contacts(
    data: BulkAssignRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Bulk assign contacts to a rep."""
    # Verify rep exists
    rep = execute_single(
        "SELECT id, full_name FROM profiles WHERE id = :id AND (is_sales_agent = true OR is_sales_rep = true OR is_sales_admin = true OR is_admin = true OR is_superadmin = true)",
        {"id": data.rep_id},
    )
    if not rep:
        raise HTTPException(404, "Sales rep not found")

    updated = 0
    for cid in data.contact_ids:
        # Get current assignment before update
        existing = execute_single(
            "SELECT assigned_rep_id FROM crm_contacts WHERE id = :cid",
            {"cid": cid},
        )
        result = execute_single(
            "UPDATE crm_contacts SET assigned_rep_id = :rep_id, updated_at = NOW() WHERE id = :cid RETURNING id",
            {"rep_id": data.rep_id, "cid": cid},
        )
        if result:
            updated += 1
            from_rep_id = existing.get("assigned_rep_id") if existing else None
            assignment_type = "transfer" if from_rep_id else "assign"
            log_params = {
                "contact_id": cid,
                "to_rep_id": data.rep_id,
                "assigned_by": profile["id"],
                "assignment_type": assignment_type,
                "notes": data.notes,
            }
            if from_rep_id:
                log_params["from_rep_id"] = from_rep_id
                execute_insert(
                    """INSERT INTO crm_contact_assignment_log
                       (contact_id, from_rep_id, to_rep_id, assigned_by, assignment_type, notes)
                       VALUES (:contact_id, :from_rep_id, :to_rep_id, :assigned_by, :assignment_type, :notes)
                       RETURNING id""",
                    log_params,
                )
            else:
                execute_insert(
                    """INSERT INTO crm_contact_assignment_log
                       (contact_id, to_rep_id, assigned_by, assignment_type, notes)
                       VALUES (:contact_id, :to_rep_id, :assigned_by, :assignment_type, :notes)
                       RETURNING id""",
                    log_params,
                )

    return {"updated": updated, "rep_name": rep["full_name"]}


# ============================================================================
# Contact Assignment History
# ============================================================================

@router.get("/contacts/{contact_id}/assignment-history")
async def get_contact_assignment_history(
    contact_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get the assignment history for a contact."""
    rows = execute_query(
        """
        SELECT cal.*,
               fp.full_name as from_rep_name,
               tp.full_name as to_rep_name,
               ap.full_name as assigned_by_name
        FROM crm_contact_assignment_log cal
        LEFT JOIN profiles fp ON fp.id = cal.from_rep_id
        LEFT JOIN profiles tp ON tp.id = cal.to_rep_id
        LEFT JOIN profiles ap ON ap.id = cal.assigned_by
        WHERE cal.contact_id = :contact_id
        ORDER BY cal.assigned_at DESC
        """,
        {"contact_id": contact_id},
    )
    return {"history": rows}


# ============================================================================
# Lead Management
# ============================================================================

@router.get("/leads")
async def list_leads(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get new/unassigned leads for admin assignment queue."""
    count_row = execute_single(
        """
        SELECT COUNT(*) as total FROM crm_deals
        WHERE stage = 'lead' AND (assigned_rep_id IS NULL OR assigned_rep_id = created_by)
        """,
        {},
    )
    total = count_row["total"] if count_row else 0

    rows = execute_query(
        """
        SELECT d.*,
               c.first_name as contact_first_name,
               c.last_name as contact_last_name,
               c.company as contact_company,
               c.temperature as contact_temperature,
               c.email as contact_email,
               c.phone as contact_phone,
               p.full_name as assigned_rep_name,
               cp.full_name as created_by_name
        FROM crm_deals d
        LEFT JOIN crm_contacts c ON c.id = d.contact_id
        LEFT JOIN profiles p ON p.id = d.assigned_rep_id
        LEFT JOIN profiles cp ON cp.id = d.created_by
        WHERE d.stage = 'lead' AND (d.assigned_rep_id IS NULL OR d.assigned_rep_id = d.created_by)
        ORDER BY d.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        {"limit": limit, "offset": offset},
    )

    return {"leads": rows, "total": total, "limit": limit, "offset": offset}


@router.post("/deals/{deal_id}/assign")
async def assign_deal(
    deal_id: str,
    data: AssignDealRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Assign a deal to a specific rep."""
    deal = execute_single(
        "SELECT id FROM crm_deals WHERE id = :id",
        {"id": deal_id},
    )
    if not deal:
        raise HTTPException(404, "Deal not found")

    rep = execute_single(
        "SELECT id, full_name FROM profiles WHERE id = :id AND (is_sales_agent = true OR is_admin = true OR is_superadmin = true)",
        {"id": data.rep_id},
    )
    if not rep:
        raise HTTPException(404, "Sales rep not found")

    result = execute_single(
        "UPDATE crm_deals SET assigned_rep_id = :rep_id, updated_at = NOW() WHERE id = :id RETURNING *",
        {"rep_id": data.rep_id, "id": deal_id},
    )
    return result


@router.get("/pipeline/forecast")
async def get_pipeline_forecast(
    months_ahead: int = Query(3, ge=1, le=12),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get revenue forecast based on pipeline weighted values."""
    rows = execute_query(
        """
        SELECT
            COALESCE(TO_CHAR(d.expected_close_date, 'YYYY-MM'), 'unscheduled') as period,
            COUNT(*) as deal_count,
            COALESCE(SUM(d.amount_cents), 0) as total_value,
            COALESCE(SUM(d.amount_cents * d.probability / 100), 0) as weighted_value,
            COALESCE(SUM(CASE WHEN d.stage = 'closed_won' THEN d.amount_cents ELSE 0 END), 0) as won_value
        FROM crm_deals d
        WHERE d.stage NOT IN ('closed_lost')
          AND (d.expected_close_date IS NULL OR d.expected_close_date <= CURRENT_DATE + (:months * INTERVAL '1 month'))
        GROUP BY COALESCE(TO_CHAR(d.expected_close_date, 'YYYY-MM'), 'unscheduled')
        ORDER BY period ASC
        """,
        {"months": months_ahead},
    )

    # Summary totals
    summary = execute_single(
        """
        SELECT
            COUNT(*) as total_deals,
            COALESCE(SUM(amount_cents), 0) as total_pipeline_value,
            COALESCE(SUM(amount_cents * probability / 100), 0) as total_weighted_value,
            COALESCE(SUM(CASE WHEN stage = 'closed_won' THEN amount_cents ELSE 0 END), 0) as total_won,
            COALESCE(SUM(CASE WHEN stage = 'closed_lost' THEN amount_cents ELSE 0 END), 0) as total_lost,
            CASE
                WHEN COUNT(CASE WHEN stage IN ('closed_won', 'closed_lost') THEN 1 END) > 0
                THEN ROUND(
                    COUNT(CASE WHEN stage = 'closed_won' THEN 1 END)::numeric /
                    COUNT(CASE WHEN stage IN ('closed_won', 'closed_lost') THEN 1 END) * 100
                )
                ELSE 0
            END as win_rate
        FROM crm_deals
        """,
        {},
    )

    return {"forecast": rows, "summary": summary}


# ============================================================================
# Goals Management
# ============================================================================

@router.get("/goals")
async def list_goals(
    rep_id: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """List sales goals, optionally filtered by rep."""
    conditions = ["(g.period_end >= CURRENT_DATE OR g.is_recurring = true)"]
    params: Dict[str, Any] = {}
    if rep_id:
        conditions.append("(g.rep_id = :rep_id OR g.rep_id IS NULL)")
        params["rep_id"] = rep_id
    where = " AND ".join(conditions)
    rows = execute_query(
        f"""
        SELECT g.*, p.full_name as rep_name
        FROM crm_sales_goals g
        LEFT JOIN profiles p ON p.id = g.rep_id
        WHERE {where}
        ORDER BY g.period_end DESC
        """,
        params,
    )
    return {"goals": rows}


@router.post("/goals")
async def create_goal(
    data: GoalCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Create a sales goal for a rep or team."""
    from datetime import date, timedelta
    import calendar

    valid_types = {"revenue", "deals_closed", "calls_made", "emails_sent", "meetings_held", "demos_given", "new_contacts"}
    if data.goal_type not in valid_types:
        raise HTTPException(400, f"Invalid goal type. Must be one of: {', '.join(valid_types)}")

    valid_periods = {"daily", "weekly", "monthly", "quarterly"}
    if data.period_type not in valid_periods:
        raise HTTPException(400, f"Invalid period type. Must be one of: {', '.join(valid_periods)}")

    # Auto-compute dates for recurring goals if not provided
    period_start = data.period_start
    period_end = data.period_end
    if data.is_recurring and (not period_start or not period_end):
        today = date.today()
        if data.period_type == "daily":
            period_start = today.isoformat()
            period_end = today.isoformat()
        elif data.period_type == "weekly":
            monday = today - timedelta(days=today.weekday())
            sunday = monday + timedelta(days=6)
            period_start = monday.isoformat()
            period_end = sunday.isoformat()
        elif data.period_type == "monthly":
            first = today.replace(day=1)
            last_day = calendar.monthrange(today.year, today.month)[1]
            period_start = first.isoformat()
            period_end = today.replace(day=last_day).isoformat()
        elif data.period_type == "quarterly":
            q_month = ((today.month - 1) // 3) * 3 + 1
            q_start = today.replace(month=q_month, day=1)
            q_end_month = q_month + 2
            q_end_day = calendar.monthrange(today.year, q_end_month)[1]
            period_start = q_start.isoformat()
            period_end = today.replace(month=q_end_month, day=q_end_day).isoformat()

    if not period_start or not period_end:
        raise HTTPException(400, "period_start and period_end are required for non-recurring goals")

    goal_data = {
        "goal_type": data.goal_type,
        "period_type": data.period_type,
        "period_start": period_start,
        "period_end": period_end,
        "target_value": data.target_value,
        "actual_value": 0,
        "set_by": profile["id"],
        "is_recurring": data.is_recurring or False,
    }

    if data.rep_id:
        goal_data["rep_id"] = data.rep_id

    columns = ", ".join(goal_data.keys())
    placeholders = ", ".join(f":{k}" for k in goal_data.keys())

    result = execute_insert(
        f"INSERT INTO crm_sales_goals ({columns}) VALUES ({placeholders}) RETURNING *",
        goal_data,
    )

    try:
        from app.services.crm_notifications import notify_crm_users
        await notify_crm_users(
            event_type="crm_goal",
            title=f"New {data.period_type} goal: {data.goal_type} ({data.target_value})",
            related_id=result.get("id") if result else None,
            exclude_profile_id=profile["id"],
        )
    except Exception:
        pass

    return result


@router.put("/goals/{goal_id}")
async def update_goal(
    goal_id: str,
    data: GoalUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Update a sales goal."""
    existing = execute_single(
        "SELECT id FROM crm_sales_goals WHERE id = :id",
        {"id": goal_id},
    )
    if not existing:
        raise HTTPException(404, "Goal not found")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    set_clauses = []
    params = {"id": goal_id}
    for key, value in update_data.items():
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    set_clauses.append("updated_at = NOW()")

    result = execute_single(
        f"UPDATE crm_sales_goals SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


@router.delete("/goals/{goal_id}")
async def delete_goal(
    goal_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Delete a sales goal."""
    existing = execute_single(
        "SELECT id FROM crm_sales_goals WHERE id = :id",
        {"id": goal_id},
    )
    if not existing:
        raise HTTPException(404, "Goal not found")

    execute_single(
        "DELETE FROM crm_sales_goals WHERE id = :id RETURNING id",
        {"id": goal_id},
    )
    return {"message": "Goal deleted"}


# ============================================================================
# KPI Dashboard
# ============================================================================

@router.get("/kpi/overview")
async def get_kpi_overview(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get high-level KPI overview: revenue, conversion, win rate, avg cycle, CLV."""
    conditions = []
    params = {}

    if date_from:
        conditions.append("d.created_at >= CAST(:date_from AS timestamptz)")
        params["date_from"] = date_from
    if date_to:
        conditions.append("d.created_at <= CAST(:date_to AS timestamptz)")
        params["date_to"] = date_to

    where = " AND ".join(conditions) if conditions else "1=1"

    kpi = execute_single(
        f"""
        SELECT
            -- Revenue
            COALESCE(SUM(CASE WHEN d.stage = 'closed_won' THEN d.amount_cents ELSE 0 END), 0) as total_revenue,
            COUNT(CASE WHEN d.stage = 'closed_won' THEN 1 END) as deals_won,
            COUNT(CASE WHEN d.stage = 'closed_lost' THEN 1 END) as deals_lost,
            COUNT(*) as total_deals,

            -- Win rate
            CASE
                WHEN COUNT(CASE WHEN d.stage IN ('closed_won', 'closed_lost') THEN 1 END) > 0
                THEN ROUND(
                    COUNT(CASE WHEN d.stage = 'closed_won' THEN 1 END)::numeric /
                    COUNT(CASE WHEN d.stage IN ('closed_won', 'closed_lost') THEN 1 END) * 100
                )
                ELSE 0
            END as win_rate,

            -- Avg deal size (won deals only)
            COALESCE(AVG(CASE WHEN d.stage = 'closed_won' THEN d.amount_cents END), 0) as avg_deal_size,

            -- Pipeline value (open deals)
            COALESCE(SUM(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN d.amount_cents ELSE 0 END), 0) as open_pipeline_value,
            COUNT(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN 1 END) as open_deals,

            -- Active contacts
            (SELECT COUNT(*) FROM crm_contacts WHERE status = 'active') as active_contacts,

            -- New contacts this period
            (SELECT COUNT(*) FROM crm_contacts WHERE created_at >= COALESCE(CAST(:date_from_c AS timestamptz), CURRENT_DATE - INTERVAL '30 days')) as new_contacts
        FROM crm_deals d
        WHERE {where}
        """,
        {**params, "date_from_c": date_from},
    )

    # Avg sales cycle (days from creation to closed_won)
    cycle = execute_single(
        f"""
        SELECT COALESCE(
            AVG(EXTRACT(EPOCH FROM (d.actual_close_date::timestamptz - d.created_at)) / 86400),
            0
        )::integer as avg_cycle_days
        FROM crm_deals d
        WHERE d.stage = 'closed_won'
          AND d.actual_close_date IS NOT NULL
          AND {where}
        """,
        params,
    )

    kpi["avg_cycle_days"] = cycle["avg_cycle_days"] if cycle else 0

    # Email metrics from interaction counts
    email_metrics = execute_single(
        """
        SELECT
            COALESCE(SUM(ic.emails), 0) as total_emails_sent,
            COALESCE(SUM(ic.emails_received), 0) as total_emails_received,
            COALESCE(SUM(ic.campaign_emails), 0) as total_campaign_emails
        FROM crm_interaction_counts ic
        WHERE ic.count_date >= COALESCE(CAST(:date_from_em AS date), CURRENT_DATE - INTERVAL '30 days')
        """,
        {"date_from_em": date_from},
    )
    kpi["total_emails_sent"] = email_metrics["total_emails_sent"] if email_metrics else 0
    kpi["total_emails_received"] = email_metrics["total_emails_received"] if email_metrics else 0
    kpi["total_campaign_emails"] = email_metrics["total_campaign_emails"] if email_metrics else 0

    return kpi


@router.get("/kpi/rep-performance")
async def get_rep_performance(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get per-rep performance breakdown."""
    conditions = []
    params = {}

    if date_from:
        conditions.append("d.created_at >= CAST(:date_from AS timestamptz)")
        params["date_from"] = date_from
    if date_to:
        conditions.append("d.created_at <= CAST(:date_to AS timestamptz)")
        params["date_to"] = date_to

    where = " AND ".join(conditions) if conditions else "1=1"

    rows = execute_query(
        f"""
        SELECT
            d.assigned_rep_id as rep_id,
            p.full_name as rep_name,
            COUNT(*) as total_deals,
            COUNT(CASE WHEN d.stage = 'closed_won' THEN 1 END) as deals_won,
            COUNT(CASE WHEN d.stage = 'closed_lost' THEN 1 END) as deals_lost,
            COALESCE(SUM(CASE WHEN d.stage = 'closed_won' THEN d.amount_cents ELSE 0 END), 0) as revenue,
            COALESCE(SUM(CASE WHEN d.stage NOT IN ('closed_won', 'closed_lost') THEN d.amount_cents ELSE 0 END), 0) as open_pipeline,
            CASE
                WHEN COUNT(CASE WHEN d.stage IN ('closed_won', 'closed_lost') THEN 1 END) > 0
                THEN ROUND(
                    COUNT(CASE WHEN d.stage = 'closed_won' THEN 1 END)::numeric /
                    COUNT(CASE WHEN d.stage IN ('closed_won', 'closed_lost') THEN 1 END) * 100
                )
                ELSE 0
            END as win_rate,
            (SELECT COUNT(*) FROM crm_contacts c WHERE c.assigned_rep_id = d.assigned_rep_id AND c.status = 'active') as active_contacts,
            (SELECT COALESCE(SUM(ic.calls + ic.emails + ic.texts + ic.meetings + ic.demos + ic.other_interactions), 0)
             FROM crm_interaction_counts ic
             WHERE ic.rep_id = d.assigned_rep_id
               AND ic.count_date >= COALESCE(CAST(:date_from_ic AS date), CURRENT_DATE - INTERVAL '30 days')
            ) as total_interactions,
            (SELECT COALESCE(SUM(ic.emails), 0)
             FROM crm_interaction_counts ic
             WHERE ic.rep_id = d.assigned_rep_id
               AND ic.count_date >= COALESCE(CAST(:date_from_ic AS date), CURRENT_DATE - INTERVAL '30 days')
            ) as emails_sent,
            (SELECT COALESCE(SUM(ic.emails_received), 0)
             FROM crm_interaction_counts ic
             WHERE ic.rep_id = d.assigned_rep_id
               AND ic.count_date >= COALESCE(CAST(:date_from_ic AS date), CURRENT_DATE - INTERVAL '30 days')
            ) as emails_received
        FROM crm_deals d
        LEFT JOIN profiles p ON p.id = d.assigned_rep_id
        WHERE d.assigned_rep_id IS NOT NULL AND {where}
        GROUP BY d.assigned_rep_id, p.full_name
        ORDER BY revenue DESC
        """,
        {**params, "date_from_ic": date_from},
    )

    return {"reps": rows}


@router.get("/kpi/trends")
async def get_kpi_trends(
    period: Optional[str] = Query("monthly"),
    months_back: int = Query(6, ge=1, le=24),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get time-series KPI data for charting."""
    if period == "weekly":
        trunc = "week"
        fmt = "IYYY-IW"
    else:
        trunc = "month"
        fmt = "YYYY-MM"

    rows = execute_query(
        f"""
        SELECT
            TO_CHAR(DATE_TRUNC(:trunc, d.created_at), :fmt) as period,
            COUNT(*) as new_deals,
            COUNT(CASE WHEN d.stage = 'closed_won' THEN 1 END) as deals_won,
            COUNT(CASE WHEN d.stage = 'closed_lost' THEN 1 END) as deals_lost,
            COALESCE(SUM(CASE WHEN d.stage = 'closed_won' THEN d.amount_cents ELSE 0 END), 0) as revenue
        FROM crm_deals d
        WHERE d.created_at >= CURRENT_DATE - (:months * INTERVAL '1 month')
        GROUP BY TO_CHAR(DATE_TRUNC(:trunc, d.created_at), :fmt)
        ORDER BY period ASC
        """,
        {"trunc": trunc, "fmt": fmt, "months": months_back},
    )

    return {"trends": rows, "period": period}


@router.get("/kpi/leaderboard")
async def get_rep_leaderboard(
    metric: Optional[str] = Query("revenue"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get rep rankings by specified metric."""
    valid_metrics = {"revenue", "deals_won", "interactions", "contacts"}

    if metric not in valid_metrics:
        metric = "revenue"

    conditions = []
    params = {}

    if date_from:
        conditions.append("d.created_at >= CAST(:date_from AS timestamptz)")
        params["date_from"] = date_from
    if date_to:
        conditions.append("d.created_at <= CAST(:date_to AS timestamptz)")
        params["date_to"] = date_to

    where = " AND ".join(conditions) if conditions else "1=1"

    if metric == "revenue":
        rows = execute_query(
            f"""
            SELECT d.assigned_rep_id as rep_id, p.full_name as rep_name, p.avatar_url,
                   COALESCE(SUM(CASE WHEN d.stage = 'closed_won' THEN d.amount_cents ELSE 0 END), 0) as value
            FROM crm_deals d
            LEFT JOIN profiles p ON p.id = d.assigned_rep_id
            WHERE d.assigned_rep_id IS NOT NULL AND {where}
            GROUP BY d.assigned_rep_id, p.full_name, p.avatar_url
            ORDER BY value DESC
            """,
            params,
        )
    elif metric == "deals_won":
        rows = execute_query(
            f"""
            SELECT d.assigned_rep_id as rep_id, p.full_name as rep_name, p.avatar_url,
                   COUNT(CASE WHEN d.stage = 'closed_won' THEN 1 END) as value
            FROM crm_deals d
            LEFT JOIN profiles p ON p.id = d.assigned_rep_id
            WHERE d.assigned_rep_id IS NOT NULL AND {where}
            GROUP BY d.assigned_rep_id, p.full_name, p.avatar_url
            ORDER BY value DESC
            """,
            params,
        )
    elif metric == "interactions":
        rows = execute_query(
            """
            SELECT ic.rep_id, p.full_name as rep_name, p.avatar_url,
                   COALESCE(SUM(ic.calls + ic.emails + ic.texts + ic.meetings + ic.demos + ic.other_interactions), 0) as value
            FROM crm_interaction_counts ic
            LEFT JOIN profiles p ON p.id = ic.rep_id
            WHERE ic.count_date >= COALESCE(CAST(:date_from AS date), CURRENT_DATE - INTERVAL '30 days')
            GROUP BY ic.rep_id, p.full_name, p.avatar_url
            ORDER BY value DESC
            """,
            {"date_from": date_from},
        )
    else:  # contacts
        rows = execute_query(
            """
            SELECT c.assigned_rep_id as rep_id, p.full_name as rep_name, p.avatar_url,
                   COUNT(*) as value
            FROM crm_contacts c
            LEFT JOIN profiles p ON p.id = c.assigned_rep_id
            WHERE c.assigned_rep_id IS NOT NULL AND c.status = 'active'
            GROUP BY c.assigned_rep_id, p.full_name, p.avatar_url
            ORDER BY value DESC
            """,
            {},
        )

    # Add rank
    for i, row in enumerate(rows):
        row["rank"] = i + 1

    return {"leaderboard": rows, "metric": metric}


# ============================================================================
# Admin Reviews Management
# ============================================================================

class ReviewCreate(BaseModel):
    rep_id: str
    review_type: str = "admin_note"
    contact_id: Optional[str] = None
    rating: int = 5
    title: Optional[str] = None
    body: Optional[str] = None
    is_visible_to_rep: bool = True


class ReviewUpdate(BaseModel):
    rating: Optional[int] = None
    title: Optional[str] = None
    body: Optional[str] = None
    is_visible_to_rep: Optional[bool] = None


@router.get("/reviews")
async def list_reviews(
    rep_id: Optional[str] = Query(None),
    review_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """List all reviews (admin view)."""
    conditions = []
    params = {}

    if rep_id:
        conditions.append("r.rep_id = :rep_id")
        params["rep_id"] = rep_id

    if review_type:
        conditions.append("r.review_type = :review_type")
        params["review_type"] = review_type

    where = " AND ".join(conditions) if conditions else "1=1"

    rows = execute_query(
        f"""
        SELECT r.*, p.full_name as rep_name,
               c.first_name as contact_first_name, c.last_name as contact_last_name,
               rv.full_name as reviewer_name
        FROM crm_rep_reviews r
        LEFT JOIN profiles p ON p.id = r.rep_id
        LEFT JOIN crm_contacts c ON c.id = r.contact_id
        LEFT JOIN profiles rv ON rv.id = r.reviewer_id
        WHERE {where}
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        {**params, "limit": limit, "offset": offset},
    )

    count_row = execute_single(
        f"SELECT COUNT(*) as total FROM crm_rep_reviews r WHERE {where}",
        params,
    )

    return {"reviews": rows, "total": count_row["total"] if count_row else 0}


@router.post("/reviews")
async def create_review(
    data: ReviewCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Create a review or admin note for a rep."""
    review_data = {
        "rep_id": data.rep_id,
        "review_type": data.review_type,
        "rating": max(1, min(5, data.rating)),
        "title": data.title,
        "body": data.body,
        "is_visible_to_rep": data.is_visible_to_rep,
        "reviewer_id": profile["id"],
    }

    if data.contact_id:
        review_data["contact_id"] = data.contact_id

    review_data = {k: v for k, v in review_data.items() if v is not None}

    columns = ", ".join(review_data.keys())
    placeholders = ", ".join(f":{k}" for k in review_data.keys())

    result = execute_insert(
        f"INSERT INTO crm_rep_reviews ({columns}) VALUES ({placeholders}) RETURNING *",
        review_data,
    )
    return result


@router.put("/reviews/{review_id}")
async def update_review(
    review_id: str,
    data: ReviewUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Update a review."""
    existing = execute_single(
        "SELECT id FROM crm_rep_reviews WHERE id = :id",
        {"id": review_id},
    )
    if not existing:
        raise HTTPException(404, "Review not found")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    if "rating" in update_data:
        update_data["rating"] = max(1, min(5, update_data["rating"]))

    set_clauses = []
    params = {"id": review_id}
    for key, value in update_data.items():
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    set_clauses.append("updated_at = NOW()")

    result = execute_single(
        f"UPDATE crm_rep_reviews SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


@router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Delete a review."""
    existing = execute_single(
        "SELECT id FROM crm_rep_reviews WHERE id = :id",
        {"id": review_id},
    )
    if not existing:
        raise HTTPException(404, "Review not found")

    execute_single(
        "DELETE FROM crm_rep_reviews WHERE id = :id RETURNING id",
        {"id": review_id},
    )
    return {"message": "Review deleted"}


@router.post("/log/{log_id}/escalate")
async def escalate_log_entry(
    log_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Escalate a customer log entry."""
    existing = execute_single(
        "SELECT id, status FROM crm_customer_log WHERE id = :id",
        {"id": log_id},
    )
    if not existing:
        raise HTTPException(404, "Log entry not found")

    result = execute_single(
        """
        UPDATE crm_customer_log
        SET log_type = 'escalation', priority = 'urgent', status = 'open', updated_at = NOW()
        WHERE id = :id RETURNING *
        """,
        {"id": log_id},
    )
    return result


# ============================================================================
# Email Campaigns
# ============================================================================

class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    subject_template: str
    html_template: Optional[str] = None
    text_template: Optional[str] = None
    target_temperature: Optional[List[str]] = []
    target_tags: Optional[List[str]] = []
    send_type: str = "manual"
    scheduled_at: Optional[str] = None
    drip_delay_days: Optional[int] = None
    sender_account_ids: Optional[List[str]] = None
    sender_mode: Optional[str] = "select"
    batch_size: Optional[int] = None
    send_delay_seconds: Optional[int] = None
    # Multi-source targeting
    source_crm_contacts: Optional[bool] = True
    source_manual_emails: Optional[bool] = False
    source_site_users: Optional[bool] = False
    manual_recipients: Optional[List[dict]] = []
    target_roles: Optional[List[str]] = []
    target_subscription_tiers: Optional[List[str]] = []


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    subject_template: Optional[str] = None
    html_template: Optional[str] = None
    text_template: Optional[str] = None
    target_temperature: Optional[List[str]] = None
    target_tags: Optional[List[str]] = None
    send_type: Optional[str] = None
    scheduled_at: Optional[str] = None
    drip_delay_days: Optional[int] = None
    status: Optional[str] = None
    sender_account_ids: Optional[List[str]] = None
    sender_mode: Optional[str] = None
    batch_size: Optional[int] = None
    send_delay_seconds: Optional[int] = None
    # Multi-source targeting
    source_crm_contacts: Optional[bool] = None
    source_manual_emails: Optional[bool] = None
    source_site_users: Optional[bool] = None
    manual_recipients: Optional[List[dict]] = None
    target_roles: Optional[List[str]] = None
    target_subscription_tiers: Optional[List[str]] = None


class CampaignSendersUpdate(BaseModel):
    account_ids: List[str]


@router.get("/campaigns")
async def list_campaigns(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """List email campaigns."""
    conditions = []
    params = {}

    if status:
        conditions.append("c.status = :status")
        params["status"] = status

    where = " AND ".join(conditions) if conditions else "1=1"

    count_row = execute_single(
        f"SELECT COUNT(*) as total FROM crm_email_campaigns c WHERE {where}",
        params,
    )

    rows = execute_query(
        f"""
        SELECT c.*, p.full_name as created_by_name
        FROM crm_email_campaigns c
        LEFT JOIN profiles p ON p.id = c.created_by
        WHERE {where}
        ORDER BY c.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        {**params, "limit": limit, "offset": offset},
    )

    return {"campaigns": rows, "total": count_row["total"] if count_row else 0}


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get campaign with send stats."""
    campaign = execute_single(
        """
        SELECT c.*, p.full_name as created_by_name
        FROM crm_email_campaigns c
        LEFT JOIN profiles p ON p.id = c.created_by
        WHERE c.id = :id
        """,
        {"id": campaign_id},
    )
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    # Get send results (LEFT JOIN since manual/site-user sends have no contact_id)
    sends = execute_query(
        """
        SELECT s.*,
               COALESCE(ct.first_name, SPLIT_PART(s.recipient_name, ' ', 1)) as contact_first_name,
               COALESCE(ct.last_name, NULLIF(SUBSTRING(s.recipient_name FROM POSITION(' ' IN s.recipient_name) + 1), '')) as contact_last_name,
               COALESCE(ct.email, s.recipient_email) as contact_email
        FROM crm_email_sends s
        LEFT JOIN crm_contacts ct ON ct.id = s.contact_id
        WHERE s.campaign_id = :campaign_id
        ORDER BY s.created_at DESC
        LIMIT 200
        """,
        {"campaign_id": campaign_id},
    )

    # Get assigned sender accounts
    senders = execute_query(
        """
        SELECT cs.id, cs.account_id, cs.send_count,
               a.email_address, a.display_name, a.is_active
        FROM crm_campaign_senders cs
        JOIN crm_email_accounts a ON a.id = cs.account_id
        WHERE cs.campaign_id = :campaign_id
        ORDER BY cs.created_at ASC
        """,
        {"campaign_id": campaign_id},
    )

    campaign["sends"] = sends
    campaign["senders"] = senders
    return campaign


@router.post("/campaigns")
async def create_campaign(
    data: CampaignCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Create a new email campaign."""
    import json
    campaign_data = {
        "name": data.name,
        "description": data.description,
        "subject_template": data.subject_template,
        "html_template": data.html_template,
        "text_template": data.text_template,
        "send_type": data.send_type,
        "scheduled_at": data.scheduled_at,
        "drip_delay_days": data.drip_delay_days,
        "batch_size": data.batch_size,
        "send_delay_seconds": data.send_delay_seconds,
        "sender_mode": data.sender_mode,
        "source_crm_contacts": data.source_crm_contacts,
        "source_manual_emails": data.source_manual_emails,
        "source_site_users": data.source_site_users,
        "target_roles": data.target_roles if data.target_roles else None,
        "target_subscription_tiers": data.target_subscription_tiers if data.target_subscription_tiers else None,
        "created_by": profile["id"],
        "status": "draft",
    }
    # manual_recipients is JSONB — must serialize
    if data.manual_recipients:
        campaign_data["manual_recipients"] = json.dumps(data.manual_recipients)
    campaign_data = {k: v for k, v in campaign_data.items() if v is not None}

    columns = ", ".join(campaign_data.keys())
    placeholders = ", ".join(f":{k}" for k in campaign_data.keys())

    result = execute_insert(
        f"INSERT INTO crm_email_campaigns ({columns}) VALUES ({placeholders}) RETURNING *",
        campaign_data,
    )

    # Insert sender accounts if provided (for 'single' and 'select' modes)
    if data.sender_account_ids and result:
        for account_id in data.sender_account_ids:
            execute_insert(
                "INSERT INTO crm_campaign_senders (campaign_id, account_id) VALUES (:cid, :aid) ON CONFLICT DO NOTHING RETURNING id",
                {"cid": result["id"], "aid": account_id},
            )

    return result


@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    data: CampaignUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Update a campaign (only if draft or scheduled)."""
    existing = execute_single(
        "SELECT status FROM crm_email_campaigns WHERE id = :id",
        {"id": campaign_id},
    )
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["status"] not in ("draft", "scheduled"):
        raise HTTPException(400, "Can only edit draft or scheduled campaigns")

    # Extract sender_account_ids separately — it's not a column on the campaigns table
    import json
    sender_account_ids = data.sender_account_ids
    update_data = data.dict(exclude_none=True)
    update_data.pop("sender_account_ids", None)
    # sender_mode IS a column, so keep it in update_data
    # manual_recipients is JSONB — must serialize
    if "manual_recipients" in update_data:
        update_data["manual_recipients"] = json.dumps(update_data["manual_recipients"])

    if update_data:
        set_clauses = []
        params = {"id": campaign_id}
        for key, value in update_data.items():
            set_clauses.append(f"{key} = :{key}")
            params[key] = value

        set_clauses.append("updated_at = NOW()")

        result = execute_single(
            f"UPDATE crm_email_campaigns SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
            params,
        )
    else:
        result = execute_single(
            "SELECT * FROM crm_email_campaigns WHERE id = :id",
            {"id": campaign_id},
        )

    # Update sender accounts if provided
    if sender_account_ids is not None:
        execute_delete(
            "DELETE FROM crm_campaign_senders WHERE campaign_id = :cid",
            {"cid": campaign_id},
        )
        for account_id in sender_account_ids:
            execute_insert(
                "INSERT INTO crm_campaign_senders (campaign_id, account_id) VALUES (:cid, :aid) ON CONFLICT DO NOTHING RETURNING id",
                {"cid": campaign_id, "aid": account_id},
            )

    return result


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Delete a campaign (only if draft)."""
    existing = execute_single(
        "SELECT status FROM crm_email_campaigns WHERE id = :id",
        {"id": campaign_id},
    )
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["status"] != "draft":
        raise HTTPException(400, "Can only delete draft campaigns")

    execute_single(
        "DELETE FROM crm_email_campaigns WHERE id = :id RETURNING id",
        {"id": campaign_id},
    )
    return {"message": "Campaign deleted"}


@router.post("/campaigns/{campaign_id}/schedule")
async def schedule_campaign(
    campaign_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Schedule a campaign for sending."""
    existing = execute_single(
        "SELECT status, scheduled_at FROM crm_email_campaigns WHERE id = :id",
        {"id": campaign_id},
    )
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["status"] != "draft":
        raise HTTPException(400, "Can only schedule draft campaigns")

    result = execute_single(
        """
        UPDATE crm_email_campaigns
        SET status = 'scheduled', updated_at = NOW()
        WHERE id = :id RETURNING *
        """,
        {"id": campaign_id},
    )
    return result


@router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(
    campaign_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Cancel a scheduled campaign."""
    existing = execute_single(
        "SELECT status FROM crm_email_campaigns WHERE id = :id",
        {"id": campaign_id},
    )
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["status"] not in ("scheduled", "draft"):
        raise HTTPException(400, "Can only cancel draft or scheduled campaigns")

    result = execute_single(
        """
        UPDATE crm_email_campaigns
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = :id RETURNING *
        """,
        {"id": campaign_id},
    )
    return result


@router.post("/campaigns/{campaign_id}/send-now")
async def send_campaign_now(
    campaign_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Immediately start sending a campaign (sets status to 'sending')."""
    existing = execute_single(
        "SELECT status, sender_mode FROM crm_email_campaigns WHERE id = :id",
        {"id": campaign_id},
    )
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["status"] not in ("draft", "scheduled"):
        raise HTTPException(400, "Can only send draft or scheduled campaigns")

    # Validate senders: rotate_all/rep_match use dynamic accounts, others need assigned senders
    if existing.get("sender_mode") == "rotate_all":
        active_accounts = execute_query(
            "SELECT id FROM crm_email_accounts WHERE is_active = true",
            {},
        )
        if not active_accounts:
            raise HTTPException(400, "No active email accounts exist for rotate_all mode")
    elif existing.get("sender_mode") == "rep_match":
        active_rep_accounts = execute_query(
            "SELECT id FROM crm_email_accounts WHERE is_active = true AND account_type = 'rep'",
            {},
        )
        if not active_rep_accounts:
            raise HTTPException(400, "No active rep email accounts exist for rep_match mode")
    else:
        senders = execute_query(
            """
            SELECT cs.id FROM crm_campaign_senders cs
            JOIN crm_email_accounts a ON a.id = cs.account_id
            WHERE cs.campaign_id = :cid AND a.is_active = true
            """,
            {"cid": campaign_id},
        )
        if not senders:
            raise HTTPException(400, "No active sender accounts assigned to this campaign")

    result = execute_single(
        """
        UPDATE crm_email_campaigns
        SET status = 'sending', updated_at = NOW()
        WHERE id = :id RETURNING *
        """,
        {"id": campaign_id},
    )

    try:
        from app.services.crm_notifications import notify_crm_users
        campaign_name = result.get("name", "Untitled") if result else "Untitled"
        await notify_crm_users(
            event_type="crm_campaign",
            title=f"Campaign launched: {campaign_name}",
            related_id=campaign_id,
            exclude_profile_id=profile["id"],
        )
    except Exception:
        pass

    # Directly process campaign sends — don't rely on APScheduler (lifespan="off" on Lambda)
    try:
        from app.jobs.email_scheduler import process_campaign_sends
        await process_campaign_sends()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to trigger immediate campaign processing: {e}")

    return result


@router.get("/campaigns/{campaign_id}/senders")
async def get_campaign_senders(
    campaign_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """List sender accounts and their send counts for a campaign."""
    senders = execute_query(
        """
        SELECT cs.id, cs.account_id, cs.send_count,
               a.email_address, a.display_name, a.is_active
        FROM crm_campaign_senders cs
        JOIN crm_email_accounts a ON a.id = cs.account_id
        WHERE cs.campaign_id = :cid
        ORDER BY cs.created_at ASC
        """,
        {"cid": campaign_id},
    )
    return {"senders": senders}


@router.put("/campaigns/{campaign_id}/senders")
async def update_campaign_senders(
    campaign_id: str,
    data: CampaignSendersUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Set sender accounts for a campaign (replaces existing)."""
    existing = execute_single(
        "SELECT status FROM crm_email_campaigns WHERE id = :id",
        {"id": campaign_id},
    )
    if not existing:
        raise HTTPException(404, "Campaign not found")
    if existing["status"] not in ("draft", "scheduled"):
        raise HTTPException(400, "Can only modify senders for draft or scheduled campaigns")

    # Remove existing and re-add
    execute_delete(
        "DELETE FROM crm_campaign_senders WHERE campaign_id = :cid",
        {"cid": campaign_id},
    )
    for account_id in data.account_ids:
        execute_insert(
            "INSERT INTO crm_campaign_senders (campaign_id, account_id) VALUES (:cid, :aid) ON CONFLICT DO NOTHING RETURNING id",
            {"cid": campaign_id, "aid": account_id},
        )

    # Return updated senders
    senders = execute_query(
        """
        SELECT cs.id, cs.account_id, cs.send_count,
               a.email_address, a.display_name, a.is_active
        FROM crm_campaign_senders cs
        JOIN crm_email_accounts a ON a.id = cs.account_id
        WHERE cs.campaign_id = :cid
        ORDER BY cs.created_at ASC
        """,
        {"cid": campaign_id},
    )
    return {"senders": senders}


ALLOWED_ROLE_FIELDS = {
    "is_filmmaker", "is_partner", "is_order_member", "is_premium",
    "is_sales_agent", "is_sales_rep", "is_media_team", "is_admin",
}


@router.get("/campaigns/{campaign_id}/preview-targeting")
async def preview_campaign_targeting(
    campaign_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Preview targeting results — per-source counts + samples with deduplication."""
    campaign = execute_single(
        """SELECT target_temperature, target_tags, source_crm_contacts, source_manual_emails,
                  source_site_users, manual_recipients, target_roles, target_subscription_tiers
           FROM crm_email_campaigns WHERE id = :id""",
        {"id": campaign_id},
    )
    if not campaign:
        raise HTTPException(404, "Campaign not found")

    seen_emails = set()
    sources = {}

    # --- Source 1: CRM Contacts ---
    if campaign.get("source_crm_contacts", True):
        conditions = ["c.do_not_email IS NOT TRUE", "c.email IS NOT NULL"]
        params = {}

        if campaign.get("target_temperature") and len(campaign["target_temperature"]) > 0:
            conditions.append("c.temperature = ANY(:temps)")
            params["temps"] = campaign["target_temperature"]

        if campaign.get("target_tags") and len(campaign["target_tags"]) > 0:
            conditions.append("c.tags && :tags")
            params["tags"] = campaign["target_tags"]

        where_clause = " AND ".join(conditions)

        crm_contacts = execute_query(
            f"""
            SELECT c.id, c.first_name, c.last_name, c.email, c.company, c.temperature
            FROM crm_contacts c
            WHERE {where_clause}
            ORDER BY c.created_at DESC
            """,
            params,
        )

        crm_unique = []
        for c in crm_contacts:
            email_lower = (c.get("email") or "").lower().strip()
            if email_lower and email_lower not in seen_emails:
                seen_emails.add(email_lower)
                crm_unique.append(c)

        sources["crm_contacts"] = {
            "count": len(crm_unique),
            "sample": crm_unique[:10],
        }

    # --- Source 2: Manual Emails ---
    if campaign.get("source_manual_emails"):
        import json
        raw = campaign.get("manual_recipients") or []
        if isinstance(raw, str):
            raw = json.loads(raw)

        # Check DNC for each manual email
        manual_unique = []
        for entry in raw:
            email = (entry.get("email") or "").lower().strip()
            if not email or email in seen_emails:
                continue
            # DNC check
            dnc = execute_single(
                "SELECT id FROM crm_contacts WHERE LOWER(email) = :email AND (do_not_email = true OR status = 'do_not_contact')",
                {"email": email},
            )
            if not dnc:
                seen_emails.add(email)
                manual_unique.append({
                    "email": email,
                    "first_name": entry.get("first_name", ""),
                    "last_name": entry.get("last_name", ""),
                    "company": entry.get("company", ""),
                })

        sources["manual_emails"] = {
            "count": len(manual_unique),
            "sample": manual_unique[:10],
        }

    # --- Source 3: Site Users ---
    if campaign.get("source_site_users"):
        conditions = ["p.email IS NOT NULL"]
        params = {}

        # Role filters — whitelist column names to prevent injection
        target_roles = campaign.get("target_roles") or []
        role_conditions = []
        for role in target_roles:
            if role in ALLOWED_ROLE_FIELDS:
                role_conditions.append(f"p.{role} = true")
        if role_conditions:
            conditions.append(f"({' OR '.join(role_conditions)})")

        # Subscription tier filters
        target_tiers = campaign.get("target_subscription_tiers") or []
        if target_tiers:
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM organization_members om
                    JOIN organizations o ON o.id = om.organization_id
                    JOIN organization_tiers ot ON ot.id = o.tier_id
                    WHERE om.profile_id = p.id AND LOWER(ot.name) = ANY(:tiers)
                )
            """)
            params["tiers"] = [t.lower() for t in target_tiers]

        # Exclude DNC contacts
        conditions.append("""
            NOT EXISTS (
                SELECT 1 FROM crm_contacts dnc
                WHERE LOWER(dnc.email) = LOWER(p.email)
                AND (dnc.do_not_email = true OR dnc.status = 'do_not_contact')
            )
        """)

        where_clause = " AND ".join(conditions)

        site_users = execute_query(
            f"""
            SELECT p.id, p.full_name, p.email
            FROM profiles p
            WHERE {where_clause}
            ORDER BY p.created_at DESC
            """,
            params,
        )

        site_unique = []
        for u in site_users:
            email_lower = (u.get("email") or "").lower().strip()
            if email_lower and email_lower not in seen_emails:
                seen_emails.add(email_lower)
                parts = (u.get("full_name") or "").split(" ", 1)
                site_unique.append({
                    "id": u["id"],
                    "first_name": parts[0] if parts else "",
                    "last_name": parts[1] if len(parts) > 1 else "",
                    "email": u["email"],
                    "company": "",
                })

        sources["site_users"] = {
            "count": len(site_unique),
            "sample": site_unique[:10],
        }

    # Totals
    total_unique = sum(s["count"] for s in sources.values())
    total_raw = (
        (sources.get("crm_contacts", {}).get("count", 0))
        + (sources.get("manual_emails", {}).get("count", 0))
        + (sources.get("site_users", {}).get("count", 0))
    )
    # Note: duplicates_removed = total across sources before cross-source dedup minus total_unique
    # Since we dedup as we go, raw counts per source are already after cross-source dedup.
    # To show meaningful dedup count, we'd need raw counts before dedup. For now, report 0.

    return {
        "total": total_unique,
        "sources": sources,
        "duplicates_removed": 0,
        # Legacy compat: include sample from all sources
        "sample": (
            sources.get("crm_contacts", {}).get("sample", [])
            + sources.get("manual_emails", {}).get("sample", [])
            + sources.get("site_users", {}).get("sample", [])
        )[:10],
    }


# ============================================================================
# DNC List
# ============================================================================

@router.get("/dnc-list")
async def get_dnc_list(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get the full Do Not Contact list."""
    count_row = execute_single(
        """
        SELECT COUNT(*) as total FROM crm_contacts
        WHERE status = 'do_not_contact' OR do_not_email = true OR do_not_call = true OR do_not_text = true
        """,
        {},
    )

    rows = execute_query(
        """
        SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.company,
               c.status, c.do_not_email, c.do_not_call, c.do_not_text,
               p.full_name as assigned_rep_name
        FROM crm_contacts c
        LEFT JOIN profiles p ON p.id = c.assigned_rep_id
        WHERE c.status = 'do_not_contact' OR c.do_not_email = true OR c.do_not_call = true OR c.do_not_text = true
        ORDER BY c.last_name ASC, c.first_name ASC
        LIMIT :limit OFFSET :offset
        """,
        {"limit": limit, "offset": offset},
    )

    return {"contacts": rows, "total": count_row["total"] if count_row else 0}


# ============================================================================
# Email Account Management (Admin)
# ============================================================================

class EmailTemplateCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    category: str = "general"
    placeholders: Optional[List[str]] = []


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    category: Optional[str] = None
    placeholders: Optional[List[str]] = None
    is_active: Optional[bool] = None


class CreateEmailAccountRequest(BaseModel):
    profile_id: str
    email_address: str     # firstname.lastname@theswn.com
    display_name: str      # "John Smith"


@router.post("/email/accounts")
async def create_email_account(
    data: CreateEmailAccountRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Create an email account for a sales rep."""
    # Verify profile exists and is a sales agent
    target = execute_single(
        "SELECT id, full_name, is_sales_agent FROM profiles WHERE id = :pid",
        {"pid": data.profile_id},
    )
    if not target:
        raise HTTPException(404, "Profile not found")

    # Check for duplicate email address
    existing = execute_single(
        "SELECT id FROM crm_email_accounts WHERE email_address = :email",
        {"email": data.email_address},
    )
    if existing:
        raise HTTPException(409, "Email address already in use")

    # Check for existing account for this profile
    existing_acct = execute_single(
        "SELECT id FROM crm_email_accounts WHERE profile_id = :pid AND is_active = true",
        {"pid": data.profile_id},
    )
    if existing_acct:
        raise HTTPException(409, "Profile already has an active email account")

    result = execute_insert(
        """
        INSERT INTO crm_email_accounts (profile_id, email_address, display_name)
        VALUES (:pid, :email, :name) RETURNING *
        """,
        {"pid": data.profile_id, "email": data.email_address, "name": data.display_name},
    )
    return result


@router.get("/email/accounts")
async def list_email_accounts(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """List all rep email accounts."""
    rows = execute_query(
        """
        SELECT a.*, p.full_name as profile_name, p.email as profile_email, p.avatar_url
        FROM crm_email_accounts a
        JOIN profiles p ON p.id = a.profile_id
        ORDER BY a.display_name ASC
        """,
        {},
    )
    return {"accounts": rows}


@router.delete("/email/accounts/{account_id}")
async def deactivate_email_account(
    account_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Deactivate an email account (soft delete)."""
    result = execute_single(
        "UPDATE crm_email_accounts SET is_active = false WHERE id = :id RETURNING *",
        {"id": account_id},
    )
    if not result:
        raise HTTPException(404, "Account not found")
    return result


# ============================================================================
# Email Templates (Admin)
# ============================================================================

@router.post("/email/templates")
async def create_email_template(
    data: EmailTemplateCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Create an email template."""
    result = execute_insert(
        """
        INSERT INTO crm_email_templates (name, subject, body_html, body_text, category, placeholders, created_by)
        VALUES (:name, :subject, :body_html, :body_text, :category, :placeholders, :created_by)
        RETURNING *
        """,
        {
            "name": data.name,
            "subject": data.subject,
            "body_html": data.body_html,
            "body_text": data.body_text,
            "category": data.category,
            "placeholders": data.placeholders or [],
            "created_by": profile["id"],
        },
    )
    return result


@router.put("/email/templates/{template_id}")
async def update_email_template(
    template_id: str,
    data: EmailTemplateUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Update an email template."""
    existing = execute_single(
        "SELECT id FROM crm_email_templates WHERE id = :id",
        {"id": template_id},
    )
    if not existing:
        raise HTTPException(404, "Template not found")

    update_data = data.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(400, "No fields to update")

    set_clauses = []
    params = {"id": template_id}
    for key, value in update_data.items():
        set_clauses.append(f"{key} = :{key}")
        params[key] = value

    set_clauses.append("updated_at = NOW()")

    result = execute_single(
        f"UPDATE crm_email_templates SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    return result


@router.delete("/email/templates/{template_id}")
async def delete_email_template(
    template_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Deactivate an email template (soft delete)."""
    result = execute_single(
        "UPDATE crm_email_templates SET is_active = false, updated_at = NOW() WHERE id = :id RETURNING *",
        {"id": template_id},
    )
    if not result:
        raise HTTPException(404, "Template not found")
    return result


# ============================================================================
# Email Analytics (Admin)
# ============================================================================

@router.get("/email/analytics")
async def get_email_analytics(
    days: int = Query(30, ge=1, le=365),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get email analytics for the admin dashboard."""
    # Daily volume pivoted: one row per date with sent + received columns
    daily_volume = execute_query(
        """
        SELECT DATE(m.created_at)::text as date,
               COUNT(*) FILTER (WHERE m.direction = 'outbound') as sent,
               COUNT(*) FILTER (WHERE m.direction = 'inbound') as received
        FROM crm_email_messages m
        WHERE m.created_at >= NOW() - (:days || ' days')::interval
              AND m.status NOT IN ('scheduled', 'cancelled')
              AND COALESCE(m.source_type, 'manual') NOT IN ('internal', 'warmup')
        GROUP BY DATE(m.created_at)
        ORDER BY date ASC
        """,
        {"days": days},
    )

    # Emails by rep — include rep_id and avatar_url for clickable drill-down
    rep_breakdown = execute_query(
        """
        SELECT a.display_name as rep_name,
               a.profile_id::text as rep_id,
               a.avatar_url,
               COUNT(*) FILTER (WHERE m.direction = 'outbound') as sent,
               COUNT(*) FILTER (WHERE m.direction = 'inbound') as received
        FROM crm_email_messages m
        JOIN crm_email_threads t ON t.id = m.thread_id
        JOIN crm_email_accounts a ON a.id = t.account_id
        WHERE m.created_at >= NOW() - (:days || ' days')::interval
              AND m.status NOT IN ('scheduled', 'cancelled')
              AND COALESCE(m.source_type, 'manual') NOT IN ('internal', 'warmup')
        GROUP BY a.display_name, a.profile_id, a.avatar_url
        ORDER BY sent DESC
        """,
        {"days": days},
    )

    # Totals
    totals = execute_single(
        """
        SELECT
            COUNT(*) FILTER (WHERE m.direction = 'outbound') as total_sent,
            COUNT(*) FILTER (WHERE m.direction = 'inbound') as total_received,
            COUNT(*) as total_messages
        FROM crm_email_messages m
        WHERE m.created_at >= NOW() - (:days || ' days')::interval
              AND m.status NOT IN ('scheduled', 'cancelled')
              AND COALESCE(m.source_type, 'manual') NOT IN ('internal', 'warmup')
        """,
        {"days": days},
    )

    # Average response time (seconds → convert to minutes in response)
    avg_response = execute_single(
        """
        SELECT AVG(response_seconds)::int as avg_response_seconds
        FROM (
            SELECT EXTRACT(EPOCH FROM (
                (SELECT MIN(m2.created_at) FROM crm_email_messages m2
                 WHERE m2.thread_id = m.thread_id AND m2.direction = 'outbound'
                 AND m2.created_at > m.created_at
                 AND COALESCE(m2.source_type, 'manual') NOT IN ('internal', 'warmup'))
                - m.created_at
            )) as response_seconds
            FROM crm_email_messages m
            WHERE m.direction = 'inbound'
                  AND m.created_at >= NOW() - (:days || ' days')::interval
                  AND COALESCE(m.source_type, 'manual') NOT IN ('internal', 'warmup')
        ) sub
        WHERE response_seconds IS NOT NULL AND response_seconds > 0
        """,
        {"days": days},
    )

    avg_seconds = avg_response["avg_response_seconds"] if avg_response and avg_response.get("avg_response_seconds") else None
    avg_minutes = round(avg_seconds / 60, 1) if avg_seconds else None

    t = totals or {}
    return {
        "stats": {
            "total_sent": t.get("total_sent", 0),
            "total_received": t.get("total_received", 0),
            "avg_response_time_minutes": avg_minutes,
        },
        "daily_volume": daily_volume,
        "rep_breakdown": rep_breakdown,
    }


# ============================================================================
# Email Rep Drill-Down
# ============================================================================

@router.get("/email/reps/{rep_id}/messages")
async def get_rep_email_messages(
    rep_id: str,
    direction: Optional[str] = Query(None, regex="^(inbound|outbound)$"),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get email messages for a specific rep (admin drill-down)."""
    conditions = [
        "a.profile_id = :rep_id",
        "m.created_at >= NOW() - (:days || ' days')::interval",
        "m.status NOT IN ('scheduled', 'cancelled')",
    ]
    params: Dict[str, Any] = {"rep_id": rep_id, "days": days, "limit": limit, "offset": offset}

    if direction:
        conditions.append("m.direction = :direction")
        params["direction"] = direction

    where = " AND ".join(conditions)

    messages = execute_query(
        f"""
        SELECT m.id, m.direction, m.from_address, m.to_addresses, m.subject,
               m.body_text, m.body_html, m.created_at, m.status, m.source_type,
               t.id as thread_id, t.contact_email, t.contact_id,
               c.first_name as contact_first_name, c.last_name as contact_last_name
        FROM crm_email_messages m
        JOIN crm_email_threads t ON t.id = m.thread_id
        JOIN crm_email_accounts a ON a.id = t.account_id
        LEFT JOIN crm_contacts c ON c.id = t.contact_id
        WHERE {where}
        ORDER BY m.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params,
    )

    total = execute_single(
        f"""
        SELECT COUNT(*) as count
        FROM crm_email_messages m
        JOIN crm_email_threads t ON t.id = m.thread_id
        JOIN crm_email_accounts a ON a.id = t.account_id
        WHERE {where}
        """,
        {k: v for k, v in params.items() if k not in ("limit", "offset")},
    )

    return {
        "messages": messages,
        "total": total["count"] if total else 0,
    }


# ============================================================================
# Email Sequences (Admin CRUD)
# ============================================================================

class SequenceCreate(BaseModel):
    name: str
    description: Optional[str] = None


class SequenceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SequenceStepCreate(BaseModel):
    step_number: int
    delay_days: int = 0
    template_id: Optional[str] = None
    subject: str
    body_html: str


class SequenceStepUpdate(BaseModel):
    delay_days: Optional[int] = None
    template_id: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None


@router.get("/email/sequences")
async def admin_list_sequences(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """List all sequences (admin)."""
    rows = execute_query(
        """
        SELECT s.*, p.full_name as created_by_name,
               (SELECT COUNT(*) FROM crm_email_sequence_steps st WHERE st.sequence_id = s.id) as step_count,
               (SELECT COUNT(*) FROM crm_email_sequence_enrollments e WHERE e.sequence_id = s.id AND e.status = 'active') as active_enrollments,
               (SELECT COUNT(*) FROM crm_email_sequence_enrollments e WHERE e.sequence_id = s.id) as total_enrollments
        FROM crm_email_sequences s
        JOIN profiles p ON p.id = s.created_by
        ORDER BY s.created_at DESC
        """,
        {},
    )
    return {"sequences": rows}


@router.post("/email/sequences")
async def create_sequence(
    data: SequenceCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Create a new email sequence."""
    result = execute_single(
        "INSERT INTO crm_email_sequences (name, description, created_by) VALUES (:name, :desc, :created_by) RETURNING *",
        {"name": data.name, "desc": data.description, "created_by": profile["id"]},
    )
    return result


@router.get("/email/sequences/{sequence_id}")
async def get_sequence(
    sequence_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Get a sequence with its steps."""
    sequence = execute_single(
        """
        SELECT s.*, p.full_name as created_by_name
        FROM crm_email_sequences s
        JOIN profiles p ON p.id = s.created_by
        WHERE s.id = :id
        """,
        {"id": sequence_id},
    )
    if not sequence:
        raise HTTPException(404, "Sequence not found")

    steps = execute_query(
        "SELECT * FROM crm_email_sequence_steps WHERE sequence_id = :sid ORDER BY step_number ASC",
        {"sid": sequence_id},
    )

    enrollments = execute_query(
        """
        SELECT e.*, c.first_name, c.last_name, c.email as contact_email,
               p.full_name as enrolled_by_name
        FROM crm_email_sequence_enrollments e
        JOIN crm_contacts c ON c.id = e.contact_id
        JOIN profiles p ON p.id = e.enrolled_by
        WHERE e.sequence_id = :sid
        ORDER BY e.enrolled_at DESC
        LIMIT 50
        """,
        {"sid": sequence_id},
    )

    return {"sequence": sequence, "steps": steps, "enrollments": enrollments}


@router.put("/email/sequences/{sequence_id}")
async def update_sequence(
    sequence_id: str,
    data: SequenceUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Update a sequence."""
    updates = data.dict(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    set_clauses = [f"{k} = :{k}" for k in updates]
    set_clauses.append("updated_at = NOW()")
    params = {"id": sequence_id, **updates}
    result = execute_single(
        f"UPDATE crm_email_sequences SET {', '.join(set_clauses)} WHERE id = :id RETURNING *",
        params,
    )
    if not result:
        raise HTTPException(404, "Sequence not found")
    return result


@router.delete("/email/sequences/{sequence_id}")
async def delete_sequence(
    sequence_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Delete a sequence (cascades to steps and stops enrollments)."""
    # Stop active enrollments first
    execute_query(
        "UPDATE crm_email_sequence_enrollments SET status = 'unsubscribed', completed_at = NOW() WHERE sequence_id = :sid AND status = 'active' RETURNING id",
        {"sid": sequence_id},
    )
    result = execute_single(
        "DELETE FROM crm_email_sequences WHERE id = :id RETURNING id",
        {"id": sequence_id},
    )
    if not result:
        raise HTTPException(404, "Sequence not found")
    return {"success": True}


@router.post("/email/sequences/{sequence_id}/steps")
async def create_sequence_step(
    sequence_id: str,
    data: SequenceStepCreate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Add a step to a sequence."""
    result = execute_single(
        """
        INSERT INTO crm_email_sequence_steps (sequence_id, step_number, delay_days, template_id, subject, body_html)
        VALUES (:sid, :step, :delay, :template_id, :subject, :body_html) RETURNING *
        """,
        {"sid": sequence_id, "step": data.step_number, "delay": data.delay_days,
         "template_id": data.template_id, "subject": data.subject, "body_html": data.body_html},
    )
    return result


@router.put("/email/sequences/{sequence_id}/steps/{step_id}")
async def update_sequence_step(
    sequence_id: str,
    step_id: str,
    data: SequenceStepUpdate,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Update a sequence step."""
    updates = data.dict(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    set_clauses = [f"{k} = :{k}" for k in updates]
    params = {"id": step_id, "sid": sequence_id, **updates}
    result = execute_single(
        f"UPDATE crm_email_sequence_steps SET {', '.join(set_clauses)} WHERE id = :id AND sequence_id = :sid RETURNING *",
        params,
    )
    if not result:
        raise HTTPException(404, "Step not found")
    return result


@router.delete("/email/sequences/{sequence_id}/steps/{step_id}")
async def delete_sequence_step(
    sequence_id: str,
    step_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.CRM_MANAGE)),
):
    """Delete a sequence step."""
    result = execute_single(
        "DELETE FROM crm_email_sequence_steps WHERE id = :id AND sequence_id = :sid RETURNING id",
        {"id": step_id, "sid": sequence_id},
    )
    if not result:
        raise HTTPException(404, "Step not found")
    return {"success": True}
