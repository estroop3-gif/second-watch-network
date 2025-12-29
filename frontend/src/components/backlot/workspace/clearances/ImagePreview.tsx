/**
 * ImagePreview - Image viewer for clearance documents
 * Displays images with zoom and download functionality
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  RotateCcw,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

interface ImagePreviewProps {
  fileUrl: string;
  fileName: string;
}

export function ImagePreview({ fileUrl, fileName }: ImagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.25));
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

  return (
    <div className="flex flex-col h-full bg-charcoal-black" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-muted-gray/20 bg-black/20">
        <div className="flex items-center gap-2 text-sm text-bone-white truncate max-w-[200px]">
          <ImageIcon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{fileName}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.25}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-gray w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 4}>
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
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {error ? (
          <div className="text-center text-muted-gray py-12">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-charcoal-black">
                <Loader2 className="w-8 h-8 animate-spin text-muted-gray" />
              </div>
            )}
            <img
              src={fileUrl}
              alt={fileName}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError('Failed to load image');
              }}
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease-out',
                maxWidth: '100%',
                maxHeight: '100%',
              }}
              className="shadow-2xl rounded"
            />
          </div>
        )}
      </div>
    </div>
  );
}
