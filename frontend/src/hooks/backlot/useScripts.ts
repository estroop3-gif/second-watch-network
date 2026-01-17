/**
 * useScripts - Hooks for managing scripts, scenes, and breakdown items
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotScript,
  BacklotScene,
  BacklotBreakdownItem,
  BacklotBudgetSuggestion,
  BacklotCallSheetSceneLink,
  BacklotScriptPageNote,
  BacklotScriptVersionHistoryItem,
  BacklotScriptHighlightBreakdown,
  BacklotScenePageMapping,
  ScriptInput,
  SceneInput,
  BreakdownItemInput,
  CallSheetSceneLinkInput,
  ScriptPageNoteInput,
  ScriptPageNoteUpdateInput,
  ScriptVersionInput,
  ScriptHighlightInput,
  ScenePageMappingInput,
  ScriptHighlightSummary,
  BacklotSceneCoverageStatus,
  SceneCoverageStats,
  LocationNeedsResponse,
  TaskGenerationResponse,
  TaskPreviewResponse,
  CreateTasksFromPreviewInput,
  BudgetSuggestionGenerationResponse,
  SceneFilters,
  ScriptPageNoteFilters,
  ScriptPageNoteSummary,
  TitlePageData,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// SCRIPTS
// =============================================================================

interface UseScriptsOptions {
  projectId: string | null;
}

export function useScripts(options: UseScriptsOptions) {
  const { projectId } = options;
  const queryClient = useQueryClient();
  const queryKey = ['backlot-scripts', projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/scripts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch scripts');
      }

      const result = await response.json();
      return result.scripts as BacklotScript[];
    },
    enabled: !!projectId,
  });

  const createScript = useMutation({
    mutationFn: async (input: ScriptInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${input.projectId}/scripts`,
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
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create script');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
    },
  });

  return {
    scripts: data || [],
    isLoading,
    error,
    refetch,
    createScript,
  };
}

export function useScript(scriptId: string | null) {
  return useQuery({
    queryKey: ['backlot-script', scriptId],
    queryFn: async () => {
      if (!scriptId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch script');
      }

      return response.json() as Promise<BacklotScript>;
    },
    enabled: !!scriptId,
  });
}

export function useScriptMutations() {
  const queryClient = useQueryClient();

  const updateScript = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ScriptInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update script');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script'] });
    },
  });

  const deleteScript = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete script');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
    },
  });

  return {
    updateScript,
    deleteScript,
  };
}

// Import script from file (FDX or PDF)
export function useImportScript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      file,
      title,
      version,
    }: {
      projectId: string;
      file: File;
      title?: string;
      version?: string;
    }) => {
      // Get token from API module (works with Cognito)
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name.replace(/\.[^/.]+$/, ''));
      if (version) formData.append('version', version);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/scripts/import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to import script' }));
        throw new Error(error.detail || 'Failed to import script');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });
}

// =============================================================================
// SCENES
// =============================================================================

interface UseScenesOptions extends SceneFilters {
  projectId: string | null;
  scriptId?: string | null;
}

export function useScenes(options: UseScenesOptions) {
  const {
    projectId,
    scriptId,
    coverage_status = 'all',
    int_ext = 'all',
    location_id = 'all',
    has_breakdown,
    search,
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ['backlot-scenes', { projectId, scriptId, coverage_status, int_ext, location_id, has_breakdown, search }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (scriptId) params.append('script_id', scriptId);
      if (coverage_status !== 'all') params.append('coverage_status', coverage_status);
      if (int_ext !== 'all') params.append('int_ext', int_ext);
      if (location_id !== 'all') params.append('location_id', location_id);
      if (has_breakdown !== undefined) params.append('has_breakdown', String(has_breakdown));
      if (search) params.append('search', search);

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/scenes?${params}`;
      const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch scenes');
      }

      const result = await response.json();
      return result.scenes as BacklotScene[];
    },
    enabled: !!projectId,
  });

  const createScene = useMutation({
    mutationFn: async (input: SceneInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${input.projectId}/scenes`,
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
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create scene');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });

  return {
    scenes: data || [],
    isLoading,
    error,
    refetch,
    createScene,
  };
}

export function useScene(sceneId: string | null) {
  return useQuery({
    queryKey: ['backlot-scene', sceneId],
    queryFn: async () => {
      if (!sceneId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${sceneId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch scene');
      }

      return response.json() as Promise<BacklotScene>;
    },
    enabled: !!sceneId,
  });
}

export function useSceneMutations() {
  const queryClient = useQueryClient();

  const updateScene = useMutation({
    mutationFn: async ({ id, ...input }: Partial<SceneInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update scene');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });

  const updateCoverage = useMutation({
    mutationFn: async ({
      id,
      coverage_status,
      notes,
    }: {
      id: string;
      coverage_status: BacklotSceneCoverageStatus;
      notes?: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${id}/coverage`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ coverage_status, notes }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update coverage');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scene'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });

  const deleteScene = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete scene');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });

  const reorderScenes = useMutation({
    mutationFn: async ({
      projectId,
      sceneIds,
    }: {
      projectId: string;
      sceneIds: string[];
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/scenes/reorder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ scene_ids: sceneIds }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to reorder scenes');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
    },
  });

  return {
    updateScene,
    updateCoverage,
    deleteScene,
    reorderScenes,
  };
}

// =============================================================================
// BREAKDOWN ITEMS
// =============================================================================

export function useBreakdownItems(sceneId: string | null) {
  const queryKey = ['backlot-breakdown-items', sceneId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!sceneId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${sceneId}/breakdown`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch breakdown items');
      }

      const result = await response.json();
      return result.items as BacklotBreakdownItem[];
    },
    enabled: !!sceneId,
  });

  return {
    items: data || [],
    isLoading,
    error,
    refetch,
  };
}

export function useBreakdownItemMutations() {
  const queryClient = useQueryClient();

  const createItem = useMutation({
    mutationFn: async (input: BreakdownItemInput & { sceneId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const { sceneId, ...itemInput } = input;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${sceneId}/breakdown`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(itemInput),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create breakdown item');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-breakdown-items'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<BreakdownItemInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/breakdown-items/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update breakdown item');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-breakdown-items'] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/breakdown-items/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete breakdown item');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-breakdown-items'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
    },
  });

  return {
    createItem,
    updateItem,
    deleteItem,
  };
}

// =============================================================================
// COVERAGE & ANALYTICS
// =============================================================================

export function useCoverageStats(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-coverage', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/coverage`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch coverage stats');
      }

      return response.json() as Promise<SceneCoverageStats>;
    },
    enabled: !!projectId,
  });
}

export function useLocationNeeds(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-location-needs', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/location-needs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch location needs');
      }

      return response.json() as Promise<LocationNeedsResponse>;
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// TASK & BUDGET GENERATION
// =============================================================================

export function useGenerateTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      sceneIds,
      itemTypes,
    }: {
      projectId: string;
      sceneIds?: string[];
      itemTypes?: string[];
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/generate-tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ scene_ids: sceneIds, item_types: itemTypes }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate tasks');
      }

      return response.json() as Promise<TaskGenerationResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });
}

export function usePreviewGeneratedTasks() {
  return useMutation({
    mutationFn: async ({
      projectId,
      sceneIds,
      itemTypes,
      regenerate,
    }: {
      projectId: string;
      sceneIds?: string[];
      itemTypes?: string[];
      regenerate?: boolean;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/preview-tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            scene_ids: sceneIds,
            item_types: itemTypes,
            regenerate: regenerate || false,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to preview tasks');
      }

      return response.json() as Promise<TaskPreviewResponse>;
    },
  });
}

export function useCreateTasksFromPreview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      tasks,
    }: {
      projectId: string;
      tasks: CreateTasksFromPreviewInput['tasks'];
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/create-tasks-from-preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tasks }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create tasks');
      }

      return response.json() as Promise<TaskGenerationResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });
}

export function useGenerateBudgetSuggestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      scriptId,
    }: {
      projectId: string;
      scriptId?: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const body: Record<string, any> = {};
      if (scriptId) body.script_id = scriptId;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/generate-budget-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate budget suggestions');
      }

      return response.json() as Promise<BudgetSuggestionGenerationResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-suggestions'] });
    },
  });
}

export function useBudgetSuggestions(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-budget-suggestions', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/budget-suggestions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch budget suggestions');
      }

      const result = await response.json();
      return result.suggestions as BacklotBudgetSuggestion[];
    },
    enabled: !!projectId,
  });
}

export function useBudgetSuggestionMutations() {
  const queryClient = useQueryClient();

  const updateSuggestion = useMutation({
    mutationFn: async ({
      id,
      status,
      applied_line_item_id,
      notes,
    }: {
      id: string;
      status?: string;
      applied_line_item_id?: string;
      notes?: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const body: Record<string, any> = {};
      if (status) body.status = status;
      if (applied_line_item_id) body.applied_line_item_id = applied_line_item_id;
      if (notes !== undefined) body.notes = notes;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/budget-suggestions/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update budget suggestion');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-suggestions'] });
    },
  });

  return {
    updateSuggestion,
  };
}

// =============================================================================
// CALL SHEET SCENE LINKS
// =============================================================================

export function useCallSheetSceneLinks(callSheetId: string | null) {
  return useQuery({
    queryKey: ['backlot-call-sheet-scene-links', callSheetId],
    queryFn: async () => {
      if (!callSheetId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/linked-scenes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch scene links');
      }

      const result = await response.json();
      // Backend returns linked_scenes with `sequence` field, normalize to include sort_order
      const links = (result.linked_scenes || []).map((link: any) => ({
        ...link,
        sort_order: link.sequence ?? link.sort_order ?? 0,
      }));
      return links as BacklotCallSheetSceneLink[];
    },
    enabled: !!callSheetId,
  });
}

export function useCallSheetSceneLinkMutations() {
  const queryClient = useQueryClient();

  const linkScene = useMutation({
    mutationFn: async ({
      callSheetId,
      ...input
    }: CallSheetSceneLinkInput & { callSheetId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/call-sheets/${callSheetId}/linked-scenes`,
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
        const error = await response.json();
        throw new Error(error.detail || 'Failed to link scene');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-scene-links'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });

  const unlinkScene = useMutation({
    mutationFn: async (params: { callSheetId: string; sceneId: string } | { linkId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Support both deletion by linkId or by callSheetId/sceneId
      const url = 'linkId' in params
        ? `${API_BASE}/api/v1/backlot/call-sheet-scene-links/${params.linkId}`
        : `${API_BASE}/api/v1/backlot/call-sheets/${params.callSheetId}/linked-scenes/${params.sceneId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to unlink scene');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-call-sheet-scene-links'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });

  return {
    linkScene,
    unlinkScene,
  };
}

// =============================================================================
// SCRIPT PAGE NOTES
// =============================================================================

interface UseScriptPageNotesOptions extends ScriptPageNoteFilters {
  scriptId: string | null;
}

export function useScriptPageNotes(options: UseScriptPageNotesOptions) {
  const {
    scriptId,
    page_number,
    note_type = 'all',
    resolved,
    scene_id,
    author_user_id,
  } = options;

  const queryKey = ['backlot-script-page-notes', { scriptId, page_number, note_type, resolved, scene_id, author_user_id }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!scriptId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (page_number !== undefined) params.append('page_number', String(page_number));
      if (note_type !== 'all') params.append('note_type', note_type);
      if (resolved !== undefined) params.append('resolved', String(resolved));
      if (scene_id) params.append('scene_id', scene_id);
      if (author_user_id) params.append('author_user_id', author_user_id);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/notes?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch script page notes');
      }

      const result = await response.json();
      return result.notes as BacklotScriptPageNote[];
    },
    enabled: !!scriptId,
  });

  return {
    notes: data || [],
    isLoading,
    error,
    refetch,
  };
}

export function useScriptPageNotesSummary(scriptId: string | null) {
  return useQuery({
    queryKey: ['backlot-script-page-notes-summary', scriptId],
    queryFn: async () => {
      if (!scriptId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/notes/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch notes summary');
      }

      const result = await response.json();
      // Backend returns pages_with_notes, not summary
      return (result.pages_with_notes || result.summary || []) as ScriptPageNoteSummary[];
    },
    enabled: !!scriptId,
  });
}

export function useScriptPageNoteMutations() {
  const queryClient = useQueryClient();

  const createNote = useMutation({
    mutationFn: async (input: ScriptPageNoteInput & { scriptId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const { scriptId, ...noteInput } = input;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(noteInput),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create note');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes-summary'] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({
      scriptId,
      noteId,
      ...input
    }: ScriptPageNoteUpdateInput & { scriptId: string; noteId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/notes/${noteId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update note');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes-summary'] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async ({ scriptId, noteId }: { scriptId: string; noteId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/notes/${noteId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete note');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes-summary'] });
    },
  });

  const toggleResolved = useMutation({
    mutationFn: async ({
      scriptId,
      noteId,
      resolved,
    }: {
      scriptId: string;
      noteId: string;
      resolved: boolean;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/notes/${noteId}/resolve`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ resolved }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to toggle resolved status');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-page-notes-summary'] });
    },
  });

  return {
    createNote,
    updateNote,
    deleteNote,
    toggleResolved,
  };
}

// =============================================================================
// SCRIPT VERSIONING
// =============================================================================

/**
 * Get version history for a script
 */
