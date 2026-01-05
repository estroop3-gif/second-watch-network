"""
Continuity Workspace API - Script Supervisor Tools (Scripty)
Lining Marks, Take Logger, Take Notes, Continuity Photos, Scene-level Notes
"""
from fastapi import APIRouter, HTTPException, Header, Query, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import uuid4
import boto3
import os
from app.core.database import get_client
from app.core.backlot_permissions import can_edit_section, can_view_section

router = APIRouter()


def get_profile_id_from_cognito_id(cognito_user_id: str) -> Optional[str]:
    """Look up the profile ID from a Cognito user ID."""
    client = get_client()
    if not cognito_user_id:
        return None
    uid_str = str(cognito_user_id)

    # Try cognito_user_id first
    result = client.table("profiles").select("id").eq(
        "cognito_user_id", uid_str
    ).limit(1).execute()
    if result.data:
        return result.data[0]["id"]

    # Fallback: check if it's already a profile ID
    result = client.table("profiles").select("id").eq(
        "id", uid_str
    ).limit(1).execute()
    if result.data:
        return result.data[0]["id"]

    return None

# S3 Configuration
S3_BUCKET = os.getenv("BACKLOT_FILES_BUCKET", "swn-backlot-files-517220555400")
S3_REGION = os.getenv("AWS_REGION", "us-east-1")


# =============================================================================
# MODELS
# =============================================================================

# Lining Marks
class LiningMark(BaseModel):
    id: str
    project_id: str
    script_id: Optional[str] = None
    scene_id: Optional[str] = None
    page_number: int
    start_y: float
    end_y: float
    x_position: float = 0.85
    coverage_type: str
    camera_label: Optional[str] = None
    setup_label: Optional[str] = None
    line_style: str = "solid"
    line_color: str = "#3B82F6"
    take_ids: List[str] = []
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str
    updated_at: str


class CreateLiningMarkRequest(BaseModel):
    script_id: Optional[str] = None
    scene_id: Optional[str] = None
    page_number: int
    start_y: float
    end_y: float
    x_position: float = 0.85
    coverage_type: str
    camera_label: Optional[str] = None
    setup_label: Optional[str] = None
    line_style: str = "solid"
    line_color: str = "#3B82F6"
    take_ids: List[str] = []
    notes: Optional[str] = None


class UpdateLiningMarkRequest(BaseModel):
    page_number: Optional[int] = None
    start_y: Optional[float] = None
    end_y: Optional[float] = None
    x_position: Optional[float] = None
    coverage_type: Optional[str] = None
    camera_label: Optional[str] = None
    setup_label: Optional[str] = None
    line_style: Optional[str] = None
    line_color: Optional[str] = None
    take_ids: Optional[List[str]] = None
    notes: Optional[str] = None


# Takes (enhanced slate logs)
class Take(BaseModel):
    id: str
    project_id: str
    scene_id: Optional[str] = None
    production_day_id: Optional[str] = None
    scene_number: str
    take_number: int
    status: str = "ok"
    timecode_in: Optional[str] = None
    timecode_out: Optional[str] = None
    camera_label: Optional[str] = None
    setup_label: Optional[str] = None
    camera_roll: Optional[str] = None
    time_of_day: Optional[str] = None
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None
    created_at: str
    updated_at: str


class CreateTakeRequest(BaseModel):
    scene_id: Optional[str] = None
    production_day_id: Optional[str] = None
    scene_number: str
    take_number: int = 1
    status: str = "ok"
    timecode_in: Optional[str] = None
    timecode_out: Optional[str] = None
    camera_label: Optional[str] = None
    setup_label: Optional[str] = None
    camera_roll: Optional[str] = None
    time_of_day: Optional[str] = None
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None


class UpdateTakeRequest(BaseModel):
    status: Optional[str] = None
    timecode_in: Optional[str] = None
    timecode_out: Optional[str] = None
    camera_label: Optional[str] = None
    setup_label: Optional[str] = None
    camera_roll: Optional[str] = None
    duration_seconds: Optional[int] = None
    notes: Optional[str] = None


