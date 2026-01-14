/**
 * StoryboardView - Visual shot planning tool
 *
 * Features:
 * - Multiple storyboards per project
 * - Sections to organize panels
 * - Panel editing with shot details
 * - Reorder panels and sections
 * - Lock/unlock status
 * - Export CSV and Print view
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Images,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Lock,
  Unlock,
  Download,
  Printer,
  MoreVertical,
  GripVertical,
  Pencil,
  ChevronUp,
  ChevronDown,
  Film,
  Camera,
  FileText,
  Image as ImageIcon,
  Clock,
  X,
  List,
  LayoutGrid,
  Grid3X3,
  Link2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useStoryboards,
  useStoryboard,
  useCreateStoryboard,
  useUpdateStoryboard,
  useDeleteStoryboard,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useCreatePanel,
  useUpdatePanel,
  useDeletePanel,
  useReorderSections,
  useReorderPanels,
  usePanelImageUpload,
  getStoryboardExportUrl,
  calculateTotalDuration,
  formatDuration,
  SHOT_SIZES,
  CAMERA_MOVES,
  ASPECT_RATIOS,
  Storyboard,
  StoryboardSection,
  StoryboardPanel,
  StoryboardViewMode,
  // For entity connections
  useEpisodes,
  useScenes,
  useShotLists,
  useMoodboards,
  useProject,
} from '@/hooks/backlot';
import { PanelImageUploader } from './storyboard/PanelImageUploader';
import { generateStoryboardSummaryPdf } from './storyboard-summary-pdf';

interface StoryboardViewProps {
  projectId: string;
  canEdit: boolean;
}

// Panel Card Component
function PanelCard({
  panel,
  index,
  canEdit,
  isLocked,
  onView,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  panel: StoryboardPanel;
  index: number;
  canEdit: boolean;
  isLocked: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const canModify = canEdit && !isLocked;
  const shotInfo = SHOT_SIZES.find((s) => s.value === panel.shot_size);
  const moveInfo = CAMERA_MOVES.find((m) => m.value === panel.camera_move);

  return (
    <Card
      className="bg-white/5 border-white/10 group hover:border-white/20 transition-colors cursor-pointer"
      onClick={onView}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* Reorder Handle */}
          {canModify && (
            <div className="flex flex-col items-center gap-0.5 pt-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={onMoveUp}
                disabled={isFirst}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <GripVertical className="w-4 h-4 text-muted-gray" />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={onMoveDown}
                disabled={isLast}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Thumbnail Area - Read Only */}
          <div className="w-32 h-20 flex-shrink-0 bg-white/5 rounded overflow-hidden">
            {panel.reference_image_url ? (
              <img
                src={panel.reference_image_url}
                alt="Panel reference"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-muted-gray" />
              </div>
            )}
          </div>

          {/* Panel Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-gray">#{index + 1}</span>
                  <h4 className="font-medium text-bone-white truncate">
                    {panel.title || `Panel ${index + 1}`}
                  </h4>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {panel.shot_size && (
                    <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                      {shotInfo?.label || panel.shot_size}
                    </Badge>
                  )}
                  {panel.camera_move && (
                    <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                      {moveInfo?.label || panel.camera_move}
                    </Badge>
                  )}
                  {panel.lens && (
                    <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                      {panel.lens}
                    </Badge>
                  )}
                  {panel.duration_seconds && (
                    <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                      <Clock className="w-3 h-3 mr-1" />
                      {panel.duration_seconds}s
                    </Badge>
                  )}
                </div>
              </div>
              {canModify && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit Panel
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-red-400">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {/* Action/Dialogue preview */}
            {(panel.action || panel.dialogue) && (
              <div className="mt-2 text-xs text-muted-gray line-clamp-2">
                {panel.action || panel.dialogue}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Panel List View - Table layout
function PanelListView({
  panels,
  canEdit,
  isLocked,
  onView,
  onEdit,
  onDelete,
}: {
  panels: StoryboardPanel[];
  canEdit: boolean;
  isLocked: boolean;
  onView: (panel: StoryboardPanel) => void;
  onEdit: (panel: StoryboardPanel) => void;
  onDelete: (panelId: string) => void;
}) {
  const canModify = canEdit && !isLocked;
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-white/10 hover:bg-transparent">
          <TableHead className="w-12 text-muted-gray">#</TableHead>
          <TableHead className="w-16 text-muted-gray">Image</TableHead>
          <TableHead className="text-muted-gray">Title</TableHead>
          <TableHead className="text-muted-gray">Shot</TableHead>
          <TableHead className="text-muted-gray">Move</TableHead>
          <TableHead className="w-20 text-muted-gray">Duration</TableHead>
          {canModify && <TableHead className="w-12"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {panels.map((panel, idx) => {
          const shotInfo = SHOT_SIZES.find((s) => s.value === panel.shot_size);
          const moveInfo = CAMERA_MOVES.find((m) => m.value === panel.camera_move);
          return (
            <TableRow
              key={panel.id}
              className="border-white/10 cursor-pointer hover:bg-white/5"
              onClick={() => onView(panel)}
            >
              <TableCell className="text-muted-gray">{idx + 1}</TableCell>
              <TableCell>
                <div className="w-12 h-8 bg-white/5 rounded overflow-hidden">
                  {panel.reference_image_url ? (
                    <img src={panel.reference_image_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-3 h-3 text-muted-gray" />
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-bone-white">{panel.title || `Panel ${idx + 1}`}</TableCell>
              <TableCell className="text-muted-gray">{shotInfo?.label || panel.shot_size || '-'}</TableCell>
              <TableCell className="text-muted-gray">{moveInfo?.label || panel.camera_move || '-'}</TableCell>
              <TableCell className="text-muted-gray">{panel.duration_seconds ? `${panel.duration_seconds}s` : '-'}</TableCell>
              {canModify && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(panel); }}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDelete(panel.id); }} className="text-red-400">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Panel Grid View - Thumbnail grid
function PanelGridView({
  panels,
  onView,
}: {
  panels: StoryboardPanel[];
  onView: (panel: StoryboardPanel) => void;
}) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {panels.map((panel, idx) => (
        <div
          key={panel.id}
          className="relative aspect-video bg-white/5 rounded cursor-pointer hover:ring-2 hover:ring-accent-yellow/50 transition-all overflow-hidden group"
          onClick={() => onView(panel)}
        >
          {panel.reference_image_url ? (
            <img src={panel.reference_image_url} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-gray mb-1" />
              <span className="text-xs text-muted-gray">#{idx + 1}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-xs text-bone-white truncate">{panel.title || `Panel ${idx + 1}`}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Panel Filmstrip View - Horizontal scroll
function PanelFilmstripView({
  panels,
  onView,
}: {
  panels: StoryboardPanel[];
  onView: (panel: StoryboardPanel) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
      {panels.map((panel, idx) => (
        <div
          key={panel.id}
          className="flex-shrink-0 w-48 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => onView(panel)}
        >
          <div className="aspect-video bg-white/5 rounded-lg overflow-hidden border-2 border-white/10 hover:border-accent-yellow/50">
            {panel.reference_image_url ? (
              <img src={panel.reference_image_url} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-gray" />
              </div>
            )}
          </div>
          <div className="mt-2 px-1">
            <p className="text-sm text-bone-white truncate">{panel.title || `Panel ${idx + 1}`}</p>
            <p className="text-xs text-muted-gray">
              #{idx + 1}
              {panel.shot_size && ` • ${SHOT_SIZES.find((s) => s.value === panel.shot_size)?.label || panel.shot_size}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Section Component
type PanelViewModeType = 'list' | 'card' | 'grid' | 'filmstrip';

function SectionBlock({
  section,
  sectionIndex,
  totalSections,
  canEdit,
  isLocked,
  panelViewMode,
  onEditSection,
  onDeleteSection,
  onAddPanel,
  onViewPanel,
  onEditPanel,
  onDeletePanel,
  onMoveSection,
  onMovePanel,
}: {
  section: StoryboardSection & { panels?: StoryboardPanel[] };
  sectionIndex: number;
  totalSections: number;
  canEdit: boolean;
  isLocked: boolean;
  panelViewMode: PanelViewModeType;
  onEditSection: (section: StoryboardSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddPanel: (sectionId: string) => void;
  onViewPanel: (panel: StoryboardPanel) => void;
  onEditPanel: (panel: StoryboardPanel) => void;
  onDeletePanel: (panelId: string) => void;
  onMoveSection: (sectionId: string, direction: 'up' | 'down') => void;
  onMovePanel: (panelId: string, sectionId: string, direction: 'up' | 'down') => void;
}) {
  const canModify = canEdit && !isLocked;
  const panels = section.panels || [];

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      {/* Section Header */}
      <div className="bg-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canModify && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onMoveSection(section.id, 'up')}
                disabled={sectionIndex === 0}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => onMoveSection(section.id, 'down')}
                disabled={sectionIndex === totalSections - 1}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div>
            <h3 className="font-medium text-bone-white">{section.title}</h3>
            <p className="text-xs text-muted-gray">{panels.length} panel(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canModify && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddPanel(section.id)}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Panel
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditSection(section)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename Section
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteSection(section.id)}
                    className="text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Section
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Panels */}
      <div className="p-4">
        {panels.length === 0 ? (
          <div className="text-center py-8 text-muted-gray">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No panels yet</p>
            {canModify && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddPanel(section.id)}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add First Panel
              </Button>
            )}
          </div>
        ) : (
          <>
            {panelViewMode === 'list' && (
              <PanelListView
                panels={panels}
                canEdit={canEdit}
                isLocked={isLocked}
                onView={onViewPanel}
                onEdit={onEditPanel}
                onDelete={onDeletePanel}
              />
            )}
            {panelViewMode === 'card' && (
              <div className="space-y-3">
                {panels.map((panel, idx) => (
                  <PanelCard
                    key={panel.id}
                    panel={panel}
                    index={idx}
                    canEdit={canEdit}
                    isLocked={isLocked}
                    onView={() => onViewPanel(panel)}
                    onEdit={() => onEditPanel(panel)}
                    onDelete={() => onDeletePanel(panel.id)}
                    onMoveUp={() => onMovePanel(panel.id, section.id, 'up')}
                    onMoveDown={() => onMovePanel(panel.id, section.id, 'down')}
                    isFirst={idx === 0}
                    isLast={idx === panels.length - 1}
                  />
                ))}
              </div>
            )}
            {panelViewMode === 'grid' && (
              <PanelGridView panels={panels} onView={onViewPanel} />
            )}
            {panelViewMode === 'filmstrip' && (
              <PanelFilmstripView panels={panels} onView={onViewPanel} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function StoryboardView({ projectId, canEdit }: StoryboardViewProps) {
  // View state - list or detail
  const [selectedStoryboardId, setSelectedStoryboardId] = useState<string | null>(null);
  // View mode for storyboard list (list/card/grid)
  const [viewMode, setViewMode] = useState<StoryboardViewMode>('card');
  // View mode for panels within storyboard detail
  type PanelViewMode = 'list' | 'card' | 'grid' | 'filmstrip';
  const [panelViewMode, setPanelViewMode] = useState<PanelViewMode>('card');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [showPanelDialog, setShowPanelDialog] = useState(false);
  const [showDeleteSectionDialog, setShowDeleteSectionDialog] = useState(false);
  const [showDeletePanelDialog, setShowDeletePanelDialog] = useState(false);

  // Form state for storyboard
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAspectRatio, setFormAspectRatio] = useState('16:9');
  // Entity connections for storyboard
  const [formEpisodeId, setFormEpisodeId] = useState('');
  const [formSceneId, setFormSceneId] = useState('');
  const [formShotListId, setFormShotListId] = useState('');
  const [formMoodboardId, setFormMoodboardId] = useState('');

  // Form state for section
  const [sectionTitle, setSectionTitle] = useState('');
  // Entity connections for section
  const [sectionSceneId, setSectionSceneId] = useState('');
  const [sectionShotListId, setSectionShotListId] = useState('');
  const [editingSection, setEditingSection] = useState<StoryboardSection | null>(null);

  // Form state for panel
  const [viewingPanel, setViewingPanel] = useState<StoryboardPanel | null>(null);
  const [editingPanel, setEditingPanel] = useState<StoryboardPanel | null>(null);
  const [panelSectionId, setPanelSectionId] = useState<string | null>(null);
  const [panelForm, setPanelForm] = useState({
    title: '',
    shot_size: '',
    camera_move: '',
    lens: '',
    framing: '',
    action: '',
    dialogue: '',
    audio: '',
    notes: '',
    duration_seconds: '',
    reference_image_url: '',
  });
  // Staged file for new panel image upload
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);

  // Delete targets
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Queries
  const {
    data: storyboards,
    isLoading: isLoadingList,
    error: listError,
    refetch: refetchList,
  } = useStoryboards(projectId);

  const {
    data: storyboard,
    isLoading: isLoadingDetail,
    error: detailError,
    refetch: refetchDetail,
  } = useStoryboard(projectId, selectedStoryboardId);

  // Entity queries for connections
  const { data: episodes } = useEpisodes(projectId);
  const { scenes } = useScenes({ projectId });
  const { shotLists } = useShotLists({ projectId });
  const { data: moodboards } = useMoodboards(projectId);

  // Project info for export summary
  const { data: project } = useProject(projectId);

  // Mutations
  const createStoryboard = useCreateStoryboard(projectId);
  const updateStoryboard = useUpdateStoryboard(projectId);
  const deleteStoryboardMutation = useDeleteStoryboard(projectId);
  const createSection = useCreateSection(projectId, selectedStoryboardId);
  const updateSection = useUpdateSection(projectId, selectedStoryboardId);
  const deleteSection = useDeleteSection(projectId, selectedStoryboardId);
  const createPanel = useCreatePanel(projectId, selectedStoryboardId);
  const updatePanel = useUpdatePanel(projectId, selectedStoryboardId);
  const deletePanel = useDeletePanel(projectId, selectedStoryboardId);
  const reorderSections = useReorderSections(projectId, selectedStoryboardId);
  const reorderPanels = useReorderPanels(projectId, selectedStoryboardId);
  const panelImageUpload = usePanelImageUpload(projectId, selectedStoryboardId);

  // Handle file selection for new panel (staging mode)
  const handlePendingImageFile = useCallback((file: File | null) => {
    // Revoke old preview URL to prevent memory leak
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImageFile(file);
    setPendingImagePreview(file ? URL.createObjectURL(file) : null);
  }, [pendingImagePreview]);

  // Computed values
  const isLocked = storyboard?.status === 'LOCKED';
  const canModify = canEdit && !isLocked;
  const totalDuration = useMemo(() => {
    if (!storyboard?.sections) return 0;
    return calculateTotalDuration(storyboard.sections);
  }, [storyboard?.sections]);

  // Handlers
  const handleCreateStoryboard = useCallback(async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const result = await createStoryboard.mutateAsync({
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        aspect_ratio: formAspectRatio,
        episode_id: formEpisodeId || undefined,
        scene_id: formSceneId || undefined,
        shot_list_id: formShotListId || undefined,
        moodboard_id: formMoodboardId || undefined,
      });
      setFormTitle('');
      setFormDescription('');
      setFormAspectRatio('16:9');
      setFormEpisodeId('');
      setFormSceneId('');
      setFormShotListId('');
      setFormMoodboardId('');
      setShowCreateDialog(false);
      setSelectedStoryboardId(result.id);
      toast.success('Storyboard created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create storyboard');
    }
  }, [createStoryboard, formTitle, formDescription, formAspectRatio, formEpisodeId, formSceneId, formShotListId, formMoodboardId]);

  const handleUpdateStoryboard = useCallback(async () => {
    if (!selectedStoryboardId || !formTitle.trim()) return;
    try {
      await updateStoryboard.mutateAsync({
        storyboardId: selectedStoryboardId,
        data: {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          aspect_ratio: formAspectRatio,
        },
      });
      setShowEditDialog(false);
      toast.success('Storyboard updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update storyboard');
    }
  }, [updateStoryboard, selectedStoryboardId, formTitle, formDescription, formAspectRatio]);

  const handleDeleteStoryboard = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await deleteStoryboardMutation.mutateAsync(deleteTargetId);
      setShowDeleteDialog(false);
      setDeleteTargetId(null);
      setSelectedStoryboardId(null);
      toast.success('Storyboard deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete storyboard');
    }
  }, [deleteStoryboardMutation, deleteTargetId]);

  const handleToggleLock = useCallback(async () => {
    if (!selectedStoryboardId) return;
    try {
      await updateStoryboard.mutateAsync({
        storyboardId: selectedStoryboardId,
        data: { status: isLocked ? 'DRAFT' : 'LOCKED' },
      });
      toast.success(isLocked ? 'Storyboard unlocked' : 'Storyboard locked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  }, [updateStoryboard, selectedStoryboardId, isLocked]);

  const handleCreateSection = useCallback(async () => {
    if (!sectionTitle.trim()) {
      toast.error('Section title is required');
      return;
    }
    try {
      await createSection.mutateAsync({
        title: sectionTitle.trim(),
        scene_id: sectionSceneId || undefined,
        shot_list_id: sectionShotListId || undefined,
      });
      setSectionTitle('');
      setSectionSceneId('');
      setSectionShotListId('');
      setShowSectionDialog(false);
      toast.success('Section added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add section');
    }
  }, [createSection, sectionTitle, sectionSceneId, sectionShotListId]);

  const handleUpdateSection = useCallback(async () => {
    if (!editingSection || !sectionTitle.trim()) return;
    try {
      await updateSection.mutateAsync({
        sectionId: editingSection.id,
        data: {
          title: sectionTitle.trim(),
          scene_id: sectionSceneId || undefined,
          shot_list_id: sectionShotListId || undefined,
        },
      });
      setEditingSection(null);
      setSectionTitle('');
      setSectionSceneId('');
      setSectionShotListId('');
      setShowSectionDialog(false);
      toast.success('Section updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update section');
    }
  }, [updateSection, editingSection, sectionTitle, sectionSceneId, sectionShotListId]);

  const handleDeleteSection = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await deleteSection.mutateAsync(deleteTargetId);
      setShowDeleteSectionDialog(false);
      setDeleteTargetId(null);
      toast.success('Section deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete section');
    }
  }, [deleteSection, deleteTargetId]);

  const handleSavePanel = useCallback(async () => {
    if (!panelSectionId && !editingPanel) {
      toast.error('Section is required');
      return;
    }
    try {
      const data = {
        section_id: editingPanel?.section_id || panelSectionId!,
        title: panelForm.title.trim() || undefined,
        shot_size: panelForm.shot_size || undefined,
        camera_move: panelForm.camera_move || undefined,
        lens: panelForm.lens.trim() || undefined,
        framing: panelForm.framing.trim() || undefined,
        action: panelForm.action.trim() || undefined,
        dialogue: panelForm.dialogue.trim() || undefined,
        audio: panelForm.audio.trim() || undefined,
        notes: panelForm.notes.trim() || undefined,
        duration_seconds: panelForm.duration_seconds
          ? parseInt(panelForm.duration_seconds, 10)
          : undefined,
        reference_image_url: panelForm.reference_image_url.trim() || undefined,
      };

      if (editingPanel) {
        await updatePanel.mutateAsync({
          panelId: editingPanel.id,
          data,
        });
        toast.success('Panel updated');
      } else {
        // Create the panel first
        const newPanel = await createPanel.mutateAsync(data);

        // If there's a pending image, upload it now that we have the panel ID
        if (pendingImageFile && newPanel?.id) {
          try {
            await panelImageUpload.mutateAsync({
              panelId: newPanel.id,
              file: pendingImageFile,
            });
            toast.success('Panel added with image');
          } catch (imgErr: any) {
            toast.success('Panel added');
            toast.error('Image upload failed: ' + (imgErr.message || 'Unknown error'));
          }
        } else {
          toast.success('Panel added');
        }
      }

      // Clean up
      setEditingPanel(null);
      setPanelSectionId(null);
      setPanelForm({
        title: '',
        shot_size: '',
        camera_move: '',
        lens: '',
        framing: '',
        action: '',
        dialogue: '',
        audio: '',
        notes: '',
        duration_seconds: '',
        reference_image_url: '',
      });
      // Clean up pending image
      if (pendingImagePreview) {
        URL.revokeObjectURL(pendingImagePreview);
      }
      setPendingImageFile(null);
      setPendingImagePreview(null);
      setShowPanelDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save panel');
    }
  }, [createPanel, updatePanel, editingPanel, panelSectionId, panelForm, pendingImageFile, pendingImagePreview, panelImageUpload]);

  const handleDeletePanel = useCallback(async () => {
    if (!deleteTargetId) return;
    try {
      await deletePanel.mutateAsync(deleteTargetId);
      setShowDeletePanelDialog(false);
      setDeleteTargetId(null);
      toast.success('Panel deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete panel');
    }
  }, [deletePanel, deleteTargetId]);

  const handleMoveSection = useCallback(
    async (sectionId: string, direction: 'up' | 'down') => {
      if (!storyboard?.sections) return;
      const sections = [...storyboard.sections].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx < 0) return;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= sections.length) return;

      try {
        await reorderSections.mutateAsync({
          sectionId,
          newSortOrder: sections[newIdx].sort_order,
        });
      } catch (err: any) {
        toast.error(err.message || 'Failed to reorder section');
      }
    },
    [reorderSections, storyboard?.sections]
  );

  const handleMovePanel = useCallback(
    async (panelId: string, sectionId: string, direction: 'up' | 'down') => {
      if (!storyboard?.sections) return;
      const section = storyboard.sections.find((s) => s.id === sectionId);
      if (!section?.panels) return;

      const panels = [...section.panels].sort((a, b) => a.sort_order - b.sort_order);
      const idx = panels.findIndex((p) => p.id === panelId);
      if (idx < 0) return;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= panels.length) return;

      try {
        await reorderPanels.mutateAsync({
          panelId,
          targetSectionId: sectionId,
          newSortOrder: panels[newIdx].sort_order,
        });
      } catch (err: any) {
        toast.error(err.message || 'Failed to reorder panel');
      }
    },
    [reorderPanels, storyboard?.sections]
  );

  const handleExport = useCallback(() => {
    if (!selectedStoryboardId) return;
    const url = getStoryboardExportUrl(projectId, selectedStoryboardId);
    const token = localStorage.getItem('access_token');
    if (token) {
      fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.blob())
        .then((blob) => {
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `storyboard_${storyboard?.title || 'export'}.csv`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
        })
        .catch(() => toast.error('Failed to export CSV'));
    }
  }, [projectId, selectedStoryboardId, storyboard?.title]);

  // Export executive summary of all storyboards
  const handleExportSummary = useCallback(async () => {
    if (!storyboards || storyboards.length === 0) {
      toast.error('No storyboards to export');
      return;
    }

    try {
      await generateStoryboardSummaryPdf({
        projectName: project?.title || 'Project',
        storyboards,
      });
      toast.success('Executive summary exported');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to export summary');
    }
  }, [storyboards, project?.title]);

  const openEditStoryboardDialog = useCallback(() => {
    if (storyboard) {
      setFormTitle(storyboard.title);
      setFormDescription(storyboard.description || '');
      setFormAspectRatio(storyboard.aspect_ratio);
      setShowEditDialog(true);
    }
  }, [storyboard]);

  const openAddPanel = useCallback((sectionId: string) => {
    setPanelSectionId(sectionId);
    setEditingPanel(null);
    setPanelForm({
      title: '',
      shot_size: '',
      camera_move: '',
      lens: '',
      framing: '',
      action: '',
      dialogue: '',
      audio: '',
      notes: '',
      duration_seconds: '',
      reference_image_url: '',
    });
    // Clear any pending image from previous dialog
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setShowPanelDialog(true);
  }, [pendingImagePreview]);

  const openViewPanel = useCallback((panel: StoryboardPanel) => {
    setViewingPanel(panel);
  }, []);

  const openEditPanel = useCallback((panel: StoryboardPanel) => {
    setViewingPanel(null); // Close view dialog if open
    setEditingPanel(panel);
    setPanelSectionId(null);
    setPanelForm({
      title: panel.title || '',
      shot_size: panel.shot_size || '',
      camera_move: panel.camera_move || '',
      lens: panel.lens || '',
      framing: panel.framing || '',
      action: panel.action || '',
      dialogue: panel.dialogue || '',
      audio: panel.audio || '',
      notes: panel.notes || '',
      duration_seconds: panel.duration_seconds?.toString() || '',
      reference_image_url: panel.reference_image_url || '',
    });
    // Clear any pending image (not used in edit mode)
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
    }
    setPendingImageFile(null);
    setPendingImagePreview(null);
    setShowPanelDialog(true);
  }, [pendingImagePreview]);

  const openEditSection = useCallback((section: StoryboardSection) => {
    setEditingSection(section);
    setSectionTitle(section.title);
    setSectionSceneId(section.scene_id || '');
    setSectionShotListId(section.shot_list_id || '');
    setShowSectionDialog(true);
  }, []);

  // Render List View
  if (!selectedStoryboardId) {
    if (isLoadingList) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      );
    }

    if (listError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">Failed to load storyboards</h3>
          <p className="text-muted-gray text-center mb-4">
            {(listError as Error).message || 'An error occurred'}
          </p>
          <Button onClick={() => refetchList()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-heading text-bone-white">Storyboards</h2>
            <p className="text-sm text-muted-gray">
              Plan your shots visually with storyboard frames
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as StoryboardViewMode)}>
              <TabsList className="bg-white/5">
                <TabsTrigger value="list" className="gap-1 px-2">
                  <List className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="card" className="gap-1 px-2">
                  <LayoutGrid className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="grid" className="gap-1 px-2">
                  <Grid3X3 className="w-4 h-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {/* Export Summary Button - only show when there are storyboards */}
            {storyboards && storyboards.length > 0 && (
              <Button variant="outline" onClick={handleExportSummary} className="gap-2">
                <FileText className="w-4 h-4" />
                Export Summary
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                New Storyboard
              </Button>
            )}
          </div>
        </div>

        {/* Storyboard Grid */}
        {(!storyboards || storyboards.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 border border-white/10 rounded-lg">
            <Images className="w-12 h-12 text-muted-gray mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No storyboards yet</h3>
            <p className="text-muted-gray text-center mb-4">
              Create your first storyboard to start planning shots visually.
            </p>
            {canEdit && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Storyboard
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* List View */}
            {viewMode === 'list' && (
              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr className="text-left text-sm text-muted-gray">
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Aspect</th>
                      <th className="px-4 py-3">Sections</th>
                      <th className="px-4 py-3">Panels</th>
                      <th className="px-4 py-3">Linked To</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {storyboards.map((sb) => (
                      <tr
                        key={sb.id}
                        className="hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => setSelectedStoryboardId(sb.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-bone-white">{sb.title}</div>
                          {sb.description && (
                            <div className="text-xs text-muted-gray line-clamp-1">{sb.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-gray">{sb.aspect_ratio}</td>
                        <td className="px-4 py-3 text-sm text-muted-gray">{sb.section_count || 0}</td>
                        <td className="px-4 py-3 text-sm text-muted-gray">{sb.panel_count || 0}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {sb.episode && (
                              <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                                {sb.episode.episode_code}
                              </Badge>
                            )}
                            {sb.scene && (
                              <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                                Scene {sb.scene.scene_number}
                              </Badge>
                            )}
                            {sb.shot_list && (
                              <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                                {sb.shot_list.title}
                              </Badge>
                            )}
                            {!sb.episode && !sb.scene && !sb.shot_list && (
                              <span className="text-xs text-muted-gray">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {sb.status === 'LOCKED' ? (
                            <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                              <Lock className="w-3 h-3 mr-1" />
                              Locked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-white/20 text-muted-gray">
                              Draft
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Card View */}
            {viewMode === 'card' && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {storyboards.map((sb) => (
                  <Card
                    key={sb.id}
                    className="bg-white/5 border-white/10 hover:border-white/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedStoryboardId(sb.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{sb.title}</CardTitle>
                        {sb.status === 'LOCKED' && (
                          <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                      </div>
                      {sb.description && (
                        <CardDescription className="line-clamp-2">{sb.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-gray">
                        <span className="flex items-center gap-1">
                          <Film className="w-4 h-4" />
                          {sb.aspect_ratio}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {sb.section_count || 0} sections
                        </span>
                        <span className="flex items-center gap-1">
                          <ImageIcon className="w-4 h-4" />
                          {sb.panel_count || 0} panels
                        </span>
                      </div>
                      {/* Entity connection badges */}
                      {(sb.episode || sb.scene || sb.shot_list) && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {sb.episode && (
                            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                              <Link2 className="w-3 h-3 mr-1" />
                              {sb.episode.episode_code}
                            </Badge>
                          )}
                          {sb.scene && (
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-400">
                              <Link2 className="w-3 h-3 mr-1" />
                              Scene {sb.scene.scene_number}
                            </Badge>
                          )}
                          {sb.shot_list && (
                            <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                              <Link2 className="w-3 h-3 mr-1" />
                              {sb.shot_list.title}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Grid/Thumbnail View */}
            {viewMode === 'grid' && (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
                {storyboards.map((sb) => (
                  <div
                    key={sb.id}
                    className="bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-white/20 cursor-pointer transition-colors group"
                    onClick={() => setSelectedStoryboardId(sb.id)}
                  >
                    {/* Thumbnail placeholder */}
                    <div className="aspect-video bg-white/10 flex items-center justify-center">
                      <Images className="w-8 h-8 text-muted-gray group-hover:text-bone-white transition-colors" />
                    </div>
                    <div className="p-2">
                      <h4 className="text-sm font-medium text-bone-white truncate">{sb.title}</h4>
                      <p className="text-xs text-muted-gray">
                        {sb.panel_count || 0} panels
                        {sb.status === 'LOCKED' && (
                          <Lock className="w-3 h-3 ml-1 inline text-yellow-400" />
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Storyboard</DialogTitle>
              <DialogDescription>
                Create a new storyboard to plan your shots visually.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Opening Sequence"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="h-20"
                />
              </div>
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={formAspectRatio} onValueChange={setFormAspectRatio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ar) => (
                      <SelectItem key={ar.value} value={ar.value}>
                        {ar.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Entity Connections */}
              <div className="pt-2 border-t border-white/10">
                <p className="text-sm text-muted-gray mb-3 flex items-center gap-1">
                  <Link2 className="w-4 h-4" />
                  Link to (Optional)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Episode</Label>
                    <Select value={formEpisodeId || '__none__'} onValueChange={(v) => setFormEpisodeId(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {(episodes || []).map((ep: any) => (
                          <SelectItem key={ep.id} value={ep.id}>
                            {ep.episode_code} - {ep.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Scene</Label>
                    <Select value={formSceneId || '__none__'} onValueChange={(v) => setFormSceneId(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {(scenes || []).map((scene: any) => (
                          <SelectItem key={scene.id} value={scene.id}>
                            {scene.scene_number} - {scene.set_name || 'Scene'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Shot List</Label>
                    <Select value={formShotListId || '__none__'} onValueChange={(v) => setFormShotListId(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {(shotLists || []).map((sl: any) => (
                          <SelectItem key={sl.id} value={sl.id}>
                            {sl.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mood Board</Label>
                    <Select value={formMoodboardId || '__none__'} onValueChange={(v) => setFormMoodboardId(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {(moodboards || []).map((mb: any) => (
                          <SelectItem key={mb.id} value={mb.id}>
                            {mb.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateStoryboard} disabled={createStoryboard.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Render Detail View
  if (isLoadingDetail) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (detailError || !storyboard) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">Failed to load storyboard</h3>
        <p className="text-muted-gray text-center mb-4">
          {(detailError as Error)?.message || 'An error occurred'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSelectedStoryboardId(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button onClick={() => refetchDetail()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const sortedSections = [...(storyboard.sections || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedStoryboardId(null)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-heading text-bone-white">{storyboard.title}</h2>
              {isLocked && (
                <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-gray">
              <span>{storyboard.aspect_ratio}</span>
              <span>{sortedSections.length} section(s)</span>
              <span>{storyboard.panel_count || 0} panel(s)</span>
              {totalDuration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(totalDuration)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Panel View Mode Toggle */}
          <Tabs value={panelViewMode} onValueChange={(v) => setPanelViewMode(v as PanelViewMode)}>
            <TabsList className="h-8 bg-white/5">
              <TabsTrigger value="list" className="px-2 h-7" title="List View">
                <List className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="card" className="px-2 h-7" title="Card View">
                <LayoutGrid className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="grid" className="px-2 h-7" title="Grid View">
                <Grid3X3 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="filmstrip" className="px-2 h-7" title="Filmstrip View">
                <Film className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {canEdit && (
            <Button
              variant="outline"
              onClick={handleToggleLock}
              disabled={updateStoryboard.isPending}
              className="gap-2"
            >
              {isLocked ? (
                <>
                  <Unlock className="w-4 h-4" />
                  Unlock
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Lock
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/backlot/${projectId}/storyboards/${selectedStoryboardId}/print`, '_blank')}
            className="gap-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <>
                  <DropdownMenuItem onClick={openEditStoryboardDialog}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setDeleteTargetId(storyboard.id);
                      setShowDeleteDialog(true);
                    }}
                    className="text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Storyboard
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description */}
      {storyboard.description && (
        <p className="text-muted-gray">{storyboard.description}</p>
      )}

      {/* Add Section Button */}
      {canModify && (
        <Button
          variant="outline"
          onClick={() => {
            setEditingSection(null);
            setSectionTitle('');
            setSectionSceneId('');
            setSectionShotListId('');
            setShowSectionDialog(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </Button>
      )}

      {/* Sections */}
      {sortedSections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-white/10 rounded-lg">
          <Images className="w-12 h-12 text-muted-gray mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No sections yet</h3>
          <p className="text-muted-gray text-center mb-4">
            Add sections to organize your storyboard panels.
          </p>
          {canModify && (
            <Button
              onClick={() => {
                setEditingSection(null);
                setSectionTitle('');
                setSectionSceneId('');
                setSectionShotListId('');
                setShowSectionDialog(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add First Section
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedSections.map((section, idx) => (
            <SectionBlock
              key={section.id}
              section={section}
              sectionIndex={idx}
              totalSections={sortedSections.length}
              canEdit={canEdit}
              isLocked={isLocked}
              panelViewMode={panelViewMode}
              onEditSection={openEditSection}
              onDeleteSection={(id) => {
                setDeleteTargetId(id);
                setShowDeleteSectionDialog(true);
              }}
              onAddPanel={openAddPanel}
              onViewPanel={openViewPanel}
              onEditPanel={openEditPanel}
              onDeletePanel={(id) => {
                setDeleteTargetId(id);
                setShowDeletePanelDialog(true);
              }}
              onMoveSection={handleMoveSection}
              onMovePanel={handleMovePanel}
            />
          ))}
        </div>
      )}

      {/* Edit Storyboard Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Storyboard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g., Opening Sequence"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description..."
                className="h-20"
              />
            </div>
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={formAspectRatio} onValueChange={setFormAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((ar) => (
                    <SelectItem key={ar.value} value={ar.value}>
                      {ar.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStoryboard} disabled={updateStoryboard.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Storyboard Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Storyboard?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this storyboard and all its sections and panels.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStoryboard}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Section Dialog */}
      <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSection ? 'Edit Section' : 'Add Section'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder="e.g., Act 1, Scene 5"
              />
            </div>

            {/* Entity Connections */}
            <div className="pt-2 border-t border-white/10">
              <p className="text-sm text-muted-gray mb-3 flex items-center gap-1">
                <Link2 className="w-4 h-4" />
                Link to (Optional)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Scene</Label>
                  <Select value={sectionSceneId || '__none__'} onValueChange={(v) => setSectionSceneId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {(scenes || []).map((scene: any) => (
                        <SelectItem key={scene.id} value={scene.id}>
                          {scene.scene_number} - {scene.set_name || 'Scene'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Shot List</Label>
                  <Select value={sectionShotListId || '__none__'} onValueChange={(v) => setSectionShotListId(v === '__none__' ? '' : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {(shotLists || []).map((sl: any) => (
                        <SelectItem key={sl.id} value={sl.id}>
                          {sl.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSectionDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingSection ? handleUpdateSection : handleCreateSection}
              disabled={createSection.isPending || updateSection.isPending}
            >
              {editingSection ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Dialog */}
      <AlertDialog open={showDeleteSectionDialog} onOpenChange={setShowDeleteSectionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete this section and all its panels. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Panel Dialog */}
      <Dialog open={showPanelDialog} onOpenChange={setShowPanelDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPanel ? 'Edit Panel' : 'Add Panel'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={panelForm.title}
                  onChange={(e) => setPanelForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Establishing Shot"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={panelForm.duration_seconds}
                  onChange={(e) =>
                    setPanelForm((p) => ({ ...p, duration_seconds: e.target.value }))
                  }
                  placeholder="e.g., 5"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Shot Size</Label>
                <Select
                  value={panelForm.shot_size}
                  onValueChange={(v) => setPanelForm((p) => ({ ...p, shot_size: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOT_SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value} - {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Camera Move</Label>
                <Select
                  value={panelForm.camera_move}
                  onValueChange={(v) => setPanelForm((p) => ({ ...p, camera_move: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMERA_MOVES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lens</Label>
                <Input
                  value={panelForm.lens}
                  onChange={(e) => setPanelForm((p) => ({ ...p, lens: e.target.value }))}
                  placeholder="e.g., 50mm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Framing</Label>
              <Input
                value={panelForm.framing}
                onChange={(e) => setPanelForm((p) => ({ ...p, framing: e.target.value }))}
                placeholder="e.g., Subject left third, horizon at top third"
              />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Textarea
                value={panelForm.action}
                onChange={(e) => setPanelForm((p) => ({ ...p, action: e.target.value }))}
                placeholder="Describe the action in this shot..."
                className="h-20"
              />
            </div>
            <div className="space-y-2">
              <Label>Dialogue</Label>
              <Textarea
                value={panelForm.dialogue}
                onChange={(e) => setPanelForm((p) => ({ ...p, dialogue: e.target.value }))}
                placeholder="Any dialogue during this shot..."
                className="h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Audio / Sound</Label>
                <Textarea
                  value={panelForm.audio}
                  onChange={(e) => setPanelForm((p) => ({ ...p, audio: e.target.value }))}
                  placeholder="Sound effects, music cues..."
                  className="h-16"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={panelForm.notes}
                  onChange={(e) => setPanelForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  className="h-16"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference Image</Label>
              {editingPanel ? (
                <PanelImageUploader
                  projectId={projectId}
                  storyboardId={selectedStoryboardId!}
                  panelId={editingPanel.id}
                  currentImageUrl={panelForm.reference_image_url || null}
                  onImageUploaded={(url) =>
                    setPanelForm((p) => ({ ...p, reference_image_url: url }))
                  }
                  onImageRemoved={() =>
                    setPanelForm((p) => ({ ...p, reference_image_url: '' }))
                  }
                  className="h-32"
                />
              ) : (
                <PanelImageUploader
                  projectId={projectId}
                  storyboardId={selectedStoryboardId!}
                  onFileSelected={handlePendingImageFile}
                  stagedPreviewUrl={pendingImagePreview}
                  className="h-32"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPanelDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePanel}
              disabled={createPanel.isPending || updatePanel.isPending}
            >
              {editingPanel ? 'Save' : 'Add Panel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Panel Dialog (Read-only) */}
      <Dialog open={!!viewingPanel} onOpenChange={(open) => !open && setViewingPanel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingPanel?.title || 'Panel Details'}</DialogTitle>
          </DialogHeader>
          {viewingPanel && (
            <div className="space-y-4">
              {/* Image */}
              {viewingPanel.reference_image_url && (
                <div className="aspect-video bg-black/20 rounded-lg overflow-hidden">
                  <img
                    src={viewingPanel.reference_image_url}
                    alt="Panel reference"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Shot Info */}
              <div className="flex flex-wrap gap-2">
                {viewingPanel.shot_size && (
                  <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                    {SHOT_SIZES.find((s) => s.value === viewingPanel.shot_size)?.label || viewingPanel.shot_size}
                  </Badge>
                )}
                {viewingPanel.camera_move && (
                  <Badge variant="outline" className="border-green-500/50 text-green-400">
                    {CAMERA_MOVES.find((m) => m.value === viewingPanel.camera_move)?.label || viewingPanel.camera_move}
                  </Badge>
                )}
                {viewingPanel.lens && (
                  <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                    {viewingPanel.lens}
                  </Badge>
                )}
                {viewingPanel.duration_seconds && (
                  <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                    <Clock className="w-3 h-3 mr-1" />
                    {viewingPanel.duration_seconds}s
                  </Badge>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 gap-3 text-sm">
                {viewingPanel.framing && (
                  <div>
                    <span className="text-muted-gray">Framing:</span>{' '}
                    <span className="text-bone-white">{viewingPanel.framing}</span>
                  </div>
                )}
                {viewingPanel.action && (
                  <div>
                    <span className="text-muted-gray">Action:</span>{' '}
                    <span className="text-bone-white">{viewingPanel.action}</span>
                  </div>
                )}
                {viewingPanel.dialogue && (
                  <div>
                    <span className="text-muted-gray">Dialogue:</span>{' '}
                    <span className="text-bone-white italic">"{viewingPanel.dialogue}"</span>
                  </div>
                )}
                {viewingPanel.audio && (
                  <div>
                    <span className="text-muted-gray">Audio:</span>{' '}
                    <span className="text-bone-white">{viewingPanel.audio}</span>
                  </div>
                )}
                {viewingPanel.notes && (
                  <div>
                    <span className="text-muted-gray">Notes:</span>{' '}
                    <span className="text-bone-white">{viewingPanel.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingPanel(null)}>
              Close
            </Button>
            {canEdit && !isLocked && viewingPanel && (
              <Button onClick={() => openEditPanel(viewingPanel)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Panel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Panel Dialog */}
      <AlertDialog open={showDeletePanelDialog} onOpenChange={setShowDeletePanelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Panel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this panel. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePanel}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default StoryboardView;
