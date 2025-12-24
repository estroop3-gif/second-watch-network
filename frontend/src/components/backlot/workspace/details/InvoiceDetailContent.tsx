/**
 * InvoiceDetailContent - Read-only invoice detail view for approval dialog
 */
import React from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, User, Building2, Calendar, DollarSign, Clock, Mail, Phone, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useInvoice } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface InvoiceDetailContentProps {
  projectId: string;
  invoiceId: string;
}

const STATUS_CONFIG = {
  draft: { label: 'Draft', className: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
  pending_approval: { label: 'Pending Approval', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  changes_requested: { label: 'Changes Requested', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  sent: { label: 'Sent', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  paid: { label: 'Paid', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  overdue: { label: 'Overdue', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
  denied: { label: 'Denied', className: 'bg-red-600/20 text-red-500 border-red-600/30' },
} as const;

export default function InvoiceDetailContent({ projectId, invoiceId }: InvoiceDetailContentProps) {
  const { data: invoice, isLoading } = useInvoice(projectId, invoiceId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-8 text-muted-gray">
        Invoice not found
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <FileText className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bone-white">
              Invoice #{invoice.invoice_number}
            </h3>
            <p className="text-sm text-muted-gray">
              Submitted by {invoice.user_name || invoice.invoicer_name}
            </p>
          </div>
        </div>
        <Badge className={cn('border', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Invoicer & Bill To Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            From
          </h4>
          <p className="text-bone-white font-medium">{invoice.invoicer_name}</p>
          {invoice.invoicer_email && (
            <p className="text-sm text-muted-gray flex items-center gap-1 mt-1">
              <Mail className="w-3 h-3" />
              {invoice.invoicer_email}
            </p>
          )}
          {invoice.invoicer_phone && (
            <p className="text-sm text-muted-gray flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {invoice.invoicer_phone}
            </p>
          )}
          {invoice.invoicer_address && (
            <p className="text-sm text-muted-gray flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {invoice.invoicer_address}
            </p>
          )}
        </div>

        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bill To
          </h4>
          <p className="text-bone-white font-medium">{invoice.bill_to_name}</p>
          {invoice.bill_to_company && (
            <p className="text-sm text-muted-gray">{invoice.bill_to_company}</p>
          )}
          {invoice.bill_to_address && (
            <p className="text-sm text-muted-gray flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {invoice.bill_to_address}
            </p>
          )}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-muted-gray">Invoice Date</p>
          <p className="text-sm text-bone-white flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(parseISO(invoice.invoice_date), 'MMM d, yyyy')}
          </p>
        </div>
        {invoice.due_date && (
          <div>
            <p className="text-xs text-muted-gray">Due Date</p>
            <p className="text-sm text-bone-white flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {format(parseISO(invoice.due_date), 'MMM d, yyyy')}
            </p>
          </div>
        )}
        {invoice.position_role && (
          <div>
            <p className="text-xs text-muted-gray">Role/Position</p>
            <p className="text-sm text-bone-white">{invoice.position_role}</p>
          </div>
        )}
        {invoice.po_number && (
          <div>
            <p className="text-xs text-muted-gray">PO Number</p>
            <p className="text-sm text-bone-white">{invoice.po_number}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      {invoice.line_items && invoice.line_items.length > 0 && (
        <div className="bg-charcoal-black/50 rounded-lg border border-muted-gray/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-muted-gray/10">
            <h4 className="text-sm font-medium text-bone-white">Line Items</h4>
          </div>
          <div className="divide-y divide-muted-gray/10">
            {invoice.line_items.map((item) => (
              <div key={item.id} className="px-4 py-3 flex justify-between items-start">
                <div className="flex-1">
                  <p className="text-sm text-bone-white">{item.description}</p>
                  <p className="text-xs text-muted-gray">
                    {item.quantity} x ${item.rate_amount.toFixed(2)} ({item.rate_type})
                  </p>
                </div>
                <p className="text-sm font-medium text-bone-white">
                  ${item.line_total.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-gray">Subtotal</span>
            <span className="text-bone-white">${invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-gray">Tax ({invoice.tax_rate}%)</span>
              <span className="text-bone-white">${invoice.tax_amount.toFixed(2)}</span>
            </div>
          )}
          {invoice.discount_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-gray">Discount</span>
              <span className="text-green-400">-${invoice.discount_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold pt-2 border-t border-muted-gray/10">
            <span className="text-bone-white">Total</span>
            <span className="text-bone-white flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {invoice.total_amount.toFixed(2)} {invoice.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-charcoal-black/50 rounded-lg p-4 border border-muted-gray/10">
          <h4 className="text-sm font-medium text-muted-gray mb-2">Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Approval Notes (if approved with notes) */}
      {invoice.approval_notes && (
        <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20">
          <h4 className="text-sm font-medium text-green-400 mb-2">Approval Notes</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{invoice.approval_notes}</p>
          {invoice.approved_at && (
            <p className="text-xs text-muted-gray mt-2">
              Approved on {format(parseISO(invoice.approved_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}

      {/* Change Request Reason (if applicable) */}
      {invoice.change_request_reason && (
        <div className="bg-orange-500/5 rounded-lg p-4 border border-orange-500/20">
          <h4 className="text-sm font-medium text-orange-400 mb-2">Changes Requested</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{invoice.change_request_reason}</p>
          {invoice.changes_requested_at && (
            <p className="text-xs text-muted-gray mt-2">
              Requested on {format(parseISO(invoice.changes_requested_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}

      {/* Denial Reason (if denied) */}
      {invoice.denial_reason && (
        <div className="bg-red-500/5 rounded-lg p-4 border border-red-500/20">
          <h4 className="text-sm font-medium text-red-400 mb-2">Denial Reason</h4>
          <p className="text-sm text-bone-white whitespace-pre-wrap">{invoice.denial_reason}</p>
          {invoice.denied_at && (
            <p className="text-xs text-muted-gray mt-2">
              Denied on {format(parseISO(invoice.denied_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
