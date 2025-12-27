/**
 * ReviewKanbanView - Kanban board with drag-and-drop status management
 */
import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ReviewAsset,
  ReviewAssetEnhanced,
  ReviewAssetStatus,
  formatTimecode,
} from '@/types/backlot';
import {
  Film,
  MessageSquare,
  Play,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Status configuration
const STATUS_CONFIG: Record<ReviewAssetStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  draft: { label: 'Draft', color: 'text-muted-gray', bgColor: 'bg-muted-gray/10', borderColor: 'border-muted-gray/30' },
  in_review: { label: 'In Review', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  changes_requested: { label: 'Changes Requested', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  approved: { label: 'Approved', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30' },
  final: { label: 'Final', color: 'text-accent-yellow', bgColor: 'bg-accent-yellow/10', borderColor: 'border-accent-yellow/30' },
};

const STATUS_ORDER: ReviewAssetStatus[] = ['draft', 'in_review', 'changes_requested', 'approved', 'final'];

interface ReviewKanbanViewProps {
  assets: (ReviewAsset | ReviewAssetEnhanced)[];
  canEdit: boolean;
  onView: (asset: ReviewAsset) => void;
  onEdit: (asset: ReviewAsset) => void;
  onDelete: (id: string) => void;
  onStatusChange: (assetId: string, status: ReviewAssetStatus) => void;
}

// Draggable card component
const KanbanCard: React.FC<{
  asset: ReviewAsset | ReviewAssetEnhanced;
  canEdit: boolean;
  onView: (asset: ReviewAsset) => void;
  onEdit: (asset: ReviewAsset) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}> = ({ asset, canEdit, onView, onEdit, onDelete, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: asset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const duration = asset.active_version?.duration_seconds;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-charcoal-black border border-muted-gray/20 rounded-lg overflow-hidden cursor-pointer group transition-all',
        isDragging || isSortableDragging
          ? 'opacity-50 shadow-lg ring-2 ring-accent-yellow/50'
          : 'hover:border-muted-gray/40'
      )}
      onClick={() => onView(asset)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-charcoal-dark">
        {asset.thumbnail_url ? (
          <img
            src={asset.thumbnail_url}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-8 h-8 text-muted-gray/50" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Duration */}
        {duration !== null && duration !== undefined && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white font-mono">
            {formatTimecode(duration)}
          </div>
        )}

        {/* Drag handle */}
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            className="absolute top-1 left-1 p-1 rounded bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-bone-white truncate flex-1">
            {asset.name}
          </h4>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(asset); }}>
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(asset); }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
                  className="text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Notes count */}
        {asset.note_count !== undefined && asset.note_count > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-gray">
            <MessageSquare className="w-3 h-3" />
            {asset.note_count} notes
          </div>
        )}
      </div>
    </div>
  );
};

// Droppable column component
const KanbanColumn: React.FC<{
  status: ReviewAssetStatus;
  assets: (ReviewAsset | ReviewAssetEnhanced)[];
  canEdit: boolean;
  onView: (asset: ReviewAsset) => void;
  onEdit: (asset: ReviewAsset) => void;
  onDelete: (id: string) => void;
}> = ({ status, assets, canEdit, onView, onEdit, onDelete }) => {
  const config = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex-shrink-0 w-72 flex flex-col h-full">
      {/* Column Header */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 rounded-t-lg border-b',
        config.bgColor,
        config.borderColor
      )}>
        <div className="flex items-center gap-2">
          <span className={cn('font-medium', config.color)}>
            {config.label}
          </span>
          <span className={cn(
            'px-1.5 py-0.5 rounded-full text-xs',
            config.bgColor,
            config.color
          )}>
            {assets.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 bg-charcoal-dark/20 rounded-b-lg p-2 space-y-2 overflow-y-auto min-h-[300px] transition-colors',
          isOver && 'bg-accent-yellow/5 ring-2 ring-accent-yellow/30 ring-inset'
        )}
      >
        <SortableContext items={assets.map(a => a.id)} strategy={verticalListSortingStrategy}>
          {assets.map((asset) => (
            <KanbanCard
              key={asset.id}
              asset={asset}
              canEdit={canEdit}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {assets.length === 0 && (
          <div className="text-center py-8 text-muted-gray text-sm">
            Drop assets here
          </div>
        )}
      </div>
    </div>
  );
};

// Main Kanban View
export const ReviewKanbanView: React.FC<ReviewKanbanViewProps> = ({
  assets,
  canEdit,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

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

  // Group assets by status
  const assetsByStatus = useMemo(() => {
    const grouped: Record<ReviewAssetStatus, (ReviewAsset | ReviewAssetEnhanced)[]> = {
      draft: [],
      in_review: [],
      changes_requested: [],
      approved: [],
      final: [],
    };

    assets.forEach((asset) => {
      const enhanced = asset as ReviewAssetEnhanced;
      const status = enhanced.status || 'draft';
      grouped[status].push(asset);
    });

    return grouped;
  }, [assets]);

  const activeAsset = activeId ? assets.find((a) => a.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Visual feedback handled by isOver in columns
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !canEdit) return;

    const assetId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a status column
    if (STATUS_ORDER.includes(overId as ReviewAssetStatus)) {
      const newStatus = overId as ReviewAssetStatus;
      const asset = assets.find((a) => a.id === assetId);
      const currentStatus = (asset as ReviewAssetEnhanced)?.status || 'draft';

      if (currentStatus !== newStatus) {
        onStatusChange(assetId, newStatus);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            assets={assetsByStatus[status]}
            canEdit={canEdit}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeAsset ? (
          <div className="w-72 opacity-90">
            <KanbanCard
              asset={activeAsset}
              canEdit={false}
              onView={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ReviewKanbanView;
