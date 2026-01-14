/**
 * MarketplaceFavoritesSection - Collapsible panel showing favorite gear houses
 */
import React, { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart,
  ChevronDown,
  ChevronRight,
  MapPin,
  BadgeCheck,
  Truck,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GearHouseFavorite, MarketplaceOrganizationEnriched } from '@/types/gear';

interface MarketplaceFavoritesSectionProps {
  favorites: GearHouseFavorite[];
  onViewGearHouse: (gearHouse: MarketplaceOrganizationEnriched) => void;
  onRemoveFavorite: (orgId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export default function MarketplaceFavoritesSection({
  favorites,
  onViewGearHouse,
  onRemoveFavorite,
  isLoading,
  className,
}: MarketplaceFavoritesSectionProps) {
  const [isOpen, setIsOpen] = useState(favorites.length > 0);

  if (favorites.length === 0 && !isLoading) {
    return null; // Don't show section if no favorites
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn('border rounded-lg bg-card', className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-between w-full p-3 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500 fill-red-500" />
            <span className="font-medium text-sm">My Favorites</span>
            <Badge variant="secondary" className="text-xs">
              {favorites.length}
            </Badge>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2">
          {favorites.map((favorite) => {
            const displayName = favorite.marketplace_name || favorite.organization_name || 'Gear House';
            const initials = displayName.slice(0, 2).toUpperCase();

            // Convert favorite to enriched org for view handler
            const gearHouseData: MarketplaceOrganizationEnriched = {
              id: favorite.organization_id,
              name: favorite.organization_name || '',
              marketplace_name: favorite.marketplace_name,
              marketplace_logo_url: favorite.marketplace_logo_url,
              location_display: favorite.location_display,
              location_latitude: favorite.location_latitude,
              location_longitude: favorite.location_longitude,
              lister_type: favorite.lister_type,
              is_verified: favorite.is_verified,
              offers_delivery: favorite.offers_delivery,
              delivery_radius_miles: favorite.delivery_radius_miles,
              listing_count: favorite.listing_count,
              is_favorited: true,
            };

            return (
              <div
                key={favorite.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                onClick={() => onViewGearHouse(gearHouseData)}
              >
                <Avatar className="h-9 w-9 rounded-lg flex-shrink-0">
                  <AvatarImage src={favorite.marketplace_logo_url} alt={displayName} />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{displayName}</span>
                    {favorite.is_verified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {favorite.location_display && (
                      <span className="text-xs text-muted-foreground truncate">
                        {favorite.location_display}
                      </span>
                    )}
                    {favorite.offers_delivery && (
                      <Truck className="h-3 w-3 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {favorite.listing_count || 0}
                  </span>
                  <Package className="h-3 w-3 text-muted-foreground" />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFavorite(favorite.organization_id);
                  }}
                >
                  <Heart className="h-4 w-4 fill-current" />
                </Button>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
