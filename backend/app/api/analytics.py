"""
Analytics API
Phase 5B: Advanced analytics and insight endpoints.

Provides:
- Creator analytics dashboards
- World performance metrics
- Channel and block analytics
- Lodge analytics
- Ad campaign performance
- Platform-wide health metrics (admin)
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.core.permissions import Permission, require_permissions
from app.services.analytics_service import AnalyticsService

router = APIRouter()


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(user: dict) -> str:
    """Get profile ID from Cognito user."""
    from app.api.users import get_profile_id_from_cognito_id
    return await get_profile_id_from_cognito_id(user["sub"])


async def verify_world_access(world_id: str, profile_id: str) -> dict:
    """Verify user has access to view World analytics."""
    world = execute_single("""
        SELECT id, creator_id, organization_id, title
        FROM worlds WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    is_owner = str(world["creator_id"]) == profile_id

    is_org_member = False
    if world["organization_id"]:
        org_member = execute_single("""
            SELECT role FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
        """, {"org_id": world["organization_id"], "user_id": profile_id})
        is_org_member = org_member is not None

    if not (is_owner or is_org_member):
        raise HTTPException(status_code=403, detail="Not authorized to view analytics")

    return dict(world)


async def verify_lodge_access(lodge_id: str, profile_id: str) -> bool:
    """Verify user has access to view lodge analytics."""
    # Check if user is lodge member with appropriate role
    member = execute_single("""
        SELECT role FROM lodge_members
        WHERE lodge_id = :lodge_id AND user_id = :user_id
          AND role IN ('leader', 'elder', 'steward')
    """, {"lodge_id": lodge_id, "user_id": profile_id})

    return member is not None


# =============================================================================
# Creator Analytics Dashboard
# =============================================================================

