/**
 * MyListingsTab.tsx
 * Manage organization's marketplace listings
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
import { EditListingDialog } from './EditListingDialog';
import type { GearMarketplaceListing } from '@/types/gear';

interface MyListingsTabProps {
  orgId: string;
  onAddListing: () => void;
  onGoToSettings?: () => void;
}

export function MyListingsTab({ orgId, onAddListing, onGoToSettings }: MyListingsTabProps) {
  const { listings, isLoading: listingsLoading, deleteListing, updateListing } = useMyListings(orgId);
  const { settings, isLoading: settingsLoading } = useMarketplaceSettings(orgId);

  const isLoading = listingsLoading || settingsLoading;

  // State
  const [editingListing, setEditingListing] = useState<GearMarketplaceListing | null>(null);
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);

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

  if (listings.length === 0) {
    return (
      <Card className="border-white/10 bg-white/5">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="mb-4 h-12 w-12 text-muted-gray" />
          <h3 className="mb-2 text-lg font-medium text-bone-white">
            No Listings Yet
          </h3>
          <p className="mb-4 text-center text-sm text-muted-gray">
            Start listing your equipment on the marketplace to receive rental requests.
          </p>
          <Button onClick={onAddListing} className="gap-2">
            <Plus className="h-4 w-4" />
            List Equipment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-gray">
            {listings.length} listing{listings.length !== 1 ? 's' : ''}
            {settings?.is_verified && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-400">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </p>
        </div>
        <Button onClick={onAddListing} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Listing
        </Button>
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
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

      {/* Edit Dialog */}
      {editingListing && (
        <EditListingDialog
          isOpen={!!editingListing}
          onClose={() => setEditingListing(null)}
          listing={editingListing}
          orgId={orgId}
        />
      )}

      {/* Delete Confirmation */}
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
    </div>
  );
}

// ============================================================================
// LISTING CARD
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

export default MyListingsTab;
