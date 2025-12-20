"""
Reports page - Generate and view offload/QC reports.
"""
from pathlib import Path
from datetime import datetime
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QListWidget,
    QListWidgetItem,
    QTextEdit,
    QFileDialog,
    QComboBox,
    QMessageBox,
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont

from src.services.config import ConfigManager
from src.services.report_generator import ReportGenerator
from src.services.card_fingerprint import CardFingerprintService
from src.ui.styles import COLORS


class ReportsPage(QWidget):
    """Reports page for generating and viewing reports."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.report_generator = ReportGenerator()
        self.fingerprint_service = CardFingerprintService()
        self.setup_ui()

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        title = QLabel("Reports")
        title.setObjectName("page-title")
        layout.addWidget(title)

        subtitle = QLabel("View offload history and generate reports")
        subtitle.setObjectName("page-subtitle")
        layout.addWidget(subtitle)

        # Main content
        content = QHBoxLayout()
        content.setSpacing(20)

        # Left - History
        left = self.create_history_panel()
        content.addWidget(left, 1)

        # Right - Report preview
        right = self.create_preview_panel()
        content.addWidget(right, 2)

        layout.addLayout(content, 1)

    def create_history_panel(self) -> QFrame:
        """Create the offload history panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        label = QLabel("Offload History")
        label.setObjectName("card-title")
        layout.addWidget(label)

        # Refresh button
        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh_history)
        refresh_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(refresh_btn)

        # History list
        self.history_list = QListWidget()
        self.history_list.itemClicked.connect(self.on_history_selected)
        layout.addWidget(self.history_list, 1)

        # Summary
        self.history_summary = QLabel("No offload records found")
        self.history_summary.setObjectName("label-small")
        layout.addWidget(self.history_summary)

        return panel

    def create_preview_panel(self) -> QFrame:
        """Create the report preview panel."""
        panel = QFrame()
        panel.setObjectName("card")

        layout = QVBoxLayout(panel)
        layout.setSpacing(15)

        # Header with actions
        header = QHBoxLayout()
        label = QLabel("Report Preview")
        label.setObjectName("card-title")
        header.addWidget(label)
        header.addStretch()

        # Export buttons
        export_txt_btn = QPushButton("Export TXT")
        export_txt_btn.clicked.connect(self.export_txt)
        export_txt_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(export_txt_btn)

        export_csv_btn = QPushButton("Export CSV")
        export_csv_btn.clicked.connect(self.export_csv)
        export_csv_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(export_csv_btn)

        layout.addLayout(header)

        # Preview area
        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        self.preview_text.setFont(QFont("Courier New", 10))
        self.preview_text.setStyleSheet(f"""
            QTextEdit {{
                background-color: {COLORS['charcoal-black']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 10px;
            }}
        """)
        self.preview_text.setPlaceholderText("Select an offload from the history to preview...")
        layout.addWidget(self.preview_text, 1)

        return panel

    def refresh_history(self):
        """Refresh the offload history."""
        self.history_list.clear()

        records = self.fingerprint_service.get_offload_history(limit=50)

        if not records:
            self.history_summary.setText("No offload records found")
            return

        for record in records:
            date_str = record.offload_timestamp.strftime("%Y-%m-%d %H:%M")
            size_str = self.format_size(record.total_size)
            text = f"{record.card_label} - {date_str}\n{record.total_files} files, {size_str}"

            item = QListWidgetItem(text)
            item.setData(Qt.ItemDataRole.UserRole, record)
            self.history_list.addItem(item)

        self.history_summary.setText(f"{len(records)} offload records")

    def on_history_selected(self, item: QListWidgetItem):
        """Handle history item selection."""
        record = item.data(Qt.ItemDataRole.UserRole)
        if not record:
            return

        # Generate preview
        lines = [
            "=" * 60,
            "OFFLOAD RECORD",
            "=" * 60,
            "",
            f"Card Label:      {record.card_label}",
            f"Fingerprint:     {record.fingerprint[:16]}...",
            f"Date:            {record.offload_timestamp.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Status:          {record.status}",
            "",
            "DESTINATIONS:",
            "-" * 40,
        ]

        for dest in record.destination_paths:
            lines.append(f"  • {dest}")

        lines.extend([
            "",
            "SUMMARY:",
            "-" * 40,
            f"Total Files:     {record.total_files}",
            f"Total Size:      {self.format_size(record.total_size)}",
            "",
            "=" * 60,
        ])

        self.preview_text.setText("\n".join(lines))

    def export_txt(self):
        """Export current report as TXT."""
        text = self.preview_text.toPlainText()
        if not text:
            QMessageBox.warning(self, "No Report", "No report to export. Select an offload first.")
            return

        path, _ = QFileDialog.getSaveFileName(
            self,
            "Save Report",
            f"offload_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt",
            "Text Files (*.txt)"
        )
        if path:
            with open(path, "w") as f:
                f.write(text)
            QMessageBox.information(self, "Exported", f"Report saved to:\n{path}")

    def export_csv(self):
        """Export offload history as CSV."""
        records = self.fingerprint_service.get_offload_history(limit=100)
        if not records:
            QMessageBox.warning(self, "No Data", "No offload history to export.")
            return

        path, _ = QFileDialog.getSaveFileName(
            self,
            "Save CSV",
            f"offload_history_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            "CSV Files (*.csv)"
        )
        if path:
            import csv
            with open(path, "w", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Card Label", "Date", "Status", "Files", "Size (bytes)", "Destinations"
                ])
                for rec in records:
                    writer.writerow([
                        rec.card_label,
                        rec.offload_timestamp.isoformat(),
                        rec.status,
                        rec.total_files,
                        rec.total_size,
                        "|".join(rec.destination_paths)
                    ])
            QMessageBox.information(self, "Exported", f"CSV saved to:\n{path}")

    def format_size(self, size_bytes: int) -> str:
        """Format bytes to human readable string."""
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size_bytes < 1024:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f} PB"

    def showEvent(self, event):
        """Refresh history when page is shown."""
        super().showEvent(event)
        self.refresh_history()
