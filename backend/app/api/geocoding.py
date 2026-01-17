"""
Geocoding API Routes - Proxy to self-hosted Nominatim service

Provides:
- Address autocomplete (search as you type)
- Forward geocoding (address -> coordinates)
- Reverse geocoding (coordinates -> address)

All requests are cached to reduce load on Nominatim.
"""

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import httpx
import hashlib
import os
from datetime import datetime

from app.core.database import get_client, execute_query, execute_single
from app.core.config import settings

router = APIRouter()

# Configuration from settings
NOMINATIM_URL = settings.NOMINATIM_URL
CACHE_TTL_HOURS = settings.GEOCODING_CACHE_TTL_HOURS


# =============================================================================
# Models
# =============================================================================

class AddressComponents(BaseModel):
    """Structured address components"""
    house_number: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    postcode: Optional[str] = None
    county: Optional[str] = None
    country: str = "United States"
    country_code: str = "us"


class GeocodingResult(BaseModel):
    """Single geocoding result"""
    place_id: str
    display_name: str
    address: AddressComponents
    lat: float
    lng: float
    importance: float = 0.0
    type: Optional[str] = None
    category: Optional[str] = None


class AutocompleteResponse(BaseModel):
    """Response for autocomplete endpoint"""
    results: List[GeocodingResult]
    cached: bool = False
    service_available: bool = True


class ForwardGeocodeResponse(BaseModel):
    """Response for forward geocoding"""
    results: List[GeocodingResult]
    cached: bool = False
    service_available: bool = True


class ReverseGeocodeResponse(BaseModel):
    """Response for reverse geocoding"""
    result: Optional[GeocodingResult] = None
    cached: bool = False
    service_available: bool = True


# =============================================================================
# Helper Functions
# =============================================================================

def generate_cache_key(query_type: str, query_input: str) -> str:
    """Generate a hash key for caching"""
    normalized = f"{query_type}:{query_input.lower().strip()}"
    return hashlib.sha256(normalized.encode()).hexdigest()[:32]


def parse_nominatim_address(address: Dict[str, Any]) -> AddressComponents:
    """Parse Nominatim address object into structured components"""
    # State code mapping for US states
    state_codes = {
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
        "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
        "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
        "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
        "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
        "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
        "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
        "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
        "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
        "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
        "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC"
    }

    state = address.get("state", "")
    state_code = state_codes.get(state.lower(), "") if state else ""

    # Try to get city from various Nominatim fields
    city = (
        address.get("city") or
        address.get("town") or
        address.get("village") or
        address.get("municipality") or
        address.get("hamlet") or
        ""
    )

    return AddressComponents(
        house_number=address.get("house_number"),
        street=address.get("road") or address.get("street"),
        city=city,
        state=state,
        state_code=state_code,
        postcode=address.get("postcode"),
        county=address.get("county"),
        country=address.get("country", "United States"),
        country_code=address.get("country_code", "us")
    )


def parse_nominatim_result(item: Dict[str, Any]) -> GeocodingResult:
    """Parse a Nominatim search/reverse result"""
    address_data = item.get("address", {})

    return GeocodingResult(
        place_id=str(item.get("place_id", "")),
        display_name=item.get("display_name", ""),
        address=parse_nominatim_address(address_data),
        lat=float(item.get("lat", 0)),
        lng=float(item.get("lon", 0)),
        importance=float(item.get("importance", 0)),
        type=item.get("type"),
        category=item.get("category")
    )


async def get_cached_result(query_hash: str) -> Optional[Dict[str, Any]]:
    """Check cache for existing result"""
    client = get_client()
    try:
        result = client.table("geocoding_cache").select(
            "result_json"
        ).eq("query_hash", query_hash).execute()

        if result.data and len(result.data) > 0:
            # Update hit count and last accessed
            client.table("geocoding_cache").update({
                "hit_count": result.data[0].get("hit_count", 0) + 1,
                "last_accessed_at": datetime.utcnow().isoformat()
            }).eq("query_hash", query_hash).execute()

            return result.data[0]["result_json"]
    except Exception as e:
        print(f"Cache lookup error: {e}")
    return None


async def save_to_cache(query_hash: str, query_type: str, query_input: str, result_json: Dict[str, Any]):
    """Save result to cache"""
    client = get_client()
    try:
        client.table("geocoding_cache").upsert({
            "query_hash": query_hash,
            "query_type": query_type,
            "query_input": query_input,
            "result_json": result_json,
            "created_at": datetime.utcnow().isoformat(),
            "last_accessed_at": datetime.utcnow().isoformat(),
            "hit_count": 1
        }).execute()
    except Exception as e:
        print(f"Cache save error: {e}")


