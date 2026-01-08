/**
 * ExtensionRequestDialog.tsx
 * Dialog for requesting a rental extension
 */
import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Loader2,
  CalendarPlus,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useRequestExtension } from '@/hooks/gear/useGearMarketplace';
import type { GearTransaction } from '@/types/gear';

interface ExtensionRequestDialogProps {
  transaction: GearTransaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export function ExtensionRequestDialog({
  transaction,
  isOpen,
  onClose,
  onSubmitted,
}: ExtensionRequestDialogProps) {
  const [newEndDate, setNewEndDate] = useState('');
  const [reason, setReason] = useState('');

  const { mutate: requestExtension, isPending } = useRequestExtension();

  // Calculate dates and costs
  const currentEndDate = transaction?.expected_return_at
    ? parseISO(transaction.expected_return_at)
    : null;

  const minNewEndDate = currentEndDate
    ? format(addDays(currentEndDate, 1), 'yyyy-MM-dd')
    : format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const additionalDays = useMemo(() => {
    if (!newEndDate || !currentEndDate) return 0;
    return differenceInDays(parseISO(newEndDate), currentEndDate);
  }, [newEndDate, currentEndDate]);

  // Estimate additional cost (would need daily rate from transaction)
  const estimatedDailyRate = 0; // TODO: Get from transaction rental quote
  const estimatedAdditionalCost = additionalDays * estimatedDailyRate;

  const canSubmit = newEndDate && additionalDays > 0;

  const handleSubmit = () => {
    if (!transaction || !canSubmit) return;

    requestExtension(
      {
        transactionId: transaction.id,
        input: {
          requested_end_date: newEndDate,
          reason,
        },
      },
      {
        onSuccess: () => {
          setNewEndDate('');
          setReason('');
          onSubmitted();
        },
      }
    );
  };

  const handleClose = () => {
    setNewEndDate('');
    setReason('');
    onClose();
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Request Extension
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Rental Info */}
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h4 className="mb-3 text-sm font-medium text-bone-white">
              Current Rental Period
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-gray">
                  <Calendar className="h-4 w-4" />
                  Start Date
                </span>
                <span className="text-bone-white">
                  {transaction.checked_out_at
                    ? format(parseISO(transaction.checked_out_at), 'MMM d, yyyy')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-gray">
                  <Clock className="h-4 w-4" />
                  Current End Date
                </span>
                <span className="text-bone-white">
                  {currentEndDate
                    ? format(currentEndDate, 'MMM d, yyyy')
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-gray">Items</span>
                <span className="text-bone-white">
                  {transaction.item_count || transaction.items?.length || 0} items
                </span>
              </div>
            </div>
          </div>

          {/* Extension Request Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newEndDate">New End Date *</Label>
              <Input
                id="newEndDate"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={minNewEndDate}
              />
              {additionalDays > 0 && (
                <p className="text-sm text-muted-gray">
                  Requesting <span className="font-medium text-accent-yellow">{additionalDays}</span>{' '}
                  additional {additionalDays === 1 ? 'day' : 'days'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Extension</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Production schedule extended, need additional shoot days..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Estimated Cost */}
            {estimatedAdditionalCost > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-muted-gray">
                  <DollarSign className="h-4 w-4" />
                  Estimated Additional Cost
                </span>
                <span className="text-lg font-semibold text-bone-white">
                  ${estimatedAdditionalCost.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Info Alert */}
          <Alert className="border-blue-500/30 bg-blue-500/10">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200 text-sm">
              The rental house will review your request. You'll receive a notification
              when they respond. Keep the gear until you receive confirmation.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isPending}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" />
                Request Extension
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExtensionRequestDialog;
