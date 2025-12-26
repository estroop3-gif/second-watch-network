"""
Upload page - Direct upload to Dailies platform.
Three modes: Browse & Upload, Recent Offloads, Watch Folder
"""
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QListWidget,
    QListWidgetItem,
    QProgressBar,
    QComboBox,
    QLineEdit,
    QCheckBox,
    QFileDialog,
    QTabWidget,
    QMessageBox,
    QScrollArea,
    QSplitter,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from pathlib import Path
from typing import List, Optional
import threading

from src.services.config import ConfigManager
from src.services.uploader import UploaderService, UploadJob, UploadStatus
from src.services.watch_folder import WatchFolderService, WatchFolderActivityLog
from src.services.upload_queue import UploadQueueService, UploadQueueItem, QueueItemStatus
from src.ui.styles import COLORS


class UploadWorker(QThread):
    """Background worker for file uploads."""
    progress = pyqtSignal(int, float, str)  # job_index, percent, status
    finished = pyqtSignal(bool, list)  # success, jobs

    def __init__(
        self,
        uploader: UploaderService,
        jobs: List[UploadJob],
        project_id: str,
        day_id: Optional[str],
        camera_label: str,
        roll_name: str,
        verify_checksum: bool,
    ):
        super().__init__()
        self.uploader = uploader
        self.jobs = jobs
        self.project_id = project_id
        self.day_id = day_id
        self.camera_label = camera_label
        self.roll_name = roll_name
        self.verify_checksum = verify_checksum

    def run(self):
        def progress_callback(job_index, percent, status):
            self.progress.emit(job_index, percent, status)

        self.uploader.set_progress_callback(progress_callback)

        success = self.uploader.upload_batch(
            jobs=self.jobs,
            project_id=self.project_id,
            day_id=self.day_id,
            camera_label=self.camera_label,
            roll_name=self.roll_name,
            verify_checksum=self.verify_checksum,
        )

        self.finished.emit(success, self.jobs)


