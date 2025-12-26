/**
 * TasksView - Notion-style task list management
 * Shows all task lists for a project with options to create, view, and manage
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
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
  Plus,
  ListTodo,
  Archive,
  MoreHorizontal,
  Eye,
  Trash2,
  CheckCircle2,
  Users,
  Lock,
  Globe,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  Loader2,
  Settings2,
  HelpCircle,
  UserPlus,
  GripVertical,
  Tag,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTaskLists } from '@/hooks/backlot';
import {
  BacklotTaskList,
  TaskListSharingMode,
  TaskListViewType,
  TaskListInput,
  TASK_VIEW_TYPE_LABELS,
  TASK_SHARING_MODE_LABELS,
} from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface TasksViewProps {
  projectId: string;
  canEdit?: boolean;
  onSelectTaskList?: (taskList: BacklotTaskList) => void;
}

// =====================================================
// TaskListCard Component
// =====================================================
interface TaskListCardProps {
  taskList: BacklotTaskList;
  onClick: () => void;
  canEdit: boolean;
  onArchive: () => void;
  onDelete: () => void;
}

const TaskListCard: React.FC<TaskListCardProps> = ({
  taskList,
  onClick,
  canEdit,
  onArchive,
  onDelete,
}) => {
  const taskCount = taskList.task_count || 0;
  const completedCount = taskList.completed_count || 0;
  const progressPercent = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

  const ViewIcon = taskList.default_view_type === 'board'
    ? LayoutGrid
    : taskList.default_view_type === 'calendar'
      ? CalendarIcon
      : List;

  return (
    <Card
      className={cn(
        "bg-charcoal-black border-muted-gray/20 hover:border-accent-yellow/50 transition-all cursor-pointer group",
        taskList.is_archived && "opacity-60"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent-yellow/10 flex items-center justify-center shrink-0">
              <ListTodo className="w-4 h-4 text-accent-yellow" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-bone-white truncate group-hover:text-accent-yellow transition-colors">
                {taskList.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-gray">
                <ViewIcon className="w-3 h-3" />
                <span>{TASK_VIEW_TYPE_LABELS[taskList.default_view_type]}</span>
                {taskList.sharing_mode === 'selective' ? (
                  <>
                    <span className="mx-1">·</span>
                    <Lock className="w-3 h-3" />
                    <span>Selective</span>
                  </>
                ) : (
                  <>
                    <span className="mx-1">·</span>
                    <Globe className="w-3 h-3" />
                    <span>Project-wide</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onClick(); }}>
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onArchive(); }}>
                  <Archive className="w-4 h-4 mr-2" />
                  {taskList.is_archived ? 'Unarchive' : 'Archive'}
                </DropdownMenuItem>
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

        {/* Description */}
        {taskList.description && (
          <p className="text-sm text-muted-gray line-clamp-2 mb-3">
            {taskList.description}
          </p>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-gray">
              {completedCount} of {taskCount} tasks complete
            </span>
            <span className={cn(
              "font-medium",
              progressPercent === 100 ? "text-green-400" : "text-accent-yellow"
            )}>
              {progressPercent}%
            </span>
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-muted-gray/10">
          <div className="flex items-center gap-2">
            {taskList.members && taskList.members.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-gray">
                <Users className="w-3 h-3" />
                <span>{taskList.members.length} members</span>
              </div>
            )}
          </div>
          <span className="text-xs text-muted-gray">
            Updated {formatDistanceToNow(new Date(taskList.updated_at))} ago
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

// =====================================================
// CreateTaskListModal Component
// =====================================================
interface CreateTaskListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: TaskListInput) => Promise<void>;
  isLoading: boolean;
}

