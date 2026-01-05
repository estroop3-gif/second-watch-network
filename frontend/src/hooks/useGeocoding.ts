/**
 * useGeocoding - Hooks for geocoding operations
 *
 * Provides address autocomplete, forward geocoding, and reverse geocoding
 * via the backend Nominatim proxy.
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';

// Types matching backend response
export interface AddressComponents {
  house_number?: string;
  street?: string;
  city?: string;
  state?: string;
  state_code?: string;
  postcode?: string;
  county?: string;
  country: string;
  country_code: string;
}

export interface GeocodingResult {
  place_id: string;
  display_name: string;
  address: AddressComponents;
  lat: number;
  lng: number;
  importance: number;
  type?: string;
  category?: string;
}

export interface AutocompleteResponse {
  results: GeocodingResult[];
  cached: boolean;
  service_available: boolean;
}

export interface ReverseGeocodeResponse {
  result: GeocodingResult | null;
  cached: boolean;
  service_available: boolean;
}

/**
 * Hook for address autocomplete
 * Debounces the query and fetches suggestions as the user types
 */
export function useAddressAutocomplete(query: string, options?: {
  enabled?: boolean;
  debounceMs?: number;
  limit?: number;
  mode?: 'address' | 'city';
}) {
  const { enabled = true, debounceMs = 300, limit = 5, mode = 'address' } = options || {};
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  const shouldFetch = enabled && debouncedQuery.length >= 3;

  return useQuery({
    queryKey: ['geocoding', 'autocomplete', debouncedQuery, limit, mode],
    queryFn: async (): Promise<AutocompleteResponse> => {
      const response = await api.get<AutocompleteResponse>(
        `/api/v1/geocoding/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=${limit}&mode=${mode}`
      );
      return response;
    },
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for forward geocoding (address to coordinates)
 */
export function useForwardGeocode(address: string, options?: { enabled?: boolean }) {
  const { enabled = true } = options || {};
  const shouldFetch = enabled && address.length >= 5;

  return useQuery({
    queryKey: ['geocoding', 'forward', address],
    queryFn: async (): Promise<AutocompleteResponse> => {
      const response = await api.get<AutocompleteResponse>(
        `/api/v1/geocoding/forward?address=${encodeURIComponent(address)}`
      );
      return response;
    },
    enabled: shouldFetch,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for reverse geocoding (coordinates to address)
 */
export function useReverseGeocode(
  lat: number | null,
  lng: number | null,
  options?: { enabled?: boolean }
) {
  const { enabled = true } = options || {};
  const shouldFetch = enabled && lat !== null && lng !== null;

  return useQuery({
    queryKey: ['geocoding', 'reverse', lat, lng],
    queryFn: async (): Promise<ReverseGeocodeResponse> => {
      const response = await api.get<ReverseGeocodeResponse>(
        `/api/v1/geocoding/reverse?lat=${lat}&lng=${lng}`
      );
      return response;
    },
    enabled: shouldFetch,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    refetchOnWindowFocus: false,
  });
}

/**
 * Mutation hook for on-demand reverse geocoding
 * Use this when you need to geocode coordinates imperatively (e.g., after GPS capture)
 */
export function useReverseGeocodeMutation() {
  return useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }): Promise<ReverseGeocodeResponse> => {
      const response = await api.get<ReverseGeocodeResponse>(
        `/api/v1/geocoding/reverse?lat=${lat}&lng=${lng}`
      );
      return response;
    },
  });
}

/**
 * Combined hook that provides all geocoding functionality
 */
export function useGeocoding() {
  const reverseGeocodeMutation = useReverseGeocodeMutation();

  /**
   * Reverse geocode coordinates imperatively
   */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      return reverseGeocodeMutation.mutateAsync({ lat, lng });
    },
    [reverseGeocodeMutation]
  );

  return {
    // Hooks for declarative usage
    useAutocomplete: useAddressAutocomplete,
    useForward: useForwardGeocode,
    useReverse: useReverseGeocode,

    // Imperative functions
    reverseGeocode,
    isReverseGeocoding: reverseGeocodeMutation.isPending,
    reverseGeocodeError: reverseGeocodeMutation.error,
  };
}

export default useGeocoding;
