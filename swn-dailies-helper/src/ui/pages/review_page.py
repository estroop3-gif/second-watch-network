"""
Review page - Upload deliverables to Review tab.
For client/stakeholder review with version tracking.
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
    QCheckBox,
    QFileDialog,
    QMessageBox,
    QScrollArea,
    QSplitter,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from pathlib import Path
from typing import List, Optional

from src.services.config import ConfigManager
from src.services.review_uploader import (
    ReviewUploaderService,
    ReviewUploadJob,
    ReviewUploadStatus,
)
from src.ui.styles import COLORS


class ReviewUploadWorker(QThread):
    """Background worker for review uploads."""
    progress = pyqtSignal(int, float, str)  # job_index, percent, status
    finished = pyqtSignal(bool, list)  # success, jobs

    def __init__(
        self,
        uploader: ReviewUploaderService,
        jobs: List[ReviewUploadJob],
        project_id: str,
        asset_name: str,
        folder_id: Optional[str],
        description: str,
        create_new_asset: bool,
        existing_asset_id: Optional[str],
    ):
        super().__init__()
        self.uploader = uploader
        self.jobs = jobs
        self.project_id = project_id
        self.asset_name = asset_name
        self.folder_id = folder_id
        self.description = description
        self.create_new_asset = create_new_asset
        self.existing_asset_id = existing_asset_id

    def run(self):
        def progress_callback(job_index, percent, status):
            self.progress.emit(job_index, percent, status)

        self.uploader.set_progress_callback(progress_callback)

        success = self.uploader.upload_to_review(
            jobs=self.jobs,
            project_id=self.project_id,
            asset_name=self.asset_name,
            folder_id=self.folder_id,
            description=self.description,
            create_new_asset=self.create_new_asset,
            existing_asset_id=self.existing_asset_id,
        )

        self.finished.emit(success, self.jobs)


class ReviewPage(QWidget):
    """Page for uploading deliverables to Review system."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.uploader = ReviewUploaderService(config)
        self.selected_files: List[Path] = []
        self.current_jobs: List[ReviewUploadJob] = []
        self.upload_worker: Optional[ReviewUploadWorker] = None
        self.review_folders: List[dict] = []
        self.review_assets: List[dict] = []
        self.selected_folder_id: Optional[str] = None
        self.selected_asset_id: Optional[str] = None
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        title = QLabel("Upload to Review")
        title.setObjectName("page-title")
        layout.addWidget(title)

        subtitle = QLabel("Upload deliverables for client/stakeholder review")
        subtitle.setObjectName("page-subtitle")
        layout.addWidget(subtitle)

        # Main content with splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(8)

        # Left: File selection
        left = self.create_file_panel()
        left.setMinimumWidth(250)
        splitter.addWidget(left)

        # Right: Review settings (in scroll area)
        right_scroll = QScrollArea()
        right_scroll.setWidgetResizable(True)
        right_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        right_scroll.setStyleSheet("QScrollArea { border: none; background: transparent; }")
        right_panel = self.create_settings_panel()
        right_panel.setMinimumWidth(220)
        right_scroll.setWidget(right_panel)
        splitter.addWidget(right_scroll)

        # Set initial sizes (55/45 split)
        splitter.setSizes([300, 250])

        layout.addWidget(splitter, 1)

        # Bottom: Progress
        progress_panel = self.create_progress_panel()
        layout.addWidget(progress_panel)

    def create_file_panel(self) -> QFrame:
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Select Deliverables")
        label.setObjectName("card-title")
        layout.addWidget(label)

        hint = QLabel("Video files will be transcoded for streaming playback")
        hint.setObjectName("label-small")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        # Browse button
        browse_btn = QPushButton("Browse Files...")
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
        layout.setSpacing(12)

        label = QLabel("Review Settings")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Folder selector
        folder_label = QLabel("Review Folder")
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

        # Upload mode
        mode_label = QLabel("Upload Mode")
        mode_label.setObjectName("label-muted")
        layout.addWidget(mode_label)

        self.new_asset_radio = QCheckBox("Create new review asset")
        self.new_asset_radio.setChecked(True)
        self.new_asset_radio.stateChanged.connect(self.on_mode_changed)
        layout.addWidget(self.new_asset_radio)

        # Asset name (for new asset)
        self.asset_name_label = QLabel("Asset Name")
        self.asset_name_label.setObjectName("label-muted")
        layout.addWidget(self.asset_name_label)

        self.asset_name_input = QLineEdit()
        self.asset_name_input.setPlaceholderText("e.g., Scene 1 - Final Cut")
        layout.addWidget(self.asset_name_input)

        # Existing asset selector
        self.existing_asset_label = QLabel("Add to Existing Asset")
        self.existing_asset_label.setObjectName("label-muted")
        self.existing_asset_label.setVisible(False)
        layout.addWidget(self.existing_asset_label)

        self.asset_combo = QComboBox()
        self.asset_combo.setVisible(False)
        self.asset_combo.currentIndexChanged.connect(self.on_asset_changed)
        layout.addWidget(self.asset_combo)

        # Separator
        sep2 = QFrame()
        sep2.setFixedHeight(1)
        sep2.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep2)

        # Description
        desc_label = QLabel("Description (optional)")
        desc_label.setObjectName("label-muted")
        layout.addWidget(desc_label)

        self.description_input = QTextEdit()
        self.description_input.setPlaceholderText("Add notes for reviewers...")
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

        self.upload_btn = QPushButton("Upload to Review")
        self.upload_btn.setObjectName("primary-button")
        self.upload_btn.clicked.connect(self.start_upload)
        self.upload_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.upload_btn)

        layout.addLayout(btn_layout)

        return panel

    def browse_files(self):
        """Open file browser to select deliverables."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Review Deliverables",
            str(Path.home()),
            "Video Files (*.mov *.mp4 *.mxf *.avi *.r3d *.braw *.prores *.dnxhd);;All Files (*)",
        )
        if files:
            self.selected_files = [Path(f) for f in files]
            self.update_file_list()

            # Auto-fill asset name from first file
            if self.selected_files and not self.asset_name_input.text():
                first_name = self.selected_files[0].stem
                self.asset_name_input.setText(first_name)

    def clear_files(self):
        """Clear selected files."""
        self.selected_files = []
        self.file_list.clear()
        self.file_summary.setText("No files selected")

    def update_file_list(self):
        """Update the file list display."""
        self.file_list.clear()
        total_size = 0

        for path in self.selected_files:
            icon = self.get_file_icon(path)
            item = QListWidgetItem(f"{icon}  {path.name}")
            item.setData(Qt.ItemDataRole.UserRole, path)
            self.file_list.addItem(item)
            if path.exists():
                total_size += path.stat().st_size

        size_str = self.format_size(total_size)
        self.file_summary.setText(f"{len(self.selected_files)} files selected ({size_str})")

    def get_file_icon(self, path: Path) -> str:
        """Get icon for file type."""
        suffix = path.suffix.lower()
        video_exts = {'.mov', '.mp4', '.mxf', '.avi', '.r3d', '.braw', '.prores'}
        if suffix in video_exts:
            return "🎬"
        return "📄"

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def refresh_folders(self):
        """Fetch review folders from the API."""
        project_id = self.config.get_project_id()
        if not project_id:
            self.folder_combo.clear()
            self.folder_combo.addItem("⚠️ No project connected")
            return

        try:
            self.review_folders = self.uploader.get_review_folders(project_id)

            self.folder_combo.clear()
            self.folder_combo.addItem("(Root - No folder)")

            if self.review_folders:
                for folder in self.review_folders:
                    name = folder.get("name", "Untitled")
                    self.folder_combo.addItem(f"📁 {name}")

            # Also refresh assets
            self.refresh_assets()

        except Exception as e:
            self.folder_combo.clear()
            self.folder_combo.addItem(f"⚠️ Error: {str(e)[:30]}")

    def refresh_assets(self):
        """Fetch existing review assets from the API."""
        project_id = self.config.get_project_id()
        if not project_id:
            return

        try:
            self.review_assets = self.uploader.get_review_assets(project_id, self.selected_folder_id)

            self.asset_combo.clear()
            self.asset_combo.addItem("Select existing asset...")

            if self.review_assets:
                for asset in self.review_assets:
                    name = asset.get("name", "Untitled")
                    version_count = asset.get("version_count", 0)
                    self.asset_combo.addItem(f"{name} (v{version_count})")
            else:
                self.asset_combo.addItem("(No existing assets)")

        except Exception as e:
            self.asset_combo.clear()
            self.asset_combo.addItem(f"⚠️ Error: {str(e)[:30]}")

    def on_folder_changed(self, index: int):
        """Handle folder selection change."""
        if index <= 0:
            self.selected_folder_id = None
        else:
            folder_index = index - 1
            if 0 <= folder_index < len(self.review_folders):
                self.selected_folder_id = self.review_folders[folder_index].get("id")

        # Refresh assets for new folder
        self.refresh_assets()

    def on_asset_changed(self, index: int):
        """Handle asset selection change."""
        if index <= 0:
            self.selected_asset_id = None
        else:
            asset_index = index - 1
            if 0 <= asset_index < len(self.review_assets):
                self.selected_asset_id = self.review_assets[asset_index].get("id")

    def on_mode_changed(self, state: int):
        """Handle upload mode change."""
        create_new = self.new_asset_radio.isChecked()

        # Toggle visibility
        self.asset_name_label.setVisible(create_new)
        self.asset_name_input.setVisible(create_new)
        self.existing_asset_label.setVisible(not create_new)
        self.asset_combo.setVisible(not create_new)

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

        create_new = self.new_asset_radio.isChecked()

        if create_new:
            asset_name = self.asset_name_input.text().strip()
            if not asset_name:
                self.progress_label.setText("⚠️ Please enter an asset name")
                self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
                return
        else:
            if not self.selected_asset_id:
                self.progress_label.setText("⚠️ Please select an existing asset")
                self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
                return
            asset_name = ""  # Will use existing asset name

        # Create upload jobs
        self.current_jobs = self.uploader.create_jobs(self.selected_files)

        # Update UI
        self.upload_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)
        self.progress_label.setText("Starting upload...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")

        # Start worker
        self.upload_worker = ReviewUploadWorker(
            uploader=self.uploader,
            jobs=self.current_jobs,
            project_id=project_id,
            asset_name=asset_name,
            folder_id=self.selected_folder_id,
            description=self.description_input.toPlainText(),
            create_new_asset=create_new,
            existing_asset_id=self.selected_asset_id,
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

    def on_finished(self, success: bool, jobs: List[ReviewUploadJob]):
        """Handle upload completion."""
        self.upload_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

        if success:
            self.progress_bar.setValue(100)
            self.progress_label.setText("✓ Upload complete! Transcoding will begin automatically.")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']};")

            # Clear selection
            self.clear_files()
            self.asset_name_input.clear()
            self.description_input.clear()
        else:
            failed = sum(1 for j in jobs if j.status == ReviewUploadStatus.FAILED)
            self.progress_label.setText(f"Upload finished with {failed} failure(s)")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")

    def showEvent(self, event):
        """Called when page becomes visible."""
        super().showEvent(event)
        # Don't auto-fetch - let user click refresh to avoid blocking UI
