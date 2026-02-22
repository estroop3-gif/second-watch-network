import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useContentRequests(params?: {
  status?: string;
  content_type?: string;
  priority?: string;
  assigned_to?: string;
  scope?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['media-requests', params],
    queryFn: () => api.getMediaRequests(params),
  });
}

export function useContentRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['media-request', id],
    queryFn: () => api.getMediaRequest(id!),
    enabled: !!id,
  });
}

export function useCreateContentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createMediaRequest(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-requests'] });
      qc.invalidateQueries({ queryKey: ['media-dashboard'] });
    },
  });
}

export function useUpdateContentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMediaRequest(id, data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['media-requests'] });
      qc.invalidateQueries({ queryKey: ['media-request', id] });
    },
  });
}

export function useDeleteContentRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMediaRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-requests'] });
      qc.invalidateQueries({ queryKey: ['media-dashboard'] });
    },
  });
}

export function useUpdateRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      api.updateMediaRequestStatus(id, { status, notes }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['media-requests'] });
      qc.invalidateQueries({ queryKey: ['media-request', id] });
      qc.invalidateQueries({ queryKey: ['media-dashboard'] });
    },
  });
}

export function useAssignRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assigned_to }: { id: string; assigned_to: string | null }) =>
      api.assignMediaRequest(id, { assigned_to }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['media-requests'] });
      qc.invalidateQueries({ queryKey: ['media-request', id] });
    },
  });
}

export function useRequestComments(requestId: string | undefined) {
  return useQuery({
    queryKey: ['media-request-comments', requestId],
    queryFn: () => api.getMediaRequestComments(requestId!),
    enabled: !!requestId,
  });
}

export function useCreateRequestComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, body, is_internal }: { requestId: string; body: string; is_internal?: boolean }) =>
      api.createMediaRequestComment(requestId, { body, is_internal }),
    onSuccess: (_, { requestId }) => {
      qc.invalidateQueries({ queryKey: ['media-request-comments', requestId] });
    },
  });
}

export function useRequestHistory(requestId: string | undefined) {
  return useQuery({
    queryKey: ['media-request-history', requestId],
    queryFn: () => api.getMediaRequestHistory(requestId!),
    enabled: !!requestId,
  });
}