# Take Notes
class TakeNote(BaseModel):
    id: str
    project_id: str
    take_id: str
    note_text: str
    note_category: str = "general"
    timecode: Optional[str] = None
    page_number: Optional[int] = None
    anchor_x: Optional[float] = None
    anchor_y: Optional[float] = None
    is_critical: bool = False
    is_dialogue_related: bool = False
    created_by: Optional[str] = None
    created_at: str


class CreateTakeNoteRequest(BaseModel):
    take_id: Optional[str] = None  # For camera dept slate logs
    scripty_take_id: Optional[str] = None  # For script supervisor takes
    note_text: str
    note_category: str = "general"
    timecode: Optional[str] = None
    page_number: Optional[int] = None
    anchor_x: Optional[float] = None
    anchor_y: Optional[float] = None
    is_critical: bool = False
    is_dialogue_related: bool = False


# Continuity Photos
class ContinuityPhoto(BaseModel):
    id: str
    project_id: str
    scene_id: Optional[str] = None
    take_id: Optional[str] = None
    s3_key: str
    s3_bucket: str
    original_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    thumbnail_s3_key: Optional[str] = None
    scene_number: Optional[str] = None
    description: Optional[str] = None
    category: str = "general"
    is_reference: bool = False
    is_favorite: bool = False
    uploaded_by: Optional[str] = None
    created_at: str
    updated_at: str
    thumbnail_url: Optional[str] = None
    full_url: Optional[str] = None
    tags: List[Dict[str, Any]] = []


class UpdateContinuityPhotoRequest(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    is_reference: Optional[bool] = None
    is_favorite: Optional[bool] = None


# Scene-level Continuity Notes
class SceneContinuityNote(BaseModel):
    id: str
    project_id: str
    scene_id: str
    category: str
    content: str
    is_critical: bool = False
    created_by: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str


class CreateSceneContinuityNoteRequest(BaseModel):
    scene_id: str
    category: str
    content: str
    is_critical: bool = False


class UpdateSceneContinuityNoteRequest(BaseModel):
    category: Optional[str] = None
    content: Optional[str] = None
    is_critical: Optional[bool] = None


# =============================================================================
# HELPERS
# =============================================================================

def get_s3_url(bucket: str, key: str) -> str:
    """Generate a presigned URL for S3 object."""
    try:
        s3_client = boto3.client("s3", region_name=S3_REGION)
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=3600,
        )
        return url
    except Exception:
        return ""


# =============================================================================
# LINING MARKS ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/continuity/lining-marks")
async def get_lining_marks(
    project_id: str,
    script_id: Optional[str] = None,
    scene_id: Optional[str] = None,
    page_number: Optional[int] = None,
    authorization: str = Header(...),
):
    """Get lining marks for a project, optionally filtered."""
    token = authorization.replace("Bearer ", "")
    client = get_client()

    # Build query
    query = client.table("backlot_lining_marks").select("*").eq("project_id", project_id)

    if script_id:
        query = query.eq("script_id", script_id)
    if scene_id:
        query = query.eq("scene_id", scene_id)
    if page_number:
        query = query.eq("page_number", page_number)

    query = query.order("page_number").order("x_position")

    response = query.execute()
    return response.data or []


