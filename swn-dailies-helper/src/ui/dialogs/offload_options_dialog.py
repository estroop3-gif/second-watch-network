"""
Offload options configuration dialog.
"""
from typing import Optional

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QCheckBox, QGroupBox, QRadioButton, QButtonGroup
)

from src.ui.styles import COLORS


class OffloadOptionsDialog(QDialog):
    """Dialog for configuring offload options."""

    # Emitted when user saves changes
    options_saved = pyqtSignal(dict)

    def __init__(self, current_settings: Optional[dict] = None, parent=None):
        super().__init__(parent)
        self.current_settings = current_settings or {}

        self.setWindowTitle("Offload Options")
        self.setMinimumSize(400, 350)
        self.setModal(True)

        self._setup_ui()
        self._load_settings()

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # Title
        title = QLabel("Offload Options")
        title.setStyleSheet(f"""
            font-size: 20px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        layout.addWidget(title)

        # Subtitle
        subtitle = QLabel("Configure how files are processed during offload")
        subtitle.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 13px;")
        layout.addWidget(subtitle)

        # Verification section
        verify_group = QGroupBox("Verification")
        verify_layout = QVBoxLayout(verify_group)
        verify_layout.setSpacing(12)

        self.verify_checksum = QCheckBox("Verify checksums after copy")
        self.verify_checksum.setToolTip(
            "Calculate and compare checksums to ensure files copied correctly.\n"
            "Recommended for important footage."
        )
        verify_layout.addWidget(self.verify_checksum)

        self.generate_mhl = QCheckBox("Generate MHL manifest")
        self.generate_mhl.setToolTip(
            "Create an MHL (Media Hash List) file for industry-standard verification.\n"
            "MHL files can be used to verify footage integrity in post-production."
        )
        self.generate_mhl.toggled.connect(self._on_mhl_toggled)
        verify_layout.addWidget(self.generate_mhl)

        # MHL format options (indented under the checkbox)
        self.mhl_format_layout = QHBoxLayout()
        self.mhl_format_layout.setContentsMargins(24, 0, 0, 0)
        self.mhl_format_layout.setSpacing(20)

        self.mhl_format_group = QButtonGroup(self)
        self.mhl_standard = QRadioButton("Standard MHL")
        self.mhl_standard.setToolTip("Pomfort-compatible MHL format (widely supported)")
        self.mhl_asc = QRadioButton("ASC-MHL")
        self.mhl_asc.setToolTip("Modern ASC-MHL format with chain verification")

        self.mhl_format_group.addButton(self.mhl_standard, 0)
        self.mhl_format_group.addButton(self.mhl_asc, 1)

        self.mhl_format_layout.addWidget(self.mhl_standard)
        self.mhl_format_layout.addWidget(self.mhl_asc)
        self.mhl_format_layout.addStretch()
        verify_layout.addLayout(self.mhl_format_layout)

        layout.addWidget(verify_group)

        # Processing section
        process_group = QGroupBox("Processing")
        process_layout = QVBoxLayout(process_group)
        process_layout.setSpacing(12)

        self.generate_proxy = QCheckBox("Generate proxy files")
        self.generate_proxy.setToolTip(
            "Create smaller preview files for faster editing and review.\n"
            "Proxies are generated after upload completes."
        )
        process_layout.addWidget(self.generate_proxy)

        layout.addWidget(process_group)

        # Upload section
        upload_group = QGroupBox("Cloud Upload")
        upload_layout = QVBoxLayout(upload_group)
        upload_layout.setSpacing(12)

        self.upload_cloud = QCheckBox("Upload to cloud after offload")
        self.upload_cloud.setToolTip(
            "Queue files for upload to Backlot after offload completes.\n"
            "Configure destination in 'Link to Backlot'."
        )
        upload_layout.addWidget(self.upload_cloud)

        self.create_footage_asset = QCheckBox("Register as footage assets")
        self.create_footage_asset.setToolTip(
            "Create asset entries in Backlot's library for each clip.\n"
            "Makes footage searchable and organizable."
        )
        upload_layout.addWidget(self.create_footage_asset)

        layout.addWidget(upload_group)

        layout.addStretch()

        # Buttons
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.reject)

        self.save_btn = QPushButton("Save")
        self.save_btn.setObjectName("primary-button")
        self.save_btn.clicked.connect(self._on_save)

        buttons_layout.addStretch()
        buttons_layout.addWidget(self.cancel_btn)
        buttons_layout.addWidget(self.save_btn)

        layout.addLayout(buttons_layout)

        # Apply dark theme
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
            QLabel {{
                color: {COLORS['bone-white']};
            }}
            QGroupBox {{
                font-size: 14px;
                font-weight: bold;
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                margin-top: 12px;
                padding: 16px;
                padding-top: 28px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 8px;
            }}
            QCheckBox {{
                color: {COLORS['bone-white']};
                font-size: 13px;
            }}
            QRadioButton {{
                color: {COLORS['bone-white']};
                font-size: 12px;
            }}
            QRadioButton:disabled {{
                color: {COLORS['muted-gray']};
            }}
        """)

    def _on_mhl_toggled(self, checked: bool):
        """Enable/disable MHL format options based on checkbox state."""
        self.mhl_standard.setEnabled(checked)
        self.mhl_asc.setEnabled(checked)

    def _load_settings(self):
        """Load current settings into the UI."""
        self.verify_checksum.setChecked(self.current_settings.get("verify_checksum", True))
        self.generate_mhl.setChecked(self.current_settings.get("generate_mhl", True))

        # Load MHL format (default to standard)
        mhl_format = self.current_settings.get("mhl_format", "standard")
        if mhl_format == "asc":
            self.mhl_asc.setChecked(True)
        else:
            self.mhl_standard.setChecked(True)

        # Update radio button enabled state
        self._on_mhl_toggled(self.generate_mhl.isChecked())

        self.generate_proxy.setChecked(self.current_settings.get("generate_proxy", True))
        self.upload_cloud.setChecked(self.current_settings.get("upload_cloud", True))
        self.create_footage_asset.setChecked(self.current_settings.get("create_footage_asset", False))

    def _get_current_settings(self) -> dict:
        """Get current settings from UI."""
        return {
            "verify_checksum": self.verify_checksum.isChecked(),
            "generate_mhl": self.generate_mhl.isChecked(),
            "mhl_format": "asc" if self.mhl_asc.isChecked() else "standard",
            "generate_proxy": self.generate_proxy.isChecked(),
            "upload_cloud": self.upload_cloud.isChecked(),
            "create_footage_asset": self.create_footage_asset.isChecked(),
        }

    def _on_save(self):
        """Handle save button click."""
        settings = self._get_current_settings()
        self.options_saved.emit(settings)
        self.accept()

    def get_settings(self) -> dict:
        """Get the current settings (after dialog closes)."""
        return self._get_current_settings()

    @staticmethod
    def get_summary(settings: dict) -> str:
        """Get a summary string for the given settings."""
        parts = []
        if settings.get("verify_checksum", True):
            parts.append("Verify")
        if settings.get("generate_mhl", True):
            mhl_format = settings.get("mhl_format", "standard")
            parts.append("ASC-MHL" if mhl_format == "asc" else "MHL")
        if settings.get("generate_proxy", True):
            parts.append("Proxies")
        if settings.get("upload_cloud", True):
            parts.append("Upload")
        if settings.get("create_footage_asset", False):
            parts.append("Assets")

        if not parts:
            return "No options enabled"
        return ", ".join(parts)
