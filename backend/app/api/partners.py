"""
Partners API
Phase 2B: Self-serve partner/advertiser account management.

This module provides:
- Advertiser account CRUD
- Campaign management for partners
- Creative upload and management
- Line item configuration
- Team member management

Access control:
- Partners can manage their own advertiser accounts
- Admins have full platform control
"""

import logging
from datetime import datetime, date
from typing import Optional, List
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, validator

from app.core.deps import get_current_user_optional, get_user_profile, require_admin
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.services.ad_decision_service import AdDecisionService

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class AdvertiserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: Optional[str] = None
    description: Optional[str] = None
    website_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    billing_email: Optional[str] = None
    advertiser_type: str = Field("brand", description="brand, sponsor, affiliate, internal")

    @validator('slug', pre=True, always=True)
    def generate_slug(cls, v, values):
        if v:
            return v
        name = values.get('name', '')
        return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


class AdvertiserUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    billing_email: Optional[str] = None


class AdvertiserResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    advertiser_type: str
    status: str
    created_at: datetime


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    objective: str = Field("awareness", description="awareness, engagement, sponsor_world, etc.")
    budget_cents: int = Field(..., gt=0, description="Total budget in cents")
    daily_budget_cents: Optional[int] = Field(None, gt=0)
    start_date: date
    end_date: Optional[date] = None
    pacing: str = Field("standard", description="standard or accelerated")
    target_impressions: Optional[int] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    budget_cents: Optional[int] = None
    daily_budget_cents: Optional[int] = None
    end_date: Optional[date] = None
    pacing: Optional[str] = None
    target_impressions: Optional[int] = None


class LineItemCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    placement_type: str = Field(..., description="linear_preroll, linear_midroll, vod_preroll, etc.")
    creative_ids: List[str] = Field(default_factory=list)
    targeting: dict = Field(default_factory=dict)
    pricing_model: str = Field("cpm", description="cpm, flat_fee, cpc, cpv")
    cpm_cents: Optional[int] = None
    flat_fee_cents: Optional[int] = None
    max_impressions: Optional[int] = None
    daily_impression_cap: Optional[int] = None
    budget_cents: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    priority: int = Field(0, ge=0, le=100)


class LineItemUpdate(BaseModel):
    name: Optional[str] = None
    creative_ids: Optional[List[str]] = None
    targeting: Optional[dict] = None
    cpm_cents: Optional[int] = None
    max_impressions: Optional[int] = None
    daily_impression_cap: Optional[int] = None
    budget_cents: Optional[int] = None
    end_date: Optional[date] = None
    priority: Optional[int] = None


class CreativeCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = None
    creative_type: str = Field(..., description="video_preroll, video_midroll, etc.")
    asset_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    headline: Optional[str] = None
    body_text: Optional[str] = None
    call_to_action: Optional[str] = None
    destination_url: Optional[str] = None
    tracking_pixel_url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class CreativeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    asset_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    headline: Optional[str] = None
    body_text: Optional[str] = None
    call_to_action: Optional[str] = None
    destination_url: Optional[str] = None
    tags: Optional[List[str]] = None


class TeamMemberInvite(BaseModel):
    email: str
    role: str = Field("viewer", description="owner, admin, finance, creator, viewer")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def get_user_advertiser_access(user: dict, advertiser_id: str) -> Optional[dict]:
    """Check if user has access to an advertiser account."""
    profile = execute_single(
        "SELECT id, is_admin, is_superadmin FROM profiles WHERE cognito_id = :cid",
        {"cid": user.get("sub")}
    )

    if not profile:
        return None

    # Admins have full access
    if profile.get('is_admin') or profile.get('is_superadmin'):
        return {'role': 'admin', 'profile_id': profile['id']}

    # Check membership
    membership = execute_single("""
        SELECT role, status
        FROM advertiser_members
        WHERE advertiser_id = :advertiser_id AND user_id = :user_id AND status = 'active'
    """, {"advertiser_id": advertiser_id, "user_id": profile['id']})

    if membership:
        return {'role': membership['role'], 'profile_id': profile['id']}

    return None


