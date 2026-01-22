/**
 * MessagesPanel - Embedded messages panel for workspaces
 * A compact messaging interface that can be embedded in Order, Green Room,
 * Gear House, or Set workspaces to show context-relevant messages.
 */
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, ChevronDown, ChevronUp, Hash, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { MessageView } from './MessageView';
import { ChannelView } from './ChannelView';

export type MessagesPanelContext =
  | 'order'
  | 'greenroom'
  | 'gear'
  | 'set'
  | 'backlot'
  | 'applications';

interface Channel {
  id: string;
  name: string;
  slug: string;
  description?: string;
  channel_type: string;
  context_id?: string;
  is_private: boolean;
  is_default: boolean;
  member_count: number;
  unread_count: number;
}

interface Conversation {
  id: string;
  participant_ids: string[];
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
  other_participant: {
    id: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface MessagesPanelProps {
  /** The workspace context to filter messages by */
  context: MessagesPanelContext;
  /** Optional context ID (e.g., project ID, gear house ID) */
  contextId?: string;
  /** Whether the panel is expanded */
  defaultExpanded?: boolean;
  /** Callback when expansion state changes */
  onExpandedChange?: (expanded: boolean) => void;
  /** Optional className for the container */
  className?: string;
  /** Whether to show as a floating panel or inline */
  variant?: 'floating' | 'inline';
  /** Max height when inline */
  maxHeight?: string;
}

export function MessagesPanel({
  context,
  contextId,
  defaultExpanded = false,
  onExpandedChange,
  className,
  variant = 'floating',
  maxHeight = '500px',
}: MessagesPanelProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Map context to channel type
  const channelTypeMap: Record<MessagesPanelContext, string> = {
    order: 'order',
    greenroom: 'greenroom',
    gear: 'gear_team',
    set: 'set_team',
    backlot: 'project',
    applications: 'project',
  };

  // Fetch channels for this context
  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['channels', context, contextId],
    queryFn: () => api.listChannels(channelTypeMap[context], contextId),
    enabled: !!user?.id,
  });

