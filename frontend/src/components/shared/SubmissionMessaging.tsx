import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '../ui/skeleton';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  profiles: {
    avatar_url: string | null;
    full_name: string | null;
    username: string | null;
  } | null;
}

interface SubmissionMessagingProps {
  submissionId: string;
  submissionUserId: string;
}

const SubmissionMessaging = ({ submissionId, submissionUserId }: SubmissionMessagingProps) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('submission_messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          profiles (avatar_url, full_name, username)
        `)
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true });

      if (error) {
        toast.error('Failed to load messages.');
        console.error(error);
      } else {
        setMessages(data as any);
      }
      setLoading(false);
    };

    fetchMessages();
  }, [submissionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`submission-messages-${submissionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submission_messages',
          filter: `submission_id=eq.${submissionId}`,
        },
        async (payload) => {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('avatar_url, full_name, username')
            .eq('id', payload.new.sender_id)
            .single();
          
          if (error) {
            console.error("Error fetching profile for new message", error);
            setMessages((prev) => [...prev, payload.new as Message]);
          } else {
            const newMessageWithProfile = {
              ...payload.new,
              profiles: profileData,
            };
            setMessages((prev) => [...prev, newMessageWithProfile as Message]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [submissionId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageContent = newMessage;
    setNewMessage('');

    const { error } = await supabase.from('submission_messages').insert({
      submission_id: submissionId,
      sender_id: user.id,
      content: messageContent,
    });

    if (error) {
      toast.error('Failed to send message.');
      setNewMessage(messageContent); // Restore message on failure
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-3/4" />
        <Skeleton className="h-16 w-3/4 ml-auto" />
        <Skeleton className="h-16 w-3/4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isSender = message.sender_id === user?.id;
          return (
            <div key={message.id} className={`flex items-end gap-2 ${isSender ? 'justify-end' : 'justify-start'}`}>
              {!isSender && (
                <img
                  src={message.profiles?.avatar_url || '/placeholder.svg'}
                  alt={message.profiles?.full_name || 'Avatar'}
                  className="h-8 w-8 rounded-full"
                />
              )}
              <div className={`rounded-lg px-4 py-2 max-w-sm ${isSender ? 'bg-accent-yellow text-charcoal-black' : 'bg-muted-gray'}`}>
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1 text-right">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </p>
              </div>
              {isSender && (
                <img
                  src={profile?.avatar_url || '/placeholder.svg'}
                  alt={profile?.full_name || 'Avatar'}
                  className="h-8 w-8 rounded-full"
                />
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="p-4 border-t border-muted-gray/20 flex items-center gap-2">
        <Textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-grow resize-none"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default SubmissionMessaging;