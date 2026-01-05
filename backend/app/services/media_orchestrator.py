"""
Media Job Orchestrator

Centralized service for creating, monitoring, and managing media processing jobs.
This orchestrator handles job lifecycle from creation through completion or failure.

Usage:
    from app.services.media_orchestrator import MediaJobOrchestrator

    # Create a transcoding job
    job = await MediaJobOrchestrator.create_transcode_job(
        source_type="episode",
        source_id=episode_id,
        source_bucket="swn-video-masters",
        source_key="worlds/abc/episodes/123/master/video.mp4",
        requested_by=user_id,
        qualities=["1080p", "720p", "480p"]
    )

    # Check job status
    status = await MediaJobOrchestrator.get_job_status(job.id)

    # Complete a job (called by workers)
    await MediaJobOrchestrator.complete_job(
        job_id=job.id,
        output_metadata={"manifest_url": "...", "duration": 123.45}
    )
"""
import json
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Literal
from dataclasses import dataclass, asdict

from app.core.database import get_client, execute_query, execute_single
from app.core.enums import MediaJobStatus, MediaJobType
from app.core.storage import S3PathBuilder
from app.core.logging import get_logger
from app.core.exceptions import NotFoundError, BadRequestError

logger = get_logger(__name__)


# Type aliases
SourceType = Literal["episode", "short", "daily", "asset"]
JobType = Literal[
    "transcode_hls",
    "generate_proxy",
    "generate_thumbnail",
    "generate_waveform",
    "extract_audio",
    "concat_videos",
    "transcode_short"
]


@dataclass
class MediaJob:
    """Represents a media processing job."""
    id: str
    job_type: str
    source_type: str
    source_id: str
    source_bucket: str
    source_key: str
    status: str
    progress: int
    stage: Optional[str]
    config: Dict[str, Any]
    output_metadata: Optional[Dict[str, Any]]
    error_code: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "MediaJob":
        """Create MediaJob from database row."""
        return cls(
            id=str(row["id"]),
            job_type=row["job_type"],
            source_type=row["source_type"],
            source_id=str(row["source_id"]),
            source_bucket=row["source_bucket"],
            source_key=row["source_key"],
            status=row["status"],
            progress=row.get("progress", 0),
            stage=row.get("stage"),
            config=row.get("config", {}),
            output_metadata=row.get("output_metadata"),
            error_code=row.get("error_code"),
            error_message=row.get("error_message"),
            created_at=row["created_at"],
            started_at=row.get("started_at"),
            completed_at=row.get("completed_at"),
        )


