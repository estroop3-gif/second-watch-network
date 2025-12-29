"""
Backlot link configuration dialog for connecting offload to Backlot projects.
"""
from typing import Optional, List, Dict, Any

from PyQt6.QtCore import Qt, pyqtSignal, QThread
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QComboBox, QCheckBox, QGroupBox
)

from src.services.config import ConfigManager
from src.models.offload_models import BacklotLinkConfig
from src.ui.styles import COLORS


class ProductionDayFetcher(QThread):
    """Background worker to fetch production days from API."""
    finished = pyqtSignal(list, str)  # days, error_message

    def __init__(self, api_url: str, api_key: str, project_id: str):
        super().__init__()
        self.api_url = api_url
        self.api_key = api_key
        self.project_id = project_id

    def run(self):
        try:
            import httpx
            url = f"{self.api_url}/api/v1/backlot/desktop-keys/projects/{self.project_id}/production-days"
            response = httpx.get(
                url,
                headers={"X-API-Key": self.api_key},
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                days = data.get("production_days", [])
                self.finished.emit(days, "")
            else:
                self.finished.emit([], f"Error: {response.status_code}")
        except Exception as e:
            self.finished.emit([], str(e))


class BacklotLinkDialog(QDialog):
    """Dialog for linking offload to a Backlot project."""

    # Emitted when user saves changes
    link_saved = pyqtSignal(dict)

    # Default API URL
    DEFAULT_API_URL = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"

    def __init__(self, config: ConfigManager, current_settings: Optional[dict] = None, parent=None):
        super().__init__(parent)
        self.config = config
        self.current_settings = current_settings or {}
        self.projects: List[Dict[str, Any]] = []
        self.production_days: List[Dict[str, Any]] = []
        self._day_fetcher: Optional[ProductionDayFetcher] = None

        self.setWindowTitle("Link to Backlot")
        self.setMinimumSize(450, 400)
        self.setModal(True)

        self._setup_ui()
        self._load_projects()
        self._load_settings()
        self._connect_signals()

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # Title
        title = QLabel("Link to Backlot")
        title.setStyleSheet(f"""
            font-size: 20px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        layout.addWidget(title)

        # Subtitle
        subtitle = QLabel("Upload offloaded footage to your Backlot project")
        subtitle.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 13px;")
        layout.addWidget(subtitle)

        # Project selection
        project_group = self._create_project_section()
        layout.addWidget(project_group)

        # Production day selection
        day_group = self._create_day_section()
        layout.addWidget(day_group)

        # Upload destinations
        dest_group = self._create_destinations_section()
        layout.addWidget(dest_group)

        layout.addStretch()

        # Summary
        self.summary_label = QLabel("")
        self.summary_label.setStyleSheet(f"""
            color: {COLORS['accent-yellow']};
            font-size: 13px;
            padding: 12px;
            background-color: {COLORS['charcoal-light']};
            border-radius: 6px;
        """)
        self.summary_label.setWordWrap(True)
        layout.addWidget(self.summary_label)

        # Buttons
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)

        self.clear_btn = QPushButton("Clear Link")
        self.clear_btn.setObjectName("danger-button")
        self.clear_btn.clicked.connect(self._on_clear)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.clicked.connect(self.reject)

        self.save_btn = QPushButton("Save")
        self.save_btn.setObjectName("primary-button")
        self.save_btn.clicked.connect(self._on_save)

        buttons_layout.addWidget(self.clear_btn)
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
        """)

    def _create_project_section(self) -> QGroupBox:
        """Create the project selection section."""
        group = QGroupBox("Project")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        self.project_combo = QComboBox()
        self.project_combo.setMinimumHeight(36)
        layout.addWidget(self.project_combo)

        return group

    def _create_day_section(self) -> QGroupBox:
        """Create the production day selection section."""
        group = QGroupBox("Production Day")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        self.day_combo = QComboBox()
        self.day_combo.setMinimumHeight(36)
        self.day_combo.setEnabled(False)
        layout.addWidget(self.day_combo)

        self.day_loading_label = QLabel("")
        self.day_loading_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(self.day_loading_label)

        return group

    def _create_destinations_section(self) -> QGroupBox:
        """Create the upload destinations section."""
        group = QGroupBox("Upload Destinations")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        self.dailies_check = QCheckBox("Dailies")
        self.dailies_check.setToolTip("Upload to the project's dailies for review")
        self.dailies_check.setChecked(True)
        layout.addWidget(self.dailies_check)

        self.assets_check = QCheckBox("Assets")
        self.assets_check.setToolTip("Upload to the project's asset library")
        layout.addWidget(self.assets_check)

        self.review_check = QCheckBox("Review")
        self.review_check.setToolTip("Upload to the project's review system for client feedback")
        layout.addWidget(self.review_check)

        hint = QLabel("Select where to upload footage after offload completes")
        hint.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(hint)

        return group

    def _connect_signals(self):
        """Connect UI signals."""
        self.project_combo.currentIndexChanged.connect(self._on_project_changed)
        self.day_combo.currentIndexChanged.connect(self._update_summary)
        self.dailies_check.stateChanged.connect(self._update_summary)
        self.assets_check.stateChanged.connect(self._update_summary)
        self.review_check.stateChanged.connect(self._update_summary)

    def _load_projects(self):
        """Load projects from config."""
        self.project_combo.clear()
        self.project_combo.addItem("Select project...", None)

        # Get projects from config (stored when connection is verified)
        self.projects = self.config.get("projects", [])

        for project in self.projects:
            name = project.get("name", "Unknown")
            project_id = project.get("id")
            role = project.get("role", "member")
            self.project_combo.addItem(f"{name} ({role})", project_id)

    def _load_settings(self):
        """Load current settings into the UI."""
        settings = self.current_settings

        # Project
        project_id = settings.get("project_id")
        if project_id:
            for i in range(self.project_combo.count()):
                if self.project_combo.itemData(i) == project_id:
                    self.project_combo.setCurrentIndex(i)
                    break

        # Destinations
        self.dailies_check.setChecked(settings.get("upload_to_dailies", True))
        self.assets_check.setChecked(settings.get("upload_to_assets", False))
        self.review_check.setChecked(settings.get("upload_to_review", False))

        # Note: Production day will be loaded after project is selected
        self._pending_day_id = settings.get("production_day_id")

    def _on_project_changed(self, index: int):
        """Handle project selection change."""
        self.project_combo.hidePopup()  # Workaround for Linux/WSL

        project_id = self.project_combo.currentData()

        self.day_combo.clear()
        self.day_combo.addItem("Select production day...", None)
        self.production_days = []

        if not project_id:
            self.day_combo.setEnabled(False)
            self._update_summary()
            return

        self.day_combo.setEnabled(True)
        self._fetch_production_days(project_id)

    def _fetch_production_days(self, project_id: str):
        """Fetch production days from API."""
        api_key = self.config.get_api_key()
        api_url = self.config.get_api_url() or self.DEFAULT_API_URL

        if not api_key:
            self.day_loading_label.setText("No API key configured")
            return

        # Don't start another fetch if one is running
        if self._day_fetcher and self._day_fetcher.isRunning():
            return

        self.day_loading_label.setText("Loading production days...")

        self._day_fetcher = ProductionDayFetcher(api_url, api_key, project_id)
        self._day_fetcher.finished.connect(self._on_days_loaded)
        self._day_fetcher.start()

    def _on_days_loaded(self, days: List[Dict[str, Any]], error: str):
        """Handle production days loaded from API."""
        self.day_loading_label.setText("")

        if error:
            self.day_loading_label.setText(f"Error: {error}")
            return

        self.production_days = days

        for day in days:
            day_num = day.get("day_number", "?")
            day_date = day.get("date", "")
            day_title = day.get("title", "")

            display = f"Day {day_num}"
            if day_date:
                display += f" - {day_date}"
            if day_title:
                display += f" ({day_title})"

            self.day_combo.addItem(display, day.get("id"))

        # If we have a pending day selection from settings, apply it
        if hasattr(self, '_pending_day_id') and self._pending_day_id:
            for i in range(self.day_combo.count()):
                if self.day_combo.itemData(i) == self._pending_day_id:
                    self.day_combo.setCurrentIndex(i)
                    break
            self._pending_day_id = None

        self._update_summary()

    def _update_summary(self):
        """Update the summary label."""
        project_id = self.project_combo.currentData()
        day_id = self.day_combo.currentData()

        if not project_id:
            self.summary_label.setText("Select a project to continue")
            self.save_btn.setEnabled(False)
            return

        # Get project name
        project_name = ""
        for i in range(self.project_combo.count()):
            if self.project_combo.itemData(i) == project_id:
                text = self.project_combo.itemText(i)
                # Remove role suffix
                if " (" in text:
                    project_name = text.split(" (")[0]
                else:
                    project_name = text
                break

        # Get day info
        day_str = ""
        if day_id:
            for day in self.production_days:
                if day.get("id") == day_id:
                    day_str = f" Day {day.get('day_number', '?')}"
                    break

        # Get destinations
        destinations = []
        if self.dailies_check.isChecked():
            destinations.append("Dailies")
        if self.assets_check.isChecked():
            destinations.append("Assets")
        if self.review_check.isChecked():
            destinations.append("Review")

        dest_str = f" to {', '.join(destinations)}" if destinations else ""

        self.summary_label.setText(f"Upload: {project_name}{day_str}{dest_str}")
        self.save_btn.setEnabled(True)

    def _get_current_settings(self) -> dict:
        """Get current settings from UI."""
        project_id = self.project_combo.currentData()
        day_id = self.day_combo.currentData()

        # Get project name
        project_name = None
        for i in range(self.project_combo.count()):
            if self.project_combo.itemData(i) == project_id:
                text = self.project_combo.itemText(i)
                if " (" in text:
                    project_name = text.split(" (")[0]
                else:
                    project_name = text
                break

        # Get day number
        day_number = None
        for day in self.production_days:
            if day.get("id") == day_id:
                day_number = day.get("day_number")
                break

        return {
            "enabled": bool(project_id),
            "project_id": project_id,
            "project_name": project_name,
            "production_day_id": day_id,
            "production_day_number": day_number,
            "upload_to_dailies": self.dailies_check.isChecked(),
            "upload_to_assets": self.assets_check.isChecked(),
            "upload_to_review": self.review_check.isChecked(),
        }

    def _on_save(self):
        """Handle save button click."""
        settings = self._get_current_settings()
        self.link_saved.emit(settings)
        self.accept()

    def _on_clear(self):
        """Handle clear button click."""
        settings = {
            "enabled": False,
            "project_id": None,
            "project_name": None,
            "production_day_id": None,
            "production_day_number": None,
            "upload_to_dailies": True,
            "upload_to_assets": False,
            "upload_to_review": False,
        }
        self.link_saved.emit(settings)
        self.accept()

    def get_settings(self) -> dict:
        """Get the current settings (after dialog closes)."""
        return self._get_current_settings()
