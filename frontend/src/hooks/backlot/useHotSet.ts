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
  HotSetScheduleBlock,
  HotSetScheduleImportSource,
  HotSetScheduleTrackingMode,
  HotSetDayPreview,
  HotSetOTConfig,
} from '@/types/backlot';

// =============================================================================
// OT THRESHOLDS CONFIGURATION
// =============================================================================

export const OT_THRESHOLDS: Record<HotSetDayType, HotSetOTConfig> = {
  '4hr':     { ot1_after: 4,  ot2_after: 6,  label: '4 Hour Day',  desc: 'OT after 4hr, DT after 6hr' },
  '8hr':     { ot1_after: 8,  ot2_after: 10, label: '8 Hour Day',  desc: 'OT after 8hr, DT after 10hr' },
  '10hr':    { ot1_after: 10, ot2_after: 12, label: '10 Hour Day', desc: 'OT after 10hr, DT after 12hr' },
  '12hr':    { ot1_after: 12, ot2_after: 14, label: '12 Hour Day', desc: 'OT after 12hr, DT after 14hr' },
  '6th_day': { ot1_after: 8,  ot2_after: 12, label: '6th Day (Saturday)', desc: 'OT after 8hr (Saturday rules)' },
  '7th_day': { ot1_after: 0,  ot2_after: 0,  label: '7th Day (Sunday)',   desc: 'All hours at Double Time' },
};

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Helper to build URL with query params (handles both relative and absolute API_BASE)
 */
function buildUrl(path: string): URL {
  const base = API_BASE || window.location.origin;
  return new URL(path, base);
}

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
  scheduleBlocks: (sessionId: string) => ['backlot', 'hot-set', 'schedule-blocks', sessionId],
  dayPreview: (projectId: string, productionDayId: string, dayType: string) =>
    ['backlot', 'hot-set', 'day-preview', projectId, productionDayId, dayType],
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
 * Get day preview for Hot Set session creation
 * Returns crew from DOOD/Call Sheet, their rates, and OT projections
 */
export function useHotSetDayPreview(
  projectId: string | null,
  productionDayId: string | null,
  dayType: HotSetDayType
) {
  return useQuery({
    queryKey: HOT_SET_KEYS.dayPreview(projectId || '', productionDayId || '', dayType),
    queryFn: async (): Promise<HotSetDayPreview | null> => {
      if (!projectId || !productionDayId) return null;

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/hot-set/day-preview?` +
        `production_day_id=${productionDayId}&day_type=${dayType}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch day preview' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!projectId && !!productionDayId,
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
      // New: Checkbox-based import options
      import_hour_schedule?: boolean;
      import_scenes?: boolean;
      // Legacy (for backwards compat)
      import_source?: HotSetScheduleImportSource;
      schedule_tracking_mode?: HotSetScheduleTrackingMode;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      console.log('[HotSet] Creating session with:', input);
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
        console.error('[HotSet] Create session failed:', response.status, error);
        throw new Error(error.detail || `Request failed with status ${response.status}`);
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
 * Resume a wrapped Hot Set session (in case of accidental wrap)
 * Sets status back to in_progress and clears wrap time
 */
export function useResumeHotSetSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/resume`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to resume session' }));
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
 * Confirm crew call (1st AD manually confirms crew arrival)
 */
export function useConfirmCrewCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/confirm-crew-call`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to confirm crew call' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.session(data.session_id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(data.session_id) });
    },
  });
}

/**
 * Confirm first shot (1st AD manually confirms cameras rolling)
 */
export function useConfirmFirstShot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/confirm-first-shot`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to confirm first shot' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.session(data.session_id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(data.session_id) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.markers(data.session_id) });
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

/**
 * Import scenes from the production day's assigned scenes
 */
export function useImportFromProductionDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }): Promise<{ sessionId: string; scenesImported: number }> => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/import-from-production-day`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to import' }));
        throw new Error(error.detail);
      }

      const data = await response.json();
      return { sessionId, scenesImported: data.scenes_imported || 0 };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.session(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scenes(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

/**
 * Import hour schedule from the production day
 */
export function useImportFromHourSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }): Promise<{ sessionId: string; scenesImported: number; blocksImported: number }> => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/import-from-hour-schedule`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to import' }));
        throw new Error(error.detail);
      }

      const data = await response.json();
      return { sessionId, scenesImported: data.scenes_imported || 0, blocksImported: data.blocks_imported || 0 };
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
      const url = buildUrl(`${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/scenes/${sceneId}/complete`);
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
      // Also invalidate coverage and scenes to reflect scene completion
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      // Invalidate tasks - scene completion may trigger task completion
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'tasks'] });
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
      const url = buildUrl(`${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/scenes/${sceneId}/skip`);
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
// SCHEDULE BLOCKS
// =============================================================================

/**
 * Get schedule blocks for a session
 */
export function useScheduleBlocks(sessionId: string | null) {
  return useQuery({
    queryKey: HOT_SET_KEYS.scheduleBlocks(sessionId || ''),
    queryFn: async (): Promise<HotSetScheduleBlock[]> => {
      if (!sessionId) return [];

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/schedule-blocks`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch schedule blocks' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!sessionId,
  });
}

