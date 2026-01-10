/**
 * useMoodboard - Hook for Moodboard management
 * Visual reference tool for look/feel, tone, wardrobe, locations, lighting
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Types
export interface MoodboardItem {
  id: string;
  project_id: string;
  moodboard_id: string;
  section_id: string | null;
  sort_order: number;
  image_url: string;
  source_url: string | null;
  title: string | null;
  notes: string | null;
  tags: string[];
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface MoodboardSection {
  id: string;
  moodboard_id: string;
  title: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  items?: MoodboardItem[];
}

export interface Moodboard {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  section_count?: number;
  item_count?: number;
  sections?: MoodboardSection[];
  unsorted_items?: MoodboardItem[];
  all_tags?: string[];
}

export interface MoodboardPrintData {
  project_title: string;
  moodboard: Moodboard;
  sections: (MoodboardSection & { items: MoodboardItem[] })[];
  unsorted_items: MoodboardItem[];
  generated_at: string;
}

// Query key factory
const moodboardKeys = {
  all: ['moodboard'] as const,
  list: (projectId: string) => [...moodboardKeys.all, 'list', projectId] as const,
  detail: (projectId: string, moodboardId: string) =>
    [...moodboardKeys.all, 'detail', projectId, moodboardId] as const,
  print: (projectId: string, moodboardId: string) =>
    [...moodboardKeys.all, 'print', projectId, moodboardId] as const,
};

/**
 * Fetch all moodboards for a project
 */
export function useMoodboards(projectId: string | null) {
  return useQuery({
    queryKey: moodboardKeys.list(projectId || ''),
    queryFn: async (): Promise<Moodboard[]> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(`/api/v1/backlot/projects/${projectId}/moodboards`);
      return response.moodboards;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

/**
 * Fetch a single moodboard with sections and items
 */
export function useMoodboard(projectId: string | null, moodboardId: string | null) {
  return useQuery({
    queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
    queryFn: async (): Promise<Moodboard> => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}`);
    },
    enabled: !!projectId && !!moodboardId,
    staleTime: 30000,
  });
}

/**
 * Create a new moodboard
 */
export function useCreateMoodboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/moodboards`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moodboardKeys.list(projectId || '') });
    },
  });
}

/**
 * Update a moodboard
 */
export function useUpdateMoodboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      moodboardId,
      data,
    }: {
      moodboardId: string;
      data: Partial<{
        title: string;
        description: string;
      }>;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}`,
        data
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: moodboardKeys.list(projectId || '') });
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', variables.moodboardId),
      });
    },
  });
}

/**
 * Delete a moodboard
 */
export function useDeleteMoodboard(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (moodboardId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moodboardKeys.list(projectId || '') });
    },
  });
}

/**
 * Create a section
 */
export function useCreateSection(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string }) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/sections`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Update a section
 */
export function useUpdateSection(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sectionId,
      data,
    }: {
      sectionId: string;
      data: { title?: string };
    }) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.put(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/sections/${sectionId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Delete a section
 */
export function useDeleteSection(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sectionId: string) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.delete(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/sections/${sectionId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Reorder sections
 */
export function useReorderSections(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { section_id: string; direction: 'UP' | 'DOWN' }) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/sections/reorder`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Create an item
 */
export function useCreateItem(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      section_id?: string | null;
      image_url: string;
      source_url?: string;
      title?: string;
      notes?: string;
      tags?: string[];
    }) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/items`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Update an item
 */
export function useUpdateItem(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      data,
    }: {
      itemId: string;
      data: Partial<{
        section_id: string | null;
        image_url: string;
        source_url: string;
        title: string;
        notes: string;
        tags: string[];
      }>;
    }) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.put(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/items/${itemId}`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Delete an item
 */
export function useDeleteItem(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.delete(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/items/${itemId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Reorder items
 */
export function useReorderItems(projectId: string | null, moodboardId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { item_id: string; direction: 'UP' | 'DOWN' }) => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.post(
        `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/items/reorder`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: moodboardKeys.detail(projectId || '', moodboardId || ''),
      });
    },
  });
}

/**
 * Get print data for a moodboard
 */
export function useMoodboardPrintData(projectId: string | null, moodboardId: string | null) {
  return useQuery({
    queryKey: moodboardKeys.print(projectId || '', moodboardId || ''),
    queryFn: async (): Promise<MoodboardPrintData> => {
      if (!projectId || !moodboardId) throw new Error('Project ID and Moodboard ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/print`);
    },
    enabled: !!projectId && !!moodboardId,
    staleTime: 30000,
  });
}

/**
 * Get CSV export URL for a moodboard
 */
export function getMoodboardExportUrl(projectId: string, moodboardId: string): string {
  return `/api/v1/backlot/projects/${projectId}/moodboards/${moodboardId}/export.csv`;
}
