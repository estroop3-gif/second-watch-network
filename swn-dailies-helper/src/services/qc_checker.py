"""
QC Checker - Automated quality control checks for media clips.

MVP QC Checks:
- Zero-duration file (Critical)
- Corrupt/unreadable (Critical)
- Missing audio (Warning)
- Audio sync issue (Warning)
- Timecode gap (Info)
- Resolution mismatch within reel (Warning)
- Frame rate mismatch within reel (Warning)
- VFR detected (Warning)
- Extremely short clip (Info)
- Extremely large file (Info)
"""
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime

from src.services.metadata_extractor import ClipMetadata


class QCSeverity(Enum):
    """Severity levels for QC flags."""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class QCCheckType(Enum):
    """Types of QC checks."""
    ZERO_DURATION = "zero_duration"
    CORRUPT_FILE = "corrupt_file"
    MISSING_AUDIO = "missing_audio"
    AUDIO_SYNC = "audio_sync"
    TIMECODE_GAP = "timecode_gap"
    RESOLUTION_MISMATCH = "resolution_mismatch"
    FPS_MISMATCH = "fps_mismatch"
    VFR_DETECTED = "vfr_detected"
    EXTREMELY_SHORT = "extremely_short"
    EXTREMELY_LARGE = "extremely_large"


@dataclass
class QCFlag:
    """A QC issue flag for a clip."""
    clip_filename: str
    clip_path: str
    check_type: str
    severity: str
    message: str
    details: Optional[Dict[str, Any]] = None
    detected_at: Optional[datetime] = None

    def __post_init__(self):
        if self.detected_at is None:
            self.detected_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["detected_at"] = self.detected_at.isoformat() if self.detected_at else None
        return d


@dataclass
class QCResult:
    """Result of QC checks on a clip."""
    clip_filename: str
    clip_path: str
    status: str  # 'pass', 'warning', 'fail'
    flags: List[QCFlag]
    checked_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "clip_filename": self.clip_filename,
            "clip_path": self.clip_path,
            "status": self.status,
            "flags": [f.to_dict() for f in self.flags],
            "checked_at": self.checked_at.isoformat(),
        }


