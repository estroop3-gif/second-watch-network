"""
Subscription Billing Service — Stripe orchestration layer.

Handles checkout session creation, subscription activation/cancellation,
plan changes, module add-ons, and syncing org limits from subscription configs.
"""
import json
from datetime import datetime
from typing import Dict, Any, Optional, List

from app.core.config import settings
from app.core.database import execute_single, execute_insert, execute_query, execute_update
from app.core.logging import get_logger

logger = get_logger(__name__)

GRACE_PERIOD_DAYS = 7


def _get_stripe():
    """Get configured Stripe client."""
    import stripe
    if not settings.STRIPE_SECRET_KEY:
        raise Exception("Stripe not configured")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def _log_billing_event(
    org_id: str,
    event_type: str,
    config_id: Optional[str] = None,
    old_status: Optional[str] = None,
    new_status: Optional[str] = None,
    stripe_event_id: Optional[str] = None,
    metadata: Optional[Dict] = None,
):
    """Insert a billing audit event."""
    try:
        execute_insert("""
            INSERT INTO backlot_billing_events
                (organization_id, subscription_config_id, event_type, old_status, new_status, stripe_event_id, metadata)
            VALUES (:org_id, :config_id, :event_type, :old_status, :new_status, :stripe_event_id, :metadata::jsonb)
            RETURNING id
        """, {
            "org_id": org_id,
            "config_id": config_id,
            "event_type": event_type,
            "old_status": old_status,
            "new_status": new_status,
            "stripe_event_id": stripe_event_id,
            "metadata": json.dumps(metadata or {}),
        })
    except Exception as e:
        logger.warning(f"Failed to log billing event: {e}")


def _get_or_create_stripe_customer(org_id: str, profile_id: str) -> str:
    """Get or create a Stripe customer for the organization."""
    stripe = _get_stripe()

    org = execute_single(
        "SELECT id, name, stripe_customer_id FROM organizations WHERE id = :oid",
        {"oid": org_id},
    )
    if not org:
        raise ValueError(f"Organization {org_id} not found")

    if org.get("stripe_customer_id"):
        return org["stripe_customer_id"]

    profile = execute_single(
        "SELECT email, full_name FROM profiles WHERE id = :pid",
        {"pid": profile_id},
    )
    email = profile.get("email", "") if profile else ""

    customer = stripe.Customer.create(
        name=org.get("name", ""),
        email=email,
        metadata={"organization_id": org_id, "product": "backlot_org"},
    )

    execute_update(
        "UPDATE organizations SET stripe_customer_id = :cid WHERE id = :oid",
        {"cid": customer.id, "oid": org_id},
    )

    return customer.id


# =============================================================================
# Free Tier Activation
# =============================================================================

def activate_free_tier(org_id: str, profile_id: str) -> Dict[str, Any]:
    """Activate the free tier for an organization. No Stripe needed."""
    from app.services.pricing_engine import get_tier

    tier = get_tier("free")

    config_row = execute_insert("""
        INSERT INTO backlot_subscription_configs (
            organization_id, plan_type, tier_name,
            owner_seats, collaborative_seats, active_projects,
            non_collaborative_per_project, view_only_per_project,
            active_storage_gb, archive_storage_gb, bandwidth_gb,
            monthly_total_cents, annual_prepay, effective_monthly_cents,
            status, created_by, module_config
        ) VALUES (
            :org_id, 'tier', 'free',
            :owner_seats, :collaborative_seats, :active_projects,
            :nc_per_project, :vo_per_project,
            :active_storage_gb, :archive_storage_gb, :bandwidth_gb,
            0, FALSE, 0,
            'free', :created_by, '{}'::jsonb
        ) RETURNING id
    """, {
        "org_id": org_id,
        "owner_seats": tier["org_seats"]["owner"],
        "collaborative_seats": max(0, tier["org_seats"]["collaborative"]),
        "active_projects": max(1, tier["active_projects"]),
        "nc_per_project": max(0, tier["project_seats"]["non_collaborative"]),
        "vo_per_project": max(0, tier["project_seats"]["view_only"]),
        "active_storage_gb": tier["storage"]["active_gb"],
        "archive_storage_gb": tier["storage"]["archive_gb"],
        "bandwidth_gb": tier["bandwidth_gb"],
        "created_by": profile_id,
    })

    config_id = config_row["id"]

    execute_update("""
        UPDATE organizations
        SET active_subscription_config_id = :cid,
            backlot_billing_status = 'free'
        WHERE id = :oid
    """, {"cid": config_id, "oid": org_id})

    sync_limits_from_config(org_id, {
        "owner_seats": tier["org_seats"]["owner"],
        "collaborative_seats": max(0, tier["org_seats"]["collaborative"]),
        "active_projects": max(1, tier["active_projects"]),
        "non_collaborative_per_project": max(0, tier["project_seats"]["non_collaborative"]),
        "view_only_per_project": max(0, tier["project_seats"]["view_only"]),
        "active_storage_gb": tier["storage"]["active_gb"],
        "archive_storage_gb": tier["storage"]["archive_gb"],
        "bandwidth_gb": tier["bandwidth_gb"],
    })

    _log_billing_event(org_id, "free_tier_activated", str(config_id))

    return {"success": True, "config_id": str(config_id), "tier": "free"}


