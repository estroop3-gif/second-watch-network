"""
Watch folder service for auto-uploading new media files.
Uses watchdog to monitor directories for new files.
"""
import os
import time
import threading
from pathlib import Path
from typing import Optional, Callable, List, Set
from dataclasses import dataclass
from datetime import datetime
from queue import Queue

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent, FileModifiedEvent

from src.services.config import ConfigManager


# Video file extensions to watch for
VIDEO_EXTENSIONS = {
    ".mov", ".mp4", ".mxf", ".avi", ".r3d", ".braw",
    ".arw", ".dng", ".mkv", ".webm", ".m4v"
}


@dataclass
class WatchedFile:
    """Represents a file being watched for upload."""
    path: Path
    detected_at: datetime
    size: int
    stable: bool = False
    uploaded: bool = False
    error: Optional[str] = None


class MediaFileHandler(FileSystemEventHandler):
    """Handle file system events for media files."""

    def __init__(
        self,
        file_queue: Queue,
        extensions: Set[str],
        on_file_detected: Optional[Callable[[Path], None]] = None,
    ):
        super().__init__()
        self.file_queue = file_queue
        self.extensions = extensions
        self.on_file_detected = on_file_detected

    def _is_media_file(self, path: str) -> bool:
        """Check if a file is a supported media file."""
        return Path(path).suffix.lower() in self.extensions

    def on_created(self, event):
        """Handle file creation events."""
        if event.is_directory:
            return
        if self._is_media_file(event.src_path):
            self.file_queue.put(Path(event.src_path))
            if self.on_file_detected:
                self.on_file_detected(Path(event.src_path))

    def on_modified(self, event):
        """Handle file modification events (for files still being written)."""
        # We track modifications to detect when copy is complete
        pass


class WatchFolderService:
    """Service for watching folders and auto-uploading new media files."""

    STABILITY_CHECK_INTERVAL = 2.0  # seconds between size checks
    STABILITY_THRESHOLD = 3  # number of checks with same size = stable

    def __init__(self, config: ConfigManager):
        self.config = config
        self._observer: Optional[Observer] = None
        self._file_queue: Queue = Queue()
        self._watched_files: dict[str, WatchedFile] = {}
        self._running = False
        self._stability_thread: Optional[threading.Thread] = None

        # Callbacks
        self.on_file_detected: Optional[Callable[[Path], None]] = None
        self.on_file_ready: Optional[Callable[[Path], None]] = None
        self.on_error: Optional[Callable[[Path, str], None]] = None

    @property
    def is_running(self) -> bool:
        return self._running

    def get_watch_folder(self) -> Optional[str]:
        """Get the configured watch folder path."""
        return self.config.get("watch_folder")

    def set_watch_folder(self, path: str):
        """Set the watch folder path."""
        self.config.set("watch_folder", path)

    def get_pending_files(self) -> List[WatchedFile]:
        """Get list of files waiting to be uploaded."""
        return [f for f in self._watched_files.values() if not f.uploaded]

    def get_uploaded_files(self) -> List[WatchedFile]:
        """Get list of successfully uploaded files."""
        return [f for f in self._watched_files.values() if f.uploaded]

    def start(self, folder_path: Optional[str] = None):
        """Start watching the specified folder."""
        if self._running:
            return

        path = folder_path or self.get_watch_folder()
        if not path:
            raise ValueError("No watch folder configured")

        folder = Path(path)
        if not folder.exists():
            raise ValueError(f"Watch folder does not exist: {path}")
        if not folder.is_dir():
            raise ValueError(f"Path is not a directory: {path}")

        # Store the path
        if folder_path:
            self.set_watch_folder(folder_path)

        # Create the event handler
        handler = MediaFileHandler(
            file_queue=self._file_queue,
            extensions=VIDEO_EXTENSIONS,
            on_file_detected=self._handle_file_detected,
        )

        # Start the observer
        self._observer = Observer()
        self._observer.schedule(handler, str(folder), recursive=True)
        self._observer.start()

        # Start stability checker thread
        self._running = True
        self._stability_thread = threading.Thread(target=self._stability_checker, daemon=True)
        self._stability_thread.start()

    def stop(self):
        """Stop watching the folder."""
        self._running = False

        if self._observer:
            self._observer.stop()
            self._observer.join(timeout=5)
            self._observer = None

        if self._stability_thread:
            self._stability_thread.join(timeout=5)
            self._stability_thread = None

        # Clear state
        self._file_queue = Queue()

    def _handle_file_detected(self, path: Path):
        """Called when a new media file is detected."""
        if str(path) in self._watched_files:
            return

        try:
            size = path.stat().st_size
        except OSError:
            size = 0

        watched = WatchedFile(
            path=path,
            detected_at=datetime.now(),
            size=size,
        )
        self._watched_files[str(path)] = watched

        if self.on_file_detected:
            self.on_file_detected(path)

    def _stability_checker(self):
        """Background thread to check file stability (copy complete)."""
        stability_counts: dict[str, int] = {}

        while self._running:
            time.sleep(self.STABILITY_CHECK_INTERVAL)

            for path_str, watched in list(self._watched_files.items()):
                if watched.stable or watched.uploaded:
                    continue

                path = watched.path
                if not path.exists():
                    # File was deleted
                    del self._watched_files[path_str]
                    if path_str in stability_counts:
                        del stability_counts[path_str]
                    continue

                try:
                    current_size = path.stat().st_size
                except OSError:
                    continue

                if current_size == watched.size:
                    # Size unchanged
                    stability_counts[path_str] = stability_counts.get(path_str, 0) + 1

                    if stability_counts[path_str] >= self.STABILITY_THRESHOLD:
                        # File is stable (copy complete)
                        watched.stable = True
                        if self.on_file_ready:
                            self.on_file_ready(path)
                else:
                    # Size changed, reset counter
                    watched.size = current_size
                    stability_counts[path_str] = 0

    def mark_uploaded(self, path: Path, success: bool = True, error: Optional[str] = None):
        """Mark a file as uploaded (or failed)."""
        path_str = str(path)
        if path_str in self._watched_files:
            self._watched_files[path_str].uploaded = success
            self._watched_files[path_str].error = error

    def clear_history(self):
        """Clear the upload history."""
        self._watched_files = {
            k: v for k, v in self._watched_files.items()
            if not v.uploaded and not v.error
        }


# Activity log for the UI
@dataclass
class ActivityLogEntry:
    """Entry in the activity log."""
    timestamp: datetime
    message: str
    level: str = "info"  # info, success, warning, error


class WatchFolderActivityLog:
    """Activity log for watch folder events."""

    MAX_ENTRIES = 100

    def __init__(self):
        self._entries: List[ActivityLogEntry] = []
        self._lock = threading.Lock()

    def add(self, message: str, level: str = "info"):
        """Add an entry to the log."""
        with self._lock:
            entry = ActivityLogEntry(
                timestamp=datetime.now(),
                message=message,
                level=level,
            )
            self._entries.append(entry)

            # Trim if too many entries
            if len(self._entries) > self.MAX_ENTRIES:
                self._entries = self._entries[-self.MAX_ENTRIES:]

    def get_entries(self, limit: int = 50) -> List[ActivityLogEntry]:
        """Get recent log entries."""
        with self._lock:
            return list(reversed(self._entries[-limit:]))

    def clear(self):
        """Clear the log."""
        with self._lock:
            self._entries = []
