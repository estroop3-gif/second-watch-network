"""
Unified upload page - combines Dailies, Review, and Assets uploads.
Features smart file routing, rclone integration, watch folders, and upload history.
All tabs share a single upload queue instance.
"""
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import json

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QProgressBar, QScrollArea, QFileDialog, QMessageBox,
    QDialog, QComboBox, QCheckBox, QSpinBox, QLineEdit, QTableWidget,
    QTableWidgetItem, QHeaderView, QAbstractItemView, QSplitter,
    QGroupBox, QTabWidget, QTabBar, QInputDialog
)
from PyQt6.QtCore import Qt, pyqtSignal, QThread, QTimer, QFileSystemWatcher
from PyQt6.QtGui import QColor

from src.services.config import ConfigManager
from src.services.rclone_service import RcloneService, RcloneConfig, UploadProgress
from src.services.uploader import UploaderService, UploadJob, UploadStatus
from src.services.ffmpeg_encoder import FFmpegEncoder, ProxySettings
from src.services.project_api import ProjectAPIService
from src.models.upload_models import (
    UnifiedUploadJob, UploadSession, detect_destination,
    VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, IMAGE_EXTENSIONS,
    DOCUMENT_EXTENSIONS, GRAPHICS_EXTENSIONS, MODEL_3D_EXTENSIONS
)
from src.ui.styles import COLORS

import tempfile
import logging

logger = logging.getLogger("swn-helper")


class UploadWorker(QThread):
    """
    Worker thread for processing uploads.
    Handles proxy generation (local ffmpeg) and file uploads.
    """

    # Signals
    job_started = pyqtSignal(str)  # job_id
    job_progress = pyqtSignal(str, float, str)  # job_id, percent, status_text
    job_completed = pyqtSignal(str)  # job_id
    job_failed = pyqtSignal(str, str)  # job_id, error_message
    all_completed = pyqtSignal(int, int)  # success_count, total_count

    def __init__(
        self,
        config: ConfigManager,
        jobs: List[UnifiedUploadJob],
        verify_checksums: bool = True,
        parallel_uploads: int = 3,
    ):
        super().__init__()
        self.config = config
        self.jobs = jobs
        self.verify_checksums = verify_checksums
        self.parallel_uploads = parallel_uploads
        self._cancel_flag = False

        # Services
        self.uploader = UploaderService(config)
        self.encoder = FFmpegEncoder()

        # Temporary directory for proxies
        self.proxy_dir = Path(tempfile.gettempdir()) / "swn-proxies"
        self.proxy_dir.mkdir(parents=True, exist_ok=True)

    def cancel(self):
        """Request cancellation of the upload."""
        self._cancel_flag = True
        self.uploader.cancel()

    def run(self):
        """Main worker loop - process all jobs."""
        success_count = 0
        total_count = len(self.jobs)

        for job in self.jobs:
            if self._cancel_flag:
                break

            try:
                self.job_started.emit(job.id)
                self._process_job(job)

                if job.status == "completed":
                    success_count += 1
                    self.job_completed.emit(job.id)
                else:
                    self.job_failed.emit(job.id, job.error_message or "Unknown error")

            except Exception as e:
                logger.error(f"Job failed: {job.file_name}: {e}")
                job.status = "failed"
                job.error_message = str(e)
                self.job_failed.emit(job.id, str(e))

        self.all_completed.emit(success_count, total_count)

    def _process_job(self, job: UnifiedUploadJob):
        """Process a single upload job."""
        logger.info(f"Processing job: {job.file_name} -> {job.destination}")

        # Check if we need to generate proxy (video files going to dailies)
        needs_proxy = (
            job.destination == "dailies"
            and job.file_type in VIDEO_EXTENSIONS
            and job.destination_config.get("generate_proxy", True)
        )

        proxy_path = None

        # Step 1: Generate proxy if needed
        if needs_proxy:
            self.job_progress.emit(job.id, 0, f"Generating proxy for {job.file_name}...")
            proxy_path = self._generate_proxy(job)

        if self._cancel_flag:
            job.status = "failed"
            job.error_message = "Cancelled"
            return

        # Step 2: Upload original file
        self.job_progress.emit(job.id, 30 if needs_proxy else 0, f"Uploading {job.file_name}...")

        success = self._upload_file(job)

        if not success:
            return

        # Step 3: Upload proxy if generated
        if proxy_path and proxy_path.exists():
            self.job_progress.emit(job.id, 80, f"Uploading proxy for {job.file_name}...")
            self._upload_proxy(job, proxy_path)

        # Mark complete
        job.status = "completed"
        job.progress = 100.0
        self.job_progress.emit(job.id, 100, f"Completed: {job.file_name}")

    def _generate_proxy(self, job: UnifiedUploadJob) -> Optional[Path]:
        """Generate a local proxy using FFmpeg."""
        if not self.encoder.available:
            logger.warning("FFmpeg not available, skipping proxy generation")
            return None

        input_path = str(job.file_path)
        output_name = f"{job.file_path.stem}_proxy.mp4"
        output_path = self.proxy_dir / output_name

        # Proxy settings - 1080p H.264
        settings = ProxySettings(
            resolution="1920x1080",
            codec="libx264",
            preset="fast",
            bitrate="5M",
            audio_codec="aac",
            audio_bitrate="192k",
        )

        def on_progress(p: float):
            # Scale proxy progress to 0-30%
            percent = p * 30
            self.job_progress.emit(job.id, percent, f"Generating proxy: {int(p * 100)}%")

        try:
            success = self.encoder.generate_proxy(
                input_path=input_path,
                output_path=str(output_path),
                settings=settings,
                progress_callback=on_progress,
            )

            if success and output_path.exists():
                logger.info(f"Proxy generated: {output_path}")
                return output_path
            else:
                logger.warning(f"Proxy generation failed for {job.file_name}")
                return None

        except Exception as e:
            logger.error(f"Proxy generation error: {e}")
            return None

    def _upload_file(self, job: UnifiedUploadJob) -> bool:
        """Upload the original file to S3."""
        project_id = job.destination_config.get("project_id")
        if not project_id:
            project_id = self.config.get_project_id()

        if not project_id:
            job.status = "failed"
            job.error_message = "No project ID configured"
            return False

        # Get day_id for dailies
        day_id = job.destination_config.get("production_day_id")
        camera_label = job.destination_config.get("camera_label", "A")
        roll_name = job.destination_config.get("roll_name", "001")

        # Create upload job for the uploader service
        upload_job = UploadJob(
            file_path=job.file_path,
            file_name=job.file_name,
            file_size=job.file_size,
            content_type=self._get_content_type(job.file_type),
        )

        def on_progress(idx: int, progress: float, status: str):
            # Scale upload progress based on whether we have proxy
            base = 30 if job.destination_config.get("generate_proxy", True) else 0
            scaled_progress = base + (progress * 0.5)  # 30-80% or 0-50%
            self.job_progress.emit(job.id, scaled_progress, status)

        self.uploader.set_progress_callback(on_progress)

        try:
            success = self.uploader.upload_file(
                job=upload_job,
                job_index=0,
                project_id=project_id,
                day_id=day_id,
                verify_checksum=self.verify_checksums,
            )

            if success:
                job.s3_key = upload_job.s3_key
                job.checksum_verified = True
                return True
            else:
                job.status = "failed"
                job.error_message = upload_job.error or "Upload failed"
                return False

        except Exception as e:
            logger.error(f"Upload error: {e}")
            job.status = "failed"
            job.error_message = str(e)
            return False

    def _upload_proxy(self, job: UnifiedUploadJob, proxy_path: Path):
        """Upload the generated proxy file."""
        project_id = job.destination_config.get("project_id") or self.config.get_project_id()
        if not project_id:
            logger.warning("No project ID for proxy upload")
            return

        proxy_job = UploadJob(
            file_path=proxy_path,
            file_name=proxy_path.name,
            file_size=proxy_path.stat().st_size,
            content_type="video/mp4",
        )

        try:
            # Upload proxy with is_rendition flag
            api_key = self.config.get_api_key()
            if not api_key:
                logger.warning("No API key for proxy upload")
                return

            self.uploader.upload_file(
                job=proxy_job,
                job_index=0,
                project_id=project_id,
                verify_checksum=False,  # Proxy verification not critical
            )

            logger.info(f"Proxy uploaded: {proxy_path.name}")

        except Exception as e:
            logger.error(f"Proxy upload error: {e}")

    def _get_content_type(self, file_type: str) -> str:
        """Get MIME type for file extension."""
        mime_types = {
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".mxf": "application/mxf",
            ".avi": "video/x-msvideo",
            ".mkv": "video/x-matroska",
            ".r3d": "application/octet-stream",
            ".braw": "application/octet-stream",
            ".ari": "application/octet-stream",
            ".wav": "audio/wav",
            ".mp3": "audio/mpeg",
            ".aac": "audio/aac",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".tiff": "image/tiff",
            ".pdf": "application/pdf",
        }
        return mime_types.get(file_type.lower(), "application/octet-stream")


