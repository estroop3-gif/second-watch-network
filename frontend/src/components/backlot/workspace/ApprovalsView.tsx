/**
 * ApprovalsView - Unified Approvals Dashboard for Admin/Above-the-Line users
 *
 * Shows all pending approvals across:
 * - Expenses (Receipts, Mileage, Kit Rentals, Per Diem)
 * - Invoices
 * - Timecards
 * - Purchase Orders
 *
 * Click on any item to open the ApprovalDetailDialog for review and action.
 */
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Receipt,
  FileText,
  Clock,
  ShoppingCart,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  User,
  Calendar,
  Car,
  Briefcase,
  Utensils,
  Lightbulb,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  useExpenseSummary,
  useInvoiceSummary,
  useTimecardSummary,
  usePurchaseOrderSummary,
  useCanApprove,
  // Individual item hooks
  useInvoicesForReview,
  useReceipts,
  useMileageEntries,
  useKitRentals,
  usePerDiemEntries,
  useTimecardsForReview,
  usePurchaseOrders,
  formatWeekRange,
} from '@/hooks/backlot';
import ApprovalDetailDialog, { type ApprovalItemType } from './ApprovalDetailDialog';

interface ApprovalsViewProps {
  projectId: string;
  canEdit: boolean;
  onNavigateToTab?: (tab: string, subTab?: string) => void;
}

type ApprovalCategory = 'expense' | 'invoice' | 'timecard' | 'purchase_order';

interface PendingItem {
  id: string;
  type: ApprovalItemType;
  category: ApprovalCategory;
  title: string;
  submitter: string;
  amount?: number;
  date: string;
  subType?: string;
}

