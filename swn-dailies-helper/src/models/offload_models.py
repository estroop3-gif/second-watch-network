"""
Data models for the offload workflow.
"""
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Literal, Dict, Any
import uuid


# Audio file extensions for auto-detection
AUDIO_EXTENSIONS = {'.wav', '.mp3', '.aac', '.flac', '.aiff', '.ogg', '.m4a'}

# Video/camera file extensions
VIDEO_EXTENSIONS = {
    '.mov', '.mp4', '.mxf', '.braw', '.r3d', '.ari', '.arx',
    '.dng', '.cine', '.mts', '.m2ts', '.avi', '.mkv'
}

# Date format options
DATE_FORMATS = {
    "MMDDYYYY": "%m%d%Y",
    "DDMMYYYY": "%d%m%Y",
    "YYYYMMDD": "%Y%m%d",
    "YYYY-MM-DD": "%Y-%m-%d",
    "MM-DD-YYYY": "%m-%d-%Y",
    "DD-MM-YYYY": "%d-%m-%Y",
}


@dataclass
class OffloadSource:
    """Single source card/folder in the offload queue."""
    id: str
    path: Path
    display_name: str
    source_type: Literal["card", "folder"]
    media_type: Literal["camera", "audio"]
    camera_label: str  # "A", "B", "C" or empty for audio
    detected_camera: Optional[str]  # "Canon", "Sony", "RED", etc.
    files: List[Path]
    total_size: int  # bytes
    fingerprint: Optional[str] = None
    previous_offload: Optional[Dict[str, Any]] = None
    sort_order: int = 0

    @classmethod
    def create(
        cls,
        path: Path,
        source_type: Literal["card", "folder"],
        files: List[Path],
        camera_label: str,
        detected_camera: Optional[str] = None,
        display_name: Optional[str] = None,
    ) -> "OffloadSource":
        """Create a new offload source with auto-detection."""
        media_type = detect_media_type(files)
        total_size = sum(f.stat().st_size for f in files if f.exists())

        if display_name is None:
            if detected_camera:
                display_name = f"{detected_camera} ({camera_label})"
            else:
                display_name = path.name

        return cls(
            id=str(uuid.uuid4()),
            path=path,
            display_name=display_name,
            source_type=source_type,
            media_type=media_type,
            camera_label=camera_label,
            detected_camera=detected_camera,
            files=files,
            total_size=total_size,
        )

    @property
    def file_count(self) -> int:
        return len(self.files)

    @property
    def size_formatted(self) -> str:
        """Return human-readable size."""
        size = self.total_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"


@dataclass
class OffloadQueue:
    """Collection of sources to offload in sequence."""
    sources: List[OffloadSource] = field(default_factory=list)
    _next_camera_index: int = field(default=0, repr=False)

    def add_source(self, source: OffloadSource) -> None:
        """Add a source to the queue."""
        source.sort_order = len(self.sources)
        self.sources.append(source)

    def remove_source(self, source_id: str) -> None:
        """Remove a source from the queue."""
        self.sources = [s for s in self.sources if s.id != source_id]
        self._reindex()

    def reorder(self, source_id: str, new_index: int) -> None:
        """Move a source to a new position in the queue."""
        source = next((s for s in self.sources if s.id == source_id), None)
        if source is None:
            return

        self.sources.remove(source)
        new_index = max(0, min(new_index, len(self.sources)))
        self.sources.insert(new_index, source)
        self._reindex()

    def get_next_camera_label(self) -> str:
        """Get the next available camera label (A, B, C, ...)."""
        # Find used labels
        used_labels = {s.camera_label for s in self.sources if s.media_type == "camera"}

        # Find next available letter
        for i in range(26):
            label = chr(ord('A') + i)
            if label not in used_labels:
                return label

        # Fallback to numbered labels
        return f"Cam{len(used_labels) + 1}"

    def _reindex(self) -> None:
        """Update sort_order for all sources."""
        for i, source in enumerate(self.sources):
            source.sort_order = i

    @property
    def total_files(self) -> int:
        return sum(s.file_count for s in self.sources)

    @property
    def total_size(self) -> int:
        return sum(s.total_size for s in self.sources)

    @property
    def camera_sources(self) -> List[OffloadSource]:
        return [s for s in self.sources if s.media_type == "camera"]

    @property
    def audio_sources(self) -> List[OffloadSource]:
        return [s for s in self.sources if s.media_type == "audio"]

    def clear(self) -> None:
        """Remove all sources from the queue."""
        self.sources.clear()
        self._next_camera_index = 0


