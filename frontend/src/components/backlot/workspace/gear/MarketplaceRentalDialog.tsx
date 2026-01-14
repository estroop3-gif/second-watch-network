/**
 * MarketplaceRentalDialog.tsx
 * Dialog for browsing marketplace and requesting quotes within Backlot context
 */
import React, { useState, useMemo } from 'react';
import {
  Search,
  Package,
  Store,
  BadgeCheck,
  Plus,
  Check,
  X,
  Loader2,
  Calendar,
  DollarSign,
  Link2,
  Send,
  ArrowRight,
  Info,
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import {
  useMarketplaceSearch,
  useCreateRentalRequest,
} from '@/hooks/gear/useGearMarketplace';
import { useGearCategories, useGearOrganization } from '@/hooks/gear';
import type {
  GearMarketplaceListing,
  GearMarketplaceSearchFilters,
  ListerType,
} from '@/types/gear';

interface BudgetLineItem {
  id: string;
  description: string;
  estimated_total?: number;
  category?: string;
}

interface MarketplaceRentalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  budgetLineItems: BudgetLineItem[];
}

export function MarketplaceRentalDialog({
  isOpen,
  onClose,
  projectId,
  budgetLineItems,
}: MarketplaceRentalDialogProps) {
  // View state
  const [step, setStep] = useState<'browse' | 'request'>('browse');

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [dateRange, setDateRange] = useState<{
    available_from?: string;
    available_to?: string;
  }>({});

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

  // Use the first selected org for categories
  const firstOrgId = selectedItems[0]?.organization_id;
  const { categories } = useGearCategories(firstOrgId || '');
  const { organization: userOrg } = useGearOrganization(null); // Get user's default org

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Build filters
  const filters: GearMarketplaceSearchFilters = {
    search: searchQuery || undefined,
    category_id: categoryFilter || undefined,
    verified_only: verifiedOnly || undefined,
    available_from: dateRange.available_from,
    available_to: dateRange.available_to,
    timezone: userTimezone,
  };

  // Data fetching
  const { listings, isLoading } = useMarketplaceSearch(filters, { enabled: isOpen });
  const { mutate: createRequest, isPending: isSubmitting } = useCreateRentalRequest();

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
    if (dateRange.available_from) {
      setStartDate(dateRange.available_from);
    }
    if (dateRange.available_to) {
      setEndDate(dateRange.available_to);
    }

    setStep('request');
  };

  const handleBack = () => {
    setStep('browse');
  };

  const handleSubmit = () => {
    if (!startDate || !endDate || selectedItems.length === 0) return;

    // Get the rental house org ID (assuming all items are from the same org for now)
    const rentalHouseOrgId = selectedItems[0].organization_id;

    // Auto-generate title from item count
    const generatedTitle = `${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''} requested`;

    createRequest(
      {
        requesting_org_id: userOrg?.id || '',
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
          // Reset state
          setSelectedItems([]);
          setNotes('');
          setBudgetLineItemId('');
          setStep('browse');
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    setSelectedItems([]);
    setStep('browse');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-white/10 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {step === 'browse' ? 'Rent from Marketplace' : 'Request Quote'}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {step === 'browse' ? (
            <BrowseStep
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
              formatPrice={formatPrice}
            />
          ) : (
            <RequestStep
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
              formatPrice={formatPrice}
              dateRange={dateRange}
            />
          )}
        </div>

        <DialogFooter className="border-t border-white/10 px-6 py-4">
          {step === 'browse' ? (
            <>
              <div className="flex-1 text-sm text-muted-gray">
                {selectedItems.length > 0 && (
                  <span>
                    {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleProceedToRequest}
                disabled={selectedItems.length === 0}
                className="gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!startDate || !endDate || isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Request
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// BROWSE STEP
// ============================================================================

interface BrowseStepProps {
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
  formatPrice: (price: number) => string;
}

function BrowseStep({
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
  formatPrice,
}: BrowseStepProps) {
  return (
    <div className="space-y-4 p-6">
      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
          <Input
            placeholder="Search equipment..."
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

      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 py-12">
          <Package className="mb-4 h-12 w-12 text-muted-gray" />
          <h3 className="mb-2 text-lg font-medium text-bone-white">No listings found</h3>
          <p className="text-sm text-muted-gray">Try adjusting your search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const isSelected = selectedItems.some((item) => item.id === listing.id);
            const asset = listing.asset;

            return (
              <button
                key={listing.id}
                onClick={() => onSelectItem(listing)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
                  isSelected
                    ? 'border-accent-yellow bg-accent-yellow/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                )}
              >
                {/* Image */}
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
                  {asset?.photo_urls?.[0] || asset?.image_url ? (
                    <img
                      src={asset?.photo_urls?.[0] || asset?.image_url}
                      alt=""
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
                    <h4 className="truncate text-sm font-medium text-bone-white">
                      {asset?.name || 'Unknown'}
                    </h4>
                    {listing.organization?.is_verified && (
                      <BadgeCheck className="h-3.5 w-3.5 flex-shrink-0 text-accent-yellow" />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-gray">
                    {listing.organization?.marketplace_name || listing.organization?.name}
                  </p>
                  <p className="mt-1 text-sm font-medium text-bone-white">
                    {formatPrice(listing.daily_rate)}
                    <span className="text-xs font-normal text-muted-gray">/day</span>
                  </p>
                </div>

                {/* Selection indicator */}
                <div
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-accent-yellow bg-accent-yellow'
                      : 'border-white/30'
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-charcoal-black" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REQUEST STEP
// ============================================================================

interface RequestStepProps {
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
  formatPrice: (price: number) => string;
  dateRange: { available_from?: string; available_to?: string };
}

function RequestStep({
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
  formatPrice,
  dateRange,
}: RequestStepProps) {
  return (
    <div className="space-y-6 p-6">
      {/* Selected Items Summary */}
      <div className="space-y-2">
        <Label>Selected Items ({selectedItems.length})</Label>
        <div className="rounded-lg border border-white/10 bg-white/5">
          {selectedItems.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between p-3',
                index !== selectedItems.length - 1 && 'border-b border-white/10'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded bg-white/10">
                  {item.asset?.photo_urls?.[0] || item.asset?.image_url ? (
                    <img
                      src={item.asset?.photo_urls?.[0] || item.asset?.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-5 w-5 text-muted-gray" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-bone-white">
                    {item.asset?.name}
                  </p>
                  <p className="text-xs text-muted-gray">
                    {formatPrice(item.daily_rate)}/day
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-gray hover:text-primary-red"
                onClick={() => onRemoveItem(item.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Visual indicator for pre-filled dates */}
      {dateRange.available_from && dateRange.available_to && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 text-sm">
            Rental dates pre-filled from your availability search
          </AlertDescription>
        </Alert>
      )}

      {/* Request Form */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Rental Start *</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Rental End *</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
        </div>

        {/* Cost Summary */}
        <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-gray" />
            <span className="text-muted-gray">Duration:</span>
            <span className="font-medium text-bone-white">
              {rentalDays} {rentalDays === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-sm text-muted-gray">Est. Total: </span>
            <span className="text-lg font-semibold text-accent-yellow">
              {formatPrice(estimatedTotal)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Any special requirements..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Budget Integration */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 font-medium text-bone-white">
          <Link2 className="h-4 w-4" />
          Budget Integration
        </h4>

        {budgetLineItems.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="budgetLine">Link to Budget Line Item</Label>
              <Select
                value={budgetLineItemId || 'auto'}
                onValueChange={(v) => {
                  if (v === 'auto') {
                    setBudgetLineItemId('');
                    setAutoCreateBudgetLine(true);
                  } else {
                    setBudgetLineItemId(v);
                    setAutoCreateBudgetLine(false);
                  }
                }}
              >
                <SelectTrigger id="budgetLine">
                  <SelectValue placeholder="Select budget line" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-create new line item</SelectItem>
                  {budgetLineItems.map((li) => (
                    <SelectItem key={li.id} value={li.id}>
                      {li.description} ({formatPrice(li.estimated_total || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-gray">
              {autoCreateBudgetLine
                ? 'A new budget line item will be created for this rental.'
                : 'Rental costs will be added to the selected budget line item.'}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-bone-white">Auto-create Budget Line</p>
              <p className="text-xs text-muted-gray">
                A new budget line item will be created for this rental
              </p>
            </div>
            <Switch checked={autoCreateBudgetLine} onCheckedChange={setAutoCreateBudgetLine} />
          </div>
        )}
      </div>

      {/* Info Alert */}
      <Alert className="border-blue-500/30 bg-blue-500/10">
        <AlertDescription className="text-blue-200 text-sm">
          The rental house will review your request and send you a formal quote.
          Once approved, the rental will be automatically linked to your project.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default MarketplaceRentalDialog;
