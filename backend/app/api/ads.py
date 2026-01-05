"""
Ads API
Phase 2B: Endpoints for ad decision and impression tracking.

This module provides:
- Ad break endpoint for requesting ads (internal JSON API, not VAST)
- Impression recording endpoints
- Click and completion tracking

INTEGRATION WITH LINEAR CHANNELS:
1. Client plays linear channel content
2. At ad break (block boundary, ad_placeholder item), client calls POST /ads/break
3. Response includes selected creatives with asset URLs
4. Client plays ads sequentially
5. Client calls POST /ads/impressions to record each ad view
6. Client calls POST /ads/click or POST /ads/complete as appropriate

This is an internal API for SWN clients. For third-party VAST integration,
a separate VAST endpoint would be built on top of AdDecisionService.
"""

import logging
from datetime import datetime
from typing import Optional, List
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user_optional, get_user_profile, require_admin
from app.core.database import execute_query, execute_single
from app.services.ad_decision_service import AdDecisionService

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class AdBreakRequest(BaseModel):
    """Request for ads to fill an ad break."""
    placement_type: str = Field(..., description="Type: linear_preroll, linear_midroll, vod_preroll, etc.")
    channel_id: Optional[str] = Field(None, description="Linear channel ID if applicable")
    world_id: Optional[str] = Field(None, description="World ID if applicable")
    block_id: Optional[str] = Field(None, description="Block ID if applicable")
    episode_id: Optional[str] = Field(None, description="Episode ID if applicable")
    max_ads: int = Field(2, ge=1, le=5, description="Maximum number of ads to return")
    max_duration_seconds: int = Field(60, ge=15, le=180, description="Maximum total duration")
    device_type: Optional[str] = Field(None, description="Device type: web, ios, android, tv")
    region: Optional[str] = Field(None, description="Region code for targeting")


class AdCreativeResponse(BaseModel):
    """A selected ad creative for playback."""
    line_item_id: str
    creative_id: str
    creative_type: str
    asset_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: int
    headline: Optional[str] = None
    call_to_action: Optional[str] = None
    destination_url: Optional[str] = None
    tracking_pixel_url: Optional[str] = None
    advertiser_name: Optional[str] = None
    campaign_name: Optional[str] = None


class AdBreakResponse(BaseModel):
    """Response containing selected ads for a break."""
    ads: List[AdCreativeResponse]
    total_duration_seconds: int
    break_id: Optional[str] = None  # For tracking the break as a unit


class ImpressionRequest(BaseModel):
    """Record an ad impression."""
    line_item_id: str
    creative_id: str
    campaign_id: str
    advertiser_id: str
    placement_type: str
    channel_id: Optional[str] = None
    world_id: Optional[str] = None
    block_id: Optional[str] = None
    episode_id: Optional[str] = None
    session_id: Optional[str] = None
    device_type: Optional[str] = None
    device_id_hash: Optional[str] = None
    region: Optional[str] = None
    position_in_break: Optional[int] = None
    cost_cents: Optional[int] = None


class ImpressionResponse(BaseModel):
    impression_id: str


class ClickRequest(BaseModel):
    impression_id: str
    click_url: Optional[str] = None


class CompletionRequest(BaseModel):
    impression_id: str
    duration_watched_seconds: int


class BatchImpressionRequest(BaseModel):
    """Record multiple impressions at once (e.g., after an ad break)."""
    impressions: List[ImpressionRequest]


class BatchImpressionResponse(BaseModel):
    impression_ids: List[str]
    count: int


# =============================================================================
# AD BREAK ENDPOINT
# =============================================================================

