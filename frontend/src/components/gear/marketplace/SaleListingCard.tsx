/**
 * SaleListingCard - Reusable card component for displaying gear-for-sale listings
 */
import React from 'react';
import { Package, BadgeCheck, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { GearMarketplaceListing, SaleCondition } from '@/types/gear';

const CONDITION_LABELS: Record<SaleCondition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  parts: 'For Parts',
};

interface SaleListingCardProps {
  listing: GearMarketplaceListing;
  viewMode: 'grid' | 'list';
  onView: () => void;
}

export function SaleListingCard({ listing, viewMode, onView }: SaleListingCardProps) {
  const primaryPhoto = listing.asset?.photos_current?.[0] || listing.asset?.photos_baseline?.[0];

  if (viewMode === 'list') {
    return (
      <Card
        className="cursor-pointer border-white/10 bg-white/5 transition-colors hover:border-white/20"
        onClick={onView}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Thumbnail */}
          <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-white/10 overflow-hidden">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={listing.asset?.name || 'Gear'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-6 w-6 text-muted-gray" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-bone-white truncate">
                {listing.asset?.name || 'Unknown Asset'}
              </h3>
              {listing.organization?.is_verified && (
                <BadgeCheck className="h-4 w-4 flex-shrink-0 text-accent-yellow" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {listing.sale_condition && (
                <Badge variant="secondary" className="text-xs">
                  {CONDITION_LABELS[listing.sale_condition]}
                </Badge>
              )}
              {listing.sale_negotiable && (
                <Badge variant="outline" className="text-xs">
                  Negotiable
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-gray mt-1 truncate">
              {listing.organization?.name || 'Unknown Seller'}
            </p>
          </div>

          {/* Price + CTA */}
          <div className="text-right flex-shrink-0 flex flex-col items-end gap-2">
            <p className="text-lg font-bold text-accent-yellow">
              ${listing.sale_price?.toLocaleString()}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onView(); }}
              className="text-xs"
            >
              View Details
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Grid view
  return (
    <Card
      className="cursor-pointer border-white/10 bg-white/5 transition-colors hover:border-white/20 overflow-hidden"
      onClick={onView}
    >
      {/* Image */}
      <div className="aspect-square bg-white/10 overflow-hidden">
        {primaryPhoto ? (
          <img
            src={primaryPhoto}
            alt={listing.asset?.name || 'Gear'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-12 w-12 text-muted-gray" />
          </div>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm line-clamp-2">
            {listing.asset?.name || 'Unknown Asset'}
          </CardTitle>
          {listing.organization?.is_verified && (
            <BadgeCheck className="h-4 w-4 flex-shrink-0 text-accent-yellow" />
          )}
        </div>
        <CardDescription className="text-xs truncate">
          {listing.organization?.name || 'Unknown Seller'}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center gap-2 mb-2">
          {listing.sale_condition && (
            <Badge variant="secondary" className="text-xs">
              {CONDITION_LABELS[listing.sale_condition]}
            </Badge>
          )}
          {listing.sale_negotiable && (
            <Badge variant="outline" className="text-xs">
              OBO
            </Badge>
          )}
        </div>
        <p className="text-lg font-bold text-accent-yellow mb-1">
          ${listing.sale_price?.toLocaleString()}
        </p>
        {listing.sale_includes && (
          <p className="text-xs text-muted-gray mb-2 line-clamp-1">
            Includes: {listing.sale_includes}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs mt-1"
          onClick={(e) => { e.stopPropagation(); onView(); }}
        >
          <DollarSign className="h-3 w-3 mr-1" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}

export default SaleListingCard;
