"""
Proxy page - Generate H.264 proxies from camera footage.
"""
from pathlib import Path
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QListWidget,
    QListWidgetItem,
    QProgressBar,
    QFileDialog,
    QCheckBox,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal

from src.services.config import ConfigManager
from src.services.ffmpeg_encoder import FFmpegEncoder, ProxySettings
from src.services.metadata_extractor import MetadataExtractor
from src.services.qc_checker import QCChecker
from src.ui.styles import COLORS


class ProxyWorker(QThread):
    """Worker thread for proxy generation."""
    progress = pyqtSignal(int, int, float)  # file_index, total, file_progress
    file_started = pyqtSignal(str)  # filename
    file_completed = pyqtSignal(str, bool)  # filename, success
    all_completed = pyqtSignal(list)  # results

    def __init__(self, files, output_dir, settings):
        super().__init__()
        self.files = files
        self.output_dir = output_dir
        self.settings = settings
        self.encoder = FFmpegEncoder()
        self.cancelled = False

    def run(self):
        results = []
        for i, input_path in enumerate(self.files):
            if self.cancelled:
                break

            filename = Path(input_path).stem
            output_path = str(self.output_dir / f"{filename}_proxy.mp4")

            self.file_started.emit(Path(input_path).name)

            def progress_cb(p):
                self.progress.emit(i, len(self.files), p)

            success = self.encoder.generate_proxy(
                input_path, output_path, self.settings, progress_cb
            )
            results.append((input_path, output_path, success))
            self.file_completed.emit(Path(input_path).name, success)

        self.all_completed.emit(results)

    def cancel(self):
        self.cancelled = True


