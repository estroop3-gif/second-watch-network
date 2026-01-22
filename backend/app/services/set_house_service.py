"""
Set House Service Layer

Comprehensive service module for the Set House bounded context.
Handles spaces, packages, transactions, conditions, incidents, repairs, and strikes.
Mirrors gear_service.py patterns for studio/location rentals.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, date, timedelta, timezone
from uuid import UUID
import json

from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.core.logging import get_logger
from app.core.storage import storage_client

logger = get_logger(__name__)


# ============================================================================
# ORGANIZATION SERVICES
# ============================================================================

def get_organization(org_id: str) -> Optional[Dict[str, Any]]:
    """Get organization by ID with Set House settings."""
    return execute_single(
        """
        SELECT o.*, shos.space_id_prefix, shos.require_photos_on_intake,
               shos.strikes_enabled, shos.strikes_before_escalation,
               shos.default_booking_start_time, shos.default_booking_end_time,
               shos.minimum_booking_hours, shos.advance_booking_days
        FROM organizations o
        LEFT JOIN set_house_organization_settings shos ON shos.organization_id = o.id
        WHERE o.id = :org_id
        """,
        {"org_id": org_id}
    )


def get_user_organizations(user_id: str) -> List[Dict[str, Any]]:
    """Get all Set House organizations a user belongs to."""
    return execute_query(
        """
        SELECT o.*, om.role,
               (SELECT COUNT(*) FROM set_house_spaces s WHERE s.organization_id = o.id AND s.is_active = TRUE) as space_count
        FROM organizations o
        JOIN organization_members om ON om.organization_id = o.id
        LEFT JOIN set_house_organization_settings shos ON shos.organization_id = o.id
        WHERE om.user_id = :user_id
          AND shos.id IS NOT NULL
        ORDER BY o.name
        """,
        {"user_id": user_id}
    )


def create_organization(
    name: str,
    created_by: str,
    org_type: str = "studio",
    description: str = None,
    website: str = None,
    # Location fields
    address_line1: str = None,
    city: str = None,
    state: str = None,
    postal_code: str = None,
    country: str = "US",
    latitude: float = None,
    longitude: float = None,
    hide_exact_address: bool = False,
    public_location_display: str = None,
) -> Dict[str, Any]:
    """Create a new Set House organization with location data."""
    import re
    import uuid

    # Generate slug from name
    base_slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    slug = base_slug

    # Check if slug exists and add suffix if needed
    existing = execute_single(
        "SELECT id FROM organizations WHERE slug = :slug",
        {"slug": slug}
    )
    if existing:
        slug = f"{base_slug}-{str(uuid.uuid4())[:8]}"

    # Create organization
    org = execute_insert(
        """
        INSERT INTO organizations (
            name, slug, org_type, description, website_url, created_by,
            address_line1, city, state, postal_code, country,
            latitude, longitude, location_geocoded_at
        )
        VALUES (
            :name, :slug, :org_type, :description, :website_url, :created_by,
            :address_line1, :city, :state, :postal_code, :country,
            :latitude, :longitude, :location_geocoded_at
        )
        RETURNING *
        """,
        {
            "name": name,
            "slug": slug,
            "org_type": org_type or "studio",
            "description": description,
            "website_url": website,
            "created_by": created_by,
            "address_line1": address_line1,
            "city": city,
            "state": state,
            "postal_code": postal_code,
            "country": country or "US",
            "latitude": latitude,
            "longitude": longitude,
            "location_geocoded_at": datetime.now(timezone.utc) if latitude else None,
        }
    )

    if org:
        # Create default Set House settings
        execute_update(
            """
            INSERT INTO set_house_organization_settings (organization_id)
            VALUES (:org_id)
            ON CONFLICT (organization_id) DO NOTHING
            """,
            {"org_id": org["id"]}
        )

        # Create marketplace settings with location data
        marketplace_location = f"{address_line1}, {city}, {state} {postal_code}" if address_line1 else f"{city}, {state}"
        execute_update(
            """
            INSERT INTO set_house_marketplace_settings (
                organization_id, marketplace_name, marketplace_location
            )
            VALUES (
                :org_id, :name, :marketplace_location
            )
            ON CONFLICT (organization_id) DO NOTHING
            """,
            {
                "org_id": org["id"],
                "name": name,
                "marketplace_location": marketplace_location,
            }
        )

        # Add creator as owner
        execute_update(
            """
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES (:org_id, :user_id, 'owner')
            ON CONFLICT (organization_id, user_id) DO NOTHING
            """,
            {"org_id": org["id"], "user_id": created_by}
        )

        # Initialize default categories
        _initialize_org_categories(str(org["id"]))

    return org


def _initialize_org_categories(org_id: str) -> None:
    """Initialize default Set House categories for an organization."""
    categories = [
        ("Sound Stages", "sound-stages", 1),
        ("Studios", "studios", 2),
        ("Locations", "locations", 3),
        ("Backlots", "backlots", 4),
        ("Green Screen", "green-screen", 5),
        ("Workshops", "workshops", 6),
        ("Production Offices", "production-offices", 7),
        ("Storage", "storage", 8),
        ("Other", "other", 99)
    ]

    for name, slug, sort_order in categories:
        execute_update(
            """
            INSERT INTO set_house_categories (organization_id, name, slug, sort_order)
            VALUES (:org_id, :name, :slug, :sort_order)
            ON CONFLICT (organization_id, slug) DO NOTHING
            """,
            {"org_id": org_id, "name": name, "slug": slug, "sort_order": sort_order}
        )


def get_organization_member(org_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get a user's membership in an organization."""
    return execute_single(
        """
        SELECT * FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
        """,
        {"org_id": org_id, "user_id": user_id}
    )


