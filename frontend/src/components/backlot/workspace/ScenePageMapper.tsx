/**
 * ScenePageMapper - Map scenes to specific pages in the script PDF
 * Provides a visual interface to assign page ranges to each scene
 */
import React, { useState, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Link2,
  Unlink,
  MapPin,
  Sun,
  Moon,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { BacklotScript, BacklotScene } from '@/types/backlot';
import { useScenes, useSceneMutations } from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface ScenePageMapperProps {
  script: BacklotScript;
  projectId: string;
  canEdit: boolean;
  onClose?: () => void;
}

// Scene row component for the list
const SceneRow: React.FC<{
  scene: BacklotScene;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  pageStart: number | null;
  pageEnd: number | null;
  onPageStartChange: (val: number | null) => void;
  onPageEndChange: (val: number | null) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  canEdit: boolean;
  totalPages: number;
}> = ({
  scene,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  pageStart,
  pageEnd,
  onPageStartChange,
  onPageEndChange,
  onSave,
  onCancel,
  isSaving,
  canEdit,
  totalPages,
}) => {
  const hasMappedPages = scene.page_start !== null;

  return (
    <div
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all',
        isSelected
          ? 'border-accent-yellow bg-accent-yellow/10'
          : 'border-muted-gray/20 hover:border-muted-gray/40 bg-charcoal-black',
        isEditing && 'ring-2 ring-accent-yellow'
      )}
      onClick={() => !isEditing && onSelect()}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {scene.scene_number}
          </Badge>
          {scene.int_ext && (
            <span className="text-xs text-muted-gray uppercase">{scene.int_ext}</span>
          )}
          {scene.time_of_day === 'day' && <Sun className="w-3 h-3 text-amber-400" />}
          {scene.time_of_day === 'night' && <Moon className="w-3 h-3 text-indigo-400" />}
        </div>

        {hasMappedPages ? (
          <Badge className="bg-green-500/20 text-green-400 text-xs">
            <Link2 className="w-3 h-3 mr-1" />
            {scene.page_start === scene.page_end
              ? `p.${scene.page_start}`
              : `p.${scene.page_start}-${scene.page_end}`}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-orange-400 text-xs">
            <Unlink className="w-3 h-3 mr-1" />
            Unmapped
          </Badge>
        )}
      </div>

      {scene.set_name && (
        <p className="text-sm text-bone-white mt-1 truncate">{scene.set_name}</p>
      )}

      {isEditing ? (
        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-gray mb-1 block">Start Page</label>
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={pageStart || ''}
                onChange={(e) =>
                  onPageStartChange(e.target.value ? parseInt(e.target.value) : null)
                }
                className="h-8 text-sm"
                placeholder="Start"
              />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-gray mt-5" />
            <div className="flex-1">
              <label className="text-xs text-muted-gray mb-1 block">End Page</label>
              <Input
                type="number"
                min={pageStart || 1}
                max={totalPages}
                value={pageEnd || ''}
                onChange={(e) =>
                  onPageEndChange(e.target.value ? parseInt(e.target.value) : null)
                }
                className="h-8 text-sm"
                placeholder="End"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaving || !pageStart}
              className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSaving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="w-full mt-2 h-7 text-xs"
          >
            {hasMappedPages ? 'Edit Pages' : 'Map to Pages'}
          </Button>
        )
      )}
    </div>
  );
};

