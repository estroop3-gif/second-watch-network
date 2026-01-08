"""
Gear House Marketplace API

Endpoints for browsing, listing, and managing the gear rental marketplace.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert

from app.services import gear_service

router = APIRouter(prefix="/marketplace", tags=["Gear Marketplace"])


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def transform_listing_to_nested(listing: Dict[str, Any]) -> Dict[str, Any]:
    """Transform flat listing row into nested structure expected by frontend."""
    return {
        "id": listing.get("id"),
        "asset_id": listing.get("asset_id"),
        "organization_id": listing.get("organization_id"),
        "is_listed": listing.get("is_listed", True),
        "listing_type": listing.get("listing_type", "rent"),
        "daily_rate": listing.get("daily_rate"),
        "weekly_rate": listing.get("weekly_rate"),
        "monthly_rate": listing.get("monthly_rate"),
        "weekly_discount_percent": listing.get("weekly_discount_percent", 0),
        "monthly_discount_percent": listing.get("monthly_discount_percent", 0),
        "quantity_discount_threshold": listing.get("quantity_discount_threshold"),
        "quantity_discount_percent": listing.get("quantity_discount_percent"),
        "deposit_amount": listing.get("deposit_amount"),
        "deposit_percent": listing.get("deposit_percent"),
        "insurance_required": listing.get("insurance_required", False),
        "insurance_daily_rate": listing.get("insurance_daily_rate"),
        "min_rental_days": listing.get("min_rental_days", 1),
        "max_rental_days": listing.get("max_rental_days"),
        "advance_booking_days": listing.get("advance_booking_days", 1),
        "blackout_dates": listing.get("blackout_dates"),
        "rental_notes": listing.get("rental_notes"),
        "pickup_instructions": listing.get("pickup_instructions"),
        "sale_price": listing.get("sale_price"),
        "sale_condition": listing.get("sale_condition"),
        "sale_includes": listing.get("sale_includes"),
        "sale_negotiable": listing.get("sale_negotiable", True),
        "created_at": listing.get("created_at"),
        "updated_at": listing.get("updated_at"),
        # Nested asset object
        "asset": {
            "id": listing.get("asset_id"),
            "name": listing.get("asset_name"),
            "description": listing.get("asset_description"),
            "make": listing.get("make"),
            "model": listing.get("model"),
            "manufacturer": listing.get("make"),  # Alias for frontend compatibility
            "serial_number": listing.get("serial_number"),
            "barcode": listing.get("barcode"),
            "status": listing.get("asset_status"),
            "current_condition": listing.get("asset_condition"),
            "notes": listing.get("asset_notes"),
            "category_id": listing.get("category_id"),
            "category_name": listing.get("category_name"),
            "photos_current": listing.get("photos") or [],
            "photos_baseline": listing.get("photos") or [],
            "photo_urls": listing.get("photos") or [],  # Alias for frontend compatibility
        },
        # Nested organization object
        "organization": {
            "id": listing.get("organization_id"),
            "name": listing.get("organization_name"),
            "marketplace_name": listing.get("marketplace_name"),
            "marketplace_description": listing.get("marketplace_description"),
            "logo_url": listing.get("marketplace_logo_url"),
            "marketplace_location": listing.get("marketplace_location"),
            "marketplace_website": listing.get("marketplace_website"),
            "lister_type": listing.get("lister_type"),
            "is_verified": listing.get("is_verified", False),
            "offers_delivery": listing.get("offers_delivery", False),
            "delivery_radius_miles": listing.get("delivery_radius_miles"),
            "delivery_base_fee": listing.get("delivery_base_fee"),
            "delivery_per_mile_fee": listing.get("delivery_per_mile_fee"),
            "extension_policy": listing.get("extension_policy"),
            "accepts_stripe": listing.get("accepts_stripe", True),
            "accepts_invoice": listing.get("accepts_invoice", True),
            "contact_email": listing.get("contact_email"),
            "contact_phone": listing.get("contact_phone"),
        },
    }


# ============================================================================
# SCHEMAS
# ============================================================================

class MarketplaceSettingsUpdate(BaseModel):
    """Update marketplace settings for an organization."""
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
    offers_delivery: Optional[bool] = None
    delivery_radius_miles: Optional[int] = None
    delivery_base_fee: Optional[float] = None
    delivery_per_mile_fee: Optional[float] = None
    extension_policy: Optional[str] = None
    auto_extend_max_days: Optional[int] = None
    accepts_stripe: Optional[bool] = None
    accepts_invoice: Optional[bool] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class CreateListingRequest(BaseModel):
    """Create a marketplace listing for an asset."""
    asset_id: str
    # Listing type: rent, sale, or both
    listing_type: str = "rent"  # rent, sale, both
    # Rental pricing (required if listing_type is 'rent' or 'both')
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    weekly_discount_percent: Optional[float] = 0
    monthly_discount_percent: Optional[float] = 0
    quantity_discount_threshold: Optional[int] = None
    quantity_discount_percent: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = False
    insurance_daily_rate: Optional[float] = None
    min_rental_days: Optional[int] = 1
    max_rental_days: Optional[int] = None
    advance_booking_days: Optional[int] = 1
    rental_notes: Optional[str] = None
    pickup_instructions: Optional[str] = None
    # Sale pricing (required if listing_type is 'sale' or 'both')
    sale_price: Optional[float] = None
    sale_condition: Optional[str] = None  # new, like_new, good, fair, parts
    sale_includes: Optional[str] = None
    sale_negotiable: Optional[bool] = True


class UpdateListingRequest(BaseModel):
    """Update a marketplace listing."""
    listing_type: Optional[str] = None  # rent, sale, both
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    weekly_discount_percent: Optional[float] = None
    monthly_discount_percent: Optional[float] = None
    quantity_discount_threshold: Optional[int] = None
    quantity_discount_percent: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = None
    insurance_daily_rate: Optional[float] = None
    min_rental_days: Optional[int] = None
    max_rental_days: Optional[int] = None
    advance_booking_days: Optional[int] = None
    rental_notes: Optional[str] = None
    pickup_instructions: Optional[str] = None
    is_listed: Optional[bool] = None
    # Sale fields
    sale_price: Optional[float] = None
    sale_condition: Optional[str] = None
    sale_includes: Optional[str] = None
    sale_negotiable: Optional[bool] = None


class BulkListingItem(BaseModel):
    """Single listing in a bulk create request with per-asset rates."""
    asset_id: str
    listing_type: str = "rent"  # rent, sale, both
    # Rental pricing
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = False
    min_rental_days: Optional[int] = 1
    rental_notes: Optional[str] = None
    # Sale pricing
    sale_price: Optional[float] = None
    sale_condition: Optional[str] = None
    sale_includes: Optional[str] = None
    sale_negotiable: Optional[bool] = True


class BulkListRequest(BaseModel):
    """
    Bulk list multiple assets.

    Supports two formats:
    1. Per-asset rates: { "listings": [{ "asset_id": "...", "daily_rate": 150, ... }, ...] }
    2. Default settings (legacy): { "asset_ids": [...], "daily_rate": 150, ... }
    """
    # New format: per-asset rates
    listings: Optional[List[BulkListingItem]] = None

    # Legacy format: same rate for all
    asset_ids: Optional[List[str]] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = False


class BlackoutDateRequest(BaseModel):
    """Add blackout dates to a listing."""
    start_date: date
    end_date: date
    reason: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def validate_asset_has_photos(asset_id: str) -> bool:
    """Check that asset has at least one photo. Required for marketplace listings."""
    asset = execute_single(
        """SELECT photos_baseline, photos_current FROM gear_assets WHERE id = :id""",
        {"id": asset_id}
    )
    if not asset:
        return False

    photos = asset.get("photos_current") or asset.get("photos_baseline") or []
    # Handle JSONB - could be list or null
    if isinstance(photos, list):
        return len(photos) > 0
    return False


def validate_listing_type_pricing(listing_type: str, daily_rate: Optional[float], sale_price: Optional[float]) -> None:
    """Validate that the listing has required pricing fields based on its type."""
    if listing_type not in ["rent", "sale", "both"]:
        raise HTTPException(status_code=400, detail="Invalid listing_type. Must be 'rent', 'sale', or 'both'")

    if listing_type in ["rent", "both"] and not daily_rate:
        raise HTTPException(status_code=400, detail="Daily rate is required for rental listings")

    if listing_type in ["sale", "both"] and not sale_price:
        raise HTTPException(status_code=400, detail="Sale price is required for sale listings")


# ============================================================================
# PUBLIC MARKETPLACE BROWSING
# ============================================================================

@router.get("/search")
async def search_marketplace(
    q: Optional[str] = Query(None, description="Search query"),
    category_id: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    location: Optional[str] = Query(None),
    lister_type: Optional[str] = Query(None, description="individual, production_company, rental_house"),
    listing_type: Optional[str] = Query(None, description="Filter by listing type: rent, sale, or both"),
    available_from: Optional[date] = Query(None),
    available_to: Optional[date] = Query(None),
    group_by_org: bool = Query(False, description="Group results by organization/rental house"),
    priority_org_ids: Optional[str] = Query(None, description="Comma-separated org IDs to prioritize in results (e.g., cart items)"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user)
):
    """
    Search the marketplace for available gear (rental or sale).
    Returns listings from all enabled marketplace organizations.

    If group_by_org=true, results are grouped by organization with the structure:
    {
        "organizations": [
            {
                "id": "...",
                "name": "...",
                "is_priority": true/false,  // In cart
                "listings": [...]
            }
        ],
        "total": 123
    }
    """
    # Build the query dynamically based on filters
    conditions = ["ms.is_marketplace_enabled = TRUE", "ml.is_listed = TRUE"]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if q:
        conditions.append("(a.name ILIKE :q OR a.description ILIKE :q OR a.make ILIKE :q OR a.model ILIKE :q)")
        params["q"] = f"%{q}%"

    if category_id:
        conditions.append("a.category_id = :category_id")
        params["category_id"] = category_id

    if min_price is not None:
        # Price filter applies to daily_rate for rentals or sale_price for sales
        conditions.append("(ml.daily_rate >= :min_price OR ml.sale_price >= :min_price)")
        params["min_price"] = min_price

    if max_price is not None:
        conditions.append("(ml.daily_rate <= :max_price OR ml.sale_price <= :max_price)")
        params["max_price"] = max_price

    if location:
        conditions.append("ms.marketplace_location ILIKE :location")
        params["location"] = f"%{location}%"

    if lister_type:
        conditions.append("ms.lister_type = :lister_type")
        params["lister_type"] = lister_type

    # Filter by listing type: show rent listings, sale listings, or both
    if listing_type:
        if listing_type == "rent":
            conditions.append("(ml.listing_type = 'rent' OR ml.listing_type = 'both')")
        elif listing_type == "sale":
            conditions.append("(ml.listing_type = 'sale' OR ml.listing_type = 'both')")
        # If listing_type == 'both', don't add filter - show all

    where_clause = " AND ".join(conditions)

    # Get listings with organization and asset details
    listings = execute_query(
        f"""
        SELECT
            ml.id,
            ml.asset_id,
            ml.organization_id,
            ml.listing_type,
            ml.daily_rate,
            ml.weekly_rate,
            ml.monthly_rate,
            ml.deposit_amount,
            ml.deposit_percent,
            ml.insurance_required,
            ml.insurance_daily_rate,
            ml.min_rental_days,
            ml.max_rental_days,
            ml.rental_notes,
            ml.sale_price,
            ml.sale_condition,
            ml.sale_includes,
            ml.sale_negotiable,
            ml.created_at,
            a.name as asset_name,
            a.description as asset_description,
            a.make,
            a.model,
            a.manufacturer_serial as serial_number,
            a.barcode,
            a.status as asset_status,
            a.current_condition as asset_condition,
            c.name as category_name,
            c.id as category_id,
            o.name as organization_name,
            ms.marketplace_name,
            ms.marketplace_logo_url,
            ms.marketplace_location,
            ms.lister_type,
            ms.is_verified,
            ms.offers_delivery,
            a.photos_current as photos
        FROM gear_marketplace_listings ml
        JOIN gear_marketplace_settings ms ON ms.organization_id = ml.organization_id
        JOIN gear_assets a ON a.id = ml.asset_id
        JOIN organizations o ON o.id = ml.organization_id
        LEFT JOIN gear_categories c ON c.id = a.category_id
        WHERE {where_clause}
        ORDER BY ml.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    # Get total count
    count_result = execute_single(
        f"""
        SELECT COUNT(*) as total
        FROM gear_marketplace_listings ml
        JOIN gear_marketplace_settings ms ON ms.organization_id = ml.organization_id
        JOIN gear_assets a ON a.id = ml.asset_id
        WHERE {where_clause}
        """,
        params
    )

    # Transform flat results into nested structure expected by frontend
    transformed_listings = [transform_listing_to_nested(listing) for listing in listings]

    # Parse priority org IDs if provided
    priority_orgs = set()
    if priority_org_ids:
        priority_orgs = set(priority_org_ids.split(","))

    # If grouping by organization, restructure the response
    if group_by_org:
        # Group listings by organization
        org_groups: Dict[str, Dict[str, Any]] = {}

        for listing in transformed_listings:
            org_id = listing["organization_id"]
            if org_id not in org_groups:
                org_info = listing.get("organization", {})
                org_groups[org_id] = {
                    "id": org_id,
                    "name": org_info.get("name"),
                    "marketplace_name": org_info.get("marketplace_name"),
                    "logo_url": org_info.get("logo_url"),
                    "marketplace_location": org_info.get("marketplace_location"),
                    "lister_type": org_info.get("lister_type"),
                    "is_verified": org_info.get("is_verified", False),
                    "is_priority": org_id in priority_orgs,
                    "listings": [],
                }
            org_groups[org_id]["listings"].append(listing)

        # Sort organizations: priority first, then by name
        sorted_orgs = sorted(
            org_groups.values(),
            key=lambda x: (not x["is_priority"], x.get("marketplace_name") or x.get("name") or "")
        )

        return {
            "organizations": sorted_orgs,
            "total": count_result["total"] if count_result else 0,
            "limit": limit,
            "offset": offset
        }

    # If priority_org_ids provided but not grouping, just reorder listings
    if priority_orgs:
        # Sort with priority orgs first, maintaining relative order within each group
        priority_listings = [l for l in transformed_listings if l["organization_id"] in priority_orgs]
        other_listings = [l for l in transformed_listings if l["organization_id"] not in priority_orgs]
        transformed_listings = priority_listings + other_listings

    return {
        "listings": transformed_listings,
        "total": count_result["total"] if count_result else 0,
        "limit": limit,
        "offset": offset
    }


