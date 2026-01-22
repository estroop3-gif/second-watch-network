"""
Set House Organizations API

Endpoints for managing organizations in the Set House module.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/organizations", tags=["Set House Organizations"])


# ============================================================================
# SCHEMAS
# ============================================================================

class OrganizationCreate(BaseModel):
    name: str
    org_type: Optional[str] = "studio"  # studio, location_house, hybrid, agency, other
    description: Optional[str] = None
    website: Optional[str] = None
    # Required location fields
    address_line1: str
    city: str
    state: str
    postal_code: str
    country: str = "US"
    hide_exact_address: bool = False


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    org_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    logo_url: Optional[str] = None


class MemberInvite(BaseModel):
    user_id: str
    role: str = "member"
    title: Optional[str] = None
    department: Optional[str] = None


class LocationCreate(BaseModel):
    name: str
    location_type: str = "facility"
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "US"
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_default: bool = False


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    """Extract profile ID from user dict."""
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    """Check user has access to organization."""
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def geocode_address(
    address_line1: str,
    city: str,
    state: str,
    postal_code: str,
    country: str = "US"
) -> tuple[float, float]:
    """Geocode an address to lat/lng coordinates."""
    from app.services.geocoding import geocode_address as aws_geocode

    address_parts = [address_line1, city, state, postal_code, country]
    full_address = ", ".join(filter(None, address_parts))

    try:
        result = aws_geocode(full_address)
        if result:
            return result['lat'], result['lon']

        fallback_address = f"{city}, {state}, {country}"
        result = aws_geocode(fallback_address)
        if result:
            return result['lat'], result['lon']

    except Exception as e:
        print(f"AWS Geocoding error: {e}")

    return None, None


# ============================================================================
# ORGANIZATION ENDPOINTS
# ============================================================================

@router.get("/")
async def list_my_organizations(user=Depends(get_current_user)):
    """List Set House organizations the current user belongs to."""
    profile_id = get_profile_id(user)
    orgs = set_house_service.get_user_organizations(profile_id)
    return {"organizations": orgs}


@router.post("/")
async def create_organization(
    data: OrganizationCreate,
    user=Depends(get_current_user)
):
    """Create a new Set House organization with required location."""
    profile_id = get_profile_id(user)

    latitude, longitude = geocode_address(
        address_line1=data.address_line1,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        country=data.country
    )

    public_location_display = f"{data.city}, {data.state}"

    org = set_house_service.create_organization(
        name=data.name,
        created_by=profile_id,
        org_type=data.org_type,
        description=data.description,
        website=data.website,
        address_line1=data.address_line1,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        country=data.country,
        latitude=latitude,
        longitude=longitude,
        hide_exact_address=data.hide_exact_address,
        public_location_display=public_location_display
    )

    if not org:
        raise HTTPException(status_code=500, detail="Failed to create organization")

    return {"organization": org}


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get organization details."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    org = set_house_service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {"organization": org}


@router.put("/{org_id}")
async def update_organization(
    org_id: str,
    data: OrganizationUpdate,
    user=Depends(get_current_user)
):
    """Update organization details."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    allowed_fields = [
        "name", "org_type", "email", "phone", "website", "address_line1",
        "address_line2", "city", "state", "postal_code", "country", "logo_url"
    ]

    updates = []
    params = {"org_id": org_id}

    data_dict = data.model_dump(exclude_unset=True)
    for field in allowed_fields:
        if field in data_dict:
            db_field = "website_url" if field == "website" else field
            updates.append(f"{db_field} = :{field}")
            params[field] = data_dict[field]

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    from app.core.database import execute_insert
    org = execute_insert(
        f"""
        UPDATE organizations
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = :org_id
        RETURNING *
        """,
        params
    )

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {"organization": org}


