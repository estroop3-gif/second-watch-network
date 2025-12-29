"""
ExifTool service for comprehensive metadata extraction.

ExifTool can read metadata from virtually any file format,
including camera RAW files, video files, audio, and documents.

License: GPL-1.0+ / Artistic License
"""
import json
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.services.binary_manager import BinaryManager


@dataclass
class CameraMetadata:
    """Camera and shooting information."""
    make: str = ""
    model: str = ""
    serial_number: str = ""
    lens_make: str = ""
    lens_model: str = ""
    lens_serial: str = ""
    focal_length: str = ""
    focal_length_35mm: str = ""
    aperture: str = ""
    shutter_speed: str = ""
    iso: int = 0
    exposure_mode: str = ""
    metering_mode: str = ""
    white_balance: str = ""
    flash: str = ""


@dataclass
class GPSData:
    """GPS location information."""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude: Optional[float] = None
    timestamp: str = ""
    speed: Optional[float] = None
    direction: Optional[float] = None


@dataclass
class DateTimeInfo:
    """Date/time metadata."""
    create_date: str = ""
    modify_date: str = ""
    date_time_original: str = ""
    file_modify_date: str = ""
    media_create_date: str = ""
    media_modify_date: str = ""


@dataclass
class FileMetadata:
    """Complete file metadata from ExifTool."""
    file_path: str = ""
    file_name: str = ""
    file_size: int = 0
    file_type: str = ""
    file_type_extension: str = ""
    mime_type: str = ""
    camera: CameraMetadata = field(default_factory=CameraMetadata)
    gps: GPSData = field(default_factory=GPSData)
    dates: DateTimeInfo = field(default_factory=DateTimeInfo)
    image_width: int = 0
    image_height: int = 0
    bit_depth: int = 0
    color_space: str = ""
    orientation: int = 1
    software: str = ""
    artist: str = ""
    copyright: str = ""
    title: str = ""
    description: str = ""
    keywords: List[str] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


