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
 * Fetch a backlot project by its slug for The Slate — same response shape as productions
 */
export function useBacklotProjectForSlate(slug: string | undefined) {
  return useQuery({
    queryKey: ['backlot-slate', slug],
    queryFn: () => api.getBacklotProjectForSlate(slug!),
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

/**
 * Unified search across productions and people
 */
export function useUnifiedSearch(query: string, type: string = 'all') {
  return useQuery({
    queryKey: ['unified-search', query, type],
    queryFn: () => api.searchUnified(query, type),
    enabled: true, // always fetch (empty query returns recent productions)
  });
}

/**
 * Fetch a person's filmography by username
 */
export function useFilmography(username: string | undefined) {
  return useQuery({
    queryKey: ['filmography', username],
    queryFn: () => api.getFilmography(username!),
    enabled: !!username,
  });
}
