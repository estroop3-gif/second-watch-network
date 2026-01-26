/**
 * Message Folder Rules Hooks
 * CRUD operations for auto-sorting rules that assign conversations to folders
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// =============================================================================
// Types
// =============================================================================

export interface RuleCondition {
  type: 'sender' | 'keyword' | 'context';
  operator: 'in' | 'not_in' | 'contains' | 'not_contains' | 'equals' | 'not_equals';
  value: string | string[];
}

export interface FolderRule {
  id: string;
  folder_id: string;
  folder_name: string;
  name: string;
  conditions: RuleCondition[];
  condition_logic: 'AND' | 'OR';
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleCreateInput {
  folder_id: string;
  name: string;
  conditions: RuleCondition[];
  condition_logic?: 'AND' | 'OR';
  priority?: number;
  is_active?: boolean;
  apply_to_existing?: boolean;
}

export interface RuleUpdateInput {
  name?: string;
  folder_id?: string;
  conditions?: RuleCondition[];
  condition_logic?: 'AND' | 'OR';
  priority?: number;
  is_active?: boolean;
}

// =============================================================================
// Rules List
// =============================================================================

/**
 * Get all folder rules for the current user
 */
export function useFolderRules() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['folder-rules', user?.id],
    queryFn: async (): Promise<FolderRule[]> => {
      if (!user?.id) return [];
      return api.get(`/api/v1/message-folders/rules/?user_id=${user.id}`);
    },
    enabled: !!user?.id,
  });
}

// =============================================================================
// Rule CRUD
// =============================================================================

/**
 * Create a new folder rule
 */
export function useCreateRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: RuleCreateInput): Promise<FolderRule> => {
      return api.post(`/api/v1/message-folders/rules/?user_id=${user?.id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] });
      // If apply_to_existing was true, also invalidate inbox
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['folder-conversations'] });
    },
  });
}

/**
 * Update a folder rule
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ ruleId, ...input }: RuleUpdateInput & { ruleId: string }): Promise<FolderRule> => {
      return api.put(`/api/v1/message-folders/rules/${ruleId}?user_id=${user?.id}`, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] });
    },
  });
}

/**
 * Delete a folder rule
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ruleId: string): Promise<void> => {
      await api.delete(`/api/v1/message-folders/rules/${ruleId}?user_id=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] });
    },
  });
}

/**
 * Toggle a rule's active status
 */
export function useToggleRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string; isActive: boolean }): Promise<FolderRule> => {
      return api.put(`/api/v1/message-folders/rules/${ruleId}?user_id=${user?.id}`, { is_active: isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] });
    },
  });
}

/**
 * Apply a rule to existing conversations
 */
export function useApplyRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ruleId: string): Promise<{ status: string; conversations_assigned: number }> => {
      return api.post(`/api/v1/message-folders/rules/${ruleId}/apply?user_id=${user?.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['folder-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['custom-folders'] });
    },
  });
}

// =============================================================================
// Rule Priority Reordering
// =============================================================================

/**
 * Update rule priorities
 */
export function useReorderRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rules: { id: string; priority: number }[]): Promise<void> => {
      await Promise.all(
        rules.map((r) =>
          api.put(`/api/v1/message-folders/rules/${r.id}?user_id=${user?.id}`, { priority: r.priority })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folder-rules'] });
    },
  });
}

// =============================================================================
// Condition Helpers
// =============================================================================

/**
 * Create a sender condition
 */
export function createSenderCondition(userIds: string[], exclude = false): RuleCondition {
  return {
    type: 'sender',
    operator: exclude ? 'not_in' : 'in',
    value: userIds,
  };
}

/**
 * Create a keyword condition
 */
export function createKeywordCondition(keywords: string[], exclude = false): RuleCondition {
  return {
    type: 'keyword',
    operator: exclude ? 'not_contains' : 'contains',
    value: keywords,
  };
}

/**
 * Create a context condition
 */
export function createContextCondition(contextType: string, exclude = false): RuleCondition {
  return {
    type: 'context',
    operator: exclude ? 'not_equals' : 'equals',
    value: contextType,
  };
}

// =============================================================================
// Condition Display Helpers
// =============================================================================

export const CONDITION_TYPE_LABELS: Record<string, string> = {
  sender: 'From specific people',
  keyword: 'Contains keywords',
  context: 'Message context',
};

export const OPERATOR_LABELS: Record<string, string> = {
  in: 'is any of',
  not_in: 'is not any of',
  contains: 'contains any of',
  not_contains: 'does not contain',
  equals: 'equals',
  not_equals: 'does not equal',
};

export const CONTEXT_TYPE_LABELS: Record<string, string> = {
  personal: 'Personal',
  application: 'Job Application',
  backlot: 'Backlot Project',
  order: 'The Order',
  greenroom: 'Green Room',
  gear: 'Gear House',
  set: 'Set House',
};
