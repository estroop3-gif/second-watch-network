"""
Offload page - Main workflow for offloading footage.
Redesigned with multi-source queue and flexible destinations.
"""
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QFrame, QProgressBar, QSplitter, QMessageBox,
    QDialog, QTextBrowser, QSpinBox, QCheckBox
)
from PyQt6.QtCore import Qt, pyqtSignal

from src.services.config import ConfigManager
from src.services.card_reader import CardReader
from src.services.card_fingerprint import CardFingerprintService
from src.services.offload_manifest import OffloadManifestService, OffloadManifest
from src.services.offload_worker import OffloadWorker, format_bytes
from src.services.robust_offload_worker import (
    RobustOffloadWorker, OffloadJournal, RobustFileEntry,
    DestinationCopy, export_manifest_for_audit, get_pending_journals
)
from src.services.session_manager import SessionManager
from src.services.overnight_worker import OvernightUploadWorker

from src.models.offload_models import (
    OffloadSource, OffloadQueue, NamingConvention, BacklotLinkConfig, PreFlightCheck
)
from src.ui.widgets.source_queue import SourceQueueWidget
from src.ui.widgets.destination_panel import DestinationPanelWidget
from src.ui.dialogs.naming_convention_dialog import NamingConventionDialog
from src.ui.dialogs.backlot_link_dialog import BacklotLinkDialog
from src.ui.dialogs.offload_options_dialog import OffloadOptionsDialog
from src.ui.dialogs.preflight_dialog import PreFlightDialog
from src.ui.styles import COLORS