# =============================================================================
# Checkout
# =============================================================================

def create_checkout_session(
    org_id: str,
    profile_id: str,
    plan_config: Dict[str, Any],
) -> Dict[str, Any]:
    """Create a Stripe Checkout Session for a new subscription."""
    stripe = _get_stripe()
    from app.services.pricing_engine import compute_self_service_quote

    plan_type = plan_config.get("plan_type", "tier")
    tier_name = plan_config.get("tier_name")
    config = plan_config.get("config", {})
    term_type = config.get("term_type", "monthly")

    # Free tier: no Stripe needed
    if tier_name == "free":
        return activate_free_tier(org_id, profile_id)

    quote = compute_self_service_quote(plan_type, tier_name, config)

    # Determine billing amount
    if term_type == "annual":
        unit_amount = quote["effective_monthly_cents"]
        interval = "month"
        description = f"Backlot {'(' + tier_name.title() + ') ' if tier_name else ''}Annual (pay 10 for 12)"
    else:
        unit_amount = quote["monthly_total_cents"]
        interval = "month"
        description = f"Backlot {'(' + tier_name.title() + ') ' if tier_name else ''}Monthly"

    customer_id = _get_or_create_stripe_customer(org_id, profile_id)

    product = stripe.Product.create(
        name=description,
        metadata={"product": "backlot_org", "organization_id": org_id, "plan_type": plan_type},
    )

    price = stripe.Price.create(
        product=product.id,
        unit_amount=unit_amount,
        currency="usd",
        recurring={"interval": interval},
    )

    config_summary = quote["config_summary"]
    annual_prepay = term_type == "annual"
    selected_modules = config.get("selected_modules", [])
    use_bundle = config.get("use_bundle", False)

    config_row = execute_insert("""
        INSERT INTO backlot_subscription_configs (
            organization_id, plan_type, tier_name,
            owner_seats, collaborative_seats, active_projects,
            non_collaborative_per_project, view_only_per_project,
            active_storage_gb, archive_storage_gb, bandwidth_gb,
            monthly_total_cents, annual_prepay, effective_monthly_cents,
            stripe_product_id, stripe_price_id, stripe_customer_id,
            status, created_by, module_config
        ) VALUES (
            :org_id, :plan_type, :tier_name,
            :owner_seats, :collaborative_seats, :active_projects,
            :nc_per_project, :vo_per_project,
            :active_storage_gb, :archive_storage_gb, :bandwidth_gb,
            :monthly_total_cents, :annual_prepay, :effective_monthly_cents,
            :stripe_product_id, :stripe_price_id, :stripe_customer_id,
            'pending_checkout', :created_by, :module_config::jsonb
        ) RETURNING id
    """, {
        "org_id": org_id,
        "plan_type": plan_type,
        "tier_name": tier_name,
        "owner_seats": config_summary["owner_seats"],
        "collaborative_seats": config_summary["collaborative_seats"],
        "active_projects": config_summary["active_projects"],
        "nc_per_project": config_summary["non_collaborative_per_project"],
        "vo_per_project": config_summary["view_only_per_project"],
        "active_storage_gb": config_summary.get("active_storage_gb", 0),
        "archive_storage_gb": config_summary.get("archive_storage_gb", 0),
        "bandwidth_gb": config_summary["bandwidth_gb"],
        "monthly_total_cents": quote["monthly_total_cents"],
        "annual_prepay": annual_prepay,
        "effective_monthly_cents": quote["effective_monthly_cents"],
        "stripe_product_id": product.id,
        "stripe_price_id": price.id,
        "stripe_customer_id": customer_id,
        "created_by": profile_id,
        "module_config": json.dumps({"selected_modules": selected_modules, "use_bundle": use_bundle}),
    })

    config_id = config_row["id"]

    base_url = settings.FRONTEND_URL
    success_url = f"{base_url}/subscribe/backlot/confirmation?config_id={config_id}"
    cancel_url = f"{base_url}/pricing?checkout=cancelled"

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "product": "backlot_org",
            "organization_id": org_id,
            "config_id": str(config_id),
        },
        subscription_data={
            "metadata": {
                "product": "backlot_org",
                "organization_id": org_id,
                "config_id": str(config_id),
            },
        },
    )

    _log_billing_event(org_id, "checkout_created", str(config_id), metadata={
        "checkout_session_id": session.id,
        "monthly_total_cents": quote["monthly_total_cents"],
    })

    return {"checkout_url": session.url, "config_id": str(config_id)}


