"""
Filmmaker Pro — $10/month subscription tier for approved filmmakers.
Provides: subscription management, profile analytics, rate cards,
standalone invoicing, advanced availability, portfolio site generator.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.database import get_client, execute_query, execute_single, execute_insert, execute_update
from app.core.deps import get_user_profile, get_user_profile_optional, require_filmmaker
from app.core.roles import has_any_role, RoleType

router = APIRouter()


# ============================================================================
# Helpers
# ============================================================================

def _require_pro(profile: dict):
    """Raise 403 if profile is not an active Filmmaker Pro subscriber."""
    if not profile.get("is_filmmaker_pro") and not has_any_role(profile, [RoleType.SUPERADMIN, RoleType.ADMIN]):
        raise HTTPException(status_code=403, detail="Filmmaker Pro subscription required")


def _get_stripe():
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


# ============================================================================
# Subscription Management
# ============================================================================

class CheckoutRequest(BaseModel):
    plan: str = Field(default="monthly", pattern="^(monthly|annual)$")
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CancelRequest(BaseModel):
    cancel_at_period_end: bool = True


@router.get("/subscription/status")
async def get_subscription_status(profile: dict = Depends(require_filmmaker)):
    """Get current Filmmaker Pro subscription status."""
    sub = execute_single("""
        SELECT * FROM filmmaker_pro_subscriptions WHERE profile_id = :pid
    """, {"pid": profile["id"]})

    if not sub:
        return {
            "status": "inactive",
            "is_pro": False,
            "plan": None,
            "current_period_end": None,
            "cancel_at_period_end": False,
            "trial_ends_at": None,
        }

    return {
        "status": sub["status"],
        "is_pro": sub["status"] in ("active", "trialing"),
        "plan": sub["plan"],
        "current_period_start": sub["current_period_start"],
        "current_period_end": sub["current_period_end"],
        "cancel_at_period_end": sub["cancel_at_period_end"],
        "canceled_at": sub["canceled_at"],
        "trial_ends_at": sub["trial_ends_at"],
    }


@router.post("/subscription/checkout")
async def create_checkout_session(req: CheckoutRequest, profile: dict = Depends(require_filmmaker)):
    """Create a Stripe checkout session for Filmmaker Pro subscription."""
    stripe = _get_stripe()

    price_id = (
        settings.STRIPE_FILMMAKER_PRO_ANNUAL_PRICE_ID
        if req.plan == "annual"
        else settings.STRIPE_FILMMAKER_PRO_MONTHLY_PRICE_ID
    )

    if not price_id:
        raise HTTPException(status_code=500, detail="Stripe price not configured")

    # Get or create Stripe customer
    customer_id = profile.get("stripe_customer_id")
    if not customer_id:
        customer = stripe.Customer.create(
            email=profile.get("email", ""),
            metadata={"profile_id": str(profile["id"]), "product": "filmmaker_pro"},
        )
        customer_id = customer.id
        execute_update("""
            UPDATE profiles SET stripe_customer_id = :cid WHERE id = :pid
        """, {"cid": customer_id, "pid": profile["id"]})

    success_url = req.success_url or f"{settings.FRONTEND_URL}/filmmaker-pro/settings?checkout=success"
    cancel_url = req.cancel_url or f"{settings.FRONTEND_URL}/filmmaker-pro/settings?checkout=canceled"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        subscription_data={
            "trial_period_days": 14,
            "metadata": {"product": "filmmaker_pro", "profile_id": str(profile["id"]), "plan": req.plan},
        },
        metadata={"product": "filmmaker_pro", "profile_id": str(profile["id"])},
    )

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/subscription/cancel")
async def cancel_subscription(req: CancelRequest, profile: dict = Depends(require_filmmaker)):
    """Cancel Filmmaker Pro subscription."""
    _require_pro(profile)
    stripe = _get_stripe()

    sub = execute_single("""
        SELECT stripe_subscription_id FROM filmmaker_pro_subscriptions
        WHERE profile_id = :pid AND status IN ('active', 'trialing')
    """, {"pid": profile["id"]})

    if not sub or not sub.get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail="No active subscription found")

    if req.cancel_at_period_end:
        stripe.Subscription.modify(sub["stripe_subscription_id"], cancel_at_period_end=True)
    else:
        stripe.Subscription.cancel(sub["stripe_subscription_id"])

    execute_update("""
        UPDATE filmmaker_pro_subscriptions
        SET cancel_at_period_end = :cap, canceled_at = NOW(), updated_at = NOW()
        WHERE profile_id = :pid
    """, {"cap": req.cancel_at_period_end, "pid": profile["id"]})

    return {"success": True}


@router.post("/subscription/reactivate")
async def reactivate_subscription(profile: dict = Depends(require_filmmaker)):
    """Reactivate a canceled-at-period-end subscription."""
    stripe = _get_stripe()

    sub = execute_single("""
        SELECT stripe_subscription_id FROM filmmaker_pro_subscriptions
        WHERE profile_id = :pid AND cancel_at_period_end = TRUE
    """, {"pid": profile["id"]})

    if not sub or not sub.get("stripe_subscription_id"):
        raise HTTPException(status_code=404, detail="No subscription to reactivate")

    stripe.Subscription.modify(sub["stripe_subscription_id"], cancel_at_period_end=False)

    execute_update("""
        UPDATE filmmaker_pro_subscriptions
        SET cancel_at_period_end = FALSE, canceled_at = NULL, updated_at = NOW()
        WHERE profile_id = :pid
    """, {"pid": profile["id"]})

    return {"success": True}


@router.post("/subscription/portal")
async def create_billing_portal(profile: dict = Depends(require_filmmaker)):
    """Create a Stripe billing portal session."""
    stripe = _get_stripe()
    customer_id = profile.get("stripe_customer_id")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{settings.FRONTEND_URL}/filmmaker-pro/settings",
    )
    return {"url": session.url}


# ============================================================================
# Profile Analytics
# ============================================================================

@router.get("/analytics/overview")
async def get_analytics_overview(
    days: int = Query(30, ge=7, le=90),
    profile: dict = Depends(require_filmmaker),
):
    """Get analytics overview for the filmmaker's profile."""
    _require_pro(profile)
    pid = profile["id"]
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Current period stats
    stats = execute_single("""
        SELECT
            COALESCE(SUM(views_count), 0) AS total_views,
            COALESCE(SUM(unique_viewers), 0) AS unique_viewers,
            COALESCE(SUM(search_appearances), 0) AS search_appearances,
            COALESCE(SUM(collab_impressions), 0) AS collab_impressions
        FROM profile_analytics_daily
        WHERE profile_id = :pid AND date >= :since::date
    """, {"pid": pid, "since": since})

    # Previous period for comparison
    prev_since = (datetime.utcnow() - timedelta(days=days * 2)).isoformat()
    prev_stats = execute_single("""
        SELECT
            COALESCE(SUM(views_count), 0) AS total_views,
            COALESCE(SUM(unique_viewers), 0) AS unique_viewers,
            COALESCE(SUM(search_appearances), 0) AS search_appearances
        FROM profile_analytics_daily
        WHERE profile_id = :pid AND date >= :prev::date AND date < :since::date
    """, {"pid": pid, "prev": prev_since, "since": since})

    return {
        "period_days": days,
        "views": stats["total_views"] if stats else 0,
        "unique_viewers": stats["unique_viewers"] if stats else 0,
        "search_appearances": stats["search_appearances"] if stats else 0,
        "collab_impressions": stats["collab_impressions"] if stats else 0,
        "prev_views": prev_stats["total_views"] if prev_stats else 0,
        "prev_unique_viewers": prev_stats["unique_viewers"] if prev_stats else 0,
        "prev_search_appearances": prev_stats["search_appearances"] if prev_stats else 0,
    }


