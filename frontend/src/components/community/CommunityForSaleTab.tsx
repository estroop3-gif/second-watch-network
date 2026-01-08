/**
 * CommunityForSaleTab - Browse gear for sale from the community
 * Embedded for-sale browser for the Community page
 */
import React, { useState } from 'react';
import {
  Search,
  Grid,
  List,
  BadgeCheck,
  Loader2,
  Package,
  Plus,
  DollarSign,
  Tag,
  ShoppingCart,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { useMarketplaceSearch } from '@/hooks/gear/useGearMarketplace';
import type { GearMarketplaceListing, GearMarketplaceSearchFilters, SaleCondition } from '@/types/gear';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CONDITION_LABELS: Record<SaleCondition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  parts: 'For Parts',
};

const CommunityForSaleTab: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<SaleCondition | ''>('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Build filters - only show sale listings
  const filters: GearMarketplaceSearchFilters = {
    search: searchQuery || undefined,
    listing_type: 'sale', // Only sales for this tab
    condition: conditionFilter || undefined,
    verified_only: verifiedOnly || undefined,
  };

  // Data fetching
  const { listings, total, isLoading } = useMarketplaceSearch(filters);

  const handleViewListing = (listing: GearMarketplaceListing) => {
    // TODO: Open sale listing detail dialog
    console.log('View listing:', listing);
  };

  const handleSellYourGear = () => {
    // Navigate to My Gear (lite) for simplified listing flow
    navigate('/my-gear');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-bone-white">Gear For Sale</h2>
          <p className="text-muted-gray">
            Buy professional equipment from filmmakers in your community
          </p>
        </div>

        {user && (
          <Button onClick={handleSellYourGear} variant="outline" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Sell Your Gear
          </Button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
          <Input
            placeholder="Search equipment for sale..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={conditionFilter}
            onValueChange={(value) => setConditionFilter(value === 'all' ? '' : value as SaleCondition)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Condition</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="like_new">Like New</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="parts">For Parts</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={verifiedOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className="gap-1.5"
          >
            <BadgeCheck className="h-4 w-4" />
            Verified Only
          </Button>

          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
          <Tag className="mb-4 h-12 w-12 text-muted-gray" />
          <h3 className="mb-2 text-lg font-medium text-bone-white">No items for sale</h3>
          <p className="text-sm text-muted-gray mb-4">
            Try adjusting your search filters or check back later for new listings.
          </p>
          {user && (
            <Button onClick={handleSellYourGear} variant="outline" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Be the first to list gear
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-gray">
            Showing {listings.length} of {total} items for sale
          </p>

          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'flex flex-col gap-3'
            )}
          >
            {listings.map((listing) => (
              <SaleListingCard
                key={listing.id}
                listing={listing}
                viewMode={viewMode}
                onView={() => handleViewListing(listing)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SALE LISTING CARD
// ============================================================================

interface SaleListingCardProps {
  listing: GearMarketplaceListing;
  viewMode: 'grid' | 'list';
  onView: () => void;
}

function SaleListingCard({ listing, viewMode, onView }: SaleListingCardProps) {
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

          {/* Price */}
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-accent-yellow">
              ${listing.sale_price?.toLocaleString()}
            </p>
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
        <p className="text-lg font-bold text-accent-yellow">
          ${listing.sale_price?.toLocaleString()}
        </p>
        {listing.sale_includes && (
          <p className="text-xs text-muted-gray mt-1 line-clamp-1">
            Includes: {listing.sale_includes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default CommunityForSaleTab;
