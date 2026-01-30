/**
 * DealMemoPDFPreview - In-app PDF viewer for deal memo PDFs
 * Uses an iframe to display the PDF URL
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Download, ExternalLink, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealMemoPDFPreviewProps {
  pdfUrl: string | null;
  title?: string;
  className?: string;
  /** Inline mode - renders directly, no dialog */
  inline?: boolean;
  height?: number | string;
}

export function DealMemoPDFPreview({
  pdfUrl,
  title = 'Deal Memo',
  className,
  inline = false,
  height = 600,
}: DealMemoPDFPreviewProps) {
  const [loading, setLoading] = useState(true);

  if (!pdfUrl) {
    return (
      <div className={cn('flex items-center justify-center p-8 border rounded-lg bg-muted/30', className)}>
        <p className="text-muted-foreground">No PDF available</p>
      </div>
    );
  }

  const viewer = (
    <div className={cn('relative', className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg z-10">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        src={`${pdfUrl}#toolbar=1`}
        className="w-full border rounded-lg"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
        onLoad={() => setLoading(false)}
        title={title}
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="outline" size="sm" asChild>
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            Open
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={pdfUrl} download>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );

  if (inline) return viewer;

  return viewer;
}

/**
 * Dialog wrapper for PDF preview
 */
interface DealMemoPDFDialogProps {
  open: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  title?: string;
}

export function DealMemoPDFDialog({ open, onClose, pdfUrl, title = 'Deal Memo PDF' }: DealMemoPDFDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DealMemoPDFPreview pdfUrl={pdfUrl} title={title} inline height="70vh" />
      </DialogContent>
    </Dialog>
  );
}