class BrowseUploadTab(QWidget):
    """Tab for browsing and uploading files manually."""

    def __init__(self, config: ConfigManager, uploader: UploaderService):
        super().__init__()
        self.config = config
        self.uploader = uploader
        self.selected_files: List[Path] = []
        self.current_jobs: List[UploadJob] = []
        self.upload_worker: Optional[UploadWorker] = None
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 15, 0, 0)
        layout.setSpacing(15)

        # Two column layout with splitter for resizing
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(8)

        # Left: File selection
        left = self.create_file_panel()
        left.setMinimumWidth(200)
        splitter.addWidget(left)

        # Right: Project settings (in scroll area)
        right_scroll = QScrollArea()
        right_scroll.setWidgetResizable(True)
        right_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        right_scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        right_panel = self.create_settings_panel()
        right_panel.setMinimumWidth(180)
        right_scroll.setWidget(right_panel)
        splitter.addWidget(right_scroll)

        # Set initial sizes (60/40 split)
        splitter.setSizes([300, 200])

        layout.addWidget(splitter, 1)

        # Bottom: Progress
        progress_panel = self.create_progress_panel()
        layout.addWidget(progress_panel)

    def create_file_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Select Files")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Browse button
        browse_btn = QPushButton("📁  Browse Files...")
        browse_btn.clicked.connect(self.browse_files)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(browse_btn)

        # File list
        self.file_list = QListWidget()
        layout.addWidget(self.file_list, 1)

        # Summary
        self.file_summary = QLabel("No files selected")
        self.file_summary.setObjectName("label-muted")
        layout.addWidget(self.file_summary)

        # Clear button
        clear_btn = QPushButton("Clear Selection")
        clear_btn.clicked.connect(self.clear_files)
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(clear_btn)

        return panel

    def create_settings_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Upload Settings")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Camera label
        cam_label = QLabel("Camera")
        cam_label.setObjectName("label-muted")
        layout.addWidget(cam_label)

        self.camera_input = QLineEdit()
        self.camera_input.setPlaceholderText("A, B, C...")
        self.camera_input.setText("A")
        layout.addWidget(self.camera_input)

        # Roll name
        roll_label = QLabel("Roll Name")
        roll_label.setObjectName("label-muted")
        layout.addWidget(roll_label)

        self.roll_input = QLineEdit()
        self.roll_input.setPlaceholderText("A001, B002...")
        self.roll_input.setText("A001")
        layout.addWidget(self.roll_input)

        # Separator
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

        # Options
        options_label = QLabel("Options")
        options_label.setObjectName("label-muted")
        layout.addWidget(options_label)

        self.verify_checksum = QCheckBox("Verify checksums")
        self.verify_checksum.setChecked(True)
        layout.addWidget(self.verify_checksum)

        layout.addStretch()

        return panel

    def create_progress_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(12)

        self.progress_label = QLabel("Ready to upload")
        self.progress_label.setObjectName("label-muted")
        layout.addWidget(self.progress_label)

        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)

        self.file_progress = QLabel("")
        self.file_progress.setObjectName("label-small")
        layout.addWidget(self.file_progress)

        # Buttons
        btn_layout = QHBoxLayout()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("danger-button")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self.cancel_upload)
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.cancel_btn)

        btn_layout.addStretch()

        self.upload_btn = QPushButton("Start Upload")
        self.upload_btn.setObjectName("primary-button")
        self.upload_btn.clicked.connect(self.start_upload)
        self.upload_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.upload_btn)

        layout.addLayout(btn_layout)

        return panel

    def browse_files(self):
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Media Files",
            str(Path.home()),
            "Media Files (*.mov *.mp4 *.mxf *.avi *.r3d *.braw);;All Files (*)",
        )
        if files:
            self.selected_files = [Path(f) for f in files]
            self.update_file_list()

    def clear_files(self):
        self.selected_files = []
        self.file_list.clear()
        self.file_summary.setText("No files selected")

    def update_file_list(self):
        self.file_list.clear()
        total_size = 0

        for path in self.selected_files:
            item = QListWidgetItem(f"📹  {path.name}")
            item.setData(Qt.ItemDataRole.UserRole, path)
            self.file_list.addItem(item)
            if path.exists():
                total_size += path.stat().st_size

        size_str = self.format_size(total_size)
        self.file_summary.setText(f"{len(self.selected_files)} files selected • {size_str}")

    def format_size(self, size_bytes: int) -> str:
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def start_upload(self):
        if not self.selected_files:
            self.progress_label.setText("⚠️  Please select files to upload")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        project_id = self.config.get_project_id()
        if not project_id:
            self.progress_label.setText("⚠️  Not connected to a project")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        # Create jobs
        self.current_jobs = self.uploader.create_jobs(self.selected_files)

        # Update UI
        self.upload_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)
        self.progress_label.setText("Starting upload...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")

        # Start worker
        self.upload_worker = UploadWorker(
            uploader=self.uploader,
            jobs=self.current_jobs,
            project_id=project_id,
            day_id=None,
            camera_label=self.camera_input.text() or "A",
            roll_name=self.roll_input.text() or "A001",
            verify_checksum=self.verify_checksum.isChecked(),
        )
        self.upload_worker.progress.connect(self.on_progress)
        self.upload_worker.finished.connect(self.on_finished)
        self.upload_worker.start()

    def cancel_upload(self):
        if self.upload_worker:
            self.uploader.cancel()
        self.progress_label.setText("Upload cancelled")
        self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
        self.upload_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

    def on_progress(self, job_index: int, percent: float, status: str):
        total_jobs = len(self.current_jobs)
        overall = ((job_index + percent / 100) / total_jobs) * 100
        self.progress_bar.setValue(int(overall))
        self.progress_label.setText(status)
        self.file_progress.setText(f"File {job_index + 1} of {total_jobs}")

    def on_finished(self, success: bool, jobs: List[UploadJob]):
        self.upload_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

        if success:
            self.progress_bar.setValue(100)
            self.progress_label.setText("✓ Upload complete!")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']};")
        else:
            failed = sum(1 for j in jobs if j.status == UploadStatus.FAILED)
            self.progress_label.setText(f"Upload finished with {failed} failures")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")


