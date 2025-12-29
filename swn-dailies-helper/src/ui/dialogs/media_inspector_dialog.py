"""
Media Inspector dialog for detailed media file analysis.

Provides a floating window to view comprehensive technical metadata
from MediaInfo and ExifTool for any media file.
"""
import json
from pathlib import Path
from typing import Optional

from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QScrollArea, QWidget, QFileDialog,
    QTabWidget, QTextEdit, QApplication, QSplitter,
    QTreeWidget, QTreeWidgetItem, QHeaderView
)

from src.ui.styles import COLORS


class MediaInfoWorker(QThread):
    """Background worker to fetch media info."""
    completed = pyqtSignal(object, object)  # mediainfo, exif
    error = pyqtSignal(str)

    def __init__(self, file_path: str):
        super().__init__()
        self.file_path = file_path

    def run(self):
        try:
            from src.services.mediainfo_service import get_mediainfo_service
            from src.services.exiftool_service import get_exiftool_service

            mediainfo_service = get_mediainfo_service()
            exiftool_service = get_exiftool_service()

            mediainfo = mediainfo_service.get_media_info(self.file_path)
            exif = exiftool_service.extract_metadata(self.file_path)

            self.completed.emit(mediainfo, exif)
        except Exception as e:
            self.error.emit(str(e))


