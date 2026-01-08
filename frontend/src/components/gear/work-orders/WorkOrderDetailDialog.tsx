/**
 * Work Order Detail Dialog
 * View and manage a work order, stage items, and checkout
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  Loader2,
  Package,
  User,
  Calendar,
  Building2,
  Clock,
  CheckCircle2,
  Edit,
  Trash2,
  ArrowRight,
  ClipboardList,
  AlertCircle,
  Plus,
  MapPin,
  Printer,
  ScanBarcode,
  Camera,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { GearWorkOrder, GearWorkOrderItem, WorkOrderStatus, WorkOrderStagingVerifyMethod } from '@/types/gear';
import { useWorkOrder, useWorkOrderMutations } from '@/hooks/gear/useGearWorkOrders';
import { useGearOrgSettings } from '@/hooks/gear/useGearHouse';
import { Progress } from '@/components/ui/progress';
import { WorkOrderDialog } from './WorkOrderDialog';
import { generateWorkOrderSlipPdf } from './PrintableWorkOrderSlip';
import { CameraScannerModal } from '@/components/gear/scanner';
import type { ScanResult } from '@/types/scanner';
import { useToast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<WorkOrderStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  ready: { label: 'Ready', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  checked_out: { label: 'Checked Out', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

interface WorkOrderDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  workOrderId: string | null;
}

export function WorkOrderDetailDialog({
  isOpen,
  onClose,
  orgId,
  workOrderId,
}: WorkOrderDetailDialogProps) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [stagingItems, setStagingItems] = useState<Set<string>>(new Set());
  const [isPrinting, setIsPrinting] = useState(false);
  const [scannerValue, setScannerValue] = useState('');
  const [isScanProcessing, setIsScanProcessing] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { workOrder, isLoading, error, refetch } = useWorkOrder(orgId, workOrderId);
  const { settings: orgSettings } = useGearOrgSettings(orgId);
  const {
    updateWorkOrder,
    deleteWorkOrder,
    stageItem,
    stageByScan,
    checkoutFromWorkOrder,
  } = useWorkOrderMutations(orgId);

  // Get staging verification method from org settings
  const verifyMethod: WorkOrderStagingVerifyMethod = orgSettings?.work_order_staging_verify_method || 'checkoff_only';
  const showScanner = verifyMethod !== 'checkoff_only';
  const showCheckboxes = verifyMethod === 'checkoff_only' || verifyMethod === 'scan_or_checkoff';

  if (!isOpen) return null;

  const statusConfig = workOrder ? STATUS_CONFIG[workOrder.status] : STATUS_CONFIG.draft;
  const items = workOrder?.items || [];
  const itemCount = items.length;
  const stagedCount = items.filter((i) => i.is_staged).length;
  const progressPercent = itemCount > 0 ? (stagedCount / itemCount) * 100 : 0;
  const allStaged = itemCount > 0 && stagedCount === itemCount;
  const canCheckout = workOrder?.status === 'ready' || (workOrder?.status === 'in_progress' && allStaged);
  const canEdit = workOrder?.status === 'draft' || workOrder?.status === 'in_progress';
  const canDelete = workOrder?.status === 'draft' || workOrder?.status === 'cancelled';

  // Handle staging an item
  const handleStageItem = async (itemId: string, staged: boolean) => {
    if (!workOrder) return;

    setStagingItems((prev) => new Set(prev).add(itemId));
    try {
      await stageItem.mutateAsync({
        workOrderId: workOrder.id,
        itemId,
        staged,
      });
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update item staging status',
        variant: 'destructive',
      });
    } finally {
      setStagingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  // Handle status change to in_progress when staging starts
  const handleStartProgress = async () => {
    if (!workOrder || workOrder.status !== 'draft') return;

    try {
      await updateWorkOrder.mutateAsync({
        workOrderId: workOrder.id,
        input: { status: 'in_progress' },
      });
      refetch();
      toast({
        title: 'Work order started',
        description: 'Status changed to In Progress',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  // Handle marking as ready
  const handleMarkReady = async () => {
    if (!workOrder) return;

    try {
      await updateWorkOrder.mutateAsync({
        workOrderId: workOrder.id,
        input: { status: 'ready' },
      });
      refetch();
      toast({
        title: 'Work order ready',
        description: 'All items are staged and ready for checkout',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  // Handle checkout
  const handleCheckout = async () => {
    if (!workOrder) return;

    try {
      const result = await checkoutFromWorkOrder.mutateAsync({
        workOrderId: workOrder.id,
      });
      toast({
        title: 'Checkout complete',
        description: `Created transaction ${result.transaction.reference_number || result.transaction.id.slice(0, 8)}`,
      });
      setIsCheckoutDialogOpen(false);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to checkout work order',
        variant: 'destructive',
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!workOrder) return;

    try {
      await deleteWorkOrder.mutateAsync(workOrder.id);
      toast({
        title: 'Deleted',
        description: 'Work order has been deleted',
      });
      setIsDeleteDialogOpen(false);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete work order',
        variant: 'destructive',
      });
    }
  };

  // Handle print
  const handlePrint = async () => {
    if (!workOrder) return;

    setIsPrinting(true);
    try {
      await generateWorkOrderSlipPdf(workOrder);
      toast({
        title: 'PDF Generated',
        description: 'Work order slip has been downloaded',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate PDF',
        variant: 'destructive',
      });
    } finally {
      setIsPrinting(false);
    }
  };

  // Handle scanner input
  const handleScanSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workOrder || !scannerValue.trim() || isScanProcessing) return;

    const scannedValue = scannerValue.trim();
    setIsScanProcessing(true);

    try {
      // Start progress if draft
      if (workOrder.status === 'draft') {
        await handleStartProgress();
      }

      await stageByScan.mutateAsync({
        workOrderId: workOrder.id,
        scannedValue,
      });

      toast({
        title: 'Item staged',
        description: `Scanned: ${scannedValue}`,
      });

      setScannerValue('');
      refetch();

      // Refocus scanner input for next scan
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stage item';
      toast({
        title: 'Scan failed',
        description: message,
        variant: 'destructive',
      });
      // Keep focus on scanner for retry
      scannerInputRef.current?.focus();
    } finally {
      setIsScanProcessing(false);
    }
  };

  // Handle camera scan result
  const handleCameraScan = async (result: ScanResult) => {
    if (!workOrder || isScanProcessing) return;

    setShowCameraScanner(false);
    setIsScanProcessing(true);

    try {
      // Start progress if draft
      if (workOrder.status === 'draft') {
        await handleStartProgress();
      }

      await stageByScan.mutateAsync({
        workOrderId: workOrder.id,
        scannedValue: result.code,
      });

      toast({
        title: 'Item staged',
        description: `Scanned: ${result.code}`,
      });

      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stage item';
      toast({
        title: 'Scan failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsScanProcessing(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-3xl bg-charcoal-black border-muted-gray/30 max-h-[90vh] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-400">Failed to load work order</p>
              <p className="text-sm text-muted-gray mt-1">{error.message}</p>
            </div>
          ) : workOrder ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-bone-white flex items-center gap-3">
                      {workOrder.title}
                      <Badge className={cn('border', statusConfig.color)}>
                        {statusConfig.label}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-muted-gray mt-1">
                      {workOrder.reference_number && (
                        <code className="mr-2">{workOrder.reference_number}</code>
                      )}
                      Created {format(new Date(workOrder.created_at), 'MMM d, yyyy')}
                      {workOrder.created_by_name && ` by ${workOrder.created_by_name}`}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Info Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Custodian */}
                  <InfoCard
                    icon={<User className="w-4 h-4" />}
                    label="Equipment For"
                    value={
                      workOrder.custodian_user_name ||
                      workOrder.custodian_contact_name ||
                      workOrder.project_name ||
                      'Not assigned'
                    }
                  />

                  {/* Assigned */}
                  <InfoCard
                    icon={<User className="w-4 h-4" />}
                    label="Preparer"
                    value={workOrder.assigned_to_name || 'Unassigned'}
                  />

                  {/* Due Date */}
                  <InfoCard
                    icon={<Calendar className="w-4 h-4" />}
                    label="Due Date"
                    value={workOrder.due_date ? format(new Date(workOrder.due_date), 'MMM d, yyyy') : 'Not set'}
                  />

                  {/* Pickup Date */}
                  <InfoCard
                    icon={<Clock className="w-4 h-4" />}
                    label="Pickup"
                    value={workOrder.pickup_date ? format(new Date(workOrder.pickup_date), 'MMM d, yyyy') : 'Not set'}
                  />
                </div>

                {/* Notes */}
                {workOrder.notes && (
                  <div className="p-3 rounded-lg bg-charcoal-black/30 border border-muted-gray/20">
                    <p className="text-sm text-muted-gray">{workOrder.notes}</p>
                  </div>
                )}

                {/* Progress */}
                {itemCount > 0 && workOrder.status !== 'checked_out' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-gray">Staging Progress</span>
                      <span className="text-bone-white">
                        {stagedCount} / {itemCount} items staged
                      </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                )}

                <Separator className="bg-muted-gray/30" />

                {/* Items List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-bone-white flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Items ({itemCount})
                    </h4>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditDialogOpen(true)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Items
                      </Button>
                    )}
                  </div>

                  {/* Scanner Input */}
                  {showScanner && (workOrder.status === 'draft' || workOrder.status === 'in_progress') && items.length > 0 && (
                    <form onSubmit={handleScanSubmit} className="flex gap-2">
                      <div className="relative flex-1">
                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                        <Input
                          ref={scannerInputRef}
                          type="text"
                          placeholder={verifyMethod === 'qr_required' ? 'Scan QR code to stage...' : 'Scan barcode to stage...'}
                          value={scannerValue}
                          onChange={(e) => setScannerValue(e.target.value)}
                          disabled={isScanProcessing}
                          className="pl-10 bg-charcoal-black/50 border-muted-gray/30"
                          autoComplete="off"
                        />
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setShowCameraScanner(true)}
                              disabled={isScanProcessing}
                              className="flex-shrink-0"
                            >
                              <Camera className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Scan with camera</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        type="submit"
                        disabled={!scannerValue.trim() || isScanProcessing}
                        variant="outline"
                      >
                        {isScanProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Stage'
                        )}
                      </Button>
                    </form>
                  )}

                  {items.length === 0 ? (
                    <Card className="bg-charcoal-black/30 border-muted-gray/20">
                      <CardContent className="p-6 text-center text-muted-gray">
                        No items added yet
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          canStage={workOrder.status === 'draft' || workOrder.status === 'in_progress'}
                          showCheckbox={showCheckboxes}
                          isStaging={stagingItems.has(item.id)}
                          onStageChange={(staged) => {
                            // Start progress if draft
                            if (workOrder.status === 'draft') {
                              handleStartProgress();
                            }
                            handleStageItem(item.id, staged);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="flex gap-2 flex-1">
                  {canDelete && (
                    <Button
                      variant="ghost"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => setIsDeleteDialogOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(true)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handlePrint}
                    disabled={isPrinting}
                  >
                    {isPrinting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="w-4 h-4 mr-2" />
                    )}
                    Print
                  </Button>
                </div>

                <div className="flex gap-2">
                  {workOrder.status === 'in_progress' && allStaged && (
                    <Button
                      variant="outline"
                      onClick={handleMarkReady}
                      disabled={updateWorkOrder.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Mark Ready
                    </Button>
                  )}

                  {canCheckout && (
                    <Button
                      onClick={() => setIsCheckoutDialogOpen(true)}
                      className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Checkout
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {workOrder && (
        <WorkOrderDialog
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          orgId={orgId}
          workOrder={workOrder}
          onSuccess={() => {
            setIsEditDialogOpen(false);
            refetch();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this work order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteWorkOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Checkout Confirmation */}
      <AlertDialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Checkout Work Order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a checkout transaction and mark all items as checked out.
              The work order will be linked to the new transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCheckout}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {checkoutFromWorkOrder.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Checkout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
        title="Scan to Stage Item"
        scanMode="continuous"
        audioFeedback
        hapticFeedback
      />
    </>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-charcoal-black/30 border border-muted-gray/20">
      <div className="flex items-center gap-2 text-muted-gray text-xs mb-1">
        {icon}
        {label}
      </div>
      <p className="text-sm text-bone-white truncate">{value}</p>
    </div>
  );
}

function ItemRow({
  item,
  canStage,
  showCheckbox,
  isStaging,
  onStageChange,
}: {
  item: GearWorkOrderItem;
  canStage: boolean;
  showCheckbox: boolean;
  isStaging: boolean;
  onStageChange: (staged: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        item.is_staged
          ? "bg-green-500/10 border-green-500/30"
          : "bg-charcoal-black/30 border-muted-gray/20"
      )}
    >
      {canStage && showCheckbox && (
        <div className="relative">
          {isStaging ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
          ) : (
            <Checkbox
              checked={item.is_staged}
              onCheckedChange={(checked) => onStageChange(!!checked)}
            />
          )}
        </div>
      )}

      <div className="w-8 h-8 rounded bg-charcoal-black/50 flex items-center justify-center">
        <Package className="w-4 h-4 text-muted-gray" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-bone-white truncate">
          {item.asset_name || item.kit_name || 'Unknown Item'}
        </p>
        <p className="text-xs text-muted-gray">
          {item.asset_internal_id || item.kit_internal_id}
          {item.quantity > 1 && ` (x${item.quantity})`}
        </p>
      </div>

      {item.is_staged && (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Staged
        </Badge>
      )}
    </div>
  );
}

export default WorkOrderDetailDialog;
