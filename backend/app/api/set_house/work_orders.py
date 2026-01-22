"""
Set House Work Orders API

Endpoints for managing work orders (pre-booking staging).
"""
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/work-orders", tags=["Set House Work Orders"])


# ============================================================================
# SCHEMAS
# ============================================================================

class WorkOrderCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    assigned_to: Optional[str] = None
    custodian_user_id: Optional[str] = None
    custodian_contact_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    due_date: Optional[date] = None
    booking_date: Optional[date] = None
    booking_start_time: Optional[str] = None
    booking_end_time: Optional[str] = None


class WorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    custodian_user_id: Optional[str] = None
    custodian_contact_id: Optional[str] = None
    due_date: Optional[date] = None
    booking_date: Optional[date] = None
    booking_start_time: Optional[str] = None
    booking_end_time: Optional[str] = None


class WorkOrderItemAdd(BaseModel):
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
# WORK ORDER ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_work_orders(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    assigned_to: Optional[str] = Query(None, description="Filter by assigned user"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List work orders for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    result = set_house_service.list_work_orders(
        org_id,
        status=status,
        assigned_to=assigned_to,
        limit=limit,
        offset=offset
    )

    return result


@router.post("/{org_id}")
async def create_work_order(
    org_id: str,
    data: WorkOrderCreate,
    user=Depends(get_current_user)
):
    """Create a new work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    work_order = set_house_service.create_work_order(
        org_id,
        data.title,
        profile_id,
        **data.model_dump(exclude={"title"})
    )

    if not work_order:
        raise HTTPException(status_code=500, detail="Failed to create work order")

    return {"work_order": work_order}


@router.get("/{org_id}/{work_order_id}")
async def get_work_order(
    org_id: str,
    work_order_id: str,
    user=Depends(get_current_user)
):
    """Get a single work order with items."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    from app.core.database import execute_single, execute_query

    work_order = execute_single(
        """
        SELECT wo.*, p.display_name as assigned_to_name,
               cp.display_name as custodian_name,
               cc.first_name || ' ' || cc.last_name as custodian_contact_name,
               bp.name as project_name
        FROM set_house_work_orders wo
        LEFT JOIN profiles p ON p.id = wo.assigned_to
        LEFT JOIN profiles cp ON cp.id = wo.custodian_user_id
        LEFT JOIN set_house_client_contacts cc ON cc.id = wo.custodian_contact_id
        LEFT JOIN backlot_projects bp ON bp.id = wo.backlot_project_id
        WHERE wo.id = :work_order_id AND wo.organization_id = :org_id
        """,
        {"work_order_id": work_order_id, "org_id": org_id}
    )

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    items = execute_query(
        """
        SELECT woi.*, s.name as space_name, s.internal_id as space_internal_id,
               s.space_type, pi.name as package_name
        FROM set_house_work_order_items woi
        LEFT JOIN set_house_spaces s ON s.id = woi.space_id
        LEFT JOIN set_house_package_instances pi ON pi.id = woi.package_instance_id
        WHERE woi.work_order_id = :work_order_id
        ORDER BY woi.sort_order
        """,
        {"work_order_id": work_order_id}
    )

    work_order["items"] = items
    return {"work_order": work_order}


@router.put("/{org_id}/{work_order_id}")
async def update_work_order(
    org_id: str,
    work_order_id: str,
    data: WorkOrderUpdate,
    user=Depends(get_current_user)
):
    """Update a work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "work_order_id": work_order_id, "org_id": org_id}

    work_order = execute_insert(
        f"""
        UPDATE set_house_work_orders
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :work_order_id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    return {"work_order": work_order}


@router.delete("/{org_id}/{work_order_id}")
async def delete_work_order(
    org_id: str,
    work_order_id: str,
    user=Depends(get_current_user)
):
    """Delete a work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin"])

    from app.core.database import execute_update

    execute_update(
        "DELETE FROM set_house_work_orders WHERE id = :work_order_id AND organization_id = :org_id",
        {"work_order_id": work_order_id, "org_id": org_id}
    )

    return {"success": True}


# ============================================================================
# WORK ORDER ITEMS
# ============================================================================

@router.post("/{org_id}/{work_order_id}/items")
async def add_work_order_item(
    org_id: str,
    work_order_id: str,
    data: WorkOrderItemAdd,
    user=Depends(get_current_user)
):
    """Add an item to a work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert, execute_single

    max_order = execute_single(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM set_house_work_order_items WHERE work_order_id = :work_order_id",
        {"work_order_id": work_order_id}
    )

    item = execute_insert(
        """
        INSERT INTO set_house_work_order_items (
            work_order_id, space_id, package_instance_id, notes, sort_order
        ) VALUES (
            :work_order_id, :space_id, :package_instance_id, :notes, :sort_order
        )
        RETURNING *
        """,
        {
            "work_order_id": work_order_id,
            "space_id": data.space_id,
            "package_instance_id": data.package_instance_id,
            "notes": data.notes,
            "sort_order": max_order["next_order"] if max_order else 1
        }
    )

    return {"item": item}


