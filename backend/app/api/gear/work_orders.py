"""
Gear House Work Orders API

Pre-checkout staging system for equipment preparation.
Work orders organize equipment before actual checkout.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

router = APIRouter(prefix="/work-orders", tags=["Gear Work Orders"])


# ============================================================================
# SCHEMAS
# ============================================================================

class WorkOrderItemInput(BaseModel):
    asset_id: Optional[str] = None
    kit_instance_id: Optional[str] = None
    quantity: int = 1
    notes: Optional[str] = None


class WorkOrderCreate(BaseModel):
    title: str
    notes: Optional[str] = None
    custodian_user_id: Optional[str] = None
    custodian_contact_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    due_date: Optional[date] = None
    pickup_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    destination_location_id: Optional[str] = None
    assigned_to: Optional[str] = None
    items: List[WorkOrderItemInput] = []
    rental_request_id: Optional[str] = None  # If creating from rental request


class WorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    custodian_user_id: Optional[str] = None
    custodian_contact_id: Optional[str] = None
    backlot_project_id: Optional[str] = None
    due_date: Optional[date] = None
    pickup_date: Optional[date] = None
    expected_return_date: Optional[date] = None
    destination_location_id: Optional[str] = None
    assigned_to: Optional[str] = None


class WorkOrderAssign(BaseModel):
    assigned_to: str


class WorkOrderItemsAdd(BaseModel):
    items: List[WorkOrderItemInput]


class StageItemRequest(BaseModel):
    scanned_value: Optional[str] = None  # For barcode/QR scanning verification


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str) -> None:
    """Check if user has access to the organization."""
    result = execute_single(
        """
        SELECT 1 FROM organization_members
        WHERE organization_id = :org_id AND user_id = :user_id
        """,
        {"org_id": org_id, "user_id": user_id}
    )
    if not result:
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def get_work_order_or_404(org_id: str, work_order_id: str) -> Dict[str, Any]:
    """Get work order or raise 404."""
    result = execute_single(
        """
        SELECT * FROM gear_work_orders
        WHERE id = :id AND organization_id = :org_id
        """,
        {"id": work_order_id, "org_id": org_id}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Work order not found")
    return result


# ============================================================================
# WORK ORDER ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_work_orders(
    org_id: str,
    status: Optional[str] = Query(None),
    assigned_to: Optional[str] = Query(None),
    due_date_from: Optional[date] = Query(None),
    due_date_to: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List work orders for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Build query with filters
    conditions = ["wo.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("wo.status = :status")
        params["status"] = status
    else:
        # Default: exclude checked_out and cancelled work orders
        conditions.append("wo.status NOT IN ('checked_out', 'cancelled')")

    if assigned_to:
        conditions.append("wo.assigned_to = :assigned_to")
        params["assigned_to"] = assigned_to

    if due_date_from:
        conditions.append("wo.due_date >= :due_date_from")
        params["due_date_from"] = due_date_from

    if due_date_to:
        conditions.append("wo.due_date <= :due_date_to")
        params["due_date_to"] = due_date_to

    where_clause = " AND ".join(conditions)

    work_orders = execute_query(
        f"""
        SELECT
            wo.*,
            creator.display_name as created_by_name,
            assignee.display_name as assigned_to_name,
            custodian.display_name as custodian_user_name,
            contact.first_name || ' ' || contact.last_name as custodian_contact_name,
            project.title as project_name,
            loc.name as destination_location_name,
            (SELECT COUNT(*) FROM gear_work_order_items WHERE work_order_id = wo.id) as item_count,
            (SELECT COUNT(*) FROM gear_work_order_items WHERE work_order_id = wo.id AND is_staged = TRUE) as staged_count
        FROM gear_work_orders wo
        LEFT JOIN profiles creator ON creator.id = wo.created_by
        LEFT JOIN profiles assignee ON assignee.id = wo.assigned_to
        LEFT JOIN profiles custodian ON custodian.id = wo.custodian_user_id
        LEFT JOIN gear_organization_contacts contact ON contact.id = wo.custodian_contact_id
        LEFT JOIN backlot_projects project ON project.id = wo.backlot_project_id
        LEFT JOIN gear_locations loc ON loc.id = wo.destination_location_id
        WHERE {where_clause}
        ORDER BY
            CASE wo.status
                WHEN 'draft' THEN 1
                WHEN 'in_progress' THEN 2
                WHEN 'ready' THEN 3
                ELSE 4
            END,
            wo.due_date ASC NULLS LAST,
            wo.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    # Get total count
    count_result = execute_single(
        f"""
        SELECT COUNT(*) as total
        FROM gear_work_orders wo
        WHERE {where_clause}
        """,
        params
    )

    return {
        "work_orders": work_orders,
        "total": count_result["total"] if count_result else 0
    }


