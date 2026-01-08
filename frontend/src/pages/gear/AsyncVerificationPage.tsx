/**
 * Async Verification Page
 * Public page for receivers to verify gear receipt via token link
 * No authentication required - uses secure token access
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Barcode,
  PenTool,
  Clock,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { usePublicVerificationSession } from '@/hooks/gear/useGearVerification';
import type { VerificationItem, ItemVerificationStatus } from '@/types/gear';

// ============================================================================
// SIGNATURE PAD COMPONENT
// ============================================================================

interface SignaturePadProps {
  onSignature: (dataUrl: string) => void;
  signatureUrl?: string;
}

function SignaturePad({ onSignature, signatureUrl }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (signatureUrl && signatureUrl.startsWith('data:')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = signatureUrl;
    }
  }, [signatureUrl]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    onSignature(base64);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-1">
        <canvas
          ref={canvasRef}
          className="w-full h-48 rounded-lg cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={clearSignature}>
          Clear
        </Button>
        <Button size="sm" onClick={saveSignature} disabled={!hasSignature}>
          <Check className="h-4 w-4 mr-2" />
          Save Signature
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AsyncVerificationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  // Scanner state
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);

  // Signature state
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  // Completion state
  const [isCompleting, setIsCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Use the public verification hook
  const {
    session,
    isLoading,
    error,
    progress,
    verifyItem,
    captureSignature,
    completeVerification,
  } = usePublicVerificationSession(token || null);

  // Focus scanner on load
  useEffect(() => {
    if (!isLoading && session && !error) {
      setTimeout(() => scannerRef.current?.focus(), 100);
    }
  }, [isLoading, session, error]);

  // Handle barcode scan
  const handleScanSubmit = useCallback(async () => {
    if (!scanInput.trim() || isScanning || !session) return;
    setScanError(null);
    setIsScanning(true);

    try {
      const itemsToVerify = session.items_to_verify || [];
      const itemsVerified = session.items_verified || [];
      const verifiedIds = new Set(itemsVerified.map((i: VerificationItem) => i.id));

      // Find matching item
      const matchingItem = itemsToVerify.find(
        (item: VerificationItem) =>
          item.internal_id === scanInput.trim() ||
          item.id === scanInput.trim()
      );

      if (!matchingItem) {
        setScanError('Item not in verification list');
        setTimeout(() => setScanError(null), 3000);
        setScanInput('');
        setIsScanning(false);
        return;
      }

      if (verifiedIds.has(matchingItem.id)) {
        setScanError('Item already verified');
        setTimeout(() => setScanError(null), 3000);
        setScanInput('');
        setIsScanning(false);
        return;
      }

      await verifyItem.mutateAsync({ item_id: matchingItem.id, method: 'scan' });
      setScanInput('');
    } catch (err) {
      console.error('Scan error:', err);
      setScanError('Failed to verify item');
      setTimeout(() => setScanError(null), 3000);
    } finally {
      setIsScanning(false);
      scannerRef.current?.focus();
    }
  }, [scanInput, isScanning, session, verifyItem]);

  // Handle key press
  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanSubmit();
    }
  };

  // Handle signature capture
  const handleSignature = async (signatureData: string) => {
    setIsSavingSignature(true);
    try {
      await captureSignature.mutateAsync(signatureData);
      setSignatureSaved(true);
    } catch (err) {
      console.error('Signature error:', err);
    } finally {
      setIsSavingSignature(false);
    }
  };

  // Handle completion
  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await completeVerification.mutateAsync();
      setCompleted(true);
    } catch (err) {
      console.error('Completion error:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  // Get item status
  const getItemStatus = (itemId: string): ItemVerificationStatus => {
    if (!session) return 'pending';
    const verifiedIds = new Set((session.items_verified || []).map((i: VerificationItem) => i.id));
    if (verifiedIds.has(itemId)) return 'verified';
    return 'pending';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent-yellow mx-auto" />
          <p className="text-muted-foreground">Loading verification...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !session) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-red-500/10">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <CardTitle>Verification Not Found</CardTitle>
                <CardDescription>
                  {(error as Error)?.message || 'This verification link is invalid or has expired.'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Please contact the sender for a new verification link.
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed state
  if (completed || session.status === 'completed') {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <CardTitle>Verification Complete</CardTitle>
                <CardDescription>
                  Thank you! Your verification has been recorded.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                You have confirmed receipt of {(session.items_to_verify || []).length} item
                {(session.items_to_verify || []).length !== 1 ? 's' : ''} from{' '}
                {session.organization_name}.
              </p>
              <p>You can close this page now.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemsToVerify = session.items_to_verify || [];
  const requiresSignature = session.receiver_verification_mode !== 'scan';
  const requiresScan =
    session.receiver_verification_mode === 'scan' ||
    session.receiver_verification_mode === 'signature_and_scan';

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="border-b border-muted-gray/30 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-yellow/10">
              <Package className="h-6 w-6 text-accent-yellow" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Verify Receipt</h1>
              <p className="text-sm text-muted-foreground">
                From {session.organization_name}
              </p>
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {progress.verified} of {progress.total} items verified
                </span>
                <span className="font-medium">{progress.percentage}%</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Scanner Section */}
        {requiresScan && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Barcode className="h-5 w-5 text-accent-yellow" />
                Scan Items
              </CardTitle>
              <CardDescription>
                Scan or enter each item's barcode to verify receipt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  ref={scannerRef}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleScanKeyDown}
                  placeholder="Scan barcode or enter ID..."
                  className="flex-1"
                  disabled={isScanning}
                />
                <Button onClick={handleScanSubmit} disabled={!scanInput.trim() || isScanning}>
                  {isScanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {scanError && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  {scanError}
                </div>
              )}

              {/* Items List */}
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {itemsToVerify.map((item: VerificationItem) => {
                    const status = getItemStatus(item.id);
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border',
                          status === 'verified' && 'bg-green-500/10 border-green-500/30',
                          status === 'pending' && 'bg-background border-border'
                        )}
                      >
                        <div className="flex-shrink-0">
                          {status === 'verified' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          {item.internal_id && (
                            <div className="text-sm text-muted-foreground">{item.internal_id}</div>
                          )}
                        </div>
                        {item.type === 'kit' && (
                          <Badge variant="outline" className="text-xs">
                            Kit
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Signature Section */}
        {requiresSignature && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <PenTool className="h-5 w-5 text-accent-yellow" />
                Your Signature
                {(signatureSaved || session.signature_url) && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </CardTitle>
              <CardDescription>
                Sign below to confirm receipt of the items
              </CardDescription>
            </CardHeader>
            <CardContent>
              {signatureSaved || session.signature_url ? (
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-500">Signature saved</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSignatureSaved(false)}>
                    Re-sign
                  </Button>
                </div>
              ) : (
                <SignaturePad
                  onSignature={handleSignature}
                  signatureUrl={session.signature_url}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Complete Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleComplete}
          disabled={isCompleting}
        >
          {isCompleting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              <Check className="h-5 w-5 mr-2" />
              Complete Verification
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
