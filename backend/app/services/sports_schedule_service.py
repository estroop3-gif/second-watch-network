"""
Sports Schedule Service
Phase 3C: Service for sports/motorsports content scheduling and queries.

This service provides:
- Sports event management
- Sports-specific World queries
- Live sports block scheduling helpers
- Sports channel content management
"""

import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


# Common sport types
SPORT_TYPES = {
    'team_sports': [
        'backyard_football', 'flag_football', 'basketball', 'baseball',
        'softball', 'soccer', 'volleyball', 'hockey', 'lacrosse'
    ],
    'combat_sports': [
        'wrestling', 'mma', 'boxing', 'jiu_jitsu', 'karate', 'taekwondo'
    ],
    'motorsports': [
        'motocross', 'rally', 'dirt_track', 'drag_racing', 'drift',
        'stunt_show', 'demolition_derby', 'monster_trucks'
    ],
    'action_sports': [
        'skateboarding', 'bmx', 'surfing', 'snowboarding', 'parkour'
    ],
    'outdoor_sports': [
        'fishing', 'hunting', 'hiking', 'climbing', 'camping', 'kayaking'
    ],
    'individual_sports': [
        'golf', 'tennis', 'track_and_field', 'swimming', 'gymnastics'
    ],
    'other': [
        'rodeo', 'esports', 'competitive_eating', 'other'
    ]
}


