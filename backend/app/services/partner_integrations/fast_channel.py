"""
FAST Channel Integrations
Free Ad-Supported Streaming TV channel syndication.

These are scaffold implementations for generating playlists and manifest
files that can be handed off to FAST channel partners.
"""

import logging
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from .base import (
    PartnerIntegrationBase,
    ExportPackage,
    DeliveryResult,
    DeliveryStatus,
)

logger = logging.getLogger(__name__)


class FASTChannelIntegration(PartnerIntegrationBase):
    """Base class for FAST channel syndication."""

    @property
    def platform_key(self) -> str:
        return "fast_generic"

    @property
    def platform_name(self) -> str:
        return "FAST Channel (Generic)"

    def validate_package(self, package: ExportPackage) -> Dict[str, Any]:
        """Validate package for FAST channel delivery."""
        errors = []
        warnings = []

        # Required fields for FAST
        if not package.title:
            errors.append({"field": "title", "message": "Title is required"})

        if not package.video_url:
            errors.append({"field": "video_url", "message": "Video URL is required"})

        if not package.content_rating:
            warnings.append({"field": "content_rating", "message": "Content rating recommended for FAST"})

        if package.video_duration_seconds <= 0:
            errors.append({"field": "duration", "message": "Duration is required"})

        # FAST typically requires specific resolutions
        valid_resolutions = ["1920x1080", "1280x720"]
        if package.video_resolution not in valid_resolutions:
            warnings.append({
                "field": "resolution",
                "message": f"Resolution {package.video_resolution} may not be optimal. Recommended: 1080p or 720p"
            })

        # Genre/category required for EPG
        if not package.genre:
            warnings.append({"field": "genre", "message": "Genre recommended for EPG listings"})

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }

    def prepare_metadata(self, package: ExportPackage) -> Dict[str, Any]:
        """Prepare metadata for FAST channel syndication."""
        return {
            "content_id": package.export_job_id,
            "title": package.title,
            "description": package.description[:500],
            "duration_seconds": package.video_duration_seconds,
            "content_rating": package.content_rating or "TV-PG",
            "genre": package.genre or "Entertainment",
            "category": package.category,
            "thumbnail_url": package.thumbnail_url,
            "video_url": package.video_url,
            "captions": package.captions,
            "publish_date": datetime.utcnow().isoformat(),
            # FAST-specific
            "ad_break_positions": self._calculate_ad_breaks(package.video_duration_seconds),
            "available_from": datetime.utcnow().isoformat(),
            "available_until": (datetime.utcnow() + timedelta(days=365)).isoformat(),
        }

    def _calculate_ad_breaks(self, duration_seconds: int) -> List[int]:
        """Calculate natural ad break positions based on duration."""
        if duration_seconds < 600:  # Less than 10 minutes
            return []

        breaks = []
        # Add breaks every 10-15 minutes
        interval = 12 * 60  # 12 minutes
        position = interval

        while position < duration_seconds - 120:  # Stop 2 min before end
            breaks.append(position)
            position += interval

        return breaks

    def generate_playlist_entry(self, package: ExportPackage) -> Dict[str, Any]:
        """Generate a playlist entry for this content."""
        metadata = self.prepare_metadata(package)
        return {
            "type": "program",
            "id": metadata["content_id"],
            "title": metadata["title"],
            "duration": metadata["duration_seconds"],
            "rating": metadata["content_rating"],
            "genre": metadata["genre"],
            "source": {
                "type": "vod",
                "url": metadata["video_url"],
            },
            "ad_breaks": [
                {"position": pos, "type": "midroll"}
                for pos in metadata["ad_break_positions"]
            ],
            "metadata": {
                "description": metadata["description"],
                "thumbnail": metadata["thumbnail_url"],
            }
        }

    def generate_mrss_entry(self, package: ExportPackage) -> str:
        """Generate an MRSS (Media RSS) entry for content feeds."""
        metadata = self.prepare_metadata(package)

        mrss = f"""
<item>
  <title><![CDATA[{metadata['title']}]]></title>
  <description><![CDATA[{metadata['description']}]]></description>
  <guid isPermaLink="false">{metadata['content_id']}</guid>
  <pubDate>{metadata['publish_date']}</pubDate>
  <media:content url="{metadata['video_url']}" duration="{metadata['duration_seconds']}" />
  <media:thumbnail url="{metadata['thumbnail_url']}" />
  <media:rating scheme="urn:v-chip">{metadata['content_rating']}</media:rating>
  <media:category>{metadata['genre']}</media:category>
</item>
""".strip()
        return mrss

    async def deliver(self, package: ExportPackage) -> DeliveryResult:
        """
        Prepare FAST channel delivery package.

        NOTE: This generates the manifest/playlist data but does not
        perform actual delivery to a FAST partner.
        """
        validation = self.validate_package(package)
        if not validation["valid"]:
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.FAILED,
                message="FAST validation failed",
                error_details={"errors": validation["errors"]}
            )

        # Generate manifest data
        playlist_entry = self.generate_playlist_entry(package)
        mrss = self.generate_mrss_entry(package)

        logger.info(
            "fast_channel_delivery_prepared",
            platform=self.platform_key,
            job_id=package.export_job_id,
            title=package.title,
            duration=package.video_duration_seconds
        )

        return DeliveryResult(
            success=True,
            status=DeliveryStatus.COMPLETED,
            message="FAST manifest generated (ready for partner handoff)",
            raw_response={
                "simulated": True,
                "platform": self.platform_key,
                "playlist_entry": playlist_entry,
                "mrss_snippet": mrss,
            }
        )


