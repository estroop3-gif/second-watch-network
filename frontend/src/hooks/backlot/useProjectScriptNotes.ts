/**
 * useProjectScriptNotes - Hooks for managing project-level script notes
 * Provides data fetching for the Notes tab with filtering, grouping, and PDF export
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from '@/lib/api';
import {
  BacklotScriptPageNote,
  BacklotScriptPageNoteType,
  BacklotScript,
  BacklotScene,
  BacklotProfile,
} from "@/types/backlot";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// =============================================================================
// TYPES
// =============================================================================

export type NotesGroupBy = "page" | "scene" | "type" | "author";

export interface ProjectNotesFilters {
  scriptId?: string;
  pageNumber?: number;
  noteType?: BacklotScriptPageNoteType | "all";
  resolved?: boolean;
  sceneId?: string;
  authorUserId?: string;
  groupBy?: NotesGroupBy;
}

export interface ProjectNotesResponse {
  notes: BacklotScriptPageNote[];
  grouped: Record<string, BacklotScriptPageNote[]> | null;
  scripts: BacklotScript[];
  scenes: BacklotScene[];
  authors: BacklotProfile[];
  project_title: string;
  total_count: number;
  unresolved_count: number;
}

export interface ProjectNotesSummary {
  total_notes: number;
  unresolved_count: number;
  resolved_count: number;
  by_type: Record<string, { total: number; unresolved: number }>;
  by_page: Array<{
    page_number: number;
    total_count: number;
    unresolved_count: number;
    note_types: BacklotScriptPageNoteType[];
  }>;
  pages_with_notes: number;
  unique_authors: number;
}

// =============================================================================
// PROJECT SCRIPT NOTES
// =============================================================================

interface UseProjectScriptNotesOptions extends ProjectNotesFilters {
  projectId: string | null;
  enabled?: boolean;
}

export function useProjectScriptNotes(options: UseProjectScriptNotesOptions) {
  const {
    projectId,
    scriptId,
    pageNumber,
    noteType,
    resolved,
    sceneId,
    authorUserId,
    groupBy,
    enabled = true,
  } = options;
  const queryClient = useQueryClient();
  const queryKey = [
    "backlot-project-script-notes",
    projectId,
    scriptId,
    pageNumber,
    noteType,
    resolved,
    sceneId,
    authorUserId,
    groupBy,
  ];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const params = new URLSearchParams();
      if (scriptId) params.append("script_id", scriptId);
      if (pageNumber !== undefined) params.append("page_number", String(pageNumber));
      if (noteType && noteType !== "all") params.append("note_type", noteType);
      if (resolved !== undefined) params.append("resolved", String(resolved));
      if (sceneId) params.append("scene_id", sceneId);
      if (authorUserId) params.append("author_user_id", authorUserId);
      if (groupBy) params.append("group_by", groupBy);

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/script/notes${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch project notes");
      }

      return (await response.json()) as ProjectNotesResponse;
    },
    enabled: !!projectId && enabled,
  });

  return {
    data,
    notes: data?.notes ?? [],
    grouped: data?.grouped ?? null,
    scripts: data?.scripts ?? [],
    scenes: data?.scenes ?? [],
    authors: data?.authors ?? [],
    projectTitle: data?.project_title ?? "",
    totalCount: data?.total_count ?? 0,
    unresolvedCount: data?.unresolved_count ?? 0,
    isLoading,
    error,
    refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey }),
  };
}

// =============================================================================
// PROJECT NOTES SUMMARY
// =============================================================================

interface UseProjectNotesSummaryOptions {
  projectId: string | null;
  enabled?: boolean;
}

export function useProjectNotesSummary(options: UseProjectNotesSummaryOptions) {
  const { projectId, enabled = true } = options;
  const queryKey = ["backlot-project-notes-summary", projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/script/notes/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch notes summary");
      }

      return (await response.json()) as ProjectNotesSummary;
    },
    enabled: !!projectId && enabled,
  });

  return {
    data,
    totalNotes: data?.total_notes ?? 0,
    unresolvedCount: data?.unresolved_count ?? 0,
    resolvedCount: data?.resolved_count ?? 0,
    byType: data?.by_type ?? {},
    byPage: data?.by_page ?? [],
    pagesWithNotes: data?.pages_with_notes ?? 0,
    uniqueAuthors: data?.unique_authors ?? 0,
    isLoading,
    error,
    refetch,
  };
}

// =============================================================================
// PDF EXPORT
// =============================================================================

interface UseProjectNotesPdfExportOptions {
  projectId: string | null;
}

export function useProjectNotesPdfExport(options: UseProjectNotesPdfExportOptions) {
  const { projectId } = options;

  const exportNotesPdf = useMutation({
    mutationFn: async (params?: {
      scriptId?: string;
      noteType?: BacklotScriptPageNoteType;
      resolved?: boolean;
      sceneId?: string;
      authorUserId?: string;
      groupBy?: NotesGroupBy;
    }) => {
      if (!projectId) throw new Error("No project selected");

      const token = api.getToken();
      if (!token) throw new Error("Not authenticated");

      const urlParams = new URLSearchParams();
      if (params?.scriptId) urlParams.append("script_id", params.scriptId);
      if (params?.noteType && params.noteType !== "all") urlParams.append("note_type", params.noteType);
      if (params?.resolved !== undefined) urlParams.append("resolved", String(params.resolved));
      if (params?.sceneId) urlParams.append("scene_id", params.sceneId);
      if (params?.authorUserId) urlParams.append("author_user_id", params.authorUserId);
      if (params?.groupBy) urlParams.append("group_by", params.groupBy);

      const url = `${API_BASE}/api/v1/backlot/projects/${projectId}/script/notes/pdf${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;

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
      let filename = "script_notes.pdf";
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
    exportNotesPdf,
    isExporting: exportNotesPdf.isPending,
  };
}
