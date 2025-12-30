"""
Billing API Routes

Handles Stripe subscription management.
"""
import os
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional

from app.core.config import settings
from app.core.auth import get_current_user
from app.core.database import execute_single, execute_update

router = APIRouter()


class CheckoutSessionRequest(BaseModel):
    plan: str = "monthly"  # monthly or yearly
    product: str = "premium"  # premium or backlot
    context: Optional[str] = None
    returnTo: Optional[str] = None


class PortalSessionRequest(BaseModel):
    returnTo: Optional[str] = None


def get_stripe():
    """Get Stripe client, raising error if not configured."""
    import stripe
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


@router.post("/checkout-session")
async def create_checkout_session(
    request: CheckoutSessionRequest,
    user=Depends(get_current_user)
):
    """Create a Stripe checkout session for subscription."""
    stripe = get_stripe()

    user_id = user.get("id")
    email = user.get("email")

    # Get or create Stripe customer
    profile = execute_single("""
        SELECT id, stripe_customer_id FROM profiles
        WHERE cognito_user_id = :user_id OR id::text = :user_id OR email = :email
    """, {"user_id": user_id, "email": email})

    customer_id = profile.get("stripe_customer_id") if profile else None

    if not customer_id:
        # Create Stripe customer
        customer = stripe.Customer.create(
            email=email,
            metadata={"user_id": user_id}
        )
        customer_id = customer.id

        # Save to profile
        if profile:
            execute_update("""
                UPDATE profiles SET stripe_customer_id = :customer_id WHERE id = :id
            """, {"customer_id": customer_id, "id": profile["id"]})

    # Determine price ID based on product and plan
    if request.product == "backlot":
        if request.plan == "yearly":
            price_id = settings.STRIPE_BACKLOT_YEARLY_PRICE_ID
        else:
            price_id = settings.STRIPE_BACKLOT_MONTHLY_PRICE_ID
    else:  # premium (content subscription)
        if request.plan == "yearly" or request.plan == "premium_yearly":
            price_id = settings.STRIPE_PREMIUM_YEARLY_PRICE_ID
        else:
            price_id = settings.STRIPE_PREMIUM_PRICE_ID

    if not price_id:
        raise HTTPException(status_code=500, detail=f"Stripe price not configured for {request.product} {request.plan}")

    # Build URLs
    base_url = settings.FRONTEND_URL
    success_url = f"{base_url}/account/billing?checkout=success"
    cancel_url = f"{base_url}/subscriptions?checkout=cancelled"

    if request.returnTo:
        success_url = f"{base_url}/account/billing?checkout=success&returnTo={request.returnTo}"
        cancel_url = f"{base_url}/subscriptions?checkout=cancelled"

    # Create checkout session
    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user_id,
            "product": request.product,
            "context": request.context or "",
        },
        subscription_data={
            "metadata": {
                "user_id": user_id,
                "product": request.product,
            }
        }
    )

    return {"url": session.url}


@router.get("/backlot/access")
async def check_backlot_access(user=Depends(get_current_user)):
    """Check if current user has backlot access.

    Returns True if:
    - Stripe backlot prices not configured (dev mode), OR
    - User has active backlot subscription, OR
    - User is admin/superadmin
    """
    # If Stripe backlot prices not configured, grant access to all (dev mode)
    if not settings.STRIPE_BACKLOT_MONTHLY_PRICE_ID:
        return {"has_access": True, "reason": "dev_mode"}

    user_id = user.get("id")
    email = user.get("email")

    profile = execute_single("""
        SELECT id, is_admin, is_superadmin, backlot_subscription_status
        FROM profiles
        WHERE cognito_user_id = :user_id OR id::text = :user_id OR email = :email
    """, {"user_id": user_id, "email": email})

    if not profile:
        return {"has_access": False, "reason": "no_profile"}

    # Admins always have access
    if profile.get("is_admin") or profile.get("is_superadmin"):
        return {"has_access": True, "reason": "admin"}

    # Check backlot subscription status
    backlot_status = profile.get("backlot_subscription_status")
    if backlot_status in ["active", "trialing"]:
        return {"has_access": True, "reason": "subscription"}

    return {"has_access": False, "reason": "no_subscription"}


