"""
Asset upload service for uploading standalone assets.
Supports audio, 3D models, images, documents, and other file types.
Uses presigned URLs for direct S3 upload.
"""
import os
import logging
from pathlib import Path
from typing import Optional, Callable, List, Dict, Any
from dataclasses import dataclass
from enum import Enum
import mimetypes
import time

import httpx

from src.services.config import ConfigManager
from src.services.checksum import calculate_xxh64
from src.services.exceptions import (
    UploadError,
    PresignedUrlError,
    FileUploadError,
    APIKeyNotFoundError,
    APIConnectionError,
    APIResponseError,
)

logger = logging.getLogger("swn-helper")


# Asset type detection by file extension
ASSET_TYPE_MAP = {
    # Audio
    '.wav': 'audio', '.mp3': 'audio', '.aac': 'audio', '.flac': 'audio',
    '.aiff': 'audio', '.ogg': 'audio', '.m4a': 'audio',

    # 3D Models
    '.obj': '3d_model', '.fbx': '3d_model', '.gltf': '3d_model',
    '.glb': '3d_model', '.blend': '3d_model', '.c4d': '3d_model',
    '.maya': '3d_model', '.max': '3d_model', '.stl': '3d_model',
    '.dae': '3d_model', '.3ds': '3d_model', '.usdz': '3d_model',

    # Images
    '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
    '.tiff': 'image', '.tif': 'image', '.psd': 'image', '.exr': 'image',
    '.bmp': 'image', '.gif': 'image', '.webp': 'image', '.heic': 'image',
    '.raw': 'image', '.cr2': 'image', '.nef': 'image', '.arw': 'image',

    # Graphics/Vector
    '.ai': 'graphics', '.eps': 'graphics', '.svg': 'graphics',
    '.pdf': 'graphics',  # Can be graphics or document

    # Documents
    '.doc': 'document', '.docx': 'document', '.txt': 'document',
    '.rtf': 'document', '.odt': 'document', '.pages': 'document',
    '.xls': 'document', '.xlsx': 'document', '.csv': 'document',
    '.ppt': 'document', '.pptx': 'document', '.key': 'document',

    # Music (could be in music library)
    # Detected by folder path or metadata, defaults to 'audio'

    # SFX (could be sound effects)
    # Detected by folder path or metadata, defaults to 'audio'
}


