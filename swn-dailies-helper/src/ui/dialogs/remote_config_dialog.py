"""
Remote configuration dialog for cloud storage backends.

Supports Google Drive, Dropbox, OneDrive, S3, and SFTP configuration.
"""
from typing import Dict, Optional, Any

from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QLineEdit, QComboBox, QStackedWidget,
    QFormLayout, QMessageBox, QFileDialog, QCheckBox
)

from src.ui.styles import COLORS


REMOTE_TYPES = [
    ("drive", "Google Drive"),
    ("dropbox", "Dropbox"),
    ("onedrive", "OneDrive"),
    ("s3", "Amazon S3"),
    ("sftp", "SFTP"),
]

S3_PROVIDERS = [
    ("AWS", "Amazon Web Services"),
    ("Wasabi", "Wasabi"),
    ("Backblaze", "Backblaze B2"),
    ("DigitalOcean", "DigitalOcean Spaces"),
    ("Minio", "MinIO"),
    ("Other", "Other S3-Compatible"),
]


class OAuthWorker(QThread):
    """Background worker for OAuth authorization."""
    completed = pyqtSignal(bool, str)  # success, token_or_error

    def __init__(self, remote_type: str):
        super().__init__()
        self.remote_type = remote_type

    def run(self):
        try:
            from src.services.rclone_service import RcloneService
            service = RcloneService()
            success, result = service.authorize_oauth(self.remote_type)
            self.completed.emit(success, result)
        except Exception as e:
            self.completed.emit(False, str(e))


