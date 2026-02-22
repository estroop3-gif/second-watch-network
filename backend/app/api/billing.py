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


@router.get("/config")
async def get_billing_config():
    """Return public Stripe config for frontend. Publishable key is safe to expose."""
    return {"publishable_key": settings.STRIPE_PUBLISHABLE_KEY}


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
    - User is admin/superadmin, OR
    - User has an active organization seat (owner/admin/collaborative)
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

    profile_id = profile["id"]

    # Admins always have access
    if profile.get("is_admin") or profile.get("is_superadmin"):
        return {"has_access": True, "reason": "admin"}

    # Check backlot subscription status
    backlot_status = profile.get("backlot_subscription_status")
    if backlot_status in ["active", "trialing"]:
        return {"has_access": True, "reason": "subscription"}

    # Check for organization seat access (including expired trials and past_due for read-only)
    org_seat = execute_single("""
        SELECT
            o.id as organization_id,
            o.name as organization_name,
            o.backlot_billing_status,
            o.trial_ends_at,
            o.past_due_since,
            om.role,
            om.can_create_projects
        FROM organization_members om
        JOIN organizations o ON om.organization_id = o.id
        WHERE om.user_id = :user_id
          AND om.status = 'active'
          AND om.role IN ('owner', 'admin', 'collaborative')
          AND o.backlot_enabled = TRUE
          AND o.backlot_billing_status IN ('free', 'trial', 'active', 'expired', 'past_due', 'canceled')
        LIMIT 1
    """, {"user_id": profile_id})

    if org_seat:
        billing_status = org_seat["backlot_billing_status"]
        is_expired = billing_status == "expired"
        is_canceled = billing_status == "canceled"
        is_past_due = billing_status == "past_due"

        # Determine if past_due is within or beyond the 7-day grace period
        past_grace = False
        grace_info = None
        if is_past_due and org_seat.get("past_due_since"):
            from datetime import datetime, timedelta
            past_due_since = org_seat["past_due_since"]
            if hasattr(past_due_since, "timestamp"):
                grace_end = past_due_since + timedelta(days=7)
                days_remaining = max(0, (grace_end - datetime.utcnow()).days)
                past_grace = days_remaining <= 0
                grace_info = {
                    "past_due_since": past_due_since.isoformat(),
                    "grace_period_end": grace_end.isoformat(),
                    "grace_days_remaining": days_remaining,
                }

        # Read-only if expired, canceled, or past grace period
        is_read_only = is_expired or is_canceled or past_grace

        result = {
            "has_access": True,
            "reason": "organization_seat",
            "organization_id": org_seat["organization_id"],
            "organization_name": org_seat["organization_name"],
            "role": org_seat["role"],
            "can_create_projects": (org_seat["can_create_projects"] or False) and not is_read_only,
            "billing_status": billing_status,
        }
        if is_read_only:
            result["read_only"] = True
            if is_expired:
                result["expired_reason"] = "trial_expired"
            elif is_canceled:
                result["expired_reason"] = "subscription_canceled"
            elif past_grace:
                result["expired_reason"] = "payment_past_due"
        if is_past_due and grace_info:
            result["grace_info"] = grace_info
        if org_seat.get("trial_ends_at"):
            result["trial_ends_at"] = org_seat["trial_ends_at"].isoformat() if hasattr(org_seat["trial_ends_at"], "isoformat") else str(org_seat["trial_ends_at"])
        return result

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

        # Backlot org subscriptions — route to subscription_service
        if product == "backlot_org":
            config_id = subscription.get("metadata", {}).get("config_id")
            if config_id:
                from app.services.subscription_service import handle_subscription_activated
                handle_subscription_activated(subscription, config_id, event.get("id"))
        elif product == "order_dues":
            await _handle_order_dues_event(subscription, is_active=True)
        else:
            await _update_subscription_status(customer_id, subscription, product, is_active=True)

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        status = subscription["status"]
        product = subscription.get("metadata", {}).get("product", "premium")

        if product == "backlot_org":
            org_id = subscription.get("metadata", {}).get("organization_id")
            config_id = subscription.get("metadata", {}).get("config_id")
            if org_id:
                from app.services.subscription_service import (
                    handle_subscription_activated,
                    handle_payment_failed,
                    handle_subscription_canceled,
                )
                if status in ("active", "trialing"):
                    # Payment recovered or initial activation
                    if config_id:
                        handle_subscription_activated(subscription, config_id, event.get("id"))
                elif status == "past_due":
                    handle_payment_failed(subscription, org_id, event.get("id"))
                elif status == "canceled":
                    handle_subscription_canceled(subscription, org_id, event.get("id"))
        elif product == "order_dues":
            is_active = status in ["active", "trialing"]
            await _handle_order_dues_event(subscription, is_active=is_active)
        else:
            is_active = status in ["active", "trialing"]
            await _update_subscription_status(customer_id, subscription, product, is_active=is_active)

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription["customer"]
        product = subscription.get("metadata", {}).get("product", "premium")

        if product == "backlot_org":
            org_id = subscription.get("metadata", {}).get("organization_id")
            if org_id:
                from app.services.subscription_service import handle_subscription_canceled
                handle_subscription_canceled(subscription, org_id, event.get("id"))
        elif product == "order_dues":
            await _handle_order_dues_event(subscription, is_active=False)
        else:
            await _update_subscription_status(customer_id, subscription, product, is_active=False)

    # Handle invoice payment succeeded (for recovering past_due)
    elif event["type"] == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        sub_id = invoice.get("subscription")
        if sub_id:
            # Check if this is a backlot_org subscription recovering from past_due
            config = execute_single("""
                SELECT id, organization_id, status FROM backlot_subscription_configs
                WHERE stripe_subscription_id = :sub_id AND status = 'past_due'
            """, {"sub_id": sub_id})
            if config:
                from app.services.subscription_service import handle_subscription_activated
                handle_subscription_activated(
                    {"id": sub_id}, str(config["id"]), event.get("id")
                )

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

        # Handle greenroom ticket purchases
        elif metadata.get("type") == "greenroom_tickets":
            await _process_greenroom_ticket_success(metadata)

        # Handle featured post payments
        elif metadata.get("type") == "featured_post":
            await _process_featured_post_success(metadata)

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


