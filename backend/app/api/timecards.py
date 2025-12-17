"""
Timecards API - Per-project timecard system for crew time tracking
Supports weekly timecards with daily entries, submission, and approval workflow
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from app.core.supabase import get_supabase_admin_client

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class TimecardEntry(BaseModel):
    id: str
    timecard_id: str
    project_id: str
    shoot_date: str
    production_day_id: Optional[str] = None
    call_time: Optional[str] = None
    wrap_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    meal_break_minutes: int = 0
    hours_worked: Optional[float] = None
    overtime_hours: Optional[float] = None
    double_time_hours: Optional[float] = None
    department: Optional[str] = None
    position: Optional[str] = None
    rate_type: Optional[str] = None
    rate_amount: Optional[float] = None
    location_name: Optional[str] = None
    is_holiday: bool = False
    is_travel_day: bool = False
    is_prep_day: bool = False
    is_wrap_day: bool = False
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class Timecard(BaseModel):
    id: str
    project_id: str
    user_id: str
    week_start_date: str
    status: str  # draft, submitted, approved, rejected
    submitted_at: Optional[str] = None
    submitted_by_user_id: Optional[str] = None
    approved_at: Optional[str] = None
    approved_by_user_id: Optional[str] = None
    rejected_at: Optional[str] = None
    rejected_by_user_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    # Computed
    total_hours: float = 0
    total_overtime: float = 0
    entry_count: int = 0


class TimecardWithEntries(Timecard):
    entries: List[TimecardEntry] = []
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None


class TimecardListItem(BaseModel):
    id: str
    week_start_date: str
    status: str
    total_hours: float = 0
    total_overtime: float = 0
    entry_count: int = 0
    user_id: Optional[str] = None
    user_name: Optional[str] = None


class CreateTimecardRequest(BaseModel):
    week_start_date: str  # YYYY-MM-DD (should be a Monday)


class CreateEntryRequest(BaseModel):
    shoot_date: str  # YYYY-MM-DD
    call_time: Optional[str] = None
    wrap_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    meal_break_minutes: Optional[int] = None
    hours_worked: Optional[float] = None
    overtime_hours: Optional[float] = None
    double_time_hours: Optional[float] = None
    department: Optional[str] = None
    position: Optional[str] = None
    rate_type: Optional[str] = None
    rate_amount: Optional[float] = None
    location_name: Optional[str] = None
    is_holiday: Optional[bool] = None
    is_travel_day: Optional[bool] = None
    is_prep_day: Optional[bool] = None
    is_wrap_day: Optional[bool] = None
    notes: Optional[str] = None


class ApproveRejectRequest(BaseModel):
    reason: Optional[str] = None  # Required for rejection


class TimecardSummary(BaseModel):
    total_timecards: int = 0
    draft_count: int = 0
    submitted_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    total_hours: float = 0
    total_overtime_hours: float = 0


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")
    supabase = get_supabase_admin_client()

    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user_response.user.id, "email": user_response.user.email}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_member(supabase, project_id: str, user_id: str) -> bool:
    """Verify user is a member of the project"""
    # Check owner
    project_resp = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and project_resp.data[0]["owner_id"] == user_id:
        return True

    # Check membership
    member_resp = supabase.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    return bool(member_resp.data)


async def can_approve_timecards(supabase, project_id: str, user_id: str) -> bool:
    """Check if user can approve/reject timecards"""
    # Check owner
    project_resp = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and project_resp.data[0]["owner_id"] == user_id:
        return True

    # Check for showrunner/producer role
    role_resp = supabase.table("backlot_project_roles").select("backlot_role").eq("project_id", project_id).eq("user_id", user_id).execute()
    for role in (role_resp.data or []):
        if role.get("backlot_role") in ["showrunner", "producer"]:
            return True

    # Check admin member
    member_resp = supabase.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
    if member_resp.data and member_resp.data[0].get("role") == "admin":
        return True

    return False


def calculate_hours(call_time: str, wrap_time: str, meal_break_minutes: int = 0) -> Optional[float]:
    """Calculate hours worked from call and wrap times"""
    if not call_time or not wrap_time:
        return None

    try:
        # Parse times (assuming ISO format with timezone or just time)
        call_dt = datetime.fromisoformat(call_time.replace("Z", "+00:00"))
        wrap_dt = datetime.fromisoformat(wrap_time.replace("Z", "+00:00"))

        total_minutes = (wrap_dt - call_dt).total_seconds() / 60
        total_minutes -= meal_break_minutes or 0

        return round(total_minutes / 60, 2)
    except:
        return None


def get_week_start(date_str: str) -> str:
    """Get Monday of the week for a given date"""
    d = datetime.strptime(date_str, "%Y-%m-%d").date()
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/timecards/me", response_model=List[TimecardListItem])
async def list_my_timecards(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    authorization: str = Header(None)
):
    """
    List current user's timecards for a project
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get timecards
    query = supabase.table("backlot_timecards").select("*").eq("project_id", project_id).eq("user_id", user["id"])

    if status:
        query = query.eq("status", status)

    tc_resp = query.order("week_start_date", desc=True).execute()
    timecards = tc_resp.data or []

    # Get entry stats for each timecard
    result = []
    for tc in timecards:
        entries_resp = supabase.table("backlot_timecard_entries").select("hours_worked, overtime_hours").eq("timecard_id", tc["id"]).execute()
        entries = entries_resp.data or []
        total_hours = sum(e.get("hours_worked", 0) or 0 for e in entries)
        total_overtime = sum(e.get("overtime_hours", 0) or 0 for e in entries)

        result.append(TimecardListItem(
            id=tc["id"],
            week_start_date=tc.get("week_start_date", ""),
            status=tc.get("status", "draft"),
            total_hours=round(total_hours, 2),
            total_overtime=round(total_overtime, 2),
            entry_count=len(entries),
        ))

    return result


