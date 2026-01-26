/**
 * ReportMessageDialog
 * Dialog for reporting a message
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Flag, Loader2, CheckCircle } from 'lucide-react';
import { useReportMessage, MessageReportCreate } from '@/hooks/useMessageSettings';
import { useToast } from '@/hooks/use-toast';

interface ReportMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  messageContent: string;
  messageSenderId: string;
  conversationId?: string;
  onReported?: () => void;
}

type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: 'spam',
    label: 'Spam',
    description: 'Unwanted promotional content or repeated messages',
  },
  {
    value: 'harassment',
    label: 'Harassment',
    description: 'Bullying, threats, or targeted attacks',
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Sexual content, violence, or hate speech',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else that violates our guidelines',
  },
];

export function ReportMessageDialog({
  isOpen,
  onClose,
  messageId,
  messageContent,
  messageSenderId,
  conversationId,
  onReported,
}: ReportMessageDialogProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [description, setDescription] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const reportMessage = useReportMessage();
  const { toast } = useToast();

  const handleReport = async () => {
    if (!reason) return;

    try {
      await reportMessage.mutateAsync({
        message_id: messageId,
        message_content: messageContent,
        message_sender_id: messageSenderId,
        conversation_id: conversationId,
        reason,
        description: description.trim() || undefined,
      });

      setIsSuccess(true);
      onReported?.();

      // Auto-close after success
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error: any) {
      toast({
        title: 'Failed to submit report',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setReason('');
    setDescription('');
    setIsSuccess(false);
    onClose();
  };

  if (isSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[425px] bg-charcoal-black border-muted-gray text-bone-white">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-900/30 p-4 mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Report Submitted</h3>
            <p className="text-muted-foreground text-sm">
              Thank you for reporting. Our moderation team will review this message.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            Report Message
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Help us understand what's wrong with this message
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Message preview */}
          <div className="p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
            <p className="text-sm text-muted-foreground mb-1">Message being reported:</p>
            <p className="text-sm line-clamp-3">{messageContent}</p>
          </div>

          {/* Reason selection */}
          <div className="space-y-3">
            <Label>Why are you reporting this message?</Label>
            <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              {REPORT_REASONS.map((r) => (
                <div
                  key={r.value}
                  className="flex items-start space-x-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30 hover:bg-muted-gray/20 transition-colors cursor-pointer"
                  onClick={() => setReason(r.value)}
                >
                  <RadioGroupItem value={r.value} id={r.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={r.value} className="cursor-pointer font-medium">
                      {r.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Additional details */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Additional details (optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any additional context that might help our review..."
              className="bg-muted-gray/20 border-muted-gray resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={reportMessage.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReport}
            disabled={!reason || reportMessage.isPending}
          >
            {reportMessage.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="h-4 w-4 mr-2" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
