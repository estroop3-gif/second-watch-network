"""
Quota Enforcement Utilities

Functions for checking and enforcing organization quotas.
Used by various API endpoints to implement hard blocks when limits are exceeded.
"""
from typing import Dict, Any, Optional
from fastapi import HTTPException

from app.core.database import execute_single
from app.core.logging import get_logger

logger = get_logger(__name__)


class QuotaExceededError(HTTPException):
    """Exception raised when a quota limit is exceeded."""

    def __init__(
        self,
        limit_type: str,
        current: int,
        limit: int,
        message: Optional[str] = None
    ):
        detail = message or f"{limit_type} quota exceeded: {current}/{limit}"
        super().__init__(status_code=403, detail=detail)
        self.limit_type = limit_type
        self.current = current
        self.limit = limit


# =============================================================================
# Limit Checking Functions
# =============================================================================

def get_effective_limits(org_id: str) -> Dict[str, Any]:
    """
    Get effective limits for an organization (tier defaults + admin overrides).

    Returns dict with all limit fields, or None if org not found.
    """
    row = execute_single(
        "SELECT * FROM get_organization_limits(:org_id)",
        {"org_id": org_id}
    )
    return dict(row) if row else None


def check_can_add_org_seat(
    org_id: str,
    seat_type: str,
    count: int = 1
) -> Dict[str, Any]:
    """
    Check if organization can add more seats of the specified type.

    Args:
        org_id: Organization ID
        seat_type: Either 'owner' or 'collaborative'
        count: Number of seats to add (default 1)

    Returns:
        Dict with 'allowed', 'current', 'limit', 'remaining' keys
    """
    quota_type = f"{seat_type}_seats"
    result = execute_single(
        "SELECT * FROM check_organization_quota(:org_id, :quota_type, :count)",
        {"org_id": org_id, "quota_type": quota_type, "count": count}
    )
    return dict(result) if result else {"allowed": False, "error": "Organization not found"}


def check_can_create_project(org_id: str) -> Dict[str, Any]:
    """
    Check if organization can create a new project.

    Returns:
        Dict with 'allowed', 'current', 'limit', 'remaining' keys
    """
    result = execute_single(
        "SELECT * FROM check_organization_quota(:org_id, 'active_projects', 1)",
        {"org_id": org_id}
    )
    return dict(result) if result else {"allowed": False, "error": "Organization not found"}


def check_can_upload_file(
    org_id: str,
    file_size_bytes: int,
    storage_type: str = "active"
) -> Dict[str, Any]:
    """
    Check if organization has storage quota available for a file upload.

    Args:
        org_id: Organization ID
        file_size_bytes: Size of file to upload
        storage_type: Either 'active' or 'archive'

    Returns:
        Dict with 'allowed', 'current_bytes', 'limit_bytes', 'remaining_bytes' keys
    """
    result = execute_single(
        "SELECT * FROM check_storage_quota(:org_id, :storage_type, :bytes)",
        {"org_id": org_id, "storage_type": storage_type, "bytes": file_size_bytes}
    )
    return dict(result) if result else {"allowed": False, "error": "Organization not found"}


def check_bandwidth_available(
    org_id: str,
    bytes_needed: int
) -> Dict[str, Any]:
    """
    Check if organization has bandwidth quota available.

    Args:
        org_id: Organization ID
        bytes_needed: Bandwidth required for the operation

    Returns:
        Dict with 'allowed', 'current_bytes', 'limit_bytes', 'remaining_bytes', 'reset_date' keys
    """
    result = execute_single(
        "SELECT * FROM check_bandwidth_quota(:org_id, :bytes)",
        {"org_id": org_id, "bytes": bytes_needed}
    )
    return dict(result) if result else {"allowed": False, "error": "Organization not found"}


def check_user_can_create_org(user_id: str) -> Dict[str, Any]:
    """
    Check if user can create a new organization.

    Args:
        user_id: User's profile ID

    Returns:
        Dict with 'allowed', 'current', 'limit', 'remaining' keys
    """
    result = execute_single(
        "SELECT * FROM check_user_can_create_organization(:user_id)",
        {"user_id": user_id}
    )
    return dict(result) if result else {"allowed": False, "error": "User not found"}


