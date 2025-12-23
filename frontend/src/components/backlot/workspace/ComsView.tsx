/**
 * ComsView - Production Communications System
 * Full messaging and voice chat with role-based channels
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  MessageCircle,
  Radio,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Hash,
  Plus,
  Settings,
  Send,
  Users,
  ChevronDown,
  ChevronRight,
  Circle,
  Search,
  Headphones,
  PhoneOff,
  Megaphone,
  Timer,
  Camera,
  Aperture,
  Building,
  Lock,
  Zap,
  Palette,
  MoreVertical,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useChannels,
  useChannel,
  useCreateChannel,
  useUpdateChannel,
  useDeleteChannel,
  useChannelMessages,
  useSendMessage,
  useEditMessage,
  useDeleteMessage,
  useChannelMembers,
  useVoiceParticipants,
  useChannelTemplates,
  useApplyTemplates,
  useMarkChannelRead,
  formatMessageTime,
  getInitials,
} from '@/hooks/coms/useComs';
import { useVoice } from '@/hooks/coms/useVoice';
import { useSocketOptional } from '@/hooks/useSocket';
import { useProjectPermission } from '@/hooks/backlot';
import type {
  ComsChannel,
  ComsMessage,
  ChannelType,
  VoiceParticipant,
  ChannelTemplate,
  ChannelMemberInfo,
} from '@/types/coms';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface ComsViewProps {
  projectId: string;
  canEdit?: boolean;
}

// Icon mapping for channel types
const CHANNEL_ICONS: Record<string, React.ElementType> = {
  megaphone: Megaphone,
  timer: Timer,
  camera: Camera,
  aperture: Aperture,
  building: Building,
  lock: Lock,
  'message-circle': MessageCircle,
  zap: Zap,
  'volume-2': Volume2,
  palette: Palette,
  hash: Hash,
  radio: Radio,
};

// Channel type config
const CHANNEL_TYPE_CONFIG: Record<ChannelType, { label: string; icon: React.ElementType }> = {
  dm: { label: 'Direct Message', icon: MessageCircle },
  group_chat: { label: 'Group Chat', icon: MessageCircle },
  voice: { label: 'Voice Only', icon: Mic },
  text_and_voice: { label: 'Text & Voice', icon: Radio },
};

// Above-the-line roles that can create channels
const CREATOR_ROLES = ['showrunner', 'producer', 'director', 'first_ad'];

const ComsView: React.FC<ComsViewProps> = ({ projectId, canEdit = false }) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showTemplatesDialog, setShowTemplatesDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    voice: true,
    text: true,
    private: true,
  });

  const { data: permission } = useProjectPermission(projectId);
  const { data: channelsData, isLoading: channelsLoading } = useChannels({ projectId, scope: 'project' });
  const { data: templates } = useChannelTemplates();

  const channels = useMemo(() => channelsData?.channels || [], [channelsData?.channels]);

  // Group channels by type
  const groupedChannels = useMemo(() => {
    const groups: Record<string, ComsChannel[]> = {
      voice: [],
      text: [],
      private: [],
    };

    channels
      .filter((ch) => !ch.archived_at)
      .forEach((channel) => {
        if (channel.is_private) {
          groups.private.push(channel);
        } else if (channel.channel_type === 'voice' || channel.channel_type === 'text_and_voice') {
          groups.voice.push(channel);
        } else {
          groups.text.push(channel);
        }
      });

    // Sort by sort_order
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.sort_order - b.sort_order);
    });

    return groups;
  }, [channels]);

  // Filter channels based on search
  const filteredChannels = useMemo(() => {
    if (!searchQuery) return groupedChannels;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, ComsChannel[]> = {
      voice: [],
      text: [],
      private: [],
    };

    Object.entries(groupedChannels).forEach(([key, chans]) => {
      filtered[key] = chans.filter((ch) => ch.name.toLowerCase().includes(query));
    });

    return filtered;
  }, [groupedChannels, searchQuery]);

  // Check if user can create channels
  const canCreateChannel = permission?.isAdmin || CREATOR_ROLES.includes(permission?.role || '');

  // Auto-select first channel
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0].id);
    }
  }, [channels, selectedChannelId]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (channelsLoading) {
    return (
      <div className="h-full flex">
        <div className="w-64 border-r border-muted-gray/20 p-4 space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] flex bg-charcoal-black rounded-lg border border-muted-gray/20 overflow-hidden">
      {/* Channel Sidebar */}
      <div className="w-64 border-r border-muted-gray/20 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b border-muted-gray/20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-bone-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-accent-yellow" />
              Coms
            </h2>
            {canCreateChannel && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowCreateChannel(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Channel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowTemplatesDialog(true)}>
                    <Megaphone className="w-4 h-4 mr-2" />
                    Apply Templates
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm bg-muted-gray/10 border-muted-gray/20"
            />
          </div>
        </div>

        {/* Channel List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Voice Channels */}
            {filteredChannels.voice.length > 0 && (
              <ChannelSection
                title="Voice Channels"
                channels={filteredChannels.voice}
                expanded={expandedSections.voice}
                onToggle={() => toggleSection('voice')}
                selectedId={selectedChannelId}
                onSelect={setSelectedChannelId}
              />
            )}

            {/* Text Channels */}
            {filteredChannels.text.length > 0 && (
              <ChannelSection
                title="Text Channels"
                channels={filteredChannels.text}
                expanded={expandedSections.text}
                onToggle={() => toggleSection('text')}
                selectedId={selectedChannelId}
                onSelect={setSelectedChannelId}
              />
            )}

            {/* Private Channels */}
            {filteredChannels.private.length > 0 && (
              <ChannelSection
                title="Private Channels"
                channels={filteredChannels.private}
                expanded={expandedSections.private}
                onToggle={() => toggleSection('private')}
                selectedId={selectedChannelId}
                onSelect={setSelectedChannelId}
              />
            )}

            {channels.length === 0 && (
              <div className="text-center py-8 text-muted-gray">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No channels yet</p>
                {canCreateChannel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowTemplatesDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Production Channels
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannelId ? (
          <ChannelView
            channelId={selectedChannelId}
            projectId={projectId}
            canEdit={canEdit}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-gray">
            <div className="text-center">
              <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a channel to start communicating</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        projectId={projectId}
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        onSuccess={() => setShowCreateChannel(false)}
      />

      {/* Apply Templates Dialog */}
      <ApplyTemplatesDialog
        projectId={projectId}
        templates={templates || []}
        existingChannels={channels}
        open={showTemplatesDialog}
        onOpenChange={setShowTemplatesDialog}
        onSuccess={() => setShowTemplatesDialog(false)}
      />
    </div>
  );
};

// Channel Section Component
interface ChannelSectionProps {
  title: string;
  channels: ComsChannel[];
  expanded: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ChannelSection: React.FC<ChannelSectionProps> = ({
  title,
  channels,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}) => (
  <div className="mb-4">
    <button
      onClick={onToggle}
      className="flex items-center gap-1 w-full px-2 py-1 text-xs font-medium text-muted-gray hover:text-bone-white uppercase tracking-wider"
    >
      {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      {title}
      <span className="ml-auto text-muted-gray/50">{channels.length}</span>
    </button>

    {expanded && (
      <div className="mt-1 space-y-0.5">
        {channels.map((channel) => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            selected={channel.id === selectedId}
            onClick={() => onSelect(channel.id)}
          />
        ))}
      </div>
    )}
  </div>
);

// Channel Item Component
interface ChannelItemProps {
  channel: ComsChannel;
  selected: boolean;
  onClick: () => void;
}

const ChannelItem: React.FC<ChannelItemProps> = ({ channel, selected, onClick }) => {
  const IconComponent = channel.icon ? CHANNEL_ICONS[channel.icon] || Hash : Hash;
  const hasVoice = channel.channel_type === 'voice' || channel.channel_type === 'text_and_voice';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors',
        selected
          ? 'bg-accent-yellow/10 text-accent-yellow'
          : 'text-muted-gray hover:text-bone-white hover:bg-muted-gray/10'
      )}
    >
      <IconComponent
        className="w-4 h-4 shrink-0"
        style={channel.color ? { color: channel.color } : undefined}
      />
      <span className="truncate flex-1 text-left">{channel.name}</span>

      {/* Unread badge */}
      {channel.unread_count > 0 && (
        <Badge
          variant="default"
          className="bg-accent-yellow text-charcoal-black text-xs px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
        >
          {channel.unread_count > 99 ? '99+' : channel.unread_count}
        </Badge>
      )}

      {/* Voice indicator */}
      {hasVoice && channel.member_count > 0 && (
        <span className="text-xs text-green-400 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {channel.member_count}
        </span>
      )}

      {/* Private indicator */}
      {channel.is_private && <Lock className="w-3 h-3 opacity-50" />}
    </button>
  );
};

// Channel View Component
interface ChannelViewProps {
  channelId: string;
  projectId: string;
  canEdit: boolean;
}

const ChannelView: React.FC<ChannelViewProps> = ({ channelId, projectId, canEdit }) => {
  const { data: channel, isLoading } = useChannel(channelId);
  const hasVoice =
    channel?.channel_type === 'voice' || channel?.channel_type === 'text_and_voice';
  const hasText =
    channel?.channel_type !== 'voice';

  if (isLoading || !channel) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Channel Header */}
      <ChannelHeader channel={channel} />

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages Area */}
        {hasText && (
          <div className="flex-1 flex flex-col">
            <MessagesArea channelId={channelId} />
            <MessageInput channelId={channelId} />
          </div>
        )}

        {/* Voice Panel (if voice channel) */}
        {hasVoice && (
          <VoicePanel channelId={channelId} channel={channel} />
        )}
      </div>
    </div>
  );
};

