/**
 * useLocations - Hook for managing production locations
 * Supports both project-specific locations and global location library
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import {
  BacklotLocation,
  BacklotLocationInput,
  BacklotLocationAttachmentInput,
  BacklotLocationSearchParams,
  BacklotLocationSearchResponse,
} from '@/types/backlot';

// Legacy type alias for backwards compatibility
type LocationInput = BacklotLocationInput;

export function useLocations(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-locations', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: locationsData, error } = await supabase
        .from('backlot_locations')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });

      if (error) throw error;
      return (locationsData || []) as BacklotLocation[];
    },
    enabled: !!projectId,
  });

  const createLocation = useMutation({
    mutationFn: async ({ projectId, ...input }: LocationInput & { projectId: string }) => {
      const { data, error } = await supabase
        .from('backlot_locations')
        .insert({
          project_id: projectId,
          name: input.name,
          description: input.description || null,
          scene_description: input.scene_description || null,
          address: input.address || null,
          city: input.city || null,
          state: input.state || null,
          zip: input.zip || null,
          country: input.country || 'USA',
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          contact_name: input.contact_name || null,
          contact_phone: input.contact_phone || null,
          contact_email: input.contact_email || null,
          parking_notes: input.parking_notes || null,
          load_in_notes: input.load_in_notes || null,
          power_available: input.power_available ?? true,
          restrooms_available: input.restrooms_available ?? true,
          permit_required: input.permit_required ?? false,
          permit_notes: input.permit_notes || null,
          permit_obtained: input.permit_obtained ?? false,
          location_fee: input.location_fee || null,
          fee_notes: input.fee_notes || null,
          images: input.images || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotLocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-locations', projectId] });
    },
  });

  const updateLocation = useMutation({
    mutationFn: async ({ id, ...input }: Partial<LocationInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.scene_description !== undefined) updateData.scene_description = input.scene_description;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.city !== undefined) updateData.city = input.city;
      if (input.state !== undefined) updateData.state = input.state;
      if (input.zip !== undefined) updateData.zip = input.zip;
      if (input.country !== undefined) updateData.country = input.country;
      if (input.latitude !== undefined) updateData.latitude = input.latitude;
      if (input.longitude !== undefined) updateData.longitude = input.longitude;
      if (input.contact_name !== undefined) updateData.contact_name = input.contact_name;
      if (input.contact_phone !== undefined) updateData.contact_phone = input.contact_phone;
      if (input.contact_email !== undefined) updateData.contact_email = input.contact_email;
      if (input.parking_notes !== undefined) updateData.parking_notes = input.parking_notes;
      if (input.load_in_notes !== undefined) updateData.load_in_notes = input.load_in_notes;
      if (input.power_available !== undefined) updateData.power_available = input.power_available;
      if (input.restrooms_available !== undefined) updateData.restrooms_available = input.restrooms_available;
      if (input.permit_required !== undefined) updateData.permit_required = input.permit_required;
      if (input.permit_notes !== undefined) updateData.permit_notes = input.permit_notes;
      if (input.permit_obtained !== undefined) updateData.permit_obtained = input.permit_obtained;
      if (input.location_fee !== undefined) updateData.location_fee = input.location_fee;
      if (input.fee_notes !== undefined) updateData.fee_notes = input.fee_notes;
      if (input.images !== undefined) updateData.images = input.images;

      const { data, error } = await supabase
        .from('backlot_locations')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotLocation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-locations', projectId] });
    },
  });

  const deleteLocation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-locations', projectId] });
    },
  });

  return {
    locations: data || [],
    isLoading,
    error,
    refetch,
    createLocation,
    updateLocation,
    deleteLocation,
  };
}

// Fetch single location (legacy - uses Supabase directly)
export function useLocation(id: string | null) {
  return useQuery({
    queryKey: ['backlot-location', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('backlot_locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as BacklotLocation;
    },
    enabled: !!id,
  });
}

// =====================================================
// Global Location Library Hooks (API-based)
// =====================================================

/**
 * Search the global location library
 */
export function useGlobalLocationSearch(params: BacklotLocationSearchParams) {
  return useQuery({
    queryKey: ['global-locations', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params.query) queryParams.set('query', params.query);
      if (params.region) queryParams.set('region', params.region);
      if (params.city) queryParams.set('city', params.city);
      if (params.state) queryParams.set('state', params.state);
      if (params.location_type) queryParams.set('location_type', params.location_type);
      if (params.limit) queryParams.set('limit', params.limit.toString());
      if (params.offset) queryParams.set('offset', params.offset.toString());

      const queryString = queryParams.toString();
      const endpoint = `/api/v1/backlot/locations/global${queryString ? `?${queryString}` : ''}`;

      return api.get<BacklotLocationSearchResponse>(endpoint);
    },
  });
}

