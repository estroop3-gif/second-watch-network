"""
Geocoding Service using AWS Location Service

Provides address geocoding and route distance calculation for mileage entries.
Uses AWS Location Service for geocoding and routing.
"""

import boto3
import os
from typing import Optional, Dict, Any, Tuple, List
from botocore.exceptions import ClientError

# AWS Location Service configuration
PLACE_INDEX_NAME = os.environ.get("AWS_LOCATION_PLACE_INDEX", "swn-place-index")
ROUTE_CALCULATOR_NAME = os.environ.get("AWS_LOCATION_ROUTE_CALCULATOR", "swn-route-calculator")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")


def get_location_client():
    """Get AWS Location Service client"""
    return boto3.client('location', region_name=AWS_REGION)


def search_places(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Search for places/addresses using AWS Location Service.
    Used for address autocomplete.

    Args:
        query: The search query (partial address)
        max_results: Maximum number of results to return

    Returns:
        List of place suggestions with address and coordinates
    """
    try:
        client = get_location_client()

        response = client.search_place_index_for_text(
            IndexName=PLACE_INDEX_NAME,
            Text=query,
            MaxResults=max_results,
            FilterCountries=['USA']
        )

        results = []
        for item in response.get('Results', []):
            place = item['Place']
            geometry = place['Geometry']['Point']
            results.append({
                'place_id': item.get('PlaceId', ''),
                'label': place.get('Label', ''),
                'lat': geometry[1],
                'lon': geometry[0],
                'street': place.get('Street'),
                'city': place.get('Municipality'),
                'state': place.get('Region'),
                'postal_code': place.get('PostalCode'),
            })
        return results
    except ClientError as e:
        print(f"[Geocoding] AWS Location Service error: {e}")
        return []
    except Exception as e:
        print(f"[Geocoding] Error searching places: {e}")
        return []


def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    """
    Forward geocode - convert address to coordinates using AWS Location Service.

    Args:
        address: The address string to geocode

    Returns:
        Dictionary with lat, lon, and display_name if found, None otherwise
    """
    try:
        client = get_location_client()

        response = client.search_place_index_for_text(
            IndexName=PLACE_INDEX_NAME,
            Text=address,
            MaxResults=1,
            FilterCountries=['USA']  # Limit to US addresses
        )

        results = response.get('Results', [])
        if not results:
            return None

        place = results[0]['Place']
        geometry = place['Geometry']['Point']

        # AWS returns [longitude, latitude], we need lat, lon
        return {
            'lat': geometry[1],
            'lon': geometry[0],
            'display_name': place.get('Label', address),
            'address_components': {
                'street': place.get('Street'),
                'city': place.get('Municipality'),
                'state': place.get('Region'),
                'postal_code': place.get('PostalCode'),
                'country': place.get('Country')
            }
        }
    except ClientError as e:
        print(f"[Geocoding] AWS Location Service error: {e}")
        return None
    except Exception as e:
        print(f"[Geocoding] Error geocoding address: {e}")
        return None


def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """
    Reverse geocode - convert coordinates to address.

    Args:
        lat: Latitude
        lon: Longitude

    Returns:
        Address string if found, None otherwise
    """
    try:
        client = get_location_client()

        response = client.search_place_index_for_position(
            IndexName=PLACE_INDEX_NAME,
            Position=[lon, lat],  # AWS expects [lon, lat]
            MaxResults=1
        )

        results = response.get('Results', [])
        if not results:
            return None

        return results[0]['Place'].get('Label')
    except ClientError as e:
        print(f"[Geocoding] AWS Location Service error: {e}")
        return None
    except Exception as e:
        print(f"[Geocoding] Error reverse geocoding: {e}")
        return None


def calculate_route_distance(
    start_lat: float,
    start_lon: float,
    end_lat: float,
    end_lon: float
) -> Optional[float]:
    """
    Calculate driving distance between two points using AWS Location Service.

    Args:
        start_lat: Starting latitude
        start_lon: Starting longitude
        end_lat: Ending latitude
        end_lon: Ending longitude

    Returns:
        Distance in miles if calculated, None otherwise
    """
    try:
        client = get_location_client()

        response = client.calculate_route(
            CalculatorName=ROUTE_CALCULATOR_NAME,
            DeparturePosition=[start_lon, start_lat],  # AWS expects [lon, lat]
            DestinationPosition=[end_lon, end_lat],
            TravelMode='Car',
            DistanceUnit='Miles'
        )

        # Get the summary distance
        summary = response.get('Summary', {})
        distance = summary.get('Distance')

        if distance is not None:
            return round(distance, 2)
        return None
    except ClientError as e:
        print(f"[Geocoding] AWS Location Service routing error: {e}")
        return None
    except Exception as e:
        print(f"[Geocoding] Error calculating route: {e}")
        return None


def calculate_mileage_between_addresses(
    start_address: str,
    end_address: str
) -> Optional[Dict[str, Any]]:
    """
    Geocode two addresses and calculate the driving distance between them.

    Args:
        start_address: Starting address string
        end_address: Ending address string

    Returns:
        Dictionary with start/end geocoded info and distance_miles, or None if failed
    """
    # Geocode both addresses
    start = geocode_address(start_address)
    if not start:
        return None

    end = geocode_address(end_address)
    if not end:
        return None

    # Calculate route distance
    distance = calculate_route_distance(
        start['lat'], start['lon'],
        end['lat'], end['lon']
    )

    return {
        'start': start,
        'end': end,
        'distance_miles': distance,
        'is_round_trip': False
    }