// Channel Header
interface ChannelHeaderProps {
  channel: ComsChannel;
}

const ChannelHeader: React.FC<ChannelHeaderProps> = ({ channel }) => {
  const IconComponent = channel.icon ? CHANNEL_ICONS[channel.icon] || Hash : Hash;
  const typeConfig = CHANNEL_TYPE_CONFIG[channel.channel_type];

  return (
    <div className="h-12 px-4 border-b border-muted-gray/20 flex items-center gap-3">
      <IconComponent
        className="w-5 h-5"
        style={channel.color ? { color: channel.color } : undefined}
      />
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-bone-white truncate">{channel.name}</h3>
        {channel.description && (
          <p className="text-xs text-muted-gray truncate">{channel.description}</p>
        )}
      </div>
      <Badge variant="outline" className="text-xs border-muted-gray/30">
        <typeConfig.icon className="w-3 h-3 mr-1" />
        {typeConfig.label}
      </Badge>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <Settings className="w-4 h-4" />
      </Button>
    </div>
  );
};

// Messages Area
interface MessagesAreaProps {
  channelId: string;
}

const MessagesArea: React.FC<MessagesAreaProps> = ({ channelId }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChannelMessages(channelId);
  const markRead = useMarkChannelRead(channelId);

  // All messages flattened
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.messages).reverse();
  }, [data]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      markRead.mutate(messages[messages.length - 1].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, messages.length]);

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1">
      <div className="p-4 space-y-4">
        {/* Load more button */}
        {hasNextPage && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load older messages'}
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-gray">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              showAvatar={
                index === 0 ||
                messages[index - 1]?.sender_id !== message.sender_id
              }
              channelId={channelId}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
};

