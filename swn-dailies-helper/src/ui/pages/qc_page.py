"""
QC Page - Quality Control analysis interface.

Provides FFmpeg-based detection for:
- Black frames
- Audio silence
- Audio clipping
- File integrity issues
"""
from pathlib import Path
from typing import Optional, List
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
    QSplitter,
    QCheckBox,
    QSpinBox,
    QGroupBox,
    QFileDialog,
    QTextEdit,
    QComboBox,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont, QColor

from src.services.config import ConfigManager
from src.services.qc_checker import QCChecker, QCResult, QCFlag, QCSummary
from src.services.metadata_extractor import MetadataExtractor, ClipMetadata
from src.ui.styles import COLORS


class QCAnalysisWorker(QThread):
    """Background worker for running QC analysis."""

    progress = pyqtSignal(int, int)  # current, total
    file_started = pyqtSignal(str)  # filename
    file_completed = pyqtSignal(str, object, object, object)  # filename, QCResult, mediainfo_details, ClipMetadata
    all_completed = pyqtSignal(list, object)  # results, summary
    error = pyqtSignal(str, str)  # filename, error message

    def __init__(
        self,
        files: List[str],
        check_black_frames: bool = True,
        check_silence: bool = True,
        check_clipping: bool = True,
        check_vfr: bool = True,
        check_bitrate: bool = True,
        check_hdr: bool = True,
        black_threshold: float = 0.1,
        silence_threshold: float = -50.0,
    ):
        super().__init__()
        self.files = files
        self.check_black_frames = check_black_frames
        self.check_silence = check_silence
        self.check_clipping = check_clipping
        self.check_vfr = check_vfr
        self.check_bitrate = check_bitrate
        self.check_hdr = check_hdr
        self.black_threshold = black_threshold
        self.silence_threshold = silence_threshold
        self._cancelled = False

    def cancel(self):
        self._cancelled = True

    def run(self):
        qc_checker = QCChecker()
        metadata_extractor = MetadataExtractor()

        all_results = []
        all_metadata = []

        for i, file_path in enumerate(self.files):
            if self._cancelled:
                break

            filename = Path(file_path).name
            self.file_started.emit(filename)
            self.progress.emit(i, len(self.files))

            try:
                # Extract metadata
                metadata = metadata_extractor.extract(file_path)
                all_metadata.append(metadata)

                # Run basic QC check
                result = qc_checker.check_clip(metadata)

                # Run FFmpeg-based checks
                ffmpeg_flags = qc_checker.run_ffmpeg_qc(
                    file_path=file_path,
                    filename=filename,
                    check_black_frames=self.check_black_frames,
                    check_silence=self.check_silence,
                    check_clipping=self.check_clipping,
                    black_frame_threshold=self.black_threshold,
                    silence_threshold_db=self.silence_threshold,
                )

                # Add FFmpeg flags to result
                result.flags.extend(ffmpeg_flags)

                # Run MediaInfo-based checks
                mediainfo_details = None
                mediainfo_flags = []
                if self.check_vfr or self.check_bitrate or self.check_hdr:
                    mediainfo_flags, mediainfo_details = qc_checker.run_mediainfo_qc(
                        file_path=file_path,
                        filename=filename,
                        check_vfr=self.check_vfr,
                        check_bitrate=self.check_bitrate,
                        check_hdr=self.check_hdr,
                    )
                    result.flags.extend(mediainfo_flags)

                # Update status based on all new flags
                all_new_flags = ffmpeg_flags + mediainfo_flags
                if any(f.severity == "critical" for f in all_new_flags):
                    result.status = "fail"
                elif any(f.severity == "warning" for f in all_new_flags) and result.status == "pass":
                    result.status = "warning"

                all_results.append(result)
                self.file_completed.emit(filename, result, mediainfo_details, metadata)

            except Exception as e:
                self.error.emit(filename, str(e))

        # Generate summary
        if all_results:
            _, summary = qc_checker.check_batch(all_metadata, check_consistency=False)
            # Recalculate with all flags
            summary.total_clips = len(all_results)
            summary.passed = sum(1 for r in all_results if r.status == "pass")
            summary.warnings = sum(1 for r in all_results if r.status == "warning")
            summary.failed = sum(1 for r in all_results if r.status == "fail")
        else:
            summary = QCSummary(0, 0, 0, 0, {}, {})

        self.progress.emit(len(self.files), len(self.files))
        self.all_completed.emit(all_results, summary)


