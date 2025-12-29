"""
Naming convention configuration dialog for offload folder structure.
"""
from datetime import datetime
from typing import Optional

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QLineEdit, QComboBox, QCheckBox, QGroupBox,
    QFormLayout, QScrollArea, QWidget
)

from src.models.offload_models import NamingConvention, DATE_FORMATS
from src.ui.styles import COLORS


class NamingConventionDialog(QDialog):
    """Dialog for configuring folder naming conventions."""

    # Emitted when user saves changes
    convention_saved = pyqtSignal(dict)

    def __init__(self, current_settings: Optional[dict] = None, parent=None):
        super().__init__(parent)
        self.current_settings = current_settings or {}

        self.setWindowTitle("Naming Convention")
        self.setMinimumSize(500, 600)
        self.setModal(True)

        self._setup_ui()
        self._load_settings()
        self._connect_signals()
        self._update_preview()

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(20)

        # Title
        title = QLabel("Naming Convention")
        title.setStyleSheet(f"""
            font-size: 20px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        layout.addWidget(title)

        # Subtitle
        subtitle = QLabel("Configure how offload folders are named")
        subtitle.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 13px;")
        layout.addWidget(subtitle)

        # Scroll area for settings
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        scroll_content = QWidget()
        scroll_layout = QVBoxLayout(scroll_content)
        scroll_layout.setContentsMargins(0, 0, 0, 0)
        scroll_layout.setSpacing(16)

        # Date Format Section
        date_group = self._create_date_section()
        scroll_layout.addWidget(date_group)

        # Project Section
        project_group = self._create_project_section()
        scroll_layout.addWidget(project_group)

        # Production Day Section
        day_group = self._create_day_section()
        scroll_layout.addWidget(day_group)

        # Separator Section
        separator_group = self._create_separator_section()
        scroll_layout.addWidget(separator_group)

        # Camera/Audio Subfolder Section
        subfolder_group = self._create_subfolder_section()
        scroll_layout.addWidget(subfolder_group)

        scroll_layout.addStretch()
        scroll.setWidget(scroll_content)
        layout.addWidget(scroll, 1)

        # Preview Section
        preview_group = self._create_preview_section()
        layout.addWidget(preview_group)

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
        """)

    def _create_date_section(self) -> QGroupBox:
        """Create the date format section."""
        group = QGroupBox("Date")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        # Date format dropdown
        format_layout = QHBoxLayout()
        format_label = QLabel("Format:")
        format_label.setFixedWidth(80)
        format_layout.addWidget(format_label)

        self.date_format_combo = QComboBox()
        for format_name in DATE_FORMATS.keys():
            # Show example output
            example = datetime.now().strftime(DATE_FORMATS[format_name])
            self.date_format_combo.addItem(f"{format_name} ({example})", format_name)
        format_layout.addWidget(self.date_format_combo, 1)
        layout.addLayout(format_layout)

        # Include date checkbox
        self.include_date_check = QCheckBox("Include date in folder name")
        self.include_date_check.setChecked(True)
        layout.addWidget(self.include_date_check)

        return group

    def _create_project_section(self) -> QGroupBox:
        """Create the project code section."""
        group = QGroupBox("Project")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        # Project code input
        code_layout = QHBoxLayout()
        code_label = QLabel("Code:")
        code_label.setFixedWidth(80)
        code_layout.addWidget(code_label)

        self.project_code_input = QLineEdit()
        self.project_code_input.setPlaceholderText("e.g., SFG, PROJ, ABC")
        self.project_code_input.setMaxLength(10)
        code_layout.addWidget(self.project_code_input, 1)
        layout.addLayout(code_layout)

        hint = QLabel("Short code to identify the project (2-10 characters)")
        hint.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(hint)

        # Include project checkbox
        self.include_project_check = QCheckBox("Include project code in folder name")
        self.include_project_check.setChecked(True)
        layout.addWidget(self.include_project_check)

        return group

    def _create_day_section(self) -> QGroupBox:
        """Create the production day section."""
        group = QGroupBox("Production Day")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        # Day prefix input
        prefix_layout = QHBoxLayout()
        prefix_label = QLabel("Prefix:")
        prefix_label.setFixedWidth(80)
        prefix_layout.addWidget(prefix_label)

        self.day_prefix_input = QLineEdit()
        self.day_prefix_input.setPlaceholderText("e.g., Day, D, Shoot")
        self.day_prefix_input.setMaxLength(10)
        prefix_layout.addWidget(self.day_prefix_input, 1)
        layout.addLayout(prefix_layout)

        hint = QLabel("Text before the day number (e.g., 'Day1', 'D1')")
        hint.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(hint)

        # Include day checkbox
        self.include_day_check = QCheckBox("Include day number in folder name")
        self.include_day_check.setChecked(True)
        layout.addWidget(self.include_day_check)

        return group

    def _create_separator_section(self) -> QGroupBox:
        """Create the separator section."""
        group = QGroupBox("Separator")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        sep_layout = QHBoxLayout()
        sep_label = QLabel("Character:")
        sep_label.setFixedWidth(80)
        sep_layout.addWidget(sep_label)

        self.separator_combo = QComboBox()
        self.separator_combo.addItem("Underscore ( _ )", "_")
        self.separator_combo.addItem("Hyphen ( - )", "-")
        self.separator_combo.addItem("Period ( . )", ".")
        self.separator_combo.addItem("Space (   )", " ")
        sep_layout.addWidget(self.separator_combo, 1)
        layout.addLayout(sep_layout)

        hint = QLabel("Character between folder name parts")
        hint.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(hint)

        return group

    def _create_subfolder_section(self) -> QGroupBox:
        """Create the camera/audio subfolder naming section."""
        group = QGroupBox("Camera & Audio Subfolders")
        layout = QVBoxLayout(group)
        layout.setSpacing(12)

        # Camera prefix input
        cam_layout = QHBoxLayout()
        cam_label = QLabel("Camera prefix:")
        cam_label.setFixedWidth(100)
        cam_layout.addWidget(cam_label)

        self.camera_prefix_input = QLineEdit()
        self.camera_prefix_input.setPlaceholderText("e.g., Cam, Camera, C")
        self.camera_prefix_input.setMaxLength(10)
        cam_layout.addWidget(self.camera_prefix_input, 1)
        layout.addLayout(cam_layout)

        cam_hint = QLabel("Creates folders like 'CamA', 'CamB', etc.")
        cam_hint.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(cam_hint)

        # Audio folder name input
        audio_layout = QHBoxLayout()
        audio_label = QLabel("Audio folder:")
        audio_label.setFixedWidth(100)
        audio_layout.addWidget(audio_label)

        self.audio_folder_input = QLineEdit()
        self.audio_folder_input.setPlaceholderText("e.g., Audio, Sound, SFX")
        self.audio_folder_input.setMaxLength(20)
        audio_layout.addWidget(self.audio_folder_input, 1)
        layout.addLayout(audio_layout)

        return group

    def _create_preview_section(self) -> QFrame:
        """Create the live preview section."""
        frame = QFrame()
        frame.setObjectName("card")
        frame.setStyleSheet(f"""
            #card {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                padding: 16px;
            }}
        """)

        layout = QVBoxLayout(frame)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(8)

        header = QLabel("PREVIEW")
        header.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        layout.addWidget(header)

        self.preview_label = QLabel()
        self.preview_label.setStyleSheet(f"""
            font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            color: {COLORS['accent-yellow']};
            line-height: 1.6;
            padding: 8px 0;
        """)
        layout.addWidget(self.preview_label)

        return frame

    def _connect_signals(self):
        """Connect UI signals for live preview updates."""
        self.date_format_combo.currentIndexChanged.connect(self._update_preview)
        self.include_date_check.stateChanged.connect(self._update_preview)
        self.project_code_input.textChanged.connect(self._update_preview)
        self.include_project_check.stateChanged.connect(self._update_preview)
        self.day_prefix_input.textChanged.connect(self._update_preview)
        self.include_day_check.stateChanged.connect(self._update_preview)
        self.separator_combo.currentIndexChanged.connect(self._update_preview)
        self.camera_prefix_input.textChanged.connect(self._update_preview)
        self.audio_folder_input.textChanged.connect(self._update_preview)

    def _load_settings(self):
        """Load current settings into the UI."""
        settings = self.current_settings

        # Date format
        date_format = settings.get("date_format", "MMDDYYYY")
        for i in range(self.date_format_combo.count()):
            if self.date_format_combo.itemData(i) == date_format:
                self.date_format_combo.setCurrentIndex(i)
                break

        self.include_date_check.setChecked(settings.get("include_date", True))

        # Project
        self.project_code_input.setText(settings.get("project_code", ""))
        self.include_project_check.setChecked(settings.get("include_project", True))

        # Day
        self.day_prefix_input.setText(settings.get("day_prefix", "Day"))
        self.include_day_check.setChecked(settings.get("include_day", True))

        # Separator
        separator = settings.get("separator", "_")
        for i in range(self.separator_combo.count()):
            if self.separator_combo.itemData(i) == separator:
                self.separator_combo.setCurrentIndex(i)
                break

        # Subfolders
        self.camera_prefix_input.setText(settings.get("camera_prefix", "Cam"))
        self.audio_folder_input.setText(settings.get("audio_folder_name", "Audio"))

    def _get_current_settings(self) -> dict:
        """Get current settings from UI."""
        return {
            "date_format": self.date_format_combo.currentData(),
            "include_date": self.include_date_check.isChecked(),
            "project_code": self.project_code_input.text().strip(),
            "include_project": self.include_project_check.isChecked(),
            "day_prefix": self.day_prefix_input.text().strip() or "Day",
            "include_day": self.include_day_check.isChecked(),
            "separator": self.separator_combo.currentData(),
            "camera_prefix": self.camera_prefix_input.text().strip() or "Cam",
            "audio_folder_name": self.audio_folder_input.text().strip() or "Audio",
        }

    def _update_preview(self):
        """Update the preview based on current settings."""
        settings = self._get_current_settings()
        convention = NamingConvention.from_dict(settings)

        # Build preview with example data
        date = datetime.now()
        day_number = 1

        parent = convention.build_parent_folder(date, day_number)

        # Build subfolder examples
        camera_prefix = settings["camera_prefix"]
        audio_name = settings["audio_folder_name"]

        lines = [
            f"{parent}/",
            f"  {camera_prefix}A/",
            f"  {camera_prefix}B/",
            f"  {audio_name}/",
        ]

        self.preview_label.setText("\n".join(lines))

    def _on_save(self):
        """Handle save button click."""
        settings = self._get_current_settings()
        self.convention_saved.emit(settings)
        self.accept()

    def get_settings(self) -> dict:
        """Get the current settings (after dialog closes)."""
        return self._get_current_settings()
