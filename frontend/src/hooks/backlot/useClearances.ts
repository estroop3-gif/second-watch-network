/**
 * useClearances - Hook for managing project clearances/releases
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotClearanceItem,
  BacklotClearanceTemplate,
  BacklotClearanceType,
  BacklotClearanceStatus,
  ClearanceItemInput,
  ClearanceSummary,
  ClearanceBulkStatusResponse,
} from '@/types/backlot';

interface UseClearancesOptions {
  projectId: string | null;
  type?: BacklotClearanceType | 'all';
  status?: BacklotClearanceStatus | 'all';
  search?: string;
  limit?: number;
}

export function useClearances(options: UseClearancesOptions) {
  const { projectId, type = 'all', status = 'all', search, limit = 200 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-clearances', { projectId, type, status, search, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from('backlot_clearance_items')
        .select('*')
        .eq('project_id', projectId)
        .order('type', { ascending: true })
        .order('title', { ascending: true })
        .limit(limit);

      if (type !== 'all') {
        query = query.eq('type', type);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,related_person_name.ilike.%${search}%,related_asset_label.ilike.%${search}%`);
      }

      const { data: clearanceData, error } = await query;
      if (error) throw error;
      if (!clearanceData || clearanceData.length === 0) return [];

      // Fetch creator profiles
      const creatorIds = new Set<string>();
      clearanceData.forEach(c => {
        if (c.created_by_user_id) creatorIds.add(c.created_by_user_id);
      });

      let profileMap = new Map<string, any>();
      if (creatorIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .in('id', Array.from(creatorIds));
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      // Fetch related locations
      const locationIds = new Set<string>();
      clearanceData.forEach(c => {
        if (c.related_location_id) locationIds.add(c.related_location_id);
      });

      let locationMap = new Map<string, any>();
      if (locationIds.size > 0) {
        const { data: locations } = await supabase
          .from('backlot_locations')
          .select('id, name, address, city, state')
          .in('id', Array.from(locationIds));
        locationMap = new Map(locations?.map(l => [l.id, l]) || []);
      }

      return clearanceData.map(clearance => ({
        ...clearance,
        created_by: clearance.created_by_user_id ? profileMap.get(clearance.created_by_user_id) : null,
        related_location: clearance.related_location_id ? locationMap.get(clearance.related_location_id) : null,
      })) as BacklotClearanceItem[];
    },
    enabled: !!projectId,
  });

  const createClearance = useMutation({
    mutationFn: async ({ projectId, ...input }: ClearanceItemInput & { projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_clearance_items')
        .insert({
          project_id: projectId,
          type: input.type,
          title: input.title,
          description: input.description || null,
          related_person_id: input.related_person_id || null,
          related_person_name: input.related_person_name || null,
          related_location_id: input.related_location_id || null,
          related_project_location_id: input.related_project_location_id || null,
          related_asset_label: input.related_asset_label || null,
          file_url: input.file_url || null,
          file_name: input.file_name || null,
          file_is_sensitive: input.file_is_sensitive ?? false,
          status: input.status || 'not_started',
          requested_date: input.requested_date || null,
          signed_date: input.signed_date || null,
          expiration_date: input.expiration_date || null,
          notes: input.notes || null,
          contact_email: input.contact_email || null,
          contact_phone: input.contact_phone || null,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotClearanceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  const updateClearance = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ClearanceItemInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.type !== undefined) updateData.type = input.type;
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.related_person_id !== undefined) updateData.related_person_id = input.related_person_id;
      if (input.related_person_name !== undefined) updateData.related_person_name = input.related_person_name;
      if (input.related_location_id !== undefined) updateData.related_location_id = input.related_location_id;
      if (input.related_project_location_id !== undefined) updateData.related_project_location_id = input.related_project_location_id;
      if (input.related_asset_label !== undefined) updateData.related_asset_label = input.related_asset_label;
      if (input.file_url !== undefined) updateData.file_url = input.file_url;
      if (input.file_name !== undefined) updateData.file_name = input.file_name;
      if (input.file_is_sensitive !== undefined) updateData.file_is_sensitive = input.file_is_sensitive;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.requested_date !== undefined) updateData.requested_date = input.requested_date;
      if (input.signed_date !== undefined) updateData.signed_date = input.signed_date;
      if (input.expiration_date !== undefined) updateData.expiration_date = input.expiration_date;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.contact_email !== undefined) updateData.contact_email = input.contact_email;
      if (input.contact_phone !== undefined) updateData.contact_phone = input.contact_phone;

      const { data, error } = await supabase
        .from('backlot_clearance_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotClearanceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, signedDate }: { id: string; status: BacklotClearanceStatus; signedDate?: string }) => {
      const updateData: Record<string, any> = { status };

      // Auto-set signed_date if status is 'signed' and no date was previously set
      if (status === 'signed' && signedDate) {
        updateData.signed_date = signedDate;
      }

      const { data, error } = await supabase
        .from('backlot_clearance_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotClearanceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  const deleteClearance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_clearance_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  return {
    clearances: data || [],
    isLoading,
    error,
    refetch,
    createClearance,
    updateClearance,
    updateStatus,
    deleteClearance,
  };
}

// Fetch single clearance item
export function useClearanceItem(id: string | null) {
  return useQuery({
    queryKey: ['backlot-clearance-item', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('backlot_clearance_items')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch creator profile if exists
      let created_by = null;
      if (data.created_by_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .eq('id', data.created_by_user_id)
          .single();
        created_by = profile;
      }

      // Fetch related location if exists
      let related_location = null;
      if (data.related_location_id) {
        const { data: location } = await supabase
          .from('backlot_locations')
          .select('id, name, address, city, state')
          .eq('id', data.related_location_id)
          .single();
        related_location = location;
      }

      return { ...data, created_by, related_location } as BacklotClearanceItem;
    },
    enabled: !!id,
  });
}

// Get clearance summary for a project
export function useClearanceSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-clearance-summary', projectId],
    queryFn: async (): Promise<ClearanceSummary | null> => {
      if (!projectId) return null;

      const { data, error } = await supabase
        .from('backlot_clearance_items')
        .select('type, status')
        .eq('project_id', projectId);

      if (error) throw error;

      // Build summary from data
      const summary: ClearanceSummary = {
        total: data?.length || 0,
        by_status: {
          not_started: 0,
          requested: 0,
          signed: 0,
          expired: 0,
          rejected: 0,
        },
        by_type: {} as ClearanceSummary['by_type'],
        expiring_soon: 0,
      };

      // Get items expiring within 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: expiringData } = await supabase
        .from('backlot_clearance_items')
        .select('id')
        .eq('project_id', projectId)
        .eq('status', 'signed')
        .not('expiration_date', 'is', null)
        .lte('expiration_date', thirtyDaysFromNow.toISOString().split('T')[0]);

      summary.expiring_soon = expiringData?.length || 0;

      // Count by status
      data?.forEach(item => {
        if (item.status in summary.by_status) {
          summary.by_status[item.status as BacklotClearanceStatus]++;
        }

        // Count by type
        const type = item.type as BacklotClearanceType;
        if (!summary.by_type[type]) {
          summary.by_type[type] = {
            total: 0,
            signed: 0,
            requested: 0,
            not_started: 0,
            expired: 0,
          };
        }
        summary.by_type[type].total++;
        if (item.status === 'signed') summary.by_type[type].signed++;
        if (item.status === 'requested') summary.by_type[type].requested++;
        if (item.status === 'not_started') summary.by_type[type].not_started++;
        if (item.status === 'expired') summary.by_type[type].expired++;
      });

      return summary;
    },
    enabled: !!projectId,
  });
}

// Get clearance templates
export function useClearanceTemplates(type?: BacklotClearanceType) {
  return useQuery({
    queryKey: ['backlot-clearance-templates', type],
    queryFn: async () => {
      let query = supabase
        .from('backlot_clearance_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (type) {
        query = query.eq('type', type);
      }

      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        // Get system templates OR user's own templates
        query = query.or(`owner_user_id.is.null,owner_user_id.eq.${userData.user.id}`);
      } else {
        // Just system templates
        query = query.is('owner_user_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BacklotClearanceTemplate[];
    },
  });
}

// Get clearances for a specific location
export function useLocationClearances(projectId: string | null, locationId: string | null) {
  return useQuery({
    queryKey: ['backlot-location-clearances', projectId, locationId],
    queryFn: async () => {
      if (!projectId || !locationId) return [];

      const { data, error } = await supabase
        .from('backlot_clearance_items')
        .select('*')
        .eq('project_id', projectId)
        .eq('type', 'location_release')
        .or(`related_location_id.eq.${locationId},related_project_location_id.eq.${locationId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BacklotClearanceItem[];
    },
    enabled: !!projectId && !!locationId,
  });
}

// Get clearances for a specific person
export function usePersonClearances(
  projectId: string | null,
  personId: string | null,
  releaseType: BacklotClearanceType = 'talent_release'
) {
  return useQuery({
    queryKey: ['backlot-person-clearances', projectId, personId, releaseType],
    queryFn: async () => {
      if (!projectId || !personId) return [];

      const { data, error } = await supabase
        .from('backlot_clearance_items')
        .select('*')
        .eq('project_id', projectId)
        .eq('related_person_id', personId)
        .eq('type', releaseType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BacklotClearanceItem[];
    },
    enabled: !!projectId && !!personId,
  });
}

// Bulk check clearance status for call sheets
export function useBulkClearanceStatus(
  projectId: string | null,
  locationIds: string[],
  personIds: string[]
) {
  return useQuery({
    queryKey: ['backlot-bulk-clearance-status', projectId, locationIds, personIds],
    queryFn: async (): Promise<ClearanceBulkStatusResponse> => {
      if (!projectId || (locationIds.length === 0 && personIds.length === 0)) {
        return { locations: {}, persons: {} };
      }

      // Fetch location clearances
      const locationsResult: Record<string, BacklotClearanceStatus | 'missing'> = {};
      if (locationIds.length > 0) {
        const { data: locationClearances } = await supabase
          .from('backlot_clearance_items')
          .select('related_location_id, related_project_location_id, status, expiration_date')
          .eq('project_id', projectId)
          .eq('type', 'location_release')
          .or(`related_location_id.in.(${locationIds.join(',')}),related_project_location_id.in.(${locationIds.join(',')})`);

        // Group by location ID, preferring 'signed' status
        locationIds.forEach(locId => {
          const matches = locationClearances?.filter(
            c => c.related_location_id === locId || c.related_project_location_id === locId
          ) || [];

          if (matches.length === 0) {
            locationsResult[locId] = 'missing';
          } else {
            // Find best status (signed > requested > not_started > expired)
            const statusPriority: Record<string, number> = {
              signed: 1,
              requested: 2,
              not_started: 3,
              expired: 4,
              rejected: 5,
            };
            const sorted = matches.sort((a, b) =>
              (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
            );
            locationsResult[locId] = sorted[0].status as BacklotClearanceStatus;
          }
        });
      }

      // Fetch person clearances
      const personsResult: Record<string, BacklotClearanceStatus | 'missing'> = {};
      if (personIds.length > 0) {
        const { data: personClearances } = await supabase
          .from('backlot_clearance_items')
          .select('related_person_id, status, expiration_date')
          .eq('project_id', projectId)
          .in('type', ['talent_release', 'appearance_release'])
          .in('related_person_id', personIds);

        personIds.forEach(personId => {
          const matches = personClearances?.filter(c => c.related_person_id === personId) || [];

          if (matches.length === 0) {
            personsResult[personId] = 'missing';
          } else {
            const statusPriority: Record<string, number> = {
              signed: 1,
              requested: 2,
              not_started: 3,
              expired: 4,
              rejected: 5,
            };
            const sorted = matches.sort((a, b) =>
              (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
            );
            personsResult[personId] = sorted[0].status as BacklotClearanceStatus;
          }
        });
      }

      return { locations: locationsResult, persons: personsResult };
    },
    enabled: !!projectId && (locationIds.length > 0 || personIds.length > 0),
  });
}

// Helper to check if a location has a signed release
export function locationHasSignedRelease(
  clearances: BacklotClearanceItem[],
  locationId: string
): boolean {
  const today = new Date().toISOString().split('T')[0];
  return clearances.some(
    c =>
      c.type === 'location_release' &&
      (c.related_location_id === locationId || c.related_project_location_id === locationId) &&
      c.status === 'signed' &&
      (!c.expiration_date || c.expiration_date > today)
  );
}

// Helper to check if a person has a signed release
export function personHasSignedRelease(
  clearances: BacklotClearanceItem[],
  personId: string,
  releaseType: BacklotClearanceType = 'talent_release'
): boolean {
  const today = new Date().toISOString().split('T')[0];
  return clearances.some(
    c =>
      c.type === releaseType &&
      c.related_person_id === personId &&
      c.status === 'signed' &&
      (!c.expiration_date || c.expiration_date > today)
  );
}

// Get clearance status badge color
export function getClearanceStatusColor(status: BacklotClearanceStatus | 'missing'): string {
  const colors: Record<string, string> = {
    signed: 'green',
    requested: 'yellow',
    not_started: 'gray',
    expired: 'orange',
    rejected: 'red',
    missing: 'slate',
  };
  return colors[status] || 'gray';
}
