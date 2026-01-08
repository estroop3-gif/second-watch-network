/**
 * AssetPickerDialog.tsx
 * Dialog for selecting assets to list on the marketplace
 */
import React, { useState, useMemo } from 'react';
import {
  Search,
  Package,
  Check,
  Loader2,
  ArrowRight,
  Filter,
  Camera,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

// Helper function to check if an asset has photos
function assetHasPhotos(asset: GearAsset): boolean {
  const photos = asset.photos_current || asset.photos_baseline || asset.photos || [];
  return Array.isArray(photos) && photos.length > 0;
}

import { useGearAssets, useGearCategories } from '@/hooks/gear';
import { useMyListings } from '@/hooks/gear/useGearMarketplace';
import { CreateListingDialog } from './CreateListingDialog';
import type { GearAsset } from '@/types/gear';

interface AssetPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
}

export function AssetPickerDialog({
  isOpen,
  onClose,
  orgId,
}: AssetPickerDialogProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [showListingDialog, setShowListingDialog] = useState(false);

  // Fetch data
  const { assets, isLoading: assetsLoading } = useGearAssets({
    orgId,
    status: 'available', // Only show available assets
    search: searchQuery || undefined,
    categoryId: categoryFilter || undefined,
    limit: 100,
    enabled: isOpen,
  });
  const { categories } = useGearCategories(orgId);
  const { listings, isLoading: listingsLoading } = useMyListings(orgId);

  const isLoading = assetsLoading || listingsLoading;

  // Filter out assets that are already listed
  const listedAssetIds = useMemo(() => {
    return new Set(listings.map((listing) => listing.asset_id));
  }, [listings]);

  // Separate assets into those with photos (listable) and without photos (not listable)
  const { assetsWithPhotos, assetsWithoutPhotos } = useMemo(() => {
    const notListed = assets.filter((asset) => !listedAssetIds.has(asset.id));
    return {
      assetsWithPhotos: notListed.filter((asset) => assetHasPhotos(asset)),
      assetsWithoutPhotos: notListed.filter((asset) => !assetHasPhotos(asset)),
    };
  }, [assets, listedAssetIds]);

  // Available assets are those with photos (they can be listed)
  const availableAssets = assetsWithPhotos;

  // Get selected assets
  const selectedAssets = useMemo(() => {
    return availableAssets.filter((asset) => selectedAssetIds.has(asset.id));
  }, [availableAssets, selectedAssetIds]);

  const handleToggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedAssetIds.size === availableAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(availableAssets.map((a) => a.id)));
    }
  };

  const handleContinue = () => {
    if (selectedAssets.length > 0) {
      setShowListingDialog(true);
    }
  };

  const handleListingDialogClose = () => {
    setShowListingDialog(false);
    setSelectedAssetIds(new Set());
    onClose();
  };

  const handleDialogClose = () => {
    setSelectedAssetIds(new Set());
    setSearchQuery('');
    setCategoryFilter('');
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showListingDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-white/10 flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-accent-yellow" />
              Select Assets to List
            </DialogTitle>
            <DialogDescription>
              Choose equipment from your inventory to list on the marketplace
            </DialogDescription>
          </DialogHeader>

          {/* Search & Filters */}
          <div className="px-6 py-4 border-b border-white/10 space-y-3 flex-shrink-0">
            <div className="flex gap-3">
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
                  <Filter className="h-4 w-4 mr-2" />
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
            </div>

            {/* Select all / selected count */}
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleToggleAll}
                className="text-accent-yellow hover:underline"
              >
                {selectedAssetIds.size === availableAssets.length && availableAssets.length > 0
                  ? 'Deselect all'
                  : 'Select all'}
              </button>
              <span className="text-muted-gray">
                {selectedAssetIds.size} of {availableAssets.length} selected
              </span>
            </div>
          </div>

          {/* Asset Grid */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
                </div>
              ) : availableAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="mb-4 h-12 w-12 text-muted-gray" />
                  <h3 className="mb-2 text-lg font-medium text-bone-white">
                    No Available Assets
                  </h3>
                  <p className="text-sm text-muted-gray max-w-sm">
                    {assets.length > 0 && listedAssetIds.size > 0
                      ? 'All your available assets are already listed on the marketplace.'
                      : 'Add assets to your inventory first, then you can list them for rent.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {availableAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedAssetIds.has(asset.id)}
                      onToggle={() => handleToggleAsset(asset.id)}
                    />
                  ))}
                </div>
              )}

              {/* Warning for assets without photos */}
              {assetsWithoutPhotos.length > 0 && (
                <Alert className="mt-4 border-amber-500/50 bg-amber-500/10">
                  <Camera className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-200">
                    <span className="font-medium">{assetsWithoutPhotos.length} asset(s)</span>{' '}
                    need photos before they can be listed on the marketplace.
                    <span className="text-muted-gray ml-1">
                      ({assetsWithoutPhotos.slice(0, 3).map(a => a.name).join(', ')}
                      {assetsWithoutPhotos.length > 3 && `, +${assetsWithoutPhotos.length - 3} more`})
                    </span>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="px-6 py-4 border-t border-white/10 flex-shrink-0">
            <Button variant="outline" onClick={handleDialogClose}>
              Cancel
            </Button>
            <Button
              onClick={handleContinue}
              disabled={selectedAssets.length === 0}
              className="gap-2"
            >
              Continue with {selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Listing Dialog for bulk creation */}
      {showListingDialog && (
        <CreateListingDialog
          isOpen={showListingDialog}
          onClose={handleListingDialogClose}
          assets={selectedAssets}
          orgId={orgId}
        />
      )}
    </>
  );
}

// ============================================================================
// ASSET CARD
// ============================================================================

interface AssetCardProps {
  asset: GearAsset;
  isSelected: boolean;
  onToggle: () => void;
}

function AssetCard({ asset, isSelected, onToggle }: AssetCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-left transition-all',
        isSelected
          ? 'border-accent-yellow bg-accent-yellow/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      )}
    >
      {/* Checkbox */}
      <div className="pt-0.5">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle()}
          className={cn(
            isSelected && 'border-accent-yellow bg-accent-yellow text-charcoal-black'
          )}
        />
      </div>

      {/* Image */}
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
        {asset.photos?.[0] ? (
          <img
            src={asset.photos[0]}
            alt={asset.name}
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
        <h4 className="font-medium text-bone-white truncate">{asset.name}</h4>
        <p className="text-sm text-muted-gray truncate">
          {asset.manufacturer} {asset.model && `• ${asset.model}`}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {asset.category_name && (
            <Badge variant="outline" className="text-xs border-white/20">
              {asset.category_name}
            </Badge>
          )}
          {asset.daily_rate && (
            <Badge variant="outline" className="text-xs border-accent-yellow/50 text-accent-yellow">
              ${asset.daily_rate}/day
            </Badge>
          )}
        </div>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="flex-shrink-0">
          <Check className="h-5 w-5 text-accent-yellow" />
        </div>
      )}
    </button>
  );
}

export default AssetPickerDialog;
