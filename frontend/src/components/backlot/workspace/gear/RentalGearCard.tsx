/**
 * RentalGearCard Component
 *
 * Displays a rental gear item with:
 * - RENTAL badge
 * - Status progression indicator
 * - All rate information (daily/weekly/monthly)
 * - Rental house name
 * - Pickup/return dates
 * - Action buttons (View Order, Message Gear House)
 */
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, ExternalLink, AlertCircle, Calendar } from 'lucide-react';
import { BacklotGearItemEnriched } from '@/types/backlot';

interface RentalGearCardProps {
  item: BacklotGearItemEnriched;
  onViewOrder?: (orderId: string) => void;
  onMessage?: (orgId: string) => void;
  onClick?: (id: string) => void;
}

const STATUS_PROGRESSION = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'building', label: 'Building' },
  { key: 'ready_for_pickup', label: 'Ready' },
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'in_use', label: 'In Use' },
  { key: 'returned', label: 'Returned' },
];

export function RentalGearCard({ item, onViewOrder, onMessage, onClick }: RentalGearCardProps) {
  const rentalOrder = item.rental_order;

  // Find current status index
  const currentStatusIndex = rentalOrder
    ? STATUS_PROGRESSION.findIndex(s => s.key === rentalOrder.status)
    : -1;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on buttons
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    // Open detail drawer
    if (onClick) {
      onClick(item.id);
    }
  };

  return (
    <Card
      className="p-4 bg-charcoal-black border-muted-gray hover:border-primary-red/50 transition-colors cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header with name and RENTAL badge */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-bone-white mb-1">
            {item.name}
          </h3>
          {item.category && (
            <p className="text-sm text-muted-gray">{item.category}</p>
          )}
          {item.description && (
            <p className="text-xs text-muted-gray mt-1">{item.description}</p>
          )}
        </div>
        <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/50 ml-2">
          RENTAL
        </Badge>
      </div>

      {/* Rental Order Details */}
      {rentalOrder && (
        <div className="bg-charcoal-black/80 rounded-lg p-3 mb-3 border border-muted-gray/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-muted-gray">
              Order #{rentalOrder.order_number}
            </span>
            <Badge
              variant="outline"
              className={
                rentalOrder.status === 'returned'
                  ? 'bg-green-500/10 text-green-500 border-green-500/50'
                  : rentalOrder.status === 'cancelled'
                  ? 'bg-red-500/10 text-red-500 border-red-500/50'
                  : 'bg-blue-500/10 text-blue-500 border-blue-500/50'
              }
            >
              {rentalOrder.status.replace(/_/g, ' ').toUpperCase()}
            </Badge>
          </div>

          {/* Status progression bar */}
          <div className="flex items-center gap-1 mb-3">
            {STATUS_PROGRESSION.map((status, idx) => (
              <div key={status.key} className="flex items-center flex-1">
                <div
                  className={`h-2 flex-1 rounded-full transition-colors ${
                    idx <= currentStatusIndex
                      ? 'bg-blue-500'
                      : 'bg-muted-gray/30'
                  }`}
                  title={status.label}
                />
                {idx < STATUS_PROGRESSION.length - 1 && (
                  <div className="w-1" />
                )}
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 text-xs text-muted-gray">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Pickup: {new Date(rentalOrder.rental_start_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>Return: {new Date(rentalOrder.rental_end_date).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rate Information - CRITICAL: Display all rates */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-gray">Daily Rate:</span>
          <span className="text-bone-white font-semibold">
            ${item.rental_cost_per_day?.toLocaleString() || '0'}/day
          </span>
        </div>
        {item.rental_weekly_rate && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-gray">Weekly Rate:</span>
            <span className="text-bone-white">
              ${item.rental_weekly_rate.toLocaleString()}/week
            </span>
          </div>
        )}
        {item.rental_monthly_rate && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-gray">Monthly Rate:</span>
            <span className="text-bone-white">
              ${item.rental_monthly_rate.toLocaleString()}/month
            </span>
          </div>
        )}
      </div>

      {/* Rental House */}
      <div className="mb-3">
        <p className="text-sm text-muted-gray">
          <span className="font-medium">Rental House:</span>{' '}
          {item.rental_house || rentalOrder?.rental_house_name || 'Unknown'}
        </p>
      </div>

      {/* Serial Number (if available) */}
      {item.serial_number && (
        <div className="mb-3 text-xs">
          <span className="text-muted-gray">Serial:</span>{' '}
          <span className="text-bone-white font-mono">{item.serial_number}</span>
        </div>
      )}

      {/* Notes */}
      {item.notes && (
        <div className="mb-3 p-2 bg-muted-gray/10 rounded text-xs text-muted-gray">
          {item.notes}
        </div>
      )}

      {/* Work Order Status (if applicable) */}
      {item.work_order && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <span className="text-muted-gray">
            Work Order: <span className="text-bone-white">{item.work_order.status}</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {rentalOrder && onViewOrder && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewOrder(rentalOrder.id)}
            className="flex-1"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View Order
          </Button>
        )}
        {rentalOrder && onMessage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMessage(rentalOrder.rental_house_org_id)}
            className="flex-1"
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            Message
          </Button>
        )}
      </div>
    </Card>
  );
}
