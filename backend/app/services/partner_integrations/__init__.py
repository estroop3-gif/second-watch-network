"""
Partner Integration Hooks
Phase 5A: Modular integration services for third-party distribution platforms.

These modules provide abstracted interfaces for:
- Social/AVOD platforms (YouTube, Vimeo)
- FAST/Linear syndication
- Venue/Theatrical distribution

Actual API calls are not implemented yet - these are scaffolds
that define the expected data shapes and workflows.
"""

from .base import PartnerIntegrationBase, ExportPackage, DeliveryResult
from .social_avod import SocialAVODIntegration, YouTubeIntegration, VimeoIntegration
from .fast_channel import FASTChannelIntegration, PlutoTVIntegration
from .venue import VenueIntegration, DCPIntegration, ProResIntegration

__all__ = [
    "PartnerIntegrationBase",
    "ExportPackage",
    "DeliveryResult",
    "SocialAVODIntegration",
    "YouTubeIntegration",
    "VimeoIntegration",
    "FASTChannelIntegration",
    "PlutoTVIntegration",
    "VenueIntegration",
    "DCPIntegration",
    "ProResIntegration",
]
