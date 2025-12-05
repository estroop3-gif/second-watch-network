import React, { useState } from 'react';
import { useCommunity } from '@/hooks/useCommunity';
import CommunityGrid from '@/components/community/CommunityGrid';
import { useCommunityRealtime } from '@/hooks/useCommunityRealtime';
import CommunitySkeleton from '@/components/community/CommunitySkeleton';
import EmptyState from '@/components/community/EmptyState';

const Filmmakers = () => {
  const [q, setQ] = useState('');
  const { flatItems, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, upsertProfile, removeProfile, queryKey, error } = useCommunity({
    q,
    pageSize: 24,
    sortBy: 'updated_at',
    sortDir: 'desc',
  });

  useCommunityRealtime({
    onUpsert: upsertProfile,
    onRemove: removeProfile,
    queryKey,
  });

  return (
    <div className="container mx-auto px-4 max-w-4xl py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">
          Connect with <span className="font-spray text-accent-yellow">Filmmakers</span>
        </h1>
        <p className="text-muted-gray max-w-2xl mx-auto">
          Discover and connect with the talented filmmakers in the Second Watch Network community.
        </p>
        <div className="mt-6 max-w-md mx-auto">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full p-3 rounded-md bg-charcoal-black/50 border border-muted-gray/30 text-bone-white focus:outline-none focus:ring-2 focus:ring-accent-yellow"
          />
        </div>
      </div>

      {error && (
        <p className="text-center text-primary-red mb-6">
          Failed to load community: {error.message}
        </p>
      )}

      {isLoading && <CommunitySkeleton count={9} />}

      {!isLoading && flatItems && flatItems.length > 0 && (
        <CommunityGrid items={flatItems} />
      )}

      {!isLoading && (!flatItems || flatItems.length === 0) && !error && (
        <EmptyState
          title={q ? `No results for “${q}”` : 'No filmmakers found'}
          description={q ? 'Try adjusting your search terms.' : 'When filmmakers join the community, they will appear here.'}
        />
      )}

      <div className="flex justify-center mt-10">
        {hasNextPage && (
          <button
            className="px-6 py-2 rounded-md bg-bone-white text-charcoal-black hover:bg-accent-yellow transition"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Filmmakers;