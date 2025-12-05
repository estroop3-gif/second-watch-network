import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ForumReply } from '@/types';

interface ReplyCardProps {
  reply: ForumReply;
}

const getRoleBadge = (roles: string[] | undefined | null) => {
  if (!roles) return null;
  if (roles.includes('admin')) return <Badge className="bg-red-500 text-white">Admin</Badge>;
  if (roles.includes('filmmaker')) return <Badge variant="secondary">Filmmaker</Badge>;
  return null;
};

export const ReplyCard = ({ reply }: ReplyCardProps) => {
  const authorProfileLink = reply.username ? `/profile/${reply.username}` : '#';
  const nameToDisplay = reply.display_name || reply.full_name || reply.username || 'Unknown User';

  return (
    <Card className="p-4 sm:p-6 bg-muted-gray/10 border-muted-gray/20">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <Link to={authorProfileLink}>
            <Avatar>
              <AvatarImage src={reply.avatar_url || undefined} alt={reply.username || ''} />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
          </Link>
        </div>
        <div className="flex-grow">
          <div className="flex items-center flex-wrap gap-2 text-sm text-muted-gray mb-2">
            <Link to={authorProfileLink} className="hover:underline font-semibold text-bone-white">{nameToDisplay}</Link>
            {getRoleBadge(reply.roles)}
            <span>·</span>
            <span>{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
          </div>
          <div className="prose prose-invert max-w-none prose-p:text-bone-white">
            <p>{reply.body}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};