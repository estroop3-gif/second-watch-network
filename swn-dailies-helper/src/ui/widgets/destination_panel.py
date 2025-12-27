"""
Destination panel widget for managing offload destinations (drives).
"""
import subprocess
from pathlib import Path
from typing import Optional, List, Tuple

from PyQt6.QtCore import Qt, pyqtSignal
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QFrame,
    QPushButton, QComboBox, QFileDialog, QScrollArea, QToolTip
)

from src.models.offload_models import DestinationDrive, DestinationConfig
from src.services.card_reader import CardReader
from src.ui.styles import COLORS


def get_device_for_path(path: Path) -> Optional[str]:
    """
    Get the block device for a given path.

    Args:
        path: Mount point or file path

    Returns:
        Device path (e.g., /dev/sda) or None
    """
    try:
        # Use df to get the device
        result = subprocess.run(
            ["df", str(path)],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                # First column is device
                device = lines[1].split()[0]
                # Handle /dev/sda1 -> /dev/sda
                if device.startswith('/dev/'):
                    # Strip partition number for SMART
                    import re
                    base_device = re.sub(r'[0-9]+$', '', device)
                    # For NVMe, it's /dev/nvme0n1p1 -> /dev/nvme0n1
                    if 'nvme' in base_device:
                        base_device = re.sub(r'p[0-9]+$', '', device)
                    return base_device
    except Exception:
        pass
    return None


class DriveItemWidget(QFrame):
    """Widget for displaying a single destination drive."""

    remove_clicked = pyqtSignal(str)  # drive_id

    def __init__(self, drive: DestinationDrive, is_primary: bool = False, parent=None):
        super().__init__(parent)
        self.drive = drive
        self.is_primary = is_primary
        self._health_info = None
        self._setup_ui()
        self._check_smart_health()

    def _setup_ui(self):
        """Set up the item UI."""
        self.setObjectName("drive-item")
        border_color = COLORS['accent-yellow'] if self.is_primary else COLORS['border-gray']
        self.setStyleSheet(f"""
            #drive-item {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {border_color};
                border-radius: 6px;
                padding: 10px;
            }}
        """)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(10)

        # Drive info
        info_layout = QVBoxLayout()
        info_layout.setSpacing(2)

        # Name row with health indicator
        name_row = QHBoxLayout()
        name_row.setSpacing(6)

        # Name with primary badge
        name_text = self.drive.display_name
        if self.is_primary:
            name_text = f"★ {name_text} (Primary)"

        name_label = QLabel(name_text)
        name_label.setStyleSheet(f"""
            font-size: 13px;
            font-weight: {'bold' if self.is_primary else 'normal'};
            color: {COLORS['accent-yellow'] if self.is_primary else COLORS['bone-white']};
        """)
        name_row.addWidget(name_label)

        # SMART health indicator
        self.health_label = QLabel("")
        self.health_label.setFixedWidth(70)
        self.health_label.setStyleSheet(f"""
            font-size: 10px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 3px;
        """)
        name_row.addWidget(self.health_label)
        name_row.addStretch()

        info_layout.addLayout(name_row)

        # Path and free space
        path_text = str(self.drive.path)
        if len(path_text) > 40:
            path_text = "..." + path_text[-37:]

        free_space = self.drive.free_space_formatted
        self.detail_label = QLabel(f"{path_text}  •  {free_space} free")
        self.detail_label.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 11px;
        """)
        info_layout.addWidget(self.detail_label)

        layout.addLayout(info_layout, 1)

        # Remove button (not for primary)
        if not self.is_primary:
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
            remove_btn.clicked.connect(lambda: self.remove_clicked.emit(self.drive.id))
            layout.addWidget(remove_btn)

    def _check_smart_health(self):
        """Check SMART health for the drive."""
        try:
            from src.services.smart_service import get_smart_service, DriveHealth

            smart_service = get_smart_service()
            if not smart_service.is_available:
                self.health_label.hide()
                return

            # Get device for this path
            device = get_device_for_path(self.drive.path)
            if not device:
                self.health_label.hide()
                return

            # Get health info
            health_info = smart_service.get_drive_health(device)
            if not health_info:
                self.health_label.hide()
                return

            self._health_info = health_info

            # Update health indicator
            if health_info.health == DriveHealth.HEALTHY:
                self.health_label.setText("Healthy")
                self.health_label.setStyleSheet(f"""
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                    background-color: rgba(34, 197, 94, 0.2);
                    color: {COLORS['green']};
                """)
                if health_info.temperature:
                    self.health_label.setToolTip(
                        f"Model: {health_info.model}\n"
                        f"Temperature: {health_info.temperature}°C\n"
                        f"Power-on hours: {health_info.power_on_hours or 'N/A'}"
                    )
            elif health_info.health == DriveHealth.WARNING:
                self.health_label.setText("Warning")
                self.health_label.setStyleSheet(f"""
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                    background-color: rgba(249, 115, 22, 0.2);
                    color: {COLORS['orange']};
                """)
                warnings_text = "\n".join(health_info.warnings) if health_info.warnings else "Check drive health"
                self.health_label.setToolTip(
                    f"Model: {health_info.model}\n"
                    f"Warnings:\n{warnings_text}"
                )
            elif health_info.health == DriveHealth.FAILING:
                self.health_label.setText("FAILING")
                self.health_label.setStyleSheet(f"""
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                    background-color: rgba(239, 68, 68, 0.3);
                    color: {COLORS['red']};
                """)
                warnings_text = "\n".join(health_info.warnings) if health_info.warnings else "Drive failing"
                self.health_label.setToolTip(
                    f"CRITICAL: This drive is failing!\n"
                    f"Model: {health_info.model}\n"
                    f"Issues:\n{warnings_text}"
                )
            else:
                self.health_label.hide()

        except ImportError:
            self.health_label.hide()
        except Exception:
            self.health_label.hide()

    def get_health_status(self) -> Optional[str]:
        """Get the health status string for this drive."""
        if self._health_info:
            return self._health_info.health.value
        return None

    def update_space_warning(self, required_bytes: int):
        """Show warning if not enough space."""
        if self.drive.free_space < required_bytes:
            self.setStyleSheet(f"""
                #drive-item {{
                    background-color: {COLORS['charcoal-light']};
                    border: 2px solid {COLORS['red']};
                    border-radius: 6px;
                    padding: 10px;
                }}
            """)
        else:
            border_color = COLORS['accent-yellow'] if self.is_primary else COLORS['border-gray']
            self.setStyleSheet(f"""
                #drive-item {{
                    background-color: {COLORS['charcoal-light']};
                    border: 1px solid {border_color};
                    border-radius: 6px;
                    padding: 10px;
                }}
            """)


class DestinationPanelWidget(QWidget):
    """Widget for managing offload destination drives."""

    # Emitted when destinations change
    destinations_changed = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.config = DestinationConfig()
        self.card_reader = CardReader()
        self._required_bytes = 0
        self._setup_ui()

    def _setup_ui(self):
        """Set up the widget UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Primary Drive Section
        primary_label = QLabel("PRIMARY DRIVE")
        primary_label.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        layout.addWidget(primary_label)

        # Primary drive selector
        primary_row = QHBoxLayout()
        primary_row.setSpacing(8)

        self.primary_combo = QComboBox()
        self.primary_combo.setMinimumHeight(36)
        self.primary_combo.currentIndexChanged.connect(self._on_primary_changed)
        primary_row.addWidget(self.primary_combo, 1)

        browse_btn = QPushButton("Browse...")
        browse_btn.setMinimumHeight(40)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        browse_btn.clicked.connect(self._on_browse_primary)
        browse_btn.setStyleSheet(f"""
            QPushButton {{
                font-size: 13px;
                font-weight: bold;
                padding: 10px 16px;
            }}
        """)
        primary_row.addWidget(browse_btn)

        layout.addLayout(primary_row)

        # Primary drive info with health indicator
        primary_info_row = QHBoxLayout()
        primary_info_row.setSpacing(8)

        self.primary_info_label = QLabel("")
        self.primary_info_label.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 11px;
        """)
        primary_info_row.addWidget(self.primary_info_label)

        self.primary_health_label = QLabel("")
        self.primary_health_label.setStyleSheet(f"""
            font-size: 10px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 3px;
        """)
        self.primary_health_label.hide()
        primary_info_row.addWidget(self.primary_health_label)

        primary_info_row.addStretch()
        layout.addLayout(primary_info_row)

        # Backup Drives Section
        backup_header = QHBoxLayout()
        backup_header.setSpacing(8)

        backup_label = QLabel("BACKUP DRIVES")
        backup_label.setStyleSheet(f"""
            font-size: 11px;
            font-weight: bold;
            color: {COLORS['muted-gray']};
            letter-spacing: 1px;
        """)
        backup_header.addWidget(backup_label)

        backup_header.addStretch()

        add_backup_btn = QPushButton("+ Add Drive")
        add_backup_btn.setMinimumHeight(36)
        add_backup_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        add_backup_btn.clicked.connect(self._on_add_backup)
        add_backup_btn.setStyleSheet(f"""
            QPushButton {{
                font-size: 13px;
                font-weight: bold;
                padding: 8px 14px;
            }}
        """)
        backup_header.addWidget(add_backup_btn)

        layout.addLayout(backup_header)

        # Backup drives list
        self.backups_container = QWidget()
        self.backups_layout = QVBoxLayout(self.backups_container)
        self.backups_layout.setContentsMargins(0, 0, 0, 0)
        self.backups_layout.setSpacing(8)

        self.no_backups_label = QLabel("No backup drives added")
        self.no_backups_label.setStyleSheet(f"""
            color: {COLORS['muted-gray']};
            font-size: 12px;
            padding: 12px;
        """)
        self.no_backups_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.backups_layout.addWidget(self.no_backups_label)

        layout.addWidget(self.backups_container)

        # Space warning
        self.space_warning = QLabel("")
        self.space_warning.setStyleSheet(f"""
            color: {COLORS['red']};
            font-size: 12px;
            padding: 8px;
            background-color: rgba(239, 68, 68, 0.1);
            border-radius: 4px;
        """)
        self.space_warning.setWordWrap(True)
        self.space_warning.hide()
        layout.addWidget(self.space_warning)

        layout.addStretch()

        # Populate drives
        self._refresh_drives()

    def _refresh_drives(self):
        """Refresh the list of available drives."""
        self.primary_combo.clear()
        self.primary_combo.addItem("Select primary drive...", None)

        drives = self.card_reader.list_drives()

        # Sort: fixed/local drives first, then by name
        def sort_key(d):
            is_fixed = d.get("type") == "fixed"
            return (0 if is_fixed else 1, d.get("name", "").lower())

        drives.sort(key=sort_key)

        for drive in drives:
            name = drive.get("name", "Unknown")
            path = drive.get("path", "")
            free = drive.get("freeSpace")

            display = name
            if free:
                free_gb = free / (1024**3)
                display += f" ({free_gb:.1f} GB free)"

            self.primary_combo.addItem(display, path)

    def _on_primary_changed(self, index: int):
        """Handle primary drive selection change."""
        self.primary_combo.hidePopup()  # Workaround for Linux/WSL

        path_str = self.primary_combo.currentData()

        if not path_str:
            self.config.drives = [d for d in self.config.drives if not d.is_primary]
            self.primary_info_label.setText("")
            self.primary_health_label.hide()
            self._update_ui()
            return

        path = Path(path_str)

        # Remove existing primary
        self.config.drives = [d for d in self.config.drives if not d.is_primary]

        # Add new primary
        drive = DestinationDrive.create(path, is_primary=True)
        self.config.drives.insert(0, drive)

        self.primary_info_label.setText(f"{path}  •  {drive.free_space_formatted} free")

        # Check SMART health for primary drive
        self._update_primary_health(path)

        self._update_ui()
        self.destinations_changed.emit()

    def _update_primary_health(self, path: Path):
        """Update SMART health display for primary drive."""
        try:
            from src.services.smart_service import get_smart_service, DriveHealth

            smart_service = get_smart_service()
            if not smart_service.is_available:
                self.primary_health_label.hide()
                return

            device = get_device_for_path(path)
            if not device:
                self.primary_health_label.hide()
                return

            health_info = smart_service.get_drive_health(device)
            if not health_info:
                self.primary_health_label.hide()
                return

            if health_info.health == DriveHealth.HEALTHY:
                self.primary_health_label.setText("Healthy")
                self.primary_health_label.setStyleSheet(f"""
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                    background-color: rgba(34, 197, 94, 0.2);
                    color: {COLORS['green']};
                """)
                self.primary_health_label.setToolTip(
                    f"Model: {health_info.model}\n"
                    f"Temperature: {health_info.temperature or 'N/A'}°C\n"
                    f"Power-on hours: {health_info.power_on_hours or 'N/A'}"
                )
                self.primary_health_label.show()
            elif health_info.health == DriveHealth.WARNING:
                self.primary_health_label.setText("Warning")
                self.primary_health_label.setStyleSheet(f"""
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                    background-color: rgba(249, 115, 22, 0.2);
                    color: {COLORS['orange']};
                """)
                warnings_text = "\n".join(health_info.warnings) if health_info.warnings else "Check drive health"
                self.primary_health_label.setToolTip(f"Model: {health_info.model}\nWarnings:\n{warnings_text}")
                self.primary_health_label.show()
            elif health_info.health == DriveHealth.FAILING:
                self.primary_health_label.setText("FAILING")
                self.primary_health_label.setStyleSheet(f"""
                    font-size: 10px;
                    font-weight: bold;
                    padding: 2px 6px;
                    border-radius: 3px;
                    background-color: rgba(239, 68, 68, 0.3);
                    color: {COLORS['red']};
                """)
                warnings_text = "\n".join(health_info.warnings) if health_info.warnings else "Drive failing"
                self.primary_health_label.setToolTip(f"CRITICAL: This drive is failing!\nModel: {health_info.model}\nIssues:\n{warnings_text}")
                self.primary_health_label.show()
            else:
                self.primary_health_label.hide()

        except ImportError:
            self.primary_health_label.hide()
        except Exception:
            self.primary_health_label.hide()

    def _on_browse_primary(self):
        """Handle browse button for primary drive."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Primary Drive",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )

        if folder:
            path = Path(folder)

            # Check if already in combo
            found = False
            for i in range(self.primary_combo.count()):
                if self.primary_combo.itemData(i) == str(path):
                    self.primary_combo.setCurrentIndex(i)
                    found = True
                    break

            if not found:
                # Add to combo and select
                drive = DestinationDrive.create(path)
                display = f"{path.name} ({drive.free_space_formatted} free)"
                self.primary_combo.addItem(display, str(path))
                self.primary_combo.setCurrentIndex(self.primary_combo.count() - 1)

    def _on_add_backup(self):
        """Handle add backup drive button."""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Select Backup Drive",
            str(Path.home()),
            QFileDialog.Option.ShowDirsOnly
        )

        if folder:
            path = Path(folder)

            # Check if already added
            for drive in self.config.drives:
                if drive.path == path:
                    from PyQt6.QtWidgets import QMessageBox
                    QMessageBox.warning(
                        self,
                        "Drive Already Added",
                        f"This drive is already in your destination list:\n{path}"
                    )
                    return

            # Force it to be a backup (not primary)
            drive = DestinationDrive.create(path, is_primary=False)
            self.config.drives.append(drive)
            self._update_ui()
            self.destinations_changed.emit()

    def _on_remove_backup(self, drive_id: str):
        """Handle remove backup drive."""
        self.config.remove_drive(drive_id)
        self._update_ui()
        self.destinations_changed.emit()

    def _update_ui(self):
        """Update the UI based on current state."""
        # Clear backup drive widgets
        for i in reversed(range(self.backups_layout.count())):
            widget = self.backups_layout.itemAt(i).widget()
            if isinstance(widget, DriveItemWidget):
                widget.deleteLater()

        # Get backup drives
        backups = self.config.backup_drives

        # Show/hide empty state
        self.no_backups_label.setVisible(len(backups) == 0)

        # Add backup drive widgets
        for drive in backups:
            item_widget = DriveItemWidget(drive, is_primary=False)
            item_widget.remove_clicked.connect(self._on_remove_backup)
            item_widget.update_space_warning(self._required_bytes)
            self.backups_layout.addWidget(item_widget)

        # Update space warning
        self._update_space_warning()

    def _update_space_warning(self):
        """Update the space warning based on required bytes."""
        if self._required_bytes == 0:
            self.space_warning.hide()
            return

        # Check all drives have enough space
        insufficient = []
        for drive in self.config.drives:
            if drive.free_space < self._required_bytes:
                insufficient.append(drive.display_name)

        if insufficient:
            size_str = self._format_size(self._required_bytes)
            drives_str = ", ".join(insufficient)
            self.space_warning.setText(
                f"Not enough space! Need {size_str}, but these drives don't have enough: {drives_str}"
            )
            self.space_warning.show()
        else:
            self.space_warning.hide()

    def _format_size(self, size: int) -> str:
        """Format bytes as human-readable string."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} PB"

    def set_required_space(self, bytes_required: int):
        """Set the required space for validation."""
        self._required_bytes = bytes_required
        self._update_ui()

    def get_config(self) -> DestinationConfig:
        """Get the current destination configuration."""
        return self.config

    def get_drives(self) -> List[DestinationDrive]:
        """Get the list of destination drives."""
        return self.config.drives

    def get_primary_drive(self) -> Optional[DestinationDrive]:
        """Get the primary drive."""
        return self.config.primary_drive

    def has_primary(self) -> bool:
        """Check if a primary drive is selected."""
        return self.config.primary_drive is not None

    def has_enough_space(self, required_bytes: int) -> bool:
        """Check if all drives have enough space."""
        return self.config.has_capacity(required_bytes)
