/**
 * Check-in Dialog
 * Accordion-based check-in workflow with condition assessment, damage reporting, and late fee handling
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  X,
  Package,
  CheckCircle,
  AlertTriangle,
  Clock,
  MapPin,
  FileText,
  Camera,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { useStartCheckinFromTransaction, useCompleteCheckin, useCheckinReceipt } from '@/hooks/gear/useGearCheckin';
import { useGearLocations } from '@/hooks/gear';
import type {
  GearTransaction,
  GearTransactionItem,
  CheckinSettings,
  LateInfo,
  CheckinConditionReport,
  AssetCondition,
  CheckinDamageTier,
} from '@/types/gear';

import { ConditionRatingCard } from './ConditionRatingCard';
import { DamageReportModal } from './DamageReportModal';
import { CheckinReceiptDialog } from './CheckinReceiptDialog';

interface CheckinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  transactionId: string;
}

export function CheckinDialog({
  isOpen,
  onClose,
  orgId,
  transactionId,
}: CheckinDialogProps) {
  // Check-in session state
  const [expandedSections, setExpandedSections] = useState<string[]>(['items']);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [conditionReports, setConditionReports] = useState<Map<string, CheckinConditionReport>>(new Map());
  const [returnLocationId, setReturnLocationId] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Damage modal state
  const [damageAssetId, setDamageAssetId] = useState<string | null>(null);
  const [damageAssetName, setDamageAssetName] = useState('');

  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedTransactionId, setCompletedTransactionId] = useState<string | null>(null);

  // Hooks
  const {
    startCheckin,
    isLoading: isStarting,
    data: checkinData,
    error: startError,
    reset: resetStart
  } = useStartCheckinFromTransaction(orgId);

  const {
    completeCheckin,
    isLoading: isCompleting,
    error: completeError
  } = useCompleteCheckin(orgId, transactionId);

  const { locations } = useGearLocations(orgId);

  // Start the check-in session when dialog opens
  useEffect(() => {
    if (isOpen && transactionId) {
      startCheckin(transactionId);
    }
  }, [isOpen, transactionId, startCheckin]);

  // Initialize selected items from transaction
  useEffect(() => {
    if (checkinData?.transaction?.items) {
      const assetIds = new Set(
        checkinData.transaction.items
          .filter((item) => item.asset_id)
          .map((item) => item.asset_id!)
      );
      setSelectedItems(assetIds);
    }
  }, [checkinData]);

  // Handlers
  const handleItemToggle = useCallback((assetId: string, checked: boolean) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(assetId);
      } else {
        next.delete(assetId);
      }
      return next;
    });
  }, []);

  const handleConditionChange = useCallback(
    (assetId: string, condition: AssetCondition, notes?: string) => {
      setConditionReports((prev) => {
        const next = new Map(prev);
        const existing = next.get(assetId);
        next.set(assetId, {
          asset_id: assetId,
          condition_grade: condition,
          has_damage: existing?.has_damage ?? false,
          damage_tier: existing?.damage_tier,
          damage_description: existing?.damage_description,
          damage_photos: existing?.damage_photos,
          notes,
        });
        return next;
      });
    },
    []
  );

  const handleDamageReport = useCallback(
    (assetId: string, tier: CheckinDamageTier, description: string, photos: string[]) => {
      setConditionReports((prev) => {
        const next = new Map(prev);
        const existing = next.get(assetId);
        next.set(assetId, {
          asset_id: assetId,
          condition_grade: existing?.condition_grade ?? 'poor',
          has_damage: true,
          damage_tier: tier,
          damage_description: description,
          damage_photos: photos,
          notes: existing?.notes,
        });
        return next;
      });
      setDamageAssetId(null);
    },
    []
  );

  const openDamageModal = useCallback((assetId: string, assetName: string) => {
    setDamageAssetId(assetId);
    setDamageAssetName(assetName);
  }, []);

  const handleComplete = async () => {
    try {
      const result = await completeCheckin({
        items_to_return: Array.from(selectedItems),
        condition_reports: Array.from(conditionReports.values()),
        checkin_location_id: returnLocationId || undefined,
        notes: notes || undefined,
      });

      // Check for successful completion - API returns transaction on success
      if (result?.transaction) {
        setCompletedTransactionId(transactionId);
        setShowReceipt(true);
      }
    } catch (err) {
      console.error('Check-in failed:', err);
    }
  };

  const handleClose = useCallback(() => {
    resetStart();
    setSelectedItems(new Set());
    setConditionReports(new Map());
    setReturnLocationId('');
    setNotes('');
    setExpandedSections(['items']);
    onClose();
  }, [onClose, resetStart]);

  const handleReceiptClose = useCallback(() => {
    setShowReceipt(false);
    handleClose();
  }, [handleClose]);

  // Extract data from check-in session
  const transaction = checkinData?.transaction;
  const lateInfo = checkinData?.late_info;
  const settings = checkinData?.settings;
  const items = transaction?.items ?? [];

  // Calculate partial return info
  const totalItems = items.filter((i) => i.asset_id).length;
  const returningItems = selectedItems.size;
  const isPartialReturn = returningItems < totalItems && returningItems > 0;

  // Check if we can complete
  const canComplete = selectedItems.size > 0 && !isCompleting;

  // Check if condition reports are required but missing
  const conditionRequired = settings?.require_condition_on_checkin ?? false;
  const missingConditions = conditionRequired
    ? Array.from(selectedItems).filter((id) => !conditionReports.has(id))
    : [];

  // Render loading state
  if (isStarting) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Loading check-in details...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Render error state
  if (startError) {
    // Extract a cleaner error message (first line or up to 200 chars)
    const rawMessage = startError.message || 'An unknown error occurred';
    const firstLine = rawMessage.split('\n')[0];
    const cleanMessage = firstLine.length > 200 ? firstLine.slice(0, 200) + '...' : firstLine;
    const hasDetails = rawMessage.length > cleanMessage.length;

    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg font-medium mb-2">Unable to start check-in</p>
            <p className="text-sm text-muted-foreground text-center mb-4">
              {cleanMessage}
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
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen && !showReceipt} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Check-in Items
            </DialogTitle>
          </DialogHeader>

          {/* Late Warning Banner */}
          {lateInfo?.is_late && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">
                    Return is {lateInfo.late_days} day{lateInfo.late_days !== 1 ? 's' : ''} late
                  </p>
                  {lateInfo.late_fee_amount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Late fee: ${lateInfo.late_fee_amount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Accordion Sections */}
          <Accordion
            type="multiple"
            value={expandedSections}
            onValueChange={setExpandedSections}
            className="space-y-2"
          >
            {/* Items Section */}
            <AccordionItem value="items" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>Items to Return</span>
                  <Badge variant="secondary" className="ml-2">
                    {returningItems}/{totalItems}
                  </Badge>
                  {isPartialReturn && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                      Partial
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {items.map((item) =>
                    item.asset_id ? (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded border"
                      >
                        <Checkbox
                          checked={selectedItems.has(item.asset_id)}
                          onCheckedChange={(checked) =>
                            handleItemToggle(item.asset_id!, !!checked)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.asset_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.asset_internal_id}
                            {item.barcode && ` • ${item.barcode}`}
                          </p>
                        </div>
                        {item.category_name && (
                          <Badge variant="outline" className="shrink-0">
                            {item.category_name}
                          </Badge>
                        )}
                      </div>
                    ) : null
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Condition Section */}
            {conditionRequired && selectedItems.size > 0 && (
              <AccordionItem value="condition" className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Condition Assessment</span>
                    <Badge
                      variant={missingConditions.length > 0 ? 'destructive' : 'secondary'}
                      className="ml-2"
                    >
                      {conditionReports.size}/{selectedItems.size}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    {items
                      .filter((item) => item.asset_id && selectedItems.has(item.asset_id))
                      .map((item) => (
                        <ConditionRatingCard
                          key={item.asset_id}
                          assetId={item.asset_id!}
                          assetName={item.asset_name ?? 'Unknown'}
                          currentCondition={conditionReports.get(item.asset_id!)?.condition_grade}
                          hasDamage={conditionReports.get(item.asset_id!)?.has_damage}
                          onConditionChange={(condition, notes) =>
                            handleConditionChange(item.asset_id!, condition, notes)
                          }
                          onReportDamage={() =>
                            openDamageModal(item.asset_id!, item.asset_name ?? 'Unknown')
                          }
                        />
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Location & Notes Section */}
            <AccordionItem value="details" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Return Location & Notes</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label>Return Location</Label>
                  <Select value={returnLocationId} onValueChange={setReturnLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Use asset home location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                          {loc.is_default_home && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use each asset's home location
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Add any notes about this return..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Summary Section */}
            <AccordionItem value="summary" className="border rounded-lg">
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Summary</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items returning</span>
                    <span className="font-medium">{returningItems}</span>
                  </div>

                  {isPartialReturn && (
                    <div className="flex justify-between text-yellow-600">
                      <span>Items not returning</span>
                      <span className="font-medium">{totalItems - returningItems}</span>
                    </div>
                  )}

                  {lateInfo?.is_late && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-destructive">
                        <span>Days late</span>
                        <span className="font-medium">{lateInfo.late_days}</span>
                      </div>
                      {lateInfo.late_fee_amount > 0 && (
                        <div className="flex justify-between text-destructive">
                          <span>Late fee</span>
                          <span className="font-medium">
                            ${lateInfo.late_fee_amount.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {conditionRequired && missingConditions.length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded p-2 mt-2">
                      <p className="text-destructive text-xs">
                        Condition assessment required for {missingConditions.length} item
                        {missingConditions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Partial Return Warning */}
          {isPartialReturn && settings?.partial_return_policy === 'warn' && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-600">Partial Return</p>
                  <p className="text-sm text-muted-foreground">
                    {totalItems - returningItems} item{totalItems - returningItems !== 1 ? 's are' : ' is'} not being returned.
                    A separate checkout will remain active for these items.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {completeError && (() => {
            const rawMessage = completeError.message || 'An error occurred';
            const firstLine = rawMessage.split('\n')[0];
            const cleanMessage = firstLine.length > 200 ? firstLine.slice(0, 200) + '...' : firstLine;
            const hasDetails = rawMessage.length > cleanMessage.length;

            return (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive font-medium mb-1">Check-in failed</p>
                <p className="text-xs text-destructive/80 mb-2">{cleanMessage}</p>
                {hasDetails && (
                  <details>
                    <summary className="text-xs text-destructive/60 cursor-pointer hover:text-destructive/80">
                      Show technical details
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto bg-destructive/5 rounded p-2">
                      <pre className="text-xs text-destructive/70 whitespace-pre-wrap break-all">
                        {rawMessage}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            );
          })()}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!canComplete || (conditionRequired && missingConditions.length > 0)}
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Check-in
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Damage Report Modal */}
      {damageAssetId && (
        <DamageReportModal
          isOpen={!!damageAssetId}
          onClose={() => setDamageAssetId(null)}
          assetId={damageAssetId}
          assetName={damageAssetName}
          onSubmit={(tier, description, photos) =>
            handleDamageReport(damageAssetId, tier, description, photos)
          }
        />
      )}

      {/* Receipt Dialog */}
      {showReceipt && completedTransactionId && (
        <CheckinReceiptDialog
          isOpen={showReceipt}
          onClose={handleReceiptClose}
          orgId={orgId}
          transactionId={completedTransactionId}
        />
      )}
    </>
  );
}

export default CheckinDialog;
