/**
 * useUpdates - Hook for managing project updates/announcements
 * Enhanced with visible_to_roles filtering and read tracking
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BacklotProjectUpdate, ProjectUpdateInput, BacklotUpdateType } from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface UseUpdatesOptions {
  projectId: string | null;
  type?: BacklotUpdateType | 'all';
  publicOnly?: boolean;
  limit?: number;
}

// Extended update type with read status
export interface BacklotProjectUpdateWithRead extends BacklotProjectUpdate {
  visible_to_roles?: string[];
  has_read?: boolean;
}

export function useUpdates(options: UseUpdatesOptions) {
  const { projectId, type = 'all', publicOnly = false, limit = 50 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-updates', { projectId, type, publicOnly, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (type && type !== 'all') params.append('type', type);
      if (publicOnly) params.append('public_only', 'true');
      params.append('limit', String(limit));

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/updates?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch updates' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectUpdateWithRead[];
    },
    enabled: !!projectId,
  });

  const createUpdate = useMutation({
    mutationFn: async ({ projectId, ...input }: ProjectUpdateInput & { projectId: string; visible_to_roles?: string[] }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/updates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          type: input.type || 'general',
          is_public: input.is_public ?? false,
          attachments: input.attachments || [],
          visible_to_roles: input.visible_to_roles || [],
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create update' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectUpdate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (updateId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/updates/${updateId}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to mark as read' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const updateUpdate = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProjectUpdateInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/updates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          type: input.type,
          is_public: input.is_public,
          attachments: input.attachments,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectUpdate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const deleteUpdate = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/updates/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete update' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  const togglePublic = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/updates/${id}/public`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_public: isPublic }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to toggle public' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectUpdate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-updates'] });
    },
  });

  return {
    updates: data || [],
    isLoading,
    error,
    refetch,
    createUpdate,
    updateUpdate,
    deleteUpdate,
    togglePublic,
    markAsRead,
  };
}

// Fetch single update
export function useUpdate(id: string | null) {
  return useQuery({
    queryKey: ['backlot-update', id],
    queryFn: async () => {
      if (!id) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/updates/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch update' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectUpdate;
    },
    enabled: !!id,
  });
}

// Fetch public updates for a project (for public project page)
export function usePublicUpdates(projectId: string | null, limit: number = 10) {
  return useQuery({
    queryKey: ['backlot-public-updates', projectId, limit],
    queryFn: async () => {
      if (!projectId) return [];

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/updates/public?limit=${limit}`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch public updates' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectUpdate[];
    },
    enabled: !!projectId,
  });
}