class SportsScheduleService:
    """Service for sports and motorsports content management."""

    @staticmethod
    async def get_sports_worlds(
        sport_type: Optional[str] = None,
        category: Optional[str] = None,
        live_only: bool = False,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get sports/motorsports Worlds with optional filters.

        Args:
            sport_type: Filter by specific sport type
            category: 'sports' or 'motorsports'
            live_only: Only return Worlds with live content flag
            limit: Max results
            offset: Pagination offset
        """
        conditions = ["world_category IN ('sports', 'motorsports')"]
        params = {"limit": limit, "offset": offset}

        if sport_type:
            conditions.append("sport_type = :sport_type")
            params["sport_type"] = sport_type

        if category:
            conditions.append("world_category = :category")
            params["category"] = category

        if live_only:
            conditions.append("is_live_content = true")

        worlds = execute_query(f"""
            SELECT * FROM v_sports_worlds
            WHERE {' AND '.join(conditions)}
            ORDER BY
                upcoming_events DESC,
                follower_count DESC,
                total_view_count DESC
            LIMIT :limit OFFSET :offset
        """, params)

        total = execute_single(f"""
            SELECT COUNT(*) as count FROM v_sports_worlds
            WHERE {' AND '.join(conditions)}
        """, {k: v for k, v in params.items() if k not in ('limit', 'offset')})

        return {
            "worlds": [dict(w) for w in worlds],
            "total": total.get("count", 0) if total else 0,
            "limit": limit,
            "offset": offset
        }

    @staticmethod
    async def get_upcoming_sports_events(
        days: int = 7,
        sport_type: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get upcoming sports events.

        Args:
            days: How many days ahead to look
            sport_type: Filter by sport type
            limit: Max results
        """
        conditions = [
            "se.status = 'scheduled'",
            "se.scheduled_start >= NOW()",
            "se.scheduled_start <= NOW() + :days::interval"
        ]
        params = {"days": f"{days} days", "limit": limit}

        if sport_type:
            conditions.append("se.sport_type = :sport_type")
            params["sport_type"] = sport_type

        events = execute_query(f"""
            SELECT
                se.*,
                w.title as world_title,
                w.slug as world_slug,
                w.cover_art_url as world_cover,
                w.world_category
            FROM sports_events se
            JOIN worlds w ON se.world_id = w.id
            WHERE {' AND '.join(conditions)}
            ORDER BY se.scheduled_start ASC
            LIMIT :limit
        """, params)

        return [dict(e) for e in events]

    @staticmethod
    async def get_live_sports_events() -> List[Dict[str, Any]]:
        """Get currently live sports events."""
        events = execute_query("""
            SELECT
                se.*,
                w.title as world_title,
                w.slug as world_slug,
                w.cover_art_url as world_cover,
                w.world_category
            FROM sports_events se
            JOIN worlds w ON se.world_id = w.id
            WHERE se.status = 'live'
            ORDER BY se.actual_start ASC
        """, {})

        return [dict(e) for e in events]

    @staticmethod
    async def create_sports_event(
        world_id: str,
        event_name: str,
        scheduled_start: datetime,
        sport_type: Optional[str] = None,
        event_type: Optional[str] = None,
        league: Optional[str] = None,
        home_team: Optional[str] = None,
        away_team: Optional[str] = None,
        participants: Optional[List[str]] = None,
        scheduled_end: Optional[datetime] = None,
        venue_name: Optional[str] = None,
        venue_location: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new sports event."""
        import json

        event = execute_insert("""
            INSERT INTO sports_events (
                world_id, event_name, event_type, sport_type, league,
                home_team, away_team, participants,
                scheduled_start, scheduled_end,
                venue_name, venue_location
            ) VALUES (
                :world_id, :event_name, :event_type, :sport_type, :league,
                :home_team, :away_team, :participants,
                :scheduled_start, :scheduled_end,
                :venue_name, :venue_location
            )
            RETURNING *
        """, {
            "world_id": world_id,
            "event_name": event_name,
            "event_type": event_type,
            "sport_type": sport_type,
            "league": league,
            "home_team": home_team,
            "away_team": away_team,
            "participants": json.dumps(participants) if participants else "[]",
            "scheduled_start": scheduled_start,
            "scheduled_end": scheduled_end,
            "venue_name": venue_name,
            "venue_location": venue_location
        })

        logger.info("sports_event_created", event_id=event["id"], world_id=world_id)

        return dict(event)

    @staticmethod
    async def update_event_status(
        event_id: str,
        status: str,
        actual_start: Optional[datetime] = None,
        actual_end: Optional[datetime] = None
    ) -> Optional[Dict[str, Any]]:
        """Update sports event status."""
        params = {"event_id": event_id, "status": status}
        extra_sets = []

        if actual_start:
            extra_sets.append("actual_start = :actual_start")
            params["actual_start"] = actual_start

        if actual_end:
            extra_sets.append("actual_end = :actual_end")
            params["actual_end"] = actual_end

        extra_sql = ", " + ", ".join(extra_sets) if extra_sets else ""

        event = execute_single(f"""
            UPDATE sports_events
            SET status = :status{extra_sql}, updated_at = NOW()
            WHERE id = :event_id
            RETURNING *
        """, params)

        if event:
            logger.info("sports_event_status_updated", event_id=event_id, status=status)

        return dict(event) if event else None

    @staticmethod
    async def link_event_to_episode(
        event_id: str,
        episode_id: str
    ) -> Optional[Dict[str, Any]]:
        """Link a completed sports event to its archived episode."""
        event = execute_single("""
            UPDATE sports_events
            SET episode_id = :episode_id, updated_at = NOW()
            WHERE id = :event_id
            RETURNING *
        """, {"event_id": event_id, "episode_id": episode_id})

        return dict(event) if event else None

    @staticmethod
    async def get_sports_channels() -> List[Dict[str, Any]]:
        """Get linear channels focused on sports content."""
        channels = execute_query("""
            SELECT lc.*
            FROM linear_channels lc
            WHERE lc.status IN ('live', 'scheduled')
              AND (
                  lc.category = 'sports'
                  OR lc.slug LIKE '%sports%'
                  OR lc.slug LIKE '%motorsports%'
              )
            ORDER BY lc.current_viewers DESC, lc.name
        """, {})

        return [dict(c) for c in channels]

    @staticmethod
    async def get_sports_blocks(
        sport_type: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Get blocks containing sports content.

        Looks for blocks with sports-related themes or
        blocks containing episodes from sports Worlds.
        """
        conditions = ["b.status IN ('ready', 'active')"]
        params = {"limit": limit}

        if sport_type:
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM block_items bi
                    JOIN episodes e ON bi.item_id = e.id AND bi.item_type = 'world_episode'
                    JOIN worlds w ON e.world_id = w.id
                    WHERE bi.block_id = b.id AND w.sport_type = :sport_type
                )
            """)
            params["sport_type"] = sport_type

        blocks = execute_query(f"""
            SELECT
                b.*,
                (SELECT COUNT(*) FROM block_items WHERE block_id = b.id) as item_count,
                (SELECT array_agg(DISTINCT w.sport_type)
                 FROM block_items bi
                 JOIN episodes e ON bi.item_id = e.id AND bi.item_type = 'world_episode'
                 JOIN worlds w ON e.world_id = w.id
                 WHERE bi.block_id = b.id AND w.sport_type IS NOT NULL
                ) as sport_types
            FROM blocks b
            WHERE {' AND '.join(conditions)}
              AND (
                  b.theme ILIKE '%sport%'
                  OR b.theme ILIKE '%motorsport%'
                  OR b.category = 'sports'
                  OR EXISTS (
                      SELECT 1 FROM block_items bi
                      JOIN episodes e ON bi.item_id = e.id AND bi.item_type = 'world_episode'
                      JOIN worlds w ON e.world_id = w.id
                      WHERE bi.block_id = b.id
                        AND w.world_category IN ('sports', 'motorsports')
                  )
              )
            ORDER BY b.created_at DESC
            LIMIT :limit
        """, params)

        return [dict(b) for b in blocks]

    @staticmethod
    async def get_next_live_sports_blocks(
        hours_ahead: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Get scheduled sports blocks in the next N hours.

        Useful for building a "What's On" sports schedule.
        """
        entries = execute_query("""
            SELECT
                cse.*,
                b.name as block_name,
                b.description as block_description,
                b.theme as block_theme,
                b.computed_duration_seconds,
                lc.name as channel_name,
                lc.slug as channel_slug
            FROM channel_schedule_entries cse
            JOIN blocks b ON cse.block_id = b.id
            JOIN linear_channels lc ON cse.channel_id = lc.id
            WHERE cse.status = 'scheduled'
              AND cse.start_time_utc >= NOW()
              AND cse.start_time_utc <= NOW() + :hours::interval
              AND (
                  b.theme ILIKE '%sport%'
                  OR EXISTS (
                      SELECT 1 FROM block_items bi
                      JOIN episodes e ON bi.item_id = e.id AND bi.item_type = 'world_episode'
                      JOIN worlds w ON e.world_id = w.id
                      WHERE bi.block_id = b.id
                        AND w.world_category IN ('sports', 'motorsports')
                  )
              )
            ORDER BY cse.start_time_utc
        """, {"hours": f"{hours_ahead} hours"})

        return [dict(e) for e in entries]

    @staticmethod
    async def get_sport_type_summary() -> Dict[str, Any]:
        """Get summary of sports content by type."""
        summary = execute_query("""
            SELECT
                sport_type,
                COUNT(*) as world_count,
                SUM(episode_count) as total_episodes,
                SUM(follower_count) as total_followers
            FROM v_sports_worlds
            WHERE sport_type IS NOT NULL
            GROUP BY sport_type
            ORDER BY world_count DESC
        """, {})

        # Group by category
        by_category = {}
        for sport_type, types in SPORT_TYPES.items():
            by_category[sport_type] = []

        for row in summary:
            st = row.get("sport_type")
            for cat, types in SPORT_TYPES.items():
                if st in types:
                    by_category[cat].append(dict(row))
                    break

        return {
            "by_sport_type": [dict(s) for s in summary],
            "by_category": by_category
        }
