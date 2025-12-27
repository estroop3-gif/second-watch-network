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
    QGroupBox, QTabWidget, QTabBar
)
from PyQt6.QtCore import Qt, pyqtSignal, QThread, QTimer, QFileSystemWatcher
from PyQt6.QtGui import QColor

from src.services.config import ConfigManager
from src.services.rclone_service import RcloneService, RcloneConfig, UploadProgress
from src.models.upload_models import (
    UnifiedUploadJob, UploadSession, detect_destination,
    VIDEO_EXTENSIONS, AUDIO_EXTENSIONS, IMAGE_EXTENSIONS,
    DOCUMENT_EXTENSIONS, GRAPHICS_EXTENSIONS, MODEL_3D_EXTENSIONS
)
from src.ui.styles import COLORS


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

    def __init__(self, dest_type: str, parent=None):
        super().__init__(parent)
        self.dest_type = dest_type
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
        self.project.addItem("Select project...")
        layout.addWidget(self.project)

        day_row = QHBoxLayout()
        day_row.addWidget(QLabel("Day:"))
        self.day = QSpinBox()
        self.day.setRange(1, 999)
        self.day.setValue(1)
        day_row.addWidget(self.day)
        day_row.addStretch()
        layout.addLayout(day_row)

        cam_row = QHBoxLayout()
        cam_row.addWidget(QLabel("Camera:"))
        self.camera = QComboBox()
        self.camera.addItems(["A", "B", "C", "D", "E"])
        cam_row.addWidget(self.camera)
        cam_row.addStretch()
        layout.addLayout(cam_row)

        self.proxy = QCheckBox("Generate proxies")
        self.proxy.setChecked(True)
        layout.addWidget(self.proxy)

    def _setup_review_ui(self, layout):
        layout.addWidget(QLabel("Folder:"))
        self.folder = QComboBox()
        self.folder.addItem("Select folder...")
        layout.addWidget(self.folder)

        layout.addWidget(QLabel("Transcode Quality:"))
        self.quality = QComboBox()
        self.quality.addItems(["High (H.264)", "Medium (H.264)", "Low (H.264)", "Original (no transcode)"])
        layout.addWidget(self.quality)

        self.proxy = QCheckBox("Generate proxies")
        self.proxy.setChecked(False)
        layout.addWidget(self.proxy)

    def _setup_assets_ui(self, layout):
        layout.addWidget(QLabel("Folder:"))
        self.folder = QComboBox()
        self.folder.addItem("Select folder...")
        layout.addWidget(self.folder)

        layout.addWidget(QLabel("Tags:"))
        self.tags = QLineEdit()
        self.tags.setPlaceholderText("tag1, tag2, ...")
        layout.addWidget(self.tags)

        self.proxy = QCheckBox("Generate proxies (video)")
        self.proxy.setChecked(False)
        layout.addWidget(self.proxy)


