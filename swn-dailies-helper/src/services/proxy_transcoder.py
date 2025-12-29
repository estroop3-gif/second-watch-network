"""
Proxy Transcoder Service - Orchestrates proxy generation.

Supports two modes:
1. Local generation - Generate proxies before upload for DIT editing
2. Cloud upload - Generate proxies and upload to S3 for web player

Web player proxies (480p, 720p, 1080p) are ALWAYS generated regardless of settings.
"""
import os
import logging
import tempfile
import threading
from pathlib import Path
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum
from queue import Queue, Empty
from datetime import datetime

import httpx
from PyQt6.QtCore import QObject, pyqtSignal, QThread

from src.services.config import ConfigManager
from src.services.ffmpeg_encoder import FFmpegEncoder
from src.services.proxy_queue import (
    ProxyQueue, ProxyQueueItem, ProxyOutput,
    QueueItemStatus, get_proxy_queue
)
from src.models.transcode_presets import (
    PresetManager, TranscodeSettings, TranscodePreset,
    BUILTIN_PRESETS, get_file_extension
)

logger = logging.getLogger("swn-helper")


# Legacy quality presets for backward compatibility
QUALITY_PRESETS = {
    "480p": {
        "height": 480,
        "video_bitrate": "1000k",
        "audio_bitrate": "96k",
        "max_width": 854,
        "max_height": 480,
    },
    "720p": {
        "height": 720,
        "video_bitrate": "2500k",
        "audio_bitrate": "128k",
        "max_width": 1280,
        "max_height": 720,
    },
    "1080p": {
        "height": 1080,
        "video_bitrate": "5000k",
        "audio_bitrate": "192k",
        "max_width": 1920,
        "max_height": 1080,
    },
}

TRANSCODE_ORDER = ["480p", "720p", "1080p"]


class JobStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ProxyJob:
    """Represents a single proxy transcoding job (legacy)."""
    clip_id: str
    source_path: str
    quality: str
    project_id: str
    status: JobStatus = JobStatus.PENDING
    progress: int = 0
    output_path: Optional[str] = None
    s3_key: Optional[str] = None
    error: Optional[str] = None
    file_size: int = 0


@dataclass
class ClipTranscodeTask:
    """Represents all transcode jobs for a single clip (legacy)."""
    clip_id: str
    source_path: str
    project_id: str
    original_filename: str
    jobs: Dict[str, ProxyJob] = field(default_factory=dict)

    def get_next_pending_job(self) -> Optional[ProxyJob]:
        for quality in TRANSCODE_ORDER:
            if quality in self.jobs and self.jobs[quality].status == JobStatus.PENDING:
                return self.jobs[quality]
        return None

    def is_complete(self) -> bool:
        return all(
            job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
            for job in self.jobs.values()
        )

    def get_completed_count(self) -> int:
        return sum(1 for job in self.jobs.values() if job.status == JobStatus.COMPLETED)


