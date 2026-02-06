/**
 * ScheduleReorderView - UI for reordering the unified schedule (scenes + blocks)
 *
 * Features:
 * - Drag-and-drop reordering using @dnd-kit
 * - Up/down arrow buttons for mobile-friendly reordering
 * - Local state for preview before save
 * - Save/Cancel buttons
 * - Shows item type, name, and planned time
 * - Add Scene/Activity buttons (Phase 1)
 * - Delete button for pending items (Phase 1)
 * - Swap button for scenes (Phase 2)
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronUp,
  ChevronDown,
  Save,
  X,
  Clapperboard,
  Coffee,
  Truck,
  Activity,
  Sun,
  Play,
  Flag,
  GripVertical,
  Lock,
  Trash2,
  Film,
  Clock,
  ArrowLeftRight,
  Camera,
  Lightbulb,
  Minus as MinusIcon,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectedScheduleItem, HotSetSceneLog } from '@/types/backlot';
import { formatScheduleTime } from '@/hooks/backlot';

interface ScheduleReorderViewProps {
  items: ProjectedScheduleItem[];
  onSave: (orderedItems: Array<{ id: string; type: 'scene' | 'block'; duration_minutes?: number }>) => void;
  onCancel: () => void;
  isSaving?: boolean;
  timezone?: string | null;
  // Schedule modification callbacks
  onAddScene?: () => void;
  onAddActivity?: () => void;
  onDeleteScene?: (logId: string, sceneNumber: string) => void;
  onDeleteActivity?: (blockId: string, name: string) => void;
  onSwapScene?: (sceneLog: HotSetSceneLog) => void;
  isDeleting?: boolean;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'scene':
      return Clapperboard;
    case 'meal':
      return Coffee;
    case 'company_move':
      return Truck;
    case 'crew_call':
      return Sun;
    case 'first_shot':
      return Play;
    case 'wrap':
      return Flag;
    case 'camera_reset':
      return Camera;
    case 'lighting_reset':
      return Lightbulb;
    default:
      return Activity;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case 'scene':
      return 'text-blue-400';
    case 'meal':
      return 'text-green-400';
    case 'company_move':
      return 'text-orange-400';
    case 'activity':
      return 'text-purple-400';
    case 'crew_call':
      return 'text-yellow-400';
    case 'first_shot':
      return 'text-red-400';
    case 'wrap':
      return 'text-muted-gray';
    case 'camera_reset':
      return 'text-blue-400';
    case 'lighting_reset':
      return 'text-yellow-400';
    default:
      return 'text-muted-gray';
  }
};

const getTypeBadgeClass = (type: string) => {
  switch (type) {
    case 'scene':
      return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    case 'meal':
      return 'text-green-400 border-green-500/30 bg-green-500/10';
    case 'company_move':
      return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    case 'crew_call':
      return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/30';
    case 'first_shot':
      return 'text-red-400 border-red-500/30 bg-red-500/10';
    case 'wrap':
      return 'text-muted-gray border-muted-gray/30 bg-muted-gray/10';
    case 'camera_reset':
      return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    case 'lighting_reset':
      return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    default:
      return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'scene':
      return 'Scene';
    case 'meal':
      return 'Meal';
    case 'company_move':
      return 'Move';
    case 'crew_call':
      return 'Call';
    case 'first_shot':
      return '1st Shot';
    case 'wrap':
      return 'Wrap';
    case 'activity':
      return 'Activity';
    case 'camera_reset':
      return 'Camera';
    case 'lighting_reset':
      return 'Lighting';
    default:
      return type.replace(/_/g, ' ');
  }
};

// --- Projection calculation helpers ---

function timeToMinutes(time: string | undefined | null): number | null {
  if (!time) return null;
  try {
    const [h, m] = time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

interface ProjectedItem extends ProjectedScheduleItem {
  projectedStart?: string;
  projectedEnd?: string;
  projectedVariance?: number; // positive = ahead, negative = behind
  effectiveDuration: number;
}

function recalculateProjections(
  lockedItems: ProjectedScheduleItem[],
  pendingItems: ProjectedScheduleItem[],
  durationOverrides: Map<string, number>,
): ProjectedItem[] {
  // Compute cumulative variance from locked (completed/skipped) items
  let cumulativeVariance = 0; // in minutes; positive = ahead of schedule
  let cascadedEndMinutes: number | null = null;

  for (const item of lockedItems) {
    const plannedDuration = item.planned_duration_minutes || 0;
    const actualDuration = item.actual_duration_minutes ?? plannedDuration;
    cumulativeVariance += plannedDuration - actualDuration; // ahead if actual < planned

    const plannedEnd = timeToMinutes(item.planned_end_time);
    const actualEnd = timeToMinutes(item.actual_end_time);
    if (actualEnd !== null) {
      cascadedEndMinutes = actualEnd;
    } else if (plannedEnd !== null) {
      cascadedEndMinutes = plannedEnd;
    }
  }

  const projected: ProjectedItem[] = [];

  for (const item of pendingItems) {
    const effectiveDuration = durationOverrides.get(item.id) ?? item.planned_duration_minutes ?? 0;
    const plannedStart = timeToMinutes(item.planned_start_time);

    let projectedStartMin: number;
    if (plannedStart !== null) {
      const adjustedPlanned = plannedStart - cumulativeVariance;
      if (cascadedEndMinutes !== null) {
        projectedStartMin = Math.max(cascadedEndMinutes, adjustedPlanned);
      } else {
        projectedStartMin = adjustedPlanned;
      }
    } else if (cascadedEndMinutes !== null) {
      projectedStartMin = cascadedEndMinutes;
    } else {
      // No reference point — keep as-is
      projected.push({
        ...item,
        effectiveDuration,
      });
      continue;
    }

    const projectedEndMin = projectedStartMin + effectiveDuration;
    const variance = plannedStart !== null ? plannedStart - projectedStartMin : 0;

    // Update the duration variance for subsequent items
    const originalDuration = item.planned_duration_minutes ?? 0;
    cumulativeVariance += originalDuration - effectiveDuration;

    cascadedEndMinutes = projectedEndMin;

    projected.push({
      ...item,
      effectiveDuration,
      projectedStart: minutesToTime(projectedStartMin),
      projectedEnd: minutesToTime(projectedEndMin),
      projectedVariance: variance, // positive = ahead of schedule
    });
  }

  return projected;
}

// Sortable item component
interface SortableItemProps {
  item: ProjectedItem;
  index: number;
  lockedCount: number;
  totalCount: number;
  timezone?: string | null;
  isSaving: boolean;
  isDeleting: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSwap?: () => void;
  canDelete: boolean;
  canSwap: boolean;
  onDurationChange: (duration: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  item,
  index,
  lockedCount,
  totalCount,
  timezone,
  isSaving,
  isDeleting,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSwap,
  canDelete,
  canSwap,
  onDurationChange,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const TypeIcon = getTypeIcon(item.type);
  const typeColor = getTypeColor(item.type);
  const isSkipped = item.status === 'skipped';
  const canMoveUp = index > 0;
  const canMoveDown = index < totalCount - 1;
  const displayPosition = lockedCount + index + 1;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
        isSkipped && 'opacity-50',
        isDragging
          ? 'bg-accent-yellow/20 border-accent-yellow/50 shadow-lg z-50'
          : 'bg-charcoal-black/50 border-muted-gray/10 hover:border-muted-gray/30'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4 text-muted-gray/50 hover:text-muted-gray" />
      </div>

      {/* Position number */}
      <div className="w-6 h-6 rounded-full bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-muted-gray">{displayPosition}</span>
      </div>

      {/* Type badge */}
      <Badge
        variant="outline"
        className={cn('text-xs capitalize flex-shrink-0', getTypeBadgeClass(item.type))}
      >
        <TypeIcon className={cn('w-3 h-3 mr-1', typeColor)} />
        {getTypeLabel(item.type)}
      </Badge>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          'font-medium truncate text-bone-white',
          isSkipped && 'line-through'
        )}>
          {item.name}
        </span>
        {item.description && (
          <span className="text-sm text-muted-gray truncate hidden sm:inline ml-2">
            - {item.description}
          </span>
        )}
      </div>

      {/* Time + projected time */}
      <div className="flex-shrink-0 text-sm hidden sm:block text-right">
        <div className="text-muted-gray">{formatScheduleTime(item.planned_start_time, timezone)}</div>
        {item.projectedStart && (
          <div className={cn(
            'text-xs',
            item.projectedStart === item.planned_start_time
              ? 'text-muted-gray/50'
              : (item.projectedVariance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
          )}>
            → {formatScheduleTime(item.projectedStart, timezone)}
            {item.projectedStart !== item.planned_start_time && (
              <span className="ml-1">
                ({(item.projectedVariance ?? 0) > 0 ? '-' : '+'}{Math.abs(item.projectedVariance ?? 0)}m)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Duration editing */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDurationChange(Math.max(5, item.effectiveDuration - 5))}
          disabled={isSaving || item.effectiveDuration <= 5}
          className="h-6 w-6 p-0 text-muted-gray hover:text-bone-white hover:bg-muted-gray/20"
          title="Decrease 5 min"
        >
          <MinusIcon className="w-3 h-3" />
        </Button>
        <input
          type="number"
          min={5}
          step={5}
          value={item.effectiveDuration}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 5) onDurationChange(v);
          }}
          disabled={isSaving}
          className="w-10 h-6 text-center text-xs bg-charcoal-black/50 border border-muted-gray/20 rounded text-bone-white focus:border-accent-yellow/50 focus:outline-none"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDurationChange(item.effectiveDuration + 5)}
          disabled={isSaving}
          className="h-6 w-6 p-0 text-muted-gray hover:text-bone-white hover:bg-muted-gray/20"
          title="Increase 5 min"
        >
          <Plus className="w-3 h-3" />
        </Button>
        <span className="text-xs text-muted-gray/70 w-3">m</span>
      </div>

      {/* Swap button (only for scenes) */}
      {canSwap && onSwap && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onSwap}
          disabled={isDeleting || isSaving}
          className="h-6 w-6 p-0 text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 flex-shrink-0"
          title="Swap with scene from another day"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </Button>
      )}

      {/* Delete button */}
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isDeleting || isSaving}
          className="h-6 w-6 p-0 text-muted-gray hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
          title="Remove from schedule"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}

      {/* Reorder buttons (for mobile/accessibility) */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onMoveUp}
          disabled={!canMoveUp || isSaving}
          className={cn(
            'h-5 w-5 p-0',
            canMoveUp ? 'hover:bg-accent-yellow/20 text-muted-gray hover:text-accent-yellow' : 'opacity-30'
          )}
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onMoveDown}
          disabled={!canMoveDown || isSaving}
          className={cn(
            'h-5 w-5 p-0',
            canMoveDown ? 'hover:bg-accent-yellow/20 text-muted-gray hover:text-accent-yellow' : 'opacity-30'
          )}
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