class AssetUploadStatus(Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AssetUploadJob:
    """Represents a single asset upload job."""
    file_path: Path
    file_name: str
    file_size: int
    content_type: str
    asset_type: str
    status: AssetUploadStatus = AssetUploadStatus.PENDING
    progress: float = 0.0
    error: Optional[str] = None
    checksum: Optional[str] = None
    s3_key: Optional[str] = None
    asset_id: Optional[str] = None
    retry_count: int = 0


class AssetUploaderService:
    """Service for uploading standalone assets."""

    API_BASE = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"
    CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB chunks for progress tracking

    def __init__(self, config: ConfigManager):
        self.config = config
        self._cancel_flag = False
        self._current_jobs: List[AssetUploadJob] = []
        self._progress_callback: Optional[Callable[[int, float, str], None]] = None

    def set_progress_callback(self, callback: Callable[[int, float, str], None]):
        """Set callback for progress updates: (job_index, progress_percent, status_text)"""
        self._progress_callback = callback

    def _notify_progress(self, job_index: int, progress: float, status: str):
        """Notify progress callback if set."""
        if self._progress_callback:
            self._progress_callback(job_index, progress, status)

    def _get_headers(self) -> dict:
        """Get headers with API key for authenticated requests."""
        api_key = self.config.get_api_key()
        if not api_key:
            raise APIKeyNotFoundError("No API key configured")
        return {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        }

    def detect_asset_type(self, path: Path) -> str:
        """Detect asset type from file extension."""
        suffix = path.suffix.lower()
        return ASSET_TYPE_MAP.get(suffix, 'other')

    def create_jobs(self, file_paths: List[Path]) -> List[AssetUploadJob]:
        """Create upload jobs for a list of files."""
        jobs = []
        for path in file_paths:
            if not path.exists() or not path.is_file():
                continue

            content_type, _ = mimetypes.guess_type(str(path))
            if not content_type:
                content_type = "application/octet-stream"

            asset_type = self.detect_asset_type(path)

            jobs.append(AssetUploadJob(
                file_path=path,
                file_name=path.name,
                file_size=path.stat().st_size,
                content_type=content_type,
                asset_type=asset_type,
            ))
        return jobs

    def cancel(self):
        """Request cancellation of current uploads."""
        self._cancel_flag = True

    def reset_cancel(self):
        """Reset the cancellation flag."""
        self._cancel_flag = False

    def get_asset_folders(self, project_id: str) -> List[dict]:
        """Fetch available Asset folders for a project."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/projects/{project_id}/assets/folders"

            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data.get("folders", [])
        except Exception as e:
            logger.error(f"Failed to fetch asset folders: {e}")
            return []

    def get_upload_url(
        self,
        project_id: str,
        filename: str,
        content_type: str,
        asset_type: str,
        folder_id: Optional[str] = None,
        name: Optional[str] = None,
    ) -> Optional[dict]:
        """Get a presigned URL for uploading an asset. Also creates asset record."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/projects/{project_id}/assets/upload-url"

            payload = {
                "filename": filename,
                "content_type": content_type,
                "asset_type": asset_type,
                "name": name or Path(filename).stem,
            }
            if folder_id:
                payload["folder_id"] = folder_id

            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=self._get_headers(), json=payload)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get upload URL: {e}")
            return None

    def complete_upload(
        self,
        asset_id: str,
        file_size: int,
        checksum: Optional[str] = None,
        duration_seconds: Optional[float] = None,
        dimensions: Optional[str] = None,
    ) -> bool:
        """Complete an asset upload."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/assets/{asset_id}/complete-upload"

            payload = {
                "file_size_bytes": file_size,
            }
            if checksum:
                payload["checksum"] = checksum
            if duration_seconds:
                payload["duration_seconds"] = duration_seconds
            if dimensions:
                payload["dimensions"] = dimensions

            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=self._get_headers(), json=payload)
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Failed to complete upload: {e}")
            return False

    def upload_file(
        self,
        job: AssetUploadJob,
        upload_url: str,
        job_index: int = 0,
    ) -> bool:
        """Upload a single file to S3 using presigned URL."""
        try:
            job.status = AssetUploadStatus.UPLOADING

            file_size = job.file_size
            uploaded = 0

            def progress_reader(file_obj):
                nonlocal uploaded
                while True:
                    chunk = file_obj.read(self.CHUNK_SIZE)
                    if not chunk:
                        break
                    uploaded += len(chunk)
                    progress = (uploaded / file_size) * 100
                    job.progress = progress
                    self._notify_progress(job_index, progress, f"Uploading {job.file_name}")
                    yield chunk

            with open(job.file_path, "rb") as f:
                with httpx.Client(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
                    response = client.put(
                        upload_url,
                        content=progress_reader(f),
                        headers={
                            "Content-Type": job.content_type,
                            "Content-Length": str(file_size),
                        },
                    )
                    response.raise_for_status()

            job.progress = 100.0
            return True

        except Exception as e:
            job.status = AssetUploadStatus.FAILED
            job.error = str(e)
            logger.error(f"Upload failed for {job.file_name}: {e}")
            return False

    def upload_assets(
        self,
        jobs: List[AssetUploadJob],
        project_id: str,
        folder_id: Optional[str] = None,
        description: str = "",
        tags: Optional[List[str]] = None,
        max_retries: int = 3,
        retry_delay_base: float = 2.0,
    ) -> bool:
        """Upload assets to the Assets system.

        Args:
            jobs: List of upload jobs
            project_id: Target project ID
            folder_id: Optional folder to place assets in
            description: Optional description for assets
            tags: Optional tags for assets
            max_retries: Maximum retry attempts per file
            retry_delay_base: Base delay for exponential backoff

        Returns:
            True if all uploads successful
        """
        self._cancel_flag = False
        self._current_jobs = jobs
        all_success = True

        for job_index, job in enumerate(jobs):
            if self._cancel_flag:
                job.status = AssetUploadStatus.CANCELLED
                continue

            # Calculate checksum first
            self._notify_progress(job_index, 0, f"Calculating checksum for {job.file_name}")
            try:
                job.checksum = calculate_xxh64(job.file_path)
            except Exception as e:
                logger.warning(f"Checksum calculation failed: {e}")

            # Get presigned upload URL (also creates asset record)
            self._notify_progress(job_index, 5, f"Getting upload URL for {job.file_name}")
            asset_name = job.file_path.stem  # Use filename without extension
            upload_data = self.get_upload_url(
                project_id,
                job.file_name,
                job.content_type,
                job.asset_type,
                folder_id,
                name=asset_name,
            )
            if not upload_data:
                job.status = AssetUploadStatus.FAILED
                job.error = "Failed to get upload URL"
                all_success = False
                continue

            upload_url = upload_data.get("upload_url")
            job.s3_key = upload_data.get("s3_key")
            job.asset_id = upload_data.get("asset_id")

            # Upload with retries
            success = False
            for attempt in range(max_retries):
                if self._cancel_flag:
                    break

                success = self.upload_file(job, upload_url, job_index)
                if success:
                    break

                # Retry with exponential backoff
                if attempt < max_retries - 1:
                    delay = retry_delay_base ** (attempt + 1)
                    self._notify_progress(job_index, job.progress, f"Retry {attempt + 2}/{max_retries} in {delay:.0f}s")
                    time.sleep(delay)
                    job.retry_count += 1

            if not success:
                all_success = False
                continue

            # Complete the upload
            self._notify_progress(job_index, 100, f"Finalizing {job.file_name}")
            if self.complete_upload(job.asset_id, job.file_size, job.checksum):
                job.status = AssetUploadStatus.COMPLETE
            else:
                job.status = AssetUploadStatus.FAILED
                job.error = "Failed to finalize upload"
                all_success = False

        return all_success