@router.get("/analytics/trends")
async def get_analytics_trends(
    days: int = Query(30, ge=7, le=90),
    profile: dict = Depends(require_filmmaker),
):
    """Get daily analytics trends."""
    _require_pro(profile)
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    rows = execute_query("""
        SELECT date, views_count, unique_viewers, search_appearances, collab_impressions
        FROM profile_analytics_daily
        WHERE profile_id = :pid AND date >= :since::date
        ORDER BY date ASC
    """, {"pid": profile["id"], "since": since})

    return {"trends": rows}


@router.get("/analytics/viewers")
async def get_recent_viewers(
    limit: int = Query(20, ge=1, le=50),
    profile: dict = Depends(require_filmmaker),
):
    """Get recent profile viewers (Pro only)."""
    _require_pro(profile)

    rows = execute_query("""
        SELECT pv.created_at, pv.source,
               p.id AS viewer_id, p.username, p.full_name, p.display_name, p.avatar_url, p.role
        FROM profile_views pv
        LEFT JOIN profiles p ON p.id = pv.viewer_id
        WHERE pv.profile_id = :pid AND pv.viewer_id IS NOT NULL
        ORDER BY pv.created_at DESC
        LIMIT :lim
    """, {"pid": profile["id"], "lim": limit})

    return {"viewers": rows}


@router.get("/analytics/sources")
async def get_view_sources(
    days: int = Query(30, ge=7, le=90),
    profile: dict = Depends(require_filmmaker),
):
    """Get view source breakdown."""
    _require_pro(profile)
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()

    rows = execute_query("""
        SELECT source, COUNT(*) as count
        FROM profile_views
        WHERE profile_id = :pid AND created_at >= :since::timestamptz
        GROUP BY source
        ORDER BY count DESC
    """, {"pid": profile["id"], "since": since})

    return {"sources": rows}


# ============================================================================
# Rate Cards
# ============================================================================

class RateCardCreate(BaseModel):
    role_name: str
    day_rate_cents: Optional[int] = None
    half_day_rate_cents: Optional[int] = None
    weekly_rate_cents: Optional[int] = None
    hourly_rate_cents: Optional[int] = None
    currency: str = "USD"
    notes: Optional[str] = None
    is_public: bool = True
    sort_order: int = 0


