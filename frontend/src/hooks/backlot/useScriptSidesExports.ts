/**
 * useScriptSidesExports - Hooks for PDF-based Script Sides (extracted from master script)
 * Uses the Continuity Export system filtered by export_type='sides'
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const API_BASE = '/api/v1';

// =============================================================================
// TYPES
// =============================================================================

export interface ScriptSidesExport {
  id: string;
  project_id: string;
  script_id?: string;
  file_url: string;
  file_name: string;
  file_size?: number;
  export_type: 'sides';
  content_type?: string;
  page_count?: number;
  version_number: number;
  version_label?: string;
  created_by?: string;
  created_at: string;
  is_current: boolean;
  signed_url?: string;
  // Script sides specific fields
  production_day_id?: string;
  call_sheet_id?: string;
  source_export_id?: string;
  extracted_scene_ids?: string[];
  status: 'draft' | 'published' | 'sent';
  // Nested data
  production_day?: {
    id: string;
    day_number: number;
    shoot_date: string;
    title?: string;
  };
  call_sheet?: {
    id: string;
    call_date?: string;
  };
  source_export?: {
    id: string;
    version_label?: string;
    version_number: number;
  };
  scene_mappings?: {
    scenes: Array<{
      scene_number: string;
      scene_id: string;
      page_number: number;
      bookmark_title: string;
      scroll_y?: number;
    }>;
  };
  created_by_profile?: {
    id: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface ScriptSidesListItem extends ScriptSidesExport {
  scene_count: number;
  is_outdated?: boolean;
}

export interface GenerateScriptSidesInput {
  production_day_id?: string;
  call_sheet_id?: string;
  scene_ids: string[];
  title?: string;
}

export interface OutdatedSidesInfo {
  export_id: string;
  production_day_id?: string;
  call_sheet_id?: string;
  extracted_scene_ids: string[];
  current_scene_ids: string[];
  missing_scenes: string[];
  extra_scenes: string[];
}

// =============================================================================
// QUERY KEYS
// =============================================================================

const scriptSidesExportKeys = {
  all: (projectId: string) => ['script-sides-exports', projectId] as const,
  detail: (projectId: string, exportId: string) => ['script-sides-export', projectId, exportId] as const,
  forDay: (projectId: string, dayId: string) => ['script-sides-for-day', projectId, dayId] as const,
  forCallSheet: (projectId: string, callSheetId: string) => ['script-sides-for-callsheet', projectId, callSheetId] as const,
  outdated: (projectId: string) => ['script-sides-outdated', projectId] as const,
};

// =============================================================================
// LIST & GET HOOKS
// =============================================================================

/**
 * List all script sides exports for a project (export_type='sides')
 */
export function useScriptSidesExports(projectId: string | null) {
  return useQuery({
    queryKey: scriptSidesExportKeys.all(projectId || ''),
    queryFn: async () => {
      if (!projectId) return [];
      const response = await api.get<{ exports: ScriptSidesListItem[] }>(
        `${API_BASE}/backlot/projects/${projectId}/script-sides`
      );
      return response.exports || [];
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single script sides export with signed URL
 */
export function useScriptSidesExport(projectId: string | null, exportId: string | null) {
  return useQuery({
    queryKey: scriptSidesExportKeys.detail(projectId || '', exportId || ''),
    queryFn: async () => {
      if (!projectId || !exportId) return null;
      const response = await api.get<ScriptSidesExport>(
        `${API_BASE}/backlot/projects/${projectId}/script-sides/${exportId}`
      );
      return response;
    },
    enabled: !!projectId && !!exportId,
  });
}

/**
 * Get script sides for a specific production day
 */
export function useScriptSidesForDay(projectId: string | null, dayId: string | null) {
  const query = useScriptSidesExports(projectId);

  const filteredData = query.data?.filter(side => side.production_day_id === dayId) || [];

  return {
    ...query,
    data: filteredData,
  };
}

/**
 * Get script sides for a specific call sheet
 */
export function useScriptSidesForCallSheet(projectId: string | null, callSheetId: string | null) {
  const query = useScriptSidesExports(projectId);

  const filteredData = query.data?.filter(side => side.call_sheet_id === callSheetId) || [];

  return {
    ...query,
    data: filteredData,
  };
}

// =============================================================================
// GENERATE & REGENERATE HOOKS
// =============================================================================

/**
 * Generate script sides by extracting pages from master script
 */
export function useGenerateScriptSides(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: GenerateScriptSidesInput) => {
      if (!projectId) throw new Error('Project ID required');

      const response = await api.post<ScriptSidesExport>(
        `${API_BASE}/backlot/projects/${projectId}/script-sides/generate`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.all(projectId || '') });
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.outdated(projectId || '') });
    },
  });
}

