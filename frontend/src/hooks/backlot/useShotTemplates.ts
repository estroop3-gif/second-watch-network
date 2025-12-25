/**
 * useShotTemplates - Hook for managing shot templates
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Template data structure matching backend
export interface ShotTemplateData {
  frame_size?: string;
  lens?: string;
  focal_length_mm?: number;
  camera_height?: string;
  movement?: string;
  location_hint?: string;
  time_of_day?: string;
  est_time_minutes?: number;
  technical_notes?: string;
  performance_notes?: string;
}

export interface ShotTemplate {
  id: string;
  user_id: string;
  project_id: string | null;
  name: string;
  description?: string;
  template_data: ShotTemplateData;
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface DefaultTemplate {
  name: string;
  description?: string;
  template_data: ShotTemplateData;
}

export interface ShotTemplatesResponse {
  personal: ShotTemplate[];
  project: ShotTemplate[];
  system: ShotTemplate[];
  defaults: DefaultTemplate[];
}

interface CreateTemplateInput {
  name: string;
  description?: string;
  project_id?: string;
  template_data: ShotTemplateData;
  is_default?: boolean;
}

interface UpdateTemplateInput {
  name?: string;
  description?: string;
  template_data?: ShotTemplateData;
  is_default?: boolean;
}

interface UseShotTemplatesOptions {
  projectId?: string | null;
}

export function useShotTemplates(options: UseShotTemplatesOptions = {}) {
  const { projectId } = options;
  const queryClient = useQueryClient();

  const queryKey = ['shot-templates', { projectId }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (projectId) params.append('project_id', projectId);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/shot-templates?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch templates' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.templates as ShotTemplatesResponse;
    },
    enabled: true,
  });

  const createTemplate = useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shot-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create template' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.template as ShotTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shot-templates'] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, ...input }: UpdateTemplateInput & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shot-templates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update template' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.template as ShotTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shot-templates'] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/shot-templates/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete template' }));
        throw new Error(error.detail);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shot-templates'] });
    },
  });

  // Helper to get all templates as a flat list
  const allTemplates = [
    ...(data?.personal || []),
    ...(data?.project || []),
    ...(data?.system || []),
  ];

  // Helper to get default templates
  const defaultTemplates = data?.defaults || [];

  return {
    templates: data,
    allTemplates,
    defaultTemplates,
    personalTemplates: data?.personal || [],
    projectTemplates: data?.project || [],
    systemTemplates: data?.system || [],
    isLoading,
    error,
    refetch,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}
