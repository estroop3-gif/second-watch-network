"""
Invoice Auto-Sync Service
Handles automatic addition of approved items to draft invoices
"""
from typing import Optional, Dict, Any, Tuple, List
from datetime import datetime, date, timedelta
import logging

from app.core.database import get_client, execute_single

logger = logging.getLogger(__name__)


def parse_date(date_val: Any) -> Optional[date]:
    """Parse a date value to a date object."""
    if date_val is None:
        return None
    if isinstance(date_val, date):
        return date_val
    if isinstance(date_val, datetime):
        return date_val.date()
    if isinstance(date_val, str):
        try:
            return datetime.strptime(date_val[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None
    return None


def get_all_draft_invoices(project_id: str, user_id: str) -> List[Dict[str, Any]]:
    """
    Get ALL draft/changes_requested invoices for a user on a project.
    Used for date-aware splitting across multiple invoices.
    """
    client = get_client()
    result = client.table("backlot_invoices").select("*").eq(
        "project_id", project_id
    ).eq(
        "user_id", user_id
    ).in_(
        "status", ["draft", "changes_requested"]
    ).order(
        "date_range_start", desc=False
    ).execute()

    return result.data or []


def find_nearest_invoice(day: date, invoices: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find invoice with date range closest to the given day."""
    if not invoices:
        return None

    def distance(inv: Dict[str, Any]) -> float:
        inv_start = parse_date(inv.get("date_range_start"))
        inv_end = parse_date(inv.get("date_range_end"))
        if not inv_start or not inv_end:
            return float('inf')
        if day < inv_start:
            return (inv_start - day).days
        elif day > inv_end:
            return (day - inv_end).days
        return 0  # Day is within range

    # Filter out invoices without date ranges
    valid_invoices = [inv for inv in invoices if parse_date(inv.get("date_range_start")) and parse_date(inv.get("date_range_end"))]
    if not valid_invoices:
        # Fall back to most recent invoice if none have date ranges
        return invoices[-1] if invoices else None

    return min(valid_invoices, key=distance)


def calculate_date_splits(
    item_start: date,
    item_end: date,
    invoices: List[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate how many days of an item go to each invoice.

    Args:
        item_start: First day of kit rental/timecard
        item_end: Last day of kit rental/timecard
        invoices: List of draft invoices with date_range_start/end

    Returns:
        Dict mapping invoice_id -> {days: int, start_date: date, end_date: date}
    """
    splits: Dict[str, Dict[str, Any]] = {}
    unmatched_days: List[date] = []

    # Generate all days in item range
    current = item_start
    while current <= item_end:
        matched = False
        for inv in invoices:
            inv_start = parse_date(inv.get("date_range_start"))
            inv_end = parse_date(inv.get("date_range_end"))

            if inv_start and inv_end and inv_start <= current <= inv_end:
                inv_id = inv["id"]
                if inv_id not in splits:
                    splits[inv_id] = {"days": 0, "start_date": current, "end_date": current}
                splits[inv_id]["days"] += 1
                splits[inv_id]["end_date"] = current
                matched = True
                break

        if not matched:
            unmatched_days.append(current)

        current += timedelta(days=1)

    # Assign unmatched days to nearest invoice
    for day in unmatched_days:
        nearest_inv = find_nearest_invoice(day, invoices)
        if nearest_inv:
            inv_id = nearest_inv["id"]
            if inv_id not in splits:
                splits[inv_id] = {"days": 0, "start_date": day, "end_date": day}
            splits[inv_id]["days"] += 1
            # Update date range to include this day
            if day < splits[inv_id]["start_date"]:
                splits[inv_id]["start_date"] = day
            if day > splits[inv_id]["end_date"]:
                splits[inv_id]["end_date"] = day

    return splits


def get_imported_date_ranges(source_type: str, source_id: str) -> List[Tuple[date, date]]:
    """Get date ranges already imported for this source item."""
    result = execute_single(
        """SELECT service_date_start, service_date_end
        FROM backlot_invoice_line_items
        WHERE source_type = :source_type AND source_id = :source_id""",
        {"source_type": source_type, "source_id": source_id}
    )
    # This returns single row, but we want all
    client = get_client()
    result = client.table("backlot_invoice_line_items").select(
        "service_date_start, service_date_end"
    ).eq(
        "source_type", source_type
    ).eq(
        "source_id", source_id
    ).execute()

    ranges = []
    for r in result.data or []:
        start = parse_date(r.get("service_date_start"))
        end = parse_date(r.get("service_date_end"))
        if start and end:
            ranges.append((start, end))
    return ranges


def find_most_recent_draft_invoice(
    project_id: str,
    user_id: str
) -> Optional[Dict[str, Any]]:
    """
    Find the user's most recent draft invoice for this project.
    Returns the invoice dict or None if no draft exists.
    """
    client = get_client()
    result = client.table("backlot_invoices").select("*").eq(
        "project_id", project_id
    ).eq(
        "user_id", user_id
    ).eq(
        "status", "draft"
    ).order(
        "created_at", desc=True
    ).limit(1).execute()

    return result.data[0] if result.data else None


def get_next_sort_order(invoice_id: str) -> int:
    """Get the next sort order for line items on an invoice."""
    result = execute_single(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM backlot_invoice_line_items WHERE invoice_id = :invoice_id",
        {"invoice_id": invoice_id}
    )
    return result["next_order"] if result else 0


def check_already_imported(source_type: str, source_id: str) -> bool:
    """Check if an item has already been imported to any invoice."""
    result = execute_single(
        "SELECT 1 FROM backlot_invoice_line_items WHERE source_type = :source_type AND source_id = :source_id LIMIT 1",
        {"source_type": source_type, "source_id": source_id}
    )
    return result is not None


def add_line_item_to_invoice(
    invoice_id: str,
    description: str,
    rate_type: str,
    rate_amount: float,
    quantity: float,
    units: str,
    source_type: str,
    source_id: str,
    service_date_start: Optional[str] = None,
    service_date_end: Optional[str] = None,
    auto_added: bool = True
) -> Optional[Dict[str, Any]]:
    """Add a line item to an invoice."""
    client = get_client()

    line_total = round(rate_amount * quantity, 2)
    sort_order = get_next_sort_order(invoice_id)

    item_data = {
        "invoice_id": invoice_id,
        "description": description,
        "rate_type": rate_type,
        "rate_amount": rate_amount,
        "quantity": quantity,
        "units": units or None,
        "line_total": line_total,
        "source_type": source_type,
        "source_id": source_id,
        "service_date_start": service_date_start,
        "service_date_end": service_date_end,
        "sort_order": sort_order,
        "auto_added": auto_added,
    }

    result = client.table("backlot_invoice_line_items").insert(item_data).execute()

    if result.data:
        # Update invoice totals
        recalculate_invoice_totals(invoice_id)
        return result.data[0]
    return None


def recalculate_invoice_totals(invoice_id: str):
    """Recalculate and update invoice subtotal and total."""
    client = get_client()

    # Get sum of line items
    totals = execute_single(
        "SELECT COALESCE(SUM(line_total), 0) as subtotal FROM backlot_invoice_line_items WHERE invoice_id = :invoice_id",
        {"invoice_id": invoice_id}
    )

    subtotal = float(totals["subtotal"]) if totals else 0

    # Update invoice
    client.table("backlot_invoices").update({
        "subtotal": subtotal,
        "total_amount": subtotal,  # For now, no tax
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", invoice_id).execute()


def mark_pending_invoice_import(
    table_name: str,
    item_id: str,
    pending: bool = True
):
    """Mark an expense item as pending invoice import."""
    client = get_client()
    client.table(table_name).update({
        "pending_invoice_import": pending
    }).eq("id", item_id).execute()


def auto_add_mileage_to_invoice(
    project_id: str,
    user_id: str,
    mileage_entry: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Auto-add a mileage entry to the appropriate draft invoice based on date.
    Matches the mileage date to an invoice's date range, or falls back to nearest invoice.
    """
    logger.info(f"[AutoSync] Attempting to auto-add mileage {mileage_entry['id']} for user {user_id}")

    # Check if already imported
    if check_already_imported("mileage", mileage_entry["id"]):
        logger.info(f"[AutoSync] Mileage {mileage_entry['id']} already imported, skipping")
        return (False, None)

    # Get ALL draft invoices for date-aware matching
    invoices = get_all_draft_invoices(project_id, user_id)
    if not invoices:
        logger.info(f"[AutoSync] No draft invoices found for user {user_id}, marking as pending")
        mark_pending_invoice_import("backlot_mileage_entries", mileage_entry["id"], True)
        return (False, None)

    # Parse mileage date
    mileage_date = parse_date(mileage_entry.get("date"))

    # Find matching invoice by date
    matched_invoice = None
    if mileage_date:
        for inv in invoices:
            inv_start = parse_date(inv.get("date_range_start"))
            inv_end = parse_date(inv.get("date_range_end"))
            if inv_start and inv_end and inv_start <= mileage_date <= inv_end:
                matched_invoice = inv
                break

        # If no exact match, find nearest invoice
        if not matched_invoice:
            matched_invoice = find_nearest_invoice(mileage_date, invoices)

    # Fall back to most recent if no date or no match
    if not matched_invoice:
        matched_invoice = find_most_recent_draft_invoice(project_id, user_id)

    if not matched_invoice:
        mark_pending_invoice_import("backlot_mileage_entries", mileage_entry["id"], True)
        return (False, None)

    # Calculate amount
    miles = float(mileage_entry.get("miles") or 0)
    rate = float(mileage_entry.get("rate_per_mile") or 0.67)
    is_round_trip = mileage_entry.get("is_round_trip", False)
    amount = round(miles * rate * (2 if is_round_trip else 1), 2)

    description = mileage_entry.get("description") or mileage_entry.get("date", "Mileage")

    add_line_item_to_invoice(
        invoice_id=matched_invoice["id"],
        description=f"Mileage - {description}",
        rate_type="flat",
        rate_amount=amount,
        quantity=1,
        units="",
        source_type="mileage",
        source_id=mileage_entry["id"],
        service_date_start=mileage_entry.get("date"),
        auto_added=True
    )

    logger.info(f"[AutoSync] Auto-added mileage {mileage_entry['id']} to invoice {matched_invoice['id']}")
    return (True, matched_invoice["id"])


def auto_add_kit_rental_to_invoice(
    project_id: str,
    user_id: str,
    kit_rental: Dict[str, Any]
) -> List[Tuple[bool, Optional[str]]]:
    """
    Auto-add a kit rental to user's draft invoices with date-aware splitting.
    If the kit rental spans multiple invoice date ranges, it will be split accordingly.
    Returns list of (success, invoice_id) tuples for each split.
    """
    logger.info(f"[AutoSync] Attempting to auto-add kit rental {kit_rental['id']} for user {user_id}")

    # Check if already imported (any portion)
    if check_already_imported("kit_rental", kit_rental["id"]):
        logger.info(f"[AutoSync] Kit rental {kit_rental['id']} already imported, skipping")
        return [(False, None)]

    # Get ALL draft invoices for date-aware splitting
    invoices = get_all_draft_invoices(project_id, user_id)
    if not invoices:
        logger.info(f"[AutoSync] No draft invoices found for user {user_id}, marking as pending")
        mark_pending_invoice_import("backlot_kit_rentals", kit_rental["id"], True)
        return [(False, None)]

    # Parse kit rental dates
    start_date = parse_date(kit_rental.get("start_date"))
    end_date = parse_date(kit_rental.get("end_date"))

    if not start_date:
        logger.warning(f"[AutoSync] Kit rental {kit_rental['id']} has no start_date, skipping")
        return [(False, None)]

    # If no end date, treat as single day
    if not end_date:
        end_date = start_date

    daily_rate = float(kit_rental.get("daily_rate") or 0)
    kit_name = kit_rental.get("kit_name") or kit_rental.get("item_name") or "Equipment"

    # Calculate how days split across invoices
    splits = calculate_date_splits(start_date, end_date, invoices)

    if not splits:
        # No invoices with date ranges - fall back to most recent
        invoice = find_most_recent_draft_invoice(project_id, user_id)
        if invoice:
            total_days = (end_date - start_date).days + 1
            add_line_item_to_invoice(
                invoice_id=invoice["id"],
                description=f"Kit Rental - {kit_name}",
                rate_type="daily",
                rate_amount=daily_rate,
                quantity=total_days,
                units="days",
                source_type="kit_rental",
                source_id=kit_rental["id"],
                service_date_start=start_date.isoformat(),
                service_date_end=end_date.isoformat(),
                auto_added=True
            )
            logger.info(f"[AutoSync] Auto-added kit rental {kit_rental['id']} to invoice {invoice['id']} (fallback, {total_days} days)")
            return [(True, invoice["id"])]

        return [(False, None)]

    # Create line item for each split
    results = []
    for invoice_id, split_info in splits.items():
        days = split_info["days"]
        split_start = split_info["start_date"]
        split_end = split_info["end_date"]

        description = f"Kit Rental - {kit_name}"
        if len(splits) > 1:
            # Add date range to description when split across multiple invoices
            description += f" ({split_start.strftime('%m/%d')} - {split_end.strftime('%m/%d')})"

        add_line_item_to_invoice(
            invoice_id=invoice_id,
            description=description,
            rate_type="daily",
            rate_amount=daily_rate,
            quantity=days,
            units="days",
            source_type="kit_rental",
            source_id=kit_rental["id"],
            service_date_start=split_start.isoformat(),
            service_date_end=split_end.isoformat(),
            auto_added=True
        )

        logger.info(f"[AutoSync] Auto-added kit rental {kit_rental['id']} to invoice {invoice_id} ({days} days)")
        results.append((True, invoice_id))

    return results


def auto_add_per_diem_to_invoice(
    project_id: str,
    user_id: str,
    per_diem: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Auto-add a per diem entry to the appropriate draft invoice based on date.
    Matches the per diem date to an invoice's date range, or falls back to nearest invoice.
    """
    logger.info(f"[AutoSync] Attempting to auto-add per diem {per_diem['id']} for user {user_id}")

    if check_already_imported("per_diem", per_diem["id"]):
        logger.info(f"[AutoSync] Per diem {per_diem['id']} already imported, skipping")
        return (False, None)

    # Get ALL draft invoices for date-aware matching
    invoices = get_all_draft_invoices(project_id, user_id)
    if not invoices:
        logger.info(f"[AutoSync] No draft invoices found for user {user_id}, marking as pending")
        mark_pending_invoice_import("backlot_per_diem", per_diem["id"], True)
        return (False, None)

    # Parse per diem date
    per_diem_date = parse_date(per_diem.get("date"))

    # Find matching invoice by date
    matched_invoice = None
    if per_diem_date:
        for inv in invoices:
            inv_start = parse_date(inv.get("date_range_start"))
            inv_end = parse_date(inv.get("date_range_end"))
            if inv_start and inv_end and inv_start <= per_diem_date <= inv_end:
                matched_invoice = inv
                break

        # If no exact match, find nearest invoice
        if not matched_invoice:
            matched_invoice = find_nearest_invoice(per_diem_date, invoices)

    # Fall back to most recent if no date or no match
    if not matched_invoice:
        matched_invoice = find_most_recent_draft_invoice(project_id, user_id)

    if not matched_invoice:
        mark_pending_invoice_import("backlot_per_diem", per_diem["id"], True)
        return (False, None)

    amount = float(per_diem.get("amount") or 0)
    meal_type = per_diem.get("meal_type", "Meal")

    add_line_item_to_invoice(
        invoice_id=matched_invoice["id"],
        description=f"Per Diem - {meal_type.replace('_', ' ').title()} ({per_diem.get('date', '')})",
        rate_type="flat",
        rate_amount=amount,
        quantity=1,
        units="",
        source_type="per_diem",
        source_id=per_diem["id"],
        service_date_start=per_diem.get("date"),
        auto_added=True
    )

    logger.info(f"[AutoSync] Auto-added per diem {per_diem['id']} to invoice {matched_invoice['id']}")
    return (True, matched_invoice["id"])


def auto_add_receipt_to_invoice(
    project_id: str,
    user_id: str,
    receipt: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Auto-add a receipt to the appropriate draft invoice based on purchase date.
    Matches the receipt date to an invoice's date range, or falls back to nearest invoice.
    Skips company card receipts (they go to budget, not invoices).
    """
    logger.info(f"[AutoSync] Attempting to auto-add receipt {receipt['id']} for user {user_id}")

    # Skip company card receipts - they don't go to invoices
    if receipt.get("expense_type") == "company_card":
        logger.info(f"[AutoSync] Receipt {receipt['id']} is company card, skipping invoice sync")
        return (False, None)

    if check_already_imported("receipt", receipt["id"]):
        logger.info(f"[AutoSync] Receipt {receipt['id']} already imported, skipping")
        return (False, None)

    # Get ALL draft invoices for date-aware matching
    invoices = get_all_draft_invoices(project_id, user_id)
    if not invoices:
        logger.info(f"[AutoSync] No draft invoices found for user {user_id}, marking as pending")
        mark_pending_invoice_import("backlot_receipts", receipt["id"], True)
        return (False, None)

    # Parse receipt purchase date
    receipt_date = parse_date(receipt.get("purchase_date"))

    # Find matching invoice by date
    matched_invoice = None
    if receipt_date:
        for inv in invoices:
            inv_start = parse_date(inv.get("date_range_start"))
            inv_end = parse_date(inv.get("date_range_end"))
            if inv_start and inv_end and inv_start <= receipt_date <= inv_end:
                matched_invoice = inv
                break

        # If no exact match, find nearest invoice
        if not matched_invoice:
            matched_invoice = find_nearest_invoice(receipt_date, invoices)

    # Fall back to most recent if no date or no match
    if not matched_invoice:
        matched_invoice = find_most_recent_draft_invoice(project_id, user_id)

    if not matched_invoice:
        mark_pending_invoice_import("backlot_receipts", receipt["id"], True)
        return (False, None)

    amount = float(receipt.get("amount") or 0)

    add_line_item_to_invoice(
        invoice_id=matched_invoice["id"],
        description=f"Reimbursement - {receipt.get('description') or 'Receipt'}",
        rate_type="flat",
        rate_amount=amount,
        quantity=1,
        units="",
        source_type="receipt",
        source_id=receipt["id"],
        service_date_start=receipt.get("purchase_date"),
        auto_added=True
    )

    logger.info(f"[AutoSync] Auto-added receipt {receipt['id']} to invoice {matched_invoice['id']}")
    return (True, matched_invoice["id"])


def auto_add_timecard_to_invoice(
    project_id: str,
    user_id: str,
    timecard: Dict[str, Any]
) -> List[Tuple[bool, Optional[str]]]:
    """
    Auto-add a timecard to user's draft invoices with date-aware splitting.
    If the timecard entries span multiple invoice date ranges, hours will be split accordingly.
    Returns list of (success, invoice_id) tuples for each split.
    """
    logger.info(f"[AutoSync] Attempting to auto-add timecard {timecard['id']} for user {user_id}")

    if check_already_imported("timecard", timecard["id"]):
        logger.info(f"[AutoSync] Timecard {timecard['id']} already imported, skipping")
        return [(False, None)]

    # Get ALL draft invoices for date-aware splitting
    invoices = get_all_draft_invoices(project_id, user_id)
    if not invoices:
        logger.info(f"[AutoSync] No draft invoices found for user {user_id}, marking as pending")
        mark_pending_invoice_import("backlot_timecards", timecard["id"], True)
        return [(False, None)]

    # Get all timecard entries with their dates and hours
    client = get_client()
    entries_result = client.table("backlot_timecard_entries").select(
        "shoot_date, hours_worked, rate_amount, rate_type"
    ).eq("timecard_id", timecard["id"]).execute()

    entries = entries_result.data or []
    if not entries:
        logger.warning(f"[AutoSync] No timecard entries found for {timecard['id']}")
        return [(False, None)]

    # Group hours by invoice based on shoot_date
    invoice_hours: Dict[str, Dict[str, Any]] = {}

    for entry in entries:
        entry_date = parse_date(entry.get("shoot_date"))
        if not entry_date:
            continue

        hours = float(entry.get("hours_worked") or 0)
        rate = float(entry.get("rate_amount") or 0)
        rate_type = entry.get("rate_type", "hourly")

        # Find matching invoice for this date
        matched_invoice = None
        for inv in invoices:
            inv_start = parse_date(inv.get("date_range_start"))
            inv_end = parse_date(inv.get("date_range_end"))
            if inv_start and inv_end and inv_start <= entry_date <= inv_end:
                matched_invoice = inv
                break

        # If no match, find nearest invoice
        if not matched_invoice:
            matched_invoice = find_nearest_invoice(entry_date, invoices)

        if matched_invoice:
            inv_id = matched_invoice["id"]
            if inv_id not in invoice_hours:
                invoice_hours[inv_id] = {
                    "hours": 0,
                    "rate": rate,
                    "rate_type": rate_type,
                    "start_date": entry_date,
                    "end_date": entry_date
                }
            invoice_hours[inv_id]["hours"] += hours
            # Keep highest rate if multiple entries
            if rate > invoice_hours[inv_id]["rate"]:
                invoice_hours[inv_id]["rate"] = rate
            # Update date range
            if entry_date < invoice_hours[inv_id]["start_date"]:
                invoice_hours[inv_id]["start_date"] = entry_date
            if entry_date > invoice_hours[inv_id]["end_date"]:
                invoice_hours[inv_id]["end_date"] = entry_date

    if not invoice_hours:
        # Fallback to most recent invoice
        invoice = find_most_recent_draft_invoice(project_id, user_id)
        if not invoice:
            return [(False, None)]

        totals = execute_single(
            """SELECT
                COALESCE(SUM(hours_worked), 0) as total_hours,
                MAX(rate_amount) as rate_amount,
                MAX(rate_type) as rate_type,
                MIN(shoot_date) as start_date,
                MAX(shoot_date) as end_date
            FROM backlot_timecard_entries WHERE timecard_id = :id""",
            {"id": timecard["id"]}
        )

        if not totals or not totals["total_hours"]:
            return [(False, None)]

        add_line_item_to_invoice(
            invoice_id=invoice["id"],
            description=f"Labor - Week of {timecard.get('week_start_date', '')}",
            rate_type=totals["rate_type"] or "hourly",
            rate_amount=float(totals["rate_amount"]) if totals["rate_amount"] else 0,
            quantity=float(totals["total_hours"]),
            units="hours",
            source_type="timecard",
            source_id=timecard["id"],
            service_date_start=totals["start_date"],
            service_date_end=totals["end_date"],
            auto_added=True
        )

        logger.info(f"[AutoSync] Auto-added timecard {timecard['id']} to invoice {invoice['id']} (fallback)")
        return [(True, invoice["id"])]

    # Create line item for each invoice split
    results = []
    week_start = timecard.get('week_start_date', '')

    for invoice_id, split_info in invoice_hours.items():
        hours = split_info["hours"]
        rate = split_info["rate"]
        rate_type = split_info["rate_type"]
        split_start = split_info["start_date"]
        split_end = split_info["end_date"]

        description = f"Labor - Week of {week_start}"
        if len(invoice_hours) > 1:
            # Add date range to description when split across multiple invoices
            description += f" ({split_start.strftime('%m/%d')} - {split_end.strftime('%m/%d')})"

        add_line_item_to_invoice(
            invoice_id=invoice_id,
            description=description,
            rate_type=rate_type or "hourly",
            rate_amount=rate,
            quantity=hours,
            units="hours",
            source_type="timecard",
            source_id=timecard["id"],
            service_date_start=split_start.isoformat(),
            service_date_end=split_end.isoformat(),
            auto_added=True
        )

        logger.info(f"[AutoSync] Auto-added timecard {timecard['id']} to invoice {invoice_id} ({hours} hours)")
        results.append((True, invoice_id))

    return results


def get_pending_import_count(project_id: str, user_id: str) -> Dict[str, int]:
    """
    Get count of approved items pending invoice import for a user.
    Returns counts by type and total.
    """
    client = get_client()

    def count_not_imported(table: str, status_field: str, status_value: str, source_type: str, user_field: str = "user_id"):
        # Get all approved items for this user
        query = client.table(table).select("id").eq(
            "project_id", project_id
        ).eq(
            user_field, user_id
        ).eq(
            status_field, status_value
        )

        approved = query.execute()

        if not approved.data:
            return 0

        # Check which ones are already imported
        count = 0
        for item in approved.data:
            if not check_already_imported(source_type, item["id"]):
                count += 1

        return count

    mileage = count_not_imported("backlot_mileage_entries", "status", "approved", "mileage")
    # Kit rentals use "active" or "completed" status when approved (not "approved")
    kit_rentals_active = count_not_imported("backlot_kit_rentals", "status", "active", "kit_rental")
    kit_rentals_completed = count_not_imported("backlot_kit_rentals", "status", "completed", "kit_rental")
    kit_rentals = kit_rentals_active + kit_rentals_completed
    per_diem = count_not_imported("backlot_per_diem", "status", "approved", "per_diem")
    receipts = count_not_imported("backlot_receipts", "reimbursement_status", "approved", "receipt", "created_by_user_id")
    timecards = count_not_imported("backlot_timecards", "status", "approved", "timecard")

    total = mileage + kit_rentals + per_diem + receipts + timecards

    return {
        "mileage": mileage,
        "kit_rentals": kit_rentals,
        "per_diem": per_diem,
        "receipts": receipts,
        "timecards": timecards,
        "total": total
    }
