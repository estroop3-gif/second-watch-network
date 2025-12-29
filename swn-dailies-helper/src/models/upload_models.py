"""
Data models for the unified upload system.
Combines Dailies, Review, and Assets uploads into one workflow.
"""
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
import uuid


# File type extension sets
VIDEO_EXTENSIONS = {
    '.mov', '.mp4', '.mxf', '.avi', '.r3d', '.braw', '.ari', '.arx',
    '.dng', '.cine', '.mts', '.m2ts', '.mkv', '.webm', '.wmv', '.flv'
}

AUDIO_EXTENSIONS = {
    '.wav', '.mp3', '.aac', '.flac', '.aiff', '.ogg', '.m4a', '.wma'
}

IMAGE_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.tiff', '.tif', '.psd', '.exr', '.bmp',
    '.gif', '.webp', '.heic', '.raw', '.cr2', '.nef', '.arw', '.dng'
}

DOCUMENT_EXTENSIONS = {
    '.doc', '.docx', '.txt', '.rtf', '.xls', '.xlsx', '.csv',
    '.ppt', '.pptx', '.pdf', '.md'
}

GRAPHICS_EXTENSIONS = {
    '.ai', '.eps', '.svg', '.indd'
}

MODEL_3D_EXTENSIONS = {
    '.obj', '.fbx', '.gltf', '.glb', '.blend', '.c4d', '.maya',
    '.max', '.stl', '.dae', '.3ds', '.usdz'
}


@dataclass
class DailiesConfig:
    """Configuration for Dailies destination."""
    project_id: str
    production_day_id: Optional[str] = None
    camera_label: str = "A"
    roll_name: str = "001"
    generate_proxy: bool = True
    register_clips: bool = True


@dataclass
class ReviewConfig:
    """Configuration for Review destination."""
    project_id: str
    folder_id: Optional[str] = None
    folder_name: Optional[str] = None
    asset_name: Optional[str] = None
    description: str = ""
    transcode_quality: Literal["low", "medium", "high"] = "high"


@dataclass
class AssetsConfig:
    """Configuration for Assets destination."""
    project_id: str
    folder_id: Optional[str] = None
    folder_name: Optional[str] = None
    category: str = "other"
    tags: List[str] = field(default_factory=list)
    description: str = ""


DestinationConfig = DailiesConfig | ReviewConfig | AssetsConfig


