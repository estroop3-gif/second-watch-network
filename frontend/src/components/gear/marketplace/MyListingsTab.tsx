/**
 * MyListingsTab.tsx
 * Manage organization's marketplace listings + personal (individual) gear posts
 */
import React, { useState } from 'react';
import {
  Package,
  DollarSign,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Loader2,
  AlertCircle,
  BadgeCheck,
  Calendar,
  Tag,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

import { useMyListings, useMarketplaceSettings } from '@/hooks/gear/useGearMarketplace';
import {
  usePersonalGear,
  useEnsurePersonalOrg,
  useDeletePersonalAsset,
  useTogglePersonalAssetListing,
} from '@/hooks/gear/usePersonalGear';
import { EditListingDialog } from './EditListingDialog';
import { QuickAddGearDialog } from '@/components/gear/lite/QuickAddGearDialog';
import type { GearMarketplaceListing, PersonalGearAsset } from '@/types/gear';

interface MyListingsTabProps {
  orgId: string;
  onAddListing: () => void;
  onListForSale?: () => void;
  onGoToSettings?: () => void;
}

export function MyListingsTab({ orgId, onAddListing, onListForSale, onGoToSettings }: MyListingsTabProps) {
  const { listings, isLoading: listingsLoading, deleteListing, updateListing } = useMyListings(orgId);
  const { settings, isLoading: settingsLoading } = useMarketplaceSettings(orgId);

  // Personal gear hooks
  const { data: personalGearData, isLoading: personalGearLoading } = usePersonalGear();
  const ensureOrg = useEnsurePersonalOrg();
  const deletePersonalAsset = useDeletePersonalAsset();
  const togglePersonalListing = useTogglePersonalAssetListing();

  const isLoading = listingsLoading || settingsLoading;

  // State
  const [listingsMode, setListingsMode] = useState<'rent' | 'sale'>('rent');
  const [editingListing, setEditingListing] = useState<GearMarketplaceListing | null>(null);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingPersonalAsset, setEditingPersonalAsset] = useState<PersonalGearAsset | null>(null);
  const [deletingPersonalAssetId, setDeletingPersonalAssetId] = useState<string | null>(null);

  // Filter org listings by mode
  const filteredListings = listings.filter((listing) => {
    if (listing.listing_type === 'both') return true;
    if (listingsMode === 'rent') return listing.listing_type === 'rent' || !listing.listing_type;
    return listing.listing_type === 'sale';
  });

  // Filter personal assets by mode (only show those with a listing)
  const personalAssets: PersonalGearAsset[] = personalGearData?.assets ?? [];
  const filteredPersonalAssets = personalAssets.filter((a) => {
    if (!a.listing_id) return false;
    if (a.listing_type === 'both') return true;
    if (listingsMode === 'rent') return a.listing_type === 'rent' || !a.listing_type;
    return a.listing_type === 'sale';
  });

  const handleToggleListed = async (listing: GearMarketplaceListing) => {
    try {
      await updateListing.mutateAsync({
        listingId: listing.id,
        input: { is_listed: !listing.is_listed },
      });
    } catch (error) {
      console.error('Failed to toggle listing:', error);
    }
  };

  const handleDeleteListing = async () => {
    if (!deletingListingId) return;
    try {
      await deleteListing.mutateAsync(deletingListingId);
      setDeletingListingId(null);
    } catch (error) {
      console.error('Failed to delete listing:', error);
    }
  };

  const handleOpenQuickAdd = () => {
    ensureOrg.mutate(undefined, {
      onSuccess: () => setShowQuickAdd(true),
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  // Check if marketplace is enabled
  if (!settings?.is_marketplace_enabled) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="mb-4 h-12 w-12 text-muted-gray" />
          <h3 className="mb-2 text-lg font-medium text-bone-white">
            Marketplace Not Enabled
          </h3>
          <p className="mb-4 text-center text-sm text-muted-gray">
            Enable marketplace in your organization settings to list equipment for rent.
          </p>
          <Button variant="outline" onClick={onGoToSettings}>Go to Settings</Button>
        </CardContent>
      </Card>
    );
  }

  if (listings.length === 0 && filteredPersonalAssets.length === 0) {
    return (
      <>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 h-12 w-12 text-muted-gray" />
            <h3 className="mb-2 text-lg font-medium text-bone-white">
              No Listings Yet
            </h3>
            <p className="mb-4 text-center text-sm text-muted-gray">
              List your organization's equipment or post your own personal gear for rent.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={onAddListing} className="gap-2">
                <Plus className="h-4 w-4" />
                List Equipment
              </Button>
              <Button variant="outline" className="gap-2" onClick={handleOpenQuickAdd}>
                <User className="h-4 w-4" />
                Post Your Own Item
              </Button>
            </div>
          </CardContent>
        </Card>

        <QuickAddGearDialog
          open={showQuickAdd || !!editingPersonalAsset}
          onClose={() => { setShowQuickAdd(false); setEditingPersonalAsset(null); }}
          onSuccess={() => { setShowQuickAdd(false); setEditingPersonalAsset(null); }}
          editAsset={editingPersonalAsset}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {/* Listings Mode Toggle */}
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
            <Button
              variant={listingsMode === 'rent' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setListingsMode('rent')}
              className="gap-2"
            >
              <Tag className="h-4 w-4" />
              For Rent
            </Button>
            <Button
              variant={listingsMode === 'sale' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setListingsMode('sale')}
              className="gap-2"
            >
              <DollarSign className="h-4 w-4" />
              For Sale
            </Button>
          </div>

          <p className="text-sm text-muted-gray">
            {filteredListings.length + filteredPersonalAssets.length} listing{(filteredListings.length + filteredPersonalAssets.length) !== 1 ? 's' : ''}
            {settings?.is_verified && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-400">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleOpenQuickAdd}
            disabled={ensureOrg.isPending}
          >
            {ensureOrg.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <User className="h-4 w-4" />
            )}
            Post Your Item
          </Button>

          {listingsMode === 'rent' ? (
            <Button onClick={onAddListing} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Rental Listing
            </Button>
          ) : (
            <Button onClick={onListForSale} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              List Asset for Sale
            </Button>
          )}
        </div>
      </div>

      {/* Org Listings Grid */}
      {filteredListings.length === 0 ? (
        <Card className="border-white/10 bg-white/5">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Package className="mb-3 h-10 w-10 text-muted-gray" />
            <h3 className="mb-1 text-base font-medium text-bone-white">
              No {listingsMode === 'rent' ? 'Rental' : 'Sale'} Listings
            </h3>
            <p className="mb-3 text-center text-sm text-muted-gray">
              {listingsMode === 'rent'
                ? 'You have no organization equipment listed for rent.'
                : 'You have no organization equipment listed for sale.'}
            </p>
            {listingsMode === 'rent' ? (
              <Button onClick={onAddListing} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Rental Listing
              </Button>
            ) : (
              <Button onClick={onListForSale} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                List Asset for Sale
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onEdit={() => setEditingListing(listing)}
              onDelete={() => setDeletingListingId(listing.id)}
              onToggleListed={() => handleToggleListed(listing)}
              isUpdating={updateListing.isPending}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}

      {/* Personal Listings Section — only shown once data is available */}
      {filteredPersonalAssets.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 border-t border-white/10 pt-4">
            <User className="h-4 w-4 text-muted-gray" />
            <h4 className="text-sm font-medium text-muted-gray">Your Personal Items</h4>
            <Badge variant="outline" className="text-xs">Individual</Badge>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPersonalAssets.map((asset) => (
              <PersonalAssetCard
                key={asset.id}
                asset={asset}
                onEdit={() => setEditingPersonalAsset(asset)}
                onDelete={() => setDeletingPersonalAssetId(asset.id)}
                onToggle={() => togglePersonalListing.mutate(asset.id)}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        </div>
      )}

      {/* Edit Org Listing Dialog */}
      {editingListing && (
        <EditListingDialog
          isOpen={!!editingListing}
          onClose={() => setEditingListing(null)}
          listing={editingListing}
          orgId={orgId}
        />
      )}

      {/* Quick Add / Edit Personal Item */}
      <QuickAddGearDialog
        open={showQuickAdd || !!editingPersonalAsset}
        onClose={() => { setShowQuickAdd(false); setEditingPersonalAsset(null); }}
        onSuccess={() => { setShowQuickAdd(false); setEditingPersonalAsset(null); }}
        editAsset={editingPersonalAsset}
      />

      {/* Delete Org Listing Confirmation */}
      <AlertDialog open={!!deletingListingId} onOpenChange={() => setDeletingListingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Listing</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
              Any pending rental requests for this item will need to be handled separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteListing}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteListing.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Personal Asset Confirmation */}
      <AlertDialog
        open={!!deletingPersonalAssetId}
        onOpenChange={(open) => !open && setDeletingPersonalAssetId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Personal Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item and its listing from the marketplace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary-red hover:bg-primary-red/90"
              onClick={() => {
                if (deletingPersonalAssetId) {
                  deletePersonalAsset.mutate(deletingPersonalAssetId, {
                    onSuccess: () => setDeletingPersonalAssetId(null),
                  });
                }
              }}
            >
              {deletePersonalAsset.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// LISTING CARD (Org)
// ============================================================================

interface ListingCardProps {
  listing: GearMarketplaceListing;
  onEdit: () => void;
  onDelete: () => void;
  onToggleListed: () => void;
  isUpdating: boolean;
  formatPrice: (price: number) => string;
}

function ListingCard({
  listing,
  onEdit,
  onDelete,
  onToggleListed,
  isUpdating,
  formatPrice,
}: ListingCardProps) {
  const asset = listing.asset;
  // Handle multiple possible photo field names from API
  const primaryPhoto = asset?.photo_urls?.[0] || asset?.photos_current?.[0] || asset?.photos_baseline?.[0] || asset?.image_url;

  return (
    <Card
      className={cn(
        'border-white/10 bg-white/5 transition-all',
        !listing.is_listed && 'opacity-60'
      )}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image */}
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={asset?.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-8 w-8 text-muted-gray" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h4 className="font-medium text-bone-white truncate">
                  {asset?.name || 'Unknown Asset'}
                </h4>
                <p className="text-sm text-muted-gray truncate">
                  {asset?.manufacturer} {asset?.model}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Pricing
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleListed} disabled={isUpdating}>
                    {listing.is_listed ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Hide from Marketplace
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Show on Marketplace
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-400">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Listing
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Pricing */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-accent-yellow/50 bg-accent-yellow/10 text-accent-yellow"
              >
                <DollarSign className="h-3 w-3 mr-1" />
                {formatPrice(listing.daily_rate)}/day
              </Badge>

              {listing.weekly_rate && (
                <Badge variant="outline" className="border-white/20 text-muted-gray">
                  {formatPrice(listing.weekly_rate)}/week
                </Badge>
              )}

              {!listing.is_listed && (
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hidden
                </Badge>
              )}
            </div>

            {/* Stats */}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-gray">
              {listing.min_rental_days > 1 && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Min {listing.min_rental_days} days
                </span>
              )}
              {listing.insurance_required && (
                <span className="text-blue-400">Insurance required</span>
              )}
              {(listing.deposit_amount || listing.deposit_percent) && (
                <span>
                  Deposit: {listing.deposit_percent
                    ? `${listing.deposit_percent}%`
                    : formatPrice(listing.deposit_amount || 0)}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// PERSONAL ASSET CARD
// ============================================================================

interface PersonalAssetCardProps {
  asset: PersonalGearAsset;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  formatPrice: (price: number) => string;
}

function PersonalAssetCard({ asset, onEdit, onDelete, onToggle, formatPrice }: PersonalAssetCardProps) {
  // photos_current may arrive as JSON string or array
  let photos: string[] = [];
  if (Array.isArray(asset.photos_current)) {
    photos = asset.photos_current;
  } else if (typeof asset.photos_current === 'string') {
    try { photos = JSON.parse(asset.photos_current); } catch { photos = []; }
  }
  const primaryPhoto = photos[0];

  return (
    <Card
      className={cn(
        'border-white/10 bg-white/5 transition-all',
        !asset.is_listed && 'opacity-60'
      )}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Image */}
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
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
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <h4 className="text-sm font-medium text-bone-white truncate">{asset.name}</h4>
                {(asset.manufacturer || asset.make || asset.model) && (
                  <p className="text-xs text-muted-gray truncate">
                    {asset.manufacturer || asset.make} {asset.model}
                  </p>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggle}>
                    {asset.is_listed ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-2" />
                        Hide from Marketplace
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Show on Marketplace
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-400">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Pricing */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {asset.daily_rate && (
                <Badge
                  variant="outline"
                  className="text-xs border-accent-yellow/50 bg-accent-yellow/10 text-accent-yellow"
                >
                  {formatPrice(asset.daily_rate)}/day
                </Badge>
              )}
              {asset.sale_price && (
                <Badge
                  variant="outline"
                  className="text-xs border-green-500/30 text-green-400"
                >
                  {formatPrice(asset.sale_price)}
                </Badge>
              )}
              {asset.is_listed ? (
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                  <Eye className="h-2.5 w-2.5 mr-1" />
                  Visible
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400">
                  <EyeOff className="h-2.5 w-2.5 mr-1" />
                  Hidden
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MyListingsTab;
