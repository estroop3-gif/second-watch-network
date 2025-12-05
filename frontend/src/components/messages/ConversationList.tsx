import { Conversation } from '@/pages/Messages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { User } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  isLoading: boolean;
}

export const ConversationList = ({ conversations, selectedConversationId, onSelectConversation, isLoading }: ConversationListProps) => {
  if (isLoading) {
    return (
      <div className="p-2 space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return <div className="p-4 text-center text-muted-foreground h-full flex items-center justify-center">No conversations yet.</div>;
  }

  return (
    <ScrollArea className="h-full no-scrollbar overflow-x-hidden">
      <div className="flex flex-col gap-1 p-2">
        {conversations.map((convo) => {
          const name = convo.other_participant.full_name || convo.other_participant.username || 'User';
          return (
            <button
              key={convo.id}
              onClick={() => onSelectConversation(convo.id)}
              className={cn(
                'flex items-center gap-3 p-2 rounded-md text-left transition-colors w-full overflow-hidden',
                selectedConversationId === convo.id ? 'bg-muted-gray' : 'hover:bg-muted-gray/50'
              )}
            >
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarImage src={convo.other_participant.avatar_url || undefined} alt={name} />
                <AvatarFallback>{name?.[0] || <User />}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                  <p className="font-semibold truncate text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex justify-between items-start mt-1">
                  <p className="text-xs text-muted-foreground truncate">
                    {convo.last_message?.content || 'No messages yet'}
                  </p>
                  {convo.unread_count > 0 && (
                    <span className="bg-accent-yellow text-charcoal-black text-xs font-bold rounded-full px-1.5 py-0.5 ml-2">
                      {convo.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
};