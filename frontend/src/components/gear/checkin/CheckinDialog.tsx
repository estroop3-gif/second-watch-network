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

  // Initialize with empty selection - user must manually check items to return
  useEffect(() => {
    if (checkinData?.transaction?.items) {
      // Start with all items unchecked - user selects what they're returning
      setSelectedItems(new Set());
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
          damage_photo_keys: existing?.damage_photo_keys,
          notes,
        });
        return next;
      });
    },
    []
  );

  const handleDamageReport = useCallback(
    (assetId: string, tier: CheckinDamageTier, description: string, photoKeys: string[]) => {
      setConditionReports((prev) => {
        const next = new Map(prev);
        const existing = next.get(assetId);
        next.set(assetId, {
          asset_id: assetId,
          condition_grade: existing?.condition_grade ?? 'poor',
          has_damage: true,
          damage_tier: tier,
          damage_description: description,
          damage_photo_keys: photoKeys,
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
        <DialogContent className="sm:max-w-2xl bg-charcoal-black border-muted-gray/30">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-gray mb-4" />
            <p className="text-muted-gray">Loading check-in details...</p>
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
        <DialogContent className="sm:max-w-md bg-charcoal-black border-muted-gray/30">
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-lg font-medium text-bone-white mb-2">Unable to start check-in</p>
            <p className="text-sm text-muted-gray text-center mb-4">
              {cleanMessage}
            </p>
            {hasDetails && (
              <details className="w-full mb-4">
                <summary className="text-xs text-muted-gray cursor-pointer hover:text-bone-white">
                  Show technical details
                </summary>
                <div className="mt-2 max-h-40 overflow-y-auto bg-charcoal-black/50 rounded p-2 border border-muted-gray/20">
                  <pre className="text-xs text-muted-gray whitespace-pre-wrap break-all">
                    {rawMessage}
                  </pre>
                </div>
              </details>
            )}
            <Button variant="outline" onClick={handleClose} className="border-muted-gray/30">
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <Package className="h-5 w-5 text-accent-yellow" />
              Check-in Items
            </DialogTitle>
          </DialogHeader>

          {/* Late Warning Banner */}
          {lateInfo?.is_late && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-400">
                    Return is {lateInfo.late_days} day{lateInfo.late_days !== 1 ? 's' : ''} late
                  </p>
                  {lateInfo.late_fee_amount > 0 && (
                    <p className="text-sm text-muted-gray">
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
            <AccordionItem value="items" className="border border-muted-gray/30 rounded-lg bg-charcoal-black/50">
              <AccordionTrigger className="px-4 hover:no-underline text-bone-white">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-accent-yellow" />
                  <span>Items to Return</span>
                  <Badge variant="secondary" className="ml-2 bg-muted-gray/20 text-bone-white">
                    {returningItems}/{totalItems}
                  </Badge>
                  {isPartialReturn && (
                    <Badge variant="outline" className="border-accent-yellow/50 text-accent-yellow">
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
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                          selectedItems.has(item.asset_id)
                            ? "bg-green-500/10 border-green-500/30"
                            : "bg-charcoal-black/30 border-muted-gray/20 hover:border-muted-gray/40"
                        )}
                      >
                        <Checkbox
                          checked={selectedItems.has(item.asset_id)}
                          onCheckedChange={(checked) =>
                            handleItemToggle(item.asset_id!, !!checked)
                          }
                          className="border-muted-gray/50 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-bone-white">{item.asset_name}</p>
                          <p className="text-sm text-muted-gray">
                            {item.asset_internal_id}
                            {item.barcode && ` • ${item.barcode}`}
                          </p>
                        </div>
                        {item.category_name && (
                          <Badge variant="outline" className="shrink-0 border-muted-gray/30 text-muted-gray">
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
              <AccordionItem value="condition" className="border border-muted-gray/30 rounded-lg bg-charcoal-black/50">
                <AccordionTrigger className="px-4 hover:no-underline text-bone-white">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span>Condition Assessment</span>
                    <Badge
                      className={cn(
                        "ml-2",
                        missingConditions.length > 0
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : "bg-muted-gray/20 text-bone-white"
                      )}
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
            <AccordionItem value="details" className="border border-muted-gray/30 rounded-lg bg-charcoal-black/50">
              <AccordionTrigger className="px-4 hover:no-underline text-bone-white">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-400" />
                  <span>Return Location & Notes</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-bone-white">Return Location</Label>
                  <Select value={returnLocationId} onValueChange={setReturnLocationId}>
                    <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
                      <SelectValue placeholder="Use asset home location" />
                    </SelectTrigger>
                    <SelectContent className="bg-charcoal-black border-muted-gray/30">
                      {locations?.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id} className="text-bone-white hover:bg-muted-gray/20">
                          {loc.name}
                          {loc.is_default_home && ' (Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-gray">
                    Leave empty to use each asset's home location
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-bone-white">Notes</Label>
                  <Textarea
                    placeholder="Add any notes about this return..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray/50"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Summary Section */}
            <AccordionItem value="summary" className="border border-muted-gray/30 rounded-lg bg-charcoal-black/50">
              <AccordionTrigger className="px-4 hover:no-underline text-bone-white">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-purple-400" />
                  <span>Summary</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Items returning</span>
                    <span className="font-medium text-bone-white">{returningItems}</span>
                  </div>

                  {isPartialReturn && (
                    <>
                      <div className="flex justify-between text-red-400">
                        <span>Items not returning (will be marked MISSING)</span>
                        <span className="font-medium">{totalItems - returningItems}</span>
                      </div>
                      <p className="text-xs text-red-400/80">
                        Unchecked items will create missing item incidents
                      </p>
                    </>
                  )}

                  {/* Damage reports count */}
                  {Array.from(conditionReports.values()).filter(r => r.has_damage).length > 0 && (
                    <>
                      <Separator className="bg-muted-gray/20" />
                      <div className="flex justify-between text-orange-400">
                        <span>Damage reports</span>
                        <span className="font-medium">
                          {Array.from(conditionReports.values()).filter(r => r.has_damage).length}
                        </span>
                      </div>
                      <p className="text-xs text-muted-gray">
                        Incidents will be created for reported damage
                      </p>
                    </>
                  )}

                  {lateInfo?.is_late && (
                    <>
                      <Separator className="bg-muted-gray/20" />
                      <div className="flex justify-between text-orange-400">
                        <span>Days late</span>
                        <span className="font-medium">{lateInfo.late_days}</span>
                      </div>
                      {lateInfo.late_fee_amount > 0 && (
                        <div className="flex justify-between text-orange-400">
                          <span>Late fee</span>
                          <span className="font-medium">
                            ${lateInfo.late_fee_amount.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {conditionRequired && missingConditions.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded p-2 mt-2">
                      <p className="text-red-400 text-xs">
                        Condition assessment required for {missingConditions.length} item
                        {missingConditions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Missing Items Warning */}
          {isPartialReturn && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">Missing Items Warning</p>
                  <p className="text-sm text-muted-gray">
                    {totalItems - returningItems} item{totalItems - returningItems !== 1 ? 's are' : ' is'} not checked.
                    These will be marked as <span className="text-red-400 font-medium">MISSING</span> and incident reports will be created automatically.
                  </p>
                  <p className="text-xs text-muted-gray mt-1">
                    The renter/custodian will be logged as the responsible party.
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
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400 font-medium mb-1">Check-in failed</p>
                <p className="text-xs text-red-400/80 mb-2">{cleanMessage}</p>
                {hasDetails && (
                  <details>
                    <summary className="text-xs text-red-400/60 cursor-pointer hover:text-red-400/80">
                      Show technical details
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto bg-red-500/5 rounded p-2 border border-red-500/20">
                      <pre className="text-xs text-red-400/70 whitespace-pre-wrap break-all">
                        {rawMessage}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            );
          })()}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-muted-gray/20">
            <Button variant="outline" onClick={handleClose} className="border-muted-gray/30 text-muted-gray hover:text-bone-white">
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={!canComplete || (conditionRequired && missingConditions.length > 0)}
              className="bg-green-600 hover:bg-green-700 text-white"
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
          orgId={orgId}
          assetId={damageAssetId}
          assetName={damageAssetName}
          onSubmit={(tier, description, photoKeys) =>
            handleDamageReport(damageAssetId, tier, description, photoKeys)
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
