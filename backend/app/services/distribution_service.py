"""
Distribution Service
Phase 5A: Third-party distribution and export pipeline management.

This service provides:
- Distribution policy management
- Export job creation and tracking
- Platform template management
- Rights/availability validation
- Export artifact handling
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


# Export status constants
class ExportStatus:
    PENDING = "pending"
    VALIDATING = "validating"
    PREPARING = "preparing"
    ENCODING = "encoding"
    PACKAGING = "packaging"
    UPLOADING = "uploading"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Distribution policy constants
class DistributionPolicy:
    INTERNAL_ONLY = "internal_only"
    INTERNAL_PLUS_THIRD_PARTY = "internal_plus_third_party"
    OPEN_EXPORT = "open_export"


class DistributionService:
    """Service for managing content distribution and exports."""

    # =========================================================================
    # Distribution Policy Management
    # =========================================================================

    @staticmethod
    async def get_distribution_policy(world_id: str) -> Optional[Dict[str, Any]]:
        """Get distribution policy for a World."""
        policy = execute_single("""
            SELECT
                wdp.*,
                w.title as world_title,
                w.status as world_status,
                w.creator_id,
                w.organization_id
            FROM world_distribution_policies wdp
            JOIN worlds w ON wdp.world_id = w.id
            WHERE wdp.world_id = :world_id
        """, {"world_id": world_id})

        if policy:
            return dict(policy)

        # Return default policy info if none set
        world = execute_single("""
            SELECT id, title, status, creator_id, organization_id
            FROM worlds WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            return None

        return {
            "world_id": world_id,
            "world_title": world["title"],
            "world_status": world["status"],
            "distribution_policy": DistributionPolicy.INTERNAL_ONLY,
            "allowed_platforms": [],
            "export_requirements": {},
            "is_default": True
        }

    @staticmethod
    async def set_distribution_policy(
        world_id: str,
        user_id: str,
        distribution_policy: str,
        allowed_platforms: Optional[List[str]] = None,
        export_requirements: Optional[Dict[str, Any]] = None,
        exclusivity_overrides: Optional[Dict[str, Any]] = None,
        third_party_revenue_share_pct: float = 0,
        requires_org_approval: bool = False,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update distribution policy for a World."""
        # Check if policy exists
        existing = execute_single("""
            SELECT id FROM world_distribution_policies WHERE world_id = :world_id
        """, {"world_id": world_id})

        if existing:
            execute_update("""
                UPDATE world_distribution_policies
                SET distribution_policy = :policy::distribution_policy,
                    allowed_platforms = :platforms::jsonb,
                    export_requirements = :requirements::jsonb,
                    exclusivity_overrides = :overrides::jsonb,
                    third_party_revenue_share_pct = :revenue_share,
                    requires_org_approval = :requires_approval,
                    notes = :notes,
                    updated_at = NOW()
                WHERE world_id = :world_id
            """, {
                "world_id": world_id,
                "policy": distribution_policy,
                "platforms": allowed_platforms or [],
                "requirements": export_requirements or {},
                "overrides": exclusivity_overrides or {},
                "revenue_share": third_party_revenue_share_pct,
                "requires_approval": requires_org_approval,
                "notes": notes
            })

            logger.info("distribution_policy_updated", world_id=world_id)
            return {"success": True, "action": "updated"}

        execute_insert("""
            INSERT INTO world_distribution_policies (
                world_id, distribution_policy, allowed_platforms,
                export_requirements, exclusivity_overrides,
                third_party_revenue_share_pct, requires_org_approval,
                notes, created_by
            ) VALUES (
                :world_id, :policy::distribution_policy, :platforms::jsonb,
                :requirements::jsonb, :overrides::jsonb,
                :revenue_share, :requires_approval,
                :notes, :created_by
            )
        """, {
            "world_id": world_id,
            "policy": distribution_policy,
            "platforms": allowed_platforms or [],
            "requirements": export_requirements or {},
            "overrides": exclusivity_overrides or {},
            "revenue_share": third_party_revenue_share_pct,
            "requires_approval": requires_org_approval,
            "notes": notes,
            "created_by": user_id
        })

        logger.info("distribution_policy_created", world_id=world_id)
        return {"success": True, "action": "created"}

    # =========================================================================
    # Platform Templates
    # =========================================================================

    @staticmethod
    async def get_platform_templates(
        platform_type: Optional[str] = None,
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Get available export platform templates."""
        query = """
            SELECT * FROM export_platform_templates
            WHERE 1=1
        """
        params = {}

        if active_only:
            query += " AND is_active = true"

        if platform_type:
            query += " AND platform_type = :platform_type::export_platform_type"
            params["platform_type"] = platform_type

        query += " ORDER BY platform_type, platform_name"

        templates = execute_query(query, params)
        return [dict(t) for t in templates]

    @staticmethod
    async def get_platform_template(platform_key: str) -> Optional[Dict[str, Any]]:
        """Get a specific platform template by key."""
        template = execute_single("""
            SELECT * FROM export_platform_templates
            WHERE platform_key = :platform_key
        """, {"platform_key": platform_key})

        return dict(template) if template else None

    # =========================================================================
    # Export Validation
    # =========================================================================

    @staticmethod
    async def validate_export_request(
        world_id: str,
        platform_key: str,
        episode_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate if an export request can proceed."""
        # Use database function for comprehensive check
        result = execute_single("""
            SELECT can_export_world(:world_id, :platform_key, NOW()) as validation
        """, {"world_id": world_id, "platform_key": platform_key})

        if not result:
            return {"allowed": False, "reason": "Validation failed"}

        validation = result["validation"]

        # Additional episode-level checks
        if episode_id:
            episode = execute_single("""
                SELECT id, status, visibility
                FROM episodes
                WHERE id = :episode_id AND world_id = :world_id
            """, {"episode_id": episode_id, "world_id": world_id})

            if not episode:
                return {"allowed": False, "reason": "Episode not found"}

            if episode["status"] != "published":
                return {"allowed": False, "reason": "Episode is not published"}

        return validation

    # =========================================================================
    # Export Job Management
    # =========================================================================

    @staticmethod
    async def create_export_job(
        world_id: str,
        platform_key: str,
        requested_by: str,
        episode_id: Optional[str] = None,
        export_config: Optional[Dict[str, Any]] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new export job."""
        # Validate first
        validation = await DistributionService.validate_export_request(
            world_id, platform_key, episode_id
        )

        if not validation.get("allowed"):
            return {
                "success": False,
                "error": validation.get("reason", "Export not allowed")
            }

        # Get platform template
        template = await DistributionService.get_platform_template(platform_key)
        if not template:
            return {"success": False, "error": f"Unknown platform: {platform_key}"}

        # Merge export config with template defaults
        final_config = {
            **(template.get("delivery_specs") or {}),
            **(export_config or {})
        }

        # Check if approval is required
        requires_approval = validation.get("requires_org_approval", False)

        # Create the job
        job = execute_insert("""
            INSERT INTO export_jobs (
                world_id, episode_id, platform_template_id, platform_key,
                export_config, status, requested_by, organization_id,
                requires_approval, validation_results, validation_passed
            ) VALUES (
                :world_id, :episode_id, :template_id, :platform_key,
                :config::jsonb, :status::export_status, :requested_by, :org_id,
                :requires_approval, :validation::jsonb, true
            )
            RETURNING *
        """, {
            "world_id": world_id,
            "episode_id": episode_id,
            "template_id": template["id"],
            "platform_key": platform_key,
            "config": final_config,
            "status": ExportStatus.PENDING if not requires_approval else ExportStatus.PENDING,
            "requested_by": requested_by,
            "org_id": organization_id,
            "requires_approval": requires_approval,
            "validation": validation
        })

        logger.info("export_job_created",
                   job_id=str(job["id"]),
                   world_id=world_id,
                   platform=platform_key)

        return {
            "success": True,
            "job_id": str(job["id"]),
            "status": job["status"],
            "requires_approval": requires_approval,
            "platform": platform_key
        }

    @staticmethod
    async def get_export_job(job_id: str) -> Optional[Dict[str, Any]]:
        """Get export job details."""
        job = execute_single("""
            SELECT
                ej.*,
                w.title as world_title,
                e.title as episode_title,
                ept.platform_name,
                ept.platform_type,
                p.display_name as requester_name
            FROM export_jobs ej
            JOIN worlds w ON ej.world_id = w.id
            LEFT JOIN episodes e ON ej.episode_id = e.id
            LEFT JOIN export_platform_templates ept ON ej.platform_template_id = ept.id
            JOIN profiles p ON ej.requested_by = p.id
            WHERE ej.id = :job_id
        """, {"job_id": job_id})

        if not job:
            return None

        result = dict(job)

        # Get artifacts
        artifacts = execute_query("""
            SELECT * FROM export_artifacts
            WHERE export_job_id = :job_id
            ORDER BY is_primary DESC, created_at
        """, {"job_id": job_id})

        result["artifacts"] = [dict(a) for a in artifacts]

        # Get history
        history = execute_query("""
            SELECT * FROM export_job_history
            WHERE export_job_id = :job_id
            ORDER BY changed_at DESC
        """, {"job_id": job_id})

        result["history"] = [dict(h) for h in history]

        return result

    @staticmethod
    async def get_world_export_history(
        world_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get export history for a World."""
        jobs = execute_query("""
            SELECT
                ej.id as job_id,
                ej.episode_id,
                e.title as episode_title,
                ej.platform_key,
                ept.platform_name,
                ej.status,
                ej.progress_pct,
                ej.requested_at,
                ej.completed_at,
                ej.error_message,
                p.display_name as requester_name,
                (SELECT COUNT(*) FROM export_artifacts WHERE export_job_id = ej.id) as artifact_count
            FROM export_jobs ej
            LEFT JOIN episodes e ON ej.episode_id = e.id
            LEFT JOIN export_platform_templates ept ON ej.platform_template_id = ept.id
            JOIN profiles p ON ej.requested_by = p.id
            WHERE ej.world_id = :world_id
            ORDER BY ej.requested_at DESC
            LIMIT :limit OFFSET :offset
        """, {"world_id": world_id, "limit": limit, "offset": offset})

        return [dict(j) for j in jobs]

    @staticmethod
    async def update_export_status(
        job_id: str,
        status: str,
        progress_pct: Optional[int] = None,
        status_message: Optional[str] = None,
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update export job status."""
        updates = ["status = :status::export_status", "updated_at = NOW()"]
        params = {"job_id": job_id, "status": status}

        if progress_pct is not None:
            updates.append("progress_pct = :progress")
            params["progress_pct"] = progress_pct

        if status_message:
            updates.append("status_message = :message")
            params["message"] = status_message

        if error_message:
            updates.append("error_message = :error")
            params["error"] = error_message

        if status == ExportStatus.ENCODING:
            updates.append("started_at = COALESCE(started_at, NOW())")

        if status == ExportStatus.COMPLETED:
            updates.append("completed_at = NOW()")
            updates.append("progress_pct = 100")

        if status == ExportStatus.FAILED:
            updates.append("completed_at = NOW()")

        execute_update(f"""
            UPDATE export_jobs
            SET {', '.join(updates)}
            WHERE id = :job_id
        """, params)

        logger.info("export_status_updated",
                   job_id=job_id,
                   status=status)

        return {"success": True}

    @staticmethod
    async def cancel_export_job(job_id: str, user_id: str) -> Dict[str, Any]:
        """Cancel a pending or in-progress export job."""
        job = execute_single("""
            SELECT id, status, requested_by FROM export_jobs WHERE id = :job_id
        """, {"job_id": job_id})

        if not job:
            return {"success": False, "error": "Job not found"}

        if job["status"] in (ExportStatus.COMPLETED, ExportStatus.FAILED, ExportStatus.CANCELLED):
            return {"success": False, "error": f"Cannot cancel job in status: {job['status']}"}

        execute_update("""
            UPDATE export_jobs
            SET status = 'cancelled'::export_status,
                status_message = 'Cancelled by user',
                completed_at = NOW(),
                updated_at = NOW()
            WHERE id = :job_id
        """, {"job_id": job_id})

        logger.info("export_job_cancelled", job_id=job_id, cancelled_by=user_id)

        return {"success": True}

    @staticmethod
    async def approve_export_job(job_id: str, approver_id: str) -> Dict[str, Any]:
        """Approve an export job that requires approval."""
        job = execute_single("""
            SELECT id, status, requires_approval, approved_at
            FROM export_jobs WHERE id = :job_id
        """, {"job_id": job_id})

        if not job:
            return {"success": False, "error": "Job not found"}

        if not job["requires_approval"]:
            return {"success": False, "error": "Job does not require approval"}

        if job["approved_at"]:
            return {"success": False, "error": "Job already approved"}

        execute_update("""
            UPDATE export_jobs
            SET approved_at = NOW(),
                approved_by = :approver_id,
                updated_at = NOW()
            WHERE id = :job_id
        """, {"job_id": job_id, "approver_id": approver_id})

        logger.info("export_job_approved", job_id=job_id, approved_by=approver_id)

        return {"success": True}

    # =========================================================================
    # Export Artifacts
    # =========================================================================

    @staticmethod
    async def add_export_artifact(
        job_id: str,
        artifact_type: str,
        filename: str,
        s3_bucket: str,
        s3_key: str,
        file_size_bytes: Optional[int] = None,
        checksum_md5: Optional[str] = None,
        checksum_sha256: Optional[str] = None,
        technical_metadata: Optional[Dict[str, Any]] = None,
        is_primary: bool = False,
        expires_at: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Add an artifact to an export job."""
        artifact = execute_insert("""
            INSERT INTO export_artifacts (
                export_job_id, artifact_type, filename,
                s3_bucket, s3_key, file_size_bytes,
                checksum_md5, checksum_sha256,
                technical_metadata, is_primary, expires_at
            ) VALUES (
                :job_id, :type, :filename,
                :bucket, :key, :size,
                :md5, :sha256,
                :metadata::jsonb, :primary, :expires
            )
            RETURNING *
        """, {
            "job_id": job_id,
            "type": artifact_type,
            "filename": filename,
            "bucket": s3_bucket,
            "key": s3_key,
            "size": file_size_bytes,
            "md5": checksum_md5,
            "sha256": checksum_sha256,
            "metadata": technical_metadata or {},
            "primary": is_primary,
            "expires": expires_at
        })

        return {"success": True, "artifact_id": str(artifact["id"])}

    @staticmethod
    async def get_export_artifacts(job_id: str) -> List[Dict[str, Any]]:
        """Get all artifacts for an export job."""
        artifacts = execute_query("""
            SELECT * FROM export_artifacts
            WHERE export_job_id = :job_id
            ORDER BY is_primary DESC, artifact_type, created_at
        """, {"job_id": job_id})

        return [dict(a) for a in artifacts]

    # =========================================================================
    # Export Deliveries
    # =========================================================================

    @staticmethod
    async def record_delivery(
        job_id: str,
        delivery_method: str,
        destination: Optional[str] = None,
        external_id: Optional[str] = None,
        external_url: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record a delivery for an export job."""
        delivery = execute_insert("""
            INSERT INTO export_deliveries (
                export_job_id, delivery_method, destination,
                status, external_id, external_url, notes
            ) VALUES (
                :job_id, :method, :destination,
                'pending', :external_id, :external_url, :notes
            )
            RETURNING *
        """, {
            "job_id": job_id,
            "method": delivery_method,
            "destination": destination,
            "external_id": external_id,
            "external_url": external_url,
            "notes": notes
        })

        return {"success": True, "delivery_id": str(delivery["id"])}

    @staticmethod
    async def update_delivery_status(
        delivery_id: str,
        status: str,
        external_id: Optional[str] = None,
        external_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update delivery status."""
        updates = ["status = :status", "updated_at = NOW()"]
        params = {"delivery_id": delivery_id, "status": status}

        if external_id:
            updates.append("external_id = :external_id")
            params["external_id"] = external_id

        if external_url:
            updates.append("external_url = :external_url")
            params["external_url"] = external_url

        if status == "completed":
            updates.append("delivered_at = NOW()")

        execute_update(f"""
            UPDATE export_deliveries
            SET {', '.join(updates)}
            WHERE id = :delivery_id
        """, params)

        return {"success": True}

    # =========================================================================
    # Queue Management
    # =========================================================================

    @staticmethod
    async def get_pending_exports(limit: int = 50) -> List[Dict[str, Any]]:
        """Get pending export jobs for processing."""
        jobs = execute_query("""
            SELECT
                ej.*,
                w.title as world_title,
                ept.platform_name,
                ept.video_specs,
                ept.audio_specs,
                ept.delivery_specs
            FROM export_jobs ej
            JOIN worlds w ON ej.world_id = w.id
            LEFT JOIN export_platform_templates ept ON ej.platform_template_id = ept.id
            WHERE ej.status = 'pending'
              AND (ej.requires_approval = false OR ej.approved_at IS NOT NULL)
            ORDER BY ej.requested_at
            LIMIT :limit
        """, {"limit": limit})

        return [dict(j) for j in jobs]

    @staticmethod
    async def get_export_stats(
        world_id: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get export statistics."""
        query = """
            SELECT
                COUNT(*) as total_jobs,
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE status IN ('pending', 'validating', 'preparing', 'encoding', 'packaging', 'uploading')) as in_progress,
                COUNT(DISTINCT platform_key) as platforms_used
            FROM export_jobs
            WHERE 1=1
        """
        params = {}

        if world_id:
            query += " AND world_id = :world_id"
            params["world_id"] = world_id

        if organization_id:
            query += " AND organization_id = :organization_id"
            params["organization_id"] = organization_id

        result = execute_single(query, params)
        return dict(result) if result else {}