class MediaInspectorDialog(QDialog):
    """Dialog for inspecting media file metadata."""

    def __init__(self, file_path: Optional[str] = None, parent=None):
        super().__init__(parent)
        self.file_path = file_path
        self.mediainfo = None
        self.exif = None
        self.worker = None

        self.setWindowTitle("Media Inspector")
        self.setMinimumSize(700, 600)
        self.setModal(False)
        self.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)

        self._setup_ui()

        if file_path:
            self._load_file(file_path)

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Header with file info
        header = self._create_header()
        layout.addWidget(header)

        # Tab widget for different views
        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)

        # Overview tab
        self.overview_widget = self._create_overview_tab()
        self.tabs.addTab(self.overview_widget, "Overview")

        # Video tab
        self.video_widget = self._create_video_tab()
        self.tabs.addTab(self.video_widget, "Video")

        # Audio tab
        self.audio_widget = self._create_audio_tab()
        self.tabs.addTab(self.audio_widget, "Audio")

        # Camera tab
        self.camera_widget = self._create_camera_tab()
        self.tabs.addTab(self.camera_widget, "Camera")

        # Raw data tab
        self.raw_widget = self._create_raw_tab()
        self.tabs.addTab(self.raw_widget, "Raw Data")

        layout.addWidget(self.tabs, 1)

        # Action buttons
        buttons_frame = self._create_buttons()
        layout.addWidget(buttons_frame)

        self._apply_styles()

    def _create_header(self) -> QFrame:
        """Create the header section."""
        frame = QFrame()
        frame.setObjectName("header-frame")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(8)

        # File row with browse button
        file_row = QHBoxLayout()

        self.file_label = QLabel("No file selected")
        self.file_label.setObjectName("file-label")
        self.file_label.setWordWrap(True)
        file_row.addWidget(self.file_label, 1)

        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self._on_browse)
        file_row.addWidget(browse_btn)

        layout.addLayout(file_row)

        # Path and size info
        self.path_label = QLabel("")
        self.path_label.setObjectName("path-label")
        self.path_label.setWordWrap(True)
        layout.addWidget(self.path_label)

        # Status label
        self.status_label = QLabel("")
        self.status_label.setObjectName("status-label")
        layout.addWidget(self.status_label)

        return frame

    def _create_overview_tab(self) -> QScrollArea:
        """Create the overview tab with key info."""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(16)

        # Container section
        self.container_frame = self._create_info_section("File Information")
        layout.addWidget(self.container_frame)

        # Video summary
        self.video_summary_frame = self._create_info_section("Video")
        layout.addWidget(self.video_summary_frame)

        # Audio summary
        self.audio_summary_frame = self._create_info_section("Audio")
        layout.addWidget(self.audio_summary_frame)

        # Camera summary
        self.camera_summary_frame = self._create_info_section("Camera")
        layout.addWidget(self.camera_summary_frame)

        layout.addStretch()
        scroll.setWidget(widget)
        return scroll

    def _create_video_tab(self) -> QScrollArea:
        """Create the video details tab."""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        self.video_tree = QTreeWidget()
        self.video_tree.setHeaderLabels(["Property", "Value"])
        self.video_tree.setRootIsDecorated(True)
        self.video_tree.setAlternatingRowColors(True)
        self.video_tree.header().setStretchLastSection(True)
        self.video_tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)

        scroll.setWidget(self.video_tree)
        return scroll

    def _create_audio_tab(self) -> QScrollArea:
        """Create the audio details tab."""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        self.audio_tree = QTreeWidget()
        self.audio_tree.setHeaderLabels(["Property", "Value"])
        self.audio_tree.setRootIsDecorated(True)
        self.audio_tree.setAlternatingRowColors(True)
        self.audio_tree.header().setStretchLastSection(True)
        self.audio_tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)

        scroll.setWidget(self.audio_tree)
        return scroll

    def _create_camera_tab(self) -> QScrollArea:
        """Create the camera/metadata tab."""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        self.camera_tree = QTreeWidget()
        self.camera_tree.setHeaderLabels(["Property", "Value"])
        self.camera_tree.setRootIsDecorated(True)
        self.camera_tree.setAlternatingRowColors(True)
        self.camera_tree.header().setStretchLastSection(True)
        self.camera_tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)

        scroll.setWidget(self.camera_tree)
        return scroll

    def _create_raw_tab(self) -> QWidget:
        """Create the raw data tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)

        splitter = QSplitter(Qt.Orientation.Horizontal)

        # MediaInfo raw
        mediainfo_frame = QFrame()
        mi_layout = QVBoxLayout(mediainfo_frame)
        mi_layout.setContentsMargins(8, 8, 8, 8)
        mi_label = QLabel("MediaInfo")
        mi_label.setStyleSheet("font-weight: bold;")
        mi_layout.addWidget(mi_label)
        self.mediainfo_raw = QTextEdit()
        self.mediainfo_raw.setReadOnly(True)
        self.mediainfo_raw.setFontFamily("monospace")
        mi_layout.addWidget(self.mediainfo_raw)
        splitter.addWidget(mediainfo_frame)

        # ExifTool raw
        exif_frame = QFrame()
        exif_layout = QVBoxLayout(exif_frame)
        exif_layout.setContentsMargins(8, 8, 8, 8)
        exif_label = QLabel("ExifTool")
        exif_label.setStyleSheet("font-weight: bold;")
        exif_layout.addWidget(exif_label)
        self.exif_raw = QTextEdit()
        self.exif_raw.setReadOnly(True)
        self.exif_raw.setFontFamily("monospace")
        exif_layout.addWidget(self.exif_raw)
        splitter.addWidget(exif_frame)

        layout.addWidget(splitter)
        return widget

    def _create_info_section(self, title: str) -> QFrame:
        """Create an info section frame."""
        frame = QFrame()
        frame.setObjectName("info-section")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)

        title_label = QLabel(title)
        title_label.setStyleSheet(f"font-weight: bold; font-size: 14px; color: {COLORS['accent-yellow']};")
        layout.addWidget(title_label)

        content = QLabel("No data available")
        content.setObjectName("section-content")
        content.setWordWrap(True)
        frame.content_label = content
        layout.addWidget(content)

        return frame

    def _create_buttons(self) -> QFrame:
        """Create the action buttons frame."""
        frame = QFrame()
        frame.setObjectName("buttons-frame")
        layout = QHBoxLayout(frame)
        layout.setContentsMargins(16, 12, 16, 12)
        layout.setSpacing(12)

        # Copy button
        copy_btn = QPushButton("Copy Summary")
        copy_btn.clicked.connect(self._on_copy_summary)
        layout.addWidget(copy_btn)

        # Export JSON button
        export_btn = QPushButton("Export JSON")
        export_btn.clicked.connect(self._on_export_json)
        layout.addWidget(export_btn)

        layout.addStretch()

        # Close button
        close_btn = QPushButton("Close")
        close_btn.clicked.connect(self.close)
        layout.addWidget(close_btn)

        return frame

    def _apply_styles(self):
        """Apply the application styles."""
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
            QLabel {{
                color: {COLORS['bone-white']};
            }}
            #header-frame {{
                background-color: {COLORS['charcoal-dark']};
                border-bottom: 1px solid {COLORS['border-gray']};
            }}
            #file-label {{
                font-size: 16px;
                font-weight: bold;
                color: {COLORS['bone-white']};
            }}
            #path-label {{
                font-size: 12px;
                color: {COLORS['muted-gray']};
            }}
            #status-label {{
                font-size: 12px;
                color: {COLORS['muted-gray']};
            }}
            #info-section {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
            #section-content {{
                color: {COLORS['bone-white']};
                line-height: 1.5;
            }}
            #buttons-frame {{
                background-color: {COLORS['charcoal-dark']};
                border-top: 1px solid {COLORS['border-gray']};
            }}
            QPushButton {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: 500;
            }}
            QPushButton:hover {{
                background-color: {COLORS['border-gray']};
            }}
            QTabWidget::pane {{
                border: none;
                background-color: {COLORS['charcoal-black']};
            }}
            QTabBar::tab {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['muted-gray']};
                padding: 10px 20px;
                border: none;
                border-bottom: 2px solid transparent;
            }}
            QTabBar::tab:selected {{
                color: {COLORS['accent-yellow']};
                border-bottom-color: {COLORS['accent-yellow']};
            }}
            QTabBar::tab:hover {{
                color: {COLORS['bone-white']};
            }}
            QScrollArea {{
                background-color: {COLORS['charcoal-black']};
                border: none;
            }}
            QTreeWidget {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['bone-white']};
                border: none;
                alternate-background-color: {COLORS['charcoal-light']};
            }}
            QTreeWidget::item {{
                padding: 4px;
            }}
            QTreeWidget::item:selected {{
                background-color: {COLORS['border-gray']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['muted-gray']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
            }}
            QTextEdit {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 8px;
            }}
            QSplitter::handle {{
                background-color: {COLORS['border-gray']};
            }}
        """)

    def _on_browse(self):
        """Handle browse button click."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Media File",
            "",
            "Media Files (*.mov *.mp4 *.mxf *.avi *.mkv *.r3d *.braw *.arri *.dng *.wav *.aiff *.mp3);;All Files (*)"
        )
        if file_path:
            self._load_file(file_path)

    def _load_file(self, file_path: str):
        """Load and analyze a media file."""
        self.file_path = file_path
        path = Path(file_path)

        self.file_label.setText(path.name)
        self.path_label.setText(str(path.parent))
        self.status_label.setText("Loading...")

        # Clear previous data
        self._clear_data()

        # Start background worker
        self.worker = MediaInfoWorker(file_path)
        self.worker.completed.connect(self._on_load_complete)
        self.worker.error.connect(self._on_load_error)
        self.worker.start()

    def _clear_data(self):
        """Clear all displayed data."""
        self.mediainfo = None
        self.exif = None
        self.container_frame.content_label.setText("Loading...")
        self.video_summary_frame.content_label.setText("Loading...")
        self.audio_summary_frame.content_label.setText("Loading...")
        self.camera_summary_frame.content_label.setText("Loading...")
        self.video_tree.clear()
        self.audio_tree.clear()
        self.camera_tree.clear()
        self.mediainfo_raw.clear()
        self.exif_raw.clear()

    def _on_load_complete(self, mediainfo, exif):
        """Handle successful load."""
        self.mediainfo = mediainfo
        self.exif = exif
        self.worker = None

        if mediainfo:
            size = self._format_size(mediainfo.container.file_size)
            duration = self._format_duration(mediainfo.container.duration_ms)
            self.status_label.setText(f"Size: {size} | Duration: {duration}")
        else:
            self.status_label.setText("Unable to read media info")

        self._populate_overview()
        self._populate_video_tree()
        self._populate_audio_tree()
        self._populate_camera_tree()
        self._populate_raw_data()

    def _on_load_error(self, error: str):
        """Handle load error."""
        self.worker = None
        self.status_label.setText(f"Error: {error}")

    def _populate_overview(self):
        """Populate the overview tab."""
        if not self.mediainfo:
            for frame in [self.container_frame, self.video_summary_frame,
                          self.audio_summary_frame, self.camera_summary_frame]:
                frame.content_label.setText("No data available")
            return

        # Container info
        c = self.mediainfo.container
        container_lines = [
            f"Format: {c.format} {c.format_profile}".strip(),
            f"Size: {self._format_size(c.file_size)}",
            f"Duration: {self._format_duration(c.duration_ms)}",
            f"Bitrate: {self._format_bitrate(c.overall_bit_rate)}",
        ]
        self.container_frame.content_label.setText("\n".join(container_lines))

        # Video summary
        if self.mediainfo.video_tracks:
            v = self.mediainfo.video_tracks[0]
            hdr_info = f" ({v.hdr_format})" if v.hdr_format else ""
            video_lines = [
                f"Codec: {v.codec}",
                f"Resolution: {v.width} x {v.height} ({v.aspect_ratio})",
                f"Frame Rate: {v.frame_rate:.3f} fps ({v.frame_rate_mode})",
                f"Bit Depth: {v.bit_depth}-bit{hdr_info}",
                f"Bitrate: {self._format_bitrate(v.bit_rate)}",
            ]
            self.video_summary_frame.content_label.setText("\n".join(video_lines))
        else:
            self.video_summary_frame.content_label.setText("No video tracks")

        # Audio summary
        if self.mediainfo.audio_tracks:
            audio_lines = []
            for i, a in enumerate(self.mediainfo.audio_tracks, 1):
                ch_info = f"{a.channels}ch" if a.channels else ""
                depth = f"{a.bit_depth}-bit" if a.bit_depth else ""
                audio_lines.append(f"Track {i}: {a.codec} {depth}, {a.sample_rate}Hz, {ch_info}")
            self.audio_summary_frame.content_label.setText("\n".join(audio_lines))
        else:
            self.audio_summary_frame.content_label.setText("No audio tracks")

        # Camera summary
        if self.exif and self.exif.camera.make:
            cam = self.exif.camera
            camera_lines = [
                f"Camera: {cam.make} {cam.model}",
            ]
            if cam.lens_model:
                camera_lines.append(f"Lens: {cam.lens_model}")
            settings = []
            if cam.iso:
                settings.append(f"ISO {cam.iso}")
            if cam.shutter_speed:
                settings.append(f"{cam.shutter_speed}s")
            if cam.aperture:
                settings.append(f"f/{cam.aperture}")
            if settings:
                camera_lines.append(f"Settings: {', '.join(settings)}")
            self.camera_summary_frame.content_label.setText("\n".join(camera_lines))
        else:
            self.camera_summary_frame.content_label.setText("No camera metadata found")

    def _populate_video_tree(self):
        """Populate the video details tree."""
        self.video_tree.clear()

        if not self.mediainfo or not self.mediainfo.video_tracks:
            return

        for i, v in enumerate(self.mediainfo.video_tracks):
            track_item = QTreeWidgetItem([f"Video Track {i + 1}", ""])
            self.video_tree.addTopLevelItem(track_item)

            self._add_tree_item(track_item, "Codec", v.codec)
            self._add_tree_item(track_item, "Codec ID", v.codec_id)
            self._add_tree_item(track_item, "Width", str(v.width))
            self._add_tree_item(track_item, "Height", str(v.height))
            self._add_tree_item(track_item, "Aspect Ratio", v.aspect_ratio)
            self._add_tree_item(track_item, "Frame Rate", f"{v.frame_rate:.3f} fps")
            self._add_tree_item(track_item, "Frame Rate Mode", v.frame_rate_mode)
            self._add_tree_item(track_item, "Bit Depth", f"{v.bit_depth}-bit")
            self._add_tree_item(track_item, "Bitrate", self._format_bitrate(v.bit_rate))
            self._add_tree_item(track_item, "Duration", self._format_duration(v.duration_ms))
            self._add_tree_item(track_item, "Frame Count", str(v.frame_count))
            self._add_tree_item(track_item, "Scan Type", v.scan_type)

            # Color info
            color_item = QTreeWidgetItem(["Color", ""])
            track_item.addChild(color_item)
            self._add_tree_item(color_item, "Color Space", v.color_space)
            self._add_tree_item(color_item, "Chroma Subsampling", v.chroma_subsampling)
            self._add_tree_item(color_item, "Color Primaries", v.color_primaries)
            self._add_tree_item(color_item, "Transfer Characteristics", v.transfer_characteristics)
            self._add_tree_item(color_item, "Matrix Coefficients", v.matrix_coefficients)
            if v.hdr_format:
                self._add_tree_item(color_item, "HDR Format", v.hdr_format)

            track_item.setExpanded(True)
            color_item.setExpanded(True)

    def _populate_audio_tree(self):
        """Populate the audio details tree."""
        self.audio_tree.clear()

        if not self.mediainfo or not self.mediainfo.audio_tracks:
            return

        for i, a in enumerate(self.mediainfo.audio_tracks):
            track_item = QTreeWidgetItem([f"Audio Track {i + 1}", a.title or ""])
            self.audio_tree.addTopLevelItem(track_item)

            self._add_tree_item(track_item, "Codec", a.codec)
            self._add_tree_item(track_item, "Codec ID", a.codec_id)
            self._add_tree_item(track_item, "Channels", str(a.channels))
            self._add_tree_item(track_item, "Channel Layout", a.channel_layout)
            self._add_tree_item(track_item, "Sample Rate", f"{a.sample_rate} Hz")
            self._add_tree_item(track_item, "Bit Depth", f"{a.bit_depth}-bit")
            self._add_tree_item(track_item, "Bitrate", self._format_bitrate(a.bit_rate))
            self._add_tree_item(track_item, "Duration", self._format_duration(a.duration_ms))
            self._add_tree_item(track_item, "Language", a.language)
            self._add_tree_item(track_item, "Compression Mode", a.compression_mode)

            track_item.setExpanded(True)

    def _populate_camera_tree(self):
        """Populate the camera details tree."""
        self.camera_tree.clear()

        if not self.exif:
            return

        # Camera info
        cam = self.exif.camera
        if cam.make or cam.model:
            camera_item = QTreeWidgetItem(["Camera", ""])
            self.camera_tree.addTopLevelItem(camera_item)
            self._add_tree_item(camera_item, "Make", cam.make)
            self._add_tree_item(camera_item, "Model", cam.model)
            self._add_tree_item(camera_item, "Serial Number", cam.serial_number)
            camera_item.setExpanded(True)

        # Lens info
        if cam.lens_model or cam.lens_make:
            lens_item = QTreeWidgetItem(["Lens", ""])
            self.camera_tree.addTopLevelItem(lens_item)
            self._add_tree_item(lens_item, "Make", cam.lens_make)
            self._add_tree_item(lens_item, "Model", cam.lens_model)
            self._add_tree_item(lens_item, "Serial", cam.lens_serial)
            self._add_tree_item(lens_item, "Focal Length", cam.focal_length)
            lens_item.setExpanded(True)

        # Exposure settings
        settings_item = QTreeWidgetItem(["Exposure", ""])
        self.camera_tree.addTopLevelItem(settings_item)
        self._add_tree_item(settings_item, "ISO", str(cam.iso) if cam.iso else "")
        self._add_tree_item(settings_item, "Shutter Speed", str(cam.shutter_speed))
        self._add_tree_item(settings_item, "Aperture", str(cam.aperture))
        self._add_tree_item(settings_item, "Exposure Mode", cam.exposure_mode)
        self._add_tree_item(settings_item, "Metering Mode", cam.metering_mode)
        self._add_tree_item(settings_item, "White Balance", cam.white_balance)
        settings_item.setExpanded(True)

        # GPS info
        gps = self.exif.gps
        if gps.latitude or gps.longitude:
            gps_item = QTreeWidgetItem(["GPS", ""])
            self.camera_tree.addTopLevelItem(gps_item)
            if gps.latitude:
                self._add_tree_item(gps_item, "Latitude", f"{gps.latitude:.6f}")
            if gps.longitude:
                self._add_tree_item(gps_item, "Longitude", f"{gps.longitude:.6f}")
            if gps.altitude:
                self._add_tree_item(gps_item, "Altitude", f"{gps.altitude:.1f}m")
            gps_item.setExpanded(True)

        # Dates
        dates = self.exif.dates
        dates_item = QTreeWidgetItem(["Dates", ""])
        self.camera_tree.addTopLevelItem(dates_item)
        self._add_tree_item(dates_item, "Date/Time Original", dates.date_time_original)
        self._add_tree_item(dates_item, "Create Date", dates.create_date)
        self._add_tree_item(dates_item, "Modify Date", dates.modify_date)
        self._add_tree_item(dates_item, "Media Create Date", dates.media_create_date)
        dates_item.setExpanded(True)

        # Other metadata
        other_item = QTreeWidgetItem(["Other", ""])
        self.camera_tree.addTopLevelItem(other_item)
        self._add_tree_item(other_item, "Artist", self.exif.artist)
        self._add_tree_item(other_item, "Copyright", self.exif.copyright)
        self._add_tree_item(other_item, "Software", self.exif.software)
        self._add_tree_item(other_item, "Title", self.exif.title)
        self._add_tree_item(other_item, "Description", self.exif.description)
        if self.exif.keywords:
            self._add_tree_item(other_item, "Keywords", ", ".join(self.exif.keywords))
        other_item.setExpanded(True)

    def _add_tree_item(self, parent: QTreeWidgetItem, name: str, value: str):
        """Add a tree item if value is not empty."""
        if value:
            item = QTreeWidgetItem([name, str(value)])
            parent.addChild(item)

    def _populate_raw_data(self):
        """Populate the raw data tab."""
        if self.mediainfo and self.mediainfo.raw_data:
            self.mediainfo_raw.setText(json.dumps(self.mediainfo.raw_data, indent=2))
        else:
            self.mediainfo_raw.setText("No MediaInfo data available")

        if self.exif and self.exif.raw_data:
            self.exif_raw.setText(json.dumps(self.exif.raw_data, indent=2, default=str))
        else:
            self.exif_raw.setText("No ExifTool data available")

    def _on_copy_summary(self):
        """Copy a summary to clipboard."""
        if not self.mediainfo:
            return

        lines = [f"File: {Path(self.file_path).name}"]

        c = self.mediainfo.container
        lines.append(f"Format: {c.format}")
        lines.append(f"Size: {self._format_size(c.file_size)}")
        lines.append(f"Duration: {self._format_duration(c.duration_ms)}")

        if self.mediainfo.video_tracks:
            v = self.mediainfo.video_tracks[0]
            lines.append(f"Video: {v.codec}, {v.width}x{v.height}, {v.frame_rate:.3f}fps, {v.bit_depth}-bit")

        if self.mediainfo.audio_tracks:
            for i, a in enumerate(self.mediainfo.audio_tracks, 1):
                lines.append(f"Audio {i}: {a.codec}, {a.sample_rate}Hz, {a.channels}ch")

        if self.exif and self.exif.camera.make:
            lines.append(f"Camera: {self.exif.camera.make} {self.exif.camera.model}")

        clipboard = QApplication.clipboard()
        clipboard.setText("\n".join(lines))
        self.status_label.setText("Summary copied to clipboard")

    def _on_export_json(self):
        """Export all metadata to JSON file."""
        if not self.file_path:
            return

        default_name = Path(self.file_path).stem + "_metadata.json"
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Metadata",
            default_name,
            "JSON Files (*.json)"
        )

        if not file_path:
            return

        data = {
            "file": self.file_path,
            "mediainfo": self.mediainfo.raw_data if self.mediainfo else None,
            "exiftool": self.exif.raw_data if self.exif else None,
        }

        try:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
            self.status_label.setText(f"Exported to {Path(file_path).name}")
        except Exception as e:
            self.status_label.setText(f"Export error: {e}")

    def _format_size(self, size_bytes: int) -> str:
        """Format file size in human-readable format."""
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

    def _format_duration(self, ms: int) -> str:
        """Format duration in HH:MM:SS.mmm format."""
        if not ms:
            return "00:00:00"
        total_seconds = ms / 1000
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}"

    def _format_bitrate(self, bitrate: int) -> str:
        """Format bitrate in human-readable format."""
        if not bitrate:
            return ""
        if bitrate < 1000:
            return f"{bitrate} bps"
        elif bitrate < 1000000:
            return f"{bitrate / 1000:.1f} Kbps"
        else:
            return f"{bitrate / 1000000:.1f} Mbps"

    def inspect_file(self, file_path: str):
        """Public method to inspect a file."""
        self._load_file(file_path)
        self.show()
        self.raise_()
        self.activateWindow()
