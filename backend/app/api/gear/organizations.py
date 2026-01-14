"""
Gear House Organizations API

Endpoints for managing organizations in the Gear House module.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import gear_service

router = APIRouter(prefix="/organizations", tags=["Gear Organizations"])


# ============================================================================
# SCHEMAS
# ============================================================================

class OrganizationCreate(BaseModel):
    name: str
    org_type: Optional[str] = "production_company"  # production_company, rental_house, hybrid, studio, agency, other
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
    org_type: Optional[str] = None  # production_company, rental_house, hybrid, studio, agency, other
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

def get_profile_id(user: Dict[str, Any]) -> str:
    """Extract profile ID from user dict."""
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    """Check user has access to organization."""
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def geocode_address(
    address_line1: str,
    city: str,
    state: str,
    postal_code: str,
    country: str = "US"
) -> tuple[float, float]:
    """
    Geocode an address to lat/lng coordinates using AWS Location Service.
    Returns (latitude, longitude) tuple.
    """
    from app.services.geocoding import geocode_address as aws_geocode

    # Build the full address string
    address_parts = [address_line1, city, state, postal_code, country]
    full_address = ", ".join(filter(None, address_parts))

    try:
        result = aws_geocode(full_address)
        if result:
            return result['lat'], result['lon']

        # If full address fails, try just city, state
        fallback_address = f"{city}, {state}, {country}"
        result = aws_geocode(fallback_address)
        if result:
            return result['lat'], result['lon']

    except Exception as e:
        # Log error but don't fail - coordinates are nice to have
        print(f"AWS Geocoding error: {e}")

    # Return None values if geocoding fails (will be null in DB)
    return None, None


# ============================================================================
# ORGANIZATION ENDPOINTS
# ============================================================================

@router.get("/")
async def list_my_organizations(user=Depends(get_current_user)):
    """List organizations the current user belongs to."""
    profile_id = get_profile_id(user)
    orgs = gear_service.get_user_organizations(profile_id)
    return {"organizations": orgs}


@router.post("/")
async def create_organization(
    data: OrganizationCreate,
    user=Depends(get_current_user)
):
    """Create a new organization with required location."""
    profile_id = get_profile_id(user)

    # Geocode the address to get coordinates
    latitude, longitude = geocode_address(
        address_line1=data.address_line1,
        city=data.city,
        state=data.state,
        postal_code=data.postal_code,
        country=data.country
    )

    # Generate public location display (City, State)
    public_location_display = f"{data.city}, {data.state}"

    org = gear_service.create_organization(
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

    org = gear_service.get_organization(org_id)
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

    # Build update query dynamically
    allowed_fields = [
        "name", "org_type", "email", "phone", "website", "address_line1",
        "address_line2", "city", "state", "postal_code", "country", "logo_url"
    ]

    updates = []
    params = {"org_id": org_id}

    data_dict = data.model_dump(exclude_unset=True)
    for field in allowed_fields:
        if field in data_dict:
            # Map website to website_url in DB
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
    """List gear categories for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    categories = gear_service.list_categories(org_id)
    return {"categories": categories}


# ============================================================================
# LOCATION ENDPOINTS
# ============================================================================

