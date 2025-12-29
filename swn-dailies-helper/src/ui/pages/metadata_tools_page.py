"""
Metadata Tools page for viewing, editing, and copying file metadata.

Uses ExifTool for comprehensive metadata operations on media files.
"""
import json
from pathlib import Path
from typing import Dict, List, Optional

from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QScrollArea, QFileDialog, QLineEdit,
    QTabWidget, QTextEdit, QTreeWidget, QTreeWidgetItem,
    QHeaderView, QCheckBox, QGroupBox, QListWidget,
    QListWidgetItem, QMessageBox, QSplitter, QComboBox
)

from src.ui.styles import COLORS


class MetadataReadWorker(QThread):
    """Background worker to read metadata."""
    completed = pyqtSignal(object)  # FileMetadata
    error = pyqtSignal(str)

    def __init__(self, file_path: str):
        super().__init__()
        self.file_path = file_path

    def run(self):
        try:
            from src.services.exiftool_service import get_exiftool_service
            service = get_exiftool_service()
            metadata = service.extract_metadata(self.file_path)
            self.completed.emit(metadata)
        except Exception as e:
            self.error.emit(str(e))


class MetadataWriteWorker(QThread):
    """Background worker to write metadata."""
    completed = pyqtSignal(bool)
    error = pyqtSignal(str)

    def __init__(self, file_path: str, metadata: Dict[str, str]):
        super().__init__()
        self.file_path = file_path
        self.metadata = metadata

    def run(self):
        try:
            from src.services.exiftool_service import get_exiftool_service
            service = get_exiftool_service()
            success = service.write_metadata(self.file_path, self.metadata)
            self.completed.emit(success)
        except Exception as e:
            self.error.emit(str(e))


class MetadataCopyWorker(QThread):
    """Background worker to copy metadata between files."""
    progress = pyqtSignal(int, int, str)  # current, total, filename
    completed = pyqtSignal(dict)  # results per file
    error = pyqtSignal(str)

    def __init__(self, source_path: str, target_paths: List[str], tags: Optional[List[str]] = None):
        super().__init__()
        self.source_path = source_path
        self.target_paths = target_paths
        self.tags = tags

    def run(self):
        try:
            from src.services.exiftool_service import get_exiftool_service
            service = get_exiftool_service()

            results = {}
            total = len(self.target_paths)

            for i, target in enumerate(self.target_paths):
                self.progress.emit(i + 1, total, Path(target).name)
                success = service.copy_metadata(self.source_path, target, self.tags)
                results[target] = success

            self.completed.emit(results)
        except Exception as e:
            self.error.emit(str(e))


