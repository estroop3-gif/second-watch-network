"""
Gear House Organizations API

Endpoints for managing organizations in the Gear House module.
"""
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from app.core.auth import get_current_user_from_token
from app.api.users import get_profile_id_from_cognito_id
from app.services import gear_service

router = APIRouter(prefix="/organizations", tags=["Gear Organizations"])


# ============================================================================
# SCHEMAS
# ============================================================================

class OrganizationCreate(BaseModel):
    name: str
    org_type: str = "production_company"
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "US"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
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
    location_type: str = "warehouse"
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "US"
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    is_default_home: bool = False


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_profile_id(authorization: str = Header(None)) -> str:
    """Extract profile ID from authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")

    user = await get_current_user_from_token(authorization)
    profile_id = get_profile_id_from_cognito_id(user["sub"])
    return profile_id or user["sub"]


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    """Check user has access to organization."""
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# ORGANIZATION ENDPOINTS
# ============================================================================

@router.get("/")
async def list_my_organizations(authorization: str = Header(None)):
    """List organizations the current user belongs to."""
    profile_id = await get_current_profile_id(authorization)
    orgs = gear_service.get_user_organizations(profile_id)
    return {"organizations": orgs}


@router.post("/")
async def create_organization(
    data: OrganizationCreate,
    authorization: str = Header(None)
):
    """Create a new organization."""
    profile_id = await get_current_profile_id(authorization)

    org = gear_service.create_organization(
        name=data.name,
        org_type=data.org_type,
        created_by=profile_id,
        **data.dict(exclude={"name", "org_type"})
    )

    if not org:
        raise HTTPException(status_code=500, detail="Failed to create organization")

    return {"organization": org}


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    authorization: str = Header(None)
):
    """Get organization details."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    org = gear_service.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    return {"organization": org}


@router.get("/{org_id}/members")
async def list_organization_members(
    org_id: str,
    authorization: str = Header(None)
):
    """List organization members."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query
    members = execute_query(
        """
        SELECT om.*, p.display_name, p.avatar_url, p.email
        FROM organization_members om
        JOIN profiles p ON p.id = om.user_id
        WHERE om.organization_id = :org_id AND om.is_active = TRUE
        ORDER BY om.role, p.display_name
        """,
        {"org_id": org_id}
    )

    return {"members": members}


@router.post("/{org_id}/members")
async def invite_member(
    org_id: str,
    data: MemberInvite,
    authorization: str = Header(None)
):
    """Invite a member to the organization."""
    profile_id = await get_current_profile_id(authorization)
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
    authorization: str = Header(None)
):
    """Remove a member from the organization."""
    profile_id = await get_current_profile_id(authorization)
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
    authorization: str = Header(None)
):
    """List gear categories for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    categories = gear_service.list_categories(org_id)
    return {"categories": categories}


# ============================================================================
# LOCATION ENDPOINTS
# ============================================================================

@router.get("/{org_id}/locations")
async def list_locations(
    org_id: str,
    authorization: str = Header(None)
):
    """List gear locations for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    locations = gear_service.list_locations(org_id)
    return {"locations": locations}


@router.post("/{org_id}/locations")
async def create_location(
    org_id: str,
    data: LocationCreate,
    authorization: str = Header(None)
):
    """Create a new gear location."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    location = gear_service.create_location(org_id, data.name, **data.dict(exclude={"name"}))

    if not location:
        raise HTTPException(status_code=500, detail="Failed to create location")

    return {"location": location}


# ============================================================================
# SETTINGS ENDPOINTS
# ============================================================================

@router.get("/{org_id}/settings")
async def get_organization_settings(
    org_id: str,
    authorization: str = Header(None)
):
    """Get organization gear settings."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_single
    settings = execute_single(
        "SELECT * FROM gear_organization_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    return {"settings": settings}


@router.put("/{org_id}/settings")
async def update_organization_settings(
    org_id: str,
    data: dict,
    authorization: str = Header(None)
):
    """Update organization gear settings."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    # Build update query dynamically
    allowed_fields = [
        "barcode_format", "qr_enabled", "label_prefix", "default_scan_mode",
        "require_photos_on_intake", "require_photos_on_checkout",
        "require_photos_on_checkin", "require_photos_on_damage",
        "require_signature_on_handoff", "require_signature_on_return",
        "strikes_enabled", "strikes_before_escalation",
        "auto_strike_on_damage", "auto_strike_on_missing",
        "consumables_billing_model", "consumables_buyback_rate"
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
    settings = execute_insert(
        f"""
        UPDATE gear_organization_settings
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE organization_id = :org_id
        RETURNING *
        """,
        params
    )

    return {"settings": settings}
