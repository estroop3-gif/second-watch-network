"""
Career Service
Phase 3A: Service for career and crew network queries.

This service provides:
- Member filmography (credits across all Worlds)
- World crew network (who worked on a project)
- Job activity tracking (applications, recent jobs)
- Career statistics and highlights
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single

logger = logging.getLogger(__name__)


class CareerService:
    """Service for career-related queries and filmography."""

    @staticmethod
    async def get_member_filmography(
        member_id: str,
        department: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        Get a member's complete filmography (credits across all Worlds).

        Args:
            member_id: Profile ID or Order member ID
            department: Filter by department (Cast, Directing, etc.)
            limit: Max results
            offset: Pagination offset

        Returns:
            Dict with credits list and summary statistics
        """
        conditions = ["member_id = :member_id"]
        params = {"member_id": member_id, "limit": limit, "offset": offset}

        if department:
            conditions.append("department = :department")
            params["department"] = department

        # Get credits from the view
        credits = execute_query(f"""
            SELECT *
            FROM v_member_filmography
            WHERE {' AND '.join(conditions)}
            ORDER BY premiere_date DESC NULLS LAST, created_at DESC
            LIMIT :limit OFFSET :offset
        """, params)

        # Get summary stats
        stats = execute_single("""
            SELECT
                COUNT(*) as total_credits,
                COUNT(DISTINCT world_id) as unique_worlds,
                COUNT(*) FILTER (WHERE department = 'Cast') as cast_credits,
                COUNT(*) FILTER (WHERE department = 'Directing') as directing_credits,
                COUNT(*) FILTER (WHERE department = 'Writing') as writing_credits,
                COUNT(*) FILTER (WHERE department = 'Production') as production_credits,
                COUNT(*) FILTER (WHERE department = 'Cinematography') as cinematography_credits,
                COUNT(*) FILTER (WHERE is_featured = true) as featured_credits,
                COUNT(*) FILTER (WHERE is_top_billed = true) as top_billed_credits,
                COUNT(*) FILTER (WHERE is_verified = true) as verified_credits,
                array_agg(DISTINCT department) FILTER (WHERE department IS NOT NULL) as departments
            FROM v_member_filmography
            WHERE member_id = :member_id
        """, {"member_id": member_id})

        return {
            "member_id": member_id,
            "credits": [dict(c) for c in credits],
            "stats": dict(stats) if stats else {},
            "limit": limit,
            "offset": offset
        }

    @staticmethod
    async def get_world_crew_network(
        world_id: str,
        department: Optional[str] = None,
        include_episodes: bool = True
    ) -> Dict[str, Any]:
        """
        Get the complete crew network for a World.

        Args:
            world_id: The World ID
            department: Filter by department
            include_episodes: Include episode-specific credits

        Returns:
            Dict with crew list organized by department and lodge stats
        """
        conditions = ["world_id = :world_id"]
        params = {"world_id": world_id}

        if department:
            conditions.append("department = :department")
            params["department"] = department

        # Get world credits
        world_crew = execute_query(f"""
            SELECT *
            FROM v_world_crew_network
            WHERE {' AND '.join(conditions)}
        """, params)

        # Optionally get episode credits
        episode_crew = []
        if include_episodes:
            episode_crew = execute_query("""
                SELECT
                    e.id as episode_id,
                    e.title as episode_title,
                    e.episode_number,
                    s.season_number,
                    COALESCE(ec.user_id, ec.order_member_id) as member_id,
                    p.display_name as member_name,
                    p.avatar_url as member_avatar,
                    ec.department,
                    ec.role,
                    ec.character_name,
                    ec.is_guest,
                    ec.is_recurring,
                    ec.is_special_appearance
                FROM episode_credits ec
                JOIN episodes e ON ec.episode_id = e.id
                LEFT JOIN seasons s ON e.season_id = s.id
                LEFT JOIN profiles p ON COALESCE(ec.user_id, ec.order_member_id) = p.id
                WHERE e.world_id = :world_id
                  AND ec.is_public = true
                ORDER BY s.season_number, e.episode_number, ec.billing_order
            """, {"world_id": world_id})

        # Get lodge distribution
        lodge_stats = execute_query("""
            SELECT
                lodge_id,
                lodge_name,
                COUNT(*) as crew_count,
                array_agg(DISTINCT department) as departments
            FROM v_world_crew_network
            WHERE world_id = :world_id AND lodge_id IS NOT NULL
            GROUP BY lodge_id, lodge_name
            ORDER BY crew_count DESC
        """, {"world_id": world_id})

        # Organize by department
        by_department = {}
        for crew in world_crew:
            dept = crew.get("department") or "Other"
            if dept not in by_department:
                by_department[dept] = []
            by_department[dept].append(dict(crew))

        return {
            "world_id": world_id,
            "crew": [dict(c) for c in world_crew],
            "by_department": by_department,
            "episode_credits": [dict(c) for c in episode_crew] if episode_crew else [],
            "lodge_distribution": [dict(l) for l in lodge_stats],
            "total_crew": len(world_crew)
        }

    @staticmethod
    async def get_member_job_activity(
        member_id: str,
        status: Optional[str] = None,
        include_closed: bool = False,
        limit: int = 20
    ) -> Dict[str, Any]:
        """
        Get a member's job application activity.

        Args:
            member_id: Profile ID
            status: Filter by application status
            include_closed: Include applications for closed jobs
            limit: Max results

        Returns:
            Dict with applications and statistics
        """
        conditions = ["member_id = :member_id"]
        params = {"member_id": member_id, "limit": limit}

        if status:
            conditions.append("application_status = :status")
            params["status"] = status

        if not include_closed:
            conditions.append("job_is_active = true")

        applications = execute_query(f"""
            SELECT *
            FROM v_member_job_activity
            WHERE {' AND '.join(conditions)}
            ORDER BY applied_at DESC
            LIMIT :limit
        """, params)

        # Get summary stats
        stats = execute_single("""
            SELECT
                COUNT(*) as total_applications,
                COUNT(*) FILTER (WHERE application_status = 'submitted') as pending_count,
                COUNT(*) FILTER (WHERE application_status = 'reviewed') as reviewed_count,
                COUNT(*) FILTER (WHERE application_status = 'accepted') as accepted_count,
                COUNT(*) FILTER (WHERE application_status = 'rejected') as rejected_count
            FROM v_member_job_activity
            WHERE member_id = :member_id
        """, {"member_id": member_id})

        return {
            "member_id": member_id,
            "applications": [dict(a) for a in applications],
            "stats": dict(stats) if stats else {}
        }

    @staticmethod
    async def get_recent_jobs_for_member(
        member_id: str,
        days: int = 30,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent job postings relevant to a member.

        Considers:
        - Member's lodge (preferred or required)
        - Member's craft house / primary track
        - Jobs in member's city/region
        """
        # Get member profile info
        member = execute_single("""
            SELECT
                omp.user_id,
                omp.primary_track,
                omp.secondary_tracks,
                omp.city,
                omp.region,
                omp.lodge_id,
                ol.city as lodge_city
            FROM order_member_profiles omp
            LEFT JOIN order_lodges ol ON omp.lodge_id = ol.id
            WHERE omp.user_id = :member_id
        """, {"member_id": member_id})

        if not member:
            return []

        # Build relevance-based query
        jobs = execute_query("""
            SELECT
                oj.id,
                oj.title,
                oj.description,
                oj.location,
                oj.job_type,
                oj.department,
                oj.compensation_type,
                oj.compensation_range_min,
                oj.compensation_range_max,
                oj.visibility,
                oj.starts_at,
                oj.ends_at,
                oj.application_deadline,
                oj.world_id,
                w.title as world_title,
                oj.lodge_id,
                ol.name as lodge_name,
                oj.craft_house_id,
                och.name as craft_house_name,
                oj.created_at,
                -- Relevance scoring
                CASE
                    WHEN oj.required_lodge_id = :lodge_id THEN 100
                    WHEN oj.preferred_lodge_id = :lodge_id THEN 80
                    WHEN oj.lodge_id = :lodge_id THEN 60
                    WHEN oj.location ILIKE '%' || :city || '%' THEN 40
                    WHEN oj.location ILIKE '%' || :region || '%' THEN 20
                    ELSE 0
                END +
                CASE
                    WHEN oj.department = :primary_track THEN 50
                    ELSE 0
                END as relevance_score
            FROM order_jobs oj
            LEFT JOIN worlds w ON oj.world_id = w.id
            LEFT JOIN order_lodges ol ON oj.lodge_id = ol.id
            LEFT JOIN order_craft_houses och ON oj.craft_house_id = och.id
            WHERE oj.is_active = true
              AND oj.created_at >= NOW() - :days::interval
              AND (oj.application_deadline IS NULL OR oj.application_deadline > NOW())
              AND (
                  oj.visibility = 'public'
                  OR oj.visibility IN ('order_only', 'order_priority')
              )
            ORDER BY relevance_score DESC, oj.created_at DESC
            LIMIT :limit
        """, {
            "member_id": member_id,
            "lodge_id": member.get("lodge_id"),
            "city": member.get("city") or "",
            "region": member.get("region") or "",
            "primary_track": member.get("primary_track"),
            "days": f"{days} days",
            "limit": limit
        })

        return [dict(j) for j in jobs]

    @staticmethod
    async def get_career_highlights(member_id: str) -> Dict[str, Any]:
        """
        Get career highlights for a member's profile display.

        Returns key achievements, recent work, and statistics.
        """
        # Get basic filmography stats
        filmography = await CareerService.get_member_filmography(member_id, limit=5)

        # Get featured/top-billed credits
        highlights = execute_query("""
            SELECT *
            FROM v_member_filmography
            WHERE member_id = :member_id
              AND (is_featured = true OR is_top_billed = true)
            ORDER BY premiere_date DESC NULLS LAST
            LIMIT 5
        """, {"member_id": member_id})

        # Get active collaborators (people they've worked with multiple times)
        collaborators = execute_query("""
            WITH member_worlds AS (
                SELECT DISTINCT world_id
                FROM v_member_filmography
                WHERE member_id = :member_id
            )
            SELECT
                wc.member_id as collaborator_id,
                wc.member_name,
                wc.member_avatar,
                COUNT(DISTINCT wc.world_id) as projects_together,
                array_agg(DISTINCT wc.department) as their_departments
            FROM v_world_crew_network wc
            JOIN member_worlds mw ON wc.world_id = mw.world_id
            WHERE wc.member_id != :member_id
              AND wc.member_id IS NOT NULL
            GROUP BY wc.member_id, wc.member_name, wc.member_avatar
            HAVING COUNT(DISTINCT wc.world_id) > 1
            ORDER BY projects_together DESC
            LIMIT 10
        """, {"member_id": member_id})

        # Get Order member details if available
        order_profile = execute_single("""
            SELECT
                omp.*,
                ol.name as lodge_name,
                ol.city as lodge_city,
                och.name as craft_house_name
            FROM order_member_profiles omp
            LEFT JOIN order_lodges ol ON omp.lodge_id = ol.id
            LEFT JOIN order_craft_house_memberships ochm ON omp.user_id = ochm.user_id
            LEFT JOIN order_craft_houses och ON ochm.craft_house_id = och.id
            WHERE omp.user_id = :member_id
        """, {"member_id": member_id})

        return {
            "member_id": member_id,
            "order_profile": dict(order_profile) if order_profile else None,
            "stats": filmography.get("stats", {}),
            "recent_credits": filmography.get("credits", []),
            "highlights": [dict(h) for h in highlights],
            "frequent_collaborators": [dict(c) for c in collaborators]
        }

    @staticmethod
    async def get_credits_for_organization(
        organization_id: str,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Get all credits for Worlds owned by an organization.

        Args:
            organization_id: The organization ID

        Returns:
            Dict with credits organized by World
        """
        credits = execute_query("""
            SELECT
                wc.*,
                w.title as world_title,
                w.cover_art_url as world_image,
                w.content_format,
                p.display_name as member_name,
                p.avatar_url as member_avatar
            FROM world_credits wc
            JOIN worlds w ON wc.world_id = w.id
            LEFT JOIN profiles p ON COALESCE(wc.user_id, wc.order_member_id) = p.id
            WHERE w.organization_id = :org_id
              AND wc.is_public = true
            ORDER BY w.premiere_date DESC NULLS LAST, wc.billing_order
            LIMIT :limit
        """, {"org_id": organization_id, "limit": limit})

        # Organize by World
        by_world = {}
        for credit in credits:
            world_id = credit.get("world_id")
            if world_id not in by_world:
                by_world[world_id] = {
                    "world_id": world_id,
                    "world_title": credit.get("world_title"),
                    "world_image": credit.get("world_image"),
                    "content_format": credit.get("content_format"),
                    "credits": []
                }
            by_world[world_id]["credits"].append(dict(credit))

        return {
            "organization_id": organization_id,
            "worlds": list(by_world.values()),
            "total_credits": len(credits)
        }

    @staticmethod
    async def verify_credit(
        credit_id: str,
        credit_type: str,
        verified_by: str
    ) -> Optional[Dict[str, Any]]:
        """
        Mark a credit as verified by an admin or the credited member.

        Args:
            credit_id: The credit record ID
            credit_type: 'world' or 'episode'
            verified_by: Profile ID of verifier

        Returns:
            Updated credit record
        """
        table = "world_credits" if credit_type == "world" else "episode_credits"

        result = execute_single(f"""
            UPDATE {table}
            SET is_verified = true,
                verified_at = NOW(),
                verified_by = :verified_by,
                updated_at = NOW()
            WHERE id = :credit_id
            RETURNING *
        """, {"credit_id": credit_id, "verified_by": verified_by})

        if result:
            logger.info("credit_verified", credit_id=credit_id, type=credit_type)

        return dict(result) if result else None

    @staticmethod
    async def search_crew(
        query: str,
        department: Optional[str] = None,
        lodge_id: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """
        Search for crew members by name or role.

        Args:
            query: Search term
            department: Filter by department
            lodge_id: Filter by lodge

        Returns:
            List of matching members with their credits summary
        """
        conditions = ["""
            (p.display_name ILIKE '%' || :query || '%'
             OR omp.primary_track ILIKE '%' || :query || '%')
        """]
        params = {"query": query, "limit": limit}

        if department:
            conditions.append("omp.primary_track = :department")
            params["department"] = department

        if lodge_id:
            conditions.append("omp.lodge_id = :lodge_id")
            params["lodge_id"] = lodge_id

        results = execute_query(f"""
            SELECT
                p.id as member_id,
                p.display_name,
                p.avatar_url,
                omp.primary_track,
                omp.city,
                omp.region,
                omp.status as member_status,
                ol.name as lodge_name,
                (SELECT COUNT(*) FROM v_member_filmography WHERE member_id = p.id) as credit_count,
                (SELECT COUNT(DISTINCT world_id) FROM v_member_filmography WHERE member_id = p.id) as world_count
            FROM profiles p
            LEFT JOIN order_member_profiles omp ON p.id = omp.user_id
            LEFT JOIN order_lodges ol ON omp.lodge_id = ol.id
            WHERE {' AND '.join(conditions)}
              AND omp.status IN ('active', 'probationary')
            ORDER BY credit_count DESC, p.display_name
            LIMIT :limit
        """, params)

        return [dict(r) for r in results]
