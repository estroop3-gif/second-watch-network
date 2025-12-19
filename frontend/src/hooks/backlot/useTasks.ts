/**
 * useTasks - Hook for managing production tasks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotTask,
  ProductionTaskInput,
  TaskFilters,
  BacklotTaskStatus,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface UseTasksOptions extends TaskFilters {
  projectId: string | null;
  limit?: number;
}

export function useTasks(options: UseTasksOptions) {
  const {
    projectId,
    status = 'all',
    priority = 'all',
    assigned_to,
    department,
    production_day_id,
    limit = 100,
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ['backlot-tasks', { projectId, status, priority, assigned_to, department, production_day_id, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('limit', String(limit));
      params.append('parent_only', 'true');
      if (status !== 'all') params.append('status', status);
      if (priority !== 'all') params.append('priority', priority);
      if (assigned_to) params.append('assigned_to', assigned_to);
      if (department) params.append('department', department);
      if (production_day_id) params.append('production_day_id', production_day_id);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/simple-tasks?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch tasks' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.tasks || []) as BacklotTask[];
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async (input: ProductionTaskInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${input.projectId}/simple-tasks`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to create task' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.task || result) as BacklotTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProductionTaskInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/simple-tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update task' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.task || result) as BacklotTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BacklotTaskStatus }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/simple-tasks/${id}/status?status=${status}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update status' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.task || result) as BacklotTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/simple-tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete task' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const reorderTasks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!projectId) throw new Error('No project ID');

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/simple-tasks/reorder`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to reorder tasks' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  return {
    tasks: data || [],
    isLoading,
    error,
    refetch,
    createTask,
    updateTask,
    updateStatus,
    deleteTask,
    reorderTasks,
  };
}

// Fetch single task
export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['backlot-task', id],
    queryFn: async () => {
      if (!id) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/simple-tasks/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch task' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.task || result) as BacklotTask;
    },
    enabled: !!id,
  });
}

// Get task stats for a project
export function useTaskStats(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-task-stats', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      try {
        const response = await fetch(
          `${API_BASE}/api/v1/backlot/projects/${projectId}/simple-tasks/stats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          // Return empty stats on error
          console.warn('Could not fetch task stats');
          return {
            total: 0,
            todo: 0,
            in_progress: 0,
            review: 0,
            completed: 0,
            blocked: 0,
          };
        }

        return response.json();
      } catch (e) {
        // Return empty stats on any error
        return {
          total: 0,
          todo: 0,
          in_progress: 0,
          review: 0,
          completed: 0,
          blocked: 0,
        };
      }
    },
    enabled: !!projectId,
    // Retry less aggressively since this might be a schema issue
    retry: 1,
  });
}
