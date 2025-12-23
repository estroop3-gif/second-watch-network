/**
 * useHotSet - Hook for managing real-time production day (Hot Set)
 *
 * Features:
 * - Session management (create, start, wrap)
 * - Scene progression (start, complete, skip, reorder)
 * - Time markers
 * - Real-time dashboard with polling
 * - OT cost projections
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  HotSetSession,
  HotSetSceneLog,
  HotSetMarker,
  HotSetCrew,
  HotSetDashboard,
  HotSetDayType,
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

// =============================================================================
// QUERY KEYS
// =============================================================================

export const HOT_SET_KEYS = {
  sessions: (projectId: string) => ['backlot', 'hot-set', projectId, 'sessions'],
  session: (sessionId: string) => ['backlot', 'hot-set', 'session', sessionId],
  dashboard: (sessionId: string) => ['backlot', 'hot-set', 'dashboard', sessionId],
  scenes: (sessionId: string) => ['backlot', 'hot-set', 'scenes', sessionId],
  markers: (sessionId: string) => ['backlot', 'hot-set', 'markers', sessionId],
  crew: (sessionId: string) => ['backlot', 'hot-set', 'crew', sessionId],
  costProjection: (sessionId: string) => ['backlot', 'hot-set', 'cost', sessionId],
};

// =============================================================================
// SESSION HOOKS
// =============================================================================

/**
 * Get all Hot Set sessions for a project
 */
export function useHotSetSessions(projectId: string | null) {
  return useQuery({
    queryKey: HOT_SET_KEYS.sessions(projectId || ''),
    queryFn: async (): Promise<HotSetSession[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/hot-set/sessions`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch sessions' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Get a specific Hot Set session
 */
export function useHotSetSession(projectId: string | null, sessionId: string | null) {
  return useQuery({
    queryKey: HOT_SET_KEYS.session(sessionId || ''),
    queryFn: async (): Promise<HotSetSession | null> => {
      if (!projectId || !sessionId) return null;

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/hot-set/sessions/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Session not found' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!projectId && !!sessionId,
  });
}

/**
 * Create a new Hot Set session
 */
export function useCreateHotSetSession(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      production_day_id: string;
      call_sheet_id?: string;
      day_type?: HotSetDayType;
      import_from_call_sheet?: boolean;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/hot-set/sessions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create session' }));
        throw new Error(error.detail);
      }

      return response.json() as Promise<HotSetSession>;
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.sessions(projectId) });
      }
    },
  });
}

/**
 * Update a Hot Set session
 */
export function useUpdateHotSetSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      ...input
    }: {
      sessionId: string;
      day_type?: HotSetDayType;
      default_hourly_rate?: number;
      ot_multiplier_1?: number;
      ot_multiplier_2?: number;
      ot_threshold_1_hours?: number;
      ot_threshold_2_hours?: number;
      notes?: string;
    }) => {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update session' }));
        throw new Error(error.detail);
      }

      return response.json() as Promise<HotSetSession>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.session(data.id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(data.id) });
    },
  });
}

/**
 * Delete a Hot Set session
 */
export function useDeleteHotSetSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, projectId }: { sessionId: string; projectId: string }) => {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete session' }));
        throw new Error(error.detail);
      }

      return { sessionId, projectId };
    },
    onSuccess: ({ projectId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.sessions(projectId) });
    },
  });
}

// =============================================================================
// SESSION ACTIONS
// =============================================================================

/**
 * Start a Hot Set session (begin the production day)
 */
export function useStartHotSetSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/start`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to start session' }));
        throw new Error(error.detail);
      }

      return response.json() as Promise<HotSetSession>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.session(data.id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(data.id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.markers(data.id) });
    },
  });
}

/**
 * Wrap a Hot Set session (end the production day)
 */
export function useWrapHotSetSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/wrap`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to wrap session' }));
        throw new Error(error.detail);
      }

      return response.json() as Promise<HotSetSession>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.session(data.id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(data.id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.markers(data.id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scenes(data.id) });
    },
  });
}

/**
 * Import scenes from a call sheet
 */
export function useImportFromCallSheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, callSheetId }: { sessionId: string; callSheetId: string }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/import-from-call-sheet?call_sheet_id=${callSheetId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to import' }));
        throw new Error(error.detail);
      }

      return { sessionId };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scenes(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

// =============================================================================
// SCENE PROGRESSION
// =============================================================================

/**
 * Get scenes for a session
 */
export function useHotSetScenes(sessionId: string | null) {
  return useQuery({
    queryKey: HOT_SET_KEYS.scenes(sessionId || ''),
    queryFn: async (): Promise<HotSetSceneLog[]> => {
      if (!sessionId) return [];

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/scenes`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch scenes' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!sessionId,
  });
}

