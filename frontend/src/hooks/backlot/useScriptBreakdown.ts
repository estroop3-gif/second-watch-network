/**
 * useScriptBreakdown - Hooks for managing project-level script breakdown
 * Provides data fetching and mutations for the Breakdown tab
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from '@/lib/api';
import {
  BacklotSceneBreakdownItem,
  BreakdownItemInput,
  ProjectBreakdownResponse,
  BreakdownSummaryStats,
  BacklotBreakdownItemType,
  BacklotBreakdownDepartment,
} from "@/types/backlot";

const API_BASE = import.meta.env.VITE_API_URL || "";

// =============================================================================
// PROJECT BREAKDOWN
// =============================================================================

interface UseProjectBreakdownOptions {
  projectId: string | null;
  sceneId?: string;
  typeFilter?: BacklotBreakdownItemType;
  departmentFilter?: BacklotBreakdownDepartment;
  stripboardDay?: number;
  enabled?: boolean;
}

export function useProjectBreakdown(options: UseProjectBreakdownOptions) {
  const {
    projectId,
    sceneId,
    typeFilter,
    departmentFilter,
    stripboardDay,
    enabled = true,
  } = options;
  const queryClient = useQueryClient();
  const queryKey = [
    "backlot-project-breakdown",
    projectId,
    sceneId,
    typeFilter,
    departmentFilter,
    stripboardDay,
  ];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const params = new URLSearchParams();
      if (sceneId) params.append("scene_id", sceneId);
      if (typeFilter) params.append("type_filter", typeFilter);
      if (departmentFilter) params.append("department_filter", departmentFilter);
      if (stripboardDay !== undefined)
        params.append("stripboard_day", String(stripboardDay));

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/script/breakdown${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch breakdown");
      }

      return (await response.json()) as ProjectBreakdownResponse;
    },
    enabled: !!projectId && enabled,
  });

  return {
    data,
    breakdownItems: data?.breakdown_items ?? [],
    scenes: data?.scenes ?? [],
    groupedByType: data?.grouped_by_type ?? {},
    groupedByDepartment: data?.grouped_by_department ?? {},
    groupedByScene: data?.grouped_by_scene ?? {},
    projectTitle: data?.project_title ?? "",
    isLoading,
    error,
    refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}

// =============================================================================
// BREAKDOWN SUMMARY
// =============================================================================

interface UseBreakdownSummaryOptions {
  projectId: string | null;
  enabled?: boolean;
}

export function useBreakdownSummary(options: UseBreakdownSummaryOptions) {
  const { projectId, enabled = true } = options;
  const queryKey = ["backlot-breakdown-summary", projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/breakdown/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch breakdown summary");
      }

      return (await response.json()) as BreakdownSummaryStats;
    },
    enabled: !!projectId && enabled,
  });

  return {
    data,
    totalItems: data?.total_items ?? 0,
    byType: data?.by_type ?? {},
    byDepartment: data?.by_department ?? {},
    scenesWithBreakdown: data?.scenes_with_breakdown ?? 0,
    totalScenes: data?.total_scenes ?? 0,
    isLoading,
    error,
    refetch,
  };
}

// =============================================================================
// SCENE BREAKDOWN (for a specific scene)
// =============================================================================

interface UseSceneBreakdownOptions {
  sceneId: string | null;
  enabled?: boolean;
}

export function useSceneBreakdown(options: UseSceneBreakdownOptions) {
  const { sceneId, enabled = true } = options;
  const queryClient = useQueryClient();
  const queryKey = ["backlot-scene-breakdown", sceneId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!sceneId) return null;

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

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
        throw new Error(error.detail || "Failed to fetch scene breakdown");
      }

      const result = await response.json();
      return {
        items: result.breakdown_items as BacklotSceneBreakdownItem[],
        grouped: result.grouped as Record<string, BacklotSceneBreakdownItem[]>,
      };
    },
    enabled: !!sceneId && enabled,
  });

  return {
    items: data?.items ?? [],
    grouped: data?.grouped ?? {},
    isLoading,
    error,
    refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}

// =============================================================================
// BREAKDOWN ITEM MUTATIONS
// =============================================================================

interface UseBreakdownMutationsOptions {
  projectId: string | null;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useBreakdownMutations(options: UseBreakdownMutationsOptions) {
  const { projectId, onSuccess, onError } = options;
  const queryClient = useQueryClient();

  const createItem = useMutation({
    mutationFn: async ({
      sceneId,
      input,
    }: {
      sceneId: string;
      input: BreakdownItemInput;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${sceneId}/breakdown`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create breakdown item");
      }

      const result = await response.json();
      return result.item as BacklotSceneBreakdownItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["backlot-project-breakdown", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["backlot-breakdown-summary", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["backlot-scene-breakdown"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      itemId,
      input,
    }: {
      itemId: string;
      input: BreakdownItemInput;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/breakdown-items/${itemId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update breakdown item");
      }

      const result = await response.json();
      return result.item as BacklotSceneBreakdownItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["backlot-project-breakdown", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["backlot-breakdown-summary", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["backlot-scene-breakdown"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/breakdown-items/${itemId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to delete breakdown item");
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["backlot-project-breakdown", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["backlot-breakdown-summary", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["backlot-scene-breakdown"] });
      // Also invalidate highlights since deleting a breakdown item also deletes its linked highlight
      queryClient.invalidateQueries({ queryKey: ["backlot-script-highlights"] });
      queryClient.invalidateQueries({ queryKey: ["backlot-script-highlight-summary"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  return {
    createItem,
    updateItem,
    deleteItem,
  };
}

// =============================================================================
// PDF EXPORT
// =============================================================================

/** Fetch with retry — handles Lambda cold start 503s that CORS-block the response */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2,
  delayMs = 1500,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);
      // 503 = Lambda cold start / timeout — retry
      if (response.status === 503 && attempt < maxRetries) {
        console.warn(`[Breakdown PDF] 503 on attempt ${attempt + 1}, retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return response;
    } catch (err) {
      // Network/CORS errors from 503 show up as TypeError — retry
      lastError = err as Error;
      if (attempt < maxRetries) {
        console.warn(`[Breakdown PDF] Network error on attempt ${attempt + 1}, retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError || new Error("Export failed after retries");
}

/** Parse an error response into a human-readable message */
async function parseErrorResponse(response: Response, prefix: string): never {
  let detail = `Export failed (${response.status})`;
  try {
    const error = await response.json();
    detail = error.detail || detail;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) detail = text.slice(0, 200);
  }
  console.error(`[Breakdown PDF] ${prefix}:`, detail);
  throw new Error(detail);
}