def check_org_permission(org_id: str, user_id: str, required_roles: List[str] = None) -> bool:
    """Check if user has access to organization with optional role requirement."""
    member = get_organization_member(org_id, user_id)
    if not member:
        return False

    status = member.get("status", "active")
    if status not in ("active", "accepted"):
        return False

    if required_roles:
        return member.get("role") in required_roles

    return True


# ============================================================================
# CATEGORY SERVICES
# ============================================================================

def list_categories(org_id: str) -> List[Dict[str, Any]]:
    """List space categories for an organization."""
    return execute_query(
        """
        SELECT * FROM set_house_categories
        WHERE organization_id = :org_id AND is_active = TRUE
        ORDER BY sort_order, name
        """,
        {"org_id": org_id}
    )


def create_category(
    org_id: str,
    name: str,
    slug: str = None,
    parent_id: str = None,
    icon: str = None,
    color: str = None,
    sort_order: int = 0
) -> Optional[Dict[str, Any]]:
    """Create a new space category."""
    import re
    if not slug:
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

    return execute_insert(
        """
        INSERT INTO set_house_categories (
            organization_id, name, slug, parent_id, icon, color, sort_order
        ) VALUES (
            :org_id, :name, :slug, :parent_id, :icon, :color, :sort_order
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "slug": slug,
            "parent_id": parent_id,
            "icon": icon,
            "color": color,
            "sort_order": sort_order
        }
    )


# ============================================================================
# LOCATION SERVICES
# ============================================================================

def list_locations(org_id: str) -> List[Dict[str, Any]]:
    """List storage/facility locations for an organization."""
    return execute_query(
        """
        SELECT * FROM set_house_locations
        WHERE organization_id = :org_id AND is_active = TRUE
        ORDER BY is_default DESC, name
        """,
        {"org_id": org_id}
    )


def create_location(
    org_id: str,
    name: str,
    location_type: str = "facility",
    address_line1: str = None,
    address_line2: str = None,
    city: str = None,
    state: str = None,
    postal_code: str = None,
    country: str = "US",
    contact_name: str = None,
    contact_phone: str = None,
    contact_email: str = None,
    is_default: bool = False,
    latitude: float = None,
    longitude: float = None,
) -> Optional[Dict[str, Any]]:
    """Create a new facility location."""
    return execute_insert(
        """
        INSERT INTO set_house_locations (
            organization_id, name, location_type,
            address_line1, address_line2, city, state, postal_code, country,
            contact_name, contact_phone, contact_email, is_default,
            latitude, longitude
        ) VALUES (
            :org_id, :name, :location_type,
            :address_line1, :address_line2, :city, :state, :postal_code, :country,
            :contact_name, :contact_phone, :contact_email, :is_default,
            :latitude, :longitude
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "location_type": location_type,
            "address_line1": address_line1,
            "address_line2": address_line2,
            "city": city,
            "state": state,
            "postal_code": postal_code,
            "country": country,
            "contact_name": contact_name,
            "contact_phone": contact_phone,
            "contact_email": contact_email,
            "is_default": is_default,
            "latitude": latitude,
            "longitude": longitude,
        }
    )