class DestinationSettingsPanel(QWidget):
    """Panel for configuring destination-specific settings.
    Responsive: shows inline panels only when window is maximized/full screen,
    otherwise shows compact buttons that open modals.
    """

    # Height threshold - only show expanded view when plenty of vertical space
    EXPANDED_MIN_HEIGHT = 800  # Window height needed for expanded view

    def __init__(self, parent=None):
        super().__init__(parent)
        self._compact_mode = True  # Start in compact mode by default
        self._setup_ui()

    def _setup_ui(self):
        self.main_layout = QVBoxLayout(self)
        self.main_layout.setContentsMargins(0, 0, 0, 0)
        self.main_layout.setSpacing(12)

        # Expanded view (inline panels)
        self.expanded_widget = QWidget()
        expanded_layout = QHBoxLayout(self.expanded_widget)
        expanded_layout.setContentsMargins(0, 0, 0, 0)
        expanded_layout.setSpacing(12)

        self.dailies_group = self._create_dailies_panel()
        expanded_layout.addWidget(self.dailies_group)

        self.review_group = self._create_review_panel()
        expanded_layout.addWidget(self.review_group)

        self.assets_group = self._create_assets_panel()
        expanded_layout.addWidget(self.assets_group)

        self.main_layout.addWidget(self.expanded_widget)

        # Compact view (buttons that open modals)
        self.compact_widget = QWidget()
        compact_layout = QHBoxLayout(self.compact_widget)
        compact_layout.setContentsMargins(0, 0, 0, 0)
        compact_layout.setSpacing(8)

        self.dailies_btn = QPushButton("Dailies Settings...")
        self.dailies_btn.setMinimumHeight(44)
        self.dailies_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.dailies_btn.clicked.connect(lambda: self._open_settings_dialog("dailies"))
        compact_layout.addWidget(self.dailies_btn)

        self.review_btn = QPushButton("Review Settings...")
        self.review_btn.setMinimumHeight(44)
        self.review_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.review_btn.clicked.connect(lambda: self._open_settings_dialog("review"))
        compact_layout.addWidget(self.review_btn)

        self.assets_btn = QPushButton("Assets Settings...")
        self.assets_btn.setMinimumHeight(44)
        self.assets_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.assets_btn.clicked.connect(lambda: self._open_settings_dialog("assets"))
        compact_layout.addWidget(self.assets_btn)

        self.main_layout.addWidget(self.compact_widget)

        # Start in compact mode
        self.expanded_widget.hide()
        self.compact_widget.show()

    def resizeEvent(self, event):
        """Switch between expanded and compact mode based on available height."""
        super().resizeEvent(event)
        self._check_compact_mode()

    def showEvent(self, event):
        """Check compact mode when widget is shown."""
        super().showEvent(event)
        # Delay check to ensure window geometry is finalized
        QTimer.singleShot(100, self._check_compact_mode)

    def _check_compact_mode(self):
        """Check if we should be in compact mode based on window state."""
        # Get the top-level window
        window = self.window()
        if not window:
            return

        # Check if window is maximized or has enough height
        is_maximized = window.isMaximized() or window.isFullScreen()
        window_height = window.height()

        should_expand = is_maximized or window_height >= self.EXPANDED_MIN_HEIGHT

        if not should_expand and not self._compact_mode:
            self._compact_mode = True
            self.expanded_widget.hide()
            self.compact_widget.show()
        elif should_expand and self._compact_mode:
            self._compact_mode = False
            self.compact_widget.hide()
            self.expanded_widget.show()

    def _open_settings_dialog(self, dest_type: str):
        """Open settings dialog for a destination type."""
        dialog = DestinationSettingsDialog(dest_type, self)

        # Pre-populate with current values
        if dest_type == "dailies":
            dialog.day.setValue(self.dailies_day.value())
            dialog.camera.setCurrentIndex(self.dailies_camera.currentIndex())
            dialog.proxy.setChecked(self.dailies_proxy.isChecked())
        elif dest_type == "review":
            dialog.quality.setCurrentIndex(self.review_quality.currentIndex())
            dialog.proxy.setChecked(self.review_proxy.isChecked())
        elif dest_type == "assets":
            dialog.tags.setText(self.assets_tags.text())
            dialog.proxy.setChecked(self.assets_proxy.isChecked())

        if dialog.exec() == QDialog.DialogCode.Accepted:
            # Copy values back
            if dest_type == "dailies":
                self.dailies_day.setValue(dialog.day.value())
                self.dailies_camera.setCurrentIndex(dialog.camera.currentIndex())
                self.dailies_proxy.setChecked(dialog.proxy.isChecked())
            elif dest_type == "review":
                self.review_quality.setCurrentIndex(dialog.quality.currentIndex())
                self.review_proxy.setChecked(dialog.proxy.isChecked())
            elif dest_type == "assets":
                self.assets_tags.setText(dialog.tags.text())
                self.assets_proxy.setChecked(dialog.proxy.isChecked())

    def _create_group_style(self) -> str:
        return f"""
            QGroupBox {{
                font-size: 11px;
                font-weight: bold;
                color: {COLORS['muted-gray']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 16px;
                padding-top: 24px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 4px;
            }}
        """

    def _create_dailies_panel(self) -> QGroupBox:
        group = QGroupBox("DAILIES")
        group.setStyleSheet(self._create_group_style())

        layout = QVBoxLayout(group)
        layout.setSpacing(8)

        # Project
        layout.addWidget(QLabel("Project:"))
        self.dailies_project = QComboBox()
        self.dailies_project.addItem("Select project...")
        layout.addWidget(self.dailies_project)

        # Day
        day_row = QHBoxLayout()
        day_row.addWidget(QLabel("Day:"))
        self.dailies_day = QSpinBox()
        self.dailies_day.setRange(1, 999)
        self.dailies_day.setValue(1)
        day_row.addWidget(self.dailies_day)
        day_row.addStretch()
        layout.addLayout(day_row)

        # Camera
        cam_row = QHBoxLayout()
        cam_row.addWidget(QLabel("Camera:"))
        self.dailies_camera = QComboBox()
        self.dailies_camera.addItems(["A", "B", "C", "D", "E"])
        cam_row.addWidget(self.dailies_camera)
        cam_row.addStretch()
        layout.addLayout(cam_row)

        # Proxy generation
        self.dailies_proxy = QCheckBox("Generate proxies")
        self.dailies_proxy.setChecked(True)
        layout.addWidget(self.dailies_proxy)

        layout.addStretch()

        return group

    def _create_review_panel(self) -> QGroupBox:
        group = QGroupBox("REVIEW")
        group.setStyleSheet(self._create_group_style())

        layout = QVBoxLayout(group)
        layout.setSpacing(8)

        # Folder
        layout.addWidget(QLabel("Folder:"))
        self.review_folder = QComboBox()
        self.review_folder.addItem("Select folder...")
        layout.addWidget(self.review_folder)

        # Quality (transcode)
        layout.addWidget(QLabel("Transcode Quality:"))
        self.review_quality = QComboBox()
        self.review_quality.addItems(["High (H.264)", "Medium (H.264)", "Low (H.264)", "Original (no transcode)"])
        layout.addWidget(self.review_quality)

        # Proxy generation
        self.review_proxy = QCheckBox("Generate proxies")
        self.review_proxy.setChecked(False)
        layout.addWidget(self.review_proxy)

        layout.addStretch()

        return group

    def _create_assets_panel(self) -> QGroupBox:
        group = QGroupBox("ASSETS")
        group.setStyleSheet(self._create_group_style())

        layout = QVBoxLayout(group)
        layout.setSpacing(8)

        # Folder
        layout.addWidget(QLabel("Folder:"))
        self.assets_folder = QComboBox()
        self.assets_folder.addItem("Select folder...")
        layout.addWidget(self.assets_folder)

        # Tags
        layout.addWidget(QLabel("Tags:"))
        self.assets_tags = QLineEdit()
        self.assets_tags.setPlaceholderText("tag1, tag2, ...")
        layout.addWidget(self.assets_tags)

        # Proxy generation (for video assets)
        self.assets_proxy = QCheckBox("Generate proxies (video)")
        self.assets_proxy.setChecked(False)
        layout.addWidget(self.assets_proxy)

        layout.addStretch()

        return group

    def get_dailies_config(self) -> Dict[str, Any]:
        return {
            "camera_label": self.dailies_camera.currentText(),
            "day": self.dailies_day.value(),
            "generate_proxy": self.dailies_proxy.isChecked(),
        }

    def get_review_config(self) -> Dict[str, Any]:
        quality_map = {0: "high", 1: "medium", 2: "low", 3: "original"}
        return {
            "quality": quality_map.get(self.review_quality.currentIndex(), "high"),
            "generate_proxy": self.review_proxy.isChecked(),
        }

    def get_assets_config(self) -> Dict[str, Any]:
        tags = [t.strip() for t in self.assets_tags.text().split(",") if t.strip()]
        return {
            "tags": tags,
            "generate_proxy": self.assets_proxy.isChecked(),
        }


