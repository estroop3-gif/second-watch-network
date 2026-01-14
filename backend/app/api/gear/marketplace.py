"""
Gear House Marketplace API

Endpoints for browsing, listing, and managing the gear rental marketplace.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_delete

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
    organization_id: Optional[str] = Query(None, description="Filter to only listings from this organization"),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    location: Optional[str] = Query(None),
    lister_type: Optional[str] = Query(None, description="individual, production_company, rental_house"),
    listing_type: Optional[str] = Query(None, description="Filter by listing type: rent, sale, or both"),
    available_from: Optional[date] = Query(None),
    available_to: Optional[date] = Query(None),
    timezone: Optional[str] = Query(None, description="User's timezone (e.g., 'America/Los_Angeles')"),
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
    # Validate and normalize date range
    # If only one date is provided, use it for both start and end (single day)
    if available_from or available_to:
        # Set defaults for missing dates
        if available_from and not available_to:
            # Only start date: Check availability for just that date
            available_to = available_from
        elif available_to and not available_from:
            # Only end date: Check availability for just that date
            available_from = available_to

        # Validate date range
        if available_from > available_to:
            raise HTTPException(status_code=400, detail="available_from must be before available_to")
        if available_from < date.today():
            raise HTTPException(status_code=400, detail="Dates must be in the future")
        if (available_to - available_from).days > 90:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

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

    if organization_id:
        conditions.append("ml.organization_id = :organization_id")
        params["organization_id"] = organization_id

    # Filter by listing type: show rent listings, sale listings, or both
    if listing_type:
        if listing_type == "rent":
            conditions.append("(ml.listing_type = 'rent' OR ml.listing_type = 'both')")
        elif listing_type == "sale":
            conditions.append("(ml.listing_type = 'sale' OR ml.listing_type = 'both')")
        # If listing_type == 'both', don't add filter - show all

    # Date availability filtering (applies if either date provided)
    if available_from or available_to:
        # Use user's timezone if provided, otherwise default to UTC
        tz = timezone if timezone else 'UTC'

        conditions.append(f"""
            -- Exclude permanently unavailable assets only
            -- Allow checked_out/under_repair/in_transit if dates don't overlap
            a.status NOT IN ('retired', 'lost')

            -- Filter out assets with overlapping rental orders
            AND NOT EXISTS (
                SELECT 1 FROM gear_rental_orders ro
                JOIN gear_rental_order_items roi ON roi.order_id = ro.id
                WHERE roi.asset_id = ml.asset_id
                  AND ro.status IN ('confirmed', 'building', 'packed',
                                   'ready_for_pickup', 'picked_up', 'in_use')
                  AND ro.rental_start_date <= :available_to
                  AND ro.rental_end_date >= :available_from
            )

            -- Filter out assets with overlapping internal checkouts
            -- Includes both active checkouts and scheduled future checkouts
            -- Uses user's timezone ({tz}) for TIMESTAMPTZ comparison
            AND NOT EXISTS (
                SELECT 1 FROM gear_transactions gt
                JOIN gear_transaction_items gti ON gti.transaction_id = gt.id
                WHERE gti.asset_id = ml.asset_id
                  AND gt.organization_id = ml.organization_id
                  AND gt.transaction_type = 'internal_checkout'
                  AND gt.status IN ('pending', 'in_progress')
                  AND gt.returned_at IS NULL
                  AND gt.scheduled_at IS NOT NULL
                  AND gt.expected_return_at IS NOT NULL
                  AND DATE(gt.scheduled_at AT TIME ZONE '{tz}') <= :available_to
                  AND DATE(gt.expected_return_at AT TIME ZONE '{tz}') >= :available_from
            )

            -- Filter out assets in work orders
            -- ALWAYS blocks checked-out work orders (asset physically with custodian)
            -- Conditionally blocks pre-checkout work orders based on rental house setting
            AND NOT EXISTS (
                SELECT 1 FROM gear_work_orders wo
                JOIN gear_work_order_items woi ON woi.work_order_id = wo.id
                LEFT JOIN gear_marketplace_settings gms ON gms.organization_id = wo.organization_id
                WHERE woi.asset_id = ml.asset_id
                  AND wo.organization_id = ml.organization_id
                  AND wo.expected_return_date IS NOT NULL
                  AND wo.pickup_date <= :available_to
                  AND wo.expected_return_date >= :available_from
                  AND (
                    -- Always block checked-out work orders (mandatory)
                    wo.status = 'checked_out'
                    OR
                    -- Conditionally block pre-checkout work orders (optional, rental house setting)
                    (wo.status IN ('in_progress', 'ready')
                     AND COALESCE(gms.work_order_reserves_dates, FALSE) = TRUE)
                  )
            )
        """)
        params["available_from"] = available_from
        params["available_to"] = available_to

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

    # Filter blackout dates if date range provided
    if available_from and available_to:
        filtered_listings = []
        for listing in listings:
            # Get blackout dates for this listing
            blackout_result = execute_single(
                "SELECT blackout_dates FROM gear_marketplace_listings WHERE id = :id",
                {"id": listing["id"]}
            )

            if blackout_result:
                blackout_dates = blackout_result.get("blackout_dates", []) or []
                is_blacked_out = False

                for bd in blackout_dates:
                    if bd.get("start") and bd.get("end"):
                        try:
                            bd_start = datetime.strptime(bd["start"], "%Y-%m-%d").date()
                            bd_end = datetime.strptime(bd["end"], "%Y-%m-%d").date()
                            if bd_start <= available_to and bd_end >= available_from:
                                is_blacked_out = True
                                break
                        except (ValueError, TypeError):
                            continue

                if not is_blacked_out:
                    filtered_listings.append(listing)
            else:
                filtered_listings.append(listing)

        listings = filtered_listings

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


class ReportListingInput(BaseModel):
    reason: str  # spam, fraud, prohibited_item, misleading, other
    details: Optional[str] = None
    reporter_id: str


@router.post("/listings/{listing_id}/report")
async def report_listing(
    listing_id: str,
    data: ReportListingInput,
    user=Depends(get_current_user)
):
    """Report a marketplace listing for review."""
    # Verify the listing exists
    listing = execute_single(
        """
        SELECT id, organization_id, asset_id FROM gear_marketplace_listings
        WHERE id = :listing_id
        """,
        {"listing_id": listing_id}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    # Insert the report
    try:
        execute_insert(
            """
            INSERT INTO gear_marketplace_reports (
                listing_id,
                reporter_id,
                reason,
                details,
                status,
                created_at
            ) VALUES (
                :listing_id,
                :reporter_id,
                :reason,
                :details,
                'pending',
                NOW()
            )
            RETURNING id
            """,
            {
                "listing_id": listing_id,
                "reporter_id": data.reporter_id,
                "reason": data.reason,
                "details": data.details,
            }
        )
    except Exception as e:
        # If the table doesn't exist, log and return success anyway
        # (report feature will be available after migration)
        print(f"Warning: Could not insert report - {e}")
        pass

    return {"success": True, "message": "Report submitted successfully"}


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

    # Prepare data, setting defaults for sale-only listings
    listing_data = data.model_dump(exclude={"asset_id"})

    # For sale-only listings, set daily_rate to 0 if not provided (DB has NOT NULL constraint)
    if data.listing_type == "sale" and listing_data.get("daily_rate") is None:
        listing_data["daily_rate"] = 0

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
            **listing_data
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

    execute_delete(
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


# ============================================================================
# LOCATION-BASED SEARCH
# ============================================================================

class MarketplacePreferencesUpdate(BaseModel):
    """Update marketplace search preferences."""
    search_latitude: Optional[float] = None
    search_longitude: Optional[float] = None
    search_location_name: Optional[str] = None
    location_source: Optional[str] = None  # 'browser', 'profile', 'manual'
    search_radius_miles: Optional[int] = None  # 25, 50, 100, 250
    view_mode: Optional[str] = None  # 'map', 'grid', 'list'
    result_mode: Optional[str] = None  # 'gear_houses', 'gear_items'
    delivery_to_me_only: Optional[bool] = None


@router.get("/search/nearby")
async def search_marketplace_nearby(
    lat: float = Query(..., ge=-90, le=90, description="User latitude"),
    lng: float = Query(..., ge=-180, le=180, description="User longitude"),
    radius_miles: int = Query(50, description="Search radius in miles"),
    result_mode: str = Query("gear_houses", description="Return gear_houses or gear_items"),
    delivery_to_me_only: bool = Query(False, description="Only show gear houses that deliver to user"),
    q: Optional[str] = Query(None, description="Search query"),
    category_id: Optional[str] = Query(None),
    lister_type: Optional[str] = Query(None),
    verified_only: bool = Query(False),
    available_from: Optional[date] = Query(None, description="Filter by availability start date"),
    available_to: Optional[date] = Query(None, description="Filter by availability end date"),
    timezone: Optional[str] = Query(None, description="User's timezone (e.g., 'America/Los_Angeles')"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user)
):
    """
    Search marketplace with proximity sorting using Haversine formula.
    Returns either gear houses or individual gear items based on result_mode.
    """
    # Validate and normalize date range
    # If only one date is provided, use it for both start and end (single day)
    if available_from or available_to:
        # Set defaults for missing dates
        if available_from and not available_to:
            # Only start date: Check availability for just that date
            available_to = available_from
        elif available_to and not available_from:
            # Only end date: Check availability for just that date
            available_from = available_to

        # Validate date range
        if available_from > available_to:
            raise HTTPException(status_code=400, detail="available_from must be before available_to")
        if available_from < date.today():
            raise HTTPException(status_code=400, detail="Dates must be in the future")
        if (available_to - available_from).days > 90:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    profile_id = get_profile_id(user)
    params: Dict[str, Any] = {
        "user_lat": lat,
        "user_lng": lng,
        "radius_miles": radius_miles,
        "limit": limit,
        "offset": offset
    }

    # Build conditions
    conditions = [
        "ms.is_marketplace_enabled = TRUE",
        "ms.location_latitude IS NOT NULL",
        "ms.location_longitude IS NOT NULL"
    ]

    if verified_only:
        conditions.append("ms.is_verified = TRUE")

    if lister_type:
        conditions.append("ms.lister_type = :lister_type")
        params["lister_type"] = lister_type

    if delivery_to_me_only:
        conditions.append("ms.offers_delivery = TRUE")
        conditions.append("ms.delivery_radius_miles >= haversine_distance_miles(:user_lat, :user_lng, ms.location_latitude, ms.location_longitude)")

    where_clause = " AND ".join(conditions)

    if result_mode == "gear_houses":
        # Return gear houses sorted by distance
        query = f"""
            WITH gear_house_data AS (
                SELECT
                    o.id,
                    o.name,
                    ms.marketplace_name,
                    ms.marketplace_description,
                    ms.marketplace_logo_url,
                    CASE WHEN ms.hide_exact_address THEN ms.public_location_display ELSE ms.marketplace_location END as location_display,
                    ms.location_latitude,
                    ms.location_longitude,
                    ms.lister_type,
                    ms.is_verified,
                    ms.offers_delivery,
                    ms.delivery_radius_miles,
                    ms.delivery_base_fee,
                    ms.delivery_per_mile_fee,
                    ms.contact_email,
                    ms.contact_phone,
                    haversine_distance_miles(:user_lat, :user_lng, ms.location_latitude, ms.location_longitude) as distance_miles,
                    (SELECT COUNT(*) FROM gear_marketplace_listings ml WHERE ml.organization_id = o.id AND ml.is_listed = TRUE) as listing_count,
                    EXISTS(SELECT 1 FROM gear_house_favorites f WHERE f.organization_id = o.id AND f.profile_id = :profile_id) as is_favorited
                FROM organizations o
                JOIN gear_marketplace_settings ms ON ms.organization_id = o.id
                WHERE {where_clause}
                  AND haversine_distance_miles(:user_lat, :user_lng, ms.location_latitude, ms.location_longitude) <= :radius_miles
            )
            SELECT *
            FROM gear_house_data
            WHERE listing_count > 0
            ORDER BY distance_miles ASC
            LIMIT :limit OFFSET :offset
        """
        params["profile_id"] = profile_id
        gear_houses = execute_query(query, params)

        # Enrich with top categories and featured items
        enriched = []
        for gh in gear_houses:
            # Get top categories
            top_categories = execute_query(
                """
                SELECT c.id, c.name, COUNT(*) as count
                FROM gear_marketplace_listings ml
                JOIN gear_assets a ON a.id = ml.asset_id
                JOIN gear_categories c ON c.id = a.category_id
                WHERE ml.organization_id = :org_id AND ml.is_listed = TRUE
                GROUP BY c.id, c.name
                ORDER BY count DESC
                LIMIT 4
                """,
                {"org_id": gh["id"]}
            )

            # Get featured items (up to 4)
            featured_items = execute_query(
                """
                SELECT
                    ml.id, ml.daily_rate, ml.weekly_rate, ml.monthly_rate,
                    a.id as asset_id, a.name, a.photos_current as photos
                FROM gear_marketplace_listings ml
                JOIN gear_assets a ON a.id = ml.asset_id
                WHERE ml.organization_id = :org_id AND ml.is_listed = TRUE
                ORDER BY ml.created_at DESC
                LIMIT 4
                """,
                {"org_id": gh["id"]}
            )

            # Calculate delivery eligibility
            can_deliver = False
            estimated_delivery_fee = None
            if gh.get("offers_delivery") and gh.get("delivery_radius_miles"):
                if gh["distance_miles"] and gh["distance_miles"] <= gh["delivery_radius_miles"]:
                    can_deliver = True
                    base_fee = float(gh.get("delivery_base_fee") or 0)
                    per_mile = float(gh.get("delivery_per_mile_fee") or 0)
                    estimated_delivery_fee = base_fee + (per_mile * gh["distance_miles"])

            enriched.append({
                **gh,
                "distance_miles": round(float(gh["distance_miles"]), 1) if gh["distance_miles"] else None,
                "can_deliver_to_user": can_deliver,
                "estimated_delivery_fee": round(estimated_delivery_fee, 2) if estimated_delivery_fee else None,
                "top_categories": top_categories,
                "featured_items": [
                    {
                        "id": fi["id"],
                        "asset_id": fi["asset_id"],
                        "name": fi["name"],
                        "daily_rate": fi["daily_rate"],
                        "photo_url": fi["photos"][0] if fi.get("photos") else None
                    }
                    for fi in featured_items
                ]
            })

        # Get total count
        count_query = f"""
            SELECT COUNT(*) as total
            FROM organizations o
            JOIN gear_marketplace_settings ms ON ms.organization_id = o.id
            WHERE {where_clause}
              AND haversine_distance_miles(:user_lat, :user_lng, ms.location_latitude, ms.location_longitude) <= :radius_miles
              AND (SELECT COUNT(*) FROM gear_marketplace_listings ml WHERE ml.organization_id = o.id AND ml.is_listed = TRUE) > 0
        """
        count_result = execute_single(count_query, params)

        return {
            "gear_houses": enriched,
            "total": count_result["total"] if count_result else 0,
            "user_location": {"lat": lat, "lng": lng},
            "radius_miles": radius_miles
        }

    else:
        # Return gear items sorted by distance
        item_conditions = conditions + ["ml.is_listed = TRUE"]
        if q:
            item_conditions.append("(a.name ILIKE :q OR a.description ILIKE :q OR a.make ILIKE :q OR a.model ILIKE :q)")
            params["q"] = f"%{q}%"
        if category_id:
            item_conditions.append("a.category_id = :category_id")
            params["category_id"] = category_id

        # Date availability filtering (applies if either date provided)
        if available_from or available_to:
            # Use user's timezone if provided, otherwise default to UTC
            tz = timezone if timezone else 'UTC'

            item_conditions.append(f"""
                -- Exclude permanently unavailable assets only
                -- Allow checked_out/under_repair/in_transit if dates don't overlap
                a.status NOT IN ('retired', 'lost')

                -- Filter out assets with overlapping rental orders
                AND NOT EXISTS (
                    SELECT 1 FROM gear_rental_orders ro
                    JOIN gear_rental_order_items roi ON roi.order_id = ro.id
                    WHERE roi.asset_id = ml.asset_id
                      AND ro.status IN ('confirmed', 'building', 'packed',
                                       'ready_for_pickup', 'picked_up', 'in_use')
                      AND ro.rental_start_date <= :available_to
                      AND ro.rental_end_date >= :available_from
                )

                -- Filter out assets with overlapping internal checkouts
                -- Includes both active checkouts and scheduled future checkouts
                -- Uses user's timezone ({tz}) for TIMESTAMPTZ comparison
                AND NOT EXISTS (
                    SELECT 1 FROM gear_transactions gt
                    JOIN gear_transaction_items gti ON gti.transaction_id = gt.id
                    WHERE gti.asset_id = ml.asset_id
                      AND gt.organization_id = ml.organization_id
                      AND gt.transaction_type = 'internal_checkout'
                      AND gt.status IN ('pending', 'in_progress')
                      AND gt.returned_at IS NULL
                      AND gt.scheduled_at IS NOT NULL
                      AND gt.expected_return_at IS NOT NULL
                      AND DATE(gt.scheduled_at AT TIME ZONE '{tz}') <= :available_to
                      AND DATE(gt.expected_return_at AT TIME ZONE '{tz}') >= :available_from
                )

                -- Filter out assets in work orders
                AND NOT EXISTS (
                    SELECT 1 FROM gear_work_orders wo
                    JOIN gear_work_order_items woi ON woi.work_order_id = wo.id
                    LEFT JOIN gear_marketplace_settings gms ON gms.organization_id = wo.organization_id
                    WHERE woi.asset_id = ml.asset_id
                      AND wo.organization_id = ml.organization_id
                      AND wo.expected_return_date IS NOT NULL
                      AND wo.pickup_date <= :available_to
                      AND wo.expected_return_date >= :available_from
                      AND (
                        wo.status = 'checked_out'
                        OR
                        (wo.status IN ('in_progress', 'ready')
                         AND COALESCE(gms.work_order_reserves_dates, FALSE) = TRUE)
                      )
                )
            """)
            params["available_from"] = available_from
            params["available_to"] = available_to

        item_where = " AND ".join(item_conditions)

        listings = execute_query(
            f"""
            SELECT
                ml.*,
                a.name as asset_name,
                a.description as asset_description,
                a.make, a.model,
                a.photos_current as photos,
                a.category_id,
                c.name as category_name,
                o.id as org_id,
                o.name as organization_name,
                ms.marketplace_name,
                ms.marketplace_logo_url,
                CASE WHEN ms.hide_exact_address THEN ms.public_location_display ELSE ms.marketplace_location END as location_display,
                ms.lister_type,
                ms.is_verified,
                ms.offers_delivery,
                ms.delivery_radius_miles,
                haversine_distance_miles(:user_lat, :user_lng, ms.location_latitude, ms.location_longitude) as distance_miles
            FROM gear_marketplace_listings ml
            JOIN gear_marketplace_settings ms ON ms.organization_id = ml.organization_id
            JOIN gear_assets a ON a.id = ml.asset_id
            JOIN organizations o ON o.id = ml.organization_id
            LEFT JOIN gear_categories c ON c.id = a.category_id
            WHERE {item_where}
              AND haversine_distance_miles(:user_lat, :user_lng, ms.location_latitude, ms.location_longitude) <= :radius_miles
            ORDER BY distance_miles ASC
            LIMIT :limit OFFSET :offset
            """,
            params
        )

        # Transform and add distance info
        transformed = []
        for listing in listings:
            can_deliver = False
            if listing.get("offers_delivery") and listing.get("delivery_radius_miles"):
                if listing["distance_miles"] and listing["distance_miles"] <= listing["delivery_radius_miles"]:
                    can_deliver = True

            transformed.append({
                **transform_listing_to_nested(listing),
                "distance_miles": round(float(listing["distance_miles"]), 1) if listing["distance_miles"] else None,
                "can_deliver_to_user": can_deliver,
                "location_display": listing.get("location_display")
            })

        # Get total count
        count_result = execute_single(
            f"""
            SELECT COUNT(*) as total
            FROM gear_marketplace_listings ml
            JOIN gear_marketplace_settings ms ON ms.organization_id = ml.organization_id
            JOIN gear_assets a ON a.id = ml.asset_id
            WHERE {item_where}
              AND haversine_distance_miles(:user_lat, :user_lng, ms.location_latitude, ms.location_longitude) <= :radius_miles
            """,
            params
        )

        return {
            "listings": transformed,
            "total": count_result["total"] if count_result else 0,
            "user_location": {"lat": lat, "lng": lng},
            "radius_miles": radius_miles
        }


# ============================================================================
# MARKETPLACE SEARCH PREFERENCES
# ============================================================================

@router.get("/preferences/{project_id}")
async def get_marketplace_preferences(
    project_id: str,
    user=Depends(get_current_user)
):
    """Get user's marketplace search preferences for a project."""
    profile_id = get_profile_id(user)

    prefs = execute_single(
        """
        SELECT * FROM gear_marketplace_search_preferences
        WHERE project_id = :project_id AND profile_id = :profile_id
        """,
        {"project_id": project_id, "profile_id": profile_id}
    )

    if not prefs:
        # Return defaults
        return {
            "preferences": {
                "project_id": project_id,
                "profile_id": profile_id,
                "search_latitude": None,
                "search_longitude": None,
                "search_location_name": None,
                "location_source": "profile",
                "search_radius_miles": 50,
                "view_mode": "grid",
                "result_mode": "gear_houses",
                "delivery_to_me_only": False
            }
        }

    return {"preferences": prefs}


