/**
 * ClearanceViewPage - Public page for viewing and signing clearance documents
 * No authentication required - uses access token from URL
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Pen,
  Clock,
  Calendar,
  X,
  RotateCcw,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/dateUtils';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ClearanceViewData {
  clearance: {
    id: string;
    title: string;
    type: string;
    description: string | null;
    file_url: string | null;
    file_name: string | null;
    expiration_date: string | null;
  };
  project_title: string;
  recipient: {
    id: string;
    requires_signature: boolean;
    signature_status: string;
    signed_at: string | null;
    viewed_at: string | null;
  };
}

const TYPE_LABELS: Record<string, string> = {
  talent_release: 'Talent Release',
  appearance_release: 'Appearance Release',
  location_release: 'Location Release',
  music_license: 'Music License',
  stock_license: 'Stock License',
  nda: 'NDA',
  other_contract: 'Document',
};

export default function ClearanceViewPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ClearanceViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureComplete, setSignatureComplete] = useState(false);

  // Signature canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid link');
      setLoading(false);
      return;
    }

    fetchClearance();
  }, [token]);

  const fetchClearance = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/backlot/clearances/view/${token}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to load document' }));
        throw new Error(errorData.detail);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    isDrawing.current = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSign = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check if canvas has any content
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasSignature = imageData.data.some((pixel, index) => index % 4 === 3 && pixel > 0);

    if (!hasSignature) {
      toast.error('Please draw your signature');
      return;
    }

    setSigning(true);

    try {
      // Get signature as base64
      const signatureData = canvas.toDataURL('image/png').split(',')[1];

      const response = await fetch(`${API_BASE}/api/v1/backlot/clearances/sign/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data: signatureData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to sign document' }));
        throw new Error(errorData.detail);
      }

      setSignatureComplete(true);
      setShowSignature(false);
      toast.success('Document signed successfully');

      // Refresh data
      await fetchClearance();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-red" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-charcoal-black border-muted-gray/30">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
            <h2 className="text-xl font-bold text-bone-white mb-2">Unable to Load Document</h2>
            <p className="text-muted-foreground">{error}</p>
            <Link to="/">
              <Button variant="outline" className="mt-6">
                Go to Homepage
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { clearance, project_title, recipient } = data;
  const typeLabel = TYPE_LABELS[clearance.type] || 'Document';
  const isSigned = recipient.signature_status === 'signed';
  const needsSignature = recipient.requires_signature && !isSigned;

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <header className="bg-charcoal-black border-b border-muted-gray/30 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-bone-white">{clearance.title}</h1>
            <p className="text-sm text-muted-foreground">{project_title}</p>
          </div>
          <Badge variant="outline" className="text-primary-red border-primary-red/30">
            {typeLabel}
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Status Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                {isSigned ? (
                  <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                ) : needsSignature ? (
                  <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Pen className="h-6 w-6 text-yellow-500" />
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-blue-500" />
                  </div>
                )}

                <div>
                  <p className="font-medium text-bone-white">
                    {isSigned
                      ? 'Document Signed'
                      : needsSignature
                      ? 'Signature Required'
                      : 'Document for Review'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isSigned && recipient.signed_at
                      ? `Signed on ${formatDate(recipient.signed_at, 'PPP')}`
                      : needsSignature
                      ? 'Please review and sign below'
                      : 'View the document below'}
                  </p>
                </div>
              </div>

              {clearance.expiration_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Expires {formatDate(clearance.expiration_date, 'PPP')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Viewer */}
        {clearance.file_url && (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-bone-white text-base">Document</CardTitle>
              <a href={clearance.file_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </a>
            </CardHeader>
            <CardContent>
              <div className="bg-muted-gray/10 rounded-lg overflow-hidden">
                {clearance.file_url.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={`${clearance.file_url}#toolbar=0`}
                    className="w-full h-[600px]"
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={clearance.file_url}
                    alt="Document"
                    className="w-full max-h-[600px] object-contain"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        {clearance.description && (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardHeader>
              <CardTitle className="text-bone-white text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{clearance.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Signature Section */}
        {needsSignature && !showSignature && (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="py-8 text-center">
              <Pen className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">
                Your Signature is Required
              </h3>
              <p className="text-muted-foreground mb-6">
                Please review the document above, then click below to add your signature.
              </p>
              <Button
                onClick={() => setShowSignature(true)}
                className="bg-primary-red hover:bg-primary-red/90"
              >
                <Pen className="h-4 w-4 mr-2" />
                Sign Document
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Signature Pad */}
        {showSignature && (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-bone-white text-base">Draw Your Signature</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSignature(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white rounded-lg p-2">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full border border-gray-200 rounded cursor-crosshair touch-none"
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
                <Button
                  variant="outline"
                  onClick={clearSignature}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear
                </Button>

                <Button
                  onClick={handleSign}
                  disabled={signing}
                  className="bg-primary-red hover:bg-primary-red/90"
                >
                  {signing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Submit Signature
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                By signing, you acknowledge that you have reviewed and agree to the terms of this document.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Signed Confirmation */}
        {isSigned && (
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-medium text-green-400 mb-2">
                Thank You!
              </h3>
              <p className="text-muted-foreground">
                This document has been signed successfully.
                {recipient.signed_at && (
                  <span className="block mt-1">
                    Signed on {formatDateTime(recipient.signed_at, "PPP 'at' p")}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-muted-gray/30 py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Second Watch Network</p>
        </div>
      </footer>
    </div>
  );
}
