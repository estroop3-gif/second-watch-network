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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
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
  CheckCheck,
  X,
  Loader2,
  ArrowLeft,
  Search,
  Filter,
} from 'lucide-react';
import { formatDate, parseLocalDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  useExpenseSummary,
  useInvoiceSummary,
  useTimecardSummary,
  usePurchaseOrderSummary,
  useCanApprove,
  useProjectPermission,
  // Individual item hooks
  useInvoicesForReview,
  useReceipts,
  useMileageEntries,
  useKitRentals,
  usePerDiemEntries,
  useTimecardsForReview,
  usePurchaseOrders,
  formatWeekRange,
  // Bulk actions
  useBulkApprovePerDiem,
  useBulkRejectPerDiem,
  // Types
  type PerDiemEntry,
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
  type: ApprovalItemType | 'per_diem_group';
  category: ApprovalCategory;
  title: string;
  submitter: string;
  submitterId?: string;
  amount?: number;
  date: string;
  subType?: string;
  status?: string;
  // For grouped per diem items
  groupData?: GroupedPerDiemItem;
}

interface GroupedPerDiemItem {
  id: string;
  submitterId: string;
  submitterName: string;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  entryIds: string[];
  totalAmount: number;
  count: number;
  dateRange: { earliest: string; latest: string };
  entries: PerDiemEntry[];
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
  const [selectedItem, setSelectedItem] = useState<{ type: ApprovalItemType; id: string; title?: string } | null>(null);
  const [showTipsModal, setShowTipsModal] = useState(false);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Bulk selection state for per diem
  const [selectedPerDiemIds, setSelectedPerDiemIds] = useState<Set<string>>(new Set());
  const [showBulkRejectModal, setShowBulkRejectModal] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Detail view navigation state
  const [detailView, setDetailView] = useState<{
    type: 'per_diem_group';
    userId: string;
    status: string;
    submitterName: string;
    entries: PerDiemEntry[];
  } | null>(null);

  // Selected entries in detail view for selective approve/reject
  const [selectedDetailEntryIds, setSelectedDetailEntryIds] = useState<Set<string>>(new Set());

  // Bulk action mutations
  const bulkApprovePerDiem = useBulkApprovePerDiem(projectId);
  const bulkRejectPerDiem = useBulkRejectPerDiem(projectId);

  // Get project permission to check if user is owner/admin
  const { data: permission, isLoading: loadingProjectPermission } = useProjectPermission(projectId);

  // Check permissions - pass owner/admin flags so project owners can see approvals
  const {
    canApproveExpenses,
    canApproveInvoices,
    canApproveTimecards,
    canApprovePOs,
    isLoading: loadingRolePermissions,
  } = useCanApprove(projectId, {
    isOwner: permission?.isOwner,
    isAdmin: permission?.isAdmin,
  });

  // Combine loading states
  const loadingPermissions = loadingProjectPermission || loadingRolePermissions;

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
  // Fetch all receipts (pending, approved, rejected, reimbursed) so managers can see the full picture
  const { data: allReceipts, refetch: refetchReceipts } = useReceipts(
    canApproveExpenses ? projectId : null,
    {} // No status filter - get all submitted receipts
  );
  // Filter to only show receipts that have been submitted for approval (have a valid status)
  const submittedReceipts = allReceipts?.filter(r =>
    r.reimbursement_status &&
    r.reimbursement_status !== 'not_applicable'
  ) || [];
  const pendingReceipts = submittedReceipts.filter(r => r.reimbursement_status === 'pending');