@router.get("/{org_id}/locations")
async def list_locations(
    org_id: str,
    user=Depends(get_current_user)
):
    """List gear locations for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    locations = gear_service.list_locations(org_id)
    return {"locations": locations}


@router.post("/{org_id}/locations")
async def create_location(
    org_id: str,
    data: LocationCreate,
    user=Depends(get_current_user)
):
    """Create a new gear location."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    location = gear_service.create_location(org_id, data.name, **data.model_dump(exclude={"name"}))

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
    """Get organization gear settings."""
    profile_id = get_profile_id(user)
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
    user=Depends(get_current_user)
):
    """Update organization gear settings."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    # Build update query dynamically
    allowed_fields = [
        "barcode_format", "qr_enabled", "label_prefix", "default_scan_mode",
        "require_photos_on_intake", "require_photos_on_checkout",
        "require_photos_on_checkin", "require_photos_on_damage",
        "require_signature_on_handoff", "require_signature_on_return",
        "strikes_enabled", "strikes_before_escalation",
        "auto_strike_on_damage", "auto_strike_on_missing",
        "consumables_billing_model", "consumables_buyback_rate",
        # Checkout verification settings
        "team_checkout_verification_required", "team_checkout_verify_method",
        "team_checkout_discrepancy_action", "team_checkout_kit_verification",
        "client_checkout_verification_required", "client_checkout_verify_method",
        "client_checkout_discrepancy_action", "client_checkout_kit_verification",
        # Receiver verification settings
        "receiver_verification_mode", "receiver_verification_timing",
        # Check-in verification settings
        "checkin_verification_required", "checkin_verify_method", "checkin_kit_verification",
        # Equipment package verification settings
        "team_checkout_package_verification", "client_checkout_package_verification",
        "checkin_package_verification",
        # Work order staging settings
        "work_order_staging_verify_method", "work_order_auto_ready"
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


# ============================================================================
# CONTACT ENDPOINTS (External custodians)
# ============================================================================

class ContactCreate(BaseModel):
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "US"
    notes: Optional[str] = None
    client_company_id: Optional[str] = None


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    client_company_id: Optional[str] = None


@router.get("/{org_id}/contacts")
async def list_contacts(
    org_id: str,
    include_inactive: bool = False,
    user=Depends(get_current_user)
):
    """List external contacts for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    query = """
        SELECT c.*,
               cc.name as client_company_name,
               p.display_name as linked_user_name
        FROM gear_organization_contacts c
        LEFT JOIN gear_client_companies cc ON c.client_company_id = cc.id
        LEFT JOIN profiles p ON c.linked_user_id = p.id
        WHERE c.organization_id = :org_id
    """
    if not include_inactive:
        query += " AND c.is_active = TRUE"
    query += " ORDER BY c.last_name, c.first_name"

    contacts = execute_query(query, {"org_id": org_id})
    return {"contacts": contacts}


@router.post("/{org_id}/contacts")
async def create_contact(
    org_id: str,
    data: ContactCreate,
    user=Depends(get_current_user)
):
    """Create a new external contact."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    contact = execute_insert(
        """
        INSERT INTO gear_organization_contacts (
            organization_id, first_name, last_name, email, phone,
            company, job_title, address_line1, address_line2,
            city, state, postal_code, country, notes, created_by,
            client_company_id
        ) VALUES (
            :org_id, :first_name, :last_name, :email, :phone,
            :company, :job_title, :address_line1, :address_line2,
            :city, :state, :postal_code, :country, :notes, :created_by,
            :client_company_id
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "first_name": data.first_name,
            "last_name": data.last_name,
            "email": data.email,
            "phone": data.phone,
            "company": data.company,
            "job_title": data.job_title,
            "address_line1": data.address_line1,
            "address_line2": data.address_line2,
            "city": data.city,
            "state": data.state,
            "postal_code": data.postal_code,
            "country": data.country,
            "notes": data.notes,
            "created_by": profile_id,
            "client_company_id": data.client_company_id
        }
    )

    return {"contact": contact}


