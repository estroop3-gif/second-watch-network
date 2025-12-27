"""
Upload Queue Service - Manages pending uploads from offloads and watch folders.
Provides a singleton queue that can be accessed from both OffloadPage and UploadPage.
"""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from threading import Lock
import json

from PyQt6.QtCore import QObject, pyqtSignal

if TYPE_CHECKING:
    from src.services.offload_manifest import OffloadManifest


class QueueItemStatus(str, Enum):
    """Status of an item in the upload queue."""
    PENDING = "pending"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class UploadHistoryEntry:
    """Record of a completed or failed upload."""
    file_name: str
    file_size: int
    project_id: Optional[str]
    status: str  # "completed" or "failed"
    started_at: datetime
    completed_at: datetime
    retry_count: int = 0
    error: Optional[str] = None
    s3_key: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "file_name": self.file_name,
            "file_size": self.file_size,
            "project_id": self.project_id,
            "status": self.status,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat(),
            "retry_count": self.retry_count,
            "error": self.error,
            "s3_key": self.s3_key,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UploadHistoryEntry":
        """Create from dictionary."""
        data = data.copy()
        data["started_at"] = datetime.fromisoformat(data["started_at"])
        data["completed_at"] = datetime.fromisoformat(data["completed_at"])
        return cls(**data)


@dataclass
class UploadQueueItem:
    """Single item in the upload queue."""
    file_path: Path
    file_name: str
    file_size: int
    manifest_id: str  # Link back to OffloadManifest
    project_id: Optional[str] = None
    production_day_id: Optional[str] = None
    camera_label: str = "A"
    roll_name: str = ""
    status: QueueItemStatus = QueueItemStatus.PENDING
    progress: float = 0.0
    error: Optional[str] = None
    added_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None  # When upload started
    generate_proxies: bool = False  # Whether to generate proxy versions after upload
    clip_id: Optional[str] = None  # Set after upload confirms

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "file_path": str(self.file_path),
            "file_name": self.file_name,
            "file_size": self.file_size,
            "manifest_id": self.manifest_id,
            "project_id": self.project_id,
            "production_day_id": self.production_day_id,
            "camera_label": self.camera_label,
            "roll_name": self.roll_name,
            "status": self.status.value,
            "progress": self.progress,
            "error": self.error,
            "added_at": self.added_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "generate_proxies": self.generate_proxies,
            "clip_id": self.clip_id,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UploadQueueItem":
        """Create from dictionary."""
        data = data.copy()
        data["file_path"] = Path(data["file_path"])
        data["status"] = QueueItemStatus(data["status"])
        data["added_at"] = datetime.fromisoformat(data["added_at"])
        if data.get("started_at"):
            data["started_at"] = datetime.fromisoformat(data["started_at"])
        else:
            data["started_at"] = None
        # Handle new fields with defaults for backwards compatibility
        data.setdefault("generate_proxies", False)
        data.setdefault("clip_id", None)
        return cls(**data)


