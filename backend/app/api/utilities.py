"""
Utilities API - Sun/Weather Widget, QR Check-in System, Personal Notes & Bookmarks
Provides supporting functionality for on-set production workflow
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, time
import secrets
from app.core.supabase import get_supabase_admin_client
from app.core.backlot_permissions import can_edit_tab, can_view_tab, can_manage_access

router = APIRouter()


# =============================================================================
# MODELS - Day Settings / Weather
# =============================================================================

class DaySettings(BaseModel):
    id: str
    project_id: str
    shoot_date: str
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str = "America/Los_Angeles"
    weather_override_summary: Optional[str] = None
    sunrise_time: Optional[str] = None
    sunset_time: Optional[str] = None
    golden_hour_morning_start: Optional[str] = None
    golden_hour_morning_end: Optional[str] = None
    golden_hour_evening_start: Optional[str] = None
    golden_hour_evening_end: Optional[str] = None
    weather_summary: Optional[str] = None
    temperature_high_f: Optional[int] = None
    temperature_low_f: Optional[int] = None
    precipitation_chance: Optional[int] = None
    wind_mph: Optional[int] = None
    created_at: str
    updated_at: str


class CreateDaySettingsRequest(BaseModel):
    shoot_date: str  # YYYY-MM-DD
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str = "America/Los_Angeles"
    weather_override_summary: Optional[str] = None


class UpdateDaySettingsRequest(BaseModel):
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    weather_override_summary: Optional[str] = None
    sunrise_time: Optional[str] = None
    sunset_time: Optional[str] = None
    golden_hour_morning_start: Optional[str] = None
    golden_hour_morning_end: Optional[str] = None
    golden_hour_evening_start: Optional[str] = None
    golden_hour_evening_end: Optional[str] = None
    weather_summary: Optional[str] = None
    temperature_high_f: Optional[int] = None
    temperature_low_f: Optional[int] = None
    precipitation_chance: Optional[int] = None
    wind_mph: Optional[int] = None


class SunWeatherData(BaseModel):
    """Response model for sun/weather widget - can be populated from API or mock"""
    shoot_date: str
    location_name: Optional[str] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None
    golden_hour_morning: Optional[Dict[str, str]] = None  # {start, end}
    golden_hour_evening: Optional[Dict[str, str]] = None  # {start, end}
    weather_summary: Optional[str] = None
    temperature_high_f: Optional[int] = None
    temperature_low_f: Optional[int] = None
    precipitation_chance: Optional[int] = None
    wind_mph: Optional[int] = None
    override_note: Optional[str] = None


# =============================================================================
# MODELS - Check-in System
# =============================================================================

class CheckinSession(BaseModel):
    id: str
    project_id: str
    shoot_date: str
    title: str
    qr_token: str
    is_active: bool = True
    safety_brief: Optional[str] = None
    policy_text: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str
    deactivated_at: Optional[str] = None
    checkin_count: int = 0


class CreateCheckinSessionRequest(BaseModel):
    shoot_date: str  # YYYY-MM-DD
    title: str
    safety_brief: Optional[str] = None
    policy_text: Optional[str] = None
    notes: Optional[str] = None


class CheckinRecord(BaseModel):
    id: str
    project_id: str
    session_id: str
    user_id: str
    checked_in_at: str
    acknowledged_safety_brief: bool = False
    acknowledged_policies: bool = False
    device_info: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    # Joined
    user_name: Optional[str] = None
    user_avatar: Optional[str] = None


class PerformCheckinRequest(BaseModel):
    qr_token: str
    acknowledged_safety_brief: bool = False
    acknowledged_policies: bool = False
    device_info: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# =============================================================================
# MODELS - Personal Notes & Bookmarks
# =============================================================================

class UserNote(BaseModel):
    id: str
    project_id: str
    user_id: str
    title: Optional[str] = None
    body: str
    is_pinned: bool = False
    color: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: str
    updated_at: str


class CreateUserNoteRequest(BaseModel):
    title: Optional[str] = None
    body: str
    is_pinned: bool = False
    color: Optional[str] = None
    tags: Optional[List[str]] = None


class UpdateUserNoteRequest(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    is_pinned: Optional[bool] = None
    color: Optional[str] = None
    tags: Optional[List[str]] = None


class UserBookmark(BaseModel):
    id: str
    project_id: str
    user_id: str
    entity_type: str
    entity_id: str
    label: Optional[str] = None
    created_at: str


class CreateUserBookmarkRequest(BaseModel):
    entity_type: str
    entity_id: str
    label: Optional[str] = None


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

    # Check member
    member_resp = supabase.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id).execute()
    return bool(member_resp.data)


def get_mock_sun_weather_data(shoot_date: str, location_name: Optional[str] = None) -> SunWeatherData:
    """
    Generate mock sun/weather data for development.
    In production, this would call external APIs (sunrise-sunset.org, weather API, etc.)
    """
    return SunWeatherData(
        shoot_date=shoot_date,
        location_name=location_name or "Los Angeles, CA",
        sunrise="06:45",
        sunset="17:30",
        golden_hour_morning={"start": "06:15", "end": "07:15"},
        golden_hour_evening={"start": "16:45", "end": "17:45"},
        weather_summary="Partly Cloudy",
        temperature_high_f=72,
        temperature_low_f=58,
        precipitation_chance=10,
        wind_mph=8,
    )


# =============================================================================
# DAY SETTINGS / WEATHER ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/day-settings")
async def list_day_settings(
    project_id: str,
    authorization: str = Header(None)
):
    """List all day settings for a project"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    response = supabase.table("backlot_project_day_settings").select("*").eq("project_id", project_id).order("shoot_date").execute()

    return {"settings": response.data or []}


