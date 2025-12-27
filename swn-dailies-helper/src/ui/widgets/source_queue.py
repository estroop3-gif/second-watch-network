"""
Source queue widget for managing offload sources (cards/folders).
"""
from pathlib import Path
from typing import Optional, List

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QListWidget, QListWidgetItem, QFileDialog,
    QComboBox, QDialog, QScrollArea
)

from src.models.offload_models import (
    OffloadSource, OffloadQueue, detect_media_type,
    VIDEO_EXTENSIONS, AUDIO_EXTENSIONS
)
from src.services.card_reader import CardReader
from src.ui.styles import COLORS


class SourceItemWidget(QFrame):
    """Widget for displaying a single source in the queue."""

    remove_clicked = pyqtSignal(str)  # source_id
    media_type_changed = pyqtSignal(str, str)  # source_id, new_type

    def __init__(self, source: OffloadSource, parent=None):
        super().__init__(parent)
        self.source = source
        self._setup_ui()

    def _setup_ui(self):
        """Set up the item UI."""
        self.setObjectName("source-item")
        self.setStyleSheet(f"""
            #source-item {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 12px;
            }}
            #source-item:hover {{
                border-color: {COLORS['muted-gray']};
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(8)

        # Top row: name and remove button
        top_row = QHBoxLayout()
        top_row.setSpacing(8)

        # Camera icon and name
        icon = "🎥" if self.source.media_type == "camera" else "🎙️"
        name_label = QLabel(f"{icon} {self.source.display_name}")
        name_label.setStyleSheet(f"""
            font-size: 14px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        top_row.addWidget(name_label, 1)

        # Remove button
        remove_btn = QPushButton("×")
        remove_btn.setFixedSize(24, 24)
        remove_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        remove_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: transparent;
                color: {COLORS['muted-gray']};
                border: none;
                font-size: 18px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                color: {COLORS['red']};
            }}
        """)
        remove_btn.clicked.connect(lambda: self.remove_clicked.emit(self.source.id))
        top_row.addWidget(remove_btn)

        layout.addLayout(top_row)

        # Path
        path_label = QLabel(str(self.source.path))
        path_label.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 11px;
        """)
        path_label.setWordWrap(True)
        layout.addWidget(path_label)

        # Bottom row: file count, size, and media type toggle
        bottom_row = QHBoxLayout()
        bottom_row.setSpacing(8)

        # File count and size
        info_label = QLabel(f"{self.source.file_count} files  •  {self.source.size_formatted}")
        info_label.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 12px;
        """)
        bottom_row.addWidget(info_label)

        bottom_row.addStretch()

        # Media type badge/toggle
        self.type_combo = QComboBox()
        self.type_combo.addItem("📹 Camera", "camera")
        self.type_combo.addItem("🎤 Audio", "audio")
        self.type_combo.setCurrentIndex(0 if self.source.media_type == "camera" else 1)
        self.type_combo.setFixedWidth(110)
        self.type_combo.setStyleSheet(f"""
            QComboBox {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
            }}
        """)
        self.type_combo.currentIndexChanged.connect(self._on_type_changed)
        bottom_row.addWidget(self.type_combo)

        layout.addLayout(bottom_row)

    def _on_type_changed(self, index: int):
        """Handle media type change."""
        new_type = self.type_combo.currentData()
        self.media_type_changed.emit(self.source.id, new_type)


class DrivePickerDialog(QDialog):
    """Dialog for selecting a camera card/drive."""

    def __init__(self, drives: List[dict], parent=None):
        super().__init__(parent)
        self.drives = drives
        self.selected_path: Optional[Path] = None
        self.selected_camera: Optional[str] = None

        self.setWindowTitle("Select Card")
        self.setMinimumSize(400, 300)
        self.setModal(True)

        self._setup_ui()

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(16)

        # Title
        title = QLabel("Select Camera Card")
        title.setStyleSheet(f"""
            font-size: 18px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        layout.addWidget(title)

        if not self.drives:
            no_drives = QLabel("No removable drives detected.\n\nPlug in a camera card and try again.")
            no_drives.setStyleSheet(f"color: {COLORS['muted-gray']}; font-size: 13px;")
            no_drives.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(no_drives, 1)
        else:
            # Drive list
            self.drive_list = QListWidget()
            self.drive_list.setStyleSheet(f"""
                QListWidget {{
                    background-color: {COLORS['charcoal-dark']};
                    border: 1px solid {COLORS['border-gray']};
                    border-radius: 6px;
                }}
                QListWidget::item {{
                    padding: 12px;
                    border-bottom: 1px solid {COLORS['border-gray']};
                }}
                QListWidget::item:selected {{
                    background-color: {COLORS['accent-yellow']};
                    color: {COLORS['charcoal-black']};
                }}
            """)

            for drive in self.drives:
                name = drive.get("name", "Unknown")
                path = drive.get("path", "")
                camera = drive.get("cameraType")
                free = drive.get("freeSpace")

                display = name
                if camera:
                    display += f" ({camera})"
                if free:
                    free_gb = free / (1024**3)
                    display += f" - {free_gb:.1f} GB free"

                item = QListWidgetItem(display)
                item.setData(Qt.ItemDataRole.UserRole, drive)
                self.drive_list.addItem(item)

            self.drive_list.itemDoubleClicked.connect(self._on_select)
            layout.addWidget(self.drive_list, 1)

        # Buttons
        buttons = QHBoxLayout()
        buttons.setSpacing(12)

        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        buttons.addStretch()
        buttons.addWidget(cancel_btn)

        if self.drives:
            select_btn = QPushButton("Select")
            select_btn.setObjectName("primary-button")
            select_btn.clicked.connect(self._on_select)
            buttons.addWidget(select_btn)

        layout.addLayout(buttons)

        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
        """)

    def _on_select(self):
        """Handle selection."""
        if not self.drives:
            return

        item = self.drive_list.currentItem()
        if item:
            drive = item.data(Qt.ItemDataRole.UserRole)
            self.selected_path = Path(drive.get("path", ""))
            self.selected_camera = drive.get("cameraType")
            self.accept()


class SourceQueueWidget(QWidget):
    """Widget for managing the offload source queue."""

    # Emitted when the queue changes
    queue_changed = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.queue = OffloadQueue()
        self.card_reader = CardReader()
        self._setup_ui()

    def _setup_ui(self):
        """Set up the widget UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Header with buttons
        header = QHBoxLayout()
        header.setSpacing(8)

        add_card_btn = QPushButton("+ Add Card")
        add_card_btn.setMinimumHeight(40)
        add_card_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_card_btn.clicked.connect(self._on_add_card)
        add_card_btn.setStyleSheet(f"""
            QPushButton {{
                font-size: 13px;
                font-weight: bold;
                padding: 10px 16px;
            }}
        """)
        header.addWidget(add_card_btn)

        add_folder_btn = QPushButton("+ Add Folder")
        add_folder_btn.setMinimumHeight(40)
        add_folder_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_folder_btn.clicked.connect(self._on_add_folder)
        add_folder_btn.setStyleSheet(f"""
            QPushButton {{
                font-size: 13px;
                font-weight: bold;
                padding: 10px 16px;
            }}
        """)
        header.addWidget(add_folder_btn)

        header.addStretch()

        clear_btn = QPushButton("Clear All")
        clear_btn.setMinimumHeight(40)
        clear_btn.setObjectName("danger-button")
        clear_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        clear_btn.clicked.connect(self._on_clear_all)
        header.addWidget(clear_btn)

        layout.addLayout(header)

        # Sources list (scrollable)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)

        self.sources_container = QWidget()
        self.sources_layout = QVBoxLayout(self.sources_container)
        self.sources_layout.setContentsMargins(0, 0, 0, 0)
        self.sources_layout.setSpacing(8)
        self.sources_layout.addStretch()

        scroll.setWidget(self.sources_container)
        layout.addWidget(scroll, 1)

        # Empty state
        self.empty_label = QLabel("No sources added.\n\nClick 'Add Card' to select a camera card,\nor 'Add Folder' to browse for a folder.")
        self.empty_label.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 13px;
            padding: 40px;
        """)
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.sources_layout.insertWidget(0, self.empty_label)

        # Summary
        self.summary_label = QLabel("")
        self.summary_label.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 12px;
            padding: 8px 0;
        """)
        layout.addWidget(self.summary_label)

        self._update_ui()

    def _update_ui(self):
        """Update the UI based on current queue state."""
        # Clear existing source widgets
        for i in reversed(range(self.sources_layout.count())):
            widget = self.sources_layout.itemAt(i).widget()
            if isinstance(widget, SourceItemWidget):
                widget.deleteLater()

        # Show/hide empty state
        has_sources = len(self.queue.sources) > 0
        self.empty_label.setVisible(not has_sources)

        # Add source widgets
        for source in self.queue.sources:
            item_widget = SourceItemWidget(source)
            item_widget.remove_clicked.connect(self._on_remove_source)
            item_widget.media_type_changed.connect(self._on_media_type_changed)
            # Insert before the stretch
            self.sources_layout.insertWidget(self.sources_layout.count() - 1, item_widget)

        # Update summary
        if has_sources:
            total_files = self.queue.total_files
            total_size = self.queue.total_size
            size_str = self._format_size(total_size)
            self.summary_label.setText(f"Total: {len(self.queue.sources)} sources  •  {total_files} files  •  {size_str}")
        else:
            self.summary_label.setText("")

    def _format_size(self, size: int) -> str:
        """Format bytes as human-readable string."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    def _on_add_card(self):
        """Handle add card button click."""
        drives = self.card_reader.list_drives()

        # Filter to show removable/camera cards first
        removable = [d for d in drives if d.get("type") == "removable" or d.get("cameraType")]
        other = [d for d in drives if d not in removable]

        dialog = DrivePickerDialog(removable + other, self)
        if dialog.exec() == QDialog.DialogCode.Accepted and dialog.selected_path:
            self._add_source(dialog.selected_path, "card", dialog.selected_camera)

    def _on_add_folder(self):
        """Handle add folder button click."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )

        if folder:
            self._add_source(Path(folder), "folder", None)

    def _add_source(self, path: Path, source_type: str, detected_camera: Optional[str]):
        """Add a source to the queue."""
        # Find all media files
        all_extensions = VIDEO_EXTENSIONS | AUDIO_EXTENSIONS
        files = []

        for ext in all_extensions:
            files.extend(path.rglob(f"*{ext}"))
            files.extend(path.rglob(f"*{ext.upper()}"))

        # Remove duplicates
        files = list(set(files))

        if not files:
            # Show message - no media files found
            from PyQt6.QtWidgets import QMessageBox
            QMessageBox.warning(
                self,
                "No Media Files",
                f"No video or audio files found in:\n{path}\n\nPlease select a folder containing media files."
            )
            return

        # Get next camera label
        camera_label = self.queue.get_next_camera_label()

        # Create source
        source = OffloadSource.create(
            path=path,
            source_type=source_type,
            files=files,
            camera_label=camera_label,
            detected_camera=detected_camera,
        )

        # Add to queue
        self.queue.add_source(source)
        self._update_ui()
        self.queue_changed.emit()

    def _on_remove_source(self, source_id: str):
        """Handle remove source button click."""
        self.queue.remove_source(source_id)
        self._update_ui()
        self.queue_changed.emit()

    def _on_media_type_changed(self, source_id: str, new_type: str):
        """Handle media type change."""
        for source in self.queue.sources:
            if source.id == source_id:
                source.media_type = new_type
                # Update camera label if changed to audio
                if new_type == "audio":
                    source.camera_label = ""
                elif not source.camera_label:
                    source.camera_label = self.queue.get_next_camera_label()
                break

        self._update_ui()
        self.queue_changed.emit()

    def _on_clear_all(self):
        """Handle clear all button click."""
        if not self.queue.sources:
            return

        from PyQt6.QtWidgets import QMessageBox
        reply = QMessageBox.question(
            self,
            "Clear Queue",
            "Remove all sources from the queue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            self.queue.clear()
            self._update_ui()
            self.queue_changed.emit()

    def get_queue(self) -> OffloadQueue:
        """Get the current queue."""
        return self.queue

    def get_sources(self) -> List[OffloadSource]:
        """Get the list of sources."""
        return self.queue.sources

    def is_empty(self) -> bool:
        """Check if the queue is empty."""
        return len(self.queue.sources) == 0
