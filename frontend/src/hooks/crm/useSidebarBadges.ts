import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSidebarBadges() {
  return useQuery({
    queryKey: ['crm-sidebar-badges'],
    queryFn: () => api.getCRMSidebarBadges(),
    refetchInterval: 60000, // refresh every minute
    staleTime: 30000,
  });
}