async def require_advertiser_access(user: dict, advertiser_id: str, min_role: str = 'viewer'):
    """Require user has at least min_role access to advertiser."""
    role_hierarchy = ['viewer', 'creator', 'finance', 'admin', 'owner']

    access = await get_user_advertiser_access(user, advertiser_id)
    if not access:
        raise HTTPException(status_code=403, detail="No access to this advertiser")

    user_role = access['role']
    if user_role == 'admin':  # Platform admin
        return access

    if role_hierarchy.index(user_role) < role_hierarchy.index(min_role):
        raise HTTPException(status_code=403, detail=f"Requires {min_role} role or higher")

    return access


# =============================================================================
# ADVERTISER ENDPOINTS
# =============================================================================

@router.get("/advertisers", tags=["Partners - Advertisers"])
async def list_my_advertisers(
    user: dict = Depends(get_user_profile)
):
    """List advertiser accounts the current user has access to."""
    advertisers = execute_query("""
        SELECT
            a.*,
            am.role as my_role,
            (SELECT COUNT(*) FROM ad_campaigns WHERE advertiser_id = a.id) as campaign_count
        FROM advertisers a
        JOIN advertiser_members am ON a.id = am.advertiser_id
        WHERE am.user_id = :user_id AND am.status = 'active'
        ORDER BY a.name
    """, {"user_id": user['id']})

    return [dict(a) for a in advertisers]