@dataclass
class DestinationDrive:
    """Single destination drive."""
    id: str
    path: Path
    display_name: str
    free_space: int  # bytes
    total_space: int  # bytes
    is_primary: bool = False

    @classmethod
    def create(cls, path: Path, is_primary: bool = False) -> "DestinationDrive":
        """Create a destination drive from a path."""
        import shutil

        display_name = path.name or str(path)
        try:
            usage = shutil.disk_usage(path)
            free_space = usage.free
            total_space = usage.total
        except (OSError, FileNotFoundError):
            free_space = 0
            total_space = 0

        return cls(
            id=str(uuid.uuid4()),
            path=path,
            display_name=display_name,
            free_space=free_space,
            total_space=total_space,
            is_primary=is_primary,
        )

    @property
    def free_space_formatted(self) -> str:
        """Return human-readable free space."""
        size = self.free_space
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"


@dataclass
class DestinationConfig:
    """All destination drives."""
    drives: List[DestinationDrive] = field(default_factory=list)

    def add_drive(self, path: Path) -> DestinationDrive:
        """Add a drive to the destinations."""
        is_primary = len(self.drives) == 0
        drive = DestinationDrive.create(path, is_primary=is_primary)
        self.drives.append(drive)
        return drive

    def remove_drive(self, drive_id: str) -> None:
        """Remove a drive from destinations."""
        self.drives = [d for d in self.drives if d.id != drive_id]
        # Ensure first drive is primary
        if self.drives and not any(d.is_primary for d in self.drives):
            self.drives[0].is_primary = True

    def set_primary(self, drive_id: str) -> None:
        """Set a drive as the primary destination."""
        for drive in self.drives:
            drive.is_primary = (drive.id == drive_id)

    @property
    def primary_drive(self) -> Optional[DestinationDrive]:
        """Get the primary destination drive."""
        return next((d for d in self.drives if d.is_primary), None)

    @property
    def backup_drives(self) -> List[DestinationDrive]:
        """Get all backup drives (non-primary)."""
        return [d for d in self.drives if not d.is_primary]

    def has_capacity(self, required_bytes: int) -> bool:
        """Check if all drives have enough free space."""
        return all(d.free_space >= required_bytes for d in self.drives)

    def clear(self) -> None:
        """Remove all drives."""
        self.drives.clear()


