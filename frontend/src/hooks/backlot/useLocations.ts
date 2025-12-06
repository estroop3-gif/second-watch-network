/**
 * useLocations - Hook for managing production locations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BacklotLocation, LocationInput } from '@/types/backlot';

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

// Fetch single location
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
