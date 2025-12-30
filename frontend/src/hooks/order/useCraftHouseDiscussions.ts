/**
 * useCraftHouseDiscussions - Hooks for craft house discussions (topics, threads, replies)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderAPI } from '@/lib/api/order';
import type {
  CraftHouseTopic,
  CraftHouseThread,
  CraftHouseThreadDetail,
  CraftHouseReply,
  CraftHouseTopicCreateRequest,
  CraftHouseTopicUpdateRequest,
  CraftHouseThreadCreateRequest,
  CraftHouseThreadUpdateRequest,
  CraftHouseReplyCreateRequest,
  CraftHouseReplyUpdateRequest,
  CraftHouseRole,
} from '@/lib/api/order';

// ============ Topics ============

export function useCraftHouseTopics(craftHouseId: number | null, options?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ['craft-house-topics', craftHouseId, options?.includeInactive],
    queryFn: async () => {
      if (!craftHouseId) return { topics: [], total: 0 };
      return orderAPI.listCraftHouseTopics(craftHouseId, {
        include_inactive: options?.includeInactive,
      });
    },
    enabled: !!craftHouseId,
  });
}

export function useCraftHouseTopicMutations(craftHouseId: number | null) {
  const queryClient = useQueryClient();

  const createTopic = useMutation({
    mutationFn: async (topic: CraftHouseTopicCreateRequest) => {
      if (!craftHouseId) throw new Error('No craft house ID');
      return orderAPI.createCraftHouseTopic(craftHouseId, topic);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-topics', craftHouseId] });
    },
  });

  const updateTopic = useMutation({
    mutationFn: async ({ topicId, update }: { topicId: string; update: CraftHouseTopicUpdateRequest }) => {
      return orderAPI.updateCraftHouseTopic(topicId, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-topics', craftHouseId] });
    },
  });

  return { createTopic, updateTopic };
}

// ============ Threads ============

interface UseThreadsOptions {
  topicId?: string;
  skip?: number;
  limit?: number;
}

export function useCraftHouseThreads(craftHouseId: number | null, options: UseThreadsOptions = {}) {
  return useQuery({
    queryKey: ['craft-house-threads', craftHouseId, options],
    queryFn: async () => {
      if (!craftHouseId) return { threads: [], total: 0 };
      return orderAPI.listCraftHouseThreads(craftHouseId, {
        topic_id: options.topicId,
        skip: options.skip,
        limit: options.limit,
      });
    },
    enabled: !!craftHouseId,
  });
}

export function useCraftHouseThread(threadId: string | null) {
  return useQuery({
    queryKey: ['craft-house-thread', threadId],
    queryFn: async () => {
      if (!threadId) return null;
      return orderAPI.getCraftHouseThread(threadId);
    },
    enabled: !!threadId,
  });
}

export function useCraftHouseThreadMutations(craftHouseId: number | null) {
  const queryClient = useQueryClient();

  const createThread = useMutation({
    mutationFn: async (thread: CraftHouseThreadCreateRequest) => {
      if (!craftHouseId) throw new Error('No craft house ID');
      return orderAPI.createCraftHouseThread(craftHouseId, thread);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-threads', craftHouseId] });
      queryClient.invalidateQueries({ queryKey: ['craft-house-topics', craftHouseId] });
    },
  });

  const updateThread = useMutation({
    mutationFn: async ({ threadId, update }: { threadId: string; update: CraftHouseThreadUpdateRequest }) => {
      return orderAPI.updateCraftHouseThread(threadId, update);
    },
    onSuccess: (_, { threadId }) => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-threads', craftHouseId] });
      queryClient.invalidateQueries({ queryKey: ['craft-house-thread', threadId] });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (threadId: string) => {
      return orderAPI.deleteCraftHouseThread(threadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-threads', craftHouseId] });
      queryClient.invalidateQueries({ queryKey: ['craft-house-topics', craftHouseId] });
    },
  });

  const togglePin = useMutation({
    mutationFn: async (threadId: string) => {
      return orderAPI.toggleCraftHouseThreadPin(threadId);
    },
    onSuccess: (_, threadId) => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-threads', craftHouseId] });
      queryClient.invalidateQueries({ queryKey: ['craft-house-thread', threadId] });
    },
  });

  return { createThread, updateThread, deleteThread, togglePin };
}

// ============ Replies ============

export function useCraftHouseReplyMutations(threadId: string | null, craftHouseId?: number | null) {
  const queryClient = useQueryClient();

  const createReply = useMutation({
    mutationFn: async (reply: CraftHouseReplyCreateRequest) => {
      if (!threadId) throw new Error('No thread ID');
      return orderAPI.createCraftHouseReply(threadId, reply);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-thread', threadId] });
      if (craftHouseId) {
        queryClient.invalidateQueries({ queryKey: ['craft-house-threads', craftHouseId] });
      }
    },
  });

  const updateReply = useMutation({
    mutationFn: async ({ replyId, update }: { replyId: string; update: CraftHouseReplyUpdateRequest }) => {
      return orderAPI.updateCraftHouseReply(replyId, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-thread', threadId] });
    },
  });

  const deleteReply = useMutation({
    mutationFn: async (replyId: string) => {
      return orderAPI.deleteCraftHouseReply(replyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-thread', threadId] });
      if (craftHouseId) {
        queryClient.invalidateQueries({ queryKey: ['craft-house-threads', craftHouseId] });
      }
    },
  });

  return { createReply, updateReply, deleteReply };
}

// ============ Member Role Management ============

export function useCraftHouseMemberRoleMutation(craftHouseId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: CraftHouseRole }) => {
      if (!craftHouseId) throw new Error('No craft house ID');
      return orderAPI.updateCraftHouseMemberRole(craftHouseId, userId, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['craft-house-members', craftHouseId] });
    },
  });
}

// ============ Combined Hook for Full Discussion Context ============

export function useCraftHouseDiscussions(craftHouseId: number | null) {
  const topics = useCraftHouseTopics(craftHouseId);
  const topicMutations = useCraftHouseTopicMutations(craftHouseId);
  const threadMutations = useCraftHouseThreadMutations(craftHouseId);

  return {
    topics: topics.data?.topics || [],
    topicsLoading: topics.isLoading,
    topicsError: topics.error,
    refetchTopics: topics.refetch,
    ...topicMutations,
    ...threadMutations,
  };
}
