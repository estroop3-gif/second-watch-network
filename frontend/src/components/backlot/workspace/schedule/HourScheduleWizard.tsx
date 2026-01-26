/**
 * HourScheduleWizard - Hour-by-hour schedule generation wizard
 *
 * 5-step wizard for generating detailed production day schedules:
 * 0. Mode Selection - Choose Scripted/Non-Scripted/Mixed
 * 1. Configuration - Set timing parameters (crew call, pages/hour, meal rules)
 * 2. Content - Scene list (scripted) / Segment selection (non-scripted) / Both (mixed)
 * 3. Activities - Configure pre-shoot and wrap activities
 * 4. Preview - Review generated schedule with visual timeline
 * 5. Apply - Save and optionally sync to call sheet
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
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
  Clock,
  Loader2,
  Check,
  ChevronRight,
  ChevronLeft,
  Film,
  FileText,
  Utensils,
  Play,
  Truck,
  Flag,
  Timer,
  GripVertical,
  Trash2,
  Plus,
  Edit,
  X,
  Video,
  Layers,
  RefreshCw,
  Sun,
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  HourScheduleBlock,
  HourScheduleConfig,
  BacklotProductionDay,
  ProductionDayScene,
  DEFAULT_HOUR_SCHEDULE_CONFIG,
  PAGES_PER_HOUR_PRESETS,
  HourScheduleMode,
  NonScriptedSegment,
  NonScriptedSegmentPreset,
} from '@/types/backlot';
import {
  generateHourSchedule,
  generateHourScheduleWithSegments,
  formatTimeDisplay,
  getScheduleSummary,
  FIRST_SHOT_OFFSET_OPTIONS,
  MEAL_AFTER_HOURS_OPTIONS,
  MEAL_DURATION_OPTIONS,
  COMPANY_MOVE_DURATION_OPTIONS,
  DEFAULT_ACTIVITY_BLOCKS,
  getPagesPerHourLabel,
  DefaultActivityBlock,
  getScenePageCount,
  recalculateScheduleTimes,
  addMinutesToTime,
  generateBlockId,
} from '@/lib/backlot/hourScheduleUtils';
import { ModeSelector } from './ModeSelector';
import { SegmentSelector } from './SegmentSelector';
import { AddCustomSegmentDialog } from './AddCustomSegmentDialog';

// ============================================================================
// TYPES
// ============================================================================

interface HourScheduleWizardProps {
  projectId: string;
  day: BacklotProductionDay;
  scenes: ProductionDayScene[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (schedule: HourScheduleBlock[], config: HourScheduleConfig) => Promise<void>;
  onSyncToCallSheet?: () => void;
  locations?: Array<{ id: string; name: string }>;
  userPresets?: NonScriptedSegmentPreset[];
  onSaveUserPreset?: (preset: NonScriptedSegmentPreset) => void;
}

type WizardStep = 'mode' | 'configure' | 'content' | 'activities' | 'preview' | 'apply';

interface ActivityItem extends DefaultActivityBlock {
  id: string;
  enabled: boolean;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const StepIndicator: React.FC<{
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}> = ({ number, label, active, completed }) => (
  <div className="flex items-center gap-2">
    <div
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
        active
          ? 'bg-accent-yellow text-charcoal-black'
          : completed
          ? 'bg-green-500 text-white'
          : 'bg-muted-gray/20 text-muted-gray'
      )}
    >
      {completed ? <Check className="w-3 h-3" /> : number}
    </div>
    <span
      className={cn(
        'text-sm',
        active ? 'text-bone-white font-medium' : 'text-muted-gray'
      )}
    >
      {label}
    </span>
  </div>
);

// Block type icon mapping
function getBlockIcon(type: string) {
  switch (type) {
    case 'scene': return <Film className="w-4 h-4" />;
    case 'meal': return <Utensils className="w-4 h-4" />;
    case 'crew_call': return <Flag className="w-4 h-4" />;
    case 'first_shot': return <Play className="w-4 h-4" />;
    case 'company_move': return <Truck className="w-4 h-4" />;
    case 'wrap': return <Flag className="w-4 h-4" />;
    case 'activity': return <Timer className="w-4 h-4" />;
    case 'camera_reset': return <RefreshCw className="w-4 h-4" />;
    case 'lighting_reset': return <Sun className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
}

// Block type color mapping
function getBlockColor(type: string): string {
  switch (type) {
    case 'scene': return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
    case 'meal': return 'bg-orange-500/20 border-orange-500/40 text-orange-400';
    case 'crew_call': return 'bg-green-500/20 border-green-500/40 text-green-400';
    case 'first_shot': return 'bg-accent-yellow/20 border-accent-yellow/40 text-accent-yellow';
    case 'company_move': return 'bg-purple-500/20 border-purple-500/40 text-purple-400';
    case 'wrap': return 'bg-red-500/20 border-red-500/40 text-red-400';
    case 'activity': return 'bg-muted-gray/20 border-muted-gray/40 text-muted-gray';
    case 'camera_reset': return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400';
    case 'lighting_reset': return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
    default: return 'bg-muted-gray/20 border-muted-gray/40 text-muted-gray';
  }
}

// Sortable activity item with inline editing
const SortableActivityItem: React.FC<{
  item: ActivityItem;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, name: string, duration: number) => void;
}> = ({ item, onToggle, onRemove, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.activity_name);
  const [editDuration, setEditDuration] = useState(item.default_duration_minutes.toString());

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

  const handleSave = () => {
    onUpdate(item.id, editName, parseInt(editDuration) || 0);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(item.activity_name);
    setEditDuration(item.default_duration_minutes.toString());
    setIsEditing(false);
  };

  // Fixed items can't be edited
  const isFixed = ['crew_call', 'wrap', 'first_shot'].includes(item.type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg',
        isDragging ? 'opacity-50 border-accent-yellow' : 'border-muted-gray/20',
        item.enabled ? 'bg-charcoal-black/50' : 'bg-charcoal-black/20 opacity-60'
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-gray hover:text-bone-white"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <Checkbox
        checked={item.enabled}
        onCheckedChange={() => onToggle(item.id)}
      />

      <div className={cn('p-1.5 rounded', getBlockColor(item.type))}>
        {getBlockIcon(item.type)}
      </div>

      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-8 text-sm"
            placeholder="Activity name"
            autoFocus
          />
          <Input
            type="number"
            value={editDuration}
            onChange={(e) => setEditDuration(e.target.value)}
            className="h-8 w-20 text-sm"
            placeholder="Min"
            min={0}
          />
          <Button variant="ghost" size="sm" onClick={handleSave} className="text-green-400 hover:text-green-300">
            <Check className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCancel} className="text-muted-gray hover:text-bone-white">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex-1">
            <p className="text-sm font-medium text-bone-white">{item.activity_name}</p>
            <p className="text-xs text-muted-gray">
              {item.default_duration_minutes > 0
                ? `${item.default_duration_minutes} min`
                : 'Marker'}
            </p>
          </div>

          {!isFixed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="text-muted-gray hover:text-accent-yellow"
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}

          {!['crew_call', 'wrap'].includes(item.type) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(item.id)}
              className="text-muted-gray hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
};

// Schedule block preview item (non-draggable)
const ScheduleBlockItem: React.FC<{
  block: HourScheduleBlock;
  isLast?: boolean;
}> = ({ block, isLast }) => (
  <div className="flex items-start gap-3">
    {/* Time column */}
    <div className="w-20 text-right shrink-0">
      <span className="text-sm font-medium text-bone-white">
        {formatTimeDisplay(block.start_time)}
      </span>
    </div>

    {/* Timeline dot and line */}
    <div className="flex flex-col items-center">
      <div className={cn('w-3 h-3 rounded-full border-2', getBlockColor(block.type))} />
      {!isLast && <div className="w-0.5 flex-1 bg-muted-gray/20 min-h-[2rem]" />}
    </div>

    {/* Block content */}
    <div className={cn(
      'flex-1 p-2 rounded-lg border mb-2',
      getBlockColor(block.type)
    )}>
      <div className="flex items-center gap-2">
        {getBlockIcon(block.type)}
        <span className="font-medium text-sm">
          {block.activity_name || block.scene_number || 'Activity'}
        </span>
        {block.duration_minutes > 0 && (
          <Badge variant="outline" className="ml-auto text-xs">
            {block.duration_minutes} min
          </Badge>
        )}
      </div>

      {block.type === 'scene' && (
        <div className="mt-1 text-xs opacity-80">
          {block.scene_slugline}
          {block.page_count != null && (
            <span className="ml-2">({block.page_count % 1 === 0 ? block.page_count : block.page_count.toFixed(1)} pgs)</span>
          )}
        </div>
      )}

      {block.activity_notes && (
        <p className="mt-1 text-xs opacity-70">{block.activity_notes}</p>
      )}
    </div>
  </div>
);

