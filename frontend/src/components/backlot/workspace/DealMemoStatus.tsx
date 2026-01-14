/**
 * DealMemoStatus - Status indicator and actions for deal memos
 * Includes paperwork tracking workflow for manual status updates
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DealMemo, DealMemoStatus as DealMemoStatusType } from '@/types/backlot';
import {
  FileText,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Edit,
  ExternalLink,
  Upload,
  History,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

interface DealMemoStatusProps {
  dealMemo: DealMemo;
  onSend?: () => void;
  onEdit?: () => void;
  onVoid?: () => void;
  onResend?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onUpdateStatus?: (status: 'sent' | 'viewed' | 'signed' | 'declined', notes?: string, signedDocumentUrl?: string) => Promise<void>;
  compact?: boolean;
  isUpdating?: boolean;
}

const STATUS_CONFIG: Record<
  DealMemoStatusType,
  {
    label: string;
    icon: React.ReactNode;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    color: string;
  }
> = {
  draft: {
    label: 'Draft',
    icon: <FileText className="w-3.5 h-3.5" />,
    variant: 'secondary',
    color: 'text-muted-foreground',
  },
  pending_send: {
    label: 'Pending Send',
    icon: <Clock className="w-3.5 h-3.5" />,
    variant: 'outline',
    color: 'text-yellow-500',
  },
  sent: {
    label: 'Sent',
    icon: <Send className="w-3.5 h-3.5" />,
    variant: 'default',
    color: 'text-blue-500',
  },
  viewed: {
    label: 'Viewed',
    icon: <Eye className="w-3.5 h-3.5" />,
    variant: 'default',
    color: 'text-purple-500',
  },
  signed: {
    label: 'Signed',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    variant: 'default',
    color: 'text-green-500',
  },
  declined: {
    label: 'Declined',
    icon: <XCircle className="w-3.5 h-3.5" />,
    variant: 'destructive',
    color: 'text-red-500',
  },
  voided: {
    label: 'Voided',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    variant: 'outline',
    color: 'text-muted-foreground',
  },
  expired: {
    label: 'Expired',
    icon: <Clock className="w-3.5 h-3.5" />,
    variant: 'outline',
    color: 'text-orange-500',
  },
};

// Status workflow order for paperwork tracking
const STATUS_ORDER: DealMemoStatusType[] = ['draft', 'sent', 'viewed', 'signed'];

export function DealMemoStatus({
  dealMemo,
  onSend,
  onEdit,
  onVoid,
  onResend,
  onDownload,
  onDelete,
  onUpdateStatus,
  compact = false,
  isUpdating = false,
}: DealMemoStatusProps) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<'sent' | 'viewed' | 'signed' | 'declined' | null>(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [signedDocUrl, setSignedDocUrl] = useState('');

  const config = STATUS_CONFIG[dealMemo.status];
  const canEdit = dealMemo.status === 'draft';
  const canSend = dealMemo.status === 'draft' || dealMemo.status === 'pending_send';
  const canResend = dealMemo.status === 'declined' || dealMemo.status === 'expired';
  const canVoid = dealMemo.status === 'sent' || dealMemo.status === 'viewed';
  const canDownload = dealMemo.status === 'signed' && dealMemo.signed_document_url;
  const canDelete = dealMemo.status === 'draft';

  // Paperwork tracking - determine next available status
  const getNextStatus = (): 'sent' | 'viewed' | 'signed' | null => {
    const currentIndex = STATUS_ORDER.indexOf(dealMemo.status);
    if (currentIndex === -1 || currentIndex >= STATUS_ORDER.length - 1) return null;
    const next = STATUS_ORDER[currentIndex + 1];
    if (next === 'draft') return null;
    return next as 'sent' | 'viewed' | 'signed';
  };

  const nextStatus = getNextStatus();

  // Format rate for display
  const formatRate = () => {
    const amount = dealMemo.rate_amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    const typeLabel = {
      hourly: '/hr',
      daily: '/day',
      weekly: '/week',
      flat: ' flat',
    }[dealMemo.rate_type];
    return `${amount}${typeLabel}`;
  };

  // Get time info based on status
  const getTimeInfo = () => {
    if (dealMemo.docusign_signed_at) {
      return `Signed ${formatDistanceToNow(new Date(dealMemo.docusign_signed_at), { addSuffix: true })}`;
    }
    if (dealMemo.docusign_sent_at) {
      return `Sent ${formatDistanceToNow(new Date(dealMemo.docusign_sent_at), { addSuffix: true })}`;
    }
    return `Created ${formatDistanceToNow(new Date(dealMemo.created_at), { addSuffix: true })}`;
  };

  const handleOpenStatusDialog = (status: 'sent' | 'viewed' | 'signed' | 'declined') => {
    setPendingStatus(status);
    setStatusNotes('');
    setSignedDocUrl('');
    setStatusDialogOpen(true);
  };

  const handleConfirmStatus = async () => {
    if (!pendingStatus || !onUpdateStatus) return;
    await onUpdateStatus(pendingStatus, statusNotes || undefined, signedDocUrl || undefined);
    setStatusDialogOpen(false);
    setPendingStatus(null);
    setStatusNotes('');
    setSignedDocUrl('');
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className="gap-1 cursor-default">
              {config.icon}
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-medium">{dealMemo.position_title}</p>
              <p className="text-muted-foreground">{formatRate()}</p>
              <p className="text-xs text-muted-foreground mt-1">{getTimeInfo()}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-card border rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-muted ${config.color}`}>
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{dealMemo.position_title}</span>
              <Badge variant={config.variant} className="text-xs">
                {config.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatRate()}</span>
              <span>•</span>
              <span>{getTimeInfo()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Primary action based on status */}
          {canSend && onSend && (
            <Button size="sm" onClick={onSend} disabled={isUpdating}>
              <Send className="w-4 h-4 mr-1" />
              Send for Signature
            </Button>
          )}

          {/* Paperwork tracking - next status action */}
          {nextStatus && onUpdateStatus && !canSend && (
            <Button
              size="sm"
              onClick={() => handleOpenStatusDialog(nextStatus)}
              disabled={isUpdating}
            >
              {nextStatus === 'sent' && <Send className="w-4 h-4 mr-1" />}
              {nextStatus === 'viewed' && <Eye className="w-4 h-4 mr-1" />}
              {nextStatus === 'signed' && <CheckCircle2 className="w-4 h-4 mr-1" />}
              Mark as {nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1)}
            </Button>
          )}

          {canResend && onResend && (
            <Button size="sm" variant="outline" onClick={onResend} disabled={isUpdating}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Resend
            </Button>
          )}
          {canDownload && onDownload && (
            <Button size="sm" variant="outline" onClick={onDownload}>
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          )}

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" disabled={isUpdating}>
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Draft
                </DropdownMenuItem>
              )}

              {/* Paperwork tracking status options */}
              {onUpdateStatus && dealMemo.status !== 'signed' && dealMemo.status !== 'declined' && dealMemo.status !== 'voided' && (
                <>
                  <DropdownMenuSeparator />
                  {dealMemo.status === 'draft' && (
                    <DropdownMenuItem onClick={() => handleOpenStatusDialog('sent')}>
                      <Send className="w-4 h-4 mr-2" />
                      Mark as Sent
                    </DropdownMenuItem>
                  )}
                  {(dealMemo.status === 'draft' || dealMemo.status === 'sent') && (
                    <DropdownMenuItem onClick={() => handleOpenStatusDialog('viewed')}>
                      <Eye className="w-4 h-4 mr-2" />
                      Mark as Viewed
                    </DropdownMenuItem>
                  )}
                  {(dealMemo.status === 'sent' || dealMemo.status === 'viewed') && (
                    <DropdownMenuItem onClick={() => handleOpenStatusDialog('signed')}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark as Signed
                    </DropdownMenuItem>
                  )}
                  {(dealMemo.status === 'sent' || dealMemo.status === 'viewed') && (
                    <DropdownMenuItem onClick={() => handleOpenStatusDialog('declined')} className="text-destructive">
                      <XCircle className="w-4 h-4 mr-2" />
                      Mark as Declined
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {dealMemo.docusign_envelope_id && (
                <DropdownMenuItem
                  onClick={() =>
                    window.open(
                      `https://app.docusign.com/documents/details/${dealMemo.docusign_envelope_id}`,
                      '_blank'
                    )
                  }
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View in DocuSign
                </DropdownMenuItem>
              )}
              {canVoid && onVoid && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onVoid} className="text-destructive">
                    <XCircle className="w-4 h-4 mr-2" />
                    Void Envelope
                  </DropdownMenuItem>
                </>
              )}
              {canDelete && onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Draft
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Update Deal Memo Status
            </DialogTitle>
            <DialogDescription>
              {pendingStatus === 'sent' && 'Mark this deal memo as sent to the recipient.'}
              {pendingStatus === 'viewed' && 'Mark this deal memo as viewed by the recipient.'}
              {pendingStatus === 'signed' && 'Mark this deal memo as signed. This will create a crew rate entry.'}
              {pendingStatus === 'declined' && 'Mark this deal memo as declined by the recipient.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {pendingStatus === 'signed' && (
              <div className="space-y-2">
                <Label htmlFor="signed_doc_url">Signed Document URL (optional)</Label>
                <Input
                  id="signed_doc_url"
                  placeholder="https://..."
                  value={signedDocUrl}
                  onChange={(e) => setSignedDocUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Link to the signed document if available
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="status_notes">Notes (optional)</Label>
              <Textarea
                id="status_notes"
                placeholder="Add any notes about this status change..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmStatus} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : `Mark as ${pendingStatus?.charAt(0).toUpperCase()}${pendingStatus?.slice(1)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Mini status badge for inline use
 */
interface DealMemoStatusBadgeProps {
  status: DealMemoStatusType;
  className?: string;
}

export function DealMemoStatusBadge({ status, className }: DealMemoStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={`gap-1 ${className || ''}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

/**
 * Summary card showing deal memo overview
 */
interface DealMemoSummaryProps {
  dealMemo: DealMemo;
  onClick?: () => void;
}

export function DealMemoSummary({ dealMemo, onClick }: DealMemoSummaryProps) {
  const config = STATUS_CONFIG[dealMemo.status];

  // Format rate
  const formatRate = () => {
    const amount = dealMemo.rate_amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    });
    return amount;
  };

  // Calculate total with allowances
  const calculateDailyTotal = () => {
    let total = dealMemo.rate_type === 'daily' ? dealMemo.rate_amount : 0;
    if (dealMemo.kit_rental_rate) total += dealMemo.kit_rental_rate;
    if (dealMemo.car_allowance) total += dealMemo.car_allowance;
    if (dealMemo.phone_allowance) total += dealMemo.phone_allowance;
    if (dealMemo.per_diem_rate) total += dealMemo.per_diem_rate;
    return total;
  };

  return (
    <div
      className={`p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium">{dealMemo.position_title}</h4>
          {dealMemo.user && (
            <p className="text-sm text-muted-foreground">
              {dealMemo.user.display_name}
            </p>
          )}
        </div>
        <DealMemoStatusBadge status={dealMemo.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Rate:</span>{' '}
          <span className="font-medium">{formatRate()}/{dealMemo.rate_type}</span>
        </div>
        {dealMemo.rate_type === 'daily' && calculateDailyTotal() > dealMemo.rate_amount && (
          <div>
            <span className="text-muted-foreground">Daily Total:</span>{' '}
            <span className="font-medium">
              {calculateDailyTotal().toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
              })}
            </span>
          </div>
        )}
        {dealMemo.start_date && (
          <div>
            <span className="text-muted-foreground">Start:</span>{' '}
            <span>{parseLocalDate(dealMemo.start_date).toLocaleDateString()}</span>
          </div>
        )}
        {dealMemo.end_date && (
          <div>
            <span className="text-muted-foreground">End:</span>{' '}
            <span>{parseLocalDate(dealMemo.end_date).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Allowances row */}
      {(dealMemo.kit_rental_rate || dealMemo.car_allowance || dealMemo.phone_allowance || dealMemo.per_diem_rate) && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
          {dealMemo.kit_rental_rate && (
            <Badge variant="outline" className="text-xs">
              Kit: ${dealMemo.kit_rental_rate}
            </Badge>
          )}
          {dealMemo.car_allowance && (
            <Badge variant="outline" className="text-xs">
              Car: ${dealMemo.car_allowance}
            </Badge>
          )}
          {dealMemo.phone_allowance && (
            <Badge variant="outline" className="text-xs">
              Phone: ${dealMemo.phone_allowance}
            </Badge>
          )}
          {dealMemo.per_diem_rate && (
            <Badge variant="outline" className="text-xs">
              Per Diem: ${dealMemo.per_diem_rate}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Workflow stepper showing progress through deal memo statuses
 */
interface DealMemoWorkflowProps {
  dealMemo: DealMemo;
  onUpdateStatus?: (status: 'sent' | 'viewed' | 'signed' | 'declined', notes?: string, signedDocumentUrl?: string) => Promise<void>;
  isUpdating?: boolean;
}

export function DealMemoWorkflow({ dealMemo, onUpdateStatus, isUpdating }: DealMemoWorkflowProps) {
  const steps: { status: DealMemoStatusType; label: string; icon: React.ReactNode }[] = [
    { status: 'draft', label: 'Draft', icon: <FileText className="w-4 h-4" /> },
    { status: 'sent', label: 'Sent', icon: <Send className="w-4 h-4" /> },
    { status: 'viewed', label: 'Viewed', icon: <Eye className="w-4 h-4" /> },
    { status: 'signed', label: 'Signed', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const currentIndex = steps.findIndex(s => s.status === dealMemo.status);
  const isDeclined = dealMemo.status === 'declined';
  const isVoided = dealMemo.status === 'voided';
  const isExpired = dealMemo.status === 'expired';

  if (isDeclined || isVoided || isExpired) {
    const config = STATUS_CONFIG[dealMemo.status];
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
        <div className={`p-2 rounded-full bg-destructive/20 ${config.color}`}>
          {config.icon}
        </div>
        <div>
          <span className="font-medium">{config.label}</span>
          <p className="text-xs text-muted-foreground">
            {isDeclined && 'The recipient declined this deal memo.'}
            {isVoided && 'This deal memo was voided.'}
            {isExpired && 'This deal memo has expired.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isNext = index === currentIndex + 1;
        const isPast = index < currentIndex;

        return (
          <div key={step.status} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : step.icon}
              </div>
              <span
                className={`mt-2 text-xs font-medium ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </span>

              {/* Action button for next step */}
              {isNext && onUpdateStatus && step.status !== 'draft' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 text-xs h-7"
                  onClick={() => onUpdateStatus(step.status as 'sent' | 'viewed' | 'signed')}
                  disabled={isUpdating}
                >
                  Mark {step.label}
                </Button>
              )}
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`h-0.5 w-12 mx-2 transition-colors ${
                  isPast ? 'bg-green-500' : 'bg-muted'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Status history timeline
 */
interface StatusHistoryEntry {
  id: string;
  deal_memo_id: string;
  status: string;
  changed_by: string;
  changed_by_name?: string;
  notes?: string;
  created_at: string;
}

interface DealMemoHistoryProps {
  history: StatusHistoryEntry[];
  isLoading?: boolean;
}

export function DealMemoHistory({ history, isLoading }: DealMemoHistoryProps) {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No status changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {history.map((entry, index) => {
        const config = STATUS_CONFIG[entry.status as DealMemoStatusType] || {
          label: entry.status,
          icon: <Clock className="w-3.5 h-3.5" />,
          color: 'text-muted-foreground',
        };

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={`p-1.5 rounded-full bg-muted ${config.color}`}>
                {config.icon}
              </div>
              {index < history.length - 1 && (
                <div className="w-px h-full bg-border min-h-[24px]" />
              )}
            </div>

            {/* Content */}
            <div className="pb-4">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{config.label}</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              {entry.changed_by_name && (
                <p className="text-xs text-muted-foreground">
                  by {entry.changed_by_name}
                </p>
              )}
              {entry.notes && (
                <p className="text-sm mt-1 text-muted-foreground italic">
                  "{entry.notes}"
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