@router.put("/{org_id}/{work_order_id}/items/{item_id}/confirm")
async def confirm_work_order_item(
    org_id: str,
    work_order_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Confirm a work order item."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_insert
    from datetime import datetime, timezone

    item = execute_insert(
        """
        UPDATE set_house_work_order_items
        SET is_confirmed = TRUE, confirmed_at = :now, confirmed_by = :user_id
        WHERE id = :item_id AND work_order_id = :work_order_id
        RETURNING *
        """,
        {
            "item_id": item_id,
            "work_order_id": work_order_id,
            "now": datetime.now(timezone.utc),
            "user_id": profile_id
        }
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"item": item}


@router.delete("/{org_id}/{work_order_id}/items/{item_id}")
async def remove_work_order_item(
    org_id: str,
    work_order_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from a work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_update

    execute_update(
        "DELETE FROM set_house_work_order_items WHERE id = :item_id AND work_order_id = :work_order_id",
        {"item_id": item_id, "work_order_id": work_order_id}
    )

    return {"success": True}


# ============================================================================
# WORK ORDER ACTIONS
# ============================================================================

@router.post("/{org_id}/{work_order_id}/convert-to-booking")
async def convert_to_booking(
    org_id: str,
    work_order_id: str,
    user=Depends(get_current_user)
):
    """Convert a work order to a booking transaction."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_single, execute_query, execute_insert
    from datetime import datetime, timezone

    # Get work order
    work_order = execute_single(
        "SELECT * FROM set_house_work_orders WHERE id = :work_order_id AND organization_id = :org_id",
        {"work_order_id": work_order_id, "org_id": org_id}
    )

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    if work_order["status"] == "booked":
        raise HTTPException(status_code=400, detail="Work order already converted to booking")

    # Get work order items
    items = execute_query(
        "SELECT * FROM set_house_work_order_items WHERE work_order_id = :work_order_id",
        {"work_order_id": work_order_id}
    )

    if not items:
        raise HTTPException(status_code=400, detail="Work order has no items")

    # Create transaction
    scheduled_start = None
    scheduled_end = None
    if work_order["booking_date"]:
        from datetime import datetime, time, timedelta
        booking_date = work_order["booking_date"]
        start_time = work_order.get("booking_start_time") or time(8, 0)
        end_time = work_order.get("booking_end_time") or time(18, 0)
        scheduled_start = datetime.combine(booking_date, start_time)
        scheduled_end = datetime.combine(booking_date, end_time)

    transaction = execute_insert(
        """
        INSERT INTO set_house_transactions (
            organization_id, transaction_type, initiated_by_user_id,
            primary_custodian_user_id, scheduled_start, scheduled_end,
            notes, status
        ) VALUES (
            :org_id, 'booking_confirmed', :initiated_by,
            :custodian_user_id, :scheduled_start, :scheduled_end,
            :notes, 'confirmed'
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "initiated_by": profile_id,
            "custodian_user_id": work_order["custodian_user_id"],
            "scheduled_start": scheduled_start,
            "scheduled_end": scheduled_end,
            "notes": work_order["notes"]
        }
    )

    # Add items to transaction
    for item in items:
        execute_insert(
            """
            INSERT INTO set_house_transaction_items (transaction_id, space_id, package_instance_id, notes)
            VALUES (:transaction_id, :space_id, :package_instance_id, :notes)
            """,
            {
                "transaction_id": transaction["id"],
                "space_id": item["space_id"],
                "package_instance_id": item["package_instance_id"],
                "notes": item["notes"]
            }
        )

        # Update space status
        if item["space_id"]:
            execute_insert(
                "UPDATE set_house_spaces SET status = 'reserved', updated_at = NOW() WHERE id = :space_id",
                {"space_id": item["space_id"]}
            )

    # Update work order
    execute_insert(
        """
        UPDATE set_house_work_orders
        SET status = 'booked', booking_transaction_id = :transaction_id,
            booked_at = :now, booked_by = :user_id, updated_at = NOW()
        WHERE id = :work_order_id
        """,
        {
            "work_order_id": work_order_id,
            "transaction_id": transaction["id"],
            "now": datetime.now(timezone.utc),
            "user_id": profile_id
        }
    )

    return {"transaction": transaction}
