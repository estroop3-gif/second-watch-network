"""
Setup page - Enter API key and connect to project.
"""
from typing import Optional, Callable
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QPushButton,
    QFrame,
)
from PyQt6.QtCore import Qt
import httpx

from src.services.config import ConfigManager
from src.ui.styles import COLORS


class SetupPage(QWidget):
    """Setup page for entering API key."""

    def __init__(
        self,
        config: ConfigManager,
        on_connected: Optional[Callable[[], None]] = None,
    ):
        super().__init__()
        self.config = config
        self.on_connected = on_connected
        self.setup_ui()

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Title
        title = QLabel("Connect to Second Watch Network")
        title.setObjectName("page-title")
        layout.addWidget(title)

        # Subtitle
        subtitle = QLabel("Link this helper to your Backlot project")
        subtitle.setObjectName("page-subtitle")
        layout.addWidget(subtitle)

        layout.addSpacing(20)

        # Instructions
        instructions = QLabel(
            "Enter your Desktop API Key to connect this helper to your project. "
            "You can generate an API key from the Dailies tab in Backlot."
        )
        instructions.setObjectName("label-muted")
        instructions.setWordWrap(True)
        layout.addWidget(instructions)

        layout.addSpacing(10)

        # API Key Card
        key_frame = QFrame()
        key_frame.setObjectName("card")
        key_layout = QVBoxLayout(key_frame)
        key_layout.setSpacing(15)

        # Card title
        key_label = QLabel("Desktop API Key")
        key_label.setObjectName("card-title")
        key_layout.addWidget(key_label)

        # Key input
        self.key_input = QLineEdit()
        self.key_input.setPlaceholderText("swn_dk_...")
        self.key_input.setEchoMode(QLineEdit.EchoMode.Password)
        self.key_input.returnPressed.connect(self.connect_to_project)
        key_layout.addWidget(self.key_input)

        # Show/hide and connect buttons
        btn_layout = QHBoxLayout()
        btn_layout.setSpacing(10)

        self.show_btn = QPushButton("Show")
        self.show_btn.setCheckable(True)
        self.show_btn.toggled.connect(self.toggle_key_visibility)
        self.show_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.show_btn)

        btn_layout.addStretch()

        self.connect_btn = QPushButton("Connect")
        self.connect_btn.setObjectName("primary-button")
        self.connect_btn.clicked.connect(self.connect_to_project)
        self.connect_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.connect_btn)

        key_layout.addLayout(btn_layout)
        layout.addWidget(key_frame)

        # Status message
        self.status_label = QLabel("")
        self.status_label.setObjectName("label-small")
        layout.addWidget(self.status_label)

        layout.addStretch()

        # Help link
        help_label = QLabel(
            "Need help? Visit <a href='https://www.secondwatchnetwork.com/help' "
            f"style='color: {COLORS['accent-yellow']}'>our help center</a>."
        )
        help_label.setOpenExternalLinks(True)
        help_label.setObjectName("label-small")
        layout.addWidget(help_label)

    def toggle_key_visibility(self, visible: bool):
        """Toggle API key visibility."""
        self.key_input.setEchoMode(
            QLineEdit.EchoMode.Normal if visible else QLineEdit.EchoMode.Password
        )
        self.show_btn.setText("Hide" if visible else "Show")

    def connect_to_project(self):
        """Verify the API key and connect to the project."""
        api_key = self.key_input.text().strip()

        if not api_key:
            self.show_error("Please enter an API key")
            return

        if not api_key.startswith("swn_dk_"):
            self.show_error("Invalid API key format. Keys start with 'swn_dk_'")
            return

        self.connect_btn.setEnabled(False)
        self.connect_btn.setText("Connecting...")
        self.status_label.setText("Verifying...")
        self.status_label.setStyleSheet(f"color: {COLORS['muted-gray']};")

        try:
            # Verify the API key with the backend
            response = httpx.post(
                "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com/api/v1/backlot/desktop-keys/verify",
                headers={"X-API-Key": api_key},
                timeout=10,
            )

            if response.status_code == 200:
                data = response.json()
                self.config.set_api_key(api_key)
                self.config.set_project_id(data.get("project_id"))

                project_title = data.get("project_title", "Unknown Project")
                self.show_success(f"Connected to: {project_title}")

                # Call the callback
                if self.on_connected:
                    self.on_connected()
            else:
                try:
                    error = response.json().get("detail", "Invalid API key")
                except Exception:
                    error = f"Server error ({response.status_code})"
                self.show_error(f"Error: {error}")

        except httpx.TimeoutException:
            self.show_error("Connection timed out. Please try again.")
        except httpx.ConnectError:
            self.show_error("Could not connect to server. Check your internet connection.")
        except Exception as e:
            self.show_error(f"Connection failed: {str(e)}")
        finally:
            self.connect_btn.setEnabled(True)
            self.connect_btn.setText("Connect")

    def show_error(self, message: str):
        """Show an error message."""
        self.status_label.setText(message)
        self.status_label.setStyleSheet(f"color: {COLORS['red']};")

    def show_success(self, message: str):
        """Show a success message."""
        self.status_label.setText(message)
        self.status_label.setStyleSheet(f"color: {COLORS['green']};")
