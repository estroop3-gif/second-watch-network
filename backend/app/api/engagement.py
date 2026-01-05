"""
Engagement API
Endpoints for Creator Updates, Watch Streaks, and Achievements widgets
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, date, timedelta
from ..core.database import get_client, execute_query, execute_single

router = APIRouter(tags=["engagement"])


# =============================================================================
# CREATOR UPDATES - Announcements from followed worlds
# =============================================================================

@router.get("/followed-updates")
async def get_followed_updates(
    user_id: str,
    limit: int = Query(default=10, le=50),
    include_types: Optional[str] = Query(default=None, description="Comma-separated: bts,announcement,milestone,poll")
):
    """
    Get announcements/updates from worlds the user follows.
    Shows BTS content, announcements, milestones, and polls from creators.
    """
    try:
        # Build type filter if specified
        type_filter = ""
        if include_types:
            types = [t.strip() for t in include_types.split(",")]
            type_placeholders = ", ".join([f"'{t}'" for t in types])
            type_filter = f"AND wa.announcement_type IN ({type_placeholders})"

        query = f"""
            SELECT
                wa.id,
                wa.title,
                wa.content,
                wa.announcement_type,
                wa.image_url,
                wa.is_pinned,
                wa.created_at,
                w.id AS world_id,
                w.title AS world_title,
                w.slug AS world_slug,
                w.thumbnail_url AS world_thumbnail,
                p.id AS creator_id,
                p.display_name AS creator_name,
                p.avatar_url AS creator_avatar
            FROM world_announcements wa
            JOIN worlds w ON w.id = wa.world_id
            LEFT JOIN profiles p ON p.id = wa.created_by
            WHERE wa.is_published = TRUE
            AND w.id IN (
                SELECT ww.world_id
                FROM world_watchlist ww
                WHERE ww.user_id = :user_id
                UNION
                SELECT wf.world_id
                FROM world_follows wf
                WHERE wf.user_id = :user_id
            )
            {type_filter}
            ORDER BY wa.is_pinned DESC, wa.created_at DESC
            LIMIT :limit
        """

        updates = execute_query(
            query,
            {"user_id": user_id, "limit": limit}
        )

        return {
            "updates": updates,
            "count": len(updates)
        }

    except Exception as e:
        print(f"Error fetching followed updates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/worlds/{world_id}/announcements")
async def create_world_announcement(
    world_id: str,
    user_id: str,
    title: str,
    content: Optional[str] = None,
    announcement_type: str = "announcement",
    image_url: Optional[str] = None,
    is_pinned: bool = False
):
    """Create an announcement for a world (creator only)."""
    try:
        # Verify user owns the world
        world = execute_single(
            "SELECT creator_id FROM worlds WHERE id = :world_id",
            {"world_id": world_id}
        )

        if not world or world.get("creator_id") != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to post announcements for this world")

        client = get_client()
        result = client.table("world_announcements").insert({
            "world_id": world_id,
            "title": title,
            "content": content,
            "announcement_type": announcement_type,
            "image_url": image_url,
            "is_pinned": is_pinned,
            "created_by": user_id
        }).execute()

        return result.data[0] if result.data else None

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating announcement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# WATCH STREAKS - User watch statistics
# =============================================================================

@router.get("/watch-stats")
async def get_watch_stats(
    user_id: str,
    days: int = Query(default=14, le=90)
):
    """
    Get user's watch statistics and streak information.
    Returns daily stats for the specified period and current streak.
    """
    try:
        # Get streak info
        streak = execute_single(
            """
            SELECT
                current_streak,
                longest_streak,
                last_watch_date,
                streak_started_at,
                total_watch_days
            FROM user_watch_streaks
            WHERE user_id = :user_id
            """,
            {"user_id": user_id}
        )

        # Get daily stats for the period
        start_date = date.today() - timedelta(days=days)
        daily_stats = execute_query(
            """
            SELECT
                stat_date,
                minutes_watched,
                episodes_watched,
                shorts_watched,
                worlds_started
            FROM user_watch_stats
            WHERE user_id = :user_id
            AND stat_date >= :start_date
            ORDER BY stat_date DESC
            """,
            {"user_id": user_id, "start_date": start_date}
        )

        # Calculate totals for the period
        total_minutes = sum(s.get("minutes_watched", 0) for s in daily_stats)
        total_episodes = sum(s.get("episodes_watched", 0) for s in daily_stats)
        total_shorts = sum(s.get("shorts_watched", 0) for s in daily_stats)

        # Build calendar data (last 7 days)
        today = date.today()
        calendar = []
        stats_by_date = {s["stat_date"]: s for s in daily_stats}

        for i in range(7):
            d = today - timedelta(days=i)
            day_stat = stats_by_date.get(d, {})
            calendar.append({
                "date": d.isoformat(),
                "day_name": d.strftime("%a"),
                "watched": day_stat.get("minutes_watched", 0) > 0,
                "minutes": day_stat.get("minutes_watched", 0)
            })

        return {
            "streak": {
                "current": streak.get("current_streak", 0) if streak else 0,
                "longest": streak.get("longest_streak", 0) if streak else 0,
                "last_watch_date": streak.get("last_watch_date") if streak else None,
                "streak_started_at": streak.get("streak_started_at") if streak else None,
                "total_watch_days": streak.get("total_watch_days", 0) if streak else 0
            },
            "period_stats": {
                "days": days,
                "total_minutes": total_minutes,
                "total_episodes": total_episodes,
                "total_shorts": total_shorts,
                "avg_daily_minutes": round(total_minutes / days, 1) if days > 0 else 0
            },
            "calendar": list(reversed(calendar)),  # Oldest first
            "daily_stats": daily_stats
        }

    except Exception as e:
        print(f"Error fetching watch stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/watch-stats/record")
async def record_watch_activity(
    user_id: str,
    minutes_watched: int = 0,
    episodes_watched: int = 0,
    shorts_watched: int = 0,
    worlds_started: int = 0
):
    """
    Record watch activity for a user.
    Called by the player when content is watched.
    Updates both daily stats and streak information.
    """
    try:
        today = date.today()
        client = get_client()

        # Upsert daily stats
        existing = client.table("user_watch_stats").select("id").eq(
            "user_id", user_id
        ).eq("stat_date", today.isoformat()).execute()

        if existing.data:
            # Update existing
            client.table("user_watch_stats").update({
                "minutes_watched": client.rpc("increment", {"x": minutes_watched}),
                "episodes_watched": client.rpc("increment", {"x": episodes_watched}),
                "shorts_watched": client.rpc("increment", {"x": shorts_watched}),
                "worlds_started": client.rpc("increment", {"x": worlds_started}),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("user_id", user_id).eq("stat_date", today.isoformat()).execute()
        else:
            # Insert new
            client.table("user_watch_stats").insert({
                "user_id": user_id,
                "stat_date": today.isoformat(),
                "minutes_watched": minutes_watched,
                "episodes_watched": episodes_watched,
                "shorts_watched": shorts_watched,
                "worlds_started": worlds_started
            }).execute()

        # Update streak
        streak = client.table("user_watch_streaks").select("*").eq(
            "user_id", user_id
        ).execute()

        yesterday = today - timedelta(days=1)

        if streak.data:
            current = streak.data[0]
            last_watch = current.get("last_watch_date")

            if last_watch:
                last_watch_date = date.fromisoformat(str(last_watch))

                if last_watch_date == today:
                    # Already watched today, no streak update needed
                    pass
                elif last_watch_date == yesterday:
                    # Continuing streak
                    new_streak = current.get("current_streak", 0) + 1
                    client.table("user_watch_streaks").update({
                        "current_streak": new_streak,
                        "longest_streak": max(new_streak, current.get("longest_streak", 0)),
                        "last_watch_date": today.isoformat(),
                        "total_watch_days": current.get("total_watch_days", 0) + 1,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("user_id", user_id).execute()
                else:
                    # Streak broken, start new
                    client.table("user_watch_streaks").update({
                        "current_streak": 1,
                        "last_watch_date": today.isoformat(),
                        "streak_started_at": today.isoformat(),
                        "total_watch_days": current.get("total_watch_days", 0) + 1,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("user_id", user_id).execute()
            else:
                # First watch ever
                client.table("user_watch_streaks").update({
                    "current_streak": 1,
                    "last_watch_date": today.isoformat(),
                    "streak_started_at": today.isoformat(),
                    "total_watch_days": 1,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("user_id", user_id).execute()
        else:
            # Create new streak record
            client.table("user_watch_streaks").insert({
                "user_id": user_id,
                "current_streak": 1,
                "longest_streak": 1,
                "last_watch_date": today.isoformat(),
                "streak_started_at": today.isoformat(),
                "total_watch_days": 1
            }).execute()

        return {"success": True}

    except Exception as e:
        print(f"Error recording watch activity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# ACHIEVEMENTS
# =============================================================================

@router.get("/achievements")
async def get_achievements(user_id: str):
    """
    Get all achievements and user's progress/earned status.
    """
    try:
        # Get all active achievements
        achievements = execute_query(
            """
            SELECT
                a.id,
                a.name,
                a.description,
                a.icon_url,
                a.category,
                a.points,
                a.requirements,
                a.is_secret,
                a.sort_order,
                ua.progress,
                ua.earned_at,
                ua.is_displayed
            FROM achievements a
            LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = :user_id
            WHERE a.is_active = TRUE
            AND (a.is_secret = FALSE OR ua.earned_at IS NOT NULL)
            ORDER BY a.category, a.sort_order
            """,
            {"user_id": user_id}
        )

        # Calculate total points
        total_points = sum(
            a.get("points", 0)
            for a in achievements
            if a.get("earned_at")
        )

        # Group by category
        by_category = {}
        for a in achievements:
            cat = a.get("category", "general")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(a)

        # Count earned
        earned_count = sum(1 for a in achievements if a.get("earned_at"))

        return {
            "achievements": achievements,
            "by_category": by_category,
            "total_points": total_points,
            "earned_count": earned_count,
            "total_count": len(achievements)
        }

    except Exception as e:
        print(f"Error fetching achievements: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/achievements/recent")
async def get_recent_achievements(user_id: str, limit: int = 5):
    """Get user's most recently earned achievements."""
    try:
        achievements = execute_query(
            """
            SELECT
                a.id,
                a.name,
                a.description,
                a.icon_url,
                a.category,
                a.points,
                ua.earned_at
            FROM user_achievements ua
            JOIN achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = :user_id
            AND ua.earned_at IS NOT NULL
            ORDER BY ua.earned_at DESC
            LIMIT :limit
            """,
            {"user_id": user_id, "limit": limit}
        )

        return {"achievements": achievements}

    except Exception as e:
        print(f"Error fetching recent achievements: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/achievements/{achievement_id}/progress")
