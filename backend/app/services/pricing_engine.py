"""
Backlot Pricing Engine v2 — Competitive self-service pricing.

5-tier model: Free / Indie / Pro / Business / Enterprise
Premium modules: add-on features purchasable per-tier or a la carte
Annual prepay: pay 10 months for 12 (applies to FULL monthly total).
"""

import math
from typing import Dict, Any, List, Optional, Tuple

# =============================================================================
# Tier Definitions (source of truth)
# =============================================================================

TIERS = {
    "free": {
        "base_price": 0,
        "org_seats": {"owner": 1, "collaborative": 0},
        "active_projects": 1,
        "project_seats": {"non_collaborative": 0, "view_only": 2},
        "storage": {"active_gb": 5, "archive_gb": 0},
        "bandwidth_gb": 10,
        "features": {
            "projects_scenes": "basic",
            "script_upload": 1,
            "scheduling": False,
            "call_sheets": 0,
            "shot_lists": False,
            "moodboards": "view_only",
            "locations": 3,
            "tasks": "basic",
            "casting": False,
            "review_links": 0,
            "ai_messages": 0,
            "api_access": False,
            "priority_support": False,
        },
    },
    "indie": {
        "base_price": 69,
        "org_seats": {"owner": 1, "collaborative": 5},
        "active_projects": 5,
        "project_seats": {"non_collaborative": 5, "view_only": 10},
        "storage": {"active_gb": 150, "archive_gb": 100},
        "bandwidth_gb": 500,
        "features": {
            "projects_scenes": "full",
            "script_upload": -1,  # unlimited
            "scheduling": "basic",
            "call_sheets": 5,
            "shot_lists": "limited",
            "moodboards": "create",
            "locations": 20,
            "tasks": "full",
            "casting": "basic",
            "review_links": 3,
            "ai_messages": 50,
            "api_access": False,
            "priority_support": False,
        },
    },
    "pro": {
        "base_price": 149,
        "org_seats": {"owner": 2, "collaborative": 15},
        "active_projects": 15,
        "project_seats": {"non_collaborative": 10, "view_only": 15},
        "storage": {"active_gb": 1024, "archive_gb": 1024},
        "bandwidth_gb": 3000,
        "features": {
            "projects_scenes": "full",
            "script_upload": -1,
            "scheduling": "full",
            "call_sheets": -1,
            "shot_lists": "full",
            "moodboards": "full",
            "locations": -1,
            "tasks": "full",
            "casting": "full",
            "review_links": 25,
            "ai_messages": 500,
            "api_access": False,
            "priority_support": "email",
        },
    },
    "business": {
        "base_price": 349,
        "org_seats": {"owner": 3, "collaborative": 50},
        "active_projects": 50,
        "project_seats": {"non_collaborative": 15, "view_only": 50},
        "storage": {"active_gb": 5120, "archive_gb": 10240},
        "bandwidth_gb": 10000,
        "features": {
            "projects_scenes": "full",
            "script_upload": -1,
            "scheduling": "full",
            "call_sheets": -1,
            "shot_lists": "full",
            "moodboards": "full",
            "locations": -1,
            "tasks": "full",
            "casting": "full",
            "review_links": -1,
            "ai_messages": -1,
            "api_access": "read_only",
            "priority_support": "email_chat",
        },
    },
    "enterprise": {
        "base_price": 799,
        "org_seats": {"owner": 10, "collaborative": -1},  # -1 = unlimited
        "active_projects": -1,
        "project_seats": {"non_collaborative": 30, "view_only": -1},
        "storage": {"active_gb": 25600, "archive_gb": 51200},
        "bandwidth_gb": 50000,
        "features": {
            "projects_scenes": "full",
            "script_upload": -1,
            "scheduling": "full",
            "call_sheets": -1,
            "shot_lists": "full",
            "moodboards": "full",
            "locations": -1,
            "tasks": "full",
            "casting": "full",
            "review_links": -1,
            "ai_messages": -1,
            "api_access": "full",
            "priority_support": "dedicated_csm",
            "sso": True,
            "custom_branding": True,
        },
    },
}

# =============================================================================
# Add-On Prices
# =============================================================================

ADDON_PRICES = {
    "owner_seat": 19,
    "collaborative_seat": 14,
    "non_collaborative_seat": 6,
    "view_only_seat": 3,
    "active_storage_100gb": 15,     # per 100 GB block
    "archive_storage_500gb": 12,    # per 500 GB block
    "bandwidth_500gb": 14,          # per 500 GB block
    "project": 14,                  # per project (a la carte + extra)
}

# =============================================================================
# Premium Modules
# =============================================================================

