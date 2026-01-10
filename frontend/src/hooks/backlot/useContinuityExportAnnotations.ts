/**
 * useContinuityExportAnnotations - Hooks for Version-Specific PDF Annotations
 *
 * Manages highlights, notes, and drawings on exported continuity PDFs.
 * Each export version has independent annotations stored in the database.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const API_BASE = '/api/v1';

// =============================================================================
// TYPES
// =============================================================================

export interface ExportHighlight {
  id: string;
  export_id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  text_content?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  created_by_profile?: {
    id: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export interface ExportNote {
  id: string;
  export_id: string;
  page_number: number;
  anchor_x: number;
  anchor_y: number;
  note_text: string;
  note_category: string;
  is_critical: boolean;
  // Highlight rectangle (optional - notes can be just pins or highlighted areas)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  highlight_color?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  created_by_profile?: {
    id: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

export type DrawingToolType = 'pen' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'text';

export interface ExportDrawing {
  id: string;
  export_id: string;
  page_number: number;
  tool_type: DrawingToolType;
  stroke_color: string;
  stroke_width: number;
  fill_color?: string;
  opacity: number;
  path_data: PathData;
  text_content?: string;
  font_size?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  created_by_profile?: {
    id: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
}

// Path data types for different drawing tools
export interface PathPoint {
  x: number;
  y: number;
}

export interface PenPathData {
  type: 'pen';
  points: PathPoint[];
}

export interface LinePathData {
  type: 'line';
  start: PathPoint;
  end: PathPoint;
}

export interface ArrowPathData {
  type: 'arrow';
  start: PathPoint;
  end: PathPoint;
}

export interface RectanglePathData {
  type: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CirclePathData {
  type: 'circle';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface TextPathData {
  type: 'text';
  x: number;
  y: number;
}

export type PathData = PenPathData | LinePathData | ArrowPathData | RectanglePathData | CirclePathData | TextPathData;

// Input types for mutations
export interface CreateHighlightInput {
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  opacity?: number;
  text_content?: string;
}

export interface UpdateHighlightInput {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  text_content?: string;
}

export interface CreateNoteInput {
  page_number: number;
  anchor_x: number;
  anchor_y: number;
  note_text: string;
  note_category?: string;
  is_critical?: boolean;
  // Highlight rectangle (optional)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  highlight_color?: string;
}

export interface UpdateNoteInput {
  anchor_x?: number;
  anchor_y?: number;
  note_text?: string;
  note_category?: string;
  is_critical?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  highlight_color?: string;
}

export interface CreateDrawingInput {
  page_number: number;
  tool_type: DrawingToolType;
  path_data: PathData;
  stroke_color?: string;
  stroke_width?: number;
  fill_color?: string;
  opacity?: number;
  text_content?: string;
  font_size?: number;
}

export interface UpdateDrawingInput {
  path_data?: PathData;
  stroke_color?: string;
  stroke_width?: number;
  fill_color?: string;
  opacity?: number;
  text_content?: string;
  font_size?: number;
}

// =============================================================================
// HIGHLIGHTS HOOKS
// =============================================================================

/**
 * Fetch all highlights for a continuity export
 */
export function useExportHighlights(
  projectId: string | null,
  exportId: string | null,
  pageNumber?: number
) {
  return useQuery({
    queryKey: ['export-highlights', projectId, exportId, pageNumber],
    queryFn: async () => {
      if (!projectId || !exportId) return [];
      const params = pageNumber !== undefined ? `?page_number=${pageNumber}` : '';
      const response = await api.get<ExportHighlight[]>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}/highlights${params}`
      );
      return response;
    },
    enabled: !!projectId && !!exportId,
  });
}

/**
 * Create a new highlight on an export
 */
export function useCreateExportHighlight(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHighlightInput) => {
      if (!projectId || !exportId) throw new Error('Project ID and Export ID required');

      const response = await api.post<ExportHighlight>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}/highlights`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-highlights', projectId, exportId] });
    },
  });
}

/**
 * Update an existing highlight
 */
export function useUpdateExportHighlight(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ highlightId, data }: { highlightId: string; data: UpdateHighlightInput }) => {
      const response = await api.patch<ExportHighlight>(
        `${API_BASE}/backlot/continuity/export-highlights/${highlightId}`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-highlights', projectId, exportId] });
    },
  });
}

