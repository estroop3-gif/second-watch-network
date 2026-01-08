"""
EasyPost Shipping Service for Gear House Marketplace
Provides multi-carrier shipping integration with label generation and tracking.
Supports FedEx, UPS, USPS, and DHL.
"""
import os
import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from app.core.config import settings


class ShippingAddress(BaseModel):
    """Address for shipping"""
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


class PackageDimensions(BaseModel):
    """Package dimensions and weight"""
    length: float  # inches
    width: float  # inches
    height: float  # inches
    weight: float  # ounces
    predefined_package: Optional[str] = None  # e.g., "Parcel", "FlatRateEnvelope"


class ShippingRate(BaseModel):
    """A shipping rate quote"""
    id: str
    carrier: str
    service: str
    service_name: str
    rate: float
    currency: str = "USD"
    estimated_days: Optional[int] = None
    delivery_date: Optional[str] = None
    delivery_date_guaranteed: bool = False


class ShippingLabel(BaseModel):
    """A purchased shipping label"""
    id: str
    tracking_number: str
    tracking_url: str
    label_url: str
    label_format: str
    carrier: str
    service: str
    rate: float
    created_at: str


class TrackingEvent(BaseModel):
    """A tracking event update"""
    status: str
    message: str
    location: Optional[str] = None
    timestamp: str


class TrackingInfo(BaseModel):
    """Full tracking information"""
    tracking_number: str
    carrier: str
    status: str
    estimated_delivery_date: Optional[str] = None
    events: List[TrackingEvent]


class AddressVerification(BaseModel):
    """Address verification result"""
    is_valid: bool
    verified_address: Optional[ShippingAddress] = None
    errors: List[str] = []
    warnings: List[str] = []


# Default package dimensions by gear category
DEFAULT_PACKAGE_DIMENSIONS = {
    "camera": {"length": 18, "width": 14, "height": 12, "weight": 240},  # 15 lbs
    "lens": {"length": 8, "width": 6, "height": 6, "weight": 48},  # 3 lbs
    "lighting": {"length": 24, "width": 12, "height": 12, "weight": 320},  # 20 lbs
    "audio": {"length": 12, "width": 10, "height": 8, "weight": 80},  # 5 lbs
    "grip": {"length": 48, "width": 8, "height": 8, "weight": 400},  # 25 lbs
    "monitor": {"length": 16, "width": 12, "height": 6, "weight": 96},  # 6 lbs
    "stabilizer": {"length": 24, "width": 10, "height": 10, "weight": 160},  # 10 lbs
    "drone": {"length": 20, "width": 16, "height": 10, "weight": 128},  # 8 lbs
    "default": {"length": 16, "width": 12, "height": 10, "weight": 160},  # 10 lbs
}


