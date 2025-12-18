/**
 * CoverageView - On-set coverage tracking and reporting
 * Shows coverage status by scene with quick-mark functionality for on-set use
 * Includes a Kanban board view for visual scene status tracking
 */
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Download,
  Filter,
  BarChart3,
  Target,
  ChevronDown,
  ChevronRight,
  Film,
  Loader2,
  LayoutGrid,
  List,
  Kanban,
  Search,
  Calendar,
  MoreHorizontal,
  FileText,
  PieChartIcon,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useCoverageSummary,
  useCoverageByScene,
  useShots,
  useScripts,
  useScenesList,
  useSceneMutations,
  SceneListItem,
} from '@/hooks/backlot';
import {
  BacklotSceneShot,
  BacklotCoverageStatus,
  CoverageByScene,
  SHOT_TYPE_SHORT_LABELS,
  COVERAGE_STATUS_LABELS,
  SHOT_PRIORITY_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import CoverageBoard from './CoverageBoard';

interface CoverageViewProps {
  projectId: string;
  canEdit: boolean;
}

// Scene status type for filtering
type SceneStatus = 'all' | 'shot' | 'scheduled' | 'needs_pickup' | 'planning';

// Enhanced scene data combining scene list with coverage stats
interface EnhancedSceneData {
  // From SceneListItem
  id: string;
  scene_number: string;
  slugline: string | null;
  int_ext: string | null;
  day_night: string | null;
  page_length: number | null;
  is_scheduled: boolean;
  is_shot: boolean;
  needs_pickup: boolean;
  shot_count: number;
  dailies_clip_count: number;
  breakdown_item_count: number;
  // From CoverageByScene
  total_shots: number;
  shots_completed: number;
  shots_not_shot: number;
  shots_alt_needed: number;
  coverage_percentage: number;
  // Computed
  status: 'shot' | 'scheduled' | 'needs_pickup' | 'planning';
}

// Helper to compute scene status
const getSceneStatus = (scene: SceneListItem): EnhancedSceneData['status'] => {
  if (scene.is_shot) return 'shot';
  if (scene.needs_pickup) return 'needs_pickup';
  if (scene.is_scheduled) return 'scheduled';
  return 'planning';
};

// Scene status badge styles
const SCENE_STATUS_STYLES: Record<EnhancedSceneData['status'], { bg: string; text: string; label: string }> = {
  shot: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Shot' },
  scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Scheduled' },
  needs_pickup: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Needs Pickup' },
  planning: { bg: 'bg-muted-gray/20', text: 'text-muted-gray', label: 'Planning' },
};

// Coverage status badge styling
const COVERAGE_BADGE_STYLES: Record<BacklotCoverageStatus, string> = {
  not_shot: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  shot: 'bg-green-500/20 text-green-400 border-green-500/30',
  alt_needed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dropped: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Overall stats card
const StatCard: React.FC<{
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: string;
}> = ({ label, value, icon, color = 'text-bone-white' }) => (
  <Card className="bg-charcoal-black/50 border-muted-gray/20">
    <CardContent className="py-4">
      <div className="flex items-center gap-3">
        <div className="text-muted-gray">{icon}</div>
        <div>
          <div className={cn('text-2xl font-bold', color)}>{value}</div>
          <div className="text-xs text-muted-gray">{label}</div>
        </div>
      </div>
    </CardContent>
  </Card>
);

// Analytics section with pie chart and progress bars
const CoverageAnalyticsSection: React.FC<{
  sceneStats: { total: number; shot: number; scheduled: number; needsPickup: number; planning: number };
  topScenes: EnhancedSceneData[];
}> = ({ sceneStats, topScenes }) => {
  // Data for pie chart
  const pieData = [
    { name: 'Shot', value: sceneStats.shot, color: '#22c55e' },
    { name: 'Scheduled', value: sceneStats.scheduled, color: '#3b82f6' },
    { name: 'Needs Pickup', value: sceneStats.needsPickup, color: '#f97316' },
    { name: 'Planning', value: sceneStats.planning, color: '#6b7280' },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Scene Status Pie Chart */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-muted-gray" />
            Scene Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sceneStats.total === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-gray text-sm">
              No scenes to display
            </div>
          ) : (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#e5e5e5' }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => <span className="text-muted-gray">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Scenes by Coverage */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-gray" />
            Scene Coverage Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topScenes.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-gray text-sm">
              No scenes with shots
            </div>
          ) : (
            <div className="space-y-3 max-h-[200px] overflow-y-auto">
              {topScenes.map((scene) => (
                <div key={scene.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-accent-yellow">{scene.scene_number}</span>
                    <span className="text-muted-gray">
                      {scene.shots_completed}/{scene.total_shots} shots ({scene.coverage_percentage}%)
                    </span>
                  </div>
                  <Progress value={scene.coverage_percentage} className="h-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Scene coverage row with expandable shot list
const SceneCoverageRow: React.FC<{
  scene: CoverageByScene;
  shots: BacklotSceneShot[];
  canEdit: boolean;
  onShotStatusChange: (shotId: string, status: BacklotCoverageStatus) => void;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ scene, shots, canEdit, onShotStatusChange, isExpanded, onToggle }) => {
  const sceneShots = shots.filter((s) => s.scene_id === scene.scene_id);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
        {/* Scene header row */}
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center gap-4 hover:bg-muted-gray/5 transition-colors">
            <div className="text-muted-gray">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>

            {/* Scene info */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-accent-yellow">
                  {scene.scene_number}
                </span>
                <span className="text-bone-white truncate">
                  {scene.scene_heading || 'Untitled'}
                </span>
              </div>
            </div>

            {/* Shot counts */}
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{scene.shot}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-gray">
                <Clock className="w-4 h-4" />
                <span>{scene.not_shot}</span>
              </div>
              {scene.alt_needed > 0 && (
                <div className="flex items-center gap-1 text-orange-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{scene.alt_needed}</span>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="w-24">
              <Progress value={scene.coverage_percentage} className="h-2" />
              <div className="text-xs text-muted-gray mt-1 text-center">
                {scene.coverage_percentage}%
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded shot list */}
        <CollapsibleContent>
          <div className="border-t border-muted-gray/20 p-4 space-y-2 bg-charcoal-black/30">
            {sceneShots.length === 0 ? (
              <p className="text-sm text-muted-gray text-center py-2">
                No shots planned for this scene
              </p>
            ) : (
              sceneShots.map((shot) => (
                <div
                  key={shot.id}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-lg transition-colors',
                    shot.coverage_status === 'shot'
                      ? 'bg-green-500/5'
                      : 'bg-charcoal-black/50'
                  )}
                >
                  {/* Quick checkbox for marking as shot */}
                  {canEdit && (
                    <Checkbox
                      checked={shot.coverage_status === 'shot'}
                      onCheckedChange={(checked) => {
                        onShotStatusChange(
                          shot.id,
                          checked ? 'shot' : 'not_shot'
                        );
                      }}
                      className="h-5 w-5"
                    />
                  )}

                  {/* Shot info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-bone-white">
                        {shot.shot_number}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-xs border-muted-gray/30"
                      >
                        {SHOT_TYPE_SHORT_LABELS[shot.shot_type]}
                      </Badge>
                      {shot.lens && (
                        <span className="text-xs text-muted-gray">
                          {shot.lens}
                        </span>
                      )}
                      {shot.priority === 'must_have' && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-red-500/20 text-red-400 border-red-500/30"
                        >
                          Must Have
                        </Badge>
                      )}
                    </div>
                    {shot.description && (
                      <p className="text-xs text-muted-gray truncate mt-1">
                        {shot.description}
                      </p>
                    )}
                  </div>

                  {/* Status dropdown */}
                  <Select
                    value={shot.coverage_status}
                    onValueChange={(val) =>
                      onShotStatusChange(shot.id, val as BacklotCoverageStatus)
                    }
                    disabled={!canEdit}
                  >
                    <SelectTrigger
                      className={cn(
                        'w-[110px] h-8 text-xs',
                        COVERAGE_BADGE_STYLES[shot.coverage_status]
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_shot">Not Shot</SelectItem>
                      <SelectItem value="shot">Shot</SelectItem>
                      <SelectItem value="alt_needed">Alt Needed</SelectItem>
                      <SelectItem value="dropped">Dropped</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Empty state
const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Camera className="w-16 h-16 text-muted-gray/30 mb-4" />
    <h3 className="text-lg font-medium text-bone-white mb-2">No shots to track</h3>
    <p className="text-sm text-muted-gray max-w-md">
      Create shot lists in the Shot List view to start tracking coverage on set.
    </p>
  </div>
);

const CoverageView: React.FC<CoverageViewProps> = ({ projectId, canEdit }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { projectSlug } = useParams<{ projectSlug: string }>();

  const [activeTab, setActiveTab] = useState<'board' | 'list'>('board');
  const [filterStatus, setFilterStatus] = useState<BacklotCoverageStatus | 'all'>('all');
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // New state for enhanced list view
  const [sceneStatusFilter, setSceneStatusFilter] = useState<SceneStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());

  // Fetch data
  const { data: summary, isLoading: summaryLoading } = useCoverageSummary(projectId);
  const { data: coverageByScene, isLoading: scenesLoading } = useCoverageByScene(projectId);
  const { shots, updateCoverage } = useShots({ projectId });
  const { scripts } = useScripts({ projectId });

  // Fetch full scene list
  const { data: scenesList, isLoading: scenesListLoading } = useScenesList(projectId);

  // Scene mutations for bulk updates
  const { updateScene } = useSceneMutations();

  // Get the primary script (first non-archived)
  const primaryScript = useMemo(() => {
    return scripts?.find(s => s.status !== 'archived') || scripts?.[0];
  }, [scripts]);

  // Merge scene list with coverage data
  const enhancedScenes = useMemo((): EnhancedSceneData[] => {
    if (!scenesList) return [];

    const coverageMap = new Map(
      coverageByScene?.map(c => [c.scene_id, c]) || []
    );

    return scenesList.map(scene => {
      const coverage = coverageMap.get(scene.id);
      return {
        id: scene.id,
        scene_number: scene.scene_number,
        slugline: scene.slugline,
        int_ext: scene.int_ext,
        day_night: scene.day_night,
        page_length: scene.page_length,
        is_scheduled: scene.is_scheduled,
        is_shot: scene.is_shot,
        needs_pickup: scene.needs_pickup,
        shot_count: scene.shot_count,
        dailies_clip_count: scene.dailies_clip_count,
        breakdown_item_count: scene.breakdown_item_count,
        total_shots: coverage?.total_shots || 0,
        shots_completed: coverage?.shot || 0,
        shots_not_shot: coverage?.not_shot || 0,
        shots_alt_needed: coverage?.alt_needed || 0,
        coverage_percentage: coverage?.coverage_percentage || 0,
        status: getSceneStatus(scene),
      };
    });
  }, [scenesList, coverageByScene]);

  // Filter enhanced scenes based on status and search
  const filteredEnhancedScenes = useMemo(() => {
    let filtered = enhancedScenes;

    // Filter by status
    if (sceneStatusFilter !== 'all') {
      filtered = filtered.filter(scene => scene.status === sceneStatusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(scene =>
        scene.scene_number.toLowerCase().includes(query) ||
        scene.slugline?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [enhancedScenes, sceneStatusFilter, searchQuery]);

  // Compute stats for summary cards
  const sceneStats = useMemo(() => {
    return {
      total: enhancedScenes.length,
      shot: enhancedScenes.filter(s => s.status === 'shot').length,
      scheduled: enhancedScenes.filter(s => s.status === 'scheduled').length,
      needsPickup: enhancedScenes.filter(s => s.status === 'needs_pickup').length,
      planning: enhancedScenes.filter(s => s.status === 'planning').length,
    };
  }, [enhancedScenes]);

  // Top scenes with shots for analytics progress bars
  const topScenesWithShots = useMemo(() => {
    return enhancedScenes
      .filter(s => s.total_shots > 0)
      .sort((a, b) => b.total_shots - a.total_shots)
      .slice(0, 10);
  }, [enhancedScenes]);

  // Filter scenes based on status filter (for old List view shots)
  const filteredScenes = useMemo(() => {
    if (!coverageByScene) return [];
    if (filterStatus === 'all') return coverageByScene;
    return coverageByScene.filter((scene) => {
      if (filterStatus === 'not_shot') return scene.not_shot > 0;
      if (filterStatus === 'shot') return scene.shot > 0;
      if (filterStatus === 'alt_needed') return scene.alt_needed > 0;
      if (filterStatus === 'dropped') return scene.dropped > 0;
      return true;
    });
  }, [coverageByScene, filterStatus]);

  // Selection handlers
  const toggleSceneSelection = (sceneId: string) => {
    setSelectedSceneIds(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const selectAllScenes = () => {
    setSelectedSceneIds(new Set(filteredEnhancedScenes.map(s => s.id)));
  };

  const clearSelection = () => {
    setSelectedSceneIds(new Set());
  };

  // Bulk status update handler
  const handleBulkStatusUpdate = async (newStatus: { is_shot?: boolean; is_scheduled?: boolean; needs_pickup?: boolean }) => {
    const sceneIds = Array.from(selectedSceneIds);
    try {
      await Promise.all(
        sceneIds.map(id => updateScene.mutateAsync({ id, ...newStatus }))
      );
      toast({ title: `Updated ${sceneIds.length} scene(s)` });
      clearSelection();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update scenes',
        variant: 'destructive',
      });
    }
  };

  // Navigate to scene detail
  const handleSceneClick = (sceneId: string) => {
    if (projectSlug) {
      navigate(`/backlot/${projectSlug}/scenes/${sceneId}`);
    }
  };

  // Toggle scene expansion
  const toggleScene = (sceneId: string) => {
    setExpandedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  // Expand/collapse all
  const expandAll = () => {
    setExpandedScenes(new Set(filteredScenes.map((s) => s.scene_id)));
  };

  const collapseAll = () => {
    setExpandedScenes(new Set());
  };

  // Handle shot status change
  const handleShotStatusChange = async (
    shotId: string,
    status: BacklotCoverageStatus
  ) => {
    try {
      await updateCoverage.mutateAsync({ id: shotId, coverage_status: status });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update coverage status',
        variant: 'destructive',
      });
    }
  };

  // Export coverage report - enhanced with full scene data
  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      if (format === 'csv') {
        // Enhanced CSV with full scene and coverage data
        const headers = [
          'Scene #', 'Slugline', 'INT/EXT', 'Day/Night', 'Pages',
          'Status', 'Shots Planned', 'Shots Complete', 'Coverage %'
        ];
        const rows = enhancedScenes.map((scene) => [
          scene.scene_number,
          scene.slugline?.replace(/"/g, '""') || '',
          scene.int_ext || '',
          scene.day_night || '',
          scene.page_length?.toFixed(1) || '',
          SCENE_STATUS_STYLES[scene.status].label,
          scene.total_shots.toString(),
          scene.shots_completed.toString(),
          `${scene.coverage_percentage}%`,
        ]);

        const csv =
          [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join(
            '\n'
          );

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coverage-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const data = {
          exported_at: new Date().toISOString(),
          summary,
          sceneStats,
          scenes: enhancedScenes.map((scene) => ({
            scene_number: scene.scene_number,
            slugline: scene.slugline,
            int_ext: scene.int_ext,
            day_night: scene.day_night,
            page_length: scene.page_length,
            status: scene.status,
            total_shots: scene.total_shots,
            shots_completed: scene.shots_completed,
            coverage_percentage: scene.coverage_percentage,
          })),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coverage-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({ title: `Coverage report exported as ${format.toUpperCase()}` });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to export report',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Export PDF report
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const dateStr = new Date().toLocaleDateString();

      // Title
      doc.setFontSize(18);
      doc.text('Coverage Report', 14, 22);

      // Date
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${dateStr}`, 14, 30);

      // Summary stats
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Summary', 14, 42);
      doc.setFontSize(10);
      doc.text(`Total Scenes: ${sceneStats.total}`, 14, 50);
      doc.text(`Shot: ${sceneStats.shot}`, 14, 56);
      doc.text(`Scheduled: ${sceneStats.scheduled}`, 14, 62);
      doc.text(`Needs Pickup: ${sceneStats.needsPickup}`, 14, 68);
      doc.text(`Planning: ${sceneStats.planning}`, 14, 74);

      if (summary) {
        doc.text(`Total Shots Planned: ${summary.total_shots}`, 80, 50);
        doc.text(`Shots Complete: ${summary.shot}`, 80, 56);
        doc.text(`Coverage: ${summary.coverage_percentage}%`, 80, 62);
      }

      // Scene table
      const tableData = enhancedScenes.map((scene) => [
        scene.scene_number,
        scene.slugline?.substring(0, 30) || '--',
        scene.page_length?.toFixed(1) || '--',
        SCENE_STATUS_STYLES[scene.status].label,
        scene.total_shots > 0 ? `${scene.shots_completed}/${scene.total_shots}` : '--',
        scene.total_shots > 0 ? `${scene.coverage_percentage}%` : '--',
      ]);

      autoTable(doc, {
        startY: 82,
        head: [['Scene #', 'Slugline', 'Pages', 'Status', 'Shots', 'Coverage']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [51, 51, 51] },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 60 },
          2: { cellWidth: 18 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 22 },
        },
      });

      doc.save(`coverage-report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'Coverage report exported as PDF' });
    } catch (err) {
      console.error('PDF export error:', err);
      toast({
        title: 'Error',
        description: 'Failed to export PDF',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (summaryLoading || scenesLoading || scenesListLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-heading text-bone-white">Coverage</h2>
          <p className="text-sm text-muted-gray">
            Track scene and shot coverage status
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={isExporting || enhancedScenes.length === 0}
            className="border-muted-gray/30"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting || enhancedScenes.length === 0}
            className="border-muted-gray/30"
          >
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={isExporting || enhancedScenes.length === 0}
            className="border-muted-gray/30"
          >
            JSON
          </Button>
        </div>
      </div>

      {/* Summary stats - always show */}
      {summary && summary.total_shots > 0 && (
        <div className="flex-shrink-0 space-y-4 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Shots"
              value={summary.total_shots}
              icon={<Camera className="w-5 h-5" />}
            />
            <StatCard
              label="Shot"
              value={summary.shot}
              icon={<CheckCircle2 className="w-5 h-5" />}
              color="text-green-400"
            />
            <StatCard
              label="Remaining"
              value={summary.not_shot}
              icon={<Clock className="w-5 h-5" />}
              color="text-muted-gray"
            />
            <StatCard
              label="Coverage"
              value={`${summary.coverage_percentage}%`}
              icon={<Target className="w-5 h-5" />}
              color={
                summary.coverage_percentage >= 80
                  ? 'text-green-400'
                  : summary.coverage_percentage >= 50
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }
            />
          </div>

          {/* Must-have coverage alert */}
          {summary.must_have_coverage < 100 && (
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="py-3">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <span className="text-sm text-red-400 font-medium">
                      Must-Have Coverage: {summary.must_have_coverage}%
                    </span>
                    <span className="text-sm text-muted-gray ml-2">
                      Priority shots need attention
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress bar */}
          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-gray">Overall Progress</span>
                <span className="text-sm text-bone-white font-medium">
                  {summary.shot} / {summary.total_shots} shots
                </span>
              </div>
              <Progress value={summary.coverage_percentage} className="h-3" />
              <div className="flex justify-between mt-2 text-xs text-muted-gray">
                <span>
                  Est. remaining: {Math.round(summary.est_remaining_minutes)} min
                </span>
                <span>
                  Est. total: {Math.round(summary.est_total_minutes)} min
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for Board vs List view */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'board' | 'list')} className="flex-1 flex flex-col min-h-0 mt-6">
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/20 flex-shrink-0">
          <TabsTrigger value="board" className="gap-2">
            <Kanban className="w-4 h-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <List className="w-4 h-4" />
            List
          </TabsTrigger>
        </TabsList>

        {/* Board View - Kanban style */}
        <TabsContent value="board" className="mt-2">
          <CoverageBoard
            projectId={projectId}
            canEdit={canEdit}
          />
        </TabsContent>

        {/* List View - Enhanced Scene Table */}
        <TabsContent value="list" className="mt-4 flex-1 flex flex-col min-h-0 gap-4 overflow-y-auto pb-4">
          {/* Scene Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
            <Card className="bg-charcoal-black/50 border-muted-gray/20">
              <CardContent className="py-3 px-4">
                <div className="text-xl font-bold text-bone-white">{sceneStats.total}</div>
                <div className="text-xs text-muted-gray">Total Scenes</div>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="py-3 px-4">
                <div className="text-xl font-bold text-green-400">{sceneStats.shot}</div>
                <div className="text-xs text-green-400/70">Shot</div>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="py-3 px-4">
                <div className="text-xl font-bold text-blue-400">{sceneStats.scheduled}</div>
                <div className="text-xs text-blue-400/70">Scheduled</div>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10 border-orange-500/20">
              <CardContent className="py-3 px-4">
                <div className="text-xl font-bold text-orange-400">{sceneStats.needsPickup}</div>
                <div className="text-xs text-orange-400/70">Needs Pickup</div>
              </CardContent>
            </Card>
            <Card className="bg-muted-gray/10 border-muted-gray/20">
              <CardContent className="py-3 px-4">
                <div className="text-xl font-bold text-muted-gray">{sceneStats.planning}</div>
                <div className="text-xs text-muted-gray/70">Planning</div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Section */}
          <div className="flex-shrink-0">
            <CoverageAnalyticsSection
              sceneStats={sceneStats}
              topScenes={topScenesWithShots}
            />
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-4 flex-wrap flex-shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search scenes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-charcoal-black border-muted-gray/30 text-bone-white"
              />
            </div>
            <Select value={sceneStatusFilter} onValueChange={(v) => setSceneStatusFilter(v as SceneStatus)}>
              <SelectTrigger className="w-[150px] bg-charcoal-black border-muted-gray/30">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="shot">Shot</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="needs_pickup">Needs Pickup</SelectItem>
                <SelectItem value="planning">Planning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Action Bar */}
          {selectedSceneIds.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex-shrink-0">
              <span className="text-sm text-blue-400 font-medium">
                {selectedSceneIds.size} scene{selectedSceneIds.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusUpdate({ is_shot: true, is_scheduled: false, needs_pickup: false })}
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                >
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Mark Shot
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusUpdate({ is_scheduled: true, is_shot: false, needs_pickup: false })}
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                >
                  <Calendar className="w-3 h-3 mr-1" />
                  Mark Scheduled
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkStatusUpdate({ needs_pickup: true, is_shot: false })}
                  className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                >
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Needs Pickup
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={clearSelection} className="ml-auto text-muted-gray">
                Clear
              </Button>
            </div>
          )}

          {/* Enhanced Scene Table */}
          <Card className="bg-charcoal-black/50 border-muted-gray/20 flex-1 min-h-0 flex flex-col">
            <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
              {filteredEnhancedScenes.length === 0 ? (
                <div className="py-12 text-center">
                  <Film className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-gray">No scenes match the current filter</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-muted-gray/20 hover:bg-transparent">
                      {canEdit && (
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedSceneIds.size === filteredEnhancedScenes.length && filteredEnhancedScenes.length > 0}
                            onCheckedChange={(checked) => checked ? selectAllScenes() : clearSelection()}
                          />
                        </TableHead>
                      )}
                      <TableHead className="w-20">Scene</TableHead>
                      <TableHead>Slugline</TableHead>
                      <TableHead className="w-16 text-center">Pages</TableHead>
                      <TableHead className="w-16 text-center">Shots</TableHead>
                      <TableHead className="w-32 text-center">Coverage</TableHead>
                      <TableHead className="w-28 text-center">Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEnhancedScenes.map((scene) => (
                      <TableRow
                        key={scene.id}
                        className="border-muted-gray/20 cursor-pointer hover:bg-muted-gray/5"
                        onClick={() => handleSceneClick(scene.id)}
                      >
                        {canEdit && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedSceneIds.has(scene.id)}
                              onCheckedChange={() => toggleSceneSelection(scene.id)}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-accent-yellow">
                          <div className="flex items-center gap-2">
                            <Film className="w-4 h-4 text-muted-gray" />
                            {scene.scene_number}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="text-bone-white truncate">{scene.slugline || '--'}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              {scene.int_ext && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted-gray/30 text-muted-gray">
                                  {scene.int_ext}
                                </Badge>
                              )}
                              {scene.day_night && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 border-muted-gray/30 text-muted-gray">
                                  {scene.day_night}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-muted-gray">
                          {scene.page_length ? scene.page_length.toFixed(1) : '--'}
                        </TableCell>
                        <TableCell className="text-center">
                          {scene.shot_count > 0 ? (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                              {scene.shot_count}
                            </Badge>
                          ) : (
                            <span className="text-muted-gray">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {scene.total_shots > 0 ? (
                            <div className="flex items-center gap-2 justify-center">
                              <Progress value={scene.coverage_percentage} className="w-16 h-2" />
                              <span className="text-xs text-muted-gray w-10">{scene.coverage_percentage}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-gray">No shots</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              SCENE_STATUS_STYLES[scene.status].bg,
                              SCENE_STATUS_STYLES[scene.status].text,
                              'border-transparent'
                            )}
                          >
                            {SCENE_STATUS_STYLES[scene.status].label}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {canEdit && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/20">
                                <DropdownMenuItem
                                  onClick={() => updateScene.mutateAsync({ id: scene.id, is_shot: true, is_scheduled: false, needs_pickup: false })}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />
                                  Mark as Shot
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateScene.mutateAsync({ id: scene.id, is_scheduled: true, is_shot: false, needs_pickup: false })}
                                >
                                  <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                                  Mark as Scheduled
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateScene.mutateAsync({ id: scene.id, needs_pickup: true, is_shot: false })}
                                >
                                  <AlertTriangle className="w-4 h-4 mr-2 text-orange-400" />
                                  Needs Pickup
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CoverageView;
