/**
 * SessionTasksCard - Display tasks created during the Hot Set session
 *
 * Features:
 * - Shows tasks linked to the current session via source_hot_set_session_id
 * - Task list with title, status, assignee
 * - Click to navigate to task detail
 * - Task count in header
 */
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ListTodo, Circle, CheckCircle2, Clock, AlertCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSourceTasks } from '@/hooks/backlot/useTaskLists';
import { BacklotTask, BacklotTaskStatus } from '@/types/backlot';

interface SessionTasksCardProps {
  projectId: string;
  sessionId: string;
  canEdit: boolean;
  className?: string;
  onTaskClick?: (taskId: string) => void;
}

const statusConfig: Record<
  BacklotTaskStatus,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  backlog: {
    icon: Circle,
    color: 'text-muted-gray',
    bgColor: 'bg-muted-gray/10',
    label: 'Backlog',
  },
  todo: {
    icon: Circle,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    label: 'To Do',
  },
  in_progress: {
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    label: 'In Progress',
  },
  review: {
    icon: AlertCircle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    label: 'Review',
  },
  done: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    label: 'Done',
  },
};

const TaskRow: React.FC<{
  task: BacklotTask;
  onClick?: () => void;
}> = ({ task, onClick }) => {
  const config = statusConfig[task.status] || statusConfig.todo;
  const StatusIcon = config.icon;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-2 rounded-md border border-muted-gray/20 bg-charcoal-black/50',
        'hover:border-muted-gray/40 hover:bg-charcoal-black transition-colors',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="flex items-start gap-2">
        <StatusIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-bone-white truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className={cn('text-xs px-1.5 py-0', config.bgColor, config.color)}
            >
              {config.label}
            </Badge>
            {task.assignees && task.assignees.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-gray">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[80px]">
                  {task.assignees[0]?.profile?.display_name || 'Assigned'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SessionTasksCard: React.FC<SessionTasksCardProps> = ({
  projectId,
  sessionId,
  canEdit,
  className,
  onTaskClick,
}) => {
  const { tasks, isLoading, error } = useSourceTasks(projectId, 'hot_set', sessionId);

  if (isLoading) {
    return (
      <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
        <CardHeader className="py-3 px-4 border-b border-muted-gray/20">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-accent-yellow" />
            Session Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const taskCount = tasks?.length || 0;
  const completedCount = tasks?.filter((t) => t.status === 'done').length || 0;

  return (
    <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
      <CardHeader className="py-3 px-4 border-b border-muted-gray/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-accent-yellow" />
            Session Tasks
          </CardTitle>
          {taskCount > 0 && (
            <Badge variant="outline" className="text-xs bg-muted-gray/10 border-muted-gray/30">
              {completedCount}/{taskCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {error ? (
          <p className="text-sm text-red-400 text-center py-4">Failed to load tasks</p>
        ) : taskCount === 0 ? (
          <div className="text-center py-6">
            <ListTodo className="w-8 h-8 mx-auto text-muted-gray/50 mb-2" />
            <p className="text-sm text-muted-gray">No tasks for this session</p>
            <p className="text-xs text-muted-gray/70 mt-1">
              Create tasks using the button above
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onClick={onTaskClick ? () => onTaskClick(task.id) : undefined}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