/**
 * Regenerate script sides with updated scenes
 */
export function useRegenerateScriptSides(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      exportId,
      sceneIds,
    }: {
      exportId: string;
      sceneIds?: string[];
    }) => {
      if (!projectId) throw new Error('Project ID required');

      const response = await api.post<ScriptSidesExport>(
        `${API_BASE}/backlot/projects/${projectId}/script-sides/${exportId}/regenerate`,
        sceneIds ? { scene_ids: sceneIds } : {}
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.all(projectId || '') });
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.detail(projectId || '', variables.exportId) });
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.outdated(projectId || '') });
    },
  });
}

// =============================================================================
// UPDATE & DELETE HOOKS
// =============================================================================

/**
 * Update script sides metadata (title, status)
 */
export function useUpdateScriptSidesExport(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      exportId,
      title,
      status,
    }: {
      exportId: string;
      title?: string;
      status?: 'draft' | 'published' | 'sent';
    }) => {
      if (!projectId) throw new Error('Project ID required');

      const response = await api.patch<ScriptSidesExport>(
        `${API_BASE}/backlot/projects/${projectId}/script-sides/${exportId}`,
        { title, status }
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.all(projectId || '') });
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.detail(projectId || '', variables.exportId) });
    },
  });
}

/**
 * Delete a script sides export
 */
export function useDeleteScriptSidesExport(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (exportId: string) => {
      if (!projectId) throw new Error('Project ID required');

      await api.delete(
        `${API_BASE}/backlot/projects/${projectId}/script-sides/${exportId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.all(projectId || '') });
      queryClient.invalidateQueries({ queryKey: scriptSidesExportKeys.outdated(projectId || '') });
    },
  });
}

// =============================================================================
// OUTDATED DETECTION HOOKS
// =============================================================================

/**
 * Check which script sides are outdated (scene changes)
 */
export function useCheckOutdatedSides(projectId: string | null) {
  return useQuery({
    queryKey: scriptSidesExportKeys.outdated(projectId || ''),
    queryFn: async () => {
      if (!projectId) return [];
      const response = await api.get<{ outdated: OutdatedSidesInfo[] }>(
        `${API_BASE}/backlot/projects/${projectId}/script-sides/check-outdated`
      );
      return response.outdated || [];
    },
    enabled: !!projectId,
    // Check for updates less frequently
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * Check if a specific sides export is outdated
 */
export function useIsSidesOutdated(projectId: string | null, exportId: string | null) {
  const { data: outdatedList } = useCheckOutdatedSides(projectId);

  if (!exportId || !outdatedList) return { isOutdated: false, info: null };

  const info = outdatedList.find(item => item.export_id === exportId);
  return { isOutdated: !!info, info: info || null };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get display name for a script sides export
 */
export function getSidesDisplayName(side: ScriptSidesListItem | ScriptSidesExport): string {
  if (side.version_label) return side.version_label;
  if (side.production_day?.title) return `Day ${side.production_day.day_number} - ${side.production_day.title}`;
  if (side.production_day?.day_number) return `Day ${side.production_day.day_number} Sides`;
  return side.file_name || 'Script Sides';
}

/**
 * Get status badge color for script sides
 */
export function getSidesStatusColor(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'sent':
      return 'bg-blue-100 text-blue-800';
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Format scene count for display
 */
export function formatSceneCount(count: number): string {
  return count === 1 ? '1 scene' : `${count} scenes`;
}
