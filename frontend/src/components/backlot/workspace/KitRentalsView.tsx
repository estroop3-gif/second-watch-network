/**
 * KitRentalsView - Kit rental management and tracking
 * Crew can declare kit rentals, managers can approve/reject/complete
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
import {
  Package,
  Plus,
  Check,
  X,
  DollarSign,
  Loader2,
  Edit3,
  Trash2,
  RefreshCw,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import {
  useKitRentals,
  useCreateKitRental,
  useUpdateKitRental,
  useDeleteKitRental,
  useApproveKitRental,
  useRejectKitRental,
  useCompleteKitRental,
  useMarkKitRentalReimbursed,
  KitRental,
  CreateKitRentalData,
  RENTAL_TYPE_OPTIONS,
  EXPENSE_STATUS_CONFIG,
  formatCurrency,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface KitRentalsViewProps {
  projectId: string;
  canEdit: boolean;
}

function KitRentalsView({ projectId, canEdit }: KitRentalsViewProps) {
  // For expense approval, canEdit implies approval permissions for now
  const canApprove = canEdit;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KitRental | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: rentals = [], isLoading, refetch } = useKitRentals(
    projectId,
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const createRental = useCreateKitRental(projectId);
  const updateRental = useUpdateKitRental(projectId);
  const deleteRental = useDeleteKitRental(projectId);
  const approveRental = useApproveKitRental(projectId);
  const rejectRental = useRejectKitRental(projectId);
  const completeRental = useCompleteKitRental(projectId);
  const markReimbursed = useMarkKitRentalReimbursed(projectId);

  // Calculate totals
  const totalPending = rentals
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalActive = rentals
    .filter(r => r.status === 'active')
    .reduce((sum, r) => sum + (r.total_amount || r.daily_rate * (r.days_used || 0) || 0), 0);

  const handleApprove = async (id: string) => {
    try {
      await approveRental.mutateAsync(id);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    try {
      await rejectRental.mutateAsync({ rentalId: showRejectModal, reason: rejectReason });
      setShowRejectModal(null);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeRental.mutateAsync(id);
    } catch (error) {
      console.error('Failed to complete:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this kit rental?')) return;
    try {
      await deleteRental.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleMarkReimbursed = async (id: string) => {
    try {
      await markReimbursed.mutateAsync({ rentalId: id });
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
            <Package className="w-5 h-5" />
            Kit Rentals
          </h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
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
          Declare Kit
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{rentals.length}</div>
            <div className="text-sm text-muted-foreground">Total Rentals</div>
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
            <div className="text-2xl font-bold text-purple-500">
              {formatCurrency(totalActive)}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {rentals.filter(r => r.status === 'active').length}
            </div>
            <div className="text-sm text-muted-foreground">Active Rentals</div>
          </CardContent>
        </Card>
      </div>

      {/* Rentals List */}
      <div className="space-y-3">
        {rentals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No kit rentals found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Declare Kit Rental
              </Button>
            </CardContent>
          </Card>
        ) : (
          rentals.map(rental => (
            <KitRentalCard
              key={rental.id}
              rental={rental}
              canApprove={canApprove}
              onApprove={() => handleApprove(rental.id)}
              onReject={() => setShowRejectModal(rental.id)}
              onComplete={() => handleComplete(rental.id)}
              onEdit={() => setEditingEntry(rental)}
              onDelete={() => handleDelete(rental.id)}
              onMarkReimbursed={() => handleMarkReimbursed(rental.id)}
            />
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <KitRentalFormModal
        projectId={projectId}
        isOpen={showAddModal || !!editingEntry}
        onClose={() => {
          setShowAddModal(false);
          setEditingEntry(null);
        }}
        rental={editingEntry}
      />

      {/* Reject Modal */}
      <Dialog open={!!showRejectModal} onOpenChange={() => setShowRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Kit Rental</DialogTitle>
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
              disabled={rejectRental.isPending}
            >
              {rejectRental.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface KitRentalCardProps {
  rental: KitRental;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkReimbursed: () => void;
}

function KitRentalCard({
  rental,
  canApprove,
  onApprove,
  onReject,
  onComplete,
  onEdit,
  onDelete,
  onMarkReimbursed,
}: KitRentalCardProps) {
  const statusConfig = EXPENSE_STATUS_CONFIG[rental.status as keyof typeof EXPENSE_STATUS_CONFIG];
  const rentalTypeLabel = RENTAL_TYPE_OPTIONS.find(r => r.value === rental.rental_type)?.label || rental.rental_type;

  const dateRange = rental.end_date
    ? `${new Date(rental.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(rental.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : `${new Date(rental.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - Ongoing`;

  return (
    <Card className="hover:border-foreground/20 transition-colors">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-medium text-lg">{rental.kit_name}</span>
              <Badge className={cn('text-xs', statusConfig?.color)}>
                {statusConfig?.label || rental.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {rentalTypeLabel}
              </Badge>
            </div>

            {rental.kit_description && (
              <p className="text-sm text-muted-foreground mb-2">{rental.kit_description}</p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {dateRange}
              </span>
              {rental.days_used && (
                <span>({rental.days_used} days)</span>
              )}
            </div>

            {rental.user_name && (
              <p className="text-xs text-muted-foreground">By: {rental.user_name}</p>
            )}

            {rental.rejection_reason && (
              <p className="text-sm text-red-500 mt-2">
                Rejected: {rental.rejection_reason}
              </p>
            )}
          </div>

          <div className="text-right space-y-2">
            <div className="text-lg font-bold">
              {rental.total_amount ? formatCurrency(rental.total_amount) : '-'}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(rental.daily_rate)}/day
              {rental.weekly_rate && (
                <> | {formatCurrency(rental.weekly_rate)}/week</>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end mt-3">
              {rental.status === 'pending' && (
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
              {rental.status === 'active' && (
                <Button variant="outline" size="sm" onClick={onComplete}>
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Complete
                </Button>
              )}
              {(rental.status === 'approved' || rental.status === 'completed') && canApprove && (
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

interface KitRentalFormModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  rental?: KitRental | null;
}

function KitRentalFormModal({
  projectId,
  isOpen,
  onClose,
  rental,
}: KitRentalFormModalProps) {
  const [formData, setFormData] = useState<CreateKitRentalData>({
    kit_name: rental?.kit_name || '',
    kit_description: rental?.kit_description || '',
    daily_rate: rental?.daily_rate || 0,
    weekly_rate: rental?.weekly_rate || undefined,
    start_date: rental?.start_date || new Date().toISOString().split('T')[0],
    end_date: rental?.end_date || '',
    rental_type: rental?.rental_type || 'daily',
    notes: rental?.notes || '',
  });

  const createRental = useCreateKitRental(projectId);
  const updateRental = useUpdateKitRental(projectId);

  const isEditing = !!rental;
  const isPending = createRental.isPending || updateRental.isPending;

  React.useEffect(() => {
    if (rental) {
      setFormData({
        kit_name: rental.kit_name,
        kit_description: rental.kit_description || '',
        daily_rate: rental.daily_rate,
        weekly_rate: rental.weekly_rate || undefined,
        start_date: rental.start_date,
        end_date: rental.end_date || '',
        rental_type: rental.rental_type,
        notes: rental.notes || '',
      });
    } else {
      setFormData({
        kit_name: '',
        kit_description: '',
        daily_rate: 0,
        weekly_rate: undefined,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        rental_type: 'daily',
        notes: '',
      });
    }
  }, [rental]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && rental) {
        await updateRental.mutateAsync({
          rentalId: rental.id,
          data: formData,
        });
      } else {
        await createRental.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  // Calculate estimated total
  const calculateTotal = () => {
    if (!formData.start_date || !formData.end_date) return null;
    try {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (formData.rental_type === 'flat') {
        return formData.daily_rate;
      } else if (formData.rental_type === 'weekly' && formData.weekly_rate) {
        const weeks = Math.floor(days / 7);
        const remainingDays = days % 7;
        return weeks * formData.weekly_rate + remainingDays * formData.daily_rate;
      }
      return days * formData.daily_rate;
    } catch {
      return null;
    }
  };

  const estimatedTotal = calculateTotal();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Kit Rental' : 'Declare Kit Rental'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kit_name">Kit Name *</Label>
            <Input
              id="kit_name"
              value={formData.kit_name}
              onChange={e => setFormData({ ...formData, kit_name: e.target.value })}
              placeholder="e.g., Camera Kit, Grip Package"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kit_description">Description</Label>
            <Textarea
              id="kit_description"
              value={formData.kit_description || ''}
              onChange={e => setFormData({ ...formData, kit_description: e.target.value })}
              placeholder="List of included items..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rental_type">Rate Type</Label>
            <Select
              value={formData.rental_type}
              onValueChange={(value: 'daily' | 'weekly' | 'flat') =>
                setFormData({ ...formData, rental_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RENTAL_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="daily_rate">
                {formData.rental_type === 'flat' ? 'Flat Rate' : 'Daily Rate'} *
              </Label>
              <Input
                id="daily_rate"
                type="number"
                step="0.01"
                min="0"
                value={formData.daily_rate || ''}
                onChange={e => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            {formData.rental_type === 'weekly' && (
              <div className="space-y-2">
                <Label htmlFor="weekly_rate">Weekly Rate</Label>
                <Input
                  id="weekly_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weekly_rate || ''}
                  onChange={e => setFormData({ ...formData, weekly_rate: parseFloat(e.target.value) || undefined })}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
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
                value={formData.end_date || ''}
                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
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

          {estimatedTotal !== null && (
            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated Total</span>
                  <span className="text-lg font-bold">{formatCurrency(estimatedTotal)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !formData.kit_name || !formData.daily_rate}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Submit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default KitRentalsView;