class UploadQueueWidget(QWidget):
    """Widget for managing the upload queue with file list."""

    files_changed = pyqtSignal()  # Emitted when files are added/removed
    selection_changed = pyqtSignal()  # Emitted when selection changes

    def __init__(self, parent=None):
        super().__init__(parent)
        self.jobs: List[UnifiedUploadJob] = []
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        # File table
        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(["", "File", "Size", "Destination", "Status"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self.table.setColumnWidth(0, 30)
        self.table.setColumnWidth(2, 80)
        self.table.setColumnWidth(3, 140)
        self.table.setColumnWidth(4, 80)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.itemSelectionChanged.connect(self.selection_changed.emit)

        self.table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                gridline-color: {COLORS['border-gray']};
            }}
            QTableWidget::item {{
                padding: 8px;
                color: {COLORS['bone-white']};
            }}
            QTableWidget::item:selected {{
                background-color: {COLORS['charcoal-light']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['muted-gray']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
                font-weight: bold;
            }}
        """)

        layout.addWidget(self.table, 1)

        # Summary
        self.summary_label = QLabel("No files in queue")
        self.summary_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        layout.addWidget(self.summary_label)

    def _refresh_table(self):
        """Refresh the table with current jobs."""
        self.table.setRowCount(len(self.jobs))

        for row, job in enumerate(self.jobs):
            # Checkbox
            checkbox = QCheckBox()
            checkbox.setChecked(True)
            checkbox.setStyleSheet("margin-left: 8px;")
            self.table.setCellWidget(row, 0, checkbox)

            # File name
            name_item = QTableWidgetItem(job.file_name)
            name_item.setToolTip(str(job.file_path))
            self.table.setItem(row, 1, name_item)

            # Size
            size_item = QTableWidgetItem(job.size_formatted)
            size_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.table.setItem(row, 2, size_item)

            # Destination dropdown
            dest_combo = QComboBox()
            dest_combo.addItems(["Dailies", "Review", "Assets"])
            if job.destination == "dailies":
                dest_combo.setCurrentIndex(0)
            elif job.destination == "review":
                dest_combo.setCurrentIndex(1)
            else:
                dest_combo.setCurrentIndex(2)
            dest_combo.currentIndexChanged.connect(
                lambda idx, j=job: self._on_destination_changed(j, idx)
            )
            self.table.setCellWidget(row, 3, dest_combo)

            # Status
            status_item = QTableWidgetItem(job.status.title())
            if job.status == "completed":
                status_item.setForeground(QColor(COLORS['green']))
            elif job.status == "failed":
                status_item.setForeground(QColor(COLORS['red']))
            elif job.status == "uploading":
                status_item.setForeground(QColor(COLORS['accent-yellow']))
            self.table.setItem(row, 4, status_item)

        self._update_summary()

    def _on_destination_changed(self, job: UnifiedUploadJob, index: int):
        """Handle destination change for a job."""
        destinations = ["dailies", "review", "assets"]
        job.destination = destinations[index]
        job.auto_detected = False

    def _update_summary(self):
        """Update the summary label."""
        if not self.jobs:
            self.summary_label.setText("No files in queue")
            return

        total_size = sum(j.file_size for j in self.jobs)
        size_str = self._format_size(total_size)

        # Count by destination
        dailies_count = sum(1 for j in self.jobs if j.destination == "dailies")
        review_count = sum(1 for j in self.jobs if j.destination == "review")
        assets_count = sum(1 for j in self.jobs if j.destination == "assets")

        parts = []
        if dailies_count:
            parts.append(f"{dailies_count} Dailies")
        if review_count:
            parts.append(f"{review_count} Review")
        if assets_count:
            parts.append(f"{assets_count} Assets")

        dest_str = ", ".join(parts) if parts else ""

        self.summary_label.setText(f"{len(self.jobs)} files ({size_str}) - {dest_str}")

    def _format_size(self, size: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    def get_selected_jobs(self) -> List[UnifiedUploadJob]:
        """Get jobs that are checked in the table."""
        selected = []
        for row in range(self.table.rowCount()):
            checkbox = self.table.cellWidget(row, 0)
            if checkbox and checkbox.isChecked():
                selected.append(self.jobs[row])
        return selected

    def add_jobs(self, jobs: List[UnifiedUploadJob]):
        """Add jobs to the queue."""
        self.jobs.extend(jobs)
        self._refresh_table()
        self.files_changed.emit()

    def clear_all(self):
        """Clear all jobs."""
        self.jobs.clear()
        self._refresh_table()
        self.files_changed.emit()

    def remove_job(self, job_id: str):
        """Remove a specific job by ID."""
        self.jobs = [j for j in self.jobs if j.id != job_id]
        self._refresh_table()
        self.files_changed.emit()

    def remove_completed(self):
        """Remove completed jobs from queue."""
        self.jobs = [j for j in self.jobs if j.status != "completed"]
        self._refresh_table()
        self.files_changed.emit()


class FilesTabWidget(QWidget):
    """Tab for manually adding files to the queue."""

    def __init__(self, queue_widget: UploadQueueWidget, parent=None):
        super().__init__(parent)
        self.queue_widget = queue_widget
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 8, 0, 0)
        layout.setSpacing(8)

        # Header with buttons
        header = QHBoxLayout()
        header.setSpacing(8)

        add_files_btn = QPushButton("+ Add Files")
        add_files_btn.setMinimumHeight(36)
        add_files_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_files_btn.clicked.connect(self._on_add_files)
        header.addWidget(add_files_btn)

        add_folder_btn = QPushButton("+ Add Folder")
        add_folder_btn.setMinimumHeight(36)
        add_folder_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_folder_btn.clicked.connect(self._on_add_folder)
        header.addWidget(add_folder_btn)

        header.addStretch()

        # Expand button to show queue modal
        expand_btn = QPushButton("⛶ Expand")
        expand_btn.setMinimumHeight(36)
        expand_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        expand_btn.setToolTip("Open queue in a larger window")
        expand_btn.clicked.connect(self._on_expand_queue)
        header.addWidget(expand_btn)

        clear_btn = QPushButton("Clear All")
        clear_btn.setMinimumHeight(36)
        clear_btn.setObjectName("danger-button")
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        clear_btn.clicked.connect(self._on_clear_all)
        header.addWidget(clear_btn)

        layout.addLayout(header)

        # Queue widget (shared)
        layout.addWidget(self.queue_widget, 1)

    def _on_add_files(self):
        """Add files via file dialog."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Files to Upload",
            str(Path.home()),
            "All Files (*.*)"
        )

        if files:
            jobs = []
            for file_path in files:
                job = UnifiedUploadJob.create(Path(file_path), source="manual")
                jobs.append(job)
            self.queue_widget.add_jobs(jobs)

    def _on_add_folder(self):
        """Add all files from a folder."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )

        if folder:
            folder_path = Path(folder)
            # Find all supported files
            all_extensions = (VIDEO_EXTENSIONS | AUDIO_EXTENSIONS | IMAGE_EXTENSIONS |
                            DOCUMENT_EXTENSIONS | GRAPHICS_EXTENSIONS | MODEL_3D_EXTENSIONS)
            files = []
            for ext in all_extensions:
                files.extend(folder_path.rglob(f"*{ext}"))
                files.extend(folder_path.rglob(f"*{ext.upper()}"))

            files = list(set(files))  # Remove duplicates

            if not files:
                QMessageBox.information(
                    self,
                    "No Files Found",
                    f"No supported media files found in:\n{folder}"
                )
                return

            jobs = []
            for file_path in sorted(files):
                job = UnifiedUploadJob.create(file_path, source="manual")
                jobs.append(job)
            self.queue_widget.add_jobs(jobs)

    def _on_clear_all(self):
        """Clear all files from queue."""
        if not self.queue_widget.jobs:
            return

        reply = QMessageBox.question(
            self,
            "Clear Queue",
            "Remove all files from the upload queue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            self.queue_widget.clear_all()

    def _on_expand_queue(self):
        """Open queue in expanded modal dialog."""
        dialog = UploadQueueDialog(self.queue_widget, self)
        dialog.exec()


class UploadQueueDialog(QDialog):
    """Modal dialog showing the upload queue in a larger, resizable window."""

    def __init__(self, queue_widget: UploadQueueWidget, parent=None):
        super().__init__(parent)
        self.queue_widget = queue_widget
        self.setWindowTitle("Upload Queue")
        self.setMinimumSize(900, 600)
        self.resize(1100, 700)
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Header
        header = QHBoxLayout()
        title = QLabel("Upload Queue")
        title.setStyleSheet(f"""
            font-size: 18px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        header.addWidget(title)

        header.addStretch()

        file_count = len(self.queue_widget.jobs)
        total_size = sum(j.file_size for j in self.queue_widget.jobs)
        size_str = self._format_size(total_size)
        count_label = QLabel(f"{file_count} file(s) • {size_str}")
        count_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 13px;")
        header.addWidget(count_label)

        layout.addLayout(header)

        # Queue table (create a copy for this dialog)
        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(["File", "Size", "Type", "Destination", "Status"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self.table.setColumnWidth(1, 100)
        self.table.setColumnWidth(2, 100)
        self.table.setColumnWidth(3, 120)
        self.table.setColumnWidth(4, 100)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        self.table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                gridline-color: {COLORS['border-gray']};
            }}
            QTableWidget::item {{
                padding: 8px;
                color: {COLORS['bone-white']};
            }}
            QTableWidget::item:selected {{
                background-color: {COLORS['accent-yellow']};
                color: {COLORS['charcoal-black']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['muted-gray']};
                border: none;
                padding: 8px;
                font-weight: bold;
            }}
        """)

        # Populate table
        self._populate_table()
        layout.addWidget(self.table, 1)

        # Buttons
        buttons = QHBoxLayout()

        add_files_btn = QPushButton("+ Add Files")
        add_files_btn.clicked.connect(self._on_add_files)
        buttons.addWidget(add_files_btn)

        remove_btn = QPushButton("Remove Selected")
        remove_btn.clicked.connect(self._on_remove_selected)
        buttons.addWidget(remove_btn)

        buttons.addStretch()

        close_btn = QPushButton("Close")
        close_btn.clicked.connect(self.accept)
        buttons.addWidget(close_btn)

        layout.addLayout(buttons)

    def _populate_table(self):
        """Fill the table with queue data."""
        jobs = self.queue_widget.jobs
        self.table.setRowCount(len(jobs))

        for row, job in enumerate(jobs):
            # File name
            name_item = QTableWidgetItem(job.file_name)
            name_item.setData(Qt.ItemDataRole.UserRole, job.id)
            self.table.setItem(row, 0, name_item)

            # Size
            size_item = QTableWidgetItem(self._format_size(job.file_size))
            self.table.setItem(row, 1, size_item)

            # Type
            type_item = QTableWidgetItem(job.file_type.upper().lstrip('.'))
            self.table.setItem(row, 2, type_item)

            # Destination
            dest_item = QTableWidgetItem(job.destination.capitalize())
            self.table.setItem(row, 3, dest_item)

            # Status
            status = job.status.capitalize() if job.status else "Queued"
            status_item = QTableWidgetItem(status)
            self.table.setItem(row, 4, status_item)

    def _format_size(self, size_bytes: int) -> str:
        """Format file size for display."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

    def _on_add_files(self):
        """Add files via file dialog."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Files to Upload",
            str(Path.home()),
            "All Files (*.*)"
        )

        if files:
            jobs = []
            for file_path in files:
                job = UnifiedUploadJob.create(Path(file_path), source="manual")
                jobs.append(job)
            self.queue_widget.add_jobs(jobs)
            self._populate_table()

    def _on_remove_selected(self):
        """Remove selected files from queue."""
        selected_rows = set()
        for item in self.table.selectedItems():
            selected_rows.add(item.row())

        if not selected_rows:
            return

        # Get job IDs to remove
        job_ids = []
        for row in selected_rows:
            item = self.table.item(row, 0)
            if item:
                job_ids.append(item.data(Qt.ItemDataRole.UserRole))

        # Remove from queue widget
        for job_id in job_ids:
            self.queue_widget.remove_job(job_id)

        # Refresh table
        self._populate_table()


class WatchFolderTabWidget(QWidget):
    """Tab for configuring watch folders that auto-add files."""

    def __init__(self, queue_widget: UploadQueueWidget, config: ConfigManager, parent=None):
        super().__init__(parent)
        self.queue_widget = queue_widget
        self.config = config
        self.watch_folders: List[Dict[str, Any]] = []
        self.file_watcher = QFileSystemWatcher()
        self.file_watcher.directoryChanged.connect(self._on_directory_changed)
        self._setup_ui()
        self._load_watch_folders()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 8, 0, 0)
        layout.setSpacing(12)

        # Header
        header = QHBoxLayout()
        header.setSpacing(8)

        add_btn = QPushButton("+ Add Watch Folder")
        add_btn.setMinimumHeight(36)
        add_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_btn.clicked.connect(self._on_add_watch_folder)
        header.addWidget(add_btn)

        header.addStretch()

        layout.addLayout(header)

        # Watch folders list
        self.folders_table = QTableWidget()
        self.folders_table.setColumnCount(4)
        self.folders_table.setHorizontalHeaderLabels(["Folder", "Destination", "Status", ""])
        self.folders_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.folders_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.folders_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.folders_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.folders_table.setColumnWidth(1, 120)
        self.folders_table.setColumnWidth(2, 80)
        self.folders_table.setColumnWidth(3, 80)
        self.folders_table.verticalHeader().setVisible(False)
        self.folders_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
            QTableWidget::item {{
                padding: 8px;
                color: {COLORS['bone-white']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['muted-gray']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
                font-weight: bold;
            }}
        """)
        layout.addWidget(self.folders_table, 1)

        # Info label
        info_label = QLabel("Watch folders automatically add new files to the upload queue")
        info_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        layout.addWidget(info_label)

    def _load_watch_folders(self):
        """Load watch folders from config."""
        self.watch_folders = self.config.get("watch_folders", [])
        self._refresh_table()

        # Start watching
        for folder in self.watch_folders:
            path = folder.get("path")
            if path and Path(path).exists():
                self.file_watcher.addPath(path)

    def _save_watch_folders(self):
        """Save watch folders to config."""
        self.config.set("watch_folders", self.watch_folders)

    def _refresh_table(self):
        """Refresh the watch folders table."""
        self.folders_table.setRowCount(len(self.watch_folders))

        for row, folder in enumerate(self.watch_folders):
            # Folder path
            path_item = QTableWidgetItem(folder.get("path", ""))
            path_item.setToolTip(folder.get("path", ""))
            self.folders_table.setItem(row, 0, path_item)

            # Destination
            dest_combo = QComboBox()
            dest_combo.addItems(["Auto", "Dailies", "Review", "Assets"])
            dest = folder.get("destination", "auto")
            if dest == "dailies":
                dest_combo.setCurrentIndex(1)
            elif dest == "review":
                dest_combo.setCurrentIndex(2)
            elif dest == "assets":
                dest_combo.setCurrentIndex(3)
            else:
                dest_combo.setCurrentIndex(0)
            dest_combo.currentIndexChanged.connect(
                lambda idx, r=row: self._on_dest_changed(r, idx)
            )
            self.folders_table.setCellWidget(row, 1, dest_combo)

            # Status
            status = "Active" if folder.get("enabled", True) else "Paused"
            status_item = QTableWidgetItem(status)
            status_item.setForeground(QColor(COLORS['green'] if status == "Active" else COLORS['muted-gray']))
            self.folders_table.setItem(row, 2, status_item)

            # Remove button
            remove_btn = QPushButton("Remove")
            remove_btn.clicked.connect(lambda _, r=row: self._on_remove_folder(r))
            self.folders_table.setCellWidget(row, 3, remove_btn)

    def _on_add_watch_folder(self):
        """Add a new watch folder."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Watch Folder",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )

        if folder:
            # Check if already watching
            existing = [f.get("path") for f in self.watch_folders]
            if folder in existing:
                QMessageBox.warning(self, "Already Watching", f"This folder is already being watched.")
                return

            self.watch_folders.append({
                "path": folder,
                "destination": "auto",
                "enabled": True,
            })
            self.file_watcher.addPath(folder)
            self._save_watch_folders()
            self._refresh_table()

    def _on_remove_folder(self, row: int):
        """Remove a watch folder."""
        if row < len(self.watch_folders):
            folder = self.watch_folders[row]
            path = folder.get("path")
            if path:
                self.file_watcher.removePath(path)
            self.watch_folders.pop(row)
            self._save_watch_folders()
            self._refresh_table()

    def _on_dest_changed(self, row: int, index: int):
        """Handle destination change for a watch folder."""
        if row < len(self.watch_folders):
            destinations = ["auto", "dailies", "review", "assets"]
            self.watch_folders[row]["destination"] = destinations[index]
            self._save_watch_folders()

    def _on_directory_changed(self, path: str):
        """Handle directory change event."""
        folder_path = Path(path)
        if not folder_path.exists():
            return

        # Find the watch folder config
        folder_config = None
        for f in self.watch_folders:
            if f.get("path") == path:
                folder_config = f
                break

        if not folder_config or not folder_config.get("enabled", True):
            return

        # Find new files
        all_extensions = (VIDEO_EXTENSIONS | AUDIO_EXTENSIONS | IMAGE_EXTENSIONS |
                        DOCUMENT_EXTENSIONS | GRAPHICS_EXTENSIONS | MODEL_3D_EXTENSIONS)

        for ext in all_extensions:
            for file_path in folder_path.glob(f"*{ext}"):
                # Check if not already in queue
                existing_paths = [str(j.file_path) for j in self.queue_widget.jobs]
                if str(file_path) not in existing_paths:
                    dest = folder_config.get("destination", "auto")
                    if dest == "auto":
                        job = UnifiedUploadJob.create(file_path, source="watch_folder")
                    else:
                        job = UnifiedUploadJob.create(file_path, destination=dest, source="watch_folder")
                    self.queue_widget.add_jobs([job])


class HistoryTabWidget(QWidget):
    """Tab for viewing upload history."""

    def __init__(self, config: ConfigManager, parent=None):
        super().__init__(parent)
        self.config = config
        self.history: List[Dict[str, Any]] = []
        self._setup_ui()
        self._load_history()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 8, 0, 0)
        layout.setSpacing(8)

        # Header
        header = QHBoxLayout()
        header.setSpacing(8)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.setMinimumHeight(36)
        refresh_btn.clicked.connect(self._load_history)
        header.addWidget(refresh_btn)

        header.addStretch()

        clear_btn = QPushButton("Clear History")
        clear_btn.setMinimumHeight(36)
        clear_btn.clicked.connect(self._clear_history)
        header.addWidget(clear_btn)

        layout.addLayout(header)

        # History table
        self.history_table = QTableWidget()
        self.history_table.setColumnCount(5)
        self.history_table.setHorizontalHeaderLabels(["File", "Destination", "Size", "Date", "Status"])
        self.history_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.history_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.history_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.history_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        self.history_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)
        self.history_table.setColumnWidth(1, 100)
        self.history_table.setColumnWidth(2, 80)
        self.history_table.setColumnWidth(3, 140)
        self.history_table.setColumnWidth(4, 80)
        self.history_table.verticalHeader().setVisible(False)
        self.history_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
            QTableWidget::item {{
                padding: 8px;
                color: {COLORS['bone-white']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['muted-gray']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
                font-weight: bold;
            }}
        """)
        layout.addWidget(self.history_table, 1)

        # Summary
        self.summary_label = QLabel("")
        self.summary_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        layout.addWidget(self.summary_label)

    def _load_history(self):
        """Load upload history from config."""
        self.history = self.config.get("upload_history", [])
        self._refresh_table()

    def _refresh_table(self):
        """Refresh the history table."""
        self.history_table.setRowCount(len(self.history))

        for row, item in enumerate(reversed(self.history)):  # Show newest first
            # File name
            name_item = QTableWidgetItem(item.get("file_name", ""))
            name_item.setToolTip(item.get("file_path", ""))
            self.history_table.setItem(row, 0, name_item)

            # Destination
            dest_item = QTableWidgetItem(item.get("destination", "").title())
            self.history_table.setItem(row, 1, dest_item)

            # Size
            size = item.get("file_size", 0)
            size_str = self._format_size(size)
            size_item = QTableWidgetItem(size_str)
            size_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.history_table.setItem(row, 2, size_item)

            # Date
            date_str = item.get("completed_at", "")
            if date_str:
                try:
                    dt = datetime.fromisoformat(date_str)
                    date_str = dt.strftime("%Y-%m-%d %H:%M")
                except:
                    pass
            date_item = QTableWidgetItem(date_str)
            self.history_table.setItem(row, 3, date_item)

            # Status
            status = item.get("status", "unknown")
            status_item = QTableWidgetItem(status.title())
            if status == "completed":
                status_item.setForeground(QColor(COLORS['green']))
            elif status == "failed":
                status_item.setForeground(QColor(COLORS['red']))
            self.history_table.setItem(row, 4, status_item)

        # Update summary
        total = len(self.history)
        completed = sum(1 for h in self.history if h.get("status") == "completed")
        failed = sum(1 for h in self.history if h.get("status") == "failed")
        self.summary_label.setText(f"Total: {total} uploads ({completed} completed, {failed} failed)")

    def _format_size(self, size: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    def _clear_history(self):
        """Clear upload history."""
        reply = QMessageBox.question(
            self,
            "Clear History",
            "Clear all upload history?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            self.history = []
            self.config.set("upload_history", [])
            self._refresh_table()

    def add_to_history(self, job: UnifiedUploadJob):
        """Add a completed job to history."""
        self.history.append({
            "file_name": job.file_name,
            "file_path": str(job.file_path),
            "file_size": job.file_size,
            "destination": job.destination,
            "status": job.status,
            "completed_at": datetime.now().isoformat(),
            "checksum_verified": job.checksum_verified,
        })
        # Keep last 1000 items
        self.history = self.history[-1000:]
        self.config.set("upload_history", self.history)
        self._refresh_table()


class DestinationSettingsDialog(QDialog):
    """Modal dialog for destination settings on small screens."""

    def __init__(self, dest_type: str, on_create_folder=None, parent=None):
        super().__init__(parent)
        self.dest_type = dest_type
        self._on_create_folder = on_create_folder  # Callback for creating new folders
        self.setWindowTitle(f"{dest_type.title()} Settings")
        self.setMinimumWidth(350)
        self.setStyleSheet(f"background-color: {COLORS['charcoal-black']};")
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(12)

        if self.dest_type == "dailies":
            self._setup_dailies_ui(layout)
        elif self.dest_type == "review":
            self._setup_review_ui(layout)
        elif self.dest_type == "assets":
            self._setup_assets_ui(layout)

        # Buttons
        buttons = QHBoxLayout()
        buttons.addStretch()

        cancel_btn = QPushButton("Cancel")
        cancel_btn.setMinimumHeight(36)
        cancel_btn.clicked.connect(self.reject)
        buttons.addWidget(cancel_btn)

        save_btn = QPushButton("Save")
        save_btn.setMinimumHeight(36)
        save_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['accent-yellow']};
                color: {COLORS['charcoal-black']};
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                font-weight: bold;
            }}
        """)
        save_btn.clicked.connect(self.accept)
        buttons.addWidget(save_btn)

        layout.addLayout(buttons)

    def _setup_dailies_ui(self, layout):
        layout.addWidget(QLabel("Project:"))
        self.project = QComboBox()
        self.project.addItem("Select project...", None)
        self.project.setMinimumHeight(36)
        layout.addWidget(self.project)

        layout.addWidget(QLabel("Production Day:"))
        self.day_combo = QComboBox()
        self.day_combo.addItem("Select day...", None)
        self.day_combo.setMinimumHeight(36)
        layout.addWidget(self.day_combo)

        layout.addWidget(QLabel("Camera:"))
        self.camera = QComboBox()
        self.camera.addItems(["A", "B", "C", "D", "E", "F", "G", "H"])
        self.camera.setMinimumHeight(36)
        layout.addWidget(self.camera)

        self.proxy = QCheckBox("Generate proxies (H.264 1080p)")
        self.proxy.setChecked(True)
        layout.addWidget(self.proxy)

    def _setup_review_ui(self, layout):
        layout.addWidget(QLabel("Folder:"))
        self.folder = QComboBox()
        self.folder.addItem("Select folder...", None)
        self.folder.setMinimumHeight(36)
        layout.addWidget(self.folder)

        layout.addWidget(QLabel("Transcode Quality:"))
        self.quality = QComboBox()
        self.quality.addItems([
            "High (H.264 1080p)",
            "Medium (H.264 720p)",
            "Low (H.264 480p)",
            "Original (no transcode)"
        ])
        self.quality.setMinimumHeight(36)
        layout.addWidget(self.quality)

        self.proxy = QCheckBox("Also generate editing proxies")
        self.proxy.setChecked(False)
        layout.addWidget(self.proxy)

    def _setup_assets_ui(self, layout):
        layout.addWidget(QLabel("Folder:"))

        # Folder row with combo and Create button
        folder_row = QHBoxLayout()
        folder_row.setSpacing(8)

        self.folder = QComboBox()
        self.folder.addItem("Select folder...", None)
        self.folder.setMinimumHeight(36)
        folder_row.addWidget(self.folder, 1)

        self.create_folder_btn = QPushButton("+ Create")
        self.create_folder_btn.setMinimumHeight(36)
        self.create_folder_btn.setMinimumWidth(80)
        self.create_folder_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.create_folder_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['accent-yellow']};
                color: {COLORS['charcoal-black']};
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #e5c64f;
            }}
        """)
        self.create_folder_btn.clicked.connect(self._on_create_folder_clicked)
        folder_row.addWidget(self.create_folder_btn)

        layout.addLayout(folder_row)

        layout.addWidget(QLabel("Tags:"))
        self.tags = QLineEdit()
        self.tags.setPlaceholderText("tag1, tag2, ...")
        self.tags.setMinimumHeight(36)
        layout.addWidget(self.tags)

        self.proxy = QCheckBox("Generate proxies (video files)")
        self.proxy.setChecked(False)
        layout.addWidget(self.proxy)

    def _on_create_folder_clicked(self):
        """Handle create folder button click."""
        # Check if folder creation is available (project must be selected)
        if not self._on_create_folder:
            QMessageBox.warning(
                self,
                "No Project Selected",
                "Please select a project before creating a folder."
            )
            return

        name, ok = QInputDialog.getText(
            self,
            "Create Asset Folder",
            "Enter folder name:",
            QLineEdit.EchoMode.Normal
        )
        if ok and name.strip():
            # Call the callback with the folder name
            folder = self._on_create_folder(name.strip())
            if folder:
                # Add the new folder to the combo and select it
                folder_id = folder.get("id")
                folder_name = folder.get("name", name.strip())
                self.folder.addItem(folder_name, folder_id)
                self.folder.setCurrentIndex(self.folder.count() - 1)
                QMessageBox.information(
                    self,
                    "Folder Created",
                    f"Folder '{folder_name}' created successfully."
                )
            else:
                QMessageBox.warning(
                    self,
                    "Error",
                    "Failed to create folder. Check the logs for details."
                )