# =============================================================================
# Enforcement Functions (raise HTTPException on failure)
# =============================================================================

def enforce_seat_limit(
    org_id: str,
    seat_type: str,
    count: int = 1
) -> None:
    """
    Enforce seat limit - raises QuotaExceededError if limit would be exceeded.

    Args:
        org_id: Organization ID
        seat_type: Either 'owner' or 'collaborative'
        count: Number of seats being added
    """
    check = check_can_add_org_seat(org_id, seat_type, count)

    if check.get("error"):
        raise HTTPException(status_code=404, detail=check["error"])

    if not check.get("allowed"):
        limit_name = f"{seat_type.title()} seats"
        raise QuotaExceededError(
            limit_type=limit_name,
            current=check.get("current", 0),
            limit=check.get("limit", 0),
            message=f"Cannot add {count} {seat_type} seat(s). Organization has reached its {limit_name.lower()} limit ({check.get('current', 0)}/{check.get('limit', 0)})."
        )


def enforce_project_limit(org_id: str) -> None:
    """
    Enforce project limit - raises QuotaExceededError if limit would be exceeded.

    Args:
        org_id: Organization ID
    """
    check = check_can_create_project(org_id)

    if check.get("error"):
        raise HTTPException(status_code=404, detail=check["error"])

    if not check.get("allowed"):
        raise QuotaExceededError(
            limit_type="Active projects",
            current=check.get("current", 0),
            limit=check.get("limit", 0),
            message=f"Cannot create project. Organization has reached its active projects limit ({check.get('current', 0)}/{check.get('limit', 0)}). Archive or delete a project to continue."
        )


def enforce_storage_limit(
    org_id: str,
    file_size_bytes: int,
    storage_type: str = "active"
) -> None:
    """
    Enforce storage limit - raises QuotaExceededError if limit would be exceeded.

    Args:
        org_id: Organization ID
        file_size_bytes: Size of file being uploaded
        storage_type: Either 'active' or 'archive'
    """
    check = check_can_upload_file(org_id, file_size_bytes, storage_type)

    if check.get("error"):
        raise HTTPException(status_code=404, detail=check["error"])

    if not check.get("allowed"):
        storage_label = f"{storage_type.title()} storage"
        # Format bytes for display
        remaining = check.get("remaining_bytes", 0)
        limit = check.get("limit_bytes", 0)
        file_gb = file_size_bytes / (1024**3)
        remaining_gb = remaining / (1024**3)
        limit_gb = limit / (1024**3)

        raise QuotaExceededError(
            limit_type=storage_label,
            current=check.get("current_bytes", 0),
            limit=limit,
            message=f"Cannot upload file ({file_gb:.2f} GB). {storage_label} quota exceeded. Only {remaining_gb:.2f} GB remaining of {limit_gb:.1f} GB limit."
        )


def enforce_bandwidth_limit(
    org_id: str,
    bytes_needed: int
) -> None:
    """
    Enforce bandwidth limit - raises QuotaExceededError if limit would be exceeded.

    Args:
        org_id: Organization ID
        bytes_needed: Bandwidth required for the operation
    """
    check = check_bandwidth_available(org_id, bytes_needed)

    if check.get("error"):
        raise HTTPException(status_code=404, detail=check["error"])

    if not check.get("allowed"):
        remaining = check.get("remaining_bytes", 0)
        limit = check.get("limit_bytes", 0)
        remaining_gb = remaining / (1024**3)
        limit_gb = limit / (1024**3)
        reset_date = check.get("reset_date", "unknown")

        raise QuotaExceededError(
            limit_type="Monthly bandwidth",
            current=check.get("current_bytes", 0),
            limit=limit,
            message=f"Bandwidth quota exceeded. Only {remaining_gb:.2f} GB remaining of {limit_gb:.1f} GB monthly limit. Resets on {reset_date}."
        )


