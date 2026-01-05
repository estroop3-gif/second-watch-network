"""
Creator Earnings API

Dashboard endpoints for creators and organizations to view their earnings,
analytics, and payout history.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime, date, timedelta

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single
from app.core.logging import get_logger
from app.services.revenue_calculation import RevenueCalculationService
from app.services.watch_aggregation import WatchAggregationService

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class EarningsSummary(BaseModel):
    """Creator earnings summary."""
    worlds_with_earnings: int
    ytd_earnings_cents: int
    lifetime_earnings_cents: int
    pending_payout_cents: int
    paid_total_cents: int
    held_cents: int


class CreatorDashboard(BaseModel):
    """Creator dashboard data."""
    total_worlds: int
    total_followers: int
    watch_minutes_30d: int
    unique_viewers_30d: int
    ytd_earnings_cents: int
    pending_payout_cents: int
    top_worlds: List[Dict[str, Any]]


class WorldAnalytics(BaseModel):
    """World analytics response."""
    world_id: str
    world_title: str
    watch_stats: List[Dict[str, Any]]
    earnings_history: List[Dict[str, Any]]
    total_watch_seconds: int
    total_earnings_cents: int


class PayoutSummary(BaseModel):
    """Payout summary."""
    id: str
    period_start: str
    period_end: str
    gross_amount_cents: int
    net_amount_cents: int
    status: str
    worlds_count: int
    created_at: str


class PayoutDetail(BaseModel):
    """Payout details with line items."""
    id: str
    payout_to_type: str
    payout_to_id: str
    period_start: str
    period_end: str
    gross_amount_cents: int
    fees_cents: int
    net_amount_cents: int
    status: str
    stripe_transfer_id: Optional[str]
    approved_by: Optional[str]
    approved_at: Optional[str]
    processed_at: Optional[str]
    line_items: List[Dict[str, Any]]


# =============================================================================
# Creator Dashboard
# =============================================================================

@router.get("/creator/dashboard", response_model=CreatorDashboard)
async def get_creator_dashboard(
    user = Depends(get_current_user)
):
    """
    Get creator dashboard overview.

    Shows:
    - Total worlds owned
    - Total followers across all worlds
    - 30-day watch minutes
    - YTD earnings
    - Top performing worlds
    """
    user_id = user.get("profile_id") or user.get("id")

    # Get world stats
    world_stats = execute_single("""
        SELECT
            COUNT(*) as total_worlds,
            COALESCE(SUM(followers_count), 0) as total_followers
        FROM worlds
        WHERE creator_id = :user_id
          AND organization_id IS NULL  -- Only individual-owned worlds
    """, {"user_id": user_id})

    # Get 30-day watch stats
    thirty_days_ago = datetime.now() - timedelta(days=30)
    watch_stats = execute_single("""
        SELECT
            COALESCE(SUM(wwa.total_watch_seconds), 0) as watch_seconds_30d,
            COALESCE(MAX(wwa.unique_viewers), 0) as unique_viewers_30d
        FROM world_watch_aggregates wwa
        JOIN worlds w ON wwa.world_id = w.id
        WHERE w.creator_id = :user_id
          AND w.organization_id IS NULL
          AND wwa.period_type = 'daily'
          AND wwa.period_start >= :thirty_days_ago
    """, {"user_id": user_id, "thirty_days_ago": thirty_days_ago})

    # Get earnings summary
    earnings = await RevenueCalculationService.get_creator_earnings_summary(user_id)

    # Get top worlds by watch time
    top_worlds = execute_query("""
        SELECT
            w.id,
            w.title,
            w.poster_url,
            COALESCE(SUM(wwa.total_watch_seconds), 0) as watch_seconds_30d,
            (
                SELECT COALESCE(SUM(gross_earnings_cents), 0)
                FROM world_earnings
                WHERE world_id = w.id
                  AND period_start >= DATE_TRUNC('year', NOW())
            ) as ytd_earnings_cents
        FROM worlds w
        LEFT JOIN world_watch_aggregates wwa ON w.id = wwa.world_id
            AND wwa.period_type = 'daily'
            AND wwa.period_start >= :thirty_days_ago
        WHERE w.creator_id = :user_id
          AND w.organization_id IS NULL
        GROUP BY w.id, w.title, w.poster_url
        ORDER BY watch_seconds_30d DESC
        LIMIT 5
    """, {"user_id": user_id, "thirty_days_ago": thirty_days_ago})

    return CreatorDashboard(
        total_worlds=world_stats.get("total_worlds", 0) if world_stats else 0,
        total_followers=world_stats.get("total_followers", 0) if world_stats else 0,
        watch_minutes_30d=int((watch_stats.get("watch_seconds_30d", 0) or 0) / 60) if watch_stats else 0,
        unique_viewers_30d=watch_stats.get("unique_viewers_30d", 0) if watch_stats else 0,
        ytd_earnings_cents=earnings.get("ytd_earnings_cents", 0),
        pending_payout_cents=earnings.get("pending_payout_cents", 0),
        top_worlds=[
            {
                "id": w["id"],
                "title": w["title"],
                "poster_url": w.get("poster_url"),
                "watch_minutes_30d": int((w.get("watch_seconds_30d", 0) or 0) / 60),
                "ytd_earnings_cents": w.get("ytd_earnings_cents", 0)
            }
            for w in top_worlds
        ]
    )


@router.get("/creator/earnings", response_model=EarningsSummary)
async def get_creator_earnings(
    user = Depends(get_current_user)
):
    """
    Get earnings summary for the current creator.
    """
    user_id = user.get("profile_id") or user.get("id")
    earnings = await RevenueCalculationService.get_creator_earnings_summary(user_id)

    return EarningsSummary(
        worlds_with_earnings=earnings.get("worlds_with_earnings", 0),
        ytd_earnings_cents=earnings.get("ytd_earnings_cents", 0),
        lifetime_earnings_cents=earnings.get("lifetime_earnings_cents", 0),
        pending_payout_cents=earnings.get("pending_payout_cents", 0),
        paid_total_cents=earnings.get("paid_total_cents", 0),
        held_cents=earnings.get("held_cents", 0)
    )


# =============================================================================
# World Analytics
# =============================================================================

@router.get("/creator/worlds/{world_id}/analytics", response_model=WorldAnalytics)
async def get_world_analytics(
    world_id: str,
    days: int = Query(30, ge=1, le=365),
    user = Depends(get_current_user)
):
    """
    Get analytics for a specific world.

    Args:
        world_id: World UUID
        days: Number of days of history (default 30)
    """
    user_id = user.get("profile_id") or user.get("id")

    # Verify ownership
    world = execute_single("""
        SELECT id, title, creator_id, organization_id
        FROM worlds WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(404, "World not found")

    # Check access: creator or org member
    if world["creator_id"] != user_id:
        if world["organization_id"]:
            # Check org membership
            member = execute_single("""
                SELECT role FROM organization_members
                WHERE organization_id = :org_id AND user_id = :user_id AND status = 'active'
            """, {"org_id": world["organization_id"], "user_id": user_id})
            if not member:
                raise HTTPException(403, "Access denied")
        else:
            raise HTTPException(403, "Access denied")

    # Get watch stats
    start_date = datetime.now() - timedelta(days=days)
    watch_stats = await WatchAggregationService.get_world_watch_stats(
        world_id, period_type="daily", limit=days
    )

    # Get earnings history
    earnings_history = execute_query("""
        SELECT
            period_start,
            period_end,
            world_watch_seconds,
            platform_watch_seconds,
            watch_share_percentage,
            gross_earnings_cents,
            status
        FROM world_earnings
        WHERE world_id = :world_id
        ORDER BY period_start DESC
        LIMIT 12  -- Last 12 months
    """, {"world_id": world_id})

    # Calculate totals
    total_watch = sum(s.get("total_watch_seconds", 0) or 0 for s in watch_stats) if watch_stats else 0
    total_earnings = sum(e.get("gross_earnings_cents", 0) or 0 for e in earnings_history) if earnings_history else 0

    return WorldAnalytics(
        world_id=world_id,
        world_title=world["title"],
        watch_stats=[
            {
                "date": s["period_start"],
                "watch_seconds": s.get("total_watch_seconds", 0),
                "unique_viewers": s.get("unique_viewers", 0),
                "sessions": s.get("total_sessions", 0),
                "completed_episodes": s.get("completed_episodes", 0)
            }
            for s in watch_stats
        ],
        earnings_history=[
            {
                "period_start": e["period_start"],
                "period_end": e["period_end"],
                "watch_share_pct": float(e.get("watch_share_percentage", 0) or 0),
                "earnings_cents": e.get("gross_earnings_cents", 0),
                "status": e["status"]
            }
            for e in earnings_history
        ],
        total_watch_seconds=total_watch,
        total_earnings_cents=total_earnings
    )


