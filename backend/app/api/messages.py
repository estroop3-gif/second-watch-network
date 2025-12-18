"""
Messages & Conversations API Routes - Enhanced
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.core.database import get_client
from app.schemas.messages import Message, MessageCreate, Conversation

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
    """Send a new message"""
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
        return response.data[0]
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
