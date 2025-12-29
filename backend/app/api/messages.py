"""
Messages & Conversations API Routes - Enhanced with WebSocket support
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timezone
import logging
from app.core.database import get_client
from app.core.websocket_client import broadcast_to_dm, send_to_user
from app.schemas.messages import Message, MessageCreate, Conversation

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/conversations", response_model=List[Conversation])
async def list_conversations(user_id: str):
    """List user's conversations"""
    try:
        client = get_client()
        
        # Call Supabase RPC function to get conversations
        response = client.rpc("get_user_conversations", {"user_id": user_id}).execute()
        
        return response.data if response.data else []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/conversations/{conversation_id}/messages", response_model=List[Message])
async def list_conversation_messages(conversation_id: str, skip: int = 0, limit: int = 100):
    """List messages in a conversation"""
    try:
        client = get_client()
        response = client.table("messages").select("*").eq(
            "conversation_id", conversation_id
        ).range(skip, skip + limit - 1).order("created_at").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Message)
async def send_message(message: MessageCreate, sender_id: str):
    """Send a new message with real-time WebSocket broadcast"""
    try:
        client = get_client()

        data = message.model_dump(exclude_unset=True)
        data["sender_id"] = sender_id

        # If no conversation_id, create or find conversation
        if not data.get("conversation_id") and data.get("recipient_id"):
            # Find existing conversation or create new one
            conv_response = client.rpc("get_or_create_conversation", {
                "user1_id": sender_id,
                "user2_id": data["recipient_id"]
            }).execute()

            if conv_response.data:
                data["conversation_id"] = conv_response.data[0]["id"]

        response = client.table("messages").insert(data).execute()
        new_message = response.data[0]

        # Get sender profile for the broadcast
        sender_profile = None
        try:
            profile_resp = client.table("profiles").select(
                "id, username, full_name, avatar_url"
            ).eq("id", sender_id).single().execute()
            sender_profile = profile_resp.data
        except Exception as e:
            logger.warning(f"Could not fetch sender profile: {e}")

        # Broadcast new message via WebSocket
        conversation_id = new_message.get("conversation_id")
        if conversation_id:
            broadcast_to_dm(
                conversation_id=conversation_id,
                message={
                    "event": "dm_new_message",
                    "conversation_id": conversation_id,
                    "message": {
                        **new_message,
                        "sender": sender_profile
                    }
                },
                exclude_user_id=sender_id  # Don't send back to sender
            )

        return new_message
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/mark-read")
async def mark_messages_read(message_ids: List[str]):
    """Mark messages as read"""
    try:
        client = get_client()
        client.table("messages").update({"is_read": True}).in_("id", message_ids).execute()
        return {"message": "Messages marked as read"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/unread-count")
async def get_unread_count(user_id: str):
    """Get unread message count"""
    try:
        client = get_client()

        # Get conversations where user is participant
        conversations = client.rpc("get_user_conversations", {"user_id": user_id}).execute()

        if not conversations.data:
            return {"count": 0}

        conversation_ids = [conv["id"] for conv in conversations.data]

        # Count unread messages
        unread = client.table("messages").select("id", count="exact").in_(
            "conversation_id", conversation_ids
        ).eq("is_read", False).neq("sender_id", user_id).execute()

        return {"count": unread.count or 0}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/conversations/create")
async def create_private_conversation(user_id: str, other_user_id: str):
    """Create or get existing private conversation between two users"""
    try:
        client = get_client()

        # Use get_or_create_conversation RPC (the one that exists)
        response = client.rpc("get_or_create_conversation", {
            "user1_id": user_id,
            "user2_id": other_user_id
        }).execute()

        if response.data and len(response.data) > 0:
            return {"conversation_id": response.data[0].get("id")}

        raise HTTPException(status_code=400, detail="Could not create or find conversation")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(conversation_id: str, user_id: str):
    """Mark all messages in a conversation as read for current user"""
    try:
        client = get_client()

        # Update all unread messages in the conversation that were NOT sent by the current user
        client.table("messages").update({"is_read": True}).eq(
            "conversation_id", conversation_id
        ).neq("sender_id", user_id).eq("is_read", False).execute()

        # Broadcast read receipt via WebSocket
        broadcast_to_dm(
            conversation_id=conversation_id,
            message={
                "event": "dm_read",
                "conversation_id": conversation_id,
                "user_id": user_id,
                "read_at": datetime.now(timezone.utc).isoformat()
            },
            exclude_user_id=user_id
        )

        return {"message": "Messages marked as read"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# =====================================================
# UNIFIED INBOX - DMs + Project Updates
# =====================================================

@router.get("/inbox")
async def get_unified_inbox(user_id: str):
    """
    Get unified inbox with DMs and project updates mixed together.
    Returns items sorted by last_message_at descending.
    """
    try:
        client = get_client()
        inbox_items = []

        # 1. Get DM conversations
        dm_response = client.rpc("get_user_conversations", {"user_id": user_id}).execute()
        dm_conversations = dm_response.data or []

        for conv in dm_conversations:
            inbox_items.append({
                "id": conv.get("id"),
                "type": "dm",
                "project_id": None,
                "project_title": None,
                "project_thumbnail": None,
                "other_participant": conv.get("other_participant"),
                "last_message": conv.get("last_message", {}).get("content") if conv.get("last_message") else None,
                "last_message_at": conv.get("last_message_at"),
                "update_type": None,
                "unread_count": conv.get("unread_count", 0),
            })

        # 2. Get user's projects (owner or member)
        # First get projects they own
        owned_response = client.table("backlot_projects").select(
            "id, title, thumbnail_url"
        ).eq("owner_id", user_id).execute()
        owned_projects = owned_response.data or []

        # Get projects they're a member of
        member_response = client.table("backlot_project_members").select(
            "project:backlot_projects(id, title, thumbnail_url)"
        ).eq("user_id", user_id).execute()
        member_projects = [m.get("project") for m in (member_response.data or []) if m.get("project")]

        # Combine and deduplicate
        all_projects = {p["id"]: p for p in owned_projects}
        for p in member_projects:
            if p and p.get("id") not in all_projects:
                all_projects[p["id"]] = p

        # 3. For each project, get latest update and unread count
        for project_id, project in all_projects.items():
            # Get latest update
            latest_update_response = client.table("backlot_project_updates").select(
                "id, title, type, created_at"
            ).eq("project_id", project_id).order(
                "created_at", desc=True
            ).limit(1).execute()

            latest_update = latest_update_response.data[0] if latest_update_response.data else None

            if not latest_update:
                # No updates yet, skip this project in inbox
                continue

            # Count unread updates for this project
            all_updates_response = client.table("backlot_project_updates").select(
                "id"
            ).eq("project_id", project_id).execute()
            all_update_ids = [u["id"] for u in (all_updates_response.data or [])]

            read_response = client.table("backlot_project_update_reads").select(
                "update_id"
            ).eq("user_id", user_id).in_("update_id", all_update_ids).execute()
            read_ids = {r["update_id"] for r in (read_response.data or [])}

            unread_count = len([uid for uid in all_update_ids if uid not in read_ids])

            inbox_items.append({
                "id": project_id,
                "type": "project",
                "project_id": project_id,
                "project_title": project.get("title"),
                "project_thumbnail": project.get("thumbnail_url"),
                "other_participant": None,
                "last_message": latest_update.get("title"),
                "last_message_at": latest_update.get("created_at"),
                "update_type": latest_update.get("type"),
                "unread_count": unread_count,
            })

        # 4. Sort by last_message_at descending
        inbox_items.sort(
            key=lambda x: x.get("last_message_at") or "",
            reverse=True
        )

        return inbox_items

    except Exception as e:
        logger.error(f"Error fetching unified inbox: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/inbox/project/{project_id}/updates")
async def get_project_inbox_updates(
    project_id: str,
    user_id: str,
    skip: int = 0,
    limit: int = 50
):
    """
    Get project updates for inbox detail view with read status.
    Returns updates with author info and read status.
    """
    try:
        client = get_client()

        # Verify user has access to project (owner or member)
        owned = client.table("backlot_projects").select("id").eq(
            "id", project_id
        ).eq("owner_id", user_id).execute()

        if not owned.data:
            member = client.table("backlot_project_members").select("id").eq(
                "project_id", project_id
            ).eq("user_id", user_id).execute()

            if not member.data:
                raise HTTPException(status_code=403, detail="Access denied to this project")

        # Fetch updates with author info
        updates_response = client.table("backlot_project_updates").select(
            "*, author:profiles!created_by(id, full_name, display_name, username, avatar_url)"
        ).eq("project_id", project_id).order(
            "created_at", desc=True
        ).range(skip, skip + limit - 1).execute()

        updates = updates_response.data or []

        # Get read status for these updates
        update_ids = [u["id"] for u in updates]
        reads_response = client.table("backlot_project_update_reads").select(
            "update_id, read_at"
        ).eq("user_id", user_id).in_("update_id", update_ids).execute()

        read_map = {r["update_id"]: r["read_at"] for r in (reads_response.data or [])}

        # Merge read status into updates
        for update in updates:
            update["has_read"] = update["id"] in read_map
            update["read_at"] = read_map.get(update["id"])

        return updates

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching project updates: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/inbox/project/{project_id}/updates/{update_id}/mark-read")
async def mark_project_update_read(project_id: str, update_id: str, user_id: str):
    """Mark a single project update as read"""
    try:
        client = get_client()

        # Upsert read record
        client.table("backlot_project_update_reads").upsert({
            "update_id": update_id,
            "user_id": user_id,
            "read_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="update_id,user_id").execute()

        return {"message": "Update marked as read"}

    except Exception as e:
        logger.error(f"Error marking update as read: {e}")
        raise HTTPException(status_code=400, detail=str(e))
