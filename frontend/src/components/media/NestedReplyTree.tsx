import { useState } from 'react';
import { CornerDownRight, Edit2, Trash2, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReplyInput from './ReplyInput';

interface Reply {
  id: string;
  thread_id: string;
  author_id: string;
  author_name: string;
  content: string;
  parent_reply_id: string | null;
  is_edited: boolean;
  created_at: string;
}

interface NestedReplyTreeProps {
  replies: Reply[];
  currentUserId: string;
  isTeam: boolean;
  isLocked: boolean;
  onReply: (content: string, parentReplyId?: string) => void;
  onEdit: (replyId: string, content: string) => void;
  onDelete: (replyId: string) => void;
}

function buildTree(replies: Reply[]): Map<string | null, Reply[]> {
  const map = new Map<string | null, Reply[]>();
  for (const r of replies) {
    const key = r.parent_reply_id || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function formatTime(dateStr: string): string {
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

const MAX_DEPTH = 3;

function ReplyNode({
  reply,
  childMap,
  depth,
  currentUserId,
  isTeam,
  isLocked,
  onReply,
  onEdit,
  onDelete,
}: {
  reply: Reply;
  childMap: Map<string | null, Reply[]>;
  depth: number;
  currentUserId: string;
  isTeam: boolean;
  isLocked: boolean;
  onReply: (content: string, parentReplyId?: string) => void;
  onEdit: (replyId: string, content: string) => void;
  onDelete: (replyId: string) => void;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const children = childMap.get(reply.id) || [];
  const isAuthor = reply.author_id === currentUserId;
  const canEdit = isAuthor || isTeam;
  const canReply = !isLocked && depth < MAX_DEPTH;
  const visualDepth = Math.min(depth, MAX_DEPTH);

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    onEdit(reply.id, editContent.trim());
    setEditing(false);
  };

  return (
    <div className={`${visualDepth > 0 ? 'ml-6 border-l border-muted-gray/20 pl-4' : ''}`}>
      <div className="py-2 group">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-bone-white">{reply.author_name}</span>
          <span className="text-muted-gray">{formatTime(reply.created_at)}</span>
          {reply.is_edited && <span className="text-muted-gray/60 italic">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} className="bg-accent-yellow text-charcoal-black text-xs h-7">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-xs h-7">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-bone-white/80 mt-0.5 whitespace-pre-wrap">{reply.content}</p>
        )}

        {!editing && (
          <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canReply && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="flex items-center gap-1 text-xs text-muted-gray hover:text-accent-yellow"
              >
                <Reply className="h-3 w-3" /> Reply
              </button>
            )}
            {canEdit && (
              <>
                <button
                  onClick={() => { setEditing(true); setEditContent(reply.content); }}
                  className="flex items-center gap-1 text-xs text-muted-gray hover:text-accent-yellow"
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => onDelete(reply.id)}
                  className="flex items-center gap-1 text-xs text-muted-gray hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </>
            )}
          </div>
        )}

        {showReplyInput && (
          <div className="mt-2 ml-2">
            <ReplyInput
              onSubmit={(content) => {
                onReply(content, reply.id);
                setShowReplyInput(false);
              }}
              placeholder={`Reply to ${reply.author_name}...`}
              compact
            />
          </div>
        )}
      </div>

      {children.map(child => (
        <ReplyNode
          key={child.id}
          reply={child}
          childMap={childMap}
          depth={depth + 1}
          currentUserId={currentUserId}
          isTeam={isTeam}
          isLocked={isLocked}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

const NestedReplyTree = ({
  replies,
  currentUserId,
  isTeam,
  isLocked,
  onReply,
  onEdit,
  onDelete,
}: NestedReplyTreeProps) => {
  const childMap = buildTree(replies);
  const topLevel = childMap.get(null) || [];

  if (topLevel.length === 0) {
    return <p className="text-xs text-muted-gray py-4 text-center">No replies yet. Be the first to respond.</p>;
  }

  return (
    <div className="space-y-1">
      {topLevel.map(reply => (
        <ReplyNode
          key={reply.id}
          reply={reply}
          childMap={childMap}
          depth={0}
          currentUserId={currentUserId}
          isTeam={isTeam}
          isLocked={isLocked}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default NestedReplyTree;
