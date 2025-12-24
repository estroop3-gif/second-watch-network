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
  useTypingIndicator,
  useSendTyping,
  formatMessageTime,
  getInitials,
} from '@/hooks/coms/useComs';
import { useVoiceContext } from '@/context/VoiceContext';
import { useAuth } from '@/context/AuthContext';
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
  const socket = useSocketOptional();
  const typingUsers = useTypingIndicator(channelId, socket);

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
            <MessagesArea channelId={channelId} typingUsers={typingUsers} />
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
  typingUsers: Array<{ userId: string; username: string }>;
}

const MessagesArea: React.FC<MessagesAreaProps> = ({ channelId, typingUsers }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChannelMessages(channelId);
  const markRead = useMarkChannelRead(channelId);

  // Filter out current user from typing indicators
  const othersTyping = useMemo(() =>
    typingUsers.filter(t => t.userId !== user?.id),
    [typingUsers, user?.id]
  );

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
      <div className="p-4 space-y-1">
        {/* Load more button */}
        {hasNextPage && (
          <div className="text-center mb-4">
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
          messages.map((message, index) => {
            const isOwnMessage = message.sender_id === user?.id;
            const prevMessage = messages[index - 1];
            const nextMessage = messages[index + 1];

            // Check if this is the first message in a group from the same sender
            const isFirstInGroup = !prevMessage || prevMessage.sender_id !== message.sender_id;
            // Check if this is the last message in a group from the same sender
            const isLastInGroup = !nextMessage || nextMessage.sender_id !== message.sender_id;

            return (
              <MessageItem
                key={message.id}
                message={message}
                isOwnMessage={isOwnMessage}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                channelId={channelId}
              />
            );
          })
        )}

        {/* Typing indicator - shows at bottom when others are typing */}
        <TypingIndicatorBubble typingUsers={othersTyping} />
      </div>
    </ScrollArea>
  );
};

// Typing Indicator Bubble (shows in message area when others are typing)
interface TypingIndicatorBubbleProps {
  typingUsers: Array<{ userId: string; username: string }>;
}