@dataclass
class QCSummary:
    """Summary of QC results for a batch of clips."""
    total_clips: int
    passed: int
    warnings: int
    failed: int
    flags_by_type: Dict[str, int]
    flags_by_severity: Dict[str, int]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class QCChecker:
    """Automated QC checker for media clips."""

    # Thresholds
    MIN_DURATION_SECONDS = 1.0  # Clips shorter than this are flagged
    MAX_SIZE_PER_SECOND_MB = 500  # Files larger than this per second are flagged

    def __init__(self):
        """Initialize the QC checker."""
        pass

    def check_clip(self, metadata: ClipMetadata) -> QCResult:
        """
        Run all QC checks on a single clip.

        Args:
            metadata: ClipMetadata from the metadata extractor

        Returns:
            QCResult with all detected issues
        """
        flags = []

        # Critical: Zero duration
        if metadata.duration_seconds <= 0:
            flags.append(QCFlag(
                clip_filename=metadata.filename,
                clip_path=metadata.file_path,
                check_type=QCCheckType.ZERO_DURATION.value,
                severity=QCSeverity.CRITICAL.value,
                message="File has zero duration - possibly corrupt or incomplete",
                details={"duration": metadata.duration_seconds},
            ))

        # Critical: Corrupt file (no valid codec detected)
        if metadata.codec == "unknown" or not metadata.is_valid:
            flags.append(QCFlag(
                clip_filename=metadata.filename,
                clip_path=metadata.file_path,
                check_type=QCCheckType.CORRUPT_FILE.value,
                severity=QCSeverity.CRITICAL.value,
                message=metadata.error_message or "File could not be read or is corrupt",
                details={"codec": metadata.codec},
            ))

        # Warning: Missing audio
        if metadata.audio_channels == 0:
            flags.append(QCFlag(
                clip_filename=metadata.filename,
                clip_path=metadata.file_path,
                check_type=QCCheckType.MISSING_AUDIO.value,
                severity=QCSeverity.WARNING.value,
                message="No audio tracks detected in file",
                details={"audio_codec": metadata.audio_codec},
            ))

        # Info: Extremely short clip
        if 0 < metadata.duration_seconds < self.MIN_DURATION_SECONDS:
            flags.append(QCFlag(
                clip_filename=metadata.filename,
                clip_path=metadata.file_path,
                check_type=QCCheckType.EXTREMELY_SHORT.value,
                severity=QCSeverity.INFO.value,
                message=f"Clip is very short ({metadata.duration_seconds:.2f}s)",
                details={"duration": metadata.duration_seconds},
            ))

        # Info: Extremely large file for duration
        if metadata.duration_seconds > 0:
            size_per_second_mb = (metadata.file_size / 1_000_000) / metadata.duration_seconds
            if size_per_second_mb > self.MAX_SIZE_PER_SECOND_MB:
                flags.append(QCFlag(
                    clip_filename=metadata.filename,
                    clip_path=metadata.file_path,
                    check_type=QCCheckType.EXTREMELY_LARGE.value,
                    severity=QCSeverity.INFO.value,
                    message=f"File is unusually large ({size_per_second_mb:.0f} MB/s)",
                    details={
                        "file_size": metadata.file_size,
                        "duration": metadata.duration_seconds,
                        "mb_per_second": size_per_second_mb,
                    },
                ))

        # Determine overall status
        if any(f.severity == QCSeverity.CRITICAL.value for f in flags):
            status = "fail"
        elif any(f.severity == QCSeverity.WARNING.value for f in flags):
            status = "warning"
        else:
            status = "pass"

        return QCResult(
            clip_filename=metadata.filename,
            clip_path=metadata.file_path,
            status=status,
            flags=flags,
            checked_at=datetime.now(),
        )

    def check_batch(
        self,
        clips: List[ClipMetadata],
        check_consistency: bool = True
    ) -> tuple[List[QCResult], QCSummary]:
        """
        Run QC checks on multiple clips.

        Args:
            clips: List of ClipMetadata objects
            check_consistency: Whether to check for resolution/fps mismatches

        Returns:
            Tuple of (list of QCResults, QCSummary)
        """
        results = []

        # Run individual checks
        for clip in clips:
            results.append(self.check_clip(clip))

        # Run batch consistency checks if enabled
        if check_consistency and len(clips) > 1:
            consistency_flags = self._check_batch_consistency(clips)
            for flag in consistency_flags:
                # Find the result for this clip and add the flag
                for result in results:
                    if result.clip_path == flag.clip_path:
                        result.flags.append(flag)
                        # Update status if needed
                        if flag.severity == QCSeverity.WARNING.value and result.status == "pass":
                            result.status = "warning"

        # Generate summary
        summary = self._generate_summary(results)

        return results, summary

    def _check_batch_consistency(self, clips: List[ClipMetadata]) -> List[QCFlag]:
        """Check for inconsistencies across clips in a batch."""
        flags = []

        # Group by reel
        reels: Dict[str, List[ClipMetadata]] = {}
        for clip in clips:
            reel = clip.reel or "unknown"
            if reel not in reels:
                reels[reel] = []
            reels[reel].append(clip)

        # Check consistency within each reel
        for reel, reel_clips in reels.items():
            if len(reel_clips) < 2:
                continue

            # Get reference values from first clip
            ref_resolution = reel_clips[0].resolution
            ref_fps = reel_clips[0].fps

            for clip in reel_clips[1:]:
                # Resolution mismatch
                if clip.resolution != ref_resolution:
                    flags.append(QCFlag(
                        clip_filename=clip.filename,
                        clip_path=clip.file_path,
                        check_type=QCCheckType.RESOLUTION_MISMATCH.value,
                        severity=QCSeverity.WARNING.value,
                        message=f"Resolution {clip.resolution} differs from reel {reel} reference {ref_resolution}",
                        details={
                            "reel": reel,
                            "clip_resolution": clip.resolution,
                            "reference_resolution": ref_resolution,
                        },
                    ))

                # FPS mismatch
                if abs(clip.fps - ref_fps) > 0.01:
                    flags.append(QCFlag(
                        clip_filename=clip.filename,
                        clip_path=clip.file_path,
                        check_type=QCCheckType.FPS_MISMATCH.value,
                        severity=QCSeverity.WARNING.value,
                        message=f"Frame rate {clip.fps} differs from reel {reel} reference {ref_fps}",
                        details={
                            "reel": reel,
                            "clip_fps": clip.fps,
                            "reference_fps": ref_fps,
                        },
                    ))

        # Check for timecode gaps (clips sorted by timecode within reel)
        for reel, reel_clips in reels.items():
            tc_clips = [(c, self._parse_timecode(c.timecode_start))
                       for c in reel_clips if c.timecode_start]
            tc_clips.sort(key=lambda x: x[1])

            for i in range(1, len(tc_clips)):
                prev_clip, prev_tc = tc_clips[i - 1]
                curr_clip, curr_tc = tc_clips[i]

                # Calculate expected start based on previous clip end
                prev_end_frames = prev_tc + int(prev_clip.duration_seconds * prev_clip.fps)
                gap_frames = curr_tc - prev_end_frames

                # Flag if gap is more than 1 second
                if gap_frames > prev_clip.fps:
                    gap_seconds = gap_frames / prev_clip.fps if prev_clip.fps > 0 else 0
                    flags.append(QCFlag(
                        clip_filename=curr_clip.filename,
                        clip_path=curr_clip.file_path,
                        check_type=QCCheckType.TIMECODE_GAP.value,
                        severity=QCSeverity.INFO.value,
                        message=f"Timecode gap of {gap_seconds:.1f}s from previous clip",
                        details={
                            "reel": reel,
                            "gap_frames": gap_frames,
                            "gap_seconds": gap_seconds,
                            "previous_clip": prev_clip.filename,
                        },
                    ))

        return flags

    def _parse_timecode(self, tc: Optional[str]) -> int:
        """Parse timecode string to total frames (assuming 24fps for simplicity)."""
        if not tc:
            return 0

        try:
            parts = tc.replace(";", ":").split(":")
            if len(parts) == 4:
                h, m, s, f = map(int, parts)
                # Assume 24fps for frame counting
                return h * 86400 + m * 1440 + s * 24 + f
        except (ValueError, IndexError):
            pass

        return 0

    def _generate_summary(self, results: List[QCResult]) -> QCSummary:
        """Generate a summary of QC results."""
        passed = sum(1 for r in results if r.status == "pass")
        warnings = sum(1 for r in results if r.status == "warning")
        failed = sum(1 for r in results if r.status == "fail")

        # Count flags by type and severity
        flags_by_type: Dict[str, int] = {}
        flags_by_severity: Dict[str, int] = {}

        for result in results:
            for flag in result.flags:
                flags_by_type[flag.check_type] = flags_by_type.get(flag.check_type, 0) + 1
                flags_by_severity[flag.severity] = flags_by_severity.get(flag.severity, 0) + 1

        return QCSummary(
            total_clips=len(results),
            passed=passed,
            warnings=warnings,
            failed=failed,
            flags_by_type=flags_by_type,
            flags_by_severity=flags_by_severity,
        )

    def format_report(self, results: List[QCResult], summary: QCSummary) -> str:
        """Format QC results as a text report."""
        lines = [
            "=" * 60,
            "QC REPORT",
            "=" * 60,
            "",
            "SUMMARY",
            "-" * 40,
            f"Total clips: {summary.total_clips}",
            f"Passed: {summary.passed}",
            f"Warnings: {summary.warnings}",
            f"Failed: {summary.failed}",
            "",
        ]

        if summary.flags_by_type:
            lines.append("Issues by type:")
            for check_type, count in sorted(summary.flags_by_type.items()):
                lines.append(f"  {check_type}: {count}")
            lines.append("")

        # List failed clips first
        failed_results = [r for r in results if r.status == "fail"]
        if failed_results:
            lines.append("FAILED CLIPS")
            lines.append("-" * 40)
            for result in failed_results:
                lines.append(f"\n{result.clip_filename}")
                for flag in result.flags:
                    lines.append(f"  [{flag.severity.upper()}] {flag.message}")
            lines.append("")

        # Then warnings
        warning_results = [r for r in results if r.status == "warning"]
        if warning_results:
            lines.append("CLIPS WITH WARNINGS")
            lines.append("-" * 40)
            for result in warning_results:
                lines.append(f"\n{result.clip_filename}")
                for flag in result.flags:
                    lines.append(f"  [{flag.severity.upper()}] {flag.message}")
            lines.append("")

        lines.append("=" * 60)

        return "\n".join(lines)
