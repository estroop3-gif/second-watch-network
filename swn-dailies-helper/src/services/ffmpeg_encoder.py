"""
FFmpeg Encoder - Generate H.264 proxy files from camera originals.
Handles various camera codecs (RED, ARRI, Blackmagic, Sony, etc.)
"""
import os
import sys
import subprocess
import shutil
import platform
import json
from pathlib import Path
from typing import Optional, Callable, Dict, Any
from dataclasses import dataclass


@dataclass
class ProxySettings:
    """Settings for proxy generation."""
    resolution: str = "1920x1080"
    codec: str = "libx264"
    preset: str = "fast"
    crf: int = 23  # Quality (lower = better, 18-28 typical)
    bitrate: Optional[str] = "10M"  # Use bitrate instead of CRF if set
    audio_codec: str = "aac"
    audio_bitrate: str = "192k"
    pixel_format: str = "yuv420p"
    lut_path: Optional[str] = None  # Path to .cube LUT file

    def to_ffmpeg_args(self) -> list[str]:
        """Convert settings to FFmpeg arguments."""
        args = [
            "-c:v", self.codec,
            "-preset", self.preset,
            "-pix_fmt", self.pixel_format,
        ]

        # Use bitrate or CRF
        if self.bitrate:
            args.extend(["-b:v", self.bitrate])
        else:
            args.extend(["-crf", str(self.crf)])

        # Build video filter chain
        # Order: LUT (before scaling for quality) → Scale → Pad
        width, height = self.resolution.split("x")
        filters = []

        # Apply LUT first if specified (preserves color detail at original resolution)
        if self.lut_path and os.path.exists(self.lut_path):
            # Escape path for FFmpeg filter
            escaped_path = self.lut_path.replace("\\", "/").replace(":", "\\:")
            filters.append(f"lut3d='{escaped_path}':interp=tetrahedral")

        # Resolution scaling with letterbox/pillarbox
        filters.append(
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2"
        )

        args.extend(["-vf", ",".join(filters)])

        # Audio
        args.extend([
            "-c:a", self.audio_codec,
            "-b:a", self.audio_bitrate,
        ])

        return args


