"""
Gear House Sales API

Handles gear purchase transactions (buy/sell flow).

Sale Flow:
1. Buyer makes an offer on a sale listing
2. Seller accepts, counters, or rejects
3. If countered, buyer can accept counter, counter back, or cancel
4. Once accepted, buyer pays
5. Seller ships item
6. Buyer confirms delivery
7. Sale completes, asset ownership transfers
"""
from typing import Optional, List
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

router = APIRouter(prefix="/sales", tags=["Gear Sales"])


# ============================================================================
# SCHEMAS
# ============================================================================

class NegotiationEntry(BaseModel):
    """Entry in negotiation history."""
    from_user_id: str
    to_user_id: str
    price: float
    message: Optional[str] = None
    timestamp: str


class MakeOfferInput(BaseModel):
    """Input for making an offer on a sale listing."""
    listing_id: str
    offer_price: float
    message: Optional[str] = None
    delivery_method: str = "pickup"  # pickup, shipping
    shipping_address: Optional[dict] = None
    offer_expires_in_days: Optional[int] = 7


class CounterOfferInput(BaseModel):
    """Input for counter offer."""
    counter_price: float
    message: Optional[str] = None


class AcceptOfferInput(BaseModel):
    """Input for accepting an offer."""
    payment_method: Optional[str] = None  # stripe, invoice, cash, external
    message: Optional[str] = None


class ShipmentInput(BaseModel):
    """Input for marking sale as shipped."""
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None


class CancelInput(BaseModel):
    """Input for cancelling an offer."""
    reason: Optional[str] = None


class RejectInput(BaseModel):
    """Input for rejecting an offer."""
    reason: Optional[str] = None


# ============================================================================
# HELPERS
# ============================================================================

