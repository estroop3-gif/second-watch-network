"""
Person View API - Per-crew member overview within a project
Shows roles, schedule, call sheets, timecards, tasks, and credits
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from app.core.database import get_client

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class PersonIdentity(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class PersonRole(BaseModel):
    id: str
    backlot_role: str
    is_primary: bool = False
    department: Optional[str] = None
    production_role: Optional[str] = None  # From project_members


class ScheduledDay(BaseModel):
    day_id: str
    date: str
    day_number: int
    call_time: Optional[str] = None
    location_name: Optional[str] = None
    is_completed: bool = False


class TimecardSummary(BaseModel):
    id: str
    week_start_date: str
    status: str
    total_hours: float = 0
    total_overtime: float = 0
    entry_count: int = 0


class TaskSummary(BaseModel):
    id: str
    title: str
    status: str
    priority: Optional[str] = None
    due_date: Optional[str] = None
    task_list_name: Optional[str] = None


class CreditInfo(BaseModel):
    role: str
    department: Optional[str] = None
    credit_order: Optional[int] = None


class PersonListItem(BaseModel):
    user_id: str
    full_name: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    primary_role: Optional[str] = None
    department: Optional[str] = None
    days_scheduled: int = 0
    task_count: int = 0
    has_pending_timecard: bool = False


class PersonOverview(BaseModel):
    identity: PersonIdentity
    roles: List[PersonRole] = []
    schedule: List[ScheduledDay] = []
    timecards: List[TimecardSummary] = []
    tasks: List[TaskSummary] = []
    credit: Optional[CreditInfo] = None
    stats: Dict[str, Any] = {}


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        import os
        USE_AWS = os.getenv('USE_AWS', 'false').lower() == 'true'

        if USE_AWS:
            from app.core.cognito import CognitoAuth
            user = CognitoAuth.verify_token(token)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid token")
            return {"id": user.get("id"), "email": user.get("email")}
        else:
            from app.core.supabase import get_supabase_client
            supabase = get_supabase_client()
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                raise HTTPException(status_code=401, detail="Invalid token")
            return {"id": user_response.user.id, "email": user_response.user.email}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_access(supabase, project_id: str, user_id: str) -> Dict[str, Any]:
    """Verify user has access to project and return access level"""
    # Check owner
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and project_resp.data[0]["owner_id"] == user_id:
        return {"has_access": True, "is_admin": True, "is_owner": True}

    # Check membership
    member_resp = client.table("backlot_project_members").select("role").eq("project_id", project_id).eq("user_id", user_id).execute()
    if not member_resp.data:
        return {"has_access": False, "is_admin": False, "is_owner": False}

    role = member_resp.data[0].get("role", "viewer")
    return {"has_access": True, "is_admin": role in ["admin", "owner"], "is_owner": False}


async def can_view_person(supabase, project_id: str, viewer_id: str, target_user_id: str) -> bool:
    """Check if viewer can see target person's details"""
    # Can always view own profile
    if viewer_id == target_user_id:
        return True

    # Check if viewer is admin/showrunner/producer
    access = await verify_project_access(supabase, project_id, viewer_id)
    if access.get("is_admin") or access.get("is_owner"):
        return True

    # Check for showrunner/producer role
    role_resp = client.table("backlot_project_roles").select("backlot_role").eq("project_id", project_id).eq("user_id", viewer_id).execute()
    for role in (role_resp.data or []):
        if role.get("backlot_role") in ["showrunner", "producer"]:
            return True

    return False


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/people", response_model=List[PersonListItem])
async def list_project_people(
    project_id: str,
    department: Optional[str] = Query(None, description="Filter by department"),
    role: Optional[str] = Query(None, description="Filter by backlot role"),
    search: Optional[str] = Query(None, description="Search by name"),
    authorization: str = Header(None)
):
    """
    List all people on a project with summary data
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    access = await verify_project_access(supabase, project_id, user["id"])
    if not access.get("has_access"):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get project members with profiles
    members_resp = client.table("backlot_project_members").select(
        "*, profiles:user_id(id, full_name, display_name, avatar_url)"
    ).eq("project_id", project_id).execute()

    members = members_resp.data or []

    # Get all backlot roles for this project
    roles_resp = client.table("backlot_project_roles").select("*").eq("project_id", project_id).execute()
    roles_by_user: Dict[str, List[Dict]] = {}
    for r in (roles_resp.data or []):
        uid = r["user_id"]
        if uid not in roles_by_user:
            roles_by_user[uid] = []
        roles_by_user[uid].append(r)

    # Get task counts per user
    tasks_resp = client.table("backlot_tasks").select("assigned_to").eq("project_id", project_id).not_.is_("assigned_to", "null").execute()
    task_counts: Dict[str, int] = {}
    for task in (tasks_resp.data or []):
        aid = task.get("assigned_to")
        if aid:
            task_counts[aid] = task_counts.get(aid, 0) + 1

    # Get pending timecards
    pending_timecards_resp = client.table("backlot_timecards").select("user_id").eq("project_id", project_id).in_("status", ["draft", "submitted"]).execute()
    users_with_pending = set(t["user_id"] for t in (pending_timecards_resp.data or []))

    # Get scheduled days count per user (from call sheet people)
    # This is simplified - would need a more complex query in production
    days_scheduled: Dict[str, int] = {}

    result = []
    seen_users = set()

    for member in members:
        profile = member.get("profiles") or {}
        user_id = member.get("user_id")

        if not user_id or user_id in seen_users:
            continue
        seen_users.add(user_id)

        full_name = profile.get("full_name")
        display_name = profile.get("display_name")

        # Filter by search
        if search:
            search_lower = search.lower()
            name_match = (full_name and search_lower in full_name.lower()) or \
                         (display_name and search_lower in display_name.lower())
            if not name_match:
                continue

        # Get primary role
        user_roles = roles_by_user.get(user_id, [])
        primary_role = None
        for r in user_roles:
            if r.get("is_primary"):
                primary_role = r.get("backlot_role")
                break
        if not primary_role and user_roles:
            primary_role = user_roles[0].get("backlot_role")

        # Filter by role
        if role and primary_role != role:
            all_roles = [r.get("backlot_role") for r in user_roles]
            if role not in all_roles:
                continue

        dept = member.get("department")
        # Filter by department
        if department and dept != department:
            continue

        result.append(PersonListItem(
            user_id=user_id,
            full_name=full_name,
            display_name=display_name,
            avatar_url=profile.get("avatar_url"),
            primary_role=primary_role,
            department=dept,
            days_scheduled=days_scheduled.get(user_id, 0),
            task_count=task_counts.get(user_id, 0),
            has_pending_timecard=user_id in users_with_pending,
        ))

    return result


@router.get("/projects/{project_id}/people/{target_user_id}/overview", response_model=PersonOverview)
async def get_person_overview(
    project_id: str,
    target_user_id: str,
    authorization: str = Header(None)
):
    """
    Get comprehensive overview of a person within a project
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    access = await verify_project_access(supabase, project_id, user["id"])
    if not access.get("has_access"):
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if user can view this person's details
    if not await can_view_person(supabase, project_id, user["id"], target_user_id):
        raise HTTPException(status_code=403, detail="You don't have permission to view this person's details")

    # Get profile
    profile_resp = client.table("profiles").select("*").eq("id", target_user_id).execute()
    profile = profile_resp.data[0] if profile_resp.data else {}

    # Get member info for this project
    member_resp = client.table("backlot_project_members").select("*").eq("project_id", project_id).eq("user_id", target_user_id).execute()
    member = member_resp.data[0] if member_resp.data else {}

    identity = PersonIdentity(
        user_id=target_user_id,
        full_name=profile.get("full_name"),
        display_name=profile.get("display_name"),
        avatar_url=profile.get("avatar_url"),
        email=member.get("email") or profile.get("email"),
        phone=member.get("phone"),
    )

    # Get roles
    roles_resp = client.table("backlot_project_roles").select("*").eq("project_id", project_id).eq("user_id", target_user_id).execute()
    roles = [PersonRole(
        id=r["id"],
        backlot_role=r.get("backlot_role", ""),
        is_primary=r.get("is_primary", False),
        department=member.get("department"),
        production_role=member.get("production_role"),
    ) for r in (roles_resp.data or [])]

    # Get schedule (days this person is on call sheets)
    schedule = []
    csp_resp = client.table("backlot_call_sheet_people").select(
        "call_time, call_sheet:call_sheet_id(id, date, production_day_id, location_name)"
    ).eq("member_id", target_user_id).execute()

    seen_days = set()
    for csp in (csp_resp.data or []):
        cs = csp.get("call_sheet") or {}
        pd_id = cs.get("production_day_id")
        if pd_id and pd_id not in seen_days:
            seen_days.add(pd_id)
            # Get production day info
            pd_resp = client.table("backlot_production_days").select("*").eq("id", pd_id).execute()
            if pd_resp.data:
                pd = pd_resp.data[0]
                schedule.append(ScheduledDay(
                    day_id=pd_id,
                    date=pd.get("date", ""),
                    day_number=pd.get("day_number", 0),
                    call_time=csp.get("call_time") or cs.get("general_call_time"),
                    location_name=cs.get("location_name") or pd.get("location_name"),
                    is_completed=pd.get("is_completed", False),
                ))

    # Sort schedule by date
    schedule.sort(key=lambda x: x.date)

    # Get timecards
    timecards = []
    tc_resp = client.table("backlot_timecards").select("*").eq("project_id", project_id).eq("user_id", target_user_id).order("week_start_date", desc=True).execute()
    for tc in (tc_resp.data or []):
        # Get entries for this timecard
        entries_resp = client.table("backlot_timecard_entries").select("hours_worked, overtime_hours").eq("timecard_id", tc["id"]).execute()
        entries = entries_resp.data or []
        total_hours = sum(e.get("hours_worked", 0) or 0 for e in entries)
        total_overtime = sum(e.get("overtime_hours", 0) or 0 for e in entries)

        timecards.append(TimecardSummary(
            id=tc["id"],
            week_start_date=tc.get("week_start_date", ""),
            status=tc.get("status", "draft"),
            total_hours=total_hours,
            total_overtime=total_overtime,
            entry_count=len(entries),
        ))

    # Get tasks assigned to this person
    tasks = []
    tasks_resp = client.table("backlot_tasks").select(
        "*, task_list:task_list_id(name)"
    ).eq("project_id", project_id).eq("assigned_to", target_user_id).execute()
    for task in (tasks_resp.data or []):
        list_name = None
        if task.get("task_list"):
            list_name = task["task_list"].get("name")
        tasks.append(TaskSummary(
            id=task["id"],
            title=task.get("title", ""),
            status=task.get("status", "todo"),
            priority=task.get("priority"),
            due_date=task.get("due_date"),
            task_list_name=list_name,
        ))

    # Get credit info
    credit = None
    credits_resp = client.table("backlot_credits").select("*").eq("project_id", project_id).eq("user_id", target_user_id).execute()
    if credits_resp.data:
        c = credits_resp.data[0]
        credit = CreditInfo(
            role=c.get("role", ""),
            department=c.get("department"),
            credit_order=c.get("credit_order"),
        )
    elif roles:
        # Use backlot role as credit if no explicit credit
        primary = next((r for r in roles if r.is_primary), roles[0] if roles else None)
        if primary:
            credit = CreditInfo(
                role=primary.backlot_role,
                department=member.get("department"),
            )

    # Build stats
    total_hours = sum(tc.total_hours for tc in timecards)
    total_overtime = sum(tc.total_overtime for tc in timecards)
    pending_tasks = len([t for t in tasks if t.status not in ["completed", "done"]])
    completed_tasks = len([t for t in tasks if t.status in ["completed", "done"]])

    stats = {
        "days_scheduled": len(schedule),
        "days_completed": len([s for s in schedule if s.is_completed]),
        "total_hours_logged": round(total_hours, 1),
        "total_overtime_hours": round(total_overtime, 1),
        "pending_tasks": pending_tasks,
        "completed_tasks": completed_tasks,
        "timecards_pending": len([tc for tc in timecards if tc.status in ["draft", "submitted"]]),
    }

    return PersonOverview(
        identity=identity,
        roles=roles,
        schedule=schedule,
        timecards=timecards,
        tasks=tasks,
        credit=credit,
        stats=stats,
    )


@router.get("/projects/{project_id}/people/me/overview", response_model=PersonOverview)
async def get_my_person_overview(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get the current user's person overview for this project
    """
    user = await get_current_user_from_token(authorization)
    return await get_person_overview(project_id, user["id"], authorization)
