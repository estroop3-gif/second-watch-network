/**
 * CreateListingDialog.tsx
 * Dialog for creating marketplace listings from assets (single or bulk mode)
 * Two-step wizard: Step 1 = Pricing, Step 2 = Options (deposit, insurance, etc.)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  DollarSign,
  Package,
  Shield,
  Info,
  Loader2,
  Check,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Truck,
  Calendar,
  Percent,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';

import { useMyListings } from '@/hooks/gear/useGearMarketplace';
import { SalePricingForm, type SaleCondition } from './SalePricingForm';
import type { GearAsset, CreateListingInput } from '@/types/gear';

export type ListingType = 'rent' | 'sale' | 'both';

// ============================================================================
// Types
// ============================================================================

interface AssetRates {
  daily_rate: string;
  weekly_rate: string;
  monthly_rate: string;
}

interface CreateListingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  /** Single asset mode */
  asset?: GearAsset | null;
  /** Bulk mode - multiple assets */
  assets?: GearAsset[];
  /** Callback after successful creation */
  onSuccess?: () => void;
}

// ============================================================================
// Asset Rate Row Component (for bulk mode)
// ============================================================================

interface AssetRateRowProps {
  asset: GearAsset;
  rates: AssetRates;
  onChange: (rates: AssetRates) => void;
  hasMissingRate: boolean;
}

