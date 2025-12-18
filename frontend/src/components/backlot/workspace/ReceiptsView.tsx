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
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import {
  useReceipts,
  useReceipt,
  useRegisterReceipt,
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
} from '@/hooks/backlot';
import {
  BacklotReceipt,
  BacklotReceiptOcrStatus,
  BacklotPaymentMethod,
  BacklotReimbursementStatus,
  ReceiptInput,
  ReceiptMappingInput,
  ReceiptFilters,
} from '@/types/backlot';

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

// Receipt Card
const ReceiptCard: React.FC<{
  receipt: BacklotReceipt;
  currency: string;
  canEdit: boolean;
  onView: (receipt: BacklotReceipt) => void;
  onEdit: (receipt: BacklotReceipt) => void;
  onMap: (receipt: BacklotReceipt) => void;
  onVerify: (receipt: BacklotReceipt) => void;
  onReprocess: (receipt: BacklotReceipt) => void;
  onDelete: (receipt: BacklotReceipt) => void;
}> = ({ receipt, currency, canEdit, onView, onEdit, onMap, onVerify, onReprocess, onDelete }) => {
  const ocrStatus = getOcrStatusBadge(receipt.ocr_status);
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
              ? format(new Date(receipt.purchase_date), 'MMM d, yyyy')
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
  onUploadComplete: () => void;
}> = ({ projectId, onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const registerReceipt = useRegisterReceipt();

  const handleFiles = async (files: FileList) => {
    if (files.length === 0) return;

    setIsUploading(true);
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

        // Register the receipt and trigger OCR
        await registerReceipt.mutateAsync({
          projectId,
          fileUrl: uploadResult.file_url,
          originalFilename: file.name,
          fileType: file.type,
          fileSizeBytes: file.size,
        });
      }

      onUploadComplete();
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

  // Modal states
  const [showUpload, setShowUpload] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<BacklotReceipt | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<BacklotReceipt | null>(null);
  const [mappingReceipt, setMappingReceipt] = useState<BacklotReceipt | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setEditingReceipt(null);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Receipts</h2>
          <p className="text-sm text-muted-gray">
            Upload and manage expense receipts with AI-powered OCR
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              onClick={() => setShowUpload(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="text-sm text-muted-gray mb-1">Total Value</div>
          <div className="text-2xl font-bold text-bone-white">
            {formatCurrency(stats.total, currency)}
          </div>
        </div>
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="text-sm text-muted-gray mb-1">Total Receipts</div>
          <div className="text-2xl font-bold text-bone-white">{receipts?.length || 0}</div>
        </div>
        <div className="bg-charcoal-black/50 border border-green-500/30 rounded-lg p-4">
          <div className="text-sm text-muted-gray mb-1">Mapped</div>
          <div className="text-2xl font-bold text-green-400">{stats.mapped}</div>
        </div>
        <div className="bg-charcoal-black/50 border border-yellow-500/30 rounded-lg p-4">
          <div className="text-sm text-muted-gray mb-1">Unmapped</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.unmapped}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray" />
          <Input
            placeholder="Search receipts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filters.is_mapped === undefined ? 'all' : String(filters.is_mapped)}
          onValueChange={(v) =>
            setFilters({ ...filters, is_mapped: v === 'all' ? undefined : v === 'true' })
          }
        >
          <SelectTrigger className="w-[150px]">
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
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Verified</SelectItem>
            <SelectItem value="false">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Receipts Grid */}
      {receipts && receipts.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {receipts.map((receipt) => (
            <ReceiptCard
              key={receipt.id}
              receipt={receipt}
              currency={currency}
              canEdit={canEdit}
              onView={setViewingReceipt}
              onEdit={handleEditReceipt}
              onMap={handleMapReceipt}
              onVerify={handleVerify}
              onReprocess={handleReprocess}
              onDelete={handleDelete}
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
              Upload receipt images or PDFs. We'll automatically extract vendor, amount, and date.
            </DialogDescription>
          </DialogHeader>
          <UploadZone
            projectId={projectId}
            onUploadComplete={() => {
              setShowUpload(false);
              refetch();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Receipt Dialog */}
      <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt Details</DialogTitle>
          </DialogHeader>
          {viewingReceipt && (
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="relative bg-charcoal-black rounded-lg overflow-hidden max-h-[400px]">
                {viewingReceipt.file_type?.startsWith('image/') ? (
                  <img
                    src={viewingReceipt.file_url}
                    alt="Receipt"
                    className="w-full h-auto max-h-[400px] object-contain"
                  />
                ) : (
                  <div className="h-32 flex items-center justify-center">
                    <FileText className="w-16 h-16 text-muted-gray/50" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-gray">Vendor</Label>
                  <p className="text-bone-white">{viewingReceipt.vendor_name || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-muted-gray">Amount</Label>
                  <p className="text-bone-white">
                    {viewingReceipt.amount !== null
                      ? formatCurrency(viewingReceipt.amount, currency)
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-gray">Date</Label>
                  <p className="text-bone-white">
                    {viewingReceipt.purchase_date
                      ? format(new Date(viewingReceipt.purchase_date), 'MMMM d, yyyy')
                      : 'Unknown'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-gray">OCR Confidence</Label>
                  <p className="text-bone-white">
                    {viewingReceipt.ocr_confidence
                      ? `${(viewingReceipt.ocr_confidence * 100).toFixed(0)}%`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Extracted Text */}
              {viewingReceipt.extracted_text && (
                <div>
                  <Label className="text-muted-gray">Extracted Text</Label>
                  <div className="mt-1 p-3 bg-charcoal-black rounded text-sm text-muted-gray max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {viewingReceipt.extracted_text}
                    </pre>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4">
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

      {/* Edit Receipt Dialog */}
      <Dialog open={!!editingReceipt} onOpenChange={() => setEditingReceipt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Receipt</DialogTitle>
          </DialogHeader>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={editForm.notes || ''}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setEditingReceipt(null)}>
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
                    Saving...
                  </>
                ) : (
                  'Save Changes'
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
                      Day {db.production_day_number} - {format(new Date(db.date), 'MMM d')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
    </div>
  );
};

export default ReceiptsView;
