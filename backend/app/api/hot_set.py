"""
Hot Set API - Real-time production day management for 1st ADs

Features:
- Session management (one per production day)
- Scene progression tracking (start, complete, skip)
- Time markers (meal, company move, wrap)
- OT cost projections
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timedelta
from decimal import Decimal
from app.core.database import get_client

# =============================================================================
# DAY TYPE & OT THRESHOLDS
# =============================================================================

HotSetDayType = Literal['4hr', '8hr', '10hr', '12hr', '6th_day', '7th_day']

OT_THRESHOLDS = {
    '4hr':     {'ot1_after': 4,  'ot2_after': 6,  'label': '4 Hour Day',  'desc': 'OT after 4hr, DT after 6hr'},
    '8hr':     {'ot1_after': 8,  'ot2_after': 10, 'label': '8 Hour Day',  'desc': 'OT after 8hr, DT after 10hr'},
    '10hr':    {'ot1_after': 10, 'ot2_after': 12, 'label': '10 Hour Day', 'desc': 'OT after 10hr, DT after 12hr'},
    '12hr':    {'ot1_after': 12, 'ot2_after': 14, 'label': '12 Hour Day', 'desc': 'OT after 12hr, DT after 14hr'},
    '6th_day': {'ot1_after': 8,  'ot2_after': 12, 'label': '6th Day (Saturday)', 'desc': 'OT after 8hr (Saturday rules)'},
    '7th_day': {'ot1_after': 0,  'ot2_after': 0,  'label': '7th Day (Sunday)',   'desc': 'All hours at Double Time'},
}

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class HotSetSessionCreate(BaseModel):
    production_day_id: str
    call_sheet_id: Optional[str] = None
    day_type: str = "10hr"
    import_from_call_sheet: bool = True
    # New: Checkbox-based import options (take precedence over legacy import_source)
    import_hour_schedule: Optional[bool] = None
    import_scenes: Optional[bool] = None
    # Legacy: Schedule import options (for backwards compat)
    import_source: Optional[str] = None  # 'hour_schedule' | 'call_sheet' | 'none'
    schedule_tracking_mode: Optional[str] = "auto_reorder"  # 'auto_reorder' | 'track_deviation'
    # Auto-start configuration
    auto_start: Optional[bool] = None
    auto_start_minutes: Optional[int] = None


class HotSetSessionUpdate(BaseModel):
    day_type: Optional[str] = None
    default_hourly_rate: Optional[float] = None
    ot_multiplier_1: Optional[float] = None
    ot_multiplier_2: Optional[float] = None
    ot_threshold_1_hours: Optional[int] = None
    ot_threshold_2_hours: Optional[int] = None
    notes: Optional[str] = None


class HotSetSessionProductionDay(BaseModel):
    day_number: int
    date: str
    title: Optional[str] = None
    general_call_time: Optional[str] = None


class HotSetSession(BaseModel):
    id: str
    project_id: str
    production_day_id: str
    # Timezone support
    timezone: Optional[str] = None
    timezone_offset: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None
    call_sheet_id: Optional[str] = None
    day_type: str
    actual_call_time: Optional[str] = None
    actual_first_shot_time: Optional[str] = None
    actual_wrap_time: Optional[str] = None
    status: str
    started_at: Optional[str] = None
    wrapped_at: Optional[str] = None
    default_hourly_rate: Optional[float] = None
    ot_multiplier_1: float = 1.5
    ot_multiplier_2: float = 2.0
    ot_threshold_1_hours: int = 8
    ot_threshold_2_hours: int = 10
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    # Joined production day data
    production_day: Optional[HotSetSessionProductionDay] = None


class HotSetSceneLog(BaseModel):
    id: str
    session_id: str
    call_sheet_scene_id: Optional[str] = None
    scene_number: Optional[str] = None
    set_name: Optional[str] = None
    int_ext: Optional[str] = None
    description: Optional[str] = None
    estimated_minutes: Optional[int] = None
    scheduled_start_time: Optional[str] = None
    actual_start_time: Optional[str] = None
    actual_end_time: Optional[str] = None
    actual_duration_minutes: Optional[int] = None
    status: str
    sort_order: int
    notes: Optional[str] = None
    skip_reason: Optional[str] = None


class HotSetMarker(BaseModel):
    id: str
    session_id: str
    marker_type: str
    timestamp: str
    label: Optional[str] = None
    notes: Optional[str] = None


class HotSetCrew(BaseModel):
    id: str
    session_id: str
    call_sheet_person_id: Optional[str] = None
    name: str
    department: Optional[str] = None
    role: Optional[str] = None
    rate_type: str = "hourly"
    rate_amount: Optional[float] = None
    actual_call_time: Optional[str] = None
    actual_wrap_time: Optional[str] = None
    total_hours: Optional[float] = None
    regular_hours: Optional[float] = None
    ot_hours_1: Optional[float] = None
    ot_hours_2: Optional[float] = None
    calculated_cost: Optional[float] = None


class TimeStats(BaseModel):
    call_time: Optional[str] = None
    first_shot_time: Optional[str] = None
    current_time: str
    elapsed_minutes: int = 0
    ot_threshold_1_at: Optional[str] = None
    ot_threshold_2_at: Optional[str] = None
    projected_wrap_time: Optional[str] = None


class CostProjection(BaseModel):
    current_regular_cost: float = 0
    current_ot1_cost: float = 0
    current_ot2_cost: float = 0
    current_total_cost: float = 0
    projected_regular_cost: float = 0
    projected_ot1_cost: float = 0
    projected_ot2_cost: float = 0
    projected_total_cost: float = 0
    ot_overage_alert: bool = False


class ScheduleStatus(BaseModel):
    status: str = "on_time"  # ahead, on_time, behind
    variance_minutes: int = 0
    scenes_completed: int = 0
    scenes_total: int = 0
    percent_complete: float = 0


# Schedule Block model for non-scene items (must be before HotSetDashboard)
class HotSetScheduleBlockModel(BaseModel):
    id: str
    session_id: str
    block_type: str  # 'meal' | 'company_move' | 'activity' | 'crew_call' | 'first_shot' | 'wrap'
    expected_start_time: str
    expected_end_time: str
    expected_duration_minutes: int
    actual_start_time: Optional[str] = None
    actual_end_time: Optional[str] = None
    status: str = "pending"  # 'pending' | 'in_progress' | 'completed' | 'skipped'
    name: str
    location_name: Optional[str] = None
    notes: Optional[str] = None
    linked_marker_id: Optional[str] = None
    original_schedule_block_id: Optional[str] = None
    sort_order: int = 0


class CatchUpSuggestion(BaseModel):
    id: str
    type: str  # 'shorten_meal' | 'skip_activity' | 'combine_setups' | 'cut_scene' | 'extend_day'
    description: str
    time_saved_minutes: int
    impact: str  # 'low' | 'medium' | 'high'
    action_data: Optional[Dict[str, Any]] = None


class TimelineData(BaseModel):
    day_start: str
    day_end: str
    current_time: str
    expected_position_minutes: int
    actual_position_minutes: int


class ProjectedScheduleItem(BaseModel):
    """Unified schedule item with projected times"""
    id: str
    type: str  # 'scene' | 'meal' | 'company_move' | 'activity' | 'crew_call' | 'first_shot' | 'wrap'
    name: str  # Scene number or activity name
    description: Optional[str] = None  # Slugline or location

    # Planned times (from imported schedule)
    planned_start_time: str  # HH:MM
    planned_end_time: str
    planned_duration_minutes: int

    # Projected times (after cascading variance)
    projected_start_time: Optional[str] = None
    projected_end_time: Optional[str] = None
    variance_from_plan: Optional[int] = None  # Cumulative variance: negative = late, positive = ahead

    # Actual times (when completed)
    actual_start_time: Optional[str] = None
    actual_end_time: Optional[str] = None
    actual_duration_minutes: Optional[int] = None

    status: str = "pending"  # 'pending' | 'in_progress' | 'completed' | 'skipped'
    is_current: bool = False

    # NEW: Real-time deviation - compares current time to where we should be
    realtime_deviation_minutes: Optional[int] = None  # Negative = behind schedule, Positive = ahead of schedule

    # Source reference (to link back to scene or schedule block)
    source_type: str  # 'scene_log' | 'schedule_block' | 'imported'
    source_id: Optional[str] = None


class OTProjectionData(BaseModel):
    """Real-time OT projection based on current progress"""
    projected_wrap_time: str  # HH:MM
    call_time: str  # HH:MM
    total_hours: float
    regular_hours: float
    ot1_hours: float
    ot2_hours: float
    projected_ot_cost: float
    # Breakdown by crew if available
    crew_count: int = 0
    crew_with_rates: int = 0


class HotSetDashboard(BaseModel):
    session: HotSetSession
    current_scene: Optional[HotSetSceneLog] = None
    next_scenes: List[HotSetSceneLog] = []
    completed_scenes: List[HotSetSceneLog] = []
    markers: List[HotSetMarker] = []
    time_stats: TimeStats
    cost_projection: CostProjection
    schedule_status: ScheduleStatus
    # Schedule integration (optional for backward compatibility)
    schedule_blocks: List[HotSetScheduleBlockModel] = []
    schedule_deviation_minutes: int = 0
    current_expected_block: Optional[Dict[str, Any]] = None
    next_expected_block: Optional[Dict[str, Any]] = None
    catch_up_suggestions: List[CatchUpSuggestion] = []
    timeline: Optional[TimelineData] = None
    # New: Full projected schedule with live updates
    projected_schedule: List[ProjectedScheduleItem] = []
    ot_projection: Optional[OTProjectionData] = None


class MarkerCreate(BaseModel):
    marker_type: str
    timestamp: Optional[str] = None  # Defaults to now
    label: Optional[str] = None
    notes: Optional[str] = None


class SceneReorder(BaseModel):
    scene_ids: List[str]


class ScheduleBlockUpdate(BaseModel):
    expected_start_time: Optional[str] = None
    expected_end_time: Optional[str] = None
    notes: Optional[str] = None


# =============================================================================
# HOT SET SETTINGS MODELS
# =============================================================================

class HotSetSettings(BaseModel):
    id: str
    project_id: str
    auto_start_enabled: bool = True
    auto_start_minutes_before_call: int = 30
    notifications_enabled: bool = True
    notify_minutes_before_call: int = 30
    notify_crew_on_auto_start: bool = True
    suggestion_trigger_minutes_behind: int = 15
    suggestion_trigger_meal_penalty_minutes: int = 30
    suggestion_trigger_wrap_extension_minutes: int = 30
    default_schedule_view: str = "current"
    created_at: str
    updated_at: str


class HotSetSettingsUpdate(BaseModel):
    auto_start_enabled: Optional[bool] = None
    auto_start_minutes_before_call: Optional[int] = None
    notifications_enabled: Optional[bool] = None
    notify_minutes_before_call: Optional[int] = None
    notify_crew_on_auto_start: Optional[bool] = None
    suggestion_trigger_minutes_behind: Optional[int] = None
    suggestion_trigger_meal_penalty_minutes: Optional[int] = None
    suggestion_trigger_wrap_extension_minutes: Optional[int] = None
    default_schedule_view: Optional[str] = None


# =============================================================================
# DAY PREVIEW MODELS (for session creation)
# =============================================================================

class DayPreviewProductionDay(BaseModel):
    id: str
    day_number: int
    date: str
    title: Optional[str] = None
    general_call_time: Optional[str] = None
    location_name: Optional[str] = None


class DayPreviewExpectedHours(BaseModel):
    call_time: Optional[str] = None
    wrap_time: Optional[str] = None
    total_hours: float


class CrewPreviewPerson(BaseModel):
    id: str
    name: str
    role: Optional[str] = None
    department: Optional[str] = None
    source: str  # 'dood' | 'call_sheet' | 'both'
    user_id: Optional[str] = None
    # Rate info
    has_rate: bool = False
    rate_type: Optional[str] = None  # 'hourly' | 'daily' | 'weekly' | 'flat'
    rate_amount: Optional[float] = None
    rate_source: Optional[str] = None  # 'user' | 'role' | 'booking'
    # Calculated
    projected_cost: Optional[float] = None


class OTProjection(BaseModel):
    day_type: str
    ot1_threshold: int
    ot2_threshold: int
    regular_hours: float
    ot1_hours: float
    ot2_hours: float
    total_regular_cost: float
    total_ot1_cost: float
    total_ot2_cost: float
    total_cost: float
    crew_with_rates: int
    crew_without_rates: int


class DayPreviewResponse(BaseModel):
    production_day: DayPreviewProductionDay
    expected_hours: DayPreviewExpectedHours
    crew: List[CrewPreviewPerson]
    ot_projection: OTProjection


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    import jwt
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        email = payload.get("email")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        client = get_client()
        profile_result = client.table("profiles").select("id").eq(
            "cognito_user_id", user_id
        ).execute()

        if profile_result.data:
            return {"id": profile_result.data[0]["id"], "cognito_id": user_id, "email": email}

        if email:
            profile_result = client.table("profiles").select("id").eq(
                "email", email
            ).execute()
            if profile_result.data:
                return {"id": profile_result.data[0]["id"], "cognito_id": user_id, "email": email}

        raise HTTPException(status_code=401, detail="User not found")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


async def verify_project_access(client, project_id: str, user_id: str) -> bool:
    """Check if user has access to project (member or owner)"""
    # Check if user is a project member
    result = client.table("backlot_project_members").select("id").eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()
    if len(result.data or []) > 0:
        return True

    # Also check if user is the project owner
    project = client.table("backlot_projects").select("owner_id").eq(
        "id", project_id
    ).execute()
    if project.data and project.data[0].get("owner_id") == user_id:
        return True

    return False


async def verify_project_edit(client, project_id: str, user_id: str) -> bool:
    """Check if user can edit project (has edit role or is owner)"""
    # Check if user is the project owner (always has edit access)
    project = client.table("backlot_projects").select("owner_id").eq(
        "id", project_id
    ).execute()
    if project.data and project.data[0].get("owner_id") == user_id:
        return True

    # Check project member role
    result = client.table("backlot_project_members").select("role").eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()
    if not result.data:
        return False
    role = result.data[0].get("role", "")
    # Roles that can manage Hot Set
    edit_roles = ["owner", "admin", "showrunner", "producer", "director", "1st_ad", "1st-ad"]
    return role.lower() in edit_roles


def calculate_elapsed_minutes(start_time: str) -> int:
    """Calculate minutes elapsed since start time"""
    try:
        start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        now = datetime.now(start.tzinfo)
        return int((now - start).total_seconds() / 60)
    except:
        return 0


def calculate_schedule_variance(scenes: List[dict], session: dict = None) -> int:
    """
    Calculate how far ahead/behind schedule we are.
    Positive = ahead, Negative = behind

    When no scenes have been completed yet but session is in_progress,
    calculate time-based deviation from expected first scene start time.
    """
    # Check if any scenes have been completed
    completed_scenes = [s for s in scenes if s.get("status") == "completed"]

    if completed_scenes:
        # Calculate variance from completed scenes
        total_variance = 0
        for scene in completed_scenes:
            estimated = scene.get("estimated_minutes") or 0
            actual = scene.get("actual_duration_minutes") or 0
            total_variance += estimated - actual
        return total_variance

    # No completed scenes - check if session is in progress
    if session and session.get("status") == "in_progress":
        imported_schedule = session.get("imported_schedule") or []
        if imported_schedule:
            # Find the first scene block
            first_scene = next((b for b in imported_schedule if b.get("type") == "scene"), None)
            if first_scene and first_scene.get("start_time"):
                try:
                    expected_start_str = first_scene["start_time"]
                    # Get current time in local HH:MM
                    now = datetime.now()
                    current_minutes = now.hour * 60 + now.minute

                    # Parse expected start time (HH:MM format)
                    parts = expected_start_str.split(":")
                    expected_minutes = int(parts[0]) * 60 + int(parts[1])

                    # Check if we're past the expected start time
                    # and no scene has started yet
                    any_scene_started = any(s.get("status") in ("in_progress", "completed") for s in scenes)
                    if current_minutes > expected_minutes and not any_scene_started:
                        # We're behind schedule by the difference
                        return -(current_minutes - expected_minutes)
                except (ValueError, IndexError, KeyError):
                    pass

    return 0


def time_to_minutes(time_str: str) -> int:
    """Convert HH:MM time string to minutes since midnight"""
    try:
        parts = time_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
    except:
        return 0


def calculate_schedule_deviation(
    scenes: List[dict],
    schedule_blocks: List[dict],
    current_time: datetime,
    session: dict
) -> tuple:
    """
    Calculate schedule deviation based on expected vs actual times.
    Returns (deviation_minutes, current_expected_block, next_expected_block)

    Positive deviation = behind schedule
    Negative deviation = ahead of schedule
    """
    imported_schedule = session.get("imported_schedule") or []
    if not imported_schedule:
        # No schedule imported, use simple variance
        return (0, None, None)

    # Get current time in HH:MM format
    current_time_str = current_time.strftime("%H:%M")
    current_minutes = time_to_minutes(current_time_str)

    # Find what should be happening now based on schedule
    current_expected = None
    next_expected = None

    for block in imported_schedule:
        start_minutes = time_to_minutes(block.get("start_time", "00:00"))
        end_minutes = time_to_minutes(block.get("end_time", "00:00"))

        if start_minutes <= current_minutes < end_minutes:
            current_expected = block
        elif start_minutes > current_minutes and next_expected is None:
            next_expected = block
            break

    # Calculate actual position based on completed work
    completed_duration = sum(
        s.get("actual_duration_minutes") or 0
        for s in scenes
        if s.get("status") == "completed"
    )

    # Get expected duration completed by now
    expected_duration = 0
    for block in imported_schedule:
        end_minutes = time_to_minutes(block.get("end_time", "00:00"))
        if end_minutes <= current_minutes:
            expected_duration += block.get("duration_minutes") or 0
        elif time_to_minutes(block.get("start_time", "00:00")) < current_minutes:
            # Partially through this block
            block_start = time_to_minutes(block.get("start_time", "00:00"))
            expected_duration += current_minutes - block_start
            break

    # Deviation = expected - actual (positive = behind)
    # If we expected 120 min of work done but only did 100, we're 20 min behind
    deviation = expected_duration - completed_duration

    return (deviation, current_expected, next_expected)


def generate_catch_up_suggestions(
    deviation_minutes: int,
    scenes: List[dict],
    schedule_blocks: List[dict],
    session_data: Optional[dict] = None,
    settings: Optional[dict] = None
) -> List[dict]:
    """
    Generate intelligent catch-up suggestions when behind schedule.

    Suggestion types:
    - break_shortening: Reduce meal/break duration (compliance warning)
    - walking_lunch: Take lunch while working (compliance warning)
    - skip_activity: Skip non-essential activities
    - scene_consolidation: Combine similar scenes (same location/setup)
    - schedule_reordering: Shoot scenes out of order to optimize
    - scene_cut: Cut non-essential scenes
    - scene_move: Move scenes to another day
    - extend_day: Work into overtime (cost impact warning)
    """
    import uuid
    from collections import defaultdict

    # Get trigger thresholds from settings
    trigger_threshold = 15  # Default: show suggestions when 15+ minutes behind
    if settings:
        trigger_threshold = settings.get("suggestion_trigger_minutes_behind", 15)

    # Only generate suggestions if past threshold
    if deviation_minutes < trigger_threshold:
        return []

    suggestions = []
    time_needed = deviation_minutes

    # Get pending scenes and blocks
    pending_scenes = [s for s in scenes if s.get("status") == "pending"]
    pending_blocks = [b for b in schedule_blocks if b.get("status") == "pending"]

    # 1. Break Shortening (Low Impact, Compliance Warning)
    for block in pending_blocks:
        if block.get("block_type") == "meal" and block.get("status") == "pending":
            duration = block.get("expected_duration_minutes") or 30
            # Can shorten to minimum 20 minutes (union requirement)
            if duration > 20:
                save_time = min(duration - 20, time_needed)
                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "type": "break_shortening",
                    "description": f"Shorten {block.get('name', 'meal break')} to 20 min",
                    "time_saved_minutes": save_time,
                    "impact": "low",
                    "action_data": {
                        "block_id": block.get("id"),
                        "new_duration": 20,
                        "old_duration": duration
                    }
                })
                time_needed -= save_time

    # 2. Walking Lunch (Medium Impact, Compliance Warning)
    meal_blocks = [b for b in pending_blocks if b.get("block_type") == "meal"]
    if meal_blocks and time_needed > 0:
        for block in meal_blocks[:1]:  # Only suggest for first meal
            duration = block.get("expected_duration_minutes") or 30
            # Walking lunch saves ~15 minutes (still need 30 min, but work during it)
            save_time = min(15, time_needed)
            suggestions.append({
                "id": str(uuid.uuid4()),
                "type": "walking_lunch",
                "description": f"Take {block.get('name', 'lunch')} as working meal",
                "time_saved_minutes": save_time,
                "impact": "medium",
                "action_data": {
                    "block_id": block.get("id"),
                    "requires_crew_consent": True
                }
            })
            time_needed -= save_time

    # 3. Skip Non-Essential Activities (Low-Medium Impact)
    for block in pending_blocks:
        if block.get("block_type") == "activity" and time_needed > 0:
            duration = block.get("expected_duration_minutes") or 15
            activity_name = block.get("name", "activity")

            # Determine impact based on activity type
            impact = "low"
            if "rehearsal" in activity_name.lower():
                impact = "medium"
            elif "safety" in activity_name.lower() or "meeting" in activity_name.lower():
                continue  # Don't suggest skipping safety or required meetings

            suggestions.append({
                "id": str(uuid.uuid4()),
                "type": "skip_activity",
                "description": f"Skip {activity_name}",
                "time_saved_minutes": duration,
                "impact": impact,
                "action_data": {"block_id": block.get("id")}
            })
            time_needed -= duration

    # 4. Scene Consolidation (Medium Impact)
    # Group scenes by location/setup for consolidation opportunities
    if pending_scenes and time_needed > 0:
        location_groups = defaultdict(list)
        for scene in pending_scenes:
            location = scene.get("set_name") or scene.get("location") or "unknown"
            int_ext = scene.get("int_ext", "")
            key = f"{location}_{int_ext}"
            location_groups[key].append(scene)

        # Find groups with 2+ scenes
        for location_key, group_scenes in location_groups.items():
            if len(group_scenes) >= 2 and time_needed > 0:
                # Consolidating scenes saves setup/breakdown time
                # Estimate: save 10-15 minutes per consolidated scene
                num_to_consolidate = min(len(group_scenes), 3)
                save_time = min((num_to_consolidate - 1) * 12, time_needed)

                location_display = group_scenes[0].get("set_name", "same location")
                scene_numbers = [s.get("scene_number", "?") for s in group_scenes[:num_to_consolidate]]

                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "type": "scene_consolidation",
                    "description": f"Shoot scenes {', '.join(scene_numbers)} back-to-back at {location_display}",
                    "time_saved_minutes": save_time,
                    "impact": "medium",
                    "action_data": {
                        "scene_ids": [s.get("id") for s in group_scenes[:num_to_consolidate]],
                        "location": location_display
                    }
                })
                time_needed -= save_time
                break  # Only suggest one consolidation at a time

    # 5. Schedule Reordering (Medium-High Impact)
    # Suggest shooting simpler scenes first to build momentum
    if pending_scenes and time_needed > 0:
        # Find scenes with shorter estimated durations
        short_scenes = [s for s in pending_scenes if (s.get("estimated_minutes") or 30) <= 20]
        if len(short_scenes) >= 2:
            # Suggest reordering to shoot quick scenes first
            scene_numbers = [s.get("scene_number", "?") for s in short_scenes[:3]]
            # Reordering can save time through crew momentum
            save_time = min(10, time_needed)

            suggestions.append({
                "id": str(uuid.uuid4()),
                "type": "schedule_reordering",
                "description": f"Shoot shorter scenes {', '.join(scene_numbers)} first for momentum",
                "time_saved_minutes": save_time,
                "impact": "medium",
                "action_data": {
                    "scene_ids": [s.get("id") for s in short_scenes[:3]],
                    "rationale": "Build crew momentum with quick wins"
                }
            })
            time_needed -= save_time

    # 6. Scene Cuts (High Impact)
    # Suggest cutting less essential scenes
    if pending_scenes and time_needed > 15:
        # Look for pickup shots, inserts, or shorter scenes that could be cut
        cuttable_scenes = []
        for scene in pending_scenes:
            description = scene.get("description", "").lower()
            scene_type = scene.get("scene_type", "").lower()
            duration = scene.get("estimated_minutes", 30)

            # Identify potentially cuttable scenes
            if any(keyword in description for keyword in ["pickup", "insert", "cutaway", "alternate", "safety"]):
                cuttable_scenes.append((scene, "low_priority", duration))
            elif duration < 15:
                cuttable_scenes.append((scene, "short", duration))

        for scene, reason, duration in cuttable_scenes[:2]:  # Max 2 cut suggestions
            if time_needed > 0:
                save_time = duration
                scene_num = scene.get("scene_number", "?")
                reason_text = "pickup shot" if reason == "low_priority" else "short scene"

                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "type": "scene_cut",
                    "description": f"Cut scene {scene_num} ({reason_text})",
                    "time_saved_minutes": save_time,
                    "impact": "high",
                    "action_data": {
                        "scene_id": scene.get("id"),
                        "scene_number": scene_num,
                        "rationale": f"Non-essential {reason_text}"
                    }
                })
                time_needed -= save_time

    # 7. Move Scenes to Another Day (High Impact)
    # Suggest moving entire scenes to a future shoot day
    if pending_scenes and time_needed > 20:
        # Find scenes that could move to another day (lower priority scenes)
        movable_scenes = pending_scenes[-3:]  # Last 3 scenes on schedule

        for scene in movable_scenes[:1]:  # Only suggest moving one scene at a time
            if time_needed > 0:
                duration = scene.get("estimated_minutes", 30)
                scene_num = scene.get("scene_number", "?")

                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "type": "scene_move",
                    "description": f"Move scene {scene_num} to next shoot day",
                    "time_saved_minutes": duration,
                    "impact": "high",
                    "action_data": {
                        "scene_id": scene.get("id"),
                        "scene_number": scene_num
                    }
                })
                time_needed -= duration

    # 8. Meal Penalty Warning (if approaching 6-hour mark)
    # Check if we're approaching meal penalty based on elapsed time
    if session_data and settings:
        meal_penalty_threshold = settings.get("suggestion_trigger_meal_penalty_minutes", 30)
        started_at = session_data.get("started_at")
        first_shot_at = session_data.get("first_shot_confirmed_at") or started_at

        if first_shot_at:
            from datetime import datetime, timezone
            if isinstance(first_shot_at, str):
                first_shot_dt = datetime.fromisoformat(first_shot_at.replace('Z', '+00:00'))
            else:
                first_shot_dt = first_shot_at

            now = datetime.now(timezone.utc)
            elapsed_minutes = (now - first_shot_dt).total_seconds() / 60

            # Check for meal breaks
            meal_taken = any(
                b.get("block_type") == "meal" and b.get("status") == "completed"
                for b in schedule_blocks
            )

            # Approaching 6-hour meal penalty (360 minutes)
            minutes_to_penalty = 360 - elapsed_minutes
            if not meal_taken and 0 < minutes_to_penalty <= meal_penalty_threshold:
                suggestions.append({
                    "id": str(uuid.uuid4()),
                    "type": "meal_penalty_warning",
                    "description": f"Meal break needed in {int(minutes_to_penalty)} min to avoid penalty",
                    "time_saved_minutes": 0,  # Warning, not a time-saving suggestion
                    "impact": "high",
                    "action_data": {
                        "minutes_until_penalty": int(minutes_to_penalty),
                        "elapsed_minutes": int(elapsed_minutes),
                        "meal_taken": meal_taken
                    }
                })

    # 9. Wrap Extension Warning (if projected wrap significantly past scheduled)
    if session_data and settings and pending_scenes:
        wrap_extension_threshold = settings.get("suggestion_trigger_wrap_extension_minutes", 30)
        # Calculate total remaining time
        total_remaining = sum(s.get("estimated_minutes", 30) for s in pending_scenes)
        total_remaining += sum(b.get("expected_duration_minutes", 15) for b in pending_blocks)

        # If remaining time + deviation pushes us past threshold
        if total_remaining > wrap_extension_threshold:
            suggestions.append({
                "id": str(uuid.uuid4()),
                "type": "wrap_extension_warning",
                "description": f"Projected wrap is {total_remaining} min over scheduled time",
                "time_saved_minutes": 0,  # Warning, not a time-saving suggestion
                "impact": "high",
                "action_data": {
                    "extension_minutes": total_remaining,
                    "remaining_scenes": len(pending_scenes),
                    "remaining_blocks": len(pending_blocks)
                }
            })

    # 10. Extend Day into Overtime (Medium-High Impact, Cost Warning)
    # Last resort: accept going into OT
    if time_needed > 0 and session_data:
        day_type = session_data.get("day_type", "10hr")
        ot_threshold = OT_THRESHOLDS.get(day_type, {}).get("ot1_after", 10)

        # Suggest accepting OT if significantly behind
        if deviation_minutes >= 30:
            suggestions.append({
                "id": str(uuid.uuid4()),
                "type": "extend_day",
                "description": f"Accept {time_needed} min of overtime to complete schedule",
                "time_saved_minutes": 0,  # Doesn't actually save time, but resolves schedule issue
                "impact": "high",
                "action_data": {
                    "additional_minutes": time_needed,
                    "ot_threshold_hours": ot_threshold,
                    "cost_impact": "Triggers OT rates (1.5x after threshold)"
                }
            })

    # Sort suggestions by:
    # 1. Type priority (warnings first, then low impact, then medium, then high)
    # 2. Time saved (more is better)
    def get_sort_key(suggestion):
        s_type = suggestion["type"]
        # Warnings should appear first
        if s_type in ["meal_penalty_warning", "wrap_extension_warning"]:
            return (0, -suggestion["time_saved_minutes"])
        # Then sort by impact and time saved
        impact_priority = {"low": 1, "medium": 2, "high": 3}
        return (impact_priority.get(suggestion["impact"], 2), -suggestion["time_saved_minutes"])

    suggestions.sort(key=get_sort_key)

    # Limit to top 6 suggestions (allow for 2 warnings + 4 actionable suggestions)
    return suggestions[:6]


def minutes_to_time(minutes: int) -> str:
    """Convert minutes since midnight to HH:MM format"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def calculate_realtime_deviation(
    all_items: List[dict],
    current_time: datetime,
    session_start_time: Optional[datetime] = None
) -> None:
    """
    Calculate real-time deviation for each schedule item.

    Real-time deviation compares:
    - What SHOULD be happening now (based on planned schedule + cumulative variance)
    - What IS happening now (current item in progress)

    Negative deviation = behind schedule (should be further along)
    Positive deviation = ahead of schedule

    Modifies all_items in place by adding 'realtime_deviation_minutes' field.
    """
    if not all_items:
        return

    # Get current time in minutes since session start (or midnight if no session start)
    if session_start_time:
        try:
            # Ensure both times are timezone-aware for proper comparison
            if current_time.tzinfo is None and session_start_time.tzinfo is not None:
                from datetime import timezone
                current_time = current_time.replace(tzinfo=timezone.utc)
            elif current_time.tzinfo is not None and session_start_time.tzinfo is None:
                from datetime import timezone
                session_start_time = session_start_time.replace(tzinfo=timezone.utc)

            current_minutes = int((current_time - session_start_time).total_seconds() / 60)
        except TypeError as e:
            # Fallback to current time if timezone mismatch occurs
            import logging
            logging.error(f"Timezone mismatch in calculate_realtime_deviation: {e}")
            current_time_str = current_time.strftime("%H:%M")
            current_minutes = time_to_minutes(current_time_str)
            session_start_time = None  # Fall through to non-session logic

        # Convert all planned times to minutes since session start
        if session_start_time:  # Check again in case fallback occurred
            session_start_time_str = session_start_time.strftime("%H:%M")
            session_start_minutes = time_to_minutes(session_start_time_str)

        def adjust_to_session_minutes(time_str: str) -> int:
            """Convert HH:MM to minutes since session start"""
            time_mins = time_to_minutes(time_str)
            # Handle day wrap-around (if time is before session start, add 24 hours)
            if time_mins < session_start_minutes:
                time_mins += 24 * 60
            return time_mins - session_start_minutes
    else:
        # Fall back to minutes since midnight
        current_time_str = current_time.strftime("%H:%M")
        current_minutes = time_to_minutes(current_time_str)

        def adjust_to_session_minutes(time_str: str) -> int:
            return time_to_minutes(time_str)

    # Find what should be happening now (with cumulative variance applied)
    expected_item_index = None
    for i, item in enumerate(all_items):
        # Use projected times (which include cumulative variance)
        projected_start = item.get("projected_start_time") or item.get("planned_start_time")
        projected_end = item.get("projected_end_time") or item.get("planned_end_time")

        proj_start_mins = adjust_to_session_minutes(projected_start)
        proj_end_mins = adjust_to_session_minutes(projected_end)

        # Check if current time falls within this item's projected window
        if proj_start_mins <= current_minutes < proj_end_mins:
            expected_item_index = i
            break

    # Find what IS happening now (in_progress item)
    actual_item_index = None
    for i, item in enumerate(all_items):
        if item.get("status") == "in_progress" or item.get("is_current"):
            actual_item_index = i
            break

    # Calculate real-time deviation for each item
    for i, item in enumerate(all_items):
        if item["status"] == "completed":
            # Completed items: deviation is based on when they finished vs when they should have
            if item.get("actual_end_time"):
                projected_end = item.get("projected_end_time") or item.get("planned_end_time")
                # For simplicity, mark completed items with 0 deviation
                # (The cumulative variance already captures their impact)
                item["realtime_deviation_minutes"] = 0
            else:
                item["realtime_deviation_minutes"] = 0

        elif item["status"] == "in_progress":
            # Current item: compare to expected position
            if expected_item_index is not None:
                # Negative = behind (actual < expected), Positive = ahead (actual > expected)
                deviation = expected_item_index - actual_item_index if actual_item_index is not None else 0
                # Convert to approximate minutes (each item position ~= 1 item worth of time behind)
                # Use the item's planned duration as a rough estimate
                if deviation != 0:
                    avg_duration = item.get("planned_duration_minutes", 30)
                    item["realtime_deviation_minutes"] = -deviation * avg_duration
                else:
                    item["realtime_deviation_minutes"] = 0
            else:
                item["realtime_deviation_minutes"] = 0

        elif item["status"] == "pending":
            # Pending items: show how far ahead/behind we are relative to this item
            projected_start = item.get("projected_start_time") or item.get("planned_start_time")
            proj_start_mins = adjust_to_session_minutes(projected_start)

            # Deviation = how many minutes until this item should start
            # Negative = we're behind (should have started already)
            # Positive = we're ahead (not time for this yet)
            time_until_start = proj_start_mins - current_minutes
            item["realtime_deviation_minutes"] = time_until_start

        else:
            # Skipped or other status
            item["realtime_deviation_minutes"] = 0


