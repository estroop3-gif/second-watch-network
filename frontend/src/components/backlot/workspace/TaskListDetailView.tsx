/**
 * TaskListDetailView - Detailed view of a task list with Board/List/Calendar views
 * Notion-style task management with drag-and-drop, filtering, and task creation
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Plus,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  MoreVertical,
  Edit,
  Trash2,
  Clock,
  User,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Settings2,
  Users,
  MessageSquare,
  Tag,
  CheckCircle2,
  Circle,
  PlayCircle,
  PauseCircle,
  XCircle,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { useTaskList, useTaskListTasks, useTaskLabels } from '@/hooks/backlot';
import {
  BacklotTask,
  BacklotTaskList,
  BacklotTaskStatus,
  BacklotTaskPriority,
  TaskListViewType,
  TaskInput,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_VIEW_TYPE_LABELS,
} from '@/types/backlot';
import { format, formatDistanceToNow, isPast, isToday, isTomorrow, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskListDetailViewProps {
  taskListId: string;
  projectId: string;
  canEdit: boolean;
  onBack: () => void;
  onOpenTask?: (task: BacklotTask) => void;
  onOpenShare?: () => void;
}

// =====================================================
// Status Icons
// =====================================================
const StatusIcon: React.FC<{ status: BacklotTaskStatus; className?: string }> = ({ status, className }) => {
  const icons: Record<BacklotTaskStatus, React.ReactNode> = {
    todo: <Circle className={cn("w-4 h-4", className)} />,
    in_progress: <PlayCircle className={cn("w-4 h-4 text-blue-400", className)} />,
    review: <PauseCircle className={cn("w-4 h-4 text-amber-400", className)} />,
    completed: <CheckCircle2 className={cn("w-4 h-4 text-green-400", className)} />,
    blocked: <XCircle className={cn("w-4 h-4 text-red-400", className)} />,
  };
  return <>{icons[status]}</>;
};

// Status progression helper
const getNextStatus = (current: BacklotTaskStatus): BacklotTaskStatus | null => {
  const progression: Record<BacklotTaskStatus, BacklotTaskStatus | null> = {
    todo: 'in_progress',
    in_progress: 'review',
    review: 'completed',
    completed: null,
    blocked: 'todo',
  };
  return progression[current];
};

// =====================================================
// CreateTaskModal Component
// =====================================================
interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: TaskInput) => Promise<void>;
  isLoading: boolean;
  defaultStatus?: BacklotTaskStatus;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  open,
  onOpenChange,
  onCreate,
  isLoading,
  defaultStatus = 'todo',
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<BacklotTaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<BacklotTaskPriority>('medium');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [department, setDepartment] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Reset form when modal opens with new default status
  React.useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
    }
  }, [open, defaultStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const taskData = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
      department: department.trim() || undefined,
    };
    try {
      await onCreate(taskData);
      // Reset form
      setTitle('');
      setDescription('');
      setStatus('todo');
      setPriority('medium');
      setDueDate(undefined);
      setDepartment('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Task
            </DialogTitle>
            <DialogDescription>
              Add a new task to this list
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                required
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add details about this task..."
                rows={3}
              />
            </div>

            {/* Status & Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: BacklotTaskStatus) => setStatus(v)}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <StatusIcon status={status} />
                      <SelectValue />
                    </div>
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
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(v: BacklotTaskPriority) => setPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TASK_PRIORITY_LABELS) as BacklotTaskPriority[]).map(p => (
                      <SelectItem key={p} value={p}>
                        <span className={cn(
                          p === 'low' && 'text-slate-400',
                          p === 'medium' && 'text-blue-400',
                          p === 'high' && 'text-orange-400',
                          p === 'urgent' && 'text-red-400',
                        )}>
                          {TASK_PRIORITY_LABELS[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {dueDate ? format(dueDate, 'PPP') : 'Select a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => {
                      setDueDate(date);
                      setShowDatePicker(false);
                    }}
                    initialFocus
                  />
                  {dueDate && (
                    <div className="p-2 border-t border-muted-gray/20">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-400"
                        onClick={() => {
                          setDueDate(undefined);
                          setShowDatePicker(false);
                        }}
                      >
                        Clear date
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="task-dept">Department (optional)</Label>
              <Input
                id="task-dept"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g., Art, Wardrobe, Locations..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isLoading}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// =====================================================
// TaskCard Component (for Board view)
// =====================================================
interface TaskCardProps {
  task: BacklotTask;
  canEdit: boolean;
  onClick: () => void;
  onStatusChange: (status: BacklotTaskStatus) => void;
  onDelete: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  canEdit,
  onClick,
  onStatusChange,
  onDelete,
}) => {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';
  const nextStatus = getNextStatus(task.status);

  const handleMoveToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nextStatus) {
      onStatusChange(nextStatus);
    }
  };

  return (
    <div
      className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-3 hover:border-accent-yellow/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-bone-white line-clamp-2">{task.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          {/* Move to Next Status Button */}
          {canEdit && nextStatus && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-accent-yellow/20"
              onClick={handleMoveToNext}
              title={`Move to ${TASK_STATUS_LABELS[nextStatus]}`}
            >
              <ArrowRight className="w-3 h-3 text-accent-yellow" />
            </Button>
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onClick(); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {/* Status change options */}
                <DropdownMenuSeparator />
                {(Object.keys(TASK_STATUS_LABELS) as BacklotTaskStatus[]).map(s => (
                  s !== task.status && (
                    <DropdownMenuItem
                      key={s}
                      onClick={e => {
                        e.stopPropagation();
                        onStatusChange(s);
                      }}
                    >
                      <StatusIcon status={s} className="w-4 h-4 mr-2" />
                      Move to {TASK_STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  )
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-400"
                  onClick={e => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-gray line-clamp-2 mt-1">{task.description}</p>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.labels.slice(0, 3).map(label => (
            <span
              key={label.id}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${label.color}20`, color: label.color }}
            >
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="text-[10px] text-muted-gray">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {/* Priority */}
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0', `text-${TASK_PRIORITY_COLORS[task.priority]}-400`)}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>

        {/* Due Date */}
        {task.due_date && (
          <div
            className={cn(
              'flex items-center gap-1 text-[10px]',
              isOverdue ? 'text-red-400' : 'text-muted-gray'
            )}
          >
            {isOverdue && <AlertCircle className="w-3 h-3" />}
            <Clock className="w-3 h-3" />
            {format(new Date(task.due_date), 'MMM d')}
          </div>
        )}

        {/* Comment count */}
        {task.comment_count && task.comment_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-gray">
            <MessageSquare className="w-3 h-3" />
            {task.comment_count}
          </div>
        )}
      </div>

      {/* Assignees */}
      {task.assignees && task.assignees.length > 0 && (
        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-muted-gray/10">
          <div className="flex -space-x-1">
            {task.assignees.slice(0, 3).map(assignee => (
              <Avatar key={assignee.id} className="w-5 h-5 border border-charcoal-black">
                <AvatarImage src={assignee.profile?.avatar_url || ''} />
                <AvatarFallback className="text-[8px]">
                  {(assignee.profile?.display_name || 'U').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            ))}
            {task.assignees.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-muted-gray/20 flex items-center justify-center text-[8px] text-muted-gray">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================
// Board View Component
// =====================================================
interface BoardViewProps {
  tasks: BacklotTask[];
  canEdit: boolean;
  onTaskClick: (task: BacklotTask) => void;
  onStatusChange: (taskId: string, status: BacklotTaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (status: BacklotTaskStatus) => void;
}

const BoardView: React.FC<BoardViewProps> = ({
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
  onDeleteTask,
  onAddTask,
}) => {
  const statuses: BacklotTaskStatus[] = ['todo', 'in_progress', 'review', 'completed'];

  const tasksByStatus = useMemo(() => {
    const result: Record<BacklotTaskStatus, BacklotTask[]> = {
      todo: [],
      in_progress: [],
      review: [],
      completed: [],
      blocked: [],
    };
    tasks.forEach(task => {
      result[task.status].push(task);
    });
    return result;
  }, [tasks]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statuses.map(status => {
        const statusTasks = tasksByStatus[status];
        const colorClass = TASK_STATUS_COLORS[status];

        return (
          <div key={status} className="flex-shrink-0 w-72">
            {/* Column Header */}
            <div className={cn(
              'rounded-t-lg px-3 py-2',
              `bg-${colorClass}-500/10`
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon status={status} />
                  <span className="font-medium text-sm text-bone-white">
                    {TASK_STATUS_LABELS[status]}
                  </span>
                  <Badge variant="outline" className="text-[10px] border-muted-gray/30">
                    {statusTasks.length}
                  </Badge>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onAddTask(status)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-2 p-2 bg-muted-gray/5 rounded-b-lg min-h-[200px]">
              {statusTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={canEdit}
                  onClick={() => onTaskClick(task)}
                  onStatusChange={(newStatus) => onStatusChange(task.id, newStatus)}
                  onDelete={() => onDeleteTask(task.id)}
                />
              ))}
              {statusTasks.length === 0 && (
                <div className="text-center py-8 text-muted-gray text-xs">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Blocked Column (if any) */}
      {tasksByStatus.blocked.length > 0 && (
        <div className="flex-shrink-0 w-72">
          <div className="bg-red-500/10 rounded-t-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <StatusIcon status="blocked" />
              <span className="font-medium text-sm text-red-400">Blocked</span>
              <Badge variant="outline" className="text-[10px] border-red-400/30 text-red-400">
                {tasksByStatus.blocked.length}
              </Badge>
            </div>
          </div>
          <div className="space-y-2 p-2 bg-red-500/5 rounded-b-lg">
            {tasksByStatus.blocked.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={canEdit}
                onClick={() => onTaskClick(task)}
                onStatusChange={(newStatus) => onStatusChange(task.id, newStatus)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================
// List View Component
// =====================================================
interface ListViewProps {
  tasks: BacklotTask[];
  canEdit: boolean;
  onTaskClick: (task: BacklotTask) => void;
  onStatusChange: (taskId: string, status: BacklotTaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
}

const ListRow: React.FC<{
  task: BacklotTask;
  canEdit: boolean;
  onClick: () => void;
  onStatusChange: (status: BacklotTaskStatus) => void;
  onDelete: () => void;
}> = ({ task, canEdit, onClick, onStatusChange, onDelete }) => {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStatusChange(task.status === 'completed' ? 'todo' : 'completed');
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 border-b border-muted-gray/10 hover:bg-muted-gray/5 cursor-pointer group"
      onClick={onClick}
    >
      {/* Checkbox */}
      <div onClick={handleCheckboxChange}>
        <Checkbox checked={task.status === 'completed'} />
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-sm text-bone-white truncate",
          task.status === 'completed' && "line-through text-muted-gray"
        )}>
          {task.title}
        </div>
      </div>

      {/* Status */}
      <div className="w-24">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            task.status === 'todo' && 'text-gray-400',
            task.status === 'in_progress' && 'text-blue-400 border-blue-400/30',
            task.status === 'review' && 'text-amber-400 border-amber-400/30',
            task.status === 'completed' && 'text-green-400 border-green-400/30',
            task.status === 'blocked' && 'text-red-400 border-red-400/30',
          )}
        >
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
      </div>

      {/* Priority */}
      <div className="w-20">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px]',
            task.priority === 'low' && 'text-slate-400',
            task.priority === 'medium' && 'text-blue-400 border-blue-400/30',
            task.priority === 'high' && 'text-orange-400 border-orange-400/30',
            task.priority === 'urgent' && 'text-red-400 border-red-400/30',
          )}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
      </div>

      {/* Due Date */}
      <div className="w-24 text-xs">
        {task.due_date ? (
          <span className={cn(isOverdue ? 'text-red-400' : 'text-muted-gray')}>
            {format(new Date(task.due_date), 'MMM d')}
          </span>
        ) : (
          <span className="text-muted-gray/50">-</span>
        )}
      </div>

      {/* Assignees */}
      <div className="w-24">
        {task.assignees && task.assignees.length > 0 ? (
          <div className="flex -space-x-1">
            {task.assignees.slice(0, 3).map(a => (
              <Avatar key={a.id} className="w-5 h-5 border border-charcoal-black">
                <AvatarImage src={a.profile?.avatar_url || ''} />
                <AvatarFallback className="text-[8px]">
                  {(a.profile?.display_name || 'U').slice(0, 1)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
        ) : (
          <span className="text-muted-gray/50 text-xs">-</span>
        )}
      </div>

      {/* Move to Next Button */}
      {canEdit && getNextStatus(task.status) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-accent-yellow/20"
          onClick={e => {
            e.stopPropagation();
            const next = getNextStatus(task.status);
            if (next) onStatusChange(next);
          }}
          title={`Move to ${TASK_STATUS_LABELS[getNextStatus(task.status)!]}`}
        >
          <ArrowRight className="w-3 h-3 text-accent-yellow" />
        </Button>
      )}

      {/* Actions */}
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={e => { e.stopPropagation(); onClick(); }}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {/* Status change options */}
            <DropdownMenuSeparator />
            {(Object.keys(TASK_STATUS_LABELS) as BacklotTaskStatus[]).map(s => (
              s !== task.status && (
                <DropdownMenuItem
                  key={s}
                  onClick={e => {
                    e.stopPropagation();
                    onStatusChange(s);
                  }}
                >
                  <StatusIcon status={s} className="w-4 h-4 mr-2" />
                  Move to {TASK_STATUS_LABELS[s]}
                </DropdownMenuItem>
              )
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-400"
              onClick={e => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const ListView: React.FC<ListViewProps> = ({
  tasks,
  canEdit,
  onTaskClick,
  onStatusChange,
  onDeleteTask,
}) => {
  return (
    <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-muted-gray/10 border-b border-muted-gray/20 text-xs text-muted-gray font-medium">
        <div className="w-6"></div>
        <div className="flex-1">Task</div>
        <div className="w-24">Status</div>
        <div className="w-20">Priority</div>
        <div className="w-24">Due Date</div>
        <div className="w-24">Assignees</div>
        <div className="w-6"></div>
      </div>

      {/* Rows */}
      {tasks.map(task => (
        <ListRow
          key={task.id}
          task={task}
          canEdit={canEdit}
          onClick={() => onTaskClick(task)}
          onStatusChange={(status) => onStatusChange(task.id, status)}
          onDelete={() => onDeleteTask(task.id)}
        />
      ))}

      {tasks.length === 0 && (
        <div className="text-center py-12 text-muted-gray">
          No tasks yet. Create your first task!
        </div>
      )}
    </div>
  );
};

// =====================================================
// Calendar View Component
// =====================================================
interface CalendarViewProps {
  tasks: BacklotTask[];
  canEdit: boolean;
  onTaskClick: (task: BacklotTask) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, canEdit, onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const tasksByDay = useMemo(() => {
    const result: Record<string, BacklotTask[]> = {};
    tasks.forEach(task => {
      if (task.due_date) {
        const key = format(new Date(task.due_date), 'yyyy-MM-dd');
        if (!result[key]) result[key] = [];
        result[key].push(task);
      }
    });
    return result;
  }, [tasks]);

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(d => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000))}>
          Previous Week
        </Button>
        <h3 className="font-medium text-bone-white">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h3>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(d => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000))}>
          Next Week
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay[key] || [];
          const isCurrentDay = isToday(day);

          return (
            <div
              key={key}
              className={cn(
                "min-h-[120px] rounded-lg border p-2",
                isCurrentDay
                  ? "border-accent-yellow bg-accent-yellow/5"
                  : "border-muted-gray/20 bg-muted-gray/5"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-2",
                isCurrentDay ? "text-accent-yellow" : "text-muted-gray"
              )}>
                {format(day, 'EEE d')}
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className="text-xs p-1 rounded bg-charcoal-black border border-muted-gray/20 cursor-pointer hover:border-accent-yellow/50 truncate"
                    onClick={() => onTaskClick(task)}
                  >
                    <StatusIcon status={task.status} className="w-3 h-3 inline mr-1" />
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-muted-gray">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tasks without due date */}
      {tasks.filter(t => !t.due_date).length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-muted-gray mb-2">No Due Date</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {tasks.filter(t => !t.due_date).slice(0, 8).map(task => (
              <div
                key={task.id}
                className="text-xs p-2 rounded bg-charcoal-black border border-muted-gray/20 cursor-pointer hover:border-accent-yellow/50"
                onClick={() => onTaskClick(task)}
              >
                <StatusIcon status={task.status} className="w-3 h-3 inline mr-1" />
                <span className="truncate">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================
// Quick Add Task Input
// =====================================================
interface QuickAddTaskProps {
  onAdd: (title: string, status?: BacklotTaskStatus) => void;
  isLoading: boolean;
  defaultStatus?: BacklotTaskStatus;
}

const QuickAddTask: React.FC<QuickAddTaskProps> = ({ onAdd, isLoading, defaultStatus = 'todo' }) => {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), defaultStatus);
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Add a task..."
        className="flex-1"
        disabled={isLoading}
      />
      <Button
        type="submit"
        size="sm"
        disabled={!title.trim() || isLoading}
        className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
      </Button>
    </form>
  );
};

// =====================================================
// Main TaskListDetailView Component
// =====================================================
const TaskListDetailView: React.FC<TaskListDetailViewProps> = ({
  taskListId,
  projectId,
  canEdit,
  onBack,
  onOpenTask,
  onOpenShare,
}) => {
  const [currentView, setCurrentView] = useState<TaskListViewType>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BacklotTaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<BacklotTaskPriority | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [defaultNewTaskStatus, setDefaultNewTaskStatus] = useState<BacklotTaskStatus>('todo');

  const { taskList, tasks, isLoading, refetch } = useTaskList(taskListId);
  const { createTask, updateTask, deleteTask, updateTaskStatus } = useTaskListTasks({ taskListId });
  const { labels } = useTaskLabels({ projectId });

  // Set initial view from task list default
  React.useEffect(() => {
    if (taskList?.default_view_type && currentView !== taskList.default_view_type) {
      setCurrentView(taskList.default_view_type);
    }
  }, [taskList?.default_view_type]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    return result;
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

  const handleCreateTask = async (title: string, status?: BacklotTaskStatus) => {
    try {
      await createTask.mutateAsync({
        title,
        status: status || 'todo',
      });
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleCreateTaskWithDetails = async (data: TaskInput) => {
    try {
      await createTask.mutateAsync(data);
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleOpenCreateModal = (status: BacklotTaskStatus) => {
    setDefaultNewTaskStatus(status);
    setShowCreateModal(true);
  };

  const handleStatusChange = async (taskId: string, status: BacklotTaskStatus) => {
    try {
      await updateTaskStatus.mutateAsync({ id: taskId, status });
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask.mutateAsync(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleTaskClick = (task: BacklotTask) => {
    if (onOpenTask) {
      onOpenTask(task);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!taskList) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-gray">Task list not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-heading text-bone-white">{taskList.name}</h2>
            {taskList.description && (
              <p className="text-sm text-muted-gray mt-1">{taskList.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center border border-muted-gray/20 rounded-lg p-1">
            {(['board', 'list', 'calendar'] as TaskListViewType[]).map(view => (
              <Button
                key={view}
                variant={currentView === view ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView(view)}
                className={cn(
                  'h-8',
                  currentView === view && 'bg-accent-yellow text-charcoal-black'
                )}
              >
                {view === 'board' && <LayoutGrid className="w-4 h-4" />}
                {view === 'list' && <List className="w-4 h-4" />}
                {view === 'calendar' && <CalendarIcon className="w-4 h-4" />}
              </Button>
            ))}
          </div>

          {/* Share Button */}
          {canEdit && onOpenShare && (
            <Button variant="outline" size="sm" onClick={onOpenShare}>
              <Users className="w-4 h-4 mr-2" />
              Share
            </Button>
          )}

          {/* Settings */}
          {canEdit && (
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Settings2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: BacklotTaskStatus | 'all') => setStatusFilter(v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(Object.keys(TASK_STATUS_LABELS) as BacklotTaskStatus[]).map(s => (
                <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={(v: BacklotTaskPriority | 'all') => setPriorityFilter(v)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              {(Object.keys(TASK_PRIORITY_LABELS) as BacklotTaskPriority[]).map(p => (
                <SelectItem key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quick Add */}
        {canEdit && (
          <div className="w-full sm:w-auto sm:ml-auto">
            <QuickAddTask
              onAdd={handleCreateTask}
              isLoading={createTask.isPending}
            />
          </div>
        )}
      </div>

      {/* View Content */}
      {currentView === 'board' && (
        <BoardView
          tasks={filteredTasks}
          canEdit={canEdit}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
          onAddTask={handleOpenCreateModal}
        />
      )}

      {currentView === 'list' && (
        <ListView
          tasks={filteredTasks}
          canEdit={canEdit}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onDeleteTask={handleDeleteTask}
        />
      )}

      {currentView === 'calendar' && (
        <CalendarView
          tasks={filteredTasks}
          canEdit={canEdit}
          onTaskClick={handleTaskClick}
        />
      )}

      {/* Stats Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-muted-gray/20 text-sm text-muted-gray">
        <div>
          {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
          {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
            ? ` (filtered from ${tasks.length})`
            : ''
          }
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            {filteredTasks.filter(t => t.status === 'completed').length} completed
          </span>
          <span className="flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-red-400" />
            {filteredTasks.filter(t =>
              t.due_date && isPast(new Date(t.due_date)) && t.status !== 'completed'
            ).length} overdue
          </span>
        </div>
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreate={handleCreateTaskWithDetails}
        isLoading={createTask.isPending}
        defaultStatus={defaultNewTaskStatus}
      />
    </div>
  );
};

export default TaskListDetailView;
