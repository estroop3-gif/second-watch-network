/**
 * ActualDetailModal - Full detail view for a budget actual
 * Shows source item details, gear info, quick actions, receipts, and audit log
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ExternalLink,
  DollarSign,
  Car,
  Package,
  Utensils,
  Receipt,
  FileCheck,
  FileText,
  Edit,
  CheckCircle2,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  User,
  History,
} from 'lucide-react';
import { GearAssetCard } from './GearAssetCard';
import { ReceiptManagement } from './ReceiptManagement';
import { AuditLogTimeline } from './AuditLogTimeline';
import {
  useBudgetActualDetail,
  useUpdateBudgetActual,
  useBudgetActualAuditLog,
  useKitRentalGearDetails,
  useActualReceipts,
  useAttachReceipt,
  useDetachReceipt,
  useReceipts,
} from '@/hooks/backlot';

interface ActualDetailModalProps {
  projectId: string;
  actualId: string | null;
  open: boolean;
  onClose: () => void;
  canEdit?: boolean;
}

// Format currency
const formatCurrency = (amount: number | undefined, currency = 'USD'): string => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

// Source type display info
const getSourceTypeInfo = (sourceType: string) => {
  switch (sourceType) {
    case 'mileage':
      return { icon: <Car className="w-5 h-5" />, label: 'Mileage', color: 'text-blue-400 bg-blue-500/20' };
    case 'kit_rental':
      return { icon: <Package className="w-5 h-5" />, label: 'Kit Rental', color: 'text-purple-400 bg-purple-500/20' };
    case 'per_diem':
      return { icon: <Utensils className="w-5 h-5" />, label: 'Per Diem', color: 'text-green-400 bg-green-500/20' };
    case 'receipt':
      return { icon: <Receipt className="w-5 h-5" />, label: 'Receipt', color: 'text-yellow-400 bg-yellow-500/20' };
    case 'purchase_order':
      return { icon: <FileCheck className="w-5 h-5" />, label: 'Purchase Order', color: 'text-orange-400 bg-orange-500/20' };
    case 'invoice_line_item':
      return { icon: <FileText className="w-5 h-5" />, label: 'Invoice Line Item', color: 'text-pink-400 bg-pink-500/20' };
    default:
      return { icon: <Edit className="w-5 h-5" />, label: 'Manual Entry', color: 'text-muted-gray bg-muted-gray/20' };
  }
};

export const ActualDetailModal: React.FC<ActualDetailModalProps> = ({
  projectId,
  actualId,
  open,
  onClose,
  canEdit = false,
}) => {
  const [notes, setNotes] = useState('');
  const [syncNotes, setSyncNotes] = useState(false);
  const [isReimbursed, setIsReimbursed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch data
  const { data: detailData, isLoading: detailLoading } = useBudgetActualDetail(projectId, actualId);
  const { data: auditLog, isLoading: auditLoading } = useBudgetActualAuditLog(projectId, actualId);
  const { data: attachedReceipts, isLoading: receiptsLoading } = useActualReceipts(projectId, actualId);
  const { data: projectReceipts } = useReceipts(projectId);

  // Fetch gear details for kit rentals
  const isKitRental = detailData?.actual?.source_type === 'kit_rental';
  const { data: gearDetails } = useKitRentalGearDetails(
    isKitRental ? projectId : null,
    isKitRental ? detailData?.actual?.source_id || null : null
  );

  // Mutations
  const updateActual = useUpdateBudgetActual(projectId);
  const attachReceipt = useAttachReceipt(projectId);
  const detachReceipt = useDetachReceipt(projectId);

  // Sync state from loaded data
  useEffect(() => {
    if (detailData?.actual) {
      setNotes(detailData.actual.notes || '');
      setIsReimbursed(false); // Will be from actual once implemented
    }
  }, [detailData]);

  const handleSaveNotes = async () => {
    if (!actualId) return;
    setIsSaving(true);
    try {
      await updateActual.mutateAsync({
        actualId,
        notes,
        syncNotesToSource: syncNotes,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleReimbursed = async () => {
    if (!actualId) return;
    const newValue = !isReimbursed;
    setIsReimbursed(newValue);
    try {
      await updateActual.mutateAsync({
        actualId,
        isReimbursed: newValue,
      });
    } catch {
      setIsReimbursed(!newValue); // Revert on error
    }
  };

  const handleAttachReceipt = async (receiptId: string) => {
    if (!actualId) return;
    await attachReceipt.mutateAsync({ actualId, receiptId });
  };

  const handleDetachReceipt = async (receiptId: string) => {
    if (!actualId) return;
    await detachReceipt.mutateAsync({ actualId, receiptId });
  };

  const handleViewOriginal = () => {
    if (detailData?.deep_link) {
      window.open(detailData.deep_link, '_blank', 'noopener,noreferrer');
    }
  };

  const actual = detailData?.actual;
  const sourceDetails = detailData?.source_details;
  const typeInfo = actual ? getSourceTypeInfo(actual.source_type) : null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {detailLoading ? (
              <Skeleton className="w-48 h-6" />
            ) : typeInfo ? (
              <>
                <div className={`p-2 rounded-lg ${typeInfo.color}`}>{typeInfo.icon}</div>
                <span>{typeInfo.label} Details</span>
              </>
            ) : (
              'Expense Details'
            )}
          </DialogTitle>
        </DialogHeader>

        {detailLoading ? (
          <div className="space-y-4 py-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : actual ? (
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            {/* Header Section */}
            <div className="bg-charcoal-black/50 rounded-lg p-4 mb-4 border border-muted-gray/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="text-2xl font-bold text-bone-white mb-1">
                    {formatCurrency(actual.amount)}
                  </div>
                  <div className="text-sm text-muted-gray">
                    {actual.description || sourceDetails?.description || 'No description'}
                  </div>
                  {actual.submitter_name && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-gray">
                      <User className="w-3 h-3" />
                      Submitted by {actual.submitter_full_name || actual.submitter_name}
                    </div>
                  )}
                </div>
                {detailData?.deep_link && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleViewOriginal}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Original
                  </Button>
                )}
              </div>
            </div>

            {/* Source-Specific Details */}
            <div className="mb-4">
              {actual.source_type === 'mileage' && sourceDetails && (
                <div className="bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                  <h4 className="font-medium text-bone-white mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-400" />
                    Mileage Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-gray">Miles:</span>{' '}
                      <span className="text-bone-white">{sourceDetails.miles || 0}</span>
                    </div>
                    <div>
                      <span className="text-muted-gray">Rate:</span>{' '}
                      <span className="text-bone-white">${sourceDetails.rate_per_mile || 0}/mi</span>
                    </div>
                    {sourceDetails.origin && (
                      <div className="col-span-2 flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-muted-gray" />
                        <span className="text-muted-gray">Route:</span>{' '}
                        <span className="text-bone-white">
                          {sourceDetails.origin} → {sourceDetails.destination || 'N/A'}
                        </span>
                      </div>
                    )}
                    {sourceDetails.vehicle_description && (
                      <div className="col-span-2">
                        <span className="text-muted-gray">Vehicle:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.vehicle_description}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actual.source_type === 'kit_rental' && sourceDetails && (
                <div className="space-y-4">
                  <div className="bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                    <h4 className="font-medium text-bone-white mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-400" />
                      Kit Rental Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <span className="text-muted-gray">Kit:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.kit_name || 'Unnamed Kit'}</span>
                      </div>
                      {sourceDetails.rental_type && (
                        <div>
                          <span className="text-muted-gray">Rate Type:</span>{' '}
                          <span className="text-bone-white capitalize">{sourceDetails.rental_type}</span>
                        </div>
                      )}
                      {sourceDetails.rental_type === 'daily' && sourceDetails.daily_rate && (
                        <div>
                          <span className="text-muted-gray">Daily Rate:</span>{' '}
                          <span className="text-bone-white">${sourceDetails.daily_rate}/day</span>
                        </div>
                      )}
                      {sourceDetails.rental_type === 'weekly' && sourceDetails.weekly_rate && (
                        <div>
                          <span className="text-muted-gray">Weekly Rate:</span>{' '}
                          <span className="text-bone-white">${sourceDetails.weekly_rate}/week</span>
                        </div>
                      )}
                      {sourceDetails.rental_days && (
                        <div>
                          <span className="text-muted-gray">Duration:</span>{' '}
                          <span className="text-bone-white">{sourceDetails.rental_days} days</span>
                        </div>
                      )}
                      {(sourceDetails.rental_start_date || sourceDetails.start_date) && (
                        <div className="col-span-2 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-muted-gray" />
                          <span className="text-muted-gray">Period:</span>{' '}
                          <span className="text-bone-white">
                            {new Date(sourceDetails.rental_start_date || sourceDetails.start_date!).toLocaleDateString()}
                            {(sourceDetails.rental_end_date || sourceDetails.end_date) &&
                              ` - ${new Date(sourceDetails.rental_end_date || sourceDetails.end_date!).toLocaleDateString()}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gear House Asset Card */}
                  {gearDetails?.gear_details && (
                    <GearAssetCard
                      type={gearDetails.gear_details.type}
                      asset={gearDetails.gear_details.asset}
                      kit={gearDetails.gear_details.kit}
                      organizationName={gearDetails.gear_details.organization_name}
                      categoryName={gearDetails.gear_details.category_name}
                      deepLink={gearDetails.deep_link}
                      rentalPeriod={{
                        startDate: sourceDetails.rental_start_date || sourceDetails.start_date,
                        endDate: sourceDetails.rental_end_date || sourceDetails.end_date,
                        days: sourceDetails.rental_days,
                      }}
                    />
                  )}
                </div>
              )}

              {actual.source_type === 'per_diem' && sourceDetails && (
                <div className="bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                  <h4 className="font-medium text-bone-white mb-3 flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-green-400" />
                    Per Diem Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {sourceDetails.per_diem_type && (
                      <div>
                        <span className="text-muted-gray">Type:</span>{' '}
                        <span className="text-bone-white capitalize">{sourceDetails.per_diem_type}</span>
                      </div>
                    )}
                    {sourceDetails.days && (
                      <div>
                        <span className="text-muted-gray">Days:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.days}</span>
                      </div>
                    )}
                    {sourceDetails.daily_amount && (
                      <div>
                        <span className="text-muted-gray">Daily Amount:</span>{' '}
                        <span className="text-bone-white">${sourceDetails.daily_amount}/day</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actual.source_type === 'receipt' && sourceDetails && (
                <div className="bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                  <h4 className="font-medium text-bone-white mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-yellow-400" />
                    Receipt Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {sourceDetails.vendor_name && (
                      <div>
                        <span className="text-muted-gray">Vendor:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.vendor_name}</span>
                      </div>
                    )}
                    {sourceDetails.purchase_date && (
                      <div>
                        <span className="text-muted-gray">Date:</span>{' '}
                        <span className="text-bone-white">
                          {new Date(sourceDetails.purchase_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {sourceDetails.payment_method && (
                      <div>
                        <span className="text-muted-gray">Payment:</span>{' '}
                        <span className="text-bone-white capitalize">{sourceDetails.payment_method}</span>
                      </div>
                    )}
                    {sourceDetails.tax_amount !== undefined && (
                      <div>
                        <span className="text-muted-gray">Tax:</span>{' '}
                        <span className="text-bone-white">${sourceDetails.tax_amount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actual.source_type === 'purchase_order' && sourceDetails && (
                <div className="bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                  <h4 className="font-medium text-bone-white mb-3 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-orange-400" />
                    Purchase Order Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {sourceDetails.po_number && (
                      <div>
                        <span className="text-muted-gray">PO #:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.po_number}</span>
                      </div>
                    )}
                    {sourceDetails.vendor && (
                      <div>
                        <span className="text-muted-gray">Vendor:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.vendor}</span>
                      </div>
                    )}
                    {sourceDetails.order_date && (
                      <div>
                        <span className="text-muted-gray">Order Date:</span>{' '}
                        <span className="text-bone-white">
                          {new Date(sourceDetails.order_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {sourceDetails.delivery_date && (
                      <div>
                        <span className="text-muted-gray">Delivery:</span>{' '}
                        <span className="text-bone-white">
                          {new Date(sourceDetails.delivery_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {actual.source_type === 'invoice_line_item' && sourceDetails && (
                <div className="bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                  <h4 className="font-medium text-bone-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-pink-400" />
                    Invoice Line Item Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {sourceDetails.invoice_number && (
                      <div>
                        <span className="text-muted-gray">Invoice #:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.invoice_number}</span>
                      </div>
                    )}
                    {sourceDetails.line_item_description && (
                      <div className="col-span-2">
                        <span className="text-muted-gray">Description:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.line_item_description}</span>
                      </div>
                    )}
                    {sourceDetails.quantity && (
                      <div>
                        <span className="text-muted-gray">Qty:</span>{' '}
                        <span className="text-bone-white">{sourceDetails.quantity}</span>
                      </div>
                    )}
                    {sourceDetails.unit_price && (
                      <div>
                        <span className="text-muted-gray">Unit Price:</span>{' '}
                        <span className="text-bone-white">${sourceDetails.unit_price}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs for Quick Actions, Receipts, History */}
            <Tabs defaultValue="actions" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="actions">Quick Actions</TabsTrigger>
                <TabsTrigger value="receipts">Receipts</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="actions" className="mt-4 space-y-4">
                {/* Reimbursement Toggle */}
                <div className="flex items-center justify-between bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isReimbursed ? 'bg-green-500/20' : 'bg-muted-gray/20'}`}>
                      {isReimbursed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      ) : (
                        <DollarSign className="w-5 h-5 text-muted-gray" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-bone-white">Reimbursement Status</div>
                      <div className="text-xs text-muted-gray">
                        {isReimbursed ? 'This expense has been reimbursed' : 'Mark as reimbursed when paid'}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <Switch
                      checked={isReimbursed}
                      onCheckedChange={handleToggleReimbursed}
                      disabled={updateActual.isPending}
                    />
                  )}
                  {!canEdit && (
                    <Badge variant={isReimbursed ? 'default' : 'outline'}>
                      {isReimbursed ? 'Reimbursed' : 'Pending'}
                    </Badge>
                  )}
                </div>

                {/* Notes */}
                <div className="bg-charcoal-black/30 rounded-lg p-4 border border-muted-gray/10">
                  <Label className="text-sm font-medium text-bone-white mb-2 block">Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this expense..."
                    className="bg-charcoal-black/50 border-muted-gray/20 min-h-[80px]"
                    disabled={!canEdit}
                  />
                  {canEdit && (
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="sync-notes"
                          checked={syncNotes}
                          onCheckedChange={setSyncNotes}
                        />
                        <Label htmlFor="sync-notes" className="text-xs text-muted-gray cursor-pointer">
                          Sync notes to original expense
                        </Label>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Save Notes'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="receipts" className="mt-4">
                <ReceiptManagement
                  receipts={attachedReceipts || []}
                  isLoading={receiptsLoading}
                  canEdit={canEdit}
                  projectReceipts={projectReceipts}
                  onAttach={handleAttachReceipt}
                  onDetach={handleDetachReceipt}
                />
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <AuditLogTimeline entries={auditLog || []} isLoading={auditLoading} />
              </TabsContent>
            </Tabs>

            {/* Recorded Info */}
            <div className="mt-4 pt-3 border-t border-muted-gray/10 text-xs text-muted-gray flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Recorded {new Date(actual.recorded_at).toLocaleDateString()}
              </div>
              {actual.category_name && (
                <div>
                  Category: <span className="text-bone-white">{actual.category_name}</span>
                </div>
              )}
              {actual.line_item_description && (
                <div>
                  Line Item: <span className="text-bone-white">{actual.line_item_description}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-gray">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Expense not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ActualDetailModal;
