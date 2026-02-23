/**
 * TaskDetailDrawer - Side drawer for viewing and editing task details
 * Includes description, comments, assignees, labels, due dates, and linked entities
 */
import React, { useState, useEffect, useRef } from 'react';
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
  Search,
} from 'lucide-react';
import { useTaskDetail, useTaskComments, useTaskLabels, useProjectMembers, useTaskAssignees, useTaskLabelLinks } from '@/hooks/backlot';
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
import { parseLocalDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage, buildDraftKey } from '@/lib/formDraftStorage';

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
    todo: <Circle className={cn("w-4 h-4 text-gray-500", className)} />,
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
// Predefined label colors
// =====================================================
const LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

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
  const { toast } = useToast();
  const { task, isLoading, updateTask } = useTaskDetail(taskId);
  const { comments, createComment, updateComment, deleteComment } = useTaskComments({ taskId });
  const { labels, createLabel, isLoading: labelsLoading } = useTaskLabels({ projectId });
  const { members: projectMembers } = useProjectMembers(projectId);
  const { addAssignee, removeAssignee } = useTaskAssignees(taskId);
  const { addLabel, removeLabel } = useTaskLabelLinks(taskId);

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [description, setDescription] = useState('');
  const [showAssigneePopover, setShowAssigneePopover] = useState(false);
  const [showLabelPopover, setShowLabelPopover] = useState(false);

  // Label search and creation state
  const [labelSearch, setLabelSearch] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  // Update local state when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
    }
  }, [task]);

  // --- Draft persistence for unsaved edits ---
  const taskDraftKey = buildDraftKey('backlot', 'task-detail', taskId || 'none');
  const taskDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft on mount / task change
  useEffect(() => {
    if (!taskId) return;
    const draft = loadDraft<{ newComment?: string; editingTitle?: string; editingDescription?: string }>(taskDraftKey);
    if (!draft) return;
    const d = draft.data;
    if (d.newComment) setNewComment(d.newComment);
    if (d.editingTitle) {
      setTitle(d.editingTitle);
      setEditingTitle(true);
    }
    if (d.editingDescription) {
      setDescription(d.editingDescription);
      setEditingDescription(true);
    }
    toast({ title: 'Draft restored', description: 'Your unsaved task edits have been restored.' });
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save when comment, title (editing), or description (editing) changes
  useEffect(() => {
    if (!taskId) return;
    const draftData: Record<string, string> = {};
    if (newComment.trim()) draftData.newComment = newComment;
    if (editingTitle && title !== task?.title) draftData.editingTitle = title;
    if (editingDescription && description !== (task?.description || '')) draftData.editingDescription = description;

    // Nothing to persist — clear any existing draft
    if (Object.keys(draftData).length === 0) {
      clearDraftStorage(taskDraftKey);
      return;
    }

    if (taskDraftTimerRef.current) clearTimeout(taskDraftTimerRef.current);
    taskDraftTimerRef.current = setTimeout(() => {
      saveDraft(taskDraftKey, draftData);
    }, 500);
    return () => { if (taskDraftTimerRef.current) clearTimeout(taskDraftTimerRef.current); };
  }, [newComment, title, description, editingTitle, editingDescription, taskId, taskDraftKey, task?.title, task?.description]);

  const handleTitleSave = async () => {
    if (!title.trim() || title === task?.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await updateTask.mutateAsync({ title: title.trim() });
      setEditingTitle(false);
      clearDraftStorage(taskDraftKey);
    } catch (error) {
      console.error('Error updating title:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task title',
        variant: 'destructive',
      });
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
      clearDraftStorage(taskDraftKey);
    } catch (error) {
      console.error('Error updating description:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task description',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (status: BacklotTaskStatus) => {
    try {
      await updateTask.mutateAsync({ status });
      toast({
        title: 'Updated',
        description: `Task status changed to ${TASK_STATUS_LABELS[status]}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive',
      });
    }
  };

  const handlePriorityChange = async (priority: BacklotTaskPriority) => {
    try {
      await updateTask.mutateAsync({ priority });
      toast({
        title: 'Updated',
        description: `Priority changed to ${TASK_PRIORITY_LABELS[priority]}`,
      });
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task priority',
        variant: 'destructive',
      });
    }
  };

  const handleDueDateChange = async (date: Date | undefined) => {
    try {
      await updateTask.mutateAsync({
        due_date: date ? format(date, 'yyyy-MM-dd') : null,
      });
    } catch (error) {
      console.error('Error updating due date:', error);
      toast({
        title: 'Error',
        description: 'Failed to update due date',
        variant: 'destructive',
      });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setIsSubmittingComment(true);
    try {
      await createComment.mutateAsync({ content: newComment.trim() });
      setNewComment('');
      clearDraftStorage(taskDraftKey);
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    try {
      await updateComment.mutateAsync({ commentId, content });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update comment',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await deleteComment.mutateAsync(commentId);
      toast({
        title: 'Deleted',
        description: 'Comment removed',
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
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
                        ? format(parseLocalDate(task.due_date), 'PPP')
                        : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={task.due_date ? parseLocalDate(task.due_date) : undefined}
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
                  <div className="flex flex-wrap gap-2 items-center">
                    {task.assignees && task.assignees.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-1 bg-muted-gray/10 rounded-full px-2 py-1 group"
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
                        {canEdit && (
                          <button
                            onClick={() => removeAssignee.mutate(a.id, {
                              onError: () => {
                                toast({
                                  title: 'Error',
                                  description: 'Failed to remove assignee',
                                  variant: 'destructive',
                                });
                              }
                            })}
                            className="opacity-0 group-hover:opacity-100 ml-1 text-muted-gray hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {canEdit && (
                      <Popover open={showAssigneePopover} onOpenChange={setShowAssigneePopover}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 px-2">
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {projectMembers?.filter(m =>
                              !task.assignees?.some(a => a.user_id === m.user_id)
                            ).map(member => {
                              const displayName = member.user_name || member.user_username || member.email?.split('@')[0] || 'Unknown';
                              return (
                              <button
                                key={member.user_id}
                                onClick={() => {
                                  addAssignee.mutate(member.user_id, {
                                    onSuccess: () => {
                                      toast({
                                        title: 'Added',
                                        description: `${displayName} assigned to task`,
                                      });
                                    },
                                    onError: () => {
                                      toast({
                                        title: 'Error',
                                        description: 'Failed to add assignee',
                                        variant: 'destructive',
                                      });
                                    },
                                  });
                                  setShowAssigneePopover(false);
                                }}
                                className="flex items-center gap-2 w-full p-2 rounded hover:bg-muted-gray/10 text-left"
                              >
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={member.user_avatar || ''} />
                                  <AvatarFallback className="text-[10px]">
                                    {displayName.slice(0, 1).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">
                                  {displayName}
                                </span>
                              </button>
                              );
                            })}
                            {(!projectMembers || projectMembers.filter(m =>
                              !task.assignees?.some(a => a.user_id === m.user_id)
                            ).length === 0) && (
                              <p className="text-sm text-muted-gray p-2">No more members to add</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {(!task.assignees || task.assignees.length === 0) && !canEdit && (
                    <span className="text-sm text-muted-gray">No assignees</span>
                  )}
                </div>
              </div>

              {/* Labels */}
              <div className="flex items-start gap-4">
                <Label className="w-24 text-muted-gray pt-2">Labels</Label>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    {task.labels && task.labels.map(labelLink => (
                      <span
                        key={labelLink.id}
                        className="text-sm px-2 py-0.5 rounded flex items-center gap-1 group"
                        style={{ backgroundColor: `${labelLink.color}20`, color: labelLink.color }}
                      >
                        {labelLink.name}
                        {canEdit && (
                          <button
                            onClick={() => removeLabel.mutate(labelLink.id, {
                              onError: () => {
                                toast({
                                  title: 'Error',
                                  description: 'Failed to remove label',
                                  variant: 'destructive',
                                });
                              }
                            })}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {canEdit && (
                      <Popover
                        open={showLabelPopover}
                        onOpenChange={(open) => {
                          setShowLabelPopover(open);
                          if (!open) {
                            setLabelSearch('');
                            setIsCreatingLabel(false);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 px-2">
                            <Plus className="w-3 h-3 mr-1" />
                            Add
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="start">
                          <div className="p-2 border-b">
                            <div className="relative">
                              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                              <Input
                                placeholder="Search or create labels..."
                                value={labelSearch}
                                onChange={e => setLabelSearch(e.target.value)}
                                className="pl-8 h-8 text-sm"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                            {labelsLoading ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
                              </div>
                            ) : (
                              (() => {
                                const availableLabels = labels?.filter(l =>
                                  !task.labels?.some(tl => tl.label_id === l.id) &&
                                  l.name.toLowerCase().includes(labelSearch.toLowerCase())
                                ) || [];

                                const exactMatch = labels?.some(l => l.name.toLowerCase() === labelSearch.trim().toLowerCase());
                                const showCreateOption = labelSearch.trim() && !exactMatch;

                                return (
                                  <>
                                    {/* Show "Add new label" option at top when typing */}
                                    {showCreateOption && (
                                      <div className="border-b pb-2 mb-2">
                                        {!isCreatingLabel ? (
                                          <button
                                            className="flex items-center gap-2 w-full p-2 rounded hover:bg-accent-yellow/10 text-left text-sm bg-muted-gray/5"
                                            onClick={() => setIsCreatingLabel(true)}
                                          >
                                            <Plus className="w-4 h-4 text-accent-yellow" />
                                            <span>Add "<strong>{labelSearch.trim()}</strong>"</span>
                                          </button>
                                        ) : (
                                          <div className="space-y-2 p-2 bg-muted-gray/5 rounded">
                                            <p className="text-xs text-muted-gray">Pick a color for "{labelSearch.trim()}":</p>
                                            <div className="flex flex-wrap gap-1">
                                              {LABEL_COLORS.map(color => (
                                                <button
                                                  key={color}
                                                  className={cn(
                                                    "w-6 h-6 rounded-full border-2 transition-transform",
                                                    newLabelColor === color ? "border-white scale-110" : "border-transparent hover:scale-105"
                                                  )}
                                                  style={{ backgroundColor: color }}
                                                  onClick={() => setNewLabelColor(color)}
                                                />
                                              ))}
                                            </div>
                                            <div className="flex gap-2">
                                              <Button
                                                size="sm"
                                                className="flex-1"
                                                disabled={createLabel.isPending}
                                                onClick={async () => {
                                                  try {
                                                    const newLabel = await createLabel.mutateAsync({
                                                      name: labelSearch.trim(),
                                                      color: newLabelColor,
                                                    });
                                                    addLabel.mutate(newLabel.id, {
                                                      onSuccess: () => {
                                                        toast({
                                                          title: 'Label created',
                                                          description: `"${newLabel.name}" added to task`,
                                                        });
                                                      },
                                                    });
                                                    setLabelSearch('');
                                                    setIsCreatingLabel(false);
                                                    setShowLabelPopover(false);
                                                  } catch (error) {
                                                    console.error('Error creating label:', error);
                                                    toast({
                                                      title: 'Error',
                                                      description: 'Failed to create label',
                                                      variant: 'destructive',
                                                    });
                                                  }
                                                }}
                                              >
                                                {createLabel.isPending ? (
                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  'Add'
                                                )}
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setIsCreatingLabel(false)}
                                              >
                                                Cancel
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Existing labels list */}
                                    {availableLabels.length > 0 ? (
                                      availableLabels.map(label => (
                                        <button
                                          key={label.id}
                                          onClick={() => {
                                            addLabel.mutate(label.id, {
                                              onSuccess: () => {
                                                toast({
                                                  title: 'Added',
                                                  description: `Label "${label.name}" added to task`,
                                                });
                                              },
                                              onError: () => {
                                                toast({
                                                  title: 'Error',
                                                  description: 'Failed to add label',
                                                  variant: 'destructive',
                                                });
                                              },
                                            });
                                            setShowLabelPopover(false);
                                          }}
                                          className="flex items-center gap-2 w-full p-2 rounded hover:bg-muted-gray/10 text-left"
                                        >
                                          <span
                                            className="w-3 h-3 rounded-full"
                                            style={{ backgroundColor: label.color || '#888' }}
                                          />
                                          <span className="text-sm">{label.name}</span>
                                        </button>
                                      ))
                                    ) : !showCreateOption ? (
                                      <p className="text-sm text-muted-gray text-center py-2">
                                        No labels yet. Type to create one.
                                    </p>
                                    ) : null}
                                  </>
                                );
                              })()
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {(!task.labels || task.labels.length === 0) && !canEdit && (
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

            {/* Source Entity (for tasks created from other tabs) */}
            {task.source_type && task.source_type !== 'manual' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-muted-gray flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Created From
                  </Label>
                  <div className="flex items-center gap-2 text-sm bg-primary/10 border border-primary/20 rounded px-3 py-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {task.source_type.replace('_', ' ')}
                    </Badge>
                    <span className="text-bone-white">
                      {task.source_camera_media?.card_label ||
                       task.source_continuity_note?.department ||
                       task.source_location?.name ||
                       task.source_hot_set_session?.date ||
                       task.source_gear?.name ||
                       task.source_costume?.character_name ||
                       'View Source'}
                    </span>
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
