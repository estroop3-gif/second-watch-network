"""
User Resumes API
CRUD operations for user resume uploads
"""

import io
import uuid
from fastapi import APIRouter, Header, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.core.database import get_client
from app.core.storage import storage_client, generate_unique_filename

router = APIRouter()

# Allowed file types for resumes
ALLOWED_TYPES = {
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


# ============================================================================
# SCHEMAS
# ============================================================================

class ResumeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    is_default: Optional[bool] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    from app.core.auth import verify_token
    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    return payload.get("sub")


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
async def list_resumes(authorization: str = Header(None)):
    """List all resumes for current user"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    result = db.table("user_resumes") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("is_default", desc=True) \
        .order("created_at", desc=True) \
        .execute()

    return result.data or []


@router.post("")
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(None),
    is_default: bool = Form(False),
    authorization: str = Header(None)
):
    """Upload a new resume"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: PDF, DOC, DOCX"
        )

    # Read and validate file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: 10MB"
        )

    # Generate unique filename
    ext = ALLOWED_TYPES[file.content_type]
    unique_filename = f"resumes/{user_id}/{uuid.uuid4()}{ext}"

    # Upload to S3
    try:
        file_obj = io.BytesIO(file_content)
        storage_client.from_("backlot-files").upload(
            unique_filename,
            file_obj,
            {"content_type": file.content_type}
        )

        # Get the file URL
        file_url = storage_client.from_("backlot-files").get_public_url(unique_filename)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

    # If setting as default, unset other defaults first
    if is_default:
        db.table("user_resumes") \
            .update({"is_default": False}) \
            .eq("user_id", user_id) \
            .eq("is_default", True) \
            .execute()

    # Create database record
    display_name = name or file.filename or "Resume"

    result = db.table("user_resumes").insert({
        "user_id": user_id,
        "name": display_name,
        "file_key": unique_filename,
        "file_url": file_url,
        "file_size": len(file_content),
        "file_type": file.content_type,
        "is_default": is_default,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save resume record")

    return result.data[0]


@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    authorization: str = Header(None)
):
    """Get a specific resume"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    result = db.table("user_resumes") \
        .select("*") \
        .eq("id", resume_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    return result.data


@router.get("/{resume_id}/download-url")
async def get_resume_download_url(
    resume_id: str,
    authorization: str = Header(None)
):
    """Get a signed download URL for a resume"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    result = db.table("user_resumes") \
        .select("file_key") \
        .eq("id", resume_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Generate signed URL (valid for 1 hour)
    signed_result = storage_client.from_("backlot-files").create_signed_url(
        result.data["file_key"],
        expires_in=3600
    )

    if signed_result.get("error"):
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

    return {"download_url": signed_result["signedUrl"]}


@router.put("/{resume_id}")
async def update_resume(
    resume_id: str,
    input: ResumeUpdate,
    authorization: str = Header(None)
):
    """Update resume metadata"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Verify ownership
    existing = db.table("user_resumes") \
        .select("id") \
        .eq("id", resume_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    update_data = {"updated_at": datetime.utcnow().isoformat()}

    if input.name is not None:
        update_data["name"] = input.name

    if input.is_default is not None:
        # If setting as default, unset other defaults first
        if input.is_default:
            db.table("user_resumes") \
                .update({"is_default": False}) \
                .eq("user_id", user_id) \
                .eq("is_default", True) \
                .neq("id", resume_id) \
                .execute()
        update_data["is_default"] = input.is_default

    result = db.table("user_resumes") \
        .update(update_data) \
        .eq("id", resume_id) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update resume")

    return result.data[0]


@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    authorization: str = Header(None)
):
    """Delete a resume"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Get resume to find file key
    existing = db.table("user_resumes") \
        .select("id, file_key") \
        .eq("id", resume_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Delete from S3
    try:
        storage_client.from_("backlot-files").remove([existing.data["file_key"]])
    except Exception as e:
        # Log but don't fail - file might already be gone
        print(f"Warning: Failed to delete S3 file: {e}")

    # Delete database record
    db.table("user_resumes") \
        .delete() \
        .eq("id", resume_id) \
        .execute()

    return {"success": True, "message": "Resume deleted"}


@router.patch("/{resume_id}/set-default")
async def set_default_resume(
    resume_id: str,
    authorization: str = Header(None)
):
    """Set a resume as the default"""
    user_id = await get_user_id_from_token(authorization)
    db = get_client()

    # Verify ownership
    existing = db.table("user_resumes") \
        .select("id") \
        .eq("id", resume_id) \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Unset other defaults
    db.table("user_resumes") \
        .update({"is_default": False}) \
        .eq("user_id", user_id) \
        .eq("is_default", True) \
        .execute()

    # Set this one as default
    result = db.table("user_resumes") \
        .update({"is_default": True, "updated_at": datetime.utcnow().isoformat()}) \
        .eq("id", resume_id) \
        .execute()

    return result.data[0] if result.data else {"success": True}