PREMIUM_MODULES = {
    "budgeting": {
        "name": "Budgeting & Top Sheets",
        "monthly": 29,
        "annual_monthly": 24,
        "available_tiers": ["pro"],          # tiers where it's an add-on
        "included_tiers": ["business", "enterprise"],  # tiers where it's free
    },
    "expenses": {
        "name": "Expense Tracking & Receipts",
        "monthly": 29,
        "annual_monthly": 24,
        "available_tiers": ["pro"],
        "included_tiers": ["business", "enterprise"],
    },
    "po_invoicing": {
        "name": "Purchase Orders & Invoicing",
        "monthly": 39,
        "annual_monthly": 33,
        "available_tiers": ["business"],
        "included_tiers": ["enterprise"],
    },
    "timecards": {
        "name": "Timecards & Payroll",
        "monthly": 39,
        "annual_monthly": 33,
        "available_tiers": ["business"],
        "included_tiers": ["enterprise"],
    },
    "dailies": {
        "name": "Dailies & Transcoding",
        "monthly": 39,
        "annual_monthly": 33,
        "available_tiers": ["pro"],
        "included_tiers": ["business", "enterprise"],
    },
    "continuity": {
        "name": "Continuity Tools",
        "monthly": 29,
        "annual_monthly": 24,
        "available_tiers": ["pro"],
        "included_tiers": ["business", "enterprise"],
    },
    "doc_signing": {
        "name": "Document Signing & Clearances",
        "monthly": 29,
        "annual_monthly": 24,
        "available_tiers": ["business"],
        "included_tiers": ["enterprise"],
    },
    "custom_branding": {
        "name": "Custom Branding",
        "monthly": 15,
        "annual_monthly": 13,
        "available_tiers": ["business"],
        "included_tiers": ["enterprise"],
    },
}

MODULE_BUNDLES = {
    "production_bundle": {
        "name": "Production Bundle",
        "description": "All premium modules at a discount",
        "modules": list(PREMIUM_MODULES.keys()),
        "monthly": 149,
        "annual_monthly": 124,
    },
}

# =============================================================================
# Volume Discounts
# =============================================================================

VOLUME_DISCOUNT_TIERS = [
    (100, 0.20),  # 100+ seats: 20%
    (50, 0.15),   # 50-99 seats: 15%
    (25, 0.10),   # 25-49 seats: 10%
    (10, 0.05),   # 10-24 seats: 5%
]


def get_tier(tier_name: str) -> dict:
    tier = TIERS.get(tier_name.lower())
    if not tier:
        raise ValueError(f"Unknown tier: {tier_name}")
    return tier


# =============================================================================
# Seat Calculations
# =============================================================================

def calculate_added_seats_and_costs(
    tier_name: str,
    required_owner_seats: int,
    required_collaborative_seats: int,
    active_projects: int,
    required_non_collaborative_per_project: int,
    required_view_only_per_project: int,
) -> Dict[str, Any]:
    """Calculate extra seats needed beyond tier inclusions and their costs."""
    tier = get_tier(tier_name)
    included = tier["org_seats"]
    included_project = tier["project_seats"]

    # Org seats (handle unlimited with -1)
    included_owner = included["owner"] if included["owner"] >= 0 else 999999
    included_collab = included["collaborative"] if included["collaborative"] >= 0 else 999999

    extra_owner = max(0, required_owner_seats - included_owner)
    extra_collaborative = max(0, required_collaborative_seats - included_collab)

    # Project seats
    included_nc = included_project["non_collaborative"] if included_project["non_collaborative"] >= 0 else 999999
    included_vo = included_project["view_only"] if included_project["view_only"] >= 0 else 999999

    extra_nc_per_project = max(0, required_non_collaborative_per_project - included_nc)
    extra_vo_per_project = max(0, required_view_only_per_project - included_vo)
    total_extra_nc = extra_nc_per_project * active_projects
    total_extra_vo = extra_vo_per_project * active_projects

    # Costs
    owner_cost = extra_owner * ADDON_PRICES["owner_seat"]
    collaborative_cost = extra_collaborative * ADDON_PRICES["collaborative_seat"]
    nc_cost = total_extra_nc * ADDON_PRICES["non_collaborative_seat"]
    vo_cost = total_extra_vo * ADDON_PRICES["view_only_seat"]

    total_added_seat_count = extra_owner + extra_collaborative + total_extra_nc + total_extra_vo
    total_seat_cost = owner_cost + collaborative_cost + nc_cost + vo_cost

    return {
        "extra_owner": extra_owner,
        "extra_collaborative": extra_collaborative,
        "extra_nc_per_project": extra_nc_per_project,
        "extra_vo_per_project": extra_vo_per_project,
        "total_extra_nc": total_extra_nc,
        "total_extra_vo": total_extra_vo,
        "total_added_seat_count": total_added_seat_count,
        "owner_cost": owner_cost,
        "collaborative_cost": collaborative_cost,
        "nc_cost": nc_cost,
        "vo_cost": vo_cost,
        "total_seat_cost": total_seat_cost,
        "line_items": [
            item for item in [
                {"label": f"Owner seats (+{extra_owner})", "qty": extra_owner, "unit_price": ADDON_PRICES["owner_seat"], "total": owner_cost} if extra_owner > 0 else None,
                {"label": f"Collaborative seats (+{extra_collaborative})", "qty": extra_collaborative, "unit_price": ADDON_PRICES["collaborative_seat"], "total": collaborative_cost} if extra_collaborative > 0 else None,
                {"label": f"Non-Collaborative seats (+{extra_nc_per_project}/proj x {active_projects} proj = {total_extra_nc})", "qty": total_extra_nc, "unit_price": ADDON_PRICES["non_collaborative_seat"], "total": nc_cost} if total_extra_nc > 0 else None,
                {"label": f"View Only seats (+{extra_vo_per_project}/proj x {active_projects} proj = {total_extra_vo})", "qty": total_extra_vo, "unit_price": ADDON_PRICES["view_only_seat"], "total": vo_cost} if total_extra_vo > 0 else None,
            ] if item is not None
        ],
    }


