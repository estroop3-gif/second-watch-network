"""
Pre-flight confirmation dialog for offload operations.
Shows folder structure that will be created and warns about existing folders.
Includes SMART drive health checks.
"""
import subprocess
from pathlib import Path
from typing import Optional, List, Tuple

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QScrollArea, QWidget, QFrame
)

from src.models.offload_models import PreFlightCheck
from src.ui.styles import COLORS


def get_device_for_path(path: Path) -> Optional[str]:
    """Get the block device for a given path."""
    try:
        import re
        result = subprocess.run(
            ["df", str(path)],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                device = lines[1].split()[0]
                if device.startswith('/dev/'):
                    base_device = re.sub(r'[0-9]+$', '', device)
                    if 'nvme' in base_device:
                        base_device = re.sub(r'p[0-9]+$', '', device)
                    return base_device
    except Exception:
        pass
    return None


class PreFlightDialog(QDialog):
    """Dialog showing pre-flight verification before starting offload."""

    def __init__(self, preflight: PreFlightCheck, parent=None):
        super().__init__(parent)
        self.preflight = preflight
        self._drive_health = {}  # path -> (health_status, health_info)
        self._has_health_warning = False
        self._has_health_critical = False
        self.setWindowTitle("Confirm Offload")
        self.setMinimumSize(550, 500)
        self.setModal(True)
        self._check_drive_health()
        self._setup_ui()

    def _check_drive_health(self):
        """Check SMART health for all destination drives."""
        try:
            from src.services.smart_service import get_smart_service, DriveHealth

            smart_service = get_smart_service()
            if not smart_service.is_available:
                return

            for drive in self.preflight.drives:
                drive_path = Path(drive.drive_path)
                device = get_device_for_path(drive_path)
                if not device:
                    continue

                health_info = smart_service.get_drive_health(device)
                if health_info:
                    self._drive_health[str(drive_path)] = (health_info.health, health_info)
                    if health_info.health == DriveHealth.WARNING:
                        self._has_health_warning = True
                    elif health_info.health == DriveHealth.FAILING:
                        self._has_health_critical = True

        except ImportError:
            pass
        except Exception:
            pass

    def _setup_ui(self):
        """Set up the dialog UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        # Title
        title = QLabel("Confirm Offload")
        title.setStyleSheet(f"""
            font-size: 20px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        layout.addWidget(title)

        # Subtitle
        subtitle = QLabel("The following folders will be created:")
        subtitle.setStyleSheet(f"""
            font-size: 13px;
            color: {COLORS['muted-gray']};
        """)
        layout.addWidget(subtitle)

        # Scrollable folder tree
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        scroll.setStyleSheet(f"""
            QScrollArea {{
                background-color: {COLORS['charcoal-dark']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
        """)

        tree_container = QWidget()
        tree_layout = QVBoxLayout(tree_container)
        tree_layout.setContentsMargins(16, 16, 16, 16)
        tree_layout.setSpacing(16)

        # Build folder tree for each drive
        for drive in self.preflight.drives:
            drive_widget = self._create_drive_widget(drive)
            tree_layout.addWidget(drive_widget)

        tree_layout.addStretch()
        scroll.setWidget(tree_container)
        layout.addWidget(scroll, 1)

        # Warning section (if conflicts exist)
        if self.preflight.has_conflicts:
            warning_frame = QFrame()
            warning_frame.setStyleSheet(f"""
                QFrame {{
                    background-color: rgba(239, 68, 68, 0.15);
                    border: 1px solid {COLORS['red']};
                    border-radius: 6px;
                    padding: 12px;
                }}
            """)
            warning_layout = QVBoxLayout(warning_frame)
            warning_layout.setContentsMargins(12, 12, 12, 12)
            warning_layout.setSpacing(8)

            warning_title = QLabel("WARNING: Some folders already exist")
            warning_title.setStyleSheet(f"""
                font-size: 13px;
                font-weight: bold;
                color: {COLORS['red']};
            """)
            warning_layout.addWidget(warning_title)

            warnings = self.preflight.get_conflict_warnings()
            for warning in warnings[:5]:  # Limit to 5 warnings
                warning_label = QLabel(f"  {warning}")
                warning_label.setStyleSheet(f"""
                    font-size: 11px;
                    color: {COLORS['bone-white']};
                """)
                warning_label.setWordWrap(True)
                warning_layout.addWidget(warning_label)

            if len(warnings) > 5:
                more_label = QLabel(f"  ...and {len(warnings) - 5} more")
                more_label.setStyleSheet(f"""
                    font-size: 11px;
                    color: {COLORS['muted-gray']};
                    font-style: italic;
                """)
                warning_layout.addWidget(more_label)

            overwrite_note = QLabel("Files with matching names will be OVERWRITTEN.")
            overwrite_note.setStyleSheet(f"""
                font-size: 12px;
                color: {COLORS['red']};
                margin-top: 4px;
            """)
            warning_layout.addWidget(overwrite_note)

            layout.addWidget(warning_frame)

        # Drive health section (if any health issues)
        if self._has_health_warning or self._has_health_critical or self._drive_health:
            health_frame = QFrame()

            if self._has_health_critical:
                health_frame.setStyleSheet(f"""
                    QFrame {{
                        background-color: rgba(239, 68, 68, 0.15);
                        border: 1px solid {COLORS['red']};
                        border-radius: 6px;
                        padding: 12px;
                    }}
                """)
            elif self._has_health_warning:
                health_frame.setStyleSheet(f"""
                    QFrame {{
                        background-color: rgba(249, 115, 22, 0.15);
                        border: 1px solid {COLORS['orange']};
                        border-radius: 6px;
                        padding: 12px;
                    }}
                """)
            else:
                health_frame.setStyleSheet(f"""
                    QFrame {{
                        background-color: rgba(34, 197, 94, 0.1);
                        border: 1px solid {COLORS['green']};
                        border-radius: 6px;
                        padding: 12px;
                    }}
                """)

            health_layout = QVBoxLayout(health_frame)
            health_layout.setContentsMargins(12, 12, 12, 12)
            health_layout.setSpacing(8)

            # Title based on status
            if self._has_health_critical:
                health_title = QLabel("DRIVE HEALTH: CRITICAL")
                health_title.setStyleSheet(f"""
                    font-size: 13px;
                    font-weight: bold;
                    color: {COLORS['red']};
                """)
            elif self._has_health_warning:
                health_title = QLabel("DRIVE HEALTH: WARNING")
                health_title.setStyleSheet(f"""
                    font-size: 13px;
                    font-weight: bold;
                    color: {COLORS['orange']};
                """)
            else:
                health_title = QLabel("DRIVE HEALTH")
                health_title.setStyleSheet(f"""
                    font-size: 13px;
                    font-weight: bold;
                    color: {COLORS['green']};
                """)
            health_layout.addWidget(health_title)

            # Show each drive's health
            try:
                from src.services.smart_service import DriveHealth

                for drive in self.preflight.drives:
                    drive_path = str(drive.drive_path)
                    health_data = self._drive_health.get(drive_path)

                    drive_row = QHBoxLayout()
                    drive_row.setSpacing(8)

                    drive_name = QLabel(f"  {Path(drive_path).name}:")
                    drive_name.setStyleSheet(f"""
                        font-size: 12px;
                        color: {COLORS['bone-white']};
                    """)
                    drive_row.addWidget(drive_name)

                    if health_data:
                        health_status, health_info = health_data
                        if health_status == DriveHealth.HEALTHY:
                            status_text = f"Healthy"
                            if health_info.temperature:
                                status_text += f" ({health_info.temperature}°C)"
                            status_label = QLabel(status_text)
                            status_label.setStyleSheet(f"font-size: 12px; color: {COLORS['green']};")
                        elif health_status == DriveHealth.WARNING:
                            warnings = ", ".join(health_info.warnings[:2]) if health_info.warnings else "Check drive"
                            status_label = QLabel(f"Warning - {warnings}")
                            status_label.setStyleSheet(f"font-size: 12px; color: {COLORS['orange']};")
                        elif health_status == DriveHealth.FAILING:
                            status_label = QLabel("FAILING - Do not use!")
                            status_label.setStyleSheet(f"font-size: 12px; color: {COLORS['red']}; font-weight: bold;")
                        else:
                            status_label = QLabel("Unknown")
                            status_label.setStyleSheet(f"font-size: 12px; color: {COLORS['muted-gray']};")
                    else:
                        status_label = QLabel("SMART unavailable")
                        status_label.setStyleSheet(f"font-size: 12px; color: {COLORS['muted-gray']};")

                    drive_row.addWidget(status_label)
                    drive_row.addStretch()
                    health_layout.addLayout(drive_row)

            except ImportError:
                pass

            # Warning message for critical drives
            if self._has_health_critical:
                critical_warning = QLabel(
                    "One or more drives show signs of failure. "
                    "Offloading to a failing drive may result in data loss!"
                )
                critical_warning.setStyleSheet(f"""
                    font-size: 12px;
                    color: {COLORS['red']};
                    margin-top: 8px;
                """)
                critical_warning.setWordWrap(True)
                health_layout.addWidget(critical_warning)

            layout.addWidget(health_frame)

        # Summary section
        summary_frame = QFrame()
        summary_frame.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
            }}
        """)
        summary_layout = QHBoxLayout(summary_frame)
        summary_layout.setContentsMargins(16, 12, 16, 12)

        # Total info
        total_label = QLabel(
            f"Total: {self.preflight.total_files} files, {self.preflight.total_size_formatted}"
        )
        total_label.setStyleSheet(f"""
            font-size: 13px;
            color: {COLORS['bone-white']};
        """)
        summary_layout.addWidget(total_label)

        summary_layout.addStretch()

        # Estimated time
        time_label = QLabel(f"Estimated time: {self.preflight.estimated_time_formatted}")
        time_label.setStyleSheet(f"""
            font-size: 13px;
            color: {COLORS['muted-gray']};
        """)
        summary_layout.addWidget(time_label)

        layout.addWidget(summary_frame)

        # Buttons
        buttons_layout = QHBoxLayout()
        buttons_layout.setSpacing(12)
        buttons_layout.addStretch()

        cancel_btn = QPushButton("Cancel")
        cancel_btn.setMinimumHeight(40)
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        cancel_btn.clicked.connect(self.reject)
        buttons_layout.addWidget(cancel_btn)

        start_btn = QPushButton("Start Offload")
        start_btn.setMinimumHeight(40)
        start_btn.setObjectName("primary-button")
        start_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        start_btn.clicked.connect(self.accept)
        start_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['accent-yellow']};
                color: {COLORS['charcoal-black']};
                border: none;
                border-radius: 6px;
                padding: 10px 24px;
                font-size: 14px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background-color: {COLORS['accent-yellow-hover']};
            }}
        """)
        buttons_layout.addWidget(start_btn)

        layout.addLayout(buttons_layout)

        # Dialog styling
        self.setStyleSheet(f"""
            QDialog {{
                background-color: {COLORS['charcoal-black']};
            }}
            QPushButton {{
                background-color: {COLORS['charcoal-light']};
                color: {COLORS['bone-white']};
                border: 1px solid {COLORS['border-gray']};
                border-radius: 6px;
                padding: 10px 20px;
                font-size: 13px;
            }}
            QPushButton:hover {{
                border-color: {COLORS['muted-gray']};
            }}
        """)

    def _create_drive_widget(self, drive) -> QWidget:
        """Create a widget showing the folder tree for a drive."""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        # Drive header
        drive_label = QLabel(f"{str(drive.drive_path)}/")
        drive_label.setStyleSheet(f"""
            font-size: 13px;
            font-weight: bold;
            color: {COLORS['bone-white']};
        """)
        layout.addWidget(drive_label)

        # Parent folder
        parent_label = QLabel(f"   {drive.parent_folder}/")
        parent_label.setStyleSheet(f"""
            font-size: 12px;
            color: {COLORS['accent-yellow']};
        """)
        layout.addWidget(parent_label)

        # Subfolders
        for i, folder in enumerate(drive.folders):
            is_last = (i == len(drive.folders) - 1)
            prefix = "      " + ("" if is_last else "")

            # Folder info with size
            info_text = f"{prefix}{folder.source_label}/  ({folder.file_count} files, {folder.size_formatted})"

            folder_label = QLabel(info_text)

            # Highlight if folder already exists
            if folder.already_exists:
                color = COLORS['red']
                if folder.existing_file_count > 0:
                    info_text += f" - EXISTS ({folder.existing_file_count} files)"
                else:
                    info_text += " - EXISTS"
                folder_label.setText(info_text)
            else:
                color = COLORS['muted-gray']

            folder_label.setStyleSheet(f"""
                font-size: 12px;
                color: {color};
            """)
            layout.addWidget(folder_label)

        return widget
