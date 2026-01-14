/**
 * CommunityMarketplaceTab - Browse gear rentals from the community
 * Embedded marketplace browser for the Community page with location-based search
 */
import React, { useState, useEffect } from 'react';
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
  MarketplaceOrganizationEnriched,
} from '@/types/gear';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CommunityMarketplaceTab: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Location and preferences from community hook
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

  // Dialog state
  const [selectedListing, setSelectedListing] = useState<GearMarketplaceListing | null>(null);
  const [selectedGearHouse, setSelectedGearHouse] = useState<MarketplaceOrganizationEnriched | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false);
  const [quoteItems, setQuoteItems] = useState<GearMarketplaceListing[]>([]);

  // Initialize location on mount
  useEffect(() => {
    if (!currentLocation) {
      initializeLocation();
    }
  }, []);

  // Location-based search (when location is available)
  const nearbySearch = useMarketplaceNearbySearch(
    currentLocation
      ? {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          radius_miles: radiusMiles,
          result_mode: 'gear_houses', // Show gear houses for rentals
          q: searchQuery || undefined,
          lister_type: listerTypeFilter || undefined,
          verified_only: verifiedOnly || undefined,
        }
      : null
  );

  // Fallback search when no location
  const fallbackFilters: GearMarketplaceSearchFilters = {
    search: searchQuery || undefined,
    listing_type: 'rent',
    lister_type: listerTypeFilter || undefined,
    verified_only: verifiedOnly || undefined,
  };
  const fallbackSearch = useMarketplaceSearch(fallbackFilters, { enabled: !currentLocation });

  // Use nearby results when we have location, otherwise fallback
  const gearHouses = nearbySearch.gearHouses;
  const listings = fallbackSearch.listings;
  const total = currentLocation ? nearbySearch.total : fallbackSearch.total;
  const isLoading = currentLocation ? nearbySearch.isLoading : fallbackSearch.isLoading;

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
    // Navigate to My Gear (lite) for simplified listing flow
    navigate('/my-gear');
  };

  const handleViewGearHouse = (gearHouse: MarketplaceOrganizationEnriched) => {
    // Navigate to gear house profile
    navigate(`/community/gear-house/${gearHouse.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-bone-white">Gear Marketplace</h2>
          <p className="text-muted-gray">
            Rent professional equipment from filmmakers in your community
          </p>
        </div>

        <div className="flex items-center gap-2">
          {quoteItems.length > 0 && (
            <Button onClick={() => setIsQuoteDialogOpen(true)} variant="default">
              Request Quote ({quoteItems.length})
            </Button>
          )}
          {user && (
            <Button onClick={handleListYourGear} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              List Your Gear
            </Button>
          )}
        </div>
      </div>

      {/* Location Bar */}
      <MarketplaceLocationBar
        currentLocation={currentLocation}
        radiusMiles={radiusMiles}
        onRadiusChange={handleRadiusChange}
        onRequestBrowserLocation={requestBrowserLocation}
        onSetManualLocation={setManualLocation}
        isUpdating={isUpdating}
      />

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
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
        </div>
      ) : viewMode === 'map' && currentLocation ? (
        // Map View
        <div className="h-[500px]">
          <MarketplaceMapView
            gearHouses={gearHouses}
            userLocation={currentLocation}
            radiusMiles={radiusMiles}
            onViewGearHouse={handleViewGearHouse}
          />
        </div>
      ) : currentLocation && gearHouses.length === 0 ? (
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
      ) : currentLocation ? (
        // Grid/List View with Gear Houses (location-based)
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
                onView={() => handleViewGearHouse(gearHouse)}
                viewMode={viewMode === 'list' ? 'list' : 'grid'}
              />
            ))}
          </div>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
          <Package className="mb-4 h-12 w-12 text-muted-gray" />
          <h3 className="mb-2 text-lg font-medium text-bone-white">No rentals found</h3>
          <p className="text-sm text-muted-gray mb-4">
            Set your location to find gear houses near you, or try adjusting your search filters.
          </p>
          {user && (
            <Button onClick={handleListYourGear} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Be the first to list gear
            </Button>
          )}
        </div>
      ) : (
        // Fallback to listings when no location (legacy behavior)
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
    </div>
  );
};

export default CommunityMarketplaceTab;