class MediaJobOrchestrator:
    """
    Orchestrates media processing jobs.

    Responsibilities:
    - Creating jobs with proper configuration
    - Queuing jobs (optionally via SQS)
    - Tracking job status
    - Handling completion callbacks
    - Managing retries
    """

    # Default transcoding configurations
    DEFAULT_HLS_QUALITIES = ["1080p", "720p", "480p"]
    DEFAULT_SHORT_QUALITIES = ["1080p", "720p"]
    DEFAULT_SEGMENT_DURATION = 6

    # Priority levels
    PRIORITY_LOW = 0
    PRIORITY_NORMAL = 10
    PRIORITY_HIGH = 50
    PRIORITY_URGENT = 100

    @classmethod
    async def create_job(
        cls,
        job_type: JobType,
        source_type: SourceType,
        source_id: str,
        source_bucket: str,
        source_key: str,
        config: Optional[Dict[str, Any]] = None,
        output_bucket: Optional[str] = None,
        output_key_prefix: Optional[str] = None,
        priority: int = 10,
        requested_by: Optional[str] = None,
        callback_url: Optional[str] = None,
        callback_payload: Optional[Dict[str, Any]] = None,
    ) -> MediaJob:
        """
        Create a new media processing job.

        Args:
            job_type: Type of processing to perform
            source_type: Type of source content (episode, short, daily, asset)
            source_id: ID of the source record
            source_bucket: S3 bucket containing source file
            source_key: S3 key of source file
            config: Job-specific configuration
            output_bucket: S3 bucket for outputs (auto-determined if not provided)
            output_key_prefix: Base path for outputs (auto-determined if not provided)
            priority: Job priority (higher = more urgent)
            requested_by: User ID who requested this job
            callback_url: Optional webhook URL for completion notification
            callback_payload: Data to include in callback

        Returns:
            Created MediaJob instance
        """
        job_id = str(uuid.uuid4())

        # Build insert query
        query = """
            INSERT INTO media_jobs (
                id, job_type, source_type, source_id,
                source_bucket, source_key,
                output_bucket, output_key_prefix,
                config, priority, requested_by,
                callback_url, callback_payload,
                status
            ) VALUES (
                :id, :job_type, :source_type, :source_id,
                :source_bucket, :source_key,
                :output_bucket, :output_key_prefix,
                :config, :priority, :requested_by,
                :callback_url, :callback_payload,
                'queued'
            )
            RETURNING *
        """

        params = {
            "id": job_id,
            "job_type": job_type,
            "source_type": source_type,
            "source_id": source_id,
            "source_bucket": source_bucket,
            "source_key": source_key,
            "output_bucket": output_bucket,
            "output_key_prefix": output_key_prefix,
            "config": json.dumps(config or {}),
            "priority": priority,
            "requested_by": requested_by,
            "callback_url": callback_url,
            "callback_payload": json.dumps(callback_payload) if callback_payload else None,
        }

        row = await execute_single(query, params)

        logger.info(
            f"Created media job {job_id}",
            extra={
                "job_id": job_id,
                "job_type": job_type,
                "source_type": source_type,
                "source_id": source_id,
            }
        )

        return MediaJob.from_row(row)

    @classmethod
    async def create_transcode_job(
        cls,
        source_type: SourceType,
        source_id: str,
        source_bucket: str,
        source_key: str,
        qualities: Optional[List[str]] = None,
        segment_duration: int = 6,
        priority: int = 10,
        requested_by: Optional[str] = None,
    ) -> MediaJob:
        """
        Create an HLS transcoding job with standard configuration.

        Args:
            source_type: Type of content (episode, short, daily)
            source_id: ID of the source record
            source_bucket: S3 bucket with source video
            source_key: S3 key of source video
            qualities: List of quality levels (default: 1080p, 720p, 480p)
            segment_duration: HLS segment length in seconds
            priority: Job priority
            requested_by: User who requested the transcode

        Returns:
            Created MediaJob instance
        """
        config = {
            "qualities": qualities or cls.DEFAULT_HLS_QUALITIES,
            "segment_duration": segment_duration,
        }

        return await cls.create_job(
            job_type="transcode_hls",
            source_type=source_type,
            source_id=source_id,
            source_bucket=source_bucket,
            source_key=source_key,
            config=config,
            priority=priority,
            requested_by=requested_by,
        )

    @classmethod
    async def create_thumbnail_job(
        cls,
        source_type: SourceType,
        source_id: str,
        source_bucket: str,
        source_key: str,
        timestamp_seconds: float = 5.0,
        width: int = 640,
        requested_by: Optional[str] = None,
    ) -> MediaJob:
        """
        Create a thumbnail generation job.

        Args:
            source_type: Type of content
            source_id: ID of the source record
            source_bucket: S3 bucket with source video
            source_key: S3 key of source video
            timestamp_seconds: Time offset for thumbnail extraction
            width: Output thumbnail width (height auto-calculated)
            requested_by: User who requested the thumbnail

        Returns:
            Created MediaJob instance
        """
        config = {
            "timestamp_seconds": timestamp_seconds,
            "width": width,
        }

        return await cls.create_job(
            job_type="generate_thumbnail",
            source_type=source_type,
            source_id=source_id,
            source_bucket=source_bucket,
            source_key=source_key,
            config=config,
            priority=cls.PRIORITY_NORMAL,
            requested_by=requested_by,
        )

    @classmethod
    async def create_proxy_job(
        cls,
        source_type: SourceType,
        source_id: str,
        source_bucket: str,
        source_key: str,
        width: int = 960,
        crf: int = 28,
        requested_by: Optional[str] = None,
    ) -> MediaJob:
        """
        Create a low-res proxy generation job for Backlot editing.

        Args:
            source_type: Type of content
            source_id: ID of the source record
            source_bucket: S3 bucket with source video
            source_key: S3 key of source video
            width: Proxy width (height auto-calculated)
            crf: FFmpeg CRF value (higher = more compression)
            requested_by: User who requested the proxy

        Returns:
            Created MediaJob instance
        """
        config = {
            "width": width,
            "crf": crf,
        }

        return await cls.create_job(
            job_type="generate_proxy",
            source_type=source_type,
            source_id=source_id,
            source_bucket=source_bucket,
            source_key=source_key,
            config=config,
            priority=cls.PRIORITY_NORMAL,
            requested_by=requested_by,
        )

    @classmethod
    async def get_job(cls, job_id: str) -> MediaJob:
        """
        Get a job by ID.

        Args:
            job_id: Job UUID

        Returns:
            MediaJob instance

        Raises:
            NotFoundError: If job not found
        """
        query = "SELECT * FROM media_jobs WHERE id = :job_id"
        row = await execute_single(query, {"job_id": job_id})

        if not row:
            raise NotFoundError(f"Media job not found: {job_id}", code="JOB_NOT_FOUND")

        return MediaJob.from_row(row)

    @classmethod
    async def get_job_status(cls, job_id: str) -> Dict[str, Any]:
        """
        Get job status summary.

        Returns:
            Dict with status, progress, stage, error info
        """
        job = await cls.get_job(job_id)

        return {
            "id": job.id,
            "status": job.status,
            "progress": job.progress,
            "stage": job.stage,
            "error_code": job.error_code,
            "error_message": job.error_message,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "output_metadata": job.output_metadata,
        }

    @classmethod
    async def get_jobs_for_source(
        cls,
        source_type: SourceType,
        source_id: str,
        status: Optional[str] = None,
    ) -> List[MediaJob]:
        """
        Get all jobs for a source record.

        Args:
            source_type: Type of source (episode, short, etc.)
            source_id: ID of the source record
            status: Optional filter by status

        Returns:
            List of MediaJob instances
        """
        query = """
            SELECT * FROM media_jobs
            WHERE source_type = :source_type
            AND source_id = :source_id
        """
        params = {"source_type": source_type, "source_id": source_id}

        if status:
            query += " AND status = :status"
            params["status"] = status

        query += " ORDER BY created_at DESC"

        rows = await execute_query(query, params)
        return [MediaJob.from_row(row) for row in rows]

    @classmethod
    async def update_progress(
        cls,
        job_id: str,
        progress: int,
        stage: Optional[str] = None,
    ) -> None:
        """
        Update job progress (called by workers).

        Args:
            job_id: Job UUID
            progress: Progress percentage (0-100)
            stage: Optional current stage name
        """
        query = """
            UPDATE media_jobs
            SET progress = :progress
        """
        params = {"job_id": job_id, "progress": min(100, max(0, progress))}

        if stage:
            query += ", stage = :stage"
            params["stage"] = stage

        query += " WHERE id = :job_id"

        await execute_query(query, params)

    @classmethod
    async def complete_job(
        cls,
        job_id: str,
        output_metadata: Dict[str, Any],
        output_bucket: Optional[str] = None,
        output_key_prefix: Optional[str] = None,
    ) -> MediaJob:
        """
        Mark a job as completed (called by workers).

        Args:
            job_id: Job UUID
            output_metadata: Processing results (manifest URL, duration, etc.)
            output_bucket: S3 bucket where outputs were written
            output_key_prefix: Base path where outputs were written

        Returns:
            Updated MediaJob instance
        """
        query = """
            UPDATE media_jobs
            SET status = 'completed',
                completed_at = NOW(),
                progress = 100,
                output_metadata = :output_metadata,
                output_bucket = COALESCE(:output_bucket, output_bucket),
                output_key_prefix = COALESCE(:output_key_prefix, output_key_prefix)
            WHERE id = :job_id
            RETURNING *
        """

        row = await execute_single(query, {
            "job_id": job_id,
            "output_metadata": json.dumps(output_metadata),
            "output_bucket": output_bucket,
            "output_key_prefix": output_key_prefix,
        })

        logger.info(
            f"Completed media job {job_id}",
            extra={"job_id": job_id, "output_metadata": output_metadata}
        )

        job = MediaJob.from_row(row)

        # Trigger callback if configured
        await cls._trigger_callback(job)

        return job

    @classmethod
    async def fail_job(
        cls,
        job_id: str,
        error_code: str,
        error_message: str,
    ) -> MediaJob:
        """
        Mark a job as failed with retry logic.

        Args:
            job_id: Job UUID
            error_code: Structured error code
            error_message: Human-readable error

        Returns:
            Updated MediaJob instance (may be retrying or failed)
        """
        # Get current job state
        job = await cls.get_job(job_id)

        if job.config.get("max_attempts", 3) > (job.config.get("attempts", 0) + 1):
            # Schedule retry with exponential backoff
            attempts = job.config.get("attempts", 0) + 1
            backoff_minutes = 2 ** (attempts - 1)

            query = """
                UPDATE media_jobs
                SET status = 'retrying',
                    error_code = :error_code,
                    error_message = :error_message,
                    last_error_at = NOW(),
                    next_retry_at = NOW() + INTERVAL '1 minute' * :backoff,
                    worker_id = NULL,
                    config = config || :attempts_update
                WHERE id = :job_id
                RETURNING *
            """

            row = await execute_single(query, {
                "job_id": job_id,
                "error_code": error_code,
                "error_message": error_message,
                "backoff": backoff_minutes,
                "attempts_update": json.dumps({"attempts": attempts}),
            })

            logger.warning(
                f"Media job {job_id} failed, scheduling retry",
                extra={
                    "job_id": job_id,
                    "error_code": error_code,
                    "attempt": attempts,
                }
            )
        else:
            # Max retries exceeded
            query = """
                UPDATE media_jobs
                SET status = 'failed',
                    error_code = :error_code,
                    error_message = :error_message,
                    last_error_at = NOW()
                WHERE id = :job_id
                RETURNING *
            """

            row = await execute_single(query, {
                "job_id": job_id,
                "error_code": error_code,
                "error_message": error_message,
            })

            logger.error(
                f"Media job {job_id} failed permanently",
                extra={
                    "job_id": job_id,
                    "error_code": error_code,
                    "error_message": error_message,
                }
            )

        return MediaJob.from_row(row)

    @classmethod
    async def cancel_job(cls, job_id: str) -> MediaJob:
        """
        Cancel a queued or processing job.

        Args:
            job_id: Job UUID

        Returns:
            Updated MediaJob instance

        Raises:
            BadRequestError: If job cannot be cancelled
        """
        job = await cls.get_job(job_id)

        if job.status not in ("queued", "processing", "retrying"):
            raise BadRequestError(
                f"Cannot cancel job in {job.status} status",
                code="INVALID_JOB_STATE"
            )

        query = """
            UPDATE media_jobs
            SET status = 'cancelled'
            WHERE id = :job_id
            RETURNING *
        """

        row = await execute_single(query, {"job_id": job_id})

        logger.info(f"Cancelled media job {job_id}")

        return MediaJob.from_row(row)

    @classmethod
    async def get_pending_jobs(
        cls,
        job_types: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[MediaJob]:
        """
        Get pending jobs ready for processing.

        Args:
            job_types: Optional filter by job types
            limit: Maximum jobs to return

        Returns:
            List of pending MediaJob instances
        """
        query = """
            SELECT * FROM media_jobs
            WHERE status = 'queued'
        """
        params: Dict[str, Any] = {"limit": limit}

        if job_types:
            query += " AND job_type = ANY(:job_types)"
            params["job_types"] = job_types

        query += " ORDER BY priority DESC, created_at ASC LIMIT :limit"

        rows = await execute_query(query, params)
        return [MediaJob.from_row(row) for row in rows]

    @classmethod
    async def _trigger_callback(cls, job: MediaJob) -> None:
        """
        Trigger completion callback if configured.

        This is called automatically when a job completes.
        """
        # Callback implementation would go here
        # Could use httpx to POST to callback_url
        pass


# Convenience functions for common patterns
async def transcode_episode(
    world_id: str,
    episode_id: str,
    source_bucket: str,
    source_key: str,
    qualities: Optional[List[str]] = None,
    requested_by: Optional[str] = None,
) -> MediaJob:
    """
    Create a transcoding job for a World episode.

    This is a convenience wrapper that sets up proper output paths.
    """
    return await MediaJobOrchestrator.create_transcode_job(
        source_type="episode",
        source_id=episode_id,
        source_bucket=source_bucket,
        source_key=source_key,
        qualities=qualities,
        requested_by=requested_by,
    )


async def transcode_short(
    short_id: str,
    source_bucket: str,
    source_key: str,
    requested_by: Optional[str] = None,
) -> MediaJob:
    """
    Create a transcoding job for a Short.

    Uses optimized settings for vertical short-form content.
    """
    return await MediaJobOrchestrator.create_job(
        job_type="transcode_short",
        source_type="short",
        source_id=short_id,
        source_bucket=source_bucket,
        source_key=source_key,
        config={
            "qualities": ["1080p", "720p"],
            "segment_duration": 2,  # Shorter segments for shorts
            "optimize_for_mobile": True,
        },
        priority=MediaJobOrchestrator.PRIORITY_HIGH,
        requested_by=requested_by,
    )


async def process_daily_upload(
    project_id: str,
    shoot_day_id: str,
    clip_id: str,
    source_bucket: str,
    source_key: str,
    requested_by: Optional[str] = None,
) -> List[MediaJob]:
    """
    Create all processing jobs for a Backlot daily upload.

    Creates:
    - Thumbnail generation
    - Proxy generation

    Returns:
        List of created MediaJob instances
    """
    jobs = []

    # Generate thumbnail
    thumbnail_job = await MediaJobOrchestrator.create_thumbnail_job(
        source_type="daily",
        source_id=clip_id,
        source_bucket=source_bucket,
        source_key=source_key,
        timestamp_seconds=2.0,
        requested_by=requested_by,
    )
    jobs.append(thumbnail_job)

    # Generate proxy
    proxy_job = await MediaJobOrchestrator.create_proxy_job(
        source_type="daily",
        source_id=clip_id,
        source_bucket=source_bucket,
        source_key=source_key,
        requested_by=requested_by,
    )
    jobs.append(proxy_job)

    return jobs
