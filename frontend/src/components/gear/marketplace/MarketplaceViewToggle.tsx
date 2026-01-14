/**
 * MarketplaceViewToggle - Toggle between map, grid, and list views
 * MarketplaceResultModeToggle - Toggle between gear houses and gear items
 */
import React from 'react';
import { Map, Grid3X3, List, Building2, Package } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ViewMode, ResultMode } from '@/types/gear';

interface MarketplaceViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function MarketplaceViewToggle({
  viewMode,
  onViewModeChange,
  className,
}: MarketplaceViewToggleProps) {
  return (
    <TooltipProvider>
      <ToggleGroup
        type="single"
        value={viewMode}
        onValueChange={(value) => value && onViewModeChange(value as ViewMode)}
        className={cn('bg-muted/50 p-1 rounded-lg', className)}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="map"
              aria-label="Map view"
              className="data-[state=on]:bg-background"
            >
              <Map className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Map view</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="grid"
              aria-label="Grid view"
              className="data-[state=on]:bg-background"
            >
              <Grid3X3 className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>Grid view</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value="list"
              aria-label="List view"
              className="data-[state=on]:bg-background"
            >
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>List view</TooltipContent>
        </Tooltip>
      </ToggleGroup>
    </TooltipProvider>
  );
}

interface MarketplaceResultModeToggleProps {
  resultMode: ResultMode;
  onResultModeChange: (mode: ResultMode) => void;
  gearHouseCount?: number;
  itemCount?: number;
  className?: string;
}

export function MarketplaceResultModeToggle({
  resultMode,
  onResultModeChange,
  gearHouseCount,
  itemCount,
  className,
}: MarketplaceResultModeToggleProps) {
  return (
    <Tabs
      value={resultMode}
      onValueChange={(value) => onResultModeChange(value as ResultMode)}
      className={className}
    >
      <TabsList className="bg-muted/50">
        <TabsTrigger
          value="gear_houses"
          className="gap-2 data-[state=active]:bg-background"
        >
          <Building2 className="h-4 w-4" />
          <span>Gear Houses</span>
          {gearHouseCount !== undefined && (
            <span className="text-xs text-muted-foreground ml-1">
              ({gearHouseCount})
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="gear_items"
          className="gap-2 data-[state=active]:bg-background"
        >
          <Package className="h-4 w-4" />
          <span>Gear for Rent</span>
          {itemCount !== undefined && (
            <span className="text-xs text-muted-foreground ml-1">
              ({itemCount})
            </span>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

/**
 * Delivery filter toggle
 */
interface DeliveryFilterToggleProps {
  deliveryToMeOnly: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export function DeliveryFilterToggle({
  deliveryToMeOnly,
  onToggle,
  className,
}: DeliveryFilterToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onToggle(!deliveryToMeOnly)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
              deliveryToMeOnly
                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              className
            )}
          >
            <div
              className={cn(
                'h-4 w-4 rounded-full border-2 flex items-center justify-center',
                deliveryToMeOnly
                  ? 'border-green-500 bg-green-500'
                  : 'border-muted-foreground'
              )}
            >
              {deliveryToMeOnly && (
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </div>
            Delivers to me
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {deliveryToMeOnly
            ? 'Showing only gear houses that can deliver to your location'
            : 'Click to filter to gear houses that deliver to you'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
