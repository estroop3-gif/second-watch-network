"""
Budget Actuals Service
Handles recording of actual budget entries from approved expenses and invoices.
Includes source tracking to prevent double-counting.
Auto-creates budget structure if none exists.
"""
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
import logging

from app.core.database import get_client, execute_single

logger = logging.getLogger(__name__)


def check_source_already_recorded(source_type: str, source_id: str) -> bool:
    """Check if a source has already been recorded as a budget actual."""
    client = get_client()
    result = client.table("backlot_budget_actuals").select("id").eq(
        "source_type", source_type
    ).eq("source_id", source_id).limit(1).execute()
    return bool(result.data)


def get_or_create_budget_for_project(project_id: str) -> Optional[Dict[str, Any]]:
    """Get existing budget for the project to record actuals against.

    IMPORTANT: Actuals should be recorded against the SAME budget that has
    the estimated values, so variance can be calculated (actual - estimated).

    Priority:
    1. Return existing estimated budget (most common case - user created a budget)
    2. Return any existing budget
    3. Create a new budget if none exists

    This ensures actuals update the actual_subtotal on categories that already
    have estimated_subtotal values, enabling variance tracking.
    """
    client = get_client()

    # First, look for an estimated budget (the main planning budget)
    result = client.table("backlot_budgets").select("id, name, budget_type").eq(
        "project_id", project_id
    ).eq("budget_type", "estimated").limit(1).execute()

    if result.data:
        logger.info(f"[BudgetActuals] Using estimated budget {result.data[0]['id']} for project {project_id}")
        return result.data[0]

    # Fall back to any budget for this project
    result = client.table("backlot_budgets").select("id, name, budget_type").eq(
        "project_id", project_id
    ).limit(1).execute()

    if result.data:
        logger.info(f"[BudgetActuals] Using existing budget {result.data[0]['id']} for project {project_id}")
        return result.data[0]

    # No budget exists - create one for tracking actuals
    new_budget = {
        "project_id": project_id,
        "name": "Budget",
        "status": "active",
        "budget_type": "estimated",  # Use estimated so user can add planned values too
    }
    budget_result = client.table("backlot_budgets").insert(new_budget).execute()

    if not budget_result.data:
        return None

    logger.info(f"[BudgetActuals] Auto-created budget for project {project_id}")
    return budget_result.data[0]


def _copy_budget_structure(source_budget_id: str, target_budget_id: str):
    """Copy category structure from source budget to target budget.

    Only copies categories (not line items) - line items in the actual budget
    will be created as expenses are approved with their specific names.
    """
    client = get_client()

    # Get all categories from source budget
    categories = client.table("backlot_budget_categories").select(
        "name, category_type, sort_order"
    ).eq("budget_id", source_budget_id).order("sort_order").execute()

    if not categories.data:
        return

    # Copy each category to the target budget
    for cat in categories.data:
        new_category = {
            "budget_id": target_budget_id,
            "name": cat["name"],
            "category_type": cat.get("category_type", "production"),
            "sort_order": cat.get("sort_order", 0),
            "estimated_subtotal": 0,
            "actual_subtotal": 0,
        }
        client.table("backlot_budget_categories").insert(new_category).execute()

    logger.info(f"[BudgetActuals] Copied {len(categories.data)} categories from budget {source_budget_id} to {target_budget_id}")


def get_or_create_category(
    budget_id: str,
    category_name: str = "Miscellaneous Expenses",
    category_type: str = "production"
) -> Optional[Dict[str, Any]]:
    """Get existing category by name or create one."""
    client = get_client()

    # Try to find existing category (case insensitive)
    result = client.table("backlot_budget_categories").select("id, name").eq(
        "budget_id", budget_id
    ).ilike("name", category_name).limit(1).execute()

    if result.data:
        return result.data[0]

    # Get max sort order
    max_result = client.table("backlot_budget_categories").select("sort_order").eq(
        "budget_id", budget_id
    ).order("sort_order", desc=True).limit(1).execute()
    next_order = (max_result.data[0]["sort_order"] + 1) if max_result.data else 0

    new_category = {
        "budget_id": budget_id,
        "name": category_name,
        "category_type": category_type,
        "estimated_subtotal": 0,
        "actual_subtotal": 0,
        "sort_order": next_order,
    }
    cat_result = client.table("backlot_budget_categories").insert(new_category).execute()

    if cat_result.data:
        logger.info(f"[BudgetActuals] Auto-created category '{category_name}' for budget {budget_id}")
        return cat_result.data[0]
    return None


