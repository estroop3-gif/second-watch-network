/**
 * SlateIndex - "The Slate" landing page
 * Browsable index of all productions with search
 * Accessible via /slate (no auth required)
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Film, Search, Clapperboard } from 'lucide-react';
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

const SlateIndex: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const fetchProductions = async () => {
      setIsLoading(true);
      try {
        const data = await api.searchAllProductions(debouncedQuery);
        setResults(data || []);
      } catch (error) {
        console.error('Failed to fetch productions:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProductions();
  }, [debouncedQuery]);

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto px-4 max-w-4xl py-8">
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
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-gray" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search productions..."
            className="pl-10 h-12 bg-charcoal-black/50 border-muted-gray/30 text-bone-white text-lg"
          />
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <Film className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
            <p className="text-muted-gray text-lg">
              {query ? 'No productions found matching your search.' : 'No productions yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((prod) => (
              <ProductionCard key={prod.id} production={prod} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProductionCard: React.FC<{ production: any }> = ({ production }) => {
  const slug = production.slug;
  const isBacklot = production.source === 'backlot';

  const content = (
    <div className="flex items-center gap-4 p-4 rounded-lg bg-charcoal-black/50 border border-muted-gray/20 hover:border-muted-gray/40 transition-colors group">
      {/* Icon */}
      <div className="w-12 h-12 rounded-lg bg-muted-gray/10 flex items-center justify-center flex-shrink-0">
        {isBacklot ? (
          <Clapperboard className="w-6 h-6 text-accent-yellow" />
        ) : (
          <Film className="w-6 h-6 text-muted-gray" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-bone-white group-hover:text-accent-yellow transition-colors truncate">
          {production.name}
        </h3>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {production.production_type && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-muted-gray/30 text-muted-gray">
              {PRODUCTION_TYPE_LABELS[production.production_type] || production.production_type}
            </Badge>
          )}
          {isBacklot && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-accent-yellow/30 text-accent-yellow">
              Backlot
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  // Link to Slate detail page if slug exists, otherwise non-clickable
  if (slug && !isBacklot) {
    return (
      <Link to={`/slate/${slug}`} className="block">
        {content}
      </Link>
    );
  }

  // For backlot sources, link to backlot project page
  if (isBacklot && slug) {
    return (
      <Link to={`/projects/${slug}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

export default SlateIndex;