# =============================================================================
# Payouts
# =============================================================================

@router.get("/creator/payouts", response_model=List[PayoutSummary])
async def list_creator_payouts(
    status: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    user = Depends(get_current_user)
):
    """
    List payout history for the current creator.
    """
    user_id = user.get("profile_id") or user.get("id")

    query = """
        SELECT
            cp.*,
            (SELECT COUNT(*) FROM payout_line_items WHERE payout_id = cp.id) as worlds_count
        FROM creator_payouts cp
        WHERE cp.payout_to_type = 'creator'
          AND cp.payout_to_id = :user_id
    """
    params = {"user_id": user_id, "limit": limit, "offset": offset}

    if status:
        query += " AND cp.status = :status"
        params["status"] = status

    query += " ORDER BY cp.period_start DESC LIMIT :limit OFFSET :offset"

    payouts = execute_query(query, params)

    return [
        PayoutSummary(
            id=p["id"],
            period_start=p["period_start"],
            period_end=p["period_end"],
            gross_amount_cents=p["gross_amount_cents"],
            net_amount_cents=p["net_amount_cents"],
            status=p["status"],
            worlds_count=p.get("worlds_count", 0),
            created_at=p["created_at"]
        )
        for p in payouts
    ]


@router.get("/creator/payouts/{payout_id}", response_model=PayoutDetail)
async def get_creator_payout_detail(
    payout_id: str,
    user = Depends(get_current_user)
):
    """
    Get detailed payout information including line items.
    """
    user_id = user.get("profile_id") or user.get("id")

    payout = await RevenueCalculationService.get_payout_details(payout_id)

    if not payout:
        raise HTTPException(404, "Payout not found")

    # Verify access
    if payout["payout_to_type"] == "creator" and payout["payout_to_id"] != user_id:
        raise HTTPException(403, "Access denied")
    elif payout["payout_to_type"] == "organization":
        # Check org membership
        member = execute_single("""
            SELECT role FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id AND status = 'active'
        """, {"org_id": payout["payout_to_id"], "user_id": user_id})
        if not member:
            raise HTTPException(403, "Access denied")

    return PayoutDetail(
        id=payout["id"],
        payout_to_type=payout["payout_to_type"],
        payout_to_id=payout["payout_to_id"],
        period_start=payout["period_start"],
        period_end=payout["period_end"],
        gross_amount_cents=payout["gross_amount_cents"],
        fees_cents=payout.get("fees_cents", 0),
        net_amount_cents=payout["net_amount_cents"],
        status=payout["status"],
        stripe_transfer_id=payout.get("stripe_transfer_id"),
        approved_by=payout.get("approved_by"),
        approved_at=payout.get("approved_at"),
        processed_at=payout.get("processed_at"),
        line_items=[
            {
                "world_id": li["world_id"],
                "world_title": li["world_title"],
                "amount_cents": li["amount_cents"],
                "watch_share_pct": float(li.get("watch_share_percentage", 0) or 0)
            }
            for li in payout.get("line_items", [])
        ]
    )