const CreateTaskListModal: React.FC<CreateTaskListModalProps> = ({
  open,
  onOpenChange,
  onCreate,
  isLoading,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sharingMode, setSharingMode] = useState<TaskListSharingMode>('project_wide');
  const [defaultView, setDefaultView] = useState<TaskListViewType>('board');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onCreate({
      name: title.trim(),
      description: description.trim() || undefined,
      sharing_mode: sharingMode,
      default_view_type: defaultView,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setSharingMode('project_wide');
    setDefaultView('board');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Task List</DialogTitle>
            <DialogDescription>
              Create a new task list to organize your production tasks
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Pre-Production Checklist"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What's this task list for?"
                rows={2}
              />
            </div>

            {/* Default View */}
            <div className="space-y-2">
              <Label>Default View</Label>
              <div className="flex gap-2">
                {(['board', 'list', 'calendar'] as TaskListViewType[]).map(view => (
                  <Button
                    key={view}
                    type="button"
                    variant={defaultView === view ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDefaultView(view)}
                    className={cn(
                      defaultView === view && "bg-accent-yellow text-charcoal-black"
                    )}
                  >
                    {view === 'board' && <LayoutGrid className="w-4 h-4 mr-2" />}
                    {view === 'list' && <List className="w-4 h-4 mr-2" />}
                    {view === 'calendar' && <CalendarIcon className="w-4 h-4 mr-2" />}
                    {TASK_VIEW_TYPE_LABELS[view]}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sharing Mode */}
            <div className="space-y-2">
              <Label>Sharing</Label>
              <Select value={sharingMode} onValueChange={(v: TaskListSharingMode) => setSharingMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project_wide">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <div>
                        <div>All Project Members</div>
                        <div className="text-xs text-muted-gray">Everyone on this project can access</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="selective">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <div>
                        <div>Selected Members Only</div>
                        <div className="text-xs text-muted-gray">Only specific people you invite</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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
                  Create Task List
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
// Main TasksView Component
// =====================================================
const TasksView: React.FC<TasksViewProps> = ({
  projectId,
  canEdit = false,
  onSelectTaskList,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  const { taskLists, isLoading, createTaskList, archiveTaskList } = useTaskLists({
    projectId,
    includeArchived: showArchived,
  });

  // Separate active and archived lists
  const activeLists = taskLists.filter(tl => !tl.is_archived);
  const archivedLists = taskLists.filter(tl => tl.is_archived);

  const handleCreateTaskList = async (data: TaskListInput) => {
    try {
      const result = await createTaskList.mutateAsync(data);
      setShowCreateModal(false);
      if (result && onSelectTaskList) {
        onSelectTaskList(result);
      }
    } catch (error) {
      console.error('Error creating task list:', error);
    }
  };

  const handleArchive = async (taskList: BacklotTaskList) => {
    try {
      await archiveTaskList.mutateAsync({
        taskListId: taskList.id,
        isArchived: !taskList.is_archived,
      });
    } catch (error) {
      console.error('Error archiving task list:', error);
    }
  };

  const handleDelete = async (taskList: BacklotTaskList) => {
    if (!confirm(`Are you sure you want to delete "${taskList.name}"? This will delete all tasks in this list.`)) {
      return;
    }
    // TODO: Implement delete via API
    console.log('Delete task list:', taskList.id);
  };

  const handleSelectTaskList = (taskList: BacklotTaskList) => {
    if (onSelectTaskList) {
      onSelectTaskList(taskList);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Tasks</h2>
          <p className="text-sm text-muted-gray mt-1">
            Organize your production with task lists
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Tips
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className={showArchived ? 'border-accent-yellow text-accent-yellow' : ''}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>
          {canEdit && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Task List
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {activeLists.length === 0 && !showArchived && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="w-12 h-12 text-muted-gray mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Task Lists Yet</h3>
            <p className="text-muted-gray text-center max-w-md mb-4">
              Create your first task list to start organizing your production tasks.
              Use boards, lists, or calendars to track progress.
            </p>
            {canEdit && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task List
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Task Lists Grid */}
      {activeLists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeLists.map(taskList => (
            <TaskListCard
              key={taskList.id}
              taskList={taskList}
              onClick={() => handleSelectTaskList(taskList)}
              canEdit={canEdit}
              onArchive={() => handleArchive(taskList)}
              onDelete={() => handleDelete(taskList)}
            />
          ))}
        </div>
      )}

      {/* Archived Lists */}
      {showArchived && archivedLists.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-muted-gray flex items-center gap-2 mb-4">
            <Archive className="w-5 h-5" />
            Archived Task Lists ({archivedLists.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedLists.map(taskList => (
              <TaskListCard
                key={taskList.id}
                taskList={taskList}
                onClick={() => handleSelectTaskList(taskList)}
                canEdit={canEdit}
                onArchive={() => handleArchive(taskList)}
                onDelete={() => handleDelete(taskList)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateTaskListModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreate={handleCreateTaskList}
        isLoading={createTaskList.isPending}
      />

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              Task List Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <ListTodo className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Task Lists</h4>
                <p className="text-sm text-muted-gray">
                  Create task lists to organize work by department, phase, or any grouping
                  that makes sense for your production.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <LayoutGrid className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">View Types</h4>
                <p className="text-sm text-muted-gray">
                  Choose between Board (kanban), List, or Calendar views.
                  Drag and drop tasks between status columns in board view.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <UserPlus className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Assignments</h4>
                <p className="text-sm text-muted-gray">
                  Assign team members to tasks and set due dates for accountability.
                  Use selective sharing to limit access to specific lists.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Tag className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Labels & Priority</h4>
                <p className="text-sm text-muted-gray">
                  Add labels to categorize tasks and set priority levels to keep
                  the most important work visible.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Archive className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Archiving</h4>
                <p className="text-sm text-muted-gray">
                  Archive completed task lists to keep your workspace clean.
                  Toggle "Show Archived" to view or restore them anytime.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTipsPanel(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TasksView;
