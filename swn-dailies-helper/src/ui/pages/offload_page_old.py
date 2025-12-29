"""
Offload page - Main workflow for offloading footage.
"""
from datetime import datetime
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
    QCheckBox,
    QSplitter,
    QMessageBox,
    QLineEdit,
    QGroupBox,
    QScrollArea,
    QTextEdit,
    QFileDialog,
    QListView,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QPalette, QColor, QBrush
from pathlib import Path
from typing import List, Dict, Any, Optional

from src.services.config import ConfigManager
from src.services.card_reader import CardReader




from src.services.card_fingerprint import CardFingerprintService
from src.services.offload_manifest import OffloadManifestService, OffloadManifest
from src.services.offload_worker import OffloadWorker, format_bytes
from src.services.session_manager import SessionManager
from src.services.overnight_worker import OvernightUploadWorker
from src.ui.styles import COLORS


class OffloadPage(QWidget):
    """Offload page for copying footage from cards."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.card_reader = CardReader()
        self.fingerprint_service = CardFingerprintService()
        self.manifest_service = OffloadManifestService(config)
        self.session_manager = SessionManager.get_instance()
        self.current_fingerprint = None
        self.projects: List[Dict[str, Any]] = []
        self.production_days: List[Dict[str, Any]] = []
        self.worker: Optional[OffloadWorker] = None
        self.overnight_worker: Optional[OvernightUploadWorker] = None
        self.current_manifest: Optional[OffloadManifest] = None
        self.source_path: Optional[Path] = None
        self._drive_signals_connected = False
        self.setup_ui()

    def setup_ui(self):
        """Initialize the UI with responsive layout for small screens.

        Note: We avoid wrapping the whole page in a scroll area because
        QComboBox popups have z-order issues inside scroll areas on Linux.
        Instead, each panel manages its own scrolling.
        """
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(10)

        # Header (compact)
        header = QHBoxLayout()
        header.setSpacing(10)

        title = QLabel("Offload Footage")
        title.setObjectName("page-title")
        header.addWidget(title)

        header.addStretch()

        # How to button
        how_to_btn = QPushButton("? How to Use")
        how_to_btn.clicked.connect(self._show_how_to)
        how_to_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(how_to_btn)

        # Refresh button in header
        refresh_btn = QPushButton("↻ Refresh")
        refresh_btn.clicked.connect(self.refresh_drives)
        refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(refresh_btn)

        layout.addLayout(header)

        # Main content - use splitter for resizable panels
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(6)
        splitter.setChildrenCollapsible(False)

        # Left panel - Source
        left = self.create_source_panel()
        left.setMinimumWidth(160)
        splitter.addWidget(left)

        # Right panel - Destinations and options
        right = self.create_destination_panel()
        right.setMinimumWidth(200)
        splitter.addWidget(right)

        # Set initial sizes (equal split)
        splitter.setSizes([1, 1])

        layout.addWidget(splitter, 1)

        # Bottom - Progress and actions (compact)
        actions = self.create_actions_panel()
        layout.addWidget(actions)

    def create_source_panel(self) -> QFrame:
        """Create the source panel with browse and options below."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(10)

        # Title
        label = QLabel("Source")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Browse button
        self.browse_btn = QPushButton("📁 Browse for Card/Folder...")
        self.browse_btn.setToolTip("Select a camera card or folder to offload")
        self.browse_btn.clicked.connect(self.browse_source)
        self.browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(self.browse_btn)

        # Selected path display
        self.source_path_label = QLabel("No source selected")
        self.source_path_label.setObjectName("label-muted")
        self.source_path_label.setWordWrap(True)
        layout.addWidget(self.source_path_label)

        # Clip info
        self.clip_count = QLabel("")
        self.clip_count.setObjectName("label-muted")
        layout.addWidget(self.clip_count)

        self.clip_size = QLabel("")
        self.clip_size.setObjectName("label-small")
        self.clip_size.setWordWrap(True)
        layout.addWidget(self.clip_size)

        # === OPTIONS SECTION (moved here from destination) ===
        self._add_separator(layout)

        # Camera/Roll row
        cam_roll_row = QHBoxLayout()
        cam_roll_row.setSpacing(8)

        self.camera_input = QLineEdit()
        self.camera_input.setPlaceholderText("Cam (A)")
        self.camera_input.setMaximumWidth(70)
        cam_roll_row.addWidget(self.camera_input)

        self.roll_input = QLineEdit()
        self.roll_input.setPlaceholderText("Roll (A001)")
        cam_roll_row.addWidget(self.roll_input, 1)
        layout.addLayout(cam_roll_row)

        # Folder template
        self.folder_template = QLineEdit()
        self.folder_template.setText("{camera}_{roll}")
        self.folder_template.setPlaceholderText("Folder: {camera}_{roll}")
        self.folder_template.setToolTip(
            "Folder name template\n"
            "Variables: {camera}, {roll}, {date}, {project}, {day}\n"
            "Example: {date}/{camera}_{roll} → 2024-03-15/A_A001"
        )
        layout.addWidget(self.folder_template)

        # Options label
        options_label = QLabel("Options")
        options_label.setObjectName("label-muted")
        layout.addWidget(options_label)

        self.verify_checksum = QCheckBox("Verify checksums")
        self.verify_checksum.setChecked(True)
        layout.addWidget(self.verify_checksum)

        self.generate_proxy = QCheckBox("Generate proxies")
        self.generate_proxy.setChecked(True)
        layout.addWidget(self.generate_proxy)

        self.upload_cloud = QCheckBox("Upload to cloud")
        self.upload_cloud.setChecked(True)
        layout.addWidget(self.upload_cloud)

        self.create_footage_asset = QCheckBox("Create footage asset")
        self.create_footage_asset.setChecked(False)
        layout.addWidget(self.create_footage_asset)

        layout.addStretch()

        # Hidden list widget for compatibility
        self.drive_list = QListWidget()
        self.drive_list.setVisible(False)
        self.drive_list.itemSelectionChanged.connect(self.on_source_selected)
        layout.addWidget(self.drive_list)

        return panel

    def browse_source(self):
        """Open file dialog to select a source folder."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Source Folder",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )
        if folder:
            path = Path(folder)

            # Update the path label
            self.source_path_label.setText(f"📁 {path}")
            self.source_path_label.setStyleSheet(f"color: {COLORS['bone-white']};")

            # Clear and add to hidden list (for compatibility)
            self.drive_list.clear()
            item = QListWidgetItem(path.name)
            item.setData(Qt.ItemDataRole.UserRole, {
                "name": path.name,
                "path": str(path),
                "type": "custom",
                "cameraType": self.card_reader._detect_camera_type(path),
            })
            self.drive_list.addItem(item)
            self.drive_list.setCurrentItem(item)

    def create_destination_panel(self) -> QFrame:
        """Create the destination drives panel - simplified, no scroll needed."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(10)

        # Title
        label = QLabel("Destination")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # === DRIVES SECTION ===
        drives_label = QLabel("Drives")
        drives_label.setObjectName("label-muted")
        layout.addWidget(drives_label)

        self.primary_drive = QComboBox()
        self.primary_drive.setPlaceholderText("Primary drive...")
        layout.addWidget(self.primary_drive)

        self.backup_drive = QComboBox()
        self._add_combo_item(self.backup_drive, "Backup: None", None)
        layout.addWidget(self.backup_drive)

        # === BACKLOT LINK SECTION ===
        self._add_separator(layout)

        link_label = QLabel("Link to Backlot")
        link_label.setObjectName("label-muted")
        layout.addWidget(link_label)

        # Project selector
        project_row = QHBoxLayout()
        project_row.setSpacing(4)
        self.project_combo = QComboBox()
        self.project_combo.setPlaceholderText("Project...")
        # Use activated signal - fires immediately when user clicks an item
        self.project_combo.activated.connect(self.on_project_selected)
        project_row.addWidget(self.project_combo, 1)

        refresh_projects_btn = QPushButton("↻ Refresh")
        refresh_projects_btn.setToolTip("Refresh projects from Backlot")
        refresh_projects_btn.clicked.connect(self.refresh_projects)
        refresh_projects_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        project_row.addWidget(refresh_projects_btn)
        layout.addLayout(project_row)

        self.day_combo = QComboBox()
        self.day_combo.setPlaceholderText("Production day...")
        self.day_combo.setEnabled(False)
        layout.addWidget(self.day_combo)

        # === SESSION CONTROLS ===
        self._add_separator(layout)

        session_label = QLabel("Overnight Upload Session")
        session_label.setObjectName("label-muted")
        layout.addWidget(session_label)

        # Session status
        self.session_status = QLabel("No active session")
        self.session_status.setObjectName("label-small")
        layout.addWidget(self.session_status)

        # Start session button
        self.start_session_btn = QPushButton("Start New Session")
        self.start_session_btn.setToolTip(
            "Start a session to batch multiple card offloads.\n"
            "When you finish, check 'End Session + Upload' to\n"
            "trigger overnight proxy generation and upload."
        )
        self.start_session_btn.clicked.connect(self._start_session)
        self.start_session_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(self.start_session_btn)

        # End session checkbox (visible when session active)
        self.end_session_upload = QCheckBox("End Session + Upload When Complete")
        self.end_session_upload.setToolTip(
            "When this offload completes:\n"
            "1. Run internet speed test\n"
            "2. Generate proxies for all session cards\n"
            "3. Upload proxies overnight"
        )
        self.end_session_upload.setVisible(False)
        layout.addWidget(self.end_session_upload)

        # Apply LUT checkbox (visible when session active)
        self.session_apply_lut = QCheckBox("Apply LUT to session proxies")
        self.session_apply_lut.setToolTip("Apply the LUT from Settings to generated proxies")
        self.session_apply_lut.setVisible(False)
        layout.addWidget(self.session_apply_lut)

        # Cancel session button (visible when session active)
        self.cancel_session_btn = QPushButton("Cancel Session")
        self.cancel_session_btn.setObjectName("danger-button")
        self.cancel_session_btn.clicked.connect(self._cancel_session)
        self.cancel_session_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_session_btn.setVisible(False)
        layout.addWidget(self.cancel_session_btn)

        layout.addStretch()

        # Update session UI on init
        self._update_session_ui()

        return panel

    def _add_separator(self, layout: QVBoxLayout):
        """Add a visual separator line."""
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

    def _style_combobox_dropdown(self, combo: QComboBox):
        """Style a combobox dropdown - now a no-op since global styles handle it."""
        # Global APP_STYLESHEET in styles.py handles all QComboBox styling
        # No additional styling needed now that we removed QScrollArea
        pass

    def _add_combo_item(self, combo: QComboBox, text: str, data=None):
        """Add an item to a combobox."""
        combo.addItem(text, data)

    def _show_error(self, title: str, message: str):
        """Show an error dialog."""
        QMessageBox.critical(self, title, message)

    def _show_how_to(self):
        """Show instructions for using the offload tab."""
        from PyQt6.QtWidgets import QDialog, QTextBrowser

        instructions = f"""
<style>
    body {{
        color: {COLORS['bone-white']};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.6;
    }}
    h2 {{
        color: {COLORS['accent-yellow']};
        font-size: 18px;
        margin-bottom: 16px;
        border-bottom: 1px solid {COLORS['border-gray']};
        padding-bottom: 8px;
    }}
    h3 {{
        color: {COLORS['bone-white']};
        font-size: 14px;
        margin-top: 20px;
        margin-bottom: 8px;
    }}
    p, li {{
        color: {COLORS['bone-white']};
        margin-bottom: 6px;
    }}
    b {{
        color: {COLORS['accent-yellow']};
    }}
    code {{
        background-color: {COLORS['charcoal-light']};
        padding: 2px 6px;
        border-radius: 4px;
        color: {COLORS['accent-yellow']};
    }}
</style>

<h2>How to Use the Offload Tab</h2>

<h3>Basic Offload (Single Card)</h3>
<ol>
<li><b>Select Source:</b> Click "Browse for Card/Folder" and select your camera card or footage folder.</li>
<li><b>Set Camera/Roll:</b> Enter the camera letter (A, B, C) and roll number (A001, A002).</li>
<li><b>Choose Destination:</b> Select primary drive. Optionally select a backup drive.</li>
<li><b>Link to Backlot:</b> Select a project and production day to organize your footage.</li>
<li><b>Start Offload:</b> Click "Start Offload" to copy files with checksum verification.</li>
</ol>

<h3>Overnight Upload Session (Multiple Cards)</h3>
<p>For end-of-day batch uploads when you want to offload the last card and go to bed:</p>
<ol>
<li><b>Start Session:</b> At the beginning of your shoot day, click "Start New Session".</li>
<li><b>Offload Cards:</b> Offload each card normally throughout the day. Each is added to the session.</li>
<li><b>Last Card:</b> On your final card, check "End Session + Upload When Complete".</li>
<li><b>Optional LUT:</b> Check "Apply LUT to session proxies" if you want color correction applied.</li>
<li><b>Start Offload:</b> Click "Start Offload". When it finishes, the overnight upload begins automatically.</li>
</ol>

<h3>What Happens Overnight</h3>
<ul>
<li><b>Speed Test:</b> Tests your internet speed to determine proxy quality.</li>
<li><b>Proxy Generation:</b> Creates 1080p or 720p proxies (based on speed) for ALL session cards.</li>
<li><b>Upload:</b> Uploads all proxies to Backlot for review.</li>
</ul>

<h3>Options</h3>
<ul>
<li><b>Verify checksums:</b> Ensures files copied correctly (recommended).</li>
<li><b>Generate proxies:</b> Create smaller preview files.</li>
<li><b>Upload to cloud:</b> Queue files for upload to Backlot.</li>
<li><b>Create footage asset:</b> Register clips in Backlot's asset library.</li>
</ul>

<h3>Tips</h3>
<ul>
<li>The folder template uses variables: <code>{{camera}}</code>, <code>{{roll}}</code>, <code>{{date}}</code>, <code>{{project}}</code>, <code>{{day}}</code></li>
<li>Sessions persist if the app closes - you can resume where you left off.</li>
<li>Click "Cancel Session" if you need to start over.</li>
</ul>
"""
        # Create custom dialog
        dialog = QDialog(self)
        dialog.setWindowTitle("How to Use Offload")
        dialog.setMinimumSize(550, 500)
        dialog.setStyleSheet(f"background-color: {COLORS['charcoal-black']};")

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Text browser for scrollable rich text
        text_browser = QTextBrowser()
        text_browser.setHtml(instructions)
        text_browser.setOpenExternalLinks(True)
        text_browser.setStyleSheet(f"""
            QTextBrowser {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                padding: 16px;
            }}
        """)
        layout.addWidget(text_browser)

        # Close button
        close_btn = QPushButton("Got it!")
        close_btn.setObjectName("primary-button")
        close_btn.clicked.connect(dialog.accept)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(close_btn)

        dialog.exec()

    def _show_warning(self, message: str):
        """Show a warning in the progress label."""
        self.progress_label.setText(f"⚠️ {message}")
        self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")

    def refresh_projects(self):
        """Refresh the list of projects using desktop-keys/verify endpoint."""
        self.project_combo.clear()
        self._add_combo_item(self.project_combo, "Select project...", None)
        self.day_combo.clear()
        self.day_combo.setEnabled(False)

        # Get API key
        api_key = self.config.get_api_key()
        api_url = self.config.get_api_url() or "http://localhost:8000"

        if not api_key:
            self._add_combo_item(self.project_combo, "Not logged in - configure in Settings", None)
            return

        try:
            import requests
            # Use the desktop-keys/verify endpoint which returns projects
            url = f"{api_url}/api/v1/backlot/desktop-keys/verify"
            response = requests.post(
                url,
                headers={"X-API-Key": api_key},
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                if not data.get("valid"):
                    self._add_combo_item(self.project_combo, "Invalid API key", None)
                    return

                self.projects = data.get("projects", [])

                if not self.projects:
                    self._add_combo_item(self.project_combo, "No projects available", None)
                    return

                for project in self.projects:
                    self._add_combo_item(
                        self.project_combo,
                        project.get("name") or project.get("title") or "Untitled",
                        project.get("id")
                    )
            else:
                self._add_combo_item(self.project_combo, "Error loading projects", None)
        except Exception as e:
            print(f"Error fetching projects: {e}")
            self._add_combo_item(self.project_combo, "Error loading projects", None)

    def on_project_selected(self, index: int = -1):
        """Handle project selection - load production days."""
        # Force popup to close (workaround for Linux/WSL)
        self.project_combo.hidePopup()

        project_id = self.project_combo.currentData()

        self.day_combo.clear()
        self._add_combo_item(self.day_combo, "Select production day...", None)
        self.production_days = []

        if not project_id:
            self.day_combo.setEnabled(False)
            return

        self.day_combo.setEnabled(True)

        # Get API key and URL
        api_key = self.config.get_api_key()
        api_url = self.config.get_api_url() or "http://localhost:8000"

        if not api_key:
            return

        try:
            import requests
            # Use the desktop-keys endpoint for production days
            url = f"{api_url}/api/v1/backlot/desktop-keys/projects/{project_id}/production-days"
            response = requests.get(
                url,
                headers={"X-API-Key": api_key},
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                self.production_days = data.get("production_days", [])

                for day in self.production_days:
                    day_num = day.get("day_number", "?")
                    day_date = day.get("date", "")
                    day_title = day.get("title", "")

                    display = f"Day {day_num}"
                    if day_date:
                        display += f" - {day_date}"
                    if day_title:
                        display += f" ({day_title})"

                    self._add_combo_item(self.day_combo, display, day.get("id"))
        except Exception as e:
            print(f"Error loading production days: {e}")

    def create_actions_panel(self) -> QFrame:
        """Create the actions/progress panel."""
        panel = QFrame()
        panel.setObjectName("card")
        panel.setMaximumHeight(120)  # Keep actions panel compact

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(6)

        # Progress row - label and bar side by side
        progress_row = QHBoxLayout()
        progress_row.setSpacing(10)

        self.progress_label = QLabel("Ready to offload")
        self.progress_label.setObjectName("label-muted")
        self.progress_label.setMinimumWidth(120)
        progress_row.addWidget(self.progress_label)

        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        self.progress_bar.setMaximumHeight(18)
        progress_row.addWidget(self.progress_bar, 1)

        layout.addLayout(progress_row)

        # File detail and buttons row
        bottom_row = QHBoxLayout()
        bottom_row.setSpacing(10)

        self.file_label = QLabel("")
        self.file_label.setObjectName("label-small")
        bottom_row.addWidget(self.file_label, 1)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("danger-button")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self.cancel_offload)
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.setMinimumWidth(80)
        bottom_row.addWidget(self.cancel_btn)

        self.start_btn = QPushButton("Start Offload")
        self.start_btn.setObjectName("primary-button")
        self.start_btn.clicked.connect(self.start_offload)
        self.start_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        bottom_row.addWidget(self.start_btn)

        layout.addLayout(bottom_row)

        return panel

    def refresh_drives(self):
        """Refresh the list of available drives for destination selection."""
        self.primary_drive.clear()
        self.backup_drive.clear()
        self._add_combo_item(self.primary_drive, "Browse...", "__browse__")
        self._add_combo_item(self.backup_drive, "None (skip backup)", None)
        self._add_combo_item(self.backup_drive, "Browse...", "__browse__")

        # Connect browse handlers (only once)
        if not self._drive_signals_connected:
            self.primary_drive.activated.connect(self._on_primary_drive_selected)
            self.backup_drive.activated.connect(self._on_backup_drive_selected)
            self._drive_signals_connected = True

        try:
            drives = self.card_reader.list_drives()
        except Exception as e:
            # Just log, don't show error - user can still use Browse
            print(f"Drive scan error: {e}")
            return

        for drive in drives:
            name = drive.get("name", "Unknown")
            free_space = drive.get("freeSpace")

            space_str = ""
            if free_space:
                space_str = f" ({self.format_size(free_space)} free)"

            # Add to destination combos only
            dest_display = f"{name}{space_str}"
            self._add_combo_item(self.primary_drive, dest_display, drive.get("path"))
            self._add_combo_item(self.backup_drive, dest_display, drive.get("path"))

    def _on_primary_drive_selected(self, index: int):
        """Handle primary drive selection - open browse if needed."""
        if self.primary_drive.currentData() == "__browse__":
            folder = QFileDialog.getExistingDirectory(
                self, "Select Primary Destination", str(Path.home())
            )
            if folder:
                path = Path(folder)
                self._add_combo_item(self.primary_drive, f"📁 {path.name}", str(path))
                self.primary_drive.setCurrentIndex(self.primary_drive.count() - 1)
            else:
                self.primary_drive.setCurrentIndex(-1)

    def _on_backup_drive_selected(self, index: int):
        """Handle backup drive selection - open browse if needed."""
        if self.backup_drive.currentData() == "__browse__":
            folder = QFileDialog.getExistingDirectory(
                self, "Select Backup Destination", str(Path.home())
            )
            if folder:
                path = Path(folder)
                self._add_combo_item(self.backup_drive, f"📁 {path.name}", str(path))
                self.backup_drive.setCurrentIndex(self.backup_drive.count() - 1)
            else:
                self.backup_drive.setCurrentIndex(0)  # Back to "None"

    def on_source_selected(self):
        """Handle source drive selection."""
        items = self.drive_list.selectedItems()
        if not items:
            self.clip_count.setText("No source selected")
            self.clip_size.setText("")
            self.current_fingerprint = None
            return

        drive = items[0].data(Qt.ItemDataRole.UserRole)
        if not drive:
            return

        path = Path(drive.get("path"))

        # Verify path exists and is accessible
        if not path.exists():
            self.clip_count.setText("Path not accessible")
            self.clip_size.setText(f"{path}")
            self.current_fingerprint = None
            return

        # Scan for clips with error handling
        self.clip_count.setText("Scanning for media files...")
        self.clip_size.setText("")

        try:
            clips = self.card_reader.find_media_files(path)
        except PermissionError:
            self.clip_count.setText("Permission denied")
            self.clip_size.setText("Cannot access this folder")
            self.current_fingerprint = None
            return
        except Exception as e:
            self.clip_count.setText("Error scanning")
            self.clip_size.setText(str(e)[:100])
            self.current_fingerprint = None
            return

        if clips:
            total_size = sum(c.get("size", 0) for c in clips)
            size_str = self.format_size(total_size)
            self.clip_count.setText(f"{len(clips)} media files found")
            self.clip_size.setText(f"Total: {size_str}")

            # Compute fingerprint for duplicate detection
            try:
                self.current_fingerprint = self.fingerprint_service.compute_fingerprint(path)

                # Check for previous offload
                previous = self.fingerprint_service.check_previous_offload(
                    self.current_fingerprint.fingerprint
                )
                if previous:
                    self.clip_size.setText(
                        f"Total: {size_str}\n"
                        f"⚠️ Previously offloaded {previous.offload_timestamp.strftime('%Y-%m-%d %H:%M')}"
                    )
            except Exception as e:
                # Fingerprint failed but we can still offload
                self.current_fingerprint = None
        else:
            self.clip_count.setText("No media files found")
            self.clip_size.setText("Supported: .mov, .mp4, .mxf, .r3d, .braw, etc.")
            self.current_fingerprint = None

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def _expand_folder_template(self, template: str) -> str:
        """Expand folder template variables."""
        camera = self.camera_input.text().strip() or "A"
        roll = self.roll_input.text().strip() or "001"
        date = datetime.now().strftime("%Y-%m-%d")

        # Get project name
        project_name = ""
        project_idx = self.project_combo.currentIndex()
        if project_idx > 0 and self.projects:
            try:
                project_name = self.projects[project_idx - 1].get("title", "").replace(" ", "_")
            except (IndexError, AttributeError):
                pass

        # Get production day number
        day_num = ""
        day_idx = self.day_combo.currentIndex()
        if day_idx > 0 and self.production_days:
            try:
                day_num = str(self.production_days[day_idx - 1].get("day_number", ""))
            except (IndexError, AttributeError):
                pass

        # Expand template
        result = template.replace("{camera}", camera)
        result = result.replace("{roll}", roll)
        result = result.replace("{date}", date)
        result = result.replace("{project}", project_name)
        result = result.replace("{day}", day_num)

        return result

    def start_offload(self):
        """Start the offload process."""
        # Validate source selection
        source_items = self.drive_list.selectedItems()
        if not source_items:
            self._show_warning("Please select a source folder")
            return

        source_drive = source_items[0].data(Qt.ItemDataRole.UserRole)
        if not source_drive:
            self._show_warning("Invalid source selection")
            return

        source_path = Path(source_drive.get("path"))
        if not source_path.exists():
            self._show_warning(f"Source path not found: {source_path}")
            return

        # Validate destination selection
        primary_data = self.primary_drive.currentData()
        if not primary_data or primary_data == "__browse__":
            self._show_warning("Please select a destination drive")
            return

        primary_base = Path(primary_data)
        if not primary_base.exists():
            self._show_warning(f"Destination not found: {primary_base}")
            return

        # Check we have files to copy
        try:
            self.clips_to_offload = self.card_reader.find_media_files(source_path)
        except Exception as e:
            self._show_error("Scan Error", f"Failed to scan source:\n{e}")
            return

        if not self.clips_to_offload:
            self._show_warning("No media files found in source")
            return

        # Check for duplicate offload
        if self.current_fingerprint:
            try:
                previous = self.fingerprint_service.check_previous_offload(
                    self.current_fingerprint.fingerprint
                )
                if previous:
                    reply = QMessageBox.warning(
                        self,
                        "Duplicate Card Detected",
                        f"This card was previously offloaded on:\n"
                        f"{previous.offload_timestamp.strftime('%Y-%m-%d at %H:%M')}\n\n"
                        f"Destinations:\n" +
                        "\n".join(f"  • {d}" for d in previous.destination_paths[:3]) +
                        f"\n\nStatus: {previous.status}\n\n"
                        f"Do you want to offload again?",
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                        QMessageBox.StandardButton.No
                    )
                    if reply == QMessageBox.StandardButton.No:
                        return
            except Exception:
                pass  # Continue without duplicate check

        # Build destination paths using folder template
        folder_template = self.folder_template.text().strip() or "{camera}_{roll}"
        folder_name = self._expand_folder_template(folder_template)

        # Validate folder name
        if not folder_name or folder_name.strip("/\\") == "":
            self._show_warning("Invalid folder template")
            return

        backup_base = self.backup_drive.currentData()

        # Build destination list
        primary_path = str(primary_base / folder_name)
        destinations = [primary_path]

        if backup_base and backup_base != "__browse__":
            backup_path = str(Path(backup_base) / folder_name)
            destinations.append(backup_path)

        # Check destination has enough space
        total_size = sum(c.get("size", 0) for c in self.clips_to_offload)
        try:
            import shutil
            free_space = shutil.disk_usage(primary_base).free
            if free_space < total_size:
                reply = QMessageBox.warning(
                    self,
                    "Low Disk Space",
                    f"Destination may not have enough space.\n\n"
                    f"Required: {self.format_size(total_size)}\n"
                    f"Available: {self.format_size(free_space)}\n\n"
                    f"Continue anyway?",
                    QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                    QMessageBox.StandardButton.No
                )
                if reply == QMessageBox.StandardButton.No:
                    return
        except Exception:
            pass  # Continue without space check

        # Update UI for offload
        self.progress_label.setText("Starting offload...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)

        self.source_path = source_path
        self.verify_enabled = self.verify_checksum.isChecked()
        self.proxy_enabled = self.generate_proxy.isChecked()

        self.file_label.setText(f"Preparing {len(self.clips_to_offload)} files...")

        # Get Backlot link info
        project_id = self.project_combo.currentData()
        production_day_id = self.day_combo.currentData()
        camera_label = self.camera_input.text().strip() or "A"
        roll_name = self.roll_input.text().strip() or ""
        create_footage = self.create_footage_asset.isChecked()

        # Create offload manifest for tracking
        source_device = source_drive.get("name", "Unknown Card")
        manifest = self.manifest_service.create_manifest(
            project_id=project_id,
            production_day_id=production_day_id,
            source_device=source_device,
            camera_label=camera_label,
            roll_name=roll_name,
            files=self.clips_to_offload,
            destination_paths=destinations,
            create_footage_asset=create_footage,
        )

        self.current_manifest = manifest
        self.manifest_service.start_offload(manifest)

        # Create and start the worker thread
        self.worker = OffloadWorker(
            manifest=manifest,
            source_path=str(source_path),
            destinations=destinations,
            verify_checksums=self.verify_enabled,
        )

        # Connect signals
        self.worker.progress_updated.connect(self._on_progress_updated)
        self.worker.file_progress.connect(self._on_file_progress)
        self.worker.file_completed.connect(self._on_file_completed)
        self.worker.offload_completed.connect(self._on_offload_completed)
        self.worker.status_message.connect(self._on_status_message)

        # Start the offload
        link_info = " (linked to Backlot)" if project_id else ""
        self.progress_label.setText(
            f"Offloading {len(self.clips_to_offload)} clips to {folder_name}{link_info}"
        )
        self.worker.start()

    def cancel_offload(self):
        """Cancel the current offload operation."""
        if self.worker and self.worker.isRunning():
            reply = QMessageBox.question(
                self,
                "Cancel Offload",
                "Are you sure you want to cancel the offload?\n\n"
                "Partially copied files will be deleted.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.Yes:
                self.progress_label.setText("Cancelling...")
                self.worker.cancel()
        else:
            self._reset_ui_after_offload()

    def _on_progress_updated(self, file_idx: int, total_files: int, filename: str):
        """Handle progress updates from worker."""
        percent = int((file_idx / total_files) * 100) if total_files > 0 else 0
        self.progress_bar.setValue(percent)
        self.file_label.setText(f"[{file_idx}/{total_files}] {filename}")

    def _on_file_progress(self, bytes_copied: int, total_bytes: int):
        """Handle per-file byte progress updates."""
        if total_bytes > 0:
            # Show file-level progress in status
            percent = (bytes_copied / total_bytes) * 100
            copied_str = format_bytes(bytes_copied)
            total_str = format_bytes(total_bytes)
            self.file_label.setText(
                f"{self.file_label.text().split(' - ')[0]} - {copied_str}/{total_str} ({percent:.0f}%)"
            )

    def _on_file_completed(self, filename: str, success: bool, error_msg: str):
        """Handle file completion notification."""
        if not success:
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            self.progress_label.setText(f"⚠️ Error: {error_msg}")

    def _on_status_message(self, message: str):
        """Handle status message updates."""
        self.progress_label.setText(message)
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")

    def _on_offload_completed(self, success: bool, message: str, stats: dict):
        """Handle offload completion."""
        if success:
            self.progress_label.setText(f"✓ {message}")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']};")
            self.progress_bar.setValue(100)

            # Record fingerprint to prevent duplicate offloads
            if self.current_fingerprint and self.current_manifest:
                self.fingerprint_service.record_offload(
                    self.current_fingerprint,
                    self.current_manifest.destination_paths,
                    status="complete"
                )

            # Update manifest status
            if self.current_manifest:
                self.manifest_service.complete_offload(self.current_manifest)

            # Add manifest to session if active
            self._add_manifest_to_session()

            # Show completion stats
            bytes_copied = stats.get("bytes_copied", 0)
            files_copied = stats.get("files_copied", 0)
            checksums_verified = stats.get("checksums_verified", 0)

            status_text = (
                f"Copied {files_copied} files ({format_bytes(bytes_copied)}) • "
                f"{checksums_verified} checksums verified"
            )

            # Queue files for upload if enabled (but not if using session upload)
            should_queue = self.upload_cloud.isChecked() and not self.end_session_upload.isChecked()
            if should_queue and self.current_manifest:
                queued = self._queue_for_upload()
                if queued > 0:
                    status_text += f" • {queued} files queued for upload"

            self.file_label.setText(status_text)

            # Trigger proxy generation if enabled (but not if using session upload)
            if self.proxy_enabled and self.current_manifest and not self.end_session_upload.isChecked():
                self._trigger_proxy_generation()

            # Check if this offload should trigger overnight upload
            if self.end_session_upload.isChecked() and self.session_manager.has_active_session():
                self._reset_ui_after_offload()
                self._start_overnight_upload()
                return  # Don't reset UI again

        else:
            self.progress_label.setText(f"✗ {message}")
            self.progress_label.setStyleSheet(f"color: {COLORS['red']};")

            files_failed = stats.get("files_failed", 0)
            self.file_label.setText(f"{files_failed} file(s) failed")

        self._reset_ui_after_offload()

    def _queue_for_upload(self) -> int:
        """Queue offloaded files for upload. Returns number of files queued."""
        if not self.current_manifest:
            return 0

        try:
            from src.services.upload_queue import UploadQueueService
            upload_queue = UploadQueueService.get_instance()

            # Check if proxy generation is enabled
            generate_proxies = self.generate_proxy.isChecked()

            count = upload_queue.add_from_manifest(
                self.current_manifest,
                self.current_manifest.destination_paths,
                generate_proxies=generate_proxies,
            )

            # Update manifest upload status to pending
            for file_info in self.current_manifest.files:
                self.manifest_service.update_file(
                    file_info.file_name,
                    self.current_manifest,
                    upload_status="pending"
                )

            return count
        except Exception as e:
            print(f"Failed to queue files for upload: {e}")
            return 0

    def _reset_ui_after_offload(self):
        """Reset UI state after offload completes or is cancelled."""
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self.worker = None

    def _trigger_proxy_generation(self):
        """Notify that proxy generation will happen after upload completes."""
        # Proxy generation is now handled automatically after upload completes
        # via the generate_proxies flag in UploadQueueItem
        if self.current_manifest:
            files_count = len(self.current_manifest.files)
            current_text = self.file_label.text()
            self.file_label.setText(
                f"{current_text} • Proxies will generate after upload ({files_count} files)"
            )

    # === SESSION CONTROL METHODS ===

    def _start_session(self):
        """Start a new overnight upload session."""
        project_id = self.project_combo.currentData()
        production_day_id = self.day_combo.currentData()

        # Get LUT path from settings if enabled
        lut_path = None
        lut_enabled = self.session_apply_lut.isChecked()
        if lut_enabled:
            proxy_settings = self.config.get_proxy_settings()
            lut_path = proxy_settings.get("lut_path")

        try:
            self.session_manager.start_session(
                project_id=project_id,
                production_day_id=production_day_id,
                lut_path=lut_path,
                lut_enabled=lut_enabled,
            )
            self._update_session_ui()
        except ValueError as e:
            self._show_error("Session Error", str(e))

    def _cancel_session(self):
        """Cancel the current session."""
        reply = QMessageBox.question(
            self,
            "Cancel Session",
            "Are you sure you want to cancel the session?\n\n"
            "All offloaded cards will remain on disk, but they won't\n"
            "be uploaded automatically.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            self.session_manager.cancel_session()
            self._update_session_ui()

    def _update_session_ui(self):
        """Update UI based on session state."""
        session = self.session_manager.get_active_session()

        if session and session.status in ("active", "pending_upload"):
            count = len(session.manifest_ids)
            self.session_status.setText(f"Session active: {count} card(s) offloaded")
            self.session_status.setStyleSheet(f"color: {COLORS['green']};")

            self.start_session_btn.setVisible(False)
            self.end_session_upload.setVisible(True)
            self.session_apply_lut.setVisible(True)
            self.cancel_session_btn.setVisible(True)

            # Restore LUT checkbox state
            self.session_apply_lut.setChecked(session.lut_enabled)

        elif session and session.status == "uploading":
            self.session_status.setText("Overnight upload in progress...")
            self.session_status.setStyleSheet(f"color: {COLORS['orange']};")

            self.start_session_btn.setVisible(False)
            self.end_session_upload.setVisible(False)
            self.session_apply_lut.setVisible(False)
            self.cancel_session_btn.setVisible(True)

        else:
            self.session_status.setText("No active session")
            self.session_status.setStyleSheet(f"color: {COLORS['muted-gray']};")

            self.start_session_btn.setVisible(True)
            self.end_session_upload.setVisible(False)
            self.end_session_upload.setChecked(False)
            self.session_apply_lut.setVisible(False)
            self.cancel_session_btn.setVisible(False)

    def _add_manifest_to_session(self):
        """Add the current manifest to the active session."""
        if self.current_manifest and self.session_manager.has_active_session():
            self.session_manager.add_manifest(self.current_manifest.local_id)
            self._update_session_ui()

    def _start_overnight_upload(self):
        """Start the overnight upload worker."""
        # Update LUT settings before starting
        lut_enabled = self.session_apply_lut.isChecked()
        lut_path = None
        if lut_enabled:
            proxy_settings = self.config.get_proxy_settings()
            lut_path = proxy_settings.get("lut_path")

        self.session_manager.set_lut_settings(lut_path, lut_enabled)

        # Create and start the worker
        self.overnight_worker = OvernightUploadWorker(
            session_manager=self.session_manager,
            config=self.config,
        )

        # Connect signals
        self.overnight_worker.status_message.connect(self._on_overnight_status)
        self.overnight_worker.speed_test_completed.connect(self._on_speed_test_completed)
        self.overnight_worker.proxy_progress.connect(self._on_overnight_proxy_progress)
        self.overnight_worker.upload_progress.connect(self._on_overnight_upload_progress)
        self.overnight_worker.workflow_completed.connect(self._on_overnight_completed)

        # Update UI
        self.progress_label.setText("Starting overnight upload...")
        self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
        self.progress_bar.setValue(0)
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)

        self._update_session_ui()
        self.overnight_worker.start()

    def _on_overnight_status(self, message: str):
        """Handle overnight worker status updates."""
        self.progress_label.setText(message)

    def _on_speed_test_completed(self, speed_mbps: float, resolution: str):
        """Handle speed test completion."""
        res_name = "1080p" if "1920" in resolution else "720p"
        self.file_label.setText(f"Speed: {speed_mbps:.1f} Mbps - Using {res_name} proxies")

    def _on_overnight_proxy_progress(self, current: int, total: int, filename: str):
        """Handle proxy generation progress."""
        percent = int((current / total) * 50) if total > 0 else 0  # First 50%
        self.progress_bar.setValue(percent)
        self.file_label.setText(f"Generating proxy [{current}/{total}]: {filename}")

    def _on_overnight_upload_progress(self, current: int, total: int, filename: str):
        """Handle upload progress."""
        percent = 50 + int((current / total) * 50) if total > 0 else 50  # Last 50%
        self.progress_bar.setValue(percent)
        self.file_label.setText(f"Uploading [{current}/{total}]: {filename}")

    def _on_overnight_completed(self, success: bool, message: str, stats: dict):
        """Handle overnight upload completion."""
        if success:
            self.progress_label.setText(f"✓ {message}")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']};")
            self.progress_bar.setValue(100)

            # Show stats
            proxies = stats.get("proxies_uploaded", 0)
            total_mb = stats.get("total_mb_uploaded", 0)
            duration = stats.get("total_duration_minutes", 0)
            self.file_label.setText(
                f"Uploaded {proxies} proxies ({total_mb:.1f} MB) in {duration:.0f} minutes"
            )
        else:
            self.progress_label.setText(f"✗ {message}")
            self.progress_label.setStyleSheet(f"color: {COLORS['red']};")

        self._reset_ui_after_offload()
        self._update_session_ui()
        self.overnight_worker = None

    def showEvent(self, event):
        """Handle show event to refresh drives and projects."""
        super().showEvent(event)
        self.refresh_drives()
        self.refresh_projects()
        self._update_session_ui()
