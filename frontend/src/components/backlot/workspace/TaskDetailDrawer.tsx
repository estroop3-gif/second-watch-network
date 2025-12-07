/**
 * TaskDetailDrawer - Side drawer for viewing and editing task details
 * Includes description, comments, assignees, labels, due dates, and linked entities
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  X,
  Clock,
  Tag,
  User,
  MessageSquare,
  Link2,
  Trash2,
  Loader2,
  CalendarIcon,
  CheckCircle2,
  Circle,
  PlayCircle,
  PauseCircle,
  XCircle,
  Plus,
  Send,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import { useTaskDetail, useTaskComments, useTaskLabels, useProjectMembers } from '@/hooks/backlot';
import {
  BacklotTask,
  BacklotTaskStatus,
  BacklotTaskPriority,
  BacklotTaskComment,
  BacklotTaskLabel,
  BacklotProfile,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TaskUpdateInput,
} from '@/types/backlot';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskDetailDrawerProps {
  taskId: string | null;
  projectId: string;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

// =====================================================
// Status Icon Component
// =====================================================
const StatusIcon: React.FC<{ status: BacklotTaskStatus; className?: string }> = ({ status, className }) => {
  const icons: Record<BacklotTaskStatus, React.ReactNode> = {
    todo: <Circle className={cn("w-4 h-4 text-gray-400", className)} />,
    in_progress: <PlayCircle className={cn("w-4 h-4 text-blue-400", className)} />,
    review: <PauseCircle className={cn("w-4 h-4 text-amber-400", className)} />,
    completed: <CheckCircle2 className={cn("w-4 h-4 text-green-400", className)} />,
    blocked: <XCircle className={cn("w-4 h-4 text-red-400", className)} />,
  };
  return <>{icons[status]}</>;
};

// =====================================================
// Comment Component
// =====================================================
interface CommentItemProps {
  comment: BacklotTaskComment;
  canEdit: boolean;
  onUpdate: (content: string) => void;
  onDelete: () => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, canEdit, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const handleSave = () => {
    if (editContent.trim() && editContent !== comment.content) {
      onUpdate(editContent.trim());
    }
    setIsEditing(false);
  };

  return (
    <div className="flex gap-3 group">
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarImage src={comment.user_profile?.avatar_url || ''} />
        <AvatarFallback className="text-xs">
          {(comment.user_profile?.display_name || 'U').slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-bone-white">
            {comment.user_profile?.display_name || comment.user_profile?.full_name || 'Unknown'}
          </span>
          <span className="text-xs text-muted-gray">
            {formatDistanceToNow(new Date(comment.created_at))} ago
          </span>
          {comment.is_edited && (
            <span className="text-xs text-muted-gray">(edited)</span>
          )}
        </div>
        {isEditing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-gray whitespace-pre-wrap mt-1">
            {comment.content}
          </p>
        )}
      </div>
      {canEdit && !isEditing && (
        <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

// =====================================================
// Main TaskDetailDrawer Component
// =====================================================
const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  taskId,
  projectId,
  canEdit,
  open,
  onClose,
  onDelete,
}) => {
  const { task, isLoading, updateTask } = useTaskDetail(taskId);
  const { comments, createComment, updateComment, deleteComment } = useTaskComments({ taskId });
  const { labels } = useTaskLabels({ projectId });
  const { members: projectMembers } = useProjectMembers(projectId);

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState('');

  // Update local state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
    }
  }, [task]);

  const handleTitleSave = async () => {
    if (!title.trim() || title === task?.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await updateTask.mutateAsync({ title: title.trim() });
      setEditingTitle(false);
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleDescriptionSave = async () => {
    if (description === (task?.description || '')) {
      setEditingDescription(false);
      return;
    }
    try {
      await updateTask.mutateAsync({ description: description.trim() || null });
      setEditingDescription(false);
    } catch (error) {
      console.error('Error updating description:', error);
    }
  };

  const handleStatusChange = async (status: BacklotTaskStatus) => {
    try {
      await updateTask.mutateAsync({ status });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handlePriorityChange = async (priority: BacklotTaskPriority) => {
    try {
      await updateTask.mutateAsync({ priority });
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const handleDueDateChange = async (date: Date | undefined) => {
    try {
      await updateTask.mutateAsync({
        due_date: date ? format(date, 'yyyy-MM-dd') : null,
      });
    } catch (error) {
      console.error('Error updating due date:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      await createComment.mutateAsync({ content: newComment.trim() });
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    try {
      await updateComment.mutateAsync({ commentId, content });
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment.mutateAsync(commentId);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !task ? (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertTriangle className="w-12 h-12 text-muted-gray mb-4" />
            <p className="text-muted-gray">Task not found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <SheetHeader className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                {editingTitle ? (
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={e => e.key === 'Enter' && handleTitleSave()}
                    autoFocus
                    className="text-xl font-heading"
                  />
                ) : (
                  <SheetTitle
                    className={cn(
                      "text-xl font-heading text-bone-white cursor-pointer hover:text-accent-yellow",
                      task.status === 'completed' && "line-through text-muted-gray"
                    )}
                    onClick={() => canEdit && setEditingTitle(true)}
                  >
                    {task.title}
                  </SheetTitle>
                )}
              </div>

              {/* Quick Status */}
              <div className="flex items-center gap-2">
                <StatusIcon status={task.status} className="w-5 h-5" />
                <span className="text-sm text-muted-gray">
                  {TASK_STATUS_LABELS[task.status]}
                </span>
              </div>
            </SheetHeader>

            <Separator />

            {/* Properties */}
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-4">
                <Label className="w-24 text-muted-gray">Status</Label>
                <Select
                  value={task.status}
                  onValueChange={handleStatusChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TASK_STATUS_LABELS) as BacklotTaskStatus[]).map(s => (
                      <SelectItem key={s} value={s}>
                        <div className="flex items-center gap-2">
                          <StatusIcon status={s} />
                          {TASK_STATUS_LABELS[s]}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-4">
                <Label className="w-24 text-muted-gray">Priority</Label>
                <Select
                  value={task.priority}
                  onValueChange={handlePriorityChange}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TASK_PRIORITY_LABELS) as BacklotTaskPriority[]).map(p => (
                      <SelectItem key={p} value={p}>
                        {TASK_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="flex items-center gap-4">
                <Label className="w-24 text-muted-gray">Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !task.due_date && "text-muted-gray"
                      )}
                      disabled={!canEdit}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {task.due_date
                        ? format(new Date(task.due_date), 'PPP')
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={task.due_date ? new Date(task.due_date) : undefined}
                      onSelect={handleDueDateChange}
                      initialFocus
                    />
                    {task.due_date && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-red-400"
                          onClick={() => handleDueDateChange(undefined)}
                        >
                          Clear due date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Assignees */}
              <div className="flex items-start gap-4">
                <Label className="w-24 text-muted-gray pt-2">Assignees</Label>
                <div className="flex-1">
                  {task.assignees && task.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {task.assignees.map(a => (
                        <div
                          key={a.id}
                          className="flex items-center gap-2 bg-muted-gray/10 rounded-full px-2 py-1"
                        >
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={a.profile?.avatar_url || ''} />
                            <AvatarFallback className="text-[8px]">
                              {(a.profile?.display_name || 'U').slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {a.profile?.display_name || a.profile?.full_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-gray">No assignees</span>
                  )}
                </div>
              </div>

              {/* Labels */}
              <div className="flex items-start gap-4">
                <Label className="w-24 text-muted-gray pt-2">Labels</Label>
                <div className="flex-1">
                  {task.labels && task.labels.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {task.labels.map(label => (
                        <span
                          key={label.id}
                          className="text-sm px-2 py-0.5 rounded"
                          style={{ backgroundColor: `${label.color}20`, color: label.color }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-gray">No labels</span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-muted-gray">Description</Label>
                {canEdit && !editingDescription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingDescription(true)}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                )}
              </div>
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    placeholder="Add a description..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleDescriptionSave}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDescription(task.description || '');
                        setEditingDescription(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "text-sm min-h-[60px] p-3 rounded-lg bg-muted-gray/5",
                    canEdit && "cursor-pointer hover:bg-muted-gray/10",
                    !task.description && "text-muted-gray"
                  )}
                  onClick={() => canEdit && setEditingDescription(true)}
                >
                  {task.description || 'No description. Click to add one.'}
                </div>
              )}
            </div>

            {/* Linked Entities */}
            {(task.linked_scene_id || task.linked_location_id || task.linked_call_sheet_id) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-muted-gray flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Linked Items
                  </Label>
                  <div className="space-y-2">
                    {task.linked_scene && (
                      <div className="flex items-center gap-2 text-sm bg-muted-gray/10 rounded px-3 py-2">
                        <span className="text-muted-gray">Scene:</span>
                        <span className="text-bone-white">
                          {task.linked_scene.scene_number}
                        </span>
                      </div>
                    )}
                    {task.linked_location && (
                      <div className="flex items-center gap-2 text-sm bg-muted-gray/10 rounded px-3 py-2">
                        <span className="text-muted-gray">Location:</span>
                        <span className="text-bone-white">
                          {task.linked_location.name}
                        </span>
                      </div>
                    )}
                    {task.linked_call_sheet && (
                      <div className="flex items-center gap-2 text-sm bg-muted-gray/10 rounded px-3 py-2">
                        <span className="text-muted-gray">Call Sheet:</span>
                        <span className="text-bone-white">
                          {task.linked_call_sheet.title}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Comments */}
            <div className="space-y-4">
              <Label className="text-muted-gray flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments ({comments.length})
              </Label>

              {/* Comment List */}
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {comments.map(comment => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    canEdit={canEdit}
                    onUpdate={content => handleUpdateComment(comment.id, content)}
                    onDelete={() => handleDeleteComment(comment.id)}
                  />
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-muted-gray text-center py-4">
                    No comments yet
                  </p>
                )}
              </div>

              {/* Add Comment */}
              {canEdit && (
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || isSubmittingComment}
                    className="self-end bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {canEdit && onDelete && (
              <>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this task?')) {
                        onDelete();
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Task
                  </Button>
                </div>
              </>
            )}

            {/* Meta Info */}
            <div className="text-xs text-muted-gray space-y-1 pt-4 border-t border-muted-gray/20">
              <div>Created {formatDistanceToNow(new Date(task.created_at))} ago</div>
              <div>Last updated {formatDistanceToNow(new Date(task.updated_at))} ago</div>
              {task.completed_at && (
                <div>Completed {formatDistanceToNow(new Date(task.completed_at))} ago</div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default TaskDetailDrawer;
