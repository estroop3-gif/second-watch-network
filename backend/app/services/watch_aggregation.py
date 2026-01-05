"""
Watch Time Aggregation Service

Aggregates watch time from playback_sessions and watch_history tables
into world_watch_aggregates and platform_watch_totals for revenue calculation.

Aggregation hierarchy:
- Hourly: Real-time aggregates updated as playback sessions complete
- Daily: Rolled up from hourly aggregates at end of day
- Monthly: Rolled up from daily aggregates for revenue calculation
"""

from datetime import datetime, timedelta, date
from typing import Optional, Dict, Any, List
from uuid import UUID

from app.core.database import execute_query, execute_single, execute_insert, execute_update
from app.core.logging import get_logger

logger = get_logger(__name__)


class WatchAggregationService:
    """
    Service for aggregating watch time data for revenue calculations.

    Uses existing tables:
    - playback_sessions: Active viewing sessions with duration
    - watch_history: Per-user/episode progress tracking

    Outputs to:
    - world_watch_aggregates: Per-world watch totals per period
    - platform_watch_totals: Platform-wide totals for share calculation
    """

    @staticmethod
    async def aggregate_hourly_watch_time(
        hour_start: datetime,
        hour_end: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Aggregate watch time for a specific hour.

        Calculates:
        - Total watch seconds per world
        - Unique viewers per world
        - Total sessions per world
        - Completed episodes per world

        Args:
            hour_start: Start of the hour (will be truncated to hour boundary)
            hour_end: End of the hour (defaults to hour_start + 1 hour)

        Returns:
            Dict with stats about the aggregation
        """
        # Normalize to hour boundary
        hour_start = hour_start.replace(minute=0, second=0, microsecond=0)
        hour_end = hour_end or (hour_start + timedelta(hours=1))

        logger.info(
            "aggregating_hourly_watch_time",
            hour_start=hour_start.isoformat(),
            hour_end=hour_end.isoformat()
        )

        # Query watch time per world from playback_sessions
        # Join with episodes to get world_id
        query = """
            WITH session_watch AS (
                SELECT
                    e.world_id,
                    ps.user_id,
                    ps.id as session_id,
                    COALESCE(ps.duration_watched_seconds, 0) as watch_seconds
                FROM playback_sessions ps
                JOIN episodes e ON ps.episode_id = e.id
                WHERE ps.started_at >= :hour_start
                  AND ps.started_at < :hour_end
            ),
            world_stats AS (
                SELECT
                    world_id,
                    SUM(watch_seconds) as total_watch_seconds,
                    COUNT(DISTINCT user_id) as unique_viewers,
                    COUNT(DISTINCT session_id) as total_sessions
                FROM session_watch
                WHERE world_id IS NOT NULL
                GROUP BY world_id
            ),
            completed_stats AS (
                SELECT
                    e.world_id,
                    COUNT(*) as completed_count
                FROM watch_history wh
                JOIN episodes e ON wh.episode_id = e.id
                WHERE wh.completed = true
                  AND wh.updated_at >= :hour_start
                  AND wh.updated_at < :hour_end
                GROUP BY e.world_id
            )
            SELECT
                ws.world_id,
                ws.total_watch_seconds,
                ws.unique_viewers,
                ws.total_sessions,
                COALESCE(cs.completed_count, 0) as completed_episodes
            FROM world_stats ws
            LEFT JOIN completed_stats cs ON ws.world_id = cs.world_id
        """

        world_stats = execute_query(query, {
            "hour_start": hour_start,
            "hour_end": hour_end
        })

        if not world_stats:
            logger.info("no_watch_data_for_hour", hour_start=hour_start.isoformat())
            return {
                "hour_start": hour_start.isoformat(),
                "worlds_processed": 0,
                "total_watch_seconds": 0
            }

        # Upsert aggregates for each world
        worlds_processed = 0
        total_watch_seconds = 0

        for stats in world_stats:
            upsert_query = """
                INSERT INTO world_watch_aggregates (
                    world_id, period_type, period_start, period_end,
                    total_watch_seconds, unique_viewers, total_sessions, completed_episodes
                ) VALUES (
                    :world_id, 'hourly', :period_start, :period_end,
                    :total_watch_seconds, :unique_viewers, :total_sessions, :completed_episodes
                )
                ON CONFLICT (world_id, period_type, period_start)
                DO UPDATE SET
                    total_watch_seconds = EXCLUDED.total_watch_seconds,
                    unique_viewers = EXCLUDED.unique_viewers,
                    total_sessions = EXCLUDED.total_sessions,
                    completed_episodes = EXCLUDED.completed_episodes,
                    updated_at = NOW()
                RETURNING id
            """

            execute_insert(upsert_query, {
                "world_id": stats["world_id"],
                "period_start": hour_start,
                "period_end": hour_end,
                "total_watch_seconds": stats["total_watch_seconds"] or 0,
                "unique_viewers": stats["unique_viewers"] or 0,
                "total_sessions": stats["total_sessions"] or 0,
                "completed_episodes": stats["completed_episodes"] or 0,
            })

            worlds_processed += 1
            total_watch_seconds += stats["total_watch_seconds"] or 0

        # Update platform totals for this hour
        platform_query = """
            INSERT INTO platform_watch_totals (
                period_type, period_start, period_end,
                total_watch_seconds, active_worlds_count, total_unique_viewers, total_sessions
            )
            SELECT
                'hourly',
                :period_start,
                :period_end,
                COALESCE(SUM(total_watch_seconds), 0),
                COUNT(DISTINCT world_id),
                COALESCE(SUM(unique_viewers), 0),
                COALESCE(SUM(total_sessions), 0)
            FROM world_watch_aggregates
            WHERE period_type = 'hourly' AND period_start = :period_start
            ON CONFLICT (period_type, period_start)
            DO UPDATE SET
                total_watch_seconds = EXCLUDED.total_watch_seconds,
                active_worlds_count = EXCLUDED.active_worlds_count,
                total_unique_viewers = EXCLUDED.total_unique_viewers,
                total_sessions = EXCLUDED.total_sessions,
                updated_at = NOW()
        """

        execute_update(platform_query, {
            "period_start": hour_start,
            "period_end": hour_end
        })

        logger.info(
            "hourly_aggregation_complete",
            hour_start=hour_start.isoformat(),
            worlds_processed=worlds_processed,
            total_watch_seconds=total_watch_seconds
        )

        return {
            "hour_start": hour_start.isoformat(),
            "hour_end": hour_end.isoformat(),
            "worlds_processed": worlds_processed,
            "total_watch_seconds": total_watch_seconds
        }

    @staticmethod
    async def aggregate_daily_watch_time(target_date: date) -> Dict[str, Any]:
        """
        Roll up hourly aggregates into a daily aggregate.

        Args:
            target_date: The date to aggregate

        Returns:
            Dict with stats about the aggregation
        """
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = day_start + timedelta(days=1)

        logger.info(
            "aggregating_daily_watch_time",
            target_date=target_date.isoformat()
        )

        # Roll up hourly aggregates to daily
        rollup_query = """
            INSERT INTO world_watch_aggregates (
                world_id, period_type, period_start, period_end,
                total_watch_seconds, unique_viewers, total_sessions, completed_episodes
            )
            SELECT
                world_id,
                'daily',
                :day_start,
                :day_end,
                SUM(total_watch_seconds),
                MAX(unique_viewers),  -- Use max as approximation (true unique would need raw data)
                SUM(total_sessions),
                SUM(completed_episodes)
            FROM world_watch_aggregates
            WHERE period_type = 'hourly'
              AND period_start >= :day_start
              AND period_start < :day_end
            GROUP BY world_id
            ON CONFLICT (world_id, period_type, period_start)
            DO UPDATE SET
                total_watch_seconds = EXCLUDED.total_watch_seconds,
                unique_viewers = EXCLUDED.unique_viewers,
                total_sessions = EXCLUDED.total_sessions,
                completed_episodes = EXCLUDED.completed_episodes,
                updated_at = NOW()
            RETURNING world_id, total_watch_seconds
        """

        results = execute_query(rollup_query, {
            "day_start": day_start,
            "day_end": day_end
        })

        worlds_processed = len(results) if results else 0
        total_watch_seconds = sum(r["total_watch_seconds"] or 0 for r in results) if results else 0

        # Update platform daily totals
        platform_query = """
            INSERT INTO platform_watch_totals (
                period_type, period_start, period_end,
                total_watch_seconds, active_worlds_count, total_unique_viewers, total_sessions
            )
            SELECT
                'daily',
                :day_start,
                :day_end,
                COALESCE(SUM(total_watch_seconds), 0),
                COUNT(DISTINCT world_id),
                COALESCE(SUM(unique_viewers), 0),
                COALESCE(SUM(total_sessions), 0)
            FROM world_watch_aggregates
            WHERE period_type = 'daily' AND period_start = :day_start
            ON CONFLICT (period_type, period_start)
            DO UPDATE SET
                total_watch_seconds = EXCLUDED.total_watch_seconds,
                active_worlds_count = EXCLUDED.active_worlds_count,
                total_unique_viewers = EXCLUDED.total_unique_viewers,
                total_sessions = EXCLUDED.total_sessions,
                updated_at = NOW()
        """

        execute_update(platform_query, {
            "day_start": day_start,
            "day_end": day_end
        })

        logger.info(
            "daily_aggregation_complete",
            target_date=target_date.isoformat(),
            worlds_processed=worlds_processed,
            total_watch_seconds=total_watch_seconds
        )

        return {
            "target_date": target_date.isoformat(),
            "worlds_processed": worlds_processed,
            "total_watch_seconds": total_watch_seconds
        }

    @staticmethod
    async def aggregate_monthly_watch_time(year: int, month: int) -> Dict[str, Any]:
        """
        Roll up daily aggregates into a monthly aggregate.
        This is used as the basis for revenue calculations.

        Args:
            year: Year (e.g., 2024)
            month: Month (1-12)

        Returns:
            Dict with stats about the aggregation
        """
        month_start = datetime(year, month, 1)
        if month == 12:
            month_end = datetime(year + 1, 1, 1)
        else:
            month_end = datetime(year, month + 1, 1)

        logger.info(
            "aggregating_monthly_watch_time",
            year=year,
            month=month
        )

        # Roll up daily aggregates to monthly
        rollup_query = """
            INSERT INTO world_watch_aggregates (
                world_id, period_type, period_start, period_end,
                total_watch_seconds, unique_viewers, total_sessions, completed_episodes
            )
            SELECT
                world_id,
                'monthly',
                :month_start,
                :month_end,
                SUM(total_watch_seconds),
                MAX(unique_viewers),  -- Approximation
                SUM(total_sessions),
                SUM(completed_episodes)
            FROM world_watch_aggregates
            WHERE period_type = 'daily'
              AND period_start >= :month_start
              AND period_start < :month_end
            GROUP BY world_id
            ON CONFLICT (world_id, period_type, period_start)
            DO UPDATE SET
                total_watch_seconds = EXCLUDED.total_watch_seconds,
                unique_viewers = EXCLUDED.unique_viewers,
                total_sessions = EXCLUDED.total_sessions,
                completed_episodes = EXCLUDED.completed_episodes,
                updated_at = NOW()
            RETURNING world_id, total_watch_seconds
        """

        results = execute_query(rollup_query, {
            "month_start": month_start,
            "month_end": month_end
        })

        worlds_processed = len(results) if results else 0
        total_watch_seconds = sum(r["total_watch_seconds"] or 0 for r in results) if results else 0

        # Update platform monthly totals
        platform_query = """
            INSERT INTO platform_watch_totals (
                period_type, period_start, period_end,
                total_watch_seconds, active_worlds_count, total_unique_viewers, total_sessions
            )
            SELECT
                'monthly',
                :month_start,
                :month_end,
                COALESCE(SUM(total_watch_seconds), 0),
                COUNT(DISTINCT world_id),
                COALESCE(SUM(unique_viewers), 0),
                COALESCE(SUM(total_sessions), 0)
            FROM world_watch_aggregates
            WHERE period_type = 'monthly' AND period_start = :month_start
            ON CONFLICT (period_type, period_start)
            DO UPDATE SET
                total_watch_seconds = EXCLUDED.total_watch_seconds,
                active_worlds_count = EXCLUDED.active_worlds_count,
                total_unique_viewers = EXCLUDED.total_unique_viewers,
                total_sessions = EXCLUDED.total_sessions,
                updated_at = NOW()
        """

        execute_update(platform_query, {
            "month_start": month_start,
            "month_end": month_end
        })

        logger.info(
            "monthly_aggregation_complete",
            year=year,
            month=month,
            worlds_processed=worlds_processed,
            total_watch_seconds=total_watch_seconds
        )

        return {
            "year": year,
            "month": month,
            "month_start": month_start.isoformat(),
            "month_end": month_end.isoformat(),
            "worlds_processed": worlds_processed,
            "total_watch_seconds": total_watch_seconds
        }

    @staticmethod
    async def backfill_aggregates(
        start_date: date,
        end_date: date,
        period_type: str = "daily"
    ) -> Dict[str, Any]:
        """
        Backfill aggregates for a date range.

        Useful for:
        - Initial setup when deploying this system
        - Recovering from data gaps
        - Recalculating after corrections

        Args:
            start_date: Start of the range
            end_date: End of the range (inclusive)
            period_type: 'hourly', 'daily', or 'monthly'

        Returns:
            Dict with stats about the backfill
        """
        logger.info(
            "starting_backfill",
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            period_type=period_type
        )

        results = []
        current = start_date

        if period_type == "hourly":
            # Process each hour
            current_dt = datetime.combine(start_date, datetime.min.time())
            end_dt = datetime.combine(end_date + timedelta(days=1), datetime.min.time())

            while current_dt < end_dt:
                result = await WatchAggregationService.aggregate_hourly_watch_time(current_dt)
                results.append(result)
                current_dt += timedelta(hours=1)

        elif period_type == "daily":
            # Process each day
            while current <= end_date:
                result = await WatchAggregationService.aggregate_daily_watch_time(current)
                results.append(result)
                current += timedelta(days=1)

        elif period_type == "monthly":
            # Process each month in range
            current_year, current_month = start_date.year, start_date.month
            end_year, end_month = end_date.year, end_date.month

            while (current_year, current_month) <= (end_year, end_month):
                result = await WatchAggregationService.aggregate_monthly_watch_time(
                    current_year, current_month
                )
                results.append(result)

                # Move to next month
                if current_month == 12:
                    current_year += 1
                    current_month = 1
                else:
                    current_month += 1

        total_periods = len(results)
        total_watch_seconds = sum(r.get("total_watch_seconds", 0) for r in results)

        logger.info(
            "backfill_complete",
            period_type=period_type,
            total_periods=total_periods,
            total_watch_seconds=total_watch_seconds
        )

        return {
            "period_type": period_type,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "periods_processed": total_periods,
            "total_watch_seconds": total_watch_seconds
        }

    @staticmethod
    async def get_world_watch_stats(
        world_id: str,
        period_type: str = "daily",
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get watch statistics for a specific world.

        Args:
            world_id: The world UUID
            period_type: 'hourly', 'daily', or 'monthly'
            limit: Max records to return

        Returns:
            List of aggregate records
        """
        query = """
            SELECT
                id, world_id, period_type, period_start, period_end,
                total_watch_seconds, unique_viewers, total_sessions,
                completed_episodes, created_at, updated_at
            FROM world_watch_aggregates
            WHERE world_id = :world_id
              AND period_type = :period_type
            ORDER BY period_start DESC
            LIMIT :limit
        """

        return execute_query(query, {
            "world_id": world_id,
            "period_type": period_type,
            "limit": limit
        })

    @staticmethod
    async def get_platform_totals(
        period_type: str = "daily",
        limit: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get platform-wide watch totals.

        Args:
            period_type: 'hourly', 'daily', or 'monthly'
            limit: Max records to return

        Returns:
            List of platform total records
        """
        query = """
            SELECT
                id, period_type, period_start, period_end,
                total_watch_seconds, active_worlds_count,
                total_unique_viewers, total_sessions,
                created_at, updated_at
            FROM platform_watch_totals
            WHERE period_type = :period_type
            ORDER BY period_start DESC
            LIMIT :limit
        """

        return execute_query(query, {
            "period_type": period_type,
            "limit": limit
        })

    @staticmethod
    async def get_top_worlds_by_watch_time(
        period_start: datetime,
        period_end: datetime,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get top worlds ranked by watch time for a period.

        Args:
            period_start: Start of period
            period_end: End of period
            limit: Max results

        Returns:
            List of worlds with watch stats
        """
        query = """
            SELECT
                wwa.world_id,
                w.title as world_title,
                w.creator_id,
                w.organization_id,
                SUM(wwa.total_watch_seconds) as total_watch_seconds,
                MAX(wwa.unique_viewers) as peak_viewers,
                SUM(wwa.total_sessions) as total_sessions
            FROM world_watch_aggregates wwa
            JOIN worlds w ON wwa.world_id = w.id
            WHERE wwa.period_type = 'daily'
              AND wwa.period_start >= :period_start
              AND wwa.period_start < :period_end
            GROUP BY wwa.world_id, w.title, w.creator_id, w.organization_id
            ORDER BY total_watch_seconds DESC
            LIMIT :limit
        """

        return execute_query(query, {
            "period_start": period_start,
            "period_end": period_end,
            "limit": limit
        })


# Module-level convenience functions
async def aggregate_hourly(hour_start: datetime) -> Dict[str, Any]:
    """Convenience function for hourly aggregation."""
    return await WatchAggregationService.aggregate_hourly_watch_time(hour_start)


async def aggregate_daily(target_date: date) -> Dict[str, Any]:
    """Convenience function for daily aggregation."""
    return await WatchAggregationService.aggregate_daily_watch_time(target_date)


async def aggregate_monthly(year: int, month: int) -> Dict[str, Any]:
    """Convenience function for monthly aggregation."""
    return await WatchAggregationService.aggregate_monthly_watch_time(year, month)


async def backfill(start_date: date, end_date: date, period_type: str = "daily") -> Dict[str, Any]:
    """Convenience function for backfilling aggregates."""
    return await WatchAggregationService.backfill_aggregates(start_date, end_date, period_type)
