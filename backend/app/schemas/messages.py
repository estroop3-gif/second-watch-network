"""
Messages & Conversations Schemas
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class MessageBase(BaseModel):
    content: str


class EncryptedMessageData(BaseModel):
    """E2EE encrypted message payload"""
    ciphertext: str  # Base64 encoded ciphertext
    nonce: str  # Base64 encoded nonce/IV
    is_prekey_message: bool = False  # True for first message in session
    sender_public_key: Optional[str] = None  # Ephemeral key for prekey messages
    message_number: Optional[int] = None  # Ratchet sequence number


class MessageCreate(MessageBase):
    conversation_id: Optional[str] = None
    recipient_id: Optional[str] = None
    submission_id: Optional[str] = None
    # E2EE fields
    is_encrypted: bool = False
    encrypted_data: Optional[EncryptedMessageData] = None
    # Attachments
    attachments: Optional[List[Dict[str, Any]]] = None


class Message(MessageBase):
    id: str
    conversation_id: str
    sender_id: str
    is_read: bool = False
    created_at: datetime
    # E2EE fields
    is_encrypted: bool = False
    ciphertext: Optional[str] = None
    nonce: Optional[str] = None
    message_type: Optional[int] = None  # 1=normal, 2=prekey
    sender_public_key: Optional[str] = None
    message_number: Optional[int] = None
    # Attachments
    attachments: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True


class ConversationBase(BaseModel):
    pass


class Conversation(ConversationBase):
    id: str
    participant_ids: list[str]
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
