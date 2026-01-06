/**
 * PurchaseOrdersView - Manage Purchase Orders within Expenses tab
 *
 * Features:
 * - Create and manage purchase order requests
 * - View my POs and pending POs for approval
 * - Approve/Reject POs (for approvers)
 */
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShoppingCart,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  Building2,
  User,
  Calendar,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
} from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  usePurchaseOrders,
  useMyPurchaseOrders,
  usePurchaseOrderSummary,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useResubmitPurchaseOrder,
  useCompletePurchaseOrder,
  useCancelPurchaseOrder,
  useCanApprove,
  useBudgetCategories,
  PO_STATUS_CONFIG,
  formatPOCurrency,
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/hooks/backlot';
import { ScrollArea } from '@/components/ui/scroll-area';
import PurchaseOrderDetailContent from './details/PurchaseOrderDetailContent';

interface PurchaseOrdersViewProps {
  projectId: string;
  canEdit: boolean;
}

// Department options
const DEPARTMENT_OPTIONS = [
  'Production',
  'Camera',
  'Lighting',
  'Grip',
  'Sound',
  'Art',
  'Props',
  'Wardrobe',
  'Hair & Makeup',
  'Transportation',
  'Catering',
  'Locations',
  'Post-Production',
  'VFX',
  'Other',
];

