"""
Gear House Quotes API

Endpoints for marketplace quote request/response workflow and rental extensions.

Flow:
1. Renter creates a rental request (to specific rental house or marketplace-wide)
2. Rental house responds with a quote
3. Renter approves the quote
4. Quote converts to rental order + transaction
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

from app.services import gear_service

router = APIRouter(prefix="/quotes", tags=["Gear Quotes"])


# ============================================================================
# SCHEMAS
# ============================================================================

class RentalRequestItemCreate(BaseModel):
    """Item in a rental request."""
    asset_id: Optional[str] = None  # Specific asset
    listing_id: Optional[str] = None  # Marketplace listing
    category_id: Optional[str] = None  # Or category
    item_description: Optional[str] = None  # Or freeform
    quantity: int = 1
    notes: Optional[str] = None


class RentalRequestCreate(BaseModel):
    """Create a new rental request."""
    # Where to send
    rental_house_org_id: Optional[str] = None  # NULL = marketplace request

    # Project link (optional)
    backlot_project_id: Optional[str] = None
    project_name: Optional[str] = None

    # Budget integration
    budget_line_item_id: Optional[str] = None
    auto_create_budget_line: bool = False

    # Request details
    title: str
    description: Optional[str] = None

    # Dates
    rental_start_date: date
    rental_end_date: date

    # Delivery
    delivery_method: str = "pickup"  # pickup, local_delivery, shipping
    delivery_address: Optional[dict] = None
    delivery_notes: Optional[str] = None

    # Shipping (when delivery_method = 'shipping')
    shipping_address: Optional[dict] = None  # Full shipping address
    preferred_carrier: Optional[str] = None  # usps, ups, fedex
    preferred_service: Optional[str] = None  # ground, express, overnight

    # Items
    items: List[RentalRequestItemCreate]

    # Notes
    notes: Optional[str] = None


class QuoteItemCreate(BaseModel):
    """Quote item from rental house."""
    request_item_id: Optional[str] = None
    asset_id: Optional[str] = None
    listing_id: Optional[str] = None
    item_description: Optional[str] = None
    quantity: int = 1
    daily_rate: float
    rate_type: str = "daily"  # daily, weekly, flat
    line_total: float
    is_substitution: bool = False
    substitution_notes: Optional[str] = None
    notes: Optional[str] = None


class QuoteCreate(BaseModel):
    """Rental house response to a request."""
    rental_start_date: date
    rental_end_date: date
    items: List[QuoteItemCreate]

    # Pricing
    subtotal: float
    tax_amount: float = 0
    insurance_amount: float = 0
    delivery_fee: float = 0
    deposit_amount: float = 0
    total_amount: float

    # Shipping (if applicable)
    shipping_cost: Optional[float] = None
    return_shipping_cost: Optional[float] = None
    shipping_carrier: Optional[str] = None
    shipping_service: Optional[str] = None
    selected_rate_id: Optional[str] = None  # EasyPost rate ID

    # Terms
    payment_terms: Optional[str] = None
    cancellation_policy: Optional[str] = None
    insurance_requirements: Optional[str] = None
    damage_policy: Optional[str] = None

    # Validity
    valid_until: Optional[datetime] = None
    hold_inventory: bool = False

    # Notes
    notes: Optional[str] = None


class ExtensionRequest(BaseModel):
    """Request to extend a rental."""
    requested_end_date: date
    reason: Optional[str] = None


class ExtensionResponse(BaseModel):
    """Response to an extension request."""
    approved_end_date: Optional[date] = None
    additional_amount: Optional[float] = None
    daily_rate: Optional[float] = None
    denial_reason: Optional[str] = None


class RejectRequestInput(BaseModel):
    """Request to reject a rental request with optional reason."""
    reason: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def generate_request_number(org_id: str) -> str:
    """Generate a unique request number."""
    result = execute_single(
        """
        SELECT COUNT(*) + 1 as num
        FROM gear_rental_requests
        WHERE requesting_org_id = :org_id
        """,
        {"org_id": org_id}
    )
    num = result["num"] if result else 1
    return f"REQ-{num:05d}"


def generate_quote_number(org_id: str) -> str:
    """Generate a unique quote number."""
    result = execute_single(
        """
        SELECT COUNT(*) + 1 as num
        FROM gear_rental_quotes
        WHERE rental_house_org_id = :org_id
        """,
        {"org_id": org_id}
    )
    num = result["num"] if result else 1
    return f"Q-{num:05d}"


def generate_order_number(org_id: str) -> str:
    """Generate a unique order number."""
    result = execute_single(
        """
        SELECT COUNT(*) + 1 as num
        FROM gear_rental_orders
        WHERE rental_house_org_id = :org_id
        """,
        {"org_id": org_id}
    )
    num = result["num"] if result else 1
    return f"RO-{num:05d}"


async def validate_item_availability(
    asset_id: str,
    listing_id: str | None,
    start_date: date,
    end_date: date,
    org_id: str
) -> tuple[bool, str]:
    """
    Check if gear is available for requested dates.

    Checks:
    1. Asset status (must be available/reserved)
    2. Overlapping rental orders
    3. Overlapping internal checkouts
    4. Work order reservations (always for checked-out, conditionally for pre-checkout)
    5. Blackout dates

    Returns: (is_available, reason_if_not_available)
    """
    # Check asset status
    asset = execute_single(
        "SELECT status FROM gear_assets WHERE id = :asset_id",
        {"asset_id": asset_id}
    )

    if not asset:
        return (False, "Asset not found")

    # Only reject permanently unavailable assets
    # Allow checked_out/under_repair/in_transit if dates don't conflict (checked below)
    if asset["status"] in ("retired", "lost"):
        return (False, f"Asset is {asset.get('status', 'unavailable')}")

    # Check overlapping rental orders
    overlapping = execute_single(
        """
        SELECT COUNT(*) as count
        FROM gear_rental_orders ro
        JOIN gear_rental_order_items roi ON roi.order_id = ro.id
        WHERE roi.asset_id = :asset_id
          AND ro.status IN ('confirmed', 'building', 'packed',
                           'ready_for_pickup', 'picked_up', 'in_use')
          AND ro.rental_start_date <= :end_date
          AND ro.rental_end_date >= :start_date
        """,
        {"asset_id": asset_id, "start_date": start_date, "end_date": end_date}
    )

    if overlapping and overlapping["count"] > 0:
        return (False, "Already rented for these dates")

    # Check overlapping internal checkouts
    internal_checkout = execute_single(
        """
        SELECT COUNT(*) as count
        FROM gear_transactions gt
        JOIN gear_transaction_items gti ON gti.transaction_id = gt.id
        WHERE gti.asset_id = :asset_id
          AND gt.organization_id = :org_id
          AND gt.transaction_type = 'internal_checkout'
          AND gt.status IN ('pending', 'in_progress')
          AND gt.returned_at IS NULL
          AND gt.scheduled_at IS NOT NULL
          AND gt.expected_return_at IS NOT NULL
          AND DATE(gt.scheduled_at) <= :end_date
          AND DATE(gt.expected_return_at) >= :start_date
        """,
        {"asset_id": asset_id, "org_id": org_id, "start_date": start_date, "end_date": end_date}
    )

    if internal_checkout and internal_checkout["count"] > 0:
        return (False, "Internal checkout scheduled for these dates")

    # Check work orders
    # ALWAYS blocks checked-out work orders (asset physically with custodian)
    # Conditionally blocks pre-checkout work orders based on rental house setting
    settings = execute_single(
        "SELECT work_order_reserves_dates FROM gear_marketplace_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    reserves_dates = settings.get("work_order_reserves_dates", False) if settings else False

    wo_overlap = execute_single(
        """
        SELECT COUNT(*) as count
        FROM gear_work_orders wo
        JOIN gear_work_order_items woi ON woi.work_order_id = wo.id
        WHERE woi.asset_id = :asset_id
          AND wo.organization_id = :org_id
          AND wo.expected_return_date IS NOT NULL
          AND wo.pickup_date <= :end_date
          AND wo.expected_return_date >= :start_date
          AND (
            -- Always block checked-out work orders (mandatory)
            wo.status = 'checked_out'
            OR
            -- Conditionally block pre-checkout work orders (optional, rental house setting)
            (wo.status IN ('in_progress', 'ready') AND :reserves_dates = TRUE)
          )
        """,
        {"asset_id": asset_id, "org_id": org_id, "start_date": start_date, "end_date": end_date, "reserves_dates": reserves_dates}
    )

    if wo_overlap and wo_overlap["count"] > 0:
        return (False, "Reserved for work order")

    # Check blackout dates
    if listing_id:
        listing = execute_single(
            "SELECT blackout_dates FROM gear_marketplace_listings WHERE id = :id",
            {"id": listing_id}
        )

        if listing:
            blackout_dates = listing.get("blackout_dates", []) or []
            for bd in blackout_dates:
                if bd.get("start") and bd.get("end"):
                    try:
                        bd_start = datetime.strptime(bd["start"], "%Y-%m-%d").date()
                        bd_end = datetime.strptime(bd["end"], "%Y-%m-%d").date()
                        if bd_start <= end_date and bd_end >= start_date:
                            return (False, "Blackout period")
                    except (ValueError, TypeError):
                        continue

    return (True, "")


# ============================================================================
# RENTAL REQUEST ENDPOINTS (Renter Side)
# ============================================================================

@router.post("/request")
async def create_rental_request(
    data: RentalRequestCreate,
    user=Depends(get_current_user)
):
    """
    Create a new rental request.

    Can be sent to a specific rental house or posted to the marketplace.
    """
    profile_id = get_profile_id(user)

    # Get user's organization
    user_org = execute_single(
        """
        SELECT organization_id FROM organization_members
        WHERE user_id = :user_id AND status = 'active'
        ORDER BY role = 'owner' DESC, role = 'admin' DESC
        LIMIT 1
        """,
        {"user_id": profile_id}
    )

    if not user_org:
        raise HTTPException(status_code=400, detail="You must belong to an organization to create rental requests")

    org_id = user_org["organization_id"]

    # Validate items
    if not data.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    # Validate availability for items with specific assets
    validated_items = []
    unavailable_items = []

    for item_data in data.items:
        if item_data.asset_id:
            # Get the rental house org_id - either from request or from asset's owner
            rental_house_id = data.rental_house_org_id
            if not rental_house_id:
                # Get asset's organization
                asset_org = execute_single(
                    "SELECT organization_id FROM gear_assets WHERE id = :asset_id",
                    {"asset_id": item_data.asset_id}
                )
                if asset_org:
                    rental_house_id = asset_org["organization_id"]

            if rental_house_id:
                is_available, reason = await validate_item_availability(
                    asset_id=item_data.asset_id,
                    listing_id=item_data.listing_id,
                    start_date=data.rental_start_date,
                    end_date=data.rental_end_date,
                    org_id=rental_house_id
                )

                if is_available:
                    validated_items.append(item_data)
                else:
                    unavailable_items.append({
                        "asset_id": item_data.asset_id,
                        "listing_id": item_data.listing_id,
                        "reason": reason
                    })
            else:
                validated_items.append(item_data)
        else:
            # Category requests always pass
            validated_items.append(item_data)

    # If NO items available, reject entirely
    if not validated_items:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "No items are available for the requested dates",
                "unavailable_items": unavailable_items
            }
        )

    try:
        request_number = generate_request_number(org_id)

        # Create the rental request
        request = execute_insert(
            """
            INSERT INTO gear_rental_requests (
                requesting_org_id,
                rental_house_org_id,
                backlot_project_id,
                project_name,
                request_number,
                title,
                description,
                rental_start_date,
                rental_end_date,
                delivery_address,
                delivery_notes,
                status,
                requested_by_user_id,
                notes
            ) VALUES (
                :requesting_org_id,
                :rental_house_org_id,
                :backlot_project_id,
                :project_name,
                :request_number,
                :title,
                :description,
                :rental_start_date,
                :rental_end_date,
                :delivery_address,
                :delivery_notes,
                'submitted',
                :requested_by,
                :notes
            )
            RETURNING *
            """,
            {
                "requesting_org_id": org_id,
                "rental_house_org_id": data.rental_house_org_id,
                "backlot_project_id": data.backlot_project_id,
                "project_name": data.project_name,
                "request_number": request_number,
                "title": data.title,
                "description": data.description,
                "rental_start_date": data.rental_start_date,
                "rental_end_date": data.rental_end_date,
                "delivery_address": data.delivery_address,
                "delivery_notes": data.delivery_notes,
                "requested_by": profile_id,
                "notes": data.notes
            }
        )

        request_id = request["id"]

        # Create request items (using validated items only)
        created_items = []
        for idx, item in enumerate(validated_items):
            created_item = execute_insert(
                """
                INSERT INTO gear_rental_request_items (
                    request_id,
                    asset_id,
                    category_id,
                    item_description,
                    quantity,
                    notes,
                    sort_order
                ) VALUES (
                    :request_id,
                    :asset_id,
                    :category_id,
                    :item_description,
                    :quantity,
                    :notes,
                    :sort_order
                )
                RETURNING *
                """,
                {
                    "request_id": request_id,
                    "asset_id": item.asset_id,
                    "category_id": item.category_id,
                    "item_description": item.item_description,
                    "quantity": item.quantity,
                    "notes": item.notes,
                    "sort_order": idx
                }
            )
            created_items.append(created_item)

        # Store budget integration info if provided
        if data.budget_line_item_id or data.auto_create_budget_line:
            execute_update(
                """
                UPDATE gear_rental_requests
                SET budget_line_item_id = :budget_line_item_id,
                    auto_create_budget_line = :auto_create_budget_line
                WHERE id = :id
                """,
                {
                    "id": request_id,
                    "budget_line_item_id": data.budget_line_item_id,
                    "auto_create_budget_line": data.auto_create_budget_line
                }
            )

        # Build response with warning if items were removed
        response = {"request": request, "items": created_items}

        if unavailable_items:
            response["warning"] = {
                "message": f"{len(unavailable_items)} item(s) were unavailable and removed from your request",
                "unavailable_items": unavailable_items,
                "items_kept": len(validated_items)
            }

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create request: {str(e)}")


@router.get("/my-requests")
async def list_my_requests(
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List rental requests created by the user's organization."""
    profile_id = get_profile_id(user)

    # Get user's organization(s)
    user_orgs = execute_query(
        """
        SELECT organization_id FROM organization_members
        WHERE user_id = :user_id AND status = 'active'
        """,
        {"user_id": profile_id}
    )

    if not user_orgs:
        return {"requests": [], "total": 0}

    org_ids = [o["organization_id"] for o in user_orgs]

    params: Dict[str, Any] = {"limit": limit, "offset": offset}
    conditions = ["r.requesting_org_id = ANY(:org_ids)"]
    params["org_ids"] = org_ids

    if status:
        conditions.append("r.status = :status")
        params["status"] = status

    where_clause = " AND ".join(conditions)

    requests = execute_query(
        f"""
        SELECT
            r.*,
            rental_house.name as rental_house_name,
            requester.display_name as requested_by_name,
            (SELECT COUNT(*) FROM gear_rental_request_items WHERE request_id = r.id) as item_count,
            (SELECT COUNT(*) FROM gear_rental_quotes WHERE request_id = r.id) as quote_count
        FROM gear_rental_requests r
        LEFT JOIN organizations rental_house ON rental_house.id = r.rental_house_org_id
        LEFT JOIN profiles requester ON requester.id = r.requested_by_user_id
        WHERE {where_clause}
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    count_result = execute_single(
        f"""
        SELECT COUNT(*) as total
        FROM gear_rental_requests r
        WHERE {where_clause}
        """,
        params
    )

    return {
        "requests": requests,
        "total": count_result["total"] if count_result else 0
    }


@router.get("/request/{request_id}")
async def get_request(
    request_id: str,
    user=Depends(get_current_user)
):
    """Get a rental request with items and quotes."""
    profile_id = get_profile_id(user)

    request = execute_single(
        """
        SELECT
            r.*,
            requesting_org.name as requesting_org_name,
            rental_house.name as rental_house_name,
            requester.display_name as requested_by_name
        FROM gear_rental_requests r
        LEFT JOIN organizations requesting_org ON requesting_org.id = r.requesting_org_id
        LEFT JOIN organizations rental_house ON rental_house.id = r.rental_house_org_id
        LEFT JOIN profiles requester ON requester.id = r.requested_by_user_id
        WHERE r.id = :request_id
        """,
        {"request_id": request_id}
    )

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify access (must be from requesting or rental house org)
    user_orgs = execute_query(
        """
        SELECT organization_id FROM organization_members
        WHERE user_id = :user_id AND status = 'active'
        """,
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if request["requesting_org_id"] not in user_org_ids and request.get("rental_house_org_id") not in user_org_ids:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get items
    items = execute_query(
        """
        SELECT
            ri.*,
            a.name as asset_name,
            a.internal_id as asset_internal_id,
            c.name as category_name
        FROM gear_rental_request_items ri
        LEFT JOIN gear_assets a ON a.id = ri.asset_id
        LEFT JOIN gear_categories c ON c.id = ri.category_id
        WHERE ri.request_id = :request_id
        ORDER BY ri.sort_order
        """,
        {"request_id": request_id}
    )

    # Get quotes
    quotes = execute_query(
        """
        SELECT
            q.*,
            prepared_by.display_name as prepared_by_name
        FROM gear_rental_quotes q
        LEFT JOIN profiles prepared_by ON prepared_by.id = q.prepared_by_user_id
        WHERE q.request_id = :request_id
        ORDER BY q.created_at DESC
        """,
        {"request_id": request_id}
    )

    request["items"] = items
    request["quotes"] = quotes

    return {"request": request}


@router.post("/request/{request_id}/cancel")
async def cancel_request(
    request_id: str,
    user=Depends(get_current_user)
):
    """Cancel a rental request."""
    profile_id = get_profile_id(user)

    request = execute_single(
        "SELECT * FROM gear_rental_requests WHERE id = :id",
        {"id": request_id}
    )

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify ownership
    user_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND status = 'active'",
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if request["requesting_org_id"] not in user_org_ids:
        raise HTTPException(status_code=403, detail="Only the requesting organization can cancel")

    if request["status"] in ("converted", "cancelled"):
        raise HTTPException(status_code=400, detail="Request cannot be cancelled")

    execute_query(
        "UPDATE gear_rental_requests SET status = 'cancelled', updated_at = NOW() WHERE id = :id",
        {"id": request_id}
    )

    return {"success": True, "message": "Request cancelled"}


@router.post("/request/{request_id}/reject")
async def reject_request(
    request_id: str,
    data: RejectRequestInput,
    user=Depends(get_current_user)
):
    """Reject a rental request (rental house side)."""
    profile_id = get_profile_id(user)

    request = execute_single(
        "SELECT * FROM gear_rental_requests WHERE id = :id",
        {"id": request_id}
    )

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Verify rental house access
    if not request["rental_house_org_id"]:
        raise HTTPException(status_code=400, detail="Request has no rental house assigned")

    user_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND status = 'active'",
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if request["rental_house_org_id"] not in user_org_ids:
        raise HTTPException(status_code=403, detail="Only the rental house can reject this request")

    if request["status"] in ("converted", "cancelled", "rejected"):
        raise HTTPException(status_code=400, detail="Request cannot be rejected")

    # Update request status
    if data.reason:
        # Update with rejection reason
        current_notes = request.get("notes", "")
        new_notes = f"{current_notes}\n\nRejection reason: {data.reason}" if current_notes else f"Rejection reason: {data.reason}"
        execute_update(
            """
            UPDATE gear_rental_requests
            SET status = 'rejected', notes = :notes, updated_at = NOW()
            WHERE id = :id
            """,
            {"id": request_id, "notes": new_notes}
        )
    else:
        # Update without reason
        execute_update(
            "UPDATE gear_rental_requests SET status = 'rejected', updated_at = NOW() WHERE id = :id",
            {"id": request_id}
        )

    # Create notification for requester
    try:
        from app.core.database import get_client
        client = get_client()

        notification_message = f"Your rental request '{request.get('title', 'Request')}' has been rejected"
        if data.reason:
            notification_message += f": {data.reason}"

        client.table("notifications").insert({
            "user_id": request["requested_by_user_id"],
            "type": "gear_request_rejected",
            "title": "Rental Request Rejected",
            "message": notification_message,
            "data": {
                "request_id": request_id,
                "reason": data.reason,
            }
        }).execute()
    except Exception:
        pass  # Don't fail if notification fails

    return {"success": True, "message": "Request rejected"}


# ============================================================================
# QUOTE MANAGEMENT ENDPOINTS (Rental House Side)
# ============================================================================

@router.get("/{org_id}/incoming")
async def list_incoming_requests(
    org_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List incoming rental requests for a rental house."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    params: Dict[str, Any] = {"org_id": org_id, "limit": limit, "offset": offset}
    conditions = ["(r.rental_house_org_id = :org_id OR r.rental_house_org_id IS NULL)"]

    if status:
        conditions.append("r.status = :status")
        params["status"] = status
    else:
        # Default to actionable statuses
        conditions.append("r.status IN ('submitted', 'quoted')")

    where_clause = " AND ".join(conditions)

    requests = execute_query(
        f"""
        SELECT
            r.*,
            requesting_org.name as requesting_org_name,
            requester.display_name as requested_by_name,
            (SELECT COUNT(*) FROM gear_rental_request_items WHERE request_id = r.id) as item_count,
            (SELECT id FROM gear_rental_quotes WHERE request_id = r.id AND rental_house_org_id = :org_id ORDER BY created_at DESC LIMIT 1) as my_quote_id
        FROM gear_rental_requests r
        JOIN organizations requesting_org ON requesting_org.id = r.requesting_org_id
        LEFT JOIN profiles requester ON requester.id = r.requested_by_user_id
        WHERE {where_clause}
        ORDER BY r.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"requests": requests}