class EasyPostService:
    """
    EasyPost integration for multi-carrier shipping.
    Handles address verification, rate quotes, label purchase, and tracking.
    """

    EASYPOST_API_URL = "https://api.easypost.com/v2"
    EASYPOST_TEST_API_URL = "https://api.easypost.com/v2"  # Same URL, different key

    # Carrier codes mapping
    CARRIER_MAP = {
        "usps": "USPS",
        "ups": "UPS",
        "fedex": "FedEx",
        "dhl": "DHL",
    }

    @staticmethod
    def _get_api_key(org_api_key: Optional[str] = None, use_test: bool = False) -> str:
        """Get the appropriate EasyPost API key"""
        if org_api_key:
            return org_api_key

        if use_test:
            return getattr(settings, 'EASYPOST_TEST_API_KEY', '')
        return getattr(settings, 'EASYPOST_API_KEY', '')

    @staticmethod
    def _get_headers(api_key: str) -> Dict[str, str]:
        """Get request headers with API key auth"""
        import base64
        encoded = base64.b64encode(f"{api_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }

    @staticmethod
    async def verify_address(
        address: ShippingAddress,
        org_api_key: Optional[str] = None,
    ) -> AddressVerification:
        """
        Verify and standardize a shipping address.

        Args:
            address: The address to verify
            org_api_key: Optional organization-specific API key

        Returns:
            AddressVerification with validation results
        """
        api_key = EasyPostService._get_api_key(org_api_key)
        if not api_key:
            return AddressVerification(
                is_valid=True,  # Skip verification if no API key
                verified_address=address,
                warnings=["Address verification skipped - no API key configured"]
            )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{EasyPostService.EASYPOST_API_URL}/addresses",
                    headers=EasyPostService._get_headers(api_key),
                    json={
                        "address": {
                            "name": address.name,
                            "company": address.company,
                            "street1": address.street1,
                            "street2": address.street2,
                            "city": address.city,
                            "state": address.state,
                            "zip": address.zip,
                            "country": address.country,
                            "phone": address.phone,
                            "verify": ["delivery"],
                        }
                    },
                    timeout=30.0,
                )

                if response.status_code != 201:
                    return AddressVerification(
                        is_valid=False,
                        errors=[f"Address verification failed: {response.text}"]
                    )

                data = response.json()
                verifications = data.get("verifications", {}).get("delivery", {})

                errors = []
                warnings = []

                if verifications.get("errors"):
                    errors = [e.get("message", str(e)) for e in verifications["errors"]]

                if verifications.get("details"):
                    details = verifications["details"]
                    if details.get("latitude") is None:
                        warnings.append("Address could not be geolocated")

                verified = ShippingAddress(
                    name=data.get("name", address.name),
                    company=data.get("company"),
                    street1=data.get("street1", address.street1),
                    street2=data.get("street2"),
                    city=data.get("city", address.city),
                    state=data.get("state", address.state),
                    zip=data.get("zip", address.zip),
                    country=data.get("country", address.country),
                    phone=data.get("phone"),
                )

                return AddressVerification(
                    is_valid=len(errors) == 0,
                    verified_address=verified,
                    errors=errors,
                    warnings=warnings,
                )

        except Exception as e:
            return AddressVerification(
                is_valid=False,
                errors=[f"Address verification error: {str(e)}"]
            )

    @staticmethod
    async def get_shipping_rates(
        from_address: ShippingAddress,
        to_address: ShippingAddress,
        package: PackageDimensions,
        carriers: Optional[List[str]] = None,
        org_api_key: Optional[str] = None,
    ) -> List[ShippingRate]:
        """
        Get shipping rate quotes from multiple carriers.

        Args:
            from_address: Origin address
            to_address: Destination address
            package: Package dimensions and weight
            carriers: Optional list of carriers to query (usps, ups, fedex, dhl)
            org_api_key: Optional organization-specific API key

        Returns:
            List of ShippingRate quotes sorted by price
        """
        api_key = EasyPostService._get_api_key(org_api_key)
        if not api_key:
            raise ValueError("EasyPost API key not configured")

        # Build parcel data
        parcel_data = {
            "length": package.length,
            "width": package.width,
            "height": package.height,
            "weight": package.weight,
        }
        if package.predefined_package:
            parcel_data["predefined_package"] = package.predefined_package

        # Build shipment request
        shipment_data = {
            "shipment": {
                "from_address": {
                    "name": from_address.name,
                    "company": from_address.company,
                    "street1": from_address.street1,
                    "street2": from_address.street2,
                    "city": from_address.city,
                    "state": from_address.state,
                    "zip": from_address.zip,
                    "country": from_address.country,
                    "phone": from_address.phone,
                },
                "to_address": {
                    "name": to_address.name,
                    "company": to_address.company,
                    "street1": to_address.street1,
                    "street2": to_address.street2,
                    "city": to_address.city,
                    "state": to_address.state,
                    "zip": to_address.zip,
                    "country": to_address.country,
                    "phone": to_address.phone,
                },
                "parcel": parcel_data,
            }
        }

        # Filter carriers if specified
        if carriers:
            carrier_accounts = []
            for carrier in carriers:
                carrier_upper = EasyPostService.CARRIER_MAP.get(carrier.lower(), carrier.upper())
                # Note: In production, you'd fetch carrier account IDs from settings
                # For now, EasyPost will use any configured carrier accounts
            # EasyPost filters by carrier_accounts if provided

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{EasyPostService.EASYPOST_API_URL}/shipments",
                    headers=EasyPostService._get_headers(api_key),
                    json=shipment_data,
                    timeout=60.0,  # Rate fetching can take time
                )

                if response.status_code != 201:
                    raise Exception(f"Failed to get rates: {response.text}")

                data = response.json()
                rates = []

                for rate in data.get("rates", []):
                    carrier_lower = rate.get("carrier", "").lower()

                    # Filter by requested carriers
                    if carriers and carrier_lower not in [c.lower() for c in carriers]:
                        continue

                    rates.append(ShippingRate(
                        id=rate.get("id"),
                        carrier=carrier_lower,
                        service=rate.get("service", ""),
                        service_name=f"{rate.get('carrier', '')} {rate.get('service', '')}",
                        rate=float(rate.get("rate", 0)),
                        currency=rate.get("currency", "USD"),
                        estimated_days=rate.get("delivery_days"),
                        delivery_date=rate.get("delivery_date"),
                        delivery_date_guaranteed=rate.get("delivery_date_guaranteed", False),
                    ))

                # Sort by price
                rates.sort(key=lambda r: r.rate)

                # Store shipment ID for later label purchase
                # This should be cached/stored somewhere accessible
                return rates

        except Exception as e:
            raise Exception(f"Error getting shipping rates: {str(e)}")

    @staticmethod
    async def create_shipment_and_get_rates(
        from_address: ShippingAddress,
        to_address: ShippingAddress,
        package: PackageDimensions,
        carriers: Optional[List[str]] = None,
        org_api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a shipment and return both shipment ID and rates.
        Use this when you need the shipment ID for later label purchase.

        Returns:
            Dict with 'shipment_id' and 'rates' list
        """
        api_key = EasyPostService._get_api_key(org_api_key)
        if not api_key:
            raise ValueError("EasyPost API key not configured")

        parcel_data = {
            "length": package.length,
            "width": package.width,
            "height": package.height,
            "weight": package.weight,
        }
        if package.predefined_package:
            parcel_data["predefined_package"] = package.predefined_package

        shipment_data = {
            "shipment": {
                "from_address": from_address.model_dump(exclude_none=True),
                "to_address": to_address.model_dump(exclude_none=True),
                "parcel": parcel_data,
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{EasyPostService.EASYPOST_API_URL}/shipments",
                    headers=EasyPostService._get_headers(api_key),
                    json=shipment_data,
                    timeout=60.0,
                )

                if response.status_code != 201:
                    raise Exception(f"Failed to create shipment: {response.text}")

                data = response.json()
                rates = []

                for rate in data.get("rates", []):
                    carrier_lower = rate.get("carrier", "").lower()
                    if carriers and carrier_lower not in [c.lower() for c in carriers]:
                        continue

                    rates.append(ShippingRate(
                        id=rate.get("id"),
                        carrier=carrier_lower,
                        service=rate.get("service", ""),
                        service_name=f"{rate.get('carrier', '')} {rate.get('service', '')}",
                        rate=float(rate.get("rate", 0)),
                        currency=rate.get("currency", "USD"),
                        estimated_days=rate.get("delivery_days"),
                        delivery_date=rate.get("delivery_date"),
                        delivery_date_guaranteed=rate.get("delivery_date_guaranteed", False),
                    ))

                rates.sort(key=lambda r: r.rate)

                return {
                    "shipment_id": data.get("id"),
                    "rates": rates,
                }

        except Exception as e:
            raise Exception(f"Error creating shipment: {str(e)}")

    @staticmethod
    async def buy_label(
        shipment_id: str,
        rate_id: str,
        label_format: str = "pdf",
        org_api_key: Optional[str] = None,
    ) -> ShippingLabel:
        """
        Purchase a shipping label for a shipment.

        Args:
            shipment_id: EasyPost shipment ID
            rate_id: Selected rate ID from get_shipping_rates
            label_format: Label format (pdf, png, zpl, epl2)
            org_api_key: Optional organization-specific API key

        Returns:
            ShippingLabel with tracking info and label URL
        """
        api_key = EasyPostService._get_api_key(org_api_key)
        if not api_key:
            raise ValueError("EasyPost API key not configured")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{EasyPostService.EASYPOST_API_URL}/shipments/{shipment_id}/buy",
                    headers=EasyPostService._get_headers(api_key),
                    json={
                        "rate": {"id": rate_id},
                        "label_format": label_format.upper(),
                    },
                    timeout=30.0,
                )

                if response.status_code != 200:
                    raise Exception(f"Failed to buy label: {response.text}")

                data = response.json()
                postage_label = data.get("postage_label", {})
                selected_rate = data.get("selected_rate", {})

                # Get tracking URL
                tracker = data.get("tracker", {})
                tracking_url = tracker.get("public_url", "")

                return ShippingLabel(
                    id=data.get("id"),
                    tracking_number=data.get("tracking_code", ""),
                    tracking_url=tracking_url,
                    label_url=postage_label.get("label_url", ""),
                    label_format=postage_label.get("label_file_type", label_format).lower(),
                    carrier=selected_rate.get("carrier", "").lower(),
                    service=selected_rate.get("service", ""),
                    rate=float(selected_rate.get("rate", 0)),
                    created_at=data.get("created_at", datetime.utcnow().isoformat()),
                )

        except Exception as e:
            raise Exception(f"Error purchasing label: {str(e)}")

    @staticmethod
    async def create_return_label(
        original_shipment_id: str,
        org_api_key: Optional[str] = None,
    ) -> ShippingLabel:
        """
        Create a return shipping label based on an original shipment.
        Swaps from/to addresses.

        Args:
            original_shipment_id: The original outbound shipment ID
            org_api_key: Optional organization-specific API key

        Returns:
            ShippingLabel for the return shipment
        """
        api_key = EasyPostService._get_api_key(org_api_key)
        if not api_key:
            raise ValueError("EasyPost API key not configured")

        try:
            # First, get the original shipment details
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{EasyPostService.EASYPOST_API_URL}/shipments/{original_shipment_id}",
                    headers=EasyPostService._get_headers(api_key),
                    timeout=30.0,
                )

                if response.status_code != 200:
                    raise Exception(f"Failed to get original shipment: {response.text}")

                original = response.json()

                # Create return shipment with swapped addresses
                return_shipment = {
                    "shipment": {
                        "from_address": original.get("to_address"),
                        "to_address": original.get("from_address"),
                        "parcel": original.get("parcel"),
                        "is_return": True,
                    }
                }

                response = await client.post(
                    f"{EasyPostService.EASYPOST_API_URL}/shipments",
                    headers=EasyPostService._get_headers(api_key),
                    json=return_shipment,
                    timeout=60.0,
                )

                if response.status_code != 201:
                    raise Exception(f"Failed to create return shipment: {response.text}")

                return_data = response.json()

                # Find cheapest rate with same carrier as original
                original_carrier = original.get("selected_rate", {}).get("carrier", "").lower()
                rates = return_data.get("rates", [])

                # Try to match original carrier, otherwise use cheapest
                selected_rate = None
                for rate in rates:
                    if rate.get("carrier", "").lower() == original_carrier:
                        if selected_rate is None or float(rate.get("rate", 999)) < float(selected_rate.get("rate", 999)):
                            selected_rate = rate

                if not selected_rate and rates:
                    selected_rate = min(rates, key=lambda r: float(r.get("rate", 999)))

                if not selected_rate:
                    raise Exception("No rates available for return shipment")

                # Buy the return label
                return await EasyPostService.buy_label(
                    return_data.get("id"),
                    selected_rate.get("id"),
                    org_api_key=org_api_key,
                )

        except Exception as e:
            raise Exception(f"Error creating return label: {str(e)}")

    @staticmethod
    async def get_tracking(
        tracking_number: str,
        carrier: Optional[str] = None,
        org_api_key: Optional[str] = None,
    ) -> TrackingInfo:
        """
        Get tracking information for a shipment.

        Args:
            tracking_number: The carrier tracking number
            carrier: Optional carrier code (helps with lookup)
            org_api_key: Optional organization-specific API key

        Returns:
            TrackingInfo with current status and events
        """
        api_key = EasyPostService._get_api_key(org_api_key)
        if not api_key:
            raise ValueError("EasyPost API key not configured")

        try:
            async with httpx.AsyncClient() as client:
                # Create or retrieve tracker
                tracker_data = {"tracking_code": tracking_number}
                if carrier:
                    tracker_data["carrier"] = EasyPostService.CARRIER_MAP.get(carrier.lower(), carrier.upper())

                response = await client.post(
                    f"{EasyPostService.EASYPOST_API_URL}/trackers",
                    headers=EasyPostService._get_headers(api_key),
                    json={"tracker": tracker_data},
                    timeout=30.0,
                )

                if response.status_code not in [200, 201]:
                    raise Exception(f"Failed to get tracking: {response.text}")

                data = response.json()

                events = []
                for event in data.get("tracking_details", []):
                    events.append(TrackingEvent(
                        status=event.get("status", ""),
                        message=event.get("message", ""),
                        location=event.get("tracking_location", {}).get("city", ""),
                        timestamp=event.get("datetime", ""),
                    ))

                # Most recent event first
                events.reverse()

                return TrackingInfo(
                    tracking_number=data.get("tracking_code", tracking_number),
                    carrier=data.get("carrier", carrier or "").lower(),
                    status=data.get("status", "unknown"),
                    estimated_delivery_date=data.get("est_delivery_date"),
                    events=events,
                )

        except Exception as e:
            raise Exception(f"Error getting tracking: {str(e)}")

    @staticmethod
    async def register_webhook(
        url: str,
        org_api_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Register a webhook URL for tracking updates.

        Args:
            url: The webhook URL to receive updates
            org_api_key: Optional organization-specific API key

        Returns:
            Dict with webhook details
        """
        api_key = EasyPostService._get_api_key(org_api_key)
        if not api_key:
            raise ValueError("EasyPost API key not configured")

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{EasyPostService.EASYPOST_API_URL}/webhooks",
                    headers=EasyPostService._get_headers(api_key),
                    json={"webhook": {"url": url}},
                    timeout=30.0,
                )

                if response.status_code != 201:
                    raise Exception(f"Failed to register webhook: {response.text}")

                return response.json()

        except Exception as e:
            raise Exception(f"Error registering webhook: {str(e)}")

    @staticmethod
    def get_package_dimensions_for_category(
        category: str,
        org_defaults: Optional[Dict[str, Any]] = None,
    ) -> PackageDimensions:
        """
        Get default package dimensions for a gear category.

        Args:
            category: Gear category (camera, lens, lighting, etc.)
            org_defaults: Optional organization-specific defaults

        Returns:
            PackageDimensions with appropriate sizes
        """
        # Check org defaults first
        if org_defaults and category.lower() in org_defaults:
            dims = org_defaults[category.lower()]
        elif category.lower() in DEFAULT_PACKAGE_DIMENSIONS:
            dims = DEFAULT_PACKAGE_DIMENSIONS[category.lower()]
        else:
            dims = DEFAULT_PACKAGE_DIMENSIONS["default"]

        return PackageDimensions(
            length=dims.get("length", 16),
            width=dims.get("width", 12),
            height=dims.get("height", 10),
            weight=dims.get("weight", 160),  # ounces
        )

    @staticmethod
    def calculate_combined_package(
        items: List[Dict[str, Any]],
        org_defaults: Optional[Dict[str, Any]] = None,
    ) -> PackageDimensions:
        """
        Calculate combined package dimensions for multiple items.
        Uses simple box-packing heuristic.

        Args:
            items: List of items with category and optionally quantity
            org_defaults: Optional organization-specific dimension defaults

        Returns:
            PackageDimensions for the combined package
        """
        if not items:
            return EasyPostService.get_package_dimensions_for_category("default", org_defaults)

        total_weight = 0
        max_length = 0
        max_width = 0
        total_height = 0

        for item in items:
            category = item.get("category", "default")
            quantity = item.get("quantity", 1)

            dims = EasyPostService.get_package_dimensions_for_category(category, org_defaults)

            # Add weight
            total_weight += dims.weight * quantity

            # For dimensions, use max L/W and stack heights
            max_length = max(max_length, dims.length)
            max_width = max(max_width, dims.width)
            total_height += dims.height * quantity

        return PackageDimensions(
            length=max_length,
            width=max_width,
            height=min(total_height, 48),  # Cap at 48 inches
            weight=total_weight,
        )