export default function PurchaseOrdersView({ projectId, canEdit }: PurchaseOrdersViewProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'all'>('my');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [poToDelete, setPOToDelete] = useState<PurchaseOrder | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    estimated_amount: '',
    vendor_name: '',
    department: '',
    budget_category_id: '',
    notes: '',
  });

  // Hooks
  const { canApprovePOs } = useCanApprove(projectId);
  const { data: myPOs, isLoading: loadingMyPOs } = useMyPurchaseOrders(projectId);
  const { data: allPOs, isLoading: loadingAllPOs } = usePurchaseOrders(projectId);
  const { data: summary } = usePurchaseOrderSummary(projectId);
  const { data: budgetCategories } = useBudgetCategories(projectId, null);

  // Mutations
  const createPO = useCreatePurchaseOrder(projectId);
  const updatePO = useUpdatePurchaseOrder();
  const deletePO = useDeletePurchaseOrder();
  const approvePO = useApprovePurchaseOrder();
  const rejectPO = useRejectPurchaseOrder();
  const completePO = useCompletePurchaseOrder();
  const cancelPO = useCancelPurchaseOrder();
  const resubmitPO = useResubmitPurchaseOrder();

  // Filter pending POs for approval
  const pendingPOs = useMemo(() => {
    return allPOs?.filter(po => po.status === 'pending') || [];
  }, [allPOs]);

  // Reset form
  const resetForm = () => {
    setFormData({
      description: '',
      estimated_amount: '',
      vendor_name: '',
      department: '',
      budget_category_id: '',
      notes: '',
    });
    setSelectedPO(null);
  };

  // Handle create/update PO
  const handleSubmit = async () => {
    if (!formData.description || !formData.estimated_amount) return;

    const amount = parseFloat(formData.estimated_amount);
    if (isNaN(amount) || amount <= 0) return;

    const data = {
      description: formData.description,
      estimated_amount: amount,
      vendor_name: formData.vendor_name || undefined,
      department: formData.department || undefined,
      budget_category_id: formData.budget_category_id || undefined,
      notes: formData.notes || undefined,
    };

    if (selectedPO) {
      await updatePO.mutateAsync({ poId: selectedPO.id, data });
    } else {
      await createPO.mutateAsync(data);
    }

    setShowCreateDialog(false);
    resetForm();
  };

  // Handle edit PO
  const handleEdit = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setFormData({
      description: po.description,
      estimated_amount: po.estimated_amount.toString(),
      vendor_name: po.vendor_name || '',
      department: po.department || '',
      budget_category_id: po.budget_category_id || '',
      notes: po.notes || '',
    });
    setShowCreateDialog(true);
  };

  // Handle delete PO
  const handleDelete = async () => {
    if (!poToDelete) return;
    await deletePO.mutateAsync({ poId: poToDelete.id, projectId });
    setShowDeleteConfirm(false);
    setPOToDelete(null);
  };

  // Handle approve
  const handleApprove = async (po: PurchaseOrder) => {
    await approvePO.mutateAsync(po.id);
  };

  // Handle reject
  const handleReject = async () => {
    if (!selectedPO || !rejectReason) return;
    await rejectPO.mutateAsync({ poId: selectedPO.id, reason: rejectReason });
    setShowRejectDialog(false);
    setSelectedPO(null);
    setRejectReason('');
  };

  // Handle complete
  const handleComplete = async (po: PurchaseOrder) => {
    await completePO.mutateAsync(po.id);
  };

  // Handle cancel
  const handleCancel = async (po: PurchaseOrder) => {
    await cancelPO.mutateAsync(po.id);
  };

  // Handle resubmit
  const handleResubmit = async (po: PurchaseOrder) => {
    await resubmitPO.mutateAsync(po.id);
    setShowDetailDialog(false);
    setDetailPO(null);
  };

  // Open detail dialog
  const handleOpenDetail = (po: PurchaseOrder) => {
    setDetailPO(po);
    setShowDetailDialog(true);
  };

  // Render PO card
  const renderPOCard = (po: PurchaseOrder, showActions: boolean = true) => {
    const statusConfig = PO_STATUS_CONFIG[po.status];
    const isEditable = ['pending', 'rejected', 'denied'].includes(po.status);
    const canResubmit = ['rejected', 'denied'].includes(po.status);

    return (
      <Card
        key={po.id}
        className="bg-charcoal-black border-muted-gray/20 cursor-pointer hover:border-muted-gray/40 transition-colors"
        onClick={() => handleOpenDetail(po)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={cn(statusConfig.bgColor, statusConfig.color, 'border-0')}>
                  {statusConfig.label}
                </Badge>
                {po.department && (
                  <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                    {po.department}
                  </Badge>
                )}
              </div>
              <h4 className="font-medium text-bone-white truncate">{po.description}</h4>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-gray">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  {formatPOCurrency(po.estimated_amount)}
                </span>
                {po.vendor_name && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {po.vendor_name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(po.created_at)}
                </span>
              </div>
              {po.notes && (
                <p className="text-sm text-muted-gray mt-2 line-clamp-2">{po.notes}</p>
              )}
              {po.rejection_reason && (
                <div className="mt-2 p-2 rounded bg-red-500/10 text-red-400 text-sm">
                  <strong>Rejection reason:</strong> {po.rejection_reason}
                </div>
              )}
              {po.denial_reason && (
                <div className="mt-2 p-2 rounded bg-red-600/10 text-red-500 text-sm">
                  <strong>Denial reason:</strong> {po.denial_reason}
                </div>
              )}
            </div>

            {showActions && (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {/* Edit/Delete for editable POs (pending, rejected, denied) */}
                {isEditable && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(po)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPOToDelete(po);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </>
                )}

                {/* Resubmit for rejected/denied POs */}
                {canResubmit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => handleResubmit(po)}
                    disabled={resubmitPO.isPending}
                  >
                    {resubmitPO.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 mr-1" />
                    )}
                    Resubmit
                  </Button>
                )}

                {/* Approve/Reject for approvers */}
                {canApprovePOs && po.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      onClick={() => handleApprove(po)}
                      disabled={approvePO.isPending}
                    >
                      {approvePO.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        setSelectedPO(po);
                        setShowRejectDialog(true);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </>
                )}

                {/* Complete for approved POs */}
                {po.status === 'approved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    onClick={() => handleComplete(po)}
                    disabled={completePO.isPending}
                  >
                    {completePO.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                    )}
                    Mark Complete
                  </Button>
                )}

                {/* Cancel for pending POs (own) */}
                {po.status === 'pending' && !canApprovePOs && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-gray hover:text-red-400"
                    onClick={() => handleCancel(po)}
                    disabled={cancelPO.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loadingMyPOs || loadingAllPOs) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-bone-white">Purchase Orders</h3>
          <p className="text-sm text-muted-gray">
            Request budget approval for purchases
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              resetForm();
              setShowCreateDialog(true);
            }}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New PO
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-bone-white">{summary.pending_count}</p>
                  <p className="text-xs text-muted-gray">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-bone-white">{summary.approved_count}</p>
                  <p className="text-xs text-muted-gray">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-bone-white">
                    {formatPOCurrency(summary.pending_total)}
                  </p>
                  <p className="text-xs text-muted-gray">Pending Value</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-bone-white">
                    {formatPOCurrency(summary.approved_total)}
                  </p>
                  <p className="text-xs text-muted-gray">Approved Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-muted-gray/10">
          <TabsTrigger value="my">
            My POs
            {myPOs && myPOs.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {myPOs.length}
              </Badge>
            )}
          </TabsTrigger>
          {canApprovePOs && (
            <TabsTrigger value="pending">
              Pending Approval
              {pendingPOs.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-400">
                  {pendingPOs.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="all">All POs</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4 mt-4">
          {myPOs && myPOs.length > 0 ? (
            myPOs.map(po => renderPOCard(po))
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center">
                <ShoppingCart className="w-12 h-12 text-muted-gray mx-auto mb-4" />
                <h3 className="text-lg font-medium text-bone-white mb-2">No Purchase Orders</h3>
                <p className="text-sm text-muted-gray mb-4">
                  You haven't created any purchase orders yet.
                </p>
                {canEdit && (
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create PO
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {canApprovePOs && (
          <TabsContent value="pending" className="space-y-4 mt-4">
            {pendingPOs.length > 0 ? (
              pendingPOs.map(po => renderPOCard(po))
            ) : (
              <Card className="bg-charcoal-black border-muted-gray/20">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-bone-white mb-2">All Caught Up!</h3>
                  <p className="text-sm text-muted-gray">
                    No purchase orders awaiting approval.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="all" className="space-y-4 mt-4">
          {allPOs && allPOs.length > 0 ? (
            allPOs.map(po => renderPOCard(po, canApprovePOs))
          ) : (
            <Card className="bg-charcoal-black border-muted-gray/20">
              <CardContent className="py-12 text-center">
                <ShoppingCart className="w-12 h-12 text-muted-gray mx-auto mb-4" />
                <h3 className="text-lg font-medium text-bone-white mb-2">No Purchase Orders</h3>
                <p className="text-sm text-muted-gray">
                  No purchase orders have been created for this project.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedPO ? 'Edit Purchase Order' : 'Create Purchase Order'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this purchase for?"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Estimated Amount *</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.estimated_amount}
                  onChange={(e) => setFormData({ ...formData, estimated_amount: e.target.value })}
                  placeholder="0.00"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor</Label>
                <Input
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  placeholder="Vendor name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(v) => setFormData({ ...formData, department: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {budgetCategories && budgetCategories.length > 0 && (
              <div>
                <Label>Budget Category</Label>
                <Select
                  value={formData.budget_category_id}
                  onValueChange={(v) => setFormData({ ...formData, budget_category_id: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Link to budget category" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgetCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.description || !formData.estimated_amount || createPO.isPending || updatePO.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {(createPO.isPending || updatePO.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {selectedPO ? 'Update' : 'Create'} PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-gray">
              Please provide a reason for rejecting this purchase order.
            </p>
            <div>
              <Label>Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Why is this being rejected?"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={!rejectReason || rejectPO.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {rejectPO.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Reject PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this purchase order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-muted-gray/10">
            <DialogTitle>Purchase Order Details</DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-4">
              {detailPO && <PurchaseOrderDetailContent poId={detailPO.id} />}
            </div>
          </ScrollArea>

          <DialogFooter className="px-4 py-4 flex-shrink-0 border-t border-muted-gray/10">
            <div className="flex items-center justify-between w-full">
              <Button
                variant="ghost"
                onClick={() => setShowDetailDialog(false)}
              >
                Close
              </Button>
              <div className="flex items-center gap-2">
                {detailPO && ['rejected', 'denied'].includes(detailPO.status) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDetailDialog(false);
                        handleEdit(detailPO);
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleResubmit(detailPO)}
                      disabled={resubmitPO.isPending}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {resubmitPO.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Clock className="w-4 h-4 mr-2" />
                      )}
                      Resubmit for Approval
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