# =============================================================================
# Storage & Bandwidth
# =============================================================================

def calculate_storage_and_bandwidth(
    tier_name: str,
    required_active_storage_gb: float,
    required_archive_storage_gb: float,
    required_bandwidth_gb: float,
) -> Dict[str, Any]:
    """Calculate storage and bandwidth add-on blocks."""
    tier = get_tier(tier_name)
    included_storage = tier["storage"]
    included_bw = tier["bandwidth_gb"]

    # Active storage: 100 GB blocks
    extra_active_gb = max(0, required_active_storage_gb - included_storage["active_gb"])
    active_blocks = math.ceil(extra_active_gb / 100) if extra_active_gb > 0 else 0
    active_cost = active_blocks * ADDON_PRICES["active_storage_100gb"]

    # Archive storage: 500 GB blocks
    extra_archive_gb = max(0, required_archive_storage_gb - included_storage["archive_gb"])
    archive_blocks = math.ceil(extra_archive_gb / 500) if extra_archive_gb > 0 else 0
    archive_cost = archive_blocks * ADDON_PRICES["archive_storage_500gb"]

    # Bandwidth: 500 GB blocks
    extra_bw_gb = max(0, required_bandwidth_gb - included_bw)
    bw_blocks = math.ceil(extra_bw_gb / 500) if extra_bw_gb > 0 else 0
    bw_cost = bw_blocks * ADDON_PRICES["bandwidth_500gb"]

    total_cost = active_cost + archive_cost + bw_cost

    line_items = []
    if active_blocks > 0:
        line_items.append({"label": f"Active storage (+{active_blocks * 100} GB)", "qty": active_blocks, "unit_price": ADDON_PRICES["active_storage_100gb"], "total": active_cost})
    if archive_blocks > 0:
        line_items.append({"label": f"Archive storage (+{archive_blocks * 500} GB)", "qty": archive_blocks, "unit_price": ADDON_PRICES["archive_storage_500gb"], "total": archive_cost})
    if bw_blocks > 0:
        line_items.append({"label": f"Bandwidth (+{bw_blocks * 500} GB)", "qty": bw_blocks, "unit_price": ADDON_PRICES["bandwidth_500gb"], "total": bw_cost})

    return {
        "extra_active_gb": extra_active_gb,
        "active_blocks": active_blocks,
        "active_cost": active_cost,
        "extra_archive_gb": extra_archive_gb,
        "archive_blocks": archive_blocks,
        "archive_cost": archive_cost,
        "extra_bw_gb": extra_bw_gb,
        "bw_blocks": bw_blocks,
        "bw_cost": bw_cost,
        "total_cost": total_cost,
        "line_items": line_items,
    }


# =============================================================================
# Project Add-Ons
# =============================================================================

def calculate_extra_projects(tier_name: str, required_projects: int) -> Dict[str, Any]:
    """Calculate extra project costs beyond tier inclusion."""
    tier = get_tier(tier_name)
    included = tier["active_projects"]
    if included < 0:  # unlimited
        return {"extra_projects": 0, "cost": 0, "line_items": []}

    extra = max(0, required_projects - included)
    cost = extra * ADDON_PRICES["project"]
    line_items = []
    if extra > 0:
        line_items.append({"label": f"Extra projects (+{extra})", "qty": extra, "unit_price": ADDON_PRICES["project"], "total": cost})
    return {"extra_projects": extra, "cost": cost, "line_items": line_items}


# =============================================================================
# Module Calculations
# =============================================================================

