/**
 * CommunityMarketplaceTab - Browse gear and space rentals from the community
 * Embedded marketplace browser for the Community page with location-based search
 * Supports toggling between Gear House and Set House listings
 */
import React, { useState } from 'react';
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
  Plus,
  Map,
  Wrench,
  Building2,
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
import { cn } from '@/lib/utils';

// Gear House imports
import {
  useMarketplaceSearch,
  useMarketplaceNearbySearch,
  useCommunityMarketplaceLocation,
} from '@/hooks/gear/useGearMarketplace';
import { ListingCard } from '@/components/gear/marketplace/ListingCard';
import { ListingDetailDialog } from '@/components/gear/marketplace/ListingDetailDialog';
import { RequestQuoteDialog } from '@/components/gear/marketplace/RequestQuoteDialog';
import MarketplaceLocationBar from '@/components/gear/marketplace/MarketplaceLocationBar';
import MarketplaceMapView from '@/components/gear/marketplace/MarketplaceMapView';
import GearHouseCard from '@/components/gear/marketplace/GearHouseCard';
import type {
  GearMarketplaceListing,
  GearMarketplaceSearchFilters,
  ListerType,
  ViewMode,
  RadiusMiles,
  MarketplaceOrganizationEnriched as GearMarketplaceOrganizationEnriched,
} from '@/types/gear';

// Set House imports
import {
  useSetHouseMarketplaceSearch,
  useSetHouseMarketplaceNearbySearch,
} from '@/hooks/set-house/useSetHouseMarketplace';
import { SetHouseListingCard } from '@/components/set-house/marketplace';

import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QuickAddGearDialog } from '@/components/gear/lite/QuickAddGearDialog';
import { QuickAddSpaceDialog } from '@/components/gear/lite/QuickAddSpaceDialog';

type RentalType = 'gear' | 'sets';
type SearchMode = 'all' | 'nearby';

