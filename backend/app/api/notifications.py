"""
Notifications API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
from app.schemas.notifications import Notification, NotificationCreate, NotificationCounts

router = APIRouter()


@router.get("/", response_model=List[Notification])
async def list_notifications(
    user_id: str,
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    type: Optional[str] = None
):
    """List user notifications"""
    try:
        client = get_client()
        query = client.table("notifications").select("*").eq("user_id", user_id)
        
        if status:
            query = query.eq("status", status)
        if type:
            query = query.eq("type", type)
        
        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/counts", response_model=NotificationCounts)
async def get_notification_counts(user_id: str):
    """Get notification counts by type"""
    try:
        client = get_client()
        
        # Get total unread
        total_response = client.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("status", "unread").execute()
        
        # Get counts by type
        messages_response = client.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("status", "unread").eq("type", "message").execute()
        requests_response = client.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("status", "unread").eq("type", "connection_request").execute()
        submissions_response = client.table("notifications").select("id", count="exact").eq("user_id", user_id).eq("status", "unread").eq("type", "submission_update").execute()
        
        return {
            "total": total_response.count or 0,
            "messages": messages_response.count or 0,
            "connection_requests": requests_response.count or 0,
            "submission_updates": submissions_response.count or 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mark-read")
async def mark_notifications_read(notification_ids: List[str]):
    """Mark notifications as read"""
    try:
        client = get_client()
        client.table("notifications").update({"status": "read"}).in_("id", notification_ids).execute()
        return {"message": "Notifications marked as read"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Notification)
async def create_notification(notification: NotificationCreate):
    """Create notification"""
    try:
        client = get_client()
        response = client.table("notifications").insert(notification.model_dump()).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
