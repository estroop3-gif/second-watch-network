"""
Base Partner Integration
Defines the interface and common structures for all partner integrations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, List, Optional
from enum import Enum


class DeliveryStatus(str, Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ExportPackage:
    """Represents a content package ready for delivery to a partner."""
    # Identification
    export_job_id: str
    world_id: str
    episode_id: Optional[str] = None

    # Content metadata
    title: str = ""
    description: str = ""
    tags: List[str] = field(default_factory=list)
    thumbnail_url: Optional[str] = None
    captions: List[Dict[str, str]] = field(default_factory=list)  # [{"language": "en", "url": "..."}]

    # Technical specs
    video_url: str = ""
    video_codec: str = "h264"
    video_resolution: str = "1920x1080"
    video_duration_seconds: int = 0
    video_bitrate_kbps: int = 0

    audio_codec: str = "aac"
    audio_channels: int = 2
    audio_sample_rate: int = 48000

    # Content classification
    content_rating: Optional[str] = None
    genre: Optional[str] = None
    category: Optional[str] = None

    # Rights and scheduling
    publish_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    is_public: bool = True

    # Additional platform-specific metadata
    platform_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DeliveryResult:
    """Result of attempting to deliver content to a partner."""
    success: bool
    status: DeliveryStatus
    message: str = ""

    # External platform references
    external_id: Optional[str] = None
    external_url: Optional[str] = None

    # Processing info
    processing_id: Optional[str] = None  # For async processing
    estimated_completion: Optional[datetime] = None

    # Error details
    error_code: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None

    # Raw response for debugging
    raw_response: Optional[Dict[str, Any]] = None


class PartnerIntegrationBase(ABC):
    """
    Base class for all partner integrations.

    Subclasses should implement platform-specific logic while
    adhering to this common interface.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the integration.

        Args:
            config: Platform-specific configuration (API keys, endpoints, etc.)
        """
        self.config = config or {}
        self._initialized = False

    @property
    @abstractmethod
    def platform_key(self) -> str:
        """Unique identifier for this platform."""
        pass

    @property
    @abstractmethod
    def platform_name(self) -> str:
        """Human-readable platform name."""
        pass

    @abstractmethod
    def validate_package(self, package: ExportPackage) -> Dict[str, Any]:
        """
        Validate that a package meets platform requirements.

        Returns:
            {
                "valid": bool,
                "errors": [{"field": str, "message": str}],
                "warnings": [{"field": str, "message": str}]
            }
        """
        pass

    @abstractmethod
    def prepare_metadata(self, package: ExportPackage) -> Dict[str, Any]:
        """
        Transform package metadata into platform-specific format.

        Returns:
            Platform-formatted metadata dictionary
        """
        pass

    @abstractmethod
    async def deliver(self, package: ExportPackage) -> DeliveryResult:
        """
        Deliver content to the platform.

        This is the main entry point for content delivery.
        Implementations should handle the full workflow:
        1. Validate the package
        2. Prepare metadata
        3. Upload/transfer content
        4. Return result

        NOTE: Actual API calls are not implemented yet.
        This method returns a simulated result for scaffolding purposes.
        """
        pass

    async def check_status(self, external_id: str) -> DeliveryResult:
        """
        Check the status of a previously submitted delivery.

        Args:
            external_id: The platform's ID for the content

        Returns:
            Current status of the delivery
        """
        # Default implementation - override for async platforms
        return DeliveryResult(
            success=True,
            status=DeliveryStatus.COMPLETED,
            message="Status check not implemented for this platform"
        )

    def get_required_metadata_fields(self) -> List[str]:
        """Get list of required metadata fields for this platform."""
        return ["title"]

    def get_supported_video_codecs(self) -> List[str]:
        """Get list of supported video codecs."""
        return ["h264"]

    def get_max_resolution(self) -> str:
        """Get maximum supported resolution."""
        return "1920x1080"

    def get_max_file_size_bytes(self) -> Optional[int]:
        """Get maximum file size in bytes, or None for unlimited."""
        return None

    def supports_captions(self) -> bool:
        """Whether the platform supports captions/subtitles."""
        return False

    def supports_scheduled_publishing(self) -> bool:
        """Whether the platform supports scheduled publishing."""
        return False
