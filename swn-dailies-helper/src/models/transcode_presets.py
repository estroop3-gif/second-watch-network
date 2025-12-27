"""
Transcode presets for proxy generation.
Provides Adobe Media Encoder-style customization for DITs.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path
import json


@dataclass
class TranscodeSettings:
    """Full customization like Adobe Media Encoder."""
    name: str
    codec: str  # "h264", "prores_lt", "prores_422", "prores_hq", "dnxhr_lb", etc.
    resolution: str  # "1080p", "720p", "480p", "source", "custom"
    custom_width: Optional[int] = None
    custom_height: Optional[int] = None
    bitrate: Optional[str] = None  # "10M", "20M", etc. (None = codec default)
    crf: Optional[int] = None  # For H.264/H.265 quality mode (18-28 typical)
    speed: str = "medium"  # "ultrafast", "fast", "medium", "slow"
    audio_codec: str = "aac"
    audio_bitrate: str = "192k"
    maintain_aspect: bool = True

    # LUT color correction
    lut_enabled: bool = False
    lut_path: Optional[str] = None

    # Audio extraction (extract audio track to separate file)
    extract_audio: bool = False
    audio_extract_format: str = "wav"  # wav, aiff, mp3
    audio_extract_sample_rate: int = 48000
    audio_extract_bit_depth: int = 24

    # Timecode burn-in
    burn_timecode: bool = False
    burn_clip_name: bool = False
    burn_camera_info: bool = False
    burn_position: str = "bottom"  # "top", "bottom"
    burn_font_size: int = 32
    burn_background: bool = True  # Semi-transparent background

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "codec": self.codec,
            "resolution": self.resolution,
            "custom_width": self.custom_width,
            "custom_height": self.custom_height,
            "bitrate": self.bitrate,
            "crf": self.crf,
            "speed": self.speed,
            "audio_codec": self.audio_codec,
            "audio_bitrate": self.audio_bitrate,
            "maintain_aspect": self.maintain_aspect,
            # LUT
            "lut_enabled": self.lut_enabled,
            "lut_path": self.lut_path,
            # Audio extraction
            "extract_audio": self.extract_audio,
            "audio_extract_format": self.audio_extract_format,
            "audio_extract_sample_rate": self.audio_extract_sample_rate,
            "audio_extract_bit_depth": self.audio_extract_bit_depth,
            # Burn-in
            "burn_timecode": self.burn_timecode,
            "burn_clip_name": self.burn_clip_name,
            "burn_camera_info": self.burn_camera_info,
            "burn_position": self.burn_position,
            "burn_font_size": self.burn_font_size,
            "burn_background": self.burn_background,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TranscodeSettings":
        return cls(**data)


@dataclass
class TranscodePreset:
    """A preset that can generate multiple outputs."""
    id: str
    name: str
    description: str
    settings: List[TranscodeSettings]
    required_for_upload: bool = False  # True = always generate for web player
    is_builtin: bool = True  # False for user-created presets

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "settings": [s.to_dict() for s in self.settings],
            "required_for_upload": self.required_for_upload,
            "is_builtin": self.is_builtin,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TranscodePreset":
        settings = [TranscodeSettings.from_dict(s) for s in data.get("settings", [])]
        return cls(
            id=data["id"],
            name=data["name"],
            description=data.get("description", ""),
            settings=settings,
            required_for_upload=data.get("required_for_upload", False),
            is_builtin=data.get("is_builtin", True),
        )


# Resolution presets with max dimensions
RESOLUTIONS = {
    "480p": {"max_width": 854, "max_height": 480},
    "720p": {"max_width": 1280, "max_height": 720},
    "1080p": {"max_width": 1920, "max_height": 1080},
    "2k": {"max_width": 2048, "max_height": 1080},
    "4k": {"max_width": 3840, "max_height": 2160},
    "source": None,  # Keep source resolution
}

# Codec configurations for FFmpeg
CODECS = {
    # H.264/H.265 (lossy, small files)
    "h264": {
        "name": "H.264",
        "ext": ".mp4",
        "vcodec": "libx264",
        "pix_fmt": "yuv420p",
        "supports_crf": True,
        "default_bitrate": "5M",
    },
    "h265": {
        "name": "H.265/HEVC",
        "ext": ".mp4",
        "vcodec": "libx265",
        "pix_fmt": "yuv420p",
        "supports_crf": True,
        "default_bitrate": "3M",
    },

    # ProRes (Apple, high quality, large files)
    "prores_proxy": {
        "name": "ProRes Proxy",
        "ext": ".mov",
        "vcodec": "prores_ks",
        "profile": "0",
        "pix_fmt": "yuv422p10le",
        "supports_crf": False,
    },
    "prores_lt": {
        "name": "ProRes LT",
        "ext": ".mov",
        "vcodec": "prores_ks",
        "profile": "1",
        "pix_fmt": "yuv422p10le",
        "supports_crf": False,
    },
    "prores_422": {
        "name": "ProRes 422",
        "ext": ".mov",
        "vcodec": "prores_ks",
        "profile": "2",
        "pix_fmt": "yuv422p10le",
        "supports_crf": False,
    },
    "prores_hq": {
        "name": "ProRes HQ",
        "ext": ".mov",
        "vcodec": "prores_ks",
        "profile": "3",
        "pix_fmt": "yuv422p10le",
        "supports_crf": False,
    },

    # DNxHR (Avid, high quality, large files)
    "dnxhr_lb": {
        "name": "DNxHR LB",
        "ext": ".mxf",
        "vcodec": "dnxhd",
        "profile": "dnxhr_lb",
        "pix_fmt": "yuv422p",
        "supports_crf": False,
    },
    "dnxhr_sq": {
        "name": "DNxHR SQ",
        "ext": ".mxf",
        "vcodec": "dnxhd",
        "profile": "dnxhr_sq",
        "pix_fmt": "yuv422p",
        "supports_crf": False,
    },
    "dnxhr_hq": {
        "name": "DNxHR HQ",
        "ext": ".mxf",
        "vcodec": "dnxhd",
        "profile": "dnxhr_hq",
        "pix_fmt": "yuv422p",
        "supports_crf": False,
    },
}

# Speed presets (for H.264/H.265)
SPEED_PRESETS = {
    "ultrafast": "Fastest encoding, largest files",
    "fast": "Good balance of speed and quality",
    "medium": "Default, good quality",
    "slow": "Better quality, slower encoding",
    "veryslow": "Best quality, very slow",
}

# Built-in presets
BUILTIN_PRESETS: Dict[str, TranscodePreset] = {
    "web_player": TranscodePreset(
        id="web_player",
        name="Web Player",
        description="480p + 720p + 1080p H.264 for streaming (required)",
        settings=[
            TranscodeSettings(
                name="480p",
                codec="h264",
                resolution="480p",
                bitrate="1M",
                speed="fast",
                audio_bitrate="96k"
            ),
            TranscodeSettings(
                name="720p",
                codec="h264",
                resolution="720p",
                bitrate="2.5M",
                speed="fast",
                audio_bitrate="128k"
            ),
            TranscodeSettings(
                name="1080p",
                codec="h264",
                resolution="1080p",
                bitrate="5M",
                speed="fast",
                audio_bitrate="192k"
            ),
        ],
        required_for_upload=True,  # ALWAYS generated for any uploaded video
        is_builtin=True,
    ),

    "prores_lt": TranscodePreset(
        id="prores_lt",
        name="ProRes LT",
        description="1080p ProRes LT for NLE editing",
        settings=[
            TranscodeSettings(
                name="ProRes LT 1080p",
                codec="prores_lt",
                resolution="1080p",
            ),
        ],
        required_for_upload=False,
        is_builtin=True,
    ),

    "prores_422": TranscodePreset(
        id="prores_422",
        name="ProRes 422",
        description="1080p ProRes 422 for finishing",
        settings=[
            TranscodeSettings(
                name="ProRes 422 1080p",
                codec="prores_422",
                resolution="1080p",
            ),
        ],
        required_for_upload=False,
        is_builtin=True,
    ),

    "prores_proxy": TranscodePreset(
        id="prores_proxy",
        name="ProRes Proxy",
        description="1080p ProRes Proxy for offline editing",
        settings=[
            TranscodeSettings(
                name="ProRes Proxy 1080p",
                codec="prores_proxy",
                resolution="1080p",
            ),
        ],
        required_for_upload=False,
        is_builtin=True,
    ),

    "dnxhr_lb": TranscodePreset(
        id="dnxhr_lb",
        name="DNxHR LB",
        description="DNxHR Low Bandwidth for Avid editing",
        settings=[
            TranscodeSettings(
                name="DNxHR LB 1080p",
                codec="dnxhr_lb",
                resolution="1080p",
            ),
        ],
        required_for_upload=False,
        is_builtin=True,
    ),

    "dnxhr_sq": TranscodePreset(
        id="dnxhr_sq",
        name="DNxHR SQ",
        description="DNxHR Standard Quality for Avid",
        settings=[
            TranscodeSettings(
                name="DNxHR SQ 1080p",
                codec="dnxhr_sq",
                resolution="1080p",
            ),
        ],
        required_for_upload=False,
        is_builtin=True,
    ),

    "h264_high": TranscodePreset(
        id="h264_high",
        name="H.264 High Quality",
        description="1080p H.264 at high bitrate for review",
        settings=[
            TranscodeSettings(
                name="H.264 1080p HQ",
                codec="h264",
                resolution="1080p",
                bitrate="15M",
                speed="medium",
            ),
        ],
        required_for_upload=False,
        is_builtin=True,
    ),
}


class PresetManager:
    """Manages built-in and custom presets."""

    def __init__(self, config_dir: Path = None):
        if config_dir is None:
            config_dir = Path.home() / ".swn-dailies-helper"
        self.config_dir = config_dir
        self.presets_file = config_dir / "custom_presets.json"
        self._custom_presets: Dict[str, TranscodePreset] = {}
        self._load_custom_presets()

    def _load_custom_presets(self):
        """Load custom presets from disk."""
        if self.presets_file.exists():
            try:
                with open(self.presets_file) as f:
                    data = json.load(f)
                for preset_data in data.get("presets", []):
                    preset = TranscodePreset.from_dict(preset_data)
                    preset.is_builtin = False
                    self._custom_presets[preset.id] = preset
            except Exception as e:
                print(f"Error loading custom presets: {e}")

    def _save_custom_presets(self):
        """Save custom presets to disk."""
        self.config_dir.mkdir(parents=True, exist_ok=True)
        data = {
            "presets": [p.to_dict() for p in self._custom_presets.values()]
        }
        with open(self.presets_file, "w") as f:
            json.dump(data, f, indent=2)

    def get_all_presets(self) -> Dict[str, TranscodePreset]:
        """Get all presets (built-in + custom)."""
        all_presets = dict(BUILTIN_PRESETS)
        all_presets.update(self._custom_presets)
        return all_presets

    def get_preset(self, preset_id: str) -> Optional[TranscodePreset]:
        """Get a specific preset by ID."""
        if preset_id in BUILTIN_PRESETS:
            return BUILTIN_PRESETS[preset_id]
        return self._custom_presets.get(preset_id)

    def get_required_presets(self) -> List[TranscodePreset]:
        """Get presets that are required for upload (web player)."""
        return [p for p in self.get_all_presets().values() if p.required_for_upload]

    def get_optional_presets(self) -> List[TranscodePreset]:
        """Get optional presets (edit proxies)."""
        return [p for p in self.get_all_presets().values() if not p.required_for_upload]

    def create_custom_preset(
        self,
        name: str,
        description: str,
        settings: List[TranscodeSettings],
    ) -> TranscodePreset:
        """Create a new custom preset."""
        import uuid
        preset_id = f"custom_{uuid.uuid4().hex[:8]}"

        preset = TranscodePreset(
            id=preset_id,
            name=name,
            description=description,
            settings=settings,
            required_for_upload=False,
            is_builtin=False,
        )

        self._custom_presets[preset_id] = preset
        self._save_custom_presets()
        return preset

    def delete_custom_preset(self, preset_id: str) -> bool:
        """Delete a custom preset."""
        if preset_id in self._custom_presets:
            del self._custom_presets[preset_id]
            self._save_custom_presets()
            return True
        return False

    def update_custom_preset(
        self,
        preset_id: str,
        name: str = None,
        description: str = None,
        settings: List[TranscodeSettings] = None,
    ) -> Optional[TranscodePreset]:
        """Update an existing custom preset."""
        if preset_id not in self._custom_presets:
            return None

        preset = self._custom_presets[preset_id]
        if name:
            preset.name = name
        if description:
            preset.description = description
        if settings:
            preset.settings = settings

        self._save_custom_presets()
        return preset


def get_codec_info(codec_id: str) -> Optional[Dict[str, Any]]:
    """Get codec configuration by ID."""
    return CODECS.get(codec_id)


def get_resolution_dimensions(resolution: str) -> Optional[Dict[str, int]]:
    """Get max width/height for a resolution preset."""
    return RESOLUTIONS.get(resolution)


def get_file_extension(codec_id: str) -> str:
    """Get the appropriate file extension for a codec."""
    codec = CODECS.get(codec_id)
    if codec:
        return codec.get("ext", ".mp4")
    return ".mp4"
