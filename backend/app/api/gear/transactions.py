"""
Gear House Transactions API

Endpoints for managing gear transactions (checkout, checkin, transfers).
"""
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

from app.core.auth import get_current_user_from_token
from app.api.users import get_profile_id_from_cognito_id
from app.services import gear_service

router = APIRouter(prefix="/transactions", tags=["Gear Transactions"])


# ============================================================================
# SCHEMAS
# ============================================================================

class TransactionItemCreate(BaseModel):
    asset_id: Optional[str] = None
    kit_instance_id: Optional[str] = None
    quantity: int = 1
    notes: Optional[str] = None


class TransactionCreate(BaseModel):
    transaction_type: str
    items: List[TransactionItemCreate]
    counterparty_org_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    primary_custodian_user_id: Optional[str] = None
    destination_location_id: Optional[str] = None
    destination_address: Optional[dict] = None
    scheduled_at: Optional[datetime] = None
    expected_return_at: Optional[datetime] = None
    scan_mode_required: str = "case_plus_items"
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class ScanRecord(BaseModel):
    asset_id: str
    scan_type: str  # "out" or "in"
    condition: Optional[str] = None


class ConditionReportItem(BaseModel):
    asset_id: str
    condition_grade: str
    notes: Optional[str] = None
    has_cosmetic_damage: bool = False
    has_functional_damage: bool = False
    is_unsafe: bool = False
    photos: List[str] = []


class ConditionReportCreate(BaseModel):
    checkpoint_type: str  # checkout, checkin, handoff, on_demand
    overall_notes: Optional[str] = None
    scan_mode_used: Optional[str] = None
    photos_captured: bool = False
    items: List[ConditionReportItem] = []


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_profile_id(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    user = await get_current_user_from_token(authorization)
    profile_id = get_profile_id_from_cognito_id(user["sub"])
    return profile_id or user["sub"]


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# TRANSACTION ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_transactions(
    org_id: str,
    transaction_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    custodian_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    authorization: str = Header(None)
):
    """List transactions for an organization."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    result = gear_service.list_transactions(
        org_id,
        transaction_type=transaction_type,
        status=status,
        custodian_id=custodian_id,
        project_id=project_id,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_transaction(
    org_id: str,
    data: TransactionCreate,
    authorization: str = Header(None)
):
    """Create a new transaction."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    # Validate transaction type
    valid_types = [
        "internal_checkout", "internal_checkin", "transfer",
        "rental_reservation", "rental_pickup", "rental_return",
        "write_off", "maintenance_send", "maintenance_return",
        "inventory_adjustment", "initial_intake"
    ]
    if data.transaction_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid transaction type. Must be one of: {valid_types}")

    # Convert items to dicts
    items = [item.dict() for item in data.items]

    transaction = gear_service.create_transaction(
        org_id,
        data.transaction_type,
        profile_id,
        items,
        **data.dict(exclude={"transaction_type", "items"})
    )

    if not transaction:
        raise HTTPException(status_code=500, detail="Failed to create transaction")

    return {"transaction": transaction}


@router.get("/item/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    authorization: str = Header(None)
):
    """Get transaction details."""
    profile_id = await get_current_profile_id(authorization)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id)

    return {"transaction": tx}


@router.post("/item/{transaction_id}/scan")
async def record_scan(
    transaction_id: str,
    data: ScanRecord,
    authorization: str = Header(None)
):
    """Record a scan for a transaction item."""
    profile_id = await get_current_profile_id(authorization)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id)

    if data.scan_type not in ["out", "in"]:
        raise HTTPException(status_code=400, detail="scan_type must be 'out' or 'in'")

    result = gear_service.record_scan(
        transaction_id,
        data.asset_id,
        data.scan_type,
        profile_id,
        data.condition
    )

    return {"item": result}


@router.post("/item/{transaction_id}/complete-checkout")
async def complete_checkout(
    transaction_id: str,
    authorization: str = Header(None)
):
    """Complete a checkout transaction."""
    profile_id = await get_current_profile_id(authorization)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id, ["owner", "admin", "manager", "member"])

    result = gear_service.complete_checkout(transaction_id, profile_id)

    return {"transaction": result}


