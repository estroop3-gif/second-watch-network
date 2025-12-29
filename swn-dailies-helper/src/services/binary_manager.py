"""
Binary Manager - Unified discovery and management for bundled CLI binaries.

Handles cross-platform binary discovery for:
- MediaInfo CLI
- ExifTool
- smartmontools (smartctl)
- Pomfort mhl-tool
- FFmpeg/FFprobe (already exists, integrated here)
- rclone (already exists, integrated here)

Discovery priority:
1. Bundled location (PyInstaller or development)
2. System PATH fallback (if enabled for that binary)
"""
import os
import sys
import shutil
import platform
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any
from dataclasses import dataclass


@dataclass
class BinaryInfo:
    """Information about a binary tool."""
    name: str
    version: Optional[str]
    path: Optional[Path]
    is_bundled: bool
    is_available: bool
    license: str
    license_type: str  # "gpl", "bsd", "mit", "apache", "proprietary"


class BinaryManager:
    """
    Unified discovery and management for all bundled binaries.

    Provides a consistent interface for finding binaries across platforms,
    whether running from source or as a PyInstaller bundle.
    """

    # Binary configuration
    # subdir: directory under bin/ containing the binary
    # fallback: whether to fall back to system PATH if bundled not found
    # version_arg: argument to get version info
    # license: SPDX license identifier
    # license_type: category for GPL compliance handling
    BINARIES = {
        "mediainfo": {
            "subdir": "mediainfo",
            "fallback": True,
            "version_arg": "--Version",
            "license": "BSD-2-Clause",
            "license_type": "bsd",
        },
        "exiftool": {
            "subdir": "exiftool",
            "fallback": True,
            "version_arg": "-ver",
            "license": "GPL-1.0-or-later OR Artistic-1.0-Perl",
            "license_type": "gpl",
        },
        "smartctl": {
            "subdir": "smartctl",
            "fallback": True,
            "version_arg": "--version",
            "license": "GPL-2.0-only",
            "license_type": "gpl",
        },
        "mhl": {
            "subdir": "mhl-tool",
            "fallback": False,  # Proprietary, don't use system version
            "version_arg": "--version",
            "license": "Proprietary",
            "license_type": "proprietary",
        },
        "ffmpeg": {
            "subdir": "../resources/ffmpeg",  # Different location
            "fallback": True,
            "version_arg": "-version",
            "license": "LGPL-2.1-or-later OR GPL-2.0-or-later",
            "license_type": "gpl",
        },
        "ffprobe": {
            "subdir": "../resources/ffmpeg",
            "fallback": True,
            "version_arg": "-version",
            "license": "LGPL-2.1-or-later OR GPL-2.0-or-later",
            "license_type": "gpl",
        },
        "rclone": {
            "subdir": "rclone",
            "fallback": True,
            "version_arg": "version",
            "license": "MIT",
            "license_type": "mit",
        },
    }

    def __init__(self):
        """Initialize the binary manager."""
        self._cache: Dict[str, Optional[Path]] = {}
        self._version_cache: Dict[str, Optional[str]] = {}

    def _get_base_path(self) -> Path:
        """Get the base path for finding binaries."""
        if getattr(sys, 'frozen', False):
            # Running as PyInstaller bundle
            return Path(sys._MEIPASS)
        else:
            # Running from source
            return Path(__file__).parent.parent.parent

    def _get_platform_binary_name(self, name: str) -> str:
        """Get the platform-specific binary name."""
        system = platform.system().lower()
        machine = platform.machine().lower()

        # Normalize architecture
        if machine in ('x86_64', 'amd64'):
            arch = 'amd64'
        elif machine in ('arm64', 'aarch64'):
            arch = 'arm64'
        else:
            arch = machine

        # Platform-specific naming
        if system == 'windows':
            return f"{name}-windows-{arch}.exe"
        elif system == 'darwin':
            return f"{name}-darwin-{arch}"
        else:  # linux
            return f"{name}-linux-{arch}"

    def _get_simple_binary_name(self, name: str) -> str:
        """Get simple binary name (for tools that don't use platform suffix)."""
        if platform.system() == 'Windows':
            return f"{name}.exe"
        return name

    def get_binary_path(self, name: str) -> Optional[Path]:
        """
        Get the path to a binary, checking bundled first then system PATH.

        Args:
            name: Binary name (e.g., "mediainfo", "exiftool", "smartctl")

        Returns:
            Path to the binary if found, None otherwise
        """
        if name in self._cache:
            return self._cache[name]

        config = self.BINARIES.get(name)
        if not config:
            return None

        base_path = self._get_base_path()
        subdir = config["subdir"]

        # Try platform-specific name first
        binary_dir = base_path / "bin" / subdir
        if subdir.startswith("../"):
            # Handle relative paths like ../resources/ffmpeg
            binary_dir = base_path / subdir.lstrip("../")

        # Try different naming patterns
        patterns_to_try = [
            self._get_platform_binary_name(name),  # mediainfo-linux-amd64
            self._get_simple_binary_name(name),     # mediainfo or mediainfo.exe
            name,                                    # just the name
        ]

        for pattern in patterns_to_try:
            binary_path = binary_dir / pattern
            if binary_path.exists() and os.access(binary_path, os.X_OK):
                self._cache[name] = binary_path
                return binary_path

        # Fall back to system PATH if enabled
        if config.get("fallback", True):
            system_binary = shutil.which(name)
            if system_binary:
                path = Path(system_binary)
                self._cache[name] = path
                return path

        self._cache[name] = None
        return None

    def get_version(self, name: str) -> Optional[str]:
        """
        Get the version of a binary.

        Args:
            name: Binary name

        Returns:
            Version string if available, None otherwise
        """
        if name in self._version_cache:
            return self._version_cache[name]

        binary_path = self.get_binary_path(name)
        if not binary_path:
            return None

        config = self.BINARIES.get(name, {})
        version_arg = config.get("version_arg", "--version")

        try:
            result = subprocess.run(
                [str(binary_path), version_arg],
                capture_output=True,
                text=True,
                timeout=10
            )

            output = result.stdout or result.stderr
            if output:
                # Extract first line or meaningful version info
                lines = output.strip().split('\n')
                version = lines[0].strip() if lines else None
                self._version_cache[name] = version
                return version
        except Exception:
            pass

        self._version_cache[name] = None
        return None

    def is_available(self, name: str) -> bool:
        """Check if a binary is available."""
        return self.get_binary_path(name) is not None

    def is_bundled(self, name: str) -> bool:
        """Check if the binary is from the bundled location (not system PATH)."""
        path = self.get_binary_path(name)
        if not path:
            return False

        base_path = self._get_base_path()
        try:
            # Check if the path is under our base path
            path.relative_to(base_path)
            return True
        except ValueError:
            return False

    def get_info(self, name: str) -> Optional[BinaryInfo]:
        """
        Get comprehensive information about a binary.

        Args:
            name: Binary name

        Returns:
            BinaryInfo object with all details
        """
        config = self.BINARIES.get(name)
        if not config:
            return None

        path = self.get_binary_path(name)

        return BinaryInfo(
            name=name,
            version=self.get_version(name) if path else None,
            path=path,
            is_bundled=self.is_bundled(name),
            is_available=path is not None,
            license=config.get("license", "Unknown"),
            license_type=config.get("license_type", "unknown"),
        )

    def check_all_available(self) -> Dict[str, bool]:
        """
        Check availability of all configured binaries.

        Returns:
            Dictionary mapping binary names to availability status
        """
        return {name: self.is_available(name) for name in self.BINARIES}

    def get_all_info(self) -> Dict[str, BinaryInfo]:
        """
        Get information about all configured binaries.

        Returns:
            Dictionary mapping binary names to BinaryInfo objects
        """
        return {name: self.get_info(name) for name in self.BINARIES}

    def get_gpl_binaries(self) -> Dict[str, BinaryInfo]:
        """
        Get information about GPL-licensed binaries (for compliance notices).

        Returns:
            Dictionary of GPL-licensed binaries that are bundled
        """
        result = {}
        for name, config in self.BINARIES.items():
            if config.get("license_type") == "gpl":
                info = self.get_info(name)
                if info and info.is_bundled:
                    result[name] = info
        return result

    def clear_cache(self):
        """Clear the path and version caches."""
        self._cache.clear()
        self._version_cache.clear()


# Singleton instance for convenience
_binary_manager: Optional[BinaryManager] = None


def get_binary_manager() -> BinaryManager:
    """Get the singleton BinaryManager instance."""
    global _binary_manager
    if _binary_manager is None:
        _binary_manager = BinaryManager()
    return _binary_manager
