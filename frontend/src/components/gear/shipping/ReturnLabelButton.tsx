/**
 * ReturnLabelButton
 * Generate and download return shipping labels
 */
import React, { useState } from 'react';
import { Package, Download, Printer, Loader2, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateReturnLabel } from '@/hooks/gear/useGearMarketplace';
import type { GearShipment } from '@/types/gear';

interface ReturnLabelButtonProps {
  orderId: string;
  originalShipment?: GearShipment | null;
  existingReturnLabel?: GearShipment | null;
  onLabelCreated?: (shipment: GearShipment) => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function ReturnLabelButton({
  orderId,
  originalShipment,
  existingReturnLabel,
  onLabelCreated,
  variant = 'outline',
  size = 'default',
  className,
}: ReturnLabelButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const createReturnLabel = useCreateReturnLabel();

  // If return label already exists, show download button
  if (existingReturnLabel?.label_url) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant={variant}
          size={size}
          onClick={() => window.open(existingReturnLabel.label_url!, '_blank')}
        >
          <Download className="w-4 h-4 mr-2" />
          Download Return Label
        </Button>
        {existingReturnLabel.tracking_url && (
          <Button
            variant="ghost"
            size={size}
            onClick={() => window.open(existingReturnLabel.tracking_url!, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Track Return
          </Button>
        )}
      </div>
    );
  }

  const handleCreateLabel = async () => {
    try {
      const result = await createReturnLabel.mutateAsync({ order_id: orderId });
      if (onLabelCreated) {
        onLabelCreated(result);
      }
      setShowDialog(false);
    } catch {
      // Error is handled by mutation state
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setShowDialog(true)} className={className}>
        <Package className="w-4 h-4 mr-2" />
        Generate Return Label
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Generate Return Shipping Label
            </DialogTitle>
            <DialogDescription>
              Create a prepaid return label for this rental
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Original shipment info */}
            {originalShipment && (
              <div className="p-4 rounded-lg bg-white/5">
                <h4 className="text-sm font-medium text-bone-white mb-2">Original Shipment</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-gray">Carrier:</span>
                    <span className="text-bone-white ml-2 uppercase">{originalShipment.carrier}</span>
                  </div>
                  <div>
                    <span className="text-muted-gray">Service:</span>
                    <span className="text-bone-white ml-2">{originalShipment.service}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Info about return label */}
            <div className="p-4 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-accent-yellow flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-bone-white font-medium">Return Label Details</p>
                  <ul className="text-muted-gray mt-2 space-y-1">
                    <li>• Label will be generated using the same carrier as the original shipment</li>
                    <li>• Shipping addresses will be swapped automatically</li>
                    <li>• You can download or print the label after generation</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Error state */}
            {createReturnLabel.isError && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Failed to generate label</p>
                    <p className="text-sm text-red-400/80 mt-1">
                      {createReturnLabel.error instanceof Error
                        ? createReturnLabel.error.message
                        : 'An unexpected error occurred'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Success state */}
            {createReturnLabel.isSuccess && createReturnLabel.data && (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-start gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Return label created!</p>
                    {createReturnLabel.data.tracking_number && (
                      <p className="text-sm text-green-400/80 mt-1">
                        Tracking: {createReturnLabel.data.tracking_number}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>

            {createReturnLabel.isSuccess && createReturnLabel.data?.label_url ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const printWindow = window.open(createReturnLabel.data!.label_url!, '_blank');
                    if (printWindow) {
                      printWindow.onload = () => printWindow.print();
                    }
                  }}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button onClick={() => window.open(createReturnLabel.data!.label_url!, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            ) : (
              <Button onClick={handleCreateLabel} disabled={createReturnLabel.isPending}>
                {createReturnLabel.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4 mr-2" />
                    Generate Label
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ReturnLabelButton;
