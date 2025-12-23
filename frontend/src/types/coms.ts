/**
 * Coms (Communications) Type Definitions
 * Production communications system - channels, messages, voice, presence
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ChannelType = 'dm' | 'group_chat' | 'voice' | 'text_and_voice';
export type ChannelScope = 'project' | 'global';
export type MessageType = 'text' | 'system' | 'file' | 'voice_note';
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';
export type ChannelMemberRole = 'admin' | 'moderator' | 'member';

// ============================================================================
// CHANNEL TYPES
// ============================================================================

export interface ComsChannel {
  id: string;
  name: string;
  description: string | null;
  channel_type: ChannelType;
  scope: ChannelScope;
  project_id: string | null;
  icon: string | null;
  color: string | null;
  template_key: string | null;
  is_system_channel: boolean;
  visible_to_roles: string[];
  can_transmit_roles: string[];
  is_private: boolean;
  created_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Computed
  unread_count: number;
  member_count: number;
  last_message?: ComsMessage | null;
}

export interface ChannelMemberInfo {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: ChannelMemberRole;
  can_transmit: boolean;
  is_muted: boolean;
  joined_at: string;
}

export interface ComsChannelWithMembers extends ComsChannel {
  members: ChannelMemberInfo[];
}

export interface ChannelCreateInput {
  name: string;
  description?: string;
  channel_type?: ChannelType;
  scope?: ChannelScope;
  project_id?: string;
  icon?: string;
  color?: string;
  visible_to_roles?: string[];
  can_transmit_roles?: string[];
  is_private?: boolean;
  template_key?: string;
}

export interface ChannelUpdateInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  visible_to_roles?: string[];
  can_transmit_roles?: string[];
  is_private?: boolean;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface SenderInfo {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  production_role: string | null;
}

export interface ComsMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  attachments: any[];
  reply_to_id: string | null;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
  sender?: SenderInfo;
  reply_to?: ComsMessage;
}

export interface MessageCreateInput {
  content: string;
  message_type?: MessageType;
  attachments?: any[];
  reply_to_id?: string;
}

export interface MessagePage {
  messages: ComsMessage[];
  has_more: boolean;
  next_cursor: string | null;
}

// ============================================================================
// CHANNEL MEMBER TYPES
// ============================================================================

export interface ChannelMemberAddInput {
  user_id: string;
  role?: ChannelMemberRole;
  can_transmit?: boolean;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: ChannelMemberRole;
  can_transmit: boolean;
  is_muted: boolean;
  notifications_enabled: boolean;
  joined_at: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

// ============================================================================
// VOICE TYPES
// ============================================================================

export interface VoiceParticipant {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  production_role: string | null;
  is_transmitting: boolean;
  is_muted: boolean;
  is_deafened: boolean;
  peer_id: string | null;
  joined_at: string;
}

export interface VoiceJoinResponse {
  room_id: string;
  channel_id: string;
  ice_servers: RTCIceServer[];
  participants: VoiceParticipant[];
}

export interface VoiceRoom {
  id: string;
  channel_id: string;
  is_active: boolean;
  max_participants: number;
  started_at: string;
  ended_at: string | null;
  participants: VoiceParticipant[];
}

// ============================================================================
// PRESENCE TYPES
// ============================================================================

export interface UserPresence {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: PresenceStatus;
  status_message: string | null;
  current_channel_id: string | null;
  current_project_id: string | null;
  last_seen_at: string;
}

export interface ProjectPresence {
  project_id: string;
  users: UserPresence[];
  online_count: number;
  away_count: number;
}

export interface PresenceUpdateInput {
  status: PresenceStatus;
  status_message?: string;
  current_channel_id?: string;
  current_project_id?: string;
}

// ============================================================================
// READ RECEIPT TYPES
// ============================================================================

export interface UnreadCount {
  channel_id: string;
  channel_name: string;
  unread_count: number;
}

export interface UnreadCountsResponse {
  total_unread: number;
  channels: UnreadCount[];
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface ChannelTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  channel_type: ChannelType;
  icon: string | null;
  color: string | null;
  default_visible_to_roles: string[];
  default_can_transmit_roles: string[];
  sort_order: number;
  is_active: boolean;
}

export interface ApplyTemplatesRequest {
  template_keys: string[];
}

export interface ApplyTemplatesResponse {
  created_channels: ComsChannel[];
  skipped_templates: string[];
}

// ============================================================================
// LIST RESPONSE TYPES
// ============================================================================

export interface ChannelListResponse {
  channels: ComsChannel[];
  total: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const CHANNEL_TYPE_CONFIG: Record<ChannelType, { label: string; icon: string; color: string }> = {
  dm: { label: 'Direct Message', icon: 'message-square', color: '#6B7280' },
  group_chat: { label: 'Group Chat', icon: 'message-circle', color: '#3B82F6' },
  voice: { label: 'Voice Only', icon: 'mic', color: '#10B981' },
  text_and_voice: { label: 'Text & Voice', icon: 'radio', color: '#8B5CF6' },
};

export const PRESENCE_STATUS_CONFIG: Record<PresenceStatus, { label: string; color: string }> = {
  online: { label: 'Online', color: '#10B981' },
  away: { label: 'Away', color: '#F59E0B' },
  busy: { label: 'Busy', color: '#EF4444' },
  offline: { label: 'Offline', color: '#6B7280' },
};

export const CHANNEL_ICON_MAP: Record<string, string> = {
  megaphone: 'Megaphone',
  timer: 'Timer',
  camera: 'Camera',
  aperture: 'Aperture',
  building: 'Building',
  lock: 'Lock',
  'message-circle': 'MessageCircle',
  zap: 'Zap',
  'volume-2': 'Volume2',
  palette: 'Palette',
};
