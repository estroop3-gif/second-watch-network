"""
Message Settings API Routes
User preferences, blocking, reporting, and muting
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
import logging
from app.core.database import get_client

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class MessagePreferences(BaseModel):
    who_can_message: str = "everyone"  # everyone, connections, nobody
    show_read_receipts: bool = True
    show_online_status: bool = True


class MessagePreferencesUpdate(BaseModel):
    who_can_message: Optional[str] = None
    show_read_receipts: Optional[bool] = None
    show_online_status: Optional[bool] = None


class BlockedUser(BaseModel):
    id: str
    user_id: str
    blocked_user_id: str
    blocked_user_name: Optional[str] = None
    blocked_user_avatar: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime


class BlockUserRequest(BaseModel):
    blocked_user_id: str
    reason: Optional[str] = None


class MessageReportCreate(BaseModel):
    message_id: str
    message_content: str
    message_sender_id: str
    conversation_id: Optional[str] = None
    reason: str  # spam, harassment, inappropriate, other
    description: Optional[str] = None


class MessageReport(BaseModel):
    id: str
    reporter_id: str
    message_id: str
    message_content: Optional[str] = None
    message_sender_id: str
    conversation_id: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: str
    reviewed_by: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolution_action: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MutedConversation(BaseModel):
    id: str
    user_id: str
    conversation_partner_id: Optional[str] = None
    conversation_partner_name: Optional[str] = None
    conversation_partner_avatar: Optional[str] = None
    channel_id: Optional[str] = None
    channel_name: Optional[str] = None
    muted_until: Optional[datetime] = None
    created_at: datetime


class MuteConversationRequest(BaseModel):
    conversation_partner_id: Optional[str] = None
    channel_id: Optional[str] = None
    duration_minutes: Optional[int] = None  # None = indefinite


# ============================================================================
# Preferences Endpoints
# ============================================================================

@router.get("/preferences", response_model=MessagePreferences)
async def get_message_preferences(user_id: str):
    """Get user's message preferences"""
    try:
        client = get_client()
        response = client.table("user_message_preferences").select("*").eq(
            "user_id", user_id
        ).execute()

        if response.data and len(response.data) > 0:
            prefs = response.data[0]
            return MessagePreferences(
                who_can_message=prefs.get("who_can_message", "everyone"),
                show_read_receipts=prefs.get("show_read_receipts", True),
                show_online_status=prefs.get("show_online_status", True),
            )

        # Return defaults if no preferences set
        return MessagePreferences()
    except Exception as e:
        logger.error(f"Error fetching message preferences: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/preferences", response_model=MessagePreferences)
