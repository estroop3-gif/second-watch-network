import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

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
  const { profileId, profile } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['submission-messages', submissionId],
    queryFn: async () => {
      const data = await api.listSubmissionMessages(submissionId);
      return data as Message[];
    },
  });

  // Polling for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['submission-messages', submissionId] });
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [submissionId, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!profileId) throw new Error("Not authenticated");
      return await api.createSubmissionMessage(submissionId, profileId, content);
    },
    onSuccess: (newMsg) => {
      queryClient.setQueryData(['submission-messages', submissionId], (old: Message[] | undefined) => {
        return [...(old || []), newMsg];
      });
      setNewMessage('');
    },
    onError: (error: any) => {
      toast.error('Failed to send message: ' + error.message);
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profileId) return;

    sendMutation.mutate(newMessage);
  };

  if (isLoading) {
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
          const isSender = message.sender_id === profileId;
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
        <Button type="submit" size="icon" disabled={!newMessage.trim() || sendMutation.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default SubmissionMessaging;
