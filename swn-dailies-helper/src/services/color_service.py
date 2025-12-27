"""
OpenColorIO service for professional color management.

Provides functionality for:
- Loading OCIO configuration files (ACES, custom configs)
- Listing available color spaces
- Getting display/view combinations
- Generating LUTs for FFmpeg from OCIO transforms
"""
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Tuple, Any

try:
    import PyOpenColorIO as ocio
    HAS_OCIO = True
except ImportError:
    HAS_OCIO = False


@dataclass
class ColorSpace:
    """Information about an OCIO color space."""
    name: str
    family: str = ""
    description: str = ""
    encoding: str = ""
    is_data: bool = False


@dataclass
class DisplayView:
    """Display and view combination for output."""
    display: str
    view: str
    description: str = ""


@dataclass
class TransformInfo:
    """Information about a color transform."""
    source_space: str
    target_space: str
    display: Optional[str] = None
    view: Optional[str] = None


@dataclass
class LUTResult:
    """Result of LUT generation."""
    success: bool
    lut_path: Optional[str] = None
    format: str = "cube"
    size: int = 65
    error: Optional[str] = None


class ColorService:
    """
    Service for OpenColorIO color management.

    Provides OCIO config loading, color space listing, and LUT generation
    for use with FFmpeg during proxy transcoding.
    """

    def __init__(self):
        self._available = HAS_OCIO
        self._config: Optional[Any] = None
        self._config_path: Optional[str] = None
        self._builtin_configs: Dict[str, str] = {}

        # Discover built-in OCIO configs if available
        if self._available:
            self._discover_builtin_configs()

    @property
    def is_available(self) -> bool:
        """Check if OpenColorIO is available."""
        return self._available

    @property
    def is_loaded(self) -> bool:
        """Check if a config is loaded."""
        return self._config is not None

    @property
    def config_path(self) -> Optional[str]:
        """Get path to loaded config."""
        return self._config_path

    def _discover_builtin_configs(self):
        """Discover built-in OCIO configs."""
        try:
            # OCIO 2.x has built-in configs
            if hasattr(ocio, 'Config'):
                # Check for ACES and other built-in configs
                builtin_names = [
                    "aces_1.0.3",
                    "aces_1.1",
                    "aces_1.2",
                    "aces_1.3",
                    "cg-config-v1.0.0_aces-v1.3_ocio-v2.1",
                    "studio-config-v1.0.0_aces-v1.3_ocio-v2.1",
                ]
                for name in builtin_names:
                    try:
                        # Try to create config from builtin name
                        ocio.Config.CreateFromBuiltinConfig(name)
                        self._builtin_configs[name] = f"Built-in: {name}"
                    except:
                        pass
        except:
            pass

    def get_builtin_configs(self) -> Dict[str, str]:
        """Get available built-in OCIO configs."""
        return self._builtin_configs.copy()

    def load_config(self, config_path: str) -> bool:
        """
        Load an OCIO configuration file.

        Args:
            config_path: Path to OCIO config.ocio file, or builtin config name

        Returns:
            True if config loaded successfully
        """
        if not self._available:
            return False

        try:
            # Check if it's a builtin config name
            if config_path in self._builtin_configs:
                self._config = ocio.Config.CreateFromBuiltinConfig(config_path)
            else:
                # Load from file
                path = Path(config_path)
                if not path.exists():
                    return False
                self._config = ocio.Config.CreateFromFile(str(path))

            self._config_path = config_path
            return True

        except Exception as e:
            self._config = None
            self._config_path = None
            return False

    def load_default_config(self) -> bool:
        """Load the system default OCIO config (from OCIO env var)."""
        if not self._available:
            return False

        try:
            self._config = ocio.GetCurrentConfig()
            self._config_path = "system"
            return True
        except:
            return False

    def get_color_spaces(self) -> List[ColorSpace]:
        """
        Get list of color spaces in the loaded config.

        Returns:
            List of ColorSpace objects
        """
        if not self._config:
            return []

        spaces = []
        try:
            for i in range(self._config.getNumColorSpaces()):
                cs_name = self._config.getColorSpaceNameByIndex(i)
                cs = self._config.getColorSpace(cs_name)

                spaces.append(ColorSpace(
                    name=cs_name,
                    family=cs.getFamily() if hasattr(cs, 'getFamily') else "",
                    description=cs.getDescription() if hasattr(cs, 'getDescription') else "",
                    encoding=cs.getEncoding() if hasattr(cs, 'getEncoding') else "",
                    is_data=cs.isData() if hasattr(cs, 'isData') else False
                ))
        except Exception as e:
            pass

        return spaces

    def get_color_space_names(self) -> List[str]:
        """Get just the names of available color spaces."""
        return [cs.name for cs in self.get_color_spaces()]

    def get_input_color_spaces(self) -> List[ColorSpace]:
        """Get color spaces suitable for input (camera log formats, etc.)."""
        spaces = self.get_color_spaces()
        # Filter out data spaces and scene_linear (typically not input)
        return [cs for cs in spaces if not cs.is_data]

    def get_displays(self) -> List[str]:
        """Get available display devices."""
        if not self._config:
            return []

        try:
            displays = []
            for i in range(self._config.getNumDisplays()):
                displays.append(self._config.getDisplay(i))
            return displays
        except:
            return []

    def get_views(self, display: str) -> List[str]:
        """Get available views for a display."""
        if not self._config:
            return []

        try:
            views = []
            for i in range(self._config.getNumViews(display)):
                views.append(self._config.getView(display, i))
            return views
        except:
            return []

    def get_display_views(self) -> List[DisplayView]:
        """Get all display/view combinations."""
        if not self._config:
            return []

        result = []
        for display in self.get_displays():
            for view in self.get_views(display):
                result.append(DisplayView(
                    display=display,
                    view=view,
                    description=f"{display} - {view}"
                ))
        return result

    def get_default_display(self) -> Optional[str]:
        """Get the default display."""
        if not self._config:
            return None
        try:
            return self._config.getDefaultDisplay()
        except:
            displays = self.get_displays()
            return displays[0] if displays else None

    def get_default_view(self, display: str) -> Optional[str]:
        """Get the default view for a display."""
        if not self._config:
            return None
        try:
            return self._config.getDefaultView(display)
        except:
            views = self.get_views(display)
            return views[0] if views else None

    def generate_lut(
        self,
        source_space: str,
        display: str,
        view: str,
        lut_size: int = 65,
        output_dir: Optional[str] = None
    ) -> LUTResult:
        """
        Generate a 3D LUT from OCIO transform for use with FFmpeg.

        Args:
            source_space: Source color space name
            display: Target display
            view: Target view
            lut_size: LUT cube size (default 65)
            output_dir: Directory to save LUT (uses temp dir if None)

        Returns:
            LUTResult with path to generated LUT
        """
        if not self._config:
            return LUTResult(success=False, error="No OCIO config loaded")

        try:
            # Create processor for the transform
            processor = self._config.getProcessor(
                source_space,
                display,
                view,
                ocio.TRANSFORM_DIR_FORWARD
            )

            # Get CPU processor
            cpu_processor = processor.getDefaultCPUProcessor()

            # Generate LUT data
            lut_data = self._generate_cube_lut_data(cpu_processor, lut_size)

            # Determine output path
            if output_dir:
                out_dir = Path(output_dir)
            else:
                out_dir = Path(tempfile.gettempdir()) / "swn-ocio-luts"
            out_dir.mkdir(parents=True, exist_ok=True)

            # Create sanitized filename
            safe_name = f"{source_space}_to_{display}_{view}".replace(" ", "_").replace("/", "_")
            lut_path = out_dir / f"{safe_name}.cube"

            # Write LUT file
            with open(lut_path, 'w') as f:
                f.write(lut_data)

            return LUTResult(
                success=True,
                lut_path=str(lut_path),
                format="cube",
                size=lut_size
            )

        except Exception as e:
            return LUTResult(success=False, error=str(e))

    def generate_lut_simple(
        self,
        source_space: str,
        target_space: str,
        lut_size: int = 65,
        output_dir: Optional[str] = None
    ) -> LUTResult:
        """
        Generate a 3D LUT for color space to color space transform.

        Args:
            source_space: Source color space name
            target_space: Target color space name
            lut_size: LUT cube size
            output_dir: Directory to save LUT

        Returns:
            LUTResult with path to generated LUT
        """
        if not self._config:
            return LUTResult(success=False, error="No OCIO config loaded")

        try:
            # Create processor for the transform
            processor = self._config.getProcessor(source_space, target_space)

            # Get CPU processor
            cpu_processor = processor.getDefaultCPUProcessor()

            # Generate LUT data
            lut_data = self._generate_cube_lut_data(cpu_processor, lut_size)

            # Determine output path
            if output_dir:
                out_dir = Path(output_dir)
            else:
                out_dir = Path(tempfile.gettempdir()) / "swn-ocio-luts"
            out_dir.mkdir(parents=True, exist_ok=True)

            # Create sanitized filename
            safe_name = f"{source_space}_to_{target_space}".replace(" ", "_").replace("/", "_")
            lut_path = out_dir / f"{safe_name}.cube"

            # Write LUT file
            with open(lut_path, 'w') as f:
                f.write(lut_data)

            return LUTResult(
                success=True,
                lut_path=str(lut_path),
                format="cube",
                size=lut_size
            )

        except Exception as e:
            return LUTResult(success=False, error=str(e))

    def _generate_cube_lut_data(self, cpu_processor, size: int) -> str:
        """Generate .cube LUT file content from OCIO processor."""
        lines = [
            f"TITLE \"OCIO Generated LUT\"",
            f"LUT_3D_SIZE {size}",
            ""
        ]

        # Generate LUT entries
        for b in range(size):
            for g in range(size):
                for r in range(size):
                    # Normalize to 0-1 range
                    r_in = r / (size - 1)
                    g_in = g / (size - 1)
                    b_in = b / (size - 1)

                    # Apply OCIO transform
                    pixel = [r_in, g_in, b_in]
                    cpu_processor.applyRGB(pixel)

                    lines.append(f"{pixel[0]:.6f} {pixel[1]:.6f} {pixel[2]:.6f}")

        return "\n".join(lines)

    def get_recommended_input_spaces(self) -> List[str]:
        """Get commonly used camera input color spaces."""
        common = [
            "ARRI LogC",
            "ARRI LogC3",
            "ARRI LogC4",
            "Sony S-Log3",
            "Canon Log",
            "Canon Log3",
            "RED Log3G10",
            "Blackmagic Film Gen 5",
            "Panasonic V-Log",
            "ACEScg",
            "ACEScc",
            "Rec.709",
            "sRGB",
        ]

        available = self.get_color_space_names()
        return [cs for cs in common if cs in available]


# Singleton instance
_service: Optional[ColorService] = None


def get_color_service() -> ColorService:
    """Get the singleton color service instance."""
    global _service
    if _service is None:
        _service = ColorService()
    return _service
