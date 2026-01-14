/**
 * MarketplaceBrowserSection.tsx
 * Embedded marketplace browser for Backlot Gear tab
 *
 * Features location-based search with:
 * - Proximity search with radius filtering
 * - Map/Grid/List view modes
 * - Gear Houses / Gear Items result modes
 * - Favorites management
 * - Delivery eligibility filtering
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Package,
  Store,
  BadgeCheck,
  Check,
  X,
  Loader2,
  Calendar,
  DollarSign,
  Link2,
  Send,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  MapPin,
  Info,
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

import {
  useMarketplaceSearch,
  useCreateRentalRequest,
  useMarketplaceLocation,
  useMarketplacePreferences,
  useGearHouseFavorites,
  useMarketplaceNearbySearch,
} from '@/hooks/gear/useGearMarketplace';
import { useGearCategories, useGearOrganization } from '@/hooks/gear';
import {
  MarketplaceLocationBar,
  GearHouseCard,
  GearHouseListItem,
  MarketplaceViewToggle,
  MarketplaceResultModeToggle,
  DeliveryFilterToggle,
  GearHouseDrawer,
  MarketplaceFavoritesSection,
  MarketplaceMapView,
} from '@/components/gear/marketplace';
import type {
  GearMarketplaceListing,
  GearMarketplaceSearchFilters,
  MarketplaceOrganizationEnriched,
  ViewMode,
  ResultMode,
  RadiusMiles,
} from '@/types/gear';

interface BudgetLineItem {
  id: string;
  description: string;
  estimated_total?: number;
  category?: string;
}

interface MarketplaceBrowserSectionProps {
  projectId: string;
  budgetLineItems: BudgetLineItem[];
  onClose: () => void;
  onRequestSuccess?: () => void;
}

export function MarketplaceBrowserSection({
  projectId,
  budgetLineItems,
  onClose,
  onRequestSuccess,
}: MarketplaceBrowserSectionProps) {
  // View state
  const [isExpanded, setIsExpanded] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dateRange, setDateRange] = useState<{
    available_from?: string;
    available_to?: string;
  }>({});

  // Location-based search state
  const [selectedGearHouse, setSelectedGearHouse] = useState<MarketplaceOrganizationEnriched | null>(null);
  const [isLocationInitialized, setIsLocationInitialized] = useState(false);

  // Selected items
  const [selectedItems, setSelectedItems] = useState<GearMarketplaceListing[]>([]);

  // Request form state
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = addDays(new Date(), 1);
    return format(tomorrow, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    const nextWeek = addDays(new Date(), 8);
    return format(nextWeek, 'yyyy-MM-dd');
  });
  const [notes, setNotes] = useState('');
  const [budgetLineItemId, setBudgetLineItemId] = useState<string>('');
  const [autoCreateBudgetLine, setAutoCreateBudgetLine] = useState(true);

  // Location-based search hooks
  const {
    currentLocation,
    requestBrowserLocation,
    setManualLocation,
    initializeLocation,
    isUpdating: isLocationUpdating,
  } = useMarketplaceLocation(projectId);

  const {
    preferences,
    updatePreferences,
  } = useMarketplacePreferences(projectId);

  const {
    favorites,
    addFavorite,
    removeFavorite,
  } = useGearHouseFavorites(projectId);

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Nearby search params
  const nearbySearchParams = currentLocation ? {
    lat: currentLocation.latitude,
    lng: currentLocation.longitude,
    radius_miles: (preferences?.search_radius_miles || 50) as RadiusMiles,
    result_mode: (preferences?.result_mode || 'gear_houses') as ResultMode,
    delivery_to_me_only: preferences?.delivery_to_me_only || false,
    q: searchQuery || undefined,
    category_id: categoryFilter || undefined,
    verified_only: verifiedOnly || undefined,
    available_from: dateRange.available_from,
    available_to: dateRange.available_to,
    timezone: userTimezone,
  } : null;

  const {
    gearHouses,
    listings: nearbyListings,
    total: nearbyTotal,
    isLoading: isNearbyLoading,
  } = useMarketplaceNearbySearch(nearbySearchParams);

  // Initialize location on mount
  useEffect(() => {
    if (!isLocationInitialized && !currentLocation) {
      initializeLocation().then(() => {
        setIsLocationInitialized(true);
      });
    }
  }, [isLocationInitialized, currentLocation, initializeLocation]);

  // Use the first selected org for categories
  const firstOrgId = selectedItems[0]?.organization_id;
  const { categories } = useGearCategories(firstOrgId || '');
  const { organization: userOrg } = useGearOrganization(null);

  // Build filters for fallback non-location search
  const filters: GearMarketplaceSearchFilters = {
    search: searchQuery || undefined,
    category_id: categoryFilter || undefined,
    verified_only: verifiedOnly || undefined,
    available_from: dateRange.available_from,
    available_to: dateRange.available_to,
    timezone: userTimezone,
  };

  // Data fetching (fallback when no location)
  const { listings: fallbackListings, isLoading: isFallbackLoading } = useMarketplaceSearch(filters);

  // Determine which listings to use
  const isLocationMode = !!currentLocation;
  const listings = isLocationMode ? nearbyListings : fallbackListings;
  const isLoading = isLocationMode ? isNearbyLoading : isFallbackLoading;

  const { mutate: createRequest, isPending: isSubmitting } = useCreateRentalRequest();

  // View and result mode from preferences
  const viewMode = (preferences?.view_mode || 'grid') as ViewMode;
  const resultMode = (preferences?.result_mode || 'gear_houses') as ResultMode;
  const radiusMiles = (preferences?.search_radius_miles || 50) as RadiusMiles;
  const deliveryToMeOnly = preferences?.delivery_to_me_only || false;

  // Handle preference updates
  const handleViewModeChange = (mode: ViewMode) => {
    updatePreferences.mutate({ view_mode: mode });
  };

  const handleResultModeChange = (mode: ResultMode) => {
    updatePreferences.mutate({ result_mode: mode });
  };

  const handleRadiusChange = (radius: RadiusMiles) => {
    updatePreferences.mutate({ search_radius_miles: radius });
  };

  const handleDeliveryFilterChange = (enabled: boolean) => {
    updatePreferences.mutate({ delivery_to_me_only: enabled });
  };

  // Handle favorites
  const handleToggleFavorite = (orgId: string, isFavorited: boolean) => {
    if (isFavorited) {
      addFavorite.mutate({ orgId });
    } else {
      removeFavorite.mutate(orgId);
    }
  };

  // Handle gear house selection
  const handleViewGearHouse = (gearHouse: MarketplaceOrganizationEnriched) => {
    setSelectedGearHouse(gearHouse);
  };

  // Calculate rental days
  const rentalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const days = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
    return Math.max(0, days);
  }, [startDate, endDate]);

  // Estimate total
  const estimatedTotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      return sum + (item.daily_rate || 0) * rentalDays;
    }, 0);
  }, [selectedItems, rentalDays]);

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleSelectItem = (listing: GearMarketplaceListing) => {
    setSelectedItems((prev) => {
      if (prev.find((item) => item.id === listing.id)) {
        return prev.filter((item) => item.id !== listing.id);
      }
      return [...prev, listing];
    });
  };

  const handleRemoveItem = (listingId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== listingId));
  };

  const handleProceedToRequest = () => {
    if (selectedItems.length === 0) return;

    // Sync dates from search filters to request form
    // If only one date is selected, use it for both start and end (single-day rental)
    const fromDate = dateRange.available_from?.trim();
    const toDate = dateRange.available_to?.trim();

    if (fromDate || toDate) {
      if (fromDate && !toDate) {
        // Only start date provided - use same date for end
        setStartDate(fromDate);
        setEndDate(fromDate);
      } else if (!fromDate && toDate) {
        // Only end date provided - use same date for start
        setStartDate(toDate);
        setEndDate(toDate);
      } else if (fromDate && toDate) {
        // Both dates provided - use as is
        setStartDate(fromDate);
        setEndDate(toDate);
      }
    }

    setShowRequestForm(true);
  };

  const handleBackToBrowse = () => {
    setShowRequestForm(false);
  };

  const handleSubmit = () => {
    if (!startDate || !endDate || selectedItems.length === 0) return;

    const rentalHouseOrgId = selectedItems[0].organization_id;

    // Auto-generate title from item count
    const generatedTitle = `${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} requested`;

    createRequest(
      {
        rental_house_org_id: rentalHouseOrgId,
        backlot_project_id: projectId,
        budget_line_item_id: budgetLineItemId || undefined,
        auto_create_budget_line: autoCreateBudgetLine,
        title: generatedTitle,
        rental_start_date: startDate,
        rental_end_date: endDate,
        notes,
        items: selectedItems.map((item) => ({
          listing_id: item.id,
          asset_id: item.asset_id,
          quantity: 1,
        })),
      },
      {
        onSuccess: () => {
          setSelectedItems([]);
          setNotes('');
          setBudgetLineItemId('');
          setShowRequestForm(false);
          onRequestSuccess?.();
        },
        onError: (error: any) => {
          console.error('[Marketplace] Quote request failed:', error);
          console.error('[Marketplace] Error details:', JSON.stringify(error, null, 2));

          // Try to extract error message from various formats
          let errorMessage = 'Failed to submit request';

          if (typeof error === 'string') {
            errorMessage = error;
          } else if (error?.detail) {
            if (typeof error.detail === 'string') {
              errorMessage = error.detail;
            } else if (error.detail?.message) {
              errorMessage = error.detail.message;
              if (error.detail?.unavailable_items?.length > 0) {
                errorMessage += '\nUnavailable items:\n' +
                  error.detail.unavailable_items.map((item: any) => `- ${item.reason}`).join('\n');
              }
            } else {
              errorMessage = JSON.stringify(error.detail);
            }
          } else if (error?.message) {
            errorMessage = error.message;
          }

          alert(`Error: ${errorMessage}`);
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedItems([]);
    setShowRequestForm(false);
    onClose();
  };

  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5">
      {/* Header */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center gap-3 hover:bg-white/5 transition-colors rounded-lg -ml-2 pl-2 py-1"
            >
              <Store className="h-5 w-5 text-blue-400" />
              <div className="text-left">
                <h3 className="font-medium text-bone-white">
                  {showRequestForm ? 'Request Quote' : 'Rent from Marketplace'}
                </h3>
                <p className="text-xs text-muted-gray">
                  {showRequestForm
                    ? `${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} selected`
                    : 'Browse equipment from verified rental houses'}
                </p>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && !showRequestForm && (
              <Badge
                variant="outline"
                className="border-accent-yellow/50 bg-accent-yellow/10 text-accent-yellow"
              >
                <ShoppingCart className="mr-1 h-3 w-3" />
                {selectedItems.length}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 text-muted-gray hover:text-bone-white"
            >
              <X className="h-4 w-4" />
            </Button>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-gray" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-gray" />
                )}
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <Separator className="bg-white/10" />

          {showRequestForm ? (
            <RequestForm
              selectedItems={selectedItems}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              notes={notes}
              setNotes={setNotes}
              budgetLineItemId={budgetLineItemId}
              setBudgetLineItemId={setBudgetLineItemId}
              autoCreateBudgetLine={autoCreateBudgetLine}
              setAutoCreateBudgetLine={setAutoCreateBudgetLine}
              budgetLineItems={budgetLineItems}
              rentalDays={rentalDays}
              estimatedTotal={estimatedTotal}
              onRemoveItem={handleRemoveItem}
              onBack={handleBackToBrowse}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              formatPrice={formatPrice}
              dateRange={dateRange}
            />
          ) : (
            <BrowseContent
              // Location-based search props
              isLocationMode={isLocationMode}
              currentLocation={currentLocation}
              radiusMiles={radiusMiles}
              viewMode={viewMode}
              resultMode={resultMode}
              deliveryToMeOnly={deliveryToMeOnly}
              gearHouses={gearHouses}
              favorites={favorites}
              onRequestBrowserLocation={requestBrowserLocation}
              onSetManualLocation={setManualLocation}
              onRadiusChange={handleRadiusChange}
              onViewModeChange={handleViewModeChange}
              onResultModeChange={handleResultModeChange}
              onDeliveryFilterChange={handleDeliveryFilterChange}
              onToggleFavorite={handleToggleFavorite}
              onViewGearHouse={handleViewGearHouse}
              isLocationUpdating={isLocationUpdating}
              // Existing props
              listings={listings}
              isLoading={isLoading}
              selectedItems={selectedItems}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              verifiedOnly={verifiedOnly}
              setVerifiedOnly={setVerifiedOnly}
              dateRange={dateRange}
              setDateRange={setDateRange}
              categories={categories}
              onSelectItem={handleSelectItem}
              onProceed={handleProceedToRequest}
              formatPrice={formatPrice}
            />
          )}

          {/* Gear House Drawer */}
          <GearHouseDrawer
            gearHouse={selectedGearHouse}
            open={!!selectedGearHouse}
            onOpenChange={(open) => !open && setSelectedGearHouse(null)}
            onAddToCart={handleSelectItem}
            onRemoveFromCart={handleSelectItem}
            selectedItems={selectedItems}
            onToggleFavorite={handleToggleFavorite}
            categories={categories}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ============================================================================
