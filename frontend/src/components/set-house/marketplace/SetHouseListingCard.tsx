/**
 * SetHouseListingCard - Individual space listing card for the Set Marketplace
 * Shows photo, space details, pricing, and a view button
 */
import React from 'react';
import { Building2, MapPin, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SetHouseMarketplaceListing } from '@/types/set-house';

// The API returns flat joined fields not in the base type
interface ListingFlat {
  space_name?: string;
  space_type?: string;
  description?: string;
  primary_image_url?: string;
  space_photos?: string[];
  organization_name?: string;
  marketplace_name?: string;
  is_verified?: boolean;
  city?: string;
  state?: string;
}

type Listing = SetHouseMarketplaceListing & ListingFlat;

interface SetHouseListingCardProps {
  listing: Listing;
  viewMode: 'grid' | 'list';
  onView: () => void;
}

function formatRate(rate: number | undefined): string {
  if (!rate) return '';
  return `$${rate.toLocaleString()}`;
}

function getPhotoUrl(listing: Listing): string | null {
  if (listing.primary_image_url) return listing.primary_image_url;
  if (listing.space_photos && listing.space_photos.length > 0) return listing.space_photos[0];
  return null;
}

const SetHouseListingCard: React.FC<SetHouseListingCardProps> = ({ listing, viewMode, onView }) => {
  const photoUrl = getPhotoUrl(listing);
  const spaceName = listing.space_name || listing.space?.name || 'Unnamed Space';
  const spaceType = listing.space_type || listing.space?.space_type;
  const description = listing.description || listing.space?.description;
  const orgName = listing.marketplace_name || listing.organization_name || listing.organization?.name;
  const isVerified = listing.is_verified ?? listing.organization?.is_verified ?? false;
  const city = listing.city || listing.organization?.city;
  const state = listing.state || listing.organization?.state;

  if (viewMode === 'list') {
    return (
      <div
        className="flex gap-4 rounded-lg border border-muted-gray/30 bg-charcoal-black/50 p-4 hover:border-accent-yellow/50 transition-colors cursor-pointer"
        onClick={onView}
      >
        {/* Thumbnail */}
        <div className="w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
          {photoUrl ? (
            <img src={photoUrl} alt={spaceName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-gray" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {spaceType && (
                <Badge variant="outline" className="mb-1 text-xs capitalize">
                  {spaceType.replace(/_/g, ' ')}
                </Badge>
              )}
              <h3 className="font-semibold text-bone-white truncate">{spaceName}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-sm text-muted-gray truncate">{orgName}</span>
                {isVerified && <BadgeCheck className="h-3.5 w-3.5 text-accent-yellow flex-shrink-0" />}
              </div>
              {city && state && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-gray">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span>{city}, {state}</span>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="flex-shrink-0 text-right">
              <p className="text-lg font-bold text-bone-white">{formatRate(listing.daily_rate)}<span className="text-sm font-normal text-muted-gray">/day</span></p>
              {listing.hourly_rate && (
                <p className="text-sm text-muted-gray">{formatRate(listing.hourly_rate)}/hr</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid mode
  return (
    <div className="rounded-lg border border-muted-gray/30 bg-charcoal-black/50 hover:border-accent-yellow/50 transition-colors overflow-hidden flex flex-col">
      {/* Photo hero */}
      <div className="aspect-video w-full bg-white/5 flex-shrink-0">
        {photoUrl ? (
          <img src={photoUrl} alt={spaceName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="h-12 w-12 text-muted-gray" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* Space type pill */}
        {spaceType && (
          <Badge variant="outline" className="w-fit text-xs capitalize">
            {spaceType.replace(/_/g, ' ')}
          </Badge>
        )}

        {/* Space name */}
        <h3 className="font-semibold text-bone-white leading-tight">{spaceName}</h3>

        {/* Org name + verified */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-gray truncate">{orgName}</span>
          {isVerified && <BadgeCheck className="h-3.5 w-3.5 text-accent-yellow flex-shrink-0" />}
        </div>

        {/* Location */}
        {city && state && (
          <div className="flex items-center gap-1 text-xs text-muted-gray">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span>{city}, {state}</span>
          </div>
        )}

        {/* Pricing */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xl font-bold text-bone-white">{formatRate(listing.daily_rate)}</span>
          <span className="text-sm text-muted-gray">/day</span>
          {listing.hourly_rate && (
            <span className="text-sm text-muted-gray ml-1">{formatRate(listing.hourly_rate)}/hr</span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-gray line-clamp-2 flex-1">{description}</p>
        )}

        {/* View Details button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-auto"
          onClick={onView}
        >
          View Details
        </Button>
      </div>
    </div>
  );
};

export default SetHouseListingCard;
