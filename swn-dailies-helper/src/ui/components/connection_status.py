"""
Connection status widget for the sidebar.
Shows live connection status and opens details popup when clicked.
"""
from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame
)

from src.services.connection_manager import ConnectionManager
from src.ui.styles import COLORS


class ConnectionStatusWidget(QWidget):
    """Clickable widget showing connection status in the sidebar."""

    def __init__(self, connection_manager: ConnectionManager, parent=None):
        super().__init__(parent)
        self.connection_manager = connection_manager
        self._details_dialog = None

        self._setup_ui()
        self._connect_signals()
        self._update_display(connection_manager.state, connection_manager.details)

    def _setup_ui(self):
        """Set up the widget UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(15, 12, 15, 12)
        layout.setSpacing(4)

        # Make widget clickable
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setObjectName("connection-status-widget")

        # Status row (indicator + status text)
        status_row = QHBoxLayout()
        status_row.setSpacing(8)

        # Indicator dot
        self.indicator = QFrame()
        self.indicator.setFixedSize(8, 8)
        self.indicator.setStyleSheet(f"""
            border-radius: 4px;
            background-color: {COLORS['muted-gray']};
        """)
        status_row.addWidget(self.indicator)

        # Status label
        self.status_label = QLabel("Not Connected")
        self.status_label.setStyleSheet(f"""
            font-size: 13px;
            font-weight: 500;
            color: {COLORS['muted-gray']};
        """)
        status_row.addWidget(self.status_label)
        status_row.addStretch()

        layout.addLayout(status_row)

        # Details row (user info)
        self.details_label = QLabel("")
        self.details_label.setStyleSheet(f"""
            font-size: 11px;
            color: {COLORS['muted-gray-dark']};
            padding-left: 16px;
        """)
        self.details_label.hide()
        layout.addWidget(self.details_label)

        # Separator and version at bottom
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        separator.setFixedHeight(1)

        version_label = QLabel("v1.0.0")
        version_label.setStyleSheet(f"""
            font-size: 10px;
            color: {COLORS['muted-gray-dark']};
            padding-top: 8px;
        """)

        layout.addWidget(separator)
        layout.addWidget(version_label)

        # Widget styling
        self.setStyleSheet(f"""
            #connection-status-widget {{
                border-top: 1px solid {COLORS['border-gray']};
            }}
            #connection-status-widget:hover {{
                background-color: {COLORS['charcoal-light']};
            }}
        """)

    def _connect_signals(self):
        """Connect to connection manager signals."""
        self.connection_manager.status_changed.connect(self._update_display)

    def _update_display(self, state: str, details: dict):
        """Update the display based on connection state."""
        if state == ConnectionManager.STATE_CONNECTED:
            self.indicator.setStyleSheet(f"""
                border-radius: 4px;
                background-color: {COLORS['green']};
            """)
            self.status_label.setText("Connected")
            self.status_label.setStyleSheet(f"""
                font-size: 13px;
                font-weight: 500;
                color: {COLORS['green']};
            """)

            # Show user details
            user = details.get("user", {})
            projects = details.get("projects", [])
            display_name = user.get("display_name") or user.get("email") or "User"
            project_count = len(projects)
            self.details_label.setText(
                f"{display_name} \u00b7 {project_count} project{'s' if project_count != 1 else ''}"
            )
            self.details_label.show()

        elif state == ConnectionManager.STATE_CHECKING:
            self.indicator.setStyleSheet(f"""
                border-radius: 4px;
                background-color: {COLORS['accent-yellow']};
            """)
            self.status_label.setText("Checking...")
            self.status_label.setStyleSheet(f"""
                font-size: 13px;
                font-weight: 500;
                color: {COLORS['accent-yellow']};
            """)
            # Keep existing details visible during check

        elif state == ConnectionManager.STATE_ERROR:
            self.indicator.setStyleSheet(f"""
                border-radius: 4px;
                background-color: {COLORS['red']};
            """)
            self.status_label.setText("Connection Error")
            self.status_label.setStyleSheet(f"""
                font-size: 13px;
                font-weight: 500;
                color: {COLORS['red']};
            """)
            self.details_label.setText("Click for details")
            self.details_label.show()

        else:  # DISCONNECTED
            self.indicator.setStyleSheet(f"""
                border-radius: 4px;
                background-color: {COLORS['muted-gray']};
            """)
            self.status_label.setText("Not Connected")
            self.status_label.setStyleSheet(f"""
                font-size: 13px;
                font-weight: 500;
                color: {COLORS['muted-gray']};
            """)
            self.details_label.hide()

        # Update details dialog if open
        if self._details_dialog and self._details_dialog.isVisible():
            self._details_dialog.update_status(state, details)

    def mousePressEvent(self, event):
        """Handle click to open details dialog."""
        if event.button() == Qt.MouseButton.LeftButton:
            self._show_details_dialog()

    def _show_details_dialog(self):
        """Show the connection details dialog."""
        # Import here to avoid circular import
        from src.ui.dialogs.connection_details import ConnectionDetailsDialog

        if self._details_dialog is None:
            self._details_dialog = ConnectionDetailsDialog(
                self.connection_manager,
                self.window()
            )

        self._details_dialog.show()
        self._details_dialog.raise_()
        self._details_dialog.activateWindow()
