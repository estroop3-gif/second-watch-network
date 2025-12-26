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
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "UploadQueueItem":
        """Create from dictionary."""
        data = data.copy()
        data["file_path"] = Path(data["file_path"])
        data["status"] = QueueItemStatus(data["status"])
        data["added_at"] = datetime.fromisoformat(data["added_at"])
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

    _instance: Optional["UploadQueueService"] = None

    def __init__(self, config=None, parent=None):
        super().__init__(parent)
        self.config = config
        self._queue: List[UploadQueueItem] = []
        self._lock = Lock()
        self._queue_file = Path.home() / ".swn-dailies-helper" / "upload_queue.json"
        self._queue_file.parent.mkdir(parents=True, exist_ok=True)
        self._load_queue()

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
        destination_paths: List[str]
    ) -> int:
        """
        Add all files from an offload manifest to the queue.

        Args:
            manifest: The completed offload manifest
            destination_paths: Paths where files were copied

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
