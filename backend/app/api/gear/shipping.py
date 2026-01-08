"""
Gear House Shipping API

Handles shipping for marketplace rentals:
- Rate quotes from multiple carriers (FedEx, UPS, USPS)
- Label generation and download
- Tracking updates
- Return labels
- Organization shipping settings
"""
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.services import gear_service
from app.services.easypost_service import (
    EasyPostService,
    ShippingAddress,
    PackageDimensions,
    ShippingRate,
    ShippingLabel,
    TrackingInfo,
    AddressVerification,
)

router = APIRouter(prefix="/shipping", tags=["Gear Shipping"])


# ============================================================================
# SCHEMAS
# ============================================================================

class AddressInput(BaseModel):
    """Address input for API requests"""
    name: str
    company: Optional[str] = None
    street1: str
    street2: Optional[str] = None
    city: str
    state: str
    zip: str
    country: str = "US"
    phone: Optional[str] = None
    email: Optional[str] = None


class GetRatesRequest(BaseModel):
    """Request shipping rates"""
    from_org_id: str
    to_address: AddressInput
    item_ids: List[str]  # Quote item IDs or asset IDs
    carriers: Optional[List[str]] = None  # usps, ups, fedex


class BuyLabelRequest(BaseModel):
    """Purchase a shipping label"""
    quote_id: Optional[str] = None
    order_id: Optional[str] = None
    rate_id: str
    shipment_id: str  # EasyPost shipment ID from rate request
    shipment_type: str = "outbound"  # outbound or return
    label_format: str = "pdf"


class CreateReturnLabelRequest(BaseModel):
    """Create a return label"""
    order_id: str
    original_shipment_id: Optional[str] = None


class UpdateShippingSettingsRequest(BaseModel):
    """Update organization shipping settings"""
    allows_customer_pickup: Optional[bool] = None
    pickup_address: Optional[str] = None
    pickup_instructions: Optional[str] = None
    pickup_hours: Optional[dict] = None
    local_delivery_enabled: Optional[bool] = None
    offers_delivery: Optional[bool] = None
    delivery_radius_miles: Optional[int] = None
    delivery_base_fee: Optional[float] = None
    delivery_per_mile_fee: Optional[float] = None
    shipping_enabled: Optional[bool] = None
    shipping_carriers: Optional[List[str]] = None
    shipping_pricing_mode: Optional[str] = None  # real_time, flat_rate, both
    flat_rate_shipping: Optional[dict] = None
    free_shipping_threshold: Optional[float] = None
    ships_from_address: Optional[dict] = None
    package_defaults: Optional[dict] = None
    return_shipping_paid_by: Optional[str] = None  # renter, rental_house, split
    auto_insurance_threshold: Optional[float] = None
    use_platform_easypost: Optional[bool] = None


class VerifyAddressRequest(BaseModel):
    """Verify a shipping address"""
    address: AddressInput


# ============================================================================
# HELPERS
# ============================================================================