def calculate_module_costs(
    tier_name: str,
    selected_modules: List[str],
    use_bundle: bool = False,
    term_type: str = "monthly",
) -> Dict[str, Any]:
    """Calculate costs for premium module add-ons."""
    tier = get_tier(tier_name)
    is_annual = term_type == "annual"

    line_items = []
    total_cost = 0

    # Check if production bundle makes sense
    if use_bundle:
        bundle = MODULE_BUNDLES["production_bundle"]
        price = bundle["annual_monthly"] if is_annual else bundle["monthly"]
        line_items.append({
            "label": bundle["name"],
            "qty": 1,
            "unit_price": price,
            "total": price,
        })
        return {
            "modules": bundle["modules"],
            "is_bundle": True,
            "total_cost": price,
            "line_items": line_items,
        }

    active_modules = []
    for mod_key in selected_modules:
        mod = PREMIUM_MODULES.get(mod_key)
        if not mod:
            continue

        # Skip if already included in tier
        if tier_name in mod["included_tiers"]:
            continue

        # Skip if not available for this tier (and not a la carte)
        if tier_name not in mod["available_tiers"] and tier_name != "a_la_carte":
            continue

        price = mod["annual_monthly"] if is_annual else mod["monthly"]
        line_items.append({
            "label": mod["name"],
            "qty": 1,
            "unit_price": price,
            "total": price,
        })
        total_cost += price
        active_modules.append(mod_key)

    return {
        "modules": active_modules,
        "is_bundle": False,
        "total_cost": total_cost,
        "line_items": line_items,
    }


# =============================================================================
# Volume Discounts
# =============================================================================

def apply_volume_discount(total_added_seat_count: int, total_seat_cost: float) -> Dict[str, Any]:
    """Volume discount on added seats only."""
    discount_rate = 0.0
    discount_band = "none"

    for threshold, rate in VOLUME_DISCOUNT_TIERS:
        if total_added_seat_count >= threshold:
            discount_rate = rate
            discount_band = f"{int(rate * 100)}%"
            break

    discount_amount = round(total_seat_cost * discount_rate, 2)

    return {
        "total_added_seats": total_added_seat_count,
        "discount_band": discount_band,
        "discount_rate": discount_rate,
        "discount_amount": discount_amount,
    }


# =============================================================================
# Bug Rewards (preserved from v1)
# =============================================================================

def apply_bug_reward(base_price: float, bug_reward: str) -> Dict[str, Any]:
    if bug_reward == "50_percent":
        return {"reward_type": "50_percent", "discount_amount": round(base_price * 0.5, 2), "description": "50% off base (bug reward)"}
    elif bug_reward == "100_percent":
        return {"reward_type": "100_percent", "discount_amount": base_price, "description": "Free base month (bug reward)"}
    return {"reward_type": "none", "discount_amount": 0, "description": ""}


# =============================================================================
# Annual Prepay
# =============================================================================

def calculate_annual_prepay(monthly_total: float) -> Dict[str, Any]:
    """Annual prepay: pay 10 months for 12 months of service (~16.67% savings)."""
    annual_total = monthly_total * 10
    annual_savings = monthly_total * 2
    effective_monthly = round(annual_total / 12, 2)

    return {
        "annual_total": annual_total,
        "annual_savings": annual_savings,
        "effective_monthly": effective_monthly,
        "months_billed": 10,
        "months_service": 12,
    }


# =============================================================================
# Main Calculator
# =============================================================================

