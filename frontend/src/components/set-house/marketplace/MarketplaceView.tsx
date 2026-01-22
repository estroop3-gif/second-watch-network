/**
 * Marketplace View
 * Manage marketplace listings for Set House spaces
 */
import React, { useState } from 'react';
import {
  Store,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  DollarSign,
  Home,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useSetHouseOrgListings, useSetHouseSpaces } from '@/hooks/set-house';
import type { SetHouseMarketplaceListing } from '@/types/set-house';
import { cn } from '@/lib/utils';

interface MarketplaceViewProps {
  orgId: string;
  onGoToSettings?: () => void;
}

export function MarketplaceView({ orgId, onGoToSettings }: MarketplaceViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateListingOpen, setIsCreateListingOpen] = useState(false);

  const { listings, isLoading, createListing, updateListing, deleteListing } = useSetHouseOrgListings(orgId);
  const { spaces } = useSetHouseSpaces({ orgId });

  const filteredListings = listings.filter((l) =>
    l.space_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    total: listings.length,
    active: listings.filter(l => l.is_active).length,
    inactive: listings.filter(l => !l.is_active).length,
  };

  // Get spaces without listings
  const listedSpaceIds = new Set(listings.map(l => l.space_id));
  const unlistedSpaces = spaces.filter(s => !listedSpaceIds.has(s.id));

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Listings"
          value={stats.total}
          icon={<Store className="w-5 h-5" />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="text-green-400"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive}
          icon={<XCircle className="w-5 h-5" />}
          color="text-gray-400"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search listings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {onGoToSettings && (
          <Button variant="outline" onClick={onGoToSettings}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        )}
        <Button onClick={() => setIsCreateListingOpen(true)} disabled={unlistedSpaces.length === 0}>
          <Plus className="w-4 h-4 mr-2" />
          Create Listing
        </Button>
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredListings.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Store className="w-12 h-12 text-muted-gray mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Marketplace Listings</h3>
            <p className="text-muted-gray text-center max-w-md mb-4">
              Create listings to make your spaces available for rent on the marketplace
            </p>
            {unlistedSpaces.length > 0 ? (
              <Button onClick={() => setIsCreateListingOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Listing
              </Button>
            ) : (
              <p className="text-sm text-muted-gray">
                Add spaces first to create marketplace listings
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredListings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onToggleActive={(active) => updateListing.mutate({ id: listing.id, is_active: active })}
              onDelete={() => deleteListing.mutate(listing.id)}
            />
          ))}
        </div>
      )}

      {/* Create Listing Modal */}
      <CreateListingModal
        isOpen={isCreateListingOpen}
        onClose={() => setIsCreateListingOpen(false)}
        spaces={unlistedSpaces}
        onSubmit={async (data) => {
          await createListing.mutateAsync(data);
          setIsCreateListingOpen(false);
        }}
        isSubmitting={createListing.isPending}
      />
    </div>
  );
}

// ============================================================================
// LISTING CARD
// ============================================================================

function ListingCard({
  listing,
  onToggleActive,
  onDelete,
}: {
  listing: SetHouseMarketplaceListing;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
              <Home className="w-5 h-5 text-accent-yellow" />
            </div>
            <div>
              <CardTitle className="text-bone-white text-base">{listing.space_name}</CardTitle>
              <Badge
                className={cn(
                  'mt-1 border',
                  listing.is_active
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                )}
              >
                {listing.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="w-4 h-4 mr-2" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-400" onClick={onDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Pricing */}
          <div className="flex flex-wrap gap-2">
            {listing.daily_rate && (
              <div className="flex items-center gap-1 text-sm">
                <DollarSign className="w-3 h-3 text-green-400" />
                <span className="text-green-400">{listing.daily_rate}/day</span>
              </div>
            )}
            {listing.hourly_rate && (
              <div className="flex items-center gap-1 text-sm text-muted-gray">
                <span>${listing.hourly_rate}/hr</span>
              </div>
            )}
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-muted-gray/20">
            <span className="text-sm text-muted-gray">Active</span>
            <Switch
              checked={listing.is_active}
              onCheckedChange={onToggleActive}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-gray">{label}</p>
            <p className={cn('text-2xl font-bold', color || 'text-bone-white')}>{value}</p>
          </div>
          <div className={cn('opacity-50', color || 'text-muted-gray')}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE LISTING MODAL
// ============================================================================

function CreateListingModal({
  isOpen,
  onClose,
  spaces,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  spaces: Array<{ id: string; name: string }>;
  onSubmit: (data: { space_id: string; daily_rate?: number; hourly_rate?: number; is_active?: boolean }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [spaceId, setSpaceId] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceId) {
      setError('Please select a space');
      return;
    }
    if (!dailyRate && !hourlyRate) {
      setError('Please set at least one rate');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        space_id: spaceId,
        daily_rate: dailyRate ? parseFloat(dailyRate) : undefined,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : undefined,
        is_active: isActive,
      });
      setSpaceId('');
      setDailyRate('');
      setHourlyRate('');
      setIsActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Marketplace Listing</DialogTitle>
          <DialogDescription>List a space on the marketplace for rent</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="listing-space">Select Space *</Label>
            <select
              id="listing-space"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Choose a space...</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="daily-rate">Daily Rate ($)</Label>
              <Input
                id="daily-rate"
                type="number"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="hourly-rate">Hourly Rate ($)</Label>
              <Input
                id="hourly-rate"
                type="number"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="listing-active">Active on marketplace</Label>
            <Switch
              id="listing-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
          {error && <div className="text-sm text-primary-red">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Listing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