class RateCardUpdate(BaseModel):
    role_name: Optional[str] = None
    day_rate_cents: Optional[int] = None
    half_day_rate_cents: Optional[int] = None
    weekly_rate_cents: Optional[int] = None
    hourly_rate_cents: Optional[int] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    is_public: Optional[bool] = None
    sort_order: Optional[int] = None


@router.get("/rate-cards")
async def list_rate_cards(profile: dict = Depends(require_filmmaker)):
    """List the filmmaker's rate cards."""
    _require_pro(profile)
    rows = execute_query("""
        SELECT * FROM filmmaker_rate_cards
        WHERE profile_id = :pid ORDER BY sort_order ASC, created_at ASC
    """, {"pid": profile["id"]})
    return {"rate_cards": rows}


@router.get("/rate-cards/public/{profile_id}")
async def get_public_rate_cards(profile_id: str):
    """Get public rate cards for a filmmaker profile (no auth required)."""
    # Only show if user is filmmaker pro and rates are public
    check = execute_single("""
        SELECT is_filmmaker_pro FROM profiles WHERE id = :pid
    """, {"pid": profile_id})

    if not check or not check.get("is_filmmaker_pro"):
        return {"rate_cards": []}

    rows = execute_query("""
        SELECT id, role_name, day_rate_cents, half_day_rate_cents, weekly_rate_cents,
               hourly_rate_cents, currency, notes, sort_order
        FROM filmmaker_rate_cards
        WHERE profile_id = :pid AND is_public = TRUE
        ORDER BY sort_order ASC
    """, {"pid": profile_id})
    return {"rate_cards": rows}


@router.post("/rate-cards")
async def create_rate_card(card: RateCardCreate, profile: dict = Depends(require_filmmaker)):
    """Create a new rate card entry."""
    _require_pro(profile)
    result = execute_insert("""
        INSERT INTO filmmaker_rate_cards (profile_id, role_name, day_rate_cents, half_day_rate_cents,
            weekly_rate_cents, hourly_rate_cents, currency, notes, is_public, sort_order)
        VALUES (:pid, :role_name, :day, :half_day, :weekly, :hourly, :currency, :notes, :pub, :sort)
        RETURNING *
    """, {
        "pid": profile["id"], "role_name": card.role_name,
        "day": card.day_rate_cents, "half_day": card.half_day_rate_cents,
        "weekly": card.weekly_rate_cents, "hourly": card.hourly_rate_cents,
        "currency": card.currency, "notes": card.notes,
        "pub": card.is_public, "sort": card.sort_order,
    })
    return result


@router.put("/rate-cards/{card_id}")
async def update_rate_card(card_id: str, card: RateCardUpdate, profile: dict = Depends(require_filmmaker)):
    """Update a rate card."""
    _require_pro(profile)

    existing = execute_single("""
        SELECT id FROM filmmaker_rate_cards WHERE id = :cid AND profile_id = :pid
    """, {"cid": card_id, "pid": profile["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Rate card not found")

    updates = {}
    for field in ["role_name", "day_rate_cents", "half_day_rate_cents", "weekly_rate_cents",
                  "hourly_rate_cents", "currency", "notes", "is_public", "sort_order"]:
        val = getattr(card, field, None)
        if val is not None:
            updates[field] = val

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["cid"] = card_id
    updates["pid"] = profile["id"]

    execute_update(f"""
        UPDATE filmmaker_rate_cards SET {set_clause}, updated_at = NOW()
        WHERE id = :cid AND profile_id = :pid
    """, updates)

    return {"success": True}


@router.delete("/rate-cards/{card_id}")
async def delete_rate_card(card_id: str, profile: dict = Depends(require_filmmaker)):
    """Delete a rate card."""
    _require_pro(profile)
    execute_update("""
        DELETE FROM filmmaker_rate_cards WHERE id = :cid AND profile_id = :pid
    """, {"cid": card_id, "pid": profile["id"]})
    return {"success": True}


# ============================================================================
# Invoices
# ============================================================================

class InvoiceLineItemCreate(BaseModel):
    description: str
    quantity: float = 1
    rate_type: str = "flat"
    unit_price_cents: int
    sort_order: int = 0


class InvoiceCreate(BaseModel):
    recipient_name: str
    recipient_email: Optional[str] = None
    recipient_company: Optional[str] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    tax_rate_percent: float = 0
    project_name: Optional[str] = None
    notes: Optional[str] = None
    line_items: List[InvoiceLineItemCreate] = []


class InvoiceUpdate(BaseModel):
    recipient_name: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_company: Optional[str] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    tax_rate_percent: Optional[float] = None
    project_name: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


def _calc_invoice_totals(line_items: list, tax_rate: float) -> dict:
    """Calculate invoice totals from line items."""
    subtotal = sum(int(item.get("unit_price_cents", 0) * item.get("quantity", 1)) for item in line_items)
    tax_cents = int(subtotal * tax_rate / 100) if tax_rate else 0
    return {"subtotal_cents": subtotal, "tax_cents": tax_cents, "total_cents": subtotal + tax_cents}


def _generate_invoice_number(profile_id: str) -> str:
    """Generate an invoice number: FP-XXXX-NNN."""
    import hashlib
    prefix = hashlib.sha256(profile_id.encode()).hexdigest()[:4].upper()
    count = execute_single("""
        SELECT COUNT(*) as cnt FROM filmmaker_invoices WHERE sender_id = :pid
    """, {"pid": profile_id})
    seq = (count["cnt"] if count else 0) + 1
    return f"FP-{prefix}-{seq:03d}"


@router.get("/invoices")
async def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    profile: dict = Depends(require_filmmaker),
):
    """List invoices for the filmmaker."""
    _require_pro(profile)

    where = "WHERE sender_id = :pid"
    params: Dict[str, Any] = {"pid": profile["id"], "lim": limit, "off": offset}
    if status_filter:
        where += " AND status = :status"
        params["status"] = status_filter

    rows = execute_query(f"""
        SELECT * FROM filmmaker_invoices {where}
        ORDER BY created_at DESC LIMIT :lim OFFSET :off
    """, params)

    count = execute_single(f"""
        SELECT COUNT(*) as total FROM filmmaker_invoices {where}
    """, params)

    return {"invoices": rows, "total": count["total"] if count else 0}


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, profile: dict = Depends(require_filmmaker)):
    """Get invoice detail with line items."""
    _require_pro(profile)

    invoice = execute_single("""
        SELECT * FROM filmmaker_invoices WHERE id = :iid AND sender_id = :pid
    """, {"iid": invoice_id, "pid": profile["id"]})

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    items = execute_query("""
        SELECT * FROM filmmaker_invoice_line_items
        WHERE invoice_id = :iid ORDER BY sort_order ASC
    """, {"iid": invoice_id})

    invoice["line_items"] = items
    return invoice


