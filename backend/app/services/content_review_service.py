"""
Content Review Service
Phase 4B: QA workflows, content review, and moderation.

This service provides:
- Content review task management
- Flag handling
- Moderation actions
- Trust/safety management
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


# Valid status transitions for review tasks
VALID_STATUS_TRANSITIONS = {
    'pending': ['under_review', 'approved', 'rejected'],
    'under_review': ['approved', 'rejected', 'needs_changes'],
    'needs_changes': ['resubmitted'],
    'resubmitted': ['under_review', 'approved', 'rejected'],
    'approved': [],  # Terminal state
    'rejected': ['resubmitted']  # Can be resubmitted after rejection
}


class ContentReviewService:
    """Service for content review and QA workflows."""

    # =========================================================================
    # Review Task Management
    # =========================================================================

    @staticmethod
    async def create_review_task(
        content_type: str,
        content_id: str,
        world_id: str,
        submitted_by: str,
        submission_notes: Optional[str] = None,
        priority: int = 5,
        due_by: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Create a new content review task."""
        task = execute_insert("""
            INSERT INTO content_review_tasks (
                content_type, content_id, world_id,
                submitted_by, submitted_at, submission_notes,
                priority, due_by
            ) VALUES (
                :content_type::reviewable_content_type,
                :content_id, :world_id,
                :submitted_by, NOW(), :notes,
                :priority, :due_by
            )
            RETURNING *
        """, {
            "content_type": content_type,
            "content_id": content_id,
            "world_id": world_id,
            "submitted_by": submitted_by,
            "notes": submission_notes,
            "priority": priority,
            "due_by": due_by
        })

        # Log history
        execute_insert("""
            INSERT INTO content_review_history (task_id, action, new_status, performed_by)
            VALUES (:task_id, 'created', 'pending', :user_id)
        """, {"task_id": task["id"], "user_id": submitted_by})

        logger.info("review_task_created", task_id=task["id"], content_type=content_type)
        return dict(task)

    @staticmethod
    async def assign_review_task(
        task_id: str,
        assignee_id: str,
        assigned_by: str
    ) -> Optional[Dict[str, Any]]:
        """Assign a review task to a moderator/reviewer."""
        task = execute_single("""
            UPDATE content_review_tasks
            SET assigned_to = :assignee_id,
                assigned_at = NOW(),
                status = 'under_review',
                updated_at = NOW()
            WHERE id = :task_id
              AND status IN ('pending', 'resubmitted')
            RETURNING *
        """, {"task_id": task_id, "assignee_id": assignee_id})

        if task:
            execute_insert("""
                INSERT INTO content_review_history
                    (task_id, action, old_status, new_status, performed_by)
                VALUES (:task_id, 'assigned', 'pending', 'under_review', :user_id)
            """, {"task_id": task_id, "user_id": assigned_by})

            logger.info("review_task_assigned",
                       task_id=task_id,
                       assignee_id=assignee_id)

        return dict(task) if task else None

    @staticmethod
    async def complete_review(
        task_id: str,
        reviewer_id: str,
        decision: str,  # 'approved', 'rejected', 'needs_changes'
        review_notes: Optional[str] = None,
        required_changes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Complete a review with a decision."""
        if decision not in ['approved', 'rejected', 'needs_changes']:
            raise ValueError(f"Invalid decision: {decision}")

        # Get current task
        current = execute_single(
            "SELECT status, content_type, content_id, world_id FROM content_review_tasks WHERE id = :id",
            {"id": task_id}
        )
        if not current:
            return None

        # Validate transition
        if decision not in VALID_STATUS_TRANSITIONS.get(current["status"], []):
            raise ValueError(f"Cannot transition from {current['status']} to {decision}")

        task = execute_single("""
            UPDATE content_review_tasks
            SET status = :decision::review_status,
                reviewed_by = :reviewer_id,
                reviewed_at = NOW(),
                review_notes = :notes,
                required_changes = :changes,
                updated_at = NOW()
            WHERE id = :task_id
            RETURNING *
        """, {
            "task_id": task_id,
            "decision": decision,
            "reviewer_id": reviewer_id,
            "notes": review_notes,
            "changes": required_changes
        })

        if task:
            execute_insert("""
                INSERT INTO content_review_history
                    (task_id, action, old_status, new_status, notes, performed_by)
                VALUES (:task_id, :action, :old_status::review_status, :new_status::review_status, :notes, :user_id)
            """, {
                "task_id": task_id,
                "action": f"review_{decision}",
                "old_status": current["status"],
                "new_status": decision,
                "notes": review_notes,
                "user_id": reviewer_id
            })

            # If approved, update content status
            if decision == 'approved':
                await ContentReviewService._update_content_on_approval(
                    current["content_type"],
                    current["content_id"]
                )

            logger.info("review_completed",
                       task_id=task_id,
                       decision=decision)

        return dict(task) if task else None

    @staticmethod
    async def resubmit_for_review(
        task_id: str,
        submitted_by: str,
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Resubmit content after making required changes."""
        current = execute_single(
            "SELECT status FROM content_review_tasks WHERE id = :id",
            {"id": task_id}
        )
        if not current or current["status"] not in ['needs_changes', 'rejected']:
            return None

        task = execute_single("""
            UPDATE content_review_tasks
            SET status = 'resubmitted',
                resubmission_count = resubmission_count + 1,
                last_resubmitted_at = NOW(),
                submission_notes = COALESCE(:notes, submission_notes),
                assigned_to = NULL,
                assigned_at = NULL,
                updated_at = NOW()
            WHERE id = :task_id
            RETURNING *
        """, {"task_id": task_id, "notes": notes})

        if task:
            execute_insert("""
                INSERT INTO content_review_history
                    (task_id, action, old_status, new_status, performed_by)
                VALUES (:task_id, 'resubmitted', :old_status::review_status, 'resubmitted', :user_id)
            """, {
                "task_id": task_id,
                "old_status": current["status"],
                "user_id": submitted_by
            })

        return dict(task) if task else None

    @staticmethod
    async def get_review_queue(
        status: Optional[str] = None,
        content_type: Optional[str] = None,
        assigned_to: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get review tasks matching filters."""
        conditions = []
        params = {"limit": limit, "offset": offset}

        if status:
            conditions.append("crt.status = :status::review_status")
            params["status"] = status
        else:
            conditions.append("crt.status IN ('pending', 'under_review', 'resubmitted')")

        if content_type:
            conditions.append("crt.content_type = :content_type::reviewable_content_type")
            params["content_type"] = content_type

        if assigned_to:
            conditions.append("crt.assigned_to = :assigned_to")
            params["assigned_to"] = assigned_to

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        tasks = execute_query(f"""
            SELECT
                crt.*,
                w.title as world_title,
                w.slug as world_slug,
                p_sub.display_name as submitter_name,
                p_assign.display_name as assignee_name,
                (SELECT COUNT(*) FROM content_flags cf
                 WHERE cf.content_type = crt.content_type
                   AND cf.content_id = crt.content_id
                   AND cf.status = 'open') as open_flags
            FROM content_review_tasks crt
            LEFT JOIN worlds w ON crt.world_id = w.id
            LEFT JOIN profiles p_sub ON crt.submitted_by = p_sub.id
            LEFT JOIN profiles p_assign ON crt.assigned_to = p_assign.id
            WHERE {where_clause}
            ORDER BY crt.priority ASC, crt.submitted_at ASC
            LIMIT :limit OFFSET :offset
        """, params)

        total = execute_single(f"""
            SELECT COUNT(*) as count FROM content_review_tasks crt
            WHERE {where_clause}
        """, {k: v for k, v in params.items() if k not in ('limit', 'offset')})

        return {
            "tasks": [dict(t) for t in tasks],
            "total": total.get("count", 0) if total else 0,
            "limit": limit,
            "offset": offset
        }

    @staticmethod
    async def get_task_history(task_id: str) -> List[Dict[str, Any]]:
        """Get history of actions on a review task."""
        history = execute_query("""
            SELECT
                crh.*,
                p.display_name as performer_name
            FROM content_review_history crh
            LEFT JOIN profiles p ON crh.performed_by = p.id
            WHERE crh.task_id = :task_id
            ORDER BY crh.performed_at DESC
        """, {"task_id": task_id})

        return [dict(h) for h in history]

    @staticmethod
    async def _update_content_on_approval(content_type: str, content_id: str):
        """Update content status when review is approved."""
        if content_type == 'world':
            execute_update("""
                UPDATE worlds SET status = 'active', updated_at = NOW()
                WHERE id = :id AND status = 'pending_review'
            """, {"id": content_id})
        elif content_type == 'episode':
            execute_update("""
                UPDATE world_content SET status = 'published', updated_at = NOW()
                WHERE id = :id AND status = 'pending_review'
            """, {"id": content_id})

    # =========================================================================
    # Content Flags
    # =========================================================================

    @staticmethod
    async def create_flag(
        content_type: str,
        content_id: str,
        world_id: Optional[str],
        category: str,
        severity: str,
        reason: str,
        reported_by: Optional[str] = None,
        is_moderator_flag: bool = False,
        details: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a content flag."""
        flag = execute_insert("""
            INSERT INTO content_flags (
                content_type, content_id, world_id,
                category, severity, reason, details,
                reported_by, is_moderator_flag
            ) VALUES (
                :content_type::reviewable_content_type,
                :content_id, :world_id,
                :category::flag_category, :severity::flag_severity,
                :reason, :details,
                :reported_by, :is_moderator
            )
            RETURNING *
        """, {
            "content_type": content_type,
            "content_id": content_id,
            "world_id": world_id,
            "category": category,
            "severity": severity,
            "reason": reason,
            "details": details,
            "reported_by": reported_by,
            "is_moderator": is_moderator_flag
        })

        # Log moderation event if from moderator
        if is_moderator_flag and reported_by:
            execute_insert("""
                INSERT INTO moderation_events
                    (target_type, target_id, action, reason, moderator_id, flag_id)
                VALUES (:target_type, :target_id, 'flag_created', :reason, :mod_id, :flag_id)
            """, {
                "target_type": content_type,
                "target_id": content_id,
                "reason": reason,
                "mod_id": reported_by,
                "flag_id": flag["id"]
            })

        logger.info("content_flag_created",
                   flag_id=flag["id"],
                   content_type=content_type,
                   severity=severity)

        return dict(flag)

    @staticmethod
    async def resolve_flag(
        flag_id: str,
        resolved_by: str,
        resolution_action: str,
        resolution_notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Resolve a content flag."""
        flag = execute_single("""
            UPDATE content_flags
            SET status = 'resolved',
                resolved_by = :resolved_by,
                resolved_at = NOW(),
                resolution_action = :action,
                resolution_notes = :notes,
                updated_at = NOW()
            WHERE id = :flag_id AND status != 'resolved'
            RETURNING *
        """, {
            "flag_id": flag_id,
            "resolved_by": resolved_by,
            "action": resolution_action,
            "notes": resolution_notes
        })

        if flag:
            execute_insert("""
                INSERT INTO moderation_events
                    (target_type, target_id, action, reason, moderator_id, flag_id, details)
                VALUES (:type, :id, 'flag_resolved', :notes, :mod_id, :flag_id, :details::jsonb)
            """, {
                "type": flag["content_type"],
                "id": flag["content_id"],
                "notes": resolution_notes,
                "mod_id": resolved_by,
                "flag_id": flag_id,
                "details": f'{{"resolution_action": "{resolution_action}"}}'
            })

            logger.info("flag_resolved",
                       flag_id=flag_id,
                       action=resolution_action)

        return dict(flag) if flag else None

    @staticmethod
    async def get_open_flags(
        severity: Optional[str] = None,
        category: Optional[str] = None,
        content_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Get open flags with filters."""
        conditions = ["cf.status = 'open'"]
        params = {"limit": limit, "offset": offset}

        if severity:
            conditions.append("cf.severity = :severity::flag_severity")
            params["severity"] = severity

        if category:
            conditions.append("cf.category = :category::flag_category")
            params["category"] = category

        if content_type:
            conditions.append("cf.content_type = :content_type::reviewable_content_type")
            params["content_type"] = content_type

        where_clause = " AND ".join(conditions)

        flags = execute_query(f"""
            SELECT
                cf.*,
                w.title as world_title,
                p.display_name as reporter_name
            FROM content_flags cf
            LEFT JOIN worlds w ON cf.world_id = w.id
            LEFT JOIN profiles p ON cf.reported_by = p.id
            WHERE {where_clause}
            ORDER BY
                CASE cf.severity
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                END,
                cf.created_at ASC
            LIMIT :limit OFFSET :offset
        """, params)

        total = execute_single(f"""
            SELECT COUNT(*) as count FROM content_flags cf
            WHERE {where_clause}
        """, {k: v for k, v in params.items() if k not in ('limit', 'offset')})

        return {
            "flags": [dict(f) for f in flags],
            "total": total.get("count", 0) if total else 0,
            "limit": limit,
            "offset": offset
        }

    # =========================================================================
    # Moderation Actions
    # =========================================================================

    @staticmethod
    async def hide_content(
        content_type: str,
        content_id: str,
        moderator_id: str,
        reason: str
    ) -> bool:
        """Hide a thread or reply."""
        if content_type == 'thread':
            result = execute_single("""
                UPDATE community_threads
                SET is_hidden = true,
                    hidden_at = NOW(),
                    hidden_by = :mod_id,
                    hide_reason = :reason,
                    last_moderated_at = NOW()
                WHERE id = :content_id
                RETURNING id
            """, {"content_id": content_id, "mod_id": moderator_id, "reason": reason})
        elif content_type == 'reply':
            result = execute_single("""
                UPDATE community_thread_replies
                SET is_hidden = true,
                    hidden_at = NOW(),
                    hidden_by = :mod_id,
                    hide_reason = :reason
                WHERE id = :content_id
                RETURNING id
            """, {"content_id": content_id, "mod_id": moderator_id, "reason": reason})
        else:
            return False

        if result:
            execute_insert("""
                INSERT INTO moderation_events
                    (target_type, target_id, action, reason, moderator_id, visible_to_user)
                VALUES (:type, :id, 'content_hidden', :reason, :mod_id, true)
            """, {
                "type": content_type,
                "id": content_id,
                "reason": reason,
                "mod_id": moderator_id
            })

        return result is not None

    @staticmethod
    async def restore_content(
        content_type: str,
        content_id: str,
        moderator_id: str,
        reason: Optional[str] = None
    ) -> bool:
        """Restore hidden content."""
        if content_type == 'thread':
            result = execute_single("""
                UPDATE community_threads
                SET is_hidden = false,
                    hidden_at = NULL,
                    hidden_by = NULL,
                    hide_reason = NULL,
                    last_moderated_at = NOW()
                WHERE id = :content_id
                RETURNING id
            """, {"content_id": content_id})
        elif content_type == 'reply':
            result = execute_single("""
                UPDATE community_thread_replies
                SET is_hidden = false,
                    hidden_at = NULL,
                    hidden_by = NULL,
                    hide_reason = NULL
                WHERE id = :content_id
                RETURNING id
            """, {"content_id": content_id})
        else:
            return False

        if result:
            execute_insert("""
                INSERT INTO moderation_events
                    (target_type, target_id, action, reason, moderator_id, visible_to_user)
                VALUES (:type, :id, 'content_restored', :reason, :mod_id, true)
            """, {
                "type": content_type,
                "id": content_id,
                "reason": reason,
                "mod_id": moderator_id
            })

        return result is not None

    @staticmethod
    async def warn_user(
        user_id: str,
        warning_type: str,
        reason: str,
        issued_by: str,
        details: Optional[str] = None,
        related_content_type: Optional[str] = None,
        related_content_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Issue a warning to a user."""
        warning = execute_insert("""
            INSERT INTO user_warnings (
                user_id, warning_type, reason, details,
                related_content_type, related_content_id, issued_by
            ) VALUES (
                :user_id, :warning_type, :reason, :details,
                :content_type, :content_id, :issued_by
            )
            RETURNING *
        """, {
            "user_id": user_id,
            "warning_type": warning_type,
            "reason": reason,
            "details": details,
            "content_type": related_content_type,
            "content_id": related_content_id,
            "issued_by": issued_by
        })

        # Update safety profile
        execute_single("""
            INSERT INTO user_safety_profiles (user_id, warning_count, trust_score)
            VALUES (:user_id, 1, 95)
            ON CONFLICT (user_id) DO UPDATE SET
                warning_count = user_safety_profiles.warning_count + 1,
                trust_score = GREATEST(0, user_safety_profiles.trust_score - 5),
                updated_at = NOW()
        """, {"user_id": user_id})

        # Log event
        execute_insert("""
            INSERT INTO moderation_events
                (target_type, target_id, action, reason, moderator_id, visible_to_user)
            VALUES ('user', :user_id, 'user_warned', :reason, :mod_id, true)
        """, {"user_id": user_id, "reason": reason, "mod_id": issued_by})

        logger.info("user_warned", user_id=user_id, warning_type=warning_type)

        return dict(warning)

    @staticmethod
    async def mute_user(
        user_id: str,
        moderator_id: str,
        reason: str,
        duration_hours: Optional[int] = None  # None = permanent
    ) -> Dict[str, Any]:
        """Mute a user (prevent posting)."""
        muted_until = None
        if duration_hours:
            muted_until = datetime.utcnow() + timedelta(hours=duration_hours)

        result = execute_single("""
            INSERT INTO user_safety_profiles (user_id, is_muted, muted_until, mute_reason, mute_count)
            VALUES (:user_id, true, :until, :reason, 1)
            ON CONFLICT (user_id) DO UPDATE SET
                is_muted = true,
                muted_until = :until,
                mute_reason = :reason,
                mute_count = user_safety_profiles.mute_count + 1,
                trust_score = GREATEST(0, user_safety_profiles.trust_score - 15),
                updated_at = NOW()
            RETURNING *
        """, {"user_id": user_id, "until": muted_until, "reason": reason})

        execute_insert("""
            INSERT INTO moderation_events
                (target_type, target_id, action, reason, moderator_id, visible_to_user, expires_at)
            VALUES ('user', :user_id, 'user_muted', :reason, :mod_id, true, :expires)
        """, {
            "user_id": user_id,
            "reason": reason,
            "mod_id": moderator_id,
            "expires": muted_until
        })

        logger.info("user_muted", user_id=user_id, duration_hours=duration_hours)

        return dict(result) if result else {}

    @staticmethod
    async def unmute_user(
        user_id: str,
        moderator_id: str,
        reason: Optional[str] = None
    ) -> bool:
        """Unmute a user."""
        result = execute_single("""
            UPDATE user_safety_profiles
            SET is_muted = false, muted_until = NULL, mute_reason = NULL, updated_at = NOW()
            WHERE user_id = :user_id
            RETURNING id
        """, {"user_id": user_id})

        if result:
            execute_insert("""
                INSERT INTO moderation_events
                    (target_type, target_id, action, reason, moderator_id, visible_to_user)
                VALUES ('user', :user_id, 'user_unmuted', :reason, :mod_id, true)
            """, {"user_id": user_id, "reason": reason, "mod_id": moderator_id})

        return result is not None

    @staticmethod
    async def get_user_moderation_history(
        user_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get moderation history for a user."""
        events = execute_query("""
            SELECT
                me.*,
                p.display_name as moderator_name
            FROM moderation_events me
            JOIN profiles p ON me.moderator_id = p.id
            WHERE me.target_type = 'user' AND me.target_id = :user_id
            ORDER BY me.created_at DESC
            LIMIT :limit
        """, {"user_id": user_id, "limit": limit})

        return [dict(e) for e in events]

    @staticmethod
    async def get_user_safety_profile(user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's safety profile and status."""
        profile = execute_single("""
            SELECT
                usp.*,
                (SELECT COUNT(*) FROM user_warnings WHERE user_id = :user_id AND acknowledged = false) as unacknowledged_warnings
            FROM user_safety_profiles usp
            WHERE usp.user_id = :user_id
        """, {"user_id": user_id})

        if not profile:
            # Return defaults
            return {
                "user_id": user_id,
                "trust_score": 100,
                "warning_count": 0,
                "is_muted": False,
                "is_suspended": False,
                "unacknowledged_warnings": 0
            }

        return dict(profile)

    @staticmethod
    async def is_content_under_review(world_id: str) -> bool:
        """Check if a World has pending reviews or serious flags."""
        result = execute_single("""
            SELECT EXISTS (
                SELECT 1 FROM content_review_tasks
                WHERE world_id = :world_id
                  AND status IN ('pending', 'under_review', 'needs_changes')
            ) OR EXISTS (
                SELECT 1 FROM content_flags
                WHERE world_id = :world_id
                  AND status = 'open'
                  AND severity IN ('high', 'critical')
            ) as under_review
        """, {"world_id": world_id})

        return result.get("under_review", False) if result else False
