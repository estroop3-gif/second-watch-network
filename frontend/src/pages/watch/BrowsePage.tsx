/**
 * Browse Page
 * Filterable grid of worlds with genre/format filters
 */

import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useWorlds, useGenres } from '@/hooks/watch';
import { WorldCard } from '@/components/watch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  X,
  ChevronLeft,
  Grid,
  List,
  Film,
  Tv,
  Sparkles,
} from 'lucide-react';
import type { ContentFormat } from '@/types/watch';

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state from URL params
  const genre = searchParams.get('genre') || undefined;
  const format = (searchParams.get('format') as ContentFormat) || undefined;
  const sort = searchParams.get('sort') || 'newest';
  const query = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(query);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch data
  const { data: genres } = useGenres();
  const { data: worldsData, isLoading } = useWorlds({
    genre_id: genre,
    content_format: format,
    sort_by: sort as 'newest' | 'popular' | 'title',
    search: query || undefined,
    limit: 50,
  });

  const worlds = worldsData?.worlds || [];

  const updateFilter = (key: string, value: string | null) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilter('q', searchInput || null);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchInput('');
  };

  const hasActiveFilters = genre || format || query;

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-charcoal-black/95 backdrop-blur border-b border-bone-white/10">
        <div className="px-4 md:px-8 py-4">
          {/* Top Row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                to="/watch"
                className="text-muted-gray hover:text-bone-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <h1 className="text-2xl font-heading text-bone-white">Browse</h1>
            </div>

            {/* View Toggle */}
            <div className="hidden md:flex items-center gap-1 bg-bone-white/5 rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "px-3",
                  viewMode === 'grid'
                    ? "bg-bone-white/10 text-bone-white"
                    : "text-muted-gray hover:text-bone-white"
                )}
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "px-3",
                  viewMode === 'list'
                    ? "bg-bone-white/10 text-bone-white"
                    : "text-muted-gray hover:text-bone-white"
                )}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                type="text"
                placeholder="Search worlds..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 bg-bone-white/5 border-bone-white/10 text-bone-white placeholder:text-muted-gray"
              />
            </form>

            {/* Format Filter */}
            <Select
              value={format || 'all'}
              onValueChange={(v) => updateFilter('format', v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-32 bg-bone-white/5 border-bone-white/10 text-bone-white">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                <SelectItem value="series">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4" />
                    Series
                  </div>
                </SelectItem>
                <SelectItem value="film">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4" />
                    Films
                  </div>
                </SelectItem>
                <SelectItem value="special">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Specials
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Genre Filter */}
            <Select
              value={genre || 'all'}
              onValueChange={(v) => updateFilter('genre', v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-40 bg-bone-white/5 border-bone-white/10 text-bone-white">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres?.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sort}
              onValueChange={(v) => updateFilter('sort', v)}
            >
              <SelectTrigger className="w-32 bg-bone-white/5 border-bone-white/10 text-bone-white">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="title">A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-gray hover:text-bone-white"
                onClick={clearFilters}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 py-8">
        {/* Results Count */}
        {!isLoading && (
          <p className="text-sm text-muted-gray mb-6">
            {worlds.length} {worlds.length === 1 ? 'world' : 'worlds'} found
            {query && ` for "${query}"`}
          </p>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
              : "space-y-4"
          )}>
            {[...Array(10)].map((_, i) => (
              <Skeleton
                key={i}
                className={cn(
                  viewMode === 'grid'
                    ? "aspect-[2/3] rounded-lg"
                    : "h-32 rounded-lg"
                )}
              />
            ))}
          </div>
        ) : worlds.length > 0 ? (
          /* Grid/List View */
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {worlds.map((world) => (
                <WorldCard key={world.id} world={world} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {worlds.map((world) => (
                <WorldListItem key={world.id} world={world} />
              ))}
            </div>
          )
        ) : (
          /* Empty State */
          <div className="text-center py-20">
            <Filter className="w-16 h-16 text-muted-gray mx-auto mb-4" />
            <h2 className="text-xl font-heading text-bone-white mb-2">
              No Worlds Found
            </h2>
            <p className="text-muted-gray mb-6">
              Try adjusting your filters or search terms.
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear All Filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// List Item Component for list view
function WorldListItem({ world }: { world: any }) {
  return (
    <Link
      to={`/watch/worlds/${world.slug}`}
      className="flex gap-4 p-4 rounded-lg bg-bone-white/5 hover:bg-bone-white/10 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="relative w-32 md:w-48 aspect-video rounded overflow-hidden flex-shrink-0">
        {world.thumbnail_url ? (
          <img
            src={world.thumbnail_url}
            alt={world.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted-gray/20" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-1">
        <h3 className="text-lg font-medium text-bone-white group-hover:text-accent-yellow transition-colors line-clamp-1">
          {world.title}
        </h3>
        <div className="flex items-center gap-3 text-sm text-muted-gray mt-1">
          {world.content_format && (
            <span className="capitalize">{world.content_format}</span>
          )}
          {world.release_year && <span>{world.release_year}</span>}
          {world.episode_count > 0 && (
            <span>{world.episode_count} episodes</span>
          )}
        </div>
        {world.logline && (
          <p className="text-sm text-bone-white/70 mt-2 line-clamp-2">
            {world.logline}
          </p>
        )}
      </div>
    </Link>
  );
}

export default BrowsePage;