def enforce_user_org_limit(user_id: str) -> None:
    """
    Enforce user organization creation limit - raises QuotaExceededError if limit would be exceeded.

    Args:
        user_id: User's profile ID
    """
    check = check_user_can_create_org(user_id)

    if check.get("error"):
        raise HTTPException(status_code=404, detail=check["error"])

    if not check.get("allowed"):
        raise QuotaExceededError(
            limit_type="Organizations",
            current=check.get("current", 0),
            limit=check.get("limit", 0),
            message=f"Cannot create organization. You have reached your organization limit ({check.get('current', 0)}/{check.get('limit', 0)}). Contact support to increase your limit."
        )


# =============================================================================
# Trial Expiry Enforcement
# =============================================================================

def enforce_trial_not_expired(org_id: str) -> None:
    """
    Check if the organization's trial has expired.
    Raises 403 if backlot_billing_status is 'expired'.
    Read-only access should still be allowed — only call this on write endpoints.
    """
    row = execute_single(
        "SELECT backlot_billing_status FROM organizations WHERE id = :oid",
        {"oid": org_id},
    )
    if row and row.get("backlot_billing_status") == "expired":
        raise HTTPException(
            status_code=403,
            detail="Your Backlot trial has expired. Subscribe to continue creating and editing. Your data is preserved and accessible in read-only mode.",
        )


def enforce_billing_active(org_id: str) -> None:
    """
    Check if the organization has an active billing status.
    Raises 403 on write operations if:
    - expired (trial)
    - canceled (subscription)
    - past_due AND past_due_since > 7 days (grace period exceeded)

    Read-only access should still be allowed — only call this on write endpoints.
    This replaces enforce_trial_not_expired() for endpoints that should check
    both trial expiry and subscription billing status.
    """
    from datetime import datetime, timedelta

    row = execute_single(
        "SELECT backlot_billing_status, past_due_since FROM organizations WHERE id = :oid",
        {"oid": org_id},
    )
    if not row:
        return

    status = row.get("backlot_billing_status")

    if status == "expired":
        raise HTTPException(
            status_code=403,
            detail="Your Backlot trial has expired. Subscribe to continue creating and editing. Your data is preserved and accessible in read-only mode.",
        )

    if status == "canceled":
        raise HTTPException(
            status_code=403,
            detail="Your Backlot subscription has been canceled. Resubscribe to continue creating and editing. Your data is preserved and accessible in read-only mode.",
        )

    if status == "past_due":
        past_due_since = row.get("past_due_since")
        if past_due_since and hasattr(past_due_since, "timestamp"):
            grace_end = past_due_since + timedelta(days=7)
            if datetime.utcnow() > grace_end:
                raise HTTPException(
                    status_code=403,
                    detail="Your payment is past due and the grace period has ended. Update your payment method to restore access. Your data is preserved and accessible in read-only mode.",
                )


# =============================================================================
# Bandwidth Recording
# =============================================================================

