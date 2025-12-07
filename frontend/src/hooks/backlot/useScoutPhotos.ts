/**
 * useScoutPhotos - Hooks for managing location scout photos
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotScoutPhoto,
  BacklotScoutPhotoInput,
  ScoutPhotoFilters,
  ScoutPhotosResponse,
  ScoutPhotoResponse,
  BacklotScoutSummary,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get all scout photos for a location with optional filters
 */
export function useScoutPhotos(locationId: string | null, filters?: ScoutPhotoFilters) {
  return useQuery({
    queryKey: ['scout-photos', locationId, filters],
    queryFn: async (): Promise<ScoutPhotosResponse> => {
      if (!locationId) {
        return { success: true, photos: [], count: 0 };
      }

      const params = new URLSearchParams();
      if (filters?.vantage_type) params.set('vantage_type', filters.vantage_type);
      if (filters?.time_of_day) params.set('time_of_day', filters.time_of_day);
      if (filters?.interior_exterior) params.set('interior_exterior', filters.interior_exterior);

      const queryString = params.toString();
      const endpoint = `/api/v1/backlot/locations/${locationId}/scout-photos${queryString ? `?${queryString}` : ''}`;

      return api.get<ScoutPhotosResponse>(endpoint);
    },
    enabled: !!locationId,
  });
}

/**
 * Get a single scout photo by ID
 */
export function useScoutPhoto(photoId: string | null) {
  return useQuery({
    queryKey: ['scout-photo', photoId],
    queryFn: async (): Promise<BacklotScoutPhoto | null> => {
      if (!photoId) return null;

      const response = await api.get<ScoutPhotoResponse>(
        `/api/v1/backlot/location-scout-photos/${photoId}`
      );
      return response.photo;
    },
    enabled: !!photoId,
  });
}

/**
 * Get scout summary for a location (for call sheet preview)
 */
export function useScoutSummary(locationId: string | null) {
  return useQuery({
    queryKey: ['scout-summary', locationId],
    queryFn: async (): Promise<BacklotScoutSummary> => {
      if (!locationId) {
        return {
          success: true,
          has_scout_photos: false,
          primary_photo: null,
          photo_count: 0,
          practical_summary: null,
          tags: [],
        };
      }

      return api.get<BacklotScoutSummary>(
        `/api/v1/backlot/locations/${locationId}/scout-summary`
      );
    },
    enabled: !!locationId,
  });
}

/**
 * Hook for scout photo mutations (create, update, delete)
 */
export function useScoutPhotoMutations(locationId: string | null) {
  const queryClient = useQueryClient();

  // Create a new scout photo
  const createScoutPhoto = useMutation({
    mutationFn: async (input: BacklotScoutPhotoInput): Promise<BacklotScoutPhoto> => {
      if (!locationId) throw new Error('Location ID is required');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/locations/${locationId}/scout-photos`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create scout photo' }));
        throw new Error(error.detail || 'Failed to create scout photo');
      }

      const data = await response.json();
      return data.photo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-photos', locationId] });
      queryClient.invalidateQueries({ queryKey: ['scout-summary', locationId] });
      queryClient.invalidateQueries({ queryKey: ['global-locations'] });
      queryClient.invalidateQueries({ queryKey: ['project-locations'] });
    },
  });

  // Update a scout photo
  const updateScoutPhoto = useMutation({
    mutationFn: async ({
      photoId,
      ...input
    }: Partial<BacklotScoutPhotoInput> & { photoId: string }): Promise<BacklotScoutPhoto> => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/location-scout-photos/${photoId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update scout photo' }));
        throw new Error(error.detail || 'Failed to update scout photo');
      }

      const data = await response.json();
      return data.photo;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scout-photos', locationId] });
      queryClient.invalidateQueries({ queryKey: ['scout-photo', variables.photoId] });
      queryClient.invalidateQueries({ queryKey: ['scout-summary', locationId] });
    },
  });

  // Delete a scout photo
  const deleteScoutPhoto = useMutation({
    mutationFn: async (photoId: string): Promise<void> => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/location-scout-photos/${photoId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete scout photo' }));
        throw new Error(error.detail || 'Failed to delete scout photo');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-photos', locationId] });
      queryClient.invalidateQueries({ queryKey: ['scout-summary', locationId] });
      queryClient.invalidateQueries({ queryKey: ['global-locations'] });
      queryClient.invalidateQueries({ queryKey: ['project-locations'] });
    },
  });

  // Set a photo as primary
  const setAsPrimary = useMutation({
    mutationFn: async (photoId: string): Promise<BacklotScoutPhoto> => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/location-scout-photos/${photoId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ is_primary: true }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to set as primary' }));
        throw new Error(error.detail || 'Failed to set as primary');
      }

      const data = await response.json();
      return data.photo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-photos', locationId] });
      queryClient.invalidateQueries({ queryKey: ['scout-summary', locationId] });
    },
  });

  return {
    createScoutPhoto,
    updateScoutPhoto,
    deleteScoutPhoto,
    setAsPrimary,
  };
}

// Constants for scout photo options
export const VANTAGE_TYPES = [
  { value: 'wide', label: 'Wide' },
  { value: 'medium', label: 'Medium' },
  { value: 'close-up', label: 'Close-up' },
  { value: 'detail', label: 'Detail' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'drone', label: 'Drone' },
];

export const TIME_OF_DAY_OPTIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'midday', label: 'Midday' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'golden_hour', label: 'Golden Hour' },
  { value: 'blue_hour', label: 'Blue Hour' },
  { value: 'night', label: 'Night' },
];

export const WEATHER_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'overcast', label: 'Overcast' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'rainy', label: 'Rainy' },
  { value: 'foggy', label: 'Foggy' },
  { value: 'snowy', label: 'Snowy' },
];

export const INTERIOR_EXTERIOR_OPTIONS = [
  { value: 'interior', label: 'Interior' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'both', label: 'Both' },
];

export const CAMERA_FACING_OPTIONS = [
  { value: 'north', label: 'North' },
  { value: 'north-east', label: 'North-East' },
  { value: 'east', label: 'East' },
  { value: 'south-east', label: 'South-East' },
  { value: 'south', label: 'South' },
  { value: 'south-west', label: 'South-West' },
  { value: 'west', label: 'West' },
  { value: 'north-west', label: 'North-West' },
];

// Common angle label suggestions
export const ANGLE_LABEL_SUGGESTIONS = [
  'Front Entrance',
  'Main Entrance',
  'Back Entrance',
  'Side View',
  'Parking Lot',
  'Loading Dock',
  'Main Interior',
  'Kitchen',
  'Living Room',
  'Bedroom',
  'Bathroom',
  'Office',
  'Hallway',
  'Staircase',
  'Rooftop',
  'Backyard',
  'Patio',
  'Garage',
  'Basement',
  'Attic',
];