// Sortable preview item for drag-and-drop in preview step
const SortablePreviewItem: React.FC<{
  block: HourScheduleBlock;
  isLast?: boolean;
  onInsertBefore?: () => void;
  onEditDuration?: (block: HourScheduleBlock) => void;
}> = ({ block, isLast, onInsertBefore, onEditDuration }) => {
  const [showInsert, setShowInsert] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Fixed items shouldn't be draggable
  const isFixed = ['crew_call', 'wrap'].includes(block.type);

  return (
    <>
      {/* Insert button zone */}
      {onInsertBefore && (
        <div
          className="h-3 relative group"
          onMouseEnter={() => setShowInsert(true)}
          onMouseLeave={() => setShowInsert(false)}
        >
          {showInsert && (
            <Button
              size="sm"
              variant="ghost"
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 px-2 py-0 text-xs bg-charcoal-black border border-muted-gray/40 hover:border-accent-yellow"
              onClick={onInsertBefore}
            >
              <Plus className="w-3 h-3 mr-1" /> Insert Activity
            </Button>
          )}
        </div>
      )}

      {/* The draggable block */}
      <div
        ref={setNodeRef}
        style={style}
        className={cn(isDragging && 'opacity-50')}
      >
        <div className="flex items-start gap-3">
          {/* Time column */}
          <div className="w-20 text-right shrink-0">
            <span className="text-sm font-medium text-bone-white">
              {formatTimeDisplay(block.start_time)}
            </span>
          </div>

          {/* Timeline dot and line */}
          <div className="flex flex-col items-center">
            <div className={cn('w-3 h-3 rounded-full border-2', getBlockColor(block.type))} />
            {!isLast && <div className="w-0.5 flex-1 bg-muted-gray/20 min-h-[2rem]" />}
          </div>

          {/* Block content */}
          <div className={cn(
            'flex-1 p-2 rounded-lg border mb-2',
            getBlockColor(block.type),
            isDragging && 'border-accent-yellow'
          )}>
            <div className="flex items-center gap-2">
              {!isFixed && (
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab touch-none text-muted-gray hover:text-bone-white"
                >
                  <GripVertical className="w-4 h-4" />
                </div>
              )}
              {getBlockIcon(block.type)}
              <span className="font-medium text-sm">
                {block.activity_name || block.scene_number || 'Activity'}
              </span>
              {block.duration_minutes > 0 && (
                <Badge
                  variant="outline"
                  className="ml-auto text-xs cursor-pointer hover:bg-accent-yellow/20 hover:border-accent-yellow"
                  onClick={() => onEditDuration?.(block)}
                >
                  {block.duration_minutes} min
                  <Edit className="w-3 h-3 ml-1 opacity-50" />
                </Badge>
              )}
            </div>

            {block.type === 'scene' && (
              <div className={cn("mt-1 text-xs opacity-80", !isFixed && "pl-6")}>
                {block.scene_slugline}
                {block.page_count != null && (
                  <span className="ml-2">({block.page_count % 1 === 0 ? block.page_count : block.page_count.toFixed(1)} pgs)</span>
                )}
              </div>
            )}

            {block.activity_notes && (
              <p className={cn("mt-1 text-xs opacity-70", !isFixed && "pl-6")}>{block.activity_notes}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// EDIT BLOCK DURATION DIALOG
// ============================================================================

const EditBlockDurationDialog: React.FC<{
  isOpen: boolean;
  block: HourScheduleBlock | null;
  onClose: () => void;
  onSave: (blockId: string, newDuration: number) => void;
}> = ({ isOpen, block, onClose, onSave }) => {
  const [duration, setDuration] = useState('');

  // Update duration when block changes
  React.useEffect(() => {
    if (block) {
      setDuration(block.duration_minutes.toString());
    }
  }, [block]);

  const handleSave = () => {
    if (block) {
      const newDuration = parseInt(duration) || 15;
      onSave(block.id, newDuration);
    }
    onClose();
  };

  if (!block) return null;

  const blockLabel = block.type === 'scene'
    ? `Scene ${block.scene_number}`
    : block.activity_name || 'Activity';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-accent-yellow" />
            Edit Duration: {blockLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {block.type === 'scene' && block.scene_slugline && (
            <p className="text-sm text-muted-gray">{block.scene_slugline}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="block_duration">Duration (minutes)</Label>
            <Input
              id="block_duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min={5}
              step={5}
              autoFocus
            />
          </div>

          {/* Quick duration presets */}
          <div className="space-y-2">
            <Label className="text-muted-gray">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {[15, 20, 30, 45, 60, 90, 120].map((mins) => (
                <Button
                  key={mins}
                  variant={parseInt(duration) === mins ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setDuration(mins.toString())}
                >
                  {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Save Duration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// INLINE ACTIVITY DIALOG
// ============================================================================

const InlineActivityDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, durationMinutes: number) => void;
}> = ({ isOpen, onClose, onAdd }) => {
  const [name, setName] = useState('Custom Activity');
  const [duration, setDuration] = useState('30');

  const handleSubmit = () => {
    const durationNum = parseInt(duration) || 30;
    onAdd(name, durationNum);
    setName('Custom Activity');
    setDuration('30');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-accent-yellow" />
            Insert Activity
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="activity_name">Activity Name</Label>
            <Input
              id="activity_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter activity name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="activity_duration">Duration (minutes)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 min</SelectItem>
                <SelectItem value="15">15 min</SelectItem>
                <SelectItem value="20">20 min</SelectItem>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <Label className="text-muted-gray">Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { name: 'Blocking/Rehearsal', duration: 30 },
                { name: 'Hair/Makeup Touch-up', duration: 15 },
                { name: 'Technical Check', duration: 20 },
                { name: 'Cast Break', duration: 15 },
                { name: 'Crew Break', duration: 10 },
                { name: 'Photo Op', duration: 20 },
              ].map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setName(preset.name);
                    setDuration(preset.duration.toString());
                  }}
                >
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Insert Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const HourScheduleWizard: React.FC<HourScheduleWizardProps> = ({
  projectId,
  day,
  scenes,
  isOpen,
  onClose,
  onSave,
  onSyncToCallSheet,
  locations = [],
  userPresets = [],
  onSaveUserPreset,
}) => {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('mode');
  const [isSaving, setIsSaving] = useState(false);

  // Mode state
  const [mode, setMode] = useState<HourScheduleMode>(() =>
    scenes.length > 0 ? 'scripted' : 'non_scripted'
  );

  // Segments state (for non-scripted and mixed modes)
  const [segments, setSegments] = useState<NonScriptedSegment[]>([]);
  const [showAddCustomDialog, setShowAddCustomDialog] = useState(false);

  // Configuration state
  const [config, setConfig] = useState<HourScheduleConfig>(() => ({
    ...DEFAULT_HOUR_SCHEDULE_CONFIG,
    crew_call_time: day.general_call_time?.slice(0, 5) || '06:00',
    mode: scenes.length > 0 ? 'scripted' : 'non_scripted',
  }));

  // Activity blocks state
  const [activityItems, setActivityItems] = useState<ActivityItem[]>(() =>
    DEFAULT_ACTIVITY_BLOCKS.map((block, index) => ({
      ...block,
      id: `activity_${index}`,
      enabled: true,
    }))
  );

  // Generated schedule
  const [generatedSchedule, setGeneratedSchedule] = useState<HourScheduleBlock[]>([]);

  // Inline activity insertion state
  const [showInlineActivityDialog, setShowInlineActivityDialog] = useState(false);
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);

  // Block duration editing state
  const [showEditDurationDialog, setShowEditDurationDialog] = useState(false);
  const [editingBlock, setEditingBlock] = useState<HourScheduleBlock | null>(null);

  // Sync option
  const [syncToCallSheet, setSyncToCallSheet] = useState(true);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Schedule summary
  const summary = useMemo(
    () => getScheduleSummary(generatedSchedule),
    [generatedSchedule]
  );

  // Handle generate
  const handleGenerate = useCallback(() => {
    const schedule = generateHourScheduleWithSegments(scenes, segments, config, mode);
    setGeneratedSchedule(schedule);
    setStep('preview');
  }, [scenes, segments, config, mode]);

  // Handle add custom segment
  const handleAddCustomSegment = useCallback((segment: NonScriptedSegment) => {
    setSegments(prev => [...prev, { ...segment, sort_order: prev.length }]);
  }, []);

  // Handle apply
  const handleApply = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(generatedSchedule, config);
      if (syncToCallSheet && onSyncToCallSheet) {
        onSyncToCallSheet();
      }
      onClose();
    } catch (error) {
      console.error('Failed to save hour schedule:', error);
    } finally {
      setIsSaving(false);
    }
  }, [generatedSchedule, config, syncToCallSheet, onSave, onSyncToCallSheet, onClose]);

  // Handle close
  const handleClose = useCallback(() => {
    setStep('mode');
    setMode(scenes.length > 0 ? 'scripted' : 'non_scripted');
    setSegments([]);
    setGeneratedSchedule([]);
    onClose();
  }, [onClose, scenes.length]);

  // Activity drag end
  const handleActivityDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setActivityItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  // Preview drag end - reorder blocks and recalculate times
  const handlePreviewDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setGeneratedSchedule((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        // Recalculate times after reordering
        return recalculateScheduleTimes(reordered, config.crew_call_time, config);
      });
    }
  }, [config]);

  // Handle inserting activity inline in preview
  const handleInsertActivity = useCallback((index: number) => {
    setInsertAtIndex(index);
    setShowInlineActivityDialog(true);
  }, []);

  // Handle adding inline activity
  const handleAddInlineActivity = useCallback((name: string, durationMinutes: number) => {
    if (insertAtIndex === null) return;

    setGeneratedSchedule((items) => {
      // Get the time at the insert position
      const insertTime = items[insertAtIndex]?.start_time || config.crew_call_time;

      // Create the new activity block
      const newBlock: HourScheduleBlock = {
        id: generateBlockId(),
        type: 'activity',
        start_time: insertTime,
        end_time: addMinutesToTime(insertTime, durationMinutes),
        duration_minutes: durationMinutes,
        activity_name: name,
        sort_order: insertAtIndex,
      };

      // Insert the new block
      const newItems = [...items];
      newItems.splice(insertAtIndex, 0, newBlock);

      // Recalculate all times
      return recalculateScheduleTimes(newItems, config.crew_call_time, config);
    });

    setShowInlineActivityDialog(false);
    setInsertAtIndex(null);
  }, [insertAtIndex, config]);

  // Handle editing block duration
  const handleEditBlockDuration = useCallback((block: HourScheduleBlock) => {
    // Only allow editing blocks with duration > 0
    if (block.duration_minutes > 0) {
      setEditingBlock(block);
      setShowEditDurationDialog(true);
    }
  }, []);

  // Handle saving edited duration
  const handleSaveBlockDuration = useCallback((blockId: string, newDuration: number) => {
    setGeneratedSchedule((items) => {
      const updatedItems = items.map((item) =>
        item.id === blockId
          ? { ...item, duration_minutes: newDuration }
          : item
      );
      // Recalculate all times after duration change
      return recalculateScheduleTimes(updatedItems, config.crew_call_time, config);
    });
    setEditingBlock(null);
  }, [config]);

  // Activity toggle
  const handleActivityToggle = useCallback((id: string) => {
    setActivityItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item
      )
    );
  }, []);

  // Activity remove
  const handleActivityRemove = useCallback((id: string) => {
    setActivityItems((items) => items.filter((item) => item.id !== id));
  }, []);

  // Update activity name/duration
  const handleActivityUpdate = useCallback((id: string, name: string, duration: number) => {
    setActivityItems((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, activity_name: name, default_duration_minutes: duration }
          : item
      )
    );
  }, []);

  // Add custom activity
  const handleAddActivity = useCallback(() => {
    const newItem: ActivityItem = {
      id: `activity_custom_${Date.now()}`,
      type: 'activity',
      activity_name: 'Custom Activity',
      default_duration_minutes: 30,
      enabled: true,
    };
    setActivityItems((items) => [...items, newItem]);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl h-[85vh] max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-yellow" />
            Hour Schedule Wizard
            <Badge variant="outline" className="ml-2 text-xs">
              Day {day.day_number}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-muted-gray/20 overflow-x-auto shrink-0">
          <StepIndicator
            number={1}
            label="Mode"
            active={step === 'mode'}
            completed={['configure', 'content', 'activities', 'preview', 'apply'].includes(step)}
          />
          <ChevronRight className="w-4 h-4 text-muted-gray shrink-0" />
          <StepIndicator
            number={2}
            label="Configure"
            active={step === 'configure'}
            completed={['content', 'activities', 'preview', 'apply'].includes(step)}
          />
          <ChevronRight className="w-4 h-4 text-muted-gray shrink-0" />
          <StepIndicator
            number={3}
            label={mode === 'scripted' ? 'Scenes' : mode === 'non_scripted' ? 'Segments' : 'Content'}
            active={step === 'content'}
            completed={['activities', 'preview', 'apply'].includes(step)}
          />
          <ChevronRight className="w-4 h-4 text-muted-gray shrink-0" />
          <StepIndicator
            number={4}
            label="Activities"
            active={step === 'activities'}
            completed={['preview', 'apply'].includes(step)}
          />
          <ChevronRight className="w-4 h-4 text-muted-gray shrink-0" />
          <StepIndicator
            number={5}
            label="Preview"
            active={step === 'preview'}
            completed={step === 'apply'}
          />
          <ChevronRight className="w-4 h-4 text-muted-gray shrink-0" />
          <StepIndicator
            number={6}
            label="Apply"
            active={step === 'apply'}
            completed={false}
          />
        </div>

        {/* Step Content */}
        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          {/* Step 0: Mode Selection */}
          {step === 'mode' && (
            <div className="p-4">
              <ModeSelector
                selectedMode={mode}
                onModeChange={(newMode) => {
                  setMode(newMode);
                  setConfig(prev => ({ ...prev, mode: newMode }));
                }}
                sceneCount={scenes.length}
              />
            </div>
          )}

          {/* Step 1: Configuration */}
          {step === 'configure' && (
            <div className="space-y-6 p-4">
              <p className="text-sm text-muted-gray">
                Configure timing parameters for the schedule. These settings determine
                scene durations and break placements.
              </p>

              {/* Crew Call Time */}
              <div className="space-y-2">
                <Label htmlFor="crew_call">Crew Call Time</Label>
                <Input
                  id="crew_call"
                  type="time"
                  value={config.crew_call_time}
                  onChange={(e) =>
                    setConfig({ ...config, crew_call_time: e.target.value })
                  }
                />
              </div>

              {/* Pages Per Hour */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Pages Per Hour</Label>
                  <span className="text-sm text-accent-yellow">
                    {config.pages_per_hour} pgs/hr
                    <span className="text-muted-gray ml-1">
                      ({getPagesPerHourLabel(config.pages_per_hour)})
                    </span>
                  </span>
                </div>
                <Slider
                  value={[config.pages_per_hour]}
                  onValueChange={([value]) =>
                    setConfig({ ...config, pages_per_hour: value })
                  }
                  min={0.25}
                  max={2}
                  step={0.05}
                />
                <div className="flex justify-between text-xs text-muted-gray">
                  <span>Slow (0.25)</span>
                  <span>Fast (2.0)</span>
                </div>
                <div className="flex gap-2">
                  {Object.entries(PAGES_PER_HOUR_PRESETS).map(([key, value]) => (
                    <Button
                      key={key}
                      variant={config.pages_per_hour === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setConfig({ ...config, pages_per_hour: value })}
                      className="text-xs"
                    >
                      {key.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>

              {/* First Shot Offset */}
              <div className="space-y-2">
                <Label>Time to First Shot (after crew call)</Label>
                <Select
                  value={config.first_shot_offset_minutes.toString()}
                  onValueChange={(value) =>
                    setConfig({ ...config, first_shot_offset_minutes: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIRST_SHOT_OFFSET_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Meal Break Settings */}
              <div className="space-y-4 p-4 border border-muted-gray/20 rounded-lg">
                <h4 className="font-medium flex items-center gap-2">
                  <Utensils className="w-4 h-4" />
                  Meal Break Rules
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Meal After</Label>
                    <Select
                      value={config.meal_1_after_hours.toString()}
                      onValueChange={(value) =>
                        setConfig({ ...config, meal_1_after_hours: parseFloat(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_AFTER_HOURS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Meal Duration</Label>
                    <Select
                      value={config.meal_1_duration_minutes.toString()}
                      onValueChange={(value) =>
                        setConfig({ ...config, meal_1_duration_minutes: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_DURATION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value.toString()}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="meal_2_enabled"
                    checked={config.meal_2_enabled}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, meal_2_enabled: !!checked })
                    }
                  />
                  <label htmlFor="meal_2_enabled" className="text-sm">
                    Enable second meal (for long shoot days)
                  </label>
                </div>
              </div>

              {/* Company Move Duration */}
              <div className="space-y-2">
                <Label>Default Company Move Duration</Label>
                <Select
                  value={config.default_move_duration_minutes.toString()}
                  onValueChange={(value) =>
                    setConfig({ ...config, default_move_duration_minutes: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_MOVE_DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value.toString()}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reset Time Settings */}
              <div className="space-y-4 p-4 border border-muted-gray/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Reset Times Between Scenes
                  </h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enable_auto_resets"
                      checked={config.enable_auto_resets !== false}
                      onCheckedChange={(checked) =>
                        setConfig({ ...config, enable_auto_resets: !!checked })
                      }
                    />
                    <label htmlFor="enable_auto_resets" className="text-sm">
                      Auto-insert resets
                    </label>
                  </div>
                </div>

                {config.enable_auto_resets !== false && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Camera Reset</Label>
                      <Select
                        value={(config.camera_reset_minutes || 10).toString()}
                        onValueChange={(value) =>
                          setConfig({ ...config, camera_reset_minutes: parseInt(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 min</SelectItem>
                          <SelectItem value="10">10 min</SelectItem>
                          <SelectItem value="15">15 min</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-gray">Between all scenes</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Lighting Reset</Label>
                      <Select
                        value={(config.lighting_reset_minutes || 20).toString()}
                        onValueChange={(value) =>
                          setConfig({ ...config, lighting_reset_minutes: parseInt(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 min</SelectItem>
                          <SelectItem value="20">20 min</SelectItem>
                          <SelectItem value="30">30 min</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-gray">Day/Night changes</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Major Setup</Label>
                      <Select
                        value={(config.major_setup_minutes || 30).toString()}
                        onValueChange={(value) =>
                          setConfig({ ...config, major_setup_minutes: parseInt(value) })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20">20 min</SelectItem>
                          <SelectItem value="30">30 min</SelectItem>
                          <SelectItem value="45">45 min</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-gray">INT/EXT changes</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Content (Scenes/Segments) */}
          {step === 'content' && (
            <div className="p-4 h-full">
              {mode === 'scripted' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-gray">
                    The following scenes are assigned to this day and will be scheduled:
                  </p>
                  {scenes.length === 0 ? (
                    <div className="text-center py-8 text-muted-gray">
                      <Film className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No scenes assigned to this day</p>
                      <p className="text-sm mt-1">
                        Go to the Schedule tab to assign scenes, or switch to Non-Scripted mode.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Warning if any scenes are missing page counts */}
                      {scenes.some(s => getScenePageCount(s) === null) && (
                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                          <p className="text-sm text-orange-400">
                            Some scenes don't have page counts set. These will be scheduled with minimum duration (15 min).
                            For accurate scheduling, set page counts in the Script view.
                          </p>
                        </div>
                      )}

                      {/* Total pages summary */}
                      <div className="flex items-center justify-between p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
                        <span className="text-sm text-muted-gray">Total Pages:</span>
                        <span className="text-sm font-medium text-bone-white">
                          {scenes.reduce((sum, s) => sum + (getScenePageCount(s) || 0), 0).toFixed(1)} pages
                        </span>
                      </div>

                      <div className="space-y-2">
                        {scenes.map((scene, index) => {
                          const pageCount = getScenePageCount(scene);
                          const hasMissingPages = pageCount === null;

                          return (
                            <div
                              key={scene.scene_id}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border",
                                hasMissingPages
                                  ? "border-orange-500/40 bg-orange-500/10"
                                  : "border-muted-gray/20 bg-blue-500/10"
                              )}
                            >
                              <span className="text-sm font-medium text-muted-gray">
                                {index + 1}
                              </span>
                              <Film className={cn("w-4 h-4", hasMissingPages ? "text-orange-400" : "text-blue-400")} />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-bone-white">
                                  Scene {scene.scene?.scene_number}
                                </p>
                                <p className="text-xs text-muted-gray">
                                  {scene.scene?.slugline || scene.scene?.set_name}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn("text-xs", hasMissingPages && "border-orange-500/40 text-orange-400")}
                              >
                                {pageCount !== null ? `${pageCount % 1 === 0 ? pageCount : pageCount.toFixed(1)} pgs` : 'No pages set'}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {mode === 'non_scripted' && (
                <div className="h-[400px]">
                  <SegmentSelector
                    segments={segments}
                    onSegmentsChange={setSegments}
                    userPresets={userPresets}
                    onAddCustomClick={() => setShowAddCustomDialog(true)}
                  />
                </div>
              )}

              {mode === 'mixed' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Scenes column */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Film className="w-4 h-4 text-blue-400" />
                        Scripted Scenes ({scenes.length})
                        <span className="text-xs text-muted-gray ml-auto">
                          {scenes.reduce((sum, s) => sum + (getScenePageCount(s) || 0), 0).toFixed(1)} pgs
                        </span>
                      </h4>
                      <ScrollArea className="h-[300px] border border-muted-gray/20 rounded-lg p-2">
                        {scenes.length === 0 ? (
                          <p className="text-sm text-muted-gray text-center py-4">
                            No scenes assigned
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {scenes.map((scene) => {
                              const pageCount = getScenePageCount(scene);
                              const hasMissingPages = pageCount === null;
                              return (
                                <div
                                  key={scene.scene_id}
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded border text-sm",
                                    hasMissingPages
                                      ? "border-orange-500/40 bg-orange-500/10"
                                      : "border-blue-500/40 bg-blue-500/10"
                                  )}
                                >
                                  <Film className={cn("w-3 h-3", hasMissingPages ? "text-orange-400" : "text-blue-400")} />
                                  <span className="flex-1 text-bone-white truncate">
                                    Scene {scene.scene?.scene_number}
                                  </span>
                                  <span className={cn("text-xs", hasMissingPages ? "text-orange-400" : "text-muted-gray")}>
                                    {pageCount !== null ? `${pageCount % 1 === 0 ? pageCount : pageCount.toFixed(1)}pg` : '?'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    </div>

                    {/* Segments column */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Video className="w-4 h-4 text-green-400" />
                          Non-Scripted Segments ({segments.length})
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddCustomDialog(true)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                      <ScrollArea className="h-[300px] border border-muted-gray/20 rounded-lg p-2">
                        {segments.length === 0 ? (
                          <p className="text-sm text-muted-gray text-center py-4">
                            No segments added yet
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {segments.map((segment) => (
                              <div
                                key={segment.id}
                                className="flex items-center gap-2 p-2 rounded border border-green-500/40 bg-green-500/10 text-sm"
                              >
                                <Video className="w-3 h-3 text-green-400" />
                                <span className="flex-1 text-bone-white truncate">
                                  {segment.name}
                                </span>
                                <span className="text-xs text-muted-gray">
                                  {segment.duration_minutes}m
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  </div>
                  <p className="text-xs text-muted-gray text-center">
                    Scenes and segments will be interleaved based on their sort order.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Activity Blocks */}
          {step === 'activities' && (
            <div className="space-y-4 p-4">
              <p className="text-sm text-muted-gray">
                Configure which activities to include in the schedule.
                Drag to reorder, toggle to include/exclude.
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleActivityDragEnd}
              >
                <SortableContext
                  items={activityItems.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {activityItems.map((item) => (
                      <SortableActivityItem
                        key={item.id}
                        item={item}
                        onToggle={handleActivityToggle}
                        onRemove={handleActivityRemove}
                        onUpdate={handleActivityUpdate}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleAddActivity}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Activity
              </Button>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4 p-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between p-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted-gray" />
                    <span>{summary.totalDurationFormatted}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Film className="w-4 h-4 text-blue-400" />
                    <span>{summary.sceneCount} scenes</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4 text-muted-gray" />
                    <span>{summary.totalPages.toFixed(1)} pages</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertActivity(generatedSchedule.length)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Activity
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('configure')}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Reconfigure
                  </Button>
                </div>
              </div>

              {/* Drag hint */}
              <p className="text-xs text-muted-gray">
                Drag blocks to reorder. Hover between blocks to insert activities.
              </p>

              {/* Timeline with DnD */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handlePreviewDragEnd}
              >
                <SortableContext
                  items={generatedSchedule.map(b => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-0">
                    {generatedSchedule.map((block, index) => (
                      <SortablePreviewItem
                        key={block.id}
                        block={block}
                        isLast={index === generatedSchedule.length - 1}
                        onInsertBefore={() => handleInsertActivity(index)}
                        onEditDuration={handleEditBlockDuration}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {generatedSchedule.length === 0 && (
                <div className="text-center py-8 text-muted-gray">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No scenes assigned to this day yet.</p>
                  <p className="text-sm">
                    Assign scenes in the Schedule tab to generate a detailed schedule.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Apply */}
          {step === 'apply' && (
            <div className="space-y-4 p-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-green-400">Ready to Apply</h4>
                    <p className="text-sm text-muted-gray mt-1">
                      The schedule will be saved to Day {day.day_number} ({day.date}).
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-3 p-4 border border-muted-gray/20 rounded-lg">
                <h4 className="font-medium">Schedule Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-gray">Crew Call:</span>
                    <span className="ml-2 font-medium">
                      {formatTimeDisplay(summary.crewCallTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-gray">Wrap:</span>
                    <span className="ml-2 font-medium">
                      {formatTimeDisplay(summary.wrapTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-gray">Total Duration:</span>
                    <span className="ml-2 font-medium">{summary.totalDurationFormatted}</span>
                  </div>
                  <div>
                    <span className="text-muted-gray">Mode:</span>
                    <span className="ml-2 font-medium capitalize">{mode.replace('_', '-')}</span>
                  </div>
                  {summary.sceneCount > 0 && (
                    <div>
                      <span className="text-muted-gray">Scenes:</span>
                      <span className="ml-2 font-medium">{summary.sceneCount}</span>
                    </div>
                  )}
                  {summary.segmentCount > 0 && (
                    <div>
                      <span className="text-muted-gray">Segments:</span>
                      <span className="ml-2 font-medium">{summary.segmentCount}</span>
                    </div>
                  )}
                  {summary.totalPages > 0 && (
                    <div>
                      <span className="text-muted-gray">Pages:</span>
                      <span className="ml-2 font-medium">{summary.totalPages.toFixed(1)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-gray">Meal Breaks:</span>
                    <span className="ml-2 font-medium">{summary.mealCount}</span>
                  </div>
                </div>
              </div>

              {/* Sync option */}
              {onSyncToCallSheet && (
                <div className="flex items-center space-x-2 p-4 border border-muted-gray/20 rounded-lg">
                  <Checkbox
                    id="sync_callsheet"
                    checked={syncToCallSheet}
                    onCheckedChange={(checked) => setSyncToCallSheet(!!checked)}
                  />
                  <label htmlFor="sync_callsheet" className="text-sm">
                    Sync schedule to linked call sheet
                  </label>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-muted-gray/20 px-6 py-4 shrink-0">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>

          {step === 'mode' && (
            <Button
              onClick={() => setStep('configure')}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Next: Configure
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {step === 'configure' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('mode')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={() => setStep('content')}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                Next: {mode === 'scripted' ? 'Scenes' : mode === 'non_scripted' ? 'Segments' : 'Content'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'content' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('configure')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={() => setStep('activities')}
                disabled={(mode === 'scripted' && scenes.length === 0) || (mode === 'non_scripted' && segments.length === 0)}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                Next: Activities
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'activities' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('content')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                Generate Schedule
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'preview' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('activities')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={() => setStep('apply')}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                Continue to Apply
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {step === 'apply' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('preview')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <Button
                onClick={handleApply}
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
                    Apply Schedule
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Add Custom Segment Dialog */}
      <AddCustomSegmentDialog
        isOpen={showAddCustomDialog}
        onClose={() => setShowAddCustomDialog(false)}
        onAdd={handleAddCustomSegment}
        onSaveAsPreset={onSaveUserPreset}
        locations={locations}
      />

      {/* Inline Activity Insert Dialog */}
      <InlineActivityDialog
        isOpen={showInlineActivityDialog}
        onClose={() => {
          setShowInlineActivityDialog(false);
          setInsertAtIndex(null);
        }}
        onAdd={handleAddInlineActivity}
      />

      {/* Edit Block Duration Dialog */}
      <EditBlockDurationDialog
        isOpen={showEditDurationDialog}
        block={editingBlock}
        onClose={() => {
          setShowEditDurationDialog(false);
          setEditingBlock(null);
        }}
        onSave={handleSaveBlockDuration}
      />
    </Dialog>
  );
};

export default HourScheduleWizard;
