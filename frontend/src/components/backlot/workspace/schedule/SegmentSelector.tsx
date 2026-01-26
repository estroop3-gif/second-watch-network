/**
 * SegmentSelector - Segment selection panel for non-scripted scheduling
 *
 * Features:
 * - Left panel: Preset library organized by category (accordion)
 * - Right panel: Selected segments (sortable list)
 * - Click presets to add with duration popover
 * - Inline duration editing
 * - Add custom segment button
 */
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
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
  NonScriptedSegment,
  NonScriptedSegmentPreset,
  NonScriptedSegmentCategory,
} from '@/types/backlot';
import {
  SEGMENT_CATEGORIES,
  SYSTEM_SEGMENT_PRESETS,
  getSegmentCategoryColor,
  formatDurationRange,
  getCategoryMeta,
} from '@/lib/backlot/segmentPresets';
import {
  Plus,
  GripVertical,
  Trash2,
  Clock,
  MessageSquare,
  Video,
  Wrench,
  User,
  Presentation,
  Music,
  MapPin,
  Layers,
} from 'lucide-react';

// ============================================================================
// ICON MAPPING
// ============================================================================

function getCategoryIcon(category: NonScriptedSegmentCategory) {
  switch (category) {
    case 'interview': return <MessageSquare className="w-4 h-4" />;
    case 'broll': return <Video className="w-4 h-4" />;
    case 'technical': return <Wrench className="w-4 h-4" />;
    case 'talent': return <User className="w-4 h-4" />;
    case 'presentation': return <Presentation className="w-4 h-4" />;
    case 'performance': return <Music className="w-4 h-4" />;
    case 'location': return <MapPin className="w-4 h-4" />;
    case 'custom':
    default: return <Layers className="w-4 h-4" />;
  }
}

// ============================================================================
// PRESET CARD WITH DURATION POPOVER
// ============================================================================

interface PresetCardProps {
  preset: NonScriptedSegmentPreset;
  onAdd: (preset: NonScriptedSegmentPreset, duration: number) => void;
}

const PresetCard: React.FC<PresetCardProps> = ({ preset, onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [duration, setDuration] = useState(preset.duration_default_minutes);

  const handleAdd = () => {
    onAdd(preset, duration);
    setIsOpen(false);
    setDuration(preset.duration_default_minutes);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'w-full text-left p-3 rounded-lg border transition-colors',
            'hover:border-accent-yellow/50',
            getSegmentCategoryColor(preset.category)
          )}
        >
          <div className="flex items-center gap-2">
            {getCategoryIcon(preset.category)}
            <span className="font-medium text-sm">{preset.name}</span>
          </div>
          <p className="text-xs opacity-70 mt-1 line-clamp-1">
            {preset.description}
          </p>
          <Badge variant="outline" className="mt-2 text-xs">
            {formatDurationRange(preset)}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">{preset.name}</h4>
            <p className="text-xs text-muted-gray">{preset.description}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-gray">Duration</span>
              <span className="text-sm font-medium">{duration} min</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={([v]) => setDuration(v)}
              min={preset.duration_min_minutes}
              max={preset.duration_max_minutes}
              step={5}
            />
            <div className="flex justify-between text-xs text-muted-gray">
              <span>{preset.duration_min_minutes} min</span>
              <span>{preset.duration_max_minutes} min</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || preset.duration_default_minutes)}
              min={preset.duration_min_minutes}
              max={preset.duration_max_minutes}
              className="h-8"
            />
            <Button onClick={handleAdd} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ============================================================================
// SORTABLE SEGMENT ITEM
// ============================================================================

interface SortableSegmentItemProps {
  segment: NonScriptedSegment;
  onRemove: (id: string) => void;
  onUpdateDuration: (id: string, duration: number) => void;
}

