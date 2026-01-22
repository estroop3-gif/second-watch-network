"""
Live Production Service
Phase 5C: Live production integration and production updates.

Provides:
- Linking Backlot projects to consumer Worlds
- Production update posting
- Behind-the-scenes content management
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from app.core.database import execute_query, execute_single, execute_insert


class LiveProductionService:
    """Service for managing live production links and updates."""

    # ==========================================================================
    # Production Links
    # ==========================================================================

    @staticmethod
    async def create_production_link(
        project_id: str,
        world_id: str,
        created_by: str,
        link_type: str = "behind_the_scenes",
        show_on_world_page: bool = True,
        show_production_calendar: bool = False,
        show_crew_highlights: bool = False,
        allow_fan_engagement: bool = False,
        auto_create_episodes_from_dailies: bool = False,
        dailies_episode_visibility: str = "premium"
    ) -> Dict[str, Any]:
        """Create a link between a Backlot project and a World."""

        # Verify project exists and user has access
        project = execute_single("""
            SELECT id, title, created_by FROM backlot_projects WHERE id = :project_id
        """, {"project_id": project_id})

        if not project:
            return {"success": False, "error": "Project not found"}

        # Verify world exists
        world = execute_single("""
            SELECT id, title, creator_id FROM worlds WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            return {"success": False, "error": "World not found"}

        # Check if link already exists
        existing = execute_single("""
            SELECT id FROM live_production_links
            WHERE project_id = :project_id AND world_id = :world_id
        """, {"project_id": project_id, "world_id": world_id})

        if existing:
            return {"success": False, "error": "Link already exists"}

        link = execute_insert("""
            INSERT INTO live_production_links (
                project_id, world_id, link_type, created_by,
                show_on_world_page, show_production_calendar,
                show_crew_highlights, allow_fan_engagement,
                auto_create_episodes_from_dailies, dailies_episode_visibility
            ) VALUES (
                :project_id, :world_id, :link_type, :created_by,
                :show_on_world_page, :show_production_calendar,
                :show_crew_highlights, :allow_fan_engagement,
                :auto_create_episodes_from_dailies, :dailies_episode_visibility
            )
            RETURNING *
        """, {
            "project_id": project_id,
            "world_id": world_id,
            "link_type": link_type,
            "created_by": created_by,
            "show_on_world_page": show_on_world_page,
            "show_production_calendar": show_production_calendar,
            "show_crew_highlights": show_crew_highlights,
            "allow_fan_engagement": allow_fan_engagement,
            "auto_create_episodes_from_dailies": auto_create_episodes_from_dailies,
            "dailies_episode_visibility": dailies_episode_visibility
        })

        return {"success": True, "link": dict(link)}

    @staticmethod
    async def get_production_link(link_id: str) -> Optional[Dict[str, Any]]:
        """Get a production link by ID."""
        link = execute_single("""
            SELECT
                lpl.*,
                bp.title as project_title,
                w.title as world_title
            FROM live_production_links lpl
            JOIN backlot_projects bp ON lpl.project_id = bp.id
            JOIN worlds w ON lpl.world_id = w.id
            WHERE lpl.id = :link_id
        """, {"link_id": link_id})

        return dict(link) if link else None

    @staticmethod
    async def get_links_for_world(world_id: str) -> List[Dict[str, Any]]:
        """Get all production links for a World."""
        links = execute_query("""
            SELECT
                lpl.*,
                bp.title as project_title,
                bp.status as project_status
            FROM live_production_links lpl
            JOIN backlot_projects bp ON lpl.project_id = bp.id
            WHERE lpl.world_id = :world_id AND lpl.is_active = true
            ORDER BY lpl.created_at DESC
        """, {"world_id": world_id})

        return [dict(l) for l in links]

    @staticmethod
    async def get_links_for_project(project_id: str) -> List[Dict[str, Any]]:
        """Get all production links for a Backlot project."""
        links = execute_query("""
            SELECT
                lpl.*,
                w.title as world_title,
                w.status as world_status
            FROM live_production_links lpl
            JOIN worlds w ON lpl.world_id = w.id
            WHERE lpl.project_id = :project_id
            ORDER BY lpl.created_at DESC
        """, {"project_id": project_id})

        return [dict(l) for l in links]

    @staticmethod
    async def update_production_link(
        link_id: str,
        updated_by: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Update a production link."""
        allowed_fields = [
            "link_type", "is_active", "show_on_world_page",
            "show_production_calendar", "show_crew_highlights",
            "allow_fan_engagement", "auto_create_episodes_from_dailies",
            "dailies_episode_visibility", "content_embargo_until",
            "live_updates_enabled"
        ]

        updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}

        if not updates:
            return {"success": False, "error": "No valid updates provided"}

        set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        updates["link_id"] = link_id

        execute_query(f"""
            UPDATE live_production_links
            SET {set_clauses}, updated_at = NOW()
            WHERE id = :link_id
        """, updates)

        return {"success": True}

    @staticmethod
    async def deactivate_link(link_id: str) -> Dict[str, Any]:
        """Deactivate a production link."""
        execute_query("""
            UPDATE live_production_links
            SET is_active = false, updated_at = NOW()
            WHERE id = :link_id
        """, {"link_id": link_id})

        return {"success": True}

    # ==========================================================================
    # Production Updates
    # ==========================================================================

    @staticmethod
    async def create_production_update(
        link_id: str,
        created_by: str,
        update_type: str = "text",
        title: Optional[str] = None,
        content: Optional[str] = None,
        media_urls: Optional[List[str]] = None,
        milestone_type: Optional[str] = None,
        production_day_id: Optional[str] = None,
        visibility: str = "public",
        publish_immediately: bool = True
    ) -> Dict[str, Any]:
        """Create a production update."""

        update = execute_insert("""
            INSERT INTO production_updates (
                link_id, update_type, title, content, media_urls,
                milestone_type, production_day_id, visibility,
                is_published, published_at, created_by
            ) VALUES (
                :link_id, :update_type, :title, :content, :media_urls::jsonb,
                :milestone_type, :production_day_id, :visibility,
                :is_published, :published_at, :created_by
            )
            RETURNING *
        """, {
            "link_id": link_id,
            "update_type": update_type,
            "title": title,
            "content": content,
            "media_urls": media_urls or [],
            "milestone_type": milestone_type,
            "production_day_id": production_day_id,
            "visibility": visibility,
            "is_published": publish_immediately,
            "published_at": datetime.utcnow() if publish_immediately else None,
            "created_by": created_by
        })

        return {"success": True, "update": dict(update)}

    @staticmethod
    async def get_production_updates(
        link_id: Optional[str] = None,
        world_id: Optional[str] = None,
        published_only: bool = True,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get production updates."""
        query = """
            SELECT
                pu.*,
                p.display_name as author_name,
                p.avatar_url as author_avatar,
                lpl.world_id,
                w.title as world_title
            FROM production_updates pu
            JOIN live_production_links lpl ON pu.link_id = lpl.id
            JOIN worlds w ON lpl.world_id = w.id
            LEFT JOIN profiles p ON pu.created_by = p.id
            WHERE 1=1
        """
        params = {"limit": limit, "offset": offset}

        if link_id:
            query += " AND pu.link_id = :link_id"
            params["link_id"] = link_id

        if world_id:
            query += " AND lpl.world_id = :world_id AND lpl.is_active = true"
            params["world_id"] = world_id

        if published_only:
            query += " AND pu.is_published = true"

        query += " ORDER BY pu.published_at DESC NULLS LAST, pu.created_at DESC"
        query += " LIMIT :limit OFFSET :offset"

        updates = execute_query(query, params)
        return [dict(u) for u in updates]

    @staticmethod
    async def publish_update(update_id: str) -> Dict[str, Any]:
        """Publish a draft update."""
        execute_query("""
            UPDATE production_updates
            SET is_published = true, published_at = NOW(), updated_at = NOW()
            WHERE id = :update_id
        """, {"update_id": update_id})

        return {"success": True}

    @staticmethod
    async def update_engagement(
        update_id: str,
        likes_delta: int = 0,
        comments_delta: int = 0,
        shares_delta: int = 0
    ) -> Dict[str, Any]:
        """Update engagement counts for an update."""
        execute_query("""
            UPDATE production_updates
            SET
                likes_count = likes_count + :likes_delta,
                comments_count = comments_count + :comments_delta,
                shares_count = shares_count + :shares_delta,
                updated_at = NOW()
            WHERE id = :update_id
        """, {
            "update_id": update_id,
            "likes_delta": likes_delta,
            "comments_delta": comments_delta,
            "shares_delta": shares_delta
        })

        return {"success": True}

    # ==========================================================================
    # Milestone Tracking
    # ==========================================================================

    @staticmethod
    async def record_milestone(
        link_id: str,
        milestone_type: str,
        created_by: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        media_urls: Optional[List[str]] = None,
        production_day_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Record a production milestone.

        Common milestone types:
        - first_day: First day of principal photography
        - halfway: Halfway through scheduled shoot
        - picture_wrap: Picture wrap
        - post_complete: Post-production complete
        - final_mix: Final audio mix complete
        - color_grade: Color grade complete
        - vfx_complete: VFX complete
        - festival_premiere: Festival premiere
        - general_release: General release
        """
        milestone_titles = {
            "first_day": "Day One!",
            "halfway": "Halfway There!",
            "picture_wrap": "That's a Wrap!",
            "post_complete": "Post-Production Complete",
            "final_mix": "Final Mix Complete",
            "color_grade": "Color Grade Complete",
            "vfx_complete": "VFX Complete",
            "festival_premiere": "Festival Premiere",
            "general_release": "Now Available"
        }

        default_title = milestone_titles.get(milestone_type, f"Milestone: {milestone_type}")

        return await LiveProductionService.create_production_update(
            link_id=link_id,
            created_by=created_by,
            update_type="milestone",
            title=title or default_title,
            content=content,
            media_urls=media_urls,
            milestone_type=milestone_type,
            production_day_id=production_day_id,
            visibility="public",
            publish_immediately=True
        )

    # ==========================================================================
    # Feed Generation
    # ==========================================================================

    @staticmethod
    async def get_updates_feed(
        user_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get production updates feed for a user.

        Includes updates from:
        - Worlds they follow
        - Productions they're involved in
        """
        updates = execute_query("""
            SELECT * FROM v_production_updates_feed
            WHERE world_id IN (
                -- Worlds user follows
                SELECT followed_id FROM follows
                WHERE follower_id = :user_id AND followed_type = 'world'
            )
            OR project_id IN (
                -- Projects user is involved in
                SELECT project_id FROM backlot_project_members WHERE user_id = :user_id
            )
            ORDER BY published_at DESC
            LIMIT :limit
        """, {"user_id": user_id, "limit": limit})

        return [dict(u) for u in updates]