def get_profile_id(user) -> str:
    """Get profile ID from user dict."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_user_id = :sub",
        {"sub": user.get("sub")}
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return str(profile["id"])


def check_org_member(user_id: str, org_id: str, require_admin: bool = False) -> bool:
    """Check if user is a member of the organization."""
    role_check = "AND role IN ('owner', 'admin')" if require_admin else ""
    member = execute_single(
        f"""
        SELECT id FROM organization_members
        WHERE user_id = :user_id AND organization_id = :org_id AND is_active = TRUE
        {role_check}
        """,
        {"user_id": user_id, "org_id": org_id}
    )
    return member is not None


def get_sale_with_details(sale_id: str) -> Optional[dict]:
    """Get sale with all joined details."""
    return execute_single(
        """
        SELECT
            gs.*,
            gml.asset_id,
            gml.sale_price as listing_sale_price,
            gml.sale_condition,
            gml.sale_includes,
            ga.name as asset_name,
            seller_org.name as seller_org_name,
            seller_profile.display_name as seller_user_name,
            buyer_org.name as buyer_org_name,
            buyer_profile.display_name as buyer_user_name
        FROM gear_sales gs
        JOIN gear_marketplace_listings gml ON gs.listing_id = gml.id
        JOIN gear_assets ga ON gml.asset_id = ga.id
        JOIN organizations seller_org ON gs.seller_org_id = seller_org.id
        JOIN profiles seller_profile ON gs.seller_user_id = seller_profile.id
        LEFT JOIN organizations buyer_org ON gs.buyer_org_id = buyer_org.id
        JOIN profiles buyer_profile ON gs.buyer_user_id = buyer_profile.id
        WHERE gs.id = :sale_id
        """,
        {"sale_id": sale_id}
    )


# ============================================================================
# BUYER ENDPOINTS
# ============================================================================

@router.post("/offer")
async def make_offer(
    input: MakeOfferInput,
    current_user: dict = Depends(get_current_user)
):
    """
    Make an offer on a sale listing.

    Buyer initiates purchase by offering a price.
    """
    profile_id = get_profile_id(current_user)

    # Get the listing
    listing = execute_single(
        """
        SELECT gml.*, ga.organization_id, ga.name as asset_name
        FROM gear_marketplace_listings gml
        JOIN gear_assets ga ON gml.asset_id = ga.id
        WHERE gml.id = :listing_id AND gml.is_listed = TRUE
        AND (gml.listing_type = 'sale' OR gml.listing_type = 'both')
        """,
        {"listing_id": input.listing_id}
    )

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found or not available for sale")

    # Can't buy from own organization
    buyer_org = execute_single(
        """
        SELECT organization_id FROM organization_members
        WHERE user_id = :user_id AND is_active = TRUE
        LIMIT 1
        """,
        {"user_id": profile_id}
    )

    if buyer_org and str(buyer_org["organization_id"]) == str(listing["organization_id"]):
        raise HTTPException(status_code=400, detail="Cannot purchase from your own organization")

    # Check for existing pending offer on this listing
    existing = execute_single(
        """
        SELECT id FROM gear_sales
        WHERE listing_id = :listing_id AND buyer_user_id = :buyer_id
        AND status IN ('offered', 'countered')
        """,
        {"listing_id": input.listing_id, "buyer_id": profile_id}
    )

    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending offer on this listing")

    # Get seller info for negotiation history
    seller_member = execute_single(
        """
        SELECT user_id FROM organization_members
        WHERE organization_id = :org_id AND role IN ('owner', 'admin') AND is_active = TRUE
        LIMIT 1
        """,
        {"org_id": str(listing["organization_id"])}
    )
    seller_user_id = str(seller_member["user_id"]) if seller_member else None

    # Calculate offer expiration
    expires_at = None
    if input.offer_expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=input.offer_expires_in_days)

    # Create the sale offer
    negotiation_entry = {
        "from_user_id": profile_id,
        "to_user_id": seller_user_id,
        "price": input.offer_price,
        "message": input.message,
        "timestamp": datetime.utcnow().isoformat()
    }

    sale = execute_insert(
        """
        INSERT INTO gear_sales (
            listing_id, asset_id,
            seller_org_id, seller_user_id,
            buyer_org_id, buyer_user_id,
            asking_price, offer_price,
            status, negotiation_history,
            delivery_method, shipping_address,
            buyer_message, offer_expires_at,
            offered_at
        ) VALUES (
            :listing_id, :asset_id,
            :seller_org_id, :seller_user_id,
            :buyer_org_id, :buyer_user_id,
            :asking_price, :offer_price,
            'offered', :negotiation_history,
            :delivery_method, :shipping_address,
            :buyer_message, :offer_expires_at,
            NOW()
        )
        RETURNING *
        """,
        {
            "listing_id": input.listing_id,
            "asset_id": str(listing["asset_id"]),
            "seller_org_id": str(listing["organization_id"]),
            "seller_user_id": seller_user_id,
            "buyer_org_id": str(buyer_org["organization_id"]) if buyer_org else None,
            "buyer_user_id": profile_id,
            "asking_price": float(listing["sale_price"]),
            "offer_price": input.offer_price,
            "negotiation_history": [negotiation_entry],
            "delivery_method": input.delivery_method,
            "shipping_address": input.shipping_address,
            "buyer_message": input.message,
            "offer_expires_at": expires_at.isoformat() if expires_at else None,
        }
    )

    return {
        "success": True,
        "sale": sale,
        "message": f"Offer submitted for ${input.offer_price}"
    }


@router.get("/my-offers")
async def get_my_offers(
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: dict = Depends(get_current_user)
):
    """Get all offers I've made as a buyer."""
    profile_id = get_profile_id(current_user)

    status_filter = ""
    params = {"buyer_id": profile_id}

    if status:
        status_filter = "AND gs.status = :status"
        params["status"] = status

    sales = execute_query(
        f"""
        SELECT
            gs.*,
            ga.name as asset_name,
            seller_org.name as seller_org_name,
            seller_profile.display_name as seller_user_name
        FROM gear_sales gs
        JOIN gear_marketplace_listings gml ON gs.listing_id = gml.id
        JOIN gear_assets ga ON gml.asset_id = ga.id
        JOIN organizations seller_org ON gs.seller_org_id = seller_org.id
        JOIN profiles seller_profile ON gs.seller_user_id = seller_profile.id
        WHERE gs.buyer_user_id = :buyer_id
        {status_filter}
        ORDER BY gs.created_at DESC
        """,
        params
    )

    return {
        "sales": sales,
        "total": len(sales)
    }


