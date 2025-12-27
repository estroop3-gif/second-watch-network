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

FFmpeg-based QC Checks:
- Black frames detection (Critical/Warning)
- Audio silence detection (Warning)
- Audio clipping detection (Warning)
- Audio level analysis (Info)
"""
import subprocess
import shutil
import re
from typing import List, Dict, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from datetime import datetime
from pathlib import Path

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
    # FFmpeg-based checks
    BLACK_FRAMES = "black_frames"
    AUDIO_SILENCE = "audio_silence"
    AUDIO_CLIPPING = "audio_clipping"
    FLASH_FRAMES = "flash_frames"
    # MediaInfo-based checks
    LOW_BITRATE = "low_bitrate"
    HIGH_BITRATE = "high_bitrate"
    HDR_CONTENT = "hdr_content"
    LOW_BIT_DEPTH = "low_bit_depth"
    INTERLACED = "interlaced"
    MIXED_CAMERAS = "mixed_cameras"


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

    # FFmpeg-based detection methods

    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg binary."""
        return shutil.which("ffmpeg")

    def detect_black_frames(
        self,
        file_path: str,
        min_duration: float = 0.1,
        pixel_threshold: float = 0.10,
    ) -> List[Dict[str, Any]]:
        """
        Detect black frames in a video file.

        Args:
            file_path: Path to video file
            min_duration: Minimum black duration to detect (seconds)
            pixel_threshold: Pixel value threshold (0-1)

        Returns:
            List of black frame detections with start, end, and duration
        """
        ffmpeg = self._find_ffmpeg()
        if not ffmpeg:
            return []

        cmd = [
            ffmpeg,
            "-i", file_path,
            "-vf", f"blackdetect=d={min_duration}:pix_th={pixel_threshold}",
            "-an",  # No audio
            "-f", "null",
            "-"
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            detections = []
            # Parse stderr for blackdetect output
            # Format: [blackdetect @ 0x...] black_start:0 black_end:1.5 black_duration:1.5
            pattern = r"black_start:(\d+\.?\d*)\s+black_end:(\d+\.?\d*)\s+black_duration:(\d+\.?\d*)"

            for match in re.finditer(pattern, result.stderr):
                detections.append({
                    "start": float(match.group(1)),
                    "end": float(match.group(2)),
                    "duration": float(match.group(3)),
                })

            return detections

        except subprocess.TimeoutExpired:
            print(f"Black frame detection timed out for {file_path}")
            return []
        except Exception as e:
            print(f"Black frame detection failed: {e}")
            return []

    def detect_audio_silence(
        self,
        file_path: str,
        noise_threshold_db: float = -50.0,
        min_duration: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Detect audio silence in a media file.

        Args:
            file_path: Path to media file
            noise_threshold_db: Threshold below which is silence (dB)
            min_duration: Minimum silence duration to detect (seconds)

        Returns:
            List of silence detections with start, end, and duration
        """
        ffmpeg = self._find_ffmpeg()
        if not ffmpeg:
            return []

        cmd = [
            ffmpeg,
            "-i", file_path,
            "-af", f"silencedetect=n={noise_threshold_db}dB:d={min_duration}",
            "-vn",  # No video
            "-f", "null",
            "-"
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )

            detections = []
            # Parse stderr for silencedetect output
            # Format: [silencedetect @ 0x...] silence_start: 1.234
            # Format: [silencedetect @ 0x...] silence_end: 2.345 | silence_duration: 1.111

            current_start = None
            for line in result.stderr.split("\n"):
                if "silence_start:" in line:
                    match = re.search(r"silence_start:\s*(\d+\.?\d*)", line)
                    if match:
                        current_start = float(match.group(1))
                elif "silence_end:" in line and current_start is not None:
                    end_match = re.search(r"silence_end:\s*(\d+\.?\d*)", line)
                    dur_match = re.search(r"silence_duration:\s*(\d+\.?\d*)", line)
                    if end_match and dur_match:
                        detections.append({
                            "start": current_start,
                            "end": float(end_match.group(1)),
                            "duration": float(dur_match.group(1)),
                        })
                    current_start = None

            return detections

        except subprocess.TimeoutExpired:
            print(f"Silence detection timed out for {file_path}")
            return []
        except Exception as e:
            print(f"Silence detection failed: {e}")
            return []

    def analyze_audio_levels(self, file_path: str) -> Dict[str, Any]:
        """
        Analyze audio levels using FFmpeg's volumedetect filter.

        Args:
            file_path: Path to media file

        Returns:
            Dictionary with mean_volume, max_volume, histogram data
        """
        ffmpeg = self._find_ffmpeg()
        if not ffmpeg:
            return {}

        cmd = [
            ffmpeg,
            "-i", file_path,
            "-af", "volumedetect",
            "-vn",  # No video
            "-f", "null",
            "-"
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )

            levels = {
                "mean_volume": None,
                "max_volume": None,
                "is_clipping": False,
            }

            for line in result.stderr.split("\n"):
                if "mean_volume:" in line:
                    match = re.search(r"mean_volume:\s*(-?\d+\.?\d*)\s*dB", line)
                    if match:
                        levels["mean_volume"] = float(match.group(1))
                elif "max_volume:" in line:
                    match = re.search(r"max_volume:\s*(-?\d+\.?\d*)\s*dB", line)
                    if match:
                        max_vol = float(match.group(1))
                        levels["max_volume"] = max_vol
                        # Clipping detection: max volume >= -0.5 dB
                        levels["is_clipping"] = max_vol >= -0.5

            return levels

        except subprocess.TimeoutExpired:
            print(f"Audio level analysis timed out for {file_path}")
            return {}
        except Exception as e:
            print(f"Audio level analysis failed: {e}")
            return {}

    def run_ffmpeg_qc(
        self,
        file_path: str,
        filename: str,
        check_black_frames: bool = True,
        check_silence: bool = True,
        check_clipping: bool = True,
        black_frame_threshold: float = 0.1,
        silence_threshold_db: float = -50.0,
    ) -> List[QCFlag]:
        """
        Run all FFmpeg-based QC checks on a file.

        Args:
            file_path: Path to media file
            filename: Filename for flag messages
            check_black_frames: Whether to check for black frames
            check_silence: Whether to check for audio silence
            check_clipping: Whether to check for audio clipping
            black_frame_threshold: Minimum black frame duration (seconds)
            silence_threshold_db: Silence threshold in dB

        Returns:
            List of QCFlag objects for detected issues
        """
        flags = []

        # Black frame detection
        if check_black_frames:
            black_frames = self.detect_black_frames(
                file_path, min_duration=black_frame_threshold
            )
            for detection in black_frames:
                # Determine severity based on duration
                duration = detection["duration"]
                severity = QCSeverity.CRITICAL if duration > 1.0 else QCSeverity.WARNING

                flags.append(QCFlag(
                    clip_filename=filename,
                    clip_path=file_path,
                    check_type=QCCheckType.BLACK_FRAMES.value,
                    severity=severity.value,
                    message=f"Black frames detected at {detection['start']:.2f}s ({duration:.2f}s duration)",
                    details={
                        "start": detection["start"],
                        "end": detection["end"],
                        "duration": duration,
                    },
                ))

        # Audio silence detection
        if check_silence:
            silence = self.detect_audio_silence(
                file_path, noise_threshold_db=silence_threshold_db
            )
            for detection in silence:
                flags.append(QCFlag(
                    clip_filename=filename,
                    clip_path=file_path,
                    check_type=QCCheckType.AUDIO_SILENCE.value,
                    severity=QCSeverity.WARNING.value,
                    message=f"Audio silence at {detection['start']:.2f}s ({detection['duration']:.2f}s duration)",
                    details={
                        "start": detection["start"],
                        "end": detection["end"],
                        "duration": detection["duration"],
                    },
                ))

        # Audio clipping detection
        if check_clipping:
            levels = self.analyze_audio_levels(file_path)
            if levels.get("is_clipping"):
                flags.append(QCFlag(
                    clip_filename=filename,
                    clip_path=file_path,
                    check_type=QCCheckType.AUDIO_CLIPPING.value,
                    severity=QCSeverity.WARNING.value,
                    message=f"Audio clipping detected (peak: {levels.get('max_volume', 0):.1f} dB)",
                    details={
                        "max_volume": levels.get("max_volume"),
                        "mean_volume": levels.get("mean_volume"),
                    },
                ))

        return flags

    def format_timecode(self, seconds: float, fps: float = 24.0) -> str:
        """Convert seconds to timecode format HH:MM:SS:FF."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        frames = int((seconds % 1) * fps)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}:{frames:02d}"

    # MediaInfo-based detection methods

    def run_mediainfo_qc(
        self,
        file_path: str,
        filename: str,
        check_vfr: bool = True,
        check_bitrate: bool = True,
        check_hdr: bool = True,
        check_interlaced: bool = True,
        min_bitrate_mbps: float = 10.0,
        max_bitrate_mbps: float = 500.0,
    ) -> Tuple[List[QCFlag], Optional[Dict[str, Any]]]:
        """
        Run MediaInfo-based QC checks on a file.

        Args:
            file_path: Path to media file
            filename: Filename for flag messages
            check_vfr: Whether to check for variable frame rate
            check_bitrate: Whether to validate bitrate range
            check_hdr: Whether to detect HDR content
            check_interlaced: Whether to check for interlaced content
            min_bitrate_mbps: Minimum expected bitrate (Mbps)
            max_bitrate_mbps: Maximum expected bitrate (Mbps)

        Returns:
            Tuple of (List of QCFlag objects, MediaInfo details dict)
        """
        flags = []
        details = None

        try:
            from src.services.mediainfo_service import get_mediainfo_service

            mediainfo = get_mediainfo_service()
            if not mediainfo.is_available:
                return flags, None

            info = mediainfo.get_media_info(file_path)
            if info is None:
                return flags, None

            # Build details dict for UI display
            details = self._build_mediainfo_details(info)

            # Check each video track
            for i, video in enumerate(info.video_tracks):
                track_prefix = f"Track {i+1}: " if len(info.video_tracks) > 1 else ""

                # VFR Detection
                if check_vfr and video.frame_rate_mode.upper() == "VFR":
                    flags.append(QCFlag(
                        clip_filename=filename,
                        clip_path=file_path,
                        check_type=QCCheckType.VFR_DETECTED.value,
                        severity=QCSeverity.WARNING.value,
                        message=f"{track_prefix}Variable frame rate detected - may cause sync issues in editing",
                        details={
                            "frame_rate": video.frame_rate,
                            "frame_rate_mode": video.frame_rate_mode,
                        },
                    ))

                # Bitrate Analysis
                if check_bitrate and video.bit_rate > 0:
                    bitrate_mbps = video.bit_rate / 1_000_000

                    if bitrate_mbps < min_bitrate_mbps:
                        flags.append(QCFlag(
                            clip_filename=filename,
                            clip_path=file_path,
                            check_type=QCCheckType.LOW_BITRATE.value,
                            severity=QCSeverity.WARNING.value,
                            message=f"{track_prefix}Low video bitrate: {bitrate_mbps:.1f} Mbps (expected >= {min_bitrate_mbps} Mbps)",
                            details={
                                "bitrate_mbps": bitrate_mbps,
                                "threshold": min_bitrate_mbps,
                            },
                        ))
                    elif bitrate_mbps > max_bitrate_mbps:
                        flags.append(QCFlag(
                            clip_filename=filename,
                            clip_path=file_path,
                            check_type=QCCheckType.HIGH_BITRATE.value,
                            severity=QCSeverity.INFO.value,
                            message=f"{track_prefix}Very high video bitrate: {bitrate_mbps:.1f} Mbps",
                            details={
                                "bitrate_mbps": bitrate_mbps,
                            },
                        ))

                # HDR Detection
                if check_hdr and video.hdr_format:
                    flags.append(QCFlag(
                        clip_filename=filename,
                        clip_path=file_path,
                        check_type=QCCheckType.HDR_CONTENT.value,
                        severity=QCSeverity.INFO.value,
                        message=f"{track_prefix}HDR content detected: {video.hdr_format}",
                        details={
                            "hdr_format": video.hdr_format,
                            "transfer_characteristics": video.transfer_characteristics,
                            "color_primaries": video.color_primaries,
                        },
                    ))

                # Interlaced Detection
                if check_interlaced and video.scan_type.lower() == "interlaced":
                    flags.append(QCFlag(
                        clip_filename=filename,
                        clip_path=file_path,
                        check_type=QCCheckType.INTERLACED.value,
                        severity=QCSeverity.INFO.value,
                        message=f"{track_prefix}Interlaced content detected",
                        details={
                            "scan_type": video.scan_type,
                        },
                    ))

                # Low Bit Depth Warning (for professional footage)
                if video.bit_depth > 0 and video.bit_depth < 10:
                    flags.append(QCFlag(
                        clip_filename=filename,
                        clip_path=file_path,
                        check_type=QCCheckType.LOW_BIT_DEPTH.value,
                        severity=QCSeverity.INFO.value,
                        message=f"{track_prefix}8-bit video (professional footage typically uses 10-bit or higher)",
                        details={
                            "bit_depth": video.bit_depth,
                        },
                    ))

        except ImportError:
            # MediaInfo service not available
            pass
        except Exception as e:
            print(f"MediaInfo QC check failed: {e}")

        return flags, details

    def _build_mediainfo_details(self, info) -> Dict[str, Any]:
        """Build a details dictionary from MediaInfo for UI display."""
        details = {
            "container": {
                "format": info.container.format,
                "format_profile": info.container.format_profile,
                "duration_ms": info.container.duration_ms,
                "overall_bitrate": info.container.overall_bit_rate,
                "file_size": info.container.file_size,
            },
            "video_tracks": [],
            "audio_tracks": [],
        }

        for video in info.video_tracks:
            details["video_tracks"].append({
                "codec": video.codec,
                "codec_id": video.codec_id,
                "width": video.width,
                "height": video.height,
                "frame_rate": video.frame_rate,
                "frame_rate_mode": video.frame_rate_mode,
                "bit_depth": video.bit_depth,
                "bit_rate": video.bit_rate,
                "color_space": video.color_space,
                "chroma_subsampling": video.chroma_subsampling,
                "scan_type": video.scan_type,
                "hdr_format": video.hdr_format,
                "transfer_characteristics": video.transfer_characteristics,
                "color_primaries": video.color_primaries,
            })

        for audio in info.audio_tracks:
            details["audio_tracks"].append({
                "codec": audio.codec,
                "channels": audio.channels,
                "channel_layout": audio.channel_layout,
                "sample_rate": audio.sample_rate,
                "bit_depth": audio.bit_depth,
                "bit_rate": audio.bit_rate,
                "language": audio.language,
            })

        return details

    def get_mediainfo_details(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get MediaInfo details for a file without running QC checks.

        Args:
            file_path: Path to media file

        Returns:
            MediaInfo details dictionary, or None if unavailable
        """
        try:
            from src.services.mediainfo_service import get_mediainfo_service

            mediainfo = get_mediainfo_service()
            if not mediainfo.is_available:
                return None

            info = mediainfo.get_media_info(file_path)
            if info is None:
                return None

            return self._build_mediainfo_details(info)

        except ImportError:
            return None
        except Exception:
            return None
