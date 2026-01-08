"""
Gear House Transactions API

Endpoints for managing gear transactions (checkout, checkin, transfers).
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user

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

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


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
    user=Depends(get_current_user)
):
    """List transactions for an organization."""
    profile_id = get_profile_id(user)
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
    user=Depends(get_current_user)
):
    """Create a new transaction."""
    profile_id = get_profile_id(user)
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
    items = [item.model_dump() for item in data.items]

    transaction = gear_service.create_transaction(
        org_id,
        data.transaction_type,
        profile_id,
        items,
        **data.model_dump(exclude={"transaction_type", "items"})
    )

    if not transaction:
        raise HTTPException(status_code=500, detail="Failed to create transaction")

    return {"transaction": transaction}


@router.get("/item/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    user=Depends(get_current_user)
):
    """Get transaction details."""
    profile_id = get_profile_id(user)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id)

    return {"transaction": tx}


@router.post("/item/{transaction_id}/scan")
async def record_scan(
    transaction_id: str,
    data: ScanRecord,
    user=Depends(get_current_user)
):
    """Record a scan for a transaction item."""
    profile_id = get_profile_id(user)

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
    user=Depends(get_current_user)
):
    """Complete a checkout transaction."""
    profile_id = get_profile_id(user)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id, ["owner", "admin", "manager", "member"])

    result = gear_service.complete_checkout(transaction_id, profile_id)

    return {"transaction": result}


@router.post("/item/{transaction_id}/complete-checkin")
async def complete_checkin(
    transaction_id: str,
    user=Depends(get_current_user)
):
    """Complete a checkin transaction."""
    profile_id = get_profile_id(user)

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
    user=Depends(get_current_user)
):
    """Create a condition report for a transaction."""
    profile_id = get_profile_id(user)

    tx = gear_service.get_transaction(transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    require_org_access(tx["organization_id"], profile_id)

    items = [item.model_dump() for item in data.items]

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

class QuickCheckoutRequest(BaseModel):
    asset_ids: List[str]
    custodian_user_id: Optional[str] = None
    custodian_contact_id: Optional[str] = None
    project_id: Optional[str] = None
    checkout_at: Optional[datetime] = None
    expected_return_at: Optional[datetime] = None
    destination_location_id: Optional[str] = None
    notes: Optional[str] = None


@router.post("/{org_id}/quick-checkout")
async def quick_checkout(
    org_id: str,
    data: QuickCheckoutRequest,
    user=Depends(get_current_user)
):
    """Quick checkout of assets to a custodian (member or external contact)."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    # Validate custodian - must have either user_id or contact_id
    if not data.custodian_user_id and not data.custodian_contact_id:
        raise HTTPException(status_code=400, detail="Either custodian_user_id or custodian_contact_id is required")

    items = [{"asset_id": aid} for aid in data.asset_ids]

    tx = gear_service.create_transaction(
        org_id,
        "internal_checkout",
        profile_id,
        items,
        primary_custodian_user_id=data.custodian_user_id,
        custodian_contact_id=data.custodian_contact_id,
        backlot_project_id=data.project_id,
        checkout_at=data.checkout_at,
        expected_return_at=data.expected_return_at,
        destination_location_id=data.destination_location_id,
        notes=data.notes
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
    user=Depends(get_current_user)
):
    """Quick checkin of assets."""
    profile_id = get_profile_id(user)
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
    user=Depends(get_current_user)
):
    """Get assets currently checked out to me."""
    profile_id = get_profile_id(user)
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
    user=Depends(get_current_user)
):
    """List overdue transactions."""
    profile_id = get_profile_id(user)
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
          AND t.status IN ('pending', 'in_progress', 'checked_out')
        ORDER BY t.expected_return_at ASC
        """,
        {"org_id": org_id}
    )

    return {"overdue": overdue}


# ============================================================================
# 5-TAB STRUCTURE ENDPOINTS
# ============================================================================

@router.get("/{org_id}/outgoing")
async def list_outgoing_transactions(
    org_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """
    List gear that our organization has rented/loaned out to others.
    This is for rental houses seeing what's currently out.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    transactions = execute_query(
        """
        SELECT
            t.*,
            renter_org.name as renter_org_name,
            p.display_name as custodian_name,
            p.email as custodian_email,
            ro.rental_start_date,
            ro.rental_end_date,
            ro.total_amount as rental_total,
            (SELECT COUNT(*) FROM gear_transaction_items WHERE transaction_id = t.id) as item_count,
            CASE WHEN t.expected_return_at < NOW() AND t.returned_at IS NULL THEN TRUE ELSE FALSE END as is_overdue
        FROM gear_transactions t
        LEFT JOIN organizations renter_org ON renter_org.id = t.renter_org_id
        LEFT JOIN profiles p ON p.id = t.primary_custodian_user_id
        LEFT JOIN gear_rental_orders ro ON ro.id = t.rental_order_id
        WHERE t.organization_id = :org_id
          AND t.status IN ('in_progress', 'pending', 'checked_out')
          AND t.transaction_type IN ('internal_checkout', 'rental_pickup')
          AND t.returned_at IS NULL
        ORDER BY t.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        {"org_id": org_id, "limit": limit, "offset": offset}
    )

    # Get total count
    from app.core.database import execute_single
    count_result = execute_single(
        """
        SELECT COUNT(*) as total
        FROM gear_transactions t
        WHERE t.organization_id = :org_id
          AND t.status IN ('in_progress', 'pending', 'checked_out')
          AND t.transaction_type IN ('internal_checkout', 'rental_pickup')
          AND t.returned_at IS NULL
        """,
        {"org_id": org_id}
    )

    return {
        "transactions": transactions,
        "total": count_result["total"] if count_result else 0
    }


@router.get("/{org_id}/incoming")
async def list_incoming_transactions(
    org_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """
    List gear that our organization is renting from others.
    This shows active rentals where we are the renter.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    transactions = execute_query(
        """
        SELECT
            t.*,
            rental_house_org.name as rental_house_name,
            ro.rental_start_date,
            ro.rental_end_date,
            ro.total_amount as rental_total,
            ro.order_number,
            bp.title as project_name,
            (SELECT COUNT(*) FROM gear_transaction_items WHERE transaction_id = t.id) as item_count,
            CASE WHEN ro.rental_end_date < CURRENT_DATE AND t.returned_at IS NULL THEN TRUE ELSE FALSE END as is_overdue
        FROM gear_transactions t
        JOIN gear_rental_orders ro ON ro.id = t.rental_order_id
        LEFT JOIN organizations rental_house_org ON rental_house_org.id = t.rental_house_org_id
        LEFT JOIN backlot_projects bp ON bp.id = t.backlot_project_id
        WHERE t.renter_org_id = :org_id
          AND t.is_marketplace_rental = TRUE
          AND t.status IN ('in_progress', 'pending', 'checked_out')
          AND t.returned_at IS NULL
        ORDER BY t.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        {"org_id": org_id, "limit": limit, "offset": offset}
    )

    # Get total count
    from app.core.database import execute_single
    count_result = execute_single(
        """
        SELECT COUNT(*) as total
        FROM gear_transactions t
        WHERE t.renter_org_id = :org_id
          AND t.is_marketplace_rental = TRUE
          AND t.status IN ('in_progress', 'pending', 'checked_out')
          AND t.returned_at IS NULL
        """,
        {"org_id": org_id}
    )

    return {
        "transactions": transactions,
        "total": count_result["total"] if count_result else 0
    }


@router.get("/{org_id}/requests")
async def list_requests(
    org_id: str,
    direction: Optional[str] = Query(None, description="incoming or outgoing"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """
    List pending rental requests, quotes, and extensions.
    - Incoming requests: requests from others to rent our gear
    - Outgoing requests: our requests to rent from others
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    # Get incoming quote requests (we are the rental house)
    incoming_quotes = []
    if direction in [None, "incoming"]:
        incoming_quotes = execute_query(
            """
            SELECT
                'incoming_quote' as request_type,
                rq.id,
                rq.request_number,
                rq.title,
                rq.status,
                rq.rental_start_date,
                rq.rental_end_date,
                rq.created_at,
                rq.requesting_org_id as counterparty_org_id,
                requesting_org.name as counterparty_name,
                requester.display_name as requester_name,
                (SELECT COUNT(*) FROM gear_rental_request_items WHERE request_id = rq.id) as item_count
            FROM gear_rental_requests rq
            JOIN organizations requesting_org ON requesting_org.id = rq.requesting_org_id
            LEFT JOIN profiles requester ON requester.id = rq.requested_by_user_id
            WHERE rq.rental_house_org_id = :org_id
              AND rq.status IN ('submitted', 'quoted')
            ORDER BY rq.created_at DESC
            LIMIT :limit
            """,
            {"org_id": org_id, "limit": limit}
        )

    # Get outgoing quote requests (we are requesting)
    outgoing_quotes = []
    if direction in [None, "outgoing"]:
        outgoing_quotes = execute_query(
            """
            SELECT
                'outgoing_quote' as request_type,
                rq.id,
                rq.request_number,
                rq.title,
                rq.status,
                rq.rental_start_date,
                rq.rental_end_date,
                rq.created_at,
                rq.rental_house_org_id as counterparty_org_id,
                rental_house.name as counterparty_name,
                q.total_amount as quoted_total,
                q.valid_until as quote_expires_at,
                (SELECT COUNT(*) FROM gear_rental_request_items WHERE request_id = rq.id) as item_count
            FROM gear_rental_requests rq
            JOIN organizations rental_house ON rental_house.id = rq.rental_house_org_id
            LEFT JOIN gear_rental_quotes q ON q.request_id = rq.id AND q.status = 'sent'
            WHERE rq.requesting_org_id = :org_id
              AND rq.status IN ('submitted', 'quoted')
            ORDER BY rq.created_at DESC
            LIMIT :limit
            """,
            {"org_id": org_id, "limit": limit}
        )

    # Get pending extensions (both as renter and rental house)
    extensions = execute_query(
        """
        SELECT
            'extension' as request_type,
            e.id,
            e.status,
            e.extension_type,
            e.original_end_date,
            e.requested_end_date,
            e.additional_days,
            e.additional_amount,
            e.requested_at as created_at,
            e.reason,
            t.organization_id as rental_house_org_id,
            t.renter_org_id,
            CASE
                WHEN t.organization_id = :org_id THEN 'incoming'
                ELSE 'outgoing'
            END as direction,
            requester.display_name as requester_name
        FROM gear_rental_extensions e
        JOIN gear_transactions t ON t.id = e.transaction_id
        LEFT JOIN profiles requester ON requester.id = e.requested_by
        WHERE e.status = 'pending'
          AND (t.organization_id = :org_id OR t.renter_org_id = :org_id)
        ORDER BY e.requested_at DESC
        LIMIT :limit
        """,
        {"org_id": org_id, "limit": limit}
    )

    return {
        "incoming_quotes": incoming_quotes,
        "outgoing_quotes": outgoing_quotes,
        "extensions": extensions,
        "totals": {
            "incoming_quotes": len(incoming_quotes),
            "outgoing_quotes": len(outgoing_quotes),
            "extensions": len(extensions)
        }
    }


@router.get("/{org_id}/history")
async def list_history(
    org_id: str,
    transaction_type: Optional[str] = Query(None),
    as_renter: Optional[bool] = Query(None, description="True for rentals where we were renter"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """
    List completed/historical transactions.
    Shows rentals that have been returned and completed.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_query

    conditions = ["t.status = 'completed'"]
    params: Dict[str, Any] = {"org_id": org_id, "limit": limit, "offset": offset}

    if as_renter is True:
        # Rentals where we were the renter
        conditions.append("t.renter_org_id = :org_id")
    elif as_renter is False:
        # Rentals where we were the rental house
        conditions.append("t.organization_id = :org_id AND t.renter_org_id IS NOT NULL")
    else:
        # All our transactions
        conditions.append("(t.organization_id = :org_id OR t.renter_org_id = :org_id)")

    if transaction_type:
        conditions.append("t.transaction_type = :transaction_type")
        params["transaction_type"] = transaction_type

    where_clause = " AND ".join(conditions)

    transactions = execute_query(
        f"""
        SELECT
            t.*,
            renter_org.name as renter_org_name,
            rental_house_org.name as rental_house_org_name,
            p.display_name as custodian_name,
            ro.rental_start_date,
            ro.rental_end_date,
            ro.total_amount as rental_total,
            bp.title as project_name,
            (SELECT COUNT(*) FROM gear_transaction_items WHERE transaction_id = t.id) as item_count
        FROM gear_transactions t
        LEFT JOIN organizations renter_org ON renter_org.id = t.renter_org_id
        LEFT JOIN organizations rental_house_org ON rental_house_org.id = t.rental_house_org_id
        LEFT JOIN profiles p ON p.id = t.primary_custodian_user_id
        LEFT JOIN gear_rental_orders ro ON ro.id = t.rental_order_id
        LEFT JOIN backlot_projects bp ON bp.id = t.backlot_project_id
        WHERE {where_clause}
        ORDER BY t.returned_at DESC NULLS LAST, t.updated_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    # Get total count
    from app.core.database import execute_single
    count_result = execute_single(
        f"""
        SELECT COUNT(*) as total
        FROM gear_transactions t
        WHERE {where_clause}
        """,
        params
    )

    return {
        "transactions": transactions,
        "total": count_result["total"] if count_result else 0
    }
