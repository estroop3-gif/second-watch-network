"""
Coms API - Production Communications System
Handles channels, messages, voice rooms, and presence
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime
from app.core.database import get_client, execute_query, execute_single
from app.core.auth import get_current_user
from app.schemas.coms import (
    Channel, ChannelCreate, ChannelUpdate, ChannelWithMembers, ChannelListResponse,
    Message, MessageCreate, MessageUpdate, MessagePage,
    ChannelMember, ChannelMemberAdd, ChannelMemberUpdate, ChannelMemberInfo,
    VoiceJoinResponse, VoiceParticipant, VoiceRoom,
    UserPresence, PresenceUpdate, ProjectPresence,
    MarkReadRequest, UnreadCount, UnreadCountsResponse,
    ChannelTemplate, ApplyTemplatesRequest, ApplyTemplatesResponse,
)

router = APIRouter()

# Default ICE servers for WebRTC
DEFAULT_ICE_SERVERS = [
    {"urls": "stun:stun.l.google.com:19302"},
    {"urls": "stun:stun1.l.google.com:19302"},
]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_user_backlot_role(project_id: str, user_id: str) -> Optional[str]:
    """Get user's backlot role for a project"""
    result = await execute_single(
        """
        SELECT backlot_role FROM backlot_project_roles
        WHERE project_id = $1 AND user_id = $2 AND is_primary = true
        """,
        project_id, user_id
    )
    return result["backlot_role"] if result else None


async def can_access_channel(channel_id: str, user_id: str, project_id: Optional[str] = None) -> bool:
    """Check if user can access a channel"""
    channel = await execute_single(
        "SELECT * FROM coms_channels WHERE id = $1 AND archived_at IS NULL",
        channel_id
    )
    if not channel:
        return False

    # Check if explicit member
    member = await execute_single(
        "SELECT id FROM coms_channel_members WHERE channel_id = $1 AND user_id = $2",
        channel_id, user_id
    )
    if member:
        return True

    # For private channels, must be member
    if channel["is_private"]:
        return False

    # Check role-based visibility
    visible_roles = channel.get("visible_to_roles") or []
    if not visible_roles:
        return True  # No restrictions

    # Get user's role in project
    if channel["project_id"]:
        user_role = await get_user_backlot_role(channel["project_id"], user_id)
        if user_role and user_role in visible_roles:
            return True

    return False


async def can_transmit_in_channel(channel_id: str, user_id: str) -> bool:
    """Check if user can transmit (voice) in a channel"""
    channel = await execute_single(
        "SELECT * FROM coms_channels WHERE id = $1 AND archived_at IS NULL",
        channel_id
    )
    if not channel:
        return False

    # Check member override
    member = await execute_single(
        "SELECT can_transmit, is_muted FROM coms_channel_members WHERE channel_id = $1 AND user_id = $2",
        channel_id, user_id
    )
    if member:
        return member["can_transmit"] and not member["is_muted"]

    # Check role-based transmit
    transmit_roles = channel.get("can_transmit_roles") or []
    if not transmit_roles:
        return True  # No restrictions

    if channel["project_id"]:
        user_role = await get_user_backlot_role(channel["project_id"], user_id)
        if user_role and user_role in transmit_roles:
            return True

    return False


async def is_project_admin(project_id: str, user_id: str) -> bool:
    """Check if user is admin/owner of project"""
    result = await execute_single(
        """
        SELECT role FROM backlot_project_members
        WHERE project_id = $1 AND user_id = $2 AND role IN ('owner', 'admin')
        """,
        project_id, user_id
    )
    return result is not None


async def can_create_channel(project_id: str, user_id: str) -> bool:
    """Check if user can create channels (above-the-line roles)"""
    # Project admins can always create
    if await is_project_admin(project_id, user_id):
        return True

    # Check backlot role
    user_role = await get_user_backlot_role(project_id, user_id)
    allowed_roles = ["showrunner", "producer", "director", "first_ad"]
    return user_role in allowed_roles if user_role else False


# ============================================================================
# CHANNELS
# ============================================================================

