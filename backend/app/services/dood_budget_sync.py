"""
DOOD → Active Estimate Budget Sync Service

Syncs DOOD subject rates and work day assignments into the Active Estimate
budget as line items, enabling automatic cost projection from scheduling.
"""
from typing import Optional, Dict, Any, List
import logging

from app.core.database import get_client, execute_single, execute_query
from app.services.budget_actuals import (
    get_estimate_budget,
    get_or_create_category,
    update_category_actual,
    update_budget_actual,
)

logger = logging.getLogger(__name__)


def sync_dood_subject_to_estimate(subject_id: str, project_id: str) -> Optional[Dict]:
    """
    When a DOOD subject has rate + work days, auto-create/update
    a budget line item in the Active Estimate.

    1. Get subject (rate_type, rate_amount, department)
    2. Count W-day assignments
    3. Find/create estimate budget → find/create department category
    4. Find/create line item with source_type='dood_subject', source_id=subject_id
    5. Calculate: daily rate × W-days (hourly: rate × days × 10hrs assumed)
    6. Update line item estimated_total
    7. If rate=0 or W-days=0, remove existing line item
    """
    client = get_client()

    # Get subject
    subject_result = client.table("dood_subjects").select(
        "id, display_name, rate_type, rate_amount, department, subject_type"
    ).eq("id", subject_id).execute()

    if not subject_result.data:
        logger.warning(f"[DoodSync] Subject {subject_id} not found")
        return None

    subject = subject_result.data[0]
    rate_amount = float(subject.get("rate_amount") or 0)
    rate_type = subject.get("rate_type", "daily")
    department = subject.get("department") or "Crew"
    display_name = subject.get("display_name", "Unknown")

    # Count W-day assignments (code = 'W' means Work day)
    w_count_result = execute_single(
        "SELECT COUNT(*) as w_days FROM dood_assignments WHERE subject_id = :sid AND code = 'W'",
        {"sid": subject_id}
    )
    w_days = int(w_count_result["w_days"]) if w_count_result else 0

    # Get the estimate budget
    estimate = get_estimate_budget(project_id)
    if not estimate:
        logger.info(f"[DoodSync] No estimate budget for project {project_id}, skipping sync")
        return None

    budget_id = estimate["id"]

    # Check if line item already exists for this subject
    existing_li = client.table("backlot_budget_line_items").select(
        "id, category_id, estimated_total"
    ).eq("budget_id", budget_id).eq(
        "source_type", "dood_subject"
    ).eq("source_id", subject_id).limit(1).execute()

    # If no rate or no work days, remove existing line item
    if rate_amount <= 0 or w_days == 0:
        if existing_li.data:
            li = existing_li.data[0]
            cat_id = li["category_id"]
            client.table("backlot_budget_line_items").delete().eq("id", li["id"]).execute()
            _recalc_category_estimated(cat_id)
            _recalc_budget_estimated(budget_id)
            logger.info(f"[DoodSync] Removed line item for subject {display_name} (rate={rate_amount}, W-days={w_days})")
        return {"action": "removed", "subject": display_name}

    # Calculate estimated total
    if rate_type == "hourly":
        daily_equivalent = rate_amount * 10  # Assume 10hr day
    elif rate_type == "weekly":
        daily_equivalent = rate_amount / 5.0
    elif rate_type == "flat":
        daily_equivalent = rate_amount  # Flat = total, not per day
        w_days = 1  # Flat rate doesn't multiply by days
    else:
        daily_equivalent = rate_amount  # Daily rate

    estimated_total = round(daily_equivalent * w_days, 2)

    # Find or create the department category
    category = get_or_create_category(budget_id, department, "production")
    if not category:
        logger.warning(f"[DoodSync] Could not create category '{department}' for budget {budget_id}")
        return None

    if existing_li.data:
        # Update existing line item
        li = existing_li.data[0]
        old_cat_id = li["category_id"]

        update_data = {
            "description": f"{display_name} ({rate_type} ${rate_amount:,.2f} × {w_days}d)",
            "quantity": w_days if rate_type != "flat" else 1,
            "rate": daily_equivalent if rate_type != "flat" else rate_amount,
            "category_id": category["id"],
            "notes": f"Auto-synced from DOOD. {rate_type} rate: ${rate_amount:,.2f}",
        }
        client.table("backlot_budget_line_items").update(update_data).eq("id", li["id"]).execute()

        # Update estimated_total via raw SQL since it might be generated or manual
        _set_line_item_estimated(li["id"], estimated_total)

        # Recalc old category if it changed
        if old_cat_id != category["id"]:
            _recalc_category_estimated(old_cat_id)

        _recalc_category_estimated(category["id"])
        _recalc_budget_estimated(budget_id)

        logger.info(f"[DoodSync] Updated line item for {display_name}: ${estimated_total:,.2f}")
        return {"action": "updated", "subject": display_name, "estimated_total": estimated_total}
    else:
        # Create new line item
        new_li = {
            "budget_id": budget_id,
            "category_id": category["id"],
            "description": f"{display_name} ({rate_type} ${rate_amount:,.2f} × {w_days}d)",
            "quantity": w_days if rate_type != "flat" else 1,
            "rate": daily_equivalent if rate_type != "flat" else rate_amount,
            "actual_total": 0,
            "source_type": "dood_subject",
            "source_id": subject_id,
            "notes": f"Auto-synced from DOOD. {rate_type} rate: ${rate_amount:,.2f}",
            "sort_order": 0,
        }
        li_result = client.table("backlot_budget_line_items").insert(new_li).execute()

        if li_result.data:
            _set_line_item_estimated(li_result.data[0]["id"], estimated_total)
            _recalc_category_estimated(category["id"])
            _recalc_budget_estimated(budget_id)

        logger.info(f"[DoodSync] Created line item for {display_name}: ${estimated_total:,.2f}")
        return {"action": "created", "subject": display_name, "estimated_total": estimated_total}


