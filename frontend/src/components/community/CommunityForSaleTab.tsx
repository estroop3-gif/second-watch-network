/**
 * CommunityForSaleTab - Browse gear for sale from the community
 * Embedded for-sale browser for the Community page with All/Near Me toggle
 */
import React, { useState } from 'react';
import {
  Search,
  Grid,
  List,
  BadgeCheck,
  Loader2,
  Tag,
  DollarSign,
  Map,
  MapPin,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SaleListingCard } from '@/components/gear/marketplace/SaleListingCard';
import MarketplaceLocationBar from '@/components/gear/marketplace/MarketplaceLocationBar';
import MarketplaceMapView from '@/components/gear/marketplace/MarketplaceMapView';
import GearHouseCard from '@/components/gear/marketplace/GearHouseCard';
import type {
  GearMarketplaceListing,
  SaleCondition,
  ViewMode,
  RadiusMiles,
  ListerType,
  MarketplaceOrganizationEnriched,
} from '@/types/gear';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { QuickAddGearDialog } from '@/components/gear/lite/QuickAddGearDialog';

type SearchMode = 'all' | 'nearby';

const CommunityForSaleTab: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showSellDialog, setShowSellDialog] = useState(false);

  // Search mode — default to "all" so listings appear immediately without location
  const [searchMode, setSearchMode] = useState<SearchMode>('all');

  // Location and preferences from community hook
  const {
    currentLocation,
    preferences,
    requestBrowserLocation,
    setManualLocation,
    isUpdating,
    updatePreferences,
  } = useCommunityMarketplaceLocation();

  // View mode from preferences or default to grid
  const viewMode: ViewMode = preferences?.view_mode || 'grid';
  const radiusMiles: RadiusMiles = preferences?.search_radius_miles || 50;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<SaleCondition | ''>('');
  const [listerTypeFilter, setListerTypeFilter] = useState<ListerType | ''>('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // All mode: flat search without location requirement
  const allSearch = useMarketplaceSearch(
    {
      listing_type: 'sale',
      search: searchQuery || undefined,
      condition: conditionFilter || undefined,
      lister_type: listerTypeFilter || undefined,
      verified_only: verifiedOnly || undefined,
    },
    { enabled: searchMode === 'all' }
  );

  // Nearby mode: location-based search (only when location is available)
  const nearbySearch = useMarketplaceNearbySearch(
    searchMode === 'nearby' && currentLocation
      ? {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          radius_miles: radiusMiles,
          result_mode: 'listings',
          listing_type: 'sale',
          q: searchQuery || undefined,
          condition: conditionFilter || undefined,
          lister_type: listerTypeFilter || undefined,
          verified_only: verifiedOnly || undefined,
        }
      : null
  );

  // Active data based on search mode
  const gearHouses = nearbySearch.gearHouses;
  const listings: GearMarketplaceListing[] =
    searchMode === 'all' ? allSearch.listings : nearbySearch.listings;
  const total = searchMode === 'all' ? allSearch.total : nearbySearch.total;
  const isLoading = searchMode === 'all' ? allSearch.isLoading : nearbySearch.isLoading;

  // Handle view mode change
  const handleViewModeChange = (mode: ViewMode) => {
    updatePreferences.mutate({ view_mode: mode });
  };

  // Handle radius change
  const handleRadiusChange = (radius: RadiusMiles) => {
    updatePreferences.mutate({ search_radius_miles: radius });
  };

  const handleViewListing = (listing: GearMarketplaceListing) => {
    navigate(`/gear/listing/${listing.id}`);
  };

  const handleViewGearHouse = (gearHouse: MarketplaceOrganizationEnriched) => {
    navigate(`/community/gear-house/${gearHouse.id}`);
  };

  const handleSellYourGear = () => {
    setShowSellDialog(true);
  };

  const handleSearchModeChange = (mode: SearchMode) => {
    if (mode === 'nearby' && !currentLocation) {
      // Request location when switching to nearby mode
      requestBrowserLocation();
    }
    setSearchMode(mode);
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

      {/* All / Near Me Toggle */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 w-fit">
        <button
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            searchMode === 'all'
              ? 'bg-white/15 text-bone-white'
              : 'text-muted-gray hover:text-bone-white'
          )}
          onClick={() => handleSearchModeChange('all')}
        >
          All
        </button>
        <button
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            searchMode === 'nearby'
              ? 'bg-white/15 text-bone-white'
              : 'text-muted-gray hover:text-bone-white'
          )}
          onClick={() => handleSearchModeChange('nearby')}
        >
          <MapPin className="h-3.5 w-3.5" />
          Near Me
        </button>
      </div>

      {/* Location Bar — only visible in Near Me mode */}
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
            placeholder="Search equipment for sale..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={conditionFilter}
            onValueChange={(value) =>
              setConditionFilter(value === 'all' ? '' : (value as SaleCondition))
            }
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

          <Select
            value={listerTypeFilter}
            onValueChange={(value) =>
              setListerTypeFilter(value === 'all' ? '' : (value as ListerType))
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Seller Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sellers</SelectItem>
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
      ) : viewMode === 'map' && searchMode === 'nearby' && currentLocation ? (
        // Map View — show gear houses with items for sale
        <div className="h-[500px]">
          <MarketplaceMapView
            gearHouses={gearHouses}
            userLocation={currentLocation}
            radiusMiles={radiusMiles}
            onViewGearHouse={handleViewGearHouse}
          />
        </div>
      ) : searchMode === 'nearby' && !currentLocation ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
          <MapPin className="mb-4 h-12 w-12 text-muted-gray" />
          <h3 className="mb-2 text-lg font-medium text-bone-white">Location required</h3>
          <p className="text-sm text-muted-gray mb-4">
            Allow location access or switch to "All" to browse without a location.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSearchMode('all')}>
              Browse All
            </Button>
            <Button onClick={requestBrowserLocation}>
              Use My Location
            </Button>
          </div>
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-16">
          <Tag className="mb-4 h-12 w-12 text-muted-gray" />
          <h3 className="mb-2 text-lg font-medium text-bone-white">No items for sale</h3>
          <p className="text-sm text-muted-gray mb-4">
            {searchMode === 'nearby'
              ? 'Try increasing your search radius or check back later for new listings.'
              : 'Try adjusting your search filters.'}
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
            {searchMode === 'nearby'
              ? `Showing ${listings.length} item${listings.length !== 1 ? 's' : ''} for sale within ${radiusMiles} miles`
              : `Showing ${listings.length} of ${total} items for sale`}
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
                viewMode={viewMode === 'map' ? 'grid' : viewMode}
                onView={() => handleViewListing(listing)}
              />
            ))}
          </div>
        </div>
      )}
      <QuickAddGearDialog
        open={showSellDialog}
        onClose={() => setShowSellDialog(false)}
        defaultListingType="sale"
        onSuccess={() => setShowSellDialog(false)}
      />
    </div>
  );
};

export default CommunityForSaleTab;
