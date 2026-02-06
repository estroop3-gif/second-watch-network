/**
 * useAdNotes - Hooks for AD Note Entries and Comments
 *
 * Features:
 * - Version-controlled note entries with draft support
 * - Manual publish workflow
 * - Threaded comments on entries
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Helper to get auth token
 */
function getAuthToken(): string {
  const token = api.getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  return token;
}

// =====================================================
// Types
// =====================================================

export interface AdNoteEntryCreator {
  id: string;
  display_name: string;
  avatar_url?: string;
}

export interface AdNoteEntry {
  id: string;
  production_day_id: string;
  project_id: string;
  content: string;
  is_draft: boolean;
  version_number: number;
  parent_entry_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: AdNoteEntryCreator;
  comment_count?: number;
}

export interface AdNoteComment {
  id: string;
  entry_id: string;
  parent_comment_id?: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  creator?: AdNoteEntryCreator;
  replies?: AdNoteComment[];
}

// =====================================================
// Note Entries
// =====================================================

/**
 * Get all published note entries for a production day
 */
export function useAdNoteEntries(dayId: string | null) {
  return useQuery({
    queryKey: ['backlot-ad-note-entries', dayId],
    queryFn: async () => {
      if (!dayId) return [];

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/production-days/${dayId}/ad-note-entries`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch entries' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.entries || []) as AdNoteEntry[];
    },
    enabled: !!dayId,
  });
}

/**
 * Get current user's draft for a production day
 */
export function useAdNoteDraft(dayId: string | null) {
  return useQuery({
    queryKey: ['backlot-ad-note-draft', dayId],
    queryFn: async () => {
      if (!dayId) return null;

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/production-days/${dayId}/ad-note-draft`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch draft' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.draft as AdNoteEntry | null;
    },
    enabled: !!dayId,
  });
}

/**
 * Save draft (auto-save)
 */
export function useSaveAdNoteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dayId, content }: { dayId: string; content: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/production-days/${dayId}/ad-note-draft`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to save draft' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.draft as AdNoteEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-draft', variables.dayId] });
    },
  });
}

/**
 * Publish note (creates new version)
 */
export function usePublishAdNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dayId, content }: { dayId: string; content: string }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/production-days/${dayId}/ad-note-entries`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to publish note' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.entry as AdNoteEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-entries', variables.dayId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-draft', variables.dayId] });
      // Also invalidate production day to update legacy ad_notes field
      queryClient.invalidateQueries({ queryKey: ['backlot-production-days'] });
    },
  });
}

/**
 * Update an existing entry
 */
export function useUpdateAdNoteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      content,
      dayId,
    }: {
      entryId: string;
      content: string;
      dayId: string;
    }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/ad-note-entries/${entryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update entry' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.entry as AdNoteEntry;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-entries', variables.dayId] });
    },
  });
}

// =====================================================
// Comments
// =====================================================

/**
 * Get comments for an entry (with threading)
 */
export function useAdNoteComments(entryId: string | null) {
  return useQuery({
    queryKey: ['backlot-ad-note-comments', entryId],
    queryFn: async () => {
      if (!entryId) return [];

      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/ad-note-entries/${entryId}/comments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch comments' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.comments || []) as AdNoteComment[];
    },
    enabled: !!entryId,
  });
}

/**
 * Add a comment
 */
export function useAddAdNoteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryId,
      content,
      parentCommentId,
    }: {
      entryId: string;
      content: string;
      parentCommentId?: string;
    }) => {
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/ad-note-entries/${entryId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content,
            parent_comment_id: parentCommentId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add comment' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.comment as AdNoteComment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-comments', variables.entryId] });
      // Update comment count in entries list
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-entries'] });
    },
  });
}

/**
 * Update a comment
 */
export function useUpdateAdNoteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      content,
      entryId,
    }: {
      commentId: string;
      content: string;
      entryId: string;
    }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/ad-note-comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update comment' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.comment as AdNoteComment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-comments', variables.entryId] });
    },
  });
}

/**
 * Delete a comment
 */
export function useDeleteAdNoteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, entryId }: { commentId: string; entryId: string }) => {
      const token = getAuthToken();

      const response = await fetch(`${API_BASE}/api/v1/backlot/ad-note-comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete comment' }));
        throw new Error(error.detail);
      }

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-comments', variables.entryId] });
      // Update comment count in entries list
      queryClient.invalidateQueries({ queryKey: ['backlot-ad-note-entries'] });
    },
  });
}
