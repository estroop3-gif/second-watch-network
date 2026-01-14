/**
 * ReceiptDetailContent - Read-only receipt detail view for approval dialog
 */
import React from 'react';
import { formatDate } from '@/lib/dateUtils';
import { Receipt, User, Calendar, DollarSign, Building2, FileImage, CreditCard, Tag, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useReceipt } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface ReceiptDetailContentProps {
  projectId: string;
  receiptId: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  reimbursed: { label: 'Reimbursed', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  denied: { label: 'Denied', className: 'bg-red-600/20 text-red-500 border-red-600/30' },
} as const;

const PAYMENT_METHODS = {
  cash: 'Cash',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  check: 'Check',
  wire: 'Wire Transfer',
  petty_cash: 'Petty Cash',
  corporate_card: 'Corporate Card',
  personal_card: 'Personal Card',
} as const;

export default function ReceiptDetailContent({ projectId, receiptId }: ReceiptDetailContentProps) {
  const { data: receipt, isLoading } = useReceipt(projectId, receiptId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Receipt not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[receipt.reimbursement_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const paymentMethodLabel = receipt.payment_method ? PAYMENT_METHODS[receipt.payment_method as keyof typeof PAYMENT_METHODS] || receipt.payment_method : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Receipt className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bone-white">
              {receipt.vendor_name || 'Receipt'}
            </h3>
            <p className="text-sm text-muted-gray">
              Submitted by {receipt.created_by?.display_name || receipt.created_by?.full_name || 'Unknown'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {receipt.is_verified && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
              <Check className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
          <Badge className={cn('border', statusConfig.className)}>
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Receipt Image/PDF */}
      {receipt.file_url && (
        <div className="bg-charcoal-black/50 rounded-lg border border-muted-gray/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-muted-gray/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileImage className="w-4 h-4 text-muted-gray" />
              <h4 className="text-sm font-medium text-bone-white">
                {receipt.file_type?.includes('pdf') ? 'Receipt PDF' : 'Receipt Image'}
              </h4>
            </div>
            <a
              href={receipt.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Open in new tab
            </a>
          </div>
          <div className="p-4 flex justify-center bg-charcoal-black">
            {receipt.file_type?.includes('pdf') ? (
              <iframe
                src={receipt.file_url}
                title="Receipt PDF"
                className="w-full h-[400px] rounded border border-muted-gray/20"
              />
            ) : receipt.file_type?.startsWith('image/') ? (
              <a href={receipt.file_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={receipt.file_url}
                  alt="Receipt"
                  className="max-h-64 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                />
              </a>
            ) : (
              <div className="text-center py-8">
                <FileImage className="w-12 h-12 text-muted-gray mx-auto mb-2" />
                <p className="text-sm text-muted-gray">File preview not available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Receipt Details */}
      <div className="grid grid-cols-2 gap-4">
        {receipt.amount !== null && (
          <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
            <p className="text-xs text-muted-gray mb-1">Amount</p>
            <p className="text-xl font-semibold text-bone-white flex items-center gap-1">
              <DollarSign className="w-5 h-5" />
              {receipt.amount.toFixed(2)} {receipt.currency}
            </p>
            {receipt.tax_amount && receipt.tax_amount > 0 && (
              <p className="text-xs text-muted-gray mt-1">
                (includes ${receipt.tax_amount.toFixed(2)} tax)
              </p>
            )}
          </div>
        )}

        {receipt.purchase_date && (
          <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
            <p className="text-xs text-muted-gray mb-1">Purchase Date</p>
            <p className="text-lg text-bone-white flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {formatDate(receipt.purchase_date, 'MMMM d, yyyy')}
            </p>
          </div>
        )}
      </div>

      {/* Additional Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {receipt.vendor_name && (
          <div>
            <p className="text-xs text-muted-gray flex items-center gap-1 mb-1">
              <Building2 className="w-3 h-3" />
              Vendor
            </p>
            <p className="text-sm text-bone-white">{receipt.vendor_name}</p>
          </div>
        )}

        {paymentMethodLabel && (
          <div>
            <p className="text-xs text-muted-gray flex items-center gap-1 mb-1">
              <CreditCard className="w-3 h-3" />
              Payment Method
            </p>
            <p className="text-sm text-bone-white">{paymentMethodLabel}</p>
          </div>
        )}

        {receipt.line_item?.name && (
          <div>
            <p className="text-xs text-muted-gray flex items-center gap-1 mb-1">
              <Tag className="w-3 h-3" />
              Budget Category
            </p>
            <p className="text-sm text-bone-white">{receipt.line_item.name}</p>
          </div>
        )}

        {receipt.daily_budget?.name && (
          <div>
            <p className="text-xs text-muted-gray flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3" />
              Daily Budget
            </p>
            <p className="text-sm text-bone-white">{receipt.daily_budget.name}</p>
          </div>
        )}

        {receipt.reimbursement_to && (
          <div>
            <p className="text-xs text-muted-gray flex items-center gap-1 mb-1">
              <User className="w-3 h-3" />
              Reimburse To
            </p>
            <p className="text-sm text-bone-white">{receipt.reimbursement_to}</p>
          </div>
        )}
      </div>

      {/* Description */}
      {receipt.description && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Description</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{receipt.description}</p>
        </div>
      )}

      {/* Notes */}
      {receipt.notes && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{receipt.notes}</p>
        </div>
      )}

      {/* OCR Extracted Text (if available) */}
      {receipt.extracted_text && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Extracted Text (OCR)</h4>
          <p className="text-xs text-muted-gray whitespace-pre-wrap font-mono bg-charcoal-black p-2 rounded max-h-32 overflow-y-auto">
            {receipt.extracted_text}
          </p>
        </div>
      )}
    </div>
  );
}
