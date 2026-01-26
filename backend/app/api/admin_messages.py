"""
Admin Messages API Routes
Admin moderation for message reports and user blocks
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging
from app.core.database import get_client
from app.core.deps import require_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class MessageReportDetail(BaseModel):
    id: str
    reporter_id: str
    reporter_name: Optional[str] = None
    reporter_avatar: Optional[str] = None
    message_id: str
    message_content: Optional[str] = None
    message_sender_id: str
    message_sender_name: Optional[str] = None
    message_sender_avatar: Optional[str] = None
    conversation_id: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: str
    reviewed_by: Optional[str] = None
    reviewer_name: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolution_action: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MessageReportUpdate(BaseModel):
    status: Optional[str] = None  # pending, reviewing, resolved, dismissed
    reviewed_by: Optional[str] = None
    resolution_notes: Optional[str] = None


class MessageReportResolve(BaseModel):
    resolution_action: str  # warning_issued, user_blocked, no_action, content_removed
    resolution_notes: Optional[str] = None


class BlockRecord(BaseModel):
    id: str
    blocker_id: str
    blocker_name: Optional[str] = None
    blocker_avatar: Optional[str] = None
    blocked_user_id: str
    blocked_user_name: Optional[str] = None
    blocked_user_avatar: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime


class AdminBlockStats(BaseModel):
    total_blocks: int
    blocks_today: int
    blocks_this_week: int
    most_blocked_users: List[dict]


class AdminReportStats(BaseModel):
    total_reports: int
    pending_reports: int
    resolved_reports: int
    dismissed_reports: int
    reports_by_reason: dict


# ============================================================================
# Report Management Endpoints
# ============================================================================

@router.get("/reports", response_model=List[MessageReportDetail])
async def list_all_reports(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    reason: Optional[str] = None,
    profile = Depends(require_admin)
):
    """List all message reports (paginated, filterable)"""
    try:
        client = get_client()

        query = client.table("message_reports").select("*")

        if status:
            query = query.eq("status", status)
        if reason:
            query = query.eq("reason", reason)

        response = query.order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        reports = []
        for report in response.data or []:
            # Get reporter info
            reporter_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", report["reporter_id"]).single().execute()
            reporter = reporter_resp.data if reporter_resp.data else {}

            # Get sender info
            sender_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", report["message_sender_id"]).single().execute()
            sender = sender_resp.data if sender_resp.data else {}

            # Get reviewer info if available
            reviewer_name = None
            if report.get("reviewed_by"):
                reviewer_resp = client.table("profiles").select(
                    "full_name, display_name"
                ).eq("id", report["reviewed_by"]).single().execute()
                if reviewer_resp.data:
                    reviewer_name = reviewer_resp.data.get("display_name") or reviewer_resp.data.get("full_name")

            reports.append(MessageReportDetail(
                id=report["id"],
                reporter_id=report["reporter_id"],
                reporter_name=reporter.get("display_name") or reporter.get("full_name"),
                reporter_avatar=reporter.get("avatar_url"),
                message_id=report["message_id"],
                message_content=report.get("message_content"),
                message_sender_id=report["message_sender_id"],
                message_sender_name=sender.get("display_name") or sender.get("full_name"),
                message_sender_avatar=sender.get("avatar_url"),
                conversation_id=report.get("conversation_id"),
                reason=report["reason"],
                description=report.get("description"),
                status=report["status"],
                reviewed_by=report.get("reviewed_by"),
                reviewer_name=reviewer_name,
                resolution_notes=report.get("resolution_notes"),
                resolution_action=report.get("resolution_action"),
                created_at=report["created_at"],
                updated_at=report["updated_at"],
            ))

        return reports
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reports/stats", response_model=AdminReportStats)
async def get_report_stats(profile = Depends(require_admin)):
    """Get report statistics"""
    try:
        client = get_client()

        # Get total count
        total = client.table("message_reports").select("id", count="exact").execute()

        # Get pending count
        pending = client.table("message_reports").select("id", count="exact").eq("status", "pending").execute()

        # Get resolved count
        resolved = client.table("message_reports").select("id", count="exact").eq("status", "resolved").execute()

        # Get dismissed count
        dismissed = client.table("message_reports").select("id", count="exact").eq("status", "dismissed").execute()

        # Get counts by reason
        all_reports = client.table("message_reports").select("reason").execute()
        reason_counts = {}
        for report in all_reports.data or []:
            reason = report.get("reason", "unknown")
            reason_counts[reason] = reason_counts.get(reason, 0) + 1

        return AdminReportStats(
            total_reports=total.count or 0,
            pending_reports=pending.count or 0,
            resolved_reports=resolved.count or 0,
            dismissed_reports=dismissed.count or 0,
            reports_by_reason=reason_counts,
        )
    except Exception as e:
        logger.error(f"Error getting report stats: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reports/{report_id}", response_model=MessageReportDetail)
async def get_report_detail(report_id: str, profile = Depends(require_admin)):
    """Get detailed information about a specific report"""
    try:
        client = get_client()

        response = client.table("message_reports").select("*").eq("id", report_id).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="Report not found")

        report = response.data[0]

        # Get reporter info
        reporter_resp = client.table("profiles").select(
            "full_name, display_name, avatar_url"
        ).eq("id", report["reporter_id"]).single().execute()
        reporter = reporter_resp.data if reporter_resp.data else {}

        # Get sender info
        sender_resp = client.table("profiles").select(
            "full_name, display_name, avatar_url"
        ).eq("id", report["message_sender_id"]).single().execute()
        sender = sender_resp.data if sender_resp.data else {}

        # Get reviewer info
        reviewer_name = None
        if report.get("reviewed_by"):
            reviewer_resp = client.table("profiles").select(
                "full_name, display_name"
            ).eq("id", report["reviewed_by"]).single().execute()
            if reviewer_resp.data:
                reviewer_name = reviewer_resp.data.get("display_name") or reviewer_resp.data.get("full_name")

        return MessageReportDetail(
            id=report["id"],
            reporter_id=report["reporter_id"],
            reporter_name=reporter.get("display_name") or reporter.get("full_name"),
            reporter_avatar=reporter.get("avatar_url"),
            message_id=report["message_id"],
            message_content=report.get("message_content"),
            message_sender_id=report["message_sender_id"],
            message_sender_name=sender.get("display_name") or sender.get("full_name"),
            message_sender_avatar=sender.get("avatar_url"),
            conversation_id=report.get("conversation_id"),
            reason=report["reason"],
            description=report.get("description"),
            status=report["status"],
            reviewed_by=report.get("reviewed_by"),
            reviewer_name=reviewer_name,
            resolution_notes=report.get("resolution_notes"),
            resolution_action=report.get("resolution_action"),
            created_at=report["created_at"],
            updated_at=report["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting report detail: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/reports/{report_id}", response_model=MessageReportDetail)
async def update_report(
    report_id: str,
    update: MessageReportUpdate,
    profile = Depends(require_admin)
):
    """Update report status or assign reviewer"""
    try:
        client = get_client()

        update_data = {}
        if update.status:
            if update.status not in ["pending", "reviewing", "resolved", "dismissed"]:
                raise HTTPException(status_code=400, detail="Invalid status")
            update_data["status"] = update.status
        if update.reviewed_by:
            update_data["reviewed_by"] = update.reviewed_by
        if update.resolution_notes is not None:
            update_data["resolution_notes"] = update.resolution_notes

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        response = client.table("message_reports").update(update_data).eq("id", report_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Report not found")

        return await get_report_detail(report_id, profile)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating report: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reports/{report_id}/resolve", response_model=MessageReportDetail)
async def resolve_report(
    report_id: str,
    resolve: MessageReportResolve,
    profile = Depends(require_admin)
):
    """Resolve a report with an action"""
    try:
        valid_actions = ["warning_issued", "user_blocked", "no_action", "content_removed"]
        if resolve.resolution_action not in valid_actions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid resolution_action. Must be one of: {', '.join(valid_actions)}"
            )

        client = get_client()

        # Update report status and resolution
        update_data = {
            "status": "resolved",
            "resolution_action": resolve.resolution_action,
            "resolution_notes": resolve.resolution_notes,
            "reviewed_by": profile["id"],
        }

        response = client.table("message_reports").update(update_data).eq("id", report_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Report not found")

        # If action is user_blocked, create a block record
        if resolve.resolution_action == "user_blocked":
            report = response.data[0]
            # Block the message sender for the reporter
            try:
                client.table("user_blocked_users").insert({
                    "user_id": report["reporter_id"],
                    "blocked_user_id": report["message_sender_id"],
                    "reason": f"Admin action: {resolve.resolution_notes or 'Blocked due to reported message'}",
                }).execute()
            except Exception as block_err:
                logger.warning(f"Could not auto-block user: {block_err}")

        return await get_report_detail(report_id, profile)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving report: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reports/{report_id}/dismiss", response_model=MessageReportDetail)
async def dismiss_report(
    report_id: str,
    notes: Optional[str] = None,
    profile = Depends(require_admin)
):
    """Dismiss a report"""
    try:
        client = get_client()

        update_data = {
            "status": "dismissed",
            "resolution_action": "no_action",
            "resolution_notes": notes or "Report dismissed by admin",
            "reviewed_by": profile["id"],
        }

        response = client.table("message_reports").update(update_data).eq("id", report_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Report not found")

        return await get_report_detail(report_id, profile)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dismissing report: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Block Management Endpoints
# ============================================================================

@router.get("/blocks", response_model=List[BlockRecord])
async def list_all_blocks(
    skip: int = 0,
    limit: int = 50,
    profile = Depends(require_admin)
):
    """List all user blocks platform-wide"""
    try:
        client = get_client()

        response = client.table("user_blocked_users").select("*").order(
            "created_at", desc=True
        ).range(skip, skip + limit - 1).execute()

        blocks = []
        for block in response.data or []:
            # Get blocker info
            blocker_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", block["user_id"]).single().execute()
            blocker = blocker_resp.data if blocker_resp.data else {}

            # Get blocked user info
            blocked_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", block["blocked_user_id"]).single().execute()
            blocked = blocked_resp.data if blocked_resp.data else {}

            blocks.append(BlockRecord(
                id=block["id"],
                blocker_id=block["user_id"],
                blocker_name=blocker.get("display_name") or blocker.get("full_name"),
                blocker_avatar=blocker.get("avatar_url"),
                blocked_user_id=block["blocked_user_id"],
                blocked_user_name=blocked.get("display_name") or blocked.get("full_name"),
                blocked_user_avatar=blocked.get("avatar_url"),
                reason=block.get("reason"),
                created_at=block["created_at"],
            ))

        return blocks
    except Exception as e:
        logger.error(f"Error listing blocks: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/blocks/stats", response_model=AdminBlockStats)
async def get_block_stats(profile = Depends(require_admin)):
    """Get blocking statistics"""
    try:
        client = get_client()
        from app.core.database import execute_query

        # Get total count
        total = client.table("user_blocked_users").select("id", count="exact").execute()

        # Get counts by time period using raw SQL
        today_count = execute_query("""
            SELECT COUNT(*) as count FROM user_blocked_users
            WHERE created_at >= CURRENT_DATE
        """, {})

        week_count = execute_query("""
            SELECT COUNT(*) as count FROM user_blocked_users
            WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        """, {})

        # Get most blocked users
        most_blocked = execute_query("""
            SELECT blocked_user_id, COUNT(*) as block_count
            FROM user_blocked_users
            GROUP BY blocked_user_id
            ORDER BY block_count DESC
            LIMIT 10
        """, {})

        # Enrich with user info
        most_blocked_with_info = []
        for item in most_blocked:
            profile_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", item["blocked_user_id"]).single().execute()
            profile_data = profile_resp.data if profile_resp.data else {}

            most_blocked_with_info.append({
                "user_id": item["blocked_user_id"],
                "name": profile_data.get("display_name") or profile_data.get("full_name"),
                "avatar_url": profile_data.get("avatar_url"),
                "block_count": item["block_count"],
            })

        return AdminBlockStats(
            total_blocks=total.count or 0,
            blocks_today=today_count[0]["count"] if today_count else 0,
            blocks_this_week=week_count[0]["count"] if week_count else 0,
            most_blocked_users=most_blocked_with_info,
        )
    except Exception as e:
        logger.error(f"Error getting block stats: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/blocks/{block_id}")
async def admin_force_unblock(block_id: str, profile = Depends(require_admin)):
    """Admin force-unblock a user"""
    try:
        client = get_client()

        # Get block info for audit
        block_resp = client.table("user_blocked_users").select("*").eq("id", block_id).execute()

        if not block_resp.data:
            raise HTTPException(status_code=404, detail="Block record not found")

        # Delete the block
        client.table("user_blocked_users").delete().eq("id", block_id).execute()

        return {
            "message": "Block removed successfully",
            "block_info": block_resp.data[0],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error force-unblocking: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/blocks/user/{user_id}")
async def get_user_blocks(user_id: str, profile = Depends(require_admin)):
    """Get all blocks involving a specific user (both as blocker and blocked)"""
    try:
        client = get_client()

        # Get blocks where user is the blocker
        as_blocker = client.table("user_blocked_users").select("*").eq("user_id", user_id).execute()

        # Get blocks where user is blocked
        as_blocked = client.table("user_blocked_users").select("*").eq("blocked_user_id", user_id).execute()

        blocks_as_blocker = []
        for block in as_blocker.data or []:
            blocked_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", block["blocked_user_id"]).single().execute()
            blocked = blocked_resp.data if blocked_resp.data else {}

            blocks_as_blocker.append({
                "id": block["id"],
                "blocked_user_id": block["blocked_user_id"],
                "blocked_user_name": blocked.get("display_name") or blocked.get("full_name"),
                "reason": block.get("reason"),
                "created_at": block["created_at"],
            })

        blocks_as_blocked = []
        for block in as_blocked.data or []:
            blocker_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", block["user_id"]).single().execute()
            blocker = blocker_resp.data if blocker_resp.data else {}

            blocks_as_blocked.append({
                "id": block["id"],
                "blocker_id": block["user_id"],
                "blocker_name": blocker.get("display_name") or blocker.get("full_name"),
                "reason": block.get("reason"),
                "created_at": block["created_at"],
            })

        return {
            "as_blocker": blocks_as_blocker,
            "as_blocked": blocks_as_blocked,
            "total_blocks_made": len(blocks_as_blocker),
            "total_times_blocked": len(blocks_as_blocked),
        }
    except Exception as e:
        logger.error(f"Error getting user blocks: {e}")
        raise HTTPException(status_code=400, detail=str(e))
