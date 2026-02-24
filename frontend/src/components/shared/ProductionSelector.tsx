/**
 * ProductionSelector - Searchable dropdown for productions
 * Searches ALL productions + public backlot projects via /search/all
 * Supports "Add new" to quick-create a production
 */
import React from 'react';
import { Film, Clapperboard } from 'lucide-react';
import SearchableCombobox, { SearchableItem } from './SearchableCombobox';
import { api } from '@/lib/api';

export interface ProductionItem extends SearchableItem {
  id: string;
  name: string;
  production_type?: string;
  slug?: string;
  source?: 'production' | 'backlot';
}

interface ProductionSelectorProps {
  value: string | null;
  onChange: (id: string | null, production?: ProductionItem) => void;
  disabled?: boolean;
  className?: string;
  /** Pre-populated production for edit mode */
  initialSelectedItem?: ProductionItem | null;
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

const ProductionSelector: React.FC<ProductionSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
  initialSelectedItem,
}) => {
  const searchProductions = async (query: string): Promise<ProductionItem[]> => {
    try {
      const results = await api.searchAllProductions(query);
      return (results || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        production_type: r.production_type,
        slug: r.slug,
        source: r.source || 'production',
      }));
    } catch (error) {
      console.error('Production search error:', error);
      return [];
    }
  };

  const handleAddNew = async (name: string): Promise<ProductionItem> => {
    const result = await api.quickCreateProduction(name);
    return {
      id: result.id,
      name: result.name,
      production_type: result.production_type,
      slug: result.slug,
      source: 'production',
    };
  };

  const renderItem = (prod: ProductionItem) => (
    <div className="flex items-center gap-2">
      {prod.source === 'backlot' ? (
        <Clapperboard className="h-4 w-4 text-accent-yellow flex-shrink-0" />
      ) : (
        <Film className="h-4 w-4 text-muted-gray flex-shrink-0" />
      )}
      <div className="flex flex-col min-w-0">
        <span className="text-bone-white truncate">{prod.name}</span>
        <div className="flex items-center gap-1.5">
          {prod.production_type && (
            <span className="text-[10px] text-muted-gray">
              {PRODUCTION_TYPE_LABELS[prod.production_type] || prod.production_type}
            </span>
          )}
          {prod.source === 'backlot' && (
            <span className="text-[10px] text-accent-yellow">Backlot</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderSelected = (prod: ProductionItem) => (
    <div className="flex items-center gap-2 truncate">
      <Film className="h-4 w-4 text-muted-gray flex-shrink-0" />
      <span className="truncate">{prod.name}</span>
    </div>
  );

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      searchFn={searchProductions}
      onAddNew={handleAddNew}
      placeholder="Select production..."
      searchPlaceholder="Search productions..."
      emptyMessage="No productions found."
      addNewLabel="Add"
      renderItem={renderItem}
      renderSelected={renderSelected}
      disabled={disabled}
      className={className}
      initialSelectedItem={initialSelectedItem}
    />
  );
};

export default ProductionSelector;