@router.put("/preferences/{project_id}")
async def update_marketplace_preferences(
    project_id: str,
    data: MarketplacePreferencesUpdate,
    user=Depends(get_current_user)
):
    """Update user's marketplace search preferences for a project."""
    profile_id = get_profile_id(user)

    # Build update fields
    update_fields = []
    params = {"project_id": project_id, "profile_id": profile_id}

    if data.search_latitude is not None:
        update_fields.append("search_latitude = :search_latitude")
        params["search_latitude"] = data.search_latitude
    if data.search_longitude is not None:
        update_fields.append("search_longitude = :search_longitude")
        params["search_longitude"] = data.search_longitude
    if data.search_location_name is not None:
        update_fields.append("search_location_name = :search_location_name")
        params["search_location_name"] = data.search_location_name
    if data.location_source is not None:
        update_fields.append("location_source = :location_source")
        params["location_source"] = data.location_source
    if data.search_radius_miles is not None:
        update_fields.append("search_radius_miles = :search_radius_miles")
        params["search_radius_miles"] = data.search_radius_miles
    if data.view_mode is not None:
        update_fields.append("view_mode = :view_mode")
        params["view_mode"] = data.view_mode
    if data.result_mode is not None:
        update_fields.append("result_mode = :result_mode")
        params["result_mode"] = data.result_mode
    if data.delivery_to_me_only is not None:
        update_fields.append("delivery_to_me_only = :delivery_to_me_only")
        params["delivery_to_me_only"] = data.delivery_to_me_only

    # Build column names and values for insert (excluding updated_at which uses NOW())
    insert_columns = ["project_id", "profile_id"] + [f.split(' = ')[0] for f in update_fields]
    insert_values = [":project_id", ":profile_id"] + [":" + f.split(' = ')[0] for f in update_fields]

    # Add updated_at for both insert and update
    insert_columns.append("updated_at")
    insert_values.append("NOW()")
    update_fields.append("updated_at = NOW()")

    # Upsert preferences
    result = execute_single(
        f"""
        INSERT INTO gear_marketplace_search_preferences ({', '.join(insert_columns)})
        VALUES ({', '.join(insert_values)})
        ON CONFLICT (project_id, profile_id)
        DO UPDATE SET {', '.join(update_fields)}
        RETURNING *
        """,
        params
    )

    return {"preferences": result}