/**
 * Start shooting a scene
 */
export function useStartScene() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, sceneId }: { sessionId: string; sceneId: string }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/scenes/${sceneId}/start`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to start scene' }));
        throw new Error(error.detail);
      }

      return { sessionId, scene: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scenes(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.markers(sessionId) });
    },
  });
}

/**
 * Complete a scene
 */
export function useCompleteScene() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      sceneId,
      notes,
    }: {
      sessionId: string;
      sceneId: string;
      notes?: string;
    }) => {
      const token = getAuthToken();
      const url = new URL(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/scenes/${sceneId}/complete`
      );
      if (notes) url.searchParams.set('notes', notes);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to complete scene' }));
        throw new Error(error.detail);
      }

      return { sessionId, scene: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scenes(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

/**
 * Skip a scene
 */
export function useSkipScene() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      sceneId,
      reason,
    }: {
      sessionId: string;
      sceneId: string;
      reason?: string;
    }) => {
      const token = getAuthToken();
      const url = new URL(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/scenes/${sceneId}/skip`
      );
      if (reason) url.searchParams.set('reason', reason);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to skip scene' }));
        throw new Error(error.detail);
      }

      return { sessionId, scene: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scenes(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

/**
 * Reorder scenes
 */
export function useReorderScenes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, sceneIds }: { sessionId: string; sceneIds: string[] }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/scenes/reorder`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scene_ids: sceneIds }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reorder scenes' }));
        throw new Error(error.detail);
      }

      return { sessionId };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scenes(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

// =============================================================================
// MARKERS
// =============================================================================

/**
 * Get markers for a session
 */
export function useHotSetMarkers(sessionId: string | null) {
  return useQuery({
    queryKey: HOT_SET_KEYS.markers(sessionId || ''),
    queryFn: async (): Promise<HotSetMarker[]> => {
      if (!sessionId) return [];

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/markers`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch markers' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!sessionId,
  });
}

/**
 * Add a time marker
 */
export function useAddMarker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      marker_type,
      label,
      notes,
      timestamp,
    }: {
      sessionId: string;
      marker_type: string;
      label?: string;
      notes?: string;
      timestamp?: string;
    }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/markers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ marker_type, label, notes, timestamp }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add marker' }));
        throw new Error(error.detail);
      }

      return { sessionId, marker: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.markers(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

// =============================================================================
// DASHBOARD (REAL-TIME)
// =============================================================================

/**
 * Get dashboard data for real-time view
 * Polls when session is in_progress
 */
export function useHotSetDashboard(
  sessionId: string | null,
  options?: { pollingInterval?: number }
) {
  return useQuery({
    queryKey: HOT_SET_KEYS.dashboard(sessionId || ''),
    queryFn: async (): Promise<HotSetDashboard | null> => {
      if (!sessionId) return null;

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/dashboard`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch dashboard' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!sessionId,
    refetchInterval: options?.pollingInterval,
    refetchOnWindowFocus: true,
  });
}

// =============================================================================
// COST PROJECTION
// =============================================================================

/**
 * Get detailed cost projection
 */
export function useHotSetCostProjection(sessionId: string | null) {
  return useQuery({
    queryKey: HOT_SET_KEYS.costProjection(sessionId || ''),
    queryFn: async () => {
      if (!sessionId) return null;

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/cost-projection`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch costs' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!sessionId,
  });
}

/**
 * Get crew for a session
 */
export function useHotSetCrew(sessionId: string | null) {
  return useQuery({
    queryKey: HOT_SET_KEYS.crew(sessionId || ''),
    queryFn: async (): Promise<HotSetCrew[]> => {
      if (!sessionId) return [];

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/crew`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch crew' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!sessionId,
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format elapsed time as HH:MM:SS
 */
export function formatElapsedTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Format time as HH:MM
 */
export function formatTime(isoString: string | null): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

/**
 * Calculate elapsed seconds from a start time
 */
export function calculateElapsedSeconds(startTime: string): number {
  try {
    const start = new Date(startTime);
    const now = new Date();
    return Math.floor((now.getTime() - start.getTime()) / 1000);
  } catch {
    return 0;
  }
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get schedule status color
 */
export function getScheduleStatusColor(status: string): string {
  switch (status) {
    case 'ahead':
      return 'text-green-400';
    case 'behind':
      return 'text-red-400';
    default:
      return 'text-yellow-400';
  }
}

/**
 * Get schedule status background color
 */
export function getScheduleStatusBgColor(status: string): string {
  switch (status) {
    case 'ahead':
      return 'bg-green-500/20 border-green-500/30';
    case 'behind':
      return 'bg-red-500/20 border-red-500/30';
    default:
      return 'bg-yellow-500/20 border-yellow-500/30';
  }
}

/**
 * Format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
