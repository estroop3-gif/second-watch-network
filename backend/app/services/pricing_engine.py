"""
Backlot Pricing Engine — Pure calculation functions.

Annual prepay decision: Applies to the FULL monthly total (base + add-ons).
Rationale: Simpler billing, more competitive, industry standard SaaS approach.
Formula: annual_total = monthly_total × 10 (for 12 months of service, 2 free).
"""

import math
from typing import Dict, Any, List, Optional, Tuple

# =============================================================================
# Tier Definitions (source of truth)
# =============================================================================

TIERS = {
    "starter": {
        "base_price": 1000,
        "org_seats": {"owner": 1, "collaborative": 2},
        "active_projects": 5,
        "project_seats": {"non_collaborative": 3, "view_only": 3},
        "storage": {"active_tb": 1, "archive_tb": 2},
        "bandwidth_gb": 500,
    },
    "studio": {
        "base_price": 4000,
        "org_seats": {"owner": 1, "collaborative": 14},
        "active_projects": 15,
        "project_seats": {"non_collaborative": 6, "view_only": 10},
        "storage": {"active_tb": 3, "archive_tb": 8},
        "bandwidth_gb": 2000,
    },
    "enterprise": {
        "base_price": 8000,
        "org_seats": {"owner": 2, "collaborative": 28},
        "active_projects": 30,
        "project_seats": {"non_collaborative": 10, "view_only": 20},
        "storage": {"active_tb": 6, "archive_tb": 20},
        "bandwidth_gb": 5000,
    },
}

ADDON_PRICES = {
    "owner_seat": 150,
    "collaborative_seat": 75,
    "non_collaborative_seat": 25,
    "view_only_seat": 5,
    "active_storage_tb": 200,       # per 1 TB block
    "archive_storage_2tb": 150,     # per 2 TB block
    "bandwidth_500gb": 150,         # per 500 GB block
}

VOLUME_DISCOUNT_TIERS = [
    (50, 0.15),   # 50+ seats: 15%
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
    """
    Calculate extra seats needed beyond tier inclusions and their costs.

    Project seat math:
        extra_per_project = max(0, required_per_project - included_per_project)
        total_extra = extra_per_project * active_projects
    """
    tier = get_tier(tier_name)
    included = tier["org_seats"]
    included_project = tier["project_seats"]

    # Org seats
    extra_owner = max(0, required_owner_seats - included["owner"])
    extra_collaborative = max(0, required_collaborative_seats - included["collaborative"])

    # Project seats (per-project math)
    extra_nc_per_project = max(0, required_non_collaborative_per_project - included_project["non_collaborative"])
    extra_vo_per_project = max(0, required_view_only_per_project - included_project["view_only"])
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
                {"label": f"Non-Collaborative seats (+{extra_nc_per_project}/proj × {active_projects} proj = {total_extra_nc})", "qty": total_extra_nc, "unit_price": ADDON_PRICES["non_collaborative_seat"], "total": nc_cost} if total_extra_nc > 0 else None,
                {"label": f"View Only seats (+{extra_vo_per_project}/proj × {active_projects} proj = {total_extra_vo})", "qty": total_extra_vo, "unit_price": ADDON_PRICES["view_only_seat"], "total": vo_cost} if total_extra_vo > 0 else None,
            ] if item is not None
        ],
    }


# =============================================================================
# Storage & Bandwidth
# =============================================================================

