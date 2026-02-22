import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMediaPlatforms(includeInactive = false) {
  return useQuery({
    queryKey: ['media-platforms', includeInactive],
    queryFn: () => api.getMediaPlatforms(includeInactive),
  });
}

export function useCreateMediaPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createMediaPlatform(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-platforms'] });
    },
  });
}

export function useUpdateMediaPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMediaPlatform(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-platforms'] });
    },
  });
}

export function useDeleteMediaPlatform() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMediaPlatform(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-platforms'] });
    },
  });
}

export function useReorderMediaPlatforms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platformIds: string[]) => api.reorderMediaPlatforms(platformIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-platforms'] });
    },
  });
}
