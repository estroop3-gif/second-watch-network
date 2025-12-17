"""
Day View API - Shoot day dashboard aggregating call sheets, dailies, budget, travel, tasks, and timecards
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from app.core.supabase import get_supabase_admin_client

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class DayMetadata(BaseModel):
    id: str
    project_id: str
    day_number: int
    date: str
    title: Optional[str] = None
    description: Optional[str] = None
    general_call_time: Optional[str] = None
    wrap_time: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None
    is_completed: bool = False
    notes: Optional[str] = None
    weather_notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CallSheetSummary(BaseModel):
    id: str
    title: str
    date: str
    general_call_time: Optional[str] = None
    location_name: Optional[str] = None
    is_published: bool = False
    crew_count: int = 0
    cast_count: int = 0
    scene_count: int = 0


class DailyBudgetSummary(BaseModel):
    id: str
    total_planned: float = 0
    total_actual: float = 0
    variance: float = 0
    item_count: int = 0


class DailiesDaySummary(BaseModel):
    id: str
    shoot_date: str
    label: Optional[str] = None
    card_count: int = 0
    clip_count: int = 0
    circle_take_count: int = 0
    total_duration_minutes: float = 0


class TravelItemSummary(BaseModel):
    id: str
    person_name: str
    travel_type: str  # flight, hotel, ground, etc.
    details: Optional[str] = None
    status: Optional[str] = None


class TaskSummary(BaseModel):
    id: str
    title: str
    status: str
    priority: Optional[str] = None
    assigned_to_name: Optional[str] = None
    task_list_name: Optional[str] = None


class UpdateSummary(BaseModel):
    id: str
    title: Optional[str] = None
    content: str
    update_type: str
    author_name: Optional[str] = None
    created_at: str


class TimecardEntrySummary(BaseModel):
    id: str
    user_id: str
    user_name: Optional[str] = None
    call_time: Optional[str] = None
    wrap_time: Optional[str] = None
    hours_worked: Optional[float] = None
    status: str  # from parent timecard


class DayListItem(BaseModel):
    id: str
    day_number: int
    date: str
    title: Optional[str] = None
    location_name: Optional[str] = None
    general_call_time: Optional[str] = None
    is_completed: bool = False
    has_call_sheet: bool = False
    has_dailies: bool = False
    task_count: int = 0
    crew_scheduled_count: int = 0


class DayOverview(BaseModel):
    day: DayMetadata
    call_sheets: List[CallSheetSummary] = []
    daily_budget: Optional[DailyBudgetSummary] = None
    dailies: Optional[DailiesDaySummary] = None
    travel_items: List[TravelItemSummary] = []
    tasks: List[TaskSummary] = []
    updates: List[UpdateSummary] = []
    timecard_entries: List[TimecardEntrySummary] = []
    scenes_scheduled: List[Dict[str, Any]] = []
    crew_summary: Dict[str, Any] = {}


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


async def verify_project_access(supabase, project_id: str, user_id: str) -> bool:
    """Verify user has access to project"""
    project_resp = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and project_resp.data[0]["owner_id"] == user_id:
        return True

    member_resp = supabase.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    return bool(member_resp.data)


async def get_user_view_config(supabase, project_id: str, user_id: str) -> Dict[str, Any]:
    """Get user's view config to check budget visibility"""
    # Check if owner
    project_resp = supabase.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and project_resp.data[0]["owner_id"] == user_id:
        return {"can_view_budget": True}

    # Get user's role
    role_resp = supabase.table("backlot_project_roles").select("backlot_role").eq("project_id", project_id).eq("user_id", user_id).eq("is_primary", True).execute()
    if not role_resp.data:
        role_resp = supabase.table("backlot_project_roles").select("backlot_role").eq("project_id", project_id).eq("user_id", user_id).execute()

    role = role_resp.data[0]["backlot_role"] if role_resp.data else "crew"

    # Roles that can see budget
    budget_roles = ["showrunner", "producer", "first_ad"]
    return {"can_view_budget": role in budget_roles}


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/days", response_model=List[DayListItem])
async def list_production_days(
    project_id: str,
    start_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    authorization: str = Header(None)
):
    """
    List all production days for a project with summary data
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_access(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get production days
    query = supabase.table("backlot_production_days").select("*").eq("project_id", project_id)

    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    days_resp = query.order("date").execute()
    days = days_resp.data or []

    day_ids = [d["id"] for d in days]
    day_dates = [d["date"] for d in days]

    # Get call sheet counts
    call_sheet_days = set()
    if day_ids:
        cs_resp = supabase.table("backlot_call_sheets").select("production_day_id").eq("project_id", project_id).in_("production_day_id", day_ids).execute()
        for cs in (cs_resp.data or []):
            if cs.get("production_day_id"):
                call_sheet_days.add(cs["production_day_id"])

    # Get dailies days
    dailies_days = set()
    if day_dates:
        dd_resp = supabase.table("backlot_dailies_days").select("shoot_date").eq("project_id", project_id).in_("shoot_date", day_dates).execute()
        for dd in (dd_resp.data or []):
            if dd.get("shoot_date"):
                dailies_days.add(dd["shoot_date"])

    # Get task counts by due date
    task_counts = {}
    if day_dates:
        tasks_resp = supabase.table("backlot_tasks").select("due_date").eq("project_id", project_id).in_("due_date", day_dates).execute()
        for task in (tasks_resp.data or []):
            due = task.get("due_date")
            if due:
                task_counts[due] = task_counts.get(due, 0) + 1

    # Get crew counts from call sheet people
    crew_counts = {}
    if day_ids:
        for day_id in day_ids:
            csp_resp = supabase.table("backlot_call_sheet_people").select("id, call_sheet_id").execute()
            # This is simplified - would need join in real implementation

    result = []
    for day in days:
        day_id = day["id"]
        day_date = day.get("date")

        result.append(DayListItem(
            id=day_id,
            day_number=day.get("day_number", 0),
            date=day_date or "",
            title=day.get("title"),
            location_name=day.get("location_name"),
            general_call_time=day.get("general_call_time"),
            is_completed=day.get("is_completed", False),
            has_call_sheet=day_id in call_sheet_days,
            has_dailies=day_date in dailies_days if day_date else False,
            task_count=task_counts.get(day_date, 0) if day_date else 0,
            crew_scheduled_count=crew_counts.get(day_id, 0),
        ))

    return result


@router.get("/projects/{project_id}/days/{day_id}/overview", response_model=DayOverview)
async def get_day_overview(
    project_id: str,
    day_id: str,
    authorization: str = Header(None)
):
    """
    Get comprehensive overview of a production day with all related data
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_access(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    view_config = await get_user_view_config(supabase, project_id, user["id"])

    # Get day metadata
    day_resp = supabase.table("backlot_production_days").select("*").eq("id", day_id).eq("project_id", project_id).execute()
    if not day_resp.data:
        raise HTTPException(status_code=404, detail="Production day not found")

    day_data = day_resp.data[0]
    day = DayMetadata(**day_data)
    day_date = day_data.get("date")

    # Get call sheets for this day
    call_sheets = []
    cs_resp = supabase.table("backlot_call_sheets").select("*").eq("production_day_id", day_id).execute()
    for cs in (cs_resp.data or []):
        # Get people counts
        people_resp = supabase.table("backlot_call_sheet_people").select("id, department").eq("call_sheet_id", cs["id"]).execute()
        people = people_resp.data or []
        crew_count = len([p for p in people if p.get("department") != "Cast"])
        cast_count = len([p for p in people if p.get("department") == "Cast"])

        # Get scene count
        scenes_resp = supabase.table("backlot_call_sheet_scenes").select("id").eq("call_sheet_id", cs["id"]).execute()
        scene_count = len(scenes_resp.data or [])

        call_sheets.append(CallSheetSummary(
            id=cs["id"],
            title=cs.get("title", ""),
            date=cs.get("date", ""),
            general_call_time=cs.get("general_call_time"),
            location_name=cs.get("location_name"),
            is_published=cs.get("is_published", False),
            crew_count=crew_count,
            cast_count=cast_count,
            scene_count=scene_count,
        ))

    # Get daily budget (if user can view)
    daily_budget = None
    if view_config.get("can_view_budget") and day_date:
        db_resp = supabase.table("backlot_daily_budgets").select("*").eq("project_id", project_id).eq("date", day_date).execute()
        if db_resp.data:
            db = db_resp.data[0]
            # Get items
            items_resp = supabase.table("backlot_daily_budget_items").select("*").eq("daily_budget_id", db["id"]).execute()
            items = items_resp.data or []
            total_planned = sum(i.get("planned_amount", 0) or 0 for i in items)
            total_actual = sum(i.get("actual_amount", 0) or 0 for i in items)

            daily_budget = DailyBudgetSummary(
                id=db["id"],
                total_planned=total_planned,
                total_actual=total_actual,
                variance=total_planned - total_actual,
                item_count=len(items),
            )

    # Get dailies summary
    dailies = None
    if day_date:
        dd_resp = supabase.table("backlot_dailies_days").select("*").eq("project_id", project_id).eq("shoot_date", day_date).execute()
        if dd_resp.data:
            dd = dd_resp.data[0]
            # Get cards and clips
            cards_resp = supabase.table("backlot_dailies_cards").select("id").eq("dailies_day_id", dd["id"]).execute()
            card_ids = [c["id"] for c in (cards_resp.data or [])]

            clip_count = 0
            circle_count = 0
            total_duration = 0
            if card_ids:
                clips_resp = supabase.table("backlot_dailies_clips").select("id, is_circle_take, duration_seconds").in_("dailies_card_id", card_ids).execute()
                clips = clips_resp.data or []
                clip_count = len(clips)
                circle_count = len([c for c in clips if c.get("is_circle_take")])
                total_duration = sum(c.get("duration_seconds", 0) or 0 for c in clips) / 60

            dailies = DailiesDaySummary(
                id=dd["id"],
                shoot_date=day_date,
                label=dd.get("label"),
                card_count=len(card_ids),
                clip_count=clip_count,
                circle_take_count=circle_count,
                total_duration_minutes=round(total_duration, 1),
            )

    # Get travel items (simplified - would need a travel table)
    travel_items: List[TravelItemSummary] = []

    # Get tasks due this day
    tasks = []
    if day_date:
        tasks_resp = supabase.table("backlot_tasks").select("*, profiles:assigned_to(full_name), task_list:task_list_id(name)").eq("project_id", project_id).eq("due_date", day_date).execute()
        for task in (tasks_resp.data or []):
            assigned_name = None
            if task.get("profiles"):
                assigned_name = task["profiles"].get("full_name")
            list_name = None
            if task.get("task_list"):
                list_name = task["task_list"].get("name")

            tasks.append(TaskSummary(
                id=task["id"],
                title=task.get("title", ""),
                status=task.get("status", "todo"),
                priority=task.get("priority"),
                assigned_to_name=assigned_name,
                task_list_name=list_name,
            ))

    # Get updates for this day
    updates = []
    if day_date:
        updates_resp = supabase.table("backlot_project_updates").select("*, profiles:created_by(full_name)").eq("project_id", project_id).execute()
        for update in (updates_resp.data or []):
            # Check if update is for this day (by created_at date or metadata)
            created = update.get("created_at", "")
            if created.startswith(day_date):
                author_name = None
                if update.get("profiles"):
                    author_name = update["profiles"].get("full_name")
                updates.append(UpdateSummary(
                    id=update["id"],
                    title=update.get("title"),
                    content=update.get("content", ""),
                    update_type=update.get("update_type", "general"),
                    author_name=author_name,
                    created_at=created,
                ))

    # Get timecard entries for this day
    timecard_entries = []
    if day_date:
        entries_resp = supabase.table("backlot_timecard_entries").select("*, timecard:timecard_id(status, user_id), profiles:timecard_id(user_id)").eq("project_id", project_id).eq("shoot_date", day_date).execute()
        for entry in (entries_resp.data or []):
            timecard = entry.get("timecard") or {}
            # Would need to join user profile for name
            timecard_entries.append(TimecardEntrySummary(
                id=entry["id"],
                user_id=timecard.get("user_id", ""),
                user_name=None,  # Would need profile join
                call_time=entry.get("call_time"),
                wrap_time=entry.get("wrap_time"),
                hours_worked=entry.get("hours_worked"),
                status=timecard.get("status", "draft"),
            ))

    # Get scenes scheduled for this day
    scenes_scheduled = []
    scenes_resp = supabase.table("backlot_scenes").select("id, scene_number, slugline, page_length").eq("scheduled_day_id", day_id).execute()
    for scene in (scenes_resp.data or []):
        scenes_scheduled.append({
            "id": scene["id"],
            "scene_number": scene.get("scene_number"),
            "slugline": scene.get("slugline"),
            "page_length": scene.get("page_length"),
        })

    # Build crew summary from call sheet people
    crew_summary = {
        "total_crew": 0,
        "total_cast": 0,
        "departments": {},
    }
    if call_sheets:
        for cs in call_sheets:
            crew_summary["total_crew"] += cs.crew_count
            crew_summary["total_cast"] += cs.cast_count

    return DayOverview(
        day=day,
        call_sheets=call_sheets,
        daily_budget=daily_budget,
        dailies=dailies,
        travel_items=travel_items,
        tasks=tasks,
        updates=updates,
        timecard_entries=timecard_entries,
        scenes_scheduled=scenes_scheduled,
        crew_summary=crew_summary,
    )
