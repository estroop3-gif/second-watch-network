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
    }) => {
      if (!projectId) throw new Error("No project selected");

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const urlParams = new URLSearchParams();
      if (params?.sceneId) urlParams.append("scene_id", params.sceneId);
      if (params?.typeFilter) urlParams.append("type_filter", params.typeFilter);
      if (params?.departmentFilter)
        urlParams.append("department_filter", params.departmentFilter);

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/script/breakdown/pdf${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to generate PDF");
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "breakdown.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=([^;]+)/);
        if (match) {
          filename = match[1].trim().replace(/"/g, "");
        }
      }

      // Download the PDF
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, filename };
    },
  });

  const exportSceneBreakdown = useMutation({
    mutationFn: async (sceneId: string) => {
      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/scenes/${sceneId}/breakdown/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to generate PDF");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "scene_breakdown.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=([^;]+)/);
        if (match) {
          filename = match[1].trim().replace(/"/g, "");
        }
      }

      // Download the PDF
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

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
