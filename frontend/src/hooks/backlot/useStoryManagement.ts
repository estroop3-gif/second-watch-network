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
  created_at: string;
  updated_at: string;
  character_arcs?: CharacterArc[];
}

export interface StoryCharacter {
  id: string;
  story_id: string;
  name: string;
  role?: string; // protagonist, antagonist, supporting, minor
  arc_summary?: string;
  notes?: string;
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
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch stories');
      const data = await response.json();
      return data.stories as Story[];
    },
    enabled: !!projectId,
  });
}

export function useStory(projectId: string | null, storyId: string | null) {
  return useQuery({
    queryKey: storyKeys.detail(projectId || '', storyId || ''),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch story');
      return response.json() as Promise<Story>;
    },
    enabled: !!projectId && !!storyId,
  });
}

export function useCreateStory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      logline?: string;
      genre?: string;
      tone?: string;
      themes?: string[];
      structure_type?: string;
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create story');
      return response.json() as Promise<Story>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.all(projectId) });
    },
  });
}

export function useUpdateStory(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title?: string;
      logline?: string;
      genre?: string;
      tone?: string;
      themes?: string[];
      structure_type?: string;
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update story');
      return response.json() as Promise<Story>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.all(projectId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useDeleteStory(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete story');
      return response.json();
    },
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
    mutationFn: async (data: {
      title: string;
      act_marker?: string;
      content?: string;
      notes?: string;
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create beat');
      return response.json() as Promise<StoryBeat>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useUpdateBeat(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ beatId, data }: {
      beatId: string;
      data: {
        title?: string;
        act_marker?: string;
        content?: string;
        notes?: string;
      };
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/${beatId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update beat');
      return response.json() as Promise<StoryBeat>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useDeleteBeat(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (beatId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/${beatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete beat');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useReorderBeats(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ beatId, direction }: { beatId: string; direction: 'UP' | 'DOWN' }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/beats/reorder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ beat_id: beatId, direction }),
      });
      if (!response.ok) throw new Error('Failed to reorder beat');
      return response.json();
    },
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
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch characters');
      const data = await response.json();
      return data.characters as StoryCharacter[];
    },
    enabled: !!projectId && !!storyId,
  });
}

export function useCreateCharacter(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      role?: string;
      arc_summary?: string;
      notes?: string;
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create character');
      return response.json() as Promise<StoryCharacter>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.characters(projectId, storyId) });
    },
  });
}

export function useUpdateCharacter(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ characterId, data }: {
      characterId: string;
      data: {
        name?: string;
        role?: string;
        arc_summary?: string;
        notes?: string;
      };
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update character');
      return response.json() as Promise<StoryCharacter>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
      queryClient.invalidateQueries({ queryKey: storyKeys.characters(projectId, storyId) });
    },
  });
}

export function useDeleteCharacter(projectId: string, storyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete character');
      return response.json();
    },
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
    mutationFn: async (data: {
      beat_id: string;
      description: string;
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/arcs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create character arc');
      return response.json() as Promise<CharacterArc>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useUpdateCharacterArc(projectId: string, storyId: string, characterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ arcId, data }: {
      arcId: string;
      data: { description?: string };
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/arcs/${arcId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update character arc');
      return response.json() as Promise<CharacterArc>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storyKeys.detail(projectId, storyId) });
    },
  });
}

export function useDeleteCharacterArc(projectId: string, storyId: string, characterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (arcId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/characters/${characterId}/arcs/${arcId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete character arc');
      return response.json();
    },
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
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/stories/${storyId}/print`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch story print data');
      return response.json() as Promise<StoryPrintData>;
    },
    enabled: !!projectId && !!storyId,
  });
}

export function getStoryExportUrl(projectId: string, storyId: string): string {
  const token = localStorage.getItem('access_token');
  return `/api/v1/backlot/projects/${projectId}/stories/${storyId}/export.csv?token=${token}`;
}
