import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Map a CRM pathname to its tab key for badge tracking. */
export function getTabKeyFromPath(pathname: string): string | null {
  const map: Record<string, string> = {
    '/crm/contacts': 'contacts',
    '/crm/dnc': 'dnc',
    '/crm/pipeline': 'pipeline',
    '/crm/interactions': 'interactions',
    '/crm/goals': 'goals',
    '/crm/log': 'log',
    '/crm/reviews': 'reviews',
    '/crm/training': 'training',
    '/crm/discussions': 'discussions',
    '/crm/business-card': 'business_card',
  };
  // Match exactly or match prefix (e.g. /crm/contacts/123 → contacts)
  for (const [prefix, key] of Object.entries(map)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return key;
    }
  }
  return null;
}

export function useMarkTabViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tabKey: string) => api.markCRMTabViewed(tabKey),
    onMutate: async (tabKey: string) => {
      // Optimistically set the badge to 0 for this tab
      await queryClient.cancelQueries({ queryKey: ['crm-sidebar-badges'] });
      const prev = queryClient.getQueryData<Record<string, number>>(['crm-sidebar-badges']);
      if (prev) {
        queryClient.setQueryData(['crm-sidebar-badges'], { ...prev, [tabKey]: 0 });
      }
      return { prev };
    },
    onError: (_err, _tabKey, context) => {
      // Roll back on error
      if (context?.prev) {
        queryClient.setQueryData(['crm-sidebar-badges'], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-sidebar-badges'] });
    },
  });
}
