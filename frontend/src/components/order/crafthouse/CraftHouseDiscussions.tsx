/**
 * CraftHouseDiscussions - Full discussions UI for a craft house
 * Includes topic list, thread list, and thread detail view
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import {
  useCraftHouseTopics,
  useCraftHouseThreads,
  useCraftHouseThread,
  useCraftHouseThreadMutations,
  useCraftHouseTopicMutations,
  useCraftHouseReplyMutations,
} from '@/hooks/order/useCraftHouseDiscussions';
import type {
  CraftHouseTopic,
  CraftHouseThread,
  CraftHouseReply,
  CraftHouseRole,
} from '@/lib/api/order';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageCircle,
  ArrowLeft,
  Pin,
  Lock,
  Megaphone,
  Plus,
  Loader2,
  Eye,
  Clock,
  User,
  Crown,
  Settings,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface CraftHouseDiscussionsProps {
  craftHouseId: number;
  myMembership: { role: CraftHouseRole } | null;
  isMember: boolean;
}

// Icon mapping for topics
const TOPIC_ICONS: Record<string, React.ReactNode> = {
  'message-circle': <MessageCircle className="h-5 w-5" />,
  'megaphone': <Megaphone className="h-5 w-5" />,
  'wrench': <Wrench className="h-5 w-5" />,
  'lock': <Lock className="h-5 w-5" />,
  'settings': <Settings className="h-5 w-5" />,
};

export default function CraftHouseDiscussions({
  craftHouseId,
  myMembership,
  isMember,
}: CraftHouseDiscussionsProps) {
  const { user } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<CraftHouseTopic | null>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showNewThreadDialog, setShowNewThreadDialog] = useState(false);
  const [showNewTopicDialog, setShowNewTopicDialog] = useState(false);

  const isSteward = myMembership?.role === 'steward';

  // Queries
  const { data: topicsData, isLoading: topicsLoading } = useCraftHouseTopics(craftHouseId);
  const { data: threadsData, isLoading: threadsLoading } = useCraftHouseThreads(craftHouseId, {
    topicId: selectedTopic?.id,
  });
  const { data: threadDetail, isLoading: threadLoading } = useCraftHouseThread(selectedThread);

  // Mutations
  const { createThread, togglePin, deleteThread } = useCraftHouseThreadMutations(craftHouseId);
  const { createTopic } = useCraftHouseTopicMutations(craftHouseId);
  const { createReply, deleteReply } = useCraftHouseReplyMutations(selectedThread, craftHouseId);

  const topics = topicsData?.topics || [];
  const threads = threadsData?.threads || [];

  // Filter topics based on membership
  const visibleTopics = topics.filter(
    (topic) => !topic.is_members_only || isMember
  );

  // Thread view
  if (selectedThread && threadDetail) {
    return (
      <ThreadView
        thread={threadDetail}
        onBack={() => setSelectedThread(null)}
        isMember={isMember}
        isSteward={isSteward}
        userId={user?.profile_id}
        onTogglePin={() => togglePin.mutate(selectedThread)}
        onDelete={() => {
          deleteThread.mutate(selectedThread);
          setSelectedThread(null);
        }}
        onCreateReply={(content, parentId) => {
          createReply.mutate(
            { content, parent_reply_id: parentId },
            {
              onSuccess: () => toast.success('Reply posted'),
              onError: () => toast.error('Failed to post reply'),
            }
          );
        }}
        onDeleteReply={(replyId) => {
          deleteReply.mutate(replyId, {
            onSuccess: () => toast.success('Reply deleted'),
            onError: () => toast.error('Failed to delete reply'),
          });
        }}
        isLoading={threadLoading}
        isPinning={togglePin.isPending}
      />
    );
  }

  // Main discussion view
  return (
    <div className="space-y-6">
      {/* Topics Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Button
          variant={selectedTopic === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedTopic(null)}
          className={
            selectedTopic === null
              ? 'bg-accent-yellow text-charcoal-black'
              : 'border-muted-gray text-bone-white'
          }
        >
          All Topics
        </Button>
        {visibleTopics.map((topic) => (
          <Button
            key={topic.id}
            variant={selectedTopic?.id === topic.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedTopic(topic)}
            className={
              selectedTopic?.id === topic.id
                ? 'bg-accent-yellow text-charcoal-black'
                : 'border-muted-gray text-bone-white'
            }
          >
            {TOPIC_ICONS[topic.icon || 'message-circle']}
            <span className="ml-2">{topic.name}</span>
            {topic.is_members_only && <Lock className="h-3 w-3 ml-1" />}
          </Button>
        ))}
        {isSteward && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewTopicDialog(true)}
            className="text-accent-yellow hover:text-accent-yellow/80"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Thread List */}
      <Card className="bg-charcoal-black/50 border-dashed border-muted-gray">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-heading text-bone-white">
              {selectedTopic ? selectedTopic.name : 'All Discussions'}
            </CardTitle>
            {selectedTopic?.description && (
              <CardDescription className="text-muted-gray">
                {selectedTopic.description}
              </CardDescription>
            )}
          </div>
          {isMember && (
            <Button
              onClick={() => setShowNewThreadDialog(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Thread
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {threadsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent-yellow" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No discussions yet.</p>
              {isMember && (
                <p className="text-sm mt-2">Be the first to start a conversation!</p>
              )}
              {!isMember && (
                <p className="text-sm mt-2">Join this craft house to participate in discussions.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  onClick={() => setSelectedThread(thread.id)}
                  isSteward={isSteward}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Thread Dialog */}
      <NewThreadDialog
        open={showNewThreadDialog}
        onOpenChange={setShowNewThreadDialog}
        topics={visibleTopics}
        selectedTopicId={selectedTopic?.id}
        isSteward={isSteward}
        onSubmit={(data) => {
          createThread.mutate(data, {
            onSuccess: () => {
              toast.success('Thread created');
              setShowNewThreadDialog(false);
            },
            onError: () => toast.error('Failed to create thread'),
          });
        }}
        isSubmitting={createThread.isPending}
      />

      {/* New Topic Dialog (Steward only) */}
      <NewTopicDialog
        open={showNewTopicDialog}
        onOpenChange={setShowNewTopicDialog}
        onSubmit={(data) => {
          createTopic.mutate(data, {
            onSuccess: () => {
              toast.success('Topic created');
              setShowNewTopicDialog(false);
            },
            onError: () => toast.error('Failed to create topic'),
          });
        }}
        isSubmitting={createTopic.isPending}
      />
    </div>
  );
}

// Thread Card Component
function ThreadCard({
  thread,
  onClick,
  isSteward,
}: {
  thread: CraftHouseThread;
  onClick: () => void;
  isSteward: boolean;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className="p-4 rounded-lg border border-muted-gray hover:border-accent-yellow/50 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-4">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="bg-muted-gray/30 text-bone-white">
            {thread.user_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {thread.is_pinned && (
              <Pin className="h-4 w-4 text-accent-yellow" />
            )}
            {thread.is_announcement && (
              <Badge className="bg-primary-red text-bone-white">
                <Megaphone className="h-3 w-3 mr-1" />
                Announcement
              </Badge>
            )}
            {thread.is_locked && (
              <Lock className="h-4 w-4 text-muted-gray" />
            )}
            <h3 className="font-heading text-bone-white truncate">
              {thread.title}
            </h3>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-gray">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {thread.user_name || 'Unknown'}
              {thread.user_role === 'steward' && (
                <Crown className="h-3 w-3 text-accent-yellow" />
              )}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {thread.reply_count}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {thread.view_count}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(thread.last_activity_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Thread Detail View
function ThreadView({
  thread,
  onBack,
  isMember,
  isSteward,
  userId,
  onTogglePin,
  onDelete,
  onCreateReply,
  onDeleteReply,
  isLoading,
  isPinning,
}: {
  thread: any;
  onBack: () => void;
  isMember: boolean;
  isSteward: boolean;
  userId?: string;
  onTogglePin: () => void;
  onDelete: () => void;
  onCreateReply: (content: string, parentId?: string) => void;
  onDeleteReply: (replyId: string) => void;
  isLoading: boolean;
  isPinning: boolean;
}) {
  const [replyContent, setReplyContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleSubmitReply = () => {
    if (!replyContent.trim()) return;
    onCreateReply(replyContent, replyingTo || undefined);
    setReplyContent('');
    setReplyingTo(null);
  };

  const isAuthor = thread.user_id === userId;
  const canModify = isAuthor || isSteward;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={onBack}
        className="text-bone-white hover:text-accent-yellow"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Discussions
      </Button>

      {/* Thread content */}
      <Card className="bg-charcoal-black/50 border-dashed border-muted-gray">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {thread.is_pinned && (
                  <Badge className="bg-accent-yellow text-charcoal-black">
                    <Pin className="h-3 w-3 mr-1" />
                    Pinned
                  </Badge>
                )}
                {thread.is_announcement && (
                  <Badge className="bg-primary-red text-bone-white">
                    <Megaphone className="h-3 w-3 mr-1" />
                    Announcement
                  </Badge>
                )}
                {thread.is_locked && (
                  <Badge variant="outline" className="border-muted-gray text-muted-gray">
                    <Lock className="h-3 w-3 mr-1" />
                    Locked
                  </Badge>
                )}
              </div>
              <CardTitle className="font-spray text-accent-yellow text-2xl">
                {thread.title}
              </CardTitle>
            </div>
            {isSteward && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTogglePin}
                  disabled={isPinning}
                  className="border-muted-gray text-bone-white"
                >
                  <Pin className={`h-4 w-4 ${thread.is_pinned ? 'text-accent-yellow' : ''}`} />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Avatar>
              <AvatarFallback className="bg-muted-gray/30 text-bone-white">
                {thread.user_name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-bone-white">{thread.user_name}</span>
                {thread.user_role === 'steward' && (
                  <Badge className="bg-accent-yellow text-charcoal-black">
                    <Crown className="h-3 w-3 mr-1" />
                    Steward
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-gray">
                {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none">
            <p className="text-bone-white whitespace-pre-wrap">{thread.content}</p>
          </div>
        </CardContent>
      </Card>

      {/* Replies */}
      <Card className="bg-charcoal-black/50 border-dashed border-muted-gray">
        <CardHeader>
          <CardTitle className="font-heading text-bone-white">
            Replies ({thread.replies?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {thread.replies?.length === 0 ? (
            <p className="text-center text-muted-gray py-4">
              No replies yet. Be the first to respond!
            </p>
          ) : (
            thread.replies?.map((reply: CraftHouseReply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                canDelete={reply.user_id === userId || isSteward}
                onDelete={() => onDeleteReply(reply.id)}
                onReply={() => setReplyingTo(reply.id)}
              />
            ))
          )}

          {/* Reply form */}
          {isMember && !thread.is_locked && (
            <div className="pt-4 border-t border-muted-gray">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-gray">
                  <span>Replying to a comment</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyingTo(null)}
                    className="h-6 px-2"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="bg-charcoal-black border-muted-gray text-bone-white min-h-[100px]"
              />
              <div className="flex justify-end mt-2">
                <Button
                  onClick={handleSubmitReply}
                  disabled={!replyContent.trim()}
                  className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                >
                  Post Reply
                </Button>
              </div>
            </div>
          )}

          {thread.is_locked && (
            <div className="text-center py-4 text-muted-gray">
              <Lock className="h-6 w-6 mx-auto mb-2" />
              <p>This thread is locked. No new replies can be added.</p>
            </div>
          )}

          {!isMember && (
            <div className="text-center py-4 text-muted-gray">
              <p>Join this craft house to reply to discussions.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Reply Card
function ReplyCard({
  reply,
  canDelete,
  onDelete,
  onReply,
}: {
  reply: CraftHouseReply;
  canDelete: boolean;
  onDelete: () => void;
  onReply: () => void;
}) {
  return (
    <div
      className={`p-4 rounded-lg border border-muted-gray ${
        reply.parent_reply_id ? 'ml-8 border-dashed' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-muted-gray/30 text-bone-white text-sm">
            {reply.user_name?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-bone-white">{reply.user_name}</span>
            {reply.user_role === 'steward' && (
              <Crown className="h-3 w-3 text-accent-yellow" />
            )}
            <span className="text-xs text-muted-gray">
              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
            </span>
            {reply.is_edited && (
              <span className="text-xs text-muted-gray">(edited)</span>
            )}
          </div>
          <p className="text-bone-white whitespace-pre-wrap">{reply.content}</p>
          <div className="flex gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onReply}
              className="text-muted-gray hover:text-bone-white h-6 px-2"
            >
              Reply
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-muted-gray hover:text-primary-red h-6 px-2"
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// New Thread Dialog
function NewThreadDialog({
  open,
  onOpenChange,
  topics,
  selectedTopicId,
  isSteward,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topics: CraftHouseTopic[];
  selectedTopicId?: string;
  isSteward: boolean;
  onSubmit: (data: { topic_id: string; title: string; content: string; is_announcement?: boolean }) => void;
  isSubmitting: boolean;
}) {
  const [topicId, setTopicId] = useState(selectedTopicId || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);

  const handleSubmit = () => {
    if (!topicId || !title.trim() || !content.trim()) return;
    onSubmit({
      topic_id: topicId,
      title: title.trim(),
      content: content.trim(),
      is_announcement: isSteward && isAnnouncement,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray">
        <DialogHeader>
          <DialogTitle className="font-spray text-accent-yellow">New Thread</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Start a new discussion in this craft house.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-bone-white">Topic</Label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full mt-1 p-2 rounded-md bg-charcoal-black border border-muted-gray text-bone-white"
            >
              <option value="">Select a topic...</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-bone-white">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Thread title..."
              className="bg-charcoal-black border-muted-gray text-bone-white"
            />
          </div>
          <div>
            <Label className="text-bone-white">Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What would you like to discuss?"
              className="bg-charcoal-black border-muted-gray text-bone-white min-h-[150px]"
            />
          </div>
          {isSteward && (
            <div className="flex items-center gap-2">
              <Switch
                checked={isAnnouncement}
                onCheckedChange={setIsAnnouncement}
              />
              <Label className="text-bone-white">Mark as announcement</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-gray text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!topicId || !title.trim() || !content.trim() || isSubmitting}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Thread
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// New Topic Dialog (Steward only)
function NewTopicDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string; is_members_only?: boolean }) => void;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isMembersOnly, setIsMembersOnly] = useState(false);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      is_members_only: isMembersOnly,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray">
        <DialogHeader>
          <DialogTitle className="font-spray text-accent-yellow">New Topic</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Create a new discussion topic for this craft house.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-bone-white">Topic Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lighting Techniques"
              className="bg-charcoal-black border-muted-gray text-bone-white"
            />
          </div>
          <div>
            <Label className="text-bone-white">Description (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this topic about?"
              className="bg-charcoal-black border-muted-gray text-bone-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={isMembersOnly}
              onCheckedChange={setIsMembersOnly}
            />
            <Label className="text-bone-white">Members only</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-gray text-bone-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Topic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
