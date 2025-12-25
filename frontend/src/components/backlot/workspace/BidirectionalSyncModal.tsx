/**
 * BidirectionalSyncModal - Modal for manual bidirectional sync between schedule and call sheet
 */
import React, { useState } from 'react';
import { RefreshCw, ArrowRight, ArrowLeft, AlertCircle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSyncStatus, useBidirectionalSync } from '@/hooks/backlot';
import { BidirectionalSyncRequest } from '@/types/backlot';

interface BidirectionalSyncModalProps {
  dayId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type SyncDirection = 'auto' | 'schedule_to_callsheet' | 'callsheet_to_schedule';

export function BidirectionalSyncModal({
  dayId,
  open,
  onOpenChange,
  onSuccess,
}: BidirectionalSyncModalProps) {
  const { syncStatus } = useSyncStatus(dayId);
  const { syncAsync, isLoading } = useBidirectionalSync(dayId);

  const [direction, setDirection] = useState<SyncDirection>('auto');
  const [syncDate, setSyncDate] = useState(true);
  const [syncTimes, setSyncTimes] = useState(true);
  const [syncLocation, setSyncLocation] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSync = async () => {
    setError(null);
    setSuccess(false);

    try {
      const request: BidirectionalSyncRequest = {
        sync_date: syncDate,
        sync_times: syncTimes,
        sync_location: syncLocation,
      };

      if (direction !== 'auto') {
        request.force_direction = direction;
      }

      await syncAsync(request);
      setSuccess(true);

      // Close after a brief delay to show success
      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    }
  };

  const getAutoDirectionLabel = () => {
    if (!syncStatus) return 'Loading...';
    if (syncStatus.is_in_sync) return 'Already in sync';
    if (syncStatus.stale_entity === 'call_sheet') {
      return 'Schedule is newer - will update Call Sheet';
    }
    return 'Call Sheet is newer - will update Schedule';
  };

  const hasFieldsToDiffer = syncStatus?.fields_differ && syncStatus.fields_differ.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Bidirectional Sync
          </DialogTitle>
          <DialogDescription>
            Sync data between the Production Day (Schedule) and its linked Call Sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Sync Direction */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sync Direction</Label>
            <RadioGroup
              value={direction}
              onValueChange={(v) => setDirection(v as SyncDirection)}
              className="space-y-2"
            >
              <div className="flex items-start space-x-3 rounded-md border border-border/50 p-3 hover:bg-muted/50">
                <RadioGroupItem value="auto" id="auto" className="mt-0.5" />
                <div className="flex-1">
                  <Label htmlFor="auto" className="cursor-pointer font-medium">
                    Auto (Most Recent Wins)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getAutoDirectionLabel()}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-md border border-border/50 p-3 hover:bg-muted/50">
                <RadioGroupItem value="schedule_to_callsheet" id="s2c" className="mt-0.5" />
                <div className="flex-1 flex items-center gap-2">
                  <Label htmlFor="s2c" className="cursor-pointer font-medium flex items-center gap-2">
                    Schedule
                    <ArrowRight className="h-4 w-4" />
                    Call Sheet
                  </Label>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-md border border-border/50 p-3 hover:bg-muted/50">
                <RadioGroupItem value="callsheet_to_schedule" id="c2s" className="mt-0.5" />
                <div className="flex-1 flex items-center gap-2">
                  <Label htmlFor="c2s" className="cursor-pointer font-medium flex items-center gap-2">
                    Call Sheet
                    <ArrowLeft className="h-4 w-4" />
                    Schedule
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Fields to Sync */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Fields to Sync</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-date"
                  checked={syncDate}
                  onCheckedChange={(checked) => setSyncDate(checked === true)}
                />
                <Label htmlFor="sync-date" className="cursor-pointer">
                  Date, Day Number & Title
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-times"
                  checked={syncTimes}
                  onCheckedChange={(checked) => setSyncTimes(checked === true)}
                />
                <Label htmlFor="sync-times" className="cursor-pointer">
                  Call Time & Wrap Time
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sync-location"
                  checked={syncLocation}
                  onCheckedChange={(checked) => setSyncLocation(checked === true)}
                />
                <Label htmlFor="sync-location" className="cursor-pointer">
                  Location Name & Address
                </Label>
              </div>
            </div>
          </div>

          {/* Differing fields info */}
          {hasFieldsToDiffer && (
            <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-200">
                <span className="font-medium">Fields that differ: </span>
                {syncStatus.fields_differ
                  .map((f) => {
                    switch (f) {
                      case 'date':
                        return 'Date';
                      case 'day_number':
                        return 'Day #';
                      case 'call_time':
                        return 'Call Time';
                      case 'wrap_time':
                        return 'Wrap Time';
                      case 'location_name':
                        return 'Location';
                      case 'location_address':
                        return 'Address';
                      case 'title':
                        return 'Title';
                      default:
                        return f;
                    }
                  })
                  .join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success */}
          {success && (
            <Alert className="bg-emerald-500/10 border-emerald-500/30">
              <Check className="h-4 w-4 text-emerald-400" />
              <AlertDescription className="text-emerald-200">
                Sync completed successfully!
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSync} disabled={isLoading || success}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
