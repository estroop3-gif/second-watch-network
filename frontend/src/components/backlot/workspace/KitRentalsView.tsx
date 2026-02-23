/**
 * KitRentalsView - Kit rental management and tracking
 * Crew can declare kit rentals, managers can approve/reject/complete
 */
import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
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
  useSubmitKitRentalForApproval,
  useBulkSubmitKitRentalsForApproval,
  useApproveKitRental,
  useRejectKitRental,
  useCompleteKitRental,
  useMarkKitRentalReimbursed,
  useBudget,
  useKitRentalGearOptions,
  KitRental,
  CreateKitRentalData,
  KitRentalGearSourceType,
  GearAssetOption,
  GearKitOption,
  GearOrganizationOption,
  RENTAL_TYPE_OPTIONS,
  EXPENSE_STATUS_CONFIG,
  formatCurrency,
} from '@/hooks/backlot';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Building2, User, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage, buildDraftKey } from '@/lib/formDraftStorage';

interface KitRentalsViewProps {
  projectId: string;
  canEdit: boolean;
}

function KitRentalsView({ projectId, canEdit }: KitRentalsViewProps) {
  // For expense approval, canEdit implies approval permissions for now
  const canApprove = canEdit;
  const { toast } = useToast();
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
  const submitForApproval = useSubmitKitRentalForApproval(projectId);
  const bulkSubmitForApproval = useBulkSubmitKitRentalsForApproval(projectId);
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

  // Calculate drafts ready for submission
  const rentalsReadyForApproval = rentals.filter(r => r.status === 'draft');
  const totalDraft = rentalsReadyForApproval.reduce((sum, r) => sum + (r.total_amount || 0), 0);

  const handleSubmitForApproval = async (id: string) => {
    console.log('[KitRental] Submitting for approval:', id);
    try {
      await submitForApproval.mutateAsync(id);
      toast({
        title: 'Submitted for Approval',
        description: 'Kit rental has been sent for approval.',
      });
    } catch (error) {
      console.error('Failed to submit for approval:', error);
      toast({
        title: 'Failed to Submit',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleBulkSendForApproval = async () => {
    if (rentalsReadyForApproval.length === 0) return;
    const rentalIds = rentalsReadyForApproval.map(r => r.id);
    console.log('[KitRental] Bulk submitting for approval:', rentalIds);
    try {
      await bulkSubmitForApproval.mutateAsync(rentalIds);
      toast({
        title: 'Submitted for Approval',
        description: `${rentalIds.length} kit rental(s) sent for approval.`,
      });
    } catch (error) {
      console.error('Failed to bulk submit for approval:', error);
      toast({
        title: 'Failed to Submit',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveRental.mutateAsync({ rentalId: id });
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
              <SelectItem value="draft">Draft</SelectItem>
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
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{rentals.length}</div>
            <div className="text-sm text-muted-foreground">Total Rentals</div>
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
            <div className="text-2xl font-bold text-purple-500">
              {formatCurrency(totalActive)}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {rentals.filter(r => r.status === 'active').length}
            </div>
            <div className="text-sm text-muted-foreground">Active Rentals</div>
          </CardContent>
        </Card>
      </div>

      {/* Ready for Approval Card */}
      {rentalsReadyForApproval.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {rentalsReadyForApproval.length} kit rental{rentalsReadyForApproval.length !== 1 ? 's' : ''} ready for approval
                </p>
                <p className="text-lg font-semibold text-amber-400">{formatCurrency(totalDraft)}</p>
              </div>
              <Button
                onClick={handleBulkSendForApproval}
                disabled={bulkSubmitForApproval.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                {bulkSubmitForApproval.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Send All for Approval
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rentals List */}
      <div className="space-y-3">
        {rentals.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/20">
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
              onSubmitForApproval={() => handleSubmitForApproval(rental.id)}
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
  onSubmitForApproval?: () => void;
  onApprove: () => void;
  onReject: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkReimbursed: () => void;
}

// Get gear source badge config
function getGearSourceBadge(sourceType: string | null | undefined) {
  switch (sourceType) {
    case 'asset':
      return { label: 'Gear House', className: 'text-purple-400 border-purple-400/30' };
    case 'kit':
      return { label: 'GH Kit', className: 'text-purple-400 border-purple-400/30' };
    case 'lite':
      return { label: 'Personal Gear', className: 'text-blue-400 border-blue-400/30' };
    default:
      return null;
  }
}

function KitRentalCard({
  rental,
  canApprove,
  onSubmitForApproval,
  onApprove,
  onReject,
  onComplete,
  onEdit,
  onDelete,
  onMarkReimbursed,
}: KitRentalCardProps) {
  const statusConfig = EXPENSE_STATUS_CONFIG[rental.status as keyof typeof EXPENSE_STATUS_CONFIG];
  const rentalTypeLabel = RENTAL_TYPE_OPTIONS.find(r => r.value === rental.rental_type)?.label || rental.rental_type;
  const gearSourceBadge = getGearSourceBadge(rental.gear_source_type);

  const dateRange = rental.end_date
    ? `${new Date(rental.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(rental.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : `${new Date(rental.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - Ongoing`;

  return (
    <Card className="bg-charcoal-black border-muted-gray/20 hover:border-muted-gray/40 transition-colors">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="font-medium text-lg">{rental.kit_name}</span>
              <Badge className={cn('text-xs', statusConfig?.color)}>
                {statusConfig?.label || rental.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {rentalTypeLabel}
              </Badge>
              {gearSourceBadge && (
                <Badge variant="outline" className={cn('text-xs', gearSourceBadge.className)}>
                  {gearSourceBadge.label}
                </Badge>
              )}
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
              {rental.status === 'draft' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    onClick={onSubmitForApproval}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Send for Approval
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onEdit}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onDelete}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
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

// Gear source type for form selection
type GearSourceSelection = 'independent' | 'gear_house' | 'personal_gear';

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
    budget_category_id: (rental as any)?.budget_category_id || null,
    budget_line_item_id: (rental as any)?.budget_line_item_id || null,
    // Gear link fields
    gear_source_type: rental?.gear_source_type || null,
    gear_organization_id: rental?.gear_organization_id || null,
    gear_asset_id: rental?.gear_asset_id || null,
    gear_kit_instance_id: rental?.gear_kit_instance_id || null,
  });

  // Gear source selection state
  const [gearSourceSelection, setGearSourceSelection] = useState<GearSourceSelection>(() => {
    if (rental?.gear_source_type === 'lite') return 'personal_gear';
    if (rental?.gear_source_type === 'asset' || rental?.gear_source_type === 'kit') return 'gear_house';
    return 'independent';
  });
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(rental?.gear_organization_id || null);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<'asset' | 'kit'>('asset');

  const { data: budget } = useBudget(projectId);
  const budgetId = budget?.id || null;
  const createRental = useCreateKitRental(projectId);
  const updateRental = useUpdateKitRental(projectId);

  // Fetch gear options when dates are set
  const gearOptionsFilters = {
    org_id: gearSourceSelection === 'gear_house' ? selectedOrgId || undefined : undefined,
    start_date: formData.start_date || undefined,
    end_date: formData.end_date || undefined,
    show_all: showAllAssets,
  };
  const { data: gearOptions, isLoading: gearOptionsLoading, error: gearOptionsError } = useKitRentalGearOptions(
    gearSourceSelection !== 'independent' ? projectId : null,
    gearOptionsFilters
  );

  // Debug logging - ALWAYS log to help debug
  console.log('[KitRental] Current state:', {
    gearSourceSelection,
    projectId,
    queryEnabled: gearSourceSelection !== 'independent' ? projectId : null,
  });

  React.useEffect(() => {
    console.log('[KitRental] Gear options updated:', {
      gearSourceSelection,
      projectId,
      filters: gearOptionsFilters,
      loading: gearOptionsLoading,
      error: gearOptionsError?.message,
      data: gearOptions,
      orgCount: gearOptions?.organizations?.length,
      personalGearCount: gearOptions?.personal_gear?.length,
    });
  }, [gearSourceSelection, gearOptions, gearOptionsLoading, gearOptionsError]);

  const isEditing = !!rental;
  const isPending = createRental.isPending || updateRental.isPending;

  // --- Draft persistence (create mode only) ---
  const draftKey = buildDraftKey('backlot', 'kit-rental', 'new');

  // Restore draft when opening create form
  React.useEffect(() => {
    if (isOpen && !rental) {
      const saved = loadDraft<CreateKitRentalData>(draftKey);
      if (saved) {
        setFormData(prev => ({ ...prev, ...saved.data }));
      }
    }
  }, [isOpen, rental]);

  // Auto-save draft (debounced, create mode only)
  React.useEffect(() => {
    if (!isOpen || isEditing) return;
    const timer = setTimeout(() => {
      saveDraft(draftKey, formData);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, isOpen, isEditing]);

  // Reset gear selection state when modal opens/closes or rental changes
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
        budget_category_id: (rental as any)?.budget_category_id || null,
        budget_line_item_id: (rental as any)?.budget_line_item_id || null,
        scene_id: rental.scene_id || null,
        gear_source_type: rental.gear_source_type || null,
        gear_organization_id: rental.gear_organization_id || null,
        gear_asset_id: rental.gear_asset_id || null,
        gear_kit_instance_id: rental.gear_kit_instance_id || null,
      });
      // Set gear source selection based on existing data
      if (rental.gear_source_type === 'lite') {
        setGearSourceSelection('personal_gear');
      } else if (rental.gear_source_type === 'asset' || rental.gear_source_type === 'kit') {
        setGearSourceSelection('gear_house');
        setSelectedOrgId(rental.gear_organization_id || null);
        setSelectedAssetType(rental.gear_source_type === 'kit' ? 'kit' : 'asset');
      } else {
        setGearSourceSelection('independent');
      }
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
        budget_category_id: null,
        budget_line_item_id: null,
        scene_id: null,
        gear_source_type: null,
        gear_organization_id: null,
        gear_asset_id: null,
        gear_kit_instance_id: null,
      });
      setGearSourceSelection('independent');
      setSelectedOrgId(null);
      setShowAllAssets(false);
      setSelectedAssetType('asset');
    }
  }, [rental]);

  // Handle gear source selection change
  const handleGearSourceChange = (value: GearSourceSelection) => {
    setGearSourceSelection(value);
    // Clear gear link data when switching sources
    setFormData(prev => ({
      ...prev,
      gear_source_type: null,
      gear_organization_id: null,
      gear_asset_id: null,
      gear_kit_instance_id: null,
    }));
    setSelectedOrgId(null);
  };

  // Handle organization selection
  const handleOrgChange = (orgId: string | null) => {
    setSelectedOrgId(orgId);
    // Clear asset selection when org changes
    setFormData(prev => ({
      ...prev,
      gear_organization_id: orgId,
      gear_asset_id: null,
      gear_kit_instance_id: null,
    }));
  };

  // Handle asset selection with auto-fill
  const handleAssetSelect = (asset: GearAssetOption | null) => {
    if (!asset) {
      setFormData(prev => ({
        ...prev,
        gear_source_type: null,
        gear_asset_id: null,
      }));
      return;
    }

    const sourceType: KitRentalGearSourceType = gearSourceSelection === 'personal_gear' ? 'lite' : 'asset';
    setFormData(prev => ({
      ...prev,
      gear_source_type: sourceType,
      gear_asset_id: asset.id,
      gear_kit_instance_id: null,
      // Auto-fill from asset
      kit_name: asset.name || prev.kit_name,
      kit_description: asset.description || prev.kit_description,
      daily_rate: asset.daily_rate ?? prev.daily_rate,
      weekly_rate: asset.weekly_rate ?? prev.weekly_rate,
    }));
  };

  // Handle kit selection with auto-fill
  const handleKitSelect = (kit: GearKitOption | null) => {
    if (!kit) {
      setFormData(prev => ({
        ...prev,
        gear_source_type: null,
        gear_kit_instance_id: null,
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      gear_source_type: 'kit',
      gear_kit_instance_id: kit.id,
      gear_asset_id: null,
      // Auto-fill from kit (kits don't have rates, keep existing)
      kit_name: kit.name || prev.kit_name,
      kit_description: kit.internal_id ? `Kit: ${kit.name} (${kit.internal_id})` : `Kit: ${kit.name}`,
    }));
  };

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
        clearDraftStorage(draftKey);
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
      const start = parseLocalDate(formData.start_date);
      const end = parseLocalDate(formData.end_date);
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Kit Rental' : 'Declare Kit Rental'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Gear Source Selector */}
          <div className="space-y-3">
            <Label>Kit Source</Label>
            <RadioGroup
              value={gearSourceSelection}
              onValueChange={(val) => handleGearSourceChange(val as GearSourceSelection)}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="independent" id="source_independent" />
                <Label htmlFor="source_independent" className="cursor-pointer flex items-center gap-2 font-normal">
                  <Edit3 className="w-4 h-4 text-muted-gray" />
                  Independent (manual entry)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="gear_house" id="source_gear_house" />
                <Label htmlFor="source_gear_house" className="cursor-pointer flex items-center gap-2 font-normal">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  From Gear House
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personal_gear" id="source_personal" />
                <Label htmlFor="source_personal" className="cursor-pointer flex items-center gap-2 font-normal">
                  <User className="w-4 h-4 text-blue-400" />
                  From My Personal Gear
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Date Range - Required for gear selection */}
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

          {/* Gear House Organization & Asset Selection */}
          {gearSourceSelection === 'gear_house' && (
            <div className="space-y-4 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select
                  value={selectedOrgId || ''}
                  onValueChange={(val) => handleOrgChange(val || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    {gearOptions?.organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          {org.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedOrgId && (
                <>
                  {/* Asset/Kit type selector */}
                  <div className="space-y-2">
                    <Label>Select From</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={selectedAssetType === 'asset' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedAssetType('asset')}
                      >
                        <Package className="w-4 h-4 mr-1" />
                        Assets
                      </Button>
                      <Button
                        type="button"
                        variant={selectedAssetType === 'kit' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedAssetType('kit')}
                      >
                        <Boxes className="w-4 h-4 mr-1" />
                        Kits
                      </Button>
                    </div>
                  </div>

                  {/* Show all toggle */}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="show_all"
                      checked={showAllAssets}
                      onCheckedChange={(checked) => setShowAllAssets(checked === true)}
                    />
                    <Label htmlFor="show_all" className="cursor-pointer font-normal text-sm">
                      Show all (including unavailable)
                    </Label>
                  </div>

                  {/* Asset selector */}
                  {selectedAssetType === 'asset' && (
                    <div className="space-y-2">
                      <Label>Select Asset</Label>
                      {gearOptionsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-gray">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading assets...
                        </div>
                      ) : (
                        <Select
                          value={formData.gear_asset_id || ''}
                          onValueChange={(val) => {
                            const asset = gearOptions?.organizations
                              ?.find(o => o.id === selectedOrgId)
                              ?.assets?.find(a => a.id === val);
                            handleAssetSelect(asset || null);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset..." />
                          </SelectTrigger>
                          <SelectContent>
                            {gearOptions?.organizations
                              ?.find(o => o.id === selectedOrgId)
                              ?.assets?.map((asset) => (
                                <SelectItem
                                  key={asset.id}
                                  value={asset.id}
                                  disabled={!asset.is_available_for_dates && !showAllAssets}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{asset.name}</span>
                                    {asset.internal_id && (
                                      <span className="text-xs text-muted-gray">({asset.internal_id})</span>
                                    )}
                                    {!asset.is_available_for_dates && (
                                      <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/30">
                                        Unavailable
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Kit selector */}
                  {selectedAssetType === 'kit' && (
                    <div className="space-y-2">
                      <Label>Select Kit</Label>
                      {gearOptionsLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-gray">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading kits...
                        </div>
                      ) : (
                        <Select
                          value={formData.gear_kit_instance_id || ''}
                          onValueChange={(val) => {
                            const kit = gearOptions?.organizations
                              ?.find(o => o.id === selectedOrgId)
                              ?.kits?.find(k => k.id === val);
                            handleKitSelect(kit || null);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select kit..." />
                          </SelectTrigger>
                          <SelectContent>
                            {gearOptions?.organizations
                              ?.find(o => o.id === selectedOrgId)
                              ?.kits?.map((kit) => (
                                <SelectItem
                                  key={kit.id}
                                  value={kit.id}
                                  disabled={!kit.is_available_for_dates && !showAllAssets}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{kit.name}</span>
                                    {kit.internal_id && (
                                      <span className="text-xs text-muted-gray">({kit.internal_id})</span>
                                    )}
                                    {!kit.is_available_for_dates && (
                                      <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/30">
                                        Unavailable
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Personal Gear Selection */}
          {gearSourceSelection === 'personal_gear' && (
            <div className="space-y-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show_all_personal"
                  checked={showAllAssets}
                  onCheckedChange={(checked) => setShowAllAssets(checked === true)}
                />
                <Label htmlFor="show_all_personal" className="cursor-pointer font-normal text-sm">
                  Show all (including unavailable)
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Select Personal Gear</Label>
                {gearOptionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-gray">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading personal gear...
                  </div>
                ) : (
                  <Select
                    value={formData.gear_asset_id || ''}
                    onValueChange={(val) => {
                      const asset = gearOptions?.personal_gear?.find(a => a.id === val);
                      handleAssetSelect(asset || null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gear..." />
                    </SelectTrigger>
                    <SelectContent>
                      {gearOptions?.personal_gear?.map((asset) => (
                        <SelectItem
                          key={asset.id}
                          value={asset.id}
                          disabled={!asset.is_available_for_dates && !showAllAssets}
                        >
                          <div className="flex items-center gap-2">
                            <span>{asset.name}</span>
                            {asset.category_name && (
                              <span className="text-xs text-muted-gray">({asset.category_name})</span>
                            )}
                            {!asset.is_available_for_dates && (
                              <Badge variant="outline" className="text-xs text-orange-400 border-orange-400/30">
                                Unavailable
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Kit Name - Manual entry or auto-filled */}
          <div className="space-y-2">
            <Label htmlFor="kit_name">
              Kit Name *
              {(formData.gear_asset_id || formData.gear_kit_instance_id) && (
                <span className="text-xs text-muted-gray ml-2">(auto-filled from gear)</span>
              )}
            </Label>
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
                {(formData.gear_asset_id || formData.gear_kit_instance_id) && (
                  <span className="text-xs text-muted-gray ml-1">(auto-filled)</span>
                )}
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
            <Card className="bg-charcoal-black/50 border-muted-gray/20">
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