/**
 * Update a schedule block's expected times
 */
export function useUpdateScheduleBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      blockId,
      expected_start_time,
      expected_end_time,
      notes,
    }: {
      sessionId: string;
      blockId: string;
      expected_start_time?: string;
      expected_end_time?: string;
      notes?: string;
    }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/schedule-blocks/${blockId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ expected_start_time, expected_end_time, notes }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update schedule block' }));
        throw new Error(error.detail);
      }

      return { sessionId, block: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scheduleBlocks(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

/**
 * Start a schedule block (e.g., start meal break)
 */
export function useStartScheduleBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, blockId }: { sessionId: string; blockId: string }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/schedule-blocks/${blockId}/start`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to start schedule block' }));
        throw new Error(error.detail);
      }

      return { sessionId, block: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scheduleBlocks(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

/**
 * Complete a schedule block and auto-create marker
 */
export function useCompleteScheduleBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, blockId }: { sessionId: string; blockId: string }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/schedule-blocks/${blockId}/complete`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to complete schedule block' }));
        throw new Error(error.detail);
      }

      return { sessionId, block: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scheduleBlocks(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.markers(sessionId) });
    },
  });
}

/**
 * Skip a schedule block
 */
export function useSkipScheduleBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sessionId,
      blockId,
      reason,
    }: {
      sessionId: string;
      blockId: string;
      reason?: string;
    }) => {
      const token = getAuthToken();
      const url = buildUrl(`${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/schedule-blocks/${blockId}/skip`);
      if (reason) url.searchParams.set('reason', reason);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to skip schedule block' }));
        throw new Error(error.detail);
      }

      return { sessionId, block: await response.json() };
    },
    onSuccess: ({ sessionId }) => {
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.scheduleBlocks(sessionId) });
      queryClient.invalidateQueries({ queryKey: HOT_SET_KEYS.dashboard(sessionId) });
    },
  });
}

// =============================================================================
// AD NOTES & WRAP REPORT
// =============================================================================

/**
 * Update session notes (optimized for auto-save)
 */
export function useUpdateSessionNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, notes }: { sessionId: string; notes: string }) => {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/notes`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update notes' }));
        throw new Error(error.detail);
      }

      return { sessionId, notes };
    },
    onSuccess: ({ sessionId }) => {
      // Don't invalidate dashboard on every keystroke - notes are local
      // Only invalidate if we need fresh data elsewhere
    },
  });
}

/**
 * Wrap report data structure
 */
export interface WrapReportData {
  day_number: number;
  date: string;
  call_time: string | null;
  wrap_time: string | null;
  total_shooting_minutes: number;
  scenes_completed: { scene_number: string; actual_minutes: number; status: string }[];
  scenes_skipped: { scene_number: string; actual_minutes: number; status: string }[];
  scheduled_minutes: number;
  variance_minutes: number;
  ad_notes: string | null;
  markers: { type: string; time: string; label: string }[];
}

/**
 * Get wrap report data for a session
 */
export function useWrapReport(sessionId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'hot-set', 'wrap-report', sessionId],
    queryFn: async (): Promise<WrapReportData | null> => {
      if (!sessionId) return null;

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/hot-set/sessions/${sessionId}/wrap-report`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch wrap report' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!sessionId,
  });
}

// =============================================================================
// HOT SET SETTINGS
// =============================================================================

import { HotSetSettings, HotSetSettingsUpdate } from '@/types/backlot';

/**
 * Get Hot Set settings for a project
 */
export function useHotSetSettings(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'hot-set', 'settings', projectId],
    queryFn: async (): Promise<HotSetSettings | null> => {
      if (!projectId) return null;

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/hot-set/settings`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch settings' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Update Hot Set settings for a project
 */
export function useUpdateHotSetSettings(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: HotSetSettingsUpdate) => {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/hot-set/settings`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update settings' }));
        throw new Error(error.detail);
      }

      return response.json() as Promise<HotSetSettings>;
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['backlot', 'hot-set', 'settings', projectId] });
      }
    },
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
 * @param isoString - ISO timestamp string
 * @param timezone - Optional IANA timezone string (e.g., 'America/Los_Angeles')
 *                   If not provided, uses the user's local timezone
 */
