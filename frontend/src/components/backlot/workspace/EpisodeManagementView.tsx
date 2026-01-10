/**
 * EpisodeManagementView - Episode management with table and kanban views
 */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tv,
  Plus,
  Search,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  MoreVertical,
  Lock,
  Pencil,
  Trash2,
  List,
  LayoutGrid,
  FileSpreadsheet,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useSeasons,
  useCreateSeason,
  useEpisodes,
  useCreateEpisode,
  useDeleteEpisode,
  useUpdateEpisode,
  useImportEpisodes,
  getEpisodeExportUrl,
  getImportTemplateUrl,
  getPipelineStageInfo,
  getEditStatusInfo,
  getDeliveryStatusInfo,
  PIPELINE_STAGES,
  Season,
  Episode,
  EpisodePipelineStage,
} from '@/hooks/backlot';

interface EpisodeManagementViewProps {
  projectId: string;
  canEdit: boolean;
  onSelectEpisode?: (episodeId: string) => void;
}

type ViewMode = 'table' | 'kanban';

// Kanban Card Component
function EpisodeKanbanCard({
  episode,
  canEdit,
  onSelect,
  onChangePipeline,
}: {
  episode: Episode;
  canEdit: boolean;
  onSelect: () => void;
  onChangePipeline: (stage: EpisodePipelineStage) => void;
}) {
  const editInfo = getEditStatusInfo(episode.edit_status);
  const deliveryInfo = getDeliveryStatusInfo(episode.delivery_status);

  return (
    <Card
      className="bg-white/5 border-white/10 hover:border-white/20 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-gray">{episode.episode_code}</span>
              {episode.is_edit_locked && <Lock className="w-3 h-3 text-yellow-500" />}
            </div>
            <h4 className="font-medium text-bone-white truncate mt-1">{episode.title}</h4>
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-xs text-muted-gray">
                  Move to...
                </DropdownMenuItem>
                {PIPELINE_STAGES.filter((s) => s.value !== episode.pipeline_stage).map((stage) => (
                  <DropdownMenuItem
                    key={stage.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangePipeline(stage.value);
                    }}
                  >
                    {stage.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant="outline" className="text-xs">
            {editInfo?.label || episode.edit_status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {deliveryInfo?.label || episode.delivery_status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function EpisodeManagementView({
  projectId,
  canEdit,
  onSelectEpisode,
}: EpisodeManagementViewProps) {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pipelineFilter, setPipelineFilter] = useState<string>('all');

  // Dialog states
  const [showCreateEpisode, setShowCreateEpisode] = useState(false);
  const [showCreateSeason, setShowCreateSeason] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleteEpisodeId, setDeleteEpisodeId] = useState<string | null>(null);

  // Form states
  const [episodeForm, setEpisodeForm] = useState({
    season_id: '',
    episode_number: 1,
    title: '',
    logline: '',
  });
  const [seasonForm, setSeasonForm] = useState({
    season_number: 1,
    title: '',
  });

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const {
    data: seasons,
    isLoading: isLoadingSeasons,
    refetch: refetchSeasons,
  } = useSeasons(projectId);

  const {
    data: episodes,
    isLoading: isLoadingEpisodes,
    error,
    refetch: refetchEpisodes,
  } = useEpisodes(projectId, {
    seasonId: selectedSeasonId !== 'all' ? selectedSeasonId : undefined,
    search: searchQuery || undefined,
    pipelineStage: pipelineFilter !== 'all' ? pipelineFilter : undefined,
  });

  // Mutations
  const createSeason = useCreateSeason(projectId);
  const createEpisode = useCreateEpisode(projectId);
  const deleteEpisodeMutation = useDeleteEpisode(projectId);
  const updateEpisode = useUpdateEpisode(projectId);
  const importEpisodes = useImportEpisodes(projectId);

  // Computed values
  const episodesByStage = useMemo(() => {
    if (!episodes) return {};
    const grouped: Record<EpisodePipelineStage, Episode[]> = {
      DEVELOPMENT: [],
      PRE_PRO: [],
      PRODUCTION: [],
      POST: [],
      DELIVERED: [],
      RELEASED: [],
    };
    for (const ep of episodes) {
      grouped[ep.pipeline_stage].push(ep);
    }
    return grouped;
  }, [episodes]);

  // Get next episode number
  const getNextEpisodeNumber = useCallback(() => {
    if (!episodes || episodes.length === 0) return 1;
    const filtered = selectedSeasonId !== 'all'
      ? episodes.filter((e) => e.season_id === selectedSeasonId)
      : episodes;
    if (filtered.length === 0) return 1;
    return Math.max(...filtered.map((e) => e.episode_number)) + 1;
  }, [episodes, selectedSeasonId]);

  // Handlers
  const handleCreateSeason = useCallback(async () => {
    if (seasonForm.season_number < 1) {
      toast.error('Season number must be at least 1');
      return;
    }
    try {
      const newSeason = await createSeason.mutateAsync({
        season_number: seasonForm.season_number,
        title: seasonForm.title || undefined,
      });
      setSeasonForm({ season_number: 1, title: '' });
      setShowCreateSeason(false);
      toast.success('Season created');

      // If user was creating an episode, re-open that dialog with the new season selected
      if (newSeason?.id) {
        setEpisodeForm((f) => ({ ...f, season_id: newSeason.id }));
        // Small delay to allow the season list to refresh
        setTimeout(() => {
          setShowCreateEpisode(true);
        }, 100);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create season');
    }
  }, [createSeason, seasonForm]);

  const handleCreateEpisode = useCallback(async () => {
    if (!episodeForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const result = await createEpisode.mutateAsync({
        season_id: episodeForm.season_id || undefined,
        episode_number: episodeForm.episode_number,
        title: episodeForm.title.trim(),
        logline: episodeForm.logline.trim() || undefined,
      });
      setEpisodeForm({ season_id: '', episode_number: 1, title: '', logline: '' });
      setShowCreateEpisode(false);
      toast.success('Episode created');
      if (onSelectEpisode && result?.id) {
        onSelectEpisode(result.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create episode');
    }
  }, [createEpisode, episodeForm, onSelectEpisode]);

  const handleDeleteEpisode = useCallback(async () => {
    if (!deleteEpisodeId) return;
    try {
      await deleteEpisodeMutation.mutateAsync(deleteEpisodeId);
      setDeleteEpisodeId(null);
      toast.success('Episode deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete episode');
    }
  }, [deleteEpisodeMutation, deleteEpisodeId]);

  const handleChangePipelineStage = useCallback(
    async (episodeId: string, newStage: EpisodePipelineStage) => {
      try {
        await updateEpisode.mutateAsync({
          episodeId,
          data: { pipeline_stage: newStage },
        });
        toast.success('Pipeline stage updated');
      } catch (err: any) {
        toast.error(err.message || 'Failed to update episode');
      }
    },
    [updateEpisode]
  );

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const result = await importEpisodes.mutateAsync(file);
        setShowImportDialog(false);
        toast.success(`Imported ${result.created} new, updated ${result.updated} existing`);
        if (result.errors?.length > 0) {
          console.warn('Import errors:', result.errors);
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to import');
      }
    },
    [importEpisodes]
  );

  const handleExport = useCallback(() => {
    const url = getEpisodeExportUrl(projectId, selectedSeasonId !== 'all' ? selectedSeasonId : undefined);
    const token = localStorage.getItem('access_token');
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = 'episodes_export.csv';
          a.click();
          URL.revokeObjectURL(downloadUrl);
        })
        .catch(() => toast.error('Failed to export'));
    }
  }, [projectId, selectedSeasonId]);

  const handleDownloadTemplate = useCallback(() => {
    const url = getImportTemplateUrl(projectId);
    const token = localStorage.getItem('access_token');
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.blob())
        .then((blob) => {
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = 'episode_import_template.csv';
          a.click();
          URL.revokeObjectURL(downloadUrl);
        })
        .catch(() => toast.error('Failed to download template'));
    }
  }, [projectId]);

  const openCreateEpisodeDialog = useCallback(() => {
    setEpisodeForm({
      season_id: selectedSeasonId !== 'all' ? selectedSeasonId : '',
      episode_number: getNextEpisodeNumber(),
      title: '',
      logline: '',
    });
    setShowCreateEpisode(true);
  }, [selectedSeasonId, getNextEpisodeNumber]);

  // Loading state
  if (isLoadingSeasons || isLoadingEpisodes) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">Failed to load episodes</h3>
        <p className="text-muted-gray text-center mb-4">{(error as Error).message}</p>
        <Button onClick={() => refetchEpisodes()}>
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
          <h2 className="text-2xl font-heading text-bone-white">Episodes</h2>
          <p className="text-sm text-muted-gray">
            Manage episodes, seasons, and track production progress
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setShowImportDialog(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Import
              </Button>
              <Button onClick={openCreateEpisodeDialog} className="gap-2">
                <Plus className="w-4 h-4" />
                New Episode
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* View Toggle */}
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="table" className="gap-2">
                  <List className="w-4 h-4" />
                  Table
                </TabsTrigger>
                <TabsTrigger value="kanban" className="gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Kanban
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Season Filter */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-gray">Season</Label>
              <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                <SelectTrigger className="w-40 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Seasons</SelectItem>
                  {seasons?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Season {s.season_number}
                      {s.title && ` - ${s.title}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pipeline Filter (Table view only) */}
            {viewMode === 'table' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-gray">Pipeline Stage</Label>
                <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
                  <SelectTrigger className="w-40 bg-white/5 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Search */}
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-gray">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or code..."
                  className="pl-9 bg-white/5 border-white/10"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 ml-auto">
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateSeason(true)}>
                  <Calendar className="w-4 h-4 mr-1" />
                  New Season
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {(!episodes || episodes.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-white/10 rounded-lg">
          <Tv className="w-12 h-12 text-muted-gray mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No episodes yet</h3>
          <p className="text-muted-gray text-center mb-4">
            Create your first episode or import from a CSV/XLSX file.
          </p>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button onClick={openCreateEpisodeDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Create Episode
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && episodes && episodes.length > 0 && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-muted-gray">Season</TableHead>
                <TableHead className="text-muted-gray">Ep #</TableHead>
                <TableHead className="text-muted-gray">Code</TableHead>
                <TableHead className="text-muted-gray">Title</TableHead>
                <TableHead className="text-muted-gray">Pipeline</TableHead>
                <TableHead className="text-muted-gray">Edit Status</TableHead>
                <TableHead className="text-muted-gray">Delivery</TableHead>
                <TableHead className="text-muted-gray w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {episodes.map((ep) => {
                const pipelineInfo = getPipelineStageInfo(ep.pipeline_stage);
                const editInfo = getEditStatusInfo(ep.edit_status);
                const deliveryInfo = getDeliveryStatusInfo(ep.delivery_status);

                return (
                  <TableRow
                    key={ep.id}
                    className="border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => onSelectEpisode?.(ep.id)}
                  >
                    <TableCell className="text-muted-gray">
                      {ep.season_number ? `S${ep.season_number}` : '-'}
                    </TableCell>
                    <TableCell>{ep.episode_number}</TableCell>
                    <TableCell className="font-mono text-sm">{ep.episode_code}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-bone-white">{ep.title}</span>
                        {ep.is_edit_locked && <Lock className="w-3 h-3 text-yellow-500" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs text-white', pipelineInfo?.color || 'bg-gray-500')}>
                        {pipelineInfo?.label || ep.pipeline_stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-gray">{editInfo?.label || ep.edit_status}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-gray">
                        {deliveryInfo?.label || ep.delivery_status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onSelectEpisode?.(ep.id)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteEpisodeId(ep.id);
                              }}
                              className="text-red-400"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === 'kanban' && episodes && episodes.length > 0 && (
        <div className="grid grid-cols-6 gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.value} className="min-w-[200px]">
              <div className="flex items-center gap-2 mb-3">
                <div className={cn('w-3 h-3 rounded-full', stage.color)} />
                <h3 className="font-medium text-bone-white">{stage.label}</h3>
                <span className="text-xs text-muted-gray">
                  ({episodesByStage[stage.value]?.length || 0})
                </span>
              </div>
              <div className="space-y-2">
                {episodesByStage[stage.value]?.map((ep) => (
                  <EpisodeKanbanCard
                    key={ep.id}
                    episode={ep}
                    canEdit={canEdit}
                    onSelect={() => onSelectEpisode?.(ep.id)}
                    onChangePipeline={(newStage) => handleChangePipelineStage(ep.id, newStage)}
                  />
                ))}
                {(episodesByStage[stage.value]?.length || 0) === 0 && (
                  <div className="text-center py-8 text-muted-gray text-sm border border-dashed border-white/10 rounded-lg">
                    No episodes
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Season Dialog */}
      <Dialog open={showCreateSeason} onOpenChange={setShowCreateSeason}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Season</DialogTitle>
            <DialogDescription>Add a new season to organize your episodes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Season Number *</Label>
              <Input
                type="number"
                min="1"
                value={seasonForm.season_number}
                onChange={(e) =>
                  setSeasonForm((f) => ({ ...f, season_number: parseInt(e.target.value) || 1 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                value={seasonForm.title}
                onChange={(e) => setSeasonForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g., The Beginning"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSeason(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSeason} disabled={createSeason.isPending}>
              Create Season
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Episode Dialog */}
      <Dialog open={showCreateEpisode} onOpenChange={setShowCreateEpisode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Episode</DialogTitle>
            <DialogDescription>Add a new episode to your project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Season</Label>
              <Select
                value={episodeForm.season_id || 'none'}
                onValueChange={(v) => {
                  if (v === 'new') {
                    // Open create season dialog, then come back
                    setShowCreateEpisode(false);
                    setShowCreateSeason(true);
                  } else {
                    setEpisodeForm((f) => ({ ...f, season_id: v === 'none' ? '' : v }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select season..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Season (Standalone)</SelectItem>
                  {seasons?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      Season {s.season_number}
                      {s.title && ` - ${s.title}`}
                    </SelectItem>
                  ))}
                  <SelectItem value="new" className="text-accent-yellow">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add New Season...
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Episode Number *</Label>
              <Input
                type="number"
                min="1"
                value={episodeForm.episode_number}
                onChange={(e) =>
                  setEpisodeForm((f) => ({ ...f, episode_number: parseInt(e.target.value) || 1 }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={episodeForm.title}
                onChange={(e) => setEpisodeForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Pilot"
              />
            </div>
            <div className="space-y-2">
              <Label>Logline</Label>
              <Input
                value={episodeForm.logline}
                onChange={(e) => setEpisodeForm((f) => ({ ...f, logline: e.target.value }))}
                placeholder="Brief description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateEpisode(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateEpisode} disabled={createEpisode.isPending}>
              Create Episode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Episodes</DialogTitle>
            <DialogDescription>
              Upload a CSV or XLSX file to import episodes. Existing episodes with matching codes
              will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-white/20 rounded-lg">
              <FileSpreadsheet className="w-12 h-12 text-muted-gray mb-4" />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={importEpisodes.isPending}>
                <Upload className="w-4 h-4 mr-2" />
                {importEpisodes.isPending ? 'Importing...' : 'Select File'}
              </Button>
              <p className="text-xs text-muted-gray mt-2">Supports CSV and XLSX formats</p>
            </div>
            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEpisodeId} onOpenChange={(open) => !open && setDeleteEpisodeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Episode?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this episode and all its data. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEpisode} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default EpisodeManagementView;