# ============================================================================
# GEAR HOUSE FAVORITES
# ============================================================================

@router.get("/favorites")
async def get_gear_house_favorites(
    project_id: Optional[str] = Query(None, description="Filter favorites by project"),
    user=Depends(get_current_user)
):
    """Get user's favorite gear houses."""
    profile_id = get_profile_id(user)
    params = {"profile_id": profile_id}

    project_filter = ""
    if project_id:
        project_filter = "AND (f.project_id = :project_id OR f.project_id IS NULL)"
        params["project_id"] = project_id

    favorites = execute_query(
        f"""
        SELECT
            f.id,
            f.organization_id,
            f.project_id,
            f.notes,
            f.created_at,
            o.name as organization_name,
            ms.marketplace_name,
            ms.marketplace_logo_url,
            CASE WHEN ms.hide_exact_address THEN ms.public_location_display ELSE ms.marketplace_location END as location_display,
            ms.location_latitude,
            ms.location_longitude,
            ms.lister_type,
            ms.is_verified,
            ms.offers_delivery,
            ms.delivery_radius_miles,
            (SELECT COUNT(*) FROM gear_marketplace_listings ml WHERE ml.organization_id = o.id AND ml.is_listed = TRUE) as listing_count
        FROM gear_house_favorites f
        JOIN organizations o ON o.id = f.organization_id
        LEFT JOIN gear_marketplace_settings ms ON ms.organization_id = o.id
        WHERE f.profile_id = :profile_id {project_filter}
        ORDER BY f.created_at DESC
        """,
        params
    )

    return {"favorites": favorites}