def get_or_create_line_item(
    budget_id: str,
    category_id: str,
    description: str = "Miscellaneous"
) -> Optional[Dict[str, Any]]:
    """Get existing line item by description or create one."""
    client = get_client()

    # Try to find existing line item (case insensitive)
    result = client.table("backlot_budget_line_items").select("id, description").eq(
        "category_id", category_id
    ).ilike("description", description).limit(1).execute()

    if result.data:
        return result.data[0]

    # Get max sort order
    max_result = client.table("backlot_budget_line_items").select("sort_order").eq(
        "category_id", category_id
    ).order("sort_order", desc=True).limit(1).execute()
    next_order = (max_result.data[0]["sort_order"] + 1) if max_result.data else 0

    # Note: estimated_total is a GENERATED column in backlot_budget_line_items
    new_line_item = {
        "budget_id": budget_id,
        "category_id": category_id,
        "description": description,
        "actual_total": 0,
        "sort_order": next_order,
    }
    li_result = client.table("backlot_budget_line_items").insert(new_line_item).execute()

    if li_result.data:
        logger.info(f"[BudgetActuals] Auto-created line item '{description}' for category {category_id}")
        return li_result.data[0]
    return None


def resolve_budget_location(
    project_id: str,
    budget_category_id: Optional[str] = None,
    budget_line_item_id: Optional[str] = None,
    fallback_category_name: str = "Miscellaneous Expenses",
    line_item_description: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Resolve the budget location for an expense.
    Returns (budget_id, category_id, line_item_id).
    Will auto-create structure if needed.

    Args:
        line_item_description: The specific name for this line item (e.g., "Red Komodo").
                               Each approved item gets its own dedicated line item.
    """
    client = get_client()

    # If line item provided, use it
    if budget_line_item_id:
        li_result = client.table("backlot_budget_line_items").select(
            "id, budget_id, category_id"
        ).eq("id", budget_line_item_id).execute()
        if li_result.data:
            li = li_result.data[0]
            return li["budget_id"], li["category_id"], li["id"]

    # Use the specific line item description, or fall back to a generic name
    item_name = line_item_description or "Expense"

    # If category provided, find or create line item with specific name
    if budget_category_id:
        cat_result = client.table("backlot_budget_categories").select(
            "id, budget_id, name"
        ).eq("id", budget_category_id).execute()
        if cat_result.data:
            cat = cat_result.data[0]
            line_item = get_or_create_line_item(
                cat["budget_id"],
                cat["id"],
                item_name
            )
            return cat["budget_id"], cat["id"], line_item["id"] if line_item else None

    # Auto-create budget structure with specific line item
    budget = get_or_create_budget_for_project(project_id)
    if not budget:
        logger.warning(f"[BudgetActuals] Could not get/create budget for project {project_id}")
        return None, None, None

    category = get_or_create_category(budget["id"], fallback_category_name)
    if not category:
        logger.warning(f"[BudgetActuals] Could not get/create category for budget {budget['id']}")
        return budget["id"], None, None

    line_item = get_or_create_line_item(budget["id"], category["id"], item_name)
    return budget["id"], category["id"], line_item["id"] if line_item else None


def update_line_item_actual(line_item_id: str, amount_to_add: float):
    """Update line item actual_total by adding amount."""
    client = get_client()
    li_result = client.table("backlot_budget_line_items").select("actual_total").eq(
        "id", line_item_id
    ).single().execute()
    if li_result.data:
        current = float(li_result.data.get("actual_total") or 0)
        client.table("backlot_budget_line_items").update({
            "actual_total": current + amount_to_add,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", line_item_id).execute()


def update_category_actual(category_id: str):
    """Recalculate category actual_subtotal from its line items."""
    client = get_client()
    result = execute_single(
        "SELECT COALESCE(SUM(actual_total), 0) as total FROM backlot_budget_line_items WHERE category_id = :cat_id",
        {"cat_id": category_id}
    )
    total = float(result["total"]) if result else 0
    client.table("backlot_budget_categories").update({
        "actual_subtotal": total,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", category_id).execute()


def update_budget_actual(budget_id: str):
    """Recalculate budget actual_total from its categories."""
    client = get_client()
    result = execute_single(
        "SELECT COALESCE(SUM(actual_subtotal), 0) as total FROM backlot_budget_categories WHERE budget_id = :budget_id",
        {"budget_id": budget_id}
    )
    total = float(result["total"]) if result else 0
    client.table("backlot_budgets").update({
        "actual_total": total,
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", budget_id).execute()


def record_budget_actual(
    project_id: str,
    source_type: str,
    source_id: str,
    amount: float,
    description: str,
    expense_date: Optional[str] = None,
    vendor_name: Optional[str] = None,
    expense_category: Optional[str] = None,
    budget_category_id: Optional[str] = None,
    budget_line_item_id: Optional[str] = None,
    created_by_user_id: Optional[str] = None,
    line_item_name: Optional[str] = None,
    submitter_user_id: Optional[str] = None,
    submitter_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Record a budget actual entry with source tracking.
    Will skip if source already recorded (prevents double-counting).
    Returns the created record or None if skipped/failed.

    NOTE: This does NOT create budget line items. Line items are for manual
    budget planning only. Actuals are tracked separately and displayed
    grouped by category/submitter in the Actual view.
    """
    # Check if already recorded
    if check_source_already_recorded(source_type, source_id):
        logger.info(f"[BudgetActuals] Source {source_type}:{source_id} already recorded, skipping")
        return None

    client = get_client()

    # Get or create budget for the project
    budget = get_or_create_budget_for_project(project_id)
    if not budget:
        logger.warning(f"[BudgetActuals] Could not get/create budget for project {project_id}")
        return None

    budget_id = budget["id"]

    # Get or create category for grouping (but NOT line items)
    category_name = expense_category or "Miscellaneous Expenses"
    category = get_or_create_category(budget_id, category_name)
    resolved_category_id = category["id"] if category else None

    # Create the actual entry - NO line item reference
    actual_data = {
        "project_id": project_id,
        "budget_id": budget_id,
        "budget_category_id": resolved_category_id,
        "budget_line_item_id": None,  # Don't link to line items
        "source_type": source_type,
        "source_id": source_id,
        "description": description,
        "amount": amount,
        "expense_date": expense_date,
        "vendor_name": vendor_name,
        "expense_category": expense_category,
        "created_by_user_id": created_by_user_id,
        "submitter_user_id": submitter_user_id,
        "submitter_name": submitter_name,
    }

    try:
        result = client.table("backlot_budget_actuals").insert(actual_data).execute()

        if result.data:
            logger.info(f"[BudgetActuals] Recorded {source_type}:{source_id} = ${amount:.2f} by {submitter_name or 'unknown'}")

            # Update category actual_subtotal
            if resolved_category_id:
                update_category_actual(resolved_category_id)

            # Update budget actual_total
            update_budget_actual(budget_id)

            return result.data[0]
    except Exception as e:
        # Unique constraint violation means already recorded
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            logger.info(f"[BudgetActuals] Source {source_type}:{source_id} already recorded (constraint), skipping")
            return None
        logger.error(f"[BudgetActuals] Error recording {source_type}:{source_id}: {e}")
        raise

    return None


# ============================================================================
# Expense-specific recording functions
# ============================================================================

def record_mileage_actual(mileage_entry: Dict[str, Any], approved_by: str) -> Optional[Dict[str, Any]]:
    """Record a budget actual for an approved mileage entry."""
    miles = float(mileage_entry.get("miles") or 0)
    rate = float(mileage_entry.get("rate_per_mile") or 0.67)
    is_round_trip = mileage_entry.get("is_round_trip", False)
    amount = miles * rate * (2 if is_round_trip else 1)

    description = mileage_entry.get("description") or mileage_entry.get("purpose") or "Mileage"
    date_str = mileage_entry.get("date")

    # Get submitter info
    submitter_user_id = mileage_entry.get("user_id")
    submitter_name = mileage_entry.get("user_name") or mileage_entry.get("user", {}).get("full_name")

    return record_budget_actual(
        project_id=mileage_entry["project_id"],
        source_type="mileage",
        source_id=mileage_entry["id"],
        amount=amount,
        description=f"Mileage - {description}",
        expense_date=date_str,
        expense_category="Travel & Mileage",
        budget_category_id=mileage_entry.get("budget_category_id"),
        budget_line_item_id=mileage_entry.get("budget_line_item_id"),
        created_by_user_id=approved_by,
        submitter_user_id=submitter_user_id,
        submitter_name=submitter_name,
    )


def record_kit_rental_actual(kit_rental: Dict[str, Any], approved_by: str) -> Optional[Dict[str, Any]]:
    """Record a budget actual for an approved kit rental."""
    amount = float(kit_rental.get("total_amount") or 0)
    kit_name = kit_rental.get("kit_name") or kit_rental.get("name") or "Equipment"

    # Get submitter info (owner of the kit rental)
    submitter_user_id = kit_rental.get("user_id")
    submitter_name = kit_rental.get("user_name") or kit_rental.get("user", {}).get("full_name")

    return record_budget_actual(
        project_id=kit_rental["project_id"],
        source_type="kit_rental",
        source_id=kit_rental["id"],
        amount=amount,
        description=f"Kit Rental - {kit_name}",
        expense_date=kit_rental.get("start_date"),
        vendor_name=kit_rental.get("owner_name"),
        expense_category="Equipment Rental",
        budget_category_id=kit_rental.get("budget_category_id"),
        budget_line_item_id=kit_rental.get("budget_line_item_id"),
        created_by_user_id=approved_by,
        submitter_user_id=submitter_user_id,
        submitter_name=submitter_name,
    )


def record_per_diem_actual(per_diem: Dict[str, Any], approved_by: str) -> Optional[Dict[str, Any]]:
    """Record a budget actual for an approved per diem entry."""
    amount = float(per_diem.get("amount") or 0)
    meal_type = per_diem.get("meal_type", "Meal")
    date_str = per_diem.get("date") or ""

    # Format meal type nicely
    meal_display = meal_type.replace("_", " ").title() if meal_type else "Meal"

    # Get submitter info
    submitter_user_id = per_diem.get("user_id")
    submitter_name = per_diem.get("user_name") or per_diem.get("user", {}).get("full_name")

    return record_budget_actual(
        project_id=per_diem["project_id"],
        source_type="per_diem",
        source_id=per_diem["id"],
        amount=amount,
        description=f"Per Diem - {meal_display} ({date_str})",
        expense_date=date_str,
        expense_category="Per Diem",
        budget_category_id=per_diem.get("budget_category_id"),
        budget_line_item_id=per_diem.get("budget_line_item_id"),
        created_by_user_id=approved_by,
        submitter_user_id=submitter_user_id,
        submitter_name=submitter_name,
    )


def record_receipt_actual(receipt: Dict[str, Any], approved_by: str) -> Optional[Dict[str, Any]]:
    """Record a budget actual for an approved receipt (reimbursement)."""
    amount = float(receipt.get("amount") or 0)
    vendor = receipt.get("vendor_name") or receipt.get("description") or "Expense"

    # Get submitter info
    submitter_user_id = receipt.get("user_id")
    submitter_name = receipt.get("user_name") or receipt.get("created_by", {}).get("full_name")

    return record_budget_actual(
        project_id=receipt["project_id"],
        source_type="receipt",
        source_id=receipt["id"],
        amount=amount,
        description=f"Receipt - {vendor}",
        expense_date=receipt.get("purchase_date"),
        vendor_name=receipt.get("vendor_name"),
        expense_category=receipt.get("expense_category", "Miscellaneous"),
        budget_category_id=receipt.get("budget_category_id"),
        budget_line_item_id=receipt.get("budget_line_item_id"),
        created_by_user_id=approved_by,
        submitter_user_id=submitter_user_id,
        submitter_name=submitter_name,
    )


def record_purchase_order_actual(po: Dict[str, Any], approved_by: str) -> Optional[Dict[str, Any]]:
    """Record a budget actual for an approved purchase order."""
    # Use actual_amount if available, otherwise estimated_amount
    amount = float(po.get("actual_amount") or po.get("estimated_amount") or 0)
    description = po.get("description") or po.get("vendor_name") or "Purchase Order"

    # Get date from created_at
    created_at = po.get("created_at") or ""
    expense_date = created_at[:10] if created_at else None

    # Get submitter info (requester)
    submitter_user_id = po.get("requester_id")
    submitter_name = po.get("requester_name") or po.get("requester", {}).get("full_name")

    return record_budget_actual(
        project_id=po["project_id"],
        source_type="purchase_order",
        source_id=po["id"],
        amount=amount,
        description=f"PO - {description}",
        expense_date=expense_date,
        vendor_name=po.get("vendor_name"),
        expense_category=po.get("department", "Purchases"),
        budget_category_id=po.get("budget_category_id"),
        budget_line_item_id=po.get("budget_line_item_id"),
        created_by_user_id=approved_by,
        submitter_user_id=submitter_user_id,
        submitter_name=submitter_name,
    )


def record_gear_rental_order_actual(
    rental_order: Dict[str, Any],
    approved_by: str
) -> Optional[Dict[str, Any]]:
    """
    Record budget actual for approved gear rental order (marketplace).
    Uses order-level pricing (includes all items, tax, fees).
    """
    # Use final_amount if reconciled, otherwise total_amount
    amount = float(
        rental_order.get("final_amount") or
        rental_order.get("total_amount") or
        0
    )

    if amount <= 0:
        logger.warning(f"Skipping rental order {rental_order['id']} - no amount")
        return None

    # Get rental house name from organization
    rental_house = rental_order.get("rental_house_name") or rental_order.get("rental_house", {}).get("name") or "Unknown Vendor"

    # Get project_id
    project_id = rental_order.get("backlot_project_id")
    if not project_id:
        logger.warning(f"Skipping rental order {rental_order['id']} - no backlot project")
        return None

    # Get submitter info (custodian)
    submitter_user_id = rental_order.get("custodian_user_id")
    submitter_name = rental_order.get("custodian_user_name") or rental_order.get("custodian", {}).get("full_name")

    return record_budget_actual(
        project_id=project_id,
        source_type="gear_rental_order",
        source_id=rental_order["id"],
        amount=amount,
        description=f"Gear Rental - Order #{rental_order.get('order_number', 'N/A')}",
        expense_date=rental_order.get("rental_start_date"),
        vendor_name=rental_house,
        expense_category="Equipment Rental",
        created_by_user_id=approved_by,
        submitter_user_id=submitter_user_id,
        submitter_name=submitter_name,
    )


def record_gear_item_actual(
    gear_item: Dict[str, Any],
    created_by: str
) -> Optional[Dict[str, Any]]:
    """
    Record budget actual for manually added rental gear.
    Calculates amount from daily rate × rental days.
    """
    # Only process rental items
    if gear_item.get("is_owned"):
        logger.info(f"Skipping owned gear item {gear_item['id']}")
        return None

    # Calculate rental days and total cost
    pickup_date = gear_item.get("pickup_date")
    return_date = gear_item.get("return_date")
    daily_rate = float(gear_item.get("rental_cost_per_day") or 0)

    if not pickup_date or not return_date or daily_rate <= 0:
        logger.warning(f"Skipping gear item {gear_item['id']} - missing dates or rate")
        return None

    # Calculate days
    from datetime import datetime as dt
    try:
        # Handle both ISO datetime strings and date-only strings
        if "T" in pickup_date:
            pickup = dt.fromisoformat(pickup_date.replace("Z", "+00:00")).date()
        else:
            pickup = dt.strptime(pickup_date, "%Y-%m-%d").date()

        if "T" in return_date:
            return_dt = dt.fromisoformat(return_date.replace("Z", "+00:00")).date()
        else:
            return_dt = dt.strptime(return_date, "%Y-%m-%d").date()

        rental_days = (return_dt - pickup).days + 1
        total_cost = daily_rate * rental_days
    except (ValueError, TypeError) as e:
        logger.error(f"Error parsing dates for gear item {gear_item['id']}: {e}")
        return None

    return record_budget_actual(
        project_id=gear_item["project_id"],
        source_type="gear_item",
        source_id=gear_item["id"],
        amount=total_cost,
        description=f"Gear Rental - {gear_item.get('name', 'Equipment')}",
        expense_date=pickup_date,
        vendor_name=gear_item.get("rental_house"),
        expense_category="Equipment Rental",
        budget_category_id=gear_item.get("budget_category_id"),
        budget_line_item_id=gear_item.get("budget_line_item_id"),
        created_by_user_id=created_by,
    )


def record_invoice_line_items(
    invoice: Dict[str, Any],
    line_items: List[Dict[str, Any]],
    approved_by: str
) -> List[Dict[str, Any]]:
    """
    Record budget actuals for invoice line items.
    Skips items that already have a recorded source (from expenses imported to invoice).
    Returns list of recorded entries.
    """
    recorded = []

    for item in line_items:
        # Check if this line item's original source was already recorded
        # Invoice line items may have been imported from timecards, expenses, etc.
        item_source_type = item.get("source_type")
        item_source_id = item.get("source_id")

        if item_source_type and item_source_id:
            # Check if the original expense was already recorded to budget
            if check_source_already_recorded(item_source_type, item_source_id):
                logger.info(f"[BudgetActuals] Invoice line item source {item_source_type}:{item_source_id} already recorded, skipping")
                continue

        # Get amount from line item
        amount = float(item.get("line_total") or item.get("amount") or 0)
        if amount <= 0:
            continue

        # Use item description as specific line item name
        item_description = item.get("description") or "Invoice Line Item"
        line_item_name = item_description

        # Record as invoice_line_item
        result = record_budget_actual(
            project_id=invoice["project_id"],
            source_type="invoice_line_item",
            source_id=item["id"],
            amount=amount,
            description=item_description,
            expense_date=item.get("service_date_start") or item.get("service_date"),
            vendor_name=invoice.get("user_name") or invoice.get("vendor_name"),
            expense_category=item.get("rate_type") or "Labor",
            budget_category_id=item.get("budget_category_id"),
            budget_line_item_id=item.get("budget_line_item_id"),
            created_by_user_id=approved_by,
            line_item_name=line_item_name,
        )

        if result:
            recorded.append(result)

    return recorded


# ============================================================================
# Hot Set Labor Cost Recording
# ============================================================================

def record_session_labor_to_budget(
    project_id: str,
    session_id: str,
    production_day_id: str,
    day_type: str,
    actual_call_time: str,
    actual_wrap_time: str,
    created_by_user_id: str
) -> Dict[str, Any]:
    """
    Record all crew labor costs from a Hot Set session to budget actuals.
    Includes base day rates AND OT premiums.

    Args:
        project_id: The project ID
        session_id: The Hot Set session ID
        production_day_id: The production day ID
        day_type: Day type for OT calculation (4hr, 8hr, 10hr, 12hr, 6th_day, 7th_day)
        actual_call_time: ISO datetime string of actual call time
        actual_wrap_time: ISO datetime string of actual wrap time
        created_by_user_id: User who is wrapping the session

    Returns:
        Dict with crew_recorded count and total costs
    """
    from datetime import datetime as dt

    client = get_client()

    # Parse times
    try:
        if "T" in actual_call_time:
            call_time = dt.fromisoformat(actual_call_time.replace("Z", "+00:00"))
        else:
            call_time = dt.strptime(actual_call_time, "%Y-%m-%d %H:%M:%S")

        if "T" in actual_wrap_time:
            wrap_time = dt.fromisoformat(actual_wrap_time.replace("Z", "+00:00"))
        else:
            wrap_time = dt.strptime(actual_wrap_time, "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError) as e:
        logger.error(f"[BudgetActuals] Error parsing times for session {session_id}: {e}")
        return {"error": str(e), "crew_recorded": 0}

    # Calculate total hours worked
    total_hours = (wrap_time - call_time).total_seconds() / 3600
    if total_hours <= 0:
        logger.warning(f"[BudgetActuals] Invalid hours ({total_hours}) for session {session_id}")
        return {"error": "Invalid work hours", "crew_recorded": 0}

    # Get all crew for this session
    crew_result = client.table("backlot_hot_set_crew").select(
        "id, user_id, display_name, rate_type, rate_amount, department"
    ).eq("session_id", session_id).execute()

    if not crew_result.data:
        logger.info(f"[BudgetActuals] No crew found for session {session_id}")
        return {"crew_recorded": 0, "total_cost": 0}

    # OT thresholds from hot_set.py
    OT_THRESHOLDS = {
        '4hr':     {'ot1_after': 4,  'ot2_after': 6},
        '8hr':     {'ot1_after': 8,  'ot2_after': 10},
        '10hr':    {'ot1_after': 10, 'ot2_after': 12},
        '12hr':    {'ot1_after': 12, 'ot2_after': 14},
        '6th_day': {'ot1_after': 8,  'ot2_after': 12},
        '7th_day': {'ot1_after': 0,  'ot2_after': 0},  # All DT
    }

    thresholds = OT_THRESHOLDS.get(day_type, OT_THRESHOLDS['10hr'])
    ot1_after = thresholds['ot1_after']
    ot2_after = thresholds['ot2_after']

    # Calculate hours breakdown
    if day_type == '7th_day':
        regular_hours = 0
        ot1_hours = 0
        ot2_hours = total_hours
    else:
        if total_hours <= ot1_after:
            regular_hours = total_hours
            ot1_hours = 0
            ot2_hours = 0
        elif total_hours <= ot2_after:
            regular_hours = ot1_after
            ot1_hours = total_hours - ot1_after
            ot2_hours = 0
        else:
            regular_hours = ot1_after
            ot1_hours = ot2_after - ot1_after
            ot2_hours = total_hours - ot2_after

    # Get production day info for expense date
    day_result = client.table("backlot_production_days").select("date, day_number").eq(
        "id", production_day_id
    ).execute()
    expense_date = day_result.data[0]["date"] if day_result.data else None
    day_number = day_result.data[0].get("day_number", "") if day_result.data else ""

    crew_recorded = 0
    total_cost = 0.0
    skipped_no_rate = 0

    for crew in crew_result.data:
        if not crew.get("rate_amount"):
            skipped_no_rate += 1
            continue

        rate_type = crew.get("rate_type", "hourly")
        rate_amount = float(crew.get("rate_amount", 0))

        # Calculate cost breakdown
        if rate_type == "hourly":
            regular_cost = regular_hours * rate_amount
            ot1_cost = ot1_hours * rate_amount * 1.5
            ot2_cost = ot2_hours * rate_amount * 2.0
        elif rate_type == "daily":
            # Daily rate covers regular hours, OT is extra
            effective_hourly = rate_amount / 10.0
            regular_cost = rate_amount
            ot1_cost = ot1_hours * effective_hourly * 1.5
            ot2_cost = ot2_hours * effective_hourly * 2.0
        elif rate_type == "weekly":
            daily_rate = rate_amount / 5.0
            effective_hourly = daily_rate / 10.0
            regular_cost = daily_rate
            ot1_cost = ot1_hours * effective_hourly * 1.5
            ot2_cost = ot2_hours * effective_hourly * 2.0
        else:
            # Flat rate - no OT
            regular_cost = rate_amount
            ot1_cost = 0
            ot2_cost = 0

        total_crew_cost = round(regular_cost + ot1_cost + ot2_cost, 2)
        total_cost += total_crew_cost

        # Record to budget actuals using composite key to prevent duplicates
        source_id = f"{session_id}:{crew['id']}"

        # Build description
        desc_parts = [crew.get('display_name', 'Crew')]
        if day_number:
            desc_parts.append(f"Day {day_number}")
        desc_parts.append(f"{day_type} ({total_hours:.1f} hrs)")

        result = record_budget_actual(
            project_id=project_id,
            source_type="hot_set_session",
            source_id=source_id,
            amount=total_crew_cost,
            description=" - ".join(desc_parts),
            expense_date=expense_date,
            expense_category="Labor",
            created_by_user_id=created_by_user_id,
            submitter_user_id=crew.get("user_id"),
            submitter_name=crew.get("display_name"),
        )

        if result:
            crew_recorded += 1
            logger.info(
                f"[BudgetActuals] Recorded labor for {crew.get('display_name')}: "
                f"${total_crew_cost:.2f} (reg: ${regular_cost:.2f}, OT1: ${ot1_cost:.2f}, OT2: ${ot2_cost:.2f})"
            )

    return {
        "crew_recorded": crew_recorded,
        "skipped_no_rate": skipped_no_rate,
        "total_cost": round(total_cost, 2),
        "total_hours": round(total_hours, 2),
        "hours_breakdown": {
            "regular": round(regular_hours, 2),
            "ot1": round(ot1_hours, 2),
            "ot2": round(ot2_hours, 2)
        }
    }
