/**
 * Story Management Hooks
 * React Query hooks for stories, beats, characters, and character arcs
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =====================================================
// Types
// =====================================================

export interface Story {
  id: string;
  project_id: string;
  title: string;
  logline?: string;
  genre?: string;
  tone?: string;
  themes?: string[];
  structure_type?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  beat_count?: number;
  character_count?: number;
  beats?: StoryBeat[];
  characters?: StoryCharacter[];
}

export interface StoryBeat {
  id: string;
  story_id: string;
  sort_order: number;
  act_marker?: string;
  title: string;
  content?: string;
  notes?: string;
  page_start?: number;
  page_end?: number;
  emotional_tone?: string;
  primary_character_id?: string;
  primary_character?: StoryCharacter;
  created_at: string;
  updated_at: string;
  character_arcs?: CharacterArc[];
}

export interface BeatTemplate {
  id: string;
  name: string;
  beat_count: number;
  description: string;
}

export interface StoryCharacter {
  id: string;
  story_id: string;
  name: string;
  role?: string; // protagonist, antagonist, supporting, minor
  arc_summary?: string;
  notes?: string;
  contact_id?: string;
  contact?: {
    id: string;
    name: string;
    email?: string;
  };
  created_at: string;
  updated_at: string;
  arcs?: CharacterArc[];
}

export interface CharacterArc {
  id: string;
  character_id: string;
  beat_id: string;
  description: string;
  created_at: string;
  updated_at: string;
  character_name?: string;
}

export interface StoryPrintData {
  project_title: string;
  story: Story;
  beats: StoryBeat[];
  characters: StoryCharacter[];
  generated_at: string;
}

// =====================================================
// Query Keys
// =====================================================

const storyKeys = {
  all: (projectId: string) => ['stories', projectId] as const,
  detail: (projectId: string, storyId: string) => ['stories', projectId, storyId] as const,
  print: (projectId: string, storyId: string) => ['stories', projectId, storyId, 'print'] as const,
  characters: (projectId: string, storyId: string) => ['stories', projectId, storyId, 'characters'] as const,
};

// =====================================================
// Story Hooks
// =====================================================

export function useStories(projectId: string | null) {
  return useQuery({
    queryKey: storyKeys.all(projectId || ''),
    queryFn: async () => {
      const data = await api.get<{ stories: Story[] }>(`/api/v1/backlot/projects/${projectId}/stories`);
      return data.stories;
    },
    enabled: !!projectId,
  });
}

export function useStory(projectId: string | null, storyId: string | null) {
  return useQuery({
    queryKey: storyKeys.detail(projectId || '', storyId || ''),
    queryFn: () => api.get<Story>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}`),
    enabled: !!projectId && !!storyId,
  });
}

export function useCreateStory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      logline?: string;
      genre?: string;
      tone?: string;
      themes?: string[];
      structure_type?: string;
    }) => api.post<Story>(`/api/v1/backlot/projects/${projectId}/stories`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.all(projectId) });
    },
  });
}

export function useUpdateStory(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title?: string;
      logline?: string;
      genre?: string;
      tone?: string;
      themes?: string[];
      structure_type?: string;
    }) => api.put<Story>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useDeleteStory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (storyId: string) => api.delete(`/api/v1/backlot/projects/${projectId}/stories/${storyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.all(projectId) });
    },
  });
}

// =====================================================
// Beat Hooks
// =====================================================

export function useCreateBeat(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      act_marker?: string;
      content?: string;
      notes?: string;
      page_start?: number;
      page_end?: number;
      emotional_tone?: string;
      primary_character_id?: string;
    }) => api.post<StoryBeat>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useUpdateBeat(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ beatId, data }: {
      beatId: string;
      data: {
        title?: string;
        act_marker?: string;
        content?: string;
        notes?: string;
        page_start?: number;
        page_end?: number;
        emotional_tone?: string;
        primary_character_id?: string;
      };
    }) => api.put<StoryBeat>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/${beatId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useDeleteBeat(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (beatId: string) => api.delete(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/${beatId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useReorderBeats(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ beatId, direction }: { beatId: string; direction: 'UP' | 'DOWN' }) =>
      api.post(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/reorder`, { beat_id: beatId, direction }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

// =====================================================
// Character Hooks
// =====================================================

export function useCharacters(projectId: string | null, storyId: string | null) {
  return useQuery({
    queryKey: storyKeys.characters(projectId || '', storyId || ''),
    queryFn: async () => {
      const data = await api.get<{ characters: StoryCharacter[] }>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters`);
      return data.characters;
    },
    enabled: !!projectId && !!storyId,
  });
}

export function useCreateCharacter(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      role?: string;
      arc_summary?: string;
      notes?: string;
      contact_id?: string;
    }) => api.post<StoryCharacter>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.characters(projectId, storyId) });
    },
  });
}

export function useCreateCharacterFromContact(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      contact_id: string;
      role?: string;
      arc_summary?: string;
      notes?: string;
    }) => api.post<StoryCharacter>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/from-contact`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.characters(projectId, storyId) });
    },
  });
}

export function useUpdateCharacter(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, data }: {
      characterId: string;
      data: {
        name?: string;
        role?: string;
        arc_summary?: string;
        notes?: string;
        contact_id?: string | null;
      };
    }) => api.put<StoryCharacter>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.characters(projectId, storyId) });
    },
  });
}

export function useDeleteCharacter(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (characterId: string) => api.delete(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.characters(projectId, storyId) });
    },
  });
}

// =====================================================
// Character Arc Hooks
// =====================================================

export function useCreateCharacterArc(projectId: string, storyId: string, characterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      beat_id: string;
      description: string;
    }) => api.post<CharacterArc>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/arcs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useUpdateCharacterArc(projectId: string, storyId: string, characterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ arcId, data }: {
      arcId: string;
      data: { description?: string };
    }) => api.put<CharacterArc>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/arcs/${arcId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useDeleteCharacterArc(projectId: string, storyId: string, characterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (arcId: string) => api.delete(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/arcs/${arcId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

// =====================================================
// Print & Export Hooks
// =====================================================

export function useStoryPrintData(projectId: string | null, storyId: string | null) {
  return useQuery({
    queryKey: storyKeys.print(projectId || '', storyId || ''),
    queryFn: () => api.get<StoryPrintData>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/print`),
    enabled: !!projectId && !!storyId,
  });
}

export function getStoryExportUrl(projectId: string, storyId: string): string {
  const token = localStorage.getItem('access_token');
  return `/api/v1/backlot/projects/${projectId}/stories/${storyId}/export.csv?token=${token}`;
}

// =====================================================
// Connection Types
// =====================================================

export interface BeatSceneLink {
  id: string;
  beat_id: string;
  scene_id: string;
  relationship: 'features' | 'setup' | 'payoff' | 'reference';
  notes?: string;
  created_at: string;
  scene?: {
    id: string;
    scene_number: string;
    int_ext?: string;
    location?: string;
    time_of_day?: string;
    synopsis?: string;
  };
}

export interface StoryEpisodeLink {
  id: string;
  story_id: string;
  episode_id: string;
  relationship: 'primary' | 'subplot' | 'arc';
  notes?: string;
  created_at: string;
  episode?: {
    id: string;
    episode_number: number;
    episode_code: string;
    title: string;
    logline?: string;
  };
}

export interface CharacterCastLink {
  id: string;
  character_id: string;
  role_id: string;
  notes?: string;
  created_at: string;
  role?: {
    id: string;
    name: string;
    description?: string;
    cast_member_id?: string;
  };
  cast_member?: {
    id: string;
    user_id?: string;
    role?: string;
  };
}

// =====================================================
// Connection Query Keys
// =====================================================

const connectionKeys = {
  beatScenes: (projectId: string, storyId: string, beatId: string) =>
    ['story-beat-scenes', projectId, storyId, beatId] as const,
  storyEpisodes: (projectId: string, storyId: string) =>
    ['story-episodes', projectId, storyId] as const,
  characterCast: (projectId: string, storyId: string, characterId: string) =>
    ['story-character-cast', projectId, storyId, characterId] as const,
};

// =====================================================
// Beat-Scene Connection Hooks
// =====================================================

export function useBeatSceneLinks(projectId: string | null, storyId: string | null, beatId: string | null) {
  return useQuery({
    queryKey: connectionKeys.beatScenes(projectId || '', storyId || '', beatId || ''),
    queryFn: async () => {
      const data = await api.get<{ links: BeatSceneLink[] }>(
        `/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/${beatId}/scenes`
      );
      return data.links;
    },
    enabled: !!projectId && !!storyId && !!beatId,
  });
}

export function useLinkBeatToScene(projectId: string, storyId: string, beatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      scene_id: string;
      relationship?: 'features' | 'setup' | 'payoff' | 'reference';
      notes?: string;
    }) => api.post<BeatSceneLink>(
      `/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/${beatId}/scenes`, data
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionKeys.beatScenes(projectId, storyId, beatId) });
    },
  });
}

export function useUnlinkBeatFromScene(projectId: string, storyId: string, beatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => api.delete(
      `/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/${beatId}/scenes/${linkId}`
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionKeys.beatScenes(projectId, storyId, beatId) });
    },
  });
}

// =====================================================
// Story-Episode Connection Hooks
// =====================================================

export function useStoryEpisodeLinks(projectId: string | null, storyId: string | null) {
  return useQuery({
    queryKey: connectionKeys.storyEpisodes(projectId || '', storyId || ''),
    queryFn: async () => {
      const data = await api.get<{ links: StoryEpisodeLink[] }>(
        `/api/v1/backlot/projects/${projectId}/stories/${storyId}/episodes`
      );
      return data.links;
    },
    enabled: !!projectId && !!storyId,
  });
}

export function useLinkStoryToEpisode(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      episode_id: string;
      relationship?: 'primary' | 'subplot' | 'arc';
      notes?: string;
    }) => api.post<StoryEpisodeLink>(
      `/api/v1/backlot/projects/${projectId}/stories/${storyId}/episodes`, data
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionKeys.storyEpisodes(projectId, storyId) });
    },
  });
}

export function useUnlinkStoryFromEpisode(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => api.delete(
      `/api/v1/backlot/projects/${projectId}/stories/${storyId}/episodes/${linkId}`
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionKeys.storyEpisodes(projectId, storyId) });
    },
  });
}

// =====================================================
// Character-Cast Connection Hooks
// =====================================================

export function useCharacterCastLinks(projectId: string | null, storyId: string | null, characterId: string | null) {
  return useQuery({
    queryKey: connectionKeys.characterCast(projectId || '', storyId || '', characterId || ''),
    queryFn: async () => {
      const data = await api.get<{ links: CharacterCastLink[] }>(
        `/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/cast`
      );
      return data.links;
    },
    enabled: !!projectId && !!storyId && !!characterId,
  });
}

export function useLinkCharacterToCast(projectId: string, storyId: string, characterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      role_id: string;
      notes?: string;
    }) => api.post<CharacterCastLink>(
      `/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/cast`, data
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionKeys.characterCast(projectId, storyId, characterId) });
    },
  });
}

export function useUnlinkCharacterFromCast(projectId: string, storyId: string, characterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (linkId: string) => api.delete(
      `/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/cast/${linkId}`
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionKeys.characterCast(projectId, storyId, characterId) });
    },
  });
}

// =====================================================
// Beat Sheet Template Hooks
// =====================================================

export function useBeatTemplates(projectId: string, storyId: string | null) {
  return useQuery({
    queryKey: ['beat-templates', projectId, storyId],
    queryFn: async () => {
      const data = await api.get<{ templates: BeatTemplate[] }>(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/templates`);
      return data.templates;
    },
    enabled: !!projectId && !!storyId,
  });
}

export function useApplyTemplate(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ template }: { template: string }) =>
      api.post(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/apply-template`, { template }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

// =====================================================
// PDF Export
// =====================================================

export function getBeatSheetPdfUrl(projectId: string, storyId: string): string {
  const token = localStorage.getItem('access_token');
  return `/api/v1/backlot/projects/${projectId}/stories/${storyId}/export.pdf?token=${token}`;
}
