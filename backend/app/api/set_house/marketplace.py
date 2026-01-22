"""
Set House Marketplace API

Endpoints for marketplace listings and search.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/marketplace", tags=["Set House Marketplace"])


# ============================================================================
# SCHEMAS
# ============================================================================

class ListingCreate(BaseModel):
    space_id: str
    daily_rate: float
    hourly_rate: Optional[float] = None
    half_day_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: bool = False
    min_booking_hours: int = 4
    max_booking_days: Optional[int] = None
    advance_booking_days: int = 1
    booking_notes: Optional[str] = None
    access_instructions: Optional[str] = None


class ListingUpdate(BaseModel):
    daily_rate: Optional[float] = None
    hourly_rate: Optional[float] = None
    half_day_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = None
    min_booking_hours: Optional[int] = None
    max_booking_days: Optional[int] = None
    advance_booking_days: Optional[int] = None
    booking_notes: Optional[str] = None
    access_instructions: Optional[str] = None
    is_listed: Optional[bool] = None


class MarketplaceSettingsUpdate(BaseModel):
    lister_type: Optional[str] = None
    is_marketplace_enabled: Optional[bool] = None
    marketplace_name: Optional[str] = None
    marketplace_description: Optional[str] = None
    marketplace_logo_url: Optional[str] = None
    marketplace_location: Optional[str] = None
    marketplace_website: Optional[str] = None
    default_deposit_percent: Optional[float] = None
    require_deposit: Optional[bool] = None
    default_insurance_required: Optional[bool] = None
    cancellation_policy: Optional[str] = None
    cancellation_notice_hours: Optional[int] = None
    cancellation_fee_percent: Optional[float] = None
    accepts_stripe: Optional[bool] = None
    accepts_invoice: Optional[bool] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# PUBLIC MARKETPLACE SEARCH
# ============================================================================

@router.get("/search")
async def search_marketplace(
    search: Optional[str] = Query(None, description="Search term"),
    space_type: Optional[str] = Query(None, description="Filter by space type"),
    min_daily_rate: Optional[float] = Query(None, description="Minimum daily rate"),
    max_daily_rate: Optional[float] = Query(None, description="Maximum daily rate"),
    city: Optional[str] = Query(None, description="Filter by city"),
    state: Optional[str] = Query(None, description="Filter by state"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """Search marketplace listings."""
    result = set_house_service.list_marketplace_listings(
        search=search,
        space_type=space_type,
        min_daily_rate=min_daily_rate,
        max_daily_rate=max_daily_rate,
        limit=limit,
        offset=offset
    )

    return result


@router.get("/nearby")
async def search_nearby(
    latitude: float,
    longitude: float,
    radius_miles: int = Query(50, le=500),
    space_type: Optional[str] = None,
    limit: int = Query(20, le=100),
    user=Depends(get_current_user)
):
    """Search for nearby marketplace listings."""
    from app.core.database import execute_query

    # Haversine formula for distance calculation
    listings = execute_query(
        """
        SELECT ml.*, s.name as space_name, s.space_type, s.description,
               s.square_footage, s.features, s.amenities,
               o.name as organization_name, o.city, o.state,
               ms.marketplace_name, ms.is_verified,
               (SELECT image_url FROM set_house_space_images si
                WHERE si.space_id = s.id AND si.is_primary = TRUE
                LIMIT 1) as primary_image_url,
               (3959 * acos(
                   cos(radians(:lat)) * cos(radians(COALESCE(o.latitude, 0)))
                   * cos(radians(COALESCE(o.longitude, 0)) - radians(:lon))
                   + sin(radians(:lat)) * sin(radians(COALESCE(o.latitude, 0)))
               )) as distance_miles
        FROM set_house_marketplace_listings ml
        JOIN set_house_spaces s ON s.id = ml.space_id
        JOIN organizations o ON o.id = ml.organization_id
        LEFT JOIN set_house_marketplace_settings ms ON ms.organization_id = ml.organization_id
        WHERE ml.is_listed = TRUE
          AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
          AND (:space_type IS NULL OR s.space_type = :space_type)
        HAVING (3959 * acos(
            cos(radians(:lat)) * cos(radians(COALESCE(o.latitude, 0)))
            * cos(radians(COALESCE(o.longitude, 0)) - radians(:lon))
            + sin(radians(:lat)) * sin(radians(COALESCE(o.latitude, 0)))
        )) <= :radius
        ORDER BY distance_miles
        LIMIT :limit
        """,
        {
            "lat": latitude,
            "lon": longitude,
            "radius": radius_miles,
            "space_type": space_type,
            "limit": limit
        }
    )

    return {"listings": listings}


@router.get("/listing/{listing_id}")
async def get_listing(
    listing_id: str,
    user=Depends(get_current_user)
):
    """Get a single marketplace listing."""
    from app.core.database import execute_single, execute_query

    listing = execute_single(
        """
        SELECT ml.*, s.name as space_name, s.space_type, s.description,
               s.square_footage, s.ceiling_height_feet, s.dimensions,
               s.max_occupancy, s.features, s.amenities,
               s.floor_plan_url, s.virtual_tour_url,
               s.access_instructions as space_access_instructions,
               s.parking_info, s.loading_dock_info,
               o.name as organization_name, o.city, o.state,
               o.address_line1, o.postal_code, o.phone, o.email,
               ms.marketplace_name, ms.marketplace_description, ms.is_verified,
               ms.cancellation_policy, ms.cancellation_notice_hours, ms.cancellation_fee_percent
        FROM set_house_marketplace_listings ml
        JOIN set_house_spaces s ON s.id = ml.space_id
        JOIN organizations o ON o.id = ml.organization_id
        LEFT JOIN set_house_marketplace_settings ms ON ms.organization_id = ml.organization_id
        WHERE ml.id = :listing_id AND ml.is_listed = TRUE
        """,
        {"listing_id": listing_id}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Get images
    images = execute_query(
        """
        SELECT * FROM set_house_space_images
        WHERE space_id = :space_id
        ORDER BY is_primary DESC, sort_order
        """,
        {"space_id": listing["space_id"]}
    )
    listing["images"] = images

    return {"listing": listing}


# ============================================================================
# ORGANIZATION LISTING MANAGEMENT
# ============================================================================

@router.get("/listings/{org_id}")
async def list_org_listings(
    org_id: str,
    is_listed: Optional[bool] = None,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List marketplace listings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = set_house_service.list_marketplace_listings(
        org_id=org_id,
        is_listed=is_listed if is_listed is not None else True,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/listings/{org_id}")
async def create_listing(
    org_id: str,
    data: ListingCreate,
    user=Depends(get_current_user)
):
    """Create a marketplace listing for a space."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    listing = set_house_service.create_marketplace_listing(
        org_id,
        data.space_id,
        data.daily_rate,
        **data.model_dump(exclude={"space_id", "daily_rate"})
    )

    if not listing:
        raise HTTPException(status_code=500, detail="Failed to create listing")

    return {"listing": listing}


