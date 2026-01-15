"""
Cloud Storage page for managing remote storage backends.

Provides configuration and access to Google Drive, Dropbox, OneDrive, S3, and SFTP remotes.
"""
from pathlib import Path
from typing import Dict, List, Optional, Any

from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QScrollArea, QFileDialog, QLineEdit,
    QTreeWidget, QTreeWidgetItem, QHeaderView, QMessageBox,
    QStackedWidget, QSplitter, QMenu
)

from src.ui.styles import COLORS


# Remote type icons (emoji fallback)
REMOTE_ICONS = {
    "drive": "G",  # Google Drive
    "dropbox": "D",  # Dropbox
    "onedrive": "O",  # OneDrive
    "s3": "S",  # S3
    "sftp": "F",  # SFTP
    "local": "L",  # Local
}

REMOTE_LABELS = {
    "drive": "Google Drive",
    "dropbox": "Dropbox",
    "onedrive": "OneDrive",
    "s3": "Amazon S3",
    "sftp": "SFTP",
    "local": "Local",
}


class RemoteTestWorker(QThread):
    """Background worker to test remote connection."""
    completed = pyqtSignal(str, bool, str)  # remote_name, success, error

    def __init__(self, remote_name: str):
        super().__init__()
        self.remote_name = remote_name

    def run(self):
        try:
            from src.services.rclone_service import RcloneService
            service = RcloneService()
            success, error = service.test_remote(self.remote_name)
            self.completed.emit(self.remote_name, success, error)
        except Exception as e:
            self.completed.emit(self.remote_name, False, str(e))


class DirectoryListWorker(QThread):
    """Background worker to list remote directory."""
    completed = pyqtSignal(str, list)  # path, items
    error = pyqtSignal(str, str)  # path, error

    def __init__(self, remote_path: str):
        super().__init__()
        self.remote_path = remote_path

    def run(self):
        try:
            from src.services.rclone_service import RcloneService
            service = RcloneService()
            items = service.list_directory(self.remote_path)
            self.completed.emit(self.remote_path, items)
        except Exception as e:
            self.error.emit(self.remote_path, str(e))


class DownloadWorker(QThread):
    """Background worker to download a file with progress."""
    progress = pyqtSignal(str, int, int, float)  # filename, bytes_transferred, total_bytes, percent
    completed = pyqtSignal(str, bool, str)  # filename, success, error

    def __init__(self, remote_path: str, local_path: str):
        super().__init__()
        self.remote_path = remote_path
        self.local_path = local_path

    def run(self):
        import asyncio
        from pathlib import Path
        from src.services.rclone_service import RcloneService

        try:
            service = RcloneService()
            local_path = Path(self.local_path)
            filename = local_path.name

            def on_progress(p):
                self.progress.emit(
                    filename,
                    p.bytes_transferred,
                    p.total_bytes,
                    p.percent
                )

            # Run async download in event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    service.download_file(
                        self.remote_path,
                        local_path,
                        progress_callback=on_progress
                    )
                )
                if result.success:
                    self.completed.emit(filename, True, "")
                else:
                    self.completed.emit(filename, False, result.error_message or "Download failed")
            finally:
                loop.close()

        except Exception as e:
            self.completed.emit(Path(self.local_path).name, False, str(e))


class UploadWorker(QThread):
    """Background worker to upload a file with progress."""
    progress = pyqtSignal(str, int, int, float)  # filename, bytes_transferred, total_bytes, percent
    completed = pyqtSignal(str, bool, str)  # filename, success, error

    def __init__(self, local_path: str, remote_path: str):
        super().__init__()
        self.local_path = local_path
        self.remote_path = remote_path

    def run(self):
        import asyncio
        from pathlib import Path
        from src.services.rclone_service import RcloneService

        try:
            service = RcloneService()
            local_path = Path(self.local_path)
            filename = local_path.name

            def on_progress(p):
                self.progress.emit(
                    filename,
                    p.bytes_transferred,
                    p.total_bytes,
                    p.percent
                )

            # Run async upload in event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                result = loop.run_until_complete(
                    service.upload_file(
                        local_path,
                        self.remote_path,
                        checksum_verify=True,
                        progress_callback=on_progress
                    )
                )
                if result.success:
                    self.completed.emit(filename, True, "")
                else:
                    self.completed.emit(filename, False, result.error_message or "Upload failed")
            finally:
                loop.close()

        except Exception as e:
            self.completed.emit(Path(self.local_path).name, False, str(e))