class ProxyPage(QWidget):
    """Proxy generation page."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.encoder = FFmpegEncoder()
        self.metadata_extractor = MetadataExtractor()
        self.qc_checker = QCChecker()
        self.selected_files = []
        self.output_dir = None
        self.worker = None
        self.ffmpeg_available = self.encoder.available
        self.setup_ui()

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        header = QHBoxLayout()

        title_container = QVBoxLayout()
        title = QLabel("Generate Proxies")
        title.setObjectName("page-title")
        title_container.addWidget(title)

        subtitle = QLabel("Create H.264 proxies for web review")
        subtitle.setObjectName("page-subtitle")
        title_container.addWidget(subtitle)

        header.addLayout(title_container)
        header.addStretch()

        layout.addLayout(header)

        # Main content
        content = QHBoxLayout()
        content.setSpacing(20)

        # Left - File selection
        left = self.create_files_panel()
        content.addWidget(left, 1)

        # Right - Output and options
        right = self.create_options_panel()
        content.addWidget(right, 1)

        layout.addLayout(content, 1)

        # Bottom - Progress
        actions = self.create_progress_panel()
        layout.addWidget(actions)

    def create_files_panel(self) -> QFrame:
        """Create the file selection panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Source Files")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Buttons
        btn_layout = QHBoxLayout()

        add_files_btn = QPushButton("Add Files...")
        add_files_btn.clicked.connect(self.add_files)
        add_files_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(add_files_btn)

        add_folder_btn = QPushButton("Add Folder...")
        add_folder_btn.clicked.connect(self.add_folder)
        add_folder_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(add_folder_btn)

        clear_btn = QPushButton("Clear")
        clear_btn.clicked.connect(self.clear_files)
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(clear_btn)

        btn_layout.addStretch()
        layout.addLayout(btn_layout)

        # File list
        self.file_list = QListWidget()
        layout.addWidget(self.file_list, 1)

        # Summary
        self.file_summary = QLabel("No files selected")
        self.file_summary.setObjectName("label-small")
        layout.addWidget(self.file_summary)

        return panel

    def create_options_panel(self) -> QFrame:
        """Create the options panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Output Settings")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Output directory
        out_label = QLabel("Output Folder:")
        out_label.setObjectName("label-muted")
        layout.addWidget(out_label)

        out_layout = QHBoxLayout()
        self.output_label = QLabel("Not selected")
        self.output_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        out_layout.addWidget(self.output_label, 1)

        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self.select_output_dir)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        out_layout.addWidget(browse_btn)

        layout.addLayout(out_layout)

        # Separator
        sep = QFrame()
        sep.setFixedHeight(1)
        sep.setStyleSheet(f"background-color: {COLORS['border-gray']};")
        layout.addWidget(sep)

        # Options
        options_label = QLabel("Options")
        options_label.setObjectName("label-muted")
        layout.addWidget(options_label)

        # Get settings from config
        proxy_settings = self.config.get_proxy_settings()

        self.run_qc = QCheckBox("Run QC checks on source files")
        self.run_qc.setChecked(True)
        layout.addWidget(self.run_qc)

        self.apply_lut = QCheckBox("Apply LUT from settings")
        lut_enabled = proxy_settings.get("lut_enabled", False)
        lut_path = proxy_settings.get("lut_path", "")
        self.apply_lut.setChecked(lut_enabled and bool(lut_path))
        self.apply_lut.setEnabled(bool(lut_path))
        if lut_path:
            self.apply_lut.setToolTip(f"LUT: {Path(lut_path).name}")
        else:
            self.apply_lut.setToolTip("Configure LUT in Settings")
        layout.addWidget(self.apply_lut)

        # Resolution info
        resolution = proxy_settings.get("resolution", "1920x1080")
        bitrate = proxy_settings.get("bitrate", "10M")
        info = QLabel(f"Resolution: {resolution} | Bitrate: {bitrate}")
        info.setObjectName("label-small")
        layout.addWidget(info)

        layout.addStretch()

        return panel

    def create_progress_panel(self) -> QFrame:
        """Create the progress panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(12)

        # Current file
        self.progress_label = QLabel("Ready to generate proxies")
        self.progress_label.setObjectName("label-muted")
        layout.addWidget(self.progress_label)

        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)

        # File detail
        self.file_label = QLabel("")
        self.file_label.setObjectName("label-small")
        layout.addWidget(self.file_label)

        # Buttons
        btn_layout = QHBoxLayout()

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("danger-button")
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.clicked.connect(self.cancel_generation)
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.cancel_btn)

        btn_layout.addStretch()

        self.start_btn = QPushButton("Generate Proxies")
        self.start_btn.setObjectName("primary-button")
        self.start_btn.clicked.connect(self.start_generation)
        self.start_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        btn_layout.addWidget(self.start_btn)

        layout.addLayout(btn_layout)

        return panel

    def add_files(self):
        """Add individual files."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Video Files",
            "",
            "Video Files (*.mov *.mp4 *.mxf *.r3d *.braw *.ari);;All Files (*)"
        )
        for f in files:
            if f not in self.selected_files:
                self.selected_files.append(f)
                item = QListWidgetItem(Path(f).name)
                item.setData(Qt.ItemDataRole.UserRole, f)
                self.file_list.addItem(item)
        self.update_summary()

    def add_folder(self):
        """Add all video files from a folder."""
        folder = QFileDialog.getExistingDirectory(self, "Select Folder")
        if folder:
            extensions = {".mov", ".mp4", ".mxf", ".r3d", ".braw", ".ari"}
            for f in Path(folder).rglob("*"):
                if f.suffix.lower() in extensions and str(f) not in self.selected_files:
                    self.selected_files.append(str(f))
                    item = QListWidgetItem(f.name)
                    item.setData(Qt.ItemDataRole.UserRole, str(f))
                    self.file_list.addItem(item)
            self.update_summary()

    def clear_files(self):
        """Clear all selected files."""
        self.selected_files.clear()
        self.file_list.clear()
        self.update_summary()

    def update_summary(self):
        """Update the file summary."""
        count = len(self.selected_files)
        if count == 0:
            self.file_summary.setText("No files selected")
        else:
            total_size = sum(Path(f).stat().st_size for f in self.selected_files if Path(f).exists())
            size_str = self.format_size(total_size)
            self.file_summary.setText(f"{count} files selected ({size_str})")

    def select_output_dir(self):
        """Select output directory."""
        folder = QFileDialog.getExistingDirectory(self, "Select Output Folder")
        if folder:
            self.output_dir = Path(folder)
            self.output_label.setText(folder)
            self.output_label.setStyleSheet(f"color: {COLORS['bone-white']};")

    def start_generation(self):
        """Start proxy generation."""
        if not self.selected_files:
            self.progress_label.setText("No files selected")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        if not self.output_dir:
            self.progress_label.setText("Please select an output folder")
            self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
            return

        # Build settings
        proxy_cfg = self.config.get_proxy_settings()
        settings = ProxySettings(
            resolution=proxy_cfg.get("resolution", "1920x1080"),
            bitrate=proxy_cfg.get("bitrate", "10M"),
            preset=proxy_cfg.get("preset", "fast"),
            lut_path=proxy_cfg.get("lut_path") if self.apply_lut.isChecked() else None,
        )

        # Update UI
        self.start_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.progress_bar.setValue(0)
        self.progress_label.setText("Starting...")
        self.progress_label.setStyleSheet(f"color: {COLORS['bone-white']};")

        # Start worker
        self.worker = ProxyWorker(self.selected_files, self.output_dir, settings)
        self.worker.progress.connect(self.on_progress)
        self.worker.file_started.connect(self.on_file_started)
        self.worker.file_completed.connect(self.on_file_completed)
        self.worker.all_completed.connect(self.on_completed)
        self.worker.start()

    def cancel_generation(self):
        """Cancel proxy generation."""
        if self.worker:
            self.worker.cancel()
        self.progress_label.setText("Cancelled")
        self.progress_label.setStyleSheet(f"color: {COLORS['orange']};")
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)

    def on_progress(self, file_idx, total, file_progress):
        """Handle progress updates."""
        overall = (file_idx + file_progress) / total * 100
        self.progress_bar.setValue(int(overall))

    def on_file_started(self, filename):
        """Handle file started."""
        self.file_label.setText(f"Processing: {filename}")

    def on_file_completed(self, filename, success):
        """Handle file completed."""
        status = "completed" if success else "failed"
        self.progress_label.setText(f"{filename} {status}")

    def on_completed(self, results):
        """Handle all files completed."""
        success_count = sum(1 for _, _, s in results if s)
        self.progress_bar.setValue(100)
        self.progress_label.setText(f"Completed: {success_count}/{len(results)} files")
        self.progress_label.setStyleSheet(f"color: {COLORS['green']};")
        self.file_label.setText("")
        self.start_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self.worker = None

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"
