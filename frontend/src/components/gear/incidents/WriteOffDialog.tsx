/**
 * Write-Off Dialog
 * Dialog to write off an asset and optionally create a purchase request
 */
import React, { useState } from 'react';
import { Trash2, Loader2, ShoppingCart, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface WriteOffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    write_off_value: number;
    write_off_reason: string;
    create_purchase_request?: boolean;
    purchase_request_title?: string;
    estimated_replacement_cost?: number;
  }) => Promise<void>;
  isSubmitting: boolean;
  assetName?: string;
  assetValue?: number;
}

export function WriteOffDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  assetName,
  assetValue,
}: WriteOffDialogProps) {
  const [writeOffValue, setWriteOffValue] = useState(assetValue?.toString() || '');
  const [writeOffReason, setWriteOffReason] = useState('');
  const [createPurchaseRequest, setCreatePurchaseRequest] = useState(false);
  const [purchaseRequestTitle, setPurchaseRequestTitle] = useState(
    assetName ? `Replace ${assetName}` : ''
  );
  const [estimatedCost, setEstimatedCost] = useState('');

  // Update purchase request title when asset name changes
  React.useEffect(() => {
    if (assetName) {
      setPurchaseRequestTitle(`Replace ${assetName}`);
    }
    if (assetValue) {
      setWriteOffValue(assetValue.toString());
    }
  }, [assetName, assetValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const value = parseFloat(writeOffValue);
    if (isNaN(value) || value < 0) return;
    if (!writeOffReason.trim()) return;

    await onSubmit({
      write_off_value: value,
      write_off_reason: writeOffReason.trim(),
      create_purchase_request: createPurchaseRequest,
      purchase_request_title: createPurchaseRequest ? purchaseRequestTitle : undefined,
      estimated_replacement_cost: createPurchaseRequest && estimatedCost
        ? parseFloat(estimatedCost)
        : undefined,
    });

    // Reset form
    setWriteOffValue('');
    setWriteOffReason('');
    setCreatePurchaseRequest(false);
    setPurchaseRequestTitle('');
    setEstimatedCost('');
  };

  const handleClose = () => {
    setWriteOffValue('');
    setWriteOffReason('');
    setCreatePurchaseRequest(false);
    setPurchaseRequestTitle('');
    setEstimatedCost('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Write Off Asset
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Mark this asset as written off due to damage or loss
            {assetName && (
              <span className="block mt-1 text-bone-white font-medium">{assetName}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Write-off Value */}
          <div className="space-y-2">
            <Label className="text-bone-white">Write-off Value *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                type="number"
                min="0"
                step="0.01"
                value={writeOffValue}
                onChange={(e) => setWriteOffValue(e.target.value)}
                placeholder="0.00"
                className="pl-9 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
                required
              />
            </div>
            <p className="text-xs text-muted-gray">
              The value being written off (typically purchase price or depreciated value)
            </p>
          </div>

          {/* Write-off Reason */}
          <div className="space-y-2">
            <Label className="text-bone-white">Reason *</Label>
            <Textarea
              value={writeOffReason}
              onChange={(e) => setWriteOffReason(e.target.value)}
              placeholder="Explain why this asset is being written off..."
              rows={3}
              className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white resize-none"
              required
            />
          </div>

          {/* Create Purchase Request */}
          <div className="space-y-3 p-3 rounded-lg bg-charcoal-black/30 border border-muted-gray/20">
            <div className="flex items-start gap-3">
              <Checkbox
                id="create-pr"
                checked={createPurchaseRequest}
                onCheckedChange={(checked) => setCreatePurchaseRequest(checked === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="create-pr" className="text-bone-white cursor-pointer">
                  Create Purchase Request
                </Label>
                <p className="text-xs text-muted-gray mt-0.5">
                  Request a replacement for this asset
                </p>
              </div>
            </div>

            {createPurchaseRequest && (
              <div className="space-y-3 pt-2 border-t border-muted-gray/20">
                {/* Purchase Request Title */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-gray">Request Title</Label>
                  <Input
                    value={purchaseRequestTitle}
                    onChange={(e) => setPurchaseRequestTitle(e.target.value)}
                    placeholder="e.g., Replace damaged camera"
                    className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
                  />
                </div>

                {/* Estimated Cost */}
                <div className="space-y-1.5">
                  <Label className="text-sm text-muted-gray">Estimated Replacement Cost</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      placeholder="0.00"
                      className="pl-9 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !writeOffValue || !writeOffReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {createPurchaseRequest ? 'Write Off & Request' : 'Write Off Asset'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default WriteOffDialog;