class RecentOffloadsTab(QWidget):
    """Tab for uploading files from recent offload operations."""

    def __init__(self, config: ConfigManager, uploader: UploaderService):
        super().__init__()
        self.config = config
        self.uploader = uploader
        self.upload_queue = UploadQueueService.get_instance()
        self.upload_worker: Optional[UploadWorker] = None
        self.current_jobs: List[UploadJob] = []
        self.selected_manifest_id: Optional[str] = None
        self.setup_ui()
        self.connect_signals()
        self.refresh_list()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 15, 0, 0)
        layout.setSpacing(15)

        # Two column layout with splitter for resizing
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(8)

        # Left: Offload list
        left = self.create_offload_list_panel()
        splitter.addWidget(left)

        # Right: Upload settings (in scroll area)
        right_scroll = QScrollArea()
        right_scroll.setWidgetResizable(True)
        right_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        right_scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        right_panel = self.create_settings_panel()
        right_scroll.setWidget(right_panel)
        splitter.addWidget(right_scroll)

        # Set initial sizes (60/40 split)
        splitter.setSizes([300, 200])

        layout.addWidget(splitter, 1)

        # Bottom: Progress
        progress_panel = self.create_progress_panel()
        layout.addWidget(progress_panel)

    def create_offload_list_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")
        panel.setMinimumWidth(250)

        layout = QVBoxLayout(panel)
        layout.setSpacing(12)

        label = QLabel("Recent Offloads")
        label.setObjectName("card-title")
        layout.addWidget(label)

        hint = QLabel("Files queued for upload from offload operations")
        hint.setObjectName("label-small")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        # Offload list
        self.offload_list = QListWidget()
        self.offload_list.setSelectionMode(QListWidget.SelectionMode.SingleSelection)
        self.offload_list.itemSelectionChanged.connect(self.on_selection_changed)
        layout.addWidget(self.offload_list, 1)

        # Stats
        self.queue_stats = QLabel("No files in queue")
        self.queue_stats.setObjectName("label-muted")
        layout.addWidget(self.queue_stats)

        # Buttons
        btn_row = QHBoxLayout()

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh_list)
        refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_row.addWidget(refresh_btn)

        clear_btn = QPushButton("Clear Completed")
        clear_btn.clicked.connect(self.clear_completed)
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_row.addWidget(clear_btn)

        layout.addLayout(btn_row)

        return panel

    def create_settings_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")
        panel.setMinimumWidth(200)

        layout = QVBoxLayout(panel)
        layout.setSpacing(12)

        label = QLabel("Upload Settings")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Selected offload info
        self.selected_info = QLabel("Select an offload to view details")
        self.selected_info.setObjectName("label-muted")
        self.selected_info.setWordWrap(True)
        layout.addWidget(self.selected_info)

        # Camera override
        cam_label = QLabel("Camera (override)")
        cam_label.setObjectName("label-muted")
        layout.addWidget(cam_label)

        self.camera_input = QLineEdit()
        self.camera_input.setPlaceholderText("Use from offload")
        layout.addWidget(self.camera_input)

        # Roll override
        roll_label = QLabel("Roll (override)")
        roll_label.setObjectName("label-muted")
        layout.addWidget(roll_label)

        self.roll_input = QLineEdit()
        self.roll_input.setPlaceholderText("Use from offload")
        layout.addWidget(self.roll_input)

        # Separator
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

        # Options
        self.verify_checksum = QCheckBox("Verify checksums before upload")
        self.verify_checksum.setChecked(True)
        layout.addWidget(self.verify_checksum)

        layout.addStretch()

        return panel

    def create_progress_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(10)

        self.progress_label = QLabel("Select an offload and click Upload")
        self.progress_label.setObjectName("label-muted")
        layout.addWidget(self.progress_label)

        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)

        self.file_progress = QLabel("")
        self.file_progress.setObjectName("label-small")
        layout.addWidget(self.file_progress)

        # Buttons
        btn_layout = QHBoxLayout()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("danger-button")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self.cancel_upload)
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.cancel_btn)

        btn_layout.addStretch()

        self.upload_all_btn = QPushButton("Upload All")
        self.upload_all_btn.clicked.connect(self.upload_all)
        self.upload_all_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.upload_all_btn)

        self.upload_btn = QPushButton("Upload Selected")
        self.upload_btn.setObjectName("primary-button")
        self.upload_btn.clicked.connect(self.upload_selected)
        self.upload_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.upload_btn.setEnabled(False)
        btn_layout.addWidget(self.upload_btn)

        layout.addLayout(btn_layout)

        return panel

    def connect_signals(self):
        """Connect to upload queue signals."""
        self.upload_queue.queue_updated.connect(self.refresh_list)

    def refresh_list(self):
        """Refresh the offload list from queue."""
        self.offload_list.clear()
        grouped = self.upload_queue.get_grouped_by_manifest()
        stats = self.upload_queue.get_queue_stats()

        for manifest_id, items in grouped.items():
            pending = sum(1 for i in items if i.status == QueueItemStatus.PENDING)
            completed = sum(1 for i in items if i.status == QueueItemStatus.COMPLETED)
            failed = sum(1 for i in items if i.status == QueueItemStatus.FAILED)
            total = len(items)

            # Determine status color/icon
            if failed > 0:
                icon = "❌"
                status = f"{failed} failed"
            elif completed == total:
                icon = "✓"
                status = "Complete"
            elif pending == total:
                icon = "⏳"
                status = f"{pending} pending"
            else:
                icon = "📤"
                status = f"{completed}/{total} uploaded"

            # Get camera/roll from first item
            camera = items[0].camera_label if items else "A"
            roll = items[0].roll_name if items else ""
            display_name = f"{camera}{roll}" if roll else f"Camera {camera}"

            total_size = sum(i.file_size for i in items)
            size_str = self.format_size(total_size)

            list_item = QListWidgetItem(f"{icon} {display_name} • {total} files • {size_str}\n   {status}")
            list_item.setData(Qt.ItemDataRole.UserRole, manifest_id)

            # Color failed items
            if failed > 0:
                list_item.setForeground(Qt.GlobalColor.red)
            elif completed == total:
                list_item.setForeground(Qt.GlobalColor.gray)

            self.offload_list.addItem(list_item)

        # Update stats
        if stats['total'] > 0:
            self.queue_stats.setText(
                f"{stats['pending']} pending • {stats['completed']} complete • {stats['failed']} failed"
            )
            self.upload_all_btn.setEnabled(stats['pending'] > 0)
        else:
            self.queue_stats.setText("No files in queue")
            self.upload_all_btn.setEnabled(False)

    def on_selection_changed(self):
        """Handle offload selection change."""
        selected = self.offload_list.selectedItems()
        if not selected:
            self.selected_manifest_id = None
            self.selected_info.setText("Select an offload to view details")
            self.upload_btn.setEnabled(False)
            return

        self.selected_manifest_id = selected[0].data(Qt.ItemDataRole.UserRole)
        items = self.upload_queue.get_by_manifest(self.selected_manifest_id)

        if items:
            camera = items[0].camera_label
            roll = items[0].roll_name
            pending = sum(1 for i in items if i.status == QueueItemStatus.PENDING)

            self.selected_info.setText(
                f"Camera: {camera}\nRoll: {roll}\n{len(items)} files ({pending} pending)"
            )
            self.camera_input.setPlaceholderText(camera)
            self.roll_input.setPlaceholderText(roll)
            self.upload_btn.setEnabled(pending > 0)
        else:
            self.selected_info.setText("No files found")
            self.upload_btn.setEnabled(False)

    def upload_selected(self):
        """Upload files from selected offload."""
        if not self.selected_manifest_id:
            return

        items = self.upload_queue.get_by_manifest(self.selected_manifest_id)
        pending = [i for i in items if i.status == QueueItemStatus.PENDING]

        if not pending:
            self.progress_label.setText("No pending files to upload")
            return

        self._start_upload(pending)

    def upload_all(self):
        """Upload all pending files."""
        pending = self.upload_queue.get_pending()
        if not pending:
            self.progress_label.setText("No pending files to upload")
            return

        self._start_upload(pending)

    def _start_upload(self, items: List[UploadQueueItem]):
        """Start uploading a list of queue items."""
        project_id = self.config.get_project_id()
        if not project_id:
            self.progress_label.setText("⚠️ Not connected to a project")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        # Convert queue items to upload jobs
        file_paths = [item.file_path for item in items if item.file_path.exists()]
        if not file_paths:
            self.progress_label.setText("⚠️ No valid files found")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        self.current_jobs = self.uploader.create_jobs(file_paths)

        # Mark items as uploading
        for item in items:
            self.upload_queue.update_status(item.file_path, QueueItemStatus.UPLOADING)

        # Get camera/roll settings
        camera = self.camera_input.text() or (items[0].camera_label if items else "A")
        roll = self.roll_input.text() or (items[0].roll_name if items else "")

        # Update UI
        self.upload_btn.setEnabled(False)
        self.upload_all_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)
        self.progress_label.setText(f"Uploading {len(file_paths)} files...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")

        # Start worker
        self.upload_worker = UploadWorker(
            uploader=self.uploader,
            jobs=self.current_jobs,
            project_id=project_id,
            day_id=items[0].production_day_id if items else None,
            camera_label=camera,
            roll_name=roll,
            verify_checksum=self.verify_checksum.isChecked(),
        )
        self.upload_worker.progress.connect(self.on_progress)
        self.upload_worker.finished.connect(self.on_finished)
        self.upload_worker.start()

    def cancel_upload(self):
        """Cancel current upload."""
        if self.upload_worker:
            self.uploader.cancel()
        self.progress_label.setText("Upload cancelled")
        self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
        self.upload_btn.setEnabled(True)
        self.upload_all_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

        # Mark items back as pending
        for job in self.current_jobs:
            self.upload_queue.update_status(job.file_path, QueueItemStatus.PENDING)

    def on_progress(self, job_index: int, percent: float, status: str):
        """Handle upload progress."""
        total_jobs = len(self.current_jobs)
        overall = ((job_index + percent / 100) / total_jobs) * 100
        self.progress_bar.setValue(int(overall))
        self.progress_label.setText(status)
        self.file_progress.setText(f"File {job_index + 1} of {total_jobs}")

    def on_finished(self, success: bool, jobs: List[UploadJob]):
        """Handle upload completion."""
        self.upload_btn.setEnabled(True)
        self.upload_all_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

        # Update queue status
        for job in jobs:
            if job.status == UploadStatus.COMPLETED:
                self.upload_queue.update_status(job.file_path, QueueItemStatus.COMPLETED, 100.0)
            elif job.status == UploadStatus.FAILED:
                self.upload_queue.update_status(job.file_path, QueueItemStatus.FAILED, 0.0, job.error)
            else:
                self.upload_queue.update_status(job.file_path, QueueItemStatus.PENDING)

        if success:
            self.progress_bar.setValue(100)
            self.progress_label.setText("✓ Upload complete!")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']};")
        else:
            failed = sum(1 for j in jobs if j.status == UploadStatus.FAILED)
            self.progress_label.setText(f"Upload finished with {failed} failures")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")

        self.refresh_list()

    def clear_completed(self):
        """Remove completed items from queue."""
        self.upload_queue.clear_completed()

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"