@router.get("/{org_id}/contacts/{contact_id}")
async def get_contact(
    org_id: str,
    contact_id: str,
    user=Depends(get_current_user)
):
    """Get a specific contact."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single
    contact = execute_single(
        """
        SELECT c.*,
               cc.name as client_company_name,
               p.display_name as linked_user_name
        FROM gear_organization_contacts c
        LEFT JOIN gear_client_companies cc ON c.client_company_id = cc.id
        LEFT JOIN profiles p ON c.linked_user_id = p.id
        WHERE c.id = :contact_id AND c.organization_id = :org_id
        """,
        {"contact_id": contact_id, "org_id": org_id}
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    return {"contact": contact}


@router.put("/{org_id}/contacts/{contact_id}")
async def update_contact(
    org_id: str,
    contact_id: str,
    data: ContactUpdate,
    user=Depends(get_current_user)
):
    """Update an external contact."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Build update query dynamically
    allowed_fields = [
        "first_name", "last_name", "email", "phone", "company", "job_title",
        "address_line1", "address_line2", "city", "state", "postal_code",
        "country", "notes", "is_active", "client_company_id"
    ]

    updates = []
    params = {"contact_id": contact_id, "org_id": org_id}

    data_dict = data.model_dump(exclude_unset=True)
    for field in allowed_fields:
        if field in data_dict:
            updates.append(f"{field} = :{field}")
            params[field] = data_dict[field]

    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")

    from app.core.database import execute_insert
    contact = execute_insert(
        f"""
        UPDATE gear_organization_contacts
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = :contact_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    return {"contact": contact}


@router.delete("/{org_id}/contacts/{contact_id}")
async def delete_contact(
    org_id: str,
    contact_id: str,
    user=Depends(get_current_user)
):
    """Soft delete (deactivate) a contact."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query
    execute_query(
        """
        UPDATE gear_organization_contacts
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = :contact_id AND organization_id = :org_id
        """,
        {"contact_id": contact_id, "org_id": org_id}
    )

    return {"success": True}


# ============================================================================
# CLIENT COMPANIES ENDPOINTS
# ============================================================================

class ClientCompanyCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "US"
    notes: Optional[str] = None


class ClientCompanyUpdate(BaseModel):
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
    insurance_file_url: Optional[str] = None
    insurance_file_name: Optional[str] = None
    insurance_expiry: Optional[str] = None
    coi_file_url: Optional[str] = None
    coi_file_name: Optional[str] = None
    coi_expiry: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/{org_id}/client-companies")
async def list_client_companies(
    org_id: str,
    include_inactive: bool = False,
    user=Depends(get_current_user)
):
    """List client companies for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    query = """
        SELECT cc.*,
            (SELECT COUNT(*) FROM gear_organization_contacts c
             WHERE c.client_company_id = cc.id AND c.is_active = TRUE) as contact_count
        FROM gear_client_companies cc
        WHERE cc.organization_id = :org_id
    """
    if not include_inactive:
        query += " AND cc.is_active = TRUE"
    query += " ORDER BY cc.name"

    companies = execute_query(query, {"org_id": org_id})
    return {"companies": companies}


@router.post("/{org_id}/client-companies")
async def create_client_company(
    org_id: str,
    data: ClientCompanyCreate,
    user=Depends(get_current_user)
):
    """Create a new client company."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    company = execute_insert(
        """
        INSERT INTO gear_client_companies (
            organization_id, name, email, phone, website,
            address_line1, address_line2, city, state, postal_code, country,
            notes, created_by
        ) VALUES (
            :org_id, :name, :email, :phone, :website,
            :address_line1, :address_line2, :city, :state, :postal_code, :country,
            :notes, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": data.name,
            "email": data.email,
            "phone": data.phone,
            "website": data.website,
            "address_line1": data.address_line1,
            "address_line2": data.address_line2,
            "city": data.city,
            "state": data.state,
            "postal_code": data.postal_code,
            "country": data.country,
            "notes": data.notes,
            "created_by": profile_id
        }
    )

    return {"company": company}


@router.get("/{org_id}/client-companies/{company_id}")
async def get_client_company(
    org_id: str,
    company_id: str,
    user=Depends(get_current_user)
):
    """Get a specific client company with its contacts."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    company = execute_single(
        """
        SELECT * FROM gear_client_companies
        WHERE id = :company_id AND organization_id = :org_id
        """,
        {"company_id": company_id, "org_id": org_id}
    )

    if not company:
        raise HTTPException(status_code=404, detail="Client company not found")

    # Get contacts for this company
    contacts = execute_query(
        """
        SELECT c.*, p.display_name as linked_user_name, p.avatar_url as linked_user_avatar
        FROM gear_organization_contacts c
        LEFT JOIN profiles p ON c.linked_user_id = p.id
        WHERE c.client_company_id = :company_id AND c.is_active = TRUE
        ORDER BY c.last_name, c.first_name
        """,
        {"company_id": company_id}
    )

    return {"company": company, "contacts": contacts}


@router.put("/{org_id}/client-companies/{company_id}")
async def update_client_company(
    org_id: str,
    company_id: str,
    data: ClientCompanyUpdate,
    user=Depends(get_current_user)
):
    """Update a client company."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    # Build dynamic update query
    update_fields = []
    params = {"company_id": company_id, "org_id": org_id}

    for field, value in data.model_dump(exclude_unset=True).items():
        update_fields.append(f"{field} = :{field}")
        params[field] = value

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_fields.append("updated_at = NOW()")

    company = execute_insert(
        f"""
        UPDATE gear_client_companies
        SET {', '.join(update_fields)}
        WHERE id = :company_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not company:
        raise HTTPException(status_code=404, detail="Client company not found")

    return {"company": company}


