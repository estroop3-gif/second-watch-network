/**
 * CoverageBoard - Kanban-style board for tracking scene coverage status
 * Allows drag-and-drop to update scene coverage status
 */
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Camera,
  Calendar,
  Clock,
  MapPin,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  ChevronRight,
} from 'lucide-react';
import { useScenes, useSceneMutations } from '@/hooks/backlot';
import {
  BacklotScene,
  BacklotSceneCoverageStatus,
  SCENE_COVERAGE_STATUS_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CoverageBoardProps {
  projectId: string;
  scriptId?: string;
  canEdit: boolean;
  onSceneClick?: (scene: BacklotScene) => void;
}

interface ColumnConfig {
  status: BacklotSceneCoverageStatus;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    status: 'not_scheduled',
    label: 'Not Scheduled',
    icon: AlertCircle,
    color: 'text-muted-gray',
    bgColor: 'bg-muted-gray/10',
    borderColor: 'border-muted-gray/30',
  },
  {
    status: 'scheduled',
    label: 'Scheduled',
    icon: Calendar,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    status: 'shot',
    label: 'Shot',
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  {
    status: 'needs_pickup',
    label: 'Needs Pickup',
    icon: Camera,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
];

const TIME_OF_DAY_ICONS: Record<string, React.ElementType> = {
  day: Sun,
  night: Moon,
  dawn: Sunrise,
  dusk: Sunset,
};

// Scene card component for the kanban board
const SceneCard: React.FC<{
  scene: BacklotScene;
  canEdit: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, scene: BacklotScene) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
}> = ({ scene, canEdit, isDragging, onDragStart, onDragEnd, onClick }) => {
  const TimeIcon = scene.time_of_day ? TIME_OF_DAY_ICONS[scene.time_of_day] || Sun : Sun;

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => onDragStart?.(e, scene)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'group bg-charcoal-black border border-muted-gray/20 rounded-lg p-3 cursor-pointer transition-all',
        'hover:border-muted-gray/40 hover:shadow-lg',
        isDragging && 'opacity-50 scale-95',
        canEdit && 'cursor-grab active:cursor-grabbing'
      )}
    >
      <div className="flex items-start gap-2">
        {canEdit && (
          <GripVertical className="w-4 h-4 text-muted-gray/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        <div className="flex-1 min-w-0">
          {/* Scene number and heading */}
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-mono shrink-0">
              {scene.scene_number}
            </Badge>
            {scene.int_ext && (
              <span className="text-xs text-muted-gray uppercase">{scene.int_ext}</span>
            )}
            <TimeIcon className="w-3 h-3 text-muted-gray" />
          </div>

          {/* Scene heading/location */}
          <p className="text-sm text-bone-white font-medium truncate">
            {scene.scene_heading || scene.location_name || 'Untitled Scene'}
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-gray">
            {scene.estimated_duration && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{scene.estimated_duration}m</span>
              </div>
            )}
            {scene.page_count && (
              <div className="flex items-center gap-1">
                <span>{scene.page_count} pg</span>
              </div>
            )}
            {scene.breakdown_item_count !== undefined && scene.breakdown_item_count > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {scene.breakdown_item_count} items
              </Badge>
            )}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-muted-gray/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

// Kanban column component
const BoardColumn: React.FC<{
  config: ColumnConfig;
  scenes: BacklotScene[];
  canEdit: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onSceneClick?: (scene: BacklotScene) => void;
  draggingScene: BacklotScene | null;
  onDragStart: (e: React.DragEvent, scene: BacklotScene) => void;
  onDragEnd: () => void;
}> = ({
  config,
  scenes,
  canEdit,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onSceneClick,
  draggingScene,
  onDragStart,
  onDragEnd,
}) => {
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex-1 min-w-[280px] max-w-[350px] rounded-lg border transition-colors',
        config.bgColor,
        isDragOver ? `${config.borderColor} border-2` : 'border-muted-gray/20'
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 p-3 border-b border-muted-gray/20">
        <Icon className={cn('w-4 h-4', config.color)} />
        <h3 className={cn('font-medium text-sm', config.color)}>{config.label}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {scenes.length}
        </Badge>
      </div>

      {/* Column content */}
      <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
        {scenes.length === 0 ? (
          <div className="py-8 text-center text-muted-gray text-sm">
            {isDragOver ? 'Drop scene here' : 'No scenes'}
          </div>
        ) : (
          scenes.map((scene) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              canEdit={canEdit}
              isDragging={draggingScene?.id === scene.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={() => onSceneClick?.(scene)}
            />
          ))
        )}
      </div>
    </div>
  );
};

const CoverageBoard: React.FC<CoverageBoardProps> = ({
  projectId,
  scriptId,
  canEdit,
  onSceneClick,
}) => {
  const { toast } = useToast();
  const [draggingScene, setDraggingScene] = useState<BacklotScene | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BacklotSceneCoverageStatus | null>(null);

  const { scenes, isLoading } = useScenes({
    projectId,
    scriptId,
  });
  const { updateScene } = useSceneMutations(projectId);

  // Group scenes by coverage status
  const scenesByStatus = useMemo(() => {
    const grouped: Record<BacklotSceneCoverageStatus, BacklotScene[]> = {
      not_scheduled: [],
      scheduled: [],
      shot: [],
      needs_pickup: [],
    };

    if (scenes) {
      for (const scene of scenes) {
        if (!scene.is_omitted) {
          grouped[scene.coverage_status].push(scene);
        }
      }
    }

    return grouped;
  }, [scenes]);

  const handleDragStart = (e: React.DragEvent, scene: BacklotScene) => {
    setDraggingScene(scene);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', scene.id);
  };

  const handleDragEnd = () => {
    setDraggingScene(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: BacklotSceneCoverageStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: BacklotSceneCoverageStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggingScene || draggingScene.coverage_status === newStatus) {
      setDraggingScene(null);
      return;
    }

    try {
      await updateScene.mutateAsync({
        sceneId: draggingScene.id,
        data: { coverage_status: newStatus },
      });

      toast({
        title: 'Scene Updated',
        description: `Scene ${draggingScene.scene_number} moved to ${SCENE_COVERAGE_STATUS_LABELS[newStatus]}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update scene',
        variant: 'destructive',
      });
    }

    setDraggingScene(null);
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col.status} className="flex-1 min-w-[280px]">
            <Skeleton className="h-12 mb-2 rounded-t-lg" />
            <div className="space-y-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUMNS.map((config) => (
        <BoardColumn
          key={config.status}
          config={config}
          scenes={scenesByStatus[config.status]}
          canEdit={canEdit}
          isDragOver={dragOverColumn === config.status}
          onDragOver={(e) => handleDragOver(e, config.status)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, config.status)}
          onSceneClick={onSceneClick}
          draggingScene={draggingScene}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      ))}
    </div>
  );
};

export default CoverageBoard;