@router.get("/{org_id}/counts")
async def get_work_order_counts(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get work order counts by status for tab badges."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    counts = execute_query(
        """
        SELECT status, COUNT(*) as count
        FROM gear_work_orders
        WHERE organization_id = :org_id
        AND status NOT IN ('checked_out', 'cancelled')
        GROUP BY status
        """,
        {"org_id": org_id}
    )

    by_status = {row["status"]: row["count"] for row in counts}
    total = sum(by_status.values())

    return {
        "total": total,
        "by_status": by_status
    }


@router.post("/{org_id}")
async def create_work_order(
    org_id: str,
    data: WorkOrderCreate,
    user=Depends(get_current_user)
):
    """Create a new work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Create work order
    work_order = execute_insert(
        """
        INSERT INTO gear_work_orders (
            organization_id, title, notes, status,
            created_by, assigned_to,
            custodian_user_id, custodian_contact_id, backlot_project_id,
            due_date, pickup_date, expected_return_date,
            destination_location_id
        ) VALUES (
            :org_id, :title, :notes, 'draft',
            :created_by, :assigned_to,
            :custodian_user_id, :custodian_contact_id, :backlot_project_id,
            :due_date, :pickup_date, :expected_return_date,
            :destination_location_id
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "title": data.title,
            "notes": data.notes,
            "created_by": profile_id,
            "assigned_to": data.assigned_to,
            "custodian_user_id": data.custodian_user_id,
            "custodian_contact_id": data.custodian_contact_id,
            "backlot_project_id": data.backlot_project_id,
            "due_date": data.due_date,
            "pickup_date": data.pickup_date,
            "expected_return_date": data.expected_return_date,
            "destination_location_id": data.destination_location_id,
        }
    )

    # Add items if provided
    if data.items:
        for item in data.items:
            execute_insert(
                """
                INSERT INTO gear_work_order_items (
                    work_order_id, asset_id, kit_instance_id, quantity, notes
                ) VALUES (
                    :work_order_id, :asset_id, :kit_instance_id, :quantity, :notes
                )
                RETURNING *
                """,
                {
                    "work_order_id": work_order["id"],
                    "asset_id": item.asset_id,
                    "kit_instance_id": item.kit_instance_id,
                    "quantity": item.quantity,
                    "notes": item.notes,
                }
            )

    # If this work order was created from a rental request, mark the request as converted
    if data.rental_request_id:
        execute_update(
            """
            UPDATE gear_rental_requests
            SET status = 'converted', updated_at = NOW()
            WHERE id = :request_id
            """,
            {"request_id": data.rental_request_id}
        )

        # NEW: Auto-create backlot gear items if rental request is linked to a project
        if data.backlot_project_id and data.items:
            # Get rental request details
            rental_request = execute_single(
                """
                SELECT rr.*, org.name as rental_house_name
                FROM gear_rental_requests rr
                JOIN organizations org ON org.id = rr.rental_house_org_id
                WHERE rr.id = :request_id
                """,
                {"request_id": data.rental_request_id}
            )

            if rental_request:
                # Create a backlot gear item for each work order item with an asset
                for wo_item in data.items:
                    if wo_item.asset_id:
                        # Get asset details
                        asset = execute_single(
                            "SELECT name, manufacturer_serial FROM gear_assets WHERE id = :id",
                            {"id": wo_item.asset_id}
                        )

                        if asset:
                            # Use a default daily rate if not provided
                            daily_rate = 100.00  # Default placeholder rate

                            gear_item = execute_insert(
                                """
                                INSERT INTO backlot_gear_items (
                                    project_id, name, description,
                                    is_owned, rental_house,
                                    rental_cost_per_day,
                                    rental_weekly_rate,
                                    rental_monthly_rate,
                                    pickup_date, return_date,
                                    status, serial_number, notes
                                )
                                VALUES (
                                    :project_id, :name, :description,
                                    FALSE, :rental_house,
                                    :daily_rate,
                                    :weekly_rate,
                                    :monthly_rate,
                                    :pickup_date, :return_date,
                                    'reserved', :serial_number, :notes
                                )
                                RETURNING *
                                """,
                                {
                                    "project_id": data.backlot_project_id,
                                    "name": asset["name"],
                                    "description": wo_item.notes,
                                    "rental_house": rental_request.get("rental_house_name", "Rental House"),
                                    "daily_rate": daily_rate,
                                    "weekly_rate": daily_rate * 7 * 0.85,  # 15% weekly discount
                                    "monthly_rate": daily_rate * 30 * 0.75,  # 25% monthly discount
                                    "pickup_date": data.pickup_date,
                                    "return_date": data.expected_return_date,
                                    "serial_number": asset.get("manufacturer_serial"),
                                    "notes": f"Work Order: {work_order['reference_number'] or work_order['id']}\nRental Request: {data.rental_request_id}",
                                }
                            )

    return {"work_order": work_order}


