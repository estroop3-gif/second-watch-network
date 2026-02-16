"""Google Maps Places API adapter for website discovery."""

import os
import requests
from typing import List, Dict

from sources.base import DiscoverySource


class GoogleMapsSource(DiscoverySource):
    """Discovers business websites via Google Places API (Text Search)."""

    def __init__(self):
        self.api_key = os.environ.get("GOOGLE_API_KEY", "")
        self.session = requests.Session()

    def search(self, query: str, location: str = "", max_results: int = 100,
               radius_miles: int = 50) -> List[Dict]:
        if not self.api_key:
            print("Google API key not configured, skipping Maps source")
            return []

        search_query = query
        if location:
            search_query = f"{query} in {location}"

        results = []
        seen_domains = set()
        next_page_token = None

        for _ in range(5):  # Max 5 pages (60 results from Places API)
            try:
                params = {
                    "query": search_query,
                    "key": self.api_key,
                }
                if next_page_token:
                    params = {"pagetoken": next_page_token, "key": self.api_key}

                resp = self.session.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params=params,
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()

                if data.get("status") != "OK":
                    print(f"Places API status: {data.get('status')}")
                    break

                for place in data.get("results", []):
                    place_id = place.get("place_id", "")
                    if not place_id:
                        continue

                    # Get website from Place Details
                    detail = self._get_place_details(place_id)
                    website = detail.get("website", "")

                    if not website:
                        continue

                    from urllib.parse import urlparse
                    domain = urlparse(website).netloc.lower().replace("www.", "")
                    if domain in seen_domains:
                        continue
                    seen_domains.add(domain)

                    addr = place.get("formatted_address", "")
                    results.append({
                        "name": place.get("name", ""),
                        "url": website,
                        "snippet": f"{place.get('name', '')} - {addr}",
                        "location": addr or location,
                        "raw": {
                            "place_id": place_id,
                            "rating": place.get("rating"),
                            "user_ratings_total": place.get("user_ratings_total"),
                            "types": place.get("types", []),
                            "phone": detail.get("formatted_phone_number", ""),
                        },
                    })

                    if len(results) >= max_results:
                        return results

                next_page_token = data.get("next_page_token")
                if not next_page_token:
                    break

                # Google requires a short delay before using next_page_token
                import time
                time.sleep(2)

            except Exception as e:
                print(f"Places API error: {e}")
                break

        return results

    def _get_place_details(self, place_id: str) -> dict:
        try:
            resp = self.session.get(
                "https://maps.googleapis.com/maps/api/place/details/json",
                params={
                    "place_id": place_id,
                    "fields": "website,formatted_phone_number",
                    "key": self.api_key,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("result", {})
        except Exception:
            return {}