def get_profile_id(user: dict) -> str:
    """Extract profile ID from user dict (already resolved by get_current_user)."""
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: list = None) -> None:
    """Verify user has access to organization with optional role requirement."""
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def get_org_marketplace_settings(org_id: str) -> dict:
    """Get marketplace settings for an organization."""
    settings = execute_single(
        "SELECT * FROM gear_marketplace_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )
    return settings or {}


def get_org_easypost_key(settings: dict) -> Optional[str]:
    """Get EasyPost API key for org or None to use platform key."""
    if settings.get("use_platform_easypost", True):
        return None  # Use platform key
    return settings.get("easypost_api_key_encrypted")  # Would decrypt in production


def address_input_to_shipping(addr: AddressInput) -> ShippingAddress:
    """Convert AddressInput to ShippingAddress."""
    return ShippingAddress(
        name=addr.name,
        company=addr.company,
        street1=addr.street1,
        street2=addr.street2,
        city=addr.city,
        state=addr.state,
        zip=addr.zip,
        country=addr.country,
        phone=addr.phone,
        email=addr.email,
    )


# ============================================================================
# RATE ENDPOINTS
# ============================================================================

@router.post("/rates")
async def get_shipping_rates(
    data: GetRatesRequest,
    user=Depends(get_current_user)
):
    """
    Get shipping rate quotes from multiple carriers.

    Returns available rates sorted by price, along with a shipment_id
    to use when purchasing a label.
    """
    profile_id = get_profile_id(user)

    # Get the rental house's settings
    settings = get_org_marketplace_settings(data.from_org_id)
    if not settings.get("shipping_enabled"):
        raise HTTPException(status_code=400, detail="Shipping not enabled for this organization")

    # Get from address from org settings
    ships_from = settings.get("ships_from_address")
    if not ships_from:
        raise HTTPException(status_code=400, detail="Organization has not configured shipping address")

    from_address = ShippingAddress(
        name=ships_from.get("name", ""),
        company=ships_from.get("company"),
        street1=ships_from.get("street1", ""),
        street2=ships_from.get("street2"),
        city=ships_from.get("city", ""),
        state=ships_from.get("state", ""),
        zip=ships_from.get("zip", ""),
        country=ships_from.get("country", "US"),
        phone=ships_from.get("phone"),
    )

    to_address = address_input_to_shipping(data.to_address)

    # Calculate package dimensions from items
    items_data = []
    for item_id in data.item_ids:
        # Try quote items first, then assets
        item = execute_single(
            """
            SELECT qi.*, a.category
            FROM gear_rental_quote_items qi
            JOIN gear_assets a ON a.id = qi.asset_id
            WHERE qi.id = :item_id
            """,
            {"item_id": item_id}
        )
        if item:
            items_data.append({
                "category": item.get("category", "default"),
                "quantity": item.get("quantity", 1),
            })
        else:
            # Try direct asset
            asset = execute_single(
                "SELECT category FROM gear_assets WHERE id = :asset_id",
                {"asset_id": item_id}
            )
            if asset:
                items_data.append({
                    "category": asset.get("category", "default"),
                    "quantity": 1,
                })

    if not items_data:
        items_data = [{"category": "default", "quantity": 1}]

    # Calculate package
    org_defaults = settings.get("package_defaults")
    package = EasyPostService.calculate_combined_package(items_data, org_defaults)

    # Filter carriers based on settings
    enabled_carriers = settings.get("shipping_carriers", ["usps", "ups", "fedex"])
    if data.carriers:
        carriers = [c for c in data.carriers if c in enabled_carriers]
    else:
        carriers = enabled_carriers

    # Get EasyPost key
    api_key = get_org_easypost_key(settings)

    try:
        result = await EasyPostService.create_shipment_and_get_rates(
            from_address=from_address,
            to_address=to_address,
            package=package,
            carriers=carriers,
            org_api_key=api_key,
        )

        # Check for flat rate options
        pricing_mode = settings.get("shipping_pricing_mode", "real_time")
        flat_rates = settings.get("flat_rate_shipping", {})
        free_threshold = settings.get("free_shipping_threshold")

        response_rates = []
        for rate in result["rates"]:
            rate_dict = rate.model_dump() if hasattr(rate, 'model_dump') else rate.__dict__
            response_rates.append(rate_dict)

        # Add flat rates if configured
        if pricing_mode in ["flat_rate", "both"] and flat_rates:
            for tier, price in flat_rates.items():
                if price is not None:
                    response_rates.append({
                        "id": f"flat_{tier}",
                        "carrier": "flat_rate",
                        "service": tier,
                        "service_name": f"Flat Rate - {tier.title()}",
                        "rate": float(price),
                        "currency": "USD",
                        "estimated_days": {"ground": 7, "express": 3, "overnight": 1}.get(tier, 5),
                        "delivery_date": None,
                        "delivery_date_guaranteed": False,
                    })

        # Sort by rate
        response_rates.sort(key=lambda r: r.get("rate", 999))

        return {
            "shipment_id": result["shipment_id"],
            "rates": response_rates,
            "free_shipping_threshold": free_threshold,
            "package_dimensions": {
                "length": package.length,
                "width": package.width,
                "height": package.height,
                "weight": package.weight,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# LABEL ENDPOINTS
# ============================================================================

@router.post("/labels")
async def purchase_label(
    data: BuyLabelRequest,
    user=Depends(get_current_user)
):
    """
    Purchase a shipping label.

    Requires a valid shipment_id and rate_id from the rates endpoint.
    """
    profile_id = get_profile_id(user)

    # Get quote or order to verify access and get org
    org_id = None
    quote = None
    order = None

    if data.quote_id:
        quote = execute_single(
            """
            SELECT q.*, r.rental_house_org_id
            FROM gear_rental_quotes q
            JOIN gear_rental_requests r ON r.id = q.request_id
            WHERE q.id = :quote_id
            """,
            {"quote_id": data.quote_id}
        )
        if not quote:
            raise HTTPException(status_code=404, detail="Quote not found")
        org_id = quote["rental_house_org_id"]

    elif data.order_id:
        order = execute_single(
            "SELECT * FROM gear_rental_orders WHERE id = :order_id",
            {"order_id": data.order_id}
        )
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        org_id = order["rental_house_org_id"]

    if not org_id:
        raise HTTPException(status_code=400, detail="Either quote_id or order_id is required")

    # Verify user has access to org
    require_org_access(org_id, profile_id)

    # Get org settings
    settings = get_org_marketplace_settings(org_id)
    api_key = get_org_easypost_key(settings)

    # Handle flat rate labels (no EasyPost)
    if data.rate_id.startswith("flat_"):
        # For flat rates, we just record the shipment without a real label
        # The rental house will use their own shipping method
        shipment_data = {
            "organization_id": org_id,
            "shipment_type": data.shipment_type,
            "carrier": "other",
            "service": data.rate_id.replace("flat_", ""),
            "service_name": f"Flat Rate - {data.rate_id.replace('flat_', '').title()}",
            "status": "pending",
            "from_address": settings.get("ships_from_address", {}),
            "to_address": {},  # Would come from quote/order
            "created_by": profile_id,
        }

        if data.quote_id:
            shipment_data["quote_id"] = data.quote_id
        if data.order_id:
            shipment_data["order_id"] = data.order_id

        shipment = execute_insert(
            """
            INSERT INTO gear_shipments (
                organization_id, quote_id, order_id, shipment_type,
                carrier, service, service_name, status,
                from_address, to_address, created_by
            ) VALUES (
                :organization_id, :quote_id, :order_id, :shipment_type,
                :carrier, :service, :service_name, :status,
                :from_address, :to_address, :created_by
            ) RETURNING *
            """,
            shipment_data
        )

        return {
            "id": str(shipment["id"]),
            "tracking_number": None,
            "tracking_url": None,
            "label_url": None,
            "label_format": None,
            "carrier": "flat_rate",
            "service": shipment["service"],
            "status": "pending",
            "message": "Flat rate shipment created. Use your own carrier to ship.",
        }

    # Purchase real label via EasyPost
    try:
        label = await EasyPostService.buy_label(
            shipment_id=data.shipment_id,
            rate_id=data.rate_id,
            label_format=data.label_format,
            org_api_key=api_key,
        )

        # Store shipment in database
        shipment_data = {
            "organization_id": org_id,
            "shipment_type": data.shipment_type,
            "easypost_shipment_id": data.shipment_id,
            "easypost_rate_id": data.rate_id,
            "carrier": label.carrier,
            "service": label.service,
            "service_name": f"{label.carrier.upper()} {label.service}",
            "tracking_number": label.tracking_number,
            "tracking_url": label.tracking_url,
            "status": "label_created",
            "label_url": label.label_url,
            "label_format": label.label_format,
            "label_created_at": datetime.utcnow().isoformat(),
            "shipping_cost": label.rate,
            "total_cost": label.rate,
            "from_address": {},  # Would get from EasyPost response
            "to_address": {},
            "created_by": profile_id,
        }

        if data.quote_id:
            shipment_data["quote_id"] = data.quote_id
        if data.order_id:
            shipment_data["order_id"] = data.order_id

        shipment = execute_insert(
            """
            INSERT INTO gear_shipments (
                organization_id, quote_id, order_id, shipment_type,
                easypost_shipment_id, easypost_rate_id,
                carrier, service, service_name,
                tracking_number, tracking_url, status,
                label_url, label_format, label_created_at,
                shipping_cost, total_cost,
                from_address, to_address, created_by
            ) VALUES (
                :organization_id, :quote_id, :order_id, :shipment_type,
                :easypost_shipment_id, :easypost_rate_id,
                :carrier, :service, :service_name,
                :tracking_number, :tracking_url, :status,
                :label_url, :label_format, :label_created_at,
                :shipping_cost, :total_cost,
                :from_address, :to_address, :created_by
            ) RETURNING *
            """,
            shipment_data
        )

        # Update quote/order with shipment reference
        if data.order_id:
            if data.shipment_type == "outbound":
                execute_update(
                    "UPDATE gear_rental_orders SET outbound_shipment_id = :shipment_id WHERE id = :order_id",
                    {"shipment_id": shipment["id"], "order_id": data.order_id}
                )
            else:
                execute_update(
                    "UPDATE gear_rental_orders SET return_shipment_id = :shipment_id WHERE id = :order_id",
                    {"shipment_id": shipment["id"], "order_id": data.order_id}
                )

        return {
            "id": str(shipment["id"]),
            "tracking_number": label.tracking_number,
            "tracking_url": label.tracking_url,
            "label_url": label.label_url,
            "label_format": label.label_format,
            "carrier": label.carrier,
            "service": label.service,
            "rate": label.rate,
            "status": "label_created",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/labels/{shipment_id}")
async def get_label(
    shipment_id: str,
    user=Depends(get_current_user)
):
    """Get shipping label details."""
    profile_id = get_profile_id(user)

    shipment = execute_single(
        "SELECT * FROM gear_shipments WHERE id = :shipment_id",
        {"shipment_id": shipment_id}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    # Verify access
    require_org_access(shipment["organization_id"], profile_id)

    return shipment


@router.get("/labels/{shipment_id}/download")
async def download_label(
    shipment_id: str,
    user=Depends(get_current_user)
):
    """Get label download URL."""
    profile_id = get_profile_id(user)

    shipment = execute_single(
        "SELECT * FROM gear_shipments WHERE id = :shipment_id",
        {"shipment_id": shipment_id}
    )
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")

    require_org_access(shipment["organization_id"], profile_id)

    if not shipment.get("label_url"):
        raise HTTPException(status_code=404, detail="No label available for this shipment")

    return {"label_url": shipment["label_url"]}


# ============================================================================
# RETURN LABEL ENDPOINTS
# ============================================================================

@router.post("/return-label/{order_id}")
async def create_return_label(
    order_id: str,
    user=Depends(get_current_user)
):
    """
    Create a return shipping label for an order.

    Uses the original outbound shipment to create a return label
    with swapped addresses.
    """
    profile_id = get_profile_id(user)

    order = execute_single(
        "SELECT * FROM gear_rental_orders WHERE id = :order_id",
        {"order_id": order_id}
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Verify user has access (either renter or rental house)
    renter_access = False
    rental_house_access = False

    renter_orgs = execute_query(
        "SELECT organization_id FROM organization_members WHERE user_id = :user_id AND is_active = TRUE",
        {"user_id": profile_id}
    )
    renter_org_ids = [o["organization_id"] for o in renter_orgs]

    if order.get("renter_org_id") in renter_org_ids:
        renter_access = True
    if order.get("rental_house_org_id") in renter_org_ids:
        rental_house_access = True

    if not renter_access and not rental_house_access:
        raise HTTPException(status_code=403, detail="Not authorized to access this order")

    # Get original outbound shipment
    original_shipment = execute_single(
        "SELECT * FROM gear_shipments WHERE id = :shipment_id",
        {"shipment_id": order.get("outbound_shipment_id")}
    )

    if not original_shipment or not original_shipment.get("easypost_shipment_id"):
        raise HTTPException(
            status_code=400,
            detail="No outbound shipment found or shipment was not created via EasyPost"
        )

    # Get settings
    settings = get_org_marketplace_settings(order["rental_house_org_id"])
    api_key = get_org_easypost_key(settings)

    try:
        # Create return label
        label = await EasyPostService.create_return_label(
            original_shipment_id=original_shipment["easypost_shipment_id"],
            org_api_key=api_key,
        )

        # Store return shipment
        shipment_data = {
            "organization_id": order["rental_house_org_id"],
            "order_id": order_id,
            "shipment_type": "return",
            "carrier": label.carrier,
            "service": label.service,
            "service_name": f"{label.carrier.upper()} {label.service}",
            "tracking_number": label.tracking_number,
            "tracking_url": label.tracking_url,
            "status": "label_created",
            "label_url": label.label_url,
            "label_format": label.label_format,
            "label_created_at": datetime.utcnow().isoformat(),
            "shipping_cost": label.rate,
            "total_cost": label.rate,
            "paid_by": settings.get("return_shipping_paid_by", "renter"),
            "from_address": original_shipment.get("to_address", {}),
            "to_address": original_shipment.get("from_address", {}),
            "created_by": profile_id,
        }

        shipment = execute_insert(
            """
            INSERT INTO gear_shipments (
                organization_id, order_id, shipment_type,
                carrier, service, service_name,
                tracking_number, tracking_url, status,
                label_url, label_format, label_created_at,
                shipping_cost, total_cost, paid_by,
                from_address, to_address, created_by
            ) VALUES (
                :organization_id, :order_id, :shipment_type,
                :carrier, :service, :service_name,
                :tracking_number, :tracking_url, :status,
                :label_url, :label_format, :label_created_at,
                :shipping_cost, :total_cost, :paid_by,
                :from_address, :to_address, :created_by
            ) RETURNING *
            """,
            shipment_data
        )

        # Update order with return shipment
        execute_update(
            "UPDATE gear_rental_orders SET return_shipment_id = :shipment_id WHERE id = :order_id",
            {"shipment_id": shipment["id"], "order_id": order_id}
        )

        return {
            "id": str(shipment["id"]),
            "tracking_number": label.tracking_number,
            "tracking_url": label.tracking_url,
            "label_url": label.label_url,
            "label_format": label.label_format,
            "carrier": label.carrier,
            "service": label.service,
            "rate": label.rate,
            "paid_by": shipment["paid_by"],
            "status": "label_created",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# TRACKING ENDPOINTS
# ============================================================================

@router.get("/tracking/{tracking_number}")
async def get_tracking(
    tracking_number: str,
    carrier: Optional[str] = None,
    user=Depends(get_current_user)
):
    """Get tracking information for a shipment."""
    profile_id = get_profile_id(user)

    # Find shipment by tracking number
    shipment = execute_single(
        "SELECT * FROM gear_shipments WHERE tracking_number = :tracking",
        {"tracking": tracking_number}
    )

    if shipment:
        # Verify access
        require_org_access(shipment["organization_id"], profile_id)
        carrier = carrier or shipment.get("carrier")

    # Get tracking info
    settings = get_org_marketplace_settings(shipment["organization_id"]) if shipment else {}
    api_key = get_org_easypost_key(settings)

    try:
        tracking = await EasyPostService.get_tracking(
            tracking_number=tracking_number,
            carrier=carrier,
            org_api_key=api_key,
        )

        # Update shipment status if we have one
        if shipment:
            status_map = {
                "pre_transit": "label_created",
                "in_transit": "in_transit",
                "out_for_delivery": "out_for_delivery",
                "delivered": "delivered",
                "return_to_sender": "return_to_sender",
                "failure": "failure",
            }
            new_status = status_map.get(tracking.status, shipment["status"])

            if new_status != shipment["status"]:
                execute_update(
                    """
                    UPDATE gear_shipments
                    SET status = :status, tracking_events = :events, updated_at = NOW()
                    WHERE id = :id
                    """,
                    {
                        "id": shipment["id"],
                        "status": new_status,
                        "events": [e.model_dump() for e in tracking.events],
                    }
                )

                # Update delivered timestamp
                if new_status == "delivered":
                    execute_update(
                        "UPDATE gear_shipments SET delivered_at = NOW(), actual_delivery_date = CURRENT_DATE WHERE id = :id",
                        {"id": shipment["id"]}
                    )

        return {
            "tracking_number": tracking.tracking_number,
            "carrier": tracking.carrier,
            "status": tracking.status,
            "estimated_delivery_date": tracking.estimated_delivery_date,
            "events": [e.model_dump() for e in tracking.events],
            "shipment_id": str(shipment["id"]) if shipment else None,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tracking/webhook")
async def tracking_webhook(request: Request):
    """
    EasyPost webhook for tracking updates.

    This endpoint receives tracking updates from EasyPost
    and updates the corresponding shipments in our database.
    """
    try:
        payload = await request.json()

        # Verify webhook signature in production
        # signature = request.headers.get("X-Hmac-Signature")
        # if not verify_easypost_webhook(payload, signature):
        #     raise HTTPException(status_code=401, detail="Invalid webhook signature")

        event_type = payload.get("description", "")
        result = payload.get("result", {})

        if "tracker" in event_type.lower():
            tracking_number = result.get("tracking_code")
            status = result.get("status", "")

            if tracking_number:
                # Update shipment
                status_map = {
                    "pre_transit": "label_created",
                    "in_transit": "in_transit",
                    "out_for_delivery": "out_for_delivery",
                    "delivered": "delivered",
                    "return_to_sender": "return_to_sender",
                    "failure": "failure",
                }
                new_status = status_map.get(status, "in_transit")

                shipment = execute_single(
                    "SELECT id FROM gear_shipments WHERE tracking_number = :tracking",
                    {"tracking": tracking_number}
                )

                if shipment:
                    events = [
                        {
                            "status": e.get("status", ""),
                            "message": e.get("message", ""),
                            "location": e.get("tracking_location", {}).get("city", ""),
                            "timestamp": e.get("datetime", ""),
                        }
                        for e in result.get("tracking_details", [])
                    ]

                    execute_update(
                        """
                        UPDATE gear_shipments
                        SET status = :status, tracking_events = :events,
                            estimated_delivery_date = :est_date, updated_at = NOW()
                        WHERE id = :id
                        """,
                        {
                            "id": shipment["id"],
                            "status": new_status,
                            "events": events,
                            "est_date": result.get("est_delivery_date"),
                        }
                    )

                    if new_status == "delivered":
                        execute_update(
                            "UPDATE gear_shipments SET delivered_at = NOW(), actual_delivery_date = CURRENT_DATE WHERE id = :id",
                            {"id": shipment["id"]}
                        )

        return {"status": "ok"}

    except Exception as e:
        # Log error but return 200 to prevent webhook retries
        print(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}


# ============================================================================
# SETTINGS ENDPOINTS
# ============================================================================

@router.get("/{org_id}/settings")
async def get_shipping_settings(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get shipping settings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    settings = get_org_marketplace_settings(org_id)

    return {
        "allows_customer_pickup": settings.get("allows_customer_pickup", True),
        "pickup_address": settings.get("pickup_address"),
        "pickup_instructions": settings.get("pickup_instructions"),
        "pickup_hours": settings.get("pickup_hours"),
        "local_delivery_enabled": settings.get("local_delivery_enabled", False),
        "offers_delivery": settings.get("offers_delivery", False),
        "delivery_radius_miles": settings.get("delivery_radius_miles"),
        "delivery_base_fee": settings.get("delivery_base_fee"),
        "delivery_per_mile_fee": settings.get("delivery_per_mile_fee"),
        "shipping_enabled": settings.get("shipping_enabled", False),
        "shipping_carriers": settings.get("shipping_carriers", ["usps", "ups", "fedex"]),
        "shipping_pricing_mode": settings.get("shipping_pricing_mode", "real_time"),
        "flat_rate_shipping": settings.get("flat_rate_shipping"),
        "free_shipping_threshold": settings.get("free_shipping_threshold"),
        "ships_from_address": settings.get("ships_from_address"),
        "package_defaults": settings.get("package_defaults"),
        "return_shipping_paid_by": settings.get("return_shipping_paid_by", "renter"),
        "auto_insurance_threshold": settings.get("auto_insurance_threshold"),
        "use_platform_easypost": settings.get("use_platform_easypost", True),
    }


@router.put("/{org_id}/settings")
async def update_shipping_settings(
    org_id: str,
    data: UpdateShippingSettingsRequest,
    user=Depends(get_current_user)
):
    """Update shipping settings for an organization."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["owner", "admin", "manager"])

    # Build update query dynamically
    updates = {}
    for field, value in data.model_dump(exclude_none=True).items():
        updates[field] = value

    if not updates:
        return {"message": "No changes"}

    # Check if settings exist
    existing = execute_single(
        "SELECT id FROM gear_marketplace_settings WHERE organization_id = :org_id",
        {"org_id": org_id}
    )

    if existing:
        # Build SET clause
        set_parts = [f"{k} = :{k}" for k in updates.keys()]
        set_clause = ", ".join(set_parts)
        updates["org_id"] = org_id

        execute_update(
            f"UPDATE gear_marketplace_settings SET {set_clause}, updated_at = NOW() WHERE organization_id = :org_id",
            updates
        )
    else:
        # Insert new settings
        updates["organization_id"] = org_id
        cols = ", ".join(updates.keys())
        vals = ", ".join(f":{k}" for k in updates.keys())

        execute_insert(
            f"INSERT INTO gear_marketplace_settings ({cols}) VALUES ({vals}) RETURNING *",
            updates
        )

    return {"message": "Settings updated", "updated_fields": list(updates.keys())}


@router.post("/{org_id}/verify-address")
async def verify_org_address(
    org_id: str,
    data: VerifyAddressRequest,
    user=Depends(get_current_user)
):
    """Verify the organization's ship-from address."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["owner", "admin", "manager"])

    address = address_input_to_shipping(data.address)

    settings = get_org_marketplace_settings(org_id)
    api_key = get_org_easypost_key(settings)

    result = await EasyPostService.verify_address(address, api_key)

    return {
        "is_valid": result.is_valid,
        "verified_address": result.verified_address.model_dump() if result.verified_address else None,
        "errors": result.errors,
        "warnings": result.warnings,
    }


@router.post("/{org_id}/test-rates")
async def test_shipping_rates(
    org_id: str,
    data: VerifyAddressRequest,
    user=Depends(get_current_user)
):
    """Test shipping rate calculation to a sample address."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, roles=["owner", "admin", "manager"])

    settings = get_org_marketplace_settings(org_id)

    if not settings.get("ships_from_address"):
        raise HTTPException(status_code=400, detail="Configure ship-from address first")

    # Use default package for test
    package = EasyPostService.get_package_dimensions_for_category(
        "default",
        settings.get("package_defaults")
    )

    from_addr = settings["ships_from_address"]
    from_address = ShippingAddress(
        name=from_addr.get("name", ""),
        street1=from_addr.get("street1", ""),
        city=from_addr.get("city", ""),
        state=from_addr.get("state", ""),
        zip=from_addr.get("zip", ""),
        country=from_addr.get("country", "US"),
    )

    to_address = address_input_to_shipping(data.address)
    api_key = get_org_easypost_key(settings)

    try:
        result = await EasyPostService.create_shipment_and_get_rates(
            from_address=from_address,
            to_address=to_address,
            package=package,
            carriers=settings.get("shipping_carriers", ["usps", "ups", "fedex"]),
            org_api_key=api_key,
        )

        return {
            "rates": [r.model_dump() for r in result["rates"]],
            "test_package": {
                "length": package.length,
                "width": package.width,
                "height": package.height,
                "weight": package.weight,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
