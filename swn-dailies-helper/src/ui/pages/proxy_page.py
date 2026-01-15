"""
Proxy page - Adobe Media Encoder-style transcoding interface.

Displays queue with status, manages presets, and shows encoding progress.
Supports local proxy generation before upload with full customization.
"""
from pathlib import Path
from typing import Optional
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QProgressBar,
    QScrollArea,
    QSizePolicy,
    QComboBox,
    QLineEdit,
    QCheckBox,
    QFileDialog,
    QDialog,
    QDialogButtonBox,
    QFormLayout,
    QSpinBox,
    QGroupBox,
    QRadioButton,
    QButtonGroup,
    QStackedWidget,
    QSplitter,
)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal
from PyQt6.QtGui import QFont

from src.services.config import ConfigManager
from src.services.proxy_queue import ProxyQueue, ProxyQueueItem, get_proxy_queue
from src.services.proxy_transcoder import ProxyTranscoder
from src.models.transcode_presets import (
    TranscodePreset,
    TranscodeSettings,
    PresetManager,
    BUILTIN_PRESETS,
    CODECS,
    RESOLUTIONS,
    SPEED_PRESETS,
)
from src.ui.styles import COLORS


def format_size(size_bytes: int) -> str:
    """Format bytes to human-readable string."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


class QueueTableWidget(QTableWidget):
    """Table showing the transcode queue."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setup_table()

    def setup_table(self):
        """Initialize the table."""
        self.setColumnCount(5)
        self.setHorizontalHeaderLabels(["Status", "File", "Size", "Preset", "Progress"])

        # Column sizing
        header = self.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)

        self.setColumnWidth(0, 80)
        self.setColumnWidth(2, 100)
        self.setColumnWidth(3, 140)
        self.setColumnWidth(4, 120)

        # Styling
        self.setAlternatingRowColors(True)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.verticalHeader().setVisible(False)

        self.setStyleSheet(f"""
            QTableWidget {{
                background-color: {COLORS['charcoal-black']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                gridline-color: {COLORS['border-gray']};
            }}
            QTableWidget::item {{
                padding: 8px;
                color: {COLORS['bone-white']};
            }}
            QTableWidget::item:alternate {{
                background-color: {COLORS['charcoal-light']};
            }}
            QTableWidget::item:selected {{
                background-color: {COLORS['blue']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
                font-weight: bold;
            }}
        """)

    def update_queue(self, items: list[ProxyQueueItem], preset_manager: PresetManager):
        """Update table with queue items."""
        self.setRowCount(len(items))

        for row, item in enumerate(items):
            # Status icon and text
            status_icons = {
                "queued": "⏳",
                "processing": "🔄",
                "completed": "✓",
                "failed": "✗",
            }
            status_colors = {
                "queued": COLORS['muted-gray'],
                "processing": COLORS['blue'],
                "completed": COLORS['green'],
                "failed": COLORS['orange'],
            }

            # Find current processing quality
            current_quality = ""
            for output in item.outputs:
                if output.status == "processing":
                    current_quality = output.quality
                    break

            status_text = status_icons.get(item.status, "?")
            if current_quality:
                status_text = f"🔄 {current_quality}"

            status_item = QTableWidgetItem(status_text)
            status_item.setForeground(Qt.GlobalColor.white)
            self.setItem(row, 0, status_item)

            # File name
            file_item = QTableWidgetItem(item.file_name)
            self.setItem(row, 1, file_item)

            # Size
            size_item = QTableWidgetItem(format_size(item.file_size))
            size_item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
            self.setItem(row, 2, size_item)

            # Preset name
            preset = preset_manager.get_preset(item.preset_id)
            preset_name = preset.name if preset else item.preset_id
            preset_item = QTableWidgetItem(preset_name)
            self.setItem(row, 3, preset_item)

            # Progress
            if item.status == "completed":
                progress_text = "100%"
            elif item.status == "failed":
                progress_text = "Failed"
            elif item.status == "processing":
                # Calculate overall progress from outputs
                total = len(item.outputs)
                completed = sum(1 for o in item.outputs if o.status == "completed")
                current = 0
                for o in item.outputs:
                    if o.status == "processing":
                        current = o.progress
                        break
                overall = ((completed * 100) + current) / total if total > 0 else 0
                progress_text = f"{overall:.0f}%"
            else:
                progress_text = "--"

            progress_item = QTableWidgetItem(progress_text)
            progress_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.setItem(row, 4, progress_item)


