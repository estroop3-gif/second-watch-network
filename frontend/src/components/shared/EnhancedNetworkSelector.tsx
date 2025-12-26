/**
 * EnhancedNetworkSelector - Searchable autocomplete for TV networks
 * Searches networks database and allows creating new ones
 * Shows network logos with fallback to icon if image fails
 */
import React, { useState, useCallback } from 'react';
import { Tv } from 'lucide-react';
import SearchableCombobox, { SearchableItem } from './SearchableCombobox';
import { useAuth } from '@/context/AuthContext';

interface Network extends SearchableItem {
  id: string;
  name: string;
  slug?: string;
  logo_url?: string | null;
  category?: string;
}

interface EnhancedNetworkSelectorProps {
  value: string | null;
  onChange: (id: string | null, network?: Network) => void;
  disabled?: boolean;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

const CATEGORY_LABELS: Record<string, string> = {
  broadcast: 'Broadcast',
  cable: 'Cable/Premium',
  streaming: 'Streaming',
  news: 'News/Sports',
  specialty: 'Specialty',
};

const EnhancedNetworkSelector: React.FC<EnhancedNetworkSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const { session } = useAuth();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((networkId: string) => {
    setFailedImages(prev => new Set(prev).add(networkId));
  }, []);

  const searchNetworks = async (query: string): Promise<Network[]> => {
    try {
      // If no query, get all networks alphabetically
      let url: string;
      if (!query || query.length < 1) {
        url = `${API_BASE}/api/v1/networks?grouped=false`;
      } else {
        url = `${API_BASE}/api/v1/networks/search/query?q=${encodeURIComponent(query)}&limit=20`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.warn(`Networks search failed (${response.status}): ${errorText}`);
        return [];
      }

      const data = await response.json();
      const networks = Array.isArray(data) ? data : [];

      // Sort alphabetically if it's the full list
      if (!query || query.length < 1) {
        networks.sort((a, b) => a.name.localeCompare(b.name));
      }

      return networks;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Networks search error:', error.message);
      }
      return [];
    }
  };

  const createNetwork = async (name: string): Promise<Network> => {
    if (!session?.access_token) {
      throw new Error('Please log in to add a network');
    }

    const response = await fetch(`${API_BASE}/api/v1/networks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name,
        category: 'specialty', // Default category for user-added networks
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Session expired. Please refresh and try again');
      }
      if (response.status === 409) {
        throw new Error('Network already exists');
      }
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Failed to create network');
    }

    return await response.json();
  };

  const renderItem = (network: Network) => {
    const showLogo = network.logo_url && !failedImages.has(network.id);

    return (
      <div className="flex items-center gap-2">
        {showLogo ? (
          <img
            src={network.logo_url!}
            alt=""
            className="h-5 w-8 object-contain"
            onError={() => handleImageError(network.id)}
          />
        ) : (
          <Tv className="h-4 w-4 text-muted-gray" />
        )}
        <div className="flex flex-col">
          <span className="text-bone-white">{network.name}</span>
          {network.category && (
            <span className="text-[10px] text-muted-gray">
              {CATEGORY_LABELS[network.category] || network.category}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderSelected = (network: Network) => {
    const showLogo = network.logo_url && !failedImages.has(network.id);

    return (
      <div className="flex items-center gap-2 truncate">
        {showLogo ? (
          <img
            src={network.logo_url!}
            alt=""
            className="h-5 w-8 object-contain flex-shrink-0"
            onError={() => handleImageError(network.id)}
          />
        ) : (
          <Tv className="h-4 w-4 text-muted-gray flex-shrink-0" />
        )}
        <span className="truncate">{network.name}</span>
      </div>
    );
  };

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      searchFn={searchNetworks}
      onAddNew={createNetwork}
      placeholder="Search or add network..."
      searchPlaceholder="Type network name..."
      emptyMessage="No networks found."
      addNewLabel="Add network"
      renderItem={renderItem}
      renderSelected={renderSelected}
      disabled={disabled}
      className={className}
    />
  );
};

export default EnhancedNetworkSelector;
