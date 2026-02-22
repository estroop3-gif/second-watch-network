import { useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { useRequestComments, useCreateRequestComment } from '@/hooks/media';
import { useToast } from '@/hooks/use-toast';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface RequestCommentsProps {
  requestId: string;
  isMediaTeam: boolean;
}

const RequestComments = ({ requestId, isMediaTeam }: RequestCommentsProps) => {
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const { data: comments, isLoading } = useRequestComments(requestId);
  const createComment = useCreateRequestComment();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    createComment.mutate(
      { requestId, body: body.trim(), is_internal: isInternal },
      {
        onSuccess: () => {
          setBody('');
          setIsInternal(false);
          toast({ title: 'Comment added' });
        },
        onError: () => {
          toast({ title: 'Failed to add comment', variant: 'destructive' });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Loading comments...
      </div>
    );
  }

  const visibleComments = (comments || []).filter(
    (c: any) => !c.is_internal || isMediaTeam
  );

  return (
    <div className="space-y-4">
      {/* Comment list */}
      {visibleComments.length === 0 ? (
        <div className="text-center py-6 text-muted-gray text-sm">
          No comments yet. Start the conversation below.
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {visibleComments.map((comment: any) => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg border ${
                comment.is_internal
                  ? 'bg-yellow-900/10 border-yellow-700/30'
                  : 'bg-charcoal-black/50 border-muted-gray/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-bone-white">
                    {comment.author_name || 'Unknown'}
                  </span>
                  {comment.is_internal && (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                      <Lock className="h-3 w-3" />
                      Internal
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-gray whitespace-nowrap">
                  {formatRelativeTime(comment.created_at)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-bone-white/80 whitespace-pre-wrap">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="space-y-3 border-t border-muted-gray/20 pt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="w-full bg-charcoal-black border border-muted-gray/30 rounded-lg px-3 py-2 text-sm text-bone-white placeholder:text-muted-gray focus:outline-none focus:ring-1 focus:ring-accent-yellow/50 resize-none"
        />

        <div className="flex items-center justify-between">
          <div>
            {isMediaTeam && (
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="w-4 h-4 rounded border-muted-gray/50 bg-charcoal-black accent-accent-yellow"
                />
                <span className="text-xs text-muted-gray flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Internal note
                </span>
              </label>
            )}
          </div>

          <button
            type="submit"
            disabled={!body.trim() || createComment.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent-yellow text-charcoal-black text-sm font-medium rounded-lg hover:bg-accent-yellow/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {createComment.isPending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RequestComments;