@router.post("/invoices")
async def create_invoice(req: InvoiceCreate, profile: dict = Depends(require_filmmaker)):
    """Create a new invoice with line items."""
    _require_pro(profile)

    invoice_number = _generate_invoice_number(str(profile["id"]))
    items_data = [{"unit_price_cents": li.unit_price_cents, "quantity": li.quantity} for li in req.line_items]
    totals = _calc_invoice_totals(items_data, req.tax_rate_percent)

    invoice = execute_insert("""
        INSERT INTO filmmaker_invoices
            (invoice_number, sender_id, recipient_name, recipient_email, recipient_company,
             issue_date, due_date, tax_rate_percent, project_name, notes,
             subtotal_cents, tax_cents, total_cents)
        VALUES (:num, :sid, :name, :email, :company, :issue, :due, :tax,
                :project, :notes, :sub, :tax_cents, :total)
        RETURNING *
    """, {
        "num": invoice_number, "sid": profile["id"],
        "name": req.recipient_name, "email": req.recipient_email,
        "company": req.recipient_company,
        "issue": req.issue_date or date.today().isoformat(),
        "due": req.due_date, "tax": req.tax_rate_percent,
        "project": req.project_name, "notes": req.notes,
        "sub": totals["subtotal_cents"], "tax_cents": totals["tax_cents"],
        "total": totals["total_cents"],
    })

    # Insert line items
    for li in req.line_items:
        li_total = int(li.unit_price_cents * li.quantity)
        execute_insert("""
            INSERT INTO filmmaker_invoice_line_items
                (invoice_id, description, quantity, rate_type, unit_price_cents, total_cents, sort_order)
            VALUES (:iid, :desc, :qty, :rt, :upc, :total, :sort)
            RETURNING id
        """, {
            "iid": invoice["id"], "desc": li.description,
            "qty": li.quantity, "rt": li.rate_type,
            "upc": li.unit_price_cents, "total": li_total,
            "sort": li.sort_order,
        })

    return invoice


@router.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, req: InvoiceUpdate, profile: dict = Depends(require_filmmaker)):
    """Update invoice metadata (not line items)."""
    _require_pro(profile)

    existing = execute_single("""
        SELECT id, status FROM filmmaker_invoices WHERE id = :iid AND sender_id = :pid
    """, {"iid": invoice_id, "pid": profile["id"]})
    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")

    updates = {}
    for field in ["recipient_name", "recipient_email", "recipient_company",
                  "issue_date", "due_date", "tax_rate_percent", "project_name", "notes", "status"]:
        val = getattr(req, field, None)
        if val is not None:
            updates[field] = val

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["iid"] = invoice_id
    updates["pid"] = profile["id"]

    execute_update(f"""
        UPDATE filmmaker_invoices SET {set_clause}, updated_at = NOW()
        WHERE id = :iid AND sender_id = :pid
    """, updates)

    return {"success": True}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, profile: dict = Depends(require_filmmaker)):
    """Delete a draft invoice."""
    _require_pro(profile)

    existing = execute_single("""
        SELECT status FROM filmmaker_invoices WHERE id = :iid AND sender_id = :pid
    """, {"iid": invoice_id, "pid": profile["id"]})

    if not existing:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if existing["status"] not in ("draft", "canceled"):
        raise HTTPException(status_code=400, detail="Can only delete draft or canceled invoices")

    execute_update("DELETE FROM filmmaker_invoices WHERE id = :iid", {"iid": invoice_id})
    return {"success": True}