@router.get("/listings/{listing_id}")
async def get_listing_detail(
    listing_id: str,
    user=Depends(get_current_user)
):
    """Get detailed information about a specific listing."""
    listing = execute_single(
        """
        SELECT
            ml.*,
            a.name as asset_name,
            a.description as asset_description,
            a.make,
            a.model,
            a.manufacturer_serial as serial_number,
            a.barcode,
            a.status as asset_status,
            a.current_condition as asset_condition,
            a.notes as asset_notes,
            c.name as category_name,
            c.id as category_id,
            o.name as organization_name,
            ms.marketplace_name,
            ms.marketplace_description,
            ms.marketplace_logo_url,
            ms.marketplace_location,
            ms.marketplace_website,
            ms.lister_type,
            ms.is_verified,
            ms.offers_delivery,
            ms.delivery_radius_miles,
            ms.delivery_base_fee,
            ms.delivery_per_mile_fee,
            ms.extension_policy,
            ms.accepts_stripe,
            ms.accepts_invoice,
            ms.contact_email,
            ms.contact_phone,
            a.photos_current as photos
        FROM gear_marketplace_listings ml
        JOIN gear_marketplace_settings ms ON ms.organization_id = ml.organization_id
        JOIN gear_assets a ON a.id = ml.asset_id
        JOIN organizations o ON o.id = ml.organization_id
        LEFT JOIN gear_categories c ON c.id = a.category_id
        WHERE ml.id = :listing_id AND ml.is_listed = TRUE AND ms.is_marketplace_enabled = TRUE
        """,
        {"listing_id": listing_id}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Transform to nested structure expected by frontend
    return {"listing": transform_listing_to_nested(listing)}


@router.get("/organizations")
async def list_marketplace_organizations(
    lister_type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    verified_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user)
):
    """List all organizations with marketplace enabled."""
    conditions = ["ms.is_marketplace_enabled = TRUE"]
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if lister_type:
        conditions.append("ms.lister_type = :lister_type")
        params["lister_type"] = lister_type

    if location:
        conditions.append("ms.marketplace_location ILIKE :location")
        params["location"] = f"%{location}%"

    if verified_only:
        conditions.append("ms.is_verified = TRUE")

    where_clause = " AND ".join(conditions)

    organizations = execute_query(
        f"""
        SELECT
            o.id,
            o.name,
            ms.marketplace_name,
            ms.marketplace_description,
            ms.marketplace_logo_url,
            ms.marketplace_location,
            ms.marketplace_website,
            ms.lister_type,
            ms.is_verified,
            ms.offers_delivery,
            ms.accepts_stripe,
            ms.accepts_invoice,
            (SELECT COUNT(*) FROM gear_marketplace_listings ml WHERE ml.organization_id = o.id AND ml.is_listed = TRUE) as listing_count
        FROM gear_marketplace_settings ms
        JOIN organizations o ON o.id = ms.organization_id
        WHERE {where_clause}
        ORDER BY ms.is_verified DESC, o.name ASC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"organizations": organizations}


@router.get("/organizations/{org_id}")
async def get_marketplace_organization(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get a marketplace organization's profile and listings."""
    org = execute_single(
        """
        SELECT
            o.id,
            o.name,
            ms.marketplace_name,
            ms.marketplace_description,
            ms.marketplace_logo_url,
            ms.marketplace_location,
            ms.marketplace_website,
            ms.lister_type,
            ms.is_verified,
            ms.successful_rentals_count,
            ms.offers_delivery,
            ms.delivery_radius_miles,
            ms.delivery_base_fee,
            ms.extension_policy,
            ms.accepts_stripe,
            ms.accepts_invoice,
            ms.contact_email,
            ms.contact_phone
        FROM gear_marketplace_settings ms
        JOIN organizations o ON o.id = ms.organization_id
        WHERE o.id = :org_id AND ms.is_marketplace_enabled = TRUE
        """,
        {"org_id": org_id}
    )

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found or marketplace not enabled")

    # Get their listings
    listings = execute_query(
        """
        SELECT
            ml.id,
            ml.asset_id,
            ml.daily_rate,
            ml.weekly_rate,
            ml.monthly_rate,
            ml.min_rental_days,
            a.name as asset_name,
            a.make,
            a.model,
            a.status as asset_status,
            c.name as category_name,
            a.photos_current as photos
        FROM gear_marketplace_listings ml
        JOIN gear_assets a ON a.id = ml.asset_id
        LEFT JOIN gear_categories c ON c.id = a.category_id
        WHERE ml.organization_id = :org_id AND ml.is_listed = TRUE
        ORDER BY a.name ASC
        """,
        {"org_id": org_id}
    )

    return {"organization": org, "listings": listings}


@router.get("/organizations/{org_id}/delivery-options")
async def get_delivery_options(
    org_id: str,
    user=Depends(get_current_user)
):
    """
    Get delivery options for a marketplace organization.

    Returns available delivery methods (pickup, local delivery, shipping)
    with associated settings and pricing.
    """
    settings = execute_single(
        """
        SELECT
            allows_customer_pickup,
            pickup_address,
            pickup_instructions,
            pickup_hours,
            local_delivery_enabled,
            offers_delivery,
            delivery_radius_miles,
            delivery_base_fee,
            delivery_per_mile_fee,
            shipping_enabled,
            shipping_carriers,
            shipping_pricing_mode,
            flat_rate_shipping,
            free_shipping_threshold,
            ships_from_address,
            marketplace_location
        FROM gear_marketplace_settings
        WHERE organization_id = :org_id
        """,
        {"org_id": org_id}
    )

    if not settings:
        # Return defaults if no settings exist
        return {
            "allows_pickup": True,
            "pickup_address": None,
            "pickup_instructions": None,
            "pickup_hours": None,
            "local_delivery": {
                "enabled": False,
                "radius_miles": None,
                "base_fee": None,
                "per_mile_fee": None,
            },
            "shipping": {
                "enabled": False,
                "carriers": ["usps", "ups", "fedex"],
                "pricing_mode": "real_time",
                "flat_rates": None,
                "free_threshold": None,
            },
        }

    return {
        "allows_pickup": settings.get("allows_customer_pickup", True),
        "pickup_address": settings.get("pickup_address") or settings.get("marketplace_location"),
        "pickup_instructions": settings.get("pickup_instructions"),
        "pickup_hours": settings.get("pickup_hours"),
        "local_delivery": {
            "enabled": settings.get("local_delivery_enabled") or settings.get("offers_delivery", False),
            "radius_miles": settings.get("delivery_radius_miles"),
            "base_fee": float(settings["delivery_base_fee"]) if settings.get("delivery_base_fee") else None,
            "per_mile_fee": float(settings["delivery_per_mile_fee"]) if settings.get("delivery_per_mile_fee") else None,
        },
        "shipping": {
            "enabled": settings.get("shipping_enabled", False),
            "carriers": settings.get("shipping_carriers", ["usps", "ups", "fedex"]),
            "pricing_mode": settings.get("shipping_pricing_mode", "real_time"),
            "flat_rates": settings.get("flat_rate_shipping"),
            "free_threshold": float(settings["free_shipping_threshold"]) if settings.get("free_shipping_threshold") else None,
        },
    }


# ============================================================================
# ORGANIZATION MARKETPLACE SETTINGS
# ============================================================================

@router.get("/{org_id}/settings")
async def get_marketplace_settings(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get marketplace settings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    settings = execute_single(
        """
        SELECT * FROM gear_marketplace_settings
        WHERE organization_id = :org_id
        """,
        {"org_id": org_id}
    )

    if not settings:
        # Return defaults if no settings exist
        return {
            "settings": {
                "organization_id": org_id,
                "is_marketplace_enabled": False,
                "lister_type": "production_company",
                "extension_policy": "request_approve",
                "accepts_stripe": True,
                "accepts_invoice": True
            }
        }

    return {"settings": settings}


@router.put("/{org_id}/settings")
async def update_marketplace_settings(
    org_id: str,
    data: MarketplaceSettingsUpdate,
    user=Depends(get_current_user)
):
    """Update marketplace settings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner"])

    # Build update fields
    update_fields = []
    params: Dict[str, Any] = {"org_id": org_id}

    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            update_fields.append(f"{field} = :{field}")
            params[field] = value

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Upsert the settings
    result = execute_single(
        f"""
        INSERT INTO gear_marketplace_settings (organization_id, {", ".join(data.model_dump(exclude_unset=True).keys())})
        VALUES (:org_id, {", ".join(":" + k for k in data.model_dump(exclude_unset=True).keys())})
        ON CONFLICT (organization_id) DO UPDATE SET
            {", ".join(update_fields)},
            updated_at = NOW()
        RETURNING *
        """,
        params
    )

    return {"settings": result}


@router.post("/{org_id}/enable")
async def enable_marketplace(
    org_id: str,
    user=Depends(get_current_user)
):
    """Enable marketplace for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner"])

    result = execute_single(
        """
        INSERT INTO gear_marketplace_settings (organization_id, is_marketplace_enabled)
        VALUES (:org_id, TRUE)
        ON CONFLICT (organization_id) DO UPDATE SET
            is_marketplace_enabled = TRUE,
            updated_at = NOW()
        RETURNING *
        """,
        {"org_id": org_id}
    )

    return {"settings": result, "message": "Marketplace enabled"}


@router.post("/{org_id}/disable")
async def disable_marketplace(
    org_id: str,
    user=Depends(get_current_user)
):
    """Disable marketplace for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner"])

    result = execute_single(
        """
        UPDATE gear_marketplace_settings
        SET is_marketplace_enabled = FALSE, updated_at = NOW()
        WHERE organization_id = :org_id
        RETURNING *
        """,
        {"org_id": org_id}
    )

    return {"settings": result, "message": "Marketplace disabled"}


# ============================================================================
# LISTING MANAGEMENT
# ============================================================================

@router.get("/{org_id}/listings")
async def get_org_listings(
    org_id: str,
    include_unlisted: bool = Query(False),
    user=Depends(get_current_user)
):
    """Get all marketplace listings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    conditions = ["ml.organization_id = :org_id"]
    if not include_unlisted:
        conditions.append("ml.is_listed = TRUE")

    where_clause = " AND ".join(conditions)

    listings = execute_query(
        f"""
        SELECT
            ml.*,
            a.name as asset_name,
            a.description as asset_description,
            a.make,
            a.model,
            a.status as asset_status,
            a.current_condition as asset_condition,
            a.notes as asset_notes,
            c.name as category_name,
            c.id as category_id,
            a.photos_current as photos,
            o.name as organization_name,
            ms.marketplace_name,
            ms.marketplace_logo_url,
            ms.marketplace_location,
            ms.lister_type,
            ms.is_verified,
            ms.offers_delivery
        FROM gear_marketplace_listings ml
        JOIN gear_assets a ON a.id = ml.asset_id
        JOIN organizations o ON o.id = ml.organization_id
        JOIN gear_marketplace_settings ms ON ms.organization_id = ml.organization_id
        LEFT JOIN gear_categories c ON c.id = a.category_id
        WHERE {where_clause}
        ORDER BY a.name ASC
        """,
        {"org_id": org_id}
    )

    # Transform to nested structure expected by frontend
    transformed_listings = [transform_listing_to_nested(listing) for listing in listings]

    return {"listings": transformed_listings}


@router.post("/{org_id}/listings")
async def create_listing(
    org_id: str,
    data: CreateListingRequest,
    user=Depends(get_current_user)
):
    """Create a marketplace listing for an asset."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner", "manager"])

    # Verify asset belongs to org
    asset = execute_single(
        "SELECT id, organization_id FROM gear_assets WHERE id = :asset_id",
        {"asset_id": data.asset_id}
    )

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if asset["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Asset does not belong to this organization")

    # Check if listing already exists
    existing = execute_single(
        "SELECT id FROM gear_marketplace_listings WHERE asset_id = :asset_id",
        {"asset_id": data.asset_id}
    )

    if existing:
        raise HTTPException(status_code=400, detail="Asset already has a marketplace listing")

    # Validate asset has photos
    if not validate_asset_has_photos(data.asset_id):
        raise HTTPException(
            status_code=400,
            detail="Asset must have at least one photo to be listed on the marketplace"
        )

    # Validate listing type and required pricing
    validate_listing_type_pricing(data.listing_type, data.daily_rate, data.sale_price)

    # Create listing
    listing = execute_insert(
        """
        INSERT INTO gear_marketplace_listings (
            asset_id, organization_id, listing_type,
            daily_rate, weekly_rate, monthly_rate,
            weekly_discount_percent, monthly_discount_percent,
            quantity_discount_threshold, quantity_discount_percent,
            deposit_amount, deposit_percent,
            insurance_required, insurance_daily_rate,
            min_rental_days, max_rental_days, advance_booking_days,
            rental_notes, pickup_instructions,
            sale_price, sale_condition, sale_includes, sale_negotiable
        ) VALUES (
            :asset_id, :org_id, :listing_type,
            :daily_rate, :weekly_rate, :monthly_rate,
            :weekly_discount_percent, :monthly_discount_percent,
            :quantity_discount_threshold, :quantity_discount_percent,
            :deposit_amount, :deposit_percent,
            :insurance_required, :insurance_daily_rate,
            :min_rental_days, :max_rental_days, :advance_booking_days,
            :rental_notes, :pickup_instructions,
            :sale_price, :sale_condition, :sale_includes, :sale_negotiable
        )
        RETURNING *
        """,
        {
            "asset_id": data.asset_id,
            "org_id": org_id,
            **data.model_dump(exclude={"asset_id"})
        }
    )

    return {"listing": listing}


@router.put("/{org_id}/listings/{listing_id}")
async def update_listing(
    org_id: str,
    listing_id: str,
    data: UpdateListingRequest,
    user=Depends(get_current_user)
):
    """Update a marketplace listing."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner", "manager"])

    # Verify listing belongs to org
    existing = execute_single(
        "SELECT id, organization_id FROM gear_marketplace_listings WHERE id = :listing_id",
        {"listing_id": listing_id}
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if existing["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Listing does not belong to this organization")

    # Build update
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in update_data.keys())
    update_data["listing_id"] = listing_id

    # Handle delisted_at
    if "is_listed" in update_data and not update_data["is_listed"]:
        set_clause += ", delisted_at = NOW()"
    elif "is_listed" in update_data and update_data["is_listed"]:
        set_clause += ", delisted_at = NULL"

    listing = execute_single(
        f"""
        UPDATE gear_marketplace_listings
        SET {set_clause}, updated_at = NOW()
        WHERE id = :listing_id
        RETURNING *
        """,
        update_data
    )

    return {"listing": listing}


