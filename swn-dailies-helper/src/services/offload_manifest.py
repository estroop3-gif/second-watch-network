"""
Offload Manifest Service - Tracks offload operations and syncs with Backlot API.
"""
import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from enum import Enum

from .config import ConfigManager


class OffloadStatus(str, Enum):
    """Status of an offload operation."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class UploadStatus(str, Enum):
    """Status of upload to cloud."""
    PENDING = "pending"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"


@dataclass
class OffloadedFile:
    """Individual file in an offload manifest."""
    file_name: str
    relative_path: Optional[str] = None
    file_size_bytes: int = 0
    content_type: Optional[str] = None
    offload_status: str = "pending"
    upload_status: str = "pending"
    source_checksum: Optional[str] = None
    dest_checksum: Optional[str] = None
    checksum_verified: bool = False
    dailies_clip_id: Optional[str] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "file_name": self.file_name,
            "relative_path": self.relative_path,
            "file_size_bytes": self.file_size_bytes,
            "content_type": self.content_type,
            "offload_status": self.offload_status,
            "upload_status": self.upload_status,
            "source_checksum": self.source_checksum,
            "dest_checksum": self.dest_checksum,
            "checksum_verified": self.checksum_verified,
            "dailies_clip_id": self.dailies_clip_id,
            "error_message": self.error_message,
        }


@dataclass
class OffloadManifest:
    """Manifest tracking an offload operation."""
    local_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    server_id: Optional[str] = None  # ID from backend API
    project_id: Optional[str] = None
    production_day_id: Optional[str] = None
    dailies_day_id: Optional[str] = None
    manifest_name: str = ""
    source_device: Optional[str] = None
    camera_label: Optional[str] = None
    roll_name: Optional[str] = None
    total_files: int = 0
    total_bytes: int = 0
    offload_status: str = OffloadStatus.PENDING.value
    upload_status: str = UploadStatus.PENDING.value
    create_footage_asset: bool = False
    created_footage_asset_id: Optional[str] = None
    files: List[OffloadedFile] = field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    # Local-only fields
    source_path: Optional[str] = None
    destination_paths: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "local_id": self.local_id,
            "server_id": self.server_id,
            "project_id": self.project_id,
            "production_day_id": self.production_day_id,
            "dailies_day_id": self.dailies_day_id,
            "manifest_name": self.manifest_name,
            "source_device": self.source_device,
            "camera_label": self.camera_label,
            "roll_name": self.roll_name,
            "total_files": self.total_files,
            "total_bytes": self.total_bytes,
            "offload_status": self.offload_status,
            "upload_status": self.upload_status,
            "create_footage_asset": self.create_footage_asset,
            "created_footage_asset_id": self.created_footage_asset_id,
            "files": [f.to_dict() for f in self.files],
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "created_at": self.created_at,
            "source_path": self.source_path,
            "destination_paths": self.destination_paths,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OffloadManifest":
        """Create from dictionary."""
        files_data = data.pop("files", [])
        files = [OffloadedFile(**f) for f in files_data]
        return cls(**data, files=files)

    def update_file_status(
        self,
        file_name: str,
        offload_status: Optional[str] = None,
        upload_status: Optional[str] = None,
        source_checksum: Optional[str] = None,
        dest_checksum: Optional[str] = None,
        error_message: Optional[str] = None,
    ):
        """Update status of a specific file in the manifest."""
        for f in self.files:
            if f.file_name == file_name:
                if offload_status:
                    f.offload_status = offload_status
                if upload_status:
                    f.upload_status = upload_status
                if source_checksum:
                    f.source_checksum = source_checksum
                if dest_checksum:
                    f.dest_checksum = dest_checksum
                    f.checksum_verified = source_checksum == dest_checksum
                if error_message:
                    f.error_message = error_message
                break

    def get_progress(self) -> Dict[str, Any]:
        """Get current progress of the offload operation."""
        completed = sum(1 for f in self.files if f.offload_status == "completed")
        failed = sum(1 for f in self.files if f.offload_status == "failed")
        verified = sum(1 for f in self.files if f.checksum_verified)
        uploaded = sum(1 for f in self.files if f.upload_status == "completed")

        return {
            "total_files": self.total_files,
            "completed_files": completed,
            "failed_files": failed,
            "verified_files": verified,
            "uploaded_files": uploaded,
            "offload_percent": (completed / self.total_files * 100) if self.total_files > 0 else 0,
        }


class OffloadManifestService:
    """Service for managing offload manifests."""

    def __init__(self, config: ConfigManager):
        self.config = config
        self.manifests_dir = Path.home() / ".swn-dailies-helper" / "manifests"
        self.manifests_dir.mkdir(parents=True, exist_ok=True)
        self._active_manifest: Optional[OffloadManifest] = None

    @property
    def active_manifest(self) -> Optional[OffloadManifest]:
        """Get the currently active manifest."""
        return self._active_manifest

    def create_manifest(
        self,
        project_id: Optional[str],
        production_day_id: Optional[str],
        source_device: str,
        camera_label: str,
        roll_name: str,
        files: List[Dict[str, Any]],
        destination_paths: List[str],
        create_footage_asset: bool = False,
    ) -> OffloadManifest:
        """Create a new offload manifest."""
        manifest_name = f"{camera_label}{roll_name}" if roll_name else f"{camera_label}_offload"

        manifest = OffloadManifest(
            project_id=project_id,
            production_day_id=production_day_id,
            manifest_name=manifest_name,
            source_device=source_device,
            camera_label=camera_label,
            roll_name=roll_name,
            total_files=len(files),
            total_bytes=sum(f.get("size", 0) for f in files),
            create_footage_asset=create_footage_asset,
            destination_paths=destination_paths,
            files=[
                OffloadedFile(
                    file_name=f.get("name", ""),
                    relative_path=f.get("relative_path"),
                    file_size_bytes=f.get("size", 0),
                    content_type=f.get("content_type"),
                )
                for f in files
            ],
        )

        self._active_manifest = manifest
        self._save_manifest(manifest)

        return manifest

    def start_offload(self, manifest: Optional[OffloadManifest] = None) -> OffloadManifest:
        """Mark an offload as started."""
        manifest = manifest or self._active_manifest
        if not manifest:
            raise ValueError("No manifest to start")

        manifest.offload_status = OffloadStatus.IN_PROGRESS.value
        manifest.started_at = datetime.now().isoformat()

        self._save_manifest(manifest)
        return manifest

    def complete_offload(
        self,
        manifest: Optional[OffloadManifest] = None,
        success: bool = True,
    ) -> OffloadManifest:
        """Mark an offload as completed or failed."""
        manifest = manifest or self._active_manifest
        if not manifest:
            raise ValueError("No manifest to complete")

        manifest.offload_status = OffloadStatus.COMPLETED.value if success else OffloadStatus.FAILED.value
        manifest.completed_at = datetime.now().isoformat()

        self._save_manifest(manifest)
        return manifest

    def update_file(
        self,
        file_name: str,
        manifest: Optional[OffloadManifest] = None,
        **kwargs,
    ) -> OffloadManifest:
        """Update a file's status in the manifest."""
        manifest = manifest or self._active_manifest
        if not manifest:
            raise ValueError("No manifest to update")

        manifest.update_file_status(file_name, **kwargs)
        self._save_manifest(manifest)
        return manifest

    def _save_manifest(self, manifest: OffloadManifest):
        """Save manifest to local file."""
        file_path = self.manifests_dir / f"{manifest.local_id}.json"
        with open(file_path, "w") as f:
            json.dump(manifest.to_dict(), f, indent=2)

    def load_manifest(self, local_id: str) -> Optional[OffloadManifest]:
        """Load a manifest from local file."""
        file_path = self.manifests_dir / f"{local_id}.json"
        if not file_path.exists():
            return None

        with open(file_path) as f:
            data = json.load(f)
        return OffloadManifest.from_dict(data)

    def list_manifests(self, limit: int = 50) -> List[OffloadManifest]:
        """List recent manifests."""
        manifests = []
        for file_path in sorted(self.manifests_dir.glob("*.json"), reverse=True)[:limit]:
            try:
                with open(file_path) as f:
                    data = json.load(f)
                manifests.append(OffloadManifest.from_dict(data))
            except Exception:
                continue
        return manifests

    def get_pending_manifests(self) -> List[OffloadManifest]:
        """Get manifests that need to be synced to server."""
        manifests = self.list_manifests()
        return [
            m for m in manifests
            if m.project_id and not m.server_id and m.offload_status == OffloadStatus.COMPLETED.value
        ]

    def get_pending_uploads(self) -> List[OffloadManifest]:
        """Get manifests with files pending upload."""
        manifests = self.list_manifests()
        return [
            m for m in manifests
            if m.offload_status == OffloadStatus.COMPLETED.value
            and m.upload_status in (UploadStatus.PENDING.value, UploadStatus.FAILED.value)
        ]

    def start_upload(self, manifest: Optional[OffloadManifest] = None) -> OffloadManifest:
        """Mark manifest as upload in progress."""
        manifest = manifest or self._active_manifest
        if not manifest:
            raise ValueError("No manifest to update")

        manifest.upload_status = UploadStatus.UPLOADING.value
        self._save_manifest(manifest)
        return manifest

    def complete_upload(
        self,
        manifest: Optional[OffloadManifest] = None,
        success: bool = True,
    ) -> OffloadManifest:
        """Mark manifest upload as complete or failed."""
        manifest = manifest or self._active_manifest
        if not manifest:
            raise ValueError("No manifest to update")

        manifest.upload_status = (
            UploadStatus.COMPLETED.value if success
            else UploadStatus.FAILED.value
        )
        self._save_manifest(manifest)
        return manifest

    def get_upload_progress(self, manifest: OffloadManifest) -> Dict[str, Any]:
        """Get upload progress for a manifest."""
        uploaded = sum(1 for f in manifest.files if f.upload_status == "completed")
        failed = sum(1 for f in manifest.files if f.upload_status == "failed")
        pending = sum(1 for f in manifest.files if f.upload_status == "pending")
        uploading = sum(1 for f in manifest.files if f.upload_status == "uploading")

        return {
            "total_files": manifest.total_files,
            "uploaded_files": uploaded,
            "failed_files": failed,
            "pending_files": pending,
            "uploading_files": uploading,
            "upload_percent": (uploaded / manifest.total_files * 100) if manifest.total_files > 0 else 0,
        }

    async def sync_manifest_to_server(
        self,
        manifest: OffloadManifest,
        api_client: Any,  # Will be the API client
    ) -> Optional[str]:
        """
        Sync a manifest to the Backlot server.
        Returns the server-side manifest ID if successful.
        """
        if not manifest.project_id:
            return None

        try:
            # Create manifest on server
            response = await api_client.post(
                f"/api/v1/backlot/projects/{manifest.project_id}/dailies/offload-manifest",
                json={
                    "production_day_id": manifest.production_day_id,
                    "manifest_name": manifest.manifest_name,
                    "source_device": manifest.source_device,
                    "camera_label": manifest.camera_label,
                    "roll_name": manifest.roll_name,
                    "total_files": manifest.total_files,
                    "total_bytes": manifest.total_bytes,
                    "create_footage_asset": manifest.create_footage_asset,
                    "files": [f.to_dict() for f in manifest.files],
                }
            )

            if response and "id" in response:
                manifest.server_id = response["id"]
                self._save_manifest(manifest)
                return manifest.server_id

        except Exception as e:
            print(f"Failed to sync manifest to server: {e}")

        return None
