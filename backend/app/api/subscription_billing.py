"""
Subscription Billing API Routes

Self-service subscription management for Backlot organizations:
- Public pricing endpoints (no auth)
- Checkout session creation (with free tier support)
- Subscription management (change plan, cancel, reactivate)
- Module management (add/remove premium modules)
- Stripe portal access
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from app.core.auth import get_current_user
from app.core.database import execute_single, execute_query
from app.api.users import get_profile_id_from_cognito_id

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class PriceCalculateRequest(BaseModel):
    plan_type: str = "tier"  # 'tier' or 'a_la_carte'
    tier_name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class CheckoutRequest(BaseModel):
    org_id: str
    plan_type: str = "tier"
    tier_name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class TrialConvertRequest(BaseModel):
    org_id: str
    plan_type: str = "tier"
    tier_name: Optional[str] = "indie"
    config: Optional[Dict[str, Any]] = None


class ChangePlanRequest(BaseModel):
    plan_type: str = "tier"
    tier_name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class ModuleRequest(BaseModel):
    module_key: str


class PortalRequest(BaseModel):
    return_to: Optional[str] = None


# =============================================================================
# Public Endpoints (no auth)
# =============================================================================

@router.get("/pricing/tiers")
async def get_pricing_tiers():
    """Get all tier definitions, modules, and add-on prices for the public pricing page."""
    from app.services.pricing_engine import TIERS, ADDON_PRICES, VOLUME_DISCOUNT_TIERS, PREMIUM_MODULES, MODULE_BUNDLES

    return {
        "tiers": TIERS,
        "addon_prices": ADDON_PRICES,
        "volume_discount_tiers": VOLUME_DISCOUNT_TIERS,
        "premium_modules": PREMIUM_MODULES,
        "module_bundles": MODULE_BUNDLES,
        "a_la_carte": {
            "minimum_monthly": 24,
            "description": "Build your own plan — pay only for what you need",
            "minimums": {"owner_seats": 1, "active_projects": 1},
        },
    }


@router.post("/pricing/calculate")
async def calculate_price(request: PriceCalculateRequest):
    """Calculate price for any plan configuration. No auth required."""
    from app.services.pricing_engine import compute_self_service_quote

    try:
        result = compute_self_service_quote(
            plan_type=request.plan_type,
            tier_name=request.tier_name,
            config=request.config or {},
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Authenticated Endpoints
# =============================================================================

@router.post("/checkout")
async def create_checkout(request: CheckoutRequest, user=Depends(get_current_user)):
    """Create a Stripe Checkout Session for a new subscription (or activate free tier)."""
    from app.services.subscription_service import create_checkout_session

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Verify user has access to this org
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": request.org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can subscribe")

    # Check no active subscription (allow free tier to be upgraded)
    existing = execute_single("""
        SELECT id, status FROM backlot_subscription_configs
        WHERE organization_id = :oid AND status = 'active'
    """, {"oid": request.org_id})

    if existing:
        raise HTTPException(status_code=400, detail="Organization already has an active subscription. Use change-plan instead.")

    try:
        result = create_checkout_session(
            org_id=request.org_id,
            profile_id=profile_id,
            plan_config={
                "plan_type": request.plan_type,
                "tier_name": request.tier_name,
                "config": request.config or {},
            },
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Checkout creation failed: {str(e)}")


@router.post("/checkout/trial-convert")
async def create_trial_convert_checkout(request: TrialConvertRequest, user=Depends(get_current_user)):
    """Create checkout pre-filled from trial/free org's current usage."""
    from app.services.subscription_service import create_checkout_session

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    org = execute_single("""
        SELECT id, backlot_billing_status FROM organizations WHERE id = :oid
    """, {"oid": request.org_id})

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if org["backlot_billing_status"] not in ("trial", "expired", "free"):
        raise HTTPException(status_code=400, detail="Organization is not on a trial or free plan")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": request.org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can subscribe")

    config = request.config or {}

    try:
        result = create_checkout_session(
            org_id=request.org_id,
            profile_id=profile_id,
            plan_config={
                "plan_type": request.plan_type,
                "tier_name": request.tier_name,
                "config": config,
            },
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Checkout creation failed: {str(e)}")


@router.get("/organizations/{org_id}/subscription")
async def get_org_subscription(org_id: str, user=Depends(get_current_user)):
    """Get current subscription details for an organization."""
    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active'
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    org = execute_single("""
        SELECT id, name, backlot_billing_status, past_due_since, trial_ends_at,
               active_subscription_config_id, stripe_customer_id
        FROM organizations WHERE id = :oid
    """, {"oid": org_id})

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    config = None
    if org.get("active_subscription_config_id"):
        config = execute_single("""
            SELECT * FROM backlot_subscription_configs WHERE id = :cid
        """, {"cid": org["active_subscription_config_id"]})

    # Grace period info
    grace_info = None
    if org.get("past_due_since"):
        from datetime import datetime, timedelta
        past_due_since = org["past_due_since"]
        if hasattr(past_due_since, "timestamp"):
            grace_end = past_due_since + timedelta(days=7)
            days_remaining = max(0, (grace_end - datetime.utcnow()).days)
            grace_info = {
                "past_due_since": past_due_since.isoformat(),
                "grace_period_end": grace_end.isoformat(),
                "grace_days_remaining": days_remaining,
                "is_past_grace": days_remaining <= 0,
            }

    result = {
        "organization_id": org_id,
        "billing_status": org["backlot_billing_status"],
        "trial_ends_at": org.get("trial_ends_at"),
        "grace_info": grace_info,
    }

    if config:
        module_config = config.get("module_config") or {}
        if isinstance(module_config, str):
            import json
            module_config = json.loads(module_config)

        result["subscription"] = {
            "id": str(config["id"]),
            "plan_type": config["plan_type"],
            "tier_name": config.get("tier_name"),
            "status": config["status"],
            "monthly_total_cents": config["monthly_total_cents"],
            "annual_prepay": config["annual_prepay"],
            "effective_monthly_cents": config["effective_monthly_cents"],
            "owner_seats": config["owner_seats"],
            "collaborative_seats": config["collaborative_seats"],
            "active_projects": config["active_projects"],
            "non_collaborative_per_project": config["non_collaborative_per_project"],
            "view_only_per_project": config["view_only_per_project"],
            "active_storage_gb": config.get("active_storage_gb", 0),
            "archive_storage_gb": config.get("archive_storage_gb", 0),
            "bandwidth_gb": config["bandwidth_gb"],
            "module_config": module_config,
            "created_at": config["created_at"].isoformat() if config.get("created_at") else None,
        }

    # Get active modules
    from app.services.subscription_service import get_org_modules
    result["modules"] = get_org_modules(org_id)

    return result


@router.post("/organizations/{org_id}/change-plan")
async def change_plan(org_id: str, request: ChangePlanRequest, user=Depends(get_current_user)):
    """Modify an existing subscription — change plan or resources."""
    from app.services.subscription_service import modify_subscription

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can change plans")

    try:
        result = modify_subscription(
            org_id=org_id,
            profile_id=profile_id,
            new_plan_config={
                "plan_type": request.plan_type,
                "tier_name": request.tier_name,
                "config": request.config or {},
            },
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plan change failed: {str(e)}")


# =============================================================================
# Module Management
# =============================================================================

@router.get("/organizations/{org_id}/modules")
async def list_org_modules(org_id: str, user=Depends(get_current_user)):
    """List active modules for an organization."""
    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active'
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    from app.services.subscription_service import get_org_modules
    return {"modules": get_org_modules(org_id)}


@router.post("/organizations/{org_id}/modules")
async def add_org_module(org_id: str, request: ModuleRequest, user=Depends(get_current_user)):
    """Add a premium module to an organization."""
    from app.services.subscription_service import add_module

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can manage modules")

    try:
        result = add_module(org_id, request.module_key, profile_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/organizations/{org_id}/modules/{module_key}")
async def remove_org_module(org_id: str, module_key: str, user=Depends(get_current_user)):
    """Remove a premium module from an organization."""
    from app.services.subscription_service import remove_module

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can manage modules")

    try:
        result = remove_module(org_id, module_key)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Cancel / Reactivate / Portal
# =============================================================================

@router.post("/organizations/{org_id}/cancel")
async def cancel_subscription(org_id: str, user=Depends(get_current_user)):
    """Cancel subscription at end of billing period."""
    from app.core.config import settings
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can cancel")

    config = execute_single("""
        SELECT id, stripe_subscription_id FROM backlot_subscription_configs
        WHERE organization_id = :oid AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
    """, {"oid": org_id})

    if not config or not config.get("stripe_subscription_id"):
        raise HTTPException(status_code=400, detail="No active subscription found")

    stripe.Subscription.modify(
        config["stripe_subscription_id"],
        cancel_at_period_end=True,
    )

    return {"success": True, "message": "Subscription will cancel at the end of the billing period"}


@router.post("/organizations/{org_id}/reactivate")
async def reactivate_subscription(org_id: str, user=Depends(get_current_user)):
    """Undo a pending cancellation."""
    from app.core.config import settings
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can reactivate")

    config = execute_single("""
        SELECT id, stripe_subscription_id FROM backlot_subscription_configs
        WHERE organization_id = :oid AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
    """, {"oid": org_id})

    if not config or not config.get("stripe_subscription_id"):
        raise HTTPException(status_code=400, detail="No active subscription found")

    stripe.Subscription.modify(
        config["stripe_subscription_id"],
        cancel_at_period_end=False,
    )

    return {"success": True, "message": "Cancellation reversed"}


@router.post("/organizations/{org_id}/portal")
async def create_portal_session(org_id: str, request: PortalRequest, user=Depends(get_current_user)):
    """Create a Stripe Customer Portal session for payment method management."""
    from app.core.config import settings
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY

    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active' AND role IN ('owner', 'admin')
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Only org owners/admins can manage billing")

    org = execute_single(
        "SELECT stripe_customer_id FROM organizations WHERE id = :oid",
        {"oid": org_id},
    )

    if not org or not org.get("stripe_customer_id"):
        raise HTTPException(status_code=400, detail="No billing account found for this organization")

    return_url = f"{settings.FRONTEND_URL}/organizations"
    if request.return_to:
        return_url = f"{settings.FRONTEND_URL}{request.return_to}"

    session = stripe.billing_portal.Session.create(
        customer=org["stripe_customer_id"],
        return_url=return_url,
    )

    return {"url": session.url}