async def update_message_preferences(
    user_id: str,
    preferences: MessagePreferencesUpdate
):
    """Update user's message preferences"""
    try:
        client = get_client()

        # Build update data excluding None values
        update_data = {}
        if preferences.who_can_message is not None:
            if preferences.who_can_message not in ["everyone", "connections", "nobody"]:
                raise HTTPException(
                    status_code=400,
                    detail="who_can_message must be 'everyone', 'connections', or 'nobody'"
                )
            update_data["who_can_message"] = preferences.who_can_message
        if preferences.show_read_receipts is not None:
            update_data["show_read_receipts"] = preferences.show_read_receipts
        if preferences.show_online_status is not None:
            update_data["show_online_status"] = preferences.show_online_status

        if not update_data:
            # Nothing to update, return current preferences
            return await get_message_preferences(user_id)

        # Upsert preferences
        update_data["user_id"] = user_id
        response = client.table("user_message_preferences").upsert(
            update_data,
            on_conflict="user_id"
        ).execute()

        if response.data and len(response.data) > 0:
            prefs = response.data[0]
            return MessagePreferences(
                who_can_message=prefs.get("who_can_message", "everyone"),
                show_read_receipts=prefs.get("show_read_receipts", True),
                show_online_status=prefs.get("show_online_status", True),
            )

        return await get_message_preferences(user_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message preferences: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Blocked Users Endpoints
# ============================================================================

@router.get("/blocked", response_model=List[BlockedUser])
async def list_blocked_users(user_id: str):
    """List all users blocked by the current user"""
    try:
        client = get_client()

        # Get blocked users with profile info
        response = client.table("user_blocked_users").select(
            "id, user_id, blocked_user_id, reason, created_at"
        ).eq("user_id", user_id).order("created_at", desc=True).execute()

        blocked_list = []
        for block in response.data or []:
            # Get blocked user's profile
            profile_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", block["blocked_user_id"]).single().execute()

            profile = profile_resp.data if profile_resp.data else {}
            blocked_list.append(BlockedUser(
                id=block["id"],
                user_id=block["user_id"],
                blocked_user_id=block["blocked_user_id"],
                blocked_user_name=profile.get("display_name") or profile.get("full_name"),
                blocked_user_avatar=profile.get("avatar_url"),
                reason=block.get("reason"),
                created_at=block["created_at"],
            ))

        return blocked_list
    except Exception as e:
        logger.error(f"Error listing blocked users: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/blocked", response_model=BlockedUser)
async def block_user(user_id: str, request: BlockUserRequest):
    """Block a user"""
    try:
        if user_id == request.blocked_user_id:
            raise HTTPException(status_code=400, detail="Cannot block yourself")

        client = get_client()

        # Check if already blocked
        existing = client.table("user_blocked_users").select("id").eq(
            "user_id", user_id
        ).eq("blocked_user_id", request.blocked_user_id).execute()

        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail="User is already blocked")

        # Create block record
        response = client.table("user_blocked_users").insert({
            "user_id": user_id,
            "blocked_user_id": request.blocked_user_id,
            "reason": request.reason,
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to block user")

        block = response.data[0]

        # Get blocked user's profile
        profile_resp = client.table("profiles").select(
            "full_name, display_name, avatar_url"
        ).eq("id", request.blocked_user_id).single().execute()

        profile = profile_resp.data if profile_resp.data else {}

        return BlockedUser(
            id=block["id"],
            user_id=block["user_id"],
            blocked_user_id=block["blocked_user_id"],
            blocked_user_name=profile.get("display_name") or profile.get("full_name"),
            blocked_user_avatar=profile.get("avatar_url"),
            reason=block.get("reason"),
            created_at=block["created_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking user: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/blocked/{blocked_user_id}")
async def unblock_user(user_id: str, blocked_user_id: str):
    """Unblock a user"""
    try:
        client = get_client()

        response = client.table("user_blocked_users").delete().eq(
            "user_id", user_id
        ).eq("blocked_user_id", blocked_user_id).execute()

        return {"message": "User unblocked successfully"}
    except Exception as e:
        logger.error(f"Error unblocking user: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/blocked/check/{other_user_id}")
async def check_block_status(user_id: str, other_user_id: str):
    """Check if there's a mutual block between two users"""
    try:
        client = get_client()

        # Check if current user blocked the other user
        blocked_by_me = client.table("user_blocked_users").select("id").eq(
            "user_id", user_id
        ).eq("blocked_user_id", other_user_id).execute()

        # Check if the other user blocked current user
        blocked_by_them = client.table("user_blocked_users").select("id").eq(
            "user_id", other_user_id
        ).eq("blocked_user_id", user_id).execute()

        return {
            "blocked_by_me": len(blocked_by_me.data or []) > 0,
            "blocked_by_them": len(blocked_by_them.data or []) > 0,
            "is_blocked": len(blocked_by_me.data or []) > 0 or len(blocked_by_them.data or []) > 0,
        }
    except Exception as e:
        logger.error(f"Error checking block status: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Message Reports Endpoints
# ============================================================================

@router.post("/report", response_model=MessageReport)
async def report_message(user_id: str, request: MessageReportCreate):
    """Report a message"""
    try:
        if request.reason not in ["spam", "harassment", "inappropriate", "other"]:
            raise HTTPException(
                status_code=400,
                detail="Reason must be 'spam', 'harassment', 'inappropriate', or 'other'"
            )

        client = get_client()

        # Check if already reported this message
        existing = client.table("message_reports").select("id").eq(
            "reporter_id", user_id
        ).eq("message_id", request.message_id).execute()

        if existing.data and len(existing.data) > 0:
            raise HTTPException(status_code=400, detail="You have already reported this message")

        # Create report
        response = client.table("message_reports").insert({
            "reporter_id": user_id,
            "message_id": request.message_id,
            "message_content": request.message_content,
            "message_sender_id": request.message_sender_id,
            "conversation_id": request.conversation_id,
            "reason": request.reason,
            "description": request.description,
            "status": "pending",
        }).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to create report")

        report = response.data[0]
        return MessageReport(**report)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reporting message: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/reports", response_model=List[MessageReport])
async def list_my_reports(user_id: str, skip: int = 0, limit: int = 50):
    """List reports submitted by the current user"""
    try:
        client = get_client()

        response = client.table("message_reports").select("*").eq(
            "reporter_id", user_id
        ).order("created_at", desc=True).range(skip, skip + limit - 1).execute()

        return [MessageReport(**r) for r in (response.data or [])]
    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Muted Conversations Endpoints
# ============================================================================

@router.get("/muted", response_model=List[MutedConversation])
async def list_muted_conversations(user_id: str):
    """List all muted conversations for the current user"""
    try:
        client = get_client()

        response = client.table("user_muted_conversations").select("*").eq(
            "user_id", user_id
        ).order("created_at", desc=True).execute()

        muted_list = []
        for mute in response.data or []:
            partner_name = None
            partner_avatar = None
            channel_name = None

            # Get conversation partner info if it's a DM
            if mute.get("conversation_partner_id"):
                profile_resp = client.table("profiles").select(
                    "full_name, display_name, avatar_url"
                ).eq("id", mute["conversation_partner_id"]).single().execute()

                if profile_resp.data:
                    partner_name = profile_resp.data.get("display_name") or profile_resp.data.get("full_name")
                    partner_avatar = profile_resp.data.get("avatar_url")

            # Get channel info if it's a channel
            if mute.get("channel_id"):
                channel_resp = client.table("message_channels").select(
                    "name"
                ).eq("id", mute["channel_id"]).single().execute()

                if channel_resp.data:
                    channel_name = channel_resp.data.get("name")

            muted_list.append(MutedConversation(
                id=mute["id"],
                user_id=mute["user_id"],
                conversation_partner_id=mute.get("conversation_partner_id"),
                conversation_partner_name=partner_name,
                conversation_partner_avatar=partner_avatar,
                channel_id=mute.get("channel_id"),
                channel_name=channel_name,
                muted_until=mute.get("muted_until"),
                created_at=mute["created_at"],
            ))

        return muted_list
    except Exception as e:
        logger.error(f"Error listing muted conversations: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/muted", response_model=MutedConversation)
async def mute_conversation(user_id: str, request: MuteConversationRequest):
    """Mute a conversation"""
    try:
        if not request.conversation_partner_id and not request.channel_id:
            raise HTTPException(
                status_code=400,
                detail="Either conversation_partner_id or channel_id is required"
            )

        client = get_client()

        # Calculate muted_until if duration provided
        muted_until = None
        if request.duration_minutes:
            muted_until = datetime.now(timezone.utc) + timedelta(minutes=request.duration_minutes)

        # Check if already muted
        query = client.table("user_muted_conversations").select("id").eq("user_id", user_id)

        if request.conversation_partner_id:
            query = query.eq("conversation_partner_id", request.conversation_partner_id)
        if request.channel_id:
            query = query.eq("channel_id", request.channel_id)

        existing = query.execute()

        if existing.data and len(existing.data) > 0:
            # Update existing mute
            update_data = {"muted_until": muted_until.isoformat() if muted_until else None}
            response = client.table("user_muted_conversations").update(
                update_data
            ).eq("id", existing.data[0]["id"]).execute()
        else:
            # Create new mute
            insert_data = {
                "user_id": user_id,
                "muted_until": muted_until.isoformat() if muted_until else None,
            }
            if request.conversation_partner_id:
                insert_data["conversation_partner_id"] = request.conversation_partner_id
            if request.channel_id:
                insert_data["channel_id"] = request.channel_id

            response = client.table("user_muted_conversations").insert(insert_data).execute()

        if not response.data:
            raise HTTPException(status_code=400, detail="Failed to mute conversation")

        mute = response.data[0]

        # Get additional info
        partner_name = None
        partner_avatar = None
        channel_name = None

        if mute.get("conversation_partner_id"):
            profile_resp = client.table("profiles").select(
                "full_name, display_name, avatar_url"
            ).eq("id", mute["conversation_partner_id"]).single().execute()

            if profile_resp.data:
                partner_name = profile_resp.data.get("display_name") or profile_resp.data.get("full_name")
                partner_avatar = profile_resp.data.get("avatar_url")

        if mute.get("channel_id"):
            channel_resp = client.table("message_channels").select(
                "name"
            ).eq("id", mute["channel_id"]).single().execute()

            if channel_resp.data:
                channel_name = channel_resp.data.get("name")

        return MutedConversation(
            id=mute["id"],
            user_id=mute["user_id"],
            conversation_partner_id=mute.get("conversation_partner_id"),
            conversation_partner_name=partner_name,
            conversation_partner_avatar=partner_avatar,
            channel_id=mute.get("channel_id"),
            channel_name=channel_name,
            muted_until=mute.get("muted_until"),
            created_at=mute["created_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error muting conversation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/muted/{mute_id}")
async def unmute_conversation(user_id: str, mute_id: str):
    """Unmute a conversation"""
    try:
        client = get_client()

        # Verify ownership and delete
        response = client.table("user_muted_conversations").delete().eq(
            "id", mute_id
        ).eq("user_id", user_id).execute()

        return {"message": "Conversation unmuted successfully"}
    except Exception as e:
        logger.error(f"Error unmuting conversation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/muted/check")
async def check_mute_status(
    user_id: str,
    conversation_partner_id: Optional[str] = None,
    channel_id: Optional[str] = None
):
    """Check if a conversation is muted"""
    try:
        if not conversation_partner_id and not channel_id:
            raise HTTPException(
                status_code=400,
                detail="Either conversation_partner_id or channel_id is required"
            )

        client = get_client()

        query = client.table("user_muted_conversations").select("id, muted_until").eq("user_id", user_id)

        if conversation_partner_id:
            query = query.eq("conversation_partner_id", conversation_partner_id)
        if channel_id:
            query = query.eq("channel_id", channel_id)

        response = query.execute()

        if not response.data or len(response.data) == 0:
            return {"is_muted": False, "muted_until": None}

        mute = response.data[0]
        muted_until = mute.get("muted_until")

        # Check if mute has expired
        if muted_until:
            muted_until_dt = datetime.fromisoformat(muted_until.replace("Z", "+00:00"))
            if muted_until_dt < datetime.now(timezone.utc):
                # Mute has expired, delete it
                client.table("user_muted_conversations").delete().eq("id", mute["id"]).execute()
                return {"is_muted": False, "muted_until": None}

        return {"is_muted": True, "muted_until": muted_until}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking mute status: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# Messaging Permission Check
# ============================================================================

@router.get("/can-message/{target_user_id}")
async def check_can_message(user_id: str, target_user_id: str):
    """Check if the current user can message the target user"""
    try:
        client = get_client()

        # Use the database function
        response = client.rpc("can_user_message", {
            "sender_id": user_id,
            "recipient_id": target_user_id
        }).execute()

        if response.data and len(response.data) > 0:
            result = response.data[0]
            return {
                "allowed": result.get("allowed", True),
                "reason": result.get("reason"),
            }

        # Default to allowed if no result
        return {"allowed": True, "reason": None}
    except Exception as e:
        logger.error(f"Error checking message permission: {e}")
        # Default to allowed on error to not block messages
        return {"allowed": True, "reason": None}
