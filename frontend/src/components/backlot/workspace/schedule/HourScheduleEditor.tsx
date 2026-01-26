/**
 * HourScheduleEditor - Full editor modal with drag-and-drop timeline
 *
 * Allows users to manually edit the hour schedule:
 * - Reorder blocks via drag-and-drop
 * - Adjust individual block times and durations
 * - Add/remove activity blocks
 * - Recalculate times automatically
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Clock,
  Loader2,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Film,
  Utensils,
  Timer,
} from 'lucide-react';
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
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import {
  HourScheduleBlock,
  HourScheduleBlockType,
  HourScheduleConfig,
  BacklotProductionDay,
  DEFAULT_HOUR_SCHEDULE_CONFIG,
  NonScriptedSegmentCategory,
} from '@/types/backlot';
import {
  getScheduleSummary,
  recalculateScheduleTimes,
  createBlock,
  generateBlockId,
} from '@/lib/backlot/hourScheduleUtils';
import {
  SortableTimelineBlock,
  getBlockIcon,
  getBlockColor,
} from './HourScheduleTimeline';

// ============================================================================
// TYPES
// ============================================================================

interface HourScheduleEditorProps {
  day: BacklotProductionDay;
  schedule: HourScheduleBlock[];
  config: HourScheduleConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: HourScheduleBlock[], config: HourScheduleConfig) => Promise<void>;
}

// ============================================================================
// BLOCK EDIT SHEET
// ============================================================================

interface BlockEditSheetProps {
  block: HourScheduleBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (block: HourScheduleBlock) => void;
  onDelete: (blockId: string) => void;
}

const BlockEditSheet: React.FC<BlockEditSheetProps> = ({
  block,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [editedBlock, setEditedBlock] = useState<HourScheduleBlock | null>(null);

  React.useEffect(() => {
    setEditedBlock(block);
  }, [block]);

  if (!editedBlock) return null;

  const handleSave = () => {
    onSave(editedBlock);
    onClose();
  };

  const handleDelete = () => {
    onDelete(editedBlock.id);
    onClose();
  };

  const canDelete = !['crew_call', 'wrap'].includes(editedBlock.type);
  const canEditTime = true;
  const canEditDuration = editedBlock.duration_minutes > 0;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded', getBlockColor(editedBlock.type))}>
              {getBlockIcon(editedBlock.type)}
            </div>
            Edit Block
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Block Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Badge className={getBlockColor(editedBlock.type)}>
              {editedBlock.type.replace('_', ' ')}
            </Badge>
          </div>

          {/* Start Time */}
          {canEditTime && (
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={editedBlock.start_time}
                onChange={(e) =>
                  setEditedBlock({ ...editedBlock, start_time: e.target.value })
                }
              />
            </div>
          )}

          {/* Duration */}
          {canEditDuration && (
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                step={5}
                value={editedBlock.duration_minutes}
                onChange={(e) =>
                  setEditedBlock({
                    ...editedBlock,
                    duration_minutes: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          )}

          {/* Activity Name (for non-scene blocks) */}
          {editedBlock.type !== 'scene' && (
            <div className="space-y-2">
              <Label htmlFor="activity_name">Activity Name</Label>
              <Input
                id="activity_name"
                value={editedBlock.activity_name || ''}
                onChange={(e) =>
                  setEditedBlock({ ...editedBlock, activity_name: e.target.value })
                }
              />
            </div>
          )}

          {/* Scene Info (read-only for scene blocks) */}
          {editedBlock.type === 'scene' && (
            <div className="space-y-3 p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
              <div>
                <Label className="text-muted-gray">Scene Number</Label>
                <p className="text-bone-white">{editedBlock.scene_number}</p>
              </div>
              {editedBlock.scene_slugline && (
                <div>
                  <Label className="text-muted-gray">Slugline</Label>
                  <p className="text-bone-white">{editedBlock.scene_slugline}</p>
                </div>
              )}
              {editedBlock.page_count && (
                <div>
                  <Label className="text-muted-gray">Page Count</Label>
                  <p className="text-bone-white">{editedBlock.page_count} pages</p>
                </div>
              )}
            </div>
          )}

          {/* Segment Info */}
          {editedBlock.type === 'segment' && (
            <div className="space-y-3 p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
              {editedBlock.segment_category && (
                <div>
                  <Label className="text-muted-gray">Category</Label>
                  <p className="text-bone-white capitalize">
                    {editedBlock.segment_category.replace('_', ' ')}
                  </p>
                </div>
              )}
              {editedBlock.segment_description && (
                <div>
                  <Label className="text-muted-gray">Description</Label>
                  <p className="text-bone-white">{editedBlock.segment_description}</p>
                </div>
              )}
              {editedBlock.location_name && (
                <div>
                  <Label className="text-muted-gray">Location</Label>
                  <p className="text-bone-white">{editedBlock.location_name}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={editedBlock.activity_notes || ''}
              onChange={(e) =>
                setEditedBlock({ ...editedBlock, activity_notes: e.target.value })
              }
              rows={3}
            />
          </div>
        </div>

        <SheetFooter className="flex gap-2">
          {canDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Check className="w-4 h-4 mr-1" />
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

// ============================================================================
// ADD BLOCK DIALOG
// ============================================================================

interface AddBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (block: HourScheduleBlock) => void;
  defaultTime: string;
}

const AddBlockDialog: React.FC<AddBlockDialogProps> = ({
  isOpen,
  onClose,
  onAdd,
  defaultTime,
}) => {
  const [blockType, setBlockType] = useState<HourScheduleBlockType>('activity');
  const [activityName, setActivityName] = useState('');
  const [startTime, setStartTime] = useState(defaultTime);
  const [duration, setDuration] = useState(30);

  const handleAdd = () => {
    const newBlock = createBlock(blockType, startTime, duration, {
      activity_name: activityName || 'Custom Activity',
    });
    onAdd(newBlock);
    onClose();
    // Reset form
    setBlockType('activity');
    setActivityName('');
    setDuration(30);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Block</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Block Type</Label>
            <Select
              value={blockType}
              onValueChange={(v) => setBlockType(v as HourScheduleBlockType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activity">
                  <span className="flex items-center gap-2">
                    <Timer className="w-4 h-4" /> Activity
                  </span>
                </SelectItem>
                <SelectItem value="meal">
                  <span className="flex items-center gap-2">
                    <Utensils className="w-4 h-4" /> Meal Break
                  </span>
                </SelectItem>
                <SelectItem value="company_move">
                  <span className="flex items-center gap-2">
                    <Film className="w-4 h-4" /> Company Move
                  </span>
                </SelectItem>
                <SelectItem value="segment">
                  <span className="flex items-center gap-2">
                    <Timer className="w-4 h-4" /> Segment
                  </span>
                </SelectItem>
                <SelectItem value="custom">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Custom
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add_name">Activity Name</Label>
            <Input
              id="add_name"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="e.g., Blocking, Setup, Rehearsal"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="add_time">Start Time</Label>
              <Input
                id="add_time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add_duration">Duration (min)</Label>
              <Input
                id="add_duration"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-1" />
            Add Block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// MAIN EDITOR COMPONENT
// ============================================================================

export const HourScheduleEditor: React.FC<HourScheduleEditorProps> = ({
  day,
  schedule: initialSchedule,
  config: initialConfig,
  isOpen,
  onClose,
  onSave,
}) => {
  // State
  const [schedule, setSchedule] = useState<HourScheduleBlock[]>(initialSchedule);
  const [config, setConfig] = useState<HourScheduleConfig>(initialConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [editingBlock, setEditingBlock] = useState<HourScheduleBlock | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setSchedule(initialSchedule);
      setConfig(initialConfig);
    }
  }, [isOpen, initialSchedule, initialConfig]);

  // Summary
  const summary = useMemo(() => getScheduleSummary(schedule), [schedule]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSchedule((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newSchedule = arrayMove(items, oldIndex, newIndex);
        // Update sort orders
        return newSchedule.map((block, index) => ({ ...block, sort_order: index }));
      });
    }
  }, []);

  // Handle block click
  const handleBlockClick = useCallback((block: HourScheduleBlock) => {
    setEditingBlock(block);
  }, []);

  // Handle block save
  const handleBlockSave = useCallback((updatedBlock: HourScheduleBlock) => {
    setSchedule((items) =>
      items.map((item) => (item.id === updatedBlock.id ? updatedBlock : item))
    );
  }, []);

  // Handle block delete
  const handleBlockDelete = useCallback((blockId: string) => {
    setSchedule((items) => items.filter((item) => item.id !== blockId));
  }, []);

  // Handle add block
  const handleAddBlock = useCallback((newBlock: HourScheduleBlock) => {
    setSchedule((items) => [...items, { ...newBlock, sort_order: items.length }]);
  }, []);

  // Recalculate times
  const handleRecalculate = useCallback(() => {
    const crewCallBlock = schedule.find((b) => b.type === 'crew_call');
    const crewCallTime = crewCallBlock?.start_time || config.crew_call_time;
    const recalculated = recalculateScheduleTimes(schedule, crewCallTime, config);
    setSchedule(recalculated);
  }, [schedule, config]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(schedule, config);
      onClose();
    } catch (error) {
      console.error('Failed to save schedule:', error);
    } finally {
      setIsSaving(false);
    }
  }, [schedule, config, onSave, onClose]);

  // Get default time for new blocks
  const getDefaultAddTime = () => {
    if (schedule.length === 0) return config.crew_call_time;
    const lastBlock = schedule[schedule.length - 1];
    return lastBlock.end_time;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-yellow" />
              Edit Hour Schedule
              <Badge variant="outline" className="ml-2 text-xs">
                Day {day.day_number}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center justify-between py-2 border-b border-muted-gray/20">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {summary.totalDurationFormatted}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Film className="w-3 h-3" />
                {summary.sceneCount} scenes
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecalculate}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Recalculate Times
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Block
              </Button>
            </div>
          </div>

          {/* Timeline */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              {schedule.length === 0 ? (
                <div className="text-center py-8 text-muted-gray">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No schedule blocks</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add First Block
                  </Button>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={schedule.map((b) => b.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-0">
                      {schedule.map((block, index) => (
                        <SortableTimelineBlock
                          key={block.id}
                          id={block.id}
                          block={block}
                          isLast={index === schedule.length - 1}
                          onClick={handleBlockClick}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-muted-gray/20 pt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Edit Sheet */}
      <BlockEditSheet
        block={editingBlock}
        isOpen={!!editingBlock}
        onClose={() => setEditingBlock(null)}
        onSave={handleBlockSave}
        onDelete={handleBlockDelete}
      />

      {/* Add Block Dialog */}
      <AddBlockDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={handleAddBlock}
        defaultTime={getDefaultAddTime()}
      />
    </>
  );
};

export default HourScheduleEditor;
