"""
Venues API
Phase 2C: Endpoints for managing venue partners and distribution deals.

Provides endpoints for:
- Admin: CRUD operations on venue partners
- Admin/PMs: Manage venue deals and screenings
- Creators/Orgs: View deals for their Worlds
- Venues: Access their available content catalog
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date

from app.core.auth import get_current_user
from app.core.permissions import Permission, require_permissions
from app.core.database import execute_query, execute_single
from app.core.logging import get_logger
from app.services.venue_service import VenueService

router = APIRouter()
logger = get_logger(__name__)


# =============================================================================
# Schemas
# =============================================================================

class VenuePartnerCreate(BaseModel):
    """Create venue partner request."""
    name: str = Field(..., min_length=2, max_length=300)
    venue_type: str = Field(..., pattern="^(theater|church|campus|festival|streaming|broadcaster|other)$")
    description: Optional[str] = None
    region: Optional[str] = None
    territories: Optional[List[str]] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    booking_contact_name: Optional[str] = None
    booking_contact_email: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    screening_capabilities: Optional[Dict[str, Any]] = None
    default_revenue_split_percent: Optional[float] = Field(None, ge=0, le=100)


class VenuePartnerUpdate(BaseModel):
    """Update venue partner request."""
    name: Optional[str] = Field(None, min_length=2, max_length=300)
    description: Optional[str] = None
    region: Optional[str] = None
    territories: Optional[List[str]] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    booking_contact_name: Optional[str] = None
    booking_contact_email: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    screening_capabilities: Optional[Dict[str, Any]] = None
    default_revenue_split_percent: Optional[float] = Field(None, ge=0, le=100)
    minimum_guarantee_cents: Optional[int] = None
    typical_license_fee_cents: Optional[int] = None


class VenuePartnerStatusUpdate(BaseModel):
    """Update venue partner status request."""
    status: str = Field(..., pattern="^(prospect|negotiating|active|paused|terminated)$")


class VenueDealCreate(BaseModel):
    """Create venue deal request."""
    world_id: str
    venue_partner_id: str
    deal_type: str = Field(..., pattern="^(license|revenue_share|flat_fee|hybrid|screening)$")
    rights_type: str = Field(..., pattern="^(exclusive|non_exclusive|semi_exclusive)$")
    start_date: date
    end_date: Optional[date] = None
    license_fee_cents: Optional[int] = None
    minimum_guarantee_cents: Optional[int] = None
    revenue_split_percent: Optional[float] = Field(None, ge=0, le=100)
    per_screening_fee_cents: Optional[int] = None
    max_screenings: Optional[int] = None
    territories: Optional[List[str]] = Field(default=["WORLDWIDE"])
    is_exclusive: bool = False
    exclusive_territory: Optional[str] = None
    delivery_format: Optional[str] = None
    technical_requirements: Optional[str] = None
    notes: Optional[str] = None


class VenueDealStatusUpdate(BaseModel):
    """Update venue deal status request."""
    status: str = Field(..., pattern="^(draft|proposed|negotiating|pending_approval|active|completed|terminated|cancelled)$")


class ScreeningCreate(BaseModel):
    """Create screening request."""
    screening_date: date
    screening_time: Optional[str] = None
    timezone: str = Field(default="America/Los_Angeles")
    location_name: Optional[str] = None
    location_address: Optional[Dict[str, str]] = None
    capacity: Optional[int] = None
    ticket_price_cents: Optional[int] = None
    is_premiere: bool = False
    has_qa: bool = False
    qa_participants: Optional[str] = None
    special_guests: Optional[str] = None
    notes: Optional[str] = None


class ScreeningReport(BaseModel):
    """Report screening attendance/revenue."""
    tickets_sold: int = Field(..., ge=0)
    attendance: int = Field(..., ge=0)
    gross_revenue_cents: int = Field(..., ge=0)


class VenuePartnerResponse(BaseModel):
    """Venue partner response."""
    id: str
    name: str
    slug: str
    description: Optional[str]
    venue_type: str
    region: Optional[str]
    territories: Optional[List[str]]
    status: str
    website_url: Optional[str]
    logo_url: Optional[str]
    primary_contact_name: Optional[str]
    primary_contact_email: Optional[str]
    total_deals: int
    total_screenings: int
    total_revenue_cents: int
    created_at: str


class VenueDealResponse(BaseModel):
    """Venue deal response."""
    id: str
    world_id: str
    venue_partner_id: str
    deal_type: str
    rights_type: str
    start_date: date
    end_date: Optional[date]
    status: str
    license_fee_cents: Optional[int]
    minimum_guarantee_cents: Optional[int]
    revenue_split_percent: Optional[float]
    territories: Optional[List[str]]
    is_exclusive: bool
    total_screenings: int
    total_attendance: int
    gross_revenue_cents: int
    venue_name: Optional[str] = None
    world_title: Optional[str] = None


class ScreeningResponse(BaseModel):
    """Screening response."""
    id: str
    venue_deal_id: str
    world_id: str
    venue_partner_id: str
    screening_date: date
    screening_time: Optional[str]
    location_name: Optional[str]
    capacity: Optional[int]
    ticket_price_cents: Optional[int]
    is_premiere: bool
    status: str
    tickets_sold: Optional[int]
    attendance: Optional[int]
    gross_revenue_cents: Optional[int]


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


async def check_world_access(world_id: str, profile_id: str) -> bool:
    """Check if user has access to this World."""
    world = execute_single("""
        SELECT w.id, w.creator_id, w.organization_id,
               COALESCE(om.role IN ('owner', 'admin'), false) as is_org_admin
        FROM worlds w
        LEFT JOIN organization_members om ON w.organization_id = om.organization_id
            AND om.user_id = :profile_id
        WHERE w.id = :world_id
    """, {"world_id": world_id, "profile_id": profile_id})

    if not world:
        return False

    return (
        str(world.get("creator_id")) == str(profile_id) or
        world.get("is_org_admin", False)
    )


# =============================================================================
# Venue Partner Endpoints
# =============================================================================

@router.get("/venues/partners", response_model=List[VenuePartnerResponse])
async def list_venue_partners(
    venue_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    List venue partners with optional filters.
    Admin only.
    """
    partners = await VenueService.list_venue_partners(
        venue_type=venue_type,
        status=status,
        region=region,
        limit=limit,
        offset=offset
    )
    return partners


