/**
 * useSchedule - Hook for managing production days and call sheets
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
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

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Helper to get auth token
 */
function getAuthToken(): string {
  const token = api.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
}

// =====================================================
// Production Days
// =====================================================

export function useProductionDays(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-production-days', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/production-days`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch production days' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.days || []) as BacklotProductionDay[];
    },
    enabled: !!projectId,
  });

  const createDay = useMutation({
    mutationFn: async ({ projectId, ...input }: ProductionDayInput & { projectId: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/production-days`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create day' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.day || result) as BacklotProductionDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days', projectId] });
    },
  });

  const updateDay = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProductionDayInput> & { id: string }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/production-days/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update day' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.day || result) as BacklotProductionDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days', projectId] });
    },
  });

  const markCompleted = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/production-days/${id}/completed?completed=${completed}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update completion' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.day || result) as BacklotProductionDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days', projectId] });
    },
  });

  const deleteDay = useMutation({
    mutationFn: async (id: string) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/production-days/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete day' }));
        throw new Error(error.detail);
      }
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

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/production-days/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch day' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.day || result) as BacklotProductionDay;
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

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/call-sheets`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch call sheets' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.call_sheets || []) as BacklotCallSheet[];
    },
    enabled: !!projectId,
  });

  const createCallSheet = useMutation({
    mutationFn: async ({ projectId, ...input }: CallSheetInput & { projectId: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/call-sheets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create call sheet' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.call_sheet || result) as BacklotCallSheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  const updateCallSheet = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CallSheetInput> & { id: string }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update call sheet' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.call_sheet || result) as BacklotCallSheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  const publishCallSheet = useMutation({
    mutationFn: async ({ id, publish }: { id: string; publish: boolean }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${id}/publish?publish=${publish}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to publish call sheet' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.call_sheet || result) as BacklotCallSheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  const deleteCallSheet = useMutation({
    mutationFn: async (id: string) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete call sheet' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
    },
  });

  const cloneCallSheet = useMutation({
    mutationFn: async ({
      id,
      options,
    }: {
      id: string;
      options: {
        new_date: string;
        new_day_number?: number;
        new_title?: string;
        keep_people?: boolean;
        keep_scenes?: boolean;
        keep_locations?: boolean;
        keep_schedule_blocks?: boolean;
        keep_department_notes?: boolean;
      };
    }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${id}/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to clone call sheet' }));
        throw new Error(error.detail);
      }

      return response.json();
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
    cloneCallSheet,
  };
}

// Fetch single call sheet with people, scenes, and locations
export function useCallSheet(id: string | null) {
  return useQuery({
    queryKey: ['backlot-call-sheet', id],
    queryFn: async () => {
      if (!id) return null;

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch call sheet' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.call_sheet || result) as BacklotCallSheet;
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

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/people`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch people' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.people || []) as BacklotCallSheetPerson[];
    },
    enabled: !!callSheetId,
  });

  const addPerson = useMutation({
    mutationFn: async ({ callSheetId, ...input }: CallSheetPersonInput & { callSheetId: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/people`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add person' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.person || result) as BacklotCallSheetPerson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const updatePerson = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CallSheetPersonInput> & { id: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/people/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update person' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.person || result) as BacklotCallSheetPerson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const removePerson = useMutation({
    mutationFn: async (id: string) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/people/${id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove person' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  const reorderPeople = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/people/reorder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(orderedIds),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reorder people' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', callSheetId] });
    },
  });

  // Bulk update times for a department
  const bulkUpdateDepartmentTimes = useMutation({
    mutationFn: async (update: {
      department: string;
      call_time?: string;
      makeup_time?: string;
      pickup_time?: string;
      on_set_time?: string;
      apply_to: 'all' | 'empty_only';
    }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/people/bulk-update-times`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(update),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update times' }));
        throw new Error(error.detail);
      }

      return response.json();
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
    bulkUpdateDepartmentTimes,
  };
}

// =====================================================
// Crew Presets
// =====================================================

interface CrewPresetMember {
  name: string;
  role?: string;
  department?: string;
  default_call_time?: string;
  phone?: string;
  email?: string;
  is_cast?: boolean;
  cast_number?: string;
  character_name?: string;
}

interface CrewPreset {
  id: string;
  project_id?: string;
  user_id?: string;
  name: string;
  description?: string;
  template_type?: string;
  crew_members: CrewPresetMember[];
  use_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Hook for managing crew presets for a project
 */
export function useCrewPresets(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-crew-presets', projectId],
    queryFn: async (): Promise<CrewPreset[]> => {
      if (!projectId) return [];
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-presets`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch crew presets');
      }

      return response.json();
    },
    enabled: !!projectId,
  });

  const createPreset = useMutation({
    mutationFn: async ({
      name,
      description,
      template_type,
      crew_members,
      is_personal,
    }: {
      name: string;
      description?: string;
      template_type?: string;
      crew_members: CrewPresetMember[];
      is_personal?: boolean;
    }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-presets?is_personal=${is_personal || false}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name, description, template_type, crew_members }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create preset');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-presets', projectId] });
    },
  });

  const deletePreset = useMutation({
    mutationFn: async (presetId: string) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/crew-presets/${presetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to delete preset');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-presets', projectId] });
    },
  });

  const applyPreset = useMutation({
    mutationFn: async ({
      callSheetId,
      presetId,
      clearExisting,
    }: {
      callSheetId: string;
      presetId: string;
      clearExisting?: boolean;
    }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/apply-preset/${presetId}?clear_existing=${clearExisting || false}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to apply preset');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-people', variables.callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-presets', projectId] });
    },
  });

  const saveAsPreset = useMutation({
    mutationFn: async ({
      callSheetId,
      name,
      description,
      is_personal,
    }: {
      callSheetId: string;
      name: string;
      description?: string;
      is_personal?: boolean;
    }) => {
      const token = getAuthToken();

      const params = new URLSearchParams({
        preset_name: name,
        is_personal: String(is_personal || false),
      });
      if (description) params.set('preset_description', description);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/save-as-preset?${params}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save as preset');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-presets', projectId] });
    },
  });

  return {
    presets: data || [],
    isLoading,
    error,
    refetch,
    createPreset,
    deletePreset,
    applyPreset,
    saveAsPreset,
  };
}