def calculate_projected_schedule(
    scenes: List[dict],
    schedule_blocks: List[dict],
    imported_schedule: List[dict],
    session: dict,
    current_time: datetime
) -> List[dict]:
    """
    Calculate projected schedule with cascading variance.

    Merges scenes and schedule_blocks into chronological order,
    then projects future times based on actual durations of completed items.

    Returns list of ProjectedScheduleItem dicts.
    """
    import uuid

    # Build unified list of all schedule items
    all_items = []

    # Map scenes by multiple keys for better matching
    scene_by_start = {}
    scene_by_number = {}
    for scene in scenes:
        # Map by start time
        start = scene.get("expected_start_time") or scene.get("scheduled_start_time")
        if start:
            scene_by_start[start] = scene
        # Map by scene number (normalized)
        scene_num = scene.get("scene_number")
        if scene_num:
            # Normalize scene number for matching (strip whitespace, lowercase)
            normalized = str(scene_num).strip().lower()
            scene_by_number[normalized] = scene

    # Map schedule blocks by multiple keys
    block_by_start = {}
    block_by_name = {}
    block_by_type = {}  # Fallback: map by block_type for items like camera_reset
    block_by_original_id = {}  # Map by original frontend-generated ID
    for block in schedule_blocks:
        start = block.get("expected_start_time")
        if start:
            block_by_start[start] = block
        name = block.get("name")
        if name:
            block_by_name[str(name).strip().lower()] = block
        # Also index by block_type for fallback matching
        block_type = block.get("block_type")
        if block_type:
            if block_type not in block_by_type:
                block_by_type[block_type] = []
            block_by_type[block_type].append(block)
        # Also index by original_schedule_block_id for direct matching
        original_id = block.get("original_schedule_block_id")
        if original_id:
            block_by_original_id[original_id] = block

    # Use imported_schedule as the base for ordering
    for sched_item in imported_schedule:
        item_type = sched_item.get("type", "activity")
        start_time = sched_item.get("start_time", "00:00")
        end_time = sched_item.get("end_time", "00:00")
        duration = sched_item.get("duration_minutes") or (time_to_minutes(end_time) - time_to_minutes(start_time))

        # Check if this matches a scene or schedule block
        # For scenes, try to match by scene_number first, then by start_time
        matched_scene = None
        if item_type == "scene":
            sched_scene_num = sched_item.get("scene_number")
            if sched_scene_num:
                normalized_num = str(sched_scene_num).strip().lower()
                matched_scene = scene_by_number.get(normalized_num)
            if not matched_scene:
                matched_scene = scene_by_start.get(start_time)

        # For blocks, try to match by original ID first (most reliable), then name, then start_time, then type
        matched_block = None
        if not matched_scene:
            # First try: match by original_schedule_block_id (direct link from import)
            sched_id = sched_item.get("id")
            if sched_id:
                matched_block = block_by_original_id.get(sched_id)

            # Second try: match by name
            if not matched_block:
                sched_name = sched_item.get("name") or sched_item.get("activity_name")
                if sched_name:
                    normalized_name = str(sched_name).strip().lower()
                    matched_block = block_by_name.get(normalized_name)

            # Third try: match by start_time
            if not matched_block:
                matched_block = block_by_start.get(start_time)

            # Fourth try: match by block_type (useful for camera_reset, lighting_reset, etc.)
            if not matched_block and item_type in block_by_type:
                for candidate in block_by_type[item_type]:
                    matched_block = candidate
                    break

        if item_type == "scene" and matched_scene:
            # Use actual scene data
            all_items.append({
                "id": matched_scene.get("id") or str(uuid.uuid4()),
                "type": "scene",
                "name": matched_scene.get("scene_number") or sched_item.get("scene_number") or "Scene",
                "description": matched_scene.get("set_name") or sched_item.get("slugline"),
                "planned_start_time": start_time,
                "planned_end_time": end_time,
                "planned_duration_minutes": matched_scene.get("estimated_minutes") or duration,
                "actual_start_time": matched_scene.get("actual_start_time"),
                "actual_end_time": matched_scene.get("actual_end_time"),
                "actual_duration_minutes": matched_scene.get("actual_duration_minutes"),
                "status": matched_scene.get("status", "pending"),
                "source_type": "scene_log",
                "source_id": matched_scene.get("id"),
            })
        elif matched_block:
            # Use actual schedule block data
            all_items.append({
                "id": matched_block.get("id") or str(uuid.uuid4()),
                "type": matched_block.get("block_type") or item_type,
                "name": matched_block.get("name") or sched_item.get("name") or sched_item.get("activity_name") or item_type.title(),
                "description": matched_block.get("location_name") or sched_item.get("location"),
                "planned_start_time": start_time,
                "planned_end_time": end_time,
                "planned_duration_minutes": matched_block.get("expected_duration_minutes") or duration,
                "actual_start_time": matched_block.get("actual_start_time"),
                "actual_end_time": matched_block.get("actual_end_time"),
                "actual_duration_minutes": None,  # Blocks don't track actual duration yet
                "status": matched_block.get("status", "pending"),
                "source_type": "schedule_block",
                "source_id": matched_block.get("id"),
            })
        else:
            # Use imported schedule data directly
            all_items.append({
                "id": sched_item.get("id") or str(uuid.uuid4()),
                "type": item_type,
                "name": sched_item.get("scene_number") or sched_item.get("name") or sched_item.get("activity_name") or item_type.title(),
                "description": sched_item.get("slugline") or sched_item.get("location"),
                "planned_start_time": start_time,
                "planned_end_time": end_time,
                "planned_duration_minutes": duration,
                "actual_start_time": None,
                "actual_end_time": None,
                "actual_duration_minutes": None,
                "status": "pending",
                "source_type": "imported",
                "source_id": sched_item.get("id"),
            })

    # Sort by planned start time
    all_items.sort(key=lambda x: time_to_minutes(x["planned_start_time"]))

    # Calculate cumulative variance and project future times
    cumulative_variance_minutes = 0  # Positive = ahead of schedule, Negative = behind

    for item in all_items:
        planned_start_minutes = time_to_minutes(item["planned_start_time"])
        planned_duration = item["planned_duration_minutes"]

        if item["status"] == "completed":
            # Use actual times, calculate variance
            actual_duration = item.get("actual_duration_minutes")
            if actual_duration is not None:
                variance = planned_duration - actual_duration  # Positive = faster than planned
                cumulative_variance_minutes += variance
                item["variance_from_plan"] = cumulative_variance_minutes

            # Projected times are actual times for completed items
            if item.get("actual_start_time"):
                # Convert ISO timestamp to HH:MM if needed
                actual_start = item["actual_start_time"]
                if "T" in actual_start:
                    try:
                        dt = datetime.fromisoformat(actual_start.replace("Z", "+00:00"))
                        item["projected_start_time"] = dt.strftime("%H:%M")
                    except:
                        item["projected_start_time"] = item["planned_start_time"]
                else:
                    item["projected_start_time"] = actual_start
            else:
                item["projected_start_time"] = item["planned_start_time"]

            if item.get("actual_end_time"):
                actual_end = item["actual_end_time"]
                if "T" in actual_end:
                    try:
                        dt = datetime.fromisoformat(actual_end.replace("Z", "+00:00"))
                        item["projected_end_time"] = dt.strftime("%H:%M")
                    except:
                        item["projected_end_time"] = item["planned_end_time"]
                else:
                    item["projected_end_time"] = actual_end
            else:
                item["projected_end_time"] = item["planned_end_time"]

        elif item["status"] == "in_progress":
            # Current item - mark as current, project based on cumulative variance
            item["is_current"] = True
            projected_start = planned_start_minutes + cumulative_variance_minutes
            item["projected_start_time"] = minutes_to_time(projected_start)
            item["projected_end_time"] = minutes_to_time(projected_start + planned_duration)
            item["variance_from_plan"] = cumulative_variance_minutes

        elif item["status"] == "skipped":
            # Skipped item - add its planned duration to variance (we're ahead by that much)
            cumulative_variance_minutes += planned_duration
            item["projected_start_time"] = item["planned_start_time"]
            item["projected_end_time"] = item["planned_end_time"]
            item["variance_from_plan"] = cumulative_variance_minutes

        else:
            # Pending item - apply cumulative variance
            projected_start = planned_start_minutes + cumulative_variance_minutes
            item["projected_start_time"] = minutes_to_time(projected_start)
            item["projected_end_time"] = minutes_to_time(projected_start + planned_duration)
            item["variance_from_plan"] = cumulative_variance_minutes

    # Calculate real-time deviation for all items
    session_start_time = None
    if session.get("actual_call_time"):
        try:
            session_start_time = datetime.fromisoformat(session["actual_call_time"].replace("Z", "+00:00"))
        except:
            pass
    elif session.get("started_at"):
        try:
            session_start_time = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))
        except:
            pass

    calculate_realtime_deviation(all_items, current_time, session_start_time)

    return all_items


