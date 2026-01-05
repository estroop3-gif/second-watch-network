/**
 * useGeolocation - Hook for browser geolocation (GPS)
 *
 * Provides access to the device's current location via the Geolocation API.
 * Used for the "Use My Location" feature in location forms.
 */

import { useState, useCallback } from 'react';

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
  error: string | null;
  loading: boolean;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

const defaultOptions: GeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export function useGeolocation(options: GeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    error: null,
    loading: false,
  });

  const mergedOptions = { ...defaultOptions, ...options };

  /**
   * Check if geolocation is supported by the browser
   */
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  /**
   * Get the current position
   * Returns a promise that resolves with the position
   */
  const getCurrentPosition = useCallback(async (): Promise<GeolocationPosition> => {
    if (!isSupported) {
      const error = 'Geolocation is not supported by this browser';
      setState(prev => ({ ...prev, error, loading: false }));
      throw new Error(error);
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            error: null,
            loading: false,
          });
          resolve(position);
        },
        (error) => {
          let errorMessage: string;

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location unavailable. Please try again.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please try again.';
              break;
            default:
              errorMessage = 'An error occurred while getting your location.';
          }

          setState(prev => ({
            ...prev,
            error: errorMessage,
            loading: false,
          }));
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge,
        }
      );
    });
  }, [isSupported, mergedOptions.enableHighAccuracy, mergedOptions.timeout, mergedOptions.maximumAge]);

  /**
   * Clear the current location state
   */
  const clearLocation = useCallback(() => {
    setState({
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp: null,
      error: null,
      loading: false,
    });
  }, []);

  return {
    ...state,
    isSupported,
    getCurrentPosition,
    clearLocation,
  };
}

export default useGeolocation;
