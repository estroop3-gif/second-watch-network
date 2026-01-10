"""
Gear House Purchase Requests API

Endpoints for managing equipment purchase requests for replacements.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert

from app.services import gear_service

router = APIRouter(prefix="/purchase-requests", tags=["Gear Purchase Requests"])


# ============================================================================
# SCHEMAS
# ============================================================================

class PurchaseRequestCreate(BaseModel):
    incident_id: Optional[str] = None
    original_asset_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    estimated_cost: Optional[float] = None
    quantity: int = 1


class PurchaseRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_cost: Optional[float] = None
    quantity: Optional[int] = None
    vendor_name: Optional[str] = None
    order_reference: Optional[str] = None
    notes: Optional[str] = None


class PurchaseRequestApprove(BaseModel):
    notes: Optional[str] = None


class PurchaseRequestOrder(BaseModel):
    vendor_name: str
    order_reference: Optional[str] = None
    actual_cost: Optional[float] = None
    notes: Optional[str] = None


class PurchaseRequestReceive(BaseModel):
    new_asset_id: Optional[str] = None  # Link to the new asset if already created
    actual_cost: Optional[float] = None
    notes: Optional[str] = None


class PurchaseRequestCancel(BaseModel):
    reason: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def require_incident_management(org_id: str, user_id: str) -> None:
    """Check if user has incident management permission (for approvals)"""
    if not gear_service.check_incident_management_permission(org_id, user_id):
        raise HTTPException(status_code=403, detail="You don't have permission to manage purchase requests")


# ============================================================================
# PURCHASE REQUEST ENDPOINTS
# ============================================================================

@router.get("/{org_id}")
async def list_purchase_requests(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, ordered, received, cancelled"),
    incident_id: Optional[str] = Query(None, description="Filter by linked incident"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List purchase requests for an organization"""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Build query
    conditions = ["pr.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("pr.status = :status")
        params["status"] = status

    if incident_id:
        conditions.append("pr.incident_id = :incident_id")
        params["incident_id"] = incident_id

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            pr.*,
            req.display_name as requested_by_name,
            appr.display_name as approved_by_name,
            recv.display_name as received_by_name,
            a.name as original_asset_name,
            a.internal_id as original_asset_internal_id,
            i.incident_type,
            i.damage_tier
        FROM gear_purchase_requests pr
        LEFT JOIN profiles req ON pr.requested_by_user_id = req.id
        LEFT JOIN profiles appr ON pr.approved_by_user_id = appr.id
        LEFT JOIN profiles recv ON pr.received_by_user_id = recv.id
        LEFT JOIN gear_assets a ON pr.original_asset_id = a.id
        LEFT JOIN gear_incidents i ON pr.incident_id = i.id
        WHERE {where_clause}
        ORDER BY pr.created_at DESC
        LIMIT :limit OFFSET :offset
    """

    requests = execute_query(query, params)

    # Get total count
    count_query = f"""
        SELECT COUNT(*) as total
        FROM gear_purchase_requests pr
        WHERE {where_clause}
    """
    count_result = execute_single(count_query, params)
    total = count_result["total"] if count_result else 0

    return {
        "purchase_requests": requests,
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.post("/{org_id}")
async def create_purchase_request(
    org_id: str,
    data: PurchaseRequestCreate,
    user=Depends(get_current_user)
):
    """Create a new purchase request"""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Generate request number
    request_number = gear_service.generate_purchase_request_number(org_id)

    result = execute_insert("""
        INSERT INTO gear_purchase_requests (
            organization_id,
            incident_id,
            original_asset_id,
            request_number,
            title,
            description,
            estimated_cost,
            quantity,
            status,
            requested_by_user_id,
            requested_at
        ) VALUES (
            :org_id,
            :incident_id,
            :original_asset_id,
            :request_number,
            :title,
            :description,
            :estimated_cost,
            :quantity,
            'pending',
            :requested_by,
            NOW()
        )
        RETURNING *
    """, {
        "org_id": org_id,
        "incident_id": data.incident_id,
        "original_asset_id": data.original_asset_id,
        "request_number": request_number,
        "title": data.title,
        "description": data.description,
        "estimated_cost": data.estimated_cost,
        "quantity": data.quantity,
        "requested_by": profile_id
    })

    return {"purchase_request": result, "message": "Purchase request created"}


@router.get("/item/{request_id}")
async def get_purchase_request(
    request_id: str,
    user=Depends(get_current_user)
):
    """Get a single purchase request by ID"""
    profile_id = get_profile_id(user)

    # Get the request with related data
    request = execute_single("""
        SELECT
            pr.*,
            req.display_name as requested_by_name,
            appr.display_name as approved_by_name,
            recv.display_name as received_by_name,
            a.name as original_asset_name,
            a.internal_id as original_asset_internal_id,
            a.category_id as original_asset_category_id,
            na.name as new_asset_name,
            na.internal_id as new_asset_internal_id,
            i.incident_type,
            i.damage_tier,
            i.damage_description,
            i.status as incident_status
        FROM gear_purchase_requests pr
        LEFT JOIN profiles req ON pr.requested_by_user_id = req.id
        LEFT JOIN profiles appr ON pr.approved_by_user_id = appr.id
        LEFT JOIN profiles recv ON pr.received_by_user_id = recv.id
        LEFT JOIN gear_assets a ON pr.original_asset_id = a.id
        LEFT JOIN gear_assets na ON pr.new_asset_id = na.id
        LEFT JOIN gear_incidents i ON pr.incident_id = i.id
        WHERE pr.id = :request_id
    """, {"request_id": request_id})

    if not request:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    # Check access
    require_org_access(request["organization_id"], profile_id)

    return {"purchase_request": request}


@router.put("/item/{request_id}")
async def update_purchase_request(
    request_id: str,
    data: PurchaseRequestUpdate,
    user=Depends(get_current_user)
):
    """Update a purchase request (only allowed for pending/approved status)"""
    profile_id = get_profile_id(user)

    # Get current request
    current = execute_single("""
        SELECT organization_id, status FROM gear_purchase_requests WHERE id = :id
    """, {"id": request_id})

    if not current:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    require_org_access(current["organization_id"], profile_id)

    # Only allow updates for pending or approved requests
    if current["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot update request with status '{current['status']}'")

    # Build update query dynamically
    updates = []
    params = {"id": request_id}

    if data.title is not None:
        updates.append("title = :title")
        params["title"] = data.title
    if data.description is not None:
        updates.append("description = :description")
        params["description"] = data.description
    if data.estimated_cost is not None:
        updates.append("estimated_cost = :estimated_cost")
        params["estimated_cost"] = data.estimated_cost
    if data.quantity is not None:
        updates.append("quantity = :quantity")
        params["quantity"] = data.quantity
    if data.vendor_name is not None:
        updates.append("vendor_name = :vendor_name")
        params["vendor_name"] = data.vendor_name
    if data.order_reference is not None:
        updates.append("order_reference = :order_reference")
        params["order_reference"] = data.order_reference
    if data.notes is not None:
        updates.append("notes = :notes")
        params["notes"] = data.notes

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates.append("updated_at = NOW()")

    result = execute_insert(f"""
        UPDATE gear_purchase_requests
        SET {', '.join(updates)}
        WHERE id = :id
        RETURNING *
    """, params)

    return {"purchase_request": result, "message": "Purchase request updated"}


@router.post("/item/{request_id}/approve")
async def approve_purchase_request(
    request_id: str,
    data: PurchaseRequestApprove,
    user=Depends(get_current_user)
):
    """Approve a pending purchase request"""
    profile_id = get_profile_id(user)

    # Get current request
    current = execute_single("""
        SELECT organization_id, status FROM gear_purchase_requests WHERE id = :id
    """, {"id": request_id})

    if not current:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    # Check incident management permission
    require_incident_management(current["organization_id"], profile_id)

    if current["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve request with status '{current['status']}'")

    # Update to approved
    notes_update = ""
    params = {"id": request_id, "approved_by": profile_id}

    if data.notes:
        notes_update = ", notes = COALESCE(notes || E'\\n', '') || :notes"
        params["notes"] = f"[Approval note] {data.notes}"

    result = execute_insert(f"""
        UPDATE gear_purchase_requests
        SET status = 'approved',
            approved_by_user_id = :approved_by,
            approved_at = NOW(),
            updated_at = NOW()
            {notes_update}
        WHERE id = :id
        RETURNING *
    """, params)

    return {"purchase_request": result, "message": "Purchase request approved"}


@router.post("/item/{request_id}/order")
async def mark_purchase_request_ordered(
    request_id: str,
    data: PurchaseRequestOrder,
    user=Depends(get_current_user)
):
    """Mark an approved purchase request as ordered"""
    profile_id = get_profile_id(user)

    # Get current request
    current = execute_single("""
        SELECT organization_id, status FROM gear_purchase_requests WHERE id = :id
    """, {"id": request_id})

    if not current:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    require_org_access(current["organization_id"], profile_id)

    if current["status"] != "approved":
        raise HTTPException(status_code=400, detail=f"Cannot mark as ordered - request must be approved first (current: '{current['status']}')")

    # Update to ordered
    notes_update = ""
    params = {
        "id": request_id,
        "vendor_name": data.vendor_name,
        "order_reference": data.order_reference,
        "actual_cost": data.actual_cost
    }

    if data.notes:
        notes_update = ", notes = COALESCE(notes || E'\\n', '') || :notes"
        params["notes"] = f"[Order note] {data.notes}"

    result = execute_insert(f"""
        UPDATE gear_purchase_requests
        SET status = 'ordered',
            vendor_name = :vendor_name,
            order_reference = :order_reference,
            actual_cost = COALESCE(:actual_cost, actual_cost, estimated_cost),
            updated_at = NOW()
            {notes_update}
        WHERE id = :id
        RETURNING *
    """, params)

    return {"purchase_request": result, "message": "Purchase request marked as ordered"}


@router.post("/item/{request_id}/receive")
async def receive_purchase_request(
    request_id: str,
    data: PurchaseRequestReceive,
    user=Depends(get_current_user)
):
    """Mark a purchase request as received and optionally link the new asset"""
    profile_id = get_profile_id(user)

    # Get current request
    current = execute_single("""
        SELECT organization_id, status, incident_id FROM gear_purchase_requests WHERE id = :id
    """, {"id": request_id})

    if not current:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    require_org_access(current["organization_id"], profile_id)

    if current["status"] not in ["approved", "ordered"]:
        raise HTTPException(status_code=400, detail=f"Cannot receive - request must be approved or ordered first (current: '{current['status']}')")

    # If linking a new asset, verify it exists
    if data.new_asset_id:
        asset = execute_single("""
            SELECT id FROM gear_assets WHERE id = :asset_id AND organization_id = :org_id
        """, {"asset_id": data.new_asset_id, "org_id": current["organization_id"]})

        if not asset:
            raise HTTPException(status_code=404, detail="New asset not found in this organization")

    # Update to received
    notes_update = ""
    params = {
        "id": request_id,
        "received_by": profile_id,
        "new_asset_id": data.new_asset_id,
        "actual_cost": data.actual_cost
    }

    if data.notes:
        notes_update = ", notes = COALESCE(notes || E'\\n', '') || :notes"
        params["notes"] = f"[Received note] {data.notes}"

    result = execute_insert(f"""
        UPDATE gear_purchase_requests
        SET status = 'received',
            received_at = NOW(),
            received_by_user_id = :received_by,
            new_asset_id = COALESCE(:new_asset_id, new_asset_id),
            actual_cost = COALESCE(:actual_cost, actual_cost),
            updated_at = NOW()
            {notes_update}
        WHERE id = :id
        RETURNING *
    """, params)

    # If there's a linked incident and it's in 'replacement' status, we could auto-resolve it
    if current["incident_id"] and data.new_asset_id:
        # Update incident to resolved with 'replaced' resolution
        execute_insert("""
            UPDATE gear_incidents
            SET status = 'resolved',
                resolution_type = 'replaced',
                resolved_at = NOW(),
                updated_at = NOW()
            WHERE id = :incident_id AND status = 'replacement'
        """, {"incident_id": current["incident_id"]})

    return {"purchase_request": result, "message": "Purchase request marked as received"}


@router.post("/item/{request_id}/cancel")
async def cancel_purchase_request(
    request_id: str,
    data: PurchaseRequestCancel,
    user=Depends(get_current_user)
):
    """Cancel a purchase request (only allowed for pending/approved status)"""
    profile_id = get_profile_id(user)

    # Get current request
    current = execute_single("""
        SELECT organization_id, status FROM gear_purchase_requests WHERE id = :id
    """, {"id": request_id})

    if not current:
        raise HTTPException(status_code=404, detail="Purchase request not found")

    require_org_access(current["organization_id"], profile_id)

    if current["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel request with status '{current['status']}'")

    # Update to cancelled
    notes_update = ""
    params = {"id": request_id}

    if data.reason:
        notes_update = ", notes = COALESCE(notes || E'\\n', '') || :notes"
        params["notes"] = f"[Cancellation reason] {data.reason}"

    result = execute_insert(f"""
        UPDATE gear_purchase_requests
        SET status = 'cancelled',
            updated_at = NOW()
            {notes_update}
        WHERE id = :id
        RETURNING *
    """, params)

    return {"purchase_request": result, "message": "Purchase request cancelled"}


@router.get("/{org_id}/stats")
async def get_purchase_request_stats(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get purchase request statistics for an organization"""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    stats = execute_single("""
        SELECT
            COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
            COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
            COUNT(*) FILTER (WHERE status = 'ordered') as ordered_count,
            COUNT(*) FILTER (WHERE status = 'received') as received_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
            COALESCE(SUM(estimated_cost) FILTER (WHERE status = 'pending'), 0) as pending_estimated_total,
            COALESCE(SUM(COALESCE(actual_cost, estimated_cost)) FILTER (WHERE status IN ('approved', 'ordered')), 0) as in_progress_total,
            COALESCE(SUM(actual_cost) FILTER (WHERE status = 'received' AND received_at >= NOW() - INTERVAL '30 days'), 0) as spent_last_30_days
        FROM gear_purchase_requests
        WHERE organization_id = :org_id
    """, {"org_id": org_id})

    return {"stats": stats}
