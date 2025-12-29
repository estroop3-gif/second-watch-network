"""
MHL Tools page - Verify MHL/ASC-MHL files.

Provides a standalone tool for verifying MHL files received from others,
supporting both standard MHL (Pomfort) and ASC-MHL formats.
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
    QLineEdit,
    QFileDialog,
    QTableWidget,
    QTableWidgetItem,
    QHeaderView,
    QProgressBar,
    QRadioButton,
    QButtonGroup,
    QTextEdit,
    QMessageBox,
    QSplitter,
    QApplication,
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QColor

from src.ui.styles import COLORS


class MHLVerificationWorker(QThread):
    """Background worker for MHL verification."""

    progress = pyqtSignal(int, int, str)  # current, total, filename
    file_verified = pyqtSignal(str, str, bool)  # path, status, success
    completed = pyqtSignal(object)  # VerificationResult
    error = pyqtSignal(str)

    def __init__(self, mhl_path: str, is_asc_mhl: bool = False):
        super().__init__()
        self.mhl_path = mhl_path
        self.is_asc_mhl = is_asc_mhl

    def run(self):
        try:
            from src.services.mhl_service import get_mhl_service

            mhl_service = get_mhl_service()

            if self.is_asc_mhl:
                result = mhl_service.verify_asc_mhl(self.mhl_path)
            else:
                result = mhl_service.verify_mhl(self.mhl_path)

            self.completed.emit(result)
        except Exception as e:
            self.error.emit(str(e))


class MHLToolsPage(QWidget):
    """MHL verification tools page."""

    def __init__(self):
        super().__init__()
        self._worker: Optional[MHLVerificationWorker] = None
        self._current_result = None
        self.setup_ui()

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        header = self._create_header()
        layout.addLayout(header)

        # Main content splitter
        splitter = QSplitter(Qt.Orientation.Vertical)

        # Top section - Input and controls
        top_widget = QWidget()
        top_layout = QVBoxLayout(top_widget)
        top_layout.setContentsMargins(0, 0, 0, 0)

        # Input card
        input_card = self._create_input_card()
        top_layout.addWidget(input_card)

        splitter.addWidget(top_widget)

        # Bottom section - Results
        results_widget = self._create_results_section()
        splitter.addWidget(results_widget)

        splitter.setSizes([200, 400])
        layout.addWidget(splitter, 1)

    def _create_header(self) -> QHBoxLayout:
        """Create the page header."""
        header = QHBoxLayout()

        title_container = QVBoxLayout()
        title = QLabel("MHL Verification")
        title.setObjectName("page-title")
        title_container.addWidget(title)

        subtitle = QLabel("Verify media file integrity using MHL or ASC-MHL manifests")
        subtitle.setObjectName("page-subtitle")
        title_container.addWidget(subtitle)

        header.addLayout(title_container)
        header.addStretch()

        # Status indicator
        self.status_label = QLabel("")
        self.status_label.setStyleSheet(f"font-size: 14px; font-weight: bold;")
        header.addWidget(self.status_label)

        return header

    def _create_input_card(self) -> QFrame:
        """Create the input controls card."""
        card = QFrame()
        card.setObjectName("card")
        layout = QVBoxLayout(card)
        layout.setSpacing(16)

        # Section title
        section_title = QLabel("VERIFY MHL FILE")
        section_title.setStyleSheet(f"font-weight: bold; color: {COLORS['muted-gray']}; font-size: 11px;")
        layout.addWidget(section_title)

        # File input row
        file_row = QHBoxLayout()
        file_row.setSpacing(12)

        file_label = QLabel("MHL File:")
        file_label.setFixedWidth(80)
        file_row.addWidget(file_label)

        self.file_input = QLineEdit()
        self.file_input.setPlaceholderText("Select an MHL file or ASC-MHL folder...")
        self.file_input.textChanged.connect(self._on_file_changed)
        file_row.addWidget(self.file_input)

        self.browse_btn = QPushButton("Browse...")
        self.browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.browse_btn.clicked.connect(self._browse_file)
        file_row.addWidget(self.browse_btn)

        layout.addLayout(file_row)

        # Format selection row
        format_row = QHBoxLayout()
        format_row.setSpacing(12)

        format_label = QLabel("Format:")
        format_label.setFixedWidth(80)
        format_row.addWidget(format_label)

        self.format_group = QButtonGroup(self)

        self.standard_mhl_radio = QRadioButton("Standard MHL (.mhl file)")
        self.standard_mhl_radio.setChecked(True)
        self.format_group.addButton(self.standard_mhl_radio, 0)
        format_row.addWidget(self.standard_mhl_radio)

        self.asc_mhl_radio = QRadioButton("ASC-MHL (folder with ascmhl/)")
        self.format_group.addButton(self.asc_mhl_radio, 1)
        format_row.addWidget(self.asc_mhl_radio)

        format_row.addStretch()
        layout.addLayout(format_row)

        # Action buttons row
        action_row = QHBoxLayout()
        action_row.setSpacing(12)

        self.verify_btn = QPushButton("Start Verification")
        self.verify_btn.setObjectName("primary-button")
        self.verify_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.verify_btn.clicked.connect(self._start_verification)
        self.verify_btn.setEnabled(False)
        action_row.addWidget(self.verify_btn)

        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setObjectName("danger-button")
        self.cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.cancel_btn.clicked.connect(self._cancel_verification)
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.setVisible(False)
        action_row.addWidget(self.cancel_btn)

        action_row.addStretch()

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
        action_row.addWidget(self.progress_bar, 1)

        layout.addLayout(action_row)

        return card

    def _create_results_section(self) -> QWidget:
        """Create the results display section."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Results header
        results_header = QHBoxLayout()

        results_title = QLabel("RESULTS")
        results_title.setStyleSheet(f"font-weight: bold; color: {COLORS['muted-gray']}; font-size: 11px;")
        results_header.addWidget(results_title)

        results_header.addStretch()

        # Summary stats (hidden until verification)
        self.stats_container = QWidget()
        stats_layout = QHBoxLayout(self.stats_container)
        stats_layout.setContentsMargins(0, 0, 0, 0)
        stats_layout.setSpacing(24)

        self.total_label = QLabel("Total: 0")
        self.total_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        stats_layout.addWidget(self.total_label)

        self.passed_label = QLabel("Passed: 0")
        self.passed_label.setStyleSheet(f"color: {COLORS['green']};")
        stats_layout.addWidget(self.passed_label)

        self.failed_label = QLabel("Failed: 0")
        self.failed_label.setStyleSheet(f"color: {COLORS['red']};")
        stats_layout.addWidget(self.failed_label)

        self.missing_label = QLabel("Missing: 0")
        self.missing_label.setStyleSheet(f"color: {COLORS['orange']};")
        stats_layout.addWidget(self.missing_label)

        self.stats_container.setVisible(False)
        results_header.addWidget(self.stats_container)

        layout.addLayout(results_header)

        # Results table
        self.results_table = QTableWidget()
        self.results_table.setColumnCount(4)
        self.results_table.setHorizontalHeaderLabels(["File", "Status", "Hash Algorithm", "Details"])
        self.results_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.results_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Fixed)
        self.results_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Fixed)
        self.results_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.results_table.setColumnWidth(1, 100)
        self.results_table.setColumnWidth(2, 120)
        self.results_table.setAlternatingRowColors(True)
        self.results_table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.results_table.setStyleSheet(f"""
            QTableWidget {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 8px;
                gridline-color: {COLORS['border-gray']};
            }}
            QTableWidget::item {{
                padding: 8px;
            }}
            QTableWidget::item:alternate {{
                background-color: {COLORS['charcoal-black']};
            }}
            QHeaderView::section {{
                background-color: {COLORS['charcoal-dark']};
                color: {COLORS['muted-gray']};
                font-weight: bold;
                padding: 8px;
                border: none;
                border-bottom: 1px solid {COLORS['border-gray']};
            }}
        """)
        layout.addWidget(self.results_table, 1)

        # Bottom buttons
        bottom_row = QHBoxLayout()

        self.export_btn = QPushButton("Export Report")
        self.export_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.export_btn.clicked.connect(self._export_report)
        self.export_btn.setEnabled(False)
        bottom_row.addWidget(self.export_btn)

        self.copy_btn = QPushButton("Copy Summary")
        self.copy_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.copy_btn.clicked.connect(self._copy_summary)
        self.copy_btn.setEnabled(False)
        bottom_row.addWidget(self.copy_btn)

        bottom_row.addStretch()

        # Duration label
        self.duration_label = QLabel("")
        self.duration_label.setStyleSheet(f"color: {COLORS['muted-gray']};")
        bottom_row.addWidget(self.duration_label)

        layout.addLayout(bottom_row)

        return widget

    def _on_file_changed(self, text: str):
        """Handle file input change."""
        path = Path(text) if text else None
        is_valid = path and path.exists() if path else False

        self.verify_btn.setEnabled(is_valid)

        # Auto-detect format
        if is_valid:
            if path.is_dir() and (path / "ascmhl").exists():
                self.asc_mhl_radio.setChecked(True)
            elif path.suffix.lower() == ".mhl":
                self.standard_mhl_radio.setChecked(True)

    def _browse_file(self):
        """Open file/folder browser."""
        if self.asc_mhl_radio.isChecked():
            # Browse for folder
            folder = QFileDialog.getExistingDirectory(
                self,
                "Select ASC-MHL Folder",
                "",
                QFileDialog.Option.ShowDirsOnly
            )
            if folder:
                self.file_input.setText(folder)
        else:
            # Browse for file
            file_path, _ = QFileDialog.getOpenFileName(
                self,
                "Select MHL File",
                "",
                "MHL Files (*.mhl);;All Files (*)"
            )
            if file_path:
                self.file_input.setText(file_path)

    def _start_verification(self):
        """Start the MHL verification process."""
        mhl_path = self.file_input.text().strip()
        if not mhl_path:
            return

        is_asc_mhl = self.asc_mhl_radio.isChecked()

        # Check service availability
        try:
            from src.services.mhl_service import get_mhl_service
            mhl_service = get_mhl_service()

            if is_asc_mhl and not mhl_service.is_ascmhl_available:
                QMessageBox.warning(
                    self,
                    "ASC-MHL Not Available",
                    "The ASC-MHL library is not installed.\n\n"
                    "Install it with: pip install ascmhl"
                )
                return

            if not is_asc_mhl and not mhl_service.is_mhl_tool_available:
                # Will fall back to Python parsing, which is fine
                pass

        except ImportError as e:
            QMessageBox.critical(self, "Error", f"MHL service not available: {e}")
            return

        # Update UI for running state
        self.verify_btn.setEnabled(False)
        self.cancel_btn.setEnabled(True)
        self.cancel_btn.setVisible(True)
        self.browse_btn.setEnabled(False)
        self.file_input.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setRange(0, 0)  # Indeterminate

        self.status_label.setText("Verifying...")
        self.status_label.setStyleSheet(f"font-size: 14px; font-weight: bold; color: {COLORS['blue']};")

        # Clear previous results
        self.results_table.setRowCount(0)
        self.stats_container.setVisible(False)
        self.export_btn.setEnabled(False)
        self.copy_btn.setEnabled(False)
        self.duration_label.setText("")

        # Start worker
        self._worker = MHLVerificationWorker(mhl_path, is_asc_mhl)
        self._worker.completed.connect(self._on_verification_completed)
        self._worker.error.connect(self._on_verification_error)
        self._worker.start()

    def _cancel_verification(self):
        """Cancel the running verification."""
        if self._worker and self._worker.isRunning():
            self._worker.terminate()
            self._worker.wait()

        self._reset_ui()
        self.status_label.setText("Cancelled")
        self.status_label.setStyleSheet(f"font-size: 14px; font-weight: bold; color: {COLORS['orange']};")

    def _on_verification_completed(self, result):
        """Handle verification completion."""
        self._current_result = result
        self._reset_ui()

        # Update status
        if result.success:
            self.status_label.setText("VERIFIED")
            self.status_label.setStyleSheet(f"font-size: 14px; font-weight: bold; color: {COLORS['green']};")
        else:
            if result.failed_files > 0 or result.missing_files > 0:
                self.status_label.setText("FAILED")
                self.status_label.setStyleSheet(f"font-size: 14px; font-weight: bold; color: {COLORS['red']};")
            else:
                self.status_label.setText("ERROR")
                self.status_label.setStyleSheet(f"font-size: 14px; font-weight: bold; color: {COLORS['red']};")

        # Update stats
        self.stats_container.setVisible(True)
        self.total_label.setText(f"Total: {result.total_files}")
        self.passed_label.setText(f"Passed: {result.verified_files}")
        self.failed_label.setText(f"Failed: {result.failed_files}")
        self.missing_label.setText(f"Missing: {result.missing_files}")

        # Update duration
        if result.duration_seconds > 0:
            minutes = int(result.duration_seconds // 60)
            seconds = int(result.duration_seconds % 60)
            if minutes > 0:
                self.duration_label.setText(f"Duration: {minutes}m {seconds}s")
            else:
                self.duration_label.setText(f"Duration: {seconds}s")

        # Populate results table
        self.results_table.setRowCount(len(result.files))

        for row, file_result in enumerate(result.files):
            # File name
            file_item = QTableWidgetItem(Path(file_result.file_path).name)
            file_item.setToolTip(file_result.file_path)
            self.results_table.setItem(row, 0, file_item)

            # Status
            status_item = QTableWidgetItem(file_result.status.value.upper())
            if file_result.status.value == "ok":
                status_item.setForeground(QColor(COLORS['green']))
            elif file_result.status.value in ("failed", "error"):
                status_item.setForeground(QColor(COLORS['red']))
            elif file_result.status.value == "missing":
                status_item.setForeground(QColor(COLORS['orange']))
            self.results_table.setItem(row, 1, status_item)

            # Hash algorithm
            algo_item = QTableWidgetItem(file_result.hash_algorithm.upper() if file_result.hash_algorithm else "-")
            self.results_table.setItem(row, 2, algo_item)

            # Details
            if file_result.status.value == "failed":
                details = f"Expected: {file_result.expected_hash[:16]}... | Actual: {file_result.actual_hash[:16]}..."
            elif file_result.message:
                details = file_result.message
            else:
                details = "OK"
            details_item = QTableWidgetItem(details)
            self.results_table.setItem(row, 3, details_item)

        # Show errors if any
        if result.errors:
            for error in result.errors:
                row = self.results_table.rowCount()
                self.results_table.insertRow(row)
                error_item = QTableWidgetItem(f"Error: {error}")
                error_item.setForeground(QColor(COLORS['red']))
                self.results_table.setItem(row, 0, error_item)
                self.results_table.setSpan(row, 0, 1, 4)

        # Enable export/copy
        self.export_btn.setEnabled(True)
        self.copy_btn.setEnabled(True)

    def _on_verification_error(self, error_msg: str):
        """Handle verification error."""
        self._reset_ui()
        self.status_label.setText("ERROR")
        self.status_label.setStyleSheet(f"font-size: 14px; font-weight: bold; color: {COLORS['red']};")

        QMessageBox.critical(self, "Verification Error", error_msg)

    def _reset_ui(self):
        """Reset UI to idle state."""
        self.verify_btn.setEnabled(True)
        self.cancel_btn.setEnabled(False)
        self.cancel_btn.setVisible(False)
        self.browse_btn.setEnabled(True)
        self.file_input.setEnabled(True)
        self.progress_bar.setVisible(False)

    def _export_report(self):
        """Export verification results to a file."""
        if not self._current_result:
            return

        file_path, _ = QFileDialog.getSaveFileName(
            self,
            "Export Verification Report",
            f"mhl_verification_{self._current_result.timestamp or 'report'}.txt",
            "Text Files (*.txt);;JSON Files (*.json);;All Files (*)"
        )

        if not file_path:
            return

        try:
            result = self._current_result
            lines = [
                "MHL VERIFICATION REPORT",
                "=" * 50,
                f"MHL File: {result.mhl_path}",
                f"Status: {'VERIFIED' if result.success else 'FAILED'}",
                f"Total Files: {result.total_files}",
                f"Verified: {result.verified_files}",
                f"Failed: {result.failed_files}",
                f"Missing: {result.missing_files}",
                f"Duration: {result.duration_seconds:.2f}s",
                "",
                "FILE RESULTS",
                "-" * 50,
            ]

            for f in result.files:
                status_str = f.status.value.upper()
                lines.append(f"{status_str}: {f.file_path}")
                if f.status.value == "failed":
                    lines.append(f"  Expected: {f.expected_hash}")
                    lines.append(f"  Actual:   {f.actual_hash}")

            if result.errors:
                lines.extend(["", "ERRORS", "-" * 50])
                lines.extend(result.errors)

            with open(file_path, 'w') as f:
                f.write("\n".join(lines))

            QMessageBox.information(self, "Export Complete", f"Report saved to:\n{file_path}")

        except Exception as e:
            QMessageBox.critical(self, "Export Error", f"Failed to export report: {e}")

    def _copy_summary(self):
        """Copy verification summary to clipboard."""
        if not self._current_result:
            return

        result = self._current_result
        summary = (
            f"MHL Verification: {'VERIFIED' if result.success else 'FAILED'}\n"
            f"Total: {result.total_files} | "
            f"Passed: {result.verified_files} | "
            f"Failed: {result.failed_files} | "
            f"Missing: {result.missing_files}"
        )

        clipboard = QApplication.clipboard()
        clipboard.setText(summary)

        # Brief feedback
        self.copy_btn.setText("Copied!")
        self.copy_btn.setEnabled(False)

        # Reset after 1 second
        from PyQt6.QtCore import QTimer
        QTimer.singleShot(1000, lambda: (
            self.copy_btn.setText("Copy Summary"),
            self.copy_btn.setEnabled(True)
        ))
