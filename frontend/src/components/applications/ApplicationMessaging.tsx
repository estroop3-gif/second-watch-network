/**
 * ApplicationMessaging - Message thread component for application conversations
 */
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import {
  useApplicationMessages,
  ApplicationMessage,
} from '@/hooks/applications/useApplicationMessages';
import { formatDistanceToNow } from 'date-fns';

interface ApplicationMessagingProps {
  applicationId: string;
  applicantId: string;
  collabOwnerId: string;
  className?: string;
  /** Compact mode for embedded views */
  compact?: boolean;
}

const ApplicationMessaging: React.FC<ApplicationMessagingProps> = ({
  applicationId,
  applicantId,
  collabOwnerId,
  className,
  compact = false,
}) => {
  const { profile } = useAuth();
  const currentUserId = profile?.id;
  const isApplicant = currentUserId === applicantId;
  const isOwner = currentUserId === collabOwnerId;

  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    messages,
    isLoading,
    sendMessage,
    markAsRead,
  } = useApplicationMessages(applicationId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark messages as read when component mounts or messages load
  useEffect(() => {
    if (messages.length > 0 && (isApplicant || isOwner)) {
      const hasUnread = messages.some(
        (msg) => !msg.is_read && msg.sender_id !== currentUserId
      );
      if (hasUnread) {
        markAsRead.mutate();
      }
    }
  }, [messages, currentUserId, isApplicant, isOwner, markAsRead]);

  const handleSend = async () => {
    if (!messageText.trim()) return;

    try {
      await sendMessage.mutateAsync({ content: messageText.trim() });
      setMessageText('');
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name?: string, username?: string) => {
    const displayName = name || username || 'U';
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMessage = (message: ApplicationMessage) => {
    const isOwnMessage = message.sender_id === currentUserId;
    const sender = message.sender;

    return (
      <div
        key={message.id}
        className={cn(
          'flex gap-3 py-2',
          isOwnMessage ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={sender?.avatar_url} />
          <AvatarFallback className="bg-muted-gray/30 text-bone-white text-xs">
            {getInitials(sender?.display_name, sender?.username)}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            'flex flex-col max-w-[75%]',
            isOwnMessage ? 'items-end' : 'items-start'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-gray">
              {sender?.display_name || sender?.username || 'Unknown'}
            </span>
            <span className="text-xs text-muted-gray/60">
              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
            </span>
          </div>
          <div
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              isOwnMessage
                ? 'bg-accent-yellow/20 text-bone-white'
                : 'bg-charcoal-black/50 text-bone-white border border-muted-gray/20'
            )}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        </div>
      </div>
    );
  };

  if (!isApplicant && !isOwner) {
    return null; // Don't show messaging to unauthorized users
  }

  return (
    <div
      className={cn(
        'flex flex-col',
        compact ? 'h-[300px]' : 'h-[400px]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-muted-gray/20">
        <MessageSquare className="h-4 w-4 text-muted-gray" />
        <span className="text-sm font-medium text-bone-white">Messages</span>
        {messages.length > 0 && (
          <span className="text-xs text-muted-gray">({messages.length})</span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto py-3 space-y-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-gray" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-8 w-8 text-muted-gray/50 mb-2" />
            <p className="text-sm text-muted-gray">No messages yet</p>
            <p className="text-xs text-muted-gray/70 mt-1">
              Start the conversation
            </p>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="pt-3 border-t border-muted-gray/20">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[60px] max-h-[120px] resize-none bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray/50"
            disabled={sendMessage.isPending}
          />
          <Button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending}
            size="icon"
            className="h-[60px] w-[60px] bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-gray/60 mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ApplicationMessaging;