class OffloadPage(QWidget):
    """Offload page for copying footage from cards."""

    # Signal emitted when files are ready for upload
    # Args: (file_paths: list[str], manifest_id: str)
    files_ready_for_upload = pyqtSignal(list, str)

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.card_reader = CardReader()
        self.fingerprint_service = CardFingerprintService()
        self.manifest_service = OffloadManifestService(config)
        self.session_manager = SessionManager.get_instance()

        # State
        self.worker: Optional[OffloadWorker] = None
        self.robust_worker: Optional[RobustOffloadWorker] = None
        self.overnight_worker: Optional[OvernightUploadWorker] = None
        self.current_manifest: Optional[OffloadManifest] = None
        self.current_journal: Optional[OffloadJournal] = None
        self.current_source_index: int = 0
        self.all_manifests: List[OffloadManifest] = []
        self.all_journals: List[OffloadJournal] = []
        self.use_robust_offload: bool = True  # Use new robust worker by default

        # Settings
        self.naming_convention = NamingConvention.from_dict(
            config.get_naming_convention()
        )
        self.backlot_link = BacklotLinkConfig.from_dict(
            config.get_backlot_link()
        )
        self.offload_options = {
            "verify_checksum": True,
            "generate_mhl": True,
            "mhl_format": "standard",  # "standard" or "asc"
            "generate_proxy": True,
            "upload_cloud": True,
            "create_footage_asset": False,
        }

        self._setup_ui()
        self._connect_signals()

        # Check for pending/interrupted offloads on startup
        self._check_pending_offloads()

    def _setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Header
        header = self._create_header()
        layout.addLayout(header)

        # Main content - splitter with source and destination panels
        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.setHandleWidth(6)
        splitter.setChildrenCollapsible(False)

        # Left panel - Source Queue
        left_panel = self._create_source_panel()
        left_panel.setMinimumWidth(300)
        splitter.addWidget(left_panel)

        # Right panel - Destination & Options
        right_panel = self._create_options_panel()
        right_panel.setMinimumWidth(300)
        splitter.addWidget(right_panel)

        splitter.setSizes([1, 1])
        layout.addWidget(splitter, 1)

        # Bottom - Progress and actions
        actions = self._create_actions_panel()
        layout.addWidget(actions)

    def _create_header(self) -> QHBoxLayout:
        """Create the page header."""
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

        # Refresh button
        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self._refresh_all)
        refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(refresh_btn)

        return header

    def _create_source_panel(self) -> QFrame:
        """Create the source queue panel with options and session controls."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Title
        title = QLabel("SOURCE QUEUE")
        title.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        layout.addWidget(title)

        # Source queue widget (takes available space)
        self.source_queue = SourceQueueWidget()
        self.source_queue.queue_changed.connect(self._on_queue_changed)
        self.source_queue.setMinimumHeight(150)
        layout.addWidget(self.source_queue, 1)

        # Separator
        self._add_separator(layout)

        # Options & Backlot - Two CTA buttons
        buttons_row = QHBoxLayout()
        buttons_row.setSpacing(8)

        # Options button
        self.options_btn = QPushButton("Options...")
        self.options_btn.setMinimumHeight(40)
        self.options_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.options_btn.clicked.connect(self._open_options_dialog)
        self.options_btn.setStyleSheet(f"""
            QPushButton {{
                font-size: 13px;
                font-weight: bold;
                padding: 10px 16px;
            }}
        """)
        buttons_row.addWidget(self.options_btn)

        # Backlot link button
        self.link_backlot_btn = QPushButton("Link to Backlot...")
        self.link_backlot_btn.setMinimumHeight(40)
        self.link_backlot_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.link_backlot_btn.clicked.connect(self._open_backlot_dialog)
        self.link_backlot_btn.setStyleSheet(f"""
            QPushButton {{
                font-size: 13px;
                font-weight: bold;
                padding: 10px 16px;
            }}
        """)
        buttons_row.addWidget(self.link_backlot_btn)

        layout.addLayout(buttons_row)

        # Options summary
        self.options_summary = QLabel("")
        self.options_summary.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 11px;
        """)
        layout.addWidget(self.options_summary)

        # Backlot link summary
        self.backlot_summary = QLabel("")
        self.backlot_summary.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 11px;
        """)
        layout.addWidget(self.backlot_summary)

        # Separator
        self._add_separator(layout)

        # Session controls (compact)
        session_header = QHBoxLayout()
        session_header.setSpacing(8)

        session_label = QLabel("SESSION")
        session_label.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        session_header.addWidget(session_label)

        self.session_status = QLabel("No active session")
        self.session_status.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        session_header.addWidget(self.session_status)

        session_header.addStretch()

        layout.addLayout(session_header)

        # Session buttons row
        session_btns = QHBoxLayout()
        session_btns.setSpacing(8)

        self.start_session_btn = QPushButton("Start Session")
        self.start_session_btn.setMinimumHeight(32)
        self.start_session_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.start_session_btn.clicked.connect(self._start_session)
        session_btns.addWidget(self.start_session_btn)

        self.cancel_session_btn = QPushButton("Cancel")
        self.cancel_session_btn.setMinimumHeight(32)
        self.cancel_session_btn.setObjectName("danger-button")
        self.cancel_session_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_session_btn.clicked.connect(self._cancel_session)
        self.cancel_session_btn.setVisible(False)
        session_btns.addWidget(self.cancel_session_btn)

        session_btns.addStretch()

        layout.addLayout(session_btns)

        self.end_session_upload = QCheckBox("End Session + Upload")
        self.end_session_upload.setVisible(False)
        self.end_session_upload.setStyleSheet(f"font-size: 12px;")
        layout.addWidget(self.end_session_upload)

        return panel

    def _create_options_panel(self) -> QFrame:
        """Create the destination and naming panel (right side)."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Destination drives
        self.destination_panel = DestinationPanelWidget()
        self.destination_panel.destinations_changed.connect(self._on_destinations_changed)
        layout.addWidget(self.destination_panel)

        # Separator
        self._add_separator(layout)

        # Naming Convention section
        naming_header = QHBoxLayout()
        naming_header.setSpacing(8)

        naming_label = QLabel("NAMING")
        naming_label.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        naming_header.addWidget(naming_label)

        naming_header.addStretch()

        self.configure_naming_btn = QPushButton("Configure...")
        self.configure_naming_btn.setMinimumHeight(32)
        self.configure_naming_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.configure_naming_btn.clicked.connect(self._open_naming_dialog)
        self.configure_naming_btn.setStyleSheet(f"""
            QPushButton {{
                font-size: 12px;
                font-weight: bold;
                padding: 6px 12px;
            }}
        """)
        naming_header.addWidget(self.configure_naming_btn)

        layout.addLayout(naming_header)

        # Naming preview
        self.naming_preview = QLabel("")
        self.naming_preview.setStyleSheet(f"""
            font-family: 'SF Mono', 'Consolas', monospace;
            font-size: 11px;
            color: {COLORS['accent-yellow']};
            background-color: {COLORS['charcoal-dark']};
            padding: 10px;
            border-radius: 6px;
        """)
        self.naming_preview.setWordWrap(True)
        layout.addWidget(self.naming_preview)

        # Day number input
        day_row = QHBoxLayout()
        day_row.setSpacing(8)

        day_label = QLabel("Day #:")
        day_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")
        day_row.addWidget(day_label)

        self.day_number_spin = QSpinBox()
        self.day_number_spin.setRange(1, 999)
        self.day_number_spin.setValue(1)
        self.day_number_spin.valueChanged.connect(self._update_naming_preview)
        self.day_number_spin.setFixedWidth(70)
        self.day_number_spin.setMinimumHeight(32)
        day_row.addWidget(self.day_number_spin)

        day_row.addStretch()
        layout.addLayout(day_row)

        layout.addStretch()

        # Initialize UI state
        self._update_naming_preview()
        self._update_options_summary()
        self._update_backlot_summary()
        self._update_session_ui()

        return panel

    def _create_actions_panel(self) -> QFrame:
        """Create the actions/progress panel."""
        panel = QFrame()
        panel.setObjectName("card")
        panel.setMaximumHeight(120)

        layout = QVBoxLayout(panel)
        layout.setContentsMargins(12, 8, 12, 8)
        layout.setSpacing(6)

        # Progress row
        progress_row = QHBoxLayout()
        progress_row.setSpacing(10)

        self.progress_label = QLabel("Ready to offload")
        self.progress_label.setObjectName("label-muted")
        self.progress_label.setMinimumWidth(200)
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

        # Safe-to-format indicator (hidden by default)
        self.safe_to_format_label = QLabel("")
        self.safe_to_format_label.setVisible(False)
        bottom_row.addWidget(self.safe_to_format_label)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("danger-button")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self._cancel_offload)
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.setMinimumWidth(80)
        bottom_row.addWidget(self.cancel_btn)

        self.start_btn = QPushButton("Start Offload")
        self.start_btn.setObjectName("primary-button")
        self.start_btn.clicked.connect(self._start_offload)
        self.start_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        bottom_row.addWidget(self.start_btn)

        layout.addLayout(bottom_row)

        return panel

    def _add_separator(self, layout: QVBoxLayout):
        """Add a visual separator line."""
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

    def _connect_signals(self):
        """Connect internal signals."""
        pass  # Signals connected in _setup_ui

    # === UI Update Methods ===

    def _on_queue_changed(self):
        """Handle source queue changes."""
        # Update destination space requirements
        total_size = self.source_queue.get_queue().total_size
        self.destination_panel.set_required_space(total_size)
        self._update_naming_preview()

    def _on_destinations_changed(self):
        """Handle destination changes."""
        pass  # Could validate space here

    def _update_options_summary(self):
        """Update the options summary label."""
        summary = OffloadOptionsDialog.get_summary(self.offload_options)
        self.options_summary.setText(f"Options: {summary}")

    def _update_naming_preview(self):
        """Update the naming convention preview."""
        sources = self.source_queue.get_sources()
        day_number = self.day_number_spin.value()

        if not sources:
            # Show example preview
            preview_lines = self.naming_convention.get_preview(
                [],
                datetime.now(),
                day_number
            )
            # Add example subfolders
            parent = self.naming_convention.build_parent_folder(datetime.now(), day_number)
            preview_text = f"{parent}/\n  {self.naming_convention.camera_prefix}A/\n  {self.naming_convention.camera_prefix}B/\n  {self.naming_convention.audio_folder_name}/"
        else:
            preview_lines = self.naming_convention.get_preview(
                sources,
                datetime.now(),
                day_number
            )
            preview_text = "\n".join(preview_lines)

        self.naming_preview.setText(preview_text)

    def _update_backlot_summary(self):
        """Update the Backlot link summary."""
        if self.backlot_link.enabled:
            summary = self.backlot_link.get_summary()
            self.backlot_summary.setText(f"Linked: {summary}")
        else:
            self.backlot_summary.setText("Not linked to Backlot")

    def _update_session_ui(self):
        """Update UI based on session state."""
        session = self.session_manager.get_active_session()

        if session and session.status in ("active", "pending_upload"):
            count = len(session.manifest_ids)
            self.session_status.setText(f"Session active: {count} card(s) offloaded")
            self.session_status.setStyleSheet(f"color: {COLORS['green']}; font-size: 12px;")

            self.start_session_btn.setVisible(False)
            self.end_session_upload.setVisible(True)
            self.cancel_session_btn.setVisible(True)
        else:
            self.session_status.setText("No active session")
            self.session_status.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 12px;")

            self.start_session_btn.setVisible(True)
            self.end_session_upload.setVisible(False)
            self.cancel_session_btn.setVisible(False)

    # === Dialog Methods ===

    def _open_naming_dialog(self):
        """Open the naming convention configuration dialog."""
        current_settings = self.naming_convention.to_dict()
        dialog = NamingConventionDialog(current_settings, self)

        if dialog.exec() == QDialog.DialogCode.Accepted:
            settings = dialog.get_settings()
            self.naming_convention = NamingConvention.from_dict(settings)
            self.config.set_naming_convention(settings)
            self._update_naming_preview()

    def _open_options_dialog(self):
        """Open the offload options configuration dialog."""
        dialog = OffloadOptionsDialog(self.offload_options, self)

        if dialog.exec() == QDialog.DialogCode.Accepted:
            self.offload_options = dialog.get_settings()
            self._update_options_summary()

    def _open_backlot_dialog(self):
        """Open the Backlot link configuration dialog."""
        current_settings = self.backlot_link.to_dict()
        dialog = BacklotLinkDialog(self.config, current_settings, self)

        if dialog.exec() == QDialog.DialogCode.Accepted:
            settings = dialog.get_settings()
            self.backlot_link = BacklotLinkConfig.from_dict(settings)
            self.config.set_backlot_link(settings)
            self._update_backlot_summary()

    def _show_how_to(self):
        """Show instructions for using the offload tab."""
        instructions = f"""
<style>
    body {{ color: {COLORS['bone-white']}; font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.6; }}
    h2 {{ color: {COLORS['accent-yellow']}; font-size: 18px; border-bottom: 1px solid {COLORS['border-gray']}; padding-bottom: 8px; }}
    h3 {{ color: {COLORS['bone-white']}; font-size: 14px; margin-top: 20px; }}
    b {{ color: {COLORS['accent-yellow']}; }}
</style>

<h2>How to Use the Offload Tab</h2>

<h3>1. Adding Sources</h3>
<ul>
<li><b>Add Card:</b> Select a mounted camera card from the drive picker</li>
<li><b>Add Folder:</b> Browse to any folder containing media files</li>
<li>Add multiple sources - they will be offloaded in sequence</li>
<li>Toggle between Camera/Audio for each source if auto-detection is wrong</li>
<li>Sources are labeled automatically (CamA, CamB, etc.)</li>
</ul>

<h3>2. Setting Destinations</h3>
<ul>
<li><b>Primary Drive:</b> Required - select from dropdown or browse</li>
<li><b>Backup Drives:</b> Click "+ Add Drive" for redundant copies</li>
<li>All files are copied to all destinations simultaneously</li>
<li>Free space is shown for each drive</li>
</ul>

<h3>3. Naming Convention</h3>
<ul>
<li>Click <b>Configure...</b> to customize folder naming</li>
<li>Options: date format, project code, day prefix, separator</li>
<li>Preview shows the exact structure: <i>12272025_SFG_Day1/CamA/</i></li>
<li>Each camera gets a subfolder, audio gets its own folder</li>
</ul>

<h3>4. Options</h3>
<ul>
<li>Click <b>Options...</b> to configure offload settings</li>
<li><b>Verify checksums:</b> Ensures files copied correctly (recommended)</li>
<li><b>Generate proxies:</b> Creates low-res versions for editing</li>
<li><b>Upload to cloud:</b> Queue files for Backlot upload</li>
<li><b>Create footage asset:</b> Auto-create asset in Backlot</li>
</ul>

<h3>5. Pre-Flight Confirmation</h3>
<ul>
<li>When you click <b>Start Offload</b>, a confirmation dialog appears</li>
<li>Shows exact folder structure that will be created on each drive</li>
<li><b>Warnings</b> appear if destination folders already exist</li>
<li>Displays total file count, size, and estimated copy time</li>
<li>Review and confirm before copying begins</li>
</ul>

<h3>6. Linking to Backlot</h3>
<ul>
<li>Enable "Upload to cloud" in Options first</li>
<li>Click <b>Link to Backlot...</b> to select project and production day</li>
<li>Choose destinations: Dailies, Assets, and/or Review</li>
</ul>

<h3>7. Overnight Sessions</h3>
<ul>
<li>Start a session at the beginning of your shoot day</li>
<li>Offload cards throughout the day - each is added to the session</li>
<li>On your last card, check "End Session + Upload When Complete"</li>
<li>The system will generate proxies and upload overnight</li>
</ul>
"""
        dialog = QDialog(self)
        dialog.setWindowTitle("How to Use Offload")
        dialog.setMinimumSize(550, 500)
        dialog.setStyleSheet(f"background-color: {COLORS['charcoal-black']};")

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(20, 20, 20, 20)

        text_browser = QTextBrowser()
        text_browser.setHtml(instructions)
        text_browser.setOpenExternalLinks(True)
        layout.addWidget(text_browser)

        close_btn = QPushButton("Got it!")
        close_btn.setObjectName("primary-button")
        close_btn.clicked.connect(dialog.accept)
        layout.addWidget(close_btn)

        dialog.exec()

    def _refresh_all(self):
        """Refresh drives and data."""
        self.destination_panel._refresh_drives()

    # === Session Methods ===

    def _start_session(self):
        """Start a new overnight upload session."""
        project_id = self.backlot_link.project_id if self.backlot_link.enabled else None
        production_day_id = self.backlot_link.production_day_id if self.backlot_link.enabled else None

        try:
            self.session_manager.start_session(
                project_id=project_id,
                production_day_id=production_day_id,
            )
            self._update_session_ui()
        except ValueError as e:
            QMessageBox.critical(self, "Session Error", str(e))

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

    # === Offload Methods ===

    def _start_offload(self):
        """Start the offload process for all queued sources."""
        # Validate sources
        sources = self.source_queue.get_sources()
        if not sources:
            self.progress_label.setText("Add at least one source to offload")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        # Validate destination
        if not self.destination_panel.has_primary():
            self.progress_label.setText("Select a primary destination drive")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        # Check space
        total_size = self.source_queue.get_queue().total_size
        if not self.destination_panel.has_enough_space(total_size):
            reply = QMessageBox.warning(
                self,
                "Low Disk Space",
                "One or more destination drives may not have enough space.\n\n"
                "Continue anyway?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.No:
                return

        # Run pre-flight check
        day_number = self.day_number_spin.value()
        destinations = self.destination_panel.get_drives()

        preflight = PreFlightCheck.analyze(
            sources=sources,
            destinations=destinations,
            naming=self.naming_convention,
            day_number=day_number,
        )

        # Show pre-flight confirmation dialog
        dialog = PreFlightDialog(preflight, self)
        if dialog.exec() != QDialog.DialogCode.Accepted:
            return  # User cancelled

        # Initialize offload state
        self.current_source_index = 0
        self.all_manifests = []

        # Update UI
        self.progress_label.setText(f"Starting offload of {len(sources)} source(s)...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)

        # Start first source
        self._offload_next_source()

    def _offload_next_source(self):
        """Offload the next source in the queue."""
        sources = self.source_queue.get_sources()

        if self.current_source_index >= len(sources):
            # All sources completed
            self._on_all_offloads_completed()
            return

        source = sources[self.current_source_index]
        day_number = self.day_number_spin.value()

        # Build destination paths
        destinations = []
        for drive in self.destination_panel.get_drives():
            dest_path = self.naming_convention.build_full_path(
                drive.path,
                source,
                datetime.now(),
                day_number
            )
            destinations.append(str(dest_path))

        # Create manifest
        project_id = self.backlot_link.project_id if self.backlot_link.enabled else None
        production_day_id = self.backlot_link.production_day_id if self.backlot_link.enabled else None

        # Convert files to dict format expected by manifest service
        files_data = []
        for f in source.files:
            try:
                stat = f.stat()
                files_data.append({
                    "name": f.name,
                    "path": str(f),
                    "size": stat.st_size,
                })
            except Exception:
                continue

        manifest = self.manifest_service.create_manifest(
            project_id=project_id,
            production_day_id=production_day_id,
            source_device=source.display_name,
            camera_label=source.camera_label,
            roll_name="",
            files=files_data,
            destination_paths=destinations,
            create_footage_asset=False,
        )

        self.current_manifest = manifest
        self.manifest_service.start_offload(manifest)
        self.all_manifests.append(manifest)

        # Update UI
        sources_total = len(sources)
        self.progress_label.setText(
            f"Source {self.current_source_index + 1}/{sources_total}: {source.display_name}"
        )

        if self.use_robust_offload:
            # Use the new robust offload worker with full data integrity
            self._start_robust_offload(source, destinations, files_data, project_id)
        else:
            # Use legacy offload worker
            self._start_legacy_offload(manifest, source, destinations)

    def _start_robust_offload(
        self,
        source,
        destinations: List[str],
        files_data: List[Dict],
        project_id: Optional[str]
    ):
        """Start offload using the robust worker with full integrity checks."""
        self.robust_worker = RobustOffloadWorker.create_new(
            source_path=str(source.path),
            destination_paths=destinations,
            files=files_data,
            project_id=project_id,
            camera_label=source.camera_label,
            roll_name="",
            verify_source=True,  # Re-read source to bypass OS cache
            generate_mhl=self.offload_options.get("generate_mhl", True),
            mhl_format=self.offload_options.get("mhl_format", "standard"),
        )

        self.current_journal = self.robust_worker.journal
        self.all_journals.append(self.current_journal)

        # Connect signals
        self.robust_worker.progress_updated.connect(self._on_progress_updated)
        self.robust_worker.file_progress.connect(self._on_file_progress)
        self.robust_worker.file_completed.connect(self._on_file_completed)
        self.robust_worker.offload_completed.connect(self._on_source_offload_completed)
        self.robust_worker.status_message.connect(self._on_status_message)
        self.robust_worker.phase_changed.connect(self._on_phase_changed)
        self.robust_worker.safe_to_format.connect(self._on_safe_to_format)

        # Start worker
        self.robust_worker.start()

    def _start_legacy_offload(self, manifest: OffloadManifest, source, destinations: List[str]):
        """Start offload using the legacy worker (fallback)."""
        self.worker = OffloadWorker(
            manifest=manifest,
            source_path=str(source.path),
            destinations=destinations,
            verify_checksums=self.offload_options.get("verify_checksum", True),
        )

        # Connect signals
        self.worker.progress_updated.connect(self._on_progress_updated)
        self.worker.file_progress.connect(self._on_file_progress)
        self.worker.file_completed.connect(self._on_file_completed)
        self.worker.offload_completed.connect(self._on_source_offload_completed)
        self.worker.status_message.connect(self._on_status_message)

        # Start worker
        self.worker.start()

    def _on_progress_updated(self, file_idx: int, total_files: int, filename: str):
        """Handle progress updates from worker."""
        sources = self.source_queue.get_sources()
        sources_total = len(sources)

        # Calculate overall progress
        sources_done = self.current_source_index
        source_progress = file_idx / total_files if total_files > 0 else 0
        overall_progress = ((sources_done + source_progress) / sources_total) * 100

        self.progress_bar.setValue(int(overall_progress))
        self.file_label.setText(f"[{file_idx}/{total_files}] {filename}")

    def _on_file_progress(self, bytes_copied: int, total_bytes: int):
        """Handle per-file byte progress updates."""
        if total_bytes > 0:
            percent = (bytes_copied / total_bytes) * 100
            copied_str = format_bytes(bytes_copied)
            total_str = format_bytes(total_bytes)
            current_text = self.file_label.text().split(' - ')[0]
            self.file_label.setText(f"{current_text} - {copied_str}/{total_str} ({percent:.0f}%)")

    def _on_file_completed(self, filename: str, success: bool, error_msg: str):
        """Handle file completion notification."""
        if not success:
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            self.progress_label.setText(f"Error: {error_msg}")

    def _on_status_message(self, message: str):
        """Handle status message updates."""
        sources = self.source_queue.get_sources()
        sources_total = len(sources)
        prefix = f"[{self.current_source_index + 1}/{sources_total}] "
        self.progress_label.setText(prefix + message)
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")

    def _on_phase_changed(self, phase: str):
        """Handle phase change in robust offload."""
        phase_labels = {
            "initializing": "Initializing...",
            "copying": "Copying files (atomic writes)...",
            "verifying": "Verifying checksums (SHA-256 + xxHash64)...",
            "complete": "Complete",
            "failed": "Failed",
        }
        label = phase_labels.get(phase, phase)
        self.file_label.setText(label)

    def _on_safe_to_format(self, is_safe: bool):
        """Handle safe-to-format signal from robust offload."""
        self.safe_to_format_label.setVisible(True)

        if is_safe:
            # Check if MHL was generated
            has_mhl = False
            if self.current_journal and self.current_journal.mhl_paths:
                has_mhl = len(self.current_journal.mhl_paths) > 0

            if has_mhl:
                self.safe_to_format_label.setText("SAFE TO FORMAT - 2+ copies + MHL verified")
            else:
                self.safe_to_format_label.setText("SAFE TO FORMAT - 2+ verified copies exist")

            self.safe_to_format_label.setStyleSheet(f"""
                color: {COLORS['green']};
                font-weight: bold;
                font-size: 12px;
                padding: 4px 8px;
                background-color: rgba(74, 222, 128, 0.1);
                border-radius: 4px;
            """)
        else:
            self.safe_to_format_label.setText("DO NOT FORMAT - verification incomplete")
            self.safe_to_format_label.setStyleSheet(f"""
                color: {COLORS['red']};
                font-weight: bold;
                font-size: 12px;
                padding: 4px 8px;
                background-color: rgba(248, 113, 113, 0.1);
                border-radius: 4px;
            """)

    def _on_source_offload_completed(self, success: bool, message: str, stats: dict):
        """Handle completion of a single source offload."""
        if success:
            if self.current_manifest:
                self.manifest_service.complete_offload(self.current_manifest)

            # Move to next source
            self.current_source_index += 1
            self._offload_next_source()
        else:
            # Failed - stop and show error
            self.progress_label.setText(f"Failed: {message}")
            self.progress_label.setStyleSheet(f"color: {COLORS['red']};")
            self._reset_ui_after_offload()

    def _on_all_offloads_completed(self):
        """Handle completion of all source offloads."""
        self.progress_label.setText(f"All {len(self.all_manifests)} sources offloaded successfully!")
        self.progress_label.setStyleSheet(f"color: {COLORS['green']};")
        self.progress_bar.setValue(100)

        # Export audit manifests for robust offloads
        if self.use_robust_offload and self.all_journals:
            self._export_audit_manifests()

        # Queue for upload if enabled
        if self.offload_options.get("upload_cloud", True) and not self.end_session_upload.isChecked():
            self._queue_all_for_upload()

        # Handle session end
        if self.end_session_upload.isChecked() and self.session_manager.has_active_session():
            self._start_overnight_upload()

        self._reset_ui_after_offload()

    def _export_audit_manifests(self):
        """Export human-readable audit manifests for all completed offloads."""
        manifests_dir = Path.home() / ".swn-dailies-helper" / "audit_manifests"
        manifests_dir.mkdir(parents=True, exist_ok=True)

        for journal in self.all_journals:
            try:
                manifest_path = export_manifest_for_audit(journal, manifests_dir)
                print(f"Audit manifest exported: {manifest_path}")
            except Exception as e:
                print(f"Failed to export audit manifest: {e}")

    def _queue_all_for_upload(self):
        """Queue all offloaded manifests for upload via unified upload page."""
        try:
            total_queued = 0

            for manifest in self.all_manifests:
                # Collect all file paths from the manifest
                file_paths = []
                for dest_path in manifest.destination_paths:
                    dest = Path(dest_path)
                    if dest.exists():
                        # Find all video files in the destination
                        for offloaded_file in manifest.files:
                            if offloaded_file.relative_path:
                                file_path = dest / offloaded_file.relative_path
                            else:
                                file_path = dest / offloaded_file.file_name

                            if file_path.exists():
                                file_paths.append(str(file_path))

                if file_paths:
                    # Emit signal with file paths and manifest ID
                    self.files_ready_for_upload.emit(file_paths, manifest.local_id)
                    total_queued += len(file_paths)

            if total_queued > 0:
                self.file_label.setText(f"{total_queued} files queued for upload")
        except Exception as e:
            print(f"Failed to queue files for upload: {e}")

    def _start_overnight_upload(self):
        """Start the overnight upload process."""
        # Check if there's an active session with files
        session = self.session_manager.get_active_session()
        if not session:
            QMessageBox.warning(
                self,
                "No Session",
                "No active offload session to upload.\n\n"
                "Offload files first to create a session."
            )
            return

        # Check if overnight worker already running
        if self.overnight_worker and self.overnight_worker.isRunning():
            QMessageBox.warning(
                self,
                "Already Running",
                "An overnight upload is already in progress."
            )
            return

        # Confirm start
        reply = QMessageBox.question(
            self,
            "Start Overnight Upload",
            "This will:\n\n"
            "1. Test your internet speed\n"
            "2. Generate optimized proxies\n"
            "3. Upload all files to Backlot\n\n"
            "This process can run overnight. Continue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.Yes
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        # Create and configure the worker
        self.overnight_worker = OvernightUploadWorker(
            session_manager=self.session_manager,
            config=self.config,
            parent=self
        )

        # Connect signals
        self.overnight_worker.status_message.connect(self._on_overnight_status)
        self.overnight_worker.speed_test_started.connect(self._on_speed_test_started)
        self.overnight_worker.speed_test_completed.connect(self._on_speed_test_completed)
        self.overnight_worker.proxy_started.connect(self._on_proxy_started)
        self.overnight_worker.proxy_progress.connect(self._on_proxy_progress)
        self.overnight_worker.upload_started.connect(self._on_upload_started)
        self.overnight_worker.upload_progress.connect(self._on_upload_progress)
        self.overnight_worker.workflow_completed.connect(self._on_overnight_completed)

        # Update UI
        self.progress_label.setText("Starting overnight upload...")
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)

        # Start the worker
        self.overnight_worker.start()

    def _on_overnight_status(self, message: str):
        """Handle overnight status updates."""
        self.progress_label.setText(message)

    def _on_speed_test_started(self):
        """Handle speed test start."""
        self.progress_label.setText("Testing internet speed...")
        self.progress_bar.setValue(0)

    def _on_speed_test_completed(self, speed_mbps: float, resolution: str):
        """Handle speed test completion."""
        self.progress_label.setText(f"Speed: {speed_mbps:.1f} Mbps - Using {resolution}")
        self.progress_bar.setValue(10)

    def _on_proxy_started(self, total_files: int):
        """Handle proxy generation start."""
        self.progress_label.setText(f"Generating proxies: 0/{total_files}")
        self.progress_bar.setMaximum(100)

    def _on_proxy_progress(self, current: int, total: int, filename: str):
        """Handle proxy generation progress."""
        self.progress_label.setText(f"Generating proxies: {current}/{total} - {filename}")
        # Proxies are 10-50% of progress
        progress = 10 + int((current / total) * 40)
        self.progress_bar.setValue(progress)

    def _on_upload_started(self, total_proxies: int):
        """Handle upload start."""
        self.progress_label.setText(f"Uploading: 0/{total_proxies}")

    def _on_upload_progress(self, current: int, total: int, filename: str):
        """Handle upload progress."""
        self.progress_label.setText(f"Uploading: {current}/{total} - {filename}")
        # Uploads are 50-100% of progress
        progress = 50 + int((current / total) * 50)
        self.progress_bar.setValue(progress)

    def _on_overnight_completed(self, success: bool, message: str, stats: dict):
        """Handle overnight workflow completion."""
        self.overnight_worker = None
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self.progress_bar.setValue(100 if success else 0)

        if success:
            self.progress_label.setText("Overnight upload complete!")
            # Show summary
            summary = (
                f"Overnight Upload Complete\n\n"
                f"Speed Test: {stats.get('speed_test_mbps', 0):.1f} Mbps\n"
                f"Resolution: {stats.get('resolution_used', 'N/A')}\n\n"
                f"Files: {stats.get('total_files', 0)}\n"
                f"Proxies Generated: {stats.get('proxies_generated', 0)}\n"
                f"Proxies Uploaded: {stats.get('proxies_uploaded', 0)}\n"
                f"Upload Size: {stats.get('total_mb_uploaded', 0):.1f} MB\n"
                f"Duration: {stats.get('total_duration_minutes', 0):.1f} minutes"
            )
            QMessageBox.information(self, "Upload Complete", summary)
        else:
            self.progress_label.setText(f"Upload failed: {message}")
            QMessageBox.warning(self, "Upload Failed", message)

    def _cancel_offload(self):
        """Cancel the current offload operation."""
        # Check if any worker is running
        worker_running = (
            (self.worker and self.worker.isRunning()) or
            (self.robust_worker and self.robust_worker.isRunning()) or
            (self.overnight_worker and self.overnight_worker.isRunning())
        )

        if worker_running:
            reply = QMessageBox.question(
                self,
                "Cancel Offload",
                "Are you sure you want to cancel?\n\n"
                "Partially copied files will be deleted.\n"
                "However, the operation can be resumed later.",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.Yes:
                self.progress_label.setText("Cancelling...")
                if self.worker:
                    self.worker.cancel()
                if self.robust_worker:
                    self.robust_worker.cancel()
                if self.overnight_worker:
                    self.overnight_worker.cancel()
        else:
            self._reset_ui_after_offload()

    def _reset_ui_after_offload(self):
        """Reset UI state after offload completes or is cancelled."""
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self.worker = None
        self.robust_worker = None
        self.overnight_worker = None
        self.current_manifest = None
        self.current_journal = None

    def _check_pending_offloads(self):
        """Check for interrupted offloads that can be resumed."""
        try:
            pending = get_pending_journals()
            if pending:
                # Show dialog to ask about resuming
                pending_info = []
                for journal_path in pending[:5]:  # Show max 5
                    try:
                        with open(journal_path) as f:
                            import json
                            data = json.load(f)
                        pending_info.append(
                            f"- {data.get('camera_label', 'Unknown')}: "
                            f"{len(data.get('files', []))} files, "
                            f"phase: {data.get('phase', 'unknown')}"
                        )
                    except:
                        continue

                if pending_info:
                    msg = (
                        f"Found {len(pending)} interrupted offload(s):\n\n"
                        + "\n".join(pending_info) +
                        "\n\nWould you like to resume them?"
                    )

                    reply = QMessageBox.question(
                        self,
                        "Resume Offloads?",
                        msg,
                        QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                        QMessageBox.StandardButton.Yes
                    )

                    if reply == QMessageBox.StandardButton.Yes:
                        self._resume_pending_offloads(pending)
        except Exception as e:
            print(f"Error checking pending offloads: {e}")

    def _resume_pending_offloads(self, journal_paths: List[Path]):
        """Resume interrupted offload operations."""
        if not journal_paths:
            return

        # Resume the first pending offload
        journal_path = journal_paths[0]

        try:
            self.robust_worker = RobustOffloadWorker.resume_from_journal(journal_path)
            self.current_journal = self.robust_worker.journal

            # Connect signals
            self.robust_worker.progress_updated.connect(self._on_progress_updated)
            self.robust_worker.file_progress.connect(self._on_file_progress)
            self.robust_worker.file_completed.connect(self._on_file_completed)
            self.robust_worker.offload_completed.connect(self._on_resume_completed)
            self.robust_worker.status_message.connect(self._on_status_message)
            self.robust_worker.phase_changed.connect(self._on_phase_changed)
            self.robust_worker.safe_to_format.connect(self._on_safe_to_format)

            # Update UI
            stats = self.current_journal.get_stats()
            self.progress_label.setText(
                f"Resuming offload: {stats['copied_files']}/{stats['total_files']} files"
            )
            self.start_btn.setEnabled(False)
            self.cancel_btn.setEnabled(True)

            # Start
            self.robust_worker.start()

        except Exception as e:
            QMessageBox.warning(
                self,
                "Resume Failed",
                f"Failed to resume offload: {e}"
            )

    def _on_resume_completed(self, success: bool, message: str, stats: dict):
        """Handle completion of a resumed offload."""
        if success:
            self.progress_label.setText(f"Resumed offload complete: {message}")
            self.progress_label.setStyleSheet(f"color: {COLORS['green']};")

            # Export audit manifest
            if self.current_journal:
                self._export_single_audit_manifest(self.current_journal)
        else:
            self.progress_label.setText(f"Resumed offload failed: {message}")
            self.progress_label.setStyleSheet(f"color: {COLORS['red']};")

        self._reset_ui_after_offload()

        # Check for more pending offloads
        pending = get_pending_journals()
        if pending:
            self._check_pending_offloads()

    def _export_single_audit_manifest(self, journal: OffloadJournal):
        """Export a single audit manifest."""
        manifests_dir = Path.home() / ".swn-dailies-helper" / "audit_manifests"
        manifests_dir.mkdir(parents=True, exist_ok=True)

        try:
            manifest_path = export_manifest_for_audit(journal, manifests_dir)
            print(f"Audit manifest exported: {manifest_path}")
        except Exception as e:
            print(f"Failed to export audit manifest: {e}")