@router.post("/break", response_model=AdBreakResponse, tags=["Ads - Decision"])
async def get_ads_for_break(
    request: AdBreakRequest,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Request ads to fill an ad break.

    This is the primary endpoint for ad serving. The client provides context
    about where the ad will be shown, and receives a list of creatives to play.

    Premium and Order members may receive fewer ads or sponsor messages only.

    Response includes:
    - List of ad creatives with asset URLs and durations
    - Total duration for the break
    - Tracking information for impression reporting
    """
    # Determine viewer role for ad load reduction
    viewer_role = 'free'
    viewer_id = None

    if user:
        profile = execute_single(
            "SELECT id, is_order_member, is_premium FROM profiles WHERE cognito_id = :cid",
            {"cid": user.get("sub")}
        )
        if profile:
            viewer_id = str(profile['id'])
            if profile.get('is_order_member'):
                viewer_role = 'order_member'
            elif profile.get('is_premium'):
                viewer_role = 'premium'

    break_context = {
        'placement_type': request.placement_type,
        'channel_id': request.channel_id,
        'world_id': request.world_id,
        'block_id': request.block_id,
        'episode_id': request.episode_id,
        'max_ads': request.max_ads,
        'max_duration_seconds': request.max_duration_seconds,
        'viewer_id': viewer_id,
        'viewer_role': viewer_role,
        'region': request.region,
        'timestamp': datetime.now(ZoneInfo('UTC'))
    }

    selected_ads = await AdDecisionService.select_ads_for_break(break_context)

    # Transform to response format
    ad_responses = []
    for ad in selected_ads:
        ad_responses.append(AdCreativeResponse(
            line_item_id=ad['line_item_id'],
            creative_id=ad['creative_id'],
            creative_type=ad['creative_type'],
            asset_url=ad.get('asset_url'),
            thumbnail_url=ad.get('thumbnail_url'),
            duration_seconds=ad['duration_seconds'],
            headline=ad.get('headline'),
            call_to_action=ad.get('call_to_action'),
            destination_url=ad.get('destination_url'),
            tracking_pixel_url=ad.get('tracking_pixel_url'),
            advertiser_name=ad.get('advertiser_name'),
            campaign_name=ad.get('campaign_name')
        ))

    total_duration = sum(ad.duration_seconds for ad in ad_responses)

    return AdBreakResponse(
        ads=ad_responses,
        total_duration_seconds=total_duration,
        break_id=None  # Could generate a break ID for grouping impressions
    )


# =============================================================================
# IMPRESSION TRACKING
# =============================================================================

@router.post("/impressions", response_model=ImpressionResponse, tags=["Ads - Tracking"])
async def record_impression(
    request: ImpressionRequest,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Record that an ad was shown.

    Should be called when an ad starts playing. This records the impression
    for billing and analytics purposes.

    The response includes an impression_id that should be used for
    subsequent click or completion tracking.
    """
    viewer_id = None
    if user:
        profile = execute_single(
            "SELECT id FROM profiles WHERE cognito_id = :cid",
            {"cid": user.get("sub")}
        )
        if profile:
            viewer_id = str(profile['id'])

    impression_data = {
        'line_item_id': request.line_item_id,
        'creative_id': request.creative_id,
        'campaign_id': request.campaign_id,
        'advertiser_id': request.advertiser_id,
        'placement_type': request.placement_type,
        'channel_id': request.channel_id,
        'world_id': request.world_id,
        'block_id': request.block_id,
        'episode_id': request.episode_id,
        'viewer_id': viewer_id,
        'session_id': request.session_id,
        'device_type': request.device_type,
        'device_id_hash': request.device_id_hash,
        'region': request.region,
        'position_in_break': request.position_in_break,
        'cost_cents': request.cost_cents or 0
    }

    impression_id = await AdDecisionService.record_impression(impression_data)

    return ImpressionResponse(impression_id=impression_id)


@router.post("/impressions/batch", response_model=BatchImpressionResponse, tags=["Ads - Tracking"])
async def record_impressions_batch(
    request: BatchImpressionRequest,
    user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Record multiple ad impressions at once.

    Useful for reporting all ads from an ad break in a single request.
    """
    viewer_id = None
    if user:
        profile = execute_single(
            "SELECT id FROM profiles WHERE cognito_id = :cid",
            {"cid": user.get("sub")}
        )
        if profile:
            viewer_id = str(profile['id'])

    impression_ids = []
    for imp in request.impressions:
        impression_data = {
            'line_item_id': imp.line_item_id,
            'creative_id': imp.creative_id,
            'campaign_id': imp.campaign_id,
            'advertiser_id': imp.advertiser_id,
            'placement_type': imp.placement_type,
            'channel_id': imp.channel_id,
            'world_id': imp.world_id,
            'block_id': imp.block_id,
            'episode_id': imp.episode_id,
            'viewer_id': viewer_id,
            'session_id': imp.session_id,
            'device_type': imp.device_type,
            'device_id_hash': imp.device_id_hash,
            'region': imp.region,
            'position_in_break': imp.position_in_break,
            'cost_cents': imp.cost_cents or 0
        }

        impression_id = await AdDecisionService.record_impression(impression_data)
        impression_ids.append(impression_id)

    return BatchImpressionResponse(
        impression_ids=impression_ids,
        count=len(impression_ids)
    )


@router.post("/click", tags=["Ads - Tracking"])
async def record_click(request: ClickRequest):
    """
    Record a click on an ad.

    Should be called when a user clicks on an ad's call-to-action.
    """
    success = await AdDecisionService.record_click(
        impression_id=request.impression_id,
        click_url=request.click_url
    )

    if not success:
        raise HTTPException(status_code=404, detail="Impression not found")

    return {"status": "recorded"}


@router.post("/complete", tags=["Ads - Tracking"])
async def record_completion(request: CompletionRequest):
    """
    Record that an ad was watched to completion.

    Should be called when an ad finishes playing (not skipped).
    """
    success = await AdDecisionService.record_completion(
        impression_id=request.impression_id,
        duration_watched_seconds=request.duration_watched_seconds
    )

    if not success:
        raise HTTPException(status_code=404, detail="Impression not found")

    return {"status": "recorded"}


# =============================================================================
# ADMIN ENDPOINTS - CREATIVE MANAGEMENT
# =============================================================================

@router.get("/admin/creatives", tags=["Ads - Admin"])
async def list_creatives(
    advertiser_id: Optional[str] = Query(None),
    creative_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    profile: dict = Depends(require_admin)
):
    """List ad creatives with optional filters (admin only)."""
    conditions = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if advertiser_id:
        conditions.append("ac.advertiser_id = :advertiser_id")
        params["advertiser_id"] = advertiser_id
    if creative_type:
        conditions.append("ac.creative_type = :creative_type")
        params["creative_type"] = creative_type
    if status:
        conditions.append("ac.status = :status")
        params["status"] = status

    creatives = execute_query(f"""
        SELECT
            ac.*,
            a.name as advertiser_name
        FROM ad_creatives ac
        JOIN advertisers a ON ac.advertiser_id = a.id
        WHERE {' AND '.join(conditions)}
        ORDER BY ac.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(c) for c in creatives]


@router.get("/admin/creatives/{creative_id}", tags=["Ads - Admin"])
async def get_creative(
    creative_id: str,
    profile: dict = Depends(require_admin)
):
    """Get creative details (admin only)."""
    creative = execute_single("""
        SELECT
            ac.*,
            a.name as advertiser_name
        FROM ad_creatives ac
        JOIN advertisers a ON ac.advertiser_id = a.id
        WHERE ac.id = :creative_id
    """, {"creative_id": creative_id})

    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")

    return dict(creative)


@router.put("/admin/creatives/{creative_id}/approve", tags=["Ads - Admin"])
async def approve_creative(
    creative_id: str,
    profile: dict = Depends(require_admin)
):
    """Approve a creative for serving (admin only)."""
    creative = execute_single("""
        UPDATE ad_creatives
        SET status = 'approved', reviewed_by = :reviewer, reviewed_at = NOW()
        WHERE id = :creative_id
        RETURNING *
    """, {"creative_id": creative_id, "reviewer": profile['id']})

    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")

    logger.info("creative_approved", creative_id=creative_id, approved_by=profile['id'])

    return dict(creative)


@router.put("/admin/creatives/{creative_id}/reject", tags=["Ads - Admin"])
async def reject_creative(
    creative_id: str,
    reason: str = Query(..., description="Reason for rejection"),
    profile: dict = Depends(require_admin)
):
    """Reject a creative (admin only)."""
    creative = execute_single("""
        UPDATE ad_creatives
        SET status = 'rejected', review_notes = :reason, reviewed_by = :reviewer, reviewed_at = NOW()
        WHERE id = :creative_id
        RETURNING *
    """, {"creative_id": creative_id, "reason": reason, "reviewer": profile['id']})

    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")

    logger.info("creative_rejected", creative_id=creative_id, rejected_by=profile['id'])

    return dict(creative)


# =============================================================================
# ADMIN ENDPOINTS - CAMPAIGN MANAGEMENT
# =============================================================================

@router.get("/admin/campaigns", tags=["Ads - Admin"])
async def list_campaigns(
    advertiser_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    profile: dict = Depends(require_admin)
):
    """List ad campaigns with optional filters (admin only)."""
    conditions = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if advertiser_id:
        conditions.append("c.advertiser_id = :advertiser_id")
        params["advertiser_id"] = advertiser_id
    if status:
        conditions.append("c.status = :status")
        params["status"] = status

    campaigns = execute_query(f"""
        SELECT
            c.*,
            a.name as advertiser_name,
            (SELECT COUNT(*) FROM ad_line_items WHERE campaign_id = c.id) as line_item_count
        FROM ad_campaigns c
        JOIN advertisers a ON c.advertiser_id = a.id
        WHERE {' AND '.join(conditions)}
        ORDER BY c.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(c) for c in campaigns]


@router.get("/admin/campaigns/{campaign_id}", tags=["Ads - Admin"])
async def get_campaign_details(
    campaign_id: str,
    profile: dict = Depends(require_admin)
):
    """Get campaign details with stats (admin only)."""
    stats = await AdDecisionService.get_campaign_stats(campaign_id)

    if 'error' in stats:
        raise HTTPException(status_code=404, detail=stats['error'])

    return stats


@router.put("/admin/campaigns/{campaign_id}/approve", tags=["Ads - Admin"])
async def approve_campaign(
    campaign_id: str,
    profile: dict = Depends(require_admin)
):
    """Approve a campaign to run (admin only)."""
    campaign = execute_single("""
        UPDATE ad_campaigns
        SET status = 'scheduled', approved_by = :approver, approved_at = NOW()
        WHERE id = :campaign_id AND status = 'pending'
        RETURNING *
    """, {"campaign_id": campaign_id, "approver": profile['id']})

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found or not pending")

    logger.info("campaign_approved", campaign_id=campaign_id, approved_by=profile['id'])

    return dict(campaign)


@router.put("/admin/campaigns/{campaign_id}/pause", tags=["Ads - Admin"])
async def pause_campaign(
    campaign_id: str,
    profile: dict = Depends(require_admin)
):
    """Pause an active campaign (admin only)."""
    campaign = execute_single("""
        UPDATE ad_campaigns
        SET status = 'paused', updated_at = NOW()
        WHERE id = :campaign_id AND status = 'active'
        RETURNING *
    """, {"campaign_id": campaign_id})

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found or not active")

    logger.info("campaign_paused", campaign_id=campaign_id, paused_by=profile['id'])

    return dict(campaign)


@router.put("/admin/campaigns/{campaign_id}/activate", tags=["Ads - Admin"])
async def activate_campaign(
    campaign_id: str,
    profile: dict = Depends(require_admin)
):
    """Activate a scheduled or paused campaign (admin only)."""
    campaign = execute_single("""
        UPDATE ad_campaigns
        SET status = 'active', updated_at = NOW()
        WHERE id = :campaign_id AND status IN ('scheduled', 'paused')
        RETURNING *
    """, {"campaign_id": campaign_id})

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found or cannot be activated")

    logger.info("campaign_activated", campaign_id=campaign_id, activated_by=profile['id'])

    return dict(campaign)


# =============================================================================
# ADMIN ENDPOINTS - LINE ITEM MANAGEMENT
# =============================================================================

@router.get("/admin/line-items", tags=["Ads - Admin"])
async def list_line_items(
    campaign_id: Optional[str] = Query(None),
    placement_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    profile: dict = Depends(require_admin)
):
    """List ad line items with optional filters (admin only)."""
    conditions = ["1=1"]
    params = {"limit": limit, "offset": offset}

    if campaign_id:
        conditions.append("li.campaign_id = :campaign_id")
        params["campaign_id"] = campaign_id
    if placement_type:
        conditions.append("li.placement_type = :placement_type")
        params["placement_type"] = placement_type
    if status:
        conditions.append("li.status = :status")
        params["status"] = status

    line_items = execute_query(f"""
        SELECT
            li.*,
            c.name as campaign_name,
            a.name as advertiser_name
        FROM ad_line_items li
        JOIN ad_campaigns c ON li.campaign_id = c.id
        JOIN advertisers a ON c.advertiser_id = a.id
        WHERE {' AND '.join(conditions)}
        ORDER BY li.priority DESC, li.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(li) for li in line_items]


@router.put("/admin/line-items/{line_item_id}/status", tags=["Ads - Admin"])
async def update_line_item_status(
    line_item_id: str,
    status: str = Query(..., description="New status: active, paused, cancelled"),
    profile: dict = Depends(require_admin)
):
    """Update line item status (admin only)."""
    valid_statuses = ['active', 'paused', 'cancelled']
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")

    line_item = execute_single("""
        UPDATE ad_line_items
        SET status = :status, updated_at = NOW()
        WHERE id = :line_item_id
        RETURNING *
    """, {"line_item_id": line_item_id, "status": status})

    if not line_item:
        raise HTTPException(status_code=404, detail="Line item not found")

    logger.info("line_item_status_updated", line_item_id=line_item_id, status=status)

    return dict(line_item)


# =============================================================================
# REPORTING ENDPOINTS
# =============================================================================

@router.get("/admin/reports/daily", tags=["Ads - Reports"])
async def get_daily_report(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    advertiser_id: Optional[str] = Query(None),
    profile: dict = Depends(require_admin)
):
    """Get daily ad performance report (admin only)."""
    conditions = ["impression_date >= :start_date AND impression_date <= :end_date"]
    params = {"start_date": start_date, "end_date": end_date}

    if advertiser_id:
        conditions.append("advertiser_id = :advertiser_id")
        params["advertiser_id"] = advertiser_id

    report = execute_query(f"""
        SELECT
            impression_date,
            COUNT(*) as impressions,
            COUNT(*) FILTER (WHERE clicked) as clicks,
            COUNT(*) FILTER (WHERE completed) as completions,
            COALESCE(SUM(cost_cents), 0) as revenue_cents,
            COUNT(DISTINCT viewer_id) FILTER (WHERE viewer_id IS NOT NULL) as unique_viewers
        FROM ad_impressions
        WHERE {' AND '.join(conditions)}
        GROUP BY impression_date
        ORDER BY impression_date DESC
    """, params)

    return [dict(r) for r in report]


@router.get("/admin/reports/by-placement", tags=["Ads - Reports"])
async def get_placement_report(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    profile: dict = Depends(require_admin)
):
    """Get ad performance by placement type (admin only)."""
    report = execute_query("""
        SELECT
            placement_type,
            COUNT(*) as impressions,
            COUNT(*) FILTER (WHERE clicked) as clicks,
            COUNT(*) FILTER (WHERE completed) as completions,
            COALESCE(SUM(cost_cents), 0) as revenue_cents
        FROM ad_impressions
        WHERE impression_date >= :start_date AND impression_date <= :end_date
        GROUP BY placement_type
        ORDER BY impressions DESC
    """, {"start_date": start_date, "end_date": end_date})

    return [dict(r) for r in report]