class UploadQueueService(QObject):
    """
    Centralized upload queue that integrates:
    - Offloaded files (when "Upload to cloud" is checked)
    - Watch folder files (auto-detected)

    This is a singleton - use get_instance() to access.
    """

    # Signals for UI updates
    queue_updated = pyqtSignal()  # Emitted when queue changes
    item_progress = pyqtSignal(str, float, str)  # file_path, percent, status_message
    history_updated = pyqtSignal()  # Emitted when history changes

    _instance: Optional["UploadQueueService"] = None
    MAX_HISTORY_ENTRIES = 1000  # Keep last 1000 entries

    def __init__(self, config=None, parent=None):
        super().__init__(parent)
        self.config = config
        self._queue: List[UploadQueueItem] = []
        self._history: List[UploadHistoryEntry] = []
        self._lock = Lock()
        self._history_lock = Lock()
        self._queue_file = Path.home() / ".swn-dailies-helper" / "upload_queue.json"
        self._history_file = Path.home() / ".swn-dailies-helper" / "upload_history.json"
        self._queue_file.parent.mkdir(parents=True, exist_ok=True)
        self._load_queue()
        self._load_history()

    @classmethod
    def get_instance(cls, config=None) -> "UploadQueueService":
        """Get the singleton instance."""
        if cls._instance is None:
            cls._instance = cls(config)
        return cls._instance

    @classmethod
    def reset_instance(cls):
        """Reset the singleton (for testing)."""
        cls._instance = None

    def _load_queue(self):
        """Load queue from disk."""
        if self._queue_file.exists():
            try:
                with open(self._queue_file) as f:
                    data = json.load(f)
                self._queue = [UploadQueueItem.from_dict(item) for item in data]
            except Exception as e:
                print(f"Failed to load upload queue: {e}")
                self._queue = []

    def _save_queue(self):
        """Save queue to disk."""
        try:
            with open(self._queue_file, "w") as f:
                json.dump([item.to_dict() for item in self._queue], f, indent=2)
        except Exception as e:
            print(f"Failed to save upload queue: {e}")

    def add_from_manifest(
        self,
        manifest: "OffloadManifest",
        destination_paths: List[str],
        generate_proxies: bool = False,
    ) -> int:
        """
        Add all files from an offload manifest to the queue.

        Args:
            manifest: The completed offload manifest
            destination_paths: Paths where files were copied
            generate_proxies: Whether to generate proxy versions after upload

        Returns:
            Number of files added to queue
        """
        added = 0
        with self._lock:
            for file_info in manifest.files:
                # Find the actual file path in destinations
                file_found = False
                for dest in destination_paths:
                    if file_info.relative_path:
                        file_path = Path(dest) / file_info.relative_path / file_info.file_name
                    else:
                        file_path = Path(dest) / file_info.file_name

                    if file_path.exists():
                        # Check if already in queue
                        existing = [
                            i for i in self._queue
                            if str(i.file_path) == str(file_path)
                        ]
                        if existing:
                            continue

                        item = UploadQueueItem(
                            file_path=file_path,
                            file_name=file_info.file_name,
                            file_size=file_info.file_size_bytes,
                            manifest_id=manifest.local_id,
                            project_id=manifest.project_id,
                            production_day_id=manifest.production_day_id,
                            camera_label=manifest.camera_label or "A",
                            roll_name=manifest.roll_name or "",
                            generate_proxies=generate_proxies,
                        )
                        self._queue.append(item)
                        added += 1
                        file_found = True
                        break

                if not file_found:
                    print(f"Warning: Could not find file {file_info.file_name} in destinations")

            self._save_queue()

        if added > 0:
            self.queue_updated.emit()

        return added

    def add_file(
        self,
        file_path: Path,
        manifest_id: str = "watch_folder",
        project_id: Optional[str] = None,
        camera_label: str = "A",
        roll_name: str = "",
        **kwargs
    ) -> bool:
        """
        Add a single file to the queue (for watch folder).

        Args:
            file_path: Path to the file
            manifest_id: ID to group files (default: "watch_folder")
            project_id: Optional project ID
            camera_label: Camera label for the file
            roll_name: Roll name for the file

        Returns:
            True if added, False if already in queue
        """
        with self._lock:
            # Check if already in queue
            existing = [i for i in self._queue if str(i.file_path) == str(file_path)]
            if existing:
                return False

            try:
                file_size = file_path.stat().st_size if file_path.exists() else 0
            except OSError:
                file_size = 0

            item = UploadQueueItem(
                file_path=file_path,
                file_name=file_path.name,
                file_size=file_size,
                manifest_id=manifest_id,
                project_id=project_id,
                camera_label=camera_label,
                roll_name=roll_name,
            )
            self._queue.append(item)
            self._save_queue()

        self.queue_updated.emit()
        return True

    def get_pending(self) -> List[UploadQueueItem]:
        """Get all pending items."""
        with self._lock:
            return [i for i in self._queue if i.status == QueueItemStatus.PENDING]

    def get_all(self) -> List[UploadQueueItem]:
        """Get all items in queue."""
        with self._lock:
            return list(self._queue)

    def get_by_manifest(self, manifest_id: str) -> List[UploadQueueItem]:
        """Get all items from a specific manifest."""
        with self._lock:
            return [i for i in self._queue if i.manifest_id == manifest_id]

    def get_grouped_by_manifest(self) -> Dict[str, List[UploadQueueItem]]:
        """Get items grouped by manifest_id for Recent Offloads display."""
        with self._lock:
            grouped: Dict[str, List[UploadQueueItem]] = {}
            for item in self._queue:
                if item.manifest_id not in grouped:
                    grouped[item.manifest_id] = []
                grouped[item.manifest_id].append(item)
            return grouped

    def update_status(
        self,
        file_path: Path,
        status: QueueItemStatus,
        progress: float = 0.0,
        error: Optional[str] = None
    ):
        """Update status of a queue item."""
        with self._lock:
            for item in self._queue:
                if str(item.file_path) == str(file_path):
                    item.status = status
                    item.progress = progress
                    item.error = error
                    self._save_queue()
                    break

        self.item_progress.emit(str(file_path), progress, status.value)
        self.queue_updated.emit()

    def remove_item(self, file_path: Path):
        """Remove an item from the queue."""
        with self._lock:
            self._queue = [i for i in self._queue if str(i.file_path) != str(file_path)]
            self._save_queue()
        self.queue_updated.emit()

    def clear_completed(self):
        """Remove completed items from queue."""
        with self._lock:
            self._queue = [i for i in self._queue if i.status != QueueItemStatus.COMPLETED]
            self._save_queue()
        self.queue_updated.emit()

    def clear_all(self):
        """Clear entire queue."""
        with self._lock:
            self._queue = []
            self._save_queue()
        self.queue_updated.emit()

    def get_queue_stats(self) -> Dict[str, int]:
        """Get statistics about the queue."""
        with self._lock:
            pending = sum(1 for i in self._queue if i.status == QueueItemStatus.PENDING)
            uploading = sum(1 for i in self._queue if i.status == QueueItemStatus.UPLOADING)
            completed = sum(1 for i in self._queue if i.status == QueueItemStatus.COMPLETED)
            failed = sum(1 for i in self._queue if i.status == QueueItemStatus.FAILED)
            total_size = sum(i.file_size for i in self._queue if i.status == QueueItemStatus.PENDING)

            return {
                "total": len(self._queue),
                "pending": pending,
                "uploading": uploading,
                "completed": completed,
                "failed": failed,
                "pending_bytes": total_size,
            }

    # ==================== Upload History ====================

    def _load_history(self):
        """Load history from disk."""
        if self._history_file.exists():
            try:
                with open(self._history_file) as f:
                    data = json.load(f)
                self._history = [UploadHistoryEntry.from_dict(entry) for entry in data]
            except Exception as e:
                print(f"Failed to load upload history: {e}")
                self._history = []

    def _save_history(self):
        """Save history to disk."""
        try:
            with open(self._history_file, "w") as f:
                json.dump([entry.to_dict() for entry in self._history], f, indent=2)
        except Exception as e:
            print(f"Failed to save upload history: {e}")

    def add_to_history(
        self,
        file_name: str,
        file_size: int,
        project_id: Optional[str],
        status: str,
        started_at: datetime,
        retry_count: int = 0,
        error: Optional[str] = None,
        s3_key: Optional[str] = None,
    ):
        """Add an upload result to history.

        Args:
            file_name: Name of the uploaded file
            file_size: Size in bytes
            project_id: Project ID if known
            status: "completed" or "failed"
            started_at: When upload started
            retry_count: Number of retries attempted
            error: Error message if failed
            s3_key: S3 key if uploaded successfully
        """
        entry = UploadHistoryEntry(
            file_name=file_name,
            file_size=file_size,
            project_id=project_id,
            status=status,
            started_at=started_at,
            completed_at=datetime.now(),
            retry_count=retry_count,
            error=error,
            s3_key=s3_key,
        )

        with self._history_lock:
            # Add to front (newest first)
            self._history.insert(0, entry)

            # Trim to max entries
            if len(self._history) > self.MAX_HISTORY_ENTRIES:
                self._history = self._history[:self.MAX_HISTORY_ENTRIES]

            self._save_history()

        self.history_updated.emit()

    def get_history(
        self,
        limit: int = 100,
        status: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> List[UploadHistoryEntry]:
        """Get upload history.

        Args:
            limit: Maximum entries to return
            status: Filter by status ("completed" or "failed")
            project_id: Filter by project ID

        Returns:
            List of history entries, newest first
        """
        with self._history_lock:
            result = self._history

            if status:
                result = [e for e in result if e.status == status]

            if project_id:
                result = [e for e in result if e.project_id == project_id]

            return result[:limit]

    def get_history_stats(self) -> Dict[str, Any]:
        """Get statistics about upload history."""
        with self._history_lock:
            total = len(self._history)
            completed = sum(1 for e in self._history if e.status == "completed")
            failed = sum(1 for e in self._history if e.status == "failed")
            total_bytes = sum(e.file_size for e in self._history if e.status == "completed")
            total_retries = sum(e.retry_count for e in self._history)

            return {
                "total": total,
                "completed": completed,
                "failed": failed,
                "total_bytes_uploaded": total_bytes,
                "total_retries": total_retries,
            }

    def clear_history(self, status: Optional[str] = None):
        """Clear upload history.

        Args:
            status: If provided, only clear entries with this status
        """
        with self._history_lock:
            if status:
                self._history = [e for e in self._history if e.status != status]
            else:
                self._history = []
            self._save_history()

        self.history_updated.emit()

    def mark_upload_started(self, file_path: Path):
        """Mark an item as started uploading (records start time)."""
        with self._lock:
            for item in self._queue:
                if str(item.file_path) == str(file_path):
                    item.started_at = datetime.now()
                    item.status = QueueItemStatus.UPLOADING
                    self._save_queue()
                    break

        self.queue_updated.emit()

    def complete_upload(
        self,
        file_path: Path,
        success: bool,
        retry_count: int = 0,
        error: Optional[str] = None,
        s3_key: Optional[str] = None,
        clip_id: Optional[str] = None,
    ):
        """Mark an upload as complete and add to history.

        Args:
            file_path: Path of the uploaded file
            success: Whether upload succeeded
            retry_count: Number of retries
            error: Error message if failed
            s3_key: S3 key if succeeded
            clip_id: Database clip ID if uploaded successfully
        """
        item: Optional[UploadQueueItem] = None
        with self._lock:
            for i in self._queue:
                if str(i.file_path) == str(file_path):
                    item = i
                    i.status = QueueItemStatus.COMPLETED if success else QueueItemStatus.FAILED
                    i.error = error
                    i.clip_id = clip_id
                    self._save_queue()
                    break

        if item:
            # Add to history
            self.add_to_history(
                file_name=item.file_name,
                file_size=item.file_size,
                project_id=item.project_id,
                status="completed" if success else "failed",
                started_at=item.started_at or item.added_at,
                retry_count=retry_count,
                error=error,
                s3_key=s3_key,
            )

            # ALWAYS queue for web player proxy transcoding on successful upload
            # Web player proxies (480p/720p/1080p) are required for the video player
            # regardless of the "generate_proxies" toggle (which controls edit proxies)
            if success and clip_id and item.project_id:
                self._queue_for_proxy_transcoding(item, clip_id)

        self.queue_updated.emit()

    def _queue_for_proxy_transcoding(self, item: UploadQueueItem, clip_id: str):
        """Queue a completed upload for proxy transcoding.

        Args:
            item: The completed upload queue item
            clip_id: The database clip ID
        """
        try:
            from src.services.proxy_transcoder import ProxyTranscoder

            # Use config from service instance
            if not self.config:
                print("Warning: ConfigManager not available for proxy transcoding")
                return

            transcoder = ProxyTranscoder.get_instance(self.config)

            # Queue the clip for transcoding
            transcoder.queue_clip(
                clip_id=clip_id,
                source_path=str(item.file_path),
                project_id=item.project_id,
                original_filename=item.file_name,
            )

            # Start the transcoder if not already running
            if not transcoder.is_running():
                transcoder.start()

            print(f"Queued clip {clip_id} for proxy transcoding: {item.file_name}")

        except Exception as e:
            print(f"Failed to queue for proxy transcoding: {e}")