async def _handle_order_dues_event(subscription: dict, is_active: bool):
    """Handle Order membership dues subscription events.

    Updates the member's dues status and tier on the order_member_profiles table,
    records a payment entry, and sets the is_order_member flag on profiles.
    """
    from datetime import datetime

    metadata = subscription.get("metadata", {})
    user_id = metadata.get("user_id")
    tier = metadata.get("tier", "base")

    if not user_id:
        # Try to resolve from Stripe customer
        customer_id = subscription.get("customer")
        profile = execute_single(
            "SELECT id FROM profiles WHERE stripe_customer_id = :cid",
            {"customer_id": customer_id},
        ) if customer_id else None
        if profile:
            user_id = str(profile["id"])
        else:
            return

    status = subscription.get("status", "")
    period_end = subscription.get("current_period_end")
    period_start = subscription.get("current_period_start")

    period_start_dt = datetime.fromtimestamp(period_start).isoformat() if period_start else None
    period_end_dt = datetime.fromtimestamp(period_end).isoformat() if period_end else None

    dues_status = "active" if is_active else "canceled"

    # Update order_member_profiles
    execute_update("""
        UPDATE order_member_profiles
        SET dues_status = :dues_status,
            membership_tier = :tier,
            status = CASE
                WHEN :is_active AND status = 'probationary' THEN 'active'
                ELSE status
            END,
            updated_at = NOW()
        WHERE user_id = :user_id
    """, {
        "dues_status": dues_status,
        "tier": tier,
        "is_active": is_active,
        "user_id": user_id,
    })

    # Set is_order_member on profiles
    if is_active:
        execute_update("""
            UPDATE profiles SET is_order_member = TRUE WHERE id = :user_id
        """, {"user_id": user_id})
    elif status == "canceled":
        execute_update("""
            UPDATE profiles SET is_order_member = FALSE WHERE id = :user_id
        """, {"user_id": user_id})

    # Record dues payment when subscription becomes active
    if is_active and status in ("active", "trialing"):
        from app.core.database import execute_insert

        # Get amount from subscription items
        items = subscription.get("items", {}).get("data", [])
        amount_cents = items[0]["price"]["unit_amount"] if items else 0

        execute_insert("""
            INSERT INTO order_dues_payments (user_id, amount_cents, tier, stripe_invoice_id, status, period_start, period_end, created_at)
            VALUES (:user_id, :amount_cents, :tier, :invoice_id, 'succeeded', :period_start, :period_end, NOW())
        """, {
            "user_id": user_id,
            "amount_cents": amount_cents,
            "tier": tier,
            "invoice_id": subscription.get("latest_invoice"),
            "period_start": period_start_dt,
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


async def _process_greenroom_ticket_success(metadata: dict):
    """Process a successful greenroom ticket purchase."""
    from app.core.database import get_client

    ticket_id = metadata.get("ticket_id")
    user_id = metadata.get("user_id")
    cycle_id = metadata.get("cycle_id")

    if not ticket_id:
        print(f"Warning: greenroom ticket payment missing ticket_id in metadata")
        return

    client = get_client()

    # Update ticket payment status to completed
    result = client.table("greenroom_voting_tickets").update({
        "payment_status": "completed",
    }).eq("id", int(ticket_id)).execute()

    if result.data:
        print(f"Greenroom ticket {ticket_id} marked as completed for user {user_id}")
    else:
        print(f"Warning: Could not update greenroom ticket {ticket_id}")


async def _process_featured_post_success(metadata: dict):
    """Process a successful featured post payment."""
    from app.core.database import get_client
    from datetime import datetime

    post_type = metadata.get("post_type")  # 'role_application' or 'collab_application'
    post_id = metadata.get("post_id")
    user_id = metadata.get("user_id")

    if not post_id or not post_type:
        print(f"Warning: featured post payment missing post_id or post_type")
        return

    client = get_client()
    now = datetime.utcnow().isoformat()

    if post_type == "role_application":
        client.table("backlot_project_role_applications").update({
            "is_promoted": True,
            "promoted_at": now,
            "updated_at": now,
        }).eq("id", post_id).execute()
    elif post_type == "collab_application":
        client.table("community_collab_applications").update({
            "is_promoted": True,
            "promoted_at": now,
            "updated_at": now,
        }).eq("id", post_id).execute()

    print(f"Featured post {post_type}/{post_id} promoted for user {user_id}")
