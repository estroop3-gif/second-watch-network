"""
Connection details dialog showing user info, projects, and activity log.
"""
from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QScrollArea, QWidget, QListWidget, QListWidgetItem
)

from src.services.connection_manager import ConnectionManager
from src.ui.styles import COLORS


class ConnectionDetailsDialog(QDialog):
    """Dialog showing connection details and activity log."""

    def __init__(self, connection_manager: ConnectionManager, parent=None):
        super().__init__(parent)
        self.connection_manager = connection_manager

        self.setWindowTitle("Connection Details")
        self.setMinimumSize(450, 500)
        self.setModal(False)

        self._setup_ui()
        self._connect_signals()
        self._populate_data()

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Status section
        status_section = self._create_status_section()
        layout.addWidget(status_section)

        # User info section
        self.user_section = self._create_user_section()
        layout.addWidget(self.user_section)

        # Projects section
        self.projects_section = self._create_projects_section()
        layout.addWidget(self.projects_section)

        # Activity log section
        activity_section = self._create_activity_section()
        layout.addWidget(activity_section, 1)  # Takes remaining space

        # Buttons
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)

        self.reconnect_btn = QPushButton("Reconnect")
        self.reconnect_btn.clicked.connect(self._on_reconnect)

        self.disconnect_btn = QPushButton("Disconnect")
        self.disconnect_btn.setObjectName("danger-button")
        self.disconnect_btn.clicked.connect(self._on_disconnect)

        buttons_layout.addWidget(self.reconnect_btn)
        buttons_layout.addStretch()
        buttons_layout.addWidget(self.disconnect_btn)

        layout.addLayout(buttons_layout)

        # Apply dark theme
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
            QLabel {{
                color: {COLORS['bone-white']};
            }}
        """)

    def _create_status_section(self) -> QFrame:
        """Create the status display section."""
        frame = QFrame()
        layout = QHBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        label = QLabel("Status:")
        label.setStyleSheet(f"font-weight: bold; color: {COLORS['muted-gray']};")
        layout.addWidget(label)

        self.status_indicator = QFrame()
        self.status_indicator.setFixedSize(10, 10)
        self.status_indicator.setStyleSheet(f"""
            border-radius: 5px;
            background-color: {COLORS['muted-gray']};
        """)
        layout.addWidget(self.status_indicator)

        self.status_label = QLabel("Unknown")
        self.status_label.setStyleSheet("font-weight: bold;")
        layout.addWidget(self.status_label)

        layout.addStretch()

        return frame

    def _create_user_section(self) -> QFrame:
        """Create the user info section."""
        frame = QFrame()
        frame.setObjectName("card")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(8)

        title = QLabel("User")
        title.setStyleSheet(f"font-weight: bold; font-size: 14px; color: {COLORS['muted-gray']};")
        layout.addWidget(title)

        self.user_name_label = QLabel("Not connected")
        self.user_name_label.setStyleSheet("font-size: 15px;")
        layout.addWidget(self.user_name_label)

        self.user_email_label = QLabel("")
        self.user_email_label.setStyleSheet(f"font-size: 12px; color: {COLORS['muted-gray']};")
        layout.addWidget(self.user_email_label)

        return frame

    def _create_projects_section(self) -> QFrame:
        """Create the projects list section."""
        frame = QFrame()
        frame.setObjectName("card")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(8)

        title = QLabel("Projects")
        title.setStyleSheet(f"font-weight: bold; font-size: 14px; color: {COLORS['muted-gray']};")
        layout.addWidget(title)

        self.projects_list = QListWidget()
        self.projects_list.setMaximumHeight(120)
        self.projects_list.setStyleSheet(f"""
            QListWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: none;
                border-radius: 4px;
            }}
            QListWidget::item {{
                padding: 8px 12px;
                border-bottom: 1px solid {COLORS['border-gray']};
            }}
            QListWidget::item:last-child {{
                border-bottom: none;
            }}
        """)
        layout.addWidget(self.projects_list)

        return frame

    def _create_activity_section(self) -> QFrame:
        """Create the activity log section."""
        frame = QFrame()
        frame.setObjectName("card")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(8)

        title = QLabel("Activity Log")
        title.setStyleSheet(f"font-weight: bold; font-size: 14px; color: {COLORS['muted-gray']};")
        layout.addWidget(title)

        self.activity_list = QListWidget()
        self.activity_list.setStyleSheet(f"""
            QListWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: none;
                border-radius: 4px;
                font-family: 'SF Mono', 'Consolas', monospace;
                font-size: 11px;
            }}
            QListWidget::item {{
                padding: 6px 12px;
                border-bottom: 1px solid {COLORS['border-gray']};
                color: {COLORS['muted-gray']};
            }}
            QListWidget::item:last-child {{
                border-bottom: none;
            }}
        """)
        layout.addWidget(self.activity_list, 1)

        return frame

    def _connect_signals(self):
        """Connect to connection manager signals."""
        self.connection_manager.status_changed.connect(self.update_status)
        self.connection_manager.activity_logged.connect(self._add_activity_entry)

    def _populate_data(self):
        """Populate the dialog with current data."""
        self.update_status(
            self.connection_manager.state,
            self.connection_manager.details
        )

        # Populate activity log
        self.activity_list.clear()
        for timestamp, message in self.connection_manager.activity_log:
            self._add_activity_item(timestamp, message)

    def update_status(self, state: str, details: dict):
        """Update the status display."""
        if state == ConnectionManager.STATE_CONNECTED:
            self.status_indicator.setStyleSheet(f"""
                border-radius: 5px;
                background-color: {COLORS['green']};
            """)
            self.status_label.setText("Connected")
            self.status_label.setStyleSheet(f"font-weight: bold; color: {COLORS['green']};")

            user = details.get("user", {})
            projects = details.get("projects", [])

            self.user_name_label.setText(user.get("display_name") or "User")
            self.user_email_label.setText(user.get("email") or "")
            self.user_section.show()

            self.projects_list.clear()
            for project in projects:
                item = QListWidgetItem(f"\u2022 {project.get('name', 'Unknown')} ({project.get('role', 'member')})")
                self.projects_list.addItem(item)
            self.projects_section.show()

            self.disconnect_btn.setEnabled(True)

        elif state == ConnectionManager.STATE_CHECKING:
            self.status_indicator.setStyleSheet(f"""
                border-radius: 5px;
                background-color: {COLORS['accent-yellow']};
            """)
            self.status_label.setText("Checking...")
            self.status_label.setStyleSheet(f"font-weight: bold; color: {COLORS['accent-yellow']};")

        elif state == ConnectionManager.STATE_ERROR:
            self.status_indicator.setStyleSheet(f"""
                border-radius: 5px;
                background-color: {COLORS['red']};
            """)
            self.status_label.setText("Connection Error")
            self.status_label.setStyleSheet(f"font-weight: bold; color: {COLORS['red']};")
            self.disconnect_btn.setEnabled(True)

        else:  # DISCONNECTED
            self.status_indicator.setStyleSheet(f"""
                border-radius: 5px;
                background-color: {COLORS['muted-gray']};
            """)
            self.status_label.setText("Not Connected")
            self.status_label.setStyleSheet(f"font-weight: bold; color: {COLORS['muted-gray']};")

            self.user_name_label.setText("Not connected")
            self.user_email_label.setText("")
            self.projects_list.clear()
            self.disconnect_btn.setEnabled(False)

    def _add_activity_entry(self, timestamp: str, message: str):
        """Add a new activity log entry."""
        self._add_activity_item(timestamp, message, prepend=True)

    def _add_activity_item(self, timestamp: str, message: str, prepend: bool = False):
        """Add an activity item to the list."""
        item = QListWidgetItem(f"{timestamp}  {message}")
        if prepend:
            self.activity_list.insertItem(0, item)
        else:
            self.activity_list.addItem(item)

    def _on_reconnect(self):
        """Handle reconnect button click."""
        self.connection_manager.reconnect()

    def _on_disconnect(self):
        """Handle disconnect button click."""
        self.connection_manager.disconnect()
        self.close()
