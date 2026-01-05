"""
Recommendation Service
Phase 3C: Simple, explainable recommendation engine.

This service provides:
- Personalized recommendations based on watch history
- Category/genre-based suggestions
- Lodge-affiliated content discovery
- Related Worlds for a given World
- Structured home page recommendation sections
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single

logger = logging.getLogger(__name__)


# Recommendation list types
RECOMMENDATION_TYPES = [
    'because_you_watched',
    'from_your_lodges',
    'trending_now',
    'top_in_category',
    'similar_worlds',
    'new_releases',
    'popular_sports',
    'hidden_gems'
]


class RecommendationService:
    """Service for generating personalized content recommendations."""

    @staticmethod
    async def get_home_recommendations(
        user_id: Optional[str] = None,
        limit_per_section: int = 12
    ) -> Dict[str, Any]:
        """
        Get structured recommendation sections for the home dashboard.

        Returns sections like:
        - Continue Watching
        - Because You Watched [X]
        - From Your Lodges
        - Trending Now
        - Top [Category]
        - New Releases
        """
        sections = []

        # Section 1: Continue Watching (only for logged-in users)
        if user_id:
            continue_watching = await RecommendationService._get_continue_watching(
                user_id, limit=limit_per_section
            )
            if continue_watching:
                sections.append({
                    "type": "continue_watching",
                    "title": "Continue Watching",
                    "worlds": continue_watching,
                    "reason": "Resume where you left off"
                })

        # Section 2: Because You Watched (personalized)
        if user_id:
            recent_world = await RecommendationService._get_most_recent_watched_world(user_id)
            if recent_world:
                because_watched = await RecommendationService.get_related_worlds(
                    recent_world["world_id"],
                    exclude_user_watched=True,
                    user_id=user_id,
                    limit=limit_per_section
                )
                if because_watched:
                    sections.append({
                        "type": "because_you_watched",
                        "title": f"Because You Watched {recent_world['title']}",
                        "reference_world": recent_world,
                        "worlds": because_watched,
                        "reason": f"Similar to {recent_world['title']}"
                    })

        # Section 3: From Your Lodges (if user is Order member)
        if user_id:
            lodge_content = await RecommendationService._get_lodge_recommendations(
                user_id, limit=limit_per_section
            )
            if lodge_content:
                sections.append({
                    "type": "from_your_lodges",
                    "title": "From Your Lodges",
                    "worlds": lodge_content,
                    "reason": "Content from your lodge community"
                })

        # Section 4: Trending Now (based on recent watch time)
        trending = await RecommendationService._get_trending_worlds(limit=limit_per_section)
        if trending:
            sections.append({
                "type": "trending_now",
                "title": "Trending Now",
                "worlds": trending,
                "reason": "Popular this week"
            })

        # Section 5: Top by preferred category (or default to narrative)
        preferred_category = None
        if user_id:
            preferred_category = await RecommendationService._get_user_preferred_category(user_id)

        category = preferred_category or 'narrative'
        category_display = category.replace('_', ' ').title()
        top_category = await RecommendationService._get_top_in_category(
            category, limit=limit_per_section
        )
        if top_category:
            sections.append({
                "type": "top_in_category",
                "title": f"Top {category_display}",
                "category": category,
                "worlds": top_category,
                "reason": f"Highly rated {category_display.lower()} content"
            })

        # Section 6: New Releases
        new_releases = await RecommendationService._get_new_releases(limit=limit_per_section)
        if new_releases:
            sections.append({
                "type": "new_releases",
                "title": "New Releases",
                "worlds": new_releases,
                "reason": "Recently premiered"
            })

        # Section 7: Sports & Motorsports (if relevant content exists)
        sports = await RecommendationService._get_sports_highlights(limit=limit_per_section)
        if sports:
            sections.append({
                "type": "popular_sports",
                "title": "Sports & Action",
                "worlds": sports,
                "reason": "Live events and athletic content"
            })

        # Section 8: Hidden Gems (good content with lower viewership)
        hidden_gems = await RecommendationService._get_hidden_gems(limit=limit_per_section)
        if hidden_gems:
            sections.append({
                "type": "hidden_gems",
                "title": "Hidden Gems",
                "worlds": hidden_gems,
                "reason": "Critically acclaimed, waiting to be discovered"
            })

        return {
            "sections": sections,
            "generated_at": datetime.utcnow().isoformat(),
            "personalized": user_id is not None
        }

    @staticmethod
    async def get_related_worlds(
        world_id: str,
        exclude_user_watched: bool = False,
        user_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get Worlds related to a given World.

        Factors:
        1. Pre-computed similarity scores (if available)
        2. Same world_category
        3. Shared genres
        4. Same creator/organization
        5. High overall watch time/earnings
        """
        # First try pre-computed similarity
        similar = execute_query("""
            SELECT
                CASE
                    WHEN wss.world_a_id = :world_id THEN wss.world_b_id
                    ELSE wss.world_a_id
                END as world_id,
                wss.total_similarity as score,
                'precomputed_similarity' as reason
            FROM world_similarity_scores wss
            WHERE wss.world_a_id = :world_id OR wss.world_b_id = :world_id
            ORDER BY wss.total_similarity DESC
            LIMIT :limit
        """, {"world_id": world_id, "limit": limit})

        if similar:
            world_ids = [str(s["world_id"]) for s in similar]
        else:
            # Fall back to category/genre matching
            world_ids = await RecommendationService._find_similar_by_attributes(
                world_id, limit=limit
            )

        if not world_ids:
            return []

        # Build exclusion clause for user's watched Worlds
        exclusion = ""
        params = {"world_ids": tuple(world_ids)}

        if exclude_user_watched and user_id:
            exclusion = """
                AND w.id NOT IN (
                    SELECT DISTINCT world_id FROM watch_history
                    WHERE user_id = :user_id
                )
            """
            params["user_id"] = user_id

        # Fetch full World details
        worlds = execute_query(f"""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.cover_art_wide_url,
                w.world_category,
                w.sub_category,
                w.content_format,
                w.maturity_rating,
                w.episode_count,
                w.follower_count,
                w.total_view_count,
                w.premiere_date
            FROM worlds w
            WHERE w.id = ANY(:world_ids::uuid[])
              AND w.status = 'active'
              AND w.visibility = 'public'
              {exclusion}
            ORDER BY w.follower_count DESC, w.total_view_count DESC
            LIMIT :limit
        """, {**params, "world_ids": list(world_ids), "limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def _find_similar_by_attributes(
        world_id: str,
        limit: int = 10
    ) -> List[str]:
        """Find similar Worlds by category, genre, and creator."""
        # Get source World's attributes
        source = execute_single("""
            SELECT
                w.world_category,
                w.sub_category,
                w.creator_id,
                w.organization_id,
                ARRAY(SELECT genre_id FROM world_genres WHERE world_id = w.id) as genre_ids
            FROM worlds w
            WHERE w.id = :world_id
        """, {"world_id": world_id})

        if not source:
            return []

        # Find matches by various criteria
        matches = execute_query("""
            WITH scored_worlds AS (
                SELECT
                    w.id,
                    -- Same category = 30 points
                    CASE WHEN w.world_category = :category THEN 30 ELSE 0 END
                    -- Same sub_category = 20 points
                    + CASE WHEN w.sub_category = :sub_category AND :sub_category IS NOT NULL THEN 20 ELSE 0 END
                    -- Same creator = 15 points
                    + CASE WHEN w.creator_id = :creator_id THEN 15 ELSE 0 END
                    -- Same org = 10 points
                    + CASE WHEN w.organization_id = :org_id AND :org_id IS NOT NULL THEN 10 ELSE 0 END
                    -- Shared genres (up to 25 points)
                    + COALESCE((
                        SELECT COUNT(*) * 5
                        FROM world_genres wg
                        WHERE wg.world_id = w.id
                          AND wg.genre_id = ANY(:genre_ids::uuid[])
                    ), 0)
                    as score
                FROM worlds w
                WHERE w.id != :world_id
                  AND w.status = 'active'
                  AND w.visibility = 'public'
            )
            SELECT id FROM scored_worlds
            WHERE score > 0
            ORDER BY score DESC
            LIMIT :limit
        """, {
            "world_id": world_id,
            "category": source.get("world_category"),
            "sub_category": source.get("sub_category"),
            "creator_id": source.get("creator_id"),
            "org_id": source.get("organization_id"),
            "genre_ids": source.get("genre_ids", []) or [],
            "limit": limit
        })

        return [str(m["id"]) for m in matches]

    @staticmethod
    async def _get_continue_watching(
        user_id: str,
        limit: int = 12
    ) -> List[Dict[str, Any]]:
        """Get Worlds with incomplete episodes for resume."""
        worlds = execute_query("""
            SELECT DISTINCT ON (w.id)
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.content_format,
                e.id as last_episode_id,
                e.title as last_episode_title,
                e.episode_number,
                s.season_number,
                wh.position_seconds,
                wh.total_duration_seconds,
                wh.updated_at as last_watched,
                ROUND(wh.position_seconds::numeric / NULLIF(wh.total_duration_seconds, 0) * 100, 1) as progress_percent
            FROM watch_history wh
            JOIN episodes e ON wh.episode_id = e.id
            JOIN worlds w ON e.world_id = w.id
            LEFT JOIN seasons s ON e.season_id = s.id
            WHERE wh.user_id = :user_id
              AND wh.completed = false
              AND wh.position_seconds > 30
              AND w.status = 'active'
            ORDER BY w.id, wh.updated_at DESC
            LIMIT :limit
        """, {"user_id": user_id, "limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def _get_most_recent_watched_world(user_id: str) -> Optional[Dict[str, Any]]:
        """Get the most recently watched World for 'Because you watched' section."""
        world = execute_single("""
            SELECT DISTINCT ON (w.id)
                w.id as world_id,
                w.title,
                w.slug,
                w.cover_art_url,
                w.world_category,
                MAX(wh.updated_at) as last_watched
            FROM watch_history wh
            JOIN episodes e ON wh.episode_id = e.id
            JOIN worlds w ON e.world_id = w.id
            WHERE wh.user_id = :user_id
              AND wh.completed = true
              AND w.status = 'active'
            GROUP BY w.id, w.title, w.slug, w.cover_art_url, w.world_category
            ORDER BY w.id, last_watched DESC
            LIMIT 1
        """, {"user_id": user_id})

        return dict(world) if world else None

    @staticmethod
    async def _get_lodge_recommendations(
        user_id: str,
        limit: int = 12
    ) -> List[Dict[str, Any]]:
        """Get Worlds from user's lodges and their featured shelves."""
        worlds = execute_query("""
            WITH user_lodges AS (
                SELECT lodge_id
                FROM order_lodge_memberships
                WHERE user_id = :user_id AND status = 'active'
            )
            SELECT DISTINCT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.content_format,
                w.follower_count,
                w.total_view_count,
                ol.name as lodge_name,
                lwf.is_highlighted,
                lwf.highlight_text
            FROM user_lodges ul
            JOIN lodge_world_features lwf ON ul.lodge_id = lwf.lodge_id
            JOIN worlds w ON lwf.world_id = w.id
            JOIN order_lodges ol ON ul.lodge_id = ol.id
            WHERE lwf.is_active = true
              AND w.status = 'active'
              AND w.visibility = 'public'
              AND (lwf.feature_end_date IS NULL OR lwf.feature_end_date >= CURRENT_DATE)
            ORDER BY lwf.is_highlighted DESC, lwf.display_order, w.follower_count DESC
            LIMIT :limit
        """, {"user_id": user_id, "limit": limit})

        # Also include Worlds originating from user's lodges
        if len(worlds) < limit:
            remaining = limit - len(worlds)
            existing_ids = [w["world_id"] for w in worlds]

            originating = execute_query("""
                WITH user_lodges AS (
                    SELECT lodge_id
                    FROM order_lodge_memberships
                    WHERE user_id = :user_id AND status = 'active'
                )
                SELECT
                    w.id as world_id,
                    w.title,
                    w.slug,
                    w.logline,
                    w.cover_art_url,
                    w.world_category,
                    w.content_format,
                    w.follower_count,
                    w.total_view_count,
                    ol.name as lodge_name,
                    false as is_highlighted,
                    NULL as highlight_text
                FROM user_lodges ul
                JOIN worlds w ON w.originating_lodge_id = ul.lodge_id
                JOIN order_lodges ol ON ul.lodge_id = ol.id
                WHERE w.status = 'active'
                  AND w.visibility = 'public'
                  AND w.id NOT IN (SELECT unnest(:existing_ids::uuid[]))
                ORDER BY w.premiere_date DESC NULLS LAST
                LIMIT :remaining
            """, {
                "user_id": user_id,
                "existing_ids": existing_ids or ['00000000-0000-0000-0000-000000000000'],
                "remaining": remaining
            })

            worlds = list(worlds) + [dict(o) for o in originating]

        return [dict(w) for w in worlds]

    @staticmethod
    async def _get_trending_worlds(limit: int = 12) -> List[Dict[str, Any]]:
        """Get Worlds trending based on recent watch time."""
        worlds = execute_query("""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.content_format,
                w.maturity_rating,
                w.episode_count,
                w.follower_count,
                w.total_view_count,
                COALESCE(recent.watch_seconds, 0) as recent_watch_seconds
            FROM worlds w
            LEFT JOIN (
                SELECT
                    world_id,
                    SUM(total_watch_seconds) as watch_seconds
                FROM world_watch_aggregates
                WHERE period_type = 'daily'
                  AND period_start >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY world_id
            ) recent ON w.id = recent.world_id
            WHERE w.status = 'active'
              AND w.visibility = 'public'
              AND w.episode_count > 0
            ORDER BY recent.watch_seconds DESC NULLS LAST, w.follower_count DESC
            LIMIT :limit
        """, {"limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def _get_user_preferred_category(user_id: str) -> Optional[str]:
        """Determine user's most-watched category."""
        result = execute_single("""
            SELECT w.world_category, COUNT(*) as watch_count
            FROM watch_history wh
            JOIN episodes e ON wh.episode_id = e.id
            JOIN worlds w ON e.world_id = w.id
            WHERE wh.user_id = :user_id
              AND w.world_category IS NOT NULL
            GROUP BY w.world_category
            ORDER BY watch_count DESC
            LIMIT 1
        """, {"user_id": user_id})

        return result.get("world_category") if result else None

    @staticmethod
    async def _get_top_in_category(
        category: str,
        limit: int = 12
    ) -> List[Dict[str, Any]]:
        """Get top Worlds in a specific category."""
        worlds = execute_query("""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.sub_category,
                w.content_format,
                w.maturity_rating,
                w.episode_count,
                w.follower_count,
                w.total_view_count,
                COALESCE(monthly.earnings_cents, 0) as monthly_earnings_cents
            FROM worlds w
            LEFT JOIN (
                SELECT world_id, SUM(gross_earnings_cents) as earnings_cents
                FROM world_earnings
                WHERE period_start >= DATE_TRUNC('month', CURRENT_DATE)
                GROUP BY world_id
            ) monthly ON w.id = monthly.world_id
            WHERE w.world_category = :category
              AND w.status = 'active'
              AND w.visibility = 'public'
              AND w.episode_count > 0
            ORDER BY
                monthly.earnings_cents DESC NULLS LAST,
                w.follower_count DESC,
                w.total_view_count DESC
            LIMIT :limit
        """, {"category": category, "limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def _get_new_releases(limit: int = 12) -> List[Dict[str, Any]]:
        """Get recently premiered Worlds."""
        worlds = execute_query("""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.content_format,
                w.maturity_rating,
                w.episode_count,
                w.follower_count,
                w.total_view_count,
                w.premiere_date
            FROM worlds w
            WHERE w.status = 'active'
              AND w.visibility = 'public'
              AND w.episode_count > 0
              AND w.premiere_date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY w.premiere_date DESC
            LIMIT :limit
        """, {"limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def _get_sports_highlights(limit: int = 12) -> List[Dict[str, Any]]:
        """Get popular sports and motorsports content."""
        worlds = execute_query("""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.sport_type,
                w.is_live_content,
                w.content_format,
                w.episode_count,
                w.follower_count,
                w.total_view_count,
                (SELECT COUNT(*) FROM sports_events se
                 WHERE se.world_id = w.id AND se.status = 'scheduled') as upcoming_events
            FROM worlds w
            WHERE w.world_category IN ('sports', 'motorsports')
              AND w.status = 'active'
              AND w.visibility = 'public'
            ORDER BY
                (SELECT COUNT(*) FROM sports_events se
                 WHERE se.world_id = w.id AND se.status = 'scheduled') DESC,
                w.is_live_content DESC,
                w.follower_count DESC
            LIMIT :limit
        """, {"limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def _get_hidden_gems(limit: int = 12) -> List[Dict[str, Any]]:
        """
        Get high-quality Worlds with lower viewership.

        "Hidden gems" are Worlds with:
        - Good completion rates
        - Decent earnings per viewer
        - But lower total view counts
        """
        worlds = execute_query("""
            WITH world_quality AS (
                SELECT
                    w.id,
                    w.total_view_count,
                    w.follower_count,
                    COALESCE(
                        (SELECT AVG(CASE WHEN wh.completed THEN 1.0 ELSE 0.0 END)
                         FROM watch_history wh
                         JOIN episodes e ON wh.episode_id = e.id
                         WHERE e.world_id = w.id),
                        0
                    ) as completion_rate,
                    COALESCE(
                        (SELECT SUM(gross_earnings_cents)
                         FROM world_earnings WHERE world_id = w.id),
                        0
                    ) as total_earnings
                FROM worlds w
                WHERE w.status = 'active'
                  AND w.visibility = 'public'
                  AND w.episode_count >= 3
                  AND w.total_view_count < 10000
                  AND w.total_view_count > 100
            )
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.content_format,
                w.maturity_rating,
                w.episode_count,
                w.follower_count,
                w.total_view_count,
                wq.completion_rate
            FROM world_quality wq
            JOIN worlds w ON wq.id = w.id
            WHERE wq.completion_rate > 0.5
            ORDER BY
                wq.completion_rate DESC,
                wq.total_earnings / GREATEST(wq.total_view_count, 1) DESC
            LIMIT :limit
        """, {"limit": limit})

        return [dict(w) for w in worlds]

    @staticmethod
    async def record_impression(
        user_id: str,
        world_id: str,
        recommendation_type: str,
        position: int,
        list_context: Optional[str] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record that a recommendation was shown to a user."""
        from app.core.database import execute_insert

        impression = execute_insert("""
            INSERT INTO recommendation_impressions (
                user_id, world_id, recommendation_type,
                position_in_list, list_context, recommendation_reason
            ) VALUES (
                :user_id, :world_id, :recommendation_type,
                :position, :list_context, :reason
            )
            RETURNING *
        """, {
            "user_id": user_id,
            "world_id": world_id,
            "recommendation_type": recommendation_type,
            "position": position,
            "list_context": list_context,
            "reason": reason
        })

        return dict(impression)

    @staticmethod
    async def record_click(impression_id: str) -> Optional[Dict[str, Any]]:
        """Record that a user clicked on a recommendation."""
        impression = execute_single("""
            UPDATE recommendation_impressions
            SET was_clicked = true, clicked_at = NOW()
            WHERE id = :impression_id
            RETURNING *
        """, {"impression_id": impression_id})

        return dict(impression) if impression else None

    @staticmethod
    async def update_user_preferences(user_id: str) -> Dict[str, Any]:
        """
        Compute and update user's watch preferences based on history.

        Called periodically to refresh preference data.
        """
        from app.core.database import execute_insert
        import json

        # Get category preferences
        categories = execute_query("""
            SELECT w.world_category, COUNT(*) as count,
                   SUM(wh.position_seconds) as watch_seconds
            FROM watch_history wh
            JOIN episodes e ON wh.episode_id = e.id
            JOIN worlds w ON e.world_id = w.id
            WHERE wh.user_id = :user_id
              AND w.world_category IS NOT NULL
            GROUP BY w.world_category
            ORDER BY watch_seconds DESC
        """, {"user_id": user_id})

        # Get genre preferences
        genres = execute_query("""
            SELECT g.name, g.id, COUNT(*) as count,
                   SUM(wh.position_seconds) as watch_seconds
            FROM watch_history wh
            JOIN episodes e ON wh.episode_id = e.id
            JOIN worlds w ON e.world_id = w.id
            JOIN world_genres wg ON w.id = wg.world_id
            JOIN genres g ON wg.genre_id = g.id
            WHERE wh.user_id = :user_id
            GROUP BY g.id, g.name
            ORDER BY watch_seconds DESC
            LIMIT 10
        """, {"user_id": user_id})

        # Get sport type preferences (if applicable)
        sport_types = execute_query("""
            SELECT w.sport_type, COUNT(*) as count,
                   SUM(wh.position_seconds) as watch_seconds
            FROM watch_history wh
            JOIN episodes e ON wh.episode_id = e.id
            JOIN worlds w ON e.world_id = w.id
            WHERE wh.user_id = :user_id
              AND w.sport_type IS NOT NULL
            GROUP BY w.sport_type
            ORDER BY watch_seconds DESC
        """, {"user_id": user_id})

        # Calculate avg session and completion rate
        stats = execute_single("""
            SELECT
                AVG(position_seconds / 60.0) as avg_session_minutes,
                AVG(CASE WHEN completed THEN 1.0 ELSE 0.0 END) as completion_rate
            FROM watch_history
            WHERE user_id = :user_id
        """, {"user_id": user_id})

        # Format preferences
        category_prefs = {c["world_category"]: c["watch_seconds"] for c in categories}
        genre_prefs = {g["name"]: g["watch_seconds"] for g in genres}
        sport_prefs = {s["sport_type"]: s["watch_seconds"] for s in sport_types}

        # Upsert preferences
        prefs = execute_insert("""
            INSERT INTO user_watch_preferences (
                user_id,
                preferred_categories,
                preferred_genres,
                preferred_sport_types,
                avg_watch_session_minutes,
                completion_rate,
                updated_at
            ) VALUES (
                :user_id,
                :categories,
                :genres,
                :sport_types,
                :avg_session,
                :completion_rate,
                NOW()
            )
            ON CONFLICT (user_id) DO UPDATE SET
                preferred_categories = EXCLUDED.preferred_categories,
                preferred_genres = EXCLUDED.preferred_genres,
                preferred_sport_types = EXCLUDED.preferred_sport_types,
                avg_watch_session_minutes = EXCLUDED.avg_watch_session_minutes,
                completion_rate = EXCLUDED.completion_rate,
                updated_at = NOW()
            RETURNING *
        """, {
            "user_id": user_id,
            "categories": json.dumps(category_prefs),
            "genres": json.dumps(genre_prefs),
            "sport_types": json.dumps(sport_prefs),
            "avg_session": int(stats.get("avg_session_minutes", 0)) if stats else 0,
            "completion_rate": float(stats.get("completion_rate", 0)) if stats else 0
        })

        logger.info("user_preferences_updated", user_id=user_id)

        return dict(prefs)

    @staticmethod
    async def get_category_recommendations(
        category: str,
        user_id: Optional[str] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Get recommendations for a specific category page.

        Includes:
        - Featured in category
        - Trending in category
        - New in category
        """
        sections = []

        # Featured (top earners)
        featured = await RecommendationService._get_top_in_category(category, limit=8)
        if featured:
            sections.append({
                "type": "featured",
                "title": "Featured",
                "worlds": featured
            })

        # Trending
        trending = execute_query("""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.sub_category,
                w.content_format,
                w.follower_count,
                COALESCE(recent.watch_seconds, 0) as recent_watch_seconds
            FROM worlds w
            LEFT JOIN (
                SELECT world_id, SUM(total_watch_seconds) as watch_seconds
                FROM world_watch_aggregates
                WHERE period_type = 'daily'
                  AND period_start >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY world_id
            ) recent ON w.id = recent.world_id
            WHERE w.world_category = :category
              AND w.status = 'active'
              AND w.visibility = 'public'
            ORDER BY recent.watch_seconds DESC NULLS LAST
            LIMIT :limit
        """, {"category": category, "limit": limit})

        if trending:
            sections.append({
                "type": "trending",
                "title": "Trending",
                "worlds": [dict(t) for t in trending]
            })

        # New releases in category
        new_releases = execute_query("""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.world_category,
                w.content_format,
                w.premiere_date
            FROM worlds w
            WHERE w.world_category = :category
              AND w.status = 'active'
              AND w.visibility = 'public'
              AND w.premiere_date >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY w.premiere_date DESC
            LIMIT :limit
        """, {"category": category, "limit": limit})

        if new_releases:
            sections.append({
                "type": "new_releases",
                "title": "New Releases",
                "worlds": [dict(n) for n in new_releases]
            })

        return {
            "category": category,
            "sections": sections
        }