@router.post("/projects/{project_id}/continuity/lining-marks")
async def create_lining_mark(
    project_id: str,
    request: CreateLiningMarkRequest,
    authorization: str = Header(...),
):
    """Create a new lining mark."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    # Check permission
    if not await can_edit_section(project_id, profile_id, "lining_marks"):
        raise HTTPException(status_code=403, detail="No permission to edit lining marks")

    client = get_client()

    mark_data = {
        "project_id": project_id,
        "script_id": request.script_id,
        "scene_id": request.scene_id,
        "page_number": request.page_number,
        "start_y": request.start_y,
        "end_y": request.end_y,
        "x_position": request.x_position,
        "coverage_type": request.coverage_type,
        "camera_label": request.camera_label,
        "setup_label": request.setup_label,
        "line_style": request.line_style,
        "line_color": request.line_color,
        "take_ids": request.take_ids,
        "notes": request.notes,
        "created_by": profile_id,
    }

    response = client.table("backlot_lining_marks").insert(mark_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create lining mark")

    return response.data[0]


@router.patch("/projects/{project_id}/continuity/lining-marks/{mark_id}")
async def update_lining_mark(
    project_id: str,
    mark_id: str,
    request: UpdateLiningMarkRequest,
    authorization: str = Header(...),
):
    """Update a lining mark."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    if not await can_edit_section(project_id, profile_id, "lining_marks"):
        raise HTTPException(status_code=403, detail="No permission to edit lining marks")

    client = get_client()

    update_data = request.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = (
        client.table("backlot_lining_marks")
        .update(update_data)
        .eq("id", mark_id)
        .eq("project_id", project_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Lining mark not found")

    return response.data[0]


@router.delete("/continuity/lining-marks/{mark_id}")
async def delete_lining_mark(
    mark_id: str,
    authorization: str = Header(...),
):
    """Delete a lining mark."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    client = get_client()

    # Get mark to check project
    mark = client.table("backlot_lining_marks").select("project_id").eq("id", mark_id).single().execute()
    if not mark.data:
        raise HTTPException(status_code=404, detail="Lining mark not found")

    if not await can_edit_section(mark.data["project_id"], profile_id, "lining_marks"):
        raise HTTPException(status_code=403, detail="No permission to delete lining marks")

    client.table("backlot_lining_marks").delete().eq("id", mark_id).execute()
    return {"success": True}


# =============================================================================
# TAKES ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/continuity/takes")
async def get_takes(
    project_id: str,
    scene_id: Optional[str] = None,
    production_day_id: Optional[str] = None,
    authorization: str = Header(...),
):
    """Get takes for a project, optionally filtered."""
    client = get_client()

    # Use our own backlot_takes table for script supervisor takes
    query = client.table("backlot_takes").select("*").eq("project_id", project_id)

    if scene_id:
        query = query.eq("scene_id", scene_id)
    if production_day_id:
        query = query.eq("production_day_id", production_day_id)

    query = query.order("created_at", desc=True)

    response = query.execute()
    return response.data or []


@router.post("/projects/{project_id}/continuity/takes")
async def create_take(
    project_id: str,
    request: CreateTakeRequest,
    authorization: str = Header(...),
):
    """Create a new take (slate log)."""
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Auth
        token = authorization.replace("Bearer ", "")
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            logger.error("[CreateTake] Invalid token")
            raise HTTPException(status_code=401, detail="Invalid token")

        cognito_user_id = user.get("id")
        logger.info(f"[CreateTake] cognito_user_id: {cognito_user_id}")

        profile_id = get_profile_id_from_cognito_id(cognito_user_id)
        logger.info(f"[CreateTake] profile_id: {profile_id}")

        if not profile_id:
            logger.error(f"[CreateTake] Could not find profile for cognito_id: {cognito_user_id}")
            raise HTTPException(status_code=401, detail="User profile not found")

        # Permissions
        has_permission = await can_edit_section(project_id, profile_id, "take_notes")
        if not has_permission:
            logger.error(f"[CreateTake] No permission for profile {profile_id} on project {project_id}")
            raise HTTPException(status_code=403, detail="No permission to log takes")

        client = get_client()

        take_data = {
            "project_id": project_id,
            "scene_id": request.scene_id,
            "production_day_id": request.production_day_id,
            "scene_number": request.scene_number,
            "take_number": request.take_number,
            "status": request.status,
            "timecode_in": request.timecode_in,
            "timecode_out": request.timecode_out,
            "camera_label": request.camera_label,
            "setup_label": request.setup_label,
            "camera_roll": request.camera_roll,
            "time_of_day": request.time_of_day,
            "duration_seconds": request.duration_seconds,
            "notes": request.notes,
            "created_by": profile_id,
        }

        logger.info(f"[CreateTake] Inserting take: {take_data}")

        response = client.table("backlot_takes").insert(take_data).execute()

        if not response.data:
            logger.error(f"[CreateTake] Insert failed, no data returned")
            raise HTTPException(status_code=500, detail="Failed to create take - no data returned")

        logger.info(f"[CreateTake] Success: {response.data[0].get('id')}")
        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[CreateTake] Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create take: {str(e)}")


@router.patch("/continuity/takes/{take_id}")
async def update_take(
    take_id: str,
    request: UpdateTakeRequest,
    authorization: str = Header(...),
):
    """Update a take."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    client = get_client()

    # Get take to check project
    take = client.table("backlot_takes").select("project_id").eq("id", take_id).single().execute()
    if not take.data:
        raise HTTPException(status_code=404, detail="Take not found")

    if not await can_edit_section(take.data["project_id"], profile_id, "take_notes"):
        raise HTTPException(status_code=403, detail="No permission to edit takes")

    update_data = {}
    if request.status is not None:
        update_data["status"] = request.status
    if request.timecode_in is not None:
        update_data["timecode_in"] = request.timecode_in
    if request.timecode_out is not None:
        update_data["timecode_out"] = request.timecode_out
    if request.camera_label is not None:
        update_data["camera_label"] = request.camera_label
    if request.setup_label is not None:
        update_data["setup_label"] = request.setup_label
    if request.camera_roll is not None:
        update_data["camera_roll"] = request.camera_roll
    if request.duration_seconds is not None:
        update_data["duration_seconds"] = request.duration_seconds
    if request.notes is not None:
        update_data["notes"] = request.notes

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = client.table("backlot_takes").update(update_data).eq("id", take_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Take not found")

    return response.data[0]


@router.delete("/continuity/takes/{take_id}")
async def delete_take(
    take_id: str,
    authorization: str = Header(...),
):
    """Delete a take."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    client = get_client()

    take = client.table("backlot_takes").select("project_id").eq("id", take_id).single().execute()
    if not take.data:
        raise HTTPException(status_code=404, detail="Take not found")

    if not await can_edit_section(take.data["project_id"], profile_id, "take_notes"):
        raise HTTPException(status_code=403, detail="No permission to delete takes")

    client.table("backlot_takes").delete().eq("id", take_id).execute()
    return {"success": True}


# =============================================================================
# TAKE NOTES ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/continuity/take-notes")
async def get_take_notes(
    project_id: str,
    take_id: Optional[str] = None,
    scripty_take_id: Optional[str] = None,
    authorization: str = Header(...),
):
    """Get take notes for a project.

    Can filter by either take_id (camera dept) or scripty_take_id (script supervisor).
    """
    client = get_client()

    query = client.table("backlot_take_notes").select("*").eq("project_id", project_id)

    if scripty_take_id:
        # Filter by script supervisor take ID
        query = query.eq("scripty_take_id", scripty_take_id)
    elif take_id:
        # Filter by camera dept take ID (backward compatibility)
        query = query.eq("take_id", take_id)

    query = query.order("created_at", desc=True)

    response = query.execute()
    return response.data or []


@router.post("/projects/{project_id}/continuity/take-notes")
async def create_take_note(
    project_id: str,
    request: CreateTakeNoteRequest,
    authorization: str = Header(...),
):
    """Create a take note.

    Can be linked to either take_id (camera dept) or scripty_take_id (script supervisor).
    At least one must be provided.
    """
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    if not await can_edit_section(project_id, profile_id, "take_notes"):
        raise HTTPException(status_code=403, detail="No permission to add take notes")

    # Validate that at least one take ID is provided
    if not request.take_id and not request.scripty_take_id:
        raise HTTPException(status_code=400, detail="Either take_id or scripty_take_id must be provided")

    client = get_client()

    note_data = {
        "project_id": project_id,
        "note_text": request.note_text,
        "note_category": request.note_category,
        "timecode": request.timecode,
        "page_number": request.page_number,
        "anchor_x": request.anchor_x,
        "anchor_y": request.anchor_y,
        "is_critical": request.is_critical,
        "is_dialogue_related": request.is_dialogue_related,
        "created_by": profile_id,
    }

    # Add the appropriate take ID field
    if request.scripty_take_id:
        note_data["scripty_take_id"] = request.scripty_take_id
    if request.take_id:
        note_data["take_id"] = request.take_id

    response = client.table("backlot_take_notes").insert(note_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create take note")

    return response.data[0]


# =============================================================================
# CONTINUITY PHOTOS ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/continuity/photos")
async def get_continuity_photos(
    project_id: str,
    scene_id: Optional[str] = None,
    take_id: Optional[str] = None,
    category: Optional[str] = None,
    authorization: str = Header(...),
):
    """Get continuity photos for a project."""
    client = get_client()

    query = (
        client.table("backlot_continuity_photos")
        .select("*, tags:backlot_continuity_photo_tags(id, tag)")
        .eq("project_id", project_id)
    )

    if scene_id:
        query = query.eq("scene_id", scene_id)
    if take_id:
        query = query.eq("take_id", take_id)
    if category:
        query = query.eq("category", category)

    query = query.order("created_at", desc=True)

    response = query.execute()
    photos = response.data or []

    # Add URLs
    for photo in photos:
        photo["full_url"] = get_s3_url(photo["s3_bucket"], photo["s3_key"])
        if photo.get("thumbnail_s3_key"):
            photo["thumbnail_url"] = get_s3_url(photo["s3_bucket"], photo["thumbnail_s3_key"])
        photo["tags"] = photo.get("tags", [])

    return photos


@router.post("/projects/{project_id}/continuity/photos")
async def upload_continuity_photo(
    project_id: str,
    file: UploadFile = File(...),
    scene_id: Optional[str] = Form(None),
    take_id: Optional[str] = Form(None),
    category: str = Form("general"),
    description: Optional[str] = Form(None),
    authorization: str = Header(...),
):
    """Upload a continuity photo."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    if not await can_edit_section(project_id, profile_id, "continuity_photos"):
        raise HTTPException(status_code=403, detail="No permission to upload photos")

    # Read file
    file_content = await file.read()
    file_size = len(file_content)

    # Generate S3 key
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    s3_key = f"backlot/{project_id}/continuity/{uuid4()}.{ext}"

    # Upload to S3
    try:
        s3_client = boto3.client("s3", region_name=S3_REGION)
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_content,
            ContentType=file.content_type or "image/jpeg",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {str(e)}")

    # Create database record
    client = get_client()

    photo_data = {
        "project_id": project_id,
        "scene_id": scene_id,
        "take_id": take_id,
        "s3_key": s3_key,
        "s3_bucket": S3_BUCKET,
        "original_filename": file.filename,
        "file_size_bytes": file_size,
        "mime_type": file.content_type,
        "category": category,
        "description": description,
        "uploaded_by": profile_id,
    }

    response = client.table("backlot_continuity_photos").insert(photo_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create photo record")

    photo = response.data[0]
    photo["full_url"] = get_s3_url(S3_BUCKET, s3_key)

    return photo


@router.patch("/continuity/photos/{photo_id}")
async def update_continuity_photo(
    photo_id: str,
    request: UpdateContinuityPhotoRequest,
    authorization: str = Header(...),
):
    """Update a continuity photo."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    client = get_client()

    photo = client.table("backlot_continuity_photos").select("project_id").eq("id", photo_id).single().execute()
    if not photo.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not await can_edit_section(photo.data["project_id"], profile_id, "continuity_photos"):
        raise HTTPException(status_code=403, detail="No permission to edit photos")

    update_data = request.dict(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = client.table("backlot_continuity_photos").update(update_data).eq("id", photo_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    return response.data[0]


@router.delete("/continuity/photos/{photo_id}")
async def delete_continuity_photo(
    photo_id: str,
    authorization: str = Header(...),
):
    """Delete a continuity photo."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    client = get_client()

    photo = (
        client.table("backlot_continuity_photos")
        .select("project_id, s3_key, s3_bucket")
        .eq("id", photo_id)
        .single()
        .execute()
    )
    if not photo.data:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not await can_edit_section(photo.data["project_id"], profile_id, "continuity_photos"):
        raise HTTPException(status_code=403, detail="No permission to delete photos")

    # Delete from S3
    try:
        s3_client = boto3.client("s3", region_name=S3_REGION)
        s3_client.delete_object(Bucket=photo.data["s3_bucket"], Key=photo.data["s3_key"])
    except Exception:
        pass  # Log but don't fail if S3 delete fails

    # Delete from database
    client.table("backlot_continuity_photos").delete().eq("id", photo_id).execute()

    return {"success": True}


# =============================================================================
# SCENE CONTINUITY NOTES ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/continuity/notes")
async def get_scene_continuity_notes(
    project_id: str,
    scene_id: Optional[str] = None,
    category: Optional[str] = None,
    authorization: str = Header(...),
):
    """Get scene-level continuity notes."""
    client = get_client()

    # We'll use a new pattern for scene-level notes, separate from camera continuity notes
    # This uses a new table or can extend existing backlot_continuity_notes
    query = (
        client.table("backlot_continuity_notes")
        .select("*, created_by:profiles(id, display_name, full_name)")
        .eq("project_id", project_id)
    )

    if scene_id:
        query = query.eq("scene_id", scene_id)
    if category:
        query = query.eq("department", category)  # department field used for category

    query = query.order("created_at", desc=True)

    response = query.execute()
    notes = response.data or []

    # Transform to expected format
    result = []
    for note in notes:
        result.append({
            "id": note["id"],
            "project_id": note["project_id"],
            "scene_id": note.get("scene_id"),
            "category": note.get("department", "general"),
            "content": note.get("content", ""),
            "is_critical": note.get("is_critical", False),
            "created_by": note.get("created_by"),
            "created_at": note.get("created_at"),
            "updated_at": note.get("updated_at", note.get("created_at")),
        })

    return result


@router.post("/projects/{project_id}/continuity/notes")
async def create_scene_continuity_note(
    project_id: str,
    request: CreateSceneContinuityNoteRequest,
    authorization: str = Header(...),
):
    """Create a scene-level continuity note."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    if not await can_edit_section(project_id, profile_id, "continuity_notes"):
        raise HTTPException(status_code=403, detail="No permission to add notes")

    client = get_client()

    note_data = {
        "project_id": project_id,
        "scene_id": request.scene_id,
        "department": request.category,
        "content": request.content,
        "is_critical": request.is_critical,
        "created_by": profile_id,
    }

    response = client.table("backlot_continuity_notes").insert(note_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create note")

    return response.data[0]


@router.patch("/continuity/notes/{note_id}")
async def update_scene_continuity_note(
    note_id: str,
    request: UpdateSceneContinuityNoteRequest,
    authorization: str = Header(...),
):
    """Update a scene continuity note."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    client = get_client()

    note = client.table("backlot_continuity_notes").select("project_id").eq("id", note_id).single().execute()
    if not note.data:
        raise HTTPException(status_code=404, detail="Note not found")

    if not await can_edit_section(note.data["project_id"], profile_id, "continuity_notes"):
        raise HTTPException(status_code=403, detail="No permission to edit notes")

    update_data = {}
    if request.category is not None:
        update_data["department"] = request.category
    if request.content is not None:
        update_data["content"] = request.content
    if request.is_critical is not None:
        update_data["is_critical"] = request.is_critical

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    response = client.table("backlot_continuity_notes").update(update_data).eq("id", note_id).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="Note not found")

    return response.data[0]


@router.delete("/continuity/notes/{note_id}")
async def delete_scene_continuity_note(
    note_id: str,
    authorization: str = Header(...),
):
    """Delete a scene continuity note."""
    token = authorization.replace("Bearer ", "")
    from app.core.cognito import CognitoAuth
    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    cognito_user_id = user.get("id")
    profile_id = get_profile_id_from_cognito_id(cognito_user_id)

    client = get_client()

    note = client.table("backlot_continuity_notes").select("project_id").eq("id", note_id).single().execute()
    if not note.data:
        raise HTTPException(status_code=404, detail="Note not found")

    if not await can_edit_section(note.data["project_id"], profile_id, "continuity_notes"):
        raise HTTPException(status_code=403, detail="No permission to delete notes")

    client.table("backlot_continuity_notes").delete().eq("id", note_id).execute()
    return {"success": True}


# =============================================================================
# EXPORT ENDPOINTS
# =============================================================================

@router.get("/projects/{project_id}/continuity/export/takes")
async def export_takes(
    project_id: str,
    format: str = Query("csv", regex="^(csv|json)$"),
    scene_id: Optional[str] = None,
    production_day_id: Optional[str] = None,
    authorization: str = Header(...),
):
    """Export takes as CSV or JSON."""
    from fastapi.responses import StreamingResponse
    import csv
    import io
    import json

    client = get_client()

    # Build query
    query = (
        client.table("backlot_takes")
        .select("*, scene:backlot_scenes(scene_number, set_name)")
        .eq("project_id", project_id)
    )

    if scene_id:
        query = query.eq("scene_id", scene_id)
    if production_day_id:
        query = query.eq("production_day_id", production_day_id)

    query = query.order("created_at")
    response = query.execute()
    takes = response.data or []

    if format == "json":
        return takes

    # CSV format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Scene", "Take", "Status", "Camera", "Setup",
        "Timecode In", "Duration", "Notes", "Created At"
    ])

    for take in takes:
        writer.writerow([
            take.get("scene_number", ""),
            take.get("take_number", ""),
            take.get("status", ""),
            take.get("camera_label", ""),
            take.get("setup_label", ""),
            take.get("timecode_in", ""),
            take.get("duration_seconds", ""),
            take.get("notes", ""),
            take.get("created_at", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=takes_export_{project_id}.csv"},
    )


@router.get("/projects/{project_id}/continuity/export/notes")
async def export_notes(
    project_id: str,
    format: str = Query("csv", regex="^(csv|json)$"),
    scene_id: Optional[str] = None,
    authorization: str = Header(...),
):
    """Export continuity notes as CSV or JSON."""
    from fastapi.responses import StreamingResponse
    import csv
    import io

    client = get_client()

    # Get scene-level notes
    query = (
        client.table("backlot_continuity_notes")
        .select("*, scene:backlot_scenes(scene_number), created_by:profiles(display_name, full_name)")
        .eq("project_id", project_id)
    )

    if scene_id:
        query = query.eq("scene_id", scene_id)

    query = query.order("created_at")
    response = query.execute()
    notes = response.data or []

    if format == "json":
        return notes

    # CSV format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Scene", "Category", "Content", "Critical", "Created By", "Created At"
    ])

    for note in notes:
        scene = note.get("scene") or {}
        created_by = note.get("created_by") or {}
        writer.writerow([
            scene.get("scene_number", ""),
            note.get("department", ""),
            note.get("content", ""),
            "Yes" if note.get("is_critical") else "No",
            created_by.get("display_name") or created_by.get("full_name", ""),
            note.get("created_at", ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=continuity_notes_{project_id}.csv"},
    )


@router.get("/projects/{project_id}/continuity/export/daily-report")
async def export_daily_report(
    project_id: str,
    production_day_id: str,
    format: str = Query("json", regex="^(json)$"),
    authorization: str = Header(...),
):
    """Export daily progress report as JSON."""
    client = get_client()

    # Get production day info
    day_response = (
        client.table("backlot_production_days")
        .select("*")
        .eq("id", production_day_id)
        .single()
        .execute()
    )
    day = day_response.data

    # Get takes for the day
    takes_response = (
        client.table("backlot_takes")
        .select("*")
        .eq("project_id", project_id)
        .eq("production_day_id", production_day_id)
        .order("created_at")
        .execute()
    )
    takes = takes_response.data or []

    # Get take notes for the day
    take_ids = [t["id"] for t in takes]
    notes = []
    if take_ids:
        notes_response = (
            client.table("backlot_take_notes")
            .select("*")
            .in_("take_id", take_ids)
            .order("created_at")
            .execute()
        )
        notes = notes_response.data or []

    # Get photos for the day (approximate by created_at date)
    photos = []
    if day:
        photos_response = (
            client.table("backlot_continuity_photos")
            .select("id, category, description, is_reference, created_at")
            .eq("project_id", project_id)
            .gte("created_at", day["date"] + "T00:00:00")
            .lte("created_at", day["date"] + "T23:59:59")
            .execute()
        )
        photos = photos_response.data or []

    # Calculate summary stats
    total_takes = len(takes)
    print_takes = len([t for t in takes if t.get("status") == "print"])
    circled_takes = len([t for t in takes if t.get("status") == "circled"])
    ng_takes = len([t for t in takes if t.get("status") == "ng"])

    # Get unique scenes shot
    scenes_shot = list(set([t.get("scene_number") for t in takes if t.get("scene_number")]))

    report = {
        "production_day": day,
        "summary": {
            "total_takes": total_takes,
            "print_takes": print_takes,
            "circled_takes": circled_takes,
            "ng_takes": ng_takes,
            "scenes_shot": scenes_shot,
            "total_notes": len(notes),
            "critical_notes": len([n for n in notes if n.get("is_critical")]),
            "photos_taken": len(photos),
        },
        "takes": takes,
        "notes": notes,
        "photos": photos,
    }

    return report
