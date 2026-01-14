/**
 * GearDetailDrawer - Side drawer for displaying comprehensive gear item details
 *
 * Shows all information about a gear item including rental orders, work orders,
 * pricing, organization contact, and available actions.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useEnrichedGearItem } from '@/hooks/backlot/useBacklotRentalGear';
import { Loader2, AlertCircle } from 'lucide-react';
import { GearDetailContent } from './GearDetailContent';

interface Props {
  gearId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (gearId: string) => void;
}

export function GearDetailDrawer({ gearId, isOpen, onClose, onEdit }: Props) {
  const { data, isLoading, error } = useEnrichedGearItem(gearId);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-charcoal-black border-l border-muted-gray/20">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-accent-yellow animate-spin mb-4" />
            <p className="text-muted-gray">Loading gear details...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-bone-white font-semibold mb-2">Failed to load gear details</p>
            <p className="text-muted-gray text-sm text-center">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
          </div>
        )}

        {data && (
          <GearDetailContent
            gear={data.gear}
            rentalOrder={data.rental_order}
            workOrder={data.work_order}
            organization={data.organization}
            marketplaceSettings={data.marketplace_settings}
            assignee={data.assignee}
            assignedDay={data.assigned_day}
            onEdit={() => onEdit?.(data.gear.id)}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
