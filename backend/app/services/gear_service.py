"""
Gear House Service Layer

Comprehensive service module for the Gear House bounded context.
Handles assets, kits, transactions, conditions, incidents, repairs, and strikes.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from uuid import UUID
import json

from app.core.database import execute_query, execute_single, execute_insert
from app.core.logging import get_logger

logger = get_logger(__name__)


# ============================================================================
# ORGANIZATION SERVICES
# ============================================================================

def get_organization(org_id: str) -> Optional[Dict[str, Any]]:
    """Get organization by ID."""
    return execute_single(
        """
        SELECT o.*, gos.barcode_format, gos.qr_enabled, gos.label_prefix,
               gos.default_scan_mode, gos.require_photos_on_intake,
               gos.strikes_enabled, gos.strikes_before_escalation
        FROM organizations o
        LEFT JOIN gear_organization_settings gos ON gos.organization_id = o.id
        WHERE o.id = :org_id
        """,
        {"org_id": org_id}
    )


def get_user_organizations(user_id: str) -> List[Dict[str, Any]]:
    """Get all organizations a user belongs to."""
    return execute_query(
        """
        SELECT o.*, om.role, om.permissions, om.title, om.department
        FROM organizations o
        JOIN organization_members om ON om.organization_id = o.id
        WHERE om.user_id = :user_id AND om.is_active = TRUE
        ORDER BY o.name
        """,
        {"user_id": user_id}
    )


def create_organization(
    name: str,
    org_type: str,
    created_by: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a new organization."""
    org = execute_insert(
        """
        INSERT INTO organizations (name, org_type, created_by, email, phone, website,
                                   address_line1, city, state, postal_code, country)
        VALUES (:name, :org_type, :created_by, :email, :phone, :website,
                :address_line1, :city, :state, :postal_code, :country)
        RETURNING *
        """,
        {
            "name": name,
            "org_type": org_type,
            "created_by": created_by,
            "email": kwargs.get("email"),
            "phone": kwargs.get("phone"),
            "website": kwargs.get("website"),
            "address_line1": kwargs.get("address_line1"),
            "city": kwargs.get("city"),
            "state": kwargs.get("state"),
            "postal_code": kwargs.get("postal_code"),
            "country": kwargs.get("country", "US")
        }
    )

    if org:
        # Create default settings
        execute_insert(
            """
            INSERT INTO gear_organization_settings (organization_id)
            VALUES (:org_id)
            ON CONFLICT (organization_id) DO NOTHING
            """,
            {"org_id": org["id"]}
        )

        # Add creator as owner
        execute_insert(
            """
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES (:org_id, :user_id, 'owner')
            """,
            {"org_id": org["id"], "user_id": created_by}
        )

        # Initialize default categories
        _initialize_org_categories(str(org["id"]))

    return org


