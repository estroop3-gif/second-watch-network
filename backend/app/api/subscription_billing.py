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
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import io
import json

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


@router.get("/organizations/{org_id}/features")
async def get_org_feature_map(org_id: str, user=Depends(get_current_user)):
    """Get the feature access map for an organization.

    Returns a dict of feature names to booleans indicating access.
    Used by the frontend to show locked/unlocked states on module tabs.
    """
    profile_id = await get_profile_id_from_cognito_id(user["id"])
    if not profile_id:
        raise HTTPException(status_code=404, detail="Profile not found")

    # Verify user is a member of the org
    member = execute_single("""
        SELECT role FROM organization_members
        WHERE organization_id = :oid AND user_id = :uid AND status = 'active'
    """, {"oid": org_id, "uid": profile_id})

    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    from app.services.feature_gates import get_org_feature_access
    return get_org_feature_access(org_id)


# =============================================================================
# Config Fetch + Receipt Download (for BacklotConfirmationPage)
# =============================================================================

@router.get("/config/{config_id}")
async def get_subscription_config(config_id: str, user=Depends(get_current_user)):
    """Fetch subscription config details with reconstructed line items."""
    from app.services.pricing_engine import compute_self_service_quote

    config = execute_single("""
        SELECT bsc.*, o.name as org_name
        FROM backlot_subscription_configs bsc
        JOIN organizations o ON o.id = bsc.organization_id
        WHERE bsc.id = :config_id
    """, {"config_id": config_id})

    if not config:
        raise HTTPException(status_code=404, detail="Subscription config not found")

    config_dict = dict(config)

    module_config = config_dict.get("module_config") or {}
    if isinstance(module_config, str):
        module_config = json.loads(module_config)

    try:
        plan_type = config_dict.get("plan_type", "tier")
        tier_name = config_dict.get("tier_name")
        selected_modules = module_config.get("selected_modules", [])
        use_bundle = module_config.get("use_bundle", False)
        term_type = "annual" if config_dict.get("annual_prepay") else "monthly"

        quote = compute_self_service_quote(
            plan_type=plan_type,
            tier_name=tier_name,
            config={
                "term_type": term_type,
                "owner_seats": config_dict.get("owner_seats", 1),
                "collaborative_seats": config_dict.get("collaborative_seats", 0),
                "active_projects": config_dict.get("active_projects", 1),
                "selected_modules": selected_modules,
                "use_bundle": use_bundle,
            },
        )
        line_items = quote.get("line_items", [])
        annual_detail = quote.get("annual_prepay")
    except Exception:
        line_items = []
        annual_detail = None

    # Serialize datetime fields
    for key, val in config_dict.items():
        if hasattr(val, "isoformat"):
            config_dict[key] = val.isoformat()

    return {
        **config_dict,
        "line_items": line_items,
        "annual_detail": annual_detail,
    }


