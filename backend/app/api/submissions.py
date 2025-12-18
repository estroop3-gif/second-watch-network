"""
Submissions API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
from app.schemas.submissions import Submission, SubmissionCreate, SubmissionUpdate

router = APIRouter()


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
