"""
SMART monitoring service for drive health analysis.

Uses smartctl from smartmontools to read S.M.A.R.T. data
from storage devices and predict drive failures.

License: GPL-2.0
"""
import json
import re
import subprocess
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from src.services.binary_manager import BinaryManager


class DriveHealth(Enum):
    """Overall drive health status."""
    HEALTHY = "healthy"
    WARNING = "warning"
    FAILING = "failing"
    UNKNOWN = "unknown"


class DriveType(Enum):
    """Storage drive type."""
    HDD = "hdd"
    SSD = "ssd"
    NVME = "nvme"
    UNKNOWN = "unknown"


@dataclass
class SmartAttribute:
    """Individual S.M.A.R.T. attribute."""
    id: int
    name: str
    value: int
    worst: int
    threshold: int
    raw_value: str
    status: str = "ok"  # ok, warning, critical


@dataclass
class DriveInfo:
    """Complete drive information with SMART data."""
    device: str = ""
    model: str = ""
    serial: str = ""
    firmware: str = ""
    capacity: int = 0  # bytes
    capacity_str: str = ""
    drive_type: DriveType = DriveType.UNKNOWN
    smart_supported: bool = False
    smart_enabled: bool = False
    health: DriveHealth = DriveHealth.UNKNOWN
    health_passed: bool = True
    temperature: Optional[int] = None  # Celsius
    power_on_hours: Optional[int] = None
    power_cycle_count: Optional[int] = None
    reallocated_sectors: Optional[int] = None
    pending_sectors: Optional[int] = None
    uncorrectable_sectors: Optional[int] = None
    attributes: List[SmartAttribute] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    raw_data: Dict[str, Any] = field(default_factory=dict)


