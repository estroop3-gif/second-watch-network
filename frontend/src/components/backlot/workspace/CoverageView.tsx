/**
 * CoverageView - On-set coverage tracking and reporting
 * Shows coverage status by scene with quick-mark functionality for on-set use
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useCallSheets,
  useCallSheetShots,
} from '@/hooks/backlot';
import {
  BacklotSceneShot,
  BacklotCoverageStatus,
  CoverageByScene,
  SHOT_TYPE_SHORT_LABELS,
  COVERAGE_STATUS_LABELS,
  COVERAGE_STATUS_COLORS,
  SHOT_PRIORITY_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface CoverageViewProps {
  projectId: string;
  canEdit: boolean;
}

// Coverage status icons
const COVERAGE_ICONS: Record<BacklotCoverageStatus, React.ReactNode> = {
  not_shot: <Clock className="w-4 h-4" />,
  shot: <CheckCircle2 className="w-4 h-4" />,
  alt_needed: <AlertTriangle className="w-4 h-4" />,
  dropped: <XCircle className="w-4 h-4" />,
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
  const [filterStatus, setFilterStatus] = useState<BacklotCoverageStatus | 'all'>('all');
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Fetch data
  const { data: summary, isLoading: summaryLoading } = useCoverageSummary(projectId);
  const { data: coverageByScene, isLoading: scenesLoading } = useCoverageByScene(projectId);
  const { shots, updateCoverage } = useShots({ projectId });

  // Filter scenes based on status filter
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

  // Export coverage report
  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      // In a real implementation, this would call the backend export endpoint
      // For now, we'll generate a simple CSV/JSON from the client-side data
      if (format === 'csv') {
        const headers = ['Scene', 'Shot', 'Type', 'Priority', 'Status', 'Description'];
        const rows = (shots || []).map((shot) => {
          const scene = coverageByScene?.find((s) => s.scene_id === shot.scene_id);
          return [
            scene?.scene_number || '',
            shot.shot_number,
            SHOT_TYPE_SHORT_LABELS[shot.shot_type],
            shot.priority ? SHOT_PRIORITY_LABELS[shot.priority] : '',
            COVERAGE_STATUS_LABELS[shot.coverage_status],
            shot.description?.replace(/"/g, '""') || '',
          ];
        });

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
          scenes: coverageByScene,
          shots: shots?.map((shot) => ({
            scene_number:
              coverageByScene?.find((s) => s.scene_id === shot.scene_id)?.scene_number || '',
            shot_number: shot.shot_number,
            shot_type: shot.shot_type,
            priority: shot.priority,
            coverage_status: shot.coverage_status,
            description: shot.description,
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

  if (summaryLoading || scenesLoading) {
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

  if (!summary || summary.total_shots === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-heading text-bone-white">Coverage</h2>
            <p className="text-sm text-muted-gray">
              Track shot coverage on set
            </p>
          </div>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-heading text-bone-white">Coverage</h2>
          <p className="text-sm text-muted-gray">
            Track shot coverage on set and generate reports
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="border-muted-gray/30"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
            disabled={isExporting}
            className="border-muted-gray/30"
          >
            Export JSON
          </Button>
        </div>
      </div>

      {/* Summary stats */}
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

      {/* Scene list with filters */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
              <Film className="w-4 h-4" />
              Coverage by Scene
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Filter dropdown */}
              <Select
                value={filterStatus}
                onValueChange={(val) =>
                  setFilterStatus(val as BacklotCoverageStatus | 'all')
                }
              >
                <SelectTrigger className="w-[130px] h-8 bg-charcoal-black/50 border-muted-gray/20">
                  <Filter className="w-3 h-3 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="not_shot">Not Shot</SelectItem>
                  <SelectItem value="shot">Shot</SelectItem>
                  <SelectItem value="alt_needed">Alt Needed</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>

              {/* Expand/Collapse buttons */}
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="text-xs"
              >
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="text-xs"
              >
                Collapse
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredScenes.length === 0 ? (
            <p className="text-sm text-muted-gray text-center py-4">
              No scenes match the current filter
            </p>
          ) : (
            filteredScenes.map((scene) => (
              <SceneCoverageRow
                key={scene.scene_id}
                scene={scene}
                shots={shots || []}
                canEdit={canEdit}
                onShotStatusChange={handleShotStatusChange}
                isExpanded={expandedScenes.has(scene.scene_id)}
                onToggle={() => toggleScene(scene.scene_id)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CoverageView;
