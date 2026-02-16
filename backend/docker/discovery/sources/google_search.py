"""Google Custom Search API adapter for website discovery."""

import os
import requests
from typing import List, Dict
from urllib.parse import urlparse

from sources.base import DiscoverySource


class GoogleSearchSource(DiscoverySource):
    """Discovers business websites via Google Custom Search Engine API."""

    def __init__(self):
        self.api_key = os.environ.get("GOOGLE_API_KEY", "")
        self.cse_id = os.environ.get("GOOGLE_CSE_ID", "")
        self.session = requests.Session()

    def search(self, query: str, location: str = "", max_results: int = 100,
               radius_miles: int = 50) -> List[Dict]:
        if not self.api_key or not self.cse_id:
            print("Google Search API credentials not configured, skipping")
            return []

        search_query = query
        if location:
            search_query = f"{query} {location}"

        results = []
        seen_domains = set()

        # Google CSE returns max 10 per request, paginate up to max_results
        for start in range(1, min(max_results, 100) + 1, 10):
            try:
                resp = self.session.get(
                    "https://www.googleapis.com/customsearch/v1",
                    params={
                        "key": self.api_key,
                        "cx": self.cse_id,
                        "q": search_query,
                        "start": start,
                        "num": 10,
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()

                items = data.get("items", [])
                if not items:
                    break

                for item in items:
                    url = item.get("link", "")
                    if not url:
                        continue

                    domain = urlparse(url).netloc.lower().replace("www.", "")
                    if domain in seen_domains:
                        continue
                    seen_domains.add(domain)

                    results.append({
                        "name": item.get("title", "").split(" - ")[0].split(" | ")[0].strip(),
                        "url": url,
                        "snippet": item.get("snippet", ""),
                        "location": location,
                        "raw": {
                            "title": item.get("title", ""),
                            "displayLink": item.get("displayLink", ""),
                            "formattedUrl": item.get("formattedUrl", ""),
                            "pagemap": item.get("pagemap", {}),
                        },
                    })

                    if len(results) >= max_results:
                        return results

            except Exception as e:
                print(f"Google Search API error (start={start}): {e}")
                break

        return results
