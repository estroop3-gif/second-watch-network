/**
 * ReceiptsView - Upload, OCR, and manage receipts for budget tracking
 */
import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Receipt,
  Upload,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Download,
  Eye,
  Link as LinkIcon,
  Calendar,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Clock,
  Banknote,
  ThumbsUp,
  ThumbsDown,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';
import {
  useReceipts,
  useReceipt,
  useRegisterReceipt,
  useCreateManualReceipt,
  useReprocessReceiptOcr,
  useUpdateReceipt,
  useMapReceipt,
  useVerifyReceipt,
  useDeleteReceipt,
  useExportReceipts,
  useBudget,
  useBudgetLineItems,
  useBudgetCategories,
  useDailyBudgets,
  useSubmitForReimbursement,
  useApproveReimbursement,
  useRejectReimbursement,
  useMarkReimbursed,
  useSubmitCompanyCard,
  useBulkSubmitReceiptsForApproval,
  useResubmitReimbursement,
} from '@/hooks/backlot';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Building2, Tag, User, Check } from 'lucide-react';
import {
  BacklotReceipt,
  BacklotReceiptOcrStatus,
  BacklotPaymentMethod,
  BacklotReimbursementStatus,
  ReceiptInput,
  ReceiptMappingInput,
  ReceiptFilters,
} from '@/types/backlot';
import SceneSelect from '../shared/SceneSelect';

interface ReceiptsViewProps {
  projectId: string;
  canEdit: boolean;
}