@router.get("/{org_id}/{work_order_id}")
async def get_work_order(
    org_id: str,
    work_order_id: str,
    user=Depends(get_current_user)
):
    """Get a single work order with its items."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    work_order = execute_single(
        """
        SELECT
            wo.*,
            creator.display_name as created_by_name,
            assignee.display_name as assigned_to_name,
            custodian.display_name as custodian_user_name,
            contact.first_name || ' ' || contact.last_name as custodian_contact_name,
            project.title as project_name,
            loc.name as destination_location_name
        FROM gear_work_orders wo
        LEFT JOIN profiles creator ON creator.id = wo.created_by
        LEFT JOIN profiles assignee ON assignee.id = wo.assigned_to
        LEFT JOIN profiles custodian ON custodian.id = wo.custodian_user_id
        LEFT JOIN gear_organization_contacts contact ON contact.id = wo.custodian_contact_id
        LEFT JOIN backlot_projects project ON project.id = wo.backlot_project_id
        LEFT JOIN gear_locations loc ON loc.id = wo.destination_location_id
        WHERE wo.id = :id AND wo.organization_id = :org_id
        """,
        {"id": work_order_id, "org_id": org_id}
    )

    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Get items
    items = execute_query(
        """
        SELECT
            woi.*,
            a.name as asset_name,
            a.internal_id as asset_internal_id,
            a.status as asset_status,
            ki.name as kit_name,
            ki.internal_id as kit_internal_id,
            stager.display_name as staged_by_name
        FROM gear_work_order_items woi
        LEFT JOIN gear_assets a ON a.id = woi.asset_id
        LEFT JOIN gear_kit_instances ki ON ki.id = woi.kit_instance_id
        LEFT JOIN profiles stager ON stager.id = woi.staged_by
        WHERE woi.work_order_id = :work_order_id
        ORDER BY woi.sort_order, woi.created_at
        """,
        {"work_order_id": work_order_id}
    )

    return {
        "work_order": work_order,
        "items": items
    }


@router.put("/{org_id}/{work_order_id}")
async def update_work_order(
    org_id: str,
    work_order_id: str,
    data: WorkOrderUpdate,
    user=Depends(get_current_user)
):
    """Update a work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Verify exists
    existing = get_work_order_or_404(org_id, work_order_id)

    # Build update
    updates = []
    params = {"id": work_order_id, "org_id": org_id}

    if data.title is not None:
        updates.append("title = :title")
        params["title"] = data.title

    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes

    if data.status is not None:
        # Validate status transition
        valid_statuses = ["draft", "in_progress", "ready", "checked_out", "cancelled"]
        if data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status: {data.status}")
        updates.append("status = :status")
        params["status"] = data.status

    if data.custodian_user_id is not None:
        updates.append("custodian_user_id = :custodian_user_id")
        params["custodian_user_id"] = data.custodian_user_id or None

    if data.custodian_contact_id is not None:
        updates.append("custodian_contact_id = :custodian_contact_id")
        params["custodian_contact_id"] = data.custodian_contact_id or None

    if data.backlot_project_id is not None:
        updates.append("backlot_project_id = :backlot_project_id")
        params["backlot_project_id"] = data.backlot_project_id or None

    if data.due_date is not None:
        updates.append("due_date = :due_date")
        params["due_date"] = data.due_date

    if data.pickup_date is not None:
        updates.append("pickup_date = :pickup_date")
        params["pickup_date"] = data.pickup_date

    if data.expected_return_date is not None:
        updates.append("expected_return_date = :expected_return_date")
        params["expected_return_date"] = data.expected_return_date

    if data.destination_location_id is not None:
        updates.append("destination_location_id = :destination_location_id")
        params["destination_location_id"] = data.destination_location_id or None

    if data.assigned_to is not None:
        updates.append("assigned_to = :assigned_to")
        params["assigned_to"] = data.assigned_to or None

    if not updates:
        return {"work_order": existing}

    updates.append("updated_at = NOW()")

    work_order = execute_insert(
        f"""
        UPDATE gear_work_orders
        SET {", ".join(updates)}
        WHERE id = :id AND organization_id = :org_id
        RETURNING *
        """,
        params
    )

    return {"work_order": work_order}


