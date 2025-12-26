"""
Card Reader - Detect and browse camera cards/drives.
Supports detection of common camera card structures.
"""
import os
import platform
from pathlib import Path
from typing import List, Dict, Any


# Known camera folder structures
CAMERA_SIGNATURES = {
    "RED": ["CLIPSD", ".RDC"],  # RED cameras
    "ARRI": ["ARRIRAW"],  # ARRI cameras
    "Blackmagic": ["BRAW"],  # Blackmagic cameras
    "Sony": ["XAVC", "XDROOT"],  # Sony cameras
    "Canon": ["DCIM", "CANONMSC"],  # Canon cameras
    "Panasonic": ["PRIVATE/AVCHD", "CONTENTS"],  # Panasonic cameras
}


class CardReader:
    """Detect and read camera cards/media drives."""

    def list_drives(self) -> List[Dict[str, Any]]:
        """List all mounted drives/volumes."""
        system = platform.system()

        if system == "Darwin":  # macOS
            return self._list_macos_drives()
        elif system == "Windows":
            return self._list_windows_drives()
        else:  # Linux
            return self._list_linux_drives()

    def _list_macos_drives(self) -> List[Dict[str, Any]]:
        """List drives on macOS."""
        drives = []
        volumes_path = Path("/Volumes")

        if volumes_path.exists():
            for volume in volumes_path.iterdir():
                if volume.is_dir():
                    drive_type = self._detect_drive_type(volume)
                    try:
                        stat = os.statvfs(volume)
                        total_space = stat.f_blocks * stat.f_frsize
                        free_space = stat.f_bavail * stat.f_frsize
                    except (PermissionError, OSError):
                        total_space = None
                        free_space = None

                    drives.append({
                        "name": volume.name,
                        "path": str(volume),
                        "type": drive_type,
                        "freeSpace": free_space,
                        "totalSpace": total_space,
                        "cameraType": self._detect_camera_type(volume),
                    })

        return drives

    def _list_windows_drives(self) -> List[Dict[str, Any]]:
        """List drives on Windows."""
        import ctypes
        import string

        drives = []
        bitmask = ctypes.windll.kernel32.GetLogicalDrives()

        for letter in string.ascii_uppercase:
            if bitmask & 1:
                drive_path = Path(f"{letter}:\\")
                if drive_path.exists():
                    drive_type = ctypes.windll.kernel32.GetDriveTypeW(f"{letter}:\\")
                    type_map = {
                        2: "removable",
                        3: "fixed",
                        4: "network",
                        5: "cdrom",
                    }

                    try:
                        import shutil
                        usage = shutil.disk_usage(drive_path)
                        total_space = usage.total
                        free_space = usage.free
                    except (PermissionError, OSError):
                        total_space = None
                        free_space = None

                    drives.append({
                        "name": f"{letter}:",
                        "path": str(drive_path),
                        "type": type_map.get(drive_type, "unknown"),
                        "freeSpace": free_space,
                        "totalSpace": total_space,
                        "cameraType": self._detect_camera_type(drive_path),
                    })
            bitmask >>= 1

        return drives

    def _list_linux_drives(self) -> List[Dict[str, Any]]:
        """List drives on Linux (including WSL)."""
        drives = []
        seen_paths = set()

        # Standard Linux mount points
        media_paths = [Path("/media"), Path("/run/media")]

        for media_path in media_paths:
            if media_path.exists():
                for item in media_path.iterdir():
                    if item.is_dir():
                        try:
                            current_user = os.getlogin()
                        except OSError:
                            current_user = os.environ.get('USER', '')
                        if item.name == current_user:
                            for subitem in item.iterdir():
                                if subitem.is_dir() and str(subitem) not in seen_paths:
                                    seen_paths.add(str(subitem))
                                    drives.append(self._create_linux_drive_entry(subitem))
                        elif str(item) not in seen_paths:
                            seen_paths.add(str(item))
                            drives.append(self._create_linux_drive_entry(item))

        # WSL: Check /mnt for Windows drives (c, d, e, etc.)
        mnt_path = Path("/mnt")
        if mnt_path.exists():
            for item in mnt_path.iterdir():
                # Single letter = Windows drive in WSL
                if item.is_dir() and len(item.name) == 1 and item.name.isalpha():
                    if str(item) not in seen_paths:
                        seen_paths.add(str(item))
                        entry = self._create_linux_drive_entry(item)
                        entry["name"] = f"{item.name.upper()}: (Windows)"
                        entry["type"] = "fixed"
                        drives.append(entry)
                # Also check for other mounts in /mnt
                elif item.is_dir() and len(item.name) > 1:
                    if str(item) not in seen_paths:
                        seen_paths.add(str(item))
                        drives.append(self._create_linux_drive_entry(item))

        # Also add home directory as an option for testing/local files
        home = Path.home()
        if str(home) not in seen_paths:
            seen_paths.add(str(home))
            entry = self._create_linux_drive_entry(home)
            entry["name"] = f"Home ({home.name})"
            entry["type"] = "fixed"
            drives.append(entry)

        return drives

    def _create_linux_drive_entry(self, path: Path) -> Dict[str, Any]:
        """Create a drive entry for Linux."""
        try:
            stat = os.statvfs(path)
            total_space = stat.f_blocks * stat.f_frsize
            free_space = stat.f_bavail * stat.f_frsize
        except (PermissionError, OSError):
            total_space = None
            free_space = None

        return {
            "name": path.name,
            "path": str(path),
            "type": "removable",
            "freeSpace": free_space,
            "totalSpace": total_space,
            "cameraType": self._detect_camera_type(path),
        }

    def _detect_drive_type(self, path: Path) -> str:
        """Detect the type of drive."""
        # Simple heuristic - could be improved with system calls
        name_lower = path.name.lower()
        if any(x in name_lower for x in ["usb", "card", "sd", "cf", "cfast"]):
            return "removable"
        if "network" in name_lower or "nas" in name_lower:
            return "network"
        return "fixed"

    def _detect_camera_type(self, path: Path) -> str | None:
        """Detect what type of camera card this is based on folder structure."""
        if not path.exists():
            return None

        for camera, signatures in CAMERA_SIGNATURES.items():
            for sig in signatures:
                check_path = path / sig
                if check_path.exists():
                    return camera

        return None

    def find_media_files(self, path: Path, recursive: bool = True) -> List[Dict[str, Any]]:
        """Find all media files in a directory."""
        media_extensions = {
            ".mov", ".mp4", ".mxf", ".avi", ".r3d", ".braw",
            ".arw", ".dng", ".cr3", ".nef", ".raf"
        }

        files = []
        pattern = "**/*" if recursive else "*"

        for file_path in path.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in media_extensions:
                try:
                    stat = file_path.stat()
                    files.append({
                        "name": file_path.name,
                        "path": str(file_path),
                        "size": stat.st_size,
                        "modifiedAt": stat.st_mtime,
                        "extension": file_path.suffix.lower(),
                    })
                except (PermissionError, OSError):
                    continue

        return files
