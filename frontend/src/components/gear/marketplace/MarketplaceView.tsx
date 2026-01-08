/**
 * MarketplaceView.tsx
 * Main marketplace browser for searching and browsing rental listings
 */
import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  Store,
  BadgeCheck,
  MapPin,
  Loader2,
  Package,
  ArrowUpRight,
  Settings,
  Plus,
  Layers,
  LayoutList,
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

import { useMarketplaceSearch, useMarketplaceSearchGrouped, useMarketplaceOrganizations } from '@/hooks/gear/useGearMarketplace';
import { useGearCategories } from '@/hooks/gear';
import { ListingCard } from './ListingCard';
import { ListingDetailDialog } from './ListingDetailDialog';
import { RequestQuoteDialog } from './RequestQuoteDialog';
import { MyListingsTab } from './MyListingsTab';
import { AssetPickerDialog } from './AssetPickerDialog';
import type { GearMarketplaceListing, GearMarketplaceSearchFilters, ListerType, MarketplaceOrganizationGroup } from '@/types/gear';

interface MarketplaceViewProps {
  orgId: string;
  backlotProjectId?: string;
  onRentalRequested?: () => void;
  onGoToSettings?: () => void;
}

export function MarketplaceView({
  orgId,
  backlotProjectId,
  onRentalRequested,
  onGoToSettings,
}: MarketplaceViewProps) {
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupByOrg, setGroupByOrg] = useState(true); // Default to grouped view
  const [activeTab, setActiveTab] = useState<'listings' | 'rental_houses' | 'my_listings'>('listings');
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [listerTypeFilter, setListerTypeFilter] = useState<ListerType | ''>('');
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Dialog state
  const [selectedListing, setSelectedListing] = useState<GearMarketplaceListing | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState<GearMarketplaceListing[]>([]);

  // Build filters
  const filters: GearMarketplaceSearchFilters = {
    search: searchQuery || undefined,
    category_id: categoryFilter || undefined,
    lister_type: listerTypeFilter || undefined,
    min_price: priceRange.min,
    max_price: priceRange.max,
    verified_only: verifiedOnly || undefined,
  };

  // Get org IDs from quote items for prioritization
  const cartOrgIds = useMemo(() => {
    const orgIds = new Set(quoteItems.map((item) => item.organization_id));
    return Array.from(orgIds);
  }, [quoteItems]);

  // Data fetching - use grouped search when groupByOrg is true
  const { listings, total: flatTotal, isLoading: flatLoading } = useMarketplaceSearch(filters, { enabled: !groupByOrg });
  const { organizations: groupedOrgs, total: groupedTotal, isLoading: groupedLoading } = useMarketplaceSearchGrouped(
    filters,
    cartOrgIds,
    { enabled: groupByOrg }
  );
  const { organizations, isLoading: orgsLoading } = useMarketplaceOrganizations({
    lister_type: listerTypeFilter || undefined,
    verified_only: verifiedOnly || undefined,
  });
  const { categories } = useGearCategories(orgId);

  const isLoading = groupByOrg ? groupedLoading : flatLoading;
  const total = groupByOrg ? groupedTotal : flatTotal;

  const handleViewListing = (listing: GearMarketplaceListing) => {
    setSelectedListing(listing);
    setIsDetailOpen(true);
  };

  const handleAddToQuote = (listing: GearMarketplaceListing) => {
    setQuoteItems((prev) => {
      if (prev.find((item) => item.id === listing.id)) {
        return prev;
      }
      return [...prev, listing];
    });
  };

  const handleRemoveFromQuote = (listingId: string) => {
    setQuoteItems((prev) => prev.filter((item) => item.id !== listingId));
  };

  const handleRequestQuote = () => {
    if (quoteItems.length === 0 && selectedListing) {
      setQuoteItems([selectedListing]);
    }
    setIsDetailOpen(false);
    setIsQuoteDialogOpen(true);
  };

  const handleQuoteSubmitted = () => {
    setIsQuoteDialogOpen(false);
    setQuoteItems([]);
    setSelectedListing(null);
    onRentalRequested?.();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-bone-white">Gear Marketplace</h2>
          <p className="text-sm text-muted-gray">
            Browse equipment rentals from trusted rental houses and production companies
          </p>
        </div>

        {quoteItems.length > 0 && (
          <Button onClick={() => setIsQuoteDialogOpen(true)} className="gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Request Quote ({quoteItems.length} items)
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-4">
        <Button
          variant={activeTab === 'listings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('listings')}
          className="gap-2"
        >
          <Package className="h-4 w-4" />
          Browse Listings
        </Button>
        <Button
          variant={activeTab === 'rental_houses' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('rental_houses')}
          className="gap-2"
        >
          <Store className="h-4 w-4" />
          Rental Houses
        </Button>
        <Button
          variant={activeTab === 'my_listings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('my_listings')}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          My Listings
        </Button>
      </div>

      {/* Search & Filters - Only show for listings/rental_houses tabs */}
      {activeTab !== 'my_listings' && (
        <div className="flex flex-col gap-4 rounded-lg border border-white/10 bg-white/5 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
            <Input
              placeholder="Search equipment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={categoryFilter}
              onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={listerTypeFilter}
              onValueChange={(value) => setListerTypeFilter(value === 'all' ? '' : value as ListerType)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Lister Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="rental_house">Rental Houses</SelectItem>
                <SelectItem value="production_company">Production Companies</SelectItem>
                <SelectItem value="individual">Individuals</SelectItem>
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
                variant={groupByOrg ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setGroupByOrg(true)}
                title="Group by rental house"
              >
                <Layers className="h-4 w-4" />
              </Button>
              <Button
                variant={!groupByOrg ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setGroupByOrg(false)}
                title="Flat list"
              >
                <LayoutList className="h-4 w-4" />
              </Button>
            </div>

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
      )}

      {/* Content */}
      {activeTab === 'listings' ? (
        groupByOrg ? (
          <GroupedListingsContent
            organizations={groupedOrgs}
            total={total}
            isLoading={isLoading}
            viewMode={viewMode}
            selectedItems={quoteItems}
            onViewListing={handleViewListing}
            onAddToQuote={handleAddToQuote}
            onRemoveFromQuote={handleRemoveFromQuote}
          />
        ) : (
          <ListingsContent
            listings={listings}
            total={total}
            isLoading={isLoading}
            viewMode={viewMode}
            selectedItems={quoteItems}
            onViewListing={handleViewListing}
            onAddToQuote={handleAddToQuote}
            onRemoveFromQuote={handleRemoveFromQuote}
          />
        )
      ) : activeTab === 'rental_houses' ? (
        <RentalHousesContent
          organizations={organizations}
          isLoading={isLoading}
        />
      ) : (
        <MyListingsTab
          orgId={orgId}
          onAddListing={() => setIsAssetPickerOpen(true)}
          onGoToSettings={onGoToSettings}
        />
      )}

      {/* Listing Detail Dialog */}
      <ListingDetailDialog
        listing={selectedListing}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onRequestQuote={handleRequestQuote}
        onAddToQuote={() => {
          if (selectedListing) {
            handleAddToQuote(selectedListing);
          }
        }}
        isInQuote={selectedListing ? quoteItems.some((item) => item.id === selectedListing.id) : false}
      />

      {/* Request Quote Dialog */}
      <RequestQuoteDialog
        isOpen={isQuoteDialogOpen}
        onClose={() => setIsQuoteDialogOpen(false)}
        items={quoteItems}
        orgId={orgId}
        backlotProjectId={backlotProjectId}
        onRemoveItem={handleRemoveFromQuote}
        onSubmitted={handleQuoteSubmitted}
      />

      {/* Asset Picker Dialog for bulk listing */}
      <AssetPickerDialog
        isOpen={isAssetPickerOpen}
        onClose={() => setIsAssetPickerOpen(false)}
        orgId={orgId}
      />
    </div>
  );
}

// ============================================================================
// LISTINGS CONTENT
// ============================================================================

interface ListingsContentProps {
  listings: GearMarketplaceListing[];
  total: number;
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  selectedItems: GearMarketplaceListing[];
  onViewListing: (listing: GearMarketplaceListing) => void;
  onAddToQuote: (listing: GearMarketplaceListing) => void;
  onRemoveFromQuote: (listingId: string) => void;
}

function ListingsContent({
  listings,
  total,
  isLoading,
  viewMode,
  selectedItems,
  onViewListing,
  onAddToQuote,
  onRemoveFromQuote,
}: ListingsContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
        <Package className="mb-4 h-12 w-12 text-muted-gray" />
        <h3 className="mb-2 text-lg font-medium text-bone-white">No listings found</h3>
        <p className="text-sm text-muted-gray">
          Try adjusting your search filters or check back later for new listings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-gray">
        Showing {listings.length} of {total} listings
      </p>

      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'flex flex-col gap-3'
        )}
      >
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            viewMode={viewMode}
            isSelected={selectedItems.some((item) => item.id === listing.id)}
            onView={() => onViewListing(listing)}
            onAddToQuote={() => onAddToQuote(listing)}
            onRemoveFromQuote={() => onRemoveFromQuote(listing.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// GROUPED LISTINGS CONTENT (by organization)
// ============================================================================

interface GroupedListingsContentProps {
  organizations: MarketplaceOrganizationGroup[];
  total: number;
  isLoading: boolean;
  viewMode: 'grid' | 'list';
  selectedItems: GearMarketplaceListing[];
  onViewListing: (listing: GearMarketplaceListing) => void;
  onAddToQuote: (listing: GearMarketplaceListing) => void;
  onRemoveFromQuote: (listingId: string) => void;
}

function GroupedListingsContent({
  organizations,
  total,
  isLoading,
  viewMode,
  selectedItems,
  onViewListing,
  onAddToQuote,
  onRemoveFromQuote,
}: GroupedListingsContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
        <Package className="mb-4 h-12 w-12 text-muted-gray" />
        <h3 className="mb-2 text-lg font-medium text-bone-white">No listings found</h3>
        <p className="text-sm text-muted-gray">
          Try adjusting your search filters or check back later for new listings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-gray">
        {total} listings from {organizations.length} rental house{organizations.length !== 1 ? 's' : ''}
      </p>

      {organizations.map((org) => (
        <div key={org.id} className="space-y-3">
          {/* Organization Header */}
          <div className="flex items-center gap-3 pb-2 border-b border-white/10">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 overflow-hidden">
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-5 w-5 text-muted-gray" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-bone-white">
                  {org.marketplace_name || org.name}
                </h3>
                {org.is_verified && (
                  <BadgeCheck className="h-4 w-4 text-accent-yellow" />
                )}
                {org.is_priority && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    In Cart
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-gray">
                {org.marketplace_location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {org.marketplace_location}
                  </span>
                )}
                <span>{org.listings.length} items</span>
              </div>
            </div>
          </div>

          {/* Organization Listings */}
          <div
            className={cn(
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'flex flex-col gap-3'
            )}
          >
            {org.listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                viewMode={viewMode}
                isSelected={selectedItems.some((item) => item.id === listing.id)}
                onView={() => onViewListing(listing)}
                onAddToQuote={() => onAddToQuote(listing)}
                onRemoveFromQuote={() => onRemoveFromQuote(listing.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// RENTAL HOUSES CONTENT
// ============================================================================

interface RentalHouse {
  id: string;
  name: string;
  marketplace_name?: string;
  logo_url?: string;
  lister_type?: ListerType;
  is_verified: boolean;
  marketplace_location?: string;
  listing_count: number;
  successful_rentals_count: number;
}

interface RentalHousesContentProps {
  organizations: RentalHouse[];
  isLoading: boolean;
}

function RentalHousesContent({ organizations, isLoading }: RentalHousesContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
        <Store className="mb-4 h-12 w-12 text-muted-gray" />
        <h3 className="mb-2 text-lg font-medium text-bone-white">No rental houses found</h3>
        <p className="text-sm text-muted-gray">
          There are currently no rental houses or production companies listing equipment.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {organizations.map((org) => (
        <Card
          key={org.id}
          className="cursor-pointer border-white/10 bg-white/5 transition-colors hover:border-white/20"
        >
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <Store className="h-6 w-6 text-muted-gray" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">
                  {org.marketplace_name || org.name}
                </CardTitle>
                {org.is_verified && (
                  <BadgeCheck className="h-4 w-4 text-accent-yellow" />
                )}
              </div>
              <CardDescription className="flex items-center gap-1 text-xs">
                {org.lister_type === 'rental_house' && 'Rental House'}
                {org.lister_type === 'production_company' && 'Production Company'}
                {org.lister_type === 'individual' && 'Individual'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-muted-gray">
                <MapPin className="h-3.5 w-3.5" />
                {org.marketplace_location || 'Location not specified'}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div>
                <span className="font-semibold text-bone-white">{org.listing_count}</span>
                <span className="ml-1 text-muted-gray">listings</span>
              </div>
              <div>
                <span className="font-semibold text-bone-white">{org.successful_rentals_count}</span>
                <span className="ml-1 text-muted-gray">rentals</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default MarketplaceView;