class WatchFolderTab(QWidget):
    """Tab for auto-uploading from a watched folder."""

    def __init__(self, config: ConfigManager, uploader: UploaderService):
        super().__init__()
        self.config = config
        self.uploader = uploader
        self.watch_service = WatchFolderService(config)
        self.activity_log = WatchFolderActivityLog()
        self.setup_ui()
        self.setup_callbacks()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 20, 0, 0)
        layout.setSpacing(20)

        # Folder selection
        folder_panel = self.create_folder_panel()
        layout.addWidget(folder_panel)

        # Activity log
        log_panel = self.create_log_panel()
        layout.addWidget(log_panel, 1)

    def create_folder_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(12)

        label = QLabel("Watch Folder")
        label.setObjectName("card-title")
        layout.addWidget(label)

        hint = QLabel("New media files in this folder will be queued for upload")
        hint.setObjectName("label-small")
        layout.addWidget(hint)

        # Folder path
        folder_row = QHBoxLayout()

        self.folder_input = QLineEdit()
        self.folder_input.setPlaceholderText("Select a folder to watch...")
        self.folder_input.setReadOnly(True)
        current = self.watch_service.get_watch_folder()
        if current:
            self.folder_input.setText(current)
        folder_row.addWidget(self.folder_input, 1)

        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self.browse_folder)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        folder_row.addWidget(browse_btn)

        layout.addLayout(folder_row)

        # Settings row
        settings_row = QHBoxLayout()

        cam_label = QLabel("Camera:")
        cam_label.setObjectName("label-muted")
        settings_row.addWidget(cam_label)

        self.camera_input = QLineEdit()
        self.camera_input.setPlaceholderText("A")
        self.camera_input.setMaximumWidth(60)
        self.camera_input.setText("A")
        settings_row.addWidget(self.camera_input)

        settings_row.addSpacing(20)

        self.auto_upload = QCheckBox("Auto-upload immediately")
        self.auto_upload.setToolTip("Upload files immediately when detected instead of just queuing")
        settings_row.addWidget(self.auto_upload)

        settings_row.addStretch()

        layout.addLayout(settings_row)

        # Separator
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

        # Status and toggle
        status_row = QHBoxLayout()

        self.status_indicator = QFrame()
        self.status_indicator.setFixedSize(12, 12)
        self.status_indicator.setStyleSheet(f"""
            background-color: {COLORS['muted-gray']};
            border-radius: 6px;
        """)
        status_row.addWidget(self.status_indicator)

        self.status_label = QLabel("Not watching")
        self.status_label.setObjectName("label-muted")
        status_row.addWidget(self.status_label)

        status_row.addStretch()

        self.toggle_btn = QPushButton("Start Watching")
        self.toggle_btn.setObjectName("primary-button")
        self.toggle_btn.clicked.connect(self.toggle_watching)
        self.toggle_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        status_row.addWidget(self.toggle_btn)

        layout.addLayout(status_row)

        return panel

    def create_log_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        header = QHBoxLayout()
        label = QLabel("Activity Log")
        label.setObjectName("card-title")
        header.addWidget(label)

        header.addStretch()

        clear_btn = QPushButton("Clear")
        clear_btn.clicked.connect(self.clear_log)
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(clear_btn)

        layout.addLayout(header)

        self.log_list = QListWidget()
        layout.addWidget(self.log_list, 1)

        return panel

    def setup_callbacks(self):
        def on_detected(path):
            self.activity_log.add(f"Detected: {path.name}", "info")
            self.refresh_log()

        def on_ready(path):
            self.activity_log.add(f"Ready for upload: {path.name}", "success")
            self.refresh_log()
            # Add to upload queue
            self._queue_file_for_upload(path)

        self.watch_service.on_file_detected = on_detected
        self.watch_service.on_file_ready = on_ready

    def _queue_file_for_upload(self, path: Path):
        """Add detected file to the upload queue."""
        upload_queue = UploadQueueService.get_instance()
        camera = self.camera_input.text() or "A"

        added = upload_queue.add_file(
            file_path=path,
            manifest_id="watch_folder",
            project_id=self.config.get_project_id(),
            camera_label=camera,
            roll_name="",
        )

        if added:
            self.activity_log.add(f"Queued for upload: {path.name}", "success")

            # If auto-upload is enabled, trigger immediate upload
            if self.auto_upload.isChecked():
                self._trigger_upload(path)
        else:
            self.activity_log.add(f"Already in queue: {path.name}", "warning")

        self.refresh_log()

    def _trigger_upload(self, path: Path):
        """Trigger immediate upload for a file."""
        project_id = self.config.get_project_id()
        if not project_id:
            self.activity_log.add("Cannot upload: Not connected to project", "error")
            self.refresh_log()
            return

        # Create upload job
        jobs = self.uploader.create_jobs([path])
        if not jobs:
            self.activity_log.add(f"Failed to create upload job: {path.name}", "error")
            self.refresh_log()
            return

        camera = self.camera_input.text() or "A"

        # Start upload in background thread
        def upload_thread():
            def progress_callback(job_index, percent, status):
                pass  # Could update activity log here

            self.uploader.set_progress_callback(progress_callback)
            success = self.uploader.upload_batch(
                jobs=jobs,
                project_id=project_id,
                day_id=None,
                camera_label=camera,
                roll_name="",
                verify_checksum=True,
            )

            # Update queue status
            upload_queue = UploadQueueService.get_instance()
            if success:
                upload_queue.update_status(path, QueueItemStatus.COMPLETED, 100.0)
                self.activity_log.add(f"Upload complete: {path.name}", "success")
            else:
                upload_queue.update_status(path, QueueItemStatus.FAILED, 0.0, jobs[0].error if jobs else "Unknown error")
                self.activity_log.add(f"Upload failed: {path.name}", "error")
            self.refresh_log()

        thread = threading.Thread(target=upload_thread, daemon=True)
        thread.start()
        self.activity_log.add(f"Starting upload: {path.name}", "info")
        self.refresh_log()

    def browse_folder(self):
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Watch Folder",
            str(Path.home()),
        )
        if folder:
            self.folder_input.setText(folder)
            self.watch_service.set_watch_folder(folder)

    def toggle_watching(self):
        if self.watch_service.is_running:
            self.watch_service.stop()
            self.toggle_btn.setText("Start Watching")
            self.status_label.setText("Not watching")
            self.status_indicator.setStyleSheet(f"""
                background-color: {COLORS['muted-gray']};
                border-radius: 6px;
            """)
            self.activity_log.add("Stopped watching", "info")
        else:
            folder = self.folder_input.text()
            if not folder:
                QMessageBox.warning(self, "No Folder", "Please select a folder to watch")
                return
            try:
                self.watch_service.start(folder)
                self.toggle_btn.setText("Stop Watching")
                self.status_label.setText(f"Watching: {Path(folder).name}")
                self.status_indicator.setStyleSheet(f"""
                    background-color: {COLORS['green']};
                    border-radius: 6px;
                """)
                self.activity_log.add(f"Started watching: {folder}", "success")
            except Exception as e:
                QMessageBox.critical(self, "Error", str(e))

        self.refresh_log()

    def refresh_log(self):
        self.log_list.clear()
        for entry in self.activity_log.get_entries(50):
            color = {
                "info": COLORS['muted-gray'],
                "success": COLORS['green'],
                "warning": COLORS['orange'],
                "error": COLORS['red'],
            }.get(entry.level, COLORS['muted-gray'])

            timestamp = entry.timestamp.strftime("%H:%M:%S")
            item = QListWidgetItem(f"[{timestamp}] {entry.message}")
            item.setForeground(Qt.GlobalColor.white)
            self.log_list.addItem(item)

    def clear_log(self):
        self.activity_log.clear()
        self.log_list.clear()