def calculate_storage_and_bandwidth(
    tier_name: str,
    required_active_storage_tb: float,
    required_archive_storage_tb: float,
    required_bandwidth_gb: float,
) -> Dict[str, Any]:
    """Calculate storage and bandwidth add-on blocks (rounded up, no overage)."""
    tier = get_tier(tier_name)
    included_storage = tier["storage"]
    included_bw = tier["bandwidth_gb"]

    # Active storage: 1 TB blocks
    extra_active_tb = max(0, required_active_storage_tb - included_storage["active_tb"])
    active_blocks = math.ceil(extra_active_tb)  # round up to whole TB blocks
    active_cost = active_blocks * ADDON_PRICES["active_storage_tb"]

    # Archive storage: 2 TB blocks
    extra_archive_tb = max(0, required_archive_storage_tb - included_storage["archive_tb"])
    archive_blocks = math.ceil(extra_archive_tb / 2)  # round up to 2 TB blocks
    archive_cost = archive_blocks * ADDON_PRICES["archive_storage_2tb"]

    # Bandwidth: 500 GB blocks
    extra_bw_gb = max(0, required_bandwidth_gb - included_bw)
    bw_blocks = math.ceil(extra_bw_gb / 500)  # round up to 500 GB blocks
    bw_cost = bw_blocks * ADDON_PRICES["bandwidth_500gb"]

    total_cost = active_cost + archive_cost + bw_cost

    line_items = []
    if active_blocks > 0:
        line_items.append({"label": f"Active storage (+{active_blocks} TB)", "qty": active_blocks, "unit_price": ADDON_PRICES["active_storage_tb"], "total": active_cost})
    if archive_blocks > 0:
        line_items.append({"label": f"Archive storage (+{archive_blocks * 2} TB)", "qty": archive_blocks, "unit_price": ADDON_PRICES["archive_storage_2tb"], "total": archive_cost})
    if bw_blocks > 0:
        line_items.append({"label": f"Bandwidth (+{bw_blocks * 500} GB)", "qty": bw_blocks, "unit_price": ADDON_PRICES["bandwidth_500gb"], "total": bw_cost})

    return {
        "extra_active_tb": extra_active_tb,
        "active_blocks": active_blocks,
        "active_cost": active_cost,
        "extra_archive_tb": extra_archive_tb,
        "archive_blocks": archive_blocks,
        "archive_cost": archive_cost,
        "extra_bw_gb": extra_bw_gb,
        "bw_blocks": bw_blocks,
        "bw_cost": bw_cost,
        "total_cost": total_cost,
        "line_items": line_items,
    }


# =============================================================================
# Volume Discounts
# =============================================================================

def apply_volume_discount(total_added_seat_count: int, total_seat_cost: float) -> Dict[str, Any]:
    """
    Volume discount on added seats only.
    10-24 added seats → 5%, 25-49 → 10%, 50+ → 15%.
    """
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
# Bug Rewards
# =============================================================================

def apply_bug_reward(base_price: float, bug_reward: str) -> Dict[str, Any]:
    """
    Bug reward applies to base tier component only.
    - 'none': no discount
    - '50_percent': 50% off base for that month
    - '100_percent': 100% off base (free month of base)
    """
    if bug_reward == "50_percent":
        return {"reward_type": "50_percent", "discount_amount": round(base_price * 0.5, 2), "description": "50% off base (bug reward)"}
    elif bug_reward == "100_percent":
        return {"reward_type": "100_percent", "discount_amount": base_price, "description": "Free base month (bug reward)"}
    return {"reward_type": "none", "discount_amount": 0, "description": ""}


# =============================================================================
# Annual Prepay
# =============================================================================