@router.delete("/{org_id}/client-companies/{company_id}")
async def delete_client_company(
    org_id: str,
    company_id: str,
    user=Depends(get_current_user)
):
    """Soft delete (deactivate) a client company."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query
    execute_query(
        """
        UPDATE gear_client_companies
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = :company_id AND organization_id = :org_id
        """,
        {"company_id": company_id, "org_id": org_id}
    )

    return {"success": True}


# ============================================================================
# DOCUMENT UPLOAD URLs
# ============================================================================

class UploadUrlRequest(BaseModel):
    file_name: str
    content_type: str


@router.post("/{org_id}/client-companies/{company_id}/upload-url")
async def get_company_upload_url(
    org_id: str,
    company_id: str,
    doc_type: str,  # 'insurance' or 'coi'
    data: UploadUrlRequest,
    user=Depends(get_current_user)
):
    """Get presigned URL for uploading company documents."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    if doc_type not in ["insurance", "coi"]:
        raise HTTPException(status_code=400, detail="doc_type must be 'insurance' or 'coi'")

    from app.core.storage import storage_client
    import uuid

    # Generate unique filename
    ext = data.file_name.split(".")[-1] if "." in data.file_name else "pdf"
    unique_filename = f"{doc_type}_{uuid.uuid4()}.{ext}"
    s3_key = f"gear/{org_id}/companies/{company_id}/{unique_filename}"

    # Get presigned upload URL
    bucket_name = "swn-backlot-files-517220555400"
    result = storage_client.from_(bucket_name).create_signed_upload_url(
        path=s3_key,
        expires_in=3600  # 1 hour
    )

    file_url = f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"

    return {
        "upload_url": result.get("signedUrl") or result.get("signed_url"),
        "file_url": file_url,
        "s3_key": s3_key
    }


