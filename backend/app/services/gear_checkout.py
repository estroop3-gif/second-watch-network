"""
Gear Checkout Service for Kit Rental Integration

When a kit rental linked to Gear House assets is approved, this service
creates a checkout transaction to mark the assets as checked out.
"""

from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
import logging

from fastapi import HTTPException
from app.core.database import get_client, execute_query

logger = logging.getLogger(__name__)


def check_assets_available(asset_ids: List[str]) -> Tuple[bool, List[str]]:
    """
    Check if all assets are available for checkout.

    Returns:
        Tuple of (all_available, list_of_unavailable_asset_names)
    """
    if not asset_ids:
        return True, []

    client = get_client()
    unavailable = []

    for asset_id in asset_ids:
        result = client.table("gear_assets").select(
            "id, name, status"
        ).eq("id", asset_id).execute()

        if result.data:
            asset = result.data[0]
            # Asset is unavailable if it's checked out or otherwise not available
            if asset.get("status") not in ("available", "reserved"):
                unavailable.append(asset.get("name", asset_id))

    return len(unavailable) == 0, unavailable


def get_kit_asset_ids(kit_instance_id: str) -> List[str]:
    """Get all asset IDs belonging to a kit instance."""
    client = get_client()
    result = client.table("gear_kit_instance_items").select(
        "asset_id"
    ).eq("kit_instance_id", kit_instance_id).execute()

    return [item["asset_id"] for item in (result.data or []) if item.get("asset_id")]


def create_checkout_from_kit_rental(
    kit_rental: Dict[str, Any],
    approved_by: str
) -> Optional[Dict[str, Any]]:
    """
    Create a Gear House checkout transaction when a kit rental is approved.

    Args:
        kit_rental: The kit rental dict with gear_* fields populated
        approved_by: User ID of the person approving the kit rental

    Returns:
        The created transaction dict, or None if no gear link

    Raises:
        HTTPException(400) if assets are unavailable for checkout
    """
    # Skip if no gear link
    gear_asset_id = kit_rental.get("gear_asset_id")
    gear_kit_instance_id = kit_rental.get("gear_kit_instance_id")
    gear_org_id = kit_rental.get("gear_organization_id")

    if not gear_asset_id and not gear_kit_instance_id:
        logger.debug(f"Kit rental {kit_rental['id']} has no gear link, skipping checkout")
        return None

    if not gear_org_id:
        logger.warning(f"Kit rental {kit_rental['id']} has gear link but no organization ID")
        return None

    # Get asset IDs to checkout
    asset_ids = []
    if gear_asset_id:
        asset_ids = [gear_asset_id]
    elif gear_kit_instance_id:
        asset_ids = get_kit_asset_ids(gear_kit_instance_id)

    if not asset_ids:
        logger.warning(f"Kit rental {kit_rental['id']} - no assets found to checkout")
        return None

    # Check availability - FAIL if any asset is unavailable
    available, unavailable = check_assets_available(asset_ids)
    if not available:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve kit rental: The following gear is unavailable: {', '.join(unavailable)}"
        )

    client = get_client()

    # Create the transaction
    tx_data = {
        "organization_id": gear_org_id,
        "transaction_type": "internal_checkout",
        "status": "pending",
        "primary_custodian_user_id": kit_rental["user_id"],  # Crew member who requested
        "backlot_project_id": kit_rental["project_id"],
        "initiated_by_user_id": approved_by,
        "initiated_at": datetime.utcnow().isoformat(),
        "notes": f"Auto-checkout from Kit Rental: {kit_rental.get('kit_name', 'Unknown')}",
        "reference_number": f"KR-{kit_rental['id'][:8]}",
    }

    # Set dates from kit rental
    if kit_rental.get("start_date"):
        tx_data["scheduled_at"] = kit_rental["start_date"]
    if kit_rental.get("end_date"):
        tx_data["expected_return_at"] = kit_rental["end_date"]

    # Insert transaction
    tx_result = client.table("gear_transactions").insert(tx_data).execute()
    if not tx_result.data:
        raise HTTPException(status_code=500, detail="Failed to create checkout transaction")

    transaction = tx_result.data[0]
    transaction_id = transaction["id"]

    logger.info(f"Created gear transaction {transaction_id} for kit rental {kit_rental['id']}")

    # Add transaction items
    for asset_id in asset_ids:
        item_data = {
            "transaction_id": transaction_id,
            "asset_id": asset_id,
        }
        client.table("gear_transaction_items").insert(item_data).execute()

    # Complete the checkout - this updates asset statuses to 'checked_out'
    from app.services.gear_service import complete_checkout
    complete_checkout(transaction_id, approved_by)

    logger.info(f"Completed checkout for {len(asset_ids)} asset(s) via kit rental {kit_rental['id']}")

    # Return the updated transaction
    final_tx = client.table("gear_transactions").select("*").eq("id", transaction_id).execute()
    return final_tx.data[0] if final_tx.data else transaction