@router.post("/invoices/{invoice_id}/send")
async def send_invoice(invoice_id: str, profile: dict = Depends(require_filmmaker)):
    """Send an invoice via email."""
    _require_pro(profile)

    invoice = execute_single("""
        SELECT * FROM filmmaker_invoices WHERE id = :iid AND sender_id = :pid
    """, {"iid": invoice_id, "pid": profile["id"]})

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice.get("recipient_email"):
        raise HTTPException(status_code=400, detail="Recipient email is required to send")

    # Send email
    try:
        from app.services.email_templates import base_template, cta_button
        from app.services.email_service import send_email

        view_url = f"{settings.FRONTEND_URL}/invoice/{invoice['view_token']}"
        total_display = f"${invoice['total_cents'] / 100:,.2f}"

        html = base_template(
            f"Invoice {invoice['invoice_number']}",
            f"""
            <p>You have received an invoice from <strong>{profile.get('full_name', profile.get('display_name', 'A filmmaker'))}</strong>.</p>
            <table style="width:100%; margin: 20px 0; border-collapse: collapse;">
                <tr><td style="padding:8px; color:#999;">Invoice #</td><td style="padding:8px; color:#fff;">{invoice['invoice_number']}</td></tr>
                <tr><td style="padding:8px; color:#999;">Amount Due</td><td style="padding:8px; color:#FCDC58; font-size:24px; font-weight:bold;">{total_display}</td></tr>
                {"<tr><td style='padding:8px; color:#999;'>Due Date</td><td style='padding:8px; color:#fff;'>" + str(invoice.get('due_date', '')) + "</td></tr>" if invoice.get('due_date') else ""}
                {"<tr><td style='padding:8px; color:#999;'>Project</td><td style='padding:8px; color:#fff;'>" + invoice.get('project_name', '') + "</td></tr>" if invoice.get('project_name') else ""}
            </table>
            {cta_button("View Invoice", view_url)}
            """
        )

        await send_email(
            to=invoice["recipient_email"],
            subject=f"Invoice {invoice['invoice_number']} — {total_display}",
            html=html,
        )
    except Exception:
        pass  # Non-blocking — invoice still marked as sent

    execute_update("""
        UPDATE filmmaker_invoices SET status = 'sent', updated_at = NOW()
        WHERE id = :iid
    """, {"iid": invoice_id})

    return {"success": True}


@router.post("/invoices/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    invoice_id: str,
    payment_method: Optional[str] = None,
    payment_notes: Optional[str] = None,
    profile: dict = Depends(require_filmmaker),
):
    """Mark an invoice as paid."""
    _require_pro(profile)

    execute_update("""
        UPDATE filmmaker_invoices
        SET status = 'paid', paid_at = NOW(), payment_method = :pm, payment_notes = :pn, updated_at = NOW()
        WHERE id = :iid AND sender_id = :pid
    """, {"iid": invoice_id, "pid": profile["id"], "pm": payment_method, "pn": payment_notes})

    return {"success": True}


# Public invoice view (no auth)
@router.get("/invoices/view/{view_token}")
async def view_invoice_public(view_token: str):
    """View an invoice publicly via share token."""
    invoice = execute_single("""
        SELECT fi.*, p.full_name as sender_name, p.display_name as sender_display_name,
               p.avatar_url as sender_avatar, p.email as sender_email
        FROM filmmaker_invoices fi
        JOIN profiles p ON p.id = fi.sender_id
        WHERE fi.view_token = :token
    """, {"token": view_token})

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Mark as viewed if it was just sent
    if invoice["status"] == "sent":
        execute_update("""
            UPDATE filmmaker_invoices SET status = 'viewed', updated_at = NOW()
            WHERE view_token = :token AND status = 'sent'
        """, {"token": view_token})
        invoice["status"] = "viewed"

    items = execute_query("""
        SELECT * FROM filmmaker_invoice_line_items
        WHERE invoice_id = :iid ORDER BY sort_order ASC
    """, {"iid": invoice["id"]})

    invoice["line_items"] = items
    return invoice


# ============================================================================
# Availability (Enhanced)
# ============================================================================

class AvailabilityEntryCreate(BaseModel):
    start_date: str
    end_date: str
    status: str = "available"
    title: Optional[str] = None
    color: Optional[str] = None
    rate_cents: Optional[int] = None
    rate_type: Optional[str] = None
    is_public: bool = True
    notes: Optional[str] = None


@router.get("/availability")
async def get_availability(profile: dict = Depends(require_filmmaker)):
    """Get enhanced availability entries."""
    _require_pro(profile)
    client = get_client()
    result = client.table("availability").select("*").eq("user_id", profile["id"]).order("start_date").execute()
    return {"entries": result.data or []}


