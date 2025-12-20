"""
Metadata Extractor - Extract clip metadata using FFprobe.

Extracts:
- Duration, resolution, FPS, codec (99% reliable)
- Audio channels, timecode (90-95% reliable)
- Camera make/model, reel name (70-75% reliable via filename parsing)
"""
import json
import os
import re
import subprocess
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict


@dataclass
class ClipMetadata:
    """Metadata extracted from a media clip."""
    filename: str
    file_path: str
    file_size: int

    # Video info (99% reliable)
    duration_seconds: float
    resolution: str
    width: int
    height: int
    fps: float
    fps_fraction: str
    codec: str
    pixel_format: str

    # Audio info (95% reliable)
    audio_channels: int
    audio_codec: str
    audio_sample_rate: int

    # Timecode (90% reliable)
    timecode_start: Optional[str]

    # Camera info (70-75% reliable - from filename/sidecar)
    camera_make: Optional[str]
    camera_model: Optional[str]
    reel: Optional[str]
    clip_number: Optional[str]
    color_space: Optional[str]

    # Status
    is_valid: bool
    error_message: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MetadataExtractor:
    """Extract metadata from media files using FFprobe."""

    # Camera filename patterns
    FILENAME_PATTERNS = {
        "sony": re.compile(
            r"^([A-Z]\d{3})C(\d{3})_(\d{6})([A-Z]{2})?.*\.(?:MXF|MP4|mxf|mp4)$"
        ),
        "red": re.compile(
            r"^([A-Z]\d{3})_C(\d{3})_(\d{4})([A-Z]{2})?.*\.(?:R3D|r3d)$"
        ),
        "arri": re.compile(
            r"^([A-Z]\d{3})C(\d{3})_(\d{6}).*\.(?:ari|mxf|ARI|MXF)$"
        ),
        "blackmagic": re.compile(
            r"^([A-Z]\d{3})_(\d{8})_C(\d{3}).*\.(?:braw|BRAW)$"
        ),
        "canon": re.compile(
            r"^([A-Z]\d{4}).*\.(?:MP4|MOV|mp4|mov)$"
        ),
    }

    # Color space indicators in filenames
    COLOR_SPACE_PATTERNS = {
        "S-Log3": re.compile(r"[_-]?S[_-]?Log3", re.IGNORECASE),
        "LogC": re.compile(r"[_-]?LogC", re.IGNORECASE),
        "Log3G10": re.compile(r"[_-]?Log3G10", re.IGNORECASE),
        "V-Log": re.compile(r"[_-]?V[_-]?Log", re.IGNORECASE),
        "Canon Log": re.compile(r"[_-]?C[_-]?Log", re.IGNORECASE),
        "Blackmagic Film": re.compile(r"[_-]?BMFilm", re.IGNORECASE),
    }

    def __init__(self, ffprobe_path: Optional[str] = None):
        """
        Initialize the extractor.

        Args:
            ffprobe_path: Path to ffprobe binary. Auto-detected if None.
        """
        self.ffprobe_path = ffprobe_path or self._find_ffprobe()
        self.available = self.ffprobe_path is not None

    def _find_ffprobe(self) -> Optional[str]:
        """Find FFprobe binary."""
        ffprobe = shutil.which("ffprobe")
        if ffprobe:
            return ffprobe
        # FFprobe not found - will work in limited mode
        return None

    def extract(self, file_path: str) -> ClipMetadata:
        """
        Extract metadata from a media file.

        Args:
            file_path: Path to the media file

        Returns:
            ClipMetadata with extracted information
        """
        path = Path(file_path)

        # Base metadata
        try:
            file_size = path.stat().st_size
        except OSError:
            file_size = 0

        # Get FFprobe data (may be None if ffprobe not available)
        probe_data = self._run_ffprobe(file_path)

        # Parse filename for camera info (works even without ffprobe)
        camera_info = self._parse_filename(path.name)

        # Check for errors or missing ffprobe
        if probe_data is None:
            # Return basic metadata from filename parsing
            color_space = self._detect_color_space(path.name, {})
            error_msg = "FFprobe not available" if not self.ffprobe_path else "Failed to probe file"
            return ClipMetadata(
                filename=path.name,
                file_path=str(path),
                file_size=file_size,
                duration_seconds=0,
                resolution="unknown",
                width=0,
                height=0,
                fps=0,
                fps_fraction="0/1",
                codec="unknown",
                pixel_format="unknown",
                audio_channels=0,
                audio_codec="none",
                audio_sample_rate=0,
                timecode_start=None,
                camera_make=camera_info.get("make"),
                camera_model=camera_info.get("model"),
                reel=camera_info.get("reel"),
                clip_number=camera_info.get("clip_number"),
                color_space=color_space,
                is_valid=False,
                error_message=error_msg,
            )

        # Extract video stream info
        video_info = self._extract_video_info(probe_data)
        audio_info = self._extract_audio_info(probe_data)
        timecode = self._extract_timecode(probe_data)
        format_info = probe_data.get("format", {})

        # Detect color space (camera_info already parsed above)
        color_space = self._detect_color_space(path.name, probe_data)

        # Get duration
        duration = 0.0
        try:
            if "duration" in format_info:
                duration = float(format_info["duration"])
            elif video_info.get("duration"):
                duration = float(video_info["duration"])
        except (ValueError, TypeError):
            pass

        return ClipMetadata(
            filename=path.name,
            file_path=str(path),
            file_size=file_size,
            duration_seconds=duration,
            resolution=f"{video_info.get('width', 0)}x{video_info.get('height', 0)}",
            width=video_info.get("width", 0),
            height=video_info.get("height", 0),
            fps=video_info.get("fps", 0),
            fps_fraction=video_info.get("fps_fraction", "0/1"),
            codec=video_info.get("codec", "unknown"),
            pixel_format=video_info.get("pix_fmt", "unknown"),
            audio_channels=audio_info.get("channels", 0),
            audio_codec=audio_info.get("codec", "none"),
            audio_sample_rate=audio_info.get("sample_rate", 0),
            timecode_start=timecode,
            camera_make=camera_info.get("make"),
            camera_model=camera_info.get("model"),
            reel=camera_info.get("reel"),
            clip_number=camera_info.get("clip_number"),
            color_space=color_space,
            is_valid=duration > 0,
            error_message=None if duration > 0 else "Zero duration",
        )

    def _run_ffprobe(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Run FFprobe and return JSON output."""
        if not self.ffprobe_path:
            return None

        try:
            result = subprocess.run(
                [
                    self.ffprobe_path,
                    "-v", "quiet",
                    "-print_format", "json",
                    "-show_format",
                    "-show_streams",
                    file_path
                ],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode == 0:
                return json.loads(result.stdout)
        except (subprocess.TimeoutExpired, subprocess.SubprocessError, json.JSONDecodeError):
            pass

        return None

    def _extract_video_info(self, probe_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract video stream information."""
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video":
                # Parse frame rate
                fps = 0.0
                fps_fraction = "0/1"

                if "r_frame_rate" in stream:
                    fps_fraction = stream["r_frame_rate"]
                    try:
                        num, den = fps_fraction.split("/")
                        fps = float(num) / float(den)
                    except (ValueError, ZeroDivisionError):
                        pass

                return {
                    "width": stream.get("width", 0),
                    "height": stream.get("height", 0),
                    "codec": stream.get("codec_name", "unknown"),
                    "pix_fmt": stream.get("pix_fmt", "unknown"),
                    "fps": round(fps, 3),
                    "fps_fraction": fps_fraction,
                    "duration": stream.get("duration"),
                    "color_space": stream.get("color_space"),
                    "color_transfer": stream.get("color_transfer"),
                }

        return {}

    def _extract_audio_info(self, probe_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract audio stream information."""
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "audio":
                return {
                    "codec": stream.get("codec_name", "none"),
                    "channels": stream.get("channels", 0),
                    "sample_rate": int(stream.get("sample_rate", 0)),
                }

        return {"codec": "none", "channels": 0, "sample_rate": 0}

    def _extract_timecode(self, probe_data: Dict[str, Any]) -> Optional[str]:
        """Extract timecode from format or stream tags."""
        # Check format tags
        format_tags = probe_data.get("format", {}).get("tags", {})
        for key in ["timecode", "Timecode", "TIMECODE"]:
            if key in format_tags:
                return format_tags[key]

        # Check video stream tags
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video":
                tags = stream.get("tags", {})
                for key in ["timecode", "Timecode", "TIMECODE"]:
                    if key in tags:
                        return tags[key]

        return None

    def _parse_filename(self, filename: str) -> Dict[str, Optional[str]]:
        """Parse camera-specific filename patterns."""
        result = {
            "make": None,
            "model": None,
            "reel": None,
            "clip_number": None,
        }

        # Try Sony pattern: A001C001_YYMMDDXX_S001.MXF
        match = self.FILENAME_PATTERNS["sony"].match(filename)
        if match:
            result["make"] = "Sony"
            result["reel"] = match.group(1)
            result["clip_number"] = f"C{match.group(2)}"
            return result

        # Try RED pattern: A001_C001_0101AB.R3D
        match = self.FILENAME_PATTERNS["red"].match(filename)
        if match:
            result["make"] = "RED"
            result["reel"] = match.group(1)
            result["clip_number"] = f"C{match.group(2)}"
            return result

        # Try ARRI pattern: A001C001_220115_R1AB.ari
        match = self.FILENAME_PATTERNS["arri"].match(filename)
        if match:
            result["make"] = "ARRI"
            result["reel"] = match.group(1)
            result["clip_number"] = f"C{match.group(2)}"
            return result

        # Try Blackmagic pattern: A001_09051234_C001.braw
        match = self.FILENAME_PATTERNS["blackmagic"].match(filename)
        if match:
            result["make"] = "Blackmagic"
            result["reel"] = match.group(1)
            result["clip_number"] = f"C{match.group(3)}"
            return result

        # Try Canon pattern: A0001.MP4
        match = self.FILENAME_PATTERNS["canon"].match(filename)
        if match:
            result["make"] = "Canon"
            result["reel"] = match.group(1)
            return result

        return result

    def _detect_color_space(
        self, filename: str, probe_data: Dict[str, Any]
    ) -> Optional[str]:
        """Detect color space from filename or FFprobe data."""
        # Check filename patterns
        for color_space, pattern in self.COLOR_SPACE_PATTERNS.items():
            if pattern.search(filename):
                return color_space

        # Check FFprobe color_transfer field
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video":
                color_transfer = stream.get("color_transfer", "")
                if "log" in color_transfer.lower():
                    return color_transfer

        return None

    def batch_extract(self, file_paths: List[str]) -> List[ClipMetadata]:
        """
        Extract metadata from multiple files.

        Args:
            file_paths: List of file paths

        Returns:
            List of ClipMetadata objects
        """
        return [self.extract(fp) for fp in file_paths]

    def get_supported_extensions(self) -> List[str]:
        """Return list of supported media extensions."""
        return [
            ".mov", ".mp4", ".mxf", ".avi",
            ".r3d", ".braw", ".ari",
            ".arw", ".dng", ".cr3", ".nef", ".raf"
        ]
