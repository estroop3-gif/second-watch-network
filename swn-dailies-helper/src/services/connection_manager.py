"""
Connection manager for handling API key verification and connection state.
"""
from collections import deque
from datetime import datetime
from typing import Optional
import httpx

from PyQt6.QtCore import QObject, QTimer, QThread, pyqtSignal

from src.services.config import ConfigManager


class VerifyWorker(QThread):
    """Background worker for API key verification."""
    finished = pyqtSignal(bool, dict, str)  # success, details, error_message

    def __init__(self, api_url: str, api_key: str):
        super().__init__()
        self.api_url = api_url
        self.api_key = api_key

    def run(self):
        try:
            print(f"[DEBUG] Verifying API key at {self.api_url}", flush=True)
            response = httpx.post(
                f"{self.api_url}/api/v1/backlot/desktop-keys/verify",
                headers={"X-API-Key": self.api_key},
                timeout=10.0
            )
            print(f"[DEBUG] Response status: {response.status_code}", flush=True)

            if response.status_code == 200:
                data = response.json()
                print(f"[DEBUG] Response data valid: {data.get('valid')}", flush=True)
                if data.get("valid"):
                    details = {
                        "user": data.get("user", {}),
                        "projects": data.get("projects", [])
                    }
                    self.finished.emit(True, details, "")
                    return
                else:
                    self.finished.emit(False, {}, "Invalid API key")
            elif response.status_code == 401:
                self.finished.emit(False, {}, "API key rejected (unauthorized)")
            else:
                self.finished.emit(False, {}, f"Server error: {response.status_code}")

        except httpx.TimeoutException:
            print("[DEBUG] Timeout", flush=True)
            self.finished.emit(False, {}, "Connection timeout")
        except httpx.ConnectError:
            print("[DEBUG] Connect error", flush=True)
            self.finished.emit(False, {}, "Cannot reach server")
        except Exception as e:
            print(f"[DEBUG] Exception: {e}", flush=True)
            self.finished.emit(False, {}, f"Error: {str(e)}")


class ConnectionManager(QObject):
    """Manages connection state and periodic API key verification."""

    # Signals
    status_changed = pyqtSignal(str, dict)  # status, details
    activity_logged = pyqtSignal(str, str)  # timestamp, message

    # Connection states
    STATE_DISCONNECTED = "disconnected"
    STATE_CHECKING = "checking"
    STATE_CONNECTED = "connected"
    STATE_ERROR = "error"

    # Default API URL
    DEFAULT_API_URL = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"

    def __init__(self, config: ConfigManager, parent=None):
        super().__init__(parent)
        self.config = config
        self._state = self.STATE_DISCONNECTED
        self._details = {}
        self._activity_log = deque(maxlen=50)
        self._consecutive_failures = 0
        self._verify_worker: Optional[VerifyWorker] = None

        # Timer for periodic checks
        self._check_timer = QTimer(self)
        self._check_timer.timeout.connect(self.verify_connection)

        # Log startup
        self._log("Application started")

    @property
    def state(self) -> str:
        """Current connection state."""
        return self._state

    @property
    def details(self) -> dict:
        """Current connection details (user, projects)."""
        return self._details

    @property
    def activity_log(self) -> list:
        """Activity log entries (newest first)."""
        return list(self._activity_log)

    def _log(self, message: str):
        """Add entry to activity log and emit signal."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self._activity_log.appendleft((timestamp, message))
        self.activity_logged.emit(timestamp, message)

    def _set_state(self, state: str, details: Optional[dict] = None):
        """Update state and emit signal."""
        self._state = state
        if details is not None:
            self._details = details
        self.status_changed.emit(self._state, self._details)

    def _get_api_url(self) -> str:
        """Get the API URL from config or use default."""
        url = self.config.get_api_url()
        return url if url else self.DEFAULT_API_URL

    def start(self):
        """Start the connection manager - verify immediately and start periodic checks."""
        self._log("Starting connection manager")
        self.verify_connection()
        self._check_timer.start(60000)  # Check every 60 seconds

    def stop(self):
        """Stop periodic checks."""
        self._check_timer.stop()
        self._log("Connection manager stopped")

    def verify_connection(self):
        """Verify the API key with the server (async, non-blocking)."""
        print("[DEBUG] verify_connection called", flush=True)
        api_key = self.config.get_api_key()
        print(f"[DEBUG] API key present: {bool(api_key)}", flush=True)

        if not api_key:
            self._set_state(self.STATE_DISCONNECTED, {})
            self._log("No API key configured")
            self._consecutive_failures = 0
            return

        # Don't start another verification if one is running
        if self._verify_worker and self._verify_worker.isRunning():
            return

        self._set_state(self.STATE_CHECKING)
        self._log("Verifying connection...")

        # Run verification in background thread
        api_url = self._get_api_url()
        self._verify_worker = VerifyWorker(api_url, api_key)
        self._verify_worker.finished.connect(self._on_verify_finished)
        self._verify_worker.start()

    def _on_verify_finished(self, success: bool, details: dict, error_message: str):
        """Handle verification result from background thread."""
        print(f"[DEBUG] _on_verify_finished called: success={success}, error={error_message}", flush=True)
        if success:
            self._consecutive_failures = 0
            # Store in config for other components
            user = details.get("user", {})
            self.config.set("user_id", user.get("id"))
            self.config.set("user_email", user.get("email"))
            self.config.set("user_display_name", user.get("display_name"))
            self.config.set("projects", details.get("projects", []))

            self._set_state(self.STATE_CONNECTED, details)
            self._log("Connection verified")
        else:
            self._handle_failure(error_message)

    def _handle_failure(self, message: str):
        """Handle a connection failure."""
        self._consecutive_failures += 1
        self._log(f"Connection failed: {message}")
        self._set_state(self.STATE_ERROR, self._details)

        # After 3 consecutive failures, slow down checks
        if self._consecutive_failures >= 3:
            self._check_timer.setInterval(120000)  # 2 minutes
            self._log("Multiple failures - slowing check interval")
        else:
            self._check_timer.setInterval(60000)  # 1 minute

    def reconnect(self):
        """Force a reconnection attempt."""
        self._log("Manual reconnect requested")
        self._consecutive_failures = 0
        self._check_timer.setInterval(60000)  # Reset to normal interval
        self.verify_connection()

    def disconnect(self):
        """Disconnect and clear credentials."""
        self._log("Disconnecting...")
        self.config.clear_api_key()
        self.config.set("user_id", None)
        self.config.set("user_email", None)
        self.config.set("user_display_name", None)
        self.config.set("projects", None)
        self._set_state(self.STATE_DISCONNECTED, {})
        self._consecutive_failures = 0
        self._log("Disconnected")

    def set_api_key(self, api_key: str):
        """Set a new API key and verify it."""
        self._log("New API key entered")
        self.config.set_api_key(api_key)
        self._consecutive_failures = 0
        self._check_timer.setInterval(60000)  # Reset to normal interval
        self.verify_connection()
