"""
Offload page - Main workflow for offloading footage.
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
    QCheckBox,
    QSplitter,
    QMessageBox,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from pathlib import Path

from src.services.config import ConfigManager
from src.services.card_reader import CardReader
from src.services.card_fingerprint import CardFingerprintService
from src.ui.styles import COLORS


class OffloadPage(QWidget):
    """Offload page for copying footage from cards."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.card_reader = CardReader()
        self.fingerprint_service = CardFingerprintService()
        self.current_fingerprint = None
        self.setup_ui()

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        header = QHBoxLayout()

        title_container = QVBoxLayout()
        title = QLabel("Offload Footage")
        title.setObjectName("page-title")
        title_container.addWidget(title)

        subtitle = QLabel("Copy footage from camera cards with verification")
        subtitle.setObjectName("page-subtitle")
        title_container.addWidget(subtitle)

        header.addLayout(title_container)
        header.addStretch()

        # Refresh button in header
        refresh_btn = QPushButton("🔄  Refresh Drives")
        refresh_btn.clicked.connect(self.refresh_drives)
        refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(refresh_btn)

        layout.addLayout(header)

        # Main content - two panels
        content = QHBoxLayout()
        content.setSpacing(20)

        # Left panel - Source
        left = self.create_source_panel()
        content.addWidget(left, 1)

        # Right panel - Destinations and options
        right = self.create_destination_panel()
        content.addWidget(right, 1)

        layout.addLayout(content, 1)

        # Bottom - Progress and actions
        actions = self.create_actions_panel()
        layout.addWidget(actions)

    def create_source_panel(self) -> QFrame:
        """Create the source (camera card) panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        # Header
        label = QLabel("Source Card")
        label.setObjectName("card-title")
        layout.addWidget(label)

        hint = QLabel("Select a camera card to offload clips from")
        hint.setObjectName("label-small")
        layout.addWidget(hint)

        # Drive list
        self.drive_list = QListWidget()
        self.drive_list.itemSelectionChanged.connect(self.on_source_selected)
        layout.addWidget(self.drive_list, 1)

        # Clip info
        self.clip_info = QFrame()
        info_layout = QVBoxLayout(self.clip_info)
        info_layout.setContentsMargins(0, 10, 0, 0)

        self.clip_count = QLabel("No source selected")
        self.clip_count.setObjectName("label-muted")
        info_layout.addWidget(self.clip_count)

        self.clip_size = QLabel("")
        self.clip_size.setObjectName("label-small")
        info_layout.addWidget(self.clip_size)

        layout.addWidget(self.clip_info)

        return panel

    def create_destination_panel(self) -> QFrame:
        """Create the destination drives panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Destination")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Primary drive
        primary_label = QLabel("Primary Drive")
        primary_label.setObjectName("label-muted")
        layout.addWidget(primary_label)

        self.primary_drive = QComboBox()
        self.primary_drive.setPlaceholderText("Select primary drive...")
        layout.addWidget(self.primary_drive)

        # Backup drive
        backup_label = QLabel("Backup Drive (Recommended)")
        backup_label.setObjectName("label-muted")
        layout.addWidget(backup_label)

        self.backup_drive = QComboBox()
        self.backup_drive.addItem("None (skip backup)", None)
        layout.addWidget(self.backup_drive)

        # Separator
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

        # Options
        options_label = QLabel("Options")
        options_label.setObjectName("label-muted")
        layout.addWidget(options_label)

        self.verify_checksum = QCheckBox("Verify checksums after copy")
        self.verify_checksum.setChecked(True)
        self.verify_checksum.setToolTip("Calculate XXH64 checksums to verify file integrity")
        layout.addWidget(self.verify_checksum)

        self.generate_proxy = QCheckBox("Generate H.264 proxies")
        self.generate_proxy.setChecked(True)
        self.generate_proxy.setToolTip("Create 1080p H.264 proxies for web review")
        layout.addWidget(self.generate_proxy)

        self.upload_cloud = QCheckBox("Upload proxies to cloud")
        self.upload_cloud.setChecked(True)
        self.upload_cloud.setToolTip("Upload proxies to your Backlot project")
        layout.addWidget(self.upload_cloud)

        layout.addStretch()

        return panel

    def create_actions_panel(self) -> QFrame:
        """Create the actions/progress panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(12)

        # Current operation
        self.progress_label = QLabel("Ready to offload")
        self.progress_label.setObjectName("label-muted")
        layout.addWidget(self.progress_label)

        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)

        # File progress detail
        self.file_label = QLabel("")
        self.file_label.setObjectName("label-small")
        layout.addWidget(self.file_label)

        # Buttons
        btn_layout = QHBoxLayout()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("danger-button")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self.cancel_offload)
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.cancel_btn)

        btn_layout.addStretch()

        self.start_btn = QPushButton("Start Offload")
        self.start_btn.setObjectName("primary-button")
        self.start_btn.clicked.connect(self.start_offload)
        self.start_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.start_btn)

        layout.addLayout(btn_layout)

        return panel

    def refresh_drives(self):
        """Refresh the list of available drives."""
        self.drive_list.clear()
        self.primary_drive.clear()
        self.backup_drive.clear()
        self.backup_drive.addItem("None (skip backup)", None)

        self.clip_count.setText("Scanning drives...")
        self.clip_size.setText("")

        drives = self.card_reader.list_drives()

        if not drives:
            self.clip_count.setText("No drives detected")
            return

        for drive in drives:
            # Format display name
            name = drive.get("name", "Unknown")
            drive_type = drive.get("type", "")
            camera = drive.get("cameraType")

            if camera:
                display_name = f"📹  {name} — {camera} Card"
            elif drive_type == "removable":
                display_name = f"💾  {name} — Removable Drive"
            else:
                display_name = f"📁  {name} — {drive_type.title()}"

            # Add to source list
            item = QListWidgetItem(display_name)
            item.setData(Qt.ItemDataRole.UserRole, drive)
            self.drive_list.addItem(item)

            # Add to destination combos (only non-camera drives)
            if not camera:
                self.primary_drive.addItem(name, drive.get("path"))
                self.backup_drive.addItem(name, drive.get("path"))

        self.clip_count.setText("Select a source card")

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

        # Scan for clips
        path = Path(drive.get("path"))
        clips = self.card_reader.find_media_files(path)

        if clips:
            total_size = sum(c.get("size", 0) for c in clips)
            size_str = self.format_size(total_size)
            self.clip_count.setText(f"{len(clips)} clips found")
            self.clip_size.setText(f"Total size: {size_str}")

            # Compute fingerprint for duplicate detection
            self.current_fingerprint = self.fingerprint_service.compute_fingerprint(path)

            # Check for previous offload
            previous = self.fingerprint_service.check_previous_offload(
                self.current_fingerprint.fingerprint
            )
            if previous:
                self.clip_size.setText(
                    f"Total size: {size_str}\n"
                    f"⚠️ Previously offloaded on {previous.offload_timestamp.strftime('%Y-%m-%d %H:%M')}"
                )
        else:
            self.clip_count.setText("No clips found on this drive")
            self.clip_size.setText("")
            self.current_fingerprint = None

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def start_offload(self):
        """Start the offload process."""
        # Validate selections
        source_items = self.drive_list.selectedItems()
        if not source_items:
            self.progress_label.setText("⚠️  Please select a source card")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        if self.primary_drive.currentIndex() < 0:
            self.progress_label.setText("⚠️  Please select a destination drive")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        # Check for duplicate offload
        if self.current_fingerprint:
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

        # Update UI for offload
        self.progress_label.setText("Starting offload...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)

        # Get source and destination info
        source_drive = source_items[0].data(Qt.ItemDataRole.UserRole)
        source_path = Path(source_drive.get("path"))
        primary_path = self.primary_drive.currentData()
        backup_path = self.backup_drive.currentData()

        destinations = [primary_path]
        if backup_path:
            destinations.append(backup_path)

        # Store clips for offload
        self.clips_to_offload = self.card_reader.find_media_files(source_path)
        self.destinations = destinations
        self.verify_enabled = self.verify_checksum.isChecked()
        self.proxy_enabled = self.generate_proxy.isChecked()

        self.file_label.setText(f"Preparing {len(self.clips_to_offload)} clips...")

        # TODO: Start threaded offload worker
        # For now, show a placeholder
        self.progress_label.setText(f"Ready to offload {len(self.clips_to_offload)} clips to {len(destinations)} destination(s)")
        self.progress_bar.setValue(0)

    def cancel_offload(self):
        """Cancel the current offload operation."""
        self.progress_label.setText("Offload cancelled")
        self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self.file_label.setText("")

    def showEvent(self, event):
        """Handle show event to refresh drives."""
        super().showEvent(event)
        self.refresh_drives()