# ============================================================================
# SPACE SERVICES
# ============================================================================

def list_spaces(
    org_id: str,
    status: str = None,
    category_id: str = None,
    location_id: str = None,
    space_type: str = None,
    search: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List spaces with filtering."""
    conditions = ["s.organization_id = :org_id", "s.is_active = TRUE"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("s.status = :status")
        params["status"] = status

    if category_id:
        conditions.append("s.category_id = :category_id")
        params["category_id"] = category_id

    if location_id:
        conditions.append("s.location_id = :location_id")
        params["location_id"] = location_id

    if space_type:
        conditions.append("s.space_type = :space_type")
        params["space_type"] = space_type

    if search:
        conditions.append("""
            (s.name ILIKE :search OR s.internal_id ILIKE :search
             OR s.description ILIKE :search)
        """)
        params["search"] = f"%{search}%"

    where_clause = " AND ".join(conditions)

    # Get total count
    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_spaces s WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    # Get spaces with related data
    spaces = execute_query(
        f"""
        SELECT s.*, c.name as category_name, l.name as location_name,
               (SELECT image_url FROM set_house_space_images si
                WHERE si.space_id = s.id AND si.is_primary = TRUE
                LIMIT 1) as primary_image_url
        FROM set_house_spaces s
        LEFT JOIN set_house_categories c ON c.id = s.category_id
        LEFT JOIN set_house_locations l ON l.id = s.location_id
        WHERE {where_clause}
        ORDER BY s.name
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"spaces": spaces, "total": total}


def get_space(space_id: str) -> Optional[Dict[str, Any]]:
    """Get a single space with details."""
    return execute_single(
        """
        SELECT s.*, c.name as category_name, l.name as location_name
        FROM set_house_spaces s
        LEFT JOIN set_house_categories c ON c.id = s.category_id
        LEFT JOIN set_house_locations l ON l.id = s.location_id
        WHERE s.id = :space_id
        """,
        {"space_id": space_id}
    )


def create_space(
    org_id: str,
    name: str,
    created_by: str,
    space_type: str = "studio",
    description: str = None,
    category_id: str = None,
    location_id: str = None,
    square_footage: int = None,
    ceiling_height_feet: float = None,
    dimensions: str = None,
    max_occupancy: int = None,
    features: dict = None,
    amenities: list = None,
    hourly_rate: float = None,
    half_day_rate: float = None,
    daily_rate: float = None,
    weekly_rate: float = None,
    monthly_rate: float = None,
    insurance_required: bool = False,
    minimum_insurance_coverage: float = None,
    notes: str = None,
    access_instructions: str = None,
    parking_info: str = None,
    loading_dock_info: str = None,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a new space."""
    return execute_insert(
        """
        INSERT INTO set_house_spaces (
            organization_id, name, space_type, description, category_id, location_id,
            square_footage, ceiling_height_feet, dimensions, max_occupancy,
            features, amenities, hourly_rate, half_day_rate, daily_rate, weekly_rate, monthly_rate,
            insurance_required, minimum_insurance_coverage, notes,
            access_instructions, parking_info, loading_dock_info, created_by
        ) VALUES (
            :org_id, :name, :space_type, :description, :category_id, :location_id,
            :square_footage, :ceiling_height_feet, :dimensions, :max_occupancy,
            :features, :amenities, :hourly_rate, :half_day_rate, :daily_rate, :weekly_rate, :monthly_rate,
            :insurance_required, :minimum_insurance_coverage, :notes,
            :access_instructions, :parking_info, :loading_dock_info, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "space_type": space_type,
            "description": description,
            "category_id": category_id,
            "location_id": location_id,
            "square_footage": square_footage,
            "ceiling_height_feet": ceiling_height_feet,
            "dimensions": dimensions,
            "max_occupancy": max_occupancy,
            "features": json.dumps(features or {}),
            "amenities": json.dumps(amenities or []),
            "hourly_rate": hourly_rate,
            "half_day_rate": half_day_rate,
            "daily_rate": daily_rate,
            "weekly_rate": weekly_rate,
            "monthly_rate": monthly_rate,
            "insurance_required": insurance_required,
            "minimum_insurance_coverage": minimum_insurance_coverage,
            "notes": notes,
            "access_instructions": access_instructions,
            "parking_info": parking_info,
            "loading_dock_info": loading_dock_info,
            "created_by": created_by,
        }
    )


