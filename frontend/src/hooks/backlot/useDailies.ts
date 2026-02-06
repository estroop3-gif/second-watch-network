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
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
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
      // Also invalidate coverage queries - circle takes indicate a shot was completed
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
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

// =============================================================================
// PROMOTE CLIP TO REVIEW
// =============================================================================

export interface PromoteToReviewInput {
  clipId: string;
  folderId?: string | null;
  name?: string | null;
  description?: string | null;
  copyNotes?: boolean;
}

export interface PromoteToReviewResult {
  success: boolean;
  asset_id: string;
  version_id: string;
  asset_name: string;
  copied_notes_count: number;
  message: string;
}

export function usePromoteToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clipId,
      folderId,
      name,
      description,
      copyNotes = true,
    }: PromoteToReviewInput): Promise<PromoteToReviewResult> => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clips/${clipId}/promote-to-review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            folder_id: folderId,
            name,
            description,
            copy_notes: copyNotes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to promote clip to review' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate both dailies and review queries
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['review-assets'] });
      queryClient.invalidateQueries({ queryKey: ['review-versions'] });
      queryClient.invalidateQueries({ queryKey: ['clip-asset-links'] });
    },
  });
}

// =============================================================================
// PRODUCTION DAY SYNC
// =============================================================================

interface UnlinkedProductionDay {
  id: string;
  day_number: number;
  date: string;
  title: string | null;
  location_name: string | null;
  is_completed: boolean;
  scene_count: number;
}

interface ImportProductionDaysResult {
  imported: BacklotDailiesDay[];
  assets_created: { id: string; title: string }[];
  skipped: number;
  message: string;
}