export function useScriptVersionHistory(scriptId: string | null) {
  return useQuery({
    queryKey: ['backlot-script-versions', scriptId],
    queryFn: async () => {
      if (!scriptId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/versions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch version history');
      }

      const result = await response.json();
      return result.versions as BacklotScriptVersionHistoryItem[];
    },
    enabled: !!scriptId,
  });
}

/**
 * Create a new script version (revision)
 */
export function useCreateScriptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scriptId,
      ...input
    }: ScriptVersionInput & { scriptId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/versions`,
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
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create script version');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-versions'] });
    },
  });
}

/**
 * Lock/unlock a script version
 */
export function useLockScriptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scriptId,
      lock,
    }: {
      scriptId: string;
      lock: boolean;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Use the appropriate endpoint based on lock/unlock action
      const endpoint = lock ? 'lock' : 'unlock';

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/${endpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to toggle script lock');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-versions'] });
    },
  });
}

/**
 * Set a script version as current
 */
export function useSetCurrentScriptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scriptId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/set-current`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to set current version');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-versions'] });
    },
  });
}

/**
 * Update script text content (for the editor)
 */
export function useUpdateScriptText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scriptId,
      textContent,
      createNewVersion = false,
      versionLabel,
      colorCode,
      revisionNotes,
    }: {
      scriptId: string;
      textContent: string;
      createNewVersion?: boolean;
      versionLabel?: string;
      colorCode?: string;
      revisionNotes?: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/text`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            text_content: textContent,
            create_new_version: createNewVersion,
            version_label: versionLabel,
            color_code: colorCode,
            revision_notes: revisionNotes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update script text');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-versions'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlights'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-breakdown'] });
    },
  });
}

/**
 * Extract text from a script's PDF for editing
 * @param force - If true, forces re-extraction even if text already exists
 */
export function useExtractScriptText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scriptId, force = false }: { scriptId: string; force?: boolean }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Build URL with optional force parameter
      let url = `${API_BASE}/api/v1/backlot/scripts/${scriptId}/extract-text`;
      if (force) {
        url += '?force=true';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to extract text from script');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script'] });
    },
  });
}

// =============================================================================
// SCRIPT TITLE PAGE
// =============================================================================

/**
 * Get title page data for a script
 */
export function useScriptTitlePage(scriptId: string | null) {
  return useQuery({
    queryKey: ['backlot-script-title-page', scriptId],
    queryFn: async () => {
      if (!scriptId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/title-page`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch title page data');
      }

      const result = await response.json();
      return result.title_page_data as TitlePageData | null;
    },
    enabled: !!scriptId,
  });
}