class FFmpegEncoder:
    """
    FFmpeg-based encoder for generating H.264 proxies.
    """

    def __init__(self, ffmpeg_path: Optional[str] = None):
        """
        Initialize the encoder.

        Args:
            ffmpeg_path: Path to ffmpeg binary. If None, searches PATH.
        """
        self.ffmpeg_path = ffmpeg_path or self._find_ffmpeg()
        self.ffprobe_path = self._find_ffprobe()
        self.available = self.ffmpeg_path is not None

    def _find_ffmpeg(self) -> Optional[str]:
        """Find FFmpeg binary."""
        # Check bundled location first
        bundled = self._get_bundled_path("ffmpeg")
        if bundled and os.path.exists(bundled):
            return bundled

        # Check system PATH
        ffmpeg = shutil.which("ffmpeg")
        if ffmpeg:
            return ffmpeg

        # FFmpeg not found - encoder will work in limited mode
        return None

    def _find_ffprobe(self) -> Optional[str]:
        """Find FFprobe binary."""
        bundled = self._get_bundled_path("ffprobe")
        if bundled and os.path.exists(bundled):
            return bundled
        return shutil.which("ffprobe")

    def _get_bundled_path(self, binary: str) -> Optional[str]:
        """Get path to bundled FFmpeg binary."""
        system = platform.system()

        # Determine the resources directory
        if getattr(sys, 'frozen', False):
            # Running as compiled executable
            base_path = Path(sys._MEIPASS)
        else:
            # Running from source
            base_path = Path(__file__).parent.parent.parent / "resources" / "ffmpeg"

        if system == "Windows":
            binary_path = base_path / f"{binary}.exe"
        else:
            binary_path = base_path / binary

        return str(binary_path) if binary_path.exists() else None

    def get_media_info(self, input_path: str) -> Dict[str, Any]:
        """
        Get media information using FFprobe.

        Args:
            input_path: Path to the media file

        Returns:
            Dictionary with media information
        """
        if not self.ffprobe_path:
            return {}

        try:
            result = subprocess.run(
                [
                    self.ffprobe_path,
                    "-v", "quiet",
                    "-print_format", "json",
                    "-show_format",
                    "-show_streams",
                    input_path
                ],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                import json
                return json.loads(result.stdout)
        except Exception:
            pass

        return {}

    def generate_proxy(
        self,
        input_path: str,
        output_path: str,
        settings: Optional[ProxySettings] = None,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> bool:
        """
        Generate an H.264 proxy from a source file.

        Args:
            input_path: Path to source media file
            output_path: Path for output proxy file
            settings: Proxy settings (uses defaults if None)
            progress_callback: Optional callback with progress (0.0-1.0)

        Returns:
            True if successful, False otherwise
        """
        if not self.ffmpeg_path:
            print("FFmpeg not available - cannot generate proxy")
            return False

        if settings is None:
            settings = ProxySettings()

        # Get duration for progress calculation
        duration = self._get_duration(input_path)

        # Build FFmpeg command
        cmd = [
            self.ffmpeg_path,
            "-y",  # Overwrite output
            "-i", input_path,
            *settings.to_ffmpeg_args(),
            "-movflags", "+faststart",  # Web-optimized MP4
            "-progress", "pipe:1",  # Progress to stdout
            output_path
        ]

        try:
            # Ensure output directory exists
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)

            # Run FFmpeg
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )

            # Parse progress output
            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break

                if line.startswith("out_time_ms="):
                    try:
                        time_ms = int(line.split("=")[1])
                        time_sec = time_ms / 1_000_000
                        if duration > 0 and progress_callback:
                            progress = min(time_sec / duration, 1.0)
                            progress_callback(progress)
                    except (ValueError, IndexError):
                        pass

            # Check result
            return_code = process.wait()

            if return_code == 0 and os.path.exists(output_path):
                if progress_callback:
                    progress_callback(1.0)
                return True
            else:
                # Log error
                stderr = process.stderr.read()
                print(f"FFmpeg error: {stderr}")
                return False

        except Exception as e:
            print(f"Encoding failed: {e}")
            return False

    def _get_duration(self, input_path: str) -> float:
        """Get media duration in seconds."""
        info = self.get_media_info(input_path)

        try:
            # Try format duration first
            if "format" in info and "duration" in info["format"]:
                return float(info["format"]["duration"])

            # Try video stream duration
            for stream in info.get("streams", []):
                if stream.get("codec_type") == "video" and "duration" in stream:
                    return float(stream["duration"])
        except (KeyError, ValueError, TypeError):
            pass

        return 0.0

    def generate_thumbnail(
        self,
        input_path: str,
        output_path: str,
        time_offset: float = 1.0,
        width: int = 320,
    ) -> bool:
        """
        Generate a thumbnail image from a video.

        Args:
            input_path: Path to source video
            output_path: Path for output thumbnail (jpg)
            time_offset: Time in seconds to capture frame
            width: Thumbnail width (height auto-calculated)

        Returns:
            True if successful
        """
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-ss", str(time_offset),
            "-i", input_path,
            "-vframes", "1",
            "-vf", f"scale={width}:-1",
            "-q:v", "3",
            output_path
        ]

        try:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)

            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=30
            )

            return result.returncode == 0 and os.path.exists(output_path)

        except Exception as e:
            print(f"Thumbnail generation failed: {e}")
            return False

    def batch_generate_proxies(
        self,
        files: list[tuple[str, str]],
        settings: Optional[ProxySettings] = None,
        progress_callback: Optional[Callable[[int, int, float], None]] = None,
    ) -> list[bool]:
        """
        Generate proxies for multiple files.

        Args:
            files: List of (input_path, output_path) tuples
            settings: Proxy settings
            progress_callback: Callback(file_index, total_files, file_progress)

        Returns:
            List of success booleans for each file
        """
        results = []
        total = len(files)

        for i, (input_path, output_path) in enumerate(files):
            def file_progress(p: float):
                if progress_callback:
                    progress_callback(i, total, p)

            success = self.generate_proxy(
                input_path,
                output_path,
                settings,
                file_progress
            )
            results.append(success)

        return results