@router.post("/favorites/{org_id}")
async def add_gear_house_favorite(
    org_id: str,
    project_id: Optional[str] = Query(None, description="Associate favorite with a project"),
    notes: Optional[str] = Query(None, description="Optional notes"),
    user=Depends(get_current_user)
):
    """Add a gear house to favorites."""
    profile_id = get_profile_id(user)

    # Verify org exists and is a marketplace
    org = execute_single(
        """
        SELECT o.id, ms.is_marketplace_enabled
        FROM organizations o
        LEFT JOIN gear_marketplace_settings ms ON ms.organization_id = o.id
        WHERE o.id = :org_id
        """,
        {"org_id": org_id}
    )

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if not org.get("is_marketplace_enabled"):
        raise HTTPException(status_code=400, detail="Organization is not a marketplace")

    # Upsert favorite
    result = execute_single(
        """
        INSERT INTO gear_house_favorites (profile_id, organization_id, project_id, notes)
        VALUES (:profile_id, :org_id, :project_id, :notes)
        ON CONFLICT (profile_id, organization_id)
        DO UPDATE SET project_id = COALESCE(:project_id, gear_house_favorites.project_id),
                      notes = COALESCE(:notes, gear_house_favorites.notes)
        RETURNING *
        """,
        {"profile_id": profile_id, "org_id": org_id, "project_id": project_id, "notes": notes}
    )

    return {"favorite": result}