class QueueTranscoderWorker(QThread):
    """
    Worker thread that processes the new ProxyQueue.
    Uses TranscodeSettings from presets for full codec support.
    """

    item_started = pyqtSignal(str)           # item_id
    output_started = pyqtSignal(str, str)    # item_id, quality
    output_progress = pyqtSignal(str, str, float)  # item_id, quality, progress
    output_completed = pyqtSignal(str, str)  # item_id, quality
    output_failed = pyqtSignal(str, str, str)  # item_id, quality, error
    item_completed = pyqtSignal(str)         # item_id
    upload_started = pyqtSignal(str, str)    # item_id, quality
    upload_completed = pyqtSignal(str, str)  # item_id, quality

    def __init__(
        self,
        queue: ProxyQueue,
        config: ConfigManager,
        api_base: str,
        upload_after_transcode: bool = False,
    ):
        super().__init__()
        self.queue = queue
        self.config = config
        self.api_base = api_base
        self.upload_after_transcode = upload_after_transcode
        self.preset_manager = PresetManager()
        self.encoder = FFmpegEncoder()
        self._stop_flag = False
        self._cancel_current = False

    def run(self):
        """Main worker loop."""
        while not self._stop_flag:
            if not self.queue.is_running:
                self.msleep(500)
                continue

            # Get next item
            item = self.queue.get_next_item()
            if not item:
                self.queue.stop()
                continue

            # Process item
            self._process_item(item)

    def _process_item(self, item: ProxyQueueItem):
        """Process a single queue item."""
        logger.info(f"Starting transcode: {item.file_name}")

        self.queue.mark_item_processing(item.id)
        self.item_started.emit(item.id)
        self._cancel_current = False

        # Get preset
        preset = self.preset_manager.get_preset(item.preset_id)
        if not preset:
            preset = BUILTIN_PRESETS.get("web_player")

        # Process each output
        for i, output in enumerate(item.outputs):
            if self._stop_flag or self._cancel_current:
                break

            if output.status != QueueItemStatus.QUEUED.value:
                continue

            # Find matching settings
            settings = None
            for s in preset.settings:
                if s.name == output.quality:
                    settings = s
                    break

            if not settings:
                logger.warning(f"No settings found for quality: {output.quality}")
                continue

            try:
                self._process_output(item, output, settings)
            except Exception as e:
                logger.error(f"Output failed: {output.quality}: {e}")
                self.queue.mark_output_failed(item.id, output.quality, str(e))
                self.output_failed.emit(item.id, output.quality, str(e))

        # Check if all done
        item = self.queue.get_item(item.id)
        if item and item.is_complete():
            self.item_completed.emit(item.id)

    def _process_output(
        self,
        item: ProxyQueueItem,
        output: ProxyOutput,
        settings: TranscodeSettings,
    ):
        """Process a single output (one quality level)."""
        logger.info(f"Transcoding {item.file_name} -> {output.quality}")

        output.status = QueueItemStatus.PROCESSING.value
        output.started_at = datetime.now().isoformat()
        self.output_started.emit(item.id, output.quality)

        # Progress callback
        def on_progress(progress: float):
            percent = progress * 100
            self.queue.update_item_progress(item.id, output.quality, percent)
            self.output_progress.emit(item.id, output.quality, percent)

        # Generate proxy using new encoder method
        output_path = self.encoder.generate_from_transcode_settings(
            input_path=str(item.source_path),
            output_dir=str(self.queue.output_dir),
            settings=settings,
            progress_callback=on_progress,
        )

        if not output_path:
            raise Exception("FFmpeg transcoding failed")

        if self._stop_flag or self._cancel_current:
            return

        # Get file size
        file_size = Path(output_path).stat().st_size

        # Mark complete
        self.queue.mark_output_complete(
            item.id, output.quality, Path(output_path), file_size
        )
        self.output_completed.emit(item.id, output.quality)

        logger.info(f"Completed: {item.file_name} -> {output.quality}")

        # Upload if required (web player proxies)
        if self.upload_after_transcode and item.clip_id:
            self._upload_output(item, output, output_path)

    def _upload_output(self, item: ProxyQueueItem, output: ProxyOutput, output_path: str):
        """Upload transcoded output to S3."""
        if not item.clip_id or not item.project_id:
            logger.warning("Cannot upload: missing clip_id or project_id")
            return

        api_key = self.config.get_api_key()
        if not api_key:
            logger.warning("Cannot upload: no API key")
            return

        self.upload_started.emit(item.id, output.quality)

        try:
            # Get presigned upload URL
            filename = f"{item.source_path.stem}_{output.quality}.mp4"

            with httpx.Client() as client:
                response = client.post(
                    f"{self.api_base}/api/v1/backlot/dailies/upload-url",
                    headers={
                        "X-API-Key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "project_id": item.project_id,
                        "file_name": filename,
                        "content_type": "video/mp4",
                        "is_rendition": True,
                        "clip_id": item.clip_id,
                        "quality": output.quality,
                    },
                    timeout=30.0,
                )

                if response.status_code != 200:
                    raise Exception(f"Failed to get upload URL: {response.status_code}")

                upload_info = response.json()
                upload_url = upload_info.get("upload_url")
                s3_key = upload_info.get("key")

            # Upload file
            with open(output_path, "rb") as f:
                file_data = f.read()

            with httpx.Client() as client:
                response = client.put(
                    upload_url,
                    content=file_data,
                    headers={"Content-Type": "video/mp4"},
                    timeout=600.0,
                )

                if response.status_code not in (200, 204):
                    raise Exception(f"S3 upload failed: {response.status_code}")

            # Register rendition
            with httpx.Client() as client:
                client.post(
                    f"{self.api_base}/api/v1/backlot/dailies/clips/{item.clip_id}/renditions",
                    headers={
                        "X-API-Key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "quality": output.quality,
                        "s3_key": s3_key,
                        "size": Path(output_path).stat().st_size,
                    },
                    timeout=30.0,
                )

            output.s3_key = s3_key
            self.upload_completed.emit(item.id, output.quality)
            logger.info(f"Uploaded: {item.file_name} -> {output.quality}")

        except Exception as e:
            logger.error(f"Upload failed: {e}")

    def stop(self):
        """Stop the worker."""
        self._stop_flag = True

    def cancel_current(self):
        """Cancel the current item."""
        self._cancel_current = True


