import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// --- Categories ---

export function useMediaDiscussionCategories() {
  return useQuery({
    queryKey: ['media-discussion-categories'],
    queryFn: () => api.getMediaDiscussionCategories(),
  });
}

export function useCreateMediaDiscussionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; slug: string; icon?: string; sort_order?: number }) =>
      api.createMediaDiscussionCategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-discussion-categories'] });
    },
  });
}

export function useUpdateMediaDiscussionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateMediaDiscussionCategory(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-discussion-categories'] });
    },
  });
}

export function useDeleteMediaDiscussionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMediaDiscussionCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-discussion-categories'] });
    },
  });
}

// --- Threads ---

export function useMediaDiscussionThreads(params?: {
  category_slug?: string;
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['media-discussion-threads', params],
    queryFn: () => api.getMediaDiscussionThreads(params),
  });
}

export function useMediaDiscussionThread(id: string | undefined) {
  return useQuery({
    queryKey: ['media-discussion-thread', id],
    queryFn: () => api.getMediaDiscussionThread(id!),
    enabled: !!id,
  });
}

export function useCreateMediaDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category_id: string; title: string; content: string }) =>
      api.createMediaDiscussionThread(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
      qc.invalidateQueries({ queryKey: ['media-discussion-categories'] });
    },
  });
}

export function useUpdateMediaDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string } }) =>
      api.updateMediaDiscussionThread(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
      qc.invalidateQueries({ queryKey: ['media-discussion-thread', id] });
    },
  });
}

export function useDeleteMediaDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMediaDiscussionThread(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
      qc.invalidateQueries({ queryKey: ['media-discussion-categories'] });
    },
  });
}

export function usePinMediaDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.pinMediaDiscussionThread(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
    },
  });
}

export function useResolveMediaDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resolveMediaDiscussionThread(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
      qc.invalidateQueries({ queryKey: ['media-discussion-thread', id] });
    },
  });
}

export function useLockMediaDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.lockMediaDiscussionThread(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
      qc.invalidateQueries({ queryKey: ['media-discussion-thread', id] });
    },
  });
}

// --- Replies ---

export function useMediaDiscussionReplies(threadId: string | undefined) {
  return useQuery({
    queryKey: ['media-discussion-replies', threadId],
    queryFn: () => api.getMediaDiscussionReplies(threadId!),
    enabled: !!threadId,
  });
}

export function useCreateMediaDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { thread_id: string; content: string; parent_reply_id?: string }) =>
      api.createMediaDiscussionReply(data),
    onSuccess: (_, { thread_id }) => {
      qc.invalidateQueries({ queryKey: ['media-discussion-replies', thread_id] });
      qc.invalidateQueries({ queryKey: ['media-discussion-thread', thread_id] });
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
    },
  });
}

export function useUpdateMediaDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content, threadId }: { id: string; content: string; threadId: string }) =>
      api.updateMediaDiscussionReply(id, { content }),
    onSuccess: (_, { threadId }) => {
      qc.invalidateQueries({ queryKey: ['media-discussion-replies', threadId] });
    },
  });
}

export function useDeleteMediaDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, threadId }: { id: string; threadId: string }) =>
      api.deleteMediaDiscussionReply(id),
    onSuccess: (_, { threadId }) => {
      qc.invalidateQueries({ queryKey: ['media-discussion-replies', threadId] });
      qc.invalidateQueries({ queryKey: ['media-discussion-thread', threadId] });
      qc.invalidateQueries({ queryKey: ['media-discussion-threads'] });
    },
  });
}
