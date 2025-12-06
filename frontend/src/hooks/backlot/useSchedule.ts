/**
 * useSchedule - Hook for managing production days and call sheets
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotProductionDay,
  BacklotCallSheet,
  BacklotCallSheetPerson,
  BacklotCallSheetScene,
  BacklotCallSheetLocation,
  ProductionDayInput,
  CallSheetInput,
  CallSheetPersonInput,
  CallSheetSceneInput,
  CallSheetLocationInput,
  CallSheetSendRequest,
  CallSheetSendResponse,
  CallSheetSendHistory,
  ProjectMemberForSend,
  CallSheetPdfGenerateRequest,
  CallSheetPdfGenerateResponse,
  CallSheetSyncRequest,
  CallSheetSyncResponse,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// =====================================================
// Production Days
// =====================================================

export function useProductionDays(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-production-days', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: daysData, error } = await supabase
        .from('backlot_production_days')
        .select('*')
        .eq('project_id', projectId)
        .order('day_number', { ascending: true });

      if (error) throw error;
      return (daysData || []) as BacklotProductionDay[];
    },
    enabled: !!projectId,
  });

  const createDay = useMutation({
    mutationFn: async ({ projectId, ...input }: ProductionDayInput & { projectId: string }) => {
      const { data, error } = await supabase
        .from('backlot_production_days')
        .insert({
          project_id: projectId,
          day_number: input.day_number,
          date: input.date,
          title: input.title || null,
          description: input.description || null,
          general_call_time: input.general_call_time || null,
          wrap_time: input.wrap_time || null,
          location_id: input.location_id || null,
          location_name: input.location_name || null,
          location_address: input.location_address || null,
          notes: input.notes || null,
          weather_notes: input.weather_notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProductionDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days', projectId] });
    },
  });

  const updateDay = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProductionDayInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.day_number !== undefined) updateData.day_number = input.day_number;
      if (input.date !== undefined) updateData.date = input.date;
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.general_call_time !== undefined) updateData.general_call_time = input.general_call_time;
      if (input.wrap_time !== undefined) updateData.wrap_time = input.wrap_time;
      if (input.location_id !== undefined) updateData.location_id = input.location_id;
      if (input.location_name !== undefined) updateData.location_name = input.location_name;
      if (input.location_address !== undefined) updateData.location_address = input.location_address;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.weather_notes !== undefined) updateData.weather_notes = input.weather_notes;

      const { data, error } = await supabase
        .from('backlot_production_days')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProductionDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days', projectId] });
    },
  });

  const markCompleted = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { data, error } = await supabase
        .from('backlot_production_days')
        .update({ is_completed: completed })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProductionDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days', projectId] });
    },
  });

  const deleteDay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_production_days')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days', projectId] });
    },
  });

  return {
    days: data || [],
    isLoading,
    error,
    refetch,
    createDay,
    updateDay,
    markCompleted,
    deleteDay,
  };
}

// Fetch single production day
export function useProductionDay(id: string | null) {
  return useQuery({
    queryKey: ['backlot-production-day', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('backlot_production_days')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as BacklotProductionDay;
    },
    enabled: !!id,
  });
}

// =====================================================
// Call Sheets
// =====================================================

export function useCallSheets(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-call-sheets', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: sheetsData, error } = await supabase
        .from('backlot_call_sheets')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: true });

      if (error) throw error;
      return (sheetsData || []) as BacklotCallSheet[];
    },
    enabled: !!projectId,
  });

  const createCallSheet = useMutation({
    mutationFn: async ({ projectId, ...input }: CallSheetInput & { projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_call_sheets')
        .insert({
          project_id: projectId,
          production_day_id: input.production_day_id || null,
          title: input.title,
          date: input.date,
          general_call_time: input.general_call_time || null,
          location_name: input.location_name || null,
          location_address: input.location_address || null,
          parking_notes: input.parking_notes || null,
          production_contact: input.production_contact || null,
          production_phone: input.production_phone || null,
          schedule_blocks: input.schedule_blocks || [],
          weather_info: input.weather_info || null,
          special_instructions: input.special_instructions || null,
          safety_notes: input.safety_notes || null,
          hospital_name: input.hospital_name || null,
          hospital_address: input.hospital_address || null,
          hospital_phone: input.hospital_phone || null,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotCallSheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  const updateCallSheet = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CallSheetInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.production_day_id !== undefined) updateData.production_day_id = input.production_day_id;
      if (input.title !== undefined) updateData.title = input.title;
      if (input.date !== undefined) updateData.date = input.date;
      if (input.general_call_time !== undefined) updateData.general_call_time = input.general_call_time;
      if (input.location_name !== undefined) updateData.location_name = input.location_name;
      if (input.location_address !== undefined) updateData.location_address = input.location_address;
      if (input.parking_notes !== undefined) updateData.parking_notes = input.parking_notes;
      if (input.production_contact !== undefined) updateData.production_contact = input.production_contact;
      if (input.production_phone !== undefined) updateData.production_phone = input.production_phone;
      if (input.schedule_blocks !== undefined) updateData.schedule_blocks = input.schedule_blocks;
      if (input.weather_info !== undefined) updateData.weather_info = input.weather_info;
      if (input.special_instructions !== undefined) updateData.special_instructions = input.special_instructions;
      if (input.safety_notes !== undefined) updateData.safety_notes = input.safety_notes;
      if (input.hospital_name !== undefined) updateData.hospital_name = input.hospital_name;
      if (input.hospital_address !== undefined) updateData.hospital_address = input.hospital_address;
      if (input.hospital_phone !== undefined) updateData.hospital_phone = input.hospital_phone;

      const { data, error } = await supabase
        .from('backlot_call_sheets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotCallSheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  const publishCallSheet = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      const { data, error } = await supabase
        .from('backlot_call_sheets')
        .update({
          is_published: publish,
          published_at: publish ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotCallSheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  const deleteCallSheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_call_sheets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  return {
    callSheets: data || [],
    isLoading,
    error,
    refetch,
    createCallSheet,
    updateCallSheet,
    publishCallSheet,
    deleteCallSheet,
  };
}

// Fetch single call sheet with people, scenes, and locations
export function useCallSheet(id: string | null) {
  return useQuery({
    queryKey: ['backlot-call-sheet', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: sheet, error } = await supabase
        .from('backlot_call_sheets')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch people
      const { data: people } = await supabase
        .from('backlot_call_sheet_people')
        .select('*')
        .eq('call_sheet_id', id)
        .order('sort_order', { ascending: true });

      // Fetch scenes
      const { data: scenes } = await supabase
        .from('backlot_call_sheet_scenes')
        .select('*')
        .eq('call_sheet_id', id)
        .order('sort_order', { ascending: true });

      // Fetch locations
      const { data: locations } = await supabase
        .from('backlot_call_sheet_locations')
        .select('*')
        .eq('call_sheet_id', id)
        .order('location_number', { ascending: true });

      return {
        ...sheet,
        people: people || [],
        scenes: scenes || [],
        locations: locations || [],
      } as BacklotCallSheet;
    },
    enabled: !!id,
  });
}

// =====================================================
// Call Sheet People
// =====================================================

export function useCallSheetPeople(callSheetId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-call-sheet-people', callSheetId],
    queryFn: async () => {
      if (!callSheetId) return [];

      const { data: peopleData, error } = await supabase
        .from('backlot_call_sheet_people')
        .select('*')
        .eq('call_sheet_id', callSheetId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (peopleData || []) as BacklotCallSheetPerson[];
    },
    enabled: !!callSheetId,
  });

  const addPerson = useMutation({
    mutationFn: async ({ callSheetId, ...input }: CallSheetPersonInput & { callSheetId: string }) => {
      const { data, error } = await supabase
        .from('backlot_call_sheet_people')
        .insert({
          call_sheet_id: callSheetId,
          member_id: input.member_id || null,
          name: input.name,
          role: input.role || null,
          department: input.department || null,
          call_time: input.call_time,
          phone: input.phone || null,
          email: input.email || null,
          notes: input.notes || null,
          makeup_time: input.makeup_time || null,
          wardrobe_notes: input.wardrobe_notes || null,
          sort_order: input.sort_order || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotCallSheetPerson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const updatePerson = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CallSheetPersonInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.member_id !== undefined) updateData.member_id = input.member_id;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.call_time !== undefined) updateData.call_time = input.call_time;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.makeup_time !== undefined) updateData.makeup_time = input.makeup_time;
      if (input.wardrobe_notes !== undefined) updateData.wardrobe_notes = input.wardrobe_notes;
      if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;

      const { data, error } = await supabase
        .from('backlot_call_sheet_people')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotCallSheetPerson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const removePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_call_sheet_people')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const reorderPeople = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update each person's sort_order
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('backlot_call_sheet_people')
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
    },
  });

  return {
    people: data || [],
    isLoading,
    error,
    refetch,
    addPerson,
    updatePerson,
    removePerson,
    reorderPeople,
  };
}

// =====================================================
// Call Sheet Send Operations
// =====================================================

/**
 * Helper to get auth token
 */
