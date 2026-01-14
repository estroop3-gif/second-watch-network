"""
Organization Messaging API

Enables users to send messages to organizations (e.g., gear houses, studios)
Organizations can configure routing and respond to inquiries.
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.database import execute_query, execute_single, execute_insert, execute_update

router = APIRouter(prefix="/org-messages", tags=["Organization Messages"])


# ============================================================================
# SCHEMAS
# ============================================================================

class CreateConversationRequest(BaseModel):
    """Create a new conversation with an organization."""
    organization_id: str
    subject: Optional[str] = None
    initial_message: str
    context_type: str = "general"  # general, rental_order, quote, support, billing
    context_id: Optional[str] = None


class SendMessageRequest(BaseModel):
    """Send a message in a conversation."""
    content: str
    attachments: Optional[List[Dict[str, Any]]] = []
    is_internal: bool = False  # Only for org members


class UpdateSettingsRequest(BaseModel):
    """Update organization message settings."""
    routing_mode: str  # all_admins, specific_members, disabled
    routing_member_ids: Optional[List[str]] = []
    auto_reply_enabled: bool = False
    auto_reply_message: Optional[str] = None
    email_notifications: bool = True


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    """Extract profile ID from authenticated user."""
    if isinstance(user, dict):
        return user.get("user_id") or user.get("sub")
    return str(user)


def is_org_member(profile_id: str, organization_id: str) -> bool:
    """Check if user is a member of the organization."""
    result = execute_single(
        """
        SELECT 1 FROM organization_members
        WHERE user_id = :user_id
          AND organization_id = :org_id
          AND status = 'active'
        """,
        {"user_id": profile_id, "org_id": organization_id}
    )
    return result is not None


def get_routing_members(organization_id: str) -> List[str]:
    """Get list of member IDs who should receive messages for this organization."""
    settings = execute_single(
        "SELECT routing_mode, routing_member_ids FROM org_message_settings WHERE organization_id = :org_id",
        {"org_id": organization_id}
    )

    if not settings or settings["routing_mode"] == "disabled":
        return []

    if settings["routing_mode"] == "specific_members" and settings.get("routing_member_ids"):
        return settings["routing_member_ids"]

    # Default: all_admins
    admins = execute_query(
        """
        SELECT user_id FROM organization_members
        WHERE organization_id = :org_id
          AND role IN ('owner', 'admin')
          AND status = 'active'
        """,
        {"org_id": organization_id}
    )
    return [admin["user_id"] for admin in admins]


# ============================================================================
# CONVERSATION ENDPOINTS
# ============================================================================

@router.post("/conversations")
async def create_conversation(
    request: CreateConversationRequest,
    user=Depends(get_current_user)
):
    """
    Create a new conversation with an organization and send initial message.

    If a conversation already exists for this user/org/context, returns existing conversation.
    """
    profile_id = get_profile_id(user)

    # Verify organization exists
    org = execute_single(
        "SELECT id, name FROM organizations WHERE id = :id",
        {"id": request.organization_id}
    )
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check for existing conversation
    existing = execute_single(
        """
        SELECT id FROM org_conversations
        WHERE user_id = :user_id
          AND organization_id = :org_id
          AND context_type = :context_type
          AND (context_id = :context_id OR (context_id IS NULL AND :context_id IS NULL))
          AND status = 'active'
        """,
        {
            "user_id": profile_id,
            "org_id": request.organization_id,
            "context_type": request.context_type,
            "context_id": request.context_id
        }
    )

    if existing:
        conversation_id = existing["id"]
    else:
        # Create new conversation
        conversation = execute_insert(
            """
            INSERT INTO org_conversations (
                organization_id, user_id, subject, context_type, context_id,
                status, last_message_at, last_message_by_user_id
            )
            VALUES (
                :org_id, :user_id, :subject, :context_type, :context_id,
                'active', NOW(), :user_id
            )
            RETURNING *
            """,
            {
                "org_id": request.organization_id,
                "user_id": profile_id,
                "subject": request.subject or f"Message to {org['name']}",
                "context_type": request.context_type,
                "context_id": request.context_id
            }
        )
        conversation_id = conversation["id"]

    # Send initial message
    message = execute_insert(
        """
        INSERT INTO org_messages (
            conversation_id, sender_id, sender_type, content, message_type
        )
        VALUES (
            :conv_id, :sender_id, 'user', :content, 'text'
        )
        RETURNING *
        """,
        {
            "conv_id": conversation_id,
            "sender_id": profile_id,
            "content": request.initial_message
        }
    )

    # Get routing members for notifications (future use)
    routing_members = get_routing_members(request.organization_id)

    return {
        "conversation_id": conversation_id,
        "message": message,
        "routing_members": routing_members
    }


@router.get("/conversations")
async def list_conversations(
    user=Depends(get_current_user),
    status: Optional[str] = Query("active", description="Filter by status"),
    organization_id: Optional[str] = Query(None, description="Filter by organization")
):
    """List all conversations for the current user."""
    profile_id = get_profile_id(user)

    # Check if user is querying as organization member
    query_params = {"user_id": profile_id, "status": status}

    if organization_id:
        # User is viewing as org member
        if not is_org_member(profile_id, organization_id):
            raise HTTPException(status_code=403, detail="Not a member of this organization")

        conversations = execute_query(
            """
            SELECT c.*,
                   p.display_name as user_display_name,
                   p.avatar_url as user_avatar_url,
                   o.name as organization_name
            FROM org_conversations c
            JOIN profiles p ON p.id = c.user_id
            JOIN organizations o ON o.id = c.organization_id
            WHERE c.organization_id = :org_id
              AND c.status = :status
            ORDER BY c.last_message_at DESC
            """,
            {"org_id": organization_id, "status": status}
        )
    else:
        # User is viewing their own conversations
        conversations = execute_query(
            """
            SELECT c.*,
                   o.name as organization_name,
                   o.avatar_url as organization_avatar_url
            FROM org_conversations c
            JOIN organizations o ON o.id = c.organization_id
            WHERE c.user_id = :user_id
              AND c.status = :status
            ORDER BY c.last_message_at DESC
            """,
            query_params
        )

    return conversations


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    user=Depends(get_current_user)
):
    """Get a single conversation with all messages."""
    profile_id = get_profile_id(user)

    conversation = execute_single(
        """
        SELECT c.*,
               o.name as organization_name,
               o.avatar_url as organization_avatar_url,
               p.display_name as user_display_name,
               p.avatar_url as user_avatar_url
        FROM org_conversations c
        JOIN organizations o ON o.id = c.organization_id
        JOIN profiles p ON p.id = c.user_id
        WHERE c.id = :conv_id
        """,
        {"conv_id": conversation_id}
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify access (user is either the conversation owner or org member)
    is_owner = conversation["user_id"] == profile_id
    is_member = is_org_member(profile_id, conversation["organization_id"])

    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get messages
    messages = execute_query(
        """
        SELECT m.*,
               p.display_name as sender_display_name,
               p.avatar_url as sender_avatar_url
        FROM org_messages m
        JOIN profiles p ON p.id = m.sender_id
        WHERE m.conversation_id = :conv_id
          AND (m.is_internal = FALSE OR :is_member = TRUE)
        ORDER BY m.created_at ASC
        """,
        {"conv_id": conversation_id, "is_member": is_member}
    )

    return {
        "conversation": conversation,
        "messages": messages
    }


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    request: SendMessageRequest,
    user=Depends(get_current_user)
):
    """Send a message in an existing conversation."""
    profile_id = get_profile_id(user)

    # Get conversation
    conversation = execute_single(
        "SELECT * FROM org_conversations WHERE id = :id",
        {"id": conversation_id}
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify access
    is_owner = conversation["user_id"] == profile_id
    is_member = is_org_member(profile_id, conversation["organization_id"])

    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied")

    # Internal notes can only be sent by org members
    if request.is_internal and not is_member:
        raise HTTPException(status_code=403, detail="Only organization members can send internal notes")

    # Determine sender type
    sender_type = "org_member" if is_member else "user"

    # Create message
    message = execute_insert(
        """
        INSERT INTO org_messages (
            conversation_id, sender_id, sender_type,
            content, attachments, is_internal, message_type
        )
        VALUES (
            :conv_id, :sender_id, :sender_type,
            :content, :attachments, :is_internal, 'text'
        )
        RETURNING *
        """,
        {
            "conv_id": conversation_id,
            "sender_id": profile_id,
            "sender_type": sender_type,
            "content": request.content,
            "attachments": request.attachments or [],
            "is_internal": request.is_internal
        }
    )

    # Mark unread for the other party
    if is_member:
        # Message from org to user - increment user unread count
        execute_query(
            """
            UPDATE org_conversations
            SET unread_count_user = unread_count_user + 1,
                last_message_at = NOW(),
                last_message_by_user_id = :sender_id
            WHERE id = :conv_id
            """,
            {"conv_id": conversation_id, "sender_id": profile_id}
        )
    else:
        # Message from user to org - increment org unread count
        execute_query(
            """
            UPDATE org_conversations
            SET unread_count_org = unread_count_org + 1,
                last_message_at = NOW(),
                last_message_by_user_id = :sender_id
            WHERE id = :conv_id
            """,
            {"conv_id": conversation_id, "sender_id": profile_id}
        )

    return message


@router.post("/conversations/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: str,
    user=Depends(get_current_user)
):
    """Mark all messages in a conversation as read."""
    profile_id = get_profile_id(user)

    conversation = execute_single(
        "SELECT * FROM org_conversations WHERE id = :id",
        {"id": conversation_id}
    )

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Verify access
    is_owner = conversation["user_id"] == profile_id
    is_member = is_org_member(profile_id, conversation["organization_id"])

    if not (is_owner or is_member):
        raise HTTPException(status_code=403, detail="Access denied")

    # Reset appropriate unread counter
    if is_owner:
        execute_query(
            "UPDATE org_conversations SET unread_count_user = 0 WHERE id = :id",
            {"id": conversation_id}
        )
    else:
        execute_query(
            "UPDATE org_conversations SET unread_count_org = 0 WHERE id = :id",
            {"id": conversation_id}
        )

    # Mark messages as read
    execute_query(
        """
        UPDATE org_messages
        SET read_at = NOW(),
            read_by_user_ids = array_append(read_by_user_ids, :user_id)
        WHERE conversation_id = :conv_id
          AND read_at IS NULL
          AND sender_id != :user_id
        """,
        {"conv_id": conversation_id, "user_id": profile_id}
    )

    return {"success": True}


# ============================================================================
# SETTINGS ENDPOINTS (Organization Admins Only)
# ============================================================================

@router.get("/settings/{organization_id}")
async def get_message_settings(
    organization_id: str,
    user=Depends(get_current_user)
):
    """Get organization message settings (admin only)."""
    profile_id = get_profile_id(user)

    # Verify user is org admin
    member = execute_single(
        """
        SELECT role FROM organization_members
        WHERE user_id = :user_id
          AND organization_id = :org_id
          AND role IN ('owner', 'admin')
          AND status = 'active'
        """,
        {"user_id": profile_id, "org_id": organization_id}
    )

    if not member:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Get settings (create default if not exists)
    settings = execute_single(
        "SELECT * FROM org_message_settings WHERE organization_id = :org_id",
        {"org_id": organization_id}
    )

    if not settings:
        # Create default settings
        settings = execute_insert(
            """
            INSERT INTO org_message_settings (organization_id, routing_mode, email_notifications)
            VALUES (:org_id, 'all_admins', TRUE)
            RETURNING *
            """,
            {"org_id": organization_id}
        )

    return settings


@router.put("/settings/{organization_id}")
async def update_message_settings(
    organization_id: str,
    request: UpdateSettingsRequest,
    user=Depends(get_current_user)
):
    """Update organization message settings (admin only)."""
    profile_id = get_profile_id(user)

    # Verify user is org admin
    member = execute_single(
        """
        SELECT role FROM organization_members
        WHERE user_id = :user_id
          AND organization_id = :org_id
          AND role IN ('owner', 'admin')
          AND status = 'active'
        """,
        {"user_id": profile_id, "org_id": organization_id}
    )

    if not member:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Validate routing_mode
    if request.routing_mode not in ["all_admins", "specific_members", "disabled"]:
        raise HTTPException(status_code=400, detail="Invalid routing_mode")

    # Update or create settings
    settings = execute_query(
        """
        INSERT INTO org_message_settings (
            organization_id, routing_mode, routing_member_ids,
            auto_reply_enabled, auto_reply_message, email_notifications
        )
        VALUES (
            :org_id, :routing_mode, :routing_members,
            :auto_reply, :auto_reply_msg, :email_notif
        )
        ON CONFLICT (organization_id)
        DO UPDATE SET
            routing_mode = EXCLUDED.routing_mode,
            routing_member_ids = EXCLUDED.routing_member_ids,
            auto_reply_enabled = EXCLUDED.auto_reply_enabled,
            auto_reply_message = EXCLUDED.auto_reply_message,
            email_notifications = EXCLUDED.email_notifications,
            updated_at = NOW()
        RETURNING *
        """,
        {
            "org_id": organization_id,
            "routing_mode": request.routing_mode,
            "routing_members": request.routing_member_ids or [],
            "auto_reply": request.auto_reply_enabled,
            "auto_reply_msg": request.auto_reply_message,
            "email_notif": request.email_notifications
        }
    )

    return settings[0] if settings else None