  // Fetch DM conversations for this context
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['conversations', context],
    queryFn: () => api.getUnifiedInbox(context === 'order' ? 'order' : context === 'greenroom' ? 'greenroom' : 'dms'),
    enabled: !!user?.id,
  });

  // Calculate total unread
  const totalUnread = channels.reduce((sum, c) => sum + c.unread_count, 0) +
    conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const handleExpandToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandedChange?.(newExpanded);
  };

  const handleBack = () => {
    setSelectedChannel(null);
    setSelectedConversation(null);
  };

  // Context display names
  const contextNames: Record<MessagesPanelContext, string> = {
    order: 'The Order',
    greenroom: 'Green Room',
    gear: 'Gear House',
    set: 'Set Team',
    backlot: 'Backlot',
    applications: 'Applications',
  };

  if (variant === 'floating') {
    return (
      <div
        className={cn(
          "fixed bottom-4 right-4 z-50 flex flex-col",
          isExpanded ? "w-96" : "w-auto",
          className
        )}
      >
        {/* Expanded panel */}
        {isExpanded && (
          <div className="mb-2 flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amber-500" />
                <span className="font-medium text-white">{contextNames[context]} Messages</span>
                {totalUnread > 0 && (
                  <Badge variant="secondary" className="bg-amber-600 text-white">
                    {totalUnread}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={handleExpandToggle}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div style={{ height: maxHeight }}>
              {selectedChannel ? (
                <ChannelView
                  channelId={selectedChannel.id}
                  channelName={selectedChannel.name}
                  onBack={handleBack}
                />
              ) : selectedConversation ? (
                <MessageView
                  conversation={selectedConversation}
                  onBack={handleBack}
                />
              ) : (
                <ScrollArea className="h-full">
                  <div className="p-2">
                    {/* Channels section */}
                    {channels.length > 0 && (
                      <div className="mb-4">
                        <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-zinc-500">
                          Channels
                        </h3>
                        {channels.map((channel) => (
                          <button
                            key={channel.id}
                            onClick={() => setSelectedChannel(channel)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-zinc-800"
                          >
                            <Hash className="h-4 w-4 text-zinc-500" />
                            <span className="flex-1 truncate text-sm text-zinc-300">
                              {channel.name}
                            </span>
                            {channel.unread_count > 0 && (
                              <Badge variant="secondary" className="bg-amber-600 text-white text-xs">
                                {channel.unread_count}
                              </Badge>
                            )}
                            <Users className="h-3 w-3 text-zinc-600" />
                            <span className="text-xs text-zinc-600">{channel.member_count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* DMs section */}
                    {conversations.length > 0 && (
                      <div>
                        <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-zinc-500">
                          Direct Messages
                        </h3>
                        {conversations.slice(0, 5).map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => setSelectedConversation(conv)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-zinc-800"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium">
                              {(conv.other_participant?.full_name?.[0] || conv.other_participant?.username?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-zinc-300">
                                {conv.other_participant?.full_name || conv.other_participant?.username || 'Unknown'}
                              </p>
                              {conv.last_message && (
                                <p className="truncate text-xs text-zinc-500">
                                  {conv.last_message}
                                </p>
                              )}
                            </div>
                            {conv.unread_count > 0 && (
                              <Badge variant="secondary" className="bg-amber-600 text-white text-xs">
                                {conv.unread_count}
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {channels.length === 0 && conversations.length === 0 && (
                      <div className="py-8 text-center text-zinc-500">
                        <MessageSquare className="mx-auto mb-2 h-8 w-8" />
                        <p className="text-sm">No messages yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* Collapsed toggle button */}
        <Button
          onClick={handleExpandToggle}
          className={cn(
            "self-end gap-2 rounded-full shadow-lg",
            isExpanded ? "hidden" : "flex",
            "bg-amber-600 hover:bg-amber-700"
          )}
        >
          <MessageSquare className="h-5 w-5" />
          <span>{contextNames[context]}</span>
          {totalUnread > 0 && (
            <Badge variant="secondary" className="bg-white text-amber-600">
              {totalUnread}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  // Inline variant
  return (
    <div className={cn("overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900", className)}>
      {/* Collapsible header */}
      <button
        onClick={handleExpandToggle}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-amber-500" />
          <span className="font-medium text-white">{contextNames[context]} Messages</span>
          {totalUnread > 0 && (
            <Badge variant="secondary" className="bg-amber-600 text-white">
              {totalUnread}
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-800" style={{ height: maxHeight }}>
          {selectedChannel ? (
            <ChannelView
              channelId={selectedChannel.id}
              channelName={selectedChannel.name}
              onBack={handleBack}
            />
          ) : selectedConversation ? (
            <MessageView
              conversation={selectedConversation}
              onBack={handleBack}
            />
          ) : (
            <ScrollArea className="h-full">
              <div className="p-2">
                {/* Channels section */}
                {channels.length > 0 && (
                  <div className="mb-4">
                    <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-zinc-500">
                      Channels
                    </h3>
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedChannel(channel)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-zinc-800"
                      >
                        <Hash className="h-4 w-4 text-zinc-500" />
                        <span className="flex-1 truncate text-sm text-zinc-300">
                          {channel.name}
                        </span>
                        {channel.unread_count > 0 && (
                          <Badge variant="secondary" className="bg-amber-600 text-white text-xs">
                            {channel.unread_count}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* DMs section */}
                {conversations.length > 0 && (
                  <div>
                    <h3 className="mb-2 px-2 text-xs font-semibold uppercase text-zinc-500">
                      Direct Messages
                    </h3>
                    {conversations.slice(0, 5).map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-zinc-800"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium">
                          {(conv.other_participant?.full_name?.[0] || conv.other_participant?.username?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-zinc-300">
                            {conv.other_participant?.full_name || conv.other_participant?.username || 'Unknown'}
                          </p>
                        </div>
                        {conv.unread_count > 0 && (
                          <Badge variant="secondary" className="bg-amber-600 text-white text-xs">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {channels.length === 0 && conversations.length === 0 && (
                  <div className="py-8 text-center text-zinc-500">
                    <MessageSquare className="mx-auto mb-2 h-8 w-8" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

export default MessagesPanel;