@router.delete("/favorites/{org_id}")
async def remove_gear_house_favorite(
    org_id: str,
    user=Depends(get_current_user)
):
    """Remove a gear house from favorites."""
    profile_id = get_profile_id(user)

    execute_delete(
        """
        DELETE FROM gear_house_favorites
        WHERE profile_id = :profile_id AND organization_id = :org_id
        """,
        {"profile_id": profile_id, "org_id": org_id}
    )

    return {"success": True}


# ============================================================================
# GEOCODING
# ============================================================================

@router.post("/organizations/{org_id}/geocode")
async def geocode_organization_location(
    org_id: str,
    user=Depends(get_current_user)
):
    """
    Auto-geocode organization location from address.
    Updates gear_marketplace_settings with coordinates.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner", "manager"])

    # Get org address info
    org = execute_single(
        """
        SELECT o.id, o.name, o.address_line1, o.city, o.state, o.postal_code, o.country,
               ms.marketplace_location
        FROM organizations o
        LEFT JOIN gear_marketplace_settings ms ON ms.organization_id = o.id
        WHERE o.id = :org_id
        """,
        {"org_id": org_id}
    )

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Build address string for geocoding
    address_parts = []
    if org.get("marketplace_location"):
        address_parts.append(org["marketplace_location"])
    else:
        if org.get("address_line1"):
            address_parts.append(org["address_line1"])
        if org.get("city"):
            address_parts.append(org["city"])
        if org.get("state"):
            address_parts.append(org["state"])
        if org.get("postal_code"):
            address_parts.append(org["postal_code"])
        if org.get("country"):
            address_parts.append(org["country"])

    if not address_parts:
        raise HTTPException(status_code=400, detail="No address information available to geocode")

    address_string = ", ".join(address_parts)

    # Use AWS Location Service for geocoding
    from app.services.geocoding import geocode_address as aws_geocode

    try:
        result = aws_geocode(address_string)
        if not result:
            raise HTTPException(status_code=404, detail="Could not geocode address")

        lat = result['lat']
        lng = result['lon']
        display_name = result.get('display_name', address_string)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding service error: {str(e)}")

    # Extract city, state for public display
    public_display = ""
    if org.get("city") and org.get("state"):
        public_display = f"{org['city']}, {org['state']}"
    elif display_name:
        # Try to extract city, state from display_name
        parts = display_name.split(", ")
        if len(parts) >= 2:
            public_display = f"{parts[0]}, {parts[1]}"

    # Update marketplace settings with coordinates
    updated = execute_single(
        """
        UPDATE gear_marketplace_settings
        SET location_latitude = :lat,
            location_longitude = :lng,
            location_geocoded_at = NOW(),
            location_geocode_source = 'aws',
            public_location_display = :public_display
        WHERE organization_id = :org_id
        RETURNING *
        """,
        {"org_id": org_id, "lat": lat, "lng": lng, "public_display": public_display}
    )

    if not updated:
        # Create settings if they don't exist
        updated = execute_insert(
            """
            INSERT INTO gear_marketplace_settings (organization_id, location_latitude, location_longitude, location_geocoded_at, location_geocode_source, public_location_display)
            VALUES (:org_id, :lat, :lng, NOW(), 'aws', :public_display)
            RETURNING *
            """,
            {"org_id": org_id, "lat": lat, "lng": lng, "public_display": public_display}
        )

    return {
        "success": True,
        "latitude": lat,
        "longitude": lng,
        "public_location_display": public_display,
        "geocoded_address": address_string
    }


@router.put("/organizations/{org_id}/location-privacy")
async def update_location_privacy(
    org_id: str,
    hide_exact_address: bool = Query(...),
    public_location_display: Optional[str] = Query(None, description="Display text when address is hidden (e.g., 'Tampa, FL')"),
    user=Depends(get_current_user)
):
    """Update location privacy settings for a gear house."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["admin", "owner", "manager"])

    result = execute_single(
        """
        UPDATE gear_marketplace_settings
        SET hide_exact_address = :hide_exact_address,
            public_location_display = COALESCE(:public_location_display, public_location_display)
        WHERE organization_id = :org_id
        RETURNING *
        """,
        {"org_id": org_id, "hide_exact_address": hide_exact_address, "public_location_display": public_location_display}
    )

    if not result:
        raise HTTPException(status_code=404, detail="Marketplace settings not found")

    return {"settings": result}