@router.get("/{org_id}/members")
async def list_organization_members(
    org_id: str,
    user=Depends(get_current_user)
):
    """List organization members."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query
    members = execute_query(
        """
        SELECT om.*, p.display_name, p.avatar_url, p.email
        FROM organization_members om
        JOIN profiles p ON p.id = om.user_id
        WHERE om.organization_id = :org_id
        ORDER BY om.role, p.display_name
        """,
        {"org_id": org_id}
    )

    return {"members": members}


@router.post("/{org_id}/members")
async def invite_member(
    org_id: str,
    data: MemberInvite,
    user=Depends(get_current_user)
):
    """Invite a member to the organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_insert
    member = execute_insert(
        """
        INSERT INTO organization_members (
            organization_id, user_id, role, title, department, invited_by
        ) VALUES (
            :org_id, :user_id, :role, :title, :department, :invited_by
        )
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
            role = :role, title = :title, department = :department,
            is_active = TRUE, updated_at = NOW()
        RETURNING *
        """,
        {
            "org_id": org_id,
            "user_id": data.user_id,
            "role": data.role,
            "title": data.title,
            "department": data.department,
            "invited_by": profile_id
        }
    )

    return {"member": member}


@router.delete("/{org_id}/members/{user_id}")
async def remove_member(
    org_id: str,
    user_id: str,
    user=Depends(get_current_user)
):
    """Remove a member from the organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_query
    execute_query(
        """
        UPDATE organization_members
        SET is_active = FALSE, updated_at = NOW()
        WHERE organization_id = :org_id AND user_id = :user_id
        """,
        {"org_id": org_id, "user_id": user_id}
    )

    return {"success": True}


# ============================================================================
# CATEGORY ENDPOINTS
# ============================================================================

@router.get("/{org_id}/categories")
async def list_categories(
    org_id: str,
    user=Depends(get_current_user)
):
    """List space categories for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    categories = set_house_service.list_categories(org_id)
    return {"categories": categories}


# ============================================================================
# LOCATION ENDPOINTS
# ============================================================================

@router.get("/{org_id}/locations")
async def list_locations(
    org_id: str,
    user=Depends(get_current_user)
):
    """List facility locations for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    locations = set_house_service.list_locations(org_id)
    return {"locations": locations}


@router.post("/{org_id}/locations")
async def create_location(
    org_id: str,
    data: LocationCreate,
    user=Depends(get_current_user)
):
    """Create a new facility location."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    location = set_house_service.create_location(org_id, data.name, **data.model_dump(exclude={"name"}))

    if not location:
        raise HTTPException(status_code=500, detail="Failed to create location")

    return {"location": location}


# ============================================================================
# SETTINGS ENDPOINTS
# ============================================================================

@router.get("/{org_id}/settings")
async def get_organization_settings(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get organization Set House settings."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_single
    settings = execute_single(
        "SELECT * FROM set_house_organization_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    return {"settings": settings}


@router.put("/{org_id}/settings")
async def update_organization_settings(
    org_id: str,
    data: dict,
    user=Depends(get_current_user)
):
    """Update organization Set House settings."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    allowed_fields = [
        "space_id_prefix", "require_photos_on_intake", "require_photos_on_booking_start",
        "require_photos_on_booking_end", "require_photos_on_damage",
        "require_signature_on_booking_start", "require_signature_on_booking_end",
        "strikes_enabled", "strikes_before_escalation", "auto_strike_on_damage",
        "auto_strike_on_late_checkout", "default_booking_start_time", "default_booking_end_time",
        "minimum_booking_hours", "advance_booking_days", "max_advance_booking_days",
        "cancellation_notice_hours", "cancellation_fee_percent",
        "work_order_statuses", "work_order_reference_prefix"
    ]

    updates = []
    params = {"org_id": org_id}

    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = :{field}")
            params[field] = data[field]

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    from app.core.database import execute_insert
    import json

    # Handle JSONB fields
    if "work_order_statuses" in params and isinstance(params["work_order_statuses"], list):
        params["work_order_statuses"] = json.dumps(params["work_order_statuses"])

    settings = execute_insert(
        f"""
        INSERT INTO set_house_organization_settings (organization_id, {', '.join(data.keys())})
        VALUES (:org_id, {', '.join([f':{k}' for k in data.keys()])})
        ON CONFLICT (organization_id) DO UPDATE SET
            {', '.join(updates)}, updated_at = NOW()
        RETURNING *
        """,
        params
    )

    return {"settings": settings}


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.get("/{org_id}/clients")
async def list_client_companies(
    org_id: str,
    user=Depends(get_current_user)
):
    """List client companies for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    clients = set_house_service.list_client_companies(org_id)
    return {"clients": clients}


@router.get("/{org_id}/contacts")
async def list_client_contacts(
    org_id: str,
    company_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    """List client contacts for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    contacts = set_house_service.list_client_contacts(org_id, company_id)
    return {"contacts": contacts}
