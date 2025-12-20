"""
Configuration management using keyring for secure storage.
"""
import json
from pathlib import Path
from typing import Optional, Any
import keyring

SERVICE_NAME = "swn-dailies-helper"
CONFIG_DIR = Path.home() / ".swn-dailies-helper"


class ConfigManager:
    """Manage application configuration and secure storage."""

    def __init__(self):
        self.config_dir = CONFIG_DIR
        self.config_file = self.config_dir / "config.json"
        self._ensure_config_dir()
        self._config = self._load_config()

    def _ensure_config_dir(self):
        """Ensure the config directory exists."""
        self.config_dir.mkdir(parents=True, exist_ok=True)

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
        """Get the API key from secure storage."""
        try:
            return keyring.get_password(SERVICE_NAME, "api_key")
        except Exception:
            return None

    def set_api_key(self, api_key: str):
        """Store the API key in secure storage."""
        keyring.set_password(SERVICE_NAME, "api_key", api_key)

    def clear_api_key(self):
        """Remove the API key from secure storage."""
        try:
            keyring.delete_password(SERVICE_NAME, "api_key")
        except Exception:
            pass

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
