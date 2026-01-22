"""
Applicant Scoring Service
Calculates match scores for collab applications based on:
1. Role Credits (33%) - Experience in the specific role being hired
2. Total Experience (33%) - Overall credits count
3. Network (33%) - Connections to job poster and project team

Score breakdown is stored as JSON for display in UI.
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)

# Transferable skill categories - roles that share transferable skills
LEADERSHIP_ROLES = {
    '1st_ad', 'upm', 'producer', 'executive_producer', 'co_producer',
    'production_coordinator', 'post_supervisor', 'stunt_coordinator',
    'location_manager', 'transportation_coordinator', 'vfx_producer',
    'line_producer', 'production_manager', 'coordinator'
}

TECHNICAL_ROLES = {
    'dit', 'post_supervisor', 'vfx_supervisor', 'editor', 'colorist',
    '1st_ac', '2nd_ac', 'sound_mixer', 'gaffer', 'key_grip',
    'assistant_editor', 'camera_operator', 'boom_operator'
}

CREATIVE_ROLES = {
    'director', 'dp', 'production_designer', 'art_director', 'writer',
    'costume_designer', 'composer', 'sound_designer', 'cinematographer'
}


class ApplicantScoringService:
    """Service for calculating applicant match scores."""

    @staticmethod
    def normalize_role(role_text: str) -> str:
        """Normalize role text for comparison."""
        if not role_text:
            return ""
        # Lowercase, remove extra spaces and special characters
        import re
        normalized = role_text.lower().strip()
        normalized = re.sub(r'\s+', ' ', normalized)
        normalized = re.sub(r'[^a-z0-9\s]', '', normalized)
        return normalized

    @staticmethod
    def get_role_slug(role_text: str) -> str:
        """Convert role text to slug format."""
        normalized = ApplicantScoringService.normalize_role(role_text)
        return normalized.replace(' ', '_')

    @staticmethod
    def roles_match(role1: str, role2: str) -> bool:
        """Check if two role names match (accounting for common variations)."""
        if not role1 or not role2:
            return False

        norm1 = ApplicantScoringService.normalize_role(role1)
        norm2 = ApplicantScoringService.normalize_role(role2)

        # Exact match
        if norm1 == norm2:
            return True

        # Common abbreviations
        abbreviations = {
            'dp': 'director of photography',
            'dop': 'director of photography',
            'cinematographer': 'director of photography',
            '1st ad': 'first assistant director',
            '1ad': 'first assistant director',
            '2nd ad': 'second assistant director',
            '2ad': 'second assistant director',
            '1st ac': 'first assistant camera',
            '1ac': 'first assistant camera',
            'focus puller': 'first assistant camera',
            '2nd ac': 'second assistant camera',
            '2ac': 'second assistant camera',
            'clapper loader': 'second assistant camera',
            'cam op': 'camera operator',
            'gaffer': 'chief lighting technician',
            'key grip': 'key grip',
            'upm': 'unit production manager',
            'pm': 'production manager',
            'poc': 'production coordinator',
            'pa': 'production assistant',
            'dit': 'digital imaging technician',
            'psm': 'production sound mixer',
            'sound mixer': 'production sound mixer',
            'ep': 'executive producer',
        }

        # Expand abbreviations
        exp1 = abbreviations.get(norm1, norm1)
        exp2 = abbreviations.get(norm2, norm2)

        return exp1 == exp2

    @staticmethod
    def departments_match(dept1: str, dept2: str) -> bool:
        """Check if two department names match."""
        if not dept1 or not dept2:
            return False

        norm1 = ApplicantScoringService.normalize_role(dept1)
        norm2 = ApplicantScoringService.normalize_role(dept2)

        if norm1 == norm2:
            return True

        # Department aliases
        dept_groups = [
            {'camera', 'cinematography', 'camera department'},
            {'grip', 'electric', 'grip electric', 'grip & electric', 'ge'},
            {'art', 'art department', 'production design'},
            {'wardrobe', 'costume', 'costumes'},
            {'hair', 'makeup', 'hair makeup', 'hair & makeup', 'hmua'},
            {'sound', 'audio', 'sound department'},
            {'post', 'post production', 'editorial'},
        ]

        for group in dept_groups:
            if norm1 in group and norm2 in group:
                return True

        return False

    @staticmethod
    def get_transferable_category(role_text: str) -> Optional[str]:
        """Get the transferable skill category for a role."""
        slug = ApplicantScoringService.get_role_slug(role_text)

        if slug in LEADERSHIP_ROLES:
            return 'leadership'
        if slug in TECHNICAL_ROLES:
            return 'technical'
        if slug in CREATIVE_ROLES:
            return 'creative'

        # Check if the role contains keywords
        norm = ApplicantScoringService.normalize_role(role_text)
        if any(kw in norm for kw in ['producer', 'coordinator', 'manager', 'supervisor']):
            return 'leadership'
        if any(kw in norm for kw in ['editor', 'colorist', 'dit', 'technician', 'operator']):
            return 'technical'
        if any(kw in norm for kw in ['director', 'designer', 'writer', 'composer']):
            return 'creative'

        return None

    @staticmethod
    async def get_user_credits(user_id: str) -> List[Dict[str, Any]]:
        """
        Get all credits for a user from both project credits and manual credits.
        """
        # Get project credits (from Backlot productions)
        project_credits = execute_query("""
            SELECT
                pc.id,
                pc.credit_role as role,
                pc.department,
                bp.title as project_title,
                bp.id as project_id,
                'project' as source
            FROM backlot_project_credits pc
            LEFT JOIN backlot_projects bp ON bp.id = pc.project_id
            WHERE pc.user_id = :user_id AND pc.is_public = true
        """, {"user_id": user_id})

        # Get manual credits
        manual_credits = execute_query("""
            SELECT
                c.id,
                c.position as role,
                NULL as department,
                p.title as project_title,
                p.id as project_id,
                'manual' as source
            FROM credits c
            LEFT JOIN productions p ON p.id = c.production_id
            WHERE c.user_id = :user_id
        """, {"user_id": user_id})

        credits = []
        for c in (project_credits or []):
            credits.append(dict(c))
        for c in (manual_credits or []):
            credits.append(dict(c))

        return credits

    @staticmethod
    async def calculate_role_credits_score(
        user_id: str,
        target_role: str,
        target_dept: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculate role credits score (0-100).

        Weights:
        - Exact role match: 20 points each
        - Same department match: 15 points each
        - Transferable skill match: 10 points each

        Capped at 100.
        """
        credits = await ApplicantScoringService.get_user_credits(user_id)

        exact_matches = 0
        department_matches = 0
        transferable_matches = 0
        exact_match_credits = []
        dept_match_credits = []
        transferable_credits = []

        target_category = ApplicantScoringService.get_transferable_category(target_role)

        for credit in credits:
            credit_role = credit.get('role', '')
            credit_dept = credit.get('department', '')

            # Check exact role match
            if ApplicantScoringService.roles_match(credit_role, target_role):
                exact_matches += 1
                exact_match_credits.append({
                    "role": credit_role,
                    "project": credit.get('project_title', 'Unknown')
                })
            # Check department match (only if not an exact match)
            elif target_dept and ApplicantScoringService.departments_match(credit_dept, target_dept):
                department_matches += 1
                dept_match_credits.append({
                    "role": credit_role,
                    "department": credit_dept,
                    "project": credit.get('project_title', 'Unknown')
                })
            # Check transferable skill match
            elif target_category:
                credit_category = ApplicantScoringService.get_transferable_category(credit_role)
                if credit_category == target_category:
                    transferable_matches += 1
                    transferable_credits.append({
                        "role": credit_role,
                        "category": credit_category,
                        "project": credit.get('project_title', 'Unknown')
                    })

        # Calculate score
        score = min(100, (exact_matches * 20) + (department_matches * 15) + (transferable_matches * 10))

        return {
            "score": score,
            "exact_matches": exact_matches,
            "department_matches": department_matches,
            "transferable_matches": transferable_matches,
            "exact_match_credits": exact_match_credits[:5],  # Limit for display
            "dept_match_credits": dept_match_credits[:5],
            "transferable_credits": transferable_credits[:5]
        }

    @staticmethod
    async def calculate_experience_score(user_id: str) -> Dict[str, Any]:
        """
        Calculate experience score (0-100) based on total credits.
        Cap at 25 credits = 100 points (4 points per credit).
        """
        credits = await ApplicantScoringService.get_user_credits(user_id)
        total_credits = len(credits)

        # 4 points per credit, capped at 100
        score = min(100, total_credits * 4)

        return {
            "score": score,
            "total_credits": total_credits
        }

    @staticmethod
    async def get_user_connections(user_id: str) -> List[str]:
        """Get list of user IDs that the user has accepted connections with."""
        connections = execute_query("""
            SELECT
                CASE
                    WHEN requester_id = :user_id THEN recipient_id
                    ELSE requester_id
                END as connected_user_id
            FROM connections
            WHERE (requester_id = :user_id OR recipient_id = :user_id)
              AND status = 'accepted'
        """, {"user_id": user_id})

        return [str(c['connected_user_id']) for c in (connections or [])]

    @staticmethod
    async def get_shared_projects(user_id: str, other_user_id: str) -> List[Dict[str, Any]]:
        """Get projects where both users have credits."""
        shared = execute_query("""
            SELECT DISTINCT bp.id, bp.title
            FROM backlot_project_credits pc1
            JOIN backlot_project_credits pc2 ON pc1.project_id = pc2.project_id
            JOIN backlot_projects bp ON bp.id = pc1.project_id
            WHERE pc1.user_id = :user_id
              AND pc2.user_id = :other_user_id
              AND pc1.is_public = true
              AND pc2.is_public = true
        """, {"user_id": user_id, "other_user_id": other_user_id})

        return [dict(s) for s in (shared or [])]

    @staticmethod
    async def calculate_network_score(
        user_id: str,
        poster_id: str,
        team_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Calculate network score (0-100) based on connections and shared projects.

        Points:
        - Direct connection to poster: 20 points
        - Direct connection to team member: 10 points each
        - Shared project with poster: 25 points each
        - Shared project with team member: 15 points each

        Capped at 100.
        """
        team_ids = team_ids or []
        user_connections = await ApplicantScoringService.get_user_connections(user_id)

        direct_to_poster = 0
        direct_to_team = 0
        shared_with_poster = 0
        shared_with_team = 0
        connected_to = []

        # Check direct connection to poster
        if poster_id in user_connections:
            direct_to_poster = 1
            # Get poster name for display
            poster = execute_single("""
                SELECT display_name, full_name FROM profiles WHERE id = :id
            """, {"id": poster_id})
            if poster:
                connected_to.append(poster.get('display_name') or poster.get('full_name', 'Unknown'))

        # Check direct connections to team
        for team_id in team_ids:
            if team_id in user_connections and team_id != poster_id:
                direct_to_team += 1
                team_member = execute_single("""
                    SELECT display_name, full_name FROM profiles WHERE id = :id
                """, {"id": team_id})
                if team_member:
                    connected_to.append(team_member.get('display_name') or team_member.get('full_name', 'Unknown'))

        # Check shared projects with poster
        shared_poster_projects = await ApplicantScoringService.get_shared_projects(user_id, poster_id)
        shared_with_poster = len(shared_poster_projects)

        # Check shared projects with team (excluding poster to avoid double-counting)
        shared_team_projects = set()
        for team_id in team_ids:
            if team_id != poster_id:
                projects = await ApplicantScoringService.get_shared_projects(user_id, team_id)
                for p in projects:
                    shared_team_projects.add(p['id'])
        shared_with_team = len(shared_team_projects)

        # Calculate score
        score = min(100,
            (direct_to_poster * 20) +
            (direct_to_team * 10) +
            (shared_with_poster * 25) +
            (shared_with_team * 15)
        )

        return {
            "score": score,
            "direct_connections": direct_to_poster + direct_to_team,
            "shared_projects": shared_with_poster + shared_with_team,
            "connected_to": connected_to[:5]  # Limit for display
        }

    @staticmethod
    async def get_collab_details(collab_id: str) -> Optional[Dict[str, Any]]:
        """Get collab details needed for scoring."""
        collab = execute_single("""
            SELECT
                cc.id,
                cc.user_id as poster_id,
                cc.type,
                cc.crew_position,
                cc.crew_department,
                cc.cast_position_type_id,
                cpt.name as cast_position_name,
                cc.backlot_project_id
            FROM community_collabs cc
            LEFT JOIN cast_position_types cpt ON cpt.id = cc.cast_position_type_id
            WHERE cc.id = :collab_id
        """, {"collab_id": collab_id})

        return dict(collab) if collab else None

    @staticmethod
    async def get_project_team_ids(project_id: str) -> List[str]:
        """Get user IDs of team members on a project."""
        if not project_id:
            return []

        team = execute_query("""
            SELECT DISTINCT user_id
            FROM backlot_project_members
            WHERE project_id = :project_id
              AND user_id IS NOT NULL
        """, {"project_id": project_id})

        return [str(t['user_id']) for t in (team or [])]

    @staticmethod
    async def calculate_score(application_id: str) -> Dict[str, Any]:
        """
        Calculate the complete match score for an application.

        Returns the score breakdown and total score.
        """
        # Get application details
        application = execute_single("""
            SELECT id, collab_id, applicant_user_id
            FROM community_collab_applications
            WHERE id = :application_id
        """, {"application_id": application_id})

        if not application:
            raise ValueError(f"Application not found: {application_id}")

        collab = await ApplicantScoringService.get_collab_details(application['collab_id'])
        if not collab:
            raise ValueError(f"Collab not found for application: {application_id}")

        applicant_id = str(application['applicant_user_id'])
        poster_id = str(collab['poster_id'])

        # Determine target role and department
        if collab['type'] == 'cast':
            target_role = collab.get('cast_position_name', 'Actor')
            target_dept = 'Cast'
        else:
            target_role = collab.get('crew_position', '')
            target_dept = collab.get('crew_department', '')

        # Get project team if available
        team_ids = []
        if collab.get('backlot_project_id'):
            team_ids = await ApplicantScoringService.get_project_team_ids(collab['backlot_project_id'])

        # Calculate component scores
        role_credits = await ApplicantScoringService.calculate_role_credits_score(
            applicant_id, target_role, target_dept
        )
        experience = await ApplicantScoringService.calculate_experience_score(applicant_id)
        network = await ApplicantScoringService.calculate_network_score(
            applicant_id, poster_id, team_ids
        )

        # Calculate total (equal weight: 33% each)
        total = round((role_credits['score'] + experience['score'] + network['score']) / 3)

        breakdown = {
            "role_credits": role_credits,
            "experience": experience,
            "network": network,
            "total": total
        }

        return breakdown

    @staticmethod
    async def update_application_score(application_id: str) -> Dict[str, Any]:
        """
        Calculate and store the score for an application.
        """
        import json
        try:
            breakdown = await ApplicantScoringService.calculate_score(application_id)

            # Update the application with score
            execute_update("""
                UPDATE community_collab_applications
                SET match_score = :score,
                    score_breakdown = :breakdown,
                    score_calculated_at = NOW()
                WHERE id = :application_id
            """, {
                "application_id": application_id,
                "score": breakdown['total'],
                "breakdown": json.dumps(breakdown)
            })

            return breakdown

        except Exception as e:
            logger.error(f"Error calculating score for application {application_id}: {e}")
            raise

    @staticmethod
    async def score_all_applications_for_collab(collab_id: str) -> Dict[str, Any]:
        """
        Calculate scores for all applications to a collab.
        Returns summary of scored applications.
        """
        applications = execute_query("""
            SELECT id FROM community_collab_applications
            WHERE collab_id = :collab_id
        """, {"collab_id": collab_id})

        scored = 0
        errors = 0

        for app in (applications or []):
            try:
                await ApplicantScoringService.update_application_score(str(app['id']))
                scored += 1
            except Exception as e:
                logger.error(f"Error scoring application {app['id']}: {e}")
                errors += 1

        return {
            "collab_id": collab_id,
            "total_applications": len(applications or []),
            "scored": scored,
            "errors": errors
        }

    @staticmethod
    async def score_unscored_applications(limit: int = 100) -> Dict[str, Any]:
        """
        Score applications that don't have scores yet.
        Useful for batch processing.
        """
        applications = execute_query("""
            SELECT id FROM community_collab_applications
            WHERE match_score IS NULL
            LIMIT :limit
        """, {"limit": limit})

        scored = 0
        errors = 0

        for app in (applications or []):
            try:
                await ApplicantScoringService.update_application_score(str(app['id']))
                scored += 1
            except Exception as e:
                logger.error(f"Error scoring application {app['id']}: {e}")
                errors += 1

        return {
            "processed": len(applications or []),
            "scored": scored,
            "errors": errors
        }
