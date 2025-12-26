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
]
