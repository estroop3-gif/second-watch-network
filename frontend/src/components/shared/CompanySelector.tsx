/**
 * CompanySelector - Searchable autocomplete for production companies
 * Searches companies database and allows creating new ones
 */
import React, { useState, useCallback } from 'react';
import { Building2, BadgeCheck } from 'lucide-react';
import SearchableCombobox, { SearchableItem } from './SearchableCombobox';
import { useAuth } from '@/context/AuthContext';

interface Company extends SearchableItem {
  id: string;
  name: string;
  logo_url?: string;
  is_verified?: boolean;
}

interface CompanySelectorProps {
  value: string | null;
  onChange: (id: string | null, company?: Company) => void;
  disabled?: boolean;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

const CompanySelector: React.FC<CompanySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const { session } = useAuth();
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((companyId: string) => {
    setFailedImages(prev => new Set(prev).add(companyId));
  }, []);

  const searchCompanies = async (query: string): Promise<Company[]> => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      // If no query, get all companies alphabetically
      let url: string;
      if (!query || query.length < 1) {
        url = `${API_BASE}/api/v1/companies?limit=100`;
      } else {
        url = `${API_BASE}/api/v1/companies/search?q=${encodeURIComponent(query)}&limit=20`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details');
        console.warn(`Companies search failed (${response.status}): ${errorText}`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('Companies search error:', error.message);
      }
      return [];
    }
  };

  const createCompany = async (name: string): Promise<Company> => {
    if (!session?.access_token) {
      throw new Error('Please log in to add a company');
    }

    const response = await fetch(`${API_BASE}/api/v1/companies`, {
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
      if (response.status === 409) {
        throw new Error('Company already exists');
      }
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'Failed to create company');
    }

    return await response.json();
  };

  const renderItem = (company: Company) => {
    const showLogo = company.logo_url && !failedImages.has(company.id);

    return (
      <div className="flex items-center gap-2">
        {showLogo ? (
          <img
            src={company.logo_url}
            alt=""
            className="h-5 w-5 object-contain"
            onError={() => handleImageError(company.id)}
          />
        ) : (
          <Building2 className="h-4 w-4 text-muted-gray" />
        )}
        <span className="text-bone-white">{company.name}</span>
        {company.is_verified && (
          <BadgeCheck className="h-3 w-3 text-blue-400" />
        )}
      </div>
    );
  };

  const renderSelected = (company: Company) => {
    const showLogo = company.logo_url && !failedImages.has(company.id);

    return (
      <div className="flex items-center gap-2 truncate">
        {showLogo ? (
          <img
            src={company.logo_url}
            alt=""
            className="h-4 w-4 object-contain flex-shrink-0"
            onError={() => handleImageError(company.id)}
          />
        ) : (
          <Building2 className="h-4 w-4 text-muted-gray flex-shrink-0" />
        )}
        <span className="truncate">{company.name}</span>
        {company.is_verified && (
          <BadgeCheck className="h-3 w-3 text-blue-400 flex-shrink-0" />
        )}
      </div>
    );
  };

  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      searchFn={searchCompanies}
      onAddNew={createCompany}
      placeholder="Search or add company..."
      searchPlaceholder="Type company name..."
      emptyMessage="No companies found."
      addNewLabel="Add company"
      renderItem={renderItem}
      renderSelected={renderSelected}
      disabled={disabled}
      className={className}
    />
  );
};

export default CompanySelector;
