"""
Configuration management using keyring for secure storage.
Falls back to file storage when keyring backend is unavailable.
"""
import json
from pathlib import Path
from typing import Optional, Any

# Try to import keyring, but don't fail if unavailable
try:
    import keyring
    from keyring.errors import NoKeyringError
    KEYRING_AVAILABLE = True
except ImportError:
    KEYRING_AVAILABLE = False
    NoKeyringError = Exception

SERVICE_NAME = "swn-dailies-helper"
CONFIG_DIR = Path.home() / ".swn-dailies-helper"


class ConfigManager:
    """Manage application configuration and secure storage."""

    def __init__(self):
        self.config_dir = CONFIG_DIR
        self.config_file = self.config_dir / "config.json"
        self._ensure_config_dir()
        self._config = self._load_config()
        self._keyring_works = self._check_keyring()

    def _ensure_config_dir(self):
        """Ensure the config directory exists."""
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def _check_keyring(self) -> bool:
        """Check if keyring backend is available and working."""
        if not KEYRING_AVAILABLE:
            return False
        try:
            # Try a test operation to see if keyring works
            keyring.get_password(SERVICE_NAME, "__test__")
            return True
        except (NoKeyringError, Exception) as e:
            if "NoKeyringError" in str(type(e).__name__) or "No recommended backend" in str(e):
                return False
            return True

    def _load_config(self) -> dict:
        """Load configuration from file."""
        if self.config_file.exists():
            try:
                return json.loads(self.config_file.read_text())
            except (json.JSONDecodeError, IOError):
                return {}
        return {}

    def _save_config(self):
        """Save configuration to file."""
        self.config_file.write_text(json.dumps(self._config, indent=2))

    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value."""
        return self._config.get(key, default)

    def set(self, key: str, value: Any):
        """Set a configuration value."""
        self._config[key] = value
        self._save_config()

    def get_api_key(self) -> Optional[str]:
        """Get the API key from secure storage (or file fallback)."""
        if self._keyring_works:
            try:
                return keyring.get_password(SERVICE_NAME, "api_key")
            except Exception:
                pass
        # Fall back to file storage
        return self.get("_api_key")

    def set_api_key(self, api_key: str):
        """Store the API key in secure storage (or file fallback)."""
        if self._keyring_works:
            try:
                keyring.set_password(SERVICE_NAME, "api_key", api_key)
                return
            except Exception:
                pass
        # Fall back to file storage
        self.set("_api_key", api_key)

    def clear_api_key(self):
        """Remove the API key from secure storage."""
        if self._keyring_works:
            try:
                keyring.delete_password(SERVICE_NAME, "api_key")
            except Exception:
                pass
        # Also clear from file storage
        if "_api_key" in self._config:
            del self._config["_api_key"]
            self._save_config()

    def get_api_url(self) -> Optional[str]:
        """Get the API URL (defaults to production if not set)."""
        return self.get("api_url")

    def set_api_url(self, api_url: str):
        """Set the API URL (for development/testing)."""
        self.set("api_url", api_url)

    def get_project_id(self) -> Optional[str]:
        """Get the current project ID."""
        return self.get("project_id")

    def set_project_id(self, project_id: str):
        """Set the current project ID."""
        self.set("project_id", project_id)

    def get_destination_drives(self) -> list[str]:
        """Get configured destination drives for offload."""
        return self.get("destination_drives", [])

    def set_destination_drives(self, drives: list[str]):
        """Set destination drives for offload."""
        self.set("destination_drives", drives)

    def get_proxy_settings(self) -> dict:
        """Get proxy generation settings."""
        return self.get("proxy_settings", {
            "resolution": "1920x1080",
            "codec": "h264",
            "bitrate": "10M",
            "enabled": True,
        })

    def set_proxy_settings(self, settings: dict):
        """Set proxy generation settings."""
        self.set("proxy_settings", settings)

    # Linked Drives Management
    def get_linked_drives(self) -> list[dict]:
        """Get list of linked drives for remote viewing.

        Returns list of dicts with 'name' and 'path' keys.
        """
        return self.get("linked_drives", [])

    def add_linked_drive(self, name: str, path: str) -> bool:
        """Link a new drive for remote viewing.

        Args:
            name: Display name for the drive (e.g., "RAID A")
            path: Absolute path to the drive (e.g., "/mnt/raid-a")

        Returns:
            True if added, False if name already exists
        """
        drives = self.get_linked_drives()

        # Check if name already exists
        if any(d["name"] == name for d in drives):
            return False

        drives.append({"name": name, "path": path})
        self.set("linked_drives", drives)
        return True

    def remove_linked_drive(self, name: str) -> bool:
        """Unlink a drive.

        Args:
            name: Name of the drive to unlink

        Returns:
            True if removed, False if not found
        """
        drives = self.get_linked_drives()
        original_count = len(drives)
        drives = [d for d in drives if d["name"] != name]

        if len(drives) < original_count:
            self.set("linked_drives", drives)
            return True
        return False

    def get_linked_drive_path(self, name: str) -> Optional[str]:
        """Get the path for a linked drive by name.

        Args:
            name: Name of the linked drive

        Returns:
            Path string or None if not found
        """
        drives = self.get_linked_drives()
        for drive in drives:
            if drive["name"] == name:
                return drive["path"]
        return None

    def update_linked_drive(self, name: str, new_name: Optional[str] = None, new_path: Optional[str] = None) -> bool:
        """Update a linked drive's name or path.

        Args:
            name: Current name of the drive
            new_name: New name (optional)
            new_path: New path (optional)

        Returns:
            True if updated, False if not found
        """
        drives = self.get_linked_drives()
        for drive in drives:
            if drive["name"] == name:
                if new_name:
                    drive["name"] = new_name
                if new_path:
                    drive["path"] = new_path
                self.set("linked_drives", drives)
                return True
        return False

    # Upload Settings
    def get_upload_settings(self) -> dict:
        """Get upload configuration settings."""
        return self.get("upload_settings", {
            "parallel_uploads": 3,
            "max_retries": 3,
            "retry_delay_base": 2.0,
            "verify_checksum": True,
            "register_clips": True,
            "auto_upload_watch_folder": False,
        })

    def set_upload_settings(self, settings: dict):
        """Set upload configuration settings."""
        self.set("upload_settings", settings)
