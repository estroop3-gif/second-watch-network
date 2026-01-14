/**
 * GearHouseDrawer - Slide-out drawer showing gear house inventory
 *
 * Opens when clicking a gear house card, allows browsing and adding to cart
 */
import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin,
  Search,
  BadgeCheck,
  Truck,
  ExternalLink,
  Phone,
  Mail,
  Package,
  Heart,
  Loader2,
  Plus,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMarketplaceSearch } from '@/hooks/gear';
import { ListingCard } from './ListingCard';
import { ListingDetailDialog } from './ListingDetailDialog';
import { useGearCartContext } from '@/context/GearCartContext';
import type {
  MarketplaceOrganizationEnriched,
  GearMarketplaceListing,
  GearCategory,
} from '@/types/gear';

interface GearHouseDrawerProps {
  gearHouse: MarketplaceOrganizationEnriched | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart?: (listing: GearMarketplaceListing) => void;
  onRemoveFromCart?: (listing: GearMarketplaceListing) => void;
  selectedItems?: GearMarketplaceListing[];
  onToggleFavorite?: (gearHouseId: string, isFavorited: boolean) => void;
  categories?: GearCategory[];
  // Enable cart system instead of local selection
  useCart?: boolean;
  // Optional backlot project ID for cart item tagging
  backlotProjectId?: string;
}

export default function GearHouseDrawer({
  gearHouse,
  open,
  onOpenChange,
  onAddToCart,
  onRemoveFromCart,
  selectedItems = [],
  onToggleFavorite,
  categories = [],
  useCart = false,
  backlotProjectId,
}: GearHouseDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [viewingListing, setViewingListing] = useState<GearMarketplaceListing | null>(null);
  const [dateRange, setDateRange] = useState<{
    available_from?: string;
    available_to?: string;
  }>({});

  // Get cart context for badge count
  const { totalItems, toggleCart } = useGearCartContext();

  // Fetch listings for this gear house using organization_id filter
  const { listings, isLoading } = useMarketplaceSearch({
    q: searchQuery || undefined,
    category_id: selectedCategory || undefined,
    organization_id: gearHouse?.id,
    available_from: dateRange.available_from,
    available_to: dateRange.available_to,
    limit: 100,
  }, !!gearHouse?.id && open);

  if (!gearHouse) return null;

  const displayName = gearHouse.marketplace_name || gearHouse.name;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 pb-0 space-y-0">
          <div className="flex items-start gap-3">
            <Avatar className="h-14 w-14 rounded-lg">
              <AvatarImage src={gearHouse.marketplace_logo_url} alt={displayName} />
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-lg truncate">{displayName}</SheetTitle>
                {gearHouse.is_verified && (
                  <BadgeCheck className="h-5 w-5 text-blue-500 flex-shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {gearHouse.location_display || 'Location not specified'}
                </span>
                {gearHouse.distance_miles !== undefined && (
                  <Badge variant="secondary" className="text-xs py-0 px-1.5">
                    {gearHouse.distance_miles < 1
                      ? '< 1 mi'
                      : `${Math.round(gearHouse.distance_miles)} mi`}
                  </Badge>
                )}
              </div>

              {/* Badges Row */}
              <div className="flex items-center gap-2 mt-2">
                {gearHouse.can_deliver_to_user && (
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
                  >
                    <Truck className="h-3 w-3 mr-1" />
                    Delivers to you
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  <Package className="h-3 w-3 mr-1" />
                  {gearHouse.listing_count || 0} items
                </Badge>
              </div>
            </div>

            {/* Cart and Favorite Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9"
                onClick={toggleCart}
              >
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary-red text-white"
                    variant="destructive"
                  >
                    {totalItems > 99 ? '99+' : totalItems}
                  </Badge>
                )}
              </Button>
              {onToggleFavorite && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-9 w-9',
                    gearHouse.is_favorited && 'text-red-500'
                  )}
                  onClick={() => onToggleFavorite(gearHouse.id, !gearHouse.is_favorited)}
                >
                  <Heart
                    className={cn(
                      'h-5 w-5',
                      gearHouse.is_favorited && 'fill-current'
                    )}
                  />
                </Button>
              )}
            </div>
          </div>

          {/* Contact Info */}
          {(gearHouse.contact_email || gearHouse.contact_phone) && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t">
              {gearHouse.contact_email && (
                <a
                  href={`mailto:${gearHouse.contact_email}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {gearHouse.contact_email}
                </a>
              )}
              {gearHouse.contact_phone && (
                <a
                  href={`tel:${gearHouse.contact_phone}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {gearHouse.contact_phone}
                </a>
              )}
            </div>
          )}
        </SheetHeader>

        {/* Search and Filter */}
        <div className="p-4 border-b space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={selectedCategory || '_all'}
              onValueChange={(val) => setSelectedCategory(val === '_all' ? '' : val)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                type="date"
                value={dateRange.available_from || ''}
                onChange={(e) => setDateRange(prev => ({
                  ...prev,
                  available_from: e.target.value
                }))}
                min={new Date().toISOString().split('T')[0]}
                placeholder="Available from"
                className="text-sm"
              />
            </div>
            <span className="text-sm text-muted-foreground">to</span>
            <div className="flex-1">
              <Input
                type="date"
                value={dateRange.available_to || ''}
                onChange={(e) => setDateRange(prev => ({
                  ...prev,
                  available_to: e.target.value
                }))}
                min={dateRange.available_from || new Date().toISOString().split('T')[0]}
                placeholder="Available to"
                className="text-sm"
              />
            </div>
            {(dateRange.available_from || dateRange.available_to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange({})}
                className="px-2"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Listings */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {searchQuery || selectedCategory
                    ? 'No items match your search'
                    : 'No items available'}
                </p>
              </div>
            ) : (
              listings.map((listing: GearMarketplaceListing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  viewMode="list"
                  isSelected={!useCart ? selectedItems.some(item => item.id === listing.id) : undefined}
                  onView={() => setViewingListing(listing)}
                  onAddToQuote={!useCart ? () => onAddToCart?.(listing) : undefined}
                  onRemoveFromQuote={!useCart ? () => onRemoveFromCart?.(listing) : undefined}
                  useCart={useCart}
                  backlotProjectId={backlotProjectId}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>

        {/* Listing Detail Dialog */}
        <ListingDetailDialog
          listing={viewingListing}
          isOpen={!!viewingListing}
          onClose={() => setViewingListing(null)}
          onRequestQuote={() => {
            if (viewingListing) onAddToCart?.(viewingListing);
            setViewingListing(null);
          }}
          onAddToQuote={() => {
            if (viewingListing) onAddToCart?.(viewingListing);
            setViewingListing(null);
          }}
          isInQuote={viewingListing ? selectedItems.some(item => item.id === viewingListing.id) : false}
        />
      </SheetContent>
    </Sheet>
  );
}