@router.get("/creator/dashboard")
async def get_creator_dashboard(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive analytics dashboard for the current creator.

    Includes:
    - Total watch time and viewers
    - Top performing Worlds
    - Earnings summary
    """
    profile_id = await get_profile_id(current_user)
    return await AnalyticsService.get_creator_dashboard(profile_id, days)


@router.get("/creator/top-worlds")
async def get_creator_top_worlds(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get top performing Worlds for the current creator."""
    profile_id = await get_profile_id(current_user)

    worlds = await AnalyticsService.get_top_worlds_by_watch_time(
        days=days,
        limit=limit,
        creator_id=profile_id,
        category=category
    )

    return {"worlds": worlds, "period_days": days}


# =============================================================================
# World Analytics
# =============================================================================

@router.get("/worlds/{world_id}/analytics")
async def get_world_analytics(
    world_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed analytics for a specific World."""
    profile_id = await get_profile_id(current_user)
    await verify_world_access(world_id, profile_id)

    # Get time series
    time_series = await AnalyticsService.get_world_performance_over_time(
        world_id=world_id,
        period_type="daily",
        days=days
    )

    # Get surface breakdown
    breakdown = await AnalyticsService.get_world_surface_breakdown(
        world_id=world_id,
        days=days
    )

    return {
        "world_id": world_id,
        "period_days": days,
        "time_series": time_series,
        "surface_breakdown": breakdown
    }


@router.get("/worlds/{world_id}/analytics/cohorts")
async def get_world_cohort_analytics(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get cohort performance for a World (7/30/90 day windows).

    Shows how the World performed in its first week, month, and quarter.
    """
    profile_id = await get_profile_id(current_user)
    await verify_world_access(world_id, profile_id)

    return await AnalyticsService.get_world_cohort_metrics(world_id)


# =============================================================================
# Organization Analytics
# =============================================================================

@router.get("/organizations/{org_id}/analytics/dashboard")
async def get_organization_dashboard(
    org_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive analytics dashboard for an organization."""
    profile_id = await get_profile_id(current_user)

    # Verify org membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
    """, {"org_id": org_id, "user_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    return await AnalyticsService.get_organization_dashboard(org_id, days)


@router.get("/organizations/{org_id}/analytics/top-worlds")
async def get_organization_top_worlds(
    org_id: str,
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get top performing Worlds for an organization."""
    profile_id = await get_profile_id(current_user)

    # Verify org membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
    """, {"org_id": org_id, "user_id": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    worlds = await AnalyticsService.get_top_worlds_by_watch_time(
        days=days,
        limit=limit,
        organization_id=org_id
    )

    return {"organization_id": org_id, "worlds": worlds, "period_days": days}


# =============================================================================
# Channel Analytics
# =============================================================================

@router.get("/channels/{channel_id}/analytics")
async def get_channel_analytics(
    channel_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get performance analytics for a linear channel."""
    # Verify channel access (owner or admin)
    profile_id = await get_profile_id(current_user)

    channel = execute_single("""
        SELECT id, owner_id FROM linear_channels WHERE id = :channel_id
    """, {"channel_id": channel_id})

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # For now, require ownership (could expand to admin roles)
    if str(channel.get("owner_id")) != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return await AnalyticsService.get_channel_performance(channel_id, days=days)


@router.get("/channels/compare")
async def compare_channels(
    channel_ids: str = Query(..., description="Comma-separated channel IDs"),
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Compare performance across multiple channels."""
    ids = [c.strip() for c in channel_ids.split(",")]

    if len(ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 channels for comparison")

    results = await AnalyticsService.get_channel_comparison(ids, days)

    return {"channels": results, "period_days": days}


@router.get("/blocks/{block_id}/analytics")
async def get_block_analytics(
    block_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get performance analytics for a programming block."""
    return await AnalyticsService.get_block_performance(block_id, days)


# =============================================================================
# Lodge Analytics
# =============================================================================

@router.get("/lodges/{lodge_id}/analytics")
async def get_lodge_analytics(
    lodge_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive analytics for a lodge.

    Requires lodge leadership role (leader, elder, steward).
    """
    profile_id = await get_profile_id(current_user)

    if not await verify_lodge_access(lodge_id, profile_id):
        raise HTTPException(status_code=403, detail="Lodge leadership role required")

    return await AnalyticsService.get_lodge_analytics(lodge_id, days=days)


@router.get("/lodges/{lodge_id}/analytics/contribution")
async def get_lodge_platform_contribution(
    lodge_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """
    Get lodge's contribution to overall platform metrics.

    Shows watch share and earnings relative to platform totals.
    """
    profile_id = await get_profile_id(current_user)

    if not await verify_lodge_access(lodge_id, profile_id):
        raise HTTPException(status_code=403, detail="Lodge leadership role required")

    return await AnalyticsService.get_lodge_platform_contribution(lodge_id, days)


# =============================================================================
# Ad Campaign Analytics
# =============================================================================

@router.get("/campaigns/{campaign_id}/analytics")
async def get_campaign_analytics(
    campaign_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get performance analytics for an ad campaign."""
    profile_id = await get_profile_id(current_user)

    # Verify campaign access
    campaign = execute_single("""
        SELECT id, advertiser_id FROM ad_campaigns WHERE id = :campaign_id
    """, {"campaign_id": campaign_id})

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Check if user is associated with the advertiser
    # (simplified - could check advertiser membership)

    return await AnalyticsService.get_campaign_performance(campaign_id, days)


@router.get("/campaigns/{campaign_id}/line-items/{line_item_id}/analytics")
async def get_line_item_analytics(
    campaign_id: str,
    line_item_id: str,
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed analytics for an ad line item."""
    return await AnalyticsService.get_line_item_breakdown(line_item_id, days)


# =============================================================================
# Admin Analytics
# =============================================================================

@router.get("/admin/analytics/platform-health")
async def get_platform_health(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Get platform-wide health metrics.

    Admin only. Shows overall watch time, active Worlds, and channels.
    """
    return await AnalyticsService.get_platform_health_summary(days)


@router.get("/admin/analytics/content-distribution")
async def get_content_distribution(
    current_user: dict = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Get content distribution across categories and types.

    Admin only. Shows platform content health.
    """
    return await AnalyticsService.get_content_distribution_stats()


@router.get("/admin/analytics/retention-cohorts")
async def get_retention_cohorts(
    weeks: int = Query(12, ge=1, le=52),
    current_user: dict = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Get user retention cohort data.

    Admin only. Shows week-over-week retention rates.
    """
    cohorts = await AnalyticsService.get_user_retention_cohorts(weeks)
    return {"cohorts": cohorts, "period_weeks": weeks}


@router.get("/admin/analytics/top-worlds")
async def get_platform_top_worlds(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=200),
    category: Optional[str] = None,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Get top performing Worlds platform-wide.

    Admin only.
    """
    worlds = await AnalyticsService.get_top_worlds_by_watch_time(
        days=days,
        limit=limit,
        category=category
    )

    return {"worlds": worlds, "period_days": days}
