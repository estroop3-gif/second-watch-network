/**
 * Check-in Receipt Dialog
 * Displays a summary of completed check-in with PDF download option
 */
import React, { useState } from 'react';
import {
  Check,
  Download,
  AlertTriangle,
  Clock,
  Package,
  Wrench,
  FileWarning,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useCheckinReceipt } from '@/hooks/gear/useGearCheckin';

interface CheckinReceiptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  transactionId: string;
}

export function CheckinReceiptDialog({
  isOpen,
  onClose,
  orgId,
  transactionId,
}: CheckinReceiptDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { receipt, isLoading, error } = useCheckinReceipt(orgId, transactionId);

  const handleDownloadPdf = async () => {
    if (!receipt) return;

    setIsDownloading(true);
    try {
      const { generateCheckinReceiptPdf } = await import('./PrintableCheckinReceipt');
      await generateCheckinReceiptPdf(receipt);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Loading Receipt...</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !receipt) {
    const rawMessage = error?.message || 'Receipt not found';
    const firstLine = rawMessage.split('\n')[0];
    const cleanMessage = firstLine.length > 200 ? firstLine.slice(0, 200) + '...' : firstLine;
    const hasDetails = rawMessage.length > cleanMessage.length;

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check-in Complete</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            <Check className="h-12 w-12 text-green-600 mb-4" />
            <p className="text-lg font-medium mb-2">Items returned successfully</p>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Receipt unavailable: {cleanMessage}
            </p>
            {hasDetails && (
              <details className="w-full mb-4">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Show technical details
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto bg-muted/50 rounded p-2">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all">
                    {rawMessage}
                  </pre>
                </div>
              </details>
            )}
            <Button onClick={onClose}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Check-in Complete
          </DialogTitle>
        </DialogHeader>

        {/* Receipt Content */}
        <div className="space-y-4">
          {/* Header */}
          <div className="text-center pb-4 border-b">
            <h1 className="text-xl font-bold">Check-in Receipt</h1>
            <p className="text-muted-foreground">
              {receipt.returned_at
                ? format(new Date(receipt.returned_at), 'MMM d, yyyy h:mm a')
                : 'N/A'}
            </p>
            {receipt.project_name && (
              <p className="text-sm font-medium mt-1">{receipt.project_name}</p>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Returned by</p>
              <p className="font-medium">{receipt.custodian_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Items returned</p>
              <p className="font-medium">{receipt.total_items}</p>
            </div>
          </div>

          {/* Late Info */}
          {receipt.is_overdue && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Late return: {receipt.late_days} day{receipt.late_days !== 1 ? 's' : ''}
                  </p>
                  {receipt.late_fee_amount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Late fee: ${receipt.late_fee_amount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Partial Return Warning */}
          {receipt.partial_return && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-600">Partial Return</p>
                  <p className="text-sm text-muted-foreground">
                    {receipt.items_not_returned} item{receipt.items_not_returned !== 1 ? 's' : ''} not returned
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Items List */}
          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" />
              Items Returned
            </h2>
            <div className="space-y-2">
              {receipt.items.map((item) => (
                <div
                  key={item.asset_id}
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.asset_name}</p>
                    {item.barcode && (
                      <p className="text-xs text-muted-foreground">{item.barcode}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {item.condition_grade && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          item.condition_grade === 'excellent' && 'bg-green-100 text-green-800',
                          item.condition_grade === 'good' && 'bg-blue-100 text-blue-800',
                          item.condition_grade === 'fair' && 'bg-yellow-100 text-yellow-800',
                          item.condition_grade === 'poor' && 'bg-orange-100 text-orange-800',
                          item.condition_grade === 'non_functional' && 'bg-red-100 text-red-800'
                        )}
                      >
                        {item.condition_grade}
                      </Badge>
                    )}
                    {(item.has_cosmetic_damage ||
                      item.has_functional_damage ||
                      item.is_unsafe) && (
                      <Badge variant="destructive" className="shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Damaged
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Incidents Created */}
          {receipt.incidents.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold flex items-center gap-2 mb-3">
                  <FileWarning className="h-4 w-4" />
                  Incidents Logged
                </h2>
                <div className="space-y-2">
                  {receipt.incidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-2 rounded border border-yellow-200 bg-yellow-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{incident.asset_name}</p>
                        <Badge variant="outline">{incident.incident_type}</Badge>
                      </div>
                      {incident.damage_description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {incident.damage_description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Repairs Created */}
          {receipt.repairs.length > 0 && (
            <>
              <Separator />
              <div>
                <h2 className="font-semibold flex items-center gap-2 mb-3">
                  <Wrench className="h-4 w-4" />
                  Repair Tickets Created
                </h2>
                <div className="space-y-2">
                  {receipt.repairs.map((repair) => (
                    <div
                      key={repair.id}
                      className="p-2 rounded border border-orange-200 bg-orange-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{repair.asset_name}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            repair.priority === 'urgent' && 'border-red-500 text-red-600',
                            repair.priority === 'high' && 'border-orange-500 text-orange-600'
                          )}
                        >
                          {repair.priority}
                        </Badge>
                      </div>
                      {repair.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {repair.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {receipt.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{receipt.notes}</p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloading}>
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
          <Button onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CheckinReceiptDialog;
