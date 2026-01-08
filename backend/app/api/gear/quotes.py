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
from app.core.database import execute_query, execute_single, execute_insert

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
        WHERE user_id = :user_id AND is_active = TRUE
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

        # Create request items
        for idx, item in enumerate(data.items):
            execute_insert(
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

        # Store budget integration info if provided
        if data.budget_line_item_id or data.auto_create_budget_line:
            execute_query(
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

        return {"request": request}

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
        WHERE user_id = :user_id AND is_active = TRUE
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
        WHERE user_id = :user_id AND is_active = TRUE
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
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND is_active = TRUE",
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
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND is_active = TRUE",
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
    user=Depends(get_current_user)
):
    """Approve a quote (renter side). Creates a rental order."""
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
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND is_active = TRUE",
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

        # Copy quote items to order items
        quote_items = execute_query(
            "SELECT * FROM gear_rental_quote_items WHERE quote_id = :quote_id ORDER BY sort_order",
            {"quote_id": quote_id}
        )

        for item in quote_items:
            execute_insert(
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

        # Update request status
        execute_query(
            "UPDATE gear_rental_requests SET status = 'converted', updated_at = NOW() WHERE id = :id",
            {"id": quote["request_id"]}
        )

        # Handle budget integration if configured
        if quote.get("auto_create_budget_line") and quote.get("backlot_project_id"):
            # Auto-create budget line item for this rental
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
            "message": f"Quote approved. Rental order {order_number} created."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve quote: {str(e)}")


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
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND is_active = TRUE",
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
