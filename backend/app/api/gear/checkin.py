"""
Gear House Check-in API

Endpoints for check-in workflow:
- Start check-in from transaction or by scanning asset
- Submit condition reports and damage documentation
- Complete check-in with late fee/partial return handling
- Generate receipts
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import gear_service

router = APIRouter(prefix="/checkin", tags=["Gear Check-in"])


# ============================================================================
# SCHEMAS
# ============================================================================

class ConditionReportItem(BaseModel):
    asset_id: str
    condition_grade: str  # good, fair, poor
    has_damage: bool = False
    damage_tier: Optional[str] = None  # cosmetic, functional, unsafe
    damage_description: Optional[str] = None
    damage_photo_keys: List[str] = []  # S3 keys for damage photos
    create_repair_ticket: bool = False  # User's choice to create repair ticket
    notes: Optional[str] = None


class DamageReportCreate(BaseModel):
    asset_id: str
    damage_tier: str  # cosmetic, functional, unsafe
    description: str
    photos: List[str] = []
    create_repair_ticket: bool = False  # User's choice to create repair ticket


class CheckinCompleteRequest(BaseModel):
    items_to_return: List[str]  # asset_ids being returned
    condition_reports: List[ConditionReportItem] = []
    checkin_location_id: Optional[str] = None
    notes: Optional[str] = None


class ScanStartRequest(BaseModel):
    barcode: str


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# MY CHECKOUTS - DETAILED VIEW
# ============================================================================

@router.get("/{org_id}/my-checkouts/detailed")
async def my_checkouts_detailed(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get user's active checkouts with full transaction details and overdue status."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    checkouts = gear_service.get_user_active_checkouts(org_id, profile_id)

    return {"checkouts": checkouts}


# ============================================================================
# START CHECK-IN
# ============================================================================

@router.post("/{org_id}/start/{transaction_id}")
async def start_checkin_from_transaction(
    org_id: str,
    transaction_id: str,
    user=Depends(get_current_user)
):
    """
    Start a check-in process for an existing transaction.

    Returns the transaction with all items, expected return info,
    late fee calculation, and org check-in settings.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Get transaction details
    tx = gear_service.get_transaction_for_checkin(org_id, transaction_id=transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found or not eligible for check-in")

    # Check permissions
    permission = gear_service.check_checkin_permission(org_id, profile_id, tx.get("primary_custodian_user_id"))
    if not permission.get("allowed"):
        raise HTTPException(status_code=403, detail=permission.get("reason", "Not authorized to process check-in"))

    # Calculate late fees
    late_info = gear_service.calculate_late_fees(org_id, transaction_id)

    # Get check-in settings
    settings = gear_service.get_checkin_settings(org_id)

    return {
        "transaction": tx,
        "late_info": late_info,
        "settings": settings,
        "can_checkin": True
    }


@router.post("/{org_id}/scan-start")
async def start_checkin_by_scan(
    org_id: str,
    data: ScanStartRequest,
    user=Depends(get_current_user)
):
    """
    Start a check-in by scanning an asset's barcode.

    Finds the active checkout transaction for the scanned asset
    and returns full check-in context.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Find transaction by asset barcode
    tx = gear_service.get_transaction_for_checkin(org_id, asset_barcode=data.barcode)
    if not tx:
        raise HTTPException(
            status_code=404,
            detail="No active checkout found for this asset. Asset may not be checked out."
        )

    # Check permissions
    permission = gear_service.check_checkin_permission(org_id, profile_id, tx.get("primary_custodian_user_id"))
    if not permission.get("allowed"):
        raise HTTPException(status_code=403, detail=permission.get("reason", "Not authorized to process check-in"))

    # Calculate late fees
    late_info = gear_service.calculate_late_fees(org_id, str(tx["id"]))

    # Get check-in settings
    settings = gear_service.get_checkin_settings(org_id)

    return {
        "transaction": tx,
        "late_info": late_info,
        "settings": settings,
        "can_checkin": True
    }


# ============================================================================
# DAMAGE REPORTING
# ============================================================================

@router.post("/{org_id}/{transaction_id}/damage")
async def report_damage(
    org_id: str,
    transaction_id: str,
    data: DamageReportCreate,
    user=Depends(get_current_user)
):
    """
    Report damage found during check-in.

    Creates an incident and, for functional/unsafe damage,
    creates a repair ticket and updates asset status.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Verify transaction exists and is valid
    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Transaction does not belong to this organization")

    # Validate damage tier
    if data.damage_tier not in ["cosmetic", "functional", "unsafe"]:
        raise HTTPException(status_code=400, detail="damage_tier must be 'cosmetic', 'functional', or 'unsafe'")

    result = gear_service.process_damage_on_checkin(
        org_id,
        data.asset_id,
        data.damage_tier,
        data.description,
        data.photos,
        profile_id,
        transaction_id,
        create_repair_ticket=data.create_repair_ticket
    )

    return result


# ============================================================================
# COMPLETE CHECK-IN
# ============================================================================

@router.post("/{org_id}/{transaction_id}/complete")
async def complete_checkin(
    org_id: str,
    transaction_id: str,
    data: CheckinCompleteRequest,
    user=Depends(get_current_user)
):
    """
    Complete the check-in process.

    - Updates asset statuses
    - Creates condition reports
    - Calculates and records late fees
    - Creates late incident if applicable
    - Handles partial returns
    - Updates transaction to completed
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Verify transaction
    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Transaction does not belong to this organization")

    # Check permissions
    permission = gear_service.check_checkin_permission(org_id, profile_id, tx.get("primary_custodian_user_id"))
    if not permission.get("allowed"):
        raise HTTPException(status_code=403, detail=permission.get("reason", "Not authorized to process check-in"))

    # Get settings to check partial return policy
    settings = gear_service.get_checkin_settings(org_id)

    # Get all items in this transaction
    from app.core.database import execute_query
    tx_items = execute_query(
        """
        SELECT asset_id FROM gear_transaction_items
        WHERE transaction_id = :tx_id
        """,
        {"tx_id": transaction_id}
    )
    all_asset_ids = [item["asset_id"] for item in tx_items if item["asset_id"]]

    # Check for partial return
    items_not_returned = [aid for aid in all_asset_ids if aid not in data.items_to_return]
    is_partial_return = len(items_not_returned) > 0

    if is_partial_return:
        policy = settings.get("partial_return_policy", "allow")
        if policy == "block":
            raise HTTPException(
                status_code=400,
                detail=f"Partial returns are not allowed. Missing items: {len(items_not_returned)}"
            )
        # 'warn' policy - continue but flag it

    # Convert condition reports to dicts
    condition_reports = [cr.model_dump() for cr in data.condition_reports]

    result = gear_service.complete_checkin_with_condition(
        org_id,
        transaction_id,
        profile_id,
        data.items_to_return,
        condition_reports,
        data.checkin_location_id,
        data.notes
    )

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# ============================================================================
# RECEIPT
# ============================================================================

@router.get("/{org_id}/{transaction_id}/receipt")
async def get_checkin_receipt(
    org_id: str,
    transaction_id: str,
    user=Depends(get_current_user)
):
    """
    Get receipt data for a completed check-in.

    Returns transaction details, items returned, condition info,
    late fees, and any damage/repair tickets created.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Get full transaction details
    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if tx["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Transaction does not belong to this organization")

    from app.core.database import execute_query

    # Get returned items with condition info
    items = execute_query(
        """
        SELECT
            ti.asset_id,
            a.name as asset_name,
            a.barcode,
            a.status as current_status,
            ti.scanned_in_at,
            cri.condition_grade,
            cri.has_cosmetic_damage,
            cri.has_functional_damage,
            cri.is_unsafe,
            cri.notes as condition_notes
        FROM gear_transaction_items ti
        JOIN gear_assets a ON a.id = ti.asset_id
        LEFT JOIN gear_condition_reports cr ON cr.transaction_id = ti.transaction_id
        LEFT JOIN gear_condition_report_items cri ON cri.report_id = cr.id AND cri.asset_id = ti.asset_id
        WHERE ti.transaction_id = :tx_id
        ORDER BY a.name
        """,
        {"tx_id": transaction_id}
    )

    # Get any incidents created during this check-in
    incidents = execute_query(
        """
        SELECT i.id, i.incident_type, i.damage_tier, i.damage_description, a.name as asset_name
        FROM gear_incidents i
        JOIN gear_assets a ON a.id = i.asset_id
        WHERE i.transaction_id = :tx_id
        ORDER BY i.created_at DESC
        """,
        {"tx_id": transaction_id}
    )

    # Get any repair tickets created (via incident linkage)
    repairs = execute_query(
        """
        SELECT r.id, r.status, r.priority, r.description, a.name as asset_name
        FROM gear_repair_tickets r
        JOIN gear_assets a ON a.id = r.asset_id
        JOIN gear_incidents i ON i.id = r.incident_id
        WHERE i.transaction_id = :tx_id
        ORDER BY r.created_at DESC
        """,
        {"tx_id": transaction_id}
    )

    # Get custodian info
    custodian_name = tx.get("primary_custodian_name") or tx.get("custodian_contact_name") or "Unknown"

    receipt = {
        "transaction_id": transaction_id,
        "transaction_type": tx.get("transaction_type"),
        "returned_at": tx.get("returned_at") or tx.get("completed_at"),
        "returned_by_id": tx.get("completed_by_user_id"),
        "custodian_name": custodian_name,
        "items": items,
        "total_items": len(items),
        "is_overdue": tx.get("is_overdue", False),
        "late_days": tx.get("late_days", 0),
        "late_fee_amount": float(tx.get("late_fee_amount", 0) or 0),
        "partial_return": tx.get("partial_return", False),
        "items_not_returned": tx.get("items_not_returned", 0),
        "incidents": incidents,
        "repairs": repairs,
        "notes": tx.get("notes"),
        "project_name": tx.get("project_name") or tx.get("backlot_project_name"),
        "organization_id": org_id
    }

    return {"receipt": receipt}


# ============================================================================
# CHECK-IN SETTINGS
# ============================================================================

@router.get("/{org_id}/settings")
async def get_org_checkin_settings(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get the organization's check-in settings."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    settings = gear_service.get_checkin_settings(org_id)

    return {"settings": settings}
