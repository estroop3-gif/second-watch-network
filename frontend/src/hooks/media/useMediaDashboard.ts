import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMediaDashboard() {
  return useQuery({
    queryKey: ['media-dashboard'],
    queryFn: () => api.getMediaDashboard(),
    refetchInterval: 60000, // Refresh every minute
  });
}