class MetadataToolsPage(QWidget):
    """Page for metadata viewing, editing, and copying operations."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.current_file = None
        self.current_metadata = None
        self.read_worker = None
        self.write_worker = None
        self.copy_worker = None

        self._setup_ui()

    def _setup_ui(self):
        """Set up the page UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Page title
        title = QLabel("Metadata Tools")
        title.setStyleSheet(f"font-size: 24px; font-weight: bold; color: {COLORS['bone-white']};")
        layout.addWidget(title)

        subtitle = QLabel("View, edit, and copy file metadata")
        subtitle.setStyleSheet(f"color: {COLORS['muted-gray']}; margin-bottom: 8px;")
        layout.addWidget(subtitle)

        # Tab widget for different operations
        self.tabs = QTabWidget()
        self.tabs.setDocumentMode(True)

        # View tab
        view_tab = self._create_view_tab()
        self.tabs.addTab(view_tab, "View")

        # Edit tab
        edit_tab = self._create_edit_tab()
        self.tabs.addTab(edit_tab, "Edit")

        # Copy tab
        copy_tab = self._create_copy_tab()
        self.tabs.addTab(copy_tab, "Copy")

        layout.addWidget(self.tabs, 1)

        self._apply_styles()
        self._check_service_availability()

    def _create_view_tab(self) -> QWidget:
        """Create the view metadata tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # File selection
        file_frame = self._create_card("Select File")
        file_layout = QHBoxLayout()
        file_layout.setContentsMargins(12, 12, 12, 12)

        self.view_file_path = QLineEdit()
        self.view_file_path.setPlaceholderText("Select a file to view its metadata...")
        self.view_file_path.setReadOnly(True)
        file_layout.addWidget(self.view_file_path, 1)

        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self._on_view_browse)
        file_layout.addWidget(browse_btn)

        file_frame.layout().addLayout(file_layout)
        layout.addWidget(file_frame)

        # Status
        self.view_status = QLabel("")
        self.view_status.setStyleSheet(f"color: {COLORS['muted-gray']};")
        layout.addWidget(self.view_status)

        # Metadata tree
        self.metadata_tree = QTreeWidget()
        self.metadata_tree.setHeaderLabels(["Tag", "Value"])
        self.metadata_tree.setRootIsDecorated(True)
        self.metadata_tree.setAlternatingRowColors(True)
        self.metadata_tree.header().setStretchLastSection(True)
        self.metadata_tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.ResizeToContents)
        layout.addWidget(self.metadata_tree, 1)

        # Actions
        actions_layout = QHBoxLayout()
        copy_json_btn = QPushButton("Copy as JSON")
        copy_json_btn.clicked.connect(self._on_copy_json)
        actions_layout.addWidget(copy_json_btn)

        export_btn = QPushButton("Export to File")
        export_btn.clicked.connect(self._on_export_metadata)
        actions_layout.addWidget(export_btn)

        actions_layout.addStretch()
        layout.addLayout(actions_layout)

        return widget

    def _create_edit_tab(self) -> QWidget:
        """Create the edit metadata tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # File selection
        file_frame = self._create_card("Select File to Edit")
        file_layout = QHBoxLayout()
        file_layout.setContentsMargins(12, 12, 12, 12)

        self.edit_file_path = QLineEdit()
        self.edit_file_path.setPlaceholderText("Select a file to edit its metadata...")
        self.edit_file_path.setReadOnly(True)
        file_layout.addWidget(self.edit_file_path, 1)

        edit_browse_btn = QPushButton("Browse...")
        edit_browse_btn.clicked.connect(self._on_edit_browse)
        file_layout.addWidget(edit_browse_btn)

        file_frame.layout().addLayout(file_layout)
        layout.addWidget(file_frame)

        # Edit fields
        edit_frame = self._create_card("Metadata Tags")
        edit_form = QVBoxLayout()
        edit_form.setContentsMargins(12, 12, 12, 12)
        edit_form.setSpacing(8)

        # Common tags to edit
        self.edit_fields = {}
        common_tags = [
            ("Artist", "Creator/photographer name"),
            ("Copyright", "Copyright notice"),
            ("Title", "Title or name"),
            ("Description", "Description or caption"),
            ("Keywords", "Comma-separated keywords"),
            ("Comment", "General comment"),
        ]

        for tag, placeholder in common_tags:
            row = QHBoxLayout()
            check = QCheckBox(tag)
            check.setFixedWidth(100)
            row.addWidget(check)

            field = QLineEdit()
            field.setPlaceholderText(placeholder)
            field.setEnabled(False)
            row.addWidget(field, 1)

            # Enable field when checkbox is checked
            check.toggled.connect(lambda checked, f=field: f.setEnabled(checked))

            self.edit_fields[tag] = (check, field)
            edit_form.addLayout(row)

        edit_frame.layout().addLayout(edit_form)
        layout.addWidget(edit_frame)

        # Custom tag
        custom_frame = self._create_card("Custom Tag")
        custom_layout = QHBoxLayout()
        custom_layout.setContentsMargins(12, 12, 12, 12)

        self.custom_tag = QLineEdit()
        self.custom_tag.setPlaceholderText("Tag name (e.g., XMP:Creator)")
        custom_layout.addWidget(self.custom_tag)

        self.custom_value = QLineEdit()
        self.custom_value.setPlaceholderText("Value")
        custom_layout.addWidget(self.custom_value, 1)

        custom_frame.layout().addLayout(custom_layout)
        layout.addWidget(custom_frame)

        # Status and apply button
        self.edit_status = QLabel("")
        self.edit_status.setStyleSheet(f"color: {COLORS['muted-gray']};")
        layout.addWidget(self.edit_status)

        apply_layout = QHBoxLayout()
        apply_layout.addStretch()

        apply_btn = QPushButton("Apply Changes")
        apply_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['green']};
                color: white;
                font-weight: bold;
                padding: 10px 24px;
            }}
            QPushButton:hover {{
                background-color: #1ea350;
            }}
        """)
        apply_btn.clicked.connect(self._on_apply_edit)
        apply_layout.addWidget(apply_btn)

        layout.addLayout(apply_layout)
        layout.addStretch()

        return widget

    def _create_copy_tab(self) -> QWidget:
        """Create the copy metadata tab."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(12)

        # Source file
        source_frame = self._create_card("Source File")
        source_layout = QHBoxLayout()
        source_layout.setContentsMargins(12, 12, 12, 12)

        self.copy_source_path = QLineEdit()
        self.copy_source_path.setPlaceholderText("Select source file to copy metadata from...")
        self.copy_source_path.setReadOnly(True)
        source_layout.addWidget(self.copy_source_path, 1)

        source_browse_btn = QPushButton("Browse...")
        source_browse_btn.clicked.connect(self._on_source_browse)
        source_layout.addWidget(source_browse_btn)

        source_frame.layout().addLayout(source_layout)
        layout.addWidget(source_frame)

        # Target files
        target_frame = self._create_card("Target Files")
        target_layout = QVBoxLayout()
        target_layout.setContentsMargins(12, 12, 12, 12)
        target_layout.setSpacing(8)

        self.target_list = QListWidget()
        self.target_list.setMinimumHeight(120)
        target_layout.addWidget(self.target_list)

        target_buttons = QHBoxLayout()
        add_files_btn = QPushButton("Add Files...")
        add_files_btn.clicked.connect(self._on_add_targets)
        target_buttons.addWidget(add_files_btn)

        add_folder_btn = QPushButton("Add Folder...")
        add_folder_btn.clicked.connect(self._on_add_target_folder)
        target_buttons.addWidget(add_folder_btn)

        clear_btn = QPushButton("Clear")
        clear_btn.clicked.connect(lambda: self.target_list.clear())
        target_buttons.addWidget(clear_btn)

        target_buttons.addStretch()
        target_layout.addLayout(target_buttons)

        target_frame.layout().addLayout(target_layout)
        layout.addWidget(target_frame)

        # Tag selection
        tags_frame = self._create_card("Tags to Copy")
        tags_layout = QVBoxLayout()
        tags_layout.setContentsMargins(12, 12, 12, 12)
        tags_layout.setSpacing(8)

        self.copy_all_tags = QCheckBox("Copy all metadata tags")
        self.copy_all_tags.setChecked(True)
        self.copy_all_tags.toggled.connect(self._on_copy_all_toggled)
        tags_layout.addWidget(self.copy_all_tags)

        # Tag group checkboxes
        self.tag_groups = {}
        tag_groups = [
            ("camera", "Camera info (make, model, settings)"),
            ("datetime", "Date/time information"),
            ("gps", "GPS location"),
            ("copyright", "Copyright and artist"),
            ("iptc", "IPTC metadata"),
        ]

        for tag_id, description in tag_groups:
            check = QCheckBox(description)
            check.setEnabled(False)
            self.tag_groups[tag_id] = check
            tags_layout.addWidget(check)

        tags_frame.layout().addLayout(tags_layout)
        layout.addWidget(tags_frame)

        # Status and copy button
        self.copy_status = QLabel("")
        self.copy_status.setStyleSheet(f"color: {COLORS['muted-gray']};")
        layout.addWidget(self.copy_status)

        copy_layout = QHBoxLayout()
        copy_layout.addStretch()

        self.copy_btn = QPushButton("Copy Metadata")
        self.copy_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['blue']};
                color: white;
                font-weight: bold;
                padding: 10px 24px;
            }}
            QPushButton:hover {{
                background-color: #2563eb;
            }}
        """)
        self.copy_btn.clicked.connect(self._on_copy_metadata)
        copy_layout.addWidget(self.copy_btn)

        layout.addLayout(copy_layout)
        layout.addStretch()

        return widget

    def _create_card(self, title: str) -> QFrame:
        """Create a card frame with title."""
        frame = QFrame()
        frame.setObjectName("card")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        title_label = QLabel(title)
        title_label.setStyleSheet(f"""
            background-color: {COLORS['charcoal-dark']};
            color: {COLORS['accent-yellow']};
            font-weight: bold;
            padding: 10px 12px;
            border-bottom: 1px solid {COLORS['border-gray']};
        """)
        layout.addWidget(title_label)

        return frame

    def _apply_styles(self):
        """Apply styles to the page."""
        self.setStyleSheet(f"""
            QWidget {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['bone-white']};
            }}
            #card {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
            QLineEdit {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                padding: 8px 12px;
                border-radius: 4px;
            }}
            QLineEdit:disabled {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['muted-gray']};
            }}
            QPushButton {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                padding: 8px 16px;
                border-radius: 4px;
            }}
            QPushButton:hover {{
                background-color: {COLORS['border-gray']};
            }}
            QCheckBox {{
                color: {COLORS['bone-white']};
            }}
            QCheckBox::indicator {{
                width: 16px;
                height: 16px;
                border: 1px solid {COLORS['border-gray']};
                border-radius: 3px;
                background-color: {COLORS['charcoal-dark']};
            }}
            QCheckBox::indicator:checked {{
                background-color: {COLORS['accent-yellow']};
                border-color: {COLORS['accent-yellow']};
            }}
            QTabWidget::pane {{
                border: none;
                background-color: {COLORS['charcoal-black']};
            }}
            QTabBar::tab {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['muted-gray']};
                padding: 12px 24px;
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
            QTreeWidget {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
                alternate-background-color: {COLORS['charcoal-light']};
            }}
            QTreeWidget::item {{
                padding: 4px;
            }}
            QTreeWidget::item:selected {{
                background-color: {COLORS['border-gray']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-black']};
                color: {COLORS['muted-gray']};
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
            }}
            QListWidget {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 4px;
            }}
            QListWidget::item {{
                padding: 6px;
            }}
            QListWidget::item:selected {{
                background-color: {COLORS['border-gray']};
            }}
        """)

    def _check_service_availability(self):
        """Check if ExifTool service is available."""
        try:
            from src.services.exiftool_service import get_exiftool_service
            service = get_exiftool_service()
            if not service.is_available:
                self.view_status.setText("ExifTool is not available")
                self.view_status.setStyleSheet(f"color: {COLORS['red']};")
        except Exception as e:
            self.view_status.setText(f"Error: {e}")

    def _on_view_browse(self):
        """Handle browse for view tab."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select File",
            "",
            "All Files (*)"
        )
        if file_path:
            self.view_file_path.setText(file_path)
            self._load_metadata(file_path)

    def _load_metadata(self, file_path: str):
        """Load metadata for the selected file."""
        self.current_file = file_path
        self.view_status.setText("Loading metadata...")
        self.metadata_tree.clear()

        self.read_worker = MetadataReadWorker(file_path)
        self.read_worker.completed.connect(self._on_metadata_loaded)
        self.read_worker.error.connect(self._on_metadata_error)
        self.read_worker.start()

    def _on_metadata_loaded(self, metadata):
        """Handle successful metadata load."""
        self.current_metadata = metadata
        self.read_worker = None

        if not metadata:
            self.view_status.setText("No metadata found")
            return

        self.view_status.setText(f"Loaded {len(metadata.raw_data)} tags")
        self._populate_metadata_tree(metadata)

    def _on_metadata_error(self, error: str):
        """Handle metadata load error."""
        self.read_worker = None
        self.view_status.setText(f"Error: {error}")
        self.view_status.setStyleSheet(f"color: {COLORS['red']};")

    def _populate_metadata_tree(self, metadata):
        """Populate the metadata tree with data."""
        self.metadata_tree.clear()

        if not metadata or not metadata.raw_data:
            return

        # Group by category
        categories = {}
        for key, value in metadata.raw_data.items():
            if ':' in key:
                category, tag = key.split(':', 1)
            else:
                category = "Other"
                tag = key
            if category not in categories:
                categories[category] = []
            categories[category].append((tag, value))

        # Add to tree
        for category in sorted(categories.keys()):
            cat_item = QTreeWidgetItem([category, ""])
            self.metadata_tree.addTopLevelItem(cat_item)

            for tag, value in sorted(categories[category]):
                value_str = str(value) if value is not None else ""
                item = QTreeWidgetItem([tag, value_str])
                cat_item.addChild(item)

            cat_item.setExpanded(True)

    def _on_copy_json(self):
        """Copy metadata as JSON to clipboard."""
        if not self.current_metadata or not self.current_metadata.raw_data:
            return

        from PyQt6.QtWidgets import QApplication
        json_str = json.dumps(self.current_metadata.raw_data, indent=2, default=str)
        clipboard = QApplication.clipboard()
        clipboard.setText(json_str)
        self.view_status.setText("JSON copied to clipboard")

    def _on_export_metadata(self):
        """Export metadata to file."""
        if not self.current_metadata:
            return

        default_name = Path(self.current_file).stem + "_metadata.json"
        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Metadata",
            default_name,
            "JSON Files (*.json)"
        )

        if not file_path:
            return

        try:
            with open(file_path, 'w') as f:
                json.dump(self.current_metadata.raw_data, f, indent=2, default=str)
            self.view_status.setText(f"Exported to {Path(file_path).name}")
        except Exception as e:
            self.view_status.setText(f"Export error: {e}")

    def _on_edit_browse(self):
        """Handle browse for edit tab."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select File to Edit",
            "",
            "All Files (*)"
        )
        if file_path:
            self.edit_file_path.setText(file_path)
            self.edit_status.setText("")

    def _on_apply_edit(self):
        """Apply metadata edits."""
        file_path = self.edit_file_path.text()
        if not file_path:
            self.edit_status.setText("Please select a file first")
            return

        # Collect metadata to write
        metadata = {}
        for tag, (check, field) in self.edit_fields.items():
            if check.isChecked() and field.text().strip():
                metadata[tag] = field.text().strip()

        # Add custom tag if specified
        if self.custom_tag.text().strip() and self.custom_value.text().strip():
            metadata[self.custom_tag.text().strip()] = self.custom_value.text().strip()

        if not metadata:
            self.edit_status.setText("No metadata to write")
            return

        # Confirm
        reply = QMessageBox.question(
            self,
            "Confirm Edit",
            f"This will modify {len(metadata)} tag(s) in:\n{Path(file_path).name}\n\nContinue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        self.edit_status.setText("Writing metadata...")
        self.write_worker = MetadataWriteWorker(file_path, metadata)
        self.write_worker.completed.connect(self._on_write_completed)
        self.write_worker.error.connect(self._on_write_error)
        self.write_worker.start()

    def _on_write_completed(self, success: bool):
        """Handle write completion."""
        self.write_worker = None
        if success:
            self.edit_status.setText("Metadata written successfully")
            self.edit_status.setStyleSheet(f"color: {COLORS['green']};")
        else:
            self.edit_status.setText("Failed to write metadata")
            self.edit_status.setStyleSheet(f"color: {COLORS['red']};")

    def _on_write_error(self, error: str):
        """Handle write error."""
        self.write_worker = None
        self.edit_status.setText(f"Error: {error}")
        self.edit_status.setStyleSheet(f"color: {COLORS['red']};")

    def _on_source_browse(self):
        """Browse for source file."""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Source File",
            "",
            "All Files (*)"
        )
        if file_path:
            self.copy_source_path.setText(file_path)

    def _on_add_targets(self):
        """Add target files."""
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "Select Target Files",
            "",
            "All Files (*)"
        )
        for f in files:
            if not self._is_in_list(f):
                self.target_list.addItem(f)

    def _on_add_target_folder(self):
        """Add all files from a folder."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Folder"
        )
        if folder:
            path = Path(folder)
            for f in path.iterdir():
                if f.is_file():
                    if not self._is_in_list(str(f)):
                        self.target_list.addItem(str(f))

    def _is_in_list(self, file_path: str) -> bool:
        """Check if file is already in target list."""
        for i in range(self.target_list.count()):
            if self.target_list.item(i).text() == file_path:
                return True
        return False

    def _on_copy_all_toggled(self, checked: bool):
        """Toggle individual tag group checkboxes."""
        for check in self.tag_groups.values():
            check.setEnabled(not checked)
            if checked:
                check.setChecked(False)

    def _on_copy_metadata(self):
        """Copy metadata from source to target files."""
        source = self.copy_source_path.text()
        if not source:
            self.copy_status.setText("Please select a source file")
            return

        targets = []
        for i in range(self.target_list.count()):
            targets.append(self.target_list.item(i).text())

        if not targets:
            self.copy_status.setText("Please add target files")
            return

        # Determine which tags to copy
        tags = None
        if not self.copy_all_tags.isChecked():
            tags = []
            tag_mapping = {
                "camera": ["Make", "Model", "LensModel", "ISO", "FNumber", "ExposureTime"],
                "datetime": ["DateTimeOriginal", "CreateDate", "ModifyDate"],
                "gps": ["GPSLatitude", "GPSLongitude", "GPSAltitude"],
                "copyright": ["Copyright", "Artist", "Creator"],
                "iptc": ["Keywords", "Subject", "Headline", "Caption-Abstract"],
            }
            for tag_id, check in self.tag_groups.items():
                if check.isChecked() and tag_id in tag_mapping:
                    tags.extend(tag_mapping[tag_id])

            if not tags:
                self.copy_status.setText("Please select tags to copy")
                return

        # Confirm
        reply = QMessageBox.question(
            self,
            "Confirm Copy",
            f"Copy metadata from:\n{Path(source).name}\n\nTo {len(targets)} file(s)?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        self.copy_btn.setEnabled(False)
        self.copy_status.setText("Copying metadata...")

        self.copy_worker = MetadataCopyWorker(source, targets, tags)
        self.copy_worker.progress.connect(self._on_copy_progress)
        self.copy_worker.completed.connect(self._on_copy_completed)
        self.copy_worker.error.connect(self._on_copy_error)
        self.copy_worker.start()

    def _on_copy_progress(self, current: int, total: int, filename: str):
        """Handle copy progress."""
        self.copy_status.setText(f"Processing {current}/{total}: {filename}")

    def _on_copy_completed(self, results: dict):
        """Handle copy completion."""
        self.copy_worker = None
        self.copy_btn.setEnabled(True)

        success_count = sum(1 for v in results.values() if v)
        total = len(results)

        if success_count == total:
            self.copy_status.setText(f"Successfully copied metadata to {total} file(s)")
            self.copy_status.setStyleSheet(f"color: {COLORS['green']};")
        else:
            self.copy_status.setText(f"Copied to {success_count}/{total} files")
            self.copy_status.setStyleSheet(f"color: {COLORS['orange']};")

    def _on_copy_error(self, error: str):
        """Handle copy error."""
        self.copy_worker = None
        self.copy_btn.setEnabled(True)
        self.copy_status.setText(f"Error: {error}")
        self.copy_status.setStyleSheet(f"color: {COLORS['red']};")
