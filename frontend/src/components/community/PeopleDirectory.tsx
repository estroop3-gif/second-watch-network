/**
 * PeopleDirectory - Upgraded people directory with filters
 * Uses existing useCommunity hook and CommunityGrid, adds filtering
 */
import React, { useState } from 'react';
import { useCommunity } from '@/hooks/useCommunity';
import { useCommunityRealtime } from '@/hooks/useCommunityRealtime';
import CommunityGrid from './CommunityGrid';
import CommunitySkeleton from './CommunitySkeleton';
import EmptyState from './EmptyState';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PeopleDirectoryProps {
  initialFilter?: string;
}

const roleFilters = [
  { id: 'filmmaker', label: 'Filmmaker' },
  { id: 'partner', label: 'Partner' },
  { id: 'premium', label: 'Premium' },
  { id: 'free', label: 'Free' },
];

const statusFilters = [
  { id: 'looking', label: 'Looking for work' },
  { id: 'hiring', label: 'Hiring' },
  { id: 'collabs', label: 'Open to collabs' },
];

const PeopleDirectory: React.FC<PeopleDirectoryProps> = ({ initialFilter }) => {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(
    initialFilter ? [initialFilter] : []
  );
  const [orderOnly, setOrderOnly] = useState(initialFilter === 'order');

  const {
    flatItems,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    upsertProfile,
    removeProfile,
    queryKey,
    error
  } = useCommunity({
    q: search,
    pageSize: 24,
    sortBy: 'updated_at',
    sortDir: 'desc',
  });

  useCommunityRealtime({
    onUpsert: upsertProfile,
    onRemove: removeProfile,
    queryKey,
  });

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSelectedRoles([]);
    setSelectedStatus([]);
    setOrderOnly(false);
  };

  const hasActiveFilters = selectedRoles.length > 0 || selectedStatus.length > 0 || orderOnly;

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full pl-10 pr-4 py-3 rounded-md bg-charcoal-black/50 border border-muted-gray/30 text-bone-white focus:outline-none focus:ring-2 focus:ring-accent-yellow"
          />
        </div>
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          className={cn(
            'border-muted-gray/30',
            hasActiveFilters && 'border-accent-yellow text-accent-yellow'
          )}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-accent-yellow text-charcoal-black rounded">
              {selectedRoles.length + selectedStatus.length + (orderOnly ? 1 : 0)}
            </span>
          )}
        </Button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-bone-white">Filter by</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-gray hover:text-accent-yellow flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Role Filters */}
          <div>
            <span className="text-xs text-muted-gray mb-2 block">Role</span>
            <div className="flex flex-wrap gap-2">
              {roleFilters.map((role) => (
                <button
                  key={role.id}
                  onClick={() => toggleRole(role.id)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-full border transition-colors',
                    selectedRoles.includes(role.id)
                      ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                      : 'border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-bone-white'
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filters */}
          <div>
            <span className="text-xs text-muted-gray mb-2 block">Status</span>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((status) => (
                <button
                  key={status.id}
                  onClick={() => toggleStatus(status.id)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-full border transition-colors',
                    selectedStatus.includes(status.id)
                      ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                      : 'border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-bone-white'
                  )}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>

          {/* Special Filters */}
          <div>
            <span className="text-xs text-muted-gray mb-2 block">Special</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setOrderOnly(!orderOnly)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  orderOnly
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-bone-white'
                )}
              >
                Order members only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <p className="text-center text-primary-red">
          Failed to load community: {error.message}
        </p>
      )}

      {/* Loading State */}
      {isLoading && <CommunitySkeleton count={9} />}

      {/* Results Grid */}
      {!isLoading && flatItems && flatItems.length > 0 && (
        <CommunityGrid items={flatItems} />
      )}

      {/* Empty State */}
      {!isLoading && (!flatItems || flatItems.length === 0) && !error && (
        <EmptyState
          title={search ? `No results for "${search}"` : 'No members found'}
          description={
            search
              ? 'Try adjusting your search terms or filters.'
              : 'When members join the community, they will appear here.'
          }
        />
      )}

      {/* Load More */}
      {hasNextPage && (
        <div className="flex justify-center mt-10">
          <Button
            className="px-6 py-2 bg-bone-white text-charcoal-black hover:bg-accent-yellow"
            disabled={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default PeopleDirectory;
