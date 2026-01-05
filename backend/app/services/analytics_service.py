"""
Analytics Service
Phase 5B: Advanced analytics and insight surfaces.

This service provides:
- Creator analytics dashboards
- Channel and block performance metrics
- Lodge analytics
- Ad campaign performance
- Cohort and retention analysis
- Platform-wide content health
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for advanced analytics and insights."""

    # =========================================================================
    # World/Creator Analytics
    # =========================================================================

    @staticmethod
    async def get_top_worlds_by_watch_time(
        days: int = 30,
        limit: int = 20,
        creator_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get top Worlds by watch time in the specified period."""
        query = """
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.world_category,
                w.creator_id,
                w.organization_id,
                p.display_name as creator_name,
                COALESCE(SUM(wwa.total_watch_seconds), 0) as total_watch_seconds,
                COALESCE(SUM(wwa.unique_viewers), 0) as unique_viewers,
                COALESCE(SUM(wwa.total_sessions), 0) as total_sessions
            FROM worlds w
            LEFT JOIN world_watch_aggregates wwa ON w.id = wwa.world_id
                AND wwa.period_type = 'daily'
                AND wwa.period_start >= :start_date
            JOIN profiles p ON w.creator_id = p.id
            WHERE w.status = 'published'
        """
        params = {
            "start_date": datetime.utcnow() - timedelta(days=days),
            "limit": limit
        }

        if creator_id:
            query += " AND w.creator_id = :creator_id"
            params["creator_id"] = creator_id

        if organization_id:
            query += " AND w.organization_id = :organization_id"
            params["organization_id"] = organization_id

        if category:
            query += " AND w.world_category = :category"
            params["category"] = category

        query += """
            GROUP BY w.id, w.title, w.slug, w.world_category,
                     w.creator_id, w.organization_id, p.display_name
            ORDER BY total_watch_seconds DESC
            LIMIT :limit
        """

        results = execute_query(query, params)
        return [dict(r) for r in results]

    @staticmethod
    async def get_world_performance_over_time(
        world_id: str,
        period_type: str = "daily",
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get watch metrics for a World over time."""
        results = execute_query("""
            SELECT
                period_start,
                period_end,
                total_watch_seconds,
                unique_viewers,
                total_sessions,
                completed_episodes
            FROM world_watch_aggregates
            WHERE world_id = :world_id
              AND period_type = :period_type
              AND period_start >= :start_date
            ORDER BY period_start
        """, {
            "world_id": world_id,
            "period_type": period_type,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return [dict(r) for r in results]

    @staticmethod
    async def get_world_cohort_metrics(world_id: str) -> Dict[str, Any]:
        """Get cohort performance for a World (7/30/90 day windows)."""
        cohorts = execute_query("""
            SELECT
                cohort_type,
                cohort_start,
                cohort_end,
                total_watch_seconds,
                unique_viewers,
                total_sessions,
                avg_session_duration_seconds,
                return_viewer_rate_pct,
                completion_rate_pct,
                percentile_rank,
                is_finalized
            FROM world_cohort_metrics
            WHERE world_id = :world_id
            ORDER BY cohort_type
        """, {"world_id": world_id})

        return {
            "world_id": world_id,
            "cohorts": [dict(c) for c in cohorts]
        }

    @staticmethod
    async def get_world_surface_breakdown(
        world_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get watch breakdown by surface (VOD, linear, lodge)."""
        # VOD watch time
        vod_stats = execute_single("""
            SELECT
                COALESCE(SUM(total_watch_seconds), 0) as watch_seconds,
                COALESCE(SUM(unique_viewers), 0) as viewers
            FROM world_watch_aggregates
            WHERE world_id = :world_id
              AND period_type = 'daily'
              AND period_start >= :start_date
        """, {"world_id": world_id, "start_date": datetime.utcnow() - timedelta(days=days)})

        # Linear channel watch time (if episodes appear on channels)
        linear_stats = execute_single("""
            SELECT
                COALESCE(SUM(EXTRACT(EPOCH FROM (ps.last_heartbeat - ps.started_at))), 0) as watch_seconds,
                COUNT(DISTINCT ps.user_id) as viewers
            FROM playback_sessions ps
            JOIN episodes e ON ps.episode_id = e.id
            WHERE e.world_id = :world_id
              AND ps.channel_id IS NOT NULL
              AND ps.started_at >= :start_date
        """, {"world_id": world_id, "start_date": datetime.utcnow() - timedelta(days=days)})

        total_vod = vod_stats["watch_seconds"] if vod_stats else 0
        total_linear = int(linear_stats["watch_seconds"]) if linear_stats else 0
        total = total_vod + total_linear

        return {
            "world_id": world_id,
            "period_days": days,
            "total_watch_seconds": total,
            "breakdown": {
                "vod": {
                    "watch_seconds": total_vod,
                    "percentage": round((total_vod / total * 100), 1) if total > 0 else 0,
                    "unique_viewers": vod_stats["viewers"] if vod_stats else 0
                },
                "linear": {
                    "watch_seconds": total_linear,
                    "percentage": round((total_linear / total * 100), 1) if total > 0 else 0,
                    "unique_viewers": linear_stats["viewers"] if linear_stats else 0
                }
            }
        }

    # =========================================================================
    # Channel and Block Analytics
    # =========================================================================

    @staticmethod
    async def get_channel_performance(
        channel_id: str,
        period_type: str = "daily",
        days: int = 30
    ) -> Dict[str, Any]:
        """Get performance metrics for a linear channel."""
        # Get time series
        time_series = execute_query("""
            SELECT
                period_start,
                total_watch_seconds,
                unique_viewers,
                total_sessions,
                peak_concurrent_viewers,
                peak_concurrent_at
            FROM channel_watch_aggregates
            WHERE channel_id = :channel_id
              AND period_type = :period_type
              AND period_start >= :start_date
            ORDER BY period_start
        """, {
            "channel_id": channel_id,
            "period_type": period_type,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        # Get totals
        totals = execute_single("""
            SELECT
                SUM(total_watch_seconds) as total_watch_seconds,
                SUM(unique_viewers) as unique_viewers,
                MAX(peak_concurrent_viewers) as peak_concurrent
            FROM channel_watch_aggregates
            WHERE channel_id = :channel_id
              AND period_type = :period_type
              AND period_start >= :start_date
        """, {
            "channel_id": channel_id,
            "period_type": period_type,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return {
            "channel_id": channel_id,
            "period_days": days,
            "totals": dict(totals) if totals else {},
            "time_series": [dict(t) for t in time_series]
        }

    @staticmethod
    async def get_block_performance(
        block_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get performance metrics for a programming block."""
        results = execute_query("""
            SELECT
                period_start,
                total_watch_seconds,
                unique_viewers,
                completion_rate_pct,
                avg_tune_in_point_seconds,
                avg_tune_out_point_seconds,
                drop_off_points
            FROM block_watch_aggregates
            WHERE block_id = :block_id
              AND period_type = 'daily'
              AND period_start >= :start_date
            ORDER BY period_start
        """, {
            "block_id": block_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return {
            "block_id": block_id,
            "period_days": days,
            "performances": [dict(r) for r in results]
        }

    @staticmethod
    async def get_channel_comparison(
        channel_ids: List[str],
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Compare performance across multiple channels."""
        results = execute_query("""
            SELECT
                lc.id as channel_id,
                lc.name as channel_name,
                SUM(cwa.total_watch_seconds) as total_watch_seconds,
                SUM(cwa.unique_viewers) as unique_viewers,
                AVG(cwa.peak_concurrent_viewers) as avg_peak_concurrent
            FROM linear_channels lc
            LEFT JOIN channel_watch_aggregates cwa ON lc.id = cwa.channel_id
                AND cwa.period_type = 'daily'
                AND cwa.period_start >= :start_date
            WHERE lc.id = ANY(:channel_ids)
            GROUP BY lc.id, lc.name
            ORDER BY total_watch_seconds DESC
        """, {
            "channel_ids": channel_ids,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return [dict(r) for r in results]

    # =========================================================================
    # Lodge Analytics
    # =========================================================================

    @staticmethod
    async def get_lodge_analytics(
        lodge_id: str,
        period_type: str = "daily",
        days: int = 30
    ) -> Dict[str, Any]:
        """Get comprehensive analytics for a lodge."""
        time_series = execute_query("""
            SELECT
                period_start,
                worlds_count,
                episodes_count,
                new_episodes_this_period,
                total_watch_seconds,
                unique_viewers,
                estimated_earnings_cents,
                active_members,
                new_members,
                posts_count,
                replies_count
            FROM lodge_aggregates
            WHERE lodge_id = :lodge_id
              AND period_type = :period_type
              AND period_start >= :start_date
            ORDER BY period_start
        """, {
            "lodge_id": lodge_id,
            "period_type": period_type,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        # Get totals and averages
        totals = execute_single("""
            SELECT
                MAX(worlds_count) as current_worlds,
                MAX(episodes_count) as current_episodes,
                SUM(new_episodes_this_period) as new_episodes,
                SUM(total_watch_seconds) as total_watch_seconds,
                SUM(estimated_earnings_cents) as total_earnings_cents,
                AVG(active_members) as avg_active_members
            FROM lodge_aggregates
            WHERE lodge_id = :lodge_id
              AND period_type = :period_type
              AND period_start >= :start_date
        """, {
            "lodge_id": lodge_id,
            "period_type": period_type,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return {
            "lodge_id": lodge_id,
            "period_days": days,
            "summary": dict(totals) if totals else {},
            "time_series": [dict(t) for t in time_series]
        }

    @staticmethod
    async def get_lodge_platform_contribution(
        lodge_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get lodge's contribution to platform totals."""
        result = execute_single("""
            SELECT
                SUM(la.total_watch_seconds) as lodge_watch_seconds,
                SUM(la.estimated_earnings_cents) as lodge_earnings_cents,
                (
                    SELECT SUM(total_watch_seconds)
                    FROM platform_watch_totals
                    WHERE period_type = 'daily'
                      AND period_start >= :start_date
                ) as platform_watch_seconds
            FROM lodge_aggregates la
            WHERE la.lodge_id = :lodge_id
              AND la.period_type = 'daily'
              AND la.period_start >= :start_date
        """, {
            "lodge_id": lodge_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        if not result:
            return {"lodge_id": lodge_id, "contribution_pct": 0}

        platform_total = result["platform_watch_seconds"] or 0
        lodge_total = result["lodge_watch_seconds"] or 0

        return {
            "lodge_id": lodge_id,
            "period_days": days,
            "lodge_watch_seconds": lodge_total,
            "platform_watch_seconds": platform_total,
            "contribution_pct": round((lodge_total / platform_total * 100), 2) if platform_total > 0 else 0,
            "lodge_earnings_cents": result["lodge_earnings_cents"] or 0
        }

    # =========================================================================
    # Ad Campaign Analytics
    # =========================================================================

    @staticmethod
    async def get_campaign_performance(
        campaign_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get performance metrics for an ad campaign."""
        time_series = execute_query("""
            SELECT
                period_start,
                total_impressions,
                total_clicks,
                total_completed_views,
                total_spend_cents,
                ctr_pct,
                vcr_pct,
                unique_viewers_reached
            FROM ad_campaign_stats
            WHERE campaign_id = :campaign_id
              AND period_type = 'daily'
              AND period_start >= :start_date
            ORDER BY period_start
        """, {
            "campaign_id": campaign_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        totals = execute_single("""
            SELECT
                SUM(total_impressions) as total_impressions,
                SUM(total_clicks) as total_clicks,
                SUM(total_completed_views) as total_completed_views,
                SUM(total_spend_cents) as total_spend_cents,
                SUM(unique_viewers_reached) as total_reach
            FROM ad_campaign_stats
            WHERE campaign_id = :campaign_id
              AND period_type = 'daily'
              AND period_start >= :start_date
        """, {
            "campaign_id": campaign_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        totals_dict = dict(totals) if totals else {}

        # Calculate overall rates
        impressions = totals_dict.get("total_impressions") or 0
        clicks = totals_dict.get("total_clicks") or 0
        completes = totals_dict.get("total_completed_views") or 0
        spend = totals_dict.get("total_spend_cents") or 0

        return {
            "campaign_id": campaign_id,
            "period_days": days,
            "totals": totals_dict,
            "rates": {
                "ctr_pct": round((clicks / impressions * 100), 4) if impressions > 0 else 0,
                "vcr_pct": round((completes / impressions * 100), 2) if impressions > 0 else 0,
                "cpm_cents": round((spend / impressions * 1000), 2) if impressions > 0 else 0
            },
            "time_series": [dict(t) for t in time_series]
        }

    @staticmethod
    async def get_line_item_breakdown(
        line_item_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get detailed breakdown for an ad line item."""
        stats = execute_query("""
            SELECT
                period_start,
                impressions,
                clicks,
                completed_views,
                skipped,
                q1_reached, q2_reached, q3_reached, q4_reached,
                spend_cents,
                by_placement_type,
                by_device_type,
                by_channel
            FROM ad_line_item_stats
            WHERE line_item_id = :line_item_id
              AND period_type = 'daily'
              AND period_start >= :start_date
            ORDER BY period_start
        """, {
            "line_item_id": line_item_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return {
            "line_item_id": line_item_id,
            "period_days": days,
            "daily_stats": [dict(s) for s in stats]
        }

    # =========================================================================
    # Retention and Platform Health
    # =========================================================================

    @staticmethod
    async def get_user_retention_cohorts(weeks: int = 12) -> List[Dict[str, Any]]:
        """Get user retention cohort data."""
        results = execute_query("""
            SELECT
                cohort_week,
                weeks_since_signup,
                cohort_size,
                retained_users,
                retention_rate_pct,
                by_acquisition_source,
                by_user_type
            FROM user_retention_cohorts
            WHERE cohort_week >= :start_week
            ORDER BY cohort_week, weeks_since_signup
        """, {"start_week": datetime.utcnow() - timedelta(weeks=weeks)})

        return [dict(r) for r in results]

    @staticmethod
    async def get_content_distribution_stats(days: int = 30) -> Dict[str, Any]:
        """Get content distribution across categories, types, and lodges."""
        result = execute_single("""
            SELECT
                by_category,
                by_world_type,
                by_maturity_rating,
                by_lodge,
                total_worlds,
                total_episodes,
                total_watch_seconds
            FROM content_distribution_stats
            WHERE period_type = 'daily'
            ORDER BY period_start DESC
            LIMIT 1
        """, {})

        if not result:
            return {
                "by_category": {},
                "by_world_type": {},
                "by_maturity_rating": {},
                "total_worlds": 0,
                "total_episodes": 0
            }

        return dict(result)

    @staticmethod
    async def get_platform_health_summary(days: int = 30) -> Dict[str, Any]:
        """Get overall platform health metrics."""
        # Watch time trends
        watch_trend = execute_single("""
            SELECT
                SUM(total_watch_seconds) as total_watch_seconds,
                COUNT(DISTINCT period_start) as days_with_data
            FROM platform_watch_totals
            WHERE period_type = 'daily'
              AND period_start >= :start_date
        """, {"start_date": datetime.utcnow() - timedelta(days=days)})

        # Active worlds
        active_worlds = execute_single("""
            SELECT COUNT(DISTINCT world_id) as count
            FROM world_watch_aggregates
            WHERE period_type = 'daily'
              AND period_start >= :start_date
              AND total_watch_seconds > 0
        """, {"start_date": datetime.utcnow() - timedelta(days=days)})

        # Active channels
        active_channels = execute_single("""
            SELECT COUNT(DISTINCT channel_id) as count
            FROM channel_watch_aggregates
            WHERE period_type = 'daily'
              AND period_start >= :start_date
              AND total_watch_seconds > 0
        """, {"start_date": datetime.utcnow() - timedelta(days=days)})

        return {
            "period_days": days,
            "total_watch_seconds": watch_trend["total_watch_seconds"] if watch_trend else 0,
            "active_worlds": active_worlds["count"] if active_worlds else 0,
            "active_channels": active_channels["count"] if active_channels else 0,
        }

    # =========================================================================
    # Creator Dashboard
    # =========================================================================

    @staticmethod
    async def get_creator_dashboard(
        creator_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get comprehensive dashboard data for a creator."""
        # Top worlds
        top_worlds = await AnalyticsService.get_top_worlds_by_watch_time(
            days=days, limit=10, creator_id=creator_id
        )

        # Total watch time
        totals = execute_single("""
            SELECT
                COALESCE(SUM(wwa.total_watch_seconds), 0) as total_watch_seconds,
                COALESCE(SUM(wwa.unique_viewers), 0) as unique_viewers,
                COUNT(DISTINCT w.id) as world_count
            FROM worlds w
            LEFT JOIN world_watch_aggregates wwa ON w.id = wwa.world_id
                AND wwa.period_type = 'daily'
                AND wwa.period_start >= :start_date
            WHERE w.creator_id = :creator_id
              AND w.status = 'published'
        """, {
            "creator_id": creator_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        # Earnings (if available)
        earnings = execute_single("""
            SELECT COALESCE(SUM(gross_earnings_cents), 0) as total_earnings_cents
            FROM world_earnings we
            JOIN worlds w ON we.world_id = w.id
            WHERE w.creator_id = :creator_id
              AND we.period_start >= :start_date
        """, {
            "creator_id": creator_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return {
            "creator_id": creator_id,
            "period_days": days,
            "summary": {
                "total_watch_seconds": totals["total_watch_seconds"] if totals else 0,
                "unique_viewers": totals["unique_viewers"] if totals else 0,
                "world_count": totals["world_count"] if totals else 0,
                "total_earnings_cents": earnings["total_earnings_cents"] if earnings else 0
            },
            "top_worlds": top_worlds
        }

    @staticmethod
    async def get_organization_dashboard(
        organization_id: str,
        days: int = 30
    ) -> Dict[str, Any]:
        """Get comprehensive dashboard data for an organization."""
        # Top worlds
        top_worlds = await AnalyticsService.get_top_worlds_by_watch_time(
            days=days, limit=10, organization_id=organization_id
        )

        # Total metrics
        totals = execute_single("""
            SELECT
                COALESCE(SUM(wwa.total_watch_seconds), 0) as total_watch_seconds,
                COALESCE(SUM(wwa.unique_viewers), 0) as unique_viewers,
                COUNT(DISTINCT w.id) as world_count,
                COUNT(DISTINCT w.creator_id) as creator_count
            FROM worlds w
            LEFT JOIN world_watch_aggregates wwa ON w.id = wwa.world_id
                AND wwa.period_type = 'daily'
                AND wwa.period_start >= :start_date
            WHERE w.organization_id = :organization_id
              AND w.status = 'published'
        """, {
            "organization_id": organization_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        # Earnings
        earnings = execute_single("""
            SELECT COALESCE(SUM(gross_earnings_cents), 0) as total_earnings_cents
            FROM world_earnings we
            JOIN worlds w ON we.world_id = w.id
            WHERE w.organization_id = :organization_id
              AND we.period_start >= :start_date
        """, {
            "organization_id": organization_id,
            "start_date": datetime.utcnow() - timedelta(days=days)
        })

        return {
            "organization_id": organization_id,
            "period_days": days,
            "summary": {
                "total_watch_seconds": totals["total_watch_seconds"] if totals else 0,
                "unique_viewers": totals["unique_viewers"] if totals else 0,
                "world_count": totals["world_count"] if totals else 0,
                "creator_count": totals["creator_count"] if totals else 0,
                "total_earnings_cents": earnings["total_earnings_cents"] if earnings else 0
            },
            "top_worlds": top_worlds
        }
