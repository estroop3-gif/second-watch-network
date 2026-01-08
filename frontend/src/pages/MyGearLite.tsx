/**
 * MyGearLite.tsx
 * Simplified gear management for ALL users (including FREE role).
 * Shows personal gear with listing status, allows adding new items.
 * Free users see this instead of full Gear House.
 */

import { useEffect, useState } from 'react';
import {
  Plus,
  Package,
  DollarSign,
  Tag,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  MoreVertical,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/context/AuthContext';
import {
  usePersonalGear,
  useEnsurePersonalOrg,
  useDeletePersonalAsset,
  useTogglePersonalAssetListing,
} from '@/hooks/gear/usePersonalGear';
import { QuickAddGearDialog } from '@/components/gear/lite/QuickAddGearDialog';
import type { PersonalGearAsset } from '@/types/gear';

export default function MyGearLite() {
  const { profile } = useAuth();
  const ensureOrg = useEnsurePersonalOrg();
  const { data, isLoading, refetch } = usePersonalGear();
  const deleteAsset = useDeletePersonalAsset();
  const toggleListing = useTogglePersonalAssetListing();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PersonalGearAsset | null>(null);
  const [deleteConfirmAsset, setDeleteConfirmAsset] = useState<PersonalGearAsset | null>(null);

  // Ensure personal org exists on mount
  useEffect(() => {
    ensureOrg.mutate();
  }, []);

  const handleDelete = async () => {
    if (!deleteConfirmAsset) return;
    try {
      await deleteAsset.mutateAsync(deleteConfirmAsset.id);
      setDeleteConfirmAsset(null);
      refetch();
    } catch (err) {
      console.error('Failed to delete asset:', err);
    }
  };

  const handleToggleListing = async (assetId: string) => {
    try {
      await toggleListing.mutateAsync(assetId);
      refetch();
    } catch (err) {
      console.error('Failed to toggle listing:', err);
    }
  };

  // Check if user has access to full Gear House
  const hasFullGearHouseAccess = profile?.role && !['free'].includes(profile.role);

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container max-w-4xl py-8 px-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-bone-white">My Gear</h1>
            <p className="text-muted-gray mt-1">
              List your equipment for rent or sale on the marketplace
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Gear
          </Button>
        </div>

        {/* Upgrade Banner for Free Users */}
        {!hasFullGearHouseAccess && (
          <Card className="mb-6 border-accent-yellow/30 bg-accent-yellow/5">
            <CardContent className="py-4 flex items-center justify-between">
              <p className="text-sm text-bone-white">
                Upgrade to Filmmaker to unlock full Gear House features:
                inventory management, kits, maintenance tracking, and more.
              </p>
              <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
                <Link to="/account/subscription">Upgrade</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Full Gear House Link for Paid Users */}
        {hasFullGearHouseAccess && (
          <Card className="mb-6 border-white/10 bg-white/5">
            <CardContent className="py-4 flex items-center justify-between">
              <p className="text-sm text-muted-gray">
                You have access to full Gear House features including inventory management,
                kits, and maintenance tracking.
              </p>
              <Button variant="outline" size="sm" asChild className="ml-4 shrink-0">
                <Link to="/gear" className="gap-2">
                  Open Gear House
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Gear Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-gray" />
          </div>
        ) : data?.assets?.length === 0 ? (
          <EmptyState onAdd={() => setShowAddDialog(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.assets?.map((asset) => (
              <GearCard
                key={asset.id}
                asset={asset}
                onEdit={() => setEditingAsset(asset)}
                onDelete={() => setDeleteConfirmAsset(asset)}
                onToggleListing={() => handleToggleListing(asset.id)}
                isTogglingListing={toggleListing.isPending}
              />
            ))}
          </div>
        )}

        {/* Marketplace Link */}
        {data?.assets && data.assets.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-gray mb-2">
              See your listings in the marketplace
            </p>
            <Button variant="outline" asChild>
              <Link to="/filmmakers?tab=marketplace">
                Browse Marketplace
              </Link>
            </Button>
          </div>
        )}

        {/* Add Dialog */}
        <QuickAddGearDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onSuccess={() => {
            setShowAddDialog(false);
            refetch();
          }}
        />

        {/* Edit Dialog - reuse QuickAddGearDialog in edit mode */}
        {editingAsset && (
          <QuickAddGearDialog
            open={!!editingAsset}
            onClose={() => setEditingAsset(null)}
            onSuccess={() => {
              setEditingAsset(null);
              refetch();
            }}
            editAsset={editingAsset}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deleteConfirmAsset}
          onOpenChange={(open) => !open && setDeleteConfirmAsset(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Gear?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirmAsset?.name}"?
                This will also remove any active marketplace listing.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteAsset.isPending}
              >
                {deleteAsset.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

interface GearCardProps {
  asset: PersonalGearAsset;
  onEdit: () => void;
  onDelete: () => void;
  onToggleListing: () => void;
  isTogglingListing: boolean;
}

function GearCard({ asset, onEdit, onDelete, onToggleListing, isTogglingListing }: GearCardProps) {
  const photos = asset.photos_current || asset.photos_baseline || [];
  const photo = photos[0];
  const isListed = asset.listing_id && asset.is_listed;

  return (
    <Card className="border-white/10 bg-white/5 hover:border-white/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Photo */}
          <div className="h-20 w-20 rounded-lg bg-white/10 overflow-hidden shrink-0">
            {photo ? (
              <img
                src={photo}
                alt={asset.name}
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
            <h4 className="font-medium text-bone-white truncate">{asset.name}</h4>
            {(asset.manufacturer || asset.model) && (
              <p className="text-sm text-muted-gray truncate">
                {[asset.manufacturer, asset.model].filter(Boolean).join(' ')}
              </p>
            )}

            {/* Status Badges */}
            <div className="mt-2 flex flex-wrap gap-2">
              {isListed ? (
                <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                  <Eye className="h-3 w-3 mr-1" />
                  Listed
                </Badge>
              ) : asset.listing_id ? (
                <Badge variant="outline" className="text-muted-gray border-muted-gray/50">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Unlisted
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-gray border-muted-gray/50">
                  Not on Marketplace
                </Badge>
              )}

              {(asset.listing_type === 'rent' || asset.listing_type === 'both') &&
                asset.daily_rate && (
                  <Badge
                    variant="outline"
                    className="border-accent-yellow/50 text-accent-yellow"
                  >
                    <DollarSign className="h-3 w-3 mr-1" />
                    ${asset.daily_rate}/day
                  </Badge>
                )}

              {(asset.listing_type === 'sale' || asset.listing_type === 'both') &&
                asset.sale_price && (
                  <Badge
                    variant="outline"
                    className="border-green-500/50 text-green-400"
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    ${asset.sale_price}
                  </Badge>
                )}
            </div>
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {asset.listing_id && (
                <DropdownMenuItem
                  onClick={onToggleListing}
                  disabled={isTogglingListing}
                >
                  {isListed ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Unlist from Marketplace
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      List on Marketplace
                    </>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-red-400">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  onAdd: () => void;
}

function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <Package className="mb-4 h-12 w-12 text-muted-gray" />
        <h3 className="mb-2 text-lg font-medium text-bone-white">No Gear Yet</h3>
        <p className="mb-6 text-center text-sm text-muted-gray max-w-sm">
          Add your first piece of equipment to list it for rent or sale on the
          marketplace. Photos are required for all listings.
        </p>
        <Button onClick={onAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Your First Gear
        </Button>
      </CardContent>
    </Card>
  );
}