def update_space(space_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update a space."""
    allowed_fields = [
        "name", "space_type", "description", "category_id", "location_id",
        "square_footage", "ceiling_height_feet", "dimensions", "max_occupancy",
        "features", "amenities", "hourly_rate", "half_day_rate", "daily_rate",
        "weekly_rate", "monthly_rate", "insurance_required", "minimum_insurance_coverage",
        "current_condition", "condition_notes", "notes", "access_instructions",
        "parking_info", "loading_dock_info", "status"
    ]

    set_parts = []
    params = {"space_id": space_id}

    for field in allowed_fields:
        if field in updates:
            value = updates[field]
            if field in ("features", "amenities") and isinstance(value, (dict, list)):
                value = json.dumps(value)
            set_parts.append(f"{field} = :{field}")
            params[field] = value

    if not set_parts:
        return get_space(space_id)

    return execute_insert(
        f"""
        UPDATE set_house_spaces
        SET {", ".join(set_parts)}, updated_at = NOW()
        WHERE id = :space_id
        RETURNING *
        """,
        params
    )


def delete_space(space_id: str) -> bool:
    """Soft delete a space."""
    result = execute_update(
        """
        UPDATE set_house_spaces
        SET is_active = FALSE, updated_at = NOW()
        WHERE id = :space_id
        """,
        {"space_id": space_id}
    )
    return result is not None


# ============================================================================
# PACKAGE SERVICES
# ============================================================================

def list_package_templates(org_id: str) -> List[Dict[str, Any]]:
    """List package templates for an organization."""
    return execute_query(
        """
        SELECT pt.*, c.name as category_name,
               (SELECT COUNT(*) FROM set_house_package_template_items pti
                WHERE pti.template_id = pt.id) as item_count
        FROM set_house_package_templates pt
        LEFT JOIN set_house_categories c ON c.id = pt.category_id
        WHERE pt.organization_id = :org_id AND pt.is_active = TRUE
        ORDER BY pt.name
        """,
        {"org_id": org_id}
    )


def create_package_template(
    org_id: str,
    name: str,
    created_by: str,
    description: str = None,
    category_id: str = None,
    package_daily_rate: float = None,
    package_weekly_rate: float = None,
    discount_percent: float = 0,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a new package template."""
    return execute_insert(
        """
        INSERT INTO set_house_package_templates (
            organization_id, name, description, category_id,
            package_daily_rate, package_weekly_rate, discount_percent, created_by
        ) VALUES (
            :org_id, :name, :description, :category_id,
            :package_daily_rate, :package_weekly_rate, :discount_percent, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "description": description,
            "category_id": category_id,
            "package_daily_rate": package_daily_rate,
            "package_weekly_rate": package_weekly_rate,
            "discount_percent": discount_percent,
            "created_by": created_by,
        }
    )


# ============================================================================
# TRANSACTION SERVICES
# ============================================================================

def list_transactions(
    org_id: str,
    transaction_type: str = None,
    status: str = None,
    custodian_id: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List transactions with filtering."""
    conditions = ["t.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if transaction_type:
        conditions.append("t.transaction_type = :transaction_type")
        params["transaction_type"] = transaction_type

    if status:
        conditions.append("t.status = :status")
        params["status"] = status

    if custodian_id:
        conditions.append("t.primary_custodian_user_id = :custodian_id")
        params["custodian_id"] = custodian_id

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_transactions t WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    transactions = execute_query(
        f"""
        SELECT t.*, p.display_name as custodian_name
        FROM set_house_transactions t
        LEFT JOIN profiles p ON p.id = t.primary_custodian_user_id
        WHERE {where_clause}
        ORDER BY t.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"transactions": transactions, "total": total}


def create_transaction(
    org_id: str,
    transaction_type: str,
    initiated_by: str,
    primary_custodian_user_id: str = None,
    scheduled_start: datetime = None,
    scheduled_end: datetime = None,
    reference_number: str = None,
    notes: str = None,
    client_company_id: str = None,
    client_contact_id: str = None,
    client_name: str = None,
    client_email: str = None,
    client_phone: str = None,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a new transaction."""
    return execute_insert(
        """
        INSERT INTO set_house_transactions (
            organization_id, transaction_type, initiated_by_user_id,
            primary_custodian_user_id, scheduled_start, scheduled_end,
            reference_number, notes, client_company_id, client_contact_id,
            client_name, client_email, client_phone
        ) VALUES (
            :org_id, :transaction_type, :initiated_by,
            :primary_custodian_user_id, :scheduled_start, :scheduled_end,
            :reference_number, :notes, :client_company_id, :client_contact_id,
            :client_name, :client_email, :client_phone
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "transaction_type": transaction_type,
            "initiated_by": initiated_by,
            "primary_custodian_user_id": primary_custodian_user_id,
            "scheduled_start": scheduled_start,
            "scheduled_end": scheduled_end,
            "reference_number": reference_number,
            "notes": notes,
            "client_company_id": client_company_id,
            "client_contact_id": client_contact_id,
            "client_name": client_name,
            "client_email": client_email,
            "client_phone": client_phone,
        }
    )


# ============================================================================
# INCIDENT SERVICES
# ============================================================================

def list_incidents(
    org_id: str,
    status: str = None,
    incident_type: str = None,
    space_id: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List incidents with filtering."""
    conditions = ["i.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("i.status = :status")
        params["status"] = status

    if incident_type:
        conditions.append("i.incident_type = :incident_type")
        params["incident_type"] = incident_type

    if space_id:
        conditions.append("i.space_id = :space_id")
        params["space_id"] = space_id

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_incidents i WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    incidents = execute_query(
        f"""
        SELECT i.*, s.name as space_name, s.internal_id as space_internal_id,
               p.display_name as reported_by_name
        FROM set_house_incidents i
        LEFT JOIN set_house_spaces s ON s.id = i.space_id
        LEFT JOIN profiles p ON p.id = i.reported_by_user_id
        WHERE {where_clause}
        ORDER BY i.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"incidents": incidents, "total": total}


def create_incident(
    org_id: str,
    incident_type: str,
    reported_by: str,
    space_id: str = None,
    package_instance_id: str = None,
    transaction_id: str = None,
    damage_tier: str = None,
    damage_description: str = None,
    damage_location: str = None,
    photos: list = None,
    notes: str = None,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a new incident."""
    return execute_insert(
        """
        INSERT INTO set_house_incidents (
            organization_id, incident_type, reported_by_user_id,
            space_id, package_instance_id, transaction_id,
            damage_tier, damage_description, damage_location,
            photos, notes
        ) VALUES (
            :org_id, :incident_type, :reported_by,
            :space_id, :package_instance_id, :transaction_id,
            :damage_tier, :damage_description, :damage_location,
            :photos, :notes
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "incident_type": incident_type,
            "reported_by": reported_by,
            "space_id": space_id,
            "package_instance_id": package_instance_id,
            "transaction_id": transaction_id,
            "damage_tier": damage_tier,
            "damage_description": damage_description,
            "damage_location": damage_location,
            "photos": json.dumps(photos or []),
            "notes": notes,
        }
    )


# ============================================================================
# REPAIR SERVICES
# ============================================================================

def list_repairs(
    org_id: str,
    status: str = None,
    space_id: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List repair tickets with filtering."""
    conditions = ["r.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("r.status = :status")
        params["status"] = status

    if space_id:
        conditions.append("r.space_id = :space_id")
        params["space_id"] = space_id

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_repairs r WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    repairs = execute_query(
        f"""
        SELECT r.*, s.name as space_name, s.internal_id as space_internal_id,
               v.name as vendor_name
        FROM set_house_repairs r
        LEFT JOIN set_house_spaces s ON s.id = r.space_id
        LEFT JOIN set_house_vendors v ON v.id = r.vendor_id
        WHERE {where_clause}
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"repairs": repairs, "total": total}


def create_repair(
    org_id: str,
    space_id: str,
    title: str,
    created_by: str,
    incident_id: str = None,
    description: str = None,
    priority: str = "normal",
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a new repair ticket."""
    return execute_insert(
        """
        INSERT INTO set_house_repairs (
            organization_id, space_id, title, description, priority,
            incident_id, created_by_user_id
        ) VALUES (
            :org_id, :space_id, :title, :description, :priority,
            :incident_id, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "space_id": space_id,
            "title": title,
            "description": description,
            "priority": priority,
            "incident_id": incident_id,
            "created_by": created_by,
        }
    )


# ============================================================================
# STRIKE SERVICES
# ============================================================================

def list_strikes(
    org_id: str,
    user_id: str = None,
    is_active: bool = True,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List strikes with filtering."""
    conditions = ["s.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if user_id:
        conditions.append("s.user_id = :user_id")
        params["user_id"] = user_id

    if is_active is not None:
        conditions.append("s.is_active = :is_active")
        params["is_active"] = is_active

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_strikes s WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    strikes = execute_query(
        f"""
        SELECT s.*, p.display_name as user_name, p.avatar_url as user_avatar,
               ip.display_name as issued_by_name
        FROM set_house_strikes s
        LEFT JOIN profiles p ON p.id = s.user_id
        LEFT JOIN profiles ip ON ip.id = s.issued_by_user_id
        WHERE {where_clause}
        ORDER BY s.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"strikes": strikes, "total": total}


def create_strike(
    org_id: str,
    user_id: str,
    severity: str,
    reason: str,
    issued_by: str,
    incident_id: str = None,
    repair_id: str = None,
    transaction_id: str = None,
    points: int = 1,
    photos: list = None,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a new strike."""
    return execute_insert(
        """
        INSERT INTO set_house_strikes (
            organization_id, user_id, severity, reason, points,
            incident_id, repair_id, transaction_id,
            photos, issued_by_user_id
        ) VALUES (
            :org_id, :user_id, :severity, :reason, :points,
            :incident_id, :repair_id, :transaction_id,
            :photos, :issued_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "user_id": user_id,
            "severity": severity,
            "reason": reason,
            "points": points,
            "incident_id": incident_id,
            "repair_id": repair_id,
            "transaction_id": transaction_id,
            "photos": json.dumps(photos or []),
            "issued_by": issued_by,
        }
    )


# ============================================================================
# CLIENT SERVICES
# ============================================================================

def list_client_companies(org_id: str) -> List[Dict[str, Any]]:
    """List client companies for an organization."""
    return execute_query(
        """
        SELECT cc.*,
               (SELECT COUNT(*) FROM set_house_client_contacts c
                WHERE c.client_company_id = cc.id AND c.is_active = TRUE) as contact_count
        FROM set_house_client_companies cc
        WHERE cc.organization_id = :org_id AND cc.is_active = TRUE
        ORDER BY cc.name
        """,
        {"org_id": org_id}
    )


def list_client_contacts(org_id: str, company_id: str = None) -> List[Dict[str, Any]]:
    """List client contacts for an organization."""
    conditions = ["c.organization_id = :org_id", "c.is_active = TRUE"]
    params = {"org_id": org_id}

    if company_id:
        conditions.append("c.client_company_id = :company_id")
        params["company_id"] = company_id

    return execute_query(
        f"""
        SELECT c.*, cc.name as company_name, p.display_name as linked_user_name
        FROM set_house_client_contacts c
        LEFT JOIN set_house_client_companies cc ON cc.id = c.client_company_id
        LEFT JOIN profiles p ON p.id = c.linked_user_id
        WHERE {" AND ".join(conditions)}
        ORDER BY c.last_name, c.first_name
        """,
        params
    )


# ============================================================================
# MARKETPLACE SERVICES
# ============================================================================

def get_marketplace_settings(org_id: str) -> Optional[Dict[str, Any]]:
    """Get marketplace settings for an organization."""
    return execute_single(
        "SELECT * FROM set_house_marketplace_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )


def list_marketplace_listings(
    org_id: str = None,
    is_listed: bool = True,
    search: str = None,
    space_type: str = None,
    min_daily_rate: float = None,
    max_daily_rate: float = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List marketplace listings."""
    conditions = ["ml.is_listed = :is_listed"]
    params = {"is_listed": is_listed, "limit": limit, "offset": offset}

    if org_id:
        conditions.append("ml.organization_id = :org_id")
        params["org_id"] = org_id

    if search:
        conditions.append("""
            (s.name ILIKE :search OR s.description ILIKE :search)
        """)
        params["search"] = f"%{search}%"

    if space_type:
        conditions.append("s.space_type = :space_type")
        params["space_type"] = space_type

    if min_daily_rate:
        conditions.append("ml.daily_rate >= :min_daily_rate")
        params["min_daily_rate"] = min_daily_rate

    if max_daily_rate:
        conditions.append("ml.daily_rate <= :max_daily_rate")
        params["max_daily_rate"] = max_daily_rate

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"""
        SELECT COUNT(*) as total
        FROM set_house_marketplace_listings ml
        JOIN set_house_spaces s ON s.id = ml.space_id
        WHERE {where_clause}
        """,
        params
    )
    total = count_result["total"] if count_result else 0

    listings = execute_query(
        f"""
        SELECT ml.*, s.name as space_name, s.space_type, s.description,
               s.square_footage, s.features, s.amenities,
               o.name as organization_name,
               ms.marketplace_name, ms.is_verified,
               (SELECT image_url FROM set_house_space_images si
                WHERE si.space_id = s.id AND si.is_primary = TRUE
                LIMIT 1) as primary_image_url
        FROM set_house_marketplace_listings ml
        JOIN set_house_spaces s ON s.id = ml.space_id
        JOIN organizations o ON o.id = ml.organization_id
        LEFT JOIN set_house_marketplace_settings ms ON ms.organization_id = ml.organization_id
        WHERE {where_clause}
        ORDER BY ml.listed_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"listings": listings, "total": total}


def create_marketplace_listing(
    org_id: str,
    space_id: str,
    daily_rate: float,
    hourly_rate: float = None,
    half_day_rate: float = None,
    weekly_rate: float = None,
    monthly_rate: float = None,
    deposit_amount: float = None,
    deposit_percent: float = None,
    insurance_required: bool = False,
    min_booking_hours: int = 4,
    max_booking_days: int = None,
    advance_booking_days: int = 1,
    booking_notes: str = None,
    access_instructions: str = None,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a marketplace listing for a space."""
    return execute_insert(
        """
        INSERT INTO set_house_marketplace_listings (
            organization_id, space_id, daily_rate, hourly_rate, half_day_rate,
            weekly_rate, monthly_rate, deposit_amount, deposit_percent,
            insurance_required, min_booking_hours, max_booking_days,
            advance_booking_days, booking_notes, access_instructions
        ) VALUES (
            :org_id, :space_id, :daily_rate, :hourly_rate, :half_day_rate,
            :weekly_rate, :monthly_rate, :deposit_amount, :deposit_percent,
            :insurance_required, :min_booking_hours, :max_booking_days,
            :advance_booking_days, :booking_notes, :access_instructions
        )
        ON CONFLICT (space_id) DO UPDATE SET
            daily_rate = :daily_rate, hourly_rate = :hourly_rate,
            half_day_rate = :half_day_rate, weekly_rate = :weekly_rate,
            monthly_rate = :monthly_rate, deposit_amount = :deposit_amount,
            deposit_percent = :deposit_percent, insurance_required = :insurance_required,
            min_booking_hours = :min_booking_hours, max_booking_days = :max_booking_days,
            advance_booking_days = :advance_booking_days, booking_notes = :booking_notes,
            access_instructions = :access_instructions, updated_at = NOW()
        RETURNING *
        """,
        {
            "org_id": org_id,
            "space_id": space_id,
            "daily_rate": daily_rate,
            "hourly_rate": hourly_rate,
            "half_day_rate": half_day_rate,
            "weekly_rate": weekly_rate,
            "monthly_rate": monthly_rate,
            "deposit_amount": deposit_amount,
            "deposit_percent": deposit_percent,
            "insurance_required": insurance_required,
            "min_booking_hours": min_booking_hours,
            "max_booking_days": max_booking_days,
            "advance_booking_days": advance_booking_days,
            "booking_notes": booking_notes,
            "access_instructions": access_instructions,
        }
    )


# ============================================================================
# WORK ORDER SERVICES
# ============================================================================

def list_work_orders(
    org_id: str,
    status: str = None,
    assigned_to: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List work orders with filtering."""
    conditions = ["wo.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("wo.status = :status")
        params["status"] = status

    if assigned_to:
        conditions.append("wo.assigned_to = :assigned_to")
        params["assigned_to"] = assigned_to

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM set_house_work_orders wo WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    work_orders = execute_query(
        f"""
        SELECT wo.*, p.display_name as assigned_to_name,
               cp.display_name as custodian_name
        FROM set_house_work_orders wo
        LEFT JOIN profiles p ON p.id = wo.assigned_to
        LEFT JOIN profiles cp ON cp.id = wo.custodian_user_id
        WHERE {where_clause}
        ORDER BY wo.due_date ASC, wo.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"work_orders": work_orders, "total": total}


def create_work_order(
    org_id: str,
    title: str,
    created_by: str,
    notes: str = None,
    assigned_to: str = None,
    custodian_user_id: str = None,
    custodian_contact_id: str = None,
    backlot_project_id: str = None,
    due_date: date = None,
    booking_date: date = None,
    booking_start_time: str = None,
    booking_end_time: str = None,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Create a new work order."""
    return execute_insert(
        """
        INSERT INTO set_house_work_orders (
            organization_id, title, notes, created_by, assigned_to,
            custodian_user_id, custodian_contact_id, backlot_project_id,
            due_date, booking_date, booking_start_time, booking_end_time
        ) VALUES (
            :org_id, :title, :notes, :created_by, :assigned_to,
            :custodian_user_id, :custodian_contact_id, :backlot_project_id,
            :due_date, :booking_date, :booking_start_time, :booking_end_time
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "title": title,
            "notes": notes,
            "created_by": created_by,
            "assigned_to": assigned_to,
            "custodian_user_id": custodian_user_id,
            "custodian_contact_id": custodian_contact_id,
            "backlot_project_id": backlot_project_id,
            "due_date": due_date,
            "booking_date": booking_date,
            "booking_start_time": booking_start_time,
            "booking_end_time": booking_end_time,
        }
    )


# ============================================================================
# CART SERVICES
# ============================================================================

def get_cart_items(profile_id: str) -> List[Dict[str, Any]]:
    """Get cart items for a user."""
    return execute_query(
        """
        SELECT ci.*, ml.daily_rate, ml.hourly_rate, ml.half_day_rate,
               s.name as space_name, s.space_type,
               o.name as organization_name,
               (SELECT image_url FROM set_house_space_images si
                WHERE si.space_id = s.id AND si.is_primary = TRUE
                LIMIT 1) as primary_image_url
        FROM set_house_cart_items ci
        JOIN set_house_marketplace_listings ml ON ml.id = ci.listing_id
        JOIN set_house_spaces s ON s.id = ml.space_id
        JOIN organizations o ON o.id = ci.organization_id
        WHERE ci.profile_id = :profile_id
        ORDER BY ci.created_at DESC
        """,
        {"profile_id": profile_id}
    )


def add_to_cart(
    profile_id: str,
    listing_id: str,
    organization_id: str,
    backlot_project_id: str = None,
    booking_start_date: date = None,
    booking_end_date: date = None,
    booking_start_time: str = None,
    booking_end_time: str = None,
) -> Optional[Dict[str, Any]]:
    """Add an item to the cart."""
    return execute_insert(
        """
        INSERT INTO set_house_cart_items (
            profile_id, listing_id, organization_id, backlot_project_id,
            booking_start_date, booking_end_date, booking_start_time, booking_end_time
        ) VALUES (
            :profile_id, :listing_id, :organization_id, :backlot_project_id,
            :booking_start_date, :booking_end_date, :booking_start_time, :booking_end_time
        )
        ON CONFLICT (profile_id, listing_id) DO UPDATE SET
            booking_start_date = :booking_start_date,
            booking_end_date = :booking_end_date,
            booking_start_time = :booking_start_time,
            booking_end_time = :booking_end_time,
            updated_at = NOW()
        RETURNING *
        """,
        {
            "profile_id": profile_id,
            "listing_id": listing_id,
            "organization_id": organization_id,
            "backlot_project_id": backlot_project_id,
            "booking_start_date": booking_start_date,
            "booking_end_date": booking_end_date,
            "booking_start_time": booking_start_time,
            "booking_end_time": booking_end_time,
        }
    )


def remove_from_cart(profile_id: str, cart_item_id: str) -> bool:
    """Remove an item from the cart."""
    result = execute_update(
        """
        DELETE FROM set_house_cart_items
        WHERE id = :cart_item_id AND profile_id = :profile_id
        """,
        {"cart_item_id": cart_item_id, "profile_id": profile_id}
    )
    return result is not None


def clear_cart(profile_id: str) -> bool:
    """Clear all items from a user's cart."""
    result = execute_update(
        "DELETE FROM set_house_cart_items WHERE profile_id = :profile_id",
        {"profile_id": profile_id}
    )
    return result is not None
