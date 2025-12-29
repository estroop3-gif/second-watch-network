"""
MediaInfo service for detailed media file analysis.

MediaInfo provides comprehensive technical metadata about media files,
including codec details, bitrates, audio channels, and container information.

License: BSD-2-Clause
"""
import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.services.binary_manager import BinaryManager


@dataclass
class VideoTrack:
    """Video track information."""
    codec: str = ""
    codec_id: str = ""
    width: int = 0
    height: int = 0
    aspect_ratio: str = ""
    frame_rate: float = 0.0
    frame_rate_mode: str = ""
    bit_depth: int = 0
    color_space: str = ""
    chroma_subsampling: str = ""
    scan_type: str = ""
    bit_rate: int = 0
    duration_ms: int = 0
    frame_count: int = 0
    hdr_format: str = ""
    transfer_characteristics: str = ""
    color_primaries: str = ""
    matrix_coefficients: str = ""


@dataclass
class AudioTrack:
    """Audio track information."""
    track_id: int = 0
    codec: str = ""
    codec_id: str = ""
    channels: int = 0
    channel_layout: str = ""
    sample_rate: int = 0
    bit_depth: int = 0
    bit_rate: int = 0
    duration_ms: int = 0
    language: str = ""
    title: str = ""
    compression_mode: str = ""


@dataclass
class ContainerInfo:
    """Container/general information."""
    format: str = ""
    format_profile: str = ""
    codec_id: str = ""
    file_size: int = 0
    duration_ms: int = 0
    overall_bit_rate: int = 0
    frame_rate: float = 0.0
    encoded_date: str = ""
    tagged_date: str = ""
    writing_application: str = ""
    writing_library: str = ""


@dataclass
class MediaInfo:
    """Complete media file information."""
    file_path: str = ""
    container: ContainerInfo = field(default_factory=ContainerInfo)
    video_tracks: List[VideoTrack] = field(default_factory=list)
    audio_tracks: List[AudioTrack] = field(default_factory=list)
    text_tracks: int = 0
    menu_tracks: int = 0
    other_tracks: int = 0
    raw_data: Dict[str, Any] = field(default_factory=dict)