  const { data: pendingMileage, refetch: refetchMileage } = useMileageEntries(
    canApproveExpenses ? projectId : null,
    { status: 'pending' }
  );
  // Fetch all kit rentals so we can show pending and recently processed
  const { data: allKitRentals, refetch: refetchKitRentals } = useKitRentals(
    canApproveExpenses ? projectId : null,
    {} // No status filter - get all entries
  );
  const pendingKitRentals = allKitRentals?.filter(k => k.status === 'pending') || [];
  const processedKitRentals = allKitRentals?.filter(k =>
    ['active', 'approved', 'rejected', 'denied', 'completed', 'reimbursed'].includes(k.status)
  ) || [];
  // Fetch all per diem entries (pending and approved) so managers can see the full picture
  const { data: allPerDiem, refetch: refetchPerDiem } = usePerDiemEntries(
    canApproveExpenses ? projectId : null,
    {} // No status filter - get all entries
  );
  // Filter to pending for the approvals list
  const pendingPerDiem = allPerDiem?.filter(p => p.status === 'pending') || [];

  // Group per diem entries by user + status for cleaner UI
  const groupedPerDiem = useMemo(() => {
    if (!allPerDiem || allPerDiem.length === 0) return [];

    const groups = new Map<string, GroupedPerDiemItem>();

    allPerDiem.forEach(entry => {
      const key = `${entry.user_id}-${entry.status}`;
      if (!groups.has(key)) {
        groups.set(key, {
          id: `perdiem-group-${key}`,
          submitterId: entry.user_id,
          submitterName: entry.user_name || 'Unknown',
          status: entry.status,
          entryIds: [],
          totalAmount: 0,
          count: 0,
          dateRange: { earliest: entry.date, latest: entry.date },
          entries: [],
        });
      }
      const group = groups.get(key)!;
      group.entryIds.push(entry.id);
      group.totalAmount += entry.amount;
      group.count++;
      group.entries.push(entry);
      // Update date range
      if (entry.date < group.dateRange.earliest) group.dateRange.earliest = entry.date;
      if (entry.date > group.dateRange.latest) group.dateRange.latest = entry.date;
    });

    return Array.from(groups.values());
  }, [allPerDiem]);
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