@router.post("/portal-session")
async def create_portal_session(
    request: PortalSessionRequest,
    user=Depends(get_current_user)
):
    """Create a Stripe billing portal session."""
    stripe = get_stripe()

    user_id = user.get("id")
    email = user.get("email")

    # Get profile with Stripe customer ID
    profile = execute_single("""
        SELECT stripe_customer_id FROM profiles
        WHERE cognito_user_id = :user_id OR id::text = :user_id OR email = :email
    """, {"user_id": user_id, "email": email})

    customer_id = profile.get("stripe_customer_id") if profile else None

    if not customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")

    # Build return URL
    return_url = f"{settings.FRONTEND_URL}/account/billing"
    if request.returnTo:
        return_url = f"{settings.FRONTEND_URL}{request.returnTo}"

    # Create portal session
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )

    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks."""
    stripe = get_stripe()

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle subscription events
    if event["type"] == "customer.subscription.created":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        product = subscription.get("metadata", {}).get("product", "premium")
        await _update_subscription_status(customer_id, subscription, product, is_active=True)

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        status = subscription["status"]
        product = subscription.get("metadata", {}).get("product", "premium")

        is_active = status in ["active", "trialing"]
        await _update_subscription_status(customer_id, subscription, product, is_active=is_active)

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        product = subscription.get("metadata", {}).get("product", "premium")
        await _update_subscription_status(customer_id, subscription, product, is_active=False)

    # Handle checkout session completed - for one-time donations
    elif event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})

        # Check if this is a project donation
        if metadata.get("type") == "project_donation":
            donation_id = metadata.get("donation_id")
            project_id = metadata.get("project_id")
            payment_intent_id = session.get("payment_intent")

            if donation_id:
                await _process_donation_success(donation_id, payment_intent_id)

    return {"received": True}


async def _update_subscription_status(
    customer_id: str,
    subscription: dict,
    product: str = "premium",
    is_active: bool = True
):
    """Update user's subscription status based on Stripe webhook.

    Args:
        customer_id: Stripe customer ID
        subscription: Stripe subscription object
        product: 'premium' (content) or 'backlot' subscription
        is_active: Whether the subscription is currently active
    """
    from datetime import datetime

    # Find profile by stripe customer ID
    profile = execute_single("""
        SELECT id, role FROM profiles WHERE stripe_customer_id = :customer_id
    """, {"customer_id": customer_id})

    if not profile:
        return

    status = subscription.get("status")
    period_end = subscription.get("current_period_end")

    # Convert Unix timestamp to datetime if present
    period_end_dt = None
    if period_end:
        period_end_dt = datetime.fromtimestamp(period_end).isoformat()

    if product == "backlot":
        # Update backlot subscription fields
        execute_update("""
            UPDATE profiles
            SET backlot_subscription_status = :status,
                backlot_subscription_period_end = :period_end,
                backlot_subscription_id = :subscription_id
            WHERE id = :id
        """, {
            "id": profile["id"],
            "status": status if is_active else "canceled",
            "period_end": period_end_dt,
            "subscription_id": subscription.get("id"),
        })
    else:
        # Update premium (content) subscription fields
        new_role = profile.get("role", "member")
        tier = "premium" if is_active else "free"

        if is_active:
            new_role = "premium"
        elif new_role == "premium":
            new_role = "member"

        execute_update("""
            UPDATE profiles
            SET role = :role,
                subscription_tier = :tier,
                subscription_status = :status,
                subscription_period_end = :period_end
            WHERE id = :id
        """, {
            "id": profile["id"],
            "role": new_role,
            "tier": tier,
            "status": status,
            "period_end": period_end_dt,
        })


async def _process_donation_success(donation_id: str, payment_intent_id: str):
    """
    Process a successful donation payment.
    Updates donation status to 'succeeded' and stores payment intent ID.
    """
    from app.core.database import get_client

    client = get_client()

    # Update the donation record
    result = client.table("project_donations").update({
        "status": "succeeded",
        "stripe_payment_intent_id": payment_intent_id,
    }).eq("id", donation_id).execute()

    if not result.data:
        print(f"Warning: Could not update donation {donation_id}")
        return

    donation = result.data[0]
    project_id = donation.get("project_id")
    donor_name = donation.get("donor_name")
    amount_cents = donation.get("amount_cents", 0)
    is_anonymous = donation.get("is_anonymous", False)

    # Create notification for project owner
    if project_id:
        # Get project owner
        project_result = client.table("backlot_projects").select(
            "owner_id, title"
        ).eq("id", project_id).single().execute()

        if project_result.data:
            owner_id = project_result.data["owner_id"]
            project_title = project_result.data.get("title", "your project")

            # Format amount for display
            amount_dollars = amount_cents / 100

            # Build notification message
            if is_anonymous:
                message = f"Someone donated ${amount_dollars:.2f} to {project_title}!"
            else:
                donor_display = donor_name or "A supporter"
                message = f"{donor_display} donated ${amount_dollars:.2f} to {project_title}!"

            # Create notification
            client.table("notifications").insert({
                "user_id": owner_id,
                "type": "donation_received",
                "title": "New Donation Received!",
                "message": message,
                "link": f"/backlot/projects/{project_id}/overview",
                "related_id": donation_id,
                "related_type": "donation",
            }).execute()

    print(f"Donation {donation_id} processed successfully")