class SmartService:
    """Service for SMART drive health monitoring."""

    # Critical attributes that indicate drive failure
    CRITICAL_ATTRIBUTES = {
        5: "Reallocated_Sector_Ct",
        187: "Reported_Uncorrect",
        188: "Command_Timeout",
        196: "Reallocated_Event_Count",
        197: "Current_Pending_Sector",
        198: "Offline_Uncorrectable",
    }

    # Warning thresholds for specific attributes
    WARNING_THRESHOLDS = {
        5: 1,    # Any reallocated sectors is concerning
        187: 1,  # Any uncorrectable errors
        197: 1,  # Any pending sectors
        198: 1,  # Any offline uncorrectable
    }

    def __init__(self):
        self._binary_manager = BinaryManager()
        self._smartctl_path: Optional[Path] = None

    @property
    def is_available(self) -> bool:
        """Check if smartctl is available."""
        return self._binary_manager.is_available("smartctl")

    @property
    def smartctl_path(self) -> Optional[Path]:
        """Get the path to the smartctl binary."""
        if self._smartctl_path is None:
            self._smartctl_path = self._binary_manager.get_binary_path("smartctl")
        return self._smartctl_path

    def get_version(self) -> Optional[str]:
        """Get the smartctl version."""
        return self._binary_manager.get_version("smartctl")

    def list_drives(self) -> List[str]:
        """
        List all available drives that support SMART.

        Returns:
            List of device paths (e.g., ["/dev/sda", "/dev/nvme0"])
        """
        if not self.is_available:
            return []

        try:
            result = subprocess.run(
                [str(self.smartctl_path), "--scan", "-j"],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode != 0 and not result.stdout:
                # Try without JSON
                result = subprocess.run(
                    [str(self.smartctl_path), "--scan"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                # Parse non-JSON output
                drives = []
                for line in result.stdout.splitlines():
                    if line.strip():
                        # Format: /dev/sda -d sat # /dev/sda, ATA device
                        parts = line.split()
                        if parts:
                            drives.append(parts[0])
                return drives

            data = json.loads(result.stdout)
            devices = data.get("devices", [])
            return [d.get("name", "") for d in devices if d.get("name")]

        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            return []

    def get_drive_health(self, device: str) -> Optional[DriveInfo]:
        """
        Get complete SMART information for a drive.

        Args:
            device: Device path (e.g., "/dev/sda" or "C:" on Windows)

        Returns:
            DriveInfo with all SMART data, or None if failed
        """
        if not self.is_available:
            return None

        try:
            # Get all SMART data in JSON format
            result = subprocess.run(
                [str(self.smartctl_path), "-a", "-j", device],
                capture_output=True,
                text=True,
                timeout=60
            )

            # smartctl returns non-zero for warnings, so check if we got output
            if not result.stdout:
                return None

            data = json.loads(result.stdout)
            return self._parse_smart_json(device, data)

        except (subprocess.TimeoutExpired, json.JSONDecodeError, Exception):
            return None

    def get_all_drives(self) -> List[DriveInfo]:
        """
        Get SMART information for all detected drives.

        Returns:
            List of DriveInfo for each drive
        """
        drives = self.list_drives()
        results = []

        for device in drives:
            info = self.get_drive_health(device)
            if info:
                results.append(info)

        return results

    def is_failing(self, device: str) -> bool:
        """
        Quick check if a drive is failing.

        Args:
            device: Device path

        Returns:
            True if drive is failing or has critical warnings
        """
        info = self.get_drive_health(device)
        if info is None:
            return False

        return info.health in (DriveHealth.FAILING, DriveHealth.WARNING)

    def get_temperature(self, device: str) -> Optional[int]:
        """
        Get drive temperature in Celsius.

        Args:
            device: Device path

        Returns:
            Temperature in Celsius, or None
        """
        info = self.get_drive_health(device)
        if info:
            return info.temperature
        return None

    def _parse_smart_json(self, device: str, data: Dict[str, Any]) -> DriveInfo:
        """Parse smartctl JSON output into DriveInfo."""
        info = DriveInfo(device=device, raw_data=data)

        # Device info
        dev_info = data.get("device", {})
        info.model = data.get("model_name", "")
        info.serial = data.get("serial_number", "")
        info.firmware = data.get("firmware_version", "")

        # Capacity
        user_capacity = data.get("user_capacity", {})
        info.capacity = user_capacity.get("bytes", 0)
        info.capacity_str = user_capacity.get("string", "")

        # Determine drive type
        if "nvme" in device.lower() or data.get("device", {}).get("type") == "nvme":
            info.drive_type = DriveType.NVME
        elif data.get("rotation_rate", 0) == 0:
            info.drive_type = DriveType.SSD
        elif data.get("rotation_rate", 0) > 0:
            info.drive_type = DriveType.HDD

        # SMART support
        smart_status = data.get("smart_status", {})
        info.smart_supported = data.get("smart_support", {}).get("available", False)
        info.smart_enabled = data.get("smart_support", {}).get("enabled", False)
        info.health_passed = smart_status.get("passed", True)

        # Parse SMART attributes (ATA drives)
        ata_attrs = data.get("ata_smart_attributes", {}).get("table", [])
        for attr in ata_attrs:
            smart_attr = SmartAttribute(
                id=attr.get("id", 0),
                name=attr.get("name", ""),
                value=attr.get("value", 0),
                worst=attr.get("worst", 0),
                threshold=attr.get("thresh", 0),
                raw_value=str(attr.get("raw", {}).get("string", "")),
            )

            # Check if attribute is concerning
            if smart_attr.id in self.WARNING_THRESHOLDS:
                try:
                    raw_int = int(smart_attr.raw_value.split()[0])
                    if raw_int >= self.WARNING_THRESHOLDS[smart_attr.id]:
                        smart_attr.status = "warning"
                        info.warnings.append(f"{smart_attr.name}: {raw_int}")
                except (ValueError, IndexError):
                    pass

            # Check if value is below threshold
            if smart_attr.threshold > 0 and smart_attr.value <= smart_attr.threshold:
                smart_attr.status = "critical"

            info.attributes.append(smart_attr)

            # Extract key metrics
            if smart_attr.id == 194 or smart_attr.name == "Temperature_Celsius":
                try:
                    info.temperature = int(smart_attr.raw_value.split()[0])
                except (ValueError, IndexError):
                    pass
            elif smart_attr.id == 9 or smart_attr.name == "Power_On_Hours":
                try:
                    info.power_on_hours = int(smart_attr.raw_value.split()[0])
                except (ValueError, IndexError):
                    pass
            elif smart_attr.id == 12 or smart_attr.name == "Power_Cycle_Count":
                try:
                    info.power_cycle_count = int(smart_attr.raw_value.split()[0])
                except (ValueError, IndexError):
                    pass
            elif smart_attr.id == 5:
                try:
                    info.reallocated_sectors = int(smart_attr.raw_value.split()[0])
                except (ValueError, IndexError):
                    pass
            elif smart_attr.id == 197:
                try:
                    info.pending_sectors = int(smart_attr.raw_value.split()[0])
                except (ValueError, IndexError):
                    pass
            elif smart_attr.id == 198:
                try:
                    info.uncorrectable_sectors = int(smart_attr.raw_value.split()[0])
                except (ValueError, IndexError):
                    pass

        # NVMe specific parsing
        nvme_health = data.get("nvme_smart_health_information_log", {})
        if nvme_health:
            info.temperature = nvme_health.get("temperature")
            info.power_on_hours = nvme_health.get("power_on_hours")
            info.power_cycle_count = nvme_health.get("power_cycles")

            # Check NVMe health indicators
            critical_warning = nvme_health.get("critical_warning", 0)
            if critical_warning != 0:
                info.warnings.append(f"NVMe Critical Warning: {critical_warning}")

            percent_used = nvme_health.get("percentage_used", 0)
            if percent_used > 90:
                info.warnings.append(f"NVMe wear level high: {percent_used}%")
            elif percent_used > 80:
                info.warnings.append(f"NVMe wear level elevated: {percent_used}%")

        # Determine overall health
        if not info.health_passed:
            info.health = DriveHealth.FAILING
        elif any(a.status == "critical" for a in info.attributes):
            info.health = DriveHealth.FAILING
        elif info.warnings:
            info.health = DriveHealth.WARNING
        elif info.smart_supported and info.smart_enabled:
            info.health = DriveHealth.HEALTHY
        else:
            info.health = DriveHealth.UNKNOWN

        return info


# Singleton instance
_service: Optional[SmartService] = None


def get_smart_service() -> SmartService:
    """Get the singleton SMART service instance."""
    global _service
    if _service is None:
        _service = SmartService()
    return _service
