"""
Admin Email API Routes
Provides endpoints for:
- Email delivery logs from AWS SES
- Admin/system email account management
- Admin email inbox (send/receive)
- Access grant management for shared inboxes
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.core.database import get_client, execute_query, execute_single, execute_insert
from app.core.deps import get_user_profile
from app.core.permissions import Permission, require_permissions

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


# ============================================================================
# Admin/System Email Account Management
# ============================================================================

class CreateAdminEmailAccountRequest(BaseModel):
    email_address: str
    display_name: str
    account_type: str = "admin"  # admin or system
    signature_html: Optional[str] = None


class UpdateAdminEmailAccountRequest(BaseModel):
    display_name: Optional[str] = None
    signature_html: Optional[str] = None
    is_active: Optional[bool] = None


class GrantEmailAccessRequest(BaseModel):
    profile_id: str
    role: str = "member"


def _check_admin_email_access(profile: Dict[str, Any], account_id: str) -> Dict[str, Any]:
    """Check if user is admin or has explicit access to this admin email account.
    Returns the account dict or raises 403."""
    account = execute_single(
        "SELECT * FROM crm_email_accounts WHERE id = :aid AND account_type != 'rep'",
        {"aid": account_id},
    )
    if not account:
        raise HTTPException(404, "Admin email account not found")

    # Admins always have access
    if profile.get("is_admin") or profile.get("is_superadmin"):
        return account

    # Check junction table
    access = execute_single(
        "SELECT id FROM admin_email_access WHERE account_id = :aid AND profile_id = :pid",
        {"aid": account_id, "pid": profile["id"]},
    )
    if not access:
        raise HTTPException(403, "You do not have access to this email account")

    return account


@router.post("/email-accounts")
async def create_admin_email_account(
    data: CreateAdminEmailAccountRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_EMAIL_MANAGE)),
):
    """Create an admin or system email account."""
    if data.account_type not in ("admin", "system"):
        raise HTTPException(400, "account_type must be 'admin' or 'system'")

    # Check for duplicate email
    existing = execute_single(
        "SELECT id FROM crm_email_accounts WHERE email_address = :email",
        {"email": data.email_address},
    )
    if existing:
        raise HTTPException(400, "An account with this email address already exists")

    account = execute_single(
        """
        INSERT INTO crm_email_accounts (email_address, display_name, account_type, signature_html, is_active)
        VALUES (:email, :name, :type, :sig, true)
        RETURNING *
        """,
        {
            "email": data.email_address,
            "name": data.display_name,
            "type": data.account_type,
            "sig": data.signature_html,
        },
    )
    return {"account": account}


@router.get("/email-accounts")
async def list_admin_email_accounts(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_EMAIL_MANAGE)),
):
    """List all admin/system email accounts."""
    accounts = execute_query(
        """
        SELECT a.*,
               (SELECT COUNT(*) FROM admin_email_access WHERE account_id = a.id) as access_count
        FROM crm_email_accounts a
        WHERE a.account_type != 'rep'
        ORDER BY a.created_at DESC
        """
    )
    return {"accounts": accounts}


@router.put("/email-accounts/{account_id}")
async def update_admin_email_account(
    account_id: str,
    data: UpdateAdminEmailAccountRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_EMAIL_MANAGE)),
):
    """Update an admin/system email account."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE id = :aid AND account_type != 'rep'",
        {"aid": account_id},
    )
    if not account:
        raise HTTPException(404, "Admin email account not found")

    updates = {}
    if data.display_name is not None:
        updates["display_name"] = data.display_name
    if data.signature_html is not None:
        updates["signature_html"] = data.signature_html
    if data.is_active is not None:
        updates["is_active"] = data.is_active

    if not updates:
        raise HTTPException(400, "No fields to update")

    set_clauses = ", ".join(f"{k} = :{k}" for k in updates)
    updates["aid"] = account_id
    updated = execute_single(
        f"UPDATE crm_email_accounts SET {set_clauses} WHERE id = :aid RETURNING *",
        updates,
    )
    return {"account": updated}


