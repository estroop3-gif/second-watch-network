/**
 * ClearanceSendModal - Send clearance document to recipients via email
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Send,
  Link,
  Paperclip,
  Mail,
  User,
  Building,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useSendClearance, useClearanceRecipients } from '@/hooks/backlot';
import { ClearanceRecipient, ClearanceSendType } from '@/types/backlot';

interface ClearanceSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clearanceId: string;
  clearanceTitle: string;
}

export default function ClearanceSendModal({
  open,
  onOpenChange,
  clearanceId,
  clearanceTitle,
}: ClearanceSendModalProps) {
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [sendType, setSendType] = useState<ClearanceSendType>('link');
  const [message, setMessage] = useState('');
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
    errorDetails?: { email: string; error: string }[];
  } | null>(null);

  const { recipients, isLoading } = useClearanceRecipients(clearanceId);
  const sendMutation = useSendClearance();

  const recipientsWithEmail = recipients.filter(r => r.email);

  // Auto-select all recipients when they load
  useEffect(() => {
    if (open && recipientsWithEmail.length > 0 && selectedRecipientIds.length === 0) {
      setSelectedRecipientIds(recipientsWithEmail.map(r => r.id));
    }
  }, [open, recipientsWithEmail.length]);

  const handleSelectAll = () => {
    if (selectedRecipientIds.length === recipientsWithEmail.length) {
      setSelectedRecipientIds([]);
    } else {
      setSelectedRecipientIds(recipientsWithEmail.map(r => r.id));
    }
  };

  const handleToggleRecipient = (recipientId: string) => {
    setSelectedRecipientIds(prev =>
      prev.includes(recipientId)
        ? prev.filter(id => id !== recipientId)
        : [...prev, recipientId]
    );
  };

  const handleSend = async () => {
    if (selectedRecipientIds.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }

    try {
      const result = await sendMutation.mutateAsync({
        clearanceId,
        request: {
          recipient_ids: selectedRecipientIds,
          send_type: sendType,
          message: message || undefined,
        },
      });

      setSendResult({
        sent: result.emails_sent,
        failed: result.emails_failed,
        errorDetails: result.error_details || undefined,
      });

      if (result.emails_sent > 0 && result.emails_failed === 0) {
        toast.success(`Document sent to ${result.emails_sent} recipient(s)`);
      } else if (result.emails_failed > 0 && result.emails_sent > 0) {
        toast.warning(`${result.emails_sent} sent, ${result.emails_failed} failed`);
      } else if (result.emails_failed > 0 && result.emails_sent === 0) {
        toast.error('Failed to send emails. Check error details.');
      }
    } catch (error) {
      setSendResult({
        sent: 0,
        failed: selectedRecipientIds.length,
        errorDetails: [{ email: '', error: error instanceof Error ? error.message : 'Failed to send' }],
      });
      toast.error(error instanceof Error ? error.message : 'Failed to send');
    }
  };

  const handleClose = () => {
    setSelectedRecipientIds([]);
    setMessage('');
    setSendResult(null);
    onOpenChange(false);
  };

  const getRecipientIcon = (recipient: ClearanceRecipient) => {
    if (recipient.recipient_type === 'contact') {
      return <Building className="h-4 w-4 text-blue-400" />;
    } else if (recipient.recipient_type === 'member') {
      return <User className="h-4 w-4 text-green-400" />;
    }
    return <Mail className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Send className="h-5 w-5 text-accent-yellow" />
            Send Document
          </DialogTitle>
          <DialogDescription>
            Send "{clearanceTitle}" to selected recipients
          </DialogDescription>
        </DialogHeader>

        {sendResult ? (
          // Results View
          <div className="py-6 text-center space-y-4">
            {sendResult.failed === 0 ? (
              <>
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                <div>
                  <p className="text-lg font-medium text-bone-white">
                    Successfully sent!
                  </p>
                  <p className="text-muted-foreground">
                    Document sent to {sendResult.sent} recipient(s)
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-16 w-16 mx-auto text-red-500" />
                <div>
                  <p className="text-lg font-medium text-bone-white">
                    {sendResult.sent > 0 ? 'Partially sent' : 'Send failed'}
                  </p>
                  <p className="text-muted-foreground">
                    {sendResult.sent > 0
                      ? `${sendResult.sent} sent, ${sendResult.failed} failed`
                      : `Failed to send to ${sendResult.failed} recipient(s)`}
                  </p>
                </div>
                {sendResult.errorDetails && sendResult.errorDetails.length > 0 && (
                  <div className="mt-3 text-left bg-red-500/10 border border-red-500/30 rounded-lg p-3 max-h-[120px] overflow-y-auto">
                    <p className="text-xs font-medium text-red-400 mb-1">Error details:</p>
                    {sendResult.errorDetails.map((detail, i) => (
                      <p key={i} className="text-xs text-red-300/80">
                        {detail.email ? `${detail.email}: ` : ''}{detail.error}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-center gap-3 mt-4">
              {sendResult.failed > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setSendResult(null)}
                  className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10"
                >
                  Try Again
                </Button>
              )}
              <Button onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          // Send Form
          <>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recipientsWithEmail.length === 0 ? (
              <div className="py-8 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  No recipients with email addresses
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recipients Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Select Recipients</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-auto py-1 px-2 text-xs"
                    >
                      {selectedRecipientIds.length === recipientsWithEmail.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </Button>
                  </div>

                  <ScrollArea className="h-[150px] border border-muted-gray/30 rounded-lg p-2">
                    <div className="space-y-2">
                      {recipientsWithEmail.map((recipient) => (
                        <label
                          key={recipient.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted-gray/10 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedRecipientIds.includes(recipient.id)}
                            onCheckedChange={() => handleToggleRecipient(recipient.id)}
                          />
                          <div className="flex items-center gap-2 min-w-0">
                            {getRecipientIcon(recipient)}
                            <div className="min-w-0">
                              <p className="text-sm text-bone-white truncate">
                                {recipient.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {recipient.email}
                              </p>
                            </div>
                          </div>
                          {recipient.requires_signature && (
                            <span className="ml-auto text-xs text-yellow-500">
                              Signature required
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedRecipientIds.length} of {recipientsWithEmail.length} selected
                  </p>
                </div>

                {/* Send Type */}
                <div className="space-y-2">
                  <Label>How to send</Label>
                  <RadioGroup
                    value={sendType}
                    onValueChange={(v) => setSendType(v as ClearanceSendType)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <label
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sendType === 'link'
                          ? 'border-primary-red bg-primary-red/10'
                          : 'border-muted-gray/30 hover:border-muted-gray/50'
                      }`}
                    >
                      <RadioGroupItem value="link" id="link" className="sr-only" />
                      <Link className="h-5 w-5 text-primary-red" />
                      <div>
                        <p className="text-sm font-medium text-bone-white">Send Link</p>
                        <p className="text-xs text-muted-foreground">View in browser</p>
                      </div>
                    </label>

                    <label
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        sendType === 'pdf_attachment'
                          ? 'border-primary-red bg-primary-red/10'
                          : 'border-muted-gray/30 hover:border-muted-gray/50'
                      }`}
                    >
                      <RadioGroupItem value="pdf_attachment" id="pdf_attachment" className="sr-only" />
                      <Paperclip className="h-5 w-5 text-primary-red" />
                      <div>
                        <p className="text-sm font-medium text-bone-white">Attach PDF</p>
                        <p className="text-xs text-muted-foreground">Include document</p>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                {/* Optional Message */}
                <div className="space-y-2">
                  <Label htmlFor="message">Message (optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Add a personal message to include in the email..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="bg-muted-gray/10 border-muted-gray/30 min-h-[80px]"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={sendMutation.isPending || selectedRecipientIds.length === 0}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {sendMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to {selectedRecipientIds.length} Recipient(s)
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