@router.get("/venues/partners/{partner_id}", response_model=VenuePartnerResponse)
async def get_venue_partner(
    partner_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Get a specific venue partner. Admin only."""
    partner = await VenueService.get_venue_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Venue partner not found")
    return partner


@router.get("/venues/partners/slug/{slug}", response_model=VenuePartnerResponse)
async def get_venue_partner_by_slug(
    slug: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Get venue partner by slug. Admin only."""
    partner = await VenueService.get_venue_partner_by_slug(slug)
    if not partner:
        raise HTTPException(status_code=404, detail="Venue partner not found")
    return partner


@router.post("/venues/partners", response_model=VenuePartnerResponse, status_code=201)
async def create_venue_partner(
    data: VenuePartnerCreate,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Create a new venue partner. Admin only."""
    profile_id = await get_profile_id(current_user)

    partner = await VenueService.create_venue_partner(
        name=data.name,
        venue_type=data.venue_type,
        region=data.region,
        created_by=profile_id,
        description=data.description,
        territories=data.territories,
        primary_contact_name=data.primary_contact_name,
        primary_contact_email=data.primary_contact_email,
        primary_contact_phone=data.primary_contact_phone,
        booking_contact_name=data.booking_contact_name,
        booking_contact_email=data.booking_contact_email,
        website_url=data.website_url,
        logo_url=data.logo_url,
        screening_capabilities=data.screening_capabilities,
        default_revenue_split_percent=data.default_revenue_split_percent
    )

    logger.info("venue_partner_created_via_api", partner_id=partner["id"])

    return partner


@router.put("/venues/partners/{partner_id}", response_model=VenuePartnerResponse)
async def update_venue_partner(
    partner_id: str,
    data: VenuePartnerUpdate,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Update a venue partner. Admin only."""
    updates = data.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    partner = await VenueService.update_venue_partner(partner_id, **updates)
    if not partner:
        raise HTTPException(status_code=404, detail="Venue partner not found")

    return partner


@router.put("/venues/partners/{partner_id}/status", response_model=VenuePartnerResponse)
async def update_venue_partner_status(
    partner_id: str,
    data: VenuePartnerStatusUpdate,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Update venue partner status. Admin only."""
    partner = await VenueService.update_partner_status(partner_id, data.status)
    if not partner:
        raise HTTPException(
            status_code=400,
            detail="Invalid status or partner not found"
        )
    return partner


@router.delete("/venues/partners/{partner_id}", status_code=204)
async def delete_venue_partner(
    partner_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Delete a venue partner. Admin only."""
    execute_single(
        "DELETE FROM venue_partners WHERE id = :partner_id RETURNING id",
        {"partner_id": partner_id}
    )


# =============================================================================
# Venue Deal Endpoints
# =============================================================================

@router.get("/venues/deals", response_model=List[VenueDealResponse])
async def list_venue_deals(
    world_id: Optional[str] = Query(None),
    venue_partner_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    List venue deals with optional filters.
    Creators see their Worlds' deals.
    Admins see all.
    """
    profile_id = await get_profile_id(current_user)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    if world_id:
        # Check access if filtering by World
        if not is_admin:
            has_access = await check_world_access(world_id, profile_id)
            if not has_access:
                raise HTTPException(status_code=403, detail="Access denied")

        deals = await VenueService.list_deals_for_world(world_id, status)
        return deals

    if venue_partner_id:
        # Venue-specific listing (admin only)
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")

        deals = await VenueService.list_deals_for_venue(venue_partner_id, status)
        return deals

    # General listing - admins only
    if not is_admin:
        raise HTTPException(
            status_code=400,
            detail="world_id or venue_partner_id required for non-admins"
        )

    deals = execute_query("""
        SELECT vd.*, vp.name as venue_name, w.title as world_title
        FROM venue_deals vd
        JOIN venue_partners vp ON vd.venue_partner_id = vp.id
        JOIN worlds w ON vd.world_id = w.id
        WHERE (:status IS NULL OR vd.status = :status)
        ORDER BY vd.created_at DESC
        LIMIT :limit OFFSET :offset
    """, {"status": status, "limit": limit, "offset": offset})

    return [dict(d) for d in deals]


@router.get("/venues/deals/{deal_id}", response_model=VenueDealResponse)
async def get_venue_deal(
    deal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific venue deal."""
    profile_id = await get_profile_id(current_user)

    deal = await VenueService.get_venue_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Venue deal not found")

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(deal["world_id"], profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    return deal


@router.post("/venues/deals", response_model=VenueDealResponse, status_code=201)
async def create_venue_deal(
    data: VenueDealCreate,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Create a new venue deal. Admin only."""
    profile_id = await get_profile_id(current_user)

    # Verify World exists
    world = execute_single(
        "SELECT id FROM worlds WHERE id = :world_id",
        {"world_id": data.world_id}
    )
    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    # Verify venue partner exists
    partner = await VenueService.get_venue_partner(data.venue_partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Venue partner not found")

    deal = await VenueService.create_venue_deal(
        world_id=data.world_id,
        venue_partner_id=data.venue_partner_id,
        deal_type=data.deal_type,
        rights_type=data.rights_type,
        start_date=data.start_date,
        created_by=profile_id,
        end_date=data.end_date,
        license_fee_cents=data.license_fee_cents,
        minimum_guarantee_cents=data.minimum_guarantee_cents,
        revenue_split_percent=data.revenue_split_percent,
        per_screening_fee_cents=data.per_screening_fee_cents,
        max_screenings=data.max_screenings,
        territories=data.territories,
        is_exclusive=data.is_exclusive,
        exclusive_territory=data.exclusive_territory,
        delivery_format=data.delivery_format,
        technical_requirements=data.technical_requirements,
        notes=data.notes
    )

    logger.info("venue_deal_created_via_api", deal_id=deal["id"])

    return deal


@router.put("/venues/deals/{deal_id}/status", response_model=VenueDealResponse)
async def update_venue_deal_status(
    deal_id: str,
    data: VenueDealStatusUpdate,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Update venue deal status. Admin only."""
    profile_id = await get_profile_id(current_user)

    deal = await VenueService.update_deal_status(
        deal_id=deal_id,
        new_status=data.status,
        approved_by=profile_id if data.status == "active" else None
    )

    if not deal:
        raise HTTPException(
            status_code=400,
            detail="Invalid status transition or deal not found"
        )

    return deal


@router.delete("/venues/deals/{deal_id}", status_code=204)
async def delete_venue_deal(
    deal_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Delete a venue deal. Admin only."""
    execute_single(
        "DELETE FROM venue_deals WHERE id = :deal_id RETURNING id",
        {"deal_id": deal_id}
    )


# =============================================================================
# Screening Endpoints
# =============================================================================

@router.get("/venues/deals/{deal_id}/screenings", response_model=List[ScreeningResponse])
async def list_screenings_for_deal(
    deal_id: str,
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """List screenings for a venue deal."""
    profile_id = await get_profile_id(current_user)

    # Get deal and check access
    deal = await VenueService.get_venue_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Venue deal not found")

    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(deal["world_id"], profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    screenings = await VenueService.list_screenings_for_deal(deal_id, status)
    return screenings


@router.post("/venues/deals/{deal_id}/screenings", response_model=ScreeningResponse, status_code=201)
async def create_screening(
    deal_id: str,
    data: ScreeningCreate,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Create a new screening for a venue deal. Admin only."""
    # Verify deal exists
    deal = await VenueService.get_venue_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Venue deal not found")

    if deal["status"] != "active":
        raise HTTPException(
            status_code=400,
            detail="Cannot create screening for non-active deal"
        )

    screening = await VenueService.create_screening(
        venue_deal_id=deal_id,
        screening_date=data.screening_date,
        screening_time=data.screening_time,
        timezone=data.timezone,
        location_name=data.location_name,
        location_address=data.location_address,
        capacity=data.capacity,
        ticket_price_cents=data.ticket_price_cents,
        is_premiere=data.is_premiere,
        has_qa=data.has_qa,
        qa_participants=data.qa_participants,
        special_guests=data.special_guests,
        notes=data.notes
    )

    logger.info("screening_created_via_api", screening_id=screening["id"], deal_id=deal_id)

    return screening


@router.put("/venues/screenings/{screening_id}/report", response_model=ScreeningResponse)
async def report_screening_results(
    screening_id: str,
    data: ScreeningReport,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Report screening attendance and revenue. Admin only."""
    profile_id = await get_profile_id(current_user)

    screening = await VenueService.report_screening(
        screening_id=screening_id,
        tickets_sold=data.tickets_sold,
        attendance=data.attendance,
        gross_revenue_cents=data.gross_revenue_cents,
        reported_by=profile_id
    )

    if not screening:
        raise HTTPException(status_code=404, detail="Screening not found")

    return screening


@router.delete("/venues/screenings/{screening_id}", status_code=204)
async def delete_screening(
    screening_id: str,
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """Delete a screening. Admin only."""
    execute_single(
        "DELETE FROM venue_screenings WHERE id = :screening_id RETURNING id",
        {"screening_id": screening_id}
    )


# =============================================================================
# Upcoming Screenings
# =============================================================================

@router.get("/venues/screenings/upcoming")
async def get_upcoming_screenings(
    world_id: Optional[str] = Query(None),
    venue_partner_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(get_current_user)
):
    """
    Get upcoming screenings.
    Filtered by World or venue partner if specified.
    """
    profile_id = await get_profile_id(current_user)
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")

    # Check access if filtering by World
    if world_id and not is_admin:
        has_access = await check_world_access(world_id, profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    # Venue filter is admin only
    if venue_partner_id and not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    screenings = await VenueService.get_upcoming_screenings(
        world_id=world_id,
        venue_partner_id=venue_partner_id,
        days_ahead=days
    )

    return {"screenings": screenings}


# =============================================================================
# Venue Catalog (Worlds available to a venue)
# =============================================================================

@router.get("/venues/partners/{partner_id}/catalog")
async def get_venue_catalog(
    partner_id: str,
    include_inactive: bool = Query(False),
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Get all Worlds available to a venue partner through deals.
    Admin only.
    """
    partner = await VenueService.get_venue_partner(partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="Venue partner not found")

    worlds = await VenueService.get_worlds_for_venue(
        venue_partner_id=partner_id,
        include_inactive=include_inactive
    )

    return {
        "venue_partner": partner,
        "worlds": worlds,
        "total_count": len(worlds)
    }


# =============================================================================
# Active Deals for World (Creator View)
# =============================================================================

@router.get("/venues/worlds/{world_id}/active-deals")
async def get_active_deals_for_world(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get currently active venue deals for a World.
    Available to World owner/org or admin.
    """
    profile_id = await get_profile_id(current_user)

    # Check access
    is_admin = current_user.get("is_admin") or current_user.get("is_superadmin")
    if not is_admin:
        has_access = await check_world_access(world_id, profile_id)
        if not has_access:
            raise HTTPException(status_code=403, detail="Access denied")

    deals = await VenueService.get_active_deals_for_world(world_id)

    return {
        "world_id": world_id,
        "active_deals": deals,
        "total_count": len(deals)
    }


# =============================================================================
# Admin Dashboard Stats
# =============================================================================

@router.get("/venues/admin/stats")
async def get_venue_admin_stats(
    current_user: dict = Depends(require_permissions(Permission.ADMIN_SYSTEM))
):
    """
    Get venue distribution overview stats.
    Admin only.
    """
    stats = execute_single("""
        SELECT
            (SELECT COUNT(*) FROM venue_partners WHERE status = 'active') as active_partners,
            (SELECT COUNT(*) FROM venue_partners) as total_partners,
            (SELECT COUNT(*) FROM venue_deals WHERE status = 'active') as active_deals,
            (SELECT COUNT(*) FROM venue_deals) as total_deals,
            (SELECT COUNT(*) FROM venue_screenings WHERE screening_date >= CURRENT_DATE) as upcoming_screenings,
            (SELECT COALESCE(SUM(gross_revenue_cents), 0) FROM venue_deals) as total_revenue_cents,
            (SELECT COALESCE(SUM(total_attendance), 0) FROM venue_deals) as total_attendance
    """, {})

    # Get recent activity
    recent_deals = execute_query("""
        SELECT vd.id, vd.status, vd.created_at,
               w.title as world_title, vp.name as venue_name
        FROM venue_deals vd
        JOIN worlds w ON vd.world_id = w.id
        JOIN venue_partners vp ON vd.venue_partner_id = vp.id
        ORDER BY vd.created_at DESC
        LIMIT 5
    """, {})

    return {
        "stats": dict(stats) if stats else {},
        "recent_deals": [dict(d) for d in recent_deals]
    }