class MediaInfoService:
    """Service for extracting detailed media information using MediaInfo CLI."""

    def __init__(self):
        self._binary_manager = BinaryManager()
        self._mediainfo_path: Optional[Path] = None

    @property
    def is_available(self) -> bool:
        """Check if MediaInfo is available."""
        return self._binary_manager.is_available("mediainfo")

    @property
    def mediainfo_path(self) -> Optional[Path]:
        """Get the path to the MediaInfo binary."""
        if self._mediainfo_path is None:
            self._mediainfo_path = self._binary_manager.get_binary_path("mediainfo")
        return self._mediainfo_path

    def get_version(self) -> Optional[str]:
        """Get the MediaInfo version."""
        return self._binary_manager.get_version("mediainfo")

    def get_media_info(self, file_path: str) -> Optional[MediaInfo]:
        """
        Get complete media information for a file.

        Args:
            file_path: Path to the media file

        Returns:
            MediaInfo object with all track information, or None if failed
        """
        if not self.is_available:
            return None

        path = Path(file_path)
        if not path.exists():
            return None

        # Run MediaInfo with JSON output
        try:
            result = subprocess.run(
                [str(self.mediainfo_path), "--Output=JSON", str(path)],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                return None

            data = json.loads(result.stdout)
            return self._parse_mediainfo_json(str(path), data)

        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            return None

    def get_raw_json(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get raw MediaInfo JSON output.

        Args:
            file_path: Path to the media file

        Returns:
            Raw JSON data as dictionary, or None if failed
        """
        if not self.is_available:
            return None

        path = Path(file_path)
        if not path.exists():
            return None

        try:
            result = subprocess.run(
                [str(self.mediainfo_path), "--Output=JSON", str(path)],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                return None

            return json.loads(result.stdout)

        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            return None

    def get_text_report(self, file_path: str) -> Optional[str]:
        """
        Get MediaInfo text report (default output format).

        Args:
            file_path: Path to the media file

        Returns:
            Text report string, or None if failed
        """
        if not self.is_available:
            return None

        path = Path(file_path)
        if not path.exists():
            return None

        try:
            result = subprocess.run(
                [str(self.mediainfo_path), str(path)],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                return None

            return result.stdout

        except (subprocess.TimeoutExpired, Exception):
            return None

    def _parse_mediainfo_json(self, file_path: str, data: Dict[str, Any]) -> MediaInfo:
        """Parse MediaInfo JSON output into structured data."""
        info = MediaInfo(file_path=file_path, raw_data=data)

        media = data.get("media", {})
        tracks = media.get("track", [])

        for track in tracks:
            track_type = track.get("@type", "")

            if track_type == "General":
                info.container = self._parse_container(track)
            elif track_type == "Video":
                info.video_tracks.append(self._parse_video_track(track))
            elif track_type == "Audio":
                info.audio_tracks.append(self._parse_audio_track(track))
            elif track_type == "Text":
                info.text_tracks += 1
            elif track_type == "Menu":
                info.menu_tracks += 1
            else:
                info.other_tracks += 1

        return info

    def _parse_container(self, track: Dict[str, Any]) -> ContainerInfo:
        """Parse general/container track."""
        return ContainerInfo(
            format=track.get("Format", ""),
            format_profile=track.get("Format_Profile", ""),
            codec_id=track.get("CodecID", ""),
            file_size=self._parse_int(track.get("FileSize", 0)),
            duration_ms=self._parse_duration_ms(track.get("Duration")),
            overall_bit_rate=self._parse_int(track.get("OverallBitRate", 0)),
            frame_rate=self._parse_float(track.get("FrameRate", 0)),
            encoded_date=track.get("Encoded_Date", ""),
            tagged_date=track.get("Tagged_Date", ""),
            writing_application=track.get("Encoded_Application", ""),
            writing_library=track.get("Encoded_Library", ""),
        )

    def _parse_video_track(self, track: Dict[str, Any]) -> VideoTrack:
        """Parse video track."""
        return VideoTrack(
            codec=track.get("Format", ""),
            codec_id=track.get("CodecID", ""),
            width=self._parse_int(track.get("Width", 0)),
            height=self._parse_int(track.get("Height", 0)),
            aspect_ratio=track.get("DisplayAspectRatio_String", ""),
            frame_rate=self._parse_float(track.get("FrameRate", 0)),
            frame_rate_mode=track.get("FrameRate_Mode", ""),
            bit_depth=self._parse_int(track.get("BitDepth", 0)),
            color_space=track.get("ColorSpace", ""),
            chroma_subsampling=track.get("ChromaSubsampling", ""),
            scan_type=track.get("ScanType", ""),
            bit_rate=self._parse_int(track.get("BitRate", 0)),
            duration_ms=self._parse_duration_ms(track.get("Duration")),
            frame_count=self._parse_int(track.get("FrameCount", 0)),
            hdr_format=track.get("HDR_Format", ""),
            transfer_characteristics=track.get("transfer_characteristics", ""),
            color_primaries=track.get("colour_primaries", ""),
            matrix_coefficients=track.get("matrix_coefficients", ""),
        )

    def _parse_audio_track(self, track: Dict[str, Any]) -> AudioTrack:
        """Parse audio track."""
        return AudioTrack(
            track_id=self._parse_int(track.get("ID", 0)),
            codec=track.get("Format", ""),
            codec_id=track.get("CodecID", ""),
            channels=self._parse_int(track.get("Channels", 0)),
            channel_layout=track.get("ChannelLayout", ""),
            sample_rate=self._parse_int(track.get("SamplingRate", 0)),
            bit_depth=self._parse_int(track.get("BitDepth", 0)),
            bit_rate=self._parse_int(track.get("BitRate", 0)),
            duration_ms=self._parse_duration_ms(track.get("Duration")),
            language=track.get("Language", ""),
            title=track.get("Title", ""),
            compression_mode=track.get("Compression_Mode", ""),
        )

    def _parse_int(self, value: Any) -> int:
        """Safely parse an integer value."""
        if value is None:
            return 0
        try:
            return int(float(str(value)))
        except (ValueError, TypeError):
            return 0

    def _parse_float(self, value: Any) -> float:
        """Safely parse a float value."""
        if value is None:
            return 0.0
        try:
            return float(str(value))
        except (ValueError, TypeError):
            return 0.0

    def _parse_duration_ms(self, value: Any) -> int:
        """Parse duration to milliseconds."""
        if value is None:
            return 0
        try:
            # MediaInfo returns duration in seconds as a float
            return int(float(str(value)) * 1000)
        except (ValueError, TypeError):
            return 0


# Singleton instance
_service: Optional[MediaInfoService] = None


def get_mediainfo_service() -> MediaInfoService:
    """Get the singleton MediaInfo service instance."""
    global _service
    if _service is None:
        _service = MediaInfoService()
    return _service
