/**
 * CoverageBoard - Enhanced Kanban-style board for tracking scene coverage status
 * Integrates shot lists, allows drag-and-drop status updates, and provides
 * scene detail management including shot list attachment
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  ChevronLeft,
  Film,
  Plus,
  MoreHorizontal,
  Video,
  List,
  Eye,
  Check,
  Clapperboard,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  useScenes,
  useSceneMutations,
  useCoverageByScene,
  useShotLists,
} from '@/hooks/backlot';
import { useSceneHub, usePrefetchSceneHub, ShotSummary, BreakdownItem } from '@/hooks/backlot/useSceneHub';
import { BREAKDOWN_TYPES } from '@/hooks/backlot/useSceneView';
import { api } from '@/lib/api';
import {
  BacklotScene,
  BacklotSceneCoverageStatus,
  SCENE_COVERAGE_STATUS_LABELS,
  CoverageByScene,
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

// Status order for navigation
const STATUS_ORDER: BacklotSceneCoverageStatus[] = ['not_scheduled', 'scheduled', 'shot', 'needs_pickup'];

const getPreviousStatus = (current: BacklotSceneCoverageStatus): BacklotSceneCoverageStatus | null => {
  const index = STATUS_ORDER.indexOf(current);
  return index > 0 ? STATUS_ORDER[index - 1] : null;
};

const getNextStatus = (current: BacklotSceneCoverageStatus): BacklotSceneCoverageStatus | null => {
  const index = STATUS_ORDER.indexOf(current);
  return index < STATUS_ORDER.length - 1 ? STATUS_ORDER[index + 1] : null;
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
  onPrefetch?: (sceneId: string) => void;
}> = ({
  scene,
  canEdit,
  isDragging,
  coverageData,
  onDragStart,
  onDragEnd,
  onClick,
  onQuickStatusChange,
  onPrefetch,
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
      onMouseEnter={() => onPrefetch?.(scene.id)}
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
              <Badge variant="outline" className="text-xs px-1.5 py-0 text-bone-white">
                No shots
              </Badge>
            )}
          </div>

          {/* Move buttons */}
          {canEdit && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-muted-gray/10">
              {(() => {
                const prevStatus = getPreviousStatus(scene.coverage_status);
                const nextStatus = getNextStatus(scene.coverage_status);
                const prevCol = prevStatus ? COLUMNS.find(c => c.status === prevStatus) : null;
                const nextCol = nextStatus ? COLUMNS.find(c => c.status === nextStatus) : null;

                return (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!prevStatus}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (prevStatus) onQuickStatusChange?.(scene, prevStatus);
                      }}
                      className={cn(
                        "h-7 px-2 text-xs gap-1",
                        prevCol ? prevCol.color : "text-muted-gray/30"
                      )}
                    >
                      <ArrowLeft className="w-3 h-3" />
                      {prevCol?.label || 'Back'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!nextStatus}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (nextStatus) onQuickStatusChange?.(scene, nextStatus);
                      }}
                      className={cn(
                        "h-7 px-2 text-xs gap-1",
                        nextCol ? nextCol.color : "text-muted-gray/30"
                      )}
                    >
                      {nextCol?.label || 'Next'}
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </>
                );
              })()}
            </div>
          )}
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
  onPrefetch?: (sceneId: string) => void;
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
  onPrefetch,
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
        'flex-1 min-w-[280px] rounded-lg border transition-colors flex flex-col',
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
      <div className="flex-1 p-2 space-y-2">
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
              onPrefetch={onPrefetch}
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
  const queryClient = useQueryClient();
  const [updatingShots, setUpdatingShots] = useState<Set<string>>(new Set());

  // Fetch comprehensive scene hub data (includes shots from both tables)
  const { data: hubData, isLoading: hubLoading } = useSceneHub(projectId, scene.id);
  const shots = hubData?.shots || [];
  const breakdownItems = hubData?.breakdown_items || [];
  const breakdownByType = hubData?.breakdown_by_type || {};
  const dailiesClips = hubData?.dailies_clips || [];
  const hubCoverage = hubData?.coverage_summary;

  // Fetch shot lists for this project (to attach to scene)
  const { shotLists } = useShotLists({ projectId });

  // Mutation to toggle shot completion
  const toggleShotMutation = useMutation({
    mutationFn: async ({ shotId, isCompleted }: { shotId: string; isCompleted: boolean }) => {
      return api.put(`/api/v1/backlot/shots/${shotId}`, { is_completed: isCompleted });
    },
    onMutate: ({ shotId }) => {
      setUpdatingShots((prev) => new Set(prev).add(shotId));
    },
    onSettled: (_, __, { shotId }) => {
      setUpdatingShots((prev) => {
        const next = new Set(prev);
        next.delete(shotId);
        return next;
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes', projectId, scene.id, 'hub'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update shot status',
        variant: 'destructive',
      });
    },
  });

  const handleToggleShot = useCallback((shotId: string, isCompleted: boolean) => {
    toggleShotMutation.mutate({ shotId, isCompleted });
  }, [toggleShotMutation]);

  // Filter shot lists that are linked to this scene
  const sceneShotLists = useMemo(
    () => shotLists.filter((sl) => sl.scene_id === scene.id),
    [shotLists, scene.id]
  );

  const TimeIcon = scene.time_of_day ? TIME_OF_DAY_ICONS[scene.time_of_day] || Sun : Sun;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto bg-charcoal-black border-l border-muted-gray/20">
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

          {/* Shots */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-muted-gray">
                Shots {shots.length > 0 && `(${shots.length})`}
              </h4>
              {shots.length > 0 && hubCoverage && (
                <span className={cn(
                  'text-xs font-medium',
                  hubCoverage.coverage_percent === 100 ? 'text-green-400' :
                  hubCoverage.coverage_percent > 50 ? 'text-blue-400' : 'text-muted-gray'
                )}>
                  {hubCoverage.covered_shots}/{hubCoverage.total_shots} covered
                </span>
              )}
            </div>

            {shots.length > 0 ? (
              <div className="space-y-3">
                {/* Coverage progress bar */}
                {hubCoverage && hubCoverage.total_shots > 0 && (
                  <Progress
                    value={hubCoverage.coverage_percent}
                    className="h-2"
                  />
                )}

                {/* Shots list */}
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {shots.map((shot) => (
                      <ShotRow
                        key={shot.id}
                        shot={shot}
                        onToggle={canEdit ? handleToggleShot : undefined}
                        isUpdating={updatingShots.has(shot.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-6 text-bone-white text-sm border border-dashed border-muted-gray/30 rounded-lg">
                <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No shots defined for this scene</p>
                <p className="text-xs text-muted-gray mt-1">
                  Add shots from the Shot Lists tab
                </p>
              </div>
            )}
          </div>

          {/* Breakdown Summary */}
          {breakdownItems.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">Breakdown</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(breakdownByType).map(([type, items]) => {
                    const typeInfo = BREAKDOWN_TYPES.find((t) => t.value === type);
                    return (
                      <Badge
                        key={type}
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: typeInfo?.color.replace('bg-', '') || undefined,
                        }}
                      >
                        {items.length} {typeInfo?.label || type}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Dailies Summary */}
          {dailiesClips.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-gray mb-2">Dailies</h4>
                <div className="flex items-center gap-3 text-sm text-bone-white">
                  <div className="flex items-center gap-1">
                    <Video className="w-4 h-4 text-muted-gray" />
                    <span>{dailiesClips.length} clips</span>
                  </div>
                  {hubCoverage && hubCoverage.circle_takes > 0 && (
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span>{hubCoverage.circle_takes} circle takes</span>
                    </div>
                  )}
                </div>
              </div>
            </>
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

// Shot row component for the detail panel (using ShotSummary from hub)
const ShotRow: React.FC<{
  shot: ShotSummary;
  onToggle?: (id: string, isCompleted: boolean) => void;
  isUpdating?: boolean;
}> = ({ shot, onToggle, isUpdating }) => {
  return (
    <div className={cn(
      "flex items-center gap-3 bg-charcoal-black border border-muted-gray/20 rounded-lg p-2",
      isUpdating && "opacity-50"
    )}>
      <Checkbox
        checked={shot.is_covered}
        onCheckedChange={(checked) => onToggle?.(shot.id, !!checked)}
        disabled={isUpdating}
        className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            {shot.shot_number}
          </Badge>
          {shot.frame_size && (
            <Badge variant="secondary" className="text-xs">
              {shot.frame_size}
            </Badge>
          )}
          {shot.camera_movement && (
            <span className="text-xs text-muted-gray">{shot.camera_movement}</span>
          )}
        </div>
        {shot.description && (
          <p className={cn(
            "text-xs truncate mt-1",
            shot.is_covered ? "text-muted-gray line-through" : "text-muted-gray"
          )}>{shot.description}</p>
        )}
      </div>
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

  // Prefetch function for scene hub data on hover
  const prefetchSceneHub = usePrefetchSceneHub();
  const handlePrefetchScene = useCallback((sceneId: string) => {
    prefetchSceneHub(projectId, sceneId);
  }, [projectId, prefetchSceneHub]);

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
        id: draggingScene.id,
        scene_number: draggingScene.scene_number,
        coverage_status: newStatus,
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
        id: scene.id,
        scene_number: scene.scene_number,
        coverage_status: newStatus,
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
        id: selectedScene.id,
        scene_number: selectedScene.scene_number,
        coverage_status: newStatus,
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
    <div className="flex flex-col">
      {/* Summary Stats Bar */}
      <div className="flex items-center gap-6 bg-charcoal-black/50 border border-muted-gray/20 rounded-t-lg rounded-b-none p-3">
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
      <div className="flex gap-4 overflow-x-auto pb-4 items-stretch">
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
            onPrefetch={handlePrefetchScene}
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