class PlutoTVIntegration(FASTChannelIntegration):
    """Pluto TV-specific integration."""

    @property
    def platform_key(self) -> str:
        return "fast_plutotv"

    @property
    def platform_name(self) -> str:
        return "Pluto TV"

    def validate_package(self, package: ExportPackage) -> Dict[str, Any]:
        """Pluto TV-specific validation."""
        result = super().validate_package(package)

        # Pluto requires exactly 1080p
        if package.video_resolution != "1920x1080":
            result["errors"].append({
                "field": "resolution",
                "message": "Pluto TV requires exactly 1920x1080 resolution"
            })
            result["valid"] = False

        # Pluto requires h264
        if package.video_codec != "h264":
            result["errors"].append({
                "field": "codec",
                "message": "Pluto TV requires H.264 codec"
            })
            result["valid"] = False

        # Content rating is required
        if not package.content_rating:
            result["errors"].append({
                "field": "content_rating",
                "message": "Content rating is required for Pluto TV"
            })
            result["valid"] = False

        # Minimum duration
        if package.video_duration_seconds < 180:  # 3 minutes
            result["warnings"].append({
                "field": "duration",
                "message": "Content under 3 minutes may not be accepted"
            })

        return result

    def prepare_metadata(self, package: ExportPackage) -> Dict[str, Any]:
        """Prepare Pluto TV-specific metadata."""
        base = super().prepare_metadata(package)

        # Pluto-specific fields
        base.update({
            "pluto_category": self._map_to_pluto_category(package.genre),
            "pluto_rating": self._map_to_pluto_rating(package.content_rating),
            "series_info": package.platform_metadata.get("series_info"),
            "episode_info": package.platform_metadata.get("episode_info"),
        })

        return base

    def _map_to_pluto_category(self, genre: Optional[str]) -> str:
        """Map genre to Pluto TV category."""
        category_map = {
            "action": "Action",
            "comedy": "Comedy",
            "documentary": "Documentaries",
            "drama": "Drama",
            "faith": "Faith & Spirituality",
            "horror": "Horror",
            "music": "Music",
            "sports": "Sports",
            "thriller": "Thrillers",
        }
        return category_map.get((genre or "").lower(), "Entertainment")

    def _map_to_pluto_rating(self, rating: Optional[str]) -> str:
        """Map content rating to Pluto TV format."""
        if not rating:
            return "TV-PG"
        # Pluto uses US TV ratings
        valid_ratings = ["TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"]
        if rating.upper() in valid_ratings:
            return rating.upper()
        # Map film ratings to TV ratings
        film_to_tv = {
            "G": "TV-G",
            "PG": "TV-PG",
            "PG-13": "TV-14",
            "R": "TV-MA",
            "NC-17": "TV-MA",
        }
        return film_to_tv.get(rating.upper(), "TV-PG")

    def generate_pluto_manifest(self, packages: List[ExportPackage]) -> Dict[str, Any]:
        """Generate a complete Pluto TV channel manifest."""
        programs = []
        total_duration = 0

        for pkg in packages:
            entry = self.generate_playlist_entry(pkg)
            entry["pluto_id"] = f"swn_{pkg.world_id}_{pkg.episode_id or 'full'}"
            programs.append(entry)
            total_duration += pkg.video_duration_seconds

        return {
            "channel": {
                "name": "Second Watch Network",
                "description": "Faith-driven independent cinema",
                "logo_url": "https://secondwatchnetwork.com/logo.png",
                "category": "Faith & Spirituality",
            },
            "programs": programs,
            "total_duration_seconds": total_duration,
            "generated_at": datetime.utcnow().isoformat(),
        }

    async def deliver(self, package: ExportPackage) -> DeliveryResult:
        """Prepare Pluto TV delivery package."""
        validation = self.validate_package(package)
        if not validation["valid"]:
            return DeliveryResult(
                success=False,
                status=DeliveryStatus.FAILED,
                message="Pluto TV validation failed",
                error_details={"errors": validation["errors"]}
            )

        metadata = self.prepare_metadata(package)
        playlist_entry = self.generate_playlist_entry(package)

        logger.info(
            "pluto_tv_delivery_prepared",
            job_id=package.export_job_id,
            title=package.title,
            category=metadata.get("pluto_category")
        )

        return DeliveryResult(
            success=True,
            status=DeliveryStatus.COMPLETED,
            message="Pluto TV manifest generated",
            raw_response={
                "simulated": True,
                "platform": "pluto_tv",
                "metadata": metadata,
                "playlist_entry": playlist_entry,
            }
        )
