/**
 * BatchSigningModal - Sign multiple documents at once with a single signature
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FileCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eraser,
  PenTool,
} from 'lucide-react';
import { useBatchSign } from '@/hooks/backlot';
import { useProfile } from '@/hooks/useProfile';
import {
  PendingDocument,
  CLEARANCE_TYPE_LABELS,
} from '@/types/backlot';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface BatchSigningModalProps {
  open: boolean;
  onClose: () => void;
  documents: PendingDocument[];
}

export function BatchSigningModal({
  open,
  onClose,
  documents,
}: BatchSigningModalProps) {
  const { profile } = useProfile();
  const batchSign = useBatchSign();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedByName, setSignedByName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
      setSignedByName(profile?.full_name || '');
      setSignatureData(null);
      clearSignature();
    }
  }, [open, profile?.full_name]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctxRef.current = ctx;
    ctx.strokeStyle = '#F9F5EF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [open]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData(null);
  };

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    const { x, y } = getCanvasPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'));
    }
    setIsDrawing(false);
  };

  const handleSign = async () => {
    if (!signatureData) {
      toast.error('Please provide your signature');
      return;
    }

    if (!signedByName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    try {
      const result = await batchSign.mutateAsync({
        clearance_ids: documents.map((d) => d.clearance_id),
        recipient_ids: documents.map((d) => d.recipient_id),
        signature_data: signatureData,
        signed_by_name: signedByName.trim(),
      });

      toast.success(
        `Successfully signed ${result.documents_signed} ${result.documents_signed === 1 ? 'document' : 'documents'}`
      );

      onClose();
    } catch (err) {
      toast.error('Failed to sign documents', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const currentDoc = documents[currentIndex];
  const hasSignature = !!signatureData;

  if (documents.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary-red" />
            Batch Sign Documents
          </DialogTitle>
          <DialogDescription>
            Sign {documents.length} {documents.length === 1 ? 'document' : 'documents'} with a single signature
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Document Preview Navigation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Documents to Sign ({currentIndex + 1} of {documents.length})</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={currentIndex === documents.length - 1}
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Current Document */}
            {currentDoc && (
              <div className="bg-muted-gray/10 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-bone-white">{currentDoc.clearance_title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {CLEARANCE_TYPE_LABELS[currentDoc.clearance_type] || currentDoc.clearance_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {currentDoc.project_title}
                      </span>
                    </div>
                  </div>
                </div>

                {currentDoc.file_url && (
                  <a
                    href={currentDoc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-red hover:underline"
                  >
                    View Document
                  </a>
                )}
              </div>
            )}

            {/* Document thumbnails */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {documents.map((doc, index) => (
                <button
                  key={doc.clearance_id}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'flex-shrink-0 w-16 h-16 rounded border-2 flex items-center justify-center transition-all',
                    index === currentIndex
                      ? 'border-primary-red bg-primary-red/10'
                      : 'border-muted-gray/30 bg-muted-gray/10 hover:border-muted-gray/50'
                  )}
                >
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          {/* Signer Name */}
          <div className="space-y-2">
            <Label htmlFor="signerName">Your Full Name *</Label>
            <Input
              id="signerName"
              placeholder="Enter your full name"
              value={signedByName}
              onChange={(e) => setSignedByName(e.target.value)}
            />
          </div>

          {/* Signature Canvas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Your Signature *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                className="text-muted-foreground"
              >
                <Eraser className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>

            <div
              className={cn(
                'border-2 border-dashed rounded-lg overflow-hidden',
                hasSignature ? 'border-green-500/50' : 'border-muted-gray/50'
              )}
            >
              <canvas
                ref={canvasRef}
                width={500}
                height={150}
                className="w-full h-[150px] cursor-crosshair bg-charcoal-black touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>

            {!hasSignature && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <PenTool className="h-3 w-3" />
                Draw your signature above using mouse or touch
              </p>
            )}
          </div>

          {/* Confirmation */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-400">Legal Confirmation</p>
                <p className="text-muted-foreground mt-1">
                  By clicking &quot;Sign All Documents&quot;, you agree that your electronic signature
                  is legally binding and has the same effect as a handwritten signature for all
                  {' '}{documents.length} selected {documents.length === 1 ? 'document' : 'documents'}.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={batchSign.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSign}
            disabled={batchSign.isPending || !hasSignature || !signedByName.trim()}
            className="bg-primary-red hover:bg-primary-red/90"
          >
            {batchSign.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Sign All Documents
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