export const ScheduleReorderView: React.FC<ScheduleReorderViewProps> = ({
  items: initialItems,
  onSave,
  onCancel,
  isSaving = false,
  timezone,
  onAddScene,
  onAddActivity,
  onDeleteScene,
  onDeleteActivity,
  onSwapScene,
  isDeleting = false,
}) => {
  // Filter out imported items that don't have a source_id (can't be reordered)
  const validItems = initialItems.filter(
    item => item.source_type !== 'imported' && item.source_id
  );
  const filteredOutCount = initialItems.length - validItems.length;

  // Separate completed/in_progress items (locked) from pending items (reorderable)
  const lockedItems = validItems.filter(
    item => item.status === 'completed' || item.status === 'in_progress'
  );
  const pendingItems = validItems.filter(
    item => item.status === 'pending' || item.status === 'skipped'
  );

  const [orderedPendingItems, setOrderedPendingItems] = useState(pendingItems);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<ProjectedScheduleItem | null>(null);
  const [durationOverrides, setDurationOverrides] = useState<Map<string, number>>(new Map());

  // Sync local state when items change from parent (e.g., after swap, add, or delete)
  // Use JSON.stringify of IDs to detect actual content changes
  const pendingItemIds = pendingItems.map(i => i.id).join(',');
  useEffect(() => {
    // Update local state to reflect new items from parent
    // This ensures swaps, adds, and deletes are reflected immediately
    setOrderedPendingItems(pendingItems);
    // Clear stale overrides for items that no longer exist
    setDurationOverrides(prev => {
      const currentIds = new Set(pendingItems.map(i => i.id));
      const next = new Map(prev);
      let changed = false;
      for (const key of next.keys()) {
        if (!currentIds.has(key)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pendingItemIds]); // Depend on actual item IDs to catch content changes

  // Live projection recalculation
  const projectedPendingItems = useMemo(
    () => recalculateProjections(lockedItems, orderedPendingItems, durationOverrides),
    [lockedItems, orderedPendingItems, durationOverrides]
  );

  // Projected wrap time (end of last item)
  const projectedWrapTime = useMemo(() => {
    if (projectedPendingItems.length === 0) return null;
    const last = projectedPendingItems[projectedPendingItems.length - 1];
    return last.projectedEnd || last.planned_end_time;
  }, [projectedPendingItems]);

  // Original wrap time for comparison
  const originalWrapTime = useMemo(() => {
    if (pendingItems.length === 0) return null;
    const last = pendingItems[pendingItems.length - 1];
    return last.planned_end_time;
  }, [pendingItems]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedPendingItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const moveItem = useCallback((index: number, direction: 'up' | 'down') => {
    setOrderedPendingItems(prev => {
      const newItems = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= newItems.length) return prev;

      // Swap items
      [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
      return newItems;
    });
  }, []);

  // Check if order has changed from the original
  const hasOrderChanges = orderedPendingItems.some(
    (item, index) => item.id !== pendingItems[index]?.id
  );
  const hasDurationChanges = durationOverrides.size > 0;
  const hasChanges = hasOrderChanges || hasDurationChanges;

  const handleSave = useCallback(() => {
    // Don't save if nothing changed
    if (!hasChanges) return;

    // Combine locked items (first) with reordered pending items
    const allItems = [...lockedItems, ...orderedPendingItems];
    const reorderPayload = allItems.map(item => ({
      id: item.source_id!,
      type: (item.source_type === 'scene_log' ? 'scene' : 'block') as 'scene' | 'block',
      ...(durationOverrides.has(item.id) ? { duration_minutes: durationOverrides.get(item.id) } : {}),
    }));
    onSave(reorderPayload);
  }, [lockedItems, orderedPendingItems, onSave, hasChanges, durationOverrides]);

  const handleDeleteClick = useCallback((item: ProjectedScheduleItem) => {
    setDeleteConfirmItem(item);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirmItem || !deleteConfirmItem.source_id) return;

    if (deleteConfirmItem.source_type === 'scene_log') {
      onDeleteScene?.(deleteConfirmItem.source_id, deleteConfirmItem.name);
    } else {
      onDeleteActivity?.(deleteConfirmItem.source_id, deleteConfirmItem.name);
    }
    setDeleteConfirmItem(null);
  }, [deleteConfirmItem, onDeleteScene, onDeleteActivity]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmItem(null);
  }, []);

  const handleSwapClick = useCallback((item: ProjectedScheduleItem) => {
    if (item.source_type !== 'scene_log' || !onSwapScene) return;

    // Convert ProjectedScheduleItem to HotSetSceneLog-like object for swap
    const sceneLog: HotSetSceneLog = {
      id: item.source_id!,
      session_id: '',
      call_sheet_scene_id: null,
      scene_number: item.name,
      set_name: item.description || null,
      int_ext: null,
      description: item.description || null,
      estimated_minutes: item.planned_duration_minutes,
      scheduled_start_time: item.planned_start_time,
      actual_start_time: item.actual_start_time || null,
      actual_end_time: item.actual_end_time || null,
      actual_duration_minutes: item.actual_duration_minutes || null,
      status: item.status as any,
      sort_order: 0,
      notes: null,
      skip_reason: null,
    };

    onSwapScene(sceneLog);
  }, [onSwapScene]);

  const handleDurationChange = useCallback((itemId: string, originalDuration: number, newDuration: number) => {
    setDurationOverrides(prev => {
      const next = new Map(prev);
      if (newDuration === originalDuration) {
        next.delete(itemId);
      } else {
        next.set(itemId, newDuration);
      }
      return next;
    });
  }, []);

  const handleCancel = useCallback(() => {
    setDurationOverrides(new Map());
    onCancel();
  }, [onCancel]);

  const canModifySchedule = onAddScene || onAddActivity || onDeleteScene || onDeleteActivity;

  return (
    <>
      <Card className="bg-soft-black border-muted-gray/20 overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-4 py-3 border-b border-muted-gray/20 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-bone-white">Reorder Schedule</h3>
            <p className="text-xs text-muted-gray mt-0.5 hidden sm:block">
              Drag to reorder, edit durations to see projected times
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
              className="text-muted-gray hover:text-bone-white"
            >
              <X className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Cancel</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <Save className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </div>
        </div>

        {/* Action toolbar for adding items */}
        {canModifySchedule && (
          <div className="px-3 sm:px-4 py-2 border-b border-muted-gray/20 flex flex-wrap items-center gap-2 bg-charcoal-black/30">
            {onAddScene && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddScene}
                className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              >
                <Film className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Add Scene</span>
              </Button>
            )}
            {onAddActivity && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddActivity}
                className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
              >
                <Clock className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Add Activity</span>
              </Button>
            )}
          </div>
        )}

        {/* Items list */}
        <div className="p-3 space-y-1">
          {validItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-gray">No items to reorder</p>
              <p className="text-sm text-muted-gray/70 mt-1">
                Import a schedule to start reordering
              </p>
              {canModifySchedule && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {onAddScene && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAddScene}
                      className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                    >
                      <Film className="w-4 h-4 mr-1" />
                      Add Scene
                    </Button>
                  )}
                  {onAddActivity && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAddActivity}
                      className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Add Activity
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Locked items (completed/in_progress) - shown first, not movable */}
              {lockedItems.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-muted-gray mb-2 px-1 flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    <span>Completed - cannot be reordered</span>
                  </div>
                  {lockedItems.map((item, index) => {
                    const TypeIcon = getTypeIcon(item.type);
                    const typeColor = getTypeColor(item.type);
                    const isCompleted = item.status === 'completed';
                    const isInProgress = item.status === 'in_progress' || item.is_current;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors opacity-60',
                          isCompleted && 'bg-green-500/5 border-green-500/20',
                          isInProgress && 'bg-accent-yellow/10 border-accent-yellow/30'
                        )}
                      >
                        {/* Lock icon instead of grip */}
                        <Lock className="w-4 h-4 text-muted-gray/30 flex-shrink-0" />

                        {/* Position number */}
                        <div className="w-6 h-6 rounded-full bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-muted-gray">{index + 1}</span>
                        </div>

                        {/* Type badge */}
                        <Badge
                          variant="outline"
                          className={cn('text-xs capitalize flex-shrink-0', getTypeBadgeClass(item.type))}
                        >
                          <TypeIcon className={cn('w-3 h-3 mr-1', typeColor)} />
                          {getTypeLabel(item.type)}
                        </Badge>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            'font-medium truncate',
                            isCompleted && 'text-muted-gray',
                            isInProgress && 'text-accent-yellow'
                          )}>
                            {item.name}
                          </span>
                          {item.description && (
                            <span className="text-sm text-muted-gray truncate hidden sm:inline ml-2">
                              - {item.description}
                            </span>
                          )}
                        </div>

                        {/* Time */}
                        <div className="flex-shrink-0 text-sm text-muted-gray hidden sm:block">
                          {formatScheduleTime(item.planned_start_time, timezone)}
                        </div>

                        {/* Duration */}
                        <div className="flex-shrink-0 text-xs text-muted-gray/70 w-10 text-right">
                          {item.planned_duration_minutes}m
                        </div>

                        {/* Empty space where buttons would be */}
                        <div className="w-20 flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pending items - reorderable with drag-and-drop */}
              {orderedPendingItems.length > 0 && (
                <div>
                  {lockedItems.length > 0 && (
                    <div className="text-xs text-muted-gray mb-2 px-1 flex items-center gap-2">
                      <GripVertical className="w-3 h-3" />
                      <span>Pending - drag to reorder</span>
                      {onSwapScene && (
                        <span className="ml-2">
                          | <ArrowLeftRight className="w-3 h-3 inline" /> swap scenes
                        </span>
                      )}
                    </div>
                  )}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={orderedPendingItems.map(item => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {projectedPendingItems.map((item, index) => {
                          const canDelete = (item.source_type === 'scene_log' && onDeleteScene) ||
                            (item.source_type === 'schedule_block' && onDeleteActivity);
                          const canSwap = item.source_type === 'scene_log' && !!onSwapScene;

                          return (
                            <SortableItem
                              key={item.id}
                              item={item}
                              index={index}
                              lockedCount={lockedItems.length}
                              totalCount={projectedPendingItems.length}
                              timezone={timezone}
                              isSaving={isSaving}
                              isDeleting={isDeleting}
                              onMoveUp={() => moveItem(index, 'up')}
                              onMoveDown={() => moveItem(index, 'down')}
                              onDelete={() => handleDeleteClick(item)}
                              onSwap={canSwap ? () => handleSwapClick(item) : undefined}
                              canDelete={!!canDelete}
                              canSwap={canSwap}
                              onDurationChange={(duration) => handleDurationChange(item.id, item.planned_duration_minutes, duration)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </>
          )}
        </div>

        {/* Projected wrap time */}
        {projectedWrapTime && (
          <div className="px-4 py-2 border-t border-muted-gray/10 flex items-center justify-between">
            <span className="text-xs text-muted-gray">Projected Wrap</span>
            <div className="text-xs text-right">
              <span className="text-bone-white font-medium">{formatScheduleTime(projectedWrapTime, timezone)}</span>
              {originalWrapTime && projectedWrapTime !== originalWrapTime && (
                <span className={cn(
                  'ml-2',
                  timeToMinutes(projectedWrapTime)! < timeToMinutes(originalWrapTime)!
                    ? 'text-green-400'
                    : 'text-red-400'
                )}>
                  (planned {formatScheduleTime(originalWrapTime, timezone)})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer hint */}
        {validItems.length > 0 && (
          <div className="px-4 py-2 border-t border-muted-gray/20 text-xs text-muted-gray">
            {hasChanges ? (
              <span className="text-accent-yellow">
                {hasOrderChanges && hasDurationChanges
                  ? 'Order & duration changes pending'
                  : hasDurationChanges
                    ? 'Duration changes pending'
                    : 'Order changes pending'}
                {' '}- click Save to apply
              </span>
            ) : orderedPendingItems.length === 0 ? (
              <span>All items have been completed - nothing to reorder</span>
            ) : (
              <span>
                Drag items to reorder | Edit durations to preview projected times
                {onSwapScene && <> | Click <ArrowLeftRight className="w-3 h-3 inline mx-1" /> to swap a scene</>}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmItem} onOpenChange={(open) => !open && handleCancelDelete()}>
        <AlertDialogContent className="bg-soft-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">
              Remove {deleteConfirmItem?.source_type === 'scene_log' ? 'Scene' : 'Activity'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              Are you sure you want to remove <span className="text-bone-white font-medium">{deleteConfirmItem?.name}</span> from the schedule?
              {deleteConfirmItem?.source_type === 'scene_log' && (
                <span className="block mt-2">
                  The scene will remain assigned to this production day but will be removed from today's Hot Set.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelDelete}
              className="bg-charcoal-black border-muted-gray/30 text-bone-white hover:bg-muted-gray/20"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