# =============================================================================
# Subscription Lifecycle
# =============================================================================

def handle_subscription_activated(
    stripe_subscription: Dict,
    config_id: str,
    stripe_event_id: Optional[str] = None,
):
    """Handle a subscription becoming active."""
    config = execute_single(
        "SELECT * FROM backlot_subscription_configs WHERE id = :cid",
        {"cid": config_id},
    )
    if not config:
        logger.error(f"Config {config_id} not found for activation")
        return

    org_id = str(config["organization_id"])
    old_status = config["status"]

    execute_update("""
        UPDATE backlot_subscription_configs
        SET status = 'active',
            stripe_subscription_id = :sub_id,
            past_due_since = NULL,
            updated_at = NOW()
        WHERE id = :cid
    """, {"sub_id": stripe_subscription.get("id", ""), "cid": config_id})

    execute_update("""
        UPDATE organizations
        SET active_subscription_config_id = :cid,
            backlot_billing_status = 'active',
            past_due_since = NULL
        WHERE id = :oid
    """, {"cid": config_id, "oid": org_id})

    sync_limits_from_config(org_id, config)

    # Activate modules from config
    module_config = config.get("module_config") or {}
    if isinstance(module_config, str):
        module_config = json.loads(module_config)
    _sync_modules_from_config(org_id, config_id, module_config)

    _log_billing_event(org_id, "subscription_activated", config_id, old_status, "active", stripe_event_id)

    try:
        import asyncio
        from app.services.email_service import send_subscription_activated_email
        asyncio.get_event_loop().run_until_complete(
            send_subscription_activated_email(org_id, config)
        )
    except Exception as e:
        logger.warning(f"Failed to send activation email: {e}")


def handle_payment_failed(
    stripe_subscription: Dict,
    org_id: str,
    stripe_event_id: Optional[str] = None,
):
    """Handle a payment failure — set past_due status."""
    now = datetime.utcnow()

    config = execute_single("""
        SELECT id, status FROM backlot_subscription_configs
        WHERE organization_id = :oid AND status IN ('active', 'past_due')
        ORDER BY created_at DESC LIMIT 1
    """, {"oid": org_id})

    if not config:
        return

    old_status = config["status"]
    config_id = str(config["id"])

    if old_status != "past_due":
        execute_update("""
            UPDATE backlot_subscription_configs
            SET status = 'past_due', past_due_since = :now, updated_at = NOW()
            WHERE id = :cid
        """, {"now": now, "cid": config_id})

        execute_update("""
            UPDATE organizations
            SET backlot_billing_status = 'past_due', past_due_since = :now
            WHERE id = :oid
        """, {"now": now, "oid": org_id})

    _log_billing_event(org_id, "payment_failed", config_id, old_status, "past_due", stripe_event_id)

    try:
        import asyncio
        from app.services.email_service import send_payment_failed_email
        asyncio.get_event_loop().run_until_complete(
            send_payment_failed_email(org_id)
        )
    except Exception as e:
        logger.warning(f"Failed to send payment failed email: {e}")