// =====================================================
// Call Sheet Send Operations
// =====================================================

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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/send`, {
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
  const query = useQuery({
    queryKey: ['backlot-call-sheet-send-history', callSheetId],
    queryFn: async (): Promise<CallSheetSendHistory[]> => {
      if (!callSheetId) return [];

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/send-history`, {
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

  return {
    sendHistory: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// =====================================================
// CALL SHEET COMMENTS
// =====================================================

export interface CallSheetComment {
  id: string;
  call_sheet_id: string;
  parent_comment_id: string | null;
  user_id: string;
  content: string;
  field_reference: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_avatar_url: string | null;
  replies: CallSheetComment[];
}

export interface CallSheetCommentsResponse {
  comments: CallSheetComment[];
  total: number;
  unresolved_count: number;
}

/**
 * Fetch comments for a call sheet
 */
export function useCallSheetComments(callSheetId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['backlot-call-sheet-comments', callSheetId],
    queryFn: async (): Promise<CallSheetCommentsResponse> => {
      if (!callSheetId) return { comments: [], total: 0, unresolved_count: 0 };

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/comments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      return response.json();
    },
    enabled: !!callSheetId,
  });

  const createComment = useMutation({
    mutationFn: async (data: { content: string; parent_comment_id?: string; field_reference?: string }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create comment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-comments', callSheetId] });
    },
  });

  const updateComment = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update comment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-comments', callSheetId] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete comment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-comments', callSheetId] });
    },
  });

  const resolveComment = useMutation({
    mutationFn: async (commentId: string) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to resolve comment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-comments', callSheetId] });
    },
  });

  return {
    comments: query.data?.comments || [],
    total: query.data?.total || 0,
    unresolvedCount: query.data?.unresolved_count || 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createComment,
    updateComment,
    deleteComment,
    resolveComment,
  };
}

// =====================================================
// CALL SHEET VERSION HISTORY
// =====================================================

export interface CallSheetVersion {
  id: string;
  version_number: number;
  changed_fields: string[];
  change_summary: string | null;
  created_at: string;
  created_by_name: string;
  created_by_avatar_url: string | null;
}

export interface CallSheetVersionsResponse {
  versions: CallSheetVersion[];
  current_version: number;
}

/**
 * Fetch version history for a call sheet
 */
export function useCallSheetVersions(callSheetId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['backlot-call-sheet-versions', callSheetId],
    queryFn: async (): Promise<CallSheetVersionsResponse> => {
      if (!callSheetId) return { versions: [], current_version: 1 };

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/versions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch versions');
      }

      return response.json();
    },
    enabled: !!callSheetId,
  });

  const revertToVersion = useMutation({
    mutationFn: async (versionNumber: number) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/revert/${versionNumber}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to revert version');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate both versions and call sheet data
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-versions', callSheetId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet', callSheetId] });
    },
  });

  return {
    versions: query.data?.versions || [],
    currentVersion: query.data?.current_version || 1,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    revertToVersion,
  };
}

// =====================================================
// Call Sheet Shares
// =====================================================

export interface CallSheetShare {
  id: string;
  call_sheet_id: string;
  share_token: string;
  share_url: string;
  name: string | null;
  expires_at: string;
  is_active: boolean;
  has_password: boolean;
  view_count: number;
  last_viewed_at: string | null;
  allowed_actions: string[];
  created_at: string;
  created_by_name: string | null;
}

export interface CreateShareInput {
  name?: string;
  expires_in_days?: number;
  password?: string;
  allowed_actions?: string[];
}