# ============================================================================
# COMMUNITY SEARCH PREFERENCES (Profile-level, for Community tabs)
# ============================================================================

class CommunityPreferencesUpdate(BaseModel):
    """Update schema for community search preferences."""
    search_latitude: Optional[float] = None
    search_longitude: Optional[float] = None
    search_location_name: Optional[str] = None
    location_source: Optional[str] = None
    search_radius_miles: Optional[int] = None
    view_mode: Optional[str] = None


@router.get("/community/preferences")
async def get_community_preferences(
    user=Depends(get_current_user)
):
    """Get community search preferences for current user (profile-level)."""
    profile_id = get_profile_id(user)

    prefs = execute_single(
        """
        SELECT * FROM gear_community_search_preferences
        WHERE profile_id = :profile_id
        """,
        {"profile_id": profile_id}
    )

    if not prefs:
        # Return defaults if no preferences exist
        return {
            "preferences": {
                "profile_id": profile_id,
                "search_latitude": None,
                "search_longitude": None,
                "search_location_name": None,
                "location_source": "profile",
                "search_radius_miles": 50,
                "view_mode": "grid"
            }
        }

    return {"preferences": prefs}


@router.put("/community/preferences")
async def update_community_preferences(
    data: CommunityPreferencesUpdate,
    user=Depends(get_current_user)
):
    """Update community search preferences (profile-level)."""
    profile_id = get_profile_id(user)

    # Build update fields
    update_fields = []
    params = {"profile_id": profile_id}

    if data.search_latitude is not None:
        update_fields.append("search_latitude = :search_latitude")
        params["search_latitude"] = data.search_latitude
    if data.search_longitude is not None:
        update_fields.append("search_longitude = :search_longitude")
        params["search_longitude"] = data.search_longitude
    if data.search_location_name is not None:
        update_fields.append("search_location_name = :search_location_name")
        params["search_location_name"] = data.search_location_name
    if data.location_source is not None:
        update_fields.append("location_source = :location_source")
        params["location_source"] = data.location_source
    if data.search_radius_miles is not None:
        update_fields.append("search_radius_miles = :search_radius_miles")
        params["search_radius_miles"] = data.search_radius_miles
    if data.view_mode is not None:
        update_fields.append("view_mode = :view_mode")
        params["view_mode"] = data.view_mode

    # Build column names and values for insert
    insert_columns = ["profile_id"] + [f.split(' = ')[0] for f in update_fields]
    insert_values = [":profile_id"] + [":" + f.split(' = ')[0] for f in update_fields]

    # Add updated_at
    insert_columns.append("updated_at")
    insert_values.append("NOW()")
    update_fields.append("updated_at = NOW()")

    # Upsert preferences
    result = execute_single(
        f"""
        INSERT INTO gear_community_search_preferences ({', '.join(insert_columns)})
        VALUES ({', '.join(insert_values)})
        ON CONFLICT (profile_id)
        DO UPDATE SET {', '.join(update_fields)}
        RETURNING *
        """,
        params
    )

    return {"preferences": result}


