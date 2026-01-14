/**
 * ReceiptManagement - Manage receipts attached to a budget actual
 * Supports viewing, adding, removing, and reordering receipts
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Receipt,
  Plus,
  Trash2,
  MoreVertical,
  ExternalLink,
  GripVertical,
  Loader2,
  AlertCircle,
  Image,
} from 'lucide-react';
import type { ActualReceiptAttachment } from '@/hooks/backlot/useBudget';

interface ReceiptManagementProps {
  receipts: ActualReceiptAttachment[];
  isLoading?: boolean;
  canEdit?: boolean;
  projectReceipts?: Array<{
    id: string;
    vendor_name?: string;
    amount?: number;
    purchase_date?: string;
    file_url?: string;
    description?: string;
  }>;
  onAttach?: (receiptId: string) => Promise<void>;
  onDetach?: (receiptId: string) => Promise<void>;
  onReorder?: (receiptIds: string[]) => Promise<void>;
}

// Format currency
const formatCurrency = (amount: number | undefined): string => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Receipt thumbnail component
const ReceiptThumbnail: React.FC<{
  receipt: ActualReceiptAttachment['receipt'];
  onClick?: () => void;
}> = ({ receipt, onClick }) => {
  const isImage = receipt?.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  return (
    <button
      onClick={onClick}
      className="w-16 h-16 rounded-lg overflow-hidden bg-charcoal-black/30 flex items-center justify-center border border-muted-gray/20 hover:border-muted-gray/40 transition-colors"
    >
      {receipt?.file_url && isImage ? (
        <img
          src={receipt.file_url}
          alt={receipt.vendor_name || 'Receipt'}
          className="w-full h-full object-cover"
        />
      ) : (
        <Receipt className="w-6 h-6 text-muted-gray" />
      )}
    </button>
  );
};

export const ReceiptManagement: React.FC<ReceiptManagementProps> = ({
  receipts,
  isLoading,
  canEdit = false,
  projectReceipts = [],
  onAttach,
  onDetach,
  onReorder,
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<ActualReceiptAttachment['receipt'] | null>(
    null
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isDetaching, setIsDetaching] = useState<string | null>(null);

  // Get receipts not already attached
  const availableReceipts = projectReceipts.filter(
    (pr) => !receipts.some((r) => r.receipt_id === pr.id)
  );

  const handleAttach = async (receiptId: string) => {
    if (!onAttach) return;
    setIsAttaching(true);
    try {
      await onAttach(receiptId);
      setShowAddDialog(false);
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDetach = async (receiptId: string) => {
    if (!onDetach) return;
    setIsDetaching(receiptId);
    try {
      await onDetach(receiptId);
    } finally {
      setIsDetaching(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-gray" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
          <Receipt className="w-4 h-4 text-yellow-400" />
          Attached Receipts ({receipts.length})
        </h4>
        {canEdit && onAttach && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Receipt
          </Button>
        )}
      </div>

      {/* Receipt List */}
      {receipts.length === 0 ? (
        <div className="text-center py-6 bg-charcoal-black/30 rounded-lg border border-muted-gray/10">
          <Receipt className="w-8 h-8 mx-auto mb-2 text-muted-gray/30" />
          <p className="text-sm text-muted-gray">No receipts attached</p>
          {canEdit && onAttach && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-muted-gray hover:text-bone-white"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-3 h-3 mr-1" />
              Attach a receipt
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.map((attachment, index) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 bg-charcoal-black/30 rounded-lg border border-muted-gray/10"
            >
              {/* Drag handle (if reorder enabled) */}
              {canEdit && onReorder && (
                <div className="cursor-grab text-muted-gray/50 hover:text-muted-gray">
                  <GripVertical className="w-4 h-4" />
                </div>
              )}

              {/* Thumbnail */}
              <ReceiptThumbnail
                receipt={attachment.receipt}
                onClick={() => setSelectedReceipt(attachment.receipt || null)}
              />

              {/* Receipt Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-bone-white truncate">
                  {attachment.receipt?.vendor_name || 'Unknown Vendor'}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-gray">
                  {attachment.receipt?.amount !== undefined && (
                    <span>{formatCurrency(attachment.receipt.amount)}</span>
                  )}
                  {attachment.receipt?.purchase_date && (
                    <span>{new Date(attachment.receipt.purchase_date).toLocaleDateString()}</span>
                  )}
                </div>
                {attachment.receipt?.description && (
                  <div className="text-xs text-muted-gray truncate mt-0.5">
                    {attachment.receipt.description}
                  </div>
                )}
              </div>

              {/* Actions */}
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      {isDetaching === attachment.receipt_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MoreVertical className="w-4 h-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedReceipt(attachment.receipt || null)}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Full Size
                    </DropdownMenuItem>
                    {onDetach && (
                      <DropdownMenuItem
                        className="text-red-400"
                        onClick={() => handleDetach(attachment.receipt_id)}
                        disabled={isDetaching === attachment.receipt_id}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full Size Receipt Viewer */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedReceipt?.vendor_name || 'Receipt'}{' '}
              {selectedReceipt?.amount !== undefined && `- ${formatCurrency(selectedReceipt.amount)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {selectedReceipt?.file_url ? (
              <img
                src={selectedReceipt.file_url}
                alt={selectedReceipt.vendor_name || 'Receipt'}
                className="max-w-full max-h-[70vh] mx-auto rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-gray">
                <Image className="w-12 h-12 mb-2 opacity-50" />
                <p>No image available</p>
              </div>
            )}
          </div>
          {selectedReceipt?.description && (
            <p className="text-sm text-muted-gray mt-4">{selectedReceipt.description}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Receipt Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Receipt</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {availableReceipts.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-gray/50" />
                <p className="text-sm text-muted-gray">
                  No available receipts to attach.
                </p>
                <p className="text-xs text-muted-gray mt-1">
                  Upload receipts in the Expenses tab first.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableReceipts.map((receipt) => (
                  <button
                    key={receipt.id}
                    onClick={() => handleAttach(receipt.id)}
                    disabled={isAttaching}
                    className="w-full flex items-center gap-3 p-3 bg-charcoal-black/30 rounded-lg border border-muted-gray/10 hover:border-muted-gray/30 transition-colors text-left disabled:opacity-50"
                  >
                    <ReceiptThumbnail receipt={receipt} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-bone-white truncate">
                        {receipt.vendor_name || 'Unknown Vendor'}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-gray">
                        {receipt.amount !== undefined && (
                          <span>{formatCurrency(receipt.amount)}</span>
                        )}
                        {receipt.purchase_date && (
                          <span>{new Date(receipt.purchase_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    {isAttaching && (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceiptManagement;
