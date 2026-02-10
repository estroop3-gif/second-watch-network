"""
Recommendations API - Personalized Content Discovery
Phase 3C: Enhanced with structured sections, related Worlds, and sports recommendations.

Provides:
- Personalized "For You" recommendations
- Structured home page sections
- Related Worlds for a given World
- Category-specific recommendations
- Sports/motorsports highlights
- Impression tracking for analytics
"""
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from app.core.database import get_client, execute_query, execute_single
from app.core.auth import get_current_user, get_current_user_optional
from app.services.recommendation_service import RecommendationService
from app.services.sports_schedule_service import SportsScheduleService

router = APIRouter()


# =============================================================================
# Response Models
# =============================================================================

class RecommendedItem(BaseModel):
    """A recommended content item (world or episode)"""
    id: str
    type: str  # "world" or "episode"
    title: str
    slug: Optional[str] = None
    thumbnail_url: Optional[str] = None
    cover_art_url: Optional[str] = None
    logline: Optional[str] = None
    content_format: Optional[str] = None
    maturity_rating: Optional[str] = None
    duration_seconds: Optional[int] = None
    episode_number: Optional[int] = None
    season_number: Optional[int] = None
    world_id: Optional[str] = None
    world_title: Optional[str] = None
    world_slug: Optional[str] = None
    reason: Optional[str] = None  # Why this was recommended


class FreeContentItem(BaseModel):
    """Free/public content for guests"""
    id: str
    type: str  # "live_event", "fast_channel", "free_world"
    title: str
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    viewer_count: Optional[int] = None


class RecordImpressionRequest(BaseModel):
    world_id: str
    recommendation_type: str
    position: int = Field(ge=0)
    list_context: Optional[str] = None
    reason: Optional[str] = None


class RecordImpressionsRequest(BaseModel):
    impressions: List[RecordImpressionRequest]


# =============================================================================
# Home Recommendations (Phase 3C) - Structured Sections
# =============================================================================

