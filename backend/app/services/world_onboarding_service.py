"""
World Onboarding Service
Phase 4C: World creation wizard and onboarding state tracking.

This service provides:
- Onboarding state management
- Checklist item completion
- Progress tracking
- Review submission integration
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.services.content_review_service import ContentReviewService

logger = logging.getLogger(__name__)


# Onboarding stages in order
ONBOARDING_STAGES = [
    'just_started',
    'metadata_complete',
    'artwork_complete',
    'content_uploaded',
    'technical_passed',
    'rights_uploaded',
    'ready_to_submit',
    'submitted_for_review'
]

# Checklist items with their weights for completion percentage
CHECKLIST_ITEMS = {
    'metadata_complete': {'weight': 20, 'label': 'Complete metadata (title, description, genres)'},
    'artwork_uploaded': {'weight': 20, 'label': 'Upload cover artwork'},
    'technical_specs_passed': {'weight': 15, 'label': 'Pass technical review'},
    'first_episode_uploaded': {'weight': 25, 'label': 'Upload first episode'},
    'rights_docs_uploaded': {'weight': 20, 'label': 'Upload rights documentation'},
}


class WorldOnboardingService:
    """Service for managing World creation onboarding."""

    @staticmethod
    async def get_or_create_state(world_id: str) -> Dict[str, Any]:
        """Get or create onboarding state for a World."""
        state = execute_single("""
            SELECT * FROM world_onboarding_state WHERE world_id = :world_id
        """, {"world_id": world_id})

        if state:
            return dict(state)

        # Create new state
        state = execute_insert("""
            INSERT INTO world_onboarding_state (world_id)
            VALUES (:world_id)
            RETURNING *
        """, {"world_id": world_id})

        logger.info("onboarding_state_created", world_id=world_id)

        return dict(state)

    @staticmethod
    async def get_onboarding_checklist(world_id: str) -> Dict[str, Any]:
        """Get the onboarding checklist with current state."""
        state = await WorldOnboardingService.get_or_create_state(world_id)

        # Get World info
        world = execute_single("""
            SELECT id, title, slug, status, creator_id
            FROM worlds WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            return {"error": "World not found"}

        # Build checklist
        checklist = []
        for item_key, item_info in CHECKLIST_ITEMS.items():
            completed = state.get(item_key, False)
            completed_at = state.get(f"{item_key}_at") or state.get(f"{item_key.replace('_complete', '_completed')}_at")

            checklist.append({
                "key": item_key,
                "label": item_info["label"],
                "weight": item_info["weight"],
                "completed": completed,
                "completed_at": completed_at.isoformat() if completed_at else None
            })

        return {
            "world_id": world_id,
            "world_title": world["title"],
            "world_status": world["status"],
            "checklist": checklist,
            "completion_percentage": state.get("completion_percentage", 0),
            "ready_for_review": state.get("ready_for_review", False),
            "review_submitted": state.get("review_submitted", False),
            "current_stage": WorldOnboardingService._determine_stage(state)
        }

    @staticmethod
    def _determine_stage(state: Dict[str, Any]) -> str:
        """Determine current onboarding stage from state."""
        if state.get("review_submitted"):
            return "submitted_for_review"
        if state.get("ready_for_review"):
            return "ready_to_submit"
        if state.get("rights_docs_uploaded"):
            return "rights_uploaded"
        if state.get("technical_specs_passed"):
            return "technical_passed"
        if state.get("first_episode_uploaded"):
            return "content_uploaded"
        if state.get("artwork_uploaded"):
            return "artwork_complete"
        if state.get("metadata_complete"):
            return "metadata_complete"
        return "just_started"

    @staticmethod
    async def mark_metadata_complete(
        world_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Mark metadata as complete after validation."""
        # Validate World has required metadata
        world = execute_single("""
            SELECT title, logline, world_category, content_format
            FROM worlds WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            return {"success": False, "error": "World not found"}

        missing = []
        if not world.get("title"):
            missing.append("title")
        if not world.get("logline"):
            missing.append("logline")
        if not world.get("world_category"):
            missing.append("category")

        if missing:
            return {
                "success": False,
                "error": f"Missing required fields: {', '.join(missing)}"
            }

        return await WorldOnboardingService._update_checklist_item(
            world_id, "metadata_complete", True
        )

    @staticmethod
    async def mark_artwork_uploaded(
        world_id: str,
        user_id: str,
        cover_art_url: str,
        cover_art_wide_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Mark artwork as uploaded."""
        # Update World with artwork URLs
        execute_update("""
            UPDATE worlds
            SET cover_art_url = :cover_url,
                cover_art_wide_url = COALESCE(:wide_url, cover_art_wide_url),
                updated_at = NOW()
            WHERE id = :world_id
        """, {
            "world_id": world_id,
            "cover_url": cover_art_url,
            "wide_url": cover_art_wide_url
        })

        # Update onboarding state
        result = await WorldOnboardingService._update_checklist_item(
            world_id, "artwork_uploaded", True
        )

        # Also store in onboarding state
        execute_update("""
            UPDATE world_onboarding_state
            SET cover_art_url = :cover_url,
                cover_art_wide_url = :wide_url
            WHERE world_id = :world_id
        """, {
            "world_id": world_id,
            "cover_url": cover_art_url,
            "wide_url": cover_art_wide_url
        })

        return result

    @staticmethod
    async def mark_first_episode_uploaded(
        world_id: str,
        user_id: str,
        episode_id: str
    ) -> Dict[str, Any]:
        """Mark first episode as uploaded."""
        # Verify episode exists and belongs to World
        episode = execute_single("""
            SELECT id FROM episodes WHERE id = :episode_id AND world_id = :world_id
        """, {"episode_id": episode_id, "world_id": world_id})

        if not episode:
            return {"success": False, "error": "Episode not found"}

        # Update state with episode reference
        execute_update("""
            UPDATE world_onboarding_state
            SET first_episode_id = :episode_id
            WHERE world_id = :world_id
        """, {"world_id": world_id, "episode_id": episode_id})

        return await WorldOnboardingService._update_checklist_item(
            world_id, "first_episode_uploaded", True
        )

    @staticmethod
    async def mark_technical_specs_passed(
        world_id: str,
        user_id: str,
        issues: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Mark technical review as passed (or record issues)."""
        if issues and len(issues) > 0:
            # Record issues but don't mark as passed
            execute_update("""
                UPDATE world_onboarding_state
                SET technical_issues = :issues,
                    updated_at = NOW()
                WHERE world_id = :world_id
            """, {"world_id": world_id, "issues": issues})

            return {
                "success": False,
                "issues": issues,
                "message": "Technical issues found. Please address before proceeding."
            }

        # Clear any previous issues and mark as passed
        execute_update("""
            UPDATE world_onboarding_state
            SET technical_issues = NULL
            WHERE world_id = :world_id
        """, {"world_id": world_id})

        return await WorldOnboardingService._update_checklist_item(
            world_id, "technical_specs_passed", True
        )

    @staticmethod
    async def mark_rights_docs_uploaded(
        world_id: str,
        user_id: str,
        doc_urls: List[str]
    ) -> Dict[str, Any]:
        """Mark rights documentation as uploaded."""
        if not doc_urls or len(doc_urls) == 0:
            return {"success": False, "error": "At least one document URL required"}

        # Store document URLs
        execute_update("""
            UPDATE world_onboarding_state
            SET rights_doc_urls = :urls
            WHERE world_id = :world_id
        """, {"world_id": world_id, "urls": doc_urls})

        return await WorldOnboardingService._update_checklist_item(
            world_id, "rights_docs_uploaded", True
        )

    @staticmethod
    async def _update_checklist_item(
        world_id: str,
        item_key: str,
        completed: bool
    ) -> Dict[str, Any]:
        """Update a checklist item and recalculate progress."""
        # Ensure state exists
        await WorldOnboardingService.get_or_create_state(world_id)

        # Update the item
        timestamp_field = f"{item_key.replace('_complete', '_completed')}_at"
        if item_key.endswith("_uploaded") or item_key.endswith("_passed"):
            timestamp_field = f"{item_key}_at"

        execute_update(f"""
            UPDATE world_onboarding_state
            SET {item_key} = :completed,
                {timestamp_field} = CASE WHEN :completed THEN NOW() ELSE NULL END,
                updated_at = NOW()
            WHERE world_id = :world_id
        """, {"world_id": world_id, "completed": completed})

        # Recalculate completion percentage
        completion = await WorldOnboardingService._calculate_completion(world_id)

        logger.info("onboarding_item_updated",
                   world_id=world_id,
                   item=item_key,
                   completed=completed,
                   completion=completion)

        return {
            "success": True,
            "item": item_key,
            "completed": completed,
            "completion_percentage": completion,
            "ready_for_review": completion >= 80
        }

    @staticmethod
    async def _calculate_completion(world_id: str) -> int:
        """Calculate and update completion percentage."""
        state = execute_single("""
            SELECT * FROM world_onboarding_state WHERE world_id = :world_id
        """, {"world_id": world_id})

        if not state:
            return 0

        score = 0
        for item_key, item_info in CHECKLIST_ITEMS.items():
            if state.get(item_key):
                score += item_info["weight"]

        ready_for_review = score >= 80

        execute_update("""
            UPDATE world_onboarding_state
            SET completion_percentage = :score,
                ready_for_review = :ready
            WHERE world_id = :world_id
        """, {"world_id": world_id, "score": score, "ready": ready_for_review})

        return score

    @staticmethod
    async def submit_for_review(
        world_id: str,
        user_id: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Submit World for content review."""
        state = await WorldOnboardingService.get_or_create_state(world_id)

        if not state.get("ready_for_review"):
            return {
                "success": False,
                "error": "World is not ready for review. Please complete all checklist items."
            }

        if state.get("review_submitted"):
            return {
                "success": False,
                "error": "World already submitted for review",
                "review_task_id": state.get("review_task_id")
            }

        # Create review task
        task = await ContentReviewService.create_review_task(
            content_type="world",
            content_id=world_id,
            world_id=world_id,
            submitted_by=user_id,
            submission_notes=notes,
            priority=5
        )

        # Update onboarding state
        execute_update("""
            UPDATE world_onboarding_state
            SET review_submitted = true,
                review_submitted_at = NOW(),
                review_task_id = :task_id,
                updated_at = NOW()
            WHERE world_id = :world_id
        """, {"world_id": world_id, "task_id": task["id"]})

        # Update World status
        execute_update("""
            UPDATE worlds
            SET status = 'pending_review',
                updated_at = NOW()
            WHERE id = :world_id
        """, {"world_id": world_id})

        logger.info("world_submitted_for_review",
                   world_id=world_id,
                   task_id=task["id"])

        return {
            "success": True,
            "review_task_id": str(task["id"]),
            "message": "Your World has been submitted for review."
        }

    @staticmethod
    async def get_pending_onboarding(
        creator_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get all Worlds in onboarding for a creator."""
        worlds = execute_query("""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.status,
                w.created_at,
                wos.completion_percentage,
                wos.ready_for_review,
                wos.review_submitted,
                wos.updated_at as last_progress_at
            FROM worlds w
            LEFT JOIN world_onboarding_state wos ON w.id = wos.world_id
            WHERE w.creator_id = :creator_id
              AND w.status IN ('draft', 'pending_review')
            ORDER BY wos.updated_at DESC NULLS LAST, w.created_at DESC
            LIMIT :limit
        """, {"creator_id": creator_id, "limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def reset_onboarding(world_id: str) -> Dict[str, Any]:
        """Reset onboarding state (for rejected Worlds)."""
        execute_update("""
            UPDATE world_onboarding_state
            SET review_submitted = false,
                review_submitted_at = NULL,
                review_task_id = NULL,
                ready_for_review = false,
                updated_at = NOW()
            WHERE world_id = :world_id
        """, {"world_id": world_id})

        # Update World status back to draft
        execute_update("""
            UPDATE worlds
            SET status = 'draft',
                updated_at = NOW()
            WHERE id = :world_id
        """, {"world_id": world_id})

        return {"success": True, "message": "Onboarding reset for resubmission"}