class DeleteWorker(QThread):
    """Background worker to delete a remote file."""
    completed = pyqtSignal(str, bool, str)  # filename, success, error

    def __init__(self, remote_path: str, filename: str):
        super().__init__()
        self.remote_path = remote_path
        self.filename = filename

    def run(self):
        try:
            from src.services.rclone_service import RcloneService
            service = RcloneService()
            success = service.delete_remote(self.remote_path)
            if success:
                self.completed.emit(self.filename, True, "")
            else:
                self.completed.emit(self.filename, False, "Delete failed")
        except Exception as e:
            self.completed.emit(self.filename, False, str(e))


class CloudStoragePage(QWidget):
    """Page for managing cloud storage remotes."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.remotes: List[Dict[str, Any]] = []
        self.remote_status: Dict[str, str] = {}  # name -> status
        self.test_workers: Dict[str, RemoteTestWorker] = {}
        self.list_worker: Optional[DirectoryListWorker] = None
        self.download_worker: Optional[DownloadWorker] = None
        self.upload_worker: Optional[UploadWorker] = None
        self.delete_worker: Optional[DeleteWorker] = None
        self.current_remote: Optional[str] = None
        self.current_path: str = ""

        self._setup_ui()
        self._load_remotes()

    def _setup_ui(self):
        """Set up the page UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Page title
        title = QLabel("Cloud Storage")
        title.setStyleSheet(f"font-size: 24px; font-weight: bold; color: {COLORS['bone-white']};")
        layout.addWidget(title)

        subtitle = QLabel("Configure and manage cloud storage remotes")
        subtitle.setStyleSheet(f"color: {COLORS['muted-gray']}; margin-bottom: 8px;")
        layout.addWidget(subtitle)

        # Main content splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left panel - Remote list
        left_panel = self._create_remote_list_panel()
        splitter.addWidget(left_panel)

        # Right panel - Browser
        right_panel = self._create_browser_panel()
        splitter.addWidget(right_panel)

        splitter.setSizes([300, 600])
        layout.addWidget(splitter, 1)

        self._apply_styles()

    def _create_remote_list_panel(self) -> QFrame:
        """Create the remote list panel."""
        frame = QFrame()
        frame.setObjectName("panel")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header
        header = QFrame()
        header.setObjectName("panel-header")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(12, 10, 12, 10)

        title = QLabel("Remotes")
        title.setStyleSheet(f"font-weight: bold; color: {COLORS['accent-yellow']};")
        header_layout.addWidget(title)

        header_layout.addStretch()

        add_btn = QPushButton("+")
        add_btn.setFixedSize(28, 28)
        add_btn.setToolTip("Add Remote")
        add_btn.clicked.connect(self._on_add_remote)
        header_layout.addWidget(add_btn)

        refresh_btn = QPushButton("R")
        refresh_btn.setFixedSize(28, 28)
        refresh_btn.setToolTip("Refresh")
        refresh_btn.clicked.connect(self._load_remotes)
        header_layout.addWidget(refresh_btn)

        layout.addWidget(header)

        # Remote list
        self.remote_list = QTreeWidget()
        self.remote_list.setHeaderHidden(True)
        self.remote_list.setRootIsDecorated(False)
        self.remote_list.setIndentation(0)
        self.remote_list.itemClicked.connect(self._on_remote_clicked)
        self.remote_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.remote_list.customContextMenuRequested.connect(self._on_remote_context_menu)
        layout.addWidget(self.remote_list, 1)

        return frame

    def _create_browser_panel(self) -> QFrame:
        """Create the file browser panel."""
        frame = QFrame()
        frame.setObjectName("panel")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header with path
        header = QFrame()
        header.setObjectName("panel-header")
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(12, 10, 12, 10)

        self.path_label = QLabel("Select a remote to browse")
        self.path_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        header_layout.addWidget(self.path_label, 1)

        self.up_btn = QPushButton("Up")
        self.up_btn.setFixedWidth(60)
        self.up_btn.clicked.connect(self._on_go_up)
        self.up_btn.setEnabled(False)
        header_layout.addWidget(self.up_btn)

        layout.addWidget(header)

        # Status bar
        self.browser_status = QLabel("")
        self.browser_status.setStyleSheet(f"""
            padding: 8px 12px;
            background-color: {COLORS['charcoal-dark']};
            color: {COLORS['muted-gray']};
            border-bottom: 1px solid {COLORS['border-gray']};
        """)
        layout.addWidget(self.browser_status)

        # File tree
        self.file_tree = QTreeWidget()
        self.file_tree.setHeaderLabels(["Name", "Size", "Modified"])
        self.file_tree.setRootIsDecorated(False)
        self.file_tree.setAlternatingRowColors(True)
        self.file_tree.header().setStretchLastSection(True)
        self.file_tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.file_tree.header().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.file_tree.header().setSectionResizeMode(2, QHeaderView.ResizeMode.ResizeToContents)
        self.file_tree.itemDoubleClicked.connect(self._on_item_double_clicked)
        self.file_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.file_tree.customContextMenuRequested.connect(self._on_file_context_menu)
        layout.addWidget(self.file_tree, 1)

        # Action buttons
        actions = QFrame()
        actions.setObjectName("actions-bar")
        actions_layout = QHBoxLayout(actions)
        actions_layout.setContentsMargins(12, 10, 12, 10)

        download_btn = QPushButton("Download")
        download_btn.clicked.connect(self._on_download)
        actions_layout.addWidget(download_btn)

        upload_btn = QPushButton("Upload")
        upload_btn.clicked.connect(self._on_upload)
        actions_layout.addWidget(upload_btn)

        actions_layout.addStretch()

        layout.addWidget(actions)

        return frame

    def _apply_styles(self):
        """Apply styles to the page."""
        self.setStyleSheet(f"""
            QWidget {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['bone-white']};
            }}
            #panel {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
            #panel-header {{
                background-color: {COLORS['charcoal-dark']};
                border-bottom: 1px solid {COLORS['border-gray']};
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
            }}
            #actions-bar {{
                background-color: {COLORS['charcoal-dark']};
                border-top: 1px solid {COLORS['border-gray']};
            }}
            QPushButton {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                padding: 6px 12px;
                border-radius: 4px;
            }}
            QPushButton:hover {{
                background-color: {COLORS['border-gray']};
            }}
            QTreeWidget {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: none;
                alternate-background-color: {COLORS['charcoal-dark']};
            }}
            QTreeWidget::item {{
                padding: 6px 8px;
            }}
            QTreeWidget::item:selected {{
                background-color: {COLORS['border-gray']};
            }}
            QTreeWidget::item:hover {{
                background-color: {COLORS['charcoal-dark']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['muted-gray']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
            }}
            QSplitter::handle {{
                background-color: {COLORS['border-gray']};
                width: 2px;
            }}
        """)

    def _load_remotes(self):
        """Load configured remotes."""
        try:
            from src.services.rclone_service import RcloneService
            service = RcloneService()
            self.remotes = service.list_configured_remotes()
            self._update_remote_list()
            self._test_all_remotes()
        except Exception as e:
            self.browser_status.setText(f"Error: {e}")

    def _update_remote_list(self):
        """Update the remote list display."""
        self.remote_list.clear()

        for remote in self.remotes:
            name = remote["name"]
            remote_type = remote["type"]
            label = REMOTE_LABELS.get(remote_type, remote_type)
            icon = REMOTE_ICONS.get(remote_type, "?")

            item = QTreeWidgetItem()
            status = self.remote_status.get(name, "unknown")

            # Status indicator
            if status == "connected":
                status_color = COLORS['green']
                status_text = "Connected"
            elif status == "testing":
                status_color = COLORS['accent-yellow']
                status_text = "Testing..."
            elif status == "error":
                status_color = COLORS['red']
                status_text = "Error"
            else:
                status_color = COLORS['muted-gray']
                status_text = "Unknown"

            item.setText(0, f"[{icon}] {name}")
            item.setToolTip(0, f"{label}\nStatus: {status_text}")
            item.setData(0, Qt.ItemDataRole.UserRole, name)

            # Color code based on status
            item.setForeground(0, status_color if status != "connected" else Qt.GlobalColor.white)

            self.remote_list.addTopLevelItem(item)

    def _test_all_remotes(self):
        """Test connection to all remotes."""
        for remote in self.remotes:
            name = remote["name"]
            self.remote_status[name] = "testing"
            self._test_remote(name)
        self._update_remote_list()

    def _test_remote(self, name: str):
        """Test a single remote connection."""
        worker = RemoteTestWorker(name)
        worker.completed.connect(self._on_test_completed)
        self.test_workers[name] = worker
        worker.start()

    def _on_test_completed(self, name: str, success: bool, error: str):
        """Handle test completion."""
        if name in self.test_workers:
            del self.test_workers[name]

        self.remote_status[name] = "connected" if success else "error"
        self._update_remote_list()

    def _on_remote_clicked(self, item: QTreeWidgetItem, column: int):
        """Handle remote selection."""
        name = item.data(0, Qt.ItemDataRole.UserRole)
        if name:
            self.current_remote = name
            self.current_path = ""
            self._browse_path(f"{name}:")

    def _on_remote_context_menu(self, pos):
        """Show context menu for remote."""
        item = self.remote_list.itemAt(pos)
        if not item:
            return

        name = item.data(0, Qt.ItemDataRole.UserRole)
        if not name:
            return

        menu = QMenu(self)
        menu.addAction("Browse", lambda: self._browse_path(f"{name}:"))
        menu.addAction("Test Connection", lambda: self._test_remote(name))
        menu.addSeparator()
        menu.addAction("Edit", lambda: self._on_edit_remote(name))
        menu.addAction("Delete", lambda: self._on_delete_remote(name))

        menu.exec(self.remote_list.mapToGlobal(pos))

    def _browse_path(self, path: str):
        """Browse a remote path."""
        self.file_tree.clear()
        self.browser_status.setText(f"Loading {path}...")
        self.path_label.setText(path)
        self.up_btn.setEnabled(":" in path and path != f"{self.current_remote}:")

        self.list_worker = DirectoryListWorker(path)
        self.list_worker.completed.connect(self._on_list_completed)
        self.list_worker.error.connect(self._on_list_error)
        self.list_worker.start()

    def _on_list_completed(self, path: str, items: list):
        """Handle directory listing completion."""
        self.list_worker = None
        self.current_path = path
        self.file_tree.clear()

        # Sort: directories first, then by name
        items.sort(key=lambda x: (not x.get("IsDir", False), x.get("Name", "").lower()))

        for item_data in items:
            name = item_data.get("Name", "")
            is_dir = item_data.get("IsDir", False)
            size = item_data.get("Size", 0)
            mod_time = item_data.get("ModTime", "")

            item = QTreeWidgetItem()
            item.setText(0, f"{'[DIR] ' if is_dir else ''}{name}")
            item.setText(1, self._format_size(size) if not is_dir else "")
            item.setText(2, mod_time[:19] if mod_time else "")  # Trim timezone
            item.setData(0, Qt.ItemDataRole.UserRole, item_data)

            self.file_tree.addTopLevelItem(item)

        self.browser_status.setText(f"{len(items)} items")

    def _on_list_error(self, path: str, error: str):
        """Handle directory listing error."""
        self.list_worker = None
        self.browser_status.setText(f"Error: {error}")

    def _on_item_double_clicked(self, item: QTreeWidgetItem, column: int):
        """Handle double-click on file/folder."""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        if data.get("IsDir"):
            # Navigate into directory
            name = data.get("Name", "")
            if self.current_path.endswith(":"):
                new_path = f"{self.current_path}{name}"
            else:
                new_path = f"{self.current_path}/{name}"
            self._browse_path(new_path)

    def _on_go_up(self):
        """Go up one directory level."""
        if not self.current_path:
            return

        if "/" in self.current_path:
            parent = self.current_path.rsplit("/", 1)[0]
        elif ":" in self.current_path:
            parent = self.current_path.split(":")[0] + ":"
        else:
            return

        self._browse_path(parent)

    def _on_file_context_menu(self, pos):
        """Show context menu for file."""
        item = self.file_tree.itemAt(pos)
        if not item:
            return

        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        menu = QMenu(self)

        if data.get("IsDir"):
            menu.addAction("Open", lambda: self._on_item_double_clicked(item, 0))
        else:
            menu.addAction("Download", self._on_download)

        menu.addSeparator()
        menu.addAction("Delete", lambda: self._on_delete_file(data))

        menu.exec(self.file_tree.mapToGlobal(pos))

    def _on_download(self):
        """Download selected file."""
        item = self.file_tree.currentItem()
        if not item:
            QMessageBox.warning(self, "Download", "Please select a file to download")
            return

        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data or data.get("IsDir"):
            QMessageBox.warning(self, "Download", "Please select a file (not a folder)")
            return

        # Check if already downloading
        if self.download_worker and self.download_worker.isRunning():
            QMessageBox.warning(self, "Download", "A download is already in progress")
            return

        # Ask for save location
        name = data.get("Name", "file")
        save_path, _ = QFileDialog.getSaveFileName(
            self,
            "Save File",
            name,
            "All Files (*)"
        )

        if not save_path:
            return

        # Build remote path
        if self.current_path.endswith(":"):
            remote_path = f"{self.current_path}{name}"
        else:
            remote_path = f"{self.current_path}/{name}"

        self.browser_status.setText(f"Downloading {name}...")

        # Start download worker
        self.download_worker = DownloadWorker(remote_path, save_path)
        self.download_worker.progress.connect(self._on_download_progress)
        self.download_worker.completed.connect(self._on_download_completed)
        self.download_worker.start()

    def _on_download_progress(self, filename: str, transferred: int, total: int, percent: float):
        """Handle download progress updates."""
        if total > 0:
            self.browser_status.setText(
                f"Downloading {filename}: {self._format_size(transferred)} / {self._format_size(total)} ({percent:.0f}%)"
            )
        else:
            self.browser_status.setText(f"Downloading {filename}: {self._format_size(transferred)}")

    def _on_download_completed(self, filename: str, success: bool, error: str):
        """Handle download completion."""
        self.download_worker = None
        if success:
            self.browser_status.setText(f"Downloaded: {filename}")
            QMessageBox.information(self, "Download Complete", f"Successfully downloaded:\n{filename}")
        else:
            self.browser_status.setText(f"Download failed: {error}")
            QMessageBox.warning(self, "Download Failed", f"Failed to download {filename}:\n{error}")

    def _on_upload(self):
        """Upload file to current path."""
        if not self.current_remote:
            QMessageBox.warning(self, "Upload", "Please select a remote first")
            return

        # Check if already uploading
        if self.upload_worker and self.upload_worker.isRunning():
            QMessageBox.warning(self, "Upload", "An upload is already in progress")
            return

        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select File to Upload",
            "",
            "All Files (*)"
        )

        if not file_path:
            return

        name = Path(file_path).name
        if self.current_path.endswith(":"):
            remote_path = f"{self.current_path}{name}"
        else:
            remote_path = f"{self.current_path}/{name}"

        self.browser_status.setText(f"Uploading {name}...")

        # Start upload worker
        self.upload_worker = UploadWorker(file_path, remote_path)
        self.upload_worker.progress.connect(self._on_upload_progress)
        self.upload_worker.completed.connect(self._on_upload_completed)
        self.upload_worker.start()

    def _on_upload_progress(self, filename: str, transferred: int, total: int, percent: float):
        """Handle upload progress updates."""
        if total > 0:
            self.browser_status.setText(
                f"Uploading {filename}: {self._format_size(transferred)} / {self._format_size(total)} ({percent:.0f}%)"
            )
        else:
            self.browser_status.setText(f"Uploading {filename}: {self._format_size(transferred)}")

    def _on_upload_completed(self, filename: str, success: bool, error: str):
        """Handle upload completion."""
        self.upload_worker = None
        if success:
            self.browser_status.setText(f"Uploaded: {filename}")
            QMessageBox.information(self, "Upload Complete", f"Successfully uploaded:\n{filename}")
            # Refresh the current directory
            self._browse_path(self.current_path)
        else:
            self.browser_status.setText(f"Upload failed: {error}")
            QMessageBox.warning(self, "Upload Failed", f"Failed to upload {filename}:\n{error}")

    def _on_delete_file(self, data: dict):
        """Delete a remote file."""
        name = data.get("Name", "")
        is_dir = data.get("IsDir", False)

        # Check if already deleting
        if self.delete_worker and self.delete_worker.isRunning():
            QMessageBox.warning(self, "Delete", "A delete operation is already in progress")
            return

        item_type = "folder" if is_dir else "file"
        reply = QMessageBox.question(
            self,
            "Delete",
            f"Delete {item_type} '{name}'?\n\nThis cannot be undone.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        # Build remote path
        if self.current_path.endswith(":"):
            remote_path = f"{self.current_path}{name}"
        else:
            remote_path = f"{self.current_path}/{name}"

        self.browser_status.setText(f"Deleting {name}...")

        # Start delete worker
        self.delete_worker = DeleteWorker(remote_path, name)
        self.delete_worker.completed.connect(self._on_delete_completed)
        self.delete_worker.start()

    def _on_delete_completed(self, filename: str, success: bool, error: str):
        """Handle delete completion."""
        self.delete_worker = None
        if success:
            self.browser_status.setText(f"Deleted: {filename}")
            # Refresh the current directory
            self._browse_path(self.current_path)
        else:
            self.browser_status.setText(f"Delete failed: {error}")
            QMessageBox.warning(self, "Delete Failed", f"Failed to delete {filename}:\n{error}")

    def _on_add_remote(self):
        """Show dialog to add a new remote."""
        from src.ui.dialogs.remote_config_dialog import RemoteConfigDialog
        dialog = RemoteConfigDialog(parent=self)
        if dialog.exec():
            self._load_remotes()

    def _on_edit_remote(self, name: str):
        """Edit an existing remote."""
        from src.ui.dialogs.remote_config_dialog import RemoteConfigDialog
        remote_info = None
        for r in self.remotes:
            if r["name"] == name:
                remote_info = r
                break

        if remote_info:
            dialog = RemoteConfigDialog(remote_info=remote_info, parent=self)
            if dialog.exec():
                self._load_remotes()

    def _on_delete_remote(self, name: str):
        """Delete a remote configuration."""
        reply = QMessageBox.question(
            self,
            "Delete Remote",
            f"Delete remote '{name}'?\n\nThis will not delete any files on the remote storage.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        try:
            from src.services.rclone_service import RcloneService
            service = RcloneService()
            if service.delete_remote_config(name):
                self._load_remotes()
            else:
                QMessageBox.warning(self, "Error", "Failed to delete remote")
        except Exception as e:
            QMessageBox.warning(self, "Error", str(e))

    def _format_size(self, size: int) -> str:
        """Format file size."""
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size / (1024 * 1024):.1f} MB"
        else:
            return f"{size / (1024 * 1024 * 1024):.2f} GB"
