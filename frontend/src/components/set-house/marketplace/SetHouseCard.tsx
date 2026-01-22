/**
 * SetHouseCard - Rich card displaying set house info for marketplace browsing
 *
 * Features:
 * - Name, location, distance badge
 * - Verified badge
 * - Top space types pills
 * - Delivery/visit availability badge
 * - Featured spaces thumbnails
 * - Heart icon for favorites
 */
import React from 'react';
import {
  MapPin,
  Heart,
  Car,
  BadgeCheck,
  Building2,
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
import type { MarketplaceOrganizationEnriched } from '@/types/set-house';

interface SetHouseCardProps {
  setHouse: MarketplaceOrganizationEnriched;
  onViewSpaces: (setHouse: MarketplaceOrganizationEnriched) => void;
  onToggleFavorite?: (setHouseId: string, isFavorited: boolean) => void;
  isTogglingFavorite?: boolean;
  className?: string;
}

export default function SetHouseCard({
  setHouse,
  onViewSpaces,
  onToggleFavorite,
  isTogglingFavorite,
  className,
}: SetHouseCardProps) {
  const displayName = setHouse.marketplace_name || setHouse.name;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/20 cursor-pointer',
        className
      )}
      onClick={() => onViewSpaces(setHouse)}
    >
      <CardContent className="p-4">
        {/* Header: Logo, Name, Favorite */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="h-12 w-12 rounded-lg">
            <AvatarImage src={setHouse.marketplace_logo_url} alt={displayName} />
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{displayName}</h3>
              {setHouse.is_verified && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent>Verified Set House</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Location and Distance */}
            <div className="flex items-center gap-2 mt-0.5">
              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {setHouse.location_display || 'Location not specified'}
              </span>
              {setHouse.distance_miles !== undefined && (
                <Badge variant="secondary" className="text-xs py-0 px-1.5 flex-shrink-0">
                  {setHouse.distance_miles < 1
                    ? '< 1 mi'
                    : `${Math.round(setHouse.distance_miles)} mi`}
                </Badge>
              )}
            </div>
          </div>

          {/* Favorite Button */}
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 flex-shrink-0',
                setHouse.is_favorited && 'text-red-500'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(setHouse.id, !setHouse.is_favorited);
              }}
              disabled={isTogglingFavorite}
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  setHouse.is_favorited && 'fill-current'
                )}
              />
            </Button>
          )}
        </div>

        {/* Visit Available Badge */}
        {setHouse.can_deliver_to_user && (
          <div className="mb-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-500/10 text-green-600 border-green-500/20"
                  >
                    <Car className="h-3 w-3 mr-1" />
                    Within your travel range
                    {setHouse.estimated_delivery_fee !== undefined && (
                      <span className="ml-1 text-muted-foreground">
                        (~{Math.round(setHouse.distance_miles || 0)} mi)
                      </span>
                    )}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  This set house is within your preferred travel distance
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}

        {/* Top Categories (Space Types) */}
        {setHouse.top_categories && setHouse.top_categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {setHouse.top_categories.slice(0, 4).map((cat) => (
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

        {/* Featured Spaces Preview */}
        {setHouse.featured_items && setHouse.featured_items.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {setHouse.featured_items.slice(0, 4).map((item, idx) => (
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
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {setHouse.listing_count && setHouse.listing_count > 4 && (
              <span className="text-xs text-muted-foreground">
                +{setHouse.listing_count - 4} more
              </span>
            )}
          </div>
        )}

        {/* View Spaces Link */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            {setHouse.listing_count || 0} spaces available
          </span>
          <div className="flex items-center text-xs text-primary font-medium group-hover:underline">
            View spaces
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact list variant of SetHouseCard
 */
export function SetHouseListItem({
  setHouse,
  onViewSpaces,
  onToggleFavorite,
  isTogglingFavorite,
  className,
}: SetHouseCardProps) {
  const displayName = setHouse.marketplace_name || setHouse.name;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors',
        className
      )}
      onClick={() => onViewSpaces(setHouse)}
    >
      <Avatar className="h-10 w-10 rounded-lg flex-shrink-0">
        <AvatarImage src={setHouse.marketplace_logo_url} alt={displayName} />
        <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{displayName}</span>
          {setHouse.is_verified && (
            <BadgeCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
          )}
          {setHouse.can_deliver_to_user && (
            <Badge
              variant="outline"
              className="text-xs py-0 px-1.5 bg-green-500/10 text-green-600 border-green-500/20"
            >
              <Car className="h-3 w-3 mr-1" />
              Nearby
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {setHouse.location_display || 'Location not specified'}
          </span>
          {setHouse.distance_miles !== undefined && (
            <span className="text-xs text-muted-foreground">
              {setHouse.distance_miles < 1
                ? '< 1 mi away'
                : `${Math.round(setHouse.distance_miles)} mi away`}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {setHouse.listing_count || 0} spaces
        </span>
        {onToggleFavorite && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8',
              setHouse.is_favorited && 'text-red-500'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(setHouse.id, !setHouse.is_favorited);
            }}
            disabled={isTogglingFavorite}
          >
            <Heart
              className={cn(
                'h-4 w-4',
                setHouse.is_favorited && 'fill-current'
              )}
            />
          </Button>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
