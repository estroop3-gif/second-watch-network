/**
 * ChannelView - Group channel messaging view
 * Displays messages for Order, Green Room, Gear/Set team channels
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, Hash, Users, Pin, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender: {
    id: string;
    username: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
  content: string;
  created_at: string;
  is_pinned: boolean;
  reply_to_id?: string;
}

interface ChannelViewProps {
  channelId: string;
  channelName: string;
  isMobile?: boolean;
  onBack?: () => void;
}

export function ChannelView({ channelId, channelName, isMobile, onBack }: ChannelViewProps) {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load messages
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const [messagesData, channelData] = await Promise.all([
          api.getChannelMessages(channelId),
          api.getChannel(channelId),
        ]);
        setMessages(messagesData);
        setMemberCount(channelData.member_count || 0);

        // Mark as read
        api.markChannelRead(channelId).catch(console.error);
      } catch (error) {
        console.error('Failed to load channel messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [channelId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const newMessages = await api.getChannelMessages(channelId);
        if (newMessages.length !== messages.length) {
          setMessages(newMessages);
          api.markChannelRead(channelId).catch(console.error);
        }
      } catch (error) {
        console.error('Failed to poll messages:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [channelId, messages.length]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const sentMessage = await api.sendChannelMessage(channelId, newMessage.trim());
      setMessages((prev) => [...prev, sentMessage]);
      setNewMessage('');
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getSenderName = (sender: ChannelMessage['sender']) => {
    return sender?.display_name || sender?.full_name || sender?.username || 'Unknown';
  };

  const getInitials = (sender: ChannelMessage['sender']) => {
    const name = getSenderName(sender);
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChannelMessage[]>);

  // Check if messages are from the same sender within 5 minutes
  const isConsecutive = (current: ChannelMessage, previous?: ChannelMessage) => {
    if (!previous) return false;
    if (current.sender_id !== previous.sender_id) return false;
    const timeDiff =
      new Date(current.created_at).getTime() - new Date(previous.created_at).getTime();
    return timeDiff < 5 * 60 * 1000; // 5 minutes
  };

  return (
    <div className="flex h-full flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          {isMobile && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
            <Hash className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h2 className="font-semibold text-white">{channelName}</h2>
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <Users className="h-3 w-3" />
              <span>{memberCount} members</span>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View pinned messages</DropdownMenuItem>
            <DropdownMenuItem>Channel settings</DropdownMenuItem>
            <DropdownMenuItem className="text-red-400">Leave channel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800">
              <Hash className="h-8 w-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-medium text-white">Welcome to #{channelName}</h3>
            <p className="mt-1 text-sm text-zinc-400">
              This is the beginning of the channel. Start the conversation!
            </p>
          </div>
        ) : (
          <div className="py-4">
            {Object.entries(groupedMessages).map(([date, dateMessages]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="relative my-4 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800" />
                  </div>
                  <span className="relative bg-zinc-900 px-3 text-xs text-zinc-500">{date}</span>
                </div>

                {/* Messages for this date */}
                {dateMessages.map((message, index) => {
                  const prevMessage = index > 0 ? dateMessages[index - 1] : undefined;
                  const consecutive = isConsecutive(message, prevMessage);

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        'group flex gap-3 px-2 py-1 hover:bg-zinc-800/50',
                        consecutive ? 'mt-0' : 'mt-4'
                      )}
                    >
                      {/* Avatar or spacer */}
                      <div className="w-10 flex-shrink-0">
                        {!consecutive && (
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={message.sender?.avatar_url} />
                            <AvatarFallback className="bg-zinc-700 text-xs">
                              {getInitials(message.sender)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>

                      {/* Message content */}
                      <div className="min-w-0 flex-1">
                        {!consecutive && (
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium text-white">
                              {getSenderName(message.sender)}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {formatDistanceToNow(new Date(message.created_at), {
                                addSuffix: true,
                              })}
                            </span>
                            {message.is_pinned && (
                              <Pin className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap break-words text-zinc-300">
                          {message.content}
                        </p>
                      </div>

                      {/* Hover timestamp for consecutive messages */}
                      {consecutive && (
                        <span className="invisible text-xs text-zinc-500 group-hover:visible">
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="min-h-[44px] max-h-[200px] resize-none border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-500"
            rows={1}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            className="h-11 w-11 bg-amber-600 hover:bg-amber-700"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ChannelView;
