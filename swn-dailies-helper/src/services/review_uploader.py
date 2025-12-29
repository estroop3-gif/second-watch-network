"""
Review upload service for uploading deliverables to Review tab.
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
import time

import httpx
from concurrent.futures import ThreadPoolExecutor, as_completed

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


class ReviewUploadStatus(Enum):
    PENDING = "pending"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ReviewUploadJob:
    """Represents a single review file upload job."""
    file_path: Path
    file_name: str
    file_size: int
    content_type: str
    status: ReviewUploadStatus = ReviewUploadStatus.PENDING
    progress: float = 0.0
    error: Optional[str] = None
    checksum: Optional[str] = None
    s3_key: Optional[str] = None
    version_id: Optional[str] = None
    asset_id: Optional[str] = None
    retry_count: int = 0


class ReviewUploaderService:
    """Service for uploading deliverables to the Review system."""

    API_BASE = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"
    CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB chunks for progress tracking

    def __init__(self, config: ConfigManager):
        self.config = config
        self._cancel_flag = False
        self._current_jobs: List[ReviewUploadJob] = []
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

    def create_jobs(self, file_paths: List[Path]) -> List[ReviewUploadJob]:
        """Create upload jobs for a list of files."""
        jobs = []
        for path in file_paths:
            if not path.exists() or not path.is_file():
                continue

            content_type, _ = mimetypes.guess_type(str(path))
            if not content_type:
                content_type = "application/octet-stream"

            jobs.append(ReviewUploadJob(
                file_path=path,
                file_name=path.name,
                file_size=path.stat().st_size,
                content_type=content_type,
            ))
        return jobs

    def cancel(self):
        """Request cancellation of current uploads."""
        self._cancel_flag = True

    def reset_cancel(self):
        """Reset the cancellation flag."""
        self._cancel_flag = False

    def get_review_folders(self, project_id: str) -> List[dict]:
        """Fetch available Review folders for a project."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/projects/{project_id}/review/folders"

            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data.get("folders", [])
        except Exception as e:
            logger.error(f"Failed to fetch review folders: {e}")
            return []

    def get_review_assets(self, project_id: str, folder_id: Optional[str] = None) -> List[dict]:
        """Fetch existing Review assets for a project."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/projects/{project_id}/review/assets"
            if folder_id:
                url += f"?folder_id={folder_id}"

            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data.get("assets", [])
        except Exception as e:
            logger.error(f"Failed to fetch review assets: {e}")
            return []

    def create_review_asset(
        self,
        project_id: str,
        name: str,
        description: str = "",
        folder_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Create a new Review asset."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/projects/{project_id}/review/assets"

            payload = {
                "name": name,
                "description": description,
            }
            if folder_id:
                payload["folder_id"] = folder_id

            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=self._get_headers(), json=payload)
                response.raise_for_status()
                data = response.json()
                return data.get("asset")
        except Exception as e:
            logger.error(f"Failed to create review asset: {e}")
            return None

    def get_upload_url(
        self,
        project_id: str,
        asset_id: str,
        filename: str,
        content_type: str,
    ) -> Optional[dict]:
        """Get a presigned URL for uploading a review version."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/review/assets/{asset_id}/versions/upload-url"

            payload = {
                "filename": filename,
                "content_type": content_type,
                "storage_mode": "s3",
            }

            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=self._get_headers(), json=payload)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get upload URL: {e}")
            return None

    def complete_upload(
        self,
        version_id: str,
        file_size: int,
        checksum: Optional[str] = None,
    ) -> bool:
        """Mark an upload as complete and trigger transcoding."""
        try:
            api_url = self.config.get_api_url() or self.API_BASE
            url = f"{api_url}/api/v1/backlot/desktop-keys/review/versions/{version_id}/complete-upload"

            payload = {
                "file_size_bytes": file_size,
            }
            if checksum:
                payload["checksum"] = checksum

            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=self._get_headers(), json=payload)
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Failed to complete upload: {e}")
            return False

    def upload_file(
        self,
        job: ReviewUploadJob,
        upload_url: str,
        job_index: int = 0,
    ) -> bool:
        """Upload a single file to S3 using presigned URL."""
        try:
            job.status = ReviewUploadStatus.UPLOADING

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

            job.status = ReviewUploadStatus.PROCESSING
            job.progress = 100.0
            return True

        except Exception as e:
            job.status = ReviewUploadStatus.FAILED
            job.error = str(e)
            logger.error(f"Upload failed for {job.file_name}: {e}")
            return False

    def upload_to_review(
        self,
        jobs: List[ReviewUploadJob],
        project_id: str,
        asset_name: str,
        folder_id: Optional[str] = None,
        description: str = "",
        create_new_asset: bool = True,
        existing_asset_id: Optional[str] = None,
        max_retries: int = 3,
        retry_delay_base: float = 2.0,
    ) -> bool:
        """Upload files to the Review system.

        Args:
            jobs: List of upload jobs
            project_id: Target project ID
            asset_name: Name for the review asset
            folder_id: Optional folder to place asset in
            description: Optional description
            create_new_asset: Whether to create a new asset or add version to existing
            existing_asset_id: ID of existing asset (if not creating new)
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
                job.status = ReviewUploadStatus.CANCELLED
                continue

            # Calculate checksum first
            self._notify_progress(job_index, 0, f"Calculating checksum for {job.file_name}")
            try:
                job.checksum = calculate_xxh64(job.file_path)
            except Exception as e:
                logger.warning(f"Checksum calculation failed: {e}")

            # Create or use existing asset
            asset_id = existing_asset_id
            if create_new_asset or not asset_id:
                # Use filename as asset name if multiple files
                name = asset_name if len(jobs) == 1 else f"{asset_name} - {job.file_name}"
                asset = self.create_review_asset(project_id, name, description, folder_id)
                if not asset:
                    job.status = ReviewUploadStatus.FAILED
                    job.error = "Failed to create review asset"
                    all_success = False
                    continue
                asset_id = asset["id"]
                job.asset_id = asset_id

            # Get presigned upload URL
            self._notify_progress(job_index, 5, f"Getting upload URL for {job.file_name}")
            upload_data = self.get_upload_url(project_id, asset_id, job.file_name, job.content_type)
            if not upload_data:
                job.status = ReviewUploadStatus.FAILED
                job.error = "Failed to get upload URL"
                all_success = False
                continue

            upload_url = upload_data.get("upload_url")
            version_id = upload_data.get("version_id")
            job.version_id = version_id
            job.s3_key = upload_data.get("s3_key")

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

            # Complete upload and trigger transcoding
            self._notify_progress(job_index, 100, f"Finalizing {job.file_name}")
            if self.complete_upload(version_id, job.file_size, job.checksum):
                job.status = ReviewUploadStatus.COMPLETE
            else:
                job.status = ReviewUploadStatus.FAILED
                job.error = "Failed to finalize upload"
                all_success = False

        return all_success