@router.get("/projects/{project_id}/day-settings/{shoot_date}")
async def get_day_settings(
    project_id: str,
    shoot_date: str,
    authorization: str = Header(None)
):
    """Get day settings for a specific shoot date"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    response = supabase.table("backlot_project_day_settings").select("*").eq("project_id", project_id).eq("shoot_date", shoot_date).execute()

    if response.data and len(response.data) > 0:
        return {"settings": response.data[0]}

    return {"settings": None}


@router.post("/projects/{project_id}/day-settings")
async def create_day_settings(
    project_id: str,
    data: CreateDaySettingsRequest,
    authorization: str = Header(None)
):
    """Create day settings for a shoot date"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, user["id"], "checkin"):
        raise HTTPException(status_code=403, detail="No edit permission for day settings")

    settings_data = {
        "project_id": project_id,
        "shoot_date": data.shoot_date,
        "location_name": data.location_name,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "timezone": data.timezone,
        "weather_override_summary": data.weather_override_summary,
    }

    response = supabase.table("backlot_project_day_settings").insert(settings_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create day settings")

    return {"settings": response.data[0]}


@router.patch("/projects/{project_id}/day-settings/{shoot_date}")
async def update_day_settings(
    project_id: str,
    shoot_date: str,
    data: UpdateDaySettingsRequest,
    authorization: str = Header(None)
):
    """Update day settings for a shoot date"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, user["id"], "checkin"):
        raise HTTPException(status_code=403, detail="No edit permission for day settings")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("backlot_project_day_settings").update(update_data).eq("project_id", project_id).eq("shoot_date", shoot_date).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Day settings not found")

    return {"settings": response.data[0]}


@router.get("/projects/{project_id}/sun-weather/{shoot_date}")
async def get_sun_weather(
    project_id: str,
    shoot_date: str,
    authorization: str = Header(None)
):
    """
    Get sun and weather data for a shoot date.
    Returns data from day_settings if available, otherwise mock data.
    Future: integrate with real weather/sun APIs.
    """
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check if we have day settings
    response = supabase.table("backlot_project_day_settings").select("*").eq("project_id", project_id).eq("shoot_date", shoot_date).execute()

    if response.data and len(response.data) > 0:
        settings = response.data[0]
        return {
            "data": SunWeatherData(
                shoot_date=shoot_date,
                location_name=settings.get("location_name"),
                sunrise=settings.get("sunrise_time"),
                sunset=settings.get("sunset_time"),
                golden_hour_morning={
                    "start": settings.get("golden_hour_morning_start"),
                    "end": settings.get("golden_hour_morning_end"),
                } if settings.get("golden_hour_morning_start") else None,
                golden_hour_evening={
                    "start": settings.get("golden_hour_evening_start"),
                    "end": settings.get("golden_hour_evening_end"),
                } if settings.get("golden_hour_evening_start") else None,
                weather_summary=settings.get("weather_summary"),
                temperature_high_f=settings.get("temperature_high_f"),
                temperature_low_f=settings.get("temperature_low_f"),
                precipitation_chance=settings.get("precipitation_chance"),
                wind_mph=settings.get("wind_mph"),
                override_note=settings.get("weather_override_summary"),
            )
        }

    # Return mock data
    return {"data": get_mock_sun_weather_data(shoot_date)}


# =============================================================================
# CHECK-IN SESSION ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/checkin-sessions")
async def list_checkin_sessions(
    project_id: str,
    active_only: bool = False,
    authorization: str = Header(None)
):
    """List check-in sessions for a project"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    query = supabase.table("backlot_checkin_sessions").select("*").eq("project_id", project_id)

    if active_only:
        query = query.eq("is_active", True)

    query = query.order("shoot_date", desc=True)
    response = query.execute()

    # Add check-in counts
    sessions = response.data or []
    for session in sessions:
        count_resp = supabase.table("backlot_checkins").select("id", count="exact").eq("session_id", session["id"]).execute()
        session["checkin_count"] = count_resp.count or 0

    return {"sessions": sessions}


@router.get("/projects/{project_id}/checkin-sessions/{session_id}")
async def get_checkin_session(
    project_id: str,
    session_id: str,
    authorization: str = Header(None)
):
    """Get a specific check-in session"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    response = supabase.table("backlot_checkin_sessions").select("*").eq("id", session_id).eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = response.data[0]

    # Add check-in count
    count_resp = supabase.table("backlot_checkins").select("id", count="exact").eq("session_id", session_id).execute()
    session["checkin_count"] = count_resp.count or 0

    return {"session": session}


@router.post("/projects/{project_id}/checkin-sessions")
async def create_checkin_session(
    project_id: str,
    data: CreateCheckinSessionRequest,
    authorization: str = Header(None)
):
    """Create a new check-in session"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, user["id"], "checkin"):
        raise HTTPException(status_code=403, detail="No permission to manage check-in sessions")

    # Generate unique QR token
    qr_token = secrets.token_urlsafe(32)

    session_data = {
        "project_id": project_id,
        "shoot_date": data.shoot_date,
        "title": data.title,
        "qr_token": qr_token,
        "safety_brief": data.safety_brief,
        "policy_text": data.policy_text,
        "notes": data.notes,
        "created_by": user["id"],
        "is_active": True,
    }

    response = supabase.table("backlot_checkin_sessions").insert(session_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create check-in session")

    return {"session": response.data[0]}


@router.patch("/projects/{project_id}/checkin-sessions/{session_id}/deactivate")
async def deactivate_checkin_session(
    project_id: str,
    session_id: str,
    authorization: str = Header(None)
):
    """Deactivate a check-in session"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, user["id"], "checkin"):
        raise HTTPException(status_code=403, detail="No permission to manage check-in sessions")

    response = supabase.table("backlot_checkin_sessions").update({
        "is_active": False,
        "deactivated_at": datetime.utcnow().isoformat(),
    }).eq("id", session_id).eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session": response.data[0]}


@router.patch("/projects/{project_id}/checkin-sessions/{session_id}/activate")
async def activate_checkin_session(
    project_id: str,
    session_id: str,
    authorization: str = Header(None)
):
    """Re-activate a check-in session"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, user["id"], "checkin"):
        raise HTTPException(status_code=403, detail="No permission to manage check-in sessions")

    response = supabase.table("backlot_checkin_sessions").update({
        "is_active": True,
        "deactivated_at": None,
    }).eq("id", session_id).eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session": response.data[0]}


# =============================================================================
# CHECK-IN CREW ENDPOINTS
# =============================================================================

@router.get("/checkin/session/{qr_token}")
async def get_session_by_token(
    qr_token: str,
    authorization: str = Header(None)
):
    """Get session info by QR token (for crew check-in flow)"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    response = supabase.table("backlot_checkin_sessions").select("*, backlot_projects(id, title)").eq("qr_token", qr_token).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = response.data[0]

    if not session["is_active"]:
        raise HTTPException(status_code=400, detail="This check-in session is no longer active")

    # Verify user is project member
    if not await verify_project_member(supabase, session["project_id"], user["id"]):
        raise HTTPException(status_code=403, detail="You are not a member of this project")

    # Check if user already checked in
    existing = supabase.table("backlot_checkins").select("id").eq("session_id", session["id"]).eq("user_id", user["id"]).execute()

    return {
        "session": session,
        "already_checked_in": bool(existing.data),
        "project": session.get("backlot_projects"),
    }


@router.post("/checkin/perform")
async def perform_checkin(
    data: PerformCheckinRequest,
    authorization: str = Header(None)
):
    """Perform check-in for current user"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    # Get session by token
    session_resp = supabase.table("backlot_checkin_sessions").select("*").eq("qr_token", data.qr_token).execute()

    if not session_resp.data:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_resp.data[0]

    if not session["is_active"]:
        raise HTTPException(status_code=400, detail="This check-in session is no longer active")

    # Verify user is project member
    if not await verify_project_member(supabase, session["project_id"], user["id"]):
        raise HTTPException(status_code=403, detail="You are not a member of this project")

    # Check for existing check-in
    existing = supabase.table("backlot_checkins").select("id").eq("session_id", session["id"]).eq("user_id", user["id"]).execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="You have already checked in for this session")

    checkin_data = {
        "project_id": session["project_id"],
        "session_id": session["id"],
        "user_id": user["id"],
        "acknowledged_safety_brief": data.acknowledged_safety_brief,
        "acknowledged_policies": data.acknowledged_policies,
        "device_info": data.device_info,
        "latitude": data.latitude,
        "longitude": data.longitude,
    }

    response = supabase.table("backlot_checkins").insert(checkin_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to check in")

    return {"checkin": response.data[0], "success": True}


@router.get("/projects/{project_id}/checkin-sessions/{session_id}/checkins")
async def list_checkins_for_session(
    project_id: str,
    session_id: str,
    authorization: str = Header(None)
):
    """List all check-ins for a session (admin view)"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Get check-ins with user info
    response = supabase.table("backlot_checkins").select("*").eq("session_id", session_id).order("checked_in_at").execute()

    checkins = response.data or []

    # Enrich with user info
    for checkin in checkins:
        profile_resp = supabase.table("profiles").select("full_name, display_name, avatar_url").eq("id", checkin["user_id"]).execute()
        if profile_resp.data:
            profile = profile_resp.data[0]
            checkin["user_name"] = profile.get("display_name") or profile.get("full_name") or "Unknown"
            checkin["user_avatar"] = profile.get("avatar_url")

    return {"checkins": checkins}


# =============================================================================
# USER NOTES ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/my-notes")
async def get_my_notes(
    project_id: str,
    authorization: str = Header(None)
):
    """Get current user's notes for a project"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    response = supabase.table("backlot_user_notes").select("*").eq("project_id", project_id).eq("user_id", user["id"]).order("is_pinned", desc=True).order("updated_at", desc=True).execute()

    return {"notes": response.data or []}


@router.post("/projects/{project_id}/my-notes")
async def create_note(
    project_id: str,
    data: CreateUserNoteRequest,
    authorization: str = Header(None)
):
    """Create a personal note"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    note_data = {
        "project_id": project_id,
        "user_id": user["id"],
        "title": data.title,
        "body": data.body,
        "is_pinned": data.is_pinned,
        "color": data.color,
        "tags": data.tags,
    }

    response = supabase.table("backlot_user_notes").insert(note_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create note")

    return {"note": response.data[0]}


@router.patch("/projects/{project_id}/my-notes/{note_id}")
async def update_note(
    project_id: str,
    note_id: str,
    data: UpdateUserNoteRequest,
    authorization: str = Header(None)
):
    """Update a personal note"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = supabase.table("backlot_user_notes").update(update_data).eq("id", note_id).eq("project_id", project_id).eq("user_id", user["id"]).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Note not found")

    return {"note": response.data[0]}


@router.delete("/projects/{project_id}/my-notes/{note_id}")
async def delete_note(
    project_id: str,
    note_id: str,
    authorization: str = Header(None)
):
    """Delete a personal note"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    supabase.table("backlot_user_notes").delete().eq("id", note_id).eq("project_id", project_id).eq("user_id", user["id"]).execute()

    return {"success": True}


# =============================================================================
# USER BOOKMARKS ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/my-bookmarks")
async def get_my_bookmarks(
    project_id: str,
    entity_type: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get current user's bookmarks for a project"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    query = supabase.table("backlot_user_bookmarks").select("*").eq("project_id", project_id).eq("user_id", user["id"])

    if entity_type:
        query = query.eq("entity_type", entity_type)

    query = query.order("created_at", desc=True)
    response = query.execute()

    return {"bookmarks": response.data or []}


@router.post("/projects/{project_id}/my-bookmarks")
async def create_bookmark(
    project_id: str,
    data: CreateUserBookmarkRequest,
    authorization: str = Header(None)
):
    """Create a bookmark"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check if bookmark already exists
    existing = supabase.table("backlot_user_bookmarks").select("id").eq("user_id", user["id"]).eq("entity_type", data.entity_type).eq("entity_id", data.entity_id).execute()

    if existing.data:
        return {"bookmark": existing.data[0], "already_exists": True}

    bookmark_data = {
        "project_id": project_id,
        "user_id": user["id"],
        "entity_type": data.entity_type,
        "entity_id": data.entity_id,
        "label": data.label,
    }

    response = supabase.table("backlot_user_bookmarks").insert(bookmark_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create bookmark")

    return {"bookmark": response.data[0]}


@router.delete("/projects/{project_id}/my-bookmarks/{bookmark_id}")
async def delete_bookmark(
    project_id: str,
    bookmark_id: str,
    authorization: str = Header(None)
):
    """Delete a bookmark"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    supabase.table("backlot_user_bookmarks").delete().eq("id", bookmark_id).eq("project_id", project_id).eq("user_id", user["id"]).execute()

    return {"success": True}


@router.delete("/projects/{project_id}/my-bookmarks/by-entity")
async def delete_bookmark_by_entity(
    project_id: str,
    entity_type: str,
    entity_id: str,
    authorization: str = Header(None)
):
    """Delete a bookmark by entity type and ID"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    supabase.table("backlot_user_bookmarks").delete().eq("project_id", project_id).eq("user_id", user["id"]).eq("entity_type", entity_type).eq("entity_id", entity_id).execute()

    return {"success": True}


@router.get("/projects/{project_id}/my-bookmarks/check")
async def check_bookmark_exists(
    project_id: str,
    entity_type: str,
    entity_id: str,
    authorization: str = Header(None)
):
    """Check if a bookmark exists for an entity"""
    user = await get_current_user_from_token(authorization)
    supabase = get_supabase_admin_client()

    if not await verify_project_member(supabase, project_id, user["id"]):
        raise HTTPException(status_code=403, detail="Not a project member")

    response = supabase.table("backlot_user_bookmarks").select("id").eq("user_id", user["id"]).eq("entity_type", entity_type).eq("entity_id", entity_id).execute()

    return {"exists": bool(response.data), "bookmark_id": response.data[0]["id"] if response.data else None}
