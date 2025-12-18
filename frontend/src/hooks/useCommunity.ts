import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CommunityProfile } from '@/types';

type SortBy = 'updated_at' | 'created_at';
type SortDir = 'asc' | 'desc';

type CommunityResponse = {
  items: CommunityProfile[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor: { sortBy: SortBy; sortDir: SortDir; updated_at: string; profile_id: string } | null;
};

export type CommunityParams = {
  q?: string;
  pageSize?: number;
  sortBy?: SortBy;
  sortDir?: SortDir;
};

const DEFAULTS: Required<CommunityParams> = {
  q: '',
  pageSize: 24,
  sortBy: 'updated_at',
  sortDir: 'desc',
};

export function useCommunity(params?: CommunityParams) {
  const queryClient = useQueryClient();
  const merged = { ...DEFAULTS, ...(params || {}) };

  const queryKey = ['community', merged.q, merged.pageSize, merged.sortBy, merged.sortDir];

  const fetchPage = async ({ pageParam = 1 }: { pageParam?: number }): Promise<CommunityResponse> => {
    const data = await api.listCommunityProfiles({
      q: merged.q || '',
      page: pageParam,
      pageSize: merged.pageSize,
      sortBy: merged.sortBy,
      sortDir: merged.sortDir,
    });

    return data as CommunityResponse;
  };

  const deDupe = (items: CommunityProfile[]) => {
    const seen = new Set<string>();
    const out: CommunityProfile[] = [];
    for (const it of items) {
      if (!seen.has(it.profile_id)) {
        seen.add(it.profile_id);
        out.push(it);
      }
    }
    return out;
  };

  const query = useInfiniteQuery({
    queryKey,
    queryFn: fetchPage,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.items?.length) return undefined;
      const { page, pageSize, total } = lastPage;
      const next = page + 1;
      const maxPages = Math.ceil(total / pageSize);
      return next <= maxPages ? next : undefined;
    },
    select: (data) => {
      // Flatten and de-duplicate across pages by profile_id
      const flat = data.pages.flatMap((p) => p.items || []);
      const unique = deDupe(flat);
      return {
        ...data,
        flatItems: unique,
        total: data.pages[0]?.total ?? 0,
      } as typeof data & { flatItems: CommunityProfile[]; total: number };
    },
    // Fallback revalidation for clients without live connection
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Utilities to mutate cache safely (used by realtime in Phase 3)
  const upsertProfile = (profile: CommunityProfile) => {
    queryClient.setQueryData<any>(queryKey, (old) => {
      if (!old) return old;
      const pages = old.pages.map((p: CommunityResponse) => p);
      // Put into first page optimistically (append or unshift based on sort)
      const first = pages[0];
      if (!first) return old;

      const existsIdx = first.items.findIndex((i) => i.profile_id === profile.profile_id);
      if (existsIdx >= 0) {
        first.items[existsIdx] = profile;
      } else {
        if (merged.sortDir === 'desc') {
          first.items.unshift(profile);
        } else {
          first.items.push(profile);
        }
        first.total += 1;
      }
      return { ...old, pages: [...pages] };
    });
  };

  const removeProfile = (profileId: string) => {
    queryClient.setQueryData<any>(queryKey, (old) => {
      if (!old) return old;
      const pages: CommunityResponse[] = old.pages.map((p: CommunityResponse) => {
        const filtered = p.items.filter((i) => i.profile_id !== profileId);
        const delta = filtered.length !== p.items.length ? -1 : 0;
        return {
          ...p,
          items: filtered,
          total: p.total + delta,
        };
      });
      return { ...old, pages };
    });
  };

  return {
    ...query,
    flatItems: (query.data as any)?.flatItems as CommunityProfile[] | undefined,
    total: (query.data as any)?.total as number | undefined,
    upsertProfile,
    removeProfile,
    queryKey,
  };
}