/**
 * Update title page data for a script
 */
export function useUpdateScriptTitlePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      scriptId,
      titlePageData,
    }: {
      scriptId: string;
      titlePageData: TitlePageData;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/title-page`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(titlePageData),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update title page');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-title-page', variables.scriptId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script', variables.scriptId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
    },
  });
}

// =============================================================================
// SCRIPT HIGHLIGHT BREAKDOWNS
// =============================================================================

/**
 * Get highlights for a script
 */
export function useScriptHighlights(scriptId: string | null, pageNumber?: number) {
  const queryKey = ['backlot-script-highlights', scriptId, pageNumber];

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!scriptId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (pageNumber !== undefined) params.append('page_number', String(pageNumber));

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch highlights');
      }

      const result = await response.json();
      return result.highlights as BacklotScriptHighlightBreakdown[];
    },
    enabled: !!scriptId,
  });
}

/**
 * Get highlight summary by category
 */
export function useScriptHighlightSummary(scriptId: string | null) {
  return useQuery({
    queryKey: ['backlot-script-highlight-summary', scriptId],
    queryFn: async () => {
      if (!scriptId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch highlight summary');
      }

      const result = await response.json();
      return result.summary as ScriptHighlightSummary[];
    },
    enabled: !!scriptId,
  });
}

/**
 * Mutations for script highlights
 */
export function useScriptHighlightMutations() {
  const queryClient = useQueryClient();

  const createHighlight = useMutation({
    mutationFn: async (input: ScriptHighlightInput & { scriptId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const { scriptId, ...highlightInput } = input;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(highlightInput),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create highlight');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlights'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlight-summary'] });
      // Also invalidate breakdown items since highlights now auto-create breakdown items
      queryClient.invalidateQueries({ queryKey: ['backlot-project-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-breakdown-summary'] });
      // Invalidate scenes since highlights can auto-create scenes (e.g., PROLOGUE)
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-coverage'] });
    },
  });

  const confirmHighlight = useMutation({
    mutationFn: async ({
      scriptId,
      highlightId,
      label,
      sceneId,
    }: {
      scriptId: string;
      highlightId: string;
      label?: string;
      sceneId?: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const body: Record<string, any> = {};
      if (label) body.label = label;
      if (sceneId) body.scene_id = sceneId;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/${highlightId}/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to confirm highlight');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlights'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlight-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-breakdown-items'] });
    },
  });

  const rejectHighlight = useMutation({
    mutationFn: async ({
      scriptId,
      highlightId,
    }: {
      scriptId: string;
      highlightId: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/${highlightId}/reject`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to reject highlight');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlights'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlight-summary'] });
    },
  });

  const deleteHighlight = useMutation({
    mutationFn: async ({
      scriptId,
      highlightId,
    }: {
      scriptId: string;
      highlightId: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/${highlightId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete highlight');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlights'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlight-summary'] });
      // Also invalidate breakdown items since deleting a highlight also deletes its breakdown item
      queryClient.invalidateQueries({ queryKey: ['backlot-project-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-breakdown-summary'] });
    },
  });

  const updateHighlight = useMutation({
    mutationFn: async ({
      scriptId,
      highlightId,
      scene_id,
      category,
      suggested_label,
      status,
    }: {
      scriptId: string;
      highlightId: string;
      scene_id?: string;
      category?: string;
      suggested_label?: string;
      status?: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const body: Record<string, any> = {};
      if (scene_id !== undefined) body.scene_id = scene_id;
      if (category !== undefined) body.category = category;
      if (suggested_label !== undefined) body.suggested_label = suggested_label;
      if (status !== undefined) body.status = status;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/${highlightId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update highlight');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlights'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlight-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-breakdown-summary'] });
    },
  });

  const relocateHighlights = useMutation({
    mutationFn: async ({ scriptId }: { scriptId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/relocate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to relocate highlights');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlights'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-script-highlight-summary'] });
    },
  });

  return {
    createHighlight,
    confirmHighlight,
    rejectHighlight,
    deleteHighlight,
    updateHighlight,
    relocateHighlights,
  };
}

// =============================================================================
// HIGHLIGHT NOTES
// =============================================================================

export interface HighlightNote {
  id: string;
  highlight_id: string;
  author_user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

/**
 * Get notes for a highlight
 */
export function useHighlightNotes(scriptId: string | null, highlightId: string | null) {
  return useQuery({
    queryKey: ['backlot-highlight-notes', scriptId, highlightId],
    queryFn: async () => {
      if (!scriptId || !highlightId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/${highlightId}/notes`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch highlight notes');
      }

      return response.json() as Promise<HighlightNote[]>;
    },
    enabled: !!scriptId && !!highlightId,
  });
}

/**
 * Mutations for highlight notes
 */
export function useHighlightNoteMutations() {
  const queryClient = useQueryClient();

  const createNote = useMutation({
    mutationFn: async ({
      scriptId,
      highlightId,
      content,
    }: {
      scriptId: string;
      highlightId: string;
      content: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/${highlightId}/notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create note');
      }

      return response.json() as Promise<HighlightNote>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-highlight-notes', variables.scriptId, variables.highlightId] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async ({
      scriptId,
      highlightId,
      noteId,
    }: {
      scriptId: string;
      highlightId: string;
      noteId: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/highlights/${highlightId}/notes/${noteId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete note');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-highlight-notes', variables.scriptId, variables.highlightId] });
    },
  });

  return {
    createNote,
    deleteNote,
  };
}

// =============================================================================
// SCENE PAGE MAPPINGS
// =============================================================================

/**
 * Get scene-to-page mappings for a script
 */
export function useScenePageMappings(scriptId: string | null) {
  return useQuery({
    queryKey: ['backlot-scene-page-mappings', scriptId],
    queryFn: async () => {
      if (!scriptId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/page-mappings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch page mappings');
      }

      const result = await response.json();
      return result.mappings as BacklotScenePageMapping[];
    },
    enabled: !!scriptId,
  });
}

/**
 * Mutations for scene page mappings
 */
export function useScenePageMappingMutations() {
  const queryClient = useQueryClient();

  const createMapping = useMutation({
    mutationFn: async (input: ScenePageMappingInput & { scriptId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const { scriptId, ...mappingInput } = input;

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/page-mappings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(mappingInput),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create page mapping');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scene-page-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
    },
  });

  const updateMapping = useMutation({
    mutationFn: async ({
      scriptId,
      mappingId,
      ...input
    }: Partial<ScenePageMappingInput> & { scriptId: string; mappingId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/page-mappings/${mappingId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update page mapping');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scene-page-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
    },
  });

  const deleteMapping = useMutation({
    mutationFn: async ({
      scriptId,
      mappingId,
    }: {
      scriptId: string;
      mappingId: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/page-mappings/${mappingId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete page mapping');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scene-page-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-scenes'] });
    },
  });

  return {
    createMapping,
    updateMapping,
    deleteMapping,
  };
}

// =============================================================================
// SCRIPT PDF EXPORT WITH HIGHLIGHTS
// =============================================================================

/**
 * Hook for exporting script with highlights and notes addendum
 */
export function useExportScriptWithHighlights() {
  const exportScript = useMutation({
    mutationFn: async ({ scriptId }: { scriptId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scripts/${scriptId}/export-with-highlights`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to export script');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'script_with_highlights.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return { success: true, filename };
    },
  });

  return {
    exportScript,
    isExporting: exportScript.isPending,
  };
}