class ProxyTranscoder(QObject):
    """
    Unified proxy transcoder.
    Supports both the new queue-based flow and legacy clip-based flow.
    """

    API_BASE = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"

    # Signals
    job_started = pyqtSignal(str, str)         # clip_id, quality
    job_progress = pyqtSignal(str, str, int)   # clip_id, quality, percent
    job_completed = pyqtSignal(str, str)       # clip_id, quality
    job_failed = pyqtSignal(str, str, str)     # clip_id, quality, error
    clip_completed = pyqtSignal(str)           # clip_id
    queue_empty = pyqtSignal()

    _instance = None
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls, config: ConfigManager = None) -> "ProxyTranscoder":
        """Get singleton instance."""
        with cls._lock:
            if cls._instance is None:
                if config is None:
                    raise ValueError("Config required for first initialization")
                cls._instance = cls(config)
            return cls._instance

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self._queue = get_proxy_queue()
        self._worker: Optional[QueueTranscoderWorker] = None
        self._is_running = False

        # Legacy support
        self._legacy_tasks: Dict[str, ClipTranscodeTask] = {}

        # Connect queue signals
        self._queue.queue_started.connect(self._on_queue_started)
        self._queue.queue_stopped.connect(self._on_queue_stopped)
        self._queue.item_completed.connect(self._on_item_completed)

    def start(self):
        """Start the transcoder worker."""
        if self._is_running:
            return

        self._worker = QueueTranscoderWorker(
            self._queue,
            self.config,
            self.API_BASE,
            upload_after_transcode=True,
        )

        # Connect worker signals
        self._worker.item_started.connect(self._on_worker_item_started)
        self._worker.output_started.connect(self._on_output_started)
        self._worker.output_progress.connect(self._on_output_progress)
        self._worker.output_completed.connect(self._on_output_completed)
        self._worker.output_failed.connect(self._on_output_failed)
        self._worker.item_completed.connect(self._on_worker_item_completed)

        self._worker.start()
        self._is_running = True
        self._queue.start()

        logger.info("Proxy transcoder started")

    def stop(self):
        """Stop the transcoder."""
        if self._worker:
            self._worker.stop()
            self._worker.wait(5000)
            self._worker = None

        self._queue.stop()
        self._is_running = False
        logger.info("Proxy transcoder stopped")

    def pause(self):
        """Pause transcoding."""
        self._queue.pause()

    def resume(self):
        """Resume transcoding."""
        self._queue.resume()
        if not self._worker or not self._worker.isRunning():
            self.start()

    def is_running(self) -> bool:
        """Check if transcoder is running."""
        return self._is_running

    # Queue management
    def add_file(
        self,
        source_path: Path,
        preset_id: str = "web_player",
        project_id: Optional[str] = None,
        clip_id: Optional[str] = None,
    ) -> ProxyQueueItem:
        """Add a file to the transcode queue."""
        item = self._queue.add_file(
            file_path=source_path,
            preset_id=preset_id,
            project_id=project_id,
            clip_id=clip_id,
        )

        # Auto-start if not running
        if not self._is_running:
            self.start()

        return item

    def add_files(
        self,
        file_paths: List[Path],
        preset_id: str = "web_player",
        project_id: Optional[str] = None,
    ) -> List[ProxyQueueItem]:
        """Add multiple files to the queue."""
        items = self._queue.add_files(file_paths, preset_id, project_id)

        if not self._is_running:
            self.start()

        return items

    # Legacy API for backward compatibility
    def queue_clip(
        self,
        clip_id: str,
        source_path: str,
        project_id: str,
        original_filename: str = "",
        qualities: Optional[List[str]] = None,
    ):
        """
        Add a clip to the transcode queue (legacy API).
        Automatically uses web_player preset for backward compatibility.
        """
        item = self._queue.add_file(
            file_path=Path(source_path),
            preset_id="web_player",
            project_id=project_id,
            clip_id=clip_id,
        )

        # Keep track for legacy API
        task = ClipTranscodeTask(
            clip_id=clip_id,
            source_path=source_path,
            project_id=project_id,
            original_filename=original_filename or Path(source_path).name,
        )

        qualities = qualities or TRANSCODE_ORDER.copy()
        for quality in qualities:
            if quality in QUALITY_PRESETS:
                task.jobs[quality] = ProxyJob(
                    clip_id=clip_id,
                    source_path=source_path,
                    quality=quality,
                    project_id=project_id,
                )

        self._legacy_tasks[clip_id] = task

        logger.info(f"Queued clip for transcoding: {clip_id}")

        if not self._is_running:
            self.start()

    def get_task(self, clip_id: str) -> Optional[ClipTranscodeTask]:
        """Get task for a clip (legacy API)."""
        return self._legacy_tasks.get(clip_id)

    def get_all_tasks(self) -> List[ClipTranscodeTask]:
        """Get all tasks (legacy API)."""
        return list(self._legacy_tasks.values())

    def get_pending_count(self) -> int:
        """Get count of pending items."""
        return len(self._queue.get_pending_items())

    def clear_completed(self):
        """Clear completed items."""
        self._queue.clear_completed()

        # Also clear legacy tasks
        completed_ids = [
            clip_id for clip_id, task in self._legacy_tasks.items()
            if task.is_complete()
        ]
        for clip_id in completed_ids:
            del self._legacy_tasks[clip_id]

    # Signal handlers
    def _on_queue_started(self):
        logger.info("Queue processing started")

    def _on_queue_stopped(self):
        logger.info("Queue processing stopped")
        if self._queue.get_pending_items():
            return
        self.queue_empty.emit()

    def _on_item_completed(self, item_id: str):
        item = self._queue.get_item(item_id)
        if item and item.clip_id:
            self.clip_completed.emit(item.clip_id)

    def _on_worker_item_started(self, item_id: str):
        item = self._queue.get_item(item_id)
        if item and item.clip_id:
            # Get first output quality
            if item.outputs:
                self.job_started.emit(item.clip_id, item.outputs[0].quality)

    def _on_output_started(self, item_id: str, quality: str):
        item = self._queue.get_item(item_id)
        if item and item.clip_id:
            self.job_started.emit(item.clip_id, quality)

            # Update legacy task
            if item.clip_id in self._legacy_tasks:
                task = self._legacy_tasks[item.clip_id]
                if quality in task.jobs:
                    task.jobs[quality].status = JobStatus.PROCESSING

    def _on_output_progress(self, item_id: str, quality: str, progress: float):
        item = self._queue.get_item(item_id)
        if item and item.clip_id:
            self.job_progress.emit(item.clip_id, quality, int(progress))

            # Update legacy task
            if item.clip_id in self._legacy_tasks:
                task = self._legacy_tasks[item.clip_id]
                if quality in task.jobs:
                    task.jobs[quality].progress = int(progress)

    def _on_output_completed(self, item_id: str, quality: str):
        item = self._queue.get_item(item_id)
        if item and item.clip_id:
            self.job_completed.emit(item.clip_id, quality)

            # Update legacy task
            if item.clip_id in self._legacy_tasks:
                task = self._legacy_tasks[item.clip_id]
                if quality in task.jobs:
                    task.jobs[quality].status = JobStatus.COMPLETED
                    task.jobs[quality].progress = 100

    def _on_output_failed(self, item_id: str, quality: str, error: str):
        item = self._queue.get_item(item_id)
        if item and item.clip_id:
            self.job_failed.emit(item.clip_id, quality, error)

            # Update legacy task
            if item.clip_id in self._legacy_tasks:
                task = self._legacy_tasks[item.clip_id]
                if quality in task.jobs:
                    task.jobs[quality].status = JobStatus.FAILED
                    task.jobs[quality].error = error

    def _on_worker_item_completed(self, item_id: str):
        item = self._queue.get_item(item_id)
        if item and item.clip_id:
            self.clip_completed.emit(item.clip_id)