class UploadOptionsPanel(QWidget):
    """Panel for upload options."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()

    def _setup_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(16)

        # Parallel uploads
        layout.addWidget(QLabel("Parallel:"))
        self.parallel_spin = QSpinBox()
        self.parallel_spin.setRange(1, 5)
        self.parallel_spin.setValue(3)
        self.parallel_spin.setFixedWidth(60)
        layout.addWidget(self.parallel_spin)

        layout.addSpacing(16)

        # Checksum verification
        self.verify_check = QCheckBox("Verify checksums")
        self.verify_check.setChecked(True)
        layout.addWidget(self.verify_check)

        # Resume failed
        self.resume_check = QCheckBox("Resume failed")
        self.resume_check.setChecked(True)
        layout.addWidget(self.resume_check)

        layout.addStretch()

        # Auto-upload mode
        layout.addWidget(QLabel("After offload:"))
        self.auto_upload_combo = QComboBox()
        self.auto_upload_combo.addItems([
            "Add to queue only",
            "Start upload immediately",
            "Ask me each time"
        ])
        self.auto_upload_combo.setFixedWidth(180)
        layout.addWidget(self.auto_upload_combo)

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
        self.session: Optional[UploadSession] = None
        self.is_uploading = False

        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Header
        header = QHBoxLayout()

        title = QLabel("Upload")
        title.setStyleSheet(f"""
            font-size: 24px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        header.addWidget(title)

        header.addStretch()

        help_btn = QPushButton("? Help")
        help_btn.setMinimumHeight(36)
        help_btn.clicked.connect(self._show_help)
        header.addWidget(help_btn)

        layout.addLayout(header)

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

        # Destination settings
        dest_label = QLabel("DESTINATION SETTINGS")
        dest_label.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        layout.addWidget(dest_label)

        self.dest_settings = DestinationSettingsPanel()
        layout.addWidget(self.dest_settings)

        # Upload options
        options_label = QLabel("UPLOAD OPTIONS")
        options_label.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        layout.addWidget(options_label)

        self.options_panel = UploadOptionsPanel()
        layout.addWidget(self.options_panel)

        # Progress section
        self.progress_frame = QFrame()
        self.progress_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 12px;
            }}
        """)
        progress_layout = QVBoxLayout(self.progress_frame)

        progress_header = QHBoxLayout()
        self.progress_label = QLabel("Ready to upload")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 13px;")
        progress_header.addWidget(self.progress_label)
        progress_header.addStretch()
        self.speed_label = QLabel("")
        self.speed_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        progress_header.addWidget(self.speed_label)
        progress_layout.addLayout(progress_header)

        self.progress_bar = QProgressBar()
        self.progress_bar.setMinimum(0)
        self.progress_bar.setMaximum(100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
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

        # Create session
        self.session = UploadSession.create()
        self.session.jobs = jobs
        self.session.verify_checksums = self.options_panel.verify_check.isChecked()
        self.session.parallel_uploads = self.options_panel.parallel_spin.value()

        # Update UI
        self.is_uploading = True
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_label.setText(f"Uploading 0/{len(jobs)} files...")
        self.progress_bar.setValue(0)

        # TODO: Start actual upload worker with ffmpeg transcoding
        # For now, just show message
        QMessageBox.information(
            self,
            "Upload Started",
            f"Would upload {len(jobs)} files using rclone.\n\n"
            f"Proxy generation and transcoding will use local ffmpeg.\n\n"
            f"This feature is being implemented."
        )

        # Reset UI for now
        self.is_uploading = False
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

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
                self.is_uploading = False
                self.start_btn.setEnabled(True)
                self.cancel_btn.setEnabled(False)
                self.progress_label.setText("Upload cancelled")

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