@router.get("/channels", response_model=ChannelListResponse)
async def list_channels(
    project_id: Optional[str] = Query(None),
    scope: str = Query("project"),
    user=Depends(get_current_user)
):
    """List channels visible to the current user"""
    user_id = user["id"]

    if scope == "project" and not project_id:
        raise HTTPException(status_code=400, detail="project_id required for project scope")

    # Get user's role for filtering
    user_role = None
    if project_id:
        user_role = await get_user_backlot_role(project_id, user_id)

    # Build query
    if scope == "project":
        channels = await execute_query(
            """
            SELECT c.*,
                   COALESCE(get_coms_unread_count(c.id, $2), 0) as unread_count,
                   (SELECT COUNT(*) FROM coms_channel_members WHERE channel_id = c.id) as member_count
            FROM coms_channels c
            WHERE c.project_id = $1
              AND c.scope = 'project'
              AND c.archived_at IS NULL
              AND (
                  -- No role restrictions
                  (c.visible_to_roles IS NULL OR array_length(c.visible_to_roles, 1) IS NULL OR array_length(c.visible_to_roles, 1) = 0)
                  -- User's role matches
                  OR ($3 = ANY(c.visible_to_roles))
                  -- User is explicit member
                  OR EXISTS (SELECT 1 FROM coms_channel_members WHERE channel_id = c.id AND user_id = $2)
              )
            ORDER BY c.sort_order, c.created_at
            """,
            project_id, user_id, user_role
        )
    else:
        # Global channels (premium feature)
        channels = await execute_query(
            """
            SELECT c.*,
                   COALESCE(get_coms_unread_count(c.id, $1), 0) as unread_count,
                   (SELECT COUNT(*) FROM coms_channel_members WHERE channel_id = c.id) as member_count
            FROM coms_channels c
            WHERE c.scope = 'global'
              AND c.archived_at IS NULL
            ORDER BY c.sort_order, c.created_at
            """,
            user_id
        )

    # Get last message for each channel
    for channel in channels:
        last_msg = await execute_single(
            """
            SELECT m.*, p.username, p.full_name, p.avatar_url
            FROM coms_messages m
            LEFT JOIN profiles p ON p.id = m.sender_id
            WHERE m.channel_id = $1 AND m.is_deleted = FALSE
            ORDER BY m.created_at DESC
            LIMIT 1
            """,
            channel["id"]
        )
        if last_msg:
            channel["last_message"] = {
                "id": last_msg["id"],
                "content": last_msg["content"],
                "message_type": last_msg["message_type"],
                "sender_id": last_msg["sender_id"],
                "created_at": last_msg["created_at"],
                "sender": {
                    "id": last_msg["sender_id"],
                    "username": last_msg["username"],
                    "full_name": last_msg["full_name"],
                    "avatar_url": last_msg["avatar_url"],
                }
            }

    return {"channels": channels, "total": len(channels)}


@router.post("/channels", response_model=Channel)
async def create_channel(
    channel: ChannelCreate,
    user=Depends(get_current_user)
):
    """Create a new channel"""
    user_id = user["id"]

    # Validate project scope
    if channel.scope == "project":
        if not channel.project_id:
            raise HTTPException(status_code=400, detail="project_id required for project scope")

        # Check permission to create
        if not await can_create_channel(channel.project_id, user_id):
            raise HTTPException(status_code=403, detail="Not authorized to create channels")

    # Create channel
    result = await execute_single(
        """
        INSERT INTO coms_channels (
            name, description, channel_type, scope, project_id,
            icon, color, template_key, visible_to_roles, can_transmit_roles,
            is_private, created_by, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        """,
        channel.name,
        channel.description,
        channel.channel_type.value,
        channel.scope.value,
        channel.project_id,
        channel.icon,
        channel.color,
        channel.template_key,
        channel.visible_to_roles,
        channel.can_transmit_roles,
        channel.is_private,
        user_id,
        0
    )

    # Add creator as admin member for private channels
    if channel.is_private:
        await execute_single(
            """
            INSERT INTO coms_channel_members (channel_id, user_id, role, can_transmit)
            VALUES ($1, $2, 'admin', true)
            """,
            result["id"], user_id
        )

    return {**result, "unread_count": 0, "member_count": 1 if channel.is_private else 0}


