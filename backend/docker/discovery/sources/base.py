"""Abstract base class for discovery source adapters."""

from abc import ABC, abstractmethod
from typing import List, Dict


class DiscoverySource(ABC):
    """Base class for discovery source adapters.
    Each adapter queries an external API to find business websites.
    """

    @abstractmethod
    def search(self, query: str, location: str = "", max_results: int = 100,
               radius_miles: int = 50) -> List[Dict]:
        """Search for businesses matching the query.

        Returns list of dicts with keys:
            name: str - Company/business name
            url: str - Website URL
            snippet: str - Description or snippet
            location: str - Location string
            raw: dict - Raw response data from the API
        """
        pass
