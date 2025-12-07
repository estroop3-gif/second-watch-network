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
  useCoverageStats,
  useLocationNeeds,
  useGenerateTasks,
  useGenerateBudgetSuggestions,
  useScriptVersionHistory,
  useSetCurrentScriptVersion,
  useLockScriptVersion,
} from '@/hooks/backlot';
import {
  BacklotScript,
  BacklotScene,
  BacklotSceneCoverageStatus,
  BacklotIntExt,
  SCENE_COVERAGE_STATUS_LABELS,
  SCENE_COVERAGE_STATUS_COLORS,
  SCRIPT_COLOR_CODE_HEX,
  SCRIPT_COLOR_CODE_LABELS,
  BacklotScriptColorCode,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import CoverageBoard from './CoverageBoard';
import ScriptPDFViewer from './ScriptPDFViewer';
import ScenePageMapper from './ScenePageMapper';
import ScriptEditorPanel from './ScriptEditorPanel';

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
  const config = COVERAGE_CONFIG[scene.coverage_status];

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
        <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full border border-muted-gray/30"
              style={{ backgroundColor: colorHex }}
            />
            <span className="truncate max-w-[140px]">
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

// Coverage Stats Dashboard
const CoverageStatsDashboard: React.FC<{
  projectId: string;
}> = ({ projectId }) => {
  const { data: stats, isLoading } = useCoverageStats(projectId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const completionPercent = stats.total_scenes > 0
    ? Math.round((stats.shot / stats.total_scenes) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-gray">Coverage Progress</span>
            <span className="text-lg font-bold text-bone-white">{completionPercent}%</span>
          </div>
          <Progress value={completionPercent} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-gray">
            <span>{stats.shot} / {stats.total_scenes} scenes shot</span>
            <span>{stats.pages_shot?.toFixed(1) || 0} / {stats.total_pages?.toFixed(1) || 0} pages</span>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-muted-gray/20">
                <Clock className="w-4 h-4 text-muted-gray" />
              </div>
              <div>
                <div className="text-2xl font-bold text-bone-white">{stats.not_scheduled}</div>
                <div className="text-xs text-muted-gray">Not Scheduled</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-blue-500/20">
                <Calendar className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-bone-white">{stats.scheduled}</div>
                <div className="text-xs text-muted-gray">Scheduled</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-bone-white">{stats.shot}</div>
                <div className="text-xs text-muted-gray">Shot</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-orange-500/20">
                <AlertCircle className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-bone-white">{stats.needs_pickup}</div>
                <div className="text-xs text-muted-gray">Needs Pickup</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Location Breakdown */}
      {stats.scenes_by_location && stats.scenes_by_location.length > 0 && (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Scenes by Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.scenes_by_location.slice(0, 5).map((loc, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-gray truncate max-w-[200px]">
                    {loc.location_name || 'TBD'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-bone-white">{loc.scene_count} scenes</span>
                    <span className="text-muted-gray text-xs">({loc.page_count} pgs)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
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
  const [activeTab, setActiveTab] = useState<'viewer' | 'mapper' | 'scenes' | 'board' | 'coverage' | 'locations'>('scenes');
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [coverageFilter, setCoverageFilter] = useState<BacklotSceneCoverageStatus | 'all'>('all');
  const [intExtFilter, setIntExtFilter] = useState<BacklotIntExt | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { scripts, isLoading: scriptsLoading, refetch: refetchScripts } = useScripts({ projectId });
  const { scenes, isLoading: scenesLoading, createScene } = useScenes({
    projectId,
    coverage_status: coverageFilter,
    int_ext: intExtFilter,
    search: searchQuery || undefined,
  });
  const { updateCoverage } = useSceneMutations();
  const { data: locationNeeds, isLoading: locationNeedsLoading } = useLocationNeeds(projectId);
  const generateTasks = useGenerateTasks();
  const generateBudgetSuggestions = useGenerateBudgetSuggestions();

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

  const handleGenerateTasks = async () => {
    try {
      const result = await generateTasks.mutateAsync({ projectId });
      toast({
        title: 'Tasks Generated',
        description: `Created ${result.tasks_created} tasks from breakdown items`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate tasks',
        variant: 'destructive',
      });
    }
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

  const isLoading = scriptsLoading || scenesLoading;

  // Get active script (selected or first available)
  const activeScript = scripts.find((s) => s.id === selectedScriptId) || scripts[0];

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-heading text-bone-white">Script & Breakdown</h2>
            <p className="text-sm text-muted-gray">
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
        {canEdit && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
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
            <Button
              onClick={onImportClick}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Script
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-charcoal-black border border-muted-gray/20">
          {activeScript?.file_url && (
            <TabsTrigger value="viewer" className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              View Script
            </TabsTrigger>
          )}
          {activeScript?.file_url && (
            <TabsTrigger value="mapper" className="flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Page Mapping
            </TabsTrigger>
          )}
          <TabsTrigger value="editor" className="flex items-center gap-1">
            <Edit className="w-3 h-3" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="scenes">Scenes</TabsTrigger>
          <TabsTrigger value="board">Coverage Board</TabsTrigger>
          <TabsTrigger value="coverage">Coverage Stats</TabsTrigger>
          <TabsTrigger value="locations">Location Needs</TabsTrigger>
        </TabsList>

        {/* Script Viewer Tab */}
        <TabsContent value="viewer" className="mt-6">
          {activeScript?.file_url ? (
            <div className="h-[calc(100vh-280px)] min-h-[600px] bg-charcoal-black rounded-lg border border-muted-gray/20 overflow-hidden">
              <ScriptPDFViewer
                script={activeScript}
                projectId={projectId}
                canEdit={canEdit}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-gray">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No PDF script available</p>
              <p className="text-sm">Import a PDF script to view it here</p>
            </div>
          )}
        </TabsContent>

        {/* Scene Page Mapper Tab */}
        <TabsContent value="mapper" className="mt-6">
          {activeScript?.file_url ? (
            <div className="h-[calc(100vh-280px)] min-h-[600px] bg-charcoal-black rounded-lg border border-muted-gray/20 overflow-hidden">
              <ScenePageMapper
                script={activeScript}
                projectId={projectId}
                canEdit={canEdit}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-muted-gray">
              <Link2 className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No PDF script available</p>
              <p className="text-sm">Import a PDF script to map scenes to pages</p>
            </div>
          )}
        </TabsContent>

        {/* Script Editor Tab */}
        <TabsContent value="editor" className="mt-6">
          {activeScript ? (
            <div className="h-[calc(100vh-280px)] min-h-[600px] bg-charcoal-black rounded-lg border border-muted-gray/20 overflow-hidden">
              <ScriptEditorPanel
                script={activeScript}
                canEdit={canEdit}
                onVersionCreated={(newScript) => {
                  // Refresh the scripts list when a new version is created
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

        {/* Coverage Board Tab */}
        <TabsContent value="board" className="mt-6">
          {activeScript ? (
            <CoverageBoard
              projectId={projectId}
              scriptId={activeScript.id}
              canEdit={canEdit}
              onSceneClick={onSceneClick}
            />
          ) : (
            <div className="text-center py-12 text-muted-gray">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No scripts available</p>
              <p className="text-sm">Import or create a script to use the coverage board</p>
            </div>
          )}
        </TabsContent>

        {/* Coverage Dashboard Tab */}
        <TabsContent value="coverage" className="mt-6">
          <CoverageStatsDashboard projectId={projectId} />
        </TabsContent>

        {/* Location Needs Tab */}
        <TabsContent value="locations" className="mt-6">
          {locationNeedsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : !locationNeeds || !locationNeeds.needs || locationNeeds.needs.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <MapPin className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No location needs data available</p>
              <p className="text-sm">Add scenes to your script to see location requirements</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="outline" className="text-bone-white">
                  {locationNeeds.total_unique_locations} unique locations
                </Badge>
                <Badge variant="outline" className="text-green-400">
                  {locationNeeds.locations_assigned} assigned
                </Badge>
                <Badge variant="outline" className="text-orange-400">
                  {locationNeeds.locations_unassigned} need assignment
                </Badge>
              </div>

              {/* Location Cards */}
              {locationNeeds.needs.map((loc, i) => (
                <Card key={i} className="bg-charcoal-black border-muted-gray/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium text-bone-white flex items-center gap-2">
                        <MapPin className={cn(
                          'w-4 h-4',
                          loc.has_location_assigned ? 'text-green-400' : 'text-orange-400'
                        )} />
                        {loc.location_name}
                      </CardTitle>
                      <Badge variant="outline">
                        {loc.scene_count} scene{loc.scene_count !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-gray">
                      <div>
                        <span className="text-bone-white">{loc.total_pages}</span> pages
                      </div>
                      <div className="flex items-center gap-2">
                        <Sun className="w-3 h-3 text-amber-400" />
                        <span>{loc.day_night_breakdown.day} day</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Moon className="w-3 h-3 text-indigo-400" />
                        <span>{loc.day_night_breakdown.night} night</span>
                      </div>
                      <div>
                        INT: {loc.int_ext_breakdown.interior}
                      </div>
                      <div>
                        EXT: {loc.int_ext_breakdown.exterior}
                      </div>
                    </div>

                    {/* Scene list */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {loc.scenes.slice(0, 8).map((s) => (
                        <Badge
                          key={s.scene_id}
                          variant="outline"
                          className={cn(
                            'text-xs cursor-pointer hover:bg-muted-gray/10',
                            COVERAGE_CONFIG[s.coverage_status].color
                          )}
                          onClick={() => {
                            const scene = scenes.find((sc) => sc.id === s.scene_id);
                            if (scene) onSceneClick?.(scene);
                          }}
                        >
                          {s.scene_number}
                        </Badge>
                      ))}
                      {loc.scenes.length > 8 && (
                        <span className="text-xs text-muted-gray">+{loc.scenes.length - 8} more</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ScriptView;
