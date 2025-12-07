/**
 * useScripts - Hooks for managing scripts, scenes, and breakdown items
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotScript,
  BacklotScene,
  BacklotBreakdownItem,
  BacklotBudgetSuggestion,
  BacklotCallSheetSceneLink,
  ScriptInput,
  SceneInput,
  BreakdownItemInput,
  CallSheetSceneLinkInput,
  BacklotSceneCoverageStatus,
  SceneCoverageStats,
  LocationNeedsResponse,
  TaskGenerationResponse,
  BudgetSuggestionGenerationResponse,
  SceneFilters,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/scripts`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${input.projectId}/scripts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scripts/${scriptId}`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scripts/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scripts/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (version) formData.append('version', version);

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/scripts/import`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to import script');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-scripts'] });
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (scriptId) params.append('script_id', scriptId);
      if (coverage_status !== 'all') params.append('coverage_status', coverage_status);
      if (int_ext !== 'all') params.append('int_ext', int_ext);
      if (location_id !== 'all') params.append('location_id', location_id);
      if (has_breakdown !== undefined) params.append('has_breakdown', String(has_breakdown));
      if (search) params.append('search', search);

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/scenes?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${input.projectId}/scenes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scenes/${sceneId}`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scenes/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scenes/${id}/coverage`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scenes/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/scenes/reorder`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/scenes/${sceneId}/breakdown`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const { sceneId, ...itemInput } = input;

      const response = await fetch(
        `${API_BASE}/api/backlot/scenes/${sceneId}/breakdown`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/breakdown-items/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/breakdown-items/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/script/coverage`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/script/location-needs`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/script/generate-tasks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const body: Record<string, any> = {};
      if (scriptId) body.script_id = scriptId;

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/script/generate-budget-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/projects/${projectId}/budget-suggestions`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const body: Record<string, any> = {};
      if (status) body.status = status;
      if (applied_line_item_id) body.applied_line_item_id = applied_line_item_id;
      if (notes !== undefined) body.notes = notes;

      const response = await fetch(
        `${API_BASE}/api/backlot/budget-suggestions/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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

      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/call-sheets/${callSheetId}/linked-scenes`,
        {
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch scene links');
      }

      const result = await response.json();
      return result.links as BacklotCallSheetSceneLink[];
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/call-sheets/${callSheetId}/linked-scenes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session.access_token}`,
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
    mutationFn: async ({
      callSheetId,
      sceneId,
    }: {
      callSheetId: string;
      sceneId: string;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/backlot/call-sheets/${callSheetId}/linked-scenes/${sceneId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.session.access_token}`,
          },
        }
      );

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