const TypingIndicatorBubble: React.FC<TypingIndicatorBubbleProps> = ({ typingUsers }) => {
  if (typingUsers.length === 0) return null;

  const displayName = typingUsers.length === 1
    ? typingUsers[0].username
    : typingUsers.length === 2
    ? `${typingUsers[0].username} and ${typingUsers[1].username}`
    : `${typingUsers.length} people`;

  return (
    <div className="flex gap-2 mt-3">
      {/* Avatar placeholder */}
      <div className="w-8 shrink-0">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="bg-muted-gray/20 text-muted-gray text-xs">
            {typingUsers[0].username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="max-w-[70%]">
        <div className="flex items-baseline gap-2 mb-0.5 px-1">
          <span className="text-xs font-medium text-muted-gray">{displayName}</span>
        </div>
        <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-muted-gray/20 inline-flex items-center gap-1">
          <span className="w-2 h-2 bg-muted-gray rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-muted-gray rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-muted-gray rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
};

// Message Item
interface MessageItemProps {
  message: ComsMessage;
  isOwnMessage: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  channelId: string;
}

const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwnMessage,
  isFirstInGroup,
  isLastInGroup,
  channelId,
}) => {
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
      <div className={cn(
        "text-sm text-muted-gray italic py-1",
        isOwnMessage ? "text-right pr-12" : "pl-12"
      )}>
        Message deleted
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex gap-2',
        isOwnMessage ? 'flex-row-reverse' : 'flex-row',
        // Add more spacing before a new sender group
        isFirstInGroup ? 'mt-3' : 'mt-0.5',
        // First message in conversation doesn't need top margin
        isFirstInGroup && 'first:mt-0'
      )}
    >
      {/* Avatar - only show for first message in group, and only for others' messages */}
      {!isOwnMessage && (
        <div className="w-8 shrink-0">
          {isFirstInGroup ? (
            <Avatar className="w-8 h-8">
              <AvatarImage src={message.sender?.avatar_url || undefined} />
              <AvatarFallback className="bg-muted-gray/20 text-muted-gray text-xs">
                {getInitials(message.sender?.full_name || message.sender?.username)}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      )}

      {/* Message bubble */}
      <div
        className={cn(
          'max-w-[70%] min-w-0',
          isOwnMessage ? 'items-end' : 'items-start'
        )}
      >
        {/* Sender name - show for first message in group */}
        {isFirstInGroup && (
          <div className={cn(
            "flex items-baseline gap-2 mb-0.5 px-1",
            isOwnMessage && "justify-end"
          )}>
            <span className="text-xs font-medium text-muted-gray">
              {message.sender?.full_name || message.sender?.username || 'Unknown'}
            </span>
            {message.sender?.production_role && (
              <span className="text-xs text-muted-gray/60">
                · {message.sender.production_role}
              </span>
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
          <div
            className={cn(
              'px-3 py-2 rounded-2xl break-words',
              isOwnMessage
                ? 'bg-accent-yellow text-charcoal-black rounded-br-md'
                : 'bg-muted-gray/20 text-bone-white rounded-bl-md',
              // Adjust border radius based on position in group
              isOwnMessage && !isFirstInGroup && 'rounded-tr-md',
              isOwnMessage && !isLastInGroup && 'rounded-br-2xl',
              !isOwnMessage && !isFirstInGroup && 'rounded-tl-md',
              !isOwnMessage && !isLastInGroup && 'rounded-bl-2xl'
            )}
          >
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        )}

        {/* Timestamp - always visible */}
        <div
          className={cn(
            'flex items-center gap-1 mt-0.5 px-1',
            isOwnMessage ? 'justify-end' : 'justify-start'
          )}
        >
          <span className="text-[10px] text-muted-gray/60">
            {formatMessageTime(message.created_at)}
          </span>
          {message.edited_at && (
            <span className="text-[10px] text-muted-gray/60">(edited)</span>
          )}
        </div>

        {/* Reply reference */}
        {message.reply_to && (
          <div className="mt-1 px-2 py-1 border-l-2 border-muted-gray/30 text-xs text-muted-gray bg-muted-gray/10 rounded">
            <span className="font-medium">{message.reply_to.sender?.username}</span>:{' '}
            <span className="truncate">{message.reply_to.content.slice(0, 50)}...</span>
          </div>
        )}
      </div>

      {/* Actions - show on hover */}
      <div
        className={cn(
          'opacity-0 group-hover:opacity-100 transition-opacity self-center',
          isOwnMessage ? 'order-first' : ''
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwnMessage ? 'start' : 'end'}>
            {isOwnMessage && (
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {isOwnMessage && <DropdownMenuSeparator />}
            {isOwnMessage && (
              <DropdownMenuItem onClick={handleDelete} className="text-red-400">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
            {!isOwnMessage && (
              <DropdownMenuItem onClick={() => {/* TODO: reply */}}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Reply
              </DropdownMenuItem>
            )}
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
  const { user } = useAuth();
  const socket = useSocketOptional();
  const sendMessage = useSendMessage(channelId, user ? {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    avatar_url: user.avatar_url,
  } : undefined);
  const { startTyping, stopTyping } = useSendTyping(channelId, socket);

  const handleSend = () => {
    if (!content.trim()) return;

    stopTyping(); // Stop typing indicator when sending
    sendMessage.mutate(
      { content: content.trim() },
      {
        onSuccess: () => setContent(''),
      }
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    if (e.target.value) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  return (
    <div className="p-4 border-t border-muted-gray/20">
      <div className="flex gap-2">
        <Input
          placeholder="Type a message..."
          value={content}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onBlur={stopTyping}
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
  // Use the persistent voice context (survives tab switches)
  const voice = useVoiceContext();
  const { user } = useAuth();
  // Always fetch participants so we can see who's in the call (even before joining)
  const { data: participants, refetch: refetchParticipants } = useVoiceParticipants(channelId);

  const {
    activeChannelId,
    isInVoice: isInVoiceGlobal,
    isConnecting,
    isMuted,
    isDeafened,
    isPTTActive,
    isVoiceActive,
    usePTTMode,
    error: voiceError,
    peers,
    transmittingUsers,
    joinVoice: joinVoiceBase,
    leaveVoice: leaveVoiceBase,
    setMuted,
    setDeafened,
    startPTT,
    stopPTT,
    setUsePTTMode,
  } = voice;

  // Check if we're in THIS channel's voice
  const isInVoice = isInVoiceGlobal && activeChannelId === channelId;

  // Merge live PTT states with participant list for instant feedback
  // Also add current user optimistically if they're in voice but not yet in the list
  // And remove current user optimistically if they've left but server hasn't updated yet
  const participantsWithLivePTT = useMemo(() => {
    const baseList = participants || [];

    // Check if current user is already in the list
    const currentUserInList = baseList.some(p => p.user_id === user?.id);

    let updatedList = [...baseList];

    // If user is in voice but not in the list yet, add them optimistically
    if (isInVoice && user && !currentUserInList) {
      const isSpeaking = usePTTMode ? isPTTActive : isVoiceActive;
      updatedList.unshift({
        id: `local-${user.id}`,
        user_id: user.id,
        username: user.username || user.email?.split('@')[0] || 'You',
        full_name: user.full_name || user.username || 'You',
        avatar_url: user.avatar_url || null,
        production_role: null,
        is_muted: isMuted,
        is_deafened: isDeafened,
        is_transmitting: isSpeaking,
        joined_at: new Date().toISOString(),
      });
    }

    // If user has LEFT voice but is still in the list, remove them optimistically
    if (!isInVoice && user && currentUserInList) {
      updatedList = updatedList.filter(p => p.user_id !== user.id);
    }

    return updatedList.map(p => {
      // For the current user, use local state for instant feedback
      if (p.user_id === user?.id && isInVoice) {
        // In PTT mode, use isPTTActive. In open mic mode, use isVoiceActive
        const isSpeaking = usePTTMode ? isPTTActive : isVoiceActive;
        return { ...p, is_transmitting: isSpeaking, is_muted: isMuted, is_deafened: isDeafened };
      }
      // For other users, use live socket state if available
      if (transmittingUsers.has(p.user_id)) {
        return { ...p, is_transmitting: transmittingUsers.get(p.user_id) };
      }
      return p;
    });
  }, [participants, user, isPTTActive, isVoiceActive, usePTTMode, isInVoice, isMuted, isDeafened, transmittingUsers]);

  // Wrap join/leave to refetch participants after the action
  const joinVoice = async () => {
    await joinVoiceBase(channelId);
    // Refetch participants after a short delay to ensure DB is updated
    setTimeout(() => refetchParticipants(), 500);
  };

  const leaveVoice = () => {
    leaveVoiceBase();
    // Refetch participants after a short delay to ensure DB is updated
    setTimeout(() => refetchParticipants(), 500);
  };

  return (
    <div className="w-72 border-l border-muted-gray/20 flex flex-col bg-charcoal-black/50">
      {/* Voice Header */}
      <div className="p-3 border-b border-muted-gray/20">
        <h4 className="font-medium text-bone-white flex items-center gap-2">
          <Headphones className="w-4 h-4 text-green-400" />
          Voice Channel
        </h4>
        <p className="text-xs text-muted-gray mt-1">
          {participantsWithLivePTT.length} participant(s)
        </p>
      </div>

      {/* Participants */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {participantsWithLivePTT.map((participant) => (
            <VoiceParticipantItem key={participant.id} participant={participant} />
          ))}

          {participantsWithLivePTT.length === 0 && !isInVoice && (
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
            {/* Mode Toggle */}
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-xs text-muted-gray">Voice Mode</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUsePTTMode(true)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    usePTTMode
                      ? 'bg-accent-yellow text-charcoal-black font-medium'
                      : 'text-muted-gray hover:text-bone-white'
                  )}
                >
                  PTT
                </button>
                <button
                  onClick={() => setUsePTTMode(false)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    !usePTTMode
                      ? 'bg-green-500 text-white font-medium'
                      : 'text-muted-gray hover:text-bone-white'
                  )}
                >
                  Open Mic
                </button>
              </div>
            </div>

            {/* PTT Button (only in PTT mode) */}
            {usePTTMode ? (
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
            ) : (
              /* Open Mic indicator */
              <div
                className={cn(
                  'w-full h-14 rounded-md flex items-center justify-center transition-all',
                  isVoiceActive
                    ? 'bg-green-500/30 border-2 border-green-500'
                    : 'bg-muted-gray/10 border border-muted-gray/30'
                )}
              >
                {isVoiceActive ? (
                  <>
                    <Mic className="w-5 h-5 mr-2 text-green-400 animate-pulse" />
                    <span className="text-green-400 font-medium">Speaking...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5 mr-2 text-muted-gray" />
                    <span className="text-muted-gray">Open Mic Active</span>
                  </>
                )}
              </div>
            )}

            {/* Mute/Deafen Controls */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className={cn(
                  'flex-1',
                  isMuted && 'bg-red-500/20 border-red-500/50 text-red-400'
                )}
                onClick={() => setMuted(!isMuted)}
                disabled={!usePTTMode} // Can't manually mute in open mic mode
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

            {/* Open mic inactivity warning */}
            {!usePTTMode && (
              <p className="text-xs text-muted-gray text-center">
                Auto-switches to PTT after 3 min of silence
              </p>
            )}
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
      'flex items-center gap-2 p-2 rounded-lg transition-colors duration-200',
      participant.is_transmitting
        ? 'bg-green-500/30 ring-2 ring-green-500'
        : 'bg-transparent'
    )}
  >
    <div className="relative">
      <Avatar className={cn(
        "w-8 h-8 transition-all duration-200",
        participant.is_transmitting && "ring-2 ring-green-500 ring-offset-2 ring-offset-charcoal-black"
      )}>
        <AvatarImage src={participant.avatar_url || undefined} />
        <AvatarFallback className={cn(
          "text-xs transition-colors duration-200",
          participant.is_transmitting && "bg-green-500 text-charcoal-black"
        )}>
          {getInitials(participant.full_name || participant.username)}
        </AvatarFallback>
      </Avatar>
      {participant.is_transmitting && (
        <Circle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 text-green-500 fill-green-500 animate-pulse" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn(
        "text-sm truncate transition-colors duration-200",
        participant.is_transmitting ? "text-green-400 font-medium" : "text-bone-white"
      )}>
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
