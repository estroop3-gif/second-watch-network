/**
 * ShippingRateSelector
 * Display and select from available shipping rates
 */
import React from 'react';
import { Package, Truck, Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { ShippingRate, ShippingCarrier, FlatRateOptions } from '@/types/gear';

interface ShippingRateSelectorProps {
  rates: ShippingRate[];
  flatRates?: FlatRateOptions;
  selected: ShippingRate | null;
  onChange: (rate: ShippingRate) => void;
  loading?: boolean;
  error?: string | null;
  freeShippingThreshold?: number;
  orderTotal?: number;
  showFlatRates?: boolean;
  className?: string;
}

// Carrier logos/icons
const CARRIER_CONFIG: Record<ShippingCarrier, { label: string; color: string }> = {
  usps: { label: 'USPS', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  ups: { label: 'UPS', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  fedex: { label: 'FedEx', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  dhl: { label: 'DHL', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  other: { label: 'Other', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

// Convert flat rates to ShippingRate format
function flatRatesToShippingRates(flatRates: FlatRateOptions): ShippingRate[] {
  const rates: ShippingRate[] = [];

  if (flatRates.ground !== undefined) {
    rates.push({
      id: 'flat_ground',
      carrier: 'other',
      service: 'flat_ground',
      service_name: 'Standard Ground',
      rate: flatRates.ground,
      estimated_days: 5,
    });
  }

  if (flatRates.express !== undefined) {
    rates.push({
      id: 'flat_express',
      carrier: 'other',
      service: 'flat_express',
      service_name: 'Express',
      rate: flatRates.express,
      estimated_days: 3,
    });
  }

  if (flatRates.overnight !== undefined) {
    rates.push({
      id: 'flat_overnight',
      carrier: 'other',
      service: 'flat_overnight',
      service_name: 'Overnight',
      rate: flatRates.overnight,
      estimated_days: 1,
    });
  }

  return rates;
}

export function ShippingRateSelector({
  rates,
  flatRates,
  selected,
  onChange,
  loading = false,
  error = null,
  freeShippingThreshold,
  orderTotal = 0,
  showFlatRates = false,
  className,
}: ShippingRateSelectorProps) {
  // Check if order qualifies for free shipping
  const qualifiesForFreeShipping = freeShippingThreshold && orderTotal >= freeShippingThreshold;

  // Combine real-time rates with flat rates if both are available
  let allRates = [...rates];
  if (showFlatRates && flatRates) {
    const flatRateOptions = flatRatesToShippingRates(flatRates);
    allRates = [...allRates, ...flatRateOptions];
  }

  // Group rates by carrier
  const ratesByCarrier = allRates.reduce((acc, rate) => {
    const carrier = rate.carrier || 'other';
    if (!acc[carrier]) acc[carrier] = [];
    acc[carrier].push(rate);
    return acc;
  }, {} as Record<string, ShippingRate[]>);

  // Sort rates within each carrier by price
  Object.values(ratesByCarrier).forEach((carrierRates) => {
    carrierRates.sort((a, b) => a.rate - b.rate);
  });

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2 text-muted-gray">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Getting shipping rates...</span>
        </div>
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4 rounded-lg bg-red-500/10 border border-red-500/30', className)}>
        <div className="flex items-start gap-2 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Unable to get shipping rates</p>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (allRates.length === 0) {
    return (
      <div className={cn('text-center text-muted-gray py-8', className)}>
        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No shipping rates available.</p>
        <p className="text-sm mt-1">Please verify the shipping address.</p>
      </div>
    );
  }

  // Free shipping message
  const freeShippingMessage = freeShippingThreshold && !qualifiesForFreeShipping && (
    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm mb-4">
      Add ${(freeShippingThreshold - orderTotal).toFixed(2)} more for free shipping!
    </div>
  );

  return (
    <div className={cn('space-y-4', className)}>
      {qualifiesForFreeShipping && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Your order qualifies for free shipping!
        </div>
      )}

      {freeShippingMessage}

      {Object.entries(ratesByCarrier).map(([carrier, carrierRates]) => {
        const config = CARRIER_CONFIG[carrier as ShippingCarrier] || CARRIER_CONFIG.other;

        return (
          <div key={carrier} className="space-y-2">
            {/* Carrier header */}
            <div className="flex items-center gap-2">
              <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', config.color)}>
                {config.label}
              </span>
            </div>

            {/* Rates for this carrier */}
            <div className="space-y-2">
              {carrierRates.map((rate) => {
                const isSelected = selected?.id === rate.id;
                const displayRate = qualifiesForFreeShipping ? 0 : rate.rate;

                return (
                  <button
                    key={rate.id}
                    type="button"
                    onClick={() => onChange(rate)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all',
                      isSelected
                        ? 'bg-accent-yellow/10 border-accent-yellow/50'
                        : 'bg-charcoal-black/30 border-muted-gray/30 hover:border-muted-gray/50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left side - service info */}
                      <div className="flex items-center gap-3">
                        {/* Selection indicator */}
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                            isSelected
                              ? 'border-accent-yellow bg-accent-yellow'
                              : 'border-muted-gray/50'
                          )}
                        >
                          {isSelected && (
                            <div className="w-1.5 h-1.5 rounded-full bg-charcoal-black" />
                          )}
                        </div>

                        <div>
                          <p
                            className={cn(
                              'font-medium',
                              isSelected ? 'text-accent-yellow' : 'text-bone-white'
                            )}
                          >
                            {rate.service_name}
                          </p>
                          {rate.estimated_days !== undefined && (
                            <div className="flex items-center gap-1 text-xs text-muted-gray mt-0.5">
                              <Clock className="w-3 h-3" />
                              {rate.estimated_days === 1
                                ? 'Next day'
                                : rate.estimated_days <= 3
                                ? `${rate.estimated_days} business days`
                                : `${rate.estimated_days}-${rate.estimated_days + 2} business days`}
                              {rate.delivery_date && (
                                <span className="ml-1">
                                  (Est. {new Date(rate.delivery_date).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right side - price */}
                      <div className="text-right">
                        {qualifiesForFreeShipping ? (
                          <div>
                            <span className="text-green-400 font-semibold">FREE</span>
                            <span className="text-xs text-muted-gray line-through ml-2">
                              ${rate.rate.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={cn(
                              'font-semibold',
                              isSelected ? 'text-accent-yellow' : 'text-bone-white'
                            )}
                          >
                            ${displayRate.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ShippingRateSelector;