# =============================================================================
# Organization Dashboard
# =============================================================================

@router.get("/organizations/{org_id}/dashboard")
async def get_organization_dashboard(
    org_id: str,
    user = Depends(get_current_user)
):
    """
    Get dashboard for an organization.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Check membership
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id AND status = 'active'
    """, {"org_id": org_id, "user_id": user_id})

    if not member:
        raise HTTPException(403, "You are not a member of this organization")

    # Get org info
    org = execute_single("""
        SELECT id, name, slug, status FROM organizations WHERE id = :org_id
    """, {"org_id": org_id})

    if not org:
        raise HTTPException(404, "Organization not found")

    # Get world stats
    world_stats = execute_single("""
        SELECT
            COUNT(*) as total_worlds,
            COALESCE(SUM(followers_count), 0) as total_followers
        FROM worlds
        WHERE organization_id = :org_id
    """, {"org_id": org_id})

    # Get 30-day watch stats
    thirty_days_ago = datetime.now() - timedelta(days=30)
    watch_stats = execute_single("""
        SELECT
            COALESCE(SUM(wwa.total_watch_seconds), 0) as watch_seconds_30d,
            COALESCE(MAX(wwa.unique_viewers), 0) as unique_viewers_30d
        FROM world_watch_aggregates wwa
        JOIN worlds w ON wwa.world_id = w.id
        WHERE w.organization_id = :org_id
          AND wwa.period_type = 'daily'
          AND wwa.period_start >= :thirty_days_ago
    """, {"org_id": org_id, "thirty_days_ago": thirty_days_ago})

    # Get earnings summary
    earnings = await RevenueCalculationService.get_organization_earnings_summary(org_id)

    # Get top worlds
    top_worlds = execute_query("""
        SELECT
            w.id,
            w.title,
            w.poster_url,
            COALESCE(SUM(wwa.total_watch_seconds), 0) as watch_seconds_30d,
            (
                SELECT COALESCE(SUM(gross_earnings_cents), 0)
                FROM world_earnings
                WHERE world_id = w.id
                  AND period_start >= DATE_TRUNC('year', NOW())
            ) as ytd_earnings_cents
        FROM worlds w
        LEFT JOIN world_watch_aggregates wwa ON w.id = wwa.world_id
            AND wwa.period_type = 'daily'
            AND wwa.period_start >= :thirty_days_ago
        WHERE w.organization_id = :org_id
        GROUP BY w.id, w.title, w.poster_url
        ORDER BY watch_seconds_30d DESC
        LIMIT 5
    """, {"org_id": org_id, "thirty_days_ago": thirty_days_ago})

    return {
        "organization": {
            "id": org["id"],
            "name": org["name"],
            "slug": org["slug"],
            "status": org["status"]
        },
        "stats": {
            "total_worlds": world_stats.get("total_worlds", 0) if world_stats else 0,
            "total_followers": world_stats.get("total_followers", 0) if world_stats else 0,
            "watch_minutes_30d": int((watch_stats.get("watch_seconds_30d", 0) or 0) / 60) if watch_stats else 0,
            "unique_viewers_30d": watch_stats.get("unique_viewers_30d", 0) if watch_stats else 0
        },
        "earnings": {
            "ytd_earnings_cents": earnings.get("ytd_earnings_cents", 0),
            "lifetime_earnings_cents": earnings.get("lifetime_earnings_cents", 0),
            "pending_payout_cents": earnings.get("pending_payout_cents", 0)
        },
        "top_worlds": [
            {
                "id": w["id"],
                "title": w["title"],
                "poster_url": w.get("poster_url"),
                "watch_minutes_30d": int((w.get("watch_seconds_30d", 0) or 0) / 60),
                "ytd_earnings_cents": w.get("ytd_earnings_cents", 0)
            }
            for w in top_worlds
        ]
    }


