/**
 * ListingCard.tsx
 * Card component for displaying marketplace listings
 */
import React from 'react';
import {
  Package,
  BadgeCheck,
  Store,
  DollarSign,
  Calendar,
  Plus,
  Check,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { GearMarketplaceListing } from '@/types/gear';

interface ListingCardProps {
  listing: GearMarketplaceListing;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onView: () => void;
  onAddToQuote: () => void;
  onRemoveFromQuote: () => void;
}

export function ListingCard({
  listing,
  viewMode,
  isSelected,
  onView,
  onAddToQuote,
  onRemoveFromQuote,
}: ListingCardProps) {
  const asset = listing.asset;
  const organization = listing.organization;

  // Format price display
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Get primary image - handle multiple possible field names from API
  const primaryImage = asset?.photo_urls?.[0] || asset?.photos_current?.[0] || asset?.photos_baseline?.[0] || asset?.image_url;

  if (viewMode === 'list') {
    return (
      <Card
        className={cn(
          'border-white/10 bg-white/5 transition-all',
          isSelected && 'border-accent-yellow/50 bg-accent-yellow/5'
        )}
      >
        <CardContent className="flex items-center gap-4 p-4">
          {/* Image */}
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
            {primaryImage ? (
              <img
                src={primaryImage}
                alt={asset?.name || 'Listing'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-8 w-8 text-muted-gray" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-medium text-bone-white">
                {asset?.name || 'Unknown Item'}
              </h3>
              {organization?.is_verified && (
                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-accent-yellow" />
              )}
            </div>
            <p className="text-sm text-muted-gray">
              {asset?.manufacturer} {asset?.model}
            </p>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-gray">
              <span className="flex items-center gap-1">
                <Store className="h-3 w-3" />
                {organization?.marketplace_name || organization?.name}
              </span>
              {listing.min_rental_days > 1 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Min {listing.min_rental_days} days
                </span>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="text-right">
            <div className="text-lg font-semibold text-bone-white">
              {formatPrice(listing.daily_rate)}
              <span className="text-xs font-normal text-muted-gray">/day</span>
            </div>
            {listing.weekly_rate && (
              <div className="text-xs text-muted-gray">
                {formatPrice(listing.weekly_rate)}/week
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onView}>
              <Eye className="h-4 w-4" />
            </Button>
            {isSelected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRemoveFromQuote}
                className="gap-1.5 border-accent-yellow text-accent-yellow"
              >
                <Check className="h-4 w-4" />
                Added
              </Button>
            ) : (
              <Button variant="default" size="sm" onClick={onAddToQuote} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grid view
  return (
    <Card
      className={cn(
        'group cursor-pointer overflow-hidden border-white/10 bg-white/5 transition-all hover:border-white/20',
        isSelected && 'border-accent-yellow/50 bg-accent-yellow/5'
      )}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white/10">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={asset?.name || 'Listing'}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-12 w-12 text-muted-gray" />
          </div>
        )}

        {/* Verified badge */}
        {organization?.is_verified && (
          <div className="absolute left-2 top-2">
            <Badge className="gap-1 bg-accent-yellow/90 text-charcoal-black">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </Badge>
          </div>
        )}

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute right-2 top-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-yellow">
              <Check className="h-4 w-4 text-charcoal-black" />
            </div>
          </div>
        )}

        {/* Quick actions overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="secondary" size="sm" onClick={onView}>
            View Details
          </Button>
          {!isSelected && (
            <Button size="sm" onClick={onAddToQuote}>
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          )}
        </div>
      </div>

      <CardContent className="p-4" onClick={onView}>
        {/* Organization */}
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-gray">
          <Store className="h-3 w-3" />
          <span className="truncate">
            {organization?.marketplace_name || organization?.name}
          </span>
          {organization?.lister_type === 'rental_house' && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              Rental House
            </Badge>
          )}
        </div>

        {/* Name */}
        <h3 className="mb-1 truncate font-medium text-bone-white">
          {asset?.name || 'Unknown Item'}
        </h3>
        <p className="mb-3 truncate text-sm text-muted-gray">
          {asset?.manufacturer} {asset?.model}
        </p>

        {/* Pricing */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-lg font-semibold text-bone-white">
              {formatPrice(listing.daily_rate)}
            </span>
            <span className="text-xs text-muted-gray">/day</span>
          </div>
          {listing.weekly_rate && (
            <div className="text-xs text-muted-gray">
              {formatPrice(listing.weekly_rate)}/wk
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="mt-3 flex flex-wrap gap-1">
          {listing.insurance_required && (
            <Badge variant="outline" className="text-xs">
              Insurance Required
            </Badge>
          )}
          {listing.deposit_amount && listing.deposit_amount > 0 && (
            <Badge variant="outline" className="text-xs">
              {formatPrice(listing.deposit_amount)} Deposit
            </Badge>
          )}
          {listing.min_rental_days > 1 && (
            <Badge variant="outline" className="text-xs">
              Min {listing.min_rental_days} days
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ListingCard;
