import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { MessageSquare, User, Pin, ShieldQuestion } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ForumThread } from '@/types';

interface ThreadCardProps {
  thread: ForumThread;
}

const getRoleBadge = (roles: string[] | undefined | null) => {
  if (!roles) return null;
  if (roles.includes('admin')) return <Badge className="bg-red-500 text-white">Admin</Badge>;
  if (roles.includes('filmmaker')) return <Badge variant="secondary">Filmmaker</Badge>;
  return null;
};

export const ThreadCard = ({ thread }: ThreadCardProps) => {
  const replyCount = thread.replies_count || 0;
  
  const isAnonymous = thread.is_anonymous;
  const authorProfileLink = !isAnonymous && thread.username ? `/profile/${thread.username}` : '#';
  const isAuthorClickable = !isAnonymous && !!thread.username;

  const nameToDisplay = isAnonymous 
    ? 'Anonymous' 
    : thread.display_name || thread.full_name || thread.username || 'Unknown User';

  return (
    <Card className="p-6 bg-muted-gray/10 border-muted-gray/20 hover:bg-muted-gray/20 transition-colors">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-shrink-0">
          {isAuthorClickable ? (
            <Link to={authorProfileLink}>
              <Avatar>
                <AvatarImage src={thread.avatar_url || undefined} alt={thread.username || ''} />
                <AvatarFallback><User /></AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar>
              {isAnonymous ? (
                <AvatarFallback><ShieldQuestion /></AvatarFallback>
              ) : (
                <>
                  <AvatarImage src={thread.avatar_url || undefined} alt={thread.username || ''} />
                  <AvatarFallback><User /></AvatarFallback>
                </>
              )}
            </Avatar>
          )}
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-1">
            {thread.is_pinned && <Pin className="h-4 w-4 text-accent-yellow" />}
            <Link to={`/the-backlot/threads/${thread.id}`} className="group">
              <h3 className="font-bold text-lg text-bone-white group-hover:text-accent-yellow transition-colors">{thread.title}</h3>
            </Link>
          </div>
          <div className="flex items-center flex-wrap gap-2 text-sm text-muted-gray mb-3">
            {isAuthorClickable ? (
              <Link to={authorProfileLink} className="hover:underline font-semibold">{nameToDisplay}</Link>
            ) : (
              <span className="font-semibold">{nameToDisplay}</span>
            )}
            {!isAnonymous && getRoleBadge(thread.roles)}
            <span>·</span>
            <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {thread.category_name && <Badge variant="outline">{thread.category_name}</Badge>}
            {thread.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          </div>
        </div>
        <div className="flex-shrink-0 flex sm:flex-col items-end justify-between sm:justify-center text-muted-gray text-sm mt-2 sm:mt-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>{replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}</span>
          </div>
          <span className="mt-auto pt-2">Last reply {formatDistanceToNow(new Date(thread.last_reply_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Card>
  );
};