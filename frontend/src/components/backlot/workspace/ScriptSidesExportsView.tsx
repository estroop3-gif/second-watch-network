/**
 * ScriptSidesExportsView - PDF-based Script Sides (extracted from master script)
 *
 * Displays sides packets grouped by production day with status badges.
 * Supports generating sides from master script, viewing, and regenerating.
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Plus,
  Download,
  Trash2,
  MoreVertical,
  RefreshCw,
  Calendar,
  Film,
  AlertTriangle,
  ChevronRight,
  Eye,
  Send,
  X,
  FileWarning,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useScriptSidesExports,
  useScriptSidesExport,
  useGenerateScriptSides,
  useRegenerateScriptSides,
  useUpdateScriptSidesExport,
  useDeleteScriptSidesExport,
  useCheckOutdatedSides,
  getSidesDisplayName,
  getSidesStatusColor,
  formatSceneCount,
  ScriptSidesListItem,
} from '@/hooks/backlot';
import { useProductionDays, useProductionDayScenes } from '@/hooks/backlot';
import { useScenes } from '@/hooks/backlot';
import { useContinuityExports, ContinuityExport } from '@/hooks/backlot';
import { useToast } from '@/hooks/use-toast';
import { parseLocalDate } from '@/lib/dateUtils';
import ContinuityPDFAnnotator from './continuity/ContinuityPDFAnnotator';

interface ScriptSidesExportsViewProps {
  projectId: string;
  canEdit: boolean;
}

interface GroupedSides {
  dayId: string;
  dayNumber: number;
  shootDate: string;
  dayTitle?: string;
  sides: ScriptSidesListItem[];
}

const ScriptSidesExportsView: React.FC<ScriptSidesExportsViewProps> = ({
  projectId,
  canEdit,
}) => {
  const { toast } = useToast();

  // State
  const [selectedSidesId, setSelectedSidesId] = useState<string | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [regenerateId, setRegenerateId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'sent'>('all');

  // Generate dialog state
  const [generateTitle, setGenerateTitle] = useState('');
  const [generateDayId, setGenerateDayId] = useState<string>('');
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);

  // Fetch data
  const { data: sidesExports, isLoading: loadingSides, refetch } = useScriptSidesExports(projectId);
  const { days: productionDays, isLoading: loadingDays } = useProductionDays(projectId);
  const { scenes, isLoading: loadingScenes } = useScenes({ projectId });
  const { data: continuityExports } = useContinuityExports(projectId);
  const { data: outdatedSides } = useCheckOutdatedSides(projectId);

  // Fetch scenes for the selected production day (for auto-selection)
  const { scenes: dayScenes } = useProductionDayScenes(generateDayId || null);

  // Auto-select scenes when production day changes
  useEffect(() => {
    if (dayScenes && dayScenes.length > 0) {
      // Extract scene IDs from the day's assigned scenes
      const sceneIds = dayScenes.map((ds) => ds.scene_id).filter(Boolean);
      setSelectedSceneIds(sceneIds);
    }
  }, [dayScenes, generateDayId]);

  // Selected sides detail
  const { data: selectedSidesDetail } = useScriptSidesExport(projectId, selectedSidesId);

  // Mutations
  const generateMutation = useGenerateScriptSides(projectId);
  const regenerateMutation = useRegenerateScriptSides(projectId);
  const updateMutation = useUpdateScriptSidesExport(projectId);
  const deleteMutation = useDeleteScriptSidesExport(projectId);

  // Find master script (current continuity export with type='script')
  const masterScript = continuityExports?.find(
    (e) => e.export_type === 'script' && e.is_current
  );

  // Group sides by production day
  const groupedSides: GroupedSides[] = React.useMemo(() => {
    if (!sidesExports) return [];

    const filtered = statusFilter === 'all'
      ? sidesExports
      : sidesExports.filter((s) => s.status === statusFilter);

    const groups = new Map<string, GroupedSides>();

    filtered.forEach((side) => {
      const dayId = side.production_day_id || 'unassigned';
      if (!groups.has(dayId)) {
        groups.set(dayId, {
          dayId,
          dayNumber: side.production_day?.day_number || 0,
          shootDate: side.production_day?.date || '',
          dayTitle: side.production_day?.title,
          sides: [],
        });
      }
      groups.get(dayId)!.sides.push(side);
    });

    // Sort by day number
    return Array.from(groups.values()).sort((a, b) => a.dayNumber - b.dayNumber);
  }, [sidesExports, statusFilter]);

  // Check if sides is outdated
  const isOutdated = (sidesId: string) => {
    return outdatedSides?.some((o) => o.export_id === sidesId) ?? false;
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = parseLocalDate(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Handle generate
  const handleGenerate = async () => {
    if (!generateDayId || selectedSceneIds.length === 0) {
      toast({
        title: 'Missing Information',
        description: 'Please select a production day and at least one scene.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        production_day_id: generateDayId,
        scene_ids: selectedSceneIds,
        title: generateTitle || undefined,
      });
      setShowGenerateDialog(false);
      setGenerateTitle('');
      setGenerateDayId('');
      setSelectedSceneIds([]);
      setSelectedSidesId(result.id);
      toast({
        title: 'Sides Generated',
        description: `Script sides created with ${selectedSceneIds.length} scenes.`,
      });
    } catch (error: any) {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate script sides.',
        variant: 'destructive',
      });
    }
  };

  // Handle regenerate
  const handleRegenerate = async () => {
    if (!regenerateId) return;

    try {
      await regenerateMutation.mutateAsync({ exportId: regenerateId });
      setRegenerateId(null);
      toast({
        title: 'Sides Regenerated',
        description: 'Script sides updated with latest scenes.',
      });
    } catch (error: any) {
      toast({
        title: 'Regeneration Failed',
        description: error.message || 'Failed to regenerate script sides.',
        variant: 'destructive',
      });
    }
  };

  // Handle status update
  const handleStatusUpdate = async (sidesId: string, status: 'draft' | 'published' | 'sent') => {
    try {
      await updateMutation.mutateAsync({ exportId: sidesId, status });
      toast({
        title: 'Status Updated',
        description: `Script sides marked as ${status}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update status.',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteMutation.mutateAsync(deleteConfirmId);
      if (selectedSidesId === deleteConfirmId) {
        setSelectedSidesId(null);
      }
      setDeleteConfirmId(null);
      toast({
        title: 'Deleted',
        description: 'Script sides removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete script sides.',
        variant: 'destructive',
      });
    }
  };

  // Handle download
  const handleDownload = (sides: ScriptSidesListItem) => {
    if (sides.signed_url) {
      const link = document.createElement('a');
      link.href = sides.signed_url;
      link.download = sides.file_name || 'script-sides.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Toggle scene selection
  const toggleScene = (sceneId: string) => {
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]
    );
  };

  // Select all scenes
  const selectAllScenes = () => {
    if (scenes) {
      setSelectedSceneIds(scenes.map((s) => s.id));
    }
  };

  // Clear scene selection
  const clearSceneSelection = () => {
    setSelectedSceneIds([]);
  };

  // Loading state
  if (loadingSides) {
    return (
      <div className="h-full flex flex-col gap-4 p-4">
        <Skeleton className="h-12 w-full bg-muted-gray/20" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 bg-muted-gray/20" />
          <Skeleton className="h-64 bg-muted-gray/20" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 p-4 border-b border-muted-gray/20 bg-charcoal-black/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent-yellow" />
            <h2 className="text-lg font-semibold text-bone-white">Script Sides</h2>
          </div>

          {sidesExports && sidesExports.length > 0 && (
            <Badge variant="outline" className="text-muted-gray border-muted-gray/30">
              {sidesExports.length} {sidesExports.length === 1 ? 'packet' : 'packets'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[140px] bg-rich-black border-muted-gray/30">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-muted-gray/30 shadow-lg">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Generate Button */}
          {canEdit && (
            <Button
              onClick={() => setShowGenerateDialog(true)}
              disabled={!masterScript}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Sides
            </Button>
          )}
        </div>
      </div>

      {/* No master script warning */}
      {!masterScript && (
        <div className="p-4 bg-amber-500/10 border-b border-amber-500/30">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              No master script found. Export a script as PDF from the Continuity tab first.
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel - Sides list */}
        <div className="w-80 border-r border-muted-gray/20 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {groupedSides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileWarning className="w-12 h-12 text-muted-gray/50 mb-4" />
                  <p className="text-muted-gray">No script sides yet</p>
                  {canEdit && masterScript && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => setShowGenerateDialog(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Generate First Sides
                    </Button>
                  )}
                </div>
              ) : (
                groupedSides.map((group) => (
                  <div key={group.dayId} className="space-y-2">
                    {/* Day header */}
                    <div className="flex items-center gap-2 text-sm text-muted-gray">
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">
                        {group.dayNumber > 0
                          ? `Day ${group.dayNumber}`
                          : 'Unassigned'}
                      </span>
                      {group.shootDate && (
                        <span className="text-xs">
                          - {formatDate(group.shootDate)}
                        </span>
                      )}
                    </div>

                    {/* Sides cards */}
                    {group.sides.map((side) => {
                      const outdated = isOutdated(side.id);
                      return (
                        <Card
                          key={side.id}
                          className={cn(
                            'cursor-pointer transition-colors',
                            selectedSidesId === side.id
                              ? 'border-accent-yellow bg-accent-yellow/5'
                              : 'border-muted-gray/20 hover:border-muted-gray/40',
                            outdated && 'border-amber-500/50'
                          )}
                          onClick={() => setSelectedSidesId(side.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">
                                    {getSidesDisplayName(side)}
                                  </span>
                                  {outdated && (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    variant="secondary"
                                    className={cn('text-xs', getSidesStatusColor(side.status))}
                                  >
                                    {side.status}
                                  </Badge>
                                  <span className="text-xs text-muted-gray">
                                    {formatSceneCount(side.scene_count || 0)}
                                  </span>
                                </div>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-rich-black border-muted-gray/30"
                                >
                                  <DropdownMenuItem onClick={() => setSelectedSidesId(side.id)}>
                                    <Eye className="w-4 h-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownload(side)}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                  </DropdownMenuItem>

                                  {canEdit && (
                                    <>
                                      <DropdownMenuSeparator />
                                      {side.status === 'draft' && (
                                        <DropdownMenuItem
                                          onClick={() => handleStatusUpdate(side.id, 'published')}
                                        >
                                          <Send className="w-4 h-4 mr-2" />
                                          Publish
                                        </DropdownMenuItem>
                                      )}
                                      {side.status === 'published' && (
                                        <DropdownMenuItem
                                          onClick={() => handleStatusUpdate(side.id, 'sent')}
                                        >
                                          <Send className="w-4 h-4 mr-2" />
                                          Mark as Sent
                                        </DropdownMenuItem>
                                      )}
                                      {outdated && (
                                        <DropdownMenuItem
                                          onClick={() => setRegenerateId(side.id)}
                                        >
                                          <RefreshCw className="w-4 h-4 mr-2" />
                                          Regenerate
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteConfirmId(side.id)}
                                        className="text-red-400"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel - PDF Viewer */}
        <div className="flex-1 min-w-0 flex flex-col bg-charcoal-black">
          {selectedSidesId && selectedSidesDetail?.signed_url ? (
            <ContinuityPDFAnnotator
              projectId={projectId}
              exportId={selectedSidesId}
              fileUrl={selectedSidesDetail.signed_url}
              canEdit={false} // Read-only for script sides, limited annotations
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-gray">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a sides packet to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generate Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="bg-rich-black border-muted-gray/30 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Generate Script Sides</DialogTitle>
            <DialogDescription>
              Select a production day and scenes to extract from the master script.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <div className="space-y-4 overflow-y-auto max-h-[50vh] pr-2">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="sides-title">Title (optional)</Label>
                <Input
                  id="sides-title"
                  value={generateTitle}
                  onChange={(e) => setGenerateTitle(e.target.value)}
                  placeholder="e.g., Day 1 Sides v1"
                  className="bg-charcoal-black border-muted-gray/30"
                />
              </div>

              {/* Production Day */}
              <div className="space-y-2">
                <Label>Production Day</Label>
                <Select value={generateDayId} onValueChange={setGenerateDayId}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                    <SelectValue placeholder="Select a production day" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a1a] border-muted-gray/30 shadow-lg">
                    {productionDays?.map((day) => (
                      <SelectItem key={day.id} value={day.id}>
                        Day {day.day_number} - {formatDate(day.date)}
                        {day.title && ` (${day.title})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scenes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Scenes to Include</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllScenes}
                      className="text-xs"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSceneSelection}
                      className="text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="border border-muted-gray/30 rounded-md max-h-60 overflow-y-auto">
                  {loadingScenes ? (
                    <div className="p-4 text-center text-muted-gray">
                      Loading scenes...
                    </div>
                  ) : scenes && scenes.length > 0 ? (
                    <div className="divide-y divide-muted-gray/10">
                      {scenes.map((scene) => (
                        <label
                          key={scene.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted-gray/10 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedSceneIds.includes(scene.id)}
                            onCheckedChange={() => toggleScene(scene.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Film className="w-4 h-4 text-muted-gray" />
                              <span className="font-medium">
                                Scene {scene.scene_number}
                              </span>
                            </div>
                            <p className="text-xs text-muted-gray truncate">
                              {scene.slugline || `${scene.int_ext || ''} ${scene.set_name || ''} - ${scene.time_of_day || ''}`.trim()}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-gray">
                      No scenes found
                    </div>
                  )}
                </div>

                {selectedSceneIds.length > 0 && (
                  <p className="text-sm text-muted-gray">
                    {selectedSceneIds.length} scene{selectedSceneIds.length !== 1 && 's'} selected
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowGenerateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={!generateDayId || selectedSceneIds.length === 0 || generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirmation */}
      <AlertDialog open={!!regenerateId} onOpenChange={() => setRegenerateId(null)}>
        <AlertDialogContent className="bg-rich-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Script Sides?</AlertDialogTitle>
            <AlertDialogDescription>
              This will extract updated pages from the master script based on the current scene
              schedule. The existing PDF will be replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent className="bg-rich-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script Sides?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this sides packet. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScriptSidesExportsView;
