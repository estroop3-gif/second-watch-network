"""
DM Adapter API - Unified interface for legacy DMs and Coms DM channels
Provides backwards-compatible API while supporting both messaging systems
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_client
from app.core.websocket_client import broadcast_to_dm
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class UnifiedConversation(BaseModel):
    id: str
    source: str  # 'legacy' or 'coms'
    participant_ids: List[str]
    last_message: Optional[str]
    last_message_at: Optional[datetime]
    created_at: datetime
    coms_channel_id: Optional[str]
    unread_count: int
    other_participant: dict


class UnifiedMessage(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    content: str
    created_at: datetime
    is_read: bool
    source: str
    sender: Optional[dict] = None


class SendMessageRequest(BaseModel):
    recipient_id: Optional[str] = None
    conversation_id: Optional[str] = None
    content: str


class CreateGroupDMRequest(BaseModel):
    participant_ids: List[str]  # List of user IDs to include (not including creator)
    name: Optional[str] = None  # Optional group name


class GroupDMResponse(BaseModel):
    id: str
    name: Optional[str]
    participant_ids: List[str]
    participants: List[dict]
    created_at: datetime
    source: str = "coms"


@router.get("/unified/conversations", response_model=List[UnifiedConversation])
async def list_unified_conversations(user_id: str):
    """
    List all DM conversations for a user from both legacy and Coms systems.
    Returns a unified list sorted by last message time.
    """
    try:
        client = get_client()

        # Call the unified conversations function
        response = client.rpc("get_unified_conversations", {"p_user_id": user_id}).execute()

        if not response.data:
            return []

        # Transform to response format
        conversations = []
        for row in response.data:
            conversations.append(UnifiedConversation(
                id=row["id"],
                source=row["source"],
                participant_ids=row["participant_ids"],
                last_message=row["last_message"],
                last_message_at=row["last_message_at"],
                created_at=row["created_at"],
                coms_channel_id=row.get("coms_channel_id"),
                unread_count=row["unread_count"] or 0,
                other_participant={
                    "id": row["other_user_id"],
                    "username": row["other_username"],
                    "full_name": row["other_full_name"],
                    "avatar_url": row["other_avatar_url"],
                }
            ))

        return conversations

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/unified/conversations/{conversation_id}/messages", response_model=List[UnifiedMessage])
async def list_unified_messages(conversation_id: str, skip: int = 0, limit: int = 100):
    """
    List messages in a conversation, works with both legacy and Coms systems.
    """
    try:
        client = get_client()
        messages = []

        # Try legacy system first
        legacy_response = client.table("messages").select(
            "id, conversation_id, sender_id, content, created_at, is_read"
        ).eq("conversation_id", conversation_id).order("created_at").range(skip, skip + limit - 1).execute()

        if legacy_response.data:
            # Get sender profiles
            sender_ids = list(set(m["sender_id"] for m in legacy_response.data))
            profiles_response = client.table("profiles").select(
                "id, username, full_name, avatar_url"
            ).in_("id", sender_ids).execute()

            profiles_map = {p["id"]: p for p in (profiles_response.data or [])}

            for msg in legacy_response.data:
                messages.append(UnifiedMessage(
                    id=msg["id"],
                    conversation_id=msg["conversation_id"],
                    sender_id=msg["sender_id"],
                    content=msg["content"],
                    created_at=msg["created_at"],
                    is_read=msg["is_read"],
                    source="legacy",
                    sender=profiles_map.get(msg["sender_id"])
                ))
            return messages

        # Try Coms system
        coms_response = client.table("coms_messages").select(
            "id, channel_id, sender_id, content, created_at, is_deleted"
        ).eq("channel_id", conversation_id).eq("is_deleted", False).order("created_at").range(skip, skip + limit - 1).execute()

        if coms_response.data:
            # Get sender profiles
            sender_ids = list(set(m["sender_id"] for m in coms_response.data))
            profiles_response = client.table("profiles").select(
                "id, username, full_name, avatar_url"
            ).in_("id", sender_ids).execute()

            profiles_map = {p["id"]: p for p in (profiles_response.data or [])}

            for msg in coms_response.data:
                messages.append(UnifiedMessage(
                    id=msg["id"],
                    conversation_id=msg["channel_id"],
                    sender_id=msg["sender_id"],
                    content=msg["content"],
                    created_at=msg["created_at"],
                    is_read=True,  # Coms uses read receipts differently
                    source="coms",
                    sender=profiles_map.get(msg["sender_id"])
                ))

        return messages

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unified/messages")
async def send_unified_message(request: SendMessageRequest, sender_id: str):
    """
    Send a message using the unified system.
    Automatically routes to the correct messaging system.
    """
    try:
        client = get_client()

        if not request.conversation_id and not request.recipient_id:
            raise HTTPException(status_code=400, detail="Either conversation_id or recipient_id is required")

        # Use the unified send function
        response = client.rpc("send_unified_message", {
            "p_sender_id": sender_id,
            "p_recipient_id": request.recipient_id,
            "p_content": request.content,
            "p_conversation_id": request.conversation_id
        }).execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to send message")

        result = response.data[0]
        message_id = result["message_id"]
        conversation_id = result["conversation_id"]
        source = result["source"]

        # Get sender profile for broadcast
        sender_profile = None
        try:
            profile_resp = client.table("profiles").select(
                "id, username, full_name, avatar_url"
            ).eq("id", sender_id).single().execute()
            sender_profile = profile_resp.data
        except:
            pass

        # Broadcast via WebSocket
        broadcast_to_dm(
            conversation_id=conversation_id,
            message={
                "event": "dm_new_message",
                "conversation_id": conversation_id,
                "message": {
                    "id": message_id,
                    "conversation_id": conversation_id,
                    "sender_id": sender_id,
                    "content": request.content,
                    "created_at": datetime.utcnow().isoformat(),
                    "is_read": False,
                    "source": source,
                    "sender": sender_profile
                }
            },
            exclude_user_id=sender_id
        )

        # Evaluate folder rules for the recipient (auto-assign conversation to folder)
        # This runs for the recipient, not the sender
        if request.recipient_id:
            try:
                from app.api.message_folders import evaluate_and_assign_folder
                await evaluate_and_assign_folder(
                    user_id=request.recipient_id,
                    partner_id=sender_id,
                    message_content=request.content,
                    context_type=None  # Could be enhanced to pass context_type
                )
            except Exception as e:
                logger.warning(f"Failed to evaluate folder rules: {e}")
                # Don't fail the message send if rule evaluation fails

        return {
            "id": message_id,
            "conversation_id": conversation_id,
            "source": source,
            "content": request.content,
            "sender_id": sender_id
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unified/conversations/{conversation_id}/mark-read")
async def mark_unified_conversation_read(conversation_id: str, user_id: str):
    """
    Mark a conversation as read in the appropriate system.
    """
    try:
        client = get_client()

        # Try legacy system first
        legacy_check = client.table("conversations").select("id").eq("id", conversation_id).execute()

        if legacy_check.data and len(legacy_check.data) > 0:
            # Legacy system
            client.table("messages").update({"is_read": True}).eq(
                "conversation_id", conversation_id
            ).neq("sender_id", user_id).eq("is_read", False).execute()

            # Broadcast read receipt
            broadcast_to_dm(
                conversation_id=conversation_id,
                message={
                    "event": "dm_read",
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "read_at": datetime.utcnow().isoformat()
                },
                exclude_user_id=user_id
            )

            return {"message": "Messages marked as read", "source": "legacy"}

        # Try Coms system
        coms_check = client.table("coms_channels").select("id").eq("id", conversation_id).execute()

        if coms_check.data and len(coms_check.data) > 0:
            # Get the latest message ID
            latest_msg = client.table("coms_messages").select("id, created_at").eq(
                "channel_id", conversation_id
            ).eq("is_deleted", False).order("created_at", desc=True).limit(1).execute()

            if latest_msg.data and len(latest_msg.data) > 0:
                # Upsert read receipt
                client.table("coms_read_receipts").upsert({
                    "channel_id": conversation_id,
                    "user_id": user_id,
                    "last_read_message_id": latest_msg.data[0]["id"],
                    "last_read_at": datetime.utcnow().isoformat()
                }, on_conflict="channel_id,user_id").execute()

            # Broadcast read receipt
            broadcast_to_dm(
                conversation_id=conversation_id,
                message={
                    "event": "dm_read",
                    "conversation_id": conversation_id,
                    "user_id": user_id,
                    "read_at": datetime.utcnow().isoformat()
                },
                exclude_user_id=user_id
            )

            return {"message": "Messages marked as read", "source": "coms"}

        raise HTTPException(status_code=404, detail="Conversation not found")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unified/conversations/create")
async def create_unified_conversation(user_id: str, other_user_id: str):
    """
    Create or get a DM conversation. Uses Coms system for new conversations.
    """
    try:
        client = get_client()

        # First check if legacy conversation exists
        legacy_response = client.rpc("get_or_create_conversation", {
            "user1_id": user_id,
            "user2_id": other_user_id
        }).execute()

        if legacy_response.data and len(legacy_response.data) > 0:
            return {
                "conversation_id": legacy_response.data[0]["id"],
                "source": "legacy"
            }

        # Create in Coms system
        coms_response = client.rpc("get_or_create_dm_channel", {
            "user1_id": user_id,
            "user2_id": other_user_id
        }).execute()

        if coms_response.data:
            return {
                "conversation_id": coms_response.data,
                "source": "coms"
            }

        raise HTTPException(status_code=500, detail="Failed to create conversation")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# GROUP DM ENDPOINTS
# ============================================================================

@router.post("/group-dm", response_model=GroupDMResponse)
async def create_group_dm(request: CreateGroupDMRequest, user_id: str):
    """
    Create a group DM with multiple participants.
    Uses the Coms system with channel_type='group_chat'.
    """
    try:
        client = get_client()

        if len(request.participant_ids) < 2:
            raise HTTPException(
                status_code=400,
                detail="Group DM requires at least 2 other participants"
            )

        # Add creator to participant list
        all_participants = list(set([user_id] + request.participant_ids))

        # Generate a default name if none provided
        name = request.name
        if not name:
            # Get usernames for default name
            profiles_resp = client.table("profiles").select(
                "id, username, full_name"
            ).in_("id", request.participant_ids[:3]).execute()

            if profiles_resp.data:
                names = [
                    p.get("full_name") or p.get("username") or "User"
                    for p in profiles_resp.data
                ]
                name = ", ".join(names[:3])
                if len(request.participant_ids) > 3:
                    name += f" +{len(request.participant_ids) - 3}"

        # Create the group DM channel
        channel_resp = client.table("coms_channels").insert({
            "name": name,
            "channel_type": "group_chat",
            "scope": "global",
            "is_private": True,
            "is_system_channel": False,
            "created_by": user_id,
        }).execute()

        if not channel_resp.data or len(channel_resp.data) == 0:
            raise HTTPException(status_code=500, detail="Failed to create group DM")

        channel = channel_resp.data[0]
        channel_id = channel["id"]

        # Add all participants as members
        members_data = [
            {
                "channel_id": channel_id,
                "user_id": pid,
                "role": "admin" if pid == user_id else "member",
                "can_transmit": True,
            }
            for pid in all_participants
        ]
        client.table("coms_channel_members").insert(members_data).execute()

        # Get participant profiles
        profiles_resp = client.table("profiles").select(
            "id, username, full_name, avatar_url"
        ).in_("id", all_participants).execute()

        participants = profiles_resp.data if profiles_resp.data else []

        return GroupDMResponse(
            id=channel_id,
            name=name,
            participant_ids=all_participants,
            participants=participants,
            created_at=channel["created_at"],
            source="coms"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/group-dm", response_model=List[dict])
async def list_group_dms(user_id: str):
    """
    List all group DMs the user is a member of.
    """
    try:
        client = get_client()

        # Get group DM channels where user is a member
        channels_resp = client.table("coms_channels").select(
            """
            *,
            coms_channel_members!inner(user_id)
            """
        ).eq("channel_type", "group_chat").eq(
            "coms_channel_members.user_id", user_id
        ).is_("archived_at", "null").order("updated_at", desc=True).execute()

        if not channels_resp.data:
            return []

        result = []
        for channel in channels_resp.data:
            channel_id = channel["id"]

            # Get all members
            members_resp = client.table("coms_channel_members").select(
                "user_id, role, profiles(id, username, full_name, avatar_url)"
            ).eq("channel_id", channel_id).execute()

            members = members_resp.data if members_resp.data else []

            # Get last message
            last_msg_resp = client.table("coms_messages").select(
                "id, content, created_at, sender_id"
            ).eq("channel_id", channel_id).eq(
                "is_deleted", False
            ).order("created_at", desc=True).limit(1).execute()

            last_message = last_msg_resp.data[0] if last_msg_resp.data else None

            # Get unread count
            last_read_resp = client.table("coms_read_receipts").select(
                "last_read_at"
            ).eq("channel_id", channel_id).eq("user_id", user_id).execute()

            unread_count = 0
            if last_read_resp.data and last_read_resp.data[0].get("last_read_at"):
                last_read_at = last_read_resp.data[0]["last_read_at"]
                unread_resp = client.table("coms_messages").select(
                    "id", count="exact"
                ).eq("channel_id", channel_id).eq(
                    "is_deleted", False
                ).neq("sender_id", user_id).gt("created_at", last_read_at).execute()
                unread_count = unread_resp.count or 0
            else:
                # No read receipt - all messages are unread
                unread_resp = client.table("coms_messages").select(
                    "id", count="exact"
                ).eq("channel_id", channel_id).eq(
                    "is_deleted", False
                ).neq("sender_id", user_id).execute()
                unread_count = unread_resp.count or 0

            result.append({
                "id": channel_id,
                "name": channel.get("name"),
                "participant_ids": [m["user_id"] for m in members],
                "participants": [
                    m.get("profiles", {}) for m in members if m.get("profiles")
                ],
                "last_message": last_message,
                "last_message_at": last_message["created_at"] if last_message else None,
                "unread_count": unread_count,
                "created_at": channel["created_at"],
                "source": "coms"
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/group-dm/{channel_id}/members")
async def add_group_dm_member(channel_id: str, member_user_id: str, user_id: str):
    """
    Add a member to a group DM.
    """
    try:
        client = get_client()

        # Verify channel exists and is a group DM
        channel_resp = client.table("coms_channels").select("*").eq(
            "id", channel_id
        ).eq("channel_type", "group_chat").execute()

        if not channel_resp.data:
            raise HTTPException(status_code=404, detail="Group DM not found")

        # Verify user is a member
        member_check = client.table("coms_channel_members").select("role").eq(
            "channel_id", channel_id
        ).eq("user_id", user_id).execute()

        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        # Check if new member already exists
        existing = client.table("coms_channel_members").select("id").eq(
            "channel_id", channel_id
        ).eq("user_id", member_user_id).execute()

        if existing.data:
            raise HTTPException(status_code=400, detail="User is already a member")

        # Add new member
        client.table("coms_channel_members").insert({
            "channel_id": channel_id,
            "user_id": member_user_id,
            "role": "member",
            "can_transmit": True,
        }).execute()

        return {"success": True, "message": "Member added"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/group-dm/{channel_id}/members/{member_user_id}")
async def remove_group_dm_member(channel_id: str, member_user_id: str, user_id: str):
    """
    Remove a member from a group DM (or leave if removing self).
    """
    try:
        client = get_client()

        # Verify channel exists and is a group DM
        channel_resp = client.table("coms_channels").select("*").eq(
            "id", channel_id
        ).eq("channel_type", "group_chat").execute()

        if not channel_resp.data:
            raise HTTPException(status_code=404, detail="Group DM not found")

        # Verify user is a member (admin can remove others, anyone can remove self)
        member_check = client.table("coms_channel_members").select("role").eq(
            "channel_id", channel_id
        ).eq("user_id", user_id).execute()

        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        is_admin = member_check.data[0].get("role") == "admin"
        is_self = member_user_id == user_id

        if not is_admin and not is_self:
            raise HTTPException(status_code=403, detail="Only admins can remove other members")

        # Remove member
        client.table("coms_channel_members").delete().eq(
            "channel_id", channel_id
        ).eq("user_id", member_user_id).execute()

        # Check if group is now empty
        remaining = client.table("coms_channel_members").select(
            "id", count="exact"
        ).eq("channel_id", channel_id).execute()

        if remaining.count == 0:
            # Archive the channel
            client.table("coms_channels").update({
                "archived_at": datetime.utcnow().isoformat()
            }).eq("id", channel_id).execute()

        return {"success": True, "message": "Member removed"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/group-dm/{channel_id}")
async def update_group_dm(channel_id: str, name: Optional[str] = None, user_id: str = ""):
    """
    Update group DM settings (name).
    """
    try:
        client = get_client()

        # Verify channel exists and user is a member
        member_check = client.table("coms_channel_members").select("role").eq(
            "channel_id", channel_id
        ).eq("user_id", user_id).execute()

        if not member_check.data:
            raise HTTPException(status_code=403, detail="Not a member of this group")

        update_data = {"updated_at": datetime.utcnow().isoformat()}
        if name is not None:
            update_data["name"] = name

        client.table("coms_channels").update(update_data).eq("id", channel_id).execute()

        return {"success": True, "message": "Group updated"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
