"""
Camera Log API - Quick take logging for 1st AC / 2nd AC
Provides fast, painless camera notes for production days
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.database import get_client, execute_single, execute_query
from app.core.backlot_permissions import can_edit_tab, can_view_tab
import traceback
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


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
        logger.error(f"[CameraLog] Authentication failed: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


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

class CameraLogItem(BaseModel):
    id: str
    project_id: str
    production_day_id: Optional[str] = None
    scene_number: str
    shot_type: str
    take_number: int
    camera_id: str = "A"
    lens: Optional[str] = None
    iris: Optional[str] = None
    filter: Optional[str] = None
    focus_distance: Optional[str] = None
    is_circle_take: bool = False
    notes: Optional[str] = None
    dailies_clip_id: Optional[str] = None
    logged_at: str
    logged_by: Optional[str] = None
    created_at: str
    updated_at: str


class CreateCameraLogRequest(BaseModel):
    production_day_id: Optional[str] = None
    scene_number: str
    shot_type: str
    take_number: Optional[int] = None  # Auto-calculated if not provided
    camera_id: str = "A"
    lens: Optional[str] = None
    iris: Optional[str] = None
    filter: Optional[str] = None
    focus_distance: Optional[str] = None
    is_circle_take: bool = False
    notes: Optional[str] = None


class UpdateCameraLogRequest(BaseModel):
    scene_number: Optional[str] = None
    shot_type: Optional[str] = None
    take_number: Optional[int] = None
    camera_id: Optional[str] = None
    lens: Optional[str] = None
    iris: Optional[str] = None
    filter: Optional[str] = None
    focus_distance: Optional[str] = None
    is_circle_take: Optional[bool] = None
    notes: Optional[str] = None
    dailies_clip_id: Optional[str] = None


class CameraSettings(BaseModel):
    project_id: str
    lens_presets: List[str]
    filter_presets: List[str]
    iris_presets: List[str]
    camera_ids: List[str]
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UpdateCameraSettingsRequest(BaseModel):
    lens_presets: Optional[List[str]] = None
    filter_presets: Optional[List[str]] = None
    iris_presets: Optional[List[str]] = None
    camera_ids: Optional[List[str]] = None


class NextTakeResponse(BaseModel):
    next_take_number: int
    scene_number: str
    shot_type: str
    camera_id: str


# =============================================================================
# CAMERA LOGS ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/camera-logs", response_model=List[CameraLogItem])
async def get_camera_logs(
    project_id: str,
    production_day_id: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    scene_number: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    authorization: str = Header(...)
):
    """Get camera logs for a project, optionally filtered by day/camera/scene"""
    try:
        # Authenticate user
        user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        # Check view permission
        if not await can_view_tab(project_id, user_id, "camera"):
            raise HTTPException(status_code=403, detail="No view permission for camera tab")

        # Build query
        client = get_client()
        query = client.table("backlot_camera_logs").select("*").eq("project_id", project_id)

        if production_day_id:
            query = query.eq("production_day_id", production_day_id)
        if camera_id:
            query = query.eq("camera_id", camera_id)
        if scene_number:
            query = query.eq("scene_number", scene_number)

        query = query.order("logged_at", desc=True).limit(limit)
        result = query.execute()

        return result.data if result.data else []
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting camera logs: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/camera-logs", response_model=CameraLogItem)
async def create_camera_log(
    project_id: str,
    request: CreateCameraLogRequest,
    authorization: str = Header(...)
):
    """Create a new camera log entry"""
    try:
        # Authenticate user
        user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        # Check edit permission
        if not await can_edit_tab(project_id, user_id, "camera"):
            raise HTTPException(status_code=403, detail="No edit permission for camera tab")

        client = get_client()

        # Auto-calculate take number if not provided
        take_number = request.take_number
        if take_number is None:
            take_query = client.table("backlot_camera_logs").select("take_number").eq(
                "project_id", project_id
            ).eq("scene_number", request.scene_number).eq(
                "shot_type", request.shot_type
            ).eq("camera_id", request.camera_id).order("take_number", desc=True).limit(1)

            take_result = take_query.execute()
            if take_result.data and len(take_result.data) > 0:
                take_number = take_result.data[0]["take_number"] + 1
            else:
                take_number = 1

        # Create log entry
        insert_data = {
            "project_id": project_id,
            "production_day_id": request.production_day_id,
            "scene_number": request.scene_number,
            "shot_type": request.shot_type,
            "take_number": take_number,
            "camera_id": request.camera_id,
            "lens": request.lens,
            "iris": request.iris,
            "filter": request.filter,
            "focus_distance": request.focus_distance,
            "is_circle_take": request.is_circle_take,
            "notes": request.notes,
            "logged_by": user_id,
            "logged_at": datetime.utcnow().isoformat(),
        }

        result = client.table("backlot_camera_logs").insert(insert_data).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create camera log")

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating camera log: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/projects/{project_id}/camera-logs/{log_id}", response_model=CameraLogItem)
async def update_camera_log(
    project_id: str,
    log_id: str,
    request: UpdateCameraLogRequest,
    authorization: str = Header(...)
):
    """Update a camera log entry"""
    try:
        # Authenticate user
        user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        # Check edit permission
        if not await can_edit_tab(project_id, user_id, "camera"):
            raise HTTPException(status_code=403, detail="No edit permission for camera tab")

        client = get_client()

        # Verify log exists and belongs to project
        existing = client.table("backlot_camera_logs").select("id").eq(
            "id", log_id
        ).eq("project_id", project_id).execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Camera log not found")

        # Build update data
        update_data = {"updated_at": datetime.utcnow().isoformat()}

        if request.scene_number is not None:
            update_data["scene_number"] = request.scene_number
        if request.shot_type is not None:
            update_data["shot_type"] = request.shot_type
        if request.take_number is not None:
            update_data["take_number"] = request.take_number
        if request.camera_id is not None:
            update_data["camera_id"] = request.camera_id
        if request.lens is not None:
            update_data["lens"] = request.lens
        if request.iris is not None:
            update_data["iris"] = request.iris
        if request.filter is not None:
            update_data["filter"] = request.filter
        if request.focus_distance is not None:
            update_data["focus_distance"] = request.focus_distance
        if request.is_circle_take is not None:
            update_data["is_circle_take"] = request.is_circle_take
        if request.notes is not None:
            update_data["notes"] = request.notes
        if request.dailies_clip_id is not None:
            update_data["dailies_clip_id"] = request.dailies_clip_id

        result = client.table("backlot_camera_logs").update(update_data).eq("id", log_id).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to update camera log")

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating camera log: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}/camera-logs/{log_id}")
async def delete_camera_log(
    project_id: str,
    log_id: str,
    authorization: str = Header(...)
):
    """Delete a camera log entry"""
    try:
        # Authenticate user
        user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        # Check edit permission
        if not await can_edit_tab(project_id, user_id, "camera"):
            raise HTTPException(status_code=403, detail="No edit permission for camera tab")

        client = get_client()

        # Verify log exists and belongs to project
        existing = client.table("backlot_camera_logs").select("id").eq(
            "id", log_id
        ).eq("project_id", project_id).execute()

        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Camera log not found")

        client.table("backlot_camera_logs").delete().eq("id", log_id).execute()

        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting camera log: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/camera-logs/next-take", response_model=NextTakeResponse)
async def get_next_take_number(
    project_id: str,
    scene_number: str = Query(...),
    shot_type: str = Query(...),
    camera_id: str = Query("A"),
    authorization: str = Header(...)
):
    """Get the next take number for a scene/shot/camera combo"""
    try:
        # Authenticate user
        user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        # Check view permission
        if not await can_view_tab(project_id, user_id, "camera"):
            raise HTTPException(status_code=403, detail="No view permission for camera tab")

        client = get_client()

        # Get highest take number
        query = client.table("backlot_camera_logs").select("take_number").eq(
            "project_id", project_id
        ).eq("scene_number", scene_number).eq(
            "shot_type", shot_type
        ).eq("camera_id", camera_id).order("take_number", desc=True).limit(1)

        result = query.execute()

        if result.data and len(result.data) > 0:
            next_take = result.data[0]["take_number"] + 1
        else:
            next_take = 1

        return NextTakeResponse(
            next_take_number=next_take,
            scene_number=scene_number,
            shot_type=shot_type,
            camera_id=camera_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting next take number: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# CAMERA SETTINGS ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/camera-settings", response_model=CameraSettings)
async def get_camera_settings(
    project_id: str,
    authorization: str = Header(...)
):
    """Get camera settings/presets for a project"""
    try:
        # Authenticate user
        user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        # Check view permission
        if not await can_view_tab(project_id, user_id, "camera"):
            raise HTTPException(status_code=403, detail="No view permission for camera tab")

        client = get_client()
        result = client.table("backlot_camera_settings").select("*").eq(
            "project_id", project_id
        ).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]

        # Return defaults if no settings exist
        return CameraSettings(
            project_id=project_id,
            lens_presets=["24mm", "35mm", "50mm", "85mm", "100mm"],
            filter_presets=["Clear", "ND.3", "ND.6", "ND.9", "ND1.2", "Pola"],
            iris_presets=["1.4", "2", "2.8", "4", "5.6", "8", "11"],
            camera_ids=["A", "B"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting camera settings: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/projects/{project_id}/camera-settings", response_model=CameraSettings)
async def update_camera_settings(
    project_id: str,
    request: UpdateCameraSettingsRequest,
    authorization: str = Header(...)
):
    """Update camera settings/presets for a project"""
    try:
        # Authenticate user
        user = await get_current_user_from_token(authorization)
        user_id = get_profile_id_from_cognito_id(user["id"])
        if not user_id:
            raise HTTPException(status_code=401, detail="User profile not found")

        # Check edit permission
        if not await can_edit_tab(project_id, user_id, "camera"):
            raise HTTPException(status_code=403, detail="No edit permission for camera tab")

        client = get_client()

        # Check if settings exist
        existing = client.table("backlot_camera_settings").select("project_id").eq(
            "project_id", project_id
        ).execute()

        update_data = {"updated_at": datetime.utcnow().isoformat()}

        if request.lens_presets is not None:
            update_data["lens_presets"] = request.lens_presets
        if request.filter_presets is not None:
            update_data["filter_presets"] = request.filter_presets
        if request.iris_presets is not None:
            update_data["iris_presets"] = request.iris_presets
        if request.camera_ids is not None:
            update_data["camera_ids"] = request.camera_ids

        if existing.data and len(existing.data) > 0:
            # Update existing
            result = client.table("backlot_camera_settings").update(update_data).eq(
                "project_id", project_id
            ).execute()
        else:
            # Insert new with defaults
            insert_data = {
                "project_id": project_id,
                "lens_presets": request.lens_presets or ["24mm", "35mm", "50mm", "85mm", "100mm"],
                "filter_presets": request.filter_presets or ["Clear", "ND.3", "ND.6", "ND.9", "ND1.2", "Pola"],
                "iris_presets": request.iris_presets or ["1.4", "2", "2.8", "4", "5.6", "8", "11"],
                "camera_ids": request.camera_ids or ["A", "B"],
            }
            result = client.table("backlot_camera_settings").insert(insert_data).execute()

        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to update camera settings")

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating camera settings: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
