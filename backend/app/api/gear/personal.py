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
from app.core.database import execute_query, execute_single, execute_insert, execute_update

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

    # Check profile for stored personal org id
    profile = execute_single("""
        SELECT personal_gear_org_id, display_name, full_name FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if profile and profile.get("personal_gear_org_id"):
        return {"org_id": profile["personal_gear_org_id"], "created": False}

    # Also check if an org was created but profile column wasn't updated (partial failure recovery)
    orphaned_org = execute_single("""
        SELECT id FROM organizations
        WHERE created_by = :profile_id AND is_personal_gear_org = TRUE
        LIMIT 1
    """, {"profile_id": profile_id})

    if orphaned_org:
        org_id = orphaned_org["id"]
        # Repair the profile link
        execute_update("""
            UPDATE profiles SET personal_gear_org_id = :org_id WHERE id = :profile_id
        """, {"org_id": org_id, "profile_id": profile_id})
        # Ensure org_member row exists
        execute_update("""
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES (:org_id, :user_id, 'owner')
            ON CONFLICT DO NOTHING
        """, {"org_id": org_id, "user_id": profile_id})
        # Ensure marketplace settings exist
        execute_update("""
            INSERT INTO gear_marketplace_settings (organization_id, lister_type, is_marketplace_enabled)
            VALUES (:org_id, 'individual', TRUE)
            ON CONFLICT DO NOTHING
        """, {"org_id": org_id})
        return {"org_id": org_id, "created": False}

    user_name = (
        profile.get("display_name") or
        profile.get("full_name") or
        "My"
    )

    # Create personal organization
    import re as _re
    import uuid as _uuid
    base_slug = _re.sub(r'[^a-z0-9]+', '-', user_name.lower()).strip('-') + '-gear'
    slug = f"{base_slug}-{str(_uuid.uuid4())[:8]}"

    org = execute_insert("""
        INSERT INTO organizations (
            name, slug, org_type, is_personal_gear_org, created_by
        ) VALUES (
            :name, :slug, 'production_company', TRUE, :created_by
        ) RETURNING id
    """, {
        "name": f"{user_name}'s Gear",
        "slug": slug,
        "created_by": profile_id
    })

    org_id = org["id"]

    # Link org to profile
    execute_update("""
        UPDATE profiles SET personal_gear_org_id = :org_id WHERE id = :profile_id
    """, {"org_id": org_id, "profile_id": profile_id})

    # Add user as owner of the org
    execute_update("""
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (:org_id, :user_id, 'owner')
        ON CONFLICT DO NOTHING
    """, {"org_id": org_id, "user_id": profile_id})

    # Enable marketplace for personal orgs by default
    execute_update("""
        INSERT INTO gear_marketplace_settings (
            organization_id, lister_type, is_marketplace_enabled
        ) VALUES (
            :org_id, 'individual', TRUE
        )
        ON CONFLICT DO NOTHING
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

    # Generate a unique internal_id for the asset
    import uuid as _uuid

    def _valid_uuid(val):
        try:
            _uuid.UUID(str(val))
            return val
        except (ValueError, AttributeError):
            return None

    internal_id = f"PERS-{str(_uuid.uuid4())[:8].upper()}"

    # Create asset
    asset = execute_insert("""
        INSERT INTO gear_assets (
            organization_id, internal_id, name, category_id, make, model,
            photos_current, status, current_condition, created_by
        ) VALUES (
            :org_id, :internal_id, :name, :category_id, :make, :model,
            :photos, 'available', 'good', :created_by
        ) RETURNING id
    """, {
        "org_id": org_id,
        "internal_id": internal_id,
        "name": input.name,
        "category_id": _valid_uuid(input.category_id),
        "make": input.manufacturer,
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
            "daily_rate": input.daily_rate if input.daily_rate is not None else 0,
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
            "daily_rate": input.daily_rate if input.daily_rate is not None else 0,
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


@router.get("/my-community-listings")
async def get_my_community_listings(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get ALL marketplace listings for the current user across:
    1. Their personal gear org (personal_gear_org_id on profiles)
    2. Any Gear House orgs they're a member of (organization_members table)

    Returns listings in full marketplace shape with asset details.
    Used by the My Posts page to show all gear the user has listed.
    """
    profile_id = get_profile_id(current_user)

    # Collect all org IDs this user controls
    org_ids = []

    # 1. Personal gear org
    profile_row = execute_single("""
        SELECT personal_gear_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})
    personal_org_id = profile_row.get("personal_gear_org_id") if profile_row else None
    if personal_org_id:
        org_ids.append(personal_org_id)

    # 2. Gear House orgs (organization_members table)
    gear_house_rows = execute_query("""
        SELECT organization_id FROM organization_members
        WHERE user_id = :profile_id
          AND organization_id NOT IN (
              SELECT id FROM organizations WHERE is_personal_gear_org = TRUE
          )
    """, {"profile_id": profile_id})
    for row in (gear_house_rows or []):
        oid = row.get("organization_id")
        if oid and oid not in org_ids:
            org_ids.append(oid)

    if not org_ids:
        return {"listings": [], "personal_org_id": None}

    # Build parameterized IN clause
    params: Dict[str, Any] = {"profile_id": profile_id}
    org_placeholders = []
    for i, oid in enumerate(org_ids):
        key = f"org_{i}"
        params[key] = oid
        org_placeholders.append(f":{key}")
    in_clause = ", ".join(org_placeholders)

    listings = execute_query(f"""
        SELECT
            gml.id,
            gml.asset_id,
            gml.organization_id,
            gml.is_listed,
            gml.listing_type,
            gml.daily_rate,
            gml.weekly_rate,
            gml.monthly_rate,
            gml.sale_price,
            gml.sale_condition,
            gml.sale_includes,
            gml.sale_negotiable,
            gml.deposit_amount,
            gml.insurance_required,
            gml.min_rental_days,
            gml.advance_booking_days,
            gml.created_at,
            gml.updated_at,
            ga.name as asset_name,
            ga.make as asset_make,
            ga.model as asset_model,
            ga.category_id as asset_category_id,
            ga.photos_current as asset_photos_current,
            ga.status as asset_status,
            ga.current_condition as asset_current_condition,
            gc.name as category_name
        FROM gear_marketplace_listings gml
        JOIN gear_assets ga ON gml.asset_id = ga.id
        LEFT JOIN gear_categories gc ON ga.category_id = gc.id
        WHERE gml.organization_id IN ({in_clause})
        ORDER BY gml.created_at DESC
    """, params)

    # Reshape into nested asset format
    result = []
    for row in (listings or []):
        result.append({
            "id": row["id"],
            "asset_id": row["asset_id"],
            "organization_id": row["organization_id"],
            "is_listed": row["is_listed"],
            "listing_type": row["listing_type"],
            "daily_rate": row["daily_rate"],
            "weekly_rate": row["weekly_rate"],
            "monthly_rate": row["monthly_rate"],
            "sale_price": row["sale_price"],
            "sale_condition": row["sale_condition"],
            "sale_includes": row["sale_includes"],
            "sale_negotiable": row["sale_negotiable"],
            "deposit_amount": row["deposit_amount"],
            "insurance_required": row["insurance_required"],
            "min_rental_days": row["min_rental_days"],
            "advance_booking_days": row["advance_booking_days"],
            "created_at": str(row["created_at"]) if row["created_at"] else None,
            "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
            "asset": {
                "id": row["asset_id"],
                "name": row["asset_name"],
                "make": row["asset_make"],
                "model": row["asset_model"],
                "category_id": row["asset_category_id"],
                "photos_current": row["asset_photos_current"],
                "status": row["asset_status"],
                "current_condition": row["asset_current_condition"],
                "category_name": row["category_name"],
            },
        })

    return {"listings": result, "personal_org_id": personal_org_id}


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