class QCResultsTable(QTableWidget):
    """Table displaying QC analysis results."""

    file_selected = pyqtSignal(str, object, object, object)  # filepath, QCResult, mediainfo_details, ClipMetadata

    def __init__(self, parent=None):
        super().__init__(parent)
        self.results_map = {}  # filepath -> QCResult
        self.mediainfo_map = {}  # filepath -> mediainfo_details
        self.metadata_map = {}  # filepath -> ClipMetadata
        self.setup_table()

    def setup_table(self):
        self.setColumnCount(4)
        self.setHorizontalHeaderLabels(["Status", "File", "Issues", "Severity"])

        header = self.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        header.setSectionResizeMode(3, QHeaderView.ResizeMode.Fixed)

        self.setColumnWidth(0, 80)
        self.setColumnWidth(2, 80)
        self.setColumnWidth(3, 100)

        self.setAlternatingRowColors(True)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.verticalHeader().setVisible(False)

        self.itemSelectionChanged.connect(self._on_selection_changed)

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

    def add_result(self, result: QCResult, mediainfo_details: Optional[dict] = None, clip_metadata = None):
        """Add a QC result to the table."""
        self.results_map[result.clip_path] = result
        if mediainfo_details:
            self.mediainfo_map[result.clip_path] = mediainfo_details
        if clip_metadata:
            self.metadata_map[result.clip_path] = clip_metadata

        row = self.rowCount()
        self.insertRow(row)

        # Status icon
        status_icons = {
            "pass": ("✓", COLORS['green']),
            "warning": ("⚠", COLORS['orange']),
            "fail": ("✗", "#FF4444"),
        }
        icon, color = status_icons.get(result.status, ("?", COLORS['muted-gray']))
        status_item = QTableWidgetItem(icon)
        status_item.setForeground(QColor(color))
        status_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        status_item.setData(Qt.ItemDataRole.UserRole, result.clip_path)
        self.setItem(row, 0, status_item)

        # Filename
        file_item = QTableWidgetItem(result.clip_filename)
        self.setItem(row, 1, file_item)

        # Issue count
        issues_item = QTableWidgetItem(str(len(result.flags)))
        issues_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        self.setItem(row, 2, issues_item)

        # Severity
        if result.status == "fail":
            severity = "Critical"
        elif result.status == "warning":
            severity = "Warning"
        else:
            severity = "--"
        severity_item = QTableWidgetItem(severity)
        severity_item.setForeground(QColor(color))
        self.setItem(row, 3, severity_item)

    def clear_results(self):
        """Clear all results."""
        self.setRowCount(0)
        self.results_map.clear()
        self.mediainfo_map.clear()
        self.metadata_map.clear()

    def _on_selection_changed(self):
        selected = self.selectedItems()
        if selected:
            row = selected[0].row()
            filepath = self.item(row, 0).data(Qt.ItemDataRole.UserRole)
            result = self.results_map.get(filepath)
            mediainfo = self.mediainfo_map.get(filepath)
            clip_metadata = self.metadata_map.get(filepath)
            if result:
                self.file_selected.emit(filepath, result, mediainfo, clip_metadata)


