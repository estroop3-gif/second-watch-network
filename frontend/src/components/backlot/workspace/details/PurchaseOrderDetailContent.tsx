/**
 * PurchaseOrderDetailContent - Read-only purchase order detail view for approval dialog
 */
import React from 'react';
import { formatDate, formatDateTime } from '@/lib/dateUtils';
import { ShoppingCart, User, Calendar, DollarSign, Building2, Tag, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePurchaseOrder } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface PurchaseOrderDetailContentProps {
  poId: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Pending Approval', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  completed: { label: 'Completed', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
  denied: { label: 'Denied', className: 'bg-red-600/20 text-red-500 border-red-600/30' },
} as const;

export default function PurchaseOrderDetailContent({ poId }: PurchaseOrderDetailContentProps) {
  const { data: po, isLoading } = usePurchaseOrder(poId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Purchase order not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[po.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <ShoppingCart className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bone-white">
              Purchase Order
            </h3>
            <p className="text-sm text-muted-gray">
              Requested by {po.requester_name || 'Unknown'}
            </p>
          </div>
        </div>
        <Badge className={cn('border', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Amount and Date */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Estimated Amount</p>
          <p className="text-xl font-semibold text-bone-white flex items-center gap-1">
            <DollarSign className="w-5 h-5" />
            {po.estimated_amount.toFixed(2)}
          </p>
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <p className="text-xs text-muted-gray mb-1">Request Date</p>
          <p className="text-lg text-bone-white flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {formatDate(po.created_at)}
          </p>
        </div>
      </div>

      {/* PO Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {po.vendor_name && (
          <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
            <p className="text-xs text-muted-gray mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              Vendor
            </p>
            <p className="text-sm text-bone-white">{po.vendor_name}</p>
          </div>
        )}

        {po.department && (
          <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
            <p className="text-xs text-muted-gray mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Department
            </p>
            <p className="text-sm text-bone-white">{po.department}</p>
          </div>
        )}

        {po.budget_category_name && (
          <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
            <p className="text-xs text-muted-gray mb-1 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Budget Category
            </p>
            <p className="text-sm text-bone-white">{po.budget_category_name}</p>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
        <h4 className="text-sm font-medium text-muted-gray mb-2">Description</h4>
        <p className="text-sm text-bone-white whitespace-pre-wrap">{po.description}</p>
      </div>

      {/* Notes */}
      {po.notes && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{po.notes}</p>
        </div>
      )}

      {/* Approval Info (if approved) */}
      {po.approved_at && po.approver_name && (
        <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20">
          <h4 className="text-sm font-medium text-green-400 mb-2">Approved</h4>
          <p className="text-sm text-bone-white">
            By {po.approver_name} on {formatDate(po.approved_at, 'MMMM d, yyyy')}
          </p>
        </div>
      )}

      {/* Rejection Reason */}
      {po.rejection_reason && po.status === 'rejected' && (
        <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20">
          <h4 className="text-sm font-medium text-red-400 mb-2">Rejection Reason</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{po.rejection_reason}</p>
          <p className="text-xs text-muted-gray mt-2">
            You can edit this PO and resubmit for approval.
          </p>
        </div>
      )}

      {/* Denial Reason */}
      {po.denial_reason && po.status === 'denied' && (
        <div className="bg-red-600/5 rounded-lg p-4 border border-red-600/20">
          <h4 className="text-sm font-medium text-red-500 mb-2">Denial Reason</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{po.denial_reason}</p>
          {po.denied_at && (
            <p className="text-xs text-muted-gray mt-2">
              Denied on {formatDate(po.denied_at, 'MMMM d, yyyy')}
            </p>
          )}
          <p className="text-xs text-muted-gray mt-1">
            You can edit this PO and resubmit for approval.
          </p>
        </div>
      )}

      {/* Approval Notes */}
      {po.approval_notes && po.status === 'approved' && (
        <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20">
          <h4 className="text-sm font-medium text-green-400 mb-2">Approval Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{po.approval_notes}</p>
        </div>
      )}
    </div>
  );
}