class DestinationSettingsPanel(QWidget):
    """Panel for configuring destination-specific settings.
    Uses button/modal approach for a cleaner, consistent interface.
    """

    def __init__(self, config: ConfigManager = None, project_api=None, parent=None):
        super().__init__(parent)
        self.config = config
        self._project_api = project_api
        self._projects = []
        self._production_days = []  # List of production days for current project
        self._dailies_days = []  # List of existing dailies days
        self._review_folders = []  # List of review folders
        self._asset_folders = []  # List of asset folders
        self._current_project_id = None

        # Store current settings (used by modals)
        self._dailies_config = {
            "project_id": None,
            "project_name": "Select project...",
            "production_day_id": None,
            "production_day_name": "Select day...",
            "dailies_day_id": None,  # The actual dailies folder ID
            "camera": "A",
            "generate_proxy": True,
        }
        self._review_config = {
            "folder_id": None,
            "folder_name": "Select folder...",
            "quality": 0,  # Index: 0=High, 1=Medium, 2=Low, 3=Original
            "generate_proxy": False,
        }
        self._assets_config = {
            "folder_id": None,
            "folder_name": "Select folder...",
            "tags": "",
            "generate_proxy": False,
        }

        self._setup_ui()

    def _setup_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Destination checkboxes with settings buttons
        # Assets is always enabled (primary destination)

        # Assets destination (always enabled)
        assets_container = QHBoxLayout()
        assets_container.setSpacing(4)
        self.assets_check = QCheckBox()
        self.assets_check.setChecked(True)
        self.assets_check.setEnabled(False)  # Assets always enabled
        self.assets_check.setToolTip("Assets is always enabled as the primary destination")
        assets_container.addWidget(self.assets_check)
        self.assets_btn = QPushButton("📁 Assets: Not set")
        self.assets_btn.setMinimumHeight(32)
        self.assets_btn.setMinimumWidth(140)
        self.assets_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.assets_btn.clicked.connect(lambda: self._open_settings_dialog("assets"))
        self.assets_btn.setStyleSheet(self._get_compact_button_style())
        assets_container.addWidget(self.assets_btn)
        layout.addLayout(assets_container)

        # Dailies destination (optional)
        dailies_container = QHBoxLayout()
        dailies_container.setSpacing(4)
        self.dailies_check = QCheckBox()
        self.dailies_check.setChecked(False)
        self.dailies_check.setToolTip("Also add to Dailies")
        self.dailies_check.stateChanged.connect(self._on_dailies_toggled)
        dailies_container.addWidget(self.dailies_check)
        self.dailies_btn = QPushButton("📦 Dailies")
        self.dailies_btn.setMinimumHeight(32)
        self.dailies_btn.setMinimumWidth(140)
        self.dailies_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.dailies_btn.clicked.connect(lambda: self._open_settings_dialog("dailies"))
        self.dailies_btn.setStyleSheet(self._get_compact_button_style(enabled=False))
        dailies_container.addWidget(self.dailies_btn)
        layout.addLayout(dailies_container)

        # Review destination (optional)
        review_container = QHBoxLayout()
        review_container.setSpacing(4)
        self.review_check = QCheckBox()
        self.review_check.setChecked(False)
        self.review_check.setToolTip("Also add to Review")
        self.review_check.stateChanged.connect(self._on_review_toggled)
        review_container.addWidget(self.review_check)
        self.review_btn = QPushButton("🎬 Review")
        self.review_btn.setMinimumHeight(32)
        self.review_btn.setMinimumWidth(140)
        self.review_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.review_btn.clicked.connect(lambda: self._open_settings_dialog("review"))
        self.review_btn.setStyleSheet(self._get_compact_button_style(enabled=False))
        review_container.addWidget(self.review_btn)
        layout.addLayout(review_container)

        layout.addStretch()

        self._update_button_labels()

    def _on_dailies_toggled(self, state: int):
        """Handle dailies checkbox toggle."""
        enabled = state == Qt.CheckState.Checked.value
        self.dailies_btn.setStyleSheet(self._get_compact_button_style(enabled=enabled))
        self._update_button_labels()

    def _on_review_toggled(self, state: int):
        """Handle review checkbox toggle."""
        enabled = state == Qt.CheckState.Checked.value
        self.review_btn.setStyleSheet(self._get_compact_button_style(enabled=enabled))
        self._update_button_labels()

    def get_enabled_destinations(self) -> List[str]:
        """Get list of enabled destinations."""
        destinations = ["assets"]  # Always enabled
        if self.dailies_check.isChecked():
            destinations.append("dailies")
        if self.review_check.isChecked():
            destinations.append("review")
        return destinations

    def _get_button_style(self) -> str:
        return f"""
            QPushButton {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                padding: 12px 16px;
                font-size: 13px;
                font-weight: bold;
                text-align: left;
            }}
            QPushButton:hover {{
                background-color: {COLORS['charcoal-dark']};
                border-color: {COLORS['accent-yellow']};
            }}
        """

    def _get_compact_button_style(self, enabled: bool = True) -> str:
        if enabled:
            return f"""
                QPushButton {{
                    background-color: {COLORS['charcoal-dark']};
                    color: {COLORS['bone-white']};
                    border: 1px solid {COLORS['accent-yellow']};
                    border-radius: 4px;
                    padding: 6px 10px;
                    font-size: 12px;
                    text-align: left;
                }}
                QPushButton:hover {{
                    background-color: {COLORS['charcoal-light']};
                    border-color: {COLORS['accent-yellow']};
                }}
            """
        else:
            return f"""
                QPushButton {{
                    background-color: {COLORS['charcoal-dark']};
                    color: {COLORS['muted-gray']};
                    border: 1px solid {COLORS['border-gray']};
                    border-radius: 4px;
                    padding: 6px 10px;
                    font-size: 12px;
                    text-align: left;
                }}
                QPushButton:hover {{
                    background-color: {COLORS['charcoal-light']};
                    border-color: {COLORS['muted-gray']};
                }}
            """

    def _update_button_labels(self):
        """Update button labels to show current settings."""
        # Assets - primary destination (always enabled)
        assets_folder = self._assets_config.get("folder_name", "Not set")
        if assets_folder == "Select folder...":
            assets_folder = "Not set"
        if len(assets_folder) > 12:
            assets_folder = assets_folder[:9] + "..."
        self.assets_btn.setText(f"📁 {assets_folder}")
        self.assets_btn.setToolTip(f"Assets folder: {self._assets_config.get('folder_name', 'Not set')}")

        # Dailies - optional, show status
        dailies_enabled = self.dailies_check.isChecked()
        day_name = self._dailies_config.get("production_day_name", "Not set")
        if day_name in ("Select day...", "Select production day..."):
            day_name = "Not set"
        if len(day_name) > 12:
            day_name = day_name[:9] + "..."

        if dailies_enabled:
            self.dailies_btn.setText(f"📦 {day_name}")
        else:
            self.dailies_btn.setText("📦 Dailies")
        self.dailies_btn.setToolTip(
            f"Also add to Dailies: {self._dailies_config.get('production_day_name', 'Not set')}"
            if dailies_enabled else "Check to also add to Dailies"
        )

        # Review - optional, show status
        review_enabled = self.review_check.isChecked()
        review_folder = self._review_config.get("folder_name", "Not set")
        if review_folder == "Select folder...":
            review_folder = "Not set"
        if len(review_folder) > 12:
            review_folder = review_folder[:9] + "..."

        if review_enabled:
            self.review_btn.setText(f"🎬 {review_folder}")
        else:
            self.review_btn.setText("🎬 Review")
        self.review_btn.setToolTip(
            f"Also add to Review: {self._review_config.get('folder_name', 'Not set')}"
            if review_enabled else "Check to also add to Review"
        )

    def _open_settings_dialog(self, dest_type: str):
        """Open settings dialog for a destination type."""
        # Create callback for assets folder creation
        create_folder_callback = None
        if dest_type == "assets" and self._project_api and self._current_project_id:
            def create_folder_callback(name):
                folder = self._project_api.create_asset_folder(self._current_project_id, name)
                if folder:
                    # Add to our local list too
                    self._asset_folders.append(folder)
                return folder

        dialog = DestinationSettingsDialog(dest_type, on_create_folder=create_folder_callback, parent=self)

        # Pre-populate with current values
        if dest_type == "dailies":
            # Hide project dropdown - project is selected at page level
            dialog.project.setVisible(False)
            # Find and hide the "Project:" label
            for i in range(dialog.layout().count()):
                item = dialog.layout().itemAt(i)
                if item and item.widget():
                    widget = item.widget()
                    if isinstance(widget, QLabel) and widget.text() == "Project:":
                        widget.setVisible(False)
                        break

            # Populate production day dropdown
            dialog.day_combo.clear()
            dialog.day_combo.addItem("Select production day...", None)
            for day in self._production_days:
                day_id = day.get("id")
                day_num = day.get("day_number", "?")
                day_date = day.get("date", "")
                day_title = day.get("title", "")
                # Format: "Day 1 - 2024-01-15 - Scene at Beach"
                display = f"Day {day_num}"
                if day_date:
                    display += f" - {day_date}"
                if day_title:
                    display += f" - {day_title}"
                dialog.day_combo.addItem(display, day_id)

            # Set current selection
            current_day_id = self._dailies_config.get("production_day_id")
            if current_day_id:
                for i in range(dialog.day_combo.count()):
                    if dialog.day_combo.itemData(i) == current_day_id:
                        dialog.day_combo.setCurrentIndex(i)
                        break

            # Set camera
            camera = self._dailies_config.get("camera", "A")
            cameras = ["A", "B", "C", "D", "E", "F", "G", "H"]
            if camera in cameras:
                dialog.camera.setCurrentIndex(cameras.index(camera))

            dialog.proxy.setChecked(self._dailies_config.get("generate_proxy", True))

        elif dest_type == "review":
            # Populate review folder dropdown
            dialog.folder.clear()
            dialog.folder.addItem("Select folder...", None)
            for folder in self._review_folders:
                folder_id = folder.get("id")
                folder_name = folder.get("name", "Untitled")
                dialog.folder.addItem(folder_name, folder_id)

            # Set current selection
            current_folder_id = self._review_config.get("folder_id")
            if current_folder_id:
                for i in range(dialog.folder.count()):
                    if dialog.folder.itemData(i) == current_folder_id:
                        dialog.folder.setCurrentIndex(i)
                        break

            dialog.quality.setCurrentIndex(self._review_config.get("quality", 0))
            dialog.proxy.setChecked(self._review_config.get("generate_proxy", False))

        elif dest_type == "assets":
            # Populate asset folder dropdown
            dialog.folder.clear()
            dialog.folder.addItem("Select folder...", None)
            for folder in self._asset_folders:
                folder_id = folder.get("id")
                folder_name = folder.get("name", "Untitled")
                dialog.folder.addItem(folder_name, folder_id)

            # Set current selection
            current_folder_id = self._assets_config.get("folder_id")
            if current_folder_id:
                for i in range(dialog.folder.count()):
                    if dialog.folder.itemData(i) == current_folder_id:
                        dialog.folder.setCurrentIndex(i)
                        break

            dialog.tags.setText(self._assets_config.get("tags", ""))
            dialog.proxy.setChecked(self._assets_config.get("generate_proxy", False))

        if dialog.exec() == QDialog.DialogCode.Accepted:
            # Copy values back
            if dest_type == "dailies":
                self._dailies_config["production_day_id"] = dialog.day_combo.currentData()
                self._dailies_config["production_day_name"] = dialog.day_combo.currentText()
                self._dailies_config["camera"] = dialog.camera.currentText()
                self._dailies_config["generate_proxy"] = dialog.proxy.isChecked()

                # Find the dailies_day_id that corresponds to the selected production day
                prod_day_id = dialog.day_combo.currentData()
                if prod_day_id:
                    dailies_day = next(
                        (d for d in self._dailies_days
                         if d.get("production_day_id") == prod_day_id),
                        None
                    )
                    if dailies_day:
                        self._dailies_config["dailies_day_id"] = dailies_day.get("id")
                    else:
                        # Need to create one - will be handled during upload
                        self._dailies_config["dailies_day_id"] = None

            elif dest_type == "review":
                self._review_config["folder_id"] = dialog.folder.currentData()
                self._review_config["folder_name"] = dialog.folder.currentText()
                self._review_config["quality"] = dialog.quality.currentIndex()
                self._review_config["generate_proxy"] = dialog.proxy.isChecked()

            elif dest_type == "assets":
                self._assets_config["folder_id"] = dialog.folder.currentData()
                self._assets_config["folder_name"] = dialog.folder.currentText()
                self._assets_config["tags"] = dialog.tags.text()
                self._assets_config["generate_proxy"] = dialog.proxy.isChecked()

            self._update_button_labels()

    def get_dailies_config(self) -> Dict[str, Any]:
        """Get current dailies configuration."""
        return {
            "project_id": self._dailies_config.get("project_id"),
            "production_day_id": self._dailies_config.get("production_day_id"),
            "dailies_day_id": self._dailies_config.get("dailies_day_id"),
            "camera_label": self._dailies_config.get("camera", "A"),
            "generate_proxy": self._dailies_config.get("generate_proxy", True),
        }

    def get_review_config(self) -> Dict[str, Any]:
        """Get current review configuration."""
        quality_map = {0: "high", 1: "medium", 2: "low", 3: "original"}
        return {
            "folder_id": self._review_config.get("folder_id"),
            "quality": quality_map.get(self._review_config.get("quality", 0), "high"),
            "generate_proxy": self._review_config.get("generate_proxy", False),
        }

    def get_assets_config(self) -> Dict[str, Any]:
        """Get current assets configuration."""
        tags_str = self._assets_config.get("tags", "")
        tags = [t.strip() for t in tags_str.split(",") if t.strip()]
        return {
            "folder_id": self._assets_config.get("folder_id"),
            "tags": tags,
            "generate_proxy": self._assets_config.get("generate_proxy", False),
        }

    def set_projects(self, projects: List[Dict[str, Any]]):
        """Set the list of available projects."""
        self._projects = projects
        self._update_button_labels()

        # Auto-select if only one project
        if len(self._projects) == 1:
            project = self._projects[0]
            self._dailies_config["project_id"] = project.get("id")
            self._dailies_config["project_name"] = project.get("title") or project.get("name", "Untitled")
            self._update_button_labels()

    def set_project_data(
        self,
        project_id: str,
        project_name: str,
        production_days: List[Dict[str, Any]],
        dailies_days: List[Dict[str, Any]],
        review_folders: List[Dict[str, Any]],
        asset_folders: List[Dict[str, Any]],
    ):
        """Set all project-related data when a project is selected."""
        self._current_project_id = project_id
        self._production_days = production_days
        self._dailies_days = dailies_days
        self._review_folders = review_folders
        self._asset_folders = asset_folders

        # Update dailies config
        self._dailies_config["project_id"] = project_id
        self._dailies_config["project_name"] = project_name

        # Reset selections when project changes
        self._dailies_config["production_day_id"] = None
        self._dailies_config["production_day_name"] = "Select day..."
        self._dailies_config["dailies_day_id"] = None
        self._review_config["folder_id"] = None
        self._review_config["folder_name"] = "Select folder..."
        self._assets_config["folder_id"] = None
        self._assets_config["folder_name"] = "Select folder..."

        self._update_button_labels()

    def get_production_days(self) -> List[Dict[str, Any]]:
        """Get the list of production days."""
        return self._production_days

    def get_dailies_days(self) -> List[Dict[str, Any]]:
        """Get the list of existing dailies days."""
        return self._dailies_days

    def get_review_folders(self) -> List[Dict[str, Any]]:
        """Get the list of review folders."""
        return self._review_folders

    def get_asset_folders(self) -> List[Dict[str, Any]]:
        """Get the list of asset folders."""
        return self._asset_folders

    def get_current_project_id(self) -> Optional[str]:
        """Get the currently selected project ID."""
        return self._current_project_id