def calculate_monthly_quote(
    tier_name: str,
    required_owner_seats: int = 0,
    required_collaborative_seats: int = 0,
    active_projects: int = 0,
    required_non_collaborative_per_project: int = 0,
    required_view_only_per_project: int = 0,
    required_active_storage_gb: float = 0,
    required_archive_storage_gb: float = 0,
    required_bandwidth_gb: float = 0,
    selected_modules: Optional[List[str]] = None,
    use_bundle: bool = False,
    bug_reward: str = "none",
    term_type: str = "monthly",
) -> Dict[str, Any]:
    """Calculate a full monthly quote with all line items."""
    tier = get_tier(tier_name)
    base_price = tier["base_price"]

    # Use tier defaults if not specified
    if active_projects == 0:
        active_projects = tier["active_projects"] if tier["active_projects"] > 0 else 1
    if required_owner_seats == 0:
        required_owner_seats = tier["org_seats"]["owner"]
    if required_collaborative_seats == 0:
        collab = tier["org_seats"]["collaborative"]
        required_collaborative_seats = collab if collab >= 0 else 0
    if required_non_collaborative_per_project == 0:
        nc = tier["project_seats"]["non_collaborative"]
        required_non_collaborative_per_project = nc if nc >= 0 else 0
    if required_view_only_per_project == 0:
        vo = tier["project_seats"]["view_only"]
        required_view_only_per_project = vo if vo >= 0 else 0
    if required_active_storage_gb == 0:
        required_active_storage_gb = tier["storage"]["active_gb"]
    if required_archive_storage_gb == 0:
        required_archive_storage_gb = tier["storage"]["archive_gb"]
    if required_bandwidth_gb == 0:
        required_bandwidth_gb = tier["bandwidth_gb"]

    # Calculate components
    seats = calculate_added_seats_and_costs(
        tier_name, required_owner_seats, required_collaborative_seats,
        active_projects, required_non_collaborative_per_project, required_view_only_per_project,
    )

    project_extras = calculate_extra_projects(tier_name, active_projects)

    storage_bw = calculate_storage_and_bandwidth(
        tier_name, required_active_storage_gb, required_archive_storage_gb, required_bandwidth_gb,
    )

    modules = calculate_module_costs(
        tier_name, selected_modules or [], use_bundle, term_type,
    )

    volume = apply_volume_discount(seats["total_added_seat_count"], seats["total_seat_cost"])
    bug = apply_bug_reward(base_price, bug_reward)

    # Build line items
    line_items = []
    if base_price > 0:
        line_items.append({"label": f"{tier_name.title()} base plan", "qty": 1, "unit_price": base_price, "total": base_price, "category": "base"})

    for item in seats["line_items"]:
        line_items.append({**item, "category": "seats"})
    for item in project_extras["line_items"]:
        line_items.append({**item, "category": "base"})
    for item in storage_bw["line_items"]:
        line_items.append({**item, "category": "storage"})
    for item in modules["line_items"]:
        line_items.append({**item, "category": "modules"})

    subtotal = base_price + seats["total_seat_cost"] + project_extras["cost"] + storage_bw["total_cost"] + modules["total_cost"]

    # Discounts
    discounts = []
    if volume["discount_amount"] > 0:
        discounts.append({"label": f"Volume discount ({volume['discount_band']} on {volume['total_added_seats']} added seats)", "amount": -volume["discount_amount"]})
    if bug["discount_amount"] > 0:
        discounts.append({"label": bug["description"], "amount": -bug["discount_amount"]})

    total_discounts = volume["discount_amount"] + bug["discount_amount"]
    monthly_total = round(subtotal - total_discounts, 2)

    # Annual prepay
    annual = None
    if term_type == "annual" and base_price > 0:
        annual = calculate_annual_prepay(monthly_total)

    return {
        "tier": tier_name,
        "base_price": base_price,
        "line_items": line_items,
        "seats_detail": seats,
        "project_extras": project_extras,
        "storage_bw_detail": storage_bw,
        "modules_detail": modules,
        "volume_discount": volume,
        "bug_reward": bug,
        "subtotal": subtotal,
        "discounts": discounts,
        "total_discounts": total_discounts,
        "monthly_total": monthly_total,
        "annual_prepay": annual,
    }


# =============================================================================
# Production Package (Phase-Based) — preserved from v1 for CRM quotes
# =============================================================================

def calculate_production_package(
    tier_name: str,
    phases: List[Dict[str, Any]],
    term_type: str = "monthly",
) -> Dict[str, Any]:
    """Quote month-by-month by phase."""
    phase_results = []
    total_months = 0
    grand_total = 0

    for phase in phases:
        months = phase.get("months", 1)
        monthly = calculate_monthly_quote(
            tier_name=tier_name,
            required_owner_seats=phase.get("required_owner_seats", 0),
            required_collaborative_seats=phase.get("required_collaborative_seats", 0),
            active_projects=phase.get("active_projects", 0),
            required_non_collaborative_per_project=phase.get("required_non_collaborative_per_project", 0),
            required_view_only_per_project=phase.get("required_view_only_per_project", 0),
            required_active_storage_gb=phase.get("required_active_storage_gb", 0),
            required_archive_storage_gb=phase.get("required_archive_storage_gb", 0),
            required_bandwidth_gb=phase.get("required_bandwidth_gb", 0),
            selected_modules=phase.get("selected_modules"),
            bug_reward=phase.get("bug_reward", "none"),
            term_type="monthly",
        )

        phase_total = monthly["monthly_total"] * months
        phase_results.append({
            "name": phase.get("name", f"Phase {len(phase_results) + 1}"),
            "months": months,
            "monthly_total": monthly["monthly_total"],
            "phase_total": phase_total,
            "detail": monthly,
        })
        total_months += months
        grand_total += phase_total

    effective_monthly = round(grand_total / total_months, 2) if total_months > 0 else 0

    annual = None
    if term_type == "annual" and total_months >= 12:
        annual = calculate_annual_prepay(effective_monthly)
        grand_total = annual["annual_total"]

    return {
        "phases": phase_results,
        "total_months": total_months,
        "grand_total": grand_total,
        "effective_monthly": effective_monthly,
        "annual_prepay": annual,
    }