  // Build items lists split into pending vs processed
  const { pendingItems, processedItems } = useMemo(() => {
    const pending: PendingItem[] = [];
    const processed: PendingItem[] = [];

    // Add invoices (only pending)
    if (pendingInvoices) {
      pendingInvoices.forEach((inv) => {
        pending.push({
          id: inv.id,
          type: 'invoice',
          category: 'invoice',
          title: `Invoice #${inv.invoice_number}`,
          submitter: inv.user_name || inv.invoicer_name || 'Unknown',
          amount: inv.total_amount,
          date: inv.invoice_date,
          status: 'pending',
        });
      });
    }

    // Add receipts - split by status
    if (submittedReceipts) {
      submittedReceipts.forEach((r) => {
        const item: PendingItem = {
          id: r.id,
          type: 'receipt',
          category: 'expense',
          subType: 'receipt',
          title: r.vendor_name || r.description || 'Receipt',
          submitter: r.created_by?.display_name || r.created_by?.full_name || 'Unknown',
          amount: r.amount ?? undefined,
          date: r.purchase_date || r.created_at,
          status: r.reimbursement_status,
        };
        if (r.reimbursement_status === 'pending') {
          pending.push(item);
        } else {
          processed.push(item);
        }
      });
    }

    // Add mileage (only pending)
    if (pendingMileage) {
      pendingMileage.forEach((m) => {
        pending.push({
          id: m.id,
          type: 'mileage',
          category: 'expense',
          subType: 'mileage',
          title: `Mileage: ${m.miles} mi`,
          submitter: m.user_name || 'Unknown',
          amount: m.total_amount ?? undefined,
          date: m.date,
          status: 'pending',
        });
      });
    }

    // Add kit rentals - pending to pending list
    if (pendingKitRentals) {
      pendingKitRentals.forEach((k) => {
        pending.push({
          id: k.id,
          type: 'kit_rental',
          category: 'expense',
          subType: 'kit_rental',
          title: k.kit_name,
          submitter: k.user_name || 'Unknown',
          amount: k.total_amount ?? undefined,
          date: k.start_date,
          status: 'pending',
        });
      });
    }

    // Add processed kit rentals to processed list
    if (processedKitRentals) {
      processedKitRentals.forEach((k) => {
        processed.push({
          id: k.id,
          type: 'kit_rental',
          category: 'expense',
          subType: 'kit_rental',
          title: k.kit_name,
          submitter: k.user_name || 'Unknown',
          amount: k.total_amount ?? undefined,
          date: k.approved_at || k.rejected_at || k.start_date,
          status: k.status,
        });
      });
    }

    // Add grouped per diem - split by status
    groupedPerDiem.forEach((group) => {
      const item: PendingItem = {
        id: group.id,
        type: 'per_diem_group',
        category: 'expense',
        subType: 'per_diem',
        title: `${group.count} per diem claim${group.count > 1 ? 's' : ''}`,
        submitter: group.submitterName,
        submitterId: group.submitterId,
        amount: group.totalAmount,
        date: group.dateRange.latest,
        status: group.status,
        groupData: group,
      };
      if (group.status === 'pending') {
        pending.push(item);
      } else {
        processed.push(item);
      }
    });

    // Add timecards (only pending/submitted)
    if (pendingTimecards) {
      pendingTimecards.forEach((t) => {
        pending.push({
          id: t.id,
          type: 'timecard',
          category: 'timecard',
          title: formatWeekRange(t.week_start_date),
          submitter: t.user_name || 'Unknown',
          amount: undefined,
          date: t.week_start_date,
          status: 'pending',
        });
      });
    }

    // Add purchase orders (only pending)
    if (pendingPOs) {
      pendingPOs.forEach((po) => {
        pending.push({
          id: po.id,
          type: 'purchase_order',
          category: 'purchase_order',
          title: po.description?.substring(0, 50) || 'Purchase Order',
          submitter: po.requester_name || 'Unknown',
          amount: po.estimated_amount,
          date: po.created_at,
          status: 'pending',
        });
      });
    }

    // Sort both lists by date (newest first)
    pending.sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
    processed.sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

    return { pendingItems: pending, processedItems: processed };
  }, [pendingInvoices, submittedReceipts, pendingMileage, pendingKitRentals, processedKitRentals, groupedPerDiem, pendingTimecards, pendingPOs]);

