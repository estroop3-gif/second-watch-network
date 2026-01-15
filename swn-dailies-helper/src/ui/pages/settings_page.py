"""
Settings page - Configure proxy settings, paths, etc.
"""
import logging
from typing import Optional, Callable, TYPE_CHECKING
from datetime import date
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QComboBox,
    QGroupBox,
    QCheckBox,
    QSpinBox,
    QMessageBox,
    QLineEdit,
    QFileDialog,
    QDialog,
    QInputDialog,
    QScrollArea,
)
from PyQt6.QtCore import Qt

from src.services.config import ConfigManager
from src.services.project_api import ProjectAPIService
from src.ui.styles import COLORS

if TYPE_CHECKING:
    from src.services.connection_manager import ConnectionManager

logger = logging.getLogger("swn-helper")


class SettingsPage(QWidget):
    """Settings page for configuration."""

    def __init__(
        self,
        config: ConfigManager,
        connection_manager: "ConnectionManager",
        on_disconnect: Optional[Callable[[], None]] = None,
    ):
        super().__init__()
        self.config = config
        self.connection_manager = connection_manager
        self.project_api = ProjectAPIService(config)
        self.on_disconnect = on_disconnect
        self.setup_ui()

        # Connect to connection manager signals
        self.connection_manager.status_changed.connect(self._on_status_changed)

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Title
        title = QLabel("Settings")
        title.setObjectName("page-title")
        layout.addWidget(title)

        subtitle = QLabel("Configure proxy generation and connection settings")
        subtitle.setObjectName("page-subtitle")
        layout.addWidget(subtitle)

        layout.addSpacing(10)

        # Proxy Settings Card
        proxy_card = self.create_proxy_settings()
        layout.addWidget(proxy_card)

        # Project Folders Card
        folders_card = self.create_project_folders_settings()
        layout.addWidget(folders_card)

        # Connection Card
        conn_card = self.create_connection_settings()
        layout.addWidget(conn_card)

        # About Card
        about_card = self.create_about_settings()
        layout.addWidget(about_card)

        layout.addStretch()

        # Bottom buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        save_btn = QPushButton("Save Settings")
        save_btn.setObjectName("primary-button")
        save_btn.clicked.connect(self.save_settings)
        save_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def create_proxy_settings(self) -> QFrame:
        """Create proxy settings card."""
        card = QFrame()
        card.setObjectName("card")

        layout = QVBoxLayout(card)
        layout.setSpacing(15)

        title = QLabel("Proxy Generation")
        title.setObjectName("card-title")
        layout.addWidget(title)

        # Resolution
        res_layout = QHBoxLayout()
        res_label = QLabel("Resolution:")
        res_label.setFixedWidth(120)
        res_layout.addWidget(res_label)

        self.resolution = QComboBox()
        self.resolution.setMinimumWidth(200)
        self.resolution.addItems([
            "1920x1080 (1080p)",
            "1280x720 (720p)",
        ])
        # Load saved setting
        saved_res = self.config.get_proxy_settings().get("resolution", "1920x1080")
        for i in range(self.resolution.count()):
            if saved_res in self.resolution.itemText(i):
                self.resolution.setCurrentIndex(i)
                break
        res_layout.addWidget(self.resolution, 1)
        layout.addLayout(res_layout)

        # Bitrate
        bit_layout = QHBoxLayout()
        bit_label = QLabel("Bitrate (Mbps):")
        bit_label.setFixedWidth(120)
        bit_layout.addWidget(bit_label)

        self.bitrate = QSpinBox()
        self.bitrate.setMinimumWidth(120)
        self.bitrate.setRange(5, 50)
        # Load saved setting
        saved_bitrate = self.config.get_proxy_settings().get("bitrate", "10M")
        try:
            self.bitrate.setValue(int(saved_bitrate.replace("M", "")))
        except (ValueError, AttributeError):
            self.bitrate.setValue(10)
        self.bitrate.setSuffix(" Mbps")
        bit_layout.addWidget(self.bitrate)
        bit_layout.addStretch()
        layout.addLayout(bit_layout)

        # Preset
        preset_layout = QHBoxLayout()
        preset_label = QLabel("Encoding Speed:")
        preset_label.setFixedWidth(120)
        preset_layout.addWidget(preset_label)

        self.preset = QComboBox()
        self.preset.setMinimumWidth(200)
        self.preset.addItems([
            "Ultrafast (lowest quality)",
            "Fast (recommended)",
            "Medium (slower)",
            "Slow (best quality)",
        ])
        self.preset.setCurrentIndex(1)  # Default to fast
        preset_layout.addWidget(self.preset, 1)
        layout.addLayout(preset_layout)

        # Separator
        layout.addSpacing(10)

        # LUT Settings
        lut_title = QLabel("Color Transform (LUT)")
        lut_title.setStyleSheet(f"font-weight: bold; color: {COLORS['bone-white']};")
        layout.addWidget(lut_title)

        # LUT Enable checkbox
        lut_enable_layout = QHBoxLayout()
        self.lut_enabled = QCheckBox("Apply LUT to proxies")
        saved_lut_enabled = self.config.get_proxy_settings().get("lut_enabled", False)
        self.lut_enabled.setChecked(saved_lut_enabled)
        self.lut_enabled.stateChanged.connect(self._on_lut_toggle)
        lut_enable_layout.addWidget(self.lut_enabled)
        lut_enable_layout.addStretch()
        layout.addLayout(lut_enable_layout)

        # LUT Path selection
        lut_path_layout = QHBoxLayout()
        lut_path_label = QLabel("LUT File:")
        lut_path_label.setFixedWidth(120)
        lut_path_layout.addWidget(lut_path_label)

        self.lut_path = QLineEdit()
        self.lut_path.setMinimumWidth(300)
        self.lut_path.setPlaceholderText("Select a .cube LUT file...")
        self.lut_path.setReadOnly(True)
        saved_lut_path = self.config.get_proxy_settings().get("lut_path", "")
        self.lut_path.setText(saved_lut_path)
        lut_path_layout.addWidget(self.lut_path, 1)

        self.lut_browse_btn = QPushButton("Browse...")
        self.lut_browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.lut_browse_btn.clicked.connect(self._browse_lut)
        lut_path_layout.addWidget(self.lut_browse_btn)

        layout.addLayout(lut_path_layout)

        # Update LUT widgets state
        self._on_lut_toggle()

        # LUT hint
        lut_hint = QLabel(
            "Apply a color lookup table (LUT) to convert camera log footage "
            "(S-Log3, LogC, etc.) to Rec.709 for viewing."
        )
        lut_hint.setObjectName("label-small")
        lut_hint.setWordWrap(True)
        layout.addWidget(lut_hint)

        layout.addSpacing(10)

        # Hint
        hint = QLabel(
            "Proxies are H.264 files optimized for web playback. "
            "Faster encoding uses more CPU but takes less time."
        )
        hint.setObjectName("label-small")
        hint.setWordWrap(True)
        layout.addWidget(hint)

        return card

    def create_project_folders_settings(self) -> QFrame:
        """Create project folders management card."""
        card = QFrame()
        card.setObjectName("card")

        layout = QVBoxLayout(card)
        layout.setSpacing(15)

        title = QLabel("Project Folders")
        title.setObjectName("card-title")
        layout.addWidget(title)

        # Description
        desc = QLabel(
            "Create folders in your Backlot project. These folders will appear "
            "in the web interface for organizing dailies, assets, and review content."
        )
        desc.setObjectName("label-small")
        desc.setWordWrap(True)
        layout.addWidget(desc)

        # Folder creation buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)

        # Create Dailies Day button
        dailies_btn = QPushButton("+ New Dailies Day")
        dailies_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        dailies_btn.clicked.connect(self._create_dailies_day)
        dailies_btn.setToolTip("Create a new production day for dailies")
        btn_layout.addWidget(dailies_btn)

        # Create Asset Folder button
        asset_btn = QPushButton("+ New Asset Folder")
        asset_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        asset_btn.clicked.connect(self._create_asset_folder)
        asset_btn.setToolTip("Create a new folder for assets")
        btn_layout.addWidget(asset_btn)

        # Create Review Folder button
        review_btn = QPushButton("+ New Review Folder")
        review_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        review_btn.clicked.connect(self._create_review_folder)
        review_btn.setToolTip("Create a new folder for review content")
        btn_layout.addWidget(review_btn)

        btn_layout.addStretch()
        layout.addLayout(btn_layout)

        # Note
        note = QLabel("You must be connected to a project to create folders.")
        note.setObjectName("label-small")
        note.setStyleSheet(f"color: {COLORS['muted-gray']}; font-style: italic;")
        layout.addWidget(note)

        return card

    def _create_dailies_day(self):
        """Create a new dailies day via dialog."""
        project_id = self.config.get_project_id()
        if not project_id:
            QMessageBox.warning(self, "No Project", "Please connect to a project first.")
            return

        # Get day label from user
        label, ok = QInputDialog.getText(
            self,
            "New Dailies Day",
            "Day label (e.g., 'Day 1', 'Pickup Day'):",
            QLineEdit.EchoMode.Normal,
            "Day 1"
        )

        if not ok or not label.strip():
            return

        # Get shoot date
        today = date.today().isoformat()
        shoot_date, ok = QInputDialog.getText(
            self,
            "Shoot Date",
            "Shoot date (YYYY-MM-DD):",
            QLineEdit.EchoMode.Normal,
            today
        )

        if not ok:
            return

        # Create via uploader service (has the endpoint)
        try:
            from src.services.uploader import UploaderService
            uploader = UploaderService(self.config)
            new_day = uploader.create_dailies_day(project_id, label.strip(), shoot_date)
            if new_day:
                QMessageBox.information(
                    self,
                    "Success",
                    f"Created dailies day: {label}\n\nThe folder will appear in Backlot's Dailies tab."
                )
                logger.info(f"Created dailies day: {new_day.get('id')}")
            else:
                QMessageBox.warning(self, "Error", "Failed to create dailies day.")
        except Exception as e:
            logger.error(f"Error creating dailies day: {e}")
            QMessageBox.critical(self, "Error", f"Failed to create day: {e}")

    def _create_asset_folder(self):
        """Create a new asset folder via dialog."""
        project_id = self.config.get_project_id()
        if not project_id:
            QMessageBox.warning(self, "No Project", "Please connect to a project first.")
            return

        # Get folder name from user
        name, ok = QInputDialog.getText(
            self,
            "New Asset Folder",
            "Folder name:",
            QLineEdit.EchoMode.Normal,
            "New Folder"
        )

        if not ok or not name.strip():
            return

        # Get folder type
        types = ["mixed", "audio", "3d", "graphics", "documents"]
        type_labels = ["Mixed", "Audio", "3D Assets", "Graphics", "Documents"]
        folder_type, ok = QInputDialog.getItem(
            self,
            "Folder Type",
            "Select folder type:",
            type_labels,
            0,
            False
        )

        if not ok:
            return

        # Map back to type value
        selected_type = types[type_labels.index(folder_type)]

        # Create via project API
        try:
            new_folder = self.project_api.create_asset_folder(
                project_id, name.strip(), selected_type
            )
            if new_folder:
                QMessageBox.information(
                    self,
                    "Success",
                    f"Created asset folder: {name}\n\nThe folder will appear in Backlot's Assets tab."
                )
                logger.info(f"Created asset folder: {new_folder.get('id')}")
            else:
                QMessageBox.warning(self, "Error", "Failed to create asset folder.")
        except Exception as e:
            logger.error(f"Error creating asset folder: {e}")
            QMessageBox.critical(self, "Error", f"Failed to create folder: {e}")

    def _create_review_folder(self):
        """Create a new review folder via dialog."""
        project_id = self.config.get_project_id()
        if not project_id:
            QMessageBox.warning(self, "No Project", "Please connect to a project first.")
            return

        # Get folder name from user
        name, ok = QInputDialog.getText(
            self,
            "New Review Folder",
            "Folder name:",
            QLineEdit.EchoMode.Normal,
            "New Folder"
        )

        if not ok or not name.strip():
            return

        # Create via project API
        try:
            new_folder = self.project_api.create_review_folder(project_id, name.strip())
            if new_folder:
                QMessageBox.information(
                    self,
                    "Success",
                    f"Created review folder: {name}\n\nThe folder will appear in Backlot's Review tab."
                )
                logger.info(f"Created review folder: {new_folder.get('id')}")
            else:
                QMessageBox.warning(self, "Error", "Failed to create review folder.")
        except Exception as e:
            logger.error(f"Error creating review folder: {e}")
            QMessageBox.critical(self, "Error", f"Failed to create folder: {e}")

    def create_connection_settings(self) -> QFrame:
        """Create connection settings card."""
        card = QFrame()
        card.setObjectName("card")

        layout = QVBoxLayout(card)
        layout.setSpacing(15)

        title = QLabel("Connection")
        title.setObjectName("card-title")
        layout.addWidget(title)

        # Connection status label
        self.project_label = QLabel("Not connected")
        layout.addWidget(self.project_label)

        # API Key info
        self.key_label = QLabel("No API key configured")
        self.key_label.setObjectName("label-small")
        layout.addWidget(self.key_label)

        # Disconnect button
        self.disconnect_btn = QPushButton("Disconnect")
        self.disconnect_btn.setObjectName("danger-button")
        self.disconnect_btn.clicked.connect(self.disconnect)
        self.disconnect_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(self.disconnect_btn, alignment=Qt.AlignmentFlag.AlignLeft)

        # Update display based on current state
        self._update_connection_display()

        return card

    def create_about_settings(self) -> QFrame:
        """Create about/licenses settings card."""
        card = QFrame()
        card.setObjectName("card")

        layout = QVBoxLayout(card)
        layout.setSpacing(15)

        title = QLabel("About")
        title.setObjectName("card-title")
        layout.addWidget(title)

        # Version info
        version_label = QLabel("SWN Dailies Helper v1.0.0")
        layout.addWidget(version_label)

        # Description
        desc_label = QLabel(
            "Desktop helper for Second Watch Network - offload footage, "
            "generate proxies, and upload to Backlot."
        )
        desc_label.setObjectName("label-small")
        desc_label.setWordWrap(True)
        layout.addWidget(desc_label)

        layout.addSpacing(10)

        # Open Source Licenses button
        licenses_btn = QPushButton("Open Source Licenses")
        licenses_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        licenses_btn.clicked.connect(self._show_licenses)
        layout.addWidget(licenses_btn, alignment=Qt.AlignmentFlag.AlignLeft)

        # License hint
        license_hint = QLabel(
            "View licenses and attributions for open source components "
            "including FFmpeg, MediaInfo, ExifTool, and more."
        )
        license_hint.setObjectName("label-small")
        license_hint.setWordWrap(True)
        layout.addWidget(license_hint)

        return card

    def _show_licenses(self):
        """Show the open source licenses dialog."""
        from src.ui.pages.licenses_page import LicensesPage

        dialog = QDialog(self)
        dialog.setWindowTitle("Open Source Licenses")
        dialog.setMinimumSize(900, 700)

        layout = QVBoxLayout(dialog)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(LicensesPage())

        dialog.exec()

    def _update_connection_display(self):
        """Update connection display based on connection manager state."""
        from src.services.connection_manager import ConnectionManager

        state = self.connection_manager.state
        details = self.connection_manager.details

        if state == ConnectionManager.STATE_CONNECTED:
            user = details.get("user", {})
            projects = details.get("projects", [])
            display_name = user.get("display_name") or user.get("email") or "User"
            self.project_label.setText(f"Connected as {display_name} ({len(projects)} projects)")
            self.project_label.setStyleSheet(f"color: {COLORS['green']};")
            self.disconnect_btn.setEnabled(True)

            api_key = self.config.get_api_key()
            if api_key:
                self.key_label.setText(f"Key: {api_key[:12]}...")
            else:
                self.key_label.setText("Key stored securely")

        elif state == ConnectionManager.STATE_ERROR:
            self.project_label.setText("Connection error")
            self.project_label.setStyleSheet(f"color: {COLORS['red']};")
            self.disconnect_btn.setEnabled(True)
            self.key_label.setText("Check connection details")

        else:
            self.project_label.setText("Not connected")
            self.project_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
            self.disconnect_btn.setEnabled(False)
            self.key_label.setText("No API key configured")

    def _on_status_changed(self, state: str, details: dict):
        """Handle connection status changes."""
        self._update_connection_display()

    def _on_lut_toggle(self):
        """Enable/disable LUT path selection based on checkbox."""
        enabled = self.lut_enabled.isChecked()
        self.lut_path.setEnabled(enabled)
        self.lut_browse_btn.setEnabled(enabled)

    def _browse_lut(self):
        """Open file dialog to select a LUT file."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select LUT File",
            "",
            "LUT Files (*.cube *.CUBE);;All Files (*)"
        )
        if file_path:
            self.lut_path.setText(file_path)

    def save_settings(self):
        """Save the current settings."""
        # Extract resolution value
        res_text = self.resolution.currentText()
        resolution = res_text.split(" ")[0]  # Get "1920x1080" from "1920x1080 (1080p)"

        # Extract preset value
        preset_text = self.preset.currentText().lower()
        if "ultrafast" in preset_text:
            preset = "ultrafast"
        elif "fast" in preset_text:
            preset = "fast"
        elif "medium" in preset_text:
            preset = "medium"
        else:
            preset = "slow"

        settings = {
            "resolution": resolution,
            "bitrate": f"{self.bitrate.value()}M",
            "preset": preset,
            "codec": "libx264",
            "enabled": True,
            "lut_enabled": self.lut_enabled.isChecked(),
            "lut_path": self.lut_path.text() if self.lut_enabled.isChecked() else "",
        }
        self.config.set_proxy_settings(settings)

        # Show confirmation
        QMessageBox.information(
            self,
            "Settings Saved",
            "Your settings have been saved successfully.",
        )

    def disconnect(self):
        """Disconnect from the current project."""
        reply = QMessageBox.question(
            self,
            "Disconnect",
            "Are you sure you want to disconnect?\n\n"
            "You will need to enter a new API key to reconnect.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            # Use connection manager to disconnect
            self.connection_manager.disconnect()

            # Call the callback
            if self.on_disconnect:
                self.on_disconnect()

    def showEvent(self, event):
        """Refresh settings when page is shown."""
        super().showEvent(event)
        # Refresh connection display
        self._update_connection_display()