@dataclass
class UnifiedUploadJob:
    """Single file in the unified upload queue."""
    id: str
    file_path: Path
    file_name: str
    file_size: int
    file_type: str  # extension

    # Destination
    destination: Literal["dailies", "review", "assets"]
    destination_config: Dict[str, Any]

    # Smart routing
    auto_detected: bool = True
    suggested_destination: Optional[str] = None

    # Status
    status: Literal["pending", "uploading", "verifying", "completed", "failed", "paused"] = "pending"
    progress: float = 0.0
    error_message: Optional[str] = None

    # Checksums
    local_checksum: Optional[str] = None
    remote_checksum: Optional[str] = None
    checksum_verified: bool = False

    # Remote info
    s3_key: Optional[str] = None
    cloud_url: Optional[str] = None

    # Source tracking
    source: Literal["manual", "offload", "watch_folder"] = "manual"
    manifest_id: Optional[str] = None

    # Timestamps
    queued_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        file_path: Path,
        destination: Optional[Literal["dailies", "review", "assets"]] = None,
        destination_config: Optional[Dict[str, Any]] = None,
        source: Literal["manual", "offload", "watch_folder"] = "manual",
        manifest_id: Optional[str] = None,
    ) -> "UnifiedUploadJob":
        """Create a new upload job with auto-detection."""
        file_path = Path(file_path)

        # Auto-detect destination if not specified
        auto_detected = destination is None
        if auto_detected:
            destination, suggested_config = detect_destination(file_path)
            destination_config = destination_config or suggested_config
        else:
            destination_config = destination_config or {}

        return cls(
            id=str(uuid.uuid4()),
            file_path=file_path,
            file_name=file_path.name,
            file_size=file_path.stat().st_size if file_path.exists() else 0,
            file_type=file_path.suffix.lower(),
            destination=destination,
            destination_config=destination_config,
            auto_detected=auto_detected,
            suggested_destination=destination if auto_detected else None,
            source=source,
            manifest_id=manifest_id,
        )

    @property
    def size_formatted(self) -> str:
        """Return human-readable size."""
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    @property
    def destination_summary(self) -> str:
        """Get a short summary of the destination."""
        if self.destination == "dailies":
            camera = self.destination_config.get("camera_label", "A")
            return f"Dailies (Cam{camera})"
        elif self.destination == "review":
            return "Review"
        elif self.destination == "assets":
            category = self.destination_config.get("category", "other")
            return f"Assets ({category.title()})"
        return self.destination.title()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for persistence."""
        return {
            "id": self.id,
            "file_path": str(self.file_path),
            "file_name": self.file_name,
            "file_size": self.file_size,
            "file_type": self.file_type,
            "destination": self.destination,
            "destination_config": self.destination_config,
            "auto_detected": self.auto_detected,
            "suggested_destination": self.suggested_destination,
            "status": self.status,
            "progress": self.progress,
            "error_message": self.error_message,
            "local_checksum": self.local_checksum,
            "remote_checksum": self.remote_checksum,
            "checksum_verified": self.checksum_verified,
            "s3_key": self.s3_key,
            "cloud_url": self.cloud_url,
            "source": self.source,
            "manifest_id": self.manifest_id,
            "queued_at": self.queued_at.isoformat() if self.queued_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UnifiedUploadJob":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            file_path=Path(data["file_path"]),
            file_name=data["file_name"],
            file_size=data["file_size"],
            file_type=data["file_type"],
            destination=data["destination"],
            destination_config=data.get("destination_config", {}),
            auto_detected=data.get("auto_detected", True),
            suggested_destination=data.get("suggested_destination"),
            status=data.get("status", "pending"),
            progress=data.get("progress", 0.0),
            error_message=data.get("error_message"),
            local_checksum=data.get("local_checksum"),
            remote_checksum=data.get("remote_checksum"),
            checksum_verified=data.get("checksum_verified", False),
            s3_key=data.get("s3_key"),
            cloud_url=data.get("cloud_url"),
            source=data.get("source", "manual"),
            manifest_id=data.get("manifest_id"),
            queued_at=datetime.fromisoformat(data["queued_at"]) if data.get("queued_at") else datetime.now(),
            started_at=datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
        )


@dataclass
class UploadSession:
    """Collection of upload jobs with shared settings."""
    id: str
    name: str
    jobs: List[UnifiedUploadJob] = field(default_factory=list)

    # Session settings
    auto_upload: bool = False
    verify_checksums: bool = True
    generate_proxies: bool = True
    parallel_uploads: int = 3

    # Backend
    backend: Literal["rclone", "direct"] = "rclone"

    # Progress
    status: Literal["pending", "active", "paused", "completed", "failed"] = "pending"
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @classmethod
    def create(cls, name: Optional[str] = None) -> "UploadSession":
        """Create a new upload session."""
        session_id = str(uuid.uuid4())[:8]
        if name is None:
            name = f"Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"

        return cls(id=session_id, name=name)

    @property
    def total_size(self) -> int:
        """Total size of all jobs."""
        return sum(j.file_size for j in self.jobs)

    @property
    def uploaded_size(self) -> int:
        """Total size of completed jobs."""
        return sum(j.file_size for j in self.jobs if j.status == "completed")

    @property
    def total_size_formatted(self) -> str:
        """Human-readable total size."""
        size = self.total_size
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    @property
    def progress_percent(self) -> float:
        """Overall progress percentage."""
        if self.total_size == 0:
            return 0.0
        return (self.uploaded_size / self.total_size) * 100

    @property
    def pending_count(self) -> int:
        return sum(1 for j in self.jobs if j.status == "pending")

    @property
    def completed_count(self) -> int:
        return sum(1 for j in self.jobs if j.status == "completed")

    @property
    def failed_count(self) -> int:
        return sum(1 for j in self.jobs if j.status == "failed")

    def add_job(self, job: UnifiedUploadJob) -> None:
        """Add a job to the session."""
        self.jobs.append(job)

    def remove_job(self, job_id: str) -> None:
        """Remove a job from the session."""
        self.jobs = [j for j in self.jobs if j.id != job_id]

    def get_job(self, job_id: str) -> Optional[UnifiedUploadJob]:
        """Get a job by ID."""
        return next((j for j in self.jobs if j.id == job_id), None)

    def get_pending_jobs(self) -> List[UnifiedUploadJob]:
        """Get all pending jobs."""
        return [j for j in self.jobs if j.status == "pending"]

    def get_failed_jobs(self) -> List[UnifiedUploadJob]:
        """Get all failed jobs."""
        return [j for j in self.jobs if j.status == "failed"]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for persistence."""
        return {
            "id": self.id,
            "name": self.name,
            "jobs": [j.to_dict() for j in self.jobs],
            "auto_upload": self.auto_upload,
            "verify_checksums": self.verify_checksums,
            "generate_proxies": self.generate_proxies,
            "parallel_uploads": self.parallel_uploads,
            "backend": self.backend,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UploadSession":
        """Create from dictionary."""
        session = cls(
            id=data["id"],
            name=data["name"],
            auto_upload=data.get("auto_upload", False),
            verify_checksums=data.get("verify_checksums", True),
            generate_proxies=data.get("generate_proxies", True),
            parallel_uploads=data.get("parallel_uploads", 3),
            backend=data.get("backend", "rclone"),
            status=data.get("status", "pending"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            started_at=datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
        )
        session.jobs = [UnifiedUploadJob.from_dict(j) for j in data.get("jobs", [])]
        return session


def detect_destination(file_path: Path) -> Tuple[Literal["dailies", "review", "assets"], Dict[str, Any]]:
    """
    Auto-detect best destination based on file type and name patterns.

    Returns:
        Tuple of (destination, config_dict)
    """
    ext = file_path.suffix.lower()
    name = file_path.stem.lower()

    # Video files → Dailies or Review
    if ext in VIDEO_EXTENSIONS:
        # Check filename patterns for review deliverables
        review_patterns = ['final', 'delivery', 'master', 'review', 'client', 'export', 'render']
        if any(p in name for p in review_patterns):
            return "review", {
                "asset_name": file_path.stem,
                "transcode_quality": "high",
            }

        # Default video to dailies
        # Try to detect camera label from filename
        camera = "A"
        for label in ['a', 'b', 'c', 'd', 'e']:
            if f'cam{label}' in name or f'camera{label}' in name or name.startswith(label):
                camera = label.upper()
                break

        return "dailies", {
            "camera_label": camera,
            "roll_name": "001",
            "generate_proxy": True,
        }

    # Audio files → Assets (audio category)
    if ext in AUDIO_EXTENSIONS:
        return "assets", {
            "category": "audio",
            "tags": [],
        }

    # Images → Assets (images category)
    if ext in IMAGE_EXTENSIONS:
        return "assets", {
            "category": "images",
            "tags": [],
        }

    # Graphics → Assets (graphics category)
    if ext in GRAPHICS_EXTENSIONS:
        return "assets", {
            "category": "graphics",
            "tags": [],
        }

    # Documents → Assets (documents category)
    if ext in DOCUMENT_EXTENSIONS:
        return "assets", {
            "category": "documents",
            "tags": [],
        }

    # 3D Models → Assets (3d_models category)
    if ext in MODEL_3D_EXTENSIONS:
        return "assets", {
            "category": "3d_models",
            "tags": [],
        }

    # Default to assets with "other" category
    return "assets", {
        "category": "other",
        "tags": [],
    }


def get_file_category(file_path: Path) -> str:
    """Get the category for a file based on its extension."""
    ext = file_path.suffix.lower()

    if ext in VIDEO_EXTENSIONS:
        return "video"
    elif ext in AUDIO_EXTENSIONS:
        return "audio"
    elif ext in IMAGE_EXTENSIONS:
        return "images"
    elif ext in GRAPHICS_EXTENSIONS:
        return "graphics"
    elif ext in DOCUMENT_EXTENSIONS:
        return "documents"
    elif ext in MODEL_3D_EXTENSIONS:
        return "3d_models"

    return "other"
