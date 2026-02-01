/**
 * ScriptPDFViewer - Pure PDF reference viewer
 * Displays the original script PDF for reference only.
 * All annotation features (notes, highlights) are in ScriptTextViewer.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  X,
  StickyNote,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  List,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { BacklotScript } from '@/types/backlot';
import { cn } from '@/lib/utils';
import { usePdfCache } from '@/hooks/usePdfCache';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import PDF.js styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface ScriptPDFViewerProps {
  script: BacklotScript;
  onClose?: () => void;
}

// Page thumbnail component
const PageThumbnail: React.FC<{
  pageNumber: number;
  pdfUrl: string;
  isActive: boolean;
  onClick: () => void;
}> = React.memo(({ pageNumber, pdfUrl, isActive, onClick }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex-shrink-0 border-2 rounded overflow-hidden transition-all',
        isActive ? 'border-accent-yellow' : 'border-transparent hover:border-muted-gray/50'
      )}
    >
      {hasError ? (
        <div className="w-[80px] h-[104px] bg-charcoal-black/50 flex items-center justify-center">
          <span className="text-xs text-muted-gray">{pageNumber}</span>
        </div>
      ) : (
        <Document
          file={pdfUrl}
          loading=""
          error=""
          onLoadError={() => setHasError(true)}
        >
          <Page
            pageNumber={pageNumber}
            width={80}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            error=""
            onRenderError={() => setHasError(true)}
          />
        </Document>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
        {pageNumber}
      </div>
    </button>
  );
});

// Main component
const ScriptPDFViewer: React.FC<ScriptPDFViewerProps> = ({
  script,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // PDF caching - stores PDF locally to avoid re-downloading
  const { pdfSource, isLoading: isPdfLoading, cacheStatus } = usePdfCache(
    script.id,
    script.file_url || null
  );

  // State
  const [numPages, setNumPages] = useState<number>(script.total_pages || 0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // PDF document loaded
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error);
    setPdfError('Failed to load PDF. The file may be corrupted or inaccessible.');
  }, []);

  // Page navigation
  const goToPage = (page: number) => {
    if (page >= 1 && page <= numPages) {
      setCurrentPage(page);
    }
  };

  const goToPrevPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);
  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(numPages);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else if ((containerRef.current as any).msRequestFullscreen) {
        (containerRef.current as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft') goToPrevPage();
      if (e.key === 'ArrowRight') goToNextPage();
      if (e.key === 'Home') goToFirstPage();
      if (e.key === 'End') goToLastPage();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, toggleFullscreen]);

  if (!script.file_url) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-muted-gray">
        <StickyNote className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg">No PDF file attached to this script</p>
        <p className="text-sm">Import a PDF script to view it here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-charcoal-black" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 gap-2 border-b border-muted-gray/20 bg-black/20 overflow-x-auto">
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 min-w-0">
          <h2 className="text-sm md:text-lg font-medium text-bone-white truncate max-w-[120px] md:max-w-[200px]">
            {script.title}
          </h2>
          {script.version && (
            <Badge variant="outline" className="text-xs hidden sm:flex">
              v{script.version}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs text-muted-gray border-muted-gray/30 hidden sm:flex">
            Reference Only
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSidebar(!showSidebar)}
            title="Toggle page list"
          >
            <List className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-muted-gray/30" />

          {/* Zoom controls */}
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-gray w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetZoom}>
            <RotateCcw className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-muted-gray/30" />

          {/* Fullscreen toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Cache status indicator */}
          {cacheStatus === 'cached' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                      Cached
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>PDF loaded from local cache</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {(cacheStatus === 'downloading' || isPdfLoading) && (
            <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Caching...
            </Badge>
          )}

          {onClose && !isFullscreen && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Page thumbnails sidebar */}
        {showSidebar && (
          <div className="w-28 border-r border-muted-gray/20 overflow-y-auto p-2 flex flex-col gap-2 bg-black/10">
            {numPages > 0 &&
              Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <PageThumbnail
                  key={pageNum}
                  pageNumber={pageNum}
                  pdfUrl={pdfSource || script.file_url!}
                  isActive={currentPage === pageNum}
                  onClick={() => goToPage(pageNum)}
                />
              ))}
          </div>
        )}

        {/* PDF viewer */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-4">
          {isPdfLoading && !pdfSource ? (
            <div className="flex flex-col items-center gap-3 text-muted-gray py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>
                {cacheStatus === 'checking' && 'Checking local cache...'}
                {cacheStatus === 'downloading' && 'Downloading and caching PDF...'}
                {cacheStatus !== 'checking' && cacheStatus !== 'downloading' && 'Loading PDF...'}
              </p>
            </div>
          ) : pdfError ? (
            <div className="text-center text-muted-gray py-12">
              <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>{pdfError}</p>
            </div>
          ) : pdfSource ? (
            <Document
              key={`doc-${script.id}`}
              file={pdfSource}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              error={
                <div className="flex items-center justify-center h-[400px] text-muted-gray">
                  <span>Error loading PDF</span>
                </div>
              }
              loading={
                <div className="flex flex-col items-center gap-2 text-muted-gray">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>
                    {cacheStatus === 'checking' && 'Checking cache...'}
                    {cacheStatus === 'downloading' && 'Downloading PDF...'}
                    {cacheStatus === 'cached' && 'Loading from cache...'}
                    {(cacheStatus === 'ready' || cacheStatus === 'error') && 'Loading PDF...'}
                  </span>
                </div>
              }
            >
              <div ref={pageRef} className="relative shadow-2xl">
                <Page
                  key={`page-${currentPage}-${script.id}`}
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  error={
                    <div className="flex items-center justify-center h-[800px] text-muted-gray">
                      <span>Error loading page {currentPage}</span>
                    </div>
                  }
                />
              </div>
            </Document>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-gray py-12">
              <StickyNote className="w-12 h-12 opacity-40" />
              <p>No PDF available</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-2 md:px-4 py-2 border-t border-muted-gray/20 bg-black/20">
        <div className="flex items-center gap-1 md:gap-2">
          <Button variant="ghost" size="sm" onClick={goToFirstPage} disabled={currentPage <= 1} className="hidden sm:flex">
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-1 md:gap-2">
            <Input
              type="number"
              min={1}
              max={numPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
              className="w-12 md:w-16 h-8 text-center text-sm"
            />
            <span className="text-xs md:text-sm text-muted-gray whitespace-nowrap">of {numPages}</span>
          </div>

          <Button variant="ghost" size="sm" onClick={goToNextPage} disabled={currentPage >= numPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToLastPage} disabled={currentPage >= numPages} className="hidden sm:flex">
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="text-xs md:text-sm text-muted-gray hidden sm:block">
          Use Text View for notes and highlights
        </div>
      </div>
    </div>
  );
};

export default ScriptPDFViewer;
