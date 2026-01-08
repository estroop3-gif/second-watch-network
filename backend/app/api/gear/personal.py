"""
Gear House Personal API

Endpoints for managing personal gear and "Gear House Lite" functionality.
Allows ALL users (including FREE role) to list gear for rent/sale.
"""
from typing import Optional, List, Dict, Any
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert

router = APIRouter(prefix="/personal", tags=["Gear Personal"])


# ============================================================================
# SCHEMAS
# ============================================================================

class QuickAddAssetInput(BaseModel):
    """Simplified asset creation for lite users."""
    name: str
    category_id: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    photos: List[str] = []
    # Listing configuration
    listing_type: Optional[str] = "rent"  # rent, sale, both
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    sale_price: Optional[float] = None
    sale_condition: Optional[str] = None  # new, like_new, good, fair, parts
    sale_includes: Optional[str] = None
    sale_negotiable: Optional[bool] = True
    # Whether to create listing immediately
    create_listing: Optional[bool] = True


class PersonalGearResponse(BaseModel):
    """Response for personal gear listing."""
    org_id: Optional[str] = None
    assets: List[Dict[str, Any]] = []


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    """Extract profile ID from current user."""
    return user.get("id")


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.post("/ensure-org")
async def ensure_personal_gear_org(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Ensures user has a personal gear organization.
    Creates one if it doesn't exist.
    Returns the org_id.

    This endpoint is idempotent - safe to call multiple times.
    """
    profile_id = get_profile_id(current_user)

    # Check if user already has a personal org
    existing = execute_single("""
        SELECT personal_gear_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if existing and existing.get("personal_gear_org_id"):
        return {"org_id": existing["personal_gear_org_id"], "created": False}

    # Get user's display name for org name
    profile = execute_single("""
        SELECT display_name, first_name, last_name FROM profiles WHERE id = :id
    """, {"id": profile_id})

    user_name = (
        profile.get("display_name") or
        f"{profile.get('first_name', '')} {profile.get('last_name', '')}".strip() or
        "My"
    )

    # Create personal organization
    org = execute_insert("""
        INSERT INTO organizations (
            name, type, is_personal_gear_org, created_by
        ) VALUES (
            :name, 'individual', TRUE, :created_by
        ) RETURNING id
    """, {
        "name": f"{user_name}'s Gear",
        "created_by": profile_id
    })

    org_id = org["id"]

    # Link org to profile
    execute_query("""
        UPDATE profiles SET personal_gear_org_id = :org_id WHERE id = :profile_id
    """, {"org_id": org_id, "profile_id": profile_id})

    # Add user as owner of the org
    execute_insert("""
        INSERT INTO gear_organization_members (organization_id, profile_id, role)
        VALUES (:org_id, :profile_id, 'owner')
    """, {"org_id": org_id, "profile_id": profile_id})

    # Enable marketplace for personal orgs by default
    execute_insert("""
        INSERT INTO gear_marketplace_settings (
            organization_id, lister_type, is_marketplace_enabled
        ) VALUES (
            :org_id, 'individual', TRUE
        )
    """, {"org_id": org_id})

    return {"org_id": org_id, "created": True}


@router.get("/my-gear")
async def get_my_gear_listings(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get all assets and listings for user's personal gear org.
    Used by the lite /my-gear page.
    """
    profile_id = get_profile_id(current_user)

    # Get personal org
    org = execute_single("""
        SELECT personal_gear_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_gear_org_id"):
        return {"org_id": None, "assets": []}

    org_id = org["personal_gear_org_id"]

    # Get all assets with their listing status
    assets = execute_query("""
        SELECT
            ga.id,
            ga.name,
            ga.make,
            ga.model,
            ga.serial_number,
            ga.barcode,
            ga.status,
            ga.current_condition,
            ga.photos_current,
            ga.photos_baseline,
            ga.category_id,
            gc.name as category_name,
            ga.created_at,
            gml.id as listing_id,
            gml.is_listed,
            gml.listing_type,
            gml.daily_rate,
            gml.weekly_rate,
            gml.monthly_rate,
            gml.sale_price,
            gml.sale_condition,
            gml.deposit_amount,
            gml.deposit_percent,
            gml.insurance_required,
            gml.min_rental_days
        FROM gear_assets ga
        LEFT JOIN gear_marketplace_listings gml ON ga.id = gml.asset_id
        LEFT JOIN gear_categories gc ON ga.category_id = gc.id
        WHERE ga.organization_id = :org_id
        ORDER BY ga.created_at DESC
    """, {"org_id": org_id})

    return {
        "org_id": org_id,
        "assets": assets
    }


@router.post("/quick-add-asset")
async def quick_add_asset(
    input: QuickAddAssetInput,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Simplified asset creation for lite users.
    Optionally creates listing in same request.

    This endpoint:
    1. Ensures the user has a personal gear org
    2. Creates the asset
    3. Optionally creates a marketplace listing
    """
    # Ensure personal org exists
    org_response = await ensure_personal_gear_org(current_user)
    org_id = org_response["org_id"]
    profile_id = get_profile_id(current_user)

    # Validate photos if creating listing
    if input.create_listing and len(input.photos) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one photo is required to list on the marketplace"
        )

    # Validate pricing based on listing type
    if input.create_listing:
        if input.listing_type in ['rent', 'both'] and not input.daily_rate:
            raise HTTPException(
                status_code=400,
                detail="Daily rate is required for rental listings"
            )
        if input.listing_type in ['sale', 'both'] and not input.sale_price:
            raise HTTPException(
                status_code=400,
                detail="Sale price is required for sale listings"
            )

    # Create asset
    asset = execute_insert("""
        INSERT INTO gear_assets (
            organization_id, name, category_id, make, model,
            photos_current, status, current_condition, created_by
        ) VALUES (
            :org_id, :name, :category_id, :manufacturer, :model,
            :photos, 'available', 'good', :created_by
        ) RETURNING id
    """, {
        "org_id": org_id,
        "name": input.name,
        "category_id": input.category_id,
        "manufacturer": input.manufacturer,
        "model": input.model,
        "photos": json.dumps(input.photos),
        "created_by": profile_id
    })

    asset_id = asset["id"]

    # Create listing if requested
    listing_id = None
    if input.create_listing:
        listing = execute_insert("""
            INSERT INTO gear_marketplace_listings (
                asset_id, organization_id, listing_type,
                daily_rate, weekly_rate, sale_price,
                sale_condition, sale_includes, sale_negotiable,
                is_listed
            ) VALUES (
                :asset_id, :org_id, :listing_type,
                :daily_rate, :weekly_rate, :sale_price,
                :sale_condition, :sale_includes, :sale_negotiable,
                TRUE
            ) RETURNING id
        """, {
            "asset_id": asset_id,
            "org_id": org_id,
            "listing_type": input.listing_type or "rent",
            "daily_rate": input.daily_rate,
            "weekly_rate": input.weekly_rate,
            "sale_price": input.sale_price,
            "sale_condition": input.sale_condition,
            "sale_includes": input.sale_includes,
            "sale_negotiable": input.sale_negotiable if input.sale_negotiable is not None else True
        })
        listing_id = listing["id"]

    return {
        "asset_id": asset_id,
        "listing_id": listing_id,
        "org_id": org_id
    }


@router.delete("/assets/{asset_id}")
async def delete_personal_asset(
    asset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Delete an asset from user's personal gear.
    Also removes any associated marketplace listing.
    """
    profile_id = get_profile_id(current_user)

    # Get personal org
    org = execute_single("""
        SELECT personal_gear_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_gear_org_id"):
        raise HTTPException(status_code=404, detail="Personal gear organization not found")

    org_id = org["personal_gear_org_id"]

    # Verify asset belongs to user's personal org
    asset = execute_single("""
        SELECT id FROM gear_assets
        WHERE id = :asset_id AND organization_id = :org_id
    """, {"asset_id": asset_id, "org_id": org_id})

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Delete listing first (due to foreign key)
    execute_query("""
        DELETE FROM gear_marketplace_listings WHERE asset_id = :asset_id
    """, {"asset_id": asset_id})

    # Delete asset
    execute_query("""
        DELETE FROM gear_assets WHERE id = :asset_id
    """, {"asset_id": asset_id})

    return {"success": True, "deleted_asset_id": asset_id}


@router.put("/assets/{asset_id}/listing")
async def update_personal_asset_listing(
    asset_id: str,
    input: QuickAddAssetInput,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Update an asset and its listing in user's personal gear.
    """
    profile_id = get_profile_id(current_user)

    # Get personal org
    org = execute_single("""
        SELECT personal_gear_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_gear_org_id"):
        raise HTTPException(status_code=404, detail="Personal gear organization not found")

    org_id = org["personal_gear_org_id"]

    # Verify asset belongs to user's personal org
    asset = execute_single("""
        SELECT id FROM gear_assets
        WHERE id = :asset_id AND organization_id = :org_id
    """, {"asset_id": asset_id, "org_id": org_id})

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Update asset
    execute_query("""
        UPDATE gear_assets SET
            name = COALESCE(:name, name),
            category_id = COALESCE(:category_id, category_id),
            make = COALESCE(:manufacturer, make),
            model = COALESCE(:model, model),
            photos_current = COALESCE(:photos, photos_current),
            updated_at = NOW()
        WHERE id = :asset_id
    """, {
        "asset_id": asset_id,
        "name": input.name,
        "category_id": input.category_id,
        "manufacturer": input.manufacturer,
        "model": input.model,
        "photos": json.dumps(input.photos) if input.photos else None
    })

    # Check if listing exists
    existing_listing = execute_single("""
        SELECT id FROM gear_marketplace_listings WHERE asset_id = :asset_id
    """, {"asset_id": asset_id})

    if existing_listing:
        # Update existing listing
        execute_query("""
            UPDATE gear_marketplace_listings SET
                listing_type = COALESCE(:listing_type, listing_type),
                daily_rate = COALESCE(:daily_rate, daily_rate),
                weekly_rate = COALESCE(:weekly_rate, weekly_rate),
                sale_price = COALESCE(:sale_price, sale_price),
                sale_condition = COALESCE(:sale_condition, sale_condition),
                sale_includes = COALESCE(:sale_includes, sale_includes),
                sale_negotiable = COALESCE(:sale_negotiable, sale_negotiable),
                updated_at = NOW()
            WHERE asset_id = :asset_id
        """, {
            "asset_id": asset_id,
            "listing_type": input.listing_type,
            "daily_rate": input.daily_rate,
            "weekly_rate": input.weekly_rate,
            "sale_price": input.sale_price,
            "sale_condition": input.sale_condition,
            "sale_includes": input.sale_includes,
            "sale_negotiable": input.sale_negotiable
        })
        listing_id = existing_listing["id"]
    elif input.create_listing:
        # Create new listing
        listing = execute_insert("""
            INSERT INTO gear_marketplace_listings (
                asset_id, organization_id, listing_type,
                daily_rate, weekly_rate, sale_price,
                sale_condition, sale_includes, sale_negotiable,
                is_listed
            ) VALUES (
                :asset_id, :org_id, :listing_type,
                :daily_rate, :weekly_rate, :sale_price,
                :sale_condition, :sale_includes, :sale_negotiable,
                TRUE
            ) RETURNING id
        """, {
            "asset_id": asset_id,
            "org_id": org_id,
            "listing_type": input.listing_type or "rent",
            "daily_rate": input.daily_rate,
            "weekly_rate": input.weekly_rate,
            "sale_price": input.sale_price,
            "sale_condition": input.sale_condition,
            "sale_includes": input.sale_includes,
            "sale_negotiable": input.sale_negotiable if input.sale_negotiable is not None else True
        })
        listing_id = listing["id"]
    else:
        listing_id = None

    return {
        "asset_id": asset_id,
        "listing_id": listing_id,
        "org_id": org_id
    }


@router.post("/assets/{asset_id}/toggle-listing")
async def toggle_asset_listing(
    asset_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Toggle an asset's marketplace listing status (listed/unlisted).
    """
    profile_id = get_profile_id(current_user)

    # Get personal org
    org = execute_single("""
        SELECT personal_gear_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_gear_org_id"):
        raise HTTPException(status_code=404, detail="Personal gear organization not found")

    org_id = org["personal_gear_org_id"]

    # Verify asset belongs to user's personal org
    asset = execute_single("""
        SELECT ga.id, gml.id as listing_id, gml.is_listed
        FROM gear_assets ga
        LEFT JOIN gear_marketplace_listings gml ON ga.id = gml.asset_id
        WHERE ga.id = :asset_id AND ga.organization_id = :org_id
    """, {"asset_id": asset_id, "org_id": org_id})

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if not asset.get("listing_id"):
        raise HTTPException(status_code=400, detail="Asset has no listing to toggle")

    new_status = not asset.get("is_listed", True)

    execute_query("""
        UPDATE gear_marketplace_listings
        SET is_listed = :is_listed, updated_at = NOW()
        WHERE asset_id = :asset_id
    """, {"asset_id": asset_id, "is_listed": new_status})

    return {
        "asset_id": asset_id,
        "is_listed": new_status
    }