// BROWSE CONTENT
// ============================================================================

interface BrowseContentProps {
  // Location-based search props
  isLocationMode: boolean;
  currentLocation: { latitude: number; longitude: number; name?: string; source: string } | null;
  radiusMiles: RadiusMiles;
  viewMode: ViewMode;
  resultMode: ResultMode;
  deliveryToMeOnly: boolean;
  gearHouses: MarketplaceOrganizationEnriched[];
  favorites: Array<{ organization_id: string; [key: string]: unknown }>;
  onRequestBrowserLocation: () => Promise<unknown>;
  onSetManualLocation: (location: { latitude: number; longitude: number; name?: string }) => void;
  onRadiusChange: (radius: RadiusMiles) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onResultModeChange: (mode: ResultMode) => void;
  onDeliveryFilterChange: (enabled: boolean) => void;
  onToggleFavorite: (orgId: string, isFavorited: boolean) => void;
  onViewGearHouse: (gearHouse: MarketplaceOrganizationEnriched) => void;
  isLocationUpdating?: boolean;
  // Existing props
  listings: GearMarketplaceListing[];
  isLoading: boolean;
  selectedItems: GearMarketplaceListing[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  verifiedOnly: boolean;
  setVerifiedOnly: (value: boolean) => void;
  dateRange: { available_from?: string; available_to?: string };
  setDateRange: (value: { available_from?: string; available_to?: string }) => void;
  categories: Array<{ id: string; name: string }>;
  onSelectItem: (listing: GearMarketplaceListing) => void;
  onProceed: () => void;
  formatPrice: (price: number) => string;
}

function BrowseContent({
  // Location props
  isLocationMode,
  currentLocation,
  radiusMiles,
  viewMode,
  resultMode,
  deliveryToMeOnly,
  gearHouses,
  favorites,
  onRequestBrowserLocation,
  onSetManualLocation,
  onRadiusChange,
  onViewModeChange,
  onResultModeChange,
  onDeliveryFilterChange,
  onToggleFavorite,
  onViewGearHouse,
  isLocationUpdating,
  // Existing props
  listings,
  isLoading,
  selectedItems,
  searchQuery,
  setSearchQuery,
  categoryFilter,
  setCategoryFilter,
  verifiedOnly,
  setVerifiedOnly,
  dateRange,
  setDateRange,
  categories,
  onSelectItem,
  onProceed,
  formatPrice,
}: BrowseContentProps) {
  const showGearHouses = isLocationMode && resultMode === 'gear_houses';

  return (
    <div className="p-4 space-y-4">
      {/* Location Bar */}
      {isLocationMode && (
        <MarketplaceLocationBar
          currentLocation={currentLocation}
          radiusMiles={radiusMiles}
          onRadiusChange={onRadiusChange}
          onRequestBrowserLocation={onRequestBrowserLocation}
          onSetManualLocation={onSetManualLocation}
          isUpdating={isLocationUpdating}
        />
      )}

      {/* View Controls - Always show result mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MarketplaceResultModeToggle
          resultMode={resultMode}
          onResultModeChange={onResultModeChange}
          gearHouseCount={isLocationMode ? gearHouses.length : undefined}
          itemCount={listings.length}
        />
        <div className="flex items-center gap-2">
          {isLocationMode && (
            <DeliveryFilterToggle
              deliveryToMeOnly={deliveryToMeOnly}
              onToggle={onDeliveryFilterChange}
            />
          )}
          {isLocationMode && resultMode === 'gear_houses' && (
            <MarketplaceViewToggle
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
            />
          )}
        </div>
      </div>

      {/* Favorites Section */}
      {isLocationMode && favorites.length > 0 && (
        <MarketplaceFavoritesSection
          favorites={favorites as Array<{ id: string; organization_id: string; organization_name?: string; marketplace_name?: string; marketplace_logo_url?: string; location_display?: string; is_verified?: boolean; offers_delivery?: boolean; listing_count?: number; created_at: string; profile_id: string }>}
          onViewGearHouse={onViewGearHouse}
          onRemoveFavorite={(orgId) => onToggleFavorite(orgId, false)}
        />
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
          <Input
            placeholder={showGearHouses ? "Search gear houses..." : "Search equipment..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-[150px]">
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

        <Button
          variant={verifiedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setVerifiedOnly(!verifiedOnly)}
          className="gap-1.5"
        >
          <BadgeCheck className="h-4 w-4" />
          Verified
        </Button>
      </div>

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-gray whitespace-nowrap">Available:</Label>
        <Input
          type="date"
          value={dateRange.available_from || ''}
          onChange={(e) => setDateRange({ ...dateRange, available_from: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          placeholder="From"
          className="flex-1"
        />
        <span className="text-sm text-muted-gray">to</span>
        <Input
          type="date"
          value={dateRange.available_to || ''}
          onChange={(e) => setDateRange({ ...dateRange, available_to: e.target.value })}
          min={dateRange.available_from || new Date().toISOString().split('T')[0]}
          placeholder="To"
          className="flex-1"
        />
        {(dateRange.available_from || dateRange.available_to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDateRange({})}
            className="px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-gray" />
        </div>
      ) : resultMode === 'gear_houses' && !isLocationMode ? (
        // Gear Houses selected but no location set
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-8">
          <Store className="mb-3 h-10 w-10 text-muted-gray" />
          <h3 className="mb-1 text-sm font-medium text-bone-white">Set your location</h3>
          <p className="text-xs text-muted-gray mb-4">
            Enable location to browse nearby gear houses, or switch to "Gear for Rent" to see all listings.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRequestBrowserLocation()}
            className="gap-2"
          >
            <MapPin className="h-4 w-4" />
            Use My Location
          </Button>
        </div>
      ) : showGearHouses ? (
        // Gear Houses View
        gearHouses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-8">
            <Store className="mb-3 h-10 w-10 text-muted-gray" />
            <h3 className="mb-1 text-sm font-medium text-bone-white">No gear houses found</h3>
            <p className="text-xs text-muted-gray">
              {currentLocation ? 'Try expanding your search radius.' : 'Set your location to find nearby gear houses.'}
            </p>
          </div>
        ) : viewMode === 'map' ? (
          <div className="h-[400px]">
            <MarketplaceMapView
              gearHouses={gearHouses}
              userLocation={currentLocation}
              radiusMiles={radiusMiles}
              onViewGearHouse={onViewGearHouse}
            />
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-2">
            {gearHouses.map((gh) => (
              <GearHouseListItem
                key={gh.id}
                gearHouse={gh}
                onViewInventory={onViewGearHouse}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gearHouses.map((gh) => (
              <GearHouseCard
                key={gh.id}
                gearHouse={gh}
                onViewInventory={onViewGearHouse}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )
      ) : (
        // Listings Grid (gear items mode or fallback)
        listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-8">
            <Package className="mb-3 h-10 w-10 text-muted-gray" />
            <h3 className="mb-1 text-sm font-medium text-bone-white">No listings found</h3>
            <p className="text-xs text-muted-gray">Try adjusting your search filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing) => {
              const isSelected = selectedItems.some((item) => item.id === listing.id);
              const asset = listing.asset;

              return (
                <button
                  key={listing.id}
                  onClick={() => onSelectItem(listing)}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border p-2 text-left transition-all',
                    isSelected
                      ? 'border-accent-yellow bg-accent-yellow/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  )}
                >
                  {/* Image */}
                  <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
                    {asset?.photos?.[0] ? (
                      <img
                        src={asset.photos[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-gray" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="truncate text-xs font-medium text-bone-white">
                        {asset?.name || 'Unknown'}
                      </h4>
                      {listing.organization?.is_verified && (
                        <BadgeCheck className="h-3 w-3 flex-shrink-0 text-accent-yellow" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-gray">
                      {listing.organization?.marketplace_name || listing.organization?.name}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-bone-white">
                      {formatPrice(listing.daily_rate)}
                      <span className="font-normal text-muted-gray">/day</span>
                    </p>
                  </div>

                  {/* Selection indicator */}
                  <div
                    className={cn(
                      'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border',
                      isSelected
                        ? 'border-accent-yellow bg-accent-yellow'
                        : 'border-white/30'
                    )}
                  >
                    {isSelected && <Check className="h-2.5 w-2.5 text-charcoal-black" />}
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Footer */}
      {selectedItems.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 p-3">
          <div className="text-sm">
            <span className="font-medium text-bone-white">{selectedItems.length}</span>
            <span className="text-muted-gray"> item{selectedItems.length !== 1 ? 's' : ''} selected</span>
          </div>
          <Button onClick={onProceed} size="sm" className="gap-1.5">
            Continue
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REQUEST FORM
// ============================================================================

interface RequestFormProps {
  selectedItems: GearMarketplaceListing[];
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  budgetLineItemId: string;
  setBudgetLineItemId: (value: string) => void;
  autoCreateBudgetLine: boolean;
  setAutoCreateBudgetLine: (value: boolean) => void;
  budgetLineItems: BudgetLineItem[];
  rentalDays: number;
  estimatedTotal: number;
  onRemoveItem: (listingId: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  formatPrice: (price: number) => string;
  dateRange: { available_from?: string; available_to?: string };
}

function RequestForm({
  selectedItems,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  notes,
  setNotes,
  budgetLineItemId,
  setBudgetLineItemId,
  autoCreateBudgetLine,
  setAutoCreateBudgetLine,
  budgetLineItems,
  rentalDays,
  estimatedTotal,
  onRemoveItem,
  onBack,
  onSubmit,
  isSubmitting,
  formatPrice,
  dateRange,
}: RequestFormProps) {
  return (
    <div className="p-4 space-y-4">
      {/* Selected Items */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-gray">Selected Equipment</Label>
        <div className="flex flex-wrap gap-2">
          {selectedItems.map((item) => (
            <Badge
              key={item.id}
              variant="outline"
              className="gap-1.5 border-white/20 py-1"
            >
              {item.asset?.name || 'Unknown'}
              <button
                type="button"
                onClick={() => onRemoveItem(item.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Visual indicator for pre-filled dates */}
      {dateRange.available_from && dateRange.available_to && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 text-sm">
            Rental dates pre-filled from your availability search
          </AlertDescription>
        </Alert>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Dates */}
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date *</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date *</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Budget Link */}
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label>Budget Integration</Label>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                id="autoCreate"
                checked={autoCreateBudgetLine}
                onCheckedChange={setAutoCreateBudgetLine}
              />
              <Label htmlFor="autoCreate" className="text-xs text-muted-gray cursor-pointer">
                Auto-create line item
              </Label>
            </div>
          </div>

          {!autoCreateBudgetLine && (
            <Select value={budgetLineItemId || '_none'} onValueChange={(val) => setBudgetLineItemId(val === '_none' ? '' : val)}>
              <SelectTrigger>
                <Link2 className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Link to budget line item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No link</SelectItem>
                {budgetLineItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Any special requests or additional information..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      {/* Summary & Actions */}
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-gray">
            {rentalDays} day{rentalDays !== 1 ? 's' : ''} rental
          </p>
          <p className="font-medium text-bone-white">
            <span className="text-xs text-muted-gray">Est. </span>
            {formatPrice(estimatedTotal)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            Back
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={!startDate || !endDate || isSubmitting}
            className="gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Submit Request
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MarketplaceBrowserSection;