@router.get("/organizations/{org_id}/payouts", response_model=List[PayoutSummary])
async def list_organization_payouts(
    org_id: str,
    status: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = 0,
    user = Depends(get_current_user)
):
    """
    List payout history for an organization.

    Requires finance, admin, or owner role.
    """
    user_id = user.get("profile_id") or user.get("id")

    # Check membership with finance access
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id AND status = 'active'
    """, {"org_id": org_id, "user_id": user_id})

    if not member or member["role"] not in ["owner", "admin", "finance"]:
        raise HTTPException(403, "You need finance access to view payouts")

    query = """
        SELECT
            cp.*,
            (SELECT COUNT(*) FROM payout_line_items WHERE payout_id = cp.id) as worlds_count
        FROM creator_payouts cp
        WHERE cp.payout_to_type = 'organization'
          AND cp.payout_to_id = :org_id
    """
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        query += " AND cp.status = :status"
        params["status"] = status

    query += " ORDER BY cp.period_start DESC LIMIT :limit OFFSET :offset"

    payouts = execute_query(query, params)

    return [
        PayoutSummary(
            id=p["id"],
            period_start=p["period_start"],
            period_end=p["period_end"],
            gross_amount_cents=p["gross_amount_cents"],
            net_amount_cents=p["net_amount_cents"],
            status=p["status"],
            worlds_count=p.get("worlds_count", 0),
            created_at=p["created_at"]
        )
        for p in payouts
    ]


# =============================================================================
# Admin Endpoints - Watch Aggregation & Revenue
# =============================================================================

@router.post("/admin/aggregation/hourly")
async def trigger_hourly_aggregation(
    hour: Optional[str] = None,  # ISO format datetime
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Trigger hourly watch time aggregation.

    Admin only. If hour not specified, aggregates the previous hour.
    """
    from datetime import datetime

    if hour:
        hour_start = datetime.fromisoformat(hour)
    else:
        # Previous hour
        now = datetime.now()
        hour_start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)

    result = await WatchAggregationService.aggregate_hourly_watch_time(hour_start)

    return result


