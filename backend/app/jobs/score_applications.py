"""
Application Scoring Job
Background job to calculate match scores for collab applications.

This job can be triggered:
1. When a new application is submitted (score single application)
2. When a collab is updated (rescore all applications)
3. When user credits change (rescore their applications)
4. On a schedule (score any unscored applications)
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

from app.core.database import execute_query, execute_single
from app.services.applicant_scoring import ApplicantScoringService

logger = logging.getLogger(__name__)


class ApplicationScoringJob:
    """Job runner for application scoring tasks."""

    @staticmethod
    async def score_single_application(application_id: str) -> Dict[str, Any]:
        """
        Score a single application.
        Called when an application is submitted.
        """
        try:
            breakdown = await ApplicantScoringService.update_application_score(application_id)
            logger.info(f"Scored application {application_id}: {breakdown['total']}")
            return {
                "success": True,
                "application_id": application_id,
                "score": breakdown['total'],
                "breakdown": breakdown
            }
        except Exception as e:
            logger.error(f"Failed to score application {application_id}: {e}")
            return {
                "success": False,
                "application_id": application_id,
                "error": str(e)
            }

    @staticmethod
    async def score_collab_applications(collab_id: str) -> Dict[str, Any]:
        """
        Score all applications for a collab.
        Called when a collab is updated (position/requirements change).
        """
        try:
            result = await ApplicantScoringService.score_all_applications_for_collab(collab_id)
            logger.info(f"Scored {result['scored']} applications for collab {collab_id}")
            return {
                "success": True,
                **result
            }
        except Exception as e:
            logger.error(f"Failed to score applications for collab {collab_id}: {e}")
            return {
                "success": False,
                "collab_id": collab_id,
                "error": str(e)
            }

    @staticmethod
    async def score_user_applications(user_id: str) -> Dict[str, Any]:
        """
        Rescore all applications by a user.
        Called when user credits or connections change.
        """
        try:
            # Get all applications by this user
            applications = execute_query("""
                SELECT id FROM community_collab_applications
                WHERE user_id = :user_id
            """, {"user_id": user_id})

            scored = 0
            errors = 0

            for app in (applications or []):
                try:
                    await ApplicantScoringService.update_application_score(str(app['id']))
                    scored += 1
                except Exception as e:
                    logger.error(f"Error scoring application {app['id']}: {e}")
                    errors += 1

            logger.info(f"Rescored {scored} applications for user {user_id}")
            return {
                "success": True,
                "user_id": user_id,
                "total": len(applications or []),
                "scored": scored,
                "errors": errors
            }
        except Exception as e:
            logger.error(f"Failed to score applications for user {user_id}: {e}")
            return {
                "success": False,
                "user_id": user_id,
                "error": str(e)
            }

    @staticmethod
    async def score_unscored_batch(limit: int = 100) -> Dict[str, Any]:
        """
        Score a batch of unscored applications.
        Called on a schedule to catch any missed applications.
        """
        try:
            result = await ApplicantScoringService.score_unscored_applications(limit)
            logger.info(f"Batch scored {result['scored']} applications")
            return {
                "success": True,
                **result
            }
        except Exception as e:
            logger.error(f"Failed batch scoring: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def score_stale_applications(
        hours_old: int = 24,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Rescore applications whose scores are stale.
        Useful when scoring algorithm changes or data is updated.
        """
        try:
            cutoff = datetime.utcnow() - timedelta(hours=hours_old)

            applications = execute_query("""
                SELECT id FROM community_collab_applications
                WHERE score_calculated_at IS NULL
                   OR score_calculated_at < :cutoff
                ORDER BY score_calculated_at ASC NULLS FIRST
                LIMIT :limit
            """, {"cutoff": cutoff, "limit": limit})

            scored = 0
            errors = 0

            for app in (applications or []):
                try:
                    await ApplicantScoringService.update_application_score(str(app['id']))
                    scored += 1
                except Exception as e:
                    logger.error(f"Error scoring application {app['id']}: {e}")
                    errors += 1

            logger.info(f"Rescored {scored} stale applications")
            return {
                "success": True,
                "processed": len(applications or []),
                "scored": scored,
                "errors": errors,
                "cutoff_hours": hours_old
            }
        except Exception as e:
            logger.error(f"Failed stale scoring: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def get_scoring_stats() -> Dict[str, Any]:
        """
        Get statistics about application scoring.
        """
        try:
            stats = execute_single("""
                SELECT
                    COUNT(*) as total_applications,
                    COUNT(match_score) as scored_applications,
                    COUNT(*) FILTER (WHERE match_score IS NULL) as unscored_applications,
                    AVG(match_score) as average_score,
                    MIN(score_calculated_at) as oldest_score,
                    MAX(score_calculated_at) as newest_score
                FROM community_collab_applications
            """)

            return {
                "success": True,
                "stats": dict(stats) if stats else {}
            }
        except Exception as e:
            logger.error(f"Failed to get scoring stats: {e}")
            return {
                "success": False,
                "error": str(e)
            }
