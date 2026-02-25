/**
 * LocationAutocomplete - Reusable location input with autocomplete and GPS capture
 *
 * Features:
 * - Address autocomplete via Nominatim
 * - "Use My Location" button for GPS capture
 * - Structured location data output
 * - Fallback to freeform text if service unavailable
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAddressAutocomplete, GeocodingResult, useGeocoding } from '@/hooks/useGeocoding';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  MapPin,
  Navigation,
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';

export interface LocationData {
  displayName: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface LocationAutocompleteProps {
  /** Current value */
  value?: LocationData | string;
  /** Called when location changes */
  onChange: (value: LocationData) => void;
  /** Show the "Use My Location" button */
  showUseMyLocation?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** ID for the input */
  id?: string;
  /** Name for form handling */
  name?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Mode: 'address' for full addresses, 'city' for city/state only */
  mode?: 'address' | 'city';
}

/**
 * Convert a GeocodingResult to LocationData
 */
function resultToLocationData(result: GeocodingResult): LocationData {
  return {
    displayName: result.display_name,
    address: [result.address.house_number, result.address.street]
      .filter(Boolean)
      .join(' ') || undefined,
    city: result.address.city || undefined,
    state: result.address.state || undefined,
    stateCode: result.address.state_code || undefined,
    zip: result.address.postcode || undefined,
    country: result.address.country || undefined,
    latitude: result.lat,
    longitude: result.lng,
  };
}

export function LocationAutocomplete({
  value,
  onChange,
  showUseMyLocation = true,
  placeholder = 'Start typing an address...',
  disabled = false,
  className,
  id,
  name,
  required,
  mode = 'address',
}: LocationAutocompleteProps) {
  // Get display value from either string or LocationData
  const displayValue = typeof value === 'string' ? value : value?.displayName || '';

  const [inputValue, setInputValue] = useState(displayValue);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Geocoding hooks
  const { reverseGeocode, isReverseGeocoding } = useGeocoding();
  const {
    data: autocompleteData,
    isLoading: isAutocompleteLoading,
    isError: isAutocompleteError,
  } = useAddressAutocomplete(inputValue, {
    enabled: inputValue.length >= 3 && isOpen,
    mode: mode,
  });

  // Geolocation hook
  const {
    isSupported: isGeoSupported,
    loading: isGeoLoading,
    error: geoError,
    getCurrentPosition,
  } = useGeolocation();

  const results = autocompleteData?.results || [];
  const serviceAvailable = autocompleteData?.service_available ?? true;

  // Sync input with external value changes
  useEffect(() => {
    const newDisplay = typeof value === 'string' ? value : value?.displayName || '';
    if (newDisplay !== inputValue) {
      setInputValue(newDisplay);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setSelectedIndex(-1);

    // If user clears input, also clear the location data
    if (!newValue) {
      onChange({ displayName: '' });
    }
  };

  // Handle selection from dropdown
  const handleSelect = useCallback(
    (result: GeocodingResult) => {
      const locationData = resultToLocationData(result);
      setInputValue(locationData.displayName);
      onChange(locationData);
      setIsOpen(false);
      setSelectedIndex(-1);
    },
    [onChange]
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'ArrowDown' && inputValue.length >= 3) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle "Use My Location" button
  const handleUseMyLocation = async () => {
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      // Attempt reverse geocoding
      try {
        const response = await reverseGeocode(latitude, longitude);

        if (response.result) {
          const fullLocationData = resultToLocationData(response.result);

          // In city mode, only return city/state without coordinates
          if (mode === 'city') {
            // Use city from parsed data, or fall back to county from raw response
            const cityName = fullLocationData.city
              || response.result.address.county?.replace(/ County$/, '').replace(/ Parish$/, '')
              || '';
            const cityState = [cityName, fullLocationData.stateCode || fullLocationData.state]
              .filter(Boolean)
              .join(', ');
            const locationData: LocationData = {
              displayName: cityState || fullLocationData.displayName,
              city: cityName || undefined,
              state: fullLocationData.state,
              stateCode: fullLocationData.stateCode,
              // No coordinates for city mode
            };
            setInputValue(locationData.displayName);
            onChange(locationData);
          } else {
            // Full address mode - include coordinates
            setInputValue(fullLocationData.displayName);
            onChange(fullLocationData);
          }
        } else {
          // No address found
          if (mode === 'city') {
            // Can't determine city without reverse geocoding
            const locationData: LocationData = {
              displayName: 'Location detected (city unknown)',
            };
            setInputValue(locationData.displayName);
            onChange(locationData);
          } else {
            // Full address mode - use coordinates
            const locationData: LocationData = {
              displayName: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              latitude,
              longitude,
            };
            setInputValue(locationData.displayName);
            onChange(locationData);
          }
        }
      } catch {
        // Reverse geocoding failed
        if (mode === 'city') {
          const locationData: LocationData = {
            displayName: 'Location detected (city unknown)',
          };
          setInputValue(locationData.displayName);
          onChange(locationData);
        } else {
          const locationData: LocationData = {
            displayName: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            latitude,
            longitude,
          };
          setInputValue(locationData.displayName);
          onChange(locationData);
        }
      }
    } catch (err) {
      // GPS failed - error is handled by the hook
      console.error('Failed to get location:', err);
    }
  };

  // Handle blur - if user entered freeform text without selecting
  const handleBlur = () => {
    // Delay to allow click on dropdown items
    setTimeout(() => {
      if (isOpen) {
        setIsOpen(false);
      }
      // If input value changed but no selection was made, update as freeform
      const currentDisplay = typeof value === 'string' ? value : value?.displayName || '';
      if (inputValue && inputValue !== currentDisplay) {
        onChange({ displayName: inputValue });
      }
    }, 200);
  };

  const isLoading = isAutocompleteLoading || isGeoLoading || isReverseGeocoding;

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        {/* Main input */}
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            ref={inputRef}
            id={id}
            name={name}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => inputValue.length >= 3 && setIsOpen(true)}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className="pl-10 pr-8"
            autoComplete="off"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />
          )}
          {!isLoading && results.length > 0 && isOpen && (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          )}
        </div>

        {/* Use My Location button */}
        {showUseMyLocation && isGeoSupported && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleUseMyLocation}
            disabled={disabled || isGeoLoading || isReverseGeocoding}
            title="Use my current location"
            className="shrink-0"
          >
            {isGeoLoading || isReverseGeocoding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Error messages */}
      {geoError && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {geoError}
        </p>
      )}

      {!serviceAvailable && (
        <p className="mt-1 text-xs text-amber-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Address lookup unavailable. You can still enter an address manually.
        </p>
      )}

      {/* Autocomplete dropdown */}
      {isOpen && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-md border border-muted-gray/30 bg-charcoal-black shadow-lg max-h-60 overflow-auto"
        >
          {results.map((result, index) => (
            <button
              key={result.place_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm transition-colors',
                'hover:bg-muted-gray/20 focus:bg-muted-gray/20 focus:outline-none',
                index === selectedIndex && 'bg-muted-gray/20'
              )}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-bone-white truncate">{result.display_name}</p>
                  {result.address.city && result.address.state_code && (
                    <p className="text-xs text-gray-500">
                      {result.address.city}, {result.address.state_code}
                      {result.address.postcode && ` ${result.address.postcode}`}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && inputValue.length >= 3 && !isAutocompleteLoading && results.length === 0 && serviceAvailable && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-muted-gray/30 bg-charcoal-black shadow-lg p-3">
          <p className="text-sm text-gray-500">No addresses found. Try a different search term.</p>
        </div>
      )}
    </div>
  );
}

export default LocationAutocomplete;
