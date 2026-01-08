/**
 * RequestQuoteDialog.tsx
 * Dialog for requesting a quote from rental house(s)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Calendar,
  Trash2,
  Store,
  MapPin,
  Loader2,
  Send,
  AlertCircle,
  FolderOpen,
  Truck,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

import { useCreateRentalRequest, useDeliveryOptions, useShippingRates } from '@/hooks/gear/useGearMarketplace';
import { DeliveryMethodSelector } from '@/components/gear/shipping/DeliveryMethodSelector';
import { ShippingRateSelector } from '@/components/gear/shipping/ShippingRateSelector';
import type { GearMarketplaceListing, DeliveryMethod, ShippingRate, ShippingAddress, DeliveryOptions } from '@/types/gear';

interface RequestQuoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: GearMarketplaceListing[];
  orgId?: string; // Optional - community users may rent as individuals
  backlotProjectId?: string;
  onRemoveItem: (listingId: string) => void;
  onSubmitted: () => void;
}

// Steps in the quote request flow
type Step = 'items' | 'delivery' | 'review';

export function RequestQuoteDialog({
  isOpen,
  onClose,
  items,
  orgId,
  backlotProjectId,
  onRemoveItem,
  onSubmitted,
}: RequestQuoteDialogProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('items');

  // Form state
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return format(tomorrow, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    const nextWeek = addDays(new Date(), 8);
    return format(nextWeek, 'yyyy-MM-dd');
  });
  const [notes, setNotes] = useState('');
  const [autoCreateBudgetLine, setAutoCreateBudgetLine] = useState(false);

  // Delivery state
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Shipping state (for carrier shipping)
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    name: '',
    street1: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  });
  const [selectedShippingRate, setSelectedShippingRate] = useState<ShippingRate | null>(null);

  const { mutate: createRequest, isPending } = useCreateRentalRequest();

  // Get the primary rental house org ID (first one if multiple)
  const primaryRentalHouseId = useMemo(() => {
    if (items.length === 0) return null;
    return items[0]?.organization?.id || null;
  }, [items]);

  // Fetch delivery options for the rental house
  const { data: deliveryOptions, isLoading: isLoadingDeliveryOptions } = useDeliveryOptions(primaryRentalHouseId);

  // Shipping rates mutation
  const { mutate: fetchShippingRates, data: shippingRatesData, isPending: isLoadingRates, error: ratesError } = useShippingRates();

  // Default delivery options if not loaded
  const effectiveDeliveryOptions: DeliveryOptions = deliveryOptions || {
    allows_pickup: true,
    pickup_address: undefined,
    pickup_hours: undefined,
    pickup_instructions: undefined,
    local_delivery: { enabled: false },
    shipping: { enabled: false, carriers: [], pricing_mode: 'real_time' },
  };

  // Auto-select first available delivery method when options load
  useEffect(() => {
    if (deliveryOptions) {
      if (deliveryOptions.allows_pickup) {
        setDeliveryMethod('pickup');
      } else if (deliveryOptions.local_delivery.enabled) {
        setDeliveryMethod('local_delivery');
      } else if (deliveryOptions.shipping.enabled) {
        setDeliveryMethod('shipping');
      }
    }
  }, [deliveryOptions]);

  // Fetch shipping rates when shipping address is complete
  const canFetchRates =
    deliveryMethod === 'shipping' &&
    primaryRentalHouseId &&
    shippingAddress.name &&
    shippingAddress.street1 &&
    shippingAddress.city &&
    shippingAddress.state &&
    shippingAddress.zip;

  const handleFetchRates = () => {
    if (!canFetchRates || !primaryRentalHouseId) return;
    fetchShippingRates({
      from_org_id: primaryRentalHouseId,
      to_address: shippingAddress,
      item_ids: items.map((item) => item.id),
      carriers: effectiveDeliveryOptions.shipping.carriers,
    });
  };

  // Reset step when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('items');
    }
  }, [isOpen]);

  // Group items by rental house
  const itemsByOrg = useMemo(() => {
    const groups: Record<
      string,
      {
        org: GearMarketplaceListing['organization'];
        items: GearMarketplaceListing[];
      }
    > = {};

    items.forEach((item) => {
      const orgId = item.organization?.id || 'unknown';
      if (!groups[orgId]) {
        groups[orgId] = {
          org: item.organization,
          items: [],
        };
      }
      groups[orgId].items.push(item);
    });

    return groups;
  }, [items]);

  // Calculate rental days
  const rentalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const days = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
    return Math.max(0, days);
  }, [startDate, endDate]);

  // Estimate total (using daily rates)
  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const dailyRate = item.daily_rate || 0;
      return sum + dailyRate * rentalDays;
    }, 0);
  }, [items, rentalDays]);

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Validate form per step
  const canProceedToDelivery =
    title.trim() &&
    startDate &&
    endDate &&
    rentalDays > 0 &&
    items.length > 0;

  const canProceedToReview = () => {
    if (!canProceedToDelivery) return false;

    if (deliveryMethod === 'pickup') {
      return true;
    } else if (deliveryMethod === 'local_delivery') {
      return !!deliveryAddress.trim();
    } else if (deliveryMethod === 'shipping') {
      return (
        shippingAddress.name &&
        shippingAddress.street1 &&
        shippingAddress.city &&
        shippingAddress.state &&
        shippingAddress.zip &&
        selectedShippingRate !== null
      );
    }
    return false;
  };

  const canSubmit = canProceedToReview();

  // Estimated shipping cost
  const shippingCost = deliveryMethod === 'shipping' && selectedShippingRate ? selectedShippingRate.rate : 0;

  // Total with shipping
  const totalWithShipping = estimatedTotal + shippingCost;

  const handleSubmit = () => {
    if (!canSubmit) return;

    // Create requests for each rental house
    const rentalHouseIds = Object.keys(itemsByOrg);

    // Build delivery/shipping data based on method
    let deliveryData: {
      delivery_method: DeliveryMethod;
      delivery_address?: string;
      delivery_notes?: string;
      shipping_address?: ShippingAddress;
      preferred_carrier?: string;
      preferred_service?: string;
    } = {
      delivery_method: deliveryMethod,
    };

    if (deliveryMethod === 'local_delivery') {
      deliveryData.delivery_address = deliveryAddress;
      deliveryData.delivery_notes = deliveryNotes;
    } else if (deliveryMethod === 'shipping' && selectedShippingRate) {
      deliveryData.shipping_address = shippingAddress;
      deliveryData.preferred_carrier = selectedShippingRate.carrier;
      deliveryData.preferred_service = selectedShippingRate.service;
    }

    // For now, we'll create a single request with all items
    createRequest(
      {
        requesting_org_id: orgId,
        rental_house_org_id: rentalHouseIds[0], // Primary rental house
        backlot_project_id: backlotProjectId,
        auto_create_budget_line: autoCreateBudgetLine,
        title,
        rental_start_date: startDate,
        rental_end_date: endDate,
        notes,
        ...deliveryData,
        items: items.map((item) => ({
          listing_id: item.id,
          asset_id: item.asset_id,
          quantity: 1,
        })),
      },
      {
        onSuccess: () => {
          onSubmitted();
        },
      }
    );
  };

  // Step navigation
  const goToNextStep = () => {
    if (currentStep === 'items' && canProceedToDelivery) {
      setCurrentStep('delivery');
    } else if (currentStep === 'delivery' && canProceedToReview()) {
      setCurrentStep('review');
    }
  };

  const goToPreviousStep = () => {
    if (currentStep === 'delivery') {
      setCurrentStep('items');
    } else if (currentStep === 'review') {
      setCurrentStep('delivery');
    }
  };

  // Step titles
  const stepTitles: Record<Step, string> = {
    items: 'Request Details',
    delivery: 'Delivery Method',
    review: 'Review & Submit',
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {stepTitles[currentStep]}
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 pt-2">
            {(['items', 'delivery', 'review'] as Step[]).map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    currentStep === step
                      ? 'bg-accent-yellow text-charcoal-black'
                      : index < ['items', 'delivery', 'review'].indexOf(currentStep)
                      ? 'bg-green-500 text-white'
                      : 'bg-muted-gray/30 text-muted-gray'
                  }`}
                >
                  {index + 1}
                </div>
                {index < 2 && (
                  <div
                    className={`mx-2 h-0.5 w-8 ${
                      index < ['items', 'delivery', 'review'].indexOf(currentStep)
                        ? 'bg-green-500'
                        : 'bg-muted-gray/30'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* STEP 1: Items & Request Details */}
          {currentStep === 'items' && (
            <>
              {/* Items Summary */}
              <div className="space-y-3">
                <Label>Items ({items.length})</Label>
                {Object.entries(itemsByOrg).map(([itemOrgId, group]) => (
                  <div
                    key={itemOrgId}
                    className="rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-gray">
                      <Store className="h-4 w-4" />
                      {group.org?.marketplace_name || group.org?.name || 'Unknown'}
                      {group.org?.marketplace_location && (
                        <>
                          <span className="text-white/30">|</span>
                          <MapPin className="h-3 w-3" />
                          {group.org.marketplace_location}
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded bg-white/5 p-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded bg-white/10">
                              {item.asset?.photo_urls?.[0] || item.asset?.image_url ? (
                                <img
                                  src={item.asset?.photo_urls?.[0] || item.asset?.image_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="h-5 w-5 text-muted-gray" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-bone-white">
                                {item.asset?.name}
                              </p>
                              <p className="text-xs text-muted-gray">
                                {formatPrice(item.daily_rate)}/day
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-gray hover:text-primary-red"
                            onClick={() => onRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="bg-white/10" />

              {/* Request Details */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Request Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Camera Package for Commercial Shoot"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Rental Start Date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Rental End Date *</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                    />
                  </div>
                </div>

                {rentalDays > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-gray" />
                      <span className="text-muted-gray">Duration:</span>
                      <span className="font-medium text-bone-white">
                        {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-muted-gray">Estimated Total: </span>
                      <span className="text-lg font-semibold text-bone-white">
                        {formatPrice(estimatedTotal)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes for Rental House</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any special requirements, pickup time preferences, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </>
          )}

          {/* STEP 2: Delivery Method */}
          {currentStep === 'delivery' && (
            <>
              <div className="space-y-4">
                <div>
                  <h4 className="flex items-center gap-2 font-medium text-bone-white mb-4">
                    <Truck className="h-4 w-4" />
                    How would you like to receive the gear?
                  </h4>

                  {isLoadingDeliveryOptions ? (
                    <div className="flex items-center gap-2 text-muted-gray py-8 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading delivery options...
                    </div>
                  ) : (
                    <DeliveryMethodSelector
                      options={effectiveDeliveryOptions}
                      selected={deliveryMethod}
                      onChange={setDeliveryMethod}
                    />
                  )}
                </div>

                {/* Local Delivery Address */}
                {deliveryMethod === 'local_delivery' && (
                  <div className="space-y-4 mt-4 p-4 rounded-lg bg-white/5">
                    <h5 className="font-medium text-bone-white">Delivery Address</h5>
                    <div className="space-y-2">
                      <Label htmlFor="deliveryAddress">Address *</Label>
                      <Input
                        id="deliveryAddress"
                        placeholder="123 Main St, Los Angeles, CA 90001"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deliveryNotes">Delivery Notes</Label>
                      <Input
                        id="deliveryNotes"
                        placeholder="e.g., Call ahead, loading dock available"
                        value={deliveryNotes}
                        onChange={(e) => setDeliveryNotes(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Shipping Address & Rate Selection */}
                {deliveryMethod === 'shipping' && (
                  <div className="space-y-4 mt-4">
                    {/* Shipping Address Form */}
                    <div className="p-4 rounded-lg bg-white/5 space-y-4">
                      <h5 className="font-medium text-bone-white">Shipping Address</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input
                            value={shippingAddress.name}
                            placeholder="John Smith"
                            onChange={(e) =>
                              setShippingAddress((prev) => ({ ...prev, name: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Company</Label>
                          <Input
                            value={shippingAddress.company || ''}
                            placeholder="Optional"
                            onChange={(e) =>
                              setShippingAddress((prev) => ({ ...prev, company: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Street Address *</Label>
                        <Input
                          value={shippingAddress.street1}
                          placeholder="123 Main Street"
                          onChange={(e) =>
                            setShippingAddress((prev) => ({ ...prev, street1: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Suite/Unit</Label>
                        <Input
                          value={shippingAddress.street2 || ''}
                          placeholder="Suite 100"
                          onChange={(e) =>
                            setShippingAddress((prev) => ({ ...prev, street2: e.target.value }))
                          }
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>City *</Label>
                          <Input
                            value={shippingAddress.city}
                            placeholder="Los Angeles"
                            onChange={(e) =>
                              setShippingAddress((prev) => ({ ...prev, city: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>State *</Label>
                          <Input
                            value={shippingAddress.state}
                            placeholder="CA"
                            maxLength={2}
                            onChange={(e) =>
                              setShippingAddress((prev) => ({
                                ...prev,
                                state: e.target.value.toUpperCase(),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>ZIP *</Label>
                          <Input
                            value={shippingAddress.zip}
                            placeholder="90001"
                            onChange={(e) =>
                              setShippingAddress((prev) => ({ ...prev, zip: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input
                          value={shippingAddress.phone || ''}
                          placeholder="(555) 123-4567"
                          onChange={(e) =>
                            setShippingAddress((prev) => ({ ...prev, phone: e.target.value }))
                          }
                        />
                      </div>
                      <Button
                        onClick={handleFetchRates}
                        disabled={!canFetchRates || isLoadingRates}
                        className="w-full"
                      >
                        {isLoadingRates ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Getting Rates...
                          </>
                        ) : (
                          'Get Shipping Rates'
                        )}
                      </Button>
                    </div>

                    {/* Shipping Rates */}
                    {(shippingRatesData?.rates || isLoadingRates || ratesError) && (
                      <div className="p-4 rounded-lg bg-white/5">
                        <h5 className="font-medium text-bone-white mb-4">Select Shipping Option</h5>
                        <ShippingRateSelector
                          rates={shippingRatesData?.rates || []}
                          flatRates={effectiveDeliveryOptions.shipping.flat_rates}
                          selected={selectedShippingRate}
                          onChange={setSelectedShippingRate}
                          loading={isLoadingRates}
                          error={ratesError instanceof Error ? ratesError.message : null}
                          freeShippingThreshold={effectiveDeliveryOptions.shipping.free_threshold}
                          orderTotal={estimatedTotal}
                          showFlatRates={
                            effectiveDeliveryOptions.shipping.pricing_mode === 'flat_rate' ||
                            effectiveDeliveryOptions.shipping.pricing_mode === 'both'
                          }
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 3: Review & Submit */}
          {currentStep === 'review' && (
            <>
              {/* Summary */}
              <div className="space-y-4">
                {/* Request Summary */}
                <div className="p-4 rounded-lg bg-white/5">
                  <h5 className="font-medium text-bone-white mb-3">Request Summary</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Title</span>
                      <span className="text-bone-white">{title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Dates</span>
                      <span className="text-bone-white">
                        {format(new Date(startDate), 'MMM d')} -{' '}
                        {format(new Date(endDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Duration</span>
                      <span className="text-bone-white">
                        {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Items</span>
                      <span className="text-bone-white">{items.length} items</span>
                    </div>
                  </div>
                </div>

                {/* Delivery Summary */}
                <div className="p-4 rounded-lg bg-white/5">
                  <h5 className="font-medium text-bone-white mb-3">Delivery</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Method</span>
                      <span className="text-bone-white capitalize">
                        {deliveryMethod === 'pickup'
                          ? 'Customer Pickup'
                          : deliveryMethod === 'local_delivery'
                          ? 'Local Delivery'
                          : 'Carrier Shipping'}
                      </span>
                    </div>
                    {deliveryMethod === 'local_delivery' && deliveryAddress && (
                      <div className="flex justify-between">
                        <span className="text-muted-gray">Address</span>
                        <span className="text-bone-white text-right max-w-[200px]">
                          {deliveryAddress}
                        </span>
                      </div>
                    )}
                    {deliveryMethod === 'shipping' && selectedShippingRate && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-gray">Carrier</span>
                          <span className="text-bone-white uppercase">
                            {selectedShippingRate.carrier}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-gray">Service</span>
                          <span className="text-bone-white">
                            {selectedShippingRate.service_name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-gray">Ship to</span>
                          <span className="text-bone-white text-right max-w-[200px]">
                            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Pricing Summary */}
                <div className="p-4 rounded-lg bg-accent-yellow/10 border border-accent-yellow/30">
                  <h5 className="font-medium text-bone-white mb-3">Estimated Pricing</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Rental ({rentalDays} days)</span>
                      <span className="text-bone-white">{formatPrice(estimatedTotal)}</span>
                    </div>
                    {deliveryMethod === 'shipping' && shippingCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-gray">Shipping</span>
                        <span className="text-bone-white">{formatPrice(shippingCost)}</span>
                      </div>
                    )}
                    <Separator className="bg-white/20 my-2" />
                    <div className="flex justify-between font-semibold">
                      <span className="text-bone-white">Estimated Total</span>
                      <span className="text-accent-yellow">{formatPrice(totalWithShipping)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-gray mt-3">
                    Final pricing will be confirmed by the rental house in their quote.
                  </p>
                </div>

                {/* Backlot Integration */}
                {backlotProjectId && (
                  <div className="p-4 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-muted-gray" />
                          <span className="text-sm font-medium text-bone-white">
                            Auto-create Budget Line Item
                          </span>
                        </div>
                        <p className="text-xs text-muted-gray mt-1">
                          Automatically add this rental to your project's budget
                        </p>
                      </div>
                      <Switch
                        checked={autoCreateBudgetLine}
                        onCheckedChange={setAutoCreateBudgetLine}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Info Alert */}
              <Alert className="border-blue-500/30 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-200">
                  The rental house will review your request and send you a formal quote. You'll be
                  able to review and approve the quote before confirming the rental.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          {currentStep !== 'items' && (
            <Button variant="outline" onClick={goToPreviousStep}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {currentStep === 'items' && (
            <Button onClick={goToNextStep} disabled={!canProceedToDelivery} className="gap-2">
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {currentStep === 'delivery' && (
            <Button onClick={goToNextStep} disabled={!canProceedToReview()} className="gap-2">
              Review
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {currentStep === 'review' && (
            <Button onClick={handleSubmit} disabled={!canSubmit || isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RequestQuoteDialog;