class OutputSettingsPanel(QFrame):
    """Panel for output settings and preset selection."""

    preset_changed = pyqtSignal(str)  # Emits preset_id

    def __init__(self, preset_manager: PresetManager, parent=None):
        super().__init__(parent)
        self.preset_manager = preset_manager
        self.setObjectName("settings-panel")
        self.setStyleSheet(f"""
            #settings-panel {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                padding: 16px;
            }}
        """)
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        # Title
        title = QLabel("Output Settings")
        title.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 14px; font-weight: bold;")
        layout.addWidget(title)

        # Preset selector
        preset_row = QHBoxLayout()
        preset_label = QLabel("Preset:")
        preset_label.setStyleSheet(f"color: {COLORS['bone-white']};")
        preset_label.setFixedWidth(80)
        preset_row.addWidget(preset_label)

        self.preset_combo = QComboBox()
        self.preset_combo.setMaxVisibleItems(10)  # Make dropdown scrollable
        self.preset_combo.setStyleSheet(f"""
            QComboBox {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 6px 12px;
                min-width: 200px;
            }}
            QComboBox::drop-down {{
                border: none;
            }}
            QComboBox::down-arrow {{
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid {COLORS['bone-white']};
                margin-right: 8px;
            }}
            QComboBox QAbstractItemView {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                selection-background-color: {COLORS['blue']};
            }}
        """)
        self._populate_presets()
        self.preset_combo.currentIndexChanged.connect(self._on_preset_changed)
        preset_row.addWidget(self.preset_combo, 1)

        # Custom preset button
        self.custom_btn = QPushButton("+ Custom")
        self.custom_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.custom_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {COLORS['blue']};
                border: 1px solid {COLORS['blue']};
                border-radius: 4px;
                padding: 6px 12px;
            }}
            QPushButton:hover {{
                background-color: {COLORS['blue']};
                color: {COLORS['bone-white']};
            }}
        """)
        self.custom_btn.clicked.connect(self._show_custom_dialog)
        preset_row.addWidget(self.custom_btn)

        layout.addLayout(preset_row)

        # Output folder
        folder_row = QHBoxLayout()
        folder_label = QLabel("Output:")
        folder_label.setStyleSheet(f"color: {COLORS['bone-white']};")
        folder_label.setFixedWidth(80)
        folder_row.addWidget(folder_label)

        self.folder_edit = QLineEdit()
        self.folder_edit.setText(str(Path.home() / ".swn-dailies-helper" / "proxies"))
        self.folder_edit.setStyleSheet(f"""
            QLineEdit {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 6px 12px;
            }}
        """)
        folder_row.addWidget(self.folder_edit, 1)

        browse_btn = QPushButton("Browse")
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        browse_btn.clicked.connect(self._browse_folder)
        folder_row.addWidget(browse_btn)

        layout.addLayout(folder_row)

        # Options row
        options_row = QHBoxLayout()

        self.auto_queue_cb = QCheckBox("Auto-queue from offload")
        self.auto_queue_cb.setStyleSheet(f"color: {COLORS['bone-white']};")
        self.auto_queue_cb.setChecked(True)
        options_row.addWidget(self.auto_queue_cb)

        self.keep_local_cb = QCheckBox("Keep local copies after upload")
        self.keep_local_cb.setStyleSheet(f"color: {COLORS['bone-white']};")
        options_row.addWidget(self.keep_local_cb)

        options_row.addStretch()
        layout.addLayout(options_row)

    def _populate_presets(self):
        """Populate the preset combo box."""
        self.preset_combo.clear()

        # Required presets first
        for preset_id, preset in self.preset_manager.get_all_presets().items():
            if preset.required_for_upload:
                label = f"{preset.name} (Required)"
                self.preset_combo.addItem(label, preset_id)

        self.preset_combo.insertSeparator(self.preset_combo.count())

        # Optional presets
        for preset_id, preset in self.preset_manager.get_all_presets().items():
            if not preset.required_for_upload:
                self.preset_combo.addItem(preset.name, preset_id)

    def _on_preset_changed(self, index: int):
        """Handle preset selection change."""
        preset_id = self.preset_combo.currentData()
        if preset_id:
            self.preset_changed.emit(preset_id)

    def _browse_folder(self):
        """Open folder browser."""
        folder = QFileDialog.getExistingDirectory(
            self, "Select Output Folder", self.folder_edit.text()
        )
        if folder:
            self.folder_edit.setText(folder)

    def _show_custom_dialog(self):
        """Show custom preset dialog."""
        dialog = CustomPresetDialog(self.preset_manager, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            self._populate_presets()
            # Select the new preset
            new_id = dialog.get_created_preset_id()
            if new_id:
                idx = self.preset_combo.findData(new_id)
                if idx >= 0:
                    self.preset_combo.setCurrentIndex(idx)

    def get_selected_preset_id(self) -> str:
        """Get the currently selected preset ID."""
        return self.preset_combo.currentData() or "web_player"

    def get_output_folder(self) -> str:
        """Get the output folder path."""
        return self.folder_edit.text()


class CurrentJobPanel(QFrame):
    """Panel showing current encoding job details."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("current-job")
        self.setStyleSheet(f"""
            #current-job {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                padding: 16px;
            }}
        """)
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(12)

        # Title
        title = QLabel("Current Job")
        title.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 14px; font-weight: bold;")
        layout.addWidget(title)

        # Job info
        self.job_label = QLabel("No active job")
        self.job_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        layout.addWidget(self.job_label)

        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setFixedHeight(12)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setStyleSheet(f"""
            QProgressBar {{
                background-color: {COLORS['charcoal-dark']};
                border: none;
                border-radius: 6px;
            }}
            QProgressBar::chunk {{
                background-color: {COLORS['blue']};
                border-radius: 6px;
            }}
        """)
        layout.addWidget(self.progress_bar)

        # Stats row
        stats_row = QHBoxLayout()

        self.progress_label = QLabel("0%")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']}; font-weight: bold;")
        stats_row.addWidget(self.progress_label)

        self.speed_label = QLabel("")
        self.speed_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        stats_row.addWidget(self.speed_label)

        stats_row.addStretch()

        self.eta_label = QLabel("")
        self.eta_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        stats_row.addWidget(self.eta_label)

        self.output_size_label = QLabel("")
        self.output_size_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        stats_row.addWidget(self.output_size_label)

        layout.addLayout(stats_row)

    def update_job(self, item: Optional[ProxyQueueItem]):
        """Update with current job info."""
        if not item or item.status != "processing":
            self.job_label.setText("No active job")
            self.job_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
            self.progress_bar.setValue(0)
            self.progress_label.setText("0%")
            self.speed_label.setText("")
            self.eta_label.setText("")
            self.output_size_label.setText("")
            return

        # Find current processing output
        current_output = None
        for output in item.outputs:
            if output.status == "processing":
                current_output = output
                break

        if current_output:
            self.job_label.setText(f"{item.file_name} → {current_output.quality}")
            self.job_label.setStyleSheet(f"color: {COLORS['bone-white']};")

            # Calculate overall progress
            total = len(item.outputs)
            completed = sum(1 for o in item.outputs if o.status == "completed")
            overall = ((completed * 100) + current_output.progress) / total if total > 0 else 0

            self.progress_bar.setValue(int(overall))
            self.progress_label.setText(f"{overall:.0f}%")
            self.speed_label.setText(f"Encoding {current_output.quality}")

            # ETA and output size would need more tracking data
            # For now just show what we have
            if current_output.output_path:
                try:
                    size = Path(current_output.output_path).stat().st_size
                    self.output_size_label.setText(f"Output: {format_size(size)}")
                except:
                    pass