@router.delete("/email-accounts/{account_id}")
async def deactivate_admin_email_account(
    account_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_EMAIL_MANAGE)),
):
    """Soft-deactivate an admin/system email account."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE id = :aid AND account_type != 'rep'",
        {"aid": account_id},
    )
    if not account:
        raise HTTPException(404, "Admin email account not found")

    execute_single(
        "UPDATE crm_email_accounts SET is_active = false WHERE id = :aid RETURNING id",
        {"aid": account_id},
    )
    return {"success": True}


# ============================================================================
# Access Grants
# ============================================================================

@router.get("/email-accounts/{account_id}/access")
async def list_email_account_access(
    account_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_EMAIL_MANAGE)),
):
    """List users with access to an admin email account."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE id = :aid AND account_type != 'rep'",
        {"aid": account_id},
    )
    if not account:
        raise HTTPException(404, "Admin email account not found")

    grants = execute_query(
        """
        SELECT a.id, a.role, a.created_at,
               p.id as profile_id, p.full_name, p.email, p.avatar_url
        FROM admin_email_access a
        JOIN profiles p ON p.id = a.profile_id
        WHERE a.account_id = :aid
        ORDER BY a.created_at ASC
        """,
        {"aid": account_id},
    )
    return {"grants": grants}


@router.post("/email-accounts/{account_id}/access")
async def grant_email_account_access(
    account_id: str,
    data: GrantEmailAccessRequest,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_EMAIL_MANAGE)),
):
    """Grant a user access to an admin email account."""
    account = execute_single(
        "SELECT id FROM crm_email_accounts WHERE id = :aid AND account_type != 'rep'",
        {"aid": account_id},
    )
    if not account:
        raise HTTPException(404, "Admin email account not found")

    # Verify profile exists
    target = execute_single(
        "SELECT id, full_name FROM profiles WHERE id = :pid",
        {"pid": data.profile_id},
    )
    if not target:
        raise HTTPException(404, "Profile not found")

    # Check not already granted
    existing = execute_single(
        "SELECT id FROM admin_email_access WHERE account_id = :aid AND profile_id = :pid",
        {"aid": account_id, "pid": data.profile_id},
    )
    if existing:
        raise HTTPException(400, "User already has access to this account")

    grant = execute_single(
        """
        INSERT INTO admin_email_access (account_id, profile_id, role, granted_by)
        VALUES (:aid, :pid, :role, :gby)
        RETURNING *
        """,
        {
            "aid": account_id,
            "pid": data.profile_id,
            "role": data.role,
            "gby": profile["id"],
        },
    )
    return {"grant": grant}


@router.delete("/email-accounts/{account_id}/access/{target_profile_id}")
async def revoke_email_account_access(
    account_id: str,
    target_profile_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_EMAIL_MANAGE)),
):
    """Revoke a user's access to an admin email account."""
    deleted = execute_single(
        "DELETE FROM admin_email_access WHERE account_id = :aid AND profile_id = :pid RETURNING id",
        {"aid": account_id, "pid": target_profile_id},
    )
    if not deleted:
        raise HTTPException(404, "Access grant not found")
    return {"success": True}


# ============================================================================
# Admin Email Inbox — Current User's Accessible Accounts
# ============================================================================

