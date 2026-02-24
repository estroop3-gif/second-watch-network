"""
Notifications API Routes
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client, execute_single, execute_update
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
            # Convert status to is_read boolean
            if status == "unread":
                query = query.eq("is_read", False)
            elif status == "read":
                query = query.eq("is_read", True)
        if type:
            query = query.eq("type", type)

        response = query.range(skip, skip + limit - 1).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/counts", response_model=NotificationCounts)
async def get_notification_counts(user_id: str):
    """Get notification counts by type — single query with FILTER for performance"""
    try:
        row = execute_single(
            """
            SELECT
                COUNT(*) FILTER (WHERE is_read = false) AS total,
                COUNT(*) FILTER (WHERE is_read = false AND type = 'message') AS messages,
                COUNT(*) FILTER (WHERE is_read = false AND type = 'connection_request') AS connection_requests,
                COUNT(*) FILTER (WHERE is_read = false AND type = 'submission_update') AS submission_updates,
                COUNT(*) FILTER (WHERE is_read = false AND type LIKE 'crm_%') AS crm
            FROM notifications
            WHERE user_id = :uid
            """,
            {"uid": user_id},
        )

        return {
            "total": row["total"] if row else 0,
            "messages": row["messages"] if row else 0,
            "connection_requests": row["connection_requests"] if row else 0,
            "submission_updates": row["submission_updates"] if row else 0,
            "crm": row["crm"] if row else 0,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mark-read")
async def mark_notifications_read(notification_ids: List[str]):
    """Mark notifications as read"""
    try:
        client = get_client()
        client.table("notifications").update({"is_read": True}).in_("id", notification_ids).execute()
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


@router.post("/mark-all-read")
async def mark_all_notifications_read(user_id: str, tab: str = "all"):
    """Mark all notifications as read, optionally filtered by tab/type"""
    try:
        client = get_client()
        query = client.table("notifications").update({"is_read": True}).eq("user_id", user_id).eq("is_read", False)

        # Filter by type based on tab
        if tab == "messages":
            query = query.eq("type", "message")
        elif tab == "requests":
            query = query.eq("type", "connection_request")
        elif tab == "submissions":
            query = query.eq("type", "submission_update")
        elif tab == "crm":
            # CRM types use prefix — query builder doesn't support LIKE on update, use raw SQL
            execute_update(
                "UPDATE notifications SET is_read = true WHERE user_id = :uid AND is_read = false AND type LIKE 'crm_%'",
                {"uid": user_id},
            )
            return {"message": "Marked all crm notifications as read"}
        # else tab == "all" or "unread" - no type filter

        query.execute()
        return {"message": f"Marked all {tab} notifications as read"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/settings/{user_id}")
async def get_notification_settings(user_id: str):
    """Get user notification settings"""
    try:
        client = get_client()
        response = client.table("user_notification_settings").select("*").eq("user_id", user_id).single().execute()
        return response.data
    except Exception as e:
        # If no settings exist, return None (frontend will use defaults)
        return None


@router.put("/settings/{user_id}")
async def update_notification_settings(
    user_id: str,
    settings: dict
):
    """Update user notification settings (upsert)"""
    try:
        client = get_client()

        # Prepare the data with user_id
        data = {
            "user_id": user_id,
            "email_digest_enabled": settings.get("email_digest_enabled", False),
            "email_on_submission_updates": settings.get("email_on_submission_updates", True),
            "email_on_connection_accepts": settings.get("email_on_connection_accepts", True),
            "digest_hour_utc": settings.get("digest_hour_utc", 13),
        }

        # Upsert - insert or update on conflict
        response = client.table("user_notification_settings").upsert(
            data,
            on_conflict="user_id"
        ).execute()

        return response.data[0] if response.data else data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
