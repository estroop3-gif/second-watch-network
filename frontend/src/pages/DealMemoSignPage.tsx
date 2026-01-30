/**
 * DealMemoSignPage - Public signing portal at /deal-memo/sign/:token
 * Pattern follows ClearanceViewPage.tsx - No auth required
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  Calendar,
  Clock,
  Briefcase,
} from 'lucide-react';
import { SignaturePad, SignatureType } from '@/components/backlot/workspace/SignaturePad';
import { DealMemoPDFPreview } from '@/components/backlot/workspace/DealMemoPDFPreview';
import { useDealMemoSigningData, useSignDealMemo } from '@/hooks/backlot/useDealMemoPDF';

export default function DealMemoSignPage() {
  const { token } = useParams<{ token: string }>();
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<SignatureType>('draw');
  const [signed, setSigned] = useState(false);

  const { data, isLoading, error } = useDealMemoSigningData(token);
  const signMutation = useSignDealMemo();

  const handleSignatureChange = (data: string | null, type: SignatureType) => {
    setSignatureData(data);
    setSignatureType(type);
  };

  const handleSign = async () => {
    if (!signatureData || !token) return;

    try {
      await signMutation.mutateAsync({
        token,
        signatureData,
        signatureType,
        signerName: data?.signer_name,
      });
      setSigned(true);
      toast.success('Deal memo signed successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-yellow mx-auto mb-4" />
          <p className="text-bone-white">Loading deal memo...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Unable to Load</h2>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'Invalid or expired signing link'}
            </p>
            <Link to="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already signed
  if (data?.already_signed || signed) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {signed ? 'Signed Successfully' : 'Already Signed'}
            </h2>
            <p className="text-muted-foreground mb-4">
              {signed
                ? 'Your signature has been recorded. The producer will be notified.'
                : `This deal memo was already signed${data?.signed_at ? ` on ${new Date(data.signed_at).toLocaleDateString()}` : ''}.`
              }
            </p>
            <Link to="/">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const memo = data?.deal_memo;
  if (!memo) return null;

  const formatRate = () => {
    const amount = Number(memo.rate_amount).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const suffix: Record<string, string> = { hourly: '/hr', daily: '/day', weekly: '/wk', flat: ' flat' };
    return `${amount}${suffix[memo.rate_type] || ''}`;
  };

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-accent-yellow" />
            <div>
              <h1 className="text-lg font-semibold">Deal Memo</h1>
              <p className="text-sm text-muted-foreground">{data?.project_title}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Deal memo summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              {memo.position_title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Rate</p>
                <p className="font-semibold text-lg">{formatRate()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">OT / DT</p>
                <p className="font-medium">
                  {memo.overtime_multiplier}x / {memo.double_time_multiplier}x
                </p>
              </div>
            </div>

            {/* Allowances */}
            {(memo.kit_rental_rate || memo.car_allowance || memo.phone_allowance || memo.per_diem_rate) && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Allowances</p>
                  <div className="flex flex-wrap gap-2">
                    {memo.kit_rental_rate && <Badge variant="outline">Kit: ${memo.kit_rental_rate}</Badge>}
                    {memo.car_allowance && <Badge variant="outline">Car: ${memo.car_allowance}</Badge>}
                    {memo.phone_allowance && <Badge variant="outline">Phone: ${memo.phone_allowance}</Badge>}
                    {memo.per_diem_rate && <Badge variant="outline">Per Diem: ${memo.per_diem_rate}</Badge>}
                  </div>
                </div>
              </>
            )}

            {/* Dates */}
            {(memo.start_date || memo.end_date) && (
              <>
                <Separator />
                <div className="flex gap-6">
                  {memo.start_date && (
                    <div>
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="font-medium">{new Date(memo.start_date).toLocaleDateString()}</p>
                    </div>
                  )}
                  {memo.end_date && (
                    <div>
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="font-medium">{new Date(memo.end_date).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Talent-specific fields */}
            {memo.template_type === 'talent' && memo.performer_category && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Performer Category</p>
                  <p className="font-medium">{memo.performer_category}</p>
                </div>
              </>
            )}

            {/* Additional terms */}
            {memo.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{memo.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* PDF Preview */}
        {data?.pdf_url && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Full Document</CardTitle>
            </CardHeader>
            <CardContent>
              <DealMemoPDFPreview pdfUrl={data.pdf_url} inline height={500} />
            </CardContent>
          </Card>
        )}

        {/* Signature */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign Below</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              By signing below, you agree to the terms outlined in this deal memo.
            </p>

            <SignaturePad
              onSignatureChange={handleSignatureChange}
              signerName={data?.signer_name || ''}
            />

            <Button
              className="w-full"
              size="lg"
              onClick={handleSign}
              disabled={!signatureData || signMutation.isPending}
            >
              {signMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Sign Deal Memo
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your signature will be legally binding. An electronic record of your signature,
              IP address, and timestamp will be stored.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
