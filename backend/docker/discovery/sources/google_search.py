"""Serper.dev Google Search adapter for website discovery."""

import os
import requests
from typing import List, Dict
from urllib.parse import urlparse

from sources.base import DiscoverySource


class GoogleSearchSource(DiscoverySource):
    """Discovers business websites via Serper.dev (Google Search results)."""

    def __init__(self):
        self.api_key = os.environ.get("SERPER_API_KEY", "")
        self.session = requests.Session()

    def search(self, query: str, location: str = "", max_results: int = 100,
               radius_miles: int = 50) -> List[Dict]:
        if not self.api_key:
            print("Serper API key not configured, skipping")
            return []

        search_query = query
        if location:
            search_query = f"{query} {location}"

        results = []
        seen_domains = set()

        # Serper returns up to 100 results per request
        num = min(max_results, 100)

        try:
            resp = self.session.post(
                "https://google.serper.dev/search",
                headers={
                    "X-API-KEY": self.api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "q": search_query,
                    "num": num,
                },
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            items = data.get("organic", [])

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
                        "displayLink": domain,
                        "formattedUrl": url,
                        "position": item.get("position", 0),
                    },
                })

                if len(results) >= max_results:
                    break

        except Exception as e:
            print(f"Serper API error: {e}")

        return results