@router.get("/email/my-accounts")
async def get_my_admin_email_accounts(
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """List admin/system email accounts the current user can access."""
    is_admin = profile.get("is_admin") or profile.get("is_superadmin")

    if is_admin:
        # Admins see all admin/system accounts
        accounts = execute_query(
            """
            SELECT * FROM crm_email_accounts
            WHERE account_type != 'rep' AND is_active = true
            ORDER BY display_name ASC
            """
        )
    else:
        # Non-admins see only granted accounts
        accounts = execute_query(
            """
            SELECT a.* FROM crm_email_accounts a
            JOIN admin_email_access ae ON ae.account_id = a.id
            WHERE ae.profile_id = :pid AND a.account_type != 'rep' AND a.is_active = true
            ORDER BY a.display_name ASC
            """,
            {"pid": profile["id"]},
        )

    return {"accounts": accounts}


@router.get("/email/inbox/{account_id}")
async def get_admin_email_inbox(
    account_id: str,
    archived: bool = Query(False),
    starred_only: bool = Query(False),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """Get threads for an admin email account's inbox."""
    account = _check_admin_email_access(profile, account_id)

    conditions = ["t.account_id = :aid"]
    params: Dict[str, Any] = {"aid": account_id, "lim": limit, "off": offset}

    if archived:
        conditions.append("t.is_archived = true")
    else:
        conditions.append("(t.is_archived = false OR t.is_archived IS NULL)")

    if starred_only:
        conditions.append("t.is_starred = true")

    if search:
        conditions.append("(t.subject ILIKE :search OR t.contact_email ILIKE :search)")
        params["search"] = f"%{search}%"

    where = " AND ".join(conditions)

    threads = execute_query(
        f"""
        SELECT t.*,
               (SELECT COUNT(*) FROM crm_email_messages m WHERE m.thread_id = t.id) as message_count,
               (SELECT COUNT(*) FROM crm_email_messages m WHERE m.thread_id = t.id AND m.is_read = false AND m.direction = 'inbound') as unread_count
        FROM crm_email_threads t
        WHERE {where}
        ORDER BY t.last_message_at DESC NULLS LAST
        LIMIT :lim OFFSET :off
        """,
        params,
    )

    # Get total count
    count_row = execute_single(
        f"SELECT COUNT(*) as total FROM crm_email_threads t WHERE {where}",
        {k: v for k, v in params.items() if k not in ("lim", "off")},
    )
    total = count_row["total"] if count_row else 0

    return {"threads": threads, "total": total}


@router.get("/email/threads/{thread_id}")
async def get_admin_email_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """Get a thread with all messages for an admin email account."""
    thread = execute_single(
        "SELECT * FROM crm_email_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(404, "Thread not found")

    # Verify access
    _check_admin_email_access(profile, thread["account_id"])

    messages = execute_query(
        """
        SELECT m.*,
               COALESCE(
                   (SELECT json_agg(json_build_object('id', a.id, 'filename', a.filename, 'content_type', a.content_type, 'size_bytes', a.size_bytes))
                    FROM crm_email_attachments a WHERE a.message_id = m.id),
                   '[]'::json
               ) as attachments
        FROM crm_email_messages m
        WHERE m.thread_id = :tid
        ORDER BY m.created_at ASC
        """,
        {"tid": thread_id},
    )

    return {"thread": thread, "messages": messages}


class AdminSendEmailRequest(BaseModel):
    account_id: str
    to_emails: List[str]
    subject: str
    body_html: str
    body_text: Optional[str] = None
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    thread_id: Optional[str] = None
    attachment_ids: Optional[List[str]] = None


@router.post("/email/send")
async def send_admin_email(
    data: AdminSendEmailRequest,
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """Send an email from an admin/system email account."""
    import re

    account = _check_admin_email_access(profile, data.account_id)

    if not account.get("is_active"):
        raise HTTPException(400, "This email account is deactivated")

    # Determine or create thread
    thread_id = data.thread_id
    if thread_id:
        thread = execute_single(
            "SELECT id FROM crm_email_threads WHERE id = :tid AND account_id = :aid",
            {"tid": thread_id, "aid": account["id"]},
        )
        if not thread:
            raise HTTPException(404, "Thread not found")
    else:
        thread = execute_single(
            """
            INSERT INTO crm_email_threads (account_id, contact_email, subject)
            VALUES (:aid, :email, :subj) RETURNING *
            """,
            {
                "aid": account["id"],
                "email": data.to_emails[0],
                "subj": data.subject,
            },
        )
        thread_id = thread["id"]

    # Append signature
    body_html = data.body_html
    if account.get("signature_html"):
        body_html += f'<div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd;">{account["signature_html"]}</div>'

    # Plain text fallback
    plain_text = data.body_text
    if not plain_text:
        plain_text = re.sub(r'</p>\s*<p[^>]*>', '\n\n', body_html)
        plain_text = re.sub(r'<br\s*/?>', '\n', plain_text)
        plain_text = re.sub(r'</(div|h[1-6]|li|tr)>', '\n', plain_text)
        plain_text = re.sub(r'<[^>]+>', '', plain_text)
        plain_text = plain_text.strip()

    # Insert message
    message = execute_single(
        """
        INSERT INTO crm_email_messages
            (thread_id, direction, from_address, to_addresses, cc_addresses, bcc_addresses,
             subject, body_html, body_text, status)
        VALUES (:tid, 'outbound', :from_addr, :to_addrs, :cc_addrs, :bcc_addrs,
                :subj, :html, :text, 'sending')
        RETURNING *
        """,
        {
            "tid": thread_id,
            "from_addr": account["email_address"],
            "to_addrs": data.to_emails,
            "cc_addrs": data.cc or [],
            "bcc_addrs": data.bcc or [],
            "subj": data.subject,
            "html": body_html,
            "text": plain_text,
        },
    )

    # Link attachments
    resend_attachments = []
    if data.attachment_ids:
        import boto3
        from app.core.config import settings
        s3 = boto3.client("s3", region_name="us-east-1")
        for att_id in data.attachment_ids:
            try:
                att = execute_insert(
                    "UPDATE crm_email_attachments SET message_id = :mid WHERE id = :aid AND message_id IS NULL RETURNING *",
                    {"mid": message["id"], "aid": att_id},
                )
                if att and att.get("s3_key"):
                    bucket = att.get("s3_bucket", settings.AWS_S3_BACKLOT_FILES_BUCKET)
                    s3_obj = s3.get_object(Bucket=bucket, Key=att["s3_key"])
                    file_bytes = s3_obj["Body"].read()
                    resend_attachments.append({
                        "filename": att["filename"],
                        "content": list(file_bytes),
                    })
            except Exception:
                pass

    # Send via Resend
    try:
        import resend as resend_sdk
        from app.core.config import settings

        resend_sdk.api_key = settings.RESEND_API_KEY

        reply_to_address = f"reply+{thread_id}@theswn.com"
        from_header = f'"{account["display_name"]}" <{account["email_address"]}>'

        send_params = {
            "from": from_header,
            "to": data.to_emails,
            "subject": data.subject,
            "html": body_html,
            "text": plain_text,
            "reply_to": [account["email_address"], reply_to_address],
        }
        if data.cc:
            send_params["cc"] = data.cc
        if data.bcc:
            send_params["bcc"] = data.bcc
        if resend_attachments:
            send_params["attachments"] = resend_attachments

        result = resend_sdk.Emails.send(send_params)
        resend_message_id = result.get("id")

        # Update message status
        execute_single(
            "UPDATE crm_email_messages SET status = 'sent', resend_message_id = :rmid WHERE id = :mid RETURNING id",
            {"rmid": resend_message_id, "mid": message["id"]},
        )

        # Update thread last_message_at
        execute_single(
            "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
            {"tid": thread_id},
        )

    except Exception as e:
        execute_single(
            "UPDATE crm_email_messages SET status = 'failed' WHERE id = :mid RETURNING id",
            {"mid": message["id"]},
        )
        raise HTTPException(500, f"Failed to send email: {str(e)}")

    return {"message": message, "thread_id": thread_id}


@router.post("/email/threads/{thread_id}/mark-read")
async def mark_admin_thread_read(
    thread_id: str,
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """Mark all inbound messages in a thread as read."""
    thread = execute_single(
        "SELECT account_id FROM crm_email_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(404, "Thread not found")

    _check_admin_email_access(profile, thread["account_id"])

    execute_query(
        "UPDATE crm_email_messages SET is_read = true WHERE thread_id = :tid AND direction = 'inbound' AND is_read = false",
        {"tid": thread_id},
    )
    return {"success": True}


@router.post("/email/threads/{thread_id}/archive")
async def archive_admin_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """Toggle archive status on a thread."""
    thread = execute_single(
        "SELECT account_id, is_archived FROM crm_email_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(404, "Thread not found")

    _check_admin_email_access(profile, thread["account_id"])

    new_archived = not thread.get("is_archived", False)
    execute_single(
        "UPDATE crm_email_threads SET is_archived = :val WHERE id = :tid RETURNING id",
        {"val": new_archived, "tid": thread_id},
    )
    return {"success": True, "is_archived": new_archived}


@router.post("/email/threads/{thread_id}/star")
async def star_admin_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """Toggle star status on a thread."""
    thread = execute_single(
        "SELECT account_id, is_starred FROM crm_email_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(404, "Thread not found")

    _check_admin_email_access(profile, thread["account_id"])

    new_starred = not thread.get("is_starred", False)
    execute_single(
        "UPDATE crm_email_threads SET is_starred = :val WHERE id = :tid RETURNING id",
        {"val": new_starred, "tid": thread_id},
    )
    return {"success": True, "is_starred": new_starred}


@router.delete("/email/threads/{thread_id}")
async def delete_admin_thread(
    thread_id: str,
    profile: Dict[str, Any] = Depends(get_user_profile),
):
    """Soft-delete a thread (mark as deleted)."""
    thread = execute_single(
        "SELECT account_id FROM crm_email_threads WHERE id = :tid",
        {"tid": thread_id},
    )
    if not thread:
        raise HTTPException(404, "Thread not found")

    _check_admin_email_access(profile, thread["account_id"])

    execute_single(
        "UPDATE crm_email_threads SET is_deleted = true WHERE id = :tid RETURNING id",
        {"tid": thread_id},
    )
    return {"success": True}
