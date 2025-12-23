"""
Coms (Communications) Pydantic Schemas
Production communications system - channels, messages, voice, presence
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================

class ChannelType(str, Enum):
    DM = "dm"
    GROUP_CHAT = "group_chat"
    VOICE = "voice"
    TEXT_AND_VOICE = "text_and_voice"


class ChannelScope(str, Enum):
    PROJECT = "project"
    GLOBAL = "global"


class MessageType(str, Enum):
    TEXT = "text"
    SYSTEM = "system"
    FILE = "file"
    VOICE_NOTE = "voice_note"


class PresenceStatus(str, Enum):
    ONLINE = "online"
    AWAY = "away"
    BUSY = "busy"
    OFFLINE = "offline"


class ChannelMemberRole(str, Enum):
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"


# ============================================================================
# CHANNEL SCHEMAS
# ============================================================================

class ChannelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    channel_type: ChannelType = ChannelType.TEXT_AND_VOICE
    icon: Optional[str] = None
    color: Optional[str] = None
    visible_to_roles: List[str] = []
    can_transmit_roles: List[str] = []
    is_private: bool = False


class ChannelCreate(ChannelBase):
    project_id: Optional[str] = None
    scope: ChannelScope = ChannelScope.PROJECT
    template_key: Optional[str] = None


class ChannelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    visible_to_roles: Optional[List[str]] = None
    can_transmit_roles: Optional[List[str]] = None
    is_private: Optional[bool] = None


class ChannelMemberInfo(BaseModel):
    id: str
    user_id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "member"
    can_transmit: bool = True
    is_muted: bool = False
    joined_at: datetime


class Channel(ChannelBase):
    id: str
    scope: ChannelScope
    project_id: Optional[str]
    template_key: Optional[str]
    is_system_channel: bool
    created_by: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None
    # Computed fields
    unread_count: int = 0
    member_count: int = 0
    last_message: Optional["Message"] = None

    class Config:
        from_attributes = True


class ChannelWithMembers(Channel):
    members: List[ChannelMemberInfo] = []


# ============================================================================
# MESSAGE SCHEMAS
# ============================================================================

class MessageBase(BaseModel):
    content: str = Field(..., min_length=1)
    message_type: MessageType = MessageType.TEXT
    attachments: List[Any] = []
    reply_to_id: Optional[str] = None


class MessageCreate(MessageBase):
    pass


class MessageUpdate(BaseModel):
    content: str = Field(..., min_length=1)


class SenderInfo(BaseModel):
    id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    production_role: Optional[str] = None


class Message(MessageBase):
    id: str
    channel_id: str
    sender_id: str
    edited_at: Optional[datetime] = None
    is_deleted: bool = False
    created_at: datetime
    # Joined data
    sender: Optional[SenderInfo] = None
    reply_to: Optional["Message"] = None

    class Config:
        from_attributes = True


class MessagePage(BaseModel):
    messages: List[Message]
    has_more: bool
    next_cursor: Optional[str] = None


# ============================================================================
# CHANNEL MEMBER SCHEMAS
# ============================================================================

class ChannelMemberAdd(BaseModel):
    user_id: str
    role: ChannelMemberRole = ChannelMemberRole.MEMBER
    can_transmit: bool = True


class ChannelMemberUpdate(BaseModel):
    role: Optional[ChannelMemberRole] = None
    can_transmit: Optional[bool] = None
    is_muted: Optional[bool] = None
    notifications_enabled: Optional[bool] = None


class ChannelMember(BaseModel):
    id: str
    channel_id: str
    user_id: str
    role: str
    can_transmit: bool
    is_muted: bool
    notifications_enabled: bool
    joined_at: datetime
    # Joined user data
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


# ============================================================================
# VOICE SCHEMAS
# ============================================================================

class VoiceJoinResponse(BaseModel):
    room_id: str
    channel_id: str
    ice_servers: List[Any]
    participants: List["VoiceParticipant"]


class VoiceParticipant(BaseModel):
    id: str
    user_id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    production_role: Optional[str] = None
    is_transmitting: bool = False
    is_muted: bool = False
    is_deafened: bool = False
    peer_id: Optional[str] = None
    joined_at: datetime

    class Config:
        from_attributes = True


class VoiceRoom(BaseModel):
    id: str
    channel_id: str
    is_active: bool
    max_participants: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    participants: List[VoiceParticipant] = []

    class Config:
        from_attributes = True


# ============================================================================
# PRESENCE SCHEMAS
# ============================================================================

class PresenceUpdate(BaseModel):
    status: PresenceStatus
    status_message: Optional[str] = None
    current_channel_id: Optional[str] = None
    current_project_id: Optional[str] = None


class UserPresence(BaseModel):
    user_id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: PresenceStatus
    status_message: Optional[str] = None
    current_channel_id: Optional[str] = None
    current_project_id: Optional[str] = None
    last_seen_at: datetime

    class Config:
        from_attributes = True


class ProjectPresence(BaseModel):
    project_id: str
    users: List[UserPresence]
    online_count: int
    away_count: int


# ============================================================================
# READ RECEIPT SCHEMAS
# ============================================================================

class MarkReadRequest(BaseModel):
    message_id: Optional[str] = None  # If None, marks all as read


class UnreadCount(BaseModel):
    channel_id: str
    channel_name: str
    unread_count: int


class UnreadCountsResponse(BaseModel):
    total_unread: int
    channels: List[UnreadCount]


# ============================================================================
# TEMPLATE SCHEMAS
# ============================================================================

class ChannelTemplate(BaseModel):
    id: str
    template_key: str
    name: str
    description: Optional[str]
    channel_type: ChannelType
    icon: Optional[str]
    color: Optional[str]
    default_visible_to_roles: List[str]
    default_can_transmit_roles: List[str]
    sort_order: int
    is_active: bool

    class Config:
        from_attributes = True


class ApplyTemplatesRequest(BaseModel):
    template_keys: List[str]


class ApplyTemplatesResponse(BaseModel):
    created_channels: List[Channel]
    skipped_templates: List[str]  # Already exist


# ============================================================================
# LIST RESPONSE SCHEMAS
# ============================================================================

class ChannelListResponse(BaseModel):
    channels: List[Channel]
    total: int


# Update forward references
Channel.model_rebuild()
Message.model_rebuild()
VoiceJoinResponse.model_rebuild()