@router.delete("/{org_id}/listings/{listing_id}")
async def delete_listing(
    org_id: str,
    listing_id: str,
    user=Depends(get_current_user)
):
    """Delete a marketplace listing."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner", "manager"])

    # Verify listing belongs to org
    existing = execute_single(
        "SELECT id, organization_id FROM gear_marketplace_listings WHERE id = :listing_id",
        {"listing_id": listing_id}
    )

    if not existing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if existing["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Listing does not belong to this organization")

    execute_query(
        "DELETE FROM gear_marketplace_listings WHERE id = :listing_id",
        {"listing_id": listing_id}
    )

    return {"message": "Listing deleted"}


@router.post("/{org_id}/listings/bulk")
async def bulk_create_listings(
    org_id: str,
    data: BulkListRequest,
    user=Depends(get_current_user)
):
    """
    Create marketplace listings for multiple assets at once.

    Supports two formats:
    1. Per-asset rates: { "listings": [{ "asset_id": "...", "daily_rate": 150, ... }, ...] }
    2. Default settings (legacy): { "asset_ids": [...], "daily_rate": 150, ... }
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner", "manager"])

    # Determine which format is being used
    if data.listings:
        # New format: per-asset rates
        asset_ids = [item.asset_id for item in data.listings]
        listings_map = {item.asset_id: item for item in data.listings}
    elif data.asset_ids:
        # Legacy format: same rate for all
        if data.daily_rate is None:
            raise HTTPException(status_code=400, detail="daily_rate is required when using asset_ids format")
        asset_ids = data.asset_ids
        listings_map = None
    else:
        raise HTTPException(status_code=400, detail="Either 'listings' or 'asset_ids' must be provided")

    # Verify all assets belong to org
    # Build parameterized IN clause to avoid ::uuid[] cast issues with SQLAlchemy text()
    asset_placeholders = ", ".join(f":asset_id_{i}" for i in range(len(asset_ids)))
    asset_params = {f"asset_id_{i}": aid for i, aid in enumerate(asset_ids)}
    asset_params["org_id"] = org_id

    assets = execute_query(
        f"""
        SELECT id FROM gear_assets
        WHERE id IN ({asset_placeholders}) AND organization_id = :org_id
        """,
        asset_params
    )

    valid_asset_ids = {a["id"] for a in assets}
    invalid_ids = set(asset_ids) - valid_asset_ids

    if invalid_ids:
        raise HTTPException(status_code=400, detail=f"Some assets not found or don't belong to org: {list(invalid_ids)}")

    # Check for existing listings
    existing = execute_query(
        f"""
        SELECT asset_id FROM gear_marketplace_listings
        WHERE asset_id IN ({asset_placeholders})
        """,
        asset_params
    )

    already_listed = {e["asset_id"] for e in existing}

    # Check photos for all assets that will be listed
    assets_to_list = [aid for aid in asset_ids if aid not in already_listed]
    assets_without_photos = []
    for asset_id in assets_to_list:
        if not validate_asset_has_photos(asset_id):
            assets_without_photos.append(asset_id)

    if assets_without_photos:
        raise HTTPException(
            status_code=400,
            detail=f"The following assets need photos before they can be listed: {assets_without_photos}"
        )

    # Create listings for assets not already listed
    created = []
    for asset_id in asset_ids:
        if asset_id not in already_listed:
            if listings_map:
                # Per-asset rates (new format)
                item = listings_map[asset_id]
                # Validate pricing based on listing type
                validate_listing_type_pricing(item.listing_type, item.daily_rate, item.sale_price)
                listing = execute_insert(
                    """
                    INSERT INTO gear_marketplace_listings (
                        asset_id, organization_id, listing_type,
                        daily_rate, weekly_rate, monthly_rate,
                        deposit_amount, deposit_percent, insurance_required, min_rental_days, rental_notes,
                        sale_price, sale_condition, sale_includes, sale_negotiable
                    ) VALUES (
                        :asset_id, :org_id, :listing_type,
                        :daily_rate, :weekly_rate, :monthly_rate,
                        :deposit_amount, :deposit_percent, :insurance_required, :min_rental_days, :rental_notes,
                        :sale_price, :sale_condition, :sale_includes, :sale_negotiable
                    )
                    RETURNING *
                    """,
                    {
                        "asset_id": asset_id,
                        "org_id": org_id,
                        "listing_type": item.listing_type,
                        "daily_rate": item.daily_rate,
                        "weekly_rate": item.weekly_rate,
                        "monthly_rate": item.monthly_rate,
                        "deposit_amount": item.deposit_amount,
                        "deposit_percent": item.deposit_percent,
                        "insurance_required": item.insurance_required,
                        "min_rental_days": item.min_rental_days,
                        "rental_notes": item.rental_notes,
                        "sale_price": item.sale_price,
                        "sale_condition": item.sale_condition,
                        "sale_includes": item.sale_includes,
                        "sale_negotiable": item.sale_negotiable
                    }
                )
            else:
                # Default settings (legacy format) - only supports rent type
                listing = execute_insert(
                    """
                    INSERT INTO gear_marketplace_listings (
                        asset_id, organization_id, listing_type,
                        daily_rate, weekly_rate, monthly_rate,
                        deposit_percent, insurance_required
                    ) VALUES (
                        :asset_id, :org_id, 'rent',
                        :daily_rate, :weekly_rate, :monthly_rate,
                        :deposit_percent, :insurance_required
                    )
                    RETURNING *
                    """,
                    {
                        "asset_id": asset_id,
                        "org_id": org_id,
                        "daily_rate": data.daily_rate,
                        "weekly_rate": data.weekly_rate,
                        "monthly_rate": data.monthly_rate,
                        "deposit_percent": data.deposit_percent,
                        "insurance_required": data.insurance_required
                    }
                )
            created.append(listing)

    return {
        "created": created,
        "created_count": len(created),
        "skipped_count": len(already_listed),
        "skipped_asset_ids": list(already_listed)
    }


