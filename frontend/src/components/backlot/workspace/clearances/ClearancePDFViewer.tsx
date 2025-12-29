/**
 * ClearancePDFViewer - Simple PDF viewer for clearance documents
 * Simplified version with page navigation, zoom, and download
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  Maximize2,
  Minimize2,
  Download,
  RotateCcw,
  FileText,
} from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import PDF.js styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface ClearancePDFViewerProps {
  fileUrl: string;
  fileName: string;
}

export function ClearancePDFViewer({ fileUrl, fileName }: ClearancePDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
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

  // Download handler
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if ((containerRef.current as any).webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
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

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  return (
    <div className="flex flex-col h-full bg-charcoal-black" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-muted-gray/20 bg-black/20">
        <div className="flex items-center gap-2 text-sm text-bone-white truncate max-w-[200px]">
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{fileName}</span>
        </div>

        <div className="flex items-center gap-2">
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
          <Button variant="ghost" size="sm" onClick={resetZoom} title="Reset zoom">
            <RotateCcw className="w-4 h-4" />
          </Button>

          <div className="h-4 w-px bg-muted-gray/30" />

          {/* Download */}
          <Button variant="ghost" size="sm" onClick={handleDownload} title="Download">
            <Download className="w-4 h-4" />
          </Button>

          {/* Fullscreen */}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {pdfError ? (
          <div className="text-center text-muted-gray py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>{pdfError}</p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center gap-2 text-muted-gray py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p>Loading PDF...</p>
              </div>
            }
          >
            <div className="shadow-2xl">
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          </Document>
        )}
      </div>

      {/* Footer navigation */}
      {numPages > 0 && (
        <div className="flex items-center justify-center px-4 py-2 border-t border-muted-gray/20 bg-black/20">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToFirstPage} disabled={currentPage <= 1}>
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToPrevPage} disabled={currentPage <= 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={numPages}
                value={currentPage}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-16 h-8 text-center text-sm"
              />
              <span className="text-sm text-muted-gray">of {numPages}</span>
            </div>

            <Button variant="ghost" size="sm" onClick={goToNextPage} disabled={currentPage >= numPages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToLastPage} disabled={currentPage >= numPages}>
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