def remove_dood_subject_line_item(subject_id: str, project_id: str) -> bool:
    """Remove the budget line item linked to a deleted DOOD subject."""
    client = get_client()

    estimate = get_estimate_budget(project_id)
    if not estimate:
        return False

    existing = client.table("backlot_budget_line_items").select(
        "id, category_id"
    ).eq("budget_id", estimate["id"]).eq(
        "source_type", "dood_subject"
    ).eq("source_id", subject_id).limit(1).execute()

    if not existing.data:
        return False

    li = existing.data[0]
    client.table("backlot_budget_line_items").delete().eq("id", li["id"]).execute()
    _recalc_category_estimated(li["category_id"])
    _recalc_budget_estimated(estimate["id"])
    logger.info(f"[DoodSync] Removed line item for deleted subject {subject_id}")
    return True


def sync_all_dood_subjects_to_estimate(project_id: str) -> Dict:
    """Full sync of all subjects for a project. Returns {synced, created, updated, removed}."""
    client = get_client()

    subjects = client.table("dood_subjects").select(
        "id, display_name, rate_amount"
    ).eq("project_id", project_id).execute()

    stats = {"synced": 0, "created": 0, "updated": 0, "removed": 0, "skipped": 0}

    for subject in (subjects.data or []):
        result = sync_dood_subject_to_estimate(subject["id"], project_id)
        if result:
            action = result.get("action")
            if action == "created":
                stats["created"] += 1
            elif action == "updated":
                stats["updated"] += 1
            elif action == "removed":
                stats["removed"] += 1
            stats["synced"] += 1
        else:
            stats["skipped"] += 1

    logger.info(f"[DoodSync] Full sync for project {project_id}: {stats}")
    return stats


def get_dood_cost_summary(project_id: str) -> Dict:
    """Per-subject cost projection + total. For display in DOOD view."""
    client = get_client()

    # Get all subjects with rates
    subjects = client.table("dood_subjects").select(
        "id, display_name, rate_type, rate_amount, department, subject_type"
    ).eq("project_id", project_id).order("sort_order").execute()

    items = []
    total = 0.0

    for s in (subjects.data or []):
        rate_amount = float(s.get("rate_amount") or 0)
        rate_type = s.get("rate_type", "daily")

        if rate_amount <= 0:
            items.append({
                "subject_id": s["id"],
                "display_name": s["display_name"],
                "department": s.get("department"),
                "rate_type": rate_type,
                "rate_amount": 0,
                "w_days": 0,
                "estimated_total": 0,
                "has_rate": False,
            })
            continue

        # Count W-days
        w_result = execute_single(
            "SELECT COUNT(*) as w_days FROM dood_assignments WHERE subject_id = :sid AND code = 'W'",
            {"sid": s["id"]}
        )
        w_days = int(w_result["w_days"]) if w_result else 0

        # Calculate
        if rate_type == "hourly":
            daily_equiv = rate_amount * 10
        elif rate_type == "weekly":
            daily_equiv = rate_amount / 5.0
        elif rate_type == "flat":
            daily_equiv = rate_amount
            w_days = 1
        else:
            daily_equiv = rate_amount

        estimated = round(daily_equiv * w_days, 2)
        total += estimated

        items.append({
            "subject_id": s["id"],
            "display_name": s["display_name"],
            "department": s.get("department"),
            "rate_type": rate_type,
            "rate_amount": rate_amount,
            "w_days": w_days,
            "daily_equivalent": round(daily_equiv, 2),
            "estimated_total": estimated,
            "has_rate": True,
        })

    return {
        "items": items,
        "total_estimated": round(total, 2),
        "subjects_with_rates": sum(1 for i in items if i["has_rate"]),
        "subjects_without_rates": sum(1 for i in items if not i["has_rate"]),
    }


# ============================================================================
# Internal helpers
# ============================================================================

def _set_line_item_estimated(line_item_id: str, estimated_total: float):
    """Set estimated_total on a line item. Handles both generated and manual columns."""
    client = get_client()
    try:
        # Try direct update (works if estimated_total is a regular column)
        client.table("backlot_budget_line_items").update({
            "manual_total_override": estimated_total,
            "use_manual_total": True,
        }).eq("id", line_item_id).execute()
    except Exception:
        # Fallback: set quantity and rate so the generated column computes correctly
        pass


def _recalc_category_estimated(category_id: str):
    """Recalculate category estimated_subtotal from its line items."""
    client = get_client()
    result = execute_single(
        "SELECT COALESCE(SUM(CASE WHEN use_manual_total AND manual_total_override IS NOT NULL "
        "THEN manual_total_override ELSE COALESCE(quantity * rate, 0) END), 0) as total "
        "FROM backlot_budget_line_items WHERE category_id = :cat_id",
        {"cat_id": category_id}
    )
    total = float(result["total"]) if result else 0
    client.table("backlot_budget_categories").update({
        "estimated_subtotal": total
    }).eq("id", category_id).execute()


def _recalc_budget_estimated(budget_id: str):
    """Recalculate budget estimated_total from its categories."""
    client = get_client()
    result = execute_single(
        "SELECT COALESCE(SUM(estimated_subtotal), 0) as total "
        "FROM backlot_budget_categories WHERE budget_id = :bid",
        {"bid": budget_id}
    )
    total = float(result["total"]) if result else 0
    client.table("backlot_budgets").update({
        "estimated_total": total
    }).eq("id", budget_id).execute()
