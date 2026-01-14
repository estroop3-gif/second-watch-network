/**
 * MarketplaceLocationBar - Location detection and selection for marketplace search
 *
 * Features:
 * - Shows current search location
 * - Browser geolocation button
 * - Manual location override
 * - Radius selector dropdown
 */
import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserLocation, RadiusMiles, LocationSource } from '@/types/gear';

interface MarketplaceLocationBarProps {
  currentLocation: UserLocation | null;
  radiusMiles: RadiusMiles;
  onRadiusChange: (radius: RadiusMiles) => void;
  onRequestBrowserLocation: () => Promise<UserLocation>;
  onSetManualLocation: (location: { latitude: number; longitude: number; name?: string }) => void;
  isUpdating?: boolean;
  className?: string;
}

const RADIUS_OPTIONS: RadiusMiles[] = [25, 50, 100, 250];

export default function MarketplaceLocationBar({
  currentLocation,
  radiusMiles,
  onRadiusChange,
  onRequestBrowserLocation,
  onSetManualLocation,
  isUpdating,
  className,
}: MarketplaceLocationBarProps) {
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Request browser location
  const handleRequestBrowserLocation = async () => {
    setIsGettingLocation(true);
    setLocationError(null);
    try {
      await onRequestBrowserLocation();
    } catch (error) {
      setLocationError('Could not get your location. Please enable location access or enter manually.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Geocode manual location input using AWS Location Service via API
  const handleManualLocationSubmit = async () => {
    if (!manualLocationInput.trim()) return;

    setIsGeocoding(true);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE}/api/v1/gear/marketplace/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ address: manualLocationInput }),
      });

      if (response.ok) {
        const data = await response.json();
        onSetManualLocation({
          latitude: data.latitude,
          longitude: data.longitude,
          name: data.display_name?.split(',').slice(0, 2).join(',') || manualLocationInput,
        });
        setIsEditingLocation(false);
        setManualLocationInput('');
      } else {
        setLocationError('Could not find that location. Try a city name or zip code.');
      }
    } catch (error) {
      setLocationError('Error searching for location. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Get source badge text
  const getSourceBadge = (source: LocationSource) => {
    switch (source) {
      case 'browser': return 'GPS';
      case 'profile': return 'Profile';
      case 'manual': return 'Custom';
      default: return '';
    }
  };

  return (
    <div className={cn('flex items-center gap-3 bg-muted/30 rounded-lg p-3', className)}>
      {/* Location Display/Edit */}
      <Popover open={isEditingLocation} onOpenChange={setIsEditingLocation}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-2 h-auto py-1.5 px-3 hover:bg-muted"
          >
            <MapPin className="h-4 w-4 text-primary" />
            {currentLocation ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {currentLocation.name || `${currentLocation.latitude.toFixed(2)}, ${currentLocation.longitude.toFixed(2)}`}
                </span>
                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                  {getSourceBadge(currentLocation.source)}
                </Badge>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Set location...</span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Search Location</Label>
              <p className="text-xs text-muted-foreground">
                Find gear houses near this location
              </p>
            </div>

            {/* Browser Geolocation Button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleRequestBrowserLocation}
              disabled={isGettingLocation}
            >
              {isGettingLocation ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              Use my current location
            </Button>

            {/* Manual Location Input */}
            <div className="space-y-2">
              <Label>Or enter a location</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="City, State or ZIP code"
                  value={manualLocationInput}
                  onChange={(e) => setManualLocationInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualLocationSubmit()}
                />
                <Button
                  size="sm"
                  onClick={handleManualLocationSubmit}
                  disabled={isGeocoding || !manualLocationInput.trim()}
                >
                  {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Go'}
                </Button>
              </div>
            </div>

            {/* Error Message */}
            {locationError && (
              <p className="text-xs text-destructive">{locationError}</p>
            )}

            {/* Current Location Info */}
            {currentLocation && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Currently searching near: {currentLocation.name || 'your location'}
                </p>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* Radius Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto py-1.5 px-3 gap-2">
            <span className="text-sm">Within {radiusMiles} miles</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {RADIUS_OPTIONS.map((radius) => (
            <DropdownMenuItem
              key={radius}
              onClick={() => onRadiusChange(radius)}
              className={cn(radiusMiles === radius && 'bg-muted')}
            >
              Within {radius} miles
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Loading Indicator */}
      {isUpdating && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
