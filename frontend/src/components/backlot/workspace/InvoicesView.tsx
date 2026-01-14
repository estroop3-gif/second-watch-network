/**
 * InvoicesView - Crew billing and invoice management
 * Create, edit, and export invoices with line items from timecards/expenses
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  FileText,
  Download,
  Send,
  Check,
  X,
  Trash2,
  Edit,
  DollarSign,
  Clock,
  AlertCircle,
  Loader2,
  Receipt,
  FileSpreadsheet,
  Mail,
  Building,
  Package,
  Car,
  Utensils,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Import,
  Unlink2,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  useMyInvoices,
  useInvoicesForReview,
  useInvoice,
  useInvoiceSummary,
  useNextInvoiceNumber,
  useInvoicePrefillData,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useAddLineItem,
  useDeleteLineItem,
  useSendInvoice,
  useMarkInvoicePaid,
  useCancelInvoice,
  useSubmitForApproval,
  useApproveInvoice,
  useRequestChanges,
  useMarkInvoiceSent,
  useImportableInvoiceData,
  useImportTimecards,
  useImportExpenses,
  usePendingImportCount,
  useUnlinkLineItem,
  useReorderLineItem,
  formatInvoiceDate,
} from '@/hooks/backlot';
import {
  BacklotInvoice,
  InvoiceInput,
  InvoiceListItem,
  InvoiceStatus,
  InvoiceSourceType,
  ImportableInvoiceData,
  INVOICE_STATUS_CONFIG,
  PAYMENT_TERMS_OPTIONS,
  RATE_TYPE_OPTIONS,
} from '@/types/backlot';
import { generateInvoicePdf } from './invoice-pdf';
import { cn } from '@/lib/utils';

interface InvoicesViewProps {
  projectId: string;
  canEdit: boolean;
  canReview?: boolean;
}

// Helper function to calculate due date based on payment terms
const calculateDueDate = (invoiceDate: string, paymentTerms: string): string => {
  if (!invoiceDate || !paymentTerms || paymentTerms === 'custom') return '';

  const baseDate = new Date(invoiceDate);
  const daysMap: Record<string, number> = {
    'due_on_receipt': 0,
    'net_15': 15,
    'net_30': 30,
    'net_45': 45,
    'net_60': 60,
  };

  const days = daysMap[paymentTerms] ?? 30;
  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString().split('T')[0];
};

const InvoicesView: React.FC<InvoicesViewProps> = ({
  projectId,
  canEdit,
  canReview = false,
}) => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showAddLineItemDialog, setShowAddLineItemDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // Approval workflow state
  const [showSendOptionsDialog, setShowSendOptionsDialog] = useState(false);
  const [sendOption, setSendOption] = useState<'approval' | 'email'>('approval');
  const [showRequestChangesDialog, setShowRequestChangesDialog] = useState(false);
  const [changeRequestReason, setChangeRequestReason] = useState('');
  // Import items state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedTimecards, setSelectedTimecards] = useState<string[]>([]);
  const [selectedMileage, setSelectedMileage] = useState<string[]>([]);
  const [selectedKitRentals, setSelectedKitRentals] = useState<string[]>([]);
  const [selectedPerDiem, setSelectedPerDiem] = useState<string[]>([]);
  const [selectedReceipts, setSelectedReceipts] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    timecards: true,
    kit_rentals: true,
    mileage: true,
    per_diem: true,
    receipts: true,
  });

  // Queries
  const { data: myInvoices, isLoading: myLoading, error: myError } = useMyInvoices(
    projectId,
    statusFilter === 'all' ? undefined : statusFilter
  );
  const { data: allInvoices, isLoading: allLoading, error: allError } = useInvoicesForReview(
    canReview ? projectId : null,
    statusFilter === 'all' ? undefined : statusFilter
  );
  const { data: selectedInvoice, isLoading: invoiceLoading, error: invoiceError } = useInvoice(
    projectId,
    selectedInvoiceId
  );
  const { data: summary } = useInvoiceSummary(projectId);
  const { data: prefillData } = useInvoicePrefillData(projectId);
  const { data: nextNumber } = useNextInvoiceNumber(projectId);
  const { data: importableData, isLoading: importableLoading } = useImportableInvoiceData(projectId);
  const { data: pendingImportCount } = usePendingImportCount(projectId);

  const queryError = viewMode === 'my' ? myError : allError;

  // Mutations
  const createInvoice = useCreateInvoice(projectId);
  const updateInvoice = useUpdateInvoice(projectId, selectedInvoiceId);
  const deleteInvoice = useDeleteInvoice(projectId);
  const sendInvoice = useSendInvoice(projectId);
  const markPaid = useMarkInvoicePaid(projectId);
  const cancelInvoice = useCancelInvoice(projectId);
  const addLineItem = useAddLineItem(projectId, selectedInvoiceId);
  const deleteLineItem = useDeleteLineItem(projectId, selectedInvoiceId);
  // Approval workflow mutations
  const submitForApproval = useSubmitForApproval(projectId);
  const approveInvoice = useApproveInvoice(projectId);
  const requestChanges = useRequestChanges(projectId);
  const markSent = useMarkInvoiceSent(projectId);
  // Import mutations
  const importTimecards = useImportTimecards(projectId, selectedInvoiceId);
  const importExpenses = useImportExpenses(projectId, selectedInvoiceId);
  // Unlink mutation (remove auto-added item, make available for re-import)
  const unlinkLineItem = useUnlinkLineItem(projectId, selectedInvoiceId);
  // Reorder mutation (move line item up/down)
  const reorderLineItem = useReorderLineItem(projectId, selectedInvoiceId);

  // Form state for create dialog
  const [formData, setFormData] = useState<Partial<InvoiceInput>>({});
  const [lineItemForm, setLineItemForm] = useState({
    description: '',
    rate_type: 'flat',
    rate_amount: '',
    quantity: '1',
    units: '',
  });

  const invoices = viewMode === 'my' ? myInvoices : allInvoices;
  const isLoading = viewMode === 'my' ? myLoading : allLoading;

  // Reset form when dialog opens
  const handleOpenCreateDialog = () => {
    const invoiceDate = new Date().toISOString().split('T')[0];
    const defaultTerms = 'net_30';
    setFormData({
      invoice_number: nextNumber?.invoice_number || '',
      invoice_date: invoiceDate,
      due_date: calculateDueDate(invoiceDate, defaultTerms),
      invoicer_name: prefillData?.invoicer_name || '',
      invoicer_email: prefillData?.invoicer_email || '',
      invoicer_phone: prefillData?.invoicer_phone || '',
      invoicer_address: prefillData?.invoicer_address || '',
      bill_to_name: prefillData?.bill_to_name || '',
      production_title: prefillData?.production_title || '',
      position_role: prefillData?.position_role || '',
      payment_terms: defaultTerms,
      tax_rate: 0,
    });
    setShowCreateDialog(true);
  };

  const handleCreateInvoice = async () => {
    if (!formData.invoicer_name || !formData.bill_to_name || !formData.invoice_date) {
      toast({
        title: 'Missing Required Fields',
        description: 'Please fill in invoicer name, bill to name, and invoice date.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createInvoice.mutateAsync(formData as InvoiceInput);
      toast({ title: 'Invoice Created', description: `Invoice ${result.invoice_number} created.` });
      setShowCreateDialog(false);
      setSelectedInvoiceId(result.id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddLineItem = async () => {
    if (!lineItemForm.description || !lineItemForm.rate_amount) {
      toast({
        title: 'Missing Fields',
        description: 'Description and rate amount are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addLineItem.mutateAsync({
        description: lineItemForm.description,
        rate_type: lineItemForm.rate_type as any,
        rate_amount: parseFloat(lineItemForm.rate_amount),
        quantity: parseFloat(lineItemForm.quantity) || 1,
        units: lineItemForm.units || undefined,
      });
      toast({ title: 'Line Item Added' });
      setShowAddLineItemDialog(false);
      setLineItemForm({ description: '', rate_type: 'flat', rate_amount: '', quantity: '1', units: '' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSendInvoice = async () => {
    if (!selectedInvoiceId) return;
    try {
      await sendInvoice.mutateAsync(selectedInvoiceId);
      toast({ title: 'Invoice Sent', description: 'Invoice marked as sent.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedInvoiceId) return;
    try {
      await markPaid.mutateAsync({ invoiceId: selectedInvoiceId });
      toast({ title: 'Invoice Paid', description: 'Invoice marked as paid.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoiceId) return;
    try {
      await deleteInvoice.mutateAsync(selectedInvoiceId);
      toast({ title: 'Invoice Deleted' });
      setSelectedInvoiceId(null);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedInvoice) return;
    setIsGeneratingPdf(true);
    try {
      // generateInvoicePdf handles download internally via doc.save()
      await generateInvoicePdf(selectedInvoice);
      toast({ title: 'PDF Downloaded' });
    } catch (error: any) {
      console.error('[Invoice PDF] Generation failed:', error);
      toast({
        title: 'PDF Generation Failed',
        description: error.message || 'Failed to generate PDF. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Approval workflow handlers
  const handleSendOptionSelected = async () => {
    if (!selectedInvoiceId || !selectedInvoice) return;

    if (sendOption === 'approval') {
      // Submit for manager approval
      try {
        await submitForApproval.mutateAsync(selectedInvoiceId);
        toast({ title: 'Invoice Submitted', description: 'Your invoice has been submitted for approval.' });
        setShowSendOptionsDialog(false);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } else {
      // Open in email with PDF download
      await handleOpenInEmail();
    }
  };

  const handleOpenInEmail = async () => {
    if (!selectedInvoice) return;

    setIsGeneratingPdf(true);
    try {
      // 1. Generate and download PDF
      await generateInvoicePdf(selectedInvoice);

      // 2. Build mailto link
      const subject = encodeURIComponent(`Invoice ${selectedInvoice.invoice_number} - ${selectedInvoice.invoicer_name}`);
      const body = encodeURIComponent(
        `Please find attached invoice ${selectedInvoice.invoice_number}.\n\n` +
        `Amount Due: ${formatCurrency(selectedInvoice.total_amount)}\n` +
        `Due Date: ${selectedInvoice.due_date ? formatInvoiceDate(selectedInvoice.due_date) : 'Upon Receipt'}\n\n` +
        `Thank you for your business.\n\n` +
        `${selectedInvoice.invoicer_name}`
      );
      const recipient = selectedInvoice.bill_to_email || '';

      // 3. Open mailto
      window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;

      toast({
        title: 'PDF Downloaded',
        description: 'Attach the downloaded PDF to your email.',
      });
      setShowSendOptionsDialog(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedInvoiceId) return;
    try {
      await approveInvoice.mutateAsync(selectedInvoiceId);
      toast({ title: 'Invoice Approved', description: 'The invoice has been approved.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedInvoiceId || !changeRequestReason.trim()) return;
    try {
      await requestChanges.mutateAsync({
        invoiceId: selectedInvoiceId,
        reason: changeRequestReason,
      });
      toast({ title: 'Changes Requested', description: 'The crew member has been notified.' });
      setShowRequestChangesDialog(false);
      setChangeRequestReason('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleMarkSent = async () => {
    if (!selectedInvoiceId) return;
    try {
      await markSent.mutateAsync(selectedInvoiceId);
      toast({ title: 'Invoice Marked as Sent', description: 'The invoice status has been updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleResubmit = async () => {
    if (!selectedInvoiceId) return;
    try {
      await submitForApproval.mutateAsync(selectedInvoiceId);
      toast({ title: 'Invoice Resubmitted', description: 'Your invoice has been resubmitted for approval.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Import items handlers
  const resetImportSelections = () => {
    setSelectedTimecards([]);
    setSelectedMileage([]);
    setSelectedKitRentals([]);
    setSelectedPerDiem([]);
    setSelectedReceipts([]);
  };

  const handleOpenImportDialog = () => {
    resetImportSelections();
    setShowImportDialog(true);
  };

  const handleImportItems = async () => {
    if (!selectedInvoiceId) return;

    let totalImported = 0;

    try {
      // Import timecards
      if (selectedTimecards.length > 0) {
        const result = await importTimecards.mutateAsync(selectedTimecards);
        totalImported += result.imported_count;
      }

      // Import expenses (mileage, kit rentals, per diem, receipts)
      if (selectedMileage.length || selectedKitRentals.length ||
          selectedPerDiem.length || selectedReceipts.length) {
        const result = await importExpenses.mutateAsync({
          mileage_ids: selectedMileage,
          kit_rental_ids: selectedKitRentals,
          per_diem_ids: selectedPerDiem,
          receipt_ids: selectedReceipts,
        });
        totalImported += result.imported_count;
      }

      toast({
        title: 'Items Imported',
        description: `${totalImported} item${totalImported !== 1 ? 's' : ''} added to invoice.`
      });
      setShowImportDialog(false);
      resetImportSelections();
    } catch (error: any) {
      toast({ title: 'Import Failed', description: error.message, variant: 'destructive' });
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleItemSelection = (
    id: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(i => i !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const selectAllInCategory = (
    ids: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setSelected(ids);
  };

  const deselectAllInCategory = (
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setSelected([]);
  };

  // Calculate total for selected import items
  const calculateSelectedTotal = useMemo(() => {
    if (!importableData) return 0;

    let total = 0;

    // Timecards
    importableData.approved_timecards
      .filter(t => selectedTimecards.includes(t.id))
      .forEach(t => {
        total += (t.rate_amount || 0) * t.total_hours;
      });

    // Kit rentals
    importableData.approved_kit_rentals
      .filter(k => selectedKitRentals.includes(k.id))
      .forEach(k => {
        total += k.total_amount;
      });

    // Mileage
    importableData.approved_mileage
      .filter(m => selectedMileage.includes(m.id))
      .forEach(m => {
        total += m.total_amount;
      });

    // Per diem
    importableData.approved_per_diem
      .filter(p => selectedPerDiem.includes(p.id))
      .forEach(p => {
        total += p.amount;
      });

    // Receipts
    importableData.approved_receipts
      .filter(r => selectedReceipts.includes(r.id))
      .forEach(r => {
        total += r.amount;
      });

    return total;
  }, [importableData, selectedTimecards, selectedKitRentals, selectedMileage, selectedPerDiem, selectedReceipts]);

  const totalSelectedItems =
    selectedTimecards.length + selectedKitRentals.length +
    selectedMileage.length + selectedPerDiem.length + selectedReceipts.length;

  const hasImportableItems = importableData && (
    importableData.approved_timecards.length > 0 ||
    importableData.approved_kit_rentals.length > 0 ||
    importableData.approved_mileage.length > 0 ||
    importableData.approved_per_diem.length > 0 ||
    importableData.approved_receipts.length > 0
  );

  // Source type display config
  const SOURCE_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    timecard: { icon: Clock, label: 'Timecard', color: 'text-blue-400' },
    kit_rental: { icon: Package, label: 'Kit Rental', color: 'text-purple-400' },
    mileage: { icon: Car, label: 'Mileage', color: 'text-green-400' },
    per_diem: { icon: Utensils, label: 'Per Diem', color: 'text-orange-400' },
    receipt: { icon: Receipt, label: 'Receipt', color: 'text-amber-400' },
    manual: { icon: Edit, label: 'Manual', color: 'text-muted-gray' },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Invoices</h2>
          <p className="text-sm text-muted-gray">Create and manage your invoices</p>
        </div>
        {canEdit && (
          <Button onClick={handleOpenCreateDialog} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-gray" />
                <span className="text-sm text-muted-gray">Draft</span>
              </div>
              <p className="text-2xl font-semibold text-bone-white">{summary.draft_count}</p>
            </CardContent>
          </Card>
          {canReview && (summary.pending_approval_count ?? 0) > 0 && (
            <Card className="bg-charcoal-black border-amber-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">Pending Approval</span>
                </div>
                <p className="text-2xl font-semibold text-amber-400">{summary.pending_approval_count}</p>
              </CardContent>
            </Card>
          )}
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-muted-gray">Sent</span>
              </div>
              <p className="text-2xl font-semibold text-bone-white">{summary.sent_count}</p>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-sm text-muted-gray">Paid</span>
              </div>
              <p className="text-2xl font-semibold text-bone-white">{summary.paid_count}</p>
            </CardContent>
          </Card>
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-accent-yellow" />
                <span className="text-sm text-muted-gray">Outstanding</span>
              </div>
              <p className="text-2xl font-semibold text-accent-yellow">{formatCurrency(summary.total_outstanding)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        {canReview && (
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'my' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('my')}
              className={viewMode === 'my' ? 'bg-accent-yellow text-charcoal-black' : ''}
            >
              My Invoices
            </Button>
            <Button
              variant={viewMode === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('all')}
              className={viewMode === 'all' ? 'bg-accent-yellow text-charcoal-black' : ''}
            >
              All Invoices
            </Button>
          </div>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="changes_requested">Changes Requested</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6">
        {/* Invoice List */}
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-bone-white text-lg">
              {viewMode === 'my' ? 'My Invoices' : 'All Invoices'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 bg-muted-gray/10" />
                ))}
              </div>
            ) : queryError ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-70" />
                <p className="text-red-400 font-medium">Unable to load invoices</p>
                <p className="text-muted-gray text-sm mt-2">
                  {queryError instanceof Error ? queryError.message : 'An error occurred'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            ) : !invoices?.length ? (
              <div className="p-8 text-center text-muted-gray">
                <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No invoices yet</p>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleOpenCreateDialog}
                  >
                    Create your first invoice
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-muted-gray/10 max-h-[500px] overflow-y-auto">
                {invoices.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => {
                      setSelectedInvoiceId(inv.id);
                      setShowInvoiceDialog(true);
                    }}
                    className={cn(
                      'w-full p-4 text-left hover:bg-muted-gray/5 transition-colors',
                      selectedInvoiceId === inv.id && 'bg-muted-gray/10'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-bone-white">{inv.invoice_number}</p>
                        <p className="text-sm text-muted-gray">{inv.bill_to_name}</p>
                        {inv.user_name && viewMode === 'all' && (
                          <p className="text-xs text-muted-gray/60">by {inv.user_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-bone-white">{formatCurrency(inv.total_amount)}</p>
                        <Badge variant="outline" className={cn('text-xs mt-1', INVOICE_STATUS_CONFIG[inv.status as InvoiceStatus].color)}>
                          {INVOICE_STATUS_CONFIG[inv.status as InvoiceStatus].label}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-gray mt-2">{formatInvoiceDate(inv.invoice_date)}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>Fill in the invoice details. You can add line items after creating.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label>Invoice Number</Label>
              <Input
                value={formData.invoice_number || ''}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                placeholder="INV-00001"
              />
            </div>
            <div>
              <Label>Invoice Date *</Label>
              <Input
                type="date"
                value={formData.invoice_date || ''}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Your Name *</Label>
              <Input
                value={formData.invoicer_name || ''}
                onChange={(e) => setFormData({ ...formData, invoicer_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
            <div>
              <Label>Your Email</Label>
              <Input
                type="email"
                value={formData.invoicer_email || ''}
                onChange={(e) => setFormData({ ...formData, invoicer_email: e.target.value })}
              />
            </div>
            <div>
              <Label>Your Phone</Label>
              <Input
                value={formData.invoicer_phone || ''}
                onChange={(e) => setFormData({ ...formData, invoicer_phone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Your Address</Label>
              <Input
                value={formData.invoicer_address || ''}
                onChange={(e) => setFormData({ ...formData, invoicer_address: e.target.value })}
              />
            </div>
            <div className="col-span-2 border-t border-muted-gray/20 pt-4">
              <Label>Bill To *</Label>
              <Input
                value={formData.bill_to_name || ''}
                onChange={(e) => setFormData({ ...formData, bill_to_name: e.target.value })}
                placeholder="Production company or contact name"
              />
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={formData.bill_to_company || ''}
                onChange={(e) => setFormData({ ...formData, bill_to_company: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.bill_to_email || ''}
                onChange={(e) => setFormData({ ...formData, bill_to_email: e.target.value })}
              />
            </div>
            <div className="col-span-2 border-t border-muted-gray/20 pt-4">
              <Label>Production Title</Label>
              <Input
                value={formData.production_title || ''}
                onChange={(e) => setFormData({ ...formData, production_title: e.target.value })}
              />
            </div>
            <div>
              <Label>Your Position/Role</Label>
              <Input
                value={formData.position_role || ''}
                onChange={(e) => setFormData({ ...formData, position_role: e.target.value })}
              />
            </div>
            <div>
              <Label>PO Number</Label>
              <Input
                value={formData.po_number || ''}
                onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
              />
            </div>
            <div>
              <Label>Payment Terms</Label>
              <Select
                value={formData.payment_terms || 'net_30'}
                onValueChange={(v) => {
                  const newDueDate = calculateDueDate(formData.invoice_date || '', v);
                  setFormData({ ...formData, payment_terms: v as any, due_date: newDueDate || formData.due_date });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={formData.due_date || ''}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
              <p className="text-xs text-muted-gray mt-1">Auto-set from payment terms, but can be overridden</p>
            </div>
            <div>
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                value={formData.tax_rate || 0}
                onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                min={0}
                max={100}
                step={0.5}
              />
            </div>
            <div className="col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes or payment instructions..."
                rows={3}
              />
            </div>
          </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={createInvoice.isPending}>
              {createInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Line Item Dialog */}
      <Dialog open={showAddLineItemDialog} onOpenChange={setShowAddLineItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Description *</Label>
              <Input
                value={lineItemForm.description}
                onChange={(e) => setLineItemForm({ ...lineItemForm, description: e.target.value })}
                placeholder="e.g., Camera Operator - Day Rate"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rate Type</Label>
                <Select
                  value={lineItemForm.rate_type}
                  onValueChange={(v) => setLineItemForm({ ...lineItemForm, rate_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rate Amount *</Label>
                <Input
                  type="number"
                  value={lineItemForm.rate_amount}
                  onChange={(e) => setLineItemForm({ ...lineItemForm, rate_amount: e.target.value })}
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                />
              </div>
            </div>
            {lineItemForm.rate_type !== 'flat' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={lineItemForm.quantity}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, quantity: e.target.value })}
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <Label>Units</Label>
                  <Input
                    value={lineItemForm.units}
                    onChange={(e) => setLineItemForm({ ...lineItemForm, units: e.target.value })}
                    placeholder="hours, days, etc."
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLineItemDialog(false)}>Cancel</Button>
            <Button onClick={handleAddLineItem} disabled={addLineItem.isPending}>
              {addLineItem.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog - Full screen on mobile */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col sm:max-w-3xl max-sm:w-full max-sm:h-full max-sm:max-h-full max-sm:rounded-none max-sm:m-0">
          {invoiceLoading ? (
            <div className="p-8 space-y-4">
              <DialogHeader>
                <DialogTitle className="sr-only">Loading Invoice</DialogTitle>
              </DialogHeader>
              <Skeleton className="h-8 w-48 bg-muted-gray/10" />
              <Skeleton className="h-24 bg-muted-gray/10" />
              <Skeleton className="h-32 bg-muted-gray/10" />
            </div>
          ) : invoiceError ? (
            <div className="py-16 text-center">
              <DialogHeader>
                <DialogTitle className="sr-only">Error Loading Invoice</DialogTitle>
              </DialogHeader>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400 opacity-70" />
              <p className="text-red-400 font-medium">Unable to load invoice</p>
              <p className="text-muted-gray text-sm mt-2">
                {invoiceError instanceof Error ? invoiceError.message : 'An error occurred'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowInvoiceDialog(false)}
              >
                Close
              </Button>
            </div>
          ) : selectedInvoice ? (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="text-2xl">{selectedInvoice.invoice_number}</DialogTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className={cn('text-sm', INVOICE_STATUS_CONFIG[selectedInvoice.status as InvoiceStatus].color)}>
                        {INVOICE_STATUS_CONFIG[selectedInvoice.status as InvoiceStatus].label}
                      </Badge>
                      {selectedInvoice.production_title && (
                        <span className="text-muted-gray text-sm">{selectedInvoice.production_title}</span>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                {/* From / To Section */}
                <div className="grid grid-cols-2 gap-6 p-4 bg-muted-gray/5 rounded-lg">
                  <div>
                    <p className="text-muted-gray text-xs uppercase font-medium mb-2">From</p>
                    <p className="text-bone-white font-semibold">{selectedInvoice.invoicer_name}</p>
                    {selectedInvoice.invoicer_email && <p className="text-muted-gray text-sm">{selectedInvoice.invoicer_email}</p>}
                    {selectedInvoice.invoicer_phone && <p className="text-muted-gray text-sm">{selectedInvoice.invoicer_phone}</p>}
                    {selectedInvoice.invoicer_address && <p className="text-muted-gray text-sm">{selectedInvoice.invoicer_address}</p>}
                    {selectedInvoice.position_role && <p className="text-muted-gray text-sm mt-1">Role: {selectedInvoice.position_role}</p>}
                  </div>
                  <div>
                    <p className="text-muted-gray text-xs uppercase font-medium mb-2">Bill To</p>
                    <p className="text-bone-white font-semibold">{selectedInvoice.bill_to_name}</p>
                    {selectedInvoice.bill_to_company && <p className="text-muted-gray text-sm">{selectedInvoice.bill_to_company}</p>}
                    {selectedInvoice.bill_to_email && <p className="text-muted-gray text-sm">{selectedInvoice.bill_to_email}</p>}
                    {selectedInvoice.bill_to_address && <p className="text-muted-gray text-sm">{selectedInvoice.bill_to_address}</p>}
                  </div>
                </div>

                {/* Dates & Details */}
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-muted-gray text-xs uppercase">Invoice Date</p>
                    <p className="text-bone-white font-medium">{formatInvoiceDate(selectedInvoice.invoice_date)}</p>
                  </div>
                  {selectedInvoice.due_date && (
                    <div>
                      <p className="text-muted-gray text-xs uppercase">Due Date</p>
                      <p className="text-bone-white font-medium">{formatInvoiceDate(selectedInvoice.due_date)}</p>
                    </div>
                  )}
                  {selectedInvoice.po_number && (
                    <div>
                      <p className="text-muted-gray text-xs uppercase">PO Number</p>
                      <p className="text-bone-white font-medium">{selectedInvoice.po_number}</p>
                    </div>
                  )}
                  {selectedInvoice.payment_terms && (
                    <div>
                      <p className="text-muted-gray text-xs uppercase">Payment Terms</p>
                      <p className="text-bone-white font-medium">
                        {PAYMENT_TERMS_OPTIONS.find(o => o.value === selectedInvoice.payment_terms)?.label || selectedInvoice.payment_terms}
                      </p>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-muted-gray text-xs uppercase font-medium">Line Items</p>
                    {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => setShowAddLineItemDialog(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Item
                      </Button>
                    )}
                  </div>
                  {selectedInvoice.line_items?.length ? (
                    <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-muted-gray/20 bg-muted-gray/5">
                            {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && <TableHead className="w-12"></TableHead>}
                            <TableHead className="text-muted-gray">Description</TableHead>
                            <TableHead className="text-muted-gray text-right">Qty</TableHead>
                            <TableHead className="text-muted-gray text-right">Rate</TableHead>
                            <TableHead className="text-muted-gray text-right">Amount</TableHead>
                            {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && <TableHead className="w-10"></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedInvoice.line_items.map((item, index) => {
                            const sourceConfig = item.source_type && SOURCE_TYPE_CONFIG[item.source_type];
                            const SourceIcon = sourceConfig?.icon;
                            const isFirst = index === 0;
                            const isLast = index === selectedInvoice.line_items!.length - 1;
                            return (
                            <TableRow key={item.id} className="border-muted-gray/10">
                              {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && (
                                <TableCell className="w-12">
                                  <div className="flex flex-col gap-0.5">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => reorderLineItem.mutate({ line_item_id: item.id, direction: 'UP' })}
                                      disabled={isFirst || reorderLineItem.isPending}
                                      title="Move up"
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => reorderLineItem.mutate({ line_item_id: item.id, direction: 'DOWN' })}
                                      disabled={isLast || reorderLineItem.isPending}
                                      title="Move down"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                              <TableCell className="text-bone-white">
                                <div>
                                  <p>{item.description}</p>
                                  {item.service_date_start && (
                                    <p className="text-xs text-muted-gray">
                                      {formatInvoiceDate(item.service_date_start)}
                                      {item.service_date_end && ` - ${formatInvoiceDate(item.service_date_end)}`}
                                    </p>
                                  )}
                                  {sourceConfig && SourceIcon && item.source_type !== 'manual' && (
                                    <p className={cn("text-xs flex items-center gap-1 mt-1", sourceConfig.color)}>
                                      <SourceIcon className="w-3 h-3" />
                                      from {sourceConfig.label}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-muted-gray">
                                {item.rate_type !== 'flat' ? `${item.quantity} ${item.units || ''}` : '-'}
                              </TableCell>
                              <TableCell className="text-right text-muted-gray">{formatCurrency(item.rate_amount)}</TableCell>
                              <TableCell className="text-right text-bone-white font-medium">{formatCurrency(item.line_total)}</TableCell>
                              {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && (
                                <TableCell>
                                  {item.source_type && item.source_type !== 'manual' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => unlinkLineItem.mutate(item.id)}
                                      className="h-8 w-8 p-0"
                                      title="Unlink (remove from invoice, make available for re-import)"
                                    >
                                      <Unlink2 className="w-4 h-4 text-amber-400" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deleteLineItem.mutate(item.id)}
                                      className="h-8 w-8 p-0"
                                      title="Delete"
                                    >
                                      <X className="w-4 h-4 text-red-400" />
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-gray border border-dashed border-muted-gray/20 rounded-lg">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No line items yet</p>
                      {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAddLineItemDialog(true)}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add First Item
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="border-t border-muted-gray/20 pt-4">
                  <div className="flex flex-col items-end space-y-2">
                    <div className="flex justify-between w-48 text-sm">
                      <span className="text-muted-gray">Subtotal</span>
                      <span className="text-bone-white">{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    {selectedInvoice.tax_rate > 0 && (
                      <div className="flex justify-between w-48 text-sm">
                        <span className="text-muted-gray">Tax ({selectedInvoice.tax_rate}%)</span>
                        <span className="text-bone-white">{formatCurrency(selectedInvoice.tax_amount)}</span>
                      </div>
                    )}
                    {selectedInvoice.discount_amount > 0 && (
                      <div className="flex justify-between w-48 text-sm">
                        <span className="text-muted-gray">Discount</span>
                        <span className="text-bone-white">-{formatCurrency(selectedInvoice.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between w-48 text-lg font-bold pt-2 border-t border-muted-gray/20">
                      <span className="text-bone-white">Total</span>
                      <span className="text-accent-yellow">{formatCurrency(selectedInvoice.total_amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Change Request Reason */}
                {selectedInvoice.status === 'changes_requested' && selectedInvoice.change_request_reason && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-400 text-xs uppercase font-medium mb-2">Changes Requested</p>
                    <p className="text-sm text-bone-white whitespace-pre-wrap">{selectedInvoice.change_request_reason}</p>
                  </div>
                )}

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div className="p-4 bg-muted-gray/5 rounded-lg">
                    <p className="text-muted-gray text-xs uppercase font-medium mb-2">Notes</p>
                    <p className="text-sm text-bone-white whitespace-pre-wrap">{selectedInvoice.notes}</p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <DialogFooter className="flex-shrink-0 border-t border-muted-gray/20 pt-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3">
                  <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} className="order-last sm:order-first">
                    Close
                  </Button>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Download PDF - always available */}
                    <Button
                      variant="outline"
                      onClick={handleDownloadPdf}
                      disabled={isGeneratingPdf || !selectedInvoice.line_items?.length}
                    >
                      {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                      Download PDF
                    </Button>

                    {/* Import Items - for draft and changes_requested */}
                    {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && hasImportableItems && (
                      <Button
                        variant="outline"
                        onClick={handleOpenImportDialog}
                        className="relative"
                      >
                        <Import className="w-4 h-4 mr-2" />
                        Import Items
                        {pendingImportCount && pendingImportCount.total > 0 && (
                          <Badge className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1.5 text-xs bg-blue-500">
                            {pendingImportCount.total}
                          </Badge>
                        )}
                      </Button>
                    )}

                    {/* Edit - for draft and changes_requested */}
                    {(selectedInvoice.status === 'draft' || selectedInvoice.status === 'changes_requested') && canEdit && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFormData({
                            invoice_number: selectedInvoice.invoice_number,
                            invoice_date: selectedInvoice.invoice_date,
                            due_date: selectedInvoice.due_date || '',
                            invoicer_name: selectedInvoice.invoicer_name,
                            invoicer_email: selectedInvoice.invoicer_email || '',
                            invoicer_phone: selectedInvoice.invoicer_phone || '',
                            invoicer_address: selectedInvoice.invoicer_address || '',
                            bill_to_name: selectedInvoice.bill_to_name,
                            bill_to_company: selectedInvoice.bill_to_company || '',
                            bill_to_email: selectedInvoice.bill_to_email || '',
                            production_title: selectedInvoice.production_title || '',
                            position_role: selectedInvoice.position_role || '',
                            po_number: selectedInvoice.po_number || '',
                            payment_terms: selectedInvoice.payment_terms || 'net_30',
                            tax_rate: selectedInvoice.tax_rate || 0,
                            notes: selectedInvoice.notes || '',
                          });
                          setShowInvoiceDialog(false);
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Invoice
                      </Button>
                    )}

                    {/* DRAFT: Send Invoice (opens options dialog) */}
                    {selectedInvoice.status === 'draft' && canEdit && (
                      <Button
                        onClick={() => setShowSendOptionsDialog(true)}
                        disabled={!selectedInvoice.line_items?.length}
                        className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Send Invoice
                      </Button>
                    )}

                    {/* CHANGES_REQUESTED: Resubmit */}
                    {selectedInvoice.status === 'changes_requested' && canEdit && (
                      <Button
                        onClick={handleResubmit}
                        disabled={!selectedInvoice.line_items?.length || submitForApproval.isPending}
                        className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                      >
                        {submitForApproval.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        Resubmit
                      </Button>
                    )}

                    {/* PENDING_APPROVAL: Manager actions */}
                    {selectedInvoice.status === 'pending_approval' && canReview && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setShowRequestChangesDialog(true)}
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Request Changes
                        </Button>
                        <Button
                          onClick={handleApprove}
                          disabled={approveInvoice.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {approveInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                          Approve
                        </Button>
                      </>
                    )}

                    {/* APPROVED: Crew can open in email or mark sent, Manager can mark paid */}
                    {selectedInvoice.status === 'approved' && (
                      <>
                        {canEdit && (
                          <>
                            <Button
                              variant="outline"
                              onClick={handleOpenInEmail}
                              disabled={isGeneratingPdf}
                            >
                              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                              Open in Email
                            </Button>
                            <Button
                              onClick={handleMarkSent}
                              disabled={markSent.isPending}
                              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                            >
                              {markSent.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                              Mark as Sent
                            </Button>
                          </>
                        )}
                        {canReview && (
                          <Button onClick={handleMarkPaid} className="bg-green-600 hover:bg-green-700 text-white">
                            <Check className="w-4 h-4 mr-2" />
                            Mark as Paid
                          </Button>
                        )}
                      </>
                    )}

                    {/* SENT/OVERDUE: Manager can mark paid */}
                    {(selectedInvoice.status === 'sent' || selectedInvoice.status === 'overdue') && canReview && (
                      <Button onClick={handleMarkPaid} className="bg-green-600 hover:bg-green-700 text-white">
                        <Check className="w-4 h-4 mr-2" />
                        Mark as Paid
                      </Button>
                    )}
                  </div>
                </div>
              </DialogFooter>
            </>
          ) : (
            <div className="py-16 text-center text-muted-gray">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Invoice not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Invoice</DialogTitle>
            <DialogDescription>Update invoice details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4 py-4">
              <div>
                <Label>Invoice Number</Label>
                <Input
                  value={formData.invoice_number || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  disabled
                />
              </div>
              <div>
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={formData.invoice_date || ''}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Your Name *</Label>
                <Input
                  value={formData.invoicer_name || ''}
                  onChange={(e) => setFormData({ ...formData, invoicer_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Your Email</Label>
                <Input
                  type="email"
                  value={formData.invoicer_email || ''}
                  onChange={(e) => setFormData({ ...formData, invoicer_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Your Phone</Label>
                <Input
                  value={formData.invoicer_phone || ''}
                  onChange={(e) => setFormData({ ...formData, invoicer_phone: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Your Address</Label>
                <Input
                  value={formData.invoicer_address || ''}
                  onChange={(e) => setFormData({ ...formData, invoicer_address: e.target.value })}
                />
              </div>
              <div className="col-span-2 border-t border-muted-gray/20 pt-4">
                <Label>Bill To *</Label>
                <Input
                  value={formData.bill_to_name || ''}
                  onChange={(e) => setFormData({ ...formData, bill_to_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  value={formData.bill_to_company || ''}
                  onChange={(e) => setFormData({ ...formData, bill_to_company: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.bill_to_email || ''}
                  onChange={(e) => setFormData({ ...formData, bill_to_email: e.target.value })}
                />
              </div>
              <div className="col-span-2 border-t border-muted-gray/20 pt-4">
                <Label>Production Title</Label>
                <Input
                  value={formData.production_title || ''}
                  onChange={(e) => setFormData({ ...formData, production_title: e.target.value })}
                />
              </div>
              <div>
                <Label>Your Position/Role</Label>
                <Input
                  value={formData.position_role || ''}
                  onChange={(e) => setFormData({ ...formData, position_role: e.target.value })}
                />
              </div>
              <div>
                <Label>PO Number</Label>
                <Input
                  value={formData.po_number || ''}
                  onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select
                  value={formData.payment_terms || 'net_30'}
                  onValueChange={(v) => {
                    const newDueDate = calculateDueDate(formData.invoice_date || '', v);
                    setFormData({ ...formData, payment_terms: v as any, due_date: newDueDate || formData.due_date });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
                <p className="text-xs text-muted-gray mt-1">Auto-set from payment terms, but can be overridden</p>
              </div>
              <div>
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  value={formData.tax_rate || 0}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  min={0}
                  max={100}
                  step={0.5}
                />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!selectedInvoiceId) return;
                updateInvoice.mutate(formData, {
                  onSuccess: () => {
                    toast({ title: 'Invoice updated' });
                    setShowEditDialog(false);
                    setShowInvoiceDialog(true);
                  },
                  onError: (err) => {
                    toast({ title: 'Failed to update invoice', description: err.message, variant: 'destructive' });
                  },
                });
              }}
              disabled={updateInvoice.isPending}
            >
              {updateInvoice.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Options Dialog */}
      <Dialog open={showSendOptionsDialog} onOpenChange={setShowSendOptionsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Invoice</DialogTitle>
            <DialogDescription>Choose how you want to send this invoice.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <RadioGroup value={sendOption} onValueChange={(v) => setSendOption(v as 'approval' | 'email')}>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-muted-gray/20 hover:bg-muted-gray/5 cursor-pointer mb-3">
                <RadioGroupItem value="approval" id="approval" className="mt-1" />
                <label htmlFor="approval" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-accent-yellow" />
                    <span className="font-medium text-bone-white">Submit to Project</span>
                  </div>
                  <p className="text-sm text-muted-gray mt-1">
                    Submit for manager approval before sending. The manager can approve or request changes.
                  </p>
                </label>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-muted-gray/20 hover:bg-muted-gray/5 cursor-pointer">
                <RadioGroupItem value="email" id="email" className="mt-1" />
                <label htmlFor="email" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span className="font-medium text-bone-white">Open in Email</span>
                  </div>
                  <p className="text-sm text-muted-gray mt-1">
                    Download PDF and open your email client. Invoice stays as draft until you mark it sent.
                  </p>
                </label>
              </div>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendOptionsDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendOptionSelected}
              disabled={submitForApproval.isPending || isGeneratingPdf}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {(submitForApproval.isPending || isGeneratingPdf) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {sendOption === 'approval' ? 'Submit for Approval' : 'Open Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Changes Dialog */}
      <Dialog open={showRequestChangesDialog} onOpenChange={setShowRequestChangesDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Provide feedback to the crew member about what needs to be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Reason for Changes *</Label>
            <Textarea
              value={changeRequestReason}
              onChange={(e) => setChangeRequestReason(e.target.value)}
              placeholder="Please describe what changes are needed..."
              rows={4}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRequestChangesDialog(false);
              setChangeRequestReason('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestChanges}
              disabled={!changeRequestReason.trim() || requestChanges.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {requestChanges.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Request Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Items Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Import Items to Invoice</DialogTitle>
            <DialogDescription>
              Select approved items to add to your invoice.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {importableLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 bg-muted-gray/10" />
                ))}
              </div>
            ) : !hasImportableItems ? (
              <div className="py-8 text-center text-muted-gray">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No approved items available to import</p>
                <p className="text-sm mt-2">Items must be approved in Timecards or Expenses first.</p>
              </div>
            ) : (
              <>
                {/* Timecards Section */}
                {importableData && importableData.approved_timecards.length > 0 && (
                  <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('timecards')}
                      className="w-full flex items-center justify-between p-3 bg-muted-gray/5 hover:bg-muted-gray/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.timecards ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <Clock className="w-4 h-4 text-blue-400" />
                        <span className="font-medium text-bone-white">Timecards</span>
                        <Badge variant="outline" className="ml-2">{importableData.approved_timecards.length}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInCategory(importableData.approved_timecards.map(t => t.id), setSelectedTimecards);
                          }}
                          className="h-6 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deselectAllInCategory(setSelectedTimecards);
                          }}
                          className="h-6 text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    </button>
                    {expandedSections.timecards && (
                      <div className="divide-y divide-muted-gray/10">
                        {importableData.approved_timecards.map((tc) => (
                          <label
                            key={tc.id}
                            className="flex items-center justify-between p-3 hover:bg-muted-gray/5 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedTimecards.includes(tc.id)}
                                onCheckedChange={() => toggleItemSelection(tc.id, selectedTimecards, setSelectedTimecards)}
                              />
                              <div>
                                <p className="text-bone-white">Week of {formatInvoiceDate(tc.week_start_date)}</p>
                                <p className="text-sm text-muted-gray">
                                  {tc.total_hours} hrs{tc.total_overtime > 0 && ` (+${tc.total_overtime} OT)`}
                                  {tc.rate_amount && ` @ ${formatCurrency(tc.rate_amount)}`}
                                </p>
                              </div>
                            </div>
                            <span className="text-bone-white font-medium">
                              {formatCurrency((tc.rate_amount || 0) * tc.total_hours)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Kit Rentals Section */}
                {importableData && importableData.approved_kit_rentals.length > 0 && (
                  <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('kit_rentals')}
                      className="w-full flex items-center justify-between p-3 bg-muted-gray/5 hover:bg-muted-gray/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.kit_rentals ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <Package className="w-4 h-4 text-purple-400" />
                        <span className="font-medium text-bone-white">Kit Rentals</span>
                        <Badge variant="outline" className="ml-2">{importableData.approved_kit_rentals.length}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInCategory(importableData.approved_kit_rentals.map(k => k.id), setSelectedKitRentals);
                          }}
                          className="h-6 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deselectAllInCategory(setSelectedKitRentals);
                          }}
                          className="h-6 text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    </button>
                    {expandedSections.kit_rentals && (
                      <div className="divide-y divide-muted-gray/10">
                        {importableData.approved_kit_rentals.map((kit) => (
                          <label
                            key={kit.id}
                            className="flex items-center justify-between p-3 hover:bg-muted-gray/5 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedKitRentals.includes(kit.id)}
                                onCheckedChange={() => toggleItemSelection(kit.id, selectedKitRentals, setSelectedKitRentals)}
                              />
                              <div>
                                <p className="text-bone-white">{kit.kit_name}</p>
                                <p className="text-sm text-muted-gray">
                                  {formatInvoiceDate(kit.start_date)}
                                  {kit.end_date && ` - ${formatInvoiceDate(kit.end_date)}`}
                                  {` @ ${formatCurrency(kit.daily_rate)}/day`}
                                </p>
                              </div>
                            </div>
                            <span className="text-bone-white font-medium">
                              {formatCurrency(kit.total_amount)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Mileage Section */}
                {importableData && importableData.approved_mileage.length > 0 && (
                  <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('mileage')}
                      className="w-full flex items-center justify-between p-3 bg-muted-gray/5 hover:bg-muted-gray/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.mileage ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <Car className="w-4 h-4 text-green-400" />
                        <span className="font-medium text-bone-white">Mileage</span>
                        <Badge variant="outline" className="ml-2">{importableData.approved_mileage.length}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInCategory(importableData.approved_mileage.map(m => m.id), setSelectedMileage);
                          }}
                          className="h-6 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deselectAllInCategory(setSelectedMileage);
                          }}
                          className="h-6 text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    </button>
                    {expandedSections.mileage && (
                      <div className="divide-y divide-muted-gray/10">
                        {importableData.approved_mileage.map((mile) => (
                          <label
                            key={mile.id}
                            className="flex items-center justify-between p-3 hover:bg-muted-gray/5 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedMileage.includes(mile.id)}
                                onCheckedChange={() => toggleItemSelection(mile.id, selectedMileage, setSelectedMileage)}
                              />
                              <div>
                                <p className="text-bone-white">{mile.description || 'Mileage'}</p>
                                <p className="text-sm text-muted-gray">{formatInvoiceDate(mile.date)}</p>
                              </div>
                            </div>
                            <span className="text-bone-white font-medium">
                              {formatCurrency(mile.total_amount)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Per Diem Section */}
                {importableData && importableData.approved_per_diem.length > 0 && (
                  <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('per_diem')}
                      className="w-full flex items-center justify-between p-3 bg-muted-gray/5 hover:bg-muted-gray/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.per_diem ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <Utensils className="w-4 h-4 text-orange-400" />
                        <span className="font-medium text-bone-white">Per Diem</span>
                        <Badge variant="outline" className="ml-2">{importableData.approved_per_diem.length}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInCategory(importableData.approved_per_diem.map(p => p.id), setSelectedPerDiem);
                          }}
                          className="h-6 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deselectAllInCategory(setSelectedPerDiem);
                          }}
                          className="h-6 text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    </button>
                    {expandedSections.per_diem && (
                      <div className="divide-y divide-muted-gray/10">
                        {importableData.approved_per_diem.map((pd) => (
                          <label
                            key={pd.id}
                            className="flex items-center justify-between p-3 hover:bg-muted-gray/5 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedPerDiem.includes(pd.id)}
                                onCheckedChange={() => toggleItemSelection(pd.id, selectedPerDiem, setSelectedPerDiem)}
                              />
                              <div>
                                <p className="text-bone-white capitalize">{pd.meal_type.replace('_', ' ')}</p>
                                <p className="text-sm text-muted-gray">{formatInvoiceDate(pd.date)}</p>
                              </div>
                            </div>
                            <span className="text-bone-white font-medium">
                              {formatCurrency(pd.amount)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Receipts Section */}
                {importableData && importableData.approved_receipts.length > 0 && (
                  <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleSection('receipts')}
                      className="w-full flex items-center justify-between p-3 bg-muted-gray/5 hover:bg-muted-gray/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {expandedSections.receipts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <Receipt className="w-4 h-4 text-amber-400" />
                        <span className="font-medium text-bone-white">Receipts</span>
                        <Badge variant="outline" className="ml-2">{importableData.approved_receipts.length}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInCategory(importableData.approved_receipts.map(r => r.id), setSelectedReceipts);
                          }}
                          className="h-6 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deselectAllInCategory(setSelectedReceipts);
                          }}
                          className="h-6 text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    </button>
                    {expandedSections.receipts && (
                      <div className="divide-y divide-muted-gray/10">
                        {importableData.approved_receipts.map((rcpt) => (
                          <label
                            key={rcpt.id}
                            className="flex items-center justify-between p-3 hover:bg-muted-gray/5 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedReceipts.includes(rcpt.id)}
                                onCheckedChange={() => toggleItemSelection(rcpt.id, selectedReceipts, setSelectedReceipts)}
                              />
                              <div>
                                <p className="text-bone-white">{rcpt.description || 'Receipt'}</p>
                                <p className="text-sm text-muted-gray">
                                  {rcpt.purchase_date ? formatInvoiceDate(rcpt.purchase_date) : 'No date'}
                                </p>
                              </div>
                            </div>
                            <span className="text-bone-white font-medium">
                              {formatCurrency(rcpt.amount)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer with summary and actions */}
          <DialogFooter className="flex-shrink-0 border-t border-muted-gray/20 pt-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-3">
              <div className="text-sm text-muted-gray">
                {totalSelectedItems > 0 ? (
                  <>
                    <span className="text-bone-white font-medium">{totalSelectedItems} item{totalSelectedItems !== 1 ? 's' : ''}</span>
                    {' · '}
                    <span className="text-accent-yellow font-medium">{formatCurrency(calculateSelectedTotal)}</span>
                  </>
                ) : (
                  'No items selected'
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImportItems}
                  disabled={totalSelectedItems === 0 || importTimecards.isPending || importExpenses.isPending}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  {(importTimecards.isPending || importExpenses.isPending) && (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  )}
                  Import Selected Items
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesView;
