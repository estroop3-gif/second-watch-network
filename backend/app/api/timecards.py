"""
Timecards API - Per-project timecard system for crew time tracking
Supports weekly timecards with daily entries, submission, and approval workflow
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from app.core.database import get_client, execute_single

router = APIRouter()


def get_profile_id_from_cognito_id(cognito_user_id: str) -> str:
    """
    Look up the profile ID from a Cognito user ID.
    Returns the profile ID or None if not found.
    """
    uid_str = str(cognito_user_id)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid OR id::text = :uid LIMIT 1",
        {"cuid": uid_str, "uid": uid_str}
    )
    if not profile_row:
        return None
    return profile_row["id"]


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


class TimecardWarning(BaseModel):
    type: str  # missing_day, missing_times, overtime_exceeded, no_entries
    severity: str  # info, warning, error
    message: str
    date: Optional[str] = None


class TimecardPreviewEntry(BaseModel):
    date: str
    day_name: str
    call_time: Optional[str] = None
    wrap_time: Optional[str] = None
    hours_worked: Optional[float] = None
    overtime_hours: Optional[float] = None
    double_time_hours: Optional[float] = None
    is_travel_day: bool = False
    is_prep_day: bool = False
    is_wrap_day: bool = False
    is_holiday: bool = False
    has_entry: bool = False


class TimecardPreviewResponse(BaseModel):
    timecard_id: str
    week_start_date: str
    status: str
    total_hours: float = 0
    total_overtime: float = 0
    total_double_time: float = 0
    days_worked: int = 0
    entries: List[TimecardPreviewEntry] = []
    warnings: List[TimecardWarning] = []
    is_valid: bool = True
    can_submit: bool = True


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token, returning profile ID"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Look up profile ID from Cognito ID
        cognito_id = user.get("id")
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        return {"id": profile_id, "email": user.get("email"), "cognito_id": cognito_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_member(client, project_id: str, user_id: str) -> bool:
    """Verify user is a member of the project"""
    # Check owner
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and str(project_resp.data[0]["owner_id"]) == str(user_id):
        return True

    # Check membership
    member_resp = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    return bool(member_resp.data)


async def can_approve_timecards(client, project_id: str, user_id: str) -> bool:
    """Check if user can approve/reject timecards"""
    # Check owner
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and str(project_resp.data[0]["owner_id"]) == str(user_id):
        return True

    # Check for showrunner/producer role
    role_resp = client.table("backlot_project_roles").select("backlot_role").eq("project_id", project_id).eq("user_id", user_id).execute()
    for role in (role_resp.data or []):
        if role.get("backlot_role") in ["showrunner", "producer"]:
            return True

    # Check admin member
    member_resp = client.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
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
# UNION COMPLIANCE HELPERS
# =============================================================================

DEFAULT_UNION_SETTINGS = {
    "ot_threshold_hours": 8,      # Hours before overtime kicks in
    "dt_threshold_hours": 12,     # Hours before double-time kicks in
    "meal_penalty_hours": 6,      # Hours before meal break is required
    "turnaround_hours": 10,       # Minimum hours between wrap and next call
    "forced_call_premium": 1.5,   # Premium multiplier for forced call (violation of turnaround)
    "golden_time_multiplier": 2.0 # Multiplier for hours after 16 hours
}


def get_project_union_settings(client, project_id: str) -> Dict[str, Any]:
    """Get union mode and settings for a project"""
    resp = client.table("backlot_projects").select("union_mode, union_settings").eq("id", project_id).execute()
    if not resp.data:
        return {"union_mode": "non_union", "settings": DEFAULT_UNION_SETTINGS}

    project = resp.data[0]
    union_mode = project.get("union_mode") or "non_union"
    union_settings = project.get("union_settings") or {}

    # Merge with defaults
    settings = {**DEFAULT_UNION_SETTINGS, **union_settings}
    return {"union_mode": union_mode, "settings": settings}


def calculate_overtime_breakdown(
    hours_worked: float,
    union_mode: str,
    settings: Dict[str, Any]
) -> Dict[str, float]:
    """
    Calculate breakdown of regular, overtime, and double-time hours
    Returns: {"regular": X, "overtime": Y, "double_time": Z}
    """
    if union_mode == "non_union" or hours_worked is None:
        return {"regular": hours_worked or 0, "overtime": 0, "double_time": 0}

    ot_threshold = settings.get("ot_threshold_hours", 8)
    dt_threshold = settings.get("dt_threshold_hours", 12)

    if hours_worked <= ot_threshold:
        return {"regular": hours_worked, "overtime": 0, "double_time": 0}
    elif hours_worked <= dt_threshold:
        return {
            "regular": ot_threshold,
            "overtime": hours_worked - ot_threshold,
            "double_time": 0
        }
    else:
        return {
            "regular": ot_threshold,
            "overtime": dt_threshold - ot_threshold,
            "double_time": hours_worked - dt_threshold
        }


def check_meal_penalty(
    call_time: str,
    wrap_time: str,
    break_start: Optional[str],
    break_end: Optional[str],
    union_mode: str,
    settings: Dict[str, Any]
) -> int:
    """
    Check if meal penalties apply (union_full mode only)
    Returns number of meal penalties
    """
    if union_mode != "union_full":
        return 0

    if not call_time or not wrap_time:
        return 0

    try:
        meal_penalty_hours = settings.get("meal_penalty_hours", 6)
        call_dt = datetime.fromisoformat(call_time.replace("Z", "+00:00"))
        wrap_dt = datetime.fromisoformat(wrap_time.replace("Z", "+00:00"))
        total_hours = (wrap_dt - call_dt).total_seconds() / 3600

        # If no meal break recorded and worked more than threshold
        if total_hours > meal_penalty_hours:
            if not break_start or not break_end:
                return 1  # One meal penalty
            # Check if break was taken in time
            break_start_dt = datetime.fromisoformat(break_start.replace("Z", "+00:00"))
            hours_to_first_break = (break_start_dt - call_dt).total_seconds() / 3600
            if hours_to_first_break > meal_penalty_hours:
                return 1

        return 0
    except:
        return 0


def check_turnaround_violation(
    previous_wrap_time: Optional[str],
    call_time: Optional[str],
    union_mode: str,
    settings: Dict[str, Any]
) -> bool:
    """
    Check if turnaround violation occurred (union_full mode only)
    Returns True if violation
    """
    if union_mode != "union_full":
        return False

    if not previous_wrap_time or not call_time:
        return False

    try:
        turnaround_hours = settings.get("turnaround_hours", 10)
        prev_wrap_dt = datetime.fromisoformat(previous_wrap_time.replace("Z", "+00:00"))
        call_dt = datetime.fromisoformat(call_time.replace("Z", "+00:00"))
        rest_hours = (call_dt - prev_wrap_dt).total_seconds() / 3600

        return rest_hours < turnaround_hours
    except:
        return False


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
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get timecards
    query = client.table("backlot_timecards").select("*").eq("project_id", project_id).eq("user_id", user["id"])

    if status:
        query = query.eq("status", status)

    tc_resp = query.order("week_start_date", desc=True).execute()
    timecards = tc_resp.data or []

    # Get entry stats for each timecard
    result = []
    for tc in timecards:
        entries_resp = client.table("backlot_timecard_entries").select("hours_worked, overtime_hours").eq("timecard_id", tc["id"]).execute()
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
    client = get_client()

    if not await can_approve_timecards(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to review timecards")

    # Get timecards with user info
    query = client.table("backlot_timecards").select(
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
        entries_resp = client.table("backlot_timecard_entries").select("hours_worked, overtime_hours, department").eq("timecard_id", tc["id"]).execute()
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


@router.get("/projects/{project_id}/timecards/summary", response_model=TimecardSummary)
async def get_timecard_summary(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get summary statistics for project timecards
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await can_approve_timecards(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get all timecards
    tc_resp = client.table("backlot_timecards").select("id, status").eq("project_id", project_id).execute()
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
        entries_resp = client.table("backlot_timecard_entries").select("hours_worked, overtime_hours").in_("timecard_id", tc_ids).execute()
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
    client = get_client()

    # Get timecard
    tc_resp = client.table("backlot_timecards").select(
        "*, profiles:user_id(full_name, avatar_url)"
    ).eq("id", timecard_id).eq("project_id", project_id).execute()

    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    profile = tc.get("profiles") or {}

    # Check access (owner or can approve)
    if tc["user_id"] != user["id"] and not await can_approve_timecards(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get entries
    entries_resp = client.table("backlot_timecard_entries").select("*").eq("timecard_id", timecard_id).order("shoot_date").execute()
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
    client = get_client()

    if not await verify_project_member(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Normalize to Monday
    week_start = get_week_start(request.week_start_date)

    # Check for existing timecard
    existing_resp = client.table("backlot_timecards").select("*").eq("project_id", project_id).eq("user_id", user["id"]).eq("week_start_date", week_start).execute()

    if existing_resp.data:
        tc = existing_resp.data[0]
        # Get entry stats
        entries_resp = client.table("backlot_timecard_entries").select("hours_worked, overtime_hours").eq("timecard_id", tc["id"]).execute()
        entries = entries_resp.data or []
        # Remove computed fields from tc to avoid duplicate keyword arguments
        tc_clean = {k: v for k, v in tc.items() if k not in ('total_hours', 'total_overtime', 'entry_count')}
        return Timecard(
            **tc_clean,
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

    create_resp = client.table("backlot_timecards").insert(new_tc).execute()
    if not create_resp.data:
        raise HTTPException(status_code=500, detail="Failed to create timecard")

    tc = create_resp.data[0]
    # Remove computed fields from tc to avoid duplicate keyword arguments
    tc_clean = {k: v for k, v in tc.items() if k not in ('total_hours', 'total_overtime', 'entry_count')}
    return Timecard(**tc_clean, total_hours=0, total_overtime=0, entry_count=0)


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
    client = get_client()

    # Verify timecard ownership and status
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own timecard")

    if tc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Cannot edit a submitted or approved timecard")

    # Get union settings for project
    union_config = get_project_union_settings(client, project_id)
    union_mode = union_config["union_mode"]
    union_settings = union_config["settings"]

    # Calculate hours if call/wrap provided
    hours_worked = request.hours_worked
    if hours_worked is None and request.call_time and request.wrap_time:
        hours_worked = calculate_hours(request.call_time, request.wrap_time, request.meal_break_minutes or 0)

    # Calculate overtime breakdown based on union mode
    overtime_hours = request.overtime_hours or 0
    double_time_hours = request.double_time_hours or 0

    if union_mode != "non_union" and hours_worked:
        breakdown = calculate_overtime_breakdown(hours_worked, union_mode, union_settings)
        overtime_hours = breakdown["overtime"]
        double_time_hours = breakdown["double_time"]

    # Check for meal penalties (union_full mode)
    meal_penalty_count = check_meal_penalty(
        request.call_time,
        request.wrap_time,
        request.break_start,
        request.break_end,
        union_mode,
        union_settings
    )

    # Get previous day's wrap time to check turnaround violation
    previous_wrap_time = None
    turnaround_violation = False

    if union_mode == "union_full":
        try:
            prev_date = (datetime.strptime(request.shoot_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
            prev_entry_resp = client.table("backlot_timecard_entries").select("wrap_time").eq("timecard_id", timecard_id).eq("shoot_date", prev_date).execute()
            if prev_entry_resp.data and prev_entry_resp.data[0].get("wrap_time"):
                previous_wrap_time = prev_entry_resp.data[0]["wrap_time"]
                turnaround_violation = check_turnaround_violation(
                    previous_wrap_time,
                    request.call_time,
                    union_mode,
                    union_settings
                )
        except:
            pass

    # Check for existing entry for this date
    existing_resp = client.table("backlot_timecard_entries").select("*").eq("timecard_id", timecard_id).eq("shoot_date", request.shoot_date).execute()

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
        "overtime_hours": overtime_hours,
        "double_time_hours": double_time_hours,
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
        "meal_penalty_count": meal_penalty_count,
        "turnaround_violation": turnaround_violation,
        "previous_wrap_time": previous_wrap_time,
    }

    # Try to find production day for this date
    pd_resp = client.table("backlot_production_days").select("id").eq("project_id", project_id).eq("date", request.shoot_date).execute()
    if pd_resp.data:
        entry_data["production_day_id"] = pd_resp.data[0]["id"]

    if existing_resp.data:
        # Update existing
        entry_id = existing_resp.data[0]["id"]
        update_resp = client.table("backlot_timecard_entries").update(entry_data).eq("id", entry_id).execute()
        if not update_resp.data:
            raise HTTPException(status_code=500, detail="Failed to update entry")
        return TimecardEntry(**update_resp.data[0])
    else:
        # Create new
        create_resp = client.table("backlot_timecard_entries").insert(entry_data).execute()
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
    client = get_client()

    # Verify timecard ownership and status
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own timecard")

    if tc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Cannot edit a submitted or approved timecard")

    # Delete entry
    client.table("backlot_timecard_entries").delete().eq("id", entry_id).eq("timecard_id", timecard_id).execute()

    return {"success": True}


class ImportCheckinsRequest(BaseModel):
    overwrite_existing: bool = False


class ImportCheckinsResponse(BaseModel):
    imported_count: int = 0
    skipped_count: int = 0
    entries: List[dict] = []


@router.post("/projects/{project_id}/timecards/{timecard_id}/import-checkins", response_model=ImportCheckinsResponse)
async def import_checkins_to_timecard(
    project_id: str,
    timecard_id: str,
    request: ImportCheckinsRequest,
    authorization: str = Header(None)
):
    """
    Import check-in/check-out times into timecard entries
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify timecard ownership and status
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own timecard")

    if tc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Cannot edit a submitted or approved timecard")

    # Get the week dates for this timecard
    week_start = tc["week_start_date"]
    week_dates = []
    start_date = datetime.strptime(week_start, "%Y-%m-%d").date() if isinstance(week_start, str) else week_start
    for i in range(7):
        d = start_date + timedelta(days=i)
        week_dates.append(d.isoformat())

    # Get user's check-ins for this week with session info
    checkins_resp = client.table("backlot_checkins").select(
        "*, backlot_checkin_sessions!inner(shoot_date)"
    ).eq("project_id", project_id).eq("user_id", user["id"]).execute()

    # Filter to check-ins within this week
    week_checkins = []
    for checkin in (checkins_resp.data or []):
        session = checkin.get("backlot_checkin_sessions") or {}
        shoot_date = session.get("shoot_date")
        if shoot_date and shoot_date in week_dates:
            week_checkins.append({
                "id": checkin["id"],
                "shoot_date": shoot_date,
                "checked_in_at": checkin["checked_in_at"],
                "checked_out_at": checkin.get("checked_out_at"),
            })

    # Get existing entries for this timecard
    existing_resp = client.table("backlot_timecard_entries").select("shoot_date").eq("timecard_id", timecard_id).execute()
    existing_dates = {e["shoot_date"] for e in (existing_resp.data or [])}

    imported_count = 0
    skipped_count = 0
    imported_entries = []

    for checkin in week_checkins:
        shoot_date = checkin["shoot_date"]

        # Skip if entry exists and we're not overwriting
        if shoot_date in existing_dates and not request.overwrite_existing:
            skipped_count += 1
            continue

        # Parse check-in/check-out times
        call_time = checkin["checked_in_at"]
        wrap_time = checkin.get("checked_out_at")

        # Calculate hours if both times exist
        hours_worked = None
        if call_time and wrap_time:
            hours_worked = calculate_hours(call_time, wrap_time, 30)  # Default 30 min meal break

        entry_data = {
            "timecard_id": timecard_id,
            "project_id": project_id,
            "shoot_date": shoot_date,
            "call_time": call_time,
            "wrap_time": wrap_time,
            "hours_worked": hours_worked,
            "meal_break_minutes": 30,
            "checkin_id": checkin["id"],
            "is_auto_populated": True,
        }

        if shoot_date in existing_dates:
            # Update existing entry
            client.table("backlot_timecard_entries").update(entry_data).eq("timecard_id", timecard_id).eq("shoot_date", shoot_date).execute()
        else:
            # Create new entry
            client.table("backlot_timecard_entries").insert(entry_data).execute()

        imported_count += 1
        imported_entries.append({
            "shoot_date": shoot_date,
            "call_time": call_time,
            "wrap_time": wrap_time,
            "hours_worked": hours_worked,
        })

    return ImportCheckinsResponse(
        imported_count=imported_count,
        skipped_count=skipped_count,
        entries=imported_entries,
    )


DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


from fastapi.responses import HTMLResponse


@router.get("/projects/{project_id}/timecards/{timecard_id}/print", response_class=HTMLResponse)
async def get_timecard_print_view(
    project_id: str,
    timecard_id: str,
    authorization: str = Header(None),
    token: str = Query(None)  # Allow token as query param for new window opening
):
    """
    Get printable HTML view of timecard (can be saved as PDF via browser print)
    """
    # Support token via query param for opening in new window
    auth_header = authorization or (f"Bearer {token}" if token else None)
    user = await get_current_user_from_token(auth_header)
    client = get_client()

    # Get timecard
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only view your own timecard")

    # Get entries
    entries_resp = client.table("backlot_timecard_entries").select("*").eq("timecard_id", timecard_id).order("shoot_date").execute()
    entries_by_date = {e["shoot_date"]: e for e in (entries_resp.data or [])}

    # Get user profile
    profile_resp = client.table("profiles").select("full_name, email").eq("id", user["id"]).execute()
    user_name = profile_resp.data[0]["full_name"] if profile_resp.data else "Unknown"
    user_email = profile_resp.data[0]["email"] if profile_resp.data else ""

    # Get project info
    project_resp = client.table("backlot_projects").select("title").eq("id", project_id).execute()
    project_name = project_resp.data[0]["title"] if project_resp.data else "Unknown Project"

    # Calculate week dates and totals
    week_start = tc["week_start_date"]
    start_date = datetime.strptime(week_start, "%Y-%m-%d").date() if isinstance(week_start, str) else week_start
    end_date = start_date + timedelta(days=6)

    total_hours = 0.0
    total_overtime = 0.0
    total_double_time = 0.0

    # Build entry rows HTML
    entry_rows = ""
    for i in range(7):
        d = start_date + timedelta(days=i)
        date_str = d.isoformat()
        day_name = DAY_NAMES[i]

        entry = entries_by_date.get(date_str)
        if entry:
            call_time = ""
            wrap_time = ""
            if entry.get("call_time"):
                try:
                    ct = datetime.fromisoformat(entry["call_time"].replace("Z", "+00:00"))
                    call_time = ct.strftime("%I:%M %p")
                except:
                    call_time = entry["call_time"]
            if entry.get("wrap_time"):
                try:
                    wt = datetime.fromisoformat(entry["wrap_time"].replace("Z", "+00:00"))
                    wrap_time = wt.strftime("%I:%M %p")
                except:
                    wrap_time = entry["wrap_time"]

            hours = entry.get("hours_worked") or 0
            ot = entry.get("overtime_hours") or 0
            dt = entry.get("double_time_hours") or 0
            total_hours += hours
            total_overtime += ot
            total_double_time += dt

            flags = []
            if entry.get("is_travel_day"):
                flags.append("Travel")
            if entry.get("is_prep_day"):
                flags.append("Prep")
            if entry.get("is_wrap_day"):
                flags.append("Wrap")
            if entry.get("is_holiday"):
                flags.append("Holiday")

            entry_rows += f"""
            <tr>
                <td>{day_name} {d.strftime('%m/%d')}</td>
                <td>{call_time or '-'}</td>
                <td>{wrap_time or '-'}</td>
                <td style="text-align:right">{hours:.1f}</td>
                <td style="text-align:right">{ot:.1f if ot else '-'}</td>
                <td style="text-align:right">{dt:.1f if dt else '-'}</td>
                <td>{', '.join(flags) if flags else ''}</td>
                <td>{entry.get('notes') or ''}</td>
            </tr>
            """
        else:
            entry_rows += f"""
            <tr style="color:#999">
                <td>{day_name} {d.strftime('%m/%d')}</td>
                <td>-</td>
                <td>-</td>
                <td style="text-align:right">-</td>
                <td style="text-align:right">-</td>
                <td style="text-align:right">-</td>
                <td></td>
                <td></td>
            </tr>
            """

    # Generate HTML
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Timecard - {user_name} - Week of {start_date.strftime('%B %d, %Y')}</title>
        <style>
            @media print {{
                body {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
            }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                color: #333;
            }}
            .header {{
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 2px solid #333;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
            }}
            .header .project {{
                color: #666;
                font-size: 14px;
                margin-top: 4px;
            }}
            .meta {{
                text-align: right;
            }}
            .meta .status {{
                display: inline-block;
                padding: 4px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
            }}
            .status.draft {{ background: #f0f0f0; color: #666; }}
            .status.submitted {{ background: #e3f2fd; color: #1976d2; }}
            .status.approved {{ background: #e8f5e9; color: #388e3c; }}
            .status.rejected {{ background: #ffebee; color: #d32f2f; }}
            .info {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
            }}
            .info-box {{
                background: #f8f8f8;
                padding: 15px;
                border-radius: 8px;
            }}
            .info-box label {{
                display: block;
                font-size: 11px;
                color: #666;
                text-transform: uppercase;
                margin-bottom: 4px;
            }}
            .info-box .value {{
                font-size: 16px;
                font-weight: 600;
            }}
            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }}
            th, td {{
                padding: 10px 8px;
                text-align: left;
                border-bottom: 1px solid #e0e0e0;
            }}
            th {{
                background: #f5f5f5;
                font-weight: 600;
                font-size: 12px;
                text-transform: uppercase;
            }}
            .totals {{
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 40px;
            }}
            .total-box {{
                background: #333;
                color: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
            }}
            .total-box .value {{
                font-size: 32px;
                font-weight: 700;
            }}
            .total-box label {{
                font-size: 12px;
                opacity: 0.8;
            }}
            .signatures {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 40px;
                margin-top: 60px;
            }}
            .signature-line {{
                border-top: 1px solid #333;
                padding-top: 8px;
            }}
            .signature-line label {{
                font-size: 12px;
                color: #666;
            }}
            .print-btn {{
                position: fixed;
                top: 20px;
                right: 20px;
                background: #333;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }}
            .print-btn:hover {{ background: #555; }}
            @media print {{
                .print-btn {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <button class="print-btn" onclick="window.print()">Print / Save PDF</button>

        <div class="header">
            <div>
                <h1>Weekly Timecard</h1>
                <div class="project">{project_name}</div>
            </div>
            <div class="meta">
                <span class="status {tc['status']}">{tc['status']}</span>
            </div>
        </div>

        <div class="info">
            <div class="info-box">
                <label>Crew Member</label>
                <div class="value">{user_name}</div>
            </div>
            <div class="info-box">
                <label>Week Ending</label>
                <div class="value">{end_date.strftime('%B %d, %Y')}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Day</th>
                    <th>Call Time</th>
                    <th>Wrap Time</th>
                    <th style="text-align:right">Hours</th>
                    <th style="text-align:right">OT</th>
                    <th style="text-align:right">DT</th>
                    <th>Type</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>
                {entry_rows}
            </tbody>
        </table>

        <div class="totals">
            <div class="total-box">
                <div class="value">{total_hours:.1f}</div>
                <label>Regular Hours</label>
            </div>
            <div class="total-box" style="background:#f59e0b">
                <div class="value">{total_overtime:.1f}</div>
                <label>Overtime Hours</label>
            </div>
            <div class="total-box" style="background:#ef4444">
                <div class="value">{total_double_time:.1f}</div>
                <label>Double-Time Hours</label>
            </div>
        </div>

        <div class="signatures">
            <div>
                <div class="signature-line">
                    <label>Employee Signature</label>
                </div>
            </div>
            <div>
                <div class="signature-line">
                    <label>Supervisor Signature</label>
                </div>
            </div>
        </div>

        <p style="text-align:center;color:#999;font-size:11px;margin-top:40px">
            Generated on {datetime.utcnow().strftime('%B %d, %Y at %I:%M %p')} UTC
        </p>
    </body>
    </html>
    """

    return HTMLResponse(content=html)


@router.get("/projects/{project_id}/timecards/{timecard_id}/preview", response_model=TimecardPreviewResponse)
async def get_timecard_preview(
    project_id: str,
    timecard_id: str,
    authorization: str = Header(None)
):
    """
    Get timecard preview with validation warnings before submission
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Verify timecard ownership
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only preview your own timecard")

    # Get entries
    entries_resp = client.table("backlot_timecard_entries").select("*").eq("timecard_id", timecard_id).order("shoot_date").execute()
    entries_by_date = {e["shoot_date"]: e for e in (entries_resp.data or [])}

    # Get union settings
    union_config = get_project_union_settings(client, project_id)
    union_mode = union_config["union_mode"]

    # Calculate week dates
    week_start = tc["week_start_date"]
    start_date = datetime.strptime(week_start, "%Y-%m-%d").date() if isinstance(week_start, str) else week_start

    preview_entries = []
    warnings = []
    total_hours = 0.0
    total_overtime = 0.0
    total_double_time = 0.0
    days_worked = 0
    total_meal_penalties = 0
    total_turnaround_violations = 0

    for i in range(7):
        d = start_date + timedelta(days=i)
        date_str = d.isoformat()
        day_name = DAY_NAMES[i]

        entry = entries_by_date.get(date_str)
        has_entry = entry is not None

        preview_entry = TimecardPreviewEntry(
            date=date_str,
            day_name=day_name,
            has_entry=has_entry,
        )

        if entry:
            preview_entry.call_time = entry.get("call_time")
            preview_entry.wrap_time = entry.get("wrap_time")
            preview_entry.hours_worked = entry.get("hours_worked")
            preview_entry.overtime_hours = entry.get("overtime_hours")
            preview_entry.double_time_hours = entry.get("double_time_hours")
            preview_entry.is_travel_day = entry.get("is_travel_day", False)
            preview_entry.is_prep_day = entry.get("is_prep_day", False)
            preview_entry.is_wrap_day = entry.get("is_wrap_day", False)
            preview_entry.is_holiday = entry.get("is_holiday", False)

            # Accumulate totals
            if entry.get("hours_worked"):
                total_hours += float(entry["hours_worked"])
                days_worked += 1
            if entry.get("overtime_hours"):
                total_overtime += float(entry["overtime_hours"])
            if entry.get("double_time_hours"):
                total_double_time += float(entry["double_time_hours"])

            # Validate entry
            if not entry.get("call_time") or not entry.get("wrap_time"):
                warnings.append(TimecardWarning(
                    type="missing_times",
                    severity="warning",
                    message=f"{day_name}: Missing call or wrap time",
                    date=date_str,
                ))

            # Check union violations
            if union_mode == "union_full":
                # Meal penalty
                meal_penalties = entry.get("meal_penalty_count", 0)
                if meal_penalties:
                    total_meal_penalties += meal_penalties
                    warnings.append(TimecardWarning(
                        type="meal_penalty",
                        severity="warning",
                        message=f"{day_name}: Meal penalty - no break recorded within 6 hours",
                        date=date_str,
                    ))

                # Turnaround violation
                if entry.get("turnaround_violation"):
                    total_turnaround_violations += 1
                    warnings.append(TimecardWarning(
                        type="turnaround_violation",
                        severity="warning",
                        message=f"{day_name}: Turnaround violation - less than 10 hours rest",
                        date=date_str,
                    ))

        preview_entries.append(preview_entry)

    # Check for general warnings
    if days_worked == 0:
        warnings.append(TimecardWarning(
            type="no_entries",
            severity="error",
            message="No time entries found. Add at least one day before submitting.",
        ))

    if total_overtime > 0:
        warnings.append(TimecardWarning(
            type="overtime_notice",
            severity="info",
            message=f"This timecard includes {total_overtime:.1f} hours of overtime.",
        ))

    if total_double_time > 0:
        warnings.append(TimecardWarning(
            type="double_time_notice",
            severity="info",
            message=f"This timecard includes {total_double_time:.1f} hours of double-time.",
        ))

    # Determine if can submit
    has_errors = any(w.severity == "error" for w in warnings)
    can_submit = not has_errors and tc["status"] in ["draft", "rejected"]

    return TimecardPreviewResponse(
        timecard_id=timecard_id,
        week_start_date=week_start,
        status=tc["status"],
        total_hours=total_hours,
        total_overtime=total_overtime,
        total_double_time=total_double_time,
        days_worked=days_worked,
        entries=preview_entries,
        warnings=warnings,
        is_valid=not has_errors,
        can_submit=can_submit,
    )


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
    client = get_client()

    # Verify timecard ownership
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="You can only submit your own timecard")

    if tc["status"] not in ["draft", "rejected"]:
        raise HTTPException(status_code=400, detail="Timecard has already been submitted")

    # Update status
    update_resp = client.table("backlot_timecards").update({
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
    client = get_client()

    if not await can_approve_timecards(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to approve timecards")

    # Verify timecard exists and is submitted
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted timecards can be approved")

    # Update status
    update_resp = client.table("backlot_timecards").update({
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
    client = get_client()

    if not await can_approve_timecards(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="You don't have permission to reject timecards")

    # Verify timecard exists and is submitted
    tc_resp = client.table("backlot_timecards").select("*").eq("id", timecard_id).eq("project_id", project_id).execute()
    if not tc_resp.data:
        raise HTTPException(status_code=404, detail="Timecard not found")

    tc = tc_resp.data[0]
    if tc["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted timecards can be rejected")

    # Update status
    update_resp = client.table("backlot_timecards").update({
        "status": "rejected",
        "rejected_at": datetime.utcnow().isoformat(),
        "rejected_by_user_id": user["id"],
        "rejection_reason": request.reason,
    }).eq("id", timecard_id).execute()

    if not update_resp.data:
        raise HTTPException(status_code=500, detail="Failed to reject timecard")

    return {"success": True, "status": "rejected"}
