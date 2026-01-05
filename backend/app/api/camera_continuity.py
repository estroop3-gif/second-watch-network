"""
Camera & Continuity API - Shot Lists, Slate Logs, Camera Media, and Continuity Notes
Provides CRUD operations for on-set camera tracking and continuity management
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from app.core.database import get_client, execute_single
from app.core.backlot_permissions import can_edit_tab, can_view_tab
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def get_profile_id_from_cognito_id(cognito_user_id: str) -> Optional[str]:
    """Look up the profile ID from a Cognito user ID."""
    if not cognito_user_id:
        return None
    uid_str = str(cognito_user_id)
    # First try cognito_user_id (preferred, exact match)
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if profile_row:
        return str(profile_row["id"])
    # Fallback: check if it's already a profile ID
    profile_row = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if not profile_row:
        return None
    return str(profile_row["id"])


# =============================================================================
# MODELS
# =============================================================================

# Shot List Models
class ShotListItem(BaseModel):
    id: str
    project_id: str
    scene_number: str
    shot_label: str
    description: Optional[str] = None
    camera: Optional[str] = None
    lens: Optional[str] = None
    framing: Optional[str] = None
    status: str = "planned"
    is_circle_take: bool = False
    sort_order: int = 0
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str
    updated_at: str


class CreateShotListRequest(BaseModel):
    scene_number: str
    shot_label: str
    description: Optional[str] = None
    camera: Optional[str] = None
    lens: Optional[str] = None
    framing: Optional[str] = None
    status: str = "planned"
    is_circle_take: bool = False
    sort_order: int = 0
    notes: Optional[str] = None


class UpdateShotListRequest(BaseModel):
    scene_number: Optional[str] = None
    shot_label: Optional[str] = None
    description: Optional[str] = None
    camera: Optional[str] = None
    lens: Optional[str] = None
    framing: Optional[str] = None
    status: Optional[str] = None
    is_circle_take: Optional[bool] = None
    sort_order: Optional[int] = None
    notes: Optional[str] = None


# Slate Log Models
class SlateLogItem(BaseModel):
    id: str
    project_id: str
    scene_number: str
    shot_label: Optional[str] = None
    take_number: int
    camera: Optional[str] = None
    sound_roll: Optional[str] = None
    file_name: Optional[str] = None
    is_circle_take: bool = False
    notes: Optional[str] = None
    recorded_at: str
    logged_by: Optional[str] = None
    created_at: str


class CreateSlateLogRequest(BaseModel):
    scene_number: str
    shot_label: Optional[str] = None
    take_number: int = 1
    camera: Optional[str] = None
    sound_roll: Optional[str] = None
    file_name: Optional[str] = None
    is_circle_take: bool = False
    notes: Optional[str] = None
    recorded_at: Optional[str] = None


class UpdateSlateLogRequest(BaseModel):
    scene_number: Optional[str] = None
    shot_label: Optional[str] = None
    take_number: Optional[int] = None
    camera: Optional[str] = None
    sound_roll: Optional[str] = None
    file_name: Optional[str] = None
    is_circle_take: Optional[bool] = None
    notes: Optional[str] = None


# Camera Media Models
class CameraMediaItem(BaseModel):
    id: str
    project_id: str
    media_label: str
    media_type: str
    camera: Optional[str] = None
    capacity_gb: Optional[int] = None
    status: str = "in_camera"
    current_holder: Optional[str] = None
    first_backup_done: bool = False
    second_backup_done: bool = False
    backup_notes: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class CreateCameraMediaRequest(BaseModel):
    media_label: str
    media_type: str = "CFexpress"
    camera: Optional[str] = None
    capacity_gb: Optional[int] = None
    status: str = "in_camera"
    current_holder: Optional[str] = None
    notes: Optional[str] = None


class UpdateCameraMediaRequest(BaseModel):
    media_label: Optional[str] = None
    media_type: Optional[str] = None
    camera: Optional[str] = None
    capacity_gb: Optional[int] = None
    status: Optional[str] = None
    current_holder: Optional[str] = None
    first_backup_done: Optional[bool] = None
    second_backup_done: Optional[bool] = None
    backup_notes: Optional[str] = None
    notes: Optional[str] = None


# Continuity Notes Models
class ContinuityNoteItem(BaseModel):
    id: str
    project_id: str
    scene_number: str
    take_ref: Optional[str] = None
    department: str = "general"
    note: str
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    created_by: Optional[str] = None
    created_at: str
    updated_at: str


class CreateContinuityNoteRequest(BaseModel):
    scene_number: str
    take_ref: Optional[str] = None
    department: str = "general"
    note: str
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None


class UpdateContinuityNoteRequest(BaseModel):
    scene_number: Optional[str] = None
    take_ref: Optional[str] = None
    department: Optional[str] = None
    note: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None


# =============================================================================
# HELPERS
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:

        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def verify_project_member(client, project_id: str, user_id: str) -> bool:
    """Verify user is a member of the project"""
    user_id_str = str(user_id)

    # Check owner
    project_resp = client.table("backlot_projects").select("owner_id").eq("id", project_id).execute()
    if project_resp.data and str(project_resp.data[0]["owner_id"]) == user_id_str:
        return True

    # Check member
    member_resp = client.table("backlot_project_members").select("id").eq("project_id", project_id).eq("user_id", user_id_str).execute()
    return bool(member_resp.data)


# =============================================================================
# SHOT LIST ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/shots")
async def get_shot_list(
    project_id: str,
    scene_number: Optional[str] = None,
    status: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get shot list for a project with optional filters"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    query = client.table("backlot_shot_lists").select("*").eq("project_id", project_id)

    if scene_number:
        query = query.eq("scene_number", scene_number)
    if status:
        query = query.eq("status", status)

    query = query.order("scene_number").order("sort_order")
    response = query.execute()

    return {"shots": response.data or []}


@router.post("/projects/{project_id}/shots")
async def create_shot(
    project_id: str,
    data: CreateShotListRequest,
    authorization: str = Header(None)
):
    """Create a new shot in the shot list"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check edit permission
    if not await can_edit_tab(project_id, profile_id, "camera-continuity"):
        raise HTTPException(status_code=403, detail="No edit permission for camera tools")

    shot_data = {
        "project_id": project_id,
        "scene_number": data.scene_number,
        "shot_label": data.shot_label,
        "description": data.description,
        "camera": data.camera,
        "lens": data.lens,
        "framing": data.framing,
        "status": data.status,
        "is_circle_take": data.is_circle_take,
        "sort_order": data.sort_order,
        "notes": data.notes,
        "created_by": profile_id,
    }

    response = client.table("backlot_shot_lists").insert(shot_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create shot")

    return {"shot": response.data[0]}


@router.patch("/projects/{project_id}/shots/{shot_id}")
async def update_shot(
    project_id: str,
    shot_id: str,
    data: UpdateShotListRequest,
    authorization: str = Header(None)
):
    """Update an existing shot"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, profile_id, "camera-continuity"):
        raise HTTPException(status_code=403, detail="No edit permission for camera tools")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = client.table("backlot_shot_lists").update(update_data).eq("id", shot_id).eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Shot not found")

    return {"shot": response.data[0]}


@router.delete("/projects/{project_id}/shots/{shot_id}")
async def delete_shot(
    project_id: str,
    shot_id: str,
    authorization: str = Header(None)
):
    """Delete a shot from the shot list"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, profile_id, "camera-continuity"):
        raise HTTPException(status_code=403, detail="No edit permission for camera tools")

    client.table("backlot_shot_lists").delete().eq("id", shot_id).eq("project_id", project_id).execute()

    return {"success": True}


# =============================================================================
# SLATE LOG ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/slate-logs")
async def get_slate_logs(
    project_id: str,
    scene_number: Optional[str] = None,
    shoot_date: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get slate logs for a project with optional filters"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    query = client.table("backlot_slate_logs").select("*").eq("project_id", project_id)

    if scene_number:
        query = query.eq("scene_number", scene_number)
    if shoot_date:
        # Filter by date portion of recorded_at
        query = query.gte("recorded_at", f"{shoot_date}T00:00:00").lte("recorded_at", f"{shoot_date}T23:59:59")

    query = query.order("recorded_at", desc=True)
    response = query.execute()

    return {"logs": response.data or []}


@router.post("/projects/{project_id}/slate-logs")
async def create_slate_log(
    project_id: str,
    data: CreateSlateLogRequest,
    authorization: str = Header(None)
):
    """Log a new take/slate"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, profile_id, "camera-continuity"):
        raise HTTPException(status_code=403, detail="No edit permission for slate logging")

    log_data = {
        "project_id": project_id,
        "scene_number": data.scene_number,
        "shot_label": data.shot_label,
        "take_number": data.take_number,
        "camera": data.camera,
        "sound_roll": data.sound_roll,
        "file_name": data.file_name,
        "is_circle_take": data.is_circle_take,
        "notes": data.notes,
        "recorded_at": data.recorded_at or datetime.utcnow().isoformat(),
        "logged_by": profile_id,
    }

    response = client.table("backlot_slate_logs").insert(log_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create slate log")

    return {"log": response.data[0]}


@router.patch("/projects/{project_id}/slate-logs/{log_id}")
async def update_slate_log(
    project_id: str,
    log_id: str,
    data: UpdateSlateLogRequest,
    authorization: str = Header(None)
):
    """Update an existing slate log"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, profile_id, "camera-continuity"):
        raise HTTPException(status_code=403, detail="No edit permission for slate logging")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = client.table("backlot_slate_logs").update(update_data).eq("id", log_id).eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Slate log not found")

    return {"log": response.data[0]}


@router.delete("/projects/{project_id}/slate-logs/{log_id}")
async def delete_slate_log(
    project_id: str,
    log_id: str,
    authorization: str = Header(None)
):
    """Delete a slate log"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    if not await can_edit_tab(project_id, profile_id, "camera-continuity"):
        raise HTTPException(status_code=403, detail="No edit permission for slate logging")

    client.table("backlot_slate_logs").delete().eq("id", log_id).eq("project_id", project_id).execute()

    return {"success": True}


@router.get("/projects/{project_id}/slate-logs/next-take")
async def get_next_take_number(
    project_id: str,
    scene_number: str,
    shot_label: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get the next take number for a scene/shot combination"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    query = client.table("backlot_slate_logs").select("take_number").eq("project_id", project_id).eq("scene_number", scene_number)

    if shot_label:
        query = query.eq("shot_label", shot_label)

    query = query.order("take_number", desc=True).limit(1)
    response = query.execute()

    next_take = 1
    if response.data and len(response.data) > 0:
        next_take = response.data[0]["take_number"] + 1

    return {"next_take": next_take}


# =============================================================================
# CAMERA MEDIA ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/camera-media")
async def get_camera_media(
    project_id: str,
    status: Optional[str] = None,
    camera: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get camera media items for a project with optional filters"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    query = client.table("backlot_camera_media").select("*").eq("project_id", project_id)

    if status:
        query = query.eq("status", status)
    if camera:
        query = query.eq("camera", camera)

    query = query.order("created_at", desc=True)
    response = query.execute()

    return {"media": response.data or []}


@router.post("/projects/{project_id}/camera-media")
async def create_camera_media(
    project_id: str,
    data: CreateCameraMediaRequest,
    authorization: str = Header(None)
):
    """Register a new camera media item (card, SSD, etc.)"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check for either "camera" or "camera-continuity" permission (consolidated tabs)
    has_camera_perm = await can_edit_tab(project_id, profile_id, "camera")
    has_continuity_perm = await can_edit_tab(project_id, profile_id, "camera-continuity")
    if not has_camera_perm and not has_continuity_perm:
        raise HTTPException(status_code=403, detail="No edit permission for camera media")

    media_data = {
        "project_id": project_id,
        "media_label": data.media_label,
        "media_type": data.media_type,
        "camera": data.camera,
        "capacity_gb": data.capacity_gb,
        "status": data.status,
        "current_holder": data.current_holder,
        "notes": data.notes,
    }

    response = client.table("backlot_camera_media").insert(media_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create camera media")

    return {"media": response.data[0]}


@router.patch("/projects/{project_id}/camera-media/{media_id}")
async def update_camera_media(
    project_id: str,
    media_id: str,
    data: UpdateCameraMediaRequest,
    authorization: str = Header(None)
):
    """Update camera media status and details"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check for either "camera" or "camera-continuity" permission (consolidated tabs)
    has_camera_perm = await can_edit_tab(project_id, profile_id, "camera")
    has_continuity_perm = await can_edit_tab(project_id, profile_id, "camera-continuity")
    if not has_camera_perm and not has_continuity_perm:
        raise HTTPException(status_code=403, detail="No edit permission for camera media")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = client.table("backlot_camera_media").update(update_data).eq("id", media_id).eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Camera media not found")

    return {"media": response.data[0]}


@router.delete("/projects/{project_id}/camera-media/{media_id}")
async def delete_camera_media(
    project_id: str,
    media_id: str,
    authorization: str = Header(None)
):
    """Delete a camera media item"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check for either "camera" or "camera-continuity" permission (consolidated tabs)
    has_camera_perm = await can_edit_tab(project_id, profile_id, "camera")
    has_continuity_perm = await can_edit_tab(project_id, profile_id, "camera-continuity")
    if not has_camera_perm and not has_continuity_perm:
        raise HTTPException(status_code=403, detail="No edit permission for camera media")

    client.table("backlot_camera_media").delete().eq("id", media_id).eq("project_id", project_id).execute()

    return {"success": True}


# =============================================================================
# CONTINUITY NOTES ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/continuity-notes")
async def get_continuity_notes(
    project_id: str,
    scene_number: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
    authorization: str = Header(None)
):
    """Get continuity notes for a project with optional filters"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    query = client.table("backlot_continuity_notes").select("*").eq("project_id", project_id)

    if scene_number:
        query = query.eq("scene_number", scene_number)
    if department:
        query = query.eq("department", department)
    if search:
        query = query.ilike("note", f"%{search}%")

    query = query.order("scene_number").order("created_at", desc=True)
    response = query.execute()

    return {"notes": response.data or []}


@router.post("/projects/{project_id}/continuity-notes")
async def create_continuity_note(
    project_id: str,
    data: CreateContinuityNoteRequest,
    authorization: str = Header(None)
):
    """Create a new continuity note"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check for either "camera" or "camera-continuity" permission (consolidated tabs)
    has_camera_perm = await can_edit_tab(project_id, profile_id, "camera")
    has_continuity_perm = await can_edit_tab(project_id, profile_id, "camera-continuity")
    if not has_camera_perm and not has_continuity_perm:
        raise HTTPException(status_code=403, detail="No edit permission for continuity notes")

    note_data = {
        "project_id": project_id,
        "scene_number": data.scene_number,
        "take_ref": data.take_ref,
        "department": data.department,
        "note": data.note,
        "image_url": data.image_url,
        "image_urls": data.image_urls,
        "created_by": profile_id,
    }

    response = client.table("backlot_continuity_notes").insert(note_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create continuity note")

    return {"note": response.data[0]}


@router.patch("/projects/{project_id}/continuity-notes/{note_id}")
async def update_continuity_note(
    project_id: str,
    note_id: str,
    data: UpdateContinuityNoteRequest,
    authorization: str = Header(None)
):
    """Update an existing continuity note"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check for either "camera" or "camera-continuity" permission (consolidated tabs)
    has_camera_perm = await can_edit_tab(project_id, profile_id, "camera")
    has_continuity_perm = await can_edit_tab(project_id, profile_id, "camera-continuity")
    if not has_camera_perm and not has_continuity_perm:
        raise HTTPException(status_code=403, detail="No edit permission for continuity notes")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = client.table("backlot_continuity_notes").update(update_data).eq("id", note_id).eq("project_id", project_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Continuity note not found")

    return {"note": response.data[0]}


@router.delete("/projects/{project_id}/continuity-notes/{note_id}")
async def delete_continuity_note(
    project_id: str,
    note_id: str,
    authorization: str = Header(None)
):
    """Delete a continuity note"""
    user = await get_current_user_from_token(authorization)

    # Get profile ID from Cognito ID
    profile_id = get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=401, detail="User profile not found")

    client = get_client()

    if not await verify_project_member(client, project_id, profile_id):
        raise HTTPException(status_code=403, detail="Not a project member")

    # Check for either "camera" or "camera-continuity" permission (consolidated tabs)
    has_camera_perm = await can_edit_tab(project_id, profile_id, "camera")
    has_continuity_perm = await can_edit_tab(project_id, profile_id, "camera-continuity")
    if not has_camera_perm and not has_continuity_perm:
        raise HTTPException(status_code=403, detail="No edit permission for continuity notes")

    client.table("backlot_continuity_notes").delete().eq("id", note_id).eq("project_id", project_id).execute()

    return {"success": True}
# Force rebuild Tue Dec 23 01:07:09 EST 2025
