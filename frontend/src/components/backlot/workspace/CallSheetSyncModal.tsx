/**
 * CallSheetSyncModal - Sync call sheet data to production days, locations, and tasks
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Calendar,
  MapPin,
  CheckSquare,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useSyncCallSheet } from '@/hooks/backlot';
import { BacklotCallSheet, CallSheetSyncResponse } from '@/types/backlot';
import { useToast } from '@/hooks/use-toast';

interface CallSheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  callSheet: BacklotCallSheet;
}

const CallSheetSyncModal: React.FC<CallSheetSyncModalProps> = ({
  isOpen,
  onClose,
  callSheet,
}) => {
  const { toast } = useToast();
  const syncCallSheet = useSyncCallSheet();

  // Sync options
  const [syncProductionDay, setSyncProductionDay] = useState(true);
  const [syncLocations, setSyncLocations] = useState(true);
  const [syncTasks, setSyncTasks] = useState(true);

  // Result state
  const [syncResult, setSyncResult] = useState<CallSheetSyncResponse | null>(null);

  const handleSync = async () => {
    setSyncResult(null);

    try {
      const result = await syncCallSheet.mutateAsync({
        callSheetId: callSheet.id,
        request: {
          sync_production_day: syncProductionDay,
          sync_locations: syncLocations,
          sync_tasks: syncTasks,
        },
      });

      setSyncResult(result);

      toast({
        title: 'Sync Complete',
        description: result.message,
      });
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync call sheet data',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setSyncResult(null);
    onClose();
  };

  const atLeastOneSelected = syncProductionDay || syncLocations || syncTasks;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <RefreshCw className="w-5 h-5 text-accent-yellow" />
            Sync Call Sheet Data
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Sync data from this call sheet to other Backlot tools.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Production Day */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
            <Checkbox
              id="sync-production-day"
              checked={syncProductionDay}
              onCheckedChange={(checked) => setSyncProductionDay(!!checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="sync-production-day"
                className="flex items-center gap-2 text-bone-white cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-accent-yellow" />
                Production Day
              </Label>
              <p className="text-sm text-muted-gray mt-1">
                Create or update a production day with call sheet date, times, location, and weather info.
              </p>
            </div>
          </div>

          {/* Locations */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
            <Checkbox
              id="sync-locations"
              checked={syncLocations}
              onCheckedChange={(checked) => setSyncLocations(!!checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="sync-locations"
                className="flex items-center gap-2 text-bone-white cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-accent-yellow" />
                Locations
              </Label>
              <p className="text-sm text-muted-gray mt-1">
                Create master locations from call sheet locations and scene sets that don't already exist.
              </p>
            </div>
          </div>

          {/* Tasks */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
            <Checkbox
              id="sync-tasks"
              checked={syncTasks}
              onCheckedChange={(checked) => setSyncTasks(!!checked)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label
                htmlFor="sync-tasks"
                className="flex items-center gap-2 text-bone-white cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-accent-yellow" />
                Department Tasks
              </Label>
              <p className="text-sm text-muted-gray mt-1">
                Create tasks from department notes (Camera, Sound, G&E, Art, etc.) with the call sheet date as due date.
              </p>
            </div>
          </div>

          {/* Sync Results */}
          {syncResult && (
            <div className={`p-4 rounded-lg border ${
              syncResult.success
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {syncResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                )}
                <span className={`font-medium ${syncResult.success ? 'text-green-400' : 'text-red-400'}`}>
                  {syncResult.success ? 'Sync Complete' : 'Sync Failed'}
                </span>
              </div>
              <div className="text-sm text-muted-gray space-y-1">
                {syncResult.production_day_synced && (
                  <p>Production day synced</p>
                )}
                {syncResult.locations_created > 0 && (
                  <p>{syncResult.locations_created} location{syncResult.locations_created !== 1 ? 's' : ''} created</p>
                )}
                {syncResult.tasks_created > 0 && (
                  <p>{syncResult.tasks_created} task{syncResult.tasks_created !== 1 ? 's' : ''} created</p>
                )}
                {!syncResult.production_day_synced && syncResult.locations_created === 0 && syncResult.tasks_created === 0 && (
                  <p>No new data to sync - items may already exist</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-muted-gray/30"
          >
            {syncResult ? 'Done' : 'Cancel'}
          </Button>
          {!syncResult && (
            <Button
              onClick={handleSync}
              disabled={!atLeastOneSelected || syncCallSheet.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {syncCallSheet.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync Data
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallSheetSyncModal;