class UploadPage(QWidget):
    """Main upload page with tabs for different upload modes."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.uploader = UploaderService(config)
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        title = QLabel("Upload to Dailies")
        title.setObjectName("page-title")
        layout.addWidget(title)

        subtitle = QLabel("Upload footage directly to your Backlot project")
        subtitle.setObjectName("page-subtitle")
        layout.addWidget(subtitle)

        # Tabs
        self.tabs = QTabWidget()
        self.tabs.setStyleSheet(f"""
            QTabWidget::pane {{
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                background: transparent;
            }}
            QTabBar::tab {{
                background: {COLORS['charcoal-light']};
                color: {COLORS['muted-gray']};
                padding: 12px 24px;
                margin-right: 2px;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
            }}
            QTabBar::tab:selected {{
                background: {COLORS['accent-yellow']};
                color: {COLORS['charcoal-black']};
                font-weight: bold;
            }}
            QTabBar::tab:hover:!selected {{
                background: {COLORS['border-gray']};
                color: {COLORS['bone-white']};
            }}
        """)

        # Add tabs
        browse_tab = BrowseUploadTab(self.config, self.uploader)
        self.tabs.addTab(browse_tab, "📁  Browse & Upload")

        recent_tab = RecentOffloadsTab(self.config, self.uploader)
        self.tabs.addTab(recent_tab, "📤  Recent Offloads")

        watch_tab = WatchFolderTab(self.config, self.uploader)
        self.tabs.addTab(watch_tab, "👁  Watch Folder")

        layout.addWidget(self.tabs, 1)