/**
 * Get available regions for filtering
 */
export function useLocationRegions() {
  return useQuery({
    queryKey: ['location-regions'],
    queryFn: async () => {
      const response = await api.get<{ regions: string[] }>('/api/v1/backlot/locations/regions');
      return response.regions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get available location types for filtering
 */
export function useLocationTypes() {
  return useQuery({
    queryKey: ['location-types'],
    queryFn: async () => {
      const response = await api.get<{ types: string[] }>('/api/v1/backlot/locations/types');
      return response.types;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get project locations (locations attached to a project)
 */
export function useProjectLocations(projectId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['project-locations', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const response = await api.get<{ locations: BacklotLocation[] }>(
        `/api/v1/backlot/projects/${projectId}/locations`
      );
      return response.locations;
    },
    enabled: !!projectId,
  });

  // Create location (adds to global library and attaches to project)
  const createLocation = useMutation({
    mutationFn: async (input: BacklotLocationInput) => {
      if (!projectId) throw new Error('Project ID is required');

      const response = await api.post<{ success: boolean; location: BacklotLocation }>(
        `/api/v1/backlot/projects/${projectId}/locations`,
        input
      );
      return response.location;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-locations', projectId] });
      queryClient.invalidateQueries({ queryKey: ['global-locations'] });
    },
  });

  // Attach an existing location from the global library
  const attachLocation = useMutation({
    mutationFn: async (input: BacklotLocationAttachmentInput) => {
      if (!projectId) throw new Error('Project ID is required');

      const response = await api.post<{ success: boolean; attachment_id: string }>(
        `/api/v1/backlot/projects/${projectId}/locations/attach`,
        input
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-locations', projectId] });
    },
  });

  // Detach a location from the project
  const detachLocation = useMutation({
    mutationFn: async (locationId: string) => {
      if (!projectId) throw new Error('Project ID is required');

      return api.delete<{ success: boolean }>(
        `/api/v1/backlot/projects/${projectId}/locations/${locationId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-locations', projectId] });
    },
  });

  // Update project-specific notes for an attached location
  const updateProjectNotes = useMutation({
    mutationFn: async ({
      locationId,
      project_notes,
      scene_description,
    }: {
      locationId: string;
      project_notes?: string | null;
      scene_description?: string | null;
    }) => {
      if (!projectId) throw new Error('Project ID is required');

      const queryParams = new URLSearchParams();
      if (project_notes !== undefined) queryParams.set('project_notes', project_notes || '');
      if (scene_description !== undefined) queryParams.set('scene_description', scene_description || '');

      // Use PATCH with query params (as defined in the API)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/backlot/projects/${projectId}/locations/${locationId}?${queryParams.toString()}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-locations', projectId] });
    },
  });

  return {
    locations: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createLocation,
    attachLocation,
    detachLocation,
    updateProjectNotes,
  };
}

/**
 * Get a single location by ID (via API)
 */
export function useLocationById(locationId: string | null) {
  return useQuery({
    queryKey: ['location', locationId],
    queryFn: async () => {
      if (!locationId) return null;

      const response = await api.get<{ location: BacklotLocation }>(
        `/api/v1/backlot/locations/${locationId}`
      );
      return response.location;
    },
    enabled: !!locationId,
  });
}

/**
 * Update a location in the global library
 */
export function useUpdateGlobalLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ locationId, ...input }: BacklotLocationInput & { locationId: string }) => {
      // Use fetch directly since we need PATCH
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/backlot/locations/${locationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || 'Request failed');
      }

      const data = await response.json();
      return data.location as BacklotLocation;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['location', variables.locationId] });
      queryClient.invalidateQueries({ queryKey: ['global-locations'] });
      queryClient.invalidateQueries({ queryKey: ['project-locations'] });
    },
  });
}

/**
 * Delete a location from the global library
 */
export function useDeleteGlobalLocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locationId: string) => {
      return api.delete<{ success: boolean }>(
        `/api/v1/backlot/locations/${locationId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-locations'] });
      queryClient.invalidateQueries({ queryKey: ['project-locations'] });
    },
  });
}