def calculate_ot_projection(
    projected_schedule: List[dict],
    session: dict,
    crew: List[dict] = None
) -> Optional[dict]:
    """
    Calculate projected OT based on projected wrap time.

    Returns OTProjectionData dict or None if no schedule.
    """
    if not projected_schedule:
        return None

    day_type = session.get("day_type", "10hr")
    thresholds = OT_THRESHOLDS.get(day_type, OT_THRESHOLDS["10hr"])

    # Find projected wrap time
    wrap_block = None
    for block in reversed(projected_schedule):
        if block.get("type") == "wrap":
            wrap_block = block
            break

    # If no explicit wrap block, use the last item's end time
    if wrap_block:
        projected_wrap_time = wrap_block.get("projected_end_time") or wrap_block.get("projected_start_time") or wrap_block.get("planned_start_time")
    elif projected_schedule:
        last_item = projected_schedule[-1]
        projected_wrap_time = last_item.get("projected_end_time") or last_item.get("planned_end_time")
    else:
        return None

    # Get call time
    call_time_str = session.get("actual_call_time")
    if call_time_str and "T" in call_time_str:
        try:
            call_dt = datetime.fromisoformat(call_time_str.replace("Z", "+00:00"))
            call_time = call_dt.strftime("%H:%M")
        except:
            call_time = "06:00"
    else:
        call_time = call_time_str or "06:00"

    # Calculate total hours
    call_minutes = time_to_minutes(call_time)
    wrap_minutes = time_to_minutes(projected_wrap_time)
    total_minutes = wrap_minutes - call_minutes
    total_hours = total_minutes / 60 if total_minutes > 0 else 0

    # Calculate OT breakdown
    ot1_after = thresholds["ot1_after"]
    ot2_after = thresholds["ot2_after"]

    if day_type == "7th_day":
        # 7th day: all hours at double time
        regular_hours = 0
        ot1_hours = 0
        ot2_hours = total_hours
    else:
        if total_hours <= ot1_after:
            regular_hours = total_hours
            ot1_hours = 0
            ot2_hours = 0
        elif total_hours <= ot2_after:
            regular_hours = ot1_after
            ot1_hours = total_hours - ot1_after
            ot2_hours = 0
        else:
            regular_hours = ot1_after
            ot1_hours = ot2_after - ot1_after
            ot2_hours = total_hours - ot2_after

    # Calculate cost if crew data available
    projected_ot_cost = 0
    crew_count = 0
    crew_with_rates = 0

    if crew:
        crew_count = len(crew)
        default_rate = session.get("default_hourly_rate") or 35
        ot_mult_1 = session.get("ot_multiplier_1") or 1.5
        ot_mult_2 = session.get("ot_multiplier_2") or 2.0

        for person in crew:
            rate = person.get("rate_amount") or default_rate
            if person.get("rate_amount"):
                crew_with_rates += 1

            # Only count OT cost (regular time is expected)
            ot1_cost = ot1_hours * rate * ot_mult_1
            ot2_cost = ot2_hours * rate * ot_mult_2
            projected_ot_cost += ot1_cost + ot2_cost

    return {
        "projected_wrap_time": projected_wrap_time,
        "call_time": call_time,
        "total_hours": round(total_hours, 2),
        "regular_hours": round(regular_hours, 2),
        "ot1_hours": round(ot1_hours, 2),
        "ot2_hours": round(ot2_hours, 2),
        "projected_ot_cost": round(projected_ot_cost, 2),
        "crew_count": crew_count,
        "crew_with_rates": crew_with_rates,
    }


