/**
 * CRMCompanySelector - Searchable autocomplete for CRM companies
 * Searches crm_companies table and allows creating new ones.
 * Follows the same pattern as shared/CompanySelector.tsx but uses CRM API.
 */
import React from 'react';
import { Building2 } from 'lucide-react';
import SearchableCombobox, { SearchableItem } from '../shared/SearchableCombobox';
import { api } from '@/lib/api';

interface CRMCompany extends SearchableItem {
  id: string;
  name: string;
  website?: string;
  city?: string;
  state?: string;
}

interface CRMCompanySelectorProps {
  value: string | null;
  onChange: (id: string | null, name?: string) => void;
  disabled?: boolean;
  className?: string;
  initialSelectedItem?: CRMCompany | null;
}

const CRMCompanySelector: React.FC<CRMCompanySelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className,
  initialSelectedItem,
}) => {
  const searchCompanies = async (query: string): Promise<CRMCompany[]> => {
    try {
      const results = await api.searchCRMCompanies(query || '', 20);
      return Array.isArray(results) ? results : [];
    } catch {
      return [];
    }
  };

  const createCompany = async (name: string): Promise<CRMCompany> => {
    return await api.createCRMCompany({ name });
  };

  const handleChange = (id: string | null, company?: any) => {
    onChange(id, company?.name || null);
  };

  const renderItem = (company: CRMCompany) => (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-gray" />
      <span className="text-bone-white">{company.name}</span>
      {company.city && company.state && (
        <span className="text-xs text-muted-gray ml-auto">{company.city}, {company.state}</span>
      )}
    </div>
  );

  const renderSelected = (company: CRMCompany) => (
    <div className="flex items-center gap-2 truncate">
      <Building2 className="h-4 w-4 text-muted-gray flex-shrink-0" />
      <span className="truncate text-bone-white">{company.name}</span>
    </div>
  );

  return (
    <SearchableCombobox
      value={value}
      onChange={handleChange}
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
      initialSelectedItem={initialSelectedItem}
    />
  );
};

export default CRMCompanySelector;
