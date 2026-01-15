"""
Admin Organizations API

Endpoints for admin management of organization tiers, quotas, and usage.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.core.logging import get_logger

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class TierResponse(BaseModel):
    """Organization tier response."""
    id: str
    name: str
    display_name: str
    description: Optional[str]
    price_cents: int
    owner_seats: int
    collaborative_seats: int
    freelancer_seats_per_project: int
    view_only_seats_per_project: int
    active_projects_limit: int
    active_storage_bytes: int
    archive_storage_bytes: int
    monthly_bandwidth_bytes: int
    enterprise_support: bool
    priority_email_response: bool
    training_discount_percent: int
    public_call_sheet_links: bool
    stripe_price_id: Optional[str]
    sort_order: int
    is_active: bool


class TierUpdate(BaseModel):
    """Update tier request."""
    display_name: Optional[str] = None
    description: Optional[str] = None
    price_cents: Optional[int] = None
    stripe_price_id: Optional[str] = None
    owner_seats: Optional[int] = None
    collaborative_seats: Optional[int] = None
    freelancer_seats_per_project: Optional[int] = None
    view_only_seats_per_project: Optional[int] = None
    active_projects_limit: Optional[int] = None
    active_storage_bytes: Optional[int] = None
    archive_storage_bytes: Optional[int] = None
    monthly_bandwidth_bytes: Optional[int] = None
    enterprise_support: Optional[bool] = None
    priority_email_response: Optional[bool] = None
    training_discount_percent: Optional[int] = None
    public_call_sheet_links: Optional[bool] = None
    is_active: Optional[bool] = None


class UsageResponse(BaseModel):
    """Organization usage response."""
    organization_id: str
    current_owner_seats: int
    current_collaborative_seats: int
    current_active_projects: int
    current_active_storage_bytes: int
    current_archive_storage_bytes: int
    current_month_bandwidth_bytes: int
    bandwidth_reset_date: str
    last_calculated_at: Optional[str]


class OrganizationLimitsResponse(BaseModel):
    """Effective organization limits response."""
    owner_seats: int
    collaborative_seats: int
    freelancer_seats_per_project: int
    view_only_seats_per_project: int
    active_projects_limit: int
    active_storage_bytes: int
    archive_storage_bytes: int
    monthly_bandwidth_bytes: int
    enterprise_support: bool
    public_call_sheet_links: bool
    tier_name: Optional[str]
    tier_display_name: Optional[str]
    price_cents: int


class AdminOrganizationResponse(BaseModel):
    """Organization response for admin view."""
    id: str
    name: str
    slug: Optional[str]
    org_type: Optional[str]
    status: str
    tier_id: Optional[str]
    tier_name: Optional[str]
    tier_display_name: Optional[str]
    subscription_status: Optional[str]
    stripe_subscription_id: Optional[str]
    billing_email: Optional[str]
    created_at: str
    # Usage
    current_owner_seats: int = 0
    current_collaborative_seats: int = 0
    current_active_projects: int = 0
    current_active_storage_bytes: int = 0
    current_archive_storage_bytes: int = 0
    current_month_bandwidth_bytes: int = 0
    # Limits
    limit_owner_seats: int = 1
    limit_collaborative_seats: int = 2
    limit_active_projects: int = 5
    limit_active_storage_bytes: int = 0
    limit_archive_storage_bytes: int = 0
    limit_monthly_bandwidth_bytes: int = 0
    # Override flags
    has_overrides: bool = False


class OrganizationUpdate(BaseModel):
    """Update organization request (admin)."""
    tier_id: Optional[str] = None
    subscription_status: Optional[str] = None
    billing_email: Optional[str] = None
    status: Optional[str] = None


class OverrideLimitsRequest(BaseModel):
    """Set override limits request."""
    owner_seats: Optional[int] = None
    collaborative_seats: Optional[int] = None
    freelancer_seats_per_project: Optional[int] = None
    view_only_seats_per_project: Optional[int] = None
    active_projects_limit: Optional[int] = None
    active_storage_bytes: Optional[int] = None
    archive_storage_bytes: Optional[int] = None
    monthly_bandwidth_bytes: Optional[int] = None


class UserOrgLimitRequest(BaseModel):
    """Set user organization limit request."""
    max_organizations_allowed: int = Field(..., ge=0)


class AdminStatsResponse(BaseModel):
    """Dashboard aggregate stats response."""
    total_organizations: int
    active_organizations: int
    organizations_by_tier: Dict[str, int]
    organizations_by_status: Dict[str, int]
    total_storage_used_bytes: int
    total_bandwidth_this_month_bytes: int


# =============================================================================
# Tier Endpoints
# =============================================================================

@router.get("/tiers", response_model=List[TierResponse])
async def list_tiers(
    include_inactive: bool = Query(False, description="Include inactive tiers"),
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """List all organization tiers."""
    query = """
        SELECT * FROM organization_tiers
        WHERE is_active = TRUE OR is_active = :include_inactive
        ORDER BY sort_order
    """
    rows = execute_query(query, {"include_inactive": include_inactive})
    return [TierResponse(**row) for row in rows]


@router.get("/tiers/{tier_id}", response_model=TierResponse)
async def get_tier(
    tier_id: str,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Get a specific tier by ID."""
    row = execute_single(
        "SELECT * FROM organization_tiers WHERE id = :tier_id",
        {"tier_id": tier_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Tier not found")
    return TierResponse(**row)


@router.put("/tiers/{tier_id}", response_model=TierResponse)
async def update_tier(
    tier_id: str,
    data: TierUpdate,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Update a tier configuration."""
    # Build update fields
    updates = {}
    if data.display_name is not None:
        updates["display_name"] = data.display_name
    if data.description is not None:
        updates["description"] = data.description
    if data.price_cents is not None:
        updates["price_cents"] = data.price_cents
    if data.stripe_price_id is not None:
        updates["stripe_price_id"] = data.stripe_price_id
    if data.owner_seats is not None:
        updates["owner_seats"] = data.owner_seats
    if data.collaborative_seats is not None:
        updates["collaborative_seats"] = data.collaborative_seats
    if data.freelancer_seats_per_project is not None:
        updates["freelancer_seats_per_project"] = data.freelancer_seats_per_project
    if data.view_only_seats_per_project is not None:
        updates["view_only_seats_per_project"] = data.view_only_seats_per_project
    if data.active_projects_limit is not None:
        updates["active_projects_limit"] = data.active_projects_limit
    if data.active_storage_bytes is not None:
        updates["active_storage_bytes"] = data.active_storage_bytes
    if data.archive_storage_bytes is not None:
        updates["archive_storage_bytes"] = data.archive_storage_bytes
    if data.monthly_bandwidth_bytes is not None:
        updates["monthly_bandwidth_bytes"] = data.monthly_bandwidth_bytes
    if data.enterprise_support is not None:
        updates["enterprise_support"] = data.enterprise_support
    if data.priority_email_response is not None:
        updates["priority_email_response"] = data.priority_email_response
    if data.training_discount_percent is not None:
        updates["training_discount_percent"] = data.training_discount_percent
    if data.public_call_sheet_links is not None:
        updates["public_call_sheet_links"] = data.public_call_sheet_links
    if data.is_active is not None:
        updates["is_active"] = data.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = datetime.utcnow().isoformat()

    # Build SET clause
    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["tier_id"] = tier_id

    row = execute_single(
        f"UPDATE organization_tiers SET {set_clause} WHERE id = :tier_id RETURNING *",
        updates
    )

    if not row:
        raise HTTPException(status_code=404, detail="Tier not found")

    logger.info("tier_updated", tier_id=tier_id, admin_id=user.get("id"))
    return TierResponse(**row)


# =============================================================================
# Organization Admin Endpoints
# =============================================================================

@router.get("", response_model=Dict[str, Any])
async def list_organizations(
    search: Optional[str] = Query(None, description="Search by name or slug"),
    tier_id: Optional[str] = Query(None, description="Filter by tier"),
    subscription_status: Optional[str] = Query(None, description="Filter by subscription status"),
    status: Optional[str] = Query(None, description="Filter by org status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """List all organizations with usage stats."""
    offset = (page - 1) * page_size

    # Build WHERE conditions
    conditions = ["1=1"]
    params = {"limit": page_size, "offset": offset}

    if search:
        conditions.append("(o.name ILIKE :search OR o.slug ILIKE :search)")
        params["search"] = f"%{search}%"
    if tier_id:
        conditions.append("o.tier_id = :tier_id")
        params["tier_id"] = tier_id
    if subscription_status:
        conditions.append("o.subscription_status = :subscription_status")
        params["subscription_status"] = subscription_status
    if status:
        conditions.append("o.status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions)

    # Get total count
    count_query = f"""
        SELECT COUNT(*) as total
        FROM organizations o
        WHERE {where_clause}
    """
    count_result = execute_single(count_query, params)
    total = count_result["total"] if count_result else 0

    # Get organizations with usage and limits
    query = f"""
        SELECT
            o.id,
            o.name,
            o.slug,
            o.org_type::text as org_type,
            o.status::text as status,
            o.tier_id,
            t.name as tier_name,
            t.display_name as tier_display_name,
            o.subscription_status,
            o.stripe_subscription_id,
            o.billing_email,
            o.created_at,
            -- Usage
            COALESCE(u.current_owner_seats, 0) as current_owner_seats,
            COALESCE(u.current_collaborative_seats, 0) as current_collaborative_seats,
            COALESCE(u.current_active_projects, 0) as current_active_projects,
            COALESCE(u.current_active_storage_bytes, 0) as current_active_storage_bytes,
            COALESCE(u.current_archive_storage_bytes, 0) as current_archive_storage_bytes,
            COALESCE(u.current_month_bandwidth_bytes, 0) as current_month_bandwidth_bytes,
            -- Limits (effective = COALESCE(override, tier, default))
            COALESCE(o.override_owner_seats, t.owner_seats, 1) as limit_owner_seats,
            COALESCE(o.override_collaborative_seats, t.collaborative_seats, 2) as limit_collaborative_seats,
            COALESCE(o.override_active_projects_limit, t.active_projects_limit, 5) as limit_active_projects,
            COALESCE(o.override_active_storage_bytes, t.active_storage_bytes, 1099511627776) as limit_active_storage_bytes,
            COALESCE(o.override_archive_storage_bytes, t.archive_storage_bytes, 1099511627776) as limit_archive_storage_bytes,
            COALESCE(o.override_monthly_bandwidth_bytes, t.monthly_bandwidth_bytes, 536870912000) as limit_monthly_bandwidth_bytes,
            -- Has overrides flag
            (o.override_owner_seats IS NOT NULL OR
             o.override_collaborative_seats IS NOT NULL OR
             o.override_freelancer_seats_per_project IS NOT NULL OR
             o.override_view_only_seats_per_project IS NOT NULL OR
             o.override_active_projects_limit IS NOT NULL OR
             o.override_active_storage_bytes IS NOT NULL OR
             o.override_archive_storage_bytes IS NOT NULL OR
             o.override_monthly_bandwidth_bytes IS NOT NULL) as has_overrides
        FROM organizations o
        LEFT JOIN organization_tiers t ON o.tier_id = t.id
        LEFT JOIN organization_usage u ON o.id = u.organization_id
        WHERE {where_clause}
        ORDER BY o.created_at DESC
        LIMIT :limit OFFSET :offset
    """

    rows = execute_query(query, params)

    return {
        "items": [AdminOrganizationResponse(**row) for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/stats", response_model=AdminStatsResponse)
async def get_organization_stats(
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Get aggregate organization statistics."""
    # Total and active counts
    counts = execute_single("""
        SELECT
            COUNT(*) as total_organizations,
            COUNT(*) FILTER (WHERE status = 'active') as active_organizations
        FROM organizations
    """, {})

    # By tier
    tier_rows = execute_query("""
        SELECT
            COALESCE(t.name, 'none') as tier_name,
            COUNT(*) as count
        FROM organizations o
        LEFT JOIN organization_tiers t ON o.tier_id = t.id
        GROUP BY t.name
    """, {})
    by_tier = {row["tier_name"]: row["count"] for row in tier_rows}

    # By subscription status
    status_rows = execute_query("""
        SELECT
            COALESCE(subscription_status, 'none') as status,
            COUNT(*) as count
        FROM organizations
        GROUP BY subscription_status
    """, {})
    by_status = {row["status"]: row["count"] for row in status_rows}

    # Storage and bandwidth totals
    usage_totals = execute_single("""
        SELECT
            COALESCE(SUM(current_active_storage_bytes + current_archive_storage_bytes), 0) as total_storage,
            COALESCE(SUM(current_month_bandwidth_bytes), 0) as total_bandwidth
        FROM organization_usage
    """, {})

    return AdminStatsResponse(
        total_organizations=counts["total_organizations"],
        active_organizations=counts["active_organizations"],
        organizations_by_tier=by_tier,
        organizations_by_status=by_status,
        total_storage_used_bytes=usage_totals["total_storage"],
        total_bandwidth_this_month_bytes=usage_totals["total_bandwidth"]
    )


# =============================================================================
# User Organization Limit Endpoints (MUST be before /{org_id} routes)
# =============================================================================

@router.get("/users-with-limits")
async def list_users_with_org_limits(
    search: Optional[str] = Query(None, description="Search by name or email"),
    has_multiple_orgs: Optional[bool] = Query(None, description="Filter users with limit > 1"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """List users with their organization limits."""
    offset = (page - 1) * page_size
    conditions = ["1=1"]
    params = {"limit": page_size, "offset": offset}

    if search:
        conditions.append("(p.full_name ILIKE :search OR p.email ILIKE :search OR p.username ILIKE :search)")
        params["search"] = f"%{search}%"
    if has_multiple_orgs:
        conditions.append("COALESCE(p.max_organizations_allowed, 1) > 1")

    where_clause = " AND ".join(conditions)

    # Count
    count_result = execute_single(f"""
        SELECT COUNT(*) as total FROM profiles p WHERE {where_clause}
    """, params)
    total = count_result["total"] if count_result else 0

    # Get users with org counts
    rows = execute_query(f"""
        SELECT
            p.id,
            p.email,
            p.username,
            p.full_name,
            p.avatar_url,
            COALESCE(p.max_organizations_allowed, 1) as max_organizations_allowed,
            COALESCE(org_counts.owned_count, 0) as current_organizations_owned
        FROM profiles p
        LEFT JOIN (
            SELECT user_id, COUNT(*) as owned_count
            FROM organization_members
            WHERE role = 'owner'
            GROUP BY user_id
        ) org_counts ON p.id = org_counts.user_id
        WHERE {where_clause}
        ORDER BY p.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/users/{user_id}/org-limit")
async def get_user_org_limit(
    user_id: str,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Get user's organization creation limit."""
    row = execute_single(
        "SELECT id, max_organizations_allowed FROM profiles WHERE id = :user_id",
        {"user_id": user_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    # Get current org count
    count = execute_single("""
        SELECT COUNT(*) as count
        FROM organization_members
        WHERE user_id = :user_id AND role = 'owner'
    """, {"user_id": user_id})

    return {
        "user_id": user_id,
        "max_organizations_allowed": row["max_organizations_allowed"] or 1,
        "current_organizations_owned": count["count"] if count else 0
    }


@router.put("/users/{user_id}/org-limit")
async def set_user_org_limit(
    user_id: str,
    data: UserOrgLimitRequest,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Set user's maximum allowed organizations."""
    result = execute_single("""
        UPDATE profiles
        SET max_organizations_allowed = :limit, updated_at = NOW()
        WHERE id = :user_id
        RETURNING id, max_organizations_allowed
    """, {"user_id": user_id, "limit": data.max_organizations_allowed})

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(
        "user_org_limit_set",
        user_id=user_id,
        admin_id=user.get("id"),
        limit=data.max_organizations_allowed
    )

    # Return updated info
    return await get_user_org_limit(user_id, user)


# =============================================================================
# Organization Detail Endpoints (dynamic /{org_id} routes)
# =============================================================================

@router.get("/{org_id}", response_model=AdminOrganizationResponse)
async def get_organization(
    org_id: str,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Get organization details with usage and limits."""
    query = """
        SELECT
            o.id,
            o.name,
            o.slug,
            o.org_type::text as org_type,
            o.status::text as status,
            o.tier_id,
            t.name as tier_name,
            t.display_name as tier_display_name,
            o.subscription_status,
            o.stripe_subscription_id,
            o.billing_email,
            o.created_at,
            -- Usage
            COALESCE(u.current_owner_seats, 0) as current_owner_seats,
            COALESCE(u.current_collaborative_seats, 0) as current_collaborative_seats,
            COALESCE(u.current_active_projects, 0) as current_active_projects,
            COALESCE(u.current_active_storage_bytes, 0) as current_active_storage_bytes,
            COALESCE(u.current_archive_storage_bytes, 0) as current_archive_storage_bytes,
            COALESCE(u.current_month_bandwidth_bytes, 0) as current_month_bandwidth_bytes,
            -- Limits
            COALESCE(o.override_owner_seats, t.owner_seats, 1) as limit_owner_seats,
            COALESCE(o.override_collaborative_seats, t.collaborative_seats, 2) as limit_collaborative_seats,
            COALESCE(o.override_active_projects_limit, t.active_projects_limit, 5) as limit_active_projects,
            COALESCE(o.override_active_storage_bytes, t.active_storage_bytes, 1099511627776) as limit_active_storage_bytes,
            COALESCE(o.override_archive_storage_bytes, t.archive_storage_bytes, 1099511627776) as limit_archive_storage_bytes,
            COALESCE(o.override_monthly_bandwidth_bytes, t.monthly_bandwidth_bytes, 536870912000) as limit_monthly_bandwidth_bytes,
            -- Has overrides
            (o.override_owner_seats IS NOT NULL OR
             o.override_collaborative_seats IS NOT NULL OR
             o.override_freelancer_seats_per_project IS NOT NULL OR
             o.override_view_only_seats_per_project IS NOT NULL OR
             o.override_active_projects_limit IS NOT NULL OR
             o.override_active_storage_bytes IS NOT NULL OR
             o.override_archive_storage_bytes IS NOT NULL OR
             o.override_monthly_bandwidth_bytes IS NOT NULL) as has_overrides
        FROM organizations o
        LEFT JOIN organization_tiers t ON o.tier_id = t.id
        LEFT JOIN organization_usage u ON o.id = u.organization_id
        WHERE o.id = :org_id
    """
    row = execute_single(query, {"org_id": org_id})
    if not row:
        raise HTTPException(status_code=404, detail="Organization not found")
    return AdminOrganizationResponse(**row)


@router.get("/{org_id}/limits", response_model=OrganizationLimitsResponse)
async def get_organization_limits(
    org_id: str,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Get effective limits for an organization (tier + overrides)."""
    row = execute_single(
        "SELECT * FROM get_organization_limits(:org_id)",
        {"org_id": org_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationLimitsResponse(**row)


@router.get("/{org_id}/usage", response_model=UsageResponse)
async def get_organization_usage(
    org_id: str,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Get current usage for an organization."""
    row = execute_single(
        "SELECT * FROM organization_usage WHERE organization_id = :org_id",
        {"org_id": org_id}
    )
    if not row:
        # Create usage record if it doesn't exist
        execute_insert(
            "INSERT INTO organization_usage (organization_id) VALUES (:org_id) ON CONFLICT DO NOTHING",
            {"org_id": org_id}
        )
        row = execute_single(
            "SELECT * FROM organization_usage WHERE organization_id = :org_id",
            {"org_id": org_id}
        )
        if not row:
            raise HTTPException(status_code=404, detail="Organization not found")
    return UsageResponse(**row)


@router.put("/{org_id}", response_model=AdminOrganizationResponse)
async def update_organization(
    org_id: str,
    data: OrganizationUpdate,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Update organization tier, status, or billing info."""
    updates = {}
    if data.tier_id is not None:
        # Verify tier exists
        tier = execute_single(
            "SELECT id FROM organization_tiers WHERE id = :tier_id",
            {"tier_id": data.tier_id}
        )
        if not tier:
            raise HTTPException(status_code=400, detail="Invalid tier_id")
        updates["tier_id"] = data.tier_id
    if data.subscription_status is not None:
        valid_statuses = ['none', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused']
        if data.subscription_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid subscription_status. Must be one of: {valid_statuses}")
        updates["subscription_status"] = data.subscription_status
    if data.billing_email is not None:
        updates["billing_email"] = data.billing_email
    if data.status is not None:
        updates["status"] = data.status

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["updated_at"] = datetime.utcnow().isoformat()

    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["org_id"] = org_id

    result = execute_single(
        f"UPDATE organizations SET {set_clause} WHERE id = :org_id RETURNING id",
        updates
    )

    if not result:
        raise HTTPException(status_code=404, detail="Organization not found")

    logger.info("organization_updated", org_id=org_id, admin_id=user.get("id"), updates=list(updates.keys()))

    # Return updated organization
    return await get_organization(org_id, user)


@router.put("/{org_id}/override", response_model=AdminOrganizationResponse)
async def set_organization_override(
    org_id: str,
    data: OverrideLimitsRequest,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Set admin override limits for an organization."""
    updates = {"updated_at": datetime.utcnow().isoformat()}

    if data.owner_seats is not None:
        updates["override_owner_seats"] = data.owner_seats
    if data.collaborative_seats is not None:
        updates["override_collaborative_seats"] = data.collaborative_seats
    if data.freelancer_seats_per_project is not None:
        updates["override_freelancer_seats_per_project"] = data.freelancer_seats_per_project
    if data.view_only_seats_per_project is not None:
        updates["override_view_only_seats_per_project"] = data.view_only_seats_per_project
    if data.active_projects_limit is not None:
        updates["override_active_projects_limit"] = data.active_projects_limit
    if data.active_storage_bytes is not None:
        updates["override_active_storage_bytes"] = data.active_storage_bytes
    if data.archive_storage_bytes is not None:
        updates["override_archive_storage_bytes"] = data.archive_storage_bytes
    if data.monthly_bandwidth_bytes is not None:
        updates["override_monthly_bandwidth_bytes"] = data.monthly_bandwidth_bytes

    if len(updates) == 1:  # Only updated_at
        raise HTTPException(status_code=400, detail="No override fields provided")

    set_clause = ", ".join([f"{k} = :{k}" for k in updates.keys()])
    updates["org_id"] = org_id

    result = execute_single(
        f"UPDATE organizations SET {set_clause} WHERE id = :org_id RETURNING id",
        updates
    )

    if not result:
        raise HTTPException(status_code=404, detail="Organization not found")

    logger.info("organization_override_set", org_id=org_id, admin_id=user.get("id"))

    return await get_organization(org_id, user)


@router.delete("/{org_id}/override", response_model=AdminOrganizationResponse)
async def clear_organization_override(
    org_id: str,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Clear all admin override limits for an organization."""
    result = execute_single("""
        UPDATE organizations SET
            override_owner_seats = NULL,
            override_collaborative_seats = NULL,
            override_freelancer_seats_per_project = NULL,
            override_view_only_seats_per_project = NULL,
            override_active_projects_limit = NULL,
            override_active_storage_bytes = NULL,
            override_archive_storage_bytes = NULL,
            override_monthly_bandwidth_bytes = NULL,
            updated_at = NOW()
        WHERE id = :org_id
        RETURNING id
    """, {"org_id": org_id})

    if not result:
        raise HTTPException(status_code=404, detail="Organization not found")

    logger.info("organization_override_cleared", org_id=org_id, admin_id=user.get("id"))

    return await get_organization(org_id, user)


@router.post("/{org_id}/recalculate", response_model=UsageResponse)
async def recalculate_organization_usage(
    org_id: str,
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Recalculate usage stats for an organization from source data."""
    row = execute_single(
        "SELECT * FROM recalculate_organization_usage(:org_id)",
        {"org_id": org_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Organization not found")

    logger.info("organization_usage_recalculated", org_id=org_id, admin_id=user.get("id"))

    return UsageResponse(**row)


# =============================================================================
# Bandwidth Log Endpoints
# =============================================================================

@router.get("/{org_id}/bandwidth-logs")
async def get_bandwidth_logs(
    org_id: str,
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    user = Depends(require_permissions(Permission.USER_MANAGE))
):
    """Get bandwidth usage logs for an organization."""
    offset = (page - 1) * page_size
    conditions = ["organization_id = :org_id"]
    params = {"org_id": org_id, "limit": page_size, "offset": offset}

    if event_type:
        conditions.append("event_type = :event_type")
        params["event_type"] = event_type
    if start_date:
        conditions.append("created_at >= :start_date::date")
        params["start_date"] = start_date
    if end_date:
        conditions.append("created_at < (:end_date::date + interval '1 day')")
        params["end_date"] = end_date

    where_clause = " AND ".join(conditions)

    # Count
    count = execute_single(
        f"SELECT COUNT(*) as total FROM organization_bandwidth_logs WHERE {where_clause}",
        params
    )

    # Get logs
    rows = execute_query(f"""
        SELECT
            l.id,
            l.organization_id,
            l.project_id,
            l.user_id,
            p.display_name as user_name,
            l.event_type,
            l.bytes_transferred,
            l.resource_type,
            l.resource_id,
            l.metadata,
            l.created_at
        FROM organization_bandwidth_logs l
        LEFT JOIN profiles p ON l.user_id = p.id
        WHERE {where_clause}
        ORDER BY l.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return {
        "items": rows,
        "total": count["total"] if count else 0,
        "page": page,
        "page_size": page_size
    }
