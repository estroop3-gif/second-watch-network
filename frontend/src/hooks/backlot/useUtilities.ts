/**
 * useUtilities - Hooks for Backlot Utilities
 * Sun/Weather Widget, QR Check-in, Personal Notes & Bookmarks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const RAW_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

// =============================================================================
// TYPES - Day Settings / Weather
// =============================================================================

export interface DaySettings {
  id: string;
  project_id: string;
  shoot_date: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  timezone: string;
  weather_override_summary?: string;
  sunrise_time?: string;
  sunset_time?: string;
  golden_hour_morning_start?: string;
  golden_hour_morning_end?: string;
  golden_hour_evening_start?: string;
  golden_hour_evening_end?: string;
  weather_summary?: string;
  temperature_high_f?: number;
  temperature_low_f?: number;
  precipitation_chance?: number;
  wind_mph?: number;
  created_at: string;
  updated_at: string;
}

export interface SunWeatherData {
  shoot_date: string;
  location_name?: string;
  sunrise?: string;
  sunset?: string;
  golden_hour_morning?: { start?: string; end?: string };
  golden_hour_evening?: { start?: string; end?: string };
  weather_summary?: string;
  temperature_high_f?: number;
  temperature_low_f?: number;
  precipitation_chance?: number;
  wind_mph?: number;
  override_note?: string;
}

export interface CreateDaySettingsInput {
  shoot_date: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  weather_override_summary?: string;
}

// =============================================================================
// TYPES - Check-in System
// =============================================================================

export interface CheckinSession {
  id: string;
  project_id: string;
  shoot_date: string;
  title: string;
  qr_token: string;
  is_active: boolean;
  safety_brief?: string;
  policy_text?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  deactivated_at?: string;
  checkin_count: number;
  backlot_projects?: { id: string; title: string };
}

export interface CreateCheckinSessionInput {
  shoot_date: string;
  title: string;
  safety_brief?: string;
  policy_text?: string;
  notes?: string;
}

export interface CheckinRecord {
  id: string;
  project_id: string;
  session_id: string;
  user_id: string;
  checked_in_at: string;
  acknowledged_safety_brief: boolean;
  acknowledged_policies: boolean;
  device_info?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  user_name?: string;
  user_avatar?: string;
}

export interface PerformCheckinInput {
  qr_token: string;
  acknowledged_safety_brief?: boolean;
  acknowledged_policies?: boolean;
  device_info?: string;
  latitude?: number;
  longitude?: number;
}

// =============================================================================
// TYPES - Personal Notes & Bookmarks
// =============================================================================

export interface UserNote {
  id: string;
  project_id: string;
  user_id: string;
  title?: string;
  body: string;
  is_pinned: boolean;
  color?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateUserNoteInput {
  title?: string;
  body: string;
  is_pinned?: boolean;
  color?: string;
  tags?: string[];
}

export interface UserBookmark {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  label?: string;
  created_at: string;
}

export interface CreateUserBookmarkInput {
  entity_type: string;
  entity_id: string;
  label?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function getAuthToken(): string {
  const token = api.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
}

// =============================================================================
// DAY SETTINGS / WEATHER HOOKS
// =============================================================================

export function useDaySettings(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-day-settings', projectId],
    queryFn: async (): Promise<DaySettings[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/day-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch day settings');
      const data = await response.json();
      return data.settings || [];
    },
    enabled: !!projectId,
  });
}

export function useDaySettingsForDate(projectId: string | null, shootDate: string | null) {
  return useQuery({
    queryKey: ['backlot-day-settings', projectId, shootDate],
    queryFn: async (): Promise<DaySettings | null> => {
      if (!projectId || !shootDate) return null;

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/day-settings/${shootDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch day settings');
      const data = await response.json();
      return data.settings || null;
    },
    enabled: !!projectId && !!shootDate,
  });
}

export function useSunWeather(projectId: string | null, shootDate: string | null) {
  return useQuery({
    queryKey: ['backlot-sun-weather', projectId, shootDate],
    queryFn: async (): Promise<SunWeatherData | null> => {
      if (!projectId || !shootDate) return null;

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/sun-weather/${shootDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch sun/weather data');
      const data = await response.json();
      return data.data || null;
    },
    enabled: !!projectId && !!shootDate,
  });
}

export function useCreateDaySettings(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDaySettingsInput): Promise<DaySettings> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/day-settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error('Failed to create day settings');
      const data = await response.json();
      return data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-day-settings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-sun-weather', projectId] });
    },
  });
}

export function useUpdateDaySettings(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shootDate, updates }: { shootDate: string; updates: Partial<CreateDaySettingsInput & DaySettings> }): Promise<DaySettings> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/day-settings/${shootDate}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update day settings');
      const data = await response.json();
      return data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-day-settings', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-sun-weather', projectId] });
    },
  });
}

// =============================================================================
// CHECK-IN SESSION HOOKS
// =============================================================================

export function useCheckinSessions(projectId: string | null, activeOnly?: boolean) {
  return useQuery({
    queryKey: ['backlot-checkin-sessions', projectId, activeOnly],
    queryFn: async (): Promise<CheckinSession[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const url = `${API_BASE}/backlot/projects/${projectId}/checkin-sessions${activeOnly ? '?active_only=true' : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch check-in sessions');
      const data = await response.json();
      return data.sessions || [];
    },
    enabled: !!projectId,
  });
}

export function useCheckinSession(projectId: string | null, sessionId: string | null) {
  return useQuery({
    queryKey: ['backlot-checkin-session', projectId, sessionId],
    queryFn: async (): Promise<CheckinSession | null> => {
      if (!projectId || !sessionId) return null;

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/checkin-sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch check-in session');
      const data = await response.json();
      return data.session || null;
    },
    enabled: !!projectId && !!sessionId,
  });
}

export function useCreateCheckinSession(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCheckinSessionInput): Promise<CheckinSession> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/checkin-sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error('Failed to create check-in session');
      const data = await response.json();
      return data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-checkin-sessions', projectId] });
    },
  });
}

export function useDeactivateCheckinSession(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<CheckinSession> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/checkin-sessions/${sessionId}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to deactivate session');
      const data = await response.json();
      return data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-checkin-sessions', projectId] });
    },
  });
}

export function useActivateCheckinSession(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string): Promise<CheckinSession> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/checkin-sessions/${sessionId}/activate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to activate session');
      const data = await response.json();
      return data.session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-checkin-sessions', projectId] });
    },
  });
}

export function useSessionCheckins(projectId: string | null, sessionId: string | null) {
  return useQuery({
    queryKey: ['backlot-session-checkins', projectId, sessionId],
    queryFn: async (): Promise<CheckinRecord[]> => {
      if (!projectId || !sessionId) return [];

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/checkin-sessions/${sessionId}/checkins`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch check-ins');
      const data = await response.json();
      return data.checkins || [];
    },
    enabled: !!projectId && !!sessionId,
  });
}

// =============================================================================
// CHECK-IN CREW HOOKS
// =============================================================================

export function useSessionByToken(qrToken: string | null) {
  return useQuery({
    queryKey: ['backlot-checkin-by-token', qrToken],
    queryFn: async (): Promise<{ session: CheckinSession; already_checked_in: boolean; project: any } | null> => {
      if (!qrToken) return null;

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/checkin/session/${qrToken}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to get session');
      }
      return response.json();
    },
    enabled: !!qrToken,
    retry: false,
  });
}

export function usePerformCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PerformCheckinInput): Promise<{ checkin: CheckinRecord; success: boolean }> => {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/checkin/perform`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to check in');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-checkin-by-token', variables.qr_token] });
      queryClient.invalidateQueries({ queryKey: ['backlot-session-checkins'] });
    },
  });
}

// =============================================================================
// USER NOTES HOOKS
// =============================================================================

export function useMyNotes(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-my-notes', projectId],
    queryFn: async (): Promise<UserNote[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/my-notes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch notes');
      const data = await response.json();
      return data.notes || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateNote(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserNoteInput): Promise<UserNote> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/my-notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error('Failed to create note');
      const data = await response.json();
      return data.note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-notes', projectId] });
    },
  });
}

export function useUpdateNote(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, updates }: { noteId: string; updates: Partial<CreateUserNoteInput> }): Promise<UserNote> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/my-notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update note');
      const data = await response.json();
      return data.note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-notes', projectId] });
    },
  });
}

export function useDeleteNote(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string): Promise<void> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/my-notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete note');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-notes', projectId] });
    },
  });
}

// =============================================================================
// USER BOOKMARKS HOOKS
// =============================================================================

export function useMyBookmarks(projectId: string | null, entityType?: string) {
  return useQuery({
    queryKey: ['backlot-my-bookmarks', projectId, entityType],
    queryFn: async (): Promise<UserBookmark[]> => {
      if (!projectId) return [];

      const token = getAuthToken();
      const url = entityType
        ? `${API_BASE}/backlot/projects/${projectId}/my-bookmarks?entity_type=${entityType}`
        : `${API_BASE}/backlot/projects/${projectId}/my-bookmarks`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch bookmarks');
      const data = await response.json();
      return data.bookmarks || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateBookmark(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserBookmarkInput): Promise<{ bookmark: UserBookmark; already_exists?: boolean }> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/my-bookmarks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) throw new Error('Failed to create bookmark');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-bookmarks', projectId] });
    },
  });
}

export function useDeleteBookmark(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookmarkId: string): Promise<void> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(`${API_BASE}/backlot/projects/${projectId}/my-bookmarks/${bookmarkId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete bookmark');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-bookmarks', projectId] });
    },
  });
}

export function useDeleteBookmarkByEntity(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityType, entityId }: { entityType: string; entityId: string }): Promise<void> => {
      if (!projectId) throw new Error('No project ID');

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/my-bookmarks/by-entity?entity_type=${entityType}&entity_id=${entityId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to delete bookmark');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-my-bookmarks', projectId] });
    },
  });
}

export function useCheckBookmark(projectId: string | null, entityType: string | null, entityId: string | null) {
  return useQuery({
    queryKey: ['backlot-bookmark-check', projectId, entityType, entityId],
    queryFn: async (): Promise<{ exists: boolean; bookmark_id?: string }> => {
      if (!projectId || !entityType || !entityId) return { exists: false };

      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE}/backlot/projects/${projectId}/my-bookmarks/check?entity_type=${entityType}&entity_id=${entityId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) return { exists: false };
      return response.json();
    },
    enabled: !!projectId && !!entityType && !!entityId,
  });
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const BOOKMARK_ENTITY_TYPES = [
  { value: 'scene', label: 'Scene' },
  { value: 'shot', label: 'Shot' },
  { value: 'task', label: 'Task' },
  { value: 'note', label: 'Note' },
  { value: 'doc', label: 'Document' },
  { value: 'shot_list', label: 'Shot List' },
  { value: 'slate_log', label: 'Slate Log' },
  { value: 'continuity_note', label: 'Continuity Note' },
  { value: 'location', label: 'Location' },
  { value: 'person', label: 'Person' },
  { value: 'day', label: 'Shoot Day' },
  { value: 'review', label: 'Review' },
] as const;

export const NOTE_COLORS = [
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-100 border-yellow-300' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-100 border-blue-300' },
  { value: 'green', label: 'Green', class: 'bg-green-100 border-green-300' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-100 border-pink-300' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-100 border-purple-300' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-100 border-orange-300' },
] as const;
