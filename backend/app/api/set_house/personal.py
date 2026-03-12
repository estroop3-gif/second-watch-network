"""
Set House Personal API

Endpoints for managing personal space listings and "Set House Lite" functionality.
Allows ALL users (including FREE role) to list spaces for rent.
"""
from typing import Optional, List, Dict, Any
import json
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

router = APIRouter(prefix="/personal", tags=["Set House Personal"])


# ============================================================================
# SCHEMAS
# ============================================================================

class QuickAddSpaceInput(BaseModel):
    """Simplified space creation for lite users."""
    name: str
    space_type: Optional[str] = None  # studio, sound_stage, location, backlot, green_screen, etc.
    square_footage: Optional[float] = None
    description: Optional[str] = None
    # Address
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    hide_address: Optional[bool] = False  # show only city/state on marketplace listing
    photos: List[str] = []
    # Listing configuration
    daily_rate: Optional[float] = None
    hourly_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = False
    min_booking_hours: Optional[int] = None
    # Whether to create listing immediately
    create_listing: Optional[bool] = True


class UpdateSpaceInput(BaseModel):
    """Update space fields."""
    name: Optional[str] = None
    space_type: Optional[str] = None
    square_footage: Optional[float] = None
    description: Optional[str] = None
    photos: Optional[List[str]] = None


class UpdateListingInput(BaseModel):
    """Update listing fields."""
    is_listed: Optional[bool] = None
    daily_rate: Optional[float] = None
    hourly_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = None
    min_booking_hours: Optional[int] = None
    max_booking_days: Optional[int] = None
    booking_notes: Optional[str] = None
    access_instructions: Optional[str] = None


