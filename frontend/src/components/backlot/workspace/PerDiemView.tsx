/**
 * PerDiemView - Per diem meal allowance tracking
 * Crew can claim per diem, managers can approve/reject
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Utensils,
  Plus,
  DollarSign,
  Loader2,
  Trash2,
  RefreshCw,
  Calendar,
  Coffee,
  Sun,
  Moon,
  Send,
  ArrowRight,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  usePerDiemEntries,
  useClaimPerDiem,
  useBulkClaimPerDiem,
  useUpdatePerDiem,
  useDeletePerDiem,
  useMarkPerDiemReimbursed,
  useSubmitPerDiemForApproval,
  useBulkSubmitPerDiemForApproval,
  useExpenseSettings,
  useBudget,
  PerDiemEntry,
  CreatePerDiemData,
  BulkPerDiemData,
  UpdatePerDiemData,
  MEAL_TYPE_OPTIONS,
  EXPENSE_STATUS_CONFIG,
  formatCurrency,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage, buildDraftKey } from '@/lib/formDraftStorage';

interface PerDiemViewProps {
  projectId: string;
  canEdit: boolean;
  onNavigateToTab?: (tab: string, subTab?: string) => void;
}

const MEAL_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="w-4 h-4" />,
  lunch: <Sun className="w-4 h-4" />,
  dinner: <Moon className="w-4 h-4" />,
  full_day: <Utensils className="w-4 h-4" />,
};

function PerDiemView({ projectId, canEdit, onNavigateToTab }: PerDiemViewProps) {
  // For expense approval, canEdit implies approval permissions for now
  const canApprove = canEdit;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PerDiemEntry | null>(null);

  const { data: entries = [], isLoading, refetch } = usePerDiemEntries(
    projectId,
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const { data: settings } = useExpenseSettings(projectId);
  const claimPerDiem = useClaimPerDiem(projectId);
  const bulkClaimPerDiem = useBulkClaimPerDiem(projectId);
  const deletePerDiem = useDeletePerDiem(projectId);
  const markReimbursed = useMarkPerDiemReimbursed(projectId);
  const submitForApproval = useSubmitPerDiemForApproval(projectId);
  const bulkSubmitForApproval = useBulkSubmitPerDiemForApproval(projectId);

  // Calculate draft entries for "Send for Approval" card
  const draftEntries = entries.filter(e => e.status === 'draft');
  const draftCount = draftEntries.length;
  const draftTotal = draftEntries.reduce((sum, e) => sum + e.amount, 0);

  // Calculate totals
  const totalPending = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = entries
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this per diem claim?')) return;
    try {
      await deletePerDiem.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleMarkReimbursed = async (id: string) => {
    try {
      await markReimbursed.mutateAsync({ entryId: id });
    } catch (error) {
      console.error('Failed to mark as reimbursed:', error);
    }
  };

  const handleEdit = (entry: PerDiemEntry) => {
    setEditingEntry(entry);
    setShowEditModal(true);
  };

  const handleBulkSubmitForApproval = async () => {
    if (draftEntries.length === 0) return;
    try {
      const result = await bulkSubmitForApproval.mutateAsync(draftEntries.map(e => e.id));
      toast.success(`${result.submitted_count} per diem claim${result.submitted_count !== 1 ? 's' : ''} sent for approval`);
      if (result.failed_count > 0) {
        toast.error(`${result.failed_count} claim${result.failed_count !== 1 ? 's' : ''} failed to submit`);
      }
    } catch (error) {
      console.error('Failed to submit for approval:', error);
      toast.error('Failed to submit for approval');
    }
  };

  const handleSubmitForApproval = async (entryId: string) => {
    try {
      await submitForApproval.mutateAsync(entryId);
      toast.success('Per diem claim sent for approval');
    } catch (error) {
      console.error('Failed to submit for approval:', error);
      toast.error('Failed to submit for approval');
    }
  };

  // Group entries by date
  const entriesByDate = entries.reduce((acc, entry) => {
    const date = entry.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, PerDiemEntry[]>);

  const sortedDates = Object.keys(entriesByDate).sort((a, b) => b.localeCompare(a));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Utensils className="w-5 h-5" />
            Per Diem
          </h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="reimbursed">Reimbursed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkModal(true)}>
            <Calendar className="w-4 h-4 mr-2" />
            Bulk Claim
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Claim Per Diem
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{entries.length}</div>
            <div className="text-sm text-muted-foreground">Total Claims</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrency(totalPending)}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(totalApproved)}
            </div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {formatCurrency(settings?.per_diem_full_day ?? 65)}
            </div>
            <div className="text-sm text-muted-foreground">Full Day Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Send to Approvals Card - Show when there are draft entries */}
      {draftCount > 0 && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/20">
                  <Send className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-bone-white">
                    {draftCount} Per Diem Claim{draftCount !== 1 ? 's' : ''} Ready to Submit
                  </h3>
                  <p className="text-sm text-muted-gray">
                    Total: {formatCurrency(draftTotal)}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleBulkSubmitForApproval}
                disabled={bulkSubmitForApproval.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                {bulkSubmitForApproval.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                <span>Send for Approval</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries List - Grouped by Date */}
      <div className="space-y-4">
        {sortedDates.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Utensils className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No per diem claims found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Claim Per Diem
              </Button>
            </CardContent>
          </Card>
        ) : (
          sortedDates.map(date => (
            <Card key={date} className="bg-charcoal-black border-muted-gray/20">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {entriesByDate[date].map(entry => (
                  <PerDiemEntryRow
                    key={entry.id}
                    entry={entry}
                    canApprove={canApprove}
                    onEdit={() => handleEdit(entry)}
                    onDelete={() => handleDelete(entry.id)}
                    onMarkReimbursed={() => handleMarkReimbursed(entry.id)}
                    onSubmitForApproval={() => handleSubmitForApproval(entry.id)}
                    isSubmitting={submitForApproval.isPending}
                  />
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Modal */}
      <PerDiemFormModal
        projectId={projectId}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        settings={settings}
      />

      {/* Bulk Modal */}
      <BulkPerDiemModal
        projectId={projectId}
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        settings={settings}
      />

      {/* Edit Modal */}
      <PerDiemEditModal
        projectId={projectId}
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingEntry(null);
        }}
        entry={editingEntry}
        settings={settings}
      />
    </div>
  );
}

interface PerDiemEntryRowProps {
  entry: PerDiemEntry;
  canApprove: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMarkReimbursed: () => void;
  onSubmitForApproval: () => void;
  isSubmitting?: boolean;
}

function PerDiemEntryRow({
  entry,
  canApprove,
  onEdit,
  onDelete,
  onMarkReimbursed,
  onSubmitForApproval,
  isSubmitting,
}: PerDiemEntryRowProps) {
  const statusConfig = EXPENSE_STATUS_CONFIG[entry.status as keyof typeof EXPENSE_STATUS_CONFIG];
  const mealLabel = MEAL_TYPE_OPTIONS.find(m => m.value === entry.meal_type)?.label || entry.meal_type;

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-background">
          {MEAL_ICONS[entry.meal_type] || <Utensils className="w-4 h-4" />}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{mealLabel}</span>
            <Badge className={cn('text-xs', statusConfig?.color)}>
              {statusConfig?.label || entry.status}
            </Badge>
          </div>
          {entry.location && (
            <p className="text-xs text-muted-foreground">{entry.location}</p>
          )}
          {entry.user_name && (
            <p className="text-xs text-muted-foreground">By: {entry.user_name}</p>
          )}
          {entry.rejection_reason && (
            <p className="text-xs text-red-500">Rejected: {entry.rejection_reason}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-medium">{formatCurrency(entry.amount)}</span>
        <div className="flex items-center gap-1">
          {entry.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSubmitForApproval}
              disabled={isSubmitting}
              className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Submit
                </>
              )}
            </Button>
          )}
          {(entry.status === 'draft' || entry.status === 'rejected' || entry.status === 'denied') && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {entry.status === 'draft' && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          {entry.status === 'approved' && canApprove && (
            <Button variant="ghost" size="sm" onClick={onMarkReimbursed}>
              <DollarSign className="w-4 h-4 mr-1" />
              Paid
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface PerDiemFormModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  settings?: {
    per_diem_breakfast: number;
    per_diem_lunch: number;
    per_diem_dinner: number;
    per_diem_full_day: number;
  } | null;
}

function PerDiemFormModal({
  projectId,
  isOpen,
  onClose,
  settings,
}: PerDiemFormModalProps) {
  const [formData, setFormData] = useState<CreatePerDiemData>({
    date: new Date().toISOString().split('T')[0],
    meal_type: 'full_day',
    amount: settings?.per_diem_full_day ?? 65,
    location: '',
    notes: '',
    budget_category_id: null,
    budget_line_item_id: null,
    scene_id: null,
  });

  const { data: budget } = useBudget(projectId);
  const budgetId = budget?.id || null;
  const claimPerDiem = useClaimPerDiem(projectId);

  // --- Draft persistence ---
  const draftKey = buildDraftKey('backlot', 'per-diem', 'new');

  // Restore draft when opening
  React.useEffect(() => {
    if (isOpen) {
      const saved = loadDraft<CreatePerDiemData>(draftKey);
      if (saved) {
        setFormData(prev => ({ ...prev, ...saved.data }));
      } else {
        const amount = getMealAmount(formData.meal_type);
        setFormData(prev => ({ ...prev, amount }));
      }
    }
  }, [isOpen]);

  // Auto-save draft (debounced)
  React.useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      saveDraft(draftKey, formData);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, isOpen]);

  React.useEffect(() => {
    if (isOpen && settings) {
      const amount = getMealAmount(formData.meal_type);
      setFormData(prev => ({ ...prev, amount }));
    }
  }, [settings]);

  const getMealAmount = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return settings?.per_diem_breakfast ?? 15;
      case 'lunch': return settings?.per_diem_lunch ?? 20;
      case 'dinner': return settings?.per_diem_dinner ?? 30;
      case 'full_day': return settings?.per_diem_full_day ?? 65;
      default: return 0;
    }
  };

  const handleMealTypeChange = (value: string) => {
    const amount = getMealAmount(value);
    setFormData({ ...formData, meal_type: value as CreatePerDiemData['meal_type'], amount });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await claimPerDiem.mutateAsync(formData);
      clearDraftStorage(draftKey);
      onClose();
      setFormData({
        date: new Date().toISOString().split('T')[0],
        meal_type: 'full_day',
        amount: settings?.per_diem_full_day ?? 65,
        location: '',
        notes: '',
        budget_category_id: null,
        budget_line_item_id: null,
        scene_id: null,
      });
    } catch (error) {
      console.error('Failed to claim:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim Per Diem</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal_type">Meal Type</Label>
              <Select value={formData.meal_type} onValueChange={handleMealTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={formData.location || ''}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Set, Downtown"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={claimPerDiem.isPending}>
              {claimPerDiem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BulkPerDiemModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  settings?: {
    per_diem_breakfast: number;
    per_diem_lunch: number;
    per_diem_dinner: number;
    per_diem_full_day: number;
  } | null;
}

function BulkPerDiemModal({
  projectId,
  isOpen,
  onClose,
  settings,
}: BulkPerDiemModalProps) {
  const [formData, setFormData] = useState<BulkPerDiemData>({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    meal_type: 'full_day',
    amount: settings?.per_diem_full_day ?? 65,
    location: '',
    notes: '',
    budget_category_id: null,
    budget_line_item_id: null,
    scene_id: null,
  });

  const { data: budget } = useBudget(projectId);
  const budgetId = budget?.id || null;
  const bulkClaimPerDiem = useBulkClaimPerDiem(projectId);

  // --- Draft persistence ---
  const bulkDraftKey = buildDraftKey('backlot', 'per-diem-bulk', 'new');

  // Restore draft when opening
  React.useEffect(() => {
    if (isOpen) {
      const saved = loadDraft<BulkPerDiemData>(bulkDraftKey);
      if (saved) {
        setFormData(prev => ({ ...prev, ...saved.data }));
      }
    }
  }, [isOpen]);

  // Auto-save draft (debounced)
  React.useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      saveDraft(bulkDraftKey, formData);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, isOpen]);

  const getMealAmount = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return settings?.per_diem_breakfast ?? 15;
      case 'lunch': return settings?.per_diem_lunch ?? 20;
      case 'dinner': return settings?.per_diem_dinner ?? 30;
      case 'full_day': return settings?.per_diem_full_day ?? 65;
      default: return 0;
    }
  };

  const handleMealTypeChange = (value: string) => {
    const amount = getMealAmount(value);
    setFormData({ ...formData, meal_type: value as BulkPerDiemData['meal_type'], amount });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await bulkClaimPerDiem.mutateAsync(formData);
      clearDraftStorage(bulkDraftKey);
      alert(`Created ${result.created_count} claims, skipped ${result.skipped_count} (already existed)`);
      onClose();
    } catch (error) {
      console.error('Failed to bulk claim:', error);
    }
  };

  // Calculate days
  const calculateDays = () => {
    try {
      const start = parseLocalDate(formData.start_date);
      const end = parseLocalDate(formData.end_date);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 0;
    }
  };

  const days = calculateDays();
  const totalAmount = days * formData.amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Claim Per Diem</DialogTitle>
          <DialogDescription>
            Create per diem claims for multiple days at once.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="meal_type">Meal Type</Label>
              <Select value={formData.meal_type} onValueChange={handleMealTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount per Day</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input
              id="location"
              value={formData.location || ''}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Set, Downtown"
            />
          </div>

          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {days} days @ {formatCurrency(formData.amount)}/day
                </span>
                <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={bulkClaimPerDiem.isPending || days <= 0}>
              {bulkClaimPerDiem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create {days} Claims
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PerDiemEditModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  entry: PerDiemEntry | null;
  settings?: {
    per_diem_breakfast: number;
    per_diem_lunch: number;
    per_diem_dinner: number;
    per_diem_full_day: number;
  } | null;
}

function PerDiemEditModal({
  projectId,
  isOpen,
  onClose,
  entry,
  settings,
}: PerDiemEditModalProps) {
  const [formData, setFormData] = useState<UpdatePerDiemData>({
    meal_type: 'full_day',
    amount: 65,
    location: '',
    notes: '',
  });

  const updatePerDiem = useUpdatePerDiem(projectId);

  // When modal opens or entry changes, populate form with entry data
  React.useEffect(() => {
    if (isOpen && entry) {
      setFormData({
        meal_type: entry.meal_type,
        amount: entry.amount,
        location: entry.location || '',
        notes: entry.notes || '',
      });
    }
  }, [isOpen, entry]);

  const getMealAmount = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return settings?.per_diem_breakfast ?? 15;
      case 'lunch': return settings?.per_diem_lunch ?? 20;
      case 'dinner': return settings?.per_diem_dinner ?? 30;
      case 'full_day': return settings?.per_diem_full_day ?? 65;
      default: return 0;
    }
  };

  const handleMealTypeChange = (value: string) => {
    const amount = getMealAmount(value);
    setFormData({ ...formData, meal_type: value as UpdatePerDiemData['meal_type'], amount });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    try {
      await updatePerDiem.mutateAsync({ entryId: entry.id, data: formData });
      toast.success('Per diem updated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to update:', error);
      toast.error('Failed to update per diem');
    }
  };

  const isRejected = entry?.status === 'rejected' || entry?.status === 'denied';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Per Diem</DialogTitle>
          {entry && (
            <DialogDescription>
              {parseLocalDate(entry.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Show rejection reason if applicable */}
        {isRejected && entry?.rejection_reason && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-orange-400">Changes Requested</p>
              <p className="text-sm text-muted-gray">{entry.rejection_reason}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit_meal_type">Meal Type</Label>
              <Select value={formData.meal_type} onValueChange={handleMealTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_amount">Amount</Label>
              <Input
                id="edit_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_location">Location (optional)</Label>
            <Input
              id="edit_location"
              value={formData.location || ''}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Set, Downtown"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_notes">Notes</Label>
            <Textarea
              id="edit_notes"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updatePerDiem.isPending}>
              {updatePerDiem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isRejected ? 'Save Changes' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default PerDiemView;
