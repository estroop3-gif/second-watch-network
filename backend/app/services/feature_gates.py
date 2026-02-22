"""
Feature Gating Service — checks tier + active modules to control feature access.

Usage:
    from app.services.feature_gates import check_feature_access, require_module

    # In an API route:
    @router.get("/budgets")
    async def get_budgets(profile=Depends(require_module("BUDGETING"))):
        ...

    # Programmatic check:
    has_access = check_feature_access(org_id, "BUDGETING")
"""

from enum import Enum
from functools import wraps
from typing import Optional, Dict, Any

from fastapi import HTTPException, Depends
from app.core.database import execute_single, execute_query


class Feature(str, Enum):
    """Premium features that can be gated by tier or module."""
    BUDGETING = "BUDGETING"
    EXPENSES = "EXPENSES"
    PO_INVOICING = "PO_INVOICING"
    TIMECARDS = "TIMECARDS"
    DAILIES = "DAILIES"
    CONTINUITY = "CONTINUITY"
    DOC_SIGNING = "DOC_SIGNING"
    CUSTOM_BRANDING = "CUSTOM_BRANDING"
    API_ACCESS = "API_ACCESS"
    SSO = "SSO"
    SCHEDULING = "SCHEDULING"
    CALL_SHEETS = "CALL_SHEETS"
    SHOT_LISTS = "SHOT_LISTS"
    CASTING = "CASTING"
    REVIEW_LINKS = "REVIEW_LINKS"
    AI_COPILOT = "AI_COPILOT"


# Map features to module keys (for module-gated features)
FEATURE_TO_MODULE = {
    Feature.BUDGETING: "budgeting",
    Feature.EXPENSES: "expenses",
    Feature.PO_INVOICING: "po_invoicing",
    Feature.TIMECARDS: "timecards",
    Feature.DAILIES: "dailies",
    Feature.CONTINUITY: "continuity",
    Feature.DOC_SIGNING: "doc_signing",
    Feature.CUSTOM_BRANDING: "custom_branding",
}

# Features included by tier (no module purchase needed)
# Tier name → set of Feature enums included
TIER_INCLUDED_FEATURES = {
    "free": {
        Feature.SCHEDULING: False,
        Feature.CALL_SHEETS: False,
        Feature.SHOT_LISTS: False,
        Feature.CASTING: False,
    },
    "indie": {
        Feature.SCHEDULING: True,
        Feature.CALL_SHEETS: True,
        Feature.SHOT_LISTS: True,
        Feature.CASTING: True,
        Feature.REVIEW_LINKS: True,
        Feature.AI_COPILOT: True,
    },
    "pro": {
        Feature.SCHEDULING: True,
        Feature.CALL_SHEETS: True,
        Feature.SHOT_LISTS: True,
        Feature.CASTING: True,
        Feature.REVIEW_LINKS: True,
        Feature.AI_COPILOT: True,
        # Modules available as add-ons: BUDGETING, EXPENSES, DAILIES, CONTINUITY
    },
    "business": {
        Feature.SCHEDULING: True,
        Feature.CALL_SHEETS: True,
        Feature.SHOT_LISTS: True,
        Feature.CASTING: True,
        Feature.REVIEW_LINKS: True,
        Feature.AI_COPILOT: True,
        Feature.BUDGETING: True,
        Feature.EXPENSES: True,
        Feature.DAILIES: True,
        Feature.CONTINUITY: True,
        Feature.API_ACCESS: True,
        # Modules available as add-ons: PO_INVOICING, TIMECARDS, DOC_SIGNING, CUSTOM_BRANDING
    },
    "enterprise": {
        Feature.SCHEDULING: True,
        Feature.CALL_SHEETS: True,
        Feature.SHOT_LISTS: True,
        Feature.CASTING: True,
        Feature.REVIEW_LINKS: True,
        Feature.AI_COPILOT: True,
        Feature.BUDGETING: True,
        Feature.EXPENSES: True,
        Feature.PO_INVOICING: True,
        Feature.TIMECARDS: True,
        Feature.DAILIES: True,
        Feature.CONTINUITY: True,
        Feature.DOC_SIGNING: True,
        Feature.CUSTOM_BRANDING: True,
        Feature.API_ACCESS: True,
        Feature.SSO: True,
    },
}

