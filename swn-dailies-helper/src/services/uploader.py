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
class UploadConfig:
    """Configuration for upload behavior."""
    max_retries: int = 3
    retry_delay_base: float = 2.0  # Exponential backoff base
    parallel_uploads: int = 3
    verify_checksum: bool = True
    register_clips: bool = True


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
    retry_count: int = 0


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

    def _is_retryable_error(self, error: Exception) -> bool:
        """Check if an error is retryable (network/transient errors only)."""
        # Network connectivity errors
        if isinstance(error, (httpx.ConnectError, httpx.TimeoutException)):
            return True
        # Our wrapped timeout error
        if isinstance(error, SWNTimeoutError):
            return True
        # API connection errors (not auth errors)
        if isinstance(error, APIConnectionError):
            return True
        # Don't retry auth errors or validation errors
        if isinstance(error, (APIKeyNotFoundError, PresignedUrlError)):
            return False
        if isinstance(error, APIResponseError):
            # Don't retry 401/403 auth errors
            if hasattr(error, 'status_code') and error.status_code in (401, 403):
                return False
            # Retry 5xx server errors
            if hasattr(error, 'status_code') and error.status_code >= 500:
                return True
        # Generic upload failures might be transient
        if isinstance(error, FileUploadError):
            return True
        # Default: retry unknown errors once
        return True

    def upload_file(
        self,
        job: UploadJob,
        job_index: int,
        project_id: str,
        day_id: Optional[str] = None,
        card_id: Optional[str] = None,
        verify_checksum: bool = True,
        max_retries: int = 3,
        retry_delay_base: float = 2.0,
    ) -> bool:
        """Upload a single file with retry logic and return success status."""
        if self._cancel_flag:
            job.status = UploadStatus.CANCELLED
            return False

        job.retry_count = 0
        last_error: Optional[Exception] = None

        while job.retry_count <= max_retries:
            try:
                if job.retry_count > 0:
                    # Exponential backoff: 2^retry_count * base (2s, 4s, 8s, ...)
                    delay = (2 ** job.retry_count) * retry_delay_base
                    self._notify_progress(
                        job_index, job.progress,
                        f"Retry {job.retry_count}/{max_retries} for {job.file_name} in {delay:.0f}s..."
                    )
                    time.sleep(delay)

                    if self._cancel_flag:
                        job.status = UploadStatus.CANCELLED
                        return False

                return self._upload_file_internal(
                    job=job,
                    job_index=job_index,
                    project_id=project_id,
                    day_id=day_id,
                    card_id=card_id,
                    verify_checksum=verify_checksum,
                )

            except Exception as e:
                last_error = e
                logger.warning(f"Upload attempt {job.retry_count + 1} failed for {job.file_name}: {e}")

                if not self._is_retryable_error(e):
                    # Non-retryable error, fail immediately
                    job.status = UploadStatus.FAILED
                    job.error = str(e)
                    self._notify_progress(job_index, job.progress, f"Failed: {job.file_name} - {e}")
                    return False

                job.retry_count += 1
                if job.retry_count > max_retries:
                    break

        # All retries exhausted
        job.status = UploadStatus.FAILED
        job.error = f"Failed after {max_retries} retries: {last_error}"
        self._notify_progress(
            job_index, job.progress,
            f"Failed after {max_retries} retries: {job.file_name}"
        )
        return False

    def _upload_file_internal(
        self,
        job: UploadJob,
        job_index: int,
        project_id: str,
        day_id: Optional[str] = None,
        card_id: Optional[str] = None,
        verify_checksum: bool = True,
    ) -> bool:
        """Internal upload logic (called by upload_file with retry wrapper)."""
        if self._cancel_flag:
            job.status = UploadStatus.CANCELLED
            return False

        # Update status
        job.status = UploadStatus.UPLOADING
        retry_prefix = f"[Retry {job.retry_count}/{3}] " if job.retry_count > 0 else ""
        self._notify_progress(job_index, 0, f"{retry_prefix}Getting upload URL for {job.file_name}...")

        # Calculate checksum first if verification enabled (and not already calculated)
        if verify_checksum and not job.checksum:
            self._notify_progress(job_index, 0, f"{retry_prefix}Calculating checksum for {job.file_name}...")
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
            raise PresignedUrlError("No upload URL returned")

        # Upload with progress tracking
        self._notify_progress(job_index, 0, f"{retry_prefix}Uploading {job.file_name}...")

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
                self._notify_progress(job_index, progress, f"{retry_prefix}Uploading {job.file_name}... {progress:.0f}%")
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
            raise FileUploadError(job.file_name, f"S3 upload failed with status {response.status_code}")

        if self._cancel_flag:
            job.status = UploadStatus.CANCELLED
            return False

        # Verify with server if checksum was calculated
        if verify_checksum and job.checksum and job.s3_key:
            job.status = UploadStatus.VERIFYING
            self._notify_progress(job_index, 100, f"{retry_prefix}Verifying {job.file_name}...")

            try:
                confirm_result = self.confirm_upload(
                    project_id=project_id,
                    s3_key=job.s3_key,
                    checksum=job.checksum,
                    file_size=job.file_size,
                    file_name=job.file_name,
                )
                # Store clip_id from confirmation
                job.clip_id = confirm_result.get("clip_id")
                logger.info(f"Upload confirmed: {job.file_name} -> clip_id={job.clip_id}")
            except FileUploadError as e:
                # Checksum mismatch - this is a real failure
                raise
            except Exception as e:
                # Log but don't fail on confirmation errors (file is already uploaded)
                logger.warning(f"Upload confirmation failed for {job.file_name}: {e}")

        # Mark complete
        job.status = UploadStatus.COMPLETE
        job.progress = 100
        self._notify_progress(job_index, 100, f"Complete: {job.file_name}")
        return True

    def _register_completed_jobs(
        self,
        jobs: List[UploadJob],
        project_id: str,
        day_id: str,
        camera_label: str,
        roll_name: str,
    ):
        """Register successfully completed upload jobs with Backlot."""
        # Build clips list from successful jobs
        clips = []
        for job in jobs:
            if job.status == UploadStatus.COMPLETE and job.s3_key:
                clips.append({
                    "file_name": job.file_name,
                    "file_size": job.file_size,
                    "s3_key": job.s3_key,
                    "checksum": job.checksum,
                    "clip_id": job.clip_id,
                })

        if clips:
            try:
                self.register_clips_with_backlot(
                    project_id=project_id,
                    day_id=day_id,
                    camera_label=camera_label,
                    roll_name=roll_name,
                    clips=clips,
                )
            except Exception as e:
                logger.error(f"Failed to register clips with Backlot: {e}")

    def upload_batch(
        self,
        jobs: List[UploadJob],
        project_id: str,
        day_id: Optional[str] = None,
        card_id: Optional[str] = None,
        camera_label: str = "A",
        roll_name: str = "A001",
        verify_checksum: bool = True,
        max_retries: int = 3,
        retry_delay_base: float = 2.0,
        register_clips: bool = True,
        on_complete: Optional[Callable[[bool, List[UploadJob]], None]] = None,
    ):
        """Upload a batch of files sequentially with retry logic."""
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
                max_retries=max_retries,
                retry_delay_base=retry_delay_base,
            )
            if success:
                success_count += 1

        # Register clips with Backlot after successful uploads
        if register_clips and day_id and success_count > 0:
            self._register_completed_jobs(
                jobs=jobs,
                project_id=project_id,
                day_id=day_id,
                camera_label=camera_label,
                roll_name=roll_name,
            )

        # Notify completion
        all_success = success_count == len(jobs)
        if on_complete:
            on_complete(all_success, jobs)

        return all_success

    def upload_batch_parallel(
        self,
        jobs: List[UploadJob],
        project_id: str,
        day_id: Optional[str] = None,
        card_id: Optional[str] = None,
        camera_label: str = "A",
        roll_name: str = "A001",
        verify_checksum: bool = True,
        max_retries: int = 3,
        retry_delay_base: float = 2.0,
        max_workers: int = 3,
        register_clips: bool = True,
        on_job_complete: Optional[Callable[[int, UploadJob], None]] = None,
        on_complete: Optional[Callable[[bool, List[UploadJob]], None]] = None,
    ):
        """Upload a batch of files in parallel with retry logic.

        Args:
            jobs: List of upload jobs
            project_id: Target project ID
            day_id: Optional day ID
            card_id: Optional card ID
            camera_label: Camera label for registration
            roll_name: Roll name for registration
            verify_checksum: Whether to verify checksums
            max_retries: Max retry attempts per file
            retry_delay_base: Base delay for exponential backoff
            max_workers: Number of parallel upload workers
            register_clips: Whether to register clips with Backlot after upload
            on_job_complete: Callback when a single job completes (index, job)
            on_complete: Callback when all jobs complete (success, jobs)
        """
        self._cancel_flag = False

        # Track completed jobs
        completed_count = 0
        success_count = 0
        lock = threading.Lock()

        def upload_single(job_index: int, job: UploadJob) -> tuple[int, bool]:
            """Upload a single job and return (index, success)."""
            if self._cancel_flag:
                job.status = UploadStatus.CANCELLED
                return job_index, False

            success = self.upload_file(
                job=job,
                job_index=job_index,
                project_id=project_id,
                day_id=day_id,
                card_id=card_id,
                verify_checksum=verify_checksum,
                max_retries=max_retries,
                retry_delay_base=retry_delay_base,
            )

            if on_job_complete:
                on_job_complete(job_index, job)

            return job_index, success

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all jobs
            futures = {
                executor.submit(upload_single, i, job): (i, job)
                for i, job in enumerate(jobs)
            }

            # Process as they complete
            for future in as_completed(futures):
                if self._cancel_flag:
                    # Cancel remaining futures
                    for f in futures:
                        f.cancel()
                    break

                try:
                    job_index, success = future.result()
                    with lock:
                        completed_count += 1
                        if success:
                            success_count += 1
                except Exception as e:
                    logger.error(f"Parallel upload error: {e}")
                    job_index, job = futures[future]
                    job.status = UploadStatus.FAILED
                    job.error = str(e)
                    with lock:
                        completed_count += 1

        # Register clips with Backlot after successful uploads
        if register_clips and day_id and success_count > 0:
            self._register_completed_jobs(
                jobs=jobs,
                project_id=project_id,
                day_id=day_id,
                camera_label=camera_label,
                roll_name=roll_name,
            )

        # Notify completion
        all_success = success_count == len(jobs)
        if on_complete:
            on_complete(all_success, jobs)

        return all_success

    def confirm_upload(
        self,
        project_id: str,
        s3_key: str,
        checksum: str,
        file_size: int,
        file_name: str = "",
    ) -> Dict[str, Any]:
        """Confirm upload with the server and verify checksum.

        Args:
            project_id: Project ID
            s3_key: S3 key where file was uploaded
            checksum: XXH64 checksum of the file
            file_size: File size in bytes
            file_name: Original filename

        Returns:
            Response data including clip_id if successful

        Raises:
            APIResponseError: If confirmation fails
        """
        api_key = self.config.get_api_key()
        if not api_key:
            raise APIKeyNotFoundError()

        logger.info(f"Confirming upload: {s3_key}")

        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{self.API_BASE}/api/v1/backlot/desktop-keys/dailies/confirm-upload",
                    headers={
                        "X-API-Key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "project_id": project_id,
                        "s3_key": s3_key,
                        "checksum": checksum,
                        "file_size": file_size,
                        "file_name": file_name,
                    },
                    timeout=30.0,
                )

                if response.status_code == 401:
                    raise APIResponseError(401, "Invalid or expired API key")
                if response.status_code == 403:
                    raise APIResponseError(403, "Access denied")
                if response.status_code == 409:
                    # Checksum mismatch
                    raise FileUploadError(job.file_name, "Checksum verification failed - file may be corrupted")
                if response.status_code not in (200, 201):
                    try:
                        error_detail = response.json().get("detail", response.text)
                    except Exception:
                        error_detail = response.text
                    raise APIResponseError(response.status_code, error_detail)

                return response.json()

        except httpx.ConnectError:
            raise APIConnectionError("Failed to connect to SWN server")
        except httpx.TimeoutException:
            raise SWNTimeoutError("confirming upload")

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
            raise APIKeyNotFoundError()

        logger.info(f"Registering {len(clips)} clips with Backlot")

        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{self.API_BASE}/api/v1/backlot/desktop-keys/dailies/register-clips",
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

                if response.status_code == 200:
                    logger.info("Clips registered successfully")
                    return True
                else:
                    logger.error(f"Failed to register clips: {response.status_code}")
                    return False

        except Exception as e:
            logger.error(f"Error registering clips: {e}")
            return False

    # ==================== Dailies Day/Card Management ====================

    def get_dailies_days(self, project_id: str) -> List[Dict[str, Any]]:
        """Fetch all dailies days for a project.

        Uses desktop-specific endpoint that supports API key auth.

        Returns:
            List of day objects with id, label, shoot_date, etc.
        """
        api_key = self.config.get_api_key()
        if not api_key:
            raise APIKeyNotFoundError()

        try:
            with httpx.Client() as client:
                # Use desktop-specific endpoint
                response = client.get(
                    f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/dailies/days",
                    headers={
                        "X-API-Key": api_key,
                    },
                    params={"limit": 100},
                    timeout=30.0,
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to fetch dailies days: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error fetching dailies days: {e}")
            return []

    def create_dailies_day(
        self,
        project_id: str,
        label: str,
        shoot_date: str,
        unit: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Create a new dailies day.

        Uses desktop-specific endpoint that supports API key auth.

        Args:
            project_id: Project ID
            label: Day label (e.g., "Day 1", "Pick-ups")
            shoot_date: Date in YYYY-MM-DD format
            unit: Optional unit name (e.g., "Main Unit")

        Returns:
            Created day object or None on failure
        """
        api_key = self.config.get_api_key()
        if not api_key:
            raise APIKeyNotFoundError()

        logger.info(f"Creating dailies day: {label} ({shoot_date})")

        try:
            with httpx.Client() as client:
                body = {
                    "label": label,
                    "shoot_date": shoot_date,
                }
                if unit:
                    body["unit"] = unit

                # Use desktop-specific endpoint
                response = client.post(
                    f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/dailies/days",
                    headers={
                        "X-API-Key": api_key,
                        "Content-Type": "application/json",
                    },
                    json=body,
                    timeout=30.0,
                )

                if response.status_code in (200, 201):
                    day = response.json()
                    logger.info(f"Created dailies day: {day.get('id')}")
                    return day
                else:
                    logger.error(f"Failed to create dailies day: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Error creating dailies day: {e}")
            return None

    def get_dailies_cards(self, day_id: str) -> List[Dict[str, Any]]:
        """Fetch all cards for a dailies day.

        Uses desktop-specific endpoint that supports API key auth.

        Returns:
            List of card objects with id, camera_label, roll_name, etc.
        """
        api_key = self.config.get_api_key()
        if not api_key:
            raise APIKeyNotFoundError()

        try:
            with httpx.Client() as client:
                # Use desktop-specific endpoint
                response = client.get(
                    f"{self.API_BASE}/api/v1/backlot/desktop-keys/dailies/days/{day_id}/cards",
                    headers={
                        "X-API-Key": api_key,
                    },
                    params={"limit": 100},
                    timeout=30.0,
                )

                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Failed to fetch dailies cards: {response.status_code}")
                    return []

        except Exception as e:
            logger.error(f"Error fetching dailies cards: {e}")
            return []

    def create_dailies_card(
        self,
        day_id: str,
        camera_label: str,
        roll_name: str,
        storage_mode: str = "cloud",
    ) -> Optional[Dict[str, Any]]:
        """Create a new dailies card.

        Uses desktop-specific endpoint that supports API key auth.

        Args:
            day_id: Dailies day ID
            camera_label: Camera label (A, B, C)
            roll_name: Roll name (A001, B002)
            storage_mode: "cloud" or "local_drive"

        Returns:
            Created card object or None on failure
        """
        api_key = self.config.get_api_key()
        if not api_key:
            raise APIKeyNotFoundError()

        logger.info(f"Creating dailies card: {camera_label}/{roll_name}")

        try:
            with httpx.Client() as client:
                # Use desktop-specific endpoint
                response = client.post(
                    f"{self.API_BASE}/api/v1/backlot/desktop-keys/dailies/days/{day_id}/cards",
                    headers={
                        "X-API-Key": api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "camera_label": camera_label,
                        "roll_name": roll_name,
                        "storage_mode": storage_mode,
                    },
                    timeout=30.0,
                )

                if response.status_code in (200, 201):
                    card = response.json()
                    logger.info(f"Created dailies card: {card.get('id')}")
                    return card
                else:
                    logger.error(f"Failed to create dailies card: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Error creating dailies card: {e}")
            return None

    def get_or_create_card(
        self,
        day_id: str,
        camera_label: str,
        roll_name: str,
    ) -> Optional[Dict[str, Any]]:
        """Get existing card or create new one.

        Args:
            day_id: Dailies day ID
            camera_label: Camera label (A, B, C)
            roll_name: Roll name (A001, B002)

        Returns:
            Card object or None on failure
        """
        # First, try to find existing card
        cards = self.get_dailies_cards(day_id)
        for card in cards:
            if card.get("camera_label") == camera_label and card.get("roll_name") == roll_name:
                logger.info(f"Found existing card: {card.get('id')}")
                return card

        # Create new card
        return self.create_dailies_card(day_id, camera_label, roll_name)