@router.post("/{org_id}/quote/{request_id}")
async def create_quote(
    org_id: str,
    request_id: str,
    data: QuoteCreate,
    user=Depends(get_current_user)
):
    """Create a quote in response to a rental request."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Get the request
    request = execute_single(
        "SELECT * FROM gear_rental_requests WHERE id = :id",
        {"id": request_id}
    )

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request["status"] in ("cancelled", "converted"):
        raise HTTPException(status_code=400, detail="Request is no longer accepting quotes")

    # Validate items
    if not data.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    try:
        quote_number = generate_quote_number(org_id)

        # Create the quote
        quote = execute_insert(
            """
            INSERT INTO gear_rental_quotes (
                request_id,
                rental_house_org_id,
                quote_number,
                rental_start_date,
                rental_end_date,
                subtotal,
                tax_amount,
                insurance_amount,
                delivery_fee,
                deposit_amount,
                total_amount,
                payment_terms,
                cancellation_policy,
                insurance_requirements,
                damage_policy,
                valid_until,
                inventory_held,
                status,
                prepared_by_user_id,
                notes
            ) VALUES (
                :request_id,
                :org_id,
                :quote_number,
                :rental_start_date,
                :rental_end_date,
                :subtotal,
                :tax_amount,
                :insurance_amount,
                :delivery_fee,
                :deposit_amount,
                :total_amount,
                :payment_terms,
                :cancellation_policy,
                :insurance_requirements,
                :damage_policy,
                :valid_until,
                :inventory_held,
                'sent',
                :prepared_by,
                :notes
            )
            RETURNING *
            """,
            {
                "request_id": request_id,
                "org_id": org_id,
                "quote_number": quote_number,
                "rental_start_date": data.rental_start_date,
                "rental_end_date": data.rental_end_date,
                "subtotal": data.subtotal,
                "tax_amount": data.tax_amount,
                "insurance_amount": data.insurance_amount,
                "delivery_fee": data.delivery_fee,
                "deposit_amount": data.deposit_amount,
                "total_amount": data.total_amount,
                "payment_terms": data.payment_terms,
                "cancellation_policy": data.cancellation_policy,
                "insurance_requirements": data.insurance_requirements,
                "damage_policy": data.damage_policy,
                "valid_until": data.valid_until,
                "inventory_held": data.hold_inventory,
                "prepared_by": profile_id,
                "notes": data.notes
            }
        )

        quote_id = quote["id"]

        # Create quote items
        for idx, item in enumerate(data.items):
            execute_insert(
                """
                INSERT INTO gear_rental_quote_items (
                    quote_id,
                    request_item_id,
                    asset_id,
                    item_description,
                    quantity,
                    daily_rate,
                    rate_type,
                    quoted_rate,
                    line_total,
                    is_substitution,
                    substitution_notes,
                    notes,
                    sort_order
                ) VALUES (
                    :quote_id,
                    :request_item_id,
                    :asset_id,
                    :item_description,
                    :quantity,
                    :daily_rate,
                    :rate_type,
                    :daily_rate,
                    :line_total,
                    :is_substitution,
                    :substitution_notes,
                    :notes,
                    :sort_order
                )
                """,
                {
                    "quote_id": quote_id,
                    "request_item_id": item.request_item_id,
                    "asset_id": item.asset_id,
                    "item_description": item.item_description,
                    "quantity": item.quantity,
                    "daily_rate": item.daily_rate,
                    "rate_type": item.rate_type,
                    "line_total": item.line_total,
                    "is_substitution": item.is_substitution,
                    "substitution_notes": item.substitution_notes,
                    "notes": item.notes,
                    "sort_order": idx
                }
            )

        # Update request status
        execute_query(
            "UPDATE gear_rental_requests SET status = 'quoted', updated_at = NOW() WHERE id = :id",
            {"id": request_id}
        )

        return {"quote": quote}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create quote: {str(e)}")


@router.get("/quote/{quote_id}")
async def get_quote(
    quote_id: str,
    user=Depends(get_current_user)
):
    """Get quote details with items."""
    profile_id = get_profile_id(user)

    quote = execute_single(
        """
        SELECT
            q.*,
            rental_house.name as rental_house_name,
            rental_house.logo_url as rental_house_logo,
            prepared_by.display_name as prepared_by_name,
            r.title as request_title,
            r.requesting_org_id,
            requesting_org.name as requesting_org_name
        FROM gear_rental_quotes q
        JOIN organizations rental_house ON rental_house.id = q.rental_house_org_id
        LEFT JOIN profiles prepared_by ON prepared_by.id = q.prepared_by_user_id
        LEFT JOIN gear_rental_requests r ON r.id = q.request_id
        LEFT JOIN organizations requesting_org ON requesting_org.id = r.requesting_org_id
        WHERE q.id = :quote_id
        """,
        {"quote_id": quote_id}
    )

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Verify access
    user_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND status = 'active'",
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if quote["rental_house_org_id"] not in user_org_ids and quote.get("requesting_org_id") not in user_org_ids:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get items
    items = execute_query(
        """
        SELECT
            qi.*,
            a.name as asset_name,
            a.internal_id as asset_internal_id,
            a.photos as asset_photos
        FROM gear_rental_quote_items qi
        LEFT JOIN gear_assets a ON a.id = qi.asset_id
        WHERE qi.quote_id = :quote_id
        ORDER BY qi.sort_order
        """,
        {"quote_id": quote_id}
    )

    quote["items"] = items

    return {"quote": quote}


@router.post("/quote/{quote_id}/approve")
async def approve_quote(
    quote_id: str,
    payment_method: Optional[str] = Query(None, description="stripe or invoice"),
    create_work_order: bool = Query(True, description="Auto-create work order for staging"),
    user=Depends(get_current_user)
):
    """Approve a quote (renter side). Creates rental order, work order (optional), and backlot gear items."""
    profile_id = get_profile_id(user)

    quote = execute_single(
        """
        SELECT q.*, r.requesting_org_id, r.backlot_project_id, r.delivery_address,
               r.budget_line_item_id, r.auto_create_budget_line
        FROM gear_rental_quotes q
        JOIN gear_rental_requests r ON r.id = q.request_id
        WHERE q.id = :quote_id
        """,
        {"quote_id": quote_id}
    )

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Verify ownership
    user_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND status = 'active'",
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if quote["requesting_org_id"] not in user_org_ids:
        raise HTTPException(status_code=403, detail="Only the requesting organization can approve")

    if quote["status"] != "sent":
        raise HTTPException(status_code=400, detail=f"Quote cannot be approved (status: {quote['status']})")

    # Check validity
    if quote.get("valid_until") and quote["valid_until"] < datetime.now():
        raise HTTPException(status_code=400, detail="Quote has expired")

    try:
        # Update quote status
        execute_query(
            """
            UPDATE gear_rental_quotes
            SET status = 'approved', approved_at = NOW(), approved_by_user_id = :user_id
            WHERE id = :quote_id
            """,
            {"quote_id": quote_id, "user_id": profile_id}
        )

        # Create rental order
        order_number = generate_order_number(quote["rental_house_org_id"])

        order = execute_insert(
            """
            INSERT INTO gear_rental_orders (
                quote_id,
                rental_house_org_id,
                client_org_id,
                backlot_project_id,
                order_number,
                rental_start_date,
                rental_end_date,
                delivery_address,
                subtotal,
                tax_amount,
                insurance_amount,
                delivery_fee,
                total_amount,
                status,
                created_by_user_id
            ) VALUES (
                :quote_id,
                :rental_house_org_id,
                :client_org_id,
                :backlot_project_id,
                :order_number,
                :rental_start_date,
                :rental_end_date,
                :delivery_address,
                :subtotal,
                :tax_amount,
                :insurance_amount,
                :delivery_fee,
                :total_amount,
                'confirmed',
                :created_by
            )
            RETURNING *
            """,
            {
                "quote_id": quote_id,
                "rental_house_org_id": quote["rental_house_org_id"],
                "client_org_id": quote["requesting_org_id"],
                "backlot_project_id": quote.get("backlot_project_id"),
                "order_number": order_number,
                "rental_start_date": quote["rental_start_date"],
                "rental_end_date": quote["rental_end_date"],
                "delivery_address": quote.get("delivery_address"),
                "subtotal": quote.get("subtotal"),
                "tax_amount": quote.get("tax_amount"),
                "insurance_amount": quote.get("insurance_amount"),
                "delivery_fee": quote.get("delivery_fee"),
                "total_amount": quote.get("total_amount"),
                "created_by": profile_id
            }
        )

        order_id = order["id"]

        # Copy quote items to order items AND create backlot gear items
        quote_items = execute_query(
            "SELECT * FROM gear_rental_quote_items WHERE quote_id = :quote_id ORDER BY sort_order",
            {"quote_id": quote_id}
        )

        created_gear_items = []

        for item in quote_items:
            # Create rental order item
            order_item = execute_insert(
                """
                INSERT INTO gear_rental_order_items (
                    order_id,
                    quote_item_id,
                    asset_id,
                    item_description,
                    quantity,
                    quoted_rate,
                    line_total,
                    sort_order
                ) VALUES (
                    :order_id,
                    :quote_item_id,
                    :asset_id,
                    :item_description,
                    :quantity,
                    :quoted_rate,
                    :line_total,
                    :sort_order
                )
                RETURNING *
                """,
                {
                    "order_id": order_id,
                    "quote_item_id": item["id"],
                    "asset_id": item.get("asset_id"),
                    "item_description": item.get("item_description"),
                    "quantity": item.get("quantity", 1),
                    "quoted_rate": item.get("quoted_rate"),
                    "line_total": item.get("line_total"),
                    "sort_order": item.get("sort_order", 0)
                }
            )

            # Create backlot gear item if project linked
            if quote.get("backlot_project_id"):
                # Fetch asset details for naming
                asset = None
                if item.get("asset_id"):
                    asset = execute_single(
                        "SELECT * FROM gear_assets WHERE id = :id",
                        {"id": item["asset_id"]}
                    )

                # Get rental house org name
                org = execute_single(
                    "SELECT name FROM organizations WHERE id = :id",
                    {"id": quote["rental_house_org_id"]}
                )

                gear_item_name = asset["name"] if asset else item.get("item_description", "Rental Item")

                # Calculate weekly/monthly rates from quoted_rate based on rate_type
                # rate_type comes from the quote item, not the order item
                daily_rate = item.get("quoted_rate", 0)
                rate_type = item.get("rate_type", "daily")

                if rate_type == "weekly":
                    weekly_rate = daily_rate
                    monthly_rate = daily_rate * 4.3  # ~4.3 weeks per month
                    daily_equiv = daily_rate / 7
                elif rate_type == "monthly":
                    monthly_rate = daily_rate
                    weekly_rate = daily_rate / 4.3
                    daily_equiv = daily_rate / 30
                else:  # daily
                    daily_equiv = daily_rate
                    weekly_rate = daily_rate * 7 * 0.85  # 15% weekly discount
                    monthly_rate = daily_rate * 30 * 0.75  # 25% monthly discount

                gear_item = execute_insert(
                    """
                    INSERT INTO backlot_gear_items (
                        project_id, name, category, description,
                        is_owned, rental_house,
                        rental_cost_per_day, rental_rate_type,
                        rental_weekly_rate, rental_monthly_rate,
                        pickup_date, return_date,
                        status, gear_rental_order_item_id,
                        serial_number, notes
                    )
                    VALUES (
                        :project_id, :name, :category, :description,
                        FALSE, :rental_house,
                        :daily_rate, :rate_type,
                        :weekly_rate, :monthly_rate,
                        :pickup_date, :return_date,
                        'reserved', :order_item_id,
                        :serial_number, :notes
                    )
                    RETURNING *
                    """,
                    {
                        "project_id": quote["backlot_project_id"],
                        "name": gear_item_name,
                        "category": asset.get("category_id") if asset else None,
                        "description": item.get("item_description"),
                        "rental_house": org.get("name") if org else "Rental House",
                        "daily_rate": daily_equiv,
                        "rate_type": rate_type,
                        "weekly_rate": weekly_rate,
                        "monthly_rate": monthly_rate,
                        "pickup_date": quote["rental_start_date"],
                        "return_date": quote["rental_end_date"],
                        "order_item_id": order_item["id"],
                        "serial_number": asset.get("serial_number") if asset else None,
                        "notes": f"Rental Order: {order_number}",
                    }
                )

                # Update reverse link
                execute_query(
                    """
                    UPDATE gear_rental_order_items
                    SET backlot_gear_item_id = :gear_id
                    WHERE id = :item_id
                    """,
                    {"gear_id": gear_item["id"], "item_id": order_item["id"]}
                )

                created_gear_items.append(gear_item)

        # Update request status
        execute_query(
            "UPDATE gear_rental_requests SET status = 'converted', updated_at = NOW() WHERE id = :id",
            {"id": quote["request_id"]}
        )

        # Auto-create work order if requested
        work_order = None
        if create_work_order:
            work_order = execute_insert(
                """
                INSERT INTO gear_work_orders (
                    organization_id, gear_rental_order_id,
                    title, notes, status,
                    created_by, backlot_project_id,
                    pickup_date, expected_return_date
                )
                VALUES (
                    :org_id, :order_id,
                    :title, :notes, 'draft',
                    :created_by, :project_id,
                    :pickup_date, :return_date
                )
                RETURNING *
                """,
                {
                    "org_id": quote["rental_house_org_id"],
                    "order_id": order["id"],
                    "title": f"Rental Order {order_number}",
                    "notes": f"Prepare equipment for rental order {order_number}",
                    "created_by": profile_id,
                    "project_id": quote.get("backlot_project_id"),
                    "pickup_date": quote["rental_start_date"],
                    "return_date": quote["rental_end_date"],
                }
            )

            # Add items to work order
            for item in quote_items:
                if item.get("asset_id"):
                    execute_insert(
                        """
                        INSERT INTO gear_work_order_items (
                            work_order_id, asset_id, quantity, notes
                        )
                        VALUES (:wo_id, :asset_id, :quantity, :notes)
                        """,
                        {
                            "wo_id": work_order["id"],
                            "asset_id": item["asset_id"],
                            "quantity": item.get("quantity", 1),
                            "notes": item.get("item_description"),
                        }
                    )

        # Sync rental to budget if configured
        if quote.get("backlot_project_id") and created_gear_items:
            await _sync_rental_to_budget(
                project_id=quote["backlot_project_id"],
                gear_items=created_gear_items,
                order=order
            )
        elif quote.get("auto_create_budget_line") and quote.get("backlot_project_id"):
            # Fallback: old budget integration (single line item)
            execute_insert(
                """
                INSERT INTO backlot_budget_line_items (
                    project_id,
                    category,
                    sub_category,
                    description,
                    estimated_cost,
                    actual_cost,
                    notes
                ) VALUES (
                    :project_id,
                    'Equipment Rentals',
                    'Camera/Lighting',
                    :description,
                    :cost,
                    0,
                    :notes
                )
                RETURNING id
                """,
                {
                    "project_id": quote["backlot_project_id"],
                    "description": f"Rental: {order_number}",
                    "cost": quote.get("total_amount", 0),
                    "notes": f"Auto-created from gear rental order {order_number}"
                }
            )

        return {
            "success": True,
            "order": order,
            "work_order": work_order,
            "gear_items_created": len(created_gear_items),
            "message": f"Quote approved. Rental order {order_number} created."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve quote: {str(e)}")


async def _sync_rental_to_budget(project_id: str, gear_items: List[Dict[str, Any]], order: Dict[str, Any]):
    """Sync rental gear items to budget line items."""
    # Check if project has active budget
    budget = execute_single(
        """
        SELECT id FROM backlot_budgets
        WHERE project_id = :project_id AND is_active = TRUE
        LIMIT 1
        """,
        {"project_id": project_id}
    )

    if not budget:
        # No active budget, create individual line items without budget_id
        for item in gear_items:
            # Calculate total cost based on rental period
            rental_days = (order["rental_end_date"] - order["rental_start_date"]).days + 1
            total_cost = item["rental_cost_per_day"] * rental_days

            execute_insert(
                """
                INSERT INTO backlot_budget_line_items (
                    project_id,
                    category,
                    sub_category,
                    description,
                    estimated_cost,
                    actual_cost,
                    notes
                ) VALUES (
                    :project_id,
                    'Equipment Rentals',
                    :sub_category,
                    :description,
                    :cost,
                    0,
                    :notes
                )
                """,
                {
                    "project_id": project_id,
                    "sub_category": item.get("category") or "General",
                    "description": f"{item['name']} - Rental",
                    "cost": total_cost,
                    "notes": f"Auto-synced from rental order {order['order_number']}. "
                            f"{rental_days} days @ ${item['rental_cost_per_day']}/day"
                }
            )
    else:
        # Active budget exists, create line items with budget_id
        for item in gear_items:
            rental_days = (order["rental_end_date"] - order["rental_start_date"]).days + 1
            total_cost = item["rental_cost_per_day"] * rental_days

            # Use upsert logic in case the budget system supports source tracking
            execute_query(
                """
                INSERT INTO backlot_budget_line_items (
                    budget_id,
                    project_id,
                    category,
                    sub_category,
                    description,
                    estimated_cost,
                    actual_cost,
                    notes
                ) VALUES (
                    :budget_id,
                    :project_id,
                    'Equipment Rentals',
                    :sub_category,
                    :description,
                    :cost,
                    0,
                    :notes
                )
                """,
                {
                    "budget_id": budget["id"],
                    "project_id": project_id,
                    "sub_category": item.get("category") or "General",
                    "description": f"{item['name']} - Rental",
                    "cost": total_cost,
                    "notes": f"Auto-synced from rental order {order['order_number']}. "
                            f"{rental_days} days @ ${item['rental_cost_per_day']}/day. "
                            f"Weekly rate: ${item.get('rental_weekly_rate', 0)}, "
                            f"Monthly rate: ${item.get('rental_monthly_rate', 0)}"
                }
            )


@router.post("/quote/{quote_id}/reject")
async def reject_quote(
    quote_id: str,
    reason: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Reject a quote (renter side)."""
    profile_id = get_profile_id(user)

    quote = execute_single(
        """
        SELECT q.*, r.requesting_org_id
        FROM gear_rental_quotes q
        JOIN gear_rental_requests r ON r.id = q.request_id
        WHERE q.id = :quote_id
        """,
        {"quote_id": quote_id}
    )

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Verify ownership
    user_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND status = 'active'",
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if quote["requesting_org_id"] not in user_org_ids:
        raise HTTPException(status_code=403, detail="Only the requesting organization can reject")

    if quote["status"] != "sent":
        raise HTTPException(status_code=400, detail=f"Quote cannot be rejected (status: {quote['status']})")

    execute_query(
        """
        UPDATE gear_rental_quotes
        SET status = 'rejected', rejection_reason = :reason, updated_at = NOW()
        WHERE id = :quote_id
        """,
        {"quote_id": quote_id, "reason": reason}
    )

    return {"success": True, "message": "Quote rejected"}


