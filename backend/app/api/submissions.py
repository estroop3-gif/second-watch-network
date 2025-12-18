"""
Submissions API Routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.core.database import get_client
from app.core.auth import get_current_user
from app.schemas.submissions import Submission, SubmissionCreate, SubmissionUpdate

router = APIRouter()


@router.get("/my", response_model=List[Submission])
async def get_my_submissions(user=Depends(get_current_user)):
    """Get current user's submissions"""
    try:
        client = get_client()
        user_id = user.get("id")

        # Get profile to find profile_id for user_id matching
        profile = client.table("profiles").select("id").or_(
            f"cognito_user_id.eq.{user_id},id.eq.{user_id}"
        ).maybe_single().execute()

        profile_id = profile.data.get("id") if profile.data else user_id

        response = client.table("submissions").select(
            "id, project_title, status, project_type, created_at, name, email, logline, description, youtube_link, has_unread_user_messages"
        ).or_(f"user_id.eq.{user_id},user_id.eq.{profile_id}").order(
            "created_at", desc=True
        ).execute()

        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Submission)
async def create_submission(submission: SubmissionCreate, user_id: str):
    """Create new submission"""
    try:
        client = get_client()
        data = submission.model_dump()
        data["user_id"] = user_id
        data["status"] = "pending"
        
        response = client.table("submissions").insert(data).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{submission_id}", response_model=Submission)
async def get_submission(submission_id: str):
    """Get submission by ID"""
    try:
        client = get_client()
        response = client.table("submissions").select("*").eq("id", submission_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[Submission])
async def list_submissions(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    user_id: Optional[str] = None
):
    """List submissions"""
    try:
        client = get_client()
        query = client.table("submissions").select("*")
        
        if status:
            query = query.eq("status", status)
        if user_id:
            query = query.eq("user_id", user_id)
        
        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{submission_id}", response_model=Submission)
async def update_submission(submission_id: str, submission: SubmissionUpdate):
    """Update submission"""
    try:
        client = get_client()
        response = client.table("submissions").update(
            submission.model_dump(exclude_unset=True)
        ).eq("id", submission_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{submission_id}")
async def delete_submission(submission_id: str):
    """Delete submission"""
    try:
        client = get_client()
        client.table("submissions").delete().eq("id", submission_id).execute()
        return {"message": "Submission deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# SUBMISSION MESSAGES
# ============================================================================

from pydantic import BaseModel


class SubmissionMessageCreate(BaseModel):
    content: str


@router.get("/{submission_id}/messages")
async def list_submission_messages(submission_id: str):
    """List messages for a submission"""
    try:
        client = get_client()
        response = client.table("submission_messages").select(
            "id, content, created_at, sender_id, profiles(avatar_url, full_name, username)"
        ).eq("submission_id", submission_id).order("created_at").execute()

        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{submission_id}/messages")
async def create_submission_message(
    submission_id: str,
    message: SubmissionMessageCreate,
    sender_id: str
):
    """Create a message for a submission"""
    try:
        client = get_client()
        response = client.table("submission_messages").insert({
            "submission_id": submission_id,
            "sender_id": sender_id,
            "content": message.content,
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create message")

        # Fetch with profile data
        message_id = response.data[0]["id"]
        full_message = client.table("submission_messages").select(
            "id, content, created_at, sender_id, profiles(avatar_url, full_name, username)"
        ).eq("id", message_id).single().execute()

        return full_message.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