// Page thumbnail with scene indicators
const PageThumbnailWithScenes: React.FC<{
  pageNumber: number;
  pdfUrl: string;
  isActive: boolean;
  scenesOnPage: BacklotScene[];
  onClick: () => void;
}> = ({ pageNumber, pdfUrl, isActive, scenesOnPage, onClick }) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              'relative flex-shrink-0 border-2 rounded overflow-hidden transition-all',
              isActive ? 'border-accent-yellow' : 'border-transparent hover:border-muted-gray/50'
            )}
          >
            <Document file={pdfUrl} loading="">
              <Page
                pageNumber={pageNumber}
                width={100}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
              {pageNumber}
            </div>
            {scenesOnPage.length > 0 && (
              <div className="absolute top-1 right-1">
                <Badge className="h-5 min-w-[20px] text-xs px-1 bg-accent-yellow text-charcoal-black">
                  {scenesOnPage.length}
                </Badge>
              </div>
            )}
          </button>
        </TooltipTrigger>
        {scenesOnPage.length > 0 && (
          <TooltipContent side="right" className="max-w-[200px]">
            <p className="font-medium mb-1">Scenes on this page:</p>
            <div className="flex flex-wrap gap-1">
              {scenesOnPage.map((s) => (
                <Badge key={s.id} variant="outline" className="text-xs">
                  {s.scene_number}
                </Badge>
              ))}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

const ScenePageMapper: React.FC<ScenePageMapperProps> = ({
  script,
  projectId,
  canEdit,
  onClose,
}) => {
  const { toast } = useToast();
  const [numPages, setNumPages] = useState<number>(script.page_count || 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editPageStart, setEditPageStart] = useState<number | null>(null);
  const [editPageEnd, setEditPageEnd] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const { scenes, isLoading } = useScenes({ projectId, scriptId: script.id });
  const { updateScene } = useSceneMutations(projectId);

  // Get scenes for a specific page
  const getScenesForPage = (pageNum: number): BacklotScene[] => {
    if (!scenes) return [];
    return scenes.filter((scene) => {
      if (scene.page_start === null) return false;
      const end = scene.page_end || scene.page_start;
      return pageNum >= scene.page_start && pageNum <= end;
    });
  };

  // Stats
  const stats = useMemo(() => {
    if (!scenes) return { total: 0, mapped: 0, unmapped: 0 };
    const mapped = scenes.filter((s) => s.page_start !== null).length;
    return {
      total: scenes.length,
      mapped,
      unmapped: scenes.length - mapped,
    };
  }, [scenes]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('Error loading PDF:', error);
    setPdfError('Failed to load PDF');
  };

  const handleStartEdit = (scene: BacklotScene) => {
    setEditingSceneId(scene.id);
    setEditPageStart(scene.page_start);
    setEditPageEnd(scene.page_end || scene.page_start);
  };

  const handleCancelEdit = () => {
    setEditingSceneId(null);
    setEditPageStart(null);
    setEditPageEnd(null);
  };

  const handleSaveMapping = async () => {
    if (!editingSceneId || !editPageStart) return;

    try {
      await updateScene.mutateAsync({
        sceneId: editingSceneId,
        data: {
          page_start: editPageStart,
          page_end: editPageEnd || editPageStart,
        },
      });

      toast({
        title: 'Pages Mapped',
        description: `Scene mapped to page${editPageStart !== editPageEnd ? 's' : ''} ${editPageStart}${editPageEnd && editPageEnd !== editPageStart ? `-${editPageEnd}` : ''}`,
      });

      handleCancelEdit();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save page mapping',
        variant: 'destructive',
      });
    }
  };

  const handleSelectScene = (scene: BacklotScene) => {
    setSelectedSceneId(scene.id);
    if (scene.page_start) {
      setCurrentPage(scene.page_start);
    }
  };

  const handlePageClick = (pageNum: number) => {
    setCurrentPage(pageNum);
    // If editing, set as start page
    if (editingSceneId && !editPageStart) {
      setEditPageStart(pageNum);
    } else if (editingSceneId && editPageStart && !editPageEnd) {
      // Set as end page if we have start
      setEditPageEnd(pageNum);
    }
  };

  if (!script.file_url) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-gray">
        <FileText className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg">No PDF attached to this script</p>
        <p className="text-sm">Upload a PDF to map scenes to pages</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-charcoal-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-muted-gray/20 bg-black/20">
        <div>
          <h2 className="text-lg font-medium text-bone-white">Scene-to-Page Mapping</h2>
          <div className="flex items-center gap-4 mt-1 text-sm">
            <span className="text-muted-gray">
              {stats.total} scenes total
            </span>
            <Badge className="bg-green-500/20 text-green-400">
              {stats.mapped} mapped
            </Badge>
            {stats.unmapped > 0 && (
              <Badge className="bg-orange-500/20 text-orange-400">
                {stats.unmapped} unmapped
              </Badge>
            )}
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scene list */}
        <div className="w-80 border-r border-muted-gray/20 flex flex-col">
          <div className="p-3 border-b border-muted-gray/20">
            <h3 className="text-sm font-medium text-bone-white">Scenes</h3>
            <p className="text-xs text-muted-gray mt-1">
              Click a scene to view its pages, or edit to map pages
            </p>
          </div>
          <ScrollArea className="flex-1 p-3">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : !scenes || scenes.length === 0 ? (
              <div className="text-center py-8 text-muted-gray">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No scenes found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {scenes.map((scene) => (
                  <SceneRow
                    key={scene.id}
                    scene={scene}
                    isSelected={selectedSceneId === scene.id}
                    isEditing={editingSceneId === scene.id}
                    onSelect={() => handleSelectScene(scene)}
                    onEdit={() => handleStartEdit(scene)}
                    pageStart={editingSceneId === scene.id ? editPageStart : scene.page_start}
                    pageEnd={editingSceneId === scene.id ? editPageEnd : scene.page_end}
                    onPageStartChange={setEditPageStart}
                    onPageEndChange={setEditPageEnd}
                    onSave={handleSaveMapping}
                    onCancel={handleCancelEdit}
                    isSaving={updateScene.isPending}
                    canEdit={canEdit}
                    totalPages={numPages}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* PDF viewer with page grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Page navigation */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-muted-gray/20">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-gray">
                Page {currentPage} of {numPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            {editingSceneId && (
              <div className="text-sm text-accent-yellow">
                Click page thumbnails below to set start/end pages
              </div>
            )}
          </div>

          {/* Current page view */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-black/10">
            {pdfError ? (
              <div className="text-center text-muted-gray py-12">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p>{pdfError}</p>
              </div>
            ) : (
              <Document
                file={script.file_url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center gap-2 text-muted-gray">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading PDF...
                  </div>
                }
              >
                <div className="relative shadow-2xl">
                  <Page
                    pageNumber={currentPage}
                    scale={0.9}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                  {/* Overlay showing scenes on this page */}
                  {getScenesForPage(currentPage).length > 0 && (
                    <div className="absolute top-2 right-2 space-y-1">
                      {getScenesForPage(currentPage).map((scene) => (
                        <Badge
                          key={scene.id}
                          className={cn(
                            'text-xs',
                            selectedSceneId === scene.id
                              ? 'bg-accent-yellow text-charcoal-black'
                              : 'bg-charcoal-black/80 text-bone-white'
                          )}
                        >
                          Scene {scene.scene_number}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </Document>
            )}
          </div>

          {/* Page thumbnails strip */}
          <div className="h-32 border-t border-muted-gray/20 bg-black/20 overflow-x-auto">
            <div className="flex gap-2 p-2 h-full">
              {numPages > 0 &&
                Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <PageThumbnailWithScenes
                    key={pageNum}
                    pageNumber={pageNum}
                    pdfUrl={script.file_url!}
                    isActive={currentPage === pageNum}
                    scenesOnPage={getScenesForPage(pageNum)}
                    onClick={() => handlePageClick(pageNum)}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenePageMapper;