# ============================================================================
# EXTENSION ENDPOINTS
# ============================================================================

@router.post("/extension/{transaction_id}")
async def request_extension(
    transaction_id: str,
    data: ExtensionRequest,
    user=Depends(get_current_user)
):
    """Request an extension for an active rental."""
    profile_id = get_profile_id(user)

    # Get the transaction
    tx = execute_single(
        """
        SELECT t.*, ro.rental_end_date, ms.extension_policy, ms.auto_extend_max_days
        FROM gear_transactions t
        LEFT JOIN gear_rental_orders ro ON ro.id = t.rental_order_id
        LEFT JOIN gear_marketplace_settings ms ON ms.organization_id = t.organization_id
        WHERE t.id = :tx_id
        """,
        {"tx_id": transaction_id}
    )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Calculate additional days
    original_end_date = tx.get("rental_end_date") or tx.get("expected_return_at")
    if not original_end_date:
        raise HTTPException(status_code=400, detail="Transaction has no return date")

    if isinstance(original_end_date, datetime):
        original_end_date = original_end_date.date()

    additional_days = (data.requested_end_date - original_end_date).days

    if additional_days <= 0:
        raise HTTPException(status_code=400, detail="Requested end date must be after current end date")

    # Determine extension type from rental house policy
    extension_policy = tx.get("extension_policy", "request_approve")

    # Check for auto-extend eligibility
    status = "pending"
    approved_end_date = None

    if extension_policy == "auto_extend":
        max_auto_days = tx.get("auto_extend_max_days", 3)
        if additional_days <= max_auto_days:
            status = "auto_approved"
            approved_end_date = data.requested_end_date

    # Create extension request
    extension = execute_insert(
        """
        INSERT INTO gear_rental_extensions (
            transaction_id,
            order_id,
            original_end_date,
            requested_end_date,
            approved_end_date,
            status,
            extension_type,
            additional_days,
            requested_by,
            reason
        ) VALUES (
            :tx_id,
            :order_id,
            :original_end_date,
            :requested_end_date,
            :approved_end_date,
            :status,
            :extension_type,
            :additional_days,
            :requested_by,
            :reason
        )
        RETURNING *
        """,
        {
            "tx_id": transaction_id,
            "order_id": tx.get("rental_order_id"),
            "original_end_date": original_end_date,
            "requested_end_date": data.requested_end_date,
            "approved_end_date": approved_end_date,
            "status": status,
            "extension_type": extension_policy,
            "additional_days": additional_days,
            "requested_by": profile_id,
            "reason": data.reason
        }
    )

    # If auto-approved, update the transaction
    if status == "auto_approved":
        execute_query(
            """
            UPDATE gear_transactions
            SET expected_return_at = :new_date, updated_at = NOW()
            WHERE id = :tx_id
            """,
            {"tx_id": transaction_id, "new_date": data.requested_end_date}
        )

        if tx.get("rental_order_id"):
            execute_query(
                """
                UPDATE gear_rental_orders
                SET rental_end_date = :new_date, updated_at = NOW()
                WHERE id = :order_id
                """,
                {"order_id": tx["rental_order_id"], "new_date": data.requested_end_date}
            )

    return {
        "extension": extension,
        "auto_approved": status == "auto_approved",
        "message": "Extension auto-approved" if status == "auto_approved" else "Extension request submitted for review"
    }