@router.post("/availability")
async def create_availability(entry: AvailabilityEntryCreate, profile: dict = Depends(require_filmmaker)):
    """Create an enhanced availability entry."""
    _require_pro(profile)
    result = execute_insert("""
        INSERT INTO availability (user_id, start_date, end_date, status, title, color,
            rate_cents, rate_type, is_public, notes)
        VALUES (:uid, :start, :end, :status, :title, :color, :rate, :rate_type, :pub, :notes)
        RETURNING *
    """, {
        "uid": profile["id"], "start": entry.start_date, "end": entry.end_date,
        "status": entry.status, "title": entry.title, "color": entry.color,
        "rate": entry.rate_cents, "rate_type": entry.rate_type,
        "pub": entry.is_public, "notes": entry.notes,
    })
    return result


@router.put("/availability/{entry_id}")
async def update_availability(entry_id: str, entry: AvailabilityEntryCreate, profile: dict = Depends(require_filmmaker)):
    """Update an availability entry."""
    _require_pro(profile)
    execute_update("""
        UPDATE availability SET start_date = :start, end_date = :end, status = :status,
            title = :title, color = :color, rate_cents = :rate, rate_type = :rate_type,
            is_public = :pub, notes = :notes
        WHERE id = :eid AND user_id = :uid
    """, {
        "eid": entry_id, "uid": profile["id"],
        "start": entry.start_date, "end": entry.end_date,
        "status": entry.status, "title": entry.title, "color": entry.color,
        "rate": entry.rate_cents, "rate_type": entry.rate_type,
        "pub": entry.is_public, "notes": entry.notes,
    })
    return {"success": True}


@router.delete("/availability/{entry_id}")
async def delete_availability(entry_id: str, profile: dict = Depends(require_filmmaker)):
    """Delete an availability entry."""
    _require_pro(profile)
    execute_update("DELETE FROM availability WHERE id = :eid AND user_id = :uid",
                   {"eid": entry_id, "uid": profile["id"]})
    return {"success": True}


# Calendar sharing
@router.get("/calendar/share")
async def get_calendar_share(profile: dict = Depends(require_filmmaker)):
    """Get or create calendar share link."""
    _require_pro(profile)

    share = execute_single("""
        SELECT * FROM filmmaker_calendar_shares WHERE profile_id = :pid
    """, {"pid": profile["id"]})

    if not share:
        share = execute_insert("""
            INSERT INTO filmmaker_calendar_shares (profile_id)
            VALUES (:pid) RETURNING *
        """, {"pid": profile["id"]})

    return {
        "share_token": share["share_token"],
        "is_active": share["is_active"],
        "share_url": f"{settings.FRONTEND_URL}/calendar/{share['share_token']}",
    }


@router.post("/calendar/share/regenerate")
async def regenerate_calendar_share(profile: dict = Depends(require_filmmaker)):
    """Regenerate calendar share token."""
    _require_pro(profile)
    execute_update("""
        UPDATE filmmaker_calendar_shares
        SET share_token = encode(gen_random_uuid()::bytea, 'hex')
        WHERE profile_id = :pid
    """, {"pid": profile["id"]})
    return await get_calendar_share(profile)


# Public calendar view
@router.get("/calendar/{share_token}")
async def view_public_calendar(share_token: str):
    """View a filmmaker's public availability calendar."""
    share = execute_single("""
        SELECT cs.profile_id, p.full_name, p.display_name, p.avatar_url
        FROM filmmaker_calendar_shares cs
        JOIN profiles p ON p.id = cs.profile_id
        WHERE cs.share_token = :token AND cs.is_active = TRUE
    """, {"token": share_token})

    if not share:
        raise HTTPException(status_code=404, detail="Calendar not found")

    entries = execute_query("""
        SELECT id, start_date, end_date, status, title, color, rate_cents, rate_type, notes
        FROM availability
        WHERE user_id = :pid AND is_public = TRUE
        ORDER BY start_date ASC
    """, {"pid": share["profile_id"]})

    return {
        "filmmaker": {
            "name": share.get("display_name") or share.get("full_name"),
            "avatar_url": share.get("avatar_url"),
        },
        "entries": entries,
    }


# ============================================================================
# Portfolio Site Generator
# ============================================================================

class PortfolioConfigUpdate(BaseModel):
    slug: Optional[str] = None
    is_published: Optional[bool] = None
    theme: Optional[str] = None
    accent_color: Optional[str] = None
    show_reel: Optional[bool] = None
    show_credits: Optional[bool] = None
    show_availability: Optional[bool] = None
    show_rate_card: Optional[bool] = None
    show_contact_form: Optional[bool] = None
    custom_headline: Optional[str] = None
    custom_intro: Optional[str] = None
    hero_image_url: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    custom_sections: Optional[list] = None


@router.get("/portfolio")
async def get_portfolio_config(profile: dict = Depends(require_filmmaker)):
    """Get portfolio configuration."""
    _require_pro(profile)

    config = execute_single("""
        SELECT * FROM filmmaker_portfolio_configs WHERE profile_id = :pid
    """, {"pid": profile["id"]})

    if not config:
        # Auto-create with username as default slug
        slug = profile.get("username", "").lower().replace(" ", "-") or str(profile["id"])[:8]
        config = execute_insert("""
            INSERT INTO filmmaker_portfolio_configs (profile_id, slug)
            VALUES (:pid, :slug)
            ON CONFLICT (profile_id) DO NOTHING
            RETURNING *
        """, {"pid": profile["id"], "slug": slug})

        if not config:
            config = execute_single("""
                SELECT * FROM filmmaker_portfolio_configs WHERE profile_id = :pid
            """, {"pid": profile["id"]})

    return config