def build_schedule_from_scenes(
    scenes: List[dict],
    schedule_blocks: List[dict],
    session: dict,
    current_time: datetime
) -> List[dict]:
    """
    Build a projected schedule directly from scenes and schedule blocks
    when no imported_schedule exists.

    This creates a simple chronological list without the full variance cascade.
    """
    import uuid

    all_items = []

    # Get call time for calculating start times
    call_time_str = session.get("actual_call_time")
    if call_time_str and "T" in call_time_str:
        try:
            call_dt = datetime.fromisoformat(call_time_str.replace("Z", "+00:00"))
            running_time_minutes = call_dt.hour * 60 + call_dt.minute
        except:
            running_time_minutes = 6 * 60  # Default 6 AM
    else:
        running_time_minutes = 6 * 60  # Default 6 AM

    # Add scenes
    cumulative_variance = 0
    for scene in scenes:
        estimated = scene.get("estimated_minutes") or 30
        scheduled_start = scene.get("scheduled_start_time") or scene.get("expected_start_time")

        # Calculate planned start time
        if scheduled_start:
            planned_start = scheduled_start
            planned_start_minutes = time_to_minutes(scheduled_start)
        else:
            planned_start = minutes_to_time(running_time_minutes)
            planned_start_minutes = running_time_minutes

        planned_end_minutes = planned_start_minutes + estimated
        planned_end = minutes_to_time(planned_end_minutes)

        # Calculate actual duration and variance for completed scenes
        actual_duration = scene.get("actual_duration_minutes")
        if scene.get("status") == "completed" and actual_duration is not None:
            variance = estimated - actual_duration
            cumulative_variance += variance

        # Project times based on variance
        projected_start_minutes = planned_start_minutes + cumulative_variance
        projected_end_minutes = projected_start_minutes + estimated

        item = {
            "id": scene.get("id") or str(uuid.uuid4()),
            "type": "scene",
            "name": scene.get("scene_number") or "Scene",
            "description": scene.get("set_name") or scene.get("description"),
            "planned_start_time": planned_start,
            "planned_end_time": planned_end,
            "planned_duration_minutes": estimated,
            "projected_start_time": minutes_to_time(projected_start_minutes),
            "projected_end_time": minutes_to_time(projected_end_minutes),
            "variance_from_plan": cumulative_variance,
            "actual_start_time": scene.get("actual_start_time"),
            "actual_end_time": scene.get("actual_end_time"),
            "actual_duration_minutes": actual_duration,
            "status": scene.get("status", "pending"),
            "is_current": scene.get("status") == "in_progress",
            "source_type": "scene_log",
            "source_id": scene.get("id"),
        }
        all_items.append(item)

        # Advance running time if no explicit schedule
        if not scheduled_start:
            running_time_minutes = planned_end_minutes

    # Add schedule blocks (meals, company moves, etc.)
    for block in schedule_blocks:
        expected_start = block.get("expected_start_time", "12:00")
        expected_end = block.get("expected_end_time", "12:30")
        duration = block.get("expected_duration_minutes") or 30

        start_minutes = time_to_minutes(expected_start)
        projected_start_minutes = start_minutes + cumulative_variance

        item = {
            "id": block.get("id") or str(uuid.uuid4()),
            "type": block.get("block_type", "activity"),
            "name": block.get("name", "Activity"),
            "description": block.get("location_name"),
            "planned_start_time": expected_start,
            "planned_end_time": expected_end,
            "planned_duration_minutes": duration,
            "projected_start_time": minutes_to_time(projected_start_minutes),
            "projected_end_time": minutes_to_time(projected_start_minutes + duration),
            "variance_from_plan": cumulative_variance,
            "actual_start_time": block.get("actual_start_time"),
            "actual_end_time": block.get("actual_end_time"),
            "actual_duration_minutes": None,
            "status": block.get("status", "pending"),
            "is_current": block.get("status") == "in_progress",
            "source_type": "schedule_block",
            "source_id": block.get("id"),
        }
        all_items.append(item)

    # Sort by planned start time
    all_items.sort(key=lambda x: time_to_minutes(x["planned_start_time"]))

    return all_items


# =============================================================================
# SESSION ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/hot-set/sessions")
async def list_sessions(
    project_id: str,
    authorization: str = Header(None)
):
    """List all Hot Set sessions for a project"""
    import logging
    logger = logging.getLogger(__name__)

    try:
        logger.info(f"[HotSet] list_sessions called for project {project_id}")
        user = await get_current_user_from_token(authorization)
        logger.info(f"[HotSet] User authenticated: {user.get('id')}")
        client = get_client()

        if not await verify_project_access(client, project_id, user["id"]):
            logger.warning(f"[HotSet] Access denied for user {user.get('id')} on project {project_id}")
            raise HTTPException(status_code=403, detail="Not a project member")

        logger.info(f"[HotSet] Querying backlot_hot_set_sessions table")
        result = client.table("backlot_hot_set_sessions").select(
            "*, production_day:backlot_production_days!production_day_id(day_number, date, title)"
        ).eq("project_id", project_id).order("created_at", desc=True).execute()

        logger.info(f"[HotSet] Query successful, found {len(result.data or [])} sessions")
        return result.data or []
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[HotSet] Error in list_sessions: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hot set error: {str(e)}")


@router.get("/projects/{project_id}/hot-set/sessions/{session_id}")
async def get_session(
    project_id: str,
    session_id: str,
    authorization: str = Header(None)
):
    """Get a specific Hot Set session"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    result = client.table("backlot_hot_set_sessions").select(
        "*, production_day:backlot_production_days!production_day_id(day_number, date, title, general_call_time)"
    ).eq("id", session_id).eq("project_id", project_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    return result.data[0]


@router.post("/projects/{project_id}/hot-set/sessions")
async def create_session(
    project_id: str,
    body: HotSetSessionCreate,
    authorization: str = Header(None)
):
    """Create a new Hot Set session for a production day"""
    import logging
    logger = logging.getLogger(__name__)

    try:
        user = await get_current_user_from_token(authorization)
        client = get_client()

        if not await verify_project_edit(client, project_id, user["id"]):
            raise HTTPException(status_code=403, detail="Not authorized to manage Hot Set")

        # Check if session already exists for this day
        existing = client.table("backlot_hot_set_sessions").select("id").eq(
            "production_day_id", body.production_day_id
        ).execute()

        if existing.data:
            raise HTTPException(status_code=400, detail="Session already exists for this production day")

        # Create session (convert empty string to None for call_sheet_id)
        session_data = {
            "project_id": project_id,
            "production_day_id": body.production_day_id,
            "call_sheet_id": body.call_sheet_id if body.call_sheet_id else None,
            "day_type": body.day_type,
            "schedule_tracking_mode": body.schedule_tracking_mode or "auto_reorder",
        }

        # Import timezone and location from call sheet if available
        if body.call_sheet_id:
            call_sheet = client.table("backlot_call_sheets").select(
                "timezone, timezone_offset, location_name, location_address"
            ).eq("id", body.call_sheet_id).execute()

            if call_sheet.data:
                cs_data = call_sheet.data[0]
                if cs_data.get("timezone"):
                    session_data["timezone"] = cs_data["timezone"]
                if cs_data.get("timezone_offset"):
                    session_data["timezone_offset"] = cs_data["timezone_offset"]
                if cs_data.get("location_name"):
                    session_data["location_name"] = cs_data["location_name"]
                if cs_data.get("location_address"):
                    session_data["location_address"] = cs_data["location_address"]
                logger.info(f"[HotSet] Imported timezone from call sheet: {cs_data.get('timezone')}")

        # Update project Hot Set settings if auto-start config provided
        if body.auto_start is not None or body.auto_start_minutes is not None:
            settings_update = {}
            if body.auto_start is not None:
                settings_update["auto_start_enabled"] = body.auto_start
            if body.auto_start_minutes is not None:
                settings_update["auto_start_minutes_before_call"] = body.auto_start_minutes

            if settings_update:
                # Check if settings exist
                existing_settings = client.table("backlot_hot_set_settings").select("id").eq(
                    "project_id", project_id
                ).execute()

                if existing_settings.data:
                    # Update existing settings
                    client.table("backlot_hot_set_settings").update(settings_update).eq(
                        "project_id", project_id
                    ).execute()
                else:
                    # Create new settings with defaults
                    client.table("backlot_hot_set_settings").insert({
                        "project_id": project_id,
                        **settings_update
                    }).execute()

        logger.info(f"[HotSet] Creating session with data: {session_data}")
        result = client.table("backlot_hot_set_sessions").insert(session_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to insert session into database")

        session = result.data[0]
        logger.info(f"[HotSet] Session created: {session['id']}")

        # Handle new checkbox-based import options (take precedence over legacy import_source)
        if body.import_hour_schedule is not None or body.import_scenes is not None:
            # New checkbox mode
            import_results = {}

            scenes_imported_from_hour_schedule = 0

            if body.import_hour_schedule:
                # Import from production day's hour schedule
                logger.info(f"[HotSet] Importing hour schedule for day {body.production_day_id}")
                import_result = await import_from_hour_schedule(
                    client, session["id"], body.production_day_id
                )
                import_results["hour_schedule"] = import_result
                scenes_imported_from_hour_schedule = import_result.get("scenes_imported", 0)

            if body.import_scenes:
                if body.call_sheet_id:
                    # Import scenes from call sheet
                    logger.info(f"[HotSet] Importing scenes from call sheet {body.call_sheet_id}")
                    result = await import_scenes_from_call_sheet(client, session["id"], body.call_sheet_id)
                    import_results["scenes"] = result
                elif scenes_imported_from_hour_schedule == 0:
                    # Fallback: Import scenes from production day's assigned scenes
                    # Only do this if no scenes were imported from hour_schedule
                    logger.info(f"[HotSet] No call sheet and no hour_schedule scenes - importing from production day {body.production_day_id}")
                    result = await import_scenes_from_production_day(client, session["id"], body.production_day_id)
                    import_results["scenes"] = result
                else:
                    logger.info(f"[HotSet] Skipping production day scene import - {scenes_imported_from_hour_schedule} scenes already imported from hour_schedule")

            # Update session with import source info
            import_sources = []
            if body.import_hour_schedule:
                import_sources.append("hour_schedule")
            if body.import_scenes:
                import_sources.append("scenes")

            if import_sources:
                client.table("backlot_hot_set_sessions").update({
                    "schedule_import_source": ",".join(import_sources)
                }).eq("id", session["id"]).execute()

            session["_import_result"] = import_results
        else:
            # Legacy mode: use import_source parameter
            import_source = body.import_source
            if not import_source:
                # Legacy behavior: use import_from_call_sheet flag
                if body.import_from_call_sheet and body.call_sheet_id:
                    import_source = "call_sheet"
                else:
                    import_source = "none"

            # Import based on source
            if import_source == "hour_schedule":
                # Import from production day's hour schedule
                import_result = await import_from_hour_schedule(
                    client, session["id"], body.production_day_id
                )
                session["_import_result"] = import_result
            elif import_source == "call_sheet" and body.call_sheet_id:
                # Legacy: Import scenes from call sheet
                await import_scenes_from_call_sheet(client, session["id"], body.call_sheet_id)
                # Update session with import source
                client.table("backlot_hot_set_sessions").update({
                    "schedule_import_source": "call_sheet"
                }).eq("id", session["id"]).execute()

        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[HotSet] Error creating session: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.put("/hot-set/sessions/{session_id}")
async def update_session(
    session_id: str,
    body: HotSetSessionUpdate,
    authorization: str = Header(None)
):
    """Update Hot Set session configuration"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get session to verify project access
    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {k: v for k, v in body.dict().items() if v is not None}

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_hot_set_sessions").update(update_data).eq(
        "id", session_id
    ).execute()

    return result.data[0] if result.data else None


