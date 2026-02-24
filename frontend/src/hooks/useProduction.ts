import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Fetch a production by its slug — powers "The Slate" detail page
 */
export function useProductionBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['production-by-slug', slug],
    queryFn: () => api.getProductionBySlug(slug!),
    enabled: !!slug,
  });
}

/**
 * Search all productions (productions table + public backlot projects)
 */
export function useProductionSearch(query: string) {
  return useQuery({
    queryKey: ['production-search', query],
    queryFn: () => api.searchAllProductions(query),
    enabled: query.length > 0,
  });
}