# ============================================================================
# GEOCODING ENDPOINT
# ============================================================================

class GeocodeRequest(BaseModel):
    """Request schema for geocoding an address."""
    address: str


@router.post("/geocode")
async def geocode_address_endpoint(
    data: GeocodeRequest,
    user=Depends(get_current_user)
):
    """
    Geocode an address to coordinates using AWS Location Service.
    """
    from app.services.geocoding import geocode_address as aws_geocode

    if not data.address or len(data.address.strip()) < 3:
        raise HTTPException(status_code=400, detail="Address is required")

    try:
        result = aws_geocode(data.address.strip())
        if not result:
            raise HTTPException(status_code=404, detail="Could not geocode address")

        return {
            "success": True,
            "latitude": result['lat'],
            "longitude": result['lon'],
            "display_name": result.get('display_name', data.address),
            "address_components": result.get('address_components', {})
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Geocoding service error: {str(e)}")


class ReverseGeocodeRequest(BaseModel):
    """Request schema for reverse geocoding coordinates."""
    latitude: float
    longitude: float


@router.post("/reverse-geocode")
async def reverse_geocode_endpoint(
    data: ReverseGeocodeRequest,
    user=Depends(get_current_user)
):
    """
    Reverse geocode coordinates to an address using AWS Location Service.
    """
    from app.services.geocoding import reverse_geocode as aws_reverse_geocode

    try:
        result = aws_reverse_geocode(data.latitude, data.longitude)
        if not result:
            return {
                "success": True,
                "display_name": None,
                "city": None,
                "state": None
            }

        # Parse city and state from the result
        parts = result.split(', ') if result else []
        city = parts[0] if len(parts) > 0 else None
        state = parts[1] if len(parts) > 1 else None

        return {
            "success": True,
            "display_name": result,
            "city": city,
            "state": state
        }
    except Exception as e:
        # Don't fail on reverse geocode errors - just return empty
        return {
            "success": True,
            "display_name": None,
            "city": None,
            "state": None
        }


class AddressAutocompleteRequest(BaseModel):
    """Request schema for address autocomplete."""
    query: str
    max_results: int = 5


@router.post("/address-autocomplete")
async def address_autocomplete_endpoint(
    data: AddressAutocompleteRequest,
    user=Depends(get_current_user)
):
    """
    Get address suggestions for autocomplete using AWS Location Service.
    """
    from app.services.geocoding import search_places

    if not data.query or len(data.query.strip()) < 3:
        return {"success": True, "suggestions": []}

    try:
        results = search_places(data.query.strip(), max_results=min(data.max_results, 10))

        suggestions = []
        for result in results:
            suggestions.append({
                "label": result.get('label', ''),
                "street": result.get('street'),
                "city": result.get('city'),
                "state": result.get('state'),
                "postal_code": result.get('postal_code'),
                "latitude": result.get('lat'),
                "longitude": result.get('lon'),
            })

        return {
            "success": True,
            "suggestions": suggestions
        }
    except Exception as e:
        print(f"Address autocomplete error: {e}")
        return {"success": True, "suggestions": []}