@router.put("/listings/{org_id}/{listing_id}")
async def update_listing(
    org_id: str,
    listing_id: str,
    data: ListingUpdate,
    user=Depends(get_current_user)
):
    """Update a marketplace listing."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Handle delisting
    if updates.get("is_listed") is False:
        updates["delisted_at"] = datetime.now(timezone.utc)

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "listing_id": listing_id, "org_id": org_id}

    listing = execute_insert(
        f"""
        UPDATE set_house_marketplace_listings
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :listing_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    return {"listing": listing}


@router.delete("/listings/{org_id}/{listing_id}")
async def delete_listing(
    org_id: str,
    listing_id: str,
    user=Depends(get_current_user)
):
    """Delete a marketplace listing."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_update

    execute_update(
        "DELETE FROM set_house_marketplace_listings WHERE id = :listing_id AND organization_id = :org_id",
        {"listing_id": listing_id, "org_id": org_id}
    )

    return {"success": True}


# ============================================================================
# MARKETPLACE SETTINGS
# ============================================================================

@router.get("/settings/{org_id}")
async def get_marketplace_settings(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get marketplace settings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    settings = set_house_service.get_marketplace_settings(org_id)
    return {"settings": settings}


@router.put("/settings/{org_id}")
async def update_marketplace_settings(
    org_id: str,
    data: MarketplaceSettingsUpdate,
    user=Depends(get_current_user)
):
    """Update marketplace settings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_insert

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "org_id": org_id}

    settings = execute_insert(
        f"""
        INSERT INTO set_house_marketplace_settings (organization_id)
        VALUES (:org_id)
        ON CONFLICT (organization_id) DO UPDATE SET
            {', '.join(set_parts)}, updated_at = NOW()
        RETURNING *
        """,
        params
    )

    return {"settings": settings}


# ============================================================================
# SET HOUSE CARDS (for community page)
# ============================================================================

@router.get("/set-houses")
async def list_set_houses(
    search: Optional[str] = Query(None, description="Search term"),
    city: Optional[str] = Query(None, description="Filter by city"),
    state: Optional[str] = Query(None, description="Filter by state"),
    is_verified: Optional[bool] = Query(None, description="Filter by verified status"),
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List Set Houses (organizations with marketplace enabled)."""
    from app.core.database import execute_query, execute_single

    conditions = ["ms.is_marketplace_enabled = TRUE"]
    params = {"limit": limit, "offset": offset}

    if search:
        conditions.append("(ms.marketplace_name ILIKE :search OR o.name ILIKE :search)")
        params["search"] = f"%{search}%"

    if city:
        conditions.append("o.city ILIKE :city")
        params["city"] = f"%{city}%"

    if state:
        conditions.append("o.state = :state")
        params["state"] = state

    if is_verified is not None:
        conditions.append("ms.is_verified = :is_verified")
        params["is_verified"] = is_verified

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"""
        SELECT COUNT(DISTINCT ms.organization_id) as total
        FROM set_house_marketplace_settings ms
        JOIN organizations o ON o.id = ms.organization_id
        WHERE {where_clause}
        """,
        params
    )

    set_houses = execute_query(
        f"""
        SELECT ms.*, o.name, o.city, o.state, o.logo_url,
               (SELECT COUNT(*) FROM set_house_marketplace_listings ml
                WHERE ml.organization_id = ms.organization_id AND ml.is_listed = TRUE) as listing_count,
               (SELECT MIN(ml.daily_rate) FROM set_house_marketplace_listings ml
                WHERE ml.organization_id = ms.organization_id AND ml.is_listed = TRUE) as min_daily_rate
        FROM set_house_marketplace_settings ms
        JOIN organizations o ON o.id = ms.organization_id
        WHERE {where_clause}
        ORDER BY ms.successful_bookings_count DESC, o.name
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"set_houses": set_houses, "total": count_result["total"] if count_result else 0}