@router.delete("/hot-set/sessions/{session_id}")
async def delete_session(
    session_id: str,
    authorization: str = Header(None)
):
    """Delete a Hot Set session"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    client.table("backlot_hot_set_sessions").delete().eq("id", session_id).execute()

    return {"success": True}


class SessionNotesUpdate(BaseModel):
    notes: str


@router.patch("/hot-set/sessions/{session_id}/notes")
async def update_session_notes(
    session_id: str,
    body: SessionNotesUpdate,
    authorization: str = Header(None)
):
    """Update AD notes for a Hot Set session (optimized for auto-save)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = client.table("backlot_hot_set_sessions").update({
        "notes": body.notes
    }).eq("id", session_id).execute()

    return {"success": True, "notes": body.notes}


# =============================================================================
# SESSION ACTIONS
# =============================================================================

@router.post("/hot-set/sessions/{session_id}/start")
async def start_session(
    session_id: str,
    authorization: str = Header(None)
):
    """Start the production day (set actual call time)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.utcnow().isoformat() + "Z"

    result = client.table("backlot_hot_set_sessions").update({
        "status": "in_progress",
        "actual_call_time": now,
        "started_at": now,
    }).eq("id", session_id).execute()

    # Add call time marker
    client.table("backlot_hot_set_markers").insert({
        "session_id": session_id,
        "marker_type": "call_time",
        "timestamp": now,
        "label": "Day Started",
    }).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/wrap")
async def wrap_session(
    session_id: str,
    authorization: str = Header(None)
):
    """Wrap the production day"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.utcnow().isoformat() + "Z"

    result = client.table("backlot_hot_set_sessions").update({
        "status": "wrapped",
        "actual_wrap_time": now,
        "wrapped_at": now,
    }).eq("id", session_id).execute()

    # Add wrap marker
    client.table("backlot_hot_set_markers").insert({
        "session_id": session_id,
        "marker_type": "wrap",
        "timestamp": now,
        "label": "Day Wrapped",
    }).execute()

    # Mark any in_progress scenes as completed
    client.table("backlot_hot_set_scene_logs").update({
        "status": "completed",
        "actual_end_time": now,
    }).eq("session_id", session_id).eq("status", "in_progress").execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/resume")
async def resume_session(
    session_id: str,
    authorization: str = Header(None)
):
    """Resume a wrapped production day (in case of accidental wrap)

    Sets the session status back to in_progress and clears the wrap time.
    Only allowed on the same calendar day as the wrap.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session_data = session.data[0]
    project_id = session_data["project_id"]

    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Only allow resuming wrapped sessions
    if session_data["status"] != "wrapped":
        raise HTTPException(
            status_code=400,
            detail="Can only resume wrapped sessions"
        )

    # Check if wrap was on the same calendar day (allow resume within reasonable time)
    wrapped_at = session_data.get("wrapped_at")
    if wrapped_at:
        try:
            wrap_time = datetime.fromisoformat(wrapped_at.replace("Z", "+00:00"))
            now = datetime.utcnow().replace(tzinfo=wrap_time.tzinfo)
            hours_since_wrap = (now - wrap_time).total_seconds() / 3600

            # Allow resume within 12 hours of wrap
            if hours_since_wrap > 12:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot resume session more than 12 hours after wrap"
                )
        except (ValueError, TypeError):
            pass  # If we can't parse the time, allow the resume

    now = datetime.utcnow().isoformat() + "Z"

    # Update session status back to in_progress
    result = client.table("backlot_hot_set_sessions").update({
        "status": "in_progress",
        "actual_wrap_time": None,
        "wrapped_at": None,
    }).eq("id", session_id).execute()

    # Add resume marker for audit trail
    client.table("backlot_hot_set_markers").insert({
        "session_id": session_id,
        "marker_type": "resume",
        "timestamp": now,
        "label": "Day Resumed",
        "notes": f"Resumed by user after accidental wrap",
    }).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/import-from-call-sheet")
async def import_from_call_sheet(
    session_id: str,
    call_sheet_id: str = Query(...),
    authorization: str = Header(None)
):
    """Import scenes and crew from a call sheet"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await import_scenes_from_call_sheet(client, session_id, call_sheet_id)

    # Update session with call sheet ID
    client.table("backlot_hot_set_sessions").update({
        "call_sheet_id": call_sheet_id
    }).eq("id", session_id).execute()

    return {
        "success": True,
        "scenes_imported": result.get("scenes_imported", 0),
    }


@router.post("/hot-set/sessions/{session_id}/import-from-production-day")
async def import_from_production_day_endpoint(
    session_id: str,
    authorization: str = Header(None)
):
    """Import scenes from the production day's assigned scenes"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    production_day_id = session.data[0]["production_day_id"]

    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await import_scenes_from_production_day(client, session_id, production_day_id)

    return {
        "success": True,
        "scenes_imported": result.get("scenes_imported", 0),
    }


@router.post("/hot-set/sessions/{session_id}/import-from-hour-schedule")
async def import_from_hour_schedule_endpoint(
    session_id: str,
    authorization: str = Header(None)
):
    """Import hour schedule from the production day"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    production_day_id = session.data[0]["production_day_id"]

    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await import_from_hour_schedule(client, session_id, production_day_id)

    return {
        "success": True,
        "scenes_imported": result.get("scenes_imported", 0),
        "blocks_imported": result.get("blocks_imported", 0),
    }




async def import_scenes_from_call_sheet(client, session_id: str, call_sheet_id: str):
    """Import scenes from call sheet into hot set scene logs"""
    scenes = client.table("backlot_call_sheet_scenes").select("*").eq(
        "call_sheet_id", call_sheet_id
    ).order("sort_order").execute()

    for i, scene in enumerate(scenes.data or []):
        client.table("backlot_hot_set_scene_logs").insert({
            "session_id": session_id,
            "call_sheet_scene_id": scene["id"],
            "scene_number": scene.get("scene_number"),
            "set_name": scene.get("set_name"),
            "int_ext": scene.get("int_ext"),
            "description": scene.get("description"),
            "estimated_minutes": scene.get("estimated_time_minutes") or 30,  # Default 30 min
            "sort_order": i,
            "status": "pending",
        }).execute()

    return {"scenes_imported": len(scenes.data or [])}


async def import_scenes_from_production_day(client, session_id: str, production_day_id: str):
    """
    Import scenes from production day's assigned scenes (backlot_production_day_scenes).
    This is used when no hour_schedule or call_sheet is available.
    """
    import logging
    logger = logging.getLogger(__name__)

    # Get scenes assigned to this production day with scene details
    day_scenes = client.table("backlot_production_day_scenes").select(
        "*, scene:scene_id(id, scene_number, slugline, set_name, description, page_length, int_ext, time_of_day)"
    ).eq("production_day_id", production_day_id).order("sort_order").execute()

    if not day_scenes.data:
        logger.info(f"[HotSet] No scenes assigned to production day {production_day_id}")
        return {"scenes_imported": 0}

    logger.info(f"[HotSet] Importing {len(day_scenes.data)} scenes from production day")

    scenes_imported = 0
    for i, day_scene in enumerate(day_scenes.data):
        scene = day_scene.get("scene") or {}

        # Create scene log (note: table doesn't have scene_id column, uses call_sheet_scene_id for call sheet refs)
        client.table("backlot_hot_set_scene_logs").insert({
            "session_id": session_id,
            "scene_number": scene.get("scene_number") or day_scene.get("scene_number"),
            "set_name": scene.get("set_name") or scene.get("slugline"),
            "int_ext": scene.get("int_ext"),
            "description": scene.get("description") or scene.get("slugline"),
            "estimated_minutes": day_scene.get("estimated_time_minutes") or 30,
            "expected_start_time": day_scene.get("scheduled_time"),
            "sort_order": i,
            "status": "pending",
        }).execute()
        scenes_imported += 1

    logger.info(f"[HotSet] Imported {scenes_imported} scenes from production day")
    return {"scenes_imported": scenes_imported}


async def import_from_hour_schedule(client, session_id: str, production_day_id: str):
    """
    Import hour schedule from production day into hot set session.
    Creates scene logs for scene blocks and schedule blocks for non-scene items.
    """
    import uuid

    # Get production day with hour_schedule
    day_result = client.table("backlot_production_days").select(
        "hour_schedule"
    ).eq("id", production_day_id).execute()

    if not day_result.data:
        return {"scenes_imported": 0, "blocks_imported": 0}

    hour_schedule = day_result.data[0].get("hour_schedule") or []

    if not hour_schedule:
        return {"scenes_imported": 0, "blocks_imported": 0}

    # Store the imported schedule snapshot on the session
    client.table("backlot_hot_set_sessions").update({
        "imported_schedule": hour_schedule,
        "schedule_import_source": "hour_schedule",
    }).eq("id", session_id).execute()

    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"[HotSet] Importing hour schedule with {len(hour_schedule)} blocks")

    scenes_imported = 0
    blocks_imported = 0
    scene_sort_order = 0
    block_sort_order = 0

    for block in hour_schedule:
        logger.info(f"[HotSet] Processing block: type={block.get('type')}, scene_number={block.get('scene_number')}, activity_name={block.get('activity_name')}")
        block_type = block.get("type", "")

        # Handle scene blocks - includes 'scene' type and 'segment' type (non-scripted segments)
        if block_type == "scene" or block_type == "segment":
            # Create scene log with expected times
            scene_name = block.get("scene_number") or block.get("activity_name") or block.get("segment_name")
            set_name = block.get("scene_slugline") or block.get("activity_name") or block.get("segment_name")

            client.table("backlot_hot_set_scene_logs").insert({
                "session_id": session_id,
                "scene_number": scene_name,
                "set_name": set_name,
                "description": set_name,
                "estimated_minutes": block.get("duration_minutes") or 30,
                "expected_start_time": block.get("start_time"),
                "expected_end_time": block.get("end_time"),
                "expected_duration_minutes": block.get("duration_minutes"),
                "sort_order": scene_sort_order,
                "status": "pending",
            }).execute()
            scenes_imported += 1
            scene_sort_order += 1
            logger.info(f"[HotSet] Created scene log for: {scene_name}")

        elif block_type in ["meal", "company_move", "activity", "crew_call", "first_shot", "wrap", "camera_reset", "lighting_reset"]:
            # Create schedule block for non-scene items
            block_name = block.get("activity_name") or block_type.replace("_", " ").title()
            if block_type == "meal":
                block_name = "Meal Break"
            elif block_type == "company_move":
                block_name = f"Move to {block.get('location_name', 'Next Location')}"
            elif block_type == "crew_call":
                block_name = "Crew Call"
            elif block_type == "first_shot":
                block_name = "First Shot"
            elif block_type == "wrap":
                block_name = "Wrap"
            elif block_type == "camera_reset":
                block_name = block.get("activity_name") or "Camera/Lighting Reset"
            elif block_type == "lighting_reset":
                block_name = block.get("activity_name") or "Lighting Reset (Day/Night)"

            client.table("backlot_hot_set_schedule_blocks").insert({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "block_type": block_type,
                "expected_start_time": block.get("start_time"),
                "expected_end_time": block.get("end_time"),
                "expected_duration_minutes": block.get("duration_minutes") or 30,
                "name": block_name,
                "location_name": block.get("location_name"),
                "notes": block.get("activity_notes"),
                "original_schedule_block_id": block.get("id"),
                "sort_order": block_sort_order,
                "status": "pending",
            }).execute()
            blocks_imported += 1
            block_sort_order += 1

    logger.info(f"[HotSet] Import complete: {scenes_imported} scenes, {blocks_imported} blocks")
    return {"scenes_imported": scenes_imported, "blocks_imported": blocks_imported}


# =============================================================================
# SCENE PROGRESSION
# =============================================================================

@router.get("/hot-set/sessions/{session_id}/scenes")
async def get_scenes(
    session_id: str,
    authorization: str = Header(None)
):
    """Get all scenes for a session"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    result = client.table("backlot_hot_set_scene_logs").select("*").eq(
        "session_id", session_id
    ).order("sort_order").execute()

    return result.data or []


@router.post("/hot-set/sessions/{session_id}/scenes/{scene_id}/start")
async def start_scene(
    session_id: str,
    scene_id: str,
    authorization: str = Header(None)
):
    """Start shooting a scene"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.utcnow().isoformat() + "Z"

    # Mark any currently in_progress scenes as completed first
    in_progress = client.table("backlot_hot_set_scene_logs").select("*").eq(
        "session_id", session_id
    ).eq("status", "in_progress").execute()

    for scene in (in_progress.data or []):
        start_time = scene.get("actual_start_time")
        duration = calculate_elapsed_minutes(start_time) if start_time else 0
        client.table("backlot_hot_set_scene_logs").update({
            "status": "completed",
            "actual_end_time": now,
            "actual_duration_minutes": duration,
        }).eq("id", scene["id"]).execute()

    # Start the new scene
    result = client.table("backlot_hot_set_scene_logs").update({
        "status": "in_progress",
        "actual_start_time": now,
    }).eq("id", scene_id).execute()

    # Update first shot time if this is the first scene
    if not session.data[0].get("actual_first_shot_time"):
        client.table("backlot_hot_set_sessions").update({
            "actual_first_shot_time": now,
        }).eq("id", session_id).execute()

        # Add first shot marker
        client.table("backlot_hot_set_markers").insert({
            "session_id": session_id,
            "marker_type": "first_shot",
            "timestamp": now,
            "label": "First Shot",
        }).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/scenes/{scene_id}/complete")
