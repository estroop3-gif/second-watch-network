/**
 * ShotListView - Shot list builder with scene selector and shot management
 * Allows directors/DPs to build shot lists per scene with storyboard references
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
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
  Camera,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Clock,
  Search,
  Image,
  Video,
  Eye,
  Move,
  ChevronRight,
  Film,
  Target,
  AlertCircle,
  CheckCircle2,
  XCircle,
  GripVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useScenes, useShots, useSceneCoverageSummary } from '@/hooks/backlot';
import {
  BacklotScene,
  BacklotSceneShot,
  BacklotShotType,
  BacklotCameraMovement,
  BacklotCoverageStatus,
  BacklotShotPriority,
  SceneShotInput,
  SHOT_TYPE_LABELS,
  SHOT_TYPE_SHORT_LABELS,
  CAMERA_MOVEMENT_LABELS,
  COVERAGE_STATUS_LABELS,
  COVERAGE_STATUS_COLORS,
  SHOT_PRIORITY_LABELS,
  COMMON_LENSES,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ShotListViewProps {
  projectId: string;
  canEdit: boolean;
}

// Shot type options grouped
const SHOT_TYPES: BacklotShotType[] = [
  'ECU', 'CU', 'MCU', 'MS', 'MLS', 'LS', 'WS', 'EWS',
  'POV', 'OTS', 'INSERT', '2SHOT', 'GROUP', 'OTHER',
];

const CAMERA_MOVEMENTS: BacklotCameraMovement[] = [
  'static', 'pan', 'tilt', 'dolly', 'dolly_in', 'dolly_out',
  'tracking', 'handheld', 'gimbal', 'steadicam', 'crane', 'drone',
  'push_in', 'pull_out', 'zoom', 'whip_pan', 'rack_focus', 'other',
];

const PRIORITIES: BacklotShotPriority[] = ['must_have', 'nice_to_have'];

const COVERAGE_STATUSES: BacklotCoverageStatus[] = ['not_shot', 'shot', 'alt_needed', 'dropped'];

// Coverage status badge styling
const COVERAGE_BADGE_STYLES: Record<BacklotCoverageStatus, string> = {
  not_shot: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  shot: 'bg-green-500/20 text-green-400 border-green-500/30',
  alt_needed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dropped: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Priority badge styling
const PRIORITY_BADGE_STYLES: Record<BacklotShotPriority, string> = {
  must_have: 'bg-red-500/20 text-red-400 border-red-500/30',
  nice_to_have: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

// Scene selector item
const SceneItem: React.FC<{
  scene: BacklotScene;
  isSelected: boolean;
  shotCount: number;
  onClick: () => void;
}> = ({ scene, isSelected, shotCount, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2 rounded-lg transition-colors',
        isSelected
          ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30'
          : 'hover:bg-muted-gray/10 text-muted-gray hover:text-bone-white'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs shrink-0">{scene.scene_number}</span>
          <span className="truncate text-sm">{scene.scene_heading || 'Untitled Scene'}</span>
        </div>
        {shotCount > 0 && (
          <Badge variant="outline" className="text-xs shrink-0 ml-2">
            {shotCount}
          </Badge>
        )}
      </div>
    </button>
  );
};

// Shot card component
const ShotCard: React.FC<{
  shot: BacklotSceneShot;
  canEdit: boolean;
  onEdit: (shot: BacklotSceneShot) => void;
  onDelete: (id: string) => void;
  onCoverageChange: (id: string, status: BacklotCoverageStatus) => void;
}> = ({ shot, canEdit, onEdit, onDelete, onCoverageChange }) => {
  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors">
      <div className="flex items-start gap-3">
        {/* Drag handle (for future drag-and-drop) */}
        {canEdit && (
          <div className="text-muted-gray/50 cursor-grab">
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Header: Shot number, type, lens */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-mono text-sm font-medium text-accent-yellow">
              {shot.shot_number}
            </span>
            <Badge variant="outline" className="text-xs border-muted-gray/30">
              {SHOT_TYPE_SHORT_LABELS[shot.shot_type]}
            </Badge>
            {shot.lens && (
              <Badge variant="outline" className="text-xs border-muted-gray/30">
                {shot.lens}
              </Badge>
            )}
            {shot.camera_movement && shot.camera_movement !== 'static' && (
              <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                {CAMERA_MOVEMENT_LABELS[shot.camera_movement]}
              </Badge>
            )}
            {shot.priority && (
              <Badge
                variant="outline"
                className={cn('text-xs', PRIORITY_BADGE_STYLES[shot.priority])}
              >
                {SHOT_PRIORITY_LABELS[shot.priority]}
              </Badge>
            )}
          </div>

          {/* Description */}
          {shot.description && (
            <p className="text-sm text-muted-gray mb-2 line-clamp-2">{shot.description}</p>
          )}

          {/* Est time & coverage */}
          <div className="flex items-center gap-4 text-xs text-muted-gray">
            {shot.est_time_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {shot.est_time_minutes} min
              </span>
            )}
            {shot.images && shot.images.length > 0 && (
              <span className="flex items-center gap-1">
                <Image className="w-3 h-3" />
                {shot.images.length} ref{shot.images.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Right side: Status & Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Coverage status dropdown */}
          <Select
            value={shot.coverage_status}
            onValueChange={(val) => onCoverageChange(shot.id, val as BacklotCoverageStatus)}
            disabled={!canEdit}
          >
            <SelectTrigger className={cn(
              'w-[110px] h-8 text-xs',
              COVERAGE_BADGE_STYLES[shot.coverage_status]
            )}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COVERAGE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {COVERAGE_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Actions menu */}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(shot)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Shot
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-400"
                  onClick={() => onDelete(shot.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

// Empty state for no shots
const EmptyState: React.FC<{ sceneName?: string; canAdd: boolean; onAdd: () => void }> = ({
  sceneName,
  canAdd,
  onAdd,
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Camera className="w-12 h-12 text-muted-gray/50 mb-4" />
    <h3 className="text-lg font-medium text-bone-white mb-2">No shots planned</h3>
    <p className="text-sm text-muted-gray mb-4 max-w-md">
      {sceneName
        ? `Build your shot list for "${sceneName}" to plan coverage and track progress on set.`
        : 'Select a scene to start building your shot list.'}
    </p>
    {canAdd && sceneName && (
      <Button onClick={onAdd} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
        <Plus className="w-4 h-4 mr-2" />
        Add First Shot
      </Button>
    )}
  </div>
);

const ShotListView: React.FC<ShotListViewProps> = ({ projectId, canEdit }) => {
  const { toast } = useToast();
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingShot, setEditingShot] = useState<BacklotSceneShot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch scenes
  const { data: scenes, isLoading: scenesLoading } = useScenes(projectId);

  // Fetch shots for selected scene (or all if none selected)
  const {
    shots,
    isLoading: shotsLoading,
    createShot,
    updateShot,
    updateCoverage,
    deleteShot,
  } = useShots({
    projectId,
    sceneId: selectedSceneId,
  });

  // Scene coverage summary
  const { data: coverageSummary } = useSceneCoverageSummary(selectedSceneId);

  // Filter scenes by search
  const filteredScenes = useMemo(() => {
    if (!scenes) return [];
    if (!searchQuery) return scenes;
    const q = searchQuery.toLowerCase();
    return scenes.filter(
      (s) =>
        s.scene_number.toLowerCase().includes(q) ||
        s.scene_heading?.toLowerCase().includes(q)
    );
  }, [scenes, searchQuery]);

  // Count shots per scene
  const shotCountByScene = useMemo(() => {
    const counts = new Map<string, number>();
    shots?.forEach((shot) => {
      const count = counts.get(shot.scene_id) || 0;
      counts.set(shot.scene_id, count + 1);
    });
    return counts;
  }, [shots]);

  // Selected scene info
  const selectedScene = useMemo(
    () => scenes?.find((s) => s.id === selectedSceneId),
    [scenes, selectedSceneId]
  );

  // Form state
  const [formData, setFormData] = useState<SceneShotInput>({
    shot_type: 'MS',
    lens: '',
    camera_movement: 'static',
    description: '',
    est_time_minutes: undefined,
    priority: undefined,
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      shot_type: 'MS',
      lens: '',
      camera_movement: 'static',
      description: '',
      est_time_minutes: undefined,
      priority: undefined,
      notes: '',
    });
  };

  const handleOpenForm = (shot?: BacklotSceneShot) => {
    if (shot) {
      setEditingShot(shot);
      setFormData({
        shot_type: shot.shot_type,
        lens: shot.lens || '',
        camera_movement: shot.camera_movement || 'static',
        description: shot.description || '',
        est_time_minutes: shot.est_time_minutes,
        priority: shot.priority,
        notes: shot.notes || '',
      });
    } else {
      setEditingShot(null);
      resetForm();
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingShot(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSceneId) return;

    setIsSubmitting(true);
    try {
      if (editingShot) {
        await updateShot.mutateAsync({
          id: editingShot.id,
          ...formData,
        });
        toast({ title: 'Shot updated' });
      } else {
        await createShot.mutateAsync({
          projectId,
          sceneId: selectedSceneId,
          ...formData,
        });
        toast({ title: 'Shot added' });
      }
      handleCloseForm();
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save shot',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this shot?')) return;
    try {
      await deleteShot.mutateAsync(id);
      toast({ title: 'Shot deleted' });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete shot',
        variant: 'destructive',
      });
    }
  };

  const handleCoverageChange = async (id: string, status: BacklotCoverageStatus) => {
    try {
      await updateCoverage.mutateAsync({ id, coverage_status: status });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update coverage',
        variant: 'destructive',
      });
    }
  };

  // Filter shots for selected scene
  const sceneShots = useMemo(() => {
    if (!selectedSceneId) return [];
    return shots?.filter((s) => s.scene_id === selectedSceneId) || [];
  }, [shots, selectedSceneId]);

  if (scenesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 col-span-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading text-bone-white">Shot List</h2>
          <p className="text-sm text-muted-gray">
            Plan shots for each scene and track coverage on set
          </p>
        </div>
      </div>

      {/* Main layout: Scene selector + Shot list */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Scene selector sidebar */}
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
              <Film className="w-4 h-4" />
              Scenes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search scenes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-charcoal-black/50 border-muted-gray/20"
              />
            </div>

            {/* Scene list */}
            <div className="max-h-[500px] overflow-y-auto space-y-1">
              {filteredScenes.length === 0 ? (
                <p className="text-sm text-muted-gray text-center py-4">
                  No scenes found
                </p>
              ) : (
                filteredScenes.map((scene) => (
                  <SceneItem
                    key={scene.id}
                    scene={scene}
                    isSelected={scene.id === selectedSceneId}
                    shotCount={shotCountByScene.get(scene.id) || 0}
                    onClick={() => setSelectedSceneId(scene.id)}
                  />
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Shot list area */}
        <div className="lg:col-span-3 space-y-4">
          {/* Selected scene header with coverage summary */}
          {selectedScene && (
            <Card className="bg-charcoal-black/50 border-muted-gray/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-gray mb-1">
                      <span className="font-mono">{selectedScene.scene_number}</span>
                      <ChevronRight className="w-4 h-4" />
                      <span>{selectedScene.int_ext?.toUpperCase()}</span>
                      {selectedScene.time_of_day && (
                        <>
                          <span>-</span>
                          <span className="capitalize">{selectedScene.time_of_day}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-lg font-medium text-bone-white">
                      {selectedScene.scene_heading || 'Untitled Scene'}
                    </h3>
                  </div>

                  {/* Coverage stats */}
                  {coverageSummary && coverageSummary.total_shots > 0 && (
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-bone-white">
                          {coverageSummary.total_shots}
                        </div>
                        <div className="text-xs text-muted-gray">Shots</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {coverageSummary.shot}
                        </div>
                        <div className="text-xs text-muted-gray">Shot</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-muted-gray">
                          {coverageSummary.not_shot}
                        </div>
                        <div className="text-xs text-muted-gray">Remaining</div>
                      </div>
                      {coverageSummary.total_shots > 0 && (
                        <div className="w-24">
                          <Progress
                            value={(coverageSummary.shot / coverageSummary.total_shots) * 100}
                            className="h-2"
                          />
                          <div className="text-xs text-muted-gray mt-1 text-center">
                            {Math.round((coverageSummary.shot / coverageSummary.total_shots) * 100)}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add shot button */}
                  {canEdit && (
                    <Button
                      onClick={() => handleOpenForm()}
                      className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Shot
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Shot list */}
          {shotsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !selectedSceneId ? (
            <EmptyState canAdd={false} onAdd={() => {}} />
          ) : sceneShots.length === 0 ? (
            <EmptyState
              sceneName={selectedScene?.scene_heading || selectedScene?.scene_number}
              canAdd={canEdit}
              onAdd={() => handleOpenForm()}
            />
          ) : (
            <div className="space-y-2">
              {sceneShots.map((shot) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  canEdit={canEdit}
                  onEdit={handleOpenForm}
                  onDelete={handleDelete}
                  onCoverageChange={handleCoverageChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Shot Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && handleCloseForm()}>
        <DialogContent className="max-w-lg bg-charcoal-black border-muted-gray/20">
          <DialogHeader>
            <DialogTitle className="text-bone-white">
              {editingShot ? 'Edit Shot' : 'Add Shot'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shot Type & Lens row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shot_type">Shot Type *</Label>
                <Select
                  value={formData.shot_type}
                  onValueChange={(val) =>
                    setFormData({ ...formData, shot_type: val as BacklotShotType })
                  }
                >
                  <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SHOT_TYPE_SHORT_LABELS[type]} - {SHOT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lens">Lens</Label>
                <Select
                  value={formData.lens || ''}
                  onValueChange={(val) => setFormData({ ...formData, lens: val })}
                >
                  <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                    <SelectValue placeholder="Select lens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {COMMON_LENSES.map((lens) => (
                      <SelectItem key={lens} value={lens}>
                        {lens}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Camera Movement & Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="camera_movement">Camera Movement</Label>
                <Select
                  value={formData.camera_movement || 'static'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, camera_movement: val as BacklotCameraMovement })
                  }
                >
                  <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMERA_MOVEMENTS.map((movement) => (
                      <SelectItem key={movement} value={movement}>
                        {CAMERA_MOVEMENT_LABELS[movement]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority || ''}
                  onValueChange={(val) =>
                    setFormData({
                      ...formData,
                      priority: val ? (val as BacklotShotPriority) : undefined,
                    })
                  }
                >
                  <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {SHOT_PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estimated time */}
            <div className="space-y-2">
              <Label htmlFor="est_time_minutes">Estimated Time (minutes)</Label>
              <Input
                id="est_time_minutes"
                type="number"
                min="0"
                step="0.5"
                value={formData.est_time_minutes || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    est_time_minutes: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                placeholder="e.g. 15"
                className="bg-charcoal-black/50 border-muted-gray/20"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Shot Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the shot: subject, framing, action..."
                rows={3}
                className="bg-charcoal-black/50 border-muted-gray/20"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes, special requirements..."
                rows={2}
                className="bg-charcoal-black/50 border-muted-gray/20"
              />
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleCloseForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingShot ? 'Update Shot' : 'Add Shot'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShotListView;