def handle_subscription_canceled(
    stripe_subscription: Dict,
    org_id: str,
    stripe_event_id: Optional[str] = None,
):
    """Handle a subscription being canceled — downgrade to free tier."""
    config = execute_single("""
        SELECT id, status FROM backlot_subscription_configs
        WHERE organization_id = :oid AND status IN ('active', 'past_due')
        ORDER BY created_at DESC LIMIT 1
    """, {"oid": org_id})

    if not config:
        return

    old_status = config["status"]
    config_id = str(config["id"])

    execute_update("""
        UPDATE backlot_subscription_configs
        SET status = 'canceled', updated_at = NOW()
        WHERE id = :cid
    """, {"cid": config_id})

    # Deactivate all modules
    execute_update("""
        UPDATE backlot_subscription_modules
        SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
        WHERE organization_id = :oid AND status = 'active'
    """, {"oid": org_id})

    execute_update("""
        UPDATE organizations
        SET backlot_billing_status = 'canceled',
            active_subscription_config_id = NULL
        WHERE id = :oid
    """, {"oid": org_id})

    _log_billing_event(org_id, "subscription_canceled", config_id, old_status, "canceled", stripe_event_id)

    try:
        import asyncio
        from app.services.email_service import send_subscription_canceled_email
        asyncio.get_event_loop().run_until_complete(
            send_subscription_canceled_email(org_id)
        )
    except Exception as e:
        logger.warning(f"Failed to send cancellation email: {e}")


# =============================================================================
# Plan Changes
# =============================================================================

def modify_subscription(
    org_id: str,
    profile_id: str,
    new_plan_config: Dict[str, Any],
) -> Dict[str, Any]:
    """Modify an existing subscription — change plan, resources, or modules."""
    stripe = _get_stripe()
    from app.services.pricing_engine import compute_self_service_quote

    current = execute_single("""
        SELECT * FROM backlot_subscription_configs
        WHERE organization_id = :oid AND status IN ('active', 'free')
        ORDER BY created_at DESC LIMIT 1
    """, {"oid": org_id})

    if not current:
        raise ValueError("No active subscription found")

    plan_type = new_plan_config.get("plan_type", current["plan_type"])
    tier_name = new_plan_config.get("tier_name", current.get("tier_name"))
    config = new_plan_config.get("config", {})
    term_type = config.get("term_type", "annual" if current["annual_prepay"] else "monthly")

    # Upgrading from free tier
    if current["status"] == "free" and tier_name != "free":
        return create_checkout_session(org_id, profile_id, new_plan_config)

    # Downgrading to free tier
    if tier_name == "free":
        return _downgrade_to_free(org_id, profile_id, current)

    stripe_sub_id = current.get("stripe_subscription_id")
    if not stripe_sub_id:
        raise ValueError("No Stripe subscription ID on config")

    quote = compute_self_service_quote(plan_type, tier_name, config)

    if term_type == "annual":
        unit_amount = quote["effective_monthly_cents"]
    else:
        unit_amount = quote["monthly_total_cents"]

    new_price = stripe.Price.create(
        product=current["stripe_product_id"],
        unit_amount=unit_amount,
        currency="usd",
        recurring={"interval": "month"},
    )

    sub = stripe.Subscription.retrieve(stripe_sub_id)
    stripe.Subscription.modify(
        stripe_sub_id,
        items=[{"id": sub["items"]["data"][0]["id"], "price": new_price.id}],
        proration_behavior="create_prorations",
        metadata={
            "product": "backlot_org",
            "organization_id": org_id,
            "config_id": str(current["id"]),
        },
    )

    config_summary = quote["config_summary"]
    annual_prepay = term_type == "annual"
    selected_modules = config.get("selected_modules", [])
    use_bundle = config.get("use_bundle", False)

    execute_update("""
        UPDATE backlot_subscription_configs
        SET plan_type = :plan_type, tier_name = :tier_name,
            owner_seats = :owner_seats, collaborative_seats = :collaborative_seats,
            active_projects = :active_projects,
            non_collaborative_per_project = :nc_per_project,
            view_only_per_project = :vo_per_project,
            active_storage_gb = :active_storage_gb,
            archive_storage_gb = :archive_storage_gb,
            bandwidth_gb = :bandwidth_gb,
            monthly_total_cents = :monthly_total_cents,
            annual_prepay = :annual_prepay,
            effective_monthly_cents = :effective_monthly_cents,
            stripe_price_id = :stripe_price_id,
            module_config = :module_config::jsonb,
            updated_at = NOW()
        WHERE id = :cid
    """, {
        "plan_type": plan_type,
        "tier_name": tier_name,
        "owner_seats": config_summary["owner_seats"],
        "collaborative_seats": config_summary["collaborative_seats"],
        "active_projects": config_summary["active_projects"],
        "nc_per_project": config_summary["non_collaborative_per_project"],
        "vo_per_project": config_summary["view_only_per_project"],
        "active_storage_gb": config_summary.get("active_storage_gb", 0),
        "archive_storage_gb": config_summary.get("archive_storage_gb", 0),
        "bandwidth_gb": config_summary["bandwidth_gb"],
        "monthly_total_cents": quote["monthly_total_cents"],
        "annual_prepay": annual_prepay,
        "effective_monthly_cents": quote["effective_monthly_cents"],
        "stripe_price_id": new_price.id,
        "module_config": json.dumps({"selected_modules": selected_modules, "use_bundle": use_bundle}),
        "cid": str(current["id"]),
    })

    sync_limits_from_config(org_id, {**config_summary})
    _sync_modules_from_config(org_id, str(current["id"]), {"selected_modules": selected_modules, "use_bundle": use_bundle})

    _log_billing_event(org_id, "plan_changed", str(current["id"]), metadata={
        "old_monthly_cents": current["monthly_total_cents"],
        "new_monthly_cents": quote["monthly_total_cents"],
    })

    try:
        import asyncio
        from app.services.email_service import send_plan_changed_email
        asyncio.get_event_loop().run_until_complete(
            send_plan_changed_email(org_id, quote)
        )
    except Exception as e:
        logger.warning(f"Failed to send plan changed email: {e}")

    return {"success": True, "new_monthly_total_cents": quote["monthly_total_cents"]}