const CATEGORY_CONFIG = {
  expense: {
    label: 'Expense',
    icon: Receipt,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  invoice: {
    label: 'Invoice',
    icon: FileText,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  timecard: {
    label: 'Timecard',
    icon: Clock,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  purchase_order: {
    label: 'PO',
    icon: ShoppingCart,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
} as const;

const SUBTYPE_ICONS = {
  receipt: Receipt,
  mileage: Car,
  kit_rental: Briefcase,
  per_diem: Utensils,
};

export default function ApprovalsView({
  projectId,
  canEdit,
  onNavigateToTab,
}: ApprovalsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<ApprovalCategory | 'all'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: ApprovalItemType; id: string } | null>(null);
  const [showTipsModal, setShowTipsModal] = useState(false);

  // Check permissions
  const {
    canApproveExpenses,
    canApproveInvoices,
    canApproveTimecards,
    canApprovePOs,
    isLoading: loadingPermissions,
  } = useCanApprove(projectId);

  // Fetch summary data for counts
  const { data: expenseSummaryData, refetch: refetchExpenseSummary } = useExpenseSummary(projectId);
  const { data: invoiceSummaryData, refetch: refetchInvoiceSummary } = useInvoiceSummary(projectId);
  const { data: timecardSummaryData, refetch: refetchTimecardSummary } = useTimecardSummary(projectId);
  const { data: poSummaryData, refetch: refetchPOSummary } = usePurchaseOrderSummary(projectId);

  // Fetch actual pending items
  const { data: pendingInvoices, refetch: refetchInvoices } = useInvoicesForReview(
    canApproveInvoices ? projectId : null,
    'pending_approval'
  );
  const { data: pendingReceipts, refetch: refetchReceipts } = useReceipts(
    canApproveExpenses ? projectId : null,
    { reimbursement_status: 'pending' }
  );
  const { data: pendingMileage, refetch: refetchMileage } = useMileageEntries(
    canApproveExpenses ? projectId : null,
    { status: 'pending' }
  );
  const { data: pendingKitRentals, refetch: refetchKitRentals } = useKitRentals(
    canApproveExpenses ? projectId : null,
    { status: 'pending' }
  );
  const { data: pendingPerDiem, refetch: refetchPerDiem } = usePerDiemEntries(
    canApproveExpenses ? projectId : null,
    { status: 'pending' }
  );
  const { data: pendingTimecards, refetch: refetchTimecards } = useTimecardsForReview(
    canApproveTimecards ? projectId : null,
    'submitted'
  );
  const { data: pendingPOs, refetch: refetchPOs } = usePurchaseOrders(
    canApprovePOs ? projectId : null,
    { status: 'pending' }
  );

  const expenseSummary = expenseSummaryData?.summary;
  const invoiceSummary = invoiceSummaryData;
  const timecardSummary = timecardSummaryData;
  const poSummary = poSummaryData;

  // Build unified pending items list
  const allPendingItems = useMemo(() => {
    const items: PendingItem[] = [];

    // Add invoices
    if (pendingInvoices) {
      pendingInvoices.forEach((inv) => {
        items.push({
          id: inv.id,
          type: 'invoice',
          category: 'invoice',
          title: `Invoice #${inv.invoice_number}`,
          submitter: inv.user_name || inv.invoicer_name || 'Unknown',
          amount: inv.total_amount,
          date: inv.invoice_date,
        });
      });
    }

    // Add receipts
    if (pendingReceipts) {
      pendingReceipts.forEach((r) => {
        items.push({
          id: r.id,
          type: 'receipt',
          category: 'expense',
          subType: 'receipt',
          title: r.vendor_name || r.description || 'Receipt',
          submitter: r.created_by?.display_name || r.created_by?.full_name || 'Unknown',
          amount: r.amount ?? undefined,
          date: r.purchase_date || r.created_at,
        });
      });
    }

    // Add mileage
    if (pendingMileage) {
      pendingMileage.forEach((m) => {
        items.push({
          id: m.id,
          type: 'mileage',
          category: 'expense',
          subType: 'mileage',
          title: `Mileage: ${m.miles} mi`,
          submitter: m.user_name || 'Unknown',
          amount: m.total_amount ?? undefined,
          date: m.date,
        });
      });
    }

    // Add kit rentals
    if (pendingKitRentals) {
      pendingKitRentals.forEach((k) => {
        items.push({
          id: k.id,
          type: 'kit_rental',
          category: 'expense',
          subType: 'kit_rental',
          title: k.kit_name,
          submitter: k.user_name || 'Unknown',
          amount: k.total_amount ?? undefined,
          date: k.start_date,
        });
      });
    }

    // Add per diem
    if (pendingPerDiem) {
      pendingPerDiem.forEach((p) => {
        items.push({
          id: p.id,
          type: 'per_diem',
          category: 'expense',
          subType: 'per_diem',
          title: `Per Diem - ${p.meal_type}`,
          submitter: p.user_name || 'Unknown',
          amount: p.amount,
          date: p.date,
        });
      });
    }

    // Add timecards
    if (pendingTimecards) {
      pendingTimecards.forEach((t) => {
        items.push({
          id: t.id,
          type: 'timecard',
          category: 'timecard',
          title: formatWeekRange(t.week_start_date),
          submitter: t.user_name || 'Unknown',
          amount: undefined, // Timecards don't have direct amounts
          date: t.week_start_date,
        });
      });
    }

    // Add purchase orders
    if (pendingPOs) {
      pendingPOs.forEach((po) => {
        items.push({
          id: po.id,
          type: 'purchase_order',
          category: 'purchase_order',
          title: po.description?.substring(0, 50) || 'Purchase Order',
          submitter: po.requester_name || 'Unknown',
          amount: po.estimated_amount,
          date: po.created_at,
        });
      });
    }

    // Sort by date (newest first)
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return items;
  }, [pendingInvoices, pendingReceipts, pendingMileage, pendingKitRentals, pendingPerDiem, pendingTimecards, pendingPOs]);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return allPendingItems;
    return allPendingItems.filter((item) => item.category === categoryFilter);
  }, [allPendingItems, categoryFilter]);

  // Calculate pending counts
  const pendingCounts = useMemo(() => {
    const expenses = canApproveExpenses
      ? (expenseSummary?.pending_receipts || 0) +
        (expenseSummary?.pending_mileage || 0) +
        (expenseSummary?.pending_kit_rentals || 0) +
        (expenseSummary?.pending_per_diem || 0)
      : 0;

    const invoices = canApproveInvoices ? (invoiceSummary?.pending_approval_count || 0) : 0;
    const timecards = canApproveTimecards ? (timecardSummary?.submitted_count || 0) : 0;
    const purchaseOrders = canApprovePOs ? (poSummary?.pending_count || 0) : 0;

    return {
      expenses,
      invoices,
      timecards,
      purchaseOrders,
      total: expenses + invoices + timecards + purchaseOrders,
    };
  }, [expenseSummary, invoiceSummary, timecardSummary, poSummary, canApproveExpenses, canApproveInvoices, canApproveTimecards, canApprovePOs]);

  // Calculate pending amounts
  const pendingAmounts = useMemo(() => {
    const expenseAmount = canApproveExpenses ? (expenseSummary?.pending_amount || 0) : 0;
    const invoiceAmount = canApproveInvoices ? (invoiceSummary?.pending_approval_total || 0) : 0;
    const poAmount = canApprovePOs ? (poSummary?.pending_total || 0) : 0;

    return {
      expenses: expenseAmount,
      invoices: invoiceAmount,
      timecards: 0,
      purchaseOrders: poAmount,
      total: expenseAmount + invoiceAmount + poAmount,
    };
  }, [expenseSummary, invoiceSummary, poSummary, canApproveExpenses, canApproveInvoices, canApprovePOs]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchExpenseSummary(),
      refetchInvoiceSummary(),
      refetchTimecardSummary(),
      refetchPOSummary(),
      refetchInvoices(),
      refetchReceipts(),
      refetchMileage(),
      refetchKitRentals(),
      refetchPerDiem(),
      refetchTimecards(),
      refetchPOs(),
    ]);
    setIsRefreshing(false);
  };

  // Handle item click
  const handleItemClick = (item: PendingItem) => {
    setSelectedItem({ type: item.type, id: item.id });
  };

  // Handle action complete (close dialog and refresh)
  const handleActionComplete = () => {
    setSelectedItem(null);
    handleRefresh();
  };

  if (loadingPermissions) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Approvals</h2>
          <p className="text-sm text-muted-gray">
            {pendingCounts.total} items pending your review
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Tips CTA Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowTipsModal(true)}
        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
      >
        <Lightbulb className="w-4 h-4 mr-2" />
        Tips for Approvals
      </Button>

      {/* Tips Modal */}
      <Dialog open={showTipsModal} onOpenChange={setShowTipsModal}>
        <DialogContent className="bg-deep-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Approval Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-gray">
            <div className="space-y-2">
              <h4 className="font-medium text-bone-white">Getting Started</h4>
              <ul className="space-y-1 ml-4">
                <li>• Click any pending item to review its details</li>
                <li>• Use the category cards to filter by expense, invoice, timecard, or PO</li>
                <li>• Items are sorted by submission date (oldest first)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-bone-white">Approving Items</h4>
              <ul className="space-y-1 ml-4">
                <li>• Review all attached receipts and documentation</li>
                <li>• Check that amounts match the supporting documents</li>
                <li>• Add notes when rejecting to help the submitter fix issues</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-bone-white">Workflow</h4>
              <ul className="space-y-1 ml-4">
                <li>• Approved items move to the next step automatically</li>
                <li>• Rejected items are sent back to the submitter</li>
                <li>• You'll receive notifications when new items need review</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {canApproveExpenses && (
          <Card
            className={cn(
              'bg-charcoal-black border-muted-gray/20 cursor-pointer hover:border-blue-500/50 transition-colors',
              categoryFilter === 'expense' && 'border-blue-500/50 ring-1 ring-blue-500/20'
            )}
            onClick={() => setCategoryFilter(categoryFilter === 'expense' ? 'all' : 'expense')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Receipt className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-bone-white">{pendingCounts.expenses}</p>
                  <p className="text-xs text-muted-gray">Expenses</p>
                  {pendingAmounts.expenses > 0 && (
                    <p className="text-xs text-blue-400">
                      ${pendingAmounts.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canApproveInvoices && (
          <Card
            className={cn(
              'bg-charcoal-black border-muted-gray/20 cursor-pointer hover:border-purple-500/50 transition-colors',
              categoryFilter === 'invoice' && 'border-purple-500/50 ring-1 ring-purple-500/20'
            )}
            onClick={() => setCategoryFilter(categoryFilter === 'invoice' ? 'all' : 'invoice')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-bone-white">{pendingCounts.invoices}</p>
                  <p className="text-xs text-muted-gray">Invoices</p>
                  {pendingAmounts.invoices > 0 && (
                    <p className="text-xs text-purple-400">
                      ${pendingAmounts.invoices.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canApproveTimecards && (
          <Card
            className={cn(
              'bg-charcoal-black border-muted-gray/20 cursor-pointer hover:border-green-500/50 transition-colors',
              categoryFilter === 'timecard' && 'border-green-500/50 ring-1 ring-green-500/20'
            )}
            onClick={() => setCategoryFilter(categoryFilter === 'timecard' ? 'all' : 'timecard')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Clock className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-bone-white">{pendingCounts.timecards}</p>
                  <p className="text-xs text-muted-gray">Timecards</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {canApprovePOs && (
          <Card
            className={cn(
              'bg-charcoal-black border-muted-gray/20 cursor-pointer hover:border-amber-500/50 transition-colors',
              categoryFilter === 'purchase_order' && 'border-amber-500/50 ring-1 ring-amber-500/20'
            )}
            onClick={() => setCategoryFilter(categoryFilter === 'purchase_order' ? 'all' : 'purchase_order')}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold text-bone-white">{pendingCounts.purchaseOrders}</p>
                  <p className="text-xs text-muted-gray">Purchase Orders</p>
                  {pendingAmounts.purchaseOrders > 0 && (
                    <p className="text-xs text-amber-400">
                      ${pendingAmounts.purchaseOrders.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Total Summary */}
      <Card className="bg-charcoal-black border-muted-gray/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-gray">Total Pending Value</p>
                  <p className="text-lg font-semibold text-bone-white">
                    ${pendingAmounts.total.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              <div className="h-8 w-px bg-muted-gray/20" />

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-gray">Items Awaiting Review</p>
                  <p className="text-lg font-semibold text-bone-white">{pendingCounts.total}</p>
                </div>
              </div>
            </div>

            {pendingCounts.total > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                Action Required
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Items List */}
      {pendingCounts.total === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">All caught up!</h3>
            <p className="text-sm text-muted-gray">
              No items are currently awaiting your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-bone-white">
                Pending Items {categoryFilter !== 'all' && `(${CATEGORY_CONFIG[categoryFilter].label})`}
              </CardTitle>
              {categoryFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCategoryFilter('all')}
                  className="text-muted-gray hover:text-bone-white"
                >
                  Show All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y divide-muted-gray/10">
                {filteredItems.map((item) => {
                  const categoryConfig = CATEGORY_CONFIG[item.category];
                  const SubtypeIcon = item.subType ? SUBTYPE_ICONS[item.subType as keyof typeof SUBTYPE_ICONS] : null;
                  const Icon = SubtypeIcon || categoryConfig.icon;

                  return (
                    <button
                      key={`${item.type}-${item.id}`}
                      onClick={() => handleItemClick(item)}
                      className="w-full px-4 py-3 flex items-center gap-4 hover:bg-muted-gray/5 transition-colors text-left"
                    >
                      <div className={cn('p-2 rounded-lg', categoryConfig.bgColor)}>
                        <Icon className={cn('w-4 h-4', categoryConfig.color)} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-bone-white truncate">
                            {item.title}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs py-0 px-1.5',
                              categoryConfig.color,
                              categoryConfig.borderColor
                            )}
                          >
                            {item.subType
                              ? item.subType.replace('_', ' ')
                              : categoryConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-gray flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.submitter}
                          </span>
                          <span className="text-xs text-muted-gray flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(item.date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>

                      {item.amount !== undefined && (
                        <div className="text-right">
                          <p className="text-sm font-medium text-bone-white">
                            ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}

                      <ChevronRight className="w-4 h-4 text-muted-gray flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Approval Detail Dialog */}
      {selectedItem && (
        <ApprovalDetailDialog
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          itemType={selectedItem.type}
          itemId={selectedItem.id}
          projectId={projectId}
          onActionComplete={handleActionComplete}
        />
      )}
    </div>
  );
}