class RemoteConfigDialog(QDialog):
    """Dialog for configuring cloud storage remotes."""

    def __init__(self, remote_info: Optional[Dict[str, Any]] = None, parent=None):
        super().__init__(parent)
        self.remote_info = remote_info
        self.editing = remote_info is not None
        self.oauth_worker = None
        self.oauth_token = None

        self.setWindowTitle("Edit Remote" if self.editing else "Add Remote")
        self.setMinimumWidth(450)
        self.setModal(True)

        self._setup_ui()

        if self.editing:
            self._load_existing()

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Remote name
        name_frame = QFrame()
        name_layout = QFormLayout(name_frame)
        name_layout.setContentsMargins(0, 0, 0, 0)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g., my-gdrive, work-s3")
        if self.editing:
            self.name_input.setEnabled(False)
        name_layout.addRow("Remote Name:", self.name_input)

        layout.addWidget(name_frame)

        # Remote type
        type_frame = QFrame()
        type_layout = QFormLayout(type_frame)
        type_layout.setContentsMargins(0, 0, 0, 0)

        self.type_combo = QComboBox()
        for type_id, label in REMOTE_TYPES:
            self.type_combo.addItem(label, type_id)
        self.type_combo.currentIndexChanged.connect(self._on_type_changed)
        if self.editing:
            self.type_combo.setEnabled(False)
        type_layout.addRow("Type:", self.type_combo)

        layout.addWidget(type_frame)

        # Type-specific configuration stack
        self.config_stack = QStackedWidget()

        # Google Drive config
        self.drive_config = self._create_oauth_config("Google Drive")
        self.config_stack.addWidget(self.drive_config)

        # Dropbox config
        self.dropbox_config = self._create_oauth_config("Dropbox")
        self.config_stack.addWidget(self.dropbox_config)

        # OneDrive config
        self.onedrive_config = self._create_oauth_config("OneDrive")
        self.config_stack.addWidget(self.onedrive_config)

        # S3 config
        self.s3_config = self._create_s3_config()
        self.config_stack.addWidget(self.s3_config)

        # SFTP config
        self.sftp_config = self._create_sftp_config()
        self.config_stack.addWidget(self.sftp_config)

        layout.addWidget(self.config_stack)

        # Status
        self.status_label = QLabel("")
        self.status_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        layout.addWidget(self.status_label)

        layout.addStretch()

        # Buttons
        buttons = QHBoxLayout()
        buttons.setSpacing(12)

        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        buttons.addWidget(cancel_btn)

        buttons.addStretch()

        self.save_btn = QPushButton("Save")
        self.save_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['green']};
                color: white;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #1ea350;
            }}
        """)
        self.save_btn.clicked.connect(self._on_save)
        buttons.addWidget(self.save_btn)

        layout.addLayout(buttons)

        self._apply_styles()

    def _create_oauth_config(self, provider_name: str) -> QFrame:
        """Create OAuth configuration panel."""
        frame = QFrame()
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(0, 12, 0, 0)
        layout.setSpacing(12)

        # Instructions
        instructions = QLabel(
            f"Click the button below to authorize access to {provider_name}.\n"
            "This will open a browser window for authentication."
        )
        instructions.setWordWrap(True)
        instructions.setStyleSheet(f"color: {COLORS['muted-gray']};")
        layout.addWidget(instructions)

        # Authorize button
        auth_btn = QPushButton(f"Authorize with {provider_name}")
        auth_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['blue']};
                color: white;
                padding: 12px 24px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #2563eb;
            }}
        """)
        auth_btn.clicked.connect(self._on_authorize)
        layout.addWidget(auth_btn)

        # Status indicator
        status = QLabel("")
        status.setObjectName("oauth-status")
        layout.addWidget(status)

        layout.addStretch()
        return frame

    def _create_s3_config(self) -> QFrame:
        """Create S3 configuration panel."""
        frame = QFrame()
        layout = QFormLayout(frame)
        layout.setContentsMargins(0, 12, 0, 0)
        layout.setSpacing(12)

        # Provider
        self.s3_provider = QComboBox()
        for provider_id, label in S3_PROVIDERS:
            self.s3_provider.addItem(label, provider_id)
        self.s3_provider.currentIndexChanged.connect(self._on_s3_provider_changed)
        layout.addRow("Provider:", self.s3_provider)

        # Access Key
        self.s3_access_key = QLineEdit()
        self.s3_access_key.setPlaceholderText("AKIA...")
        layout.addRow("Access Key ID:", self.s3_access_key)

        # Secret Key
        self.s3_secret_key = QLineEdit()
        self.s3_secret_key.setEchoMode(QLineEdit.EchoMode.Password)
        self.s3_secret_key.setPlaceholderText("Secret access key")
        layout.addRow("Secret Access Key:", self.s3_secret_key)

        # Region
        self.s3_region = QLineEdit()
        self.s3_region.setText("us-east-1")
        layout.addRow("Region:", self.s3_region)

        # Endpoint (for S3-compatible)
        self.s3_endpoint = QLineEdit()
        self.s3_endpoint.setPlaceholderText("Leave empty for AWS")
        layout.addRow("Endpoint:", self.s3_endpoint)

        return frame

    def _create_sftp_config(self) -> QFrame:
        """Create SFTP configuration panel."""
        frame = QFrame()
        layout = QFormLayout(frame)
        layout.setContentsMargins(0, 12, 0, 0)
        layout.setSpacing(12)

        # Host
        self.sftp_host = QLineEdit()
        self.sftp_host.setPlaceholderText("hostname or IP")
        layout.addRow("Host:", self.sftp_host)

        # Port
        self.sftp_port = QLineEdit()
        self.sftp_port.setText("22")
        layout.addRow("Port:", self.sftp_port)

        # User
        self.sftp_user = QLineEdit()
        layout.addRow("Username:", self.sftp_user)

        # Auth type
        self.sftp_use_key = QCheckBox("Use SSH key authentication")
        self.sftp_use_key.toggled.connect(self._on_sftp_auth_changed)
        layout.addRow("", self.sftp_use_key)

        # Password
        self.sftp_password = QLineEdit()
        self.sftp_password.setEchoMode(QLineEdit.EchoMode.Password)
        self.sftp_password.setPlaceholderText("Password")
        layout.addRow("Password:", self.sftp_password)

        # Key file
        key_row = QHBoxLayout()
        self.sftp_key_file = QLineEdit()
        self.sftp_key_file.setPlaceholderText("~/.ssh/id_rsa")
        self.sftp_key_file.setEnabled(False)
        key_row.addWidget(self.sftp_key_file)

        browse_btn = QPushButton("Browse")
        browse_btn.clicked.connect(self._on_browse_key)
        key_row.addWidget(browse_btn)

        layout.addRow("Key File:", key_row)

        return frame

    def _apply_styles(self):
        """Apply styles to the dialog."""
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
            QLabel {{
                color: {COLORS['bone-white']};
            }}
            QLineEdit {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                padding: 8px 12px;
                border-radius: 4px;
            }}
            QLineEdit:disabled {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['muted-gray']};
            }}
            QComboBox {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                padding: 8px 12px;
                border-radius: 4px;
            }}
            QComboBox::drop-down {{
                border: none;
            }}
            QComboBox QAbstractItemView {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
            }}
            QPushButton {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                padding: 8px 16px;
                border-radius: 4px;
            }}
            QPushButton:hover {{
                background-color: {COLORS['border-gray']};
            }}
            QCheckBox {{
                color: {COLORS['bone-white']};
            }}
            QCheckBox::indicator {{
                width: 16px;
                height: 16px;
                border: 1px solid {COLORS['border-gray']};
                border-radius: 3px;
                background-color: {COLORS['charcoal-dark']};
            }}
            QCheckBox::indicator:checked {{
                background-color: {COLORS['accent-yellow']};
                border-color: {COLORS['accent-yellow']};
            }}
        """)

    def _on_type_changed(self, index: int):
        """Handle remote type change."""
        self.config_stack.setCurrentIndex(index)
        self.oauth_token = None
        self._update_oauth_status("")

    def _on_s3_provider_changed(self, index: int):
        """Handle S3 provider change."""
        provider = self.s3_provider.currentData()
        endpoints = {
            "Wasabi": "s3.wasabisys.com",
            "Backblaze": "s3.us-west-000.backblazeb2.com",
            "DigitalOcean": "nyc3.digitaloceanspaces.com",
        }
        self.s3_endpoint.setText(endpoints.get(provider, ""))

    def _on_sftp_auth_changed(self, checked: bool):
        """Handle SFTP auth type change."""
        self.sftp_password.setEnabled(not checked)
        self.sftp_key_file.setEnabled(checked)

    def _on_browse_key(self):
        """Browse for SSH key file."""
        home = str(Path.home()) if 'Path' in dir() else ""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select SSH Key",
            home,
            "All Files (*)"
        )
        if file_path:
            self.sftp_key_file.setText(file_path)

    def _on_authorize(self):
        """Start OAuth authorization."""
        remote_type = self.type_combo.currentData()
        self.status_label.setText("Opening browser for authorization...")
        self._update_oauth_status("Authorizing...")

        self.oauth_worker = OAuthWorker(remote_type)
        self.oauth_worker.completed.connect(self._on_oauth_completed)
        self.oauth_worker.start()

    def _on_oauth_completed(self, success: bool, result: str):
        """Handle OAuth completion."""
        self.oauth_worker = None

        if success:
            self.oauth_token = result
            self._update_oauth_status("Authorized successfully")
            self.status_label.setText("Authorization successful")
            self.status_label.setStyleSheet(f"color: {COLORS['green']};")
        else:
            self._update_oauth_status("Authorization failed")
            self.status_label.setText(f"Error: {result}")
            self.status_label.setStyleSheet(f"color: {COLORS['red']};")

    def _update_oauth_status(self, text: str):
        """Update OAuth status label in current config panel."""
        panel = self.config_stack.currentWidget()
        status = panel.findChild(QLabel, "oauth-status")
        if status:
            status.setText(text)

    def _load_existing(self):
        """Load existing remote configuration."""
        if not self.remote_info:
            return

        self.name_input.setText(self.remote_info.get("name", ""))

        remote_type = self.remote_info.get("type", "")
        for i in range(self.type_combo.count()):
            if self.type_combo.itemData(i) == remote_type:
                self.type_combo.setCurrentIndex(i)
                break

        config = self.remote_info.get("config", {})

        if remote_type == "s3":
            self.s3_access_key.setText(config.get("access_key_id", ""))
            self.s3_secret_key.setText(config.get("secret_access_key", ""))
            self.s3_region.setText(config.get("region", "us-east-1"))
            self.s3_endpoint.setText(config.get("endpoint", ""))
        elif remote_type == "sftp":
            self.sftp_host.setText(config.get("host", ""))
            self.sftp_port.setText(config.get("port", "22"))
            self.sftp_user.setText(config.get("user", ""))
        elif remote_type in ("drive", "dropbox", "onedrive"):
            if config.get("token"):
                self.oauth_token = config.get("token")
                self._update_oauth_status("Already authorized")

    def _on_save(self):
        """Save the remote configuration."""
        name = self.name_input.text().strip()
        if not name:
            QMessageBox.warning(self, "Validation", "Please enter a remote name")
            return

        # Validate name format
        if not name.replace("-", "").replace("_", "").isalnum():
            QMessageBox.warning(
                self, "Validation",
                "Remote name must contain only letters, numbers, hyphens, and underscores"
            )
            return

        remote_type = self.type_combo.currentData()
        config = {}

        if remote_type in ("drive", "dropbox", "onedrive"):
            if not self.oauth_token:
                QMessageBox.warning(
                    self, "Validation",
                    "Please authorize access before saving"
                )
                return
            config["token"] = self.oauth_token

        elif remote_type == "s3":
            access_key = self.s3_access_key.text().strip()
            secret_key = self.s3_secret_key.text().strip()

            if not access_key or not secret_key:
                QMessageBox.warning(
                    self, "Validation",
                    "Please enter access key and secret key"
                )
                return

            config["provider"] = self.s3_provider.currentData()
            config["access_key_id"] = access_key
            config["secret_access_key"] = secret_key
            config["region"] = self.s3_region.text().strip() or "us-east-1"
            if self.s3_endpoint.text().strip():
                config["endpoint"] = self.s3_endpoint.text().strip()

        elif remote_type == "sftp":
            host = self.sftp_host.text().strip()
            user = self.sftp_user.text().strip()

            if not host or not user:
                QMessageBox.warning(
                    self, "Validation",
                    "Please enter host and username"
                )
                return

            config["host"] = host
            config["port"] = self.sftp_port.text().strip() or "22"
            config["user"] = user

            if self.sftp_use_key.isChecked():
                key_file = self.sftp_key_file.text().strip()
                if not key_file:
                    QMessageBox.warning(
                        self, "Validation",
                        "Please select an SSH key file"
                    )
                    return
                config["key_file"] = key_file
            else:
                password = self.sftp_password.text()
                if not password:
                    QMessageBox.warning(
                        self, "Validation",
                        "Please enter a password"
                    )
                    return
                config["pass"] = password

        # Create/update the remote
        try:
            from src.services.rclone_service import RcloneService
            service = RcloneService()

            if self.editing:
                # Delete and recreate
                service.delete_remote_config(name)

            success = service.create_remote(name, remote_type, config)

            if success:
                self.accept()
            else:
                QMessageBox.warning(self, "Error", "Failed to create remote")

        except Exception as e:
            QMessageBox.warning(self, "Error", str(e))


# Import Path for browse dialog
from pathlib import Path