@router.get("/home")
async def get_home_recommendations(
    limit_per_section: int = Query(12, ge=1, le=50),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get personalized recommendation sections for the home dashboard.

    Returns structured sections including:
    - Continue Watching (logged-in users)
    - Because You Watched [X] (logged-in users)
    - From Your Lodges (Order members)
    - Trending Now
    - Top [Category]
    - New Releases
    - Sports & Action
    - Hidden Gems
    """
    user_id = None
    if current_user:
        profile = execute_single(
            "SELECT id FROM profiles WHERE cognito_sub = :sub",
            {"sub": current_user.get("sub")}
        )
        if profile:
            user_id = str(profile["id"])

    recommendations = await RecommendationService.get_home_recommendations(
        user_id=user_id,
        limit_per_section=limit_per_section
    )

    return recommendations


# =============================================================================
# Related Worlds (Phase 3C)
# =============================================================================

@router.get("/worlds/{world_id}/related")
async def get_related_worlds(
    world_id: str,
    limit: int = Query(10, ge=1, le=50),
    exclude_watched: bool = Query(True),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get Worlds related to a specific World.

    Factors in:
    - Pre-computed similarity scores
    - Same category/sub-category
    - Shared genres
    - Same creator/organization
    - Overall popularity
    """
    # Verify World exists
    world = execute_single(
        "SELECT id, title FROM worlds WHERE id = :id",
        {"id": world_id}
    )
    if not world:
        raise HTTPException(404, "World not found")

    user_id = None
    if current_user and exclude_watched:
        profile = execute_single(
            "SELECT id FROM profiles WHERE cognito_sub = :sub",
            {"sub": current_user.get("sub")}
        )
        if profile:
            user_id = str(profile["id"])

    related = await RecommendationService.get_related_worlds(
        world_id=world_id,
        exclude_user_watched=exclude_watched,
        user_id=user_id,
        limit=limit
    )

    return {
        "world_id": world_id,
        "world_title": world["title"],
        "related_worlds": related,
        "count": len(related)
    }


# =============================================================================
# Category Recommendations (Phase 3C)
# =============================================================================

@router.get("/category/{category}")
async def get_category_recommendations(
    category: str,
    limit: int = Query(20, ge=1, le=50),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """
    Get recommendations for a specific category page.

    Valid categories:
    - narrative, documentary, sports, motorsports
    - testimony, worship, educational, experimental
    - podcast, news, other
    """
    valid_categories = [
        'narrative', 'documentary', 'sports', 'motorsports',
        'testimony', 'worship', 'educational', 'experimental',
        'podcast', 'news', 'other'
    ]

    if category not in valid_categories:
        raise HTTPException(400, f"Invalid category. Valid: {', '.join(valid_categories)}")

    user_id = None
    if current_user:
        profile = execute_single(
            "SELECT id FROM profiles WHERE cognito_sub = :sub",
            {"sub": current_user.get("sub")}
        )
        if profile:
            user_id = str(profile["id"])

    recommendations = await RecommendationService.get_category_recommendations(
        category=category,
        user_id=user_id,
        limit=limit
    )

    return recommendations


# =============================================================================
# Sports Recommendations (Phase 3C)
# =============================================================================

@router.get("/sports")
async def get_sports_recommendations(
    sport_type: Optional[str] = None,
    include_upcoming_events: bool = True,
    limit: int = Query(20, ge=1, le=50)
):
    """
    Get sports and motorsports content recommendations.

    Includes:
    - Live events (if any)
    - Upcoming events
    - Popular sports Worlds
    - Sports by type breakdown
    """
    sections = []

    # Live events section
    if include_upcoming_events:
        live_events = await SportsScheduleService.get_live_sports_events()
        if live_events:
            sections.append({
                "type": "live_now",
                "title": "Live Now",
                "events": live_events
            })

        upcoming = await SportsScheduleService.get_upcoming_sports_events(
            days=7,
            sport_type=sport_type,
            limit=10
        )
        if upcoming:
            sections.append({
                "type": "upcoming_events",
                "title": "Upcoming Events",
                "events": upcoming
            })

    # Sports Worlds
    sports_result = await SportsScheduleService.get_sports_worlds(
        sport_type=sport_type,
        limit=limit
    )
    if sports_result.get("worlds"):
        sections.append({
            "type": "sports_worlds",
            "title": "Sports Channels",
            "worlds": sports_result["worlds"],
            "total": sports_result["total"]
        })

    # Sport type breakdown
    summary = await SportsScheduleService.get_sport_type_summary()
    if summary.get("by_sport_type"):
        sections.append({
            "type": "by_sport_type",
            "title": "Browse by Sport",
            "summary": summary
        })

    return {
        "sections": sections,
        "sport_type_filter": sport_type
    }


# =============================================================================
# For You - Personalized Recommendations (Authenticated)
# =============================================================================

@router.get("/for-you", response_model=List[RecommendedItem])
async def get_for_you_recommendations(
    limit: int = Query(default=12, le=24),
    user=Depends(get_current_user)
):
    """
    Get personalized content recommendations for authenticated user.

    Algorithm:
    1. Get user's watch history (last 30 days) to extract genre preferences
    2. Mix in content from followed creators
    3. Query worlds AND episodes matching those genres
    4. Add trending content to fill gaps
    5. Return mixed results
    """
    try:
        user_id = user.get("id")
        results = []

        # Step 1: Get user's genre preferences from watch history
        genre_query = """
            SELECT gt.slug, gt.name, COUNT(*) as watch_count
            FROM watch_history wh
            JOIN worlds w ON w.id = wh.world_id
            JOIN world_genres wg ON wg.world_id = w.id
            JOIN genre_tags gt ON gt.id = wg.genre_id
            WHERE wh.user_id = :user_id
              AND wh.last_watched_at > :since_date
            GROUP BY gt.slug, gt.name
            ORDER BY watch_count DESC
            LIMIT 5
        """
        since_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
        preferred_genres = execute_query(genre_query, {
            "user_id": user_id,
            "since_date": since_date
        }) or []

        genre_slugs = [g["slug"] for g in preferred_genres]

        # Step 2: Get IDs of already watched/in-progress content (to exclude)
        watched_query = """
            SELECT DISTINCT world_id
            FROM watch_history
            WHERE user_id = :user_id
              AND completed = TRUE
              AND last_watched_at > :since_date
        """
        watched = execute_query(watched_query, {
            "user_id": user_id,
            "since_date": (datetime.utcnow() - timedelta(days=90)).isoformat()
        }) or []
        watched_world_ids = [w["world_id"] for w in watched if w["world_id"]]

        # Step 3: Get content from followed creators
        followed_query = """
            SELECT
                w.id::text, 'world' as type, w.title, w.slug, w.thumbnail_url,
                w.cover_art_url, w.logline, w.content_format, w.maturity_rating,
                NULL::int as duration_seconds, NULL::int as episode_number,
                NULL::int as season_number, NULL::text as world_id,
                NULL as world_title, NULL as world_slug,
                'From creators you follow' as reason
            FROM worlds w
            JOIN world_follows wf ON wf.world_id = w.id
            WHERE wf.user_id = :user_id
              AND w.visibility = 'public'
              AND w.status = 'active'
              AND w.id NOT IN (SELECT unnest(:watched_ids::uuid[]))
            ORDER BY w.updated_at DESC
            LIMIT 4
        """
        followed_content = execute_query(followed_query, {
            "user_id": user_id,
            "watched_ids": watched_world_ids if watched_world_ids else [None]
        }) or []
        results.extend(followed_content)

        # Step 4: Get worlds matching preferred genres
        if genre_slugs:
            genre_worlds_query = """
                SELECT DISTINCT
                    w.id::text, 'world' as type, w.title, w.slug, w.thumbnail_url,
                    w.cover_art_url, w.logline, w.content_format, w.maturity_rating,
                    NULL::int as duration_seconds, NULL::int as episode_number,
                    NULL::int as season_number, NULL::text as world_id,
                    NULL as world_title, NULL as world_slug,
                    'Based on your viewing history' as reason
                FROM worlds w
                JOIN world_genres wg ON wg.world_id = w.id
                JOIN genre_tags gt ON gt.id = wg.genre_id
                WHERE gt.slug = ANY(:genre_slugs)
                  AND w.visibility = 'public'
                  AND w.status = 'active'
                  AND w.id NOT IN (SELECT unnest(:watched_ids::uuid[]))
                  AND w.id NOT IN (SELECT unnest(:existing_ids::uuid[]))
                ORDER BY w.follower_count DESC
                LIMIT 4
            """
            existing_ids = [r["id"] for r in results]
            genre_worlds = execute_query(genre_worlds_query, {
                "genre_slugs": genre_slugs,
                "watched_ids": watched_world_ids if watched_world_ids else [None],
                "existing_ids": existing_ids if existing_ids else [None]
            }) or []
            results.extend(genre_worlds)

        # Step 5: Get recent episodes from popular worlds
        episodes_query = """
            SELECT
                wc.id::text, 'episode' as type, wc.title, NULL as slug, wc.thumbnail_url,
                NULL as cover_art_url, wc.description as logline, NULL as content_format,
                NULL as maturity_rating, wc.duration_seconds, COALESCE(wc.sort_order, 0) as episode_number,
                NULL::int as season_number, w.id::text as world_id, w.title as world_title, w.slug as world_slug,
                'New episode' as reason
            FROM world_content wc
            JOIN worlds w ON w.id = wc.world_id
            WHERE w.visibility = 'public'
              AND wc.status = 'published'
              AND wc.published_at > :since_date
              AND w.id NOT IN (SELECT unnest(:watched_ids::uuid[]))
            ORDER BY wc.published_at DESC
            LIMIT 4
        """
        new_episodes = execute_query(episodes_query, {
            "since_date": (datetime.utcnow() - timedelta(days=14)).isoformat(),
            "watched_ids": watched_world_ids if watched_world_ids else [None]
        }) or []
        results.extend(new_episodes)

        # Step 6: Fill remaining slots with trending content
        remaining = limit - len(results)
        if remaining > 0:
            existing_ids = [r["id"] for r in results]
            trending_query = """
                SELECT
                    w.id::text, 'world' as type, w.title, w.slug, w.thumbnail_url,
                    w.cover_art_url, w.logline, w.content_format, w.maturity_rating,
                    NULL::int as duration_seconds, NULL::int as episode_number,
                    NULL::int as season_number, NULL::text as world_id,
                    NULL as world_title, NULL as world_slug,
                    'Trending' as reason
                FROM worlds w
                WHERE w.visibility = 'public'
                  AND w.status = 'active'
                  AND w.id NOT IN (SELECT unnest(:existing_ids::uuid[]))
                ORDER BY w.follower_count DESC, w.updated_at DESC
                LIMIT :limit
            """
            trending = execute_query(trending_query, {
                "existing_ids": existing_ids if existing_ids else [None],
                "limit": remaining
            }) or []
            results.extend(trending)

        return results[:limit]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# For You V2 (Phase 3C) - Enhanced with Lodge + Similarity
# =============================================================================

@router.get("/for-you-v2")
async def get_for_you_v2(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a personalized "For You" feed combining multiple signals (Phase 3C).

    This enhanced version draws from:
    - Category preferences
    - Genre preferences
    - Lodge content
    - Similar to watched
    - Trending
    """
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    user_id = str(profile["id"])

    # Get user preferences
    prefs = execute_single(
        "SELECT * FROM user_watch_preferences WHERE user_id = :user_id",
        {"user_id": user_id}
    )

    # Build personalized query with scoring
    worlds = execute_query("""
        WITH user_lodges AS (
            SELECT lodge_id FROM order_lodge_memberships
            WHERE user_id = :user_id AND status = 'active'
        ),
        watched_worlds AS (
            SELECT DISTINCT e.world_id
            FROM watch_history wh
            JOIN episodes e ON wh.episode_id = e.id
            WHERE wh.user_id = :user_id
        ),
        scored_worlds AS (
            SELECT
                w.id,
                -- Base score from popularity
                (w.follower_count / 100.0) +
                -- Trending bonus
                COALESCE((
                    SELECT SUM(total_watch_seconds) / 10000.0
                    FROM world_watch_aggregates
                    WHERE world_id = w.id
                      AND period_type = 'daily'
                      AND period_start >= CURRENT_DATE - INTERVAL '7 days'
                ), 0) +
                -- Lodge affiliation bonus
                CASE WHEN w.originating_lodge_id IN (SELECT lodge_id FROM user_lodges) THEN 50 ELSE 0 END +
                -- Featured by user's lodge bonus
                CASE WHEN EXISTS (
                    SELECT 1 FROM lodge_world_features lwf
                    WHERE lwf.world_id = w.id
                      AND lwf.lodge_id IN (SELECT lodge_id FROM user_lodges)
                      AND lwf.is_active = true
                ) THEN 30 ELSE 0 END +
                -- New release bonus
                CASE WHEN w.premiere_date >= CURRENT_DATE - INTERVAL '14 days' THEN 20 ELSE 0 END
                as score
            FROM worlds w
            WHERE w.status = 'active'
              AND w.visibility = 'public'
              AND w.episode_count > 0
              AND w.id NOT IN (SELECT world_id FROM watched_worlds)
        )
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
            w.premiere_date,
            sw.score
        FROM scored_worlds sw
        JOIN worlds w ON sw.id = w.id
        ORDER BY sw.score DESC
        LIMIT :limit OFFSET :offset
    """, {"user_id": user_id, "limit": limit, "offset": offset})

    return {
        "worlds": [dict(w) for w in worlds],
        "count": len(worlds),
        "offset": offset,
        "has_preferences": prefs is not None
    }


# =============================================================================
# Watch Free - Public Content for Guests (Unauthenticated)
# =============================================================================

@router.get("/watch-free", response_model=List[FreeContentItem])
async def get_free_content(
    limit: int = Query(default=12, le=24)
):
    """
    Get free/public content for unauthenticated users.
    Returns: public livestreams, FAST channels, and free worlds.
    """
    try:
        results = []

        # Get live/upcoming public events
        live_events_query = """
            SELECT
                id::text, 'live_event' as type, title, thumbnail_url,
                description, status, scheduled_start,
                peak_concurrent_viewers as viewer_count
            FROM live_events
            WHERE visibility = 'public'
              AND status IN ('live', 'scheduled', 'starting')
              AND (scheduled_start IS NULL OR scheduled_start < :future_date)
            ORDER BY
                CASE status
                    WHEN 'live' THEN 1
                    WHEN 'starting' THEN 2
                    WHEN 'scheduled' THEN 3
                END,
                scheduled_start ASC
            LIMIT 6
        """
        future_date = (datetime.utcnow() + timedelta(hours=24)).isoformat()
        live_events = execute_query(live_events_query, {"future_date": future_date}) or []
        results.extend(live_events)

        # Get free/public worlds (free tier content)
        free_worlds_query = """
            SELECT
                id::text, 'free_world' as type, title, thumbnail_url,
                logline as description, status, NULL::timestamptz as scheduled_start,
                follower_count as viewer_count
            FROM worlds
            WHERE visibility = 'public'
              AND status = 'active'
            ORDER BY follower_count DESC
            LIMIT :limit
        """
        remaining = limit - len(results)
        free_worlds = execute_query(free_worlds_query, {"limit": remaining}) or []
        results.extend(free_worlds)

        return results[:limit]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# Trending - General Trending Content
# =============================================================================

@router.get("/trending", response_model=List[RecommendedItem])
async def get_trending(
    limit: int = Query(default=12, le=24),
    content_format: Optional[str] = None,
    category: Optional[str] = None
):
    """Get trending content across the platform."""
    try:
        query = """
            SELECT
                w.id::text, 'world' as type, w.title, w.slug, w.thumbnail_url,
                w.cover_art_url, w.logline, w.content_format, w.maturity_rating,
                NULL::int as duration_seconds, NULL::int as episode_number,
                NULL::int as season_number, NULL::text as world_id,
                NULL as world_title, NULL as world_slug,
                'Trending' as reason
            FROM worlds w
            WHERE w.visibility = 'public'
              AND w.status = 'active'
        """
        params = {"limit": limit}

        if content_format:
            query += " AND w.content_format = :content_format"
            params["content_format"] = content_format

        if category:
            query += " AND w.world_category = :category"
            params["category"] = category

        query += " ORDER BY w.follower_count DESC, w.updated_at DESC LIMIT :limit"

        results = execute_query(query, params) or []
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =============================================================================
# New Releases (Phase 3C)
# =============================================================================

@router.get("/new-releases")
async def get_new_releases(
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = None
):
    """Get recently premiered Worlds."""
    params = {"limit": limit}
    category_filter = ""

    if category:
        category_filter = "AND w.world_category = :category"
        params["category"] = category

    worlds = execute_query(f"""
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
            w.premiere_date
        FROM worlds w
        WHERE w.status = 'active'
          AND w.visibility = 'public'
          AND w.episode_count > 0
          AND w.premiere_date >= CURRENT_DATE - INTERVAL '30 days'
          {category_filter}
        ORDER BY w.premiere_date DESC
        LIMIT :limit
    """, params)

    return {
        "worlds": [dict(w) for w in worlds],
        "count": len(worlds),
        "category": category
    }


# =============================================================================
# Hidden Gems (Phase 3C)
# =============================================================================

@router.get("/hidden-gems")
async def get_hidden_gems(
    limit: int = Query(20, ge=1, le=50)
):
    """
    Get high-quality Worlds with lower viewership.

    These are "hidden gems" - content with good completion rates
    and engagement but fewer total views.
    """
    worlds = await RecommendationService._get_hidden_gems(limit)

    return {
        "worlds": worlds,
        "count": len(worlds),
        "description": "Critically acclaimed content waiting to be discovered"
    }


# =============================================================================
# Impression Tracking (Phase 3C)
# =============================================================================

@router.post("/impressions")
async def record_impressions(
    request: RecordImpressionsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Record that recommendations were shown to a user.

    Used for tracking recommendation effectiveness.
    """
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    user_id = str(profile["id"])
    impression_ids = []

    for imp in request.impressions:
        result = await RecommendationService.record_impression(
            user_id=user_id,
            world_id=imp.world_id,
            recommendation_type=imp.recommendation_type,
            position=imp.position,
            list_context=imp.list_context,
            reason=imp.reason
        )
        impression_ids.append(result["id"])

    return {
        "recorded": len(impression_ids),
        "impression_ids": impression_ids
    }


@router.post("/impressions/{impression_id}/click")
async def record_impression_click(
    impression_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Record that a user clicked on a recommendation."""
    result = await RecommendationService.record_click(impression_id)

    if not result:
        raise HTTPException(404, "Impression not found")

    return {"success": True, "impression": result}


# =============================================================================
# User Preferences (Phase 3C)
# =============================================================================

@router.post("/preferences/update")
async def update_user_preferences(
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger preference update based on watch history.

    Normally called periodically, but users can request a refresh.
    """
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    user_id = str(profile["id"])
    prefs = await RecommendationService.update_user_preferences(user_id)

    return {
        "success": True,
        "preferences": prefs
    }


@router.get("/preferences")
async def get_user_preferences(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's computed watch preferences."""
    profile = execute_single(
        "SELECT id FROM profiles WHERE cognito_sub = :sub",
        {"sub": current_user.get("sub")}
    )
    if not profile:
        raise HTTPException(404, "Profile not found")

    prefs = execute_single(
        "SELECT * FROM user_watch_preferences WHERE user_id = :user_id",
        {"user_id": str(profile["id"])}
    )

    if not prefs:
        return {
            "preferences": None,
            "message": "No preferences computed yet. Watch some content first!"
        }

    return {"preferences": dict(prefs)}
