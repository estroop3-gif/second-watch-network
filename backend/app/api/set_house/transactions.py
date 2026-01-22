"""
Set House Transactions API

Endpoints for managing bookings and transactions.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/transactions", tags=["Set House Transactions"])


# ============================================================================
# SCHEMAS
# ============================================================================

class TransactionCreate(BaseModel):
    transaction_type: str
    space_ids: Optional[List[str]] = None
    primary_custodian_user_id: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    rental_start_date: Optional[str] = None
    rental_end_date: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    # Client fields - prefer linking to client database
    client_company_id: Optional[str] = None
    client_contact_id: Optional[str] = None
    # Legacy free-form fields (for quick entry without client record)
    client_name: Optional[str] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None


class TransactionUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None


class TransactionItemAdd(BaseModel):
    space_id: Optional[str] = None
    package_instance_id: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not set_house_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


# ============================================================================
# TRANSACTION ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_transactions(
    org_id: str,
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    custodian_id: Optional[str] = Query(None, description="Filter by custodian"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List transactions for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = set_house_service.list_transactions(
        org_id,
        transaction_type=transaction_type,
        status=status,
        custodian_id=custodian_id,
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
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Convert rental dates to scheduled dates if provided
    scheduled_start = data.scheduled_start
    scheduled_end = data.scheduled_end
    if data.rental_start_date:
        from datetime import datetime as dt
        scheduled_start = dt.fromisoformat(data.rental_start_date)
    if data.rental_end_date:
        from datetime import datetime as dt
        scheduled_end = dt.fromisoformat(data.rental_end_date)

    transaction = set_house_service.create_transaction(
        org_id,
        data.transaction_type,
        profile_id,
        primary_custodian_user_id=data.primary_custodian_user_id,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        reference_number=data.reference_number,
        notes=data.notes,
        client_company_id=data.client_company_id,
        client_contact_id=data.client_contact_id,
        client_name=data.client_name,
        client_email=data.client_email,
        client_phone=data.client_phone,
    )

    if not transaction:
        raise HTTPException(status_code=500, detail="Failed to create transaction")

    # Add spaces to the transaction if provided
    if data.space_ids:
        from app.core.database import execute_insert
        for space_id in data.space_ids:
            execute_insert(
                """
                INSERT INTO set_house_transaction_items (
                    transaction_id, space_id
                ) VALUES (
                    :transaction_id, :space_id
                )
                RETURNING *
                """,
                {"transaction_id": transaction["id"], "space_id": space_id}
            )

    return {"transaction": transaction}


@router.get("/{org_id}/{transaction_id}")
async def get_transaction(
    org_id: str,
    transaction_id: str,
    user=Depends(get_current_user)
):
    """Get a single transaction with items."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    transaction = execute_single(
        """
        SELECT t.*, p.display_name as custodian_name, ip.display_name as initiated_by_name
        FROM set_house_transactions t
        LEFT JOIN profiles p ON p.id = t.primary_custodian_user_id
        LEFT JOIN profiles ip ON ip.id = t.initiated_by_user_id
        WHERE t.id = :transaction_id AND t.organization_id = :org_id
        """,
        {"transaction_id": transaction_id, "org_id": org_id}
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    items = execute_query(
        """
        SELECT ti.*, s.name as space_name, s.internal_id as space_internal_id,
               pi.name as package_name
        FROM set_house_transaction_items ti
        LEFT JOIN set_house_spaces s ON s.id = ti.space_id
        LEFT JOIN set_house_package_instances pi ON pi.id = ti.package_instance_id
        WHERE ti.transaction_id = :transaction_id
        """,
        {"transaction_id": transaction_id}
    )

    transaction["items"] = items
    return {"transaction": transaction}


@router.put("/{org_id}/{transaction_id}")
async def update_transaction(
    org_id: str,
    transaction_id: str,
    data: TransactionUpdate,
    user=Depends(get_current_user)
):
    """Update a transaction."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "transaction_id": transaction_id, "org_id": org_id}

    transaction = execute_insert(
        f"""
        UPDATE set_house_transactions
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :transaction_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {"transaction": transaction}


