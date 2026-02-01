/**
 * ScriptView - Script breakdown management with scene list and coverage dashboard
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FileText,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Upload,
  ChevronRight,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Filter,
  Search,
  ListChecks,
  LayoutGrid,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Loader2,
  ExternalLink,
  Settings,
  Sparkles,
  BookOpen,
  Link2,
  Lock,
  Unlock,
  GitBranch,
  History,
  ChevronDown,
  StickyNote,
  Download,
  ClipboardCheck,
  Lightbulb,
  MousePointer2,
  Highlighter,
  Palette,
  Layers,
  Video,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useScripts,
  useScenes,
  useSceneMutations,

  useGenerateBudgetSuggestions,
  useScriptVersionHistory,
  useSetCurrentScriptVersion,
  useLockScriptVersion,
  useScriptMutations,
  useExportScriptWithHighlights,
  useScriptHighlights,
  useScriptHighlightMutations,
  useScriptPageNotes,
  useScriptPageNotesSummary,
  useScriptPageNoteMutations,
} from '@/hooks/backlot';
import {
  BacklotScript,
  BacklotScene,
  BacklotSceneCoverageStatus,
  BacklotIntExt,
  BacklotBreakdownItemType,
  BacklotHighlightStatus,
  BacklotScriptHighlightBreakdown,
  BacklotScriptPageNoteType,
  SCENE_COVERAGE_STATUS_LABELS,
  SCENE_COVERAGE_STATUS_COLORS,
  SCRIPT_COLOR_CODE_HEX,
  SCRIPT_COLOR_CODE_LABELS,
  SCRIPT_PAGE_NOTE_TYPE_LABELS,
  BacklotScriptColorCode,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import ScriptPDFViewer from './ScriptPDFViewer';
import ScenePageMapper from './ScenePageMapper';
import ScriptEditorPanel from './ScriptEditorPanel';
import ScriptBreakdownPanel from './ScriptBreakdownPanel';
import ScriptNotesPanel from './ScriptNotesPanel';
import ScriptTextViewer from './ScriptTextViewer';
import { ScriptExportModal } from './ScriptExportModal';
import { TaskGeneratePreviewModal } from './TaskGeneratePreviewModal';

interface ScriptViewProps {
  projectId: string;
  canEdit: boolean;
  onImportClick?: () => void;
  onSceneClick?: (scene: BacklotScene) => void;
}

// Coverage status config with colors and icons
const COVERAGE_CONFIG: Record<
  BacklotSceneCoverageStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  not_scheduled: {
    label: 'Not Scheduled',
    color: 'text-muted-gray',
    bgColor: 'bg-muted-gray/20',
    icon: <Clock className="w-3 h-3" />,
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <Calendar className="w-3 h-3" />,
  },
  shot: {
    label: 'Shot',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  needs_pickup: {
    label: 'Needs Pickup',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

// Time of day icons
const TIME_OF_DAY_ICONS: Record<string, React.ReactNode> = {
  day: <Sun className="w-3 h-3 text-amber-400" />,
  night: <Moon className="w-3 h-3 text-indigo-400" />,
  dawn: <Sunrise className="w-3 h-3 text-pink-400" />,
  dusk: <Sunset className="w-3 h-3 text-orange-400" />,
  golden_hour: <Sun className="w-3 h-3 text-amber-500" />,
  magic_hour: <Sunset className="w-3 h-3 text-purple-400" />,
  morning: <Sunrise className="w-3 h-3 text-yellow-400" />,
  afternoon: <Sun className="w-3 h-3 text-amber-300" />,
  evening: <Sunset className="w-3 h-3 text-red-400" />,
};

// Scene Card Component
const SceneCard: React.FC<{
  scene: BacklotScene;
  canEdit: boolean;
  onStatusChange: (id: string, status: BacklotSceneCoverageStatus) => void;
  onClick: () => void;
}> = ({ scene, canEdit, onStatusChange, onClick }) => {
  const config = COVERAGE_CONFIG[scene.coverage_status] || COVERAGE_CONFIG.not_scheduled;

  return (
    <div
      className={cn(
        'bg-charcoal-black border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors cursor-pointer',
        scene.is_omitted && 'opacity-50'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-bone-white">{scene.scene_number}</span>
          {scene.int_ext && (
            <Badge variant="outline" className="text-[10px] px-1.5">
              {scene.int_ext}
            </Badge>
          )}
          {scene.time_of_day && TIME_OF_DAY_ICONS[scene.time_of_day] && (
            <span title={scene.time_of_day}>{TIME_OF_DAY_ICONS[scene.time_of_day]}</span>
          )}
        </div>
        <Badge className={cn('text-[10px]', config.bgColor, config.color)}>
          {config.icon}
          <span className="ml-1">{config.label}</span>
        </Badge>
      </div>

      {/* Set Name */}
      {scene.set_name && (
        <h4 className="text-sm font-medium text-bone-white mt-2 line-clamp-1">{scene.set_name}</h4>
      )}

      {/* Synopsis */}
      {scene.synopsis && (
        <p className="text-xs text-muted-gray line-clamp-2 mt-1">{scene.synopsis}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-gray">
        {/* Page Count */}
        {scene.page_count && (
          <div className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            <span>{scene.page_count} pgs</span>
          </div>
        )}

        {/* Location */}
        {scene.location && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{scene.location.name}</span>
          </div>
        )}

        {/* Breakdown count */}
        {scene.breakdown_count !== undefined && scene.breakdown_count > 0 && (
          <div className="flex items-center gap-1">
            <ListChecks className="w-3 h-3" />
            <span>{scene.breakdown_count} items</span>
          </div>
        )}
      </div>

      {/* Quick Actions (on hover) */}
      {canEdit && (
        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-muted-gray/10">
          <Select
            value={scene.coverage_status}
            onValueChange={(value) => {
              onStatusChange(scene.id, value as BacklotSceneCoverageStatus);
            }}
          >
            <SelectTrigger
              className="h-7 text-xs bg-transparent border-muted-gray/20"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {Object.entries(COVERAGE_CONFIG).map(([status, config]) => (
                <SelectItem key={status} value={status}>
                  <span className={cn('flex items-center gap-1', config.color)}>
                    {config.icon}
                    {config.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

// Script Version Selector Component
const ScriptVersionSelector: React.FC<{
  scripts: BacklotScript[];
  selectedScriptId: string | null;
  onSelectScript: (scriptId: string) => void;
  canEdit: boolean;
}> = ({ scripts, selectedScriptId, onSelectScript, canEdit }) => {
  const { toast } = useToast();
  const selectedScript = scripts.find((s) => s.id === selectedScriptId) || scripts[0];
  const { data: versions = [] } = useScriptVersionHistory(selectedScript?.id || null);
  const setCurrentVersion = useSetCurrentScriptVersion();
  const lockVersion = useLockScriptVersion();

  if (!selectedScript) return null;

  const handleSetCurrent = async (scriptId: string) => {
    try {
      await setCurrentVersion.mutateAsync(scriptId);
      toast({
        title: 'Current Version Set',
        description: 'Script version updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to set current version',
        variant: 'destructive',
      });
    }
  };

  const handleToggleLock = async (scriptId: string, lock: boolean) => {
    try {
      await lockVersion.mutateAsync({ scriptId, lock });
      toast({
        title: lock ? 'Script Locked' : 'Script Unlocked',
        description: lock ? 'This version is now locked' : 'This version can be edited',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to toggle lock status',
        variant: 'destructive',
      });
    }
  };

  // Get color code safely
  const colorCode = (selectedScript as any).color_code as BacklotScriptColorCode || 'white';
  const colorHex = SCRIPT_COLOR_CODE_HEX[colorCode] || '#FFFFFF';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-0 sm:min-w-[200px] justify-between max-w-[200px] sm:max-w-none">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full border border-muted-gray/30 shrink-0"
              style={{ backgroundColor: colorHex }}
            />
            <span className="truncate max-w-[100px] sm:max-w-[140px]">
              {selectedScript.title}
              {selectedScript.version && ` (${selectedScript.version})`}
            </span>
            {(selectedScript as any).is_locked && <Lock className="w-3 h-3 text-amber-400" />}
          </div>
          <ChevronDown className="w-4 h-4 text-muted-gray" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px]">
        {/* Current script info */}
        <div className="px-2 py-1.5 text-xs text-muted-gray">
          {selectedScript.page_count ? `${selectedScript.page_count} pages` : 'No page count'}
          {(selectedScript as any).is_current && (
            <Badge className="ml-2 text-[10px] bg-green-500/20 text-green-400">Current</Badge>
          )}
        </div>
        <DropdownMenuSeparator />

        {/* Script selection */}
        {scripts.length > 1 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-bone-white">Scripts</div>
            {scripts.map((script) => (
              <DropdownMenuItem
                key={script.id}
                onClick={() => onSelectScript(script.id)}
                className={cn(script.id === selectedScript.id && 'bg-accent-yellow/10')}
              >
                <FileText className="w-4 h-4 mr-2" />
                <span className="truncate">{script.title}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Version history */}
        {versions.length > 1 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-bone-white flex items-center gap-1">
              <History className="w-3 h-3" />
              Version History
            </div>
            {versions.map((version) => {
              const vColorCode = version.color_code as BacklotScriptColorCode || 'white';
              const vColorHex = SCRIPT_COLOR_CODE_HEX[vColorCode] || '#FFFFFF';
              return (
                <DropdownMenuItem
                  key={version.id}
                  onClick={() => onSelectScript(version.id)}
                  className={cn(
                    'flex items-center justify-between',
                    version.id === selectedScript.id && 'bg-accent-yellow/10'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full border border-muted-gray/30"
                      style={{ backgroundColor: vColorHex }}
                    />
                    <span>
                      v{version.version_number}
                      {version.version && ` - ${version.version}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {version.is_current && (
                      <Badge className="text-[10px] bg-green-500/20 text-green-400">Current</Badge>
                    )}
                    {version.is_locked && <Lock className="w-3 h-3 text-amber-400" />}
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Actions */}
        {canEdit && (
          <>
            {!(selectedScript as any).is_current && (
              <DropdownMenuItem onClick={() => handleSetCurrent(selectedScript.id)}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Set as Current Version
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => handleToggleLock(selectedScript.id, !(selectedScript as any).is_locked)}
            >
              {(selectedScript as any).is_locked ? (
                <>
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock Version
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Lock Version
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <GitBranch className="w-4 h-4 mr-2" />
              Create New Revision
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Main ScriptView Component
const ScriptView: React.FC<ScriptViewProps> = ({
  projectId,
  canEdit,
  onImportClick,
  onSceneClick,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'viewer' | 'mapper' | 'editor' | 'scenes' | 'breakdown' | 'continuity' | 'notes' | 'locations'>('viewer');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [coverageFilter, setCoverageFilter] = useState<BacklotSceneCoverageStatus | 'all'>('all');
  const [intExtFilter, setIntExtFilter] = useState<BacklotIntExt | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // View tab mode: PDF or Text view (Text is default - has notes/highlights)
  const [pdfTextViewMode, setPdfTextViewMode] = useState<'pdf' | 'text'>('text');

  // Highlight and notes visibility toggles
  const [showHighlights, setShowHighlights] = useState(true);
  const [showNotes, setShowNotes] = useState(false);

  // Target highlight for navigation from breakdown tab
  const [targetHighlightId, setTargetHighlightId] = useState<string | null>(null);
  // Target note for navigation from notes panel
  const [targetNoteId, setTargetNoteId] = useState<string | null>(null);
  // Target scene for navigation from breakdown tab
  const [targetSceneId, setTargetSceneId] = useState<string | null>(null);

  const { scripts, isLoading: scriptsLoading, refetch: refetchScripts } = useScripts({ projectId });
  const { scenes, isLoading: scenesLoading, createScene } = useScenes({
    projectId,
    coverage_status: coverageFilter,
    int_ext: intExtFilter,
    search: searchQuery || undefined,
  });
  const { updateCoverage } = useSceneMutations();
  const { deleteScript } = useScriptMutations();

  const generateBudgetSuggestions = useGenerateBudgetSuggestions();
  const { exportScript, isExporting } = useExportScriptWithHighlights();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTipsPanel, setShowTipsPanel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTaskPreviewModal, setShowTaskPreviewModal] = useState(false);

  const handleCoverageChange = async (sceneId: string, status: BacklotSceneCoverageStatus) => {
    try {
      await updateCoverage.mutateAsync({ id: sceneId, coverage_status: status });
      toast({
        title: 'Coverage Updated',
        description: `Scene status changed to ${SCENE_COVERAGE_STATUS_LABELS[status]}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update scene coverage',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateTasks = () => {
    setShowTaskPreviewModal(true);
  };

  const handleGenerateBudget = async () => {
    try {
      const result = await generateBudgetSuggestions.mutateAsync({ projectId });
      toast({
        title: 'Budget Suggestions Generated',
        description: `Created ${result.suggestions_created} suggestions totaling $${result.total_suggested_amount.toLocaleString()}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate budget suggestions',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteScript = async () => {
    if (!activeScript) return;
    try {
      await deleteScript.mutateAsync(activeScript.id);
      setShowDeleteDialog(false);
      setSelectedScriptId(null);
      toast({
        title: 'Script Deleted',
        description: 'The script and all its scenes have been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete script',
        variant: 'destructive',
      });
    }
  };

  const isLoading = scriptsLoading || scenesLoading;

  // Get active script (selected or first available)
  const activeScript = scripts.find((s) => s.id === selectedScriptId) || scripts[0];

  // Fetch highlights for the active script
  const { data: scriptHighlights = [] } = useScriptHighlights(activeScript?.id || null);

  // Highlight mutations for creating/updating/deleting highlights in text view
  const { createHighlight, updateHighlight, deleteHighlight } = useScriptHighlightMutations();

  // Fetch page notes for the active script
  const { notes: pageNotes = [], refetch: refetchPageNotes } = useScriptPageNotes({ scriptId: activeScript?.id || null });
  const { data: notesSummary = [] } = useScriptPageNotesSummary(activeScript?.id || null);

  // Note mutations for creating/updating/deleting page notes
  const { createNote, updateNote, deleteNote } = useScriptPageNoteMutations();

  // Handler for creating notes from click placement in ScriptTextViewer
  const handleCreateNote = async (input: {
    page_number: number;
    position_x: number;
    position_y: number;
    note_text: string;
    note_type: BacklotScriptPageNoteType;
    scene_id: string | null;
  }) => {
    if (!activeScript?.id) return;

    try {
      await createNote.mutateAsync({
        scriptId: activeScript.id,
        ...input,
      });
      toast({
        title: 'Note Added',
        description: `Added note on page ${input.page_number}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add note',
        variant: 'destructive',
      });
    }
  };

  // Handler for updating notes
  const handleUpdateNote = async (noteId: string, updates: {
    note_text?: string;
    note_type?: BacklotScriptPageNoteType;
    scene_id?: string | null;
  }) => {
    if (!activeScript?.id) return;

    try {
      await updateNote.mutateAsync({
        scriptId: activeScript.id,
        noteId,
        ...updates,
      });
      toast({
        title: 'Note Updated',
        description: 'Your note has been updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update note',
        variant: 'destructive',
      });
    }
  };

  // Handler for deleting notes
  const handleDeleteNote = async (noteId: string) => {
    if (!activeScript?.id) return;

    try {
      await deleteNote.mutateAsync({
        scriptId: activeScript.id,
        noteId,
      });
      toast({
        title: 'Note Deleted',
        description: 'The note has been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  // Handler for clicking on a highlight - shows info or navigates to breakdown
  const handleHighlightClick = (highlight: BacklotScriptHighlightBreakdown) => {
    // If the highlight is confirmed and has a breakdown item, go to breakdown tab
    if (highlight.status === 'confirmed' && highlight.breakdown_item_id) {
      setActiveTab('breakdown');
      toast({
        title: 'Navigated to Breakdown',
        description: `Viewing "${highlight.highlighted_text}" in breakdown tab`,
      });
    } else {
      // Show a toast with highlight info
      toast({
        title: `${highlight.status === 'pending' ? 'Pending' : 'Confirmed'} Highlight`,
        description: `"${highlight.highlighted_text}" - ${highlight.category}`,
      });
    }
  };

  // Handler for navigating to a highlight from breakdown tab
  const handleViewHighlightFromBreakdown = (highlightId: string) => {
    setTargetHighlightId(highlightId);
    setActiveTab('viewer');
    // Clear the target after a short delay to allow scrolling
    setTimeout(() => setTargetHighlightId(null), 2000);
  };

  // Handler for creating highlights from text selection in ScriptTextViewer
  const handleCreateHighlight = async (
    text: string,
    startOffset: number,
    endOffset: number,
    category: BacklotBreakdownItemType,
    scene?: { sceneNumber: string; slugline: string },
    notes?: string,
    pageNumber?: number
  ) => {
    if (!activeScript?.id) return;

    try {
      await createHighlight.mutateAsync({
        scriptId: activeScript.id,
        text,
        start_offset: startOffset,
        end_offset: endOffset,
        category,
        status: 'pending',
        // Scene detection from text-based viewer
        scene_number: scene?.sceneNumber,
        scene_slugline: scene?.slugline,
        // Page number from text-based viewer
        page_number: pageNumber,
        // Optional notes
        notes,
      });
      const sceneInfo = scene ? ` in Scene ${scene.sceneNumber}` : '';
      const pageInfo = pageNumber ? ` on page ${pageNumber}` : '';
      toast({
        title: 'Highlight Created',
        description: `Added "${text}" as ${category}${sceneInfo}${pageInfo}`,
      });
    } catch (error) {
      console.error('Failed to create highlight:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create highlight';
      toast({
        title: 'Error Creating Highlight',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Handler for updating highlights
  const handleUpdateHighlight = async (
    highlightId: string,
    updates: { category?: BacklotBreakdownItemType; scene_id?: string | null; suggested_label?: string; status?: BacklotHighlightStatus }
  ) => {
    if (!activeScript?.id) return;

    try {
      await updateHighlight.mutateAsync({
        scriptId: activeScript.id,
        highlightId,
        ...updates,
      });
      toast({
        title: 'Highlight Updated',
        description: 'Changes saved successfully',
      });
    } catch (error) {
      console.error('Failed to update highlight:', error);
      toast({
        title: 'Error Updating Highlight',
        description: error instanceof Error ? error.message : 'Failed to update highlight',
        variant: 'destructive',
      });
    }
  };

  // Handler for deleting highlights
  const handleDeleteHighlight = async (highlightId: string) => {
    if (!activeScript?.id) return;

    try {
      await deleteHighlight.mutateAsync({
        scriptId: activeScript.id,
        highlightId,
      });
      toast({
        title: 'Highlight Deleted',
        description: 'Highlight has been removed',
      });
    } catch (error) {
      console.error('Failed to delete highlight:', error);
      toast({
        title: 'Error Deleting Highlight',
        description: error instanceof Error ? error.message : 'Failed to delete highlight',
        variant: 'destructive',
      });
    }
  };

  // Empty state when no scripts
  if (!isLoading && scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="w-16 h-16 text-muted-gray/40 mb-4" />
        <h3 className="text-xl font-medium text-bone-white mb-2">No Scripts Yet</h3>
        <p className="text-muted-gray mb-6 max-w-md">
          Import a script or create scenes manually to start tracking your production coverage.
        </p>
        {canEdit && (
          <div className="flex gap-3">
            <Button
              onClick={onImportClick}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Script
            </Button>
            <Button variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add Scene Manually
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 md:gap-4">
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg md:text-2xl font-heading text-bone-white truncate">Script & Breakdown</h2>
            <p className="text-xs md:text-sm text-muted-gray truncate">
              {scenes.length} scenes {scripts.length > 0 && `from ${scripts.length} script${scripts.length > 1 ? 's' : ''}`}
            </p>
          </div>
          {/* Script/Version Selector */}
          {scripts.length > 0 && (
            <ScriptVersionSelector
              scripts={scripts}
              selectedScriptId={selectedScriptId}
              onSelectScript={setSelectedScriptId}
              canEdit={canEdit}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-muted-gray/30"
          >
            <Lightbulb className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Tips</span>
          </Button>
          {canEdit && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Sparkles className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">Generate</span>
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleGenerateTasks}>
                  <ListChecks className="w-4 h-4 mr-2" />
                  Generate Tasks from Breakdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleGenerateBudget}>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Budget Suggestions
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {activeScript && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportModal(true)}
              >
                <Download className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Export Script</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={onImportClick}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Upload className="w-4 h-4 md:mr-2" />
              <span className="hidden sm:inline">Import Script</span>
              <span className="sm:hidden">Import</span>
            </Button>
            {activeScript && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-400 focus:text-red-400"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Script
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Delete Script?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              This will permanently delete "{activeScript?.title}" and all associated scenes,
              breakdown items, notes, and highlights. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-muted-gray/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteScript}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteScript.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Script'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="bg-charcoal-black border border-muted-gray/20 w-max md:w-auto">
            <TabsTrigger value="viewer" className="flex items-center gap-1 text-xs md:text-sm">
              <BookOpen className="w-3 h-3" />
              <span className="hidden sm:inline">View </span>Script
            </TabsTrigger>
            <TabsTrigger value="editor" className="flex items-center gap-1 text-xs md:text-sm">
              <Edit className="w-3 h-3" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="scenes" className="text-xs md:text-sm">Scenes</TabsTrigger>
            <TabsTrigger value="breakdown" className="text-xs md:text-sm">Breakdown</TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1 text-xs md:text-sm">
              <StickyNote className="w-3 h-3" />
              Notes
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Script Viewer Tab - forceMount keeps PDF loaded to avoid reloading on tab switch */}
        <TabsContent
          value="viewer"
          className="mt-6 data-[state=inactive]:hidden"
          forceMount
        >
          {/* PDF/Text Toggle Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-2 md:p-3 bg-charcoal-black rounded-lg border border-muted-gray/20">
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-muted-gray/30 rounded-md overflow-hidden">
                <Button
                  variant={pdfTextViewMode === 'pdf' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPdfTextViewMode('pdf')}
                  disabled={!activeScript?.file_url}
                  className={cn(
                    'h-8 rounded-none border-0',
                    pdfTextViewMode === 'pdf' ? 'bg-accent-yellow/20 text-accent-yellow' : 'text-muted-gray'
                  )}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  PDF
                </Button>
                <Button
                  variant={pdfTextViewMode === 'text' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setPdfTextViewMode('text')}
                  disabled={!activeScript?.text_content}
                  className={cn(
                    'h-8 rounded-none border-0',
                    pdfTextViewMode === 'text' ? 'bg-accent-yellow/20 text-accent-yellow' : 'text-muted-gray'
                  )}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Text
                </Button>
              </div>

              {/* Separator - only show if in text mode */}
              {pdfTextViewMode === 'text' && (
                <>
                  <div className="h-6 w-px bg-muted-gray/30 mx-2" />

                  {/* Highlight Toggle */}
                  <Button
                    variant={showHighlights ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      if (!showHighlights) {
                        setShowHighlights(true);
                        setShowNotes(false); // Turn off notes
                      } else {
                        setShowHighlights(false);
                      }
                    }}
                    className={cn(
                      'h-8',
                      showHighlights ? 'bg-yellow-500/20 text-yellow-400' : 'text-muted-gray'
                    )}
                  >
                    <Highlighter className="w-4 h-4 mr-1" />
                    Highlights
                  </Button>

                  {/* Notes Toggle */}
                  <Button
                    variant={showNotes ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      if (!showNotes) {
                        setShowNotes(true);
                        setShowHighlights(false); // Turn off highlights
                      } else {
                        setShowNotes(false);
                      }
                    }}
                    className={cn(
                      'h-8',
                      showNotes ? 'bg-blue-500/20 text-blue-400' : 'text-muted-gray'
                    )}
                  >
                    <StickyNote className="w-4 h-4 mr-1" />
                    Notes
                  </Button>
                </>
              )}
            </div>
            <div className="text-xs text-muted-gray hidden sm:block">
              {pdfTextViewMode === 'pdf' ? 'Original PDF document' : 'Formatted text view (save in Editor to update)'}
            </div>
          </div>

          {/* Content based on view mode */}
          {pdfTextViewMode === 'pdf' ? (
            // PDF View
            activeScript?.file_url ? (
              <div className="h-[calc(100vh-220px)] md:h-[calc(100vh-280px)] min-h-[400px] md:min-h-[600px] bg-charcoal-black rounded-lg border border-muted-gray/20 overflow-hidden">
                <ScriptPDFViewer script={activeScript} />
              </div>
            ) : (
              <div className="text-center py-12 text-muted-gray">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-bone-white text-lg mb-2">No PDF Available</p>
                <p className="text-sm mb-6">This script was imported before PDF storage was enabled.</p>
                <p className="text-sm mb-4">To view the PDF, you need to re-import the script file.</p>
                {canEdit && (
                  <Button
                    onClick={onImportClick}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Re-import Script
                  </Button>
                )}
              </div>
            )
          ) : (
            // Text View - shows saved content only (save in Editor to update)
            <div className="h-[calc(100vh-220px)] md:h-[calc(100vh-280px)] min-h-[400px] md:min-h-[600px] bg-charcoal-black rounded-lg border border-muted-gray/20 overflow-hidden">
              <ScriptTextViewer
                content={activeScript?.text_content ?? ''}
                title={activeScript?.title || 'Script'}
                isLive={false}
                titlePageData={activeScript?.title_page_data}
                highlights={scriptHighlights}
                showHighlights={showHighlights}
                onHighlightClick={handleHighlightClick}
                onCreateHighlight={canEdit ? handleCreateHighlight : undefined}
                pageNotes={pageNotes}
                notesSummary={notesSummary}
                showNotes={showNotes}
                canEdit={canEdit}
                // Note placement mode props
                notePlacementMode={showNotes}
                onCreateNote={canEdit ? handleCreateNote : undefined}
                onUpdateNote={canEdit ? handleUpdateNote : undefined}
                onDeleteNote={canEdit ? handleDeleteNote : undefined}
                // Sidebar props for editing highlights
                scriptId={activeScript?.id}
                dbScenes={scenes.map(s => ({
                  id: s.id,
                  scene_number: s.scene_number,
                  slugline: s.slugline,
                }))}
                onUpdateHighlight={canEdit ? handleUpdateHighlight : undefined}
                onDeleteHighlight={canEdit ? handleDeleteHighlight : undefined}
                onViewBreakdownItem={(breakdownItemId) => {
                  setActiveTab('breakdown');
                  // Could add state to highlight/scroll to specific item
                }}
                targetHighlightId={targetHighlightId}
                targetNoteId={targetNoteId}
                targetSceneId={targetSceneId}
              />
            </div>
          )}

          {/* Notes Panel - Below Script Viewer */}
          {showNotes && pageNotes.length > 0 && (
            <div className="mt-4 bg-charcoal-black rounded-lg border border-muted-gray/20 max-h-[250px] overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <StickyNote className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-bone-white">
                    Script Notes ({pageNotes.length})
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pageNotes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        'p-3 rounded border cursor-pointer transition-colors',
                        note.resolved
                          ? 'bg-green-500/10 border-green-500/20 hover:border-green-500/40'
                          : 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40'
                      )}
                      onClick={() => {
                        // Navigate to note's page and open edit sidebar
                        setTargetNoteId(note.id);
                        // Clear after a short delay to allow effect to run
                        setTimeout(() => setTargetNoteId(null), 500);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {SCRIPT_PAGE_NOTE_TYPE_LABELS[note.note_type] || note.note_type}
                          </Badge>
                          <span className="text-xs text-muted-gray">Page {note.page_number}</span>
                        </div>
                        {note.resolved && (
                          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-bone-white line-clamp-2">{note.note_text}</p>
                      {note.author && (
                        <p className="text-xs text-muted-gray mt-1">
                          — {note.author.display_name || 'Unknown'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>


        {/* Script Editor Tab */}
        <TabsContent value="editor" className="mt-6">
          {activeScript ? (
            <div className="h-[calc(100vh-220px)] md:h-[calc(100vh-280px)] min-h-[400px] md:min-h-[600px] bg-charcoal-black rounded-lg border border-muted-gray/20 overflow-hidden">
              <ScriptEditorPanel
                script={activeScript}
                canEdit={canEdit}
                onVersionCreated={(newScript) => {
                  // Switch to the new version and refresh the scripts list
                  if (newScript?.id) {
                    setSelectedScriptId(newScript.id);
                  }
                  refetchScripts();
                }}
                onScriptUpdated={() => {
                  // Refresh scripts when content is saved so View Script shows updated content
                  refetchScripts();
                }}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-gray">
              <Edit className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No script selected</p>
              <p className="text-sm">Select or import a script to edit</p>
            </div>
          )}
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="mt-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search scenes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-charcoal-black border-muted-gray/20"
              />
            </div>

            <Select
              value={coverageFilter}
              onValueChange={(v) => setCoverageFilter(v as any)}
            >
              <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray/20">
                <SelectValue placeholder="Coverage Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(COVERAGE_CONFIG).map(([status, config]) => (
                  <SelectItem key={status} value={status}>
                    <span className={cn('flex items-center gap-1', config.color)}>
                      {config.icon}
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={intExtFilter}
              onValueChange={(v) => setIntExtFilter(v as any)}
            >
              <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray/20">
                <SelectValue placeholder="INT/EXT" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="INT">INT</SelectItem>
                <SelectItem value="EXT">EXT</SelectItem>
                <SelectItem value="INT/EXT">INT/EXT</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <ListChecks className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Scene Grid/List */}
          {scenesLoading ? (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-2'
            )}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={viewMode === 'grid' ? 'h-36' : 'h-16'} />
              ))}
            </div>
          ) : scenes.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No scenes match your filters</p>
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-2'
            )}>
              {scenes.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  canEdit={canEdit}
                  onStatusChange={handleCoverageChange}
                  onClick={() => onSceneClick?.(scene)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="mt-6">
          <ScriptBreakdownPanel
            projectId={projectId}
            canEdit={canEdit}
            onSceneClick={(sceneId) => {
              // Navigate to the scene in viewer
              setTargetSceneId(sceneId);
              setActiveTab('viewer');
              // Clear the target after a short delay to allow navigation
              setTimeout(() => setTargetSceneId(null), 2000);
            }}
            onViewHighlight={handleViewHighlightFromBreakdown}
          />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          <ScriptNotesPanel
            projectId={projectId}
            canEdit={canEdit}
            onNoteClick={(note, page) => {
              // Navigate to script viewer at the note's page
              setActiveTab('viewer');
              // The ScriptPDFViewer should handle scrolling to the page
              // This could be enhanced with state to pass the target page
            }}
          />
        </TabsContent>

      </Tabs>

      {/* Export Script Modal */}
      {activeScript && (
        <ScriptExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          script={activeScript}
        />
      )}

      {/* Task Generation Preview Modal */}
      <TaskGeneratePreviewModal
        projectId={projectId}
        isOpen={showTaskPreviewModal}
        onClose={() => setShowTaskPreviewModal(false)}
        onSuccess={(count) => {
          toast({
            title: 'Tasks Created',
            description: `Created ${count} tasks from breakdown items`,
          });
        }}
      />

      {/* Tips & Tricks Panel */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="max-w-2xl bg-charcoal-black border-muted-gray/20 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-accent-yellow" />
              Script & Breakdown Tips
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Tabs Overview */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-accent-yellow flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Tab Overview
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <BookOpen className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">View Script</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Read and annotate your script PDF. Add highlights, notes, and line the script.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Edit className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Editor</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Edit script content, create new versions, and track revision history.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <Camera className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Scenes</p>
                    <p className="text-muted-gray text-xs mt-1">
                      View all scenes, filter by status, and track coverage progress.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <ListChecks className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Breakdown</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Tag elements like props, wardrobe, vehicles, and special effects per scene.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <ClipboardCheck className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Continuity</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Script supervisor workspace for tracking takes, coverage, and continuity notes.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-muted-gray/5 rounded-lg border border-muted-gray/10">
                  <StickyNote className="w-5 h-5 text-muted-gray shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Notes</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Add production notes, director's notes, and department annotations.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Script Viewer Features */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
                <Highlighter className="w-4 h-4" />
                Script Viewer Features
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <Palette className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Highlight Text</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Select text and choose a color to highlight dialogue, action, or any element.
                      Colors are saved and visible to the whole team.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <Video className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Lined Script</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Draw coverage lines on the script to track which shots cover which dialogue.
                      Standard script supervisor workflow.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <StickyNote className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Page Notes</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Add notes to specific pages for blocking, technical requirements, or reminders.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Version Control */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-purple-400 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Version Control
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                  <History className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Script Versions</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Use the dropdown to switch between script versions.
                      Each revision is color-coded (white, blue, pink, yellow, etc.).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                  <Lock className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Lock Versions</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Lock a version to prevent edits. Useful for "locked" shooting scripts.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Automation */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-green-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Automation
              </h3>
              <div className="grid gap-2 text-sm">
                <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                  <ListChecks className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Generate Tasks</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Click <span className="text-green-400">Generate → Tasks from Breakdown</span> to automatically
                      create tasks for each breakdown item (props to acquire, costumes to prep, etc.).
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                  <FileText className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Generate Budget</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Click <span className="text-green-400">Generate → Budget Suggestions</span> to create
                      estimated costs based on your breakdown items.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                  <Download className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-bone-white font-medium">Export Marked Script</p>
                    <p className="text-muted-gray text-xs mt-1">
                      Download a PDF with all your highlights, lines, and notes baked in.
                      Perfect for printing or sharing.
                    </p>
                  </div>
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
                <p>• Import your script PDF to enable the viewer, then use the Editor to make text changes</p>
                <p>• Use color-coded versions (Pink, Blue, Yellow) to track script revisions</p>
                <p>• Add breakdown items as you read through the script in the viewer</p>
                <p>• Generate tasks before prep to create your department to-do lists</p>
                <p>• Lock your shooting script version to prevent accidental edits</p>
                <p>• Use the Continuity tab during production for script supervisor notes</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScriptView;
