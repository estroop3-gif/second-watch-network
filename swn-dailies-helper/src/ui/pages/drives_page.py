"""
Linked Drives page - Manage local drives shared with Backlot for remote viewing.
Includes SMART health monitoring for linked drives.
"""
import subprocess
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLabel,
    QPushButton,
    QFrame,
    QListWidget,
    QListWidgetItem,
    QLineEdit,
    QFileDialog,
    QMessageBox,
    QDialog,
    QDialogButtonBox,
)
from PyQt6.QtCore import Qt
from pathlib import Path
import shutil
from typing import Optional, Tuple

from src.services.config import ConfigManager
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


def get_smart_health(path: Path) -> Optional[Tuple[str, dict]]:
    """Get SMART health for a drive path. Returns (status, info) or None."""
    try:
        from src.services.smart_service import get_smart_service, DriveHealth

        smart_service = get_smart_service()
        if not smart_service.is_available:
            return None

        device = get_device_for_path(path)
        if not device:
            return None

        health_info = smart_service.get_drive_health(device)
        if health_info:
            return (health_info.health.value, {
                "model": health_info.model,
                "serial": health_info.serial,
                "temperature": health_info.temperature,
                "power_on_hours": health_info.power_on_hours,
                "warnings": health_info.warnings,
                "health": health_info.health,
            })
    except ImportError:
        pass
    except Exception:
        pass
    return None


