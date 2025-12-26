"""
Uploads API - Handle file uploads for various features
"""
import os
import uuid
import mimetypes
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.core.storage import (
    storage_client,
    generate_unique_filename,
    BACKLOT_FILES_BUCKET,
)

router = APIRouter()

# Maximum file sizes (in bytes)
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_FILE_SIZE = 50 * 1024 * 1024   # 50 MB

# Allowed file types for message attachments
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"
}
ALLOWED_FILE_TYPES = {
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
    # Media
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    # Archives
    "application/zip",
    "application/x-rar-compressed",
}


class UploadResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    url: str
    content_type: str
    size: int
    uploaded_at: datetime


class AttachmentInfo(BaseModel):
    id: str
    filename: str
    original_filename: str
    url: str
    content_type: str
    size: int
    type: str  # 'image', 'file', 'audio', 'video'


def get_attachment_type(content_type: str) -> str:
    """Determine attachment type from content type."""
    if content_type.startswith("image/"):
        return "image"
    elif content_type.startswith("audio/"):
        return "audio"
    elif content_type.startswith("video/"):
        return "video"
    else:
        return "file"


@router.post("/message-attachment", response_model=UploadResponse)
async def upload_message_attachment(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    conversation_id: Optional[str] = Form(None),
):
    """
    Upload a file attachment for a message.
    Returns the attachment info to include in the message.
    """
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")

        # Get content type
        content_type = file.content_type or mimetypes.guess_type(file.filename)[0]
        if not content_type:
            content_type = "application/octet-stream"

        # Check if file type is allowed
        is_image = content_type in ALLOWED_IMAGE_TYPES
        is_allowed_file = content_type in ALLOWED_FILE_TYPES

        if not is_image and not is_allowed_file:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{content_type}' is not allowed"
            )

        # Read file content
        content = await file.read()
        file_size = len(content)

        # Check file size
        max_size = MAX_IMAGE_SIZE if is_image else MAX_FILE_SIZE
        if file_size > max_size:
            max_mb = max_size / (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {max_mb:.0f} MB"
            )

        # Generate unique filename
        ext = os.path.splitext(file.filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{ext}"

        # Build path: messages/{user_id}/{conversation_id or 'drafts'}/{filename}
        conv_folder = conversation_id or "drafts"
        path = f"messages/{user_id}/{conv_folder}/{unique_filename}"

        # Upload to S3
        bucket = storage_client.from_("backlot-files")

        # Create file-like object from content
        from io import BytesIO
        file_obj = BytesIO(content)

        result = bucket.upload(
            path,
            file_obj,
            {"content_type": content_type}
        )

        # Generate signed URL (valid for 7 days)
        signed_url_result = bucket.create_signed_url(path, expires_in=7 * 24 * 3600)
        url = signed_url_result.get("signedUrl") or bucket.get_public_url(path)

        return UploadResponse(
            id=unique_filename,
            filename=unique_filename,
            original_filename=file.filename,
            url=url,
            content_type=content_type,
            size=file_size,
            uploaded_at=datetime.utcnow()
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/message-attachments", response_model=List[UploadResponse])
async def upload_multiple_attachments(
    files: List[UploadFile] = File(...),
    user_id: str = Form(...),
    conversation_id: Optional[str] = Form(None),
):
    """
    Upload multiple file attachments for a message.
    """
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files per upload")

    results = []
    for file in files:
        # Create a new UploadFile-like object for each file
        result = await upload_message_attachment(
            file=file,
            user_id=user_id,
            conversation_id=conversation_id
        )
        results.append(result)

    return results


@router.get("/message-attachment/{attachment_id}/url")
async def get_attachment_url(attachment_id: str, user_id: str, conversation_id: str):
    """
    Get a fresh signed URL for an attachment.
    Use this when the original URL has expired.
    """
    try:
        path = f"messages/{user_id}/{conversation_id}/{attachment_id}"
        bucket = storage_client.from_("backlot-files")

        signed_url_result = bucket.create_signed_url(path, expires_in=7 * 24 * 3600)

        if signed_url_result.get("error"):
            raise HTTPException(status_code=404, detail="Attachment not found")

        return {"url": signed_url_result["signedUrl"]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/message-attachment/{attachment_id}")
async def delete_attachment(attachment_id: str, user_id: str, conversation_id: str):
    """
    Delete an attachment.
    """
    try:
        path = f"messages/{user_id}/{conversation_id}/{attachment_id}"
        bucket = storage_client.from_("backlot-files")

        bucket.remove([path])

        return {"success": True, "message": "Attachment deleted"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
