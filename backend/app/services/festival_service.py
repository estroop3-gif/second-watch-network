"""
Festival Service
Phase 2C: Service for managing festival submissions and release windows.

This service handles:
- Creating and updating festival runs
- Managing release windows
- Determining World availability based on festival status
- Festival calendar and deadline tracking
"""

import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


class FestivalService:
    """Service for festival lifecycle and release window management."""

    # Common festival status transitions
    STATUS_TRANSITIONS = {
        'planning': ['submitted', 'withdrawn'],
        'submitted': ['pending', 'rejected', 'withdrawn'],
        'pending': ['accepted', 'rejected', 'withdrawn'],
        'accepted': ['screened', 'withdrawn'],
        'screened': ['awarded'],
        'rejected': [],
        'withdrawn': [],
        'awarded': []
    }

    @staticmethod
    async def create_festival_run(
        world_id: str,
        festival_name: str,
        festival_year: Optional[int] = None,
        submission_category: Optional[str] = None,
        submission_date: Optional[date] = None,
        created_by: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create a new festival submission/run record.

        Args:
            world_id: The World being submitted
            festival_name: Name of the festival
            festival_year: Year of the festival edition
            submission_category: Category submitted to
            submission_date: Date of submission
            created_by: Profile ID of creator
            **kwargs: Additional fields (festival_location, festival_website, etc.)
        """
        import re
        # Generate slug from festival name
        festival_slug = re.sub(r'[^a-z0-9]+', '-', festival_name.lower()).strip('-')

        run = execute_insert("""
            INSERT INTO festival_runs (
                world_id, festival_name, festival_slug, festival_year,
                submission_category, submission_date, festival_location,
                festival_website, notes, status, created_by
            ) VALUES (
                :world_id, :festival_name, :festival_slug, :festival_year,
                :submission_category, :submission_date, :festival_location,
                :festival_website, :notes, 'planning', :created_by
            )
            RETURNING *
        """, {
            "world_id": world_id,
            "festival_name": festival_name,
            "festival_slug": festival_slug,
            "festival_year": festival_year or datetime.now().year,
            "submission_category": submission_category,
            "submission_date": submission_date,
            "festival_location": kwargs.get('festival_location'),
            "festival_website": kwargs.get('festival_website'),
            "notes": kwargs.get('notes'),
            "created_by": created_by
        })

        logger.info("festival_run_created", run_id=run['id'], world_id=world_id, festival=festival_name)

        return dict(run)

    @staticmethod
    async def update_festival_run(
        run_id: str,
        **updates
    ) -> Optional[Dict[str, Any]]:
        """Update a festival run record."""
        allowed_fields = [
            'festival_name', 'festival_year', 'festival_location', 'festival_website',
            'submission_category', 'submission_date', 'submission_fee_cents',
            'premiere_type', 'premiere_date', 'screening_dates',
            'exclusivity_required', 'exclusivity_start_date', 'exclusivity_end_date',
            'exclusivity_territories', 'programmer_name', 'programmer_email',
            'notes', 'press_kit_url', 'screener_url'
        ]

        set_clauses = []
        params = {"run_id": run_id}

        for field in allowed_fields:
            if field in updates and updates[field] is not None:
                set_clauses.append(f"{field} = :{field}")
                params[field] = updates[field]

        if not set_clauses:
            return None

        set_clauses.append("updated_at = NOW()")

        run = execute_single(f"""
            UPDATE festival_runs
            SET {', '.join(set_clauses)}
            WHERE id = :run_id
            RETURNING *
        """, params)

        return dict(run) if run else None

    @staticmethod
    async def update_festival_status(
        run_id: str,
        new_status: str,
        awards_won: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Update festival run status with validation.

        Enforces valid status transitions.
        """
        current = execute_single(
            "SELECT status FROM festival_runs WHERE id = :run_id",
            {"run_id": run_id}
        )

        if not current:
            return None

        current_status = current['status']
        valid_transitions = FestivalService.STATUS_TRANSITIONS.get(current_status, [])

        if new_status not in valid_transitions and new_status != current_status:
            logger.warning(
                "invalid_festival_status_transition",
                run_id=run_id,
                current=current_status,
                attempted=new_status
            )
            return None

        update_params = {"run_id": run_id, "status": new_status}
        extra_set = ""

        if awards_won:
            extra_set = ", awards_won = :awards_won"
            update_params["awards_won"] = awards_won

        run = execute_single(f"""
            UPDATE festival_runs
            SET status = :status{extra_set}, updated_at = NOW()
            WHERE id = :run_id
            RETURNING *
        """, update_params)

        logger.info("festival_status_updated", run_id=run_id, status=new_status)

        return dict(run) if run else None

    @staticmethod
    async def get_festival_runs_for_world(
        world_id: str,
        status: Optional[str] = None,
        include_withdrawn: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all festival runs for a World."""
        conditions = ["world_id = :world_id"]
        params = {"world_id": world_id}

        if status:
            conditions.append("status = :status")
            params["status"] = status

        if not include_withdrawn:
            conditions.append("status != 'withdrawn'")

        runs = execute_query(f"""
            SELECT *
            FROM festival_runs
            WHERE {' AND '.join(conditions)}
            ORDER BY
                CASE status
                    WHEN 'awarded' THEN 1
                    WHEN 'screened' THEN 2
                    WHEN 'accepted' THEN 3
                    WHEN 'pending' THEN 4
                    WHEN 'submitted' THEN 5
                    WHEN 'planning' THEN 6
                    ELSE 7
                END,
                premiere_date DESC NULLS LAST,
                submission_date DESC NULLS LAST
        """, params)

        return [dict(r) for r in runs]

    @staticmethod
    async def get_festival_summary(world_id: str) -> Dict[str, Any]:
        """Get festival activity summary for a World."""
        summary = execute_single("""
            SELECT
                COUNT(*) as total_submissions,
                COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
                COUNT(*) FILTER (WHERE status = 'screened') as screened_count,
                COUNT(*) FILTER (WHERE status = 'awarded') as awarded_count,
                COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
                COUNT(*) FILTER (WHERE status IN ('planning', 'submitted', 'pending')) as pending_count,
                MIN(premiere_date) FILTER (WHERE premiere_date IS NOT NULL) as first_premiere_date
            FROM festival_runs
            WHERE world_id = :world_id AND status != 'withdrawn'
        """, {"world_id": world_id})

        # Get list of awards
        awards = execute_query("""
            SELECT festival_name, awards_won
            FROM festival_runs
            WHERE world_id = :world_id AND status = 'awarded' AND awards_won IS NOT NULL
        """, {"world_id": world_id})

        result = dict(summary) if summary else {}
        result['awards'] = [{'festival': a['festival_name'], 'awards': a['awards_won']} for a in awards]

        return result

    # =========================================================================
    # RELEASE WINDOWS
    # =========================================================================

    @staticmethod
    async def create_release_window(
        world_id: str,
        window_type: str,
        start_date: date,
        end_date: Optional[date] = None,
        territories: Optional[List[str]] = None,
        festival_run_id: Optional[str] = None,
        venue_deal_id: Optional[str] = None,
        priority: int = 0,
        created_by: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a release window for a World."""
        import json

        window = execute_insert("""
            INSERT INTO world_release_windows (
                world_id, window_type, start_date, end_date,
                territories, festival_run_id, venue_deal_id,
                priority, status, notes, created_by
            ) VALUES (
                :world_id, :window_type, :start_date, :end_date,
                :territories, :festival_run_id, :venue_deal_id,
                :priority, 'planned', :notes, :created_by
            )
            RETURNING *
        """, {
            "world_id": world_id,
            "window_type": window_type,
            "start_date": start_date,
            "end_date": end_date,
            "territories": json.dumps(territories or ["WORLDWIDE"]),
            "festival_run_id": festival_run_id,
            "venue_deal_id": venue_deal_id,
            "priority": priority,
            "notes": notes,
            "created_by": created_by
        })

        logger.info("release_window_created", window_id=window['id'], world_id=world_id, type=window_type)

        return dict(window)

    @staticmethod
    async def activate_release_window(window_id: str) -> Optional[Dict[str, Any]]:
        """Activate a planned release window."""
        window = execute_single("""
            UPDATE world_release_windows
            SET status = 'active', updated_at = NOW()
            WHERE id = :window_id AND status = 'planned'
            RETURNING *
        """, {"window_id": window_id})

        if window:
            logger.info("release_window_activated", window_id=window_id)

        return dict(window) if window else None

    @staticmethod
    async def complete_release_window(window_id: str) -> Optional[Dict[str, Any]]:
        """Mark a release window as completed."""
        window = execute_single("""
            UPDATE world_release_windows
            SET status = 'completed', updated_at = NOW()
            WHERE id = :window_id AND status = 'active'
            RETURNING *
        """, {"window_id": window_id})

        return dict(window) if window else None

    @staticmethod
    async def get_release_windows(
        world_id: str,
        status: Optional[str] = None,
        window_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get release windows for a World."""
        conditions = ["world_id = :world_id"]
        params = {"world_id": world_id}

        if status:
            conditions.append("status = :status")
            params["status"] = status

        if window_type:
            conditions.append("window_type = :window_type")
            params["window_type"] = window_type

        windows = execute_query(f"""
            SELECT wrw.*, fr.festival_name
            FROM world_release_windows wrw
            LEFT JOIN festival_runs fr ON wrw.festival_run_id = fr.id
            WHERE {' AND '.join(conditions)}
            ORDER BY wrw.start_date, wrw.priority DESC
        """, params)

        return [dict(w) for w in windows]

    @staticmethod
    async def get_current_release_window(world_id: str) -> Optional[Dict[str, Any]]:
        """Get the currently active release window for a World."""
        window = execute_single("""
            SELECT wrw.*, fr.festival_name
            FROM world_release_windows wrw
            LEFT JOIN festival_runs fr ON wrw.festival_run_id = fr.id
            WHERE wrw.world_id = :world_id
              AND wrw.status = 'active'
              AND wrw.start_date <= CURRENT_DATE
              AND (wrw.end_date IS NULL OR wrw.end_date >= CURRENT_DATE)
            ORDER BY wrw.priority DESC
            LIMIT 1
        """, {"world_id": world_id})

        return dict(window) if window else None

    # =========================================================================
    # AVAILABILITY CHECKS
    # =========================================================================

    @staticmethod
    async def check_platform_availability(
        world_id: str,
        territory: str = 'US'
    ) -> Dict[str, Any]:
        """
        Check if a World is available for platform playback.

        Returns availability status and reason.
        """
        # First check World basic status
        world = execute_single("""
            SELECT id, title, status, visibility, distribution_status,
                   festival_strategy, platform_release_date
            FROM worlds
            WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            return {
                'available': False,
                'reason': 'world_not_found',
                'world_id': world_id
            }

        # Check if World is active
        if world['status'] != 'active':
            return {
                'available': False,
                'reason': 'world_not_active',
                'world_status': world['status']
            }

        # Check for festival exclusivity
        exclusivity = execute_single("""
            SELECT id, festival_name, exclusivity_end_date
            FROM festival_runs
            WHERE world_id = :world_id
              AND exclusivity_required = true
              AND status IN ('accepted', 'screened')
              AND exclusivity_start_date <= CURRENT_DATE
              AND (exclusivity_end_date IS NULL OR exclusivity_end_date >= CURRENT_DATE)
            LIMIT 1
        """, {"world_id": world_id})

        if exclusivity:
            return {
                'available': False,
                'reason': 'festival_exclusivity',
                'festival': exclusivity['festival_name'],
                'exclusivity_ends': str(exclusivity['exclusivity_end_date']) if exclusivity['exclusivity_end_date'] else None
            }

        # Check release windows
        window = await FestivalService.get_current_release_window(world_id)

        if window:
            window_type = window['window_type']

            # Platform windows allow playback
            if window_type in ('platform_premiere', 'platform_wide', 'premium_exclusive'):
                # Check territory
                territories = window.get('territories', [])
                if 'WORLDWIDE' in territories or territory in territories:
                    return {
                        'available': True,
                        'reason': 'release_window_active',
                        'window_type': window_type,
                        'window_id': window['id']
                    }
                else:
                    return {
                        'available': False,
                        'reason': 'territory_restricted',
                        'allowed_territories': territories
                    }

            # Exclusive windows block platform
            if window_type in ('festival', 'venue_exclusive', 'theatrical'):
                return {
                    'available': False,
                    'reason': f'{window_type}_exclusive',
                    'window_id': window['id'],
                    'window_ends': str(window['end_date']) if window.get('end_date') else None
                }

        # No active window - check platform release date
        if world.get('platform_release_date'):
            release_date = world['platform_release_date']
            if isinstance(release_date, str):
                release_date = date.fromisoformat(release_date)

            if date.today() < release_date:
                return {
                    'available': False,
                    'reason': 'before_platform_release',
                    'release_date': str(release_date)
                }

        # Default: available if World is public
        if world['visibility'] == 'public':
            return {
                'available': True,
                'reason': 'publicly_available'
            }

        return {
            'available': False,
            'reason': 'not_public',
            'visibility': world['visibility']
        }

    @staticmethod
    async def check_episode_availability(
        episode_id: str,
        territory: str = 'US'
    ) -> Dict[str, Any]:
        """
        Check if a specific episode is available.

        This wraps World availability but can add episode-specific rules.
        """
        episode = execute_single("""
            SELECT e.id, e.world_id, e.status, e.visibility,
                   w.title as world_title
            FROM episodes e
            JOIN worlds w ON e.world_id = w.id
            WHERE e.id = :episode_id
        """, {"episode_id": episode_id})

        if not episode:
            return {
                'available': False,
                'reason': 'episode_not_found'
            }

        # Check episode status
        if episode['status'] not in ('published', 'unlisted'):
            return {
                'available': False,
                'reason': 'episode_not_published',
                'episode_status': episode['status']
            }

        # Check World availability
        world_availability = await FestivalService.check_platform_availability(
            episode['world_id'],
            territory
        )

        if not world_availability['available']:
            return {
                'available': False,
                'reason': 'world_unavailable',
                'world_reason': world_availability['reason'],
                'details': world_availability
            }

        return {
            'available': True,
            'reason': 'available',
            'episode_id': episode_id,
            'world_id': episode['world_id']
        }

    @staticmethod
    async def get_world_availability_status(world_id: str) -> Dict[str, Any]:
        """
        Get comprehensive availability status for a World.

        Returns current state, upcoming windows, and restrictions.
        """
        # Basic info
        world = execute_single("""
            SELECT id, title, slug, status, visibility, distribution_status,
                   festival_strategy, primary_premiere_date, platform_release_date
            FROM worlds
            WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            return {'error': 'World not found'}

        result = {
            'world': dict(world),
            'platform_available': False,
            'current_window': None,
            'upcoming_windows': [],
            'active_exclusivity': None,
            'festival_activity': None
        }

        # Check platform availability
        availability = await FestivalService.check_platform_availability(world_id)
        result['platform_available'] = availability['available']
        result['platform_availability'] = availability

        # Current window
        result['current_window'] = await FestivalService.get_current_release_window(world_id)

        # Upcoming windows
        upcoming = execute_query("""
            SELECT *
            FROM world_release_windows
            WHERE world_id = :world_id
              AND status = 'planned'
              AND start_date > CURRENT_DATE
            ORDER BY start_date
            LIMIT 5
        """, {"world_id": world_id})
        result['upcoming_windows'] = [dict(w) for w in upcoming]

        # Active exclusivity
        exclusivity = execute_single("""
            SELECT id, festival_name, exclusivity_start_date, exclusivity_end_date
            FROM festival_runs
            WHERE world_id = :world_id
              AND exclusivity_required = true
              AND status IN ('accepted', 'screened')
              AND exclusivity_start_date <= CURRENT_DATE
              AND (exclusivity_end_date IS NULL OR exclusivity_end_date >= CURRENT_DATE)
            LIMIT 1
        """, {"world_id": world_id})
        if exclusivity:
            result['active_exclusivity'] = dict(exclusivity)

        # Festival summary
        result['festival_activity'] = await FestivalService.get_festival_summary(world_id)

        return result
