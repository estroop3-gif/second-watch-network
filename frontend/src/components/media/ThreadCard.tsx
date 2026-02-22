import { Link } from 'react-router-dom';
import { MessageSquare, Pin, Lock, CheckCircle, Eye } from 'lucide-react';

interface ThreadCardProps {
  thread: any;
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ThreadCard = ({ thread }: ThreadCardProps) => {
  return (
    <Link to={`/media/discussions/${thread.id}`}>
      <div className="p-4 rounded-lg border border-muted-gray/30 bg-charcoal-black hover:bg-muted-gray/10 transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.is_pinned && (
                <Pin className="h-3 w-3 text-accent-yellow flex-shrink-0" />
              )}
              <h3 className="text-sm font-medium text-bone-white line-clamp-1">
                {thread.title}
              </h3>
              {thread.is_locked && (
                <Lock className="h-3 w-3 text-red-400 flex-shrink-0" />
              )}
              {thread.is_resolved && (
                <CheckCircle className="h-3 w-3 text-green-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-gray mt-1 line-clamp-2">
              {thread.content}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-gray">
              <span>{thread.author_name}</span>
              <span className="text-muted-gray/50">in</span>
              <span className="text-accent-yellow/70">{thread.category_name}</span>
              <span>{formatRelative(thread.last_activity_at || thread.created_at)}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="flex items-center gap-1 text-xs text-muted-gray">
              <MessageSquare className="h-3 w-3" />
              {thread.reply_count}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-gray/70">
              <Eye className="h-3 w-3" />
              {thread.view_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ThreadCard;