  // Apply search and filters to items
  const { filteredPendingItems, filteredProcessedItems } = useMemo(() => {
    const filterItems = (items: PendingItem[]) => {
      return items.filter(item => {
        // Search filter - match submitter name or title
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          const matchesSubmitter = item.submitter?.toLowerCase().includes(search);
          const matchesTitle = item.title?.toLowerCase().includes(search);
          if (!matchesSubmitter && !matchesTitle) return false;
        }

        // Expense type filter
        if (expenseTypeFilter !== 'all') {
          // Map subType/type to filter value
          const itemType = item.subType || item.type;
          if (itemType !== expenseTypeFilter) return false;
        }

        // Status filter
        if (statusFilter !== 'all') {
          if (item.status !== statusFilter) return false;
        }

        // Category filter (existing)
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;

        return true;
      });
    };

    return {
      filteredPendingItems: filterItems(pendingItems),
      filteredProcessedItems: filterItems(processedItems),
    };
  }, [pendingItems, processedItems, searchTerm, expenseTypeFilter, statusFilter, categoryFilter]);

  // Get unique statuses from all items for filter dropdown
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    [...pendingItems, ...processedItems].forEach(item => {
      if (item.status) statuses.add(item.status);
    });
    return Array.from(statuses).sort();
  }, [pendingItems, processedItems]);

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
    // Handle grouped per diem specially - navigate to detail view
    if (item.type === 'per_diem_group' && item.groupData) {
      // Clear selection when entering detail view
      setSelectedDetailEntryIds(new Set());
      setDetailView({
        type: 'per_diem_group',
        userId: item.groupData.submitterId,
        status: item.groupData.status,
        submitterName: item.groupData.submitterName,
        entries: item.groupData.entries,
      });
      return;
    }
    setSelectedItem({ type: item.type as ApprovalItemType, id: item.id, title: item.title });
  };

  // Handle action complete (close dialog and refresh)
  const handleActionComplete = () => {
    setSelectedItem(null);
    handleRefresh();
  };

  // Bulk selection helpers for per diem
  const pendingPerDiemIds = useMemo(() => {
    return (pendingPerDiem || []).map(p => p.id);
  }, [pendingPerDiem]);

  const togglePerDiemSelection = (id: string) => {
    setSelectedPerDiemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllPerDiem = () => {
    setSelectedPerDiemIds(new Set(pendingPerDiemIds));
  };

  const clearPerDiemSelection = () => {
    setSelectedPerDiemIds(new Set());
  };

  const handleBulkApprovePerDiem = async () => {
    if (selectedPerDiemIds.size === 0) return;
    try {
      const result = await bulkApprovePerDiem.mutateAsync({ entryIds: Array.from(selectedPerDiemIds) });
      toast.success(`Approved ${result.approved_count} per diem entries`);
      if (result.failed_count > 0) {
        toast.warning(`${result.failed_count} entries could not be approved`);
      }
      clearPerDiemSelection();
      handleRefresh();
    } catch (error) {
      console.error('Bulk approve failed:', error);
      toast.error('Failed to approve per diem entries');
    }
  };

  const handleBulkRejectPerDiem = async () => {
    if (selectedPerDiemIds.size === 0) return;
    try {
      const result = await bulkRejectPerDiem.mutateAsync({
        entryIds: Array.from(selectedPerDiemIds),
        reason: bulkRejectReason || undefined,
      });
      toast.success(`Rejected ${result.rejected_count} per diem entries`);
      if (result.failed_count > 0) {
        toast.warning(`${result.failed_count} entries could not be rejected`);
      }
      clearPerDiemSelection();
      setShowBulkRejectModal(false);
      setBulkRejectReason('');
      handleRefresh();
    } catch (error) {
      console.error('Bulk reject failed:', error);
      toast.error('Failed to reject per diem entries');
    }
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

  // Render detail view for grouped per diem
  if (detailView) {
    const handleDetailBack = () => {
      setSelectedDetailEntryIds(new Set());
      setDetailView(null);
    };
    const handleDetailActionComplete = () => {
      setSelectedDetailEntryIds(new Set());
      setDetailView(null);
      handleRefresh();
    };
    const totalAmount = detailView.entries.reduce((sum, e) => sum + e.amount, 0);
    const allEntryIds = detailView.entries.map(e => e.id);
    const pendingEntries = detailView.entries.filter(e => e.status === 'pending');
    const pendingEntryIds = pendingEntries.map(e => e.id);

    // Selection helpers for detail view
    const toggleDetailEntrySelection = (id: string) => {
      setSelectedDetailEntryIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };

    const selectAllPendingEntries = () => {
      setSelectedDetailEntryIds(new Set(pendingEntryIds));
    };

    const clearDetailSelection = () => {
      setSelectedDetailEntryIds(new Set());
    };

    const selectedAmount = detailView.entries
      .filter(e => selectedDetailEntryIds.has(e.id))
      .reduce((sum, e) => sum + e.amount, 0);

    const handleApproveAll = async () => {
      try {
        const result = await bulkApprovePerDiem.mutateAsync({ entryIds: pendingEntryIds });
        toast.success(`Approved ${result.approved_count} per diem entries`);
        handleDetailActionComplete();
      } catch (error) {
        console.error('Bulk approve failed:', error);
        toast.error('Failed to approve per diem entries');
      }
    };

    const handleRejectAll = async () => {
      try {
        const result = await bulkRejectPerDiem.mutateAsync({ entryIds: pendingEntryIds });
        toast.success(`Rejected ${result.rejected_count} per diem entries`);
        handleDetailActionComplete();
      } catch (error) {
        console.error('Bulk reject failed:', error);
        toast.error('Failed to reject per diem entries');
      }
    };

    const handleApproveSelected = async () => {
      if (selectedDetailEntryIds.size === 0) return;
      try {
        const result = await bulkApprovePerDiem.mutateAsync({ entryIds: Array.from(selectedDetailEntryIds) });
        toast.success(`Approved ${result.approved_count} per diem entries`);
        // Only complete if all entries are processed
        if (result.approved_count === pendingEntryIds.length) {
          handleDetailActionComplete();
        } else {
          // Refresh and stay on page if some entries remain
          setSelectedDetailEntryIds(new Set());
          handleRefresh();
          // Update detail view entries to reflect changes
          const remainingEntries = detailView.entries.filter(
            e => !selectedDetailEntryIds.has(e.id) || e.status !== 'pending'
          );
          if (remainingEntries.length > 0) {
            setDetailView({ ...detailView, entries: remainingEntries });
          } else {
            handleDetailActionComplete();
          }
        }
      } catch (error) {
        console.error('Approve selected failed:', error);
        toast.error('Failed to approve selected entries');
      }
    };

    const handleRejectSelected = async () => {
      if (selectedDetailEntryIds.size === 0) return;
      try {
        const result = await bulkRejectPerDiem.mutateAsync({ entryIds: Array.from(selectedDetailEntryIds) });
        toast.success(`Rejected ${result.rejected_count} per diem entries`);
        // Only complete if all entries are processed
        if (result.rejected_count === pendingEntryIds.length) {
          handleDetailActionComplete();
        } else {
          // Refresh and stay on page if some entries remain
          setSelectedDetailEntryIds(new Set());
          handleRefresh();
          // Update detail view entries to reflect changes
          const remainingEntries = detailView.entries.filter(
            e => !selectedDetailEntryIds.has(e.id) || e.status !== 'pending'
          );
          if (remainingEntries.length > 0) {
            setDetailView({ ...detailView, entries: remainingEntries });
          } else {
            handleDetailActionComplete();
          }
        }
      } catch (error) {
        console.error('Reject selected failed:', error);
        toast.error('Failed to reject selected entries');
      }
    };

    // Individual entry actions
    const handleApproveSingle = async (entryId: string) => {
      try {
        const result = await bulkApprovePerDiem.mutateAsync({ entryIds: [entryId] });
        toast.success('Per diem entry approved');
        // Update the entry in detail view or refresh
        const updatedEntries = detailView.entries.map(e =>
          e.id === entryId ? { ...e, status: 'approved' as const } : e
        );
        const stillPending = updatedEntries.filter(e => e.status === 'pending');
        if (stillPending.length === 0) {
          handleDetailActionComplete();
        } else {
          setDetailView({ ...detailView, entries: updatedEntries });
        }
      } catch (error) {
        console.error('Approve single failed:', error);
        toast.error('Failed to approve entry');
      }
    };

    const handleRejectSingle = async (entryId: string) => {
      try {
        const result = await bulkRejectPerDiem.mutateAsync({ entryIds: [entryId] });
        toast.success('Per diem entry rejected');
        // Update the entry in detail view or refresh
        const updatedEntries = detailView.entries.map(e =>
          e.id === entryId ? { ...e, status: 'rejected' as const } : e
        );
        const stillPending = updatedEntries.filter(e => e.status === 'pending');
        if (stillPending.length === 0) {
          handleDetailActionComplete();
        } else {
          setDetailView({ ...detailView, entries: updatedEntries });
        }
      } catch (error) {
        console.error('Reject single failed:', error);
        toast.error('Failed to reject entry');
      }
    };

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleDetailBack} className="text-muted-gray hover:text-bone-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Approvals
          </Button>
        </div>

        <div>
          <h2 className="text-xl font-heading text-bone-white">{detailView.submitterName}'s Per Diem Claims</h2>
          <p className="text-sm text-muted-gray">
            {detailView.entries.length} claim{detailView.entries.length > 1 ? 's' : ''} &bull; ${totalAmount.toFixed(2)}
            {pendingEntries.length > 0 && pendingEntries.length < detailView.entries.length && (
              <span className="text-amber-400"> ({pendingEntries.length} pending)</span>
            )}
          </p>
        </div>

        {/* Summary card with bulk actions */}
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold text-bone-white">${totalAmount.toFixed(2)}</p>
                <p className="text-sm text-muted-gray">{detailView.entries.length} claims total</p>
              </div>
              {pendingEntries.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleApproveAll}
                    disabled={bulkApprovePerDiem.isPending || bulkRejectPerDiem.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {bulkApprovePerDiem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <CheckCheck className="w-4 h-4 mr-2" />
                    Approve All ({pendingEntries.length})
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleRejectAll}
                    disabled={bulkApprovePerDiem.isPending || bulkRejectPerDiem.isPending}
                  >
                    {bulkRejectPerDiem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <X className="w-4 h-4 mr-2" />
                    Reject All
                  </Button>
                </div>
              )}
            </div>

            {/* Selection controls */}
            {pendingEntries.length > 0 && (
              <div className="mt-4 pt-4 border-t border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-gray">
                      {selectedDetailEntryIds.size > 0 ? (
                        <>
                          <span className="text-bone-white font-medium">{selectedDetailEntryIds.size}</span> selected
                          {selectedAmount > 0 && (
                            <span className="text-amber-400 ml-2">(${selectedAmount.toFixed(2)})</span>
                          )}
                        </>
                      ) : (
                        'Select entries below to approve or reject individually'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDetailEntryIds.size > 0 ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={clearDetailSelection}
                          className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
                        >
                          Clear
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApproveSelected}
                          disabled={bulkApprovePerDiem.isPending || bulkRejectPerDiem.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {bulkApprovePerDiem.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Approve Selected
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleRejectSelected}
                          disabled={bulkApprovePerDiem.isPending || bulkRejectPerDiem.isPending}
                        >
                          {bulkRejectPerDiem.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                          <X className="w-4 h-4 mr-1" />
                          Reject Selected
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={selectAllPendingEntries}
                        className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
                      >
                        Select All Pending
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Individual entries list */}
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="p-0">
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y divide-muted-gray/10">
                {detailView.entries.map((entry) => {
                  const isPending = entry.status === 'pending';
                  const isSelected = selectedDetailEntryIds.has(entry.id);

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        'px-4 py-3 flex items-center gap-4 transition-colors',
                        isPending && 'hover:bg-muted-gray/5',
                        isSelected && 'bg-amber-500/5'
                      )}
                    >
                      {/* Checkbox for pending entries */}
                      {isPending && (
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleDetailEntrySelection(entry.id)}
                          className="border-muted-gray/50 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                        />
                      )}

                      <div className="p-2 rounded-lg bg-orange-500/10">
                        <Utensils className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-bone-white">
                            {entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1).replace('_', ' ')}
                          </p>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs py-0 px-1.5',
                              entry.status === 'approved' && 'text-green-400 border-green-500/30',
                              entry.status === 'pending' && 'text-amber-400 border-amber-500/30',
                              entry.status === 'rejected' && 'text-red-400 border-red-500/30',
                              entry.status === 'reimbursed' && 'text-blue-400 border-blue-500/30'
                            )}
                          >
                            {entry.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-gray flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(entry.date)}
                          </span>
                          {entry.location && (
                            <span className="text-xs text-muted-gray">
                              {entry.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-bone-white">
                          ${entry.amount.toFixed(2)}
                        </p>
                      </div>

                      {/* Individual approve/reject buttons for pending entries */}
                      {isPending && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleApproveSingle(entry.id)}
                            disabled={bulkApprovePerDiem.isPending || bulkRejectPerDiem.isPending}
                            className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                            title="Approve this entry"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRejectSingle(entry.id)}
                            disabled={bulkApprovePerDiem.isPending || bulkRejectPerDiem.isPending}
                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            title="Reject this entry"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
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

      {/* Search and Filter Bar */}
      <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search by submitter or title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
          </div>

          {/* Type Filter */}
          <Select value={expenseTypeFilter} onValueChange={setExpenseTypeFilter}>
            <SelectTrigger className="w-[160px] bg-charcoal-black border-muted-gray/30 text-bone-white">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="bg-charcoal-black border-muted-gray/30">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="receipt">Receipts</SelectItem>
              <SelectItem value="mileage">Mileage</SelectItem>
              <SelectItem value="kit_rental">Kit Rentals</SelectItem>
              <SelectItem value="per_diem">Per Diem</SelectItem>
              <SelectItem value="invoice">Invoices</SelectItem>
              <SelectItem value="timecard">Timecards</SelectItem>
              <SelectItem value="purchase_order">Purchase Orders</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray/30 text-bone-white">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-charcoal-black border-muted-gray/30">
              <SelectItem value="all">All Statuses</SelectItem>
              {availableStatuses.map(status => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters Button */}
          {(searchTerm || expenseTypeFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setExpenseTypeFilter('all');
                setStatusFilter('all');
              }}
              className="text-muted-gray hover:text-bone-white"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Active Filters Summary */}
        {(searchTerm || expenseTypeFilter !== 'all' || statusFilter !== 'all') && (
          <div className="mt-2 text-xs text-muted-gray">
            Showing {filteredPendingItems.length} pending and {filteredProcessedItems.length} processed items
          </div>
        )}
      </div>

      {/* SECTION: Needs Approval */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-400" />
          Needs Approval ({filteredPendingItems.length})
        </h3>

        {filteredPendingItems.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
              <h3 className="text-base font-medium text-bone-white mb-1">
                {searchTerm || expenseTypeFilter !== 'all' || statusFilter !== 'all'
                  ? 'No matching items'
                  : 'All caught up!'}
              </h3>
              <p className="text-sm text-muted-gray">
                {searchTerm || expenseTypeFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'No items are currently awaiting your approval.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <div className="divide-y divide-muted-gray/10">
                  {filteredPendingItems.map((item) => {
                      const categoryConfig = CATEGORY_CONFIG[item.category];
                      const SubtypeIcon = item.subType ? SUBTYPE_ICONS[item.subType as keyof typeof SUBTYPE_ICONS] : null;
                      const Icon = SubtypeIcon || categoryConfig.icon;
                      const isGroupedPerDiem = item.type === 'per_diem_group';

                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleItemClick(item)}
                          className="w-full px-4 py-3 flex items-center gap-4 hover:bg-muted-gray/5 transition-colors text-left"
                        >
                          <div className={cn('p-2 rounded-lg', isGroupedPerDiem ? 'bg-orange-500/10' : categoryConfig.bgColor)}>
                            <Icon className={cn('w-4 h-4', isGroupedPerDiem ? 'text-orange-400' : categoryConfig.color)} />
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
                              <Badge
                                variant="outline"
                                className="text-xs py-0 px-1.5 text-amber-400 border-amber-500/30"
                              >
                                pending
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-gray flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {item.submitter}
                              </span>
                              <span className="text-xs text-muted-gray flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(item.date)}
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
      </div>

      {/* SECTION: Recently Processed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-bone-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            Recently Processed
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistoryModal(true)}
            className="text-muted-gray hover:text-bone-white"
          >
            View Full History ({filteredProcessedItems.length})
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {filteredProcessedItems.length > 0 && (
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-0">
              <ScrollArea className="max-h-[400px]">
                <div className="divide-y divide-muted-gray/10">
                  {filteredProcessedItems
                    .slice(0, 15)
                    .map((item) => {
                      const categoryConfig = CATEGORY_CONFIG[item.category];
                      const SubtypeIcon = item.subType ? SUBTYPE_ICONS[item.subType as keyof typeof SUBTYPE_ICONS] : null;
                      const Icon = SubtypeIcon || categoryConfig.icon;
                      const isGroupedPerDiem = item.type === 'per_diem_group';

                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleItemClick(item)}
                          className="w-full px-4 py-3 flex items-center gap-4 hover:bg-muted-gray/5 transition-colors text-left opacity-75"
                        >
                          <div className={cn('p-2 rounded-lg', isGroupedPerDiem ? 'bg-orange-500/10' : categoryConfig.bgColor)}>
                            <Icon className={cn('w-4 h-4', isGroupedPerDiem ? 'text-orange-400' : categoryConfig.color)} />
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
                              {item.status && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-xs py-0 px-1.5',
                                    item.status === 'approved' && 'text-green-400 border-green-500/30',
                                    item.status === 'rejected' && 'text-red-400 border-red-500/30',
                                    item.status === 'reimbursed' && 'text-blue-400 border-blue-500/30'
                                  )}
                                >
                                  {item.status}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-gray flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {item.submitter}
                              </span>
                              <span className="text-xs text-muted-gray flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(item.date)}
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
      </div>

      {/* Approval Detail Dialog */}
      {selectedItem && (
        <ApprovalDetailDialog
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          itemType={selectedItem.type}
          itemId={selectedItem.id}
          projectId={projectId}
          itemTitle={selectedItem.title}
          onActionComplete={handleActionComplete}
        />
      )}

      {/* Bulk Reject Modal */}
      <Dialog open={showBulkRejectModal} onOpenChange={setShowBulkRejectModal}>
        <DialogContent className="bg-deep-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white">
              Reject {selectedPerDiemIds.size} Per Diem Entries
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-gray">
              This will reject all selected per diem entries. The submitters will need to resubmit new claims.
            </p>
            <div>
              <label className="text-sm text-muted-gray">Rejection Reason (optional)</label>
              <Textarea
                value={bulkRejectReason}
                onChange={(e) => setBulkRejectReason(e.target.value)}
                placeholder="Enter a reason for rejecting these entries..."
                className="mt-1 bg-charcoal-black border-muted-gray/30"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowBulkRejectModal(false);
                  setBulkRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkRejectPerDiem}
                disabled={bulkRejectPerDiem.isPending}
              >
                {bulkRejectPerDiem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reject All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="bg-deep-black border-muted-gray/30 max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-bone-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              Approval History ({filteredProcessedItems.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6 max-h-[calc(85vh-100px)]">
            <div className="divide-y divide-muted-gray/10">
              {filteredProcessedItems.map((item) => {
                const categoryConfig = CATEGORY_CONFIG[item.category];
                const SubtypeIcon = item.subType ? SUBTYPE_ICONS[item.subType as keyof typeof SUBTYPE_ICONS] : null;
                const Icon = SubtypeIcon || categoryConfig.icon;
                const isGroupedPerDiem = item.type === 'per_diem_group';

                return (
                  <button
                    key={`history-${item.type}-${item.id}`}
                    onClick={() => {
                      setShowHistoryModal(false);
                      handleItemClick(item);
                    }}
                    className="w-full py-3 flex items-center gap-4 hover:bg-muted-gray/5 transition-colors text-left"
                  >
                    <div className={cn('p-2 rounded-lg', isGroupedPerDiem ? 'bg-orange-500/10' : categoryConfig.bgColor)}>
                      <Icon className={cn('w-4 h-4', isGroupedPerDiem ? 'text-orange-400' : categoryConfig.color)} />
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
                        {item.status && (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs py-0 px-1.5',
                              item.status === 'approved' && 'text-green-400 border-green-500/30',
                              item.status === 'rejected' && 'text-red-400 border-red-500/30',
                              item.status === 'reimbursed' && 'text-blue-400 border-blue-500/30'
                            )}
                          >
                            {item.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-gray flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {item.submitter}
                        </span>
                        <span className="text-xs text-muted-gray flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.date)}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