const CommunityMarketplaceTab: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Rental type toggle (gear vs sets)
  const [rentalType, setRentalType] = useState<RentalType>('gear');

  // Search mode — default to "all" so listings appear immediately without location
  const [searchMode, setSearchMode] = useState<SearchMode>('all');

  // Location and preferences from community hook (called unconditionally per hooks rules)
  const {
    currentLocation,
    profileLocation,
    preferences,
    requestBrowserLocation,
    setManualLocation,
    initializeLocation,
    isUpdating,
    updatePreferences,
  } = useCommunityMarketplaceLocation();

  // View mode from preferences or default to grid
  const viewMode: ViewMode = preferences?.view_mode || 'grid';
  const radiusMiles: RadiusMiles = preferences?.search_radius_miles || 50;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [listerTypeFilter, setListerTypeFilter] = useState<ListerType | ''>('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // List Gear modal
  const [showListGearDialog, setShowListGearDialog] = useState(false);
  const [showListSpaceDialog, setShowListSpaceDialog] = useState(false);

  // Dialog state
  const [selectedListing, setSelectedListing] = useState<GearMarketplaceListing | null>(null);
  const [selectedGearHouse, setSelectedGearHouse] = useState<GearMarketplaceOrganizationEnriched | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState<GearMarketplaceListing[]>([]);

  // Location-based search — only active in 'nearby' mode with a valid location
  const nearbySearch = useMarketplaceNearbySearch(
    searchMode === 'nearby' && currentLocation
      ? {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          radius_miles: radiusMiles,
          result_mode: 'gear_houses',
          q: searchQuery || undefined,
          lister_type: listerTypeFilter || undefined,
          verified_only: verifiedOnly || undefined,
        }
      : null
  );

  // All-listings search — only active in 'all' mode
  const allSearch = useMarketplaceSearch(
    {
      search: searchQuery || undefined,
      listing_type: 'rent',
      lister_type: listerTypeFilter || undefined,
      verified_only: verifiedOnly || undefined,
    },
    { enabled: searchMode === 'all' }
  );

  const gearHouses = nearbySearch.gearHouses;
  const listings = allSearch.listings;
  const gearTotal = searchMode === 'all' ? allSearch.total : nearbySearch.total;
  const isGearLoading = searchMode === 'all' ? allSearch.isLoading : nearbySearch.isLoading;

  // Set Marketplace — individual space listings
  const setAllSearch = useSetHouseMarketplaceSearch({
    search: searchQuery || undefined,
    limit: 30,
  });

  const setNearbySearch = useSetHouseMarketplaceNearbySearch({
    lat: currentLocation?.latitude ?? 0,
    lng: currentLocation?.longitude ?? 0,
    limit: 30,
  });

  const setListings =
    searchMode === 'nearby'
      ? (setNearbySearch.data?.listings ?? [])
      : (setAllSearch.data?.listings ?? []);

  const isSetHouseLoading =
    searchMode === 'nearby' ? setNearbySearch.isLoading : setAllSearch.isLoading;

  // Unified loading and data based on rental type
  const isLoading = rentalType === 'gear' ? isGearLoading : isSetHouseLoading;
  const total = rentalType === 'gear' ? gearTotal : setListings.length;

  // Handle "Near Me" click — trigger location detection only on explicit request
  const handleNearMeClick = async () => {
    setSearchMode('nearby');
    if (!currentLocation) {
      await initializeLocation();
    }
  };

  // Handle view mode change
  const handleViewModeChange = (mode: ViewMode) => {
    updatePreferences.mutate({ view_mode: mode });
  };

  // Handle radius change
  const handleRadiusChange = (radius: RadiusMiles) => {
    updatePreferences.mutate({ search_radius_miles: radius });
  };

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
  };

  const handleListYourGear = () => {
    setShowListGearDialog(true);
  };

  const handleListYourSpace = () => {
    setShowListSpaceDialog(true);
  };

  const handleViewGearHouse = (gearHouse: GearMarketplaceOrganizationEnriched) => {
    navigate(`/community/gear-house/${gearHouse.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-bone-white">
            {rentalType === 'gear' ? 'Gear Marketplace' : 'Space Marketplace'}
          </h2>
          <p className="text-muted-gray">
            {rentalType === 'gear'
              ? 'Rent professional equipment from filmmakers in your community'
              : 'Book studio spaces and locations from your community'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Rental Type Toggle */}
          <div className="flex rounded-md border border-muted-gray/30 p-0.5">
            <Button
              variant={rentalType === 'gear' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRentalType('gear')}
              className={cn(
                'gap-1.5',
                rentalType === 'gear' && 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
              )}
            >
              <Wrench className="h-4 w-4" />
              Gear
            </Button>
            <Button
              variant={rentalType === 'sets' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setRentalType('sets')}
              className={cn(
                'gap-1.5',
                rentalType === 'sets' && 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
              )}
            >
              <Building2 className="h-4 w-4" />
              Set Marketplace
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quoteItems.length > 0 && (
            <Button onClick={() => setIsQuoteDialogOpen(true)} variant="default">
              Request Quote ({quoteItems.length})
            </Button>
          )}
          {user && rentalType === 'gear' && (
            <Button onClick={handleListYourGear} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              List Your Gear
            </Button>
          )}
          {user && rentalType === 'sets' && (
            <Button onClick={handleListYourSpace} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              List Your Space
            </Button>
          )}
        </div>
      </div>

      {/* Location Bar — only visible in nearby mode */}
      {searchMode === 'nearby' && (
        <MarketplaceLocationBar
          currentLocation={currentLocation}
          radiusMiles={radiusMiles}
          onRadiusChange={handleRadiusChange}
          onRequestBrowserLocation={requestBrowserLocation}
          onSetManualLocation={setManualLocation}
          isUpdating={isUpdating}
        />
      )}

      {/* Search & Filters */}
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
          {/* All / Near Me toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            <button
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                searchMode === 'all'
                  ? 'bg-white/15 text-bone-white'
                  : 'text-muted-gray hover:text-bone-white'
              )}
              onClick={() => setSearchMode('all')}
            >
              All
            </button>
            <button
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                searchMode === 'nearby'
                  ? 'bg-white/15 text-bone-white'
                  : 'text-muted-gray hover:text-bone-white'
              )}
              onClick={handleNearMeClick}
            >
              <MapPin className="w-3 h-3" />
              Near Me
            </button>
          </div>

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

          {/* Map/grid/list toggles — only in nearby mode */}
          {searchMode === 'nearby' && (
            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
              <Button
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleViewModeChange('map')}
                title="Map view"
              >
                <Map className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleViewModeChange('grid')}
                title="Grid view"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleViewModeChange('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Grid/list toggles in all mode (no map) */}
          {searchMode === 'all' && (
            <div className="flex items-center gap-1 border-l border-white/10 pl-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleViewModeChange('grid')}
                title="Grid view"
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleViewModeChange('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading && rentalType === 'sets' ? (
        // Skeleton grid for Set Houses
        <div className="space-y-4">
          <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-white/10" />
                    <div className="h-3 w-1/2 rounded bg-white/10" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-white/10" />
                  <div className="h-5 w-20 rounded-full bg-white/10" />
                </div>
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div className="h-3 w-24 rounded bg-white/10" />
                  <div className="h-3 w-16 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
        </div>
      ) : rentalType === 'gear' ? (
        // Gear Content
        <>
          {searchMode === 'nearby' && !currentLocation ? (
            // Detecting location state
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-muted-gray" />
              <p className="text-sm text-muted-gray">Detecting your location…</p>
              <p className="text-xs text-muted-gray mt-1">
                Or{' '}
                <button
                  className="underline hover:text-bone-white transition-colors"
                  onClick={() => setManualLocation({ latitude: 0, longitude: 0, display_name: '' })}
                >
                  enter a location manually
                </button>
              </p>
            </div>
          ) : searchMode === 'nearby' && viewMode === 'map' && currentLocation ? (
            // Map View (nearby mode only)
            <div className="h-[500px]">
              <MarketplaceMapView
                gearHouses={gearHouses}
                userLocation={currentLocation}
                radiusMiles={radiusMiles}
                onViewGearHouse={handleViewGearHouse}
              />
            </div>
          ) : searchMode === 'nearby' && gearHouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
              <Package className="mb-4 h-12 w-12 text-muted-gray" />
              <h3 className="mb-2 text-lg font-medium text-bone-white">No gear houses found nearby</h3>
              <p className="text-sm text-muted-gray mb-4">
                Try increasing your search radius or check back later for new listings.
              </p>
              {user && (
                <Button onClick={handleListYourGear} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Be the first to list gear
                </Button>
              )}
            </div>
          ) : searchMode === 'nearby' ? (
            // Grid/List View with Gear Houses (nearby mode)
            <div className="space-y-4">
              <p className="text-sm text-muted-gray">
                Showing {gearHouses.length} gear house{gearHouses.length !== 1 ? 's' : ''} within {radiusMiles} miles
              </p>

              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                    : 'flex flex-col gap-3'
                )}
              >
                {gearHouses.map((gearHouse) => (
                  <GearHouseCard
                    key={gearHouse.id}
                    gearHouse={gearHouse}
                    onViewInventory={() => handleViewGearHouse(gearHouse)}
                    onToggleFavorite={() => {}}
                  />
                ))}
              </div>
            </div>
          ) : listings.length === 0 ? (
            // All mode — no results
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
              <Package className="mb-4 h-12 w-12 text-muted-gray" />
              <h3 className="mb-2 text-lg font-medium text-bone-white">No rentals found</h3>
              <p className="text-sm text-muted-gray mb-4">
                Try adjusting your search filters or check back later for new listings.
              </p>
              {user && (
                <Button onClick={handleListYourGear} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Be the first to list gear
                </Button>
              )}
            </div>
          ) : (
            // All mode — listing grid
            <div className="space-y-4">
              <p className="text-sm text-muted-gray">
                Showing {listings.length} of {total} rentals
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
                    viewMode={viewMode === 'map' ? 'grid' : viewMode}
                    onView={() => handleViewListing(listing)}
                    useCart={true}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        // Set House Content — individual space listing cards
        <>
          {setListings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
              <Building2 className="mb-4 h-12 w-12 text-muted-gray" />
              <h3 className="mb-2 text-lg font-medium text-bone-white">No spaces listed yet</h3>
              <p className="text-sm text-muted-gray mb-4">
                {searchMode === 'nearby'
                  ? 'No spaces found near you. Try expanding your search or browse all spaces.'
                  : 'Be the first to list a space on the Set Marketplace.'}
              </p>
              {user && (
                <Button onClick={handleListYourSpace} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  List Your Space
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-gray">
                Showing {setListings.length} space{setListings.length !== 1 ? 's' : ''}
                {searchMode === 'nearby' ? ' nearby' : ' on the Set Marketplace'}
              </p>
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                    : 'flex flex-col gap-3'
                )}
              >
                {setListings.map((listing) => (
                  <SetHouseListingCard
                    key={listing.id}
                    listing={listing as any}
                    viewMode={viewMode === 'map' ? 'grid' : viewMode}
                    onView={() => navigate(`/set-house/listing/${listing.id}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
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
        onRemoveItem={handleRemoveFromQuote}
        onSubmitted={handleQuoteSubmitted}
      />

      {/* List Gear Dialog */}
      <QuickAddGearDialog
        open={showListGearDialog}
        onClose={() => setShowListGearDialog(false)}
        onSuccess={() => {
          setShowListGearDialog(false);
          // allSearch auto-refreshes via ['marketplace-search'] invalidation in useQuickAddAsset
        }}
      />

      {/* List Space Dialog */}
      <QuickAddSpaceDialog
        open={showListSpaceDialog}
        onClose={() => setShowListSpaceDialog(false)}
        onSuccess={() => setShowListSpaceDialog(false)}
      />
    </div>
  );
};

export default CommunityMarketplaceTab;
