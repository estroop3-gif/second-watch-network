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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  return useQuery({
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
