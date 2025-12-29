"""
Alpha Feedback API Routes
User-facing endpoints for alpha testers to submit bug reports and feedback
"""
from fastapi import APIRouter, HTTPException, Header
from typing import Optional, Dict, Any
from pydantic import BaseModel
from uuid import uuid4
from datetime import datetime

from app.core.database import get_client, execute_single
from app.core.storage import StorageBucket

router = APIRouter()


def get_profile_id_from_cognito_id(cognito_user_id: str) -> Optional[str]:
    """Look up profile ID from Cognito user ID"""
    uid_str = str(cognito_user_id)

    # Try cognito_user_id first
    result = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :cuid LIMIT 1",
        {"cuid": uid_str}
    )
    if result:
        return str(result["id"])

    # Fallback: try direct ID match
    result = execute_single(
        "SELECT id FROM profiles WHERE id::text = :uid LIMIT 1",
        {"uid": uid_str}
    )
    if result:
        return str(result["id"])

    return None


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
        return {"id": user.get("id"), "sub": user.get("id"), "email": user.get("email")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

BACKLOT_FILES_BUCKET = "swn-backlot-files-517220555400"


class FeedbackSubmission(BaseModel):
    title: str
    description: str
    feedback_type: str  # bug, feature, ux, performance, general
    priority: Optional[str] = "medium"  # low, medium, high, critical
    page_url: Optional[str] = None
    browser_info: Optional[dict] = None
    context: Optional[dict] = None  # recent_actions, console_errors, network_timing
    screenshot_url: Optional[str] = None


class ScreenshotUploadRequest(BaseModel):
    filename: str


@router.post("/submit")
async def submit_alpha_feedback(
    data: FeedbackSubmission,
    authorization: str = Header(None)
):
    """Submit feedback - only alpha testers can use this endpoint"""
    try:
        user = await get_current_user_from_token(authorization)
        cognito_id = user.get("sub") or user.get("user_id") or user.get("id")

        if not cognito_id:
            raise HTTPException(status_code=401, detail="User not authenticated")

        # Get profile ID from Cognito ID
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")

        client = get_client()

        # Verify user is alpha tester
        profile_result = client.table("profiles").select("is_alpha_tester").eq("id", profile_id).limit(1).execute()

        if not profile_result.data or not profile_result.data[0].get("is_alpha_tester"):
            raise HTTPException(status_code=403, detail="Only alpha testers can submit feedback")

        # Insert feedback
        feedback = {
            "user_id": profile_id,
            "title": data.title,
            "description": data.description,
            "feedback_type": data.feedback_type,
            "priority": data.priority,
            "page_url": data.page_url,
            "browser_info": data.browser_info,
            "context": data.context,
            "screenshot_url": data.screenshot_url,
            "status": "new",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        result = client.table("alpha_feedback").insert(feedback).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to submit feedback")

        return {
            "success": True,
            "message": "Feedback submitted successfully",
            "feedback_id": result.data[0]["id"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/screenshot-upload-url")
async def get_screenshot_upload_url(
    data: ScreenshotUploadRequest,
    authorization: str = Header(None)
):
    """Get presigned URL for screenshot upload - only for alpha testers"""
    try:
        user = await get_current_user_from_token(authorization)
        cognito_id = user.get("sub") or user.get("user_id") or user.get("id")

        if not cognito_id:
            raise HTTPException(status_code=401, detail="User not authenticated")

        # Get profile ID from Cognito ID
        profile_id = get_profile_id_from_cognito_id(cognito_id)
        if not profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")

        client = get_client()

        # Verify user is alpha tester
        profile_result = client.table("profiles").select("is_alpha_tester").eq("id", profile_id).limit(1).execute()

        if not profile_result.data or not profile_result.data[0].get("is_alpha_tester"):
            raise HTTPException(status_code=403, detail="Only alpha testers can upload screenshots")

        # Generate unique key for the screenshot
        unique_id = str(uuid4())
        key = f"alpha-feedback/{profile_id}/{unique_id}/{data.filename}"

        # Create presigned upload URL
        bucket = StorageBucket(BACKLOT_FILES_BUCKET)
        presigned = bucket.create_signed_upload_url(key)

        return {
            "upload_url": presigned.get("url"),
            "fields": presigned.get("fields", {}),
            "key": key,
            "public_url": f"https://{BACKLOT_FILES_BUCKET}.s3.amazonaws.com/{key}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my-feedback")
async def get_my_feedback(
    skip: int = 0,
    limit: int = 20,
    authorization: str = Header(None)
):
    """Get feedback submitted by the current user"""
    try:
        user = await get_current_user_from_token(authorization)
        user_id = user.get("sub") or user.get("user_id") or user.get("id")

        if not user_id:
            raise HTTPException(status_code=401, detail="User not authenticated")

        client = get_client()

        result = client.table("alpha_feedback").select(
            "id, title, feedback_type, status, priority, created_at",
            count="exact"
        ).eq("user_id", user_id).order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        return {
            "feedback": result.data or [],
            "total": result.count or 0
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