# Upgrade prompts per feature
UPGRADE_PROMPTS = {
    Feature.BUDGETING: {"message": "Upgrade to Pro ($149/mo) and add the Budgeting module, or upgrade to Business ($349/mo) where it's included.", "min_tier": "pro", "module": "budgeting"},
    Feature.EXPENSES: {"message": "Upgrade to Pro ($149/mo) and add the Expense Tracking module, or upgrade to Business ($349/mo) where it's included.", "min_tier": "pro", "module": "expenses"},
    Feature.PO_INVOICING: {"message": "Upgrade to Business ($349/mo) and add the PO & Invoicing module, or upgrade to Enterprise ($799/mo) where it's included.", "min_tier": "business", "module": "po_invoicing"},
    Feature.TIMECARDS: {"message": "Upgrade to Business ($349/mo) and add the Timecards module, or upgrade to Enterprise ($799/mo) where it's included.", "min_tier": "business", "module": "timecards"},
    Feature.DAILIES: {"message": "Upgrade to Pro ($149/mo) and add the Dailies module, or upgrade to Business ($349/mo) where it's included.", "min_tier": "pro", "module": "dailies"},
    Feature.CONTINUITY: {"message": "Upgrade to Pro ($149/mo) and add the Continuity Tools module, or upgrade to Business ($349/mo) where it's included.", "min_tier": "pro", "module": "continuity"},
    Feature.DOC_SIGNING: {"message": "Upgrade to Business ($349/mo) and add the Document Signing module, or upgrade to Enterprise ($799/mo) where it's included.", "min_tier": "business", "module": "doc_signing"},
    Feature.CUSTOM_BRANDING: {"message": "Upgrade to Business ($349/mo) and add the Custom Branding module, or upgrade to Enterprise ($799/mo) where it's included.", "min_tier": "business", "module": "custom_branding"},
    Feature.API_ACCESS: {"message": "Upgrade to Business ($349/mo) for read-only API access, or Enterprise ($799/mo) for full API access.", "min_tier": "business"},
    Feature.SSO: {"message": "Upgrade to Enterprise ($799/mo) for SSO/SAML support.", "min_tier": "enterprise"},
    Feature.SCHEDULING: {"message": "Upgrade to Indie ($69/mo) or higher for scheduling features.", "min_tier": "indie"},
    Feature.CALL_SHEETS: {"message": "Upgrade to Indie ($69/mo) or higher for call sheets.", "min_tier": "indie"},
    Feature.SHOT_LISTS: {"message": "Upgrade to Indie ($69/mo) or higher for shot lists and storyboards.", "min_tier": "indie"},
    Feature.CASTING: {"message": "Upgrade to Indie ($69/mo) or higher for casting features.", "min_tier": "indie"},
    Feature.REVIEW_LINKS: {"message": "Upgrade to Indie ($69/mo) or higher for external review links.", "min_tier": "indie"},
    Feature.AI_COPILOT: {"message": "Upgrade to Indie ($69/mo) or higher for AI Copilot access.", "min_tier": "indie"},
}


def check_feature_access(org_id: str, feature: str) -> Dict[str, Any]:
    """
    Check if an organization has access to a feature.

    Returns:
        {
            "has_access": bool,
            "reason": str | None,  # why access is denied
            "upgrade_prompt": dict | None,  # upgrade info if denied
        }
    """
    feature_enum = Feature(feature) if isinstance(feature, str) else feature

    # Get org's current subscription
    config = execute_single("""
        SELECT sc.tier_name, sc.status, sc.module_config
        FROM backlot_subscription_configs sc
        JOIN organizations o ON o.active_subscription_config_id = sc.id
        WHERE o.id = :oid
    """, {"oid": org_id})

    if not config:
        return {
            "has_access": False,
            "reason": "no_subscription",
            "upgrade_prompt": {"message": "Subscribe to access this feature.", "min_tier": "free"},
        }

    tier_name = config.get("tier_name", "free")
    status = config.get("status", "")

    # Check subscription status
    if status not in ("active", "free"):
        return {
            "has_access": False,
            "reason": f"subscription_{status}",
            "upgrade_prompt": {"message": "Your subscription is not active. Please update your billing."},
        }

    # Check if feature is included in tier
    tier_features = TIER_INCLUDED_FEATURES.get(tier_name, {})
    if feature_enum in tier_features and tier_features[feature_enum]:
        return {"has_access": True, "reason": None, "upgrade_prompt": None}

    # Check if feature requires a module
    module_key = FEATURE_TO_MODULE.get(feature_enum)
    if module_key:
        # Check active modules
        active_module = execute_single("""
            SELECT id FROM backlot_subscription_modules
            WHERE organization_id = :oid AND module_key = :mk AND status = 'active'
        """, {"oid": org_id, "mk": module_key})

        if active_module:
            return {"has_access": True, "reason": None, "upgrade_prompt": None}

    # Access denied
    prompt = UPGRADE_PROMPTS.get(feature_enum, {"message": "Upgrade your plan to access this feature."})
    return {
        "has_access": False,
        "reason": "not_included",
        "upgrade_prompt": prompt,
    }


def get_org_feature_access(org_id: str) -> Dict[str, bool]:
    """Get a full map of feature access for an org (for frontend feature gates)."""
    result = {}
    for feature in Feature:
        access = check_feature_access(org_id, feature.value)
        result[feature.value] = access["has_access"]
    return result


def require_module(feature_name: str):
    """
    FastAPI dependency that checks feature access for the current user's org.

    Usage:
        @router.get("/budgets")
        async def get_budgets(org_id: str, profile=Depends(require_module("BUDGETING"))):
            ...

    Note: This requires org_id as a path or query parameter.
    """
    from app.core.auth import get_current_user
    from app.api.users import get_profile_id_from_cognito_id

    async def _check(org_id: str, user=Depends(get_current_user)):
        profile_id = await get_profile_id_from_cognito_id(user["id"])
        if not profile_id:
            raise HTTPException(status_code=404, detail="Profile not found")

        access = check_feature_access(org_id, feature_name)
        if not access["has_access"]:
            prompt = access.get("upgrade_prompt", {})
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "feature_locked",
                    "feature": feature_name,
                    "message": prompt.get("message", "This feature requires a plan upgrade."),
                    "min_tier": prompt.get("min_tier"),
                    "module": prompt.get("module"),
                },
            )
        return profile_id

    return _check