// Get production days that aren't linked to dailies yet
export function useUnlinkedProductionDays(projectId: string | null) {
  return useQuery({
    queryKey: ['unlinked-production-days', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/production-days/unlinked-to-dailies`,
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
      return (result.production_days || []) as UnlinkedProductionDay[];
    },
    enabled: !!projectId,
  });
}

// Import production days as dailies days
export function useImportProductionDays() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      productionDayIds,
      createFootageAssets = false,
    }: {
      projectId: string;
      productionDayIds: string[];
      createFootageAssets?: boolean;
    }): Promise<ImportProductionDaysResult> => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/import-from-schedule`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            production_day_ids: productionDayIds,
            create_footage_assets: createFootageAssets,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to import days' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-production-days'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

// Get the production day linked to a dailies day
export function useLinkedProductionDay(dayId: string | null) {
  return useQuery({
    queryKey: ['linked-production-day', dayId],
    queryFn: async () => {
      if (!dayId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/days/${dayId}/production-day`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch production day' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result as {
        production_day: import('@/types/backlot').BacklotProductionDay | null;
        scenes: { id: string; scene_number: string; slugline: string; page_length: number }[];
      };
    },
    enabled: !!dayId,
  });
}

// =============================================================================
// MEDIA LIBRARY - All clips with filtering, pagination, and sorting
// =============================================================================

export type MediaLibrarySortBy = 'created_at' | 'shoot_date' | 'scene_number' | 'take_number' | 'rating' | 'duration_seconds' | 'file_name';
export type MediaLibrarySortOrder = 'asc' | 'desc';

export interface MediaLibraryFilters {
  dayId?: string | null;
  camera?: string | null;
  sceneNumber?: string | null;
  takeNumber?: number | null;
  isCircleTake?: boolean | null;
  ratingMin?: number | null;
  storageMode?: DailiesStorageMode | null;
  hasNotes?: boolean | null;
  textSearch?: string | null;
  sortBy?: MediaLibrarySortBy;
  sortOrder?: MediaLibrarySortOrder;
}

export interface MediaLibraryClipWithContext extends BacklotDailiesClip {
  day?: {
    id: string;
    shoot_date: string;
    label: string;
    unit?: string | null;
    production_day_id?: string | null;
  };
}

export interface MediaLibraryResult {
  clips: MediaLibraryClipWithContext[];
  total: number;
  offset: number;
  limit: number;
}

export interface UseMediaLibraryOptions {
  projectId: string | null;
  filters?: MediaLibraryFilters;
  offset?: number;
  limit?: number;
  enabled?: boolean;
}

export function useMediaLibrary(options: UseMediaLibraryOptions) {
  const { projectId, filters = {}, offset = 0, limit = 50, enabled = true } = options;
  const queryClient = useQueryClient();

  const queryKey = ['media-library', { projectId, filters, offset, limit }];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: async (): Promise<MediaLibraryResult> => {
      if (!projectId) return { clips: [], total: 0, offset: 0, limit };

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Build query params
      const params = new URLSearchParams();
      if (filters.dayId) params.append('day_id', filters.dayId);
      if (filters.camera) params.append('camera', filters.camera);
      if (filters.sceneNumber) params.append('scene_number', filters.sceneNumber);
      if (filters.takeNumber !== null && filters.takeNumber !== undefined) {
        params.append('take_number', filters.takeNumber.toString());
      }
      if (filters.isCircleTake !== null && filters.isCircleTake !== undefined) {
        params.append('is_circle_take', filters.isCircleTake.toString());
      }
      if (filters.ratingMin !== null && filters.ratingMin !== undefined) {
        params.append('rating_min', filters.ratingMin.toString());
      }
      if (filters.storageMode) params.append('storage_mode', filters.storageMode);
      if (filters.hasNotes !== null && filters.hasNotes !== undefined) {
        params.append('has_notes', filters.hasNotes.toString());
      }
      if (filters.textSearch) params.append('text_search', filters.textSearch);
      if (filters.sortBy) params.append('sort_by', filters.sortBy);
      if (filters.sortOrder) params.append('sort_order', filters.sortOrder);
      params.append('offset', offset.toString());
      params.append('limit', limit.toString());

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/clips?${params.toString()}`,
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
      return {
        clips: (result.clips || []) as MediaLibraryClipWithContext[],
        total: result.total || 0,
        offset: result.offset || 0,
        limit: result.limit || limit,
      };
    },
    enabled: !!projectId && enabled,
  });

  // Toggle circle take with optimistic update
  const toggleCircleTake = useMutation({
    mutationFn: async ({ id, isCircle }: { id: string; isCircle: boolean }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/dailies/clips/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_circle_take: isCircle }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update clip');
      }

      return response.json();
    },
    onMutate: async ({ id, isCircle }) => {
      await queryClient.cancelQueries({ queryKey: ['media-library'] });

      const previousData = queryClient.getQueryData<MediaLibraryResult>(queryKey);

      if (previousData) {
        queryClient.setQueryData<MediaLibraryResult>(queryKey, {
          ...previousData,
          clips: previousData.clips.map((clip) =>
            clip.id === id ? { ...clip, is_circle_take: isCircle } : clip
          ),
        });
      }

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  return {
    clips: data?.clips || [],
    total: data?.total || 0,
    offset: data?.offset || 0,
    limit: data?.limit || limit,
    isLoading,
    isFetching,
    error,
    refetch,
    toggleCircleTake,
  };
}

// Get unique cameras for a project (for filtering)
export function useProjectCameras(projectId: string | null) {
  return useQuery({
    queryKey: ['project-cameras', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Get all cards to extract unique camera labels
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/cards?limit=500`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      const cards = result.cards || [];
      const cameras = [...new Set(cards.map((c: BacklotDailiesCard) => c.camera_label))].sort();
      return cameras as string[];
    },
    enabled: !!projectId,
  });
}

// Get unique scenes for a project (for filtering)
export function useProjectScenes(projectId: string | null) {
  return useQuery({
    queryKey: ['project-scenes-for-filter', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Get all clips to extract unique scene numbers
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/clips?limit=1000`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const result = await response.json();
      const clips = result.clips || [];
      const scenes = [...new Set(clips.map((c: BacklotDailiesClip) => c.scene_number).filter(Boolean))].sort();
      return scenes as string[];
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// PRODUCTION DAY VIEW (Auto-Import from Schedule)
// =============================================================================

/**
 * Unified production day view for Dailies tab.
 * Shows all production days from schedule with their dailies status.
 */
export interface DailiesProductionDayView {
  // Production day info
  production_day_id: string;
  day_number: number;
  date: string;
  title: string | null;
  location_name: string | null;
  is_completed: boolean;
  call_time: string | null;
  first_shot_time: string | null;
  wrap_time: string | null;
  scene_count: number;
  // Dailies day info (null if not created yet)
  dailies_day_id: string | null;
  dailies_day_label: string | null;
  dailies_day_unit: string | null;
  dailies_day_status: string | null;
  // Footage stats
  has_footage: boolean;
  card_count: number;
  clip_count: number;
  circle_take_count: number;
  total_duration_seconds: number;
}

/**
 * Hook to fetch all production days with their dailies status.
 * This is the unified view that shows all schedule days in the Dailies tab.
 */
export function useDailiesProductionDayView(projectId: string | null) {
  return useQuery({
    queryKey: ['dailies-production-day-view', projectId],
    queryFn: async (): Promise<DailiesProductionDayView[]> => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/production-day-view`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch production day view' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.production_days || [];
    },
    enabled: !!projectId,
  });
}

export interface EnsureDailiesDayResult {
  day: BacklotDailiesDay;
  created: boolean;
}

/**
 * Hook to ensure a dailies day exists for a production day.
 * Creates the dailies day on-demand if it doesn't exist.
 */
export function useEnsureDailiesDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      productionDayId,
    }: {
      projectId: string;
      productionDayId: string;
    }): Promise<EnsureDailiesDayResult> => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/ensure-day-for-production-day`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ production_day_id: productionDayId }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to ensure dailies day' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-production-day-view'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-production-days'] });
    },
  });
}

// =============================================================================
// PRODUCTION DAY CLIPS (Direct clip-to-day linking)
// =============================================================================

/**
 * Fetch clips assigned to a specific production day.
 */
export function useProductionDayClips(projectId: string | null, productionDayId: string | null) {
  return useQuery({
    queryKey: ['production-day-clips', projectId, productionDayId],
    queryFn: async () => {
      if (!projectId || !productionDayId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/production-days/${productionDayId}/clips`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch production day clips' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clips || []) as BacklotDailiesClip[];
    },
    enabled: !!projectId && !!productionDayId,
  });
}

/**
 * Mutation to assign clip IDs to a production day.
 */
export function useAssignClipsToDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      productionDayId,
      clipIds,
    }: {
      projectId: string;
      productionDayId: string;
      clipIds: string[];
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/production-days/${productionDayId}/assign-clips`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ clip_ids: clipIds }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to assign clips' }));
        throw new Error(error.detail);
      }

      return response.json() as Promise<{ updated_count: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-day-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-production-day-view'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
    },
  });
}

/**
 * Mutation to unassign clip IDs from a production day.
 */
export function useUnassignClipsFromDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      productionDayId,
      clipIds,
    }: {
      projectId: string;
      productionDayId: string;
      clipIds: string[];
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/dailies/production-days/${productionDayId}/unassign-clips`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ clip_ids: clipIds }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to unassign clips' }));
        throw new Error(error.detail);
      }

      return response.json() as Promise<{ updated_count: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-day-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-production-day-view'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
    },
  });
}
