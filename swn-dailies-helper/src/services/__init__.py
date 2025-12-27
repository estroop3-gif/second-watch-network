"""Services for the SWN Dailies Helper."""

from src.services.config import ConfigManager
from src.services.card_reader import CardReader
from src.services.ffmpeg_encoder import FFmpegEncoder, ProxySettings
from src.services.card_fingerprint import CardFingerprintService, CardFingerprint, OffloadRecord
from src.services.metadata_extractor import MetadataExtractor, ClipMetadata
from src.services.qc_checker import QCChecker, QCResult, QCSummary, QCFlag
from src.services.report_generator import ReportGenerator, OffloadReportData
from src.services.offload_manifest import OffloadManifestService, OffloadManifest, OffloadedFile
from src.services.checksum import (
    calculate_xxh64,
    verify_checksum,
    compute_checksum_safe,
    verify_copy,
    batch_compute,
    batch_verify,
    ChecksumResult,
    VerificationResult,
    check_xxhash_available,
)
# Professional media tool services
from src.services.binary_manager import BinaryManager, get_binary_manager
from src.services.mediainfo_service import MediaInfoService, get_mediainfo_service
from src.services.exiftool_service import ExifToolService, get_exiftool_service
from src.services.smart_service import SmartService, get_smart_service
from src.services.mhl_service import MHLService, get_mhl_service

__all__ = [
    "ConfigManager",
    "CardReader",
    "FFmpegEncoder",
    "ProxySettings",
    "CardFingerprintService",
    "CardFingerprint",
    "OffloadRecord",
    "MetadataExtractor",
    "ClipMetadata",
    "QCChecker",
    "QCResult",
    "QCSummary",
    "QCFlag",
    "ReportGenerator",
    "OffloadReportData",
    "OffloadManifestService",
    "OffloadManifest",
    "OffloadedFile",
    "calculate_xxh64",
    "verify_checksum",
    "compute_checksum_safe",
    "verify_copy",
    "batch_compute",
    "batch_verify",
    "ChecksumResult",
    "VerificationResult",
    "check_xxhash_available",
    # Professional media tool services
    "BinaryManager",
    "get_binary_manager",
    "MediaInfoService",
    "get_mediainfo_service",
    "ExifToolService",
    "get_exiftool_service",
    "SmartService",
    "get_smart_service",
    "MHLService",
    "get_mhl_service",
]
