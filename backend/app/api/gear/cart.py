"""
Gear Cart API

Persistent shopping cart for gear rentals.
Items are stored per-user and can be tagged with a backlot project context.
"""
from typing import Optional, List, Dict, Any
from datetime import date
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

router = APIRouter(prefix="/cart", tags=["Gear Cart"])


# ============================================================================
# SCHEMAS
# ============================================================================

class CartItemAdd(BaseModel):
    listing_id: str
    backlot_project_id: Optional[str] = None
    quantity: int = 1


class CartItemUpdate(BaseModel):
    quantity: int


class CartSubmitRequest(BaseModel):
    """Single request within cart submission."""
    gear_house_org_id: str
    backlot_project_id: Optional[str] = None
    title: Optional[str] = None
    rental_start_date: date
    rental_end_date: date
    notes: Optional[str] = None
    item_ids: List[str]  # Cart item IDs to include


class CartSubmit(BaseModel):
    """Submit cart as work order requests."""
    requests: List[CartSubmitRequest]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def get_cart_item_or_404(item_id: str, profile_id: str) -> Dict[str, Any]:
    """Get cart item owned by user or raise 404."""
    result = execute_single(
        """
        SELECT * FROM gear_cart_items
        WHERE id = :id AND profile_id = :profile_id
        """,
        {"id": item_id, "profile_id": profile_id}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return result


# ============================================================================
# CART ENDPOINTS
# ============================================================================

@router.get("")
async def get_cart(
    user=Depends(get_current_user)
):
    """
    Get user's cart items grouped by gear house.

    Returns items with full listing and organization details,
    grouped by organization for easy display.
    """
    profile_id = get_profile_id(user)

    # Get all cart items with listing and organization details
    items = execute_query(
        """
        SELECT
            ci.id,
            ci.profile_id,
            ci.listing_id,
            ci.organization_id,
            ci.backlot_project_id,
            ci.quantity,
            ci.created_at,
            ci.updated_at,
            -- Listing details
            l.daily_rate,
            l.weekly_rate,
            l.listing_type,
            l.is_listed,
            -- Asset details
            a.id as asset_id,
            a.name as asset_name,
            a.make,
            a.model,
            a.current_condition,
            COALESCE(a.photos_current, a.photos_baseline, '[]'::jsonb) as asset_photos,
            -- Organization details
            o.id as org_id,
            o.name as org_name,
            o.name as marketplace_name,
            o.logo_url as marketplace_logo_url,
            COALESCE(o.status = 'verified' OR o.status = 'active', FALSE) as is_verified,
            NULL as marketplace_location,
            -- Project details (if tagged)
            bp.title as project_title
        FROM gear_cart_items ci
        JOIN gear_marketplace_listings l ON l.id = ci.listing_id
        LEFT JOIN gear_assets a ON a.id = l.asset_id
        JOIN organizations o ON o.id = ci.organization_id
        LEFT JOIN backlot_projects bp ON bp.id = ci.backlot_project_id
        WHERE ci.profile_id = :profile_id
        ORDER BY o.name, ci.created_at DESC
        """,
        {"profile_id": profile_id}
    )

    # Group by organization
    grouped = {}
    for item in items:
        org_id = item["org_id"]
        if org_id not in grouped:
            grouped[org_id] = {
                "organization": {
                    "id": item["org_id"],
                    "name": item["org_name"],
                    "marketplace_name": item["marketplace_name"],
                    "marketplace_logo_url": item["marketplace_logo_url"],
                    "is_verified": item["is_verified"],
                    "marketplace_location": item["marketplace_location"],
                },
                "items": [],
                "total_daily_rate": 0,
            }

        cart_item = {
            "id": item["id"],
            "profile_id": item["profile_id"],
            "listing_id": item["listing_id"],
            "organization_id": item["organization_id"],
            "backlot_project_id": item["backlot_project_id"],
            "project_title": item["project_title"],
            "quantity": item["quantity"],
            "created_at": str(item["created_at"]),
            "updated_at": str(item["updated_at"]),
            "listing": {
                "id": item["listing_id"],
                "daily_rate": float(item["daily_rate"]) if item["daily_rate"] else 0,
                "weekly_rate": float(item["weekly_rate"]) if item["weekly_rate"] else None,
                "listing_type": item["listing_type"],
                "is_listed": item["is_listed"],
                "asset": {
                    "id": item["asset_id"],
                    "name": item["asset_name"],
                    "manufacturer": item["make"],
                    "model": item["model"],
                    "condition": item["current_condition"],
                    "photos": item["asset_photos"] if item["asset_photos"] else [],
                }
            }
        }

        grouped[org_id]["items"].append(cart_item)
        daily_rate = float(item["daily_rate"]) if item["daily_rate"] else 0
        grouped[org_id]["total_daily_rate"] += daily_rate * item["quantity"]

    return {
        "groups": list(grouped.values()),
        "total_items": sum(len(g["items"]) for g in grouped.values()),
    }


@router.post("/items")
async def add_to_cart(
    data: CartItemAdd,
    user=Depends(get_current_user)
):
    """
    Add an item to the cart.

    If the listing is already in the cart, updates the quantity instead.
    """
    profile_id = get_profile_id(user)

    # Get listing details and verify it exists and is rentable
    listing = execute_single(
        """
        SELECT l.*, o.id as org_id
        FROM gear_marketplace_listings l
        JOIN organizations o ON o.id = l.organization_id
        WHERE l.id = :listing_id AND l.is_listed = TRUE
        """,
        {"listing_id": data.listing_id}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found or not available")

    # Check if listing type is rental (not sale-only)
    if listing.get("listing_type") == "sale":
        raise HTTPException(status_code=400, detail="Sale items cannot be added to cart. Use 'Contact Seller' instead.")

    # Check if item already in cart
    existing = execute_single(
        """
        SELECT id, quantity FROM gear_cart_items
        WHERE profile_id = :profile_id AND listing_id = :listing_id
        """,
        {"profile_id": profile_id, "listing_id": data.listing_id}
    )

    if existing:
        # Update quantity
        new_quantity = existing["quantity"] + data.quantity
        execute_update(
            """
            UPDATE gear_cart_items
            SET quantity = :quantity, updated_at = NOW()
            WHERE id = :id
            """,
            {"id": existing["id"], "quantity": new_quantity}
        )
        return {"message": "Cart updated", "item_id": existing["id"], "quantity": new_quantity}

    # Insert new cart item
    result = execute_insert(
        """
        INSERT INTO gear_cart_items (profile_id, listing_id, organization_id, backlot_project_id, quantity)
        VALUES (:profile_id, :listing_id, :org_id, :backlot_project_id, :quantity)
        RETURNING id
        """,
        {
            "profile_id": profile_id,
            "listing_id": data.listing_id,
            "org_id": listing["org_id"],
            "backlot_project_id": data.backlot_project_id,
            "quantity": data.quantity,
        }
    )

    return {"message": "Item added to cart", "item_id": result["id"], "quantity": data.quantity}


@router.patch("/items/{item_id}")
async def update_cart_item(
    item_id: str,
    data: CartItemUpdate,
    user=Depends(get_current_user)
):
    """Update quantity of a cart item."""
    profile_id = get_profile_id(user)

    # Verify ownership
    get_cart_item_or_404(item_id, profile_id)

    if data.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")

    execute_update(
        """
        UPDATE gear_cart_items
        SET quantity = :quantity, updated_at = NOW()
        WHERE id = :id AND profile_id = :profile_id
        """,
        {"id": item_id, "profile_id": profile_id, "quantity": data.quantity}
    )

    return {"message": "Cart item updated", "quantity": data.quantity}


@router.delete("/items/{item_id}")
async def remove_from_cart(
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from the cart."""
    profile_id = get_profile_id(user)

    # Verify ownership
    get_cart_item_or_404(item_id, profile_id)

    execute_query(
        """
        DELETE FROM gear_cart_items
        WHERE id = :id AND profile_id = :profile_id
        """,
        {"id": item_id, "profile_id": profile_id}
    )

    return {"message": "Item removed from cart"}


@router.delete("")
async def clear_cart(
    user=Depends(get_current_user)
):
    """Clear all items from the cart."""
    profile_id = get_profile_id(user)

    execute_query(
        """
        DELETE FROM gear_cart_items
        WHERE profile_id = :profile_id
        """,
        {"profile_id": profile_id}
    )

    return {"message": "Cart cleared"}


@router.post("/submit")
async def submit_cart(
    data: CartSubmit,
    user=Depends(get_current_user)
):
    """
    Submit cart items as work order requests.

    Creates separate requests for each gear house.
    Each request goes to the gear house's "Requests" tab for approval.
    On approval, a work order is created automatically.
    """
    profile_id = get_profile_id(user)

    if not data.requests:
        raise HTTPException(status_code=400, detail="No requests provided")

    # Get user's organization (if any) for the request
    user_org = execute_single(
        """
        SELECT organization_id FROM organization_members
        WHERE user_id = :profile_id AND role IN ('owner', 'admin', 'manager')
        ORDER BY CASE WHEN role = 'owner' THEN 0 WHEN role = 'admin' THEN 1 ELSE 2 END
        LIMIT 1
        """,
        {"profile_id": profile_id}
    )
    requesting_org_id = user_org["organization_id"] if user_org else None

    created_requests = []
    removed_item_ids = []

    for req in data.requests:
        # Validate cart items belong to user and are for the specified gear house
        cart_items = execute_query(
            """
            SELECT ci.*, l.daily_rate, l.asset_id
            FROM gear_cart_items ci
            JOIN gear_marketplace_listings l ON l.id = ci.listing_id
            WHERE ci.id = ANY(:item_ids::uuid[])
            AND ci.profile_id = :profile_id
            AND ci.organization_id = :org_id
            """,
            {
                "item_ids": req.item_ids,
                "profile_id": profile_id,
                "org_id": req.gear_house_org_id,
            }
        )

        if not cart_items:
            raise HTTPException(
                status_code=400,
                detail=f"No valid cart items found for gear house {req.gear_house_org_id}"
            )

        # Verify gear house exists
        gear_house = execute_single(
            """
            SELECT id, name FROM organizations WHERE id = :id
            """,
            {"id": req.gear_house_org_id}
        )
        if not gear_house:
            raise HTTPException(status_code=404, detail=f"Gear house not found: {req.gear_house_org_id}")

        # Create work order request
        title = req.title or f"Rental Request - {gear_house['name']}"

        request_result = execute_insert(
            """
            INSERT INTO gear_work_order_requests (
                requesting_profile_id,
                requesting_org_id,
                gear_house_org_id,
                backlot_project_id,
                title,
                notes,
                rental_start_date,
                rental_end_date,
                status
            )
            VALUES (
                :requesting_profile_id,
                :requesting_org_id,
                :gear_house_org_id,
                :backlot_project_id,
                :title,
                :notes,
                :rental_start_date,
                :rental_end_date,
                'pending'
            )
            RETURNING id, reference_number
            """,
            {
                "requesting_profile_id": profile_id,
                "requesting_org_id": requesting_org_id,
                "gear_house_org_id": req.gear_house_org_id,
                "backlot_project_id": req.backlot_project_id,
                "title": title,
                "notes": req.notes,
                "rental_start_date": req.rental_start_date,
                "rental_end_date": req.rental_end_date,
            }
        )

        # Create request items
        for cart_item in cart_items:
            execute_insert(
                """
                INSERT INTO gear_work_order_request_items (
                    request_id,
                    listing_id,
                    asset_id,
                    quantity,
                    daily_rate
                )
                VALUES (
                    :request_id,
                    :listing_id,
                    :asset_id,
                    :quantity,
                    :daily_rate
                )
                """,
                {
                    "request_id": request_result["id"],
                    "listing_id": cart_item["listing_id"],
                    "asset_id": cart_item["asset_id"],
                    "quantity": cart_item["quantity"],
                    "daily_rate": cart_item["daily_rate"],
                }
            )
            removed_item_ids.append(cart_item["id"])

        created_requests.append({
            "id": request_result["id"],
            "reference_number": request_result["reference_number"],
            "gear_house_name": gear_house["name"],
            "item_count": len(cart_items),
        })

    # Remove submitted items from cart
    if removed_item_ids:
        execute_query(
            """
            DELETE FROM gear_cart_items
            WHERE id = ANY(:item_ids::uuid[])
            """,
            {"item_ids": removed_item_ids}
        )

    return {
        "message": f"Created {len(created_requests)} work order request(s)",
        "requests": created_requests,
        "items_removed": len(removed_item_ids),
    }


@router.get("/check/{listing_id}")
async def check_in_cart(
    listing_id: str,
    user=Depends(get_current_user)
):
    """Check if a listing is already in the user's cart."""
    profile_id = get_profile_id(user)

    result = execute_single(
        """
        SELECT id, quantity FROM gear_cart_items
        WHERE profile_id = :profile_id AND listing_id = :listing_id
        """,
        {"profile_id": profile_id, "listing_id": listing_id}
    )

    return {
        "in_cart": result is not None,
        "cart_item_id": result["id"] if result else None,
        "quantity": result["quantity"] if result else 0,
    }
