/**
 * ExtensionResponseDialog.tsx
 * Dialog for rental houses to approve or deny extension requests
 */
import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Check,
  X,
  CalendarPlus,
  ArrowRight,
  Loader2,
  DollarSign,
  AlertCircle,
  User,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { usePendingExtensions } from '@/hooks/gear/useGearMarketplace';
import type { GearRentalExtension } from '@/types/gear';

interface ExtensionResponseDialogProps {
  extension: GearRentalExtension | null;
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  onResponded: () => void;
}

export function ExtensionResponseDialog({
  extension,
  orgId,
  isOpen,
  onClose,
  onResponded,
}: ExtensionResponseDialogProps) {
  const [mode, setMode] = useState<'view' | 'approve' | 'deny'>('view');
  const [approvedEndDate, setApprovedEndDate] = useState('');
  const [additionalAmount, setAdditionalAmount] = useState('');
  const [denialReason, setDenialReason] = useState('');

  const { approveExtension, denyExtension } = usePendingExtensions(orgId);
  const isApproving = approveExtension.isPending;
  const isDenying = denyExtension.isPending;

  // Reset state when extension changes
  React.useEffect(() => {
    if (extension) {
      setApprovedEndDate(extension.requested_end_date || '');
      setAdditionalAmount('');
      setDenialReason('');
      setMode('view');
    }
  }, [extension]);

  if (!extension) return null;

  // Calculate dates
  const originalEndDate = extension.original_end_date
    ? parseISO(extension.original_end_date)
    : null;
  const requestedEndDate = extension.requested_end_date
    ? parseISO(extension.requested_end_date)
    : null;

  const handleApprove = () => {
    approveExtension.mutate(
      {
        extensionId: extension.id,
        input: {
          approved_end_date: approvedEndDate,
          additional_amount: additionalAmount ? parseFloat(additionalAmount) : undefined,
        },
      },
      {
        onSuccess: () => {
          onResponded();
        },
      }
    );
  };

  const handleDeny = () => {
    denyExtension.mutate(
      {
        extensionId: extension.id,
        reason: denialReason,
      },
      {
        onSuccess: () => {
          onResponded();
        },
      }
    );
  };

  const handleClose = () => {
    setMode('view');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Extension Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Request Summary */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3 text-sm">
              <User className="h-4 w-4 text-muted-gray" />
              <span className="text-muted-gray">Requested by</span>
              <span className="text-bone-white font-medium">
                {(extension as any).requested_by_name || 'Unknown'}
              </span>
            </div>

            {/* Date Change Visual */}
            <div className="flex items-center justify-center gap-3 py-3">
              <div className="text-center">
                <p className="text-xs text-muted-gray mb-1">Current End</p>
                <p className="font-medium text-bone-white">
                  {originalEndDate ? format(originalEndDate, 'MMM d') : 'N/A'}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-accent-yellow" />
              <div className="text-center">
                <p className="text-xs text-muted-gray mb-1">Requested End</p>
                <p className="font-medium text-accent-yellow">
                  {requestedEndDate ? format(requestedEndDate, 'MMM d') : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs">
                +{extension.additional_days} {extension.additional_days === 1 ? 'day' : 'days'}
              </Badge>
            </div>
          </div>

          {/* Reason */}
          {extension.reason && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-gray">Reason for Extension</Label>
              <p className="text-sm text-bone-white bg-white/5 rounded-lg p-3">
                {extension.reason}
              </p>
            </div>
          )}

          <Separator className="bg-white/10" />

          {/* Approve Mode */}
          {mode === 'approve' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="approvedDate">Approved End Date</Label>
                <Input
                  id="approvedDate"
                  type="date"
                  value={approvedEndDate}
                  onChange={(e) => setApprovedEndDate(e.target.value)}
                  min={extension.original_end_date || undefined}
                />
                <p className="text-xs text-muted-gray">
                  You can modify the end date or keep the requested date.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalAmount">Additional Charge ($)</Label>
                <Input
                  id="additionalAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={additionalAmount}
                  onChange={(e) => setAdditionalAmount(e.target.value)}
                />
                <p className="text-xs text-muted-gray">
                  Optional: Add charges for the extended rental period.
                </p>
              </div>
            </div>
          )}

          {/* Deny Mode */}
          {mode === 'deny' && (
            <div className="space-y-4">
              <Alert className="border-red-500/30 bg-red-500/10">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-200 text-sm">
                  Denying this request will require the renter to return the equipment
                  by the original end date.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="denialReason">Reason for Denial</Label>
                <Textarea
                  id="denialReason"
                  placeholder="e.g., Equipment is reserved for another rental..."
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* View Mode Actions */}
          {mode === 'view' && (
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2"
                onClick={() => setMode('approve')}
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 text-red-400 hover:text-red-300"
                onClick={() => setMode('deny')}
              >
                <X className="h-4 w-4" />
                Deny
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {mode === 'view' ? (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setMode('view')}>
                Back
              </Button>
              {mode === 'approve' ? (
                <Button
                  onClick={handleApprove}
                  disabled={!approvedEndDate || isApproving}
                  className="gap-2"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirm Approval
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={handleDeny}
                  disabled={isDenying}
                  className="gap-2"
                >
                  {isDenying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Denying...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Confirm Denial
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExtensionResponseDialog;
