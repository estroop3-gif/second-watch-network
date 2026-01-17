/**
 * useAWSAddressAutocomplete - Hook for AWS Location Service address autocomplete
 *
 * Uses AWS Location Service via backend API for accurate US address search.
 * Includes debouncing and result caching.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useEffect } from 'react';

export interface AWSPlaceResult {
  place_id: string;
  label: string;
  lat: number;
  lon: number;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

export interface AWSAutocompleteResponse {
  results: AWSPlaceResult[];
  service_available: boolean;
}

/**
 * Hook for AWS-based address autocomplete
 * Debounces the query and fetches suggestions as the user types
 */
export function useAWSAddressAutocomplete(query: string, options?: {
  enabled?: boolean;
  debounceMs?: number;
  limit?: number;
}) {
  const { enabled = true, debounceMs = 300, limit = 5 } = options || {};
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
    queryKey: ['aws-geocoding', 'autocomplete', debouncedQuery, limit],
    queryFn: async (): Promise<AWSAutocompleteResponse> => {
      const response = await api.get<AWSAutocompleteResponse>(
        `/api/v1/geocoding/aws/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=${limit}`
      );
      return response;
    },
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}

export default useAWSAddressAutocomplete;