class LinkDriveDialog(QDialog):
    """Dialog for linking a new drive."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Link Drive")
        self.setMinimumWidth(500)
        self.setup_ui()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(20)
        layout.setContentsMargins(30, 30, 30, 30)

        # Title
        title = QLabel("Link a Local Drive")
        title.setObjectName("page-title")
        layout.addWidget(title)

        subtitle = QLabel("Share a local drive with Backlot for remote viewing without uploading")
        subtitle.setObjectName("page-subtitle")
        layout.addWidget(subtitle)

        # Name input
        name_label = QLabel("Display Name")
        name_label.setObjectName("label-muted")
        layout.addWidget(name_label)

        self.name_input = QLineEdit()
        self.name_input.setPlaceholderText("e.g., RAID A, Dailies SSD, Project Drive")
        layout.addWidget(self.name_input)

        # Path input
        path_label = QLabel("Drive Path")
        path_label.setObjectName("label-muted")
        layout.addWidget(path_label)

        path_row = QHBoxLayout()
        self.path_input = QLineEdit()
        self.path_input.setPlaceholderText("/mnt/raid-a or /media/dailies")
        path_row.addWidget(self.path_input, 1)

        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self.browse_path)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        path_row.addWidget(browse_btn)

        layout.addLayout(path_row)

        # Info text
        info = QLabel(
            "The Backlot web UI will be able to browse and stream files from this location "
            "when the Desktop Helper is running."
        )
        info.setObjectName("label-small")
        info.setWordWrap(True)
        layout.addWidget(info)

        layout.addStretch()

        # Buttons
        button_box = QDialogButtonBox()
        cancel_btn = QPushButton("Cancel")
        cancel_btn.clicked.connect(self.reject)
        cancel_btn.setCursor(Qt.CursorShape.PointingHandCursor)

        link_btn = QPushButton("Link Drive")
        link_btn.setObjectName("primary-button")
        link_btn.clicked.connect(self.accept)
        link_btn.setCursor(Qt.CursorShape.PointingHandCursor)

        button_box.addButton(cancel_btn, QDialogButtonBox.ButtonRole.RejectRole)
        button_box.addButton(link_btn, QDialogButtonBox.ButtonRole.AcceptRole)
        layout.addWidget(button_box)

    def browse_path(self):
        """Open file dialog to select a directory."""
        path = QFileDialog.getExistingDirectory(
            self,
            "Select Drive or Directory",
            "",
            QFileDialog.Option.ShowDirsOnly,
        )
        if path:
            self.path_input.setText(path)
            # Auto-fill name if empty
            if not self.name_input.text():
                self.name_input.setText(Path(path).name or "Local Drive")

    def get_values(self) -> tuple[str, str]:
        """Get the name and path values."""
        return self.name_input.text().strip(), self.path_input.text().strip()


class DrivesPage(QWidget):
    """Page for managing linked drives."""

    def __init__(self, config: ConfigManager):
        super().__init__()
        self.config = config
        self.setup_ui()

    def setup_ui(self):
        """Initialize the UI."""
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 40, 40, 40)
        layout.setSpacing(20)

        # Header
        header = QHBoxLayout()

        title_container = QVBoxLayout()
        title = QLabel("Linked Drives")
        title.setObjectName("page-title")
        title_container.addWidget(title)

        subtitle = QLabel("Share local drives with Backlot for remote viewing")
        subtitle.setObjectName("page-subtitle")
        title_container.addWidget(subtitle)

        header.addLayout(title_container)
        header.addStretch()

        # Link new drive button
        link_btn = QPushButton("+ Link New Drive")
        link_btn.setObjectName("primary-button")
        link_btn.clicked.connect(self.show_link_dialog)
        link_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        header.addWidget(link_btn)

        layout.addLayout(header)

        # Main content
        content = QFrame()
        content.setObjectName("card")
        content_layout = QVBoxLayout(content)
        content_layout.setSpacing(15)

        # Header row
        header_row = QHBoxLayout()
        drives_label = QLabel("Linked Drives")
        drives_label.setObjectName("card-title")
        header_row.addWidget(drives_label)
        header_row.addStretch()

        self.status_label = QLabel("0 drives linked")
        self.status_label.setObjectName("label-muted")
        header_row.addWidget(self.status_label)

        content_layout.addLayout(header_row)

        # Drives list
        self.drives_list = QListWidget()
        self.drives_list.setMinimumHeight(300)
        content_layout.addWidget(self.drives_list, 1)

        # Empty state
        self.empty_state = QLabel(
            "No drives linked yet.\n\n"
            "Link a local drive to allow Backlot to browse and stream footage "
            "without uploading files to the cloud."
        )
        self.empty_state.setObjectName("label-muted")
        self.empty_state.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty_state.setWordWrap(True)
        content_layout.addWidget(self.empty_state)

        layout.addWidget(content, 1)

        # Info panel
        info_panel = self.create_info_panel()
        layout.addWidget(info_panel)

        # Load drives
        self.refresh_drives()

    def create_info_panel(self) -> QFrame:
        """Create the info panel."""
        panel = QFrame()
        panel.setObjectName("card")
        panel.setStyleSheet(f"""
            #card {{
                background-color: {COLORS['charcoal-light']};
                border: 1px solid {COLORS['border-gray']};
            }}
        """)

        layout = QVBoxLayout(panel)
        layout.setSpacing(10)

        title = QLabel("How It Works")
        title.setObjectName("card-title")
        layout.addWidget(title)

        steps = [
            "1. Link a local drive or directory containing your footage",
            "2. The Desktop Helper serves files via its local HTTP server (port 47284)",
            "3. When viewing Dailies in Backlot, use 'Browse Local' to access linked drives",
            "4. Video files are streamed directly from your local machine - no upload needed",
        ]

        for step in steps:
            step_label = QLabel(step)
            step_label.setObjectName("label-muted")
            step_label.setWordWrap(True)
            layout.addWidget(step_label)

        note = QLabel(
            "Note: Files are only accessible when the Desktop Helper is running "
            "and your computer is reachable."
        )
        note.setStyleSheet(f"color: {COLORS['orange']}; font-style: italic;")
        note.setWordWrap(True)
        layout.addWidget(note)

        return panel

    def refresh_drives(self):
        """Refresh the drives list."""
        self.drives_list.clear()
        drives = self.config.get_linked_drives()

        if not drives:
            self.empty_state.show()
            self.drives_list.hide()
            self.status_label.setText("0 drives linked")
            return

        self.empty_state.hide()
        self.drives_list.show()
        self.status_label.setText(f"{len(drives)} drive{'s' if len(drives) != 1 else ''} linked")

        for drive in drives:
            item = self.create_drive_item(drive)
            self.drives_list.addItem(item)
            widget = self.create_drive_widget(drive)
            item.setSizeHint(widget.sizeHint())
            self.drives_list.setItemWidget(item, widget)

    def create_drive_item(self, drive: dict) -> QListWidgetItem:
        """Create a list item for a drive."""
        item = QListWidgetItem()
        item.setData(Qt.ItemDataRole.UserRole, drive)
        return item

    def create_drive_widget(self, drive: dict) -> QWidget:
        """Create a widget for displaying a drive entry."""
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(15, 12, 15, 12)
        layout.setSpacing(15)

        # Status indicator
        status_dot = QFrame()
        status_dot.setFixedSize(10, 10)

        path = Path(drive["path"])
        is_available = path.exists() and path.is_dir()

        if is_available:
            status_dot.setStyleSheet(f"""
                background-color: {COLORS['green']};
                border-radius: 5px;
            """)
        else:
            status_dot.setStyleSheet(f"""
                background-color: {COLORS['red']};
                border-radius: 5px;
            """)
        layout.addWidget(status_dot)

        # Drive info
        info_layout = QVBoxLayout()
        info_layout.setSpacing(4)

        # Name row with health badge
        name_row = QHBoxLayout()
        name_row.setSpacing(8)

        name_label = QLabel(drive["name"])
        name_label.setStyleSheet(f"font-weight: bold; color: {COLORS['bone-white']};")
        name_row.addWidget(name_label)

        # SMART health badge
        if is_available:
            health_data = get_smart_health(path)
            if health_data:
                status, info = health_data
                health_badge = QLabel()

                try:
                    from src.services.smart_service import DriveHealth
                    health_status = info.get("health")

                    if health_status == DriveHealth.HEALTHY:
                        health_badge.setText("Healthy")
                        health_badge.setStyleSheet(f"""
                            font-size: 10px;
                            font-weight: bold;
                            padding: 2px 6px;
                            border-radius: 3px;
                            background-color: rgba(34, 197, 94, 0.2);
                            color: {COLORS['green']};
                        """)
                        temp = info.get("temperature")
                        hours = info.get("power_on_hours")
                        tooltip = f"Model: {info.get('model', 'N/A')}\n"
                        if temp:
                            tooltip += f"Temperature: {temp}°C\n"
                        if hours:
                            tooltip += f"Power-on hours: {hours:,}"
                        health_badge.setToolTip(tooltip)
                    elif health_status == DriveHealth.WARNING:
                        health_badge.setText("Warning")
                        health_badge.setStyleSheet(f"""
                            font-size: 10px;
                            font-weight: bold;
                            padding: 2px 6px;
                            border-radius: 3px;
                            background-color: rgba(249, 115, 22, 0.2);
                            color: {COLORS['orange']};
                        """)
                        warnings = info.get("warnings", [])
                        tooltip = f"Model: {info.get('model', 'N/A')}\nWarnings:\n"
                        tooltip += "\n".join(f"  • {w}" for w in warnings[:3])
                        health_badge.setToolTip(tooltip)
                    elif health_status == DriveHealth.FAILING:
                        health_badge.setText("FAILING")
                        health_badge.setStyleSheet(f"""
                            font-size: 10px;
                            font-weight: bold;
                            padding: 2px 6px;
                            border-radius: 3px;
                            background-color: rgba(239, 68, 68, 0.3);
                            color: {COLORS['red']};
                        """)
                        warnings = info.get("warnings", [])
                        tooltip = f"CRITICAL: Drive failing!\nModel: {info.get('model', 'N/A')}\nIssues:\n"
                        tooltip += "\n".join(f"  • {w}" for w in warnings[:3])
                        health_badge.setToolTip(tooltip)
                    else:
                        health_badge = None

                    if health_badge:
                        name_row.addWidget(health_badge)
                except ImportError:
                    pass

        name_row.addStretch()
        info_layout.addLayout(name_row)

        path_label = QLabel(drive["path"])
        path_label.setStyleSheet(f"font-size: 12px; color: {COLORS['muted-gray']};")
        info_layout.addWidget(path_label)

        # Size info and SMART details if available
        if is_available:
            try:
                usage = shutil.disk_usage(drive["path"])
                free_gb = usage.free / (1024 ** 3)
                total_gb = usage.total / (1024 ** 3)
                size_text = f"{free_gb:.1f} GB free of {total_gb:.1f} GB"
            except OSError:
                size_text = "Size info unavailable"

            # Add SMART info to size line
            health_data = get_smart_health(path)
            if health_data:
                _, info = health_data
                temp = info.get("temperature")
                hours = info.get("power_on_hours")
                if temp:
                    size_text += f"  •  {temp}°C"
                if hours:
                    size_text += f"  •  {hours:,} hrs"
        else:
            size_text = "Drive not available"

        size_label = QLabel(size_text)
        size_label.setStyleSheet(f"font-size: 11px; color: {COLORS['muted-gray-dark']};")
        info_layout.addWidget(size_label)

        layout.addLayout(info_layout, 1)

        # Unlink button
        unlink_btn = QPushButton("Unlink")
        unlink_btn.setObjectName("danger-button")
        unlink_btn.setFixedWidth(80)
        unlink_btn.clicked.connect(lambda: self.unlink_drive(drive["name"]))
        unlink_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        layout.addWidget(unlink_btn)

        return widget

    def show_link_dialog(self):
        """Show the dialog to link a new drive."""
        dialog = LinkDriveDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            name, path = dialog.get_values()

            if not name:
                QMessageBox.warning(
                    self,
                    "Missing Name",
                    "Please enter a display name for the drive."
                )
                return

            if not path:
                QMessageBox.warning(
                    self,
                    "Missing Path",
                    "Please select a drive path."
                )
                return

            # Validate path exists
            if not Path(path).exists():
                QMessageBox.warning(
                    self,
                    "Invalid Path",
                    f"The path '{path}' does not exist."
                )
                return

            if not Path(path).is_dir():
                QMessageBox.warning(
                    self,
                    "Invalid Path",
                    f"The path '{path}' is not a directory."
                )
                return

            # Add the drive
            if self.config.add_linked_drive(name, path):
                self.refresh_drives()
            else:
                QMessageBox.warning(
                    self,
                    "Duplicate Name",
                    f"A drive with the name '{name}' already exists."
                )

    def unlink_drive(self, name: str):
        """Unlink a drive after confirmation."""
        reply = QMessageBox.question(
            self,
            "Unlink Drive",
            f"Are you sure you want to unlink '{name}'?\n\n"
            "This will not delete any files, only remove the link from Backlot.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            if self.config.remove_linked_drive(name):
                self.refresh_drives()

    def showEvent(self, event):
        """Handle show event to refresh drives."""
        super().showEvent(event)
        self.refresh_drives()