# =============================================================================
# Full Quote Computation (from wizard inputs) — preserved for CRM quotes
# =============================================================================

def compute_full_quote(raw_input: Dict[str, Any]) -> Dict[str, Any]:
    """Compute a full quote from wizard raw_input JSON."""
    tier_name = raw_input.get("tier", "indie")
    term_type = raw_input.get("term_type", "monthly")
    term_months = raw_input.get("term_months", 3)
    is_production_package = raw_input.get("is_production_package", False)
    bug_reward = raw_input.get("bug_reward", "none")

    if is_production_package and raw_input.get("phases"):
        pkg = calculate_production_package(tier_name, raw_input["phases"], term_type)
        monthly_total = pkg["effective_monthly"]
        total_contract_value = pkg["grand_total"]
        phase_breakdown = pkg["phases"]
        line_items = pkg["phases"][0]["detail"]["line_items"] if pkg["phases"] else []
        monthly_breakdown = [
            {"phase": p["name"], "months": p["months"], "monthly": p["monthly_total"], "total": p["phase_total"]}
            for p in pkg["phases"]
        ]
    else:
        monthly = calculate_monthly_quote(
            tier_name=tier_name,
            required_owner_seats=raw_input.get("required_owner_seats", 0),
            required_collaborative_seats=raw_input.get("required_collaborative_seats", 0),
            active_projects=raw_input.get("active_projects", 0),
            required_non_collaborative_per_project=raw_input.get("required_non_collaborative_per_project", 0),
            required_view_only_per_project=raw_input.get("required_view_only_per_project", 0),
            required_active_storage_gb=raw_input.get("required_active_storage_gb", 0),
            required_archive_storage_gb=raw_input.get("required_archive_storage_gb", 0),
            required_bandwidth_gb=raw_input.get("required_bandwidth_gb", 0),
            selected_modules=raw_input.get("selected_modules"),
            use_bundle=raw_input.get("use_bundle", False),
            bug_reward=bug_reward,
            term_type=term_type,
        )
        monthly_total = monthly["monthly_total"]
        line_items = monthly["line_items"]
        phase_breakdown = []

        if term_type == "annual" and monthly.get("annual_prepay"):
            total_contract_value = monthly["annual_prepay"]["annual_total"]
        else:
            total_contract_value = monthly_total * term_months

        monthly_breakdown = [
            {"month": i + 1, "total": monthly_total} for i in range(term_months)
        ]

    effective_monthly = round(total_contract_value / term_months, 2) if term_months > 0 else monthly_total

    return {
        "line_items": line_items,
        "monthly_breakdown": monthly_breakdown,
        "phase_breakdown": phase_breakdown,
        "monthly_total": monthly_total,
        "total_contract_value": round(total_contract_value, 2),
        "effective_monthly_rate": effective_monthly,
    }


# =============================================================================
# A La Carte Calculator
# =============================================================================

