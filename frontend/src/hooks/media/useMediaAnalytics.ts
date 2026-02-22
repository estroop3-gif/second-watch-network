import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMediaAnalytics(params?: { date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['media-analytics', params],
    queryFn: () => api.getMediaAnalytics(params),
  });
}
