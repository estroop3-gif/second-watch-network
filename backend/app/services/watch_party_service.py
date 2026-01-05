"""
Watch Party Service
Phase 5C: Synchronized group viewing functionality.

Provides:
- Party creation and management
- Participant joining/leaving
- Playback synchronization
- Chat and reactions
- Invitation handling
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import secrets

from app.core.database import execute_query, execute_single, execute_insert


class PartyStatus(str, Enum):
    SCHEDULED = "scheduled"
    WAITING = "waiting"
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"
    CANCELLED = "cancelled"


class PartyType(str, Enum):
    PRIVATE = "private"
    FRIENDS = "friends"
    PUBLIC = "public"
    PREMIERE = "premiere"


class ParticipantRole(str, Enum):
    HOST = "host"
    CO_HOST = "co_host"
    MODERATOR = "moderator"
    VIEWER = "viewer"


class WatchPartyService:
    """Service for managing watch parties."""

    # ==========================================================================
    # Party Creation & Management
    # ==========================================================================

    @staticmethod
    async def create_party(
        host_id: str,
        world_id: str,
        title: str,
        episode_id: Optional[str] = None,
        party_type: str = "private",
        scheduled_start: Optional[datetime] = None,
        description: Optional[str] = None,
        max_participants: int = 50,
        chat_enabled: bool = True,
        reactions_enabled: bool = True,
        voice_chat_enabled: bool = False,
        requires_premium: bool = False
    ) -> Dict[str, Any]:
        """Create a new watch party."""

        # Generate invite code for private/friends parties
        invite_code = None
        if party_type in [PartyType.PRIVATE, PartyType.FRIENDS]:
            invite_code = WatchPartyService._generate_invite_code()

        party = execute_insert("""
            INSERT INTO watch_parties (
                host_id, world_id, episode_id, title, description,
                party_type, scheduled_start, max_participants,
                chat_enabled, reactions_enabled, voice_chat_enabled,
                requires_premium, invite_code, status
            ) VALUES (
                :host_id, :world_id, :episode_id, :title, :description,
                :party_type, :scheduled_start, :max_participants,
                :chat_enabled, :reactions_enabled, :voice_chat_enabled,
                :requires_premium, :invite_code, 'scheduled'
            )
            RETURNING *
        """, {
            "host_id": host_id,
            "world_id": world_id,
            "episode_id": episode_id,
            "title": title,
            "description": description,
            "party_type": party_type,
            "scheduled_start": scheduled_start or datetime.utcnow(),
            "max_participants": max_participants,
            "chat_enabled": chat_enabled,
            "reactions_enabled": reactions_enabled,
            "voice_chat_enabled": voice_chat_enabled,
            "requires_premium": requires_premium,
            "invite_code": invite_code
        })

        # Add host as participant
        execute_insert("""
            INSERT INTO watch_party_participants (party_id, user_id, role, is_active)
            VALUES (:party_id, :user_id, 'host', true)
        """, {"party_id": party["id"], "user_id": host_id})

        # Update participant count
        execute_query("""
            UPDATE watch_parties SET current_participant_count = 1 WHERE id = :id
        """, {"id": party["id"]})

        return {
            **dict(party),
            "success": True
        }

    @staticmethod
    async def get_party(party_id: str) -> Optional[Dict[str, Any]]:
        """Get party details."""
        party = execute_single("""
            SELECT
                wp.*,
                w.title as world_title,
                e.title as episode_title,
                p.display_name as host_name,
                p.avatar_url as host_avatar
            FROM watch_parties wp
            JOIN worlds w ON wp.world_id = w.id
            LEFT JOIN episodes e ON wp.episode_id = e.id
            JOIN profiles p ON wp.host_id = p.id
            WHERE wp.id = :party_id
        """, {"party_id": party_id})

        return dict(party) if party else None

    @staticmethod
    async def get_party_by_invite_code(invite_code: str) -> Optional[Dict[str, Any]]:
        """Get party by invite code."""
        party = execute_single("""
            SELECT * FROM watch_parties
            WHERE invite_code = :invite_code
              AND status NOT IN ('ended', 'cancelled')
        """, {"invite_code": invite_code.upper()})

        return dict(party) if party else None

    @staticmethod
    async def update_party_status(
        party_id: str,
        status: str,
        updated_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update party status."""
        valid_statuses = [s.value for s in PartyStatus]
        if status not in valid_statuses:
            return {"success": False, "error": f"Invalid status: {status}"}

        updates = {"status": status}

        if status == PartyStatus.ACTIVE:
            updates["actual_start"] = datetime.utcnow()
        elif status == PartyStatus.ENDED:
            updates["ended_at"] = datetime.utcnow()

        set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        updates["party_id"] = party_id

        execute_query(f"""
            UPDATE watch_parties SET {set_clauses}, updated_at = NOW()
            WHERE id = :party_id
        """, updates)

        return {"success": True, "status": status}

    @staticmethod
    async def cancel_party(party_id: str, cancelled_by: str) -> Dict[str, Any]:
        """Cancel a watch party."""
        party = await WatchPartyService.get_party(party_id)

        if not party:
            return {"success": False, "error": "Party not found"}

        if party["host_id"] != cancelled_by:
            return {"success": False, "error": "Only host can cancel party"}

        if party["status"] in [PartyStatus.ENDED, PartyStatus.CANCELLED]:
            return {"success": False, "error": "Party already ended or cancelled"}

        execute_query("""
            UPDATE watch_parties
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = :party_id
        """, {"party_id": party_id})

        return {"success": True}

    # ==========================================================================
    # Participant Management
    # ==========================================================================

    @staticmethod
    async def join_party(
        party_id: str,
        user_id: str,
        invite_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Join a watch party."""
        party = await WatchPartyService.get_party(party_id)

        if not party:
            return {"success": False, "error": "Party not found"}

        if party["status"] in [PartyStatus.ENDED, PartyStatus.CANCELLED]:
            return {"success": False, "error": "Party has ended"}

        # Check capacity
        if party["current_participant_count"] >= party["max_participants"]:
            return {"success": False, "error": "Party is full"}

        # Check access for private parties
        if party["party_type"] == PartyType.PRIVATE:
            if invite_code != party.get("invite_code"):
                # Check if user was invited
                invitation = execute_single("""
                    SELECT * FROM watch_party_invitations
                    WHERE party_id = :party_id AND invited_user_id = :user_id
                      AND status = 'accepted'
                """, {"party_id": party_id, "user_id": user_id})

                if not invitation and party["host_id"] != user_id:
                    return {"success": False, "error": "Invite required"}

        # Check if already a participant
        existing = execute_single("""
            SELECT * FROM watch_party_participants
            WHERE party_id = :party_id AND user_id = :user_id
        """, {"party_id": party_id, "user_id": user_id})

        if existing:
            if existing["is_active"]:
                return {"success": True, "message": "Already in party"}

            # Re-join
            execute_query("""
                UPDATE watch_party_participants
                SET is_active = true, joined_at = NOW(), left_at = NULL
                WHERE party_id = :party_id AND user_id = :user_id
            """, {"party_id": party_id, "user_id": user_id})
        else:
            # New participant
            execute_insert("""
                INSERT INTO watch_party_participants (party_id, user_id, role, is_active)
                VALUES (:party_id, :user_id, 'viewer', true)
            """, {"party_id": party_id, "user_id": user_id})

        # Update participant count
        execute_query("""
            UPDATE watch_parties
            SET current_participant_count = (
                SELECT COUNT(*) FROM watch_party_participants
                WHERE party_id = :party_id AND is_active = true
            )
            WHERE id = :party_id
        """, {"party_id": party_id})

        # Update peak count if needed
        execute_query("""
            UPDATE watch_parties
            SET peak_participants = GREATEST(peak_participants, current_participant_count)
            WHERE id = :party_id
        """, {"party_id": party_id})

        return {"success": True, "party": party}

    @staticmethod
    async def leave_party(party_id: str, user_id: str) -> Dict[str, Any]:
        """Leave a watch party."""
        execute_query("""
            UPDATE watch_party_participants
            SET is_active = false, left_at = NOW()
            WHERE party_id = :party_id AND user_id = :user_id
        """, {"party_id": party_id, "user_id": user_id})

        # Update participant count
        execute_query("""
            UPDATE watch_parties
            SET current_participant_count = (
                SELECT COUNT(*) FROM watch_party_participants
                WHERE party_id = :party_id AND is_active = true
            )
            WHERE id = :party_id
        """, {"party_id": party_id})

        return {"success": True}

    @staticmethod
    async def get_participants(party_id: str) -> List[Dict[str, Any]]:
        """Get all active participants in a party."""
        participants = execute_query("""
            SELECT
                wpp.*,
                p.display_name,
                p.avatar_url
            FROM watch_party_participants wpp
            JOIN profiles p ON wpp.user_id = p.id
            WHERE wpp.party_id = :party_id AND wpp.is_active = true
            ORDER BY wpp.role, wpp.joined_at
        """, {"party_id": party_id})

        return [dict(p) for p in participants]

    @staticmethod
    async def update_participant_role(
        party_id: str,
        user_id: str,
        new_role: str,
        updated_by: str
    ) -> Dict[str, Any]:
        """Update a participant's role (host/co-host only)."""
        # Verify updater is host or co-host
        updater = execute_single("""
            SELECT role FROM watch_party_participants
            WHERE party_id = :party_id AND user_id = :user_id AND is_active = true
        """, {"party_id": party_id, "user_id": updated_by})

        if not updater or updater["role"] not in [ParticipantRole.HOST, ParticipantRole.CO_HOST]:
            return {"success": False, "error": "Not authorized"}

        if new_role not in [r.value for r in ParticipantRole]:
            return {"success": False, "error": "Invalid role"}

        execute_query("""
            UPDATE watch_party_participants
            SET role = :role
            WHERE party_id = :party_id AND user_id = :user_id
        """, {"party_id": party_id, "user_id": user_id, "role": new_role})

        return {"success": True}

    # ==========================================================================
    # Playback Synchronization
    # ==========================================================================

    @staticmethod
    async def sync_playback(
        party_id: str,
        position_ms: int,
        is_playing: bool,
        synced_by: str
    ) -> Dict[str, Any]:
        """Sync playback position (host/co-host only)."""
        # Verify authority
        participant = execute_single("""
            SELECT role FROM watch_party_participants
            WHERE party_id = :party_id AND user_id = :user_id AND is_active = true
        """, {"party_id": party_id, "user_id": synced_by})

        if not participant or participant["role"] not in [ParticipantRole.HOST, ParticipantRole.CO_HOST]:
            return {"success": False, "error": "Only host can control playback"}

        # Update party state
        execute_query("""
            SELECT sync_party_position(:party_id, :position_ms, :is_playing)
        """, {
            "party_id": party_id,
            "position_ms": position_ms,
            "is_playing": is_playing
        })

        return {
            "success": True,
            "position_ms": position_ms,
            "is_playing": is_playing,
            "synced_at": datetime.utcnow().isoformat()
        }

    @staticmethod
    async def get_playback_state(party_id: str) -> Optional[Dict[str, Any]]:
        """Get current playback state for sync."""
        party = execute_single("""
            SELECT
                current_position_ms,
                is_playing,
                playback_rate,
                last_sync_at,
                status
            FROM watch_parties WHERE id = :party_id
        """, {"party_id": party_id})

        if not party:
            return None

        return dict(party)

    @staticmethod
    async def report_participant_position(
        party_id: str,
        user_id: str,
        position_ms: int
    ) -> Dict[str, Any]:
        """Report individual participant's position for sync verification."""
        execute_query("""
            UPDATE watch_party_participants
            SET
                last_reported_position_ms = :position_ms,
                last_heartbeat = NOW()
            WHERE party_id = :party_id AND user_id = :user_id
        """, {
            "party_id": party_id,
            "user_id": user_id,
            "position_ms": position_ms
        })

        # Check sync status (within 3 seconds of host)
        party_state = await WatchPartyService.get_playback_state(party_id)
        if party_state:
            offset = abs(position_ms - party_state["current_position_ms"])
            is_synced = offset < 3000  # 3 second tolerance

            execute_query("""
                UPDATE watch_party_participants
                SET is_synced = :is_synced, sync_offset_ms = :offset
                WHERE party_id = :party_id AND user_id = :user_id
            """, {
                "party_id": party_id,
                "user_id": user_id,
                "is_synced": is_synced,
                "offset": offset
            })

        return {"success": True}

    # ==========================================================================
    # Chat & Reactions
    # ==========================================================================

    @staticmethod
    async def send_message(
        party_id: str,
        user_id: str,
        content: str,
        message_type: str = "chat",
        episode_position_ms: Optional[int] = None
    ) -> Dict[str, Any]:
        """Send a chat message."""
        # Verify party allows chat and user can chat
        party = execute_single("""
            SELECT chat_enabled FROM watch_parties WHERE id = :party_id
        """, {"party_id": party_id})

        if not party or not party["chat_enabled"]:
            return {"success": False, "error": "Chat is disabled"}

        participant = execute_single("""
            SELECT can_chat, is_muted FROM watch_party_participants
            WHERE party_id = :party_id AND user_id = :user_id AND is_active = true
        """, {"party_id": party_id, "user_id": user_id})

        if not participant:
            return {"success": False, "error": "Not in party"}

        if not participant["can_chat"] or participant["is_muted"]:
            return {"success": False, "error": "You cannot send messages"}

        message = execute_insert("""
            INSERT INTO watch_party_messages (
                party_id, user_id, message_type, content, episode_position_ms
            ) VALUES (
                :party_id, :user_id, :message_type, :content, :episode_position_ms
            )
            RETURNING *
        """, {
            "party_id": party_id,
            "user_id": user_id,
            "message_type": message_type,
            "content": content,
            "episode_position_ms": episode_position_ms
        })

        # Update stats
        execute_query("""
            UPDATE watch_parties SET total_chat_messages = total_chat_messages + 1
            WHERE id = :party_id
        """, {"party_id": party_id})

        execute_query("""
            UPDATE watch_party_participants SET chat_messages_sent = chat_messages_sent + 1
            WHERE party_id = :party_id AND user_id = :user_id
        """, {"party_id": party_id, "user_id": user_id})

        return {"success": True, "message": dict(message)}

    @staticmethod
    async def send_reaction(
        party_id: str,
        user_id: str,
        reaction_emoji: str,
        episode_position_ms: Optional[int] = None
    ) -> Dict[str, Any]:
        """Send a reaction."""
        party = execute_single("""
            SELECT reactions_enabled FROM watch_parties WHERE id = :party_id
        """, {"party_id": party_id})

        if not party or not party["reactions_enabled"]:
            return {"success": False, "error": "Reactions are disabled"}

        message = execute_insert("""
            INSERT INTO watch_party_messages (
                party_id, user_id, message_type, reaction_emoji, episode_position_ms
            ) VALUES (
                :party_id, :user_id, 'reaction', :reaction_emoji, :episode_position_ms
            )
            RETURNING *
        """, {
            "party_id": party_id,
            "user_id": user_id,
            "reaction_emoji": reaction_emoji,
            "episode_position_ms": episode_position_ms
        })

        # Update stats
        execute_query("""
            UPDATE watch_parties SET total_reactions = total_reactions + 1
            WHERE id = :party_id
        """, {"party_id": party_id})

        execute_query("""
            UPDATE watch_party_participants SET reactions_sent = reactions_sent + 1
            WHERE party_id = :party_id AND user_id = :user_id
        """, {"party_id": party_id, "user_id": user_id})

        return {"success": True, "reaction": dict(message)}

    @staticmethod
    async def get_messages(
        party_id: str,
        limit: int = 100,
        since: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Get chat messages."""
        query = """
            SELECT
                m.*,
                p.display_name as user_name,
                p.avatar_url as user_avatar
            FROM watch_party_messages m
            JOIN profiles p ON m.user_id = p.id
            WHERE m.party_id = :party_id AND m.is_deleted = false
        """
        params = {"party_id": party_id, "limit": limit}

        if since:
            query += " AND m.created_at > :since"
            params["since"] = since

        query += " ORDER BY m.created_at DESC LIMIT :limit"

        messages = execute_query(query, params)
        return [dict(m) for m in messages]

    # ==========================================================================
    # Invitations
    # ==========================================================================

    @staticmethod
    async def invite_user(
        party_id: str,
        invited_by: str,
        invited_user_id: Optional[str] = None,
        invited_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Invite a user to the party."""
        if not invited_user_id and not invited_email:
            return {"success": False, "error": "Must provide user ID or email"}

        # Check if already invited
        if invited_user_id:
            existing = execute_single("""
                SELECT * FROM watch_party_invitations
                WHERE party_id = :party_id AND invited_user_id = :user_id
            """, {"party_id": party_id, "user_id": invited_user_id})

            if existing:
                return {"success": False, "error": "User already invited"}

        invitation = execute_insert("""
            INSERT INTO watch_party_invitations (
                party_id, invited_by, invited_user_id, invited_email
            ) VALUES (
                :party_id, :invited_by, :invited_user_id, :invited_email
            )
            RETURNING *
        """, {
            "party_id": party_id,
            "invited_by": invited_by,
            "invited_user_id": invited_user_id,
            "invited_email": invited_email
        })

        return {"success": True, "invitation": dict(invitation)}

    @staticmethod
    async def respond_to_invitation(
        invitation_id: str,
        user_id: str,
        accept: bool
    ) -> Dict[str, Any]:
        """Accept or decline an invitation."""
        invitation = execute_single("""
            SELECT * FROM watch_party_invitations
            WHERE id = :id AND invited_user_id = :user_id AND status = 'pending'
        """, {"id": invitation_id, "user_id": user_id})

        if not invitation:
            return {"success": False, "error": "Invitation not found"}

        status = "accepted" if accept else "declined"

        execute_query("""
            UPDATE watch_party_invitations
            SET status = :status, responded_at = NOW()
            WHERE id = :id
        """, {"id": invitation_id, "status": status})

        if accept:
            # Auto-join the party
            await WatchPartyService.join_party(invitation["party_id"], user_id)

        return {"success": True, "status": status}

    # ==========================================================================
    # Discovery & Listing
    # ==========================================================================

    @staticmethod
    async def list_public_parties(
        world_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List public watch parties."""
        query = """
            SELECT * FROM v_active_watch_parties
            WHERE party_type IN ('public', 'premiere')
        """
        params = {"limit": limit, "offset": offset}

        if world_id:
            query += " AND world_id = :world_id"
            params["world_id"] = world_id

        query += " LIMIT :limit OFFSET :offset"

        parties = execute_query(query, params)
        return [dict(p) for p in parties]

    @staticmethod
    async def list_user_parties(
        user_id: str,
        include_past: bool = False,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """List parties the user is participating in or has been invited to."""
        query = """
            SELECT DISTINCT
                wp.*,
                w.title as world_title,
                h.display_name as host_name,
                wpp.role as my_role
            FROM watch_parties wp
            JOIN worlds w ON wp.world_id = w.id
            JOIN profiles h ON wp.host_id = h.id
            LEFT JOIN watch_party_participants wpp ON wp.id = wpp.party_id AND wpp.user_id = :user_id
            LEFT JOIN watch_party_invitations wpi ON wp.id = wpi.party_id AND wpi.invited_user_id = :user_id
            WHERE (wpp.user_id IS NOT NULL OR wpi.invited_user_id IS NOT NULL)
        """
        params = {"user_id": user_id, "limit": limit}

        if not include_past:
            query += " AND wp.status NOT IN ('ended', 'cancelled')"

        query += " ORDER BY wp.scheduled_start DESC LIMIT :limit"

        parties = execute_query(query, params)
        return [dict(p) for p in parties]

    # ==========================================================================
    # Helpers
    # ==========================================================================

    @staticmethod
    def _generate_invite_code() -> str:
        """Generate a unique invite code."""
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return "".join(secrets.choice(chars) for _ in range(8))