@router.get("/{org_id}/extensions/pending")
async def list_pending_extensions(
    org_id: str,
    user=Depends(get_current_user)
):
    """List pending extension requests for a rental house."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    extensions = execute_query(
        """
        SELECT
            e.*,
            t.transaction_type,
            requester.display_name as requester_name,
            ro.order_number,
            renter_org.name as renter_org_name
        FROM gear_rental_extensions e
        JOIN gear_transactions t ON t.id = e.transaction_id
        LEFT JOIN profiles requester ON requester.id = e.requested_by
        LEFT JOIN gear_rental_orders ro ON ro.id = e.order_id
        LEFT JOIN organizations renter_org ON renter_org.id = t.renter_org_id
        WHERE t.organization_id = :org_id
          AND e.status = 'pending'
        ORDER BY e.requested_at DESC
        """,
        {"org_id": org_id}
    )

    return {"extensions": extensions}


@router.post("/{org_id}/extensions/{extension_id}/approve")
async def approve_extension(
    org_id: str,
    extension_id: str,
    data: ExtensionResponse,
    user=Depends(get_current_user)
):
    """Approve an extension request."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    extension = execute_single(
        """
        SELECT e.*, t.organization_id
        FROM gear_rental_extensions e
        JOIN gear_transactions t ON t.id = e.transaction_id
        WHERE e.id = :ext_id
        """,
        {"ext_id": extension_id}
    )

    if not extension:
        raise HTTPException(status_code=404, detail="Extension not found")

    if extension["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Extension belongs to different organization")

    if extension["status"] != "pending":
        raise HTTPException(status_code=400, detail="Extension is not pending")

    approved_date = data.approved_end_date or extension["requested_end_date"]

    execute_query(
        """
        UPDATE gear_rental_extensions
        SET status = 'approved',
            approved_end_date = :approved_date,
            additional_amount = :amount,
            daily_rate = :daily_rate,
            reviewed_by = :reviewer,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = :ext_id
        """,
        {
            "ext_id": extension_id,
            "approved_date": approved_date,
            "amount": data.additional_amount,
            "daily_rate": data.daily_rate,
            "reviewer": profile_id
        }
    )

    # Update transaction and order dates
    execute_query(
        """
        UPDATE gear_transactions
        SET expected_return_at = :new_date, updated_at = NOW()
        WHERE id = :tx_id
        """,
        {"tx_id": extension["transaction_id"], "new_date": approved_date}
    )

    if extension.get("order_id"):
        execute_query(
            """
            UPDATE gear_rental_orders
            SET rental_end_date = :new_date, updated_at = NOW()
            WHERE id = :order_id
            """,
            {"order_id": extension["order_id"], "new_date": approved_date}
        )

    return {"success": True, "approved_end_date": str(approved_date)}


@router.post("/{org_id}/extensions/{extension_id}/deny")
async def deny_extension(
    org_id: str,
    extension_id: str,
    reason: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Deny an extension request."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    extension = execute_single(
        """
        SELECT e.*, t.organization_id
        FROM gear_rental_extensions e
        JOIN gear_transactions t ON t.id = e.transaction_id
        WHERE e.id = :ext_id
        """,
        {"ext_id": extension_id}
    )

    if not extension:
        raise HTTPException(status_code=404, detail="Extension not found")

    if extension["organization_id"] != org_id:
        raise HTTPException(status_code=403, detail="Extension belongs to different organization")

    if extension["status"] != "pending":
        raise HTTPException(status_code=400, detail="Extension is not pending")

    execute_query(
        """
        UPDATE gear_rental_extensions
        SET status = 'denied',
            denial_reason = :reason,
            reviewed_by = :reviewer,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = :ext_id
        """,
        {"ext_id": extension_id, "reason": reason, "reviewer": profile_id}
    )

    return {"success": True, "message": "Extension denied"}