@router.get("/projects/{project_id}/timecards/review", response_model=List[TimecardListItem])
async def list_timecards_for_review(
    project_id: str,
    status: Optional[str] = Query(None, description="Filter by status (defaults to submitted)"),
    department: Optional[str] = Query(None, description="Filter by department"),
    authorization: str = Header(None)
):
    """
    List timecards for review (showrunner/producer/admin only)
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await can_approve_timecards(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to review timecards")

    # Get timecards with user info
    query = supabase.table("backlot_timecards").select(
        "*, profiles:user_id(full_name, avatar_url)"
    ).eq("project_id", project_id)

    if status:
        query = query.eq("status", status)
    else:
        query = query.in_("status", ["submitted", "approved", "rejected"])

    tc_resp = query.order("week_start_date", desc=True).execute()
    timecards = tc_resp.data or []

    result = []
    for tc in timecards:
        profile = tc.get("profiles") or {}

        # Get entry stats
        entries_resp = supabase.table("backlot_timecard_entries").select("hours_worked, overtime_hours, department").eq("timecard_id", tc["id"]).execute()
        entries = entries_resp.data or []

        # Filter by department if specified
        if department:
            entries = [e for e in entries if e.get("department") == department]
            if not entries:
                continue

        total_hours = sum(e.get("hours_worked", 0) or 0 for e in entries)
        total_overtime = sum(e.get("overtime_hours", 0) or 0 for e in entries)

        result.append(TimecardListItem(
            id=tc["id"],
            week_start_date=tc.get("week_start_date", ""),
            status=tc.get("status", "draft"),
            total_hours=round(total_hours, 2),
            total_overtime=round(total_overtime, 2),
            entry_count=len(entries),
            user_id=tc.get("user_id"),
            user_name=profile.get("full_name"),
        ))

    return result


@router.get("/projects/{project_id}/timecards/{timecard_id}", response_model=TimecardWithEntries)
async def get_timecard(
    project_id: str,
    timecard_id: str,
    authorization: str = Header(None)
):
    """
    Get a timecard with all entries
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    # Get timecard
    tc_resp = supabase.table("backlot_timecards").select(
        "*, profiles:user_id(full_name, avatar_url)"
    ).eq("id", timecard_id).eq("project_id", project_id).execute()

    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    profile = tc.get("profiles") or {}

    # Check access (owner or can approve)
    if tc["user_id"] != user["id"] and not await can_approve_timecards(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get entries
    entries_resp = supabase.table("backlot_timecard_entries").select("*").eq("timecard_id", timecard_id).order("shoot_date").execute()
    entries = [TimecardEntry(**e) for e in (entries_resp.data or [])]

    total_hours = sum(e.hours_worked or 0 for e in entries)
    total_overtime = sum(e.overtime_hours or 0 for e in entries)

    return TimecardWithEntries(
        id=tc["id"],
        project_id=tc["project_id"],
        user_id=tc["user_id"],
        week_start_date=tc.get("week_start_date", ""),
        status=tc.get("status", "draft"),
        submitted_at=tc.get("submitted_at"),
        submitted_by_user_id=tc.get("submitted_by_user_id"),
        approved_at=tc.get("approved_at"),
        approved_by_user_id=tc.get("approved_by_user_id"),
        rejected_at=tc.get("rejected_at"),
        rejected_by_user_id=tc.get("rejected_by_user_id"),
        rejection_reason=tc.get("rejection_reason"),
        notes=tc.get("notes"),
        created_at=tc.get("created_at", ""),
        updated_at=tc.get("updated_at", ""),
        total_hours=round(total_hours, 2),
        total_overtime=round(total_overtime, 2),
        entry_count=len(entries),
        entries=entries,
        user_name=profile.get("full_name"),
        user_avatar=profile.get("avatar_url"),
    )


@router.post("/projects/{project_id}/timecards", response_model=Timecard)
async def create_or_get_timecard(
    project_id: str,
    request: CreateTimecardRequest,
    authorization: str = Header(None)
):
    """
    Create a new timecard or return existing one for the week
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Normalize to Monday
    week_start = get_week_start(request.week_start_date)

    # Check for existing timecard
    existing_resp = supabase.table("backlot_timecards").select("*").eq("project_id", project_id).eq("user_id", user["id"]).eq("week_start_date", week_start).execute()

    if existing_resp.data:
        tc = existing_resp.data[0]
        # Get entry stats
        entries_resp = supabase.table("backlot_timecard_entries").select("hours_worked, overtime_hours").eq("timecard_id", tc["id"]).execute()
        entries = entries_resp.data or []
        return Timecard(
            **tc,
            total_hours=sum(e.get("hours_worked", 0) or 0 for e in entries),
            total_overtime=sum(e.get("overtime_hours", 0) or 0 for e in entries),
            entry_count=len(entries),
        )

    # Create new timecard
    new_tc = {
        "project_id": project_id,
        "user_id": user["id"],
        "week_start_date": week_start,
        "status": "draft",
    }

    create_resp = supabase.table("backlot_timecards").insert(new_tc).execute()
    if not create_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create timecard")

    tc = create_resp.data[0]
    return Timecard(**tc, total_hours=0, total_overtime=0, entry_count=0)


@router.post("/projects/{project_id}/timecards/{timecard_id}/entries", response_model=TimecardEntry)
async def create_or_update_entry(
    project_id: str,
    timecard_id: str,
    request: CreateEntryRequest,
    authorization: str = Header(None)
):
    """
    Create or update a day entry on a timecard (upsert by shoot_date)
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    # Verify timecard ownership and status
    tc_resp = supabase.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own timecard")

    if tc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Cannot edit a submitted or approved timecard")

    # Calculate hours if call/wrap provided
    hours_worked = request.hours_worked
    if hours_worked is None and request.call_time and request.wrap_time:
        hours_worked = calculate_hours(request.call_time, request.wrap_time, request.meal_break_minutes or 0)

    # Check for existing entry for this date
    existing_resp = supabase.table("backlot_timecard_entries").select("*").eq("timecard_id", timecard_id).eq("shoot_date", request.shoot_date).execute()

    entry_data = {
        "timecard_id": timecard_id,
        "project_id": project_id,
        "shoot_date": request.shoot_date,
        "call_time": request.call_time,
        "wrap_time": request.wrap_time,
        "break_start": request.break_start,
        "break_end": request.break_end,
        "meal_break_minutes": request.meal_break_minutes or 0,
        "hours_worked": hours_worked,
        "overtime_hours": request.overtime_hours or 0,
        "double_time_hours": request.double_time_hours or 0,
        "department": request.department,
        "position": request.position,
        "rate_type": request.rate_type,
        "rate_amount": request.rate_amount,
        "location_name": request.location_name,
        "is_holiday": request.is_holiday or False,
        "is_travel_day": request.is_travel_day or False,
        "is_prep_day": request.is_prep_day or False,
        "is_wrap_day": request.is_wrap_day or False,
        "notes": request.notes,
    }

    # Try to find production day for this date
    pd_resp = supabase.table("backlot_production_days").select("id").eq("project_id", project_id).eq("date", request.shoot_date).execute()
    if pd_resp.data:
        entry_data["production_day_id"] = pd_resp.data[0]["id"]

    if existing_resp.data:
        # Update existing
        entry_id = existing_resp.data[0]["id"]
        update_resp = supabase.table("backlot_timecard_entries").update(entry_data).eq("id", entry_id).execute()
        if not update_resp.data:
            raise HTTPException(status_code=500, detail="Failed to update entry")
        return TimecardEntry(**update_resp.data[0])
    else:
        # Create new
        create_resp = supabase.table("backlot_timecard_entries").insert(entry_data).execute()
        if not create_resp.data:
            raise HTTPException(status_code=500, detail="Failed to create entry")
        return TimecardEntry(**create_resp.data[0])


@router.delete("/projects/{project_id}/timecards/{timecard_id}/entries/{entry_id}")
async def delete_entry(
    project_id: str,
    timecard_id: str,
    entry_id: str,
    authorization: str = Header(None)
):
    """
    Delete a timecard entry
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    # Verify timecard ownership and status
    tc_resp = supabase.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own timecard")

    if tc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Cannot edit a submitted or approved timecard")

    # Delete entry
    supabase.table("backlot_timecard_entries").delete().eq("id", entry_id).eq("timecard_id", timecard_id).execute()

    return {"success": True}


@router.post("/projects/{project_id}/timecards/{timecard_id}/submit")
async def submit_timecard(
    project_id: str,
    timecard_id: str,
    authorization: str = Header(None)
):
    """
    Submit a timecard for approval
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    # Verify timecard ownership
    tc_resp = supabase.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only submit your own timecard")

    if tc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Timecard has already been submitted")

    # Update status
    update_resp = supabase.table("backlot_timecards").update({
        "status": "submitted",
        "submitted_at": datetime.utcnow().isoformat(),
        "submitted_by_user_id": user["id"],
        "rejection_reason": None,  # Clear any previous rejection
    }).eq("id", timecard_id).execute()

    if not update_resp.data:
        raise HTTPException(status_code=500, detail="Failed to submit timecard")

    return {"success": True, "status": "submitted"}


@router.post("/projects/{project_id}/timecards/{timecard_id}/approve")
async def approve_timecard(
    project_id: str,
    timecard_id: str,
    authorization: str = Header(None)
):
    """
    Approve a submitted timecard
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await can_approve_timecards(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to approve timecards")

    # Verify timecard exists and is submitted
    tc_resp = supabase.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted timecards can be approved")

    # Update status
    update_resp = supabase.table("backlot_timecards").update({
        "status": "approved",
        "approved_at": datetime.utcnow().isoformat(),
        "approved_by_user_id": user["id"],
    }).eq("id", timecard_id).execute()

    if not update_resp.data:
        raise HTTPException(status_code=500, detail="Failed to approve timecard")

    return {"success": True, "status": "approved"}


@router.post("/projects/{project_id}/timecards/{timecard_id}/reject")
async def reject_timecard(
    project_id: str,
    timecard_id: str,
    request: ApproveRejectRequest,
    authorization: str = Header(None)
):
    """
    Reject a submitted timecard
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await can_approve_timecards(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to reject timecards")

    # Verify timecard exists and is submitted
    tc_resp = supabase.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted timecards can be rejected")

    # Update status
    update_resp = supabase.table("backlot_timecards").update({
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
        "rejected_by_user_id": user["id"],
        "rejection_reason": request.reason,
    }).eq("id", timecard_id).execute()

    if not update_resp.data:
        raise HTTPException(status_code=500, detail="Failed to reject timecard")

    return {"success": True, "status": "rejected"}


@router.get("/projects/{project_id}/timecards/summary", response_model=TimecardSummary)
async def get_timecard_summary(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get summary statistics for project timecards
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await can_approve_timecards(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all timecards
    tc_resp = supabase.table("backlot_timecards").select("id, status").eq("project_id", project_id).execute()
    timecards = tc_resp.data or []

    total = len(timecards)
    draft = len([t for t in timecards if t["status"] == "draft"])
    submitted = len([t for t in timecards if t["status"] == "submitted"])
    approved = len([t for t in timecards if t["status"] == "approved"])
    rejected = len([t for t in timecards if t["status"] == "rejected"])

    # Get hours totals
    tc_ids = [t["id"] for t in timecards]
    total_hours = 0
    total_overtime = 0

    if tc_ids:
        entries_resp = supabase.table("backlot_timecard_entries").select("hours_worked, overtime_hours").in_("timecard_id", tc_ids).execute()
        for entry in (entries_resp.data or []):
            total_hours += entry.get("hours_worked", 0) or 0
            total_overtime += entry.get("overtime_hours", 0) or 0

    return TimecardSummary(
        total_timecards=total,
        draft_count=draft,
        submitted_count=submitted,
        approved_count=approved,
        rejected_count=rejected,
        total_hours=round(total_hours, 2),
        total_overtime_hours=round(total_overtime, 2),
    )
