/**
 * ApprovalActionDialogs - Shared dialog components for approval actions
 *
 * Used by ApprovalDetailDialog and individual approval views to handle:
 * - Approve with Notes
 * - Request Changes/Reject (can resubmit)
 * - Deny (permanent rejection)
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, MessageSquare, Ban, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Type label mappings for dialog text
const TYPE_LABELS: Record<string, string> = {
  invoice: 'invoice',
  receipt: 'receipt',
  mileage: 'mileage entry',
  kit_rental: 'kit rental',
  per_diem: 'per diem',
  timecard: 'timecard',
  purchase_order: 'purchase order',
};

// =============================================================================
// APPROVE WITH NOTES DIALOG
// =============================================================================

interface ApproveWithNotesDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  isLoading: boolean;
  itemType: string;
}

export function ApproveWithNotesDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
  itemType,
}: ApproveWithNotesDialogProps) {
  const [notes, setNotes] = useState('');
  const typeLabel = TYPE_LABELS[itemType] || itemType;

  const handleConfirm = () => {
    onConfirm(notes);
  };

  const handleClose = () => {
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            Approve with Notes
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Add any conditions, comments, or notes to accompany your approval of this {typeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="approval-notes" className="text-bone-white">
              Approval Notes (optional)
            </Label>
            <Textarea
              id="approval-notes"
              placeholder="e.g., Approved with condition that receipts are submitted within 30 days..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px] bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Approving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// REQUEST CHANGES DIALOG (REJECT - CAN RESUBMIT)
// =============================================================================

interface RequestChangesDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
  itemType: string;
}

export function RequestChangesDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
  itemType,
}: RequestChangesDialogProps) {
  const [reason, setReason] = useState('');
  const typeLabel = TYPE_LABELS[itemType] || itemType;

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <MessageSquare className="w-5 h-5 text-orange-400" />
            Request Changes
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            The submitter will be notified and can make changes and resubmit this {typeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="change-reason" className="text-bone-white">
              What changes are needed? <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="change-reason"
              placeholder="Please describe what needs to be changed or corrected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px] bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Request Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// DENY DIALOG (PERMANENT REJECTION)
// =============================================================================

interface DenyDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
  itemType: string;
}

export function DenyDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
  itemType,
}: DenyDialogProps) {
  const [reason, setReason] = useState('');
  const typeLabel = TYPE_LABELS[itemType] || itemType;

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason);
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <Ban className="w-5 h-5 text-red-500" />
            Deny Permanently
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            <span className="text-red-400 font-medium">Warning:</span> This action is permanent.
            The {typeLabel} will be denied and cannot be resubmitted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-sm text-red-400">
              Unlike requesting changes, denying is final. Only use this for items that should
              never be approved (e.g., fraudulent submissions, policy violations).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deny-reason" className="text-bone-white">
              Reason for denial <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="deny-reason"
              placeholder="Explain why this is being permanently denied..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px] bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Denying...
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Deny Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
