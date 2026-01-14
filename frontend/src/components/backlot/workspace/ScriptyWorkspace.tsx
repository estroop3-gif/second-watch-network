/**
 * ScriptyWorkspace - Script Supervisor's Continuity Workspace
 *
 * Three-region layout:
 * - Left: PDF Script Viewer with page navigation
 * - Center: Lined Script overlay for coverage marks
 * - Right: Scene/Take Panel with take logger
 * - Bottom: Take timeline for quick navigation
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  StickyNote,
  Image,
  Download,
  Play,
  Square,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Clapperboard,
  Fullscreen,
  X,
  FileJson,
  FileSpreadsheet,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import { useScripts, useScenes, useProductionDays, ContinuityExportSceneMappings } from '@/hooks/backlot';
import { BacklotScript, BacklotScene } from '@/types/backlot';
import { useToast } from '@/hooks/use-toast';
import {
  useExportTakes,
  useExportNotes,
  useExportDailyReport,
  downloadFile,
} from '@/hooks/backlot/useContinuity';

// Sub-components (will be created)
import LinedScriptOverlay from './scripty/LinedScriptOverlay';
import TakeLoggerPanel from './scripty/TakeLoggerPanel';
import ContinuityNotesPanel from './scripty/ContinuityNotesPanel';
import ContinuityPhotosPanel from './scripty/ContinuityPhotosPanel';

interface ScriptyWorkspaceProps {
  projectId: string;
  canEdit: boolean;
  continuityPdfUrl?: string;  // Override PDF from continuity exports
  sceneMappings?: ContinuityExportSceneMappings;  // Scene-to-page mappings from export
  // Annotation support (for Continuity tab)
  continuityExportId?: string;  // If provided, enables annotation tools
  showAnnotationToolbar?: boolean;
}

type RightPanelTab = 'takes' | 'notes' | 'photos';

const ScriptyWorkspace: React.FC<ScriptyWorkspaceProps> = ({
  projectId,
  canEdit,
  continuityPdfUrl,
  sceneMappings,
  continuityExportId,
  showAnnotationToolbar = false,
}) => {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scrollY, setScrollY] = useState<number | undefined>(undefined);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('takes');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Browser fullscreen toggle
  const toggleBrowserFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsBrowserFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsBrowserFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
      toast({
        title: 'Fullscreen Error',
        description: 'Could not enter fullscreen mode',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Data hooks
  const { scripts, isLoading: scriptsLoading } = useScripts({ projectId });
  const { scenes, isLoading: scenesLoading } = useScenes({ projectId });
  const { data: productionDays, isLoading: daysLoading } = useProductionDays(projectId);

  // Export hooks
  const exportTakes = useExportTakes(projectId);
  const exportNotes = useExportNotes(projectId);
  const exportDailyReport = useExportDailyReport(projectId);

  const isExporting = exportTakes.isPending || exportNotes.isPending || exportDailyReport.isPending;

  // Export handlers
  const handleExportTakes = async (format: 'csv' | 'json') => {
    try {
      const result = await exportTakes.mutateAsync({
        format,
        productionDayId: selectedDayId || undefined,
      });

      const filename = `takes_${new Date().toISOString().split('T')[0]}.${format}`;
      const content = format === 'csv' ? result.data as string : JSON.stringify(result.data, null, 2);
      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';

      downloadFile(content, filename, mimeType);
      toast({
        title: 'Export Complete',
        description: `Takes exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not export takes. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleExportNotes = async (format: 'csv' | 'json') => {
    try {
      const result = await exportNotes.mutateAsync({
        format,
        sceneId: selectedSceneId || undefined,
      });

      const filename = `continuity_notes_${new Date().toISOString().split('T')[0]}.${format}`;
      const content = format === 'csv' ? result.data as string : JSON.stringify(result.data, null, 2);
      const mimeType = format === 'csv' ? 'text/csv' : 'application/json';

      downloadFile(content, filename, mimeType);
      toast({
        title: 'Export Complete',
        description: `Notes exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not export notes. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleExportDailyReport = async () => {
    if (!selectedDayId) {
      toast({
        title: 'Select a Day',
        description: 'Please select a production day to export the daily report.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const report = await exportDailyReport.mutateAsync(selectedDayId);
      const dayNumber = report?.production_day?.day_number || 'unknown';
      const filename = `daily_report_day_${dayNumber}_${new Date().toISOString().split('T')[0]}.json`;

      downloadFile(JSON.stringify(report, null, 2), filename, 'application/json');
      toast({
        title: 'Export Complete',
        description: `Daily report for Day ${dayNumber} exported`,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Could not export daily report. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Auto-select current script version (switch when new version is created)
  useEffect(() => {
    if (scripts.length > 0) {
      // Find the current script version (cast to access is_current property if present)
      interface ScriptWithVersion extends BacklotScript {
        is_current?: boolean;
      }
      const currentScript = (scripts as ScriptWithVersion[]).find((s) => s.is_current);

      // If there's a current version and it's different from selected, switch to it
      if (currentScript && currentScript.id !== selectedScriptId) {
        setSelectedScriptId(currentScript.id);
      } else if (!selectedScriptId) {
        // Fallback to first script if none selected
        setSelectedScriptId(scripts[0].id);
      }
    }
  }, [scripts]);

  // Auto-select today's production day
  useEffect(() => {
    if (!selectedDayId && productionDays && productionDays.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const todayDay = productionDays.find(d => d.date === today);
      if (todayDay) {
        setSelectedDayId(todayDay.id);
      } else {
        // Find most recent or first upcoming day
        const sortedDays = [...productionDays].sort((a, b) =>
          parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
        );
        const pastDays = sortedDays.filter(d => d.date < today);
        if (pastDays.length > 0) {
          setSelectedDayId(pastDays[pastDays.length - 1].id);
        } else {
          setSelectedDayId(sortedDays[0]?.id || null);
        }
      }
    }
  }, [selectedDayId, productionDays]);

  const activeScript = scripts.find((s) => s.id === selectedScriptId);
  const activeDay = productionDays?.find(d => d.id === selectedDayId);

  // Dedupe scenes by scene_number (in case of duplicates in data)
  const uniqueScenes = scenes.filter((scene, index, self) =>
    index === self.findIndex((s) => s.scene_number === scene.scene_number)
  );
  const activeScene = uniqueScenes.find((s) => s.id === selectedSceneId);

  const isLoading = scriptsLoading || scenesLoading || daysLoading;

  // Handle page navigation
  const handlePageChange = (page: number) => {
    if (activeScript && page >= 1 && page <= (activeScript.page_count || 1)) {
      setCurrentPage(page);
    }
  };

  // Handle rolling state
  const handleStartRolling = () => {
    setIsRecording(true);
    toast({
      title: 'Rolling',
      description: 'Camera is rolling. Click Stop when take is complete.',
    });
  };

  const handleStopRolling = () => {
    setIsRecording(false);
    toast({
      title: 'Cut',
      description: 'Take recorded. Add status and notes.',
    });
  };

  // Empty state
  if (!isLoading && scripts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="w-16 h-16 text-muted-gray/40 mb-4" />
        <h3 className="text-xl font-medium text-bone-white mb-2">No Scripts Available</h3>
        <p className="text-muted-gray mb-6 max-w-md">
          Import a script to start using the Continuity workspace.
          The script supervisor tools require a script with scene breakdowns.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="scripty-workspace"
      className={cn(
        "flex flex-col",
        isBrowserFullscreen
          ? "h-screen w-screen bg-charcoal-black p-4"
          : "h-[calc(100vh-4rem)]"
      )}
    >
      {/* Header - Compact */}
      <div className="flex items-center justify-between gap-2 mb-1 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading text-bone-white">Scripty</span>
          {isBrowserFullscreen && (
            <Badge className="text-[10px] bg-accent-yellow/20 text-accent-yellow">
              Fullscreen
            </Badge>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Script Selector */}
          <Select
            value={selectedScriptId || ''}
            onValueChange={(value) => setSelectedScriptId(value || null)}
          >
            <SelectTrigger data-testid="script-selector" className="w-48 bg-soft-black border-muted-gray/30">
              <SelectValue placeholder={scriptsLoading ? "Loading..." : "Select script"} />
            </SelectTrigger>
            <SelectContent>
              {scripts.map((script) => {
                // Cast to access is_current property if present (from script versions)
                const scriptWithVersion = script as BacklotScript & { is_current?: boolean };
                return (
                  <SelectItem key={script.id} value={script.id}>
                    <div className="flex items-center gap-2">
                      <span className="truncate">{script.title}</span>
                      {scriptWithVersion.is_current && (
                        <Badge className="text-[10px] bg-green-500/20 text-green-400">Current</Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Production Day Selector */}
          <Select
            value={selectedDayId || ''}
            onValueChange={(value) => setSelectedDayId(value || null)}
          >
            <SelectTrigger data-testid="production-day-selector" className="w-36 bg-soft-black border-muted-gray/30">
              <SelectValue placeholder={daysLoading ? "Loading..." : "Day"} />
            </SelectTrigger>
            <SelectContent>
              {productionDays?.map((day) => (
                <SelectItem key={day.id} value={day.id}>
                  Day {day.day_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Rolling Button */}
          {canEdit && (
            <Button
              data-testid="rolling-button"
              onClick={isRecording ? handleStopRolling : handleStartRolling}
              className={cn(
                'min-w-[100px]',
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-accent-yellow text-charcoal-black hover:bg-bone-white'
              )}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Rolling
                </>
              )}
            </Button>
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="export-button" variant="outline" size="icon" title="Export" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent data-testid="export-menu" align="end" className="w-48">
              <DropdownMenuLabel>Export Takes</DropdownMenuLabel>
              <DropdownMenuItem data-testid="export-takes-csv" onClick={() => handleExportTakes('csv')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Takes (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="export-takes-json" onClick={() => handleExportTakes('json')}>
                <FileJson className="w-4 h-4 mr-2" />
                Takes (JSON)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Export Notes</DropdownMenuLabel>
              <DropdownMenuItem data-testid="export-notes-csv" onClick={() => handleExportNotes('csv')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Notes (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="export-notes-json" onClick={() => handleExportNotes('json')}>
                <FileJson className="w-4 h-4 mr-2" />
                Notes (JSON)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Daily Report</DropdownMenuLabel>
              <DropdownMenuItem data-testid="export-daily-report" onClick={handleExportDailyReport}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Daily Report (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen Button */}
          <Button
            data-testid="fullscreen-button"
            variant="outline"
            size="icon"
            onClick={toggleBrowserFullscreen}
            title={isBrowserFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isBrowserFullscreen ? (
              <X className="w-4 h-4" />
            ) : (
              <Fullscreen className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main Content - Three Region Layout - Full Height */}
      <div className={cn(
        "flex-1 gap-3 min-h-0",
        isFullscreen ? "flex" : "grid grid-cols-12"
      )}>
        {/* Left Panel - Scene List (hidden in fullscreen) */}
        {!isFullscreen && (
          <div data-testid="scenes-panel" className="col-span-2 flex flex-col min-h-0 max-h-full overflow-hidden">
            <Card className="flex-1 bg-charcoal-black border-muted-gray/20 flex flex-col min-h-0">
              <CardHeader className="py-2 px-3 border-b border-muted-gray/20 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-medium text-bone-white">
                    Scenes
                  </CardTitle>
                </div>
              </CardHeader>
              <ScrollArea className="flex-1">
                <div data-testid="scenes-list" className="p-1 space-y-0.5">
                  {scenesLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 bg-muted-gray/10" />
                    ))
                  ) : uniqueScenes.length === 0 ? (
                    <div className="text-center py-4 px-2">
                      <p className="text-xs text-white mb-1">No scenes</p>
                      <p className="text-[10px] text-muted-gray">Import a script with scene breakdowns</p>
                    </div>
                  ) : (
                    uniqueScenes.map((scene) => (
                      <button
                        key={scene.id}
                        data-testid={`scene-item-${scene.scene_number}`}
                        onClick={() => {
                          setSelectedSceneId(scene.id);
                          // Use scene mappings from continuity export if available
                          if (sceneMappings?.scenes) {
                            const mapping = sceneMappings.scenes.find(m => m.scene_id === scene.id);
                            if (mapping) {
                              setCurrentPage(mapping.page_number);
                              setScrollY(mapping.scroll_y);
                              return;
                            }
                          }
                          // Fallback to scene's page_start (no scroll_y available)
                          if (scene.page_start) {
                            setCurrentPage(scene.page_start);
                            setScrollY(undefined);
                          }
                        }}
                        className={cn(
                          'w-full text-left px-2 py-2 rounded transition-colors',
                          selectedSceneId === scene.id
                            ? 'bg-accent-yellow/10 border border-accent-yellow/30'
                            : 'hover:bg-muted-gray/10 border border-transparent'
                        )}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-xs" style={{ color: '#FFFFFF' }}>
                            {scene.scene_number}
                          </span>
                          {scene.coverage_status === 'shot' && (
                            <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                          )}
                        </div>
                        {(scene.int_ext || scene.set_name) && (
                          <p className="text-[10px] leading-tight" style={{ color: '#CCCCCC' }}>
                            {scene.int_ext}{scene.int_ext && scene.set_name ? '. ' : ''}{scene.set_name}
                            {scene.time_of_day ? ` - ${scene.time_of_day}` : ''}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
        )}

        {/* Center Panel - Full Page Script Viewer */}
        <div
          data-testid="script-viewer-panel"
          className={cn(
            "flex flex-col min-h-0 max-h-full overflow-hidden",
            isFullscreen ? "flex-1" : "col-span-8"
          )}
        >
          <Card className="flex-1 bg-charcoal-black border-muted-gray/20 flex flex-col min-h-0 overflow-hidden">
            {/* Page Navigation */}
            <div data-testid="page-navigation" className="flex items-center justify-between py-2 px-4 border-b border-muted-gray/20 shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  data-testid="prev-page-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-gray">Page</span>
                <Select
                  value={currentPage.toString()}
                  onValueChange={(v) => setCurrentPage(parseInt(v, 10))}
                >
                  <SelectTrigger data-testid="page-selector" className="w-16 h-7 text-xs bg-transparent border-muted-gray/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: activeScript?.page_count || 1 }).map((_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span data-testid="page-count" className="text-sm text-muted-gray">of {activeScript?.page_count || 1}</span>
                <Button
                  data-testid="next-page-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= (activeScript?.page_count || 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Fullscreen Toggle */}
              <Button
                data-testid="script-fullscreen-toggle"
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen script view"}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Script Content with Lining Overlay - Full Height */}
            <div className="flex-1 relative min-h-0 overflow-auto bg-white">
              <LinedScriptOverlay
                projectId={projectId}
                scriptId={selectedScriptId}
                sceneId={selectedSceneId}
                pageNumber={currentPage}
                canEdit={canEdit}
                fileUrl={continuityPdfUrl || activeScript?.file_url}
                isFullscreen={isFullscreen}
                scrollY={scrollY}
                exportId={continuityExportId}
                showAnnotationToolbar={showAnnotationToolbar}
              />
            </div>
          </Card>
        </div>

        {/* Right Panel - Takes, Notes, Photos (hidden in fullscreen) */}
        {!isFullscreen && (
          <div data-testid="right-panel" className="col-span-2 flex flex-col min-h-0 max-h-full overflow-hidden">
            <Card className="flex-1 bg-charcoal-black border-muted-gray/20 flex flex-col min-h-0">
              <Tabs
                value={rightPanelTab}
                onValueChange={(v) => setRightPanelTab(v as RightPanelTab)}
                className="flex flex-col h-full"
              >
                <TabsList data-testid="right-panel-tabs" className="mx-2 mt-2 bg-soft-black border border-muted-gray/20 shrink-0">
                  <TabsTrigger data-testid="takes-tab" value="takes" className="flex-1 text-xs">
                    <Clapperboard className="w-3 h-3 mr-1" />
                    Takes
                  </TabsTrigger>
                  <TabsTrigger data-testid="notes-tab" value="notes" className="flex-1 text-xs">
                    <StickyNote className="w-3 h-3 mr-1" />
                    Notes
                  </TabsTrigger>
                  <TabsTrigger data-testid="photos-tab" value="photos" className="flex-1 text-xs">
                    <Image className="w-3 h-3 mr-1" />
                    Photos
                  </TabsTrigger>
                </TabsList>

                <TabsContent data-testid="takes-tab-content" value="takes" className="flex-1 min-h-0 mt-0 p-0">
                  <TakeLoggerPanel
                    projectId={projectId}
                    sceneId={selectedSceneId}
                    productionDayId={selectedDayId}
                    selectedSceneNumber={activeScene?.scene_number}
                    canEdit={canEdit}
                    isRecording={isRecording}
                    onTakeLogged={() => {
                      // Could trigger refetch or update UI
                    }}
                  />
                </TabsContent>

                <TabsContent data-testid="notes-tab-content" value="notes" className="flex-1 min-h-0 mt-0 p-0">
                  <ContinuityNotesPanel
                    projectId={projectId}
                    sceneId={selectedSceneId}
                    canEdit={canEdit}
                  />
                </TabsContent>

                <TabsContent data-testid="photos-tab-content" value="photos" className="flex-1 min-h-0 mt-0 p-0">
                  <ContinuityPhotosPanel
                    projectId={projectId}
                    sceneId={selectedSceneId}
                    canEdit={canEdit}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </div>

    </div>
  );
};

export default ScriptyWorkspace;