@router.put("/portfolio")
async def update_portfolio_config(req: PortfolioConfigUpdate, profile: dict = Depends(require_filmmaker)):
    """Update portfolio configuration."""
    _require_pro(profile)

    # Ensure config exists
    await get_portfolio_config(profile)

    # Check slug uniqueness if changing
    if req.slug:
        existing = execute_single("""
            SELECT id FROM filmmaker_portfolio_configs
            WHERE slug = :slug AND profile_id != :pid
        """, {"slug": req.slug, "pid": profile["id"]})
        if existing:
            raise HTTPException(status_code=409, detail="Slug already taken")

    updates = {}
    for field in ["slug", "is_published", "theme", "accent_color", "show_reel",
                  "show_credits", "show_availability", "show_rate_card",
                  "show_contact_form", "custom_headline", "custom_intro",
                  "hero_image_url", "seo_title", "seo_description"]:
        val = getattr(req, field, None)
        if val is not None:
            updates[field] = val

    if req.custom_sections is not None:
        import json
        updates["custom_sections"] = json.dumps(req.custom_sections)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k} = :{k}" for k in updates)
    updates["pid"] = profile["id"]

    execute_update(f"""
        UPDATE filmmaker_portfolio_configs SET {set_clause}, updated_at = NOW()
        WHERE profile_id = :pid
    """, updates)

    return {"success": True}


@router.get("/portfolio/check-slug")
async def check_slug_availability(slug: str = Query(...), profile: dict = Depends(require_filmmaker)):
    """Check if a portfolio slug is available."""
    existing = execute_single("""
        SELECT id FROM filmmaker_portfolio_configs
        WHERE slug = :slug AND profile_id != :pid
    """, {"slug": slug, "pid": profile["id"]})

    return {"available": not existing, "slug": slug}


# Public portfolio data endpoint
@router.get("/p/{slug}")
async def get_public_portfolio(slug: str):
    """Get public portfolio data by slug."""
    config = execute_single("""
        SELECT pc.*, p.id as profile_id, p.username, p.full_name, p.display_name,
               p.avatar_url, p.bio, p.email
        FROM filmmaker_portfolio_configs pc
        JOIN profiles p ON p.id = pc.profile_id
        WHERE pc.slug = :slug AND pc.is_published = TRUE
    """, {"slug": slug})

    if not config:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    pid = config["profile_id"]

    # Get filmmaker profile data
    filmmaker = execute_single("""
        SELECT * FROM filmmaker_profiles WHERE user_id = :pid
    """, {"pid": pid})

    # Get credits if enabled
    credits_data = []
    if config.get("show_credits"):
        credits_data = execute_query("""
            SELECT * FROM credits WHERE user_id = :pid ORDER BY year DESC NULLS LAST, created_at DESC
        """, {"pid": pid})

    # Get rate cards if enabled
    rate_cards = []
    if config.get("show_rate_card"):
        rate_cards = execute_query("""
            SELECT id, role_name, day_rate_cents, half_day_rate_cents, weekly_rate_cents,
                   hourly_rate_cents, currency, notes, sort_order
            FROM filmmaker_rate_cards
            WHERE profile_id = :pid AND is_public = TRUE
            ORDER BY sort_order ASC
        """, {"pid": pid})

    # Get availability if enabled
    availability = []
    if config.get("show_availability"):
        availability = execute_query("""
            SELECT id, start_date, end_date, status, title, color
            FROM availability
            WHERE user_id = :pid AND is_public = TRUE AND end_date >= CURRENT_DATE
            ORDER BY start_date ASC
        """, {"pid": pid})

    return {
        "config": config,
        "filmmaker": filmmaker,
        "credits": credits_data,
        "rate_cards": rate_cards,
        "availability": availability,
    }


# ============================================================================
# Analytics Recording (called as side-effects from other endpoints)
# ============================================================================

async def record_profile_view(profile_id: str, viewer_id: Optional[str] = None,
                              source: str = "direct", viewer_ip_hash: Optional[str] = None):
    """Record a profile view (called from profile/community endpoints)."""
    try:
        if viewer_id == profile_id:
            return  # Don't count self-views
        execute_insert("""
            INSERT INTO profile_views (profile_id, viewer_id, source, viewer_ip_hash)
            VALUES (:pid, :vid, :source, :ip)
            RETURNING id
        """, {"pid": profile_id, "vid": viewer_id, "source": source, "ip": viewer_ip_hash})
    except Exception:
        pass  # Non-blocking


async def record_search_appearance(profile_ids: list, context: str):
    """Record search appearances for multiple profiles."""
    try:
        for pid in profile_ids:
            execute_insert("""
                INSERT INTO profile_search_appearances (profile_id, search_context)
                VALUES (:pid, :ctx) RETURNING id
            """, {"pid": pid, "ctx": context})
    except Exception:
        pass  # Non-blocking