@router.post("/admin/aggregation/daily")
async def trigger_daily_aggregation(
    target_date: Optional[str] = None,  # ISO format date
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Trigger daily watch time aggregation.

    Admin only. If date not specified, aggregates yesterday.
    """
    if target_date:
        dt = date.fromisoformat(target_date)
    else:
        dt = date.today() - timedelta(days=1)

    result = await WatchAggregationService.aggregate_daily_watch_time(dt)

    return result


@router.post("/admin/aggregation/monthly")
async def trigger_monthly_aggregation(
    year: int,
    month: int,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Trigger monthly watch time aggregation.

    Admin only.
    """
    result = await WatchAggregationService.aggregate_monthly_watch_time(year, month)

    return result


@router.post("/admin/aggregation/backfill")
async def trigger_backfill(
    start_date: str,
    end_date: str,
    period_type: str = "daily",
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Backfill watch time aggregates for a date range.

    Admin only.
    """
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)

    result = await WatchAggregationService.backfill_aggregates(start, end, period_type)

    return result


@router.post("/admin/revenue/record")
async def record_subscription_revenue_endpoint(
    period_start: str,
    period_end: str,
    period_type: str,
    gross_revenue_cents: int,
    refunds_cents: int = 0,
    chargebacks_cents: int = 0,
    stripe_fees_cents: int = 0,
    total_subscribers: int = 0,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Record subscription revenue for a period.

    Admin only. Usually called after syncing with Stripe.
    """
    result = await RevenueCalculationService.record_subscription_revenue(
        period_start=datetime.fromisoformat(period_start),
        period_end=datetime.fromisoformat(period_end),
        period_type=period_type,
        gross_revenue_cents=gross_revenue_cents,
        refunds_cents=refunds_cents,
        chargebacks_cents=chargebacks_cents,
        stripe_fees_cents=stripe_fees_cents,
        total_subscribers=total_subscribers,
    )

    return result


@router.post("/admin/revenue/calculate-earnings")
async def calculate_monthly_earnings_endpoint(
    year: int,
    month: int,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Calculate monthly earnings for all worlds.

    Admin only.
    """
    result = await RevenueCalculationService.calculate_monthly_earnings(year, month)

    return result


@router.post("/admin/revenue/generate-payouts")
async def generate_monthly_payouts_endpoint(
    year: int,
    month: int,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Generate payout records from calculated earnings.

    Admin only.
    """
    result = await RevenueCalculationService.generate_monthly_payouts(year, month)

    return result


@router.post("/admin/payouts/{payout_id}/approve")
async def approve_payout_endpoint(
    payout_id: str,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Approve a pending payout for processing.

    Admin only.
    """
    user_id = profile.get("id")

    result = await RevenueCalculationService.approve_payout(payout_id, user_id)

    if not result:
        raise HTTPException(404, "Payout not found or already processed")

    return {"message": "Payout approved", "payout": result}


@router.get("/admin/platform-stats")
async def get_platform_stats(
    days: int = Query(30, ge=1, le=365),
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Get platform-wide watch and revenue statistics.

    Admin only.
    """
    platform_totals = await WatchAggregationService.get_platform_totals(
        period_type="daily", limit=days
    )

    # Get revenue stats
    revenue_stats = execute_query("""
        SELECT
            period_start,
            gross_revenue_cents,
            net_revenue_cents,
            creator_pool_cents,
            total_subscribers
        FROM subscription_revenue
        WHERE period_type = 'monthly'
        ORDER BY period_start DESC
        LIMIT 12
    """, {})

    # Get top worlds
    start_date = datetime.now() - timedelta(days=days)
    top_worlds = await WatchAggregationService.get_top_worlds_by_watch_time(
        start_date, datetime.now(), limit=10
    )

    return {
        "daily_watch_stats": platform_totals,
        "monthly_revenue": revenue_stats,
        "top_worlds": top_worlds
    }