def _downgrade_to_free(org_id: str, profile_id: str, current_config: Dict) -> Dict[str, Any]:
    """Downgrade to free tier — cancel Stripe subscription, apply free limits."""
    stripe_sub_id = current_config.get("stripe_subscription_id")
    if stripe_sub_id:
        stripe = _get_stripe()
        try:
            stripe.Subscription.cancel(stripe_sub_id)
        except Exception as e:
            logger.warning(f"Failed to cancel Stripe subscription during downgrade: {e}")

    # Mark current config as canceled
    execute_update("""
        UPDATE backlot_subscription_configs
        SET status = 'canceled', updated_at = NOW()
        WHERE id = :cid
    """, {"cid": str(current_config["id"])})

    # Deactivate modules
    execute_update("""
        UPDATE backlot_subscription_modules
        SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
        WHERE organization_id = :oid AND status = 'active'
    """, {"oid": org_id})

    return activate_free_tier(org_id, profile_id)


# =============================================================================
# Module Management
# =============================================================================

def add_module(org_id: str, module_key: str, profile_id: str) -> Dict[str, Any]:
    """Add a single premium module to an organization."""
    from app.services.pricing_engine import PREMIUM_MODULES

    mod = PREMIUM_MODULES.get(module_key)
    if not mod:
        raise ValueError(f"Unknown module: {module_key}")

    # Check if already active
    existing = execute_single("""
        SELECT id FROM backlot_subscription_modules
        WHERE organization_id = :oid AND module_key = :mk AND status = 'active'
    """, {"oid": org_id, "mk": module_key})

    if existing:
        raise ValueError(f"Module {module_key} is already active")

    config = execute_single("""
        SELECT id, tier_name, annual_prepay FROM backlot_subscription_configs
        WHERE organization_id = :oid AND status IN ('active', 'free')
        ORDER BY created_at DESC LIMIT 1
    """, {"oid": org_id})

    if not config:
        raise ValueError("No active subscription found")

    tier_name = config.get("tier_name", "")
    if tier_name in mod.get("included_tiers", []):
        raise ValueError(f"Module {module_key} is already included in your {tier_name} plan")

    is_annual = config.get("annual_prepay", False)
    price = mod["annual_monthly"] if is_annual else mod["monthly"]

    execute_insert("""
        INSERT INTO backlot_subscription_modules
            (organization_id, subscription_config_id, module_key, module_name, monthly_price_cents, status)
        VALUES (:oid, :cid, :mk, :mn, :price, 'active')
        RETURNING id
    """, {
        "oid": org_id,
        "cid": str(config["id"]),
        "mk": module_key,
        "mn": mod["name"],
        "price": int(price * 100),
    })

    _log_billing_event(org_id, "module_added", str(config["id"]), metadata={"module": module_key})

    return {"success": True, "module": module_key}


