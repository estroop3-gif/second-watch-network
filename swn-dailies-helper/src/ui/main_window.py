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
from src.ui.pages.proxy_page import ProxyPage
from src.ui.pages.reports_page import ReportsPage
from src.ui.pages.settings_page import SettingsPage
from src.ui.styles import APP_STYLESHEET, COLORS
from src.services.config import ConfigManager


class MainWindow(QMainWindow):
    """Main application window."""

    def __init__(self):
        super().__init__()
        self.config = ConfigManager()
        self.setup_ui()

    def setup_ui(self):
        """Initialize the user interface."""
        self.setWindowTitle("SWN Dailies Helper")
        self.setMinimumSize(1100, 750)

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

        # Create pages
        self.setup_page = SetupPage(self.config, on_connected=self.on_connected)
        self.offload_page = OffloadPage(self.config)
        self.proxy_page = ProxyPage(self.config)
        self.reports_page = ReportsPage(self.config)
        self.settings_page = SettingsPage(self.config, on_disconnect=self.on_disconnect)

        self.stack.addWidget(self.setup_page)
        self.stack.addWidget(self.offload_page)
        self.stack.addWidget(self.proxy_page)
        self.stack.addWidget(self.reports_page)
        self.stack.addWidget(self.settings_page)

        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.update_status()

        # Check if API key is configured
        if self.config.get_api_key():
            self.show_offload()
        else:
            self.show_setup()

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
        self.btn_proxies = self._create_nav_button("🎬  Proxies", self.show_proxies)
        self.btn_reports = self._create_nav_button("📊  Reports", self.show_reports)
        self.btn_settings = self._create_nav_button("⚙️  Settings", self.show_settings)

        nav_layout.addWidget(self.btn_setup)
        nav_layout.addWidget(self.btn_offload)
        nav_layout.addWidget(self.btn_proxies)
        nav_layout.addWidget(self.btn_reports)
        nav_layout.addWidget(self.btn_settings)

        layout.addWidget(nav_container)
        layout.addStretch()

        # Connection status
        status_container = QWidget()
        status_layout = QVBoxLayout(status_container)
        status_layout.setContentsMargins(20, 15, 20, 20)

        self.connection_indicator = QFrame()
        self.connection_indicator.setFixedSize(8, 8)
        self.connection_indicator.setStyleSheet(f"""
            background-color: {COLORS['muted-gray']};
            border-radius: 4px;
        """)

        self.connection_label = QLabel("Not Connected")
        self.connection_label.setObjectName("connection-status")

        status_row = QHBoxLayout()
        status_row.setSpacing(10)
        status_row.addWidget(self.connection_indicator)
        status_row.addWidget(self.connection_label)
        status_row.addStretch()

        status_layout.addLayout(status_row)

        # Version
        version = QLabel("v1.0.0")
        version.setStyleSheet(f"color: {COLORS['muted-gray-dark']}; font-size: 11px;")
        status_layout.addWidget(version)

        layout.addWidget(status_container)

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

    def show_proxies(self):
        """Show the proxies page."""
        self.stack.setCurrentWidget(self.proxy_page)
        self._update_nav_buttons(2)

    def show_reports(self):
        """Show the reports page."""
        self.stack.setCurrentWidget(self.reports_page)
        self._update_nav_buttons(3)

    def show_settings(self):
        """Show the settings page."""
        self.stack.setCurrentWidget(self.settings_page)
        self._update_nav_buttons(4)

    def _update_nav_buttons(self, active_index: int):
        """Update navigation button states."""
        buttons = [self.btn_setup, self.btn_offload, self.btn_proxies, self.btn_reports, self.btn_settings]
        for i, btn in enumerate(buttons):
            btn.setProperty("active", i == active_index)
            btn.style().unpolish(btn)
            btn.style().polish(btn)

    def update_status(self):
        """Update the status bar and connection indicator."""
        api_key = self.config.get_api_key()
        project_id = self.config.get_project_id()

        if api_key and project_id:
            self.status_bar.showMessage(f"Connected to project: {project_id[:8]}...")
            self.connection_label.setText("Connected")
            self.connection_label.setProperty("connected", True)
            self.connection_indicator.setStyleSheet(f"""
                background-color: {COLORS['green']};
                border-radius: 4px;
            """)
        else:
            self.status_bar.showMessage("Not connected - Enter API key in Setup")
            self.connection_label.setText("Not Connected")
            self.connection_label.setProperty("connected", False)
            self.connection_indicator.setStyleSheet(f"""
                background-color: {COLORS['muted-gray']};
                border-radius: 4px;
            """)

        # Refresh label style
        self.connection_label.style().unpolish(self.connection_label)
        self.connection_label.style().polish(self.connection_label)

    def on_connected(self):
        """Called when successfully connected to a project."""
        self.update_status()
        self.show_offload()

    def on_disconnect(self):
        """Called when disconnected from project."""
        self.update_status()
        self.show_setup()
