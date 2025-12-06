/**
 * TasksView - Kanban-style task management
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckSquare,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Clock,
  User,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTasks } from '@/hooks/backlot';
import { BacklotTask, BacklotTaskStatus, BacklotTaskPriority } from '@/types/backlot';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

interface TasksViewProps {
  projectId: string;
  canEdit: boolean;
}

const STATUS_CONFIG: Record<
  BacklotTaskStatus,
  { label: string; color: string; bgColor: string }
> = {
  todo: { label: 'To Do', color: 'text-muted-gray', bgColor: 'bg-muted-gray/20' },
  in_progress: { label: 'In Progress', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  review: { label: 'Review', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  completed: { label: 'Done', color: 'text-green-400', bgColor: 'bg-green-500/20' },
  blocked: { label: 'Blocked', color: 'text-red-400', bgColor: 'bg-red-500/20' },
};

const PRIORITY_CONFIG: Record<BacklotTaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-muted-gray' },
  medium: { label: 'Medium', color: 'text-blue-400' },
  high: { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
};

const TaskCard: React.FC<{
  task: BacklotTask;
  canEdit: boolean;
  onStatusChange: (id: string, status: BacklotTaskStatus) => void;
  onDelete: (id: string) => void;
}> = ({ task, canEdit, onStatusChange, onDelete }) => {
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';

  return (
    <div className="bg-charcoal-black border border-muted-gray/20 rounded-lg p-3 hover:border-muted-gray/40 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-bone-white line-clamp-2">{task.title}</h4>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400" onClick={() => onDelete(task.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-muted-gray line-clamp-2 mt-1">{task.description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {/* Priority */}
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0', PRIORITY_CONFIG[task.priority].color)}
        >
          {PRIORITY_CONFIG[task.priority].label}
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

        {/* Department */}
        {task.department && (
          <span className="text-[10px] text-muted-gray">{task.department}</span>
        )}
      </div>

      {/* Assignee */}
      {task.assignee && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-muted-gray/10">
          <Avatar className="w-5 h-5">
            <AvatarImage src={task.assignee.avatar_url || ''} />
            <AvatarFallback className="text-[8px]">
              {(task.assignee.display_name || 'U').slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-gray">
            {task.assignee.display_name || task.assignee.full_name}
          </span>
        </div>
      )}

      {/* Subtasks indicator */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="text-xs text-muted-gray mt-2">
          {task.subtasks.filter((s) => s.status === 'completed').length}/{task.subtasks.length}{' '}
          subtasks
        </div>
      )}
    </div>
  );
};

const TaskColumn: React.FC<{
  status: BacklotTaskStatus;
  tasks: BacklotTask[];
  canEdit: boolean;
  onStatusChange: (id: string, status: BacklotTaskStatus) => void;
  onDelete: (id: string) => void;
  onAddTask: (status: BacklotTaskStatus) => void;
}> = ({ status, tasks, canEdit, onStatusChange, onDelete, onAddTask }) => {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex-1 min-w-[280px] max-w-[320px]">
      {/* Column Header */}
      <div className={cn('rounded-t-lg px-3 py-2', config.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn('font-medium text-sm', config.color)}>{config.label}</span>
            <Badge variant="outline" className="text-[10px] border-muted-gray/30">
              {tasks.length}
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
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            canEdit={canEdit}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-gray text-sm">No tasks</div>
        )}
      </div>
    </div>
  );
};

const TasksView: React.FC<TasksViewProps> = ({ projectId, canEdit }) => {
  const [statusFilter, setStatusFilter] = useState<BacklotTaskStatus | 'all'>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingToStatus, setAddingToStatus] = useState<BacklotTaskStatus | null>(null);

  const { tasks, isLoading, createTask, updateStatus, deleteTask } = useTasks({
    projectId,
    status: statusFilter,
  });

  const handleStatusChange = async (id: string, status: BacklotTaskStatus) => {
    await updateStatus.mutateAsync({ id, status });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      await deleteTask.mutateAsync(id);
    }
  };

  const handleQuickAdd = async (status: BacklotTaskStatus) => {
    if (!newTaskTitle.trim()) return;
    await createTask.mutateAsync({
      projectId,
      title: newTaskTitle.trim(),
      status,
    });
    setNewTaskTitle('');
    setAddingToStatus(null);
  };

  // Group tasks by status
  const tasksByStatus: Record<BacklotTaskStatus, BacklotTask[]> = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    review: tasks.filter((t) => t.status === 'review'),
    completed: tasks.filter((t) => t.status === 'completed'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-72 shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Tasks</h2>
          <p className="text-sm text-muted-gray">Manage your production tasks</p>
        </div>
        {canEdit && (
          <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {(['todo', 'in_progress', 'review', 'completed'] as BacklotTaskStatus[]).map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            canEdit={canEdit}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            onAddTask={(s) => setAddingToStatus(s)}
          />
        ))}
      </div>

      {/* Blocked Tasks (if any) */}
      {tasksByStatus.blocked.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-red-400 flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5" />
            Blocked Tasks ({tasksByStatus.blocked.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasksByStatus.blocked.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={canEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksView;
