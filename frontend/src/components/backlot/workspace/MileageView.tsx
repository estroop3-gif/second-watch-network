/**
 * MileageView - Mileage tracking and reimbursement management
 * Crew can log mileage, managers can approve/reject
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Car,
  Plus,
  Check,
  X,
  MapPin,
  DollarSign,
  Loader2,
  Edit3,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  useMileageEntries,
  useCreateMileage,
  useUpdateMileage,
  useDeleteMileage,
  useApproveMileage,
  useRejectMileage,
  useMarkMileageReimbursed,
  useExpenseSettings,
  useBudget,
  MileageEntry,
  CreateMileageData,
  MILEAGE_PURPOSE_OPTIONS,
  EXPENSE_STATUS_CONFIG,
  formatCurrency,
  calculateMileageTotal,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import BudgetCategorySelect from '../shared/BudgetCategorySelect';
import BudgetLineItemSelect from '../shared/BudgetLineItemSelect';
import SceneSelect from '../shared/SceneSelect';

interface MileageViewProps {
  projectId: string;
  canEdit: boolean;
}

function MileageView({ projectId, canEdit }: MileageViewProps) {
  // For expense approval, canEdit implies approval permissions for now
  const canApprove = canEdit;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MileageEntry | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: entries = [], isLoading, refetch } = useMileageEntries(
    projectId,
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const { data: settings } = useExpenseSettings(projectId);
  const createMileage = useCreateMileage(projectId);
  const updateMileage = useUpdateMileage(projectId);
  const deleteMileage = useDeleteMileage(projectId);
  const approveMileage = useApproveMileage(projectId);
  const rejectMileage = useRejectMileage(projectId);
  const markReimbursed = useMarkMileageReimbursed(projectId);

  // Calculate totals
  const totalPending = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + (e.total_amount || 0), 0);
  const totalApproved = entries
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.total_amount || 0), 0);

  const handleApprove = async (id: string) => {
    try {
      await approveMileage.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    try {
      await rejectMileage.mutateAsync({ mileageId: showRejectModal, reason: rejectReason });
      setShowRejectModal(null);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mileage entry?')) return;
    try {
      await deleteMileage.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleMarkReimbursed = async (id: string) => {
    try {
      await markReimbursed.mutateAsync({ mileageId: id });
    } catch (error) {
      console.error('Failed to mark as reimbursed:', error);
    }
  };

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
            <Car className="w-5 h-5" />
            Mileage
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
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Mileage
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{entries.length}</div>
            <div className="text-sm text-muted-foreground">Total Entries</div>
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
              ${settings?.mileage_rate ?? 0.67}/mi
            </div>
            <div className="text-sm text-muted-foreground">Current Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No mileage entries found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Mileage
              </Button>
            </CardContent>
          </Card>
        ) : (
          entries.map(entry => (
            <MileageEntryCard
              key={entry.id}
              entry={entry}
              canApprove={canApprove}
              onApprove={() => handleApprove(entry.id)}
              onReject={() => setShowRejectModal(entry.id)}
              onEdit={() => setEditingEntry(entry)}
              onDelete={() => handleDelete(entry.id)}
              onMarkReimbursed={() => handleMarkReimbursed(entry.id)}
            />
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <MileageFormModal
        projectId={projectId}
        isOpen={showAddModal || !!editingEntry}
        onClose={() => {
          setShowAddModal(false);
          setEditingEntry(null);
        }}
        entry={editingEntry}
        defaultRate={settings?.mileage_rate ?? 0.67}
      />

      {/* Reject Modal */}
      <Dialog open={!!showRejectModal} onOpenChange={() => setShowRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Mileage Entry</DialogTitle>
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
              disabled={rejectMileage.isPending}
            >
              {rejectMileage.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MileageEntryCardProps {
  entry: MileageEntry;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkReimbursed: () => void;
}

function MileageEntryCard({
  entry,
  canApprove,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onMarkReimbursed,
}: MileageEntryCardProps) {
  const statusConfig = EXPENSE_STATUS_CONFIG[entry.status as keyof typeof EXPENSE_STATUS_CONFIG];
  const purposeLabel = MILEAGE_PURPOSE_OPTIONS.find(p => p.value === entry.purpose)?.label || entry.purpose;

  return (
    <Card className="hover:border-foreground/20 transition-colors">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-medium">
                {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <Badge className={cn('text-xs', statusConfig?.color)}>
                {statusConfig?.label || entry.status}
              </Badge>
              {entry.is_round_trip && (
                <Badge variant="outline" className="text-xs">
                  Round Trip
                </Badge>
              )}
              {purposeLabel && (
                <Badge variant="secondary" className="text-xs">
                  {purposeLabel}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />
              <span>
                {entry.start_location || 'Start'} → {entry.end_location || 'End'}
              </span>
            </div>

            {entry.description && (
              <p className="text-sm text-muted-foreground mb-2">{entry.description}</p>
            )}

            {entry.user_name && (
              <p className="text-xs text-muted-foreground">By: {entry.user_name}</p>
            )}

            {entry.rejection_reason && (
              <p className="text-sm text-red-500 mt-2">
                Rejected: {entry.rejection_reason}
              </p>
            )}
          </div>

          <div className="text-right space-y-2">
            <div className="text-lg font-bold">{formatCurrency(entry.total_amount)}</div>
            <div className="text-sm text-muted-foreground">
              {entry.is_round_trip ? entry.miles * 2 : entry.miles} mi @ ${entry.rate_per_mile}/mi
            </div>

            <div className="flex items-center gap-2 justify-end mt-3">
              {entry.status === 'pending' && (
                <>
                  <Button variant="ghost" size="icon" onClick={onEdit}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onDelete}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {canApprove && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-500 hover:text-green-600"
                        onClick={onApprove}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={onReject}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </>
              )}
              {entry.status === 'approved' && canApprove && (
                <Button variant="outline" size="sm" onClick={onMarkReimbursed}>
                  <DollarSign className="w-4 h-4 mr-1" />
                  Mark Paid
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MileageFormModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  entry?: MileageEntry | null;
  defaultRate: number;
}

function MileageFormModal({
  projectId,
  isOpen,
  onClose,
  entry,
  defaultRate,
}: MileageFormModalProps) {
  const [formData, setFormData] = useState<CreateMileageData>({
    date: entry?.date || new Date().toISOString().split('T')[0],
    description: entry?.description || '',
    start_location: entry?.start_location || '',
    end_location: entry?.end_location || '',
    miles: entry?.miles || 0,
    rate_per_mile: entry?.rate_per_mile || defaultRate,
    is_round_trip: entry?.is_round_trip || false,
    purpose: entry?.purpose || '',
    notes: entry?.notes || '',
    budget_category_id: (entry as any)?.budget_category_id || null,
    budget_line_item_id: (entry as any)?.budget_line_item_id || null,
  });

  const { data: budget } = useBudget(projectId);
  const budgetId = budget?.id || null;
  const createMileage = useCreateMileage(projectId);
  const updateMileage = useUpdateMileage(projectId);

  const isEditing = !!entry;
  const isPending = createMileage.isPending || updateMileage.isPending;

  // Update form when entry changes
  React.useEffect(() => {
    if (entry) {
      setFormData({
        date: entry.date,
        description: entry.description || '',
        start_location: entry.start_location || '',
        end_location: entry.end_location || '',
        miles: entry.miles,
        rate_per_mile: entry.rate_per_mile,
        is_round_trip: entry.is_round_trip,
        purpose: entry.purpose || '',
        notes: entry.notes || '',
        budget_category_id: (entry as any)?.budget_category_id || null,
        budget_line_item_id: (entry as any)?.budget_line_item_id || null,
        scene_id: entry.scene_id || null,
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        start_location: '',
        end_location: '',
        miles: 0,
        rate_per_mile: defaultRate,
        is_round_trip: false,
        purpose: '',
        notes: '',
        budget_category_id: null,
        budget_line_item_id: null,
        scene_id: null,
      });
    }
  }, [entry, defaultRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && entry) {
        await updateMileage.mutateAsync({
          mileageId: entry.id,
          data: formData,
        });
      } else {
        await createMileage.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const calculatedTotal = calculateMileageTotal(
    formData.miles || 0,
    formData.rate_per_mile || defaultRate,
    formData.is_round_trip || false
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Mileage' : 'Log Mileage'}</DialogTitle>
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
              <Label htmlFor="miles">Miles</Label>
              <Input
                id="miles"
                type="number"
                step="0.1"
                min="0"
                value={formData.miles || ''}
                onChange={e => setFormData({ ...formData, miles: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_location">Start Location</Label>
            <Input
              id="start_location"
              value={formData.start_location || ''}
              onChange={e => setFormData({ ...formData, start_location: e.target.value })}
              placeholder="e.g., Home, Office"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_location">End Location</Label>
            <Input
              id="end_location"
              value={formData.end_location || ''}
              onChange={e => setFormData({ ...formData, end_location: e.target.value })}
              placeholder="e.g., Set, Equipment House"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="round_trip"
              checked={formData.is_round_trip}
              onCheckedChange={checked =>
                setFormData({ ...formData, is_round_trip: checked === true })
              }
            />
            <Label htmlFor="round_trip" className="text-sm font-normal">
              Round trip (doubles miles)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Select
              value={formData.purpose || ''}
              onValueChange={value => setFormData({ ...formData, purpose: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select purpose..." />
              </SelectTrigger>
              <SelectContent>
                {MILEAGE_PURPOSE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description..."
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

          {/* Budget Linking */}
          {budgetId && (
            <div className="space-y-4 pt-2 border-t border-muted-gray/10">
              <div className="text-xs font-medium text-muted-gray uppercase tracking-wider">
                Budget Allocation
              </div>
              <BudgetCategorySelect
                projectId={projectId}
                value={formData.budget_category_id || null}
                onChange={(categoryId) => {
                  setFormData({
                    ...formData,
                    budget_category_id: categoryId,
                    budget_line_item_id: null, // Reset line item when category changes
                  });
                }}
                label="Budget Category"
                placeholder="Select category (optional)"
              />
              <BudgetLineItemSelect
                budgetId={budgetId}
                categoryId={formData.budget_category_id || null}
                value={formData.budget_line_item_id || null}
                onChange={(lineItemId) => {
                  setFormData({ ...formData, budget_line_item_id: lineItemId });
                }}
                label="Budget Line Item"
                placeholder="Select line item (optional)"
              />
              <SceneSelect
                projectId={projectId}
                value={formData.scene_id || null}
                onChange={(sceneId) => {
                  setFormData({ ...formData, scene_id: sceneId });
                }}
                label="Related Scene"
                placeholder="Select scene (optional)"
              />
            </div>
          )}

          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {formData.is_round_trip ? (formData.miles || 0) * 2 : formData.miles || 0} miles
                  @ ${formData.rate_per_mile || defaultRate}/mi
                </span>
                <span className="text-lg font-bold">{formatCurrency(calculatedTotal)}</span>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !formData.miles}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Submit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MileageView;