const SortableSegmentItem: React.FC<SortableSegmentItemProps> = ({
  segment,
  onRemove,
  onUpdateDuration,
}) => {
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [editDuration, setEditDuration] = useState(segment.duration_minutes.toString());

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: segment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDurationSave = () => {
    const newDuration = parseInt(editDuration) || segment.duration_minutes;
    onUpdateDuration(segment.id, newDuration);
    setIsEditingDuration(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        isDragging ? 'opacity-50 border-accent-yellow' : 'border-muted-gray/20',
        getSegmentCategoryColor(segment.category)
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none opacity-50 hover:opacity-100"
      >
        <GripVertical className="w-4 h-4" />
      </div>

      <div className={cn('p-1.5 rounded', getSegmentCategoryColor(segment.category))}>
        {getCategoryIcon(segment.category)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-bone-white truncate">{segment.name}</p>
        {segment.location_name && (
          <p className="text-xs text-muted-gray truncate">@ {segment.location_name}</p>
        )}
      </div>

      {isEditingDuration ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={editDuration}
            onChange={(e) => setEditDuration(e.target.value)}
            className="w-16 h-7 text-xs"
            min={5}
            autoFocus
            onBlur={handleDurationSave}
            onKeyDown={(e) => e.key === 'Enter' && handleDurationSave()}
          />
          <span className="text-xs text-muted-gray">min</span>
        </div>
      ) : (
        <Badge
          variant="outline"
          className="cursor-pointer hover:bg-accent-yellow/20"
          onClick={() => {
            setEditDuration(segment.duration_minutes.toString());
            setIsEditingDuration(true);
          }}
        >
          <Clock className="w-3 h-3 mr-1" />
          {segment.duration_minutes} min
        </Badge>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(segment.id)}
        className="text-muted-gray hover:text-red-400 h-7 w-7 p-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface SegmentSelectorProps {
  segments: NonScriptedSegment[];
  onSegmentsChange: (segments: NonScriptedSegment[]) => void;
  userPresets?: NonScriptedSegmentPreset[];
  onAddCustomClick: () => void;
  className?: string;
}

export const SegmentSelector: React.FC<SegmentSelectorProps> = ({
  segments,
  onSegmentsChange,
  userPresets = [],
  onAddCustomClick,
  className,
}) => {
  // Group presets by category
  const presetsByCategory = SEGMENT_CATEGORIES.map(category => ({
    category,
    presets: [
      ...SYSTEM_SEGMENT_PRESETS.filter(p => p.category === category.id),
      ...userPresets.filter(p => p.category === category.id),
    ],
  })).filter(group => group.presets.length > 0);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle add from preset
  const handleAddPreset = useCallback((preset: NonScriptedSegmentPreset, duration: number) => {
    const newSegment: NonScriptedSegment = {
      id: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      preset_id: preset.id,
      category: preset.category,
      name: preset.name,
      duration_minutes: duration,
      description: preset.description,
      sort_order: segments.length,
    };
    onSegmentsChange([...segments, newSegment]);
  }, [segments, onSegmentsChange]);

  // Handle remove
  const handleRemove = useCallback((id: string) => {
    onSegmentsChange(segments.filter(s => s.id !== id));
  }, [segments, onSegmentsChange]);

  // Handle duration update
  const handleUpdateDuration = useCallback((id: string, duration: number) => {
    onSegmentsChange(
      segments.map(s => s.id === id ? { ...s, duration_minutes: duration } : s)
    );
  }, [segments, onSegmentsChange]);

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = segments.findIndex(s => s.id === active.id);
      const newIndex = segments.findIndex(s => s.id === over.id);
      const reordered = arrayMove(segments, oldIndex, newIndex);
      onSegmentsChange(reordered.map((s, i) => ({ ...s, sort_order: i })));
    }
  }, [segments, onSegmentsChange]);

  // Calculate total duration
  const totalDuration = segments.reduce((sum, s) => sum + s.duration_minutes, 0);
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;

  return (
    <div className={cn('flex gap-4 h-full', className)}>
      {/* Left Panel: Preset Library */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm text-bone-white">Preset Library</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={onAddCustomClick}
          >
            <Plus className="w-4 h-4 mr-1" />
            Custom
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <Accordion type="multiple" defaultValue={['interview', 'broll']} className="space-y-2">
            {presetsByCategory.map(({ category, presets }) => (
              <AccordionItem
                key={category.id}
                value={category.id}
                className="border border-muted-gray/20 rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-charcoal-black/50">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(category.id)}
                    <span className="font-medium">{category.name}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {presets.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2">
                    {presets.map(preset => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        onAdd={handleAddPreset}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </div>

      {/* Right Panel: Selected Segments */}
      <div className="w-1/2 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm text-bone-white">
            Selected Segments
            {segments.length > 0 && (
              <span className="text-muted-gray ml-2">({segments.length})</span>
            )}
          </h4>
          {segments.length > 0 && (
            <Badge variant="outline">
              <Clock className="w-3 h-3 mr-1" />
              {hours > 0 ? `${hours}h ${mins}m` : `${mins} min`}
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1">
          {segments.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No segments added yet</p>
              <p className="text-xs mt-1">
                Click presets on the left to add segments
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={segments.map(s => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {segments.map(segment => (
                    <SortableSegmentItem
                      key={segment.id}
                      segment={segment}
                      onRemove={handleRemove}
                      onUpdateDuration={handleUpdateDuration}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default SegmentSelector;