@router.post("/item/{transaction_id}/complete-checkin")
async def complete_checkin(
    transaction_id: str,
    authorization: str = Header(None)
):
    """Complete a checkin transaction."""
    profile_id = await get_current_profile_id(authorization)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id, ["owner", "admin", "manager", "member"])

    result = gear_service.complete_checkin(transaction_id, profile_id)

    return {"transaction": result}


@router.post("/item/{transaction_id}/condition-report")
async def create_condition_report(
    transaction_id: str,
    data: ConditionReportCreate,
    authorization: str = Header(None)
):
    """Create a condition report for a transaction."""
    profile_id = await get_current_profile_id(authorization)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id)

    items = [item.dict() for item in data.items]

    report = gear_service.create_condition_report(
        tx["organization_id"],
        profile_id,
        data.checkpoint_type,
        transaction_id=transaction_id,
        items=items,
        overall_notes=data.overall_notes,
        scan_mode_used=data.scan_mode_used,
        photos_captured=data.photos_captured
    )

    return {"report": report}


# ============================================================================
# QUICK CHECKOUT/CHECKIN ENDPOINTS
# ============================================================================

@router.post("/{org_id}/quick-checkout")
async def quick_checkout(
    org_id: str,
    asset_ids: List[str],
    custodian_user_id: str,
    project_id: Optional[str] = None,
    expected_return_at: Optional[datetime] = None,
    notes: Optional[str] = None,
    authorization: str = Header(None)
):
    """Quick checkout of assets to a custodian."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    items = [{"asset_id": aid} for aid in asset_ids]

    tx = gear_service.create_transaction(
        org_id,
        "internal_checkout",
        profile_id,
        items,
        primary_custodian_user_id=custodian_user_id,
        backlot_project_id=project_id,
        expected_return_at=expected_return_at,
        notes=notes
    )

    if tx:
        # Auto-complete simple checkouts
        tx = gear_service.complete_checkout(str(tx["id"]), profile_id)

    return {"transaction": tx}


@router.post("/{org_id}/quick-checkin")
async def quick_checkin(
    org_id: str,
    asset_ids: List[str],
    location_id: Optional[str] = None,
    notes: Optional[str] = None,
    authorization: str = Header(None)
):
    """Quick checkin of assets."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    items = [{"asset_id": aid} for aid in asset_ids]

    tx = gear_service.create_transaction(
        org_id,
        "internal_checkin",
        profile_id,
        items,
        destination_location_id=location_id,
        notes=notes
    )

    if tx:
        # Auto-complete simple checkins
        tx = gear_service.complete_checkin(str(tx["id"]), profile_id)

    return {"transaction": tx}


# ============================================================================
# MY TRANSACTIONS
# ============================================================================

@router.get("/{org_id}/my-checkouts")
async def my_checkouts(
    org_id: str,
    authorization: str = Header(None)
):
    """Get assets currently checked out to me."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query
    assets = execute_query(
        """
        SELECT a.*, c.name as category_name, t.expected_return_at
        FROM gear_assets a
        LEFT JOIN gear_categories c ON c.id = a.category_id
        LEFT JOIN gear_transaction_items ti ON ti.asset_id = a.id
        LEFT JOIN gear_transactions t ON t.id = ti.transaction_id
        WHERE a.organization_id = :org_id
          AND a.current_custodian_user_id = :user_id
          AND a.status = 'checked_out'
          AND a.is_active = TRUE
        ORDER BY a.name
        """,
        {"org_id": org_id, "user_id": profile_id}
    )

    return {"assets": assets}


@router.get("/{org_id}/overdue")
async def list_overdue(
    org_id: str,
    authorization: str = Header(None)
):
    """List overdue transactions."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query
    overdue = execute_query(
        """
        SELECT t.*, p.display_name as custodian_name, p.email as custodian_email,
               (SELECT COUNT(*) FROM gear_transaction_items WHERE transaction_id = t.id) as item_count
        FROM gear_transactions t
        LEFT JOIN profiles p ON p.id = t.primary_custodian_user_id
        WHERE t.organization_id = :org_id
          AND t.expected_return_at < NOW()
          AND t.returned_at IS NULL
          AND t.status != 'completed'
        ORDER BY t.expected_return_at ASC
        """,
        {"org_id": org_id}
    )

    return {"overdue": overdue}
