"""
Gear House Rentals API

Endpoints for rental quotes, orders, and POS operations.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert

from app.services import gear_service

router = APIRouter(prefix="/rentals", tags=["Gear Rentals"])


# ============================================================================
# SCHEMAS
# ============================================================================

class RentalItemPricing(BaseModel):
    """Pricing details for a single rental item."""
    asset_id: str
    rate_type: str = "daily"  # daily, weekly, flat
    quoted_rate: float
    quantity: int = 1
    line_total: float


class QuickRentalRequest(BaseModel):
    """Request to create a quick rental at POS."""
    # What's being rented
    items: List[RentalItemPricing]

    # Who's renting (one of these required)
    contact_id: Optional[str] = None
    client_org_id: Optional[str] = None

    # Optional project link
    project_id: Optional[str] = None

    # Rental period
    rental_start_date: date
    rental_end_date: date

    # Pricing totals
    subtotal: float
    tax_rate: float = 0
    tax_amount: float = 0
    total_amount: float

    # Payment
    payment_option: str = "invoice_later"  # invoice_later, pay_now
    payment_method: Optional[str] = None  # For pay_now: cash, card, check
    payment_reference: Optional[str] = None

    # Destination
    destination_location_id: Optional[str] = None

    # Notes
    notes: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class PaymentRecord(BaseModel):
    amount: float
    payment_method: str  # cash, card, check, transfer
    payment_reference: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


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
# QUICK RENTAL ENDPOINTS (POS)
# ============================================================================

@router.post("/{org_id}/quick-rental")
async def create_quick_rental(
    org_id: str,
    data: QuickRentalRequest,
    user=Depends(get_current_user)
):
    """
    Create a quick rental at point-of-sale.

    This bypasses the full request/quote workflow for walk-in customers.
    Creates a quote, order, and checkout transaction in one operation.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager", "member"])

    # Validate customer
    if not data.contact_id and not data.client_org_id:
        raise HTTPException(
            status_code=400,
            detail="Either contact_id or client_org_id is required"
        )

    # Validate items
    if not data.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    try:
        # 1. Create the rental quote (for record keeping)
        quote_number = generate_quote_number(org_id)
        quote = execute_insert(
            """
            INSERT INTO gear_rental_quotes (
                rental_house_org_id,
                contact_id,
                quote_number,
                rental_start_date,
                rental_end_date,
                subtotal,
                tax_amount,
                total_amount,
                status,
                prepared_by_user_id,
                approved_at
            ) VALUES (
                :org_id,
                :contact_id,
                :quote_number,
                :rental_start_date,
                :rental_end_date,
                :subtotal,
                :tax_amount,
                :total_amount,
                'approved',
                :prepared_by,
                NOW()
            )
            RETURNING *
            """,
            {
                "org_id": org_id,
                "contact_id": data.contact_id,
                "quote_number": quote_number,
                "rental_start_date": data.rental_start_date,
                "rental_end_date": data.rental_end_date,
                "subtotal": data.subtotal,
                "tax_amount": data.tax_amount,
                "total_amount": data.total_amount,
                "prepared_by": profile_id
            }
        )

        quote_id = quote["id"]

        # 2. Create quote items
        for item in data.items:
            execute_insert(
                """
                INSERT INTO gear_rental_quote_items (
                    quote_id,
                    asset_id,
                    quantity,
                    quoted_rate,
                    rate_type,
                    line_total
                ) VALUES (
                    :quote_id,
                    :asset_id,
                    :quantity,
                    :quoted_rate,
                    :rate_type,
                    :line_total
                )
                """,
                {
                    "quote_id": quote_id,
                    "asset_id": item.asset_id,
                    "quantity": item.quantity,
                    "quoted_rate": item.quoted_rate,
                    "rate_type": item.rate_type,
                    "line_total": item.line_total
                }
            )

        # 3. Create the rental order
        order_number = generate_order_number(org_id)
        order = execute_insert(
            """
            INSERT INTO gear_rental_orders (
                quote_id,
                rental_house_org_id,
                client_org_id,
                contact_id,
                backlot_project_id,
                order_number,
                rental_start_date,
                rental_end_date,
                status,
                delivery_location_id,
                total_amount,
                tax_amount,
                notes
            ) VALUES (
                :quote_id,
                :org_id,
                :client_org_id,
                :contact_id,
                :project_id,
                :order_number,
                :rental_start_date,
                :rental_end_date,
                'confirmed',
                :destination_location_id,
                :total_amount,
                :tax_amount,
                :notes
            )
            RETURNING *
            """,
            {
                "quote_id": quote_id,
                "org_id": org_id,
                "client_org_id": data.client_org_id,
                "contact_id": data.contact_id,
                "project_id": data.project_id,
                "order_number": order_number,
                "rental_start_date": data.rental_start_date,
                "rental_end_date": data.rental_end_date,
                "destination_location_id": data.destination_location_id,
                "total_amount": data.total_amount,
                "tax_amount": data.tax_amount,
                "notes": data.notes
            }
        )

        order_id = order["id"]

        # 4. Create order items
        for item in data.items:
            execute_insert(
                """
                INSERT INTO gear_rental_order_items (
                    order_id,
                    asset_id,
                    quantity,
                    quoted_rate,
                    line_total
                ) VALUES (
                    :order_id,
                    :asset_id,
                    :quantity,
                    :quoted_rate,
                    :line_total
                )
                """,
                {
                    "order_id": order_id,
                    "asset_id": item.asset_id,
                    "quantity": item.quantity,
                    "quoted_rate": item.quoted_rate,
                    "line_total": item.line_total
                }
            )

        # 5. Create the gear transaction for checkout
        asset_ids = [item.asset_id for item in data.items]
        items = [{"asset_id": aid} for aid in asset_ids]

        tx = gear_service.create_transaction(
            org_id,
            "rental_pickup",
            profile_id,
            items,
            custodian_contact_id=data.contact_id,
            backlot_project_id=data.project_id,
            checkout_at=datetime.combine(data.rental_start_date, datetime.min.time()),
            expected_return_at=datetime.combine(data.rental_end_date, datetime.min.time()),
            destination_location_id=data.destination_location_id,
            notes=f"Rental Order: {order_number}"
        )

        if tx:
            # Complete the checkout
            tx = gear_service.complete_checkout(str(tx["id"]), profile_id)

            # Link transaction to order
            execute_query(
                "UPDATE gear_rental_orders SET transaction_id = :tx_id WHERE id = :order_id",
                {"tx_id": tx["id"], "order_id": order_id}
            )

        # 6. Record payment if pay_now
        payment = None
        if data.payment_option == "pay_now" and data.payment_method:
            payment = execute_insert(
                """
                INSERT INTO gear_rental_payments (
                    order_id,
                    amount,
                    payment_method,
                    payment_reference,
                    recorded_by
                ) VALUES (
                    :order_id,
                    :amount,
                    :payment_method,
                    :payment_reference,
                    :recorded_by
                )
                RETURNING *
                """,
                {
                    "order_id": order_id,
                    "amount": data.total_amount,
                    "payment_method": data.payment_method,
                    "payment_reference": data.payment_reference,
                    "recorded_by": profile_id
                }
            )

            # Update order status to dispatched (paid and out the door)
            execute_query(
                "UPDATE gear_rental_orders SET status = 'dispatched' WHERE id = :id",
                {"id": order_id}
            )
            order["status"] = "dispatched"

        return {
            "quote": quote,
            "order": order,
            "transaction": tx,
            "payment": payment
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create rental: {str(e)}")


# ============================================================================
# RENTAL QUOTES
# ============================================================================

@router.get("/{org_id}/quotes")
async def list_quotes(
    org_id: str,
    status: Optional[str] = Query(None),
    contact_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List rental quotes for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    params = {"org_id": org_id, "limit": limit, "offset": offset}
    filters = []

    if status:
        filters.append("q.status = :status")
        params["status"] = status

    if contact_id:
        filters.append("q.contact_id = :contact_id")
        params["contact_id"] = contact_id

    where_clause = " AND ".join(filters) if filters else "TRUE"

    quotes = execute_query(
        f"""
        SELECT q.*,
               c.first_name || ' ' || c.last_name as contact_name,
               c.company as contact_company,
               p.display_name as prepared_by_name
        FROM gear_rental_quotes q
        LEFT JOIN gear_organization_contacts c ON c.id = q.contact_id
        LEFT JOIN profiles p ON p.id = q.prepared_by_user_id
        WHERE q.rental_house_org_id = :org_id
          AND {where_clause}
        ORDER BY q.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"quotes": quotes}


@router.get("/quotes/{quote_id}")
async def get_quote(
    quote_id: str,
    user=Depends(get_current_user)
):
    """Get quote details with items."""
    profile_id = get_profile_id(user)

    quote = execute_single(
        """
        SELECT q.*,
               c.first_name || ' ' || c.last_name as contact_name,
               c.company as contact_company,
               c.email as contact_email,
               c.phone as contact_phone,
               p.display_name as prepared_by_name
        FROM gear_rental_quotes q
        LEFT JOIN gear_organization_contacts c ON c.id = q.contact_id
        LEFT JOIN profiles p ON p.id = q.prepared_by_user_id
        WHERE q.id = :quote_id
        """,
        {"quote_id": quote_id}
    )

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    require_org_access(quote["rental_house_org_id"], profile_id)

    # Get items
    items = execute_query(
        """
        SELECT qi.*,
               a.name as asset_name,
               a.internal_id as asset_internal_id
        FROM gear_rental_quote_items qi
        LEFT JOIN gear_assets a ON a.id = qi.asset_id
        WHERE qi.quote_id = :quote_id
        ORDER BY qi.id
        """,
        {"quote_id": quote_id}
    )

    quote["items"] = items

    return {"quote": quote}


# ============================================================================
# RENTAL ORDERS
# ============================================================================

@router.get("/{org_id}/orders")
async def list_orders(
    org_id: str,
    status: Optional[str] = Query(None),
    contact_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    user=Depends(get_current_user)
):
    """List rental orders for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    params = {"org_id": org_id, "limit": limit, "offset": offset}
    filters = []

    if status:
        filters.append("o.status = :status")
        params["status"] = status

    if contact_id:
        filters.append("o.contact_id = :contact_id")
        params["contact_id"] = contact_id

    if project_id:
        filters.append("o.backlot_project_id = :project_id")
        params["project_id"] = project_id

    where_clause = " AND ".join(filters) if filters else "TRUE"

    orders = execute_query(
        f"""
        SELECT o.*,
               c.first_name || ' ' || c.last_name as contact_name,
               c.company as contact_company,
               (SELECT COUNT(*) FROM gear_rental_order_items WHERE order_id = o.id) as item_count,
               (SELECT COALESCE(SUM(amount), 0) FROM gear_rental_payments WHERE order_id = o.id) as amount_paid
        FROM gear_rental_orders o
        LEFT JOIN gear_organization_contacts c ON c.id = o.contact_id
        WHERE o.rental_house_org_id = :org_id
          AND {where_clause}
        ORDER BY o.created_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    return {"orders": orders}


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    user=Depends(get_current_user)
):
    """Get order details with items and payments."""
    profile_id = get_profile_id(user)

    order = execute_single(
        """
        SELECT o.*,
               c.first_name || ' ' || c.last_name as contact_name,
               c.company as contact_company,
               c.email as contact_email,
               c.phone as contact_phone,
               q.quote_number
        FROM gear_rental_orders o
        LEFT JOIN gear_organization_contacts c ON c.id = o.contact_id
        LEFT JOIN gear_rental_quotes q ON q.id = o.quote_id
        WHERE o.id = :order_id
        """,
        {"order_id": order_id}
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    require_org_access(order["rental_house_org_id"], profile_id)

    # Get items
    items = execute_query(
        """
        SELECT oi.*,
               a.name as asset_name,
               a.internal_id as asset_internal_id
        FROM gear_rental_order_items oi
        LEFT JOIN gear_assets a ON a.id = oi.asset_id
        WHERE oi.order_id = :order_id
        ORDER BY oi.id
        """,
        {"order_id": order_id}
    )

    order["items"] = items

    # Get payments
    payments = execute_query(
        """
        SELECT p.*, prof.display_name as recorded_by_name
        FROM gear_rental_payments p
        LEFT JOIN profiles prof ON prof.id = p.recorded_by
        WHERE p.order_id = :order_id
        ORDER BY p.payment_date DESC
        """,
        {"order_id": order_id}
    )

    order["payments"] = payments
    order["amount_paid"] = sum(p["amount"] for p in payments) if payments else 0
    order["balance_due"] = float(order["total_amount"] or 0) - order["amount_paid"]

    return {"order": order}


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    data: OrderStatusUpdate,
    user=Depends(get_current_user)
):
    """Update rental order status."""
    profile_id = get_profile_id(user)

    order = execute_single(
        "SELECT * FROM gear_rental_orders WHERE id = :id",
        {"id": order_id}
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    require_org_access(order["rental_house_org_id"], profile_id, ["owner", "admin", "manager"])

    # Validate status transition
    valid_statuses = [
        "confirmed", "preparing", "dispatched", "in_rental",
        "return_pending", "checking_in", "completed", "cancelled"
    ]

    if data.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    execute_query(
        """
        UPDATE gear_rental_orders
        SET status = :status, notes = COALESCE(:notes, notes), updated_at = NOW()
        WHERE id = :id
        """,
        {"id": order_id, "status": data.status, "notes": data.notes}
    )

    # Update budget actual if order is completed and has reconciled final_amount
    if data.status in ("completed", "cancelled") and order.get("backlot_project_id"):
        from app.core.database import get_client
        import logging
        logger = logging.getLogger(__name__)

        # Check if final_amount differs from initial total_amount
        if order.get("final_amount") and order["final_amount"] != order.get("total_amount"):
            client = get_client()

            # Find existing budget actual for this order
            actual_result = client.table("backlot_budget_actuals").select("*").eq(
                "source_type", "gear_rental_order"
            ).eq("source_id", order_id).execute()

            if actual_result.data:
                actual = actual_result.data[0]
                # Update with reconciled amount
                client.table("backlot_budget_actuals").update({
                    "amount": order["final_amount"],
                    "notes": f"Reconciled from ${order.get('total_amount', 0):.2f} to ${order['final_amount']:.2f}",
                    "updated_at": execute_query("SELECT NOW() as now", {})[0]["now"]
                }).eq("id", actual["id"]).execute()

                logger.info(f"Updated budget actual for order {order_id} to reconciled final amount")

    return {"success": True, "status": data.status}


# ============================================================================
# PAYMENTS
# ============================================================================

@router.post("/orders/{order_id}/record-payment")
async def record_payment(
    order_id: str,
    data: PaymentRecord,
    user=Depends(get_current_user)
):
    """Record a payment against a rental order."""
    profile_id = get_profile_id(user)

    order = execute_single(
        "SELECT * FROM gear_rental_orders WHERE id = :id",
        {"id": order_id}
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    require_org_access(order["rental_house_org_id"], profile_id, ["owner", "admin", "manager"])

    payment = execute_insert(
        """
        INSERT INTO gear_rental_payments (
            order_id,
            amount,
            payment_method,
            payment_reference,
            recorded_by,
            notes
        ) VALUES (
            :order_id,
            :amount,
            :payment_method,
            :payment_reference,
            :recorded_by,
            :notes
        )
        RETURNING *
        """,
        {
            "order_id": order_id,
            "amount": data.amount,
            "payment_method": data.payment_method,
            "payment_reference": data.payment_reference,
            "recorded_by": profile_id,
            "notes": data.notes
        }
    )

    # Check if fully paid
    total_paid = execute_single(
        "SELECT COALESCE(SUM(amount), 0) as total FROM gear_rental_payments WHERE order_id = :id",
        {"id": order_id}
    )

    return {
        "payment": payment,
        "total_paid": float(total_paid["total"]),
        "balance_due": float(order["total_amount"] or 0) - float(total_paid["total"])
    }


@router.get("/orders/{order_id}/payments")
async def list_order_payments(
    order_id: str,
    user=Depends(get_current_user)
):
    """Get all payments for an order."""
    profile_id = get_profile_id(user)

    order = execute_single(
        "SELECT * FROM gear_rental_orders WHERE id = :id",
        {"id": order_id}
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    require_org_access(order["rental_house_org_id"], profile_id)

    payments = execute_query(
        """
        SELECT p.*, prof.display_name as recorded_by_name
        FROM gear_rental_payments p
        LEFT JOIN profiles prof ON prof.id = p.recorded_by
        WHERE p.order_id = :order_id
        ORDER BY p.payment_date DESC
        """,
        {"order_id": order_id}
    )

    total_paid = sum(p["amount"] for p in payments) if payments else 0

    return {
        "payments": payments,
        "total_paid": total_paid,
        "total_amount": float(order["total_amount"] or 0),
        "balance_due": float(order["total_amount"] or 0) - total_paid
    }


# ============================================================================
# INVOICE INTEGRATION (Phase 3)
# ============================================================================

@router.post("/orders/{order_id}/generate-invoice")
async def generate_invoice_from_order(
    order_id: str,
    user=Depends(get_current_user)
):
    """Generate a backlot invoice from a rental order."""
    profile_id = get_profile_id(user)

    order = execute_single(
        """
        SELECT o.*, c.first_name, c.last_name, c.email, c.company
        FROM gear_rental_orders o
        LEFT JOIN gear_organization_contacts c ON c.id = o.contact_id
        WHERE o.id = :id
        """,
        {"id": order_id}
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    require_org_access(order["rental_house_org_id"], profile_id, ["owner", "admin", "manager"])

    # Check if already has invoice
    if order.get("backlot_invoice_id"):
        raise HTTPException(status_code=400, detail="Order already has an invoice")

    # Get order items
    items = execute_query(
        """
        SELECT oi.*, a.name as asset_name
        FROM gear_rental_order_items oi
        LEFT JOIN gear_assets a ON a.id = oi.asset_id
        WHERE oi.order_id = :order_id
        """,
        {"order_id": order_id}
    )

    # Create invoice
    contact_name = f"{order.get('first_name', '')} {order.get('last_name', '')}".strip()
    invoice_description = f"Gear Rental - Order #{order['order_number']}"

    # Generate invoice number
    invoice_count = execute_single(
        "SELECT COUNT(*) + 1 as num FROM backlot_invoices WHERE project_id = :project_id",
        {"project_id": order.get("backlot_project_id")}
    )
    invoice_number = f"INV-{invoice_count['num']:04d}"

    invoice = execute_insert(
        """
        INSERT INTO backlot_invoices (
            project_id,
            invoice_number,
            status,
            vendor_name,
            description,
            amount,
            tax_amount,
            total_amount,
            created_by,
            due_date
        ) VALUES (
            :project_id,
            :invoice_number,
            'draft',
            :vendor_name,
            :description,
            :amount,
            :tax_amount,
            :total_amount,
            :created_by,
            :due_date
        )
        RETURNING *
        """,
        {
            "project_id": order.get("backlot_project_id"),
            "invoice_number": invoice_number,
            "vendor_name": contact_name or order.get("company", "Walk-in Customer"),
            "description": invoice_description,
            "amount": order.get("total_amount", 0) - (order.get("tax_amount") or 0),
            "tax_amount": order.get("tax_amount", 0),
            "total_amount": order.get("total_amount", 0),
            "created_by": profile_id,
            "due_date": order.get("rental_end_date")
        }
    )

    # Link invoice to order
    execute_query(
        "UPDATE gear_rental_orders SET backlot_invoice_id = :invoice_id WHERE id = :order_id",
        {"invoice_id": invoice["id"], "order_id": order_id}
    )

    # Create invoice line items
    for item in items:
        execute_insert(
            """
            INSERT INTO backlot_invoice_items (
                invoice_id,
                description,
                quantity,
                unit_price,
                amount
            ) VALUES (
                :invoice_id,
                :description,
                :quantity,
                :unit_price,
                :amount
            )
            """,
            {
                "invoice_id": invoice["id"],
                "description": item.get("asset_name", "Rental Item"),
                "quantity": item.get("quantity", 1),
                "unit_price": item.get("quoted_rate", 0),
                "amount": item.get("line_total", 0)
            }
        )

    return {"invoice": invoice}
