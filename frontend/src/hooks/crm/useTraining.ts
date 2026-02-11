import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ============================================================================
// Training Resources
// ============================================================================

export function useTrainingResources(params?: { type?: string; category?: string; search?: string }) {
  return useQuery({
    queryKey: ['crm-training-resources', params],
    queryFn: () => api.getCRMTrainingResources(params),
  });
}

export function useTrainingResource(id: string) {
  return useQuery({
    queryKey: ['crm-training-resource', id],
    queryFn: () => api.getCRMTrainingResource(id),
    enabled: !!id,
  });
}

export function useCreateTrainingResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createCRMTrainingResource(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-training-resources'] }),
  });
}

export function useUpdateTrainingResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) =>
      api.updateCRMTrainingResource(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-training-resources'] });
      qc.invalidateQueries({ queryKey: ['crm-training-resource'] });
    },
  });
}

export function useDeleteTrainingResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMTrainingResource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-training-resources'] }),
  });
}

export function useUploadTrainingFile() {
  return useMutation({
    mutationFn: (file: File) => api.uploadCRMTrainingFile(file),
  });
}

// ============================================================================
// Discussion Categories
// ============================================================================

export function useDiscussionCategories() {
  return useQuery({
    queryKey: ['crm-discussion-categories'],
    queryFn: () => api.getCRMDiscussionCategories(),
  });
}

export function useCreateDiscussionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      api.createCRMDiscussionCategory(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-discussion-categories'] }),
  });
}

export function useUpdateDiscussionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      api.updateCRMDiscussionCategory(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-discussion-categories'] }),
  });
}

export function useDeleteDiscussionCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMDiscussionCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-discussion-categories'] }),
  });
}

// ============================================================================
// Discussion Threads
// ============================================================================

export function useDiscussionThreads(params?: { category_slug?: string; search?: string; sort?: string }) {
  return useQuery({
    queryKey: ['crm-discussion-threads', params],
    queryFn: () => api.getCRMDiscussionThreads(params),
  });
}

export function useDiscussionThread(id: string) {
  return useQuery({
    queryKey: ['crm-discussion-thread', id],
    queryFn: () => api.getCRMDiscussionThread(id),
    enabled: !!id,
  });
}

export function useCreateDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category_id: string; title: string; content: string; resource_id?: string }) =>
      api.createCRMDiscussionThread(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-discussion-threads'] }),
  });
}

export function useUpdateDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; content?: string }) =>
      api.updateCRMDiscussionThread(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-discussion-threads'] });
      qc.invalidateQueries({ queryKey: ['crm-discussion-thread'] });
    },
  });
}

export function useDeleteDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMDiscussionThread(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-discussion-threads'] }),
  });
}

export function usePinDiscussionThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_pinned }: { id: string; is_pinned: boolean }) =>
      api.pinCRMDiscussionThread(id, is_pinned),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-discussion-threads'] }),
  });
}

// ============================================================================
// Discussion Replies
// ============================================================================

export function useDiscussionReplies(threadId: string) {
  return useQuery({
    queryKey: ['crm-discussion-replies', threadId],
    queryFn: () => api.getCRMDiscussionReplies(threadId),
    enabled: !!threadId,
  });
}

export function useCreateDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { thread_id: string; content: string }) =>
      api.createCRMDiscussionReply(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['crm-discussion-replies', variables.thread_id] });
      qc.invalidateQueries({ queryKey: ['crm-discussion-threads'] });
      qc.invalidateQueries({ queryKey: ['crm-discussion-thread', variables.thread_id] });
    },
  });
}

export function useUpdateDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.updateCRMDiscussionReply(id, { content }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-discussion-replies'] }),
  });
}

export function useDeleteDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCRMDiscussionReply(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-discussion-replies'] });
      qc.invalidateQueries({ queryKey: ['crm-discussion-threads'] });
    },
  });
}