def calculate_a_la_carte_quote(
    owner_seats: int = 1,
    collaborative_seats: int = 0,
    active_projects: int = 1,
    non_collaborative_per_project: int = 0,
    view_only_per_project: int = 0,
    active_storage_gb: float = 0,
    archive_storage_gb: float = 0,
    bandwidth_gb: float = 0,
    selected_modules: Optional[List[str]] = None,
    use_bundle: bool = False,
    term_type: str = "monthly",
) -> Dict[str, Any]:
    """A la carte pricing — no tier base. Min: 1 owner ($19) + 1 project ($14) = $33/mo."""
    owner_seats = max(1, owner_seats)
    active_projects = max(1, active_projects)
    is_annual = term_type == "annual"

    line_items = []

    # Owner seats
    owner_cost = owner_seats * ADDON_PRICES["owner_seat"]
    line_items.append({"label": f"Owner seats ({owner_seats})", "qty": owner_seats, "unit_price": ADDON_PRICES["owner_seat"], "total": owner_cost, "category": "seats"})

    # Collaborative seats
    collab_cost = collaborative_seats * ADDON_PRICES["collaborative_seat"]
    if collaborative_seats > 0:
        line_items.append({"label": f"Collaborative seats ({collaborative_seats})", "qty": collaborative_seats, "unit_price": ADDON_PRICES["collaborative_seat"], "total": collab_cost, "category": "seats"})

    # Projects
    project_cost = active_projects * ADDON_PRICES["project"]
    line_items.append({"label": f"Active projects ({active_projects})", "qty": active_projects, "unit_price": ADDON_PRICES["project"], "total": project_cost, "category": "base"})

    # Per-project seats
    total_nc = non_collaborative_per_project * active_projects
    nc_cost = total_nc * ADDON_PRICES["non_collaborative_seat"]
    if total_nc > 0:
        line_items.append({"label": f"Non-Collaborative seats ({non_collaborative_per_project}/proj x {active_projects} proj = {total_nc})", "qty": total_nc, "unit_price": ADDON_PRICES["non_collaborative_seat"], "total": nc_cost, "category": "seats"})

    total_vo = view_only_per_project * active_projects
    vo_cost = total_vo * ADDON_PRICES["view_only_seat"]
    if total_vo > 0:
        line_items.append({"label": f"View Only seats ({view_only_per_project}/proj x {active_projects} proj = {total_vo})", "qty": total_vo, "unit_price": ADDON_PRICES["view_only_seat"], "total": vo_cost, "category": "seats"})

    # Storage
    active_blocks = math.ceil(active_storage_gb / 100) if active_storage_gb > 0 else 0
    active_storage_cost = active_blocks * ADDON_PRICES["active_storage_100gb"]
    if active_blocks > 0:
        line_items.append({"label": f"Active storage ({active_blocks * 100} GB)", "qty": active_blocks, "unit_price": ADDON_PRICES["active_storage_100gb"], "total": active_storage_cost, "category": "storage"})

    archive_blocks = math.ceil(archive_storage_gb / 500) if archive_storage_gb > 0 else 0
    archive_storage_cost = archive_blocks * ADDON_PRICES["archive_storage_500gb"]
    if archive_blocks > 0:
        line_items.append({"label": f"Archive storage ({archive_blocks * 500} GB)", "qty": archive_blocks, "unit_price": ADDON_PRICES["archive_storage_500gb"], "total": archive_storage_cost, "category": "storage"})

    bw_blocks = math.ceil(bandwidth_gb / 500) if bandwidth_gb > 0 else 0
    bw_cost = bw_blocks * ADDON_PRICES["bandwidth_500gb"]
    if bw_blocks > 0:
        line_items.append({"label": f"Bandwidth ({bw_blocks * 500} GB)", "qty": bw_blocks, "unit_price": ADDON_PRICES["bandwidth_500gb"], "total": bw_cost, "category": "storage"})

    # Modules (all available in a la carte)
    module_cost = 0
    if selected_modules or use_bundle:
        if use_bundle:
            bundle = MODULE_BUNDLES["production_bundle"]
            price = bundle["annual_monthly"] if is_annual else bundle["monthly"]
            line_items.append({"label": bundle["name"], "qty": 1, "unit_price": price, "total": price, "category": "modules"})
            module_cost = price
        elif selected_modules:
            for mod_key in selected_modules:
                mod = PREMIUM_MODULES.get(mod_key)
                if not mod:
                    continue
                price = mod["annual_monthly"] if is_annual else mod["monthly"]
                line_items.append({"label": mod["name"], "qty": 1, "unit_price": price, "total": price, "category": "modules"})
                module_cost += price

    # Volume discount
    total_seat_count = owner_seats + collaborative_seats + total_nc + total_vo
    total_seat_cost = owner_cost + collab_cost + nc_cost + vo_cost
    volume = apply_volume_discount(total_seat_count, total_seat_cost)

    subtotal = owner_cost + collab_cost + project_cost + nc_cost + vo_cost + active_storage_cost + archive_storage_cost + bw_cost + module_cost

    discounts = []
    if volume["discount_amount"] > 0:
        discounts.append({"label": f"Volume discount ({volume['discount_band']} on {volume['total_added_seats']} seats)", "amount": -volume["discount_amount"]})

    monthly_total = round(subtotal - volume["discount_amount"], 2)

    annual = None
    if term_type == "annual":
        annual = calculate_annual_prepay(monthly_total)

    return {
        "plan_type": "a_la_carte",
        "tier": None,
        "base_price": 0,
        "line_items": line_items,
        "volume_discount": volume,
        "subtotal": subtotal,
        "discounts": discounts,
        "total_discounts": volume["discount_amount"],
        "monthly_total": monthly_total,
        "annual_prepay": annual,
        "config_summary": {
            "owner_seats": owner_seats,
            "collaborative_seats": collaborative_seats,
            "active_projects": active_projects,
            "non_collaborative_per_project": non_collaborative_per_project,
            "view_only_per_project": view_only_per_project,
            "active_storage_gb": active_storage_gb,
            "archive_storage_gb": archive_storage_gb,
            "bandwidth_gb": bandwidth_gb,
            "selected_modules": selected_modules or [],
            "use_bundle": use_bundle,
        },
    }


# =============================================================================
# Self-Service Quote (unified entry for checkout flow)
# =============================================================================

