import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMediaCalendar(params?: {
  start?: string;
  end?: string;
  platform_id?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['media-calendar', params],
    queryFn: () => api.getMediaCalendar(params),
  });
}

export function useCreateCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.createMediaCalendarEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-calendar'] });
    },
  });
}

export function useUpdateCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateMediaCalendarEntry(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-calendar'] });
    },
  });
}

export function useDeleteCalendarEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMediaCalendarEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['media-calendar'] });
    },
  });
}
