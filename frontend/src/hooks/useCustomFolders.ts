/**
 * Custom Message Folders Hooks
 * CRUD operations for user-created message folders and conversation assignments
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// =============================================================================
// Types
// =============================================================================

export interface CustomFolder {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  position: number;
  unread_count: number;
  conversation_count: number;
  created_at: string;
  updated_at: string;
}

export interface FolderCreateInput {
  name: string;
  color?: string;
  icon?: string;
  position?: number;
}

export interface FolderUpdateInput {
  name?: string;
  color?: string;
  icon?: string;
  position?: number;
}

export interface FolderAssignment {
  folder_id: string;
  folder_name: string;
  color: string | null;
  icon: string | null;
}

export interface FolderConversation {
  id: string;
  type: 'dm';
  folder: string;
  other_participant: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
  };
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

// =============================================================================
// Folder List
// =============================================================================

/**
 * Get all custom folders for the current user with unread counts
 */
export function useCustomFolders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['custom-folders', user?.id],
    queryFn: async (): Promise<CustomFolder[]> => {
      if (!user?.id) return [];
      return api.get(`/api/v1/message-folders/?user_id=${user.id}`);
    },
    enabled: !!user?.id,
  });
}

/**
 * Get conversations in a specific folder
 */
export function useFolderConversations(folderId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['folder-conversations', folderId, user?.id],
    queryFn: async (): Promise<FolderConversation[]> => {
      if (!user?.id || !folderId) return [];
      return api.get(`/api/v1/message-folders/${folderId}/conversations?user_id=${user.id}`);
    },
    enabled: !!user?.id && !!folderId,
  });
}

// =============================================================================
// Folder CRUD
// =============================================================================

/**
 * Create a new custom folder
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: FolderCreateInput): Promise<CustomFolder> => {
      return api.post(`/api/v1/message-folders/?user_id=${user?.id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-counts'] });
    },
  });
}

/**
 * Update a custom folder
 */
export function useUpdateFolder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ folderId, ...input }: FolderUpdateInput & { folderId: string }): Promise<CustomFolder> => {
      return api.put(`/api/v1/message-folders/${folderId}?user_id=${user?.id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-counts'] });
    },
  });
}

/**
 * Delete a custom folder
 */
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (folderId: string): Promise<void> => {
      await api.delete(`/api/v1/message-folders/${folderId}?user_id=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-counts'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

// =============================================================================
// Conversation Assignment
// =============================================================================

/**
 * Move a conversation to a folder
 */
export function useAssignConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ folderId, partnerId }: { folderId: string; partnerId: string }): Promise<void> => {
      await api.post(`/api/v1/message-folders/assign?user_id=${user?.id}`, {
        folder_id: folderId,
        conversation_partner_id: partnerId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-counts'] });
      queryClient.invalidateQueries({ queryKey: ['folder-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

/**
 * Remove a conversation from its custom folder (back to default inbox)
 */
export function useUnassignConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (partnerId: string): Promise<void> => {
      await api.delete(`/api/v1/message-folders/assign/${partnerId}?user_id=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-folders'] });
      queryClient.invalidateQueries({ queryKey: ['folder-counts'] });
      queryClient.invalidateQueries({ queryKey: ['folder-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

/**
 * Get the folder assignment for a conversation
 */
export function useConversationAssignment(partnerId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['conversation-assignment', partnerId, user?.id],
    queryFn: async (): Promise<FolderAssignment | null> => {
      if (!user?.id || !partnerId) return null;
      return api.get(`/api/v1/message-folders/assignment/${partnerId}?user_id=${user.id}`);
    },
    enabled: !!user?.id && !!partnerId,
  });
}

// =============================================================================
// Folder Reordering
// =============================================================================

/**
 * Reorder folders (update positions)
 */
export function useReorderFolders() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (folders: { id: string; position: number }[]): Promise<void> => {
      // Update each folder's position
      await Promise.all(
        folders.map((f) =>
          api.put(`/api/v1/message-folders/${f.id}?user_id=${user?.id}`, { position: f.position })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-folders'] });
    },
  });
}
