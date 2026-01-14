/**
 * GearHouseCard - Rich card displaying gear house info for marketplace browsing
 *
 * Features:
 * - Name, location, distance badge
 * - Verified badge
 * - Top categories pills
 * - Delivery eligibility badge
 * - Featured items thumbnails
 * - Heart icon for favorites
 */
import React from 'react';
import {
  MapPin,
  Heart,
  Truck,
  BadgeCheck,
  Package,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { MarketplaceOrganizationEnriched } from '@/types/gear';

interface GearHouseCardProps {
  gearHouse: MarketplaceOrganizationEnriched;
  onViewInventory: (gearHouse: MarketplaceOrganizationEnriched) => void;
  onToggleFavorite: (gearHouseId: string, isFavorited: boolean) => void;
  isTogglingFavorite?: boolean;
  className?: string;
}

export default function GearHouseCard({
  gearHouse,
  onViewInventory,
  onToggleFavorite,
  isTogglingFavorite,
  className,
}: GearHouseCardProps) {
  const displayName = gearHouse.marketplace_name || gearHouse.name;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/20 cursor-pointer',
        className
      )}
      onClick={() => onViewInventory(gearHouse)}
    >
      <CardContent className="p-4">
        {/* Header: Logo, Name, Favorite */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-12 w-12 rounded-lg">
            <AvatarImage src={gearHouse.marketplace_logo_url} alt={displayName} />
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{displayName}</h3>
              {gearHouse.is_verified && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>Verified Rental House</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Location and Distance */}
            <div className="flex items-center gap-2 mt-0.5">
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {gearHouse.location_display || 'Location not specified'}
              </span>
              {gearHouse.distance_miles !== undefined && (
                <Badge variant="secondary" className="text-xs py-0 px-1.5 flex-shrink-0">
                  {gearHouse.distance_miles < 1
                    ? '< 1 mi'
                    : `${Math.round(gearHouse.distance_miles)} mi`}
                </Badge>
              )}
            </div>
          </div>

          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 flex-shrink-0',
              gearHouse.is_favorited && 'text-red-500'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(gearHouse.id, !gearHouse.is_favorited);
            }}
            disabled={isTogglingFavorite}
          >
            <Heart
              className={cn(
                'h-4 w-4',
                gearHouse.is_favorited && 'fill-current'
              )}
            />
          </Button>
        </div>

        {/* Delivery Badge */}
        {gearHouse.can_deliver_to_user && (
          <div className="mb-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
                  >
                    <Truck className="h-3 w-3 mr-1" />
                    Delivers to you
                    {gearHouse.estimated_delivery_fee !== undefined && (
                      <span className="ml-1 text-muted-foreground">
                        (~${gearHouse.estimated_delivery_fee.toFixed(0)})
                      </span>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  This gear house can deliver to your location
                  {gearHouse.delivery_radius_miles && (
                    <span className="block text-xs text-muted-foreground">
                      Delivery radius: {gearHouse.delivery_radius_miles} miles
                    </span>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Top Categories */}
        {gearHouse.top_categories && gearHouse.top_categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {gearHouse.top_categories.slice(0, 4).map((cat) => (
              <Badge
                key={cat.id}
                variant="secondary"
                className="text-xs py-0 px-1.5"
              >
                {cat.name}
                <span className="ml-1 text-muted-foreground">({cat.count})</span>
              </Badge>
            ))}
          </div>
        )}

        {/* Featured Items Preview */}
        {gearHouse.featured_items && gearHouse.featured_items.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {gearHouse.featured_items.slice(0, 4).map((item, idx) => (
                <div
                  key={item.id}
                  className="h-10 w-10 rounded-md border-2 border-background bg-muted overflow-hidden"
                  style={{ zIndex: 4 - idx }}
                >
                  {item.photo_url ? (
                    <img
                      src={item.photo_url}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {gearHouse.listing_count && gearHouse.listing_count > 4 && (
              <span className="text-xs text-muted-foreground">
                +{gearHouse.listing_count - 4} more
              </span>
            )}
          </div>
        )}

        {/* View Inventory Link */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            {gearHouse.listing_count || 0} items available
          </span>
          <div className="flex items-center text-xs text-primary font-medium group-hover:underline">
            View inventory
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact list variant of GearHouseCard
 */
export function GearHouseListItem({
  gearHouse,
  onViewInventory,
  onToggleFavorite,
  isTogglingFavorite,
  className,
}: GearHouseCardProps) {
  const displayName = gearHouse.marketplace_name || gearHouse.name;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors',
        className
      )}
      onClick={() => onViewInventory(gearHouse)}
    >
      <Avatar className="h-10 w-10 rounded-lg flex-shrink-0">
        <AvatarImage src={gearHouse.marketplace_logo_url} alt={displayName} />
        <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{displayName}</span>
          {gearHouse.is_verified && (
            <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
          )}
          {gearHouse.can_deliver_to_user && (
            <Badge
              variant="outline"
              className="text-xs py-0 px-1.5 bg-green-500/10 text-green-600 border-green-500/20"
            >
              <Truck className="h-3 w-3 mr-1" />
              Delivers
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {gearHouse.location_display || 'Location not specified'}
          </span>
          {gearHouse.distance_miles !== undefined && (
            <span className="text-xs text-muted-foreground">
              {gearHouse.distance_miles < 1
                ? '< 1 mi away'
                : `${Math.round(gearHouse.distance_miles)} mi away`}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {gearHouse.listing_count || 0} items
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            gearHouse.is_favorited && 'text-red-500'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(gearHouse.id, !gearHouse.is_favorited);
          }}
          disabled={isTogglingFavorite}
        >
          <Heart
            className={cn(
              'h-4 w-4',
              gearHouse.is_favorited && 'fill-current'
            )}
          />
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