def remove_module(org_id: str, module_key: str) -> Dict[str, Any]:
    """Remove a premium module from an organization."""
    result = execute_update("""
        UPDATE backlot_subscription_modules
        SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
        WHERE organization_id = :oid AND module_key = :mk AND status = 'active'
    """, {"oid": org_id, "mk": module_key})

    _log_billing_event(org_id, "module_removed", metadata={"module": module_key})

    return {"success": True, "module": module_key}


def get_org_modules(org_id: str) -> List[Dict[str, Any]]:
    """Get all active modules for an organization."""
    rows = execute_query("""
        SELECT module_key, module_name, monthly_price_cents, is_bundle, activated_at
        FROM backlot_subscription_modules
        WHERE organization_id = :oid AND status = 'active'
        ORDER BY activated_at
    """, {"oid": org_id})

    return [dict(r) for r in rows]


def _sync_modules_from_config(org_id: str, config_id: str, module_config: Dict):
    """Sync module records from subscription config's module_config JSON."""
    from app.services.pricing_engine import PREMIUM_MODULES, MODULE_BUNDLES

    if not module_config:
        return

    selected = module_config.get("selected_modules", [])
    use_bundle = module_config.get("use_bundle", False)

    if use_bundle:
        selected = MODULE_BUNDLES["production_bundle"]["modules"]

    # Deactivate modules not in the new selection
    current = execute_query("""
        SELECT id, module_key FROM backlot_subscription_modules
        WHERE organization_id = :oid AND status = 'active'
    """, {"oid": org_id})

    current_keys = {r["module_key"] for r in current}
    new_keys = set(selected)

    # Remove old
    for key in current_keys - new_keys:
        execute_update("""
            UPDATE backlot_subscription_modules
            SET status = 'canceled', canceled_at = NOW(), updated_at = NOW()
            WHERE organization_id = :oid AND module_key = :mk AND status = 'active'
        """, {"oid": org_id, "mk": key})

    # Add new
    for key in new_keys - current_keys:
        mod = PREMIUM_MODULES.get(key)
        if not mod:
            continue
        try:
            execute_insert("""
                INSERT INTO backlot_subscription_modules
                    (organization_id, subscription_config_id, module_key, module_name,
                     monthly_price_cents, is_bundle, status)
                VALUES (:oid, :cid, :mk, :mn, :price, :bundle, 'active')
                RETURNING id
            """, {
                "oid": org_id,
                "cid": config_id,
                "mk": key,
                "mn": mod["name"],
                "price": int(mod["monthly"] * 100),
                "bundle": use_bundle,
            })
        except Exception as e:
            logger.warning(f"Failed to add module {key}: {e}")


# =============================================================================
# Limit Syncing
# =============================================================================

def sync_limits_from_config(org_id: str, config: Dict[str, Any]):
    """Update organization tier limits from subscription config."""
    # Handle both GB and TB formats
    active_storage_gb = config.get("active_storage_gb", 0)
    archive_storage_gb = config.get("archive_storage_gb", 0)

    # Legacy TB support — convert if present
    if "active_storage_tb" in config and active_storage_gb == 0:
        active_storage_gb = float(config["active_storage_tb"]) * 1024
    if "archive_storage_tb" in config and archive_storage_gb == 0:
        archive_storage_gb = float(config["archive_storage_tb"]) * 1024

    execute_update("""
        UPDATE organizations
        SET owner_seats_override = :owner_seats,
            collaborative_seats_override = :collaborative_seats,
            active_projects_override = :active_projects,
            freelancer_seats_per_project_override = :nc_per_project,
            view_only_seats_per_project_override = :vo_per_project,
            active_storage_override = :active_storage_bytes,
            archive_storage_override = :archive_storage_bytes,
            bandwidth_override = :bandwidth_bytes
        WHERE id = :oid
    """, {
        "owner_seats": config.get("owner_seats", 1),
        "collaborative_seats": config.get("collaborative_seats", 0),
        "active_projects": config.get("active_projects", 1),
        "nc_per_project": config.get("non_collaborative_per_project", 0),
        "vo_per_project": config.get("view_only_per_project", 2),
        "active_storage_bytes": int(float(active_storage_gb) * 1073741824),
        "archive_storage_bytes": int(float(archive_storage_gb) * 1073741824),
        "bandwidth_bytes": int(float(config.get("bandwidth_gb", 10)) * 1073741824),
        "oid": org_id,
    })

    logger.info(f"Synced limits for org {org_id} from subscription config")
