"""
Lodges API
Phase 3B: Lodge programming, VOD shelves, and metrics endpoints.

Provides endpoints for:
- Lodge metrics and tier information
- VOD shelf management (featured Worlds)
- Block proposal workflow
- Lodge channel management
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single
from app.core.logging import get_logger
from app.services.lodge_metrics_service import LodgeMetricsService

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class FeatureWorldRequest(BaseModel):
    """Request to feature a World on lodge shelf."""
    world_id: str
    feature_reason: Optional[str] = None
    is_highlighted: bool = False
    highlight_text: Optional[str] = None
    display_order: int = Field(default=0, ge=0)


class UpdateShelfOrderRequest(BaseModel):
    """Request to update shelf display order."""
    world_orders: List[Dict[str, Any]]


class BlockProposalCreate(BaseModel):
    """Create block proposal request."""
    block_name: str = Field(..., min_length=3, max_length=200)
    block_description: Optional[str] = None
    block_theme: Optional[str] = None
    proposed_items: List[Dict[str, Any]] = Field(..., min_items=1)
    proposed_schedule: Optional[Dict[str, Any]] = None


class ProposalReviewRequest(BaseModel):
    """Review block proposal request."""
    action: str = Field(..., pattern="^(approve|reject)$")
    review_notes: Optional[str] = None
    rejection_reason: Optional[str] = None


class LodgeMetricsResponse(BaseModel):
    """Lodge metrics response."""
    lodge_id: str
    lodge_name: Optional[str]
    lodge_city: Optional[str]
    lodge_region: Optional[str]
    current_tier: str
    tier_score: int
    total_members: int
    active_members: int
    worlds_count: int
    total_watch_seconds: int
    total_earnings_cents: int
    can_propose_blocks: bool
    has_lodge_channel: bool


class ShelfWorldResponse(BaseModel):
    """World on lodge shelf response."""
    world_id: str
    world_title: str
    world_slug: str
    logline: Optional[str]
    cover_art_url: Optional[str]
    content_format: Optional[str]
    display_order: int
    is_highlighted: bool
    highlight_text: Optional[str]
    feature_reason: Optional[str]
    follower_count: int
    monthly_watch_seconds: int


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(current_user: dict) -> str:
    """Resolve profile ID from Cognito user."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_id = :cognito_id",
        {"cognito_id": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile["id"]


async def check_lodge_officer(lodge_id: str, profile_id: str) -> bool:
    """Check if user is a lodge officer."""
    membership = execute_single("""
        SELECT is_officer
        FROM order_lodge_memberships
        WHERE lodge_id = :lodge_id
          AND user_id = :profile_id
          AND status = 'active'
    """, {"lodge_id": lodge_id, "profile_id": profile_id})

    return membership is not None and membership.get("is_officer")


async def check_lodge_member(lodge_id: str, profile_id: str) -> bool:
    """Check if user is a lodge member."""
    membership = execute_single("""
        SELECT id
        FROM order_lodge_memberships
        WHERE lodge_id = :lodge_id
          AND user_id = :profile_id
          AND status = 'active'
    """, {"lodge_id": lodge_id, "profile_id": profile_id})

    return membership is not None


# =============================================================================
# Lodge Metrics Endpoints
# =============================================================================

@router.get("/lodges/{lodge_id}/metrics", response_model=LodgeMetricsResponse)
async def get_lodge_metrics(
    lodge_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get current metrics and tier for a lodge.

    Available to all authenticated users.
    """
    metrics = await LodgeMetricsService.get_lodge_metrics(lodge_id)

    if not metrics:
        # Try to compute if not exists
        try:
            metrics = await LodgeMetricsService.compute_lodge_metrics(lodge_id)
        except Exception:
            raise HTTPException(status_code=404, detail="Lodge not found")

    return metrics


@router.get("/lodges/rankings")
async def get_lodge_rankings(
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all lodges ranked by tier and score.

    Returns lodges sorted by flagship > active > emerging, then by score.
    """
    lodges = await LodgeMetricsService.get_all_lodge_rankings(limit)

    return {
        "lodges": lodges,
        "count": len(lodges)
    }


@router.post("/lodges/{lodge_id}/metrics/compute")
async def compute_lodge_metrics(
    lodge_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Trigger metrics computation for a lodge.

    Admin only.
    """
    metrics = await LodgeMetricsService.compute_lodge_metrics(lodge_id)

    return {"status": "computed", "metrics": metrics}


@router.post("/lodges/metrics/compute-all")
async def compute_all_lodge_metrics(
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Trigger metrics computation for all active lodges.

    Admin only. This is a batch operation.
    """
    results = await LodgeMetricsService.compute_all_lodge_metrics()

    return results


# =============================================================================
# VOD Shelf Endpoints
# =============================================================================

@router.get("/lodges/{lodge_id}/shelf", response_model=List[ShelfWorldResponse])
async def get_lodge_shelf(
    lodge_id: str,
    limit: int = Query(20, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the VOD shelf for a lodge.

    Returns featured Worlds in display order.
    Available to all authenticated users.
    """
    shelf = await LodgeMetricsService.get_lodge_shelf(lodge_id, limit)

    return shelf


@router.post("/lodges/{lodge_id}/shelf/feature")
async def feature_world_on_shelf(
    lodge_id: str,
    data: FeatureWorldRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a World to the lodge's featured shelf.

    Lodge officers only.
    """
    profile_id = await get_profile_id(current_user)

    # Check if user is lodge officer
    is_officer = await check_lodge_officer(lodge_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not is_officer and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only lodge officers can manage the shelf"
        )

    try:
        feature = await LodgeMetricsService.feature_world(
            lodge_id=lodge_id,
            world_id=data.world_id,
            featured_by=profile_id,
            feature_reason=data.feature_reason,
            is_highlighted=data.is_highlighted,
            highlight_text=data.highlight_text,
            display_order=data.display_order
        )

        return {"status": "featured", "feature": feature}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/lodges/{lodge_id}/shelf/{world_id}")
async def unfeature_world(
    lodge_id: str,
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Remove a World from the lodge's featured shelf.

    Lodge officers only.
    """
    profile_id = await get_profile_id(current_user)

    is_officer = await check_lodge_officer(lodge_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not is_officer and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only lodge officers can manage the shelf"
        )

    await LodgeMetricsService.unfeature_world(lodge_id, world_id)

    return {"status": "unfeatured"}


@router.put("/lodges/{lodge_id}/shelf/order")
async def update_shelf_order(
    lodge_id: str,
    data: UpdateShelfOrderRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update display order for shelf items.

    Lodge officers only.
    """
    profile_id = await get_profile_id(current_user)

    is_officer = await check_lodge_officer(lodge_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not is_officer and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only lodge officers can manage the shelf"
        )

    await LodgeMetricsService.update_shelf_order(lodge_id, data.world_orders)

    return {"status": "updated"}


# =============================================================================
# Block Proposal Endpoints
# =============================================================================

@router.get("/lodges/{lodge_id}/proposals")
async def get_lodge_proposals(
    lodge_id: str,
    status: Optional[str] = Query(None, pattern="^(draft|submitted|under_review|approved|rejected|cancelled)$"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get block proposals for a lodge.

    Lodge members can view their lodge's proposals.
    """
    profile_id = await get_profile_id(current_user)

    is_member = await check_lodge_member(lodge_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not is_member and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only lodge members can view proposals"
        )

    proposals = await LodgeMetricsService.get_lodge_proposals(lodge_id, status)

    return {"proposals": proposals, "count": len(proposals)}


@router.post("/lodges/{lodge_id}/proposals", status_code=201)
async def create_block_proposal(
    lodge_id: str,
    data: BlockProposalCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new block proposal for the lodge channel.

    Lodge officers only. Lodge must have block proposal privileges.
    """
    profile_id = await get_profile_id(current_user)

    is_officer = await check_lodge_officer(lodge_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not is_officer and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only lodge officers can create proposals"
        )

    try:
        proposal = await LodgeMetricsService.create_block_proposal(
            lodge_id=lodge_id,
            block_name=data.block_name,
            block_description=data.block_description,
            block_theme=data.block_theme,
            proposed_items=data.proposed_items,
            proposed_schedule=data.proposed_schedule,
            submitted_by=profile_id
        )

        return {"status": "created", "proposal": proposal}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/lodges/proposals/pending")
async def get_pending_proposals(
    limit: int = Query(50, le=100),
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Get all pending block proposals (admin review queue).

    Admin only.
    """
    proposals = await LodgeMetricsService.get_pending_proposals(limit)

    return {"proposals": proposals, "count": len(proposals)}


@router.post("/lodges/proposals/{proposal_id}/review")
async def review_proposal(
    proposal_id: str,
    data: ProposalReviewRequest,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Review and approve/reject a block proposal.

    Admin only.
    """
    profile_id = await get_profile_id(current_user)

    if data.action == "reject" and not data.rejection_reason:
        raise HTTPException(
            status_code=400,
            detail="Rejection reason is required"
        )

    try:
        proposal = await LodgeMetricsService.review_proposal(
            proposal_id=proposal_id,
            action=data.action,
            reviewed_by=profile_id,
            review_notes=data.review_notes,
            rejection_reason=data.rejection_reason
        )

        if not proposal:
            raise HTTPException(
                status_code=404,
                detail="Proposal not found or already reviewed"
            )

        return {"status": data.action + "d", "proposal": proposal}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Lodge Channel Endpoints
# =============================================================================

@router.get("/lodges/{lodge_id}/channel")
async def get_lodge_channel(
    lodge_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the lodge's linear channel if it exists.

    Lodge members can view their lodge's channel.
    """
    profile_id = await get_profile_id(current_user)

    is_member = await check_lodge_member(lodge_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not is_member and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only lodge members can view the lodge channel"
        )

    channel = execute_single("""
        SELECT lc.*, ol.name as lodge_name
        FROM linear_channels lc
        JOIN order_lodges ol ON lc.lodge_id = ol.id
        WHERE lc.lodge_id = :lodge_id
          AND lc.is_lodge_channel = true
    """, {"lodge_id": lodge_id})

    if not channel:
        return {"channel": None, "has_channel": False}

    return {"channel": dict(channel), "has_channel": True}


@router.get("/lodges/{lodge_id}/channel/schedule")
async def get_lodge_channel_schedule(
    lodge_id: str,
    days: int = Query(7, ge=1, le=14),
    current_user: dict = Depends(get_current_user)
):
    """
    Get the schedule for a lodge's linear channel.

    Lodge members can view their lodge's schedule.
    """
    profile_id = await get_profile_id(current_user)

    is_member = await check_lodge_member(lodge_id, profile_id)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if not is_member and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only lodge members can view the lodge schedule"
        )

    # Get channel
    channel = execute_single("""
        SELECT id FROM linear_channels
        WHERE lodge_id = :lodge_id AND is_lodge_channel = true
    """, {"lodge_id": lodge_id})

    if not channel:
        return {"schedule": [], "has_channel": False}

    # Get schedule entries
    schedule = execute_query("""
        SELECT
            cse.*,
            b.name as block_name,
            b.description as block_description,
            b.theme as block_theme,
            b.computed_duration_seconds
        FROM channel_schedule_entries cse
        JOIN blocks b ON cse.block_id = b.id
        WHERE cse.channel_id = :channel_id
          AND cse.start_time_utc >= NOW()
          AND cse.start_time_utc <= NOW() + :days::interval
          AND cse.status != 'cancelled'
        ORDER BY cse.start_time_utc
    """, {"channel_id": channel["id"], "days": f"{days} days"})

    return {"schedule": [dict(s) for s in schedule], "has_channel": True}


# =============================================================================
# Browse Endpoint for Lodge Shelves
# =============================================================================

@router.get("/browse/lodge-shelves")
async def get_all_lodge_shelves(
    limit_per_lodge: int = Query(10, le=20),
    current_user: dict = Depends(get_current_user)
):
    """
    Get VOD shelves from all active lodges for homepage display.

    Returns shelves from flagship and active tier lodges.
    """
    profile_id = await get_profile_id(current_user)

    # Get user's lodge membership for prioritization
    user_lodge = execute_single("""
        SELECT lodge_id
        FROM order_lodge_memberships
        WHERE user_id = :profile_id AND status = 'active'
    """, {"profile_id": profile_id})

    user_lodge_id = user_lodge["lodge_id"] if user_lodge else None

    # Get lodges with shelves
    lodges = execute_query("""
        SELECT
            ol.id as lodge_id,
            ol.name as lodge_name,
            ol.city as lodge_city,
            ol.current_tier,
            (ol.id = :user_lodge_id) as is_user_lodge
        FROM order_lodges ol
        WHERE ol.status = 'active'
          AND ol.current_tier IN ('flagship', 'active')
          AND EXISTS (
              SELECT 1 FROM lodge_world_features lwf
              WHERE lwf.lodge_id = ol.id AND lwf.is_active = true
          )
        ORDER BY
            (ol.id = :user_lodge_id) DESC,
            CASE ol.current_tier WHEN 'flagship' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
            ol.name
        LIMIT 10
    """, {"user_lodge_id": user_lodge_id})

    # Get shelf for each lodge
    shelves = []
    for lodge in lodges:
        worlds = await LodgeMetricsService.get_lodge_shelf(
            lodge["lodge_id"],
            limit=limit_per_lodge
        )
        if worlds:
            shelves.append({
                "lodge_id": lodge["lodge_id"],
                "lodge_name": lodge["lodge_name"],
                "lodge_city": lodge["lodge_city"],
                "tier": lodge["current_tier"],
                "is_user_lodge": lodge["is_user_lodge"],
                "worlds": worlds
            })

    return {"shelves": shelves}
