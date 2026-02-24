/**
 * SlateIndex - "The Slate" landing page
 * IMDB-style browsable index with poster grid and people cards
 * Accessible via /slate (no auth required)
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Film, Search, Clapperboard, User, Users } from 'lucide-react';
import { api } from '@/lib/api';

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  documentary: 'Documentary',
  feature_film: 'Feature Film',
  short_film: 'Short Film',
  series_episodic: 'Series/Episodic',
  limited_series: 'Limited Series',
  commercial: 'Commercial',
  music_video: 'Music Video',
  corporate_industrial: 'Corporate',
  wedding_event: 'Wedding/Event',
  web_content: 'Web Content',
  live_event: 'Live Event',
  news_eng: 'News/ENG',
};

type SearchType = 'all' | 'productions' | 'people';

const SlateIndex: React.FC = () => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('all');
  const [productions, setProductions] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const data = await api.searchUnified(debouncedQuery, searchType, 20);
        setProductions(data?.productions || []);
        setPeople(data?.people || []);
      } catch (error) {
        console.error('Failed to fetch results:', error);
        setProductions([]);
        setPeople([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [debouncedQuery, searchType]);

  const hasResults = productions.length > 0 || people.length > 0;
  const showProductions = searchType !== 'people';
  const showPeople = searchType !== 'productions';

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Clapperboard className="w-8 h-8 text-primary-red" />
            <h1 className="text-4xl font-heading text-bone-white">The Slate</h1>
          </div>
          <p className="text-muted-gray text-lg">
            Browse productions and discover cast & crew
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4 max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-gray" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search productions & people..."
            className="pl-10 h-12 bg-charcoal-black/50 border-muted-gray/30 text-bone-white text-lg"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8 justify-center">
          {(['all', 'productions', 'people'] as SearchType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSearchType(type)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                searchType === type
                  ? 'bg-accent-yellow text-charcoal-black'
                  : 'bg-muted-gray/20 text-muted-gray hover:bg-muted-gray/30 hover:text-bone-white'
              }`}
            >
              {type === 'all' ? 'All' : type === 'productions' ? 'Productions' : 'People'}
            </button>
          ))}
        </div>

        {/* Results */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : !hasResults ? (
          <div className="text-center py-16">
            <Film className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
            <p className="text-muted-gray text-lg">
              {query
                ? `No ${searchType === 'people' ? 'people' : searchType === 'productions' ? 'productions' : 'results'} found matching your search.`
                : 'No productions yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* People Section — horizontal scroll when searching */}
            {showPeople && people.length > 0 && (
              <div>
                <h2 className="text-lg font-heading text-bone-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent-yellow" />
                  People
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-muted-gray/30 text-muted-gray ml-1">
                    {people.length}
                  </Badge>
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-gray/20">
                  {people.map((person) => (
                    <PersonCard key={person.id} person={person} />
                  ))}
                </div>
              </div>
            )}

            {/* Productions Section — poster grid */}
            {showProductions && productions.length > 0 && (
              <div>
                <h2 className="text-lg font-heading text-bone-white mb-4 flex items-center gap-2">
                  <Film className="w-5 h-5 text-primary-red" />
                  {query ? 'Productions' : 'Recent Productions'}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-muted-gray/30 text-muted-gray ml-1">
                    {productions.length}
                  </Badge>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {productions.map((prod) => (
                    <ProductionCard key={prod.id} production={prod} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Loading Skeleton ---------- */
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-10">
    {/* People skeleton */}
    <div className="flex gap-4 overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex-shrink-0 w-32 flex flex-col items-center gap-2">
          <Skeleton className="w-16 h-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
    {/* Poster grid skeleton */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
        <div key={i}>
          <Skeleton className="w-full aspect-[2/3] rounded-lg mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  </div>
);

/* ---------- Person Card (portrait-style) ---------- */
const PersonCard: React.FC<{ person: any }> = ({ person }) => {
  const displayName = person.full_name || person.display_name || person.username || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Link to={`/slate/person/${person.username}`} className="block flex-shrink-0 group">
      <div className="w-32 flex flex-col items-center text-center p-3 rounded-lg hover:bg-muted-gray/10 transition-colors">
        <Avatar className="h-16 w-16 mb-2 ring-2 ring-transparent group-hover:ring-accent-yellow/40 transition-all">
          <AvatarImage src={person.avatar_url} />
          <AvatarFallback className="bg-muted-gray/20 text-bone-white text-lg">
            {initials}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-bone-white group-hover:text-accent-yellow transition-colors truncate w-full text-sm">
          {displayName}
        </p>
        {person.department ? (
          <p className="text-[11px] text-muted-gray truncate w-full">{person.department}</p>
        ) : (
          <p className="text-[11px] text-muted-gray truncate w-full">
            {person.credit_count > 0
              ? `${person.credit_count} credit${person.credit_count !== 1 ? 's' : ''}`
              : `@${person.username}`}
          </p>
        )}
      </div>
    </Link>
  );
};

/* ---------- Production Poster Card ---------- */
const ProductionCard: React.FC<{ production: any }> = ({ production }) => {
  const slug = production.slug;
  const isBacklot = production.source === 'backlot';
  const href = isBacklot ? `/slate/backlot/${slug}` : `/slate/${slug}`;

  const card = (
    <div className="group cursor-pointer">
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-muted-gray/10 border border-muted-gray/20 group-hover:border-accent-yellow/40 transition-all group-hover:scale-[1.02] transform">
        {production.poster_url ? (
          <img
            src={production.poster_url}
            alt={production.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
            {isBacklot ? (
              <Clapperboard className="w-10 h-10 text-accent-yellow/40" />
            ) : (
              <Film className="w-10 h-10 text-muted-gray/30" />
            )}
            <p className="text-muted-gray/50 text-xs text-center leading-tight line-clamp-2">
              {production.name}
            </p>
          </div>
        )}

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
          <h3 className="font-semibold text-bone-white text-sm leading-tight line-clamp-2 group-hover:text-accent-yellow transition-colors">
            {production.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {production.year && (
              <span className="text-[11px] text-bone-white/70">{production.year}</span>
            )}
            {production.year && production.production_type && (
              <span className="text-bone-white/30 text-[11px]">&middot;</span>
            )}
            {production.production_type && (
              <span className="text-[11px] text-bone-white/70">
                {PRODUCTION_TYPE_LABELS[production.production_type] || production.production_type}
              </span>
            )}
          </div>
        </div>

        {/* Backlot badge */}
        {isBacklot && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-accent-yellow/90 text-charcoal-black text-[9px] px-1.5 py-0 h-4 font-medium">
              Backlot
            </Badge>
          </div>
        )}
      </div>
    </div>
  );

  if (slug) {
    return (
      <Link to={href} className="block">
        {card}
      </Link>
    );
  }

  return card;
};

export default SlateIndex;
