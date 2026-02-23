"""
Organization Usage API

Owner-facing endpoints for viewing organization usage and limits.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class TierInfoResponse(BaseModel):
    """Tier information for display."""
    name: Optional[str]
    display_name: Optional[str]
    price_cents: int
    enterprise_support: bool
    public_call_sheet_links: bool


class UsageSummaryResponse(BaseModel):
    """Usage summary for organization owner dashboard."""
    organization_id: str
    organization_name: str
    tier: Optional[TierInfoResponse]
    subscription_status: Optional[str]

    # Owner seats
    owner_seats_used: int
    owner_seats_limit: int
    owner_seats_percent: float

    # Collaborative seats
    collaborative_seats_used: int
    collaborative_seats_limit: int
    collaborative_seats_percent: float

    # Projects
    active_projects_used: int
    active_projects_limit: int
    active_projects_percent: float

    # Storage (bytes)
    active_storage_used: int
    active_storage_limit: int
    active_storage_percent: float

    archive_storage_used: int
    archive_storage_limit: int
    archive_storage_percent: float

    # Bandwidth (bytes)
    bandwidth_used: int
    bandwidth_limit: int
    bandwidth_percent: float
    bandwidth_reset_date: str

    # Warnings
    near_limit_warnings: List[str]


class BandwidthBreakdownResponse(BaseModel):
    """Bandwidth usage breakdown by type."""
    total_bytes: int
    by_event_type: Dict[str, int]
    by_project: List[Dict[str, Any]]
    reset_date: str


class StorageBreakdownResponse(BaseModel):
    """Storage usage breakdown by project."""
    active_total_bytes: int
    archive_total_bytes: int
    by_project: List[Dict[str, Any]]


class SeatAllocationResponse(BaseModel):
    """Seat allocation details."""
    owner_seats: List[Dict[str, Any]]
    collaborative_seats: List[Dict[str, Any]]
    per_project_external_seats: List[Dict[str, Any]]


# =============================================================================
# Helper Functions
# =============================================================================

async def check_org_access(org_id: str, user_id: str) -> Dict[str, Any]:
    """
    Check if user has access to view organization usage.
    Returns org data if accessible, raises HTTPException otherwise.
    """
    # Check if user is owner or admin of the org
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id
          AND user_id = :user_id
          AND status = 'active'
          AND role IN ('owner', 'admin')
    """, {"org_id": org_id, "user_id": user_id})

    if not member:
        # Check if user is platform admin
        profile = execute_single(
            "SELECT is_admin, is_superadmin FROM profiles WHERE id = :user_id",
            {"user_id": user_id}
        )
        if not profile or not (profile.get("is_admin") or profile.get("is_superadmin")):
            raise HTTPException(
                status_code=403,
                detail="You must be an organization owner or admin to view usage"
            )

    org = execute_single(
        "SELECT * FROM organizations WHERE id = :org_id",
        {"org_id": org_id}
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return org


def calculate_percent(used: int, limit: int) -> float:
    """Calculate percentage used, handling unlimited (-1) and zero cases."""
    if limit == -1:
        return 0.0  # Unlimited
    if limit == 0:
        return 100.0 if used > 0 else 0.0
    return min(round((used / limit) * 100, 1), 100.0)


def get_near_limit_warnings(usage: Dict, limits: Dict) -> List[str]:
    """Get list of warnings for resources approaching limits."""
    warnings = []
    threshold = 80  # Warn at 80%

    checks = [
        ("owner_seats", "Owner seats"),
        ("collaborative_seats", "Collaborative seats"),
        ("active_projects", "Active projects"),
        ("active_storage", "Active storage"),
        ("archive_storage", "Archive storage"),
        ("bandwidth", "Monthly bandwidth"),
    ]

    for key, label in checks:
        used_key = f"current_{key}" if "storage" in key or "bandwidth" in key else f"current_{key}"
        if "storage" in key:
            used_key = f"current_{key}_bytes"
        elif key == "bandwidth":
            used_key = "current_month_bandwidth_bytes"
        elif key == "owner_seats":
            used_key = "current_owner_seats"
        elif key == "collaborative_seats":
            used_key = "current_collaborative_seats"
        elif key == "active_projects":
            used_key = "current_active_projects"

        limit_key = key
        if "storage" in key or key == "bandwidth":
            limit_key = f"{key}_bytes" if key != "bandwidth" else "monthly_bandwidth_bytes"
        elif key == "active_projects":
            limit_key = "active_projects_limit"

        used = usage.get(used_key, 0) or 0
        limit = limits.get(limit_key, 0) or 0

        if limit > 0 and limit != -1:
            pct = (used / limit) * 100
            if pct >= threshold:
                warnings.append(f"{label} at {int(pct)}% ({used:,}/{limit:,})")

    return warnings


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/{org_id}/usage", response_model=UsageSummaryResponse)
async def get_usage_summary(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    Get usage summary for an organization.

    Shows current usage vs limits for all quota types.
    Includes warnings for resources approaching limits.
    """
    user_id = user.get("profile_id") or user.get("id")
    org = await check_org_access(org_id, user_id)

    # Get effective limits
    limits = execute_single(
        "SELECT * FROM get_organization_limits(:org_id)",
        {"org_id": org_id}
    )

    # Get current usage
    usage = execute_single(
        "SELECT * FROM organization_usage WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    if not usage:
        # Create usage record
        usage = execute_single("""
            INSERT INTO organization_usage (organization_id)
            VALUES (:org_id)
            ON CONFLICT (organization_id) DO UPDATE SET organization_id = :org_id
            RETURNING *
        """, {"org_id": org_id})

    # Get tier info
    tier_info = None
    if org.get("tier_id"):
        tier = execute_single(
            "SELECT name, display_name, price_cents, enterprise_support, public_call_sheet_links FROM organization_tiers WHERE id = :tier_id",
            {"tier_id": org["tier_id"]}
        )
        if tier:
            tier_info = TierInfoResponse(**tier)

    # Calculate percentages and warnings
    owner_pct = calculate_percent(usage["current_owner_seats"], limits["owner_seats"])
    collab_pct = calculate_percent(usage["current_collaborative_seats"], limits["collaborative_seats"])
    projects_pct = calculate_percent(usage["current_active_projects"], limits["active_projects_limit"])
    active_storage_pct = calculate_percent(usage["current_active_storage_bytes"], limits["active_storage_bytes"])
    archive_storage_pct = calculate_percent(usage["current_archive_storage_bytes"], limits["archive_storage_bytes"])
    bandwidth_pct = calculate_percent(usage["current_month_bandwidth_bytes"], limits["monthly_bandwidth_bytes"])

    warnings = get_near_limit_warnings(usage, limits)

    return UsageSummaryResponse(
        organization_id=org_id,
        organization_name=org["name"],
        tier=tier_info,
        subscription_status=org.get("subscription_status"),

        owner_seats_used=usage["current_owner_seats"],
        owner_seats_limit=limits["owner_seats"],
        owner_seats_percent=owner_pct,

        collaborative_seats_used=usage["current_collaborative_seats"],
        collaborative_seats_limit=limits["collaborative_seats"],
        collaborative_seats_percent=collab_pct,

        active_projects_used=usage["current_active_projects"],
        active_projects_limit=limits["active_projects_limit"],
        active_projects_percent=projects_pct,

        active_storage_used=usage["current_active_storage_bytes"],
        active_storage_limit=limits["active_storage_bytes"],
        active_storage_percent=active_storage_pct,

        archive_storage_used=usage["current_archive_storage_bytes"],
        archive_storage_limit=limits["archive_storage_bytes"],
        archive_storage_percent=archive_storage_pct,

        bandwidth_used=usage["current_month_bandwidth_bytes"],
        bandwidth_limit=limits["monthly_bandwidth_bytes"],
        bandwidth_percent=bandwidth_pct,
        bandwidth_reset_date=str(usage["bandwidth_reset_date"]),

        near_limit_warnings=warnings
    )


@router.get("/{org_id}/usage/bandwidth", response_model=BandwidthBreakdownResponse)
async def get_bandwidth_breakdown(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    Get bandwidth usage breakdown for an organization.

    Shows usage by event type and by project.
    """
    user_id = user.get("profile_id") or user.get("id")
    await check_org_access(org_id, user_id)

    # Get usage record for reset date
    usage = execute_single(
        "SELECT bandwidth_reset_date, current_month_bandwidth_bytes FROM organization_usage WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    reset_date = usage["bandwidth_reset_date"] if usage else str(date.today())

    # By event type
    by_type = execute_query("""
        SELECT event_type, SUM(bytes_transferred) as total_bytes
        FROM organization_bandwidth_logs
        WHERE organization_id = :org_id
          AND created_at >= :reset_date::date
        GROUP BY event_type
        ORDER BY total_bytes DESC
    """, {"org_id": org_id, "reset_date": reset_date})

    event_type_map = {row["event_type"]: row["total_bytes"] for row in by_type}

    # By project
    by_project = execute_query("""
        SELECT
            l.project_id,
            p.title as project_name,
            SUM(l.bytes_transferred) as total_bytes
        FROM organization_bandwidth_logs l
        LEFT JOIN backlot_projects p ON l.project_id = p.id
        WHERE l.organization_id = :org_id
          AND l.created_at >= :reset_date::date
          AND l.project_id IS NOT NULL
        GROUP BY l.project_id, p.title
        ORDER BY total_bytes DESC
        LIMIT 10
    """, {"org_id": org_id, "reset_date": reset_date})

    return BandwidthBreakdownResponse(
        total_bytes=usage["current_month_bandwidth_bytes"] if usage else 0,
        by_event_type=event_type_map,
        by_project=[{
            "project_id": row["project_id"],
            "project_name": row["project_name"] or "Unknown",
            "bytes": row["total_bytes"]
        } for row in by_project],
        reset_date=str(reset_date)
    )


@router.get("/{org_id}/usage/storage", response_model=StorageBreakdownResponse)
async def get_storage_breakdown(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    Get storage usage breakdown by project.

    Note: This requires storage tracking to be implemented at the file upload level.
    Currently returns aggregate data from the usage table.
    """
    user_id = user.get("profile_id") or user.get("id")
    await check_org_access(org_id, user_id)

    # Get aggregate usage
    usage = execute_single(
        "SELECT current_active_storage_bytes, current_archive_storage_bytes FROM organization_usage WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    # Try to get per-project breakdown if available
    # This assumes backlot_projects has storage tracking fields
    by_project = execute_query("""
        SELECT
            p.id as project_id,
            p.title as project_name,
            p.status,
            COALESCE(p.storage_bytes_used, 0) as active_bytes,
            COALESCE(p.archive_bytes_used, 0) as archive_bytes
        FROM backlot_projects p
        WHERE p.organization_id = :org_id
        ORDER BY COALESCE(p.storage_bytes_used, 0) DESC
        LIMIT 20
    """, {"org_id": org_id})

    return StorageBreakdownResponse(
        active_total_bytes=usage["current_active_storage_bytes"] if usage else 0,
        archive_total_bytes=usage["current_archive_storage_bytes"] if usage else 0,
        by_project=[{
            "project_id": row["project_id"],
            "project_name": row["project_name"],
            "status": row["status"],
            "active_bytes": row["active_bytes"],
            "archive_bytes": row["archive_bytes"]
        } for row in by_project]
    )


@router.get("/{org_id}/usage/seats", response_model=SeatAllocationResponse)
async def get_seat_allocation(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    Get seat allocation details for an organization.

    Shows who occupies each seat type.
    """
    user_id = user.get("profile_id") or user.get("id")
    await check_org_access(org_id, user_id)

    # Owner seats
    owners = execute_query("""
        SELECT
            m.id,
            m.user_id,
            p.display_name as user_name,
            p.email as user_email,
            p.avatar_url,
            m.joined_at
        FROM organization_members m
        JOIN profiles p ON m.user_id = p.id
        WHERE m.organization_id = :org_id
          AND m.role = 'owner'
          AND m.is_active = TRUE
        ORDER BY m.joined_at
    """, {"org_id": org_id})

    # Collaborative seats (admin, manager, member)
    collaborators = execute_query("""
        SELECT
            m.id,
            m.user_id,
            p.display_name as user_name,
            p.email as user_email,
            p.avatar_url,
            m.role,
            m.title,
            m.department,
            m.joined_at
        FROM organization_members m
        JOIN profiles p ON m.user_id = p.id
        WHERE m.organization_id = :org_id
          AND m.role IN ('admin', 'manager', 'member')
          AND m.is_active = TRUE
        ORDER BY
            CASE m.role
                WHEN 'admin' THEN 1
                WHEN 'manager' THEN 2
                ELSE 3
            END,
            m.joined_at
    """, {"org_id": org_id})

    # External seats per project (from project_external_seats if it exists)
    # This queries the external seats table if available
    external_seats = execute_query("""
        SELECT
            es.id,
            es.project_id,
            bp.title as project_name,
            es.user_id,
            p.display_name as user_name,
            p.email as user_email,
            es.seat_type,
            es.status,
            es.created_at
        FROM project_external_seats es
        JOIN backlot_projects bp ON es.project_id = bp.id
        LEFT JOIN profiles p ON es.user_id = p.id
        WHERE bp.organization_id = :org_id
          AND es.status = 'active'
        ORDER BY bp.title, es.seat_type
        LIMIT 100
    """, {"org_id": org_id})

    return SeatAllocationResponse(
        owner_seats=[{
            "id": row["id"],
            "user_id": row["user_id"],
            "user_name": row["user_name"],
            "user_email": row["user_email"],
            "avatar_url": row["avatar_url"],
            "joined_at": str(row["joined_at"]) if row.get("joined_at") else None
        } for row in owners],
        collaborative_seats=[{
            "id": row["id"],
            "user_id": row["user_id"],
            "user_name": row["user_name"],
            "user_email": row["user_email"],
            "avatar_url": row["avatar_url"],
            "role": row["role"],
            "title": row["title"],
            "department": row["department"],
            "joined_at": str(row["joined_at"]) if row.get("joined_at") else None
        } for row in collaborators],
        per_project_external_seats=[{
            "id": row["id"],
            "project_id": row["project_id"],
            "project_name": row["project_name"],
            "user_id": row["user_id"],
            "user_name": row["user_name"],
            "user_email": row["user_email"],
            "seat_type": row["seat_type"],
            "status": row["status"],
            "created_at": str(row["created_at"]) if row.get("created_at") else None
        } for row in external_seats]
    )


@router.get("/{org_id}/tiers")
async def get_available_tiers(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    Get available tiers for upgrade/comparison.

    Shows all active tiers with current tier highlighted.
    """
    user_id = user.get("profile_id") or user.get("id")
    org = await check_org_access(org_id, user_id)

    tiers = execute_query("""
        SELECT
            id,
            name,
            display_name,
            description,
            price_cents,
            owner_seats,
            collaborative_seats,
            freelancer_seats_per_project,
            view_only_seats_per_project,
            active_projects_limit,
            active_storage_bytes,
            archive_storage_bytes,
            monthly_bandwidth_bytes,
            enterprise_support,
            priority_email_response,
            training_discount_percent,
            public_call_sheet_links,
            sort_order
        FROM organization_tiers
        WHERE is_active = TRUE
        ORDER BY sort_order
    """, {})

    current_tier_id = org.get("tier_id")

    return {
        "current_tier_id": current_tier_id,
        "tiers": [{
            **tier,
            "is_current": tier["id"] == current_tier_id
        } for tier in tiers]
    }
