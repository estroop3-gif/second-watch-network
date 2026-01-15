"""
FFmpeg Encoder - Generate proxy files from camera originals.
Supports H.264, H.265, ProRes, and DNxHR codecs.
Handles various camera codecs (RED, ARRI, Blackmagic, Sony, etc.)
"""
import os
import sys
import subprocess
import shutil
import platform
import json
from pathlib import Path
from typing import Optional, Callable, Dict, Any, TYPE_CHECKING
from dataclasses import dataclass

if TYPE_CHECKING:
    from ..models.transcode_presets import TranscodeSettings


def get_ffmpeg_binary() -> Optional[Path]:
    """
    Get path to bundled FFmpeg binary.

    Returns:
        Path to FFmpeg binary, or None if not found.
    """
    system = platform.system()

    # Determine the resources directory
    if getattr(sys, 'frozen', False):
        # Running as compiled executable (PyInstaller)
        base_path = Path(sys._MEIPASS) / "ffmpeg"
    else:
        # Running from source
        base_path = Path(__file__).parent.parent.parent / "resources" / "ffmpeg"

    if system == "Windows":
        binary_path = base_path / "ffmpeg.exe"
    else:
        binary_path = base_path / "ffmpeg"

    if binary_path.exists():
        return binary_path

    # Fall back to system PATH
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return Path(system_ffmpeg)

    return None


def get_ffprobe_binary() -> Optional[Path]:
    """
    Get path to bundled FFprobe binary.

    Returns:
        Path to FFprobe binary, or None if not found.
    """
    system = platform.system()

    # Determine the resources directory
    if getattr(sys, 'frozen', False):
        # Running as compiled executable (PyInstaller)
        base_path = Path(sys._MEIPASS) / "ffmpeg"
    else:
        # Running from source
        base_path = Path(__file__).parent.parent.parent / "resources" / "ffmpeg"

    if system == "Windows":
        binary_path = base_path / "ffprobe.exe"
    else:
        binary_path = base_path / "ffprobe"

    if binary_path.exists():
        return binary_path

    # Fall back to system PATH
    system_ffprobe = shutil.which("ffprobe")
    if system_ffprobe:
        return Path(system_ffprobe)

    return None


@dataclass
class ProxySettings:
    """Settings for proxy generation (legacy, kept for compatibility)."""
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


# Codec configurations for TranscodeSettings
CODEC_CONFIGS = {
    # H.264 (most compatible, small files)
    "h264": {
        "vcodec": "libx264",
        "pix_fmt": "yuv420p",
        "container": ".mp4",
        "supports_preset": True,
        "supports_crf": True,
    },
    # H.265/HEVC (better compression, less compatible)
    "h265": {
        "vcodec": "libx265",
        "pix_fmt": "yuv420p",
        "container": ".mp4",
        "supports_preset": True,
        "supports_crf": True,
    },
    # ProRes variants (Apple, high quality, large files)
    "prores_proxy": {
        "vcodec": "prores_ks",
        "profile": "0",
        "pix_fmt": "yuv422p10le",
        "container": ".mov",
        "supports_preset": False,
        "supports_crf": False,
    },
    "prores_lt": {
        "vcodec": "prores_ks",
        "profile": "1",
        "pix_fmt": "yuv422p10le",
        "container": ".mov",
        "supports_preset": False,
        "supports_crf": False,
    },
    "prores_422": {
        "vcodec": "prores_ks",
        "profile": "2",
        "pix_fmt": "yuv422p10le",
        "container": ".mov",
        "supports_preset": False,
        "supports_crf": False,
    },
    "prores_hq": {
        "vcodec": "prores_ks",
        "profile": "3",
        "pix_fmt": "yuv422p10le",
        "container": ".mov",
        "supports_preset": False,
        "supports_crf": False,
    },
    # DNxHR variants (Avid, high quality)
    "dnxhr_lb": {
        "vcodec": "dnxhd",
        "profile": "dnxhr_lb",
        "pix_fmt": "yuv422p",
        "container": ".mxf",
        "supports_preset": False,
        "supports_crf": False,
    },
    "dnxhr_sq": {
        "vcodec": "dnxhd",
        "profile": "dnxhr_sq",
        "pix_fmt": "yuv422p",
        "container": ".mxf",
        "supports_preset": False,
        "supports_crf": False,
    },
    "dnxhr_hq": {
        "vcodec": "dnxhd",
        "profile": "dnxhr_hq",
        "pix_fmt": "yuv422p",
        "container": ".mxf",
        "supports_preset": False,
        "supports_crf": False,
    },
}

