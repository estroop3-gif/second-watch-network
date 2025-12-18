import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Conversation } from '@/pages/Messages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';

interface MessageViewProps {
  conversation: Conversation;
  onBack?: () => void;
  isMobile?: boolean;
}

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_read: boolean;
};

export const MessageView = ({ conversation, onBack, isMobile }: MessageViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const markReadDebounceRef = useRef<number | null>(null);

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['messages', conversation.id],
    queryFn: async () => {
      const data = await api.listConversationMessages(conversation.id);
      return data || [];
    },
  });

  // Polling for new messages (replaces realtime subscription)
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
    }, 3000); // Poll every 3 seconds for messages

    return () => clearInterval(interval);
  }, [conversation.id, queryClient]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('User not authenticated');
      await api.sendMessage(user.id, {
        conversation_id: conversation.id,
        content,
      });
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage.trim());
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when scrolled to bottom (debounced)
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await api.markConversationRead(conversation.id, user.id);
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const handleScrollCheck = () => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (nearBottom) {
      if (markReadDebounceRef.current) window.clearTimeout(markReadDebounceRef.current);
      markReadDebounceRef.current = window.setTimeout(() => {
        markAllAsRead();
      }, 300);
    }
  };

  // Attach scroll handler
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const onScroll = () => handleScrollCheck();
    el.addEventListener('scroll', onScroll, { passive: true });
    // initial check
    handleScrollCheck();
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (markReadDebounceRef.current) window.clearTimeout(markReadDebounceRef.current);
    };
  }, [messages]);

  // Compute last outgoing message to show "Seen"
  const lastOutgoing = useMemo(() => {
    if (!messages || !user) return null;
    const mine = messages.filter(m => m.sender_id === user.id);
    return mine.length ? mine[mine.length - 1] : null;
  }, [messages, user]);

  const name = conversation.other_participant.full_name || conversation.other_participant.username || 'User';

  return (
    <div className="flex flex-col h-full bg-charcoal-black overflow-hidden">
      <div className="flex items-center p-3 border-b border-muted-gray">
        {isMobile && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <Avatar className="h-9 w-9 mr-3">
          <AvatarImage src={conversation.other_participant.avatar_url || undefined} alt={name} />
          <AvatarFallback>{name?.[0] || <User />}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="text-md font-semibold text-bone-white truncate">{name}</h2>
        </div>
      </div>
      <ScrollArea className="flex-1 no-scrollbar overflow-x-hidden" viewportRef={scrollViewportRef}>
        <div className="p-4 space-y-4">
          {isLoading && [...Array(8)].map((_, i) => (
            <div key={i} className={cn("flex items-end gap-2", i % 2 === 0 ? "justify-start" : "justify-end")}>
              {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
              <Skeleton className="h-10 w-48 rounded-lg bg-muted-gray" />
              {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
            </div>
          ))}
          {messages?.map((message) => (
            <div
              key={message.id}
              className={cn('flex items-end gap-2', message.sender_id === user?.id ? 'justify-end' : 'justify-start')}
            >
              {message.sender_id !== user?.id && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={conversation.other_participant.avatar_url || undefined} />
                  <AvatarFallback>{name?.[0] || <User />}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'p-3 rounded-lg max-w-xs lg:max-w-md break-words',
                  message.sender_id === user?.id
                    ? 'bg-accent-yellow text-charcoal-black'
                    : 'bg-muted-gray'
                )}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs text-right mt-1 opacity-70">
                  {format(new Date(message.created_at), 'p')}
                </p>
              </div>
            </div>
          ))}
          {/* Seen indicator below last outgoing */}
          {lastOutgoing && lastOutgoing.is_read && (
            <div className="text-[11px] text-muted-foreground text-right pr-2">Seen</div>
          )}
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-muted-gray">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message…"
            autoComplete="off"
            className="bg-muted-gray border-muted-gray focus:ring-accent-yellow"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sendMessageMutation.isPending} className="bg-accent-yellow hover:bg-accent-yellow/90">
            <Send className="h-4 w-4 text-charcoal-black" />
          </Button>
        </form>
      </div>
    </div>
  );
};
