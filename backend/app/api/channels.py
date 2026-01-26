"""
Message Channels API Routes
Group chat channels for Order, Green Room, Gear/Set teams
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
from app.core.database import get_client, execute_query
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class ChannelCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    channel_type: str  # 'order', 'greenroom', 'gear_team', 'set_team', 'project'
    context_id: Optional[str] = None
    is_private: bool = False


class ChannelMessage(BaseModel):
    content: str
    reply_to_id: Optional[str] = None


class Channel(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str]
    channel_type: str
    context_id: Optional[str]
    is_private: bool
    is_default: bool
    member_count: int
    unread_count: int


class ChannelMessageResponse(BaseModel):
    id: str
    channel_id: str
    sender_id: str
    sender: dict
    content: str
    created_at: str
    is_pinned: bool
    reply_to_id: Optional[str]


# ============================================================================
# CHANNEL CRUD
# ============================================================================

@router.get("/", response_model=List[Channel])
async def list_channels(
    user_id: str,
    channel_type: Optional[str] = None,
    context_id: Optional[str] = None
):
    """List channels the user is a member of."""
    try:
        client = get_client()

        # Get channels user is a member of
        query = client.table("message_channel_members").select(
            "channel_id"
        ).eq("user_id", user_id)

        member_response = query.execute()
        channel_ids = [m["channel_id"] for m in (member_response.data or [])]

        if not channel_ids:
            return []

        # Get channel details
        channels_query = client.table("message_channels").select("*").in_("id", channel_ids)

        if channel_type:
            channels_query = channels_query.eq("channel_type", channel_type)
        if context_id:
            channels_query = channels_query.eq("context_id", context_id)

        channels_response = channels_query.execute()
        channels = channels_response.data or []

        # Get member counts and unread counts
        result = []
        for channel in channels:
            # Member count
            member_count_resp = client.table("message_channel_members").select(
                "id", count="exact"
            ).eq("channel_id", channel["id"]).execute()

            # Unread count
            read_resp = client.table("message_channel_reads").select(
                "last_read_at"
            ).eq("channel_id", channel["id"]).eq("user_id", user_id).execute()

            last_read_at = None
            if read_resp.data:
                last_read_at = read_resp.data[0].get("last_read_at")

            unread_query = client.table("message_channel_messages").select(
                "id", count="exact"
            ).eq("channel_id", channel["id"])

            if last_read_at:
                unread_query = unread_query.gt("created_at", last_read_at)

            unread_resp = unread_query.execute()

            result.append(Channel(
                id=channel["id"],
                name=channel["name"],
                slug=channel["slug"],
                description=channel.get("description"),
                channel_type=channel["channel_type"],
                context_id=channel.get("context_id"),
                is_private=channel.get("is_private", False),
                is_default=channel.get("is_default", False),
                member_count=member_count_resp.count or 0,
                unread_count=unread_resp.count or 0,
            ))

        return result

    except Exception as e:
        logger.error(f"Error listing channels: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Channel)
async def create_channel(channel: ChannelCreate, user_id: str):
    """Create a new channel."""
    try:
        client = get_client()

        # Create channel
        response = client.table("message_channels").insert({
            "name": channel.name,
            "slug": channel.slug,
            "description": channel.description,
            "channel_type": channel.channel_type,
            "context_id": channel.context_id,
            "is_private": channel.is_private,
            "created_by": user_id,
        }).execute()

        new_channel = response.data[0]

        # Add creator as admin
        client.table("message_channel_members").insert({
            "channel_id": new_channel["id"],
            "user_id": user_id,
            "role": "admin",
        }).execute()

        return Channel(
            id=new_channel["id"],
            name=new_channel["name"],
            slug=new_channel["slug"],
            description=new_channel.get("description"),
            channel_type=new_channel["channel_type"],
            context_id=new_channel.get("context_id"),
            is_private=new_channel.get("is_private", False),
            is_default=new_channel.get("is_default", False),
            member_count=1,
            unread_count=0,
        )

    except Exception as e:
        logger.error(f"Error creating channel: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{channel_id}")
async def get_channel(channel_id: str, user_id: str):
    """Get channel details."""
    try:
        client = get_client()

        # Verify membership
        member_check = client.table("message_channel_members").select(
            "id"
        ).eq("channel_id", channel_id).eq("user_id", user_id).execute()

        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member of this channel")

        # Get channel
        response = client.table("message_channels").select("*").eq("id", channel_id).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Channel not found")

        return response.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting channel: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# CHANNEL MESSAGES
# ============================================================================

@router.get("/{channel_id}/messages", response_model=List[ChannelMessageResponse])
async def list_channel_messages(
    channel_id: str,
    user_id: str,
    skip: int = 0,
    limit: int = 50
):
    """List messages in a channel."""
    try:
        client = get_client()

        # Verify membership
        member_check = client.table("message_channel_members").select(
            "id"
        ).eq("channel_id", channel_id).eq("user_id", user_id).execute()

        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member of this channel")

        # Get messages with sender info
        response = client.table("message_channel_messages").select(
            "*, sender:profiles!sender_id(id, username, full_name, display_name, avatar_url)"
        ).eq("channel_id", channel_id).order(
            "created_at", desc=True
        ).range(skip, skip + limit - 1).execute()

        messages = response.data or []

        # Reverse to get chronological order
        messages.reverse()

        return [
            ChannelMessageResponse(
                id=m["id"],
                channel_id=m["channel_id"],
                sender_id=m["sender_id"],
                sender=m.get("sender") or {},
                content=m["content"],
                created_at=m["created_at"],
                is_pinned=m.get("is_pinned", False),
                reply_to_id=m.get("reply_to_id"),
            )
            for m in messages
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing channel messages: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{channel_id}/messages", response_model=ChannelMessageResponse)
async def send_channel_message(channel_id: str, message: ChannelMessage, user_id: str):
    """Send a message to a channel."""
    try:
        client = get_client()

        # Verify membership
        member_check = client.table("message_channel_members").select(
            "id"
        ).eq("channel_id", channel_id).eq("user_id", user_id).execute()

        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member of this channel")

        # Send message
        response = client.table("message_channel_messages").insert({
            "channel_id": channel_id,
            "sender_id": user_id,
            "content": message.content,
            "reply_to_id": message.reply_to_id,
        }).execute()

        new_message = response.data[0]

        # Get sender info
        sender_resp = client.table("profiles").select(
            "id, username, full_name, display_name, avatar_url"
        ).eq("id", user_id).single().execute()

        return ChannelMessageResponse(
            id=new_message["id"],
            channel_id=new_message["channel_id"],
            sender_id=new_message["sender_id"],
            sender=sender_resp.data or {},
            content=new_message["content"],
            created_at=new_message["created_at"],
            is_pinned=new_message.get("is_pinned", False),
            reply_to_id=new_message.get("reply_to_id"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending channel message: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{channel_id}/mark-read")
async def mark_channel_read(channel_id: str, user_id: str):
    """Mark channel as read."""
    try:
        client = get_client()

        # Get latest message
        latest_msg = client.table("message_channel_messages").select(
            "id"
        ).eq("channel_id", channel_id).order(
            "created_at", desc=True
        ).limit(1).execute()

        latest_msg_id = latest_msg.data[0]["id"] if latest_msg.data else None

        # Upsert read status
        client.table("message_channel_reads").upsert({
            "channel_id": channel_id,
            "user_id": user_id,
            "last_read_at": datetime.now(timezone.utc).isoformat(),
            "last_read_message_id": latest_msg_id,
        }, on_conflict="channel_id,user_id").execute()

        return {"status": "ok"}

    except Exception as e:
        logger.error(f"Error marking channel read: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# CHANNEL MEMBERSHIP
# ============================================================================

@router.post("/{channel_id}/join")
async def join_channel(channel_id: str, user_id: str):
    """Join a channel."""
    try:
        client = get_client()

        # Check if channel exists and is not private
        channel = client.table("message_channels").select(
            "is_private"
        ).eq("id", channel_id).single().execute()

        if not channel.data:
            raise HTTPException(status_code=404, detail="Channel not found")

        if channel.data.get("is_private"):
            raise HTTPException(status_code=403, detail="Cannot join private channel")

        # Add member
        client.table("message_channel_members").upsert({
            "channel_id": channel_id,
            "user_id": user_id,
            "role": "member",
        }, on_conflict="channel_id,user_id").execute()

        return {"status": "joined"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining channel: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{channel_id}/leave")
async def leave_channel(channel_id: str, user_id: str):
    """Leave a channel."""
    try:
        client = get_client()

        client.table("message_channel_members").delete().eq(
            "channel_id", channel_id
        ).eq("user_id", user_id).execute()

        return {"status": "left"}

    except Exception as e:
        logger.error(f"Error leaving channel: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# FOLDER COUNTS
# ============================================================================

@router.get("/folders/counts")
async def get_folder_unread_counts(user_id: str):
    """Get unread counts for each message folder."""
    try:
        # Use raw SQL for the aggregation
        query = """
            SELECT
                COALESCE(context_type, 'personal') as folder,
                COUNT(*) FILTER (WHERE read_at IS NULL) as unread_count
            FROM backlot_direct_messages
            WHERE recipient_id = :user_id
            GROUP BY COALESCE(context_type, 'personal')
        """
        rows = execute_query(query, {"user_id": user_id})

        # Also get channel unread counts
        client = get_client()

        # Get user's channels
        channels_resp = client.table("message_channel_members").select(
            "channel_id"
        ).eq("user_id", user_id).execute()

        channel_unreads = {}
        for membership in (channels_resp.data or []):
            channel_id = membership["channel_id"]

            # Get channel type
            channel_resp = client.table("message_channels").select(
                "channel_type"
            ).eq("id", channel_id).single().execute()

            if not channel_resp.data:
                continue

            channel_type = channel_resp.data["channel_type"]

            # Get read timestamp
            read_resp = client.table("message_channel_reads").select(
                "last_read_at"
            ).eq("channel_id", channel_id).eq("user_id", user_id).execute()

            last_read_at = None
            if read_resp.data:
                last_read_at = read_resp.data[0].get("last_read_at")

            # Count unread
            unread_query = client.table("message_channel_messages").select(
                "id", count="exact"
            ).eq("channel_id", channel_id)

            if last_read_at:
                unread_query = unread_query.gt("created_at", last_read_at)

            unread_resp = unread_query.execute()
            unread = unread_resp.count or 0

            if channel_type not in channel_unreads:
                channel_unreads[channel_type] = 0
            channel_unreads[channel_type] += unread

        # Combine DM and channel counts
        folder_counts = {row["folder"]: row["unread_count"] for row in rows}

        # Map channel types to folders
        folder_mapping = {
            "order": "order",
            "greenroom": "greenroom",
            "gear_team": "gear",
            "set_team": "set",
            "project": "backlot",
        }

        for channel_type, unread in channel_unreads.items():
            folder = folder_mapping.get(channel_type, channel_type)
            if folder not in folder_counts:
                folder_counts[folder] = 0
            folder_counts[folder] += unread

        # Get custom folder counts
        custom_folder_query = """
            SELECT
                'custom:' || f.id::text as folder,
                f.name as folder_name,
                f.color,
                f.icon,
                COALESCE(v.unread_count, 0) as unread_count
            FROM user_message_folders f
            LEFT JOIN v_custom_folder_unread_counts v ON v.folder_id = f.id
            WHERE f.user_id = :user_id
            ORDER BY f.position ASC
        """
        custom_rows = execute_query(custom_folder_query, {"user_id": user_id})

        # Add custom folders to counts
        custom_folders = []
        for row in custom_rows:
            folder_key = row["folder"]
            folder_counts[folder_key] = row["unread_count"]
            custom_folders.append({
                "id": folder_key,
                "name": row["folder_name"],
                "color": row.get("color"),
                "icon": row.get("icon"),
                "unread_count": row["unread_count"],
            })

        # Calculate total (excluding custom folder counts from "all" to avoid double-counting)
        # Custom folders contain DMs that are already counted in system folders
        folder_counts["all"] = sum(
            count for key, count in folder_counts.items()
            if not key.startswith("custom:")
        )

        # Include custom folders metadata in response
        folder_counts["_custom_folders"] = custom_folders

        return folder_counts

    except Exception as e:
        logger.error(f"Error getting folder counts: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# AUTO-JOIN DEFAULT CHANNELS
# ============================================================================

@router.post("/auto-join/{channel_type}")
async def auto_join_default_channels(channel_type: str, user_id: str):
    """Auto-join user to default channels of a type (e.g., 'order')."""
    try:
        client = get_client()

        # Get default channels of this type
        channels = client.table("message_channels").select(
            "id"
        ).eq("channel_type", channel_type).eq("is_default", True).execute()

        joined = 0
        for channel in (channels.data or []):
            # Check if already a member
            existing = client.table("message_channel_members").select(
                "id"
            ).eq("channel_id", channel["id"]).eq("user_id", user_id).execute()

            if not existing.data:
                client.table("message_channel_members").insert({
                    "channel_id": channel["id"],
                    "user_id": user_id,
                    "role": "member",
                }).execute()
                joined += 1

        return {"status": "ok", "channels_joined": joined}

    except Exception as e:
        logger.error(f"Error auto-joining channels: {e}")
        raise HTTPException(status_code=400, detail=str(e))
