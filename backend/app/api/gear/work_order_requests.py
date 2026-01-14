"""
Gear Work Order Requests API

Handles incoming work order requests from renters.
Gear house owners can view, approve, or reject requests.
Approval creates a draft work order.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update, get_client

router = APIRouter(prefix="/work-order-requests", tags=["Gear Work Order Requests"])


# ============================================================================
# SCHEMAS
# ============================================================================

class RejectRequest(BaseModel):
    reason: Optional[str] = None  # Optional for quick reject


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_gear_house_access(org_id: str, user_id: str, require_manager: bool = False) -> None:
    """Check if user has access to the gear house organization."""
    roles = "('owner', 'admin', 'manager')" if require_manager else "('owner', 'admin', 'manager', 'staff')"
    result = execute_single(
        f"""
        SELECT 1 FROM organization_members
        WHERE organization_id = :org_id
        AND user_id = :user_id
        AND role IN {roles}
        """,
        {"org_id": org_id, "user_id": user_id}
    )
    if not result:
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def get_request_or_404(request_id: str) -> Dict[str, Any]:
    """Get work order request or raise 404."""
    result = execute_single(
        """
        SELECT * FROM gear_work_order_requests
        WHERE id = :id
        """,
        {"id": request_id}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Work order request not found")
    return result


def get_request_with_details(request_id: str) -> Dict[str, Any]:
    """Get work order request with all related details."""
    request = execute_single(
        """
        SELECT
            r.*,
            -- Requester details
            rp.display_name as requester_name,
            rp.avatar_url as requester_avatar,
            ro.name as requester_org_name,
            -- Gear house details
            gh.name as gear_house_name,
            gh.name as gear_house_marketplace_name,
            gh.logo_url as gear_house_logo,
            -- Reviewer details
            rv.display_name as reviewer_name,
            -- Project details
            bp.title as project_title,
            -- Work order details (if approved)
            wo.reference_number as work_order_reference
        FROM gear_work_order_requests r
        LEFT JOIN profiles rp ON rp.id = r.requesting_profile_id
        LEFT JOIN organizations ro ON ro.id = r.requesting_org_id
        LEFT JOIN organizations gh ON gh.id = r.gear_house_org_id
        LEFT JOIN profiles rv ON rv.id = r.reviewed_by
        LEFT JOIN backlot_projects bp ON bp.id = r.backlot_project_id
        LEFT JOIN gear_work_orders wo ON wo.id = r.created_work_order_id
        WHERE r.id = :id
        """,
        {"id": request_id}
    )
    if not request:
        raise HTTPException(status_code=404, detail="Work order request not found")

    # Get items with full details
    items = execute_query(
        """
        SELECT
            ri.*,
            l.listing_type,
            l.notes as listing_notes,
            a.id as asset_id,
            a.name as asset_name,
            a.make as manufacturer,
            a.model,
            a.status as asset_status,
            a.notes as asset_notes,
            COALESCE(a.photos_current, a.photos_baseline, '[]'::jsonb) as asset_photos,
            c.name as category_name
        FROM gear_work_order_request_items ri
        LEFT JOIN gear_marketplace_listings l ON l.id = ri.listing_id
        LEFT JOIN gear_assets a ON a.id = ri.asset_id
        LEFT JOIN gear_categories c ON c.id = a.category_id
        WHERE ri.request_id = :request_id
        ORDER BY ri.created_at
        """,
        {"request_id": request_id}
    )

    request["items"] = items
    return request


# ============================================================================
# INCOMING REQUESTS (FOR GEAR HOUSE)
# ============================================================================

@router.get("/incoming/{org_id}")
async def list_incoming_requests(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status: pending, approved, rejected"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """
    List incoming work order requests for a gear house.

    Returns requests from renters waiting for approval or already processed.
    """
    profile_id = get_profile_id(user)
    require_gear_house_access(org_id, profile_id)

    # Build query
    conditions = ["r.gear_house_org_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("r.status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions)

    requests = execute_query(
        f"""
        SELECT
            r.*,
            rp.display_name as requester_name,
            rp.avatar_url as requester_avatar,
            ro.name as requester_org_name,
            bp.title as project_title,
            COUNT(ri.id) as item_count,
            COALESCE(SUM(ri.daily_rate * ri.quantity), 0) as total_daily_rate
        FROM gear_work_order_requests r
        LEFT JOIN profiles rp ON rp.id = r.requesting_profile_id
        LEFT JOIN organizations ro ON ro.id = r.requesting_org_id
        LEFT JOIN backlot_projects bp ON bp.id = r.backlot_project_id
        LEFT JOIN gear_work_order_request_items ri ON ri.request_id = r.id
        WHERE {where_clause}
        GROUP BY r.id, rp.display_name, rp.avatar_url, ro.name, bp.title
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    # Get total count
    total = execute_single(
        f"""
        SELECT COUNT(*) as count FROM gear_work_order_requests r
        WHERE {where_clause}
        """,
        {"org_id": org_id, "status": status} if status else {"org_id": org_id}
    )

    return {
        "requests": requests,
        "total": total["count"],
        "limit": limit,
        "offset": offset,
    }


