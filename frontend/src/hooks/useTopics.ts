/**
 * useTopics - Hook for fetching and managing community topics and threads
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      const { data, error } = await supabase
        .from('community_topics')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
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
      let query = supabase
        .from('community_topic_threads')
        .select('*, topic:community_topics(id, name, slug, icon)')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (topicId) {
        query = query.eq('topic_id', topicId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: threadsData, error } = await query;

      if (error) throw error;
      if (!threadsData || threadsData.length === 0) return [];

      // Fetch profiles for all user_ids
      const userIds = [...new Set(threadsData.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', userIds);

      // Map profiles to threads
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return threadsData.map(thread => ({
        ...thread,
        author: profileMap.get(thread.user_id) || null,
      })) as CommunityThread[];
    },
    enabled: true,
  });

  const createThread = useMutation({
    mutationFn: async (input: ThreadInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('community_topic_threads')
        .insert({
          user_id: userData.user.id,
          topic_id: input.topic_id,
          title: input.title,
          content: input.content,
          is_pinned: input.is_pinned || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  const updateThread = useMutation({
    mutationFn: async ({ id, ...input }: ThreadInput & { id: string }) => {
      const { data, error } = await supabase
        .from('community_topic_threads')
        .update({
          title: input.title,
          content: input.content,
          is_pinned: input.is_pinned || false,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('community_topic_threads')
        .delete()
        .eq('id', id);

      if (error) throw error;
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

      const { data: thread, error } = await supabase
        .from('community_topic_threads')
        .select('*, topic:community_topics(id, name, slug, icon)')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch author profile
      const { data: author } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .eq('id', thread.user_id)
        .single();

      return { ...thread, author } as CommunityThread;
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

      const { data: repliesData, error } = await supabase
        .from('community_topic_replies')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!repliesData || repliesData.length === 0) return [];

      // Fetch profiles for all user_ids
      const userIds = [...new Set(repliesData.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', userIds);

      // Map profiles to replies
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return repliesData.map(reply => ({
        ...reply,
        author: profileMap.get(reply.user_id) || null,
      })) as CommunityReply[];
    },
    enabled: !!threadId,
  });

  const createReply = useMutation({
    mutationFn: async (input: ReplyInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('community_topic_replies')
        .insert({
          user_id: userData.user.id,
          thread_id: input.thread_id,
          content: input.content,
          parent_reply_id: input.parent_reply_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-replies', threadId] });
      queryClient.invalidateQueries({ queryKey: ['community-threads'] });
    },
  });

  const updateReply = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data, error } = await supabase
        .from('community_topic_replies')
        .update({ content })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-replies', threadId] });
    },
  });

  const deleteReply = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('community_topic_replies')
        .delete()
        .eq('id', id);

      if (error) throw error;
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
