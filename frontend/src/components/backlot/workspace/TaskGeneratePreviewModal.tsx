/**
 * TaskGeneratePreviewModal - Preview and modify generated tasks before creating them
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { usePreviewGeneratedTasks, useCreateTasksFromPreview } from '@/hooks/backlot';
import { ProposedTask, BacklotTaskPriority } from '@/types/backlot';
import {
  ListTodo,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface TaskGeneratePreviewModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (tasksCreated: number) => void;
}

// Department options
const DEPARTMENTS = [
  'Production',
  'Casting',
  'Locations',
  'Art/Props',
  'Art/Set Dec',
  'Art/Greens',
  'Wardrobe',
  'Makeup/Hair',
  'SFX',
  'VFX',
  'Stunts',
  'Transportation',
  'Animals',
  'Grip/Electric',
  'Sound',
  'Music',
  'Camera',
];

// Priority options
const PRIORITIES: { value: BacklotTaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface EditableTask extends ProposedTask {
  selected: boolean;
  isEditing: boolean;
}

export function TaskGeneratePreviewModal({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: TaskGeneratePreviewModalProps) {
  const { toast } = useToast();
  const previewTasks = usePreviewGeneratedTasks();
  const createTasks = useCreateTasksFromPreview();

  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch preview when modal opens
  useEffect(() => {
    if (isOpen && projectId) {
      setIsLoading(true);
      previewTasks.mutateAsync({ projectId })
        .then((result) => {
          // Initialize all tasks as selected
          const editableTasks: EditableTask[] = result.proposed_tasks.map((task) => ({
            ...task,
            selected: true,
            isEditing: false,
          }));
          setTasks(editableTasks);
          // Expand all scenes by default
          const scenes = new Set(result.proposed_tasks.map((t) => t.scene_number));
          setExpandedScenes(scenes);
        })
        .catch((error) => {
          toast({
            title: 'Failed to load tasks',
            description: error.message,
            variant: 'destructive',
          });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, projectId]);

  // Group tasks by scene
  const tasksByScene = tasks.reduce((acc, task) => {
    if (!acc[task.scene_number]) {
      acc[task.scene_number] = [];
    }
    acc[task.scene_number].push(task);
    return acc;
  }, {} as Record<string, EditableTask[]>);

  const sceneNumbers = Object.keys(tasksByScene).sort((a, b) => {
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numA - numB;
  });

  const toggleScene = (sceneNumber: string) => {
    const newExpanded = new Set(expandedScenes);
    if (newExpanded.has(sceneNumber)) {
      newExpanded.delete(sceneNumber);
    } else {
      newExpanded.add(sceneNumber);
    }
    setExpandedScenes(newExpanded);
  };

  const toggleTaskSelection = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.breakdown_item_id === taskId ? { ...t, selected: !t.selected } : t
      )
    );
  };

  const toggleAllInScene = (sceneNumber: string, selected: boolean) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.scene_number === sceneNumber ? { ...t, selected } : t
      )
    );
  };

  const selectAll = () => {
    setTasks((prev) => prev.map((t) => ({ ...t, selected: true })));
  };

  const deselectAll = () => {
    setTasks((prev) => prev.map((t) => ({ ...t, selected: false })));
  };

  const startEditing = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.breakdown_item_id === taskId ? { ...t, isEditing: true } : t
      )
    );
  };

  const stopEditing = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.breakdown_item_id === taskId ? { ...t, isEditing: false } : t
      )
    );
  };

  const updateTask = (taskId: string, updates: Partial<EditableTask>) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.breakdown_item_id === taskId ? { ...t, ...updates } : t
      )
    );
  };

  const selectedTasks = tasks.filter((t) => t.selected);
  const selectedCount = selectedTasks.length;

  const handleCreate = async () => {
    if (selectedCount === 0) {
      toast({
        title: 'No tasks selected',
        description: 'Please select at least one task to create.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const tasksToCreate = selectedTasks.map((t) => ({
        title: t.title,
        description: t.description,
        department: t.department,
        priority: t.priority,
        breakdown_item_id: t.breakdown_item_id,
      }));

      const result = await createTasks.mutateAsync({
        projectId,
        tasks: tasksToCreate,
      });

      toast({
        title: 'Tasks Created',
        description: `Successfully created ${result.tasks_created} tasks.`,
      });

      onSuccess?.(result.tasks_created);
      onClose();
    } catch (error) {
      toast({
        title: 'Failed to create tasks',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-accent-yellow" />
            Generate Tasks from Breakdown
          </DialogTitle>
          <DialogDescription>
            Review and modify the proposed tasks before creating them. You can edit
            task details, change departments/priorities, or exclude tasks you don't want.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading breakdown items...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Tasks to Generate</h3>
            <p className="text-muted-foreground max-w-md">
              No breakdown items found that haven't already had tasks generated.
              Add breakdown items to your scenes first, or enable "regenerate" to
              create tasks for items that already have them.
            </p>
          </div>
        ) : (
          <>
            {/* Selection controls */}
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div className="text-sm text-muted-foreground">
                {selectedCount} of {tasks.length} tasks selected
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>

            {/* Task list */}
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2 py-2">
                {sceneNumbers.map((sceneNumber) => {
                  const sceneTasks = tasksByScene[sceneNumber];
                  const isExpanded = expandedScenes.has(sceneNumber);
                  const selectedInScene = sceneTasks.filter((t) => t.selected).length;
                  const allSelected = selectedInScene === sceneTasks.length;
                  const someSelected = selectedInScene > 0 && !allSelected;

                  return (
                    <Collapsible
                      key={sceneNumber}
                      open={isExpanded}
                      onOpenChange={() => toggleScene(sceneNumber)}
                    >
                      <div className="rounded-lg border border-border bg-muted/30">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <Checkbox
                              checked={allSelected}
                              ref={(ref) => {
                                if (ref && someSelected) {
                                  ref.dataset.state = 'indeterminate';
                                }
                              }}
                              onCheckedChange={(checked) => {
                                toggleAllInScene(sceneNumber, !!checked);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium text-bone-white">
                              Scene {sceneNumber}
                            </span>
                            <Badge variant="secondary" className="ml-auto">
                              {selectedInScene}/{sceneTasks.length} tasks
                            </Badge>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="border-t border-border divide-y divide-border">
                            {sceneTasks.map((task) => (
                              <TaskRow
                                key={task.breakdown_item_id}
                                task={task}
                                onToggleSelect={() => toggleTaskSelection(task.breakdown_item_id)}
                                onStartEdit={() => startEditing(task.breakdown_item_id)}
                                onStopEdit={() => stopEditing(task.breakdown_item_id)}
                                onUpdate={(updates) => updateTask(task.breakdown_item_id, updates)}
                                getPriorityColor={getPriorityColor}
                              />
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createTasks.isPending || selectedCount === 0 || isLoading}
          >
            {createTasks.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Create {selectedCount} Task{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TaskRowProps {
  task: EditableTask;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onUpdate: (updates: Partial<EditableTask>) => void;
  getPriorityColor: (priority: string) => string;
}

function TaskRow({
  task,
  onToggleSelect,
  onStartEdit,
  onStopEdit,
  onUpdate,
  getPriorityColor,
}: TaskRowProps) {
  if (task.isEditing) {
    return (
      <div className="p-3 space-y-3 bg-muted/20">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.selected}
            onCheckedChange={onToggleSelect}
            className="mt-1"
          />
          <div className="flex-1 space-y-3">
            <Input
              value={task.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Task title"
              className="font-medium"
            />
            <Textarea
              value={task.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Description"
              rows={2}
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <Select
                  value={task.department}
                  onValueChange={(value) => onUpdate({ department: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Select
                  value={task.priority}
                  onValueChange={(value) => onUpdate({ priority: value as BacklotTaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onStopEdit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'p-3 flex items-start gap-3 transition-colors',
        !task.selected && 'opacity-50'
      )}
    >
      <Checkbox
        checked={task.selected}
        onCheckedChange={onToggleSelect}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="font-medium text-bone-white text-sm truncate flex-1">
            {task.title}
          </span>
          <Badge
            variant="outline"
            className={cn('text-xs shrink-0', getPriorityColor(task.priority))}
          >
            {task.priority}
          </Badge>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            {task.department}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {task.item_type.replace('_', ' ')}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={onStartEdit}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default TaskGeneratePreviewModal;
