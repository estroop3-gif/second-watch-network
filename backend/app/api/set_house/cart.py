"""
Set House Cart API

Endpoints for managing the shopping cart.
"""
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.services import set_house_service

router = APIRouter(prefix="/cart", tags=["Set House Cart"])


# ============================================================================
# SCHEMAS
# ============================================================================

class CartItemAdd(BaseModel):
    listing_id: str
    organization_id: str
    backlot_project_id: Optional[str] = None
    booking_start_date: Optional[date] = None
    booking_end_date: Optional[date] = None
    booking_start_time: Optional[str] = None
    booking_end_time: Optional[str] = None


class CartItemUpdate(BaseModel):
    booking_start_date: Optional[date] = None
    booking_end_date: Optional[date] = None
    booking_start_time: Optional[str] = None
    booking_end_time: Optional[str] = None
    backlot_project_id: Optional[str] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


# ============================================================================
# CART ENDPOINTS
# ============================================================================

@router.get("/")
async def get_cart(user=Depends(get_current_user)):
    """Get the current user's cart."""
    profile_id = get_profile_id(user)

    items = set_house_service.get_cart_items(profile_id)

    # Calculate totals
    total = 0
    for item in items:
        if item.get("daily_rate") and item.get("booking_start_date") and item.get("booking_end_date"):
            days = (item["booking_end_date"] - item["booking_start_date"]).days + 1
            total += float(item["daily_rate"]) * days

    return {
        "items": items,
        "item_count": len(items),
        "estimated_total": total
    }


@router.post("/")
async def add_to_cart(
    data: CartItemAdd,
    user=Depends(get_current_user)
):
    """Add an item to the cart."""
    profile_id = get_profile_id(user)

    cart_item = set_house_service.add_to_cart(
        profile_id,
        data.listing_id,
        data.organization_id,
        backlot_project_id=data.backlot_project_id,
        booking_start_date=data.booking_start_date,
        booking_end_date=data.booking_end_date,
        booking_start_time=data.booking_start_time,
        booking_end_time=data.booking_end_time
    )

    if not cart_item:
        raise HTTPException(status_code=500, detail="Failed to add item to cart")

    return {"cart_item": cart_item}


@router.put("/{item_id}")
async def update_cart_item(
    item_id: str,
    data: CartItemUpdate,
    user=Depends(get_current_user)
):
    """Update a cart item."""
    profile_id = get_profile_id(user)

    from app.core.database import execute_insert

    updates = data.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = [f"{k} = :{k}" for k in updates.keys()]
    params = {**updates, "item_id": item_id, "profile_id": profile_id}

    cart_item = execute_insert(
        f"""
        UPDATE set_house_cart_items
        SET {', '.join(set_parts)}, updated_at = NOW()
        WHERE id = :item_id AND profile_id = :profile_id
        RETURNING *
        """,
        params
    )

    if not cart_item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    return {"cart_item": cart_item}


@router.delete("/{item_id}")
async def remove_from_cart(
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from the cart."""
    profile_id = get_profile_id(user)

    success = set_house_service.remove_from_cart(profile_id, item_id)

    return {"success": success}


@router.delete("/")
async def clear_cart(user=Depends(get_current_user)):
    """Clear all items from the cart."""
    profile_id = get_profile_id(user)

    success = set_house_service.clear_cart(profile_id)

    return {"success": success}


@router.post("/checkout")
async def checkout_cart(
    user=Depends(get_current_user)
):
    """Checkout the cart - create work order requests for each organization."""
    profile_id = get_profile_id(user)

    from app.core.database import execute_query, execute_insert

    items = set_house_service.get_cart_items(profile_id)

    if not items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Group items by organization
    org_items = {}
    for item in items:
        org_id = item["organization_id"]
        if org_id not in org_items:
            org_items[org_id] = []
        org_items[org_id].append(item)

    # Create work order request for each organization
    requests = []
    for org_id, org_items_list in org_items.items():
        # Find min/max dates
        start_dates = [i["booking_start_date"] for i in org_items_list if i.get("booking_start_date")]
        end_dates = [i["booking_end_date"] for i in org_items_list if i.get("booking_end_date")]

        booking_start_date = min(start_dates) if start_dates else None
        booking_end_date = max(end_dates) if end_dates else None

        # Create request
        request = execute_insert(
            """
            INSERT INTO set_house_work_order_requests (
                requesting_profile_id, set_house_org_id, backlot_project_id,
                booking_start_date, booking_end_date,
                title, status
            ) VALUES (
                :profile_id, :org_id, :backlot_project_id,
                :booking_start_date, :booking_end_date,
                :title, 'pending'
            )
            RETURNING *
            """,
            {
                "profile_id": profile_id,
                "org_id": org_id,
                "backlot_project_id": org_items_list[0].get("backlot_project_id"),
                "booking_start_date": booking_start_date,
                "booking_end_date": booking_end_date,
                "title": f"Space Booking Request - {len(org_items_list)} space(s)"
            }
        )

        if request:
            # Add items to request
            for item in org_items_list:
                execute_insert(
                    """
                    INSERT INTO set_house_work_order_request_items (
                        request_id, listing_id, space_id, daily_rate
                    ) VALUES (
                        :request_id, :listing_id, :space_id, :daily_rate
                    )
                    """,
                    {
                        "request_id": request["id"],
                        "listing_id": item["listing_id"],
                        "space_id": item.get("space_id"),
                        "daily_rate": item.get("daily_rate")
                    }
                )

            requests.append(request)

    # Clear the cart
    set_house_service.clear_cart(profile_id)

    return {
        "success": True,
        "requests_created": len(requests),
        "requests": requests
    }
