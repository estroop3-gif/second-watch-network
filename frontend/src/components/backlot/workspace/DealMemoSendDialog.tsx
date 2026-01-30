/**
 * DealMemoSendDialog - Confirmation dialog for sending a deal memo for signature
 * Shows PDF preview, confirms recipient, optional message
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, FileText, Eye, User, Mail } from 'lucide-react';
import { DealMemoPDFPreview } from './DealMemoPDFPreview';
import { toast } from 'sonner';
import type { DealMemo } from '@/types/backlot';

interface DealMemoSendDialogProps {
  open: boolean;
  onClose: () => void;
  dealMemo: DealMemo;
  pdfUrl: string | null;
  onSend: (input: { signer_email?: string; signer_name?: string; message?: string }) => Promise<void>;
  onGeneratePdf?: () => Promise<void>;
  isGeneratingPdf?: boolean;
}

export function DealMemoSendDialog({
  open,
  onClose,
  dealMemo,
  pdfUrl,
  onSend,
  onGeneratePdf,
  isGeneratingPdf,
}: DealMemoSendDialogProps) {
  const [signerEmail, setSignerEmail] = useState(dealMemo.signer_email || '');
  const [signerName, setSignerName] = useState(dealMemo.signer_name || dealMemo.user?.display_name || dealMemo.user?.full_name || '');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend({
        signer_email: signerEmail || undefined,
        signer_name: signerName || undefined,
        message: message || undefined,
      });
      toast.success('Deal memo sent for signature');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send deal memo');
    } finally {
      setSending(false);
    }
  };

  const formatRate = () => {
    const amount = dealMemo.rate_amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const suffix = { hourly: '/hr', daily: '/day', weekly: '/wk', flat: ' flat' }[dealMemo.rate_type];
    return `${amount}${suffix}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Deal Memo for Signature</DialogTitle>
          <DialogDescription>
            Review and send this deal memo. The recipient will receive a link to review and sign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Deal memo summary */}
          <div className="p-3 bg-muted/30 rounded-lg space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{dealMemo.position_title}</span>
              <Badge variant="outline">{formatRate()}</Badge>
            </div>
            {dealMemo.user && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                {dealMemo.user.display_name || dealMemo.user.full_name}
              </div>
            )}
          </div>

          {/* PDF Preview button */}
          <div className="flex items-center gap-2">
            {pdfUrl ? (
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="w-4 h-4 mr-1.5" />
                {showPreview ? 'Hide' : 'Preview'} PDF
              </Button>
            ) : onGeneratePdf ? (
              <Button variant="outline" size="sm" onClick={onGeneratePdf} disabled={isGeneratingPdf}>
                {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
                Generate PDF
              </Button>
            ) : null}
          </div>

          {showPreview && pdfUrl && (
            <DealMemoPDFPreview pdfUrl={pdfUrl} inline height={300} />
          )}

          {/* Recipient info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="signer_name">Signer Name</Label>
              <Input
                id="signer_name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Full name of the signer"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signer_email">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email (optional)
                </div>
              </Label>
              <Input
                id="signer_email"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="Email to send signing link"
              />
              <p className="text-xs text-muted-foreground">
                If provided, an email with the signing link will be sent. Otherwise, only an in-app notification is sent.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal message..."
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-1.5" />
            )}
            Send for Signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