# ============================================================================
# AVAILABILITY
# ============================================================================

@router.get("/{org_id}/listings/{listing_id}/availability")
async def get_listing_availability(
    org_id: str,
    listing_id: str,
    start_date: date = Query(...),
    end_date: date = Query(...),
    user=Depends(get_current_user)
):
    """Check availability for a listing over a date range."""
    listing = execute_single(
        """
        SELECT ml.*, a.status as asset_status
        FROM gear_marketplace_listings ml
        JOIN gear_assets a ON a.id = ml.asset_id
        WHERE ml.id = :listing_id
        """,
        {"listing_id": listing_id}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Check if asset is available (not checked out, not under repair, etc.)
    asset_available = listing["asset_status"] in ["available", "reserved"]

    # Check for overlapping rentals
    overlapping_rentals = execute_query(
        """
        SELECT ro.id, ro.rental_start_date, ro.rental_end_date
        FROM gear_rental_orders ro
        JOIN gear_rental_order_items roi ON roi.order_id = ro.id
        WHERE roi.asset_id = :asset_id
          AND ro.status IN ('confirmed', 'in_progress')
          AND ro.rental_start_date <= :end_date
          AND ro.rental_end_date >= :start_date
        """,
        {
            "asset_id": listing["asset_id"],
            "start_date": start_date,
            "end_date": end_date
        }
    )

    # Check blackout dates
    blackout_dates = listing.get("blackout_dates", []) or []
    in_blackout = False
    for bd in blackout_dates:
        if bd.get("start") and bd.get("end"):
            bd_start = datetime.strptime(bd["start"], "%Y-%m-%d").date()
            bd_end = datetime.strptime(bd["end"], "%Y-%m-%d").date()
            if bd_start <= end_date and bd_end >= start_date:
                in_blackout = True
                break

    is_available = asset_available and len(overlapping_rentals) == 0 and not in_blackout

    return {
        "listing_id": listing_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "is_available": is_available,
        "asset_available": asset_available,
        "has_overlapping_rentals": len(overlapping_rentals) > 0,
        "overlapping_rentals": overlapping_rentals if overlapping_rentals else None,
        "in_blackout_period": in_blackout
    }


@router.post("/{org_id}/listings/{listing_id}/blackout-dates")
async def add_blackout_dates(
    org_id: str,
    listing_id: str,
    data: BlackoutDateRequest,
    user=Depends(get_current_user)
):
    """Add blackout dates to a listing."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner", "manager"])

    # Verify listing belongs to org
    listing = execute_single(
        "SELECT id, organization_id, blackout_dates FROM gear_marketplace_listings WHERE id = :listing_id",
        {"listing_id": listing_id}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Listing does not belong to this organization")

    # Add new blackout period
    blackout_dates = listing.get("blackout_dates", []) or []
    blackout_dates.append({
        "start": data.start_date.isoformat(),
        "end": data.end_date.isoformat(),
        "reason": data.reason
    })

    result = execute_single(
        """
        UPDATE gear_marketplace_listings
        SET blackout_dates = :blackout_dates::jsonb, updated_at = NOW()
        WHERE id = :listing_id
        RETURNING *
        """,
        {"listing_id": listing_id, "blackout_dates": blackout_dates}
    )

    return {"listing": result}


# ============================================================================
# RENTER REPUTATION
# ============================================================================

@router.get("/reputation/{org_id}")
async def get_renter_reputation(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get renter reputation for an organization."""
    reputation = execute_single(
        """
        SELECT * FROM gear_renter_reputation
        WHERE organization_id = :org_id
        """,
        {"org_id": org_id}
    )

    if not reputation:
        return {
            "reputation": {
                "organization_id": org_id,
                "total_rentals": 0,
                "successful_rentals": 0,
                "late_returns": 0,
                "damage_incidents": 0,
                "is_verified": False
            }
        }

    return {"reputation": reputation}