async def complete_scene(
    session_id: str,
    scene_id: str,
    notes: Optional[str] = None,
    authorization: str = Header(None)
):
    """Complete a scene"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get scene to calculate duration
    scene = client.table("backlot_hot_set_scene_logs").select("*").eq(
        "id", scene_id
    ).execute()

    if not scene.data:
        raise HTTPException(status_code=404, detail="Scene not found")

    now = datetime.utcnow().isoformat() + "Z"
    start_time = scene.data[0].get("actual_start_time")
    duration = calculate_elapsed_minutes(start_time) if start_time else 0

    update_data = {
        "status": "completed",
        "actual_end_time": now,
        "actual_duration_minutes": duration,
    }
    if notes:
        update_data["notes"] = notes

    result = client.table("backlot_hot_set_scene_logs").update(update_data).eq(
        "id", scene_id
    ).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/scenes/{scene_id}/skip")
async def skip_scene(
    session_id: str,
    scene_id: str,
    reason: Optional[str] = None,
    authorization: str = Header(None)
):
    """Skip a scene"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    result = client.table("backlot_hot_set_scene_logs").update({
        "status": "skipped",
        "skip_reason": reason,
    }).eq("id", scene_id).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/scenes/reorder")
async def reorder_scenes(
    session_id: str,
    body: SceneReorder,
    authorization: str = Header(None)
):
    """Reorder scenes in the queue"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    for i, scene_id in enumerate(body.scene_ids):
        client.table("backlot_hot_set_scene_logs").update({
            "sort_order": i
        }).eq("id", scene_id).execute()

    return {"success": True}


# =============================================================================
# MARKERS
# =============================================================================

@router.get("/hot-set/sessions/{session_id}/markers")
async def get_markers(
    session_id: str,
    authorization: str = Header(None)
):
    """Get all time markers for a session"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    result = client.table("backlot_hot_set_markers").select("*").eq(
        "session_id", session_id
    ).order("timestamp").execute()

    return result.data or []


@router.post("/hot-set/sessions/{session_id}/markers")
async def add_marker(
    session_id: str,
    body: MarkerCreate,
    authorization: str = Header(None)
):
    """Add a time marker"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    timestamp = body.timestamp or (datetime.utcnow().isoformat() + "Z")

    result = client.table("backlot_hot_set_markers").insert({
        "session_id": session_id,
        "marker_type": body.marker_type,
        "timestamp": timestamp,
        "label": body.label,
        "notes": body.notes,
    }).execute()

    return result.data[0] if result.data else None


# =============================================================================
# DASHBOARD (REAL-TIME VIEW)
# =============================================================================

@router.get("/hot-set/sessions/{session_id}/dashboard")
async def get_dashboard(
    session_id: str,
    authorization: str = Header(None)
):
    """Get all data needed for the real-time dashboard view"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get session
    session_result = client.table("backlot_hot_set_sessions").select(
        "*, production_day:backlot_production_days!production_day_id(day_number, date, title)"
    ).eq("id", session_id).execute()

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_result.data[0]
    project_id = session["project_id"]

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Get scenes
    scenes_result = client.table("backlot_hot_set_scene_logs").select("*").eq(
        "session_id", session_id
    ).order("sort_order").execute()
    scenes = scenes_result.data or []

    # Categorize scenes
    current_scene = None
    next_scenes = []
    completed_scenes = []

    for scene in scenes:
        if scene["status"] == "in_progress":
            current_scene = scene
        elif scene["status"] == "completed":
            completed_scenes.append(scene)
        elif scene["status"] == "pending":
            next_scenes.append(scene)

    # Get markers
    markers_result = client.table("backlot_hot_set_markers").select("*").eq(
        "session_id", session_id
    ).order("timestamp").execute()
    markers = markers_result.data or []

    # Calculate time stats
    # NOTE: Using UTC for all calculations. Future: Use production location timezone
    from datetime import timezone
    now = datetime.now(timezone.utc)
    call_time = session.get("actual_call_time")
    elapsed_minutes = calculate_elapsed_minutes(call_time) if call_time else 0

    ot_threshold_1_at = None
    ot_threshold_2_at = None
    if call_time:
        try:
            call_dt = datetime.fromisoformat(call_time.replace("Z", "+00:00"))
            ot_threshold_1_at = (call_dt + timedelta(hours=session["ot_threshold_1_hours"])).isoformat()
            ot_threshold_2_at = (call_dt + timedelta(hours=session["ot_threshold_2_hours"])).isoformat()
        except:
            pass

    # Calculate projected wrap based on remaining scenes
    remaining_minutes = sum(s.get("estimated_minutes") or 30 for s in next_scenes)
    if current_scene:
        remaining_minutes += (current_scene.get("estimated_minutes") or 30)
        if current_scene.get("actual_start_time"):
            elapsed_on_current = calculate_elapsed_minutes(current_scene["actual_start_time"])
            remaining_minutes -= min(elapsed_on_current, current_scene.get("estimated_minutes") or 30)

    projected_wrap_time = (now + timedelta(minutes=remaining_minutes)).isoformat() + "Z"

    time_stats = TimeStats(
        call_time=call_time,
        first_shot_time=session.get("actual_first_shot_time"),
        current_time=now.isoformat() + "Z",
        elapsed_minutes=elapsed_minutes,
        ot_threshold_1_at=ot_threshold_1_at,
        ot_threshold_2_at=ot_threshold_2_at,
        projected_wrap_time=projected_wrap_time,
    )

    # Calculate schedule status
    variance = calculate_schedule_variance(scenes, session)
    scenes_completed = len(completed_scenes)
    scenes_total = len(scenes)
    percent_complete = (scenes_completed / scenes_total * 100) if scenes_total > 0 else 0

    if variance > 5:
        status = "ahead"
    elif variance < -5:
        status = "behind"
    else:
        status = "on_time"

    schedule_status = ScheduleStatus(
        status=status,
        variance_minutes=variance,
        scenes_completed=scenes_completed,
        scenes_total=scenes_total,
        percent_complete=round(percent_complete, 1),
    )

    # Calculate cost projection (simplified for MVP)
    cost_projection = CostProjection(
        current_regular_cost=0,
        current_ot1_cost=0,
        current_ot2_cost=0,
        current_total_cost=0,
        projected_regular_cost=0,
        projected_ot1_cost=0,
        projected_ot2_cost=0,
        projected_total_cost=0,
        ot_overage_alert=False,
    )

    # Get schedule blocks (non-scene items)
    schedule_blocks_result = client.table("backlot_hot_set_schedule_blocks").select("*").eq(
        "session_id", session_id
    ).order("sort_order").execute()
    schedule_blocks = schedule_blocks_result.data or []

    # Calculate schedule deviation with expected times
    schedule_deviation, current_expected_block, next_expected_block = calculate_schedule_deviation(
        scenes, schedule_blocks, now, session
    )

    # Generate catch-up suggestions if behind schedule
    # Get project settings for suggestion triggers
    project_id = session.get("project_id")
    hot_set_settings = None
    if project_id:
        settings_result = client.table("backlot_hot_set_settings").select("*").eq(
            "project_id", project_id
        ).execute()
        if settings_result.data:
            hot_set_settings = settings_result.data[0]

    catch_up_suggestions = generate_catch_up_suggestions(
        schedule_deviation,
        scenes,
        schedule_blocks,
        session_data=session,
        settings=hot_set_settings
    )

    # Build timeline data
    timeline_data = None
    imported_schedule = session.get("imported_schedule") or []
    if imported_schedule and call_time:
        # Find day start and end from schedule
        first_block = imported_schedule[0] if imported_schedule else None
        last_block = imported_schedule[-1] if imported_schedule else None
        day_start = first_block.get("start_time", "06:00") if first_block else "06:00"
        day_end = last_block.get("end_time", "18:00") if last_block else "18:00"

        # Calculate expected position (minutes from day start)
        day_start_minutes = time_to_minutes(day_start)
        current_minutes = time_to_minutes(now.strftime("%H:%M"))
        expected_position = max(0, current_minutes - day_start_minutes)

        # Calculate actual position based on work completed
        actual_position = sum(
            s.get("actual_duration_minutes") or 0
            for s in scenes
            if s.get("status") == "completed"
        )
        # Add time for current scene if in progress
        if current_scene and current_scene.get("actual_start_time"):
            actual_position += calculate_elapsed_minutes(current_scene["actual_start_time"])

        timeline_data = TimelineData(
            day_start=day_start,
            day_end=day_end,
            current_time=now.strftime("%H:%M"),
            expected_position_minutes=expected_position,
            actual_position_minutes=actual_position,
        )

    # Calculate projected schedule with live updates
    projected_schedule_data = []
    ot_projection_data = None

    if imported_schedule:
        # Use imported schedule as base
        projected_schedule_data = calculate_projected_schedule(
            scenes=scenes,
            schedule_blocks=schedule_blocks,
            imported_schedule=imported_schedule,
            session=session,
            current_time=now
        )
    elif scenes or schedule_blocks:
        # Fallback: Build schedule from scenes and schedule_blocks directly
        projected_schedule_data = build_schedule_from_scenes(
            scenes=scenes,
            schedule_blocks=schedule_blocks,
            session=session,
            current_time=now
        )

    if projected_schedule_data:
        # Get crew data for OT calculation
        crew_result = client.table("backlot_hot_set_crew").select("*").eq(
            "session_id", session_id
        ).execute()
        crew = crew_result.data or []

        ot_projection_data = calculate_ot_projection(
            projected_schedule=projected_schedule_data,
            session=session,
            crew=crew
        )

    return HotSetDashboard(
        session=HotSetSession(**session),
        current_scene=HotSetSceneLog(**current_scene) if current_scene else None,
        next_scenes=[HotSetSceneLog(**s) for s in next_scenes],
        completed_scenes=[HotSetSceneLog(**s) for s in completed_scenes],
        markers=[HotSetMarker(**m) for m in markers],
        time_stats=time_stats,
        cost_projection=cost_projection,
        schedule_status=schedule_status,
        schedule_blocks=[HotSetScheduleBlockModel(**b) for b in schedule_blocks],
        schedule_deviation_minutes=schedule_deviation,
        current_expected_block=current_expected_block,
        next_expected_block=next_expected_block,
        catch_up_suggestions=[CatchUpSuggestion(**s) for s in catch_up_suggestions],
        timeline=timeline_data,
        projected_schedule=[ProjectedScheduleItem(**p) for p in projected_schedule_data],
        ot_projection=OTProjectionData(**ot_projection_data) if ot_projection_data else None,
    )


# =============================================================================
# WRAP REPORT
# =============================================================================

class WrapReportScene(BaseModel):
    scene_number: str
    actual_minutes: int
    status: str


class WrapReportMarker(BaseModel):
    type: str
    time: str
    label: str


class WrapReportResponse(BaseModel):
    day_number: int
    date: str
    call_time: Optional[str] = None
    wrap_time: Optional[str] = None
    total_shooting_minutes: int
    scenes_completed: List[WrapReportScene]
    scenes_skipped: List[WrapReportScene]
    scheduled_minutes: int
    variance_minutes: int
    ad_notes: Optional[str] = None
    markers: List[WrapReportMarker]


@router.get("/hot-set/sessions/{session_id}/wrap-report")
async def get_wrap_report(
    session_id: str,
    authorization: str = Header(None)
):
    """Get wrap day report with summary data"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Get session with production day info
    session_result = client.table("backlot_hot_set_sessions").select(
        "*, production_day:backlot_production_days!production_day_id(day_number, date, title)"
    ).eq("id", session_id).execute()

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_result.data[0]
    project_id = session["project_id"]

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Get scenes
    scenes_result = client.table("backlot_hot_set_scene_logs").select("*").eq(
        "session_id", session_id
    ).order("sort_order").execute()
    scenes = scenes_result.data or []

    # Get markers
    markers_result = client.table("backlot_hot_set_markers").select("*").eq(
        "session_id", session_id
    ).order("timestamp").execute()
    markers = markers_result.data or []

    # Categorize scenes
    completed_scenes = []
    skipped_scenes = []
    total_shooting_minutes = 0
    scheduled_minutes = 0

    for scene in scenes:
        scheduled_minutes += scene.get("estimated_minutes") or scene.get("expected_duration_minutes") or 30
        if scene["status"] == "completed":
            actual_mins = scene.get("actual_duration_minutes") or 0
            total_shooting_minutes += actual_mins
            completed_scenes.append(WrapReportScene(
                scene_number=scene.get("scene_number") or "Unknown",
                actual_minutes=actual_mins,
                status="completed"
            ))
        elif scene["status"] == "skipped":
            skipped_scenes.append(WrapReportScene(
                scene_number=scene.get("scene_number") or "Unknown",
                actual_minutes=0,
                status=scene.get("skip_reason") or "skipped"
            ))

    # Format markers
    report_markers = []
    for marker in markers:
        try:
            timestamp = marker.get("timestamp", "")
            if timestamp:
                marker_time = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                time_str = marker_time.strftime("%H:%M")
            else:
                time_str = "--:--"
        except:
            time_str = "--:--"

        report_markers.append(WrapReportMarker(
            type=marker.get("marker_type", "custom"),
            time=time_str,
            label=marker.get("label") or marker.get("marker_type", "")
        ))

    # Calculate variance
    variance = scheduled_minutes - total_shooting_minutes

    # Get production day info
    production_day = session.get("production_day") or {}

    # Format call and wrap times
    call_time_str = None
    wrap_time_str = None
    if session.get("actual_call_time"):
        try:
            call_dt = datetime.fromisoformat(session["actual_call_time"].replace("Z", "+00:00"))
            call_time_str = call_dt.strftime("%H:%M")
        except:
            pass
    if session.get("actual_wrap_time"):
        try:
            wrap_dt = datetime.fromisoformat(session["actual_wrap_time"].replace("Z", "+00:00"))
            wrap_time_str = wrap_dt.strftime("%H:%M")
        except:
            pass

    return WrapReportResponse(
        day_number=production_day.get("day_number", 0),
        date=production_day.get("date", ""),
        call_time=call_time_str,
        wrap_time=wrap_time_str,
        total_shooting_minutes=total_shooting_minutes,
        scenes_completed=completed_scenes,
        scenes_skipped=skipped_scenes,
        scheduled_minutes=scheduled_minutes,
        variance_minutes=variance,
        ad_notes=session.get("notes"),
        markers=report_markers
    )


# =============================================================================
# COST PROJECTION
# =============================================================================

@router.get("/hot-set/sessions/{session_id}/cost-projection")
async def get_cost_projection(
    session_id: str,
    authorization: str = Header(None)
):
    """Get detailed cost projection with crew breakdown"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session_result = client.table("backlot_hot_set_sessions").select("*").eq(
        "id", session_id
    ).execute()

    if not session_result.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_result.data[0]
    project_id = session["project_id"]

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Get crew
    crew_result = client.table("backlot_hot_set_crew").select("*").eq(
        "session_id", session_id
    ).execute()
    crew = crew_result.data or []

    # Calculate costs based on elapsed time
    call_time = session.get("actual_call_time")
    elapsed_hours = calculate_elapsed_minutes(call_time) / 60 if call_time else 0

    ot1_threshold = session["ot_threshold_1_hours"]
    ot2_threshold = session["ot_threshold_2_hours"]
    ot1_mult = float(session["ot_multiplier_1"])
    ot2_mult = float(session["ot_multiplier_2"])

    total_regular = 0
    total_ot1 = 0
    total_ot2 = 0

    for person in crew:
        rate = float(person.get("rate_amount") or session.get("default_hourly_rate") or 25)

        if elapsed_hours <= ot1_threshold:
            regular_hrs = elapsed_hours
            ot1_hrs = 0
            ot2_hrs = 0
        elif elapsed_hours <= ot2_threshold:
            regular_hrs = ot1_threshold
            ot1_hrs = elapsed_hours - ot1_threshold
            ot2_hrs = 0
        else:
            regular_hrs = ot1_threshold
            ot1_hrs = ot2_threshold - ot1_threshold
            ot2_hrs = elapsed_hours - ot2_threshold

        total_regular += regular_hrs * rate
        total_ot1 += ot1_hrs * rate * ot1_mult
        total_ot2 += ot2_hrs * rate * ot2_mult

    return {
        "current_regular_cost": round(total_regular, 2),
        "current_ot1_cost": round(total_ot1, 2),
        "current_ot2_cost": round(total_ot2, 2),
        "current_total_cost": round(total_regular + total_ot1 + total_ot2, 2),
        "elapsed_hours": round(elapsed_hours, 2),
        "crew_count": len(crew),
        "ot_threshold_1_hours": ot1_threshold,
        "ot_threshold_2_hours": ot2_threshold,
    }