@router.delete("/{org_id}/{work_order_id}")
async def delete_work_order(
    org_id: str,
    work_order_id: str,
    user=Depends(get_current_user)
):
    """Delete a work order (only draft or cancelled)."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    existing = get_work_order_or_404(org_id, work_order_id)

    if existing["status"] not in ("draft", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail="Can only delete draft or cancelled work orders"
        )

    execute_update(
        """
        DELETE FROM gear_work_orders
        WHERE id = :id AND organization_id = :org_id
        """,
        {"id": work_order_id, "org_id": org_id}
    )

    return {"success": True}


# ============================================================================
# WORK ORDER ITEMS
# ============================================================================

@router.post("/{org_id}/{work_order_id}/items")
async def add_work_order_items(
    org_id: str,
    work_order_id: str,
    data: WorkOrderItemsAdd,
    user=Depends(get_current_user)
):
    """Add items to a work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    existing = get_work_order_or_404(org_id, work_order_id)

    if existing["status"] in ("checked_out", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot modify checked out or cancelled work order")

    added_items = []
    for item in data.items:
        result = execute_insert(
            """
            INSERT INTO gear_work_order_items (
                work_order_id, asset_id, kit_instance_id, quantity, notes
            ) VALUES (
                :work_order_id, :asset_id, :kit_instance_id, :quantity, :notes
            )
            RETURNING *
            """,
            {
                "work_order_id": work_order_id,
                "asset_id": item.asset_id,
                "kit_instance_id": item.kit_instance_id,
                "quantity": item.quantity,
                "notes": item.notes,
            }
        )
        added_items.append(result)

    return {"items": added_items}


@router.delete("/{org_id}/{work_order_id}/items/{item_id}")
async def remove_work_order_item(
    org_id: str,
    work_order_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from a work order."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    existing = get_work_order_or_404(org_id, work_order_id)

    if existing["status"] in ("checked_out", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot modify checked out or cancelled work order")

    execute_update(
        """
        DELETE FROM gear_work_order_items
        WHERE id = :item_id AND work_order_id = :work_order_id
        """,
        {"item_id": item_id, "work_order_id": work_order_id}
    )

    return {"success": True}


@router.post("/{org_id}/{work_order_id}/items/{item_id}/stage")
async def stage_work_order_item(
    org_id: str,
    work_order_id: str,
    item_id: str,
    data: StageItemRequest = StageItemRequest(),
    user=Depends(get_current_user)
):
    """Mark an item as staged (physically prepared)."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    existing = get_work_order_or_404(org_id, work_order_id)

    if existing["status"] in ("checked_out", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot modify checked out or cancelled work order")

    # Get org settings to check verification method
    settings = execute_single(
        """
        SELECT work_order_staging_verify_method, work_order_auto_ready
        FROM gear_organization_settings
        WHERE organization_id = :org_id
        """,
        {"org_id": org_id}
    )

    verify_method = settings.get("work_order_staging_verify_method", "checkoff_only") if settings else "checkoff_only"
    auto_ready = settings.get("work_order_auto_ready", True) if settings else True

    # Get the item with asset/kit info for barcode verification
    item_info = execute_single(
        """
        SELECT
            woi.*,
            a.internal_id as asset_internal_id,
            a.barcode as asset_barcode,
            ki.internal_id as kit_internal_id
        FROM gear_work_order_items woi
        LEFT JOIN gear_assets a ON a.id = woi.asset_id
        LEFT JOIN gear_kit_instances ki ON ki.id = woi.kit_instance_id
        WHERE woi.id = :item_id AND woi.work_order_id = :work_order_id
        """,
        {"item_id": item_id, "work_order_id": work_order_id}
    )

    if not item_info:
        raise HTTPException(status_code=404, detail="Item not found")

    # Validate scanning if required
    if verify_method in ("barcode_required", "qr_required"):
        if not data.scanned_value:
            raise HTTPException(
                status_code=400,
                detail="Scanning is required to stage this item"
            )

        # Check if scanned value matches the item's internal ID or barcode
        valid_values = [
            item_info.get("asset_internal_id"),
            item_info.get("asset_barcode"),
            item_info.get("kit_internal_id"),
        ]
        valid_values = [v for v in valid_values if v]  # Remove None values

        if data.scanned_value not in valid_values:
            raise HTTPException(
                status_code=400,
                detail="Scanned value does not match this item"
            )

    # For scan_or_checkoff, both methods work - no validation needed

    # Stage the item
    item = execute_insert(
        """
        UPDATE gear_work_order_items
        SET is_staged = TRUE, staged_at = NOW(), staged_by = :user_id
        WHERE id = :item_id AND work_order_id = :work_order_id
        RETURNING *
        """,
        {"item_id": item_id, "work_order_id": work_order_id, "user_id": profile_id}
    )

    # Check if all items are now staged and auto_ready is enabled
    auto_ready_triggered = False
    if auto_ready and existing["status"] in ("draft", "in_progress"):
        staging_check = execute_single(
            """
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_staged = TRUE) as staged
            FROM gear_work_order_items
            WHERE work_order_id = :work_order_id
            """,
            {"work_order_id": work_order_id}
        )

        if staging_check and staging_check["total"] == staging_check["staged"] and staging_check["total"] > 0:
            # All items staged - auto transition to ready
            execute_update(
                """
                UPDATE gear_work_orders
                SET status = 'ready', updated_at = NOW()
                WHERE id = :work_order_id AND status IN ('draft', 'in_progress')
                """,
                {"work_order_id": work_order_id}
            )
            auto_ready_triggered = True

    return {"item": item, "auto_ready_triggered": auto_ready_triggered}


@router.post("/{org_id}/{work_order_id}/stage-by-scan")
async def stage_item_by_scan(
    org_id: str,
    work_order_id: str,
    data: StageItemRequest,
    user=Depends(get_current_user)
):
    """Stage an item by scanning its barcode/QR code."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    existing = get_work_order_or_404(org_id, work_order_id)

    if existing["status"] in ("checked_out", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot modify checked out or cancelled work order")

    if not data.scanned_value:
        raise HTTPException(status_code=400, detail="Scanned value is required")

    # Find the item by scanned value
    item_info = execute_single(
        """
        SELECT
            woi.*,
            a.internal_id as asset_internal_id,
            a.barcode as asset_barcode,
            a.name as asset_name,
            ki.internal_id as kit_internal_id,
            ki.name as kit_name
        FROM gear_work_order_items woi
        LEFT JOIN gear_assets a ON a.id = woi.asset_id
        LEFT JOIN gear_kit_instances ki ON ki.id = woi.kit_instance_id
        WHERE woi.work_order_id = :work_order_id
          AND (
              a.internal_id = :scanned_value
              OR a.barcode = :scanned_value
              OR ki.internal_id = :scanned_value
          )
        """,
        {"work_order_id": work_order_id, "scanned_value": data.scanned_value}
    )

    if not item_info:
        raise HTTPException(
            status_code=404,
            detail="Item not found in this work order"
        )

    if item_info.get("is_staged"):
        item_name = item_info.get("asset_name") or item_info.get("kit_name") or "Item"
        return {
            "item": item_info,
            "already_staged": True,
            "message": f"{item_name} is already staged"
        }

    # Stage the item
    item = execute_insert(
        """
        UPDATE gear_work_order_items
        SET is_staged = TRUE, staged_at = NOW(), staged_by = :user_id
        WHERE id = :item_id AND work_order_id = :work_order_id
        RETURNING *
        """,
        {"item_id": item_info["id"], "work_order_id": work_order_id, "user_id": profile_id}
    )

    # Get org settings to check auto_ready
    settings = execute_single(
        """
        SELECT work_order_auto_ready
        FROM gear_organization_settings
        WHERE organization_id = :org_id
        """,
        {"org_id": org_id}
    )
    auto_ready = settings.get("work_order_auto_ready", True) if settings else True

    # Check if all items are now staged and auto_ready is enabled
    auto_ready_triggered = False
    if auto_ready and existing["status"] in ("draft", "in_progress"):
        staging_check = execute_single(
            """
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE is_staged = TRUE) as staged
            FROM gear_work_order_items
            WHERE work_order_id = :work_order_id
            """,
            {"work_order_id": work_order_id}
        )

        if staging_check and staging_check["total"] == staging_check["staged"] and staging_check["total"] > 0:
            execute_update(
                """
                UPDATE gear_work_orders
                SET status = 'ready', updated_at = NOW()
                WHERE id = :work_order_id AND status IN ('draft', 'in_progress')
                """,
                {"work_order_id": work_order_id}
            )
            auto_ready_triggered = True

    item_name = item_info.get("asset_name") or item_info.get("kit_name") or "Item"
    return {
        "item": item,
        "already_staged": False,
        "auto_ready_triggered": auto_ready_triggered,
        "message": f"{item_name} staged successfully"
    }


@router.post("/{org_id}/{work_order_id}/items/{item_id}/unstage")
async def unstage_work_order_item(
    org_id: str,
    work_order_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Mark an item as not staged."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    existing = get_work_order_or_404(org_id, work_order_id)

    if existing["status"] in ("checked_out", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot modify checked out or cancelled work order")

    item = execute_insert(
        """
        UPDATE gear_work_order_items
        SET is_staged = FALSE, staged_at = NULL, staged_by = NULL
        WHERE id = :item_id AND work_order_id = :work_order_id
        RETURNING *
        """,
        {"item_id": item_id, "work_order_id": work_order_id}
    )

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"item": item}


# ============================================================================
# ASSIGNMENT
# ============================================================================

@router.post("/{org_id}/{work_order_id}/assign")
async def assign_work_order(
    org_id: str,
    work_order_id: str,
    data: WorkOrderAssign,
    user=Depends(get_current_user)
):
    """Assign a work order to a preparer."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    existing = get_work_order_or_404(org_id, work_order_id)

    if existing["status"] in ("checked_out", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot assign checked out or cancelled work order")

    work_order = execute_insert(
        """
        UPDATE gear_work_orders
        SET assigned_to = :assigned_to, updated_at = NOW()
        WHERE id = :id AND organization_id = :org_id
        RETURNING *
        """,
        {"id": work_order_id, "org_id": org_id, "assigned_to": data.assigned_to}
    )

    return {"work_order": work_order}


# ============================================================================
# CHECKOUT FROM WORK ORDER
# ============================================================================

@router.post("/{org_id}/{work_order_id}/checkout")
async def checkout_from_work_order(
    org_id: str,
    work_order_id: str,
    user=Depends(get_current_user)
):
    """
    Checkout equipment from a work order.
    Creates a transaction with all work order items.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    work_order = get_work_order_or_404(org_id, work_order_id)

    # Validate status
    if work_order["status"] not in ("ready", "in_progress", "draft"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot checkout work order with status '{work_order['status']}'"
        )

    # Get work order items
    items = execute_query(
        """
        SELECT * FROM gear_work_order_items
        WHERE work_order_id = :work_order_id
        """,
        {"work_order_id": work_order_id}
    )

    if not items:
        raise HTTPException(status_code=400, detail="Work order has no items")

    # Validate custodian
    custodian_user_id = work_order.get("custodian_user_id")
    if not custodian_user_id:
        raise HTTPException(status_code=400, detail="Work order must have a custodian to checkout")

    # Create transaction
    transaction = execute_insert(
        """
        INSERT INTO gear_transactions (
            organization_id, transaction_type, status,
            primary_custodian_user_id, backlot_project_id,
            destination_location_id,
            expected_return_at, notes, initiated_by_user_id
        ) VALUES (
            :org_id, 'internal_checkout', 'checked_out',
            :custodian_user_id, :project_id,
            :destination_location_id,
            :expected_return_at, :notes, :initiated_by_user_id
        )
        RETURNING *
        """,
        {
            "org_id": org_id,
            "custodian_user_id": custodian_user_id,
            "project_id": work_order.get("backlot_project_id"),
            "destination_location_id": work_order.get("destination_location_id"),
            "expected_return_at": work_order.get("expected_return_date"),
            "notes": f"Created from work order {work_order.get('reference_number', work_order_id)}",
            "initiated_by_user_id": profile_id,
        }
    )

    # Create transaction items and update asset statuses
    for item in items:
        if item.get("asset_id"):
            # Add to transaction
            execute_update(
                """
                INSERT INTO gear_transaction_items (
                    transaction_id, asset_id, quantity, notes
                ) VALUES (
                    :transaction_id, :asset_id, :quantity, :notes
                )
                """,
                {
                    "transaction_id": transaction["id"],
                    "asset_id": item["asset_id"],
                    "quantity": item["quantity"],
                    "notes": item.get("notes"),
                }
            )

            # Update asset status
            execute_update(
                """
                UPDATE gear_assets
                SET status = 'checked_out',
                    current_custodian_user_id = :custodian_user_id,
                    updated_at = NOW()
                WHERE id = :asset_id
                """,
                {
                    "asset_id": item["asset_id"],
                    "custodian_user_id": custodian_user_id,
                }
            )

        elif item.get("kit_instance_id"):
            # Add kit to transaction
            execute_update(
                """
                INSERT INTO gear_transaction_items (
                    transaction_id, kit_instance_id, quantity, notes
                ) VALUES (
                    :transaction_id, :kit_instance_id, :quantity, :notes
                )
                """,
                {
                    "transaction_id": transaction["id"],
                    "kit_instance_id": item["kit_instance_id"],
                    "quantity": item["quantity"],
                    "notes": item.get("notes"),
                }
            )

            # Update kit status
            execute_update(
                """
                UPDATE gear_kit_instances
                SET status = 'checked_out', updated_at = NOW()
                WHERE id = :kit_id
                """,
                {"kit_id": item["kit_instance_id"]}
            )

    # Update work order
    updated_work_order = execute_insert(
        """
        UPDATE gear_work_orders
        SET status = 'checked_out',
            checkout_transaction_id = :transaction_id,
            checked_out_at = NOW(),
            checked_out_by = :user_id,
            updated_at = NOW()
        WHERE id = :id
        RETURNING *
        """,
        {
            "id": work_order_id,
            "transaction_id": transaction["id"],
            "user_id": profile_id,
        }
    )

    return {
        "work_order": updated_work_order,
        "transaction": transaction
    }