@router.post("/{org_id}/{transaction_id}/items")
async def add_transaction_item(
    org_id: str,
    transaction_id: str,
    data: TransactionItemAdd,
    user=Depends(get_current_user)
):
    """Add an item to a transaction."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    item = execute_insert(
        """
        INSERT INTO set_house_transaction_items (
            transaction_id, space_id, package_instance_id, notes
        ) VALUES (
            :transaction_id, :space_id, :package_instance_id, :notes
        )
        RETURNING *
        """,
        {
            "transaction_id": transaction_id,
            "space_id": data.space_id,
            "package_instance_id": data.package_instance_id,
            "notes": data.notes
        }
    )

    return {"item": item}


@router.delete("/{org_id}/{transaction_id}/items/{item_id}")
async def remove_transaction_item(
    org_id: str,
    transaction_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from a transaction."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_update

    execute_update(
        "DELETE FROM set_house_transaction_items WHERE id = :item_id AND transaction_id = :transaction_id",
        {"item_id": item_id, "transaction_id": transaction_id}
    )

    return {"success": True}


# ============================================================================
# QUICK BOOKING ENDPOINTS
# ============================================================================

@router.post("/{org_id}/quick-booking")
async def quick_booking(
    org_id: str,
    space_ids: List[str],
    custodian_user_id: str,
    scheduled_start: datetime,
    scheduled_end: datetime,
    notes: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Quick booking - create transaction with multiple spaces."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    # Create transaction
    transaction = execute_insert(
        """
        INSERT INTO set_house_transactions (
            organization_id, transaction_type, initiated_by_user_id,
            primary_custodian_user_id, scheduled_start, scheduled_end, notes, status
        ) VALUES (
            :org_id, 'booking_confirmed', :initiated_by,
            :custodian_user_id, :scheduled_start, :scheduled_end, :notes, 'confirmed'
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "initiated_by": profile_id,
            "custodian_user_id": custodian_user_id,
            "scheduled_start": scheduled_start,
            "scheduled_end": scheduled_end,
            "notes": notes
        }
    )

    if not transaction:
        raise HTTPException(status_code=500, detail="Failed to create booking")

    # Add spaces as transaction items
    items = []
    for space_id in space_ids:
        item = execute_insert(
            """
            INSERT INTO set_house_transaction_items (transaction_id, space_id)
            VALUES (:transaction_id, :space_id)
            RETURNING *
            """,
            {"transaction_id": transaction["id"], "space_id": space_id}
        )
        if item:
            items.append(item)

        # Update space status to reserved
        execute_insert(
            """
            UPDATE set_house_spaces SET status = 'reserved', updated_at = NOW()
            WHERE id = :space_id
            """,
            {"space_id": space_id}
        )

    transaction["items"] = items
    return {"transaction": transaction}


@router.post("/{org_id}/quick-checkout")
async def quick_checkout(
    org_id: str,
    transaction_id: str,
    user=Depends(get_current_user)
):
    """Quick checkout - mark booking as started."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert, execute_query

    transaction = execute_insert(
        """
        UPDATE set_house_transactions
        SET status = 'in_use', started_at = NOW(), actual_start = NOW(), updated_at = NOW()
        WHERE id = :transaction_id AND organization_id = :org_id
        RETURNING *
        """,
        {"transaction_id": transaction_id, "org_id": org_id}
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Update spaces to booked status
    items = execute_query(
        "SELECT space_id FROM set_house_transaction_items WHERE transaction_id = :transaction_id AND space_id IS NOT NULL",
        {"transaction_id": transaction_id}
    )

    for item in items:
        execute_insert(
            "UPDATE set_house_spaces SET status = 'booked', updated_at = NOW() WHERE id = :space_id",
            {"space_id": item["space_id"]}
        )

    return {"transaction": transaction}


@router.post("/{org_id}/quick-checkin")
async def quick_checkin(
    org_id: str,
    transaction_id: str,
    user=Depends(get_current_user)
):
    """Quick checkin - mark booking as completed."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert, execute_query

    transaction = execute_insert(
        """
        UPDATE set_house_transactions
        SET status = 'completed', ended_at = NOW(), actual_end = NOW(), updated_at = NOW()
        WHERE id = :transaction_id AND organization_id = :org_id
        RETURNING *
        """,
        {"transaction_id": transaction_id, "org_id": org_id}
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Update spaces back to available
    items = execute_query(
        "SELECT space_id FROM set_house_transaction_items WHERE transaction_id = :transaction_id AND space_id IS NOT NULL",
        {"transaction_id": transaction_id}
    )

    for item in items:
        execute_insert(
            "UPDATE set_house_spaces SET status = 'available', updated_at = NOW() WHERE id = :space_id",
            {"space_id": item["space_id"]}
        )

    return {"transaction": transaction}