@router.post("/{org_id}/contacts/{contact_id}/upload-url")
async def get_contact_upload_url(
    org_id: str,
    contact_id: str,
    doc_type: str,  # 'id_photo' or 'personal_insurance'
    data: UploadUrlRequest,
    user=Depends(get_current_user)
):
    """Get presigned URL for uploading contact documents."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    if doc_type not in ["id_photo", "personal_insurance"]:
        raise HTTPException(status_code=400, detail="doc_type must be 'id_photo' or 'personal_insurance'")

    from app.core.storage import storage_client
    import uuid

    # Generate unique filename
    ext = data.file_name.split(".")[-1] if "." in data.file_name else "jpg"
    unique_filename = f"{doc_type}_{uuid.uuid4()}.{ext}"
    s3_key = f"gear/{org_id}/contacts/{contact_id}/{unique_filename}"

    # Get presigned upload URL
    bucket_name = "swn-backlot-files-517220555400"
    result = storage_client.from_(bucket_name).create_signed_upload_url(
        path=s3_key,
        expires_in=3600  # 1 hour
    )

    file_url = f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"

    return {
        "upload_url": result.get("signedUrl") or result.get("signed_url"),
        "file_url": file_url,
        "s3_key": s3_key
    }


# ============================================================================
# ENHANCED CONTACT ENDPOINTS
# ============================================================================

class ContactEnhancedUpdate(BaseModel):
    """Extended contact update with new fields."""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    # New fields
    client_company_id: Optional[str] = None
    linked_user_id: Optional[str] = None
    id_photo_url: Optional[str] = None
    id_photo_file_name: Optional[str] = None
    id_type: Optional[str] = None
    id_expiry: Optional[str] = None
    personal_insurance_url: Optional[str] = None
    personal_insurance_file_name: Optional[str] = None
    personal_insurance_expiry: Optional[str] = None


class LinkUserRequest(BaseModel):
    user_id: str


@router.put("/{org_id}/contacts/{contact_id}/link-user")
async def link_contact_to_user(
    org_id: str,
    contact_id: str,
    data: LinkUserRequest,
    user=Depends(get_current_user)
):
    """Link a contact to a platform user for project integration."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert, execute_single

    # Verify the user exists
    linked_user = execute_single(
        "SELECT id, display_name, email FROM profiles WHERE id = :user_id",
        {"user_id": data.user_id}
    )
    if not linked_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update contact
    contact = execute_insert(
        """
        UPDATE gear_organization_contacts
        SET linked_user_id = :user_id, updated_at = NOW()
        WHERE id = :contact_id AND organization_id = :org_id
        RETURNING *
        """,
        {"user_id": data.user_id, "contact_id": contact_id, "org_id": org_id}
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    return {"contact": contact, "linked_user": linked_user}


@router.delete("/{org_id}/contacts/{contact_id}/link-user")
async def unlink_contact_from_user(
    org_id: str,
    contact_id: str,
    user=Depends(get_current_user)
):
    """Unlink a contact from their platform user."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    contact = execute_insert(
        """
        UPDATE gear_organization_contacts
        SET linked_user_id = NULL, updated_at = NOW()
        WHERE id = :contact_id AND organization_id = :org_id
        RETURNING *
        """,
        {"contact_id": contact_id, "org_id": org_id}
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    return {"contact": contact}


@router.get("/{org_id}/contacts/{contact_id}/projects")
async def get_contact_projects(
    org_id: str,
    contact_id: str,
    user=Depends(get_current_user)
):
    """Get Backlot projects for a contact's linked user."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    # Get contact with linked user
    contact = execute_single(
        """
        SELECT c.*, p.display_name as linked_user_name
        FROM gear_organization_contacts c
        LEFT JOIN profiles p ON c.linked_user_id = p.id
        WHERE c.id = :contact_id AND c.organization_id = :org_id
        """,
        {"contact_id": contact_id, "org_id": org_id}
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    if not contact.get("linked_user_id"):
        return {"projects": [], "message": "Contact is not linked to a platform user"}

    # Get projects where linked user is owner or member
    user_id = contact["linked_user_id"]
    projects = execute_query(
        """
        SELECT p.id, p.title as name, p.status,
               CASE WHEN p.owner_id = :user_id THEN 'owner'
                    ELSE COALESCE(pm.role, 'member')
               END as role,
               p.created_at
        FROM backlot_projects p
        LEFT JOIN backlot_project_members pm ON pm.project_id = p.id AND pm.user_id = :user_id
        WHERE (p.owner_id = :user_id OR pm.user_id = :user_id)
          AND p.status NOT IN ('archived', 'completed')
        GROUP BY p.id, p.title, p.status, p.owner_id, p.created_at, pm.role
        ORDER BY p.created_at DESC
        LIMIT 50
        """,
        {"user_id": user_id}
    )

    return {"projects": projects, "linked_user_name": contact.get("linked_user_name")}


# ============================================================================
# MEMBER PROJECT FETCH (For Team Checkouts)
# ============================================================================

@router.get("/{org_id}/members/{user_id}/projects")
async def get_member_projects(
    org_id: str,
    user_id: str,
    user=Depends(get_current_user)
):
    """Get Backlot projects for an organization member."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    # Verify user is a member of the org
    from app.core.database import execute_single
    member = execute_single(
        """
        SELECT * FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id AND status = 'active'
        """,
        {"org_id": org_id, "user_id": user_id}
    )

    if not member:
        raise HTTPException(status_code=404, detail="Member not found in organization")

    # Get projects where member is owner or team member
    projects = execute_query(
        """
        SELECT p.id, p.title as name, p.status,
               CASE WHEN p.owner_id = :user_id THEN 'owner'
                    ELSE COALESCE(pm.role, 'member')
               END as role,
               p.created_at
        FROM backlot_projects p
        LEFT JOIN backlot_project_members pm ON pm.project_id = p.id AND pm.user_id = :user_id
        WHERE (p.owner_id = :user_id OR pm.user_id = :user_id)
          AND p.status NOT IN ('archived', 'completed')
        GROUP BY p.id, p.title, p.status, p.owner_id, p.created_at, pm.role
        ORDER BY p.created_at DESC
        LIMIT 50
        """,
        {"user_id": user_id}
    )

    return {"projects": projects}


# ============================================================================
# USER SEARCH (For linking contacts)
# ============================================================================

@router.get("/{org_id}/search-users")
async def search_users_for_linking(
    org_id: str,
    email: Optional[str] = None,
    query: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Search platform users by email or name for linking to contacts."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    if email:
        # Exact email match
        users = execute_query(
            """
            SELECT id, display_name, email, avatar_url,
                (SELECT COUNT(*) FROM backlot_projects bp
                 WHERE bp.owner_id = p.id AND bp.status NOT IN ('archived', 'completed')) as project_count
            FROM profiles p
            WHERE LOWER(email) = LOWER(:email)
            LIMIT 10
            """,
            {"email": email}
        )
    elif query:
        # Search by name or email
        users = execute_query(
            """
            SELECT id, display_name, email, avatar_url,
                (SELECT COUNT(*) FROM backlot_projects bp
                 WHERE bp.owner_id = p.id AND bp.status NOT IN ('archived', 'completed')) as project_count
            FROM profiles p
            WHERE LOWER(display_name) LIKE LOWER(:query)
               OR LOWER(email) LIKE LOWER(:query)
            LIMIT 10
            """,
            {"query": f"%{query}%"}
        )
    else:
        users = []

    return {"users": users}
