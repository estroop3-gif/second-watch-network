/**
 * useContinuityExports - Hooks for Continuity PDF Export Version History
 * Manages exported PDFs stored for the continuity workspace
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const API_BASE = '/api/v1';
const FETCH_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// TYPES
// =============================================================================

export interface ContinuityExportSceneMapping {
  scene_number: string;
  scene_id: string;
  page_number: number;
  bookmark_title: string;
  scroll_y?: number;  // Y position in PDF points for scroll-to-scene
}

export interface ContinuityExportSceneMappings {
  scenes: ContinuityExportSceneMapping[];
  addendums?: {
    notes?: { page_number: number; title: string };
    highlights?: { page_number: number; title: string };
  };
}

export interface ContinuityExport {
  id: string;
  project_id: string;
  script_id?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  export_type: string;
  content_type?: string;
  page_count?: number;
  version_number: number;
  version_label?: string;
  created_by?: string;
  created_at: string;
  is_current: boolean;
  signed_url?: string;
  scene_mappings?: ContinuityExportSceneMappings;
  created_by_profile?: {
    id: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface SaveContinuityExportInput {
  file: Blob;
  scriptId?: string;
  exportType?: string;
  contentType?: string;
  versionLabel?: string;
  sceneMappings?: ContinuityExportSceneMappings;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Fetch all continuity exports for a project (version history)
 */
export function useContinuityExports(projectId: string | null) {
  return useQuery({
    queryKey: ['continuity-exports', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await api.get<ContinuityExport[]>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports`
      );
      return response;
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch a single continuity export by ID
 */
export function useContinuityExport(projectId: string | null, exportId: string | null) {
  return useQuery({
    queryKey: ['continuity-export', projectId, exportId],
    queryFn: async () => {
      if (!projectId || !exportId) return null;
      const response = await api.get<ContinuityExport>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}`
      );
      return response;
    },
    enabled: !!projectId && !!exportId,
  });
}

/**
 * Save a new continuity export (upload PDF)
 */
export function useSaveContinuityExport(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveContinuityExportInput) => {
      if (!projectId) throw new Error('Project ID required');

      const formData = new FormData();
      formData.append('file', data.file, 'export.pdf');
      if (data.scriptId) formData.append('script_id', data.scriptId);
      if (data.exportType) formData.append('export_type', data.exportType);
      if (data.contentType) formData.append('content_type', data.contentType);
      if (data.versionLabel) formData.append('version_label', data.versionLabel);
      if (data.sceneMappings) formData.append('scene_mappings', JSON.stringify(data.sceneMappings));

      // Use fetch directly for FormData uploads (api.post uses JSON.stringify which breaks FormData)
      const token = api.getToken();
      const response = await fetch(`${FETCH_BASE}/api/v1/backlot/projects/${projectId}/continuity/exports`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          // Don't set Content-Type - browser will set it with boundary for multipart/form-data
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save export');
      }

      return response.json() as Promise<ContinuityExport>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity-exports', projectId] });
    },
  });
}

/**
 * Update a continuity export (label or set as current)
 */
export function useUpdateContinuityExport(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      exportId,
      versionLabel,
      isCurrent,
    }: {
      exportId: string;
      versionLabel?: string;
      isCurrent?: boolean;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      const response = await api.patch<ContinuityExport>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}`,
        {
          version_label: versionLabel,
          is_current: isCurrent,
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity-exports', projectId] });
    },
  });
}

/**
 * Delete a continuity export
 */
export function useDeleteContinuityExport(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (exportId: string) => {
      if (!projectId) throw new Error('Project ID required');

      const response = await api.delete(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuity-exports', projectId] });
    },
  });
}