@router.get("/{sale_id}")
async def get_sale(
    sale_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get sale details."""
    profile_id = get_profile_id(current_user)

    sale = get_sale_with_details(sale_id)

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    # Check access - must be buyer or seller
    is_buyer = str(sale["buyer_user_id"]) == profile_id
    is_seller = check_org_member(profile_id, str(sale["seller_org_id"]))

    if not is_buyer and not is_seller:
        raise HTTPException(status_code=403, detail="Access denied")

    return {"sale": sale}


@router.post("/{sale_id}/accept-counter")
async def accept_counter_offer(
    sale_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept a counter offer as the buyer."""
    profile_id = get_profile_id(current_user)

    sale = execute_single(
        "SELECT * FROM gear_sales WHERE id = :sale_id",
        {"sale_id": sale_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if str(sale["buyer_user_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Only the buyer can accept counter offers")

    if sale["status"] != "countered":
        raise HTTPException(status_code=400, detail="No counter offer to accept")

    # Get the latest counter price from negotiation history
    history = sale.get("negotiation_history") or []
    final_price = history[-1]["price"] if history else sale["offer_price"]

    execute_update(
        """
        UPDATE gear_sales
        SET status = 'accepted',
            final_price = :final_price,
            accepted_at = NOW(),
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {"sale_id": sale_id, "final_price": final_price}
    )

    return {"success": True, "message": "Counter offer accepted", "final_price": final_price}


@router.post("/{sale_id}/cancel")
async def cancel_offer(
    sale_id: str,
    input: CancelInput,
    current_user: dict = Depends(get_current_user)
):
    """Cancel an offer as the buyer."""
    profile_id = get_profile_id(current_user)

    sale = execute_single(
        "SELECT * FROM gear_sales WHERE id = :sale_id",
        {"sale_id": sale_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if str(sale["buyer_user_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Only the buyer can cancel their offer")

    if sale["status"] not in ["offered", "countered"]:
        raise HTTPException(status_code=400, detail="Cannot cancel offer in current status")

    execute_update(
        """
        UPDATE gear_sales
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancelled_by = :user_id,
            cancellation_reason = :reason,
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {"sale_id": sale_id, "user_id": profile_id, "reason": input.reason}
    )

    return {"success": True, "message": "Offer cancelled"}


@router.post("/{sale_id}/delivered")
async def mark_delivered(
    sale_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Buyer confirms delivery of item."""
    profile_id = get_profile_id(current_user)

    sale = execute_single(
        "SELECT * FROM gear_sales WHERE id = :sale_id",
        {"sale_id": sale_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if str(sale["buyer_user_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Only the buyer can confirm delivery")

    if sale["status"] != "shipped":
        raise HTTPException(status_code=400, detail="Item must be shipped before confirming delivery")

    execute_update(
        """
        UPDATE gear_sales
        SET status = 'delivered',
            delivered_at = NOW(),
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {"sale_id": sale_id}
    )

    return {"success": True, "message": "Delivery confirmed"}


# ============================================================================
# SELLER ENDPOINTS (Organization scoped)
# ============================================================================

@router.get("/{org_id}/sales/incoming", tags=["Gear Sales Seller"])
async def get_incoming_offers(
    org_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: dict = Depends(get_current_user)
):
    """Get incoming sale offers for an organization."""
    profile_id = get_profile_id(current_user)

    if not check_org_member(profile_id, org_id):
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    status_filter = ""
    params = {"org_id": org_id}

    if status:
        status_filter = "AND gs.status = :status"
        params["status"] = status

    sales = execute_query(
        f"""
        SELECT
            gs.*,
            ga.name as asset_name,
            buyer_org.name as buyer_org_name,
            buyer_profile.display_name as buyer_user_name
        FROM gear_sales gs
        JOIN gear_marketplace_listings gml ON gs.listing_id = gml.id
        JOIN gear_assets ga ON gml.asset_id = ga.id
        LEFT JOIN organizations buyer_org ON gs.buyer_org_id = buyer_org.id
        JOIN profiles buyer_profile ON gs.buyer_user_id = buyer_profile.id
        WHERE gs.seller_org_id = :org_id
        {status_filter}
        ORDER BY gs.created_at DESC
        """,
        params
    )

    return {
        "sales": sales,
        "total": len(sales)
    }


@router.post("/{org_id}/sales/{sale_id}/accept", tags=["Gear Sales Seller"])
async def accept_offer(
    org_id: str,
    sale_id: str,
    input: AcceptOfferInput = AcceptOfferInput(),
    current_user: dict = Depends(get_current_user)
):
    """Accept an offer as the seller."""
    profile_id = get_profile_id(current_user)

    if not check_org_member(profile_id, org_id, require_admin=True):
        raise HTTPException(status_code=403, detail="Admin access required")

    sale = execute_single(
        "SELECT * FROM gear_sales WHERE id = :sale_id AND seller_org_id = :org_id",
        {"sale_id": sale_id, "org_id": org_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale["status"] not in ["offered", "countered"]:
        raise HTTPException(status_code=400, detail="Cannot accept offer in current status")

    # Determine final price
    history = sale.get("negotiation_history") or []
    final_price = history[-1]["price"] if history else sale["offer_price"]

    execute_update(
        """
        UPDATE gear_sales
        SET status = 'accepted',
            final_price = :final_price,
            payment_method = :payment_method,
            accepted_at = NOW(),
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {
            "sale_id": sale_id,
            "final_price": final_price,
            "payment_method": input.payment_method
        }
    )

    return {"success": True, "message": "Offer accepted", "final_price": final_price}


@router.post("/{org_id}/sales/{sale_id}/counter", tags=["Gear Sales Seller"])
async def counter_offer(
    org_id: str,
    sale_id: str,
    input: CounterOfferInput,
    current_user: dict = Depends(get_current_user)
):
    """Counter an offer with a new price."""
    profile_id = get_profile_id(current_user)

    if not check_org_member(profile_id, org_id, require_admin=True):
        raise HTTPException(status_code=403, detail="Admin access required")

    sale = execute_single(
        "SELECT * FROM gear_sales WHERE id = :sale_id AND seller_org_id = :org_id",
        {"sale_id": sale_id, "org_id": org_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale["status"] not in ["offered", "countered"]:
        raise HTTPException(status_code=400, detail="Cannot counter offer in current status")

    # Add to negotiation history
    history = sale.get("negotiation_history") or []
    history.append({
        "from_user_id": profile_id,
        "to_user_id": str(sale["buyer_user_id"]),
        "price": input.counter_price,
        "message": input.message,
        "timestamp": datetime.utcnow().isoformat()
    })

    execute_update(
        """
        UPDATE gear_sales
        SET status = 'countered',
            negotiation_history = :history,
            countered_at = NOW(),
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {"sale_id": sale_id, "history": history}
    )

    return {"success": True, "message": f"Counter offer sent for ${input.counter_price}"}


@router.post("/{org_id}/sales/{sale_id}/reject", tags=["Gear Sales Seller"])
async def reject_offer(
    org_id: str,
    sale_id: str,
    input: RejectInput = RejectInput(),
    current_user: dict = Depends(get_current_user)
):
    """Reject an offer."""
    profile_id = get_profile_id(current_user)

    if not check_org_member(profile_id, org_id, require_admin=True):
        raise HTTPException(status_code=403, detail="Admin access required")

    sale = execute_single(
        "SELECT * FROM gear_sales WHERE id = :sale_id AND seller_org_id = :org_id",
        {"sale_id": sale_id, "org_id": org_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale["status"] not in ["offered", "countered"]:
        raise HTTPException(status_code=400, detail="Cannot reject offer in current status")

    execute_update(
        """
        UPDATE gear_sales
        SET status = 'rejected',
            cancellation_reason = :reason,
            cancelled_at = NOW(),
            cancelled_by = :user_id,
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {"sale_id": sale_id, "reason": input.reason, "user_id": profile_id}
    )

    return {"success": True, "message": "Offer rejected"}


@router.post("/{org_id}/sales/{sale_id}/shipped", tags=["Gear Sales Seller"])
async def mark_shipped(
    org_id: str,
    sale_id: str,
    input: ShipmentInput = ShipmentInput(),
    current_user: dict = Depends(get_current_user)
):
    """Mark item as shipped."""
    profile_id = get_profile_id(current_user)

    if not check_org_member(profile_id, org_id):
        raise HTTPException(status_code=403, detail="Not a member of this organization")

    sale = execute_single(
        "SELECT * FROM gear_sales WHERE id = :sale_id AND seller_org_id = :org_id",
        {"sale_id": sale_id, "org_id": org_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale["status"] != "paid":
        raise HTTPException(status_code=400, detail="Payment must be completed before shipping")

    # TODO: Create shipment record if tracking provided

    execute_update(
        """
        UPDATE gear_sales
        SET status = 'shipped',
            shipped_at = NOW(),
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {"sale_id": sale_id}
    )

    return {"success": True, "message": "Marked as shipped"}


@router.post("/{org_id}/sales/{sale_id}/complete", tags=["Gear Sales Seller"])
async def complete_sale(
    org_id: str,
    sale_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Complete the sale and transfer asset ownership.

    This is the final step that:
    1. Marks the sale as completed
    2. Transfers the asset to the buyer's organization
    3. Delists the item from marketplace
    """
    profile_id = get_profile_id(current_user)

    if not check_org_member(profile_id, org_id, require_admin=True):
        raise HTTPException(status_code=403, detail="Admin access required")

    sale = execute_single(
        """
        SELECT gs.*, gml.asset_id
        FROM gear_sales gs
        JOIN gear_marketplace_listings gml ON gs.listing_id = gml.id
        WHERE gs.id = :sale_id AND gs.seller_org_id = :org_id
        """,
        {"sale_id": sale_id, "org_id": org_id}
    )

    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")

    if sale["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Delivery must be confirmed before completing sale")

    # Mark sale as completed
    execute_update(
        """
        UPDATE gear_sales
        SET status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = :sale_id
        """,
        {"sale_id": sale_id}
    )

    # Transfer asset ownership to buyer
    if sale.get("buyer_org_id"):
        # Transfer to buyer organization
        execute_update(
            """
            UPDATE gear_assets
            SET organization_id = :buyer_org_id,
                previous_organization_id = :seller_org_id,
                sold_via_sale_id = :sale_id,
                sold_at = NOW(),
                status = 'available',
                updated_at = NOW()
            WHERE id = :asset_id
            """,
            {
                "asset_id": str(sale["asset_id"]),
                "buyer_org_id": str(sale["buyer_org_id"]),
                "seller_org_id": org_id,
                "sale_id": sale_id
            }
        )

    # Delist the item from marketplace
    execute_update(
        """
        UPDATE gear_marketplace_listings
        SET is_listed = FALSE,
            delisted_at = NOW(),
            updated_at = NOW()
        WHERE id = :listing_id
        """,
        {"listing_id": str(sale["listing_id"])}
    )

    return {
        "success": True,
        "message": "Sale completed, asset ownership transferred"
    }
