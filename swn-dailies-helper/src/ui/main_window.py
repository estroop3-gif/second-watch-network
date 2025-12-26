"""
Main window for the SWN Dailies Helper app.
Styled to match the Second Watch Network website.
"""
from PyQt6.QtWidgets import (
    QMainWindow,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QStackedWidget,
    QPushButton,
    QLabel,
    QFrame,
    QStatusBar,
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QIcon, QFont, QPixmap

from src.ui.pages.setup_page import SetupPage
from src.ui.pages.offload_page import OffloadPage
from src.ui.pages.upload_page import UploadPage
from src.ui.pages.proxy_page import ProxyPage
from src.ui.pages.drives_page import DrivesPage
from src.ui.pages.reports_page import ReportsPage
from src.ui.pages.settings_page import SettingsPage
from src.ui.components.connection_status import ConnectionStatusWidget
from src.ui.styles import APP_STYLESHEET, COLORS
from src.services.config import ConfigManager
from src.services.connection_manager import ConnectionManager
from src.services.session_manager import SessionManager


class MainWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.config = ConfigManager()
        self.connection_manager = ConnectionManager(self.config, self)
        self.setup_ui()

        # Start connection manager after UI is set up
        self.connection_manager.start()

        # Connect to status changes for navigation
        self.connection_manager.status_changed.connect(self._on_connection_status_changed)

    def setup_ui(self):
        """Initialize the user interface."""
        self.setWindowTitle("SWN Dailies Helper")
        self.setMinimumSize(900, 600)

        # Apply brand stylesheet
        self.setStyleSheet(APP_STYLESHEET)

        # Central widget
        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar
        sidebar = self.create_sidebar()
        layout.addWidget(sidebar)

        # Main content area
        self.stack = QStackedWidget()
        layout.addWidget(self.stack, 1)

        # Create pages (pass connection manager to pages that need it)
        self.setup_page = SetupPage(self.config, self.connection_manager, on_connected=self.on_connected)
        self.offload_page = OffloadPage(self.config)
        self.upload_page = UploadPage(self.config)
        self.proxy_page = ProxyPage(self.config)
        self.drives_page = DrivesPage(self.config)
        self.reports_page = ReportsPage(self.config)
        self.settings_page = SettingsPage(self.config, self.connection_manager, on_disconnect=self.on_disconnect)

        self.stack.addWidget(self.setup_page)
        self.stack.addWidget(self.offload_page)
        self.stack.addWidget(self.upload_page)
        self.stack.addWidget(self.proxy_page)
        self.stack.addWidget(self.drives_page)
        self.stack.addWidget(self.reports_page)
        self.stack.addWidget(self.settings_page)

        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.update_status()

        # Check if API key is configured
        if self.config.get_api_key():
            self.show_offload()
            # Check for interrupted session after a short delay
            QTimer.singleShot(500, self._check_interrupted_session)
        else:
            self.show_setup()

    def _check_interrupted_session(self):
        """Check for an interrupted overnight upload session."""
        from PyQt6.QtWidgets import QMessageBox

        session_manager = SessionManager.get_instance()
        session = session_manager.get_active_session()

        if session and session.status == "uploading":
            reply = QMessageBox.question(
                self,
                "Interrupted Session",
                "An overnight upload was interrupted.\n\n"
                f"Session has {len(session.manifest_ids)} card(s).\n\n"
                "Would you like to resume the upload?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.Yes
            )
            if reply == QMessageBox.StandardButton.Yes:
                # Navigate to offload page to resume
                self.show_offload()
                # The offload page will show the session status

    def create_sidebar(self) -> QFrame:
        """Create the sidebar navigation."""
        sidebar = QFrame()
        sidebar.setObjectName("sidebar")
        sidebar.setFixedWidth(220)

        layout = QVBoxLayout(sidebar)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Logo/Title area
        title_container = QWidget()
        title_layout = QVBoxLayout(title_container)
        title_layout.setContentsMargins(20, 25, 20, 20)
        title_layout.setSpacing(5)

        title = QLabel("SWN Dailies")
        title.setObjectName("sidebar-title")
        title_layout.addWidget(title)

        subtitle = QLabel("Desktop Helper")
        subtitle.setObjectName("sidebar-subtitle")
        title_layout.addWidget(subtitle)

        layout.addWidget(title_container)

        # Separator
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

        # Navigation buttons
        nav_container = QWidget()
        nav_layout = QVBoxLayout(nav_container)
        nav_layout.setContentsMargins(0, 10, 0, 10)
        nav_layout.setSpacing(2)

        self.btn_setup = self._create_nav_button("🔑  Setup", self.show_setup)
        self.btn_offload = self._create_nav_button("📦  Offload", self.show_offload)
        self.btn_upload = self._create_nav_button("☁️  Upload", self.show_upload)
        self.btn_proxies = self._create_nav_button("🎬  Proxies", self.show_proxies)
        self.btn_drives = self._create_nav_button("🔗  Drives", self.show_drives)
        self.btn_reports = self._create_nav_button("📊  Reports", self.show_reports)
        self.btn_settings = self._create_nav_button("⚙️  Settings", self.show_settings)

        nav_layout.addWidget(self.btn_setup)
        nav_layout.addWidget(self.btn_offload)
        nav_layout.addWidget(self.btn_upload)
        nav_layout.addWidget(self.btn_proxies)
        nav_layout.addWidget(self.btn_drives)
        nav_layout.addWidget(self.btn_reports)
        nav_layout.addWidget(self.btn_settings)

        layout.addWidget(nav_container)
        layout.addStretch()

        # Connection status widget (live updating, clickable)
        self.connection_status_widget = ConnectionStatusWidget(self.connection_manager)
        layout.addWidget(self.connection_status_widget)

        return sidebar

    def _create_nav_button(self, text: str, callback) -> QPushButton:
        """Create a navigation button."""
        btn = QPushButton(text)
        btn.setObjectName("nav-button")
        btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn.clicked.connect(callback)
        return btn

    def show_setup(self):
        """Show the setup page."""
        self.stack.setCurrentWidget(self.setup_page)
        self._update_nav_buttons(0)

    def show_offload(self):
        """Show the offload page."""
        self.stack.setCurrentWidget(self.offload_page)
        self._update_nav_buttons(1)
        # Refresh drives when switching to offload
        if hasattr(self.offload_page, 'refresh_drives'):
            self.offload_page.refresh_drives()

    def show_upload(self):
        """Show the upload page."""
        self.stack.setCurrentWidget(self.upload_page)
        self._update_nav_buttons(2)

    def show_proxies(self):
        """Show the proxies page."""
        self.stack.setCurrentWidget(self.proxy_page)
        self._update_nav_buttons(3)

    def show_drives(self):
        """Show the linked drives page."""
        self.stack.setCurrentWidget(self.drives_page)
        self._update_nav_buttons(4)

    def show_reports(self):
        """Show the reports page."""
        self.stack.setCurrentWidget(self.reports_page)
        self._update_nav_buttons(5)

    def show_settings(self):
        """Show the settings page."""
        self.stack.setCurrentWidget(self.settings_page)
        self._update_nav_buttons(6)

    def _update_nav_buttons(self, active_index: int):
        """Update navigation button states."""
        buttons = [self.btn_setup, self.btn_offload, self.btn_upload, self.btn_proxies, self.btn_drives, self.btn_reports, self.btn_settings]
        for i, btn in enumerate(buttons):
            btn.setProperty("active", i == active_index)
            btn.style().unpolish(btn)
            btn.style().polish(btn)

    def update_status(self):
        """Update the status bar based on connection state."""
        state = self.connection_manager.state
        details = self.connection_manager.details

        if state == ConnectionManager.STATE_CONNECTED:
            user = details.get("user", {})
            display_name = user.get("display_name") or user.get("email") or "User"
            projects = details.get("projects", [])
            self.status_bar.showMessage(f"Connected as {display_name} ({len(projects)} projects)")
        elif state == ConnectionManager.STATE_CHECKING:
            self.status_bar.showMessage("Verifying connection...")
        elif state == ConnectionManager.STATE_ERROR:
            self.status_bar.showMessage("Connection error - click status for details")
        else:
            self.status_bar.showMessage("Not connected - Enter API key in Setup")

    def _on_connection_status_changed(self, state: str, details: dict):
        """Handle connection status changes from connection manager."""
        self.update_status()

        # Navigate to appropriate page based on state
        if state == ConnectionManager.STATE_CONNECTED:
            # If on setup page and just connected, go to offload
            if self.stack.currentWidget() == self.setup_page:
                self.show_offload()
        elif state == ConnectionManager.STATE_DISCONNECTED:
            # If disconnected, go to setup page
            self.show_setup()

    def on_connected(self):
        """Called when successfully connected to a project."""
        # Connection manager will emit status_changed which handles navigation
        pass

    def on_disconnect(self):
        """Called when disconnected from project."""
        # Connection manager will emit status_changed which handles navigation
        pass
