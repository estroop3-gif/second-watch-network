"""
Lodge Metrics Service
Phase 3B: Service for computing lodge metrics and managing VOD shelves.

This service provides:
- Lodge metrics computation and tier classification
- VOD shelf management (featured Worlds)
- Lodge channel and block proposal management
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


# Tier thresholds (configurable)
TIER_THRESHOLDS = {
    'flagship': {
        'min_worlds': 10,
        'min_watch_hours': 1000,
        'min_active_members': 50,
        'min_threads': 50,
        'min_score': 70
    },
    'active': {
        'min_worlds': 5,
        'min_watch_hours': 277,
        'min_active_members': 20,
        'min_threads': 20,
        'min_score': 40
    },
    'emerging': {
        'min_worlds': 0,
        'min_watch_hours': 0,
        'min_active_members': 0,
        'min_threads': 0,
        'min_score': 0
    }
}


class LodgeMetricsService:
    """Service for lodge metrics and programming privileges."""

    @staticmethod
    async def compute_lodge_metrics(
        lodge_id: str,
        period_type: str = 'monthly'
    ) -> Dict[str, Any]:
        """
        Compute and store metrics snapshot for a lodge.

        Args:
            lodge_id: The lodge ID
            period_type: 'daily', 'weekly', or 'monthly'

        Returns:
            The created metrics snapshot
        """
        # Get membership counts
        membership_stats = execute_single("""
            SELECT
                COUNT(*) as total_members,
                COUNT(*) FILTER (WHERE status = 'active') as active_members,
                COUNT(*) FILTER (
                    WHERE status = 'active'
                    AND joined_at >= CURRENT_DATE - INTERVAL '30 days'
                ) as new_members_this_period,
                COUNT(*) FILTER (WHERE is_officer = true) as officers_count
            FROM order_lodge_memberships
            WHERE lodge_id = :lodge_id
        """, {"lodge_id": lodge_id})

        # Get World production metrics
        # Worlds are linked via originating_lodge_id or via creator's lodge membership
        world_stats = execute_single("""
            WITH lodge_worlds AS (
                SELECT w.id, w.status, w.premiere_date
                FROM worlds w
                WHERE w.originating_lodge_id = :lodge_id
                UNION
                SELECT w.id, w.status, w.premiere_date
                FROM worlds w
                JOIN order_lodge_memberships olm ON w.creator_id = olm.user_id
                WHERE olm.lodge_id = :lodge_id AND olm.status = 'active'
            )
            SELECT
                COUNT(DISTINCT id) as worlds_count,
                COUNT(DISTINCT id) FILTER (WHERE status = 'active') as active_worlds_count,
                COUNT(DISTINCT id) FILTER (
                    WHERE premiere_date >= CURRENT_DATE - INTERVAL '30 days'
                ) as worlds_premiered_this_period
            FROM lodge_worlds
        """, {"lodge_id": lodge_id})

        # Get watch time and earnings from world aggregates
        watch_earnings = execute_single("""
            WITH lodge_worlds AS (
                SELECT w.id
                FROM worlds w
                WHERE w.originating_lodge_id = :lodge_id
                UNION
                SELECT w.id
                FROM worlds w
                JOIN order_lodge_memberships olm ON w.creator_id = olm.user_id
                WHERE olm.lodge_id = :lodge_id AND olm.status = 'active'
            )
            SELECT
                COALESCE(SUM(wwa.total_watch_seconds), 0) as total_watch_seconds,
                COALESCE(SUM(we.gross_earnings_cents), 0) as total_earnings_cents
            FROM lodge_worlds lw
            LEFT JOIN world_watch_aggregates wwa ON lw.id = wwa.world_id
                AND wwa.period_type = 'monthly'
                AND wwa.period_start >= DATE_TRUNC('month', CURRENT_DATE)
            LEFT JOIN world_earnings we ON lw.id = we.world_id
                AND we.period_start >= DATE_TRUNC('month', CURRENT_DATE)
        """, {"lodge_id": lodge_id})

        # Get community health metrics
        community_stats = execute_single("""
            SELECT
                COUNT(*) as threads_count,
                COUNT(*) FILTER (
                    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
                ) as thread_replies_this_period
            FROM community_threads
            WHERE lodge_id = :lodge_id
        """, {"lodge_id": lodge_id})

        # Get event metrics
        event_stats = execute_single("""
            SELECT
                COUNT(*) as events_hosted,
                COALESCE(SUM(
                    (SELECT COUNT(*) FROM order_event_rsvps WHERE event_id = oe.id AND status = 'attending')
                ), 0) as event_attendance
            FROM order_events oe
            WHERE oe.lodge_id = :lodge_id
              AND oe.starts_at >= CURRENT_DATE - INTERVAL '30 days'
        """, {"lodge_id": lodge_id})

        # Calculate tier score and tier
        worlds_count = world_stats.get('worlds_count', 0) if world_stats else 0
        total_watch_seconds = watch_earnings.get('total_watch_seconds', 0) if watch_earnings else 0
        active_members = membership_stats.get('active_members', 0) if membership_stats else 0
        threads_count = community_stats.get('threads_count', 0) if community_stats else 0

        tier_score = LodgeMetricsService._calculate_tier_score(
            worlds_count,
            total_watch_seconds,
            active_members,
            threads_count
        )
        computed_tier = LodgeMetricsService._determine_tier(tier_score)

        # Calculate average earnings per world
        total_earnings = watch_earnings.get('total_earnings_cents', 0) if watch_earnings else 0
        avg_earnings = total_earnings // worlds_count if worlds_count > 0 else 0

        # Create snapshot
        snapshot = execute_insert("""
            INSERT INTO lodge_metrics_snapshots (
                lodge_id, snapshot_date, period_type,
                total_members, active_members, new_members_this_period, officers_count,
                worlds_count, active_worlds_count, worlds_premiered_this_period,
                total_watch_seconds, total_earnings_cents, avg_earnings_per_world_cents,
                threads_count, thread_replies_this_period,
                events_hosted, event_attendance,
                computed_tier, tier_score
            ) VALUES (
                :lodge_id, CURRENT_DATE, :period_type,
                :total_members, :active_members, :new_members_this_period, :officers_count,
                :worlds_count, :active_worlds_count, :worlds_premiered_this_period,
                :total_watch_seconds, :total_earnings_cents, :avg_earnings_per_world_cents,
                :threads_count, :thread_replies_this_period,
                :events_hosted, :event_attendance,
                :computed_tier, :tier_score
            )
            ON CONFLICT (lodge_id, snapshot_date, period_type)
            DO UPDATE SET
                total_members = EXCLUDED.total_members,
                active_members = EXCLUDED.active_members,
                new_members_this_period = EXCLUDED.new_members_this_period,
                officers_count = EXCLUDED.officers_count,
                worlds_count = EXCLUDED.worlds_count,
                active_worlds_count = EXCLUDED.active_worlds_count,
                worlds_premiered_this_period = EXCLUDED.worlds_premiered_this_period,
                total_watch_seconds = EXCLUDED.total_watch_seconds,
                total_earnings_cents = EXCLUDED.total_earnings_cents,
                avg_earnings_per_world_cents = EXCLUDED.avg_earnings_per_world_cents,
                threads_count = EXCLUDED.threads_count,
                thread_replies_this_period = EXCLUDED.thread_replies_this_period,
                events_hosted = EXCLUDED.events_hosted,
                event_attendance = EXCLUDED.event_attendance,
                computed_tier = EXCLUDED.computed_tier,
                tier_score = EXCLUDED.tier_score
            RETURNING *
        """, {
            "lodge_id": lodge_id,
            "period_type": period_type,
            "total_members": membership_stats.get('total_members', 0) if membership_stats else 0,
            "active_members": active_members,
            "new_members_this_period": membership_stats.get('new_members_this_period', 0) if membership_stats else 0,
            "officers_count": membership_stats.get('officers_count', 0) if membership_stats else 0,
            "worlds_count": worlds_count,
            "active_worlds_count": world_stats.get('active_worlds_count', 0) if world_stats else 0,
            "worlds_premiered_this_period": world_stats.get('worlds_premiered_this_period', 0) if world_stats else 0,
            "total_watch_seconds": total_watch_seconds,
            "total_earnings_cents": total_earnings,
            "avg_earnings_per_world_cents": avg_earnings,
            "threads_count": threads_count,
            "thread_replies_this_period": community_stats.get('thread_replies_this_period', 0) if community_stats else 0,
            "events_hosted": event_stats.get('events_hosted', 0) if event_stats else 0,
            "event_attendance": event_stats.get('event_attendance', 0) if event_stats else 0,
            "computed_tier": computed_tier,
            "tier_score": tier_score
        })

        logger.info("lodge_metrics_computed", lodge_id=lodge_id, tier=computed_tier, score=tier_score)

        return dict(snapshot)

    @staticmethod
    def _calculate_tier_score(
        worlds_count: int,
        total_watch_seconds: int,
        active_members: int,
        threads_count: int
    ) -> int:
        """Calculate tier score based on metrics."""
        score = 0

        # Score based on worlds (max 40 points)
        if worlds_count >= 10:
            score += 40
        elif worlds_count >= 5:
            score += 30
        elif worlds_count >= 2:
            score += 20
        elif worlds_count >= 1:
            score += 10

        # Score based on watch time (max 30 points)
        watch_hours = total_watch_seconds / 3600
        if watch_hours >= 1000:
            score += 30
        elif watch_hours >= 277:
            score += 20
        elif watch_hours >= 27:
            score += 10

        # Score based on active members (max 20 points)
        if active_members >= 50:
            score += 20
        elif active_members >= 20:
            score += 15
        elif active_members >= 10:
            score += 10
        elif active_members >= 5:
            score += 5

        # Score based on community activity (max 10 points)
        if threads_count >= 50:
            score += 10
        elif threads_count >= 20:
            score += 7
        elif threads_count >= 5:
            score += 3

        return score

    @staticmethod
    def _determine_tier(score: int) -> str:
        """Determine tier from score."""
        if score >= TIER_THRESHOLDS['flagship']['min_score']:
            return 'flagship'
        elif score >= TIER_THRESHOLDS['active']['min_score']:
            return 'active'
        return 'emerging'

    @staticmethod
    async def get_lodge_metrics(lodge_id: str) -> Optional[Dict[str, Any]]:
        """Get the most recent metrics for a lodge."""
        metrics = execute_single("""
            SELECT * FROM v_lodge_current_metrics
            WHERE lodge_id = :lodge_id
        """, {"lodge_id": lodge_id})

        return dict(metrics) if metrics else None

    @staticmethod
    async def get_all_lodge_rankings(limit: int = 50) -> List[Dict[str, Any]]:
        """Get lodges ranked by tier and score."""
        lodges = execute_query("""
            SELECT * FROM v_lodge_current_metrics
            WHERE lodge_status = 'active'
            ORDER BY
                CASE computed_tier
                    WHEN 'flagship' THEN 1
                    WHEN 'active' THEN 2
                    WHEN 'emerging' THEN 3
                END,
                tier_score DESC
            LIMIT :limit
        """, {"limit": limit})

        return [dict(l) for l in lodges]

    # =========================================================================
    # VOD Shelf Management
    # =========================================================================

    @staticmethod
    async def get_lodge_shelf(
        lodge_id: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get the VOD shelf for a lodge.

        Returns featured Worlds in display order.
        """
        shelf = execute_query("""
            SELECT * FROM v_lodge_shelf
            WHERE lodge_id = :lodge_id
            ORDER BY display_order, featured_at DESC
            LIMIT :limit
        """, {"lodge_id": lodge_id, "limit": limit})

        return [dict(w) for w in shelf]

    @staticmethod
    async def feature_world(
        lodge_id: str,
        world_id: str,
        featured_by: str,
        feature_reason: Optional[str] = None,
        is_highlighted: bool = False,
        highlight_text: Optional[str] = None,
        display_order: int = 0
    ) -> Dict[str, Any]:
        """Add a World to a lodge's featured shelf."""
        # Verify the World can be featured (public, active)
        world = execute_single("""
            SELECT id, status, visibility
            FROM worlds
            WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            raise ValueError("World not found")

        if world['status'] != 'active' or world['visibility'] != 'public':
            raise ValueError("Only active public Worlds can be featured")

        feature = execute_insert("""
            INSERT INTO lodge_world_features (
                lodge_id, world_id, featured_by, feature_reason,
                is_highlighted, highlight_text, display_order
            ) VALUES (
                :lodge_id, :world_id, :featured_by, :feature_reason,
                :is_highlighted, :highlight_text, :display_order
            )
            ON CONFLICT (lodge_id, world_id) DO UPDATE SET
                featured_by = EXCLUDED.featured_by,
                feature_reason = EXCLUDED.feature_reason,
                is_highlighted = EXCLUDED.is_highlighted,
                highlight_text = EXCLUDED.highlight_text,
                display_order = EXCLUDED.display_order,
                is_active = true,
                updated_at = NOW()
            RETURNING *
        """, {
            "lodge_id": lodge_id,
            "world_id": world_id,
            "featured_by": featured_by,
            "feature_reason": feature_reason,
            "is_highlighted": is_highlighted,
            "highlight_text": highlight_text,
            "display_order": display_order
        })

        logger.info("world_featured", lodge_id=lodge_id, world_id=world_id)

        return dict(feature)

    @staticmethod
    async def unfeature_world(
        lodge_id: str,
        world_id: str
    ) -> bool:
        """Remove a World from a lodge's featured shelf."""
        result = execute_update("""
            UPDATE lodge_world_features
            SET is_active = false, updated_at = NOW()
            WHERE lodge_id = :lodge_id AND world_id = :world_id
        """, {"lodge_id": lodge_id, "world_id": world_id})

        return result is not None

    @staticmethod
    async def update_shelf_order(
        lodge_id: str,
        world_orders: List[Dict[str, int]]
    ) -> bool:
        """
        Update display order for multiple featured Worlds.

        Args:
            lodge_id: The lodge ID
            world_orders: List of {"world_id": str, "order": int}
        """
        for item in world_orders:
            execute_update("""
                UPDATE lodge_world_features
                SET display_order = :order, updated_at = NOW()
                WHERE lodge_id = :lodge_id AND world_id = :world_id
            """, {
                "lodge_id": lodge_id,
                "world_id": item["world_id"],
                "order": item["order"]
            })

        return True

    # =========================================================================
    # Block Proposals
    # =========================================================================

    @staticmethod
    async def create_block_proposal(
        lodge_id: str,
        block_name: str,
        block_description: Optional[str],
        block_theme: Optional[str],
        proposed_items: List[Dict[str, Any]],
        proposed_schedule: Optional[Dict[str, Any]],
        submitted_by: str
    ) -> Dict[str, Any]:
        """
        Create a new block proposal for a lodge channel.

        Args:
            lodge_id: The lodge ID
            block_name: Name for the proposed block
            block_description: Description
            block_theme: Theme category
            proposed_items: List of items (world_ids, episode_ids)
            proposed_schedule: Proposed scheduling info
            submitted_by: Profile ID of submitter
        """
        import json

        # Verify lodge can propose blocks
        lodge = execute_single("""
            SELECT can_propose_blocks, has_lodge_channel
            FROM order_lodges
            WHERE id = :lodge_id
        """, {"lodge_id": lodge_id})

        if not lodge or not lodge.get('can_propose_blocks'):
            raise ValueError("This lodge does not have block proposal privileges")

        # Calculate estimated duration from proposed items
        estimated_duration = 0
        for item in proposed_items:
            if item.get('type') == 'episode':
                ep = execute_single(
                    "SELECT duration_seconds FROM episodes WHERE id = :id",
                    {"id": item.get('id')}
                )
                if ep:
                    estimated_duration += ep.get('duration_seconds', 0)

        proposal = execute_insert("""
            INSERT INTO lodge_block_proposals (
                lodge_id, block_name, block_description, block_theme,
                proposed_items, estimated_duration_seconds, proposed_schedule,
                status, submitted_by, submitted_at
            ) VALUES (
                :lodge_id, :block_name, :block_description, :block_theme,
                :proposed_items, :estimated_duration, :proposed_schedule,
                'submitted', :submitted_by, NOW()
            )
            RETURNING *
        """, {
            "lodge_id": lodge_id,
            "block_name": block_name,
            "block_description": block_description,
            "block_theme": block_theme,
            "proposed_items": json.dumps(proposed_items),
            "estimated_duration": estimated_duration,
            "proposed_schedule": json.dumps(proposed_schedule) if proposed_schedule else None,
            "submitted_by": submitted_by
        })

        logger.info("block_proposal_created", proposal_id=proposal['id'], lodge_id=lodge_id)

        return dict(proposal)

    @staticmethod
    async def get_lodge_proposals(
        lodge_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get block proposals for a lodge."""
        conditions = ["lodge_id = :lodge_id"]
        params = {"lodge_id": lodge_id}

        if status:
            conditions.append("status = :status")
            params["status"] = status

        proposals = execute_query(f"""
            SELECT lbp.*, p.display_name as submitter_name
            FROM lodge_block_proposals lbp
            LEFT JOIN profiles p ON lbp.submitted_by = p.id
            WHERE {' AND '.join(conditions)}
            ORDER BY submitted_at DESC
        """, params)

        return [dict(p) for p in proposals]

    @staticmethod
    async def get_pending_proposals(limit: int = 50) -> List[Dict[str, Any]]:
        """Get all pending block proposals (admin view)."""
        proposals = execute_query("""
            SELECT
                lbp.*,
                ol.name as lodge_name,
                ol.city as lodge_city,
                p.display_name as submitter_name
            FROM lodge_block_proposals lbp
            JOIN order_lodges ol ON lbp.lodge_id = ol.id
            LEFT JOIN profiles p ON lbp.submitted_by = p.id
            WHERE lbp.status IN ('submitted', 'under_review')
            ORDER BY lbp.submitted_at ASC
            LIMIT :limit
        """, {"limit": limit})

        return [dict(p) for p in proposals]

    @staticmethod
    async def review_proposal(
        proposal_id: str,
        action: str,
        reviewed_by: str,
        review_notes: Optional[str] = None,
        rejection_reason: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Review a block proposal (admin action).

        Args:
            proposal_id: The proposal ID
            action: 'approve' or 'reject'
            reviewed_by: Admin profile ID
            review_notes: Optional notes
            rejection_reason: Required if rejecting
        """
        if action not in ('approve', 'reject'):
            raise ValueError("Action must be 'approve' or 'reject'")

        if action == 'reject' and not rejection_reason:
            raise ValueError("Rejection reason required")

        new_status = 'approved' if action == 'approve' else 'rejected'

        proposal = execute_single("""
            UPDATE lodge_block_proposals
            SET status = :status,
                reviewed_at = NOW(),
                reviewed_by = :reviewed_by,
                review_notes = :review_notes,
                rejection_reason = :rejection_reason,
                updated_at = NOW()
            WHERE id = :proposal_id
              AND status IN ('submitted', 'under_review')
            RETURNING *
        """, {
            "proposal_id": proposal_id,
            "status": new_status,
            "reviewed_by": reviewed_by,
            "review_notes": review_notes,
            "rejection_reason": rejection_reason
        })

        if proposal:
            logger.info("block_proposal_reviewed", proposal_id=proposal_id, action=action)

        return dict(proposal) if proposal else None

    # =========================================================================
    # Batch Metrics Computation
    # =========================================================================

    @staticmethod
    async def compute_all_lodge_metrics() -> Dict[str, Any]:
        """Compute metrics for all active lodges (batch job)."""
        lodges = execute_query("""
            SELECT id FROM order_lodges WHERE status = 'active'
        """, {})

        results = {
            "computed": 0,
            "errors": 0,
            "lodges": []
        }

        for lodge in lodges:
            try:
                snapshot = await LodgeMetricsService.compute_lodge_metrics(lodge['id'])
                results["computed"] += 1
                results["lodges"].append({
                    "lodge_id": lodge['id'],
                    "tier": snapshot.get('computed_tier'),
                    "score": snapshot.get('tier_score')
                })
            except Exception as e:
                logger.error("lodge_metrics_error", lodge_id=lodge['id'], error=str(e))
                results["errors"] += 1

        logger.info("all_lodge_metrics_computed", **results)

        return results
