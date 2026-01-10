/**
 * Damage Reports Section
 * A dedicated, visible section for reporting damage during checkout/check-in flows
 */
import React, { useState } from 'react';
import { AlertTriangle, Plus, Pencil, Trash2, Wrench, FileWarning, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

import { DamageReportModal } from '@/components/gear/checkin/DamageReportModal';
import type { CheckinDamageTier } from '@/types/gear';

// ============================================================================
// TYPES
// ============================================================================

export type IncidentReportedStage = 'checkout' | 'checkin' | 'work_order' | 'inventory';

export interface DamageReportItem {
  id: string;
  assetId: string;
  assetName: string;
  tier: CheckinDamageTier;
  description: string;
  photoKeys: string[];
  createRepairTicket: boolean;
  isExisting?: boolean; // True if this came from a previous incident (e.g., from checkout)
  reportedAt?: string; // When damage was reported
  reportedStage?: IncidentReportedStage; // Where damage was reported (checkout, checkin, work_order, inventory)
}

export interface SelectableItem {
  id: string;
  name: string;
  internal_id?: string;
}

interface DamageReportsSectionProps {
  orgId: string;
  items: SelectableItem[];
  reports: DamageReportItem[];
  onAddReport: (
    assetId: string,
    assetName: string,
    tier: CheckinDamageTier,
    description: string,
    photoKeys: string[],
    createRepairTicket: boolean
  ) => void;
  onRemoveReport: (assetId: string) => void;
  className?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const getTierColor = (tier: CheckinDamageTier) => {
  switch (tier) {
    case 'cosmetic':
      return 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/50';
    case 'functional':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    case 'unsafe':
      return 'bg-red-500/20 text-red-400 border-red-500/50';
    default:
      return 'bg-muted-gray/20 text-muted-gray border-muted-gray/50';
  }
};

const getTierLabel = (tier: CheckinDamageTier) => {
  switch (tier) {
    case 'cosmetic':
      return 'Cosmetic';
    case 'functional':
      return 'Functional';
    case 'unsafe':
      return 'Unsafe';
    default:
      return tier;
  }
};

const getStageLabel = (stage?: IncidentReportedStage) => {
  switch (stage) {
    case 'checkout':
      return 'Checkout';
    case 'checkin':
      return 'Check-in';
    case 'work_order':
      return 'Work Order';
    case 'inventory':
      return 'Inventory';
    default:
      return stage || 'Unknown';
  }
};

const getStageColor = (stage?: IncidentReportedStage) => {
  switch (stage) {
    case 'checkout':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'checkin':
      return 'bg-green-500/10 text-green-400 border-green-500/30';
    case 'work_order':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'inventory':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-muted-gray/10 text-muted-gray border-muted-gray/30';
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export function DamageReportsSection({
  orgId,
  items,
  reports,
  onAddReport,
  onRemoveReport,
  className,
}: DamageReportsSectionProps) {
  // Item selector dialog
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // Damage report modal
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageAssetId, setDamageAssetId] = useState<string>('');
  const [damageAssetName, setDamageAssetName] = useState<string>('');

  // Delete confirmation
  const [deleteConfirmAssetId, setDeleteConfirmAssetId] = useState<string | null>(null);

  // Filter out items that already have damage reports
  const reportedAssetIds = new Set(reports.map((r) => r.assetId));
  const availableItems = items.filter((item) => !reportedAssetIds.has(item.id));

  // Handle "Report Damage" button click
  const handleReportClick = () => {
    if (availableItems.length === 0) {
      // No more items to report
      return;
    }

    if (availableItems.length === 1) {
      // Only one item, go directly to damage modal
      const item = availableItems[0];
      setDamageAssetId(item.id);
      setDamageAssetName(item.name);
      setShowDamageModal(true);
    } else {
      // Multiple items, show selector
      setSelectedItemId('');
      setShowItemSelector(true);
    }
  };

  // Handle item selection from dropdown
  const handleItemSelect = () => {
    if (!selectedItemId) return;

    const item = items.find((i) => i.id === selectedItemId);
    if (item) {
      setDamageAssetId(item.id);
      setDamageAssetName(item.name);
      setShowItemSelector(false);
      setShowDamageModal(true);
    }
  };

  // Handle damage report submission
  const handleDamageSubmit = (
    tier: CheckinDamageTier,
    description: string,
    photoKeys: string[],
    createRepairTicket: boolean
  ) => {
    console.log('[DamageReportsSection] handleDamageSubmit called:', {
      damageAssetId,
      damageAssetName,
      tier,
      description,
      photoKeys: photoKeys.length,
      createRepairTicket,
    });

    if (!damageAssetId || !damageAssetName) {
      console.error('[DamageReportsSection] Missing assetId or assetName!');
      return;
    }

    onAddReport(damageAssetId, damageAssetName, tier, description, photoKeys, createRepairTicket);
    setShowDamageModal(false);
    setDamageAssetId('');
    setDamageAssetName('');
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (deleteConfirmAssetId) {
      onRemoveReport(deleteConfirmAssetId);
      setDeleteConfirmAssetId(null);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-medium text-bone-white">Damage Reports</h3>
          {reports.length > 0 && (
            <Badge variant="outline" className="text-xs border-red-500/50 text-red-400">
              {reports.length}
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleReportClick}
          disabled={availableItems.length === 0}
          className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Plus className="h-3 w-3 mr-1" />
          Report Damage
        </Button>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="text-center py-6 bg-charcoal-black/30 border border-muted-gray/20 rounded-lg">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-gray/50 mb-2" />
          <p className="text-sm text-muted-gray">No damage reported</p>
          <p className="text-xs text-muted-gray/70 mt-1">
            Click "Report Damage" to document any issues
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div
              key={report.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg",
                report.isExisting
                  ? "bg-blue-500/5 border border-blue-500/20"
                  : "bg-charcoal-black/30 border border-muted-gray/20"
              )}
            >
              {/* Tier Badge */}
              <Badge
                variant="outline"
                className={cn('shrink-0 text-xs', getTierColor(report.tier))}
              >
                {getTierLabel(report.tier)}
              </Badge>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-bone-white text-sm">{report.assetName}</p>
                  {report.isExisting && (
                    <Badge
                      variant="outline"
                      className="text-xs py-0 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/30"
                    >
                      From Checkout
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-gray truncate">{report.description}</p>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-gray/70">
                  {/* Timestamp and Stage */}
                  {report.reportedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(report.reportedAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  )}
                  {report.reportedStage && (
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] py-0 px-1.5', getStageColor(report.reportedStage))}
                    >
                      <MapPin className="h-2.5 w-2.5 mr-0.5" />
                      {getStageLabel(report.reportedStage)}
                    </Badge>
                  )}
                  {report.photoKeys.length > 0 && (
                    <span>{report.photoKeys.length} photo{report.photoKeys.length !== 1 ? 's' : ''}</span>
                  )}
                  {report.createRepairTicket && (
                    <span className="flex items-center gap-1 text-accent-yellow">
                      <Wrench className="h-3 w-3" />
                      Repair ticket
                    </span>
                  )}
                </div>
              </div>

              {/* Actions - only show delete for new reports, not existing ones */}
              {!report.isExisting && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-gray hover:text-red-400"
                    onClick={() => setDeleteConfirmAssetId(report.assetId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Item Selector Dialog */}
      <Dialog open={showItemSelector} onOpenChange={setShowItemSelector}>
        <DialogContent className="sm:max-w-md bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Select Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-gray">
              Which item are you reporting damage for?
            </p>
            <Select value={selectedItemId} onValueChange={setSelectedItemId}>
              <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
                <SelectValue placeholder="Select an item..." />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/30">
                {availableItems.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                    className="text-bone-white hover:bg-muted-gray/20"
                  >
                    {item.name}
                    {item.internal_id && (
                      <span className="text-muted-gray ml-2">({item.internal_id})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowItemSelector(false)}
              className="border-muted-gray/30 text-muted-gray"
            >
              Cancel
            </Button>
            <Button
              onClick={handleItemSelect}
              disabled={!selectedItemId}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Damage Report Modal */}
      {damageAssetId && (
        <DamageReportModal
          isOpen={showDamageModal}
          onClose={() => {
            setShowDamageModal(false);
            setDamageAssetId('');
            setDamageAssetName('');
          }}
          orgId={orgId}
          assetId={damageAssetId}
          assetName={damageAssetName}
          onSubmit={handleDamageSubmit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmAssetId}
        onOpenChange={(open) => !open && setDeleteConfirmAssetId(null)}
      >
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Remove Damage Report?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              This will remove the damage report. The incident has not been submitted yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-muted-gray/30 text-muted-gray hover:text-bone-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DamageReportsSection;
