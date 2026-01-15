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
    QScrollArea,
)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QIcon, QFont, QPixmap

from src.ui.pages.setup_page import SetupPage
from src.ui.pages.offload_page import OffloadPage
from src.ui.pages.unified_upload_page import UnifiedUploadPage
from src.ui.pages.proxy_page import ProxyPage
from src.ui.pages.qc_page import QCPage
from src.ui.pages.reports_page import ReportsPage
from src.ui.pages.settings_page import SettingsPage
from src.ui.pages.cloud_storage_page import CloudStoragePage
from src.ui.pages.mhl_tools_page import MHLToolsPage
from src.ui.pages.metadata_tools_page import MetadataToolsPage
from src.ui.components.connection_status import ConnectionStatusWidget
from src.ui.styles import APP_STYLESHEET, COLORS
from src.services.config import ConfigManager
from src.services.connection_manager import ConnectionManager
from src.services.session_manager import SessionManager
from src.version import __version__


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
        self.setWindowTitle(f"SWN Dailies Helper v{__version__}")
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
        self.upload_page = UnifiedUploadPage(self.config)  # Unified upload (Dailies, Review, Assets)
        self.proxy_page = ProxyPage(self.config)
        self.qc_page = QCPage(self.config)
        self.cloud_storage_page = CloudStoragePage()  # Cloud storage management
        self.mhl_tools_page = MHLToolsPage()  # MHL verification
        self.metadata_tools_page = MetadataToolsPage()  # Metadata editing
        self.reports_page = ReportsPage(self.config)
        self.settings_page = SettingsPage(self.config, self.connection_manager, on_disconnect=self.on_disconnect)

        # Connect offload to unified upload queue
        self.offload_page.files_ready_for_upload.connect(self._on_files_ready_for_upload)

        # Connect upload page to connection manager for project loading
        self.upload_page.set_connection_manager(self.connection_manager)

        self.stack.addWidget(self.setup_page)          # 0
        self.stack.addWidget(self.offload_page)        # 1
        self.stack.addWidget(self.upload_page)         # 2 - Unified upload
        self.stack.addWidget(self.proxy_page)          # 3
        self.stack.addWidget(self.qc_page)             # 4 - QC Analysis
        self.stack.addWidget(self.cloud_storage_page)  # 5 - Cloud Storage
        self.stack.addWidget(self.mhl_tools_page)      # 6 - MHL Tools
        self.stack.addWidget(self.metadata_tools_page) # 7 - Metadata Tools
        self.stack.addWidget(self.reports_page)        # 8 - Reports
        self.stack.addWidget(self.settings_page)       # 9 - Settings

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

        # Navigation buttons in scroll area
        nav_scroll = QScrollArea()
        nav_scroll.setWidgetResizable(True)
        nav_scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        nav_scroll.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        nav_scroll.setFrameShape(QFrame.Shape.NoFrame)
        nav_scroll.setStyleSheet(f"""
            QScrollArea {{
                background: transparent;
                border: none;
            }}
            QScrollArea > QWidget > QWidget {{
                background: transparent;
            }}
            QScrollBar:vertical {{
                background: {COLORS['charcoal-black']};
                width: 8px;
                border-radius: 4px;
            }}
            QScrollBar::handle:vertical {{
                background: {COLORS['muted-gray']};
                min-height: 20px;
                border-radius: 4px;
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0px;
            }}
        """)

        nav_container = QWidget()
        nav_container.setStyleSheet("background: transparent;")
        nav_layout = QVBoxLayout(nav_container)
        nav_layout.setContentsMargins(0, 10, 0, 10)
        nav_layout.setSpacing(2)

        self.btn_setup = self._create_nav_button("🔑  Setup", self.show_setup)
        self.btn_offload = self._create_nav_button("📦  Offload", self.show_offload)
        self.btn_upload = self._create_nav_button("☁️  Upload", self.show_upload)
        self.btn_proxies = self._create_nav_button("🎬  Proxies", self.show_proxies)
        self.btn_qc = self._create_nav_button("🔍  QC", self.show_qc)
        self.btn_cloud = self._create_nav_button("🌐  Cloud Storage", self.show_cloud_storage)
        self.btn_mhl = self._create_nav_button("    MHL Tools", self.show_mhl_tools)
        self.btn_metadata = self._create_nav_button("    Metadata", self.show_metadata_tools)
        self.btn_reports = self._create_nav_button("📊  Reports", self.show_reports)
        self.btn_settings = self._create_nav_button("⚙️  Settings", self.show_settings)

        nav_layout.addWidget(self.btn_setup)
        nav_layout.addWidget(self.btn_offload)
        nav_layout.addWidget(self.btn_upload)
        nav_layout.addWidget(self.btn_proxies)
        nav_layout.addWidget(self.btn_qc)
        nav_layout.addWidget(self.btn_cloud)
        nav_layout.addWidget(self.btn_mhl)
        nav_layout.addWidget(self.btn_metadata)
        nav_layout.addWidget(self.btn_reports)
        nav_layout.addWidget(self.btn_settings)
        nav_layout.addStretch()

        nav_scroll.setWidget(nav_container)
        layout.addWidget(nav_scroll, 1)  # Give scroll area stretch factor

        # Connection status widget (live updating, clickable) - fixed at bottom
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
        """Show the unified upload page (Dailies, Review, Assets)."""
        self.stack.setCurrentWidget(self.upload_page)
        self._update_nav_buttons(2)

    def show_proxies(self):
        """Show the proxies page."""
        self.stack.setCurrentWidget(self.proxy_page)
        self._update_nav_buttons(3)

    def show_qc(self):
        """Show the QC analysis page."""
        self.stack.setCurrentWidget(self.qc_page)
        self._update_nav_buttons(4)

    def show_cloud_storage(self):
        """Show the cloud storage page."""
        self.stack.setCurrentWidget(self.cloud_storage_page)
        self._update_nav_buttons(5)

    def show_mhl_tools(self):
        """Show the MHL tools page."""
        self.stack.setCurrentWidget(self.mhl_tools_page)
        self._update_nav_buttons(6)

    def show_metadata_tools(self):
        """Show the metadata tools page."""
        self.stack.setCurrentWidget(self.metadata_tools_page)
        self._update_nav_buttons(7)

    def show_reports(self):
        """Show the reports page."""
        self.stack.setCurrentWidget(self.reports_page)
        self._update_nav_buttons(8)

    def show_settings(self):
        """Show the settings page."""
        self.stack.setCurrentWidget(self.settings_page)
        self._update_nav_buttons(9)

    def _update_nav_buttons(self, active_index: int):
        """Update navigation button states."""
        buttons = [
            self.btn_setup, self.btn_offload, self.btn_upload,
            self.btn_proxies, self.btn_qc, self.btn_cloud, self.btn_mhl,
            self.btn_metadata, self.btn_reports, self.btn_settings
        ]
        for i, btn in enumerate(buttons):
            btn.setProperty("active", i == active_index)
            btn.style().unpolish(btn)
            btn.style().polish(btn)

    def show_media_inspector(self, file_path: str = None):
        """Show the media inspector dialog for a file."""
        from src.ui.dialogs.media_inspector_dialog import MediaInspectorDialog
        dialog = MediaInspectorDialog(file_path, parent=self)
        dialog.show()

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

    def _on_files_ready_for_upload(self, file_paths: list, manifest_id: str):
        """Handle files ready for upload from offload page."""
        from pathlib import Path

        # Convert string paths to Path objects
        paths = [Path(p) for p in file_paths]

        # Add files to unified upload queue
        self.upload_page.add_from_offload(paths, manifest_id)
