/**
 * useGear - Hook for managing production gear/equipment
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BacklotGearItem, GearItemInput, BacklotGearStatus } from '@/types/backlot';

interface UseGearOptions {
  projectId: string | null;
  category?: string;
  status?: BacklotGearStatus | 'all';
  limit?: number;
}

export function useGear(options: UseGearOptions) {
  const { projectId, category, status = 'all', limit = 100 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-gear', { projectId, category, status, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from('backlot_gear_items')
        .select('*')
        .eq('project_id', projectId)
        .order('category', { ascending: true })
        .order('name', { ascending: true })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data: gearData, error } = await query;
      if (error) throw error;
      if (!gearData || gearData.length === 0) return [];

      // Fetch profiles for assigned users
      const userIds = new Set<string>();
      gearData.forEach(g => {
        if (g.assigned_to) userIds.add(g.assigned_to);
      });

      let profileMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .in('id', Array.from(userIds));
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return gearData.map(gear => ({
        ...gear,
        assignee: gear.assigned_to ? profileMap.get(gear.assigned_to) : null,
      })) as BacklotGearItem[];
    },
    enabled: !!projectId,
  });

  const createGear = useMutation({
    mutationFn: async ({ projectId, ...input }: GearItemInput & { projectId: string }) => {
      const { data, error } = await supabase
        .from('backlot_gear_items')
        .insert({
          project_id: projectId,
          name: input.name,
          category: input.category || null,
          description: input.description || null,
          serial_number: input.serial_number || null,
          asset_tag: input.asset_tag || null,
          status: input.status || 'available',
          is_owned: input.is_owned ?? false,
          rental_house: input.rental_house || null,
          rental_cost_per_day: input.rental_cost_per_day || null,
          assigned_to: input.assigned_to || null,
          assigned_production_day_id: input.assigned_production_day_id || null,
          pickup_date: input.pickup_date || null,
          return_date: input.return_date || null,
          notes: input.notes || null,
          condition_notes: input.condition_notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotGearItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  const updateGear = useMutation({
    mutationFn: async ({ id, ...input }: Partial<GearItemInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.serial_number !== undefined) updateData.serial_number = input.serial_number;
      if (input.asset_tag !== undefined) updateData.asset_tag = input.asset_tag;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.is_owned !== undefined) updateData.is_owned = input.is_owned;
      if (input.rental_house !== undefined) updateData.rental_house = input.rental_house;
      if (input.rental_cost_per_day !== undefined) updateData.rental_cost_per_day = input.rental_cost_per_day;
      if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to;
      if (input.assigned_production_day_id !== undefined) updateData.assigned_production_day_id = input.assigned_production_day_id;
      if (input.pickup_date !== undefined) updateData.pickup_date = input.pickup_date;
      if (input.return_date !== undefined) updateData.return_date = input.return_date;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.condition_notes !== undefined) updateData.condition_notes = input.condition_notes;

      const { data, error } = await supabase
        .from('backlot_gear_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotGearItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BacklotGearStatus }) => {
      const { data, error } = await supabase
        .from('backlot_gear_items')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotGearItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  const deleteGear = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_gear_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-gear'] });
    },
  });

  return {
    gear: data || [],
    isLoading,
    error,
    refetch,
    createGear,
    updateGear,
    updateStatus,
    deleteGear,
  };
}

// Fetch single gear item
export function useGearItem(id: string | null) {
  return useQuery({
    queryKey: ['backlot-gear-item', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('backlot_gear_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch assignee profile if exists
      let assignee = null;
      if (data.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .eq('id', data.assigned_to)
          .single();
        assignee = profile;
      }

      return { ...data, assignee } as BacklotGearItem;
    },
    enabled: !!id,
  });
}

// Get gear categories for a project
export function useGearCategories(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-gear-categories', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('backlot_gear_items')
        .select('category')
        .eq('project_id', projectId)
        .not('category', 'is', null);

      if (error) throw error;

      // Get unique categories
      const categories = [...new Set(data?.map(d => d.category).filter(Boolean))] as string[];
      return categories.sort();
    },
    enabled: !!projectId,
  });
}

// Common gear categories constant
export const GEAR_CATEGORIES = [
  'Camera',
  'Lenses',
  'Lighting',
  'Grip',
  'Audio',
  'Monitors',
  'Power/Batteries',
  'Storage/Media',
  'Tripods/Stabilizers',
  'Accessories',
  'Other',
] as const;
