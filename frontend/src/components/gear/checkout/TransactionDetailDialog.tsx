/**
 * Transaction Detail Dialog
 * Shows complete details about a checkout/transaction
 * Enhanced with full asset details, scanner info, condition photos, and print
 */
import React, { useState } from 'react';
import {
  X,
  Package,
  User,
  MapPin,
  Calendar,
  Clock,
  FileText,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Loader2,
  Hash,
  Printer,
  Barcode,
  Tag,
  Camera,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Building2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { useGearTransaction } from '@/hooks/gear';
import { generateCheckoutSlipPdf } from './PrintableCheckoutSlip';
import type { GearTransaction, GearTransactionItem, TransactionStatus, TransactionType, TransactionConditionReportItem } from '@/types/gear';

const STATUS_CONFIG: Record<TransactionStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: 'Draft',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <ArrowRightLeft className="w-3 h-3" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
};

const TYPE_LABELS: Record<TransactionType, string> = {
  internal_checkout: 'Team Checkout',
  internal_checkin: 'Check-in',
  transfer: 'Transfer',
  rental_reservation: 'Rental Reservation',
  rental_pickup: 'Rental Pickup',
  rental_return: 'Rental Return',
  write_off: 'Write Off',
  maintenance_send: 'Send to Maintenance',
  maintenance_return: 'Return from Maintenance',
  inventory_adjustment: 'Inventory Adjustment',
  initial_intake: 'Initial Intake',
};

interface TransactionDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string | null;
  onStartCheckin?: (transactionId: string) => void;
}