@router.get("/channels/{channel_id}", response_model=ChannelWithMembers)
async def get_channel(
    channel_id: str,
    user=Depends(get_current_user)
):
    """Get channel details"""
    user_id = user["id"]

    if not await can_access_channel(channel_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this channel")

    channel = await execute_single(
        """
        SELECT c.*,
               COALESCE(get_coms_unread_count(c.id, $2), 0) as unread_count,
               (SELECT COUNT(*) FROM coms_channel_members WHERE channel_id = c.id) as member_count
        FROM coms_channels c
        WHERE c.id = $1 AND c.archived_at IS NULL
        """,
        channel_id, user_id
    )

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Get members
    members = await execute_query(
        """
        SELECT cm.*, p.username, p.full_name, p.avatar_url
        FROM coms_channel_members cm
        LEFT JOIN profiles p ON p.id = cm.user_id
        WHERE cm.channel_id = $1
        ORDER BY cm.joined_at
        """,
        channel_id
    )

    return {**channel, "members": members}


@router.put("/channels/{channel_id}", response_model=Channel)
async def update_channel(
    channel_id: str,
    update: ChannelUpdate,
    user=Depends(get_current_user)
):
    """Update channel settings"""
    user_id = user["id"]

    channel = await execute_single(
        "SELECT * FROM coms_channels WHERE id = $1 AND archived_at IS NULL",
        channel_id
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check permission (creator, admin member, or project admin)
    is_creator = channel["created_by"] == user_id
    is_channel_admin = await execute_single(
        "SELECT id FROM coms_channel_members WHERE channel_id = $1 AND user_id = $2 AND role = 'admin'",
        channel_id, user_id
    )
    is_proj_admin = channel["project_id"] and await is_project_admin(channel["project_id"], user_id)

    if not (is_creator or is_channel_admin or is_proj_admin):
        raise HTTPException(status_code=403, detail="Not authorized to update this channel")

    # Build update query
    update_fields = []
    params = []
    param_count = 1

    for field, value in update.model_dump(exclude_unset=True).items():
        if value is not None:
            update_fields.append(f"{field} = ${param_count}")
            params.append(value)
            param_count += 1

    if not update_fields:
        return channel

    params.append(channel_id)
    query = f"""
        UPDATE coms_channels
        SET {', '.join(update_fields)}, updated_at = NOW()
        WHERE id = ${param_count}
        RETURNING *
    """

    result = await execute_single(query, *params)
    return {**result, "unread_count": 0, "member_count": 0}


@router.delete("/channels/{channel_id}")
async def archive_channel(
    channel_id: str,
    user=Depends(get_current_user)
):
    """Archive a channel"""
    user_id = user["id"]

    channel = await execute_single(
        "SELECT * FROM coms_channels WHERE id = $1 AND archived_at IS NULL",
        channel_id
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check permission
    is_creator = channel["created_by"] == user_id
    is_proj_admin = channel["project_id"] and await is_project_admin(channel["project_id"], user_id)

    if not (is_creator or is_proj_admin):
        raise HTTPException(status_code=403, detail="Not authorized to delete this channel")

    await execute_single(
        "UPDATE coms_channels SET archived_at = NOW() WHERE id = $1",
        channel_id
    )

    return {"success": True, "message": "Channel archived"}


# ============================================================================
# MESSAGES
# ============================================================================

@router.get("/channels/{channel_id}/messages", response_model=MessagePage)
async def list_messages(
    channel_id: str,
    before: Optional[str] = Query(None, description="Cursor for pagination (message ID)"),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(get_current_user)
):
    """List messages in a channel with cursor pagination"""
    user_id = user["id"]

    if not await can_access_channel(channel_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized to view this channel")

    # Build query with cursor pagination
    if before:
        messages = await execute_query(
            """
            SELECT m.*, p.username, p.full_name, p.avatar_url,
                   bpr.backlot_role as production_role
            FROM coms_messages m
            LEFT JOIN profiles p ON p.id = m.sender_id
            LEFT JOIN backlot_project_roles bpr ON bpr.user_id = m.sender_id
                AND bpr.project_id = (SELECT project_id FROM coms_channels WHERE id = $1)
                AND bpr.is_primary = true
            WHERE m.channel_id = $1
              AND m.is_deleted = FALSE
              AND m.created_at < (SELECT created_at FROM coms_messages WHERE id = $2)
            ORDER BY m.created_at DESC
            LIMIT $3
            """,
            channel_id, before, limit + 1
        )
    else:
        messages = await execute_query(
            """
            SELECT m.*, p.username, p.full_name, p.avatar_url,
                   bpr.backlot_role as production_role
            FROM coms_messages m
            LEFT JOIN profiles p ON p.id = m.sender_id
            LEFT JOIN backlot_project_roles bpr ON bpr.user_id = m.sender_id
                AND bpr.project_id = (SELECT project_id FROM coms_channels WHERE id = $1)
                AND bpr.is_primary = true
            WHERE m.channel_id = $1 AND m.is_deleted = FALSE
            ORDER BY m.created_at DESC
            LIMIT $2
            """,
            channel_id, limit + 1
        )

    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    # Format messages with sender info
    formatted = []
    for msg in messages:
        formatted.append({
            **msg,
            "sender": {
                "id": msg["sender_id"],
                "username": msg["username"],
                "full_name": msg["full_name"],
                "avatar_url": msg["avatar_url"],
                "production_role": msg.get("production_role"),
            }
        })

    return {
        "messages": formatted,
        "has_more": has_more,
        "next_cursor": formatted[-1]["id"] if formatted and has_more else None
    }


@router.post("/channels/{channel_id}/messages", response_model=Message)
async def send_message(
    channel_id: str,
    message: MessageCreate,
    user=Depends(get_current_user)
):
    """Send a message to a channel"""
    user_id = user["id"]

    if not await can_access_channel(channel_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized to send messages in this channel")

    # Create message
    result = await execute_single(
        """
        INSERT INTO coms_messages (channel_id, sender_id, content, message_type, attachments, reply_to_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        """,
        channel_id,
        user_id,
        message.content,
        message.message_type.value,
        message.attachments,
        message.reply_to_id
    )

    # Get sender info
    sender = await execute_single(
        """
        SELECT p.username, p.full_name, p.avatar_url, bpr.backlot_role as production_role
        FROM profiles p
        LEFT JOIN backlot_project_roles bpr ON bpr.user_id = p.id
            AND bpr.project_id = (SELECT project_id FROM coms_channels WHERE id = $1)
            AND bpr.is_primary = true
        WHERE p.id = $2
        """,
        channel_id, user_id
    )

    return {
        **result,
        "sender": {
            "id": user_id,
            "username": sender["username"] if sender else None,
            "full_name": sender["full_name"] if sender else None,
            "avatar_url": sender["avatar_url"] if sender else None,
            "production_role": sender.get("production_role") if sender else None,
        }
    }


@router.put("/messages/{message_id}", response_model=Message)
async def edit_message(
    message_id: str,
    update: MessageUpdate,
    user=Depends(get_current_user)
):
    """Edit a message (owner only)"""
    user_id = user["id"]

    message = await execute_single(
        "SELECT * FROM coms_messages WHERE id = $1 AND is_deleted = FALSE",
        message_id
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    if message["sender_id"] != user_id:
        raise HTTPException(status_code=403, detail="Can only edit your own messages")

    result = await execute_single(
        """
        UPDATE coms_messages
        SET content = $1, edited_at = NOW()
        WHERE id = $2
        RETURNING *
        """,
        update.content, message_id
    )

    return result


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    user=Depends(get_current_user)
):
    """Delete a message"""
    user_id = user["id"]

    message = await execute_single(
        "SELECT * FROM coms_messages WHERE id = $1 AND is_deleted = FALSE",
        message_id
    )
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check permission (sender or channel/project admin)
    if message["sender_id"] != user_id:
        channel = await execute_single(
            "SELECT project_id FROM coms_channels WHERE id = $1",
            message["channel_id"]
        )
        if not channel or not await is_project_admin(channel["project_id"], user_id):
            raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    await execute_single(
        "UPDATE coms_messages SET is_deleted = TRUE WHERE id = $1",
        message_id
    )

    return {"success": True}


# ============================================================================
# CHANNEL MEMBERS
# ============================================================================

@router.get("/channels/{channel_id}/members", response_model=List[ChannelMember])
async def list_channel_members(
    channel_id: str,
    user=Depends(get_current_user)
):
    """List channel members"""
    user_id = user["id"]

    if not await can_access_channel(channel_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    members = await execute_query(
        """
        SELECT cm.*, p.username, p.full_name, p.avatar_url
        FROM coms_channel_members cm
        LEFT JOIN profiles p ON p.id = cm.user_id
        WHERE cm.channel_id = $1
        ORDER BY cm.joined_at
        """,
        channel_id
    )

    return members


@router.post("/channels/{channel_id}/members", response_model=ChannelMember)
async def add_channel_member(
    channel_id: str,
    member: ChannelMemberAdd,
    user=Depends(get_current_user)
):
    """Add a member to a channel"""
    user_id = user["id"]

    channel = await execute_single(
        "SELECT * FROM coms_channels WHERE id = $1 AND archived_at IS NULL",
        channel_id
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check permission
    is_channel_admin = await execute_single(
        "SELECT id FROM coms_channel_members WHERE channel_id = $1 AND user_id = $2 AND role = 'admin'",
        channel_id, user_id
    )
    is_proj_admin = channel["project_id"] and await is_project_admin(channel["project_id"], user_id)

    if not (is_channel_admin or is_proj_admin):
        raise HTTPException(status_code=403, detail="Not authorized to add members")

    # Check if already member
    existing = await execute_single(
        "SELECT id FROM coms_channel_members WHERE channel_id = $1 AND user_id = $2",
        channel_id, member.user_id
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")

    result = await execute_single(
        """
        INSERT INTO coms_channel_members (channel_id, user_id, role, can_transmit)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        channel_id, member.user_id, member.role.value, member.can_transmit
    )

    # Get user info
    user_info = await execute_single(
        "SELECT username, full_name, avatar_url FROM profiles WHERE id = $1",
        member.user_id
    )

    return {**result, **(user_info or {})}


@router.delete("/channels/{channel_id}/members/{member_user_id}")
async def remove_channel_member(
    channel_id: str,
    member_user_id: str,
    user=Depends(get_current_user)
):
    """Remove a member from a channel"""
    user_id = user["id"]

    channel = await execute_single(
        "SELECT * FROM coms_channels WHERE id = $1 AND archived_at IS NULL",
        channel_id
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Check permission (self, channel admin, or project admin)
    is_self = member_user_id == user_id
    is_channel_admin = await execute_single(
        "SELECT id FROM coms_channel_members WHERE channel_id = $1 AND user_id = $2 AND role = 'admin'",
        channel_id, user_id
    )
    is_proj_admin = channel["project_id"] and await is_project_admin(channel["project_id"], user_id)

    if not (is_self or is_channel_admin or is_proj_admin):
        raise HTTPException(status_code=403, detail="Not authorized to remove members")

    await execute_single(
        "DELETE FROM coms_channel_members WHERE channel_id = $1 AND user_id = $2",
        channel_id, member_user_id
    )

    return {"success": True}


# ============================================================================
# VOICE
# ============================================================================

@router.post("/channels/{channel_id}/voice/join", response_model=VoiceJoinResponse)
async def join_voice_room(
    channel_id: str,
    user=Depends(get_current_user)
):
    """Join a voice channel"""
    user_id = user["id"]

    if not await can_access_channel(channel_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    channel = await execute_single(
        "SELECT * FROM coms_channels WHERE id = $1 AND archived_at IS NULL",
        channel_id
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    if channel["channel_type"] not in ["voice", "text_and_voice"]:
        raise HTTPException(status_code=400, detail="Channel does not support voice")

    # Get or create voice room
    room = await execute_single(
        "SELECT * FROM coms_voice_rooms WHERE channel_id = $1 AND is_active = TRUE",
        channel_id
    )
    if not room:
        room = await execute_single(
            """
            INSERT INTO coms_voice_rooms (channel_id, ice_servers)
            VALUES ($1, $2)
            RETURNING *
            """,
            channel_id, DEFAULT_ICE_SERVERS
        )

    # Add participant
    participant = await execute_single(
        """
        INSERT INTO coms_voice_participants (room_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (room_id, user_id)
        DO UPDATE SET joined_at = NOW(), last_activity_at = NOW()
        RETURNING *
        """,
        room["id"], user_id
    )

    # Get all participants
    participants = await execute_query(
        """
        SELECT vp.*, p.username, p.full_name, p.avatar_url,
               bpr.backlot_role as production_role
        FROM coms_voice_participants vp
        LEFT JOIN profiles p ON p.id = vp.user_id
        LEFT JOIN backlot_project_roles bpr ON bpr.user_id = vp.user_id
            AND bpr.project_id = $2
            AND bpr.is_primary = true
        WHERE vp.room_id = $1
        """,
        room["id"], channel["project_id"]
    )

    return {
        "room_id": room["id"],
        "channel_id": channel_id,
        "ice_servers": room.get("ice_servers") or DEFAULT_ICE_SERVERS,
        "participants": participants
    }


@router.post("/channels/{channel_id}/voice/leave")
async def leave_voice_room(
    channel_id: str,
    user=Depends(get_current_user)
):
    """Leave a voice channel"""
    user_id = user["id"]

    room = await execute_single(
        "SELECT * FROM coms_voice_rooms WHERE channel_id = $1 AND is_active = TRUE",
        channel_id
    )
    if room:
        await execute_single(
            "DELETE FROM coms_voice_participants WHERE room_id = $1 AND user_id = $2",
            room["id"], user_id
        )

        # Check if room is empty
        remaining = await execute_single(
            "SELECT COUNT(*) as count FROM coms_voice_participants WHERE room_id = $1",
            room["id"]
        )
        if remaining["count"] == 0:
            await execute_single(
                "UPDATE coms_voice_rooms SET is_active = FALSE, ended_at = NOW() WHERE id = $1",
                room["id"]
            )

    return {"success": True}


@router.get("/channels/{channel_id}/voice/participants", response_model=List[VoiceParticipant])
async def get_voice_participants(
    channel_id: str,
    user=Depends(get_current_user)
):
    """Get current voice participants"""
    user_id = user["id"]

    if not await can_access_channel(channel_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    channel = await execute_single(
        "SELECT project_id FROM coms_channels WHERE id = $1",
        channel_id
    )

    room = await execute_single(
        "SELECT * FROM coms_voice_rooms WHERE channel_id = $1 AND is_active = TRUE",
        channel_id
    )
    if not room:
        return []

    participants = await execute_query(
        """
        SELECT vp.*, p.username, p.full_name, p.avatar_url,
               bpr.backlot_role as production_role
        FROM coms_voice_participants vp
        LEFT JOIN profiles p ON p.id = vp.user_id
        LEFT JOIN backlot_project_roles bpr ON bpr.user_id = vp.user_id
            AND bpr.project_id = $2
            AND bpr.is_primary = true
        WHERE vp.room_id = $1
        """,
        room["id"], channel["project_id"] if channel else None
    )

    return participants


# ============================================================================
# PRESENCE
# ============================================================================

@router.put("/presence", response_model=UserPresence)
async def update_presence(
    presence: PresenceUpdate,
    user=Depends(get_current_user)
):
    """Update user presence status"""
    user_id = user["id"]

    result = await execute_single(
        """
        INSERT INTO coms_user_presence (user_id, status, status_message, current_channel_id, current_project_id)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id)
        DO UPDATE SET
            status = $2,
            status_message = $3,
            current_channel_id = $4,
            current_project_id = $5,
            last_seen_at = NOW()
        RETURNING *
        """,
        user_id,
        presence.status.value,
        presence.status_message,
        presence.current_channel_id,
        presence.current_project_id
    )

    # Get user info
    user_info = await execute_single(
        "SELECT username, full_name, avatar_url FROM profiles WHERE id = $1",
        user_id
    )

    return {**result, **(user_info or {})}


@router.get("/presence/project/{project_id}", response_model=ProjectPresence)
async def get_project_presence(
    project_id: str,
    user=Depends(get_current_user)
):
    """Get presence for all users in a project"""
    # Get project members with presence
    users = await execute_query(
        """
        SELECT p.id as user_id, p.username, p.full_name, p.avatar_url,
               COALESCE(up.status, 'offline') as status,
               up.status_message,
               up.current_channel_id,
               up.current_project_id,
               COALESCE(up.last_seen_at, bpm.joined_at) as last_seen_at
        FROM backlot_project_members bpm
        JOIN profiles p ON p.id = bpm.user_id
        LEFT JOIN coms_user_presence up ON up.user_id = bpm.user_id
        WHERE bpm.project_id = $1
        ORDER BY
            CASE up.status
                WHEN 'online' THEN 1
                WHEN 'busy' THEN 2
                WHEN 'away' THEN 3
                ELSE 4
            END,
            p.full_name
        """,
        project_id
    )

    online_count = sum(1 for u in users if u["status"] == "online")
    away_count = sum(1 for u in users if u["status"] == "away")

    return {
        "project_id": project_id,
        "users": users,
        "online_count": online_count,
        "away_count": away_count
    }


# ============================================================================
# READ RECEIPTS
# ============================================================================

@router.post("/channels/{channel_id}/read")
async def mark_channel_read(
    channel_id: str,
    request: MarkReadRequest,
    user=Depends(get_current_user)
):
    """Mark channel as read"""
    user_id = user["id"]

    if not await can_access_channel(channel_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    if request.message_id:
        # Mark up to specific message
        await execute_single(
            """
            INSERT INTO coms_read_receipts (channel_id, user_id, last_read_message_id, last_read_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (channel_id, user_id)
            DO UPDATE SET last_read_message_id = $3, last_read_at = NOW()
            """,
            channel_id, user_id, request.message_id
        )
    else:
        # Mark all as read (get latest message)
        latest = await execute_single(
            "SELECT id FROM coms_messages WHERE channel_id = $1 ORDER BY created_at DESC LIMIT 1",
            channel_id
        )
        if latest:
            await execute_single(
                """
                INSERT INTO coms_read_receipts (channel_id, user_id, last_read_message_id, last_read_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (channel_id, user_id)
                DO UPDATE SET last_read_message_id = $3, last_read_at = NOW()
                """,
                channel_id, user_id, latest["id"]
            )

    return {"success": True}


@router.get("/unread-counts", response_model=UnreadCountsResponse)
async def get_unread_counts(
    project_id: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    """Get unread message counts for channels"""
    user_id = user["id"]
    user_role = None

    if project_id:
        user_role = await get_user_backlot_role(project_id, user_id)

    channels = await execute_query(
        """
        SELECT c.id as channel_id, c.name as channel_name,
               COALESCE(get_coms_unread_count(c.id, $2), 0) as unread_count
        FROM coms_channels c
        WHERE ($1::uuid IS NULL OR c.project_id = $1)
          AND c.archived_at IS NULL
          AND (
              array_length(c.visible_to_roles, 1) IS NULL
              OR array_length(c.visible_to_roles, 1) = 0
              OR $3 = ANY(c.visible_to_roles)
              OR EXISTS (SELECT 1 FROM coms_channel_members WHERE channel_id = c.id AND user_id = $2)
          )
        """,
        project_id, user_id, user_role
    )

    total = sum(c["unread_count"] for c in channels)

    return {
        "total_unread": total,
        "channels": [c for c in channels if c["unread_count"] > 0]
    }


# ============================================================================
# TEMPLATES
# ============================================================================

@router.get("/templates", response_model=List[ChannelTemplate])
async def list_channel_templates():
    """List available channel templates"""
    templates = await execute_query(
        """
        SELECT * FROM coms_channel_templates
        WHERE is_active = TRUE
        ORDER BY sort_order
        """
    )
    return templates


@router.post("/projects/{project_id}/apply-templates", response_model=ApplyTemplatesResponse)
async def apply_templates_to_project(
    project_id: str,
    request: ApplyTemplatesRequest,
    user=Depends(get_current_user)
):
    """Apply production channel templates to a project"""
    user_id = user["id"]

    if not await is_project_admin(project_id, user_id):
        raise HTTPException(status_code=403, detail="Not authorized")

    created_channels = []
    skipped_templates = []

    for template_key in request.template_keys:
        # Get template
        template = await execute_single(
            "SELECT * FROM coms_channel_templates WHERE template_key = $1 AND is_active = TRUE",
            template_key
        )
        if not template:
            skipped_templates.append(template_key)
            continue

        # Check if already exists
        existing = await execute_single(
            "SELECT id FROM coms_channels WHERE project_id = $1 AND template_key = $2 AND archived_at IS NULL",
            project_id, template_key
        )
        if existing:
            skipped_templates.append(template_key)
            continue

        # Create channel from template
        channel = await execute_single(
            """
            INSERT INTO coms_channels (
                name, description, channel_type, scope, project_id,
                icon, color, template_key, is_system_channel,
                visible_to_roles, can_transmit_roles, created_by, sort_order
            ) VALUES ($1, $2, $3, 'project', $4, $5, $6, $7, TRUE, $8, $9, $10, $11)
            RETURNING *
            """,
            template["name"],
            template["description"],
            template["channel_type"],
            project_id,
            template["icon"],
            template["color"],
            template_key,
            template["default_visible_to_roles"],
            template["default_can_transmit_roles"],
            user_id,
            template["sort_order"]
        )

        created_channels.append({**channel, "unread_count": 0, "member_count": 0})

    return {
        "created_channels": created_channels,
        "skipped_templates": skipped_templates
    }