class IssueDetailsPanel(QFrame):
    """Panel showing detailed issues for selected file."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("details-panel")
        self.setStyleSheet(f"""
            #details-panel {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                padding: 12px;
            }}
        """)
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(8)

        # Title
        self.title_label = QLabel("Issue Details")
        self.title_label.setStyleSheet(f"color: {COLORS['bone-white']}; font-size: 14px; font-weight: bold;")
        layout.addWidget(self.title_label)

        # Tab selector for Issues, Technical Info, Camera
        tab_layout = QHBoxLayout()
        self.issues_tab = QPushButton("Issues")
        self.issues_tab.setCheckable(True)
        self.issues_tab.setChecked(True)
        self.issues_tab.clicked.connect(lambda: self._switch_tab("issues"))
        self.issues_tab.setStyleSheet(self._tab_style(True))
        tab_layout.addWidget(self.issues_tab)

        self.tech_tab = QPushButton("Technical Info")
        self.tech_tab.setCheckable(True)
        self.tech_tab.clicked.connect(lambda: self._switch_tab("tech"))
        self.tech_tab.setStyleSheet(self._tab_style(False))
        tab_layout.addWidget(self.tech_tab)

        self.camera_tab = QPushButton("Camera")
        self.camera_tab.setCheckable(True)
        self.camera_tab.clicked.connect(lambda: self._switch_tab("camera"))
        self.camera_tab.setStyleSheet(self._tab_style(False))
        tab_layout.addWidget(self.camera_tab)

        tab_layout.addStretch()
        layout.addLayout(tab_layout)

        # Details text area
        self.details_text = QTextEdit()
        self.details_text.setReadOnly(True)
        self.details_text.setStyleSheet(f"""
            QTextEdit {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 8px;
                font-family: monospace;
            }}
        """)
        layout.addWidget(self.details_text)

        # Store current data for tab switching
        self._current_result = None
        self._current_mediainfo = None
        self._current_metadata = None
        self._current_tab = "issues"

    def _tab_style(self, active: bool) -> str:
        """Get style for tab button."""
        if active:
            return f"""
                QPushButton {{
                    background-color: {COLORS['blue']};
                    color: {COLORS['bone-white']};
                    border: none;
                    border-radius: 4px;
                    padding: 4px 12px;
                    font-weight: bold;
                }}
            """
        return f"""
            QPushButton {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['muted-gray']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 4px 12px;
            }}
            QPushButton:hover {{
                color: {COLORS['bone-white']};
            }}
        """

    def _switch_tab(self, tab: str):
        """Switch between issues, technical info, and camera tabs."""
        self._current_tab = tab
        self.issues_tab.setChecked(tab == "issues")
        self.tech_tab.setChecked(tab == "tech")
        self.camera_tab.setChecked(tab == "camera")
        self.issues_tab.setStyleSheet(self._tab_style(tab == "issues"))
        self.tech_tab.setStyleSheet(self._tab_style(tab == "tech"))
        self.camera_tab.setStyleSheet(self._tab_style(tab == "camera"))
        self._update_display()

    def _update_display(self):
        """Update the display based on current tab."""
        if self._current_tab == "issues":
            self._show_issues()
        elif self._current_tab == "tech":
            self._show_technical_info()
        else:
            self._show_camera_info()

    def _show_issues(self):
        """Display issues for the current result."""
        if not self._current_result:
            self.details_text.setText("No file selected.")
            return

        if not self._current_result.flags:
            self.details_text.setText("No issues detected.")
            return

        lines = []
        for flag in self._current_result.flags:
            severity_colors = {
                "critical": "#FF4444",
                "warning": COLORS['orange'],
                "info": COLORS['blue'],
            }
            color = severity_colors.get(flag.severity, COLORS['muted-gray'])

            lines.append(f'<span style="color: {color}; font-weight: bold;">[{flag.severity.upper()}]</span> '
                        f'{flag.message}')

            if flag.details:
                for key, value in flag.details.items():
                    lines.append(f'  <span style="color: {COLORS["muted-gray"]}">{key}:</span> {value}')

            lines.append("")

        self.details_text.setHtml("<br>".join(lines))

    def _show_technical_info(self):
        """Display technical info from MediaInfo."""
        if not self._current_mediainfo:
            self.details_text.setText("Technical info not available.\n\nMediaInfo analysis was not run for this file.")
            return

        lines = []
        info = self._current_mediainfo

        # Container info
        container = info.get("container", {})
        if container:
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">CONTAINER</span>')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Format:</span> {container.get("format", "N/A")}')
            if container.get("format_profile"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Profile:</span> {container.get("format_profile")}')
            if container.get("overall_bitrate"):
                bitrate_mbps = container.get("overall_bitrate", 0) / 1_000_000
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Overall Bitrate:</span> {bitrate_mbps:.1f} Mbps')
            if container.get("duration_ms"):
                duration_sec = container.get("duration_ms", 0) / 1000
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Duration:</span> {duration_sec:.2f}s')
            lines.append("")

        # Video tracks
        for i, video in enumerate(info.get("video_tracks", [])):
            track_label = f"VIDEO TRACK {i+1}" if len(info.get("video_tracks", [])) > 1 else "VIDEO"
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">{track_label}</span>')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Codec:</span> {video.get("codec", "N/A")}')
            if video.get("codec_id"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Codec ID:</span> {video.get("codec_id")}')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Resolution:</span> {video.get("width", 0)}x{video.get("height", 0)}')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Frame Rate:</span> {video.get("frame_rate", 0)} fps ({video.get("frame_rate_mode", "CFR")})')
            if video.get("bit_depth"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Bit Depth:</span> {video.get("bit_depth")}-bit')
            if video.get("bit_rate"):
                bitrate_mbps = video.get("bit_rate", 0) / 1_000_000
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Bitrate:</span> {bitrate_mbps:.1f} Mbps')
            if video.get("color_space"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Color Space:</span> {video.get("color_space")}')
            if video.get("chroma_subsampling"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Chroma:</span> {video.get("chroma_subsampling")}')
            if video.get("scan_type") and video.get("scan_type") != "Progressive":
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Scan Type:</span> {video.get("scan_type")}')
            if video.get("hdr_format"):
                lines.append(f'<span style="color: {COLORS["orange"]}; font-weight: bold;">HDR:</span> {video.get("hdr_format")}')
            if video.get("transfer_characteristics"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Transfer:</span> {video.get("transfer_characteristics")}')
            if video.get("color_primaries"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Primaries:</span> {video.get("color_primaries")}')
            lines.append("")

        # Audio tracks
        for i, audio in enumerate(info.get("audio_tracks", [])):
            track_label = f"AUDIO TRACK {i+1}" if len(info.get("audio_tracks", [])) > 1 else "AUDIO"
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">{track_label}</span>')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Codec:</span> {audio.get("codec", "N/A")}')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Channels:</span> {audio.get("channels", 0)} ({audio.get("channel_layout", "N/A")})')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Sample Rate:</span> {audio.get("sample_rate", 0)} Hz')
            if audio.get("bit_depth"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Bit Depth:</span> {audio.get("bit_depth")}-bit')
            if audio.get("bit_rate"):
                bitrate_kbps = audio.get("bit_rate", 0) / 1000
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Bitrate:</span> {bitrate_kbps:.0f} kbps')
            if audio.get("language"):
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Language:</span> {audio.get("language")}')
            lines.append("")

        self.details_text.setHtml("<br>".join(lines))

    def _show_camera_info(self):
        """Display camera metadata from ClipMetadata."""
        if not self._current_metadata:
            self.details_text.setText("Camera info not available.\n\nMetadata was not extracted for this file.")
            return

        lines = []
        meta = self._current_metadata

        # Camera Body
        lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">CAMERA</span>')
        if meta.camera_make:
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Make:</span> {meta.camera_make}')
        if meta.camera_model:
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Model:</span> {meta.camera_model}')
        if meta.camera_serial:
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Serial:</span> {meta.camera_serial}')
        if meta.reel:
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Reel:</span> {meta.reel}')
        if meta.clip_number:
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Clip:</span> {meta.clip_number}')
        if not any([meta.camera_make, meta.camera_model, meta.camera_serial]):
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">No camera body info available</span>')
        lines.append("")

        # Lens
        if meta.lens_model or meta.lens_serial or meta.focal_length or meta.aperture:
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">LENS</span>')
            if meta.lens_model:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Model:</span> {meta.lens_model}')
            if meta.lens_serial:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Serial:</span> {meta.lens_serial}')
            if meta.focal_length:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Focal Length:</span> {meta.focal_length}')
            if meta.aperture:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Aperture:</span> {meta.aperture}')
            lines.append("")

        # Exposure Settings
        if meta.iso or meta.shutter_speed or meta.white_balance:
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">EXPOSURE</span>')
            if meta.iso:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">ISO:</span> {meta.iso}')
            if meta.shutter_speed:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Shutter:</span> {meta.shutter_speed}')
            if meta.white_balance:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">White Balance:</span> {meta.white_balance}')
            lines.append("")

        # Color/Format
        if meta.color_space or meta.pixel_format:
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">COLOR</span>')
            if meta.color_space:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Color Space:</span> {meta.color_space}')
            if meta.pixel_format:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Pixel Format:</span> {meta.pixel_format}')
            lines.append("")

        # GPS (if available)
        if meta.gps_latitude is not None or meta.gps_longitude is not None:
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">GPS LOCATION</span>')
            if meta.gps_latitude is not None and meta.gps_longitude is not None:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Coordinates:</span> {meta.gps_latitude:.6f}, {meta.gps_longitude:.6f}')
            if meta.gps_altitude is not None:
                lines.append(f'<span style="color: {COLORS["muted-gray"]}">Altitude:</span> {meta.gps_altitude:.1f}m')
            lines.append("")

        # Timecode
        if meta.timecode_start:
            lines.append(f'<span style="color: {COLORS["blue"]}; font-weight: bold;">TIMECODE</span>')
            lines.append(f'<span style="color: {COLORS["muted-gray"]}">Start:</span> {meta.timecode_start}')
            lines.append("")

        if not lines or all(line == "" for line in lines):
            lines = ["No camera metadata available for this file."]

        self.details_text.setHtml("<br>".join(lines))

    def show_result(self, result: QCResult, mediainfo_details: Optional[dict] = None, clip_metadata = None):
        """Display issues for a QC result."""
        self.title_label.setText(f"Details - {result.clip_filename}")
        self._current_result = result
        self._current_mediainfo = mediainfo_details
        self._current_metadata = clip_metadata

        # Enable/disable tech tab based on availability
        if mediainfo_details:
            self.tech_tab.setEnabled(True)
            self.tech_tab.setToolTip("")
        else:
            self.tech_tab.setEnabled(False)
            self.tech_tab.setToolTip("Technical info not available for this file")

        # Enable/disable camera tab based on availability
        has_camera_info = clip_metadata and (
            clip_metadata.camera_make or clip_metadata.camera_model or
            clip_metadata.lens_model or clip_metadata.iso
        )
        if has_camera_info:
            self.camera_tab.setEnabled(True)
            self.camera_tab.setToolTip("")
        else:
            self.camera_tab.setEnabled(False)
            self.camera_tab.setToolTip("Camera info not available for this file")

        self._update_display()

    def clear(self):
        """Clear the details panel."""
        self.title_label.setText("Issue Details")
        self.details_text.clear()
        self._current_result = None
        self._current_mediainfo = None
        self._current_metadata = None
        self._switch_tab("issues")


class QCPage(QWidget):
    """Quality Control analysis page."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.files_to_analyze = []
        self.worker = None
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Header
        header = self.create_header()
        layout.addLayout(header)

        # Main splitter
        splitter = QSplitter(Qt.Orientation.Vertical)

        # Top section: file list and controls
        top_container = QWidget()
        top_layout = QVBoxLayout(top_container)
        top_layout.setContentsMargins(0, 0, 0, 0)
        top_layout.setSpacing(8)

        # File controls
        file_controls = QHBoxLayout()

        add_files_btn = QPushButton("+ Add Files")
        add_files_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_files_btn.clicked.connect(self._add_files)
        file_controls.addWidget(add_files_btn)

        add_folder_btn = QPushButton("+ Add Folder")
        add_folder_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_folder_btn.clicked.connect(self._add_folder)
        file_controls.addWidget(add_folder_btn)

        file_controls.addStretch()

        self.clear_btn = QPushButton("Clear All")
        self.clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.clear_btn.clicked.connect(self._clear_all)
        file_controls.addWidget(self.clear_btn)

        top_layout.addLayout(file_controls)

        # Results table
        self.results_table = QCResultsTable()
        self.results_table.file_selected.connect(self._on_file_selected)
        top_layout.addWidget(self.results_table)

        splitter.addWidget(top_container)

        # Bottom section: options and details
        bottom_container = QWidget()
        bottom_layout = QHBoxLayout(bottom_container)
        bottom_layout.setContentsMargins(0, 0, 0, 0)
        bottom_layout.setSpacing(16)

        # QC Options
        options_group = QGroupBox("QC Options")
        options_group.setStyleSheet(f"""
            QGroupBox {{
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                margin-top: 12px;
                padding: 16px;
                padding-top: 24px;
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 12px;
                padding: 0 4px;
            }}
            QCheckBox {{
                color: {COLORS['bone-white']};
            }}
            QLabel {{
                color: {COLORS['bone-white']};
            }}
        """)
        options_layout = QVBoxLayout(options_group)

        self.check_black_frames = QCheckBox("Black frame detection")
        self.check_black_frames.setChecked(True)
        options_layout.addWidget(self.check_black_frames)

        black_threshold_row = QHBoxLayout()
        black_threshold_row.addSpacing(20)
        black_threshold_row.addWidget(QLabel("Threshold:"))
        self.black_threshold = QComboBox()
        self.black_threshold.addItems(["0.05 sec", "0.1 sec", "0.5 sec", "1.0 sec"])
        self.black_threshold.setCurrentIndex(1)
        self.black_threshold.setStyleSheet(f"""
            QComboBox {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 4px 8px;
            }}
        """)
        black_threshold_row.addWidget(self.black_threshold)
        black_threshold_row.addStretch()
        options_layout.addLayout(black_threshold_row)

        self.check_silence = QCheckBox("Audio silence detection")
        self.check_silence.setChecked(True)
        options_layout.addWidget(self.check_silence)

        silence_threshold_row = QHBoxLayout()
        silence_threshold_row.addSpacing(20)
        silence_threshold_row.addWidget(QLabel("Threshold:"))
        self.silence_threshold = QComboBox()
        self.silence_threshold.addItems(["-60 dB", "-50 dB", "-40 dB", "-30 dB"])
        self.silence_threshold.setCurrentIndex(1)
        self.silence_threshold.setStyleSheet(f"""
            QComboBox {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 4px 8px;
            }}
        """)
        silence_threshold_row.addWidget(self.silence_threshold)
        silence_threshold_row.addStretch()
        options_layout.addLayout(silence_threshold_row)

        self.check_clipping = QCheckBox("Audio clipping detection")
        self.check_clipping.setChecked(True)
        options_layout.addWidget(self.check_clipping)

        # Separator
        separator = QFrame()
        separator.setFrameShape(QFrame.Shape.HLine)
        separator.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        separator.setFixedHeight(1)
        options_layout.addSpacing(8)
        options_layout.addWidget(separator)
        options_layout.addSpacing(8)

        # MediaInfo-based checks label
        mediainfo_label = QLabel("Technical Analysis")
        mediainfo_label.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px; font-weight: bold;")
        options_layout.addWidget(mediainfo_label)

        self.check_vfr = QCheckBox("VFR (variable frame rate) detection")
        self.check_vfr.setChecked(True)
        options_layout.addWidget(self.check_vfr)

        self.check_bitrate = QCheckBox("Bitrate validation")
        self.check_bitrate.setChecked(True)
        options_layout.addWidget(self.check_bitrate)

        self.check_hdr = QCheckBox("HDR content detection")
        self.check_hdr.setChecked(True)
        options_layout.addWidget(self.check_hdr)

        options_layout.addStretch()
        bottom_layout.addWidget(options_group)

        # Issue Details
        self.details_panel = IssueDetailsPanel()
        bottom_layout.addWidget(self.details_panel, 1)

        splitter.addWidget(bottom_container)
        splitter.setSizes([400, 250])

        layout.addWidget(splitter, 1)

        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setFixedHeight(8)
        self.progress_bar.setTextVisible(False)
        self.progress_bar.setVisible(False)
        self.progress_bar.setStyleSheet(f"""
            QProgressBar {{
                background-color: {COLORS['charcoal-dark']};
                border: none;
                border-radius: 4px;
            }}
            QProgressBar::chunk {{
                background-color: {COLORS['blue']};
                border-radius: 4px;
            }}
        """)
        layout.addWidget(self.progress_bar)

        # Bottom controls
        controls = self.create_controls()
        layout.addLayout(controls)

    def create_header(self) -> QHBoxLayout:
        """Create the page header."""
        header = QHBoxLayout()

        title_container = QVBoxLayout()
        title = QLabel("Quality Control")
        title.setObjectName("page-title")
        title_container.addWidget(title)

        subtitle = QLabel("Analyze media files for black frames, audio issues, and more")
        subtitle.setObjectName("page-subtitle")
        title_container.addWidget(subtitle)

        header.addLayout(title_container)
        header.addStretch()

        # Summary stats
        stats_container = QHBoxLayout()
        stats_container.setSpacing(24)

        self.passed_label = QLabel("0")
        self.passed_label.setStyleSheet(f"color: {COLORS['green']}; font-size: 20px; font-weight: bold;")
        passed_container = QVBoxLayout()
        passed_container.addWidget(self.passed_label)
        passed_text = QLabel("Passed")
        passed_text.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        passed_container.addWidget(passed_text)
        stats_container.addLayout(passed_container)

        self.warnings_label = QLabel("0")
        self.warnings_label.setStyleSheet(f"color: {COLORS['orange']}; font-size: 20px; font-weight: bold;")
        warnings_container = QVBoxLayout()
        warnings_container.addWidget(self.warnings_label)
        warnings_text = QLabel("Warnings")
        warnings_text.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        warnings_container.addWidget(warnings_text)
        stats_container.addLayout(warnings_container)

        self.failed_label = QLabel("0")
        self.failed_label.setStyleSheet(f"color: #FF4444; font-size: 20px; font-weight: bold;")
        failed_container = QVBoxLayout()
        failed_container.addWidget(self.failed_label)
        failed_text = QLabel("Failed")
        failed_text.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 11px;")
        failed_container.addWidget(failed_text)
        stats_container.addLayout(failed_container)

        header.addLayout(stats_container)

        return header

    def create_controls(self) -> QHBoxLayout:
        """Create bottom control buttons."""
        controls = QHBoxLayout()

        self.export_btn = QPushButton("Export Report")
        self.export_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.export_btn.setEnabled(False)
        self.export_btn.clicked.connect(self._export_report)
        controls.addWidget(self.export_btn)

        controls.addStretch()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.setVisible(False)
        self.cancel_btn.clicked.connect(self._cancel_analysis)
        controls.addWidget(self.cancel_btn)

        self.analyze_btn = QPushButton("Analyze All")
        self.analyze_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.analyze_btn.setStyleSheet(f"""
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
        self.analyze_btn.clicked.connect(self._start_analysis)
        controls.addWidget(self.analyze_btn)

        return controls

    def _add_files(self):
        """Add files to analyze."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Add Files to Analyze",
            str(Path.home()),
            "Video Files (*.mov *.mp4 *.mxf *.r3d *.ari *.braw *.mkv *.avi);;All Files (*)",
        )

        for file_path in files:
            if file_path not in self.files_to_analyze:
                self.files_to_analyze.append(file_path)

        self._update_file_count()

    def _add_folder(self):
        """Add folder to analyze."""
        folder = QFileDialog.getExistingDirectory(
            self, "Add Folder to Analyze", str(Path.home())
        )

        if folder:
            video_extensions = {".mov", ".mp4", ".mxf", ".r3d", ".ari", ".braw", ".mkv", ".avi"}

            for file_path in Path(folder).rglob("*"):
                if file_path.suffix.lower() in video_extensions:
                    path_str = str(file_path)
                    if path_str not in self.files_to_analyze:
                        self.files_to_analyze.append(path_str)

        self._update_file_count()

    def _clear_all(self):
        """Clear all files and results."""
        self.files_to_analyze.clear()
        self.results_table.clear_results()
        self.details_panel.clear()
        self._update_stats(0, 0, 0)
        self._update_file_count()
        self.export_btn.setEnabled(False)

    def _update_file_count(self):
        """Update the analyze button with file count."""
        count = len(self.files_to_analyze)
        if count > 0:
            self.analyze_btn.setText(f"Analyze All ({count})")
            self.analyze_btn.setEnabled(True)
        else:
            self.analyze_btn.setText("Analyze All")
            self.analyze_btn.setEnabled(False)

    def _update_stats(self, passed: int, warnings: int, failed: int):
        """Update the summary stats."""
        self.passed_label.setText(str(passed))
        self.warnings_label.setText(str(warnings))
        self.failed_label.setText(str(failed))

    def _start_analysis(self):
        """Start the QC analysis."""
        if not self.files_to_analyze:
            return

        # Parse thresholds
        black_threshold = float(self.black_threshold.currentText().split()[0])
        silence_threshold = float(self.silence_threshold.currentText().split()[0])

        # Clear previous results
        self.results_table.clear_results()
        self.details_panel.clear()

        # Show progress
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.analyze_btn.setEnabled(False)
        self.cancel_btn.setVisible(True)

        # Start worker
        self.worker = QCAnalysisWorker(
            files=self.files_to_analyze.copy(),
            check_black_frames=self.check_black_frames.isChecked(),
            check_silence=self.check_silence.isChecked(),
            check_clipping=self.check_clipping.isChecked(),
            check_vfr=self.check_vfr.isChecked(),
            check_bitrate=self.check_bitrate.isChecked(),
            check_hdr=self.check_hdr.isChecked(),
            black_threshold=black_threshold,
            silence_threshold=silence_threshold,
        )

        self.worker.progress.connect(self._on_progress)
        self.worker.file_completed.connect(self._on_file_completed)
        self.worker.all_completed.connect(self._on_all_completed)
        self.worker.error.connect(self._on_error)

        self.worker.start()

    def _cancel_analysis(self):
        """Cancel the running analysis."""
        if self.worker and self.worker.isRunning():
            self.worker.cancel()
            self.worker.wait()

        self.progress_bar.setVisible(False)
        self.analyze_btn.setEnabled(True)
        self.cancel_btn.setVisible(False)

    def _on_progress(self, current: int, total: int):
        """Handle progress updates."""
        if total > 0:
            self.progress_bar.setValue(int((current / total) * 100))

    def _on_file_completed(self, filename: str, result: QCResult, mediainfo_details: Optional[dict] = None, clip_metadata = None):
        """Handle single file completion."""
        self.results_table.add_result(result, mediainfo_details, clip_metadata)

    def _on_all_completed(self, results: list, summary: QCSummary):
        """Handle analysis completion."""
        self.progress_bar.setVisible(False)
        self.analyze_btn.setEnabled(True)
        self.cancel_btn.setVisible(False)

        self._update_stats(summary.passed, summary.warnings, summary.failed)

        if results:
            self.export_btn.setEnabled(True)

    def _on_error(self, filename: str, error: str):
        """Handle analysis error."""
        print(f"QC error for {filename}: {error}")

    def _on_file_selected(self, filepath: str, result: QCResult, mediainfo_details: Optional[dict] = None, clip_metadata = None):
        """Handle file selection in results table."""
        self.details_panel.show_result(result, mediainfo_details, clip_metadata)

    def _export_report(self):
        """Export QC report to file."""
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            "Export QC Report",
            str(Path.home() / "qc_report.txt"),
            "Text Files (*.txt);;All Files (*)",
        )

        if filepath:
            qc_checker = QCChecker()
            results = list(self.results_table.results_map.values())

            if results:
                _, summary = qc_checker.check_batch([], check_consistency=False)
                summary.total_clips = len(results)
                summary.passed = sum(1 for r in results if r.status == "pass")
                summary.warnings = sum(1 for r in results if r.status == "warning")
                summary.failed = sum(1 for r in results if r.status == "fail")

                report = qc_checker.format_report(results, summary)

                with open(filepath, "w") as f:
                    f.write(report)