async def update_achievement_progress(
    achievement_id: str,
    user_id: str,
    progress: int
):
    """
    Update progress on an achievement.
    If progress meets threshold, marks as earned.
    """
    try:
        # Get achievement requirements
        achievement = execute_single(
            "SELECT requirements, points FROM achievements WHERE id = :id AND is_active = TRUE",
            {"id": achievement_id}
        )

        if not achievement:
            raise HTTPException(status_code=404, detail="Achievement not found")

        requirements = achievement.get("requirements", {})
        threshold = requirements.get("threshold", 0)

        # Check if already earned
        client = get_client()
        existing = client.table("user_achievements").select("*").eq(
            "user_id", user_id
        ).eq("achievement_id", achievement_id).execute()

        if existing.data and existing.data[0].get("earned_at"):
            return {"already_earned": True}

        # Determine if earned
        earned_at = None
        if progress >= threshold:
            earned_at = datetime.utcnow().isoformat()

        if existing.data:
            # Update
            client.table("user_achievements").update({
                "progress": progress,
                "earned_at": earned_at,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("user_id", user_id).eq("achievement_id", achievement_id).execute()
        else:
            # Insert
            client.table("user_achievements").insert({
                "user_id": user_id,
                "achievement_id": achievement_id,
                "progress": progress,
                "earned_at": earned_at
            }).execute()

        return {
            "progress": progress,
            "threshold": threshold,
            "newly_earned": earned_at is not None
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating achievement progress: {e}")
        raise HTTPException(status_code=500, detail=str(e))
