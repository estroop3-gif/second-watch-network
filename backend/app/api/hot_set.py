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
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from app.core.database import get_client

router = APIRouter()


# =============================================================================
# MODELS
# =============================================================================

class HotSetSessionCreate(BaseModel):
    production_day_id: str
    call_sheet_id: Optional[str] = None
    day_type: str = "10hr"
    import_from_call_sheet: bool = True


class HotSetSessionUpdate(BaseModel):
    day_type: Optional[str] = None
    default_hourly_rate: Optional[float] = None
    ot_multiplier_1: Optional[float] = None
    ot_multiplier_2: Optional[float] = None
    ot_threshold_1_hours: Optional[int] = None
    ot_threshold_2_hours: Optional[int] = None
    notes: Optional[str] = None


class HotSetSession(BaseModel):
    id: str
    project_id: str
    production_day_id: str
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


class HotSetDashboard(BaseModel):
    session: HotSetSession
    current_scene: Optional[HotSetSceneLog] = None
    next_scenes: List[HotSetSceneLog] = []
    completed_scenes: List[HotSetSceneLog] = []
    markers: List[HotSetMarker] = []
    time_stats: TimeStats
    cost_projection: CostProjection
    schedule_status: ScheduleStatus


class MarkerCreate(BaseModel):
    marker_type: str
    timestamp: Optional[str] = None  # Defaults to now
    label: Optional[str] = None
    notes: Optional[str] = None


class SceneReorder(BaseModel):
    scene_ids: List[str]


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
    """Check if user has access to project"""
    result = client.table("backlot_project_members").select("id").eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()
    return len(result.data or []) > 0


async def verify_project_edit(client, project_id: str, user_id: str) -> bool:
    """Check if user can edit project (has edit role)"""
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


def calculate_schedule_variance(scenes: List[dict]) -> int:
    """
    Calculate how far ahead/behind schedule we are.
    Positive = ahead, Negative = behind
    """
    total_variance = 0
    for scene in scenes:
        if scene.get("status") == "completed":
            estimated = scene.get("estimated_minutes") or 0
            actual = scene.get("actual_duration_minutes") or 0
            total_variance += estimated - actual
    return total_variance


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

    # Create session
    session_data = {
        "project_id": project_id,
        "production_day_id": body.production_day_id,
        "call_sheet_id": body.call_sheet_id,
        "day_type": body.day_type,
        "created_by": user["id"],
    }

    result = client.table("backlot_hot_set_sessions").insert(session_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create session")

    session = result.data[0]

    # Import scenes from call sheet if requested
    if body.import_from_call_sheet and body.call_sheet_id:
        await import_scenes_from_call_sheet(client, session["id"], body.call_sheet_id)

    return session


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

    await import_scenes_from_call_sheet(client, session_id, call_sheet_id)

    # Update session with call sheet ID
    client.table("backlot_hot_set_sessions").update({
        "call_sheet_id": call_sheet_id
    }).eq("id", session_id).execute()

    return {"success": True}


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
    now = datetime.utcnow()
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
    variance = calculate_schedule_variance(scenes)
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

    return HotSetDashboard(
        session=HotSetSession(**session),
        current_scene=HotSetSceneLog(**current_scene) if current_scene else None,
        next_scenes=[HotSetSceneLog(**s) for s in next_scenes],
        completed_scenes=[HotSetSceneLog(**s) for s in completed_scenes],
        markers=[HotSetMarker(**m) for m in markers],
        time_stats=time_stats,
        cost_projection=cost_projection,
        schedule_status=schedule_status,
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
