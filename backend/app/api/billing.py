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
    plan: str = "premium"
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

    # Determine price ID
    price_id = settings.STRIPE_PREMIUM_PRICE_ID
    if request.plan == "premium_yearly":
        price_id = settings.STRIPE_PREMIUM_YEARLY_PRICE_ID

    if not price_id:
        raise HTTPException(status_code=500, detail="Stripe price not configured")

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
            "context": request.context or "",
        }
    )

    return {"url": session.url}


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
        await _update_subscription_status(customer_id, "premium", subscription)

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        status = subscription["status"]

        if status in ["active", "trialing"]:
            await _update_subscription_status(customer_id, "premium", subscription)
        elif status in ["canceled", "unpaid", "past_due"]:
            await _update_subscription_status(customer_id, "free", subscription)

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        await _update_subscription_status(customer_id, "free", subscription)

    return {"received": True}


async def _update_subscription_status(customer_id: str, tier: str, subscription: dict):
    """Update user's subscription tier based on Stripe webhook."""
    # Find profile by stripe customer ID
    profile = execute_single("""
        SELECT id, role FROM profiles WHERE stripe_customer_id = :customer_id
    """, {"customer_id": customer_id})

    if not profile:
        return

    # Update role based on tier
    new_role = profile.get("role", "member")
    if tier == "premium":
        new_role = "premium"
    elif tier == "free" and new_role == "premium":
        new_role = "member"

    # Update profile
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
        "status": subscription.get("status"),
        "period_end": subscription.get("current_period_end"),
    })
