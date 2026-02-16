from sources.base import DiscoverySource
from sources.google_search import GoogleSearchSource
from sources.google_maps import GoogleMapsSource

SOURCE_REGISTRY = {
    "google_search": GoogleSearchSource,
    "google_maps": GoogleMapsSource,
}

__all__ = ["DiscoverySource", "SOURCE_REGISTRY"]