async def call_nominatim(endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """Make request to Nominatim service"""
    url = f"{NOMINATIM_URL}/{endpoint}"
    params["format"] = "jsonv2"
    params["addressdetails"] = 1

    # Add US country code bias for better results
    if "countrycodes" not in params:
        params["countrycodes"] = "us"

    # User-Agent is required by Nominatim usage policy
    headers = {
        "User-Agent": "SecondWatchNetwork/1.0 (https://secondwatchnetwork.com)"
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()


# =============================================================================
# Auth Helper
# =============================================================================

async def get_current_user_from_token(authorization: str = Header(None)) -> Dict[str, Any]:
    """Extract and validate user from Bearer token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = authorization.replace("Bearer ", "")

    try:
        from app.core.cognito import CognitoAuth
        user = CognitoAuth.verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": user.get("user_id") or user.get("sub") or user.get("id")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


# =============================================================================
# API Endpoints
# =============================================================================

# Place types that represent cities/towns for filtering
CITY_PLACE_TYPES = {
    "city", "town", "village", "municipality", "hamlet",
    "suburb", "borough", "neighbourhood", "quarter"
}


@router.get("/autocomplete", response_model=AutocompleteResponse)
async def autocomplete_address(
    q: str = Query(..., min_length=3, max_length=200, description="Search query"),
    limit: int = Query(5, ge=1, le=10, description="Maximum number of results"),
    mode: str = Query("address", description="Search mode: 'address' for full addresses, 'city' for cities only"),
    authorization: str = Header(None)
):
    """
    Address autocomplete - returns suggestions as user types.

    Requires minimum 3 characters. Results are filtered to US addresses.
    Results are cached for 7 days.

    Mode options:
    - 'address': Returns full address results (default)
    - 'city': Returns only city/town results for location fields
    """
    await get_current_user_from_token(authorization)

    # Check cache first
    cache_key = generate_cache_key("autocomplete", f"{q}:{limit}:{mode}")
    cached = await get_cached_result(cache_key)

    if cached:
        return AutocompleteResponse(
            results=[GeocodingResult(**r) for r in cached.get("results", [])],
            cached=True,
            service_available=True
        )

    try:
        # Build Nominatim params based on mode
        params = {
            "q": q,
            "countrycodes": "us"
        }

        if mode == "city":
            # For city mode, use featuretype to get settlements and request more results to filter
            params["featuretype"] = "settlement"
            params["limit"] = limit * 3  # Get more to filter down
        else:
            params["limit"] = limit

        # Call Nominatim
        data = await call_nominatim("search", params)

        # Parse results
        results = []
        if isinstance(data, list):
            for item in data:
                try:
                    parsed = parse_nominatim_result(item)

                    # For city mode, filter to only include city-level results
                    if mode == "city":
                        item_type = item.get("type", "")
                        item_class = item.get("class", "")
                        # Include if it's a place/boundary type that represents a city
                        if item_type in CITY_PLACE_TYPES or item_class in ["place", "boundary"]:
                            # For city results, simplify the display name to just city, state
                            if parsed.address.city and parsed.address.state_code:
                                parsed.display_name = f"{parsed.address.city}, {parsed.address.state_code}"
                            results.append(parsed)
                    else:
                        results.append(parsed)

                    # Stop when we have enough results
                    if len(results) >= limit:
                        break
                except Exception as e:
                    print(f"Error parsing result: {e}")
                    continue

        # Cache results
        cache_data = {"results": [r.model_dump() for r in results]}
        await save_to_cache(cache_key, "autocomplete", q, cache_data)

        return AutocompleteResponse(
            results=results,
            cached=False,
            service_available=True
        )

    except httpx.ConnectError:
        return AutocompleteResponse(
            results=[],
            cached=False,
            service_available=False
        )
    except (httpx.HTTPStatusError, ValueError, TypeError) as e:
        # JSON decode errors, HTTP errors, etc. - service unavailable
        print(f"Geocoding service unavailable: {e}")
        return AutocompleteResponse(
            results=[],
            cached=False,
            service_available=False
        )
    except Exception as e:
        print(f"Geocoding error: {e}")
        # Return service unavailable rather than 500 error
        return AutocompleteResponse(
            results=[],
            cached=False,
            service_available=False
        )


@router.get("/forward", response_model=ForwardGeocodeResponse)
async def forward_geocode(
    address: str = Query(..., min_length=5, max_length=500, description="Full address to geocode"),
    limit: int = Query(1, ge=1, le=5, description="Maximum number of results"),
    authorization: str = Header(None)
):
    """
    Forward geocoding - convert address to lat/lng coordinates.

    Provide a full address string. Returns coordinates and structured address.
    Results are cached for 7 days.
    """
    await get_current_user_from_token(authorization)

    # Check cache first
    cache_key = generate_cache_key("forward", address)
    cached = await get_cached_result(cache_key)

    if cached:
        return ForwardGeocodeResponse(
            results=[GeocodingResult(**r) for r in cached.get("results", [])],
            cached=True,
            service_available=True
        )

    try:
        # Call Nominatim
        data = await call_nominatim("search", {
            "q": address,
            "limit": limit,
            "countrycodes": "us"
        })

        # Parse results
        results = []
        if isinstance(data, list):
            for item in data:
                try:
                    results.append(parse_nominatim_result(item))
                except Exception as e:
                    print(f"Error parsing result: {e}")
                    continue

        # Cache results
        cache_data = {"results": [r.model_dump() for r in results]}
        await save_to_cache(cache_key, "forward", address, cache_data)

        return ForwardGeocodeResponse(
            results=results,
            cached=False,
            service_available=True
        )

    except httpx.ConnectError:
        return ForwardGeocodeResponse(
            results=[],
            cached=False,
            service_available=False
        )
    except (httpx.HTTPStatusError, ValueError, TypeError) as e:
        print(f"Forward geocoding service unavailable: {e}")
        return ForwardGeocodeResponse(
            results=[],
            cached=False,
            service_available=False
        )
    except Exception as e:
        print(f"Forward geocoding error: {e}")
        return ForwardGeocodeResponse(
            results=[],
            cached=False,
            service_available=False
        )


@router.get("/reverse", response_model=ReverseGeocodeResponse)
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude"),
    authorization: str = Header(None)
):
    """
    Reverse geocoding - convert lat/lng to address.

    Used for "Use My Location" feature to get address from GPS coordinates.
    Results are cached for 7 days.
    """
    await get_current_user_from_token(authorization)

    # Check cache first (round to 5 decimal places for caching)
    rounded_lat = round(lat, 5)
    rounded_lng = round(lng, 5)
    cache_key = generate_cache_key("reverse", f"{rounded_lat},{rounded_lng}")
    cached = await get_cached_result(cache_key)

    if cached and cached.get("result"):
        return ReverseGeocodeResponse(
            result=GeocodingResult(**cached["result"]),
            cached=True,
            service_available=True
        )

    try:
        # Call Nominatim
        data = await call_nominatim("reverse", {
            "lat": lat,
            "lon": lng
        })

        # Parse result (reverse returns single object, not array)
        result = None
        if data and isinstance(data, dict) and "lat" in data:
            try:
                result = parse_nominatim_result(data)
            except Exception as e:
                print(f"Error parsing reverse result: {e}")

        # Cache result
        cache_data = {"result": result.model_dump() if result else None}
        await save_to_cache(cache_key, "reverse", f"{lat},{lng}", cache_data)

        return ReverseGeocodeResponse(
            result=result,
            cached=False,
            service_available=True
        )

    except httpx.ConnectError:
        return ReverseGeocodeResponse(
            result=None,
            cached=False,
            service_available=False
        )
    except (httpx.HTTPStatusError, ValueError, TypeError) as e:
        print(f"Reverse geocoding service unavailable: {e}")
        return ReverseGeocodeResponse(
            result=None,
            cached=False,
            service_available=False
        )
    except Exception as e:
        print(f"Reverse geocoding error: {e}")
        return ReverseGeocodeResponse(
            result=None,
            cached=False,
            service_available=False
        )


class AWSPlaceResult(BaseModel):
    """AWS Location Service place result"""
    place_id: str
    label: str
    lat: float
    lon: float
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None


class AWSAutocompleteResponse(BaseModel):
    """Response for AWS autocomplete endpoint"""
    results: List[AWSPlaceResult]
    service_available: bool = True


@router.get("/aws/autocomplete", response_model=AWSAutocompleteResponse)
async def aws_autocomplete_address(
    q: str = Query(..., min_length=3, max_length=200, description="Search query"),
    limit: int = Query(5, ge=1, le=10, description="Maximum number of results"),
    authorization: str = Header(None)
):
    """
    Address autocomplete using AWS Location Service.

    Uses the AWS Places API for accurate US address search.
    This is preferred for production use over Nominatim.
    """
    await get_current_user_from_token(authorization)

    try:
        from app.services.geocoding import search_places
        aws_results = search_places(q, max_results=limit)

        results = [
            AWSPlaceResult(
                place_id=r.get('place_id', ''),
                label=r.get('label', ''),
                lat=r.get('lat', 0),
                lon=r.get('lon', 0),
                street=r.get('street'),
                city=r.get('city'),
                state=r.get('state'),
                postal_code=r.get('postal_code')
            )
            for r in aws_results
        ]

        return AWSAutocompleteResponse(
            results=results,
            service_available=True
        )
    except Exception as e:
        print(f"[AWS Geocoding] Error: {e}")
        return AWSAutocompleteResponse(
            results=[],
            service_available=False
        )


@router.get("/status")
async def geocoding_status():
    """
    Check if the geocoding service is available.

    Does not require authentication.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{NOMINATIM_URL}/status")
            if response.status_code == 200:
                return {
                    "status": "available",
                    "nominatim_url": NOMINATIM_URL,
                    "message": "Nominatim service is running"
                }
            else:
                return {
                    "status": "degraded",
                    "nominatim_url": NOMINATIM_URL,
                    "message": f"Nominatim returned status {response.status_code}"
                }
    except httpx.ConnectError:
        return {
            "status": "unavailable",
            "nominatim_url": NOMINATIM_URL,
            "message": "Cannot connect to Nominatim service"
        }
    except Exception as e:
        return {
            "status": "error",
            "nominatim_url": NOMINATIM_URL,
            "message": str(e)
        }