class CustomPresetDialog(QDialog):
    """Dialog for creating custom transcode presets."""

    def __init__(self, preset_manager: PresetManager, parent=None):
        super().__init__(parent)
        self.preset_manager = preset_manager
        self._created_preset_id = None
        self.setWindowTitle("Create Custom Preset")
        self.setMinimumWidth(550)
        self.setMaximumHeight(800)  # Limit height to ensure it fits on screen
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
            QLabel {{
                color: {COLORS['bone-white']};
            }}
            QGroupBox {{
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                margin-top: 12px;
                padding-top: 12px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 4px;
            }}
            QComboBox, QLineEdit, QSpinBox {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 6px;
            }}
            QRadioButton {{
                color: {COLORS['bone-white']};
            }}
            QScrollArea {{
                border: none;
                background-color: {COLORS['charcoal-black']};
            }}
            QScrollBar:vertical {{
                background: {COLORS['charcoal-dark']};
                width: 12px;
                border-radius: 6px;
            }}
            QScrollBar::handle:vertical {{
                background: {COLORS['border-gray']};
                border-radius: 6px;
                min-height: 20px;
            }}
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
                height: 0;
            }}
        """)
        self.setup_ui()
        self._position_on_screen()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Create scroll area for content
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        scroll_widget = QWidget()
        layout = QVBoxLayout(scroll_widget)
        layout.setSpacing(16)
        layout.setContentsMargins(20, 20, 20, 10)

        # Preset name
        name_row = QHBoxLayout()
        name_label = QLabel("Preset Name:")
        name_label.setFixedWidth(100)
        name_row.addWidget(name_label)
        self.name_edit = QLineEdit()
        self.name_edit.setPlaceholderText("My Custom Preset")
        name_row.addWidget(self.name_edit)
        layout.addLayout(name_row)

        # Format group
        format_group = QGroupBox("Format")
        format_layout = QFormLayout(format_group)

        self.codec_combo = QComboBox()
        for codec_id, codec_info in CODECS.items():
            self.codec_combo.addItem(codec_info["name"], codec_id)
        format_layout.addRow("Codec:", self.codec_combo)

        self.container_label = QLabel(".mp4 (auto)")
        format_layout.addRow("Container:", self.container_label)
        self.codec_combo.currentIndexChanged.connect(self._update_container)

        layout.addWidget(format_group)

        # Video group
        video_group = QGroupBox("Video")
        video_layout = QFormLayout(video_group)

        self.resolution_combo = QComboBox()
        for res_name in RESOLUTIONS.keys():
            self.resolution_combo.addItem(res_name.upper() if res_name != "source" else "Source", res_name)
        self.resolution_combo.setCurrentIndex(2)  # 1080p
        video_layout.addRow("Resolution:", self.resolution_combo)

        # Custom resolution row
        custom_res_row = QHBoxLayout()
        self.custom_width = QSpinBox()
        self.custom_width.setRange(320, 7680)
        self.custom_width.setValue(1920)
        self.custom_width.setEnabled(False)
        custom_res_row.addWidget(self.custom_width)
        custom_res_row.addWidget(QLabel("x"))
        self.custom_height = QSpinBox()
        self.custom_height.setRange(240, 4320)
        self.custom_height.setValue(1080)
        self.custom_height.setEnabled(False)
        custom_res_row.addWidget(self.custom_height)
        custom_res_row.addStretch()
        video_layout.addRow("Custom:", custom_res_row)

        self.resolution_combo.currentIndexChanged.connect(self._on_resolution_changed)

        # Bitrate
        bitrate_row = QHBoxLayout()
        self.bitrate_combo = QComboBox()
        self.bitrate_combo.addItems(["Codec Default", "1M", "2.5M", "5M", "10M", "15M", "20M", "Custom"])
        bitrate_row.addWidget(self.bitrate_combo)
        self.bitrate_edit = QLineEdit()
        self.bitrate_edit.setPlaceholderText("e.g., 8M")
        self.bitrate_edit.setEnabled(False)
        self.bitrate_edit.setFixedWidth(80)
        bitrate_row.addWidget(self.bitrate_edit)
        bitrate_row.addStretch()
        self.bitrate_combo.currentIndexChanged.connect(self._on_bitrate_changed)
        video_layout.addRow("Bitrate:", bitrate_row)

        layout.addWidget(video_group)

        # Audio group
        audio_group = QGroupBox("Audio")
        audio_layout = QFormLayout(audio_group)

        self.audio_codec_combo = QComboBox()
        self.audio_codec_combo.addItems(["AAC", "PCM", "Copy"])
        audio_layout.addRow("Codec:", self.audio_codec_combo)

        self.audio_bitrate_combo = QComboBox()
        self.audio_bitrate_combo.addItems(["96k", "128k", "192k", "256k", "320k"])
        self.audio_bitrate_combo.setCurrentIndex(2)  # 192k
        audio_layout.addRow("Bitrate:", self.audio_bitrate_combo)

        layout.addWidget(audio_group)

        # Encoding group
        encoding_group = QGroupBox("Encoding Speed")
        encoding_layout = QHBoxLayout(encoding_group)

        self.speed_group = QButtonGroup(self)
        for i, (speed_id, desc) in enumerate(SPEED_PRESETS.items()):
            radio = QRadioButton(speed_id.capitalize())
            radio.setToolTip(desc)
            self.speed_group.addButton(radio, i)
            encoding_layout.addWidget(radio)
            if speed_id == "medium":
                radio.setChecked(True)

        layout.addWidget(encoding_group)

        # Color Correction (LUT/OCIO) group
        lut_group = QGroupBox("Color Correction")
        lut_layout = QVBoxLayout(lut_group)

        # Mode selection
        mode_row = QHBoxLayout()
        self.color_mode_group = QButtonGroup(self)

        self.color_none_radio = QRadioButton("None")
        self.color_none_radio.setChecked(True)
        self.color_mode_group.addButton(self.color_none_radio, 0)
        mode_row.addWidget(self.color_none_radio)

        self.color_lut_radio = QRadioButton("LUT File")
        self.color_mode_group.addButton(self.color_lut_radio, 1)
        mode_row.addWidget(self.color_lut_radio)

        self.color_ocio_radio = QRadioButton("OCIO Config")
        self.color_mode_group.addButton(self.color_ocio_radio, 2)
        mode_row.addWidget(self.color_ocio_radio)

        mode_row.addStretch()
        lut_layout.addLayout(mode_row)

        # LUT file options (shown when LUT mode selected)
        self.lut_frame = QFrame()
        lut_frame_layout = QHBoxLayout(self.lut_frame)
        lut_frame_layout.setContentsMargins(0, 8, 0, 0)
        lut_file_label = QLabel("LUT File:")
        lut_file_label.setFixedWidth(80)
        lut_frame_layout.addWidget(lut_file_label)
        self.lut_path_edit = QLineEdit()
        self.lut_path_edit.setPlaceholderText("Select .cube or .3dl LUT file...")
        lut_frame_layout.addWidget(self.lut_path_edit)
        self.lut_browse_btn = QPushButton("Browse...")
        self.lut_browse_btn.clicked.connect(self._browse_lut)
        lut_frame_layout.addWidget(self.lut_browse_btn)
        self.lut_frame.setVisible(False)
        lut_layout.addWidget(self.lut_frame)

        # OCIO options (shown when OCIO mode selected)
        self.ocio_frame = QFrame()
        ocio_layout = QVBoxLayout(self.ocio_frame)
        ocio_layout.setContentsMargins(0, 8, 0, 0)
        ocio_layout.setSpacing(8)

        # OCIO config file row
        ocio_config_row = QHBoxLayout()
        ocio_config_label = QLabel("Config:")
        ocio_config_label.setFixedWidth(80)
        ocio_config_row.addWidget(ocio_config_label)
        self.ocio_config_edit = QLineEdit()
        self.ocio_config_edit.setPlaceholderText("Select OCIO config.ocio file...")
        ocio_config_row.addWidget(self.ocio_config_edit)
        self.ocio_config_browse = QPushButton("Browse...")
        self.ocio_config_browse.clicked.connect(self._browse_ocio_config)
        ocio_config_row.addWidget(self.ocio_config_browse)
        ocio_layout.addLayout(ocio_config_row)

        # Source color space
        ocio_source_row = QHBoxLayout()
        ocio_source_label = QLabel("Source:")
        ocio_source_label.setFixedWidth(80)
        ocio_source_row.addWidget(ocio_source_label)
        self.ocio_source_combo = QComboBox()
        self.ocio_source_combo.addItem("(Load config first)")
        ocio_source_row.addWidget(self.ocio_source_combo)
        ocio_source_row.addStretch()
        ocio_layout.addLayout(ocio_source_row)

        # Display/View
        ocio_display_row = QHBoxLayout()
        display_label = QLabel("Display:")
        display_label.setFixedWidth(80)
        ocio_display_row.addWidget(display_label)
        self.ocio_display_combo = QComboBox()
        self.ocio_display_combo.addItem("(Load config first)")
        self.ocio_display_combo.currentIndexChanged.connect(self._on_ocio_display_changed)
        ocio_display_row.addWidget(self.ocio_display_combo)

        view_label = QLabel("View:")
        view_label.setFixedWidth(40)
        ocio_display_row.addWidget(view_label)
        self.ocio_view_combo = QComboBox()
        self.ocio_view_combo.addItem("(Select display)")
        ocio_display_row.addWidget(self.ocio_view_combo)
        ocio_display_row.addStretch()
        ocio_layout.addLayout(ocio_display_row)

        self.ocio_frame.setVisible(False)
        lut_layout.addWidget(self.ocio_frame)

        # Connect mode radio buttons
        self.color_mode_group.buttonClicked.connect(self._on_color_mode_changed)

        layout.addWidget(lut_group)

        # Audio Extraction group
        audio_extract_group = QGroupBox("Audio Extraction")
        audio_extract_layout = QVBoxLayout(audio_extract_group)

        self.extract_audio_cb = QCheckBox("Extract audio track to separate file")
        self.extract_audio_cb.setStyleSheet(f"color: {COLORS['bone-white']};")
        audio_extract_layout.addWidget(self.extract_audio_cb)

        audio_extract_row = QHBoxLayout()
        audio_format_label = QLabel("Format:")
        audio_extract_row.addWidget(audio_format_label)
        self.audio_extract_format = QComboBox()
        self.audio_extract_format.addItems(["WAV", "AIFF", "MP3"])
        self.audio_extract_format.setEnabled(False)
        audio_extract_row.addWidget(self.audio_extract_format)

        audio_extract_row.addSpacing(16)
        audio_rate_label = QLabel("Sample Rate:")
        audio_extract_row.addWidget(audio_rate_label)
        self.audio_extract_rate = QComboBox()
        self.audio_extract_rate.addItems(["44100", "48000", "96000"])
        self.audio_extract_rate.setCurrentIndex(1)  # 48000
        self.audio_extract_rate.setEnabled(False)
        audio_extract_row.addWidget(self.audio_extract_rate)

        audio_extract_row.addSpacing(16)
        audio_depth_label = QLabel("Bit Depth:")
        audio_extract_row.addWidget(audio_depth_label)
        self.audio_extract_depth = QComboBox()
        self.audio_extract_depth.addItems(["16", "24", "32"])
        self.audio_extract_depth.setCurrentIndex(1)  # 24
        self.audio_extract_depth.setEnabled(False)
        audio_extract_row.addWidget(self.audio_extract_depth)

        audio_extract_row.addStretch()
        audio_extract_layout.addLayout(audio_extract_row)

        self.extract_audio_cb.toggled.connect(lambda checked: (
            self.audio_extract_format.setEnabled(checked),
            self.audio_extract_rate.setEnabled(checked),
            self.audio_extract_depth.setEnabled(checked)
        ))

        layout.addWidget(audio_extract_group)

        # Burn-in Options group
        burnin_group = QGroupBox("Burn-in Options")
        burnin_layout = QVBoxLayout(burnin_group)

        burnin_checks_row = QHBoxLayout()
        self.burn_timecode_cb = QCheckBox("Burn Timecode")
        self.burn_timecode_cb.setStyleSheet(f"color: {COLORS['bone-white']};")
        burnin_checks_row.addWidget(self.burn_timecode_cb)

        self.burn_clip_name_cb = QCheckBox("Burn Clip Name")
        self.burn_clip_name_cb.setStyleSheet(f"color: {COLORS['bone-white']};")
        burnin_checks_row.addWidget(self.burn_clip_name_cb)

        self.burn_camera_info_cb = QCheckBox("Burn Camera/Reel Info")
        self.burn_camera_info_cb.setStyleSheet(f"color: {COLORS['bone-white']};")
        burnin_checks_row.addWidget(self.burn_camera_info_cb)

        burnin_checks_row.addStretch()
        burnin_layout.addLayout(burnin_checks_row)

        burnin_options_row = QHBoxLayout()
        position_label = QLabel("Position:")
        burnin_options_row.addWidget(position_label)
        self.burn_position_combo = QComboBox()
        self.burn_position_combo.addItems(["Bottom", "Top"])
        burnin_options_row.addWidget(self.burn_position_combo)

        burnin_options_row.addSpacing(16)
        font_label = QLabel("Font Size:")
        burnin_options_row.addWidget(font_label)
        self.burn_font_size = QSpinBox()
        self.burn_font_size.setRange(12, 72)
        self.burn_font_size.setValue(32)
        burnin_options_row.addWidget(self.burn_font_size)

        burnin_options_row.addSpacing(16)
        self.burn_background_cb = QCheckBox("Semi-transparent background")
        self.burn_background_cb.setStyleSheet(f"color: {COLORS['bone-white']};")
        self.burn_background_cb.setChecked(True)
        burnin_options_row.addWidget(self.burn_background_cb)

        burnin_options_row.addStretch()
        burnin_layout.addLayout(burnin_options_row)

        layout.addWidget(burnin_group)
        layout.addStretch()

        scroll.setWidget(scroll_widget)
        main_layout.addWidget(scroll, 1)

        # Buttons (outside scroll area)
        buttons_frame = QFrame()
        buttons_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['charcoal-dark']};
                border-top: 1px solid {COLORS['border-gray']};
                padding: 10px;
            }}
        """)
        buttons_layout = QHBoxLayout(buttons_frame)
        buttons_layout.setContentsMargins(20, 12, 20, 12)

        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Cancel | QDialogButtonBox.StandardButton.Save
        )
        buttons.button(QDialogButtonBox.StandardButton.Save).setText("Save Preset")
        buttons.accepted.connect(self._save_preset)
        buttons.rejected.connect(self.reject)
        buttons_layout.addWidget(buttons)

        main_layout.addWidget(buttons_frame)

    def _update_container(self):
        """Update container label based on codec."""
        codec_id = self.codec_combo.currentData()
        codec_info = CODECS.get(codec_id, {})
        ext = codec_info.get("ext", ".mp4")
        self.container_label.setText(f"{ext} (auto)")

    def _on_resolution_changed(self, index: int):
        """Handle resolution change."""
        res = self.resolution_combo.currentData()
        is_custom = res == "custom" if "custom" in [self.resolution_combo.itemData(i) for i in range(self.resolution_combo.count())] else False
        self.custom_width.setEnabled(is_custom)
        self.custom_height.setEnabled(is_custom)

    def _on_bitrate_changed(self, index: int):
        """Handle bitrate selection change."""
        is_custom = self.bitrate_combo.currentText() == "Custom"
        self.bitrate_edit.setEnabled(is_custom)

    def _browse_lut(self):
        """Browse for LUT file."""
        lut_file, _ = QFileDialog.getOpenFileName(
            self,
            "Select LUT File",
            str(Path.home()),
            "LUT Files (*.cube *.3dl *.csp *.lut);;All Files (*)",
        )
        if lut_file:
            self.lut_path_edit.setText(lut_file)

    def _on_color_mode_changed(self, button):
        """Handle color mode radio button change."""
        mode = self.color_mode_group.id(button)
        self.lut_frame.setVisible(mode == 1)  # LUT mode
        self.ocio_frame.setVisible(mode == 2)  # OCIO mode

    def _browse_ocio_config(self):
        """Browse for OCIO config file."""
        config_file, _ = QFileDialog.getOpenFileName(
            self,
            "Select OCIO Config",
            str(Path.home()),
            "OCIO Config (config.ocio *.ocio);;All Files (*)",
        )
        if config_file:
            self.ocio_config_edit.setText(config_file)
            self._load_ocio_config(config_file)

    def _load_ocio_config(self, config_path: str):
        """Load OCIO config and populate dropdowns."""
        try:
            from src.services.color_service import get_color_service

            color_service = get_color_service()
            if not color_service.is_available:
                return

            if not color_service.load_config(config_path):
                return

            # Populate source color spaces
            self.ocio_source_combo.clear()
            for cs in color_service.get_color_spaces():
                if not cs.is_data:
                    self.ocio_source_combo.addItem(cs.name)

            # Populate displays
            self.ocio_display_combo.clear()
            displays = color_service.get_displays()
            for display in displays:
                self.ocio_display_combo.addItem(display)

            # Select default
            default_display = color_service.get_default_display()
            if default_display:
                idx = self.ocio_display_combo.findText(default_display)
                if idx >= 0:
                    self.ocio_display_combo.setCurrentIndex(idx)

        except ImportError:
            pass

    def _on_ocio_display_changed(self, index: int):
        """Handle OCIO display selection change."""
        display = self.ocio_display_combo.currentText()
        if not display or display.startswith("("):
            return

        try:
            from src.services.color_service import get_color_service

            color_service = get_color_service()
            if not color_service.is_loaded:
                return

            # Populate views for this display
            self.ocio_view_combo.clear()
            views = color_service.get_views(display)
            for view in views:
                self.ocio_view_combo.addItem(view)

            # Select default view
            default_view = color_service.get_default_view(display)
            if default_view:
                idx = self.ocio_view_combo.findText(default_view)
                if idx >= 0:
                    self.ocio_view_combo.setCurrentIndex(idx)

        except ImportError:
            pass

    def _position_on_screen(self):
        """Position the dialog within screen bounds."""
        from PyQt6.QtGui import QGuiApplication

        # Get the screen geometry
        screen = QGuiApplication.primaryScreen()
        if screen:
            screen_geometry = screen.availableGeometry()
            # Limit dialog height to 90% of screen height
            max_height = int(screen_geometry.height() * 0.9)
            if self.maximumHeight() > max_height:
                self.setMaximumHeight(max_height)

            # Center on screen if no parent, otherwise center on parent
            if self.parent():
                parent_geo = self.parent().geometry()
                x = parent_geo.x() + (parent_geo.width() - self.width()) // 2
                y = parent_geo.y() + (parent_geo.height() - self.height()) // 2

                # Ensure dialog stays within screen bounds
                x = max(screen_geometry.x(), min(x, screen_geometry.right() - self.width()))
                y = max(screen_geometry.y(), min(y, screen_geometry.bottom() - self.height()))
                self.move(x, y)
            else:
                # Center on screen
                x = screen_geometry.x() + (screen_geometry.width() - self.width()) // 2
                y = screen_geometry.y() + (screen_geometry.height() - self.height()) // 2
                self.move(x, y)

    def _save_preset(self):
        """Save the custom preset."""
        name = self.name_edit.text().strip()
        if not name:
            name = "Custom Preset"

        codec_id = self.codec_combo.currentData()
        resolution = self.resolution_combo.currentData()

        # Get bitrate
        bitrate = None
        bitrate_text = self.bitrate_combo.currentText()
        if bitrate_text == "Custom":
            bitrate = self.bitrate_edit.text().strip() or None
        elif bitrate_text != "Codec Default":
            bitrate = bitrate_text

        # Get speed
        speed_btn = self.speed_group.checkedButton()
        speed = speed_btn.text().lower() if speed_btn else "medium"

        # Get audio settings
        audio_codec = self.audio_codec_combo.currentText().lower()
        if audio_codec == "copy":
            audio_codec = "copy"
        audio_bitrate = self.audio_bitrate_combo.currentText()

        # Get color correction settings
        color_mode = self.color_mode_group.checkedId()  # 0=None, 1=LUT, 2=OCIO
        lut_enabled = False
        lut_path = None
        ocio_config = None
        ocio_source = None
        ocio_display = None
        ocio_view = None

        if color_mode == 1:  # LUT mode
            lut_enabled = True
            lut_path = self.lut_path_edit.text().strip() or None
        elif color_mode == 2:  # OCIO mode
            ocio_config = self.ocio_config_edit.text().strip() or None
            if ocio_config:
                ocio_source = self.ocio_source_combo.currentText()
                ocio_display = self.ocio_display_combo.currentText()
                ocio_view = self.ocio_view_combo.currentText()
                # Generate LUT from OCIO if we have valid settings
                if ocio_source and ocio_display and ocio_view:
                    lut_enabled = True
                    try:
                        from src.services.color_service import get_color_service
                        color_service = get_color_service()
                        if color_service.load_config(ocio_config):
                            result = color_service.generate_lut(
                                ocio_source, ocio_display, ocio_view
                            )
                            if result.success:
                                lut_path = result.lut_path
                    except:
                        pass

        # Get audio extraction settings
        extract_audio = self.extract_audio_cb.isChecked()
        audio_extract_format = self.audio_extract_format.currentText().lower()
        audio_extract_sample_rate = int(self.audio_extract_rate.currentText())
        audio_extract_bit_depth = int(self.audio_extract_depth.currentText())

        # Get burn-in settings
        burn_timecode = self.burn_timecode_cb.isChecked()
        burn_clip_name = self.burn_clip_name_cb.isChecked()
        burn_camera_info = self.burn_camera_info_cb.isChecked()
        burn_position = self.burn_position_combo.currentText().lower()
        burn_font_size = self.burn_font_size.value()
        burn_background = self.burn_background_cb.isChecked()

        # Create settings
        settings = TranscodeSettings(
            name=name,
            codec=codec_id,
            resolution=resolution,
            custom_width=self.custom_width.value() if resolution == "custom" else None,
            custom_height=self.custom_height.value() if resolution == "custom" else None,
            bitrate=bitrate,
            speed=speed,
            audio_codec=audio_codec,
            audio_bitrate=audio_bitrate,
            # LUT
            lut_enabled=lut_enabled,
            lut_path=lut_path,
            # Audio extraction
            extract_audio=extract_audio,
            audio_extract_format=audio_extract_format,
            audio_extract_sample_rate=audio_extract_sample_rate,
            audio_extract_bit_depth=audio_extract_bit_depth,
            # Burn-in
            burn_timecode=burn_timecode,
            burn_clip_name=burn_clip_name,
            burn_camera_info=burn_camera_info,
            burn_position=burn_position,
            burn_font_size=burn_font_size,
            burn_background=burn_background,
        )

        # Create preset
        preset = self.preset_manager.create_custom_preset(
            name=name,
            description=f"Custom {CODECS.get(codec_id, {}).get('name', codec_id)} preset",
            settings=[settings],
        )

        self._created_preset_id = preset.id
        self.accept()

    def get_created_preset_id(self) -> Optional[str]:
        """Get the ID of the created preset."""
        return self._created_preset_id


