/**
 * ListingDetailDialog.tsx
 * Full listing detail dialog with pricing breakdown and rental options
 */
import React, { useState } from 'react';
import {
  X,
  Package,
  BadgeCheck,
  Store,
  MapPin,
  Calendar,
  Shield,
  DollarSign,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Truck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type { GearMarketplaceListing } from '@/types/gear';

interface ListingDetailDialogProps {
  listing: GearMarketplaceListing | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestQuote: () => void;
  onAddToQuote: () => void;
  isInQuote: boolean;
}

export function ListingDetailDialog({
  listing,
  isOpen,
  onClose,
  onRequestQuote,
  onAddToQuote,
  isInQuote,
}: ListingDetailDialogProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!listing) {
    return null;
  }

  const asset = listing.asset;
  const organization = listing.organization;
  const images = asset?.photo_urls?.length
    ? asset.photo_urls
    : asset?.image_url
      ? [asset.image_url]
      : [];

  // Format price display
  const formatPrice = (price: number | undefined) => {
    if (!price) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b border-white/10 bg-charcoal-black p-4">
          <DialogTitle className="flex items-center gap-2">
            {asset?.name || 'Listing Details'}
            {organization?.is_verified && (
              <BadgeCheck className="h-5 w-5 text-accent-yellow" />
            )}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="grid gap-6 p-6 lg:grid-cols-2">
          {/* Left: Images */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white/10">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[activeImageIndex]}
                    alt={asset?.name || 'Listing'}
                    className="h-full w-full object-cover"
                  />
                  {images.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70"
                        onClick={handlePrevImage}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70"
                        onClick={handleNextImage}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-16 w-16 text-muted-gray" />
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images.map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveImageIndex(index)}
                    className={cn(
                      'h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                      activeImageIndex === index
                        ? 'border-accent-yellow'
                        : 'border-transparent hover:border-white/30'
                    )}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Item Details */}
            <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="font-medium text-bone-white">Item Details</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {asset?.manufacturer && (
                  <div>
                    <span className="text-muted-gray">Manufacturer</span>
                    <p className="text-bone-white">{asset.manufacturer}</p>
                  </div>
                )}
                {asset?.model && (
                  <div>
                    <span className="text-muted-gray">Model</span>
                    <p className="text-bone-white">{asset.model}</p>
                  </div>
                )}
                {asset?.serial_number && (
                  <div>
                    <span className="text-muted-gray">Serial Number</span>
                    <p className="text-bone-white">{asset.serial_number}</p>
                  </div>
                )}
                {asset?.condition && (
                  <div>
                    <span className="text-muted-gray">Condition</span>
                    <p className="capitalize text-bone-white">{asset.condition}</p>
                  </div>
                )}
              </div>
              {asset?.description && (
                <div>
                  <span className="text-sm text-muted-gray">Description</span>
                  <p className="text-sm text-bone-white">{asset.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Pricing & Actions */}
          <div className="space-y-4">
            {/* Rental House Info */}
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
                {organization?.logo_url ? (
                  <img
                    src={organization.logo_url}
                    alt={organization.name}
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <Store className="h-6 w-6 text-muted-gray" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-bone-white">
                    {organization?.marketplace_name || organization?.name}
                  </span>
                  {organization?.is_verified && (
                    <BadgeCheck className="h-4 w-4 text-accent-yellow" />
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-gray">
                  <MapPin className="h-3 w-3" />
                  {organization?.marketplace_location || 'Location not specified'}
                </div>
              </div>
              {organization?.lister_type && (
                <Badge variant="outline" className="capitalize">
                  {organization.lister_type.replace('_', ' ')}
                </Badge>
              )}
            </div>

            {/* Pricing */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="mb-4 font-medium text-bone-white">Rental Rates</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-gray">Daily Rate</span>
                  <span className="text-xl font-semibold text-bone-white">
                    {formatPrice(listing.daily_rate)}
                  </span>
                </div>
                {listing.weekly_rate && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-gray">Weekly Rate</span>
                    <div className="text-right">
                      <span className="font-medium text-bone-white">
                        {formatPrice(listing.weekly_rate)}
                      </span>
                      {listing.weekly_discount_percent > 0 && (
                        <Badge className="ml-2 bg-green-500/20 text-green-400">
                          {listing.weekly_discount_percent}% off
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                {listing.monthly_rate && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-gray">Monthly Rate</span>
                    <div className="text-right">
                      <span className="font-medium text-bone-white">
                        {formatPrice(listing.monthly_rate)}
                      </span>
                      {listing.monthly_discount_percent > 0 && (
                        <Badge className="ml-2 bg-green-500/20 text-green-400">
                          {listing.monthly_discount_percent}% off
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Requirements */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h4 className="mb-3 font-medium text-bone-white">Requirements</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-gray" />
                  <span className="text-muted-gray">Minimum rental:</span>
                  <span className="text-bone-white">
                    {listing.min_rental_days} {listing.min_rental_days === 1 ? 'day' : 'days'}
                  </span>
                </div>
                {listing.advance_booking_days > 1 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-gray" />
                    <span className="text-muted-gray">Advance booking:</span>
                    <span className="text-bone-white">
                      {listing.advance_booking_days} days
                    </span>
                  </div>
                )}
                {listing.insurance_required && (
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-accent-yellow" />
                    <span className="text-accent-yellow">Insurance required</span>
                    {listing.insurance_daily_rate && (
                      <span className="text-muted-gray">
                        ({formatPrice(listing.insurance_daily_rate)}/day)
                      </span>
                    )}
                  </div>
                )}
                {listing.deposit_amount && listing.deposit_amount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-gray" />
                    <span className="text-muted-gray">Deposit:</span>
                    <span className="text-bone-white">
                      {formatPrice(listing.deposit_amount)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Rental Notes */}
            {listing.rental_notes && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-medium text-bone-white">
                  <Info className="h-4 w-4" />
                  Rental Notes
                </h4>
                <p className="text-sm text-muted-gray">{listing.rental_notes}</p>
              </div>
            )}

            {/* Pickup Instructions */}
            {listing.pickup_instructions && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <h4 className="mb-2 flex items-center gap-2 font-medium text-bone-white">
                  <Truck className="h-4 w-4" />
                  Pickup Instructions
                </h4>
                <p className="text-sm text-muted-gray">{listing.pickup_instructions}</p>
              </div>
            )}

            <Separator className="bg-white/10" />

            {/* Actions */}
            <div className="flex gap-3">
              {isInQuote ? (
                <Button variant="outline" className="flex-1 gap-2" disabled>
                  <Check className="h-4 w-4" />
                  Added to Quote
                </Button>
              ) : (
                <Button variant="outline" className="flex-1 gap-2" onClick={onAddToQuote}>
                  <Plus className="h-4 w-4" />
                  Add to Quote
                </Button>
              )}
              <Button className="flex-1" onClick={onRequestQuote}>
                Request Quote
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ListingDetailDialog;