/**
 * Manage share links for a call sheet
 */
export function useCallSheetShares(callSheetId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['backlot-call-sheet-shares', callSheetId],
    queryFn: async (): Promise<{ shares: CallSheetShare[] }> => {
      if (!callSheetId) return { shares: [] };

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/shares`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch shares');
      }

      return response.json();
    },
    enabled: !!callSheetId,
  });

  const createShare = useMutation({
    mutationFn: async (input: CreateShareInput): Promise<CallSheetShare> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/shares`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: input.name,
          expires_in_days: input.expires_in_days || 7,
          password: input.password,
          allowed_actions: input.allowed_actions || ['view'],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create share link');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-shares', callSheetId] });
    },
  });

  const revokeShare = useMutation({
    mutationFn: async (shareId: string) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/shares/${shareId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to revoke share link');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-shares', callSheetId] });
    },
  });

  const deleteShare = useMutation({
    mutationFn: async (shareId: string) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/shares/${shareId}/permanent`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete share link');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-shares', callSheetId] });
    },
  });

  return {
    shares: query.data?.shares || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createShare,
    revokeShare,
    deleteShare,
  };
}

/**
 * Fetch public call sheet by share token (no auth required)
 */
export function usePublicCallSheet(shareToken: string | null, password?: string) {
  return useQuery({
    queryKey: ['public-call-sheet', shareToken, password],
    queryFn: async () => {
      if (!shareToken) throw new Error('No share token');

      const url = new URL(`${API_BASE}/api/v1/backlot/public/call-sheet/${shareToken}`);
      if (password) {
        url.searchParams.set('password', password);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch call sheet');
      }

      return response.json();
    },
    enabled: !!shareToken,
    retry: false,
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

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/members-for-send`, {
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

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/scenes`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/scenes`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/scenes/${id}`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/scenes/${sceneId}`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/scenes/reorder`, {
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

      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/locations`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/locations`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/locations/${id}`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/locations/${locationId}`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/generate-pdf`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/download-pdf`, {
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

/**
 * Download call sheet as Excel file
 */
export function useDownloadCallSheetExcel() {
  return useMutation({
    mutationFn: async (callSheetId: string): Promise<void> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/download-excel`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to download Excel' }));
        throw new Error(error.detail || 'Failed to download Excel');
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'call-sheet.xlsx';
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/set-logo`, {
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
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/sync`, {
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

// =====================================================
// Call Sheet Templates
// =====================================================

export interface BacklotSavedCallSheetTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_type: string | null;
  call_sheet_data: Record<string, unknown>;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallSheetFullData extends BacklotCallSheet {
  people: BacklotCallSheetPerson[];
  scenes: BacklotCallSheetScene[];
  locations: BacklotCallSheetLocation[];
}

/**
 * Hook for managing call sheet templates (account-level)
 */
export function useCallSheetTemplates() {
  const queryClient = useQueryClient();

  // Fetch user's templates
  const templatesQuery = useQuery({
    queryKey: ['backlot-call-sheet-templates'],
    queryFn: async (): Promise<BacklotSavedCallSheetTemplate[]> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheet-templates`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch call sheet templates');
      }

      const data = await response.json();
      return data.templates || [];
    },
  });

  // Create a new template
  const createTemplate = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      template_type?: string;
      call_sheet_data: Record<string, unknown>;
    }): Promise<BacklotSavedCallSheetTemplate> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheet-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create template' }));
        throw new Error(error.detail || 'Failed to create template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-templates'] });
    },
  });

  // Delete a template
  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string): Promise<void> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheet-templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete template' }));
        throw new Error(error.detail || 'Failed to delete template');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-templates'] });
    },
  });

  // Save an existing call sheet as a template
  const saveAsTemplate = useMutation({
    mutationFn: async (data: {
      callSheetId: string;
      name: string;
      description?: string;
    }): Promise<BacklotSavedCallSheetTemplate> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${data.callSheetId}/save-as-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to save as template' }));
        throw new Error(error.detail || 'Failed to save as template');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-templates'] });
    },
  });

  // Increment use count when a template is used
  const incrementUseCount = useMutation({
    mutationFn: async (templateId: string): Promise<void> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheet-templates/${templateId}/use`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Don't throw - this is a non-critical operation
        console.warn('Failed to increment template use count');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-templates'] });
    },
  });

  return {
    templates: templatesQuery.data || [],
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    createTemplate,
    deleteTemplate,
    saveAsTemplate,
    incrementUseCount,
  };
}

/**
 * Fetch full call sheet data including people, scenes, and locations
 * Used for prefilling from a previous call sheet
 */
export function useCallSheetFullData(callSheetId: string | null) {
  return useQuery({
    queryKey: ['backlot-call-sheet-full', callSheetId],
    queryFn: async (): Promise<CallSheetFullData> => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/full`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch call sheet full data');
      }

      return response.json();
    },
    enabled: !!callSheetId,
  });
}
