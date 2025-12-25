/**
 * ShotListView - Shot list builder with scene selector and shot management
 * Allows directors/DPs to build shot lists per scene with storyboard references
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Copy,
  FolderInput,
  X,
  CheckSquare,
  Square,
  HelpCircle,
  Keyboard,
  MousePointer2,
  Zap,
  Lightbulb,
  BookTemplate,
  Save,
  FileDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useScenes, useShots, useSceneCoverageSummary, useShotTemplates } from '@/hooks/backlot';
import type { ShotTemplateData, DefaultTemplate, ShotTemplate } from '@/hooks/backlot';
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

// Shot card component with inline editing
const ShotCard: React.FC<{
  shot: BacklotSceneShot;
  canEdit: boolean;
  multiSelectMode: boolean;
  isSelected: boolean;
  isFocused: boolean;
  onEdit: (shot: BacklotSceneShot) => void;
  onDelete: (id: string) => void;
  onCoverageChange: (id: string, status: BacklotCoverageStatus) => void;
  onClone: (shot: BacklotSceneShot) => void;
  onCloneToScene: (shot: BacklotSceneShot) => void;
  onToggleSelect: (id: string) => void;
  onInlineUpdate: (id: string, data: Partial<SceneShotInput>) => Promise<void>;
}> = ({
  shot,
  canEdit,
  multiSelectMode,
  isSelected,
  isFocused,
  onEdit,
  onDelete,
  onCoverageChange,
  onClone,
  onCloneToScene,
  onToggleSelect,
  onInlineUpdate,
}) => {
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editData, setEditData] = useState({
    shot_type: shot.shot_type,
    description: shot.description || '',
    est_time_minutes: shot.est_time_minutes,
  });
  const [isSaving, setIsSaving] = useState(false);
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null);

  // Reset edit data when shot changes
  React.useEffect(() => {
    setEditData({
      shot_type: shot.shot_type,
      description: shot.description || '',
      est_time_minutes: shot.est_time_minutes,
    });
  }, [shot]);

  const handleDoubleClick = () => {
    if (canEdit && !multiSelectMode) {
      setIsInlineEditing(true);
      // Focus description field after render
      setTimeout(() => descriptionRef.current?.focus(), 50);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;

    // Check if anything changed
    const hasChanges =
      editData.shot_type !== shot.shot_type ||
      editData.description !== (shot.description || '') ||
      editData.est_time_minutes !== shot.est_time_minutes;

    if (hasChanges) {
      setIsSaving(true);
      try {
        await onInlineUpdate(shot.id, editData);
      } finally {
        setIsSaving(false);
      }
    }
    setIsInlineEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      shot_type: shot.shot_type,
      description: shot.description || '',
      est_time_minutes: shot.est_time_minutes,
    });
    setIsInlineEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      className={cn(
        'bg-charcoal-black/50 border rounded-lg p-4 transition-colors',
        isInlineEditing
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : isSelected
          ? 'border-accent-yellow/50 bg-accent-yellow/5'
          : isFocused
          ? 'border-blue-500/50 bg-blue-500/5 ring-1 ring-blue-500/30'
          : 'border-muted-gray/20 hover:border-muted-gray/40'
      )}
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-start gap-3">
        {/* Multi-select checkbox */}
        {multiSelectMode ? (
          <button
            onClick={() => onToggleSelect(shot.id)}
            className="text-muted-gray hover:text-bone-white mt-0.5"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-accent-yellow" />
            ) : (
              <Square className="w-5 h-5" />
            )}
          </button>
        ) : (
          /* Drag handle (for future drag-and-drop) */
          canEdit && (
            <div className="text-muted-gray/50 cursor-grab">
              <GripVertical className="w-4 h-4" />
            </div>
          )
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {isInlineEditing ? (
            // Inline editing mode
            <div className="space-y-3" onKeyDown={handleKeyDown}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-accent-yellow">
                  {shot.shot_number}
                </span>
                <Select
                  value={editData.shot_type}
                  onValueChange={(val) =>
                    setEditData({ ...editData, shot_type: val as BacklotShotType })
                  }
                >
                  <SelectTrigger className="w-[100px] h-7 text-xs bg-charcoal-black/50 border-muted-gray/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SHOT_TYPE_SHORT_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="min"
                  value={editData.est_time_minutes || ''}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      est_time_minutes: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  className="w-[70px] h-7 text-xs bg-charcoal-black/50 border-muted-gray/30"
                />
              </div>
              <Textarea
                ref={descriptionRef}
                value={editData.description}
                onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                placeholder="Shot description..."
                rows={2}
                className="text-sm bg-charcoal-black/50 border-muted-gray/30 resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-gray/50">
                  <kbd className="px-1 bg-muted-gray/10 rounded">⌘+Enter</kbd> save · <kbd className="px-1 bg-muted-gray/10 rounded">Esc</kbd> cancel
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="h-6 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="h-6 px-2 text-xs bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Display mode
            <>
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
            </>
          )}
        </div>

        {/* Right side: Status & Actions */}
        {!isInlineEditing && (
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
            {canEdit && !multiSelectMode && (
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
                  <DropdownMenuItem onClick={() => onClone(shot)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Clone
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCloneToScene(shot)}>
                    <FolderInput className="w-4 h-4 mr-2" />
                    Clone to Scene...
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
        )}
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

  // Multi-select state for bulk operations
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());

  // Clone to scene dialog state
  const [showCloneToSceneDialog, setShowCloneToSceneDialog] = useState(false);
  const [cloneSourceShot, setCloneSourceShot] = useState<BacklotSceneShot | null>(null);
  const [cloneDestinationSceneId, setCloneDestinationSceneId] = useState<string | null>(null);
  const [isCloningBulk, setIsCloningBulk] = useState(false);

  // Quick-add mode state
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [lastShotData, setLastShotData] = useState<Partial<SceneShotInput>>({});

  // Keyboard navigation state
  const [focusedShotIndex, setFocusedShotIndex] = useState<number>(-1);
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  // Template state
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateDescription, setSaveTemplateDescription] = useState('');

  // PDF export state
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Fetch templates
  const { defaultTemplates, personalTemplates, createTemplate } = useShotTemplates({ projectId });

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
    cloneShot,
    bulkCloneShots,
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

  const handleSubmit = async (e: React.FormEvent, continueAdding = false) => {
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
        handleCloseForm();
      } else {
        await createShot.mutateAsync({
          projectId,
          sceneId: selectedSceneId,
          ...formData,
        });
        toast({ title: 'Shot added' });

        if (quickAddMode || continueAdding) {
          // Save current form data for next shot (preserve settings)
          setLastShotData({
            shot_type: formData.shot_type,
            lens: formData.lens,
            camera_movement: formData.camera_movement,
            priority: formData.priority,
            est_time_minutes: formData.est_time_minutes,
          });

          // Reset form but keep inherited fields
          setFormData({
            shot_type: formData.shot_type,
            lens: formData.lens,
            camera_movement: formData.camera_movement,
            description: '',
            est_time_minutes: formData.est_time_minutes,
            priority: formData.priority,
            notes: '',
          });
          setEditingShot(null);
          // Keep dialog open for next shot
        } else {
          handleCloseForm();
        }
      }
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

  // Clone a single shot in place (same scene)
  const handleCloneInPlace = async (shot: BacklotSceneShot) => {
    try {
      const cloned = await cloneShot.mutateAsync({ shotId: shot.id });
      toast({ title: 'Shot cloned', description: `Created shot ${cloned.shot_number}` });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to clone shot',
        variant: 'destructive',
      });
    }
  };

  // Open clone to scene dialog for single shot
  const handleCloneToSceneOpen = (shot: BacklotSceneShot) => {
    setCloneSourceShot(shot);
    setIsCloningBulk(false);
    setCloneDestinationSceneId(null);
    setShowCloneToSceneDialog(true);
  };

  // Open clone to scene dialog for bulk selected shots
  const handleBulkCloneToSceneOpen = () => {
    setCloneSourceShot(null);
    setIsCloningBulk(true);
    setCloneDestinationSceneId(null);
    setShowCloneToSceneDialog(true);
  };

  // Perform the clone to scene operation
  const handleCloneToScene = async () => {
    if (!cloneDestinationSceneId) {
      toast({ title: 'Select a destination scene', variant: 'destructive' });
      return;
    }

    try {
      if (isCloningBulk && selectedShotIds.size > 0) {
        // Bulk clone
        const result = await bulkCloneShots.mutateAsync({
          projectId,
          shotIds: Array.from(selectedShotIds),
          destinationSceneId: cloneDestinationSceneId,
        });
        toast({ title: 'Shots cloned', description: `Created ${result.count} shots` });
        setSelectedShotIds(new Set());
        setMultiSelectMode(false);
      } else if (cloneSourceShot) {
        // Single shot clone
        const cloned = await cloneShot.mutateAsync({
          shotId: cloneSourceShot.id,
          destinationSceneId: cloneDestinationSceneId,
        });
        toast({ title: 'Shot cloned', description: `Created shot ${cloned.shot_number}` });
      }
      setShowCloneToSceneDialog(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to clone shot(s)',
        variant: 'destructive',
      });
    }
  };

  // Bulk clone in place (same scene)
  const handleBulkCloneInPlace = async () => {
    if (selectedShotIds.size === 0) return;

    try {
      const result = await bulkCloneShots.mutateAsync({
        projectId,
        shotIds: Array.from(selectedShotIds),
        // No destination = clone in place
      });
      toast({ title: 'Shots cloned', description: `Created ${result.count} shots` });
      setSelectedShotIds(new Set());
      setMultiSelectMode(false);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to clone shots',
        variant: 'destructive',
      });
    }
  };

  // Toggle shot selection
  const toggleShotSelection = (shotId: string) => {
    const newSelected = new Set(selectedShotIds);
    if (newSelected.has(shotId)) {
      newSelected.delete(shotId);
    } else {
      newSelected.add(shotId);
    }
    setSelectedShotIds(newSelected);
  };

  // Select/deselect all shots in current scene
  const toggleSelectAll = () => {
    if (selectedShotIds.size === sceneShots.length) {
      setSelectedShotIds(new Set());
    } else {
      setSelectedShotIds(new Set(sceneShots.map((s) => s.id)));
    }
  };

  // Exit multi-select mode
  const exitMultiSelectMode = () => {
    setMultiSelectMode(false);
    setSelectedShotIds(new Set());
  };

  // Inline update handler
  const handleInlineUpdate = async (id: string, data: Partial<SceneShotInput>) => {
    try {
      await updateShot.mutateAsync({ id, ...data });
      toast({ title: 'Shot updated' });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to update shot',
        variant: 'destructive',
      });
    }
  };

  // Apply template to form
  const handleApplyTemplate = (template: DefaultTemplate | ShotTemplate) => {
    const data = 'template_data' in template && typeof template.template_data === 'object'
      ? template.template_data
      : template;

    setFormData({
      ...formData,
      shot_type: (data.frame_size as BacklotShotType) || formData.shot_type,
      lens: data.lens || '',
      camera_movement: (data.movement as BacklotCameraMovement) || 'static',
      est_time_minutes: data.est_time_minutes,
    });
    setShowTemplatesDropdown(false);
    toast({ title: `Applied template: ${template.name}` });
  };

  // Save current form as template
  const handleSaveAsTemplate = async () => {
    if (!saveTemplateName.trim()) {
      toast({ title: 'Please enter a template name', variant: 'destructive' });
      return;
    }

    try {
      await createTemplate.mutateAsync({
        name: saveTemplateName.trim(),
        description: saveTemplateDescription.trim() || undefined,
        template_data: {
          frame_size: formData.shot_type,
          lens: formData.lens,
          movement: formData.camera_movement,
          est_time_minutes: formData.est_time_minutes,
        },
      });
      toast({ title: 'Template saved!' });
      setShowSaveTemplateDialog(false);
      setSaveTemplateName('');
      setSaveTemplateDescription('');
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save template',
        variant: 'destructive',
      });
    }
  };

  // Export shot list to PDF
  const handleExportPdf = async () => {
    if (!selectedSceneId || !selectedScene || sceneShots.length === 0) {
      toast({ title: 'No shots to export', variant: 'destructive' });
      return;
    }

    setIsExportingPdf(true);
    try {
      // Build PDF content using browser print
      const printContent = `
        <html>
          <head>
            <title>Shot List - ${selectedScene.scene_number}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333; }
              h1 { font-size: 24px; margin-bottom: 8px; }
              .scene-info { color: #666; margin-bottom: 24px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px; }
              th { background: #f5f5f5; font-weight: 600; }
              .shot-number { font-family: monospace; font-weight: bold; }
              .coverage { padding: 2px 8px; border-radius: 4px; font-size: 11px; }
              .coverage-shot { background: #d4edda; color: #155724; }
              .coverage-not_shot { background: #f8f9fa; color: #6c757d; }
              .coverage-alt_needed { background: #fff3cd; color: #856404; }
              .coverage-dropped { background: #f8d7da; color: #721c24; }
              .stats { display: flex; gap: 24px; margin-bottom: 16px; }
              .stat { text-align: center; }
              .stat-value { font-size: 24px; font-weight: bold; }
              .stat-label { font-size: 11px; color: #666; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <h1>Shot List: ${selectedScene.scene_number}</h1>
            <div class="scene-info">
              ${selectedScene.scene_heading || 'Untitled Scene'}<br/>
              ${selectedScene.int_ext?.toUpperCase() || ''} ${selectedScene.time_of_day ? `- ${selectedScene.time_of_day.toUpperCase()}` : ''}
            </div>
            ${coverageSummary ? `
              <div class="stats">
                <div class="stat"><div class="stat-value">${coverageSummary.total_shots}</div><div class="stat-label">Total Shots</div></div>
                <div class="stat"><div class="stat-value" style="color: #28a745;">${coverageSummary.shot}</div><div class="stat-label">Shot</div></div>
                <div class="stat"><div class="stat-value" style="color: #6c757d;">${coverageSummary.not_shot}</div><div class="stat-label">Remaining</div></div>
              </div>
            ` : ''}
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;">Shot</th>
                  <th style="width: 60px;">Type</th>
                  <th style="width: 80px;">Lens</th>
                  <th style="width: 80px;">Movement</th>
                  <th>Description</th>
                  <th style="width: 60px;">Time</th>
                  <th style="width: 80px;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${sceneShots.map(shot => `
                  <tr>
                    <td class="shot-number">${shot.shot_number}</td>
                    <td>${SHOT_TYPE_SHORT_LABELS[shot.shot_type] || shot.shot_type}</td>
                    <td>${shot.lens || '-'}</td>
                    <td>${shot.camera_movement ? CAMERA_MOVEMENT_LABELS[shot.camera_movement] : '-'}</td>
                    <td>${shot.description || '-'}</td>
                    <td>${shot.est_time_minutes ? `${shot.est_time_minutes}m` : '-'}</td>
                    <td><span class="coverage coverage-${shot.coverage_status}">${COVERAGE_STATUS_LABELS[shot.coverage_status]}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="margin-top: 24px; font-size: 11px; color: #999;">
              Generated from Second Watch Network • ${new Date().toLocaleDateString()}
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
      }
      toast({ title: 'PDF export ready' });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Filter shots for selected scene
  const sceneShots = useMemo(() => {
    if (!selectedSceneId) return [];
    return shots?.filter((s) => s.scene_id === selectedSceneId) || [];
  }, [shots, selectedSceneId]);

  // Get focused shot
  const focusedShot = useMemo(() => {
    if (focusedShotIndex >= 0 && focusedShotIndex < sceneShots.length) {
      return sceneShots[focusedShotIndex];
    }
    return null;
  }, [sceneShots, focusedShotIndex]);

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger shortcuts when dialog is open
      if (showForm || showCloneToSceneDialog) {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (showForm) handleCloseForm();
          if (showCloneToSceneDialog) setShowCloneToSceneDialog(false);
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          // New shot
          if (selectedSceneId && canEdit) {
            e.preventDefault();
            handleOpenForm();
          }
          break;

        case 'c':
          // Clone focused shot
          if (focusedShot && canEdit && !multiSelectMode) {
            e.preventDefault();
            handleCloneInPlace(focusedShot);
          } else if (multiSelectMode && selectedShotIds.size > 0 && canEdit) {
            e.preventDefault();
            handleBulkCloneInPlace();
          }
          break;

        case 'e':
          // Edit focused shot
          if (focusedShot && canEdit) {
            e.preventDefault();
            handleOpenForm(focusedShot);
          }
          break;

        case 'delete':
        case 'backspace':
          // Delete focused shot
          if (focusedShot && canEdit && !multiSelectMode) {
            e.preventDefault();
            handleDelete(focusedShot.id);
          }
          break;

        case 'escape':
          // Deselect / exit multi-select mode
          e.preventDefault();
          if (multiSelectMode) {
            exitMultiSelectMode();
          } else if (focusedShotIndex >= 0) {
            setFocusedShotIndex(-1);
          }
          break;

        case 'arrowup':
          // Navigate up
          e.preventDefault();
          if (sceneShots.length > 0) {
            setFocusedShotIndex((prev) =>
              prev <= 0 ? sceneShots.length - 1 : prev - 1
            );
          }
          break;

        case 'arrowdown':
          // Navigate down
          e.preventDefault();
          if (sceneShots.length > 0) {
            setFocusedShotIndex((prev) =>
              prev >= sceneShots.length - 1 ? 0 : prev + 1
            );
          }
          break;

        case ' ':
          // Toggle selection (in multi-select mode) or enter multi-select
          if (focusedShot && canEdit) {
            e.preventDefault();
            if (!multiSelectMode) {
              setMultiSelectMode(true);
              setSelectedShotIds(new Set([focusedShot.id]));
            } else {
              toggleShotSelection(focusedShot.id);
            }
          }
          break;

        case 'a':
          // Select all (Cmd/Ctrl + A)
          if ((e.metaKey || e.ctrlKey) && multiSelectMode && sceneShots.length > 0) {
            e.preventDefault();
            toggleSelectAll();
          }
          break;

        case 's':
          // Enter multi-select mode
          if (canEdit && sceneShots.length > 0 && !multiSelectMode) {
            e.preventDefault();
            setMultiSelectMode(true);
          }
          break;

        case '?':
          // Show tips panel
          e.preventDefault();
          setShowTipsPanel((prev) => !prev);
          break;
      }
    },
    [
      showForm,
      showCloneToSceneDialog,
      selectedSceneId,
      canEdit,
      focusedShot,
      focusedShotIndex,
      multiSelectMode,
      selectedShotIds,
      sceneShots,
      handleOpenForm,
      handleCloseForm,
      handleCloneInPlace,
      handleBulkCloneInPlace,
      handleDelete,
      exitMultiSelectMode,
      toggleShotSelection,
      toggleSelectAll,
    ]
  );

  // Attach keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset focused index when scene changes
  useEffect(() => {
    setFocusedShotIndex(-1);
  }, [selectedSceneId]);

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
        <div className="flex items-center gap-2">
          {/* Templates Dropdown */}
          <DropdownMenu open={showTemplatesDropdown} onOpenChange={setShowTemplatesDropdown}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-muted-gray/30 gap-2"
              >
                <BookTemplate className="w-4 h-4" />
                Templates
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-charcoal-black border-muted-gray/20">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-gray">Default Templates</div>
              {defaultTemplates.map((template, idx) => (
                <DropdownMenuItem
                  key={`default-${idx}`}
                  onClick={() => handleApplyTemplate(template)}
                  className="flex flex-col items-start"
                >
                  <span className="font-medium">{template.name}</span>
                  <span className="text-xs text-muted-gray">
                    {template.template_data.frame_size} | {template.template_data.lens} | {template.template_data.movement}
                  </span>
                </DropdownMenuItem>
              ))}
              {personalTemplates.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-gray">Your Templates</div>
                  {personalTemplates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      onClick={() => handleApplyTemplate(template)}
                      className="flex flex-col items-start"
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="text-xs text-muted-gray">
                        {template.template_data.frame_size} | {template.template_data.lens} | {template.template_data.movement}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-muted-gray/30 gap-2"
          >
            <Lightbulb className="w-4 h-4" />
            Tips & Shortcuts
          </Button>
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

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {/* Export PDF button - always visible when there are shots */}
                    {sceneShots.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportPdf}
                        disabled={isExportingPdf}
                        className="border-muted-gray/30"
                      >
                        {isExportingPdf ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <FileDown className="w-4 h-4 mr-2" />
                        )}
                        Export PDF
                      </Button>
                    )}
                    {canEdit && (
                      <>
                        {sceneShots.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (multiSelectMode) {
                                exitMultiSelectMode();
                              } else {
                                setMultiSelectMode(true);
                              }
                            }}
                            className={cn(
                              'border-muted-gray/30',
                              multiSelectMode && 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow'
                            )}
                          >
                            {multiSelectMode ? (
                              <>
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </>
                            ) : (
                              <>
                                <CheckSquare className="w-4 h-4 mr-2" />
                                Select
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          onClick={() => handleOpenForm()}
                          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Shot
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Multi-select action bar */}
          {multiSelectMode && selectedShotIds.size > 0 && (
            <Card className="bg-accent-yellow/10 border-accent-yellow/30">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 text-sm text-accent-yellow hover:text-bone-white"
                    >
                      {selectedShotIds.size === sceneShots.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      {selectedShotIds.size === sceneShots.length ? 'Deselect All' : 'Select All'}
                    </button>
                    <span className="text-sm text-muted-gray">
                      {selectedShotIds.size} shot{selectedShotIds.size !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkCloneInPlace}
                      disabled={bulkCloneShots.isPending}
                      className="border-muted-gray/30"
                    >
                      {bulkCloneShots.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Copy className="w-4 h-4 mr-2" />
                      )}
                      Clone
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkCloneToSceneOpen}
                      className="border-muted-gray/30"
                    >
                      <FolderInput className="w-4 h-4 mr-2" />
                      Clone to Scene...
                    </Button>
                  </div>
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
              {sceneShots.map((shot, index) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  canEdit={canEdit}
                  multiSelectMode={multiSelectMode}
                  isSelected={selectedShotIds.has(shot.id)}
                  isFocused={focusedShotIndex === index}
                  onEdit={handleOpenForm}
                  onDelete={handleDelete}
                  onCoverageChange={handleCoverageChange}
                  onClone={handleCloneInPlace}
                  onCloneToScene={handleCloneToSceneOpen}
                  onToggleSelect={toggleShotSelection}
                  onInlineUpdate={handleInlineUpdate}
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
            <div className="flex items-center justify-between">
              <DialogTitle className="text-bone-white">
                {editingShot ? 'Edit Shot' : 'Add Shot'}
              </DialogTitle>
              {!editingShot && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={quickAddMode}
                    onChange={(e) => setQuickAddMode(e.target.checked)}
                    className="rounded border-muted-gray/30 bg-charcoal-black/50 text-accent-yellow focus:ring-accent-yellow"
                  />
                  <span className="text-muted-gray">Quick Add</span>
                </label>
              )}
            </div>
          </DialogHeader>
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
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
            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSaveTemplateDialog(true)}
                className="text-muted-gray hover:text-bone-white gap-1"
              >
                <Save className="w-4 h-4" />
                Save as Template
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  {quickAddMode && !editingShot ? 'Done' : 'Cancel'}
                </Button>
                {!editingShot && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
                    className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save & Add Another
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingShot ? 'Update Shot' : quickAddMode ? 'Save & Continue' : 'Add Shot'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Clone to Scene Dialog */}
      <Dialog open={showCloneToSceneDialog} onOpenChange={(open) => !open && setShowCloneToSceneDialog(false)}>
        <DialogContent className="max-w-md bg-charcoal-black border-muted-gray/20">
          <DialogHeader>
            <DialogTitle className="text-bone-white">
              {isCloningBulk
                ? `Clone ${selectedShotIds.size} Shot${selectedShotIds.size !== 1 ? 's' : ''} to Scene`
                : 'Clone Shot to Scene'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destination Scene</Label>
              <Select
                value={cloneDestinationSceneId || ''}
                onValueChange={(val) => setCloneDestinationSceneId(val || null)}
              >
                <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/20">
                  <SelectValue placeholder="Select destination scene" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {scenes?.map((scene) => (
                    <SelectItem
                      key={scene.id}
                      value={scene.id}
                      disabled={scene.id === selectedSceneId}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{scene.scene_number}</span>
                        <span className="truncate">{scene.scene_heading || 'Untitled'}</span>
                        {scene.id === selectedSceneId && (
                          <span className="text-xs text-muted-gray">(current)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cloneSourceShot && (
              <div className="bg-muted-gray/10 rounded-lg p-3">
                <p className="text-sm text-muted-gray mb-1">Cloning:</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-accent-yellow">
                    {cloneSourceShot.shot_number}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {SHOT_TYPE_SHORT_LABELS[cloneSourceShot.shot_type]}
                  </Badge>
                  {cloneSourceShot.description && (
                    <span className="text-sm text-muted-gray truncate">
                      {cloneSourceShot.description}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCloneToSceneDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCloneToScene}
                disabled={!cloneDestinationSceneId || cloneShot.isPending || bulkCloneShots.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {(cloneShot.isPending || bulkCloneShots.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Clone to Scene
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save as Template Dialog */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="max-w-md bg-charcoal-black border-muted-gray/20">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <BookTemplate className="w-5 h-5 text-accent-yellow" />
              Save as Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={saveTemplateName}
                onChange={(e) => setSaveTemplateName(e.target.value)}
                placeholder="e.g., Standard CU, Walk & Talk..."
                className="bg-charcoal-black/50 border-muted-gray/20"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={saveTemplateDescription}
                onChange={(e) => setSaveTemplateDescription(e.target.value)}
                placeholder="Brief description of when to use this template..."
                rows={2}
                className="bg-charcoal-black/50 border-muted-gray/20"
              />
            </div>
            <div className="bg-muted-gray/10 rounded-lg p-3">
              <p className="text-xs text-muted-gray mb-2">Template will save:</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{SHOT_TYPE_LABELS[formData.shot_type]}</Badge>
                {formData.lens && <Badge variant="outline">{formData.lens}</Badge>}
                {formData.camera_movement && (
                  <Badge variant="outline">{CAMERA_MOVEMENT_LABELS[formData.camera_movement]}</Badge>
                )}
                {formData.est_time_minutes && (
                  <Badge variant="outline">{formData.est_time_minutes} min</Badge>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowSaveTemplateDialog(false);
                  setSaveTemplateName('');
                  setSaveTemplateDescription('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveAsTemplate}
                disabled={!saveTemplateName.trim() || createTemplate.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {createTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tips & Shortcuts Panel */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="max-w-2xl bg-charcoal-black border-muted-gray/20 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent-yellow" />
              Tips & Shortcuts
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Quick Actions
              </h3>
              <div className="grid gap-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Copy className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Clone Shots</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Use the <span className="text-bone-white">⋮ menu</span> on any shot to clone it in place or to another scene.
                      Select multiple shots with the <span className="text-bone-white">Select</span> button to bulk clone.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Zap className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Quick Add Mode</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Enable <span className="text-bone-white">Quick Add</span> checkbox when adding shots. After saving,
                      the form stays open with your settings (lens, movement, priority) preserved for rapid entry.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <CheckSquare className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Multi-Select Mode</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Click <span className="text-bone-white">Select</span> button to enter multi-select mode.
                      Check multiple shots to clone or move them in bulk.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mouse Shortcuts */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <MousePointer2 className="w-4 h-4" />
                Mouse Shortcuts
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-3 p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <span className="text-xs text-muted-gray bg-muted-gray/20 px-2 py-1 rounded font-mono">Double-click</span>
                  <span className="text-muted-gray">Quick edit shot type, time, and description inline</span>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Keyboard className="w-4 h-4" />
                Keyboard Shortcuts
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">N</kbd>
                  <span className="text-muted-gray">New shot</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">E</kbd>
                  <span className="text-muted-gray">Edit shot</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">C</kbd>
                  <span className="text-muted-gray">Clone shot</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">Del</kbd>
                  <span className="text-muted-gray">Delete shot</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">S</kbd>
                  <span className="text-muted-gray">Select mode</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">Space</kbd>
                  <span className="text-muted-gray">Toggle select</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">↑ / ↓</kbd>
                  <span className="text-muted-gray">Navigate shots</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10">
                  <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">Esc</kbd>
                  <span className="text-muted-gray">Cancel / Close</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10 col-span-2">
                  <div className="flex gap-1">
                    <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">⌘/Ctrl</kbd>
                    <span className="text-muted-gray">+</span>
                    <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">A</kbd>
                  </div>
                  <span className="text-muted-gray">Select all (in select mode)</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted-gray/5 rounded border border-muted-gray/10 col-span-2">
                  <div className="flex gap-1">
                    <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">⌘/Ctrl</kbd>
                    <span className="text-muted-gray">+</span>
                    <kbd className="px-2 py-0.5 bg-muted-gray/20 rounded text-xs font-mono">Enter</kbd>
                  </div>
                  <span className="text-muted-gray">Save (when inline editing)</span>
                </div>
              </div>
            </div>

            {/* Pro Tips */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                Pro Tips
              </h3>
              <div className="text-xs text-muted-gray space-y-2 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                <p>• Use <span className="text-bone-white">Save & Add Another</span> button for batch shot creation without Quick Add mode</p>
                <p>• Clone shots to other scenes to quickly set up coverage for similar setups</p>
                <p>• Press <kbd className="px-1 bg-muted-gray/20 rounded">?</kbd> anytime to open this panel</p>
                <p>• Use arrow keys to navigate, then press <span className="text-bone-white">E</span> to edit or <span className="text-bone-white">C</span> to clone</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShotListView;
