"""
Admin Email Logs API Routes
Provides endpoints for viewing and managing email logs from AWS SES
"""
from fastapi import APIRouter, HTTPException, Query, Header
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.core.database import get_client

router = APIRouter()


class EmailLogSummary(BaseModel):
    id: str
    message_id: str
    recipient_email: str
    sender_email: str
    subject: Optional[str]
    email_type: Optional[str]
    status: str
    source_service: Optional[str]
    source_action: Optional[str]
    sent_at: Optional[datetime]
    created_at: datetime


class EmailLogDetail(BaseModel):
    id: str
    message_id: str
    sender_email: str
    sender_name: Optional[str]
    recipient_email: str
    subject: Optional[str]
    email_type: Optional[str]
    status: str
    bounce_type: Optional[str]
    bounce_subtype: Optional[str]
    bounce_diagnostic: Optional[str]
    complaint_feedback_type: Optional[str]
    complaint_sub_type: Optional[str]
    open_count: int
    click_count: int
    first_opened_at: Optional[datetime]
    last_opened_at: Optional[datetime]
    first_clicked_at: Optional[datetime]
    last_clicked_at: Optional[datetime]
    clicked_links: list
    user_agent: Optional[str]
    ip_address: Optional[str]
    source_service: Optional[str]
    source_action: Optional[str]
    source_user_id: Optional[str]
    source_reference_id: Optional[str]
    ses_configuration_set: Optional[str]
    sent_at: Optional[datetime]
    delivered_at: Optional[datetime]
    bounced_at: Optional[datetime]
    complained_at: Optional[datetime]
    rejected_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class EmailStats(BaseModel):
    total_sent: int
    total_delivered: int
    total_bounced: int
    total_complained: int
    total_opened: int
    total_clicked: int
    delivery_rate: float
    bounce_rate: float
    open_rate: float
    click_rate: float