@router.post("/advertisers", tags=["Partners - Advertisers"])
async def create_advertiser(
    body: AdvertiserCreate,
    user: dict = Depends(get_user_profile)
):
    """Create a new advertiser account."""
    # Check slug uniqueness
    existing = execute_single(
        "SELECT id FROM advertisers WHERE slug = :slug",
        {"slug": body.slug}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Advertiser slug already exists")

    # Create advertiser
    advertiser = execute_insert("""
        INSERT INTO advertisers (
            name, slug, description, website_url,
            contact_name, contact_email, contact_phone, billing_email,
            advertiser_type, status, created_by
        ) VALUES (
            :name, :slug, :description, :website_url,
            :contact_name, :contact_email, :contact_phone, :billing_email,
            :advertiser_type, 'pending', :created_by
        )
        RETURNING *
    """, {
        "name": body.name,
        "slug": body.slug,
        "description": body.description,
        "website_url": body.website_url,
        "contact_name": body.contact_name,
        "contact_email": body.contact_email,
        "contact_phone": body.contact_phone,
        "billing_email": body.billing_email,
        "advertiser_type": body.advertiser_type,
        "created_by": user['id']
    })

    # Add creator as owner
    execute_insert("""
        INSERT INTO advertiser_members (advertiser_id, user_id, role, status, joined_at)
        VALUES (:advertiser_id, :user_id, 'owner', 'active', NOW())
        RETURNING id
    """, {"advertiser_id": advertiser['id'], "user_id": user['id']})

    logger.info("advertiser_created", advertiser_id=advertiser['id'], created_by=user['id'])

    return dict(advertiser)


@router.get("/advertisers/{advertiser_id}", tags=["Partners - Advertisers"])
async def get_advertiser(
    advertiser_id: str,
    user: dict = Depends(get_user_profile)
):
    """Get advertiser details."""
    access = await require_advertiser_access(user, advertiser_id)

    advertiser = execute_single("""
        SELECT
            a.*,
            (SELECT COUNT(*) FROM ad_campaigns WHERE advertiser_id = a.id) as campaign_count,
            (SELECT COUNT(*) FROM ad_creatives WHERE advertiser_id = a.id) as creative_count,
            (SELECT COALESCE(SUM(spent_cents), 0) FROM ad_campaigns WHERE advertiser_id = a.id) as total_spent_cents
        FROM advertisers a
        WHERE a.id = :advertiser_id
    """, {"advertiser_id": advertiser_id})

    if not advertiser:
        raise HTTPException(status_code=404, detail="Advertiser not found")

    result = dict(advertiser)
    result['my_role'] = access['role']

    return result


@router.put("/advertisers/{advertiser_id}", tags=["Partners - Advertisers"])
async def update_advertiser(
    advertiser_id: str,
    body: AdvertiserUpdate,
    user: dict = Depends(get_user_profile)
):
    """Update advertiser details."""
    await require_advertiser_access(user, advertiser_id, min_role='admin')

    updates = []
    params = {"advertiser_id": advertiser_id}

    for field in ['name', 'description', 'logo_url', 'website_url',
                  'contact_name', 'contact_email', 'contact_phone', 'billing_email']:
        value = getattr(body, field)
        if value is not None:
            updates.append(f"{field} = :{field}")
            params[field] = value

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    updates.append("updated_at = NOW()")

    advertiser = execute_single(f"""
        UPDATE advertisers
        SET {', '.join(updates)}
        WHERE id = :advertiser_id
        RETURNING *
    """, params)

    if not advertiser:
        raise HTTPException(status_code=404, detail="Advertiser not found")

    return dict(advertiser)


@router.get("/advertisers/{advertiser_id}/stats", tags=["Partners - Advertisers"])
async def get_advertiser_stats(
    advertiser_id: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: dict = Depends(get_user_profile)
):
    """Get advertiser performance statistics."""
    await require_advertiser_access(user, advertiser_id)

    stats = await AdDecisionService.get_advertiser_stats(
        advertiser_id=advertiser_id,
        start_date=start_date,
        end_date=end_date
    )

    return stats


# =============================================================================
# CAMPAIGN ENDPOINTS
# =============================================================================

@router.get("/advertisers/{advertiser_id}/campaigns", tags=["Partners - Campaigns"])
async def list_campaigns(
    advertiser_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    user: dict = Depends(get_user_profile)
):
    """List campaigns for an advertiser."""
    await require_advertiser_access(user, advertiser_id)

    conditions = ["advertiser_id = :advertiser_id"]
    params = {"advertiser_id": advertiser_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("status = :status")
        params["status"] = status

    campaigns = execute_query(f"""
        SELECT
            c.*,
            (SELECT COUNT(*) FROM ad_line_items WHERE campaign_id = c.id) as line_item_count
        FROM ad_campaigns c
        WHERE {' AND '.join(conditions)}
        ORDER BY c.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(c) for c in campaigns]


@router.post("/advertisers/{advertiser_id}/campaigns", tags=["Partners - Campaigns"])
async def create_campaign(
    advertiser_id: str,
    body: CampaignCreate,
    user: dict = Depends(get_user_profile)
):
    """Create a new campaign."""
    access = await require_advertiser_access(user, advertiser_id, min_role='creator')

    campaign = execute_insert("""
        INSERT INTO ad_campaigns (
            advertiser_id, name, description, objective,
            budget_cents, daily_budget_cents, start_date, end_date,
            pacing, target_impressions, status, created_by
        ) VALUES (
            :advertiser_id, :name, :description, :objective,
            :budget_cents, :daily_budget_cents, :start_date, :end_date,
            :pacing, :target_impressions, 'draft', :created_by
        )
        RETURNING *
    """, {
        "advertiser_id": advertiser_id,
        "name": body.name,
        "description": body.description,
        "objective": body.objective,
        "budget_cents": body.budget_cents,
        "daily_budget_cents": body.daily_budget_cents,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "pacing": body.pacing,
        "target_impressions": body.target_impressions,
        "created_by": access['profile_id']
    })

    logger.info("campaign_created", campaign_id=campaign['id'], advertiser_id=advertiser_id)

    return dict(campaign)


@router.get("/advertisers/{advertiser_id}/campaigns/{campaign_id}", tags=["Partners - Campaigns"])
async def get_campaign(
    advertiser_id: str,
    campaign_id: str,
    user: dict = Depends(get_user_profile)
):
    """Get campaign details with stats."""
    await require_advertiser_access(user, advertiser_id)

    stats = await AdDecisionService.get_campaign_stats(campaign_id)

    if 'error' in stats:
        raise HTTPException(status_code=404, detail=stats['error'])

    # Verify campaign belongs to advertiser
    if str(stats['campaign']['advertiser_id']) != advertiser_id:
        raise HTTPException(status_code=403, detail="Campaign does not belong to this advertiser")

    return stats


@router.put("/advertisers/{advertiser_id}/campaigns/{campaign_id}", tags=["Partners - Campaigns"])
async def update_campaign(
    advertiser_id: str,
    campaign_id: str,
    body: CampaignUpdate,
    user: dict = Depends(get_user_profile)
):
    """Update campaign details."""
    await require_advertiser_access(user, advertiser_id, min_role='creator')

    updates = []
    params = {"campaign_id": campaign_id, "advertiser_id": advertiser_id}

    for field in ['name', 'description', 'budget_cents', 'daily_budget_cents',
                  'end_date', 'pacing', 'target_impressions']:
        value = getattr(body, field)
        if value is not None:
            updates.append(f"{field} = :{field}")
            params[field] = value

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    updates.append("updated_at = NOW()")

    campaign = execute_single(f"""
        UPDATE ad_campaigns
        SET {', '.join(updates)}
        WHERE id = :campaign_id AND advertiser_id = :advertiser_id
        RETURNING *
    """, params)

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    return dict(campaign)


@router.post("/advertisers/{advertiser_id}/campaigns/{campaign_id}/submit", tags=["Partners - Campaigns"])
async def submit_campaign(
    advertiser_id: str,
    campaign_id: str,
    user: dict = Depends(get_user_profile)
):
    """Submit a draft campaign for approval."""
    await require_advertiser_access(user, advertiser_id, min_role='creator')

    campaign = execute_single("""
        UPDATE ad_campaigns
        SET status = 'pending', updated_at = NOW()
        WHERE id = :campaign_id AND advertiser_id = :advertiser_id AND status = 'draft'
        RETURNING *
    """, {"campaign_id": campaign_id, "advertiser_id": advertiser_id})

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found or not in draft status")

    logger.info("campaign_submitted", campaign_id=campaign_id)

    return dict(campaign)


# =============================================================================
# LINE ITEM ENDPOINTS
# =============================================================================

@router.get("/campaigns/{campaign_id}/line-items", tags=["Partners - Line Items"])
async def list_line_items(
    campaign_id: str,
    user: dict = Depends(get_user_profile)
):
    """List line items for a campaign."""
    # Get campaign to verify access
    campaign = execute_single(
        "SELECT advertiser_id FROM ad_campaigns WHERE id = :campaign_id",
        {"campaign_id": campaign_id}
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    await require_advertiser_access(user, str(campaign['advertiser_id']))

    line_items = execute_query("""
        SELECT *
        FROM ad_line_items
        WHERE campaign_id = :campaign_id
        ORDER BY priority DESC, created_at DESC
    """, {"campaign_id": campaign_id})

    return [dict(li) for li in line_items]


@router.post("/campaigns/{campaign_id}/line-items", tags=["Partners - Line Items"])
async def create_line_item(
    campaign_id: str,
    body: LineItemCreate,
    user: dict = Depends(get_user_profile)
):
    """Create a new line item."""
    campaign = execute_single(
        "SELECT advertiser_id FROM ad_campaigns WHERE id = :campaign_id",
        {"campaign_id": campaign_id}
    )
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    access = await require_advertiser_access(user, str(campaign['advertiser_id']), min_role='creator')

    import json
    line_item = execute_insert("""
        INSERT INTO ad_line_items (
            campaign_id, name, placement_type, creative_ids,
            targeting, pricing_model, cpm_cents, flat_fee_cents,
            max_impressions, daily_impression_cap, budget_cents,
            start_date, end_date, priority, status, created_by
        ) VALUES (
            :campaign_id, :name, :placement_type, :creative_ids,
            :targeting, :pricing_model, :cpm_cents, :flat_fee_cents,
            :max_impressions, :daily_impression_cap, :budget_cents,
            :start_date, :end_date, :priority, 'draft', :created_by
        )
        RETURNING *
    """, {
        "campaign_id": campaign_id,
        "name": body.name,
        "placement_type": body.placement_type,
        "creative_ids": body.creative_ids,
        "targeting": json.dumps(body.targeting),
        "pricing_model": body.pricing_model,
        "cpm_cents": body.cpm_cents,
        "flat_fee_cents": body.flat_fee_cents,
        "max_impressions": body.max_impressions,
        "daily_impression_cap": body.daily_impression_cap,
        "budget_cents": body.budget_cents,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "priority": body.priority,
        "created_by": access['profile_id']
    })

    logger.info("line_item_created", line_item_id=line_item['id'], campaign_id=campaign_id)

    return dict(line_item)


@router.put("/line-items/{line_item_id}", tags=["Partners - Line Items"])
async def update_line_item(
    line_item_id: str,
    body: LineItemUpdate,
    user: dict = Depends(get_user_profile)
):
    """Update a line item."""
    line_item = execute_single("""
        SELECT li.*, c.advertiser_id
        FROM ad_line_items li
        JOIN ad_campaigns c ON li.campaign_id = c.id
        WHERE li.id = :line_item_id
    """, {"line_item_id": line_item_id})

    if not line_item:
        raise HTTPException(status_code=404, detail="Line item not found")

    await require_advertiser_access(user, str(line_item['advertiser_id']), min_role='creator')

    updates = []
    params = {"line_item_id": line_item_id}

    import json
    for field in ['name', 'creative_ids', 'targeting', 'cpm_cents',
                  'max_impressions', 'daily_impression_cap', 'budget_cents',
                  'end_date', 'priority']:
        value = getattr(body, field)
        if value is not None:
            if field == 'targeting':
                updates.append(f"{field} = :{field}::jsonb")
                params[field] = json.dumps(value)
            elif field == 'creative_ids':
                updates.append(f"{field} = :{field}")
                params[field] = value
            else:
                updates.append(f"{field} = :{field}")
                params[field] = value

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    updates.append("updated_at = NOW()")

    result = execute_single(f"""
        UPDATE ad_line_items
        SET {', '.join(updates)}
        WHERE id = :line_item_id
        RETURNING *
    """, params)

    return dict(result)


@router.post("/line-items/{line_item_id}/activate", tags=["Partners - Line Items"])
async def activate_line_item(
    line_item_id: str,
    user: dict = Depends(get_user_profile)
):
    """Activate a line item to start serving."""
    line_item = execute_single("""
        SELECT li.*, c.advertiser_id, c.status as campaign_status
        FROM ad_line_items li
        JOIN ad_campaigns c ON li.campaign_id = c.id
        WHERE li.id = :line_item_id
    """, {"line_item_id": line_item_id})

    if not line_item:
        raise HTTPException(status_code=404, detail="Line item not found")

    await require_advertiser_access(user, str(line_item['advertiser_id']), min_role='creator')

    # Campaign must be active
    if line_item['campaign_status'] != 'active':
        raise HTTPException(status_code=400, detail="Campaign must be active to activate line items")

    result = execute_single("""
        UPDATE ad_line_items
        SET status = 'active', updated_at = NOW()
        WHERE id = :line_item_id
        RETURNING *
    """, {"line_item_id": line_item_id})

    logger.info("line_item_activated", line_item_id=line_item_id)

    return dict(result)


# =============================================================================
# CREATIVE ENDPOINTS
# =============================================================================

@router.get("/advertisers/{advertiser_id}/creatives", tags=["Partners - Creatives"])
async def list_creatives(
    advertiser_id: str,
    creative_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    user: dict = Depends(get_user_profile)
):
    """List creatives for an advertiser."""
    await require_advertiser_access(user, advertiser_id)

    conditions = ["advertiser_id = :advertiser_id"]
    params = {"advertiser_id": advertiser_id, "limit": limit, "offset": offset}

    if creative_type:
        conditions.append("creative_type = :creative_type")
        params["creative_type"] = creative_type
    if status:
        conditions.append("status = :status")
        params["status"] = status

    creatives = execute_query(f"""
        SELECT *
        FROM ad_creatives
        WHERE {' AND '.join(conditions)}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    return [dict(c) for c in creatives]


@router.post("/advertisers/{advertiser_id}/creatives", tags=["Partners - Creatives"])
async def create_creative(
    advertiser_id: str,
    body: CreativeCreate,
    user: dict = Depends(get_user_profile)
):
    """Create a new creative."""
    access = await require_advertiser_access(user, advertiser_id, min_role='creator')

    import json
    creative = execute_insert("""
        INSERT INTO ad_creatives (
            advertiser_id, name, description, creative_type,
            asset_url, thumbnail_url, duration_seconds,
            headline, body_text, call_to_action, destination_url,
            tracking_pixel_url, tags, status, created_by
        ) VALUES (
            :advertiser_id, :name, :description, :creative_type,
            :asset_url, :thumbnail_url, :duration_seconds,
            :headline, :body_text, :call_to_action, :destination_url,
            :tracking_pixel_url, :tags, 'draft', :created_by
        )
        RETURNING *
    """, {
        "advertiser_id": advertiser_id,
        "name": body.name,
        "description": body.description,
        "creative_type": body.creative_type,
        "asset_url": body.asset_url,
        "thumbnail_url": body.thumbnail_url,
        "duration_seconds": body.duration_seconds,
        "headline": body.headline,
        "body_text": body.body_text,
        "call_to_action": body.call_to_action,
        "destination_url": body.destination_url,
        "tracking_pixel_url": body.tracking_pixel_url,
        "tags": json.dumps(body.tags),
        "created_by": access['profile_id']
    })

    logger.info("creative_created", creative_id=creative['id'], advertiser_id=advertiser_id)

    return dict(creative)


@router.put("/creatives/{creative_id}", tags=["Partners - Creatives"])
async def update_creative(
    creative_id: str,
    body: CreativeUpdate,
    user: dict = Depends(get_user_profile)
):
    """Update a creative."""
    creative = execute_single(
        "SELECT advertiser_id, status FROM ad_creatives WHERE id = :creative_id",
        {"creative_id": creative_id}
    )
    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")

    await require_advertiser_access(user, str(creative['advertiser_id']), min_role='creator')

    # Can't update approved creatives (must create new version)
    if creative['status'] == 'approved':
        raise HTTPException(status_code=400, detail="Cannot modify approved creative. Create a new version.")

    updates = []
    params = {"creative_id": creative_id}

    import json
    for field in ['name', 'description', 'asset_url', 'thumbnail_url',
                  'headline', 'body_text', 'call_to_action', 'destination_url', 'tags']:
        value = getattr(body, field)
        if value is not None:
            if field == 'tags':
                updates.append(f"{field} = :{field}::jsonb")
                params[field] = json.dumps(value)
            else:
                updates.append(f"{field} = :{field}")
                params[field] = value

    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    updates.append("updated_at = NOW()")

    result = execute_single(f"""
        UPDATE ad_creatives
        SET {', '.join(updates)}
        WHERE id = :creative_id
        RETURNING *
    """, params)

    return dict(result)


@router.post("/creatives/{creative_id}/submit", tags=["Partners - Creatives"])
async def submit_creative(
    creative_id: str,
    user: dict = Depends(get_user_profile)
):
    """Submit a creative for review."""
    creative = execute_single(
        "SELECT advertiser_id, status FROM ad_creatives WHERE id = :creative_id",
        {"creative_id": creative_id}
    )
    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")

    await require_advertiser_access(user, str(creative['advertiser_id']), min_role='creator')

    result = execute_single("""
        UPDATE ad_creatives
        SET status = 'pending_review', updated_at = NOW()
        WHERE id = :creative_id AND status = 'draft'
        RETURNING *
    """, {"creative_id": creative_id})

    if not result:
        raise HTTPException(status_code=400, detail="Creative not in draft status")

    logger.info("creative_submitted", creative_id=creative_id)

    return dict(result)


# =============================================================================
# TEAM MANAGEMENT
# =============================================================================

@router.get("/advertisers/{advertiser_id}/team", tags=["Partners - Team"])
async def list_team_members(
    advertiser_id: str,
    user: dict = Depends(get_user_profile)
):
    """List team members for an advertiser."""
    await require_advertiser_access(user, advertiser_id)

    members = execute_query("""
        SELECT
            am.*,
            p.display_name,
            p.email,
            p.avatar_url
        FROM advertiser_members am
        JOIN profiles p ON am.user_id = p.id
        WHERE am.advertiser_id = :advertiser_id
        ORDER BY
            CASE am.role
                WHEN 'owner' THEN 1
                WHEN 'admin' THEN 2
                WHEN 'finance' THEN 3
                WHEN 'creator' THEN 4
                ELSE 5
            END,
            am.joined_at
    """, {"advertiser_id": advertiser_id})

    return [dict(m) for m in members]


@router.post("/advertisers/{advertiser_id}/team/invite", tags=["Partners - Team"])
async def invite_team_member(
    advertiser_id: str,
    body: TeamMemberInvite,
    user: dict = Depends(get_user_profile)
):
    """Invite a user to the advertiser team."""
    access = await require_advertiser_access(user, advertiser_id, min_role='admin')

    # Find user by email
    invitee = execute_single(
        "SELECT id FROM profiles WHERE email = :email",
        {"email": body.email}
    )
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found with that email")

    # Check if already a member
    existing = execute_single("""
        SELECT id FROM advertiser_members
        WHERE advertiser_id = :advertiser_id AND user_id = :user_id
    """, {"advertiser_id": advertiser_id, "user_id": invitee['id']})

    if existing:
        raise HTTPException(status_code=400, detail="User is already a team member")

    member = execute_insert("""
        INSERT INTO advertiser_members (
            advertiser_id, user_id, role, status, invited_by, invited_at
        ) VALUES (
            :advertiser_id, :user_id, :role, 'invited', :invited_by, NOW()
        )
        RETURNING *
    """, {
        "advertiser_id": advertiser_id,
        "user_id": invitee['id'],
        "role": body.role,
        "invited_by": access['profile_id']
    })

    logger.info("team_member_invited", advertiser_id=advertiser_id, invitee_id=invitee['id'])

    return dict(member)


@router.put("/advertisers/{advertiser_id}/team/{member_id}/role", tags=["Partners - Team"])
async def update_team_member_role(
    advertiser_id: str,
    member_id: str,
    role: str = Query(..., description="New role"),
    user: dict = Depends(get_user_profile)
):
    """Update a team member's role."""
    await require_advertiser_access(user, advertiser_id, min_role='admin')

    valid_roles = ['admin', 'finance', 'creator', 'viewer']
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {valid_roles}")

    result = execute_single("""
        UPDATE advertiser_members
        SET role = :role, updated_at = NOW()
        WHERE id = :member_id AND advertiser_id = :advertiser_id AND role != 'owner'
        RETURNING *
    """, {"member_id": member_id, "advertiser_id": advertiser_id, "role": role})

    if not result:
        raise HTTPException(status_code=404, detail="Member not found or cannot change owner role")

    return dict(result)


@router.delete("/advertisers/{advertiser_id}/team/{member_id}", tags=["Partners - Team"])
async def remove_team_member(
    advertiser_id: str,
    member_id: str,
    user: dict = Depends(get_user_profile)
):
    """Remove a team member."""
    await require_advertiser_access(user, advertiser_id, min_role='admin')

    result = execute_single("""
        UPDATE advertiser_members
        SET status = 'removed', updated_at = NOW()
        WHERE id = :member_id AND advertiser_id = :advertiser_id AND role != 'owner'
        RETURNING id
    """, {"member_id": member_id, "advertiser_id": advertiser_id})

    if not result:
        raise HTTPException(status_code=404, detail="Member not found or cannot remove owner")

    logger.info("team_member_removed", advertiser_id=advertiser_id, member_id=member_id)

    return {"status": "removed"}
