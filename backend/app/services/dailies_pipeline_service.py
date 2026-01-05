"""
Dailies Pipeline Service
Phase 4C: Enhanced integration between Backlot dailies and media processing.

This service provides:
- Automatic media job creation for new dailies
- Batch upload management
- Processing status tracking
- Problem asset identification
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import hashlib

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


# Processing status constants
PROCESSING_STATES = {
    'pending': 'Waiting to be processed',
    'uploading': 'Upload in progress',
    'uploaded': 'Upload complete, awaiting processing',
    'processing': 'Being processed',
    'transcoding': 'Creating proxy',
    'proxy_ready': 'Proxy available',
    'completed': 'Fully processed',
    'failed': 'Processing failed'
}


class DailiesPipelineService:
    """Service for managing the dailies processing pipeline."""

    # =========================================================================
    # Individual Dailies Management
    # =========================================================================

    @staticmethod
    async def create_dailies_record(
        project_id: str,
        filename: str,
        uploaded_by: str,
        shoot_day_id: Optional[str] = None,
        clip_name: Optional[str] = None,
        scene_number: Optional[str] = None,
        take_number: Optional[int] = None,
        camera: Optional[str] = None,
        notes: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create a new dailies record (before upload)."""
        dailies = execute_insert("""
            INSERT INTO backlot_dailies (
                project_id, shoot_day_id, filename,
                clip_name, scene_number, take_number, camera,
                notes, tags, uploaded_by,
                processing_status
            ) VALUES (
                :project_id, :shoot_day_id, :filename,
                :clip_name, :scene_number, :take_number, :camera,
                :notes, :tags, :uploaded_by,
                'pending'
            )
            RETURNING *
        """, {
            "project_id": project_id,
            "shoot_day_id": shoot_day_id,
            "filename": filename,
            "clip_name": clip_name,
            "scene_number": scene_number,
            "take_number": take_number,
            "camera": camera,
            "notes": notes,
            "tags": tags or [],
            "uploaded_by": uploaded_by
        })

        logger.info("dailies_record_created",
                   dailies_id=dailies["id"],
                   project_id=project_id)

        return dict(dailies)

    @staticmethod
    async def create_dailies_bulk(
        project_id: str,
        uploaded_by: str,
        clips: List[Dict[str, Any]],
        shoot_day_id: Optional[str] = None,
        batch_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create multiple dailies records at once (for Dailies Helper)."""
        # Create batch record
        batch = execute_insert("""
            INSERT INTO backlot_dailies_batches (
                project_id, shoot_day_id, batch_name,
                total_clips, created_by
            ) VALUES (
                :project_id, :shoot_day_id, :batch_name,
                :total, :created_by
            )
            RETURNING *
        """, {
            "project_id": project_id,
            "shoot_day_id": shoot_day_id,
            "batch_name": batch_name or f"Batch {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
            "total": len(clips),
            "created_by": uploaded_by
        })

        batch_id = batch["id"]
        created_ids = []
        sequence = 0

        for clip in clips:
            # Create dailies record
            dailies = execute_insert("""
                INSERT INTO backlot_dailies (
                    project_id, shoot_day_id, filename,
                    clip_name, scene_number, take_number, camera,
                    codec, resolution, frame_rate, duration_seconds,
                    timecode_in, timecode_out,
                    notes, tags, uploaded_by,
                    processing_status
                ) VALUES (
                    :project_id, :shoot_day_id, :filename,
                    :clip_name, :scene_number, :take_number, :camera,
                    :codec, :resolution, :frame_rate, :duration,
                    :tc_in, :tc_out,
                    :notes, :tags, :uploaded_by,
                    'pending'
                )
                RETURNING id
            """, {
                "project_id": project_id,
                "shoot_day_id": shoot_day_id,
                "filename": clip.get("filename"),
                "clip_name": clip.get("clip_name"),
                "scene_number": clip.get("scene_number"),
                "take_number": clip.get("take_number"),
                "camera": clip.get("camera"),
                "codec": clip.get("codec"),
                "resolution": clip.get("resolution"),
                "frame_rate": clip.get("frame_rate"),
                "duration": clip.get("duration_seconds"),
                "tc_in": clip.get("timecode_in"),
                "tc_out": clip.get("timecode_out"),
                "notes": clip.get("notes"),
                "tags": clip.get("tags", []),
                "uploaded_by": uploaded_by
            })

            # Link to batch
            execute_insert("""
                INSERT INTO backlot_dailies_batch_items (batch_id, dailies_id, sequence_number)
                VALUES (:batch_id, :dailies_id, :seq)
            """, {"batch_id": batch_id, "dailies_id": dailies["id"], "seq": sequence})

            created_ids.append(str(dailies["id"]))
            sequence += 1

        logger.info("dailies_bulk_created",
                   batch_id=batch_id,
                   count=len(created_ids))

        return {
            "batch_id": str(batch_id),
            "batch_name": batch["batch_name"],
            "total_clips": len(clips),
            "dailies_ids": created_ids
        }

    @staticmethod
    async def update_upload_complete(
        dailies_id: str,
        source_url: str,
        source_file_size: Optional[int] = None,
        source_file_hash: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Mark dailies upload as complete and trigger processing."""
        dailies = execute_single("""
            UPDATE backlot_dailies
            SET source_url = :source_url,
                source_file_size = :file_size,
                source_file_hash = :file_hash,
                processing_status = 'uploaded',
                updated_at = NOW()
            WHERE id = :dailies_id
            RETURNING *
        """, {
            "dailies_id": dailies_id,
            "source_url": source_url,
            "file_size": source_file_size,
            "file_hash": source_file_hash
        })

        if dailies:
            # Trigger media job creation
            await DailiesPipelineService._create_media_job(dailies)

        return dict(dailies) if dailies else None

    @staticmethod
    async def _create_media_job(dailies: Dict[str, Any]) -> Optional[str]:
        """Create a media job for processing the dailies."""
        try:
            # Check if media_jobs table exists and create job
            job = execute_insert("""
                INSERT INTO media_jobs (
                    job_type, source_url, status,
                    metadata
                ) VALUES (
                    'dailies_proxy',
                    :source_url,
                    'pending',
                    :metadata::jsonb
                )
                RETURNING id
            """, {
                "source_url": dailies.get("source_url"),
                "metadata": f'{{"dailies_id": "{dailies["id"]}", "project_id": "{dailies["project_id"]}"}}'
            })

            if job:
                # Update dailies with job reference
                execute_update("""
                    UPDATE backlot_dailies
                    SET media_job_id = :job_id,
                        processing_status = 'processing',
                        last_processing_at = NOW(),
                        processing_attempts = processing_attempts + 1
                    WHERE id = :dailies_id
                """, {"job_id": job["id"], "dailies_id": dailies["id"]})

                logger.info("dailies_media_job_created",
                           dailies_id=dailies["id"],
                           job_id=job["id"])

                return str(job["id"])
        except Exception as e:
            logger.error("dailies_media_job_failed",
                        dailies_id=dailies["id"],
                        error=str(e))

        return None

    @staticmethod
    async def update_processing_status(
        dailies_id: str,
        status: str,
        proxy_url: Optional[str] = None,
        thumbnail_url: Optional[str] = None,
        error: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update processing status (called by media job callbacks)."""
        updates = ["processing_status = :status", "updated_at = NOW()"]
        params = {"dailies_id": dailies_id, "status": status}

        if proxy_url:
            updates.append("proxy_url = :proxy_url")
            updates.append("proxy_ready_at = NOW()")
            params["proxy_url"] = proxy_url

        if thumbnail_url:
            updates.append("thumbnail_url = :thumbnail")
            params["thumbnail"] = thumbnail_url

        if error:
            updates.append("processing_error = :error")
            params["error"] = error

        if status == 'failed':
            updates.append("processing_attempts = processing_attempts + 1")

        dailies = execute_single(f"""
            UPDATE backlot_dailies
            SET {', '.join(updates)}
            WHERE id = :dailies_id
            RETURNING *
        """, params)

        if dailies:
            # Update batch status if part of batch
            await DailiesPipelineService._update_batch_status(str(dailies["id"]), status)

        return dict(dailies) if dailies else None

    @staticmethod
    async def _update_batch_status(dailies_id: str, status: str):
        """Update batch completion status."""
        batch_item = execute_single("""
            SELECT batch_id FROM backlot_dailies_batch_items
            WHERE dailies_id = :dailies_id
        """, {"dailies_id": dailies_id})

        if not batch_item:
            return

        batch_id = batch_item["batch_id"]

        # Get batch stats
        stats = execute_single("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE bd.processing_status = 'completed') as completed,
                COUNT(*) FILTER (WHERE bd.processing_status = 'failed') as failed,
                COUNT(*) FILTER (WHERE bd.processing_status IN ('proxy_ready', 'completed')) as ready
            FROM backlot_dailies_batch_items bbi
            JOIN backlot_dailies bd ON bbi.dailies_id = bd.id
            WHERE bbi.batch_id = :batch_id
        """, {"batch_id": batch_id})

        if not stats:
            return

        # Determine batch status
        batch_status = 'in_progress'
        completed_at = None

        if stats["completed"] + stats["failed"] >= stats["total"]:
            if stats["failed"] == 0:
                batch_status = 'completed'
            elif stats["completed"] == 0:
                batch_status = 'failed'
            else:
                batch_status = 'partial'
            completed_at = datetime.utcnow()

        execute_update("""
            UPDATE backlot_dailies_batches
            SET completed_clips = :completed,
                failed_clips = :failed,
                status = :status,
                completed_at = :completed_at
            WHERE id = :batch_id
        """, {
            "batch_id": batch_id,
            "completed": stats["completed"],
            "failed": stats["failed"],
            "status": batch_status,
            "completed_at": completed_at
        })

    # =========================================================================
    # Batch Management
    # =========================================================================

    @staticmethod
    async def get_batch_status(batch_id: str) -> Optional[Dict[str, Any]]:
        """Get batch status with all clip details."""
        batch = execute_single("""
            SELECT * FROM backlot_dailies_batches WHERE id = :batch_id
        """, {"batch_id": batch_id})

        if not batch:
            return None

        clips = execute_query("""
            SELECT
                bd.id,
                bd.filename,
                bd.clip_name,
                bd.processing_status,
                bd.proxy_url,
                bd.thumbnail_url,
                bd.processing_error,
                bbi.sequence_number
            FROM backlot_dailies_batch_items bbi
            JOIN backlot_dailies bd ON bbi.dailies_id = bd.id
            WHERE bbi.batch_id = :batch_id
            ORDER BY bbi.sequence_number
        """, {"batch_id": batch_id})

        return {
            "batch": dict(batch),
            "clips": [dict(c) for c in clips],
            "summary": {
                "total": len(clips),
                "completed": sum(1 for c in clips if c["processing_status"] == "completed"),
                "ready": sum(1 for c in clips if c["processing_status"] in ("proxy_ready", "completed")),
                "failed": sum(1 for c in clips if c["processing_status"] == "failed"),
                "pending": sum(1 for c in clips if c["processing_status"] in ("pending", "uploading", "uploaded"))
            }
        }

    @staticmethod
    async def get_project_batches(
        project_id: str,
        status: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get all batches for a project."""
        conditions = ["project_id = :project_id"]
        params = {"project_id": project_id, "limit": limit, "offset": offset}

        if status:
            conditions.append("status = :status")
            params["status"] = status

        where_clause = " AND ".join(conditions)

        batches = execute_query(f"""
            SELECT * FROM backlot_dailies_batches
            WHERE {where_clause}
            ORDER BY started_at DESC
            LIMIT :limit OFFSET :offset
        """, params)

        total = execute_single(f"""
            SELECT COUNT(*) as count FROM backlot_dailies_batches
            WHERE {where_clause}
        """, {k: v for k, v in params.items() if k not in ('limit', 'offset')})

        return {
            "batches": [dict(b) for b in batches],
            "total": total.get("count", 0) if total else 0,
            "limit": limit,
            "offset": offset
        }

    # =========================================================================
    # Problem Assets
    # =========================================================================

    @staticmethod
    async def get_problem_assets(
        project_id: str,
        include_stale: bool = True,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get dailies with processing issues."""
        conditions = ["project_id = :project_id"]
        params = {"project_id": project_id, "limit": limit}

        if include_stale:
            # Failed OR stale (processing for more than 1 hour)
            conditions.append("""
                (processing_status = 'failed'
                 OR (processing_status IN ('processing', 'transcoding')
                     AND last_processing_at < NOW() - INTERVAL '1 hour'))
            """)
        else:
            conditions.append("processing_status = 'failed'")

        where_clause = " AND ".join(conditions)

        assets = execute_query(f"""
            SELECT
                id,
                filename,
                clip_name,
                processing_status,
                processing_error,
                processing_attempts,
                last_processing_at,
                source_url,
                created_at
            FROM backlot_dailies
            WHERE {where_clause}
            ORDER BY last_processing_at DESC NULLS LAST
            LIMIT :limit
        """, params)

        return [dict(a) for a in assets]

    @staticmethod
    async def retry_failed_processing(dailies_id: str) -> Optional[Dict[str, Any]]:
        """Retry processing for a failed dailies clip."""
        dailies = execute_single("""
            SELECT * FROM backlot_dailies
            WHERE id = :dailies_id AND processing_status = 'failed'
        """, {"dailies_id": dailies_id})

        if not dailies:
            return None

        # Reset status and create new job
        execute_update("""
            UPDATE backlot_dailies
            SET processing_status = 'pending',
                processing_error = NULL,
                media_job_id = NULL,
                updated_at = NOW()
            WHERE id = :dailies_id
        """, {"dailies_id": dailies_id})

        # Trigger new job
        dailies["processing_status"] = "pending"
        await DailiesPipelineService._create_media_job(dailies)

        return await DailiesPipelineService.get_dailies_status(dailies_id)

    @staticmethod
    async def retry_all_failed(project_id: str) -> Dict[str, Any]:
        """Retry all failed processing for a project."""
        failed = execute_query("""
            SELECT id FROM backlot_dailies
            WHERE project_id = :project_id AND processing_status = 'failed'
        """, {"project_id": project_id})

        retried = 0
        for f in failed:
            result = await DailiesPipelineService.retry_failed_processing(str(f["id"]))
            if result:
                retried += 1

        return {
            "total_failed": len(failed),
            "retried": retried
        }

    # =========================================================================
    # Status Queries
    # =========================================================================

    @staticmethod
    async def get_dailies_status(dailies_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed status of a dailies clip."""
        dailies = execute_single("""
            SELECT
                bd.*,
                mj.status as job_status,
                mj.progress as job_progress,
                mj.error as job_error
            FROM backlot_dailies bd
            LEFT JOIN media_jobs mj ON bd.media_job_id = mj.id
            WHERE bd.id = :dailies_id
        """, {"dailies_id": dailies_id})

        return dict(dailies) if dailies else None

    @staticmethod
    async def get_project_processing_summary(project_id: str) -> Dict[str, Any]:
        """Get processing summary for a project."""
        summary = execute_single("""
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE processing_status = 'completed') as completed,
                COUNT(*) FILTER (WHERE processing_status IN ('proxy_ready', 'completed')) as ready,
                COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
                COUNT(*) FILTER (WHERE processing_status IN ('pending', 'uploading', 'uploaded')) as pending,
                COUNT(*) FILTER (WHERE processing_status IN ('processing', 'transcoding')) as processing,
                SUM(source_file_size) as total_size_bytes,
                SUM(duration_seconds) as total_duration_seconds
            FROM backlot_dailies
            WHERE project_id = :project_id
        """, {"project_id": project_id})

        return dict(summary) if summary else {
            "total": 0,
            "completed": 0,
            "ready": 0,
            "failed": 0,
            "pending": 0,
            "processing": 0
        }