@router.get("/incoming/{org_id}/counts")
async def get_incoming_request_counts(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get counts of incoming requests by status for badge display."""
    profile_id = get_profile_id(user)
    require_gear_house_access(org_id, profile_id)

    counts = execute_single(
        """
        SELECT
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            COUNT(*) FILTER (WHERE status = 'approved') as approved,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
            COUNT(*) as total
        FROM gear_work_order_requests
        WHERE gear_house_org_id = :org_id
        """,
        {"org_id": org_id}
    )

    return counts


# ============================================================================
# OUTGOING REQUESTS (FOR RENTERS)
# ============================================================================

@router.get("/outgoing")
async def list_outgoing_requests(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """
    List user's outgoing work order requests.

    Shows all requests the user has submitted to gear houses.
    """
    profile_id = get_profile_id(user)

    conditions = ["r.requesting_profile_id = :profile_id"]
    params = {"profile_id": profile_id, "limit": limit, "offset": offset}

    if status:
        conditions.append("r.status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions)

    requests = execute_query(
        f"""
        SELECT
            r.*,
            gh.name as gear_house_name,
            gh.name as gear_house_marketplace_name,
            gh.logo_url as gear_house_logo,
            bp.title as project_title,
            wo.reference_number as work_order_reference,
            COUNT(ri.id) as item_count,
            COALESCE(SUM(ri.daily_rate * ri.quantity), 0) as total_daily_rate
        FROM gear_work_order_requests r
        LEFT JOIN organizations gh ON gh.id = r.gear_house_org_id
        LEFT JOIN backlot_projects bp ON bp.id = r.backlot_project_id
        LEFT JOIN gear_work_orders wo ON wo.id = r.created_work_order_id
        LEFT JOIN gear_work_order_request_items ri ON ri.request_id = r.id
        WHERE {where_clause}
        GROUP BY r.id, gh.name, gh.logo_url, bp.title, wo.reference_number
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {
        "requests": requests,
    }


# ============================================================================
# SINGLE REQUEST
# ============================================================================

@router.get("/{request_id}")
async def get_request(
    request_id: str,
    user=Depends(get_current_user)
):
    """
    Get a single work order request with all details.

    Accessible by both the requester and the gear house.
    """
    profile_id = get_profile_id(user)
    request = get_request_with_details(request_id)

    # Check access - either requester or gear house member
    is_requester = request["requesting_profile_id"] == profile_id

    is_gear_house_member = False
    if not is_requester:
        member_check = execute_single(
            """
            SELECT 1 FROM organization_members
            WHERE organization_id = :org_id AND user_id = :user_id
            """,
            {"org_id": request["gear_house_org_id"], "user_id": profile_id}
        )
        is_gear_house_member = member_check is not None

    if not is_requester and not is_gear_house_member:
        raise HTTPException(status_code=403, detail="Access denied")

    return request


# ============================================================================
# APPROVE / REJECT
# ============================================================================

@router.post("/{request_id}/approve")
async def approve_request(
    request_id: str,
    user=Depends(get_current_user)
):
    """
    Approve a work order request.

    Creates a draft work order with all the requested items.
    Notifies the requester.
    """
    profile_id = get_profile_id(user)
    request = get_request_or_404(request_id)

    # Check access
    require_gear_house_access(request["gear_house_org_id"], profile_id, require_manager=True)

    # Check status
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve request with status '{request['status']}'")

    # Get request items
    items = execute_query(
        """
        SELECT * FROM gear_work_order_request_items
        WHERE request_id = :request_id
        """,
        {"request_id": request_id}
    )

    if not items:
        raise HTTPException(status_code=400, detail="Request has no items")

    # Create work order
    title = request["title"] or f"Rental - {request['reference_number']}"

    work_order = execute_insert(
        """
        INSERT INTO gear_work_orders (
            organization_id,
            title,
            notes,
            status,
            created_by,
            custodian_user_id,
            backlot_project_id,
            pickup_date,
            expected_return_date
        )
        VALUES (
            :org_id,
            :title,
            :notes,
            'draft',
            :created_by,
            :custodian_user_id,
            :backlot_project_id,
            :pickup_date,
            :expected_return_date
        )
        RETURNING id, reference_number
        """,
        {
            "org_id": request["gear_house_org_id"],
            "title": title,
            "notes": request["notes"],
            "created_by": profile_id,
            "custodian_user_id": request["requesting_profile_id"],
            "backlot_project_id": request["backlot_project_id"],
            "pickup_date": request["rental_start_date"],
            "expected_return_date": request["rental_end_date"],
        }
    )

    # Create work order items
    for item in items:
        execute_update(
            """
            INSERT INTO gear_work_order_items (
                work_order_id,
                asset_id,
                quantity,
                notes
            )
            VALUES (
                :work_order_id,
                :asset_id,
                :quantity,
                :notes
            )
            """,
            {
                "work_order_id": work_order["id"],
                "asset_id": item["asset_id"],
                "quantity": item["quantity"],
                "notes": None,
            }
        )

    # Update request status
    execute_update(
        """
        UPDATE gear_work_order_requests
        SET
            status = 'approved',
            reviewed_by = :reviewed_by,
            reviewed_at = NOW(),
            created_work_order_id = :work_order_id,
            updated_at = NOW()
        WHERE id = :id
        """,
        {
            "id": request_id,
            "reviewed_by": profile_id,
            "work_order_id": work_order["id"],
        }
    )

    # Notify requester
    try:
        client = get_client()
        client.table("notifications").insert({
            "user_id": request["requesting_profile_id"],
            "type": "gear_request_approved",
            "title": "Rental Request Approved",
            "message": f"Your rental request '{title}' has been approved. Work order {work_order['reference_number']} created.",
            "data": {
                "request_id": request_id,
                "work_order_id": work_order["id"],
                "work_order_reference": work_order["reference_number"],
            }
        }).execute()
    except Exception:
        pass  # Don't fail if notification fails

    return {
        "message": "Request approved",
        "work_order_id": work_order["id"],
        "work_order_reference": work_order["reference_number"],
    }


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: str,
    data: RejectRequest,
    user=Depends(get_current_user)
):
    """
    Reject a work order request.

    Requires a reason. Notifies the requester.
    """
    profile_id = get_profile_id(user)
    request = get_request_or_404(request_id)

    # Check access
    require_gear_house_access(request["gear_house_org_id"], profile_id, require_manager=True)

    # Check status
    if request["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot reject request with status '{request['status']}'")

    # Update request status
    execute_update(
        """
        UPDATE gear_work_order_requests
        SET
            status = 'rejected',
            reviewed_by = :reviewed_by,
            reviewed_at = NOW(),
            rejection_reason = :reason,
            updated_at = NOW()
        WHERE id = :id
        """,
        {
            "id": request_id,
            "reviewed_by": profile_id,
            "reason": data.reason,
        }
    )

    # Notify requester
    try:
        client = get_client()
        rejection_message = f"Your rental request '{request['title'] or request['reference_number']}' was rejected."
        if data.reason:
            rejection_message += f" Reason: {data.reason}"
        client.table("notifications").insert({
            "user_id": request["requesting_profile_id"],
            "type": "gear_request_rejected",
            "title": "Rental Request Rejected",
            "message": rejection_message,
            "data": {
                "request_id": request_id,
                "reason": data.reason,
            }
        }).execute()
    except Exception:
        pass  # Don't fail if notification fails

    return {
        "message": "Request rejected",
    }