// Format currency
const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// OCR Status Badge
const getOcrStatusBadge = (status: BacklotReceiptOcrStatus) => {
  const styles: Record<BacklotReceiptOcrStatus, { style: string; label: string; icon: React.ReactNode }> = {
    pending: {
      style: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      label: 'Pending',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    processing: {
      style: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      label: 'Processing',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    succeeded: {
      style: 'bg-green-500/20 text-green-400 border-green-500/30',
      label: 'Complete',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    failed: {
      style: 'bg-red-500/20 text-red-400 border-red-500/30',
      label: 'Failed',
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  return styles[status];
};

// Payment Method Labels
const PAYMENT_METHOD_LABELS: Record<BacklotPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  check: 'Check',
  wire: 'Wire Transfer',
  petty_cash: 'Petty Cash',
};

// Reimbursement Status Badge
const getReimbursementStatusBadge = (status: BacklotReimbursementStatus | string | null | undefined) => {
  const styles: Record<string, { style: string; label: string; icon: React.ReactNode }> = {
    not_applicable: {
      style: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
      label: 'No Reimbursement',
      icon: null,
    },
    draft: {
      style: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      label: 'Draft',
      icon: <Edit className="w-3 h-3" />,
    },
    pending: {
      style: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      label: 'Pending',
      icon: <Clock className="w-3 h-3" />,
    },
    approved: {
      style: 'bg-green-500/20 text-green-400 border-green-500/30',
      label: 'Approved',
      icon: <ThumbsUp className="w-3 h-3" />,
    },
    reimbursed: {
      style: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      label: 'Reimbursed',
      icon: <Banknote className="w-3 h-3" />,
    },
    changes_requested: {
      style: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      label: 'Changes Requested',
      icon: <Edit className="w-3 h-3" />,
    },
    denied: {
      style: 'bg-red-500/20 text-red-400 border-red-500/30',
      label: 'Denied',
      icon: <XCircle className="w-3 h-3" />,
    },
    rejected: {
      style: 'bg-red-500/20 text-red-400 border-red-500/30',
      label: 'Rejected',
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  // Default to not_applicable for unknown statuses
  return styles[status || 'not_applicable'] || styles['not_applicable'];
};

// Receipt Card
const ReceiptCard: React.FC<{
  receipt: BacklotReceipt;
  currency: string;
  canEdit: boolean;
  isManager: boolean;
  onView: (receipt: BacklotReceipt) => void;
  onEdit: (receipt: BacklotReceipt) => void;
  onMap: (receipt: BacklotReceipt) => void;
  onVerify: (receipt: BacklotReceipt) => void;
  onReprocess: (receipt: BacklotReceipt) => void;
  onDelete: (receipt: BacklotReceipt) => void;
  onSubmitReimbursement: (receipt: BacklotReceipt) => void;
  onSendForApproval: (receipt: BacklotReceipt) => void;
  onApproveReimbursement: (receipt: BacklotReceipt) => void;
  onRejectReimbursement: (receipt: BacklotReceipt) => void;
  onMarkReimbursed: (receipt: BacklotReceipt) => void;
  onEditAndResubmit: (receipt: BacklotReceipt) => void;
}> = ({
  receipt,
  currency,
  canEdit,
  isManager,
  onView,
  onEdit,
  onMap,
  onVerify,
  onReprocess,
  onDelete,
  onSubmitReimbursement,
  onSendForApproval,
  onApproveReimbursement,
  onRejectReimbursement,
  onMarkReimbursed,
  onEditAndResubmit,
}) => {
  const ocrStatus = getOcrStatusBadge(receipt.ocr_status || 'pending');
  const reimbursementStatus = getReimbursementStatusBadge(receipt.reimbursement_status || 'not_applicable');
  const isImage = receipt.file_type?.startsWith('image/');

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden hover:border-muted-gray/40 transition-colors">
      {/* Thumbnail / Preview */}
      <div
        className="h-32 bg-charcoal-black/80 relative cursor-pointer group"
        onClick={() => onView(receipt)}
      >
        {isImage ? (
          <img
            src={receipt.file_url}
            alt={receipt.original_filename || 'Receipt'}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="w-12 h-12 text-muted-gray/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black/80 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <Badge className={ocrStatus.style}>
            {ocrStatus.icon}
            <span className="ml-1">{ocrStatus.label}</span>
          </Badge>
          {receipt.is_verified && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="secondary" className="h-8 w-8">
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        {/* Vendor & Amount */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-medium text-bone-white truncate">
              {receipt.vendor_name || 'Unknown Vendor'}
            </h4>
            {receipt.description && (
              <p className="text-xs text-muted-gray truncate">{receipt.description}</p>
            )}
          </div>
          {receipt.amount !== null && (
            <div className="text-right flex-shrink-0">
              <div className="font-bold text-bone-white">
                {formatCurrency(receipt.amount, currency)}
              </div>
              {receipt.tax_amount !== null && receipt.tax_amount > 0 && (
                <div className="text-xs text-muted-gray">
                  +{formatCurrency(receipt.tax_amount)} tax
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date & Mapping Status */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-gray">
            <Calendar className="w-3 h-3" />
            {receipt.purchase_date
              ? format(parseLocalDate(receipt.purchase_date), 'MMM d, yyyy')
              : 'No date'}
          </div>
          {receipt.is_mapped ? (
            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
              <LinkIcon className="w-3 h-3 mr-1" />
              Mapped
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Unmapped
            </Badge>
          )}
        </div>

        {/* Expense Type / Reimbursement Status */}
        {((receipt as any).expense_type === 'company_card' || receipt.reimbursement_status !== 'not_applicable') && (
          <div className="flex items-center justify-end gap-2">
            {(receipt as any).expense_type === 'company_card' && (
              <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Building2 className="w-3 h-3 mr-1" />
                Company Card
              </Badge>
            )}
            {receipt.reimbursement_status !== 'not_applicable' && (
              <Badge className={`text-xs ${reimbursementStatus.style}`}>
                {reimbursementStatus.icon}
                <span className="ml-1">{reimbursementStatus.label}</span>
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="flex items-center justify-end pt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(receipt)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                {!receipt.is_mapped && (
                  <DropdownMenuItem onClick={() => onMap(receipt)}>
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Map to Budget
                  </DropdownMenuItem>
                )}
                {!receipt.is_verified && (
                  <DropdownMenuItem onClick={() => onVerify(receipt)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Verified
                  </DropdownMenuItem>
                )}
                {receipt.ocr_status === 'failed' && (
                  <DropdownMenuItem onClick={() => onReprocess(receipt)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry OCR
                  </DropdownMenuItem>
                )}

                {/* Expense Submission Actions */}
                <DropdownMenuSeparator />

                {/* User can submit expense if not already submitted and not already company card */}
                {(receipt.reimbursement_status === 'not_applicable' || receipt.reimbursement_status === 'draft' || !receipt.reimbursement_status) &&
                 (receipt as any).expense_type !== 'company_card' &&
                 receipt.amount && (
                  <>
                    <DropdownMenuItem onClick={() => onSendForApproval(receipt)}>
                      <Send className="w-4 h-4 mr-2" />
                      Send for Approval
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onSubmitReimbursement(receipt)}>
                      <Building2 className="w-4 h-4 mr-2" />
                      Submit as Company Card
                    </DropdownMenuItem>
                  </>
                )}

                {/* Manager approval actions for pending receipts */}
                {isManager && receipt.reimbursement_status === 'pending' && (
                  <>
                    <DropdownMenuItem
                      className="text-green-400"
                      onClick={() => onApproveReimbursement(receipt)}
                    >
                      <ThumbsUp className="w-4 h-4 mr-2" />
                      Approve Reimbursement
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-400"
                      onClick={() => onRejectReimbursement(receipt)}
                    >
                      <ThumbsDown className="w-4 h-4 mr-2" />
                      Reject Reimbursement
                    </DropdownMenuItem>
                  </>
                )}

                {/* Manager can mark approved as reimbursed */}
                {isManager && receipt.reimbursement_status === 'approved' && (
                  <DropdownMenuItem
                    className="text-blue-400"
                    onClick={() => onMarkReimbursed(receipt)}
                  >
                    <Banknote className="w-4 h-4 mr-2" />
                    Mark as Reimbursed
                  </DropdownMenuItem>
                )}

                {/* User can edit and resubmit if changes were requested or denied */}
                {(receipt.reimbursement_status === 'changes_requested' || receipt.reimbursement_status === 'denied') && (
                  <DropdownMenuItem
                    className="text-orange-400"
                    onClick={() => onEditAndResubmit(receipt)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit & Resubmit
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-400"
                  onClick={() => onDelete(receipt)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
};

// Upload Zone
const UploadZone: React.FC<{
  projectId: string;
  onUploadComplete: (receipt?: BacklotReceipt) => void;
}> = ({ projectId, onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const registerReceipt = useRegisterReceipt();

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);
    let lastUploadedReceipt: BacklotReceipt | undefined;
    try {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);

        // Upload to S3 via API
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch(
          `${API_BASE}/api/v1/backlot/projects/${projectId}/upload-receipt`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          }
        );

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json().catch(() => ({ detail: 'Upload failed' }));
          throw new Error(error.detail);
        }

        const uploadResult = await uploadResponse.json();

        // Register the receipt (skip OCR - use manual entry)
        const receipt = await registerReceipt.mutateAsync({
          projectId,
          fileUrl: uploadResult.file_url,
          originalFilename: file.name,
          fileType: file.type,
          fileSizeBytes: file.size,
          runOcr: false, // Skip OCR, use manual entry
        });
        lastUploadedReceipt = receipt;
      }

      // Pass the last uploaded receipt so we can open edit dialog
      onUploadComplete(lastUploadedReceipt);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
        isDragging
          ? 'border-accent-yellow bg-accent-yellow/10'
          : 'border-muted-gray/30 hover:border-muted-gray/50'
      }`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {isUploading ? (
        <div className="space-y-2">
          <Loader2 className="w-10 h-10 text-accent-yellow mx-auto animate-spin" />
          <p className="text-bone-white">{uploadProgress}</p>
        </div>
      ) : (
        <>
          <Upload className="w-10 h-10 text-muted-gray/50 mx-auto mb-3" />
          <p className="text-bone-white font-medium mb-1">
            Drop receipts here or click to upload
          </p>
          <p className="text-sm text-muted-gray">
            Supports images (JPG, PNG, WebP) and PDF files
          </p>
        </>
      )}
    </div>
  );
};

// Main Receipts View
const ReceiptsView: React.FC<ReceiptsViewProps> = ({ projectId, canEdit }) => {
  const { data: budget } = useBudget(projectId);
  const { data: lineItems } = useBudgetLineItems(budget?.id || null);
  const { data: categories } = useBudgetCategories(budget?.id || null);
  const { data: dailyBudgets } = useDailyBudgets(projectId);

  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const { data: receipts, isLoading, refetch } = useReceipts(projectId, {
    ...filters,
    search: searchQuery || undefined,
  });

  const updateReceipt = useUpdateReceipt();
  const mapReceipt = useMapReceipt();
  const verifyReceipt = useVerifyReceipt();
  const reprocessOcr = useReprocessReceiptOcr();
  const deleteReceipt = useDeleteReceipt();
  const exportReceipts = useExportReceipts();

  // Reimbursement hooks
  const submitReimbursement = useSubmitForReimbursement(projectId);
  const approveReimbursement = useApproveReimbursement(projectId);
  const rejectReimbursement = useRejectReimbursement(projectId);
  const markReimbursed = useMarkReimbursed(projectId);
  const submitCompanyCard = useSubmitCompanyCard(projectId);
  const bulkSubmitForApproval = useBulkSubmitReceiptsForApproval(projectId);
  const resubmitReimbursement = useResubmitReimbursement(projectId);

  // For now, treat canEdit as isManager for approval actions
  // In a real app, this would check the user's role
  const isManager = canEdit;

  // Modal states
  const [showUpload, setShowUpload] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<BacklotReceipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<BacklotReceipt | null>(null);
  const [mappingReceipt, setMappingReceipt] = useState<BacklotReceipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingResubmit, setPendingResubmit] = useState(false);

  // Expense type dialog state
  const [expenseTypeReceipt, setExpenseTypeReceipt] = useState<BacklotReceipt | null>(null);
  const [expenseType, setExpenseType] = useState<'personal' | 'company_card'>('personal');
  const [selectedBudgetCategoryId, setSelectedBudgetCategoryId] = useState<string>('');
  const [selectedBudgetLineItemId, setSelectedBudgetLineItemId] = useState<string>('');

  // Manual entry hook and form
  const createManualReceipt = useCreateManualReceipt();
  const [manualForm, setManualForm] = useState({
    vendor_name: '',
    amount: '',
    purchase_date: new Date().toISOString().split('T')[0],
    description: '',
    payment_method: '' as string,
    tax_amount: '',
  });

  // Edit form
  const [editForm, setEditForm] = useState<ReceiptInput>({});

  // Mapping form
  const [mappingForm, setMappingForm] = useState<ReceiptMappingInput>({});

  const currency = budget?.currency || 'USD';

  // Calculate stats
  const stats = receipts?.reduce(
    (acc, r) => ({
      total: acc.total + (r.amount || 0),
      mapped: acc.mapped + (r.is_mapped ? 1 : 0),
      unmapped: acc.unmapped + (!r.is_mapped ? 1 : 0),
      verified: acc.verified + (r.is_verified ? 1 : 0),
    }),
    { total: 0, mapped: 0, unmapped: 0, verified: 0 }
  ) || { total: 0, mapped: 0, unmapped: 0, verified: 0 };

  // Calculate receipts ready to submit for approval
  const receiptsReadyForApproval = receipts?.filter(
    (r) =>
      (r.reimbursement_status === 'not_applicable' || !r.reimbursement_status) &&
      (r as any).expense_type !== 'company_card' &&
      r.amount && r.amount > 0
  ) || [];
  const readyForApprovalCount = receiptsReadyForApproval.length;
  const readyForApprovalTotal = receiptsReadyForApproval.reduce((sum, r) => sum + (r.amount || 0), 0);

  const handleEditReceipt = (receipt: BacklotReceipt) => {
    setEditingReceipt(receipt);
    setEditForm({
      vendor_name: receipt.vendor_name || '',
      description: receipt.description || '',
      purchase_date: receipt.purchase_date || '',
      amount: receipt.amount || undefined,
      tax_amount: receipt.tax_amount || undefined,
      payment_method: receipt.payment_method || undefined,
      notes: receipt.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReceipt) return;
    setIsSubmitting(true);
    try {
      await updateReceipt.mutateAsync({
        receiptId: editingReceipt.id,
        projectId,
        input: editForm,
      });

      // Backend automatically resets rejected receipts to draft status
      // User can then manually submit for approval again

      setEditingReceipt(null);
      setPendingResubmit(false);
    } catch (err) {
      console.error('Failed to update receipt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMapReceipt = (receipt: BacklotReceipt) => {
    setMappingReceipt(receipt);
    setMappingForm({
      budget_line_item_id: receipt.budget_line_item_id || undefined,
      daily_budget_id: receipt.daily_budget_id || undefined,
      scene_id: (receipt as any).scene_id || undefined,
    });
  };

  const handleSaveMapping = async () => {
    if (!mappingReceipt) return;
    setIsSubmitting(true);
    try {
      await mapReceipt.mutateAsync({
        receiptId: mappingReceipt.id,
        projectId,
        mapping: mappingForm,
      });
      setMappingReceipt(null);
    } catch (err) {
      console.error('Failed to map receipt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (receipt: BacklotReceipt) => {
    try {
      await verifyReceipt.mutateAsync({ receiptId: receipt.id, projectId });
    } catch (err) {
      console.error('Failed to verify receipt:', err);
    }
  };

  const handleReprocess = async (receipt: BacklotReceipt) => {
    try {
      await reprocessOcr.mutateAsync({ receiptId: receipt.id, projectId });
    } catch (err) {
      console.error('Failed to reprocess OCR:', err);
    }
  };

  const handleDelete = async (receipt: BacklotReceipt) => {
    if (!confirm('Delete this receipt?')) return;
    try {
      await deleteReceipt.mutateAsync({ receiptId: receipt.id, projectId });
    } catch (err) {
      console.error('Failed to delete receipt:', err);
    }
  };

  const handleExport = async () => {
    try {
      await exportReceipts.mutateAsync({ projectId, filters });
    } catch (err) {
      console.error('Failed to export receipts:', err);
    }
  };

  // Reimbursement handlers
  const handleOpenExpenseTypeDialog = (receipt: BacklotReceipt) => {
    setExpenseTypeReceipt(receipt);
    setExpenseType('personal');
    setSelectedBudgetCategoryId('');
    setSelectedBudgetLineItemId('');
  };

  const handleSubmitExpenseType = async () => {
    if (!expenseTypeReceipt) return;

    try {
      if (expenseType === 'personal') {
        await submitReimbursement.mutateAsync({ receiptId: expenseTypeReceipt.id });
      } else {
        await submitCompanyCard.mutateAsync({
          receiptId: expenseTypeReceipt.id,
          budgetCategoryId: selectedBudgetCategoryId || undefined,
          budgetLineItemId: selectedBudgetLineItemId || undefined,
        });
      }
      setExpenseTypeReceipt(null);
    } catch (err) {
      console.error('Failed to submit expense:', err);
    }
  };

  const handleSubmitReimbursement = async (receipt: BacklotReceipt) => {
    try {
      await submitReimbursement.mutateAsync({ receiptId: receipt.id });
    } catch (err) {
      console.error('Failed to submit for reimbursement:', err);
    }
  };

  const handleApproveReimbursement = async (receipt: BacklotReceipt) => {
    try {
      await approveReimbursement.mutateAsync(receipt.id);
    } catch (err) {
      console.error('Failed to approve reimbursement:', err);
    }
  };

  const handleRejectReimbursement = async (receipt: BacklotReceipt) => {
    const reason = prompt('Enter rejection reason (optional):');
    try {
      await rejectReimbursement.mutateAsync({ receiptId: receipt.id, reason: reason || undefined });
    } catch (err) {
      console.error('Failed to reject reimbursement:', err);
    }
  };

  const handleMarkReimbursed = async (receipt: BacklotReceipt) => {
    try {
      await markReimbursed.mutateAsync(receipt.id);
    } catch (err) {
      console.error('Failed to mark as reimbursed:', err);
    }
  };

  const handleBulkSendForApproval = async () => {
    if (receiptsReadyForApproval.length === 0) return;

    const receiptIds = receiptsReadyForApproval.map((r) => r.id);
    try {
      await bulkSubmitForApproval.mutateAsync({ receiptIds });
      refetch();
    } catch (err) {
      console.error('Failed to bulk submit for approval:', err);
    }
  };

  // Edit and resubmit handler for receipts with changes_requested or denied status
  const handleEditAndResubmit = (receipt: BacklotReceipt) => {
    setPendingResubmit(true);
    handleEditReceipt(receipt);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl md:text-2xl font-heading text-bone-white">Receipts</h2>
          <p className="text-xs md:text-sm text-muted-gray">
            Upload and manage expense receipts with AI-powered OCR
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 shrink-0 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManualEntry(true)}
            >
              <Plus className="w-4 h-4 shrink-0 sm:mr-2" />
              <span className="hidden sm:inline">Manual Entry</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setShowUpload(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Upload className="w-4 h-4 shrink-0 sm:mr-2" />
              Upload
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-gray mb-1">Total Value</div>
          <div className="text-xl md:text-2xl font-bold text-bone-white">
            {formatCurrency(stats.total, currency)}
          </div>
        </div>
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-gray mb-1">Total Receipts</div>
          <div className="text-xl md:text-2xl font-bold text-bone-white">{receipts?.length || 0}</div>
        </div>
        <div className="bg-charcoal-black/50 border border-green-500/30 rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-gray mb-1">Mapped</div>
          <div className="text-xl md:text-2xl font-bold text-green-400">{stats.mapped}</div>
        </div>
        <div className="bg-charcoal-black/50 border border-yellow-500/30 rounded-lg p-3 md:p-4">
          <div className="text-xs md:text-sm text-muted-gray mb-1">Unmapped</div>
          <div className="text-xl md:text-2xl font-bold text-yellow-400">{stats.unmapped}</div>
        </div>
      </div>

      {/* Bulk Send for Approval Card */}
      {canEdit && readyForApprovalCount > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs md:text-sm text-muted-gray">Ready to Submit for Approval</p>
                <p className="text-xl md:text-2xl font-bold text-amber-400">
                  {readyForApprovalCount} receipt{readyForApprovalCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs md:text-sm text-muted-gray">
                  {formatCurrency(readyForApprovalTotal, currency)} total
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleBulkSendForApproval}
                disabled={bulkSubmitForApproval.isPending}
                className="bg-amber-500 text-charcoal-black hover:bg-amber-400"
              >
                {bulkSubmitForApproval.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send All for Approval
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray" />
          <Input
            placeholder="Search receipts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Select
            value={filters.is_mapped === undefined ? 'all' : String(filters.is_mapped)}
            onValueChange={(v) =>
              setFilters({ ...filters, is_mapped: v === 'all' ? undefined : v === 'true' })
            }
          >
            <SelectTrigger className="w-[120px] md:w-[150px] shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Mapped</SelectItem>
              <SelectItem value="false">Unmapped</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.is_verified === undefined ? 'all' : String(filters.is_verified)}
            onValueChange={(v) =>
              setFilters({ ...filters, is_verified: v === 'all' ? undefined : v === 'true' })
            }
          >
            <SelectTrigger className="w-[120px] md:w-[150px] shrink-0">
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Verified</SelectItem>
              <SelectItem value="false">Unverified</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.reimbursement_status || 'all'}
            onValueChange={(v) =>
              setFilters({
                ...filters,
                reimbursement_status: v === 'all' ? undefined : (v as BacklotReimbursementStatus),
              })
            }
          >
            <SelectTrigger className="w-[130px] md:w-[170px] shrink-0">
              <SelectValue placeholder="Approval Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_applicable">Not Submitted</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending Approval</SelectItem>
              <SelectItem value="changes_requested">Changes Requested</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="reimbursed">Reimbursed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Receipts Grid */}
      {receipts && receipts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {receipts.map((receipt) => (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              currency={currency}
              canEdit={canEdit}
              isManager={isManager}
              onView={setViewingReceipt}
              onEdit={handleEditReceipt}
              onMap={handleMapReceipt}
              onVerify={handleVerify}
              onReprocess={handleReprocess}
              onDelete={handleDelete}
              onSubmitReimbursement={handleOpenExpenseTypeDialog}
              onSendForApproval={handleSubmitReimbursement}
              onApproveReimbursement={handleApproveReimbursement}
              onRejectReimbursement={handleRejectReimbursement}
              onMarkReimbursed={handleMarkReimbursed}
              onEditAndResubmit={handleEditAndResubmit}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Receipt className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No receipts yet</h3>
          <p className="text-muted-gray mb-4">
            Upload your first receipt to start tracking expenses
          </p>
          {canEdit && (
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Receipt
            </Button>
          )}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Receipts</DialogTitle>
            <DialogDescription>
              Upload receipt images or PDFs. You'll be able to enter the details manually after upload.
            </DialogDescription>
          </DialogHeader>
          <UploadZone
            projectId={projectId}
            onUploadComplete={(receipt) => {
              setShowUpload(false);
              refetch();
              // Auto-open edit dialog for the newly uploaded receipt
              if (receipt) {
                setEditingReceipt(receipt);
                setEditForm({
                  vendor_name: receipt.vendor_name || '',
                  description: receipt.description || '',
                  purchase_date: receipt.purchase_date || new Date().toISOString().split('T')[0],
                  amount: receipt.amount ?? undefined,
                  tax_amount: receipt.tax_amount ?? undefined,
                  payment_method: receipt.payment_method || undefined,
                  notes: receipt.notes || '',
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-400" />
                {viewingReceipt?.vendor_name || 'Receipt Details'}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {viewingReceipt?.is_verified && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">
                    <Check className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                )}
                {viewingReceipt?.reimbursement_status &&
                 viewingReceipt.reimbursement_status !== 'not_applicable' && (
                  <Badge className={`border ${
                    viewingReceipt.reimbursement_status === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                    viewingReceipt.reimbursement_status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    viewingReceipt.reimbursement_status === 'reimbursed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    {viewingReceipt.reimbursement_status}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>
          {viewingReceipt && (
            <div className="space-y-4">
              {/* File Preview - Clickable to open full */}
              {viewingReceipt.file_url && (
                <div className="bg-charcoal-black/50 rounded-lg border border-muted-gray/10 overflow-hidden">
                  <div className="px-4 py-3 border-b border-muted-gray/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-gray" />
                      <span className="text-sm font-medium text-bone-white">
                        {viewingReceipt.file_type?.includes('pdf') ? 'Receipt PDF' : 'Receipt Image'}
                      </span>
                    </div>
                    <a
                      href={viewingReceipt.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Open in new tab
                    </a>
                  </div>
                  <div className="p-4 flex justify-center bg-charcoal-black">
                    {viewingReceipt.file_type?.includes('pdf') ? (
                      <iframe
                        src={viewingReceipt.file_url}
                        title="Receipt PDF"
                        className="w-full h-[400px] rounded border border-muted-gray/20"
                      />
                    ) : viewingReceipt.file_type?.startsWith('image/') ? (
                      <a href={viewingReceipt.file_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={viewingReceipt.file_url}
                          alt="Receipt"
                          className="max-h-64 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-muted-gray mx-auto mb-2" />
                        <p className="text-sm text-muted-gray">File preview not available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Key Details - 2 column grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-charcoal-black/50 rounded-lg p-3 border border-muted-gray/10">
                  <Label className="text-xs text-muted-gray flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Amount
                  </Label>
                  <p className="text-lg font-semibold text-bone-white">
                    {viewingReceipt.amount !== null
                      ? formatCurrency(viewingReceipt.amount, currency)
                      : 'N/A'}
                  </p>
                  {viewingReceipt.tax_amount && viewingReceipt.tax_amount > 0 && (
                    <p className="text-xs text-muted-gray">
                      (includes ${viewingReceipt.tax_amount.toFixed(2)} tax)
                    </p>
                  )}
                </div>

                <div className="bg-charcoal-black/50 rounded-lg p-3 border border-muted-gray/10">
                  <Label className="text-xs text-muted-gray flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Purchase Date
                  </Label>
                  <p className="text-bone-white">
                    {viewingReceipt.purchase_date
                      ? format(parseLocalDate(viewingReceipt.purchase_date), 'MMMM d, yyyy')
                      : 'Unknown'}
                  </p>
                </div>
              </div>

              {/* Additional Details - 2 column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-gray flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Vendor
                  </Label>
                  <p className="text-sm text-bone-white">{viewingReceipt.vendor_name || 'Unknown'}</p>
                </div>

                {viewingReceipt.payment_method && (
                  <div>
                    <Label className="text-xs text-muted-gray flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      Payment Method
                    </Label>
                    <p className="text-sm text-bone-white capitalize">
                      {viewingReceipt.payment_method.replace(/_/g, ' ')}
                    </p>
                  </div>
                )}

                {viewingReceipt.line_item?.name && (
                  <div>
                    <Label className="text-xs text-muted-gray flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Budget Category
                    </Label>
                    <p className="text-sm text-bone-white">{viewingReceipt.line_item.name}</p>
                  </div>
                )}

                {viewingReceipt.daily_budget?.name && (
                  <div>
                    <Label className="text-xs text-muted-gray flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Daily Budget
                    </Label>
                    <p className="text-sm text-bone-white">{viewingReceipt.daily_budget.name}</p>
                  </div>
                )}

                {viewingReceipt.reimbursement_to && (
                  <div>
                    <Label className="text-xs text-muted-gray flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Reimburse To
                    </Label>
                    <p className="text-sm text-bone-white">{viewingReceipt.reimbursement_to}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-gray">OCR Confidence</Label>
                  <p className="text-sm text-bone-white">
                    {viewingReceipt.ocr_confidence
                      ? `${(viewingReceipt.ocr_confidence * 100).toFixed(0)}%`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Description */}
              {viewingReceipt.description && (
                <div className="bg-charcoal-black/50 rounded-lg p-3 border border-muted-gray/10">
                  <Label className="text-xs text-muted-gray mb-1">Description</Label>
                  <p className="text-sm text-bone-white whitespace-pre-wrap">
                    {viewingReceipt.description}
                  </p>
                </div>
              )}

              {/* Notes */}
              {viewingReceipt.notes && (
                <div className="bg-charcoal-black/50 rounded-lg p-3 border border-muted-gray/10">
                  <Label className="text-xs text-muted-gray mb-1">Notes</Label>
                  <p className="text-sm text-bone-white whitespace-pre-wrap">
                    {viewingReceipt.notes}
                  </p>
                </div>
              )}

              {/* Extracted Text */}
              {viewingReceipt.extracted_text && (
                <div className="bg-charcoal-black/50 rounded-lg p-3 border border-muted-gray/10">
                  <Label className="text-xs text-muted-gray">Extracted Text (OCR)</Label>
                  <pre className="mt-1 text-xs text-muted-gray whitespace-pre-wrap font-mono bg-charcoal-black p-2 rounded max-h-32 overflow-y-auto">
                    {viewingReceipt.extracted_text}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t border-muted-gray/10">
                <Button
                  variant="outline"
                  onClick={() => window.open(viewingReceipt.file_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Original
                </Button>
                <Button variant="ghost" onClick={() => setViewingReceipt(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual Receipt Entry</DialogTitle>
            <DialogDescription>
              Enter receipt details manually without uploading a file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="manual-vendor">Vendor Name *</Label>
              <Input
                id="manual-vendor"
                value={manualForm.vendor_name}
                onChange={(e) => setManualForm({ ...manualForm, vendor_name: e.target.value })}
                placeholder="e.g., Office Depot"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manual-amount">Amount *</Label>
                <Input
                  id="manual-amount"
                  type="number"
                  step="0.01"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-tax">Tax Amount</Label>
                <Input
                  id="manual-tax"
                  type="number"
                  step="0.01"
                  value={manualForm.tax_amount}
                  onChange={(e) => setManualForm({ ...manualForm, tax_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-date">Purchase Date *</Label>
              <Input
                id="manual-date"
                type="date"
                value={manualForm.purchase_date}
                onChange={(e) => setManualForm({ ...manualForm, purchase_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-payment">Payment Method</Label>
              <Select
                value={manualForm.payment_method}
                onValueChange={(v) => setManualForm({ ...manualForm, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-description">Description / Notes</Label>
              <Textarea
                id="manual-description"
                value={manualForm.description}
                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="What was purchased? Add any notes here..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowManualEntry(false)}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!manualForm.vendor_name || !manualForm.amount || !manualForm.purchase_date) {
                    return;
                  }
                  setIsSubmitting(true);
                  try {
                    await createManualReceipt.mutateAsync({
                      projectId,
                      vendorName: manualForm.vendor_name,
                      amount: parseFloat(manualForm.amount),
                      purchaseDate: manualForm.purchase_date,
                      description: manualForm.description || undefined,
                      paymentMethod: manualForm.payment_method || undefined,
                      taxAmount: manualForm.tax_amount ? parseFloat(manualForm.tax_amount) : undefined,
                    });
                    setShowManualEntry(false);
                    setManualForm({
                      vendor_name: '',
                      amount: '',
                      purchase_date: new Date().toISOString().split('T')[0],
                      description: '',
                      payment_method: '',
                      tax_amount: '',
                    });
                    refetch();
                  } catch (err) {
                    console.error('Failed to create receipt:', err);
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                disabled={isSubmitting || !manualForm.vendor_name || !manualForm.amount || !manualForm.purchase_date}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Receipt'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <Dialog open={!!editingReceipt} onOpenChange={() => { setEditingReceipt(null); setPendingResubmit(false); }}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pendingResubmit ? 'Edit & Resubmit Receipt' : 'Edit Receipt'}</DialogTitle>
          </DialogHeader>

          {/* Show rejection reason if editing for resubmit */}
          {pendingResubmit && editingReceipt?.rejection_reason && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mt-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-orange-400">Changes Requested</p>
                  <p className="text-sm text-muted-gray mt-1">{editingReceipt.rejection_reason}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor Name</Label>
              <Input
                id="vendor"
                value={editForm.vendor_name || ''}
                onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={editForm.amount || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, amount: parseFloat(e.target.value) || undefined })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax">Tax Amount</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  value={editForm.tax_amount || ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, tax_amount: parseFloat(e.target.value) || undefined })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Purchase Date</Label>
              <Input
                id="date"
                type="date"
                value={editForm.purchase_date || ''}
                onChange={(e) => setEditForm({ ...editForm, purchase_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment">Payment Method</Label>
              <Select
                value={editForm.payment_method || ''}
                onValueChange={(v) =>
                  setEditForm({ ...editForm, payment_method: v as BacklotPaymentMethod })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="What was purchased? Add any notes here..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => { setEditingReceipt(null); setPendingResubmit(false); }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSubmitting}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {pendingResubmit ? 'Resubmitting...' : 'Saving...'}
                  </>
                ) : (
                  pendingResubmit ? 'Save & Resubmit' : 'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Map Receipt Dialog */}
      <Dialog open={!!mappingReceipt} onOpenChange={() => setMappingReceipt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Map Receipt to Budget</DialogTitle>
            <DialogDescription>
              Link this receipt to a budget line item or production day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Line Item Selection */}
            <div className="space-y-2">
              <Label>Budget Line Item</Label>
              <Select
                value={mappingForm.budget_line_item_id || 'none'}
                onValueChange={(v) =>
                  setMappingForm({
                    ...mappingForm,
                    budget_line_item_id: v === 'none' ? undefined : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select line item" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {lineItems?.map((li) => (
                    <SelectItem key={li.id} value={li.id}>
                      {li.description}
                      {li.category && ` (${li.category.name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Daily Budget Selection */}
            <div className="space-y-2">
              <Label>Production Day</Label>
              <Select
                value={mappingForm.daily_budget_id || 'none'}
                onValueChange={(v) =>
                  setMappingForm({
                    ...mappingForm,
                    daily_budget_id: v === 'none' ? undefined : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {dailyBudgets?.map((db) => (
                    <SelectItem key={db.id} value={db.id}>
                      Day {db.production_day_number} - {format(parseLocalDate(db.date), 'MMM d')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Scene Selection */}
            <SceneSelect
              projectId={projectId}
              value={mappingForm.scene_id || null}
              onChange={(sceneId) => {
                setMappingForm({ ...mappingForm, scene_id: sceneId || undefined });
              }}
              label="Related Scene"
              placeholder="Select scene (optional)"
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setMappingReceipt(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveMapping}
                disabled={isSubmitting || (!mappingForm.budget_line_item_id && !mappingForm.daily_budget_id)}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mapping...
                  </>
                ) : (
                  'Map Receipt'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Type Selection Dialog */}
      <Dialog open={!!expenseTypeReceipt} onOpenChange={() => setExpenseTypeReceipt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Expense</DialogTitle>
            <DialogDescription>
              How was this expense paid?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <RadioGroup
              value={expenseType}
              onValueChange={(v) => setExpenseType(v as 'personal' | 'company_card')}
              className="space-y-3"
            >
              <div className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                expenseType === 'personal'
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-muted-gray/30 hover:border-muted-gray/50'
              }`}
              onClick={() => setExpenseType('personal')}
              >
                <RadioGroupItem value="personal" id="personal" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="personal" className="flex items-center gap-2 font-medium cursor-pointer">
                    <CreditCard className="w-4 h-4" />
                    Personal Card (Reimbursement)
                  </Label>
                  <p className="text-sm text-muted-gray mt-1">
                    Submit for manager approval. Once approved, this will be added to your invoice for reimbursement.
                  </p>
                </div>
              </div>
              <div className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                expenseType === 'company_card'
                  ? 'border-accent-yellow bg-accent-yellow/10'
                  : 'border-muted-gray/30 hover:border-muted-gray/50'
              }`}
              onClick={() => setExpenseType('company_card')}
              >
                <RadioGroupItem value="company_card" id="company_card" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="company_card" className="flex items-center gap-2 font-medium cursor-pointer">
                    <Building2 className="w-4 h-4" />
                    Company Card
                  </Label>
                  <p className="text-sm text-muted-gray mt-1">
                    Expense paid with company card. Will be recorded directly to the production budget.
                  </p>
                </div>
              </div>
            </RadioGroup>

            {/* Budget category selection for company card */}
            {expenseType === 'company_card' && (
              <div className="space-y-4 pt-2 border-t border-muted-gray/20">
                <div className="space-y-2">
                  <Label>Budget Category (Optional)</Label>
                  <Select
                    value={selectedBudgetCategoryId || 'none'}
                    onValueChange={(v) => {
                      setSelectedBudgetCategoryId(v === 'none' ? '' : v);
                      setSelectedBudgetLineItemId('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBudgetCategoryId && (
                  <div className="space-y-2">
                    <Label>Budget Line Item (Optional)</Label>
                    <Select
                      value={selectedBudgetLineItemId || 'none'}
                      onValueChange={(v) => setSelectedBudgetLineItemId(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select line item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No specific line item</SelectItem>
                        {lineItems
                          ?.filter((li) => li.category_id === selectedBudgetCategoryId)
                          .map((li) => (
                            <SelectItem key={li.id} value={li.id}>
                              {li.description}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setExpenseTypeReceipt(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitExpenseType}
                disabled={submitReimbursement.isPending || submitCompanyCard.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {(submitReimbursement.isPending || submitCompanyCard.isPending) ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : expenseType === 'personal' ? (
                  'Submit for Reimbursement'
                ) : (
                  'Add to Budget'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceiptsView;
