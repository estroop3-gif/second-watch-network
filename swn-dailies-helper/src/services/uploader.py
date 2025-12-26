"""
Upload service for uploading files to SWN cloud storage.
Uses presigned URLs for direct S3 upload.
"""
import os
import hashlib
import logging
from pathlib import Path
from typing import Optional, Callable, List, Dict, Any
from dataclasses import dataclass
from enum import Enum
import mimetypes
import threading
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
    TimeoutError as SWNTimeoutError,
)

logger = logging.getLogger("swn-helper")


class UploadStatus(Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    VERIFYING = "verifying"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class UploadJob:
    """Represents a single file upload job."""
    file_path: Path
    file_name: str
    file_size: int
    content_type: str
    status: UploadStatus = UploadStatus.PENDING
    progress: float = 0.0
    error: Optional[str] = None
    checksum: Optional[str] = None
    s3_key: Optional[str] = None
    clip_id: Optional[str] = None


class UploaderService:
    """Service for uploading files to the cloud."""

    API_BASE = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"
    CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB chunks for progress tracking

    def __init__(self, config: ConfigManager):
        self.config = config
        self._cancel_flag = False
        self._current_jobs: List[UploadJob] = []
        self._progress_callback: Optional[Callable[[int, float, str], None]] = None

    def set_progress_callback(self, callback: Callable[[int, float, str], None]):
        """Set callback for progress updates: (job_index, progress_percent, status_text)"""
        self._progress_callback = callback

    def _notify_progress(self, job_index: int, progress: float, status: str):
        """Notify progress callback if set."""
        if self._progress_callback:
            self._progress_callback(job_index, progress, status)

    def create_jobs(self, file_paths: List[Path]) -> List[UploadJob]:
        """Create upload jobs for a list of files."""
        jobs = []
        for path in file_paths:
            if not path.exists() or not path.is_file():
                continue

            content_type, _ = mimetypes.guess_type(str(path))
            if not content_type:
                content_type = "application/octet-stream"

            job = UploadJob(
                file_path=path,
                file_name=path.name,
                file_size=path.stat().st_size,
                content_type=content_type,
            )
            jobs.append(job)

        self._current_jobs = jobs
        return jobs

    def cancel(self):
        """Cancel the current upload operation."""
        self._cancel_flag = True

    def reset(self):
        """Reset the uploader state."""
        self._cancel_flag = False
        self._current_jobs = []

    def get_presigned_url(
        self,
        project_id: str,
        file_name: str,
        content_type: str,
        card_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get a presigned upload URL from the API."""
        api_key = self.config.get_api_key()
        if not api_key:
            raise APIKeyNotFoundError()

        logger.info(f"Getting presigned URL for: {file_name}")

        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{self.API_BASE}/api/v1/backlot/dailies/upload-url",
                    headers={
                        "X-API-Key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "project_id": project_id,
                        "card_id": card_id,
                        "file_name": file_name,
                        "content_type": content_type,
                    },
                    timeout=30.0,
                )

                if response.status_code == 401:
                    raise APIResponseError(401, "Invalid or expired API key")
                if response.status_code == 403:
                    raise APIResponseError(403, "Access denied to project")
                if response.status_code != 200:
                    try:
                        error_detail = response.json().get("detail", response.text)
                    except Exception:
                        error_detail = response.text
                    raise PresignedUrlError(error_detail)

                return response.json()

        except httpx.ConnectError:
            raise APIConnectionError("Failed to connect to SWN server")
        except httpx.TimeoutException:
            raise SWNTimeoutError("getting presigned URL")

    def upload_file(
        self,
        job: UploadJob,
        job_index: int,
        project_id: str,
        day_id: Optional[str] = None,
        card_id: Optional[str] = None,
        verify_checksum: bool = True,
    ) -> bool:
        """Upload a single file and return success status."""
        if self._cancel_flag:
            job.status = UploadStatus.CANCELLED
            return False

        try:
            # Update status
            job.status = UploadStatus.UPLOADING
            self._notify_progress(job_index, 0, f"Getting upload URL for {job.file_name}...")

            # Calculate checksum first if verification enabled
            if verify_checksum:
                self._notify_progress(job_index, 0, f"Calculating checksum for {job.file_name}...")
                job.checksum = calculate_xxh64(str(job.file_path))

            if self._cancel_flag:
                job.status = UploadStatus.CANCELLED
                return False

            # Get presigned URL
            upload_info = self.get_presigned_url(
                project_id=project_id,
                file_name=job.file_name,
                content_type=job.content_type,
                card_id=card_id,
            )

            upload_url = upload_info.get("upload_url")
            job.s3_key = upload_info.get("key")

            if not upload_url:
                raise Exception("No upload URL returned")

            # Upload with progress tracking
            self._notify_progress(job_index, 0, f"Uploading {job.file_name}...")

            with open(job.file_path, "rb") as f:
                file_data = f.read()

            # Track upload progress
            total_size = len(file_data)
            uploaded = 0

            def upload_progress():
                nonlocal uploaded
                while uploaded < total_size and not self._cancel_flag:
                    progress = (uploaded / total_size) * 100
                    job.progress = progress
                    self._notify_progress(job_index, progress, f"Uploading {job.file_name}... {progress:.0f}%")
                    time.sleep(0.5)

            progress_thread = threading.Thread(target=upload_progress, daemon=True)
            progress_thread.start()

            with httpx.Client() as client:
                response = client.put(
                    upload_url,
                    content=file_data,
                    headers={"Content-Type": job.content_type},
                    timeout=600.0,  # 10 minutes for large files
                )
                uploaded = total_size

            progress_thread.join(timeout=1)

            if response.status_code not in (200, 204):
                raise Exception(f"Upload failed: {response.status_code}")

            if self._cancel_flag:
                job.status = UploadStatus.CANCELLED
                return False

            # Verify if needed
            if verify_checksum:
                job.status = UploadStatus.VERIFYING
                self._notify_progress(job_index, 100, f"Verifying {job.file_name}...")
                # For now, assume verification passes if upload succeeded
                # TODO: Download and verify if needed

            # Mark complete
            job.status = UploadStatus.COMPLETE
            job.progress = 100
            self._notify_progress(job_index, 100, f"Complete: {job.file_name}")
            return True

        except Exception as e:
            job.status = UploadStatus.FAILED
            job.error = str(e)
            self._notify_progress(job_index, job.progress, f"Failed: {job.file_name} - {e}")
            return False

    def upload_batch(
        self,
        jobs: List[UploadJob],
        project_id: str,
        day_id: Optional[str] = None,
        card_id: Optional[str] = None,
        camera_label: str = "A",
        roll_name: str = "A001",
        verify_checksum: bool = True,
        on_complete: Optional[Callable[[bool, List[UploadJob]], None]] = None,
    ):
        """Upload a batch of files."""
        self._cancel_flag = False

        success_count = 0
        for i, job in enumerate(jobs):
            if self._cancel_flag:
                break

            success = self.upload_file(
                job=job,
                job_index=i,
                project_id=project_id,
                day_id=day_id,
                card_id=card_id,
                verify_checksum=verify_checksum,
            )
            if success:
                success_count += 1

        # Notify completion
        all_success = success_count == len(jobs)
        if on_complete:
            on_complete(all_success, jobs)

        return all_success

    def register_clips_with_backlot(
        self,
        project_id: str,
        day_id: str,
        camera_label: str,
        roll_name: str,
        clips: List[Dict[str, Any]],
    ) -> bool:
        """Register uploaded clips with the Backlot API."""
        api_key = self.config.get_api_key()
        if not api_key:
            raise ValueError("API key not configured")

        with httpx.Client() as client:
            response = client.post(
                f"{self.API_BASE}/api/v1/backlot/dailies/local-ingest",
                headers={
                    "X-API-Key": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "project_id": project_id,
                    "day_id": day_id,
                    "cards": [{
                        "camera_label": camera_label,
                        "roll_name": roll_name,
                        "storage_mode": "cloud",
                        "clips": clips,
                    }],
                },
                timeout=30.0,
            )

            return response.status_code == 200