export function TransactionDetailDialog({
  isOpen,
  onClose,
  transactionId,
  onStartCheckin,
}: TransactionDetailDialogProps) {
  const { transaction, isLoading } = useGearTransaction(isOpen ? transactionId : null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Determine if check-in is available
  const canStartCheckin = transaction &&
    onStartCheckin &&
    transaction.status === 'completed' &&
    !transaction.returned_at &&
    (transaction.transaction_type === 'internal_checkout' ||
     transaction.transaction_type === 'rental_pickup');

  const handleStartCheckin = () => {
    if (transaction && onStartCheckin) {
      onStartCheckin(transaction.id);
      onClose();
    }
  };

  const handlePrint = async () => {
    if (!transaction) return;
    setIsPrinting(true);
    try {
      await generateCheckoutSlipPdf(transaction);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-muted-gray/30">
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent-yellow" />
            <span>Transaction Details</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <TransactionDetailSkeleton />
          ) : !transaction ? (
            <div className="text-center py-8 text-muted-gray">
              Transaction not found
            </div>
          ) : (
            <TransactionDetailContent transaction={transaction} />
          )}
        </div>

        <div className="px-6 py-4 border-t border-muted-gray/30 flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={isPrinting || !transaction}
            >
              {isPrinting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4 mr-2" />
                  Print Slip
                </>
              )}
            </Button>
            {canStartCheckin && (
              <Button onClick={handleStartCheckin}>
                <ArrowRight className="w-4 h-4 mr-2" />
                Start Check-in
              </Button>
            )}
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransactionDetailContent({ transaction }: { transaction: GearTransaction }) {
  const statusConfig = STATUS_CONFIG[transaction.status];
  const typeLabel = TYPE_LABELS[transaction.transaction_type];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge className={cn('border text-sm', statusConfig.color)}>
              {statusConfig.icon}
              <span className="ml-1">{statusConfig.label}</span>
            </Badge>
            <Badge variant="outline" className="text-sm">
              {typeLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-muted-gray">
            <Hash className="w-4 h-4" />
            <code className="text-sm">{transaction.reference_number || transaction.id.slice(0, 8)}</code>
          </div>
        </div>
        <div className="text-right text-sm text-muted-gray">
          <p>Created {format(new Date(transaction.created_at), 'MMM d, yyyy')}</p>
          <p className="text-xs">at {format(new Date(transaction.created_at), 'h:mm a')}</p>
        </div>
      </div>

      <Separator className="bg-muted-gray/30" />

      {/* People Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">People</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Initiated By */}
          <div className="p-3 bg-charcoal-black/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-muted-gray" />
              <span className="text-xs text-muted-gray">Checked Out By</span>
            </div>
            <p className="text-bone-white font-medium">
              {transaction.initiated_by_name || 'Unknown'}
            </p>
            {transaction.sender_verification_completed_at && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Verified {format(new Date(transaction.sender_verification_completed_at), 'MMM d, h:mm a')}
              </p>
            )}
          </div>

          {/* Custodian - show contact or user */}
          <div className="p-3 bg-charcoal-black/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              {transaction.custodian_contact_name ? (
                <Building2 className="w-4 h-4 text-blue-400" />
              ) : (
                <User className="w-4 h-4 text-accent-yellow" />
              )}
              <span className="text-xs text-muted-gray">Assigned To</span>
              {transaction.custodian_contact_name && (
                <Badge variant="outline" className="text-xs py-0 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/30">
                  Client
                </Badge>
              )}
            </div>
            <p className="text-bone-white font-medium">
              {transaction.custodian_contact_name || transaction.primary_custodian_name || '—'}
            </p>
            {transaction.custodian_contact_company && (
              <p className="text-xs text-muted-gray mt-0.5">
                {transaction.custodian_contact_company}
              </p>
            )}
            {transaction.custodian_contact_email && (
              <p className="text-xs text-muted-gray mt-0.5">
                {transaction.custodian_contact_email}
              </p>
            )}
            {transaction.custodian_contact_phone && (
              <p className="text-xs text-muted-gray">
                {transaction.custodian_contact_phone}
              </p>
            )}
            {transaction.receiver_verification_completed_at && (
              <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Verified {format(new Date(transaction.receiver_verification_completed_at), 'MMM d, h:mm a')}
              </p>
            )}
          </div>
        </div>

        {/* Secondary Custodian if present */}
        {transaction.secondary_custodian_name && (
          <div className="p-3 bg-charcoal-black/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-muted-gray" />
              <span className="text-xs text-muted-gray">Witness / Secondary Custodian</span>
            </div>
            <p className="text-bone-white font-medium">
              {transaction.secondary_custodian_name}
            </p>
          </div>
        )}
      </div>

      {/* Signatures Section */}
      {(transaction.initiator_signature_url || transaction.custodian_signature_url) && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">Signatures</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transaction.initiator_signature_url && (
              <div className="p-3 bg-charcoal-black/30 rounded-lg">
                <p className="text-xs text-muted-gray mb-2">Checked Out By</p>
                <div className="bg-white rounded p-2">
                  <img
                    src={transaction.initiator_signature_url}
                    alt="Initiator signature"
                    className="max-h-16 mx-auto"
                  />
                </div>
              </div>
            )}
            {transaction.custodian_signature_url && (
              <div className="p-3 bg-charcoal-black/30 rounded-lg">
                <p className="text-xs text-muted-gray mb-2">Received By</p>
                <div className="bg-white rounded p-2">
                  <img
                    src={transaction.custodian_signature_url}
                    alt="Custodian signature"
                    className="max-h-16 mx-auto"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dates & Timeline Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">Timeline</h3>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {transaction.initiated_at && (
            <div className="p-3 bg-charcoal-black/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-muted-gray" />
                <span className="text-xs text-muted-gray">Initiated</span>
              </div>
              <p className="text-bone-white text-sm">
                {format(new Date(transaction.initiated_at), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-gray">
                {format(new Date(transaction.initiated_at), 'h:mm a')}
              </p>
            </div>
          )}

          {transaction.checked_out_at && (
            <div className="p-3 bg-charcoal-black/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <ArrowRight className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-gray">Checked Out</span>
              </div>
              <p className="text-bone-white text-sm">
                {format(new Date(transaction.checked_out_at), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-gray">
                {format(new Date(transaction.checked_out_at), 'h:mm a')}
              </p>
            </div>
          )}

          {transaction.accepted_at && (
            <div className="p-3 bg-charcoal-black/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-gray">Accepted</span>
              </div>
              <p className="text-bone-white text-sm">
                {format(new Date(transaction.accepted_at), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-gray">
                {format(new Date(transaction.accepted_at), 'h:mm a')}
              </p>
            </div>
          )}

          {transaction.expected_return_at && (
            <div className="p-3 bg-charcoal-black/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-muted-gray">Expected Return</span>
              </div>
              <p className="text-bone-white text-sm">
                {format(new Date(transaction.expected_return_at), 'MMM d, yyyy')}
              </p>
            </div>
          )}

          {transaction.returned_at && (
            <div className="p-3 bg-charcoal-black/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-xs text-muted-gray">Returned</span>
              </div>
              <p className="text-bone-white text-sm">
                {format(new Date(transaction.returned_at), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-gray">
                {format(new Date(transaction.returned_at), 'h:mm a')}
              </p>
            </div>
          )}

          {transaction.reconciled_at && (
            <div className="p-3 bg-charcoal-black/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-muted-gray">Reconciled</span>
              </div>
              <p className="text-bone-white text-sm">
                {format(new Date(transaction.reconciled_at), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-gray">
                {format(new Date(transaction.reconciled_at), 'h:mm a')}
              </p>
            </div>
          )}

          {transaction.scheduled_at && (
            <div className="p-3 bg-charcoal-black/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-muted-gray">Scheduled</span>
              </div>
              <p className="text-bone-white text-sm">
                {format(new Date(transaction.scheduled_at), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Locations Section */}
      {(transaction.source_location_name || transaction.destination_location_name) && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">Locations</h3>

          <div className="flex items-center gap-4">
            {transaction.source_location_name && (
              <div className="flex-1 p-3 bg-charcoal-black/30 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-muted-gray" />
                  <span className="text-xs text-muted-gray">From</span>
                </div>
                <p className="text-bone-white font-medium">
                  {transaction.source_location_name}
                </p>
              </div>
            )}

            {transaction.source_location_name && transaction.destination_location_name && (
              <ArrowRight className="w-5 h-5 text-muted-gray flex-shrink-0" />
            )}

            {transaction.destination_location_name && (
              <div className="flex-1 p-3 bg-charcoal-black/30 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-accent-yellow" />
                  <span className="text-xs text-muted-gray">To</span>
                </div>
                <p className="text-bone-white font-medium">
                  {transaction.destination_location_name}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Project Section */}
      {(transaction.project_name || transaction.backlot_project_name) && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">Project</h3>

          <div className="p-3 bg-charcoal-black/30 rounded-lg">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-400" />
              <span className="text-bone-white font-medium">
                {transaction.project_name || transaction.backlot_project_name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Items Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
          Items ({transaction.items?.length || transaction.item_count || 0})
        </h3>

        {transaction.items && transaction.items.length > 0 ? (
          <div className="space-y-3">
            {transaction.items.map((item) => (
              <TransactionItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="p-4 bg-charcoal-black/30 rounded-lg text-center text-muted-gray">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No items in this transaction</p>
          </div>
        )}
      </div>

      {/* Condition Photos Section */}
      {transaction.condition_reports && transaction.condition_reports.length > 0 && (
        <ConditionPhotosSection reports={transaction.condition_reports} />
      )}

      {/* Notes Section */}
      {transaction.notes && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">Notes</h3>

          <div className="p-3 bg-charcoal-black/30 rounded-lg">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-muted-gray mt-0.5" />
              <p className="text-bone-white whitespace-pre-wrap">{transaction.notes}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Enhanced item card showing full asset details
 */
function TransactionItemCard({ item }: { item: GearTransactionItem }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasExtendedDetails = item.serial_number || item.make || item.model || item.barcode || item.category_name;
  const hasScanInfo = item.scanned_out_by_name || item.scanned_in_by_name;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="bg-charcoal-black/30 rounded-lg overflow-hidden">
        {/* Main Row */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-charcoal-black/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-bone-white font-medium">
                  {item.asset_name || item.kit_name || 'Unknown Item'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.asset_internal_id && (
                    <code className="text-xs text-muted-gray bg-charcoal-black/50 px-1.5 py-0.5 rounded">
                      {item.asset_internal_id || item.kit_internal_id}
                    </code>
                  )}
                  {item.category_name && (
                    <Badge variant="outline" className="text-xs py-0 px-1.5">
                      {item.category_name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.quantity > 1 && (
                <Badge variant="outline" className="text-xs">
                  x{item.quantity}
                </Badge>
              )}
              {item.scanned_out_at && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  Out
                </Badge>
              )}
              {item.scanned_in_at && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  In
                </Badge>
              )}
              {(hasExtendedDetails || hasScanInfo) && (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-muted-gray" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-gray" />
                )
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Extended Details */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t border-muted-gray/20">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {/* Serial Number */}
              {item.serial_number && (
                <div>
                  <span className="text-xs text-muted-gray">Serial #</span>
                  <p className="text-bone-white font-mono text-sm">{item.serial_number}</p>
                </div>
              )}

              {/* Make / Model */}
              {(item.make || item.model) && (
                <div>
                  <span className="text-xs text-muted-gray">Make / Model</span>
                  <p className="text-bone-white">
                    {[item.make, item.model].filter(Boolean).join(' ')}
                  </p>
                </div>
              )}

              {/* Barcode */}
              {item.barcode && (
                <div>
                  <span className="text-xs text-muted-gray flex items-center gap-1">
                    <Barcode className="w-3 h-3" /> Barcode
                  </span>
                  <p className="text-bone-white font-mono text-sm">{item.barcode}</p>
                </div>
              )}

              {/* Condition Out */}
              {item.condition_out && (
                <div>
                  <span className="text-xs text-muted-gray">Condition Out</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.condition_out.replace('_', ' ')}
                  </Badge>
                </div>
              )}

              {/* Condition In */}
              {item.condition_in && (
                <div>
                  <span className="text-xs text-muted-gray">Condition In</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.condition_in.replace('_', ' ')}
                  </Badge>
                </div>
              )}
            </div>

            {/* Scan Info */}
            {hasScanInfo && (
              <div className="mt-3 pt-2 border-t border-muted-gray/20 space-y-1">
                {item.scanned_out_by_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span className="text-muted-gray">Scanned out by</span>
                    <span className="text-bone-white">{item.scanned_out_by_name}</span>
                    {item.scanned_out_at && (
                      <span className="text-muted-gray">
                        {format(new Date(item.scanned_out_at), 'MMM d, h:mm a')}
                      </span>
                    )}
                  </div>
                )}
                {item.scanned_in_by_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                    <span className="text-muted-gray">Scanned in by</span>
                    <span className="text-bone-white">{item.scanned_in_by_name}</span>
                    {item.scanned_in_at && (
                      <span className="text-muted-gray">
                        {format(new Date(item.scanned_in_at), 'MMM d, h:mm a')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Condition photos section grouped by checkpoint type
 */
function ConditionPhotosSection({ reports }: { reports: TransactionConditionReportItem[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Group photos by checkpoint type
  const checkoutPhotos = reports.filter(r => r.checkpoint_type === 'checkout' && r.photos?.length);
  const checkinPhotos = reports.filter(r => r.checkpoint_type === 'checkin' && r.photos?.length);
  const otherPhotos = reports.filter(
    r => r.checkpoint_type !== 'checkout' && r.checkpoint_type !== 'checkin' && r.photos?.length
  );

  const totalPhotos = reports.reduce((sum, r) => sum + (r.photos?.length || 0), 0);

  if (totalPhotos === 0) return null;

  return (
    <div className="space-y-4">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer">
            <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Condition Photos ({totalPhotos})
            </h3>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-gray" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-gray" />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 mt-3">
            {/* Checkout Photos */}
            {checkoutPhotos.length > 0 && (
              <div>
                <p className="text-xs text-muted-gray mb-2">At Checkout</p>
                <div className="grid grid-cols-4 gap-2">
                  {checkoutPhotos.flatMap(report =>
                    report.photos?.map((photo, idx) => (
                      <a
                        key={`${report.id}-${idx}`}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-charcoal-black/30 hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={photo}
                          alt={`Checkout condition ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Check-in Photos */}
            {checkinPhotos.length > 0 && (
              <div>
                <p className="text-xs text-muted-gray mb-2">At Check-in</p>
                <div className="grid grid-cols-4 gap-2">
                  {checkinPhotos.flatMap(report =>
                    report.photos?.map((photo, idx) => (
                      <a
                        key={`${report.id}-${idx}`}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-charcoal-black/30 hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={photo}
                          alt={`Check-in condition ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Other Photos */}
            {otherPhotos.length > 0 && (
              <div>
                <p className="text-xs text-muted-gray mb-2">Other</p>
                <div className="grid grid-cols-4 gap-2">
                  {otherPhotos.flatMap(report =>
                    report.photos?.map((photo, idx) => (
                      <a
                        key={`${report.id}-${idx}`}
                        href={photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-square rounded-lg overflow-hidden bg-charcoal-black/30 hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={photo}
                          alt={`Condition ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Damage Flags */}
            {reports.some(r => r.has_cosmetic_damage || r.has_functional_damage || r.is_unsafe) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-muted-gray/20">
                {reports.some(r => r.has_cosmetic_damage) && (
                  <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Cosmetic Damage
                  </Badge>
                )}
                {reports.some(r => r.has_functional_damage) && (
                  <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Functional Damage
                  </Badge>
                )}
                {reports.some(r => r.is_unsafe) && (
                  <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Safety Issue
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function TransactionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-20" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