class UploadOptionsPanel(QWidget):
    """Compact panel for upload options."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()

    def _setup_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)

        # Parallel uploads (compact)
        parallel_label = QLabel("Parallel:")
        parallel_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(parallel_label)

        self.parallel_spin = QSpinBox()
        self.parallel_spin.setRange(1, 5)
        self.parallel_spin.setValue(3)
        self.parallel_spin.setFixedWidth(50)
        self.parallel_spin.setFixedHeight(28)
        self.parallel_spin.setStyleSheet(f"""
            QSpinBox {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 12px;
            }}
        """)
        layout.addWidget(self.parallel_spin)

        layout.addSpacing(8)

        # Checksum verification (compact)
        self.verify_check = QCheckBox("Verify")
        self.verify_check.setChecked(True)
        self.verify_check.setToolTip("Verify checksums after upload")
        self.verify_check.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 11px;")
        layout.addWidget(self.verify_check)

        # Resume failed (compact)
        self.resume_check = QCheckBox("Resume")
        self.resume_check.setChecked(True)
        self.resume_check.setToolTip("Resume failed uploads")
        self.resume_check.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 11px;")
        layout.addWidget(self.resume_check)

        # Hidden but kept for API compatibility
        self.auto_upload_combo = QComboBox()
        self.auto_upload_combo.addItems([
            "Add to queue only",
            "Start upload immediately",
            "Ask me each time"
        ])
        self.auto_upload_combo.setVisible(False)

    def get_options(self) -> Dict[str, Any]:
        return {
            "parallel": self.parallel_spin.value(),
            "verify_checksums": self.verify_check.isChecked(),
            "resume_failed": self.resume_check.isChecked(),
            "auto_upload_mode": self.auto_upload_combo.currentIndex(),
        }


class UnifiedUploadPage(QWidget):
    """Combined upload page for Dailies, Review, and Assets."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.connection_manager = None
        self.session: Optional[UploadSession] = None
        self.is_uploading = False
        self._upload_worker: Optional[UploadWorker] = None
        self._projects = []  # List of available projects
        self._project_api = ProjectAPIService(config)  # API service for fetching project data

        self._setup_ui()

    def set_connection_manager(self, connection_manager):
        """Set the connection manager and load projects when connected."""
        self.connection_manager = connection_manager
        if connection_manager:
            connection_manager.status_changed.connect(self._on_connection_changed)
            # Load projects if already connected
            self._load_projects_from_connection()

    def _on_connection_changed(self, state: str, details: dict):
        """Handle connection status changes."""
        if state == "connected":
            self._load_projects_from_connection()
        elif state == "disconnected":
            self._projects = []
            self.project_picker.clear()
            self.project_picker.addItem("Select a project...", None)
            self.dest_settings.set_projects([])

    def _load_projects_from_connection(self):
        """Load projects from the connection manager and populate project picker."""
        if not self.connection_manager:
            return

        details = self.connection_manager.details
        if not details:
            return

        self._projects = details.get("projects", [])
        self.dest_settings.set_projects(self._projects)

        # Populate project picker dropdown
        self.project_picker.blockSignals(True)  # Block signals during population
        self.project_picker.clear()
        self.project_picker.addItem("Select a project...", None)
        for project in self._projects:
            project_id = project.get("id")
            project_name = project.get("title") or project.get("name", "Untitled")
            self.project_picker.addItem(project_name, project_id)
        self.project_picker.blockSignals(False)

        # Auto-select if only one project
        if len(self._projects) == 1:
            self.project_picker.setCurrentIndex(1)
            # This will trigger _on_project_selected

    def _on_project_selected(self, index: int):
        """Handle project selection - fetch project data."""
        project_id = self.project_picker.currentData()

        if not project_id:
            # Reset status and clear data
            self.project_status.setText("")
            return

        # Find project name
        project_name = self.project_picker.currentText()

        # Show loading status
        self.project_status.setText("Loading project data...")

        # Fetch project data in background thread
        self._fetch_project_data(project_id, project_name)

    def _fetch_project_data(self, project_id: str, project_name: str):
        """Fetch production days, review folders, and asset folders for a project."""
        # Use QTimer to run in background-ish (not blocking UI too long)
        # For a fully non-blocking approach, we'd use QThread, but this is simpler

        try:
            # Fetch all data
            production_days = self._project_api.get_production_days(project_id)
            dailies_days = self._project_api.get_dailies_days(project_id)
            review_folders = self._project_api.get_review_folders(project_id)
            asset_folders = self._project_api.get_asset_folders(project_id)

            # Update status
            day_count = len(production_days)
            review_count = len(review_folders)
            asset_count = len(asset_folders)
            self.project_status.setText(
                f"{day_count} production days, {review_count} review folders, {asset_count} asset folders"
            )

            # Pass data to destination settings panel
            self.dest_settings.set_project_data(
                project_id=project_id,
                project_name=project_name,
                production_days=production_days,
                dailies_days=dailies_days,
                review_folders=review_folders,
                asset_folders=asset_folders,
            )

            # Store project ID in config for upload
            self.config.set_project_id(project_id)

            logger.info(
                f"Loaded project data for {project_name}: "
                f"{day_count} days, {review_count} review folders, {asset_count} asset folders"
            )

        except Exception as e:
            logger.error(f"Error fetching project data: {e}")
            self.project_status.setText(f"Error loading project data")
            QMessageBox.warning(
                self,
                "Error",
                f"Failed to load project data:\n{e}"
            )

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)  # Reduced margins
        layout.setSpacing(8)  # Reduced spacing

        # Header (compact)
        header = QHBoxLayout()

        title = QLabel("Upload")
        title.setStyleSheet(f"""
            font-size: 20px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        header.addWidget(title)

        header.addStretch()

        help_btn = QPushButton("? Help")
        help_btn.setMinimumHeight(32)
        help_btn.clicked.connect(self._show_help)
        header.addWidget(help_btn)

        layout.addLayout(header)

        # Project picker section (compact)
        project_section = QFrame()
        project_section.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 8px;
            }}
        """)
        project_layout = QHBoxLayout(project_section)
        project_layout.setContentsMargins(12, 8, 12, 8)
        project_layout.setSpacing(12)

        project_label = QLabel("Upload to Project:")
        project_label.setStyleSheet(f"""
            color: {COLORS['bone-white']};
            font-size: 14px;
            font-weight: bold;
        """)
        project_layout.addWidget(project_label)

        self.project_picker = QComboBox()
        self.project_picker.addItem("Select a project...", None)
        self.project_picker.setMinimumHeight(40)
        self.project_picker.setMinimumWidth(300)
        self.project_picker.currentIndexChanged.connect(self._on_project_selected)
        self.project_picker.setStyleSheet(f"""
            QComboBox {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 14px;
            }}
            QComboBox:hover {{
                border-color: {COLORS['accent-yellow']};
            }}
            QComboBox::drop-down {{
                border: none;
                padding-right: 10px;
            }}
        """)
        project_layout.addWidget(self.project_picker)

        self.project_status = QLabel("")
        self.project_status.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        project_layout.addWidget(self.project_status)

        project_layout.addStretch()

        layout.addWidget(project_section)

        # Shared queue widget (used across tabs)
        self.queue_widget = UploadQueueWidget()
        self.queue_widget.files_changed.connect(self._on_queue_changed)

        # Tab widget for Files / Watch Folder / History
        self.tab_widget = QTabWidget()
        self.tab_widget.setStyleSheet(f"""
            QTabWidget::pane {{
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                background-color: {COLORS['charcoal-dark']};
            }}
            QTabBar::tab {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['muted-gray']};
                padding: 10px 20px;
                border: 1px solid {COLORS['border-gray']};
                border-bottom: none;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                margin-right: 2px;
            }}
            QTabBar::tab:selected {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
            }}
            QTabBar::tab:hover {{
                color: {COLORS['bone-white']};
            }}
        """)

        # Create tabs
        self.files_tab = FilesTabWidget(self.queue_widget)
        self.watch_tab = WatchFolderTabWidget(self.queue_widget, self.config)
        self.history_tab = HistoryTabWidget(self.config)

        self.tab_widget.addTab(self.files_tab, "Files")
        self.tab_widget.addTab(self.watch_tab, "Watch Folder")
        self.tab_widget.addTab(self.history_tab, "History")

        layout.addWidget(self.tab_widget, 1)

        # Combined Settings Bar (destination + upload options in one row)
        settings_bar = QFrame()
        settings_bar.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
        """)
        settings_layout = QHBoxLayout(settings_bar)
        settings_layout.setContentsMargins(12, 8, 12, 8)
        settings_layout.setSpacing(8)

        # Destination settings (inline, more compact buttons)
        self.dest_settings = DestinationSettingsPanel(config=self.config, project_api=self._project_api)
        self.dest_settings.setStyleSheet("")  # Remove any frame styling
        settings_layout.addWidget(self.dest_settings)

        # Separator
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.VLine)
        separator.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        separator.setFixedWidth(1)
        separator.setFixedHeight(36)
        settings_layout.addWidget(separator)

        # Upload options (inline)
        self.options_panel = UploadOptionsPanel()
        settings_layout.addWidget(self.options_panel)

        layout.addWidget(settings_bar)

        # Progress section (collapsible - only shows bar when uploading)
        self.progress_frame = QFrame()
        self.progress_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 8px 12px;
            }}
        """)
        progress_layout = QVBoxLayout(self.progress_frame)
        progress_layout.setContentsMargins(0, 0, 0, 0)
        progress_layout.setSpacing(6)

        # Status line (always visible)
        progress_header = QHBoxLayout()
        progress_header.setSpacing(8)
        self.progress_label = QLabel("Ready to upload")
        self.progress_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        progress_header.addWidget(self.progress_label)
        progress_header.addStretch()
        self.speed_label = QLabel("")
        self.speed_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        progress_header.addWidget(self.speed_label)
        progress_layout.addLayout(progress_header)

        # Progress bar (hidden when not uploading)
        self.progress_bar = QProgressBar()
        self.progress_bar.setMinimum(0)
        self.progress_bar.setMaximum(100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        self.progress_bar.setFixedHeight(20)
        self.progress_bar.setVisible(False)  # Hidden by default
        self.progress_bar.setStyleSheet(f"""
            QProgressBar {{
                background-color: {COLORS['charcoal-dark']};
                border: none;
                border-radius: 4px;
            }}
            QProgressBar::chunk {{
                background-color: {COLORS['accent-yellow']};
                border-radius: 4px;
            }}
        """)
        progress_layout.addWidget(self.progress_bar)

        layout.addWidget(self.progress_frame)

        # Action buttons
        buttons = QHBoxLayout()
        buttons.addStretch()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setMinimumHeight(44)
        self.cancel_btn.setMinimumWidth(100)
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self._on_cancel)
        buttons.addWidget(self.cancel_btn)

        self.start_btn = QPushButton("Start Upload")
        self.start_btn.setMinimumHeight(44)
        self.start_btn.setMinimumWidth(140)
        self.start_btn.setObjectName("primary-button")
        self.start_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.start_btn.clicked.connect(self._on_start_upload)
        self.start_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['accent-yellow']};
                color: {COLORS['charcoal-black']};
                border: none;
                border-radius: 6px;
                padding: 12px 24px;
                font-size: 14px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #e5ac1e;
            }}
            QPushButton:disabled {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['muted-gray']};
            }}
        """)
        buttons.addWidget(self.start_btn)

        layout.addLayout(buttons)

    def _on_queue_changed(self):
        """Handle queue changes."""
        jobs = self.queue_widget.jobs
        self.start_btn.setEnabled(len(jobs) > 0)

        # Update status line with file count (when not uploading)
        if not self.is_uploading:
            if jobs:
                total_size = sum(j.file_size for j in jobs)
                self.progress_label.setText(f"Ready to upload {len(jobs)} file(s) ({self._format_size(total_size)})")
            else:
                self.progress_label.setText("Drag files here or click + to add")

    def _on_start_upload(self):
        """Start the upload process."""
        jobs = self.queue_widget.get_selected_jobs()

        if not jobs:
            QMessageBox.warning(
                self,
                "No Files Selected",
                "Please select files to upload."
            )
            return

        # Check if API key is configured
        api_key = self.config.get_api_key()
        if not api_key:
            QMessageBox.warning(
                self,
                "Not Configured",
                "Please connect to your SWN account first.\n\n"
                "Go to Settings > Account to enter your API key."
            )
            return

        # Check if project is configured
        project_id = self.dest_settings.get_current_project_id()
        if not project_id:
            project_id = self.config.get_project_id()
        if not project_id:
            QMessageBox.warning(
                self,
                "No Project Selected",
                "Please select a project before uploading."
            )
            return

        # Get destination configs
        dailies_config = self.dest_settings.get_dailies_config()
        review_config = self.dest_settings.get_review_config()
        assets_config = self.dest_settings.get_assets_config()

        # Auto-create dailies folder if production day is selected but no folder exists
        dailies_jobs = [j for j in jobs if j.destination == "dailies"]
        if dailies_jobs:
            prod_day_id = dailies_config.get("production_day_id")
            dailies_day_id = dailies_config.get("dailies_day_id")

            # If production day selected but no folder, create one
            if prod_day_id and not dailies_day_id:
                self.progress_label.setText("Creating dailies folder...")
                try:
                    result = self._project_api.create_dailies_day(
                        project_id=project_id,
                        production_day_id=prod_day_id
                    )
                    if result:
                        dailies_day_id = result.get("id")
                        dailies_config["dailies_day_id"] = dailies_day_id
                        logger.info(f"Created dailies folder: {dailies_day_id}")
                except Exception as e:
                    logger.warning(f"Could not create dailies folder: {e}")
                    # Continue anyway - upload without specific day

        # Create session
        self.session = UploadSession.create()
        self.session.jobs = jobs
        self.session.verify_checksums = self.options_panel.verify_check.isChecked()
        self.session.parallel_uploads = self.options_panel.parallel_spin.value()

        # Update UI - show progress bar when uploading
        self.is_uploading = True
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setVisible(True)  # Expand progress section
        self.progress_label.setText(f"Starting upload of {len(jobs)} files...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 12px;")
        self.progress_bar.setValue(0)

        # Apply destination configs to each job
        for job in jobs:
            job.destination_config["project_id"] = project_id

            if job.destination == "dailies":
                job.destination_config.update({
                    "production_day_id": dailies_config.get("production_day_id"),
                    "dailies_day_id": dailies_config.get("dailies_day_id"),
                    "camera_label": dailies_config.get("camera_label", "A"),
                    "generate_proxy": dailies_config.get("generate_proxy", True),
                })
            elif job.destination == "review":
                job.destination_config.update({
                    "folder_id": review_config.get("folder_id"),
                    "quality": review_config.get("quality", "high"),
                    "generate_proxy": review_config.get("generate_proxy", False),
                })
            elif job.destination == "assets":
                job.destination_config.update({
                    "folder_id": assets_config.get("folder_id"),
                    "tags": assets_config.get("tags", []),
                    "generate_proxy": assets_config.get("generate_proxy", False),
                })

        # Create and start upload worker
        self._upload_worker = UploadWorker(
            config=self.config,
            jobs=jobs,
            verify_checksums=self.session.verify_checksums,
            parallel_uploads=self.session.parallel_uploads,
        )

        # Connect worker signals
        self._upload_worker.job_started.connect(self._on_job_started)
        self._upload_worker.job_progress.connect(self._on_job_progress)
        self._upload_worker.job_completed.connect(self._on_job_completed)
        self._upload_worker.job_failed.connect(self._on_job_failed)
        self._upload_worker.all_completed.connect(self._on_all_completed)

        # Start the worker
        self._upload_worker.start()

    def _on_job_started(self, job_id: str):
        """Handle job started signal."""
        # Update queue widget to show job is in progress
        for job in self.session.jobs:
            if job.id == job_id:
                job.status = "uploading"
                break
        self.queue_widget._refresh_table()

    def _on_job_progress(self, job_id: str, percent: float, status: str):
        """Handle job progress update."""
        # Update progress bar
        if self.session:
            completed = sum(1 for j in self.session.jobs if j.status == "completed")
            current_job_idx = next(
                (i for i, j in enumerate(self.session.jobs) if j.id == job_id),
                0
            )
            total_progress = (completed * 100 + percent) / len(self.session.jobs)
            self.progress_bar.setValue(int(total_progress))
            self.progress_label.setText(f"[{completed + 1}/{len(self.session.jobs)}] {status}")

    def _on_job_completed(self, job_id: str):
        """Handle job completed signal."""
        for job in self.session.jobs:
            if job.id == job_id:
                job.status = "completed"
                break
        self.queue_widget._refresh_table()

    def _on_job_failed(self, job_id: str, error: str):
        """Handle job failed signal."""
        for job in self.session.jobs:
            if job.id == job_id:
                job.status = "failed"
                job.error_message = error
                break
        self.queue_widget._refresh_table()

    def _on_all_completed(self, success_count: int, total_count: int):
        """Handle all uploads completed signal."""
        self.is_uploading = False
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self._upload_worker = None

        if success_count == total_count:
            self.progress_label.setText(f"✓ Completed: {success_count} file(s) uploaded")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']}; font-size: 12px;")
            self.progress_bar.setValue(100)
            QMessageBox.information(
                self,
                "Upload Complete",
                f"Successfully uploaded {success_count} file(s)."
            )
        else:
            self.progress_label.setText(f"⚠ Completed with errors: {success_count}/{total_count} uploaded")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']}; font-size: 12px;")
            self.progress_bar.setValue(100)

            # Collect error messages from failed jobs
            failed_jobs = [j for j in self.session.jobs if j.status == "failed"]
            error_details = "\n".join(
                f"• {j.file_name}: {j.error_message or 'Unknown error'}"
                for j in failed_jobs[:5]  # Show max 5 errors
            )
            if len(failed_jobs) > 5:
                error_details += f"\n... and {len(failed_jobs) - 5} more"

            QMessageBox.warning(
                self,
                "Upload Complete with Errors",
                f"Uploaded {success_count}/{total_count} files.\n\n"
                f"Failed uploads:\n{error_details}"
            )

        # Hide progress bar after 3 seconds
        QTimer.singleShot(3000, self._collapse_progress)

    def _collapse_progress(self):
        """Collapse the progress section back to minimal state."""
        if not self.is_uploading:
            self.progress_bar.setVisible(False)
            self.progress_bar.setValue(0)
            # Reset status label to ready state
            jobs = self.queue_widget.jobs
            total_size = sum(j.file_size for j in jobs)
            if jobs:
                self.progress_label.setText(f"Ready to upload {len(jobs)} files ({self._format_size(total_size)})")
            else:
                self.progress_label.setText("Ready to upload")
            self.progress_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")

    def _format_size(self, size_bytes: int) -> str:
        """Format file size for display."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

    def _on_cancel(self):
        """Cancel the current upload."""
        if self.is_uploading:
            reply = QMessageBox.question(
                self,
                "Cancel Upload",
                "Are you sure you want to cancel the upload?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )

            if reply == QMessageBox.StandardButton.Yes:
                if self._upload_worker:
                    self._upload_worker.cancel()
                    self._upload_worker.wait(5000)  # Wait up to 5 seconds
                    self._upload_worker = None

                self.is_uploading = False
                self.start_btn.setEnabled(True)
                self.cancel_btn.setEnabled(False)
                self.progress_label.setText("Upload cancelled")
                # Collapse progress section after delay
                QTimer.singleShot(2000, self._collapse_progress)

    def _show_help(self):
        """Show help dialog."""
        help_text = f"""
<style>
    body {{ color: {COLORS['bone-white']}; font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6; }}
    h2 {{ color: {COLORS['accent-yellow']}; font-size: 18px; border-bottom: 1px solid {COLORS['border-gray']}; padding-bottom: 8px; }}
    h3 {{ color: {COLORS['bone-white']}; font-size: 14px; margin-top: 20px; }}
    b {{ color: {COLORS['accent-yellow']}; }}
</style>

<h2>How to Use the Upload Tab</h2>

<h3>1. Add Files</h3>
<ul>
<li><b>Files Tab:</b> Manually add files or folders</li>
<li><b>Watch Folder:</b> Auto-detect new files in watched directories</li>
<li><b>History:</b> View past uploads and their status</li>
</ul>

<h3>2. Configure Destinations</h3>
<ul>
<li><b>Dailies:</b> Set project, day, camera, and proxy generation</li>
<li><b>Review:</b> Select folder, transcode quality, and optional proxies</li>
<li><b>Assets:</b> Choose folder, tags, and optional proxy generation</li>
</ul>

<h3>3. Proxy Generation</h3>
<ul>
<li>Proxies are generated locally using FFmpeg</li>
<li>Available for Dailies, Review, and Assets (video files)</li>
<li>Transcoding for Review uses local FFmpeg with quality presets</li>
</ul>

<h3>4. Upload Options</h3>
<ul>
<li><b>Parallel:</b> Number of simultaneous uploads (1-5)</li>
<li><b>Verify checksums:</b> Ensure files are uploaded correctly</li>
<li><b>After offload:</b> What happens when offload completes</li>
</ul>
"""
        from PyQt6.QtWidgets import QTextBrowser

        dialog = QDialog(self)
        dialog.setWindowTitle("Upload Help")
        dialog.setMinimumSize(500, 500)
        dialog.setStyleSheet(f"background-color: {COLORS['charcoal-black']};")

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(20, 20, 20, 20)

        text_browser = QTextBrowser()
        text_browser.setHtml(help_text)
        text_browser.setOpenExternalLinks(True)
        layout.addWidget(text_browser)

        close_btn = QPushButton("Got it!")
        close_btn.setObjectName("primary-button")
        close_btn.clicked.connect(dialog.accept)
        layout.addWidget(close_btn)

        dialog.exec()

    def add_from_offload(self, files: List[Path], manifest_id: str):
        """Add files from an offload operation."""
        jobs = []
        for file_path in files:
            job = UnifiedUploadJob.create(
                file_path,
                source="offload",
                manifest_id=manifest_id,
            )
            jobs.append(job)

        self.queue_widget.add_jobs(jobs)

        # Switch to Files tab to show the queue
        self.tab_widget.setCurrentIndex(0)

        # Check auto-upload setting
        auto_mode = self.options_panel.auto_upload_combo.currentIndex()

        if auto_mode == 1:  # Start immediately
            self._on_start_upload()
        elif auto_mode == 2:  # Ask
            reply = QMessageBox.question(
                self,
                "Start Upload?",
                f"{len(jobs)} files added to upload queue.\n\nStart upload now?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.Yes
            )
            if reply == QMessageBox.StandardButton.Yes:
                self._on_start_upload()