@router.get("/receipt/{config_id}")
async def download_receipt(config_id: str, user=Depends(get_current_user)):
    """Generate and download a PDF receipt for a subscription config."""
    from app.services.pricing_engine import compute_self_service_quote

    config = execute_single("""
        SELECT bsc.*, o.name as org_name, p.email as owner_email, p.full_name as owner_name
        FROM backlot_subscription_configs bsc
        JOIN organizations o ON o.id = bsc.organization_id
        LEFT JOIN profiles p ON p.id = bsc.created_by
        WHERE bsc.id = :config_id
    """, {"config_id": config_id})

    if not config:
        raise HTTPException(status_code=404, detail="Subscription config not found")

    config_dict = dict(config)

    module_config = config_dict.get("module_config") or {}
    if isinstance(module_config, str):
        module_config = json.loads(module_config)

    try:
        plan_type = config_dict.get("plan_type", "tier")
        tier_name = config_dict.get("tier_name", "")
        selected_modules = module_config.get("selected_modules", [])
        use_bundle = module_config.get("use_bundle", False)
        term_type = "annual" if config_dict.get("annual_prepay") else "monthly"

        quote = compute_self_service_quote(
            plan_type=plan_type,
            tier_name=tier_name,
            config={
                "term_type": term_type,
                "owner_seats": config_dict.get("owner_seats", 1),
                "collaborative_seats": config_dict.get("collaborative_seats", 0),
                "active_projects": config_dict.get("active_projects", 1),
                "selected_modules": selected_modules,
                "use_bundle": use_bundle,
            },
        )
        line_items = quote.get("line_items", [])
    except Exception:
        line_items = []

    tier_name_str = config_dict.get("tier_name", "")
    tier_label = (tier_name_str or "A La Carte").replace("_", " ").title()
    billing_label = "Annual (pay 10 months, get 12)" if config_dict.get("annual_prepay") else "Monthly"
    monthly_total = (config_dict.get("monthly_total_cents") or 0) / 100
    effective_monthly = (config_dict.get("effective_monthly_cents") or 0) / 100
    org_name = config_dict.get("org_name", "")
    owner_name = config_dict.get("owner_name", "")
    owner_email_val = config_dict.get("owner_email", "")

    created_at = config_dict.get("created_at")
    if hasattr(created_at, "strftime"):
        date_str = created_at.strftime("%B %d, %Y")
    else:
        date_str = str(created_at)[:10] if created_at else ""

    li_rows = ""
    for item in line_items:
        li_rows += (
            f'<tr><td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#F9F5EF;">'
            f'{item.get("label", "")}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#F9F5EF;text-align:right;">'
            f'${item.get("total", 0):.2f}</td></tr>'
        )

    if config_dict.get("annual_prepay"):
        annual_amount = round(monthly_total * 10, 2)
        total_row = (
            f'<tr style="background:#1a1a1a;">'
            f'<td style="padding:10px 12px;color:#FCDC58;font-weight:bold;">Annual Total (pay 10, get 12)</td>'
            f'<td style="padding:10px 12px;color:#FCDC58;font-weight:bold;text-align:right;">${annual_amount:.2f}</td></tr>'
            f'<tr><td style="padding:8px 12px;color:#a0a0a0;font-style:italic;">Effective monthly</td>'
            f'<td style="padding:8px 12px;color:#a0a0a0;text-align:right;font-style:italic;">${effective_monthly:.2f}/mo</td></tr>'
        )
    else:
        total_row = (
            f'<tr style="background:#1a1a1a;">'
            f'<td style="padding:10px 12px;color:#FCDC58;font-weight:bold;">Monthly Total</td>'
            f'<td style="padding:10px 12px;color:#FCDC58;font-weight:bold;text-align:right;">${monthly_total:.2f}/mo</td></tr>'
        )

    html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body{{font-family:Arial,sans-serif;background:#121212;color:#F9F5EF;margin:0;padding:40px;}}
.header{{border-bottom:2px solid #FCDC58;padding-bottom:20px;margin-bottom:30px;}}
.logo{{font-size:22px;font-weight:bold;color:#FCDC58;letter-spacing:2px;}}
.subtitle{{color:#a0a0a0;font-size:13px;margin-top:4px;}}
.receipt-title{{font-size:28px;font-weight:bold;color:#F9F5EF;margin-bottom:16px;}}
.meta{{margin-bottom:24px;}}
.meta-row{{margin-bottom:8px;}}
.meta-label{{font-size:11px;color:#a0a0a0;text-transform:uppercase;letter-spacing:1px;}}
.meta-value{{font-size:14px;color:#F9F5EF;margin-top:2px;}}
table{{width:100%;border-collapse:collapse;}}
th{{padding:10px 12px;background:#1a1a1a;color:#FCDC58;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:1px;}}
th:last-child{{text-align:right;}}
.footer{{margin-top:40px;padding-top:20px;border-top:1px solid #2a2a2a;font-size:12px;color:#a0a0a0;text-align:center;}}
</style>
</head>
<body>
<div class="header">
  <div class="logo">SECOND WATCH NETWORK</div>
  <div class="subtitle">Backlot Production Management</div>
</div>
<div class="receipt-title">Subscription Receipt</div>
<div class="meta">
  <div class="meta-row"><div class="meta-label">Organization</div><div class="meta-value">{org_name}</div></div>
  <div class="meta-row"><div class="meta-label">Account</div><div class="meta-value">{owner_name or owner_email_val}</div></div>
  <div class="meta-row"><div class="meta-label">Date</div><div class="meta-value">{date_str}</div></div>
  <div class="meta-row"><div class="meta-label">Plan</div><div class="meta-value">Backlot {tier_label} &bull; {billing_label}</div></div>
</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
  <tbody>{li_rows}{total_row}</tbody>
</table>
<div class="footer">
  <p>Receipt ID: {config_id}</p>
  <p>Second Watch Network &bull; support@secondwatch.network</p>
  <p>This receipt confirms your subscription has been activated.</p>
</div>
</body>
</html>"""

    try:
        from weasyprint import HTML as WeasyprintHTML
        pdf_bytes = WeasyprintHTML(string=html_content).write_pdf()
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="backlot-receipt-{config_id}.pdf"'},
        )
    except ImportError:
        return StreamingResponse(
            io.BytesIO(html_content.encode("utf-8")),
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="receipt-{config_id}.html"'},
        )