function AssetRateRow({ asset, rates, onChange, hasMissingRate }: AssetRateRowProps) {
  const hasExistingRate = !!asset.daily_rate;
  const photos = (asset as any).photos || (asset as any).photo_urls || [];
  const imageUrl = photos[0] || (asset as any).image_url;

  return (
    <div
      className={cn(
        'grid grid-cols-[1fr,90px,90px,90px] gap-2 items-center py-3 border-b border-white/5',
        hasMissingRate && 'bg-red-500/5'
      )}
    >
      {/* Asset Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={asset.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-5 w-5 text-muted-gray" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-bone-white truncate">{asset.name}</p>
          {hasExistingRate ? (
            <p className="text-xs text-green-400">
              Asset rate: ${asset.daily_rate}/day
            </p>
          ) : (
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              No rate set
            </p>
          )}
        </div>
      </div>

      {/* Daily Rate Input */}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-gray">$</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={rates.daily_rate}
          onChange={(e) => onChange({ ...rates, daily_rate: e.target.value })}
          placeholder={asset.daily_rate?.toString() || '0'}
          className={cn(
            'h-8 text-sm pl-5',
            hasMissingRate && !rates.daily_rate && 'border-red-500/50 focus:border-red-500'
          )}
        />
      </div>

      {/* Weekly Rate Input */}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-gray">$</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={rates.weekly_rate}
          onChange={(e) => onChange({ ...rates, weekly_rate: e.target.value })}
          placeholder={asset.weekly_rate?.toString() || '—'}
          className="h-8 text-sm pl-5"
        />
      </div>

      {/* Monthly Rate Input */}
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-gray">$</span>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={rates.monthly_rate}
          onChange={(e) => onChange({ ...rates, monthly_rate: e.target.value })}
          placeholder={asset.monthly_rate?.toString() || '—'}
          className="h-8 text-sm pl-5"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CreateListingDialog({
  isOpen,
  onClose,
  orgId,
  asset,
  assets = [],
  onSuccess,
}: CreateListingDialogProps) {
  // Wizard step: 1 = Pricing, 2 = Options
  const [step, setStep] = useState(1);

  // Determine mode
  const isBulkMode = assets.length > 1;
  const assetsToList = asset ? [asset] : assets;

  // Listing type (rent, sale, or both)
  const [listingType, setListingType] = useState<ListingType>('rent');

  // Single asset form state - rental pricing
  const [dailyRate, setDailyRate] = useState<string>('');
  const [weeklyRate, setWeeklyRate] = useState<string>('');
  const [monthlyRate, setMonthlyRate] = useState<string>('');

  // Sale pricing state
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleCondition, setSaleCondition] = useState<SaleCondition | ''>('');
  const [saleIncludes, setSaleIncludes] = useState<string>('');
  const [saleNegotiable, setSaleNegotiable] = useState(true);

  // Bulk mode: per-asset rates
  const [assetRates, setAssetRates] = useState<Map<string, AssetRates>>(new Map());

  // Common settings (Step 2)
  const [minRentalDays, setMinRentalDays] = useState<string>('1');
  const [maxRentalDays, setMaxRentalDays] = useState<string>('');
  const [advanceBookingDays, setAdvanceBookingDays] = useState<string>('1');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositPercent, setDepositPercent] = useState<string>('');
  const [depositType, setDepositType] = useState<'amount' | 'percent'>('percent');
  const [insuranceRequired, setInsuranceRequired] = useState(false);
  const [insuranceDailyRate, setInsuranceDailyRate] = useState<string>('');
  const [weeklyDiscountPercent, setWeeklyDiscountPercent] = useState<string>('');
  const [monthlyDiscountPercent, setMonthlyDiscountPercent] = useState<string>('');
  const [quantityDiscountThreshold, setQuantityDiscountThreshold] = useState<string>('');
  const [quantityDiscountPercent, setQuantityDiscountPercent] = useState<string>('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');

  // Delivery options (Step 2)
  const [offersDelivery, setOffersDelivery] = useState(false);
  const [deliveryRadiusMiles, setDeliveryRadiusMiles] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<string>('');
  const [offersShipping, setOffersShipping] = useState(false);
  const [shippingFee, setShippingFee] = useState<string>('');

  // Initialize rates from asset data
  useEffect(() => {
    if (!isOpen) return;

    if (isBulkMode && assets.length > 0) {
      // Bulk mode: initialize per-asset rates
      const initialRates = new Map<string, AssetRates>();
      assets.forEach(a => {
        initialRates.set(a.id, {
          daily_rate: a.daily_rate?.toString() || '',
          weekly_rate: a.weekly_rate?.toString() || '',
          monthly_rate: a.monthly_rate?.toString() || '',
        });
      });
      setAssetRates(initialRates);
    } else if (asset) {
      // Single mode: populate form fields
      if (asset.daily_rate) setDailyRate(asset.daily_rate.toString());
      if (asset.weekly_rate) setWeeklyRate(asset.weekly_rate.toString());
      if (asset.monthly_rate) setMonthlyRate(asset.monthly_rate.toString());
    }
  }, [isOpen, asset, assets, isBulkMode]);

  // Hooks
  const { createListing, bulkCreateListings } = useMyListings(orgId);

  // Computed values for single mode
  const calculatedWeeklyRate = useMemo(() => {
    const daily = parseFloat(dailyRate) || 0;
    return daily > 0 ? Math.round(daily * 5) : 0;
  }, [dailyRate]);

  const calculatedMonthlyRate = useMemo(() => {
    const daily = parseFloat(dailyRate) || 0;
    return daily > 0 ? Math.round(daily * 20) : 0;
  }, [dailyRate]);

  // Validation: check which assets are missing rates
  const assetsWithMissingRates = useMemo(() => {
    if (!isBulkMode) return [];

    return assetsToList.filter(a => {
      const rates = assetRates.get(a.id);
      const dailyRateValue = parseFloat(rates?.daily_rate || '') || a.daily_rate;
      return !dailyRateValue || dailyRateValue <= 0;
    });
  }, [isBulkMode, assetsToList, assetRates]);

  const isPricingValid = useMemo(() => {
    if (assetsToList.length === 0) return false;

    if (isBulkMode) {
      // For bulk mode, check if all assets have required rates based on listing type
      if (listingType === 'rent' || listingType === 'both') {
        if (assetsWithMissingRates.length > 0) return false;
      }
      // Note: For bulk sale mode, we could add per-asset sale prices later
      // For now, bulk mode only supports rent type
      if (listingType === 'sale') return false; // Bulk sale not supported yet
      return true;
    }

    // Single mode validation
    const daily = parseFloat(dailyRate);
    const sale = parseFloat(salePrice);

    if (listingType === 'rent') {
      return daily > 0;
    } else if (listingType === 'sale') {
      return sale > 0 && saleCondition !== '';
    } else {
      // 'both' - need both rental and sale pricing
      return daily > 0 && sale > 0 && saleCondition !== '';
    }
  }, [isBulkMode, listingType, dailyRate, salePrice, saleCondition, assetsToList.length, assetsWithMissingRates.length]);

  // Handler for updating a single asset's rates in bulk mode
  const handleAssetRateChange = (assetId: string, newRates: AssetRates) => {
    setAssetRates(prev => {
      const next = new Map(prev);
      next.set(assetId, newRates);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPricingValid) return;

    try {
      if (isBulkMode) {
        // Bulk create with per-asset rates
        const listings = assetsToList.map(a => {
          const rates = assetRates.get(a.id);
          const daily = parseFloat(rates?.daily_rate || '') || a.daily_rate || 0;
          const weekly = rates?.weekly_rate ? parseFloat(rates.weekly_rate) : (a.weekly_rate || undefined);
          const monthly = rates?.monthly_rate ? parseFloat(rates.monthly_rate) : (a.monthly_rate || undefined);

          return {
            asset_id: a.id,
            listing_type: listingType,
            daily_rate: daily,
            weekly_rate: weekly,
            monthly_rate: monthly,
            weekly_discount_percent: weeklyDiscountPercent ? parseFloat(weeklyDiscountPercent) : undefined,
            monthly_discount_percent: monthlyDiscountPercent ? parseFloat(monthlyDiscountPercent) : undefined,
            quantity_discount_threshold: quantityDiscountThreshold ? parseInt(quantityDiscountThreshold) : undefined,
            quantity_discount_percent: quantityDiscountPercent ? parseFloat(quantityDiscountPercent) : undefined,
            min_rental_days: parseInt(minRentalDays) || 1,
            max_rental_days: maxRentalDays ? parseInt(maxRentalDays) : undefined,
            advance_booking_days: advanceBookingDays ? parseInt(advanceBookingDays) : 1,
            deposit_amount: depositType === 'amount' && depositAmount ? parseFloat(depositAmount) : undefined,
            deposit_percent: depositType === 'percent' && depositPercent ? parseFloat(depositPercent) : undefined,
            insurance_required: insuranceRequired,
            insurance_daily_rate: insuranceRequired && insuranceDailyRate ? parseFloat(insuranceDailyRate) : undefined,
            rental_notes: rentalNotes || undefined,
            pickup_instructions: pickupInstructions || undefined,
            // Delivery options
            offers_delivery: offersDelivery,
            delivery_radius_miles: offersDelivery && deliveryRadiusMiles ? parseInt(deliveryRadiusMiles) : undefined,
            delivery_fee: offersDelivery && deliveryFee ? parseFloat(deliveryFee) : undefined,
            offers_shipping: offersShipping,
            shipping_fee: offersShipping && shippingFee ? parseFloat(shippingFee) : undefined,
            // Sale fields (for future bulk sale support)
            sale_price: undefined,
            sale_condition: undefined,
            sale_includes: undefined,
            sale_negotiable: true,
          };
        });

        await bulkCreateListings.mutateAsync({ listings });
      } else if (assetsToList.length === 1) {
        // Single create
        const baseInput: CreateListingInput = {
          asset_id: assetsToList[0].id,
          listing_type: listingType,
          // Rental pricing (required if rent or both)
          daily_rate: (listingType === 'rent' || listingType === 'both') ? parseFloat(dailyRate) : undefined,
          weekly_rate: weeklyRate ? parseFloat(weeklyRate) : undefined,
          monthly_rate: monthlyRate ? parseFloat(monthlyRate) : undefined,
          // Rental options
          weekly_discount_percent: weeklyDiscountPercent ? parseFloat(weeklyDiscountPercent) : undefined,
          monthly_discount_percent: monthlyDiscountPercent ? parseFloat(monthlyDiscountPercent) : undefined,
          quantity_discount_threshold: quantityDiscountThreshold ? parseInt(quantityDiscountThreshold) : undefined,
          quantity_discount_percent: quantityDiscountPercent ? parseFloat(quantityDiscountPercent) : undefined,
          min_rental_days: parseInt(minRentalDays) || 1,
          max_rental_days: maxRentalDays ? parseInt(maxRentalDays) : undefined,
          advance_booking_days: advanceBookingDays ? parseInt(advanceBookingDays) : 1,
          deposit_amount: depositType === 'amount' && depositAmount ? parseFloat(depositAmount) : undefined,
          deposit_percent: depositType === 'percent' && depositPercent ? parseFloat(depositPercent) : undefined,
          insurance_required: insuranceRequired,
          insurance_daily_rate: insuranceRequired && insuranceDailyRate ? parseFloat(insuranceDailyRate) : undefined,
          rental_notes: rentalNotes || undefined,
          pickup_instructions: pickupInstructions || undefined,
          // Delivery options
          offers_delivery: offersDelivery,
          delivery_radius_miles: offersDelivery && deliveryRadiusMiles ? parseInt(deliveryRadiusMiles) : undefined,
          delivery_fee: offersDelivery && deliveryFee ? parseFloat(deliveryFee) : undefined,
          offers_shipping: offersShipping,
          shipping_fee: offersShipping && shippingFee ? parseFloat(shippingFee) : undefined,
          // Sale pricing (required if sale or both)
          sale_price: (listingType === 'sale' || listingType === 'both') ? parseFloat(salePrice) : undefined,
          sale_condition: (listingType === 'sale' || listingType === 'both') ? saleCondition || undefined : undefined,
          sale_includes: (listingType === 'sale' || listingType === 'both') ? saleIncludes || undefined : undefined,
          sale_negotiable: (listingType === 'sale' || listingType === 'both') ? saleNegotiable : undefined,
        };
        await createListing.mutateAsync(baseInput);
      }

      // Reset form
      resetForm();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to create listing:', error);
    }
  };

  const resetForm = () => {
    setStep(1);
    setListingType('rent');
    // Rental pricing
    setDailyRate('');
    setWeeklyRate('');
    setMonthlyRate('');
    setAssetRates(new Map());
    // Sale pricing
    setSalePrice('');
    setSaleCondition('');
    setSaleIncludes('');
    setSaleNegotiable(true);
    // Common settings
    setMinRentalDays('1');
    setMaxRentalDays('');
    setAdvanceBookingDays('1');
    setDepositAmount('');
    setDepositPercent('');
    setDepositType('percent');
    setInsuranceRequired(false);
    setInsuranceDailyRate('');
    setWeeklyDiscountPercent('');
    setMonthlyDiscountPercent('');
    setQuantityDiscountThreshold('');
    setQuantityDiscountPercent('');
    setRentalNotes('');
    setPickupInstructions('');
    // Delivery options
    setOffersDelivery(false);
    setDeliveryRadiusMiles('');
    setDeliveryFee('');
    setOffersShipping(false);
    setShippingFee('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isSubmitting = createListing.isPending || bulkCreateListings.isPending;

  // ============================================================================
  // STEP 1: Pricing
  // ============================================================================
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* BULK MODE: Per-Asset Rate Table */}
      {isBulkMode ? (
        <div className="space-y-4">
          <h4 className="flex items-center gap-2 font-medium text-bone-white">
            <DollarSign className="h-4 w-4 text-accent-yellow" />
            Rental Rates per Asset
          </h4>

          {/* Note about bulk mode limitations */}
          <Alert className="border-blue-500/30 bg-blue-500/10">
            <Info className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200 text-sm">
              Bulk listing currently supports rental listings only. To list items for sale, create individual listings.
            </AlertDescription>
          </Alert>

          {/* Validation Warning */}
          {assetsWithMissingRates.length > 0 && (
            <Alert className="border-red-500/30 bg-red-500/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-200 text-sm">
                {assetsWithMissingRates.length} asset{assetsWithMissingRates.length !== 1 ? 's' : ''} missing daily rate.
                All assets require a daily rate to list.
              </AlertDescription>
            </Alert>
          )}

          {/* Table Header */}
          <div className="grid grid-cols-[1fr,90px,90px,90px] gap-2 text-xs text-muted-gray border-b border-white/10 pb-2">
            <div>Asset</div>
            <div>Daily *</div>
            <div>Weekly</div>
            <div>Monthly</div>
          </div>

          {/* Asset Rows */}
          <div className="max-h-[350px] overflow-y-auto">
            {assetsToList.map((a) => {
              const rates = assetRates.get(a.id) || { daily_rate: '', weekly_rate: '', monthly_rate: '' };
              const hasMissingRate = assetsWithMissingRates.some(ma => ma.id === a.id);

              return (
                <AssetRateRow
                  key={a.id}
                  asset={a}
                  rates={rates}
                  onChange={(newRates) => handleAssetRateChange(a.id, newRates)}
                  hasMissingRate={hasMissingRate}
                />
              );
            })}
          </div>

          <p className="text-xs text-muted-gray">
            * Daily rate is required. Weekly defaults to 5x daily, monthly to 20x daily if not set.
          </p>
        </div>
      ) : (
        /* SINGLE MODE: Asset Preview & Listing Type Selection */
        <>
          {/* Asset Preview */}
          <div className="space-y-3">
            <Label className="text-muted-gray">Asset</Label>
            {asset && (
              <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden">
                  {(asset as any).photo_urls?.[0] || (asset as any).image_url ? (
                    <img
                      src={(asset as any).photo_urls?.[0] || (asset as any).image_url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-muted-gray" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-bone-white truncate">{asset.name}</h4>
                  <p className="text-sm text-muted-gray">
                    {asset.manufacturer} {asset.model && `• ${asset.model}`}
                  </p>
                  {asset.category_name && (
                    <p className="text-xs text-muted-gray">{asset.category_name}</p>
                  )}
                  {asset.daily_rate && (
                    <p className="text-xs text-green-400 mt-1">
                      Current asset rate: ${asset.daily_rate}/day
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator className="bg-white/10" />

          {/* Listing Type Selection */}
          <div className="space-y-4">
            <h4 className="flex items-center gap-2 font-medium text-bone-white">
              <Package className="h-4 w-4 text-accent-yellow" />
              Listing Type
            </h4>

            <RadioGroup
              value={listingType}
              onValueChange={(value) => setListingType(value as ListingType)}
              className="grid grid-cols-3 gap-3"
            >
              <label
                htmlFor="listing-rent"
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-all',
                  listingType === 'rent'
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                )}
              >
                <RadioGroupItem value="rent" id="listing-rent" className="sr-only" />
                <DollarSign className={cn(
                  'h-6 w-6',
                  listingType === 'rent' ? 'text-accent-yellow' : 'text-muted-gray'
                )} />
                <div className="text-center">
                  <div className={cn(
                    'font-medium',
                    listingType === 'rent' ? 'text-bone-white' : 'text-muted-gray'
                  )}>
                    For Rent
                  </div>
                  <div className="text-xs text-muted-gray">Rental only</div>
                </div>
              </label>

              <label
                htmlFor="listing-sale"
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-all',
                  listingType === 'sale'
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                )}
              >
                <RadioGroupItem value="sale" id="listing-sale" className="sr-only" />
                <Package className={cn(
                  'h-6 w-6',
                  listingType === 'sale' ? 'text-accent-yellow' : 'text-muted-gray'
                )} />
                <div className="text-center">
                  <div className={cn(
                    'font-medium',
                    listingType === 'sale' ? 'text-bone-white' : 'text-muted-gray'
                  )}>
                    For Sale
                  </div>
                  <div className="text-xs text-muted-gray">Sell permanently</div>
                </div>
              </label>

              <label
                htmlFor="listing-both"
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-4 cursor-pointer transition-all',
                  listingType === 'both'
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                )}
              >
                <RadioGroupItem value="both" id="listing-both" className="sr-only" />
                <div className="flex gap-1">
                  <DollarSign className={cn(
                    'h-5 w-5',
                    listingType === 'both' ? 'text-accent-yellow' : 'text-muted-gray'
                  )} />
                  <Package className={cn(
                    'h-5 w-5',
                    listingType === 'both' ? 'text-accent-yellow' : 'text-muted-gray'
                  )} />
                </div>
                <div className="text-center">
                  <div className={cn(
                    'font-medium',
                    listingType === 'both' ? 'text-bone-white' : 'text-muted-gray'
                  )}>
                    Both
                  </div>
                  <div className="text-xs text-muted-gray">Rent or buy</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <Separator className="bg-white/10" />

          {/* Rental Pricing Section - Show for 'rent' or 'both' */}
          {(listingType === 'rent' || listingType === 'both') && (
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 font-medium text-bone-white">
                <DollarSign className="h-4 w-4 text-accent-yellow" />
                Rental Rates
              </h4>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dailyRate">Daily Rate *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      id="dailyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                      className="pl-7"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weeklyRate">
                    Weekly Rate
                    <span className="text-xs text-muted-gray ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      id="weeklyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={calculatedWeeklyRate > 0 ? calculatedWeeklyRate.toString() : '0.00'}
                      value={weeklyRate}
                      onChange={(e) => setWeeklyRate(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  {!weeklyRate && calculatedWeeklyRate > 0 && (
                    <p className="text-xs text-muted-gray">Default: ${calculatedWeeklyRate} (5x daily)</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyRate">
                    Monthly Rate
                    <span className="text-xs text-muted-gray ml-1">(optional)</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                    <Input
                      id="monthlyRate"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={calculatedMonthlyRate > 0 ? calculatedMonthlyRate.toString() : '0.00'}
                      value={monthlyRate}
                      onChange={(e) => setMonthlyRate(e.target.value)}
                      className="pl-7"
                    />
                  </div>
                  {!monthlyRate && calculatedMonthlyRate > 0 && (
                    <p className="text-xs text-muted-gray">Default: ${calculatedMonthlyRate} (20x daily)</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sale Pricing Section - Show for 'sale' or 'both' */}
          {(listingType === 'sale' || listingType === 'both') && (
            <>
              {listingType === 'both' && <Separator className="bg-white/10" />}
              <SalePricingForm
                salePrice={salePrice}
                setSalePrice={setSalePrice}
                condition={saleCondition}
                setCondition={setSaleCondition}
                includes={saleIncludes}
                setIncludes={setSaleIncludes}
                negotiable={saleNegotiable}
                setNegotiable={setSaleNegotiable}
              />
            </>
          )}
        </>
      )}
    </div>
  );

  // ============================================================================
  // STEP 2: Options
  // ============================================================================
  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Summary of what's being listed */}
      <Alert className="border-accent-yellow/30 bg-accent-yellow/10">
        <Package className="h-4 w-4 text-accent-yellow" />
        <AlertDescription className="text-accent-yellow text-sm">
          {isBulkMode
            ? `Configuring options for ${assetsToList.length} assets`
            : `Configuring options for "${assetsToList[0]?.name}"`
          }
        </AlertDescription>
      </Alert>

      {/* Rental Duration */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-medium text-bone-white">
          <Calendar className="h-4 w-4 text-blue-400" />
          Rental Duration
        </h4>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minRentalDays">Minimum Days</Label>
            <Input
              id="minRentalDays"
              type="number"
              min="1"
              max="365"
              value={minRentalDays}
              onChange={(e) => setMinRentalDays(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-gray">Shortest rental period</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxRentalDays">
              Maximum Days
              <span className="text-xs text-muted-gray ml-1">(opt.)</span>
            </Label>
            <Input
              id="maxRentalDays"
              type="number"
              min="1"
              max="365"
              placeholder="No limit"
              value={maxRentalDays}
              onChange={(e) => setMaxRentalDays(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-gray">Leave blank for no limit</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="advanceBookingDays">
              Advance Notice
              <span className="text-xs text-muted-gray ml-1">(opt.)</span>
            </Label>
            <Input
              id="advanceBookingDays"
              type="number"
              min="0"
              max="365"
              placeholder="1"
              value={advanceBookingDays}
              onChange={(e) => setAdvanceBookingDays(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-gray">Days in advance to book</p>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Discounts Section */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-medium text-bone-white">
          <Percent className="h-4 w-4 text-green-400" />
          Discounts
          <span className="text-xs text-muted-gray font-normal">(Optional)</span>
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weeklyDiscountPercent">Weekly Rental Discount</Label>
            <div className="relative">
              <Input
                id="weeklyDiscountPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0"
                value={weeklyDiscountPercent}
                onChange={(e) => setWeeklyDiscountPercent(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-gray">%</span>
            </div>
            <p className="text-xs text-muted-gray">Discount for 7+ day rentals</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyDiscountPercent">Monthly Rental Discount</Label>
            <div className="relative">
              <Input
                id="monthlyDiscountPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0"
                value={monthlyDiscountPercent}
                onChange={(e) => setMonthlyDiscountPercent(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-gray">%</span>
            </div>
            <p className="text-xs text-muted-gray">Discount for 30+ day rentals</p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <Label className="text-bone-white">Quantity Discount</Label>
          <p className="text-xs text-muted-gray">
            Offer a discount when renting multiple items together
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantityDiscountThreshold" className="text-xs text-muted-gray">
                Minimum Items
              </Label>
              <Input
                id="quantityDiscountThreshold"
                type="number"
                min="2"
                max="100"
                placeholder="e.g., 3"
                value={quantityDiscountThreshold}
                onChange={(e) => setQuantityDiscountThreshold(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantityDiscountPercent" className="text-xs text-muted-gray">
                Discount
              </Label>
              <div className="relative">
                <Input
                  id="quantityDiscountPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="e.g., 10"
                  value={quantityDiscountPercent}
                  onChange={(e) => setQuantityDiscountPercent(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-gray">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Security Deposit Section */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-medium text-bone-white">
          <DollarSign className="h-4 w-4 text-orange-400" />
          Security Deposit
          <span className="text-xs text-muted-gray font-normal">(Optional)</span>
        </h4>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDepositType('percent')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                depositType === 'percent'
                  ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                  : 'border-white/10 text-muted-gray hover:border-white/20'
              )}
            >
              Percentage
            </button>
            <button
              type="button"
              onClick={() => setDepositType('amount')}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                depositType === 'amount'
                  ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                  : 'border-white/10 text-muted-gray hover:border-white/20'
              )}
            >
              Fixed Amount
            </button>
          </div>

          {depositType === 'percent' ? (
            <div className="relative w-32">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="0"
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-gray">%</span>
            </div>
          ) : (
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-gray">
          {depositType === 'percent'
            ? 'Percentage of the rental total'
            : 'Fixed amount regardless of rental duration'
          }
        </p>
      </div>

      <Separator className="bg-white/10" />

      {/* Insurance Section */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-medium text-bone-white">
          <Shield className="h-4 w-4 text-green-400" />
          Insurance
        </h4>

        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
          <div>
            <Label className="text-bone-white">Require Insurance</Label>
            <p className="text-xs text-muted-gray">
              Renters must have their own insurance or purchase it
            </p>
          </div>
          <Switch
            checked={insuranceRequired}
            onCheckedChange={setInsuranceRequired}
          />
        </div>

        {insuranceRequired && (
          <div className="space-y-2 pl-4 border-l-2 border-green-400/30">
            <Label htmlFor="insuranceDailyRate">Insurance Daily Rate (if purchasing through you)</Label>
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
              <Input
                id="insuranceDailyRate"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={insuranceDailyRate}
                onChange={(e) => setInsuranceDailyRate(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-gray">Leave blank if you don't offer insurance</p>
          </div>
        )}
      </div>

      <Separator className="bg-white/10" />

      {/* Delivery & Shipping Section */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-medium text-bone-white">
          <Truck className="h-4 w-4 text-purple-400" />
          Delivery & Shipping
          <span className="text-xs text-muted-gray font-normal">(Optional)</span>
        </h4>

        {/* Local Delivery */}
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
          <div>
            <Label className="text-bone-white">Offer Local Delivery</Label>
            <p className="text-xs text-muted-gray">
              Deliver to renters within your area
            </p>
          </div>
          <Switch
            checked={offersDelivery}
            onCheckedChange={setOffersDelivery}
          />
        </div>

        {offersDelivery && (
          <div className="space-y-3 pl-4 border-l-2 border-purple-400/30">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliveryRadiusMiles">Delivery Radius</Label>
                <div className="relative">
                  <Input
                    id="deliveryRadiusMiles"
                    type="number"
                    min="1"
                    max="500"
                    placeholder="50"
                    value={deliveryRadiusMiles}
                    onChange={(e) => setDeliveryRadiusMiles(e.target.value)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-gray">miles</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Delivery Fee</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="deliveryFee"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-gray">Base fee for delivery</p>
              </div>
            </div>
          </div>
        )}

        {/* Shipping */}
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
          <div>
            <Label className="text-bone-white">Offer Shipping</Label>
            <p className="text-xs text-muted-gray">
              Ship to renters anywhere
            </p>
          </div>
          <Switch
            checked={offersShipping}
            onCheckedChange={setOffersShipping}
          />
        </div>

        {offersShipping && (
          <div className="space-y-2 pl-4 border-l-2 border-purple-400/30">
            <Label htmlFor="shippingFee">Flat Rate Shipping Fee</Label>
            <div className="relative w-32">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
              <Input
                id="shippingFee"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-gray">Leave blank for calculated rates</p>
          </div>
        )}
      </div>

      <Separator className="bg-white/10" />

      {/* Pickup & Notes Section */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-medium text-bone-white">
          <Truck className="h-4 w-4 text-muted-gray" />
          Pickup & Notes
        </h4>

        <div className="space-y-2">
          <Label htmlFor="pickupInstructions">Pickup Instructions</Label>
          <Textarea
            id="pickupInstructions"
            placeholder="e.g., Available for pickup M-F 9am-5pm at our office..."
            value={pickupInstructions}
            onChange={(e) => setPickupInstructions(e.target.value)}
            rows={2}
          />
          <p className="text-xs text-muted-gray">How and when renters can pick up the gear</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rentalNotes">
            Rental Notes
            <span className="text-xs text-muted-gray ml-1">(visible to renters)</span>
          </Label>
          <Textarea
            id="rentalNotes"
            placeholder="e.g., Comes with case and accessories. Please handle with care..."
            value={rentalNotes}
            onChange={(e) => setRentalNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Info Alert for bulk mode */}
      {isBulkMode && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 text-sm">
            These settings will be applied to all {assetsToList.length} listings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-h-[85vh] flex flex-col p-0 overflow-hidden",
        isBulkMode ? "max-w-3xl" : "max-w-xl"
      )}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {step === 1 ? (
              <DollarSign className="h-5 w-5 text-accent-yellow" />
            ) : (
              <Shield className="h-5 w-5 text-blue-400" />
            )}
            {isBulkMode
              ? `List ${assetsToList.length} Assets for Rent`
              : listingType === 'rent'
                ? 'List Asset for Rent'
                : listingType === 'sale'
                  ? 'List Asset for Sale'
                  : 'List Asset for Rent & Sale'
            }
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? (
              isBulkMode
                ? 'Step 1 of 2: Set pricing for each asset'
                : listingType === 'rent'
                  ? 'Step 1 of 2: Set rental rates'
                  : listingType === 'sale'
                    ? 'Step 1 of 2: Set sale price and condition'
                    : 'Step 1 of 2: Set rental rates and sale price'
            ) : (
              listingType === 'sale'
                ? 'Step 2 of 2: Configure listing options'
                : 'Step 2 of 2: Configure rental options'
            )}
          </DialogDescription>
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-3">
            <div className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
              step === 1
                ? 'bg-accent-yellow text-charcoal-black'
                : 'bg-accent-yellow/20 text-accent-yellow'
            )}>
              {step > 1 ? <Check className="h-3 w-3" /> : '1'}
            </div>
            <div className="flex-1 h-0.5 bg-white/10">
              <div className={cn(
                'h-full bg-accent-yellow transition-all',
                step >= 2 ? 'w-full' : 'w-0'
              )} />
            </div>
            <div className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
              step === 2
                ? 'bg-accent-yellow text-charcoal-black'
                : 'bg-white/10 text-muted-gray'
            )}>
              2
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6">
            {step === 1 ? renderStep1() : renderStep2()}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!isPricingValid}
                className="gap-2"
              >
                Next: Options
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {isBulkMode
                      ? `List ${assetsToList.length} Assets`
                      : listingType === 'rent'
                        ? 'List for Rent'
                        : listingType === 'sale'
                          ? 'List for Sale'
                          : 'Create Listing'
                    }
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateListingDialog;
