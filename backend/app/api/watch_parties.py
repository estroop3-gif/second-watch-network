"""
Watch Parties API
Phase 5C: Synchronized group viewing endpoints.

Provides:
- Party creation and management
- Participant management
- Playback synchronization
- Chat and reactions
- Invitation handling
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.services.watch_party_service import WatchPartyService, PartyStatus, PartyType

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class CreatePartyRequest(BaseModel):
    """Request to create a watch party."""
    world_id: str
    title: str = Field(..., max_length=200)
    episode_id: Optional[str] = None
    description: Optional[str] = Field(None, max_length=1000)
    party_type: str = Field(default="private", description="private, friends, public, premiere")
    scheduled_start: Optional[datetime] = None
    max_participants: int = Field(default=50, ge=2, le=500)
    chat_enabled: bool = True
    reactions_enabled: bool = True
    voice_chat_enabled: bool = False
    requires_premium: bool = False


class SyncPlaybackRequest(BaseModel):
    """Request to sync playback position."""
    position_ms: int = Field(..., ge=0)
    is_playing: bool


class SendMessageRequest(BaseModel):
    """Request to send a chat message."""
    content: str = Field(..., max_length=500)
    message_type: str = Field(default="chat")
    episode_position_ms: Optional[int] = None


class SendReactionRequest(BaseModel):
    """Request to send a reaction."""
    reaction_emoji: str = Field(..., max_length=10)
    episode_position_ms: Optional[int] = None


class InviteRequest(BaseModel):
    """Request to invite a user."""
    user_id: Optional[str] = None
    email: Optional[str] = None


class UpdateRoleRequest(BaseModel):
    """Request to update participant role."""
    role: str = Field(..., description="host, co_host, moderator, viewer")


# =============================================================================
# Helper Functions
# =============================================================================

async def get_profile_id(user: dict) -> str:
    """Get profile ID from Cognito user."""
    from app.api.users import get_profile_id_from_cognito_id
    return await get_profile_id_from_cognito_id(user["sub"])


async def verify_party_host(party_id: str, profile_id: str) -> dict:
    """Verify user is host of the party."""
    party = await WatchPartyService.get_party(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    if str(party["host_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Only host can perform this action")

    return party


# =============================================================================
# Party Creation & Management
# =============================================================================

@router.post("/watch-parties")
async def create_watch_party(
    request: CreatePartyRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new watch party.

    Party types:
    - private: Invite only, requires invite code
    - friends: Open to host's connections
    - public: Anyone can join
    - premiere: Official premiere event
    """
    profile_id = await get_profile_id(current_user)

    # Verify world exists and user has access
    world = execute_single("""
        SELECT id, status FROM worlds WHERE id = :world_id
    """, {"world_id": request.world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    if world["status"] != "published":
        raise HTTPException(status_code=400, detail="World must be published")

    # Validate party type
    valid_types = [t.value for t in PartyType]
    if request.party_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid party type. Must be one of: {', '.join(valid_types)}"
        )

    result = await WatchPartyService.create_party(
        host_id=profile_id,
        world_id=request.world_id,
        title=request.title,
        episode_id=request.episode_id,
        party_type=request.party_type,
        scheduled_start=request.scheduled_start,
        description=request.description,
        max_participants=request.max_participants,
        chat_enabled=request.chat_enabled,
        reactions_enabled=request.reactions_enabled,
        voice_chat_enabled=request.voice_chat_enabled,
        requires_premium=request.requires_premium
    )

    return result


@router.get("/watch-parties/{party_id}")
async def get_watch_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get watch party details."""
    party = await WatchPartyService.get_party(party_id)

    if not party:
        raise HTTPException(status_code=404, detail="Party not found")

    return party


@router.get("/watch-parties/invite/{invite_code}")
async def get_party_by_invite(
    invite_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Get party details by invite code."""
    party = await WatchPartyService.get_party_by_invite_code(invite_code)

    if not party:
        raise HTTPException(status_code=404, detail="Party not found or expired")

    return party


@router.post("/watch-parties/{party_id}/start")
async def start_watch_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start the watch party (host only)."""
    profile_id = await get_profile_id(current_user)
    await verify_party_host(party_id, profile_id)

    result = await WatchPartyService.update_party_status(
        party_id, PartyStatus.WAITING, profile_id
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/watch-parties/{party_id}/end")
async def end_watch_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End the watch party (host only)."""
    profile_id = await get_profile_id(current_user)
    await verify_party_host(party_id, profile_id)

    result = await WatchPartyService.update_party_status(
        party_id, PartyStatus.ENDED, profile_id
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/watch-parties/{party_id}/cancel")
async def cancel_watch_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel the watch party (host only)."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.cancel_party(party_id, profile_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Participant Management
# =============================================================================

@router.post("/watch-parties/{party_id}/join")
async def join_watch_party(
    party_id: str,
    invite_code: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Join a watch party."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.join_party(party_id, profile_id, invite_code)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/watch-parties/{party_id}/leave")
async def leave_watch_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Leave a watch party."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.leave_party(party_id, profile_id)

    return result


@router.get("/watch-parties/{party_id}/participants")
async def get_party_participants(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all participants in a party."""
    participants = await WatchPartyService.get_participants(party_id)

    return {"participants": participants}


@router.put("/watch-parties/{party_id}/participants/{user_id}/role")
async def update_participant_role(
    party_id: str,
    user_id: str,
    request: UpdateRoleRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a participant's role (host/co-host only)."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.update_participant_role(
        party_id, user_id, request.role, profile_id
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Playback Synchronization
# =============================================================================

@router.post("/watch-parties/{party_id}/sync")
async def sync_playback(
    party_id: str,
    request: SyncPlaybackRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Sync playback position (host/co-host only).

    All participants should receive this via WebSocket.
    """
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.sync_playback(
        party_id, request.position_ms, request.is_playing, profile_id
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/watch-parties/{party_id}/playback-state")
async def get_playback_state(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current playback state for sync."""
    state = await WatchPartyService.get_playback_state(party_id)

    if not state:
        raise HTTPException(status_code=404, detail="Party not found")

    return state


@router.post("/watch-parties/{party_id}/report-position")
async def report_position(
    party_id: str,
    position_ms: int = Query(..., ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Report participant's current position for sync verification."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.report_participant_position(
        party_id, profile_id, position_ms
    )

    return result


# =============================================================================
# Chat & Reactions
# =============================================================================

@router.post("/watch-parties/{party_id}/messages")
async def send_message(
    party_id: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a chat message."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.send_message(
        party_id=party_id,
        user_id=profile_id,
        content=request.content,
        message_type=request.message_type,
        episode_position_ms=request.episode_position_ms
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/watch-parties/{party_id}/reactions")
async def send_reaction(
    party_id: str,
    request: SendReactionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a reaction emoji."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.send_reaction(
        party_id=party_id,
        user_id=profile_id,
        reaction_emoji=request.reaction_emoji,
        episode_position_ms=request.episode_position_ms
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.get("/watch-parties/{party_id}/messages")
async def get_messages(
    party_id: str,
    limit: int = Query(100, le=500),
    since: Optional[datetime] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get chat messages."""
    messages = await WatchPartyService.get_messages(party_id, limit, since)

    return {"messages": messages}


# =============================================================================
# Invitations
# =============================================================================

@router.post("/watch-parties/{party_id}/invitations")
async def invite_to_party(
    party_id: str,
    request: InviteRequest,
    current_user: dict = Depends(get_current_user)
):
    """Invite a user to the party."""
    profile_id = await get_profile_id(current_user)

    # Verify host or co-host
    participant = execute_single("""
        SELECT role FROM watch_party_participants
        WHERE party_id = :party_id AND user_id = :user_id AND is_active = true
    """, {"party_id": party_id, "user_id": profile_id})

    if not participant or participant["role"] not in ["host", "co_host"]:
        raise HTTPException(status_code=403, detail="Not authorized to invite")

    result = await WatchPartyService.invite_user(
        party_id=party_id,
        invited_by=profile_id,
        invited_user_id=request.user_id,
        invited_email=request.email
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/watch-parties/invitations/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Accept a party invitation."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.respond_to_invitation(
        invitation_id, profile_id, accept=True
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


@router.post("/watch-parties/invitations/{invitation_id}/decline")
async def decline_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Decline a party invitation."""
    profile_id = await get_profile_id(current_user)

    result = await WatchPartyService.respond_to_invitation(
        invitation_id, profile_id, accept=False
    )

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))

    return result


# =============================================================================
# Discovery & Listing
# =============================================================================

@router.get("/watch-parties")
async def list_public_parties(
    world_id: Optional[str] = None,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List public watch parties."""
    parties = await WatchPartyService.list_public_parties(
        world_id=world_id,
        limit=limit,
        offset=offset
    )

    return {"parties": parties}


@router.get("/me/watch-parties")
async def list_my_parties(
    include_past: bool = Query(False),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """List parties the current user is in or invited to."""
    profile_id = await get_profile_id(current_user)

    parties = await WatchPartyService.list_user_parties(
        user_id=profile_id,
        include_past=include_past,
        limit=limit
    )

    return {"parties": parties}


@router.get("/worlds/{world_id}/watch-parties")
async def list_world_parties(
    world_id: str,
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """List active watch parties for a World."""
    parties = await WatchPartyService.list_public_parties(
        world_id=world_id,
        limit=limit,
        offset=offset
    )

    return {"world_id": world_id, "parties": parties}
