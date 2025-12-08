/**
 * CoverageBoard - Enhanced Kanban-style board for tracking scene coverage status
 * Integrates shot lists, allows drag-and-drop status updates, and provides
 * scene detail management including shot list attachment
 */
import React, { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Film,
  Plus,
  MoreHorizontal,
  Video,
  List,
  Eye,
  Check,
  Clapperboard,
} from 'lucide-react';
import {
  useScenes,
  useSceneMutations,
  useShots,
  useCoverageByScene,
  useShotLists,
} from '@/hooks/backlot';
import {
  BacklotScene,
  BacklotSceneCoverageStatus,
  SCENE_COVERAGE_STATUS_LABELS,
  BacklotSceneShot,
  CoverageByScene,
  BacklotCoverageStatus,
  SHOT_TYPE_SHORT_LABELS,
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
  coverageData?: CoverageByScene;
  onDragStart?: (e: React.DragEvent, scene: BacklotScene) => void;
  onDragEnd?: () => void;
  onClick?: () => void;
  onQuickStatusChange?: (scene: BacklotScene, newStatus: BacklotSceneCoverageStatus) => void;
}> = ({
  scene,
  canEdit,
  isDragging,
  coverageData,
  onDragStart,
  onDragEnd,
  onClick,
  onQuickStatusChange,
}) => {
  const TimeIcon = scene.time_of_day ? TIME_OF_DAY_ICONS[scene.time_of_day] || Sun : Sun;
  const hasShots = coverageData && coverageData.total_shots > 0;
  const coveragePercent = coverageData
    ? Math.round((coverageData.shot / Math.max(coverageData.total_shots, 1)) * 100)
    : 0;

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
          <GripVertical className="w-4 h-4 text-muted-gray/50 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
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
            {scene.set_name || 'Untitled Scene'}
          </p>

          {/* Shot coverage progress */}
          {hasShots && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-gray flex items-center gap-1">
                  <Video className="w-3 h-3" />
                  {coverageData.shot}/{coverageData.total_shots} shots
                </span>
                <span
                  className={cn(
                    'font-medium',
                    coveragePercent === 100
                      ? 'text-green-400'
                      : coveragePercent > 50
                        ? 'text-blue-400'
                        : 'text-muted-gray'
                  )}
                >
                  {coveragePercent}%
                </span>
              </div>
              <Progress value={coveragePercent} className="h-1.5" />
            </div>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-gray">
            {scene.page_count && (
              <div className="flex items-center gap-1">
                <span>{scene.page_count} pg</span>
              </div>
            )}
            {scene.breakdown_count !== undefined && scene.breakdown_count > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {scene.breakdown_count} items
              </Badge>
            )}
            {!hasShots && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 text-muted-gray/60">
                No shots
              </Badge>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1">
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {COLUMNS.filter((col) => col.status !== scene.coverage_status).map((col) => (
                  <DropdownMenuItem
                    key={col.status}
                    onClick={() => onQuickStatusChange?.(scene, col.status)}
                    className="gap-2"
                  >
                    <col.icon className={cn('w-4 h-4', col.color)} />
                    Move to {col.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <ChevronRight className="w-4 h-4 text-muted-gray/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
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
  coverageByScene: Map<string, CoverageByScene>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onSceneClick?: (scene: BacklotScene) => void;
  onQuickStatusChange?: (scene: BacklotScene, newStatus: BacklotSceneCoverageStatus) => void;
  draggingScene: BacklotScene | null;
  onDragStart: (e: React.DragEvent, scene: BacklotScene) => void;
  onDragEnd: () => void;
}> = ({
  config,
  scenes,
  canEdit,
  isDragOver,
  coverageByScene,
  onDragOver,
  onDragLeave,
  onDrop,
  onSceneClick,
  onQuickStatusChange,
  draggingScene,
  onDragStart,
  onDragEnd,
}) => {
  const Icon = config.icon;

  // Calculate column stats
  const totalShots = scenes.reduce((sum, s) => {
    const coverage = coverageByScene.get(s.id);
    return sum + (coverage?.total_shots || 0);
  }, 0);
  const completedShots = scenes.reduce((sum, s) => {
    const coverage = coverageByScene.get(s.id);
    return sum + (coverage?.shot || 0);
  }, 0);

  return (
    <div
      className={cn(
        'flex-1 min-w-[280px] max-w-[350px] rounded-lg border transition-colors flex flex-col',
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

      {/* Column stats */}
      {totalShots > 0 && (
        <div className="px-3 py-2 border-b border-muted-gray/10 text-xs text-muted-gray">
          <div className="flex items-center gap-2">
            <Video className="w-3 h-3" />
            <span>
              {completedShots}/{totalShots} shots covered
            </span>
          </div>
        </div>
      )}

      {/* Column content */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
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
              coverageData={coverageByScene.get(scene.id)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={() => onSceneClick?.(scene)}
              onQuickStatusChange={onQuickStatusChange}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Scene Detail Panel Component
const SceneDetailPanel: React.FC<{
  scene: BacklotScene;
  projectId: string;
  canEdit: boolean;
  coverageData?: CoverageByScene;
  onClose: () => void;
  onStatusChange: (newStatus: BacklotSceneCoverageStatus) => void;
}> = ({ scene, projectId, canEdit, coverageData, onClose, onStatusChange }) => {
  const { toast } = useToast();

  // Fetch shots for this scene
  const { shots, isLoading: shotsLoading, createShot, updateCoverage } = useShots({
    projectId,
    sceneId: scene.id,
  });

  // Fetch shot lists for this project (to attach to scene)
  const { shotLists } = useShotLists({ projectId });

  // Filter shot lists that are linked to this scene
  const sceneShotLists = useMemo(
    () => shotLists.filter((sl) => sl.scene_id === scene.id),
    [shotLists, scene.id]
  );

  const TimeIcon = scene.time_of_day ? TIME_OF_DAY_ICONS[scene.time_of_day] || Sun : Sun;

  const handleMarkAllShot = async () => {
    const unshotIds = shots.filter((s) => s.coverage_status !== 'shot').map((s) => s.id);
    if (unshotIds.length === 0) return;

    for (const id of unshotIds) {
      await updateCoverage.mutateAsync({ id, coverage_status: 'shot' });
    }
    toast({
      title: 'Shots Updated',
      description: `Marked ${unshotIds.length} shots as complete`,
    });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm font-mono">
              {scene.scene_number}
            </Badge>
            {scene.int_ext && (
              <Badge variant="secondary" className="text-xs">
                {scene.int_ext}
              </Badge>
            )}
            <TimeIcon className="w-4 h-4 text-muted-gray" />
          </div>
          <SheetTitle className="text-left">
            {scene.set_name || 'Untitled Scene'}
          </SheetTitle>
          {scene.synopsis && (
            <SheetDescription className="text-left">{scene.synopsis}</SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Coverage Status */}
          <div>
            <h4 className="text-sm font-medium text-muted-gray mb-2">Coverage Status</h4>
            <Select
              value={scene.coverage_status}
              onValueChange={(value) => onStatusChange(value as BacklotSceneCoverageStatus)}
              disabled={!canEdit}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((col) => (
                  <SelectItem key={col.status} value={col.status}>
                    <div className="flex items-center gap-2">
                      <col.icon className={cn('w-4 h-4', col.color)} />
                      {col.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Shot Coverage Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-gray">Shot Coverage</h4>
              {canEdit && shots.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllShot}
                  disabled={shots.every((s) => s.coverage_status === 'shot')}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Mark All Shot
                </Button>
              )}
            </div>

            {coverageData && coverageData.total_shots > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-green-500/10 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-400">{coverageData.shot}</div>
                    <div className="text-xs text-muted-gray">Shot</div>
                  </div>
                  <div className="bg-muted-gray/10 rounded-lg p-2">
                    <div className="text-lg font-bold text-muted-gray">
                      {coverageData.not_shot}
                    </div>
                    <div className="text-xs text-muted-gray">Not Shot</div>
                  </div>
                  <div className="bg-orange-500/10 rounded-lg p-2">
                    <div className="text-lg font-bold text-orange-400">
                      {coverageData.alt_needed}
                    </div>
                    <div className="text-xs text-muted-gray">Alt Needed</div>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-2">
                    <div className="text-lg font-bold text-red-400">{coverageData.dropped}</div>
                    <div className="text-xs text-muted-gray">Dropped</div>
                  </div>
                </div>

                <Progress
                  value={(coverageData.shot / coverageData.total_shots) * 100}
                  className="h-2"
                />
              </div>
            ) : (
              <div className="text-center py-6 text-muted-gray text-sm border border-dashed border-muted-gray/30 rounded-lg">
                <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No shots defined for this scene</p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      createShot.mutate({
                        projectId,
                        sceneId: scene.id,
                        shot_type: 'MS',
                        description: 'New shot',
                      });
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add First Shot
                  </Button>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Shots List */}
          {shots.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-muted-gray mb-2">
                Shots ({shots.length})
              </h4>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {shots.map((shot) => (
                    <ShotRow
                      key={shot.id}
                      shot={shot}
                      canEdit={canEdit}
                      onStatusChange={(status) =>
                        updateCoverage.mutate({ id: shot.id, coverage_status: status })
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Linked Shot Lists */}
          {sceneShotLists.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">Linked Shot Lists</h4>
                <div className="space-y-2">
                  {sceneShotLists.map((sl) => (
                    <div
                      key={sl.id}
                      className="flex items-center justify-between bg-charcoal-black border border-muted-gray/20 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <List className="w-4 h-4 text-blue-400" />
                        <div>
                          <p className="text-sm font-medium">{sl.title}</p>
                          {sl.shot_count !== undefined && (
                            <p className="text-xs text-muted-gray">
                              {sl.completed_count || 0}/{sl.shot_count} completed
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Scene Info */}
          <Separator />
          <div>
            <h4 className="text-sm font-medium text-muted-gray mb-2">Scene Info</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {scene.page_count && (
                <div className="flex items-center gap-2 text-muted-gray">
                  <Film className="w-4 h-4" />
                  <span>{scene.page_count} pages</span>
                </div>
              )}
              {scene.location && (
                <div className="flex items-center gap-2 text-muted-gray col-span-2">
                  <MapPin className="w-4 h-4" />
                  <span>{scene.location.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {scene.notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
                <p className="text-sm text-bone-white/80 whitespace-pre-wrap">{scene.notes}</p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Shot row component for the detail panel
const ShotRow: React.FC<{
  shot: BacklotSceneShot;
  canEdit: boolean;
  onStatusChange: (status: BacklotCoverageStatus) => void;
}> = ({ shot, canEdit, onStatusChange }) => {
  const statusColors: Record<BacklotCoverageStatus, string> = {
    not_shot: 'text-muted-gray',
    shot: 'text-green-400',
    alt_needed: 'text-orange-400',
    dropped: 'text-red-400',
  };

  return (
    <div className="flex items-center gap-3 bg-charcoal-black border border-muted-gray/20 rounded-lg p-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            {shot.shot_number}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {SHOT_TYPE_SHORT_LABELS[shot.shot_type] || shot.shot_type}
          </Badge>
          {shot.lens && <span className="text-xs text-muted-gray">{shot.lens}</span>}
        </div>
        {shot.description && (
          <p className="text-xs text-muted-gray truncate mt-1">{shot.description}</p>
        )}
      </div>

      {canEdit ? (
        <Select
          value={shot.coverage_status}
          onValueChange={(value) => onStatusChange(value as BacklotCoverageStatus)}
        >
          <SelectTrigger className="w-[100px] h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="not_shot">Not Shot</SelectItem>
            <SelectItem value="shot">Shot</SelectItem>
            <SelectItem value="alt_needed">Alt Needed</SelectItem>
            <SelectItem value="dropped">Dropped</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="outline" className={cn('text-xs', statusColors[shot.coverage_status])}>
          {shot.coverage_status === 'shot' && <Check className="w-3 h-3 mr-1" />}
          {shot.coverage_status.replace('_', ' ')}
        </Badge>
      )}
    </div>
  );
};

// Main CoverageBoard component
const CoverageBoard: React.FC<CoverageBoardProps> = ({
  projectId,
  scriptId,
  canEdit,
  onSceneClick,
}) => {
  const { toast } = useToast();
  const [draggingScene, setDraggingScene] = useState<BacklotScene | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BacklotSceneCoverageStatus | null>(null);
  const [selectedScene, setSelectedScene] = useState<BacklotScene | null>(null);

  const { scenes, isLoading } = useScenes({
    projectId,
    scriptId,
  });
  const { updateScene } = useSceneMutations(projectId);

  // Fetch coverage data for all scenes
  const { data: coverageData } = useCoverageByScene(projectId);

  // Build a map of scene ID to coverage data
  const coverageByScene = useMemo(() => {
    const map = new Map<string, CoverageByScene>();
    if (coverageData) {
      coverageData.forEach((c) => map.set(c.scene_id, c));
    }
    return map;
  }, [coverageData]);

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
          // Default to 'not_scheduled' if coverage_status is undefined or invalid
          const status =
            scene.coverage_status && grouped[scene.coverage_status]
              ? scene.coverage_status
              : 'not_scheduled';
          grouped[status].push(scene);
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

  const handleQuickStatusChange = async (
    scene: BacklotScene,
    newStatus: BacklotSceneCoverageStatus
  ) => {
    try {
      await updateScene.mutateAsync({
        sceneId: scene.id,
        data: { coverage_status: newStatus },
      });

      toast({
        title: 'Scene Updated',
        description: `Scene ${scene.scene_number} moved to ${SCENE_COVERAGE_STATUS_LABELS[newStatus]}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update scene',
        variant: 'destructive',
      });
    }
  };

  const handleSceneClick = (scene: BacklotScene) => {
    setSelectedScene(scene);
    onSceneClick?.(scene);
  };

  const handleStatusChange = async (newStatus: BacklotSceneCoverageStatus) => {
    if (!selectedScene) return;

    try {
      await updateScene.mutateAsync({
        sceneId: selectedScene.id,
        data: { coverage_status: newStatus },
      });

      // Update local state
      setSelectedScene({ ...selectedScene, coverage_status: newStatus });

      toast({
        title: 'Status Updated',
        description: `Scene ${selectedScene.scene_number} is now ${SCENE_COVERAGE_STATUS_LABELS[newStatus]}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
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

  // Calculate summary stats
  const totalScenes = scenes?.filter((s) => !s.is_omitted).length || 0;
  const totalShots = coverageData?.reduce((sum, c) => sum + c.total_shots, 0) || 0;
  const completedShots = coverageData?.reduce((sum, c) => sum + c.shot, 0) || 0;
  const overallProgress = totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary Stats Bar */}
      <div className="flex items-center gap-6 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Clapperboard className="w-4 h-4 text-muted-gray" />
          <span className="text-sm text-muted-gray">
            {totalScenes} scene{totalScenes !== 1 ? 's' : ''}
          </span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-muted-gray" />
          <span className="text-sm text-muted-gray">
            {completedShots}/{totalShots} shots covered
          </span>
        </div>
        <div className="flex-1 max-w-xs">
          <Progress value={overallProgress} className="h-2" />
        </div>
        <span
          className={cn(
            'text-sm font-medium',
            overallProgress === 100
              ? 'text-green-400'
              : overallProgress > 50
                ? 'text-blue-400'
                : 'text-muted-gray'
          )}
        >
          {overallProgress}%
        </span>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((config) => (
          <BoardColumn
            key={config.status}
            config={config}
            scenes={scenesByStatus[config.status]}
            canEdit={canEdit}
            isDragOver={dragOverColumn === config.status}
            coverageByScene={coverageByScene}
            onDragOver={(e) => handleDragOver(e, config.status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, config.status)}
            onSceneClick={handleSceneClick}
            onQuickStatusChange={handleQuickStatusChange}
            draggingScene={draggingScene}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Scene Detail Panel */}
      {selectedScene && (
        <SceneDetailPanel
          scene={selectedScene}
          projectId={projectId}
          canEdit={canEdit}
          coverageData={coverageByScene.get(selectedScene.id)}
          onClose={() => setSelectedScene(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
};

export default CoverageBoard;