class ProxyPage(QWidget):
    """Adobe Media Encoder-style proxy generation page."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.preset_manager = PresetManager()
        self._queue: ProxyQueue = None
        self._transcoder: ProxyTranscoder = None
        self.setup_ui()

        # Connect to queue and transcoder
        self._connect_queue()

        # Update timer
        self.update_timer = QTimer(self)
        self.update_timer.timeout.connect(self.refresh_display)
        self.update_timer.start(500)  # Update every 500ms

    def _connect_queue(self):
        """Connect to the proxy queue and transcoder."""
        try:
            self._queue = get_proxy_queue()
            self._queue.item_added.connect(self._on_item_added)
            self._queue.item_started.connect(self._on_item_started)
            self._queue.item_completed.connect(self._on_item_completed)
            self._queue.item_failed.connect(self._on_item_failed)
            self._queue.progress_updated.connect(self._on_progress_updated)
            self._queue.queue_started.connect(self._on_queue_started)
            self._queue.queue_stopped.connect(self._on_queue_stopped)

            # Get or create the transcoder singleton
            self._transcoder = ProxyTranscoder.get_instance(self.config)
        except Exception as e:
            print(f"Could not connect to proxy queue: {e}")

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Header
        header = self.create_header()
        layout.addLayout(header)

        # Main content area with splitter
        splitter = QSplitter(Qt.Orientation.Vertical)

        # Queue section
        queue_container = QWidget()
        queue_layout = QVBoxLayout(queue_container)
        queue_layout.setContentsMargins(0, 0, 0, 0)
        queue_layout.setSpacing(8)

        # Queue header with buttons
        queue_header = QHBoxLayout()
        queue_title = QLabel("Queue")
        queue_title.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 14px; font-weight: bold;")
        queue_header.addWidget(queue_title)

        add_files_btn = QPushButton("+ Add Files")
        add_files_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_files_btn.clicked.connect(self._add_files)
        queue_header.addWidget(add_files_btn)

        add_folder_btn = QPushButton("+ Add Folder")
        add_folder_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_folder_btn.clicked.connect(self._add_folder)
        queue_header.addWidget(add_folder_btn)

        import_timeline_btn = QPushButton("Import Timeline")
        import_timeline_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        import_timeline_btn.setToolTip("Import clips from EDL, XML, or AAF timeline")
        import_timeline_btn.clicked.connect(self._import_timeline)
        queue_header.addWidget(import_timeline_btn)

        queue_header.addStretch()
        queue_layout.addLayout(queue_header)

        # Queue table
        self.queue_table = QueueTableWidget()
        queue_layout.addWidget(self.queue_table)

        splitter.addWidget(queue_container)

        # Bottom panels
        bottom_container = QWidget()
        bottom_layout = QHBoxLayout(bottom_container)
        bottom_layout.setContentsMargins(0, 0, 0, 0)
        bottom_layout.setSpacing(16)

        # Output settings
        self.output_settings = OutputSettingsPanel(self.preset_manager)
        bottom_layout.addWidget(self.output_settings, 1)

        # Current job panel
        self.current_job = CurrentJobPanel()
        bottom_layout.addWidget(self.current_job, 1)

        splitter.addWidget(bottom_container)

        # Set splitter sizes
        splitter.setSizes([400, 200])

        layout.addWidget(splitter, 1)

        # Control buttons
        controls = self.create_controls()
        layout.addLayout(controls)

    def create_header(self) -> QHBoxLayout:
        """Create the header."""
        header = QHBoxLayout()

        title_container = QVBoxLayout()
        title = QLabel("Proxy Generation")
        title.setObjectName("page-title")
        title_container.addWidget(title)

        subtitle = QLabel("Local transcoding queue")
        subtitle.setObjectName("page-subtitle")
        title_container.addWidget(subtitle)

        header.addLayout(title_container)
        header.addStretch()

        # Stats
        stats_container = QHBoxLayout()
        stats_container.setSpacing(24)

        # Queued count
        self.queued_label = QLabel("0")
        self.queued_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 20px; font-weight: bold;")
        queued_container = QVBoxLayout()
        queued_container.addWidget(self.queued_label)
        queued_text = QLabel("Queued")
        queued_text.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        queued_container.addWidget(queued_text)
        stats_container.addLayout(queued_container)

        # Processing count
        self.processing_label = QLabel("0")
        self.processing_label.setStyleSheet(f"color: {COLORS['blue']}; font-size: 20px; font-weight: bold;")
        processing_container = QVBoxLayout()
        processing_container.addWidget(self.processing_label)
        processing_text = QLabel("Processing")
        processing_text.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        processing_container.addWidget(processing_text)
        stats_container.addLayout(processing_container)

        # Completed count
        self.completed_label = QLabel("0")
        self.completed_label.setStyleSheet(f"color: {COLORS['green']}; font-size: 20px; font-weight: bold;")
        completed_container = QVBoxLayout()
        completed_container.addWidget(self.completed_label)
        completed_text = QLabel("Completed")
        completed_text.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        completed_container.addWidget(completed_text)
        stats_container.addLayout(completed_container)

        header.addLayout(stats_container)

        return header

    def create_controls(self) -> QHBoxLayout:
        """Create the bottom control buttons."""
        controls = QHBoxLayout()

        # Cancel button
        self.cancel_btn = QPushButton("Cancel Current")
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self._cancel_current)
        controls.addWidget(self.cancel_btn)

        # Clear completed
        self.clear_btn = QPushButton("Clear Completed")
        self.clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.clear_btn.clicked.connect(self._clear_completed)
        controls.addWidget(self.clear_btn)

        controls.addStretch()

        # Pause/Resume
        self.pause_btn = QPushButton("Pause All")
        self.pause_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.pause_btn.clicked.connect(self._toggle_pause)
        controls.addWidget(self.pause_btn)

        # Start Queue
        self.start_btn = QPushButton("Start Queue")
        self.start_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.start_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['blue']};
                color: {COLORS['bone-white']};
                border: none;
                border-radius: 4px;
                padding: 8px 24px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: #4A90D9;
            }}
            QPushButton:disabled {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['muted-gray']};
            }}
        """)
        self.start_btn.clicked.connect(self._start_queue)
        controls.addWidget(self.start_btn)

        return controls

    def refresh_display(self):
        """Refresh the display with current queue state."""
        if not self._queue:
            return

        # Get all items
        all_items = self._queue.get_all_items()

        # Update table
        self.queue_table.update_queue(all_items, self.preset_manager)

        # Update stats
        queued = len([i for i in all_items if i.status == "queued"])
        processing = len([i for i in all_items if i.status == "processing"])
        completed = len([i for i in all_items if i.status == "completed"])

        self.queued_label.setText(str(queued))
        self.processing_label.setText(str(processing))
        self.completed_label.setText(str(completed))

        # Update current job panel
        current = next((i for i in all_items if i.status == "processing"), None)
        self.current_job.update_job(current)

        # Update button states
        self.cancel_btn.setEnabled(processing > 0)
        self.start_btn.setEnabled(queued > 0 and not self._queue.is_running)

        if self._queue.is_running:
            self.start_btn.setText("Running...")
            self.pause_btn.setText("Pause All")
        elif self._queue.is_paused:
            self.start_btn.setText("Resume")
            self.pause_btn.setText("Resume")
        else:
            self.start_btn.setText("Start Queue")
            self.pause_btn.setText("Pause All")

    def _add_files(self):
        """Add files to the queue."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Add Files to Queue",
            str(Path.home()),
            "Video Files (*.mov *.mp4 *.mxf *.r3d *.ari *.braw);;All Files (*)",
        )

        if files and self._queue:
            preset_id = self.output_settings.get_selected_preset_id()
            for file_path in files:
                self._queue.add_file(Path(file_path), preset_id)

    def _add_folder(self):
        """Add folder to the queue."""
        folder = QFileDialog.getExistingDirectory(
            self, "Add Folder to Queue", str(Path.home())
        )

        if folder and self._queue:
            preset_id = self.output_settings.get_selected_preset_id()
            video_extensions = {".mov", ".mp4", ".mxf", ".r3d", ".ari", ".braw", ".mkv", ".avi"}

            for file_path in Path(folder).rglob("*"):
                if file_path.suffix.lower() in video_extensions:
                    self._queue.add_file(file_path, preset_id)

    def _start_queue(self):
        """Start processing the queue."""
        if self._transcoder:
            # Set output directory before starting
            output_dir = Path(self.output_settings.get_output_folder())
            self._queue.output_dir = output_dir
            output_dir.mkdir(parents=True, exist_ok=True)

            # Start the transcoder (which also starts the queue)
            self._transcoder.start()

    def _toggle_pause(self):
        """Toggle pause/resume."""
        if self._transcoder:
            if self._queue.is_paused:
                self._transcoder.resume()
            else:
                self._transcoder.pause()

    def _cancel_current(self):
        """Cancel the current job."""
        if self._transcoder and self._transcoder._worker:
            self._transcoder._worker.cancel_current()
        elif self._queue:
            self._queue.cancel_current()

    def _clear_completed(self):
        """Clear completed items from the queue."""
        if self._queue:
            self._queue.clear_completed()

    # Signal handlers
    def _on_item_added(self, item_id: str):
        self.refresh_display()

    def _on_item_started(self, item_id: str):
        self.refresh_display()

    def _on_item_completed(self, item_id: str):
        self.refresh_display()

    def _on_item_failed(self, item_id: str, error: str):
        self.refresh_display()

    def _on_progress_updated(self, item_id: str, progress: float):
        # Don't full refresh on every progress update - just update current job
        if self._queue:
            items = self._queue.get_all_items()
            current = next((i for i in items if i.id == item_id), None)
            if current:
                self.current_job.update_job(current)

    def _on_queue_started(self):
        self.refresh_display()

    def _on_queue_stopped(self):
        self.refresh_display()

    def _import_timeline(self):
        """Import clips from an EDL, XML, or AAF timeline."""
        from PyQt6.QtWidgets import QMessageBox

        # Open file dialog
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Import Timeline",
            str(Path.home()),
            "Timeline Files (*.edl *.xml *.fcpxml *.aaf *.otio);;EDL (*.edl);;Final Cut Pro XML (*.xml *.fcpxml);;AAF (*.aaf);;OpenTimelineIO (*.otio);;All Files (*)",
        )

        if not file_path:
            return

        try:
            from src.services.timeline_service import get_timeline_service
        except ImportError:
            QMessageBox.warning(
                self,
                "Timeline Import",
                "Timeline service not available. OpenTimelineIO may not be installed."
            )
            return

        timeline_service = get_timeline_service()
        if not timeline_service.is_available:
            QMessageBox.warning(
                self,
                "Timeline Import",
                "OpenTimelineIO library is not installed.\nInstall with: pip install opentimelineio"
            )
            return

        # Parse timeline
        timeline_info = timeline_service.read_timeline(file_path)
        if not timeline_info:
            QMessageBox.warning(
                self,
                "Timeline Import",
                f"Could not parse timeline file:\n{file_path}"
            )
            return

        if timeline_info.errors:
            QMessageBox.warning(
                self,
                "Timeline Import",
                f"Errors parsing timeline:\n" + "\n".join(timeline_info.errors)
            )
            return

        # Show import dialog
        dialog = TimelineImportDialog(timeline_info, self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            clips_to_add = dialog.get_selected_clips()
            if clips_to_add and self._queue:
                preset_id = self.output_settings.get_selected_preset_id()
                added = 0
                for clip in clips_to_add:
                    if clip.media_exists and clip.source_path:
                        self._queue.add_file(Path(clip.source_path), preset_id)
                        added += 1

                if added > 0:
                    QMessageBox.information(
                        self,
                        "Timeline Import",
                        f"Added {added} clip(s) to the queue."
                    )


class TimelineImportDialog(QDialog):
    """Dialog for selecting clips from an imported timeline."""

    def __init__(self, timeline_info, parent=None):
        super().__init__(parent)
        from src.services.timeline_service import TimelineInfo

        self.timeline_info: TimelineInfo = timeline_info
        self._selected_clips = []

        self.setWindowTitle(f"Import Timeline: {timeline_info.name}")
        self.setMinimumSize(700, 500)
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
            QLabel {{
                color: {COLORS['bone-white']};
            }}
        """)
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Header
        title = QLabel(f"Timeline: {self.timeline_info.name}")
        title.setStyleSheet(f"font-size: 18px; font-weight: bold; color: {COLORS['bone-white']};")
        layout.addWidget(title)

        # Stats
        stats_text = (
            f"{self.timeline_info.total_clips} clips | "
            f"{self.timeline_info.video_tracks} video tracks | "
            f"{self.timeline_info.audio_tracks} audio tracks"
        )
        if self.timeline_info.missing_media_count > 0:
            stats_text += f" | {self.timeline_info.missing_media_count} missing"
        stats = QLabel(stats_text)
        stats.setStyleSheet(f"color: {COLORS['muted-gray']};")
        layout.addWidget(stats)

        # Clips table
        self.clips_table = QTableWidget()
        self.clips_table.setColumnCount(5)
        self.clips_table.setHorizontalHeaderLabels(["", "Clip Name", "Source", "Duration", "Status"])

        header = self.clips_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(4, QHeaderView.ResizeMode.Fixed)

        self.clips_table.setColumnWidth(0, 40)
        self.clips_table.setColumnWidth(3, 100)
        self.clips_table.setColumnWidth(4, 100)

        self.clips_table.setAlternatingRowColors(True)
        self.clips_table.verticalHeader().setVisible(False)
        self.clips_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
            QTableWidget::item {{
                padding: 6px;
                color: {COLORS['bone-white']};
            }}
            QTableWidget::item:alternate {{
                background-color: {COLORS['charcoal-light']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
            }}
        """)

        self._populate_clips()
        layout.addWidget(self.clips_table, 1)

        # Selection controls
        select_row = QHBoxLayout()
        select_all_btn = QPushButton("Select All Found")
        select_all_btn.clicked.connect(self._select_all_found)
        select_row.addWidget(select_all_btn)

        deselect_all_btn = QPushButton("Deselect All")
        deselect_all_btn.clicked.connect(self._deselect_all)
        select_row.addWidget(deselect_all_btn)

        select_row.addStretch()

        self.selected_label = QLabel("0 selected")
        self.selected_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        select_row.addWidget(self.selected_label)

        layout.addLayout(select_row)

        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Cancel | QDialogButtonBox.StandardButton.Ok
        )
        buttons.button(QDialogButtonBox.StandardButton.Ok).setText("Import Selected")
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

    def _populate_clips(self):
        """Populate the clips table."""
        self.clips_table.setRowCount(len(self.timeline_info.clips))
        self._checkboxes = []

        for row, clip in enumerate(self.timeline_info.clips):
            # Checkbox
            cb = QCheckBox()
            cb.setEnabled(clip.media_exists)
            cb.setChecked(clip.media_exists)
            cb.stateChanged.connect(self._update_selection_count)
            self._checkboxes.append(cb)

            cb_widget = QWidget()
            cb_layout = QHBoxLayout(cb_widget)
            cb_layout.addWidget(cb)
            cb_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
            cb_layout.setContentsMargins(0, 0, 0, 0)
            self.clips_table.setCellWidget(row, 0, cb_widget)

            # Clip name
            name_item = QTableWidgetItem(clip.name or f"Clip {row + 1}")
            self.clips_table.setItem(row, 1, name_item)

            # Source file
            source = clip.source_file_name or clip.source_path or "Unknown"
            source_item = QTableWidgetItem(source)
            self.clips_table.setItem(row, 2, source_item)

            # Duration
            duration_str = ""
            if clip.duration:
                duration_str = clip.duration.to_timecode()
            elif clip.in_point and clip.out_point:
                secs = clip.duration_seconds
                mins = int(secs // 60)
                secs_remain = secs % 60
                duration_str = f"{mins}:{secs_remain:05.2f}"
            duration_item = QTableWidgetItem(duration_str)
            duration_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.clips_table.setItem(row, 3, duration_item)

            # Status
            if clip.media_exists:
                status_text = "Found"
                status_color = COLORS['green']
            else:
                status_text = "Missing"
                status_color = COLORS['red']

            status_item = QTableWidgetItem(status_text)
            status_item.setForeground(Qt.GlobalColor.white)
            status_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.clips_table.setItem(row, 4, status_item)

        self._update_selection_count()

    def _update_selection_count(self):
        """Update the selected count label."""
        count = sum(1 for cb in self._checkboxes if cb.isChecked())
        self.selected_label.setText(f"{count} selected")

    def _select_all_found(self):
        """Select all clips with found media."""
        for i, clip in enumerate(self.timeline_info.clips):
            if clip.media_exists:
                self._checkboxes[i].setChecked(True)
        self._update_selection_count()

    def _deselect_all(self):
        """Deselect all clips."""
        for cb in self._checkboxes:
            cb.setChecked(False)
        self._update_selection_count()

    def get_selected_clips(self):
        """Get list of selected clips."""
        selected = []
        for i, cb in enumerate(self._checkboxes):
            if cb.isChecked():
                selected.append(self.timeline_info.clips[i])
        return selected
