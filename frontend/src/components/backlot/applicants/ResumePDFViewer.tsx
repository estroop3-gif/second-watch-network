/**
 * ResumePDFViewer - Embedded PDF viewer for resumes
 * Simplified version of ClearancePDFViewer
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2,
  Maximize2,
  Minimize2,
  Download,
  RotateCcw,
  FileText,
  ExternalLink,
} from 'lucide-react';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import PDF.js styles
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface ResumePDFViewerProps {
  fileUrl: string;
  fileName?: string;
}

export function ResumePDFViewer({ fileUrl, fileName = 'Resume' }: ResumePDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('Error loading PDF:', error);
    setPdfError('Failed to load resume PDF. The file may be corrupted or inaccessible.');
  }, []);

  // Page navigation
  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < numPages) setCurrentPage(currentPage + 1);
  };

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1.0);

  // Download handler
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open in new tab
  const handleOpenInNewTab = () => {
    window.open(fileUrl, '_blank');
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

  return (
    <Card className="bg-charcoal-black border-muted-gray/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Resume
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className="flex flex-col bg-charcoal-black rounded-b-lg overflow-hidden"
          ref={containerRef}
          style={{ height: isFullscreen ? '100vh' : '600px' }}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-muted-gray/20 bg-black/20">
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
            </div>

            <div className="flex items-center gap-2">
              {/* Download */}
              <Button variant="ghost" size="sm" onClick={handleDownload} title="Download">
                <Download className="w-4 h-4" />
              </Button>

              {/* Open in new tab */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenInNewTab}
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>

              {/* Fullscreen */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* PDF content */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            {pdfError ? (
              <div className="text-center text-muted-gray py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="mb-4">{pdfError}</p>
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Resume Externally
                </Button>
              </div>
            ) : (
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex flex-col items-center gap-2 text-muted-gray py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p>Loading resume...</p>
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
          {numPages > 1 && (
            <div className="flex items-center justify-center px-4 py-2 border-t border-muted-gray/20 bg-black/20">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToPrevPage}
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
                  onClick={goToNextPage}
                  disabled={currentPage >= numPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
