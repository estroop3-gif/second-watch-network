/**
 * useTopics - Hook for fetching and managing community topics and threads
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CommunityTopic, CommunityThread, CommunityReply } from '@/types/community';

interface UseThreadsOptions {
  topicId?: string;
  userId?: string;
  limit?: number;
}

interface ThreadInput {
  topic_id: string;
  title: string;
  content: string;
  is_pinned?: boolean;
}

interface ReplyInput {
  thread_id: string;
  content: string;
  parent_reply_id?: string;
}

// Fetch all topics
export function useTopics() {
  return useQuery({
    queryKey: ['community-topics'],
    queryFn: async () => {
      const data = await api.listCommunityTopics();
      return data as CommunityTopic[];
    },
  });
}

// Fetch threads for a topic
export function useThreads(options: UseThreadsOptions = {}) {
  const { topicId, userId, limit = 50 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['community-threads', { topicId, userId, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const threadsData = await api.listCommunityThreads({
        topicId,
        userId,
        limit,
      });

      return (threadsData || []) as CommunityThread[];
    },
    enabled: true,
  });

  const createThread = useMutation({
    mutationFn: async (input: ThreadInput) => {
      const data = await api.createCommunityThread({
        topic_id: input.topic_id,
        title: input.title,
        content: input.content,
        is_pinned: input.is_pinned || false,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  const updateThread = useMutation({
    mutationFn: async ({ id, ...input }: ThreadInput & { id: string }) => {
      const data = await api.updateCommunityThread(id, {
        title: input.title,
        content: input.content,
        is_pinned: input.is_pinned || false,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteCommunityThread(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  return {
    threads: data || [],
    isLoading,
    error,
    refetch,
    createThread,
    updateThread,
    deleteThread,
  };
}

// Fetch a single thread with its replies
export function useThread(id: string | null) {
  return useQuery({
    queryKey: ['community-thread', id],
    queryFn: async () => {
      if (!id) return null;
      const thread = await api.getCommunityThread(id);
      return thread as CommunityThread;
    },
    enabled: !!id,
  });
}

// Fetch replies for a thread
export function useReplies(threadId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['community-replies', threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const repliesData = await api.listCommunityReplies(threadId);
      return (repliesData || []) as CommunityReply[];
    },
    enabled: !!threadId,
  });

  const createReply = useMutation({
    mutationFn: async (input: ReplyInput) => {
      const data = await api.createCommunityReply(input.thread_id, {
        content: input.content,
        parent_reply_id: input.parent_reply_id || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-replies', threadId] });
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  const updateReply = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const data = await api.updateCommunityReply(id, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-replies', threadId] });
    },
  });

  const deleteReply = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteCommunityReply(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-replies', threadId] });
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  return {
    replies: data || [],
    isLoading,
    error,
    refetch,
    createReply,
    updateReply,
    deleteReply,
  };
}