/** Trigger a browser file download from a Response */
function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

/** Extract filename from Content-Disposition header */
function getFilename(response: Response, fallback: string): string {
  const cd = response.headers.get("Content-Disposition");
  if (cd) {
    const match = cd.match(/filename=([^;]+)/);
    if (match) return match[1].trim().replace(/"/g, "");
  }
  return fallback;
}

interface UseBreakdownPdfExportOptions {
  projectId: string | null;
}

export function useBreakdownPdfExport(options: UseBreakdownPdfExportOptions) {
  const { projectId } = options;

  const exportProjectBreakdown = useMutation({
    mutationFn: async (params?: {
      sceneId?: string;
      typeFilter?: BacklotBreakdownItemType;
      departmentFilter?: BacklotBreakdownDepartment;
      includeNotes?: boolean;
    }) => {
      if (!projectId) throw new Error("No project selected");

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const urlParams = new URLSearchParams();
      if (params?.sceneId) urlParams.append("scene_id", params.sceneId);
      if (params?.typeFilter) urlParams.append("type_filter", params.typeFilter);
      if (params?.departmentFilter)
        urlParams.append("department_filter", params.departmentFilter);
      if (params?.includeNotes !== undefined)
        urlParams.append("include_notes", String(params.includeNotes));

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/script/breakdown/pdf${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;

      const response = await fetchWithRetry(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) await parseErrorResponse(response, "Export error");

      const filename = getFilename(response, "breakdown.pdf");
      const blob = await response.blob();
      downloadBlob(blob, filename);

      return { success: true, filename };
    },
  });

  const exportSceneBreakdown = useMutation({
    mutationFn: async (sceneId: string) => {
      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const url = `${API_BASE}/api/v1/backlot/scenes/${sceneId}/breakdown/pdf`;

      const response = await fetchWithRetry(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) await parseErrorResponse(response, "Scene export error");

      const filename = getFilename(response, "scene_breakdown.pdf");
      const blob = await response.blob();
      downloadBlob(blob, filename);

      return { success: true, filename };
    },
  });

  return {
    exportProjectBreakdown,
    exportSceneBreakdown,
    isExporting:
      exportProjectBreakdown.isPending || exportSceneBreakdown.isPending,
  };
}
