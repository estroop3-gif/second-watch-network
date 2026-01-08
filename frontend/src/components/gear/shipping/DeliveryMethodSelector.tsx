/**
 * DeliveryMethodSelector
 * Radio group for selecting delivery method: Pickup, Local Delivery, or Shipping
 */
import React from 'react';
import { Home, Truck, Package, MapPin, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeliveryMethod, DeliveryOptions } from '@/types/gear';

interface DeliveryMethodSelectorProps {
  options: DeliveryOptions;
  selected: DeliveryMethod;
  onChange: (method: DeliveryMethod) => void;
  disabled?: boolean;
  className?: string;
}

export function DeliveryMethodSelector({
  options,
  selected,
  onChange,
  disabled = false,
  className,
}: DeliveryMethodSelectorProps) {
  const methods: {
    value: DeliveryMethod;
    label: string;
    description: string;
    icon: React.ReactNode;
    available: boolean;
    details?: React.ReactNode;
  }[] = [
    {
      value: 'pickup',
      label: 'Customer Pickup',
      description: 'Pick up at their location',
      icon: <Home className="w-5 h-5" />,
      available: options.allows_pickup,
      details: options.allows_pickup && options.pickup_address ? (
        <div className="mt-2 text-xs text-muted-gray space-y-1">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>{options.pickup_address}</span>
          </div>
          {options.pickup_hours && Object.keys(options.pickup_hours).length > 0 && (
            <div className="flex items-start gap-1.5">
              <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>See hours below</span>
            </div>
          )}
        </div>
      ) : undefined,
    },
    {
      value: 'local_delivery',
      label: 'Local Delivery',
      description: 'Delivered to your location',
      icon: <Truck className="w-5 h-5" />,
      available: options.local_delivery.enabled,
      details: options.local_delivery.enabled ? (
        <div className="mt-2 text-xs text-muted-gray">
          <span>Within {options.local_delivery.radius_miles} miles</span>
          {options.local_delivery.base_fee !== undefined && options.local_delivery.base_fee > 0 && (
            <span className="ml-2">
              Starting at ${options.local_delivery.base_fee.toFixed(2)}
              {options.local_delivery.per_mile_fee !== undefined && options.local_delivery.per_mile_fee > 0 && (
                <> + ${options.local_delivery.per_mile_fee.toFixed(2)}/mi</>
              )}
            </span>
          )}
        </div>
      ) : undefined,
    },
    {
      value: 'shipping',
      label: 'Carrier Shipping',
      description: 'Ship via FedEx, UPS, USPS',
      icon: <Package className="w-5 h-5" />,
      available: options.shipping.enabled,
      details: options.shipping.enabled ? (
        <div className="mt-2 text-xs text-muted-gray space-y-1">
          <div className="flex items-center gap-1 flex-wrap">
            {options.shipping.carriers.map((carrier) => (
              <span
                key={carrier}
                className="px-1.5 py-0.5 bg-white/5 rounded text-xs uppercase"
              >
                {carrier}
              </span>
            ))}
          </div>
          {options.shipping.free_threshold && (
            <div className="text-green-400">
              Free shipping on orders over ${options.shipping.free_threshold.toFixed(2)}
            </div>
          )}
        </div>
      ) : undefined,
    },
  ];

  const availableMethods = methods.filter((m) => m.available);

  if (availableMethods.length === 0) {
    return (
      <div className="text-center text-muted-gray py-8">
        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No delivery options available for this rental house.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {methods.map((method) => {
        const isSelected = selected === method.value;
        const isAvailable = method.available;

        return (
          <button
            key={method.value}
            type="button"
            onClick={() => isAvailable && !disabled && onChange(method.value)}
            disabled={disabled || !isAvailable}
            className={cn(
              'w-full text-left p-4 rounded-lg border transition-all',
              isAvailable
                ? isSelected
                  ? 'bg-accent-yellow/10 border-accent-yellow/50'
                  : 'bg-charcoal-black/30 border-muted-gray/30 hover:border-muted-gray/50'
                : 'bg-charcoal-black/10 border-muted-gray/20 opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Selection indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                  isSelected
                    ? 'border-accent-yellow bg-accent-yellow'
                    : isAvailable
                    ? 'border-muted-gray/50'
                    : 'border-muted-gray/30'
                )}
              >
                {isSelected && <CheckCircle2 className="w-3 h-3 text-charcoal-black" />}
              </div>

              {/* Icon */}
              <div
                className={cn(
                  'flex-shrink-0',
                  isSelected ? 'text-accent-yellow' : isAvailable ? 'text-bone-white' : 'text-muted-gray'
                )}
              >
                {method.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'font-medium',
                      isSelected ? 'text-accent-yellow' : isAvailable ? 'text-bone-white' : 'text-muted-gray'
                    )}
                  >
                    {method.label}
                  </span>
                  {!isAvailable && (
                    <span className="text-xs text-muted-gray">Not available</span>
                  )}
                </div>
                <p className="text-sm text-muted-gray mt-0.5">{method.description}</p>
                {method.details}
              </div>
            </div>
          </button>
        );
      })}

      {/* Pickup Hours Display */}
      {selected === 'pickup' && options.allows_pickup && options.pickup_hours && Object.keys(options.pickup_hours).length > 0 && (
        <div className="mt-4 p-4 rounded-lg bg-white/5">
          <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pickup Hours
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).map((day) => {
              const hours = options.pickup_hours?.[day];
              if (!hours) return null;
              return (
                <div key={day} className="flex justify-between gap-2">
                  <span className="text-muted-gray capitalize">{day}</span>
                  <span className="text-bone-white">{hours}</span>
                </div>
              );
            })}
          </div>
          {options.pickup_instructions && (
            <p className="mt-3 text-sm text-muted-gray border-t border-white/10 pt-3">
              {options.pickup_instructions}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default DeliveryMethodSelector;
