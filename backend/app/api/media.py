"""
Media API Routes

Endpoints for managing media processing jobs and uploads.
Provides job status, cancellation, and webhook callbacks.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from app.core.auth import get_current_user, get_current_user_optional
from app.core.permissions import Permission, require_permissions
from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.core.deps import get_user_profile
from app.services.media_orchestrator import (
    MediaJobOrchestrator,
    MediaJob,
    transcode_episode,
    transcode_short,
    process_daily_upload,
)

router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class JobStatusResponse(BaseModel):
    """Job status summary."""
    id: str
    status: str
    progress: int
    stage: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    output_metadata: Optional[Dict[str, Any]] = None


class JobListItem(BaseModel):
    """Job summary for list views."""
    id: str
    job_type: str
    source_type: str
    source_id: str
    status: str
    progress: int
    created_at: str


class CreateTranscodeJobRequest(BaseModel):
    """Request to create a transcoding job."""
    source_type: str  # episode, short, daily
    source_id: str
    source_bucket: str
    source_key: str
    qualities: Optional[List[str]] = None


class WorkerProgressUpdate(BaseModel):
    """Progress update from a worker."""
    job_id: str
    progress: int
    stage: Optional[str] = None


class WorkerCompletionReport(BaseModel):
    """Completion report from a worker."""
    job_id: str
    output_metadata: Dict[str, Any]
    output_bucket: Optional[str] = None
    output_key_prefix: Optional[str] = None


class WorkerFailureReport(BaseModel):
    """Failure report from a worker."""
    job_id: str
    error_code: str
    error_message: str


# =============================================================================
# User-Facing Endpoints
# =============================================================================

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    user = Depends(get_current_user)
):
    """
    Get the status of a media processing job.

    Users can only view jobs they requested.
    Admins can view all jobs.
    """
    try:
        status = await MediaJobOrchestrator.get_job_status(job_id)
        return status
    except NotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Job not found"
        )


@router.get("/jobs/source/{source_type}/{source_id}", response_model=List[JobListItem])
async def get_jobs_for_source(
    source_type: str,
    source_id: str,
    status: Optional[str] = None,
    user = Depends(get_current_user)
):
    """
    Get all jobs for a specific source record (episode, short, etc.).
    """
    jobs = await MediaJobOrchestrator.get_jobs_for_source(
        source_type=source_type,
        source_id=source_id,
        status=status,
    )

    return [
        JobListItem(
            id=job.id,
            job_type=job.job_type,
            source_type=job.source_type,
            source_id=job.source_id,
            status=job.status,
            progress=job.progress,
            created_at=job.created_at.isoformat() if job.created_at else "",
        )
        for job in jobs
    ]


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    user = Depends(get_current_user)
):
    """
    Cancel a pending or processing job.
    """
    try:
        job = await MediaJobOrchestrator.cancel_job(job_id)
        return {"message": "Job cancelled", "job_id": job.id}
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Job not found")
    except BadRequestError as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Admin Endpoints
# =============================================================================

@router.get("/admin/jobs", response_model=List[JobListItem])
async def list_all_jobs(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_CONTENT))
):
    """
    List all media jobs (admin only).
    """
    from app.core.database import execute_query

    query = "SELECT * FROM media_jobs WHERE 1=1"
    params: Dict[str, Any] = {"limit": limit, "offset": offset}

    if status:
        query += " AND status = :status"
        params["status"] = status

    if job_type:
        query += " AND job_type = :job_type"
        params["job_type"] = job_type

    query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"

    rows = await execute_query(query, params)

    return [
        JobListItem(
            id=str(row["id"]),
            job_type=row["job_type"],
            source_type=row["source_type"],
            source_id=str(row["source_id"]),
            status=row["status"],
            progress=row.get("progress", 0),
            created_at=row["created_at"].isoformat() if row.get("created_at") else "",
        )
        for row in rows
    ]


@router.get("/admin/jobs/stats")
async def get_job_stats(
    profile: Dict[str, Any] = Depends(require_permissions(Permission.ADMIN_ANALYTICS))
):
    """
    Get job statistics for monitoring (admin only).
    """
    from app.core.database import execute_query

    query = """
        SELECT
            job_type,
            status,
            COUNT(*) as count,
            AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds
        FROM media_jobs
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY job_type, status
        ORDER BY job_type, status
    """

    rows = await execute_query(query, {})

    return {
        "stats": [
            {
                "job_type": row["job_type"],
                "status": row["status"],
                "count": row["count"],
                "avg_duration_seconds": round(row["avg_duration_seconds"] or 0, 2),
            }
            for row in rows
        ]
    }


# =============================================================================
# Worker Callback Endpoints
# =============================================================================
# These endpoints are called by FFmpeg workers to report progress and completion.
# They should be protected by API key or internal network access.

@router.post("/worker/progress")
async def worker_progress_update(
    update: WorkerProgressUpdate,
):
    """
    Update job progress (called by workers).

    Note: In production, this should be protected by API key authentication.
    """
    await MediaJobOrchestrator.update_progress(
        job_id=update.job_id,
        progress=update.progress,
        stage=update.stage,
    )
    return {"status": "ok"}


@router.post("/worker/complete")
async def worker_complete_job(
    report: WorkerCompletionReport,
):
    """
    Mark job as completed (called by workers).

    Note: In production, this should be protected by API key authentication.
    """
    job = await MediaJobOrchestrator.complete_job(
        job_id=report.job_id,
        output_metadata=report.output_metadata,
        output_bucket=report.output_bucket,
        output_key_prefix=report.output_key_prefix,
    )
    return {"status": "ok", "job_id": job.id}


@router.post("/worker/fail")
async def worker_fail_job(
    report: WorkerFailureReport,
):
    """
    Mark job as failed (called by workers).

    Note: In production, this should be protected by API key authentication.
    """
    job = await MediaJobOrchestrator.fail_job(
        job_id=report.job_id,
        error_code=report.error_code,
        error_message=report.error_message,
    )
    return {"status": "ok", "job_id": job.id, "job_status": job.status}


# =============================================================================
# Internal Trigger Endpoints
# =============================================================================
# These are called by other parts of the system to trigger processing.

@router.post("/internal/transcode-episode")
async def trigger_episode_transcode(
    request: CreateTranscodeJobRequest,
    user = Depends(get_current_user),
):
    """
    Trigger transcoding for an episode.

    Called after episode video upload is complete.
    """
    job = await transcode_episode(
        world_id="",  # Will be resolved from episode
        episode_id=request.source_id,
        source_bucket=request.source_bucket,
        source_key=request.source_key,
        qualities=request.qualities,
        requested_by=user.get("id"),
    )

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Transcoding job created",
    }


@router.post("/internal/transcode-short")
async def trigger_short_transcode(
    request: CreateTranscodeJobRequest,
    user = Depends(get_current_user),
):
    """
    Trigger transcoding for a Short.
    """
    job = await transcode_short(
        short_id=request.source_id,
        source_bucket=request.source_bucket,
        source_key=request.source_key,
        requested_by=user.get("id"),
    )

    return {
        "job_id": job.id,
        "status": job.status,
        "message": "Short transcoding job created",
    }


@router.post("/internal/process-daily")
async def trigger_daily_processing(
    project_id: str,
    shoot_day_id: str,
    clip_id: str,
    source_bucket: str,
    source_key: str,
    user = Depends(get_current_user),
):
    """
    Trigger all processing jobs for a Backlot daily upload.

    Creates thumbnail and proxy generation jobs.
    """
    jobs = await process_daily_upload(
        project_id=project_id,
        shoot_day_id=shoot_day_id,
        clip_id=clip_id,
        source_bucket=source_bucket,
        source_key=source_key,
        requested_by=user.get("id"),
    )

    return {
        "jobs": [
            {"job_id": job.id, "job_type": job.job_type, "status": job.status}
            for job in jobs
        ],
        "message": f"Created {len(jobs)} processing jobs",
    }
