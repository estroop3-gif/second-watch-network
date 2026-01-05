/**
 * Search Page
 * Full-screen search experience with real-time results
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorlds } from '@/hooks/watch';
import { WorldCard } from '@/components/watch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

// Recent searches stored in localStorage
const RECENT_SEARCHES_KEY = 'swn_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Fetch search results
  const { data: searchResults, isLoading } = useWorlds({
    search: query || undefined,
    limit: 20,
  });

  // Fetch trending for suggestions
  const { data: trendingWorlds } = useWorlds({
    sort_by: 'popular',
    limit: 6,
  });

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Save search to recent
  const saveRecentSearch = (term: string) => {
    if (!term.trim()) return;

    const updated = [
      term,
      ...recentSearches.filter((s) => s.toLowerCase() !== term.toLowerCase()),
    ].slice(0, MAX_RECENT_SEARCHES);

    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  const handleSearch = (term: string) => {
    if (term.trim()) {
      setSearchParams({ q: term });
      saveRecentSearch(term);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(searchInput);
  };

  const handleClear = () => {
    setSearchInput('');
    setSearchParams({});
    inputRef.current?.focus();
  };

  const removeRecentSearch = (term: string) => {
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (e) {
      // Ignore
    }
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (e) {
      // Ignore
    }
  };

  const worlds = searchResults?.worlds || [];
  const hasResults = query && worlds.length > 0;
  const noResults = query && !isLoading && worlds.length === 0;

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Search Header */}
      <div className="sticky top-0 z-40 bg-charcoal-black border-b border-bone-white/10">
        <div className="px-4 md:px-8 py-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-gray hover:text-bone-white flex-shrink-0"
              onClick={() => navigate(-1)}
            >
              <X className="w-6 h-6" />
            </Button>

            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-gray" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search worlds, genres, creators..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-12 pr-10 h-12 text-lg bg-bone-white/5 border-bone-white/10 text-bone-white placeholder:text-muted-gray rounded-full"
              />
              {searchInput && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-gray hover:text-bone-white"
                  onClick={handleClear}
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>

            <Button
              type="submit"
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 flex-shrink-0"
            >
              Search
            </Button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-8 py-8">
        {/* Search Results */}
        {query ? (
          <div>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="aspect-[2/3] rounded-lg" />
                ))}
              </div>
            ) : hasResults ? (
              <>
                <p className="text-sm text-muted-gray mb-6">
                  {worlds.length} result{worlds.length !== 1 ? 's' : ''} for "{query}"
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {worlds.map((world) => (
                    <WorldCard key={world.id} world={world} />
                  ))}
                </div>
              </>
            ) : noResults ? (
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-muted-gray mx-auto mb-4" />
                <h2 className="text-xl font-heading text-bone-white mb-2">
                  No Results Found
                </h2>
                <p className="text-muted-gray mb-6">
                  We couldn't find anything matching "{query}"
                </p>
                <Button variant="outline" onClick={handleClear}>
                  Clear Search
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          /* Suggestions when no query */
          <div className="space-y-10">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-heading text-bone-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-gray" />
                    Recent Searches
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-gray hover:text-bone-white"
                    onClick={clearAllRecent}
                  >
                    Clear All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <div
                      key={term}
                      className="flex items-center gap-1 bg-bone-white/5 rounded-full"
                    >
                      <button
                        onClick={() => {
                          setSearchInput(term);
                          handleSearch(term);
                        }}
                        className="px-4 py-2 text-bone-white hover:text-accent-yellow transition-colors"
                      >
                        {term}
                      </button>
                      <button
                        onClick={() => removeRecentSearch(term)}
                        className="pr-3 text-muted-gray hover:text-bone-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending */}
            {trendingWorlds?.worlds && trendingWorlds.worlds.length > 0 && (
              <div>
                <h2 className="text-lg font-heading text-bone-white flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-accent-yellow" />
                  Trending Now
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {trendingWorlds.worlds.map((world) => (
                    <WorldCard key={world.id} world={world} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Categories */}
            <div>
              <h2 className="text-lg font-heading text-bone-white mb-4">
                Browse by Category
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Series', path: '/watch/browse?format=series', color: 'from-blue-600' },
                  { label: 'Films', path: '/watch/browse?format=film', color: 'from-purple-600' },
                  { label: 'Drama', path: '/watch/browse?genre=drama', color: 'from-red-600' },
                  { label: 'Comedy', path: '/watch/browse?genre=comedy', color: 'from-yellow-600' },
                ].map((cat) => (
                  <Link
                    key={cat.label}
                    to={cat.path}
                    className={`p-6 rounded-lg bg-gradient-to-br ${cat.color} to-charcoal-black/50 hover:scale-105 transition-transform`}
                  >
                    <span className="text-lg font-medium text-bone-white">
                      {cat.label}
                    </span>
                    <ArrowRight className="w-5 h-5 text-bone-white/70 mt-2" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
