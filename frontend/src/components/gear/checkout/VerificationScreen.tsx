/**
 * Verification Screen
 * Full-screen verification UI for checkout/check-in flows
 * Supports barcode scanning, manual check-off, and discrepancy reporting
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Check,
  AlertTriangle,
  Barcode,
  Package,
  Layers,
  Link,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Camera,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useGearScanLookup, useReportDamageAtCheckout } from '@/hooks/gear';
import { CameraScannerModal } from '@/components/gear/scanner';
import { DamageReportModal } from '@/components/gear/checkin/DamageReportModal';
import { DamageReportsSection, type DamageReportItem } from '@/components/gear/shared/DamageReportsSection';
import type { ScanResult } from '@/types/scanner';
import type {
  VerificationItem,
  VerificationDiscrepancy,
  VerifyMethod,
  DiscrepancyAction,
  KitVerificationMode,
  ItemVerificationStatus,
  CheckinDamageTier,
} from '@/types/gear';

// ============================================================================
// TYPES
// ============================================================================

interface VerificationItemWithStatus extends VerificationItem {
  verified_at?: string;
  verified_by?: string;
  method?: string;
}

interface VerificationScreenProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  verificationType: 'sender' | 'receiver' | 'checkin';
  items: VerificationItem[];
  verifyMethod: VerifyMethod;
  discrepancyAction: DiscrepancyAction;
  kitVerification: KitVerificationMode;
  packageVerification?: KitVerificationMode;  // Equipment package verification mode
  onVerifyItem: (itemId: string, method: 'scan' | 'checkoff') => Promise<void>;
  onReportDiscrepancy: (itemId: string, issueType: string, notes?: string) => Promise<void>;
  onComplete: () => Promise<void>;
  onAcknowledgeDiscrepancies?: () => Promise<void>;
  verifiedItems?: VerificationItemWithStatus[];
  discrepancies?: VerificationDiscrepancy[];
  discrepancyAcknowledged?: boolean;
  isLoading?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VerificationScreen({
  isOpen,
  onClose,
  orgId,
  verificationType,
  items,
  verifyMethod,
  discrepancyAction,
  kitVerification,
  packageVerification = 'package_only',
  onVerifyItem,
  onReportDiscrepancy,
  onComplete,
  onAcknowledgeDiscrepancies,
  verifiedItems = [],
  discrepancies = [],
  discrepancyAcknowledged = false,
  isLoading = false,
}: VerificationScreenProps) {
  // Scanner state
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const scannerRef = useRef<HTMLInputElement>(null);

  // Discrepancy dialog state
  const [discrepancyDialogOpen, setDiscrepancyDialogOpen] = useState(false);
  const [selectedItemForDiscrepancy, setSelectedItemForDiscrepancy] = useState<string | null>(null);
  const [discrepancyType, setDiscrepancyType] = useState<string>('missing');
  const [discrepancyNotes, setDiscrepancyNotes] = useState('');
  const [isReportingDiscrepancy, setIsReportingDiscrepancy] = useState(false);

  // Damage modal state (for detailed damage reporting with incident/repair tickets)
  const [damageModalOpen, setDamageModalOpen] = useState(false);
  const [damageAssetId, setDamageAssetId] = useState<string | null>(null);
  const [damageAssetName, setDamageAssetName] = useState<string>('');

  // Damage reports section state (dedicated visible section)
  const [damageReports, setDamageReports] = useState<DamageReportItem[]>([]);

  // Expanded kits state
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  // Expanded packages state
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());

  // Completion state
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Lookup hook
  const { lookupAsset } = useGearScanLookup(orgId);

  // Damage reporting mutation
  const reportDamageMutation = useReportDamageAtCheckout(orgId);

  // Calculate progress
  const verifiedIds = new Set(verifiedItems.map((v) => v.id));
  const discrepancyIds = new Set(discrepancies.map((d) => d.item_id));
  const totalItems = items.length;
  const verifiedCount = verifiedIds.size;
  const discrepancyCount = discrepancyIds.size;
  const accountedFor = verifiedCount + discrepancyCount;
  const progressPercentage = totalItems > 0 ? Math.round((accountedFor / totalItems) * 100) : 100;

  // Get item status
  const getItemStatus = (itemId: string): ItemVerificationStatus => {
    if (verifiedIds.has(itemId)) return 'verified';
    if (discrepancyIds.has(itemId)) return 'discrepancy';
    return 'pending';
  };

  // Focus scanner on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => scannerRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle barcode scan
  const handleScanSubmit = useCallback(async () => {
    if (!scanInput.trim() || isScanning) return;
    setScanError(null);
    setIsScanning(true);

    try {
      // Look up the scanned item
      const result = await lookupAsset.mutateAsync(scanInput.trim());
      const asset = result.asset;

      if (!asset) {
        setScanError(`No asset found: ${scanInput}`);
        setTimeout(() => setScanError(null), 3000);
        setScanInput('');
        setIsScanning(false);
        return;
      }

      // Check if this item is in our verification list
      const matchingItem = items.find(
        (item) =>
          item.id === asset.id ||
          item.internal_id === asset.internal_id ||
          item.internal_id === scanInput.trim()
      );

      if (!matchingItem) {
        setScanError(`Item "${asset.name}" not in verification list`);
        setTimeout(() => setScanError(null), 3000);
        setScanInput('');
        setIsScanning(false);
        return;
      }

      // Check if already verified
      if (verifiedIds.has(matchingItem.id)) {
        setScanError(`"${asset.name}" already verified`);
        setTimeout(() => setScanError(null), 3000);
        setScanInput('');
        setIsScanning(false);
        return;
      }

      // Verify the item
      await onVerifyItem(matchingItem.id, 'scan');
      setScanInput('');
    } catch (error) {
      console.error('Scan error:', error);
      setScanError(error instanceof Error ? error.message : 'Scan failed');
      setTimeout(() => setScanError(null), 3000);
    } finally {
      setIsScanning(false);
      scannerRef.current?.focus();
    }
  }, [scanInput, isScanning, lookupAsset, items, verifiedIds, onVerifyItem]);

  // Handle key press in scanner
  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanSubmit();
    }
  };

  // Handle camera scan result
  const handleCameraScan = useCallback(
    (result: ScanResult) => {
      setScanInput(result.code);
      setShowCameraScanner(false);
      // Trigger scan submit after short delay
      setTimeout(() => {
        handleScanSubmit();
      }, 100);
    },
    [handleScanSubmit]
  );

  // Handle manual check-off
  const handleCheckOff = async (itemId: string) => {
    if (verifyMethod === 'scan_only') return;
    try {
      await onVerifyItem(itemId, 'checkoff');
    } catch (error) {
      console.error('Check-off error:', error);
    }
  };

  // Open discrepancy dialog
  const openDiscrepancyDialog = (itemId: string) => {
    setSelectedItemForDiscrepancy(itemId);
    setDiscrepancyType('missing');
    setDiscrepancyNotes('');
    setDiscrepancyDialogOpen(true);
  };

  // Open damage modal for detailed damage reporting
  const openDamageModal = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    setDamageAssetId(itemId);
    setDamageAssetName(item?.name || 'Unknown Asset');
    setDamageModalOpen(true);
    setDiscrepancyDialogOpen(false);
  };

  // Handle damage report submission
  const handleDamageReport = async (
    assetId: string,
    tier: CheckinDamageTier,
    description: string,
    photoKeys: string[],
    createRepairTicket: boolean
  ) => {
    try {
      await reportDamageMutation.mutateAsync({
        asset_id: assetId,
        damage_tier: tier,
        description,
        photos: photoKeys,
        create_repair_ticket: createRepairTicket,
      });

      // Also report as discrepancy to mark the item
      await onReportDiscrepancy(assetId, 'damaged', `${tier} damage: ${description}`);

      setDamageModalOpen(false);
      setDamageAssetId(null);
      setDamageAssetName('');
    } catch (error) {
      console.error('Damage report error:', error);
      // Modal will handle showing the error state
      throw error;
    }
  };

  // Submit discrepancy report
  const handleSubmitDiscrepancy = async () => {
    if (!selectedItemForDiscrepancy) return;

    // If damaged, open the damage modal for detailed reporting
    if (discrepancyType === 'damaged') {
      openDamageModal(selectedItemForDiscrepancy);
      return;
    }

    setIsReportingDiscrepancy(true);

    try {
      await onReportDiscrepancy(selectedItemForDiscrepancy, discrepancyType, discrepancyNotes || undefined);
      setDiscrepancyDialogOpen(false);
    } catch (error) {
      console.error('Discrepancy report error:', error);
    } finally {
      setIsReportingDiscrepancy(false);
    }
  };

  // Handle adding a damage report from the dedicated section
  const handleAddDamageReport = async (
    assetId: string,
    assetName: string,
    tier: CheckinDamageTier,
    description: string,
    photoKeys: string[],
    createRepairTicket: boolean
  ) => {
    try {
      // Call the API to create incident + optional repair ticket
      await reportDamageMutation.mutateAsync({
        asset_id: assetId,
        damage_tier: tier,
        description,
        photos: photoKeys,
        create_repair_ticket: createRepairTicket,
      });

      // Add to local state for display
      const newReport: DamageReportItem = {
        id: `damage-${assetId}-${Date.now()}`,
        assetId,
        assetName,
        tier,
        description,
        photoKeys,
        createRepairTicket,
      };
      setDamageReports((prev) => [...prev, newReport]);

      // Also report as discrepancy to mark the item in verification
      await onReportDiscrepancy(assetId, 'damaged', `${tier} damage: ${description}`);
    } catch (error) {
      console.error('Damage report error:', error);
      throw error;
    }
  };

  // Handle removing a damage report
  const handleRemoveDamageReport = (assetId: string) => {
    setDamageReports((prev) => prev.filter((r) => r.assetId !== assetId));
    // Note: The incident is already created in the backend, this just removes from local display
  };

  // Toggle kit expansion
  const toggleKitExpansion = (kitId: string) => {
    setExpandedKits((prev) => {
      const next = new Set(prev);
      if (next.has(kitId)) {
        next.delete(kitId);
      } else {
        next.add(kitId);
      }
      return next;
    });
  };

  // Toggle package expansion
  const togglePackageExpansion = (packageId: string) => {
    setExpandedPackages((prev) => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  };

  // Handle complete verification
  const handleComplete = async () => {
    setIsCompleting(true);
    setCompletionError(null);

    try {
      await onComplete();
    } catch (error) {
      console.error('Completion error:', error);
      setCompletionError(error instanceof Error ? error.message : 'Failed to complete verification');
    } finally {
      setIsCompleting(false);
    }
  };

  // Check if can complete
  const hasUnacknowledgedDiscrepancies = discrepancies.length > 0 && !discrepancyAcknowledged;
  const hasUnverifiedItems = accountedFor < totalItems;
  const canComplete =
    !hasUnverifiedItems ||
    (hasUnacknowledgedDiscrepancies && discrepancyAction === 'warn') ||
    discrepancyAcknowledged;

  // Group items by kit and package
  const groupedItems = items.reduce(
    (acc, item) => {
      if (item.parent_kit_id) {
        if (!acc.kitContents[item.parent_kit_id]) {
          acc.kitContents[item.parent_kit_id] = [];
        }
        acc.kitContents[item.parent_kit_id].push(item);
      } else if (item.parent_package_id) {
        if (!acc.packageContents[item.parent_package_id]) {
          acc.packageContents[item.parent_package_id] = [];
        }
        acc.packageContents[item.parent_package_id].push(item);
      } else {
        acc.topLevel.push(item);
      }
      return acc;
    },
    {
      topLevel: [] as VerificationItem[],
      kitContents: {} as Record<string, VerificationItem[]>,
      packageContents: {} as Record<string, VerificationItem[]>,
    }
  );

  // Get title based on verification type
  const getTitle = () => {
    switch (verificationType) {
      case 'sender':
        return 'Verify Items for Checkout';
      case 'receiver':
        return 'Receiver Verification';
      case 'checkin':
        return 'Verify Returned Items';
      default:
        return 'Verify Items';
    }
  };

  // Render item row
  const renderItemRow = (item: VerificationItem, isKitContent = false) => {
    const status = getItemStatus(item.id);
    const discrepancy = discrepancies.find((d) => d.item_id === item.id);

    return (
      <div
        key={item.id}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
          isKitContent && 'ml-6 border-l-2 border-l-muted',
          status === 'verified' && 'bg-green-500/10 border-green-500/30',
          status === 'discrepancy' && 'bg-red-500/10 border-red-500/30',
          status === 'pending' && 'bg-background border-border'
        )}
      >
        {/* Status indicator / checkbox */}
        <div className="flex-shrink-0">
          {status === 'verified' ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : status === 'discrepancy' ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : verifyMethod === 'scan_or_checkoff' ? (
            <Checkbox
              checked={false}
              onCheckedChange={() => handleCheckOff(item.id)}
              className="h-5 w-5"
            />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          )}
        </div>

        {/* Item icon */}
        <div className="flex-shrink-0">
          {item.type === 'kit' ? (
            <Layers className="h-5 w-5 text-muted-foreground" />
          ) : item.is_package_parent ? (
            <Link className="h-5 w-5 text-accent-yellow" />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Item details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.name}</span>
            {item.type === 'kit' && (
              <Badge variant="outline" className="text-xs">
                Kit
              </Badge>
            )}
            {item.is_package_parent && (
              <Badge variant="outline" className="text-xs border-accent-yellow/50 text-accent-yellow">
                Equipment Package
              </Badge>
            )}
          </div>
          {item.internal_id && (
            <div className="text-sm text-muted-foreground">{item.internal_id}</div>
          )}
          {discrepancy && (
            <div className="text-sm text-red-500 mt-1">
              {discrepancy.issue_type}: {discrepancy.notes || 'No notes'}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {status === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openDiscrepancyDialog(item.id)}
              className="text-muted-foreground hover:text-red-500"
            >
              <AlertTriangle className="h-4 w-4" />
            </Button>
          )}

          {/* Kit expansion toggle */}
          {item.type === 'kit' && kitVerification === 'verify_contents' && groupedItems.kitContents[item.id] && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleKitExpansion(item.id)}
              className="text-muted-foreground"
            >
              {expandedKits.has(item.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Package expansion toggle */}
          {item.is_package_parent && packageVerification === 'verify_contents' && groupedItems.packageContents[item.id] && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => togglePackageExpansion(item.id)}
              className="text-muted-foreground"
            >
              {expandedPackages.has(item.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{getTitle()}</DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {verifiedCount} of {totalItems} verified
                {discrepancyCount > 0 && ` (${discrepancyCount} discrepancies)`}
              </span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </DialogHeader>

        {/* Scanner input */}
        <div className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <Barcode className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <Input
              ref={scannerRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder="Scan barcode or enter ID..."
              className="flex-1"
              disabled={isScanning}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowCameraScanner(true)}
                    disabled={isScanning}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Scan with camera</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button onClick={handleScanSubmit} disabled={!scanInput.trim() || isScanning}>
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
          {scanError && (
            <div className="flex items-center gap-2 mt-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              {scanError}
            </div>
          )}
        </div>

        {/* Items list */}
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-2">
            {groupedItems.topLevel.map((item) => (
              <React.Fragment key={item.id}>
                {renderItemRow(item)}
                {/* Render kit contents if expanded */}
                {item.type === 'kit' &&
                  kitVerification === 'verify_contents' &&
                  expandedKits.has(item.id) &&
                  groupedItems.kitContents[item.id]?.map((contentItem) => renderItemRow(contentItem, true))}
                {/* Render package contents if expanded */}
                {item.is_package_parent &&
                  packageVerification === 'verify_contents' &&
                  expandedPackages.has(item.id) &&
                  groupedItems.packageContents[item.id]?.map((contentItem) => renderItemRow(contentItem, true))}
              </React.Fragment>
            ))}
          </div>
        </ScrollArea>

        {/* Damage Reports Section */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t border-muted-gray/20 bg-charcoal-black/30">
            <DamageReportsSection
              orgId={orgId}
              items={items.map((item) => ({
                id: item.id,
                name: item.name,
                internal_id: item.internal_id,
              }))}
              reports={damageReports}
              onAddReport={handleAddDamageReport}
              onRemoveReport={handleRemoveDamageReport}
            />
          </div>
        )}

        {/* Footer */}
        <div className="p-6 pt-4 border-t space-y-4">
          {/* Warnings */}
          {hasUnacknowledgedDiscrepancies && (
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg',
                discrepancyAction === 'block' ? 'bg-red-500/10' : 'bg-yellow-500/10'
              )}
            >
              <AlertTriangle
                className={cn('h-5 w-5', discrepancyAction === 'block' ? 'text-red-500' : 'text-yellow-500')}
              />
              <div className="flex-1">
                <p className="font-medium">
                  {discrepancyAction === 'block'
                    ? 'Discrepancies must be acknowledged before completing'
                    : 'There are discrepancies reported'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {discrepancies.length} item{discrepancies.length !== 1 ? 's' : ''} have issues
                </p>
              </div>
              {onAcknowledgeDiscrepancies && (
                <Button variant="outline" size="sm" onClick={onAcknowledgeDiscrepancies}>
                  Acknowledge
                </Button>
              )}
            </div>
          )}

          {completionError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span>{completionError}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={
                isCompleting ||
                isLoading ||
                (discrepancyAction === 'block' && hasUnacknowledgedDiscrepancies)
              }
            >
              {isCompleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Complete Verification
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Discrepancy Dialog */}
      <Dialog open={discrepancyDialogOpen} onOpenChange={setDiscrepancyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report Discrepancy</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Issue Type</Label>
              <Select value={discrepancyType} onValueChange={setDiscrepancyType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="damaged">Damaged (opens detailed report)</SelectItem>
                  <SelectItem value="wrong_item">Wrong Item</SelectItem>
                  <SelectItem value="extra_item">Extra Item</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={discrepancyNotes}
                onChange={(e) => setDiscrepancyNotes(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscrepancyDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSubmitDiscrepancy} disabled={isReportingDiscrepancy}>
              {isReportingDiscrepancy ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reporting...
                </>
              ) : (
                'Report Issue'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
        title="Scan to Verify"
        scanMode="continuous"
        audioFeedback
        hapticFeedback
      />

      {/* Damage Report Modal */}
      {damageAssetId && (
        <DamageReportModal
          isOpen={damageModalOpen}
          onClose={() => {
            setDamageModalOpen(false);
            setDamageAssetId(null);
            setDamageAssetName('');
          }}
          assetId={damageAssetId}
          assetName={damageAssetName}
          orgId={orgId}
          onSubmit={handleDamageReport}
        />
      )}
    </Dialog>
  );
}