def compute_self_service_quote(
    plan_type: str,
    tier_name: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Unified entry point for self-service pricing.
    Returns {monthly_total_cents, effective_monthly_cents, line_items, config_summary}.
    """
    config = config or {}
    term_type = config.get("term_type", "monthly")
    selected_modules = config.get("selected_modules", [])
    use_bundle = config.get("use_bundle", False)

    if plan_type == "a_la_carte":
        result = calculate_a_la_carte_quote(
            owner_seats=config.get("owner_seats", 1),
            collaborative_seats=config.get("collaborative_seats", 0),
            active_projects=config.get("active_projects", 1),
            non_collaborative_per_project=config.get("non_collaborative_per_project", 0),
            view_only_per_project=config.get("view_only_per_project", 0),
            active_storage_gb=config.get("active_storage_gb", 0),
            archive_storage_gb=config.get("archive_storage_gb", 0),
            bandwidth_gb=config.get("bandwidth_gb", 0),
            selected_modules=selected_modules,
            use_bundle=use_bundle,
            term_type=term_type,
        )
    else:
        if not tier_name:
            raise ValueError("tier_name required for tier plan_type")

        # Free tier doesn't need Stripe
        if tier_name == "free":
            tier = get_tier("free")
            return {
                "plan_type": "tier",
                "tier_name": "free",
                "monthly_total": 0,
                "monthly_total_cents": 0,
                "effective_monthly_cents": 0,
                "annual_prepay": False,
                "line_items": [],
                "discounts": [],
                "annual_detail": None,
                "config_summary": {
                    "owner_seats": tier["org_seats"]["owner"],
                    "collaborative_seats": tier["org_seats"]["collaborative"],
                    "active_projects": tier["active_projects"],
                    "non_collaborative_per_project": tier["project_seats"]["non_collaborative"],
                    "view_only_per_project": tier["project_seats"]["view_only"],
                    "active_storage_gb": tier["storage"]["active_gb"],
                    "archive_storage_gb": tier["storage"]["archive_gb"],
                    "bandwidth_gb": tier["bandwidth_gb"],
                    "selected_modules": [],
                    "use_bundle": False,
                },
                "modules_detail": {"modules": [], "is_bundle": False, "total_cost": 0, "line_items": []},
            }

        result = calculate_monthly_quote(
            tier_name=tier_name,
            required_owner_seats=config.get("owner_seats", 0),
            required_collaborative_seats=config.get("collaborative_seats", 0),
            active_projects=config.get("active_projects", 0),
            required_non_collaborative_per_project=config.get("non_collaborative_per_project", 0),
            required_view_only_per_project=config.get("view_only_per_project", 0),
            required_active_storage_gb=config.get("active_storage_gb", 0),
            required_archive_storage_gb=config.get("archive_storage_gb", 0),
            required_bandwidth_gb=config.get("bandwidth_gb", 0),
            selected_modules=selected_modules,
            use_bundle=use_bundle,
            term_type=term_type,
        )

    monthly_total = result["monthly_total"]
    annual = result.get("annual_prepay")
    effective_monthly = annual["effective_monthly"] if annual else monthly_total

    # Build config summary for tier plans
    if plan_type != "a_la_carte":
        tier = get_tier(tier_name)
        config_summary = {
            "owner_seats": config.get("owner_seats") or tier["org_seats"]["owner"],
            "collaborative_seats": config.get("collaborative_seats") or max(0, tier["org_seats"]["collaborative"]),
            "active_projects": config.get("active_projects") or max(1, tier["active_projects"]),
            "non_collaborative_per_project": config.get("non_collaborative_per_project") or max(0, tier["project_seats"]["non_collaborative"]),
            "view_only_per_project": config.get("view_only_per_project") or max(0, tier["project_seats"]["view_only"]),
            "active_storage_gb": config.get("active_storage_gb") or tier["storage"]["active_gb"],
            "archive_storage_gb": config.get("archive_storage_gb") or tier["storage"]["archive_gb"],
            "bandwidth_gb": config.get("bandwidth_gb") or tier["bandwidth_gb"],
            "selected_modules": selected_modules,
            "use_bundle": use_bundle,
        }
    else:
        config_summary = result["config_summary"]

    modules_detail = result.get("modules_detail", {"modules": [], "is_bundle": False, "total_cost": 0, "line_items": []})

    return {
        "plan_type": plan_type,
        "tier_name": tier_name,
        "monthly_total": monthly_total,
        "monthly_total_cents": int(round(monthly_total * 100)),
        "effective_monthly_cents": int(round(effective_monthly * 100)),
        "annual_prepay": term_type == "annual",
        "line_items": result["line_items"],
        "discounts": result.get("discounts", []),
        "annual_detail": annual,
        "config_summary": config_summary,
        "modules_detail": modules_detail,
    }