/**
 * Delete a highlight
 */
export function useDeleteExportHighlight(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (highlightId: string) => {
      const response = await api.delete(
        `${API_BASE}/backlot/continuity/export-highlights/${highlightId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-highlights', projectId, exportId] });
    },
  });
}

// =============================================================================
// NOTES HOOKS
// =============================================================================

/**
 * Fetch all notes for a continuity export
 */
export function useExportNotes(
  projectId: string | null,
  exportId: string | null,
  pageNumber?: number
) {
  return useQuery({
    queryKey: ['export-notes', projectId, exportId, pageNumber],
    queryFn: async () => {
      if (!projectId || !exportId) return [];
      const params = pageNumber !== undefined ? `?page_number=${pageNumber}` : '';
      const response = await api.get<ExportNote[]>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}/notes${params}`
      );
      return response;
    },
    enabled: !!projectId && !!exportId,
  });
}

/**
 * Create a new note on an export
 */
export function useCreateExportNote(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoteInput) => {
      if (!projectId || !exportId) throw new Error('Project ID and Export ID required');

      const response = await api.post<ExportNote>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}/notes`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-notes', projectId, exportId] });
    },
  });
}

/**
 * Update an existing note
 */
export function useUpdateExportNote(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string; data: UpdateNoteInput }) => {
      const response = await api.patch<ExportNote>(
        `${API_BASE}/backlot/continuity/export-notes/${noteId}`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-notes', projectId, exportId] });
    },
  });
}

/**
 * Delete a note
 */
export function useDeleteExportNote(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const response = await api.delete(
        `${API_BASE}/backlot/continuity/export-notes/${noteId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-notes', projectId, exportId] });
    },
  });
}

// =============================================================================
// DRAWINGS HOOKS
// =============================================================================

/**
 * Fetch all drawings for a continuity export
 */
export function useExportDrawings(
  projectId: string | null,
  exportId: string | null,
  pageNumber?: number
) {
  return useQuery({
    queryKey: ['export-drawings', projectId, exportId, pageNumber],
    queryFn: async () => {
      if (!projectId || !exportId) return [];
      const params = pageNumber !== undefined ? `?page_number=${pageNumber}` : '';
      const response = await api.get<ExportDrawing[]>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}/drawings${params}`
      );
      return response;
    },
    enabled: !!projectId && !!exportId,
  });
}

/**
 * Create a new drawing on an export
 */
export function useCreateExportDrawing(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDrawingInput) => {
      if (!projectId || !exportId) throw new Error('Project ID and Export ID required');

      const response = await api.post<ExportDrawing>(
        `${API_BASE}/backlot/projects/${projectId}/continuity/exports/${exportId}/drawings`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-drawings', projectId, exportId] });
    },
  });
}

/**
 * Update an existing drawing
 */
export function useUpdateExportDrawing(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawingId, data }: { drawingId: string; data: UpdateDrawingInput }) => {
      const response = await api.patch<ExportDrawing>(
        `${API_BASE}/backlot/continuity/export-drawings/${drawingId}`,
        data
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-drawings', projectId, exportId] });
    },
  });
}

/**
 * Delete a drawing
 */
export function useDeleteExportDrawing(projectId: string | null, exportId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drawingId: string) => {
      const response = await api.delete(
        `${API_BASE}/backlot/continuity/export-drawings/${drawingId}`
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['export-drawings', projectId, exportId] });
    },
  });
}

// =============================================================================
// COMBINED ANNOTATIONS HOOK
// =============================================================================

/**
 * Fetch all annotations (highlights, notes, drawings) for a page
 */
export function useExportAnnotations(
  projectId: string | null,
  exportId: string | null,
  pageNumber?: number
) {
  const highlights = useExportHighlights(projectId, exportId, pageNumber);
  const notes = useExportNotes(projectId, exportId, pageNumber);
  const drawings = useExportDrawings(projectId, exportId, pageNumber);

  return {
    highlights: highlights.data || [],
    notes: notes.data || [],
    drawings: drawings.data || [],
    isLoading: highlights.isLoading || notes.isLoading || drawings.isLoading,
    isError: highlights.isError || notes.isError || drawings.isError,
    refetch: () => {
      highlights.refetch();
      notes.refetch();
      drawings.refetch();
    },
  };
}
