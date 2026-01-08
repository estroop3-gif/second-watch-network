/**
 * Receiver Verification Component
 * Handles receiver signature capture and optional scan verification
 * Supports same-session or async link verification
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Check,
  Send,
  Loader2,
  PenTool,
  ScanBarcode,
  Undo2,
  Mail,
  Link2,
  Copy,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

import type {
  ReceiverVerificationMode,
  ReceiverVerificationTiming,
  VerificationItem,
} from '@/types/gear';

// ============================================================================
// TYPES
// ============================================================================

interface ReceiverVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  receiverName: string;
  receiverEmail?: string;
  verificationMode: ReceiverVerificationMode;
  verificationTiming: ReceiverVerificationTiming;
  items: VerificationItem[];
  onSignatureComplete: (signatureData: string) => Promise<void>;
  onSendAsyncLink: (email: string) => Promise<{ verification_url: string; expires_at: string }>;
  onComplete: () => Promise<void>;
  signatureUrl?: string;
  itemsVerified?: boolean;
  isLoading?: boolean;
}

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

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear and set background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set drawing style
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // If there's an existing signature, load it
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
    // Extract base64 part
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
          <Undo2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
        <Button size="sm" onClick={saveSignature} disabled={!hasSignature}>
          <Check className="h-4 w-4 mr-2" />
          Save Signature
        </Button>
      </div>
      <p className="text-sm text-muted-foreground text-center">
        Draw your signature above using your mouse or finger
      </p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ReceiverVerification({
  isOpen,
  onClose,
  orgId,
  receiverName,
  receiverEmail,
  verificationMode,
  verificationTiming,
  items,
  onSignatureComplete,
  onSendAsyncLink,
  onComplete,
  signatureUrl,
  itemsVerified,
  isLoading,
}: ReceiverVerificationProps) {
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'same_session' | 'async_link'>('same_session');

  // Signature state
  const [signatureCaptured, setSignatureCaptured] = useState(!!signatureUrl);
  const [isCapturingSignature, setIsCapturingSignature] = useState(false);

  // Async link state
  const [asyncEmail, setAsyncEmail] = useState(receiverEmail || '');
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);

  // Completion state
  const [isCompleting, setIsCompleting] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(verificationTiming === 'async_link' ? 'async_link' : 'same_session');
      setSignatureCaptured(!!signatureUrl);
      setAsyncEmail(receiverEmail || '');
      setLinkSent(false);
      setVerificationUrl(null);
      setLinkExpiresAt(null);
    }
  }, [isOpen, verificationTiming, signatureUrl, receiverEmail]);

  // Check if verification requirements are met
  const requiresSignature = verificationMode === 'signature' || verificationMode === 'signature_and_scan';
  const requiresScan = verificationMode === 'scan' || verificationMode === 'signature_and_scan';

  const canComplete =
    (!requiresSignature || signatureCaptured) &&
    (!requiresScan || itemsVerified);

  // Handle signature capture
  const handleSignature = async (signatureData: string) => {
    setIsCapturingSignature(true);
    try {
      await onSignatureComplete(signatureData);
      setSignatureCaptured(true);
      toast({
        title: 'Signature captured',
        description: 'The receiver signature has been saved.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save signature. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCapturingSignature(false);
    }
  };

  // Handle sending async link
  const handleSendAsyncLink = async () => {
    if (!asyncEmail) return;

    setIsSendingLink(true);
    try {
      const result = await onSendAsyncLink(asyncEmail);
      setVerificationUrl(result.verification_url);
      setLinkExpiresAt(result.expires_at);
      setLinkSent(true);
      toast({
        title: 'Link sent',
        description: `Verification link sent to ${asyncEmail}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send verification link.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingLink(false);
    }
  };

  // Copy link to clipboard
  const handleCopyLink = () => {
    if (!verificationUrl) return;

    const fullUrl = `${window.location.origin}${verificationUrl}`;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: 'Link copied',
      description: 'Verification link copied to clipboard.',
    });
  };

  // Handle completion
  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to complete verification.',
        variant: 'destructive',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  // Skip receiver verification (proceed without)
  const handleSkip = () => {
    onClose();
  };

  // If verification mode is none, don't show anything
  if (verificationMode === 'none') {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-accent-yellow" />
            Receiver Verification
          </DialogTitle>
          <DialogDescription>
            {receiverName} needs to confirm receipt of {items.length} item{items.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs for same session vs async */}
        {(verificationTiming === 'both' || verificationTiming === 'same_session' || verificationTiming === 'async_link') && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'same_session' | 'async_link')}>
            {verificationTiming === 'both' && (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="same_session">
                  <PenTool className="h-4 w-4 mr-2" />
                  Sign Now
                </TabsTrigger>
                <TabsTrigger value="async_link">
                  <Send className="h-4 w-4 mr-2" />
                  Send Link
                </TabsTrigger>
              </TabsList>
            )}

            {/* Same Session Tab */}
            <TabsContent value="same_session" className="space-y-4">
              {/* Signature Section */}
              {requiresSignature && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <PenTool className="h-4 w-4" />
                    Receiver Signature
                    {signatureCaptured && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </Label>
                  {signatureCaptured ? (
                    <div className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-green-500">Signature captured</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSignatureCaptured(false)}
                      >
                        Re-sign
                      </Button>
                    </div>
                  ) : (
                    <SignaturePad
                      onSignature={handleSignature}
                      signatureUrl={signatureUrl}
                    />
                  )}
                </div>
              )}

              {/* Scan Verification Section */}
              {requiresScan && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <ScanBarcode className="h-4 w-4" />
                    Item Verification
                    {itemsVerified && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </Label>
                  <div
                    className={cn(
                      'p-4 rounded-lg border',
                      itemsVerified
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-muted/30 border-border'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {itemsVerified ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span className="font-medium text-green-500">
                            All {items.length} items verified
                          </span>
                        </>
                      ) : (
                        <>
                          <ScanBarcode className="h-5 w-5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Receiver needs to scan {items.length} items
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Async Link Tab */}
            <TabsContent value="async_link" className="space-y-4">
              {linkSent ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-500">
                        Verification link sent
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      A verification link has been sent to {asyncEmail}. The receiver can complete
                      verification at their convenience.
                    </p>
                  </div>

                  {verificationUrl && (
                    <div className="space-y-2">
                      <Label>Verification Link</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={`${window.location.origin}${verificationUrl}`}
                          readOnly
                          className="flex-1"
                        />
                        <Button variant="outline" size="icon" onClick={handleCopyLink}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {linkExpiresAt && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {new Date(linkExpiresAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="asyncEmail">Receiver Email</Label>
                    <Input
                      id="asyncEmail"
                      type="email"
                      value={asyncEmail}
                      onChange={(e) => setAsyncEmail(e.target.value)}
                      placeholder="Enter receiver's email..."
                    />
                    <p className="text-sm text-muted-foreground">
                      We'll send a verification link to this email. The receiver can complete
                      verification at their convenience.
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSendAsyncLink}
                    disabled={!asyncEmail || isSendingLink}
                  >
                    {isSendingLink ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Verification Link
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleSkip} className="sm:mr-auto">
            Skip for Now
          </Button>
          {activeTab === 'same_session' && (
            <Button
              onClick={handleComplete}
              disabled={!canComplete || isCompleting || isLoading}
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Complete Checkout
                </>
              )}
            </Button>
          )}
          {activeTab === 'async_link' && linkSent && (
            <Button onClick={onClose}>
              <Check className="h-4 w-4 mr-2" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
