"""
Settings page - Configure proxy settings, paths, etc.
"""
from typing import Optional, Callable
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
)
from PyQt6.QtCore import Qt

from src.services.config import ConfigManager
from src.ui.styles import COLORS


class SettingsPage(QWidget):
    """Settings page for configuration."""

    def __init__(
        self,
        config: ConfigManager,
        on_disconnect: Optional[Callable[[], None]] = None,
    ):
        super().__init__()
        self.config = config
        self.on_disconnect = on_disconnect
        self.setup_ui()

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

        # Connection Card
        conn_card = self.create_connection_settings()
        layout.addWidget(conn_card)

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

    def create_connection_settings(self) -> QFrame:
        """Create connection settings card."""
        card = QFrame()
        card.setObjectName("card")

        layout = QVBoxLayout(card)
        layout.setSpacing(15)

        title = QLabel("Connection")
        title.setObjectName("card-title")
        layout.addWidget(title)

        # Project info
        project_id = self.config.get_project_id()
        if project_id:
            status_text = f"Connected to project: {project_id[:8]}..."
            status_color = COLORS["green"]
        else:
            status_text = "Not connected to any project"
            status_color = COLORS["muted-gray"]

        self.project_label = QLabel(status_text)
        self.project_label.setStyleSheet(f"color: {status_color};")
        layout.addWidget(self.project_label)

        # API Key info
        api_key = self.config.get_api_key()
        if api_key:
            key_preview = f"Key: {api_key[:12]}..."
        else:
            key_preview = "No API key configured"

        self.key_label = QLabel(key_preview)
        self.key_label.setObjectName("label-small")
        layout.addWidget(self.key_label)

        # Disconnect button
        if project_id:
            disconnect_btn = QPushButton("Disconnect from Project")
            disconnect_btn.setObjectName("danger-button")
            disconnect_btn.clicked.connect(self.disconnect)
            disconnect_btn.setCursor(Qt.CursorShape.PointingHandCursor)
            layout.addWidget(disconnect_btn, alignment=Qt.AlignmentFlag.AlignLeft)

        return card

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
            "Are you sure you want to disconnect from this project?\n\n"
            "You will need to enter a new API key to reconnect.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            self.config.clear_api_key()
            self.config.set("project_id", None)

            # Update UI
            self.project_label.setText("Not connected to any project")
            self.project_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
            self.key_label.setText("No API key configured")

            # Call the callback
            if self.on_disconnect:
                self.on_disconnect()

    def showEvent(self, event):
        """Refresh settings when page is shown."""
        super().showEvent(event)
        # Refresh connection status
        project_id = self.config.get_project_id()
        if project_id:
            self.project_label.setText(f"Connected to project: {project_id[:8]}...")
            self.project_label.setStyleSheet(f"color: {COLORS['green']};")
        else:
            self.project_label.setText("Not connected to any project")
            self.project_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