async def rollup_daily_analytics():
    """Roll up raw events into daily aggregates. Called by scheduler."""
    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Roll up yesterday's profile views
    execute_update("""
        INSERT INTO profile_analytics_daily (profile_id, date, views_count, unique_viewers)
        SELECT profile_id, :yesterday::date,
               COUNT(*) as views_count,
               COUNT(DISTINCT COALESCE(viewer_id::text, viewer_ip_hash)) as unique_viewers
        FROM profile_views
        WHERE created_at >= :yesterday::date AND created_at < :today::date
        GROUP BY profile_id
        ON CONFLICT (profile_id, date) DO UPDATE SET
            views_count = EXCLUDED.views_count,
            unique_viewers = EXCLUDED.unique_viewers
    """, {"yesterday": yesterday, "today": today})

    # Roll up search appearances
    execute_update("""
        UPDATE profile_analytics_daily pad
        SET search_appearances = sub.cnt
        FROM (
            SELECT profile_id, COUNT(*) as cnt
            FROM profile_search_appearances
            WHERE created_at >= :yesterday::date AND created_at < :today::date
            GROUP BY profile_id
        ) sub
        WHERE pad.profile_id = sub.profile_id AND pad.date = :yesterday::date
    """, {"yesterday": yesterday, "today": today})

    # Also insert rows for profiles that only had search appearances
    execute_update("""
        INSERT INTO profile_analytics_daily (profile_id, date, search_appearances)
        SELECT profile_id, :yesterday::date, COUNT(*)
        FROM profile_search_appearances
        WHERE created_at >= :yesterday::date AND created_at < :today::date
        AND profile_id NOT IN (
            SELECT profile_id FROM profile_analytics_daily WHERE date = :yesterday::date
        )
        GROUP BY profile_id
        ON CONFLICT (profile_id, date) DO UPDATE SET
            search_appearances = EXCLUDED.search_appearances
    """, {"yesterday": yesterday, "today": today})

    # Clean up raw events older than 90 days
    cutoff = (date.today() - timedelta(days=90)).isoformat()
    execute_update("DELETE FROM profile_views WHERE created_at < :cutoff::timestamptz", {"cutoff": cutoff})
    execute_update("DELETE FROM profile_search_appearances WHERE created_at < :cutoff::timestamptz", {"cutoff": cutoff})


# ============================================================================
# Webhook handler helper (called from billing.py)
# ============================================================================

async def handle_filmmaker_pro_webhook(customer_id: str, subscription: dict, is_active: bool):
    """Handle Stripe subscription webhook for Filmmaker Pro."""
    from datetime import datetime as dt

    profile = execute_single("""
        SELECT id FROM profiles WHERE stripe_customer_id = :cid
    """, {"cid": customer_id})

    if not profile:
        return

    pid = profile["id"]
    status = subscription.get("status", "inactive")
    period_start = subscription.get("current_period_start")
    period_end = subscription.get("current_period_end")
    plan = subscription.get("metadata", {}).get("plan", "monthly")

    period_start_dt = dt.fromtimestamp(period_start).isoformat() if period_start else None
    period_end_dt = dt.fromtimestamp(period_end).isoformat() if period_end else None

    # Trial end
    trial_end = subscription.get("trial_end")
    trial_end_dt = dt.fromtimestamp(trial_end).isoformat() if trial_end else None

    cancel_at = subscription.get("canceled_at")
    cancel_at_dt = dt.fromtimestamp(cancel_at).isoformat() if cancel_at else None
    cancel_at_period_end = subscription.get("cancel_at_period_end", False)

    # Upsert subscription record
    execute_update("""
        INSERT INTO filmmaker_pro_subscriptions
            (profile_id, stripe_customer_id, stripe_subscription_id, status, plan,
             current_period_start, current_period_end, trial_ends_at,
             canceled_at, cancel_at_period_end, updated_at)
        VALUES (:pid, :cid, :sid, :status, :plan, :ps, :pe, :trial, :cancel, :cap, NOW())
        ON CONFLICT (profile_id) DO UPDATE SET
            stripe_customer_id = EXCLUDED.stripe_customer_id,
            stripe_subscription_id = EXCLUDED.stripe_subscription_id,
            status = EXCLUDED.status,
            plan = EXCLUDED.plan,
            current_period_start = EXCLUDED.current_period_start,
            current_period_end = EXCLUDED.current_period_end,
            trial_ends_at = EXCLUDED.trial_ends_at,
            canceled_at = EXCLUDED.canceled_at,
            cancel_at_period_end = EXCLUDED.cancel_at_period_end,
            updated_at = NOW()
    """, {
        "pid": pid, "cid": customer_id,
        "sid": subscription.get("id"),
        "status": status if is_active else "canceled",
        "plan": plan,
        "ps": period_start_dt, "pe": period_end_dt,
        "trial": trial_end_dt, "cancel": cancel_at_dt,
        "cap": cancel_at_period_end,
    })

    # Update profile flag
    execute_update("""
        UPDATE profiles SET is_filmmaker_pro = :active WHERE id = :pid
    """, {"active": is_active, "pid": pid})
