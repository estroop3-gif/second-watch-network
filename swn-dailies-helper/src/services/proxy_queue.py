"""
Proxy Queue Service - Adobe Media Encoder-style queue management.
Handles queuing, persistence, and orchestration of proxy generation.
"""
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Literal
from enum import Enum

from PyQt6.QtCore import QObject, pyqtSignal

from src.models.transcode_presets import (
    TranscodePreset, TranscodeSettings, PresetManager,
    BUILTIN_PRESETS, get_file_extension
)


class QueueItemStatus(str, Enum):
    """Status of a queue item."""
    QUEUED = "queued"
    PROCESSING = "processing"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


@dataclass
class ProxyOutput:
    """A single output file from transcoding."""
    quality: str  # e.g., "480p", "720p", "1080p", "ProRes LT"
    output_path: Optional[Path] = None
    status: str = QueueItemStatus.QUEUED.value
    progress: float = 0.0
    file_size: int = 0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None
    s3_key: Optional[str] = None  # For uploaded proxies

    def to_dict(self) -> Dict[str, Any]:
        return {
            "quality": self.quality,
            "output_path": str(self.output_path) if self.output_path else None,
            "status": self.status,
            "progress": self.progress,
            "file_size": self.file_size,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "error": self.error,
            "s3_key": self.s3_key,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProxyOutput":
        return cls(
            quality=data["quality"],
            output_path=Path(data["output_path"]) if data.get("output_path") else None,
            status=data.get("status", QueueItemStatus.QUEUED.value),
            progress=data.get("progress", 0.0),
            file_size=data.get("file_size", 0),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            error=data.get("error"),
            s3_key=data.get("s3_key"),
        )


@dataclass
class ProxyQueueItem:
    """A file in the proxy queue with all its outputs."""
    id: str
    source_path: Path
    file_name: str
    file_size: int
    preset_id: str
    preset_name: str

    # Overall status
    status: str = QueueItemStatus.QUEUED.value
    current_output: Optional[str] = None  # Which quality currently processing
    overall_progress: float = 0.0

    # Individual outputs
    outputs: List[ProxyOutput] = field(default_factory=list)

    # Metadata
    project_id: Optional[str] = None
    clip_id: Optional[str] = None  # For linking to uploaded clips
    manifest_id: Optional[str] = None  # From offload

    # Timestamps
    queued_at: str = field(default_factory=lambda: datetime.now().isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    # Encoding stats
    encoding_speed: Optional[float] = None  # e.g., 2.3x
    eta_seconds: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "source_path": str(self.source_path),
            "file_name": self.file_name,
            "file_size": self.file_size,
            "preset_id": self.preset_id,
            "preset_name": self.preset_name,
            "status": self.status,
            "current_output": self.current_output,
            "overall_progress": self.overall_progress,
            "outputs": [o.to_dict() for o in self.outputs],
            "project_id": self.project_id,
            "clip_id": self.clip_id,
            "manifest_id": self.manifest_id,
            "queued_at": self.queued_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "encoding_speed": self.encoding_speed,
            "eta_seconds": self.eta_seconds,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProxyQueueItem":
        outputs = [ProxyOutput.from_dict(o) for o in data.get("outputs", [])]
        return cls(
            id=data["id"],
            source_path=Path(data["source_path"]),
            file_name=data["file_name"],
            file_size=data.get("file_size", 0),
            preset_id=data["preset_id"],
            preset_name=data.get("preset_name", ""),
            status=data.get("status", QueueItemStatus.QUEUED.value),
            current_output=data.get("current_output"),
            overall_progress=data.get("overall_progress", 0.0),
            outputs=outputs,
            project_id=data.get("project_id"),
            clip_id=data.get("clip_id"),
            manifest_id=data.get("manifest_id"),
            queued_at=data.get("queued_at", datetime.now().isoformat()),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            encoding_speed=data.get("encoding_speed"),
            eta_seconds=data.get("eta_seconds"),
        )

    def get_completed_count(self) -> int:
        """Get number of completed outputs."""
        return sum(1 for o in self.outputs if o.status == QueueItemStatus.COMPLETED.value)

    def get_total_outputs(self) -> int:
        """Get total number of outputs."""
        return len(self.outputs)

    def is_complete(self) -> bool:
        """Check if all outputs are complete."""
        return all(o.status == QueueItemStatus.COMPLETED.value for o in self.outputs)

    def has_failed(self) -> bool:
        """Check if any output failed."""
        return any(o.status == QueueItemStatus.FAILED.value for o in self.outputs)

    def get_next_pending_output(self) -> Optional[ProxyOutput]:
        """Get next output that needs processing."""
        for output in self.outputs:
            if output.status == QueueItemStatus.QUEUED.value:
                return output
        return None

    def update_overall_progress(self):
        """Recalculate overall progress from individual outputs."""
        if not self.outputs:
            self.overall_progress = 0.0
            return

        total_progress = sum(o.progress for o in self.outputs)
        self.overall_progress = total_progress / len(self.outputs)


class ProxyQueue(QObject):
    """
    Manages the proxy generation queue.
    Provides Adobe Media Encoder-style functionality.
    """

    # Signals
    item_added = pyqtSignal(str)  # item_id
    item_started = pyqtSignal(str)  # item_id - when an item starts processing
    item_updated = pyqtSignal(str)  # item_id
    item_completed = pyqtSignal(str)  # item_id
    item_failed = pyqtSignal(str, str)  # item_id, error
    queue_started = pyqtSignal()
    queue_stopped = pyqtSignal()
    queue_paused = pyqtSignal()
    queue_completed = pyqtSignal()
    progress_updated = pyqtSignal(str, float)  # item_id, progress

    def __init__(self, config_dir: Path = None):
        super().__init__()

        if config_dir is None:
            config_dir = Path.home() / ".swn-dailies-helper"

        self.config_dir = config_dir
        self.queue_file = config_dir / "proxy_queue.json"
        self.output_dir = config_dir / "proxies"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.preset_manager = PresetManager(config_dir)

        self._items: Dict[str, ProxyQueueItem] = {}
        self._is_running = False
        self._is_paused = False

        self._load_queue()

    def _load_queue(self):
        """Load queue from disk."""
        if self.queue_file.exists():
            try:
                with open(self.queue_file) as f:
                    data = json.load(f)
                for item_data in data.get("items", []):
                    item = ProxyQueueItem.from_dict(item_data)
                    self._items[item.id] = item
            except Exception as e:
                print(f"Error loading proxy queue: {e}")

    def _save_queue(self):
        """Save queue to disk."""
        self.config_dir.mkdir(parents=True, exist_ok=True)
        data = {
            "items": [item.to_dict() for item in self._items.values()]
        }
        with open(self.queue_file, "w") as f:
            json.dump(data, f, indent=2)

    def add_file(
        self,
        file_path: Path,
        preset_id: str = "web_player",
        project_id: Optional[str] = None,
        clip_id: Optional[str] = None,
        manifest_id: Optional[str] = None,
    ) -> ProxyQueueItem:
        """Add a file to the queue."""
        preset = self.preset_manager.get_preset(preset_id)
        if not preset:
            preset = BUILTIN_PRESETS["web_player"]

        # Create outputs for each quality in the preset
        outputs = []
        for setting in preset.settings:
            ext = get_file_extension(setting.codec)
            output_path = self.output_dir / f"{file_path.stem}_{setting.name}{ext}"
            outputs.append(ProxyOutput(
                quality=setting.name,
                output_path=output_path,
            ))

        # Get file size
        try:
            file_size = file_path.stat().st_size
        except:
            file_size = 0

        item = ProxyQueueItem(
            id=str(uuid.uuid4()),
            source_path=file_path,
            file_name=file_path.name,
            file_size=file_size,
            preset_id=preset_id,
            preset_name=preset.name,
            outputs=outputs,
            project_id=project_id,
            clip_id=clip_id,
            manifest_id=manifest_id,
        )

        self._items[item.id] = item
        self._save_queue()
        self.item_added.emit(item.id)

        return item

    def add_files(
        self,
        file_paths: List[Path],
        preset_id: str = "web_player",
        project_id: Optional[str] = None,
    ) -> List[ProxyQueueItem]:
        """Add multiple files to the queue."""
        items = []
        for path in file_paths:
            item = self.add_file(path, preset_id, project_id)
            items.append(item)
        return items

    def add_folder(
        self,
        folder_path: Path,
        preset_id: str = "web_player",
        project_id: Optional[str] = None,
        extensions: List[str] = None,
    ) -> List[ProxyQueueItem]:
        """Add all video files from a folder."""
        if extensions is None:
            extensions = [
                ".mov", ".mp4", ".mxf", ".avi", ".mkv",
                ".r3d", ".braw", ".ari", ".dng",
            ]

        items = []
        for ext in extensions:
            for file_path in folder_path.rglob(f"*{ext}"):
                item = self.add_file(file_path, preset_id, project_id)
                items.append(item)

        return items

    def add_from_offload(
        self,
        manifest_id: str,
        file_paths: List[Path],
        preset_id: str = "web_player",
        project_id: Optional[str] = None,
    ) -> List[ProxyQueueItem]:
        """Add files from an offload manifest."""
        items = []
        for path in file_paths:
            item = self.add_file(
                path,
                preset_id=preset_id,
                project_id=project_id,
                manifest_id=manifest_id,
            )
            items.append(item)
        return items

    def get_item(self, item_id: str) -> Optional[ProxyQueueItem]:
        """Get a queue item by ID."""
        return self._items.get(item_id)

    def get_all_items(self) -> List[ProxyQueueItem]:
        """Get all queue items."""
        return list(self._items.values())

    def get_pending_items(self) -> List[ProxyQueueItem]:
        """Get items that are queued or paused."""
        return [
            item for item in self._items.values()
            if item.status in [QueueItemStatus.QUEUED.value, QueueItemStatus.PAUSED.value]
        ]

    def get_processing_item(self) -> Optional[ProxyQueueItem]:
        """Get the currently processing item."""
        for item in self._items.values():
            if item.status == QueueItemStatus.PROCESSING.value:
                return item
        return None

    def get_completed_items(self) -> List[ProxyQueueItem]:
        """Get completed items."""
        return [
            item for item in self._items.values()
            if item.status == QueueItemStatus.COMPLETED.value
        ]

    def get_failed_items(self) -> List[ProxyQueueItem]:
        """Get failed items."""
        return [
            item for item in self._items.values()
            if item.status == QueueItemStatus.FAILED.value
        ]

    def get_next_item(self) -> Optional[ProxyQueueItem]:
        """Get the next item to process."""
        # Sort by queued time, oldest first
        pending = self.get_pending_items()
        if not pending:
            return None
        pending.sort(key=lambda x: x.queued_at)
        return pending[0]

    def update_item_progress(
        self,
        item_id: str,
        output_quality: str,
        progress: float,
        encoding_speed: Optional[float] = None,
        eta_seconds: Optional[int] = None,
    ):
        """Update progress for a specific output."""
        item = self._items.get(item_id)
        if not item:
            return

        for output in item.outputs:
            if output.quality == output_quality:
                output.progress = progress
                break

        item.current_output = output_quality
        item.encoding_speed = encoding_speed
        item.eta_seconds = eta_seconds
        item.update_overall_progress()

        self._save_queue()
        self.progress_updated.emit(item_id, item.overall_progress)
        self.item_updated.emit(item_id)

    def mark_output_complete(
        self,
        item_id: str,
        output_quality: str,
        output_path: Path,
        file_size: int,
    ):
        """Mark an output as complete."""
        item = self._items.get(item_id)
        if not item:
            return

        for output in item.outputs:
            if output.quality == output_quality:
                output.status = QueueItemStatus.COMPLETED.value
                output.progress = 100.0
                output.output_path = output_path
                output.file_size = file_size
                output.completed_at = datetime.now().isoformat()
                break

        item.update_overall_progress()

        # Check if all outputs are complete
        if item.is_complete():
            item.status = QueueItemStatus.COMPLETED.value
            item.completed_at = datetime.now().isoformat()
            item.current_output = None
            self.item_completed.emit(item_id)

        self._save_queue()
        self.item_updated.emit(item_id)

    def mark_output_failed(
        self,
        item_id: str,
        output_quality: str,
        error: str,
    ):
        """Mark an output as failed."""
        item = self._items.get(item_id)
        if not item:
            return

        for output in item.outputs:
            if output.quality == output_quality:
                output.status = QueueItemStatus.FAILED.value
                output.error = error
                break

        item.status = QueueItemStatus.FAILED.value
        self._save_queue()
        self.item_failed.emit(item_id, error)
        self.item_updated.emit(item_id)

    def mark_item_processing(self, item_id: str):
        """Mark an item as currently processing."""
        item = self._items.get(item_id)
        if not item:
            return

        item.status = QueueItemStatus.PROCESSING.value
        item.started_at = datetime.now().isoformat()
        self._save_queue()
        self.item_started.emit(item_id)
        self.item_updated.emit(item_id)

    def remove_item(self, item_id: str):
        """Remove an item from the queue."""
        if item_id in self._items:
            del self._items[item_id]
            self._save_queue()

    def clear_completed(self):
        """Remove all completed items."""
        to_remove = [
            item_id for item_id, item in self._items.items()
            if item.status == QueueItemStatus.COMPLETED.value
        ]
        for item_id in to_remove:
            del self._items[item_id]
        self._save_queue()

    def clear_all(self):
        """Clear all items from the queue."""
        self._items.clear()
        self._save_queue()

    def retry_failed(self, item_id: str):
        """Retry a failed item."""
        item = self._items.get(item_id)
        if not item or item.status != QueueItemStatus.FAILED.value:
            return

        # Reset status
        item.status = QueueItemStatus.QUEUED.value
        for output in item.outputs:
            if output.status == QueueItemStatus.FAILED.value:
                output.status = QueueItemStatus.QUEUED.value
                output.progress = 0.0
                output.error = None

        self._save_queue()
        self.item_updated.emit(item_id)

    def start(self, output_dir: Path = None):
        """Start processing the queue."""
        if output_dir:
            self.output_dir = output_dir
            self.output_dir.mkdir(parents=True, exist_ok=True)

        self._is_running = True
        self._is_paused = False
        self.queue_started.emit()

    def stop(self):
        """Stop processing the queue."""
        self._is_running = False
        self._is_paused = False
        self.queue_stopped.emit()

    def pause(self):
        """Pause the queue."""
        self._is_paused = True
        self._is_running = False
        self.queue_paused.emit()
        self.queue_stopped.emit()

    def resume(self):
        """Resume the queue."""
        self._is_paused = False
        self._is_running = True
        self.queue_started.emit()

    def cancel_current(self):
        """Cancel the currently processing item."""
        current = self.get_processing_item()
        if current:
            current.status = QueueItemStatus.CANCELLED.value
            current.current_output = None
            for output in current.outputs:
                if output.status == QueueItemStatus.PROCESSING.value:
                    output.status = QueueItemStatus.CANCELLED.value
            self._save_queue()
            self.item_updated.emit(current.id)

    @property
    def is_running(self) -> bool:
        return self._is_running

    @property
    def is_paused(self) -> bool:
        return self._is_paused

    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics."""
        all_items = list(self._items.values())
        return {
            "total": len(all_items),
            "queued": len([i for i in all_items if i.status == QueueItemStatus.QUEUED.value]),
            "processing": len([i for i in all_items if i.status == QueueItemStatus.PROCESSING.value]),
            "completed": len([i for i in all_items if i.status == QueueItemStatus.COMPLETED.value]),
            "failed": len([i for i in all_items if i.status == QueueItemStatus.FAILED.value]),
            "total_size": sum(i.file_size for i in all_items),
        }


# Singleton instance
_queue_instance: Optional[ProxyQueue] = None


def get_proxy_queue() -> ProxyQueue:
    """Get the singleton ProxyQueue instance."""
    global _queue_instance
    if _queue_instance is None:
        _queue_instance = ProxyQueue()
    return _queue_instance