def record_bandwidth_usage(
    org_id: str,
    bytes_transferred: int,
    event_type: str,
    project_id: Optional[str] = None,
    user_id: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> None:
    """
    Record bandwidth usage for an organization.

    This updates the usage counter and logs the event for auditing.

    Args:
        org_id: Organization ID
        bytes_transferred: Number of bytes transferred
        event_type: Type of event ('file_download', 'stream_view', 'api_call')
        project_id: Optional project ID
        user_id: Optional user ID who triggered the usage
        resource_type: Optional resource type ('dailies', 'asset', 'export', etc.)
        resource_id: Optional resource ID
        metadata: Optional additional metadata
    """
    import json

    execute_single("""
        SELECT record_bandwidth_usage(
            :org_id,
            :project_id,
            :user_id,
            :event_type,
            :bytes,
            :resource_type,
            :resource_id,
            :metadata::jsonb
        )
    """, {
        "org_id": org_id,
        "project_id": project_id,
        "user_id": user_id,
        "event_type": event_type,
        "bytes": bytes_transferred,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata": json.dumps(metadata or {})
    })

    logger.debug(
        "bandwidth_recorded",
        org_id=org_id,
        event_type=event_type,
        bytes=bytes_transferred,
        project_id=project_id
    )


# =============================================================================
# Per-Project External Seat Limits
# =============================================================================

def check_can_add_external_seat(
    org_id: str,
    project_id: str,
    seat_type: str
) -> Dict[str, Any]:
    """
    Check if a project can add more external seats of the specified type.

    Args:
        org_id: Organization ID
        project_id: Project ID
        seat_type: Either 'freelancer' or 'view_only'

    Returns:
        Dict with 'allowed', 'current', 'limit' keys
    """
    # Get limits
    limits = get_effective_limits(org_id)
    if not limits:
        return {"allowed": False, "error": "Organization not found"}

    if seat_type == "freelancer":
        limit = limits.get("freelancer_seats_per_project", 2)
    else:
        limit = limits.get("view_only_seats_per_project", 1)

    # Count current external seats of this type for the project
    count_result = execute_single("""
        SELECT COUNT(*) as count
        FROM project_external_seats
        WHERE project_id = :project_id
          AND seat_type = :seat_type
          AND status = 'active'
    """, {"project_id": project_id, "seat_type": seat_type})

    current = count_result["count"] if count_result else 0

    return {
        "allowed": current < limit,
        "current": current,
        "limit": limit
    }


def enforce_external_seat_limit(
    org_id: str,
    project_id: str,
    seat_type: str
) -> None:
    """
    Enforce per-project external seat limit.

    Args:
        org_id: Organization ID
        project_id: Project ID
        seat_type: Either 'freelancer' or 'view_only'
    """
    check = check_can_add_external_seat(org_id, project_id, seat_type)

    if check.get("error"):
        raise HTTPException(status_code=404, detail=check["error"])

    if not check.get("allowed"):
        seat_label = "Freelancer seats" if seat_type == "freelancer" else "View-only seats"
        raise QuotaExceededError(
            limit_type=seat_label,
            current=check.get("current", 0),
            limit=check.get("limit", 0),
            message=f"Cannot add {seat_type.replace('_', ' ')} seat. Project has reached its {seat_label.lower()} limit ({check.get('current', 0)}/{check.get('limit', 0)})."
        )


# =============================================================================
# Utility Functions
# =============================================================================

def get_quota_status(org_id: str) -> Dict[str, Dict[str, Any]]:
    """
    Get complete quota status for an organization.

    Returns a dict with status for each quota type.
    """
    limits = get_effective_limits(org_id)
    if not limits:
        return {"error": "Organization not found"}

    usage = execute_single(
        "SELECT * FROM organization_usage WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    if not usage:
        usage = {
            "current_owner_seats": 0,
            "current_collaborative_seats": 0,
            "current_active_projects": 0,
            "current_active_storage_bytes": 0,
            "current_archive_storage_bytes": 0,
            "current_month_bandwidth_bytes": 0
        }

    def calc_status(current: int, limit: int) -> Dict:
        if limit == -1:
            return {"current": current, "limit": "unlimited", "percent": 0, "at_limit": False}
        percent = (current / limit * 100) if limit > 0 else 100
        return {
            "current": current,
            "limit": limit,
            "percent": round(percent, 1),
            "at_limit": current >= limit
        }

    return {
        "owner_seats": calc_status(usage["current_owner_seats"], limits["owner_seats"]),
        "collaborative_seats": calc_status(usage["current_collaborative_seats"], limits["collaborative_seats"]),
        "active_projects": calc_status(usage["current_active_projects"], limits["active_projects_limit"]),
        "active_storage": calc_status(usage["current_active_storage_bytes"], limits["active_storage_bytes"]),
        "archive_storage": calc_status(usage["current_archive_storage_bytes"], limits["archive_storage_bytes"]),
        "bandwidth": calc_status(usage["current_month_bandwidth_bytes"], limits["monthly_bandwidth_bytes"])
    }


def format_bytes(bytes_val: int) -> str:
    """Format bytes to human-readable string."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024
    return f"{bytes_val:.1f} PB"