# Resolution presets
RESOLUTION_PRESETS = {
    "480p": (854, 480),
    "720p": (1280, 720),
    "1080p": (1920, 1080),
    "2k": (2048, 1080),
    "4k": (3840, 2160),
}


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

    def transcode_settings_to_ffmpeg_args(
        self,
        settings: "TranscodeSettings",
        source_width: int = 1920,
        source_height: int = 1080,
        lut_path: Optional[str] = None,
        clip_name: str = "",
        timecode: str = "00:00:00:00",
        camera: str = "",
        reel: str = "",
        fps: float = 24.0,
    ) -> tuple[list[str], str]:
        """
        Convert TranscodeSettings to FFmpeg arguments.

        Args:
            settings: TranscodeSettings object from transcode_presets
            source_width: Original video width (for aspect ratio)
            source_height: Original video height (for aspect ratio)
            lut_path: Optional path to .cube LUT file (overrides settings.lut_path)
            clip_name: Filename for burn-in
            timecode: Starting timecode for burn-in
            camera: Camera name for burn-in
            reel: Reel name for burn-in
            fps: Frame rate for timecode burn-in

        Returns:
            Tuple of (ffmpeg_args, output_extension)
        """
        codec_config = CODEC_CONFIGS.get(settings.codec)
        if not codec_config:
            raise ValueError(f"Unknown codec: {settings.codec}")

        args = []

        # Video codec
        args.extend(["-c:v", codec_config["vcodec"]])

        # ProRes/DNxHR profile
        if "profile" in codec_config:
            args.extend(["-profile:v", codec_config["profile"]])

        # Pixel format
        args.extend(["-pix_fmt", codec_config["pix_fmt"]])

        # Speed preset (H.264/H.265 only)
        if codec_config.get("supports_preset"):
            args.extend(["-preset", settings.speed])

        # Bitrate or CRF
        if settings.bitrate:
            args.extend(["-b:v", settings.bitrate])
        elif settings.crf is not None and codec_config.get("supports_crf"):
            args.extend(["-crf", str(settings.crf)])

        # Calculate output resolution
        if settings.resolution == "source":
            out_width, out_height = source_width, source_height
        elif settings.resolution == "custom" and settings.custom_width and settings.custom_height:
            out_width, out_height = settings.custom_width, settings.custom_height
        else:
            out_width, out_height = RESOLUTION_PRESETS.get(
                settings.resolution, (1920, 1080)
            )

        # Build video filter chain
        filters = []

        # Determine LUT path: use provided lut_path or check settings
        effective_lut_path = lut_path
        if not effective_lut_path and settings.lut_enabled and settings.lut_path:
            effective_lut_path = settings.lut_path

        # Apply LUT first if specified (preserves color detail at original resolution)
        if effective_lut_path and os.path.exists(effective_lut_path):
            escaped_path = effective_lut_path.replace("\\", "/").replace(":", "\\:")
            filters.append(f"lut3d='{escaped_path}':interp=tetrahedral")

        # Resolution scaling
        if settings.maintain_aspect:
            # Scale with aspect ratio preservation and letterbox/pillarbox
            filters.append(
                f"scale={out_width}:{out_height}:force_original_aspect_ratio=decrease,"
                f"pad={out_width}:{out_height}:(ow-iw)/2:(oh-ih)/2"
            )
        else:
            # Force exact dimensions (may distort)
            filters.append(f"scale={out_width}:{out_height}")

        # Add burn-in filters after scaling
        burnin_filter = self.build_burnin_filter(
            settings=settings,
            clip_name=clip_name,
            timecode=timecode,
            camera=camera,
            reel=reel,
            fps=fps,
            video_height=out_height,
        )
        if burnin_filter:
            filters.append(burnin_filter)

        if filters:
            args.extend(["-vf", ",".join(filters)])

        # Audio settings
        args.extend([
            "-c:a", settings.audio_codec,
            "-b:a", settings.audio_bitrate,
        ])

        return args, codec_config["container"]

    def generate_from_transcode_settings(
        self,
        input_path: str,
        output_dir: str,
        settings: "TranscodeSettings",
        lut_path: Optional[str] = None,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> Optional[str]:
        """
        Generate a proxy using TranscodeSettings.

        Args:
            input_path: Path to source media file
            output_dir: Directory for output file
            settings: TranscodeSettings from transcode_presets
            lut_path: Optional path to .cube LUT file
            progress_callback: Optional callback with progress (0.0-1.0)

        Returns:
            Path to output file if successful, None otherwise
        """
        if not self.ffmpeg_path:
            print("FFmpeg not available - cannot generate proxy")
            return None

        # Get source info for aspect ratio calculation
        source_info = self.get_media_info(input_path)
        source_width = 1920
        source_height = 1080

        for stream in source_info.get("streams", []):
            if stream.get("codec_type") == "video":
                source_width = stream.get("width", 1920)
                source_height = stream.get("height", 1080)
                break

        # Generate FFmpeg args
        try:
            ffmpeg_args, extension = self.transcode_settings_to_ffmpeg_args(
                settings, source_width, source_height, lut_path
            )
        except ValueError as e:
            print(f"Invalid settings: {e}")
            return None

        # Build output path
        input_name = Path(input_path).stem
        output_name = f"{input_name}_{settings.name.replace(' ', '_').lower()}{extension}"
        output_path = str(Path(output_dir) / output_name)

        # Get duration for progress
        duration = self._get_duration(input_path)

        # Build FFmpeg command
        cmd = [
            self.ffmpeg_path,
            "-y",  # Overwrite output
            "-i", input_path,
            *ffmpeg_args,
        ]

        # Add container-specific options
        if extension == ".mp4":
            cmd.extend(["-movflags", "+faststart"])  # Web-optimized
        elif extension == ".mov":
            cmd.extend(["-movflags", "+faststart"])  # QuickTime optimized
        # MXF doesn't need special flags

        cmd.extend(["-progress", "pipe:1", output_path])

        try:
            Path(output_dir).mkdir(parents=True, exist_ok=True)

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

            return_code = process.wait()

            if return_code == 0 and os.path.exists(output_path):
                if progress_callback:
                    progress_callback(1.0)
                return output_path
            else:
                stderr = process.stderr.read()
                print(f"FFmpeg error: {stderr}")
                return None

        except Exception as e:
            print(f"Encoding failed: {e}")
            return None

    def get_estimated_output_size(
        self,
        duration_seconds: float,
        settings: "TranscodeSettings",
    ) -> int:
        """
        Estimate output file size in bytes.

        Args:
            duration_seconds: Video duration
            settings: TranscodeSettings

        Returns:
            Estimated size in bytes
        """
        # Get codec bitrate estimate
        codec_config = CODEC_CONFIGS.get(settings.codec, {})

        if settings.bitrate:
            # Parse bitrate string (e.g., "5M", "2.5M", "1000k")
            bitrate_str = settings.bitrate.upper()
            if bitrate_str.endswith("M"):
                bitrate_bps = float(bitrate_str[:-1]) * 1_000_000
            elif bitrate_str.endswith("K"):
                bitrate_bps = float(bitrate_str[:-1]) * 1_000
            else:
                bitrate_bps = float(bitrate_str)
        else:
            # Estimate based on codec and resolution
            resolution = settings.resolution
            base_rates = {
                "480p": 1_000_000,
                "720p": 2_500_000,
                "1080p": 5_000_000,
                "2k": 8_000_000,
                "4k": 20_000_000,
                "source": 10_000_000,
            }
            bitrate_bps = base_rates.get(resolution, 5_000_000)

            # ProRes and DNxHR are much larger
            if settings.codec.startswith("prores"):
                bitrate_bps *= 10  # ProRes is ~10x larger
            elif settings.codec.startswith("dnxhr"):
                bitrate_bps *= 8  # DNxHR is ~8x larger

        # Add audio bitrate
        audio_str = settings.audio_bitrate.upper()
        if audio_str.endswith("K"):
            audio_bps = float(audio_str[:-1]) * 1_000
        else:
            audio_bps = float(audio_str)

        total_bitrate = bitrate_bps + audio_bps
        return int((total_bitrate / 8) * duration_seconds)

    def get_codec_info(self, codec_id: str) -> Optional[Dict[str, Any]]:
        """Get codec configuration by ID."""
        return CODEC_CONFIGS.get(codec_id)

    def get_available_codecs(self) -> Dict[str, Dict[str, Any]]:
        """Get all available codec configurations."""
        return CODEC_CONFIGS.copy()

    def extract_audio(
        self,
        input_path: str,
        output_path: str,
        audio_format: str = "wav",
        sample_rate: int = 48000,
        bit_depth: int = 24,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> bool:
        """
        Extract audio track to a separate file.

        Args:
            input_path: Path to source video file
            output_path: Path for output audio file
            audio_format: Output format (wav, aiff, mp3)
            sample_rate: Sample rate (44100, 48000, 96000)
            bit_depth: Bit depth (16, 24, 32)
            progress_callback: Optional callback with progress (0.0-1.0)

        Returns:
            True if successful, False otherwise
        """
        if not self.ffmpeg_path:
            print("FFmpeg not available - cannot extract audio")
            return False

        # Determine audio codec and file extension
        audio_configs = {
            "wav": {
                "ext": ".wav",
                "codec": f"pcm_s{bit_depth}le",
            },
            "aiff": {
                "ext": ".aiff",
                "codec": f"pcm_s{bit_depth}be",
            },
            "mp3": {
                "ext": ".mp3",
                "codec": "libmp3lame",
                "bitrate": "320k",
            },
        }

        config = audio_configs.get(audio_format.lower(), audio_configs["wav"])

        # Ensure correct extension
        output_path = str(Path(output_path).with_suffix(config["ext"]))

        # Build FFmpeg command
        cmd = [
            self.ffmpeg_path,
            "-y",
            "-i", input_path,
            "-vn",  # No video
            "-c:a", config["codec"],
            "-ar", str(sample_rate),
        ]

        # Add bitrate for lossy formats
        if "bitrate" in config:
            cmd.extend(["-b:a", config["bitrate"]])

        cmd.extend(["-progress", "pipe:1", output_path])

        # Get duration for progress
        duration = self._get_duration(input_path)

        try:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)

            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                universal_newlines=True
            )

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

            return_code = process.wait()

            if return_code == 0 and os.path.exists(output_path):
                if progress_callback:
                    progress_callback(1.0)
                return True
            else:
                stderr = process.stderr.read()
                print(f"Audio extraction error: {stderr}")
                return False

        except Exception as e:
            print(f"Audio extraction failed: {e}")
            return False

    def build_burnin_filter(
        self,
        settings: "TranscodeSettings",
        clip_name: str = "",
        timecode: str = "00:00:00:00",
        camera: str = "",
        reel: str = "",
        fps: float = 24.0,
        video_height: int = 1080,
    ) -> str:
        """
        Build FFmpeg drawtext filter for burn-in overlays.

        Args:
            settings: TranscodeSettings with burn-in options
            clip_name: Filename to burn in
            timecode: Starting timecode
            camera: Camera name (e.g., "A-CAM")
            reel: Reel/card name
            fps: Frame rate for timecode calculation
            video_height: Output video height for positioning

        Returns:
            FFmpeg filter string for drawtext
        """
        if not (settings.burn_timecode or settings.burn_clip_name or settings.burn_camera_info):
            return ""

        filters = []
        font_size = settings.burn_font_size
        margin = 10
        box_settings = ""

        if settings.burn_background:
            box_settings = ":box=1:boxcolor=black@0.5:boxborderw=5"

        # Position calculations
        if settings.burn_position == "top":
            y_base = margin
            y_line2 = margin + font_size + 5
        else:  # bottom
            y_base = f"h-{margin + font_size}"
            y_line2 = f"h-{margin + (font_size * 2) + 10}"

        # Burn clip name (bottom left, line 2)
        if settings.burn_clip_name and clip_name:
            safe_name = clip_name.replace("'", "\\'").replace(":", "\\:")
            filters.append(
                f"drawtext=text='{safe_name}':x={margin}:y={y_line2}"
                f":fontsize={font_size}:fontcolor=white{box_settings}"
            )

        # Burn timecode (bottom left, line 1 - uses pts for running timecode)
        if settings.burn_timecode:
            # Use timecode filter if available, otherwise use pts
            filters.append(
                f"drawtext=timecode='{timecode}':rate={fps}:x={margin}:y={y_base}"
                f":fontsize={font_size}:fontcolor=white{box_settings}"
            )

        # Burn camera/reel info (top left if bottom, or bottom left if top)
        if settings.burn_camera_info and (camera or reel):
            camera_text = " ".join(filter(None, [camera, reel]))
            safe_text = camera_text.replace("'", "\\'").replace(":", "\\:")
            if settings.burn_position == "bottom":
                cam_y = margin
            else:
                cam_y = f"h-{margin + font_size}"

            filters.append(
                f"drawtext=text='{safe_text}':x={margin}:y={cam_y}"
                f":fontsize={font_size}:fontcolor=white{box_settings}"
            )

        return ",".join(filters)
