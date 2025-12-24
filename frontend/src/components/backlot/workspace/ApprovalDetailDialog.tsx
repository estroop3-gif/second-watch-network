/**
 * ApprovalDetailDialog - Unified approval detail view with action buttons
 *
 * Shows a read-only detail view of any approval item type with four standard actions:
 * - Approve - Approve as-is
 * - Approve with Notes - Approve with comments/conditions
 * - Request Changes - Send back for fixes (can resubmit)
 * - Deny - Reject permanently (cannot resubmit)
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, MessageSquare, Ban, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Detail content components
import {
  InvoiceDetailContent,
  ReceiptDetailContent,
  MileageDetailContent,
  KitRentalDetailContent,
  PerDiemDetailContent,
  TimecardDetailContent,
  PurchaseOrderDetailContent,
} from './details';

// Action dialogs
import {
  ApproveWithNotesDialog,
  RequestChangesDialog,
  DenyDialog,
} from './ApprovalActionDialogs';

// Hooks
import {
  useApproveInvoice,
  useDenyInvoice,
  useRequestInvoiceChanges,
  useApproveReimbursement,
  useDenyReimbursement,
  useRejectReimbursement,
  useApproveMileage,
  useDenyMileage,
  useRejectMileage,
  useApproveKitRental,
  useDenyKitRental,
  useRejectKitRental,
  useApprovePerDiem,
  useDenyPerDiem,
  useRejectPerDiem,
  useApproveTimecard,
  useDenyTimecard,
  useRejectTimecard,
  useApprovePurchaseOrder,
  useDenyPurchaseOrder,
  useRejectPurchaseOrder,
} from '@/hooks/backlot';

export type ApprovalItemType =
  | 'invoice'
  | 'receipt'
  | 'mileage'
  | 'kit_rental'
  | 'per_diem'
  | 'timecard'
  | 'purchase_order';

interface ApprovalDetailDialogProps {
  open: boolean;
  onClose: () => void;
  itemType: ApprovalItemType;
  itemId: string;
  projectId: string;
  onActionComplete?: () => void;
}

const TYPE_TITLES: Record<ApprovalItemType, string> = {
  invoice: 'Invoice Details',
  receipt: 'Receipt Details',
  mileage: 'Mileage Entry Details',
  kit_rental: 'Kit Rental Details',
  per_diem: 'Per Diem Details',
  timecard: 'Timecard Details',
  purchase_order: 'Purchase Order Details',
};

export default function ApprovalDetailDialog({
  open,
  onClose,
  itemType,
  itemId,
  projectId,
  onActionComplete,
}: ApprovalDetailDialogProps) {
  // Action dialog states
  const [showApproveWithNotes, setShowApproveWithNotes] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [showDeny, setShowDeny] = useState(false);

  // Action mutations - Invoice
  const approveInvoice = useApproveInvoice(projectId);
  const denyInvoice = useDenyInvoice(projectId);
  const requestInvoiceChanges = useRequestInvoiceChanges(projectId);

  // Action mutations - Receipt
  const approveReceipt = useApproveReimbursement(projectId);
  const denyReceipt = useDenyReimbursement(projectId);
  const rejectReceipt = useRejectReimbursement(projectId);

  // Action mutations - Mileage
  const approveMileage = useApproveMileage(projectId);
  const denyMileage = useDenyMileage(projectId);
  const rejectMileage = useRejectMileage(projectId);

  // Action mutations - Kit Rental
  const approveKitRental = useApproveKitRental(projectId);
  const denyKitRental = useDenyKitRental(projectId);
  const rejectKitRental = useRejectKitRental(projectId);

  // Action mutations - Per Diem
  const approvePerDiem = useApprovePerDiem(projectId);
  const denyPerDiem = useDenyPerDiem(projectId);
  const rejectPerDiem = useRejectPerDiem(projectId);

  // Action mutations - Timecard
  const approveTimecard = useApproveTimecard(projectId);
  const denyTimecard = useDenyTimecard(projectId);
  const rejectTimecard = useRejectTimecard(projectId);

  // Action mutations - Purchase Order
  const approvePurchaseOrder = useApprovePurchaseOrder();
  const denyPurchaseOrder = useDenyPurchaseOrder();
  const rejectPurchaseOrder = useRejectPurchaseOrder();

  // Check if any mutation is loading
  const isLoading =
    approveInvoice.isPending ||
    denyInvoice.isPending ||
    requestInvoiceChanges.isPending ||
    approveReceipt.isPending ||
    denyReceipt.isPending ||
    rejectReceipt.isPending ||
    approveMileage.isPending ||
    denyMileage.isPending ||
    rejectMileage.isPending ||
    approveKitRental.isPending ||
    denyKitRental.isPending ||
    rejectKitRental.isPending ||
    approvePerDiem.isPending ||
    denyPerDiem.isPending ||
    rejectPerDiem.isPending ||
    approveTimecard.isPending ||
    denyTimecard.isPending ||
    rejectTimecard.isPending ||
    approvePurchaseOrder.isPending ||
    denyPurchaseOrder.isPending ||
    rejectPurchaseOrder.isPending;

  // Handle successful action
  const handleSuccess = (action: string) => {
    toast.success(`Successfully ${action}`);
    onClose();
    onActionComplete?.();
  };

  // Handle error
  const handleError = (error: Error, action: string) => {
    console.error(`Approval action failed [${action}]:`, error);
    toast.error(`Failed to ${action}: ${error.message}`);
  };

  // ==========================================================================
  // ACTION HANDLERS
  // ==========================================================================

  // APPROVE (simple)
  const handleApprove = async () => {
    try {
      switch (itemType) {
        case 'invoice':
          await approveInvoice.mutateAsync({ invoiceId: itemId });
          break;
        case 'receipt':
          await approveReceipt.mutateAsync({ receiptId: itemId });
          break;
        case 'mileage':
          await approveMileage.mutateAsync({ mileageId: itemId });
          break;
        case 'kit_rental':
          await approveKitRental.mutateAsync({ rentalId: itemId });
          break;
        case 'per_diem':
          await approvePerDiem.mutateAsync({ entryId: itemId });
          break;
        case 'timecard':
          await approveTimecard.mutateAsync({ timecardId: itemId });
          break;
        case 'purchase_order':
          await approvePurchaseOrder.mutateAsync({ poId: itemId });
          break;
      }
      handleSuccess('approved');
    } catch (error) {
      handleError(error as Error, 'approve');
    }
  };

  // APPROVE WITH NOTES
  const handleApproveWithNotes = async (notes: string) => {
    console.log('[ApprovalDetailDialog] handleApproveWithNotes called', { itemType, itemId, projectId, notes });
    try {
      switch (itemType) {
        case 'invoice':
          console.log('[ApprovalDetailDialog] Calling approveInvoice with notes');
          const result = await approveInvoice.mutateAsync({ invoiceId: itemId, notes });
          console.log('[ApprovalDetailDialog] approveInvoice result:', result);
          break;
        case 'receipt':
          await approveReceipt.mutateAsync({ receiptId: itemId, notes });
          break;
        case 'mileage':
          await approveMileage.mutateAsync({ mileageId: itemId, notes });
          break;
        case 'kit_rental':
          await approveKitRental.mutateAsync({ rentalId: itemId, notes });
          break;
        case 'per_diem':
          await approvePerDiem.mutateAsync({ entryId: itemId, notes });
          break;
        case 'timecard':
          await approveTimecard.mutateAsync({ timecardId: itemId, notes });
          break;
        case 'purchase_order':
          await approvePurchaseOrder.mutateAsync({ poId: itemId, notes });
          break;
      }
      console.log('[ApprovalDetailDialog] Approve with notes succeeded');
      setShowApproveWithNotes(false);
      handleSuccess('approved with notes');
    } catch (error) {
      console.error('[ApprovalDetailDialog] Approve with notes failed:', error);
      handleError(error as Error, 'approve');
    }
  };

  // REQUEST CHANGES (reject - can resubmit)
  const handleRequestChanges = async (reason: string) => {
    console.log('[ApprovalDetailDialog] handleRequestChanges called', { itemType, itemId, projectId, reason });
    try {
      switch (itemType) {
        case 'invoice':
          console.log('[ApprovalDetailDialog] Calling requestInvoiceChanges');
          await requestInvoiceChanges.mutateAsync({ invoiceId: itemId, reason });
          break;
        case 'receipt':
          console.log('[ApprovalDetailDialog] Calling rejectReceipt');
          await rejectReceipt.mutateAsync({ receiptId: itemId, reason });
          break;
        case 'mileage':
          console.log('[ApprovalDetailDialog] Calling rejectMileage');
          await rejectMileage.mutateAsync({ mileageId: itemId, reason });
          break;
        case 'kit_rental':
          console.log('[ApprovalDetailDialog] Calling rejectKitRental');
          await rejectKitRental.mutateAsync({ rentalId: itemId, reason });
          break;
        case 'per_diem':
          console.log('[ApprovalDetailDialog] Calling rejectPerDiem');
          await rejectPerDiem.mutateAsync({ entryId: itemId, reason });
          break;
        case 'timecard':
          console.log('[ApprovalDetailDialog] Calling rejectTimecard');
          await rejectTimecard.mutateAsync({ timecardId: itemId, reason });
          break;
        case 'purchase_order':
          console.log('[ApprovalDetailDialog] Calling rejectPurchaseOrder');
          await rejectPurchaseOrder.mutateAsync({ poId: itemId, reason });
          break;
      }
      console.log('[ApprovalDetailDialog] Request changes succeeded');
      setShowRequestChanges(false);
      handleSuccess('requested changes');
    } catch (error) {
      console.error('[ApprovalDetailDialog] Request changes failed:', error);
      handleError(error as Error, 'request changes');
    }
  };

  // DENY (permanent)
  const handleDeny = async (reason: string) => {
    try {
      switch (itemType) {
        case 'invoice':
          await denyInvoice.mutateAsync({ invoiceId: itemId, reason });
          break;
        case 'receipt':
          await denyReceipt.mutateAsync({ receiptId: itemId, reason });
          break;
        case 'mileage':
          await denyMileage.mutateAsync({ mileageId: itemId, reason });
          break;
        case 'kit_rental':
          await denyKitRental.mutateAsync({ rentalId: itemId, reason });
          break;
        case 'per_diem':
          await denyPerDiem.mutateAsync({ entryId: itemId, reason });
          break;
        case 'timecard':
          await denyTimecard.mutateAsync({ timecardId: itemId, reason });
          break;
        case 'purchase_order':
          await denyPurchaseOrder.mutateAsync({ poId: itemId, reason });
          break;
      }
      setShowDeny(false);
      handleSuccess('denied');
    } catch (error) {
      handleError(error as Error, 'deny');
    }
  };

  // ==========================================================================
  // RENDER DETAIL CONTENT
  // ==========================================================================

  const renderDetailContent = () => {
    switch (itemType) {
      case 'invoice':
        return <InvoiceDetailContent projectId={projectId} invoiceId={itemId} />;
      case 'receipt':
        return <ReceiptDetailContent projectId={projectId} receiptId={itemId} />;
      case 'mileage':
        return <MileageDetailContent projectId={projectId} mileageId={itemId} />;
      case 'kit_rental':
        return <KitRentalDetailContent projectId={projectId} kitRentalId={itemId} />;
      case 'per_diem':
        return <PerDiemDetailContent projectId={projectId} perDiemId={itemId} />;
      case 'timecard':
        return <TimecardDetailContent projectId={projectId} timecardId={itemId} />;
      case 'purchase_order':
        return <PurchaseOrderDetailContent poId={itemId} />;
      default:
        return <div className="text-muted-gray">Unknown item type</div>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-charcoal-black border-muted-gray/20 sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-muted-gray/10">
            <DialogTitle className="text-bone-white text-base">
              {TYPE_TITLES[itemType]}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-4">
              {renderDetailContent()}
            </div>
          </ScrollArea>

          <Separator className="bg-muted-gray/20" />

          {/* Action Buttons */}
          <div className="px-4 py-4 flex-shrink-0 bg-charcoal-black/50">
            <div className="flex flex-col gap-3">
              {/* Primary actions row */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Deny Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeny(true)}
                  disabled={isLoading}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Ban className="w-4 h-4 mr-1.5" />
                  Deny
                </Button>

                {/* Request Changes Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRequestChanges(true)}
                  disabled={isLoading}
                  className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  Changes
                </Button>

                {/* Approve with Notes Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApproveWithNotes(true)}
                  disabled={isLoading}
                  className="border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                >
                  <MessageSquare className="w-4 h-4 mr-1.5" />
                  w/ Notes
                </Button>

                {/* Approve Button */}
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  )}
                  Approve
                </Button>
              </div>

              {/* Close button row */}
              <div className="flex justify-start">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  disabled={isLoading}
                  className="text-muted-gray hover:text-bone-white"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialogs */}
      <ApproveWithNotesDialog
        open={showApproveWithNotes}
        onClose={() => setShowApproveWithNotes(false)}
        onConfirm={handleApproveWithNotes}
        isLoading={isLoading}
        itemType={itemType}
      />

      <RequestChangesDialog
        open={showRequestChanges}
        onClose={() => setShowRequestChanges(false)}
        onConfirm={handleRequestChanges}
        isLoading={isLoading}
        itemType={itemType}
      />

      <DenyDialog
        open={showDeny}
        onClose={() => setShowDeny(false)}
        onConfirm={handleDeny}
        isLoading={isLoading}
        itemType={itemType}
      />
    </>
  );
}