class CreateListingInput(BaseModel):
    """Create a listing for an existing space."""
    daily_rate: float
    hourly_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: Optional[float] = None
    deposit_percent: Optional[float] = None
    insurance_required: Optional[bool] = False
    min_booking_hours: Optional[int] = None


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
async def ensure_personal_set_house_org(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Ensures user has a personal Set House organization.
    Creates one if it doesn't exist.
    Returns the org_id.

    This endpoint is idempotent - safe to call multiple times.
    """
    profile_id = get_profile_id(current_user)

    # Check profile for stored personal org id
    profile = execute_single("""
        SELECT personal_set_house_org_id, display_name, full_name FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if profile and profile.get("personal_set_house_org_id"):
        return {"org_id": profile["personal_set_house_org_id"], "created": False}

    # Also check if an org was created but profile column wasn't updated (partial failure recovery)
    orphaned_org = execute_single("""
        SELECT id FROM organizations
        WHERE created_by = :profile_id AND is_personal_set_house_org = TRUE
        LIMIT 1
    """, {"profile_id": profile_id})

    if orphaned_org:
        org_id = orphaned_org["id"]
        # Repair the profile link
        execute_update("""
            UPDATE profiles SET personal_set_house_org_id = :org_id WHERE id = :profile_id
        """, {"org_id": org_id, "profile_id": profile_id})
        # Ensure org_member row exists
        execute_update("""
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES (:org_id, :user_id, 'owner')
            ON CONFLICT DO NOTHING
        """, {"org_id": org_id, "user_id": profile_id})
        # Ensure marketplace settings exist
        execute_update("""
            INSERT INTO set_house_marketplace_settings (organization_id, lister_type, is_marketplace_enabled)
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
    base_slug = _re.sub(r'[^a-z0-9]+', '-', user_name.lower()).strip('-') + '-spaces'
    slug = f"{base_slug}-{str(_uuid.uuid4())[:8]}"

    org = execute_insert("""
        INSERT INTO organizations (
            name, slug, org_type, is_personal_set_house_org, created_by
        ) VALUES (
            :name, :slug, 'production_company', TRUE, :created_by
        ) RETURNING id
    """, {
        "name": f"{user_name}'s Spaces",
        "slug": slug,
        "created_by": profile_id
    })

    org_id = org["id"]

    # Link org to profile
    execute_update("""
        UPDATE profiles SET personal_set_house_org_id = :org_id WHERE id = :profile_id
    """, {"org_id": org_id, "profile_id": profile_id})

    # Add user as owner of the org
    execute_update("""
        INSERT INTO organization_members (organization_id, user_id, role)
        VALUES (:org_id, :user_id, 'owner')
        ON CONFLICT DO NOTHING
    """, {"org_id": org_id, "user_id": profile_id})

    # Enable marketplace for personal orgs by default
    execute_update("""
        INSERT INTO set_house_marketplace_settings (
            organization_id, lister_type, is_marketplace_enabled
        ) VALUES (
            :org_id, 'individual', TRUE
        )
        ON CONFLICT DO NOTHING
    """, {"org_id": org_id})

    return {"org_id": org_id, "created": True}


@router.get("/spaces")
async def get_my_spaces(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get all spaces and listings for user's personal Set House org.
    """
    profile_id = get_profile_id(current_user)

    # Get personal org
    org = execute_single("""
        SELECT personal_set_house_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_set_house_org_id"):
        return {"org_id": None, "spaces": []}

    org_id = org["personal_set_house_org_id"]

    # Get all spaces with their listing status
    spaces = execute_query("""
        SELECT
            shs.id,
            shs.name,
            shs.space_type,
            shs.square_footage,
            shs.description,
            shs.photos,
            shs.status,
            shs.current_condition,
            shs.created_at,
            shml.id as listing_id,
            shml.is_listed,
            shml.daily_rate,
            shml.hourly_rate,
            shml.weekly_rate,
            shml.monthly_rate,
            shml.deposit_amount,
            shml.deposit_percent,
            shml.insurance_required,
            shml.min_booking_hours
        FROM set_house_spaces shs
        LEFT JOIN set_house_marketplace_listings shml ON shs.id = shml.space_id
        WHERE shs.organization_id = :org_id
        ORDER BY shs.created_at DESC
    """, {"org_id": org_id})

    return {
        "org_id": org_id,
        "spaces": spaces
    }


@router.post("/quick-add")
async def quick_add_space(
    input: QuickAddSpaceInput,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Simplified space creation for lite users.
    Optionally creates listing in same request.
    """
    # Ensure personal org exists
    org_response = await ensure_personal_set_house_org(current_user)
    org_id = org_response["org_id"]
    profile_id = get_profile_id(current_user)

    # Validate photos if creating listing
    if input.create_listing and len(input.photos) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one photo is required to list on the marketplace"
        )

    # Validate pricing if creating listing
    if input.create_listing and not input.daily_rate:
        raise HTTPException(
            status_code=400,
            detail="Daily rate is required for space listings"
        )

    import uuid as _uuid
    internal_id = f"PERS-{str(_uuid.uuid4())[:8].upper()}"

    # Create space
    space = execute_insert("""
        INSERT INTO set_house_spaces (
            organization_id, internal_id, name, space_type, square_footage,
            description, photos, status, current_condition, created_by,
            address_line1, address_line2, city, state, zip_code, hide_address
        ) VALUES (
            :org_id, :internal_id, :name, :space_type, :square_footage,
            :description, :photos, 'available', 'good', :created_by,
            :address_line1, :address_line2, :city, :state, :zip_code, :hide_address
        ) RETURNING id
    """, {
        "org_id": org_id,
        "internal_id": internal_id,
        "name": input.name,
        "space_type": input.space_type,
        "square_footage": input.square_footage,
        "description": input.description,
        "photos": json.dumps(input.photos),
        "created_by": profile_id,
        "address_line1": input.address_line1,
        "address_line2": input.address_line2,
        "city": input.city,
        "state": input.state,
        "zip_code": input.zip_code,
        "hide_address": input.hide_address or False,
    })

    space_id = space["id"]

    # Sync city/state to the personal org if the space has address info and org doesn't yet
    if input.city or input.state:
        execute_update("""
            UPDATE organizations
            SET city = COALESCE(NULLIF(city, ''), :city),
                state = COALESCE(NULLIF(state, ''), :state),
                updated_at = NOW()
            WHERE id = :org_id
        """, {"org_id": org_id, "city": input.city or "", "state": input.state or ""})

        location_display = ", ".join(filter(None, [input.city, input.state]))
        execute_update("""
            UPDATE set_house_marketplace_settings
            SET marketplace_location = COALESCE(NULLIF(marketplace_location, ''), :location_display),
                updated_at = NOW()
            WHERE organization_id = :org_id
        """, {"org_id": org_id, "location_display": location_display})

    # Create listing if requested
    listing_id = None
    if input.create_listing:
        listing = execute_insert("""
            INSERT INTO set_house_marketplace_listings (
                space_id, organization_id,
                daily_rate, hourly_rate, weekly_rate, monthly_rate,
                deposit_amount, deposit_percent,
                insurance_required, min_booking_hours,
                is_listed
            ) VALUES (
                :space_id, :org_id,
                :daily_rate, :hourly_rate, :weekly_rate, :monthly_rate,
                :deposit_amount, :deposit_percent,
                :insurance_required, :min_booking_hours,
                TRUE
            ) RETURNING id
        """, {
            "space_id": space_id,
            "org_id": org_id,
            "daily_rate": input.daily_rate,
            "hourly_rate": input.hourly_rate,
            "weekly_rate": input.weekly_rate,
            "monthly_rate": input.monthly_rate,
            "deposit_amount": input.deposit_amount,
            "deposit_percent": input.deposit_percent,
            "insurance_required": input.insurance_required or False,
            "min_booking_hours": input.min_booking_hours,
        })
        listing_id = listing["id"]

    return {
        "space_id": space_id,
        "listing_id": listing_id,
        "org_id": org_id
    }


@router.put("/spaces/{space_id}")
async def update_personal_space(
    space_id: str,
    input: UpdateSpaceInput,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update a space in user's personal Set House org."""
    profile_id = get_profile_id(current_user)

    org = execute_single("""
        SELECT personal_set_house_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_set_house_org_id"):
        raise HTTPException(status_code=404, detail="Personal Set House organization not found")

    org_id = org["personal_set_house_org_id"]

    space = execute_single("""
        SELECT id FROM set_house_spaces
        WHERE id = :space_id AND organization_id = :org_id
    """, {"space_id": space_id, "org_id": org_id})

    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    execute_query("""
        UPDATE set_house_spaces SET
            name = COALESCE(:name, name),
            space_type = COALESCE(:space_type, space_type),
            square_footage = COALESCE(:square_footage, square_footage),
            description = COALESCE(:description, description),
            photos = COALESCE(:photos, photos),
            updated_at = NOW()
        WHERE id = :space_id
    """, {
        "space_id": space_id,
        "name": input.name,
        "space_type": input.space_type,
        "square_footage": input.square_footage,
        "description": input.description,
        "photos": json.dumps(input.photos) if input.photos is not None else None,
    })

    return {"success": True, "space_id": space_id}


@router.delete("/spaces/{space_id}")
async def delete_personal_space(
    space_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Delete a space from user's personal Set House.
    Also removes any associated marketplace listing.
    """
    profile_id = get_profile_id(current_user)

    org = execute_single("""
        SELECT personal_set_house_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_set_house_org_id"):
        raise HTTPException(status_code=404, detail="Personal Set House organization not found")

    org_id = org["personal_set_house_org_id"]

    space = execute_single("""
        SELECT id FROM set_house_spaces
        WHERE id = :space_id AND organization_id = :org_id
    """, {"space_id": space_id, "org_id": org_id})

    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # Delete listing first (due to foreign key)
    execute_query("""
        DELETE FROM set_house_marketplace_listings WHERE space_id = :space_id
    """, {"space_id": space_id})

    # Delete space
    execute_query("""
        DELETE FROM set_house_spaces WHERE id = :space_id
    """, {"space_id": space_id})

    return {"success": True, "deleted_space_id": space_id}


@router.post("/spaces/{space_id}/listing")
async def create_space_listing(
    space_id: str,
    input: CreateListingInput,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Create a marketplace listing for an existing space."""
    profile_id = get_profile_id(current_user)

    org = execute_single("""
        SELECT personal_set_house_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_set_house_org_id"):
        raise HTTPException(status_code=404, detail="Personal Set House organization not found")

    org_id = org["personal_set_house_org_id"]

    space = execute_single("""
        SELECT id FROM set_house_spaces
        WHERE id = :space_id AND organization_id = :org_id
    """, {"space_id": space_id, "org_id": org_id})

    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # Check if listing already exists
    existing = execute_single("""
        SELECT id FROM set_house_marketplace_listings WHERE space_id = :space_id
    """, {"space_id": space_id})

    if existing:
        raise HTTPException(status_code=409, detail="Listing already exists for this space")

    listing = execute_insert("""
        INSERT INTO set_house_marketplace_listings (
            space_id, organization_id,
            daily_rate, hourly_rate, weekly_rate, monthly_rate,
            deposit_amount, deposit_percent,
            insurance_required, min_booking_hours,
            is_listed
        ) VALUES (
            :space_id, :org_id,
            :daily_rate, :hourly_rate, :weekly_rate, :monthly_rate,
            :deposit_amount, :deposit_percent,
            :insurance_required, :min_booking_hours,
            TRUE
        ) RETURNING id
    """, {
        "space_id": space_id,
        "org_id": org_id,
        "daily_rate": input.daily_rate,
        "hourly_rate": input.hourly_rate,
        "weekly_rate": input.weekly_rate,
        "monthly_rate": input.monthly_rate,
        "deposit_amount": input.deposit_amount,
        "deposit_percent": input.deposit_percent,
        "insurance_required": input.insurance_required or False,
        "min_booking_hours": input.min_booking_hours,
    })

    return {"listing_id": listing["id"], "space_id": space_id}


@router.put("/spaces/{space_id}/listing")
async def update_space_listing(
    space_id: str,
    input: UpdateListingInput,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update a marketplace listing for a space."""
    profile_id = get_profile_id(current_user)

    org = execute_single("""
        SELECT personal_set_house_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_set_house_org_id"):
        raise HTTPException(status_code=404, detail="Personal Set House organization not found")

    org_id = org["personal_set_house_org_id"]

    space = execute_single("""
        SELECT id FROM set_house_spaces
        WHERE id = :space_id AND organization_id = :org_id
    """, {"space_id": space_id, "org_id": org_id})

    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    listing = execute_single("""
        SELECT id FROM set_house_marketplace_listings WHERE space_id = :space_id
    """, {"space_id": space_id})

    if not listing:
        raise HTTPException(status_code=404, detail="No listing found for this space")

    execute_query("""
        UPDATE set_house_marketplace_listings SET
            is_listed = COALESCE(:is_listed, is_listed),
            daily_rate = COALESCE(:daily_rate, daily_rate),
            hourly_rate = COALESCE(:hourly_rate, hourly_rate),
            weekly_rate = COALESCE(:weekly_rate, weekly_rate),
            monthly_rate = COALESCE(:monthly_rate, monthly_rate),
            deposit_amount = COALESCE(:deposit_amount, deposit_amount),
            deposit_percent = COALESCE(:deposit_percent, deposit_percent),
            insurance_required = COALESCE(:insurance_required, insurance_required),
            min_booking_hours = COALESCE(:min_booking_hours, min_booking_hours),
            max_booking_days = COALESCE(:max_booking_days, max_booking_days),
            booking_notes = COALESCE(:booking_notes, booking_notes),
            access_instructions = COALESCE(:access_instructions, access_instructions),
            updated_at = NOW()
        WHERE space_id = :space_id
    """, {
        "space_id": space_id,
        "is_listed": input.is_listed,
        "daily_rate": input.daily_rate,
        "hourly_rate": input.hourly_rate,
        "weekly_rate": input.weekly_rate,
        "monthly_rate": input.monthly_rate,
        "deposit_amount": input.deposit_amount,
        "deposit_percent": input.deposit_percent,
        "insurance_required": input.insurance_required,
        "min_booking_hours": input.min_booking_hours,
        "max_booking_days": input.max_booking_days,
        "booking_notes": input.booking_notes,
        "access_instructions": input.access_instructions,
    })

    return {"success": True, "space_id": space_id}


@router.delete("/spaces/{space_id}/listing")
async def delete_space_listing(
    space_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Remove a listing from the marketplace (unlist the space)."""
    profile_id = get_profile_id(current_user)

    org = execute_single("""
        SELECT personal_set_house_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})

    if not org or not org.get("personal_set_house_org_id"):
        raise HTTPException(status_code=404, detail="Personal Set House organization not found")

    org_id = org["personal_set_house_org_id"]

    space = execute_single("""
        SELECT id FROM set_house_spaces
        WHERE id = :space_id AND organization_id = :org_id
    """, {"space_id": space_id, "org_id": org_id})

    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    execute_query("""
        DELETE FROM set_house_marketplace_listings WHERE space_id = :space_id
    """, {"space_id": space_id})

    return {"success": True, "space_id": space_id}


@router.get("/my-community-listings")
async def get_my_community_listings(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Get ALL marketplace listings for the current user across:
    1. Their personal Set House org (personal_set_house_org_id on profiles)
    2. Any Set House orgs they're a member of (organization_members table)

    Returns listings in full marketplace shape with space details.
    Used by the My Posts page to show all spaces the user has listed.
    """
    profile_id = get_profile_id(current_user)

    # Collect all org IDs this user controls
    org_ids = []

    # 1. Personal Set House org
    profile_row = execute_single("""
        SELECT personal_set_house_org_id FROM profiles WHERE id = :id
    """, {"id": profile_id})
    personal_org_id = profile_row.get("personal_set_house_org_id") if profile_row else None
    if personal_org_id:
        org_ids.append(personal_org_id)

    # 2. Set House orgs (organization_members table, excluding personal orgs)
    set_house_rows = execute_query("""
        SELECT om.organization_id FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id
        WHERE om.user_id = :profile_id
          AND o.is_personal_set_house_org = FALSE
          AND EXISTS (
              SELECT 1 FROM set_house_marketplace_listings shml
              WHERE shml.organization_id = om.organization_id
          )
    """, {"profile_id": profile_id})
    for row in (set_house_rows or []):
        oid = row.get("organization_id")
        if oid and oid not in org_ids:
            org_ids.append(oid)

    if not org_ids:
        return {"listings": [], "personal_org_id": personal_org_id}

    # Build parameterized IN clause
    params: Dict[str, Any] = {"profile_id": profile_id}
    org_placeholders = []
    for i, oid in enumerate(org_ids):
        key = f"org_{i}"
        params[key] = oid
        org_placeholders.append(f":{key}")
    in_clause = ", ".join(org_placeholders)

    params["limit"] = limit
    params["offset"] = offset

    listings = execute_query(f"""
        SELECT
            shml.id,
            shml.space_id,
            shml.organization_id,
            shml.is_listed,
            shml.daily_rate,
            shml.hourly_rate,
            shml.half_day_rate,
            shml.weekly_rate,
            shml.monthly_rate,
            shml.deposit_amount,
            shml.deposit_percent,
            shml.insurance_required,
            shml.min_booking_hours,
            shml.max_booking_days,
            shml.booking_notes,
            shml.created_at,
            shml.updated_at,
            shs.name as space_name,
            shs.space_type,
            shs.square_footage,
            shs.description as space_description,
            shs.photos as space_photos,
            shs.status as space_status,
            shs.current_condition as space_current_condition
        FROM set_house_marketplace_listings shml
        JOIN set_house_spaces shs ON shml.space_id = shs.id
        WHERE shml.organization_id IN ({in_clause})
        ORDER BY shml.created_at DESC
        LIMIT :limit OFFSET :offset
    """, params)

    # Reshape into nested space format
    result = []
    for row in (listings or []):
        result.append({
            "id": row["id"],
            "space_id": row["space_id"],
            "organization_id": row["organization_id"],
            "is_listed": row["is_listed"],
            "daily_rate": row["daily_rate"],
            "hourly_rate": row["hourly_rate"],
            "half_day_rate": row.get("half_day_rate"),
            "weekly_rate": row["weekly_rate"],
            "monthly_rate": row["monthly_rate"],
            "deposit_amount": row["deposit_amount"],
            "deposit_percent": row["deposit_percent"],
            "insurance_required": row["insurance_required"],
            "min_booking_hours": row["min_booking_hours"],
            "max_booking_days": row.get("max_booking_days"),
            "booking_notes": row.get("booking_notes"),
            "created_at": str(row["created_at"]) if row["created_at"] else None,
            "updated_at": str(row["updated_at"]) if row["updated_at"] else None,
            "space": {
                "id": row["space_id"],
                "name": row["space_name"],
                "space_type": row["space_type"],
                "square_footage": row["square_footage"],
                "description": row["space_description"],
                "photos": row["space_photos"],
                "status": row["space_status"],
                "current_condition": row["space_current_condition"],
            },
        })

    return {"listings": result, "personal_org_id": personal_org_id}
