"""
Expense audit logging service
Tracks all changes to expense items for audit trail
"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.core.database import get_client

logger = logging.getLogger(__name__)


def log_expense_action(
    project_id: str,
    user_id: str,
    action: str,
    target_type: str,
    target_id: str,
    previous_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Log an expense-related action to the audit trail

    Args:
        project_id: Project this expense belongs to
        user_id: User performing the action
        action: Type of action (created, updated, submitted, approved, rejected, reimbursed, notes_added, receipt_added, receipt_removed)
        target_type: Type of expense (mileage, kit_rental, per_diem, receipt, purchase_order, budget_actual)
        target_id: ID of the expense item
        previous_values: Previous field values before change (for updates)
        new_values: New field values after change
        ip_address: Client IP address (optional)
        user_agent: Client user agent (optional)

    Returns:
        The created audit log entry or None on error
    """
    try:
        client = get_client()

        entry = {
            "project_id": project_id,
            "user_id": user_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "previous_values": previous_values or {},
            "new_values": new_values or {},
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.utcnow().isoformat()
        }

        result = client.table("expense_audit_log").insert(entry).execute()

        if result.data:
            logger.info(f"[ExpenseAudit] Logged {action} on {target_type}:{target_id} by user {user_id}")
            return result.data[0]

        return None

    except Exception as e:
        logger.error(f"[ExpenseAudit] Failed to log action: {e}")
        return None


async def get_expense_audit_log(
    project_id: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    action: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    Get audit log entries for expenses

    Args:
        project_id: Project to filter by
        target_type: Optional filter by expense type
        target_id: Optional filter by specific expense ID
        action: Optional filter by action type
        user_id: Optional filter by user who performed action
        limit: Max entries to return (default 50)
        offset: Offset for pagination

    Returns:
        List of audit log entries with user profile data
    """
    try:
        client = get_client()

        query = client.table("expense_audit_log").select(
            "*, user:profiles!user_id(id, username, full_name, avatar_url)"
        ).eq("project_id", project_id).order("created_at", desc=True)

        if target_type:
            query = query.eq("target_type", target_type)
        if target_id:
            query = query.eq("target_id", target_id)
        if action:
            query = query.eq("action", action)
        if user_id:
            query = query.eq("user_id", user_id)

        query = query.range(offset, offset + limit - 1)

        result = query.execute()
        return result.data or []

    except Exception as e:
        logger.error(f"[ExpenseAudit] Failed to get audit log: {e}")
        return []


async def get_audit_log_for_target(
    target_type: str,
    target_id: str,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Get all audit log entries for a specific expense item

    Args:
        target_type: Type of expense
        target_id: ID of the expense
        limit: Max entries to return

    Returns:
        List of audit log entries
    """
    try:
        client = get_client()

        result = client.table("expense_audit_log").select(
            "*, user:profiles!user_id(id, username, full_name, avatar_url)"
        ).eq("target_type", target_type).eq("target_id", target_id).order(
            "created_at", desc=True
        ).limit(limit).execute()

        return result.data or []

    except Exception as e:
        logger.error(f"[ExpenseAudit] Failed to get audit log for {target_type}:{target_id}: {e}")
        return []


def log_expense_created(
    project_id: str,
    user_id: str,
    target_type: str,
    target_id: str,
    initial_values: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Convenience function to log expense creation"""
    return log_expense_action(
        project_id=project_id,
        user_id=user_id,
        action="created",
        target_type=target_type,
        target_id=target_id,
        new_values=initial_values
    )


def log_expense_updated(
    project_id: str,
    user_id: str,
    target_type: str,
    target_id: str,
    previous_values: Dict[str, Any],
    new_values: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Convenience function to log expense update"""
    return log_expense_action(
        project_id=project_id,
        user_id=user_id,
        action="updated",
        target_type=target_type,
        target_id=target_id,
        previous_values=previous_values,
        new_values=new_values
    )


def log_expense_status_change(
    project_id: str,
    user_id: str,
    target_type: str,
    target_id: str,
    old_status: str,
    new_status: str,
    reason: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Log status change (submitted, approved, rejected, reimbursed)"""
    new_values = {"status": new_status}
    if reason:
        new_values["reason"] = reason

    return log_expense_action(
        project_id=project_id,
        user_id=user_id,
        action=new_status,  # Use the new status as the action
        target_type=target_type,
        target_id=target_id,
        previous_values={"status": old_status},
        new_values=new_values
    )


def log_notes_added(
    project_id: str,
    user_id: str,
    target_type: str,
    target_id: str,
    notes: str,
    synced_to_source: bool = False
) -> Optional[Dict[str, Any]]:
    """Log when notes are added to an expense"""
    return log_expense_action(
        project_id=project_id,
        user_id=user_id,
        action="notes_added",
        target_type=target_type,
        target_id=target_id,
        new_values={
            "notes": notes,
            "synced_to_source": synced_to_source
        }
    )


def log_receipt_attached(
    project_id: str,
    user_id: str,
    target_id: str,
    receipt_id: str,
    receipt_info: Optional[Dict[str, Any]] = None
) -> Optional[Dict[str, Any]]:
    """Log when a receipt is attached to a budget actual"""
    return log_expense_action(
        project_id=project_id,
        user_id=user_id,
        action="receipt_added",
        target_type="budget_actual",
        target_id=target_id,
        new_values={
            "receipt_id": receipt_id,
            **(receipt_info or {})
        }
    )


def log_receipt_removed(
    project_id: str,
    user_id: str,
    target_id: str,
    receipt_id: str
) -> Optional[Dict[str, Any]]:
    """Log when a receipt is removed from a budget actual"""
    return log_expense_action(
        project_id=project_id,
        user_id=user_id,
        action="receipt_removed",
        target_type="budget_actual",
        target_id=target_id,
        previous_values={"receipt_id": receipt_id}
    )
