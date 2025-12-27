"""
Assets page - Upload standalone assets to the project.
Supports audio, 3D models, images, documents, graphics, etc.
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
    QTextEdit,
    QFileDialog,
    QMessageBox,
    QScrollArea,
    QSplitter,
    QGridLayout,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from pathlib import Path
from typing import List, Optional

from src.services.config import ConfigManager
from src.services.asset_uploader import (
    AssetUploaderService,
    AssetUploadJob,
    AssetUploadStatus,
    ASSET_TYPE_MAP,
)
from src.ui.styles import COLORS


# Icons for asset types
ASSET_TYPE_ICONS = {
    'audio': '🎵',
    '3d_model': '🎲',
    'image': '🖼️',
    'graphics': '✏️',
    'document': '📄',
    'music': '🎶',
    'sfx': '🔊',
    'other': '📦',
}


class AssetUploadWorker(QThread):
    """Background worker for asset uploads."""
    progress = pyqtSignal(int, float, str)  # job_index, percent, status
    finished = pyqtSignal(bool, list)  # success, jobs

    def __init__(
        self,
        uploader: AssetUploaderService,
        jobs: List[AssetUploadJob],
        project_id: str,
        folder_id: Optional[str],
        description: str,
        tags: Optional[List[str]],
    ):
        super().__init__()
        self.uploader = uploader
        self.jobs = jobs
        self.project_id = project_id
        self.folder_id = folder_id
        self.description = description
        self.tags = tags

    def run(self):
        def progress_callback(job_index, percent, status):
            self.progress.emit(job_index, percent, status)

        self.uploader.set_progress_callback(progress_callback)

        success = self.uploader.upload_assets(
            jobs=self.jobs,
            project_id=self.project_id,
            folder_id=self.folder_id,
            description=self.description,
            tags=self.tags,
        )

        self.finished.emit(success, self.jobs)


class AssetsPage(QWidget):
    """Page for uploading standalone assets."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.uploader = AssetUploaderService(config)
        self.selected_files: List[Path] = []
        self.current_jobs: List[AssetUploadJob] = []
        self.upload_worker: Optional[AssetUploadWorker] = None
        self.asset_folders: List[dict] = []
        self.selected_folder_id: Optional[str] = None
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        title = QLabel("Upload Assets")
        title.setObjectName("page-title")
        layout.addWidget(title)

        subtitle = QLabel("Upload audio, 3D models, images, documents, and other assets")
        subtitle.setObjectName("page-subtitle")
        layout.addWidget(subtitle)

        # Supported types hint
        types_hint = self.create_types_hint()
        layout.addWidget(types_hint)

        # Main content with splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(8)

        # Left: File selection
        left = self.create_file_panel()
        left.setMinimumWidth(300)
        splitter.addWidget(left)

        # Right: Asset settings (in scroll area)
        right_scroll = QScrollArea()
        right_scroll.setWidgetResizable(True)
        right_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        right_scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        right_panel = self.create_settings_panel()
        right_panel.setMinimumWidth(200)
        right_scroll.setWidget(right_panel)
        splitter.addWidget(right_scroll)

        # Set initial sizes (60/40 split)
        splitter.setSizes([350, 200])

        layout.addWidget(splitter, 1)

        # Bottom: Progress
        progress_panel = self.create_progress_panel()
        layout.addWidget(progress_panel)

    def create_types_hint(self) -> QFrame:
        """Create a panel showing supported file types."""
        panel = QFrame()
        panel.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['charcoal-light']};
                border-radius: 6px;
                padding: 8px;
            }}
        """)

        layout = QHBoxLayout(panel)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(15)

        for asset_type, icon in [
            ('audio', 'Audio'),
            ('3d_model', '3D Models'),
            ('image', 'Images'),
            ('graphics', 'Graphics'),
            ('document', 'Documents'),
        ]:
            type_label = QLabel(f"{ASSET_TYPE_ICONS.get(asset_type, '📦')} {icon}")
            type_label.setObjectName("label-small")
            layout.addWidget(type_label)

        layout.addStretch()

        return panel

    def create_file_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Select Assets")
        label.setObjectName("card-title")
        layout.addWidget(label)

        hint = QLabel("Drag & drop or browse to select files")
        hint.setObjectName("label-small")
        layout.addWidget(hint)

        # Browse buttons row
        btn_row = QHBoxLayout()

        browse_btn = QPushButton("Browse Files...")
        browse_btn.clicked.connect(self.browse_files)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_row.addWidget(browse_btn)

        browse_folder_btn = QPushButton("Browse Folder...")
        browse_folder_btn.clicked.connect(self.browse_folder)
        browse_folder_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_row.addWidget(browse_folder_btn)

        btn_row.addStretch()

        layout.addLayout(btn_row)

        # File list
        self.file_list = QListWidget()
        layout.addWidget(self.file_list, 1)

        # Summary with breakdown by type
        self.file_summary = QLabel("No files selected")
        self.file_summary.setObjectName("label-muted")
        self.file_summary.setWordWrap(True)
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
        layout.setSpacing(12)

        label = QLabel("Upload Settings")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Folder selector
        folder_label = QLabel("Asset Folder")
        folder_label.setObjectName("label-muted")
        layout.addWidget(folder_label)

        folder_row = QHBoxLayout()
        self.folder_combo = QComboBox()
        self.folder_combo.setMinimumWidth(140)
        self.folder_combo.currentIndexChanged.connect(self.on_folder_changed)
        folder_row.addWidget(self.folder_combo, 1)

        self.refresh_folders_btn = QPushButton("↻")
        self.refresh_folders_btn.setFixedWidth(30)
        self.refresh_folders_btn.setToolTip("Refresh folders from server")
        self.refresh_folders_btn.clicked.connect(self.refresh_folders)
        self.refresh_folders_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        folder_row.addWidget(self.refresh_folders_btn)

        layout.addLayout(folder_row)

        # Separator
        sep1 = QFrame()
        sep1.setFixedHeight(1)
        sep1.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep1)

        # Tags
        tags_label = QLabel("Tags (comma separated)")
        tags_label.setObjectName("label-muted")
        layout.addWidget(tags_label)

        self.tags_input = QLineEdit()
        self.tags_input.setPlaceholderText("e.g., sfx, foley, explosion")
        layout.addWidget(self.tags_input)

        # Description
        desc_label = QLabel("Description (optional)")
        desc_label.setObjectName("label-muted")
        layout.addWidget(desc_label)

        self.description_input = QTextEdit()
        self.description_input.setPlaceholderText("Add notes about these assets...")
        self.description_input.setMaximumHeight(80)
        layout.addWidget(self.description_input)

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

        self.upload_btn = QPushButton("Upload Assets")
        self.upload_btn.setObjectName("primary-button")
        self.upload_btn.clicked.connect(self.start_upload)
        self.upload_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.upload_btn)

        layout.addLayout(btn_layout)

        return panel

    def browse_files(self):
        """Open file browser to select assets."""
        # Build filter for all supported types
        all_exts = ' '.join(f'*{ext}' for ext in ASSET_TYPE_MAP.keys())

        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Assets",
            str(Path.home()),
            f"All Supported Files ({all_exts});;Audio Files (*.wav *.mp3 *.aac *.flac *.aiff *.ogg *.m4a);;Images (*.png *.jpg *.jpeg *.tiff *.psd *.exr);;3D Models (*.obj *.fbx *.gltf *.glb *.blend *.c4d);;Documents (*.pdf *.doc *.docx *.txt);;All Files (*)",
        )
        if files:
            new_paths = [Path(f) for f in files]
            self.selected_files.extend(new_paths)
            self.update_file_list()

    def browse_folder(self):
        """Browse folder and add all supported files."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder",
            str(Path.home()),
        )
        if folder:
            folder_path = Path(folder)
            # Recursively find all supported files
            new_files = []
            for ext in ASSET_TYPE_MAP.keys():
                new_files.extend(folder_path.rglob(f'*{ext}'))

            if new_files:
                self.selected_files.extend(new_files)
                self.update_file_list()
            else:
                QMessageBox.information(
                    self,
                    "No Files Found",
                    "No supported asset files found in the selected folder."
                )

    def clear_files(self):
        """Clear selected files."""
        self.selected_files = []
        self.file_list.clear()
        self.file_summary.setText("No files selected")

    def update_file_list(self):
        """Update the file list display."""
        self.file_list.clear()
        total_size = 0
        type_counts = {}

        for path in self.selected_files:
            asset_type = self.uploader.detect_asset_type(path)
            icon = ASSET_TYPE_ICONS.get(asset_type, '📦')

            item = QListWidgetItem(f"{icon}  {path.name}")
            item.setData(Qt.ItemDataRole.UserRole, path)
            item.setToolTip(f"Type: {asset_type}\nPath: {path}")
            self.file_list.addItem(item)

            if path.exists():
                total_size += path.stat().st_size

            # Count by type
            type_counts[asset_type] = type_counts.get(asset_type, 0) + 1

        # Build summary
        size_str = self.format_size(total_size)
        summary = f"{len(self.selected_files)} files ({size_str})"

        if type_counts:
            type_parts = []
            for asset_type, count in sorted(type_counts.items()):
                icon = ASSET_TYPE_ICONS.get(asset_type, '📦')
                type_parts.append(f"{icon} {count}")
            summary += "\n" + "  ".join(type_parts)

        self.file_summary.setText(summary)

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def refresh_folders(self):
        """Fetch asset folders from the API."""
        project_id = self.config.get_project_id()
        if not project_id:
            self.folder_combo.clear()
            self.folder_combo.addItem("⚠️ No project connected")
            return

        try:
            self.asset_folders = self.uploader.get_asset_folders(project_id)

            self.folder_combo.clear()
            self.folder_combo.addItem("(Root - No folder)")

            if self.asset_folders:
                for folder in self.asset_folders:
                    name = folder.get("name", "Untitled")
                    folder_type = folder.get("folder_type", "")
                    if folder_type:
                        self.folder_combo.addItem(f"📁 {name} ({folder_type})")
                    else:
                        self.folder_combo.addItem(f"📁 {name}")

        except Exception as e:
            self.folder_combo.clear()
            self.folder_combo.addItem(f"⚠️ Error: {str(e)[:30]}")

    def on_folder_changed(self, index: int):
        """Handle folder selection change."""
        if index <= 0:
            self.selected_folder_id = None
        else:
            folder_index = index - 1
            if 0 <= folder_index < len(self.asset_folders):
                self.selected_folder_id = self.asset_folders[folder_index].get("id")

    def start_upload(self):
        """Start the upload process."""
        if not self.selected_files:
            self.progress_label.setText("⚠️ Please select files to upload")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        project_id = self.config.get_project_id()
        if not project_id:
            self.progress_label.setText("⚠️ Not connected to a project")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        # Parse tags
        tags_text = self.tags_input.text().strip()
        tags = [t.strip() for t in tags_text.split(',') if t.strip()] if tags_text else None

        # Create upload jobs
        self.current_jobs = self.uploader.create_jobs(self.selected_files)

        # Update UI
        self.upload_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)
        self.progress_label.setText("Starting upload...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")

        # Start worker
        self.upload_worker = AssetUploadWorker(
            uploader=self.uploader,
            jobs=self.current_jobs,
            project_id=project_id,
            folder_id=self.selected_folder_id,
            description=self.description_input.toPlainText(),
            tags=tags,
        )
        self.upload_worker.progress.connect(self.on_progress)
        self.upload_worker.finished.connect(self.on_finished)
        self.upload_worker.start()

    def cancel_upload(self):
        """Cancel the current upload."""
        if self.upload_worker:
            self.uploader.cancel()
        self.progress_label.setText("Upload cancelled")
        self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
        self.upload_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

    def on_progress(self, job_index: int, percent: float, status: str):
        """Handle upload progress updates."""
        total_jobs = len(self.current_jobs)
        overall = ((job_index + percent / 100) / total_jobs) * 100
        self.progress_bar.setValue(int(overall))
        self.progress_label.setText(status)
        self.file_progress.setText(f"File {job_index + 1} of {total_jobs}")

    def on_finished(self, success: bool, jobs: List[AssetUploadJob]):
        """Handle upload completion."""
        self.upload_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

        if success:
            self.progress_bar.setValue(100)
            self.progress_label.setText("✓ All assets uploaded successfully!")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']};")

            # Clear selection
            self.clear_files()
            self.tags_input.clear()
            self.description_input.clear()
        else:
            failed = sum(1 for j in jobs if j.status == AssetUploadStatus.FAILED)
            self.progress_label.setText(f"Upload finished with {failed} failure(s)")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")

    def showEvent(self, event):
        """Called when page becomes visible."""
        super().showEvent(event)
        # Don't auto-fetch - let user click refresh to avoid blocking UI
