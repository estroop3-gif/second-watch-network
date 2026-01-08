"""
Gear House Payments API

Handles payment processing for marketplace rentals:
- Stripe payment intents for deposits and rental totals
- Invoice generation for Backlot integration
- Deposit refunds on return
"""
from typing import Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

router = APIRouter(prefix="/payments", tags=["Gear Payments"])


# ============================================================================
# SCHEMAS
# ============================================================================

class CreatePaymentIntentRequest(BaseModel):
    """Create a payment intent for a rental."""
    quote_id: str
    payment_type: str = "deposit"  # deposit, full, or balance
    return_url: Optional[str] = None


class ConfirmPaymentRequest(BaseModel):
    """Confirm a completed payment."""
    payment_intent_id: str
    quote_id: str


class RefundDepositRequest(BaseModel):
    """Refund a deposit."""
    order_id: str
    amount: Optional[float] = None  # If None, refund full deposit
    reason: Optional[str] = None


class GenerateInvoiceRequest(BaseModel):
    """Generate a Backlot invoice for a rental."""
    quote_id: str
    budget_line_item_id: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# HELPERS
# ============================================================================

def get_stripe():
    """Get Stripe client, raising error if not configured."""
    import stripe
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def get_profile_id(user) -> str:
    """Get profile ID from user dict."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :sub",
        {"sub": user.get("sub")}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return str(profile["id"])


def verify_quote_access(quote_id: str, profile_id: str, side: str = "renter") -> dict:
    """Verify user has access to the quote and return quote data."""
    quote = execute_single(
        """
        SELECT q.*, r.requesting_org_id, r.rental_house_org_id as request_rental_house_org_id
        FROM gear_rental_quotes q
        JOIN gear_rental_requests r ON r.id = q.request_id
        WHERE q.id = :quote_id
        """,
        {"quote_id": quote_id}
    )

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Get user's organizations
    user_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND is_active = TRUE",
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if side == "renter":
        if quote["requesting_org_id"] not in user_org_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this quote")
    elif side == "rental_house":
        if quote["rental_house_org_id"] not in user_org_ids:
            raise HTTPException(status_code=403, detail="Not authorized to access this quote")

    return quote


# ============================================================================
# PAYMENT INTENT ENDPOINTS
# ============================================================================

@router.post("/create-intent")
async def create_payment_intent(
    data: CreatePaymentIntentRequest,
    user=Depends(get_current_user)
):
    """
    Create a Stripe payment intent for a rental quote.

    Supports:
    - deposit: Just the security deposit
    - full: Full rental amount including deposit
    - balance: Remaining balance after deposit
    """
    stripe = get_stripe()
    profile_id = get_profile_id(user)
    quote = verify_quote_access(data.quote_id, profile_id, side="renter")

    if quote["status"] != "sent":
        raise HTTPException(status_code=400, detail=f"Quote cannot be paid (status: {quote['status']})")

    # Calculate amount based on payment type
    if data.payment_type == "deposit":
        amount = float(quote.get("deposit_amount") or 0)
        if amount <= 0:
            raise HTTPException(status_code=400, detail="No deposit required for this quote")
    elif data.payment_type == "full":
        amount = float(quote.get("total_amount") or 0)
    elif data.payment_type == "balance":
        total = float(quote.get("total_amount") or 0)
        deposit = float(quote.get("deposit_amount") or 0)
        amount = total - deposit
    else:
        raise HTTPException(status_code=400, detail="Invalid payment type")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid payment amount")

    # Get rental house's Stripe account for connected account payments
    rental_house_settings = execute_single(
        """
        SELECT stripe_account_id, accepts_stripe
        FROM gear_marketplace_settings
        WHERE organization_id = :org_id
        """,
        {"org_id": quote["rental_house_org_id"]}
    )

    if not rental_house_settings or not rental_house_settings.get("accepts_stripe"):
        raise HTTPException(status_code=400, detail="Rental house does not accept card payments")

    stripe_account_id = rental_house_settings.get("stripe_account_id")

    # Get or create customer for the renter
    renter_org = execute_single(
        "SELECT name, stripe_customer_id FROM organizations WHERE id = :org_id",
        {"org_id": quote["requesting_org_id"]}
    )

    customer_id = renter_org.get("stripe_customer_id") if renter_org else None

    if not customer_id:
        # Get user email for customer creation
        user_profile = execute_single(
            "SELECT email FROM profiles WHERE id = :id",
            {"id": profile_id}
        )

        customer = stripe.Customer.create(
            email=user_profile.get("email"),
            name=renter_org.get("name") if renter_org else None,
            metadata={
                "organization_id": str(quote["requesting_org_id"]),
                "profile_id": profile_id
            }
        )
        customer_id = customer.id

        # Save customer ID to organization
        execute_update(
            "UPDATE organizations SET stripe_customer_id = :customer_id WHERE id = :org_id",
            {"customer_id": customer_id, "org_id": quote["requesting_org_id"]}
        )

    # Create payment intent
    # Use direct charge if rental house has Stripe Connect, otherwise platform charge
    intent_params = {
        "amount": int(amount * 100),  # Stripe uses cents
        "currency": "usd",
        "customer": customer_id,
        "metadata": {
            "quote_id": data.quote_id,
            "payment_type": data.payment_type,
            "rental_house_org_id": str(quote["rental_house_org_id"]),
            "renter_org_id": str(quote["requesting_org_id"])
        },
        "automatic_payment_methods": {"enabled": True},
    }

    # If rental house has connected Stripe account, use destination charge
    if stripe_account_id:
        # Platform takes a small fee (e.g., 2.5%)
        platform_fee = int(amount * 100 * 0.025)
        intent_params["transfer_data"] = {
            "destination": stripe_account_id,
        }
        intent_params["application_fee_amount"] = platform_fee

    payment_intent = stripe.PaymentIntent.create(**intent_params)

    # Store payment intent reference
    execute_update(
        """
        UPDATE gear_rental_quotes
        SET stripe_payment_intent_id = :intent_id,
            payment_type = :payment_type,
            updated_at = NOW()
        WHERE id = :quote_id
        """,
        {
            "intent_id": payment_intent.id,
            "payment_type": data.payment_type,
            "quote_id": data.quote_id
        }
    )

    return {
        "client_secret": payment_intent.client_secret,
        "payment_intent_id": payment_intent.id,
        "amount": amount,
        "currency": "usd"
    }


@router.post("/confirm")
async def confirm_payment(
    data: ConfirmPaymentRequest,
    user=Depends(get_current_user)
):
    """
    Confirm a completed payment and update quote status.
    Called after successful Stripe payment.
    """
    stripe = get_stripe()
    profile_id = get_profile_id(user)
    quote = verify_quote_access(data.quote_id, profile_id, side="renter")

    # Verify payment intent
    try:
        payment_intent = stripe.PaymentIntent.retrieve(data.payment_intent_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid payment intent: {str(e)}")

    if payment_intent.status != "succeeded":
        raise HTTPException(status_code=400, detail=f"Payment not completed (status: {payment_intent.status})")

    if payment_intent.metadata.get("quote_id") != data.quote_id:
        raise HTTPException(status_code=400, detail="Payment intent does not match quote")

    payment_type = payment_intent.metadata.get("payment_type", "deposit")

    # Update quote with payment info
    if payment_type == "deposit":
        execute_update(
            """
            UPDATE gear_rental_quotes
            SET deposit_paid = TRUE,
                deposit_paid_at = NOW(),
                deposit_payment_intent_id = :intent_id,
                updated_at = NOW()
            WHERE id = :quote_id
            """,
            {"intent_id": data.payment_intent_id, "quote_id": data.quote_id}
        )
    else:
        execute_update(
            """
            UPDATE gear_rental_quotes
            SET payment_completed = TRUE,
                payment_completed_at = NOW(),
                stripe_payment_intent_id = :intent_id,
                updated_at = NOW()
            WHERE id = :quote_id
            """,
            {"intent_id": data.payment_intent_id, "quote_id": data.quote_id}
        )

    # Create payment record
    execute_insert(
        """
        INSERT INTO gear_rental_payments (
            quote_id,
            payment_intent_id,
            payment_type,
            amount,
            currency,
            status,
            paid_at,
            paid_by_user_id
        ) VALUES (
            :quote_id,
            :intent_id,
            :payment_type,
            :amount,
            'usd',
            'succeeded',
            NOW(),
            :user_id
        )
        RETURNING *
        """,
        {
            "quote_id": data.quote_id,
            "intent_id": data.payment_intent_id,
            "payment_type": payment_type,
            "amount": payment_intent.amount / 100,  # Convert from cents
            "user_id": profile_id
        }
    )

    return {
        "success": True,
        "payment_type": payment_type,
        "amount": payment_intent.amount / 100,
        "message": f"Payment confirmed for {payment_type}"
    }


@router.post("/refund-deposit")
async def refund_deposit(
    data: RefundDepositRequest,
    user=Depends(get_current_user)
):
    """
    Refund a rental deposit after equipment is returned.
    Only rental house can initiate refunds.
    """
    stripe = get_stripe()
    profile_id = get_profile_id(user)

    # Get order and verify rental house access
    order = execute_single(
        """
        SELECT o.*, q.deposit_payment_intent_id, q.deposit_amount
        FROM gear_rental_orders o
        JOIN gear_rental_quotes q ON q.id = o.quote_id
        WHERE o.id = :order_id
        """,
        {"order_id": data.order_id}
    )

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify rental house access
    user_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND is_active = TRUE",
        {"user_id": profile_id}
    )
    user_org_ids = [o["organization_id"] for o in user_orgs]

    if order["rental_house_org_id"] not in user_org_ids:
        raise HTTPException(status_code=403, detail="Only rental house can refund deposits")

    if not order.get("deposit_payment_intent_id"):
        raise HTTPException(status_code=400, detail="No deposit payment found for this order")

    # Calculate refund amount
    deposit_amount = float(order.get("deposit_amount") or 0)
    refund_amount = data.amount if data.amount else deposit_amount

    if refund_amount > deposit_amount:
        raise HTTPException(status_code=400, detail="Refund amount exceeds deposit")

    try:
        refund = stripe.Refund.create(
            payment_intent=order["deposit_payment_intent_id"],
            amount=int(refund_amount * 100),
            reason="requested_by_customer",
            metadata={
                "order_id": data.order_id,
                "reason": data.reason or "Equipment returned"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Refund failed: {str(e)}")

    # Record the refund
    execute_insert(
        """
        INSERT INTO gear_rental_payments (
            order_id,
            payment_intent_id,
            payment_type,
            amount,
            currency,
            status,
            paid_at,
            paid_by_user_id,
            notes
        ) VALUES (
            :order_id,
            :refund_id,
            'deposit_refund',
            :amount,
            'usd',
            'refunded',
            NOW(),
            :user_id,
            :notes
        )
        RETURNING *
        """,
        {
            "order_id": data.order_id,
            "refund_id": refund.id,
            "amount": -refund_amount,  # Negative for refund
            "user_id": profile_id,
            "notes": data.reason
        }
    )

    # Update order
    execute_update(
        """
        UPDATE gear_rental_orders
        SET deposit_refunded = TRUE,
            deposit_refunded_at = NOW(),
            deposit_refund_amount = :amount,
            updated_at = NOW()
        WHERE id = :order_id
        """,
        {"amount": refund_amount, "order_id": data.order_id}
    )

    return {
        "success": True,
        "refund_id": refund.id,
        "amount": refund_amount,
        "message": "Deposit refunded successfully"
    }


# ============================================================================
# INVOICE ENDPOINTS
# ============================================================================

@router.post("/generate-invoice")
async def generate_invoice(
    data: GenerateInvoiceRequest,
    user=Depends(get_current_user)
):
    """
    Generate a Backlot invoice for a rental quote.
    Links the rental to project budget tracking.
    """
    profile_id = get_profile_id(user)
    quote = verify_quote_access(data.quote_id, profile_id, side="renter")

    if quote["status"] != "sent":
        raise HTTPException(status_code=400, detail=f"Quote must be sent before generating invoice")

    # Get request details for project link
    request = execute_single(
        """
        SELECT r.*, rh.name as rental_house_name
        FROM gear_rental_requests r
        LEFT JOIN organizations rh ON rh.id = r.rental_house_org_id
        WHERE r.id = :request_id
        """,
        {"request_id": quote["request_id"]}
    )

    project_id = request.get("backlot_project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="No project linked to this rental request")

    # Get quote items for line items
    quote_items = execute_query(
        """
        SELECT qi.*, a.name as asset_name, l.name as listing_name
        FROM gear_rental_quote_items qi
        LEFT JOIN gear_assets a ON a.id = qi.asset_id
        LEFT JOIN gear_marketplace_listings l ON l.id = qi.listing_id
        WHERE qi.quote_id = :quote_id
        """,
        {"quote_id": data.quote_id}
    )

    # Create or link budget line item
    budget_line_item_id = data.budget_line_item_id or request.get("budget_line_item_id")

    if not budget_line_item_id and request.get("auto_create_budget_line"):
        # Auto-create budget line item under Equipment Rentals
        # Find or create Equipment Rentals category
        equipment_category = execute_single(
            """
            SELECT id FROM backlot_budget_categories
            WHERE project_id = :project_id AND name ILIKE '%equipment%rental%'
            LIMIT 1
            """,
            {"project_id": project_id}
        )

        if not equipment_category:
            equipment_category = execute_insert(
                """
                INSERT INTO backlot_budget_categories (project_id, name, sort_order)
                VALUES (:project_id, 'Equipment Rentals', 500)
                RETURNING id
                """,
                {"project_id": project_id}
            )

        # Create line item
        line_item = execute_insert(
            """
            INSERT INTO backlot_budget_line_items (
                project_id,
                category_id,
                description,
                estimated_amount,
                actual_amount,
                vendor_name,
                notes
            ) VALUES (
                :project_id,
                :category_id,
                :description,
                :amount,
                :amount,
                :vendor_name,
                :notes
            )
            RETURNING id
            """,
            {
                "project_id": project_id,
                "category_id": equipment_category["id"],
                "description": f"Gear Rental - {request.get('title', 'Equipment')}",
                "amount": quote.get("total_amount"),
                "vendor_name": request.get("rental_house_name"),
                "notes": f"Quote #{data.quote_id[:8]}"
            }
        )
        budget_line_item_id = line_item["id"]

    # Generate invoice number
    invoice_count = execute_single(
        "SELECT COUNT(*) as count FROM backlot_invoices WHERE project_id = :project_id",
        {"project_id": project_id}
    )
    invoice_number = f"INV-{project_id[:4].upper()}-{(invoice_count['count'] or 0) + 1:04d}"

    # Create Backlot invoice
    invoice = execute_insert(
        """
        INSERT INTO backlot_invoices (
            project_id,
            vendor_name,
            invoice_number,
            amount,
            tax_amount,
            total_amount,
            status,
            due_date,
            category,
            budget_line_item_id,
            notes,
            created_by
        ) VALUES (
            :project_id,
            :vendor_name,
            :invoice_number,
            :amount,
            :tax_amount,
            :total_amount,
            'pending_approval',
            :due_date,
            'equipment_rental',
            :budget_line_item_id,
            :notes,
            :created_by
        )
        RETURNING *
        """,
        {
            "project_id": project_id,
            "vendor_name": request.get("rental_house_name"),
            "invoice_number": invoice_number,
            "amount": quote.get("subtotal"),
            "tax_amount": quote.get("tax_amount") or 0,
            "total_amount": quote.get("total_amount"),
            "due_date": quote.get("rental_start_date"),
            "budget_line_item_id": budget_line_item_id,
            "notes": data.notes or f"Gear rental from {request.get('rental_house_name')}",
            "created_by": profile_id
        }
    )

    # Link invoice to quote
    execute_update(
        """
        UPDATE gear_rental_quotes
        SET backlot_invoice_id = :invoice_id,
            payment_method = 'invoice',
            updated_at = NOW()
        WHERE id = :quote_id
        """,
        {"invoice_id": invoice["id"], "quote_id": data.quote_id}
    )

    # Create invoice line items from quote items
    for item in quote_items:
        execute_insert(
            """
            INSERT INTO backlot_invoice_line_items (
                invoice_id,
                description,
                quantity,
                unit_price,
                total
            ) VALUES (
                :invoice_id,
                :description,
                :quantity,
                :unit_price,
                :total
            )
            """,
            {
                "invoice_id": invoice["id"],
                "description": item.get("item_description") or item.get("asset_name") or item.get("listing_name") or "Equipment",
                "quantity": item.get("quantity") or 1,
                "unit_price": item.get("daily_rate") or 0,
                "total": item.get("line_total") or 0
            }
        )

    return {
        "success": True,
        "invoice_id": invoice["id"],
        "invoice_number": invoice_number,
        "amount": quote.get("total_amount"),
        "message": "Invoice created and linked to project budget"
    }


# ============================================================================
# PAYMENT STATUS
# ============================================================================

@router.get("/quote/{quote_id}/status")
async def get_payment_status(
    quote_id: str,
    user=Depends(get_current_user)
):
    """Get payment status for a quote."""
    profile_id = get_profile_id(user)
    quote = verify_quote_access(quote_id, profile_id, side="renter")

    # Get all payments for this quote
    payments = execute_query(
        """
        SELECT * FROM gear_rental_payments
        WHERE quote_id = :quote_id
        ORDER BY paid_at DESC
        """,
        {"quote_id": quote_id}
    )

    return {
        "quote_id": quote_id,
        "deposit_required": float(quote.get("deposit_amount") or 0) > 0,
        "deposit_amount": quote.get("deposit_amount"),
        "deposit_paid": quote.get("deposit_paid", False),
        "deposit_paid_at": quote.get("deposit_paid_at"),
        "total_amount": quote.get("total_amount"),
        "payment_completed": quote.get("payment_completed", False),
        "payment_completed_at": quote.get("payment_completed_at"),
        "payment_method": quote.get("payment_method"),
        "backlot_invoice_id": quote.get("backlot_invoice_id"),
        "payments": payments
    }
