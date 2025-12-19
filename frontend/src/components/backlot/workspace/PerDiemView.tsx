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
  Check,
  X,
  DollarSign,
  Loader2,
  Trash2,
  RefreshCw,
  Calendar,
  Coffee,
  Sun,
  Moon,
} from 'lucide-react';
import {
  usePerDiemEntries,
  useClaimPerDiem,
  useBulkClaimPerDiem,
  useDeletePerDiem,
  useApprovePerDiem,
  useRejectPerDiem,
  useMarkPerDiemReimbursed,
  useExpenseSettings,
  PerDiemEntry,
  CreatePerDiemData,
  BulkPerDiemData,
  MEAL_TYPE_OPTIONS,
  EXPENSE_STATUS_CONFIG,
  formatCurrency,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface PerDiemViewProps {
  projectId: string;
  canEdit: boolean;
}

const MEAL_ICONS: Record<string, React.ReactNode> = {
  breakfast: <Coffee className="w-4 h-4" />,
  lunch: <Sun className="w-4 h-4" />,
  dinner: <Moon className="w-4 h-4" />,
  full_day: <Utensils className="w-4 h-4" />,
};

function PerDiemView({ projectId, canEdit }: PerDiemViewProps) {
  // For expense approval, canEdit implies approval permissions for now
  const canApprove = canEdit;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: entries = [], isLoading, refetch } = usePerDiemEntries(
    projectId,
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const { data: settings } = useExpenseSettings(projectId);
  const claimPerDiem = useClaimPerDiem(projectId);
  const bulkClaimPerDiem = useBulkClaimPerDiem(projectId);
  const deletePerDiem = useDeletePerDiem(projectId);
  const approvePerDiem = useApprovePerDiem(projectId);
  const rejectPerDiem = useRejectPerDiem(projectId);
  const markReimbursed = useMarkPerDiemReimbursed(projectId);

  // Calculate totals
  const totalPending = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalApproved = entries
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);

  const handleApprove = async (id: string) => {
    try {
      await approvePerDiem.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    try {
      await rejectPerDiem.mutateAsync({ entryId: showRejectModal, reason: rejectReason });
      setShowRejectModal(null);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

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
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{entries.length}</div>
            <div className="text-sm text-muted-foreground">Total Claims</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrency(totalPending)}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(totalApproved)}
            </div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {formatCurrency(settings?.per_diem_full_day ?? 65)}
            </div>
            <div className="text-sm text-muted-foreground">Full Day Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Entries List - Grouped by Date */}
      <div className="space-y-4">
        {sortedDates.length === 0 ? (
          <Card>
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
            <Card key={date}>
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
                    onApprove={() => handleApprove(entry.id)}
                    onReject={() => setShowRejectModal(entry.id)}
                    onDelete={() => handleDelete(entry.id)}
                    onMarkReimbursed={() => handleMarkReimbursed(entry.id)}
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

      {/* Reject Modal */}
      <Dialog open={!!showRejectModal} onOpenChange={() => setShowRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Per Diem Claim</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectPerDiem.isPending}
            >
              {rejectPerDiem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PerDiemEntryRowProps {
  entry: PerDiemEntry;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
  onMarkReimbursed: () => void;
}

function PerDiemEntryRow({
  entry,
  canApprove,
  onApprove,
  onReject,
  onDelete,
  onMarkReimbursed,
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
          {entry.status === 'pending' && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
              {canApprove && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-green-500 hover:text-green-600"
                    onClick={onApprove}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={onReject}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </>
              )}
            </>
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
  });

  const claimPerDiem = useClaimPerDiem(projectId);

  React.useEffect(() => {
    if (isOpen) {
      const amount = getMealAmount(formData.meal_type);
      setFormData(prev => ({ ...prev, amount }));
    }
  }, [isOpen, settings]);

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
      onClose();
      setFormData({
        date: new Date().toISOString().split('T')[0],
        meal_type: 'full_day',
        amount: settings?.per_diem_full_day ?? 65,
        location: '',
        notes: '',
      });
    } catch (error) {
      console.error('Failed to claim:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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
  });

  const bulkClaimPerDiem = useBulkClaimPerDiem(projectId);

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
      alert(`Created ${result.created_count} claims, skipped ${result.skipped_count} (already existed)`);
      onClose();
    } catch (error) {
      console.error('Failed to bulk claim:', error);
    }
  };

  // Calculate days
  const calculateDays = () => {
    try {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } catch {
      return 0;
    }
  };

  const days = calculateDays();
  const totalAmount = days * formData.amount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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

          <Card className="bg-muted/50">
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

export default PerDiemView;