class ExifToolService:
    """Service for extracting metadata using ExifTool."""

    def __init__(self):
        self._binary_manager = BinaryManager()
        self._exiftool_path: Optional[Path] = None

    @property
    def is_available(self) -> bool:
        """Check if ExifTool is available."""
        return self._binary_manager.is_available("exiftool")

    @property
    def exiftool_path(self) -> Optional[Path]:
        """Get the path to the ExifTool binary."""
        if self._exiftool_path is None:
            self._exiftool_path = self._binary_manager.get_binary_path("exiftool")
        return self._exiftool_path

    def get_version(self) -> Optional[str]:
        """Get the ExifTool version."""
        return self._binary_manager.get_version("exiftool")

    def extract_metadata(self, file_path: str) -> Optional[FileMetadata]:
        """
        Extract all metadata from a file.

        Args:
            file_path: Path to the file

        Returns:
            FileMetadata object, or None if failed
        """
        raw = self.get_raw_json(file_path)
        if raw is None:
            return None

        return self._parse_metadata(file_path, raw)

    def get_raw_json(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Get raw ExifTool JSON output.

        Args:
            file_path: Path to the file

        Returns:
            Raw metadata as dictionary, or None if failed
        """
        if not self.is_available:
            return None

        path = Path(file_path)
        if not path.exists():
            return None

        try:
            result = subprocess.run(
                [str(self.exiftool_path), "-json", "-G", "-n", str(path)],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                return None

            data = json.loads(result.stdout)
            if data and len(data) > 0:
                return data[0]
            return None

        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            return None

    def batch_extract(self, file_paths: List[str]) -> List[Dict[str, Any]]:
        """
        Extract metadata from multiple files in one call.

        Args:
            file_paths: List of file paths

        Returns:
            List of metadata dictionaries
        """
        if not self.is_available or not file_paths:
            return []

        # Filter to existing files
        existing = [p for p in file_paths if Path(p).exists()]
        if not existing:
            return []

        try:
            cmd = [str(self.exiftool_path), "-json", "-G", "-n"] + existing
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes for batch
            )

            if result.returncode != 0:
                return []

            return json.loads(result.stdout)

        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            return []

    def extract_camera_data(self, file_path: str) -> Optional[CameraMetadata]:
        """Extract only camera-related metadata."""
        raw = self.get_raw_json(file_path)
        if raw is None:
            return None

        return self._parse_camera_metadata(raw)

    def extract_gps_data(self, file_path: str) -> Optional[GPSData]:
        """Extract only GPS metadata."""
        raw = self.get_raw_json(file_path)
        if raw is None:
            return None

        return self._parse_gps_data(raw)

    def read_sidecar(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Read XMP sidecar file if it exists.

        Args:
            file_path: Path to the main file

        Returns:
            Sidecar metadata, or None if no sidecar exists
        """
        path = Path(file_path)
        xmp_path = path.with_suffix(".xmp")

        if not xmp_path.exists():
            # Try lowercase
            xmp_path = path.with_suffix(".XMP")
            if not xmp_path.exists():
                return None

        return self.get_raw_json(str(xmp_path))

    def write_metadata(self, file_path: str, metadata: Dict[str, Any]) -> bool:
        """
        Write metadata to a file.

        Args:
            file_path: Path to the file
            metadata: Dictionary of tag=value pairs

        Returns:
            True if successful
        """
        if not self.is_available:
            return False

        path = Path(file_path)
        if not path.exists():
            return False

        try:
            # Build command with tag assignments
            cmd = [str(self.exiftool_path), "-overwrite_original"]
            for tag, value in metadata.items():
                cmd.append(f"-{tag}={value}")
            cmd.append(str(path))

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            return result.returncode == 0

        except (subprocess.TimeoutExpired, Exception):
            return False

    def copy_metadata(
        self,
        source_path: str,
        target_path: str,
        tags: Optional[List[str]] = None
    ) -> bool:
        """
        Copy metadata from source file to target file.

        Uses ExifTool's -TagsFromFile feature to transfer metadata
        between files. Can copy all tags or specific tags.

        Args:
            source_path: Path to source file with metadata to copy
            target_path: Path to target file to receive metadata
            tags: Optional list of specific tags to copy. If None, copies all.

        Returns:
            True if successful
        """
        if not self.is_available:
            return False

        source = Path(source_path)
        target = Path(target_path)

        if not source.exists() or not target.exists():
            return False

        try:
            cmd = [
                str(self.exiftool_path),
                "-overwrite_original",
                f"-TagsFromFile",
                str(source),
            ]

            if tags:
                # Copy only specific tags
                for tag in tags:
                    cmd.append(f"-{tag}")
            else:
                # Copy all tags
                cmd.append("-all:all")

            cmd.append(str(target))

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            return result.returncode == 0

        except (subprocess.TimeoutExpired, Exception):
            return False

    def write_sidecar(self, file_path: str, output_path: Optional[str] = None) -> bool:
        """
        Generate an XMP sidecar file with all metadata from the source.

        Args:
            file_path: Path to the source file
            output_path: Optional path for output XMP. If None, uses source path with .xmp extension.

        Returns:
            True if successful
        """
        if not self.is_available:
            return False

        source = Path(file_path)
        if not source.exists():
            return False

        if output_path:
            xmp_path = Path(output_path)
        else:
            xmp_path = source.with_suffix(".xmp")

        try:
            cmd = [
                str(self.exiftool_path),
                "-o",
                str(xmp_path),
                "-xmp",
                str(source),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60
            )

            return result.returncode == 0 and xmp_path.exists()

        except (subprocess.TimeoutExpired, Exception):
            return False

    def batch_write(
        self,
        file_paths: List[str],
        metadata: Dict[str, Any]
    ) -> Dict[str, bool]:
        """
        Apply the same metadata to multiple files.

        Args:
            file_paths: List of file paths to modify
            metadata: Dictionary of tag=value pairs to apply

        Returns:
            Dictionary mapping file paths to success status
        """
        if not self.is_available or not file_paths or not metadata:
            return {f: False for f in file_paths}

        results = {}

        # Filter to existing files
        existing = [(p, Path(p)) for p in file_paths if Path(p).exists()]

        if not existing:
            return {f: False for f in file_paths}

        try:
            # Build command with tag assignments
            cmd = [str(self.exiftool_path), "-overwrite_original"]
            for tag, value in metadata.items():
                cmd.append(f"-{tag}={value}")

            for file_str, _ in existing:
                cmd.append(file_str)

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )

            # If successful, mark all as success
            if result.returncode == 0:
                for file_str, _ in existing:
                    results[file_str] = True
            else:
                # Need to check individually which failed
                for file_str, _ in existing:
                    results[file_str] = False

        except (subprocess.TimeoutExpired, Exception):
            for file_str, _ in existing:
                results[file_str] = False

        # Mark non-existing files as failed
        for f in file_paths:
            if f not in results:
                results[f] = False

        return results

    def _parse_metadata(self, file_path: str, raw: Dict[str, Any]) -> FileMetadata:
        """Parse raw ExifTool output into structured data."""
        meta = FileMetadata(
            file_path=file_path,
            file_name=raw.get("File:FileName", ""),
            file_size=self._get_int(raw, "File:FileSize"),
            file_type=raw.get("File:FileType", ""),
            file_type_extension=raw.get("File:FileTypeExtension", ""),
            mime_type=raw.get("File:MIMEType", ""),
            camera=self._parse_camera_metadata(raw),
            gps=self._parse_gps_data(raw),
            dates=self._parse_dates(raw),
            image_width=self._get_int(raw, "File:ImageWidth") or self._get_int(raw, "EXIF:ImageWidth"),
            image_height=self._get_int(raw, "File:ImageHeight") or self._get_int(raw, "EXIF:ImageHeight"),
            bit_depth=self._get_int(raw, "File:BitsPerSample"),
            color_space=raw.get("EXIF:ColorSpace", ""),
            orientation=self._get_int(raw, "EXIF:Orientation") or 1,
            software=raw.get("EXIF:Software", ""),
            artist=raw.get("EXIF:Artist", ""),
            copyright=raw.get("EXIF:Copyright", ""),
            title=raw.get("XMP:Title", ""),
            description=raw.get("EXIF:ImageDescription", "") or raw.get("XMP:Description", ""),
            keywords=self._get_list(raw, "XMP:Subject") or self._get_list(raw, "IPTC:Keywords"),
            raw_data=raw,
        )
        return meta

    def _parse_camera_metadata(self, raw: Dict[str, Any]) -> CameraMetadata:
        """Parse camera-related metadata."""
        return CameraMetadata(
            make=raw.get("EXIF:Make", ""),
            model=raw.get("EXIF:Model", ""),
            serial_number=raw.get("EXIF:SerialNumber", ""),
            lens_make=raw.get("EXIF:LensMake", ""),
            lens_model=raw.get("EXIF:LensModel", "") or raw.get("EXIF:Lens", ""),
            lens_serial=raw.get("EXIF:LensSerialNumber", ""),
            focal_length=raw.get("EXIF:FocalLength", ""),
            focal_length_35mm=raw.get("EXIF:FocalLengthIn35mmFormat", ""),
            aperture=raw.get("EXIF:FNumber", "") or raw.get("EXIF:ApertureValue", ""),
            shutter_speed=raw.get("EXIF:ExposureTime", "") or raw.get("EXIF:ShutterSpeedValue", ""),
            iso=self._get_int(raw, "EXIF:ISO"),
            exposure_mode=raw.get("EXIF:ExposureMode", ""),
            metering_mode=raw.get("EXIF:MeteringMode", ""),
            white_balance=raw.get("EXIF:WhiteBalance", ""),
            flash=raw.get("EXIF:Flash", ""),
        )

    def _parse_gps_data(self, raw: Dict[str, Any]) -> GPSData:
        """Parse GPS metadata."""
        lat = self._get_float(raw, "EXIF:GPSLatitude")
        lon = self._get_float(raw, "EXIF:GPSLongitude")

        # Apply reference (N/S, E/W)
        lat_ref = raw.get("EXIF:GPSLatitudeRef", "N")
        lon_ref = raw.get("EXIF:GPSLongitudeRef", "E")

        if lat and lat_ref == "S":
            lat = -lat
        if lon and lon_ref == "W":
            lon = -lon

        return GPSData(
            latitude=lat,
            longitude=lon,
            altitude=self._get_float(raw, "EXIF:GPSAltitude"),
            timestamp=raw.get("EXIF:GPSTimeStamp", ""),
            speed=self._get_float(raw, "EXIF:GPSSpeed"),
            direction=self._get_float(raw, "EXIF:GPSImgDirection"),
        )

    def _parse_dates(self, raw: Dict[str, Any]) -> DateTimeInfo:
        """Parse date/time metadata."""
        return DateTimeInfo(
            create_date=raw.get("EXIF:CreateDate", ""),
            modify_date=raw.get("EXIF:ModifyDate", ""),
            date_time_original=raw.get("EXIF:DateTimeOriginal", ""),
            file_modify_date=raw.get("File:FileModifyDate", ""),
            media_create_date=raw.get("QuickTime:MediaCreateDate", ""),
            media_modify_date=raw.get("QuickTime:MediaModifyDate", ""),
        )

    def _get_int(self, data: Dict[str, Any], key: str) -> int:
        """Safely get an integer value."""
        value = data.get(key)
        if value is None:
            return 0
        try:
            return int(float(str(value)))
        except (ValueError, TypeError):
            return 0

    def _get_float(self, data: Dict[str, Any], key: str) -> Optional[float]:
        """Safely get a float value."""
        value = data.get(key)
        if value is None:
            return None
        try:
            return float(str(value))
        except (ValueError, TypeError):
            return None

    def _get_list(self, data: Dict[str, Any], key: str) -> List[str]:
        """Get a value as a list of strings."""
        value = data.get(key)
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v) for v in value]
        return [str(value)]


# Singleton instance
_service: Optional[ExifToolService] = None


def get_exiftool_service() -> ExifToolService:
    """Get the singleton ExifTool service instance."""
    global _service
    if _service is None:
        _service = ExifToolService()
    return _service
