/**
 * MessagesWidget
 * Shows recent message conversations
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { WidgetSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { MessageSquare, ChevronRight } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

export function MessagesWidget({ className = '' }: SectionProps) {
  const { user } = useAuth();

  const { data: conversations, isLoading, error } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => api.listConversations(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return <WidgetSkeleton className={className} />;
  }

  if (error) {
    return null;
  }

  const recentConversations = conversations?.slice(0, 3) || [];
  const unreadCount = recentConversations.filter((c: any) => c.unread_count > 0).length;

  return (
    <div className={`p-4 bg-charcoal-black border border-muted-gray/20 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-muted-gray" />
          <h3 className="font-heading text-bone-white">Messages</h3>
          {unreadCount > 0 && (
            <Badge variant="default" className="bg-primary-red text-white text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/messages">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {recentConversations.length === 0 ? (
        <p className="text-muted-gray text-sm text-center py-4">No conversations yet</p>
      ) : (
        <div className="space-y-2">
          {recentConversations.map((conv: any) => {
            const otherParticipant = conv.other_participant || {};
            const initials = (otherParticipant.display_name || 'U')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2);

            return (
              <Link
                key={conv.id}
                to={`/messages?open=${conv.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted-gray/10 transition-colors group"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={otherParticipant.avatar_url} />
                  <AvatarFallback className="bg-muted-gray/20 text-bone-white text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-bone-white text-sm line-clamp-1">
                      {otherParticipant.display_name || 'Unknown'}
                    </span>
                    <span className="text-muted-gray text-xs">
                      {formatTimeAgo(conv.updated_at)}
                    </span>
                  </div>
                  <p className="text-muted-gray text-xs line-clamp-1">
                    {conv.last_message || 'No messages yet'}
                  </p>
                </div>
                {conv.unread_count > 0 && (
                  <Badge variant="default" className="bg-primary-red text-white text-xs h-5 min-w-5 flex items-center justify-center">
                    {conv.unread_count}
                  </Badge>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MessagesWidget;