class EmailLogListResponse(BaseModel):
    logs: List[EmailLogSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/emails/stats", response_model=EmailStats)
async def get_email_stats(
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    authorization: str = Header(None)
):
    """Get email delivery statistics for the specified time period"""
    try:
        client = get_client()

        # Calculate date range
        since_date = (datetime.utcnow() - timedelta(days=days)).isoformat()

        # Get counts by status
        all_emails = client.table("email_logs").select("id, status, open_count, click_count", count="exact").gte("created_at", since_date).execute()

        total = all_emails.count or 0

        # Count by status
        sent = 0
        delivered = 0
        bounced = 0
        complained = 0
        opened = 0
        clicked = 0

        for log in (all_emails.data or []):
            status = log.get("status", "")
            if status == "delivered":
                delivered += 1
            elif status == "bounced":
                bounced += 1
            elif status == "complained":
                complained += 1
            elif status in ["sent", "queued"]:
                sent += 1

            if log.get("open_count", 0) > 0:
                opened += 1
            if log.get("click_count", 0) > 0:
                clicked += 1

        # Calculate rates
        total_sent = total
        delivery_rate = (delivered / total_sent * 100) if total_sent > 0 else 0
        bounce_rate = (bounced / total_sent * 100) if total_sent > 0 else 0
        open_rate = (opened / delivered * 100) if delivered > 0 else 0
        click_rate = (clicked / delivered * 100) if delivered > 0 else 0

        return EmailStats(
            total_sent=total_sent,
            total_delivered=delivered,
            total_bounced=bounced,
            total_complained=complained,
            total_opened=opened,
            total_clicked=clicked,
            delivery_rate=round(delivery_rate, 2),
            bounce_rate=round(bounce_rate, 2),
            open_rate=round(open_rate, 2),
            click_rate=round(click_rate, 2)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/emails/logs", response_model=EmailLogListResponse)
async def list_email_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status"),
    email_type: Optional[str] = Query(None, description="Filter by email type"),
    source_service: Optional[str] = Query(None, description="Filter by source service"),
    search: Optional[str] = Query(None, description="Search by recipient email or subject"),
    start_date: Optional[str] = Query(None, description="Start date filter (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date filter (ISO format)"),
    authorization: str = Header(None)
):
    """Get paginated list of email logs with filters"""
    try:
        client = get_client()

        # Build query
        query = client.table("email_logs").select(
            "id, message_id, recipient_email, sender_email, subject, email_type, status, source_service, source_action, sent_at, created_at",
            count="exact"
        )

        # Apply filters
        if status:
            query = query.eq("status", status)
        if email_type:
            query = query.eq("email_type", email_type)
        if source_service:
            query = query.eq("source_service", source_service)
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        if search:
            # Search in recipient_email or subject
            query = query.or_(f"recipient_email.ilike.%{search}%,subject.ilike.%{search}%")

        # Calculate pagination
        offset = (page - 1) * page_size

        # Execute with pagination and ordering
        result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

        total = result.count or 0
        total_pages = (total + page_size - 1) // page_size if total > 0 else 1

        logs = [
            EmailLogSummary(
                id=log["id"],
                message_id=log["message_id"],
                recipient_email=log["recipient_email"],
                sender_email=log["sender_email"],
                subject=log.get("subject"),
                email_type=log.get("email_type"),
                status=log["status"],
                source_service=log.get("source_service"),
                source_action=log.get("source_action"),
                sent_at=log.get("sent_at"),
                created_at=log["created_at"]
            )
            for log in (result.data or [])
        ]

        return EmailLogListResponse(
            logs=logs,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/emails/logs/{log_id}", response_model=EmailLogDetail)
async def get_email_log_detail(
    log_id: str,
    authorization: str = Header(None)
):
    """Get detailed information about a specific email log"""
    try:
        client = get_client()

        result = client.table("email_logs").select("*").eq("id", log_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Email log not found")

        log = result.data
        return EmailLogDetail(
            id=log["id"],
            message_id=log["message_id"],
            sender_email=log["sender_email"],
            sender_name=log.get("sender_name"),
            recipient_email=log["recipient_email"],
            subject=log.get("subject"),
            email_type=log.get("email_type"),
            status=log["status"],
            bounce_type=log.get("bounce_type"),
            bounce_subtype=log.get("bounce_subtype"),
            bounce_diagnostic=log.get("bounce_diagnostic"),
            complaint_feedback_type=log.get("complaint_feedback_type"),
            complaint_sub_type=log.get("complaint_sub_type"),
            open_count=log.get("open_count", 0),
            click_count=log.get("click_count", 0),
            first_opened_at=log.get("first_opened_at"),
            last_opened_at=log.get("last_opened_at"),
            first_clicked_at=log.get("first_clicked_at"),
            last_clicked_at=log.get("last_clicked_at"),
            clicked_links=log.get("clicked_links", []),
            user_agent=log.get("user_agent"),
            ip_address=log.get("ip_address"),
            source_service=log.get("source_service"),
            source_action=log.get("source_action"),
            source_user_id=log.get("source_user_id"),
            source_reference_id=log.get("source_reference_id"),
            ses_configuration_set=log.get("ses_configuration_set"),
            sent_at=log.get("sent_at"),
            delivered_at=log.get("delivered_at"),
            bounced_at=log.get("bounced_at"),
            complained_at=log.get("complained_at"),
            rejected_at=log.get("rejected_at"),
            created_at=log["created_at"],
            updated_at=log["updated_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/emails/export")
async def export_email_logs(
    status: Optional[str] = Query(None),
    email_type: Optional[str] = Query(None),
    source_service: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    authorization: str = Header(None)
):
    """Export email logs as CSV format"""
    try:
        from fastapi.responses import StreamingResponse
        import csv
        import io

        client = get_client()

        # Build query
        query = client.table("email_logs").select(
            "message_id, recipient_email, sender_email, subject, email_type, status, "
            "bounce_type, bounce_diagnostic, complaint_feedback_type, "
            "open_count, click_count, source_service, source_action, "
            "sent_at, delivered_at, bounced_at, complained_at, created_at"
        )

        # Apply filters
        if status:
            query = query.eq("status", status)
        if email_type:
            query = query.eq("email_type", email_type)
        if source_service:
            query = query.eq("source_service", source_service)
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)

        # Get all matching records (limit to 10000 for safety)
        result = query.order("created_at", desc=True).limit(10000).execute()

        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Header row
        writer.writerow([
            "Message ID", "Recipient", "Sender", "Subject", "Type", "Status",
            "Bounce Type", "Bounce Diagnostic", "Complaint Type",
            "Opens", "Clicks", "Source Service", "Source Action",
            "Sent At", "Delivered At", "Bounced At", "Complained At", "Created At"
        ])

        # Data rows
        for log in (result.data or []):
            writer.writerow([
                log.get("message_id", ""),
                log.get("recipient_email", ""),
                log.get("sender_email", ""),
                log.get("subject", ""),
                log.get("email_type", ""),
                log.get("status", ""),
                log.get("bounce_type", ""),
                log.get("bounce_diagnostic", ""),
                log.get("complaint_feedback_type", ""),
                log.get("open_count", 0),
                log.get("click_count", 0),
                log.get("source_service", ""),
                log.get("source_action", ""),
                log.get("sent_at", ""),
                log.get("delivered_at", ""),
                log.get("bounced_at", ""),
                log.get("complained_at", ""),
                log.get("created_at", "")
            ])

        output.seek(0)

        # Generate filename with date
        filename = f"email_logs_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/emails/types")
async def get_email_types(authorization: str = Header(None)):
    """Get list of distinct email types for filtering"""
    try:
        client = get_client()
        result = client.table("email_logs").select("email_type").not_.is_("email_type", "null").execute()

        # Get unique types
        types = list(set(log["email_type"] for log in (result.data or []) if log.get("email_type")))
        types.sort()

        return {"types": types}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/emails/sources")
async def get_email_sources(authorization: str = Header(None)):
    """Get list of distinct source services for filtering"""
    try:
        client = get_client()
        result = client.table("email_logs").select("source_service").not_.is_("source_service", "null").execute()

        # Get unique sources
        sources = list(set(log["source_service"] for log in (result.data or []) if log.get("source_service")))
        sources.sort()

        return {"sources": sources}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
