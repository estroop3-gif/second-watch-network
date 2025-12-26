"""
Session Manager - Track overnight upload sessions across multiple card offloads.

Assistant cameras offload multiple cards throughout the day. This service tracks
all offloads in a single "session" so they can be batch-processed overnight.
"""
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from threading import Lock
import json
import uuid

from PyQt6.QtCore import QObject, pyqtSignal


@dataclass
class SessionState:
    """State of an overnight upload session."""
    session_id: str
    started_at: str
    manifest_ids: List[str]  # Links to OffloadManifest.local_id
    project_id: Optional[str] = None
    production_day_id: Optional[str] = None
    status: str = "active"  # "active", "pending_upload", "uploading", "completed", "failed"
    lut_path: Optional[str] = None
    lut_enabled: bool = False
    upload_when_complete: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "session_id": self.session_id,
            "started_at": self.started_at,
            "manifest_ids": self.manifest_ids,
            "project_id": self.project_id,
            "production_day_id": self.production_day_id,
            "status": self.status,
            "lut_path": self.lut_path,
            "lut_enabled": self.lut_enabled,
            "upload_when_complete": self.upload_when_complete,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionState":
        """Create from dictionary."""
        return cls(**data)


class SessionManager(QObject):
    """
    Singleton service for managing overnight upload sessions.

    A session groups multiple card offloads (manifests) together so they can
    be batch-processed for proxy generation and upload.

    Usage:
        session_manager = SessionManager.get_instance()
        session_manager.start_session(project_id, production_day_id)

        # After each offload:
        session_manager.add_manifest(manifest)

        # On last card:
        session_manager.mark_upload_pending(upload_when_complete=True)
    """

    # Signals
    session_started = pyqtSignal(str)  # session_id
    session_updated = pyqtSignal(str)  # session_id
    session_completed = pyqtSignal(str, bool)  # session_id, success

    # Singleton instance
    _instance: Optional["SessionManager"] = None
    _lock = Lock()

    # Storage
    _config_dir = Path.home() / ".swn-dailies-helper"
    _session_file = _config_dir / "active_session.json"

    def __init__(self):
        """Initialize the session manager."""
        super().__init__()
        self._session: Optional[SessionState] = None
        self._manifest_service = None  # Lazy loaded to avoid circular imports

        # Ensure config directory exists
        self._config_dir.mkdir(parents=True, exist_ok=True)

        # Load any existing session
        self._load_session()

    @classmethod
    def get_instance(cls) -> "SessionManager":
        """Get the singleton instance."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def _get_manifest_service(self):
        """Lazy load manifest service to avoid circular imports."""
        if self._manifest_service is None:
            from src.services.offload_manifest import OffloadManifestService
            from src.services.config import ConfigManager
            config = ConfigManager()
            self._manifest_service = OffloadManifestService(config)
        return self._manifest_service

    def start_session(
        self,
        project_id: Optional[str] = None,
        production_day_id: Optional[str] = None,
        lut_path: Optional[str] = None,
        lut_enabled: bool = False,
    ) -> SessionState:
        """
        Start a new overnight upload session.

        Args:
            project_id: Backlot project ID to link uploads to
            production_day_id: Production day ID for organization
            lut_path: Path to .cube LUT file for proxy generation
            lut_enabled: Whether to apply LUT during proxy generation

        Returns:
            The new SessionState
        """
        # Don't allow starting a new session if one is active
        if self._session and self._session.status in ("active", "pending_upload", "uploading"):
            raise ValueError("Cannot start new session while one is active. Complete or cancel first.")

        self._session = SessionState(
            session_id=str(uuid.uuid4()),
            started_at=datetime.now().isoformat(),
            manifest_ids=[],
            project_id=project_id,
            production_day_id=production_day_id,
            status="active",
            lut_path=lut_path,
            lut_enabled=lut_enabled,
            upload_when_complete=False,
        )

        self._save_session()
        self.session_started.emit(self._session.session_id)
        return self._session

    def add_manifest(self, manifest_id: str) -> None:
        """
        Add an offload manifest to the current session.

        Args:
            manifest_id: The local_id of the OffloadManifest
        """
        if not self._session:
            raise ValueError("No active session. Call start_session() first.")

        if self._session.status != "active":
            raise ValueError(f"Cannot add to session with status '{self._session.status}'")

        if manifest_id not in self._session.manifest_ids:
            self._session.manifest_ids.append(manifest_id)
            self._save_session()
            self.session_updated.emit(self._session.session_id)

    def get_active_session(self) -> Optional[SessionState]:
        """Get the current active session, if any."""
        return self._session

    def has_active_session(self) -> bool:
        """Check if there's an active session."""
        return self._session is not None and self._session.status in ("active", "pending_upload", "uploading")

    def get_manifest_count(self) -> int:
        """Get the number of manifests in the current session."""
        if not self._session:
            return 0
        return len(self._session.manifest_ids)

    def mark_upload_pending(self, upload_when_complete: bool = True) -> None:
        """
        Mark the session as pending upload when current offload completes.

        Args:
            upload_when_complete: Whether to trigger upload when offload finishes
        """
        if not self._session:
            raise ValueError("No active session")

        self._session.upload_when_complete = upload_when_complete
        if upload_when_complete:
            self._session.status = "pending_upload"
        self._save_session()
        self.session_updated.emit(self._session.session_id)

    def set_lut_settings(self, lut_path: Optional[str], lut_enabled: bool) -> None:
        """Update LUT settings for the session."""
        if not self._session:
            raise ValueError("No active session")

        self._session.lut_path = lut_path
        self._session.lut_enabled = lut_enabled
        self._save_session()

    def start_upload(self) -> None:
        """Mark the session as currently uploading."""
        if not self._session:
            raise ValueError("No active session")

        self._session.status = "uploading"
        self._save_session()
        self.session_updated.emit(self._session.session_id)

    def get_all_session_files(self) -> List[Tuple[str, Path]]:
        """
        Get all media files from all manifests in the session.

        Returns:
            List of tuples: (manifest_id, file_path)
        """
        if not self._session:
            return []

        files = []
        manifest_service = self._get_manifest_service()

        for manifest_id in self._session.manifest_ids:
            try:
                manifest = manifest_service.load_manifest(manifest_id)
                if manifest and manifest.destination_paths:
                    # Use primary destination path
                    dest_path = Path(manifest.destination_paths[0])
                    for file_info in manifest.files:
                        file_path = dest_path / file_info.relative_path
                        if file_path.exists():
                            files.append((manifest_id, file_path))
            except Exception as e:
                print(f"Error loading manifest {manifest_id}: {e}")

        return files

    def complete_session(self, success: bool) -> None:
        """
        Mark the session as completed.

        Args:
            success: Whether the upload completed successfully
        """
        if not self._session:
            return

        session_id = self._session.session_id
        self._session.status = "completed" if success else "failed"
        self._save_session()

        # Clear the session after completion
        completed_session = self._session
        self._session = None
        self._clear_session_file()

        self.session_completed.emit(session_id, success)

    def cancel_session(self) -> None:
        """Cancel the current session without uploading."""
        if not self._session:
            return

        session_id = self._session.session_id
        self._session = None
        self._clear_session_file()
        self.session_completed.emit(session_id, False)

    def _save_session(self) -> None:
        """Save session state to disk."""
        if not self._session:
            return

        try:
            with open(self._session_file, "w") as f:
                json.dump(self._session.to_dict(), f, indent=2)
        except Exception as e:
            print(f"Error saving session: {e}")

    def _load_session(self) -> None:
        """Load session state from disk."""
        if not self._session_file.exists():
            return

        try:
            with open(self._session_file, "r") as f:
                data = json.load(f)
                self._session = SessionState.from_dict(data)
        except Exception as e:
            print(f"Error loading session: {e}")
            self._session = None

    def _clear_session_file(self) -> None:
        """Remove the session file from disk."""
        try:
            if self._session_file.exists():
                self._session_file.unlink()
        except Exception as e:
            print(f"Error clearing session file: {e}")
