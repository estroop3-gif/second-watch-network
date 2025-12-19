/**
 * useDailies - Hooks for managing dailies, cards, clips, and notes
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotDailiesDay,
  BacklotDailiesCard,
  BacklotDailiesClip,
  BacklotDailiesClipNote,
  DailiesDayInput,
  DailiesCardInput,
  DailiesClipInput,
  DailiesClipUpdateInput,
  DailiesClipNoteInput,
  DailiesLocalIngestRequest,
  DailiesProjectSummary,
  DailiesDaySummary,
  DailiesClipFilters,
  DailiesStorageMode,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// DAILIES DAYS
// =============================================================================

interface UseDailiesDaysOptions {
  projectId: string | null;
  limit?: number;
}

export function useDailiesDays(options: UseDailiesDaysOptions) {
  const { projectId, limit = 100 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-days', { projectId, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/days?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch days' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.days || []) as BacklotDailiesDay[];
    },
    enabled: !!projectId,
  });

  const createDay = useMutation({
    mutationFn: async ({ projectId, ...input }: DailiesDayInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/days`,
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
      return result.day as BacklotDailiesDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateDay = useMutation({
    mutationFn: async ({ id, ...input }: Partial<DailiesDayInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/days/${id}`, {
        method: 'PATCH',
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
      return result.day as BacklotDailiesDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
    },
  });

  const deleteDay = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/days/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete day' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  return {
    days: data || [],
    isLoading,
    error,
    refetch,
    createDay,
    updateDay,
    deleteDay,
  };
}

// Single day fetch
export function useDailiesDay(dayId: string | null) {
  return useQuery({
    queryKey: ['dailies-day', dayId],
    queryFn: async () => {
      if (!dayId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/days/${dayId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch day' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.day as BacklotDailiesDay;
    },
    enabled: !!dayId,
  });
}

// =============================================================================
// DAILIES CARDS
// =============================================================================

interface UseDailiesCardsOptions {
  dayId: string | null;
  projectId?: string | null;
  limit?: number;
}

export function useDailiesCards(options: UseDailiesCardsOptions) {
  const { dayId, projectId, limit = 50 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-cards', { dayId, projectId, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!dayId && !projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      let url: string;
      if (dayId) {
        url = `${API_BASE}/api/v1/backlot/dailies/days/${dayId}/cards?limit=${limit}`;
      } else {
        url = `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/cards?limit=${limit}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch cards' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.cards || []) as BacklotDailiesCard[];
    },
    enabled: !!dayId || !!projectId,
  });

  const createCard = useMutation({
    mutationFn: async ({
      dayId,
      projectId,
      ...input
    }: DailiesCardInput & { dayId: string; projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/days/${dayId}/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create card' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.card as BacklotDailiesCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, ...input }: Partial<DailiesCardInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/cards/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update card' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.card as BacklotDailiesCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/cards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete card' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const verifyChecksum = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/cards/${id}/checksum?verified=${verified}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to verify checksum' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.card as BacklotDailiesCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
    },
  });

  return {
    cards: data || [],
    isLoading,
    error,
    refetch,
    createCard,
    updateCard,
    deleteCard,
    verifyChecksum,
  };
}

// =============================================================================
// DAILIES CLIPS
// =============================================================================

interface UseDailiesClipsOptions {
  cardId?: string | null;
  projectId?: string | null;
  dayId?: string | null;
  filters?: DailiesClipFilters;
  limit?: number;
}

export function useDailiesClips(options: UseDailiesClipsOptions) {
  const { cardId, projectId, dayId, filters = {}, limit = 200 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-clips', { cardId, projectId, dayId, filters, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!cardId && !projectId && !dayId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      let url: string;
      if (cardId) {
        url = `${API_BASE}/api/v1/backlot/dailies/cards/${cardId}/clips?limit=${limit}`;
      } else if (projectId) {
        // Build query params for project clips with filters
        const params = new URLSearchParams();
        params.append('limit', String(limit));
        if (filters.scene_number) params.append('scene_number', filters.scene_number);
        if (filters.take_number !== undefined) params.append('take_number', String(filters.take_number));
        if (filters.is_circle_take !== undefined) params.append('is_circle_take', String(filters.is_circle_take));
        if (filters.rating_min !== undefined) params.append('rating_min', String(filters.rating_min));
        if (filters.storage_mode) params.append('storage_mode', filters.storage_mode);
        if (filters.text_search) params.append('text_search', filters.text_search);
        url = `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/clips?${params.toString()}`;
      } else {
        // dayId only - use project clips endpoint and filter client-side
        // This case should have projectId passed, but handle gracefully
        return [];
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clips' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clips || []) as BacklotDailiesClip[];
    },
    enabled: !!cardId || !!projectId || !!dayId,
  });

  const createClip = useMutation({
    mutationFn: async ({
      cardId,
      projectId,
      ...input
    }: DailiesClipInput & { cardId: string; projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/cards/${cardId}/clips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create clip' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.clip as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateClip = useMutation({
    mutationFn: async ({ id, ...input }: DailiesClipUpdateInput & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/clips/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update clip' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.clip as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
    },
  });

  const deleteClip = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/clips/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete clip' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const toggleCircleTake = useMutation({
    mutationFn: async ({ id, isCircle }: { id: string; isCircle: boolean }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clips/${id}/circle?is_circle=${isCircle}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to toggle circle take' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.clip as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
    },
  });

  const setRating = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number | null }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const ratingParam = rating !== null ? `rating=${rating}` : '';
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clips/${id}/rating?${ratingParam}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to set rating' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.clip as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
    },
  });

  return {
    clips: data || [],
    isLoading,
    error,
    refetch,
    createClip,
    updateClip,
    deleteClip,
    toggleCircleTake,
    setRating,
  };
}

// Single clip fetch with full details
export function useDailiesClip(clipId: string | null) {
  return useQuery({
    queryKey: ['dailies-clip', clipId],
    queryFn: async () => {
      if (!clipId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/clips/${clipId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clip' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.clip as BacklotDailiesClip;
    },
    enabled: !!clipId,
  });
}

// =============================================================================
// DAILIES CLIP NOTES
// =============================================================================

interface UseDailiesClipNotesOptions {
  clipId: string | null;
  includeResolved?: boolean;
}

export function useDailiesClipNotes(options: UseDailiesClipNotesOptions) {
  const { clipId, includeResolved = true } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-clip-notes', { clipId, includeResolved }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clipId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clips/${clipId}/notes?include_resolved=${includeResolved}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch notes' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.notes || []) as BacklotDailiesClipNote[];
    },
    enabled: !!clipId,
  });

  const addNote = useMutation({
    mutationFn: async ({ clipId, ...input }: DailiesClipNoteInput & { clipId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/clips/${clipId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add note' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.note as BacklotDailiesClipNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<DailiesClipNoteInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/notes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update note' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.note as BacklotDailiesClipNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
    },
  });

  const resolveNote = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/notes/${id}/resolve?resolved=${resolved}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to resolve note' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.note as BacklotDailiesClipNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete note' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  return {
    notes: data || [],
    isLoading,
    error,
    refetch,
    addNote,
    updateNote,
    resolveNote,
    deleteNote,
  };
}

// =============================================================================
// PROJECT SUMMARY
// =============================================================================

export function useDailiesSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['dailies-summary', projectId],
    queryFn: async (): Promise<DailiesProjectSummary | null> => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch summary' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as DailiesProjectSummary;
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// LOCAL INGEST
// =============================================================================

export function useLocalIngest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DailiesLocalIngestRequest) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/dailies/local-ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to ingest dailies' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

// Get clips by scene for linking
export function useDailiesClipsByScene(projectId: string | null, sceneId: string | null) {
  return useQuery({
    queryKey: ['dailies-clips-by-scene', projectId, sceneId],
    queryFn: async () => {
      if (!projectId || !sceneId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/clips/by-scene/${sceneId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clips' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clips || []) as BacklotDailiesClip[];
    },
    enabled: !!projectId && !!sceneId,
  });
}

// Get circle takes for quick review
export function useDailiesCircleTakes(projectId: string | null, dayId?: string | null) {
  return useQuery({
    queryKey: ['dailies-circle-takes', projectId, dayId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      let url = `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/clips/circle-takes`;
      if (dayId) {
        url += `?day_id=${dayId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch circle takes' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clips || []) as BacklotDailiesClip[];
    },
    enabled: !!projectId,
  });
}