async function getAuthToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
}

/**
 * Send a call sheet to recipients
 */
export function useSendCallSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      callSheetId,
      request,
    }: {
      callSheetId: string;
      request: CallSheetSendRequest;
    }): Promise<CallSheetSendResponse> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to send call sheet' }));
        throw new Error(error.detail || 'Failed to send call sheet');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate call sheet queries to refresh is_published status
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', variables.callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-send-history', variables.callSheetId] });
    },
  });
}

/**
 * Get call sheet send history
 */
export function useCallSheetSendHistory(callSheetId: string | null) {
  return useQuery({
    queryKey: ['backlot-call-sheet-send-history', callSheetId],
    queryFn: async (): Promise<CallSheetSendHistory[]> => {
      if (!callSheetId) return [];

      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/send-history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch send history');
      }

      return response.json();
    },
    enabled: !!callSheetId,
  });
}

/**
 * Get project members for send modal
 */
export function useProjectMembersForSend(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-project-members-for-send', projectId],
    queryFn: async (): Promise<ProjectMemberForSend[]> => {
      if (!projectId) return [];

      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/members-for-send`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch project members');
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

// =====================================================
// Call Sheet Scenes
// =====================================================

/**
 * Manage scenes for a call sheet
 */
export function useCallSheetScenes(callSheetId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-call-sheet-scenes', callSheetId],
    queryFn: async (): Promise<BacklotCallSheetScene[]> => {
      if (!callSheetId) return [];

      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch scenes');
      }

      return response.json();
    },
    enabled: !!callSheetId,
  });

  const addScene = useMutation({
    mutationFn: async (scene: CallSheetSceneInput): Promise<BacklotCallSheetScene> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scene),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create scene' }));
        throw new Error(error.detail || 'Failed to create scene');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-scenes', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const updateScene = useMutation({
    mutationFn: async ({ id, ...scene }: CallSheetSceneInput & { id: string }): Promise<BacklotCallSheetScene> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(scene),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update scene' }));
        throw new Error(error.detail || 'Failed to update scene');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-scenes', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const removeScene = useMutation({
    mutationFn: async (sceneId: string): Promise<void> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes/${sceneId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete scene');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-scenes', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const reorderScenes = useMutation({
    mutationFn: async (sceneIds: string[]): Promise<void> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/scenes/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(sceneIds),
      });

      if (!response.ok) {
        throw new Error('Failed to reorder scenes');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-scenes', callSheetId] });
    },
  });

  return {
    scenes: data || [],
    isLoading,
    error,
    refetch,
    addScene,
    updateScene,
    removeScene,
    reorderScenes,
  };
}

// =====================================================
// Call Sheet Locations (Multiple locations per sheet)
// =====================================================

/**
 * Manage locations for a call sheet
 */
export function useCallSheetLocations(callSheetId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-call-sheet-locations', callSheetId],
    queryFn: async (): Promise<BacklotCallSheetLocation[]> => {
      if (!callSheetId) return [];

      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/locations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }

      return response.json();
    },
    enabled: !!callSheetId,
  });

  const addLocation = useMutation({
    mutationFn: async (location: CallSheetLocationInput): Promise<BacklotCallSheetLocation> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/locations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(location),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create location' }));
        throw new Error(error.detail || 'Failed to create location');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-locations', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const updateLocation = useMutation({
    mutationFn: async ({ id, ...location }: CallSheetLocationInput & { id: string }): Promise<BacklotCallSheetLocation> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/locations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(location),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update location' }));
        throw new Error(error.detail || 'Failed to update location');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-locations', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const removeLocation = useMutation({
    mutationFn: async (locationId: string): Promise<void> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/locations/${locationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete location');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-locations', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  return {
    locations: data || [],
    isLoading,
    error,
    refetch,
    addLocation,
    updateLocation,
    removeLocation,
  };
}

// =====================================================
// PDF Generation
// =====================================================

/**
 * Generate PDF for a call sheet
 */
export function useGenerateCallSheetPdf() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      callSheetId,
      request,
    }: {
      callSheetId: string;
      request?: CallSheetPdfGenerateRequest;
    }): Promise<CallSheetPdfGenerateResponse> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/generate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request || {}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to generate PDF' }));
        throw new Error(error.detail || 'Failed to generate PDF');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', variables.callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets'] });
    },
  });
}

/**
 * Download PDF for a call sheet directly (without storing)
 * Returns a function that triggers the download
 */
export function useDownloadCallSheetPdf() {
  return useMutation({
    mutationFn: async (callSheetId: string): Promise<void> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/download-pdf`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to download PDF' }));
        throw new Error(error.detail || 'Failed to download PDF');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'call-sheet.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+?)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create a download link and click it
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });
}

// =====================================================
// Project Logo
// =====================================================

/**
 * Set project logo URL (after uploading to storage)
 */
export function useSetProjectLogo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      logoUrl,
    }: {
      projectId: string;
      logoUrl: string;
    }): Promise<{ success: boolean; logo_url: string; message: string }> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/set-logo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ logo_url: logoUrl }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to set logo' }));
        throw new Error(error.detail || 'Failed to set logo');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project', variables.projectId] });
    },
  });
}

// =====================================================
// Sync Call Sheet to Other Backlot Tools
// =====================================================

/**
 * Sync call sheet data to production days, locations, and tasks
 */
export function useSyncCallSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      callSheetId,
      request,
    }: {
      callSheetId: string;
      request?: CallSheetSyncRequest;
    }): Promise<CallSheetSyncResponse> => {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE}/backlot/call-sheets/${callSheetId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request || {}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to sync call sheet' }));
        throw new Error(error.detail || 'Failed to sync call sheet');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', variables.callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-locations'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });
}