// Message Item
interface MessageItemProps {
  message: ComsMessage;
  showAvatar: boolean;
  channelId: string;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, showAvatar, channelId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const editMessage = useEditMessage(channelId);
  const deleteMessage = useDeleteMessage(channelId);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      editMessage.mutate(
        { messageId: message.id, content: editContent },
        { onSuccess: () => setIsEditing(false) }
      );
    } else {
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    if (confirm('Delete this message?')) {
      deleteMessage.mutate(message.id);
    }
  };

  if (message.is_deleted) {
    return (
      <div className="text-sm text-muted-gray italic pl-13">
        Message deleted
      </div>
    );
  }

  return (
    <div className={cn('group flex gap-3', !showAvatar && 'pl-13')}>
      {showAvatar && (
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={message.sender?.avatar_url || undefined} />
          <AvatarFallback className="bg-muted-gray/20 text-muted-gray text-sm">
            {getInitials(message.sender?.full_name || message.sender?.username)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="flex-1 min-w-0">
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-medium text-bone-white">
              {message.sender?.full_name || message.sender?.username || 'Unknown'}
            </span>
            {message.sender?.production_role && (
              <Badge variant="outline" className="text-xs border-muted-gray/30 py-0">
                {message.sender.production_role}
              </Badge>
            )}
            <span className="text-xs text-muted-gray">
              {formatMessageTime(message.created_at)}
            </span>
            {message.edited_at && (
              <span className="text-xs text-muted-gray">(edited)</span>
            )}
          </div>
        )}

        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                } else if (e.key === 'Escape') {
                  setIsEditing(false);
                  setEditContent(message.content);
                }
              }}
            />
            <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setEditContent(message.content);
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className="text-bone-white/90 break-words">{message.content}</p>
        )}

        {/* Reply reference */}
        {message.reply_to && (
          <div className="mt-1 pl-3 border-l-2 border-muted-gray/30 text-sm text-muted-gray">
            <span className="font-medium">{message.reply_to.sender?.username}</span>:{' '}
            <span className="truncate">{message.reply_to.content.slice(0, 50)}...</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-red-400">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// Message Input
interface MessageInputProps {
  channelId: string;
}

const MessageInput: React.FC<MessageInputProps> = ({ channelId }) => {
  const [content, setContent] = useState('');
  const sendMessage = useSendMessage(channelId);

  const handleSend = () => {
    if (!content.trim()) return;

    sendMessage.mutate(
      { content: content.trim() },
      {
        onSuccess: () => setContent(''),
      }
    );
  };

  return (
    <div className="p-4 border-t border-muted-gray/20">
      <div className="flex gap-2">
        <Input
          placeholder="Type a message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 bg-muted-gray/10 border-muted-gray/20"
        />
        <Button
          onClick={handleSend}
          disabled={!content.trim() || sendMessage.isPending}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// Voice Panel
interface VoicePanelProps {
  channelId: string;
  channel: ComsChannel;
}

const VoicePanel: React.FC<VoicePanelProps> = ({ channelId, channel }) => {
  // Use the real voice hook with WebRTC
  const voice = useVoice({ channelId });
  const { data: participants } = useVoiceParticipants(voice.isInVoice ? channelId : null);

  const {
    isInVoice,
    isConnecting,
    isMuted,
    isDeafened,
    isPTTActive,
    error: voiceError,
    peers,
    joinVoice,
    leaveVoice,
    setMuted,
    setDeafened,
    startPTT,
    stopPTT,
  } = voice;

  return (
    <div className="w-72 border-l border-muted-gray/20 flex flex-col bg-charcoal-black/50">
      {/* Voice Header */}
      <div className="p-3 border-b border-muted-gray/20">
        <h4 className="font-medium text-bone-white flex items-center gap-2">
          <Headphones className="w-4 h-4 text-green-400" />
          Voice Channel
        </h4>
        <p className="text-xs text-muted-gray mt-1">
          {participants?.length || 0} participant(s)
        </p>
      </div>

      {/* Participants */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {participants?.map((participant) => (
            <VoiceParticipantItem key={participant.id} participant={participant} />
          ))}

          {(!participants || participants.length === 0) && !isInVoice && (
            <div className="text-center py-6 text-muted-gray">
              <Mic className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No one in voice</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Voice Controls */}
      <div className="p-3 border-t border-muted-gray/20 space-y-3">
        {isInVoice ? (
          <>
            {/* PTT Button */}
            <Button
              className={cn(
                'w-full h-14 text-lg font-medium transition-all',
                isPTTActive
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-muted-gray/20 hover:bg-muted-gray/30 text-bone-white'
              )}
              onMouseDown={startPTT}
              onMouseUp={stopPTT}
              onMouseLeave={stopPTT}
              onTouchStart={startPTT}
              onTouchEnd={stopPTT}
              disabled={isDeafened}
            >
              {isPTTActive ? (
                <>
                  <Mic className="w-5 h-5 mr-2 animate-pulse" />
                  Transmitting...
                </>
              ) : (
                <>
                  <MicOff className="w-5 h-5 mr-2" />
                  Push to Talk
                </>
              )}
            </Button>

            {/* Mute/Deafen Controls */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className={cn(
                  'flex-1',
                  isMuted && 'bg-red-500/20 border-red-500/50 text-red-400'
                )}
                onClick={() => setMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                className={cn(
                  'flex-1',
                  isDeafened && 'bg-red-500/20 border-red-500/50 text-red-400'
                )}
                onClick={() => setDeafened(!isDeafened)}
              >
                {isDeafened ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button variant="destructive" className="flex-1" onClick={leaveVoice}>
                <PhoneOff className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={joinVoice}
            disabled={isConnecting}
          >
            <Headphones className="w-4 h-4 mr-2" />
            {isConnecting ? 'Connecting...' : 'Join Voice'}
          </Button>
        )}
        {voiceError && (
          <p className="text-xs text-red-400 mt-2">{voiceError}</p>
        )}
      </div>
    </div>
  );
};

// Voice Participant Item
interface VoiceParticipantItemProps {
  participant: VoiceParticipant;
}

const VoiceParticipantItem: React.FC<VoiceParticipantItemProps> = ({ participant }) => (
  <div
    className={cn(
      'flex items-center gap-2 p-2 rounded-lg',
      participant.is_transmitting && 'bg-green-500/10 ring-1 ring-green-500/50'
    )}
  >
    <div className="relative">
      <Avatar className="w-8 h-8">
        <AvatarImage src={participant.avatar_url || undefined} />
        <AvatarFallback className="text-xs">
          {getInitials(participant.full_name || participant.username)}
        </AvatarFallback>
      </Avatar>
      {participant.is_transmitting && (
        <Circle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-green-500 fill-green-500 animate-pulse" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-bone-white truncate">
        {participant.full_name || participant.username}
      </p>
      {participant.production_role && (
        <p className="text-xs text-muted-gray truncate">{participant.production_role}</p>
      )}
    </div>
    <div className="flex items-center gap-1">
      {participant.is_muted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
      {participant.is_deafened && <VolumeX className="w-3.5 h-3.5 text-red-400" />}
    </div>
  </div>
);

// Create Channel Dialog
interface CreateChannelDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateChannelDialog: React.FC<CreateChannelDialogProps> = ({
  projectId,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channelType, setChannelType] = useState<ChannelType>('text_and_voice');
  const [isPrivate, setIsPrivate] = useState(false);

  const createChannel = useCreateChannel(projectId);

  const handleSubmit = () => {
    if (!name.trim()) return;

    createChannel.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        channel_type: channelType,
        is_private: isPrivate,
      },
      {
        onSuccess: () => {
          setName('');
          setDescription('');
          setChannelType('text_and_voice');
          setIsPrivate(false);
          onSuccess();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
          <DialogDescription>
            Create a new communication channel for your production team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Channel Name</Label>
            <Input
              placeholder="e.g., Camera Department"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="What's this channel for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Channel Type</Label>
            <Select value={channelType} onValueChange={(v) => setChannelType(v as ChannelType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text_and_voice">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4" />
                    Text & Voice
                  </div>
                </SelectItem>
                <SelectItem value="group_chat">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Text Only
                  </div>
                </SelectItem>
                <SelectItem value="voice">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4" />
                    Voice Only
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Private Channel</Label>
              <p className="text-xs text-muted-gray">Only invited members can see this channel</p>
            </div>
            <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createChannel.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            Create Channel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Apply Templates Dialog
interface ApplyTemplatesDialogProps {
  projectId: string;
  templates: ChannelTemplate[];
  existingChannels: ComsChannel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const ApplyTemplatesDialog: React.FC<ApplyTemplatesDialogProps> = ({
  projectId,
  templates,
  existingChannels,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const applyTemplates = useApplyTemplates(projectId);

  // Check which templates already exist
  const existingTemplateKeys = new Set(
    existingChannels.filter((ch) => ch.template_key).map((ch) => ch.template_key)
  );

  const toggleTemplate = (key: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleApply = () => {
    if (selectedTemplates.length === 0) return;

    applyTemplates.mutate(selectedTemplates, {
      onSuccess: () => {
        setSelectedTemplates([]);
        onSuccess();
      },
    });
  };

  // Select all that aren't already created
  const selectAll = () => {
    const available = templates
      .filter((t) => t.is_active && !existingTemplateKeys.has(t.template_key))
      .map((t) => t.template_key);
    setSelectedTemplates(available);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply Production Templates</DialogTitle>
          <DialogDescription>
            Add standard production channels to your project. These are pre-configured with
            appropriate role access.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex justify-end mb-3">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All Available
            </Button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {templates
              .filter((t) => t.is_active)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((template) => {
                const exists = existingTemplateKeys.has(template.template_key);
                const IconComponent = template.icon
                  ? CHANNEL_ICONS[template.icon] || Hash
                  : Hash;

                return (
                  <div
                    key={template.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      exists
                        ? 'border-muted-gray/10 bg-muted-gray/5 opacity-50'
                        : selectedTemplates.includes(template.template_key)
                        ? 'border-accent-yellow/50 bg-accent-yellow/5'
                        : 'border-muted-gray/20 hover:border-muted-gray/40 cursor-pointer'
                    )}
                    onClick={() => !exists && toggleTemplate(template.template_key)}
                  >
                    <IconComponent
                      className="w-5 h-5 shrink-0"
                      style={template.color ? { color: template.color } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-bone-white">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-muted-gray truncate">{template.description}</p>
                      )}
                    </div>
                    {exists ? (
                      <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                        <Check className="w-3 h-3 mr-1" />
                        Added
                      </Badge>
                    ) : selectedTemplates.includes(template.template_key) ? (
                      <Check className="w-5 h-5 text-accent-yellow" />
                    ) : null}
                  </div>
                );
              })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={selectedTemplates.length === 0 || applyTemplates.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            Apply {selectedTemplates.length} Template{selectedTemplates.length !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComsView;
