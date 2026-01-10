/**
 * ListForSaleDialog.tsx
 * Simplified dialog for listing Gear House assets for sale in the marketplace
 */
import React, { useState, useMemo } from 'react';
import {
  Search,
  Package,
  DollarSign,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { useGearAssets, useGearCategories } from '@/hooks/gear';
import { useMyListings } from '@/hooks/gear/useGearMarketplace';
import { SalePricingForm, type SaleCondition } from './SalePricingForm';
import type { GearAsset } from '@/types/gear';

// Helper function to check if an asset has photos
function assetHasPhotos(asset: GearAsset): boolean {
  const photos = (asset as any).photos_current || (asset as any).photos_baseline || (asset as any).photos || [];
  return Array.isArray(photos) && photos.length > 0;
}

// Get photo URL from asset
function getAssetPhotoUrl(asset: GearAsset): string | undefined {
  const photos = (asset as any).photos_current || (asset as any).photos_baseline || (asset as any).photos || (asset as any).photo_urls || [];
  return photos[0] || (asset as any).image_url;
}

interface ListForSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSuccess?: () => void;
}

export function ListForSaleDialog({
  isOpen,
  onClose,
  orgId,
  onSuccess,
}: ListForSaleDialogProps) {
  // Step state: 1 = Select Asset, 2 = Set Sale Details
  const [step, setStep] = useState(1);

  // Asset selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedAsset, setSelectedAsset] = useState<GearAsset | null>(null);

  // Sale details state
  const [salePrice, setSalePrice] = useState('');
  const [saleCondition, setSaleCondition] = useState<SaleCondition | ''>('');
  const [saleIncludes, setSaleIncludes] = useState('');
  const [saleNegotiable, setSaleNegotiable] = useState(true);

  // Visibility toggles (what details to show publicly)
  const [showDescription, setShowDescription] = useState(true);
  const [showNotes, setShowNotes] = useState(false);

  // Fetch data
  const { assets, isLoading: assetsLoading } = useGearAssets({
    orgId,
    status: 'available',
    search: searchQuery || undefined,
    categoryId: categoryFilter || undefined,
    limit: 100,
    enabled: isOpen,
  });
  const { categories } = useGearCategories(orgId);
  const { listings, isLoading: listingsLoading, createListing } = useMyListings(orgId);

  // Don't show assets until BOTH assets and listings have loaded
  // This prevents showing all assets as available before listings filter takes effect
  const isLoading = assetsLoading || listingsLoading;
  const hasListingsData = listings !== undefined && !listingsLoading;

  // Filter out assets that already have any marketplace listing
  // (backend doesn't allow multiple listings per asset)
  const listedAssetIds = useMemo(() => {
    if (!listings || listings.length === 0) return new Set<string>();
    return new Set(listings.map(l => l.asset_id));
  }, [listings]);

  // Separate assets into those with photos (listable) and without
  const availableAssets = useMemo(() => {
    return assets.filter(
      (asset) => !listedAssetIds.has(asset.id) && assetHasPhotos(asset)
    );
  }, [assets, listedAssetIds]);

  const assetsWithoutPhotos = useMemo(() => {
    return assets.filter(
      (asset) => !listedAssetIds.has(asset.id) && !assetHasPhotos(asset)
    );
  }, [assets, listedAssetIds]);

  // Validation
  const isSaleDetailsValid = useMemo(() => {
    const price = parseFloat(salePrice);
    return price > 0 && saleCondition !== '';
  }, [salePrice, saleCondition]);

  const handleAssetSelect = (asset: GearAsset) => {
    setSelectedAsset(asset);
  };

  const handleNextStep = () => {
    if (selectedAsset) {
      setStep(2);
    }
  };

  const handleSubmit = async () => {
    if (!selectedAsset || !isSaleDetailsValid) return;

    // Double-check the asset isn't already listed (safeguard)
    if (listedAssetIds.has(selectedAsset.id)) {
      alert('This asset already has a marketplace listing. Please edit the existing listing to add sale pricing.');
      resetForm();
      return;
    }

    try {
      await createListing.mutateAsync({
        asset_id: selectedAsset.id,
        listing_type: 'sale',
        sale_price: parseFloat(salePrice),
        sale_condition: saleCondition || undefined,
        sale_includes: saleIncludes || undefined,
        sale_negotiable: saleNegotiable,
        visible_fields: {
          description: showDescription,
          notes: showNotes,
        },
      });

      resetForm();
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to create sale listing:', error);
      if (error?.message?.includes('already has a marketplace listing')) {
        alert('This asset already has a marketplace listing. Please edit the existing listing to add sale pricing.');
        resetForm();
      }
    }
  };

  const resetForm = () => {
    setStep(1);
    setSearchQuery('');
    setCategoryFilter('');
    setSelectedAsset(null);
    setSalePrice('');
    setSaleCondition('');
    setSaleIncludes('');
    setSaleNegotiable(true);
    setShowDescription(true);
    setShowNotes(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isSubmitting = createListing.isPending;

  // Step 1: Asset Selection
  const renderStep1 = () => (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-gray" />
          <Input
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(value) => setCategoryFilter(value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
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
      </div>

      {/* Asset List */}
      <ScrollArea className="h-[350px] border border-white/10 rounded-lg">
        {isLoading || !hasListingsData ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
          </div>
        ) : availableAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-gray mb-4" />
            <p className="text-bone-white font-medium">No available assets</p>
            <p className="text-sm text-muted-gray">
              All assets are either already listed or don't have photos
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {availableAssets.map((asset) => {
              const photoUrl = getAssetPhotoUrl(asset);
              const isSelected = selectedAsset?.id === asset.id;

              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => handleAssetSelect(asset)}
                  className={cn(
                    'w-full flex items-center gap-4 p-4 text-left transition-colors',
                    isSelected
                      ? 'bg-accent-yellow/10 border-l-2 border-l-accent-yellow'
                      : 'hover:bg-white/5'
                  )}
                >
                  {/* Asset Photo */}
                  <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-white/10 overflow-hidden">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-6 w-6 text-muted-gray" />
                      </div>
                    )}
                  </div>

                  {/* Asset Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-bone-white truncate">{asset.name}</p>
                    <p className="text-sm text-muted-gray truncate">
                      {asset.manufacturer}
                      {asset.model && ` • ${asset.model}`}
                    </p>
                    {asset.category_name && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {asset.category_name}
                      </Badge>
                    )}
                  </div>

                  {/* Selection Indicator */}
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border-2 flex-shrink-0',
                      isSelected
                        ? 'border-accent-yellow bg-accent-yellow'
                        : 'border-white/20'
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4 text-charcoal-black" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Info messages */}
      {assetsWithoutPhotos.length > 0 && (
        <Alert className="border-yellow-500/30 bg-yellow-500/10">
          <AlertCircle className="h-4 w-4 text-yellow-400" />
          <AlertDescription className="text-yellow-200 text-sm">
            {assetsWithoutPhotos.length} asset{assetsWithoutPhotos.length !== 1 ? 's' : ''} cannot be listed because they have no photos.
          </AlertDescription>
        </Alert>
      )}
      {listings.length > 0 && (
        <Alert className="border-blue-500/30 bg-blue-500/10">
          <Package className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 text-sm">
            Assets already listed on the marketplace are hidden. To add sale pricing to an existing rental listing, edit that listing instead.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  // Step 2: Sale Details
  const renderStep2 = () => (
    <div className="space-y-6">
      {/* Selected Asset Preview */}
      {selectedAsset && (
        <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-white/10 overflow-hidden">
            {getAssetPhotoUrl(selectedAsset) ? (
              <img
                src={getAssetPhotoUrl(selectedAsset)}
                alt={selectedAsset.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-8 w-8 text-muted-gray" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-bone-white truncate">{selectedAsset.name}</h4>
            <p className="text-sm text-muted-gray">
              {selectedAsset.manufacturer}
              {selectedAsset.model && ` • ${selectedAsset.model}`}
            </p>
            {selectedAsset.category_name && (
              <p className="text-xs text-muted-gray">{selectedAsset.category_name}</p>
            )}
          </div>
        </div>
      )}

      {/* Sale Pricing Form */}
      <SalePricingForm
        salePrice={salePrice}
        setSalePrice={setSalePrice}
        condition={saleCondition}
        setCondition={setSaleCondition}
        includes={saleIncludes}
        setIncludes={setSaleIncludes}
        negotiable={saleNegotiable}
        setNegotiable={setSaleNegotiable}
      />

      {/* Visibility Toggles */}
      <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-bone-white">
          <Eye className="h-4 w-4" />
          Visible Details
        </div>
        <p className="text-xs text-muted-gray">
          Choose which asset details are shown publicly on your listing
        </p>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showDescription"
              checked={showDescription}
              onCheckedChange={(checked) => setShowDescription(checked === true)}
            />
            <Label htmlFor="showDescription" className="text-sm text-bone-white cursor-pointer">
              Show description
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="showNotes"
              checked={showNotes}
              onCheckedChange={(checked) => setShowNotes(checked === true)}
            />
            <Label htmlFor="showNotes" className="text-sm text-bone-white cursor-pointer">
              Show notes
            </Label>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="border-blue-500/30 bg-blue-500/10">
        <DollarSign className="h-4 w-4 text-blue-400" />
        <AlertDescription className="text-blue-200 text-sm">
          This asset will be listed for sale on the community marketplace. Interested buyers can contact you directly.
        </AlertDescription>
      </Alert>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-xl flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-accent-yellow" />
            List Asset for Sale
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Step 1 of 2: Select an asset from your Gear House inventory'
              : 'Step 2 of 2: Set the sale price and condition'}
          </DialogDescription>
          {/* Step Indicator */}
          <div className="flex items-center gap-2 mt-3">
            <div
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                step === 1
                  ? 'bg-accent-yellow text-charcoal-black'
                  : 'bg-accent-yellow/20 text-accent-yellow'
              )}
            >
              {step > 1 ? <Check className="h-3 w-3" /> : '1'}
            </div>
            <div className="flex-1 h-0.5 bg-white/10">
              <div
                className={cn(
                  'h-full bg-accent-yellow transition-all',
                  step >= 2 ? 'w-full' : 'w-0'
                )}
              />
            </div>
            <div
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                step === 2
                  ? 'bg-accent-yellow text-charcoal-black'
                  : 'bg-white/10 text-muted-gray'
              )}
            >
              2
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 p-6 overflow-y-auto">
          {step === 1 ? renderStep1() : renderStep2()}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleNextStep}
                disabled={!selectedAsset}
                className="gap-2"
              >
                Next: Set Price
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isSaleDetailsValid || isSubmitting}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    List for Sale
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

export default ListForSaleDialog;