def calculate_annual_prepay(monthly_total: float) -> Dict[str, Any]:
    """
    Annual prepay: pay 10 months for 12 months of service.
    Applied to FULL monthly total (base + all add-ons).
    Effective discount: ~16.67%.
    """
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
    required_active_storage_tb: float = 0,
    required_archive_storage_tb: float = 0,
    required_bandwidth_gb: float = 0,
    bug_reward: str = "none",
    term_type: str = "monthly",
) -> Dict[str, Any]:
    """
    Calculate a full monthly quote with all line items.

    Monthly total =
        base_price
        + added_org_seats
        + added_project_seats
        + storage_blocks
        + bandwidth_blocks
        - volume_discount (on added seats only)
        - bug_reward (off base only)
    """
    tier = get_tier(tier_name)
    base_price = tier["base_price"]

    # Use tier defaults if not specified
    if active_projects == 0:
        active_projects = tier["active_projects"]
    if required_owner_seats == 0:
        required_owner_seats = tier["org_seats"]["owner"]
    if required_collaborative_seats == 0:
        required_collaborative_seats = tier["org_seats"]["collaborative"]
    if required_non_collaborative_per_project == 0:
        required_non_collaborative_per_project = tier["project_seats"]["non_collaborative"]
    if required_view_only_per_project == 0:
        required_view_only_per_project = tier["project_seats"]["view_only"]
    if required_active_storage_tb == 0:
        required_active_storage_tb = tier["storage"]["active_tb"]
    if required_archive_storage_tb == 0:
        required_archive_storage_tb = tier["storage"]["archive_tb"]
    if required_bandwidth_gb == 0:
        required_bandwidth_gb = tier["bandwidth_gb"]

    # Calculate components
    seats = calculate_added_seats_and_costs(
        tier_name, required_owner_seats, required_collaborative_seats,
        active_projects, required_non_collaborative_per_project, required_view_only_per_project,
    )

    storage_bw = calculate_storage_and_bandwidth(
        tier_name, required_active_storage_tb, required_archive_storage_tb, required_bandwidth_gb,
    )

    volume = apply_volume_discount(seats["total_added_seat_count"], seats["total_seat_cost"])
    bug = apply_bug_reward(base_price, bug_reward)

    # Build line items
    line_items = [
        {"label": f"{tier_name.title()} base plan", "qty": 1, "unit_price": base_price, "total": base_price, "category": "base"},
    ]
    for item in seats["line_items"]:
        line_items.append({**item, "category": "seats"})
    for item in storage_bw["line_items"]:
        line_items.append({**item, "category": "storage"})

    # Subtotal before discounts
    subtotal = base_price + seats["total_seat_cost"] + storage_bw["total_cost"]

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
    if term_type == "annual":
        annual = calculate_annual_prepay(monthly_total)

    return {
        "tier": tier_name,
        "base_price": base_price,
        "line_items": line_items,
        "seats_detail": seats,
        "storage_bw_detail": storage_bw,
        "volume_discount": volume,
        "bug_reward": bug,
        "subtotal": subtotal,
        "discounts": discounts,
        "total_discounts": total_discounts,
        "monthly_total": monthly_total,
        "annual_prepay": annual,
    }


# =============================================================================
# Production Package (Phase-Based)
# =============================================================================

def calculate_production_package(
    tier_name: str,
    phases: List[Dict[str, Any]],
    term_type: str = "monthly",
) -> Dict[str, Any]:
    """
    Quote month-by-month by phase.
    Each phase has: name, months, and optional overrides for projects, seats, storage, bandwidth.
    """
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
            required_active_storage_tb=phase.get("required_active_storage_tb", 0),
            required_archive_storage_tb=phase.get("required_archive_storage_tb", 0),
            required_bandwidth_gb=phase.get("required_bandwidth_gb", 0),
            bug_reward=phase.get("bug_reward", "none"),
            term_type="monthly",  # always monthly per-phase, annual applied to total
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

    # Annual adjustment if applicable
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
# Full Quote Computation (from wizard inputs)
# =============================================================================

def compute_full_quote(raw_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute a full quote from wizard raw_input JSON.
    Returns all computed fields ready for DB storage.
    """
    tier_name = raw_input.get("tier", "starter")
    term_type = raw_input.get("term_type", "monthly")
    term_months = raw_input.get("term_months", 3)
    is_production_package = raw_input.get("is_production_package", False)
    bug_reward = raw_input.get("bug_reward", "none")

    if is_production_package and raw_input.get("phases"):
        pkg = calculate_production_package(tier_name, raw_input["phases"], term_type)
        monthly_total = pkg["effective_monthly"]
        total_contract_value = pkg["grand_total"]
        phase_breakdown = pkg["phases"]
        # Use first phase's detail for line items
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
            required_active_storage_tb=raw_input.get("required_active_storage_tb", 0),
            required_archive_storage_tb=raw_input.get("required_archive_storage_tb", 0),
            required_bandwidth_gb=raw_input.get("required_bandwidth_gb", 0),
            bug_reward=bug_reward,
            term_type=term_type,
        )
        monthly_total = monthly["monthly_total"]
        line_items = monthly["line_items"]
        phase_breakdown = []

        if term_type == "annual":
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
