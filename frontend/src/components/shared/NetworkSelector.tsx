/**
 * NetworkSelector - Dropdown for selecting TV networks with logo preview
 */
import React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Loader2, Tv } from 'lucide-react';
import type { TvNetwork, NetworkCategoryGroup } from '@/types/productions';

interface NetworkSelectorProps {
  value: string | null;
  onChange: (networkId: string | null, network?: TvNetwork) => void;
  placeholder?: string;
  disabled?: boolean;
  showLogo?: boolean;
}

const NetworkSelector: React.FC<NetworkSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select network/distributor',
  disabled = false,
  showLogo = true,
}) => {
  // Fetch networks grouped by category
  const { data: networkGroups, isLoading } = useQuery({
    queryKey: ['tv-networks-grouped'],
    queryFn: async () => {
      const response = await fetch('/api/v1/networks?grouped=true');
      if (!response.ok) throw new Error('Failed to fetch networks');
      return response.json() as Promise<NetworkCategoryGroup[]>;
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Find current selected network
  const selectedNetwork = React.useMemo(() => {
    if (!value || !networkGroups) return null;
    for (const group of networkGroups) {
      const network = group.networks.find((n) => n.id === value);
      if (network) return network;
    }
    return null;
  }, [value, networkGroups]);

  const handleChange = (networkId: string) => {
    if (networkId === '__none__') {
      onChange(null);
      return;
    }

    // Find the network object
    if (networkGroups) {
      for (const group of networkGroups) {
        const network = group.networks.find((n) => n.id === networkId);
        if (network) {
          onChange(networkId, network);
          return;
        }
      }
    }
    onChange(networkId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border border-muted-gray/30 rounded-md bg-charcoal-black/50">
        <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
        <span className="text-sm text-muted-gray">Loading networks...</span>
      </div>
    );
  }

  return (
    <Select
      value={value || '__none__'}
      onValueChange={handleChange}
      disabled={disabled}
    >
      <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
        <div className="flex items-center gap-2">
          {showLogo && selectedNetwork?.logo_url ? (
            <img
              src={selectedNetwork.logo_url}
              alt={selectedNetwork.name}
              className="h-4 w-auto max-w-8 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Tv className="w-4 h-4 text-muted-gray" />
          )}
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent className="bg-charcoal-black border-muted-gray/30 max-h-80">
        <SelectItem value="__none__" className="text-muted-gray">
          No network selected
        </SelectItem>

        {networkGroups?.map((group) => (
          <SelectGroup key={group.category}>
            <SelectLabel className="text-xs text-accent-yellow font-medium uppercase tracking-wide">
              {group.label}
            </SelectLabel>
            {group.networks.map((network) => (
              <SelectItem
                key={network.id}
                value={network.id}
                className="text-bone-white"
              >
                <div className="flex items-center gap-2">
                  {showLogo && network.logo_url ? (
                    <img
                      src={network.logo_url}
                      alt={network.name}
                      className="h-4 w-6 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <span>{network.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};

export default NetworkSelector;
