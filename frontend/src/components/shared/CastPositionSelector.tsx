/**
 * CastPositionSelector - Searchable dropdown for cast position types (Lead, Supporting, etc.)
 * Supports adding new position types that persist to the database
 */
import React from 'react';
import { Star } from 'lucide-react';
import SearchableCombobox, { SearchableItem } from './SearchableCombobox';
import { useAuth } from '@/context/AuthContext';

interface CastPositionType extends SearchableItem {
  id: string;
  name: string;
  slug: string;
}

interface CastPositionSelectorProps {
  value: string | null;
  onChange: (id: string | null, positionType?: CastPositionType) => void;
  disabled?: boolean;
  className?: string;
  /** Pre-populated cast position type for edit mode */
  initialSelectedItem?: CastPositionType | null;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

const CastPositionSelector: React.FC<CastPositionSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
  initialSelectedItem,
}) => {
  const { session } = useAuth();

  const searchCastPositionTypes = async (query: string): Promise<CastPositionType[]> => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const url = `${API_BASE}/api/v1/cast-position-types/search?q=${encodeURIComponent(query || '')}&limit=20`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.warn(`Cast position types search failed (${response.status}): ${errorText}`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Cast position types search error:', error.message);
      }
      return [];
    }
  };

  const createCastPositionType = async (name: string): Promise<CastPositionType> => {
    if (!session?.access_token) {
      throw new Error('Please log in to add a position type');
    }

    const response = await fetch(`${API_BASE}/api/v1/cast-position-types`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh and try again');
      }
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Failed to create position type');
    }

    return await response.json();
  };

  const renderItem = (positionType: CastPositionType) => (
    <div className="flex items-center gap-2">
      <Star className="h-4 w-4 text-accent-yellow" />
      <span className="text-bone-white">{positionType.name}</span>
    </div>
  );

  const renderSelected = (positionType: CastPositionType) => (
    <div className="flex items-center gap-2 truncate">
      <Star className="h-4 w-4 text-accent-yellow flex-shrink-0" />
      <span className="truncate text-bone-white">{positionType.name}</span>
    </div>
  );

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      searchFn={searchCastPositionTypes}
      onAddNew={createCastPositionType}
      placeholder="Select role type..."
      searchPlaceholder="Search or add role type..."
      emptyMessage="No position types found."
      addNewLabel="Add"
      renderItem={renderItem}
      renderSelected={renderSelected}
      disabled={disabled}
      className={className}
      initialSelectedItem={initialSelectedItem}
    />
  );
};

export default CastPositionSelector;