def _initialize_org_categories(org_id: str) -> None:
    """Initialize default gear categories for an organization."""
    categories = [
        ("Camera", "camera", 1),
        ("Lenses", "lenses", 2),
        ("Lighting", "lighting", 3),
        ("Grip", "grip", 4),
        ("Audio", "audio", 5),
        ("Monitors", "monitors", 6),
        ("Power & Batteries", "power-batteries", 7),
        ("Storage & Media", "storage-media", 8),
        ("Tripods & Stabilizers", "tripods-stabilizers", 9),
        ("Accessories", "accessories", 10),
        ("Expendables", "expendables", 11),
        ("Other", "other", 99)
    ]

    for name, slug, sort_order in categories:
        execute_insert(
            """
            INSERT INTO gear_categories (organization_id, name, slug, sort_order)
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
    if not member or not member.get("is_active"):
        return False

    if required_roles:
        return member.get("role") in required_roles

    return True


# ============================================================================
# ASSET SERVICES
# ============================================================================

def list_assets(
    org_id: str,
    status: str = None,
    category_id: str = None,
    custodian_id: str = None,
    location_id: str = None,
    search: str = None,
    asset_type: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List assets with filtering."""
    conditions = ["a.organization_id = :org_id", "a.is_active = TRUE"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("a.status = :status")
        params["status"] = status

    if category_id:
        conditions.append("a.category_id = :category_id")
        params["category_id"] = category_id

    if custodian_id:
        conditions.append("a.current_custodian_user_id = :custodian_id")
        params["custodian_id"] = custodian_id

    if location_id:
        conditions.append("a.current_location_id = :location_id")
        params["location_id"] = location_id

    if search:
        conditions.append("""
            (a.name ILIKE :search OR a.internal_id ILIKE :search
             OR a.make ILIKE :search OR a.model ILIKE :search
             OR a.manufacturer_serial ILIKE :search)
        """)
        params["search"] = f"%{search}%"

    if asset_type:
        conditions.append("a.asset_type = :asset_type")
        params["asset_type"] = asset_type

    where_clause = " AND ".join(conditions)

    # Get total count
    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM gear_assets a WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    # Get assets
    assets = execute_query(
        f"""
        SELECT a.*, c.name as category_name, c.slug as category_slug,
               l.name as location_name, p.display_name as custodian_name
        FROM gear_assets a
        LEFT JOIN gear_categories c ON c.id = a.category_id
        LEFT JOIN gear_locations l ON l.id = a.current_location_id
        LEFT JOIN profiles p ON p.id = a.current_custodian_user_id
        WHERE {where_clause}
        ORDER BY a.name
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"assets": assets, "total": total}


def get_asset(asset_id: str) -> Optional[Dict[str, Any]]:
    """Get single asset with full details."""
    return execute_single(
        """
        SELECT a.*, c.name as category_name, c.slug as category_slug,
               l.name as location_name, l.address_line1 as location_address,
               p.display_name as custodian_name, p.avatar_url as custodian_avatar,
               hl.name as home_location_name
        FROM gear_assets a
        LEFT JOIN gear_categories c ON c.id = a.category_id
        LEFT JOIN gear_locations l ON l.id = a.current_location_id
        LEFT JOIN gear_locations hl ON hl.id = a.default_home_location_id
        LEFT JOIN profiles p ON p.id = a.current_custodian_user_id
        WHERE a.id = :asset_id
        """,
        {"asset_id": asset_id}
    )


def get_asset_by_scan_code(org_id: str, scan_code: str) -> Optional[Dict[str, Any]]:
    """Find asset by barcode or QR code."""
    return execute_single(
        """
        SELECT * FROM gear_assets
        WHERE organization_id = :org_id
          AND (barcode = :code OR qr_code = :code OR primary_scan_code = :code)
          AND is_active = TRUE
        """,
        {"org_id": org_id, "code": scan_code}
    )


def create_asset(
    org_id: str,
    name: str,
    created_by: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a new asset."""
    asset = execute_insert(
        """
        INSERT INTO gear_assets (
            organization_id, name, asset_type, make, model, description,
            category_id, subcategory, manufacturer_serial, current_location_id,
            default_home_location_id, purchase_date, purchase_price,
            daily_rate, weekly_rate, notes, created_by
        ) VALUES (
            :org_id, :name, :asset_type, :make, :model, :description,
            :category_id, :subcategory, :manufacturer_serial, :location_id,
            :home_location_id, :purchase_date, :purchase_price,
            :daily_rate, :weekly_rate, :notes, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "asset_type": kwargs.get("asset_type", "serialized"),
            "make": kwargs.get("make"),
            "model": kwargs.get("model"),
            "description": kwargs.get("description"),
            "category_id": kwargs.get("category_id"),
            "subcategory": kwargs.get("subcategory"),
            "manufacturer_serial": kwargs.get("manufacturer_serial"),
            "location_id": kwargs.get("location_id"),
            "home_location_id": kwargs.get("home_location_id"),
            "purchase_date": kwargs.get("purchase_date"),
            "purchase_price": kwargs.get("purchase_price"),
            "daily_rate": kwargs.get("daily_rate"),
            "weekly_rate": kwargs.get("weekly_rate"),
            "notes": kwargs.get("notes"),
            "created_by": created_by
        }
    )

    if asset:
        # Log creation
        _log_audit(org_id, "create", "asset", str(asset["id"]), created_by, new_state=asset)

        # Generate barcode/QR
        _generate_asset_labels(str(asset["id"]), str(asset["internal_id"]))

    return asset


def update_asset(
    asset_id: str,
    user_id: str,
    **kwargs
) -> Optional[Dict[str, Any]]:
    """Update an asset."""
    # Get current state for audit
    current = get_asset(asset_id)
    if not current:
        return None

    # Build update query dynamically
    allowed_fields = [
        "name", "make", "model", "description", "category_id", "subcategory",
        "manufacturer_serial", "current_location_id", "default_home_location_id",
        "purchase_date", "purchase_price", "daily_rate", "weekly_rate",
        "current_value", "replacement_cost", "insurance_policy_id", "insured_value",
        "condition_notes", "notes", "tags"
    ]

    updates = []
    params = {"asset_id": asset_id}

    for field in allowed_fields:
        if field in kwargs:
            updates.append(f"{field} = :{field}")
            params[field] = kwargs[field]

    if not updates:
        return current

    updates.append("updated_at = NOW()")

    asset = execute_insert(
        f"""
        UPDATE gear_assets
        SET {', '.join(updates)}
        WHERE id = :asset_id
        RETURNING *
        """,
        params
    )

    if asset:
        _log_audit(
            current["organization_id"], "update", "asset", asset_id, user_id,
            previous_state=current, new_state=asset
        )

    return asset


def update_asset_status(
    asset_id: str,
    new_status: str,
    user_id: str,
    notes: str = None
) -> Optional[Dict[str, Any]]:
    """Update asset status with audit trail."""
    current = get_asset(asset_id)
    if not current:
        return None

    old_status = current.get("status")

    asset = execute_insert(
        """
        UPDATE gear_assets
        SET status = :status, updated_at = NOW()
        WHERE id = :asset_id
        RETURNING *
        """,
        {"asset_id": asset_id, "status": new_status}
    )

    if asset:
        _log_audit(
            current["organization_id"], "status_change", "asset", asset_id, user_id,
            changes={"old_status": old_status, "new_status": new_status, "notes": notes}
        )

    return asset


def _generate_asset_labels(asset_id: str, internal_id: str) -> None:
    """Generate barcode and QR code values for an asset."""
    # Simple implementation - actual barcode image generation happens in the label endpoint
    barcode_value = internal_id
    qr_value = f"GH:{internal_id}"

    execute_query(
        """
        UPDATE gear_assets
        SET barcode = :barcode, qr_code = :qr, primary_scan_code = :barcode
        WHERE id = :asset_id
        """,
        {"asset_id": asset_id, "barcode": barcode_value, "qr": qr_value}
    )


def get_asset_history(asset_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Get audit history for an asset."""
    return execute_query(
        """
        SELECT gal.*, p.display_name as user_name
        FROM gear_audit_log gal
        LEFT JOIN profiles p ON p.id = gal.user_id
        WHERE gal.entity_type = 'asset' AND gal.entity_id = :asset_id
        ORDER BY gal.created_at DESC
        LIMIT :limit
        """,
        {"asset_id": asset_id, "limit": limit}
    )


# ============================================================================
# KIT SERVICES
# ============================================================================

def list_kit_templates(org_id: str) -> List[Dict[str, Any]]:
    """List kit templates for an organization."""
    return execute_query(
        """
        SELECT kt.*, c.name as category_name,
               (SELECT COUNT(*) FROM gear_kit_template_items kti WHERE kti.template_id = kt.id) as item_count
        FROM gear_kit_templates kt
        LEFT JOIN gear_categories c ON c.id = kt.category_id
        WHERE kt.organization_id = :org_id AND kt.is_active = TRUE
        ORDER BY kt.name
        """,
        {"org_id": org_id}
    )


def get_kit_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Get kit template with items."""
    template = execute_single(
        """
        SELECT kt.*, c.name as category_name
        FROM gear_kit_templates kt
        LEFT JOIN gear_categories c ON c.id = kt.category_id
        WHERE kt.id = :template_id
        """,
        {"template_id": template_id}
    )

    if template:
        items = execute_query(
            """
            SELECT kti.*, a.name as asset_name, a.internal_id as asset_internal_id,
                   c.name as category_name, nkt.name as nested_template_name
            FROM gear_kit_template_items kti
            LEFT JOIN gear_assets a ON a.id = kti.asset_id
            LEFT JOIN gear_categories c ON c.id = kti.category_id
            LEFT JOIN gear_kit_templates nkt ON nkt.id = kti.nested_template_id
            WHERE kti.template_id = :template_id
            ORDER BY kti.sort_order
            """,
            {"template_id": template_id}
        )
        template["items"] = items

    return template


def create_kit_template(
    org_id: str,
    name: str,
    created_by: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a new kit template."""
    return execute_insert(
        """
        INSERT INTO gear_kit_templates (
            organization_id, name, description, category_id,
            scan_mode_required, allow_substitutions, created_by
        ) VALUES (
            :org_id, :name, :description, :category_id,
            :scan_mode, :allow_subs, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "description": kwargs.get("description"),
            "category_id": kwargs.get("category_id"),
            "scan_mode": kwargs.get("scan_mode_required", "case_plus_items"),
            "allow_subs": kwargs.get("allow_substitutions", True),
            "created_by": created_by
        }
    )


def add_kit_template_item(
    template_id: str,
    **kwargs
) -> Dict[str, Any]:
    """Add item to kit template."""
    return execute_insert(
        """
        INSERT INTO gear_kit_template_items (
            template_id, asset_id, category_id, item_description,
            quantity, is_required, notes, sort_order, nested_template_id
        ) VALUES (
            :template_id, :asset_id, :category_id, :description,
            :quantity, :is_required, :notes, :sort_order, :nested_template_id
        )
        RETURNING *
        """,
        {
            "template_id": template_id,
            "asset_id": kwargs.get("asset_id"),
            "category_id": kwargs.get("category_id"),
            "description": kwargs.get("item_description"),
            "quantity": kwargs.get("quantity", 1),
            "is_required": kwargs.get("is_required", True),
            "notes": kwargs.get("notes"),
            "sort_order": kwargs.get("sort_order", 0),
            "nested_template_id": kwargs.get("nested_template_id")
        }
    )


def list_kit_instances(
    org_id: str,
    status: str = None,
    location_id: str = None
) -> List[Dict[str, Any]]:
    """List kit instances."""
    conditions = ["ki.organization_id = :org_id", "ki.is_active = TRUE"]
    params = {"org_id": org_id}

    if status:
        conditions.append("ki.status = :status")
        params["status"] = status

    if location_id:
        conditions.append("ki.current_location_id = :location_id")
        params["location_id"] = location_id

    where_clause = " AND ".join(conditions)

    return execute_query(
        f"""
        SELECT ki.*, kt.name as template_name, l.name as location_name,
               p.display_name as custodian_name,
               (SELECT COUNT(*) FROM gear_kit_memberships km WHERE km.kit_instance_id = ki.id AND km.is_present = TRUE) as asset_count
        FROM gear_kit_instances ki
        LEFT JOIN gear_kit_templates kt ON kt.id = ki.template_id
        LEFT JOIN gear_locations l ON l.id = ki.current_location_id
        LEFT JOIN profiles p ON p.id = ki.current_custodian_user_id
        WHERE {where_clause}
        ORDER BY ki.name
        """,
        params
    )


def get_kit_instance(kit_id: str) -> Optional[Dict[str, Any]]:
    """Get kit instance with contents."""
    kit = execute_single(
        """
        SELECT ki.*, kt.name as template_name, l.name as location_name,
               p.display_name as custodian_name, ca.name as case_asset_name
        FROM gear_kit_instances ki
        LEFT JOIN gear_kit_templates kt ON kt.id = ki.template_id
        LEFT JOIN gear_locations l ON l.id = ki.current_location_id
        LEFT JOIN profiles p ON p.id = ki.current_custodian_user_id
        LEFT JOIN gear_assets ca ON ca.id = ki.case_asset_id
        WHERE ki.id = :kit_id
        """,
        {"kit_id": kit_id}
    )

    if kit:
        # Get current contents
        contents = execute_query(
            """
            SELECT km.*, a.name as asset_name, a.internal_id as asset_internal_id,
                   a.status as asset_status, a.make, a.model,
                   nki.name as nested_kit_name
            FROM gear_kit_memberships km
            LEFT JOIN gear_assets a ON a.id = km.asset_id
            LEFT JOIN gear_kit_instances nki ON nki.id = km.nested_kit_id
            WHERE km.kit_instance_id = :kit_id
            ORDER BY km.sort_order
            """,
            {"kit_id": kit_id}
        )
        kit["contents"] = contents

    return kit


def create_kit_instance(
    org_id: str,
    name: str,
    created_by: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a new kit instance."""
    return execute_insert(
        """
        INSERT INTO gear_kit_instances (
            organization_id, name, internal_id, template_id,
            case_asset_id, current_location_id, scan_mode_required,
            notes, created_by
        ) VALUES (
            :org_id, :name, :internal_id, :template_id,
            :case_asset_id, :location_id, :scan_mode,
            :notes, :created_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "internal_id": kwargs.get("internal_id", f"KIT-{datetime.now().strftime('%Y%m%d%H%M%S')}"),
            "template_id": kwargs.get("template_id"),
            "case_asset_id": kwargs.get("case_asset_id"),
            "location_id": kwargs.get("location_id"),
            "scan_mode": kwargs.get("scan_mode_required", "case_plus_items"),
            "notes": kwargs.get("notes"),
            "created_by": created_by
        }
    )


def add_asset_to_kit(
    kit_id: str,
    asset_id: str,
    added_by: str,
    slot_name: str = None,
    sort_order: int = 0
) -> Dict[str, Any]:
    """Add an asset to a kit instance."""
    return execute_insert(
        """
        INSERT INTO gear_kit_memberships (
            kit_instance_id, asset_id, slot_name, sort_order, added_by
        ) VALUES (
            :kit_id, :asset_id, :slot_name, :sort_order, :added_by
        )
        ON CONFLICT (kit_instance_id, asset_id) DO UPDATE
        SET is_present = TRUE, last_verified_at = NOW()
        RETURNING *
        """,
        {
            "kit_id": kit_id,
            "asset_id": asset_id,
            "slot_name": slot_name,
            "sort_order": sort_order,
            "added_by": added_by
        }
    )


def remove_asset_from_kit(kit_id: str, asset_id: str) -> bool:
    """Remove an asset from a kit instance."""
    result = execute_query(
        """
        UPDATE gear_kit_memberships
        SET is_present = FALSE
        WHERE kit_instance_id = :kit_id AND asset_id = :asset_id
        """,
        {"kit_id": kit_id, "asset_id": asset_id}
    )
    return True


# ============================================================================
# TRANSACTION SERVICES
# ============================================================================

def create_transaction(
    org_id: str,
    transaction_type: str,
    initiated_by: str,
    items: List[Dict[str, Any]],
    **kwargs
) -> Dict[str, Any]:
    """Create a new transaction with items."""
    transaction = execute_insert(
        """
        INSERT INTO gear_transactions (
            organization_id, transaction_type, counterparty_org_id,
            backlot_project_id, initiated_by_user_id, primary_custodian_user_id,
            destination_location_id, destination_address, scheduled_at,
            expected_return_at, scan_mode_required, reference_number, notes
        ) VALUES (
            :org_id, :tx_type, :counterparty_org_id,
            :project_id, :initiated_by, :custodian_id,
            :location_id, :destination_address, :scheduled_at,
            :expected_return_at, :scan_mode, :reference, :notes
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "tx_type": transaction_type,
            "counterparty_org_id": kwargs.get("counterparty_org_id"),
            "project_id": kwargs.get("backlot_project_id"),
            "initiated_by": initiated_by,
            "custodian_id": kwargs.get("primary_custodian_user_id"),
            "location_id": kwargs.get("destination_location_id"),
            "destination_address": json.dumps(kwargs.get("destination_address")) if kwargs.get("destination_address") else None,
            "scheduled_at": kwargs.get("scheduled_at"),
            "expected_return_at": kwargs.get("expected_return_at"),
            "scan_mode": kwargs.get("scan_mode_required", "case_plus_items"),
            "reference": kwargs.get("reference_number"),
            "notes": kwargs.get("notes")
        }
    )

    if transaction:
        # Add items
        for item in items:
            execute_insert(
                """
                INSERT INTO gear_transaction_items (
                    transaction_id, asset_id, kit_instance_id, quantity, notes
                ) VALUES (
                    :tx_id, :asset_id, :kit_id, :quantity, :notes
                )
                """,
                {
                    "tx_id": transaction["id"],
                    "asset_id": item.get("asset_id"),
                    "kit_id": item.get("kit_instance_id"),
                    "quantity": item.get("quantity", 1),
                    "notes": item.get("notes")
                }
            )

        _log_audit(org_id, "create", "transaction", str(transaction["id"]), initiated_by, new_state=transaction)

    return transaction


def get_transaction(transaction_id: str) -> Optional[Dict[str, Any]]:
    """Get transaction with items."""
    tx = execute_single(
        """
        SELECT t.*, o.name as org_name, co.name as counterparty_name,
               p.display_name as initiated_by_name,
               cp.display_name as custodian_name,
               l.name as destination_name
        FROM gear_transactions t
        LEFT JOIN organizations o ON o.id = t.organization_id
        LEFT JOIN organizations co ON co.id = t.counterparty_org_id
        LEFT JOIN profiles p ON p.id = t.initiated_by_user_id
        LEFT JOIN profiles cp ON cp.id = t.primary_custodian_user_id
        LEFT JOIN gear_locations l ON l.id = t.destination_location_id
        WHERE t.id = :tx_id
        """,
        {"tx_id": transaction_id}
    )

    if tx:
        items = execute_query(
            """
            SELECT ti.*, a.name as asset_name, a.internal_id as asset_internal_id,
                   ki.name as kit_name, ki.internal_id as kit_internal_id
            FROM gear_transaction_items ti
            LEFT JOIN gear_assets a ON a.id = ti.asset_id
            LEFT JOIN gear_kit_instances ki ON ki.id = ti.kit_instance_id
            WHERE ti.transaction_id = :tx_id
            ORDER BY ti.created_at
            """,
            {"tx_id": transaction_id}
        )
        tx["items"] = items

    return tx


def list_transactions(
    org_id: str,
    transaction_type: str = None,
    status: str = None,
    custodian_id: str = None,
    project_id: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List transactions with filtering."""
    conditions = ["t.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if transaction_type:
        conditions.append("t.transaction_type = :tx_type")
        params["tx_type"] = transaction_type

    if status:
        conditions.append("t.status = :status")
        params["status"] = status

    if custodian_id:
        conditions.append("t.primary_custodian_user_id = :custodian_id")
        params["custodian_id"] = custodian_id

    if project_id:
        conditions.append("t.backlot_project_id = :project_id")
        params["project_id"] = project_id

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM gear_transactions t WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    transactions = execute_query(
        f"""
        SELECT t.*, p.display_name as initiated_by_name,
               cp.display_name as custodian_name,
               (SELECT COUNT(*) FROM gear_transaction_items WHERE transaction_id = t.id) as item_count
        FROM gear_transactions t
        LEFT JOIN profiles p ON p.id = t.initiated_by_user_id
        LEFT JOIN profiles cp ON cp.id = t.primary_custodian_user_id
        WHERE {where_clause}
        ORDER BY t.initiated_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"transactions": transactions, "total": total}


def record_scan(
    transaction_id: str,
    asset_id: str,
    scan_type: str,  # "out" or "in"
    scanned_by: str,
    condition: str = None
) -> Dict[str, Any]:
    """Record a scan for a transaction item."""
    if scan_type == "out":
        update_fields = "scanned_out_at = NOW(), scanned_out_by = :user_id, condition_out = :condition"
    else:
        update_fields = "scanned_in_at = NOW(), scanned_in_by = :user_id, condition_in = :condition"

    return execute_insert(
        f"""
        UPDATE gear_transaction_items
        SET {update_fields}
        WHERE transaction_id = :tx_id AND asset_id = :asset_id
        RETURNING *
        """,
        {
            "tx_id": transaction_id,
            "asset_id": asset_id,
            "user_id": scanned_by,
            "condition": condition
        }
    )


def complete_checkout(transaction_id: str, user_id: str) -> Dict[str, Any]:
    """Complete a checkout transaction - update asset statuses."""
    tx = get_transaction(transaction_id)
    if not tx:
        return None

    # Update transaction
    execute_query(
        """
        UPDATE gear_transactions
        SET handed_off_at = NOW(), status = 'completed'
        WHERE id = :tx_id
        """,
        {"tx_id": transaction_id}
    )

    # Update asset statuses
    for item in tx.get("items", []):
        if item.get("asset_id"):
            execute_query(
                """
                UPDATE gear_assets
                SET status = 'checked_out',
                    current_custodian_user_id = :custodian_id,
                    updated_at = NOW()
                WHERE id = :asset_id
                """,
                {
                    "asset_id": item["asset_id"],
                    "custodian_id": tx.get("primary_custodian_user_id")
                }
            )

    _log_audit(tx["organization_id"], "checkout_complete", "transaction", transaction_id, user_id)

    return get_transaction(transaction_id)


def complete_checkin(transaction_id: str, user_id: str) -> Dict[str, Any]:
    """Complete a checkin transaction - update asset statuses."""
    tx = get_transaction(transaction_id)
    if not tx:
        return None

    # Update transaction
    execute_query(
        """
        UPDATE gear_transactions
        SET returned_at = NOW(), reconciled_at = NOW(), status = 'completed'
        WHERE id = :tx_id
        """,
        {"tx_id": transaction_id}
    )

    # Update asset statuses
    for item in tx.get("items", []):
        if item.get("asset_id"):
            execute_query(
                """
                UPDATE gear_assets
                SET status = 'available',
                    current_custodian_user_id = NULL,
                    current_location_id = COALESCE(default_home_location_id, current_location_id),
                    updated_at = NOW()
                WHERE id = :asset_id
                """,
                {"asset_id": item["asset_id"]}
            )

    _log_audit(tx["organization_id"], "checkin_complete", "transaction", transaction_id, user_id)

    return get_transaction(transaction_id)


# ============================================================================
# CONDITION REPORT SERVICES
# ============================================================================

def create_condition_report(
    org_id: str,
    reported_by: str,
    checkpoint_type: str,
    transaction_id: str = None,
    items: List[Dict[str, Any]] = None,
    **kwargs
) -> Dict[str, Any]:
    """Create a condition report."""
    report = execute_insert(
        """
        INSERT INTO gear_condition_reports (
            organization_id, transaction_id, checkpoint_type,
            reported_by_user_id, overall_notes, scan_mode_used, photos_captured
        ) VALUES (
            :org_id, :tx_id, :checkpoint,
            :user_id, :notes, :scan_mode, :photos
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "tx_id": transaction_id,
            "checkpoint": checkpoint_type,
            "user_id": reported_by,
            "notes": kwargs.get("overall_notes"),
            "scan_mode": kwargs.get("scan_mode_used"),
            "photos": kwargs.get("photos_captured", False)
        }
    )

    if report and items:
        for item in items:
            create_condition_report_item(str(report["id"]), **item)

    return report


def create_condition_report_item(
    report_id: str,
    asset_id: str,
    condition_grade: str,
    **kwargs
) -> Dict[str, Any]:
    """Add item to condition report."""
    item = execute_insert(
        """
        INSERT INTO gear_condition_report_items (
            report_id, asset_id, condition_grade, notes,
            has_cosmetic_damage, has_functional_damage, is_unsafe, photos
        ) VALUES (
            :report_id, :asset_id, :grade, :notes,
            :cosmetic, :functional, :unsafe, :photos
        )
        RETURNING *
        """,
        {
            "report_id": report_id,
            "asset_id": asset_id,
            "grade": condition_grade,
            "notes": kwargs.get("notes"),
            "cosmetic": kwargs.get("has_cosmetic_damage", False),
            "functional": kwargs.get("has_functional_damage", False),
            "unsafe": kwargs.get("is_unsafe", False),
            "photos": json.dumps(kwargs.get("photos", []))
        }
    )

    # Update asset condition
    execute_query(
        """
        UPDATE gear_assets
        SET current_condition = :grade, condition_notes = :notes, updated_at = NOW()
        WHERE id = :asset_id
        """,
        {"asset_id": asset_id, "grade": condition_grade, "notes": kwargs.get("notes")}
    )

    # Auto-create incident if damage reported
    if kwargs.get("has_functional_damage") or kwargs.get("is_unsafe"):
        asset = get_asset(asset_id)
        if asset:
            damage_tier = "unsafe" if kwargs.get("is_unsafe") else "functional"
            create_incident(
                asset["organization_id"],
                "damage",
                kwargs.get("reported_by") or "system",
                asset_id=asset_id,
                damage_tier=damage_tier,
                damage_description=kwargs.get("notes"),
                condition_report_id=report_id
            )

    return item


# ============================================================================
# INCIDENT SERVICES
# ============================================================================

def create_incident(
    org_id: str,
    incident_type: str,
    reported_by: str,
    **kwargs
) -> Dict[str, Any]:
    """Create an incident."""
    incident = execute_insert(
        """
        INSERT INTO gear_incidents (
            organization_id, incident_type, transaction_id, condition_report_id,
            asset_id, kit_instance_id, damage_tier, damage_description,
            last_seen_transaction_id, last_custodian_user_id, last_seen_at,
            reported_by_user_id, photos, notes
        ) VALUES (
            :org_id, :type, :tx_id, :report_id,
            :asset_id, :kit_id, :damage_tier, :damage_desc,
            :last_tx_id, :last_custodian, :last_seen,
            :reported_by, :photos, :notes
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "type": incident_type,
            "tx_id": kwargs.get("transaction_id"),
            "report_id": kwargs.get("condition_report_id"),
            "asset_id": kwargs.get("asset_id"),
            "kit_id": kwargs.get("kit_instance_id"),
            "damage_tier": kwargs.get("damage_tier"),
            "damage_desc": kwargs.get("damage_description"),
            "last_tx_id": kwargs.get("last_seen_transaction_id"),
            "last_custodian": kwargs.get("last_custodian_user_id"),
            "last_seen": kwargs.get("last_seen_at"),
            "reported_by": reported_by,
            "photos": json.dumps(kwargs.get("photos", [])),
            "notes": kwargs.get("notes")
        }
    )

    if incident:
        _log_audit(org_id, "create", "incident", str(incident["id"]), reported_by, new_state=incident)

        # Auto-create repair ticket for functional damage or worse
        damage_tier = kwargs.get("damage_tier")
        if incident_type == "damage" and damage_tier in ("functional", "unsafe", "out_of_service"):
            asset_id = kwargs.get("asset_id")
            if asset_id:
                create_repair_ticket(
                    org_id,
                    asset_id,
                    f"Repair needed: {damage_tier} damage",
                    reported_by,
                    incident_id=str(incident["id"]),
                    description=kwargs.get("damage_description"),
                    priority="high" if damage_tier in ("unsafe", "out_of_service") else "normal"
                )

        # Apply strike based on rules
        _apply_incident_strike(incident)

    return incident


def get_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    """Get incident with details."""
    return execute_single(
        """
        SELECT i.*, a.name as asset_name, a.internal_id as asset_internal_id,
               p.display_name as reported_by_name, ap.display_name as assigned_to_name,
               rp.display_name as resolved_by_name
        FROM gear_incidents i
        LEFT JOIN gear_assets a ON a.id = i.asset_id
        LEFT JOIN profiles p ON p.id = i.reported_by_user_id
        LEFT JOIN profiles ap ON ap.id = i.assigned_to_user_id
        LEFT JOIN profiles rp ON rp.id = i.resolved_by_user_id
        WHERE i.id = :incident_id
        """,
        {"incident_id": incident_id}
    )


def list_incidents(
    org_id: str,
    incident_type: str = None,
    status: str = None,
    asset_id: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List incidents."""
    conditions = ["i.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if incident_type:
        conditions.append("i.incident_type = :type")
        params["type"] = incident_type

    if status:
        conditions.append("i.status = :status")
        params["status"] = status

    if asset_id:
        conditions.append("i.asset_id = :asset_id")
        params["asset_id"] = asset_id

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM gear_incidents i WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    incidents = execute_query(
        f"""
        SELECT i.*, a.name as asset_name, p.display_name as reported_by_name
        FROM gear_incidents i
        LEFT JOIN gear_assets a ON a.id = i.asset_id
        LEFT JOIN profiles p ON p.id = i.reported_by_user_id
        WHERE {where_clause}
        ORDER BY i.reported_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"incidents": incidents, "total": total}


def resolve_incident(
    incident_id: str,
    resolved_by: str,
    resolution_notes: str = None
) -> Dict[str, Any]:
    """Resolve an incident."""
    incident = execute_insert(
        """
        UPDATE gear_incidents
        SET status = 'resolved', resolved_at = NOW(),
            resolved_by_user_id = :user_id, resolution_notes = :notes
        WHERE id = :incident_id
        RETURNING *
        """,
        {
            "incident_id": incident_id,
            "user_id": resolved_by,
            "notes": resolution_notes
        }
    )

    if incident:
        _log_audit(
            incident["organization_id"], "resolve", "incident", incident_id,
            resolved_by, changes={"resolution_notes": resolution_notes}
        )

    return incident


def _apply_incident_strike(incident: Dict[str, Any]) -> None:
    """Apply strike based on incident type and org rules."""
    org_id = incident["organization_id"]

    # Check if strikes enabled
    settings = execute_single(
        "SELECT * FROM gear_organization_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    if not settings or not settings.get("strikes_enabled"):
        return

    # Find matching rule
    rule = execute_single(
        """
        SELECT * FROM gear_strike_rules
        WHERE organization_id = :org_id
          AND trigger_type = :type
          AND (trigger_damage_tier IS NULL OR trigger_damage_tier = :damage_tier)
          AND is_active = TRUE
          AND is_auto_applied = TRUE
        ORDER BY trigger_damage_tier DESC NULLS LAST
        LIMIT 1
        """,
        {
            "org_id": org_id,
            "type": incident["incident_type"],
            "damage_tier": incident.get("damage_tier")
        }
    )

    if rule:
        # Determine who to strike (last custodian for missing, reporter context for damage)
        user_to_strike = incident.get("last_custodian_user_id")
        if not user_to_strike:
            # Try to find from transaction
            tx_id = incident.get("transaction_id")
            if tx_id:
                tx = get_transaction(tx_id)
                if tx:
                    user_to_strike = tx.get("primary_custodian_user_id")

        if user_to_strike:
            create_strike(
                org_id,
                user_to_strike,
                incident["reported_by_user_id"],
                rule["strike_severity"],
                f"Auto-strike for {incident['incident_type']}: {incident.get('damage_description') or 'See incident'}",
                incident_id=str(incident["id"]),
                rule_id=str(rule["id"]),
                points=rule["strike_points"],
                is_auto_applied=True
            )


# ============================================================================
# REPAIR TICKET SERVICES
# ============================================================================

def create_repair_ticket(
    org_id: str,
    asset_id: str,
    title: str,
    created_by: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a repair ticket."""
    ticket = execute_insert(
        """
        INSERT INTO gear_repair_tickets (
            organization_id, asset_id, incident_id, title, description,
            priority, vendor_id, created_by_user_id, assigned_to_user_id
        ) VALUES (
            :org_id, :asset_id, :incident_id, :title, :description,
            :priority, :vendor_id, :created_by, :assigned_to
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "asset_id": asset_id,
            "incident_id": kwargs.get("incident_id"),
            "title": title,
            "description": kwargs.get("description"),
            "priority": kwargs.get("priority", "normal"),
            "vendor_id": kwargs.get("vendor_id"),
            "created_by": created_by,
            "assigned_to": kwargs.get("assigned_to_user_id")
        }
    )

    if ticket:
        # Generate ticket number
        execute_query(
            """
            UPDATE gear_repair_tickets
            SET ticket_number = CONCAT('RPR-', LPAD(CAST(
                (SELECT COUNT(*) FROM gear_repair_tickets WHERE organization_id = :org_id) AS TEXT
            ), 6, '0'))
            WHERE id = :ticket_id
            """,
            {"org_id": org_id, "ticket_id": ticket["id"]}
        )

        # Update asset status
        update_asset_status(asset_id, "under_repair", created_by, f"Repair ticket created: {title}")

        _log_audit(org_id, "create", "repair_ticket", str(ticket["id"]), created_by, new_state=ticket)

    return ticket


def get_repair_ticket(ticket_id: str) -> Optional[Dict[str, Any]]:
    """Get repair ticket with details."""
    ticket = execute_single(
        """
        SELECT rt.*, a.name as asset_name, a.internal_id as asset_internal_id,
               v.name as vendor_name, p.display_name as created_by_name,
               ap.display_name as assigned_to_name
        FROM gear_repair_tickets rt
        LEFT JOIN gear_assets a ON a.id = rt.asset_id
        LEFT JOIN gear_vendors v ON v.id = rt.vendor_id
        LEFT JOIN profiles p ON p.id = rt.created_by_user_id
        LEFT JOIN profiles ap ON ap.id = rt.assigned_to_user_id
        WHERE rt.id = :ticket_id
        """,
        {"ticket_id": ticket_id}
    )

    if ticket:
        history = execute_query(
            """
            SELECT rth.*, p.display_name as changed_by_name
            FROM gear_repair_ticket_history rth
            LEFT JOIN profiles p ON p.id = rth.changed_by_user_id
            WHERE rth.ticket_id = :ticket_id
            ORDER BY rth.changed_at DESC
            """,
            {"ticket_id": ticket_id}
        )
        ticket["history"] = history

    return ticket


def list_repair_tickets(
    org_id: str,
    status: str = None,
    asset_id: str = None,
    assigned_to: str = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    """List repair tickets."""
    conditions = ["rt.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("rt.status = :status")
        params["status"] = status

    if asset_id:
        conditions.append("rt.asset_id = :asset_id")
        params["asset_id"] = asset_id

    if assigned_to:
        conditions.append("rt.assigned_to_user_id = :assigned_to")
        params["assigned_to"] = assigned_to

    where_clause = " AND ".join(conditions)

    count_result = execute_single(
        f"SELECT COUNT(*) as total FROM gear_repair_tickets rt WHERE {where_clause}",
        params
    )
    total = count_result["total"] if count_result else 0

    tickets = execute_query(
        f"""
        SELECT rt.*, a.name as asset_name, p.display_name as assigned_to_name
        FROM gear_repair_tickets rt
        LEFT JOIN gear_assets a ON a.id = rt.asset_id
        LEFT JOIN profiles p ON p.id = rt.assigned_to_user_id
        WHERE {where_clause}
        ORDER BY
            CASE rt.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'normal' THEN 3
                WHEN 'low' THEN 4
            END,
            rt.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"tickets": tickets, "total": total}


def update_repair_ticket_status(
    ticket_id: str,
    new_status: str,
    changed_by: str,
    notes: str = None,
    **kwargs
) -> Dict[str, Any]:
    """Update repair ticket status with history."""
    current = get_repair_ticket(ticket_id)
    if not current:
        return None

    old_status = current["status"]

    # Build updates
    updates = ["status = :status"]
    params = {"ticket_id": ticket_id, "status": new_status}

    # Handle status-specific updates
    if new_status == "diagnosing":
        updates.extend(["diagnosed_at = NOW()", "diagnosed_by_user_id = :user_id"])
        params["user_id"] = changed_by
        if kwargs.get("diagnosis"):
            updates.append("diagnosis = :diagnosis")
            params["diagnosis"] = kwargs["diagnosis"]

    elif new_status == "awaiting_approval" and kwargs.get("quote_amount"):
        updates.append("quote_amount = :quote")
        params["quote"] = kwargs["quote_amount"]

    elif new_status == "in_repair":
        if kwargs.get("quote_approved"):
            updates.extend(["quote_approved_at = NOW()", "quote_approved_by_user_id = :user_id"])
            params["user_id"] = changed_by

    elif new_status == "ready_for_qc":
        updates.append("actual_completion_date = CURRENT_DATE")

    elif new_status == "closed":
        updates.extend(["qc_passed = :qc_passed", "qc_at = NOW()", "qc_by_user_id = :user_id"])
        params["qc_passed"] = kwargs.get("qc_passed", True)
        params["user_id"] = changed_by
        if kwargs.get("qc_notes"):
            updates.append("qc_notes = :qc_notes")
            params["qc_notes"] = kwargs["qc_notes"]

        # Calculate downtime
        if current.get("created_at"):
            pass  # Trigger will handle via status change

    # Update costs if provided
    for cost_field in ["parts_cost", "labor_cost", "total_cost"]:
        if cost_field in kwargs:
            updates.append(f"{cost_field} = :{cost_field}")
            params[cost_field] = kwargs[cost_field]

    ticket = execute_insert(
        f"""
        UPDATE gear_repair_tickets
        SET {', '.join(updates)}, updated_at = NOW()
        WHERE id = :ticket_id
        RETURNING *
        """,
        params
    )

    if ticket:
        # Add history record
        execute_insert(
            """
            INSERT INTO gear_repair_ticket_history (
                ticket_id, previous_status, new_status, action, notes, changed_by_user_id
            ) VALUES (
                :ticket_id, :old_status, :new_status, 'status_change', :notes, :user_id
            )
            """,
            {
                "ticket_id": ticket_id,
                "old_status": old_status,
                "new_status": new_status,
                "notes": notes,
                "user_id": changed_by
            }
        )

    return ticket


# ============================================================================
# STRIKE SERVICES
# ============================================================================

def create_strike(
    org_id: str,
    user_id: str,
    issued_by: str,
    severity: str,
    reason: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a strike against a user."""
    strike = execute_insert(
        """
        INSERT INTO gear_strikes (
            organization_id, user_id, incident_id, repair_ticket_id,
            transaction_id, backlot_project_id, severity, points, reason,
            rule_id, is_auto_applied, photos, issued_by_user_id
        ) VALUES (
            :org_id, :user_id, :incident_id, :ticket_id,
            :tx_id, :project_id, :severity, :points, :reason,
            :rule_id, :is_auto, :photos, :issued_by
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "user_id": user_id,
            "incident_id": kwargs.get("incident_id"),
            "ticket_id": kwargs.get("repair_ticket_id"),
            "tx_id": kwargs.get("transaction_id"),
            "project_id": kwargs.get("backlot_project_id"),
            "severity": severity,
            "points": kwargs.get("points", 1),
            "reason": reason,
            "rule_id": kwargs.get("rule_id"),
            "is_auto": kwargs.get("is_auto_applied", False),
            "photos": json.dumps(kwargs.get("photos", [])),
            "issued_by": issued_by
        }
    )

    if strike:
        # Update escalation status
        _update_user_escalation_status(org_id, user_id)

        _log_audit(org_id, "create", "strike", str(strike["id"]), issued_by, new_state=strike)

    return strike


def get_user_strikes(
    org_id: str,
    user_id: str,
    active_only: bool = True
) -> List[Dict[str, Any]]:
    """Get strikes for a user."""
    conditions = ["s.organization_id = :org_id", "s.user_id = :user_id"]
    params = {"org_id": org_id, "user_id": user_id}

    if active_only:
        conditions.append("s.is_active = TRUE")
        conditions.append("(s.expires_at IS NULL OR s.expires_at > NOW())")

    where_clause = " AND ".join(conditions)

    return execute_query(
        f"""
        SELECT s.*, p.display_name as issued_by_name, i.incident_type
        FROM gear_strikes s
        LEFT JOIN profiles p ON p.id = s.issued_by_user_id
        LEFT JOIN gear_incidents i ON i.id = s.incident_id
        WHERE {where_clause}
        ORDER BY s.issued_at DESC
        """,
        params
    )


def get_user_escalation_status(org_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Get user's escalation status."""
    return execute_single(
        """
        SELECT ues.*, p.display_name as user_name
        FROM gear_user_escalation_status ues
        LEFT JOIN profiles p ON p.id = ues.user_id
        WHERE ues.organization_id = :org_id AND ues.user_id = :user_id
        """,
        {"org_id": org_id, "user_id": user_id}
    )


def _update_user_escalation_status(org_id: str, user_id: str) -> None:
    """Recalculate user's escalation status based on active strikes."""
    # Get org settings
    settings = execute_single(
        "SELECT * FROM gear_organization_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    threshold = settings.get("strikes_before_escalation", 3) if settings else 3

    # Count active strikes
    result = execute_single(
        """
        SELECT COUNT(*) as count, COALESCE(SUM(points), 0) as total_points
        FROM gear_strikes
        WHERE organization_id = :org_id
          AND user_id = :user_id
          AND is_active = TRUE
          AND (expires_at IS NULL OR expires_at > NOW())
        """,
        {"org_id": org_id, "user_id": user_id}
    )

    total_strikes = result["count"] if result else 0
    total_points = result["total_points"] if result else 0
    is_escalated = total_strikes >= threshold

    execute_insert(
        """
        INSERT INTO gear_user_escalation_status (
            organization_id, user_id, total_strikes, active_strike_points,
            is_escalated, escalated_at, requires_manager_review
        ) VALUES (
            :org_id, :user_id, :total, :points,
            :escalated, CASE WHEN :escalated THEN NOW() ELSE NULL END,
            :escalated
        )
        ON CONFLICT (organization_id, user_id) DO UPDATE SET
            total_strikes = :total,
            active_strike_points = :points,
            is_escalated = :escalated,
            escalated_at = CASE
                WHEN :escalated AND NOT gear_user_escalation_status.is_escalated THEN NOW()
                ELSE gear_user_escalation_status.escalated_at
            END,
            requires_manager_review = :escalated,
            updated_at = NOW()
        """,
        {
            "org_id": org_id,
            "user_id": user_id,
            "total": total_strikes,
            "points": total_points,
            "escalated": is_escalated
        }
    )


def void_strike(
    strike_id: str,
    voided_by: str,
    reason: str
) -> Dict[str, Any]:
    """Void a strike."""
    strike = execute_insert(
        """
        UPDATE gear_strikes
        SET is_active = FALSE, voided_at = NOW(),
            voided_by_user_id = :user_id, void_reason = :reason
        WHERE id = :strike_id
        RETURNING *
        """,
        {
            "strike_id": strike_id,
            "user_id": voided_by,
            "reason": reason
        }
    )

    if strike:
        # Recalculate escalation
        _update_user_escalation_status(strike["organization_id"], strike["user_id"])

        _log_audit(
            strike["organization_id"], "void", "strike", strike_id,
            voided_by, changes={"reason": reason}
        )

    return strike


# ============================================================================
# CATEGORY AND LOCATION SERVICES
# ============================================================================

def list_categories(org_id: str) -> List[Dict[str, Any]]:
    """List gear categories for an organization."""
    return execute_query(
        """
        SELECT gc.*, parent.name as parent_name
        FROM gear_categories gc
        LEFT JOIN gear_categories parent ON parent.id = gc.parent_id
        WHERE gc.organization_id = :org_id AND gc.is_active = TRUE
        ORDER BY gc.sort_order, gc.name
        """,
        {"org_id": org_id}
    )


def list_locations(org_id: str) -> List[Dict[str, Any]]:
    """List gear locations for an organization."""
    return execute_query(
        """
        SELECT * FROM gear_locations
        WHERE organization_id = :org_id AND is_active = TRUE
        ORDER BY is_default_home DESC, name
        """,
        {"org_id": org_id}
    )


def create_location(
    org_id: str,
    name: str,
    **kwargs
) -> Dict[str, Any]:
    """Create a gear location."""
    return execute_insert(
        """
        INSERT INTO gear_locations (
            organization_id, name, location_type,
            address_line1, address_line2, city, state, postal_code, country,
            contact_name, contact_phone, contact_email, is_default_home
        ) VALUES (
            :org_id, :name, :type,
            :addr1, :addr2, :city, :state, :postal, :country,
            :contact_name, :contact_phone, :contact_email, :is_default
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "name": name,
            "type": kwargs.get("location_type", "warehouse"),
            "addr1": kwargs.get("address_line1"),
            "addr2": kwargs.get("address_line2"),
            "city": kwargs.get("city"),
            "state": kwargs.get("state"),
            "postal": kwargs.get("postal_code"),
            "country": kwargs.get("country", "US"),
            "contact_name": kwargs.get("contact_name"),
            "contact_phone": kwargs.get("contact_phone"),
            "contact_email": kwargs.get("contact_email"),
            "is_default": kwargs.get("is_default_home", False)
        }
    )


# ============================================================================
# BACKLOT INTEGRATION SERVICES
# ============================================================================

def link_project_to_gear_order(
    project_id: str,
    gear_order_id: str,
    linked_by: str
) -> Dict[str, Any]:
    """Link a Backlot project to a Gear House order."""
    return execute_insert(
        """
        INSERT INTO backlot_project_gear_links (
            project_id, gear_order_id, link_type, linked_by
        ) VALUES (
            :project_id, :order_id, 'rental_order', :linked_by
        )
        ON CONFLICT DO NOTHING
        RETURNING *
        """,
        {
            "project_id": project_id,
            "order_id": gear_order_id,
            "linked_by": linked_by
        }
    )


def get_project_gear_links(project_id: str) -> List[Dict[str, Any]]:
    """Get all gear links for a Backlot project."""
    return execute_query(
        """
        SELECT pgl.*, gro.order_number, gro.status as order_status,
               gro.rental_start_date, gro.rental_end_date,
               o.name as rental_house_name
        FROM backlot_project_gear_links pgl
        LEFT JOIN gear_rental_orders gro ON gro.id = pgl.gear_order_id
        LEFT JOIN organizations o ON o.id = gro.rental_house_org_id
        WHERE pgl.project_id = :project_id AND pgl.is_active = TRUE
        ORDER BY pgl.linked_at DESC
        """,
        {"project_id": project_id}
    )


def get_project_gear_assets(project_id: str) -> List[Dict[str, Any]]:
    """Get all gear assets associated with a Backlot project (through transactions)."""
    return execute_query(
        """
        SELECT DISTINCT a.*, c.name as category_name,
               t.transaction_type, t.expected_return_at
        FROM gear_assets a
        JOIN gear_transaction_items ti ON ti.asset_id = a.id
        JOIN gear_transactions t ON t.id = ti.transaction_id
        LEFT JOIN gear_categories c ON c.id = a.category_id
        WHERE t.backlot_project_id = :project_id
        ORDER BY c.sort_order, a.name
        """,
        {"project_id": project_id}
    )


# ============================================================================
# AUDIT LOGGING
# ============================================================================

def _log_audit(
    org_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: str,
    previous_state: Dict = None,
    new_state: Dict = None,
    changes: Dict = None,
    transaction_id: str = None
) -> None:
    """Log an audit entry."""
    try:
        execute_insert(
            """
            INSERT INTO gear_audit_log (
                organization_id, action, entity_type, entity_id, user_id,
                previous_state, new_state, changes, transaction_id
            ) VALUES (
                :org_id, :action, :entity_type, :entity_id, :user_id,
                :previous, :new, :changes, :tx_id
            )
            """,
            {
                "org_id": org_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "user_id": user_id,
                "previous": json.dumps(previous_state) if previous_state else None,
                "new": json.dumps(new_state) if new_state else None,
                "changes": json.dumps(changes) if changes else None,
                "tx_id": transaction_id
            }
        )
    except Exception as e:
        logger.error(f"Failed to log audit entry: {e}")


def get_audit_log(
    org_id: str,
    entity_type: str = None,
    entity_id: str = None,
    user_id: str = None,
    limit: int = 100,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """Query audit log."""
    conditions = ["gal.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if entity_type:
        conditions.append("gal.entity_type = :entity_type")
        params["entity_type"] = entity_type

    if entity_id:
        conditions.append("gal.entity_id = :entity_id")
        params["entity_id"] = entity_id

    if user_id:
        conditions.append("gal.user_id = :user_id")
        params["user_id"] = user_id

    where_clause = " AND ".join(conditions)

    return execute_query(
        f"""
        SELECT gal.*, p.display_name as user_name
        FROM gear_audit_log gal
        LEFT JOIN profiles p ON p.id = gal.user_id
        WHERE {where_clause}
        ORDER BY gal.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )
