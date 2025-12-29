"""
Licenses page - Display third-party licenses and open source notices.

This page provides GPL compliance by showing all bundled software,
their licenses, and links to source code where required.
"""
import webbrowser
from pathlib import Path
from typing import Optional

from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QScrollArea,
    QTextEdit,
    QTabWidget,
    QMessageBox,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from src.ui.styles import COLORS


class LicensesPage(QWidget):
    """Third-party licenses and open source notices page."""

    SOURCE_CODE_URL = "https://secondwatchnetwork.com/opensource/"

    def __init__(self):
        super().__init__()
        self._licenses_dir = self._find_licenses_dir()
        self.setup_ui()

    def _find_licenses_dir(self) -> Optional[Path]:
        """Find the THIRD_PARTY_LICENSES directory."""
        import sys

        # Check if running from PyInstaller bundle
        if getattr(sys, 'frozen', False):
            base_path = Path(sys._MEIPASS)
        else:
            # Development mode
            base_path = Path(__file__).parent.parent.parent.parent

        licenses_dir = base_path / "THIRD_PARTY_LICENSES"
        if licenses_dir.exists():
            return licenses_dir
        return None

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Title
        title = QLabel("Open Source Licenses")
        title.setObjectName("page-title")
        layout.addWidget(title)

        subtitle = QLabel(
            "SWN Dailies Helper includes the following open source components. "
            "Click on a component to view its license."
        )
        subtitle.setObjectName("page-subtitle")
        subtitle.setWordWrap(True)
        layout.addWidget(subtitle)

        layout.addSpacing(10)

        # GPL Notice Card
        gpl_card = self._create_gpl_notice()
        layout.addWidget(gpl_card)

        # Tabs for different license types
        tabs = QTabWidget()
        tabs.setObjectName("license-tabs")

        # CLI Tools tab
        cli_tab = self._create_cli_tools_tab()
        tabs.addTab(cli_tab, "CLI Tools")

        # Python Libraries tab
        python_tab = self._create_python_libs_tab()
        tabs.addTab(python_tab, "Python Libraries")

        # Full License Text tab
        text_tab = self._create_license_text_tab()
        tabs.addTab(text_tab, "License Texts")

        layout.addWidget(tabs, 1)

        # Bottom buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        source_btn = QPushButton("View Source Code Offers")
        source_btn.setObjectName("primary-button")
        source_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        source_btn.clicked.connect(self._open_source_page)
        btn_layout.addWidget(source_btn)

        layout.addLayout(btn_layout)

    def _create_gpl_notice(self) -> QFrame:
        """Create the GPL compliance notice card."""
        card = QFrame()
        card.setObjectName("card")
        card.setStyleSheet(f"""
            QFrame#card {{
                border: 1px solid {COLORS['yellow']};
                background-color: rgba(255, 193, 7, 0.1);
            }}
        """)

        layout = QVBoxLayout(card)
        layout.setSpacing(10)

        title = QLabel("GPL Source Code Availability")
        title.setStyleSheet(f"font-weight: bold; color: {COLORS['yellow']};")
        layout.addWidget(title)

        notice = QLabel(
            "This software includes components licensed under the GNU General Public License (GPL). "
            "As required by the GPL, the complete source code for these components is available at:"
        )
        notice.setWordWrap(True)
        layout.addWidget(notice)

        url_label = QLabel(f'<a href="{self.SOURCE_CODE_URL}" style="color: {COLORS["bright-cyan"]};">'
                          f'{self.SOURCE_CODE_URL}</a>')
        url_label.setOpenExternalLinks(True)
        layout.addWidget(url_label)

        gpl_components = QLabel(
            "GPL-licensed components: ExifTool (GPL-1.0+), smartmontools (GPL-2.0), FFmpeg (LGPL-2.1)"
        )
        gpl_components.setObjectName("label-small")
        layout.addWidget(gpl_components)

        return card

    def _create_cli_tools_tab(self) -> QWidget:
        """Create the CLI tools tab content."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(10)

        tools = [
            {
                "name": "FFmpeg",
                "version": "7.1",
                "license": "LGPL-2.1 / GPL-2.0",
                "license_type": "gpl",
                "description": "Video/audio encoding, transcoding, and processing",
                "url": "https://ffmpeg.org/",
            },
            {
                "name": "MediaInfo",
                "version": "24.12",
                "license": "BSD-2-Clause",
                "license_type": "permissive",
                "description": "Technical and tag information about media files",
                "url": "https://mediaarea.net/",
            },
            {
                "name": "ExifTool",
                "version": "12.97",
                "license": "GPL-1.0+ / Artistic",
                "license_type": "gpl",
                "description": "Read/write metadata in image and video files",
                "url": "https://exiftool.org/",
            },
            {
                "name": "smartmontools",
                "version": "7.4",
                "license": "GPL-2.0",
                "license_type": "gpl",
                "description": "S.M.A.R.T. drive health monitoring",
                "url": "https://www.smartmontools.org/",
            },
            {
                "name": "rclone",
                "version": "1.68.2",
                "license": "MIT",
                "license_type": "permissive",
                "description": "Cloud storage sync and file transfer",
                "url": "https://rclone.org/",
            },
            {
                "name": "mhl-tool",
                "version": "1.0",
                "license": "Proprietary (free)",
                "license_type": "proprietary",
                "description": "MHL file verification by Pomfort",
                "url": "https://pomfort.com/mhl-tool/",
            },
        ]

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        scroll_widget = QWidget()
        scroll_layout = QVBoxLayout(scroll_widget)
        scroll_layout.setSpacing(10)

        for tool in tools:
            card = self._create_tool_card(tool)
            scroll_layout.addWidget(card)

        scroll_layout.addStretch()
        scroll.setWidget(scroll_widget)
        layout.addWidget(scroll)

        return widget

    def _create_python_libs_tab(self) -> QWidget:
        """Create the Python libraries tab content."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(10)

        libs = [
            {
                "name": "OpenTimelineIO",
                "version": "0.18.1",
                "license": "Apache-2.0",
                "license_type": "permissive",
                "description": "Timeline interchange for editorial workflows",
                "url": "https://opentimeline.io/",
            },
            {
                "name": "OpenColorIO",
                "version": "2.5.0",
                "license": "BSD-3-Clause",
                "license_type": "permissive",
                "description": "Color management for visual effects and animation",
                "url": "https://opencolorio.org/",
            },
            {
                "name": "ascmhl",
                "version": "1.2",
                "license": "MIT",
                "license_type": "permissive",
                "description": "ASC Media Hash List manifest generation",
                "url": "https://github.com/ascmitc/mhl",
            },
            {
                "name": "PyQt6",
                "version": "6.6+",
                "license": "GPL-3.0 / Commercial",
                "license_type": "gpl",
                "description": "Qt GUI framework bindings for Python",
                "url": "https://riverbankcomputing.com/software/pyqt/",
            },
        ]

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        scroll_widget = QWidget()
        scroll_layout = QVBoxLayout(scroll_widget)
        scroll_layout.setSpacing(10)

        for lib in libs:
            card = self._create_tool_card(lib)
            scroll_layout.addWidget(card)

        scroll_layout.addStretch()
        scroll.setWidget(scroll_widget)
        layout.addWidget(scroll)

        return widget

    def _create_license_text_tab(self) -> QWidget:
        """Create the license text viewer tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(10)

        # License selector buttons
        btn_layout = QHBoxLayout()

        licenses = [
            ("GPL-2.0", "GPL-2.0.txt"),
            ("GPL-3.0", "GPL-3.0.txt"),
            ("LGPL-2.1", "LGPL-2.1.txt"),
            ("MIT", "MIT.txt"),
            ("BSD-2-Clause", "BSD-2-Clause.txt"),
            ("BSD-3-Clause", "BSD-3-Clause.txt"),
            ("Apache-2.0", "Apache-2.0.txt"),
        ]

        for name, filename in licenses:
            btn = QPushButton(name)
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.clicked.connect(lambda checked, f=filename: self._show_license(f))
            btn_layout.addWidget(btn)

        btn_layout.addStretch()
        layout.addLayout(btn_layout)

        # Text viewer
        self.license_viewer = QTextEdit()
        self.license_viewer.setReadOnly(True)
        self.license_viewer.setFont(QFont("Courier New", 10))
        self.license_viewer.setPlaceholderText("Select a license above to view its text")
        layout.addWidget(self.license_viewer, 1)

        # Load NOTICES.md by default
        self._load_notices()

        return widget

    def _create_tool_card(self, tool: dict) -> QFrame:
        """Create a card for a single tool/library."""
        card = QFrame()
        card.setObjectName("license-card")
        card.setStyleSheet(f"""
            QFrame#license-card {{
                background-color: {COLORS['charcoal-gray']};
                border: 1px solid {COLORS['muted-gray']};
                border-radius: 8px;
                padding: 12px;
            }}
        """)

        layout = QVBoxLayout(card)
        layout.setSpacing(6)

        # Header with name and version
        header = QHBoxLayout()

        name_label = QLabel(tool["name"])
        name_label.setStyleSheet(f"font-weight: bold; font-size: 14px; color: {COLORS['bone-white']};")
        header.addWidget(name_label)

        version_label = QLabel(f"v{tool['version']}")
        version_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        header.addWidget(version_label)

        header.addStretch()

        # License badge
        license_type = tool.get("license_type", "permissive")
        if license_type == "gpl":
            badge_color = COLORS["yellow"]
            badge_text = f"GPL: {tool['license']}"
        elif license_type == "proprietary":
            badge_color = COLORS["muted-gray"]
            badge_text = tool["license"]
        else:
            badge_color = COLORS["green"]
            badge_text = tool["license"]

        badge = QLabel(badge_text)
        badge.setStyleSheet(f"""
            background-color: {badge_color};
            color: {COLORS['deep-black']};
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
        """)
        header.addWidget(badge)

        layout.addLayout(header)

        # Description
        desc = QLabel(tool["description"])
        desc.setStyleSheet(f"color: {COLORS['muted-gray']};")
        desc.setWordWrap(True)
        layout.addWidget(desc)

        # URL link
        if tool.get("url"):
            url_label = QLabel(f'<a href="{tool["url"]}" style="color: {COLORS["bright-cyan"]};">'
                              f'{tool["url"]}</a>')
            url_label.setOpenExternalLinks(True)
            layout.addWidget(url_label)

        return card

    def _show_license(self, filename: str):
        """Load and display a license file."""
        if not self._licenses_dir:
            self.license_viewer.setPlainText(
                f"License files not found.\n\n"
                f"See: {self.SOURCE_CODE_URL}"
            )
            return

        file_path = self._licenses_dir / filename
        if file_path.exists():
            try:
                content = file_path.read_text(encoding="utf-8")
                self.license_viewer.setPlainText(content)
            except Exception as e:
                self.license_viewer.setPlainText(f"Error reading license: {e}")
        else:
            self.license_viewer.setPlainText(f"License file not found: {filename}")

    def _load_notices(self):
        """Load the NOTICES.md file."""
        if not self._licenses_dir:
            return

        notices_path = self._licenses_dir / "NOTICES.md"
        if notices_path.exists():
            try:
                content = notices_path.read_text(encoding="utf-8")
                self.license_viewer.setPlainText(content)
            except Exception:
                pass

    def _open_source_page(self):
        """Open the source code offers page in browser."""
        try:
            webbrowser.open(self.SOURCE_CODE_URL)
        except Exception as e:
            QMessageBox.warning(
                self,
                "Could Not Open Browser",
                f"Please visit: {self.SOURCE_CODE_URL}\n\nError: {e}"
            )