export function formatTime(isoString: string | null, timezone?: string | null): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    if (timezone) {
      options.timeZone = timezone;
    }
    return date.toLocaleTimeString([], options);
  } catch {
    return '--:--';
  }
}

/**
 * Get the current time formatted in a specific timezone
 * @param timezone - Optional IANA timezone string (e.g., 'America/Los_Angeles')
 *                   If not provided, uses the user's local timezone
 */
export function getCurrentTimeFormatted(timezone?: string | null): string {
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    if (timezone) {
      options.timeZone = timezone;
    }
    return now.toLocaleTimeString([], options);
  } catch {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Get the current date formatted in a specific timezone
 * @param timezone - Optional IANA timezone string (e.g., 'America/Los_Angeles')
 *                   If not provided, uses the user's local timezone
 */
export function getCurrentDateFormatted(timezone?: string | null): string {
  try {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    };
    if (timezone) {
      options.timeZone = timezone;
    }
    return now.toLocaleDateString('en-US', options);
  } catch {
    return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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

/**
 * Format schedule time (HH:MM or ISO timestamp) for display
 * @param time - Time string in HH:MM format or ISO timestamp
 * @param timezone - Optional IANA timezone for ISO timestamps
 */
export function formatScheduleTime(time: string | null | undefined, timezone?: string | null): string {
  if (!time) return '--:--';
  try {
    // Check if it's an ISO timestamp (contains T or Z)
    if (time.includes('T') || time.includes('Z')) {
      const date = new Date(time);
      const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
      if (timezone) {
        options.timeZone = timezone;
      }
      return date.toLocaleTimeString('en-US', options);
    }

    // Handle HH:MM format
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
}

/**
 * Format deviation minutes as readable string
 */
export function formatDeviation(minutes: number): string {
  if (minutes === 0) return 'On time';
  const absMinutes = Math.abs(minutes);
  const hours = Math.floor(absMinutes / 60);
  const mins = absMinutes % 60;

  let timeStr = '';
  if (hours > 0) {
    timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  } else {
    timeStr = `${mins}m`;
  }

  return minutes > 0 ? `${timeStr} behind` : `${timeStr} ahead`;
}

/**
 * Get deviation color class
 */
export function getDeviationColor(minutes: number): string {
  if (minutes > 15) return 'text-red-400';
  if (minutes > 0) return 'text-yellow-400';
  if (minutes < -15) return 'text-green-400';
  return 'text-bone-white';
}

/**
 * Get deviation background color class
 */
export function getDeviationBgColor(minutes: number): string {
  if (minutes > 15) return 'bg-red-500/20 border-red-500/30';
  if (minutes > 0) return 'bg-yellow-500/20 border-yellow-500/30';
  if (minutes < -15) return 'bg-green-500/20 border-green-500/30';
  return 'bg-soft-black border-muted-gray/30';
}

// =============================================================================
// PROJECTED SCHEDULE HELPERS
// =============================================================================

import { ProjectedScheduleItem } from '@/types/backlot';

/**
 * Find the current activity from projected schedule (non-scene item in progress)
 */
export function findCurrentActivity(
  projectedSchedule: ProjectedScheduleItem[] | undefined
): ProjectedScheduleItem | null {
  if (!projectedSchedule) return null;
  return projectedSchedule.find(
    item => item.status === 'in_progress' && item.type !== 'scene'
  ) || null;
}

/**
 * Find the next pending activity from projected schedule (non-scene item)
 */
export function findNextActivity(
  projectedSchedule: ProjectedScheduleItem[] | undefined
): ProjectedScheduleItem | null {
  if (!projectedSchedule) return null;
  return projectedSchedule.find(
    item => item.status === 'pending' && item.type !== 'scene' && item.source_type === 'schedule_block'
  ) || null;
}

/**
 * Get overall schedule variance from projected schedule
 * Returns minutes: positive = ahead, negative = behind
 */
export function getScheduleVariance(
  projectedSchedule: ProjectedScheduleItem[] | undefined
): number {
  if (!projectedSchedule || projectedSchedule.length === 0) return 0;

  // Find the current or last completed item
  const currentOrLastCompleted = [...projectedSchedule]
    .reverse()
    .find(item => item.status === 'in_progress' || item.status === 'completed');

  return currentOrLastCompleted?.variance_from_plan ?? 0;
}