@dataclass
class NamingConvention:
    """Folder naming convention configuration."""
    # Date settings
    date_format: str = "MMDDYYYY"
    include_date: bool = True

    # Project info
    project_code: str = ""
    include_project: bool = True

    # Production day
    day_prefix: str = "Day"
    include_day: bool = True

    # Separator
    separator: str = "_"

    # Camera/Audio subfolder naming
    camera_prefix: str = "Cam"
    audio_folder_name: str = "Audio"

    def build_parent_folder(
        self,
        date: Optional[datetime] = None,
        day_number: Optional[int] = None,
    ) -> str:
        """Build parent folder name, e.g., '12272025_SFG_Day1'"""
        if date is None:
            date = datetime.now()

        parts = []

        if self.include_date:
            format_str = DATE_FORMATS.get(self.date_format, "%m%d%Y")
            parts.append(date.strftime(format_str))

        if self.include_project and self.project_code:
            parts.append(self.project_code)

        if self.include_day and day_number is not None:
            parts.append(f"{self.day_prefix}{day_number}")

        return self.separator.join(parts) if parts else "Offload"

    def build_subfolder(self, source: OffloadSource) -> str:
        """Build subfolder name, e.g., 'CamA' or 'Audio'"""
        if source.media_type == "audio":
            return self.audio_folder_name
        return f"{self.camera_prefix}{source.camera_label}"

    def build_full_path(
        self,
        base_path: Path,
        source: OffloadSource,
        date: Optional[datetime] = None,
        day_number: Optional[int] = None,
    ) -> Path:
        """Build full destination path for a source."""
        parent = self.build_parent_folder(date, day_number)
        subfolder = self.build_subfolder(source)
        return base_path / parent / subfolder

    def get_preview(
        self,
        sources: List[OffloadSource],
        date: Optional[datetime] = None,
        day_number: Optional[int] = None,
    ) -> List[str]:
        """Get a preview of the folder structure."""
        if date is None:
            date = datetime.now()
        if day_number is None:
            day_number = 1

        parent = self.build_parent_folder(date, day_number)
        lines = [f"{parent}/"]

        for source in sources:
            subfolder = self.build_subfolder(source)
            lines.append(f"  {subfolder}/")

        return lines

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for persistence."""
        return {
            "date_format": self.date_format,
            "include_date": self.include_date,
            "project_code": self.project_code,
            "include_project": self.include_project,
            "day_prefix": self.day_prefix,
            "include_day": self.include_day,
            "separator": self.separator,
            "camera_prefix": self.camera_prefix,
            "audio_folder_name": self.audio_folder_name,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "NamingConvention":
        """Create from dictionary."""
        return cls(
            date_format=data.get("date_format", "MMDDYYYY"),
            include_date=data.get("include_date", True),
            project_code=data.get("project_code", ""),
            include_project=data.get("include_project", True),
            day_prefix=data.get("day_prefix", "Day"),
            include_day=data.get("include_day", True),
            separator=data.get("separator", "_"),
            camera_prefix=data.get("camera_prefix", "Cam"),
            audio_folder_name=data.get("audio_folder_name", "Audio"),
        )


@dataclass
class BacklotLinkConfig:
    """Configuration for Backlot upload destinations."""
    enabled: bool = False
    project_id: Optional[str] = None
    project_name: Optional[str] = None  # For display
    production_day_id: Optional[str] = None
    production_day_number: Optional[int] = None  # For display

    # Destination checkboxes
    upload_to_dailies: bool = True
    upload_to_assets: bool = False
    upload_to_review: bool = False

    def get_summary(self) -> str:
        """Get a summary string for display."""
        if not self.enabled or not self.project_name:
            return "Not configured"

        destinations = []
        if self.upload_to_dailies:
            destinations.append("Dailies")
        if self.upload_to_assets:
            destinations.append("Assets")
        if self.upload_to_review:
            destinations.append("Review")

        day_str = f" Day {self.production_day_number}" if self.production_day_number else ""
        dest_str = f" ({', '.join(destinations)})" if destinations else ""

        return f"{self.project_name}{day_str}{dest_str}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for persistence."""
        return {
            "enabled": self.enabled,
            "project_id": self.project_id,
            "project_name": self.project_name,
            "production_day_id": self.production_day_id,
            "production_day_number": self.production_day_number,
            "upload_to_dailies": self.upload_to_dailies,
            "upload_to_assets": self.upload_to_assets,
            "upload_to_review": self.upload_to_review,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BacklotLinkConfig":
        """Create from dictionary."""
        return cls(
            enabled=data.get("enabled", False),
            project_id=data.get("project_id"),
            project_name=data.get("project_name"),
            production_day_id=data.get("production_day_id"),
            production_day_number=data.get("production_day_number"),
            upload_to_dailies=data.get("upload_to_dailies", True),
            upload_to_assets=data.get("upload_to_assets", False),
            upload_to_review=data.get("upload_to_review", False),
        )


def detect_media_type(files: List[Path]) -> Literal["camera", "audio"]:
    """Auto-detect if source contains camera footage or audio."""
    if not files:
        return "camera"

    audio_count = sum(1 for f in files if f.suffix.lower() in AUDIO_EXTENSIONS)
    video_count = sum(1 for f in files if f.suffix.lower() in VIDEO_EXTENSIONS)
    total = len(files)

    # If >80% audio files, mark as audio
    if audio_count > 0 and total > 0 and audio_count / total > 0.8:
        return "audio"

    return "camera"


@dataclass
class PreFlightFolderInfo:
    """Information about a single destination folder."""
    path: Path
    source_label: str  # "CamA", "Audio", etc.
    file_count: int
    total_size: int
    already_exists: bool
    existing_file_count: int  # Files already in folder

    @property
    def size_formatted(self) -> str:
        """Return human-readable size."""
        size = self.total_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"


@dataclass
class PreFlightDriveInfo:
    """Information about folders on a single drive."""
    drive_path: Path
    drive_name: str
    parent_folder: str  # e.g., "12272025_SFG_Day1"
    folders: List[PreFlightFolderInfo]

    @property
    def has_warnings(self) -> bool:
        return any(f.already_exists for f in self.folders)


@dataclass
class PreFlightCheck:
    """Results of pre-flight verification before offload."""
    drives: List[PreFlightDriveInfo]
    total_files: int
    total_size: int

    @property
    def has_conflicts(self) -> bool:
        """Check if any destination folders already exist."""
        return any(d.has_warnings for d in self.drives)

    @property
    def total_size_formatted(self) -> str:
        """Return human-readable total size."""
        size = self.total_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    @property
    def estimated_time_formatted(self) -> str:
        """Estimate copy time based on ~100 MB/s transfer rate."""
        # Assume ~100 MB/s average transfer speed
        seconds = self.total_size / (100 * 1024 * 1024)
        # Multiply by number of drives (parallel writes)
        num_drives = len(self.drives)
        if num_drives > 1:
            seconds *= 1.2  # Slight overhead for multi-drive

        if seconds < 60:
            return "< 1 minute"
        elif seconds < 3600:
            minutes = int(seconds / 60)
            return f"~{minutes} minute{'s' if minutes != 1 else ''}"
        else:
            hours = seconds / 3600
            return f"~{hours:.1f} hours"

    @classmethod
    def analyze(
        cls,
        sources: List["OffloadSource"],
        destinations: List["DestinationDrive"],
        naming: "NamingConvention",
        day_number: int,
    ) -> "PreFlightCheck":
        """Analyze destinations and check for conflicts."""
        from datetime import datetime

        drives_info = []
        total_files = 0
        total_size = 0

        # Calculate totals from sources
        for source in sources:
            total_files += source.file_count
            total_size += source.total_size

        # Build parent folder name
        parent_folder = naming.build_parent_folder(datetime.now(), day_number)

        # Analyze each destination drive
        for dest in destinations:
            folders_info = []

            for source in sources:
                subfolder = naming.build_subfolder(source)
                full_path = dest.path / parent_folder / subfolder

                # Check if folder exists and count existing files
                already_exists = full_path.exists()
                existing_file_count = 0
                if already_exists:
                    try:
                        existing_file_count = sum(
                            1 for f in full_path.iterdir() if f.is_file()
                        )
                    except (OSError, PermissionError):
                        pass

                folder_info = PreFlightFolderInfo(
                    path=full_path,
                    source_label=subfolder,
                    file_count=source.file_count,
                    total_size=source.total_size,
                    already_exists=already_exists,
                    existing_file_count=existing_file_count,
                )
                folders_info.append(folder_info)

            drive_info = PreFlightDriveInfo(
                drive_path=dest.path,
                drive_name=dest.display_name,
                parent_folder=parent_folder,
                folders=folders_info,
            )
            drives_info.append(drive_info)

        return cls(
            drives=drives_info,
            total_files=total_files,
            total_size=total_size,
        )

    def get_conflict_warnings(self) -> List[str]:
        """Get list of warning messages for existing folders."""
        warnings = []
        for drive in self.drives:
            for folder in drive.folders:
                if folder.already_exists:
                    msg = f"{folder.path}"
                    if folder.existing_file_count > 0:
                        msg += f" (contains {folder.existing_file_count} existing files)"
                    warnings.append(msg)
        return warnings