@router.get("/hot-set/sessions/{session_id}/crew")
async def get_crew(
    session_id: str,
    authorization: str = Header(None)
):
    """Get crew members for a session"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    result = client.table("backlot_hot_set_crew").select("*").eq(
        "session_id", session_id
    ).order("department").execute()

    return result.data or []


# =============================================================================
# SCHEDULE BLOCKS
# =============================================================================

@router.get("/hot-set/sessions/{session_id}/schedule-blocks")
async def get_schedule_blocks(
    session_id: str,
    authorization: str = Header(None)
):
    """Get all schedule blocks (non-scene items) for a session"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    result = client.table("backlot_hot_set_schedule_blocks").select("*").eq(
        "session_id", session_id
    ).order("sort_order").execute()

    return result.data or []


@router.put("/hot-set/sessions/{session_id}/schedule-blocks/{block_id}")
async def update_schedule_block(
    session_id: str,
    block_id: str,
    body: ScheduleBlockUpdate,
    authorization: str = Header(None)
):
    """Update a schedule block's expected times or notes"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Build update data
    update_data = {}
    if body.expected_start_time is not None:
        update_data["expected_start_time"] = body.expected_start_time
    if body.expected_end_time is not None:
        update_data["expected_end_time"] = body.expected_end_time
    if body.notes is not None:
        update_data["notes"] = body.notes

    # Recalculate duration if times changed
    if "expected_start_time" in update_data or "expected_end_time" in update_data:
        # Get current block for existing values
        block = client.table("backlot_hot_set_schedule_blocks").select("*").eq(
            "id", block_id
        ).execute()
        if block.data:
            start = update_data.get("expected_start_time") or block.data[0].get("expected_start_time")
            end = update_data.get("expected_end_time") or block.data[0].get("expected_end_time")
            if start and end:
                start_mins = time_to_minutes(start)
                end_mins = time_to_minutes(end)
                update_data["expected_duration_minutes"] = max(0, end_mins - start_mins)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = client.table("backlot_hot_set_schedule_blocks").update(update_data).eq(
        "id", block_id
    ).eq("session_id", session_id).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/schedule-blocks/{block_id}/start")
async def start_schedule_block(
    session_id: str,
    block_id: str,
    authorization: str = Header(None)
):
    """Start a schedule block (e.g., start meal break)"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verify block exists - try by ID first, then by original_schedule_block_id (frontend ID)
    existing_block = client.table("backlot_hot_set_schedule_blocks").select("id").eq(
        "id", block_id
    ).eq("session_id", session_id).execute()

    # If not found by ID, try by original_schedule_block_id (handles frontend-generated IDs)
    actual_block_id = block_id
    if not existing_block.data:
        existing_block = client.table("backlot_hot_set_schedule_blocks").select("id").eq(
            "original_schedule_block_id", block_id
        ).eq("session_id", session_id).execute()
        if existing_block.data:
            actual_block_id = existing_block.data[0]["id"]

    if not existing_block.data:
        raise HTTPException(
            status_code=404,
            detail=f"Schedule block not found. Block ID '{block_id}' may not have been imported into the session."
        )

    now = datetime.utcnow().isoformat() + "Z"

    result = client.table("backlot_hot_set_schedule_blocks").update({
        "status": "in_progress",
        "actual_start_time": now,
    }).eq("id", actual_block_id).eq("session_id", session_id).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/schedule-blocks/{block_id}/complete")
async def complete_schedule_block(
    session_id: str,
    block_id: str,
    authorization: str = Header(None)
):
    """Complete a schedule block and auto-create corresponding marker"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    now = datetime.utcnow().isoformat() + "Z"

    # Get block details - try by ID first, then by original_schedule_block_id
    block = client.table("backlot_hot_set_schedule_blocks").select("*").eq(
        "id", block_id
    ).execute()

    # If not found by ID, try by original_schedule_block_id (handles frontend-generated IDs)
    actual_block_id = block_id
    if not block.data:
        block = client.table("backlot_hot_set_schedule_blocks").select("*").eq(
            "original_schedule_block_id", block_id
        ).eq("session_id", session_id).execute()
        if block.data:
            actual_block_id = block.data[0]["id"]

    if not block.data:
        raise HTTPException(status_code=404, detail="Schedule block not found")

    block_data = block.data[0]
    block_type = block_data.get("block_type")
    block_name = block_data.get("name")

    # Map block type to marker type
    marker_type_map = {
        "meal": "meal_out",
        "company_move": "company_move",
        "crew_call": "call_time",
        "first_shot": "first_shot",
        "wrap": "wrap",
        "camera_reset": "custom",
        "lighting_reset": "custom",
    }
    marker_type = marker_type_map.get(block_type, "custom")

    # Create marker
    marker_result = client.table("backlot_hot_set_markers").insert({
        "session_id": session_id,
        "marker_type": marker_type,
        "timestamp": now,
        "label": f"{block_name} Complete",
    }).execute()

    marker_id = marker_result.data[0]["id"] if marker_result.data else None

    # Update block
    result = client.table("backlot_hot_set_schedule_blocks").update({
        "status": "completed",
        "actual_end_time": now,
        "linked_marker_id": marker_id,
    }).eq("id", actual_block_id).eq("session_id", session_id).execute()

    return result.data[0] if result.data else None


@router.post("/hot-set/sessions/{session_id}/schedule-blocks/{block_id}/skip")
async def skip_schedule_block(
    session_id: str,
    block_id: str,
    reason: Optional[str] = None,
    authorization: str = Header(None)
):
    """Skip a schedule block"""
    user = await get_current_user_from_token(authorization)
    client = get_client()

    session = client.table("backlot_hot_set_sessions").select("project_id").eq(
        "id", session_id
    ).execute()

    if not session.data:
        raise HTTPException(status_code=404, detail="Session not found")

    project_id = session.data[0]["project_id"]
    if not await verify_project_edit(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verify block exists - try by ID first, then by original_schedule_block_id
    existing_block = client.table("backlot_hot_set_schedule_blocks").select("id").eq(
        "id", block_id
    ).eq("session_id", session_id).execute()

    # If not found by ID, try by original_schedule_block_id (handles frontend-generated IDs)
    actual_block_id = block_id
    if not existing_block.data:
        existing_block = client.table("backlot_hot_set_schedule_blocks").select("id").eq(
            "original_schedule_block_id", block_id
        ).eq("session_id", session_id).execute()
        if existing_block.data:
            actual_block_id = existing_block.data[0]["id"]

    if not existing_block.data:
        raise HTTPException(
            status_code=404,
            detail=f"Schedule block not found. Block ID '{block_id}' may not have been imported into the session."
        )

    update_data = {"status": "skipped"}
    if reason:
        update_data["notes"] = reason

    result = client.table("backlot_hot_set_schedule_blocks").update(update_data).eq(
        "id", actual_block_id
    ).eq("session_id", session_id).execute()

    return result.data[0] if result.data else None


# =============================================================================
# DAY PREVIEW (for session creation with OT projection)
# =============================================================================

def calculate_hours_from_schedule(hour_schedule: list, hour_schedule_config: dict = None) -> dict:
    """
    Calculate expected hours from hour schedule.
    Returns call_time, wrap_time, and total_hours.
    """
    if not hour_schedule:
        # Fallback: assume 10 hour day
        return {
            "call_time": None,
            "wrap_time": None,
            "total_hours": 10.0
        }

    # Find crew_call block for call time
    call_time = None
    wrap_time = None

    for block in hour_schedule:
        block_type = block.get("type", "")
        if block_type == "crew_call":
            call_time = block.get("start_time")
        elif block_type == "wrap":
            wrap_time = block.get("end_time") or block.get("start_time")

    # If no explicit crew_call, use config or first block
    if not call_time:
        if hour_schedule_config and hour_schedule_config.get("crew_call_time"):
            call_time = hour_schedule_config["crew_call_time"]
        elif hour_schedule:
            call_time = hour_schedule[0].get("start_time")

    # If no explicit wrap, use last block end time
    if not wrap_time and hour_schedule:
        wrap_time = hour_schedule[-1].get("end_time")

    # Calculate total hours
    total_hours = 10.0  # default
    if call_time and wrap_time:
        try:
            call_parts = call_time.split(":")
            wrap_parts = wrap_time.split(":")
            call_minutes = int(call_parts[0]) * 60 + int(call_parts[1])
            wrap_minutes = int(wrap_parts[0]) * 60 + int(wrap_parts[1])
            # Handle overnight shoots
            if wrap_minutes < call_minutes:
                wrap_minutes += 24 * 60
            total_hours = (wrap_minutes - call_minutes) / 60.0
        except (ValueError, IndexError):
            pass

    return {
        "call_time": call_time,
        "wrap_time": wrap_time,
        "total_hours": total_hours
    }


def get_effective_rate(client, project_id: str, user_id: str = None, role_id: str = None, role_title: str = None):
    """
    Get effective rate for a person. Priority:
    1. User-specific rate
    2. Role-based rate
    3. Booking rate
    """
    # 1. Try user-specific rate
    if user_id:
        user_rate = client.table("backlot_crew_rates").select(
            "rate_type, rate_amount"
        ).eq("project_id", project_id).eq("user_id", user_id).execute()
        if user_rate.data:
            return {
                "rate_type": user_rate.data[0]["rate_type"],
                "rate_amount": float(user_rate.data[0]["rate_amount"]),
                "source": "user"
            }

    # 2. Try role-based rate (by role_id)
    if role_id:
        role_rate = client.table("backlot_crew_rates").select(
            "rate_type, rate_amount"
        ).eq("project_id", project_id).eq("role_id", role_id).execute()
        if role_rate.data:
            return {
                "rate_type": role_rate.data[0]["rate_type"],
                "rate_amount": float(role_rate.data[0]["rate_amount"]),
                "source": "role"
            }

    # 3. Try role-based rate (by role_title match)
    if role_title:
        role_rate = client.table("backlot_crew_rates").select(
            "rate_type, rate_amount"
        ).eq("project_id", project_id).eq("role_title", role_title).execute()
        if role_rate.data:
            return {
                "rate_type": role_rate.data[0]["rate_type"],
                "rate_amount": float(role_rate.data[0]["rate_amount"]),
                "source": "role"
            }

    # 4. Try booking rate if user is booked
    if user_id:
        booking = client.table("backlot_booked_people").select(
            "booking_rate"
        ).eq("project_id", project_id).eq("user_id", user_id).execute()
        if booking.data and booking.data[0].get("booking_rate"):
            # Parse booking rate (format: "$X/hr" or "$X/day" etc)
            rate_str = booking.data[0]["booking_rate"]
            try:
                # Simple parsing - extract number and detect type
                import re
                match = re.search(r'\$?([\d,]+(?:\.\d+)?)', rate_str)
                if match:
                    amount = float(match.group(1).replace(',', ''))
                    rate_type = "daily"  # Default
                    if "/hr" in rate_str.lower() or "hour" in rate_str.lower():
                        rate_type = "hourly"
                    elif "/wk" in rate_str.lower() or "week" in rate_str.lower():
                        rate_type = "weekly"
                    return {
                        "rate_type": rate_type,
                        "rate_amount": amount,
                        "source": "booking"
                    }
            except (ValueError, AttributeError):
                pass

    return None


def calculate_person_cost(rate: dict, total_hours: float, day_type: str, ot1_mult: float = 1.5, ot2_mult: float = 2.0) -> float:
    """Calculate projected cost for a person based on rate and expected hours."""
    if not rate:
        return None

    rate_type = rate.get("rate_type", "hourly")
    rate_amount = rate.get("rate_amount", 0)

    # Get OT thresholds for day type
    thresholds = OT_THRESHOLDS.get(day_type, OT_THRESHOLDS['10hr'])
    ot1_after = thresholds['ot1_after']
    ot2_after = thresholds['ot2_after']

    # Calculate hours breakdown
    if day_type == '7th_day':
        # 7th day: all hours at double time
        regular_hours = 0
        ot1_hours = 0
        ot2_hours = total_hours
    else:
        if total_hours <= ot1_after:
            regular_hours = total_hours
            ot1_hours = 0
            ot2_hours = 0
        elif total_hours <= ot2_after:
            regular_hours = ot1_after
            ot1_hours = total_hours - ot1_after
            ot2_hours = 0
        else:
            regular_hours = ot1_after
            ot1_hours = ot2_after - ot1_after
            ot2_hours = total_hours - ot2_after

    if rate_type == "hourly":
        cost = (regular_hours * rate_amount) + \
               (ot1_hours * rate_amount * ot1_mult) + \
               (ot2_hours * rate_amount * ot2_mult)
    elif rate_type == "daily":
        # Daily rate: straight rate up to threshold, then OT multipliers apply
        # Calculate effective hourly rate based on 10hr day standard
        effective_hourly = rate_amount / 10.0
        base_cost = rate_amount
        if total_hours > ot1_after:
            # Add OT on top of daily rate
            ot_hours = total_hours - ot1_after
            if ot_hours > (ot2_after - ot1_after):
                # Has OT2
                ot1_hrs = ot2_after - ot1_after
                ot2_hrs = ot_hours - ot1_hrs
                base_cost += (ot1_hrs * effective_hourly * ot1_mult) + (ot2_hrs * effective_hourly * ot2_mult)
            else:
                base_cost += ot_hours * effective_hourly * ot1_mult
        cost = base_cost
    elif rate_type == "weekly":
        # Weekly rate: calculate daily equivalent
        daily_rate = rate_amount / 5.0
        effective_hourly = daily_rate / 10.0
        base_cost = daily_rate
        if total_hours > ot1_after:
            ot_hours = total_hours - ot1_after
            if ot_hours > (ot2_after - ot1_after):
                ot1_hrs = ot2_after - ot1_after
                ot2_hrs = ot_hours - ot1_hrs
                base_cost += (ot1_hrs * effective_hourly * ot1_mult) + (ot2_hrs * effective_hourly * ot2_mult)
            else:
                base_cost += ot_hours * effective_hourly * ot1_mult
        cost = base_cost
    else:
        # Flat rate
        cost = rate_amount

    return round(cost, 2)


def calculate_day_preview_ot_projection(crew: list, total_hours: float, day_type: str) -> dict:
    """Calculate OT cost projection for all crew."""
    thresholds = OT_THRESHOLDS.get(day_type, OT_THRESHOLDS['10hr'])
    ot1_after = thresholds['ot1_after']
    ot2_after = thresholds['ot2_after']

    # Calculate hours breakdown
    if day_type == '7th_day':
        regular_hours = 0
        ot1_hours = 0
        ot2_hours = total_hours
    else:
        if total_hours <= ot1_after:
            regular_hours = total_hours
            ot1_hours = 0
            ot2_hours = 0
        elif total_hours <= ot2_after:
            regular_hours = ot1_after
            ot1_hours = total_hours - ot1_after
            ot2_hours = 0
        else:
            regular_hours = ot1_after
            ot1_hours = ot2_after - ot1_after
            ot2_hours = total_hours - ot2_after

    total_regular_cost = 0
    total_ot1_cost = 0
    total_ot2_cost = 0
    crew_with_rates = 0
    crew_without_rates = 0

    for person in crew:
        if person.get("has_rate") and person.get("rate_amount"):
            crew_with_rates += 1
            rate_type = person.get("rate_type", "hourly")
            rate_amount = person.get("rate_amount", 0)

            if rate_type == "hourly":
                total_regular_cost += regular_hours * rate_amount
                total_ot1_cost += ot1_hours * rate_amount * 1.5
                total_ot2_cost += ot2_hours * rate_amount * 2.0
            elif rate_type == "daily":
                # Daily: base rate covers regular, OT is extra
                effective_hourly = rate_amount / 10.0
                total_regular_cost += rate_amount
                total_ot1_cost += ot1_hours * effective_hourly * 1.5
                total_ot2_cost += ot2_hours * effective_hourly * 2.0
            elif rate_type == "weekly":
                daily_rate = rate_amount / 5.0
                effective_hourly = daily_rate / 10.0
                total_regular_cost += daily_rate
                total_ot1_cost += ot1_hours * effective_hourly * 1.5
                total_ot2_cost += ot2_hours * effective_hourly * 2.0
            else:
                # Flat rate
                total_regular_cost += rate_amount
        else:
            crew_without_rates += 1

    return {
        "day_type": day_type,
        "ot1_threshold": ot1_after,
        "ot2_threshold": ot2_after,
        "regular_hours": regular_hours,
        "ot1_hours": ot1_hours,
        "ot2_hours": ot2_hours,
        "total_regular_cost": round(total_regular_cost, 2),
        "total_ot1_cost": round(total_ot1_cost, 2),
        "total_ot2_cost": round(total_ot2_cost, 2),
        "total_cost": round(total_regular_cost + total_ot1_cost + total_ot2_cost, 2),
        "crew_with_rates": crew_with_rates,
        "crew_without_rates": crew_without_rates,
    }


@router.get("/projects/{project_id}/hot-set/day-preview")
async def get_day_preview(
    project_id: str,
    production_day_id: str = Query(..., description="Production day ID"),
    day_type: str = Query("10hr", description="Day type for OT calculation"),
    authorization: str = Header(None)
):
    """
    Get preview data for creating a Hot Set session.
    Returns crew from DOOD/Call Sheet, their rates, and OT projections.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    if not await verify_project_access(client, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Validate day_type
    if day_type not in OT_THRESHOLDS:
        day_type = "10hr"

    # 1. Get production day with hour_schedule
    day_result = client.table("backlot_production_days").select(
        "id, day_number, date, title, general_call_time, wrap_time, location_name, hour_schedule"
    ).eq("id", production_day_id).eq("project_id", project_id).execute()

    if not day_result.data:
        raise HTTPException(status_code=404, detail="Production day not found")

    day = day_result.data[0]

    # 2. Calculate expected hours from schedule
    hour_schedule = day.get("hour_schedule") or []
    expected = calculate_hours_from_schedule(hour_schedule)

    # 3. Get DOOD working subjects for this day (code='W')
    dood_workers = []
    day_date = day.get("date")

    # Get day IDs for this production day (matching by date)
    dood_days = client.table("backlot_production_days").select("id").eq(
        "project_id", project_id
    ).eq("date", day_date).execute()

    day_ids = [d["id"] for d in (dood_days.data or [])]

    # Get assignments for this day with code 'W'
    if day_ids:
        dood_assignments = client.table("dood_assignments").select(
            "subject_id, code, notes"
        ).eq("project_id", project_id).in_("day_id", day_ids).eq("code", "W").execute()

        if dood_assignments.data:
            # Get subject details
            subject_ids = list(set(a["subject_id"] for a in dood_assignments.data))
            subjects_result = client.table("dood_subjects").select(
                "id, display_name, subject_type, department, source_type, source_id"
            ).in_("id", subject_ids).execute()

            subjects_map = {s["id"]: s for s in (subjects_result.data or [])}

            for assignment in dood_assignments.data:
                subject = subjects_map.get(assignment["subject_id"])
                if subject:
                    dood_workers.append({
                        "id": subject["id"],
                        "name": subject["display_name"],
                        "role": None,
                        "department": subject.get("department"),
                        "subject_type": subject.get("subject_type"),
                        "source_type": subject.get("source_type"),
                        "source_id": subject.get("source_id"),
                    })

    # 4. Get call sheet people if exists
    call_sheet_people = []
    call_sheets = client.table("backlot_call_sheets").select(
        "id"
    ).eq("production_day_id", production_day_id).execute()

    if call_sheets.data:
        call_sheet_id = call_sheets.data[0]["id"]
        people_result = client.table("backlot_call_sheet_people").select(
            "id, member_id, name, role, department"
        ).eq("call_sheet_id", call_sheet_id).execute()

        for person in (people_result.data or []):
            call_sheet_people.append({
                "id": person["id"],
                "name": person["name"],
                "role": person.get("role"),
                "department": person.get("department"),
                "member_id": person.get("member_id"),
            })

    # 5. Merge and dedupe crew
    crew = []
    seen_names = set()
    seen_member_ids = set()

    # Add DOOD workers first (primary source)
    for worker in dood_workers:
        name_key = worker["name"].lower().strip()
        if name_key not in seen_names:
            seen_names.add(name_key)
            crew.append({
                "id": worker["id"],
                "name": worker["name"],
                "role": worker.get("role"),
                "department": worker.get("department"),
                "source": "dood",
                "user_id": worker.get("source_id") if worker.get("source_type") in ("crew_member", "team_member") else None,
            })

    # Add call sheet people (secondary, mark as 'both' if already exists)
    for person in call_sheet_people:
        name_key = person["name"].lower().strip()
        member_id = person.get("member_id")

        # Check if already added
        if name_key in seen_names:
            # Mark existing entry as 'both'
            for c in crew:
                if c["name"].lower().strip() == name_key:
                    c["source"] = "both"
                    if not c.get("role") and person.get("role"):
                        c["role"] = person["role"]
                    if not c.get("department") and person.get("department"):
                        c["department"] = person["department"]
                    break
            continue

        if member_id and member_id in seen_member_ids:
            continue

        seen_names.add(name_key)
        if member_id:
            seen_member_ids.add(member_id)

        crew.append({
            "id": person["id"],
            "name": person["name"],
            "role": person.get("role"),
            "department": person.get("department"),
            "source": "call_sheet",
            "user_id": member_id,
        })

    # 6. Fetch rates for each person and calculate projected costs
    for person in crew:
        rate = get_effective_rate(
            client,
            project_id,
            user_id=person.get("user_id"),
            role_title=person.get("role")
        )

        if rate:
            person["has_rate"] = True
            person["rate_type"] = rate["rate_type"]
            person["rate_amount"] = rate["rate_amount"]
            person["rate_source"] = rate["source"]
            person["projected_cost"] = calculate_person_cost(
                rate, expected["total_hours"], day_type
            )
        else:
            person["has_rate"] = False
            person["rate_type"] = None
            person["rate_amount"] = None
            person["rate_source"] = None
            person["projected_cost"] = None

    # 7. Calculate OT projection
    ot_projection = calculate_day_preview_ot_projection(crew, expected["total_hours"], day_type)

    return DayPreviewResponse(
        production_day=DayPreviewProductionDay(
            id=day["id"],
            day_number=day["day_number"],
            date=day["date"],
            title=day.get("title"),
            general_call_time=day.get("general_call_time"),
            location_name=day.get("location_name"),
        ),
        expected_hours=DayPreviewExpectedHours(
            call_time=expected["call_time"],
            wrap_time=expected["wrap_time"],
            total_hours=expected["total_hours"],
        ),
        crew=[CrewPreviewPerson(**c) for c in crew],
        ot_projection=OTProjection(**ot_projection),
    )


# =============================================================================
# HOT SET SETTINGS ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/hot-set/settings")
async def get_hot_set_settings(
    project_id: str,
    authorization: str = Header(None)
):
    """
    Get Hot Set settings for a project.
    Creates default settings if none exist.
    """
    user = await get_current_user_from_token(authorization)

    client = get_client()

    # Check if settings exist
    result = client.table("backlot_hot_set_settings")\
        .select("*")\
        .eq("project_id", project_id)\
        .execute()

    if result.data and len(result.data) > 0:
        settings = result.data[0]
        return HotSetSettings(**settings)

    # Create default settings
    from uuid import uuid4
    new_settings = {
        "id": str(uuid4()),
        "project_id": project_id,
        "auto_start_enabled": True,
        "auto_start_minutes_before_call": 30,
        "notifications_enabled": True,
        "notify_minutes_before_call": 30,
        "notify_crew_on_auto_start": True,
        "suggestion_trigger_minutes_behind": 15,
        "suggestion_trigger_meal_penalty_minutes": 30,
        "suggestion_trigger_wrap_extension_minutes": 30,
        "default_schedule_view": "current",
    }

    result = client.table("backlot_hot_set_settings")\
        .insert(new_settings)\
        .execute()

    return HotSetSettings(**result.data[0])


@router.put("/projects/{project_id}/hot-set/settings")
async def update_hot_set_settings(
    project_id: str,
    settings_update: HotSetSettingsUpdate,
    authorization: str = Header(None)
):
    """
    Update Hot Set settings for a project.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Build update dict (only include fields that were provided)
    update_data = {}
    for field, value in settings_update.dict(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Update settings
    result = client.table("backlot_hot_set_settings")\
        .update(update_data)\
        .eq("project_id", project_id)\
        .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Settings not found")

    return HotSetSettings(**result.data[0])


# =============================================================================
# CONFIRMATION ENDPOINTS
# =============================================================================

@router.post("/hot-set/sessions/{session_id}/confirm-crew-call")
async def confirm_crew_call(
    session_id: str,
    authorization: str = Header(None)
):
    """
    1st AD manually confirms crew call arrival.
    Records timestamp and confirming user.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Update session with confirmation
    now = datetime.utcnow().isoformat() + "Z"
    result = client.table("backlot_hot_set_sessions")\
        .update({
            "crew_call_confirmed_at": now,
            "crew_call_confirmed_by": user["id"],
        })\
        .eq("id", session_id)\
        .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "success": True,
        "session_id": session_id,
        "crew_call_confirmed_at": now,
        "crew_call_confirmed_by": user["id"],
    }


@router.post("/hot-set/sessions/{session_id}/confirm-first-shot")
async def confirm_first_shot(
    session_id: str,
    authorization: str = Header(None)
):
    """
    1st AD manually confirms first shot (cameras rolling).
    Records timestamp and confirming user.
    Marks the day tracking as officially begun.
    """
    user = await get_current_user_from_token(authorization)
    client = get_client()

    # Update session with confirmation
    now = datetime.utcnow().isoformat() + "Z"
    result = client.table("backlot_hot_set_sessions")\
        .update({
            "first_shot_confirmed_at": now,
            "first_shot_confirmed_by": user["id"],
            "actual_first_shot_time": now,  # Also set the actual first shot time
        })\
        .eq("id", session_id)\
        .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "success": True,
        "session_id": session_id,
        "first_shot_confirmed_at": now,
        "first_shot_confirmed_by": user["id"],
        "actual_first_shot_time": now,
    }
